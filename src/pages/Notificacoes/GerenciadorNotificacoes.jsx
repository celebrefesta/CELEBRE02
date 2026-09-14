import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  deleteDoc, 
  addDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  GATILHOS_PADRAO,
  TEMPLATES_PADRAO,
  TAGS_DISPONIVEIS,
  interpolarTags,
  carregarConfiguracoesNotificacoes,
  salvarConfiguracoesNotificacoes,
  carregarHistoricoDisparos,
  enviarDisparoTeste,
  gerarLinkWhatsAppNativo
} from '../../utils/notificacoesDispatchService';
import './GerenciadorNotificacoes.css';

const GerenciadorNotificacoes = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // Estado das Abas: 'alertas' | 'automacoes' | 'templates' | 'conexoes' | 'historico'
  const [abaAtiva, setAbaAtiva] = useState('alertas');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  // Aba 1: Alertas Operacionais (Inbox de clientes e orçamentos)
  const [listaAlertas, setListaAlertas] = useState([]);
  const [filtroAlerta, setFiltroAlerta] = useState('todos');

  // Configurações Globais (Gatilhos, Templates, Provedores)
  const [config, setConfig] = useState({
    gatilhos: {},
    templates: TEMPLATES_PADRAO,
    provedores: {
      whatsappModo: 'nativo',
      whatsappApiUrl: '',
      whatsappApiKey: '',
      emailRemetente: 'seguranca@celebrefesta.com.br',
      smsAtivo: false
    }
  });

  // Dados da Empresa (para tags e testes)
  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Celebre Festas',
    telefoneEmpresa: '(19) 99856-4109',
    chavePix: '(19) 99856-4109',
    enderecoGalpao: 'Galpão Principal de Festas'
  });

  // Aba 3: Editor de Templates
  const [eventoSelecionado, setEventoSelecionado] = useState('lembrete_retirada');
  const [canalTemplate, setCanalTemplate] = useState('whatsapp'); // 'whatsapp' | 'email' | 'sms'
  const textareaRef = useRef(null);

  // Aba 4: Teste de Disparo
  const [testeCanal, setTesteCanal] = useState('whatsapp');
  const [testeContato, setTesteContato] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);

  // Aba 5: Histórico de Disparos
  const [historico, setHistorico] = useState([]);
  const [filtroCanalHist, setFiltroCanalHist] = useState('todos');
  const [loadingHist, setLoadingHist] = useState(false);

  // Mostra notificação toast temporária
  const exibirToast = (msg, tipo = 'sucesso') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // Registrar auditoria no logs_atividades
  const registrarLogAuditoria = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (e) {
      console.warn("Aviso ao registrar log de auditoria:", e);
    }
  };

  // Carrega dados iniciais da tela
  const carregarTudo = async () => {
    if (!usuarioLogado || !tenantId) return;
    setLoading(true);
    try {
      // 1. Carrega dados da empresa
      try {
        const empSnap = await getDoc(doc(db, 'empresas', tenantId));
        if (empSnap.exists()) {
          const empData = empSnap.data();
          setDadosEmpresa({
            nomeEmpresa: empData.nomeFantasia || empData.nomeEmpresa || 'Celebre Festas',
            telefoneEmpresa: empData.telefone || empData.whatsapp || '(19) 99856-4109',
            chavePix: empData.chavePix || empData.pix || '(19) 99856-4109',
            enderecoGalpao: empData.enderecoCompleto || empData.endereco || 'Galpão Celebre'
          });
        }
      } catch (eEmp) {
        console.warn('Aviso ao carregar dados da empresa:', eEmp);
      }

      // 2. Carrega Alertas Operacionais (Clientes Pendentes + Orçamentos Web)
      const qClientes = query(
        collection(db, "clientes"),
        where("situacaoFinanceira", "==", "pendente"),
        where("userId", "==", tenantId)
      );
      const snapClientes = await getDocs(qClientes);
      const listaC = snapClientes.docs.map(d => ({
        id: d.id,
        tipoNotificacao: 'cliente',
        ...d.data(),
        timestampOrdenacao: d.data().criadoEm?.toMillis ? d.data().criadoEm.toMillis() : Date.now()
      }));

      const qPedidos = query(
        collection(db, "locacoes"),
        where("origem", "==", "catalogo_publico"),
        where("status", "==", "orcamento"),
        where("userId", "==", tenantId)
      );
      const snapPedidos = await getDocs(qPedidos);
      const listaP = snapPedidos.docs.map(d => ({
        id: d.id,
        tipoNotificacao: 'orcamento',
        ...d.data(),
        timestampOrdenacao: d.data().criadoEm?.toMillis ? d.data().criadoEm.toMillis() : Date.now()
      }));

      const unificados = [...listaC, ...listaP].sort((a, b) => b.timestampOrdenacao - a.timestampOrdenacao);
      setListaAlertas(unificados);

      // 3. Carrega Configurações de Notificações
      const cfg = await carregarConfiguracoesNotificacoes(tenantId);
      setConfig(cfg);

      // 4. Carrega Histórico
      const hist = await carregarHistoricoDisparos(tenantId, 60);
      setHistorico(hist);
    } catch (err) {
      console.error('Erro ao carregar dados do Gerenciador de Notificações:', err);
      exibirToast('Não foi possível carregar todas as notificações.', 'erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
      navigate('/login');
      return;
    }
    carregarTudo();
  }, [usuarioLogado, tenantId]);

  // Recarregar histórico sob demanda
  const recarregarHistorico = async () => {
    setLoadingHist(true);
    try {
      const hist = await carregarHistoricoDisparos(tenantId, 60);
      setHistorico(hist);
      exibirToast('Histórico atualizado com sucesso!');
    } catch (e) {
      exibirToast('Erro ao atualizar histórico.', 'erro');
    } finally {
      setLoadingHist(false);
    }
  };

  // Salvar configurações no Firestore
  const handleSalvarConfig = async () => {
    setSalvando(true);
    try {
      await salvarConfiguracoesNotificacoes(tenantId, config);
      await registrarLogAuditoria('CONFIGURAÇÃO DE NOTIFICAÇÕES', 'Atualizou gatilhos e modelos de automações do sistema.');
      exibirToast('Configurações e templates salvos com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      exibirToast('Erro ao salvar alterações.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  // Manipulação de Switches de Gatilhos
  const toggleGatilhoCanal = (gatilhoId, canal) => {
    setConfig(prev => {
      const gatilhosAtuais = prev.gatilhos || {};
      const canaisDoGatilho = gatilhosAtuais[gatilhoId] || { whatsapp: true, email: true, sms: false };
      const novoValor = !canaisDoGatilho[canal];

      return {
        ...prev,
        gatilhos: {
          ...gatilhosAtuais,
          [gatilhoId]: {
            ...canaisDoGatilho,
            [canal]: novoValor
          }
        }
      };
    });
  };

  // Manipulação de Template Ativo
  const templateAtivo = useMemo(() => {
    const tplEvt = config.templates?.[eventoSelecionado] || TEMPLATES_PADRAO[eventoSelecionado] || {};
    return tplEvt;
  }, [config.templates, eventoSelecionado]);

  const atualizarTextoTemplate = (campo, valor) => {
    setConfig(prev => {
      const tpls = { ...(prev.templates || TEMPLATES_PADRAO) };
      const evtTpl = { ...(tpls[eventoSelecionado] || TEMPLATES_PADRAO[eventoSelecionado] || {}) };
      evtTpl[campo] = valor;
      tpls[eventoSelecionado] = evtTpl;
      return { ...prev, templates: tpls };
    });
  };

  // Inserir Tag Dinâmica na posição do cursor do Textarea
  const inserirTagNoTexto = (tagStr) => {
    const textarea = textareaRef.current;
    const campo = canalTemplate === 'email' ? 'emailCorpo' : canalTemplate;
    const textoAtual = templateAtivo[campo] || '';

    if (!textarea) {
      atualizarTextoTemplate(campo, textoAtual + ' ' + tagStr);
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const novoTexto = textoAtual.substring(0, start) + tagStr + textoAtual.substring(end);

    atualizarTextoTemplate(campo, novoTexto);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagStr.length, start + tagStr.length);
    }, 50);
  };

  // Prévia Simulada no Celular
  const previewMensagemSimulada = useMemo(() => {
    const dadosExemplo = {
      nomeCliente: 'Juliana Mendes',
      numeroPedido: '2026-089',
      dataEvento: '28/09/2026',
      dataRetirada: '27/09/2026',
      dataDevolucao: '29/09/2026',
      horarioRetirada: '09h30 às 16h30',
      horarioDevolucao: '17h00',
      valorTotal: '1.280,00',
      chavePix: dadosEmpresa.chavePix || '(19) 99856-4109',
      linkContrato: 'https://celebrefesta.com.br/assinar/exemplo',
      nomeEmpresa: dadosEmpresa.nomeEmpresa || 'Celebre Festas',
      telefoneEmpresa: dadosEmpresa.telefoneEmpresa || '(19) 99856-4109',
      enderecoGalpao: dadosEmpresa.enderecoGalpao || 'Rua Central das Festas, 100 - Galpão 01'
    };

    if (canalTemplate === 'email') {
      const corpo = templateAtivo.emailCorpo || '';
      return interpolarTags(corpo.replace(/<[^>]*>?/gm, ''), dadosExemplo);
    }

    const texto = templateAtivo[canalTemplate] || '';
    return interpolarTags(texto, dadosExemplo);
  }, [canalTemplate, templateAtivo, dadosEmpresa]);

  // Ações da Aba 1 (Aprovar / Recusar Cliente)
  const aprovarCliente = async (id, nomeCliente) => {
    try {
      await updateDoc(doc(db, "clientes", id), {
        situacaoFinanceira: 'adimplente',
        statusAprovacao: 'aprovado'
      });
      await registrarLogAuditoria("APROVAÇÃO DE CLIENTE", `Aprovou o cadastro do novo cliente: "${nomeCliente || 'Desconhecido'}".`);
      exibirToast(`Cliente ${nomeCliente || ''} aprovado com sucesso!`);
      carregarTudo();
    } catch (error) {
      console.error("Erro ao aprovar cliente:", error);
      exibirToast("Erro ao aprovar cliente.", "erro");
    }
  };

  const recusarCliente = async (id, nomeCliente) => {
    const confirmar = window.confirm(`Tem certeza que deseja recusar e excluir o cadastro de "${nomeCliente || 'este cliente'}" definitivamente?`);
    if (confirmar) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        await registrarLogAuditoria("RECUSA DE CLIENTE", `Recusou e excluiu o cadastro do cliente: "${nomeCliente || 'Desconhecido'}".`);
        exibirToast("Cadastro recusado e removido.", "aviso");
        carregarTudo();
      } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        exibirToast("Erro ao excluir cliente.", "erro");
      }
    }
  };

  // Disparo de Teste (Aba 4)
  const handleDispararTeste = async () => {
    if (!testeContato.trim()) {
      exibirToast(`Informe o ${testeCanal === 'email' ? 'e-mail' : 'número de WhatsApp'} para teste.`, 'aviso');
      return;
    }

    setEnviandoTeste(true);
    try {
      await enviarDisparoTeste({
        canal: testeCanal,
        contato: testeContato.trim(),
        tenantId,
        dadosEmpresa
      });

      if (testeCanal === 'whatsapp') {
        exibirToast('Conversa de teste aberta no WhatsApp!');
      } else if (testeCanal === 'email') {
        exibirToast('E-mail oficial de teste enviado via Resend!');
      } else {
        exibirToast('Disparo de SMS registrado com sucesso!');
      }

      // Recarrega histórico
      const hist = await carregarHistoricoDisparos(tenantId, 60);
      setHistorico(hist);
    } catch (err) {
      console.error('Erro no disparo de teste:', err);
      exibirToast(`Erro no envio: ${err.message}`, 'erro');
    } finally {
      setEnviandoTeste(false);
    }
  };

  // Cálculo dos KPIs (Regra de Ouro)
  const statsKPI = useMemo(() => {
    const totalPendentes = listaAlertas.length;
    
    // Contagem de gatilhos com pelo menos 1 canal ativo
    let gatilhosAtivos = 0;
    GATILHOS_PADRAO.forEach(g => {
      const canais = config.gatilhos?.[g.id] || g.canais;
      if (canais.whatsapp || canais.email || canais.sms) {
        gatilhosAtivos++;
      }
    });

    const totalDisparos = historico.length;
    const sucessos = historico.filter(h => h.status === 'sucesso').length;
    const taxaEntrega = totalDisparos > 0 ? ((sucessos / totalDisparos) * 100).toFixed(1) : '100';

    return {
      totalPendentes,
      gatilhosAtivos,
      totalDisparos,
      taxaEntrega: `${taxaEntrega}%`
    };
  }, [listaAlertas, config.gatilhos, historico]);

  // Filtro de Alertas
  const alertasFiltrados = useMemo(() => {
    if (filtroAlerta === 'todos') return listaAlertas;
    return listaAlertas.filter(item => item.tipoNotificacao === filtroAlerta);
  }, [listaAlertas, filtroAlerta]);

  // Filtro de Histórico
  const historicoFiltrado = useMemo(() => {
    if (filtroCanalHist === 'todos') return historico;
    return historico.filter(h => h.canal === filtroCanalHist);
  }, [historico, filtroCanalHist]);

  return (
    <div className="noti-mgmt-container fade-in">
      <div className="noti-mgmt-max-width">
        
        {/* Toast Notifier */}
        {toast && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toast.tipo === 'erro' ? '#ef4444' : (toast.tipo === 'aviso' ? '#f59e0b' : '#10b981'),
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '13.5px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeIn 0.25s ease'
          }}>
            <span>{toast.tipo === 'erro' ? '⚠️' : (toast.tipo === 'aviso' ? '🔔' : '✓')}</span>
            <span>{toast.msg}</span>
          </div>
        )}

        {/* CABEÇALHO DA PÁGINA */}
        <div className="noti-mgmt-header">
          <div className="noti-mgmt-header-left">
            <div className="noti-mgmt-icon-box">
              <i className="fa-solid fa-bell"></i>
            </div>
            <div className="noti-mgmt-titles">
              <h1>
                Gerenciador de Notificações & Automações
                <span className="noti-mgmt-badge-vip">Omnichannel VIP</span>
              </h1>
              <p>Controle central de alertas operacionais, gatilhos de WhatsApp, E-mail e SMS, templates e histórico auditável.</p>
            </div>
          </div>

          <div className="noti-mgmt-header-actions">
            <button 
              className="noti-mgmt-btn-action outline" 
              onClick={() => { setAbaAtiva('conexoes'); }}
              title="Ir para tela de disparos e conexões"
            >
              <i className="fa-solid fa-paper-plane"></i>
              Disparo de Teste
            </button>
            <button 
              className="noti-mgmt-btn-action gold" 
              onClick={handleSalvarConfig}
              disabled={salvando}
            >
              <i className={`fa-solid ${salvando ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* 🔒 CARDS KPI — REGRA DE OURO CELEBRE (1 LINHA DESKTOP / 2 COLUNAS MOBILE) */}
        <div className="clientes-stats-grid">
          {/* Card 1: Alertas Pendentes */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Alertas Pendentes</span>
              <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                <i className="fa-solid fa-inbox"></i>
              </div>
            </div>
            <div className="stat-card-value">{statsKPI.totalPendentes}</div>
            <div className="stat-card-sub">
              {statsKPI.totalPendentes === 0 ? '✓ Caixa limpa e em dia' : 'Requer ação da equipe'}
            </div>
          </div>

          {/* Card 2: Automações Ativas */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Gatilhos Ativos</span>
              <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                <i className="fa-solid fa-bolt"></i>
              </div>
            </div>
            <div className="stat-card-value">{statsKPI.gatilhosAtivos} / {GATILHOS_PADRAO.length}</div>
            <div className="stat-card-sub">Automações ligadas</div>
          </div>

          {/* Card 3: Disparos Realizados */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Disparos Auditados</span>
              <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                <i className="fa-solid fa-paper-plane"></i>
              </div>
            </div>
            <div className="stat-card-value">{statsKPI.totalDisparos}</div>
            <div className="stat-card-sub">WhatsApp, E-mail e SMS</div>
          </div>

          {/* Card 4: Taxa de Entrega */}
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Taxa de Entrega</span>
              <div className="stat-card-icon" style={{ background: 'rgba(197, 160, 89, 0.15)', color: 'var(--dourado, #c5a059)' }}>
                <i className="fa-solid fa-circle-check"></i>
              </div>
            </div>
            <div className="stat-card-value">{statsKPI.taxaEntrega}</div>
            <div className="stat-card-sub">Disparos com sucesso</div>
          </div>
        </div>

        {/* NAVEGADOR DE ABAS PRINCIPAL */}
        <div className="noti-tabs-bar">
          <button 
            className={`noti-tab-btn ${abaAtiva === 'alertas' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('alertas')}
          >
            <i className="fa-solid fa-inbox"></i>
            Alertas Operacionais
            {statsKPI.totalPendentes > 0 && (
              <span className="noti-tab-badge">{statsKPI.totalPendentes}</span>
            )}
          </button>

          <button 
            className={`noti-tab-btn ${abaAtiva === 'automacoes' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('automacoes')}
          >
            <i className="fa-solid fa-bolt"></i>
            Automações & Gatilhos
          </button>

          <button 
            className={`noti-tab-btn ${abaAtiva === 'templates' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('templates')}
          >
            <i className="fa-solid fa-file-lines"></i>
            Modelos de Mensagem (Templates)
          </button>

          <button 
            className={`noti-tab-btn ${abaAtiva === 'conexoes' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('conexoes')}
          >
            <i className="fa-solid fa-plug"></i>
            Canais & Conexões
          </button>

          <button 
            className={`noti-tab-btn ${abaAtiva === 'historico' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('historico')}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            Histórico de Disparos
          </button>
        </div>

        {/* CORPO DE CONTEÚDO DAS ABAS */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', color: 'var(--dourado, #c5a059)', marginBottom: '14px' }}></i>
            <p style={{ fontWeight: 600 }}>Carregando central de notificações...</p>
          </div>
        ) : (
          <>
            {/* ================================================================
                ABA 1: ALERTAS OPERACIONAIS (INBOX)
               ================================================================ */}
            {abaAtiva === 'alertas' && (
              <div className="noti-inbox-section">
                <div className="noti-inbox-toolbar">
                  <div className="noti-inbox-filter-chips">
                    <button 
                      className={`noti-inbox-chip ${filtroAlerta === 'todos' ? 'active' : ''}`}
                      onClick={() => setFiltroAlerta('todos')}
                    >
                      Todos ({listaAlertas.length})
                    </button>
                    <button 
                      className={`noti-inbox-chip ${filtroAlerta === 'cliente' ? 'active' : ''}`}
                      onClick={() => setFiltroAlerta('cliente')}
                    >
                      👤 Cadastros Pendentes ({listaAlertas.filter(i => i.tipoNotificacao === 'cliente').length})
                    </button>
                    <button 
                      className={`noti-inbox-chip ${filtroAlerta === 'orcamento' ? 'active' : ''}`}
                      onClick={() => setFiltroAlerta('orcamento')}
                    >
                      🛍️ Orçamentos Web ({listaAlertas.filter(i => i.tipoNotificacao === 'orcamento').length})
                    </button>
                  </div>

                  <button 
                    className="noti-btn-action-small dismiss" 
                    onClick={carregarTudo}
                    title="Atualizar lista de alertas"
                  >
                    <i className="fa-solid fa-rotate-right"></i> Atualizar
                  </button>
                </div>

                <div className="noti-inbox-cards-grid">
                  {alertasFiltrados.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '50px 20px',
                      background: 'var(--fundo-card, #ffffff)',
                      borderRadius: '16px',
                      border: '1px solid var(--borda, #e2e8f0)',
                      color: '#64748b'
                    }}>
                      <span style={{ fontSize: '42px', display: 'block', marginBottom: '12px' }}>🎉</span>
                      <h3 style={{ margin: '0 0 6px 0', color: 'var(--texto-principal, #0f172a)' }}>Caixa de entrada 100% limpa!</h3>
                      <p style={{ margin: 0, fontSize: '13.5px' }}>Nenhum novo cliente ou orçamento web pendente de aprovação no momento.</p>
                    </div>
                  ) : (
                    alertasFiltrados.map(item => {
                      if (item.tipoNotificacao === 'cliente') {
                        const tel = item.contato || item.celular || item.telefone || '';
                        return (
                          <div key={`cli-${item.id}`} className="noti-inbox-card">
                            <div className="noti-inbox-card-left">
                              <div className="noti-inbox-card-icon" style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#ea580c' }}>
                                <i className="fa-solid fa-user-plus"></i>
                              </div>
                              <div className="noti-inbox-card-texts">
                                <div className="noti-inbox-card-title-row">
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    background: 'rgba(249, 115, 22, 0.12)',
                                    color: '#ea580c',
                                    padding: '2px 8px',
                                    borderRadius: '6px'
                                  }}>
                                    Novo Cadastro
                                  </span>
                                  <strong>{item.nome || item.nomeCompleto || 'Cliente sem nome'}</strong>
                                  <span className="noti-inbox-card-time">
                                    {item.cidade ? `${item.cidade} - ${item.estado || 'SP'}` : 'Pendente de validação'}
                                  </span>
                                </div>
                                <div className="noti-inbox-card-desc">
                                  WhatsApp: <strong>{tel || 'Não informado'}</strong> • CPF/CNPJ: {item.cpf || item.cnpj || 'Não informado'}
                                </div>
                              </div>
                            </div>

                            <div className="noti-inbox-card-actions">
                              <button 
                                className="noti-btn-action-small view" 
                                onClick={() => navigate('/cadastro-cliente', { state: { clienteEditando: item } })}
                              >
                                <i className="fa-solid fa-eye"></i> Revisar
                              </button>
                              <button 
                                className="noti-btn-action-small dismiss" 
                                onClick={() => recusarCliente(item.id, item.nome || item.nomeCompleto)}
                              >
                                <i className="fa-solid fa-xmark"></i> Recusar
                              </button>
                              <button 
                                className="noti-btn-action-small approve" 
                                onClick={() => aprovarCliente(item.id, item.nome || item.nomeCompleto)}
                              >
                                <i className="fa-solid fa-check"></i> Aprovar
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (item.tipoNotificacao === 'orcamento') {
                        return (
                          <div key={`orc-${item.id}`} className="noti-inbox-card">
                            <div className="noti-inbox-card-left">
                              <div className="noti-inbox-card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
                                <i className="fa-solid fa-cart-shopping"></i>
                              </div>
                              <div className="noti-inbox-card-texts">
                                <div className="noti-inbox-card-title-row">
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    background: 'rgba(59, 130, 246, 0.12)',
                                    color: '#2563eb',
                                    padding: '2px 8px',
                                    borderRadius: '6px'
                                  }}>
                                    Orçamento Web (Vitrine)
                                  </span>
                                  <strong>{item.clienteNome || 'Cliente da Vitrine'}</strong>
                                  <span className="noti-inbox-card-time">
                                    {item.itens?.length || 0} itens selecionados
                                  </span>
                                </div>
                                <div className="noti-inbox-card-desc">
                                  Retirada: <strong>{item.dataRetirada ? item.dataRetirada.split('-').reverse().join('/') : 'S/D'}</strong> • Estimativa: <strong style={{ color: 'var(--dourado, #c5a059)' }}>R$ {Number(item.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="noti-inbox-card-actions">
                              <button 
                                className="noti-btn-action-small view" 
                                onClick={() => navigate(`/locacoes/editar/${item.id}`)}
                              >
                                <i className="fa-solid fa-arrow-up-right-from-square"></i> Abrir Pedido
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })
                  )}
                </div>
              </div>
            )}

            {/* ================================================================
                ABA 2: AUTOMAÇÕES & GATILHOS (SWITCHES)
               ================================================================ */}
            {abaAtiva === 'automacoes' && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '18px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--texto-principal, #0f172a)' }}>
                      Regras de Disparo Automático
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Ative ou desative os canais de envio para cada evento do ciclo de vida da locação.
                    </p>
                  </div>
                  <button 
                    className="noti-mgmt-btn-action gold" 
                    onClick={handleSalvarConfig}
                    disabled={salvando}
                  >
                    <i className="fa-solid fa-floppy-disk"></i>
                    Salvar Regras de Automação
                  </button>
                </div>

                <div className="noti-triggers-grid">
                  {GATILHOS_PADRAO.map(gatilho => {
                    const canaisAtuais = config.gatilhos?.[gatilho.id] || gatilho.canais;

                    return (
                      <div key={gatilho.id} className="noti-trigger-card">
                        <div className="noti-trigger-header">
                          <div className="noti-trigger-icon" style={{ background: `${gatilho.cor}20`, color: gatilho.cor }}>
                            <i className={`fa-solid ${gatilho.icone}`}></i>
                          </div>
                          <div className="noti-trigger-info">
                            <h3>{gatilho.titulo}</h3>
                            <p>{gatilho.descricao}</p>
                          </div>
                        </div>

                        <div className="noti-trigger-channels-row">
                          {/* Canal WhatsApp */}
                          <label className="noti-channel-toggle" title="Disparar via WhatsApp">
                            <i className="fa-brands fa-whatsapp" style={{ color: '#25d366', fontSize: '16px' }}></i>
                            <span>WhatsApp</span>
                            <div className="noti-switch">
                              <input 
                                type="checkbox" 
                                checked={!!canaisAtuais.whatsapp}
                                onChange={() => toggleGatilhoCanal(gatilho.id, 'whatsapp')}
                              />
                              <span className="noti-slider"></span>
                            </div>
                          </label>

                          {/* Canal E-mail */}
                          <label className="noti-channel-toggle" title="Disparar via E-mail Resend">
                            <i className="fa-solid fa-envelope" style={{ color: '#3b82f6', fontSize: '15px' }}></i>
                            <span>E-mail</span>
                            <div className="noti-switch">
                              <input 
                                type="checkbox" 
                                checked={!!canaisAtuais.email}
                                onChange={() => toggleGatilhoCanal(gatilho.id, 'email')}
                              />
                              <span className="noti-slider"></span>
                            </div>
                          </label>

                          {/* Canal SMS */}
                          <label className="noti-channel-toggle" title="Disparar via SMS Transacional">
                            <i className="fa-solid fa-comment-sms" style={{ color: '#a855f7', fontSize: '15px' }}></i>
                            <span>SMS</span>
                            <div className="noti-switch">
                              <input 
                                type="checkbox" 
                                checked={!!canaisAtuais.sms}
                                onChange={() => toggleGatilhoCanal(gatilho.id, 'sms')}
                              />
                              <span className="noti-slider"></span>
                            </div>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================================================================
                ABA 3: MODELOS DE MENSAGEM (TEMPLATES COM SMARTPHONE SIMULATOR)
               ================================================================ */}
            {abaAtiva === 'templates' && (
              <div className="noti-templates-layout">
                {/* Editor à Esquerda */}
                <div className="noti-template-editor-card">
                  <div style={{ marginBottom: '18px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Editor de Conteúdo</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Personalize o texto enviado em cada canal usando as tags dinâmicas que são substituídas pelos dados reais da locação.
                    </p>
                  </div>

                  <div className="noti-template-selector-row">
                    <div className="noti-form-field">
                      <label>Selecione o Evento</label>
                      <select 
                        className="noti-select"
                        value={eventoSelecionado}
                        onChange={(e) => setEventoSelecionado(e.target.value)}
                      >
                        {GATILHOS_PADRAO.map(g => (
                          <option key={g.id} value={g.id}>{g.titulo}</option>
                        ))}
                      </select>
                    </div>

                    <div className="noti-form-field">
                      <label>Canal de Comunicação</label>
                      <select 
                        className="noti-select"
                        value={canalTemplate}
                        onChange={(e) => setCanalTemplate(e.target.value)}
                      >
                        <option value="whatsapp">WhatsApp (Texto & Emojis)</option>
                        <option value="email">E-mail (Assunto & Corpo)</option>
                        <option value="sms">SMS (Texto Curto)</option>
                      </select>
                    </div>
                  </div>

                  {/* Campos Específicos para E-mail */}
                  {canalTemplate === 'email' && (
                    <div className="noti-form-field" style={{ marginBottom: '16px' }}>
                      <label>Assunto do E-mail</label>
                      <input 
                        type="text" 
                        className="noti-input"
                        value={templateAtivo.emailAssunto || ''}
                        onChange={(e) => atualizarTextoTemplate('emailAssunto', e.target.value)}
                        placeholder="Ex: 🎉 Lembrete: A retirada do seu acervo é amanhã! • {nome_empresa}"
                      />
                    </div>
                  )}

                  {/* Tags Dinâmicas Clicáveis */}
                  <div className="noti-tags-container">
                    <div className="noti-tags-title">
                      <i className="fa-solid fa-tags" style={{ color: 'var(--dourado, #c5a059)' }}></i>
                      <span>Clique para inserir variáveis automáticas no texto:</span>
                    </div>
                    <div className="noti-tags-pills">
                      {TAGS_DISPONIVEIS.map(t => (
                        <button 
                          key={t.tag}
                          type="button"
                          className="noti-tag-pill"
                          onClick={() => inserirTagNoTexto(t.tag)}
                          title={`Exemplo: ${t.exemplo}`}
                        >
                          + {t.tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Textarea de Edição */}
                  <div className="noti-form-field">
                    <label>
                      {canalTemplate === 'email' ? 'Corpo da Mensagem (HTML ou Texto)' : 'Mensagem do Modelo'}
                    </label>
                    <textarea 
                      ref={textareaRef}
                      className="noti-textarea"
                      value={canalTemplate === 'email' ? (templateAtivo.emailCorpo || '') : (templateAtivo[canalTemplate] || '')}
                      onChange={(e) => {
                        const campo = canalTemplate === 'email' ? 'emailCorpo' : canalTemplate;
                        atualizarTextoTemplate(campo, e.target.value);
                      }}
                      placeholder="Digite aqui o modelo de mensagem..."
                    />
                  </div>

                  <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button 
                      className="noti-mgmt-btn-action gold"
                      onClick={handleSalvarConfig}
                      disabled={salvando}
                    >
                      <i className="fa-solid fa-floppy-disk"></i> Salvar Template
                    </button>
                  </div>
                </div>

                {/* Simulador de Smartphone à Direita */}
                <div className="noti-phone-simulator">
                  <div className="noti-phone-screen">
                    <div className="noti-phone-whatsapp-header">
                      <div className="noti-phone-contact-info">
                        <div className="noti-phone-avatar">
                          {dadosEmpresa.nomeEmpresa ? dadosEmpresa.nomeEmpresa.substring(0, 2).toUpperCase() : 'CF'}
                        </div>
                        <div className="noti-phone-contact-texts">
                          <strong>{dadosEmpresa.nomeEmpresa || 'Celebre Festas'}</strong>
                          <small>online agora • Conta Comercial</small>
                        </div>
                      </div>
                      <div>
                        <i className="fa-solid fa-ellipsis-vertical" style={{ opacity: 0.8 }}></i>
                      </div>
                    </div>

                    <div className="noti-phone-chat-body">
                      <div className="noti-chat-bubble">
                        {previewMensagemSimulada}
                        <div className="noti-chat-bubble-time">
                          12:00 ✓✓
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
                    Simulador em tempo real com dados de exemplo
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================
                ABA 4: CANAIS & CONEXÕES + TESTE INSTANTÂNEO
               ================================================================ */}
            {abaAtiva === 'conexoes' && (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Infraestrutura & Canais de Envio</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Conectores oficiais para WhatsApp, E-mail corporativo de alta entregabilidade e SMS.
                  </p>
                </div>

                <div className="noti-connections-grid">
                  {/* Card WhatsApp — Configuração completa de modo de envio */}
                  <div className="noti-channel-card" style={{ gridColumn: '1 / -1' }}>
                    <div>
                      <div className="noti-channel-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <i className="fa-brands fa-whatsapp" style={{ color: '#25d366', fontSize: '28px' }}></i>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>WhatsApp — Modo de Envio</h3>
                            <small style={{ color: '#64748b' }}>Configure entre 1-Clique Nativo ou API 100% Automática</small>
                          </div>
                        </div>
                        <span className={`noti-channel-card-badge ${config.provedores?.whatsappModo === 'api' ? 'active' : 'testing'}`}>
                          {config.provedores?.whatsappModo === 'api' ? '🤖 Automático' : '👆 1-Clique'}
                        </span>
                      </div>

                      {/* Aviso explicativo */}
                      <div style={{ background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.25)', borderLeft: '4px solid #ef4444', borderRadius: '10px', padding: '12px 14px', margin: '14px 0', display: 'flex', gap: '10px' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--texto-principal, #0f172a)', display: 'block', marginBottom: '3px' }}>Por que a mensagem não envia sozinha no modo Nativo?</strong>
                          <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--texto-secundario, #475569)', lineHeight: 1.6 }}>
                            O link <code>wa.me</code> abre o WhatsApp com a mensagem <em>pré-digitada</em>, mas o <strong>WhatsApp exige interação humana</strong> para clicar em Enviar — é uma medida de segurança da Meta para evitar spam. Para envio <strong>100% automático sem clicar</strong>, é necessário contratar uma <strong>API de WhatsApp</strong> abaixo.
                          </p>
                        </div>
                      </div>

                      {/* Seleção de Modo */}
                      <div style={{ display: 'flex', gap: '10px', margin: '16px 0' }}>
                        {[
                          { val: 'nativo', label: '👆 1-Clique Nativo', desc: 'Gratuito, requer clique manual para enviar' },
                          { val: 'api', label: '🤖 API Automática', desc: 'Envio automático, requer assinatura de API' }
                        ].map(opt => (
                          <button key={opt.val} type="button"
                            onClick={async () => {
                              const novosProv = { ...config.provedores, whatsappModo: opt.val };
                              setConfig(prev => ({ ...prev, provedores: novosProv }));
                              await salvarConfiguracoesNotificacoes(tenantId, { ...config, provedores: novosProv });
                            }}
                            style={{
                              flex: 1, padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                              border: `2px solid ${config.provedores?.whatsappModo === opt.val ? '#25d366' : 'var(--borda, #e2e8f0)'}`,
                              background: config.provedores?.whatsappModo === opt.val ? 'rgba(37,211,102,0.1)' : 'var(--fundo-card, #fff)',
                              color: config.provedores?.whatsappModo === opt.val ? '#16a34a' : 'var(--texto-secundario, #64748b)',
                              fontWeight: '800', fontSize: '0.84rem', textAlign: 'center', transition: 'all 0.18s'
                            }}>
                            <div>{opt.label}</div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.75, marginTop: '3px' }}>{opt.desc}</div>
                          </button>
                        ))}
                      </div>

                      {/* Painel de configuração da API (só quando modo = api) */}
                      {config.provedores?.whatsappModo === 'api' && (
                        <div style={{ background: 'var(--fundo, #f8fafc)', border: '1px solid var(--borda, #e2e8f0)', borderRadius: '12px', padding: '16px', marginTop: '4px' }}>

                          {/* Seleção de Provedor */}
                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--texto-secundario, #475569)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                              Provedor de API WhatsApp
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {[
                                { val: 'zapi', label: 'Z-API', sub: 'R$49/mês • Recomendado BR', cor: '#10b981' },
                                { val: 'evolution', label: 'Evolution API', sub: 'Gratuito • Self-hosted', cor: '#8b5cf6' },
                                { val: 'twilio', label: 'Twilio WhatsApp', sub: 'Internacional • Pay-as-go', cor: '#ef4444' }
                              ].map(p => (
                                <button key={p.val} type="button"
                                  onClick={async () => {
                                    const novosProv = { ...config.provedores, whatsappProvider: p.val };
                                    setConfig(prev => ({ ...prev, provedores: novosProv }));
                                    await salvarConfiguracoesNotificacoes(tenantId, { ...config, provedores: novosProv });
                                  }}
                                  style={{
                                    padding: '9px 16px', borderRadius: '8px', cursor: 'pointer',
                                    border: `2px solid ${(config.provedores?.whatsappProvider || 'zapi') === p.val ? p.cor : 'var(--borda, #e2e8f0)'}`,
                                    background: (config.provedores?.whatsappProvider || 'zapi') === p.val ? `${p.cor}15` : 'var(--fundo-card, #fff)',
                                    color: (config.provedores?.whatsappProvider || 'zapi') === p.val ? p.cor : 'var(--texto-secundario, #64748b)',
                                    fontWeight: '800', fontSize: '0.82rem', textAlign: 'center'
                                  }}>
                                  <div>{p.label}</div>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.7 }}>{p.sub}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Instruções por provedor */}
                          {(config.provedores?.whatsappProvider || 'zapi') === 'zapi' && (
                            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '11px 13px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--texto-secundario, #475569)', lineHeight: 1.6 }}>
                              <strong style={{ color: '#065f46' }}>📋 Z-API — Como configurar:</strong><br/>
                              1. Acesse <a href="https://z-api.io" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>z-api.io</a> → Crie uma conta e instância<br/>
                              2. Escaneie o QR Code para conectar seu número<br/>
                              3. Copie a <strong>URL da instância</strong> (formato: <code>api.z-api.io/instances/ID/token/TOKEN/send-text</code>)<br/>
                              4. Copie o <strong>Client-Token</strong> do painel e cole abaixo
                            </div>
                          )}
                          {config.provedores?.whatsappProvider === 'evolution' && (
                            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '11px 13px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--texto-secundario, #475569)', lineHeight: 1.6 }}>
                              <strong style={{ color: '#4c1d95' }}>📋 Evolution API — Como configurar:</strong><br/>
                              1. Instale no seu servidor via Docker: <code>docker run evolution-api</code><br/>
                              2. Crie uma instância no painel e conecte o QR Code<br/>
                              3. A URL será: <code>https://seuservidor.com/message/sendText/NOME_INSTANCIA</code><br/>
                              4. Use a <strong>apikey</strong> gerada nas configurações do Evolution
                            </div>
                          )}
                          {config.provedores?.whatsappProvider === 'twilio' && (
                            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '11px 13px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--texto-secundario, #475569)', lineHeight: 1.6 }}>
                              <strong style={{ color: '#7f1d1d' }}>📋 Twilio WhatsApp — Como configurar:</strong><br/>
                              1. Acesse <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" style={{ color: '#ef4444' }}>console.twilio.com</a> → Ative o <strong>WhatsApp Sandbox</strong><br/>
                              2. Anote: Account SID, Auth Token e número Twilio WhatsApp<br/>
                              3. No campo <strong>URL da API</strong>, coloque apenas: <code>twilio</code><br/>
                              4. No campo <strong>Chave/Token</strong>, coloque: <code>AccountSID:AuthToken:+14155238886</code>
                            </div>
                          )}

                          {/* Campos de configuração */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="noti-form-field">
                              <label>{(config.provedores?.whatsappProvider || 'zapi') === 'twilio' ? 'Escreva "twilio" aqui' : 'URL da API (Endpoint de Envio)'}</label>
                              <input
                                className="noti-input"
                                type="text"
                                placeholder={
                                  config.provedores?.whatsappProvider === 'evolution'
                                    ? 'https://evolution.servidor.com/message/sendText/minhaInstancia'
                                    : config.provedores?.whatsappProvider === 'twilio'
                                    ? 'twilio'
                                    : 'https://api.z-api.io/instances/ID/token/TOKEN/send-text'
                                }
                                value={config.provedores?.whatsappApiUrl || ''}
                                onChange={(e) => setConfig(prev => ({ ...prev, provedores: { ...prev.provedores, whatsappApiUrl: e.target.value } }))}
                                onBlur={async (e) => {
                                  const novosProv = { ...config.provedores, whatsappApiUrl: e.target.value };
                                  await salvarConfiguracoesNotificacoes(tenantId, { ...config, provedores: novosProv });
                                }}
                              />
                            </div>
                            <div className="noti-form-field">
                              <label>{config.provedores?.whatsappProvider === 'twilio' ? 'AccountSID:AuthToken:+Número' : config.provedores?.whatsappProvider === 'evolution' ? 'API Key (Evolution)' : 'Client-Token (Z-API)'}</label>
                              <input
                                className="noti-input"
                                type="password"
                                placeholder={
                                  config.provedores?.whatsappProvider === 'twilio'
                                    ? 'ACxxxxxxxx:authtoken:+14155238886'
                                    : config.provedores?.whatsappProvider === 'evolution'
                                    ? 'sua-apikey-evolution'
                                    : 'F***...Client-Token do Z-API'
                                }
                                value={config.provedores?.whatsappApiKey || ''}
                                onChange={(e) => setConfig(prev => ({ ...prev, provedores: { ...prev.provedores, whatsappApiKey: e.target.value } }))}
                                onBlur={async (e) => {
                                  const novosProv = { ...config.provedores, whatsappApiKey: e.target.value };
                                  await salvarConfiguracoesNotificacoes(tenantId, { ...config, provedores: novosProv });
                                  exibirToast('✅ Credenciais WhatsApp salvas com sucesso!', 'sucesso');
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', fontSize: '12px', color: '#065f46', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span>🤖</span>
                            <span>Com a API configurada, os disparos de lembrete de retirada, devolução, atraso e contratos serão enviados <strong>100% automaticamente</strong> sem nenhum clique!</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--borda, #f1f5f9)', paddingTop: '14px', fontSize: '12.5px', color: '#64748b', marginTop: '12px' }}>
                      Modo atual: <strong style={{ color: config.provedores?.whatsappModo === 'api' ? '#10b981' : '#f59e0b' }}>
                        {config.provedores?.whatsappModo === 'api' ? `🤖 API Automática (${config.provedores?.whatsappProvider || 'z-api'})` : '👆 1-Clique Nativo (wa.me)'}
                      </strong>
                    </div>
                  </div>

                  {/* Card E-mail */}
                  <div className="noti-channel-card">
                    <div>
                      <div className="noti-channel-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <i className="fa-solid fa-envelope-circle-check" style={{ color: '#3b82f6', fontSize: '26px' }}></i>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>E-mail Resend API</h3>
                            <small style={{ color: '#64748b' }}>seguranca@celebrefesta.com.br</small>
                          </div>
                        </div>
                        <span className="noti-channel-card-badge active">● Pronto</span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginTop: '14px' }}>
                        Integração ativa com o serviço corporativo <strong>Resend</strong> para envio de contratos assinados, confirmações de locação e alertas com alta taxa de entrega em caixa de entrada.
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--borda, #f1f5f9)', paddingTop: '14px', fontSize: '12.5px', color: '#64748b' }}>
                      Remetente: <strong>Celebre Notificações</strong>
                    </div>
                  </div>

                  {/* Card SMS */}
                  <div className="noti-channel-card">
                    <div>
                      <div className="noti-channel-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <i className="fa-solid fa-tower-broadcast" style={{ color: '#a855f7', fontSize: '26px' }}></i>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>SMS Transacional</h3>
                            <small style={{ color: '#64748b' }}>Para avisos de urgência</small>
                          </div>
                        </div>
                        <span className="noti-channel-card-badge testing">● Simulação</span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginTop: '14px' }}>
                        Canal alternativo de emergência para cobrança de atrasos e devoluções críticas, com logs auditados em tempo real.
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--borda, #f1f5f9)', paddingTop: '14px', fontSize: '12.5px', color: '#64748b' }}>
                      Modo: <strong>Auditado no Histórico</strong>
                    </div>
                  </div>
                </div>

                {/* Painel de Disparo de Teste */}
                <div className="noti-test-panel-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🚀</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Painel de Disparo de Teste Instantâneo</h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                        Envie uma mensagem real imediatamente para validar a recepção no seu WhatsApp ou E-mail.
                      </p>
                    </div>
                  </div>

                  <div className="noti-test-grid">
                    <div className="noti-form-field">
                      <label>Canal do Teste</label>
                      <select 
                        className="noti-select"
                        value={testeCanal}
                        onChange={(e) => setTesteCanal(e.target.value)}
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">E-mail Corporativo</option>
                        <option value="sms">SMS</option>
                      </select>
                    </div>

                    <div className="noti-form-field">
                      <label>
                        {testeCanal === 'email' ? 'E-mail do Destinatário' : 'WhatsApp com DDD (Ex: 19998564109)'}
                      </label>
                      <input 
                        type={testeCanal === 'email' ? 'email' : 'text'}
                        className="noti-input"
                        placeholder={testeCanal === 'email' ? 'seuemail@exemplo.com' : '19998564109'}
                        value={testeContato}
                        onChange={(e) => setTesteContato(e.target.value)}
                      />
                    </div>

                    <button 
                      className="noti-mgmt-btn-action gold"
                      onClick={handleDispararTeste}
                      disabled={enviandoTeste}
                      style={{ height: '42px', padding: '0 24px' }}
                    >
                      <i className={`fa-solid ${enviandoTeste ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                      {enviandoTeste ? 'Enviando...' : 'Disparar Teste'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================
                ABA 5: HISTÓRICO DE DISPAROS & AUDITORIA
               ================================================================ */}
            {abaAtiva === 'historico' && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div className="noti-inbox-filter-chips">
                    <button 
                      className={`noti-inbox-chip ${filtroCanalHist === 'todos' ? 'active' : ''}`}
                      onClick={() => setFiltroCanalHist('todos')}
                    >
                      Todos ({historico.length})
                    </button>
                    <button 
                      className={`noti-inbox-chip ${filtroCanalHist === 'whatsapp' ? 'active' : ''}`}
                      onClick={() => setFiltroCanalHist('whatsapp')}
                    >
                      WhatsApp ({historico.filter(h => h.canal === 'whatsapp').length})
                    </button>
                    <button 
                      className={`noti-inbox-chip ${filtroCanalHist === 'email' ? 'active' : ''}`}
                      onClick={() => setFiltroCanalHist('email')}
                    >
                      E-mail ({historico.filter(h => h.canal === 'email').length})
                    </button>
                    <button 
                      className={`noti-inbox-chip ${filtroCanalHist === 'sms' ? 'active' : ''}`}
                      onClick={() => setFiltroCanalHist('sms')}
                    >
                      SMS ({historico.filter(h => h.canal === 'sms').length})
                    </button>
                  </div>

                  <button 
                    className="noti-btn-action-small dismiss"
                    onClick={recarregarHistorico}
                    disabled={loadingHist}
                  >
                    <i className={`fa-solid ${loadingHist ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`}></i>
                    Atualizar Histórico
                  </button>
                </div>

                <div className="noti-history-table-wrapper">
                  {historicoFiltrado.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                      <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.5 }}></i>
                      <p style={{ margin: 0, fontWeight: 600 }}>Nenhum disparo registrado ainda.</p>
                      <small>Os envios automáticos e disparos de teste aparecerão aqui com data e status.</small>
                    </div>
                  ) : (
                    <table className="noti-history-table">
                      <thead>
                        <tr>
                          <th>Data / Hora</th>
                          <th>Destinatário</th>
                          <th>Canal</th>
                          <th>Tipo de Evento</th>
                          <th>Conteúdo / Detalhes</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicoFiltrado.map(reg => {
                          const dataHoraFmt = reg.enviadoEm 
                            ? new Date(reg.enviadoEm).toLocaleString('pt-BR') 
                            : '-';

                          return (
                            <tr key={reg.id}>
                              <td style={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12px' }}>
                                {dataHoraFmt}
                              </td>
                              <td>
                                <strong>{reg.destinatario || 'Cliente'}</strong>
                                <br />
                                <small style={{ color: '#64748b' }}>{reg.contato || '-'}</small>
                              </td>
                              <td>
                                <span className={`noti-channel-badge ${reg.canal}`}>
                                  <i className={`fa-${reg.canal === 'whatsapp' ? 'brands fa-whatsapp' : (reg.canal === 'email' ? 'solid fa-envelope' : 'solid fa-comment')}`}></i>
                                  {reg.canal.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ textTransform: 'capitalize' }}>
                                {String(reg.tipoEvento || 'geral').replace(/_/g, ' ')}
                              </td>
                              <td style={{ maxWidth: '340px', fontSize: '12px', color: '#64748b' }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reg.mensagem}>
                                  {reg.mensagem || reg.detalhes || '-'}
                                </div>
                              </td>
                              <td>
                                <span className={`noti-status-chip ${reg.status}`}>
                                  <i className={`fa-solid ${reg.status === 'sucesso' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
                                  {reg.status === 'sucesso' ? 'Enviado' : 'Falha'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GerenciadorNotificacoes;
