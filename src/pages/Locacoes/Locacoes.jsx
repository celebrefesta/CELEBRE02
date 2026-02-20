import React, { useState, useEffect } from 'react';
import './Locacoes.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'; // Adicionamos updateDoc e addDoc

const Locacoes = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DO MODAL DE PAGAMENTO ---
  const [modalPagamento, setModalPagamento] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [pagamento, setPagamento] = useState({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // --- CARREGAR DADOS DO FIREBASE ---
  useEffect(() => {
    const carregarLocacoes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "locacoes"));
        const dados = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

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

  // --- ABRIR MODAL DE PAGAMENTO ---
  const handleAbrirPagamento = (pedido) => {
    setPedidoSelecionado(pedido);
    setPagamento({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
    setModalPagamento(true);
  };

  // --- REGISTRAR PAGAMENTO (A MÁGICA ACONTECE AQUI) ---
  const registrarPagamento = async (e) => {
    e.preventDefault();
    if (!pagamento.valor || Number(pagamento.valor) <= 0) return alert("Insira um valor válido.");

    setSalvandoPagamento(true);
    try {
      const valorPagoNum = Number(pagamento.valor);
      const valorJaPago = Number(pedidoSelecionado.valorPago || 0);
      const novoValorPago = valorJaPago + valorPagoNum;

      // 1. Atualizar o valor pago dentro do Pedido (Locação)
      const pedidoRef = doc(db, "locacoes", pedidoSelecionado.id);
      await updateDoc(pedidoRef, {
        valorPago: novoValorPago
      });

      // 2. Lançar o valor lá no Financeiro automaticamente!
      await addDoc(collection(db, "financeiro_lancamentos"), {
        tipo: 'entrada',
        categoria: 'Locação',
        descricao: `Ref. Pedido #${pedidoSelecionado.numeroPedido || 'S/N'} - ${pedidoSelecionado.clienteNome}`,
        valor: valorPagoNum,
        formaPagto: pagamento.formaPagto,
        data: pagamento.data,
        status: 'pago',
        createdAt: serverTimestamp()
      });

      alert("Pagamento registrado com sucesso no Caixa!");
      
      // Atualizar a lista localmente para mostrar o novo saldo na hora
      setLista(lista.map(item => 
        item.id === pedidoSelecionado.id 
          ? { ...item, valorPago: novoValorPago } 
          : item
      ));

      setModalPagamento(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao registrar pagamento.");
    } finally {
      setSalvandoPagamento(false);
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
          <p>Gerencie seus pedidos e pagamentos</p>
        </div>
        <button className="btn-novo-v2" onClick={() => navigate('/locacoes/nova')}>
          + NOVA LOCAÇÃO
        </button>
      </header>

      {/* CARDS DE RESUMO */}
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
              <th>DATA EVENTO</th>
              <th>VALOR TOTAL</th>
              <th>FALTA RECEBER</th>
              <th>STATUS</th>
              <th className="centro">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="centro">Carregando locações...</td></tr>
            ) : (
              filtrados.map((item) => {
                const valorTotal = Number(item.valorTotal || 0);
                const valorPago = Number(item.valorPago || 0);
                const saldoDevedor = valorTotal - valorPago;

                return (
                  <tr key={item.id}>
                    <td className="destaque-azul">
                      {item.numeroPedido ? `#${item.numeroPedido}` : <span className="tag-antigo">Antigo</span>}
                    </td>
                    <td><strong>{item.clienteNome}</strong></td>
                    <td>
                      {item.dataRetirada ? new Date(item.dataRetirada + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    
                    <td>R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    
                    {/* COLUNA NOVA DE SALDO */}
                    <td className={saldoDevedor > 0 ? "txt-vermelho" : "txt-verde"}>
                      {saldoDevedor > 0 ? `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✅ Pago'}
                    </td>
                    
                    <td>
                      <span className={`status-pill ${item.status}`}>
                        {item.status === 'confirmado' ? 'CONFIRMADO' : 'ORÇAMENTO'}
                      </span>
                    </td>
                    <td className="centro col-acoes">
                      
                      {/* NOVO BOTÃO DE PAGAMENTO */}
                      <button 
                        className="btn-acao pagamento" 
                        title="Registrar Pagamento / Sinal" 
                        onClick={() => handleAbrirPagamento(item)}
                        disabled={saldoDevedor <= 0} // Desabilita se já estiver pago
                        style={{ opacity: saldoDevedor <= 0 ? 0.3 : 1 }}
                      >
                        💰
                      </button>

                      <button 
                        className="btn-acao editar" 
                        title="Editar" 
                        onClick={() => navigate(`/locacoes/editar/${item.id}`)}
                      >
                        ✏️
                      </button>

                      <button 
                        className="btn-acao excluir" 
                        title="Excluir" 
                        onClick={() => handleExcluir(item.id)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL DE REGISTRAR PAGAMENTO --- */}
      {modalPagamento && pedidoSelecionado && (
        <div className="modal-overlay-v2">
          <div className="modal-box-v2 pagamento-box">
            <div className="modal-header">
              <h3>💰 Receber Pagamento</h3>
              <button className="btn-fechar" onClick={() => setModalPagamento(false)}>X</button>
            </div>
            
            <div className="info-pedido-pagamento">
              <p><strong>Cliente:</strong> {pedidoSelecionado.clienteNome}</p>
              <p><strong>Pedido:</strong> #{pedidoSelecionado.numeroPedido}</p>
              <p><strong>Falta Receber:</strong> R$ {(Number(pedidoSelecionado.valorTotal || 0) - Number(pedidoSelecionado.valorPago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>

            <form onSubmit={registrarPagamento} className="form-pagamento">
              <div className="form-group-pag">
                <label>Valor Recebido (R$)</label>
                <input 
                  type="number" step="0.01" required autoFocus
                  value={pagamento.valor} onChange={e => setPagamento({...pagamento, valor: e.target.value})} 
                />
              </div>
              <div className="form-group-pag">
                <label>Forma de Pagamento</label>
                <select value={pagamento.formaPagto} onChange={e => setPagamento({...pagamento, formaPagto: e.target.value})}>
                  <option value="Pix">PIX</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Transferência">Transferência / TED</option>
                </select>
              </div>
              <div className="form-group-pag">
                <label>Data do Recebimento</label>
                <input 
                  type="date" required 
                  value={pagamento.data} onChange={e => setPagamento({...pagamento, data: e.target.value})} 
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalPagamento(false)}>Cancelar</button>
                <button type="submit" className="btn-confirm" disabled={salvandoPagamento}>
                  {salvandoPagamento ? "Registrando..." : "✔ Confirmar Recebimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locacoes;