import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig"; 
import { collection, addDoc, serverTimestamp, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import "./NovaCompra.css"; 

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
          
          let valFormatado = "";
          if (d.valorEstimado) {
            valFormatado = Number(d.valorEstimado).toFixed(2).replace('.', ',');
          }

          setForm({
            ...d, 
            valorEstimado: valFormatado
          });
          setModoVinculo(d.vinculoTipo || 'estoque');
        }
      });
    }
  }, [id]);

  const maskCurrency = (value) => {
    let v = value.replace(/\D/g, ""); 
    if (!v) return "";
    v = (v / 100).toFixed(2) + ""; 
    v = v.replace(".", ","); 
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); 
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    return v;
  };

  const handleValorChange = (e) => {
    setForm({ ...form, valorEstimado: maskCurrency(e.target.value) });
  };

  const abrirBuscaPedidos = async () => {
    setModoVinculo('pedido');
    const snap = await getDocs(collection(db, "locacoes"));
    
    setListaBusca(snap.docs.map(d => {
      const data = d.data();
      let displayNome = "Sem Nome";

      const temaFesta = data.tema || data.evento || data.tipoEvento || data.titulo || "";
      const clienteFesta = data.clienteNome || data.nomeCliente || data.cliente || data.nome || "";
      const dataFesta = data.dataRetirada || data.dataEvento || data.dataInicio || data.data || "";

      if (temaFesta && clienteFesta) {
        displayNome = `${temaFesta} - ${clienteFesta}`;
      } else if (temaFesta) {
        displayNome = temaFesta;
      } else if (clienteFesta) {
        displayNome = `Pedido de ${clienteFesta}`;
      } else {
        displayNome = `Pedido #${data.numeroPedido || d.id.substring(0,5).toUpperCase()}`; 
      }

      if (dataFesta) {
        displayNome += ` (${dataFesta.split('-').reverse().join('/')})`;
      }

      return { id: d.id, nome: displayNome };
    }));
    
    setModalBusca(true);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();

    let valorNumerico = 0;
    if (form.valorEstimado) {
      valorNumerico = Number(form.valorEstimado.replace(/\./g, "").replace(",", "."));
    }

    const dados = {
      ...form,
      quantidade: Number(form.quantidade),
      valorEstimado: valorNumerico,
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
    <div className="page-container">
      
      <div className="page-header">
        <div className="header-text">
          <h1 className="page-title">{id ? "EDITAR SOLICITAÇÃO" : "NOVA SOLICITAÇÃO DE COMPRA"}</h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>Preencha os dados do que precisa ser adquirido para a empresa.</p>
        </div>
      </div>

      <div className="form-widescreen">
        <form onSubmit={handleSalvar} className="estoque-form-layout">
          
          <div className="left-photo-col" style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 className="section-divider" style={{marginTop: 0}}>🛍️ O QUE COMPRAR?</h3>
            
            <div className="form-group span-4" style={{ marginBottom: '20px' }}>
              <label>NOME DO ITEM / PRODUTO *</label>
              <input 
                type="text" 
                placeholder="Ex: Tinta Spray Dourada..."
                value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
              />
            </div>

            <div className="form-grid-4" style={{ marginBottom: '30px' }}>
              <div className="form-group span-2">
                <label>QUANTIDADE *</label>
                <input 
                  type="number" 
                  value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} min="1" required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                />
              </div>
              <div className="form-group span-2">
                <label>VALOR UNITÁRIO EST. (R$)</label>
                <input 
                  type="text" 
                  placeholder="0,00"
                  value={form.valorEstimado} onChange={handleValorChange}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                />
              </div>
            </div>

            <h3 className="section-divider">📂 CATEGORIA DO ITEM</h3>
            <div className="custom-radio-group">
              <div 
                className={`custom-radio-card ${form.categoria === 'material' ? 'selected' : ''}`} 
                onClick={() => setForm({...form, categoria: 'material'})}
              >
                <strong>Material de Consumo</strong>
                <span>Acaba no uso (Bexigas, Fitas)</span>
              </div>
              <div 
                className={`custom-radio-card ${form.categoria === 'acervo' ? 'selected' : ''}`} 
                onClick={() => setForm({...form, categoria: 'acervo'})}
              >
                <strong>Acervo / Permanente</strong>
                <span>Fica na empresa (Móveis)</span>
              </div>
            </div>
          </div>

          <div className="right-data-col" style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            
            <h3 className="section-divider" style={{marginTop: 0}}>🔗 DESTINO DA COMPRA</h3>
            
            <div className="tabs-container" style={{ marginBottom: '20px', borderBottom: '2px solid #f1f5f9', display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className={`tab-btn ${modoVinculo === 'estoque' ? 'active' : ''}`}
                onClick={() => {setModoVinculo('estoque'); setForm({...form, vinculoTexto: "", vinculoId: ""})}}
                style={{ flex: 1, padding: '12px', fontWeight: 'bold' }}
              >
                📦 P/ Estoque Geral
              </button>
              <button 
                type="button" 
                className={`tab-btn ${modoVinculo === 'pedido' ? 'active' : ''}`}
                onClick={abrirBuscaPedidos}
                style={{ flex: 1, padding: '12px', fontWeight: 'bold' }}
              >
                🎉 P/ Pedido Específico
              </button>
            </div>

            {form.vinculoTexto && modoVinculo === 'pedido' && (
              <div className="vinculo-selecionado" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
                ✅ Vinculado ao: <strong>{form.vinculoTexto}</strong>
              </div>
            )}

            <h3 className="section-divider" style={{ marginTop: '20px' }}>📅 PRAZOS E FORNECEDOR</h3>
            
            <div className="form-grid-4">
              <div className="form-group span-2">
                <label>DATA LIMITE PARA CHEGAR</label>
                <input 
                  type="date" 
                  value={form.prazo} onChange={e => setForm({...form, prazo: e.target.value})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                />
              </div>
              <div className="form-group span-2">
                <label>FORNECEDOR (NOME OU LINK)</label>
                <input 
                  type="text" 
                  value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                />
              </div>
              <div className="form-group span-4" style={{marginTop: '15px'}}>
                <label>OBSERVAÇÕES (COR, TAMANHO, ETC)</label>
                <textarea 
                  rows="3" 
                  value={form.obs} onChange={e => setForm({...form, obs: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', resize: 'vertical' }}
                ></textarea>
              </div>
            </div>

            <div className="form-actions mt-compact" style={{ marginTop: '40px' }}>
              <button type="button" className="btn-voltar" onClick={() => navigate("/compras")}>Cancelar</button>
              <button type="submit" className="btn-salvar">Salvar Solicitação</button>
            </div>

          </div>
        </form>
      </div>

      {modalBusca && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '600px', width: '90%' }}>
            <h3>Selecione o Pedido / Evento</h3>
            <p style={{color: '#64748b', fontSize: '0.85rem', marginTop: '-10px', marginBottom: '15px'}}>Escolha para qual festa este item está sendo comprado.</p>
            
            <div className="modal-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {listaBusca.map(item => (
                <div 
                  key={item.id} 
                  className="modal-item" 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f1f5f9' }}
                >
                    <div 
                      onClick={() => {setForm({...form, vinculoId: item.id, vinculoTexto: item.nome}); setModalBusca(false)}} 
                      style={{ flex: 1, cursor: 'pointer', fontWeight: '600', color: '#0f172a' }}
                    >
                      {item.nome}
                    </div>

                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); 
                        // 🌟 MUDANÇA AQUI: Navega na mesma tela, mas avisa para não perder dados à toa 🌟
                        if(window.confirm("Sair dessa tela para conferir o pedido fará você perder os dados não salvos desta compra. Deseja continuar?")) {
                           navigate(`/locacoes/editar/${item.id}`);
                        }
                      }}
                      style={{
                        background: '#f8fafc', color: '#3b82f6', border: '1px solid #cbd5e1', 
                        padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', 
                        fontWeight: 'bold', cursor: 'pointer', marginLeft: '15px',
                        display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#eff6ff'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
                      title="Navegar para os detalhes do pedido"
                    >
                      👁️ Conferir Pedido
                    </button>
                </div>
                ))}
                {listaBusca.length === 0 && <p style={{textAlign:'center', color: '#94a3b8', padding: '20px'}}>Nenhum pedido encontrado.</p>}
            </div>
            <button className="btn-voltar" onClick={() => setModalBusca(false)} style={{width: '100%', marginTop: '15px', padding: '12px'}}>Cancelar e Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovaCompra;