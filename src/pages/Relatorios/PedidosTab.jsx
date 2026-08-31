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
  const [statusContagem, setStatusContagem] = useState([]);
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
        const contagemStatus = {};
     
        let qtdOrcamentos = 0;
        let qtdFechados = 0;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const pedidosFormatados = locacoes.map(loc => {
          const valor = Number(loc.valorTotal || loc.total || 0);
          faturamentoTotal += valor;

          const statusRaw = loc.status || 'Pendente';
          const statusLimpo = String(statusRaw).toUpperCase().trim();
          contagemStatus[statusLimpo] = (contagemStatus[statusLimpo] || 0) + 1;

          let dataFesta = null;
          let anoEvento = '';
          let mesEvento = '';

          if (loc.dataRetirada) {
            dataFesta = new Date(loc.dataRetirada.includes('T') ? loc.dataRetirada : `${loc.dataRetirada}T12:00:00`);
            const p = loc.dataRetirada.split('T')[0].split('-');
            if (p.length >= 2) { anoEvento = p[0]; mesEvento = p[1]; }
          } else if (loc.criadoEm?.toDate) {
            dataFesta = loc.criadoEm.toDate();
            anoEvento = String(dataFesta.getFullYear());
            mesEvento = String(dataFesta.getMonth() + 1).padStart(2, '0');
          }

          if (dataFesta && dataFesta >= hoje && !statusLimpo.includes('CANCELADO')) {
            eventosFuturosCount++;
          }

          if (statusLimpo.includes('ORÇAMENTO') || statusLimpo.includes('ORCAMENTO') || statusLimpo.includes('PENDENTE')) {
            qtdOrcamentos++;
          } else if (!statusLimpo.includes('CANCELADO')) {
            qtdFechados++;
          }

          let tipoServico = "DECORAÇÃO";
          if (loc.tipoServico || loc.tipoDaFesta || loc.modalidade) {
             tipoServico = String(loc.tipoServico || loc.tipoDaFesta || loc.modalidade).toUpperCase();
          } 
          else if (loc.logistica && String(loc.logistica.tipoFrete || loc.logistica.frete).toUpperCase().includes('RETIRADA')) {
             tipoServico = "PEGUE E MONTE";
          }

          return {
            id: loc.id,
            numero: loc.numeroPedido || loc.id.substring(0, 6).toUpperCase(),
            cliente: loc.clienteNome || "Cliente não informado",
            telefone: loc.clienteTelefone || loc.telefone || '',
            tema: loc.temaFesta || loc.tema || 'Geral',
            dataObj: dataFesta,
            dataStr: dataFesta ? dataFesta.toLocaleDateString('pt-BR') : "Sem data",
            anoEvento,
            mesEvento,
            valor: valor,
            valorPago: Number(loc.valorPago || loc.sinal || 0),
            saldoDevedor: Math.max(0, valor - Number(loc.valorPago || loc.sinal || 0)),
            status: statusLimpo,
            tipoServico: tipoServico
          };
        });

        pedidosFormatados.sort((a, b) => (b.dataObj || 0) - (a.dataObj || 0));
        
        const statusArray = Object.entries(contagemStatus).sort((a, b) => b[1] - a[1]);
        const totalOportunidades = qtdFechados + qtdOrcamentos;
        const taxa = totalOportunidades > 0 ? Math.round((qtdFechados / totalOportunidades) * 100) : 0;
        
        setMetricas({ total: locacoes.length, faturamento: faturamentoTotal, futuros: eventosFuturosCount });
        setStatusContagem(statusArray);
        setPedidosLista(pedidosFormatados);
        setTaxaConversao(taxa);
        
      } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosPedidosEConfigs();
  }, [usuarioLogado, tenantId]);

  // FILTRAGEM DINÂMICA
  const pedidosFiltrados = useMemo(() => {
    return pedidosLista.filter(p => {
      // 1. Busca textual
      const matchBusca = termoBusca === '' ||
        p.cliente.toLowerCase().includes(termoBusca.toLowerCase()) ||
        String(p.numero).toLowerCase().includes(termoBusca.toLowerCase()) ||
        p.tema.toLowerCase().includes(termoBusca.toLowerCase());

      if (!matchBusca) return false;

      // 2. Período
      if (filtroAno && p.anoEvento !== filtroAno) return false;
      if (filtroMes && p.mesEvento !== filtroMes) return false;

      // 3. Status e Modalidade
      if (filtroAtual === 'FECHADOS') return !p.status.includes('ORÇAMENTO') && !p.status.includes('ORCAMENTO') && !p.status.includes('PENDENTE') && !p.status.includes('CANCELADO');
      if (filtroAtual === 'ORÇAMENTOS') return p.status.includes('ORÇAMENTO') || p.status.includes('ORCAMENTO') || p.status.includes('PENDENTE');
      if (filtroAtual === 'CANCELADOS') return p.status.includes('CANCELADO');
      if (filtroAtual === 'PEGUE_MONTE') return p.tipoServico.includes('PEGUE');
      if (filtroAtual === 'DECORACAO') return !p.tipoServico.includes('PEGUE');

      return true;
    });
  }, [pedidosLista, termoBusca, filtroAno, filtroMes, filtroAtual]);

  // TOTAIS DO FILTRO ATIVO
  const totaisFiltro = useMemo(() => {
    const soma = pedidosFiltrados.reduce((acc, p) => acc + p.valor, 0);
    const media = pedidosFiltrados.length > 0 ? soma / pedidosFiltrados.length : 0;
    const saldoTotal = pedidosFiltrados.reduce((acc, p) => acc + p.saldoDevedor, 0);
    return { soma, media, saldoTotal };
  }, [pedidosFiltrados]);

  // EXPORTAR CSV (EXCEL COM UTF-8 BOM)
  const exportarCSVPedidos = () => {
    const cabecalho = ["Pedido #", "Cliente", "Telefone", "Data Festa", "Modalidade", "Tema", "Valor Total (R$)", "Valor Pago (R$)", "Saldo Devedor (R$)", "Status"];
    const linhas = pedidosFiltrados.map(p => [
      `"${p.numero || ''}"`,
      `"${(p.cliente || '').replace(/"/g, '""')}"`,
      `"${p.telefone || ''}"`,
      `"${p.dataStr || ''}"`,
      `"${p.tipoServico || ''}"`,
      `"${(p.tema || '').replace(/"/g, '""')}"`,
      `"${Number(p.valor || 0).toFixed(2).replace('.', ',')}"`,
      `"${Number(p.valorPago || 0).toFixed(2).replace('.', ',')}"`,
      `"${Number(p.saldoDevedor || 0).toFixed(2).replace('.', ',')}"`,
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

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>Processando histórico de pedidos...</div>;

  const qtdPegueMonte = pedidosLista.filter(p => p.tipoServico.includes('PEGUE')).length;
  const qtdDecoracao = pedidosLista.length - qtdPegueMonte;

  return (
    <div className="fade-in">
      
      {mostrarIndicadores && (
        <>
          {/* 💡 PAINEL DE INSIGHTS INTELIGENTES PEDIDOS */}
          <div className="rel-card-unificado" style={{ borderLeft: '5px solid #8b5cf6', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.3rem' }}>🎯</span>
                <div>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--texto-principal, #0f172a)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>DESEMPENHO COMERCIAL &amp; CONVERSÃO DE VENDAS</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--texto-secundario, #64748b)' }}>
                    Sua taxa de fechamento é de <strong style={{ color: '#10b981' }}>{taxaConversao}%</strong>. Existem <strong style={{ color: '#3b82f6' }}>{metricas.futuros} eventos agendados</strong> no calendário futuro.
                  </p>
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', background: 'var(--fundo-cinza, #f8fafc)', color: '#8b5cf6', border: '1px solid var(--borda, #cbd5e1)' }}>
                Conversão: {taxaConversao}%
              </span>
            </div>
          </div>

          {/* 4 CARDS KPI BLINDADOS (GOLDEN RULE 1 & 2) */}
          <div className="clientes-stats-grid">
            <div className="stat-card-pro card-green">
              <div className="stat-icon-wrapper icon-green">📑</div>
              <div className="stat-content">
                <span className="stat-title">TOTAL DE PEDIDOS</span>
                <strong className="stat-number">{metricas.total}</strong>
                <small className="stat-desc">Contratos no histórico</small>
              </div>
            </div>

            <div className="stat-card-pro card-amber">
              <div className="stat-icon-wrapper icon-amber">💰</div>
              <div className="stat-content">
                <span className="stat-title">FATURAMENTO CONTRATADO</span>
                <strong className="stat-number">R$ {metricas.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Valor total de contratos</small>
              </div>
            </div>

            <div className="stat-card-pro card-purple">
              <div className="stat-icon-wrapper icon-purple">🎯</div>
              <div className="stat-content">
                <span className="stat-title">TAXA DE CONVERSÃO</span>
                <strong className="stat-number">{taxaConversao}%</strong>
                <small className="stat-desc">Orçamentos fechados</small>
              </div>
            </div>

            <div className="stat-card-pro card-red">
              <div className="stat-icon-wrapper icon-red">📅</div>
              <div className="stat-content">
                <span className="stat-title">EVENTOS FUTUROS</span>
                <strong className="stat-number">{metricas.futuros}</strong>
                <small className="stat-desc">Próximas festas no radar</small>
              </div>
            </div>
          </div>

          {/* 📊 WIDGET COMPACTO DE STATUS E MODALIDADE */}
          <div className="rel-card-unificado">
            <div className="rel-card-header">
              <div>
                <h3 className="rel-card-title">📊 Funil de Status &amp; Modalidade de Serviço</h3>
                <p className="rel-card-sub">Volume por status de contrato e tipo de montagem</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {/* STATUS */}
              <div style={{ background: 'var(--fundo-cinza, #f8fafc)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--borda, #e2e8f0)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--texto-secundario, #334155)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>📑 Status dos Contratos</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {statusContagem.map(([st, count], idx) => (
                    <span key={idx} style={{ background: 'var(--fundo-card, #ffffff)', border: '1px solid var(--borda, #cbd5e1)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--texto-principal, #0f172a)' }}>
                      {st}: <strong>{count} pedidos</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* MODALIDADES */}
              <div style={{ background: 'var(--fundo-cinza, #f8fafc)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--borda, #e2e8f0)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--texto-secundario, #334155)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🎈 Modalidade da Festa</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: 'var(--fundo-card, #ffffff)', border: '1px solid var(--borda, #cbd5e1)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6' }}>
                    ✨ Decoração Completa: <strong>{qtdDecoracao}</strong>
                  </span>
                  <span style={{ background: 'var(--fundo-card, #ffffff)', border: '1px solid var(--borda, #cbd5e1)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                    🎈 Pegue e Monte: <strong>{qtdPegueMonte}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TABELA DE PEDIDOS */}
      <div className="rel-card-unificado">
        <div className="rel-card-header">
          <div>
            <h3 className="rel-card-title">📋 Histórico de Pedidos &amp; Locações ({pedidosFiltrados.length})</h3>
            <p className="rel-card-sub">Listagem detalhada com filtros de data, status e modalidade.</p>
          </div>

          <div className="rel-card-actions">
            <button 
              type="button" 
              onClick={alternarIndicadores}
              className="rel-btn-action-outline"
            >
              {mostrarIndicadores ? '👁️ Ocultar Indicadores' : '📊 Ver Indicadores & KPIs'}
            </button>
            <button 
              type="button" 
              onClick={exportarCSVPedidos}
              className="rel-btn-action-outline"
            >
              📊 Exportar Excel (CSV)
            </button>
            <button type="button" className="btn-export-pdf" onClick={exportarPDFPedidos}>
              📄 Baixar Pedidos (PDF)
            </button>
          </div>
        </div>

        {/* BARRA DE PESQUISA, PERÍODO E STATUS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar por cliente, pedido # ou tema..." 
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
              style={{ width: '100%', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#ffffff', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.74rem', fontWeight: 'bold', color: '#0f172a', background: '#ffffff', outline: 'none' }}
            >
              <option value="">📆 Mês: Todos</option>
              {NOMES_MESES.map((m, idx) => (
                <option key={idx} value={String(idx + 1).padStart(2, '0')}>{m}</option>
              ))}
            </select>

            <select
              value={filtroAno}
              onChange={e => setFiltroAno(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.74rem', fontWeight: 'bold', color: '#0f172a', background: '#ffffff', outline: 'none' }}
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
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.74rem', fontWeight: '800', color: '#0f172a', background: '#ffffff', outline: 'none' }}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="FECHADOS">🟢 Confirmados / Fechados</option>
              <option value="ORÇAMENTOS">🟡 Orçamentos</option>
              <option value="PEGUE_MONTE">🎈 Pegue e Monte</option>
              <option value="DECORACAO">✨ Decoração Completa</option>
              <option value="CANCELADOS">🔴 Cancelados</option>
            </select>
          </div>
        </div>

        {/* RESUMO DO FILTRO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: '#f1f5f9', borderRadius: '8px', marginBottom: '10px', fontSize: '0.74rem', color: '#475569', fontWeight: 'bold' }}>
          <span>Total do Filtro: <strong>{pedidosFiltrados.length} pedidos</strong></span>
          <div style={{ display: 'flex', gap: '14px' }}>
            <span>Faturamento: <strong style={{ color: '#15803d' }}>R$ {totaisFiltro.soma.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></span>
            <span>Ticket Médio: <strong style={{ color: '#1d4ed8' }}>R$ {totaisFiltro.media.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></span>
          </div>
        </div>

        <div className="table-container" style={{ marginTop: '10px' }}>
          <table className="custom-table table-pro">
            <thead>
              <tr>
                <th>PEDIDO #</th>
                <th>CLIENTE / TEMA</th>
                <th style={{textAlign: 'center'}}>DATA FESTA</th>
                <th style={{textAlign: 'center'}}>MODALIDADE</th>
                <th style={{textAlign: 'right'}}>VALOR TOTAL</th>
                <th style={{textAlign: 'center'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhum pedido encontrado com os filtros aplicados.</td>
                </tr>
              ) : (
                pedidosFiltrados.map((p, idx) => (
                  <tr key={idx}>
                    <td><strong style={{color: '#0f172a'}}>#{p.numero}</strong></td>
                    <td>
                      <div style={{ color: '#0f172a', fontWeight: 700 }}>{p.cliente}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.tema}</div>
                    </td>
                    <td style={{textAlign: 'center', color: '#64748b', fontWeight: '600'}}>{p.dataStr}</td>
                    <td style={{textAlign: 'center'}}><span className="badge-categoria">{p.tipoServico}</span></td>
                    <td style={{textAlign: 'right', fontWeight: '850', color: '#10b981'}}>
                      R$ {p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <span className={`badge-dre ${p.status.includes('CANCELADO') ? 'despesa' : 'receita'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default PedidosTab;