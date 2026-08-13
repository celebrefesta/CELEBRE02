import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './PedidosTab.css';

const PedidosTab = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ 
    total: 0, 
    faturamento: 0, 
    futuros: 0 
  });
  const [statusContagem, setStatusContagem] = useState([]);
  const [pedidosLista, setPedidosLista] = useState([]);
  const [filtroAtual, setFiltroAtual] = useState('TODOS');
  const [taxaConversao, setTaxaConversao] = useState(0);

  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: ''
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

        const [snapLocacoes, snapConfig] = await Promise.all([
          getDocs(qLocacoes),
          getDoc(doc(db, "sistema", "parametros")).catch(() => ({ exists: () => false }))
        ]);

        if (snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeEmpresa || 'Ágape Decorações',
            logotipo: configData.logotipo || ''
          });
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
          const valor = Number(loc.valorTotal) || 0;
          faturamentoTotal += valor;

          const statusRaw = loc.status || 'Pendente';
          const statusLimpo = String(statusRaw).toUpperCase().trim();
          contagemStatus[statusLimpo] = (contagemStatus[statusLimpo] || 0) + 1;

          let dataFesta = null;
          if (loc.dataRetirada) {
            dataFesta = new Date(loc.dataRetirada.includes('T') ? loc.dataRetirada : `${loc.dataRetirada}T12:00:00`);
          } else if (loc.criadoEm?.toDate) {
            dataFesta = loc.criadoEm.toDate();
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
            dataObj: dataFesta,
            dataStr: dataFesta ? dataFesta.toLocaleDateString('pt-BR') : "Sem data",
            valor: valor,
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

  const pedidosFiltrados = pedidosLista.filter(p => {
    if (filtroAtual === 'TODOS') return true;
    if (filtroAtual === 'ORÇAMENTOS') return p.status.includes('ORÇAMENTO') || p.status.includes('ORCAMENTO') || p.status.includes('PENDENTE');
    if (filtroAtual === 'FECHADOS') return !p.status.includes('ORÇAMENTO') && !p.status.includes('ORCAMENTO') && !p.status.includes('PENDENTE') && !p.status.includes('CANCELADO');
    if (filtroAtual === 'CANCELADOS') return p.status.includes('CANCELADO');
    if (filtroAtual === 'PEGUE_MONTE') return p.tipoServico.includes('PEGUE');
    if (filtroAtual === 'DECORACAO') return !p.tipoServico.includes('PEGUE');
    return true;
  });

  const exportarPDFPedidos = async () => {
    try {
      const doc = new jsPDF();
      let startY = 25;

      if (dadosEmpresa.logotipo && dadosEmpresa.logotipo.startsWith('data:image')) {
        try {
          doc.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 30, 30);
        } catch(e) {}
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text(dadosEmpresa.nomeEmpresa, 48, 22);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("Relatório Comercial de Pedidos e Locações", 48, 30);
        startY = 48;
      } else {
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text(`Relatório de Pedidos - ${dadosEmpresa.nomeEmpresa}`, 14, 20);
        startY = 35;
      }

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 160, startY - 5);

      const tableColumn = ["Pedido #", "Cliente", "Data Festa", "Modalidade", "Valor (R$)", "Status"];
      const tableRows = pedidosFiltrados.map(p => [
        `#${p.numero}`,
        p.cliente,
        p.dataStr,
        p.tipoServico,
        `R$ ${p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        p.status
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Relatorio_Pedidos_${new Date().toISOString().split('T')[0]}.pdf`);
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
      
      {/* 💡 PAINEL DE INSIGHTS INTELIGENTES PEDIDOS */}
      <div style={{ background: '#ffffff', color: '#0f172a', border: '1.5px solid #e2e8f0', borderLeft: '5px solid #8b5cf6', padding: '14px 18px', borderRadius: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.3rem' }}>🎯</span>
          <div>
            <strong style={{ fontSize: '0.82rem', color: '#0f172a', letterSpacing: '0.4px', textTransform: 'uppercase' }}>DESEMPENHO COMERCIAL &amp; CONVERSÃO DE VENDAS</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Sua taxa de fechamento é de <strong style={{ color: '#10b981' }}>{taxaConversao}%</strong>. Existem <strong style={{ color: '#3b82f6' }}>{metricas.futuros} eventos agendados</strong> no calendário futuro.
            </p>
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', background: '#f8fafc', color: '#8b5cf6', border: '1px solid #cbd5e1' }}>
          Conversão: {taxaConversao}%
        </span>
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
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #e2e8f0', padding: '16px 20px', margin: '16px 0', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: '850' }}>📊 Funil de Status &amp; Modalidade de Serviço</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>Volume por status de contrato e tipo de montagem</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {/* STATUS */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 850, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>📑 Status dos Contratos</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {statusContagem.map(([st, count], idx) => (
                <span key={idx} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                  {st}: <strong>{count} pedidos</strong>
                </span>
              ))}
            </div>
          </div>

          {/* MODALIDADES */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 850, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🎈 Modalidade da Festa</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6' }}>
                ✨ Decoração Completa: <strong>{qtdDecoracao}</strong>
              </span>
              <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                🎈 Pegue e Monte: <strong>{qtdPegueMonte}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABELA DE PEDIDOS */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>📋 Histórico de Pedidos &amp; Locações</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Listagem de contratos com filtros rápidos.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select 
              value={filtroAtual} 
              onChange={e => setFiltroAtual(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', background: '#f8fafc', outline: 'none' }}
            >
              <option value="TODOS">Todos os Registros</option>
              <option value="FECHADOS">🟢 Confirmados / Fechados</option>
              <option value="ORÇAMENTOS">🟡 Orçamentos</option>
              <option value="PEGUE_MONTE">🎈 Pegue e Monte</option>
              <option value="DECORACAO">✨ Decoração Completa</option>
              <option value="CANCELADOS">🔴 Cancelados</option>
            </select>

            <button type="button" className="btn-export-pdf" onClick={exportarPDFPedidos}>
              📄 Baixar Pedidos (PDF)
            </button>
          </div>
        </div>

        <div className="table-container" style={{ marginTop: '15px' }}>
          <table className="custom-table table-pro">
            <thead>
              <tr>
                <th>PEDIDO #</th>
                <th>CLIENTE</th>
                <th style={{textAlign: 'center'}}>DATA FESTA</th>
                <th style={{textAlign: 'center'}}>MODALIDADE</th>
                <th style={{textAlign: 'right'}}>VALOR TOTAL</th>
                <th style={{textAlign: 'center'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhum pedido encontrado.</td>
                </tr>
              ) : (
                pedidosFiltrados.map((p, idx) => (
                  <tr key={idx}>
                    <td><strong style={{color: '#0f172a'}}>#{p.numero}</strong></td>
                    <td style={{color: '#334155', fontWeight: 600}}>{p.cliente}</td>
                    <td style={{textAlign: 'center', color: '#64748b'}}>{p.dataStr}</td>
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