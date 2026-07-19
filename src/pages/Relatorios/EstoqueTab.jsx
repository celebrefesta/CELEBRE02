import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// 🔥 Importação do Cadeado de Segurança
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './EstoqueTab.css';

const EstoqueTab = () => {
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

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

  const [financeiroAcervo, setFinanceiroAcervo] = useState({
    totalInvestido: 0,
    totalEsteMes: 0,
    gastosCategoria: [],
    gastosMes: []
  });

  const [radarPrecos, setRadarPrecos] = useState([]);
  
  const [modalRadarAberto, setModalRadarAberto] = useState(false);
  const [categoriaSelecionadaRadar, setCategoriaSelecionadaRadar] = useState(null);

  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: ''
  });

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE ESTOQUE VINCULADO À EMPRESA)
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
    if (!usuarioLogado) return; // Proteção extra

    const buscarDadosEstoqueEConfigs = async () => {
      try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS o estoque e as locações da sua empresa
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));

        const [snapEstoque, snapLocacoes, snapConfig] = await Promise.all([
          getDocs(qEstoque),
          getDocs(qLocacoes),
          getDoc(doc(db, "sistema", "parametros"))
        ]);

        if (snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeEmpresa || 'Ágape Decorações',
            logotipo: configData.logotipo || ''
          });
        }

        const estoque = snapEstoque.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => d.data());

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
        
        let totalPecas = 0;
        let emManutencao = 0;
        const contagemCategorias = {}; 
        const statsOciosidade = {};

        let investTotal = 0;
        let investMesAtual = 0;
        const mapGastosCat = {};
        const mapGastosMes = {};
        const mapVariacaoPrecos = {};

        const dataHoje = new Date();
        const mesAtualTag = `${String(dataHoje.getMonth() + 1).padStart(2, '0')}/${dataHoje.getFullYear()}`;

        const estoqueFormatado = estoque.map(item => {
          const isDeco = item.especificacoes?.isDecoracao || item.categoria === 'Decoração Completa';
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
          if (isOcioso) statsOciosidade[cat].ociosos += qtd; 

          const valorCompra = Number(item.financeiro?.valorCompra) || 0;
          const qtdBaseCusto = qtd > 0 ? qtd : (isDeco ? 0 : 1);
          const custoItem = qtdBaseCusto * valorCompra;

          if (custoItem > 0) {
              investTotal += custoItem;
              const mesAnoCadastro = `${String(dataCriacao.getMonth() + 1).padStart(2, '0')}/${dataCriacao.getFullYear()}`;
              if (mesAnoCadastro === mesAtualTag) investMesAtual += custoItem;

              const catNomeGrafico = item.categoria || 'Sem Categoria';
              mapGastosCat[catNomeGrafico] = (mapGastosCat[catNomeGrafico] || 0) + custoItem;
              mapGastosMes[mesAnoCadastro] = (mapGastosMes[mesAnoCadastro] || 0) + custoItem;
          }

          if (valorCompra > 0 && !isDeco) {
              const catNome = item.categoria || 'Sem Categoria';
              if (!mapVariacaoPrecos[catNome]) {
                  mapVariacaoPrecos[catNome] = { historico: [] };
              }
              mapVariacaoPrecos[catNome].historico.push({
                  nome: item.nome || item.descricao || "Item S/N",
                  valor: valorCompra,
                  data: dataCriacao
              });
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

        const gastosCategoria = Object.entries(mapGastosCat)
            .map(([nome, valor]) => ({ nome, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 5);

        const gastosMes = Object.entries(mapGastosMes)
            .map(([nome, valor]) => ({ nome, valor }))
            .sort((a, b) => {
                const [mA, yA] = a.nome.split('/');
                const [mB, yB] = b.nome.split('/');
                return new Date(yB, mB - 1) - new Date(yA, mA - 1);
            })
            .slice(0, 5);

        const radarCalculado = Object.entries(mapVariacaoPrecos)
            .map(([cat, dados]) => {
                const historicoOrdenado = dados.historico.sort((a, b) => a.data - b.data);
                const valores = historicoOrdenado.map(h => h.valor);
                const min = Math.min(...valores);
                const max = Math.max(...valores);
                const variacao = max - min;
                const percentual = min > 0 ? (variacao / min) * 100 : 0;
                
                return { categoria: cat, min, max, variacao, percentual, historico: historicoOrdenado };
            })
            .filter(r => r.percentual > 0) 
            .sort((a, b) => b.percentual - a.percentual) 
            .slice(0, 5);

        setMetricas({ totalPecas, tiposDiferentes: estoqueLista.length, emManutencao });
        setRankingTemas(topTemas);
        setRankingCategorias(topCategorias); 
        setTaxaOciosidade(rankingOciosidade); 
        setEstoqueLista(estoqueFormatado);
        setFinanceiroAcervo({ totalInvestido: investTotal, totalEsteMes: investMesAtual, gastosCategoria, gastosMes });
        setRadarPrecos(radarCalculado);

      } catch (error) {
        console.error("Erro ao carregar relatórios de estoque:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosEstoqueEConfigs();
  }, [usuarioLogado, tenantId]);

  const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatarData = (data) => {
      if (!data || data.getFullYear() <= 1970) return "S/ Data";
      return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const exportarPDFEstoque = async () => {
    try {
      const doc = new jsPDF();
      let startY = 25; 
      const dataHoje = new Date().toLocaleDateString('pt-BR');

      if (dadosEmpresa.logotipo && dadosEmpresa.logotipo.startsWith('data:image')) {
        try { doc.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 30, 30);
        } catch(e) {}
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text(dadosEmpresa.nomeEmpresa, 48, 22);
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text(`Inventário de Acervo | Gerado em: ${dataHoje} | Total de Peças: ${metricas.totalPecas}`, 48, 30);
        startY = 45;
      } else {
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
      
      // 🔥 Aciona o espião de exportação
      await registrarLog("EXPORTAÇÃO DE INVENTÁRIO", `Fez o download do relatório completo do estoque em PDF.`);

    } catch (e) { alert("Erro ao gerar PDF"); }
  };

  const maxCatFinanceiro = Math.max(...financeiroAcervo.gastosCategoria.map(c => c.valor), 1);
  const maxMesFinanceiro = Math.max(...financeiroAcervo.gastosMes.map(m => m.valor), 1);

  if (loading) return <div className="loading-v3">Analisando inteligência de acervo...</div>;

  return (
    <div className="fade-in">
      
      {/* KPIs */}
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

      <div className="kpi-grid" style={{ marginTop: '20px' }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid #c5a059' }}>
          <span>CUSTO TOTAL INVESTIDO</span>
          <h2 style={{ color: '#0f172a' }}>{formatarMoeda(financeiroAcervo.totalInvestido)}</h2>
          <small style={{ color: '#b45309', background: '#fffbeb', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', width: 'max-content' }}>Soma do valor de compra das peças</small>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <span>COMPRAS NESTE MÊS</span>
          <h2 style={{ color: '#0f172a' }}>{formatarMoeda(financeiroAcervo.totalEsteMes)}</h2>
          <small style={{ color: '#1d4ed8', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', width: 'max-content' }}>Cadastros de acervo nos últimos 30 dias</small>
        </div>
      </div>

      {/* GRÁFICOS FINANCEIROS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px', marginBottom: '20px' }}>
         <div className="main-card-premium">
            <div className="card-header-flex"><h3>💰 Onde está o seu dinheiro?</h3></div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '20px', marginTop: '-10px'}}>Acervo ordenado por volume de investimento.</p>
            
            {financeiroAcervo.gastosCategoria.length === 0 ?
              <p style={{color: '#94a3b8', fontSize: '12px'}}>Nenhum valor de compra cadastrado.</p> : 
              financeiroAcervo.gastosCategoria.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', gap: '15px' }}>
                   <div style={{ width: '100px', fontSize: '12px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.nome}</div>
                   <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '10px', position: 'relative' }}>
                      <div style={{ width: `${(cat.valor/maxCatFinanceiro)*100}%`, height: '100%', background: '#c5a059', borderRadius: '10px' }}></div>
                   </div>
                   <div style={{ fontSize: '13px', fontWeight: '800', width: '90px', textAlign: 'right', color: '#0f172a' }}>{formatarMoeda(cat.valor)}</div>
                </div>
              ))
            }
         </div>

         <div className="main-card-premium">
            <div className="card-header-flex"><h3>📅 Histórico de Compras</h3></div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '20px', marginTop: '-10px'}}>Evolução de aquisição de acervo por mês.</p>
            
            {financeiroAcervo.gastosMes.length === 0 ?
              <p style={{color: '#94a3b8', fontSize: '12px'}}>Nenhum valor de compra cadastrado.</p> : 
              financeiroAcervo.gastosMes.map((mes, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', gap: '15px' }}>
                   <div style={{ width: '100px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Mês {mes.nome}</div>
                   <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '10px', position: 'relative' }}>
                      <div style={{ width: `${(mes.valor/maxMesFinanceiro)*100}%`, height: '100%', background: '#0f172a', borderRadius: '10px' }}></div>
                   </div>
                   <div style={{ fontSize: '13px', fontWeight: '800', width: '90px', textAlign: 'right', color: '#0f172a' }}>{formatarMoeda(mes.valor)}</div>
                </div>
              ))
            }
         </div>
      </div>

      <div className="clientes-layout-split mt-20">
        <div className="col-esquerda">

          {/* 🔥 RADAR DE INFLAÇÃO INTERATIVO 🔥 */}
          <div className="main-card-premium" style={{ marginBottom: '20px', borderTop: '4px solid #ef4444' }}>
            <div className="card-header-flex"><h3>📈 Radar de Custos (Inflação)</h3></div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px', marginTop: '-10px'}}>
              Alerta de diferença de valor pago em peças da mesma categoria. Clique para ver o histórico.
            </p>
            <div className="ranking-visual-container">
              {radarPrecos.map((item, i) => (
                <div 
                  key={i} 
                  className="rank-item-v4 clickable-radar-card" 
                  onClick={() => { setCategoriaSelecionadaRadar(item); setModalRadarAberto(true); }}
                  title="Ver linha do tempo de preços"
                  style={{ 
                      flexDirection: 'column', alignItems: 'flex-start', gap: '5px', padding: '12px', 
                      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' 
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <strong style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.categoria} <span style={{fontSize: '12px', opacity: 0.6}}>🔍</span>
                      </strong>
                      <span style={{ color: '#b91c1c', fontWeight: '900', fontSize: '13px', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>+{item.percentual.toFixed(0)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', color: '#7f1d1d', marginTop: '4px' }}>
                      <span>Menor pago: <strong>{formatarMoeda(item.min)}</strong></span>
                      <span>Maior pago: <strong>{formatarMoeda(item.max)}</strong></span>
                  </div>
                </div>
              ))}
              {radarPrecos.length === 0 && (
                <p style={{color: '#10b981', fontSize: '12px', fontWeight: 'bold', padding: '10px', textAlign: 'center', background: '#ecfdf5', borderRadius: '8px'}}>
                  Nenhuma variação de custo de compra detectada no acervo!
                </p>
              )}
            </div>
          </div>
          
          <div className="main-card-premium" style={{ marginBottom: '20px' }}>
            <div className="card-header-flex"><h3>🔥 Temas em Alta</h3></div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px', marginTop: '-10px'}}>Os temas mais alugados nos contratos.</p>
            <div className="ranking-visual-container">
              {rankingTemas.map(([tema, total], i) => (
                <div key={i} className="rank-item-v4">
                  <div className="rank-info-v4"><strong>{tema}</strong><span>{total} festas</span></div>
                  <div className="rank-bar-bg-v4"><div className="rank-bar-fill-v4" style={{ width: `${(total/rankingTemas[0][1])*100}%` }}></div></div>
                </div>
              ))}
              {rankingTemas.length === 0 && <p style={{color: '#94a3b8', fontSize: '12px'}}>Nenhum tema registrado.</p>}
            </div>
          </div>

          <div className="main-card-premium" style={{ marginBottom: '20px' }}>
            <div className="card-header-flex"><h3>📊 Composição do Acervo</h3></div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px', marginTop: '-10px'}}>Distribuição do seu estoque físico.</p>
            <div className="ranking-visual-container">
              {rankingCategorias.map(([cat, total], i) => {
                const porcentagem = metricas.totalPecas > 0 ? (total / metricas.totalPecas) * 100 : 0;
                return (
                  <div key={i} className="rank-item-v4">
                    <div className="rank-info-v4"><strong>{cat}</strong><span style={{ color: '#0f172a' }}>{total} pçs ({porcentagem.toFixed(0)}%)</span></div>
                    <div className="rank-bar-bg-v4" style={{ height: '6px' }}><div className="rank-bar-fill-v4" style={{ width: `${porcentagem}%`, background: 'linear-gradient(90deg, #94a3b8, #334155)' }}></div></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="main-card-premium">
            <div className="card-header-flex"><h3>🕸️ Estoque Ocioso</h3></div>
            <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px', marginTop: '-10px'}}>% de peças paradas há mais de 6 meses.</p>
            <div className="ranking-visual-container">
              {taxaOciosidade.map((item, i) => (
                <div key={i} className="rank-item-v4">
                  <div className="rank-info-v4"><strong>{item.categoria}</strong><span style={{ color: '#ef4444' }}>{item.taxa.toFixed(0)}% parado ({item.ociosos} pçs)</span></div>
                  <div className="rank-bar-bg-v4" style={{ height: '6px' }}><div className="rank-bar-fill-v4" style={{ width: `${item.taxa}%`, background: 'linear-gradient(90deg, #fca5a5, #ef4444)' }}></div></div>
                </div>
              ))}
              {taxaOciosidade.length === 0 && (
                <p style={{color: '#10b981', fontSize: '13px', fontWeight: '800', textAlign: 'center', padding: '10px'}}>🎉 Nenhuma peça parada no acervo!</p>
              )}
            </div>
          </div>

        </div>

        <div className="main-card-premium col-tabela">
          <div className="card-header-flex">
            <h3>📦 Controle de Inventário</h3>
            <button className="btn-export-pdf-clientes" onClick={exportarPDFEstoque}>📄 Baixar Inventário</button>
          </div>
          
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
                    <td className="td-name"><span className="estoque-name">{item.nome}</span></td>
                    <td className="centro"><span className="badge-categoria">{item.categoria}</span></td>
                    <td className="centro bold" style={{color: item.quantidade <= 1 ? '#ef4444' : '#0f172a'}}>{item.quantidade}</td>
                    <td className="direita"><span className={`badge-status-estoque ${item.precisaReparo ? 'status-reparo' : 'status-ok'}`}>{item.statusOriginal.toUpperCase()}</span></td>
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

      {/* 🔥 MODAL DE HISTÓRICO DE PREÇOS 🔥 */}
      {modalRadarAberto && categoriaSelecionadaRadar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', width: '90%', maxWidth: '600px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
                
                {/* Header do Modal */}
                <div style={{ padding: '20px 25px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#991b1b', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📈 Histórico de Custo: {categoriaSelecionadaRadar.categoria}
                        </h3>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#7f1d1d' }}>
                             Acompanhe a variação de preço dos itens comprados nesta categoria.
                        </p>
                    </div>
                    <button onClick={() => setModalRadarAberto(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', color: '#991b1b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '50%' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(153, 27, 27, 0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        ×
                    </button>
                </div>

                {/* Corpo do Modal - Linha do Tempo */}
                <div style={{ padding: '20px 25px', overflowY: 'auto', flexGrow: 1, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {categoriaSelecionadaRadar.historico.map((hist, idx) => {
                            const isMaisCaro = hist.valor === categoriaSelecionadaRadar.max;
                            const isMaisBarato = hist.valor === categoriaSelecionadaRadar.min;
                            
                            return (
                                <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>📅 CADASTRADO EM: {formatarData(hist.data)}</span>
                                        <strong style={{ color: '#0f172a', fontSize: '14px' }}>{hist.nome}</strong>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                        <strong style={{ fontSize: '16px', color: isMaisCaro ? '#ef4444' : isMaisBarato ? '#10b981' : '#0f172a' }}>
                                            {formatarMoeda(hist.valor)}
                                        </strong>
                                        {isMaisCaro && <span style={{ fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>⬆️ Maior Valor Pago</span>}
                                        {isMaisBarato && <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>⬇️ Menor Valor Pago</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ padding: '15px 25px', background: '#fff', borderTop: '1px solid #e2e8f0', textAlign: 'center', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                         Diferença total nesta categoria: <strong style={{color: '#0f172a'}}>{formatarMoeda(categoriaSelecionadaRadar.variacao)} (+{categoriaSelecionadaRadar.percentual.toFixed(0)}%)</strong>
                    </p>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default EstoqueTab;