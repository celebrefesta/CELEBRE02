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
  const [busca, setBusca] = useState('');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('Data'); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "lista_compras"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            const diffTime = dataPrazo - hoje;
            const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDias <= 5) u++; 
          }
        }
      });

      setTotais({ pendente: p, urgente: u, realizado: r });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 🔥 LÓGICA CORRIGIDA: PERGUNTA SE QUER IR PRO ACERVO E TELETRANSPORTA 🔥
  const handleStatusChange = async (item, novoStatus) => {
    try {
      let updatePayload = { status: novoStatus };

      if (novoStatus === 'chegou') {
        updatePayload.dataChegada = new Date().toISOString(); 
        
        // Salva na lista de compras que a caixa chegou!
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);

        if (item.categoria === "material") {
             alert(`📦 Material de consumo recebido e baixado da lista!`);
        } else {
             // Pergunta ao invés de forçar, caso você esteja dando baixa em várias caixas ao mesmo tempo
             const querCadastrarAgora = window.confirm(`✨ A caixa de "${item.nome}" chegou!\n\nEle já foi marcado como 'No Acervo' na sua lista de compras.\n\nDeseja ir para a tela de Estoque AGORA para colocar a foto, a prateleira e salvar a peça no catálogo?`);
             
             if (querCadastrarAgora) {
                 navigate('/cadastro-estoque', { state: { dadosCompra: item } });
             }
        }
        return; 
      } 
      else if (novoStatus === 'pendente') {
        updatePayload.dataCompra = null;
        updatePayload.dataChegada = null;
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
      } catch (error) { alert("Erro ao excluir item."); }
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
        <div className="filtros-area" style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <div className="search-box" style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar por item ou pedido..." value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent' }} />
          </div>

          <button 
              onClick={alternarOrdem}
              style={{ 
                  flex: '0 0 auto', padding: '0 20px', background: '#fff', border: '1px solid #cbd5e1', 
                  borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', 
                  color: '#475569', display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  height: '42px'
              }}
              onMouseEnter={e => {e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a';}}
              onMouseLeave={e => {e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569';}}
              title="Mudar Ordem"
          >
              {ordemAlfabetica === 'A-Z' ? '⬇️ A - Z' : ordemAlfabetica === 'Z-A' ? '⬆️ Z - A' : '📅 Recentes'}
          </button>
          
          <div style={{ flex: 1 }}>
            <select 
              className="filter-select" 
              style={{ width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              value={filtroStatus} 
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
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
                <th style={{ width: '30%' }}>ITEM & VÍNCULO</th>
                <th style={{ width: '10%' }}>QTD.</th>
                <th style={{ width: '15%' }}>VALOR TOTAL</th>
                <th style={{ width: '15%' }}>STATUS</th>
                <th style={{ width: '15%' }}>PRAZO E LOGÍSTICA</th>
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
                          const diasParaPrazo = Math.ceil((dataPrazo - hoje) / (1000 * 60 * 60 * 24));
                          
                          labelPrazo = '🎯 Limite p/ Compra:';
                          dataExibicao = item.prazo.split('-').reverse().join('/');
                          
                          if (diasParaPrazo < 0) { alertaClasse = 'alerta-vencido'; alertaTexto = '☠️ COMPRA ATRASADA'; } 
                          else if (diasParaPrazo === 0) { alertaClasse = 'alerta-urgente'; alertaTexto = '🚨 COMPRAR HOJE!'; } 
                          else if (diasParaPrazo <= 5) { alertaClasse = 'alerta-urgente'; alertaTexto = `🚨 Só ${diasParaPrazo} dias p/ limite`; } 
                          else if (diasParaPrazo <= 10) { alertaClasse = 'alerta-atencao'; alertaTexto = `⚠️ ${diasParaPrazo} dias p/ limite`; } 
                          else { alertaClasse = 'alerta-seguro'; alertaTexto = `✅ Seguro: ${diasParaPrazo} dias margem`; }
                      } else {
                          labelPrazo = '⏳ Prazo:';
                          dataExibicao = 'Livre (Estoque)';
                          alertaClasse = '';
                          alertaTexto = '';
                      }
                  } 
                  else if (item.status === 'comprado') {
                      labelPrazo = '🚚 Previsão Entrega:';
                      
                      let previsaoDate = null;
                      if (item.dataCompra && item.diasFrete !== undefined) {
                          previsaoDate = new Date(item.dataCompra);
                          previsaoDate.setDate(previsaoDate.getDate() + Number(item.diasFrete));
                      } else if (!isPedido && item.prazo) {
                          previsaoDate = new Date(item.prazo + 'T00:00:00');
                      }

                      if (previsaoDate) {
                          dataExibicao = previsaoDate.toLocaleDateString('pt-BR');
                          const diasParaChegar = Math.ceil((previsaoDate - hoje) / (1000 * 60 * 60 * 24));

                          if (diasParaChegar < 0) { alertaClasse = 'alerta-urgente'; alertaTexto = '🚨 ATRASADO NA ENTREGA'; } 
                          else if (diasParaChegar === 0) { alertaClasse = 'alerta-seguro'; alertaTexto = '📦 Chega HOJE!'; } 
                          else { alertaClasse = 'alerta-a-caminho'; alertaTexto = `📦 Chega em aprox. ${diasParaChegar} dias`; }
                      } else {
                          dataExibicao = 'Aguardando Chegada';
                          alertaClasse = '';
                          alertaTexto = ''; 
                      }
                  } 
                  else if (item.status === 'chegou') {
                      labelPrazo = '✅ Logística:';
                      dataExibicao = 'Entregue';
                      alertaClasse = '';
                      alertaTexto = '';
                  }

                  let infoExtraRastreio = null;
                  if (item.status === 'comprado' && item.dataCompra) {
                      infoExtraRastreio = `🛒 Comprado em: ${new Date(item.dataCompra).toLocaleDateString('pt-BR')}`;
                  } else if (item.status === 'chegou' && item.dataChegada) {
                      infoExtraRastreio = `📦 Recebido em: ${new Date(item.dataChegada).toLocaleDateString('pt-BR')}`;
                  }

                  return (
                    <tr key={item.id} className={item.status === 'chegou' ? 'linha-comprado' : ''}>
                      <td className="item-info-cell">
                        <span className="nome-produto" style={{ textDecoration: item.status === 'chegou' ? 'line-through' : 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.nome} {item.formato === 'kit' && <span style={{fontSize: '10px', color: '#c5a059', fontWeight: 'bold'}}>(KIT: {item.quantidadePecasKit} pçs)</span>}
                        </span>
                        <div className="vinculo-tag" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isPedido ? '🔗' : '📦'} {item.vinculo || "Estoque Geral"}
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
                          {item.status === 'pendente' && 'Falta Comprar'}
                          {item.status === 'comprado' && 'A Caminho'}
                          {item.status === 'chegou' && 'No Acervo'}
                        </span>
                      </td>

                      <td className="mobile-stack col-50 col-right">
                        <span className="mobile-label">PRAZO E LOGÍSTICA:</span>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start'}}>
                          
                          <span className="prazo-badge" style={{background: isPedido ? '#f0fdf4' : '#f8fafc', border: isPedido ? '1px solid #bbf7d0' : '1px solid #e2e8f0', color: isPedido ? '#166534' : '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800'}}>
                            {labelPrazo} {dataExibicao}
                          </span>

                          {infoExtraRastreio && (
                              <span style={{ fontSize: '10px', color: '#0f172a', fontWeight: '800', background: '#fffbeb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fcd34d'}}>
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

                      <td className="actions-cell">
                        <div className="botoes-acao-container" style={{display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center'}}>
                          
                          {item.status === 'pendente' && (
                             <button className="btn-acao-status comprar" onClick={() => handleStatusChange(item, 'comprado')}>
                               🛒 Marcar Comprado
                             </button>
                          )}
                          
                          {item.status === 'comprado' && (
                             <>
                               <button className="btn-acao-status chegou" onClick={() => handleStatusChange(item, 'chegou')}>
                                 📦 Caixa Chegou
                               </button>
                               <button className="btn-acao-status desfazer" onClick={() => handleStatusChange(item, 'pendente')} title="Desfazer (Voltar para Pendente)">
                                 ↩
                               </button>
                             </>
                          )}

                          {item.status === 'chegou' && (
                             <button className="btn-acao-status desfazer" onClick={() => handleStatusChange(item, 'pendente')}>
                               ↩ Retirar do Acervo
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