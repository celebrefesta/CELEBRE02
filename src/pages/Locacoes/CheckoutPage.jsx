import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './CheckoutPage.css';
import SignatureCanvas from 'react-signature-canvas';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { gerarComprovanteCheckinPDF } from '../../utils/gerarComprovanteCheckinPDF';
import { compilarEComprimirFoto } from '../../utils/limpezaMidiaService';

const CheckoutPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

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

  // ✍️ ASSINATURA DIGITAL & FOTOS DE RETORNO
  const sigCanvasRef = useRef(null);
  const [assinaturaSalvaUrl, setAssinaturaSalvaUrl] = useState(null);
  const [fotosVistoria, setFotosVistoria] = useState([]);
  const [dadosEmpresa, setDadosEmpresa] = useState(null);

  // 🏢 CARREGAR DADOS DA EMPRESA
  useEffect(() => {
    const carregarEmpresa = async () => {
      try {
        if (!tenantId) return;
        const empRef = doc(db, "configuracoes_empresa", tenantId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          setDadosEmpresa(empSnap.data());
        } else {
          const fallbackRef = doc(db, "configuracoes", tenantId);
          const fallbackSnap = await getDoc(fallbackRef);
          if (fallbackSnap.exists()) setDadosEmpresa(fallbackSnap.data());
        }
      } catch (err) {
        console.error("Erro ao carregar dados da empresa no Checkout:", err);
      }
    };
    carregarEmpresa();
  }, [tenantId]);

  // 👥 CARREGAR COLABORADORES (EXATAMENTE IGUAL AO CHECKINPAGE DE IDA)
  useEffect(() => {
    const carregarColaboradores = async () => {
      if (!tenantId) return;
      try {
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

        const listaFinal = Array.from(nomesSet).filter(Boolean);
        setListaColaboradores(listaFinal);
        setResponsavel(prev => prev || nomeAtual);

      } catch (err) {
        console.error("Erro ao carregar colaboradores no checkout:", err);
        const nomeFallback = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || 'Proprietário / Admin';
        setListaColaboradores([nomeFallback]);
      }
    };
    carregarColaboradores();
  }, [tenantId, usuarioLogado]);

  // 📄 CARREGAR DADOS DA LOCAÇÃO DE VOLTA (CHECKOUT)
  useEffect(() => {
    const carregarLocacao = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'locacoes', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          alert('Pedido de locação não encontrado!');
          navigate('/locacoes');
          return;
        }

        const data = docSnap.data();
        setLocacao(data);

        // Inicializar itens para Check-out (Volta)
        const itensIniciais = (data.itens || []).map((it) => {
          return {
            ...it,
            qtdConferida: it.qtdRetornada !== undefined ? Number(it.qtdRetornada) : Number(it.quantidade || 1),
            statusRetorno: it.statusRetorno || 'ok', // 'ok', 'avaria', 'faltou'
            obsRetorno: it.obsRetorno || ''
          };
        });

        setItensState(itensIniciais);
        setObservacoes(data.observacoesRetorno || data.observacoesCheckin || '');
        setResponsavel(data.responsavelRetorno || data.responsavelCheckin || usuarioLogado?.displayName || '');
        if (data.assinaturaRetornoUrl) setAssinaturaSalvaUrl(data.assinaturaRetornoUrl);
        if (data.fotosRetorno) setFotosVistoria(data.fotosRetorno);

      } catch (err) {
        console.error("Erro ao carregar página de checkout:", err);
        alert("Erro ao carregar dados do pedido para checkout.");
      } finally {
        setLoading(false);
      }
    };

    carregarLocacao();
  }, [id, navigate, usuarioLogado]);

  // Focus no input de busca ao carregar
  useEffect(() => {
    if (!loading && inputBuscaRef.current) {
      inputBuscaRef.current.focus();
    }
  }, [loading]);

  // 🔍 BUSCA POR CÓDIGO (BIPAGEM MANUAL OU LEITOR FISCO DE CÓDIGO DE BARRAS)
  const processarCodigoBipado = (codigoLido) => {
    const codLimpo = codigoLido.trim().toLowerCase();
    if (!codLimpo) return;

    const index = itensState.findIndex(it =>
      (it.codigo && String(it.codigo).trim().toLowerCase() === codLimpo) ||
      (it.codigoBarras && String(it.codigoBarras).trim().toLowerCase() === codLimpo) ||
      (it.nome && it.nome.trim().toLowerCase().includes(codLimpo))
    );

    if (index !== -1) {
      const itemAchado = itensState[index];
      setItemParaConfirmar({
        index,
        nome: itemAchado.nome,
        codigo: itemAchado.codigo || 'S/C',
        qtdAtual: itemAchado.qtdConferida,
        qtdMax: itemAchado.quantidade,
        imagem: itemAchado.imagem || itemAchado.foto
      });
      setMensagemBip({ tipo: 'sucesso', texto: `✅ Peça localizada: "${itemAchado.nome}"` });
    } else {
      setMensagemBip({ tipo: 'erro', texto: `❌ Nenhuma peça com o código "${codigoLido}" neste pedido.` });
    }

    setBuscaCodigo('');
    setTimeout(() => setMensagemBip(null), 4000);
  };

  const handleKeyDownBusca = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarCodigoBipado(buscaCodigo);
    }
  };

  const efetivarConferenciaItem = (idx) => {
    alterarQtdConferida(idx, 1);
    setItemParaConfirmar(null);
  };

  // 📷 LEITOR DE QR CODE PELA CÂMERA
  const toggleCameraScanner = () => {
    if (cameraAberta) {
      pararScannerCamera();
    } else {
      setCameraAberta(true);
      setTimeout(() => iniciarScannerCamera(), 300);
    }
  };

  const iniciarScannerCamera = async () => {
    try {
      const html5QrCode = new Html5Qrcode("reader-camera-checkout-std");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          processarCodigoBipado(decodedText);
          pararScannerCamera();
        },
        () => { }
      );
    } catch (err) {
      console.error("Erro ao iniciar câmera:", err);
      alert("Não foi possível acessar a câmera do dispositivo.");
      setCameraAberta(false);
    }
  };

  const pararScannerCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error("Erro ao parar câmera:", e);
      }
      html5QrCodeRef.current = null;
    }
    setCameraAberta(false);
  };

  // ➕/➖ ALTERAR QUANTIDADE CONFERIDA DE RETORNO
  const alterarQtdConferida = (index, delta) => {
    setItensState(prev => {
      const novos = [...prev];
      const item = novos[index];
      let novaQtd = Number(item.qtdConferida || 0) + delta;

      if (novaQtd < 0) novaQtd = 0;
      if (novaQtd > item.quantidade) novaQtd = item.quantidade;

      novos[index] = { ...item, qtdConferida: novaQtd };
      return novos;
    });
  };

  const setQtdConferidaDireta = (index, valorStr) => {
    const val = parseInt(valorStr, 10);
    setItensState(prev => {
      const novos = [...prev];
      const item = novos[index];
      let novaQtd = isNaN(val) ? 0 : val;

      if (novaQtd < 0) novaQtd = 0;
      if (novaQtd > item.quantidade) novaQtd = item.quantidade;

      novos[index] = { ...item, qtdConferida: novaQtd };
      return novos;
    });
  };

  const setCampoItemRetorno = (index, campo, valor) => {
    setItensState(prev => {
      const novos = [...prev];
      novos[index] = { ...novos[index], [campo]: valor };
      return novos;
    });
  };

  // ☑️ SELEÇÃO DE TODOS OS ITENS
  const toggleSelecionarTodos = () => {
    if (itensState.every(i => i.qtdConferida >= i.quantidade)) {
      setItensState(prev => prev.map(i => ({ ...i, qtdConferida: 0 })));
    } else {
      setItensState(prev => prev.map(i => ({ ...i, qtdConferida: i.quantidade })));
    }
  };

  const toggleSelecaoItem = (index) => {
    setItensState(prev => {
      const novos = [...prev];
      const item = novos[index];
      const jaTotal = item.qtdConferida >= item.quantidade;
      novos[index] = { ...item, qtdConferida: jaTotal ? 0 : item.quantidade };
      return novos;
    });
  };

  // ✍️ CAPTURAR ASSINATURA
  const limparAssinatura = () => {
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear();
    }
    setAssinaturaSalvaUrl(null);
  };

  const capturarAssinatura = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      try {
        const dataUrl = sigCanvasRef.current.getCanvas().toDataURL('image/png');
        setAssinaturaSalvaUrl(dataUrl);
      } catch (err) {
        console.error("Erro ao converter assinatura do canvas:", err);
      }
    }
  };

  // 📷 UPLOAD DE FOTOS DA VISTORIA DE RETORNO COM COMPRESSÃO AUTOMÁTICA
  const handleUploadFotos = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      try {
        const fotoComprimida = await compilarEComprimirFoto(file, 1200, 1200, 0.72);
        setFotosVistoria(prev => [...prev, fotoComprimida]);
      } catch (err) {
        console.error("Erro ao comprimir foto da devolução:", err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFotosVistoria(prev => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removerFotoVistoria = (index) => {
    setFotosVistoria(prev => prev.filter((_, i) => i !== index));
  };

  // 📊 CÁLCULO DE PROGRESSO E TOTALIZADORES DE DEVOLUÇÃO
  const totalContratado = itensState.reduce((acc, i) => acc + Number(i.quantidade || 0), 0);
  const totalConferido = itensState.reduce((acc, i) => acc + Number(i.qtdConferida || 0), 0);
  const progressoPct = totalContratado > 0 ? Math.round((totalConferido / totalContratado) * 100) : 0;

  const itensComAvaria = itensState.filter(i => i.statusRetorno === 'avaria');
  const itensFaltantes = itensState.filter(i => i.statusRetorno === 'faltou' || i.qtdConferida < i.quantidade);

  // Categorias únicas para o filtro
  const categoriasDisponiveis = ['TODAS', ...new Set(itensState.map(i => i.categoria).filter(Boolean))];

  // Filtragem dos itens exibidos
  const itensExibidos = itensState.filter(item => {
    if (filtroTab === 'PENDENTES' && item.qtdConferida >= item.quantidade) return false;
    if (filtroTab === 'CONFERIDOS' && item.qtdConferida < item.quantidade) return false;
    if (filtroTab === 'AVARIAS' && item.statusRetorno !== 'avaria') return false;
    if (filtroTab === 'FALTAS' && item.statusRetorno !== 'faltou' && item.qtdConferida >= item.quantidade) return false;
    if (categoriaFiltro !== 'TODAS' && item.categoria !== categoriaFiltro) return false;
    return true;
  });

  // 📜 COMPARATIVO DE VISTORIAS
  const [mostrarComparativo, setMostrarComparativo] = useState(false);

  // ⚡ AÇÃO RÁPIDA "DEVOLVER TUDO INTEIRO (1-CLICK)"
  const handleDevolverTudoInteiro = () => {
    setItensState(prev => prev.map(item => ({
      ...item,
      qtdConferida: Number(item.quantidade || 1),
      statusRetorno: 'ok',
      obsRetorno: '',
      custoAvaria: 0
    })));
    setMensagemBip({ tipo: 'sucesso', texto: '⚡ Todas as peças foram marcadas como devolvidas em perfeito estado!' });
    setTimeout(() => setMensagemBip(null), 4000);
  };

  // 💰 CÁLCULO AUTOMÁTICO DE TAXA DE RESSARCIMENTO (AVARIAS E FALTAS)
  const custoTotalAvarias = itensState.reduce((acc, item) => {
    if (item.statusRetorno === 'avaria') {
      return acc + Number(item.custoAvaria || item.valorAvaria || item.precoAvaria || 0);
    }
    return acc;
  }, 0);

  const custoTotalFaltas = itensState.reduce((acc, item) => {
    const qtdFalta = Math.max(0, Number(item.quantidade || 1) - Number(item.qtdConferida || 0));
    if (item.statusRetorno === 'faltou' || (item.statusRetorno !== 'ok' && qtdFalta > 0)) {
      const valorUnit = Number(item.precoUnitario || item.valorReposicao || item.precoSubstituicao || item.valorUnitario || 0);
      return acc + (qtdFalta * valorUnit);
    }
    return acc;
  }, 0);

  const totalRessarcimento = custoTotalAvarias + custoTotalFaltas;

  // 💬 DISPARO AUTOMÁTICO DO COMPROVANTE VIA WHATSAPP
  const handleEnviarWhatsApp = () => {
    const telefoneRaw = locacao?.clienteTelefone || locacao?.telefoneCliente || locacao?.telefone || locacao?.clienteData?.telefone || '';
    const numTelefone = telefoneRaw.replace(/\D/g, '');
    const dddNum = numTelefone ? (numTelefone.length === 10 || numTelefone.length === 11 ? `55${numTelefone}` : numTelefone) : '';

    const statusMsg = (itensComAvaria.length === 0 && itensFaltantes.length === 0 && totalRessarcimento === 0)
      ? '🟢 *Vistoria OK:* Todas as peças retornaram em perfeito estado sem avarias ou faltas!'
      : `⚠️ *Apontamentos na Vistoria:*\n` +
        (itensComAvaria.length > 0 ? `• ${itensComAvaria.length} item(ns) com Avaria (R$ ${custoTotalAvarias.toFixed(2)})\n` : '') +
        (itensFaltantes.length > 0 ? `• ${itensFaltantes.length} item(ns) com Falta/Extravio (R$ ${custoTotalFaltas.toFixed(2)})\n` : '') +
        `💰 *Total de Ressarcimento:* R$ ${totalRessarcimento.toFixed(2)}`;

    const texto = encodeURIComponent(
      `*CELEBRE LOCAÇÕES — Comprovante de Vistoria (Devolução)* 🛬\n\n` +
      `📋 *Pedido:* #${numeroPedido}\n` +
      `👤 *Cliente:* ${clienteNome}\n` +
      `📅 *Data Vistoria:* ${new Date().toLocaleDateString('pt-BR')}\n` +
      `📦 *Devolução:* ${totalConferido} de ${totalContratado} peças (${progressoPct}%)\n\n` +
      `${statusMsg}\n\n` +
      `Obrigado pela preferência!\n` +
      `*Celebre Eventos & Locações* ✨`
    );

    const url = dddNum ? `https://api.whatsapp.com/send?phone=${dddNum}&text=${texto}` : `https://api.whatsapp.com/send?text=${texto}`;
    window.open(url, '_blank');
  };

  // 🖨️ GERAR COMPROVANTE DE DEVOLUÇÃO EM PDF
  const handleGerarPDF = () => {
    let assUrl = assinaturaSalvaUrl;
    if (!assUrl && sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      try {
        assUrl = sigCanvasRef.current.getCanvas().toDataURL('image/png');
      } catch (e) { }
    }

    gerarComprovanteCheckinPDF(
      locacao,
      'VOLTA',
      itensState,
      {
        responsavel,
        observacoes,
        assinaturaUrl: assUrl,
        fotosVistoria  // ✅ Fotos de vistoria embutidas no PDF
      },
      dadosEmpresa
    );
  };

  // 💾 SALVAR DEVOLUÇÃO (CHECK-OUT) NO FIRESTORE
  const handleSalvarCheckout = async () => {
    try {
      setSalvando(true);
      capturarAssinatura();

      let assUrl = assinaturaSalvaUrl;
      if (!assUrl && sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
        try {
          assUrl = sigCanvasRef.current.getCanvas().toDataURL('image/png');
        } catch (e) { }
      }

      const itensAtualizados = itensState.map(it => ({
        ...it,
        qtdRetornada: Number(it.qtdConferida || 0),
        statusRetorno: it.statusRetorno || 'ok',
        obsRetorno: it.obsRetorno || ''
      }));

      // 🛠️ ENVIAR PEÇAS AVARIADAS PARA MANUTENÇÃO NO ESTOQUE
      // ✅ CORRIGIDO: removida condição `enviarManutencao` (nunca era true).
      //    Agora toda peça com statusRetorno === 'avaria' que tiver ID de estoque
      //    é automaticamente encaminhada para manutenção ao salvar o check-out.
      const itensAvaria = itensAtualizados.filter(i => i.statusRetorno === 'avaria');
      let qtdEnviadasManutencao = 0;
      for (const itemAv of itensAvaria) {
        const pecaId = itemAv.pecaId || itemAv.id;
        if (!pecaId) continue; // sem ID de estoque, pula
        try {
          const pecaRef = doc(db, 'estoque', pecaId);
          const pecaSnap = await getDoc(pecaRef);
          if (pecaSnap.exists()) {
            const pecaData = pecaSnap.data();
            const qtdMaintAtual = Number(pecaData.qtdManutencao || 0);
            await updateDoc(pecaRef, {
              qtdManutencao: qtdMaintAtual + Number(itemAv.quantidade || 1),
              statusManutencao: 'em_manutencao',
              motivoManutencao: itemAv.obsRetorno || itemAv.motivoAvaria || `Avaria na devolução #${locacao?.numeroPedido || id}`,
              custoManutencao: Number(itemAv.custoAvaria || 0),
              dataEntradaManutencao: new Date().toISOString()
            });
            qtdEnviadasManutencao++;
          }
        } catch (eErr) {
          console.error('Erro ao registrar manutenção:', eErr);
        }
      }

      const tudoConferidoOk = itensAtualizados.every(i => i.qtdRetornada >= i.quantidade && i.statusRetorno === 'ok');
      const novoStatus = tudoConferidoOk ? 'Finalizado' : 'Conferido com Avarias/Faltas';

      // 📅 REGRA INTELIGENTE DE RETENÇÃO DE FOTOS DE VISTORIA:
      // Se houver avarias ou faltas, as fotos ficam salvas PERMANENTEMENTE.
      // Se a devolução for 100% OK, as fotos expiram em 15 dias após a devolução.
      const temIrregularidade = !tudoConferidoOk || itensAvaria.length > 0 || itensFaltantes.length > 0;
      const dataCheckoutObj = new Date();
      const dataExpiracaoFotos = temIrregularidade
        ? null
        : new Date(dataCheckoutObj.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

      const locRef = doc(db, 'locacoes', id);
      await updateDoc(locRef, {
        itens: itensAtualizados,
        observacoesRetorno: observacoes,
        responsavelRetorno: responsavel,
        assinaturaRetornoUrl: assUrl || null,
        fotosRetorno: fotosVistoria,
        status: novoStatus,
        dataCheckout: dataCheckoutObj.toISOString(),
        fotosManterPermanente: temIrregularidade,
        expirarFotosEm: dataExpiracaoFotos
      });

      const msgManutencao = qtdEnviadasManutencao > 0
        ? `\n🛠️ ${qtdEnviadasManutencao} peça(s) com avaria enviada(s) automaticamente para Manutenção no Estoque.`
        : '';
      alert(`✅ Devolução (Check-out) do Pedido #${locacao?.numeroPedido || ''} salva com sucesso!${msgManutencao}`);
      navigate('/locacoes');
    } catch (err) {
      console.error('Erro ao salvar checkout:', err);
      alert('Ocorreu um erro ao salvar o checkout. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="checkout-loading-screen">
        <div className="checkout-spinner"></div>
        <p>Carregando dados da vistoria de devolução...</p>
      </div>
    );
  }

  const numeroPedido = locacao?.numeroPedido || locacao?.id?.slice(0, 6) || id.slice(0, 6);
  const clienteNome = locacao?.clienteNome || locacao?.nomeCliente || 'Cliente Celebre';

  const getStatusIcon = (status) => {
    if (status === 'ok') return '✅';
    if (status === 'avaria') return '⚠️';
    if (status === 'faltou') return '❌';
    return '⏳';
  };

  return (
    <div className="checkout-page-container">

      {/* ─── CABEÇALHO ─── */}
      <div className="co-page-header">
        <Link to="/locacoes" className="co-back-link">
          ← Voltar para Locações
        </Link>
        <div className="co-header-main">
          <div className="co-header-icon">🛬</div>
          <div className="co-header-text">
            <h1>Conferência & Devolução de Acervo</h1>
            <p>Vistoria de retorno e registro de avarias — <strong>Pedido #{numeroPedido}</strong></p>
          </div>
        </div>
      </div>

      {/* ─── BANNER RESUMO DO PEDIDO ─── */}
      <div className="co-resumo-card">
        <div className="co-resumo-kpi-grid">
          <div className="co-kpi-item">
            <div className="co-kpi-icon">📋</div>
            <div className="co-kpi-text">
              <span className="co-kpi-label">Pedido</span>
              <span className="co-kpi-value">#{numeroPedido}</span>
            </div>
          </div>

          <div className="co-kpi-item">
            <div className="co-kpi-icon">📅</div>
            <div className="co-kpi-text">
              <span className="co-kpi-label">Data Devolução</span>
              <span className="co-kpi-value">
                {locacao?.dataDevolucao
                  ? new Date(locacao.dataDevolucao).toLocaleDateString('pt-BR')
                  : 'Hoje'}
              </span>
            </div>
          </div>

          <div className="co-kpi-item">
            <div className="co-kpi-icon">👤</div>
            <div className="co-kpi-text">
              <span className="co-kpi-label">Cliente</span>
              <span className="co-kpi-value">{clienteNome}</span>
            </div>
          </div>

          <div className="co-kpi-item gold">
            <div className="co-kpi-icon">📦</div>
            <div className="co-kpi-text">
              <span className="co-kpi-label">Modalidade</span>
              <span className="co-kpi-value">{locacao?.modalidade || 'Locação de Peças'}</span>
            </div>
          </div>
        </div>

        {/* PROGRESSO */}
        <div className="co-progress-block">
          <div className="co-progress-top">
            <span>Progresso da Devolução</span>
            <strong>{progressoPct}%</strong>
          </div>
          <div className="co-progress-bar">
            <div className="co-progress-fill" style={{ width: `${progressoPct}%` }} />
          </div>
          <span className="co-progress-sub">{totalConferido} de {totalContratado} peças devolvidas</span>
        </div>
      </div>

      {/* ─── ALERTA DE AVARIAS / FALTAS ─── */}
      {(itensComAvaria.length > 0 || itensFaltantes.length > 0) && (
        <div className="co-alert-strip">
          <div className="co-alert-icon">⚠️</div>
          <div className="co-alert-text">
            <span className="co-alert-title">ATENÇÃO — Irregularidades registradas nesta devolução</span>
            <div className="co-alert-badges">
              {itensComAvaria.length > 0 && (
                <span className="co-badge avaria">🛠️ {itensComAvaria.length} item(ns) com Avaria</span>
              )}
              {itensFaltantes.length > 0 && (
                <span className="co-badge falta">❌ {itensFaltantes.length} item(ns) Faltantes</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 💰 RESUMO FINANCEIRO DE RESSARCIMENTO (AVARIAS E FALTAS) ─── */}
      {(totalRessarcimento > 0 || itensComAvaria.length > 0 || itensFaltantes.length > 0) && (
        <div className="co-finance-card">
          <div className="co-finance-head">
            <div className="co-finance-title">
              <span className="co-finance-icon">💰</span>
              <div>
                <h4>Cálculo Automático de Ressarcimento</h4>
                <p>Cobrança estimada de peças avariadas ou faltantes</p>
              </div>
            </div>
            <div className="co-finance-total-badge">
              <small>TOTAL A COBRAR:</small>
              <strong>R$ {totalRessarcimento.toFixed(2)}</strong>
            </div>
          </div>
          <div className="co-finance-breakdown">
            <div className="co-fin-item avaria">
              <span>🛠️ Taxa de Avarias / Reparos:</span>
              <strong>R$ {custoTotalAvarias.toFixed(2)}</strong>
            </div>
            <div className="co-fin-item falta">
              <span>❌ Taxa de Reposição (Faltas):</span>
              <strong>R$ {custoTotalFaltas.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAINEL MESTRE DE CONFERÊNCIA ─── */}
      <div className="co-master-panel">

        {/* HEADER DO PAINEL */}
        <div className="co-panel-header">
          <div className="co-panel-title-row">
            <input
              type="checkbox"
              className="co-check-all"
              checked={itensState.length > 0 && itensState.every(i => i.qtdConferida >= i.quantidade)}
              onChange={toggleSelecionarTodos}
              title="Marcar/Desmarcar todos como devolvidos"
            />
            <h3 className="co-panel-title">
              📦 Peças da Devolução
              <span className="co-count-badge">{itensExibidos.length} / {itensState.length}</span>
            </h3>
          </div>
        </div>

        {/* BARRA DE BUSCA */}
        <div className="co-search-bar">
          <input
            ref={inputBuscaRef}
            type="text"
            className="co-search-input"
            placeholder="🔍 Digite ou bipe o código SKU / barras da peça..."
            value={buscaCodigo}
            onChange={(e) => setBuscaCodigo(e.target.value)}
            onKeyDown={handleKeyDownBusca}
          />
          <div className="co-search-btns">
            <button
              type="button"
              className="co-btn-scan primary"
              onClick={() => processarCodigoBipado(buscaCodigo)}
            >
              🔍 Buscar Código
            </button>
            <button
              type="button"
              className={`co-btn-scan dark ${cameraAberta ? 'active' : ''}`}
              onClick={toggleCameraScanner}
            >
              📷 {cameraAberta ? 'Fechar Câmera' : 'Ler QR Code'}
            </button>
          </div>
        </div>

        {/* TOAST DO BIP */}
        {mensagemBip && (
          <div className={`co-bip-toast ${mensagemBip.tipo}`}>
            {mensagemBip.texto}
          </div>
        )}

        {/* CÂMERA */}
        {cameraAberta && (
          <div className="co-camera-wrapper">
            <div id="reader-camera-checkout-std" className="co-camera-box" />
            <small className="co-camera-hint">Posicione o QR Code da peça em frente à câmera</small>
          </div>
        )}

        {/* FILTROS: TABS + CATEGORIA & AÇÕES RÁPIDAS */}
        <div className="co-filters-row">
          <div className="co-tabs">
            <button className={`co-tab ${filtroTab === 'TODOS' ? 'active' : ''}`} onClick={() => setFiltroTab('TODOS')}>
              Todos ({itensState.length})
            </button>
            <button className={`co-tab ${filtroTab === 'PENDENTES' ? 'active' : ''}`} onClick={() => setFiltroTab('PENDENTES')}>
              Pendentes ({itensState.filter(i => i.qtdConferida < i.quantidade).length})
            </button>
            <button className={`co-tab ${filtroTab === 'CONFERIDOS' ? 'active' : ''}`} onClick={() => setFiltroTab('CONFERIDOS')}>
              Devolvidos ({itensState.filter(i => i.qtdConferida >= i.quantidade).length})
            </button>
            <button className={`co-tab ${filtroTab === 'AVARIAS' ? 'active' : ''}`} onClick={() => setFiltroTab('AVARIAS')}>
              🛠️ Avarias ({itensComAvaria.length})
            </button>
          </div>

          <div className="co-cat-row">
            <div className="co-cat-left">
              <label>Categoria:</label>
              <select
                className="co-cat-select"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
              >
                {categoriasDisponiveis.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="co-panel-actions-quick">
              <button
                type="button"
                className="co-btn-quick-all"
                onClick={handleDevolverTudoInteiro}
                title="Marcar todas as peças como devolvidas sem avarias de uma só vez"
              >
                ⚡ Devolver Tudo (1-Click)
              </button>
              <button
                type="button"
                className="co-btn-compare-vistorias"
                onClick={() => setMostrarComparativo(!mostrarComparativo)}
              >
                📜 {mostrarComparativo ? 'Ocultar Comparativo' : 'Comparar Vistorias'}
              </button>
              <button
                type="button"
                className="co-btn-expand"
                onClick={() => setModalExpandirAberto(true)}
              >
                ⤢ Expandir
              </button>
            </div>
          </div>
        </div>

        {/* LISTA DE ITENS */}
        <div className="co-items-list">
          {itensExibidos.length === 0 ? (
            <div className="co-empty-state">
              <span>✨</span>
              <span>Nenhum item nesta aba de filtro.</span>
            </div>
          ) : (
            itensExibidos.map((item) => {
              const originalIndex = itensState.findIndex(i => i === item);
              const isTotal = item.qtdConferida >= item.quantidade;
              const statusClass = item.statusRetorno === 'ok' ? 'ok'
                : item.statusRetorno === 'avaria' ? 'avaria' : 'falta';

              return (
                <div key={originalIndex} className={`co-item-card ${statusClass}`}>

                  {/* TOPO DO CARD */}
                  <div className="co-item-top">
                    <input
                      type="checkbox"
                      className="co-item-cb"
                      checked={isTotal}
                      onChange={() => toggleSelecaoItem(originalIndex)}
                    />

                    <div className="co-item-thumb">
                      {item.imagem || item.foto
                        ? <img src={item.imagem || item.foto} alt={item.nome} />
                        : '📦'
                      }
                    </div>

                    <div className="co-item-info">
                      <p className="co-item-name">{item.nome}</p>
                      <div className="co-item-tags">
                        <span className="co-tag code">Cód: {item.codigo || 'S/C'}</span>
                        {item.categoria && <span className="co-tag cat">{item.categoria}</span>}
                        <span className="co-tag loc">📍 {item.localizacao || 'A-01'}</span>
                      </div>
                    </div>

                    <div className={`co-item-status-badge ${statusClass}`}>
                      {getStatusIcon(item.statusRetorno)}
                    </div>
                  </div>

                  {/* CONTROLES */}
                  <div className="co-item-controls">

                    {/* STEPPER DE QUANTIDADE */}
                    <div className="co-stepper">
                      <span className="co-stepper-label">Retornado:</span>
                      <div className="co-stepper-ctrl">
                        <button type="button" className="co-step-btn" onClick={() => alterarQtdConferida(originalIndex, -1)}>−</button>
                        <input
                          type="number"
                          className="co-step-input"
                          value={item.qtdConferida}
                          onChange={(e) => setQtdConferidaDireta(originalIndex, e.target.value)}
                        />
                        <button type="button" className="co-step-btn" onClick={() => alterarQtdConferida(originalIndex, 1)}>+</button>
                        <button type="button" className="co-step-max" onClick={() => alterarQtdConferida(originalIndex, item.quantidade)}>Max</button>
                      </div>
                      <span className="co-stepper-total">de {item.quantidade} un</span>
                    </div>

                    {/* BOTÕES DE STATUS */}
                    <div className="co-retorno-btns">
                      <button
                        type="button"
                        className={`co-ret-btn ok ${item.statusRetorno === 'ok' ? 'active' : ''}`}
                        onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'ok')}
                      >
                        🟢 OK
                      </button>
                      <button
                        type="button"
                        className={`co-ret-btn avaria ${item.statusRetorno === 'avaria' ? 'active' : ''}`}
                        onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'avaria')}
                      >
                        🛠️ Avaria
                      </button>
                      <button
                        type="button"
                        className={`co-ret-btn faltou ${item.statusRetorno === 'faltou' ? 'active' : ''}`}
                        onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'faltou')}
                      >
                        ❌ Faltou
                      </button>
                    </div>

                    {/* DETALHE DE AVARIA */}
                    {item.statusRetorno === 'avaria' && (
                      <div className="co-avaria-detail">
                        <div className="co-avaria-row">
                          <div className="co-avaria-field">
                            <label>📝 Descrição do Dano:</label>
                            <input
                              type="text"
                              className="co-avaria-input"
                              placeholder="Ex: Vaso trincado na base, tinta descascada..."
                              value={item.obsRetorno || ''}
                              onChange={(e) => setCampoItemRetorno(originalIndex, 'obsRetorno', e.target.value)}
                            />
                          </div>
                          <div className="co-avaria-field">
                            <label>💰 Custo Estimado (R$):</label>
                            <input
                              type="number"
                              className="co-avaria-custo"
                              placeholder="0,00"
                              min="0"
                              step="0.01"
                              value={item.custoAvaria || ''}
                              onChange={(e) => setCampoItemRetorno(originalIndex, 'custoAvaria', e.target.value)}
                            />
                          </div>
                        </div>
                        <p className="co-avaria-note">
                          🛠️ Esta peça será enviada <strong>automaticamente</strong> para Manutenção no Estoque ao salvar.
                        </p>
                      </div>
                    )}

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── ESTAÇÕES FINAIS: RESPONSÁVEL · FOTOS · ASSINATURA (POR ÚLTIMO) ─── */}
      <div className="co-stations-grid">

        {/* COLUNA 1: RESPONSÁVEL & OBS */}
        <div className="co-station">
          <div className="co-station-head">
            <div className="co-station-title">
              <div className="co-station-icon slate">👤</div>
              <div className="co-station-head-text">
                <h3>Responsável & Observações</h3>
                <small>Vistoria e conferência do galpão</small>
              </div>
            </div>
          </div>

          <div className="co-obs-fields">
            <div className="co-field-group">
              <label>👤 Conferente no Galpão:</label>
              {listaColaboradores.length > 0 ? (
                <select
                  className="co-select"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                >
                  <option value="">Selecione o responsável...</option>
                  {listaColaboradores.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="co-input-text"
                  placeholder="Nome do conferente no galpão"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              )}
            </div>

            <div className="co-field-group">
              <label>📝 Observações da Vistoria:</label>
              <textarea
                rows={3}
                className="co-textarea"
                placeholder="Apontamentos da devolução (ex: 1 vaso trincado, peças molhadas...)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* COLUNA 2: FOTOS DA VISTORIA */}
        <div className="co-station">
          <div className="co-station-head">
            <div className="co-station-title">
              <div className="co-station-icon blue">📷</div>
              <div className="co-station-head-text">
                <h3>Fotos da Vistoria</h3>
                <small>
                  {itensComAvaria.length > 0 || itensFaltantes.length > 0
                    ? '🛡️ Salvas permanentemente (Com Avarias/Faltas)'
                    : '⏱️ Armazenadas por 15 dias pós-devolução'}
                </small>
              </div>
            </div>
          </div>

          {fotosVistoria.length > 0 ? (
            <>
              <div className="co-fotos-grid">
                {fotosVistoria.map((ft, fIdx) => (
                  <div key={fIdx} className="co-foto-item">
                    <img src={ft} alt={`Vistoria ${fIdx}`} />
                    <button type="button" className="co-foto-del" onClick={() => removerFotoVistoria(fIdx)}>✕</button>
                  </div>
                ))}
              </div>
              <label className="co-btn-add-more">
                📷 + Adicionar Mais
                <input type="file" accept="image/*" capture="environment" multiple onChange={handleUploadFotos} style={{ display: 'none' }} />
              </label>
            </>
          ) : (
            <label>
              <div className="co-fotos-empty">
                <span className="co-fotos-empty-icon">📸</span>
                <p>Nenhuma foto da vistoria anexada.</p>
                <span className="co-btn-upload">📷 + Adicionar Fotos</span>
              </div>
              <input type="file" accept="image/*" capture="environment" multiple onChange={handleUploadFotos} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* COLUNA 3: ASSINATURA DO CLIENTE (POR ÚLTIMO) */}
        <div className="co-station">
          <div className="co-station-head">
            <div className="co-station-title">
              <div className="co-station-icon green">✍️</div>
              <div className="co-station-head-text">
                <h3>Assinatura do Cliente</h3>
                <small>Confirma a vistoria de retorno</small>
              </div>
            </div>
            <button type="button" className="co-btn-clear-sig" onClick={limparAssinatura}>Limpar</button>
          </div>

          <div className="co-sig-box">
            {assinaturaSalvaUrl ? (
              <img src={assinaturaSalvaUrl} alt="Assinatura Registrada" className="co-sig-preview" />
            ) : (
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="#0f172a"
                canvasProps={{ className: 'co-sig-canvas' }}
                onEnd={capturarAssinatura}
              />
            )}
          </div>

          {assinaturaSalvaUrl ? (
            <div className="co-sig-success">✓ Assinatura Registrada com Sucesso</div>
          ) : (
            <p className="co-sig-hint">Assine no quadro acima para confirmar a vistoria.</p>
          )}
        </div>

      </div>

      {/* ─── MODAL EXPANDIDO ─── */}
      {modalExpandirAberto && (
        <div className="co-modal-overlay">
          <div className="co-modal-box">
            <div className="co-modal-header">
              <div>
                <h2>📦 Conferência Ampla — Pedido #{numeroPedido}</h2>
                <p>Cliente: <strong>{clienteNome}</strong></p>
              </div>
              <button type="button" className="co-modal-close" onClick={() => setModalExpandirAberto(false)}>✕ Fechar</button>
            </div>

            <div className="co-modal-body">
              {itensState.map((item, originalIndex) => {
                const isTotal = item.qtdConferida >= item.quantidade;
                const statusClass = item.statusRetorno === 'ok' ? 'ok'
                  : item.statusRetorno === 'avaria' ? 'avaria' : 'falta';

                return (
                  <div key={originalIndex} className={`co-item-card ${statusClass}`}>
                    <div className="co-item-top">
                      <input
                        type="checkbox"
                        className="co-item-cb"
                        checked={isTotal}
                        onChange={() => toggleSelecaoItem(originalIndex)}
                      />
                      <div className="co-item-thumb">
                        {item.imagem || item.foto ? <img src={item.imagem || item.foto} alt={item.nome} /> : '📦'}
                      </div>
                      <div className="co-item-info">
                        <p className="co-item-name">{item.nome}</p>
                        <div className="co-item-tags">
                          <span className="co-tag code">Cód: {item.codigo || 'S/C'}</span>
                          {item.categoria && <span className="co-tag cat">{item.categoria}</span>}
                        </div>
                      </div>
                      <div className={`co-item-status-badge ${statusClass}`}>
                        {getStatusIcon(item.statusRetorno)}
                      </div>
                    </div>

                    <div className="co-item-controls">
                      <div className="co-stepper">
                        <span className="co-stepper-label">Retornado:</span>
                        <div className="co-stepper-ctrl">
                          <button type="button" className="co-step-btn" onClick={() => alterarQtdConferida(originalIndex, -1)}>−</button>
                          <input type="number" className="co-step-input" value={item.qtdConferida}
                            onChange={(e) => setQtdConferidaDireta(originalIndex, e.target.value)} />
                          <button type="button" className="co-step-btn" onClick={() => alterarQtdConferida(originalIndex, 1)}>+</button>
                          <button type="button" className="co-step-max" onClick={() => alterarQtdConferida(originalIndex, item.quantidade)}>Max</button>
                        </div>
                        <span className="co-stepper-total">de {item.quantidade} un</span>
                      </div>
                      <div className="co-retorno-btns">
                        <button type="button" className={`co-ret-btn ok ${item.statusRetorno === 'ok' ? 'active' : ''}`}
                          onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'ok')}>🟢 OK</button>
                        <button type="button" className={`co-ret-btn avaria ${item.statusRetorno === 'avaria' ? 'active' : ''}`}
                          onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'avaria')}>🛠️ Avaria</button>
                        <button type="button" className={`co-ret-btn faltou ${item.statusRetorno === 'faltou' ? 'active' : ''}`}
                          onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'faltou')}>❌ Faltou</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="co-modal-footer">
              <span className="co-modal-prog">
                Progresso: <strong>{totalConferido} / {totalContratado} ({progressoPct}%)</strong>
              </span>
              <button type="button" className="co-btn-concluir" onClick={() => setModalExpandirAberto(false)}>
                ✅ Concluir Vistoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 📜 PAINEL COMPARATIVO DE VISTORIAS (SAÍDA VS VOLTA) ─── */}
      {mostrarComparativo && (
        <div className="co-comparativo-card animate-pop">
          <div className="co-comp-header">
            <h3>📜 Comparativo de Vistorias (Saída Ida vs Retorno Volta)</h3>
            <button type="button" className="co-comp-close" onClick={() => setMostrarComparativo(false)}>✕ Fechar</button>
          </div>
          <div className="co-comp-grid">
            {/* COLUNA SAÍDA */}
            <div className="co-comp-col ida">
              <div className="co-comp-col-head">
                <span className="co-comp-badge ida">🛫 VISTORIA DE SAÍDA (IDA)</span>
                <p><strong>Data:</strong> {locacao?.dataCheckin ? new Date(locacao.dataCheckin).toLocaleDateString('pt-BR') : 'Data de Saída'}</p>
                <p><strong>Responsável:</strong> {locacao?.responsavelCheckin || 'Não informado'}</p>
                <p><strong>Obs Saída:</strong> {locacao?.observacoesCheckin || 'Sem observações na entrega'}</p>
              </div>
              <div className="co-comp-fotos">
                <span>📷 Fotos de Saída:</span>
                {locacao?.fotosCheckin && locacao.fotosCheckin.length > 0 ? (
                  <div className="co-fotos-grid-mini">
                    {locacao.fotosCheckin.map((f, i) => (
                      <img key={i} src={f} alt={`Saída ${i}`} />
                    ))}
                  </div>
                ) : (
                  <small>Nenhuma foto anexada na saída.</small>
                )}
              </div>
            </div>

            {/* COLUNA RETORNO */}
            <div className="co-comp-col volta">
              <div className="co-comp-col-head">
                <span className="co-comp-badge volta">🛬 VISTORIA DE RETORNO (VOLTA)</span>
                <p><strong>Data:</strong> Hoje ({new Date().toLocaleDateString('pt-BR')})</p>
                <p><strong>Responsável:</strong> {responsavel || 'Em andamento'}</p>
                <p><strong>Obs Volta:</strong> {observacoes || 'Sem observações na devolução'}</p>
              </div>
              <div className="co-comp-fotos">
                <span>📷 Fotos de Retorno:</span>
                {fotosVistoria.length > 0 ? (
                  <div className="co-fotos-grid-mini">
                    {fotosVistoria.map((f, i) => (
                      <img key={i} src={f} alt={`Retorno ${i}`} />
                    ))}
                  </div>
                ) : (
                  <small>Nenhuma foto anexada no retorno ainda.</small>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── RODAPÉ FIXO ─── */}
      <div className="co-footer">
        <div className="co-footer-inner">
          <div className="co-footer-info">
            <span>Devolução: <strong>{totalConferido} de {totalContratado} peças ({progressoPct}%)</strong></span>
            <div className="co-footer-progress-mini">
              <div className="co-footer-progress-fill" style={{ width: `${progressoPct}%` }} />
            </div>
          </div>
          <div className="co-footer-actions-container">
            <div className="co-footer-sec-btns">
              <button type="button" className="co-btn-wsp" onClick={handleEnviarWhatsApp} title="Enviar comprovante via WhatsApp">
                💬 WhatsApp
              </button>
              <button type="button" className="co-btn-pdf" onClick={handleGerarPDF}>
                🖨️ PDF Comprovante
              </button>
            </div>
            <button
              type="button"
              className="co-btn-finalizar-full"
              onClick={handleSalvarCheckout}
              disabled={salvando}
            >
              {salvando ? '💾 Salvando Vistoria...' : '🛬 Finalizar Devolução'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};


export default CheckoutPage;
