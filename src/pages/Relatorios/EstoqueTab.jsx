import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './EstoqueTab.css'; 

const EstoqueTab = () => {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ 
    totalPecas: 0, 
    tiposDiferentes: 0, 
    emManutencao: 0 
  });
  const [rankingTemas, setRankingTemas] = useState([]);
  const [rankingCategorias, setRankingCategorias] = useState([]); 
  const [taxaOciosidade, setTaxaOciosidade] = useState([]); 
  const [estoqueLista, setEstoqueLista] = useState([]);

  // --- NOVO: Estado para guardar os dados da Empresa (Logo e Nome) ---
  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: ''
  });

  useEffect(() => {
    const buscarDadosEstoqueEConfigs = async () => {
      try {
        // Busca Estoque, Locações e as Configurações da Empresa ao mesmo tempo
        const [snapEstoque, snapLocacoes, snapConfig] = await Promise.all([
          getDocs(collection(db, "estoque")),
          getDocs(collection(db, "locacoes")),
          getDoc(doc(db, "sistema", "parametros"))
        ]);

        // Carrega Configurações da Empresa (para o PDF)
        if (snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeEmpresa || 'Ágape Decorações',
            logotipo: configData.logotipo || ''
          });
        }

        const estoque = snapEstoque.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => d.data());

        // --- 1. MAPEAMENTO DE ÚLTIMA LOCAÇÃO (PARA OCIOSIDADE) ---
        const ultimaLocacaoItem = {};
        locacoes.forEach(loc => {
          const dataLoc = loc.dataRetirada ? new Date(loc.dataRetirada) : (loc.criadoEm?.toDate ? loc.criadoEm.toDate() : new Date(0));
          
          const itensAlugados = loc.itens || loc.produtos || loc.pecas || [];
          
          if (Array.isArray(itensAlugados)) {
            itensAlugados.forEach(peca => {
              const keyId = peca.id;
              const keyNome = peca.nome || peca.descricao;
              
              if (keyId && (!ultimaLocacaoItem[keyId] || dataLoc > ultimaLocacaoItem[keyId])) ultimaLocacaoItem[keyId] = dataLoc;
              if (keyNome && (!ultimaLocacaoItem[keyNome] || dataLoc > ultimaLocacaoItem[keyNome])) ultimaLocacaoItem[keyNome] = dataLoc;
            });
          }
        });

        const seisMesesAtras = new Date();
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

        // --- 2. MÉTRICAS DE ESTOQUE E CATEGORIAS ---
        let totalPecas = 0;
        let emManutencao = 0;
        const contagemCategorias = {}; 
        const statsOciosidade = {}; 

        const estoqueFormatado = estoque.map(item => {
          const qtd = Number(item.quantidade) || 0;
          totalPecas += qtd;

          const cat = item.categoria ? String(item.categoria).toUpperCase().trim() : "OUTROS";
          contagemCategorias[cat] = (contagemCategorias[cat] || 0) + qtd;

          if (!statsOciosidade[cat]) statsOciosidade[cat] = { total: 0, ociosos: 0 };
          statsOciosidade[cat].total += qtd;

          const statusTxt = String(item.status || item.condicao || 'Disponível').toLowerCase();
          const precisaReparo = statusTxt.includes('manuten') || statusTxt.includes('reparo') || statusTxt.includes('quebrad') || statusTxt.includes('danificad');
          if (precisaReparo) emManutencao += qtd; 

          const keyId = item.id;
          const keyNome = item.nome || item.descricao;
          const ultimaLoc = ultimaLocacaoItem[keyId] || ultimaLocacaoItem[keyNome];
          const dataCriacao = item.criadoEm?.toDate ? item.criadoEm.toDate() : new Date(item.criadoEm || 0);

          let isOcioso = false;
          if (!ultimaLoc) {
             if (dataCriacao < seisMesesAtras && dataCriacao.getFullYear() > 1970) isOcioso = true;
          } else if (ultimaLoc < seisMesesAtras) {
             isOcioso = true;
          }

          if (isOcioso) {
             statsOciosidade[cat].ociosos += qtd; 
          }

          return {
            nome: item.nome || item.descricao || "Item sem nome",
            categoria: item.categoria || "Geral",
            quantidade: qtd,
            statusOriginal: item.status || item.condicao || 'Disponível',
            precisaReparo: precisaReparo
          };
        });

        estoqueFormatado.sort((a, b) => {
          if (a.precisaReparo && !b.precisaReparo) return -1;
          if (!a.precisaReparo && b.precisaReparo) return 1;
          return a.quantidade - b.quantidade;
        });

        // --- 3. FORMATAÇÃO DOS RANKINGS ---
        const contagemTemas = {};
        locacoes.forEach(loc => {
          if (loc.temaFesta) {
            const tema = String(loc.temaFesta).toUpperCase().trim();
            if(tema !== "") contagemTemas[tema] = (contagemTemas[tema] || 0) + 1;
          }
        });
        const topTemas = Object.entries(contagemTemas).sort((a, b) => b[1] - a[1]).slice(0, 4); 
        
        const topCategorias = Object.entries(contagemCategorias).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const rankingOciosidade = Object.entries(statsOciosidade)
          .map(([cat, stats]) => {
             const taxa = stats.total > 0 ? (stats.ociosos / stats.total) * 100 : 0;
             return { categoria: cat, taxa, ociosos: stats.ociosos, total: stats.total };
          })
          .filter(c => c.ociosos > 0) 
          .sort((a, b) => b.taxa - a.taxa)
          .slice(0, 4);

        setMetricas({ totalPecas, tiposDiferentes: estoque.length, emManutencao });
        setRankingTemas(topTemas);
        setRankingCategorias(topCategorias); 
        setTaxaOciosidade(rankingOciosidade); 
        setEstoqueLista(estoqueFormatado);

      } catch (error) {
        console.error("Erro ao carregar estoque:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosEstoqueEConfigs();
  }, []);

  const exportarPDFEstoque = () => {
    try {
      const doc = new jsPDF();
      let startY = 25; 
      const dataHoje = new Date().toLocaleDateString('pt-BR');

      // Se houver logotipo cadastrado, adiciona no PDF
      if (dadosEmpresa.logotipo) {
        doc.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 30, 30);
        
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text(dadosEmpresa.nomeEmpresa, 48, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text(`Inventário de Acervo | Gerado em: ${dataHoje} | Total de Peças: ${metricas.totalPecas}`, 48, 30);
        
        startY = 45; 
      } else {
        // Layout Padrão sem Logo
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42); 
        doc.text(`Inventário de Acervo - ${dadosEmpresa.nomeEmpresa}`, 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${dataHoje} | Total de Peças: ${metricas.totalPecas}`, 14, 30);
        
        startY = 38;
      }

      autoTable(doc, {
        head: [["Item / Produto", "Categoria", "Qtd.", "Status"]],
        body: estoqueLista.map(item => [
          item.nome, 
          item.categoria, 
          item.quantidade, 
          item.statusOriginal.toUpperCase()
        ]),
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Inventario_Estoque_${dadosEmpresa.nomeEmpresa.replace(/\s+/g, '_')}.pdf`);
    } catch (e) { alert("Erro ao gerar PDF"); }
  };

  if (loading) return <div className="loading-v3">Analisando inteligência de acervo...</div>;

  return (
    <div className="fade-in">
      {/* GRID DE KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card card-destaque">
          <span>VOLUME DO ACERVO</span>
          <h2>{metricas.totalPecas}</h2>
          <small>Peças totais no estoque</small>
        </div>
        <div className="kpi-card card-verde">
          <span>DIVERSIDADE (TIPOS)</span>
          <h2>{metricas.tiposDiferentes}</h2>
          <small>Modelos cadastrados</small>
        </div>
        <div className="kpi-card card-vermelho">
          <span>EM MANUTENÇÃO</span>
          <h2>{metricas.emManutencao}</h2>
          <small>Peças aguardando reparo</small>
        </div>
      </div>

      <div className="clientes-layout-split mt-20">
        
        {/* COLUNA ESQUERDA: QUADROS DE INTELIGÊNCIA EMPILHADOS */}
        <div className="col-esquerda">
          
          {/* QUADRO 1: TEMAS EM ALTA */}
          <div className="main-card-premium" style={{ marginBottom: '20px' }}>
            <div className="card-header-flex">
              <h3>🔥 Temas em Alta</h3>
            </div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px', marginTop: '-10px'}}>
              Os temas mais alugados nos contratos.
            </p>
            <div className="ranking-visual-container">
              {rankingTemas.map(([tema, total], i) => (
                <div key={i} className="rank-item-v4">
                  <div className="rank-info-v4">
                    <strong>{tema}</strong>
                    <span>{total} festas</span>
                  </div>
                  <div className="rank-bar-bg-v4">
                    <div className="rank-bar-fill-v4" style={{ width: `${(total/rankingTemas[0][1])*100}%` }}></div>
                  </div>
                </div>
              ))}
              {rankingTemas.length === 0 && <p style={{color: '#94a3b8', fontSize: '12px'}}>Nenhum tema registrado.</p>}
            </div>
          </div>

          {/* QUADRO 2: COMPOSIÇÃO DO ACERVO */}
          <div className="main-card-premium" style={{ marginBottom: '20px' }}>
            <div className="card-header-flex">
              <h3>📊 Composição do Acervo</h3>
            </div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px', marginTop: '-10px'}}>
              Distribuição do seu estoque físico.
            </p>
            <div className="ranking-visual-container">
              {rankingCategorias.map(([cat, total], i) => {
                const porcentagem = metricas.totalPecas > 0 ? (total / metricas.totalPecas) * 100 : 0;
                return (
                  <div key={i} className="rank-item-v4">
                    <div className="rank-info-v4">
                      <strong>{cat}</strong>
                      <span style={{ color: '#0f172a' }}>{total} pçs ({porcentagem.toFixed(0)}%)</span>
                    </div>
                    <div className="rank-bar-bg-v4" style={{ height: '6px' }}>
                      <div className="rank-bar-fill-v4" style={{ width: `${porcentagem}%`, background: 'linear-gradient(90deg, #94a3b8, #334155)' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* QUADRO 3: TAXA DE OCIOSIDADE (+6 MESES) */}
          <div className="main-card-premium">
            <div className="card-header-flex">
              <h3>🕸️ Estoque Ocioso</h3>
            </div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px', marginTop: '-10px'}}>
              % de peças paradas há mais de 6 meses.
            </p>
            <div className="ranking-visual-container">
              {taxaOciosidade.map((item, i) => (
                <div key={i} className="rank-item-v4">
                  <div className="rank-info-v4">
                    <strong>{item.categoria}</strong>
                    <span style={{ color: '#ef4444' }}>{item.taxa.toFixed(0)}% parado ({item.ociosos} pçs)</span>
                  </div>
                  <div className="rank-bar-bg-v4" style={{ height: '6px' }}>
                    <div className="rank-bar-fill-v4" style={{ width: `${item.taxa}%`, background: 'linear-gradient(90deg, #fca5a5, #ef4444)' }}></div>
                  </div>
                </div>
              ))}
              {taxaOciosidade.length === 0 && (
                <p style={{color: '#10b981', fontSize: '13px', fontWeight: '800', textAlign: 'center', padding: '10px'}}>
                  🎉 Nenhuma peça parada no acervo!
                </p>
              )}
            </div>
          </div>

        </div>

        {/* COLUNA DIREITA: TABELA DE ESTOQUE */}
        <div className="main-card-premium col-tabela">
          <div className="card-header-flex">
            <h3>📦 Controle de Inventário</h3>
            <button className="btn-export-pdf-clientes" onClick={exportarPDFEstoque}>📄 Baixar Inventário</button>
          </div>
          
          {/* REMOVIDO: maxHeight: '750px', overflowY: 'auto' */}
          <div style={{ paddingRight: '5px' }}>
            <table className="table-estoque-v4">
              <thead>
                <tr>
                  <th width="40%">ITEM / PRODUTO</th>
                  <th width="25%" className="centro">CATEGORIA</th>
                  <th width="15%" className="centro">QTD.</th>
                  <th width="20%" className="direita">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {estoqueLista.map((item, i) => (
                  <tr key={i} style={{ opacity: item.quantidade === 0 ? 0.6 : 1 }}>
                    <td className="td-name">
                      <span className="estoque-name">{item.nome}</span>
                    </td>
                    <td className="centro">
                      <span className="badge-categoria">{item.categoria}</span>
                    </td>
                    <td className="centro bold" style={{color: item.quantidade <= 1 ? '#ef4444' : '#0f172a'}}>
                      {item.quantidade}
                    </td>
                    <td className="direita">
                      <span className={`badge-status-estoque ${item.precisaReparo ? 'status-reparo' : 'status-ok'}`}>
                        {item.statusOriginal.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {estoqueLista.length === 0 && (
                  <tr><td colSpan="4" className="centro" style={{padding: '20px', color: '#94a3b8'}}>Estoque vazio.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstoqueTab;