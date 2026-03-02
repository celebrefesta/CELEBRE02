import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
// 🔥 IMPORTAMOS O deleteDoc AQUI 🔥
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import './Notificacoes.css';

const Notificacoes = () => {
  const navigate = useNavigate();
  const [clientesPendentes, setClientesPendentes] = useState([]);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const qClientes = query(collection(db, "clientes"), where("situacaoFinanceira", "==", "pendente"));
      const snapClientes = await getDocs(qClientes);
      const listaC = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));

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
      carregarDados(); 
    } catch (error) {
      alert("Erro ao aprovar cliente.");
    }
  };

  // 🔥 NOVA FUNÇÃO PARA RECUSAR E DELETAR O CADASTRO 🔥
  const recusarCliente = async (id) => {
    const confirmar = window.confirm("Tem certeza que deseja recusar e excluir este cadastro definitivamente?");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        carregarDados(); // Recarrega a tela para a notificação sumir
      } catch (error) {
        alert("Erro ao excluir cliente.");
      }
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
          
          <div className="notificacoes-coluna">
            <h2>👤 Cadastros Completos ({clientesPendentes.length})</h2>
            
            {clientesPendentes.length === 0 && (
              <div className="notificacao-vazia">Nenhum cadastro aguardando aprovação.</div>
            )}

            {clientesPendentes.map(cliente => (
              <div key={cliente.id} className="card-notificacao">
                <div className="card-noti-header novo-cliente">NOVO CADASTRO</div>
                <div className="card-noti-body">
                  <strong>{cliente.nome}</strong>
                  <span>CPF/CNPJ: {cliente.documento || cliente.cpf || cliente.cnpj}</span>
                  <span>WhatsApp: {cliente.contato || cliente.celular}</span>
                  <span>📍 {cliente.cidade} - {cliente.bairro}</span>
                </div>
                
                {/* 🔥 BOTÕES ATUALIZADOS AQUI 🔥 */}
                <div className="card-noti-actions" style={{ display: 'flex', borderTop: '1px solid #f1f5f9' }}>
                  <button 
                    className="btn-revisar" 
                    style={{ flex: 1, padding: '10px', background: 'white', border: 'none', color: '#64748b', cursor: 'pointer', borderRight: '1px solid #f1f5f9' }}
                    onClick={() => navigate('/cadastro-cliente', { state: { clienteEditando: cliente } })}
                  >
                    Revisar
                  </button>
                  <button 
                    style={{ flex: 1, padding: '10px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', borderRight: '1px solid #f1f5f9' }}
                    onClick={() => recusarCliente(cliente.id)}
                  >
                    ✕ Recusar
                  </button>
                  <button 
                    className="btn-aprovar" 
                    style={{ flex: 1, padding: '10px', background: '#10b981', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                    onClick={() => aprovarCliente(cliente.id)}
                  >
                    ✓ Aprovar
                  </button>
                </div>

              </div>
            ))}
          </div>

          <div className="notificacoes-coluna">
            <h2>🎯 Possíveis Clientes ({pedidosPendentes.length})</h2>
            
            {pedidosPendentes.length === 0 && (
              <div className="notificacao-vazia">Nenhum orçamento novo do site.</div>
            )}

            {pedidosPendentes.map(pedido => (
              <div key={pedido.id} className="card-notificacao">
                <div className="card-noti-header novo-pedido">POSSÍVEL CLIENTE</div>
                <div className="card-noti-body">
                  <strong>Nome: {pedido.clienteNome}</strong>
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
                    Abrir Orçamento ➔
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