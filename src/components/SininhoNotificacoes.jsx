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
  const [quantidadeNova, setQuantidadeNova] = useState(0);
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

  // 1. SENSOR QUE BUSCA TUDO O QUE ESTÁ PENDENTE NO BANCO
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

  // 2. LÓGICA DE VIZUALIZAÇÃO (ESTILO INSTAGRAM)
  useEffect(() => {
    // Junta todos os itens atuais em uma lista só
    const todosItens = [...clientesPendentes, ...pedidosPendentes];
    
    // Puxa do navegador os IDs que você já clicou para ver no passado
    const idsVistos = JSON.parse(localStorage.getItem('notificacoesVistasIds') || '[]');
    
    // Filtra apenas os itens que chegaram agora e que você ainda NÃO viu
    const novosItens = todosItens.filter(item => !idsVistos.includes(item.id));
    
    setQuantidadeNova(novosItens.length);
  }, [clientesPendentes, pedidosPendentes]);

  // 3. AÇÃO DE LER AS NOTIFICAÇÕES
  const handleAbrirMenu = () => {
    if (!menuAberto) {
      // Quando você clica para abrir o sininho, o sistema pega o ID de TODAS as pendências atuais
      // e salva no navegador dizendo: "A Camila já viu que esses caras existem".
      const todosItens = [...clientesPendentes, ...pedidosPendentes];
      const todosIds = todosItens.map(item => item.id);
      
      localStorage.setItem('notificacoesVistasIds', JSON.stringify(todosIds));
      
      // Zera a bolinha vermelha na hora, trazendo paz de espírito!
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
      {/* O Botão do Sininho */}
      <button 
        className={`sininho-btn-trigger ${menuAberto ? 'ativo' : ''}`} 
        onClick={handleAbrirMenu}
        title="Ver notificações"
      >
        <i className="fas fa-bell"></i>
        {/* Só mostra a bolinha se tiver número MAIOR que zero */}
        {quantidadeNova > 0 && <span className="sininho-badge">{quantidadeNova}</span>}
      </button>

      {/* A Gaveta de Notificações */}
      {menuAberto && (
        <div className="notificacoes-dropdown-menu">
          <div className="noti-dropdown-header">
            <h3>Notificações</h3>
          </div>

          <div className="noti-dropdown-body">
            {clientesPendentes.length === 0 && pedidosPendentes.length === 0 ? (
              <div className="noti-vazia">Você não tem pendências no momento.</div>
            ) : (
              <>
                {/* Lista de Clientes Oficiais Pendentes */}
                {clientesPendentes.map(cliente => (
                  <div key={cliente.id} className="noti-item" onClick={irParaNotificacoes}>
                    <div className="noti-icon-circle bg-laranja">
                      <i className="fas fa-user-plus"></i>
                    </div>
                    <div className="noti-text">
                      <p><strong>{cliente.nome || cliente.nomeCompleto}</strong> fez um cadastro completo.</p>
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
            Ir para a Central de Notificações ➔
          </div>
        </div>
      )}
    </div>
  );
};

export default SininhoNotificacoes;