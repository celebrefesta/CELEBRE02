import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig"; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Compras.css";

const Compras = () => {
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [totais, setTotais] = useState({ pendente: 0, urgente: 0, realizado: 0 });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [loading, setLoading] = useState(true);

  // --- 1. BUSCAR DADOS EM TEMPO REAL ---
  useEffect(() => {
    const q = query(collection(db, "lista_compras"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItens(lista);

      // --- CÁLCULOS DOS CARDS ---
      let p = 0; // Pendente
      let u = 0; // Urgente
      let r = 0; // Realizado
      const hoje = new Date().toISOString().split('T')[0];

      lista.forEach(item => {
        // CÁLCULO CORRIGIDO: Multiplica Quantidade pelo Valor Unitário
        const qtd = Number(item.quantidade) || 1;
        const valorUnit = Number(item.valorEstimado) || 0;
        const subtotal = qtd * valorUnit;
        
        if (item.status === "comprado") {
          r += subtotal;
        } else {
          p += subtotal;
          // Se for pendente e a data já passou ou é hoje, conta como urgente
          if (item.prazo && item.prazo <= hoje) u++;
        }
      });

      setTotais({ pendente: p, urgente: u, realizado: r });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 2. ALTERAR STATUS (MARCAR COMO COMPRADO) ---
  const toggleCheck = async (item) => {
    try {
      const novoStatus = item.status === "pendente" ? "comprado" : "pendente";
      const itemRef = doc(db, "lista_compras", item.id);
      await updateDoc(itemRef, { status: novoStatus });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  // --- 3. EXCLUIR ITEM ---
  const handleExcluir = async (id) => {
    if (window.confirm("Tem certeza que deseja remover este item da lista?")) {
      try {
        await deleteDoc(doc(db, "lista_compras", id));
      } catch (error) {
        alert("Erro ao excluir item.");
      }
    }
  };

  // --- 4. FILTRAGEM ---
  const itensFiltrados = itens.filter(item => {
    if (filtroStatus === "todos") return true;
    return item.status === filtroStatus;
  });

  return (
    <div className="compras-container">
      
      {/* HEADER PRINCIPAL */}
      <div className="header-top">
        <div>
          <h1>Lista de Compras</h1>
          <p>Gerencie aquisições vinculadas aos pedidos e ao acervo da Ágape Decorações.</p>
        </div>
        {/* Navega para a página de formulário */}
        <button className="btn-add" onClick={() => navigate("/compras/nova")}>
          <span>+</span> Adicionar Item
        </button>
      </div>

      {/* CARDS DE RESUMO (DASHBOARD) */}
      <div className="resumo-grid">
        <div className="card-resumo card-laranja">
          <div className="card-info">
            <label>ORÇAMENTO PENDENTE</label>
            <h2>R$ {totais.pendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            <p>Estimado para as próximas festas</p>
          </div>
          <div className="card-icon">📂</div>
        </div>

        <div className="card-resumo card-vermelho">
          <div className="card-info">
            <label>ITENS URGENTES</label>
            <h2>{totais.urgente}</h2>
            <p style={{color: '#ef4444', fontWeight: 'bold'}}>Comprar imediatamente</p>
          </div>
          <div className="card-icon">🚨</div>
        </div>

        <div className="card-resumo card-verde">
          <div className="card-info">
            <label>REALIZADO (MÊS)</label>
            <h2>R$ {totais.realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            <p style={{color: '#10b981'}}>Investimento aprovado</p>
          </div>
          <div className="card-icon">✅</div>
        </div>
      </div>

      {/* FILTROS E TABELA */}
      <div className="tabela-secao">
        <div className="filtros-area">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar por item ou pedido..." />
          </div>
          
          <select 
            className="filter-select" 
            value={filtroStatus} 
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="todos">Status: Todos</option>
            <option value="pendente">Status: Pendentes</option>
            <option value="comprado">Status: Comprados</option>
          </select>
        </div>

        <div className="tabela-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{width: '50px'}}></th>
                <th>ITEM & VÍNCULO</th>
                <th>QTD.</th>
                <th>VALOR TOTAL</th>
                <th>STATUS</th>
                <th style={{textAlign: 'center'}}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{textAlign: "center", padding: "40px"}}>Carregando lista...</td></tr>
              ) : itensFiltrados.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum item encontrado.</td></tr>
              ) : (
                itensFiltrados.map((item) => {
                  const hojeStr = new Date().toISOString().split('T')[0];
                  const isUrgente = item.status === 'pendente' && item.prazo <= hojeStr;
                  const subtotal = (Number(item.quantidade) || 1) * (Number(item.valorEstimado) || 0);

                  return (
                    <tr key={item.id} style={{ opacity: item.status === 'comprado' ? 0.6 : 1 }}>
                      <td>
                        <div 
                          className={`item-check ${item.status === 'comprado' ? 'checked' : ''}`}
                          onClick={() => toggleCheck(item)}
                        >
                          ✓
                        </div>
                      </td>
                      <td>
                        <span className="nome-produto" style={{ textDecoration: item.status === 'comprado' ? 'line-through' : 'none' }}>
                          {item.nome}
                        </span>
                        <div className="vinculo-tag">
                          🔗 {item.vinculo || "Estoque Geral"}
                        </div>
                      </td>
                      <td>{item.quantidade}x</td>
                      <td>
                        <div className="preco-real">
                          R$ {subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </div>
                        <small style={{fontSize: '10px', color: '#94a3b8'}}>
                           R$ {Number(item.valorEstimado).toFixed(2)} un.
                        </small>
                      </td>
                      <td>
                        <span className={`badge ${item.status}`}>
                          {item.status === 'pendente' ? 'Pendente' : 'Comprado'}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                          <button className="btn-action edit" onClick={() => navigate(`/compras/editar/${item.id}`)} title="Editar">
                            ✏️
                          </button>
                          <button className="btn-action delete" onClick={() => handleExcluir(item.id)} title="Excluir">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Compras;