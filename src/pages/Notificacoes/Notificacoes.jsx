import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import './Notificacoes.css';

const Notificacoes = () => {
  const navigate = useNavigate();
  const [clientesPendentes, setClientesPendentes] = useState([]);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Busca todos os clientes que nasceram como 'pendente'
      const qClientes = query(collection(db, "clientes"), where("situacaoFinanceira", "==", "pendente"));
      const snapClientes = await getDocs(qClientes);
      const listaC = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Busca todos os orçamentos que vieram do catálogo público
      const qPedidos = query(collection(db, "locacoes"), where("origem", "==", "catalogo_publico"), where("status", "==", "orcamento"));
      const snapPedidos = await getDocs(qPedidos);
      const listaP = snapPedidos.docs.map(d => ({ id: d.id, ...d.data() }));

      setClientesPendentes(listaC);
      setPedidosPendentes(listaP);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const aprovarCliente = async (id) => {
    try {
      await updateDoc(doc(db, "clientes", id), { situacaoFinanceira: 'adimplente' });
      carregarDados(); // Recarrega a tela para a notificação sumir
    } catch (error) {
      alert("Erro ao aprovar cliente.");
    }
  };

  return (
    <div className="notificacoes-container">
      <div className="notificacoes-header">
        <h1>Central de Notificações 🔔</h1>
        <p>Acompanhe aqui tudo o que chega de novo pelo seu Catálogo Online.</p>
      </div>

      {loading ? (
        <div className="loading-notificacoes">Buscando novidades...</div>
      ) : (
        <div className="notificacoes-grid">
          
          {/* COLUNA 1: CLIENTES PENDENTES */}
          <div className="notificacoes-coluna">
            <h2>👤 Novos Cadastros ({clientesPendentes.length})</h2>
            
            {clientesPendentes.length === 0 && (
              <div className="notificacao-vazia">Nenhum cliente aguardando aprovação.</div>
            )}

            {clientesPendentes.map(cliente => (
              <div key={cliente.id} className="card-notificacao">
                <div className="card-noti-header novo-cliente">NOVO CLIENTE</div>
                <div className="card-noti-body">
                  <strong>{cliente.nome}</strong>
                  <span>CPF/CNPJ: {cliente.documento || cliente.cpf || cliente.cnpj}</span>
                  <span>WhatsApp: {cliente.contato || cliente.celular}</span>
                  <span>📍 {cliente.cidade} - {cliente.bairro}</span>
                </div>
                <div className="card-noti-actions">
                  <button className="btn-revisar" onClick={() => navigate('/cadastro-cliente', { state: { clienteEditando: cliente } })}>
                    Revisar Ficha
                  </button>
                  <button className="btn-aprovar" onClick={() => aprovarCliente(cliente.id)}>
                    ✓ Aprovar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* COLUNA 2: PEDIDOS PENDENTES */}
          <div className="notificacoes-coluna">
            <h2>🛍️ Novos Orçamentos ({pedidosPendentes.length})</h2>
            
            {pedidosPendentes.length === 0 && (
              <div className="notificacao-vazia">Nenhum orçamento novo do site.</div>
            )}

            {pedidosPendentes.map(pedido => (
              <div key={pedido.id} className="card-notificacao">
                <div className="card-noti-header novo-pedido">NOVO PEDIDO</div>
                <div className="card-noti-body">
                  <strong>Cliente: {pedido.clienteNome}</strong>
                  <span>Data da Festa: {pedido.dataRetirada}</span>
                  <span>Valor Estimado: R$ {Number(pedido.valorTotal).toFixed(2)}</span>
                  <div className="resumo-itens-noti">
                    {pedido.itens?.map((item, idx) => (
                      <div key={idx}>- {item.qtd}x {item.nome}</div>
                    ))}
                  </div>
                </div>
                <div className="card-noti-actions">
                  <button className="btn-aprovar-pedido" onClick={() => navigate(`/locacoes/editar/${pedido.id}`)}>
                    Abrir Pedido ➔
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
};

export default Notificacoes;