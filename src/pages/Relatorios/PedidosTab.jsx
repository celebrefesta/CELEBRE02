import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { gerarRelatorioPedidosPDF } from '../../utils/gerarRelatorioPedidosPDF';
import './PedidosTab.css';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const PedidosTab = ({ mostrarIndicadores = true, alternarIndicadores }) => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroAtual, setFiltroAtual] = useState('TODOS');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');

  const [metricas, setMetricas] = useState({ 
    total: 0, 
    faturamento: 0, 
    futuros: 0 
  });
  const [pedidosLista, setPedidosLista] = useState([]);
  const [taxaConversao, setTaxaConversao] = useState(0);

  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: localStorage.getItem('nomeEmpresa') || localStorage.getItem('funcName') || usuarioLogado?.displayName || '',
    logotipo: localStorage.getItem('logotipoEmpresa') || '',
    cnpj: '',
    endereco: ''
  });

  const registrarLog = async (acao, detalhes) => {
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
    } catch (error) {
      console.error("Erro ao gravar log da auditoria:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) return; 

    const buscarDadosPedidosEConfigs = async () => {
      try {
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const docConfigRef = doc(db, "configuracoes_empresa", tenantId);

        const [snapLocacoes, snapConfig] = await Promise.all([
          getDocs(qLocacoes),
          getDoc(docConfigRef).catch(() => ({ exists: () => false }))
        ]);

        if (snapConfig.exists && snapConfig.exists()) {
          const configData = snapConfig.data();
          const nomeFinal = configData.nomeEmpresa || configData.nomeFantasia || configData.razaoSocial || configData.nome || localStorage.getItem('nomeEmpresa') || localStorage.getItem('funcName') || usuarioLogado?.displayName || 'Minha Empresa';
          setDadosEmpresa({
            nomeEmpresa: nomeFinal,
            logotipo: configData.logotipo || configData.logo || '',
            cnpj: configData.cnpj || '',
            endereco: configData.endereco || ''
          });
          if (nomeFinal) localStorage.setItem('nomeEmpresa', nomeFinal);
        } else {
          try {
            const snapUser = await getDoc(doc(db, "usuarios", tenantId));
            if (snapUser.exists()) {
              const u = snapUser.data();
              const uNome = u.nomeEmpresa || u.nomeCompleto || u.empresaNome || u.nomeExibicao;
              if (uNome) {
                setDadosEmpresa(prev => ({ ...prev, nomeEmpresa: uNome }));
                localStorage.setItem('nomeEmpresa', uNome);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }

        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));

        let faturamentoTotal = 0;
        let eventosFuturosCount = 0;
        let qtdOrcamentos = 0;
        let qtdFechados = 0;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const pedidosFormatados = locacoes.map(loc => {
          const valor = Number(loc.valorTotal || loc.total || 0);
          faturamentoTotal += valor;

          const statusRaw = loc.status || 'Pendente';
          const statusLimpo = String(statusRaw).toUpperCase().trim();

          let dataFesta = null;
          let anoEvento = '';
          let mesEvento = '';

          const dt = loc.dataRetirada || loc.dataEvento || loc.dataCriacao;
          if (dt) {
            dataFesta = dt?.toDate ? dt.toDate() : new Date(dt);
            if (dataFesta && !isNaN(dataFesta.getTime())) {
              anoEvento = String(dataFesta.getFullYear());
              mesEvento = String(dataFesta.getMonth() + 1).padStart(2, '0');
              if (dataFesta >= hoje) {
                eventosFuturosCount++;
              }
            }
          }

          if (statusLimpo.includes('ORÇAMENTO') || statusLimpo.includes('ORCAMENTO') || statusLimpo.includes('PENDENTE')) {
            qtdOrcamentos++;
          } else if (statusLimpo.includes('CONFIRM') || statusLimpo.includes('FECHAD') || statusLimpo.includes('APROVAD') || statusLimpo.includes('PAGO') || statusLimpo.includes('ENTREG') || statusLimpo.includes('DEVOLVID')) {
            qtdFechados++;
          }

          const numFormatado = loc.numeroContrato || loc.numero || loc.id.slice(-5).toUpperCase();
          const tipoServico = String(loc.tipoServico || loc.modalidade || 'Decoração Completa').toUpperCase().trim();

          return {
            id: loc.id,
            numero: numFormatado,
            cliente: loc.clienteNome || loc.nomeCliente || loc.cliente || 'Cliente não identificado',
            tema: loc.temaFesta || loc.tema || loc.nomeEvento || 'Decoração Geral',
            valor,
            status: statusRaw,
            tipoServico: tipoServico.includes('PEGUE') ? 'Pegue e Monte' : 'Decoração Completa',
            dataTimestamp: dataFesta ? dataFesta.getTime() : 0,
            dataStr: dataFesta ? dataFesta.toLocaleDateString('pt-BR') : 'Data a definir',
            mes: mesEvento,
            ano: anoEvento
          };
        });

        const totalNegociacoes = qtdOrcamentos + qtdFechados;
        const conv = totalNegociacoes > 0 ? Math.round((qtdFechados / totalNegociacoes) * 100) : 100;

        setMetricas({
          total: locacoes.length,
          faturamento: faturamentoTotal,
          futuros: eventosFuturosCount
        });

        setTaxaConversao(conv);
        setPedidosLista(pedidosFormatados.sort((a, b) => b.dataTimestamp - a.dataTimestamp));

      } catch (error) {
        console.error("Erro ao carregar relatório de pedidos:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosPedidosEConfigs();
  }, [usuarioLogado, tenantId]);

  // FILTRAGEM DINÂMICA
  const pedidosFiltrados = useMemo(() => {
    return pedidosLista.filter(p => {
      const matchBusca = termoBusca === '' ||
        p.cliente.toLowerCase().includes(termoBusca.toLowerCase()) ||
        p.tema.toLowerCase().includes(termoBusca.toLowerCase()) ||
        p.numero.toLowerCase().includes(termoBusca.toLowerCase());

      if (!matchBusca) return false;
      if (filtroMes && p.mes !== filtroMes) return false;
      if (filtroAno && p.ano !== filtroAno) return false;

      if (filtroAtual === 'FECHADOS') {
        const st = p.status.toUpperCase();
        return st.includes('CONFIRM') || st.includes('FECHAD') || st.includes('APROVAD') || st.includes('PAGO') || st.includes('ENTREG') || st.includes('DEVOLVID');
      }
      if (filtroAtual === 'ORÇAMENTOS') {
        const st = p.status.toUpperCase();
        return st.includes('ORÇAMENTO') || st.includes('ORCAMENTO') || st.includes('PENDENTE');
      }
      if (filtroAtual === 'CANCELADOS') {
        return p.status.toUpperCase().includes('CANCEL');
      }
      if (filtroAtual === 'PEGUE_MONTE') {
        return p.tipoServico.includes('Pegue');
      }
      if (filtroAtual === 'DECORACAO') {
        return p.tipoServico.includes('Decoração');
      }

      return true;
    });
  }, [pedidosLista, termoBusca, filtroMes, filtroAno, filtroAtual]);

  // TOTAIS DINÂMICOS DO FILTRO
  const totaisFiltro = useMemo(() => {
    const soma = pedidosFiltrados.reduce((acc, p) => acc + p.valor, 0);
    const media = pedidosFiltrados.length > 0 ? (soma / pedidosFiltrados.length) : 0;
    return { soma, media };
  }, [pedidosFiltrados]);

  // EXPORTAR CSV
  const exportarCSVPedidos = () => {
    const cabecalho = ["Numero Pedido", "Cliente", "Tema / Evento", "Data Festa", "Modalidade", "Valor (R$)", "Status"];
    const linhas = pedidosFiltrados.map(p => [
      `"#${p.numero}"`,
      `"${(p.cliente || '').replace(/"/g, '""')}"`,
      `"${(p.tema || '').replace(/"/g, '""')}"`,
      `"${p.dataStr || ''}"`,
      `"${p.tipoServico || ''}"`,
      `"${Number(p.valor || 0).toFixed(2).replace('.', ',')}"`,
      `"${p.status || ''}"`
    ]);

    const csvContent = [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const nomeEmpresaSanitizado = (dadosEmpresa.nomeEmpresa || 'Empresa').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Pedidos_${nomeEmpresaSanitizado}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    registrarLog("EXPORTACAO_CSV_PEDIDOS", `Exportou histórico de pedidos em CSV (${pedidosFiltrados.length} contratos).`);
  };

  // EXPORTAR PDF
  const exportarPDFPedidos = async () => {
    try {
      gerarRelatorioPedidosPDF({
        empresa: dadosEmpresa,
        metricas: { ...metricas, taxaConversao },
        pedidos: pedidosFiltrados,
        totaisFiltro,
        filtroAtual,
        filtroMes,
        filtroAno,
        usuarioEmail: usuarioLogado?.email
      });
      await registrarLog("EXPORTAÇÃO DE RELATÓRIO DE PEDIDOS", "Baixou o relatório comercial de pedidos em PDF.");
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem'}}>Processando histórico de pedidos e vendas...</div>;

  return (
    <div className="rel-pedidos-wrapper fade-in">
      
      {/* 4 CARDS KPI ESSENCIAIS & COMPACTOS (GOLDEN RULE 1 & 2) */}
      {mostrarIndicadores && (
        <div className="clientes-stats-grid rel-kpi-grid-compact">
          <div className="stat-card-pro card-green">
            <div className="stat-icon-wrapper icon-green">📑</div>
            <div className="stat-content">
              <span className="stat-title">TOTAL DE PEDIDOS</span>
              <span className="stat-number">{metricas.total}</span>
              <small className="stat-desc">Contratos no histórico</small>
            </div>
          </div>

          <div className="stat-card-pro card-amber">
            <div className="stat-icon-wrapper icon-amber">💰</div>
            <div className="stat-content">
              <span className="stat-title">FATURAMENTO TOTAL</span>
              <span className="stat-number">R$ {metricas.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              <small className="stat-desc">Valor total contratado</small>
            </div>
          </div>

          <div className="stat-card-pro card-purple">
            <div className="stat-icon-wrapper icon-purple">🎯</div>
            <div className="stat-content">
              <span className="stat-title">TAXA DE CONVERSÃO</span>
              <span className="stat-number">{taxaConversao}%</span>
              <small className="stat-desc">Orçamentos fechados</small>
            </div>
          </div>

          <div className="stat-card-pro card-red">
            <div className="stat-icon-wrapper icon-red">📅</div>
            <div className="stat-content">
              <span className="stat-title">EVENTOS FUTUROS</span>
              <span className="stat-number">{metricas.futuros}</span>
              <small className="stat-desc">Festas agendadas</small>
            </div>
          </div>
        </div>
      )}

      {/* CARD PRINCIPAL DE PEDIDOS */}
      <div className="rel-card-unificado">
        <div className="rel-card-header">
          <div>
            <h3 className="rel-card-title">Histórico de Pedidos &amp; Locações ({pedidosFiltrados.length})</h3>
            <p className="rel-card-sub">Listagem detalhada com filtros de data, status e modalidade.</p>
          </div>

          <div className="rel-card-actions">
            <button 
              type="button" 
              onClick={alternarIndicadores}
              className="rel-btn-action-outline"
            >
              {mostrarIndicadores ? '👁️ Ocultar KPIs' : '📊 Ver KPIs'}
            </button>
            <div className="rel-export-btn-group">
              <button 
                type="button" 
                onClick={exportarCSVPedidos}
                className="rel-btn-action-outline"
                title="Exportar pedidos em Excel (CSV)"
              >
                📊 Excel (CSV)
              </button>
              <button 
                type="button" 
                className="rel-btn-action-primary" 
                onClick={exportarPDFPedidos}
                title="Baixar Relatório de Pedidos em PDF"
              >
                📄 Baixar PDF
              </button>
            </div>
          </div>
        </div>

        {/* BARRA DE PESQUISA & FILTROS */}
        <div className="rel-pedidos-subbar">
          <div className="rel-pedidos-search-box">
            <i className="fas fa-search rel-search-icon"></i>
            <input 
              type="text" 
              placeholder="Buscar por cliente, pedido # ou tema..." 
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
              className="rel-pedidos-search-input"
            />
            {termoBusca && (
              <button 
                type="button" 
                className="rel-clear-search-btn" 
                onClick={() => setTermoBusca('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="rel-pedidos-filter-controls">
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="rel-pedidos-select"
            >
              <option value="">📅 Mês: Todos</option>
              {NOMES_MESES.map((m, idx) => (
                <option key={idx} value={String(idx + 1).padStart(2, '0')}>{m}</option>
              ))}
            </select>

            <select
              value={filtroAno}
              onChange={e => setFiltroAno(e.target.value)}
              className="rel-pedidos-select"
            >
              <option value="">📆 Ano: Todos</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>

            <select 
              value={filtroAtual} 
              onChange={e => setFiltroAtual(e.target.value)}
              className="rel-pedidos-select rel-select-status"
            >
              <option value="TODOS">📋 Todos os Status</option>
              <option value="FECHADOS">🟢 Confirmados / Fechados</option>
              <option value="ORÇAMENTOS">🟡 Orçamentos</option>
              <option value="PEGUE_MONTE">🎈 Pegue e Monte</option>
              <option value="DECORACAO">✨ Decoração Completa</option>
              <option value="CANCELADOS">🔴 Cancelados</option>
            </select>
          </div>
        </div>

        {/* CONTAINER DA LISTA ESTRUTURADA */}
        <div className="rel-table-container-responsive">
          <table className="rel-pedidos-table">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>PEDIDO #</th>
                <th style={{ width: '32%' }}>CLIENTE &amp; TEMA</th>
                <th style={{ width: '16%', textAlign: 'center' }}>DATA FESTA</th>
                <th style={{ width: '18%', textAlign: 'center' }}>MODALIDADE</th>
                <th style={{ width: '12%', textAlign: 'right' }}>VALOR TOTAL</th>
                <th style={{ width: '10%', textAlign: 'center' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="rel-table-empty-cell">
                    Nenhum pedido encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                pedidosFiltrados.map((p, idx) => {
                  const isCancelado = String(p.status).toUpperCase().includes('CANCEL');
                  const isOrcamento = String(p.status).toUpperCase().includes('ORÇ') || String(p.status).toUpperCase().includes('ORC') || String(p.status).toUpperCase().includes('PEND');

                  return (
                    <tr key={idx} className="rel-pedido-row">
                      {/* CÉLULA PRINCIPAL ESTRUTURADA COM ZONAS FIXAS */}
                      <td className="rel-cell-pedido">
                        {/* 1. LINHA SUPERIOR: CÓDIGO + DATA (ESQUERDA) | STATUS (DIREITA) */}
                        <div className="rel-ped-header-zone">
                          <div className="rel-ped-meta-left">
                            <span className="rel-ped-badge-id">#{p.numero}</span>
                            <span className="rel-ped-data">
                              <i className="far fa-calendar-alt"></i> {p.dataStr}
                            </span>
                          </div>
                          <span className={`rel-status-pill ${isCancelado ? 'inativo' : isOrcamento ? 'orcamento' : 'ativo'}`}>
                            {isCancelado ? '🔴 Cancelado' : isOrcamento ? '🟡 Orçamento' : '🟢 Confirmado'}
                          </span>
                        </div>

                        {/* 2. LINHA INFERIOR: CLIENTE & TEMA (ESQUERDA) | VALOR & MODALIDADE (DIREITA) */}
                        <div className="rel-ped-body-zone">
                          <div className="rel-ped-info-left">
                            <div className="rel-ped-cliente-title">{p.cliente}</div>
                            <div className="rel-ped-tema-sub">{p.tema}</div>
                          </div>
                          <div className="rel-ped-info-right">
                            <div className="rel-ped-valor-total">
                              R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                            <span className={`rel-ped-modalidade-tag ${p.tipoServico.includes('Pegue') ? 'pm' : 'dec'}`}>
                              {p.tipoServico}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CÉLULAS DESKTOP */}
                      <td className="desktop-only-col">
                        <span className="rel-ped-badge-id">#{p.numero}</span>
                      </td>

                      <td className="desktop-only-col">
                        <div className="rel-ped-cliente-title">{p.cliente}</div>
                        <div className="rel-ped-tema-sub">{p.tema}</div>
                      </td>

                      <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                        <span className="rel-ped-data">{p.dataStr}</span>
                      </td>

                      <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                        <span className={`rel-ped-modalidade-tag ${p.tipoServico.includes('Pegue') ? 'pm' : 'dec'}`}>
                          {p.tipoServico}
                        </span>
                      </td>

                      <td className="desktop-only-col" style={{ textAlign: 'right' }}>
                        <strong className="rel-ped-valor-total">
                          R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </td>

                      <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                        <span className={`rel-status-pill ${isCancelado ? 'inativo' : isOrcamento ? 'orcamento' : 'ativo'}`}>
                          {isCancelado ? '🔴 Cancelado' : isOrcamento ? '🟡 Orçamento' : '🟢 Confirmado'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default PedidosTab;