import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './CheckinPage.css';
import SignatureCanvas from 'react-signature-canvas';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { gerarComprovanteCheckinPDF } from '../../utils/gerarComprovanteCheckinPDF';

const CheckinPage = () => {
  const { id, modo: modoParam } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [modo, setModo] = useState(modoParam ? modoParam.toUpperCase() : 'IDA');
  const isIda = modo === 'IDA';

  const [locacao, setLocacao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [itensState, setItensState] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [listaColaboradores, setListaColaboradores] = useState([]);

  // ☑️ SELEÇÃO DE PEÇAS EM MASSA
  const [itensSelecionados, setItensSelecionados] = useState(new Set());

  // 🔍 FILTROS & BUSCA
  const [filtroTab, setFiltroTab] = useState('TODOS');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [buscaCodigo, setBuscaCodigo] = useState('');
  const [mensagemBip, setMensagemBip] = useState(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [modalExpandirAberto, setModalExpandirAberto] = useState(false);
  
  // ❓ MODAL DE CONFIRMAÇÃO DE ITEM (COM FOTO)
  const [itemParaConfirmar, setItemParaConfirmar] = useState(null);

  const inputBuscaRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // ✍️ ASSINATURA DIGITAL & FOTOS
  const sigCanvasRef = useRef(null);
  const [assinaturaSalvaUrl, setAssinaturaSalvaUrl] = useState(null);
  const [fotosVistoria, setFotosVistoria] = useState([]);

  // 🔄 CARREGAR DADOS DA LOCAÇÃO
  useEffect(() => {
    const carregarDadosPage = async () => {
      if (!id || !tenantId) return;
      setLoading(true);
      try {
        const locRef = doc(db, "locacoes", id);
        const locSnap = await getDoc(locRef);

        if (locSnap.exists()) {
          const data = { id: locSnap.id, ...locSnap.data() };
          setLocacao(data);

          if (data.itens && Array.isArray(data.itens)) {
            const itensPreparados = data.itens.map(item => {
              const totalQtd = Number(item.quantidade || 1);
              const qtdConfInicial = item.qtdConferida !== undefined
                ? Number(item.qtdConferida)
                : 0;

              return {
                ...item,
                quantidade: totalQtd,
                qtdConferida: Math.min(qtdConfInicial, totalQtd),
                checkedSeparacao: item.checkedSeparacao !== undefined ? item.checkedSeparacao : (qtdConfInicial >= totalQtd),
                checkedDevolucao: item.checkedDevolucao !== undefined ? item.checkedDevolucao : false,
                statusRetorno: item.statusRetorno || (item.avaria ? 'avaria' : item.faltou ? 'faltou' : 'ok'),
                motivoAvaria: item.motivoAvaria || '',
                custoAvaria: item.custoAvaria || '',
                localizacao: item.localizacao || item.prateleira || 'Prateleira A-01',
                enviarManutencao: item.enviarManutencao !== undefined ? item.enviarManutencao : true
              };
            });
            setItensState(itensPreparados);
          }

          if (isIda) {
            setObservacoes(data.obsSaida || '');
            setFotosVistoria(data.fotosCheckinSaida || []);
            if (data.assinaturaSaidaUrl) setAssinaturaSalvaUrl(data.assinaturaSaidaUrl);
          } else {
            setObservacoes(data.obsRetorno || '');
            setFotosVistoria(data.fotosCheckinRetorno || []);
            if (data.assinaturaRetornoUrl) setAssinaturaSalvaUrl(data.assinaturaRetornoUrl);
          }
        } else {
          alert("🚫 Locação não encontrada!");
          navigate('/locacoes');
        }

        // Buscar Colaboradores da Empresa
        const qEquipe = query(collection(db, "equipe"), where("empresaId", "==", tenantId));
        const snapEquipe = await getDocs(qEquipe).catch(() => ({ docs: [] }));
        const equipeDocs = snapEquipe.docs ? snapEquipe.docs.map(d => d.data()) : [];

        const nomesSet = new Set();
        const nomeAtual = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || 'Proprietário / Admin';
        if (nomeAtual) nomesSet.add(nomeAtual);

        equipeDocs.forEach(u => {
          const n = u.nome || u.nomeCompleto || u.displayName || u.email;
          if (n) nomesSet.add(n);
        });

        setListaColaboradores(Array.from(nomesSet));
        setResponsavel(nomeAtual);

      } catch (err) {
        console.error("Erro ao carregar página de checkin:", err);
      } finally {
        setLoading(false);
      }
    };

    carregarDadosPage();
  }, [id, tenantId, modo, isIda]);

  // 🔍 PROCESSAR BIPAGEM
  const processarCodigoDetectado = (termoRaw) => {
    if (!termoRaw) return;
    const termo = String(termoRaw).trim().toLowerCase();
    const termoSemHifen = termo.replace(/-/g, '');

    // Match exato
    const idxExato = itensState.findIndex(it => {
      const cod = String(it.codigo || '').toLowerCase();
      const codSemHifen = cod.replace(/-/g, '');
      const barcode = String(it.barcode || it.codigoBarra || it.qrCode || '').toLowerCase();
      return cod === termo || codSemHifen === termoSemHifen || (barcode && barcode === termo);
    });

    if (idxExato !== -1) {
      efetivarConferenciaItem(idxExato);
      setBuscaCodigo('');
      return;
    }

    // Match parcial com modal de confirmação + foto
    const idxParcial = itensState.findIndex(it => {
      const nome = String(it.nome || '').toLowerCase();
      return nome.includes(termo);
    });

    if (idxParcial !== -1) {
      setItemParaConfirmar({
        index: idxParcial,
        item: itensState[idxParcial]
      });
      return;
    }

    setMensagemBip({ tipo: 'erro', texto: `❌ Peça ou código "${termoRaw}" não encontrado no pedido!` });
    setBuscaCodigo('');
    setTimeout(() => setMensagemBip(null), 3500);
  };

  const efetivarConferenciaItem = (index) => {
    const itemAchado = itensState[index];
    const qtdMax = itemAchado.quantidade;
    const novaQtd = Math.min(itemAchado.qtdConferida + 1, qtdMax);

    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        return {
          ...it,
          qtdConferida: novaQtd,
          checkedSeparacao: novaQtd >= qtdMax,
          checkedDevolucao: true
        };
      }
      return it;
    }));

    setMensagemBip({ tipo: 'sucesso', texto: `✅ "${itemAchado.nome}" conferido (${novaQtd}/${qtdMax} un)` });
    setItemParaConfirmar(null);
    setBuscaCodigo('');
    setTimeout(() => setMensagemBip(null), 3500);
  };

  // ☑️ SELEÇÃO & MARCAÇÃO DIRETA PELO CHECKBOX DO ITEM
  const toggleSelecaoItem = (index) => {
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        const novaQtd = it.qtdConferida >= it.quantidade ? 0 : it.quantidade;
        return {
          ...it,
          qtdConferida: novaQtd,
          checkedSeparacao: novaQtd >= it.quantidade,
          checkedDevolucao: novaQtd > 0
        };
      }
      return it;
    }));

    setItensSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(index)) novo.delete(index);
      else novo.add(index);
      return novo;
    });
  };

  const toggleSelecionarTodos = () => {
    const todosConferidos = itensState.every(i => i.qtdConferida >= i.quantidade);

    setItensState(prev => prev.map(it => ({
      ...it,
      qtdConferida: todosConferidos ? 0 : it.quantidade,
      checkedSeparacao: !todosConferidos,
      checkedDevolucao: !todosConferidos,
      statusRetorno: 'ok'
    })));

    if (todosConferidos) setItensSelecionados(new Set());
    else setItensSelecionados(new Set(itensState.map((_, idx) => idx)));
  };

  const marcarSelecionadosConferidos = () => {
    if (itensSelecionados.size === 0) return alert("Selecione pelo menos uma peça na lista!");
    
    setItensState(prev => prev.map((it, idx) => {
      if (itensSelecionados.has(idx)) {
        return {
          ...it,
          qtdConferida: it.quantidade,
          checkedSeparacao: true,
          checkedDevolucao: true,
          statusRetorno: 'ok'
        };
      }
      return it;
    }));

    setMensagemBip({ tipo: 'sucesso', texto: `✅ ${itensSelecionados.size} peça(s) selecionada(s) marcada(s) como conferida(s)!` });
    setItensSelecionados(new Set());
    setTimeout(() => setMensagemBip(null), 3500);
  };

  // 📷 LEITOR DE CÂMERA AO VIVO
  const iniciarScannerCamera = async (targetId = "reader-camera-checkin-std") => {
    setCameraAberta(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(targetId);
        html5QrCodeRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            processarCodigoDetectado(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Erro ao iniciar câmera:", err);
        setMensagemBip({ tipo: 'erro', texto: '⚠️ Permissão de câmera negada ou indisponível.' });
      }
    }, 300);
  };

  const pararScannerCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {}
      html5QrCodeRef.current = null;
    }
    setCameraAberta(false);
  };

  // 🔢 CONTROLE QUANTITATIVO
  const alterarQtdConferida = (index, delta) => {
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        const novaQtd = Math.max(0, Math.min(it.qtdConferida + delta, it.quantidade));
        return {
          ...it,
          qtdConferida: novaQtd,
          checkedSeparacao: novaQtd >= it.quantidade,
          checkedDevolucao: novaQtd > 0
        };
      }
      return it;
    }));
  };

  const setQtdConferidaDireta = (index, valor) => {
    const num = Math.max(0, parseInt(valor) || 0);
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        const novaQtd = Math.min(num, it.quantidade);
        return {
          ...it,
          qtdConferida: novaQtd,
          checkedSeparacao: novaQtd >= it.quantidade,
          checkedDevolucao: novaQtd > 0
        };
      }
      return it;
    }));
  };

  const setCampoItemRetorno = (index, campo, valor) => {
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        return { ...it, [campo]: valor };
      }
      return it;
    }));
  };

  // ✨ AÇÕES EM LOTE
  const marcarTodosLote = (tipo) => {
    setItensState(prev => prev.map(it => {
      if (tipo === 'todos_ida') {
        return { ...it, qtdConferida: it.quantidade, checkedSeparacao: true };
      }
      if (tipo === 'todos_volta_ok') {
        return { ...it, qtdConferida: it.quantidade, checkedDevolucao: true, statusRetorno: 'ok' };
      }
      if (tipo === 'desmarcar') {
        return { ...it, qtdConferida: 0, checkedSeparacao: false, checkedDevolucao: false, statusRetorno: 'ok' };
      }
      return it;
    }));
  };

  // 📷 FOTOS DA VISTORIA
  const handleUploadFotos = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFotosVistoria(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removerFotoVistoria = (index) => {
    setFotosVistoria(prev => prev.filter((_, idx) => idx !== index));
  };

  // ✍️ ASSINATURA DIGITAL (100% SEGURA)
  const capturarAssinatura = () => {
    try {
      if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
        const canvas = sigCanvasRef.current.getCanvas ? sigCanvasRef.current.getCanvas() : sigCanvasRef.current._canvas;
        if (canvas) {
          return canvas.toDataURL('image/png');
        }
      }
    } catch (e) {
      console.error("Erro ao capturar imagem da assinatura:", e);
    }
    return assinaturaSalvaUrl || null;
  };

  const limparAssinatura = () => {
    if (sigCanvasRef.current) sigCanvasRef.current.clear();
    setAssinaturaSalvaUrl(null);
  };

  const [dadosEmpresa, setDadosEmpresa] = useState(null);

  // 🔄 CARREGAR DADOS DA EMPRESA ASSINANTE (IDENTIDADE VISUAL DA EMPRESA)
  useEffect(() => {
    const carregarEmpresa = async () => {
      if (!tenantId) return;
      try {
        // 1. Busca em configuracoes_empresa (onde fica a Identidade Visual do Painel de Controle)
        const cfgRef = doc(db, "configuracoes_empresa", tenantId);
        const cfgSnap = await getDoc(cfgRef);
        if (cfgSnap.exists() && (cfgSnap.data().logotipo || cfgSnap.data().nomeEmpresa)) {
          setDadosEmpresa(cfgSnap.data());
          return;
        }

        // 2. Busca em configuracoes
        const cfg2Ref = doc(db, "configuracoes", tenantId);
        const cfg2Snap = await getDoc(cfg2Ref);
        if (cfg2Snap.exists() && (cfg2Snap.data().logotipo || cfg2Snap.data().nomeEmpresa)) {
          setDadosEmpresa(cfg2Snap.data());
          return;
        }

        // 3. Fallback em empresas
        const empSnap = await getDoc(doc(db, "empresas", tenantId));
        if (empSnap.exists()) {
          setDadosEmpresa(empSnap.data());
        }
      } catch (e) {
        console.error("Erro ao carregar dados da empresa:", e);
      }
    };
    carregarEmpresa();
  }, [tenantId]);

  // 📄 GERAR PDF / WHATSAPP
  const handleGerarPDF = () => {
    if (!locacao) return;
    const sigUrl = capturarAssinatura();
    gerarComprovanteCheckinPDF(locacao, modo, itensState, {
      responsavel,
      observacoes,
      assinaturaUrl: sigUrl
    }, dadosEmpresa);
  };

  const handleEnviarWhatsApp = () => {
    if (!locacao) return;
    const totalContratado = itensState.reduce((acc, i) => acc + Number(i.quantidade || 1), 0);
    const totalConferido = itensState.reduce((acc, i) => acc + Number(i.qtdConferida || 0), 0);
    const numeroPedido = locacao.numeroPedido || locacao.id?.substring(0, 6).toUpperCase();
    const clienteNome = locacao.clienteNome || locacao.cliente?.nome || 'Cliente';

    let msg = `*RESUMO DA VISTORIA DE CHECK-IN (${modo}) - CELEBRE FESTAS*\n\n`;
    msg += `📋 *Pedido:* #${numeroPedido}\n`;
    msg += `👤 *Cliente:* ${clienteNome}\n`;
    msg += `📊 *Progresso:* ${totalConferido} de ${totalContratado} peças conferidas.\n`;
    msg += `👤 *Responsável:* ${responsavel}\n`;
    if (observacoes) msg += `📝 *Obs:* ${observacoes}\n`;

    const foneCliente = locacao.clienteTelefone || locacao.cliente?.telefone || locacao.telefone;
    const foneLimpo = String(foneCliente || '').replace(/\D/g, '');

    const url = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // 💾 SALVAR CHECK-IN
  const handleSalvarCheckin = async () => {
    setSalvando(true);
    try {
      const sigUrl = capturarAssinatura();
      const locRef = doc(db, "locacoes", locacao.id);

      const totalContratado = itensState.reduce((acc, i) => acc + Number(i.quantidade || 1), 0);
      const totalConferido = itensState.reduce((acc, i) => acc + Number(i.qtdConferida || 0), 0);

      if (isIda) {
        const totalConcluido = totalConferido >= totalContratado;

        const dadosAtualizar = {
          itens: itensState,
          obsSaida: observacoes,
          responsavelSaida: responsavel,
          dataCheckinSaida: new Date().toISOString(),
          fotosCheckinSaida: fotosVistoria,
          assinaturaSaidaUrl: sigUrl || null,
          statusCheckinSaida: totalConcluido ? 'concluido' : 'parcial'
        };

        if (totalConcluido && locacao.status !== 'em_transito' && locacao.status !== 'finalizado') {
          dadosAtualizar.status = 'preparacao';
        }

        await updateDoc(locRef, dadosAtualizar);
        alert(`✅ Check-in de Saída (IDA) gravado com sucesso!`);
      } else {
        const itensAvaria = itensState.filter(i => i.statusRetorno === 'avaria');

        for (const itemAv of itensAvaria) {
          if (itemAv.enviarManutencao && (itemAv.id || itemAv.pecaId)) {
            const pecaId = itemAv.pecaId || itemAv.id;
            try {
              const pecaRef = doc(db, "estoque", pecaId);
              const pecaSnap = await getDoc(pecaRef);
              if (pecaSnap.exists()) {
                const pecaData = pecaSnap.data();
                const qtdMaintAtual = Number(pecaData.qtdManutencao || 0);
                await updateDoc(pecaRef, {
                  qtdManutencao: qtdMaintAtual + Number(itemAv.quantidade || 1),
                  statusManutencao: 'em_manutencao',
                  motivoManutencao: itemAv.motivoAvaria || `Avaria na devolução #${locacao.numeroPedido}`,
                  custoManutencao: Number(itemAv.custoAvaria || 0)
                });
              }
            } catch (eErr) {
              console.error("Erro na manutenção:", eErr);
            }
          }
        }

        await updateDoc(locRef, {
          itens: itensState,
          obsRetorno: observacoes,
          responsavelRetorno: responsavel,
          dataCheckinRetorno: new Date().toISOString(),
          fotosCheckinRetorno: fotosVistoria,
          assinaturaRetornoUrl: sigUrl || null,
          statusCheckinRetorno: 'concluido',
          status: 'finalizado'
        });

        alert(`✅ Check-in de Retorno (VOLTA) finalizado com sucesso!`);
      }

      navigate('/locacoes');
    } catch (err) {
      console.error("Erro ao salvar check-in:", err);
      alert("🚫 Erro ao salvar check-in. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="checkin-loading-screen">
        <div className="spinner-celebre"></div>
        <p>Carregando Vistoria do Pedido...</p>
      </div>
    );
  }

  if (!locacao) return null;

  const totalContratado = itensState.reduce((acc, i) => acc + Number(i.quantidade || 1), 0);
  const totalConferido = itensState.reduce((acc, i) => acc + Number(i.qtdConferida || 0), 0);
  const progressoPct = totalContratado > 0 ? Math.round((totalConferido / totalContratado) * 100) : 0;
  const numeroPedido = locacao.numeroPedido || locacao.id?.substring(0, 6).toUpperCase();
  const clienteNome = locacao.clienteNome || locacao.cliente?.nome || 'Cliente';

  // Obter categorias únicas dos itens
  const categoriasUnicas = Array.from(new Set(itensState.map(i => i.categoria).filter(Boolean)));

  // Filtragem dos Itens por Tab, Categoria e Busca
  const itensExibidos = itensState.filter(item => {
    const termo = buscaCodigo.toLowerCase();
    const bateBusca = !buscaCodigo || 
      (item.nome || '').toLowerCase().includes(termo) || 
      (item.codigo || '').toLowerCase().includes(termo);

    if (!bateBusca) return false;

    if (categoriaFiltro !== 'TODAS' && item.categoria !== categoriaFiltro) return false;

    if (filtroTab === 'PENDENTES') return item.qtdConferida < item.quantidade;
    if (filtroTab === 'CONFERIDOS') return item.qtdConferida >= item.quantidade;
    return true;
  });

  const qtdPendentes = itensState.filter(i => i.qtdConferida < i.quantidade).length;
  const qtdConferidos = itensState.filter(i => i.qtdConferida >= i.quantidade).length;

  return (
    <div className="clientes-container fade-in">
      
      {/* 🚀 CABEÇALHO PADRÃO DO SISTEMA CELEBRE (EXPEDIÇÃO) */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            🛫
          </div>
          <div className="welcome-text">
            <h1>Check-in de Saída (Expedição)</h1>
            <p>Vistoria quantitativa, conferência física e emissão de comprovante de entrega/retirada.</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary-celebre" onClick={() => navigate('/locacoes')}>
            ⬅️ Voltar para Locações
          </button>
        </div>
      </div>

      {/* 💎 BANNER EXECUTIVO VIP DO PEDIDO & PROGRESSO (PADRONIZADO CELEBRE) */}
      <div className="checkin-resumo-banner-vip">
        <div className="resumo-pills-row">
          <div className="resumo-pill-card">
            <span className="pill-icon">📋</span>
            <div className="pill-text">
              <span className="pill-label">PEDIDO</span>
              <strong className="pill-value">#{numeroPedido}</strong>
            </div>
          </div>

          <div className="resumo-pill-card gold-border">
            <span className="pill-icon">📦</span>
            <div className="pill-text">
              <span className="pill-label">MODALIDADE</span>
              <strong className="pill-value gold-color">{locacao.modalidadeServico === 'pegue_monte' ? 'Pegue e Monte' : 'Decoração Completa'}</strong>
            </div>
          </div>

          <div className="resumo-pill-card card-cliente">
            <span className="pill-icon">👤</span>
            <div className="pill-text">
              <span className="pill-label">CLIENTE</span>
              <strong className="pill-value" title={clienteNome}>{clienteNome}</strong>
            </div>
          </div>

          <div className="resumo-pill-card">
            <span className="pill-icon">📅</span>
            <div className="pill-text">
              <span className="pill-label">RETIRADA / EVENTO</span>
              <strong className="pill-value">{locacao.dataRetirada ? locacao.dataRetirada.split('-').reverse().join('/') : 'S/D'}</strong>
            </div>
          </div>

          {locacao.dataDevolucao && (
            <div className="resumo-pill-card">
              <span className="pill-icon">➔</span>
              <div className="pill-text">
                <span className="pill-label">DEVOLUÇÃO</span>
                <strong className="pill-value">{locacao.dataDevolucao.split('-').reverse().join('/')}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="resumo-progress-card-vip">
          <div className="prog-title-row">
            <span>Progresso da Vistoria</span>
            <span className="prog-pct-badge">{progressoPct}%</span>
          </div>
          <div className="prog-track-std">
            <div className="prog-fill-std" style={{ width: `${progressoPct}%` }}></div>
          </div>
          <small className="prog-sub-txt">{totalConferido} de {totalContratado} peças conferidas</small>
        </div>
      </div>

      {/* 🔍 BARRA DE BUSCA, LEITOR DE CÂMERA E FILTROS DE CATEGORIA */}
      <div className="checkin-toolbar-std">
        <div className="toolbar-search-row">
          <div className="search-box-group">
            <input 
              ref={inputBuscaRef}
              type="text"
              className="input-search-std"
              placeholder="🔍 Digite ou bipe o código/nome da peça (ex: VAS-001)..."
              value={buscaCodigo}
              onChange={(e) => setBuscaCodigo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') processarCodigoDetectado(buscaCodigo); }}
            />
            <button 
              type="button" 
              className="btn-bipar-std"
              onClick={() => processarCodigoDetectado(buscaCodigo)}
            >
              Conferir
            </button>
            <button 
              type="button" 
              className={`btn-camera-std ${cameraAberta ? 'active' : ''}`}
              onClick={cameraAberta ? pararScannerCamera : () => iniciarScannerCamera("reader-camera-checkin-std")}
            >
              📷 {cameraAberta ? 'Fechar Câmera' : 'Escanear Câmera'}
            </button>
          </div>
        </div>

        {/* TOAST FEEDBACK DE BIPAGEM */}
        {mensagemBip && (
          <div className={`toast-std-bip ${mensagemBip.tipo}`}>
            {mensagemBip.texto}
          </div>
        )}

        {/* PAINEL CÂMERA AO VIVO */}
        {cameraAberta && (
          <div className="camera-panel-std">
            <div className="cam-header-std">
              <span>📷 Aproxime o QR Code ou Código de Barras da Câmera:</span>
              <button type="button" onClick={pararScannerCamera} className="btn-close-cam-std">✕ Fechar</button>
            </div>
            <div id="reader-camera-checkin-std" className="cam-video-box-std"></div>
          </div>
        )}

        {/* ABAS DE STATUS & FILTRO DE CATEGORIAS */}
        <div className="toolbar-bottom-filters">
          <div className="tabs-bar-std">
            <button 
              type="button" 
              className={`tab-btn-std ${filtroTab === 'TODOS' ? 'active' : ''}`}
              onClick={() => setFiltroTab('TODOS')}
            >
              📦 Todos ({itensState.length})
            </button>
            <button 
              type="button" 
              className={`tab-btn-std ${filtroTab === 'PENDENTES' ? 'active' : ''}`}
              onClick={() => setFiltroTab('PENDENTES')}
            >
              ⏳ Pendentes ({qtdPendentes})
            </button>
            <button 
              type="button" 
              className={`tab-btn-std ${filtroTab === 'CONFERIDOS' ? 'active' : ''}`}
              onClick={() => setFiltroTab('CONFERIDOS')}
            >
              ✅ Conferidos ({qtdConferidos})
            </button>
          </div>

          {categoriasUnicas.length > 0 && (
            <div className="cat-filter-group">
              <span className="cat-lbl">Filtrar por Categoria:</span>
              <select 
                value={categoriaFiltro} 
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="select-cat-std"
              >
                <option value="TODAS">Todas as Categorias</option>
                {categoriasUnicas.map((cat, cIdx) => (
                  <option key={cIdx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 📦 PAINEL DA LISTA DE PEÇAS (LARGURA TOTAL 100%) */}
      <div className="checkin-main-panel-box">
        <div className="panel-box-std">
          <div className="panel-header-flex">
            <div className="title-with-checkbox">
              <input 
                type="checkbox" 
                checked={itensState.length > 0 && itensState.every(i => i.qtdConferida >= i.quantidade)} 
                onChange={toggleSelecionarTodos}
                title="Marcar/Desmarcar Todos os Itens como Conferidos"
                className="check-all-input"
              />
              <h3>📦 Lista de Peças <span className="lbl-txt-desk">({itensExibidos.length} de {itensState.length} exibidos)</span><span className="lbl-txt-mob">({itensExibidos.length}/{itensState.length})</span></h3>
            </div>
            <button 
              type="button" 
              className="btn-expandir-std"
              onClick={() => setModalExpandirAberto(true)}
              title="Abrir modal em tela cheia para conferência ampla"
            >
              ⤢ <span className="lbl-txt-desk">Expandir Lista (Tela Cheia)</span><span className="lbl-txt-mob">Expandir</span>
            </button>
          </div>

          <div className="items-list-std scrollable">
            {itensExibidos.length === 0 ? (
              <div className="empty-state-std">
                <span>✨ Nenhum item nesta aba de filtro.</span>
              </div>
            ) : (
              itensExibidos.map((item, idx) => {
                const originalIndex = itensState.findIndex(i => i === item);
                const isTotal = item.qtdConferida >= item.quantidade;
                const isParcial = item.qtdConferida > 0 && item.qtdConferida < item.quantidade;

                return (
                  <div 
                    key={originalIndex} 
                    className={`item-card-std ${
                      isIda 
                        ? (isTotal ? 'status-total-ok' : isParcial ? 'status-parcial' : '') 
                        : (item.statusRetorno === 'ok' ? 'status-total-ok' : item.statusRetorno === 'avaria' ? 'status-avaria' : item.statusRetorno === 'faltou' ? 'status-falta' : '')
                    } ${isTotal ? 'card-selected' : ''}`}
                  >
                    <div className="item-row-std">
                      {/* CHECKBOX MARCA E UNMARCA DIRETAMENTE */}
                      <input 
                        type="checkbox" 
                        checked={isTotal}
                        onChange={() => toggleSelecaoItem(originalIndex)}
                        className="item-select-checkbox"
                        title="Marcar como conferido"
                      />

                      {/* THUMBNAIL DA PEÇA */}
                      <div className="item-thumb-std">
                        {item.imagem || item.foto ? (
                          <img src={item.imagem || item.foto} alt={item.nome} />
                        ) : (
                          <span>📦</span>
                        )}
                      </div>

                      {/* INFO DA PEÇA & LOCALIZAÇÃO FÍSICA NO GALPÃO */}
                      <div className="item-info-std">
                        <h4>{item.nome}</h4>
                        <div className="item-tags-row">
                          <span className="tag-std">Cód: <strong>{item.codigo || 'S/C'}</strong></span>
                          {item.categoria && <span className="tag-std cat">{item.categoria}</span>}
                          <span className="tag-std loc">📍 {item.localizacao || 'Prateleira A-01'}</span>
                        </div>
                      </div>

                      {/* CONTROLE QUANTITATIVO */}
                      <div className="stepper-box-std">
                        <span className="lbl-step">Conferido:</span>
                        <div className="stepper-ctrl">
                          <button type="button" onClick={() => alterarQtdConferida(originalIndex, -1)}>-</button>
                          <input 
                            type="number" 
                            value={item.qtdConferida}
                            onChange={(e) => setQtdConferidaDireta(originalIndex, e.target.value)}
                          />
                          <button type="button" onClick={() => alterarQtdConferida(originalIndex, 1)}>+</button>
                          <button type="button" className="btn-max-std" onClick={() => alterarQtdConferida(originalIndex, item.quantidade)}>Max</button>
                        </div>
                        <small className="qtd-total-sub">de {item.quantidade} un</small>
                      </div>

                      {!isIda && (
                        <div className="retorno-btns-std">
                          <button 
                            type="button" 
                            className={`btn-ret-std ok ${item.statusRetorno === 'ok' ? 'active' : ''}`}
                            onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'ok')}
                          >
                            🟢 OK
                          </button>
                          <button 
                            type="button" 
                            className={`btn-ret-std avaria ${item.statusRetorno === 'avaria' ? 'active' : ''}`}
                            onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'avaria')}
                          >
                            🛠️ Avaria
                          </button>
                          <button 
                            type="button" 
                            className={`btn-ret-std faltou ${item.statusRetorno === 'faltou' ? 'active' : ''}`}
                            onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'faltou')}
                          >
                            ❌ Faltou
                          </button>
                        </div>
                      )}
                    </div>

                    {!isIda && item.statusRetorno === 'avaria' && (
                      <div className="avaria-drawer-std">
                        <label className="title-avaria">🛠️ Registro de Avaria no Item:</label>
                        <div className="fields-avaria">
                          <input 
                            type="text" 
                            placeholder="Motivo / Descrição da avaria..."
                            value={item.motivoAvaria}
                            onChange={(e) => setCampoItemRetorno(originalIndex, 'motivoAvaria', e.target.value)}
                          />
                          <input 
                            type="number" 
                            placeholder="Custo Reparo (R$)"
                            value={item.custoAvaria}
                            onChange={(e) => setCampoItemRetorno(originalIndex, 'custoAvaria', e.target.value)}
                          />
                        </div>
                        <label className="checkbox-avaria">
                          <input 
                            type="checkbox"
                            checked={item.enviarManutencao}
                            onChange={(e) => setCampoItemRetorno(originalIndex, 'enviarManutencao', e.target.checked)}
                          />
                          <span>Encaminhar automaticamente para Manutenção no Estoque</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ✍️ 📷 📝 SEÇÃO INFERIOR DE FINALIZAÇÃO (ABAIXO DA LISTA DE VISTORIA) */}
      <div className="checkin-bottom-sections-grid">
        
        {/* CARD 1: FOTOS DA VISTORIA */}
        <div className="panel-box-std fotos-panel-card">
          <div className="fotos-header-block">
            <div className="fotos-title-text">
              <h3>📷 Fotos da Vistoria Visual</h3>
              <small className="sub-txt-info">📁 Salvo no prontuário do Pedido #{numeroPedido} e impresso no comprovante em PDF.</small>
            </div>
            <label className="btn-upload-celebre-vip">
              <span>📷</span> <strong>+ Adicionar Fotos</strong>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                multiple 
                onChange={handleUploadFotos} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>
          {fotosVistoria.length > 0 ? (
            <div className="fotos-grid-large">
              {fotosVistoria.map((ft, fIdx) => (
                <div key={fIdx} className="foto-item-large">
                  <img src={ft} alt={`Vistoria ${fIdx}`} />
                  <button type="button" className="btn-del-foto-large" onClick={() => removerFotoVistoria(fIdx)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-fotos-box">
              <span className="cam-icon-big">📸</span>
              <p>Nenhuma foto da vistoria anexada até o momento.<br/>Clique em <strong>"+ Fotos"</strong> para enviar fotos do estado das peças.</p>
            </div>
          )}
        </div>

        {/* CARD 2: ASSINATURA DIGITAL DO CLIENTE */}
        <div className="panel-box-std">
          <div className="panel-header-flex">
            <h3>✍️ Assinatura Digital do Cliente</h3>
            <button type="button" className="btn-clear-sig-std" onClick={limparAssinatura}>Limpar</button>
          </div>
          {assinaturaSalvaUrl ? (
            <div className="sig-preview-std">
              <img src={assinaturaSalvaUrl} alt="Assinatura" />
              <span className="sig-badge-ok">✓ Assinatura Registrada</span>
            </div>
          ) : (
            <div className="sig-wrapper-std">
              <SignatureCanvas 
                ref={sigCanvasRef} 
                penColor="#0f172a" 
                canvasProps={{ 
                  className: "sig-canvas-std",
                  style: { touchAction: 'none', width: '100%', height: '100%' }
                }} 
                backgroundColor="transparent" 
                velocityFilterWeight={0.7}
              />
              <span className="sig-hint-std">Assine com o dedo (celular/tablet) ou mouse (computador)</span>
            </div>
          )}
        </div>

        {/* CARD 3: DADOS DA VISTORIA E RESPONSÁVEL */}
        <div className="panel-box-std">
          <h3>📝 Dados da Vistoria</h3>
          
          <div className="form-group-std">
            <label>Observações do Check-in:</label>
            <textarea 
              rows="3"
              placeholder={isIda ? "Ex: Embalado em 2 caixas plásticas de transporte." : "Ex: Peças conferidas e limpas."}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <div className="form-group-std" style={{ marginTop: '12px' }}>
            <label>👤 Responsável pela Conferência:</label>
            <select 
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="select-colab-std"
            >
              {listaColaboradores.map((colab, cIdx) => (
                <option key={cIdx} value={colab}>
                  👤 {colab}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* ❓ MODAL DE CONFIRMAÇÃO DE BUSCA PARCIAL COM FOTO DA PEÇA */}
      {itemParaConfirmar && (
        <div className="modal-checkin-overlay">
          <div className="modal-confirm-item-box animate-pop">
            <div className="modal-confirm-header">
              <span>❓ CONFIRMAR CONFERÊNCIA DA PEÇA</span>
            </div>
            <div className="modal-confirm-body">
              <p>Foi localizado a peça correspondente à busca <strong>"{buscaCodigo}"</strong>:</p>
              <div className="confirm-item-card-preview-with-photo">
                <div className="confirm-thumb-box">
                  {itemParaConfirmar.item.imagem || itemParaConfirmar.item.foto ? (
                    <img src={itemParaConfirmar.item.imagem || itemParaConfirmar.item.foto} alt={itemParaConfirmar.item.nome} />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div className="confirm-details-col">
                  <h4>{itemParaConfirmar.item.nome}</h4>
                  <span>Código SKU: <strong>{itemParaConfirmar.item.codigo || 'S/C'}</strong></span>
                  {itemParaConfirmar.item.categoria && <span>Categoria: <strong>{itemParaConfirmar.item.categoria}</strong></span>}
                  <span>Conferido atual: <strong>{itemParaConfirmar.item.qtdConferida} de {itemParaConfirmar.item.quantidade} un</strong></span>
                </div>
              </div>
              <p className="confirm-q-txt">Confirma incrementar +1 unidade deste item?</p>
            </div>
            <div className="modal-confirm-footer">
              <button type="button" className="btn-cancel-confirm" onClick={() => setItemParaConfirmar(null)}>
                ✕ Cancelar
              </button>
              <button type="button" className="btn-ok-confirm" onClick={() => efetivarConferenciaItem(itemParaConfirmar.index)}>
                ✅ Sim, Conferir Peça
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 MODAL EXPANDIDO DE TELA CHEIA PARA CONFERÊNCIA DE MUITAS PEÇAS */}
      {modalExpandirAberto && (
        <div className="modal-checkin-overlay">
          <div className="modal-expandir-box animate-pop">
            <div className="modal-expandir-header">
              <div className="exp-title-row">
                <span className="exp-icon">📦</span>
                <div className="exp-title-text">
                  <h2>Conferência Ampla — #{numeroPedido}</h2>
                  <p>Cliente: <strong>{clienteNome}</strong></p>
                </div>
              </div>
              <button type="button" className="btn-close-exp-modal" onClick={() => setModalExpandirAberto(false)}>✕ Fechar</button>
            </div>

            <div className="modal-expandir-body">
              <div className="items-list-std modal-list">
                {itensState.map((item, originalIndex) => {
                  const isTotal = item.qtdConferida >= item.quantidade;
                  const isParcial = item.qtdConferida > 0 && item.qtdConferida < item.quantidade;

                  return (
                    <div 
                      key={originalIndex} 
                      className={`item-card-std ${
                        isIda 
                          ? (isTotal ? 'status-total-ok' : isParcial ? 'status-parcial' : '') 
                          : (item.statusRetorno === 'ok' ? 'status-total-ok' : item.statusRetorno === 'avaria' ? 'status-avaria' : item.statusRetorno === 'faltou' ? 'status-falta' : '')
                      } ${isTotal ? 'card-selected' : ''}`}
                    >
                      <div className="item-row-std">
                        <input 
                          type="checkbox" 
                          checked={isTotal}
                          onChange={() => toggleSelecaoItem(originalIndex)}
                          className="item-select-checkbox"
                        />
                        <div className="item-thumb-std">
                          {item.imagem || item.foto ? (
                            <img src={item.imagem || item.foto} alt={item.nome} />
                          ) : (
                            <span>📦</span>
                          )}
                        </div>

                        <div className="item-info-std">
                          <h4>{item.nome}</h4>
                          <div className="item-tags-row">
                            <span className="tag-std">Cód: <strong>{item.codigo || 'S/C'}</strong></span>
                            {item.categoria && <span className="tag-std cat">{item.categoria}</span>}
                            <span className="tag-std loc">📍 {item.localizacao || 'Prateleira A-01'}</span>
                          </div>
                        </div>

                        <div className="stepper-box-std">
                          <span className="lbl-step">Conferido:</span>
                          <div className="stepper-ctrl">
                            <button type="button" onClick={() => alterarQtdConferida(originalIndex, -1)}>-</button>
                            <input 
                              type="number" 
                              value={item.qtdConferida}
                              onChange={(e) => setQtdConferidaDireta(originalIndex, e.target.value)}
                            />
                            <button type="button" onClick={() => alterarQtdConferida(originalIndex, 1)}>+</button>
                            <button type="button" className="btn-max-std" onClick={() => alterarQtdConferida(originalIndex, item.quantidade)}>Max</button>
                          </div>
                          <small>de {item.quantidade} un</small>
                        </div>

                        {!isIda && (
                          <div className="retorno-btns-std">
                            <button 
                              type="button" 
                              className={`btn-ret-std ok ${item.statusRetorno === 'ok' ? 'active' : ''}`}
                              onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'ok')}
                            >
                              🟢 OK
                            </button>
                            <button 
                              type="button" 
                              className={`btn-ret-std avaria ${item.statusRetorno === 'avaria' ? 'active' : ''}`}
                              onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'avaria')}
                            >
                              🛠️ Avaria
                            </button>
                            <button 
                              type="button" 
                              className={`btn-ret-std faltou ${item.statusRetorno === 'faltou' ? 'active' : ''}`}
                              onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'faltou')}
                            >
                              ❌ Faltou
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-expandir-footer">
              <span className="exp-footer-prog-txt">Progresso: <strong>{totalConferido}/{totalContratado} ({progressoPct}%)</strong></span>
              <button type="button" className="btn-concluir-exp-modal" onClick={() => setModalExpandirAberto(false)}>
                ✅ Concluir Vistoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📌 BARRA INFERIOR FIXA DE AÇÃO */}
      <div className="checkin-footer-fixed">
        <div className="footer-content-inner">
          <div className="footer-txt-info">
            <span>Check-in ({modo}): <strong>{totalConferido} de {totalContratado} peças ({progressoPct}%)</strong></span>
          </div>
          <div className="footer-actions-row">
            <button type="button" className="btn-secondary-celebre" onClick={handleGerarPDF}>
              🖨️ PDF Comprovante
            </button>
            <button type="button" className="btn-primary-celebre" onClick={handleSalvarCheckin} disabled={salvando}>
              {salvando ? '💾 SALVANDO...' : '🛫 FINALIZAR CHECK-IN (EXPEDIÇÃO)'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CheckinPage;
