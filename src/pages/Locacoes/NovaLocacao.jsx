import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NovaLocacao.css'; 
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, addDoc, getCountFromServer } from 'firebase/firestore'; 

const NovaLocacao = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // --- ESTADOS ---
  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [datas, setDatas] = useState({ retirada: '', devolucao: '' });
  const [logistica, setLogistica] = useState({ tipo: 'retirada', endereco: '', cidade: '', frete: 0 });
  const [desconto, setDesconto] = useState(0);

  // --- CARREGAR DADOS ---
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [snapCli, snapEst] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "estoque"))
        ]);
        setClientes(snapCli.docs.map(d => ({ id: d.id, ...d.data() })));
        setEstoque(snapEst.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao carregar:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  // --- LÓGICA DE CATEGORIAS ---
  // Extrai todas as categorias únicas do estoque
  const categoriasUnicas = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];

  const addCarrinho = (item) => {
    const precoItem = Number(item.financeiro?.valorAluguel || 0);
    const existe = carrinho.find(i => i.id === item.id);
    if (existe) {
      setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setCarrinho([...carrinho, { ...item, qtd: 1, preco: precoItem }]);
    }
  };

  const calcularTotal = () => {
    const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const total = subtotal + Number(logistica.frete) - Number(desconto);
    return { subtotal, total };
  };

  const handleSalvar = async (status) => {
    if (!clienteSelecionado || !datas.retirada) return alert("Preencha cliente e data!");
    try {
      const coll = collection(db, "locacoes");
      const snap = await getCountFromServer(coll);
      const count = snap.data().count + 1;
      const codigo = `${new Date().getFullYear()}-${count.toString().padStart(3, '0')}`;
      const nomeCliente = clientes.find(c => c.id === clienteSelecionado)?.nome || 'Cliente';

      await addDoc(coll, {
        numeroPedido: codigo,
        clienteId: clienteSelecionado,
        clienteNome: nomeCliente,
        dataRetirada: datas.retirada,
        dataDevolucao: datas.devolucao,
        itens: carrinho,
        logistica,
        desconto: Number(desconto),
        valorTotal: calcularTotal().total,
        status,
        criadoEm: new Date()
      });
      alert(`Pedido ${codigo} salvo!`);
      navigate('/locacoes');
    } catch (e) { alert("Erro ao salvar."); }
  };

  // --- FILTRO DO CATÁLOGO ---
  const itensFiltrados = estoque.filter(item => {
    const matchesBusca = (item.nome || '').toLowerCase().includes(busca.toLowerCase());
    const matchesCategoria = filtroCategoria === 'Todos' || item.categoria === filtroCategoria;
    return matchesBusca && matchesCategoria;
  });

  if (loading) return <div className="loading-v3">Carregando...</div>;

  return (
    <div className="pag-nova-locacao-v3">
      <header className="header-v3">
        <button className="btn-voltar-v3" onClick={() => navigate('/locacoes')}>← Voltar</button>
        <h2>Nova Locação</h2>
      </header>

      <div className="grid-v3">
        <div className="col-principal-v3">
          {/* DADOS E LOGÍSTICA */}
          <div className="card-v3">
            <h3>👤 Cliente e Datas</h3>
            <div className="form-row-v3">
              <div className="input-group-v3 flex-2">
                <label>Cliente</label>
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)}>
                  <option value="">Selecione...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="input-group-v3"><label>Retirada</label><input type="date" value={datas.retirada} onChange={e => setDatas({...datas, retirada: e.target.value})} /></div>
              <div className="input-group-v3"><label>Devolução</label><input type="date" value={datas.devolucao} onChange={e => setDatas({...datas, devolucao: e.target.value})} /></div>
            </div>
          </div>

          <div className="card-v3">
            <h3>🚚 Logística</h3>
            <div className="form-row-v3">
              <div className="input-group-v3">
                <label>Tipo</label>
                <select value={logistica.tipo} onChange={e => setLogistica({...logistica, tipo: e.target.value, frete: e.target.value === 'retirada' ? 0 : logistica.frete})}>
                  <option value="retirada">Retirada na Loja</option>
                  <option value="entrega">Entrega (Frete)</option>
                </select>
              </div>
              {logistica.tipo === 'entrega' && (
                <>
                  <div className="input-group-v3 flex-2"><label>Endereço</label><input type="text" value={logistica.endereco} onChange={e => setLogistica({...logistica, endereco: e.target.value})} /></div>
                  <div className="input-group-v3"><label>Valor Frete</label><input type="number" value={logistica.frete} onChange={e => setLogistica({...logistica, frete: e.target.value})} /></div>
                </>
              )}
            </div>
          </div>

          {/* TABELA DE ITENS */}
          <div className="card-v3">
            <div className="topo-itens-v3">
              <h3>📦 Itens do Pedido</h3>
              <button className="btn-abrir-modal-v3" onClick={() => setModalAberto(true)}>+ SELECIONAR PEÇAS</button>
            </div>
            <table className="tabela-itens-v3">
              <thead><tr><th>Produto</th><th className="centro">Qtd</th><th className="direita">Total</th><th></th></tr></thead>
              <tbody>
                {carrinho.map(item => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td className="centro">
                      <div className="qty-control-v3">
                        <button onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: Math.max(1, i.qtd-1)} : i))}>-</button>
                        <span>{item.qtd}</span>
                        <button onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: i.qtd+1} : i))}>+</button>
                      </div>
                    </td>
                    <td className="direita">R$ {(item.preco * item.qtd).toFixed(2)}</td>
                    <td className="centro"><button className="btn-remover-v3" onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FINANCEIRO LATERAL */}
        <aside className="col-lateral-v3">
          <div className="card-v3 sticky-v3">
            <h3>💰 Financeiro</h3>
            <div className="lin-resumo-v3"><span>Subtotal Itens</span> <span>R$ {calcularTotal().subtotal.toFixed(2)}</span></div>
            <div className="lin-resumo-v3"><span>Frete</span> <span>+ R$ {Number(logistica.frete).toFixed(2)}</span></div>
            <div className="lin-resumo-v3"><span>Desconto</span> <input type="number" value={desconto} onChange={e => setDesconto(e.target.value)} /></div>
            <div className="total-destaque-v3">R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            <button className="btn-confirmar-v3" onClick={() => handleSalvar('confirmado')}>✔ CONFIRMAR</button>
            <button className="btn-orcamento-v3" onClick={() => handleSalvar('orcamento')}>💾 ORÇAMENTO</button>
          </div>
        </aside>
      </div>

      {/* MODAL COM CATEGORIAS */}
      {modalAberto && (
        <div className="modal-overlay-v3">
          <div className="modal-content-v3">
            <div className="modal-header-v3">
              <h3>Catálogo de Peças</h3>
              <button onClick={() => setModalAberto(false)}>X</button>
            </div>
            
            <input className="modal-busca-v3" placeholder="Pesquisar..." value={busca} onChange={e => setBusca(e.target.value)} />
            
            {/* BARRA DE CATEGORIAS */}
            <div className="modal-categorias-v3">
              {categoriasUnicas.map(cat => (
                <button 
                  key={cat} 
                  className={`btn-cat-v3 ${filtroCategoria === cat ? 'ativo' : ''}`}
                  onClick={() => setFiltroCategoria(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="modal-grid-v3">
              {itensFiltrados.map(item => (
                <div key={item.id} className="item-modal-card-v3" onClick={() => addCarrinho(item)}>
                  {item.foto ? <img src={item.foto} alt="" /> : <div className="no-img-v3">📷</div>}
                  <div className="info-item-v3">
                    <b>{item.nome}</b>
                    <small>{item.categoria}</small>
                    <span>R$ {item.financeiro?.valorAluguel || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovaLocacao;