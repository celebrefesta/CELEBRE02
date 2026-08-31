import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { gerarRelatorioClientesPDF } from '../../utils/gerarRelatorioClientesPDF';
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

  // EXPORTAR CSV (EXCEL COM UTF-8 BOM)
  const exportarCSVClientes = () => {
    const cabecalho = ["Nome", "Telefone", "Cidade", "Qtd Festas", "Total Gasto (R$)", "Status", "Ultima Locacao"];
    const linhas = clientesFiltrados.map(c => [
      `"${(c.nome || '').replace(/"/g, '""')}"`,
      `"${c.telefone || ''}"`,
      `"${(c.cidade || '').replace(/"/g, '""')}"`,
      `"${c.festas || 0}"`,
      `"${Number(c.totalGasto || 0).toFixed(2).replace('.', ',')}"`,
      `"${c.status || ''}"`,
      `"${c.ultimaLocacaoStr || ''}"`
    ]);

    const csvContent = [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const nomeEmpresaSanitizado = (dadosEmpresa.nomeEmpresa || 'Empresa').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Clientes_${nomeEmpresaSanitizado}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    registrarLog("EXPORTACAO_CSV_CLIENTES", `Exportou lista de clientes em CSV (${clientesFiltrados.length} registros).`);
  };

  // EXPORTAR PDF
  const exportarRelatorioGeral = async () => {
    try {
      gerarRelatorioClientesPDF({
        empresa: dadosEmpresa,
        metricas,
        clientes: clientesFiltrados,
        filtroSegmento,
        usuarioEmail: usuarioLogado?.email
      });
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
    <div className="fade-in rel-clientes-wrapper">
      
      {mostrarIndicadores && (
        <>
          {/* 💡 PAINEL DE INSIGHTS INTELIGENTES CLIENTES */}
          <div className="rel-clientes-insights">
            <div className="rel-clientes-insights-left">
              <span className="rel-clientes-insights-icon">💎</span>
              <div>
                <strong className="rel-clientes-insights-title">CLIENTE DE MAIOR LTV &amp; REGIÃO PRINCIPAL</strong>
                <p className="rel-clientes-insights-sub">
                  Cliente principal: <strong>{topClienteNome}</strong> (R$ {topClienteGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Cidade líder em eventos: <strong>{topCidadeNome}</strong>.
                </p>
              </div>
            </div>
            <span className="rel-clientes-insights-badge">
              Taxa de Retorno: {metricas.taxaRetorno}%
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
                <strong className="stat-number">R$ {metricas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
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
          <div className="rel-card-unificado">
            <div className="rel-card-header">
              <div>
                <h3 className="rel-card-title">🏆 Top Clientes VIP &amp; Cidades Líderes</h3>
                <p className="rel-card-sub">Maiores investidores e concentração geográfica de eventos</p>
              </div>
            </div>

            <div className="rel-clientes-rank-grid">
              {/* PAINEL CLIENTES VIP */}
              <div className="rel-clientes-rank-card">
                <span className="rel-clientes-rank-header">🥇 Top 3 Clientes em Faturamento</span>
                {topClientes.slice(0, 3).map((c, idx) => (
                  <div key={idx} className="rel-clientes-rank-row">
                    <span style={{ color: 'var(--texto-principal, #0f172a)', fontWeight: 700 }}>{idx + 1}º {c.nome}</span>
                    <span style={{ color: '#10b981', fontWeight: 850 }}>R$ {c.gastoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {topClientes.length === 0 && <span style={{ fontSize: '0.74rem', color: 'var(--texto-secundario, #94a3b8)' }}>Sem lançamentos acumulados.</span>}
              </div>

              {/* PAINEL CIDADES */}
              <div className="rel-clientes-rank-card">
                <span className="rel-clientes-rank-header">📍 Top Cidades em Festas</span>
                <div className="rel-clientes-cidades-tags">
                  {rankingCidades.map(([cidade, count], idx) => (
                    <span key={idx} className="rel-clientes-cidade-tag">
                      {cidade}: <strong>{count} festas</strong>
                    </span>
                  ))}
                  {rankingCidades.length === 0 && <span style={{ fontSize: '0.74rem', color: 'var(--texto-secundario, #94a3b8)' }}>Sem cidades registradas.</span>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TABELA GERAL DE CLIENTES */}
      <div className="rel-card-unificado">
        <div className="rel-card-header">
          <div>
            <h3 className="rel-card-title">📋 Carteira Completa de Clientes ({clientesFiltrados.length})</h3>
            <p className="rel-card-sub">Listagem segmentada com histórico de festas e LTV.</p>
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
                onClick={exportarCSVClientes}
                className="rel-btn-action-outline"
                title="Exportar planilha Excel (CSV)"
              >
                📊 Excel (CSV)
              </button>
              <button 
                type="button" 
                className="rel-btn-action-primary" 
                onClick={exportarRelatorioGeral}
                title="Baixar Relatório Executivo em PDF"
              >
                📄 Baixar PDF
              </button>
            </div>
          </div>
        </div>

        {/* BARRA DE PESQUISA & SEGMENTAÇÃO */}
        <div className="rel-clientes-subbar">
          <div className="rel-clientes-search-box">
            <i className="fas fa-search rel-search-icon"></i>
            <input 
              type="text" 
              placeholder="Buscar por nome, cidade ou telefone..." 
              value={termoBusca}
              onChange={e => setTermoBusca(e.target.value)}
              className="rel-clientes-search-input"
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

          <div className="rel-clientes-pills">
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('TODOS')}
              className={`rel-cliente-pill-btn ${filtroSegmento === 'TODOS' ? 'active' : ''}`}
            >
              📋 Todos ({todosClientesData.length})
            </button>
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('VIP')}
              className={`rel-cliente-pill-btn vip ${filtroSegmento === 'VIP' ? 'active' : ''}`}
            >
              ⭐ Clientes VIP
            </button>
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('ATIVOS')}
              className={`rel-cliente-pill-btn ativo ${filtroSegmento === 'ATIVOS' ? 'active' : ''}`}
            >
              🟢 Ativos
            </button>
            <button 
              type="button" 
              onClick={() => setFiltroSegmento('INATIVOS')}
              className={`rel-cliente-pill-btn inativo ${filtroSegmento === 'INATIVOS' ? 'active' : ''}`}
            >
              ⚪ Inativos (&gt;6m)
            </button>
          </div>
        </div>

        {/* TABELA PROTEGIDA COM SCROLL HORIZONTAL */}
        <div className="rel-table-scroll-wrapper">
          <table className="rel-clientes-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>CLIENTE</th>
                <th style={{ width: '24%' }}>CIDADE / CONTATO</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Nº FESTAS</th>
                <th style={{ width: '16%', textAlign: 'right' }}>GASTO TOTAL (LTV)</th>
                <th style={{ width: '10%', textAlign: 'center' }}>STATUS</th>
                <th style={{ width: '8%', textAlign: 'center' }}>AÇÃO CRM</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="rel-table-empty-cell">
                    Nenhum cliente encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((c, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="rel-cliente-nome-row">
                        <strong className="rel-cliente-nome">{c.nome}</strong>
                        {c.seloVIP && (
                          <span 
                            className="rel-cliente-vip-badge" 
                            style={{ 
                              background: c.seloVIP.bg, 
                              color: c.seloVIP.color,
                              borderColor: c.seloVIP.color 
                            }}
                          >
                            {c.seloVIP.label}
                          </span>
                        )}
                      </div>
                      <div className="rel-cliente-subtext">Última locação: {c.ultimaLocacaoStr}</div>
                    </td>
                    <td>
                      <div className="rel-cliente-cidade">{c.cidade}</div>
                      <div className="rel-cliente-subtext">{c.telefone || 'Sem telefone'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="rel-cliente-festas-count">{c.festas}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong className="rel-cliente-valor">
                        R$ {c.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`rel-status-pill ${c.status === 'Ativo' ? 'ativo' : 'inativo'}`}>
                        {c.status === 'Ativo' ? '🟢 Ativo' : '⚪ Inativo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button" 
                        onClick={() => abrirWhatsAppCliente(c)}
                        className="rel-btn-crm-whatsapp"
                        title="Enviar mensagem no WhatsApp"
                      >
                        <i className="fab fa-whatsapp"></i> WhatsApp
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