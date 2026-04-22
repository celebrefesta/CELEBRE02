import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // 🔥 Importação do Cadeado de Segurança
import './Notificacoes.css';

const Notificacoes = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [listaUnificada, setListaUnificada] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    if (!usuarioLogado) return;

    setLoading(true);
    try {
      // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa apenas os SEUS novos clientes pendentes
      const qClientes = query(collection(db, "clientes"), where("situacaoFinanceira", "==", "pendente"), where("userId", "==", usuarioLogado.uid));
      const snapClientes = await getDocs(qClientes);
      const listaC = snapClientes.docs.map(d => ({ 
          id: d.id, 
          tipoNotificacao: 'cliente',
          ...d.data(),
          timestampOrdenacao: d.data().criadoEm?.toMillis ? d.data().criadoEm.toMillis() : Date.now() 
      }));

      // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa apenas os SEUS novos orçamentos do catálogo
      const qPedidos = query(collection(db, "locacoes"), where("origem", "==", "catalogo_publico"), where("status", "==", "orcamento"), where("userId", "==", usuarioLogado.uid));
      const snapPedidos = await getDocs(qPedidos);
      const listaP = snapPedidos.docs.map(d => ({ 
          id: d.id, 
          tipoNotificacao: 'orcamento',
          ...d.data(),
          timestampOrdenacao: d.data().criadoEm?.toMillis ? d.data().criadoEm.toMillis() : Date.now() 
      }));

      const todasNotificacoes = [...listaC, ...listaP].sort((a, b) => b.timestampOrdenacao - a.timestampOrdenacao);
      setListaUnificada(todasNotificacoes);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    carregarDados();
  }, [usuarioLogado, navigate]);

  const aprovarCliente = async (id) => {
    try {
      await updateDoc(doc(db, "clientes", id), { situacaoFinanceira: 'adimplente' });
      carregarDados(); 
    } catch (error) {
      alert("Erro ao aprovar cliente.");
    }
  };

  const recusarCliente = async (id) => {
    const confirmar = window.confirm("Tem certeza que deseja recusar e excluir este cadastro definitivamente?");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        carregarDados(); 
      } catch (error) {
        alert("Erro ao excluir cliente.");
      }
    }
  };

  return (
    <div className="notificacoes-container fade-in">
      <div className="notificacoes-max-width">
        <div className="notificacoes-header">
          <h1>Caixa de Entrada 📥</h1>
          <p>Gerencie novos clientes e pedidos que acabaram de chegar na sua empresa.</p>
        </div>

        {loading ? (
          <div className="loading-notificacoes">Buscando novidades...</div>
        ) : (
          <div className="notificacoes-lista">
              
            {listaUnificada.length === 0 ? (
              <div className="notificacao-vazia">
                 <span style={{fontSize: '40px', display: 'block', marginBottom: '10px'}}>🎉</span>
                 Caixa de entrada limpa! Nenhuma novidade no momento.
              </div>
            ) : (
               listaUnificada.map(item => {
                   
                   // RENDERIZA LINHA DE NOVO CLIENTE
                   if (item.tipoNotificacao === 'cliente') {
                       return (
                           <div key={`cli-${item.id}`} className="noti-card-premium">
                               <div className="noti-info-bloco">
                                   <div className="noti-avatar avatar-laranja">👤</div>
                                   <div className="noti-textos">
                                       <span className="noti-tag tag-laranja">Novo Cadastro</span>
                                       <h2>{item.nome || item.nomeCompleto}</h2>
                                       <p>WhatsApp: <strong>{item.contato || item.celular || 'Não info.'}</strong></p>
                                   </div>
                               </div>

                               <div className="noti-acoes-bloco">
                                   <button className="noti-btn btn-cinza" onClick={() => navigate('/cadastro-cliente', { state: { clienteEditando: item } })}>
                                       Revisar
                                   </button>
                                   <button className="noti-btn btn-vermelho" onClick={() => recusarCliente(item.id)}>
                                       Recusar
                                   </button>
                                   <button className="noti-btn btn-verde" onClick={() => aprovarCliente(item.id)}>
                                       ✓ Aprovar
                                   </button>
                               </div>
                           </div>
                       )
                   }
                   
                   // RENDERIZA LINHA DE NOVO ORÇAMENTO
                   if (item.tipoNotificacao === 'orcamento') {
                       return (
                           <div key={`orc-${item.id}`} className="noti-card-premium">
                               <div className="noti-info-bloco">
                                   <div className="noti-avatar avatar-azul">🛍️</div>
                                   <div className="noti-textos">
                                       <span className="noti-tag tag-azul">Orçamento Web</span>
                                       <h2>{item.clienteNome}</h2>
                                       <p>Festa: <strong>{item.dataRetirada ? item.dataRetirada.split('-').reverse().join('/') : 'S/D'}</strong> • Estimativa: <strong className="valor-destaque">R$ {Number(item.valorTotal || 0).toFixed(2)}</strong></p>
                                   </div>
                               </div>

                               <div className="noti-acoes-bloco">
                                   <button className="noti-btn btn-escuro" onClick={() => navigate(`/locacoes/editar/${item.id}`)}>
                                       Abrir Pedido ➔
                                   </button>
                               </div>
                           </div>
                       )
                   }

                   return null;
               })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notificacoes;