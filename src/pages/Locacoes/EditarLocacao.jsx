import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './EditarLocacao.css'; 
import { db } from '../../firebaseConfig';
import { collection, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore'; 

const EditarLocacao = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Estados
  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState('');
  
  // Dados do Pedido
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [datas, setDatas] = useState({ retirada: '', devolucao: '' });
  const [logistica, setLogistica] = useState({ tipo: 'retirada', endereco: '', frete: 0 });
  const [desconto, setDesconto] = useState(0);
  const [numeroPedido, setNumeroPedido] = useState('...'); // Estado para o título

  // Carregar tudo
  useEffect(() => {
    const load = async () => {
      try {
        const c = await getDocs(collection(db, "clientes"));
        setClientes(c.docs.map(d=>({id:d.id, ...d.data()})));
        const e = await getDocs(collection(db, "estoque"));
        setEstoque(e.docs.map(d=>({id:d.id, ...d.data()})));

        if(id) {
          const docSnap = await getDoc(doc(db, "locacoes", id));
          if(docSnap.exists()) {
            const data = docSnap.data();
            // Preenche os estados
            setNumeroPedido(data.numeroPedido || 'Antigo');
            setClienteSelecionado(data.clienteId);
            setDatas({ retirada: data.dataRetirada||'', devolucao: data.dataDevolucao||'' });
            setCarrinho(data.itens || []);
            setLogistica(data.logistica || { tipo: 'retirada', endereco: '', frete: 0 });
            setDesconto(data.desconto || 0);
          }
        }
      } catch(e) { console.error(e); }
    };
    load();
  }, [id]);

  const addCarrinho = (item) => {
    const ex = carrinho.find(i=>i.id===item.id);
    if(ex) setCarrinho(carrinho.map(i=>i.id===item.id?{...i, qtd:i.qtd+1}:i));
    else setCarrinho([...carrinho, {...item, qtd:1, preco: Number(item.financeiro?.valorAluguel||0)}]);
  };

  const totais = () => {
      const sub = carrinho.reduce((a,b)=>a+(b.preco*b.qtd),0);
      return { sub, total: sub + Number(logistica.frete) - Number(desconto) };
  };

  const atualizar = async (st) => {
      try {
          await updateDoc(doc(db, "locacoes", id), {
              clienteId: clienteSelecionado,
              clienteNome: clientes.find(c=>c.id===clienteSelecionado)?.nome,
              dataRetirada: datas.retirada,
              dataDevolucao: datas.devolucao,
              itens: carrinho,
              logistica,
              desconto,
              valorTotal: totais().total,
              status: st,
              atualizadoEm: new Date()
          });
          alert("Atualizado com sucesso!");
          navigate('/locacoes');
      } catch(e) { alert("Erro ao atualizar"); }
  };

  const itensFiltrados = estoque.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="page-editar-locacao">
      <header className="header-edit">
        <div className="titulo-edit">
            <button onClick={()=>navigate('/locacoes')}>← Voltar</button>
            <h2>Editar Pedido <span style={{color:'#2563eb'}}>#{numeroPedido}</span></h2>
        </div>
      </header>

      <div className="grid-edit">
        {/* Esquerda */}
        <div className="col-conteudo">
          <div className="card-edit">
            <h3>👤 Dados Principais</h3>
            <select value={clienteSelecionado} onChange={e=>setClienteSelecionado(e.target.value)}>
                <option value="">Selecione...</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="row-dates">
                <input type="date" value={datas.retirada} onChange={e=>setDatas({...datas, retirada:e.target.value})} />
                <input type="date" value={datas.devolucao} onChange={e=>setDatas({...datas, devolucao:e.target.value})} />
            </div>
          </div>

          <div className="card-edit">
            <div className="top-itens">
                <h3>📦 Itens ({carrinho.length})</h3>
                <button onClick={()=>setModalAberto(true)}>+ Adicionar</button>
            </div>
            {carrinho.map(item => (
                <div key={item.id} className="row-item-edit">
                    <span>{item.nome}</span>
                    <div className="ctrl-qtd">
                         <button onClick={()=>setCarrinho(carrinho.map(i=>i.id===item.id?{...i, qtd:Math.max(1, i.qtd-1)}:i))}>-</button>
                         <span>{item.qtd}</span>
                         <button onClick={()=>setCarrinho(carrinho.map(i=>i.id===item.id?{...i, qtd:i.qtd+1}:i))}>+</button>
                    </div>
                    <span>R$ {item.preco * item.qtd}</span>
                    <button className="del-btn" onClick={()=>setCarrinho(carrinho.filter(i=>i.id!==item.id))}>×</button>
                </div>
            ))}
          </div>
        </div>

        {/* Direita */}
        <div className="col-sidebar">
          <div className="card-edit">
            <h3>💰 Financeiro</h3>
            <div className="line-res"><span>Subtotal</span> <span>R$ {totais().subtotal}</span></div>
            <div className="line-res"><span>Frete</span> <input type="number" value={logistica.frete} onChange={e=>setLogistica({...logistica, frete:e.target.value})} /></div>
            <div className="line-res"><span>Desconto</span> <input type="number" value={desconto} onChange={e=>setDesconto(e.target.value)} /></div>
            <div className="total-big-edit">R$ {totais().total.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
            
            <button className="btn-save-edit" onClick={()=>atualizar('confirmado')}>💾 SALVAR ALTERAÇÕES</button>
            <button className="btn-back-orc" onClick={()=>atualizar('orcamento')}>VOLTAR P/ ORÇAMENTO</button>
          </div>
        </div>
      </div>

      {/* Modal Simples */}
      {modalAberto && (
        <div className="modal-overlay-edit">
            <div className="modal-box-edit">
                <div className="modal-h"><h3>Adicionar</h3> <button onClick={()=>setModalAberto(false)}>X</button></div>
                <input placeholder="Buscar..." onChange={e=>setBusca(e.target.value)} className="inp-busca"/>
                <div className="grid-prods">
                    {itensFiltrados.map(i => (
                        <div key={i.id} className="prod-card" onClick={()=>addCarrinho(i)}>
                            <b>{i.nome}</b><br/>R$ {i.financeiro?.valorAluguel}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default EditarLocacao;