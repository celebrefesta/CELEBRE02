import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Estoque.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';

const Estoque = () => {
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [imagemAmpliada, setImagemAmpliada] = useState(null);

  const [modalManutencao, setModalManutencao] = useState(false);
  const [itemParaManutencao, setItemParaManutencao] = useState(null);
  const [qtdMaint, setQtdMaint] = useState(1);

  useEffect(() => { carregarEstoque(); }, []);

  const carregarEstoque = async () => {
    try {
      const q = query(collection(db, "estoque"), orderBy("criadoEm", "desc"));
      const querySnapshot = await getDocs(q);
      const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItens(lista);
    } catch (error) { console.error(error); } finally { setLoading(false); }
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
      carregarEstoque();
    } catch (error) {
      alert("Erro ao atualizar a manutenção.");
    }
  };

  const totalItens = itens.length;
  const valorAcervo = itens.reduce((acc, i) => acc + ((i.financeiro?.valorReposicao || i.financeiro?.valorCompra || 0) * i.quantidade), 0);
  const emManutencaoTotal = itens.reduce((acc, i) => acc + (i.qtdManutencao !== undefined ? i.qtdManutencao : (i.status === 'manutencao' ? i.quantidade : 0)), 0);
  const visiveis = itens.filter(i => i.configuracao?.visivelCatalogo !== false).length;
  const percentualVisivel = totalItens > 0 ? Math.round((visiveis / totalItens) * 100) : 0;

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
        <div className="card-stat"><span className="label-stat">VALOR DO ACERVO</span><div className="value-stat">R$ {valorAcervo.toLocaleString('pt-BR')}</div><div className="icon-stat">📊</div></div>
        <div className="card-stat"><span className="label-stat">EM MANUTENÇÃO</span><div className="value-stat text-orange">{emManutencaoTotal}</div><div className="icon-stat">🛠️</div></div>
        <div className="card-stat"><span className="label-stat">VISÍVEL NO CATÁLOGO</span><div className="value-stat text-green">{percentualVisivel}%</div><div className="icon-stat">👁️</div></div>
      </div>

      <div className="filter-wrapper">
        <input className="search-input" placeholder="Buscar por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
        <div className="filter-controls"><button className="btn-filter">🔍 Filtrar</button></div>
      </div>

      <div className="table-container">
        <table className="table-pro">
          <thead>
            <tr>
              <th width="25%">PRODUTO</th>
              <th>CATEGORIA</th>
              <th>LOCALIZAÇÃO</th>
              <th>VALOR (LOCAÇÃO)</th>
              <th>ESTOQUE</th>
              <th>STATUS</th>
              <th style={{textAlign:'right'}}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {itens.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase())).map(item => {
              
              const emMaint = item.qtdManutencao !== undefined ? item.qtdManutencao : (item.status === 'manutencao' ? item.quantidade : 0);
              const disponivelLoc = item.quantidade - emMaint;
              const estoqueBaixo = item.configuracao?.alertaEstoque === 'Avisar' && disponivelLoc <= item.estoqueMinimo;

              const valorAluguelFormatado = item.financeiro?.valorAluguel 
                ? Number(item.financeiro.valorAluguel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                : '0,00';

              const posImg = item.posicoesFoco?.[0];

              return (
                <tr key={item.id}>
                  {/* FOTO E NOME - VAI VIRAR O CABEÇALHO DO CARD NO CELULAR */}
                  <td className="item-info-cell">
                    <div className="prod-detail">
                      {item.foto ? (
                        <img 
                          src={item.foto} 
                          className="thumb-img clickable-thumb" 
                          style={{ objectPosition: posImg ? `${posImg.x}% ${posImg.y}%` : '50% 50%' }}
                          onClick={() => setImagemAmpliada(item.foto)} 
                          title="Clique para ampliar"
                        />
                      ) : ( <div className="no-thumb">📷</div> )}
                      <div><strong>{item.nome}</strong><span className="sub-text">CÓD: {item.codigo}</span></div>
                    </div>
                  </td>
                  
                  {/* AS OUTRAS CÉLULAS VIRAM "LINHAS" NO CELULAR */}
                  <td className="mobile-stack">
                    <span className="mobile-label">CATEGORIA:</span>
                    <span className="tag-loc">{item.categoria}</span>
                    {item.subCategoria && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 'bold' }}>{item.subCategoria}</div>}
                  </td>
                  
                  <td className="mobile-stack">
                    <span className="mobile-label">LOCALIZAÇÃO:</span>
                    <span style={{color: '#475569', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500'}}>
                      📍 {item.localizacao || 'Não definida'}
                    </span>
                  </td>
                  
                  <td className="mobile-stack">
                    <span className="mobile-label">VALOR LOCAÇÃO:</span>
                    <span style={{fontWeight: '700', color: '#0f172a', fontSize: '14px'}}>
                      R$ {valorAluguelFormatado}
                    </span>
                  </td>
                  
                  <td className="mobile-stack">
                    <span className="mobile-label">ESTOQUE / DISPONÍVEL:</span>
                    <div className="stock-info" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className={estoqueBaixo ? 'text-red' : 'text-bold'} style={{ fontSize: '15px' }}>
                        {disponivelLoc} / {item.quantidade}
                      </span>
                      {emMaint > 0 && (
                        <div style={{color: '#d97706', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px'}}>
                          🛠️ {emMaint} em manutenção
                        </div>
                      )}
                      {estoqueBaixo && <div className="alert-badge" style={{marginTop: 0, width: 'fit-content'}}>⚠️ ESTOQUE BAIXO</div>}
                    </div>
                  </td>
                  
                  <td className="status-cell">
                    <span className={`status-pill ${disponivelLoc > 0 ? 'disponivel' : 'manutencao'}`}>
                      {disponivelLoc > 0 ? '✅ Disponível' : '🛠️ Indisponível'}
                    </span>
                  </td>
                  
                  <td className="actions-cell">
                    <div className="dropdown-container">
                        <button className="action-icon" title="Gerenciar Manutenção" onClick={() => abrirModalManutencao(item)}>🛠️</button>
                        <button className="action-icon" title="Editar" onClick={() => irParaCadastro(item)}>✏️</button>
                        <button className="action-icon delete" title="Excluir" onClick={() => { if(window.confirm("Excluir?")) deleteDoc(doc(db, "estoque", item.id)).then(carregarEstoque) }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* --- MODAIS MANTIDOS ORIGINAIS --- */}
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
                <span className="helper-text">Dica: Digite 0 para devolver todas as peças ao estoque.</span>
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