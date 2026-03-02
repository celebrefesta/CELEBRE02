import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig'; 
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import './SininhoNotificacoes.css';

const SininhoNotificacoes = () => {
  const navigate = useNavigate();
  const [clientesPendentes, setClientesPendentes] = useState([]);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  // Fecha a gaveta se clicar fora
  useEffect(() => {
    const handleClickFora = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  useEffect(() => {
    // Escuta os clientes
    const qClientes = query(collection(db, "clientes"), where("situacaoFinanceira", "==", "pendente"));
    const unsubscribeClientes = onSnapshot(qClientes, (snapshot) => {
      const listaC = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClientesPendentes(listaC);
    });

    // Escuta os pedidos
    const qPedidos = query(collection(db, "locacoes"), where("origem", "==", "catalogo_publico"), where("status", "==", "orcamento"));
    const unsubscribePedidos = onSnapshot(qPedidos, (snapshot) => {
      const listaP = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPedidosPendentes(listaP);
    });

    return () => {
      unsubscribeClientes();
      unsubscribePedidos();
    };
  }, []);

  const total = clientesPendentes.length + pedidosPendentes.length;

  const irParaNotificacoes = () => {
    navigate('/notificacoes');
    setMenuAberto(false);
  };

  return (
    <div className="sininho-wrapper" ref={menuRef}>
      {/* O Botão do Sininho */}
      <button 
        className={`sininho-btn-trigger ${menuAberto ? 'ativo' : ''}`} 
        onClick={() => setMenuAberto(!menuAberto)}
      >
        <i className="fas fa-bell"></i>
        {total > 0 && <span className="sininho-badge">{total}</span>}
      </button>

      {/* A Gaveta de Notificações (estilo Facebook) */}
      {menuAberto && (
        <div className="notificacoes-dropdown-menu">
          <div className="noti-dropdown-header">
            <h3>Notificações</h3>
          </div>

          <div className="noti-dropdown-body">
            {total === 0 ? (
              <div className="noti-vazia">Você não tem novas notificações.</div>
            ) : (
              <>
                {/* Lista de Clientes */}
                {clientesPendentes.map(cliente => (
                  <div key={cliente.id} className="noti-item" onClick={irParaNotificacoes}>
                    <div className="noti-icon-circle bg-laranja">
                      <i className="fas fa-user-plus"></i>
                    </div>
                    <div className="noti-text">
                      <p><strong>{cliente.nome}</strong> fez um novo cadastro.</p>
                      <span>Aguardando aprovação</span>
                    </div>
                    <div className="noti-bolinha-azul"></div>
                  </div>
                ))}

                {/* Lista de Pedidos */}
                {pedidosPendentes.map(pedido => (
                  <div key={pedido.id} className="noti-item" onClick={irParaNotificacoes}>
                    <div className="noti-icon-circle bg-azul">
                      <i className="fas fa-shopping-bag"></i>
                    </div>
                    <div className="noti-text">
                      <p>Novo orçamento de <strong>{pedido.clienteNome}</strong>.</p>
                      <span>R$ {Number(pedido.valorTotal).toFixed(2)}</span>
                    </div>
                    <div className="noti-bolinha-azul"></div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="noti-dropdown-footer" onClick={irParaNotificacoes}>
            Ver todas as notificações
          </div>
        </div>
      )}
    </div>
  );
};

export default SininhoNotificacoes;