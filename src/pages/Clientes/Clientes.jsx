import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Clientes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore';

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [menuAberto, setMenuAberto] = useState(null); 
  const [allLocacoes, setAllLocacoes] = useState([]); // Guarda locações para o robô e modal
  
  // Estados para o Modal de Detalhes
  const [modalAberto, setModalAberto] = useState(false);
  const [detalhesDivida, setDetalhesDivida] = useState({ cliente: '', pendencias: [] });

  const navigate = useNavigate();

  useEffect(() => { carregarClientes(); }, []);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      // 1. Busca os clientes
      const querySnapshot = await getDocs(collection(db, "clientes"));
      let listaClientes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Busca as locações para o Robô analisar
      const snapLocacoes = await getDocs(collection(db, "locacoes"));
      const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllLocacoes(locacoes);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const batch = writeBatch(db);
      let precisaAtualizarBanco = false;

      // 3. O Robô analisa cada cliente
      listaClientes = listaClientes.map(cliente => {
        let temDivida = false;
        const locsCliente = locacoes.filter(loc => loc.clienteId === cliente.id || loc.cliente?.id === cliente.id);

        locsCliente.forEach(loc => {
          if (loc.status === 'cancelado' || loc.status === 'orcamento') return;
          const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
          if (dataStr) {
            const dataEvento = new Date(dataStr + 'T00:00:00');
            const pagStatus = (loc.statusPagamento || '').toLowerCase();
            if (dataEvento < hoje && pagStatus !== 'pago' && pagStatus !== 'quitado') {
              temDivida = true;
            }
          }
        });

        const statusCorreto = temDivida ? 'inadimplente' : 'adimplente';

        if (cliente.situacaoFinanceira !== statusCorreto) {
           batch.update(doc(db, "clientes", cliente.id), { situacaoFinanceira: statusCorreto });
           precisaAtualizarBanco = true;
           cliente.situacaoFinanceira = statusCorreto;
        }
        return cliente;
      });

      if (precisaAtualizarBanco) await batch.commit();

      listaClientes.sort((a, b) => (a.nome || a.nomeFantasia || '').localeCompare(b.nome || b.nomeFantasia || ''));
      setClientes(listaClientes);

    } catch (error) { 
      console.error("Erro ao carregar:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  // Função para abrir o modal e mostrar O QUE o cliente deve
  const verPorQueInadimplente = (cliente) => {
    if (cliente.situacaoFinanceira !== 'inadimplente') return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const pendencias = allLocacoes.filter(loc => {
      if (loc.clienteId !== cliente.id && loc.cliente?.id !== cliente.id) return false;
      if (loc.status === 'cancelado' || loc.status === 'orcamento') return false;
      
      const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
      const dataEvento = new Date(dataStr + 'T00:00:00');
      const pagStatus = (loc.statusPagamento || '').toLowerCase();
      
      return dataEvento < hoje && pagStatus !== 'pago' && pagStatus !== 'quitado';
    });

    setDetalhesDivida({
      cliente: cliente.nome || cliente.nomeFantasia,
      pendencias: pendencias
    });
    setModalAberto(true);
  };

  const excluirCliente = async (id, nome) => {
    if (window.confirm(`Excluir ${nome} e seus pedidos?`)) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        const qPedidos = query(collection(db, "locacoes"), where("clienteId", "==", id));
        const pedidosSnap = await getDocs(qPedidos);
        if (!pedidosSnap.empty) {
            const batch = writeBatch(db);
            pedidosSnap.forEach((docPedido) => batch.delete(docPedido.ref));
            await batch.commit();
        }
        carregarClientes(); 
      } catch (error) { alert("Erro ao excluir."); }
    }
  };

  const editarCliente = (cliente) => {
    navigate('/cadastro-cliente', { state: { clienteEditando: cliente } });
  };

  const toggleMenu = (id) => setMenuAberto(menuAberto === id ? null : id);

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
        </div>

        {loading ? (
          <div className="loading-state">Analisando finanças e carregando clientes...</div>
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
                      {c.celular ? <a href={`https://wa.me/55${c.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="link-zap">📱 {c.celular}</a> : '--'}
                    </td>

                    <td className="info-cell mobile-stack">
                      📍 {c.cidade ? `${c.cidade}/${c.uf}` : '--'}
                    </td>

                    <td className="status-cell text-center mobile-stack">
                      <span 
                        onClick={() => verPorQueInadimplente(c)}
                        className={`badge-status ${
                          c.situacaoFinanceira === 'inadimplente' ? 'devedor' : 
                          c.situacaoFinanceira === 'pendente' ? 'pendente-bg' : 'ok'
                        }`}
                        style={{
                          backgroundColor: c.situacaoFinanceira === 'pendente' ? '#fef3c7' : '',
                          color: c.situacaoFinanceira === 'pendente' ? '#d97706' : '',
                          cursor: c.situacaoFinanceira === 'inadimplente' ? 'pointer' : 'default',
                          fontWeight: 'bold'
                        }}
                      >
                        {c.situacaoFinanceira === 'inadimplente' ? '⚠️ VER PENDÊNCIAS' : 
                         c.situacaoFinanceira === 'pendente' ? '⏳ PENDENTE' : '✅ ADIMPLENTE'}
                      </span>
                    </td>

                    <td className="actions-cell">
                      <div className="dropdown-container">
                        <button className="btn-pontinhos" onClick={() => toggleMenu(c.id)}>⋮</button>
                        {menuAberto === c.id && (
                          <div className="menu-suspenso">
                            <button onClick={() => editarCliente(c)} className="item-menu">✏️ Editar</button>
                            <button onClick={() => excluirCliente(c.id, c.nome || c.nomeFantasia)} className="item-menu item-excluir">🗑️ Excluir</button>
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

      {/* MODAL DE DETALHES DA DÍVIDA (Abaixo de tudo) */}
      {modalAberto && (
        <div className="modal-overlay-financeiro">
          <div className="modal-content-financeiro">
            <div className="modal-header-fin">
              <h2>Dívidas de {detalhesDivida.cliente}</h2>
              <button onClick={() => setModalAberto(false)} className="btn-close-modal">×</button>
            </div>
            <div className="modal-body-fin">
              <p>Os pedidos abaixo estão vencidos e sem pagamento:</p>
              <div className="lista-pendencias">
                {detalhesDivida.pendencias.map(p => (
                  <div key={p.id} className="item-pendencia">
                    <span>📅 <strong>Data:</strong> {p.dataRetirada || p.dataEvento}</span>
                    <span>📄 <strong>Pedido:</strong> #{p.id.substring(0,6)}</span>
                    <span>💰 <strong>Total:</strong> R$ {p.valorTotal || p.total}</span>
                    <button onClick={() => {setModalAberto(false); navigate('/locacoes')}} className="btn-ir-pedido">Ir para Locações</button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setModalAberto(false)} className="btn-entendi">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;