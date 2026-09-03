import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { gerarRelatorioEstoquePDF } from '../../utils/gerarRelatorioEstoquePDF';
import './EstoqueTab.css';

const EstoqueTab = ({ mostrarIndicadores = true, alternarIndicadores }) => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS'); // 'TODOS' | 'DISPONIVEL' | 'MANUTENCAO' | 'ESTRELA' | 'PARADO'

  const [metricas, setMetricas] = useState({ 
    totalPecas: 0, 
    tiposDiferentes: 0, 
    emManutencao: 0,
    investimentoTotal: 0,
    faturamentoGeradoTotal: 0
  });

  const [estoqueListaCompleta, setEstoqueListaCompleta] = useState([]);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);

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
          const nomeFinal = cfg.nomeEmpresa || cfg.nomeFantasia || cfg.razaoSocial || cfg.nome || localStorage.getItem('nomeEmpresa') || localStorage.getItem('funcName') || usuarioLogado?.displayName || 'Minha Empresa';
          setDadosEmpresa({
            nomeEmpresa: nomeFinal,
            logotipo: cfg.logotipo || cfg.logo || '',
            cnpj: cfg.cnpj || '',
            endereco: cfg.endereco || ''
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

        const estoque = snapEstoque.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));
        const compras = snapCompras.docs.map(d => ({ id: d.id, ...d.data() }));

        // Contagem de locações por item (Giro do Acervo)
        const giroPorItem = {};

        locacoes.forEach(loc => {
          const st = String(loc.status || '').toLowerCase();
          if (st.includes('cancel')) return;

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

        setMetricas({
          totalPecas,
          tiposDiferentes: estoque.length,
          emManutencao,
          investimentoTotal
        });

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

  // EXPORTAR CSV (EXCEL COM UTF-8 BOM)
  const exportarCSVEstoque = () => {
    const cabecalho = ["Item / Peça", "Categoria", "Qtd Física", "Status", "Locações Realizadas", "Valor Aquisição (R$)", "Valor Locação (R$)"];
    const linhas = estoqueFiltrado.map(item => [
      `"${(item.nome || '').replace(/"/g, '""')}"`,
      `"${(item.categoria || 'Geral').replace(/"/g, '""')}"`,
      `"${item.quantidade || 0}"`,
      `"${item.status || ''}"`,
      `"${item.qtdLocacoes || 0}"`,
      `"${Number(item.valorAquisicao || 0).toFixed(2).replace('.', ',')}"`,
      `"${Number(item.valorLocacao || 0).toFixed(2).replace('.', ',')}"`
    ]);

    const csvContent = [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const nomeEmpresaSanitizado = (dadosEmpresa.nomeEmpresa || 'Empresa').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventario_${nomeEmpresaSanitizado}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    registrarLog("EXPORTACAO_CSV_ESTOQUE", `Exportou inventário de estoque em CSV (${estoqueFiltrado.length} itens).`);
  };

  // EXPORTAR PDF
  const exportarPDFEstoque = async () => {
    try {
      gerarRelatorioEstoquePDF({
        empresa: dadosEmpresa,
        metricas,
        estoque: estoqueFiltrado,
        filtroStatus,
        filtroCategoria,
        usuarioEmail: usuarioLogado?.email
      });
      await registrarLog("EXPORTAÇÃO DE INVENTÁRIO", "Baixou o relatório completo de estoque em PDF.");
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem'}}>Calculando inventário e indicadores do acervo...</div>;

  return (
    <div className="rel-estoque-wrapper fade-in">
      
      {/* 4 CARDS KPI ESSENCIAIS & COMPACTOS (GOLDEN RULE 1 & 2) */}
      {mostrarIndicadores && (
        <div className="clientes-stats-grid rel-kpi-grid-compact">
          <div className="stat-card-pro card-green">
            <div className="stat-icon-wrapper icon-green">📦</div>
            <div className="stat-content">
              <span className="stat-title">TOTAL DE PEÇAS</span>
              <span className="stat-number">{metricas.totalPecas}</span>
              <small className="stat-desc">Estoque físico total</small>
            </div>
          </div>

          <div className="stat-card-pro card-amber">
            <div className="stat-icon-wrapper icon-amber">🎨</div>
            <div className="stat-content">
              <span className="stat-title">VARIEDADE DE ITENS</span>
              <span className="stat-number">{metricas.tiposDiferentes}</span>
              <small className="stat-desc">Modelos cadastrados</small>
            </div>
          </div>

          <div className="stat-card-pro card-purple">
            <div className="stat-icon-wrapper icon-purple">🛠️</div>
            <div className="stat-content">
              <span className="stat-title">EM MANUTENÇÃO</span>
              <span className="stat-number" style={{ color: metricas.emManutencao > 0 ? '#d97706' : '#10b981' }}>
                {metricas.emManutencao}
              </span>
              <small className="stat-desc">Necessitam reparo</small>
            </div>
          </div>

          <div className="stat-card-pro card-red">
            <div className="stat-icon-wrapper icon-red">💰</div>
            <div className="stat-content">
              <span className="stat-title">INVESTIMENTO TOTAL</span>
              <span className="stat-number">R$ {metricas.investimentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              <small className="stat-desc">Total investido em compras</small>
            </div>
          </div>
        </div>
      )}

      {/* LISTAGEM DE INVENTÁRIO */}
      <div className="rel-card-unificado">
        <div className="rel-card-header">
          <div>
            <h3 className="rel-card-title">Controle de Inventário Físico &amp; Giro ({estoqueFiltrado.length})</h3>
            <p className="rel-card-sub">Lista detalhada de peças com volume de locações realizadas.</p>
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
                onClick={exportarCSVEstoque}
                className="rel-btn-action-outline"
                title="Exportar inventário em Excel (CSV)"
              >
                📊 Excel (CSV)
              </button>
              <button 
                type="button" 
                className="rel-btn-action-primary" 
                onClick={exportarPDFEstoque}
                title="Baixar Inventário em PDF"
              >
                📄 Baixar PDF
              </button>
            </div>
          </div>
        </div>

        {/* BARRA DE PESQUISA & FILTROS */}
        <div className="rel-estoque-subbar">
          <div className="rel-estoque-search-box">
            <i className="fas fa-search rel-search-icon"></i>
            <input 
              type="text" 
              placeholder="Buscar peça por nome ou categoria..." 
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
              className="rel-estoque-search-input"
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

          <div className="rel-estoque-filter-controls">
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="rel-estoque-select"
            >
              <option value="TODAS">📦 Todas as Categorias</option>
              {categoriasDisponiveis.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>

            <div className="rel-estoque-pills">
              <button 
                type="button" 
                onClick={() => setFiltroStatus('TODOS')}
                className={`rel-estoque-pill-btn ${filtroStatus === 'TODOS' ? 'active' : ''}`}
              >
                📋 Todos ({estoqueListaCompleta.length})
              </button>

              <button 
                type="button" 
                onClick={() => setFiltroStatus('ESTRELA')}
                className={`rel-estoque-pill-btn estrela ${filtroStatus === 'ESTRELA' ? 'active' : ''}`}
              >
                🌟 Mais Alugadas
              </button>

              <button 
                type="button" 
                onClick={() => setFiltroStatus('MANUTENCAO')}
                className={`rel-estoque-pill-btn reparo ${filtroStatus === 'MANUTENCAO' ? 'active' : ''}`}
              >
                🛠️ Em Reparo ({metricas.emManutencao})
              </button>

              <button 
                type="button" 
                onClick={() => setFiltroStatus('PARADO')}
                className={`rel-estoque-pill-btn parado ${filtroStatus === 'PARADO' ? 'active' : ''}`}
              >
                💤 Acervo Parado
              </button>
            </div>
          </div>
        </div>

        {/* CONTAINER DA LISTA/TABELA ESTRUTURADA */}
        <div className="rel-table-container-responsive">
          <table className="rel-estoque-table">
            <thead>
              <tr>
                <th style={{ width: '36%' }}>ITEM / PRODUTO</th>
                <th style={{ width: '18%', textAlign: 'center' }}>CATEGORIA</th>
                <th style={{ width: '14%', textAlign: 'center' }}>QTD FÍSICA</th>
                <th style={{ width: '16%', textAlign: 'center' }}>GIRO (LOCAÇÕES)</th>
                <th style={{ width: '16%', textAlign: 'center' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {estoqueFiltrado.length === 0 ? (
                <tr>
                  <td colSpan="5" className="rel-table-empty-cell">
                    Nenhum item encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                estoqueFiltrado.map((item, idx) => (
                  <tr key={idx} className="rel-estoque-row">
                    {/* CÉLULA PRINCIPAL ESTRUTURADA */}
                    <td className="rel-cell-produto">
                      {/* 1. ZONA SUPERIOR: CATEGORIA + QTD (ESQ) | STATUS (DIR) */}
                      <div className="rel-est-header-zone">
                        <div className="rel-est-meta-left">
                          <span className="rel-est-cat-badge">{item.categoria}</span>
                          <span className="rel-est-qtd-pill">
                            <strong>{item.quantidade}</strong> pç{item.quantidade > 1 ? 's' : ''} em estoque
                          </span>
                        </div>
                        <span className={`rel-status-pill ${item.status === 'Disponível' ? 'ativo' : 'inativo'}`}>
                          {item.status === 'Disponível' ? '🟢 Disponível' : '🟡 Reparo'}
                        </span>
                      </div>

                      {/* 2. ZONA INFERIOR: NOME + DEMANDA (ESQ) | GIRO + VALOR (DIR) */}
                      <div className="rel-est-body-zone">
                        <div className="rel-est-info-left">
                          <div className="rel-est-nome-title">{item.nome}</div>
                          {item.giroClass === 'ESTRELA' && (
                            <span className="rel-est-giro-tag estrela">🌟 Alta Demanda</span>
                          )}
                          {item.giroClass === 'PARADO' && (
                            <span className="rel-est-giro-tag parado">💤 Sem saída recente</span>
                          )}
                        </div>

                        <div className="rel-est-info-right">
                          <div className={`rel-est-giro-count ${item.qtdLocacoes > 0 ? 'positivo' : 'neutro'}`}>
                            {item.qtdLocacoes > 0 ? `${item.qtdLocacoes}x locado` : '0 locações'}
                          </div>
                          {item.valorLocacao > 0 && (
                            <span className="rel-est-valor-locacao">
                              Locação: R$ {item.valorLocacao.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* CÉLULAS DESKTOP */}
                    <td className="desktop-only-col">
                      <div className="rel-est-nome-title">{item.nome}</div>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                      <span className="rel-est-cat-badge">{item.categoria}</span>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                      <span className={`rel-estoque-qtd-badge ${item.quantidade <= 1 ? 'alerta' : ''}`}>
                        {item.quantidade} pç{item.quantidade > 1 ? 's' : ''}
                      </span>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                      <span className={`rel-est-giro-count ${item.qtdLocacoes > 0 ? 'positivo' : 'neutro'}`}>
                        {item.qtdLocacoes}x locado
                      </span>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                      <span className={`rel-status-pill ${item.status === 'Disponível' ? 'ativo' : 'inativo'}`}>
                        {item.status === 'Disponível' ? '🟢 Disponível' : '🟡 Em Reparo'}
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