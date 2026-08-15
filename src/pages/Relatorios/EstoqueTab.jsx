import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './EstoqueTab.css';

const EstoqueTab = ({ mostrarIndicadores = true, alternarIndicadores }) => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS'); // 'TODOS' | 'DISPONIVEL' | 'MANUTENCAO' | 'PARADO'

  const [metricas, setMetricas] = useState({ 
    totalPecas: 0, 
    tiposDiferentes: 0, 
    emManutencao: 0,
    investimentoTotal: 0,
    faturamentoGeradoTotal: 0
  });

  const [rankingTemas, setRankingTemas] = useState([]);
  const [rankingCategorias, setRankingCategorias] = useState([]); 
  const [estoqueListaCompleta, setEstoqueListaCompleta] = useState([]);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);

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
      console.error("Erro ao gravar log da auditoria de estoque:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) return;

    const buscarDadosEstoqueEConfigs = async () => {
      try {
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const qCompras = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
        const docConfigRef = doc(db, "configuracoes_empresa", tenantId);

        const [snapEstoque, snapLocacoes, snapCompras, snapConfig] = await Promise.all([
          getDocs(qEstoque),
          getDocs(qLocacoes),
          getDocs(qCompras).catch(() => ({ docs: [] })),
          getDoc(docConfigRef).catch(() => ({ exists: () => false }))
        ]);

        if (snapConfig.exists && snapConfig.exists()) {
          const cfg = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: cfg.nomeFantasia || cfg.razaoSocial || cfg.nome || 'Celebre Festas',
            logotipo: cfg.logo || cfg.logotipo || '',
            cnpj: cfg.cnpj || '',
            endereco: cfg.endereco || ''
          });
        }

        const estoque = snapEstoque.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));
        const compras = snapCompras.docs.map(d => ({ id: d.id, ...d.data() }));

        // Contagem de locações por item (Giro do Acervo)
        const giroPorItem = {};
        const temasMap = {};

        locacoes.forEach(loc => {
          const st = String(loc.status || '').toLowerCase();
          if (st.includes('cancel')) return;

          const tema = loc.temaFesta || loc.tema || loc.nomeEvento || 'Decoração Geral';
          temasMap[tema] = (temasMap[tema] || 0) + 1;

          if (loc.itens && Array.isArray(loc.itens)) {
            loc.itens.forEach(item => {
              const itemId = item.id || item.pecaId || item.nome;
              if (itemId) {
                if (!giroPorItem[itemId]) giroPorItem[itemId] = { qtdLocacoes: 0, faturamentoGerado: 0 };
                const qtd = Number(item.quantidade) || 1;
                giroPorItem[itemId].qtdLocacoes += qtd;
                giroPorItem[itemId].faturamentoGerado += (Number(item.preco) || Number(item.valorUnitario) || 0) * qtd;
              }
            });
          }
        });

        let totalPecas = 0;
        let emManutencao = 0;
        const categoriasMap = {};

        const listaMapeada = estoque.map(i => {
          const qtd = Number(i.quantidade || i.qtd || 1);
          totalPecas += qtd;
          const statusLimpo = String(i.status || '').toLowerCase();
          const emReparo = statusLimpo.includes('manutenç') || statusLimpo.includes('conserto') || statusLimpo.includes('reparo') || !!i.precisaReparo;
          if (emReparo) emManutencao += qtd;

          const cat = i.categoria || 'Geral';
          categoriasMap[cat] = (categoriasMap[cat] || 0) + qtd;

          const giro = giroPorItem[i.id] || giroPorItem[i.nome] || { qtdLocacoes: 0, faturamentoGerado: 0 };
          const valorAquisicao = Number(i.valorCompra || i.custo || i.valorEstimado || 0);
          const valorLocacao = Number(i.preco || i.valorLocacao || i.valorAluguel || 0);

          let giroClass = 'PARADO';
          if (giro.qtdLocacoes >= 3) giroClass = 'ESTRELA';
          else if (giro.qtdLocacoes >= 1) giroClass = 'MODERADO';

          return {
            id: i.id,
            nome: i.nome || i.titulo || 'Item sem nome',
            categoria: cat,
            quantidade: qtd,
            valorAquisicao,
            valorLocacao,
            emManutencao: emReparo,
            status: emReparo ? 'Em Manutenção' : 'Disponível',
            qtdLocacoes: giro.qtdLocacoes,
            faturamentoGerado: giro.faturamentoGerado,
            giroClass
          };
        });

        let investimentoTotal = 0;
        compras.forEach(comp => {
          let vStr = String(comp.valorPago || comp.valorEstimado || '0').replace(/[^\d.,-]/g, '').replace(',', '.');
          investimentoTotal += (Number(vStr) || 0) * (Number(comp.quantidade) || 1);
        });

        const rankingTemasArr = Object.entries(temasMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const rankingCatArr = Object.entries(categoriasMap).sort((a, b) => b[1] - a[1]);

        setMetricas({
          totalPecas,
          tiposDiferentes: estoque.length,
          emManutencao,
          investimentoTotal
        });

        setRankingTemas(rankingTemasArr);
        setRankingCategorias(rankingCatArr);
        setCategoriasDisponiveis(Object.keys(categoriasMap));
        setEstoqueListaCompleta(listaMapeada.sort((a, b) => b.qtdLocacoes - a.qtdLocacoes));

      } catch (error) {
        console.error("Erro ao carregar relatório de estoque:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosEstoqueEConfigs();
  }, [usuarioLogado, tenantId]);

  // FILTRAGEM DINÂMICA
  const estoqueFiltrado = useMemo(() => {
    return estoqueListaCompleta.filter(item => {
      const matchBusca = termoBusca === '' ||
        item.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
        item.categoria.toLowerCase().includes(termoBusca.toLowerCase());

      if (!matchBusca) return false;

      if (filtroCategoria !== 'TODAS' && item.categoria !== filtroCategoria) return false;

      if (filtroStatus === 'DISPONIVEL') return item.status === 'Disponível';
      if (filtroStatus === 'MANUTENCAO') return item.status === 'Em Manutenção';
      if (filtroStatus === 'ESTRELA') return item.giroClass === 'ESTRELA';
      if (filtroStatus === 'PARADO') return item.giroClass === 'PARADO';

      return true;
    });
  }, [estoqueListaCompleta, termoBusca, filtroCategoria, filtroStatus]);

  // EXPORTAR CSV (EXCEL)
  const exportarCSVEstoque = () => {
    const cabecalho = ["Item / Peca", "Categoria", "Qtd Fisica", "Status", "Locacoes Realizadas", "Valor Aquisicao (R$)", "Valor Locacao (R$)"];
    const linhas = estoqueFiltrado.map(item => [
      `"${item.nome.replace(/"/g, '""')}"`,
      `"${item.categoria}"`,
      `"${item.quantidade}"`,
      `"${item.status}"`,
      `"${item.qtdLocacoes}"`,
      `"${item.valorAquisicao.toFixed(2).replace('.', ',')}"`,
      `"${item.valorLocacao.toFixed(2).replace('.', ',')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventario_${dadosEmpresa.nomeEmpresa.replace(/[^\w\s-]/gi, '')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    registrarLog("EXPORTACAO_CSV_ESTOQUE", `Exportou inventário de estoque em CSV (${estoqueFiltrado.length} itens).`);
  };

  // EXPORTAR PDF
  const exportarPDFEstoque = async () => {
    try {
      const docPDF = new jsPDF();
      let startY = 22;

      docPDF.setFontSize(18);
      docPDF.setTextColor(15, 23, 42);
      docPDF.text(dadosEmpresa.nomeEmpresa, 14, startY);
      
      docPDF.setFontSize(9);
      docPDF.setTextColor(100);
      docPDF.text(`INVENTÁRIO DE ACERVO & AUDITORIA FÍSICA · Filtro: ${filtroStatus}`, 14, startY + 6);
      docPDF.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} · Total: ${estoqueFiltrado.length} tipos de itens`, 14, startY + 11);

      const tableColumn = ["Item / Peça", "Categoria", "Qtd Física", "Giro (Festas)", "Status"];
      const tableRows = estoqueFiltrado.map(item => [
        item.nome,
        item.categoria,
        item.quantidade,
        item.qtdLocacoes,
        item.status
      ]);

      autoTable(docPDF, {
        head: [tableColumn],
        body: tableRows,
        startY: startY + 16,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8.5 },
        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' } }
      });

      docPDF.save(`Inventario_Acervo_${dadosEmpresa.nomeEmpresa.replace(/[^\w\s-]/gi, '')}_${new Date().toISOString().split('T')[0]}.pdf`);
      await registrarLog("EXPORTAÇÃO DE INVENTÁRIO", "Baixou o relatório completo de estoque em PDF.");
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>Calculando inventário e ROI do acervo...</div>;

  return (
    <div className="fade-in">
      
      {mostrarIndicadores && (
        <>
          {/* 💡 PAINEL DE INSIGHTS INTELIGENTES ESTOQUE */}
          <div style={{ background: '#ffffff', color: '#0f172a', border: '1.5px solid #e2e8f0', borderLeft: '5px solid #10b981', padding: '14px 18px', borderRadius: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.3rem' }}>📦</span>
              <div>
                <strong style={{ fontSize: '0.82rem', color: '#0f172a', letterSpacing: '0.4px', textTransform: 'uppercase' }}>SAÚDE DO ACERVO &amp; DISPONIBILIDADE FÍSICA</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Total de <strong>{metricas.totalPecas} peças físicas</strong> em acervo ({metricas.tiposDiferentes} categorias). 
                  {metricas.emManutencao > 0 ? ` ⚠️ ${metricas.emManutencao} peças em reparo.` : ' 🟢 100% das peças prontas para saída!'}
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', background: '#f8fafc', color: '#10b981', border: '1px solid #cbd5e1' }}>
              {metricas.tiposDiferentes} Categorias
            </span>
          </div>

          {/* 4 CARDS KPI BLINDADOS (GOLDEN RULE 1 & 2) */}
          <div className="clientes-stats-grid">
            <div className="stat-card-pro card-green">
              <div className="stat-icon-wrapper icon-green">📦</div>
              <div className="stat-content">
                <span className="stat-title">TOTAL DE PEÇAS</span>
                <strong className="stat-number">{metricas.totalPecas}</strong>
                <small className="stat-desc">Estoque físico total</small>
              </div>
            </div>

            <div className="stat-card-pro card-amber">
              <div className="stat-icon-wrapper icon-amber">🎨</div>
              <div className="stat-content">
                <span className="stat-title">VARIEDADE DE TIPOS</span>
                <strong className="stat-number">{metricas.tiposDiferentes}</strong>
                <small className="stat-desc">Itens distintos</small>
              </div>
            </div>

            <div className="stat-card-pro card-purple">
              <div className="stat-icon-wrapper icon-purple">🛠️</div>
              <div className="stat-content">
                <span className="stat-title">EM MANUTENÇÃO</span>
                <strong className="stat-number" style={{ color: metricas.emManutencao > 0 ? '#f59e0b' : '#10b981' }}>
                  {metricas.emManutencao}
                </strong>
                <small className="stat-desc">Necessitam reparo</small>
              </div>
            </div>

            <div className="stat-card-pro card-red">
              <div className="stat-icon-wrapper icon-red">💰</div>
              <div className="stat-content">
                <span className="stat-title">INVESTIMENTO EM ACERVO</span>
                <strong className="stat-number">R$ {metricas.investimentoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Total investido em compras</small>
              </div>
            </div>
          </div>

          {/* 📊 WIDGET COMPACTO DE CATEGORIAS E TEMAS */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #e2e8f0', padding: '16px 20px', margin: '16px 0', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: '850' }}>📊 Distribuição de Categorias &amp; Temas Mais Pedidos</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>Proporção de peças no estoque e popularidade por tema</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {/* CATEGORIAS */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 850, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>📦 Categorias Físicas</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {rankingCategorias.map(([cat, total], idx) => {
                    const pct = metricas.totalPecas > 0 ? Math.round((total / metricas.totalPecas) * 100) : 0;
                    return (
                      <span key={idx} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                        {cat}: <strong>{total} pçs ({pct}%)</strong>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* TEMAS */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 850, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🔥 Temas Campeões em Locação</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {rankingTemas.map(([tema, total], idx) => (
                    <span key={idx} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                      {tema}: <strong>{total} festas</strong>
                    </span>
                  ))}
                  {rankingTemas.length === 0 && <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Sem temas registrados.</span>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TABELA DE INVENTÁRIO */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>📦 Controle de Inventário Físico &amp; Giro ({estoqueFiltrado.length})</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Lista detalhada de peças com volume de locações realizadas.</p>
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
              onClick={exportarCSVEstoque}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📊 Exportar Excel (CSV)
            </button>
            <button type="button" className="btn-export-pdf" onClick={exportarPDFEstoque}>
              📄 Baixar Inventário (PDF)
            </button>
          </div>
        </div>

        {/* BARRA DE PESQUISA & FILTROS DE GIRO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar peça por nome..." 
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
              style={{ width: '100%', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#ffffff', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.74rem', fontWeight: 'bold', color: '#0f172a', background: '#ffffff', outline: 'none' }}
            >
              <option value="TODAS">📦 Todas as Categorias</option>
              {categoriasDisponiveis.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>

            <button 
              type="button" 
              onClick={() => setFiltroStatus('TODOS')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroStatus === 'TODOS' ? '1.5px solid #0f172a' : '1px solid #cbd5e1', background: filtroStatus === 'TODOS' ? '#0f172a' : '#ffffff', color: filtroStatus === 'TODOS' ? '#ffffff' : '#334155', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              Todos ({estoqueListaCompleta.length})
            </button>

            <button 
              type="button" 
              onClick={() => setFiltroStatus('ESTRELA')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroStatus === 'ESTRELA' ? '1.5px solid #16a34a' : '1px solid #cbd5e1', background: filtroStatus === 'ESTRELA' ? '#f0fdf4' : '#ffffff', color: '#15803d', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              🌟 Mais Alugadas
            </button>

            <button 
              type="button" 
              onClick={() => setFiltroStatus('MANUTENCAO')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroStatus === 'MANUTENCAO' ? '1.5px solid #d97706' : '1px solid #cbd5e1', background: filtroStatus === 'MANUTENCAO' ? '#fef3c7' : '#ffffff', color: '#b45309', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              🛠️ Em Reparo ({metricas.emManutencao})
            </button>

            <button 
              type="button" 
              onClick={() => setFiltroStatus('PARADO')}
              style={{ padding: '6px 12px', borderRadius: '8px', border: filtroStatus === 'PARADO' ? '1.5px solid #64748b' : '1px solid #cbd5e1', background: filtroStatus === 'PARADO' ? '#f1f5f9' : '#ffffff', color: '#475569', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer' }}
            >
              💤 Acervo Parado
            </button>
          </div>
        </div>

        <div className="table-container" style={{ marginTop: '10px' }}>
          <table className="custom-table table-pro">
            <thead>
              <tr>
                <th>ITEM / PRODUTO</th>
                <th style={{textAlign: 'center'}}>CATEGORIA</th>
                <th style={{textAlign: 'center'}}>QTD FÍSICA</th>
                <th style={{textAlign: 'center'}}>GIRO (LOCAÇÕES)</th>
                <th style={{textAlign: 'center'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {estoqueFiltrado.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhum item encontrado com os filtros aplicados.</td>
                </tr>
              ) : (
                estoqueFiltrado.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong style={{color: '#0f172a'}}>{item.nome}</strong>
                      {item.giroClass === 'ESTRELA' && (
                        <span style={{ marginLeft: '8px', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '6px', background: '#dcfce7', color: '#15803d' }}>
                          🌟 Alta Demanda
                        </span>
                      )}
                      {item.giroClass === 'PARADO' && (
                        <span style={{ marginLeft: '8px', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b' }}>
                          💤 Sem saída recente
                        </span>
                      )}
                    </td>
                    <td style={{textAlign: 'center'}}><span className="badge-categoria">{item.categoria}</span></td>
                    <td style={{textAlign: 'center', fontWeight: '850', color: item.quantidade <= 1 ? '#ef4444' : '#0f172a'}}>{item.quantidade}</td>
                    <td style={{textAlign: 'center', fontWeight: '850', color: item.qtdLocacoes > 0 ? '#10b981' : '#94a3b8'}}>
                      {item.qtdLocacoes}x
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <span className={`badge-dre ${item.status === 'Disponível' ? 'receita' : 'despesa'}`}>
                        {item.status === 'Disponível' ? '🟢 Disponível' : '🟡 Reparo'}
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

export default EstoqueTab;