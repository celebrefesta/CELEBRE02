import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig"; 
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth"; // 🔥 Importação do Cadeado de Segurança
import "./Compras.css";

const Compras = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [itens, setItens] = useState([]);
  const [totais, setTotais] = useState({ pendente: 0, urgente: 0, realizado: 0 });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState('');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('Data'); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS as compras da sua conta
    const q = query(collection(db, "lista_compras"), where("userId", "==", usuarioLogado.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordena em memória por data mais recente (evita erro de índice no banco de dados)
      lista.sort((a, b) => {
         const dataA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
         const dataB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
         return dataB - dataA;
      });

      setItens(lista);

      let p = 0; 
      let u = 0; 
      let r = 0; 
      
      const hoje = new Date();
      hoje.setHours(0,0,0,0);

      lista.forEach(item => {
        const qtd = Number(item.quantidade) || 1;
        const valorUnit = Number(item.valorEstimado) || 0;
        const subtotal = qtd * valorUnit;
        
        if (item.status === "comprado" || item.status === "chegou") {
          r += subtotal; 
        } else {
          p += subtotal; 
          
          if (item.prazo && item.vinculoTipo === 'pedido') {
            const dataPrazo = new Date(item.prazo + 'T00:00:00');
            const diffTime = dataPrazo.getTime() - hoje.getTime();
            const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDias <= 5) u++; 
          }
        }
      });

      setTotais({ pendente: p, urgente: u, realizado: r });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [usuarioLogado, navigate]);

  const handleStatusChange = async (item, novoStatus) => {
    try {
      // 🔥 BLINDAGEM NO ESTOQUE: Procura a peça, mas APENAS no SEU estoque, para não misturar com o de outras pessoas!
      const qEstoque = query(collection(db, "estoque"), where("userId", "==", usuarioLogado.uid), where("nome", "==", item.nome));
      const snapshotEstoque = await getDocs(qEstoque);
      const qtdComprada = Number(item.quantidade) || 1;

      let updatePayload = { status: novoStatus };

      if (novoStatus === 'chegou') {
        
        if (!snapshotEstoque.empty) {
          updatePayload.dataChegada = new Date().toISOString();
          const itemRef = doc(db, "lista_compras", item.id);
          await updateDoc(itemRef, updatePayload);

          const docExistente = snapshotEstoque.docs[0];
          const qtdAtual = Number(docExistente.data().quantidade) || 0;
          
          await updateDoc(doc(db, "estoque", docExistente.id), {
            quantidade: qtdAtual + (item.formato === 'kit' && item.quantidadePecasKit ? item.quantidadePecasKit : qtdComprada),
            atualizadoEm: new Date().toISOString()
          });
          
          alert(`📦 Caixa recebida!\n\nA peça "${item.nome}" já existe no seu acervo. A quantidade no estoque foi somada automaticamente!`);
        } else {
          if (item.categoria === "material") {
             updatePayload.dataChegada = new Date().toISOString();
             const itemRef = doc(db, "lista_compras", item.id);
             await updateDoc(itemRef, updatePayload);
             alert(`📦 Material de consumo recebido e baixado da lista!`);
          } else {
             const querCadastrarAgora = window.confirm(`✨ A caixa de "${item.nome}" chegou!\n\nMas atenção: Como é uma peça INÉDITA, ela só vai constar como "No Acervo" após você preencher a foto e os detalhes dela.\n\nDeseja ir para a tela de Cadastro de Estoque AGORA?`);
             if (querCadastrarAgora) {
                 navigate('/cadastro-estoque', { state: { dadosCompra: item } });
             }
             return;
          }
        }
      } 
      else if (novoStatus === 'pendente') {
        updatePayload.dataCompra = null;
        updatePayload.dataChegada = null;

        if (item.status === 'chegou' && !snapshotEstoque.empty) {
          const docExistente = snapshotEstoque.docs[0];
          const qtdAtual = Number(docExistente.data().quantidade) || 0;
          const qtdRemover = item.formato === 'kit' && item.quantidadePecasKit ? item.quantidadePecasKit : qtdComprada;
          const novaQtd = Math.max(0, qtdAtual - qtdRemover); 
          
          await updateDoc(doc(db, "estoque", docExistente.id), {
            quantidade: novaQtd,
            atualizadoEm: new Date().toISOString()
          });
        }
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);
      }
      else if (novoStatus === 'comprado') {
        updatePayload.dataCompra = new Date().toISOString();
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);
        alert(`🛒 Maravilha! A compra foi registrada. O sistema vai rastrear a entrega a partir de hoje.`);
      }

    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro na operação.");
    }
  };

  const handleExcluir = async (id) => {
    if (window.confirm("Tem certeza que deseja remover este item da lista?")) {
      try {
        await deleteDoc(doc(db, "lista_compras", id));
      } catch (error) { 
        alert("Erro ao excluir item."); 
      }
    }
  };

  let itensFiltrados = itens.filter(item => {
    const termo = busca.toLowerCase();
    const matchBusca = (item.nome || '').toLowerCase().includes(termo) || (item.vinculo || '').toLowerCase().includes(termo);
    const matchStatus = filtroStatus === "todos" ? true : item.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  itensFiltrados.sort((a, b) => {
      if (ordemAlfabetica === 'A-Z') return (a.nome || '').localeCompare(b.nome || '');
      if (ordemAlfabetica === 'Z-A') return (b.nome || '').localeCompare(a.nome || '');
      return 0; 
  });

  const alternarOrdem = () => {
      setOrdemAlfabetica(prev => prev === 'Data' ? 'A-Z' : prev === 'A-Z' ? 'Z-A' : 'Data');
  };

  return (
    <div className="compras-container dashboard-container">
      
      <div className="dashboard-header">
        <div className="header-text">
          <h1>LISTA DE COMPRAS</h1>
          <p>Gerencie aquisições vinculadas aos pedidos e ao acervo.</p>
        </div>
        <button className="btn-novo-cliente" onClick={() => navigate("/compras/nova")}>
          + Adicionar Item
        </button>
      </div>

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
            <label>ITENS EM ALERTA</label>
            <h2>{totais.urgente}</h2>
            <p style={{color: '#ef4444', fontWeight: 'bold'}}>Perto do prazo limite</p>
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

      <div className="tabela-secao">
        <div className="filtros-area">
          <div className="search-box-container">
            <span className="search-icon">🔍</span>
            <input type="text" className="search-input" placeholder="Buscar por item ou pedido..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <button className="btn-ordem" onClick={alternarOrdem} title="Mudar Ordem">
              {ordemAlfabetica === 'A-Z' ? '⬇️ A - Z' : ordemAlfabetica === 'Z-A' ? '⬆️ Z - A' : '📅 Recentes'}
          </button>
          
          <div className="filter-select-container">
            <select className="filter-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">📊 Status: Todos</option>
              <option value="pendente">⏳ Falta Comprar</option>
              <option value="comprado">🚚 A Caminho</option>
              <option value="chegou">📦 No Acervo</option>
            </select>
          </div>
        </div>

        <div className="tabela-wrapper">
          <table className="custom-table-compras">
            <thead>
              <tr>
                <th>ITEM & VÍNCULO</th>
                <th>QTD.</th>
                <th>VALOR TOTAL</th>
                <th>STATUS</th>
                <th>LOGÍSTICA</th>
                <th style={{ textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{textAlign: "center", padding: "40px"}}>Carregando lista...</td></tr>
              ) : itensFiltrados.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum item encontrado.</td></tr>
              ) : (
                itensFiltrados.map((item) => {
                  const subtotal = (Number(item.quantidade) || 1) * (Number(item.valorEstimado) || 0);
                  const isPedido = item.vinculoTipo === 'pedido'; 
                  
                  const hoje = new Date();
                  hoje.setHours(0,0,0,0);
                  
                  let alertaClasse = '';
                  let alertaTexto = '';
                  let labelPrazo = 'PRAZO:';
                  let dataExibicao = 'S/D';

                  if (item.status === 'pendente') {
                      if (isPedido && item.prazo) {
                          const dataPrazo = new Date(item.prazo + 'T00:00:00');
                          const diasParaPrazo = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                          
                          labelPrazo = '🎯 Limite:';
                          dataExibicao = item.prazo.split('-').reverse().join('/');
                          
                          if (diasParaPrazo < 0) { 
                              alertaClasse = 'alerta-vencido'; alertaTexto = '☠️ ATRASADA'; 
                          } else if (diasParaPrazo === 0) { 
                              alertaClasse = 'alerta-urgente'; alertaTexto = '🚨 HOJE!'; 
                          } else if (diasParaPrazo <= 5) { 
                              alertaClasse = 'alerta-urgente'; alertaTexto = `🚨 ${diasParaPrazo} dias`; 
                          } else if (diasParaPrazo <= 10) { 
                              alertaClasse = 'alerta-atencao'; alertaTexto = `⚠️ ${diasParaPrazo} dias`; 
                          } else { 
                              alertaClasse = 'alerta-seguro'; alertaTexto = `✅ Seguro`; 
                          }
                      } else {
                          labelPrazo = '⏳ Prazo:';
                          dataExibicao = 'Livre';
                          alertaClasse = '';
                          alertaTexto = '';
                      }
                  } 
                  else if (item.status === 'comprado') {
                      labelPrazo = '🚚 Previsão:';
                      let previsaoDate = null;
                      
                      if (item.dataCompra && item.diasFrete !== undefined) {
                          previsaoDate = new Date(item.dataCompra);
                          previsaoDate.setDate(previsaoDate.getDate() + Number(item.diasFrete));
                      } else if (!isPedido && item.prazo) {
                          previsaoDate = new Date(item.prazo + 'T00:00:00');
                      }

                      if (previsaoDate) {
                          dataExibicao = previsaoDate.toLocaleDateString('pt-BR');
                          const diasParaChegar = Math.ceil((previsaoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (diasParaChegar < 0) { 
                              alertaClasse = 'alerta-urgente'; alertaTexto = '🚨 ATRASADO'; 
                          } else if (diasParaChegar === 0) { 
                              alertaClasse = 'alerta-seguro'; alertaTexto = '📦 HOJE!'; 
                          } else { 
                              alertaClasse = 'alerta-a-caminho'; alertaTexto = `📦 ${diasParaChegar} dias`; 
                          }
                      } else {
                          dataExibicao = 'Aguardando';
                          alertaClasse = '';
                          alertaTexto = ''; 
                      }
                  } 
                  else if (item.status === 'chegou') {
                      labelPrazo = '✅ Status:';
                      dataExibicao = 'Entregue';
                      alertaClasse = '';
                      alertaTexto = '';
                  }

                  let infoExtraRastreio = null;
                  if (item.status === 'comprado' && item.dataCompra) {
                      infoExtraRastreio = `Comprado: ${new Date(item.dataCompra).toLocaleDateString('pt-BR')}`;
                  } else if (item.status === 'chegou' && item.dataChegada) {
                      infoExtraRastreio = `Recebido: ${new Date(item.dataChegada).toLocaleDateString('pt-BR')}`;
                  }

                  return (
                    <tr key={item.id} className={item.status === 'chegou' ? 'linha-comprado' : ''}>
                      <td>
                        <span className="nome-produto" style={{ textDecoration: item.status === 'chegou' ? 'line-through' : 'none' }}>
                          {item.nome} {item.formato === 'kit' && <span style={{fontSize: '10px', color: '#c5a059', fontWeight: 'bold'}}>(KIT)</span>}
                        </span>
                        <div className="vinculo-tag" style={{ marginTop: '4px' }}>
                          {isPedido ? '🔗' : '📦'} {item.vinculo || "Estoque Geral"}
                        </div>
                      </td>
                      
                      <td data-label="Quantidade">
                          <strong style={{fontSize: '15px', color: '#0f172a'}}>{item.quantidade}x</strong>
                      </td>
                      
                      <td data-label="Valor Total">
                          <div className="preco-real">
                            R$ {subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                          </div>
                          <small style={{fontSize: '10px', color: '#94a3b8', display: 'block'}}>
                             R$ {Number(item.valorEstimado).toFixed(2)} un.
                          </small>
                      </td>
                      
                      <td data-label="Status Atual">
                        <span className={`badge ${item.status}`}>
                          {item.status === 'pendente' && 'Pendente'}
                          {item.status === 'comprado' && 'A Caminho'}
                          {item.status === 'chegou' && 'No Acervo'}
                        </span>
                      </td>

                      <td data-label="Logística">
                        <div style={{display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', textAlign: 'right'}}>
                          <span className="prazo-badge" style={{background: isPedido ? '#f0fdf4' : '#f8fafc', border: isPedido ? '1px solid #bbf7d0' : '1px solid #e2e8f0', color: isPedido ? '#166534' : '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800'}}>
                            {dataExibicao}
                          </span>
                          {infoExtraRastreio && (
                              <span style={{ fontSize: '9px', color: '#0f172a', fontWeight: '800', background: '#fffbeb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fcd34d'}}>
                                  {infoExtraRastreio}
                              </span>
                          )}
                          {item.status !== 'chegou' && alertaTexto && (
                              <span className={`alerta-logistica ${alertaClasse}`}>
                                {alertaTexto}
                              </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="botoes-acao-container">
                          
                          {item.status === 'pendente' && (
                             <button className="btn-acao-status comprar" onClick={() => handleStatusChange(item, 'comprado')}>
                               🛒 Comprado
                             </button>
                          )}
                          
                          {item.status === 'comprado' && (
                             <>
                               <button className="btn-acao-status desfazer" onClick={() => handleStatusChange(item, 'pendente')} title="Voltar para Pendente">
                                 ↩ Pendente
                               </button>
                               <button className="btn-acao-status chegou" onClick={() => handleStatusChange(item, 'chegou')}>
                                 📦 Chegou
                               </button>
                             </>
                          )}

                          {item.status === 'chegou' && item.categoria !== "material" && (
                               <button 
                                 className="btn-cadastrar-acervo" 
                                 onClick={() => navigate('/cadastro-estoque', { state: { dadosCompra: item } })}
                                 title="Cadastrar detalhes da peça no Acervo"
                               >
                                 ➕ Cadastrar
                               </button>
                          )}

                          <button className="btn-action edit" onClick={() => navigate(`/compras/editar/${item.id}`)} title="Editar">✏️</button>
                          <button className="btn-action delete" onClick={() => handleExcluir(item.id)} title="Excluir">🗑️</button>
                        
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