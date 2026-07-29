import React, { useState, useMemo } from 'react';
import './ModalCalendarioDisponibilidade.css';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const ModalCalendarioDisponibilidade = ({ isOpen, onClose, estoque = [], locacoes = [], onSelectPeca }) => {
  const [dataAtual, setDataAtual] = useState(new Date());
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [itemSelecionadoId, setItemSelecionadoId] = useState('todos'); // 'todos' ou ID do item específico
  const [modoVisao, setModoVisao] = useState('grid'); // 'grid' (Calendário Tradicional 7 dias) ou 'tabela' (Matriz)
  const [diaDetalhes, setDiaDetalhes] = useState(null); // Para modal/drawer de detalhes do dia
  const [fotoAmpliada, setFotoAmpliada] = useState(null); // Lightbox de fotos ampliadas
  const [apenasAlugados, setApenasAlugados] = useState(false); // Evidenciar dias com aluguel / esmaecer dias livres

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

          // Registrar por item
          itens.forEach(item => {
            const itemId = item.id || item.nome;
            const qtd = Math.max(1, Number(item.qtd || item.quantidade || 1));

            if (!mapa[itemId]) mapa[itemId] = {};
            if (!mapa[itemId][dataStr]) {
              mapa[itemId][dataStr] = { alugados: 0, reservas: [] };
            }
            mapa[itemId][dataStr].alugados += qtd;
            mapa[itemId][dataStr].reservas.push({
              locacaoId: loc.id,
              numPedido,
              clienteNome,
              qtd
            });
          });
        }
      });
    });

    return { porItem: mapa, porDiaGeral: mapaDiaGeral };
  }, [locacoes, diasDoMes]);

  // Filtro de peças do estoque por busca e categoria
  const estoqueFiltrado = useMemo(() => {
    return listaPecasEfetiva.filter(item => {
      const bateNome = (item.nome || '').toLowerCase().includes(busca.toLowerCase());
      const bateCat = categoria === 'Todas' || (item.categoria || 'Geral') === categoria;
      return bateNome && bateCat;
    });
  }, [listaPecasEfetiva, busca, categoria]);

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

  const hojeISO = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div className="modal-calendario-overlay" onClick={onClose}>
      <div className="modal-calendario-container" onClick={e => e.stopPropagation()}>
        
        {/* CABEÇALHO DOURADO LUXO */}
        <header className="calendario-header">
          <div>
            <h3>📅 Agenda e Calendário de Disponibilidade</h3>
            <p>Consulte em tempo real as ocupações do acervo e agendamentos</p>
          </div>
          <button className="btn-fechar-cal" onClick={onClose} title="Fechar">✕</button>
        </header>

        {/* BARRA DE NAVEGAÇÃO E SELEÇÃO DE VISÃO */}
        <div className="calendario-controles">
          <div className="seletor-mes-ano">
            <button className="btn-nav-mes" onClick={() => navegarMes(-1)}>◀</button>
            <span className="titulo-mes-atual">{MESES[mesIndex]} {ano}</span>
            <button className="btn-nav-mes" onClick={() => navegarMes(1)}>▶</button>
          </div>

          <div className="modo-visao-toggle">
            <button 
              className={`btn-toggle-modo ${modoVisao === 'grid' ? 'ativo' : ''}`}
              onClick={() => setModoVisao('grid')}
            >
              📅 Calendário Mensal
            </button>
            <button 
              className={`btn-toggle-modo ${modoVisao === 'tabela' ? 'ativo' : ''}`}
              onClick={() => setModoVisao('tabela')}
            >
              📊 Tabela de Estoque
            </button>
          </div>

          <div className="legendas-status">
            <button 
              className={`btn-toggle-apenas-alugados ${apenasAlugados ? 'ativo' : ''}`}
              onClick={() => setApenasAlugados(prev => !prev)}
              title="Ocultar/Esmaecer dias sem agendamentos para focar apenas nas datas ocupadas"
            >
              {apenasAlugados ? '✨ Destacando Apenas Ocupados' : '👁️ Evidenciar Dias Alugados'}
            </button>

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

        {/* 📊 PAINEL DE KPIS DO MÊS E GIRO RÁPIDO */}
        <div className="bar-kpi-mes">
          <div className="card-kpi-item">
            <span className="icon-kpi">🎉</span>
            <div>
              <div className="valor-kpi">{kpisMes.totalFestas} Festas</div>
              <div className="rotulo-kpi">Agendadas em {MESES[mesIndex]}</div>
            </div>
          </div>

          <div className="card-kpi-item">
            <span className="icon-kpi">📦</span>
            <div>
              <div className="valor-kpi">{kpisMes.totalPecasAlugadas} Peças</div>
              <div className="rotulo-kpi">Reservadas no acervo</div>
            </div>
          </div>

          <div className="card-kpi-item">
            <span className="icon-kpi">📈</span>
            <div>
              <div className="valor-kpi">{kpisMes.taxaOcupacao}% Ocupação</div>
              <div className="rotulo-kpi">{kpisMes.diasComEventoCount} de {kpisMes.totalDiasNoMes} dias ocupados</div>
            </div>
          </div>

          {kpisMes.alertasGiroRapido.length > 0 && (
            <div className="card-kpi-item kpi-alerta-giro" title="Aviso: Peças devolvidas e re-alugadas em menos de 24h!">
              <span className="icon-kpi">⚡</span>
              <div>
                <div className="valor-kpi" style={{ color: '#b45309' }}>{kpisMes.alertasGiroRapido.length} Giro(s) Rápido(s)</div>
                <div className="rotulo-kpi">Higienização Expressa (&lt;24h)</div>
              </div>
            </div>
          )}
        </div>

        {/* BARRA DE PESQUISA, CATEGORIA E SELEÇÃO DE ITEM */}
        <div className="filtros-estoque-cal">
          <div className="box-busca-cal">
            <input
              type="text"
              className="search-input-cal"
              placeholder="🔍 Procurar peça, cliente ou pedido..."
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

          <select
            className="select-cat-cal select-status-cal"
            value={itemSelecionadoId}
            onChange={e => setItemSelecionadoId(e.target.value)}
          >
            <option value="todos">✨ Visão Geral de Todos os Pedidos</option>
            <optgroup label="Filtrar por Peça Especifica">
              {estoqueFiltrado.map(i => (
                <option key={i.id} value={i.id}>📦 {i.nome} ({i.quantidade || 1} un)</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        <div className="tabela-disponibilidade-scroll">

          {/* VISÃO 1: CALENDÁRIO MENSAL TRADICIONAL (GRID 7 DIAS) */}
          {modoVisao === 'grid' && (
            <div className="container-grid-mensal">
              {/* CABEÇALHO DIAS DA SEMANA */}
              <div className="header-dias-semana">
                <div>DOM</div>
                <div>SEG</div>
                <div>TER</div>
                <div>QUA</div>
                <div>QUI</div>
                <div>SEX</div>
                <div>SÁB</div>
              </div>

              {/* GRADE DE 7 COLUNAS */}
              <div className="grid-calendario-7col">
                {grid7Dias.map(cel => {
                  if (cel.tipo === 'vazio') {
                    return <div key={cel.key} className="cell-dia-vazio"></div>;
                  }

                  const isHoje = cel.dataStr === hojeISO;
                  const todosEventosDoDia = mapaOcupacao.porDiaGeral[cel.dataStr] || [];
                  const termoBusca = busca.trim().toLowerCase();

                  // Filtrar eventos do dia pelo texto de busca (nome da peça, cliente ou numero do pedido)
                  const eventosDoDia = todosEventosDoDia.filter(ev => {
                    if (!termoBusca) return true;
                    const bateCliente = (ev.clienteNome || '').toLowerCase().includes(termoBusca);
                    const batePedido = (ev.numPedido || '').toLowerCase().includes(termoBusca);
                    const bateItens = (ev.itens || []).some(it => (it.nome || it.titulo || '').toLowerCase().includes(termoBusca));
                    return bateCliente || batePedido || bateItens;
                  });

                  const temEventos = eventosDoDia.length > 0;

                  const itemEspecifico = listaPecasEfetiva.find(i => String(i.id) === String(itemSelecionadoId));
                  const ocupacaoItem = itemEspecifico ? (mapaOcupacao.porItem[itemEspecifico.id]?.[cel.dataStr] || { alugados: 0, reservas: [] }) : null;
                  const qtdTotalItem = itemEspecifico ? Math.max(1, Number(itemEspecifico.quantidade || 1)) : 1;
                  const emManutencaoItem = itemEspecifico ? obterManutencaoNoDia(itemEspecifico, cel.dataStr) : 0;
                  const dispRealItem = Math.max(0, qtdTotalItem - emManutencaoItem);
                  const livresItem = itemEspecifico ? Math.max(0, dispRealItem - ocupacaoItem.alugados) : 0;

                  // Verificar se deve ficar esmaecido/transparente
                  const deveEsmaecer = (apenasAlugados || termoBusca !== '') && !temEventos && (!itemEspecifico || ocupacaoItem.alugados === 0);

                  return (
                    <div 
                      key={cel.key} 
                      className={`card-dia-mensal ${isHoje ? 'dia-hoje' : ''} ${temEventos ? 'dia-com-evento' : ''} ${deveEsmaecer ? 'dia-transparente' : 'dia-destacado'}`}
                      onClick={() => setDiaDetalhes({ dia: cel.dia, dataStr: cel.dataStr, eventos: eventosDoDia, ocupacaoItem, itemEspecifico })}
                    >
                      <div className="header-card-dia">
                        <span className={`numero-dia ${isHoje ? 'badge-hoje' : ''}`}>{cel.dia}</span>
                        {isHoje && <span className="lbl-hoje">HOJE</span>}
                        
                        {/* BADGE DISCRETA DE MANUTENÇÃO NO TOPO DO DIA */}
                        {!itemEspecifico && (() => {
                          const itensEmMaint = listaPecasEfetiva.filter(i => obterManutencaoNoDia(i, cel.dataStr) > 0);
                          if (itensEmMaint.length > 0) {
                            return (
                              <span 
                                title={`Peça(s) em reparo nesta data: ${itensEmMaint.map(i => i.nome).join(', ')}`} 
                                style={{ fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fca5a5', fontWeight: '800', marginLeft: 'auto' }}
                              >
                                🛠️ {itensEmMaint.length}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* EXIBIÇÃO QUANDO UMA PEÇA ESPECÍFICA ESTÁ SELECIONADA */}
                      {itemEspecifico ? (
                        <div className="info-peca-dia">
                          {emManutencaoItem >= qtdTotalItem ? (
                            <span className="tag-status-grid tag-esgotado" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                              🛠️ Reparo (0 un)
                            </span>
                          ) : ocupacaoItem.alugados === 0 && emManutencaoItem === 0 ? (
                            <span className="tag-status-grid tag-livre">🟢 {livresItem} un livre</span>
                          ) : livresItem > 0 ? (
                            <span className="tag-status-grid tag-parcial">
                              🟡 {livresItem} liv {emManutencaoItem > 0 ? `(🛠️${emManutencaoItem})` : ''}
                            </span>
                          ) : (
                            <span className="tag-status-grid tag-esgotado">
                              🔴 Esgotado {emManutencaoItem > 0 ? `(🛠️${emManutencaoItem} man)` : `(${qtdTotalItem} un)`}
                            </span>
                          )}

                          {ocupacaoItem.reservas.length > 0 && (
                            <div className="lista-reservas-min">
                              {ocupacaoItem.reservas.map((res, rIdx) => (
                                <div key={rIdx} className="pill-reserva-min" title={`Pedido #${res.numPedido} - ${res.clienteNome}`}>
                                  📌 #{res.numPedido || 'PED'} ({res.qtd}un)
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* VISÃO DE EVENTOS DO DIA (Geral) */
                        <div className="lista-eventos-dia">
                          {eventosDoDia.slice(0, 2).map((ev, eIdx) => (
                            <div key={eIdx} className={`pill-evento-grid ${ev.tipoServico?.includes('DECORA') ? 'pill-decora' : 'pill-loc'}`}>
                              <span className="dot-evento"></span>
                              <span className="txt-evento">{ev.clienteNome?.split(' ')[0] || ev.numPedido}</span>
                            </div>
                          ))}

                          {eventosDoDia.length > 2 && (
                            <div className="pill-mais-eventos">
                              + {eventosDoDia.length - 2} agendamentos
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VISÃO 2: TABELA DE MATRIZ DE PEÇAS */}
          {modoVisao === 'tabela' && (
            estoqueFiltrado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🕵️‍♀️</div>
                <strong>Nenhum item encontrado no acervo com esses filtros!</strong>
              </div>
            ) : (
              <table className="tabela-matriz-estoque">
                <thead>
                  <tr>
                    <th className="th-peca-col">PEÇA / PRODUTO (TOTAL)</th>
                    {diasDoMes.map(({ dia, dataStr }) => {
                      const isHoje = dataStr === hojeISO;
                      return (
                        <th key={dia} className={isHoje ? 'th-hoje' : ''}>
                          <div className="dia-num">{dia}</div>
                          <div className="dia-sigla">{new Date(dataStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase()}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {estoqueFiltrado.map(item => {
                    const qtdTotal = Math.max(1, Number(item.quantidade || 1));
                    const mapaItem = mapaOcupacao.porItem[item.id] || {};
                    const temManutencaoCadastrada = (item.qtdManutencao !== undefined && item.qtdManutencao > 0) || item.status === 'manutencao';

                    return (
                      <tr key={item.id} style={{ backgroundColor: temManutencaoCadastrada ? '#fff1f2' : undefined }}>
                        <td className="td-peca">
                          <div className="cell-info-peca">
                            {item.foto ? (
                              <img src={item.foto} alt={item.nome} className="thumb-peca-cal" />
                            ) : (
                              <div className="thumb-peca-cal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📷</div>
                            )}
                            <div>
                              <div className="nome-peca-cal" style={{ color: temManutencaoCadastrada ? '#b91c1c' : '#0f172a', fontWeight: '800' }}>
                                {item.nome}
                                {temManutencaoCadastrada && (
                                  <span style={{ marginLeft: '6px', fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5', fontWeight: '800' }}>
                                    🛠️ MANUTENÇÃO
                                  </span>
                                )}
                              </div>
                              <div className="qtd-total-cal">
                                Estoque Total: <b>{qtdTotal} un</b>
                                {item.dataPrevisaoRetorno && (
                                  <span style={{ color: '#0284c7', fontWeight: 'bold' }}> (Pronta em {formatarDataBR(item.dataPrevisaoRetorno)})</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {diasDoMes.map(({ dia, dataStr }) => {
                          const emManutencao = obterManutencaoNoDia(item, dataStr);
                          const dispReal = Math.max(0, qtdTotal - emManutencao);
                          const alugados = mapaItem[dataStr]?.alugados || 0;
                          const livres = Math.max(0, dispReal - alugados);

                          if (emManutencao >= qtdTotal) {
                            return (
                              <td key={dia}>
                                <span className="badge-dia-esgotado" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: '800' }} title={`Item em Manutenção até ${formatarDataBR(item.dataPrevisaoRetorno) || 'retorno'}`}>
                                  🛠️ Reparo
                                </span>
                              </td>
                            );
                          } else if (alugados === 0 && emManutencao === 0) {
                            return (
                              <td key={dia}>
                                <span className="badge-dia-livre" title={`${livres} de ${qtdTotal} unidades livres`}>
                                  {livres} un
                                </span>
                              </td>
                            );
                          } else if (livres > 0) {
                            return (
                              <td key={dia}>
                                <span className="badge-dia-parcial" style={{ background: emManutencao > 0 ? '#fffbeb' : undefined, borderColor: emManutencao > 0 ? '#fde68a' : undefined }} title={`${alugados} alugadas, ${emManutencao} em manutenção, ${livres} livres`}>
                                  {livres} liv.
                                </span>
                              </td>
                            );
                          } else {
                            return (
                              <td key={dia}>
                                <span className="badge-dia-esgotado" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }} title={`0 livres (${alugados} alugadas, ${emManutencao} em manutenção)`}>
                                  {emManutencao > 0 ? '🛠️ 0' : '🚫 0'}
                                </span>
                              </td>
                            );
                          }
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
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
                            <div>
                              <span className="submodal-pedido-tag">{ev.numPedido || 'PEDIDO'}</span>
                              <span className="submodal-cliente-nome">{ev.clienteNome}</span>
                            </div>
                            <span className={`pill-servico-sub ${ev.tipoServico?.includes('DECORA') ? 'pill-decora' : 'pill-loc'}`}>
                              {ev.tipoServico || 'LOCAÇÃO'}
                            </span>
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
                                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 12px', color: '#b91c1c', fontSize: '0.76rem' }}>
                                    <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      🚨 ALERTA DE CONFLITO OPERACIONAL: MANUTENÇÃO X FESTA!
                                    </div>
                                    <div style={{ marginTop: '2px', lineHeight: '1.3' }}>
                                      Esta peça está reservada no pedido <b>#{evConflito.numPedido} ({evConflito.clienteNome})</b> para esta mesma data! Conclua o reparo no acervo antes da entrega ou substitua a peça no pedido!
                                    </div>
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

      </div>
    </div>
  );
};

export default ModalCalendarioDisponibilidade;
