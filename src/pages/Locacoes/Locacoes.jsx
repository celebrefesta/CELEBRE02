import React, { useState, useEffect } from 'react';
import './Locacoes.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const Locacoes = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // --- CARREGAR DADOS DO FIREBASE ---
  useEffect(() => {
    const carregarLocacoes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "locacoes"));
        const dados = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Ordenação: Pedidos novos primeiro, depois os antigos
        const ordenado = dados.sort((a, b) => {
          const numA = a.numeroPedido || '';
          const numB = b.numeroPedido || '';
          return numB.localeCompare(numA);
        });

        setLista(ordenado);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar locações:", error);
        setLoading(false);
      }
    };
    carregarLocacoes();
  }, []);

  // --- FUNÇÃO EXCLUIR ---
  const handleExcluir = async (id) => {
    if (window.confirm("Tem certeza que deseja apagar este pedido?")) {
      try {
        await deleteDoc(doc(db, "locacoes", id));
        setLista(lista.filter(item => item.id !== id));
      } catch (error) {
        alert("Erro ao excluir.");
      }
    }
  };

  // --- FILTRO DE BUSCA ---
  const filtrados = lista.filter(item => 
    (item.clienteNome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (item.numeroPedido || '').includes(busca)
  );

  return (
    <div className="pagina-lista-v2">
      <header className="cabecalho-v2">
        <div>
          <h1>Minhas Locações</h1>
          <p>Gerencie seus pedidos (Versão Atualizada)</p>
        </div>
        <button className="btn-novo-v2" onClick={() => navigate('/locacoes/nova')}>
          + NOVA LOCAÇÃO
        </button>
      </header>

      {/* CARDS DE RESUMO (IGUAL AO SEU PRINT) */}
      <div className="resumo-topo-v2">
        <div className="card-resumo-v2">
          <span>Confirmados</span>
          <strong>{lista.filter(i => i.status === 'confirmado').length}</strong>
        </div>
        <div className="card-resumo-v2">
          <span>Orçamentos</span>
          <strong>{lista.filter(i => i.status === 'orcamento').length}</strong>
        </div>
        <div className="card-resumo-v2">
          <span>Total Pedidos</span>
          <strong>{lista.length}</strong>
        </div>
      </div>

      <div className="barra-busca-v2">
        <input 
          placeholder="🔎 Buscar por cliente ou nº do pedido..." 
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      <div className="tabela-container-v2">
        <table className="tabela-v2">
          <thead>
            <tr>
              <th>PEDIDO</th>
              <th>CLIENTE</th>
              <th>DATA</th>
              <th>VALOR</th>
              <th>STATUS</th>
              <th className="centro">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="centro">Carregando locações...</td></tr>
            ) : (
              filtrados.map((item) => (
                <tr key={item.id}>
                  <td className="destaque-azul">
                    {item.numeroPedido ? `#${item.numeroPedido}` : <span className="tag-antigo">Antigo</span>}
                  </td>
                  <td><strong>{item.clienteNome}</strong></td>
                  <td>
                    {item.dataRetirada ? new Date(item.dataRetirada + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                  </td>
                  
                  {/* --- AQUI ESTÁ O CÓDIGO CORRIGIDO PARA O VALOR --- */}
                  <td className="verde">
                    R$ {Number(item.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  
                  <td>
                    <span className={`status-pill ${item.status}`}>
                      {item.status === 'confirmado' ? 'CONFIRMADO' : 'ORÇAMENTO'}
                    </span>
                  </td>
                  <td className="centro col-acoes">
                    {/* BOTÃO EDITAR (LÁPIS) */}
                    <button 
                      className="btn-acao editar" 
                      title="Editar" 
                      onClick={() => navigate(`/locacoes/editar/${item.id}`)}
                    >
                      ✏️
                    </button>

                    {/* BOTÃO EXCLUIR (LIXEIRA) */}
                    <button 
                      className="btn-acao excluir" 
                      title="Excluir" 
                      onClick={() => handleExcluir(item.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Locacoes;