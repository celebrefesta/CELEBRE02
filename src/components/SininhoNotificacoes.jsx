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

  // 🔥 ESTADO QUE CONTROLA A BOLINHA VERMELHA 🔥
  const [quantidadeNova, setQuantidadeNova] = useState(0);

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
    const qClientes = query(collection(db, "clientes"), where("situacaoFinanceira", "==", "pendente"));
    const unsubscribeClientes = onSnapshot(qClientes, (snapshot) => {
      const listaC = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClientesPendentes(listaC);
    });

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

  const totalRealDePendencias = clientesPendentes.length + pedidosPendentes.length;

  // 🔥 LÓGICA ESTILO FACEBOOK/INSTAGRAM 🔥
  useEffect(() => {
    // Puxa da memória quantas notificações você já tinha visto antes
    const vistos = parseInt(localStorage.getItem('notificacoesVistas') || '0');

    if (totalRealDePendencias > vistos) {
       // Se o total atual for MAIOR que o visto, mostra na bolinha só a diferença (os novos)
       setQuantidadeNova(totalRealDePendencias - vistos);
    } else if (totalRealDePendencias < vistos) {
       // Se você resolveu algum pedido (aprovou/excluiu), atualiza a memória para baixo e esconde a bolinha
       localStorage.setItem('notificacoesVistas', totalRealDePendencias.toString());
       setQuantidadeNova(0);
    } else {
       setQuantidadeNova(0);
    }
  }, [totalRealDePendencias]);

  const handleAbrirMenu = () => {
    if (!menuAberto) {
        // Ao abrir a gaveta, salva na memória que você já viu tudo e ZERA a bolinha vermelha
        localStorage.setItem('notificacoesVistas', totalRealDePendencias.toString());
        setQuantidadeNova(0);
    }
    setMenuAberto(!menuAberto);
  };

  const irParaNotificacoes = () => {
    navigate('/notificacoes');
    setMenuAberto(false);
  };

  return (
    <div className="sininho-wrapper" ref={menuRef}>
      {/* O Botão do Sininho Atualizado */}
      <button 
        className={`sininho-btn-trigger ${menuAberto ? 'ativo' : ''}`} 
        onClick={handleAbrirMenu}
      >
        <i className="fas fa-bell"></i>
        {/* Mostra a bolinha apenas se tiver notificações não vistas */}
        {quantidadeNova > 0 && <span className="sininho-badge">{quantidadeNova}</span>}
      </button>

      {/* A Gaveta de Notificações */}
      {menuAberto && (
        <div className="notificacoes-dropdown-menu">
          <div className="noti-dropdown-header">
            <h3>Notificações</h3>
          </div>

          <div className="noti-dropdown-body">
            {totalRealDePendencias === 0 ? (
              <div className="noti-vazia">Você não tem novas notificações.</div>
            ) : (
              <>
                {/* Lista de Clientes Oficiais Pendentes */}
                {clientesPendentes.map(cliente => (
                  <div key={cliente.id} className="noti-item" onClick={irParaNotificacoes}>
                    <div className="noti-icon-circle bg-laranja">
                      <i className="fas fa-user-plus"></i>
                    </div>
                    <div className="noti-text">
                      <p><strong>{cliente.nome}</strong> fez um cadastro completo.</p>
                      <span>Aguardando aprovação</span>
                    </div>
                  </div>
                ))}

                {/* Lista de Orçamentos Rápidos (Possíveis Clientes) */}
                {pedidosPendentes.map(pedido => (
                  <div key={pedido.id} className="noti-item" onClick={irParaNotificacoes}>
                    <div className="noti-icon-circle bg-azul">
                      <i className="fas fa-bullseye"></i>
                    </div>
                    <div className="noti-text">
                      <p>Possível cliente <strong>{pedido.clienteNome}</strong> enviou uma lista.</p>
                      <span>R$ {Number(pedido.valorTotal).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="noti-dropdown-footer" onClick={irParaNotificacoes}>
            Ver todas pendências completas
          </div>
        </div>
      )}
    </div>
  );
};

export default SininhoNotificacoes;