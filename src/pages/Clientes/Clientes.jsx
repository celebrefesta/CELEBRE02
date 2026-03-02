import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Clientes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [menuAberto, setMenuAberto] = useState(null); 
  const navigate = useNavigate();

  useEffect(() => { carregarClientes(); }, []);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"));
      const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => (a.nome || a.nomeFantasia || '').localeCompare(b.nome || b.nomeFantasia || ''));
      setClientes(lista);
    } catch (error) { console.error("Erro:", error); } 
    finally { setLoading(false); }
  };

  const excluirCliente = async (id) => {
    if (window.confirm("Excluir definitivamente?")) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        carregarClientes(); 
      } catch (error) { alert("Erro ao excluir."); }
    }
  };

  const editarCliente = (cliente) => {
    navigate('/cadastro-cliente', { state: { clienteEditando: cliente } });
  };

  // 🔥 REGRA ATUALIZADA: Permite alternar entre os 3 status clicando na etiqueta
  const alternarSituacaoFinanceira = async (cliente) => {
    let novaSituacao = 'adimplente';
    if (cliente.situacaoFinanceira === 'adimplente') novaSituacao = 'inadimplente';
    if (cliente.situacaoFinanceira === 'inadimplente') novaSituacao = 'pendente';
    
    if (window.confirm(`Mudar situação de ${cliente.nome || cliente.nomeFantasia} para ${novaSituacao.toUpperCase()}?`)) {
      try {
        await updateDoc(doc(db, "clientes", cliente.id), { situacaoFinanceira: novaSituacao });
        carregarClientes();
      } catch (error) { alert("Erro ao atualizar."); }
    }
  };

  const toggleMenu = (id) => {
    setMenuAberto(menuAberto === id ? null : id);
  };

  return (
    <div className="clientes-container">
      <div className="dashboard-header">
        <div className="welcome-text">
          <h1>MEUS CLIENTES</h1>
          <p>Gestão de carteira e contatos.</p>
        </div>
        <Link to="/cadastro-cliente" className="btn-primary-celebre">+ NOVO</Link>
      </div>

      <div className="main-card-transparent">
        
        <div className="filter-wrapper-clean">
          <div className="search-bar-container">
            <span className="search-icon">🔍</span>
            <input 
              className="search-input-clean" 
              placeholder="Buscar cliente, documento ou contato..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
            />
          </div>
          <button className="btn-primary-celebre btn-busca-mobile">🔍 Filtrar</button>
        </div>

        {loading ? (
          <div className="loading-state">Carregando clientes...</div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th width="35%">CLIENTE</th>
                  <th>CONTATO</th>
                  <th>LOCALIZAÇÃO</th>
                  <th className="text-center">SITUAÇÃO</th>
                  <th width="50px"></th> 
                </tr>
              </thead>
              <tbody>
                {clientes.filter(c => {
                  const t = busca.toLowerCase();
                  return (c.nome?.toLowerCase().includes(t)) || (c.nomeFantasia?.toLowerCase().includes(t));
                }).map(c => (
                  <tr key={c.id} onMouseLeave={() => setMenuAberto(null)}> 
                    
                    <td className="cliente-cell">
                      <div className="cliente-info-wrapper">
                        {c.foto ? (
                          <img src={c.foto} className="avatar-quadrado" alt={c.nome} />
                        ) : (
                          <div className="avatar-quadrado">{(c.nome || c.nomeFantasia || '?').charAt(0).toUpperCase()}</div>
                        )}
                        <div className="user-details">
                          <strong>{c.tipoPessoa === 'juridica' ? c.nomeFantasia : c.nome}</strong>
                          <span>{c.tipoPessoa === 'juridica' ? c.cnpj : c.cpf || 'Sem documento'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="info-cell mobile-stack">
                      <span className="mobile-label">Contato:</span>
                      {c.celular ? <a href={`https://wa.me/55${c.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="link-zap">📱 {c.celular}</a> : '--'}
                    </td>

                    <td className="info-cell mobile-stack">
                      <span className="mobile-label">Local:</span>
                      📍 {c.cidade ? `${c.cidade}/${c.uf}` : '--'}
                    </td>

                    <td className="status-cell text-center mobile-stack">
                      {/* 🔥 BADGE CORRIGIDO: Agora reconhece os 3 status 🔥 */}
                      <span 
                        onClick={() => alternarSituacaoFinanceira(c)}
                        className={`badge-status ${
                          c.situacaoFinanceira === 'inadimplente' ? 'devedor' : 
                          c.situacaoFinanceira === 'pendente' ? 'pendente-bg' : 'ok'
                        }`}
                        style={{
                          // Se o CSS principal não tiver a classe pendente-bg, eu forço as cores aqui por garantia
                          backgroundColor: c.situacaoFinanceira === 'pendente' ? '#fef3c7' : '',
                          color: c.situacaoFinanceira === 'pendente' ? '#d97706' : ''
                        }}
                      >
                        {c.situacaoFinanceira === 'inadimplente' ? '⚠️ INADIMPLENTE' : 
                         c.situacaoFinanceira === 'pendente' ? '⏳ PENDENTE' : '✅ ADIMPLENTE'}
                      </span>
                    </td>

                    <td className="actions-cell">
                      <div className="dropdown-container">
                        <button className="btn-pontinhos" onClick={() => toggleMenu(c.id)}>⋮</button>
                        {menuAberto === c.id && (
                          <div className="menu-suspenso">
                            <button onClick={() => editarCliente(c)} className="item-menu">✏️ Editar</button>
                            <button onClick={() => excluirCliente(c.id)} className="item-menu item-excluir">🗑️ Excluir</button>
                          </div>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Clientes;