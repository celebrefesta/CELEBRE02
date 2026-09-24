import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import './AbaAuditoriaAntiChurn.css';

/**
 * 🛰️ ABA AUDITORIA GLOBAL AO VIVO — SUPER ADMIN CELEBRE
 * Central de Monitoramento e Operações em Tempo Real com Streaming Instantâneo (WebSocket / onSnapshot).
 */
const AbaAuditoriaAntiChurn = ({
  clientes = [],
  entrarModoSuporte
}) => {
  // ---------- ESTADOS DO FEED DE AUDITORIA AO VIVO ----------
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [buscaLogs, setBuscaLogs] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroEmpresa, setFiltroEmpresa] = useState('todas');
  const [logInspecionado, setLogInspecionado] = useState(null);
  const [copiadoJson, setCopiadoJson] = useState(false);
  const [gerandoLogTeste, setGerandoLogTeste] = useState(false);
  const [novosLogsIds, setNovosLogsIds] = useState(new Set());
  const [somAtivo, setSomAtivo] = useState(false);
  const [forcarResync, setForcarResync] = useState(0);
  const isPrimeiraCargaRef = useRef(true);
  const [, setRelogioTick] = useState(0);

  // Mapa de Clientes indexados por UID e TenantId para cruzamento rápido de nomes
  const mapaClientes = useMemo(() => {
    const mapa = {};
    clientes.forEach(c => {
      if (c.uid) mapa[c.uid] = c;
      if (c.tenantId) mapa[c.tenantId] = c;
      if (c.email) mapa[String(c.email).toLowerCase()] = c;
    });
    return mapa;
  }, [clientes]);

  // ⏱️ RELÓGIO VIVO: Atualiza tempos relativos a cada 10s sem precisar de reload
  useEffect(() => {
    const interval = setInterval(() => {
      setRelogioTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // 🎵 Efeito sonoro sintético ultra-leve para novos logs ao vivo (Zero assets externos)
  const tocarChimeAoVivo = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (_) {}
  };

  // 🔄 STREAMING LITERALMENTE EM TEMPO REAL (ONSNAPSHOT) DOS LOGS GLOBAIS
  useEffect(() => {
    setLoadingLogs(true);

    const processarDocsSnapshot = (snap) => {
      const lista = [];

      snap.docs.forEach(docSnap => {
        const d = docSnap.data();
        const acaoUpper = String(d.acao || '').toUpperCase();
        const detUpper = String(d.detalhes || '').toUpperCase();

        // 🚫 FILTRO DE AUDITORIA: Ignora rigorosamente logs de login, logout e sessões
        // O Super Admin não precisa rastrear horários de acesso/login, apenas pagamentos e eventos operacionais
        if (
          acaoUpper === 'LOGIN' ||
          acaoUpper === 'LOGOUT' ||
          acaoUpper.includes('AUTH') ||
          acaoUpper.includes('ACESSO') ||
          detUpper.includes('INICIOU SESSÃO') ||
          detUpper.includes('INICIOU SESSAO') ||
          detUpper.includes('ENCERROU A SESSÃO') ||
          detUpper.includes('ENCERROU A SESSAO') ||
          detUpper.includes('ACESSOU O SISTEMA')
        ) {
          return;
        }

        const empId = d.empresaId || d.userId || '';
        const cliVinculado = mapaClientes[empId] || mapaClientes[String(d.usuarioEmail || '').toLowerCase()] || null;

        // Normalização robusta de data (cobre dataHora ISO, criadoEm Timestamp, criadoEm millis, data Date)
        let timestampMs = 0;
        if (d.dataHora) {
          const t = new Date(d.dataHora).getTime();
          if (!isNaN(t)) timestampMs = t;
        }
        if (!timestampMs && d.criadoEm?.toDate) {
          timestampMs = d.criadoEm.toDate().getTime();
        }
        if (!timestampMs && d.criadoEm?.toMillis) {
          timestampMs = d.criadoEm.toMillis();
        }
        if (!timestampMs && d.data?.toDate) {
          timestampMs = d.data.toDate().getTime();
        }
        if (!timestampMs && d.criadoEm) {
          const t = new Date(d.criadoEm).getTime();
          if (!isNaN(t)) timestampMs = t;
        }
        if (!timestampMs && d.data) {
          const t = new Date(d.data).getTime();
          if (!isNaN(t)) timestampMs = t;
        }
        if (!timestampMs) {
          timestampMs = Date.now();
        }

        lista.push({
          id: docSnap.id,
          ...d,
          timestampMs,
          empresaNome: cliVinculado?.nomeExibicao || cliVinculado?.nomeCompleto || d.nomeFuncionario || 'Empresa Celebre',
          empresaEmail: cliVinculado?.email || d.usuarioEmail || '—',
          clienteRef: cliVinculado
        });
      });

      // Ordena com rigor do mais recente para o mais antigo
      lista.sort((a, b) => b.timestampMs - a.timestampMs);

      // Detecta novos eventos em tempo real após a carga inicial
      if (!isPrimeiraCargaRef.current && snap.docChanges) {
        const docsAdicionados = snap.docChanges().filter(c => c.type === 'added');
        if (docsAdicionados.length > 0) {
          const novosIds = new Set(docsAdicionados.map(c => c.doc.id));
          setNovosLogsIds(novosIds);
          if (somAtivo) tocarChimeAoVivo();
          setTimeout(() => setNovosLogsIds(new Set()), 4000);
        }
      }
      isPrimeiraCargaRef.current = false;

      setLogs(lista);
      setLoadingLogs(false);
    };

    let unsubscribe = null;

    try {
      // Escuta em tempo real até 800 registros mais recentes para compensar registros legados
      const qStreaming = query(collection(db, "logs_atividades"), limit(800));
      unsubscribe = onSnapshot(qStreaming, (snap) => {
        processarDocsSnapshot(snap);
      }, (err) => {
        console.error("Erro no streaming de auditoria:", err);
        setLoadingLogs(false);
      });
    } catch (errInit) {
      console.error("Erro ao inicializar streaming:", errInit);
      setLoadingLogs(false);
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [mapaClientes, forcarResync, somAtivo]);

  // ⚡ SIMULAR REGISTRO DE AÇÃO EM TEMPO REAL PARA TESTE VISUAL
  const handleGerarLogTeste = async () => {
    setGerandoLogTeste(true);
    try {
      const agora = new Date();
      const acoesPossiveis = [
        { acao: "PAGAMENTO APROVADO (PIX)", tipo: "FINANCEIRO", detalhes: `Pagamento de R$ 99,90 aprovado via PIX para o plano: "Profissional" (Transação MP: 178990123) às ${agora.toLocaleTimeString('pt-BR')}` },
        { acao: "GERAÇÃO DE PIX", tipo: "FINANCEIRO", detalhes: `Gerou um QR Code PIX para pagamento da assinatura do Plano: Básico (R$ 49,90) às ${agora.toLocaleTimeString('pt-BR')}` },
        { acao: "ASSINATURA APROVADA (CARTÃO)", tipo: "FINANCEIRO", detalhes: `Pagamento de assinatura processado com sucesso via Cartão. Plano: Premium (R$ 159,90) às ${agora.toLocaleTimeString('pt-BR')}` },
        { acao: "NOVA LOCAÇÃO (TESTE AO VIVO)", tipo: "CRIACAO", detalhes: `Criou pedido #${agora.getFullYear()}-999 (Decoração Completa) para Cliente VIP às ${agora.toLocaleTimeString('pt-BR')}` },
        { acao: "CONTRATO ASSINADO (TESTE AO VIVO)", tipo: "CONTRATO", detalhes: `Cliente assinou contrato digital #CT-2026 às ${agora.toLocaleTimeString('pt-BR')}` }
      ];
      const sorteada = acoesPossiveis[Math.floor(Math.random() * acoesPossiveis.length)];

      await addDoc(collection(db, "logs_atividades"), {
        empresaId: "admin_celebre",
        userId: "admin_celebre",
        funcionarioId: "super_admin",
        nomeFuncionario: "Super Admin (Você)",
        usuarioEmail: "celebrefesta25@gmail.com",
        acao: sorteada.acao,
        tipo: sorteada.tipo,
        detalhes: sorteada.detalhes,
        dataHora: agora.toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (e) {
      console.error("Erro ao gerar log de teste:", e);
      alert("Falha ao gerar log de teste no banco de dados.");
    } finally {
      setGerandoLogTeste(false);
    }
  };

  // 💰 Extração inteligente e limpa dos dados de pagamento dos detalhes do log
  const extrairInfoPagamento = (detalhes = '', acao = '') => {
    const texto = String(detalhes || '');
    const textoUpper = (texto + ' ' + acao).toUpperCase();

    // Extrai valor monetário (R$ XX,XX)
    const matchValor = texto.match(/R\$\s?([\d.,]+)/i);
    const valor = matchValor ? `R$ ${matchValor[1]}` : null;

    // Identifica método de pagamento
    let metodo = null;
    if (textoUpper.includes('PIX')) {
      metodo = { nome: 'PIX', icon: 'fa-bolt', classe: 'metodo-pix' };
    } else if (textoUpper.includes('CARTÃO') || textoUpper.includes('CARTAO') || textoUpper.includes('CRÉDITO') || textoUpper.includes('CREDITO')) {
      metodo = { nome: 'Cartão de Crédito', icon: 'fa-credit-card', classe: 'metodo-cartao' };
    } else if (textoUpper.includes('BOLETO')) {
      metodo = { nome: 'Boleto Bancário', icon: 'fa-barcode', classe: 'metodo-boleto' };
    }

    // Identifica plano
    let plano = null;
    const matchPlano = texto.match(/plano:?\s*["']?([^("'\n,]+)["']?/i);
    if (matchPlano && matchPlano[1]) {
      plano = matchPlano[1].trim();
    }

    // Transação MP
    const matchMp = texto.match(/(?:transação|transacao|mp:?)\s*#?([0-9]{8,})/i);
    const transacaoId = matchMp ? matchMp[1] : null;

    return { valor, metodo, plano, transacaoId };
  };

  // ---------- 📜 CLASSIFICAÇÃO E FILTROS DO FEED DE LOGS ----------
  const classificarCategoriaLog = (log) => {
    const acao = String(log.acao || '').toUpperCase();
    const detalhes = String(log.detalhes || '').toUpperCase();

    // 💰 FINANCEIRO & PAGAMENTOS (Prioridade com badges ricos)
    if (
      acao.includes('PAGAMENTO') || 
      acao.includes('ASSINATURA') || 
      acao.includes('PLANO') || 
      acao.includes('FATURA') || 
      acao.includes('FINANCEIRO') || 
      acao.includes('PIX') || 
      acao.includes('BOLETO') || 
      acao.includes('CARTAO') || 
      acao.includes('CARTÃO') ||
      acao.includes('UPGRADE') ||
      acao.includes('RENOVA') ||
      detalhes.includes('PAGAMENTO') ||
      detalhes.includes('PIX') ||
      detalhes.includes('ASSINATURA') ||
      detalhes.includes('TRANSAÇÃO') ||
      detalhes.includes('TRANSACAO')
    ) {
      const isPix = acao.includes('PIX') || detalhes.includes('PIX');
      const isAprovado = acao.includes('APROVAD') || acao.includes('CONFIRM') || detalhes.includes('APROVADO') || detalhes.includes('COM SUCESSO');
      return { 
        id: 'financeiro', 
        label: isAprovado ? 'Pagamento Aprovado' : (isPix ? 'PIX / Pagamento' : 'Pagamento & Assinatura'), 
        icon: isAprovado ? 'fa-check-circle' : (isPix ? 'fa-bolt' : 'fa-dollar-sign'), 
        classe: 'cat-financeiro',
        isPagamento: true,
        isAprovado
      };
    }

    if (acao.includes('LOCACAO') || acao.includes('PEDIDO') || acao.includes('CONTRATO') || acao.includes('CHECKIN') || acao.includes('CHECKOUT') || acao.includes('ENTREGA')) {
      return { id: 'locacoes', label: 'Locações & Pedidos', icon: 'fa-calendar-check', classe: 'cat-locacoes' };
    }
    if (acao.includes('ESTOQUE') || acao.includes('PRODUTO') || acao.includes('MOODBOARD') || acao.includes('ACERVO') || acao.includes('PECA')) {
      return { id: 'estoque', label: 'Acervo & Estoque', icon: 'fa-boxes', classe: 'cat-estoque' };
    }
    if (acao.includes('EXCLU') || acao.includes('DELETE') || acao.includes('SUSPEN') || acao.includes('BLOQUE') || acao.includes('CANCEL')) {
      return { id: 'criticos', label: 'Ação Crítica', icon: 'fa-exclamation-triangle', classe: 'cat-criticos' };
    }
    return { id: 'outros', label: 'Operacional', icon: 'fa-stream', classe: 'cat-outros' };
  };

  const logsFiltrados = useMemo(() => {
    return logs.filter(log => {
      // 0. Bloqueio absoluto de logs de login/logout/sessão
      const acaoUpper = String(log.acao || '').toUpperCase();
      const detUpper = String(log.detalhes || '').toUpperCase();
      if (
        acaoUpper === 'LOGIN' || 
        acaoUpper === 'LOGOUT' || 
        acaoUpper.includes('AUTH') || 
        acaoUpper.includes('ACESSO') || 
        detUpper.includes('INICIOU SESSÃO') || 
        detUpper.includes('INICIOU SESSAO') ||
        detUpper.includes('ENCERROU A SESSÃO') ||
        detUpper.includes('ENCERROU A SESSAO') ||
        detUpper.includes('ACESSOU O SISTEMA')
      ) {
        return false;
      }

      // 1. Busca
      if (buscaLogs) {
        const termo = buscaLogs.toLowerCase();
        const nomeEmp = (log.empresaNome || '').toLowerCase();
        const emailEmp = (log.empresaEmail || '').toLowerCase();
        const funcNome = (log.nomeFuncionario || '').toLowerCase();
        const acao = (log.acao || '').toLowerCase();
        const det = (log.detalhes || '').toLowerCase();

        if (!nomeEmp.includes(termo) && !emailEmp.includes(termo) && !funcNome.includes(termo) && !acao.includes(termo) && !det.includes(termo)) {
          return false;
        }
      }

      // 2. Filtro Categoria
      if (filtroCategoria !== 'todas') {
        const cat = classificarCategoriaLog(log);
        if (cat.id !== filtroCategoria) return false;
      }

      // 3. Filtro Empresa
      if (filtroEmpresa !== 'todas') {
        const empId = log.empresaId || log.userId || '';
        if (empId !== filtroEmpresa) return false;
      }

      return true;
    });
  }, [logs, buscaLogs, filtroCategoria, filtroEmpresa]);

  // Formatação de Tempo Relativo e Exato com precisão em segundos
  const formatarTempoRelativo = (timestampMs, dataHoraIso) => {
    let date = null;
    if (typeof timestampMs === 'number' && timestampMs > 0) {
      date = new Date(timestampMs);
    } else if (dataHoraIso) {
      date = new Date(dataHoraIso);
    }
    if (!date || isNaN(date.getTime())) {
      return { relativo: 'Recente', horaExata: '—', dataExata: '—', completo: 'Recente' };
    }

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.max(0, Math.round(diffMs / 1000));
    const diffMin = Math.round(diffSec / 60);
    const diffHoras = Math.round(diffMin / 60);
    const diffDias = Math.round(diffHoras / 24);

    const horaExata = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dataExata = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let relativo = '';
    if (diffSec < 15) relativo = 'Agora mesmo (ao vivo)';
    else if (diffSec < 60) relativo = `Há ${diffSec}s`;
    else if (diffMin < 60) relativo = `Há ${diffMin} min`;
    else if (diffHoras < 24) relativo = `Há ${diffHoras}h`;
    else if (diffDias === 1) relativo = 'Ontem';
    else if (diffDias < 7) relativo = `Há ${diffDias} dias`;
    else relativo = dataExata;

    return {
      relativo,
      horaExata,
      dataExata,
      completo: `${dataExata} às ${horaExata}`
    };
  };

  const copiarJsonLog = () => {
    if (!logInspecionado) return;
    try {
      navigator.clipboard.writeText(JSON.stringify(logInspecionado, null, 2));
      setCopiadoJson(true);
      setTimeout(() => setCopiadoJson(false), 2000);
    } catch (e) {
      console.warn("Erro ao copiar JSON:", e);
    }
  };

  return (
    <div className="cg-auditoria-container fade-in">
      <div className="cg-auditoria-feed-container">
        {/* BARRA DE FILTROS DO FEED AO VIVO */}
        <div className="cg-auditoria-toolbar cg-auditoria-feed-toolbar">
          {/* BADGE AO VIVO / REAL-TIME STREAMING */}
          <div className="cg-auditoria-live-badge" title="Streaming contínuo ativo via Firestore onSnapshot">
            <span className="cg-live-dot"></span>
            <span className="cg-live-label">AO VIVO</span>
            <span className="cg-live-count">{logsFiltrados.length} eventos</span>
          </div>

          <div className="cg-auditoria-search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              className="cg-auditoria-search-input"
              placeholder="Buscar ação, funcionário, empresa ou detalhe..."
              value={buscaLogs}
              onChange={(e) => setBuscaLogs(e.target.value)}
            />
            {buscaLogs && (
              <button className="cg-auditoria-search-clear" onClick={() => setBuscaLogs('')}>
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          {/* Pílulas de filtro rápido de modo */}
          <div className="cg-auditoria-quick-filter-pills">
            <button
              type="button"
              className={`cg-quick-pill ${filtroCategoria === 'financeiro' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria(filtroCategoria === 'financeiro' ? 'todas' : 'financeiro')}
              title="Filtrar somente pagamentos, assinaturas e transações"
            >
              <i className="fas fa-dollar-sign"></i>
              <span>{filtroCategoria === 'financeiro' ? '✓ Só Pagamentos' : 'Só Pagamentos'}</span>
            </button>
            <button
              type="button"
              className={`cg-quick-pill ${filtroCategoria === 'todas' ? 'active-all' : ''}`}
              onClick={() => setFiltroCategoria('todas')}
              title="Exibir todos os eventos operacionais (sem logins)"
            >
              <i className="fas fa-layer-group"></i>
              <span>Todos os Eventos</span>
            </button>
          </div>

          <div className="cg-auditoria-filters-group">
            <select
              className="cg-auditoria-select"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="todas">Todos os Eventos (sem logins)</option>
              <option value="financeiro">💰 Pagamentos & Assinaturas</option>
              <option value="locacoes">📅 Locações & Pedidos</option>
              <option value="estoque">📦 Acervo & Estoque</option>
              <option value="criticos">⚠️ Ações Críticas & Exclusões</option>
            </select>

            <select
              className="cg-auditoria-select"
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              style={{ maxWidth: '180px' }}
            >
              <option value="todas">Todas as Empresas</option>
              {clientes.filter(c => c.status !== 'admin').map(c => (
                <option key={c.uid} value={c.uid}>
                  {c.nomeExibicao || c.nomeCompleto}
                </option>
              ))}
            </select>

            {/* BOTÃO DISPARADOR DE TESTE AO VIVO */}
            <button
              type="button"
              className="cg-btn-teste-live"
              onClick={handleGerarLogTeste}
              disabled={gerandoLogTeste}
              title="Gera um registro real no banco de dados para testar a captura instantânea no feed ao vivo"
            >
              <i className={`fas ${gerandoLogTeste ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
              <span>{gerandoLogTeste ? 'Emitindo...' : 'Testar Ação ao Vivo'}</span>
            </button>

            {/* BOTÃO SOM DE NOTIFICAÇÃO AO VIVO */}
            <button
              type="button"
              className={`cg-btn-audio-toggle ${somAtivo ? 'active' : ''}`}
              onClick={() => {
                if (!somAtivo) tocarChimeAoVivo();
                setSomAtivo(!somAtivo);
              }}
              title={somAtivo ? 'Desativar sinal sonoro de novos eventos' : 'Ativar aviso sonoro sutil quando uma ação acontecer em tempo real'}
            >
              <i className={`fas ${somAtivo ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
            </button>

            <button
              type="button"
              className="cg-auditoria-btn-refresh"
              onClick={() => setForcarResync(c => c + 1)}
              title="Forçar ressincronização do streaming em tempo real"
            >
              <i className={`fas fa-sync-alt ${loadingLogs ? 'fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* TIMELINE DE LOGS */}
        {loadingLogs ? (
          <div className="cg-loading-tab">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Conectando ao streaming de auditoria em tempo real...</p>
          </div>
        ) : logsFiltrados.length === 0 ? (
          <div className="cg-auditoria-empty">
            <i className="fas fa-clipboard-list"></i>
            <h4>Nenhum log encontrado</h4>
            <p>Nenhuma atividade recente registrada coincide com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="cg-auditoria-timeline">
            {logsFiltrados.map((log) => {
              const cat = classificarCategoriaLog(log);
              const infoPag = cat.isPagamento ? extrairInfoPagamento(log.detalhes, log.acao) : null;
              const tempoInfo = formatarTempoRelativo(log.timestampMs, log.dataHora || log.criadoEm);
              const isRecente = novosLogsIds.has(log.id) || (Date.now() - (log.timestampMs || 0) < 15000);

              return (
                <div 
                  key={log.id} 
                  className={`cg-auditoria-log-card ${cat.isPagamento ? 'cg-log-card-financeiro' : ''} ${isRecente ? 'cg-log-new-arrival' : ''}`}
                >
                  <div className={`cg-auditoria-log-icon ${cat.classe}`}>
                    <i className={`fas ${cat.icon}`}></i>
                  </div>

                  <div className="cg-auditoria-log-body">
                    <div className="cg-auditoria-log-header">
                      <div className="cg-auditoria-log-meta">
                        <span className="cg-auditoria-log-empresa">{log.empresaNome}</span>
                        <span className={`cg-auditoria-log-badge-acao ${cat.classe}`}>
                          <i className={`fas ${cat.icon}`}></i> {log.acao || (cat.isPagamento ? 'PAGAMENTO' : 'OPERAÇÃO')}
                        </span>
                        {/* Pílulas de Pagamento em Destaque */}
                        {infoPag?.valor && (
                          <span className="cg-auditoria-badge-valor" title="Valor do Pagamento">
                            <i className="fas fa-coins"></i> {infoPag.valor}
                          </span>
                        )}
                        {infoPag?.metodo && (
                          <span className={`cg-auditoria-badge-metodo ${infoPag.metodo.classe}`} title="Forma de Pagamento">
                            <i className={`fas ${infoPag.metodo.icon}`}></i> {infoPag.metodo.nome}
                          </span>
                        )}
                        {infoPag?.plano && (
                          <span className="cg-auditoria-badge-plano" title="Plano da Assinatura">
                            <i className="fas fa-cube"></i> {infoPag.plano}
                          </span>
                        )}
                        {log.nomeFuncionario && !cat.isPagamento && (
                          <span className="cg-auditoria-log-user" title="Operador / Funcionário responsável">
                            <i className="fas fa-user-circle"></i> {log.nomeFuncionario}
                          </span>
                        )}
                      </div>

                      {/* Bloco de Data e Horário com Destaque Bonitinho */}
                      <div 
                        className={`cg-auditoria-log-time-group ${cat.isPagamento ? 'time-group-pagamento' : ''}`} 
                        title={`Data e Hora exata: ${tempoInfo.completo}`}
                      >
                        {cat.isPagamento ? (
                          <>
                            <span className="cg-auditoria-time-label">
                              <i className="fas fa-clock"></i> Horário do Pagamento:
                            </span>
                            <span className="cg-auditoria-log-exact-time destaque-hora">
                              {tempoInfo.horaExata}
                            </span>
                            <span className="cg-auditoria-log-date-tag">
                              {tempoInfo.dataExata} • {tempoInfo.relativo}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`cg-auditoria-log-time ${tempoInfo.relativo.includes('ao vivo') ? 'live-text' : ''}`}>
                              <i className={tempoInfo.relativo.includes('ao vivo') ? 'fas fa-bolt' : 'far fa-clock'}></i> 
                              {tempoInfo.relativo}
                            </span>
                            <span className="cg-auditoria-log-exact-time">
                              {tempoInfo.horaExata}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {log.detalhes && (
                      <div className={`cg-auditoria-log-detalhes ${cat.isPagamento ? 'detalhes-pagamento' : ''}`}>
                        {typeof log.detalhes === 'object' ? JSON.stringify(log.detalhes) : String(log.detalhes)}
                        {infoPag?.transacaoId && (
                          <span className="cg-auditoria-mp-pill" title="ID da Transação Mercado Pago">
                            <i className="fas fa-receipt"></i> MP: {infoPag.transacaoId}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="cg-auditoria-log-actions">
                      <button
                        type="button"
                        className="cg-btn-inspect-json"
                        onClick={() => setLogInspecionado(log)}
                      >
                        <i className="fas fa-code"></i> Inspecionar JSON
                      </button>

                      {log.clienteRef && entrarModoSuporte && (
                        <button
                          type="button"
                          className="cg-btn-inspect-json btn-acessar-empresa"
                          onClick={() => entrarModoSuporte(log.clienteRef)}
                          title={`Acessar a loja de ${log.empresaNome} no modo suporte`}
                        >
                          <i className="fas fa-sign-in-alt"></i> Acessar Empresa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔎 MODAL DE INSPEÇÃO TÉCNICA JSON */}
      {logInspecionado && (
        <div className="cg-auditoria-modal-overlay" onClick={() => setLogInspecionado(null)}>
          <div className="cg-auditoria-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cg-auditoria-modal-header">
              <h3>
                <i className="fas fa-shield-alt"></i> Auditoria de Evento: {logInspecionado.acao || 'Registro'}
              </h3>
              <button
                type="button"
                className="cg-auditoria-modal-close"
                onClick={() => setLogInspecionado(null)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="cg-auditoria-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
                <div><strong>Empresa:</strong> {logInspecionado.empresaNome}</div>
                <div><strong>Operador:</strong> {logInspecionado.nomeFuncionario || '—'}</div>
                <div><strong>E-mail:</strong> {logInspecionado.empresaEmail}</div>
                <div><strong>ID Registro:</strong> {logInspecionado.id}</div>
              </div>

              <pre className="cg-auditoria-json-viewer">
                {JSON.stringify(logInspecionado, null, 2)}
              </pre>
            </div>

            <div className="cg-auditoria-modal-footer">
              <button
                type="button"
                className="cg-btn-copy-json"
                onClick={copiarJsonLog}
              >
                <i className={`fas ${copiadoJson ? 'fa-check' : 'fa-copy'}`}></i>
                {copiadoJson ? 'Copiado!' : 'Copiar JSON'}
              </button>
              <button
                type="button"
                className="cg-auditoria-btn-refresh"
                onClick={() => setLogInspecionado(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbaAuditoriaAntiChurn;
