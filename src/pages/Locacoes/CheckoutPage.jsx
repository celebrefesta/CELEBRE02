import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './CheckoutPage.css';
import SignatureCanvas from 'react-signature-canvas';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { gerarComprovanteCheckinPDF } from '../../utils/gerarComprovanteCheckinPDF';

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

  // 👥 CARREGAR COLABORADORES
  useEffect(() => {
    const carregarColaboradores = async () => {
      try {
        if (!tenantId) return;
        const qColab = query(collection(db, 'usuarios'), where('tenantId', '==', tenantId));
        const snapColab = await getDocs(qColab);
        const colabs = [];
        snapColab.forEach(d => {
          const data = d.data();
          if (data.nome) colabs.push(data.nome);
        });
        setListaColaboradores(colabs);
      } catch (err) {
        console.error("Erro ao carregar colaboradores:", err);
      }
    };
    carregarColaboradores();
  }, [tenantId]);

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

  // 📷 UPLOAD DE FOTOS DA VISTORIA DE RETORNO
  const handleUploadFotos = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotosVistoria(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
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
        assinaturaUrl: assUrl
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
      const itensAvaria = itensAtualizados.filter(i => i.statusRetorno === 'avaria');
      for (const itemAv of itensAvaria) {
        if (itemAv.enviarManutencao && (itemAv.id || itemAv.pecaId)) {
          const pecaId = itemAv.pecaId || itemAv.id;
          try {
            const pecaRef = doc(db, 'estoque', pecaId);
            const pecaSnap = await getDoc(pecaRef);
            if (pecaSnap.exists()) {
              const pecaData = pecaSnap.data();
              const qtdMaintAtual = Number(pecaData.qtdManutencao || 0);
              await updateDoc(pecaRef, {
                qtdManutencao: qtdMaintAtual + Number(itemAv.quantidade || 1),
                statusManutencao: 'em_manutencao',
                motivoManutencao: itemAv.obsRetorno || `Avaria na devolução #${locacao?.numeroPedido || id}`,
                custoManutencao: Number(itemAv.custoAvaria || 0)
              });
            }
          } catch (eErr) {
            console.error('Erro ao registrar manutenção:', eErr);
          }
        }
      }

      const tudoConferidoOk = itensAtualizados.every(i => i.qtdRetornada >= i.quantidade && i.statusRetorno === 'ok');
      const novoStatus = tudoConferidoOk ? 'Finalizado' : 'Conferido com Avarias/Faltas';

      const locRef = doc(db, 'locacoes', id);
      await updateDoc(locRef, {
        itens: itensAtualizados,
        observacoesRetorno: observacoes,
        responsavelRetorno: responsavel,
        assinaturaRetornoUrl: assUrl || null,
        fotosRetorno: fotosVistoria,
        status: novoStatus,
        dataCheckout: new Date().toISOString()
      });

      alert(`✅ Devolução (Check-out) do Pedido #${locacao?.numeroPedido || ''} salva com sucesso!`);
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

  return (
    <div className="checkout-page-container">

      {/* 🧭 NAVEGAÇÃO & TÍTULO */}
      <div className="checkout-header-nav">
        <Link to="/locacoes" className="btn-voltar-checkout">
          ← Voltar para Locações
        </Link>
        <div className="header-badge-modo volta">
          🛬 CONFERÊNCIA DE VOLTA (DEVOLUÇÃO AO ACERVO)
        </div>
      </div>

      {/* 📊 BANNER EXECUTIVO DO PEDIDO */}
      <div className="checkout-resumo-banner-vip">
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
              <strong className="pill-value">{locacao?.modalidade || 'Locação de Peças'}</strong>
            </div>
          </div>

          <div className="resumo-pill-card card-cliente">
            <span className="pill-icon">👤</span>
            <div className="pill-text">
              <span className="pill-label">CLIENTE</span>
              <strong className="pill-value">{clienteNome}</strong>
            </div>
          </div>

          <div className="resumo-pill-card">
            <span className="pill-icon">📅</span>
            <div className="pill-text">
              <span className="pill-label">DEVOLUÇÃO</span>
              <strong className="pill-value">{locacao?.dataDevolucao ? new Date(locacao.dataDevolucao).toLocaleDateString('pt-BR') : 'Hoje'}</strong>
            </div>
          </div>
        </div>

        {/* BARRINHA DE PROGRESSO */}
        <div className="resumo-progress-card-vip">
          <div className="prog-top-row">
            <span>Progresso da Devolução</span>
            <strong>{progressoPct}%</strong>
          </div>
          <div className="prog-bar-track">
            <div className="prog-bar-fill green" style={{ width: `${progressoPct}%` }}></div>
          </div>
          <span className="prog-sub-txt">{totalConferido} de {totalContratado} peças devolvidas</span>
        </div>
      </div>

      {/* ⚠️ ALERTA RESUMO DE AVARIAS / FALTAS (SE HOUVER) */}
      {(itensComAvaria.length > 0 || itensFaltantes.length > 0) && (
        <div className="checkout-alert-box">
          <div className="alert-header">
            <span>⚠️ AENÇÃO: REGISTRO DE IRREGULARIDADES NA DEVOLUÇÃO</span>
          </div>
          <div className="alert-body">
            {itensComAvaria.length > 0 && (
              <span className="alert-badge avaria">🛠️ {itensComAvaria.length} item(ns) com Avaria / Dano</span>
            )}
            {itensFaltantes.length > 0 && (
              <span className="alert-badge falta">❌ {itensFaltantes.length} item(ns) com Faltas ou Extravio</span>
            )}
          </div>
        </div>
      )}

      {/* 🔍 BARRA DE BIPAGEM E FILTROS */}
      <div className="checkout-toolbar-std">
        <div className="toolbar-search-row">
          <div className="search-box-group">
            <input
              ref={inputBuscaRef}
              type="text"
              placeholder="🔍 Bipar ou digitar código/SKU da peça..."
              value={buscaCodigo}
              onChange={(e) => setBuscaCodigo(e.target.value)}
              onKeyDown={handleKeyDownBusca}
              className="input-search-std"
            />
            <button
              type="button"
              className="btn-bipar-std"
              onClick={() => processarCodigoBipado(buscaCodigo)}
            >
              ⚡ Bipar
            </button>
            <button
              type="button"
              className={`btn-camera-std ${cameraAberta ? 'active' : ''}`}
              onClick={toggleCameraScanner}
            >
              📷 {cameraAberta ? 'Fechar Câmera' : 'Ler QR Code'}
            </button>
          </div>
        </div>

        {mensagemBip && (
          <div className={`msg-bip-toast ${mensagemBip.tipo}`}>
            {mensagemBip.texto}
          </div>
        )}

        {cameraAberta && (
          <div className="camera-scanner-wrapper">
            <div id="reader-camera-checkout-std" className="camera-box-viewport"></div>
            <small>Posicione o QR Code da peça em frente à câmera</small>
          </div>
        )}

        {/* FILTROS DE ABA */}
        <div className="toolbar-bottom-filters">
          <div className="tabs-bar-std">
            <button
              className={`tab-btn-std ${filtroTab === 'TODOS' ? 'active' : ''}`}
              onClick={() => setFiltroTab('TODOS')}
            >
              Todos ({itensState.length})
            </button>
            <button
              className={`tab-btn-std ${filtroTab === 'PENDENTES' ? 'active' : ''}`}
              onClick={() => setFiltroTab('PENDENTES')}
            >
              Pendentes ({itensState.filter(i => i.qtdConferida < i.quantidade).length})
            </button>
            <button
              className={`tab-btn-std ${filtroTab === 'CONFERIDOS' ? 'active' : ''}`}
              onClick={() => setFiltroTab('CONFERIDOS')}
            >
              Devolvidos ({itensState.filter(i => i.qtdConferida >= i.quantidade).length})
            </button>
            <button
              className={`tab-btn-std ${filtroTab === 'AVARIAS' ? 'active' : ''}`}
              onClick={() => setFiltroTab('AVARIAS')}
            >
              🛠️ Avarias ({itensComAvaria.length})
            </button>
          </div>

          <div className="cat-filter-group">
            <span>Categoria:</span>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="select-cat-std"
            >
              {categoriasDisponiveis.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 📦 LISTA PRINCIPAL DE PEÇAS DE VOLTA */}
      <div className="panel-box-std">
        <div className="panel-header-flex">
          <div className="title-with-checkbox">
            <input
              type="checkbox"
              checked={itensState.length > 0 && itensState.every(i => i.qtdConferida >= i.quantidade)}
              onChange={toggleSelecionarTodos}
              title="Marcar/Desmarcar Todos os Itens como Devolvidos"
              className="check-all-input"
            />
            <h3>📦 Peças da Devolução <span className="lbl-txt-desk">({itensExibidos.length} de {itensState.length} exibidos)</span><span className="lbl-txt-mob">({itensExibidos.length}/{itensState.length})</span></h3>
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
            itensExibidos.map((item, indexExibido) => {
              const originalIndex = itensState.findIndex(i => i === item);
              const isTotal = item.qtdConferida >= item.quantidade;
              const isParcial = item.qtdConferida > 0 && item.qtdConferida < item.quantidade;

              return (
                <div
                  key={originalIndex}
                  className={`item-card-std ${item.statusRetorno === 'ok' ? 'status-total-ok' : item.statusRetorno === 'avaria' ? 'status-avaria' : 'status-falta'
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
                      <span className="lbl-step">Retornado:</span>
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

                    {/* SELEÇÃO DE ESTADO DE RETORNO DO ITEM */}
                    <div className="retorno-btns-std">
                      <button
                        type="button"
                        className={`btn-ret-std ok ${item.statusRetorno === 'ok' ? 'active' : ''}`}
                        onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'ok')}
                      >
                        🟢 OK (Inteiro)
                      </button>
                      <button
                        type="button"
                        className={`btn-ret-std avaria ${item.statusRetorno === 'avaria' ? 'active' : ''}`}
                        onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'avaria')}
                      >
                        🛠️ Avaria / Dano
                      </button>
                      <button
                        type="button"
                        className={`btn-ret-std faltou ${item.statusRetorno === 'faltou' ? 'active' : ''}`}
                        onClick={() => setCampoItemRetorno(originalIndex, 'statusRetorno', 'faltou')}
                      >
                        ❌ Faltou / Extravio
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ✍️ ASSINATURA E 📷 FOTOS DA VISTORIA DE RETORNO */}
      <div className="checkout-bottom-sections-grid">

        {/* FOTOS DA VISTORIA DE RETORNO */}
        <div className="panel-box-std fotos-panel-card">
          <div className="fotos-header-block">
            <div className="fotos-title-text">
              <h3>📷 Fotos da Vistoria de Retorno</h3>
              <small className="sub-txt-info">📁 Fotos registradas na devolução e anexadas ao PDF.</small>
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
                  <img src={ft} alt={`Vistoria Retorno ${fIdx}`} />
                  <button type="button" className="btn-del-foto-large" onClick={() => removerFotoVistoria(fIdx)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-fotos-box">
              <span className="cam-icon-big">📸</span>
              <p>Nenhuma foto da vistoria de retorno anexada.<br />Clique em <strong>"+ Adicionar Fotos"</strong> para registrar o estado dos itens recebidos.</p>
            </div>
          )}
        </div>

        {/* ASSINATURA DIGITAL DO CLIENTE / CONFERENTE */}
        <div className="panel-box-std sig-panel-card">
          <div className="panel-header-flex">
            <h3>✍️ Assinatura do Cliente / Conferente</h3>
            <button type="button" className="btn-limpar-sig" onClick={limparAssinatura}>Limpar</button>
          </div>
          <div className="sig-wrapper-std">
            {assinaturaSalvaUrl ? (
              <div className="sig-preview-box">
                <img src={assinaturaSalvaUrl} alt="Assinatura Salva" />
                <span className="sig-ok-badge">✓ Assinatura Registrada</span>
              </div>
            ) : (
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="#0f172a"
                canvasProps={{ className: 'sig-canvas-element' }}
                onEnd={capturarAssinatura}
              />
            )}
          </div>
          <small className="sig-hint-txt">Assine no quadro acima para confirmar a devolução do acervo.</small>
        </div>

      </div>

      {/* 📝 OBSERVAÇÕES E RESPONSÁVEL DO GALPÃO */}
      <div className="panel-box-std obs-panel-card">
        <div className="obs-grid-row">
          <div className="obs-col-field">
            <label>👤 Responsável pelo Recebimento no Galpão:</label>
            {listaColaboradores.length > 0 ? (
              <select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="input-std-select"
              >
                <option value="">Selecione o responsável...</option>
                {listaColaboradores.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Nome do conferente no galpão"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="input-std-text"
              />
            )}
          </div>

          <div className="obs-col-field flex-2">
            <label>📝 Observações da Devolução (Vistoria de Avarias / Limpeza):</label>
            <textarea
              rows={2}
              placeholder="Digite apontamentos de vistoria na devolução (ex: 1 vaso trincado, peças molhadas...)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="textarea-std"
            />
          </div>
        </div>
      </div>

      {/* 🔍 MODAL EXPANDIDO DE TELA CHEIA PARA CONFERÊNCIA DE MUITAS PEÇAS */}
      {modalExpandirAberto && (
        <div className="modal-checkin-overlay">
          <div className="modal-expandir-box animate-pop">
            <div className="modal-expandir-header">
              <div className="exp-title-row">
                <span className="exp-icon">📦</span>
                <div className="exp-title-text">
                  <h2>Conferência Ampla de Devolução — #{numeroPedido}</h2>
                  <p>Cliente: <strong>{clienteNome}</strong></p>
                </div>
              </div>
              <button type="button" className="btn-close-exp-modal" onClick={() => setModalExpandirAberto(false)}>✕ Fechar</button>
            </div>

            <div className="modal-expandir-body">
              <div className="items-list-std modal-list">
                {itensState.map((item, originalIndex) => {
                  const isTotal = item.qtdConferida >= item.quantidade;

                  return (
                    <div
                      key={originalIndex}
                      className={`item-card-std ${item.statusRetorno === 'ok' ? 'status-total-ok' : item.statusRetorno === 'avaria' ? 'status-avaria' : 'status-falta'
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
                          <span className="lbl-step">Retornado:</span>
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
      <div className="checkout-footer-fixed">
        <div className="footer-content-inner">
          <div className="footer-txt-info">
            <span>Devolução (Check-out): <strong>{totalConferido} de {totalContratado} peças ({progressoPct}%)</strong></span>
          </div>
          <div className="footer-actions-row">
            <button type="button" className="btn-secondary-celebre" onClick={handleGerarPDF}>
              🖨️ PDF Comprovante
            </button>
            <button type="button" className="btn-primary-celebre green-gradient" onClick={handleSalvarCheckout} disabled={salvando}>
              {salvando ? '💾 SALVANDO...' : '🛬 FINALIZAR CHECK-OUT (DEVOLUÇÃO)'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CheckoutPage;
