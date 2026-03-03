import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Locacoes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'; 

const Locacoes = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  
  // 🔥 NOVOS ESTADOS DE FILTRO SEPARADOS 🔥
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos, orcamentos, confirmados, cancelados
  const [filtroServico, setFiltroServico] = useState('todos'); // todos, pegue, decoracao
  const [filtroOrdenacao, setFiltroOrdenacao] = useState('recentes'); // recentes, proximos, maiorValor, menorValor
  
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(null);

  const [modalPagamento, setModalPagamento] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [pagamento, setPagamento] = useState({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  const [pedidosComProblema, setPedidosComProblema] = useState([]);
  const [mostrarAuditoria, setMostrarAuditoria] = useState(false);

  useEffect(() => {
    carregarLocacoes();
  }, []);

  const carregarLocacoes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "locacoes"));
      const dados = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let tipoServico = "DECORAÇÃO";
        if (data.tipoServico || data.tipoDaFesta || data.modalidade) {
           tipoServico = String(data.tipoServico || data.tipoDaFesta || data.modalidade).toUpperCase();
        } else if (data.logistica && String(data.logistica.tipoFrete || data.logistica.frete).toUpperCase().includes('RETIRADA')) {
           tipoServico = "PEGUE E MONTE";
        }
        
        // Garante que o criadoEm tenha um valor comparável, mesmo se for antigo
        let timestampCriacao = 0;
        if (data.criadoEm) {
            timestampCriacao = data.criadoEm.toMillis ? data.criadoEm.toMillis() : new Date(data.criadoEm).getTime();
        }

        return { id: doc.id, ...data, tipoServicoFormatado: tipoServico, createdAtMs: timestampCriacao };
      });

      setLista(dados);

      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      
      const anomalias = [];

      dados.forEach(item => {
        const statusStr = (item.status || '').toLowerCase();
        if (statusStr === 'cancelado') return; 

        const locDate = item.dataRetirada ? new Date(item.dataRetirada + 'T00:00:00') : null;
        const devDate = item.dataDevolucao ? new Date(item.dataDevolucao + 'T00:00:00') : locDate;
        
        let motivos = [];
        const isOrcamento = statusStr.includes('orcam');

        if (isOrcamento && locDate && locDate.getTime() < hoje.getTime()) {
          motivos.push("👻 Orçamento Vencido");
        } 
        else if (['confirmado', 'preparacao'].includes(statusStr) && locDate && locDate.getTime() <= hoje.getTime()) {
          motivos.push("📦 Atrasado para Entrega/Separação");
        } 
        else if (statusStr === 'entregue' && devDate && devDate.getTime() < hoje.getTime()) {
          motivos.push("⏳ Devolução Atrasada");
        }

        const temAvaria = item.itens?.some(i => i.avaria);
        const temFalta = item.itens?.some(i => i.faltou);
        if (temAvaria) motivos.push("⚠️ Peça Avariada");
        if (temFalta) motivos.push("❌ Peça Faltando");

        const saldoDevedor = Number(item.valorTotal || 0) - Number(item.valorPago || 0);
        if (saldoDevedor > 0 && !isOrcamento && devDate && devDate.getTime() <= hoje.getTime()) {
          motivos.push("💰 Pagamento Pendente");
        }

        if (motivos.length > 0) {
          if (statusStr === 'finalizado' && !temAvaria && !temFalta && saldoDevedor <= 0) {
             return; 
          }
          anomalias.push({ ...item, alertasAuditoria: motivos });
        }
      });

      if (anomalias.length > 0) {
        setPedidosComProblema(anomalias);
        setMostrarAuditoria(true);
      }
      setLoading(false);
    } catch (error) { console.error(error); setLoading(false); }
  };

  const resolverPedidoEsquecido = async (id, novoStatus) => {
    try {
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      setLista(prev => prev.map(item => item.id === id ? { ...item, status: novoStatus } : item));
      const novaLista = pedidosComProblema.filter(item => item.id !== id);
      setPedidosComProblema(novaLista);
      if(novaLista.length === 0) setMostrarAuditoria(false);
    } catch (e) {
      alert("Erro ao corrigir o pedido.");
    }
  };

  const handleExcluir = async (id) => {
    if (window.confirm("Apagar pedido definitivamente?")) {
      await deleteDoc(doc(db, "locacoes", id));
      setLista(lista.filter(i => i.id !== id));
    }
  };

  const registrarPagamento = async (e) => {
    e.preventDefault();
    setSalvandoPagamento(true);
    try {
      const novoValorPago = Number(pedidoSelecionado.valorPago || 0) + Number(pagamento.valor);
      await updateDoc(doc(db, "locacoes", pedidoSelecionado.id), { valorPago: novoValorPago });
      await addDoc(collection(db, "financeiro_lancamentos"), {
        tipo: 'entrada', categoria: 'Locação', valor: Number(pagamento.valor), formaPagto: pagamento.formaPagto,
        data: pagamento.data, status: 'pago', createdAt: serverTimestamp(),
        descricao: `Ref. Pedido #${pedidoSelecionado.numeroPedido} - ${pedidoSelecionado.clienteNome}`
      });
      alert("Recebido!");
      carregarLocacoes();
      setModalPagamento(false);
    } catch (e) { alert("Erro"); } finally { setSalvandoPagamento(false); }
  };

  // 🔥 1. APLICA A BUSCA DE TEXTO 🔥
  let filtrados = [...lista];
  if (busca) {
    const termo = busca.toLowerCase();
    filtrados = filtrados.filter(i => 
      (i.clienteNome || '').toLowerCase().includes(termo) || 
      (i.numeroPedido || '').includes(termo)
    );
  }

  // 🔥 2. APLICA O FILTRO DE STATUS 🔥
  if (filtroStatus === 'orcamentos') {
      filtrados = filtrados.filter(i => (i.status || '').toLowerCase().includes('orcam'));
  } else if (filtroStatus === 'confirmados') {
      filtrados = filtrados.filter(i => {
          const s = (i.status || '').toLowerCase();
          return !s.includes('orcam') && s !== 'cancelado';
      });
  } else if (filtroStatus === 'cancelados') {
      filtrados = filtrados.filter(i => (i.status || '').toLowerCase() === 'cancelado');
  }

  // 🔥 3. APLICA O FILTRO DE TIPO DE SERVIÇO 🔥
  if (filtroServico === 'pegue') {
      filtrados = filtrados.filter(i => i.tipoServicoFormatado.includes('PEGUE'));
  } else if (filtroServico === 'decoracao') {
      filtrados = filtrados.filter(i => !i.tipoServicoFormatado.includes('PEGUE'));
  }

  // 🔥 4. APLICA A ORDENAÇÃO CORRIGIDA 🔥
  filtrados.sort((a, b) => {
    
    if (filtroOrdenacao === 'proximos') {
      const dataA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 9999999999999;
      const dataB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 9999999999999;
      return dataA - dataB;
    
    } else if (filtroOrdenacao === 'maiorValor') {
      return Number(b.valorTotal || 0) - Number(a.valorTotal || 0);
    
    } else if (filtroOrdenacao === 'menorValor') {
      return Number(a.valorTotal || 0) - Number(b.valorTotal || 0);
    
    } else {
      // PADRÃO: "MAIS RECENTES" (Orçamentos colados no topo, depois os criados recentemente)
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();
      const isA_Orcam = statusA.includes('orcam');
      const isB_Orcam = statusB.includes('orcam');

      // 1º Regra: Se um é orçamento e o outro não, orçamento sobe.
      if (isA_Orcam && !isB_Orcam) return -1;
      if (!isA_Orcam && isB_Orcam) return 1;

      // 2º Regra: Se os dois são iguais no status acima, ordena pelo timestamp de criação mais novo
      return b.createdAtMs - a.createdAtMs;
    }
  });

  return (
    <div className="locacoes-container">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>MINHAS LOCAÇÕES</h1>
          <p>Gestão de pedidos, datas e recebimentos.</p>
        </div>
        <button className="btn-primary-celebre" onClick={() => navigate('/locacoes/nova')}>+ NOVA LOCAÇÃO</button>
      </header>

      <div className="resumo-topo-v2">
        <div className="card-resumo-v2 verde">
          <span>Confirmados</span>
          <strong>{lista.filter(i => !['orcamento', 'cancelado'].includes((i.status || '').toLowerCase())).length}</strong>
        </div>
        <div className="card-resumo-v2 laranja">
          <span>Orçamentos / Leads</span>
          <strong>{lista.filter(i => (i.status || '').toLowerCase() === 'orcamento').length}</strong>
        </div>
      </div>

      {/* 🔥 NOVA BARRA DE FILTROS SUPER AVANÇADA 🔥 */}
      <div className="filter-wrapper-clean" style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        
        {/* Linha 1: Busca e Chips de Status */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="search-bar-container" style={{ flex: '1', minWidth: '280px', margin: 0 }}>
              <span className="search-icon">🔍</span>
              <input 
                type="text"
                className="search-input-clean" 
                placeholder="Buscar por cliente ou pedido..." 
                value={busca} 
                onChange={e => setBusca(e.target.value)} 
              />
            </div>
            
            <div className="chips-categorias" style={{ padding: 0, overflow: 'visible', margin: 0, gap: '8px' }}>
                <button type="button" className={`chip-cat ${filtroStatus === 'todos' ? 'active' : ''}`} onClick={() => setFiltroStatus('todos')}>Todos</button>
                <button type="button" className={`chip-cat ${filtroStatus === 'orcamentos' ? 'active' : ''}`} style={filtroStatus === 'orcamentos' ? {backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fcd34d'} : {}} onClick={() => setFiltroStatus('orcamentos')}>Leads / Orçamentos</button>
                <button type="button" className={`chip-cat ${filtroStatus === 'confirmados' ? 'active' : ''}`} style={filtroStatus === 'confirmados' ? {backgroundColor: '#dcfce7', color: '#10b981', borderColor: '#6ee7b7'} : {}} onClick={() => setFiltroStatus('confirmados')}>Confirmados</button>
                <button type="button" className={`chip-cat ${filtroStatus === 'cancelados' ? 'active' : ''}`} style={filtroStatus === 'cancelados' ? {backgroundColor: '#fef2f2', color: '#ef4444', borderColor: '#fca5a5'} : {}} onClick={() => setFiltroStatus('cancelados')}>Cancelados</button>
            </div>
        </div>

        <div style={{ width: '100%', height: '1px', background: '#f1f5f9' }}></div>

        {/* Linha 2: Selects de Serviço e Ordenação */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <select 
              value={filtroServico} 
              onChange={(e) => setFiltroServico(e.target.value)}
              className="search-input-clean"
              style={{ width: 'auto', minWidth: '220px', cursor: 'pointer', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', fontSize: '13px' }}
            >
              <option value="todos">🔧 Todos os Serviços</option>
              <option value="pegue">📦 Apenas Pegue e Monte</option>
              <option value="decoracao">✨ Apenas Decoração Completa</option>
            </select>

            <select 
              value={filtroOrdenacao} 
              onChange={(e) => setFiltroOrdenacao(e.target.value)}
              className="search-input-clean"
              style={{ width: 'auto', minWidth: '220px', cursor: 'pointer', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', fontSize: '13px' }}
            >
              <option value="recentes">🌟 Mais Recentes / Novos Pedidos</option>
              <option value="proximos">📅 Eventos Mais Próximos</option>
              <option value="maiorValor">💰 Maior Valor para Menor Valor</option>
              <option value="menorValor">📉 Menor Valor para Maior Valor</option>
            </select>
        </div>

      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>PEDIDO</th>
              <th>CLIENTE / SERVIÇO</th>
              <th>DATA EVENTO</th>
              <th>VALOR TOTAL</th>
              <th>A RECEBER</th>
              <th>STATUS</th>
              <th width="50px"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading-td">Carregando locações...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan="7" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum pedido encontrado nesta filtragem.</td></tr>
            ) : (
              filtrados.map(item => {
                const valorTotal = Number(item.valorTotal || 0);
                const valorPago = Number(item.valorPago || 0);
                const saldoDevedor = valorTotal - valorPago;
                const statusStr = (item.status || '').toLowerCase();
                const isCancelado = statusStr === 'cancelado';
                const isOrcamento = statusStr.includes('orcam'); 
                
                const temAvaria = item.itens?.some(i => i.avaria);
                const temFalta = item.itens?.some(i => i.faltou);
                const temAlertas = temAvaria || temFalta;

                let alertaOperacional = null;
                let corAlerta = '';

                if (item.dataRetirada && !['finalizado', 'cancelado'].includes(statusStr)) {
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    
                    const amanha = new Date();
                    amanha.setDate(amanha.getDate() + 1);
                    amanha.setHours(0,0,0,0);

                    const locDate = new Date(item.dataRetirada + 'T00:00:00');
                    const devDate = item.dataDevolucao ? new Date(item.dataDevolucao + 'T00:00:00') : locDate;

                    if (isOrcamento && locDate.getTime() < hoje.getTime()) {
                        alertaOperacional = "👻 Orçamento Vencido";
                        corAlerta = "#94a3b8"; 
                    } 
                    else if (statusStr === 'confirmado' && locDate.getTime() <= amanha.getTime()) {
                        alertaOperacional = "📦 Separar Peças!";
                        corAlerta = "#f59e0b"; 
                    }
                    else if (statusStr === 'preparacao' && locDate.getTime() <= hoje.getTime()) {
                        alertaOperacional = "🚚 Entregar Hoje!";
                        corAlerta = "#ef4444"; 
                    }
                    else if (statusStr === 'entregue' && devDate.getTime() <= hoje.getTime()) {
                        alertaOperacional = "⏳ Cobrar Devolução!";
                        corAlerta = "#ef4444"; 
                    }
                }

                return (
                  <tr 
                    key={item.id} 
                    className={temAlertas ? 'linha-alerta' : ''} 
                    style={{ opacity: isCancelado ? 0.6 : 1, cursor: 'pointer' }}
                    onClick={() => navigate(`/locacoes/editar/${item.id}`)}
                    title="Clique para abrir detalhes do pedido"
                  >
                    <td className="pedido-id-cell">
                      {item.numeroPedido ? (
                        `#${item.numeroPedido}`
                      ) : isOrcamento ? (
                        <span style={{color: '#f59e0b', fontWeight: 'bold', fontSize: '11px'}}>ORÇAMENTO DO SITE</span>
                      ) : (
                        <span style={{color: '#94a3b8', fontWeight: 'bold'}}>#S/N</span>
                      )}
                    </td>
                    <td className="cliente-info-cell">
                      <strong style={{textDecoration: isCancelado ? 'line-through' : 'none', color: 'var(--texto-principal)', fontSize: '15px'}}>{item.clienteNome}</strong>
                      <div className="tags-row">
                        <span className={`tag-servico ${item.tipoServicoFormatado.includes('PEGUE') ? 'pegue' : 'deco'}`}>
                          {item.tipoServicoFormatado}
                        </span>
                        {temFalta && <span className="tag-alerta erro">FALTAM PEÇAS</span>}
                        {temAvaria && <span className="tag-alerta aviso">AVARIAS</span>}
                      </div>
                    </td>
                    
                    <td className="mobile-stack">
                      <span className="mobile-label">DATA EVENTO:</span>
                      <span>{item.dataRetirada ? new Date(item.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                    </td>
                    
                    <td className="mobile-stack">
                      <span className="mobile-label">VALOR TOTAL:</span>
                      <span className="valor-total">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </td>
                    
                    <td className="mobile-stack">
                      <span className="mobile-label">A RECEBER:</span> 
                      <span className={saldoDevedor > 0 ? "txt-perigo" : "txt-sucesso"}>
                        {saldoDevedor > 0 ? `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✅ PAGO'}
                      </span>
                    </td>
                    
                    <td className="status-cell">
                      <span className={`status-pill-v2 ${statusStr}`}>
                        {item.status?.toUpperCase() || 'S/S'}
                      </span>
                      {alertaOperacional && (
                         <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: '800', color: corAlerta, textTransform: 'uppercase' }}>
                            {alertaOperacional}
                         </div>
                      )}
                    </td>
                    
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="dropdown-container">
                        <button 
                          className="btn-pontinhos" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setMenuAberto(menuAberto === item.id ? null : item.id); 
                          }}
                        >
                          ⋮
                        </button>
                        
                        {menuAberto === item.id && (
                          <div className="menu-suspenso">
                            {saldoDevedor > 0 && !isCancelado && !isOrcamento && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setPedidoSelecionado(item); 
                                  setPagamento({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
                                  setModalPagamento(true); 
                                  setMenuAberto(null); 
                                }} 
                                className="item-menu"
                              >
                                💰 Receber
                              </button>
                            )}

                            <button onClick={(e) => { e.stopPropagation(); navigate(`/locacoes/editar/${item.id}`); }} className="item-menu">✏️ Editar</button>
                            <button onClick={(e) => { e.stopPropagation(); handleExcluir(item.id); }} className="item-menu item-excluir">🗑️ Excluir</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL PAGAMENTO */}
      {modalPagamento && pedidoSelecionado && (
         <div className="modal-overlay-v2">
            <div className="modal-box-v2 pagamento-box">
                <div className="modal-header">
                  <h3>💰 Registrar Pagamento</h3>
                  <button className="btn-fechar" onClick={() => setModalPagamento(false)}>X</button>
                </div>
                <div className="info-pedido-pagamento">
                  <p>Recebendo de: <strong>{pedidoSelecionado.clienteNome}</strong></p>
                  <p>Falta Receber: <strong className="txt-perigo">R$ {(Number(pedidoSelecionado.valorTotal || 0) - Number(pedidoSelecionado.valorPago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                </div>
                <form onSubmit={registrarPagamento} className="form-pagamento">
                    <div className="form-group-pag">
                      <label>Valor Recebido (R$)</label>
                      <input 
                        type="number" 
                        name="valorPagamento" 
                        id="valorPagamento" 
                        step="0.01" 
                        value={pagamento.valor} 
                        onChange={e => setPagamento({...pagamento, valor: e.target.value})} 
                        required 
                        autoFocus
                      />
                    </div>
                    <div className="form-group-pag">
                      <label>Forma de Pagamento</label>
                      <select 
                        name="formaPagamento" 
                        id="formaPagamento" 
                        value={pagamento.formaPagto} 
                        onChange={e => setPagamento({...pagamento, formaPagto: e.target.value})}
                      >
                          <option value="Pix">Pix</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Cartão de Débito">Cartão de Débito</option>
                      </select>
                    </div>
                    <div className="form-group-pag">
                      <label>Data do Pagamento</label>
                      <input 
                        type="date" 
                        name="dataPagamento" 
                        id="dataPagamento" 
                        value={pagamento.data} 
                        onChange={e => setPagamento({...pagamento, data: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={() => setModalPagamento(false)}>Cancelar</button>
                        <button type="submit" className="btn-confirm" disabled={salvandoPagamento}>Confirmar</button>
                    </div>
                </form>
            </div>
         </div>
      )}

      {/* SUPER AUDITORIA */}
      {mostrarAuditoria && (
        <div className="modal-overlay-v2">
          <div className="modal-box-v2 auditoria-box">
            <div className="auditoria-header">
              <h2>🚨 ATENÇÃO: Erros Operacionais Detectados!</h2>
              <p>O sistema encontrou furos de processo. Pode ser atraso na devolução, peças quebradas, falta de pagamento ou orçamentos abandonados. <b>Resolva para limpar esta lista!</b></p>
            </div>
            
            <div className="auditoria-body">
              {pedidosComProblema.map(req => {
                const statusAtual = (req.status || '').toLowerCase();
                const ehOrcamento = statusAtual.includes('orcam');

                return (
                  <div key={req.id} className="auditoria-card">
                    <div className="auditoria-info">
                      <strong>{req.clienteNome}</strong> <span>#{req.numeroPedido || 'S/N'}</span><br/>
                      <div className="auditoria-detalhes" style={{ marginBottom: '8px' }}>
                        Data da Festa: <b className="auditoria-data">{req.dataRetirada.split('-').reverse().join('/')}</b>
                        <span className="divisor">|</span> 
                        Travado em: <b style={{textTransform: 'uppercase'}}>{req.status}</b>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {req.alertasAuditoria.map((alerta, idx) => (
                           <span key={idx} style={{ background: '#fef2f2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #fca5a5' }}>
                             {alerta}
                           </span>
                        ))}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                      {ehOrcamento ? (
                        <button onClick={() => resolverPedidoEsquecido(req.id, 'cancelado')} className="btn-resolver cancel" style={{ flex: 1, justifyContent: 'center' }}>
                          ❌ Descartar Orçamento
                        </button>
                      ) : statusAtual !== 'finalizado' ? (
                        <>
                          <button onClick={() => resolverPedidoEsquecido(req.id, 'cancelado')} className="btn-resolver cancel" style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}>
                            ❌ Cancelar
                          </button>
                          <button onClick={() => resolverPedidoEsquecido(req.id, 'finalizado')} className="btn-resolver ok" style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}>
                            ✔️ Forçar Baixa
                          </button>
                        </>
                      ) : null}
                      
                      <button 
                        onClick={() => {
                          setMostrarAuditoria(false); 
                          navigate(`/locacoes/editar/${req.id}`); 
                        }} 
                        className="btn-resolver" 
                        style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '0 15px', fontWeight: 'bold', flex: statusAtual === 'finalizado' ? 1 : 'unset' }}
                      >
                        ➔ Abrir Pedido
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="auditoria-footer">
              <button onClick={() => setMostrarAuditoria(false)}>
                Minimizar Avisos (Não recomendado)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locacoes;