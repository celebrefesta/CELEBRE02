import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ModalCalendarioDisponibilidade.css';
import { db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { gerarMapaSeparacaoPDF } from '../../utils/gerarMapaSeparacaoPDF';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const ModalCalendarioDisponibilidade = ({ isOpen, onClose, estoque = [], locacoes = [], onSelectPeca }) => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const [dadosEmpresa, setDadosEmpresa] = useState(null);

  const [dataAtual, setDataAtual] = useState(new Date());
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [itemSelecionadoId, setItemSelecionadoId] = useState('todos'); // 'todos' ou ID do item específico
  const [modoVisao, setModoVisao] = useState('tabela'); // Default 'tabela' (Matriz de Estoque com linha por peça e dias 1-31)
  const [diaDetalhes, setDiaDetalhes] = useState(null); // Para modal/drawer de detalhes do dia
  const [fotoAmpliada, setFotoAmpliada] = useState(null); // Lightbox de fotos ampliadas
  const [apenasAlugados, setApenasAlugados] = useState(false); // Evidenciar dias com aluguel / esmaecer dias livres
  const [apenasManutencao, setApenasManutencao] = useState(false); // Filtrar somente peças em reforma
  const [pecaParaSubstituir, setPecaParaSubstituir] = useState(null); // Modal de sugestão de substitutos

  useEffect(() => {
    const carregarEmpresa = async () => {
      if (!tenantId) return;
      try {
        const empRef = doc(db, "configuracoes_empresa", tenantId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          setDadosEmpresa(empSnap.data());
        } else {
          const fallbackRef = doc(db, "configuracoes", tenantId);
          const fallbackSnap = await getDoc(fallbackRef);
          if (fallbackSnap.exists()) setDadosEmpresa(fallbackSnap.data());
        }
      } catch (err) {
        console.error("Erro ao carregar dados da empresa no Calendário:", err);
      }
    };
    if (isOpen) {
      carregarEmpresa();
    }
  }, [tenantId, isOpen]);

  const ano = dataAtual.getFullYear();
  const mesIndex = dataAtual.getMonth(); // 0-11

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

  // Função para calcular a quantidade em manutenção em um dia específico levando em conta a data de previsão de prontidão
  const obterManutencaoNoDia = (item, dataStr) => {
    const emManutencaoTotal = item.qtdManutencao !== undefined ? Number(item.qtdManutencao) : (item.status === 'manutencao' ? Number(item.quantidade || 1) : 0);
    if (emManutencaoTotal <= 0) return 0;

    // Se houver data de previsão de retorno / prontidão (ex: 2026-08-03)
    const dataFimRaw = item.dataPrevisaoRetorno || '';
    if (dataFimRaw) {
      const dataFimISO = formatarISO(dataFimRaw);
      if (dataFimISO && dataStr > dataFimISO) {
        // Após a data de previsão de prontidão, a peça já estará de volta ao estoque livre!
        return 0;
      }
    }

    // Se houver data de início da manutenção
    const dataInicioRaw = item.dataInicioManutencao || '';
    if (dataInicioRaw) {
      const dataInicioISO = formatarISO(dataInicioRaw);
      if (dataInicioISO && dataStr < dataInicioISO) {
        return 0;
      }
    }

    return emManutencaoTotal;
  };

  // Gerar todos os dias do mês selecionado
  const diasDoMes = useMemo(() => {
    const totalDias = new Date(ano, mesIndex + 1, 0).getDate();
    const dias = [];
    for (let i = 1; i <= totalDias; i++) {
      const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dias.push({ dia: i, dataStr });
    }
    return dias;
  }, [ano, mesIndex]);

  // Células da grade de 7 colunas (DOM, SEG, TER, QUA, QUI, SEX, SÁB)
  const grid7Dias = useMemo(() => {
    const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay(); // 0 (Dom) a 6 (Sáb)
    const totalDiasMes = new Date(ano, mesIndex + 1, 0).getDate();
    const celulas = [];

    // Espaços vazios do mês anterior
    for (let i = 0; i < primeiroDiaSemana; i++) {
      celulas.push({ tipo: 'vazio', key: `vazio-ant-${i}` });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      celulas.push({ tipo: 'dia', dia: d, dataStr, key: `dia-${d}` });
    }

    // Preencher restante da semana final
    const sobra = celulas.length % 7;
    if (sobra !== 0) {
      for (let i = 0; i < (7 - sobra); i++) {
        celulas.push({ tipo: 'vazio', key: `vazio-prox-${i}` });
      }
    }

    return celulas;
  }, [ano, mesIndex]);

  // Lista de peças efetiva (usa estoque ou extrai das locações ativas se estoque estiver vazio)
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

  // Mapeamento de ocupação: para cada dia e cada peça, quantas estão alugadas + detalhes da locação
  const mapaOcupacao = useMemo(() => {
    const mapa = {}; // { item_id: { 'YYYY-MM-DD': { alugados: 2, reservas: [...] } } }
    const mapaDiaGeral = {}; // { 'YYYY-MM-DD': [ { locacaoId, clienteNome, tema, itens: [...] } ] }

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
          // Registrar no mapa dia geral
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

          // Registrar por item (avulso + composição de decorações)
          itens.forEach(item => {
            const qtd = Math.max(1, Number(item.qtd || item.quantidade || 1));

            const registrarUso = (targetKey, qtdUso, nomePeca) => {
              if (!targetKey) return;

              // Encontrar ID oficial no estoque se existir
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

            // 1. Registrar o próprio item (seja avulso ou a decoração)
            registrarUso(item.id || item.nome, qtd, item.nome);

            // 2. Se for Decoração / Kit, registrar cada peça da sua composição multiplicada pela quantidade do kit
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
  }, [locacoes, diasDoMes]);

  // Filtro de peças do estoque por busca, categoria, peça específica selecionada e apenasManutencao
  const estoqueFiltrado = useMemo(() => {
    return listaPecasEfetiva.filter(item => {
      const bateNome = (item.nome || '').toLowerCase().includes(busca.toLowerCase());
      const bateCat = categoria === 'Todas' || (item.categoria || 'Geral') === categoria;
      const batePecaEspecifica = itemSelecionadoId === 'todos' || String(item.id) === String(itemSelecionadoId);
      
      if (apenasManutencao) {
        const emMaint = item.qtdManutencao !== undefined ? Number(item.qtdManutencao) : (item.status === 'manutencao' ? Number(item.quantidade || 1) : 0);
        if (emMaint <= 0) return false;
      }

      return bateNome && bateCat && batePecaEspecifica;
    });
  }, [listaPecasEfetiva, busca, categoria, itemSelecionadoId, apenasManutencao]);

  // CÁLCULO DE KPIS E ALERTAS DE GIRO RÁPIDO DO MÊS SELECIONADO
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

    // Detectar Giros Rápidos (<24-48h entre devolução e próxima retirada)
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
      const diaSemana = hoje.getDay(); // 0 Dom, 1 Seg, ..., 5 Sex, 6 Sáb
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

  if (!isOpen) return null;

  return (
    <div className="modal-calendario-overlay" onClick={onClose}>
      <div className="modal-calendario-container" onClick={e => e.stopPropagation()}>
        
        {/* CABEÇALHO DOURADO LUXO */}
        <header className="calendario-header">
          <div className="calendario-header-titles">
            <h3>📊 Matriz de Disponibilidade do Acervo</h3>
            <p>Consulte em tempo real o estoque disponível e reservas peça por peça dia a dia</p>
          </div>
          <div className="calendario-header-actions">
            <select
              className="btn-exportar-pdf-cal"
              onChange={(e) => {
                if (e.target.value) {
                  handleExportarPDFComFiltro(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #c5a059',
                background: 'linear-gradient(135deg, #c5a059 0%, #a37f3e 100%)',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)',
                outline: 'none'
              }}
              title="Exportar Mapa de Separação em PDF com filtro de período e caixas de seleção [  ]"
            >
              <option value="" disabled hidden>📄 Exportar Mapa PDF ▾</option>
              <option value="mes" style={{ background: '#0f172a', color: '#ffffff' }}>🗓️ Mês Inteiro (com Checkbox [  ])</option>
              <option value="3dias" style={{ background: '#0f172a', color: '#ffffff' }}>⚡ Expedição Imediata (Próximos 3 Dias)</option>
              <option value="fimdesemana" style={{ background: '#0f172a', color: '#ffffff' }}>🎈 Final de Semana (Sexta a Domingo)</option>
              <option value="apenas_reservados" style={{ background: '#0f172a', color: '#ffffff' }}>📦 Somente Peças com Reserva</option>
            </select>

            <button className="btn-fechar-cal" onClick={onClose} title="Fechar">✕</button>
          </div>
        </header>

        {/* 📊 PAINEL DE KPIS DO MÊS E GIRO RÁPIDO */}
        <div className="bar-kpi-mes">
          <div className="card-kpi-item">
            <div className="card-kpi-header">
              <span className="icon-kpi">🎉</span>
              <span className="valor-kpi">{kpisMes.totalFestas} Festas</span>
            </div>
            <div className="rotulo-kpi">Agendadas em {MESES[mesIndex]}</div>
          </div>

          <div className="card-kpi-item">
            <div className="card-kpi-header">
              <span className="icon-kpi">📦</span>
              <span className="valor-kpi">{kpisMes.totalPecasAlugadas} Peças</span>
            </div>
            <div className="rotulo-kpi">Reservadas no acervo</div>
          </div>

          <div className="card-kpi-item">
            <div className="card-kpi-header">
              <span className="icon-kpi">📈</span>
              <span className="valor-kpi">{kpisMes.taxaOcupacao}% Ocupação</span>
            </div>
            <div className="rotulo-kpi">{kpisMes.diasComEventoCount} de {kpisMes.totalDiasNoMes} dias</div>
          </div>

          {kpisMes.alertasGiroRapido.length > 0 && (
            <div className="card-kpi-item kpi-alerta-giro" title="Aviso: Peças devolvidas e re-alugadas em menos de 24h!">
              <div className="card-kpi-header">
                <span className="icon-kpi">⚡</span>
                <span className="valor-kpi" style={{ color: '#b45309' }}>{kpisMes.alertasGiroRapido.length} Giro(s) Rápido(s)</span>
              </div>
              <div className="rotulo-kpi">Higienização Expressa (&lt;24h)</div>
            </div>
          )}
        </div>

        {/* BARRA DE PESQUISA E CATEGORIA */}
        <div className="filtros-estoque-cal" style={{ gridTemplateColumns: '1fr auto' }}>
          <div className="box-busca-cal">
            <input
              type="text"
              className="search-input-cal"
              placeholder="🔍 Procurar peça por nome, código ou categoria..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {busca && (
              <button className="btn-limpar-busca" onClick={() => setBusca('')} title="Limpar busca">✕</button>
            )}
          </div>

          <select
            className="select-cat-cal"
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
          >
            {categorias.map(cat => (
              <option key={cat} value={cat}>{cat === 'Todas' ? 'Todas as Categorias' : cat}</option>
            ))}
          </select>
        </div>

        {/* BARRA DE NAVEGAÇÃO E LEGENDAS (PROXIMO DA TABELA) */}
        <div className="calendario-controles">
          <div className="seletor-mes-ano">
            <button className="btn-nav-mes" onClick={() => navegarMes(-1)}>◀</button>
            <span className="titulo-mes-atual">{MESES[mesIndex]} {ano}</span>
            <button className="btn-nav-mes" onClick={() => navegarMes(1)}>▶</button>
          </div>

          <div className="legendas-status">
            <div className="legendas-toggles">
              <button 
                type="button"
                className={`btn-toggle-apenas-alugados ${apenasAlugados ? 'ativo' : ''}`}
                onClick={() => setApenasAlugados(prev => !prev)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: apenasAlugados ? '1.5px solid #c5a059' : '1px solid #cbd5e1',
                  background: apenasAlugados ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : '#ffffff',
                  color: apenasAlugados ? '#fde68a' : '#475569',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: apenasAlugados ? '0 3px 10px rgba(15, 23, 42, 0.25)' : 'none',
                  transition: '0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Ocultar/Esmaecer dias sem agendamentos para focar apenas nas datas ocupadas"
              >
                {apenasAlugados ? '✨ Destacando Ocupados' : '👁️ Evidenciar Alugados'}
              </button>

              <button 
                type="button"
                className={`btn-toggle-apenas-manutencao ${apenasManutencao ? 'ativo' : ''}`}
                onClick={() => setApenasManutencao(prev => !prev)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: apenasManutencao ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  background: apenasManutencao ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' : '#ffffff',
                  color: apenasManutencao ? '#ffffff' : '#991b1b',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: apenasManutencao ? '0 3px 10px rgba(127, 29, 29, 0.25)' : 'none',
                  transition: '0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Filtrar matriz para exibir somente peças atualmente em manutenção/reforma"
              >
                {apenasManutencao ? '🛠️ Em Manutenção' : '🛠️ Peças em Reforma'}
              </button>
            </div>

            <div className="legendas-dots-group">
              <div className="legenda-item">
                <span className="dot-legenda dot-livre"></span>
                <span>Livre</span>
              </div>
              <div className="legenda-item">
                <span className="dot-legenda dot-parcial"></span>
                <span>Parcial</span>
              </div>
              <div className="legenda-item">
                <span className="dot-legenda dot-esgotado"></span>
                <span>Esgotado</span>
              </div>
            </div>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO PRINCIPAL: TIMELINE LINHA DO TEMPO (GANTT) DE DISPONIBILIDADE */}
        <div className="tabela-disponibilidade-scroll" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {estoqueFiltrado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🕵️‍♀️</div>
              <strong>Nenhum item encontrado no acervo com esses filtros!</strong>
            </div>
          ) : (
            estoqueFiltrado.map(item => {
              const qtdTotal = Math.max(1, Number(item.quantidade || 1));
              const mapaItem = mapaOcupacao.porItem[item.id] || {};
              const isDeco = (item.categoria || '').toLowerCase().includes('decora') || item.itensDecoracao || item.pecasKit || item.itensDoKit;

              // Coletar todas as reservas e dias com ocupação no mês para esta peça
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
                <div key={item.id} className="card-timeline-item" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)', transition: '0.2s' }}>
                  
                  {/* CABEÇALHO DA PEÇA */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div 
                        style={{ width: '46px', height: '46px', borderRadius: '12px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #cbd5e1', cursor: item.foto ? 'pointer' : 'default' }}
                        onClick={() => item.foto && setFotoAmpliada(item.foto)}
                      >
                        {item.foto ? <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '20px' }}>📷</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.98rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{item.nome}</span>
                          {isDeco && (
                            <span style={{ background: '#0f172a', color: '#fde68a', border: '1px solid #c5a059', padding: '2px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              ✨ DECORAÇÃO COMPLETA
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          Categoria: <b style={{ color: '#334155' }}>{item.categoria || 'Geral'}</b> | Estoque Total Físico: <b style={{ color: '#0f172a' }}>{qtdTotal} un</b>
                          {item.dataPrevisaoRetorno && (
                            <span style={{ color: '#0284c7', fontWeight: 'bold' }}> (🛠️ Retorno em {formatarDataBR(item.dataPrevisaoRetorno)})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STATUS DE OCUPAÇÃO NO MÊS */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontSize: '0.76rem', 
                        fontWeight: '800', 
                        color: totalDiasAlugadosNoMes > 0 ? '#b45309' : '#15803d', 
                        background: totalDiasAlugadosNoMes > 0 ? '#fef3c7' : '#dcfce7', 
                        padding: '4px 12px', 
                        borderRadius: '20px', 
                        border: totalDiasAlugadosNoMes > 0 ? '1px solid #fde68a' : '1px solid #86efac',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {totalDiasAlugadosNoMes > 0 ? `⚡ ${totalDiasAlugadosNoMes} dia(s) com reservas` : `🟢 100% Livre em ${MESES[mesIndex]}`}
                      </span>
                    </div>
                  </div>

                  {/* BARRA LINHA DO TEMPO DIVIDIDA EM 2 LINHAS (QUINZENAS) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* 1ª QUINZENA (DIAS 1 A 15) */}
                    <div>
                      <div className="quinzena-header-lbl">
                        <span>🗓️ 1ª Quinzena (1 a 15 de {MESES[mesIndex]})</span>
                      </div>
                      <div className="quinzena-grid-container">
                        {diasDoMes.slice(0, 15).map(({ dia, dataStr }) => {
                          const isHoje = dataStr === hojeISO;
                          const emManutencao = obterManutencaoNoDia(item, dataStr);
                          const dispReal = Math.max(0, qtdTotal - emManutencao);
                          const alugados = mapaItem[dataStr]?.alugados || 0;
                          const livres = Math.max(0, dispReal - alugados);
                          const reservas = mapaItem[dataStr]?.reservas || [];

                          let bgCell = '#ffffff';
                          let borderCell = '1px solid #e2e8f0';
                          let colorText = '#475569';
                          let badgeIcon = `${livres}`;

                          if (emManutencao >= qtdTotal) {
                            bgCell = '#fef2f2';
                            borderCell = '1px solid #fca5a5';
                            colorText = '#dc2626';
                            badgeIcon = '🛠️';
                          } else if (alugados > 0 && livres === 0) {
                            bgCell = '#fef2f2';
                            borderCell = '1px solid #fecaca';
                            colorText = '#b91c1c';
                            badgeIcon = '🔴 0';
                          } else if (alugados > 0) {
                            bgCell = '#fef3c7';
                            borderCell = '1.5px solid #f59e0b';
                            colorText = '#b45309';
                            badgeIcon = `🟡 ${livres}`;
                          } else {
                            bgCell = '#f0fdf4';
                            borderCell = '1px solid #bbf7d0';
                            colorText = '#16a34a';
                            badgeIcon = `🟢 ${livres}`;
                          }

                          return (
                            <div 
                              key={dia}
                              className="cell-dia-quinzena"
                              onClick={() => setDiaDetalhes({ dia, dataStr, eventos: mapaOcupacao.porDiaGeral[dataStr] || [], ocupacaoItem: mapaItem[dataStr] || { alugados: 0, reservas: [] }, itemEspecifico: item })}
                              style={{
                                background: bgCell,
                                border: borderCell,
                                opacity: apenasAlugados && alugados === 0 && emManutencao === 0 ? 0.25 : 1,
                                boxShadow: alugados > 0 ? '0 2px 6px rgba(245, 158, 11, 0.2)' : 'none'
                              }}
                              title={`Dia ${dia} (${dataStr}) - ${livres} un livres de ${qtdTotal} ${reservas.length > 0 ? `| ${reservas.map(r => `#${r.numPedido} - ${r.clienteNome}`).join(', ')}` : ''}`}
                            >
                              <span className="num-dia-quinzena" style={{ color: isHoje ? '#2563eb' : '#94a3b8' }}>
                                {dia}{isHoje ? '•' : ''}
                              </span>
                              <span className="badge-status-quinzena" style={{ color: colorText }}>
                                {badgeIcon}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2ª QUINZENA (DIAS 16 AO FIM DO MÊS) */}
                    <div>
                      <div className="quinzena-header-lbl">
                        <span>🗓️ 2ª Quinzena (16 a {diasDoMes.length} de {MESES[mesIndex]})</span>
                      </div>
                      <div className="quinzena-grid-container">
                        {diasDoMes.slice(15).map(({ dia, dataStr }) => {
                          const isHoje = dataStr === hojeISO;
                          const emManutencao = obterManutencaoNoDia(item, dataStr);
                          const dispReal = Math.max(0, qtdTotal - emManutencao);
                          const alugados = mapaItem[dataStr]?.alugados || 0;
                          const livres = Math.max(0, dispReal - alugados);
                          const reservas = mapaItem[dataStr]?.reservas || [];

                          let bgCell = '#ffffff';
                          let borderCell = '1px solid #e2e8f0';
                          let colorText = '#475569';
                          let badgeIcon = `${livres}`;

                          if (emManutencao >= qtdTotal) {
                            bgCell = '#fef2f2';
                            borderCell = '1px solid #fca5a5';
                            colorText = '#dc2626';
                            badgeIcon = '🛠️';
                          } else if (alugados > 0 && livres === 0) {
                            bgCell = '#fef2f2';
                            borderCell = '1px solid #fecaca';
                            colorText = '#b91c1c';
                            badgeIcon = '🔴 0';
                          } else if (alugados > 0) {
                            bgCell = '#fef3c7';
                            borderCell = '1.5px solid #f59e0b';
                            colorText = '#b45309';
                            badgeIcon = `🟡 ${livres}`;
                          } else {
                            bgCell = '#f0fdf4';
                            borderCell = '1px solid #bbf7d0';
                            colorText = '#16a34a';
                            badgeIcon = `🟢 ${livres}`;
                          }

                          return (
                            <div 
                              key={dia}
                              className="cell-dia-quinzena"
                              onClick={() => setDiaDetalhes({ dia, dataStr, eventos: mapaOcupacao.porDiaGeral[dataStr] || [], ocupacaoItem: mapaItem[dataStr] || { alugados: 0, reservas: [] }, itemEspecifico: item })}
                              style={{
                                background: bgCell,
                                border: borderCell,
                                opacity: apenasAlugados && alugados === 0 && emManutencao === 0 ? 0.25 : 1,
                                boxShadow: alugados > 0 ? '0 2px 6px rgba(245, 158, 11, 0.2)' : 'none'
                              }}
                              title={`Dia ${dia} (${dataStr}) - ${livres} un livres de ${qtdTotal} ${reservas.length > 0 ? `| ${reservas.map(r => `#${r.numPedido} - ${r.clienteNome}`).join(', ')}` : ''}`}
                            >
                              <span className="num-dia-quinzena" style={{ color: isHoje ? '#2563eb' : '#94a3b8' }}>
                                {dia}{isHoje ? '•' : ''}
                              </span>
                              <span className="badge-status-quinzena" style={{ color: colorText }}>
                                {badgeIcon}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* SEÇÃO DE RESERVAS DO MÊS COM FILTRO / DROPDOWN COMPACTO POR CLIENTE */}
                  {reservasNoMes.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📌 RESERVAS ({reservasNoMes.length}):
                      </span>

                      <select
                        style={{
                          padding: '5px 12px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          background: '#0f172a',
                          color: '#fde68a',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          maxWidth: '100%',
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)'
                        }}
                        defaultValue=""
                        onChange={e => {
                          const val = e.target.value;
                          if (val) {
                            const resEncontrada = reservasNoMes.find(r => String(r.locacaoId) === String(val));
                            if (resEncontrada) {
                              const diaEncontrado = diasDoMes.find(({ dataStr }) => {
                                const ocup = mapaItem[dataStr];
                                return ocup && (ocup.reservas || []).some(r => String(r.locacaoId) === String(val));
                              });

                              setDiaDetalhes({ 
                                dia: diaEncontrado ? diaEncontrado.dia : 1, 
                                dataStr: diaEncontrado ? diaEncontrado.dataStr : hojeISO, 
                                eventos: mapaOcupacao.porDiaGeral[diaEncontrado ? diaEncontrado.dataStr : hojeISO] || [], 
                                ocupacaoItem: mapaItem[diaEncontrado ? diaEncontrado.dataStr : hojeISO] || { alugados: 0, reservas: [] }, 
                                itemEspecifico: item 
                              });
                            }
                          }
                        }}
                      >
                        <option value="">✨ Ver clientes e pedidos ({reservasNoMes.length})</option>
                        {reservasNoMes.map((res, rIdx) => (
                          <option key={rIdx} value={res.locacaoId}>
                            👤 #{res.numPedido || 'PED'} - {res.clienteNome} ({res.qtd} un) {res.viaDecoracao ? `[Kit: ${res.viaDecoracao}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* MODAL DE DETALHES DO DIA SELECIONADO COM FOTOS DE PRÉVIA */}
        {diaDetalhes && (
          <div className="submodal-overlay" onClick={() => setDiaDetalhes(null)}>
            <div className="submodal-card" onClick={e => e.stopPropagation()}>
              <div className="submodal-header">
                <div>
                  <h4>📅 Detalhes do Dia {diaDetalhes.dia}/{mesIndex + 1}/{ano}</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>
                    Agendamentos e ocupações do acervo nesta data
                  </p>
                </div>
                <button className="btn-fechar-sub" onClick={() => setDiaDetalhes(null)}>✕</button>
              </div>
              
              <div className="submodal-body">
                {/* SEÇÃO 1: PEDIDOS E EVENTOS DE LOCAÇÃO */}
                {diaDetalhes.eventos && diaDetalhes.eventos.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: '800' }}>
                      📋 Locações / Decorações Marcadas ({diaDetalhes.eventos.length}):
                    </h5>

                    {diaDetalhes.eventos.map((ev, idx) => {
                      const alertaGiroDoEvento = kpisMes.alertasGiroRapido.find(a => 
                        a.devolucaoLoc.id === ev.locacaoId || a.retiradaLoc.id === ev.locacaoId
                      );

                      return (
                        <div key={idx} className="submodal-item-reserva">
                          
                          {/* CABEÇALHO DO PEDIDO */}
                          <div className="submodal-reserva-top">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span className="submodal-pedido-tag">#{ev.numPedido || 'PEDIDO'}</span>
                              <span className="submodal-cliente-nome">{ev.clienteNome}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`pill-servico-sub ${ev.tipoServico?.includes('DECORA') ? 'pill-decora' : 'pill-loc'}`}>
                                {ev.tipoServico || 'LOCAÇÃO'}
                              </span>
                              {ev.locacaoId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    setDiaDetalhes(null);
                                    navigate(`/locacoes/editar/${ev.locacaoId}`);
                                  }}
                                  style={{
                                    background: '#0f172a',
                                    color: '#fde68a',
                                    border: '1px solid #334155',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)'
                                  }}
                                  title="Abrir página de edição do pedido"
                                >
                                  🔗 Abrir Pedido ➔
                                </button>
                              )}
                            </div>
                          </div>

                          {/* STATUS E DATAS DE RETIRADA / DEVOLUÇÃO */}
                          <div className="submodal-datas-bar">
                            <span>Status: <b style={{ textTransform: 'uppercase', color: '#0f172a' }}>{ev.status || 'CONFIRMADO'}</b></span>
                            {ev.dataRetirada && (
                              <span className="submodal-periodo-lbl">
                                🗓️ <b>{formatarDataBR(ev.dataRetirada)}</b> {ev.dataDevolucao && ev.dataDevolucao !== ev.dataRetirada ? `até ${formatarDataBR(ev.dataDevolucao)}` : '(Dia único)'}
                              </span>
                            )}
                          </div>

                          {/* ALERTA DE GIRO RÁPIDO / HIGIENIZAÇÃO EXPRESSA (< 24H) */}
                          {alertaGiroDoEvento && (
                            <div className="box-alerta-giro-express">
                              <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ⚡ ALERTA DE HIGIENIZAÇÃO EXPRESSA (&lt;24h)
                              </div>
                              <div style={{ fontSize: '0.74rem', marginTop: '2px', lineHeight: '1.3' }}>
                                Esta locação tem devolução/saída agendada no mesmo dia ou com apenas 1 dia de diferença referente ao pedido <b>#{alertaGiroDoEvento.devolucaoLoc?.numeroPedido || alertaGiroDoEvento.retiradaLoc?.numeroPedido}</b>. Higienize as peças imediatamente!
                              </div>
                            </div>
                          )}

                        {/* FOTO DA DECORAÇÃO / PROJETO (SE HOUVER) */}
                        {ev.fotoTema && (
                          <div className="box-foto-decoracao-preview" onClick={() => setFotoAmpliada(ev.fotoTema)}>
                            <img src={ev.fotoTema} alt={ev.temaFesta || 'Decoração'} className="img-decoracao-preview" />
                            <div className="overlay-foto-hover">🔍 Clique para ampliar decoração ({ev.temaFesta || 'Projeto'})</div>
                          </div>
                        )}

                        {/* LISTA DE ITENS COM THUMBNAILS DE FOTO */}
                        <div className="submodal-itens-secao">
                          <div className="submodal-itens-titulo">📦 Itens Solicitados neste Pedido:</div>
                          <div className="submodal-itens-grid">
                            {(ev.itens || []).map((it, iIdx) => {
                              const pecaEstoque = listaPecasEfetiva.find(p => String(p.id) === String(it.id) || (p.nome || '').toLowerCase() === (it.nome || it.titulo || '').toLowerCase());
                              const fotoUrl = it.foto || it.imagem || it.url || pecaEstoque?.foto;
                              const estaEmManutencaoNoDia = pecaEstoque ? obterManutencaoNoDia(pecaEstoque, diaDetalhes.dataStr) > 0 : false;

                              return (
                                <div key={iIdx} className="card-item-submodal" style={{ border: estaEmManutencaoNoDia ? '1px solid #fca5a5' : undefined, background: estaEmManutencaoNoDia ? '#fff1f2' : undefined }}>
                                  <div 
                                    className="thumb-item-submodal"
                                    onClick={() => fotoUrl && setFotoAmpliada(fotoUrl)}
                                    style={{ cursor: fotoUrl ? 'pointer' : 'default' }}
                                    title={fotoUrl ? 'Clique para ampliar foto' : 'Sem foto'}
                                  >
                                    {fotoUrl ? (
                                      <img src={fotoUrl} alt={it.nome || it.titulo} />
                                    ) : (
                                      <span>📷</span>
                                    )}
                                  </div>
                                  <div className="info-item-submodal">
                                    <div className="nome-item-submodal" style={{ color: estaEmManutencaoNoDia ? '#b91c1c' : '#0f172a' }}>
                                      {it.nome || it.titulo || 'Peça Decorativa'}
                                      {estaEmManutencaoNoDia && (
                                        <span style={{ marginLeft: '6px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '800' }}>
                                          ⚠️ EM REPARO!
                                        </span>
                                      )}
                                    </div>
                                    <div className="qtd-item-submodal">Qtd: <b>{it.qtd || it.quantidade || 1} un</b></div>
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

                {/* SEÇÃO 2: PEÇAS EM MANUTENÇÃO / REPARO NESTA DATA */}
                {(() => {
                  const itensEmManutencaoNoDia = listaPecasEfetiva.filter(i => obterManutencaoNoDia(i, diaDetalhes.dataStr) > 0);
                  if (itensEmManutencaoNoDia.length > 0) {
                    return (
                      <div style={{ marginTop: '14px' }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#b91c1c', fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🛠️ Peça(s) em Manutenção / Reparo nesta Data ({itensEmManutencaoNoDia.length}):
                        </h5>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {itensEmManutencaoNoDia.map((itMaint, mIdx) => {
                            const fotoUrl = itMaint.foto || itMaint.imagem || '';
                            const valCusto = Number(itMaint.custoManutencao || 0);

                            // Verificar se esta peça em manutenção está ALUGADA em algum pedido nesta mesma data
                            const evConflito = (diaDetalhes.eventos || []).find(ev => 
                              (ev.itens || []).some(it => 
                                String(it.id) === String(itMaint.id) || 
                                (it.nome || it.titulo || '').toLowerCase() === (itMaint.nome || '').toLowerCase()
                              )
                            );

                            return (
                              <div key={mIdx} style={{ background: evConflito ? '#fef2f2' : '#fffbeb', border: `1.5px solid ${evConflito ? '#ef4444' : '#fde68a'}`, borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div 
                                    style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', background: '#fee2e2', flexShrink: 0, cursor: fotoUrl ? 'pointer' : 'default' }}
                                    onClick={() => fotoUrl && setFotoAmpliada(fotoUrl)}
                                  >
                                    {fotoUrl ? (
                                      <img src={fotoUrl} alt={itMaint.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#991b1b' }}>🛠️</div>
                                    )}
                                  </div>

                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '800', color: '#991b1b', fontSize: '0.92rem' }}>{itMaint.nome}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#7f1d1d', marginTop: '2px' }}>
                                      CÓD: <b>{itMaint.codigo || 'S/N'}</b> | Indisponível: <b>{itMaint.qtdManutencao || 1} un</b>
                                    </div>
                                    {itMaint.motivoManutencao && (
                                      <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '3px', fontWeight: '600' }}>
                                        Motivo: <span>{itMaint.motivoManutencao}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ textAlign: 'right' }}>
                                    {itMaint.dataPrevisaoRetorno && (
                                      <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '800', background: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                                        🗓️ Pronta em: {formatarDataBR(itMaint.dataPrevisaoRetorno)}
                                      </div>
                                    )}
                                    {valCusto > 0 && (
                                      <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                                        Custo: <b>R$ {valCusto.toFixed(2).replace('.', ',')}</b>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* ALERTA DE CONFLITO OPERACIONAL: REPARO X FESTA */}
                                {evConflito && (
                                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 12px', color: '#b91c1c', fontSize: '0.76rem' }}>
                                    <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      🚨 ALERTA DE CONFLITO OPERACIONAL: MANUTENÇÃO X FESTA!
                                    </div>
                                    <div style={{ marginTop: '2px', lineHeight: '1.3' }}>
                                      Esta peça está reservada no pedido <b>#{evConflito.numPedido} ({evConflito.clienteNome})</b> para esta mesma data! Conclua o reparo no acervo antes da entrega ou substitua a peça no pedido!
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setPecaParaSubstituir({ item: itMaint, dataStr: diaDetalhes.dataStr, numPedido: evConflito.numPedido, clienteNome: evConflito.clienteNome })}
                                      style={{ marginTop: '8px', background: '#991b1b', color: '#ffffff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(153, 27, 27, 0.3)' }}
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

                {/* MENSAGEM SE NÃO HOUVER NEM EVENTOS NEM MANUTENÇÃO */}
                {(!diaDetalhes.eventos || diaDetalhes.eventos.length === 0) && listaPecasEfetiva.filter(i => obterManutencaoNoDia(i, diaDetalhes.dataStr) > 0).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 10px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🟢</div>
                    <div style={{ fontWeight: '800', fontSize: '1rem', color: '#0f172a' }}>100% Livre para Locações!</div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                      Nenhum pedido ou peça em manutenção agendada para este dia.
                    </p>
                  </div>
                )}
              </div>

              {/* RODAPÉ DO SUBMODAL */}
              <div className="submodal-footer" style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setDiaDetalhes(null)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2)'
                  }}
                >
                  ✕ Fechar Detalhes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL LIGHTBOX DE FOTO AMPLIADA */}
        {fotoAmpliada && (
          <div className="submodal-overlay" style={{ zIndex: 200000 }} onClick={() => setFotoAmpliada(null)}>
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
              <img 
                src={fotoAmpliada} 
                alt="Foto Ampliada" 
                style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', objectFit: 'contain' }} 
              />
              <button 
                onClick={() => setFotoAmpliada(null)}
                style={{
                  position: 'absolute', top: '-15px', right: '-15px', background: '#ef4444', color: '#fff',
                  border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px',
                  fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* MODAL DE SUGESTÃO DE PEÇA SUBSTITUTA LIVRE */}
        {pecaParaSubstituir && (
          <div className="submodal-overlay" style={{ zIndex: 180000 }} onClick={() => setPecaParaSubstituir(null)}>
            <div className="submodal-card" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
              <div className="submodal-header" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderBottom: '2px solid #818cf8' }}>
                <div>
                  <h4>🔄 Sugestão de Peças Substitutas</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#c7d2fe' }}>
                    Opções disponíveis da categoria <b>{pecaParaSubstituir.item.categoria || 'Geral'}</b> para o dia {formatarDataBR(pecaParaSubstituir.dataStr)}
                  </p>
                </div>
                <button className="btn-fechar-sub" onClick={() => setPecaParaSubstituir(null)}>✕</button>
              </div>

              <div className="submodal-body">
                <div style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', color: '#3730a3', marginBottom: '14px', fontWeight: '700' }}>
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
                          <div key={sIdx} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                {fotoSub ? <img src={fotoSub} alt={sub.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>📷</span>}
                              </div>
                              <div>
                                <strong style={{ color: '#0f172a', fontSize: '0.92rem', display: 'block' }}>{sub.nome}</strong>
                                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>CÓD: {sub.codigo || 'S/N'} | Categoria: {sub.categoria || 'Geral'}</span>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', display: 'inline-block', marginBottom: '4px' }}>
                                🟢 {livres} un livre(s)
                              </span>
                              <br />
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(sub.nome);
                                  alert(`✅ Nome da peça substituta "${sub.nome}" copiado! Agora basta editar o pedido e substituir.`);
                                  setPecaParaSubstituir(null);
                                }}
                                style={{ background: '#4338ca', color: '#ffffff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer' }}
                              >
                                📋 Copiar Nome Substituta
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="submodal-footer" style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                <button type="button" onClick={() => setPecaParaSubstituir(null)} style={{ padding: '6px 16px', borderRadius: '16px', border: '1px solid #cbd5e1', background: '#334155', color: '#fff', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}>
                  ✕ Fechar Sugestões
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ModalCalendarioDisponibilidade;
