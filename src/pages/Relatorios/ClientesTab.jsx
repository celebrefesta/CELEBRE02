import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './ClientesTab.css';

const ClientesTab = ({ mostrarIndicadores = true, alternarIndicadores }) => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState('TODOS'); // 'TODOS' | 'VIP' | 'ATIVOS' | 'INATIVOS'

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
    nomeEmpresa: 'Celebre Festas',
    logotipo: '',
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
      console.error("Erro ao gravar log da auditoria de clientes:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) return;

    const buscarDadosClientesEConfigs = async () => {
      try {
        const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const docConfigRef = doc(db, "configuracoes_empresa", tenantId);

        const [snapClientes, snapLocacoes, snapConfig] = await Promise.all([
          getDocs(qClientes),
          getDocs(qLocacoes),
          getDoc(docConfigRef).catch(() => ({ exists: () => false }))
        ]);

        if (snapConfig.exists && snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeFantasia || configData.razaoSocial || configData.nome || 'Celebre Festas',
            logotipo: configData.logo || configData.logotipo || '',
            cnpj: configData.cnpj || '',
            endereco: configData.endereco || ''
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
          const st = String(loc.status || '').toLowerCase();
          if (st.includes('cancel')) return;

          const valor = Number(loc.valorTotal || loc.total || 0);
          somaTotal += valor;
          const cidade = loc.logistica?.cidade || loc.cidade || "Retirada na Loja";
          cidadesCount[cidade] = (cidadesCount[cidade] || 0) + 1;

          const cid = loc.clienteId;
          if (cid) {
            if (!clientesStats[cid]) {
              clientesStats[cid] = { 
                id: cid,
                nome: loc.clienteNome || 'Cliente', 
                telefone: loc.clienteTelefone || loc.telefone || '',
                qtdLocacoes: 0, 
                gastoTotal: 0, 
                ultimaLocacao: new Date(0) 
              };
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
          const stat = clientesStats[c.id] || { qtdLocacoes: 0, gastoTotal: 0, ultimaLocacao: null, telefone: c.telefone || c.celular || '' };
          let isInativo = false;
          if (!stat.ultimaLocacao || stat.ultimaLocacao.getTime() === 0) {
            const criacao = c.criadoEm?.toDate ? c.criadoEm.toDate() : new Date(c.criadoEm || 0);
            if (criacao < seisMesesAtras) isInativo = true;
          } else if (stat.ultimaLocacao < seisMesesAtras) {
            isInativo = true;
          }
          if (isInativo) inativosCount++;

          // Classificação VIP
          let seloVIP = null;
          if (stat.gastoTotal >= 5000) seloVIP = { label: '⭐ VIP Ouro', bg: '#fefce8', color: '#a16207' };
          else if (stat.gastoTotal >= 2000) seloVIP = { label: '✨ VIP Prata', bg: '#f8fafc', color: '#334155' };
          else if (stat.gastoTotal >= 800 || stat.qtdLocacoes >= 2) seloVIP = { label: '⭐ VIP', bg: '#eff6ff', color: '#1d4ed8' };

          return {
            id: c.id,
            nome: c.nome || c.nomeFantasia || c.razaoSocial || "Sem Nome",
            cidade: c.cidade || "Não informada",
            telefone: c.telefone || c.celular || stat.telefone || '',
            festas: stat.qtdLocacoes,
            totalGasto: stat.gastoTotal,
            seloVIP,
            status: isInativo ? "Inativo" : "Ativo",
            ultimaLocacaoStr: stat.ultimaLocacao && stat.ultimaLocacao.getTime() > 0 ? stat.ultimaLocacao.toLocaleDateString('pt-BR') : 'Nunca alugou'
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
        setTodosClientesData(clientesFormatadosRelatorio.sort((a, b) => b.totalGasto - a.totalGasto));

      } catch (error) { 
        console.error("Erro ao carregar dados dos clientes:", error);
      } finally { 
        setLoading(false); 
      }
    };
    
    buscarDadosClientesEConfigs();
  }, [usuarioLogado, tenantId]);

  // FILTRAGEM DINÂMICA
  const clientesFiltrados = useMemo(() => {
    return todosClientesData.filter(c => {
      const matchBusca = termoBusca === '' ||
        c.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
        c.cidade.toLowerCase().includes(termoBusca.toLowerCase()) ||
        c.telefone.includes(termoBusca);

      if (!matchBusca) return false;

      if (filtroSegmento === 'VIP') return !!c.seloVIP;
      if (filtroSegmento === 'ATIVOS') return c.status === 'Ativo';
      if (filtroSegmento === 'INATIVOS') return c.status === 'Inativo';
      return true;
    });
  }, [todosClientesData, termoBusca, filtroSegmento]);

  // EXPORTAR CSV (EXCEL)
  const exportarCSVClientes = () => {
    const cabecalho = ["Nome", "Telefone", "Cidade", "Qtd Festas", "Total Gasto (R$)", "Status", "Ultima Locacao"];
    const linhas = clientesFiltrados.map(c => [
      `"${c.nome.replace(/"/g, '""')}"`,
      `"${c.telefone}"`,
      `"${c.cidade}"`,
      `"${c.festas}"`,
      `"${c.totalGasto.toFixed(2).replace('.', ',')}"`,
      `"${c.status}"`,
      `"${c.ultimaLocacaoStr}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Clientes_${dadosEmpresa.nomeEmpresa.replace(/[^\w\s-]/gi, '')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    registrarLog("EXPORTACAO_CSV_CLIENTES", `Exportou lista de clientes em CSV (${clientesFiltrados.length} registros).`);
  };

  // EXPORTAR PDF
  const exportarRelatorioGeral = async () => {
    try {
      const docPDF = new jsPDF();
      let startY = 22; 

      docPDF.setFontSize(18);
      docPDF.setTextColor(15, 23, 42);
      docPDF.text(dadosEmpresa.nomeEmpresa, 14, startY);

      docPDF.setFontSize(9);
      docPDF.setTextColor(100);
      docPDF.text(`RELATÓRIO DE CLIENTES & CRM · Filtro: ${filtroSegmento}`, 14, startY + 6);
      docPDF.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} · Total: ${clientesFiltrados.length} clientes`, 14, startY + 11);

      const tableColumn = ["Nome do Cliente", "Telefone", "Cidade", "Locações", "Total Gasto (R$)", "Status"];
      const tableRows = clientesFiltrados.map(c => [
        c.nome,
        c.telefone || '-',
        c.cidade,
        c.festas,
        `R$ ${c.totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        c.status
      ]);

      autoTable(docPDF, {
        head: [tableColumn],
        body: tableRows,
        startY: startY + 16,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8.5 },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
      });

      docPDF.save(`Relatorio_Clientes_${dadosEmpresa.nomeEmpresa.replace(/[^\w\s-]/gi, '')}_${new Date().toISOString().split('T')[0]}.pdf`);
      await registrarLog("EXPORTAÇÃO DE RELATÓRIO DE CLIENTES", `Baixou a lista de carteira de clientes em PDF.`);
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    }
  };

  // WHATSAPP RÁPIDO CRM
  const abrirWhatsAppCliente = (cliente) => {
    const fone = String(cliente.telefone || '').replace(/\D/g, '');
    if (!fone) {
      alert("Este cliente não possui telefone cadastrado.");
      return;
    }
    const numLimpo = fone.length <= 11 ? `55${fone}` : fone;
    const msg = encodeURIComponent(`Olá ${cliente.nome}! Tudo bem? Aqui é da ${dadosEmpresa.nomeEmpresa}. Estamos com novas decorações e condições especiais para os seus próximos eventos. Como podemos te ajudar? 🎉`);
    window.open(`https://wa.me/${numLimpo}?text=${msg}`, '_blank');
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>Analisando carteira de clientes e CRM...</div>;

  const topClienteNome = topClientes.length > 0 ? topClientes[0].nome : 'Nenhum';
  const topClienteGasto = topClientes.length > 0 ? topClientes[0].gastoTotal : 0;
  const topCidadeNome = rankingCidades.length > 0 ? rankingCidades[0][0] : 'Não especificada';

  return (
    <div className="fade-in">
      
      {mostrarIndicadores && (
        <>
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
        </>
      )}

      {/* TABELA GERAL DE CLIENTES */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>📋 Carteira Completa de Clientes ({clientesFiltrados.length})</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Listagem segmentada com histórico de festas e LTV.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              type="button" 
              onClick={alternarIndicadores}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {mostrarIndicadores ? '👁️ Ocultar Indicadores' : '📊 Ver Indicadores & KPIs'}
            </button>
            <button 
              type="button" 
              onClick={exportarCSVClientes}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📊 Exportar Excel (CSV)
            </button>
            <button type="button" className="btn-export-pdf" onClick={exportarRelatorioGeral}>
              📄 Baixar Carteira (PDF)
            </button>
          </div>
        </div>

        {/* BARRA DE PESQUISA & SEGMENTAÇÃO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar por nome, cidade ou telefone..." 
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
              style={{ width: '100%', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#ffffff', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('TODOS')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroSegmento === 'TODOS' ? '1.5px solid #0f172a' : '1px solid #cbd5e1', background: filtroSegmento === 'TODOS' ? '#0f172a' : '#ffffff', color: filtroSegmento === 'TODOS' ? '#ffffff' : '#334155', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              Todos ({todosClientesData.length})
            </button>
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('VIP')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroSegmento === 'VIP' ? '1.5px solid #a16207' : '1px solid #cbd5e1', background: filtroSegmento === 'VIP' ? '#fefce8' : '#ffffff', color: '#a16207', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              ⭐ Clientes VIP
            </button>
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('ATIVOS')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroSegmento === 'ATIVOS' ? '1.5px solid #16a34a' : '1px solid #cbd5e1', background: filtroSegmento === 'ATIVOS' ? '#f0fdf4' : '#ffffff', color: '#15803d', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              🟢 Ativos
            </button>
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('INATIVOS')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroSegmento === 'INATIVOS' ? '1.5px solid #dc2626' : '1px solid #cbd5e1', background: filtroSegmento === 'INATIVOS' ? '#fef2f2' : '#ffffff', color: '#dc2626', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              ⚪ Inativos (&gt;6m)
            </button>
          </div>
        </div>

        <div className="table-container" style={{ marginTop: '10px' }}>
          <table className="custom-table table-pro">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>CIDADE / CONTATO</th>
                <th style={{textAlign: 'center'}}>Nº FESTAS</th>
                <th style={{textAlign: 'right'}}>GASTO TOTAL (LTV)</th>
                <th style={{textAlign: 'center'}}>STATUS</th>
                <th style={{textAlign: 'center', width: '90px'}}>AÇÃO CRM</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhum cliente encontrado para os filtros selecionados.</td>
                </tr>
              ) : (
                clientesFiltrados.map((c, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{color: '#0f172a'}}>{c.nome}</strong>
                        {c.seloVIP && (
                          <span style={{ fontSize: '0.64rem', fontWeight: '850', padding: '2px 6px', borderRadius: '6px', background: c.seloVIP.bg, color: c.seloVIP.color, border: '1px solid #cbd5e1' }}>
                            {c.seloVIP.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Última locação: {c.ultimaLocacaoStr}</div>
                    </td>
                    <td>
                      <div style={{ color: '#334155', fontWeight: 600 }}>{c.cidade}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.telefone || 'Sem telefone'}</div>
                    </td>
                    <td style={{textAlign: 'center', fontWeight: '850', color: '#0f172a'}}>{c.festas}</td>
                    <td style={{textAlign: 'right', fontWeight: '850', color: '#10b981'}}>
                      R$ {c.totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <span className={`badge-dre ${c.status === 'Ativo' ? 'receita' : 'despesa'}`}>
                        {c.status === 'Ativo' ? '🟢 Ativo' : '⚪ Inativo'}
                      </span>
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <button 
                        type="button" 
                        onClick={() => abrirWhatsAppCliente(c)}
                        style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', fontSize: '0.74rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Enviar mensagem WhatsApp"
                      >
                        💬 WhatsApp
                      </button>
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