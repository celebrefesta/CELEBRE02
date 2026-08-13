import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './ClientesTab.css';

const ClientesTab = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ 
    total: 0, 
    novosMes: 0, 
    inativos: 0, 
    ticketMedio: 0,
    clientesFieis: 0,
    taxaRetorno: 0 
  });

  const [rankingCidades, setRankingCidades] = useState([]);
  const [topClientes, setTopClientes] = useState([]);
  const [todosClientesData, setTodosClientesData] = useState([]);

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
      console.error("Erro ao gravar log da auditoria de clientes:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) return;

    const buscarDadosClientesEConfigs = async () => {
      try {
        const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));

        const [snapClientes, snapLocacoes, snapConfig] = await Promise.all([
          getDocs(qClientes),
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

        const clientes = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));

        const totalClientes = clientes.length;
        const hoje = new Date();
        const novosMes = clientes.filter(c => {
          if (!c.criadoEm) return false;
          const d = c.criadoEm.toDate ? c.criadoEm.toDate() : new Date(c.criadoEm);
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        }).length;

        let somaTotal = 0;
        const cidadesCount = {};
        const clientesStats = {};

        locacoes.forEach(loc => {
          const valor = Number(loc.valorTotal) || 0;
          somaTotal += valor;
          const cidade = loc.logistica?.cidade || "Retirada na Loja";
          cidadesCount[cidade] = (cidadesCount[cidade] || 0) + 1;

          const cid = loc.clienteId;
          if (cid) {
            if (!clientesStats[cid]) {
              clientesStats[cid] = { nome: loc.clienteNome || 'Cliente', qtdLocacoes: 0, gastoTotal: 0, ultimaLocacao: new Date(0) };
            }
            clientesStats[cid].qtdLocacoes += 1;
            clientesStats[cid].gastoTotal += valor;
            let dataLoc = loc.dataRetirada ? new Date(loc.dataRetirada) : (loc.criadoEm?.toDate ? loc.criadoEm.toDate() : new Date(0));
    
            if (dataLoc > clientesStats[cid].ultimaLocacao) clientesStats[cid].ultimaLocacao = dataLoc;
          }
        });

        const ticketMedio = locacoes.length > 0 ? (somaTotal / locacoes.length) : 0;
        const seisMesesAtras = new Date();
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

        const listaStats = Object.values(clientesStats);
        const clientesFieis = listaStats.filter(c => c.qtdLocacoes > 1).length;
        const taxaRetorno = totalClientes > 0 ? Math.round((clientesFieis / totalClientes) * 100) : 0;

        let inativosCount = 0;

        const clientesFormatadosRelatorio = clientes.map(c => {
          const stat = clientesStats[c.id] || { qtdLocacoes: 0, gastoTotal: 0, ultimaLocacao: null };
          let isInativo = false;
          if (!stat.ultimaLocacao) {
            const criacao = c.criadoEm?.toDate ? c.criadoEm.toDate() : new Date(c.criadoEm || 0);
            if (criacao < seisMesesAtras) isInativo = true;
          } else if (stat.ultimaLocacao < seisMesesAtras) {
            isInativo = true;
          }
          if (isInativo) inativosCount++;

          return {
            nome: c.nome || c.nomeFantasia || "Sem Nome",
            cidade: c.cidade || "Não inf.",
            festas: stat.qtdLocacoes,
            totalGasto: stat.gastoTotal,
            status: isInativo ? "Inativo" : "Ativo"
          };
        });

        setMetricas({ 
          total: totalClientes, 
          novosMes, 
          inativos: inativosCount, 
          ticketMedio,
          clientesFieis,
          taxaRetorno
        });

        setRankingCidades(Object.entries(cidadesCount).sort((a, b) => b[1] - a[1]).slice(0, 5));
        setTopClientes(listaStats.sort((a, b) => b.gastoTotal - a.gastoTotal).slice(0, 5));
        setTodosClientesData(clientesFormatadosRelatorio);

      } catch (error) { 
        console.error(error);
      } finally { 
        setLoading(false); 
      }
    };
    
    buscarDadosClientesEConfigs();
  }, [usuarioLogado, tenantId]);

  const exportarRelatorioGeral = async () => {
    try {
      const docPDF = new jsPDF();
      let startY = 25; 

      if (dadosEmpresa.logotipo && dadosEmpresa.logotipo.startsWith('data:image')) {
        try {
          docPDF.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 30, 30);
        } catch(e) {}
        docPDF.setFontSize(18);
        docPDF.setTextColor(15, 23, 42);
        docPDF.text(dadosEmpresa.nomeEmpresa, 48, 22);
        docPDF.setFontSize(10);
        docPDF.setTextColor(100, 116, 139);
        docPDF.text("Relatório Executivo de Clientes e CRM", 48, 30);
        startY = 48;
      } else {
        docPDF.setFontSize(18);
        docPDF.setTextColor(15, 23, 42);
        docPDF.text(`Relatório de Clientes - ${dadosEmpresa.nomeEmpresa}`, 14, 20);
        startY = 35;
      }

      docPDF.setFontSize(10);
      docPDF.setTextColor(100);
      docPDF.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 160, startY - 5);

      const tableColumn = ["Nome do Cliente", "Cidade", "Locações", "Total Gasto (R$)", "Status"];
      const tableRows = todosClientesData.map(c => [
        c.nome,
        c.cidade,
        c.festas,
        `R$ ${c.totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        c.status
      ]);

      autoTable(docPDF, {
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      docPDF.save(`Relatorio_Clientes_${new Date().toISOString().split('T')[0]}.pdf`);
      await registrarLog("EXPORTAÇÃO DE RELATÓRIO DE CLIENTES", "Baixou a lista geral de carteira de clientes em PDF.");
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>Analisando carteira de clientes...</div>;

  const topClienteNome = topClientes.length > 0 ? topClientes[0].nome : 'Nenhum';
  const topClienteGasto = topClientes.length > 0 ? topClientes[0].gastoTotal : 0;
  const topCidadeNome = rankingCidades.length > 0 ? rankingCidades[0][0] : 'Não especificada';

  return (
    <div className="fade-in">
      
      {/* 💡 PAINEL DE INSIGHTS INTELIGENTES CLIENTES */}
      <div style={{ background: '#ffffff', color: '#0f172a', border: '1.5px solid #e2e8f0', borderLeft: '5px solid #3b82f6', padding: '14px 18px', borderRadius: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.3rem' }}>💎</span>
          <div>
            <strong style={{ fontSize: '0.82rem', color: '#0f172a', letterSpacing: '0.4px', textTransform: 'uppercase' }}>CLIENTE DE MAIOR LTV &amp; REGIÃO PRINCIPAL</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Cliente principal: <strong>{topClienteNome}</strong> (R$ {topClienteGasto.toLocaleString('pt-BR')}). Cidade líder em eventos: <strong>{topCidadeNome}</strong>.
            </p>
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', background: '#f8fafc', color: '#3b82f6', border: '1px solid #cbd5e1' }}>
          Retorno: {metricas.taxaRetorno}%
        </span>
      </div>

      {/* 4 CARDS KPI BLINDADOS (GOLDEN RULE 1 & 2) */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro card-green">
          <div className="stat-icon-wrapper icon-green">👥</div>
          <div className="stat-content">
            <span className="stat-title">TOTAL DE CLIENTES</span>
            <strong className="stat-number">{metricas.total}</strong>
            <small className="stat-desc">Base cadastrada</small>
          </div>
        </div>

        <div className="stat-card-pro card-amber">
          <div className="stat-icon-wrapper icon-amber">✨</div>
          <div className="stat-content">
            <span className="stat-title">NOVOS NESTE MÊS</span>
            <strong className="stat-number">+{metricas.novosMes}</strong>
            <small className="stat-desc">Crescimento recente</small>
          </div>
        </div>

        <div className="stat-card-pro card-purple">
          <div className="stat-icon-wrapper icon-purple">💳</div>
          <div className="stat-content">
            <span className="stat-title">TICKET MÉDIO (LTV)</span>
            <strong className="stat-number">R$ {metricas.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Valor por locação</small>
          </div>
        </div>

        <div className="stat-card-pro card-red">
          <div className="stat-icon-wrapper icon-red">🔁</div>
          <div className="stat-content">
            <span className="stat-title">TAXA DE FIDELIDADE</span>
            <strong className="stat-number">{metricas.taxaRetorno}%</strong>
            <small className="stat-desc">{metricas.clientesFieis} clientes recorrentes</small>
          </div>
        </div>
      </div>

      {/* 📊 WIDGET COMPACTO DE RANKING DE CLIENTES VIP & REGIÕES */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #e2e8f0', padding: '16px 20px', margin: '16px 0', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: '850' }}>🏆 Top Clientes VIP &amp; Cidades Líderes</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>Maiores investidores e concentração geográfica de eventos</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {/* PAINEL CLIENTES VIP */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 850, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🥇 Top 3 Clientes em Faturamento</span>
            {topClientes.slice(0, 3).map((c, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', margin: '4px 0' }}>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{idx + 1}º {c.nome}</span>
                <span style={{ color: '#10b981', fontWeight: 850 }}>R$ {c.gastoTotal.toLocaleString('pt-BR')}</span>
              </div>
            ))}
            {topClientes.length === 0 && <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Sem lançamentos acumulados.</span>}
          </div>

          {/* PAINEL CIDADES */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 850, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>📍 Top Cidades em Festas</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {rankingCidades.map(([cidade, count], idx) => (
                <span key={idx} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6' }}>
                  {cidade}: <strong>{count} festas</strong>
                </span>
              ))}
              {rankingCidades.length === 0 && <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Sem cidades registradas.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* TABELA GERAL DE CLIENTES */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>📋 Carteira Completa de Clientes</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Listagem de clientes com total de festas e LTV.</p>
          </div>
          <button type="button" className="btn-export-pdf" onClick={exportarRelatorioGeral}>
            📄 Baixar Carteira (PDF)
          </button>
        </div>

        <div className="table-container" style={{ marginTop: '15px' }}>
          <table className="custom-table table-pro">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>CIDADE</th>
                <th style={{textAlign: 'center'}}>Nº FESTAS</th>
                <th style={{textAlign: 'right'}}>GASTO TOTAL (R$)</th>
                <th style={{textAlign: 'center'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {todosClientesData.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhum cliente cadastrado.</td>
                </tr>
              ) : (
                todosClientesData.map((c, idx) => (
                  <tr key={idx}>
                    <td><strong style={{color: '#0f172a'}}>{c.nome}</strong></td>
                    <td style={{color: '#64748b'}}>{c.cidade}</td>
                    <td style={{textAlign: 'center', fontWeight: '700'}}>{c.festas}</td>
                    <td style={{textAlign: 'right', fontWeight: '850', color: '#10b981'}}>
                      R$ {c.totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <span className={`badge-dre ${c.status === 'Ativo' ? 'receita' : 'despesa'}`}>
                        {c.status === 'Ativo' ? '🟢 Ativo' : '⚪ Inativo'}
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

export default ClientesTab;