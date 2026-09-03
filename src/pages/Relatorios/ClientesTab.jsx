import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { gerarRelatorioClientesPDF } from "../../utils/gerarRelatorioClientesPDF";
import "./ClientesTab.css";

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

        const clientes = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));

        const totalClientes = clientes.length;
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();

        let novosMes = 0;
        const clientesStats = {};

        clientes.forEach(c => {
          if (c.criadoEm) {
            const dataCriacao = c.criadoEm?.toDate ? c.criadoEm.toDate() : new Date(c.criadoEm);
            if (dataCriacao.getMonth() === mesAtual && dataCriacao.getFullYear() === anoAtual) {
              novosMes++;
            }
          }
          const cidade = c.cidade || "Não informada";
          clientesStats[c.id] = {
            id: c.id,
            nome: c.nome || c.nomeFantasia || c.razaoSocial || "Cliente Sem Nome",
            telefone: c.telefone || c.celular || c.whatsapp || '',
            cidade,
            qtdLocacoes: 0,
            gastoTotal: 0,
            ultimaLocacao: null
          };
        });

        let somaTotal = 0;
        locacoes.forEach(loc => {
          const st = String(loc.status || '').toLowerCase();
          if (st.includes('cancel')) return;

          let vFinal = 0;
          if (loc.valorTotal !== undefined && loc.valorTotal !== null) {
            let vStr = String(loc.valorTotal).replace(/[^\d.,-]/g, '').replace(',', '.');
            vFinal = parseFloat(vStr) || 0;
          } else if (loc.total !== undefined && loc.total !== null) {
            let vStr = String(loc.total).replace(/[^\d.,-]/g, '').replace(',', '.');
            vFinal = parseFloat(vStr) || 0;
          }

          somaTotal += vFinal;

          const cId = loc.clienteId || loc.idEmpresa || loc.cliente;
          if (cId && clientesStats[cId]) {
            clientesStats[cId].qtdLocacoes++;
            clientesStats[cId].gastoTotal += vFinal;

            let dataEvento = loc.dataRetirada || loc.dataEvento || loc.dataCriacao;
            if (dataEvento) {
              const dt = dataEvento?.toDate ? dataEvento.toDate() : new Date(dataEvento);
              if (!clientesStats[cId].ultimaLocacao || dt > clientesStats[cId].ultimaLocacao) {
                clientesStats[cId].ultimaLocacao = dt;
              }
            }
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

  // EXPORTAR CSV
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
        usuarioEmail: usuarioLogado?.email
      });
      await registrarLog("EXPORTAÇÃO DE RELATÓRIO", "Baixou o relatório completo de clientes em PDF.");
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    }
  };

  // CONTATO WHATSAPP CRM
  const abrirWhatsAppCliente = (cliente) => {
    const telLimpo = (cliente.telefone || '').replace(/\D/g, '');
    if (!telLimpo) {
      alert("Este cliente não possui telefone/celular cadastrado.");
      return;
    }
    const numFinal = telLimpo.length <= 11 ? `55${telLimpo}` : telLimpo;
    const msg = encodeURIComponent(`Olá, ${cliente.nome}! Tudo bem? Aqui é da equipe ${dadosEmpresa.nomeEmpresa || 'Celebre'}. Gostaríamos de saber como foi sua experiência conosco e apresentar novidades especiais para seus próximos eventos! 🎉`);
    window.open(`https://wa.me/${numFinal}?text=${msg}`, '_blank');
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>Calculando indicadores de clientes e LTV...</div>;

  return (
    <div className="rel-clientes-wrapper fade-in">
      
      {/* 4 CARDS KPI ESSENCIAIS & COMPACTOS (GOLDEN RULE 1 & 2) */}
      {mostrarIndicadores && (
        <div className="clientes-stats-grid rel-kpi-grid-compact">
          <div className="stat-card-pro card-green">
            <div className="stat-icon-wrapper icon-green">👥</div>
            <div className="stat-content">
              <span className="stat-title">TOTAL DE CLIENTES</span>
              <span className="stat-number">{metricas.total}</span>
              <small className="stat-desc">Base cadastrada</small>
            </div>
          </div>

          <div className="stat-card-pro card-amber">
            <div className="stat-icon-wrapper icon-amber">✨</div>
            <div className="stat-content">
              <span className="stat-title">NOVOS NO MÊS</span>
              <span className="stat-number">+{metricas.novosMes}</span>
              <small className="stat-desc">Crescimento recente</small>
            </div>
          </div>

          <div className="stat-card-pro card-purple">
            <div className="stat-icon-wrapper icon-purple">💳</div>
            <div className="stat-content">
              <span className="stat-title">TICKET MÉDIO (LTV)</span>
              <span className="stat-number">R$ {metricas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              <small className="stat-desc">Valor por locação</small>
            </div>
          </div>

          <div className="stat-card-pro card-red">
            <div className="stat-icon-wrapper icon-red">🔁</div>
            <div className="stat-content">
              <span className="stat-title">TAXA DE RETORNO</span>
              <span className="stat-number">{metricas.taxaRetorno}%</span>
              <small className="stat-desc">{metricas.clientesFieis} recorrentes</small>
            </div>
          </div>
        </div>
      )}

      {/* LISTAGEM DE CLIENTES */}
      <div className="rel-card-unificado">
        <div className="rel-card-header">
          <div>
            <h3 className="rel-card-title">Carteira Completa de Clientes ({clientesFiltrados.length})</h3>
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

        {/* CONTAINER DA TABELA / LISTA ESTRUTURADA */}
        <div className="rel-table-container-responsive">
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
                  <tr key={idx} className="rel-cliente-row">
                    {/* CÉLULA PRINCIPAL ESTRUTURADA COM ZONAS FIXAS */}
                    <td className="rel-cell-cliente">
                      {/* 1. ZONA SUPERIOR: CIDADE + CONTATO (ESQ) | STATUS + WHATSAPP (DIR) */}
                      <div className="rel-cli-header-zone">
                        <div className="rel-cli-meta-left">
                          <span className="rel-cli-cidade-badge">{c.cidade}</span>
                          {c.telefone && <span className="rel-cli-tel-text">{c.telefone}</span>}
                        </div>
                        <div className="rel-cli-right-actions">
                          <span className={`rel-status-pill ${c.status === 'Ativo' ? 'ativo' : 'inativo'}`}>
                            {c.status === 'Ativo' ? '🟢 Ativo' : '⚪ Inativo'}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => abrirWhatsAppCliente(c)}
                            className="rel-btn-crm-whatsapp-compact"
                            title="Conversar no WhatsApp"
                          >
                            💬
                          </button>
                        </div>
                      </div>

                      {/* 2. ZONA INFERIOR: NOME + VIP (ESQ) | VALOR LTV + FESTAS (DIR) */}
                      <div className="rel-cli-body-zone">
                        <div className="rel-cli-info-left">
                          <div className="rel-cli-nome-group">
                            <span className="rel-cli-nome-title">{c.nome}</span>
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
                          <div className="rel-cli-sub-ultima">Última locação: {c.ultimaLocacaoStr}</div>
                        </div>

                        <div className="rel-cli-info-right">
                          <div className="rel-cli-valor-ltv">
                            R$ {c.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <span className="rel-cli-festas-tag">
                            {c.festas} festa{c.festas !== 1 ? 's' : ''} realizada{c.festas !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* CÉLULAS DESKTOP */}
                    <td className="desktop-only-col">
                      <div className="rel-cli-nome-group">
                        <span className="rel-cli-nome-title">{c.nome}</span>
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
                      <div className="rel-cli-sub-ultima">Última: {c.ultimaLocacaoStr}</div>
                    </td>

                    <td className="desktop-only-col">
                      <div className="rel-cliente-cidade">{c.cidade}</div>
                      <div className="rel-cliente-subtext">{c.telefone || 'Sem telefone'}</div>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                      <span className="rel-cliente-festas-count">{c.festas}</span>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'right' }}>
                      <strong className="rel-cli-valor-ltv">
                        R$ {c.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'center' }}>
                      <span className={`rel-status-pill ${c.status === 'Ativo' ? 'ativo' : 'inativo'}`}>
                        {c.status === 'Ativo' ? '🟢 Ativo' : '⚪ Inativo'}
                      </span>
                    </td>

                    <td className="desktop-only-col" style={{ textAlign: 'center' }}>
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