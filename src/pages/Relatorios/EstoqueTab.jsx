import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './EstoqueTab.css';

const EstoqueTab = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ 
    totalPecas: 0, 
    tiposDiferentes: 0, 
    emManutencao: 0,
    investimentoTotal: 0
  });

  const [rankingTemas, setRankingTemas] = useState([]);
  const [rankingCategorias, setRankingCategorias] = useState([]); 
  const [estoqueLista, setEstoqueLista] = useState([]);

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

        const [snapEstoque, snapLocacoes, snapCompras, snapConfig] = await Promise.all([
          getDocs(qEstoque),
          getDocs(qLocacoes),
          getDocs(qCompras).catch(() => ({ docs: [] })),
          getDoc(doc(db, "sistema", "parametros")).catch(() => ({ exists: () => false }))
        ]);

        if (snapConfig.exists()) {
          const cfg = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: cfg.nomeEmpresa || 'Ágape Decorações',
            logotipo: cfg.logotipo || ''
          });
        }

        const estoque = snapEstoque.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));
        const compras = snapCompras.docs.map(d => ({ id: d.id, ...d.data() }));

        let totalPecas = 0;
        let emManutencao = 0;
        const categoriasMap = {};

        estoque.forEach(item => {
          const qtd = Number(item.quantidade) || Number(item.qtd) || 1;
          totalPecas += qtd;
          const statusLimpo = String(item.status || '').toLowerCase();
          if (statusLimpo.includes('manutenç') || statusLimpo.includes('conserto') || statusLimpo.includes('reparo') || item.precisaReparo) {
            emManutencao += qtd;
          }
          const cat = item.categoria || 'Geral';
          categoriasMap[cat] = (categoriasMap[cat] || 0) + qtd;
        });

        const temasMap = {};
        locacoes.forEach(loc => {
          const tema = loc.tema || loc.nomeEvento || 'Decoração Personalizada';
          temasMap[tema] = (temasMap[tema] || 0) + 1;
        });

        let investimentoTotal = 0;
        compras.forEach(comp => {
          let vStr = String(comp.valorEstimado || '0').replace(/[^\d.,-]/g, '').replace(',', '.');
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
        setEstoqueLista(estoque.map(i => ({
          nome: i.nome || i.titulo || 'Item sem nome',
          categoria: i.categoria || 'Geral',
          quantidade: Number(i.quantidade || i.qtd) || 1,
          status: i.precisaReparo ? 'Em Manutenção' : 'Disponível'
        })));

      } catch (error) {
        console.error("Erro ao carregar relatório de estoque:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosEstoqueEConfigs();
  }, [usuarioLogado, tenantId]);

  const exportarPDFEstoque = async () => {
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
        docPDF.text("Inventário Físico & Valoração de Acervo", 48, 30);
        startY = 48;
      } else {
        docPDF.setFontSize(18);
        docPDF.setTextColor(15, 23, 42);
        docPDF.text(`Relatório de Estoque - ${dadosEmpresa.nomeEmpresa}`, 14, 20);
        startY = 35;
      }

      docPDF.setFontSize(10);
      docPDF.setTextColor(100);
      docPDF.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 160, startY - 5);

      const tableColumn = ["Item / Peça", "Categoria", "Quantidade", "Status"];
      const tableRows = estoqueLista.map(item => [
        item.nome,
        item.categoria,
        item.quantidade,
        item.status
      ]);

      autoTable(docPDF, {
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      docPDF.save(`Inventario_Acervo_${new Date().toISOString().split('T')[0]}.pdf`);
      await registrarLog("EXPORTAÇÃO DE INVENTÁRIO", "Baixou o relatório completo de estoque em PDF.");
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>Calculando inventário e ROI do acervo...</div>;

  return (
    <div className="fade-in">
      
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

      {/* TABELA DE INVENTÁRIO */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>📦 Controle de Inventário Físico</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Lista detalhada de peças e quantidades disponíveis.</p>
          </div>
          <button type="button" className="btn-export-pdf" onClick={exportarPDFEstoque}>
            📄 Baixar Inventário (PDF)
          </button>
        </div>

        <div className="table-container" style={{ marginTop: '15px' }}>
          <table className="custom-table table-pro">
            <thead>
              <tr>
                <th>ITEM / PRODUTO</th>
                <th style={{textAlign: 'center'}}>CATEGORIA</th>
                <th style={{textAlign: 'center'}}>QTD FÍSICA</th>
                <th style={{textAlign: 'center'}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {estoqueLista.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Estoque vazio.</td>
                </tr>
              ) : (
                estoqueLista.map((item, idx) => (
                  <tr key={idx}>
                    <td><strong style={{color: '#0f172a'}}>{item.nome}</strong></td>
                    <td style={{textAlign: 'center'}}><span className="badge-categoria">{item.categoria}</span></td>
                    <td style={{textAlign: 'center', fontWeight: '850', color: item.quantidade <= 1 ? '#ef4444' : '#0f172a'}}>{item.quantidade}</td>
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