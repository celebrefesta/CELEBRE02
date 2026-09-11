import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Disponibilidade.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { gerarMapaSeparacaoPDF } from '../../utils/gerarMapaSeparacaoPDF';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const Disponibilidade = ({ estoque: estoqueProp, locacoes: locacoesProp }) => {
  const navigate = useNavigate();
  const auth = getAuth();
  const [usuarioLogado, setUsuarioLogado] = useState(auth.currentUser);

  const [loading, setLoading] = useState(true);
  const [estoque, setEstoque] = useState(estoqueProp || []);
  const [locacoes, setLocacoes] = useState(locacoesProp || []);
  const [dadosEmpresa, setDadosEmpresa] = useState(null);

  const [dataAtual, setDataAtual] = useState(new Date());
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [itemSelecionadoId, setItemSelecionadoId] = useState('todos');
  const [diaDetalhes, setDiaDetalhes] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [apenasAlugados, setApenasAlugados] = useState(false);
  const [apenasManutencao, setApenasManutencao] = useState(false);
  const [pecaParaSubstituir, setPecaParaSubstituir] = useState(null);
  const [menuExportAberto, setMenuExportAberto] = useState(false);

  const exportMenuRef = useRef(null);

  // Escutar autenticação
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUsuarioLogado(user);
    });
    return () => unsub();
  }, [auth]);

  // Fechar dropdown de exportação ao clicar fora
  useEffect(() => {
    const handleClickFora = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setMenuExportAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Controle de exibição de cards KPI no mobile
  const [mostrarKpiMobile, setMostrarKpiMobile] = useState(() => {
    try {
      const salvo = localStorage.getItem('celebre_disp_show_kpi_mobile');
      return salvo !== null ? JSON.parse(salvo) : true;
    } catch {
      return true;
    }
  });

  const toggleKpiMobile = () => {
    setMostrarKpiMobile(prev => {
      const next = !prev;
      try {
        localStorage.setItem('celebre_disp_show_kpi_mobile', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Carregar dados de forma robusta e compatível com multi-tenant
  const carregarDados = useCallback(async () => {
    const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;
    if (!tenantId && !usuarioLogado) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const uidsAlvoSet = new Set([tenantId].filter(Boolean));
      if (usuarioLogado?.uid) uidsAlvoSet.add(usuarioLogado.uid);

      const rawImp = localStorage.getItem('impersonatingTenant');
      if (rawImp) {
        try {
          const imp = JSON.parse(rawImp);
          if (imp.uid) uidsAlvoSet.add(imp.uid);
          if (imp.originalUid) uidsAlvoSet.add(imp.originalUid);
          if (Array.isArray(imp.allUids)) imp.allUids.forEach(u => u && uidsAlvoSet.add(u));
        } catch (e) {}
      }

      const mapEstoque = new Map();
      const mapLocacoes = new Map();

      for (const uId of uidsAlvoSet) {
        const [snapEU, snapET, snapLU, snapLT] = await Promise.all([
          getDocs(query(collection(db, "estoque"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "estoque"), where("tenantId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "locacoes"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "locacoes"), where("tenantId", "==", uId))).catch(() => ({ docs: [] })),
        ]);
        [...snapEU.docs, ...snapET.docs].forEach(d => mapEstoque.set(d.id, { id: d.id, ...d.data() }));
        [...snapLU.docs, ...snapLT.docs].forEach(d => mapLocacoes.set(d.id, { id: d.id, ...d.data() }));
      }

      setEstoque(Array.from(mapEstoque.values()));
      setLocacoes(Array.from(mapLocacoes.values()));

      // Dados da Empresa
      const empId = tenantId || usuarioLogado?.uid;
      if (empId) {
        try {
          const empSnap = await getDoc(doc(db, "configuracoes_empresa", empId));
          if (empSnap.exists()) {
            setDadosEmpresa(empSnap.data());
          } else {
            const fallbackSnap = await getDoc(doc(db, "configuracoes", empId));
            if (fallbackSnap.exists()) setDadosEmpresa(fallbackSnap.data());
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error("Erro ao carregar dados da página de Disponibilidade:", err);
    } finally {
      setLoading(false);
    }
  }, [usuarioLogado]);

  useEffect(() => {
    if (!estoqueProp || !locacoesProp) {
      carregarDados();
    } else {
      setLoading(false);
    }
  }, [carregarDados, estoqueProp, locacoesProp]);

  const ano = dataAtual.getFullYear();
  const mesIndex = dataAtual.getMonth();

  // Normalizador de datas (DD/MM/YYYY ou YYYY-MM-DD para YYYY-MM-DD)
  const formatarISO = (dStr) => {
    if (!dStr || typeof dStr !== 'string') return '';
    const limpo = dStr.split('T')[0].trim();
    if (limpo.includes('/')) {
      const p = limpo.split('/');
      if (p.length === 3) {
        if (p[0].length === 4) return `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`;
        return `${p[2]}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`;
      }
    }
    return limpo;
  };

  // Formatador para exibição em português brasileiro (DD/MM/YYYY)
  const formatarDataBR = (dStr) => {
    if (!dStr || typeof dStr !== 'string') return '';
    const limpo = dStr.split('T')[0].trim();
    if (limpo.includes('/')) {
      const p = limpo.split('/');
      if (p.length === 3) {
        if (p[0].length === 4) return `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`;
        return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
      }
    }
    if (limpo.includes('-')) {
      const p = limpo.split('-');
      if (p.length === 3) {
        if (p[0].length === 4) return `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`;
        return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
      }
    }
    return limpo;
  };

  // Quantidade em manutenção no dia específico
  const obterManutencaoNoDia = (item, dataStr) => {
    const emManutencaoTotal = item.qtdManutencao !== undefined ? Number(item.qtdManutencao) : (item.status === 'manutencao' ? Number(item.quantidade || 1) : 0);
    if (emManutencaoTotal <= 0) return 0;

    const dataFimRaw = item.dataPrevisaoRetorno || '';
    if (dataFimRaw) {
      const dataFimISO = formatarISO(dataFimRaw);
      if (dataFimISO && dataStr > dataFimISO) {
        return 0;
      }
    }

    const dataInicioRaw = item.dataInicioManutencao || '';
    if (dataInicioRaw) {
      const dataInicioISO = formatarISO(dataInicioRaw);
      if (dataInicioISO && dataStr < dataInicioISO) {
        return 0;
      }
    }

    return emManutencaoTotal;
  };

  // Todos os dias do mês selecionado
  const diasDoMes = useMemo(() => {
    const totalDias = new Date(ano, mesIndex + 1, 0).getDate();
    const dias = [];
    for (let i = 1; i <= totalDias; i++) {
      const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dias.push({ dia: i, dataStr });
    }
    return dias;
  }, [ano, mesIndex]);

  // Lista de peças efetiva
  const listaPecasEfetiva = useMemo(() => {
    if (estoque && estoque.length > 0) return estoque;

    const mapa = new Map();
    locacoes.forEach(loc => {
      const itens = loc.itens || loc.carrinho || [];
      itens.forEach(i => {
        const idKey = i.id || i.nome;
        const qtdItem = Math.max(1, Number(i.qtd || i.quantidade || 1));
        if (!mapa.has(idKey)) {
          mapa.set(idKey, {
            id: idKey,
            nome: i.nome || i.titulo || 'Peça Decorativa',
            categoria: i.categoria || 'Decoração',
            foto: i.foto || '',
            quantidade: qtdItem
          });
        } else {
          const ex = mapa.get(idKey);
          if (qtdItem > ex.quantidade) ex.quantidade = qtdItem;
        }
      });
    });
    return Array.from(mapa.values());
  }, [estoque, locacoes]);

  // Lista de categorias únicas do estoque
  const categorias = useMemo(() => {
    const cats = new Set(listaPecasEfetiva.map(item => item.categoria || 'Geral'));
    return ['Todas', ...Array.from(cats)];
  }, [listaPecasEfetiva]);

  // Mapeamento de ocupação
  const mapaOcupacao = useMemo(() => {
    const mapa = {};
    const mapaDiaGeral = {};

    const locacoesAtivas = locacoes.filter(loc => {
      const st = (loc.status || '').toLowerCase();
      const isInativa = (
        st.includes('cancelad') ||
        st.includes('perdid') ||
        st.includes('abandonad') ||
        st.includes('esquecid') ||
        st.includes('finalizad') ||
        st.includes('devolv') ||
        st.includes('concluid')
      );
      return !isInativa;
    });

    locacoesAtivas.forEach(loc => {
      const ret = formatarISO(loc.dataRetirada);
      const dev = formatarISO(loc.dataDevolucao) || ret;
      if (!ret) return;

      const itens = loc.itens || loc.carrinho || [];
      const clienteNome = loc.clienteNome || 'Cliente';
      const numPedido = loc.numeroPedido ? `#${loc.numeroPedido}` : '';
      const tipoServico = loc.tipoServico || 'LOCAÇÃO';

      diasDoMes.forEach(({ dataStr }) => {
        if (dataStr >= ret && dataStr <= dev) {
          if (!mapaDiaGeral[dataStr]) mapaDiaGeral[dataStr] = [];
          mapaDiaGeral[dataStr].push({
            locacaoId: loc.id,
            numPedido,
            clienteNome,
            tipoServico,
            status: loc.status,
            itens,
            dataRetirada: loc.dataRetirada,
            dataDevolucao: loc.dataDevolucao
          });

          itens.forEach(item => {
            const qtd = Math.max(1, Number(item.qtd || item.quantidade || 1));

            const registrarUso = (targetKey, qtdUso, nomePeca) => {
              if (!targetKey) return;

              const pecaOficial = listaPecasEfetiva.find(e => 
                String(e.id) === String(targetKey) || 
                (e.codigo && item.codigo && e.codigo === item.codigo) ||
                (e.nome && (e.nome || '').toLowerCase().trim() === String(nomePeca || targetKey).toLowerCase().trim())
              );

              const officialId = pecaOficial ? pecaOficial.id : targetKey;

              if (!mapa[officialId]) mapa[officialId] = {};
              if (!mapa[officialId][dataStr]) {
                mapa[officialId][dataStr] = { alugados: 0, reservas: [] };
              }
              mapa[officialId][dataStr].alugados += qtdUso;
              mapa[officialId][dataStr].reservas.push({
                locacaoId: loc.id,
                numPedido,
                clienteNome,
                qtd: qtdUso,
                viaDecoracao: item.nome !== nomePeca ? item.nome : undefined
              });
            };

            registrarUso(item.id || item.nome, qtd, item.nome);

            const pecasCompostas = item.itensDecoracao || item.itensDoKit || item.pecasKit || item.especificacoes?.itensDecoracao || item.especificacoes?.itensDoKit || item.especificacoes?.pecasKit || [];
            pecasCompostas.forEach(p => {
              const pQtdUnitaria = Math.max(1, Number(p.qtd || p.quantidade || 1));
              const pQtdTotal = pQtdUnitaria * qtd;
              registrarUso(p.id || p.nome, pQtdTotal, p.nome);
            });
          });
        }
      });
    });

    return { porItem: mapa, porDiaGeral: mapaDiaGeral };
  }, [locacoes, diasDoMes, listaPecasEfetiva]);

  // Filtro de peças
  const estoqueFiltrado = useMemo(() => {
    return listaPecasEfetiva.filter(item => {
      const bateNome = (item.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
                       (item.codigo || '').toLowerCase().includes(busca.toLowerCase());
      const bateCat = categoria === 'Todas' || (item.categoria || 'Geral') === categoria;
      const batePecaEspecifica = itemSelecionadoId === 'todos' || String(item.id) === String(itemSelecionadoId);
      
      if (apenasManutencao) {
        const emMaint = item.qtdManutencao !== undefined ? Number(item.qtdManutencao) : (item.status === 'manutencao' ? Number(item.quantidade || 1) : 0);
        if (emMaint <= 0) return false;
      }

      return bateNome && bateCat && batePecaEspecifica;
    });
  }, [listaPecasEfetiva, busca, categoria, itemSelecionadoId, apenasManutencao]);

  // KPIs do mês
  const kpisMes = useMemo(() => {
    const locsSet = new Set();
    let totalPecasAlugadas = 0;
    let diasComEventoCount = 0;
    const alertasGiroRapido = [];

    diasDoMes.forEach(({ dataStr }) => {
      const eventos = mapaOcupacao.porDiaGeral[dataStr] || [];
      if (eventos.length > 0) {
        diasComEventoCount++;
        eventos.forEach(ev => {
          if (ev.locacaoId) locsSet.add(ev.locacaoId);
          (ev.itens || []).forEach(it => {
            totalPecasAlugadas += Math.max(1, Number(it.qtd || it.quantidade || 1));
          });
        });
      }
    });

    const totalFestas = locsSet.size;
    const totalDiasNoMes = diasDoMes.length;
    const taxaOcupacao = totalDiasNoMes > 0 ? Math.round((diasComEventoCount / totalDiasNoMes) * 100) : 0;

    // Giros Rápidos (<24-48h entre devolução e próxima retirada)
    locacoes.forEach(loc => {
      const devDateStr = formatarISO(loc.dataDevolucao);
      if (!devDateStr) return;

      locacoes.forEach(outraLoc => {
        if (loc.id === outraLoc.id) return;
        const retDateStr = formatarISO(outraLoc.dataRetirada);
        if (!retDateStr) return;

        const devMs = new Date(devDateStr + 'T12:00:00').getTime();
        const retMs = new Date(retDateStr + 'T12:00:00').getTime();
        const diffDias = Math.round((retMs - devMs) / (1000 * 60 * 60 * 24));

        if (diffDias >= 0 && diffDias <= 1) {
          const itensLoc = loc.itens || loc.carrinho || [];
          const itensOutra = outraLoc.itens || outraLoc.carrinho || [];
          
          const pecasEmComum = itensLoc.filter(it => 
            itensOutra.some(oIt => (oIt.id && String(oIt.id) === String(it.id)) || (oIt.nome && (oIt.nome || '').toLowerCase() === (it.nome || '').toLowerCase()))
          );

          if (pecasEmComum.length > 0 || (loc.tipoServico || '').includes('DECORA') || (outraLoc.tipoServico || '').includes('DECORA')) {
            alertasGiroRapido.push({
              devolucaoLoc: loc,
              retiradaLoc: outraLoc,
              diffDias,
              pecasEmComum,
              dataDevolucao: devDateStr,
              dataRetirada: retDateStr
            });
          }
        }
      });
    });

    return {
      totalFestas,
      totalPecasAlugadas,
      diasComEventoCount,
      totalDiasNoMes,
      taxaOcupacao,
      alertasGiroRapido
    };
  }, [diasDoMes, mapaOcupacao, locacoes]);

  const navegarMes = (delta) => {
    setDataAtual(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const irParaMesAtual = () => {
    setDataAtual(new Date());
  };

  const handleExportarPDFComFiltro = (tipo = 'mes') => {
    const hoje = new Date();
    const hojeIsoStr = hoje.toISOString().split('T')[0];
    let tituloPeriodo = `Mês de ${MESES[mesIndex]}`;
    let dataInicio = null;
    let dataFim = null;
    let apenasComReserva = false;

    if (tipo === '3dias') {
      const dFim = new Date(hoje);
      dFim.setDate(hoje.getDate() + 3);
      dataInicio = hojeIsoStr;
      dataFim = dFim.toISOString().split('T')[0];
      tituloPeriodo = `Próximos 3 Dias (${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)})`;
      apenasComReserva = true;
    } else if (tipo === 'fimdesemana') {
      const diaSemana = hoje.getDay();
      const distSexta = (5 - diaSemana + 7) % 7;
      const dSexta = new Date(hoje);
      dSexta.setDate(hoje.getDate() + distSexta);
      const dDom = new Date(dSexta);
      dDom.setDate(dSexta.getDate() + 2);
      dataInicio = dSexta.toISOString().split('T')[0];
      dataFim = dDom.toISOString().split('T')[0];
      tituloPeriodo = `Final de Semana (${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)})`;
      apenasComReserva = true;
    } else if (tipo === 'apenas_reservados') {
      tituloPeriodo = `Somente Peças c/ Reserva (${MESES[mesIndex]})`;
      apenasComReserva = true;
    }

    gerarMapaSeparacaoPDF(
      MESES[mesIndex],
      ano,
      estoqueFiltrado,
      mapaOcupacao,
      kpisMes,
      dadosEmpresa,
      {
        tituloPeriodo,
        dataInicio,
        dataFim,
        apenasComReserva,
        incluirCheckbox: true
      }
    );
  };

  const hojeISO = new Date().toISOString().split('T')[0];

  return (
    <div className="disponibilidade-container locacoes-container dashboard-container fade-in">
      
      {/* 🌟 HERO CABEÇALHO CELEBRE */}
      <header className="clientes-hero-header">
        <div className="welcome-text">
          <div className="header-title-row">
            <span className="header-icon-badge">
              <i className="fas fa-calendar-alt"></i>
            </span>
            <div>
              <h1>Matriz de Disponibilidade</h1>
              <p>Consulte em tempo real o estoque disponível e reservas peça por peça.</p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button 
            type="button"
            className="btn-secondary-celebre" 
            onClick={() => navigate('/locacoes')}
            title="Voltar para a listagem de locações"
          >
            <i className="fas fa-arrow-left"></i> Locações
          </button>
          
          <div className="disp-export-wrapper" ref={exportMenuRef}>
            <button
              type="button"
              className="btn-primary-celebre"
              onClick={() => setMenuExportAberto(prev => !prev)}
              title="Exportar Mapa de Separação em PDF"
            >
              <i className="fas fa-file-pdf"></i> Mapa PDF <i className="fas fa-chevron-down" style={{ fontSize: '9px', marginLeft: '3px' }}></i>
            </button>

            {menuExportAberto && (
              <div className="disp-export-dropdown-menu">
                <button type="button" onClick={() => { handleExportarPDFComFiltro('mes'); setMenuExportAberto(false); }}>
                  🗓️ Mês Inteiro (com Checkbox [ ])
                </button>
                <button type="button" onClick={() => { handleExportarPDFComFiltro('3dias'); setMenuExportAberto(false); }}>
                  ⚡ Próximos 3 Dias (Imediato)
                </button>
                <button type="button" onClick={() => { handleExportarPDFComFiltro('fimdesemana'); setMenuExportAberto(false); }}>
                  🎈 Final de Semana (Sex a Dom)
                </button>
                <button type="button" onClick={() => { handleExportarPDFComFiltro('apenas_reservados'); setMenuExportAberto(false); }}>
                  📦 Somente Peças com Reserva
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 📱 CONTROLE DE EXIBIÇÃO DE KPIS NO CELULAR (RECOLHER / EXPANDIR) */}
      <div className="kpi-mobile-toggle-wrapper">
        <button 
          type="button" 
          className={`btn-toggle-kpi-mobile ${!mostrarKpiMobile ? 'is-collapsed' : ''}`}
          onClick={toggleKpiMobile}
          aria-expanded={mostrarKpiMobile}
          title={mostrarKpiMobile ? "Recolher cards de indicadores no celular" : "Expandir cards de indicadores no celular"}
        >
          <div className="toggle-kpi-left">
            <span className="toggle-kpi-icon">📊</span>
            {mostrarKpiMobile ? (
              <span className="toggle-kpi-title">Resumo da Matriz ({MESES[mesIndex]} {ano})</span>
            ) : (
              <span className="toggle-kpi-summary">
                <strong>{kpisMes.totalFestas}</strong> festas • <strong>{kpisMes.totalPecasAlugadas}</strong> peças ({kpisMes.taxaOcupacao}%)
              </span>
            )}
          </div>
          <span className="toggle-kpi-badge">
            {mostrarKpiMobile ? (
              <>Ocultar <i className="fas fa-chevron-up"></i></>
            ) : (
              <>Expandir <i className="fas fa-chevron-down"></i></>
            )}
          </span>
        </button>
      </div>

      {/* 📊 CARDS DE INDICADORES (KPIs - 1 LINHA NO DESKTOP / 2 COLUNAS NO MOBILE) */}
      <div className={`clientes-stats-grid ${!mostrarKpiMobile ? 'kpi-hidden-mobile' : ''}`}>
        <div className="stat-card-pro border-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-glass-cheers"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">FESTAS NO MÊS</span>
            <span className="stat-value">{kpisMes.totalFestas}</span>
            <span className="stat-sub">Agendadas em {MESES[mesIndex]}</span>
          </div>
        </div>

        <div className="stat-card-pro border-green">
          <div className="stat-icon-wrapper icon-green">
            <i className="fas fa-boxes"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">PEÇAS RESERVADAS</span>
            <span className="stat-value">{kpisMes.totalPecasAlugadas}</span>
            <span className="stat-sub">Alocadas no acervo</span>
          </div>
        </div>

        <div className="stat-card-pro border-blue">
          <div className="stat-icon-wrapper icon-blue">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">TAXA DE OCUPAÇÃO</span>
            <span className="stat-value">{kpisMes.taxaOcupacao}%</span>
            <span className="stat-sub">{kpisMes.diasComEventoCount} de {kpisMes.totalDiasNoMes} dias</span>
          </div>
        </div>

        <div className={`stat-card-pro ${kpisMes.alertasGiroRapido.length > 0 ? 'border-amber' : 'border-teal'}`}>
          <div className={`stat-icon-wrapper ${kpisMes.alertasGiroRapido.length > 0 ? 'icon-amber' : 'icon-teal'}`}>
            <i className={`fas ${kpisMes.alertasGiroRapido.length > 0 ? 'fa-bolt' : 'fa-shield-alt'}`}></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">{kpisMes.alertasGiroRapido.length > 0 ? 'GIROS RÁPIDOS' : 'FLUXO REVISÃO'}</span>
            <span className="stat-value" style={kpisMes.alertasGiroRapido.length > 0 ? { color: '#d97706' } : { color: '#0d9488' }}>
              {kpisMes.alertasGiroRapido.length > 0 ? `${kpisMes.alertasGiroRapido.length} Alertas` : '100% Estável'}
            </span>
            <span className="stat-sub">{kpisMes.alertasGiroRapido.length > 0 ? 'Higienização expressa' : 'Sem conflitos'}</span>
          </div>
        </div>
      </div>

      {/* 🔍 PAINEL UNIFICADO DE FILTROS SLIM & SOFISTICADO */}
      <div className="disp-filter-panel">
        
        {/* LINHA 1: BUSCA E SELETOR DE CATEGORIA (2 COLUNAS LADO A LADO) */}
        <div className="disp-filter-row-top">
          <div className="disp-search-box">
            <i className="fas fa-search disp-search-icon"></i>
            <input
              type="text"
              className="disp-search-input"
              placeholder="Buscar peça ou cód..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {busca && (
              <button className="disp-btn-clear" onClick={() => setBusca('')} title="Limpar busca">
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          <div className="disp-cat-box">
            <select
              className="disp-select-cat"
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
            >
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat === 'Todas' ? 'Todas Categorias' : cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* LINHA 2: NAVEGADOR DO MÊS, CHIPS E LEGENDA */}
        <div className="disp-filter-row-bottom">
          <div className="disp-month-navigator">
            <button className="btn-nav-month" onClick={() => navegarMes(-1)} title="Mês anterior">
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="current-month-display">
              {MESES[mesIndex]} <span className="current-year-accent">{ano}</span>
            </span>
            <button className="btn-nav-month" onClick={() => navegarMes(1)} title="Próximo mês">
              <i className="fas fa-chevron-right"></i>
            </button>
            {(mesIndex !== new Date().getMonth() || ano !== new Date().getFullYear()) && (
              <button className="btn-today-pill" onClick={irParaMesAtual} title="Ir para o mês atual">
                Hoje
              </button>
            )}
          </div>

          <div className="disp-action-chips">
            <button 
              type="button"
              className={`chip-operacao gold ${apenasAlugados ? 'active' : ''}`}
              onClick={() => setApenasAlugados(prev => !prev)}
              title="Ocultar/Esmaecer dias sem agendamentos"
            >
              <span>{apenasAlugados ? '✨ Ocupados' : '👁️ Ocupados'}</span>
            </button>

            <button 
              type="button"
              className={`chip-operacao red ${apenasManutencao ? 'active' : ''}`}
              onClick={() => setApenasManutencao(prev => !prev)}
              title="Filtrar peças em manutenção"
            >
              <span>{apenasManutencao ? '🛠️ Reforma' : '🛠️ Reforma'}</span>
            </button>
          </div>

          <div className="disp-legend-strip">
            <div className="disp-legend-pill"><span className="legend-dot dot-green"></span> Livre</div>
            <div className="disp-legend-pill"><span className="legend-dot dot-yellow"></span> Parcial</div>
            <div className="disp-legend-pill"><span className="legend-dot dot-red"></span> Esgotado</div>
            <div className="disp-legend-pill"><span className="legend-dot dot-darkred"></span> Reforma</div>
          </div>
        </div>

      </div>

      {/* 📦 MATRIZ DE DISPONIBILIDADE DO ACERVO */}
      <div className="disp-matrix-list">
        {loading ? (
          <div className="disp-empty-state-card">
            <i className="fas fa-spinner fa-spin disp-loading-spinner"></i>
            <h3>Carregando Matriz do Acervo...</h3>
            <p>Sincronizando acervo e reservas em tempo real.</p>
          </div>
        ) : estoqueFiltrado.length === 0 ? (
          <div className="disp-empty-state-card">
            <div className="disp-empty-icon-circle">
              <i className="fas fa-boxes"></i>
            </div>
            <h3>Nenhuma peça encontrada</h3>
            <p>Não encontramos itens no acervo que correspondam aos filtros selecionados.</p>
            {(busca || categoria !== 'Todas' || apenasManutencao) && (
              <button 
                type="button" 
                className="btn-secondary-celebre" 
                onClick={() => { setBusca(''); setCategoria('Todas'); setApenasManutencao(false); }}
                style={{ marginTop: '12px' }}
              >
                <i className="fas fa-undo"></i> Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          estoqueFiltrado.map(item => {
            const qtdTotal = Math.max(1, Number(item.quantidade || 1));
            const mapaItem = mapaOcupacao.porItem[item.id] || {};
            const isDeco = (item.categoria || '').toLowerCase().includes('decora') || item.itensDecoracao || item.pecasKit || item.itensDoKit;

            // Coletar reservas no mês
            let totalDiasAlugadosNoMes = 0;
            const reservasNoMesMap = new Map();

            diasDoMes.forEach(({ dataStr }) => {
              const ocup = mapaItem[dataStr];
              if (ocup && ocup.alugados > 0) {
                totalDiasAlugadosNoMes++;
                (ocup.reservas || []).forEach(res => {
                  if (!reservasNoMesMap.has(res.locacaoId)) {
                    reservasNoMesMap.set(res.locacaoId, res);
                  }
                });
              }
            });

            const reservasNoMes = Array.from(reservasNoMesMap.values());

            return (
              <div key={item.id} className="disp-item-card">
                
                {/* CABEÇALHO DO ITEM */}
                <div className="disp-item-header">
                  <div className="disp-item-header-left">
                    <div 
                      className="disp-item-thumb"
                      onClick={() => item.foto && setFotoAmpliada(item.foto)}
                      title={item.foto ? "Clique para ampliar a foto" : "Sem foto"}
                    >
                      {item.foto ? (
                        <img src={item.foto} alt={item.nome} />
                      ) : (
                        <i className="fas fa-camera"></i>
                      )}
                    </div>

                    <div className="disp-item-details">
                      <div className="disp-item-name-row">
                        <span className="disp-item-title">{item.nome}</span>
                        {isDeco && (
                          <span className="disp-badge-kit">
                            ✨ DECORAÇÃO COMPLETA
                          </span>
                        )}
                      </div>

                      <div className="disp-item-tags">
                        <span className="disp-tag-pill">
                          Cat: <b>{item.categoria || 'Geral'}</b>
                        </span>
                        <span className="disp-tag-pill highlight">
                          Físico: <b>{qtdTotal} un</b>
                        </span>
                        {item.codigo && (
                          <span className="disp-tag-pill">
                            Cód: <b>{item.codigo}</b>
                          </span>
                        )}
                        {item.dataPrevisaoRetorno && (
                          <span className="disp-tag-pill warning">
                            🛠️ Retorno em {formatarDataBR(item.dataPrevisaoRetorno)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="disp-item-header-right">
                    <span className={`disp-month-status-pill ${totalDiasAlugadosNoMes > 0 ? 'status-occupied' : 'status-free'}`}>
                      {totalDiasAlugadosNoMes > 0 ? (
                        <>⚡ <b>{totalDiasAlugadosNoMes}</b> dia(s) com reserva</>
                      ) : (
                        <>🟢 100% Livre no mês</>
                      )}
                    </span>
                  </div>
                </div>

                {/* QUINZENAS */}
                <div className="disp-timeline-container">
                  {/* 1ª Quinzena */}
                  <div className="disp-quinzena-section">
                    <div className="disp-quinzena-header">
                      <span>🗓️ 1ª Quinzena (1 a 15 de {MESES[mesIndex]})</span>
                    </div>
                    <div className="disp-days-grid">
                      {diasDoMes.slice(0, 15).map(({ dia, dataStr }) => {
                        const isHoje = dataStr === hojeISO;
                        const emManutencao = obterManutencaoNoDia(item, dataStr);
                        const dispReal = Math.max(0, qtdTotal - emManutencao);
                        const alugados = mapaItem[dataStr]?.alugados || 0;
                        const livres = Math.max(0, dispReal - alugados);
                        const reservas = mapaItem[dataStr]?.reservas || [];

                        let cellClass = 'cell-livre';
                        let badgeText = `${livres}`;

                        if (emManutencao >= qtdTotal) {
                          cellClass = 'cell-manutencao';
                          badgeText = '🛠️';
                        } else if (alugados > 0 && livres === 0) {
                          cellClass = 'cell-esgotado';
                          badgeText = '🔴 0';
                        } else if (alugados > 0) {
                          cellClass = 'cell-parcial';
                          badgeText = `🟡 ${livres}`;
                        } else {
                          cellClass = 'cell-livre';
                          badgeText = `🟢 ${livres}`;
                        }

                        return (
                          <div 
                            key={dia}
                            className={`disp-day-cell ${cellClass} ${isHoje ? 'is-today' : ''} ${apenasAlugados && alugados === 0 && emManutencao === 0 ? 'is-dimmed' : ''}`}
                            onClick={() => setDiaDetalhes({ 
                              dia, 
                              dataStr, 
                              eventos: mapaOcupacao.porDiaGeral[dataStr] || [], 
                              ocupacaoItem: mapaItem[dataStr] || { alugados: 0, reservas: [] }, 
                              itemEspecifico: item 
                            })}
                            title={`Dia ${dia} (${dataStr}) - ${livres} un livres de ${qtdTotal} ${reservas.length > 0 ? `| ${reservas.map(r => `#${r.numPedido} - ${r.clienteNome}`).join(', ')}` : ''}`}
                          >
                            <span className="disp-day-num">
                              {dia}{isHoje ? '•' : ''}
                            </span>
                            <span className="disp-day-badge">
                              {badgeText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2ª Quinzena */}
                  <div className="disp-quinzena-section">
                    <div className="disp-quinzena-header">
                      <span>🗓️ 2ª Quinzena (16 a {diasDoMes.length} de {MESES[mesIndex]})</span>
                    </div>
                    <div className="disp-days-grid">
                      {diasDoMes.slice(15).map(({ dia, dataStr }) => {
                        const isHoje = dataStr === hojeISO;
                        const emManutencao = obterManutencaoNoDia(item, dataStr);
                        const dispReal = Math.max(0, qtdTotal - emManutencao);
                        const alugados = mapaItem[dataStr]?.alugados || 0;
                        const livres = Math.max(0, dispReal - alugados);
                        const reservas = mapaItem[dataStr]?.reservas || [];

                        let cellClass = 'cell-livre';
                        let badgeText = `${livres}`;

                        if (emManutencao >= qtdTotal) {
                          cellClass = 'cell-manutencao';
                          badgeText = '🛠️';
                        } else if (alugados > 0 && livres === 0) {
                          cellClass = 'cell-esgotado';
                          badgeText = '🔴 0';
                        } else if (alugados > 0) {
                          cellClass = 'cell-parcial';
                          badgeText = `🟡 ${livres}`;
                        } else {
                          cellClass = 'cell-livre';
                          badgeText = `🟢 ${livres}`;
                        }

                        return (
                          <div 
                            key={dia}
                            className={`disp-day-cell ${cellClass} ${isHoje ? 'is-today' : ''} ${apenasAlugados && alugados === 0 && emManutencao === 0 ? 'is-dimmed' : ''}`}
                            onClick={() => setDiaDetalhes({ 
                              dia, 
                              dataStr, 
                              eventos: mapaOcupacao.porDiaGeral[dataStr] || [], 
                              ocupacaoItem: mapaItem[dataStr] || { alugados: 0, reservas: [] }, 
                              itemEspecifico: item 
                            })}
                            title={`Dia ${dia} (${dataStr}) - ${livres} un livres de ${qtdTotal} ${reservas.length > 0 ? `| ${reservas.map(r => `#${r.numPedido} - ${r.clienteNome}`).join(', ')}` : ''}`}
                          >
                            <span className="disp-day-num">
                              {dia}{isHoje ? '•' : ''}
                            </span>
                            <span className="disp-day-badge">
                              {badgeText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RESERVAS DO MÊS */}
                {reservasNoMes.length > 0 && (
                  <div className="disp-reservas-footer">
                    <span className="disp-reservas-label">
                      📌 Reservas no Mês ({reservasNoMes.length}):
                    </span>
                    <div className="disp-reservas-chips">
                      {reservasNoMes.map((res, rIdx) => (
                        <button
                          key={rIdx}
                          type="button"
                          className="disp-reserva-chip"
                          onClick={() => {
                            const diaEncontrado = diasDoMes.find(({ dataStr }) => {
                              const ocup = mapaItem[dataStr];
                              return ocup && (ocup.reservas || []).some(r => String(r.locacaoId) === String(res.locacaoId));
                            });
                            setDiaDetalhes({ 
                              dia: diaEncontrado ? diaEncontrado.dia : 1, 
                              dataStr: diaEncontrado ? diaEncontrado.dataStr : hojeISO, 
                              eventos: mapaOcupacao.porDiaGeral[diaEncontrado ? diaEncontrado.dataStr : hojeISO] || [], 
                              ocupacaoItem: mapaItem[diaEncontrado ? diaEncontrado.dataStr : hojeISO] || { alugados: 0, reservas: [] }, 
                              itemEspecifico: item 
                            });
                          }}
                        >
                          <span>#{res.numPedido || 'PED'} · {res.clienteNome} ({res.qtd} un)</span>
                          <i className="fas fa-arrow-right"></i>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* 📅 MODAL DE DETALHES DO DIA SELECIONADO */}
      {diaDetalhes && (
        <div className="disp-submodal-overlay" onClick={() => setDiaDetalhes(null)}>
          <div className="disp-submodal-card" onClick={e => e.stopPropagation()}>
            <div className="disp-submodal-header">
              <div>
                <h4>📅 Detalhes do Dia {diaDetalhes.dia}/{mesIndex + 1}/{ano}</h4>
                <p>Agendamentos e ocupações do acervo nesta data</p>
              </div>
              <button className="disp-btn-close-sub" onClick={() => setDiaDetalhes(null)}>✕</button>
            </div>
            
            <div className="disp-submodal-body">
              {/* SEÇÃO 1: PEDIDOS E EVENTOS DE LOCAÇÃO */}
              {diaDetalhes.eventos && diaDetalhes.eventos.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h5 className="disp-submodal-section-title">
                    📋 Locações / Decorações Marcadas ({diaDetalhes.eventos.length}):
                  </h5>

                  {diaDetalhes.eventos.map((ev, idx) => {
                    const alertaGiroDoEvento = kpisMes.alertasGiroRapido.find(a => 
                      a.devolucaoLoc.id === ev.locacaoId || a.retiradaLoc.id === ev.locacaoId
                    );

                    return (
                      <div key={idx} className="disp-submodal-reserva-item">
                        <div className="disp-submodal-reserva-top">
                          <div className="disp-reserva-top-left">
                            <span className="disp-pedido-tag">#{ev.numPedido || 'PEDIDO'}</span>
                            <span className="disp-cliente-nome">{ev.clienteNome}</span>
                          </div>
                          <div className="disp-reserva-top-right">
                            <span className={`disp-pill-servico ${ev.tipoServico?.includes('DECORA') ? 'pill-decora' : 'pill-loc'}`}>
                              {ev.tipoServico || 'LOCAÇÃO'}
                            </span>
                            {ev.locacaoId && (
                              <button
                                type="button"
                                className="disp-btn-abrir-pedido"
                                onClick={() => {
                                  setDiaDetalhes(null);
                                  navigate(`/locacoes/editar/${ev.locacaoId}`);
                                }}
                                title="Abrir página de edição do pedido"
                              >
                                🔗 Abrir Pedido ➔
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="disp-submodal-datas-bar">
                          <span>Status: <b>{ev.status || 'CONFIRMADO'}</b></span>
                          {ev.dataRetirada && (
                            <span className="disp-periodo-text">
                              🗓️ <b>{formatarDataBR(ev.dataRetirada)}</b> {ev.dataDevolucao && ev.dataDevolucao !== ev.dataRetirada ? `até ${formatarDataBR(ev.dataDevolucao)}` : '(Dia único)'}
                            </span>
                          )}
                        </div>

                        {alertaGiroDoEvento && (
                          <div className="disp-box-alerta-giro">
                            <div className="disp-alerta-giro-title">
                              ⚡ ALERTA DE HIGIENIZAÇÃO EXPRESSA (&lt;24h)
                            </div>
                            <div className="disp-alerta-giro-desc">
                              Esta locação tem devolução/saída agendada com intervalo de menos de 24h referente ao pedido <b>#{alertaGiroDoEvento.devolucaoLoc?.numeroPedido || alertaGiroDoEvento.retiradaLoc?.numeroPedido}</b>.
                            </div>
                          </div>
                        )}

                        {ev.fotoTema && (
                          <div className="disp-box-foto-decoracao" onClick={() => setFotoAmpliada(ev.fotoTema)}>
                            <img src={ev.fotoTema} alt={ev.temaFesta || 'Decoração'} className="disp-img-decoracao" />
                            <div className="disp-overlay-foto-hover">🔍 Clique para ampliar decoração ({ev.temaFesta || 'Projeto'})</div>
                          </div>
                        )}

                        <div className="disp-itens-pedido-section">
                          <div className="disp-itens-pedido-title">📦 Itens Solicitados neste Pedido:</div>
                          <div className="disp-itens-pedido-grid">
                            {(ev.itens || []).map((it, iIdx) => {
                              const pecaEstoque = listaPecasEfetiva.find(p => String(p.id) === String(it.id) || (p.nome || '').toLowerCase() === (it.nome || it.titulo || '').toLowerCase());
                              const fotoUrl = it.foto || it.imagem || it.url || pecaEstoque?.foto;
                              const estaEmManutencaoNoDia = pecaEstoque ? obterManutencaoNoDia(pecaEstoque, diaDetalhes.dataStr) > 0 : false;

                              return (
                                <div key={iIdx} className={`disp-card-subitem ${estaEmManutencaoNoDia ? 'is-in-repair' : ''}`}>
                                  <div 
                                    className="disp-thumb-subitem"
                                    onClick={() => fotoUrl && setFotoAmpliada(fotoUrl)}
                                    title={fotoUrl ? 'Clique para ampliar foto' : 'Sem foto'}
                                  >
                                    {fotoUrl ? (
                                      <img src={fotoUrl} alt={it.nome || it.titulo} />
                                    ) : (
                                      <span>📷</span>
                                    )}
                                  </div>
                                  <div className="disp-info-subitem">
                                    <div className="disp-nome-subitem">
                                      {it.nome || it.titulo || 'Peça Decorativa'}
                                      {estaEmManutencaoNoDia && (
                                        <span className="disp-badge-em-reparo">
                                          ⚠️ EM REPARO!
                                        </span>
                                      )}
                                    </div>
                                    <div className="disp-qtd-subitem">Qtd: <b>{it.qtd || it.quantidade || 1} un</b></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* SEÇÃO 2: PEÇAS EM MANUTENÇÃO NESTA DATA */}
              {(() => {
                const itensEmManutencaoNoDia = listaPecasEfetiva.filter(i => obterManutencaoNoDia(i, diaDetalhes.dataStr) > 0);
                if (itensEmManutencaoNoDia.length > 0) {
                  return (
                    <div style={{ marginTop: '14px' }}>
                      <h5 className="disp-submodal-maint-title">
                        🛠️ Peça(s) em Manutenção / Reparo nesta Data ({itensEmManutencaoNoDia.length}):
                      </h5>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {itensEmManutencaoNoDia.map((itMaint, mIdx) => {
                          const fotoUrl = itMaint.foto || itMaint.imagem || '';
                          const valCusto = Number(itMaint.custoManutencao || 0);

                          const evConflito = (diaDetalhes.eventos || []).find(ev => 
                            (ev.itens || []).some(it => 
                              String(it.id) === String(itMaint.id) || 
                              (it.nome || it.titulo || '').toLowerCase() === (itMaint.nome || '').toLowerCase()
                            )
                          );

                          return (
                            <div key={mIdx} className={`disp-maint-conflict-card ${evConflito ? 'is-conflict' : ''}`}>
                              <div className="disp-maint-card-top">
                                <div 
                                  className="disp-maint-thumb"
                                  onClick={() => fotoUrl && setFotoAmpliada(fotoUrl)}
                                >
                                  {fotoUrl ? (
                                    <img src={fotoUrl} alt={itMaint.nome} />
                                  ) : (
                                    <div className="disp-maint-thumb-placeholder">🛠️</div>
                                  )}
                                </div>

                                <div className="disp-maint-info">
                                  <div className="disp-maint-name">{itMaint.nome}</div>
                                  <div className="disp-maint-cod">
                                    CÓD: <b>{itMaint.codigo || 'S/N'}</b> | Indisponível: <b>{itMaint.qtdManutencao || 1} un</b>
                                  </div>
                                  {itMaint.motivoManutencao && (
                                    <div className="disp-maint-motivo">
                                      Motivo: <span>{itMaint.motivoManutencao}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="disp-maint-actions">
                                  {itMaint.dataPrevisaoRetorno && (
                                    <div className="disp-maint-return-badge">
                                      🗓️ Pronta em: {formatarDataBR(itMaint.dataPrevisaoRetorno)}
                                    </div>
                                  )}
                                  {valCusto > 0 && (
                                    <div className="disp-maint-custo">
                                      Custo: <b>R$ {valCusto.toFixed(2).replace('.', ',')}</b>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {evConflito && (
                                <div className="disp-maint-conflict-alert">
                                  <div className="disp-conflict-title">
                                    🚨 ALERTA DE CONFLITO OPERACIONAL: MANUTENÇÃO X FESTA!
                                  </div>
                                  <div className="disp-conflict-text">
                                    Esta peça está reservada no pedido <b>#{evConflito.numPedido} ({evConflito.clienteNome})</b> para esta mesma data! Conclua o reparo antes da entrega ou substitua a peça no pedido!
                                  </div>
                                  <button
                                    type="button"
                                    className="disp-btn-sugerir-substituto"
                                    onClick={() => setPecaParaSubstituir({ item: itMaint, dataStr: diaDetalhes.dataStr, numPedido: evConflito.numPedido, clienteNome: evConflito.clienteNome })}
                                  >
                                    🔄 Sugerir Peça Substituta Livre
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {(!diaDetalhes.eventos || diaDetalhes.eventos.length === 0) && listaPecasEfetiva.filter(i => obterManutencaoNoDia(i, diaDetalhes.dataStr) > 0).length === 0 && (
                <div className="disp-submodal-empty">
                  <span className="disp-empty-emoji">🟢</span>
                  <div className="disp-empty-title">100% Livre para Locações!</div>
                  <p className="disp-empty-desc">
                    Nenhum pedido ou peça em manutenção agendada para este dia.
                  </p>
                </div>
              )}
            </div>

            <div className="disp-submodal-footer">
              <button
                type="button"
                className="btn-secondary-celebre"
                onClick={() => setDiaDetalhes(null)}
              >
                ✕ Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ MODAL LIGHTBOX DE FOTO AMPLIADA */}
      {fotoAmpliada && (
        <div className="disp-lightbox-overlay" onClick={() => setFotoAmpliada(null)}>
          <div className="disp-lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={fotoAmpliada} alt="Foto Ampliada do Acervo" className="disp-lightbox-img" />
            <button 
              className="disp-lightbox-btn-close"
              onClick={() => setFotoAmpliada(null)}
              title="Fechar visualização"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 🔄 MODAL DE SUGESTÃO DE PEÇA SUBSTITUTA LIVRE */}
      {pecaParaSubstituir && (
        <div className="disp-submodal-overlay" style={{ zIndex: 180000 }} onClick={() => setPecaParaSubstituir(null)}>
          <div className="disp-submodal-card" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="disp-submodal-header header-substituto">
              <div>
                <h4>🔄 Sugestão de Peças Substitutas</h4>
                <p>
                  Opções disponíveis da categoria <b>{pecaParaSubstituir.item.categoria || 'Geral'}</b> para o dia {formatarDataBR(pecaParaSubstituir.dataStr)}
                </p>
              </div>
              <button className="disp-btn-close-sub" onClick={() => setPecaParaSubstituir(null)}>✕</button>
            </div>

            <div className="disp-submodal-body">
              <div className="disp-substituto-origem-badge">
                Substituindo a peça em reparo: <b>{pecaParaSubstituir.item.nome}</b> {pecaParaSubstituir.numPedido ? `no Pedido #${pecaParaSubstituir.numPedido} (${pecaParaSubstituir.clienteNome})` : ''}
              </div>

              {(() => {
                const catTarget = pecaParaSubstituir.item.categoria || 'Geral';
                const dataTarget = pecaParaSubstituir.dataStr;

                const substitutosLivres = listaPecasEfetiva.filter(p => {
                  if (String(p.id) === String(pecaParaSubstituir.item.id)) return false;
                  const catP = p.categoria || 'Geral';
                  if (catP !== catTarget && catTarget !== 'Todas') return false;

                  const emMaint = obterManutencaoNoDia(p, dataTarget);
                  const qtdTotal = Math.max(1, Number(p.quantidade || 1));
                  const dispReal = Math.max(0, qtdTotal - emMaint);
                  const alugados = mapaOcupacao.porItem[p.id]?.[dataTarget]?.alugados || 0;
                  const livres = Math.max(0, dispReal - alugados);

                  return livres > 0;
                });

                if (substitutosLivres.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      <div style={{ fontSize: '32px' }}>⚠️</div>
                      <strong>Nenhuma outra peça desta mesma categoria possui unidades livres nesta data!</strong>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {substitutosLivres.map((sub, sIdx) => {
                      const emMaint = obterManutencaoNoDia(sub, dataTarget);
                      const qtdTotal = Math.max(1, Number(sub.quantidade || 1));
                      const dispReal = Math.max(0, qtdTotal - emMaint);
                      const alugados = mapaOcupacao.porItem[sub.id]?.[dataTarget]?.alugados || 0;
                      const livres = Math.max(0, dispReal - alugados);
                      const fotoSub = sub.foto || sub.imagem;

                      return (
                        <div key={sIdx} className="disp-substituto-item-card">
                          <div className="disp-substituto-item-left">
                            <div className="disp-substituto-thumb">
                              {fotoSub ? <img src={fotoSub} alt={sub.nome} /> : <span>📷</span>}
                            </div>
                            <div>
                              <strong className="disp-substituto-name">{sub.nome}</strong>
                              <span className="disp-substituto-meta">CÓD: {sub.codigo || 'S/N'} | Cat: {sub.categoria || 'Geral'}</span>
                            </div>
                          </div>

                          <div className="disp-substituto-item-right">
                            <span className="disp-badge-livre-tag">
                              🟢 {livres} un livre(s)
                            </span>
                            <button
                              type="button"
                              className="disp-btn-copy-sub"
                              onClick={() => {
                                navigator.clipboard.writeText(sub.nome);
                                alert(`✅ Nome da peça substituta "${sub.nome}" copiado! Agora basta editar o pedido e substituir.`);
                                setPecaParaSubstituir(null);
                              }}
                            >
                              📋 Copiar Nome
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="disp-submodal-footer">
              <button 
                type="button" 
                className="btn-secondary-celebre" 
                onClick={() => setPecaParaSubstituir(null)}
              >
                ✕ Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Disponibilidade;
