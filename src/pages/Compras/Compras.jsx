import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig"; 
// 🔥 IMPORTAÇÕES ADICIONADAS: where, getDocs, addDoc
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, addDoc } from "firebase/firestore";
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
        const qtd = Number(item.quantidade) || 1;
        const valorUnit = Number(item.valorEstimado) || 0;
        const subtotal = qtd * valorUnit;
        
        if (item.status === "comprado") {
          r += subtotal;
        } else {
          p += subtotal;
          if (item.prazo && item.prazo <= hoje) u++;
        }
      });

      setTotais({ pendente: p, urgente: u, realizado: r });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 2. ALTERAR STATUS & MÁGICA DO ACERVO ---
  const toggleCheck = async (item) => {
    try {
      const novoStatus = item.status === "pendente" ? "comprado" : "pendente";
      const qtdComprada = Number(item.quantidade) || 1;

      // 🔥 PASSO 1: O sistema procura no Acervo se essa peça já existe (busca pelo nome exato)
      const qEstoque = query(collection(db, "estoque"), where("nome", "==", item.nome));
      const snapshotEstoque = await getDocs(qEstoque);

      if (novoStatus === "comprado") {
        if (!snapshotEstoque.empty) {
          // 🔄 CASO A: REPOSIÇÃO (A peça já existe!)
          const docExistente = snapshotEstoque.docs[0];
          const qtdAtual = Number(docExistente.data().quantidade) || 0;
          
          await updateDoc(doc(db, "estoque", docExistente.id), {
            quantidade: qtdAtual + qtdComprada, // Soma a quantidade sem duplicar o item
            atualizadoEm: new Date().toISOString()
          });
          alert(`📦 Estoque Atualizado! Adicionamos +${qtdComprada} na peça "${item.nome}" que já existia no seu acervo.`);
        
        } else {
          // ✨ CASO B: ITEM NOVO (A peça não existe no acervo)
          // Se não for "material de consumo" (ex: bexiga), ele cria um item novo no Acervo!
          if (item.categoria !== "material") {
            await addDoc(collection(db, "estoque"), {
              nome: item.nome,
              categoria: item.categoria || "Geral",
              quantidade: qtdComprada,
              financeiro: {
                  valorAluguel: item.valorAluguel || 0
              },
              criadoEm: new Date().toISOString()
            });
            alert(`✨ Sucesso! A peça "${item.nome}" foi cadastrada como um NOVO ITEM no acervo.`);
          }
        }
      } else {
        // ↩️ CASO C: DESFAZER (O usuário clicou em Desfazer a compra)
        if (!snapshotEstoque.empty) {
          const docExistente = snapshotEstoque.docs[0];
          const qtdAtual = Number(docExistente.data().quantidade) || 0;
          const novaQtd = Math.max(0, qtdAtual - qtdComprada); // Subtrai a quantidade para corrigir
          
          await updateDoc(doc(db, "estoque", docExistente.id), {
            quantidade: novaQtd,
            atualizadoEm: new Date().toISOString()
          });
          alert(`↩️ Desfeito! A peça "${item.nome}" foi retirada do seu acervo novamente.`);
        }
      }

      // Por fim, muda a cor do botão na lista de compras
      const itemRef = doc(db, "lista_compras", item.id);
      await updateDoc(itemRef, { status: novoStatus });

    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao integrar compra com o acervo.");
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
    <div className="compras-container dashboard-container">
      
      {/* --- CABEÇALHO PADRÃO CELEBRE --- */}
      <div className="dashboard-header">
        <div className="header-text">
          <h1>LISTA DE COMPRAS</h1>
          <p>Gerencie aquisições vinculadas aos pedidos e ao acervo da Ágape Decorações.</p>
        </div>
        <button className="btn-novo-cliente" onClick={() => navigate("/compras/nova")}>
          + Adicionar Item
        </button>
      </div>

      {/* CARDS DE RESUMO (DASHBOARD) */}
      <div className="resumo-grid">
        <div className="card-resumo card-azul">
          <div className="card-info">
            <label>TOTAL NA LISTA</label>
            <h2>{itens.length}</h2>
            <p style={{color: '#3b82f6'}}>Itens cadastrados</p>
          </div>
          <div className="card-icon">🛒</div>
        </div>

        <div className="card-resumo card-laranja">
          <div className="card-info">
            <label>ORÇAMENTO PENDENTE</label>
            <h2>R$ {totais.pendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            <p>Estimado p/ compras</p>
          </div>
          <div className="card-icon">📂</div>
        </div>

        <div className="card-resumo card-vermelho">
          <div className="card-info">
            <label>ITENS URGENTES</label>
            <h2>{totais.urgente}</h2>
            <p style={{color: '#ef4444', fontWeight: 'bold'}}>Comprar hoje</p>
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
          <table className="custom-table-compras">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>ITEM & VÍNCULO</th>
                <th style={{ width: '10%' }}>QTD.</th>
                <th style={{ width: '15%' }}>VALOR TOTAL</th>
                <th style={{ width: '15%' }}>STATUS</th>
                <th style={{ width: '15%' }}>PRAZO LIMITE</th>
                <th style={{ width: '15%', textAlign: 'center' }}>AÇÕES</th>
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
                  const isUrgente = item.status === 'pendente' && item.prazo && item.prazo <= hojeStr;
                  const subtotal = (Number(item.quantidade) || 1) * (Number(item.valorEstimado) || 0);

                  return (
                    <tr key={item.id} className={item.status === 'comprado' ? 'linha-comprado' : ''}>
                      <td className="item-info-cell">
                        <span className="nome-produto" style={{ textDecoration: item.status === 'comprado' ? 'line-through' : 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.nome}
                        </span>
                        <div className="vinculo-tag" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          🔗 {item.vinculo || "Estoque Geral"}
                        </div>
                      </td>
                      
                      <td className="mobile-stack col-50 col-left">
                          <span className="mobile-label">QUANTIDADE:</span>
                          <strong>{item.quantidade}x</strong>
                      </td>
                      
                      <td className="mobile-stack col-50 col-right">
                        <span className="mobile-label">VALOR ESTIMADO:</span>
                        <div className="preco-real">
                          R$ {subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </div>
                        <small style={{fontSize: '10px', color: '#94a3b8'}}>
                           R$ {Number(item.valorEstimado).toFixed(2)} un.
                        </small>
                      </td>
                      
                      <td className="mobile-stack col-50 col-left">
                        <span className="mobile-label">STATUS:</span>
                        <span className={`badge ${item.status}`}>
                          {item.status === 'pendente' ? 'Pendente' : 'Comprado'}
                        </span>
                      </td>

                      <td className="mobile-stack col-50 col-right">
                        <span className="mobile-label">PRAZO MÁXIMO:</span>
                        {item.prazo ? (
                          <span className={`prazo-badge ${isUrgente ? 'urgente' : 'ok'}`}>
                            📅 {item.prazo.split('-').reverse().join('/')}
                            {isUrgente && <span title="Prazo esgotado!">🚨</span>}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.95rem', color: '#94a3b8', fontStyle: 'italic' }}>Sem prazo</span>
                        )}
                      </td>

                      <td className="actions-cell">
                        <div className="botoes-acao-container">
                          <button 
                            onClick={() => toggleCheck(item)}
                            className={`btn-toggle-compra ${item.status === 'pendente' ? 'pendente' : 'comprado'}`}
                          >
                            {item.status === 'pendente' ? '✅ Já Comprei' : '↩ Desfazer'}
                          </button>

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