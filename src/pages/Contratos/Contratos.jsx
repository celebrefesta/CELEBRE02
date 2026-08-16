import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, deleteDoc, doc, where, getDoc, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth"; 
import jsPDF from "jspdf"; 
import "./Contratos.css";

const Contratos = () => {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(null);
  const [dadosEmpresa, setDadosEmpresa] = useState({ nomeEmpresa: 'Sua Empresa' });
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos"); // todos | assinados | pendentes | mes_atual
  
  // ⚡ Modal de importação rápida de locação para novo contrato
  const [modalImportarLocacao, setModalImportarLocacao] = useState(false);
  const [listaLocacoes, setListaLocacoes] = useState([]);
  const [buscaLocacao, setBuscaLocacao] = useState("");
  const [filtroTipoModal, setFiltroTipoModal] = useState("todos"); // todos | locacao | orcamento
  const [carregandoLocacoes, setCarregandoLocacoes] = useState(false);

  const navigate = useNavigate();

  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE CONTRATOS VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    const currentTenant = localStorage.getItem('tenantId') || auth.currentUser?.uid;
    if (!currentTenant) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || auth.currentUser?.displayName || auth.currentUser?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: currentTenant,
        userId: currentTenant,
        funcionarioId: auth.currentUser?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: auth.currentUser?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log de contratos:", error);
    }
  };

  // Fecha o menu suspenso se clicar fora dele
  useEffect(() => {
    const fecharMenu = () => setMenuAberto(null);
    window.addEventListener('click', fecharMenu);
    return () => window.removeEventListener('click', fecharMenu);
  }, []);

  // Monitora autenticação, busca contratos e configurações da empresa
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      const activeTenant = localStorage.getItem('tenantId') || user?.uid;
      
      if (!user && !activeTenant) {
        setLoading(false);
        navigate('/login');
        return;
      }

      if (!activeTenant) {
        setLoading(false);
        return;
      }

      // 1. Busca configurações da empresa
      try {
        const snap = await getDoc(doc(db, "configuracoes_empresa", activeTenant));
        if (snap.exists()) {
          setDadosEmpresa({ 
            nomeEmpresa: snap.data().nomeEmpresa || snap.data().nome || 'Sua Empresa',
            telefone: snap.data().telefone || '',
            cnpj: snap.data().cnpj || ''
          });
        }
      } catch (e) { 
        console.error("Erro ao buscar dados da empresa:", e); 
      }

      // 2. 🔥 BLINDAGEM MULTI-EMPRESA: Busca contratos da empresa
      setLoading(true);
      const q = query(collection(db, "contratos"), where("userId", "==", activeTenant));
      const unsubContracts = onSnapshot(q, (snapshot) => {
        let lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Ordenação em memória (mais recentes primeiro)
        lista.sort((a, b) => {
          const dataA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAtMs || 0);
          const dataB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAtMs || 0);
          return dataB - dataA;
        });
        
        setContratos(lista);
        setLoading(false);
      }, (error) => {
        console.warn("Aviso na consulta de contratos:", error.message);
        setLoading(false);
      });

      return () => unsubContracts();
    });

    return () => unsubAuth();
  }, [navigate]);

  // Carrega lista de locações ATIVAS / RECÉM-CONFIRMADAS para o modal de importação rápida
  const abrirModalImportacao = async () => {
    const currentTenantId = localStorage.getItem('tenantId') || auth.currentUser?.uid;
    if (!currentTenantId) return;

    setModalImportarLocacao(true);
    setCarregandoLocacoes(true);
    try {
      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", currentTenantId));
      const snap = await getDocs(qLocacoes);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // 🔥 FILTRAGEM INTELIGENTE: Remove qualquer pedido que já foi devolvido, finalizado ou cancelado
      const listaElegivel = lista.filter(loc => {
        const s = String(loc.status || '').toLowerCase().trim();
        const ehFinalizado = ['devolvido', 'devolucao', 'finalizado', 'concluido', 'cancelado', 'estornado'].some(f => s.includes(f));
        return !ehFinalizado;
      });

      listaElegivel.sort((a, b) => {
        const dataA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : (new Date(a.dataRetirada || a.dataEvento || 0).getTime());
        const dataB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : (new Date(b.dataRetirada || b.dataEvento || 0).getTime());
        return dataB - dataA;
      });

      setListaLocacoes(listaElegivel);
    } catch (err) {
      console.error("Erro ao carregar locações:", err);
    } finally {
      setCarregandoLocacoes(false);
    }
  };

  // Alterna a visibilidade do menu de um item específico
  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setMenuAberto(menuAberto === id ? null : id);
  };

  const handleExcluir = async (id, clienteNome) => {
    if (window.confirm(`ATENÇÃO: Deseja realmente excluir permanentemente o contrato de ${clienteNome || 'este cliente'}?`)) {
      try {
        await deleteDoc(doc(db, "contratos", id));
        await registrarLog("EXCLUSÃO DE CONTRATO", `Excluiu permanentemente o contrato do cliente: ${clienteNome}.`);
      } catch (error) {
        console.error("Erro ao excluir contrato", error);
        alert("Erro ao excluir o contrato.");
      }
    }
  };

  // 📱 ENVIAR LINK DE ASSINATURA DIGITAL NO WHATSAPP COM TAGS DINÂMICAS
  const enviarWhatsAppAssinatura = (item) => {
    const telefoneBruto = item.telefone || item.clienteTelefone || item.whatsapp || '';
    const numLimpo = telefoneBruto.replace(/\D/g, '');
    const numFormatado = numLimpo.length <= 11 && !numLimpo.startsWith('55') ? `55${numLimpo}` : numLimpo;
    
    const linkAssinatura = `${window.location.origin}/assinatura/${item.id}`;
    const clienteNome = item.cliente || 'Cliente';
    const empresaNome = dadosEmpresa?.nomeEmpresa || dadosEmpresa?.nome || 'Celebre Festas';
    const eventoData = item.dataEvento ? item.dataEvento.split('-').reverse().join('/') : 'seu evento';
    const vlrTotal = Number(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let textoFinal = dadosEmpresa?.whatsappContratoMsg || `Olá, *{NOME_CLIENTE}*! Tudo bem?\n\nSegue o link oficial para conferência e *assinatura digital* do seu contrato de locação com a *{NOME_EMPRESA}* (Evento: *{DATA_EVENTO}* | Valor: *{VALOR_TOTAL}*):\n\n🔗 {LINK_ASSINATURA}\n\nQualquer dúvida, estamos à inteira disposição! ✨`;

    textoFinal = textoFinal
      .replaceAll('{NOME_CLIENTE}', clienteNome)
      .replaceAll('{NOME_EMPRESA}', empresaNome)
      .replaceAll('{DATA_EVENTO}', eventoData)
      .replaceAll('{VALOR_TOTAL}', vlrTotal)
      .replaceAll('{LINK_ASSINATURA}', linkAssinatura);

    const urlWpp = numFormatado 
      ? `https://wa.me/${numFormatado}?text=${encodeURIComponent(textoFinal)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(textoFinal)}`;

    window.open(urlWpp, '_blank');
  };

  // 📄 GERAR E VISUALIZAR PDF NATIVO EM NOVA ABA
  const gerarPDF = (item) => {
    const docPdf = new jsPDF();
    const margin = 20;
    let y = 20; 
    const pageHeight = docPdf.internal.pageSize.height;
    const pageWidth = docPdf.internal.pageSize.width;

    // --- CABEÇALHO ---
    docPdf.setFillColor(15, 23, 42); // Dark Navy Celebre
    docPdf.rect(0, 0, pageWidth, 35, 'F'); 
    
    docPdf.setTextColor(255, 255, 255); 
    docPdf.setFontSize(18);
    docPdf.setFont("helvetica", "bold");
    docPdf.text(dadosEmpresa.nomeEmpresa.toUpperCase(), 105, 18, { align: "center" });
    
    docPdf.setFontSize(9);
    docPdf.setFont("helvetica", "normal");
    docPdf.setTextColor(197, 160, 89); // Gold Celebre
    docPdf.text("INSTRUMENTO PARTICULAR DE LOCACAO E PRESTACAO DE SERVICOS", 105, 26, { align: "center" });
    
    y = 48;

    // --- DADOS DO CLIENTE & EVENTO ---
    docPdf.setDrawColor(203, 213, 225); 
    docPdf.setFillColor(248, 250, 252);
    docPdf.roundedRect(margin, y, 170, 36, 3, 3, 'FD');

    const dataFormatada = item.dataEvento ? item.dataEvento.split('-').reverse().join('/') : "--/--/----";
    const valorFormatado = Number(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(9.5);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("LOCATARIO(A):", margin + 5, y + 9);
    docPdf.setFont("helvetica", "normal");
    docPdf.text((item.cliente || "Consumidor").toUpperCase(), margin + 35, y + 9);
    
    docPdf.setFont("helvetica", "bold");
    docPdf.text("DATA DO EVENTO:", margin + 5, y + 18);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(dataFormatada, margin + 42, y + 18);
    
    docPdf.setFont("helvetica", "bold");
    docPdf.text("VALOR TOTAL:", margin + 95, y + 18);
    docPdf.setTextColor(22, 163, 74); 
    docPdf.text(valorFormatado, margin + 125, y + 18);

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("ENDERECO:", margin + 5, y + 27);
    docPdf.setFont("helvetica", "normal");
    const endTxt = docPdf.splitTextToSize(item.endereco || "Conforme cadastrado", 135);
    docPdf.text(endTxt[0] || "Conforme cadastrado", margin + 30, y + 27);

    y += 46;

    // --- CONTEÚDO DO CONTRATO ---
    docPdf.setFontSize(11);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("CLAUSULAS E CONDICOES GERAIS", margin, y);
    docPdf.setDrawColor(197, 160, 89);
    docPdf.line(margin, y + 2, margin + 170, y + 2);
    
    y += 10;

    const textoClausulas = item.descricao || item.clausulas || "As partes acordam com os termos e relacao de pecas para locacao conforme vistoriado.";
    const linhas = docPdf.splitTextToSize(textoClausulas, 170);

    docPdf.setFontSize(9);
    docPdf.setFont("helvetica", "normal");
    docPdf.setTextColor(51, 65, 85);

    linhas.forEach(linha => {
      if (y > pageHeight - 40) {
        docPdf.addPage();
        y = 20;
      }
      docPdf.text(linha, margin, y);
      y += 5.5;
    });

    // --- ASSINATURA ---
    if (y > pageHeight - 55) {
      docPdf.addPage();
      y = 30;
    } else {
      y += 15;
    }

    docPdf.setDrawColor(203, 213, 225);
    docPdf.line(margin + 15, y + 15, margin + 75, y + 15);
    docPdf.line(margin + 95, y + 15, margin + 155, y + 15);

    docPdf.setFontSize(8.5);
    docPdf.setFont("helvetica", "bold");
    docPdf.setTextColor(15, 23, 42);
    docPdf.text(dadosEmpresa.nomeEmpresa, margin + 45, y + 20, { align: "center" });
    docPdf.text((item.cliente || "Locatario").toUpperCase(), margin + 125, y + 20, { align: "center" });

    if (item.status === 'Assinado' || item.assinaturaUrl) {
      docPdf.setFontSize(8);
      docPdf.setTextColor(22, 163, 74);
      docPdf.text("[ CONTRATO ASSINADO DIGITALMENTE ]", 105, y + 32, { align: "center" });
    }

    // ABERTURA NATIVA EM NOVA GUIA (SEM DOWNLOAD CEGO)
    const blobUrl = docPdf.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  // Cálculos de Indicadores KPIs
  const totalAssinados = useMemo(() => {
    return contratos.filter(c => {
      const s = String(c.status || '').toLowerCase();
      return s.includes('assinado') || c.assinaturaUrl;
    }).length;
  }, [contratos]);

  const totalPendentes = useMemo(() => {
    return contratos.filter(c => {
      const s = String(c.status || '').toLowerCase();
      return !s.includes('assinado') && !c.assinaturaUrl && !s.includes('cancelado');
    }).length;
  }, [contratos]);

  const totalVolume = useMemo(() => {
    return contratos.reduce((acc, c) => acc + Number(c.valorTotal || 0), 0);
  }, [contratos]);

  const taxaAssinatura = useMemo(() => {
    return contratos.length > 0 ? Math.round((totalAssinados / contratos.length) * 100) : 0;
  }, [contratos, totalAssinados]);

  const mesAtualStr = new Date().toISOString().substring(0, 7);
  const totalMesAtual = useMemo(() => {
    return contratos.filter(c => (c.dataEvento || '').startsWith(mesAtualStr)).length;
  }, [contratos, mesAtualStr]);

  // Filtragem de Contratos
  const contratosFiltrados = useMemo(() => {
    return contratos.filter(item => {
      // 1. Busca por texto
      if (termoBusca) {
        const termo = termoBusca.toLowerCase();
        const nomeMatch = (item.cliente || '').toLowerCase().includes(termo);
        const temaMatch = (item.tema || '').toLowerCase().includes(termo);
        const endMatch = (item.endereco || '').toLowerCase().includes(termo);
        const cpfMatch = (item.cpf || item.clienteCpf || '').includes(termo);
        if (!nomeMatch && !temaMatch && !endMatch && !cpfMatch) return false;
      }

      // 2. Filtro de status / período
      const statusStr = String(item.status || '').toLowerCase();
      const isAssinado = statusStr.includes('assinado') || !!item.assinaturaUrl;

      if (filtroStatus === 'assinados') return isAssinado;
      if (filtroStatus === 'pendentes') return !isAssinado;
      if (filtroStatus === 'mes_atual') return (item.dataEvento || '').startsWith(mesAtualStr);

      return true;
    });
  }, [contratos, termoBusca, filtroStatus, mesAtualStr]);

  // Locações filtradas no modal de importação
  const { totalLocacoesModal, totalOrcamentosModal, locacoesModalFiltradas } = useMemo(() => {
    // 1. Garante a exclusão estrita de devolvidos, finalizados e cancelados
    const ativas = listaLocacoes.filter(loc => {
      const s = String(loc.status || '').toLowerCase().trim();
      const ehFinalizado = ['devolvido', 'devolucao', 'finalizado', 'concluido', 'cancelado', 'estornado'].some(f => s.includes(f));
      return !ehFinalizado;
    });

    const totLoc = ativas.filter(l => !String(l.status || '').toLowerCase().includes('orcam')).length;
    const totOrc = ativas.filter(l => String(l.status || '').toLowerCase().includes('orcam')).length;

    let filtradas = ativas;

    // 2. Filtro por aba
    if (filtroTipoModal === 'locacao') {
      filtradas = filtradas.filter(l => !String(l.status || '').toLowerCase().includes('orcam'));
    } else if (filtroTipoModal === 'orcamento') {
      filtradas = filtradas.filter(l => String(l.status || '').toLowerCase().includes('orcam'));
    }

    // 3. Filtro por busca
    if (buscaLocacao) {
      const t = buscaLocacao.toLowerCase();
      filtradas = filtradas.filter(l => 
        (l.clienteNome || '').toLowerCase().includes(t) ||
        String(l.numeroPedido || '').toLowerCase().includes(t) ||
        (l.tema || l.temaFesta || '').toLowerCase().includes(t) ||
        (l.tipoServico || l.tipoServicoFormatado || '').toLowerCase().includes(t)
      );
    }

    return {
      totalLocacoesModal: totLoc,
      totalOrcamentosModal: totOrc,
      locacoesModalFiltradas: filtradas
    };
  }, [listaLocacoes, buscaLocacao, filtroTipoModal]);

  return (
    <div className="contratos-container fade-in">
      
      {/* 👑 CABEÇALHO EXECUTIVO PADRÃO CELEBRE */}
      <header className="contratos-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            <i className="fas fa-file-signature"></i>
          </div>
          <div className="welcome-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="contratos-badge-head">📜 GESTÃO &amp; FORMALIZAÇÃO JURÍDICA</span>
            </div>
            <h1>Gestão de Contratos</h1>
            <p>Documentos profissionais e assinaturas digitais da {dadosEmpresa.nomeEmpresa}.</p>
          </div>
        </div>

        <div className="header-actions-contratos">
          <button 
            type="button" 
            className="btn-contrato-primary" 
            onClick={() => navigate("/novo-contrato")}
            title="Criar novo contrato de locação"
          >
            + Criar Novo Contrato
          </button>

          <button 
            type="button" 
            className="btn-contrato-secondary" 
            onClick={() => navigate("/modelos-contrato")}
            title="Personalizar cláusulas e modelos contratuais"
          >
            📄 Modelos de Contrato
          </button>
        </div>
      </header>

      {/* 🔒 1. CARDS DE INDICADORES (KPIs) BLINDADOS (1 LINHA DESKTOP / 2 COLUNAS MOBILE) */}
      <div className="clientes-stats-grid">
        
        {/* CARD 1: TOTAL DE CONTRATOS */}
        <div className="stat-card-pro border-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-file-contract"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Total de Contratos</span>
            <span className="stat-value">{contratos.length}</span>
            <span className="stat-sub">{totalMesAtual} eventos neste mês</span>
          </div>
        </div>

        {/* CARD 2: CONTRATOS ASSINADOS */}
        <div className="stat-card-pro border-green">
          <div className="stat-icon-wrapper icon-green">
            <i className="fas fa-signature"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Assinados</span>
            <span className="stat-value" style={{ color: '#16a34a' }}>{totalAssinados}</span>
            <span className="stat-sub">{taxaAssinatura}% de taxa de formalização</span>
          </div>
        </div>

        {/* CARD 3: AGUARDANDO ASSINATURA */}
        <div className="stat-card-pro border-amber">
          <div className="stat-icon-wrapper icon-amber">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Aguardando Assinatura</span>
            <span className="stat-value" style={{ color: totalPendentes > 0 ? '#d97706' : '#64748b' }}>
              {totalPendentes}
            </span>
            <span className="stat-sub">{totalPendentes > 0 ? 'Pendentes de aceite' : 'Tudo formalizado'}</span>
          </div>
        </div>

        {/* CARD 4: VOLUME TOTAL (R$) */}
        <div className="stat-card-pro border-blue">
          <div className="stat-icon-wrapper icon-blue">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Volume em Contratos</span>
            <span className="stat-value" style={{ color: '#c5a059', fontSize: '1.35rem' }}>
              {Number(totalVolume).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="stat-sub">Soma financeira contratada</span>
          </div>
        </div>

      </div>

      {/* 🔍 2. BARRA DE BUSCA & FILTROS INTEGRADOS (PADRÃO CELEBRE) */}
      <div className="contratos-filter-panel">
        
        {/* BUSCA RÁPIDA */}
        <div className="contratos-search-wrapper">
          <span className="search-icon-contratos">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por cliente, tema, CPF ou endereço..." 
            value={termoBusca}
            onChange={e => setTermoBusca(e.target.value)}
            className="contratos-input-search"
          />
          {termoBusca && (
            <button 
              type="button" 
              onClick={() => setTermoBusca('')}
              className="btn-clear-search-contrato"
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        {/* PÍLULAS DE FILTRO */}
        <div className="segmented-tabs-contratos">
          <button 
            type="button" 
            className={`segmented-tab-contrato ${filtroStatus === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('todos')}
          >
            Todos ({contratos.length})
          </button>
          
          <button 
            type="button" 
            className={`segmented-tab-contrato ${filtroStatus === 'assinados' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('assinados')}
          >
            ✍️ Assinados ({totalAssinados})
          </button>

          <button 
            type="button" 
            className={`segmented-tab-contrato ${filtroStatus === 'pendentes' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('pendentes')}
          >
            ⏳ Pendentes ({totalPendentes})
          </button>

          <button 
            type="button" 
            className={`segmented-tab-contrato ${filtroStatus === 'mes_atual' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('mes_atual')}
          >
            📆 Este Mês ({totalMesAtual})
          </button>
        </div>

      </div>

      {/* 📜 LISTA DE CONTRATOS & EMPTY STATE LUXURY */}
      <div className="lista-container-contratos">
        {loading ? (
          <div className="carregando-contratos">
            <i className="fas fa-spinner fa-spin"></i> Carregando contratos e documentos...
          </div>
        ) : contratosFiltrados.length === 0 ? (
          <div className="empty-state-luxury">
            <div className="empty-state-icon-box">
              <i className="fas fa-file-signature"></i>
            </div>
            <h3>Nenhum contrato encontrado</h3>
            <p>
              {termoBusca || filtroStatus !== 'todos'
                ? "Nenhum documento corresponde aos filtros aplicados. Tente limpar a busca."
                : "Formalize os aluguéis e reservas de acervo gerando contratos profissionais com assinatura digital."}
            </p>
            <div className="empty-state-actions">
              <button 
                type="button" 
                className="btn-contrato-primary" 
                onClick={() => navigate("/novo-contrato")}
              >
                + Criar Primeiro Contrato
              </button>
              <button 
                type="button" 
                className="btn-contrato-accent" 
                onClick={abrirModalImportacao}
              >
                ⚡ Importar de um Pedido
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* VISUALIZAÇÃO DESKTOP: TABELA LUXURY */}
            <div className="tabela-contratos-wrapper desktop-only-view">
              <table className="tabela-contratos-luxury">
                <thead>
                  <tr>
                    <th>CLIENTE &amp; TEMA</th>
                    <th>DATA DO EVENTO</th>
                    <th>VALOR CONTRATADO</th>
                    <th>STATUS ASSINATURA</th>
                    <th style={{ textAlign: 'center', width: '220px' }}>AÇÕES RÁPIDAS</th>
                  </tr>
                </thead>
                <tbody>
                  {contratosFiltrados.map((item) => {
                    const isAssinado = String(item.status || '').toLowerCase().includes('assinado') || !!item.assinaturaUrl;
                    const dataFormatada = item.dataEvento ? item.dataEvento.split('-').reverse().join('/') : "--/--/----";

                    return (
                      <tr key={item.id} className="linha-contrato">
                        <td>
                          <div className="cliente-avatar-cell">
                            <div className="avatar-dourado-mini">
                              {(item.cliente || 'C').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="cliente-detalhes-cell">
                              <strong>{item.cliente || 'Consumidor'}</strong>
                              <span>{item.tema ? `Tema: ${item.tema}` : 'Locação de Acervo'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="data-evento-cell">
                            <strong>📅 {dataFormatada}</strong>
                            {item.horario && <small>{item.horario}</small>}
                          </div>
                        </td>
                        <td>
                          <strong className="valor-contrato-destaque">
                            {Number(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </strong>
                        </td>
                        <td>
                          <span className={`status-badge-luxury ${isAssinado ? 'assinado' : 'pendente'}`}>
                            {isAssinado ? '✍️ Assinado' : '⏳ Aguardando'}
                          </span>
                        </td>
                        
                        {/* AÇÕES DIRETAS (SEM PRECISAR DE 3 CLIQUES) */}
                        <td>
                          <div className="acoes-rapidas-contrato">
                            
                            {/* BOTÃO WHATSAPP */}
                            <button 
                              type="button" 
                              className="btn-acao-icone btn-acao-wpp" 
                              onClick={() => enviarWhatsAppAssinatura(item)}
                              title="Enviar link de assinatura no WhatsApp do cliente"
                            >
                              💬
                            </button>

                            {/* BOTÃO PDF */}
                            <button 
                              type="button" 
                              className="btn-acao-icone btn-acao-pdf" 
                              onClick={() => gerarPDF(item)}
                              title="Visualizar e Imprimir Contrato em PDF"
                            >
                              📄
                            </button>

                            {/* BOTÃO VISUALIZAR */}
                            <button 
                              type="button" 
                              className="btn-acao-icone btn-acao-view" 
                              onClick={() => navigate(`/visualizar/${item.id}`)}
                              title="Visualizar Contrato Completo"
                            >
                              👁️
                            </button>

                            {/* MENU DROPDOWN PARA OPÇÕES EXTRAS */}
                            <div className="dropdown-contrato-relativo">
                              <button 
                                type="button" 
                                className="btn-more-contrato" 
                                onClick={(e) => toggleMenu(e, item.id)}
                                title="Mais opções"
                              >
                                ⋮
                              </button>

                              {menuAberto === item.id && (
                                <div className="dropdown-menu-contrato">
                                  <button onClick={() => navigate(`/editar-contrato/${item.id}`)}>
                                    ✏️ Editar Contrato
                                  </button>
                                  
                                  <button onClick={() => navigate(`/assinatura/${item.id}`)}>
                                    🖋️ Assinar Agora
                                  </button>

                                  <button onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/assinatura/${item.id}`);
                                    alert("Link de assinatura copiado para a área de transferência!");
                                  }}>
                                    🔗 Copiar Link de Assinatura
                                  </button>
                                  
                                  <hr />
                                  
                                  <button 
                                    className="dropdown-item-danger" 
                                    onClick={() => handleExcluir(item.id, item.cliente)}
                                  >
                                    🗑️ Excluir Contrato
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISUALIZAÇÃO MOBILE: CARDS RESPONSIVOS */}
            <div className="cards-contratos-mobile mobile-only-view">
              {contratosFiltrados.map((item) => {
                const isAssinado = String(item.status || '').toLowerCase().includes('assinado') || !!item.assinaturaUrl;
                const dataFormatada = item.dataEvento ? item.dataEvento.split('-').reverse().join('/') : "--/--/----";

                return (
                  <div key={item.id} className="card-contrato-mobile">
                    <div className="card-mobile-header">
                      <div className="cliente-avatar-cell">
                        <div className="avatar-dourado-mini">
                          {(item.cliente || 'C').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong>{item.cliente}</strong>
                          <small>{item.tema || 'Locação de Acervo'}</small>
                        </div>
                      </div>
                      <span className={`status-badge-luxury ${isAssinado ? 'assinado' : 'pendente'}`}>
                        {isAssinado ? '✍️ Assinado' : '⏳ Aguardando'}
                      </span>
                    </div>

                    <div className="card-mobile-body">
                      <div className="mobile-info-row">
                        <span>📅 Evento:</span>
                        <strong>{dataFormatada}</strong>
                      </div>
                      <div className="mobile-info-row">
                        <span>💰 Valor:</span>
                        <strong style={{ color: '#c5a059' }}>
                          {Number(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                    </div>

                    <div className="card-mobile-actions">
                      <button 
                        type="button" 
                        className="btn-mob-wpp"
                        onClick={() => enviarWhatsAppAssinatura(item)}
                      >
                        💬 WhatsApp
                      </button>
                      <button 
                        type="button" 
                        className="btn-mob-pdf"
                        onClick={() => gerarPDF(item)}
                      >
                        📄 PDF
                      </button>
                      <button 
                        type="button" 
                        className="btn-mob-det"
                        onClick={() => navigate(`/visualizar/${item.id}`)}
                      >
                        🔍 Ver
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default Contratos;