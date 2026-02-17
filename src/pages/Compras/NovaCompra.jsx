import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig"; 
import { collection, addDoc, serverTimestamp, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import "./NovaCompra.css"; // É AQUI QUE O ARQUIVO CSS É CHAMADO

const NovaCompra = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [form, setForm] = useState({
    nome: "", quantidade: 1, valorEstimado: "", categoria: "material", 
    vinculoId: "", vinculoTexto: "", prazo: "", fornecedor: "", urgente: false, obs: ""
  });

  const [modoVinculo, setModoVinculo] = useState("estoque");
  const [modalBusca, setModalBusca] = useState(false);
  const [listaBusca, setListaBusca] = useState([]);

  useEffect(() => {
    if (id) {
      getDoc(doc(db, "lista_compras", id)).then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          setForm(d);
          setModoVinculo(d.vinculoTipo || 'estoque');
        }
      });
    }
  }, [id]);

  const abrirBusca = async (modo) => {
    setModoVinculo(modo);
    const colecao = modo === 'pedido' ? "locacoes" : "clientes";
    const snap = await getDocs(collection(db, colecao));
    setListaBusca(snap.docs.map(d => ({ 
        id: d.id, 
        nome: d.data().cliente || d.data().nome || "Sem Nome" 
    })));
    setModalBusca(true);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    const dados = {
      ...form,
      quantidade: Number(form.quantidade),
      valorEstimado: Number(form.valorEstimado),
      vinculoTipo: modoVinculo,
      vinculo: modoVinculo === 'estoque' ? "Estoque Geral" : form.vinculoTexto,
    };

    if (id) {
      await updateDoc(doc(db, "lista_compras", id), dados);
    } else {
      await addDoc(collection(db, "lista_compras"), { ...dados, status: "pendente", createdAt: serverTimestamp() });
    }
    navigate("/compras");
  };

  return (
    <div className="nova-compra-container">
      <div className="page-header">
        <button className="btn-voltar" onClick={() => navigate("/compras")}>← Voltar</button>
        <h1>{id ? "Editar Compra" : "Nova Solicitação"}</h1>
      </div>

      <form className="form-card" onSubmit={handleSalvar}>
        <div className="form-body">
          
          <div className="section-title"><span>🛍️</span> O que precisamos comprar?</div>
          <div className="form-group">
            <label>Nome do Item / Produto</label>
            <input 
              type="text" className="form-input" 
              placeholder="Ex: Tinta Spray Dourada..."
              value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required 
            />
          </div>

          <div className="form-row">
            <div className="form-group form-half">
              <label>Quantidade</label>
              <input type="number" className="form-input" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} />
            </div>
            <div className="form-group form-half">
              <label>Valor Unitário (R$)</label>
              <input type="number" className="form-input" value={form.valorEstimado} onChange={e => setForm({...form, valorEstimado: e.target.value})} step="0.01" />
            </div>
          </div>

          <div className="section-title"><span>📂</span> Categoria do Item</div>
          <div className="radio-group">
            <div 
              className={`radio-card ${form.categoria === 'material' ? 'selected' : ''}`} 
              onClick={() => setForm({...form, categoria: 'material'})}
            >
              <strong>Material de Consumo</strong>
              <small>Acaba no uso (Bexigas, Fitas)</small>
            </div>
            <div 
              className={`radio-card ${form.categoria === 'acervo' ? 'selected' : ''}`} 
              onClick={() => setForm({...form, categoria: 'acervo'})}
            >
              <strong>Acervo / Permanente</strong>
              <small>Fica na empresa (Móveis)</small>
            </div>
          </div>

          <div className="section-title"><span>🔗</span> Destino da Compra</div>
          <div className="vinculo-tabs">
            <button type="button" className={modoVinculo === 'estoque' ? 'active' : ''} onClick={() => {setModoVinculo('estoque'); setForm({...form, vinculoTexto: ""})}}>Estoque Geral</button>
            <button type="button" className={modoVinculo === 'pedido' ? 'active' : ''} onClick={() => abrirBusca('pedido')}>Buscar Pedido</button>
            <button type="button" className={modoVinculo === 'cliente' ? 'active' : ''} onClick={() => abrirBusca('cliente')}>Buscar Cliente</button>
          </div>
          
          {form.vinculoTexto && (
            <div style={{padding: '10px', background: '#ecfdf5', color: '#047857', borderRadius: '8px', marginTop: '10px', fontWeight: 'bold'}}>
              Selecionado: {form.vinculoTexto}
            </div>
          )}

          <div className="section-title"><span>📅</span> Prazos e Fornecedor</div>
          <div className="form-row">
            <div className="form-group form-half">
              <label>Data Limite</label>
              <input type="date" className="form-input" value={form.prazo} onChange={e => setForm({...form, prazo: e.target.value})} />
            </div>
            <div className="form-group form-half">
              <label>Fornecedor (Link/Nome)</label>
              <input type="text" className="form-input" value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} />
            </div>
          </div>

          <div className="form-footer">
            <button type="button" className="btn-cancelar" onClick={() => navigate("/compras")}>Cancelar</button>
            <button type="submit" className="btn-salvar">Salvar Solicitação</button>
          </div>
        </div>
      </form>

      {/* MODAL DE BUSCA */}
      {modalBusca && (
        <div className="modal-busca-overlay">
          <div className="modal-busca-box">
            <h3 style={{margin: '0 0 15px 0'}}>Selecionar {modoVinculo === 'pedido' ? 'Pedido' : 'Cliente'}</h3>
            <div className="lista-selecao">
                {listaBusca.map(item => (
                <div key={item.id} className="item-selecao" onClick={() => {setForm({...form, vinculoId: item.id, vinculoTexto: item.nome}); setModalBusca(false)}}>
                    {item.nome}
                </div>
                ))}
            </div>
            <button onClick={() => setModalBusca(false)} style={{padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovaCompra;