import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import "./Compras.css";

const Compras = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [itens, setItens] = useState([]);
  const [totais, setTotais] = useState({ pendente: 0, urgente: 0, realizado: 0 });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState('');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('Data'); 
  const [loading, setLoading] = useState(true);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE COMPRAS VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de compras:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS as compras da conta principal
    const q = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordena em memória por data mais recente
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
  }, [usuarioLogado, navigate, tenantId]);

  const handleStatusChange = async (item, novoStatus) => {
    try {
      // 🔥 BLINDAGEM MULTI-EMPRESA: Procura a peça no estoque da conta principal
      const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId), where("nome", "==", item.nome));
      const snapshotEstoque = await getDocs(qEstoque);
      const qtdComprada = Number(item.quantidade) || 1;

      let updatePayload = { status: novoStatus };

      if (novoStatus === 'chegou') {
        updatePayload.dataChegada = new Date().toISOString();
        if (!item.dataCompra) updatePayload.dataCompra = new Date().toISOString();

        if (!snapshotEstoque.empty) {
          const itemRef = doc(db, "lista_compras", item.id);
          await updateDoc(itemRef, updatePayload);

          const docExistente = snapshotEstoque.docs[0];
          const qtdAtual = Number(docExistente.data().quantidade) || 0;
          await updateDoc(doc(db, "estoque", docExistente.id), {
            quantidade: qtdAtual + (item.formato === 'kit' && item.quantidadePecasKit ? item.quantidadePecasKit : qtdComprada),
            atualizadoEm: new Date().toISOString()
          });

          await registrarLog("COMPRA RECEBIDA", `Registrou a chegada de "${item.nome}" e adicionou ao estoque.`);
          alert(`📦 Compra Concluída!\n\nA peça "${item.nome}" já existe no seu acervo. A quantidade no estoque foi somada automaticamente!`);
        } else {
          if (item.categoria === "material") {
             const itemRef = doc(db, "lista_compras", item.id);
             await updateDoc(itemRef, updatePayload);
             
             await registrarLog("COMPRA RECEBIDA", `Registrou a chegada do material "${item.nome}".`);
             alert(`📦 Material de consumo recebido e baixado da lista!`);
          } else {
             const itemRef = doc(db, "lista_compras", item.id);
             await updateDoc(itemRef, updatePayload);

             const querCadastrarAgora = window.confirm(`✨ Compra concluída com sucesso!\n\nComo "${item.nome}" é uma peça INÉDITA, deseja ir para a tela de Cadastro de Estoque AGORA para registrar fotos e detalhes?`);
             if (querCadastrarAgora) {
                 await registrarLog("COMPRA RECEBIDA", `Registrou a compra de "${item.nome}" e iniciou cadastro inédito no acervo.`);
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

        await registrarLog("COMPRA PENDENTE", `Voltou o status de "${item.nome}" para Pendente (Falta Comprar).`);
      }
      else if (novoStatus === 'comprado') {
        updatePayload.dataCompra = new Date().toISOString();
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);
        
        await registrarLog("COMPRA EFETUADA", `Marcou o item "${item.nome}" como Comprado (A Caminho).`);
        alert(`🛒 Maravilha! A compra foi registrada. O sistema vai rastrear a entrega a partir de hoje.`);
      }

    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro na operação.");
    }
  };

  const handleExcluir = async (id, nome) => {
    if (window.confirm(`Tem certeza que deseja remover "${nome}" da lista?`)) {
      try {
        await registrarLog("EXCLUSÃO DE COMPRA", `Removeu a peça "${nome}" da lista de compras.`);
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
    <div className="clientes-container fade-in">
      
      {/* HERO CABEÇALHO IDÊNTICO AO GESTÃO DE CLIENTES */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            🛒
          </div>
          <div className="welcome-text">
            <h1>Lista de Compras & Aquisições</h1>
            <p>Gerencie aquisições vinculadas aos pedidos, fornecedores e peças do acervo.</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-primary-celebre" onClick={() => navigate("/compras/nova")}>
            + ADICIONAR ITEM
          </button>
        </div>
      </div>

      {/* CARDS DE DASHBOARD 4 COLUNAS IDÊNTICOS AO GESTÃO DE CLIENTES */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro card-purple">
          <div className="stat-icon-wrapper icon-purple">
            🛒
          </div>
          <div className="stat-content">
            <span className="stat-title">TOTAL NA LISTA</span>
            <strong className="stat-number">{itens.length}</strong>
            <small className="stat-desc">Itens cadastrados</small>
          </div>
        </div>

        <div className="stat-card-pro card-amber">
          <div className="stat-icon-wrapper icon-amber">
            📂
          </div>
          <div className="stat-content">
            <span className="stat-title">ORÇAMENTO PENDENTE</span>
            <strong className="stat-number">R$ {totais.pendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Estimado p/ compras</small>
          </div>
        </div>

        <div className="stat-card-pro card-red">
          <div className="stat-icon-wrapper icon-red">
            🚨
          </div>
          <div className="stat-content">
            <span className="stat-title">ITENS EM ALERTA</span>
            <strong className="stat-number">{totais.urgente}</strong>
            <small className="stat-desc">Perto do prazo limite</small>
          </div>
        </div>

        <div className="stat-card-pro card-green">
          <div className="stat-icon-wrapper icon-green">
            ✅
          </div>
          <div className="stat-content">
            <span className="stat-title">REALIZADO (MÊS)</span>
            <strong className="stat-number">R$ {totais.realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Investimento aprovado</small>
          </div>
        </div>
      </div>

      {/* CONTAINER TABELA E FILTROS IDÊNTICOS AO GESTÃO DE CLIENTES */}
      <div className="table-card-container">
        <div className="table-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar por item ou pedido..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <button className="btn-secondary-celebre" onClick={alternarOrdem} title="Mudar Ordem">
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

        <div className="table-responsive-wrapper">
          <table className="pro-table">
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
                  const isPresencial = item.tipoEntrega === '1' || Number(item.diasFrete) === 1;
                  
                  const hoje = new Date();
                  hoje.setHours(0,0,0,0);
                  
                  let alertaClasse = '';
                  let alertaTexto = '';
                  let labelPrazo = 'PRAZO:';
                  let dataExibicao = 'S/D';

                  if (item.status === 'pendente') {
                      if (isPresencial) {
                          labelPrazo = '📍 Local:';
                          dataExibicao = 'Compra Presencial';
                          alertaClasse = 'alerta-seguro';
                          alertaTexto = '⚡ Na Cidade';
                      } else if (isPedido && item.prazo) {
                          const dataPrazo = new Date(item.prazo + 'T00:00:00');
                          const diasParaPrazo = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                          
                          labelPrazo = '🎯 Limite:';
                          dataExibicao = item.prazo.split('-').reverse().join('/');
                          
                          if (diasParaPrazo < 0) { 
                              alertaClasse = 'alerta-vencido';
                              alertaTexto = '☠️ ATRASADA'; 
                          } else if (diasParaPrazo === 0) { 
                              alertaClasse = 'alerta-urgente';
                              alertaTexto = '🚨 HOJE!'; 
                          } else if (diasParaPrazo <= 5) { 
                              alertaClasse = 'alerta-urgente';
                              alertaTexto = `🚨 ${diasParaPrazo} dias`; 
                          } else if (diasParaPrazo <= 10) { 
                              alertaClasse = 'alerta-atencao';
                              alertaTexto = `⚠️ ${diasParaPrazo} dias`; 
                          } else { 
                              alertaClasse = 'alerta-seguro';
                              alertaTexto = `✅ Seguro`; 
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
                              alertaClasse = 'alerta-urgente';
                              alertaTexto = '🚨 ATRASADO'; 
                          } else if (diasParaChegar === 0) { 
                              alertaClasse = 'alerta-seguro';
                              alertaTexto = '📦 HOJE!'; 
                          } else { 
                              alertaClasse = 'alerta-a-caminho';
                              alertaTexto = `📦 ${diasParaChegar} dias`; 
                          }
                      } else {
                          dataExibicao = 'Aguardando';
                          alertaClasse = '';
                          alertaTexto = ''; 
                      }
                  } 
                  else if (item.status === 'chegou') {
                      labelPrazo = '✅ Status:';
                      dataExibicao = isPresencial ? 'Comprado na Loja' : 'Entregue';
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
                          {item.nome} {item.formato === 'kit' && <span className="tag-kit-gold">(KIT)</span>}
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
                        <div className="table-actions-container">
                          {item.status === 'pendente' && (
                             <button 
                               className="btn-acao-status comprar" 
                               onClick={() => isPresencial ? handleStatusChange(item, 'chegou') : handleStatusChange(item, 'comprado')}
                               title={isPresencial ? "Compra presencial (Já está com você)" : "Marcar como comprado via frete"}
                             >
                               🛒 {isPresencial ? 'Comprado (Já Comigo)' : 'Comprado'}
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

                          <button className="action-btn edit" onClick={() => navigate(`/compras/editar/${item.id}`)} title="Editar">✏️</button>
                          <button className="action-btn delete" onClick={() => handleExcluir(item.id, item.nome)} title="Excluir">🗑️</button>
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