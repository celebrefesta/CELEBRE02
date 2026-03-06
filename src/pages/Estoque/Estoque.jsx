import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Estoque.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';

const Estoque = () => {
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [locacoes, setLocacoes] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // OS 4 ESTADOS DE FILTRO
  const [busca, setBusca] = useState('');
  const [dataFiltro, setDataFiltro] = useState(''); 
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');

  const [imagemAmpliada, setImagemAmpliada] = useState(null);
  const [modalManutencao, setModalManutencao] = useState(false);
  const [itemParaManutencao, setItemParaManutencao] = useState(null);
  const [qtdMaint, setQtdMaint] = useState(1);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const qEstoque = query(collection(db, "estoque"), orderBy("criadoEm", "desc"));
      const snapEstoque = await getDocs(qEstoque);
      const listaEstoque = snapEstoque.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const qLocacoes = query(collection(db, "locacoes"));
      const snapLocacoes = await getDocs(qLocacoes);
      const listaLocacoes = snapLocacoes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setItens(listaEstoque);
      setLocacoes(listaLocacoes);
    } catch (error) { 
        console.error(error); 
    } finally { 
        setLoading(false); 
    }
  };

  const irParaCadastro = (item = null) => {
    if (item) {
      navigate('/cadastro-estoque', { state: { itemEditando: item } });
    } else {
      navigate('/cadastro-estoque');
    }
  };

  const abrirModalManutencao = (item) => {
    setItemParaManutencao(item);
    const qtdAtual = item.qtdManutencao !== undefined ? item.qtdManutencao : (item.status === 'manutencao' ? item.quantidade : 0);
    setQtdMaint(qtdAtual === 0 ? 1 : qtdAtual);
    setModalManutencao(true);
  };

  const salvarManutencao = async () => {
    if (!itemParaManutencao) return;
    const valor = parseInt(qtdMaint);
    if (isNaN(valor) || valor < 0 || valor > itemParaManutencao.quantidade) {
      alert("Quantidade inválida! Verifique o total do item.");
      return;
    }
    try {
      await updateDoc(doc(db, "estoque", itemParaManutencao.id), {
        qtdManutencao: valor,
        status: valor === itemParaManutencao.quantidade ? 'manutencao' : 'ok'
      });
      setModalManutencao(false);
      carregarDados();
    } catch (error) {
      alert("Erro ao atualizar a manutenção.");
    }
  };

  const limparFiltroData = () => setDataFiltro('');

  const calcularDisponibilidadeNaData = (item) => {
      let qtdDisponivel = Number(item.quantidade) || 0;
      const emMaint = item.qtdManutencao !== undefined ? item.qtdManutencao : (item.status === 'manutencao' ? item.quantidade : 0);
      qtdDisponivel -= emMaint;
      let alugadosNaData = 0;

      if (dataFiltro) {
          const pedidosNessaData = locacoes.filter(loc => 
              loc.dataRetirada === dataFiltro && 
              loc.status !== 'cancelado' && 
              loc.status !== 'devolvido'
          );

          pedidosNessaData.forEach(pedido => {
              if (pedido.itens && Array.isArray(pedido.itens)) {
                  const itemEncontrado = pedido.itens.find(i => i.id === item.id);
                  if (itemEncontrado) {
                      alugadosNaData += Number(itemEncontrado.qtd || 1);
                  }
              }
          });
          qtdDisponivel -= alugadosNaData;
      }

      return { 
          disponivelTotal: qtdDisponivel, 
          alugados: alugadosNaData, 
          emManutencao: emMaint, 
          estaTotalmenteAlugado: dataFiltro && qtdDisponivel <= 0 
      };
  };

  const categoriasUnicas = Array.from(new Set(itens.map(i => i.categoria).filter(Boolean))).sort();

  const totalItens = itens.length;
  const valorAcervo = itens.reduce((acc, i) => acc + ((i.financeiro?.valorReposicao || i.financeiro?.valorCompra || 0) * i.quantidade), 0);
  const emManutencaoTotal = itens.reduce((acc, i) => acc + (i.qtdManutencao !== undefined ? i.qtdManutencao : (i.status === 'manutencao' ? i.quantidade : 0)), 0);
  const visiveis = itens.filter(i => i.configuracao?.visivelCatalogo !== false).length;
  const percentualVisivel = totalItens > 0 ? Math.round((visiveis / totalItens) * 100) : 0;

  // 🔥 MÁGICA DOS 4 FILTROS COMBINADOS CORRIGIDA 🔥
  const itensFiltrados = itens
    .filter(i => {
        const termo = busca.toLowerCase();
        return i.nome?.toLowerCase().includes(termo) || i.codigo?.toLowerCase().includes(termo);
    })
    .filter(i => {
        if (!categoriaFiltro) return true;
        return i.categoria === categoriaFiltro;
    })
    .filter(i => {
        const { disponivelTotal, emManutencao } = calcularDisponibilidadeNaData(i);

        // 1. DISPONÍVEL: Tem que ter saldo maior que zero
        if (statusFiltro === 'disponivel') return disponivelTotal > 0;
        
        // 2. MANUTENÇÃO: Basta ter 1 peça quebrada (mesmo que tenha outras livres)
        if (statusFiltro === 'manutencao') return emManutencao > 0;
        
        // 3. INDISPONÍVEL/ESGOTADO: O saldo livre é exatamente ZERO (por quebra ou aluguel)
        if (statusFiltro === 'indisponivel') return disponivelTotal <= 0;

        // REGRA DE OURO: Escolheu data e não mexeu no status? Mostra só o que dá pra alugar!
        if (!statusFiltro && dataFiltro) {
            return disponivelTotal > 0; 
        }

        return true;
    });

  return (
    <div className="estoque-premium">
      <div className="header-top">
        <div className="titulo-bloco">
          <h1>Gestão de Acervo e Estoque</h1>
          <p>Controle logístico, financeiro e catálogo online.</p>
        </div>
        <div className="acoes-top">
          <button className="btn-dark-blue" onClick={() => irParaCadastro()}>+ Novo Item</button>
        </div>
      </div>

      <div className="stats-row">
        <div className="card-stat"><span className="label-stat">TOTAL DE ITENS</span><div className="value-stat">{totalItens}</div><div className="icon-stat">📦</div></div>
        <div className="card-stat"><span className="label-stat">VALOR DO ACERVO</span><div className="value-stat text-accent">R$ {valorAcervo.toLocaleString('pt-BR')}</div><div className="icon-stat">📊</div></div>
        <div className="card-stat"><span className="label-stat">EM MANUTENÇÃO</span><div className="value-stat text-orange">{emManutencaoTotal}</div><div className="icon-stat">🛠️</div></div>
        <div className="card-stat"><span className="label-stat">VISÍVEL NO CATÁLOGO</span><div className="value-stat text-green">{percentualVisivel}%</div><div className="icon-stat">👁️</div></div>
      </div>

      <div className="filtros-inteligentes-container">
          <div className="filtro-grupo barra-pesquisa">
              <span className="filtro-icone">🔍</span>
              <input 
                  type="text" 
                  placeholder="Buscar por nome ou código..." 
                  value={busca} 
                  onChange={e => setBusca(e.target.value)} 
              />
          </div>

          <div className="filtro-grupo barra-select">
              <span className="filtro-label">📂 CATEGORIA:</span>
              <select className="filtro-select" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
                  <option value="">Todas as Categorias</option>
                  {categoriasUnicas.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                  ))}
              </select>
          </div>

          <div className="filtro-grupo barra-select">
              <span className="filtro-label">🚦 STATUS:</span>
              <select className="filtro-select" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                  <option value="">Todos os Status</option>
                  <option value="disponivel">✅ Disponíveis</option>
                  <option value="manutencao">🛠️ Em Manutenção</option>
                  <option value="indisponivel">🚫 Esgotados / Indisponíveis</option>
              </select>
          </div>
          
          <div className="filtro-grupo seletor-data">
              <span className="filtro-label">📅 LIVRE NO DIA:</span>
              <div className="data-input-wrapper">
                  <input 
                      type="date" 
                      value={dataFiltro} 
                      onChange={e => setDataFiltro(e.target.value)} 
                  />
                  {dataFiltro && (
                      <button className="btn-limpar-data" onClick={limparFiltroData} title="Limpar Data">✕</button>
                  )}
              </div>
          </div>
      </div>

      {loading ? (
          <div style={{padding: '50px', textAlign: 'center', color: '#64748b'}}>Carregando acervo...</div>
      ) : (
          <div className="table-container">
            <table className="table-pro">
              <thead>
                <tr>
                  <th width="30%">PRODUTO</th>
                  <th>CATEGORIA</th>
                  <th>VALOR LOCAÇÃO</th>
                  <th style={{textAlign: 'center'}}>{dataFiltro ? 'LIVRE NO DIA' : 'ESTOQUE'}</th>
                  <th style={{textAlign: 'center'}}>STATUS</th>
                  <th style={{textAlign:'right'}}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map(item => {
                  
                  const { disponivelTotal, alugados, emManutencao } = calcularDisponibilidadeNaData(item);
                  
                  // Agora consideramos esgotado SE O SALDO FOR ZERO (seja data selecionada ou não)
                  const estaTotalmenteAlugado = disponivelTotal <= 0;
                  
                  const estoqueBaixo = !dataFiltro && item.configuracao?.alertaEstoque === 'Avisar' && disponivelTotal > 0 && disponivelTotal <= item.estoqueMinimo;
                  const valorAluguelFormatado = item.financeiro?.valorAluguel ? Number(item.financeiro.valorAluguel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                  const posImg = item.posicoesFoco?.[0];

                  return (
                    <tr key={item.id} className={estaTotalmenteAlugado ? 'linha-esgotada' : ''}>
                      
                      <td className="item-info-cell">
                        <div className="prod-detail">
                          <div className="thumb-wrapper">
                              {item.foto ? (
                                <img 
                                  src={item.foto} 
                                  className="thumb-img clickable-thumb" 
                                  style={{ objectPosition: posImg ? `${posImg.x}% ${posImg.y}%` : '50% 50%' }}
                                  onClick={() => setImagemAmpliada(item.foto)} 
                                  title="Clique para ampliar"
                                />
                              ) : ( <div className="no-thumb">📷</div> )}
                              
                              {/* Selo na foto só aparece se realmente zerou o estoque */}
                              {estaTotalmenteAlugado && <div className="selo-foto-esgotado">ALUGADO</div>}
                          </div>
                          
                          <div>
                              <strong>{item.nome}</strong>
                              <span className="sub-text">CÓD: {item.codigo || 'S/N'} {item.localizacao ? `• 📍 ${item.localizacao}` : ''}</span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="mobile-stack">
                        <span className="mobile-label">CATEGORIA:</span>
                        <span className="tag-loc">{item.categoria || 'Sem categoria'}</span>
                      </td>
                      
                      <td className="mobile-stack">
                        <span className="mobile-label">VALOR LOCAÇÃO:</span>
                        <span style={{fontWeight: '800', color: '#0f172a', fontSize: '15px'}}>R$ {valorAluguelFormatado}</span>
                      </td>
                      
                      <td className="mobile-stack stock-cell-center">
                        <span className="mobile-label">{dataFiltro ? 'DISPONÍVEL NO DIA:' : 'ESTOQUE REAL:'}</span>
                        
                        <div className="stock-info-blocos">
                            {estaTotalmenteAlugado ? (
                                <span className="estoque-alerta-zero">0 Peças Livres</span>
                            ) : (
                                <span className="estoque-livre-verde">{disponivelTotal} Peças Livres</span>
                            )}
                            
                            {dataFiltro && alugados > 0 && (
                                <span className="estoque-alugado-dica">🛍️ {alugados} alugados na data</span>
                            )}

                            {emManutencao > 0 && (
                                <span className="estoque-maint-dica">🛠️ {emManutencao} em reparo</span>
                            )}

                            {estoqueBaixo && <span className="estoque-baixo-dica">⚠️ Estoque Baixo</span>}
                        </div>
                      </td>
                      
                      <td className="status-cell cell-center">
                        {/* Se o estoque for 0, pílula Esgotado/Indisponível. Senão, mostra Disponível */}
                        <span className={`status-pill ${estaTotalmenteAlugado ? (dataFiltro ? 'esgotado' : 'manutencao') : 'disponivel'}`}>
                          {estaTotalmenteAlugado 
                              ? (dataFiltro ? '🚫 ALUGADO' : '🛠️ INDISPONÍVEL') 
                              : '✅ DISPONÍVEL'}
                        </span>
                      </td>
                      
                      <td className="actions-cell">
                        <div className="dropdown-container">
                            <button className="action-icon" title="Gerenciar Manutenção" onClick={() => abrirModalManutencao(item)}>🛠️</button>
                            <button className="action-icon" title="Editar" onClick={() => irParaCadastro(item)}>✏️</button>
                            <button className="action-icon delete" title="Excluir" onClick={() => { if(window.confirm("Certeza que deseja excluir permanentemente do acervo?")) deleteDoc(doc(db, "estoque", item.id)).then(carregarDados) }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                
                {itensFiltrados.length === 0 && (
                    <tr>
                        <td colSpan="6" style={{textAlign:'center', padding:'40px', color:'#64748b'}}>
                            <div style={{fontSize: '40px', marginBottom: '10px'}}>🕵️‍♀️</div>
                            <strong>Nenhuma peça encontrada com esses filtros!</strong>
                            <p style={{fontSize: '12px', marginTop: '5px'}}>Tente mudar a categoria, o status ou limpar a data.</p>
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
      )}

      {/* --- MODAIS --- */}
      {modalManutencao && (
        <div className="modal-overlay-blur">
          <div className="modal-maintenance-card">
            <div className="modal-maintenance-header">
              <h3>🛠️ Enviar para Manutenção</h3>
              <button className="close-btn-modern" onClick={() => setModalManutencao(false)}>×</button>
            </div>
            
            <div className="modal-maintenance-body">
              <p>Quantas unidades de <strong>{itemParaManutencao?.nome}</strong> precisam de reparos?</p>
              <div className="input-group-modern">
                <label>QUANTIDADE (MÁX: {itemParaManutencao?.quantidade})</label>
                <input 
                  type="number" value={qtdMaint} onChange={(e) => setQtdMaint(e.target.value)}
                  min="0" max={itemParaManutencao?.quantidade} className="modal-input-highlight"
                />
                <span className="helper-text">Dica: Digite 0 para devolver todas as peças ao estoque livre.</span>
              </div>
            </div>
            
            <div className="modal-maintenance-footer">
              <button className="btn-modal-cancel" onClick={() => setModalManutencao(false)}>Cancelar</button>
              <button className="btn-modal-save" onClick={salvarManutencao}>Atualizar</button>
            </div>
          </div>
        </div>
      )}

      {imagemAmpliada && (
        <div className="image-zoom-overlay" onClick={() => setImagemAmpliada(null)}>
          <img src={imagemAmpliada} className="image-zoom-content" alt="Zoom" />
          <p className="zoom-caption">Clique em qualquer lugar para fechar</p>
        </div>
      )}
    </div>
  );
};

export default Estoque;