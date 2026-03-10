import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Locacoes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'; 

const Locacoes = () => {
  const navigate = useNavigate();
  const location = useLocation(); 

  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  
  const [filtroStatus, setFiltroStatus] = useState('todos'); 
  const [filtroServico, setFiltroServico] = useState('todos'); 
  const [filtroOrdenacao, setFiltroOrdenacao] = useState('recentes'); 
  
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(null);

  const [modalPagamento, setModalPagamento] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [pagamento, setPagamento] = useState({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  const [modalChecklist, setModalChecklist] = useState(false);
  const [pedidoChecklist, setPedidoChecklist] = useState(null);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [modoChecklist, setModoChecklist] = useState('ida'); 
  const [salvandoChecklist, setSalvandoChecklist] = useState(false);

  useEffect(() => {
    if (location.state && location.state.buscarPedidoId) {
      const idCurto = location.state.buscarPedidoId.substring(0, 6);
      setBusca(idCurto);
    }
    carregarLocacoes();
  }, [location]);

  const carregarLocacoes = async () => {
    try {
      const clientesSnapshot = await getDocs(collection(db, "clientes"));
      const dicionarioClientes = {};
      clientesSnapshot.forEach(doc => {
          const cData = doc.data();
          dicionarioClientes[doc.id] = cData.nome || cData.nomeCompleto || cData.razaoSocial || "Sem Nome";
      });

      const querySnapshot = await getDocs(collection(db, "locacoes"));
      const hoje = new Date(); hoje.setHours(0,0,0,0);

      const dados = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let nomeDoClienteReal = data.clienteNome || data.nomeCliente || "Cliente";
        const idSalvo = data.clienteId || data.idCliente || (typeof data.cliente === 'string' ? data.cliente : null);

        if (idSalvo && dicionarioClientes[idSalvo]) {
            nomeDoClienteReal = dicionarioClientes[idSalvo];
        } else if (data.cliente && typeof data.cliente === 'object') {
            nomeDoClienteReal = data.cliente.nome || nomeDoClienteReal;
        }

        let tipoServico = "DECORAÇÃO";
        if (data.tipoServico || data.tipoDaFesta || data.modalidade) {
           tipoServico = String(data.tipoServico || data.tipoDaFesta || data.modalidade).toUpperCase();
        } else if (data.logistica && String(data.logistica.tipoFrete || data.logistica.frete).toUpperCase().includes('RETIRADA')) {
           tipoServico = "PEGUE E MONTE";
        }
        
        let timestampCriacao = 0;
        if (data.criadoEm) { timestampCriacao = data.criadoEm.toMillis ? data.criadoEm.toMillis() : new Date(data.criadoEm).getTime(); }

        let statusReal = String(data.status || '').toLowerCase();
        let isVencido = false;

        if (statusReal.includes('orcam') && data.dataRetirada) {
            const locDate = new Date(data.dataRetirada + 'T00:00:00');
            if (locDate.getTime() < hoje.getTime()) isVencido = true;
        }

        return { 
            id: doc.id, ...data, status: statusReal, isOrcamentoVencido: isVencido,
            clienteNome: nomeDoClienteReal, tipoServicoFormatado: tipoServico, createdAtMs: timestampCriacao 
        };
      });

      setLista(dados);
      setLoading(false);
    } catch (error) { setLoading(false); }
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
        descricao: `Ref. Pedido #${pedidoSelecionado.numeroPedido || pedidoSelecionado.id.substring(0,6)} - ${pedidoSelecionado.clienteNome}`
      });
      alert("Recebido!");
      carregarLocacoes();
      setModalPagamento(false);
    } catch (e) { alert("Erro"); } finally { setSalvandoPagamento(false); }
  };

  const abrirModalChecklist = (pedido, modo) => {
    setPedidoChecklist(pedido);
    setModoChecklist(modo);
    const itensMapeados = (pedido.itens || []).map(i => ({
        ...i, 
        idaOk: i.idaOk || false, 
        voltaStatus: i.voltaStatus || 'pendente' 
    }));
    setItensChecklist(itensMapeados);
    setModalChecklist(true);
    setMenuAberto(null);
  };

  const toggleIda = (itemId) => {
      setItensChecklist(prev => prev.map(i => i.id === itemId ? {...i, idaOk: !i.idaOk} : i));
  };

  const setStatusVolta = (itemId, statusStr) => {
      setItensChecklist(prev => prev.map(i => i.id === itemId ? {...i, voltaStatus: statusStr} : i));
  };

  const salvarChecklistNoBanco = async () => {
      setSalvandoChecklist(true);
      try {
          await updateDoc(doc(db, "locacoes", pedidoChecklist.id), {
              itens: itensChecklist
          });
          setModalChecklist(false); // Fecha o modal após salvar o checklist da logística
          carregarLocacoes(); 
      } catch (error) {
          alert("Erro ao salvar checklist");
      } finally {
          setSalvandoChecklist(false);
      }
  };

  let filtrados = [...lista];
  if (busca) {
    const termo = busca.toLowerCase();
    filtrados = filtrados.filter(i => {
      const nomeMatch = (i.clienteNome || '').toLowerCase().includes(termo);
      const numeroAppMatch = (i.numeroPedido || '').includes(termo);
      const idRealMatch = (i.id || '').toLowerCase().includes(termo); 
      return nomeMatch || numeroAppMatch || idRealMatch;
    });
  }

  if (filtroStatus === 'todos') {
      filtrados = filtrados.filter(i => !i.status.includes('cancelado') && !i.status.includes('finalizado') && !i.isOrcamentoVencido);
  } else if (filtroStatus === 'orcamentos') {
      filtrados = filtrados.filter(i => i.status.includes('orcam') && !i.isOrcamentoVencido);
  } else if (filtroStatus === 'confirmados') {
      filtrados = filtrados.filter(i => !i.status.includes('orcam') && !i.status.includes('cancelado') && !i.status.includes('finalizado') && !i.isOrcamentoVencido);
  } else if (filtroStatus === 'finalizados') {
      filtrados = filtrados.filter(i => i.status.includes('finalizado'));
  } else if (filtroStatus === 'cancelados') {
      filtrados = filtrados.filter(i => i.status.includes('cancelado') || i.isOrcamentoVencido);
  }

  if (filtroServico === 'pegue') filtrados = filtrados.filter(i => i.tipoServicoFormatado.includes('PEGUE'));
  else if (filtroServico === 'decoracao') filtrados = filtrados.filter(i => !i.tipoServicoFormatado.includes('PEGUE'));

  filtrados.sort((a, b) => {
    const getPriority = (item) => {
        if (item.status.includes('cancelado') || item.isOrcamentoVencido) return 3; 
        if (item.status.includes('finalizado')) return 2; 
        return 1; 
    };
    const pA = getPriority(a);
    const pB = getPriority(b);
    if (pA !== pB) return pA - pB;
    if (filtroOrdenacao === 'proximos') return (a.dataRetirada ? new Date(a.dataRetirada).getTime() : 9999999999999) - (b.dataRetirada ? new Date(b.dataRetirada).getTime() : 9999999999999);
    if (filtroOrdenacao === 'maiorValor') return Number(b.valorTotal || 0) - Number(a.valorTotal || 0);
    if (filtroOrdenacao === 'menorValor') return Number(a.valorTotal || 0) - Number(b.valorTotal || 0);
    return b.createdAtMs - a.createdAtMs; 
  });

  return (
    <div className="locacoes-container dashboard-container">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>MINHAS LOCAÇÕES</h1>
          <p>Gestão de pedidos, datas e recebimentos.</p>
        </div>
        <button className="btn-primary-celebre" onClick={() => navigate('/locacoes/nova')}>+ NOVA LOCAÇÃO</button>
      </header>

      <div className="advanced-filter-bar">
        <div className="filter-main-row">
          <div className="search-group">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar por cliente ou pedido..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="select-group">
            <select value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)}>
              <option value="todos">🔧 Todos os Serviços</option>
              <option value="pegue">📦 Apenas Pegue e Monte</option>
              <option value="decoracao">✨ Apenas Decoração</option>
            </select>
            <select value={filtroOrdenacao} onChange={(e) => setFiltroOrdenacao(e.target.value)}>
              <option value="recentes">🌟 Mais Recentes / Novos</option>
              <option value="proximos">📅 Eventos Mais Próximos</option>
              <option value="maiorValor">💰 Maior Valor</option>
            </select>
          </div>
        </div>

        <div className="filter-chips-row">
          <span className="chips-label">STATUS DOS PEDIDOS:</span>
          <div className="chips-list">
            <button type="button" className={`chip-btn ${filtroStatus === 'todos' ? 'active' : ''}`} onClick={() => setFiltroStatus('todos')}>Em Processo</button>
            <button type="button" className={`chip-btn ${filtroStatus === 'orcamentos' ? 'active orcamento' : ''}`} onClick={() => setFiltroStatus('orcamentos')}>Orçamentos</button>
            <button type="button" className={`chip-btn ${filtroStatus === 'confirmados' ? 'active confirmado' : ''}`} onClick={() => setFiltroStatus('confirmados')}>Confirmados</button>
            <button type="button" className={`chip-btn ${filtroStatus === 'finalizados' ? 'active' : ''}`} onClick={() => setFiltroStatus('finalizados')} style={{backgroundColor: filtroStatus === 'finalizados' ? '#0f172a' : '', color: filtroStatus === 'finalizados' ? '#fff' : ''}}>Arquivados ✔️</button>
            <button type="button" className={`chip-btn ${filtroStatus === 'cancelados' ? 'active cancelado' : ''}`} onClick={() => setFiltroStatus('cancelados')}>Lixeira / Perdidos</button>
          </div>
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
              <tr><td colSpan="7" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum pedido encontrado.</td></tr>
            ) : (
              filtrados.map(item => {
                const valorTotal = Number(item.valorTotal || 0);
                const valorPago = Number(item.valorPago || 0);
                const saldoDevedor = valorTotal - valorPago;
                const statusStr = String(item.status || '').toLowerCase();
                const isCancelado = statusStr.includes('cancelado') || item.isOrcamentoVencido;
                const isOrcamento = statusStr.includes('orcam'); 
                
                const temProblema = item.itens?.some(i => i.voltaStatus === 'avaria' || i.voltaStatus === 'sumiu' || i.avaria || i.faltou);

                let alertaOperacional = null;
                let corAlerta = '';

                // 🔥 REGRA MATEMÁTICA DOS 4 DIAS APLICADA AQUI 🔥
                if (item.dataRetirada && !statusStr.includes('finalizado') && !statusStr.includes('cancelado') && !item.isOrcamentoVencido) {
                    const hoje = new Date(); hoje.setHours(0,0,0,0);
                    const locDate = new Date(item.dataRetirada + 'T00:00:00');
                    const devDate = item.dataDevolucao ? new Date(item.dataDevolucao + 'T00:00:00') : locDate;

                    const diffMs = locDate.getTime() - hoje.getTime();
                    const diasParaFesta = Math.ceil(diffMs / (1000 * 3600 * 24));

                    if (statusStr.includes('confirmado') && diasParaFesta <= 4 && diasParaFesta >= 0) {
                        alertaOperacional = `📦 Separar Peças! (${diasParaFesta === 0 ? 'É Hoje!' : `Faltam ${diasParaFesta} dias`})`; 
                        corAlerta = "#f59e0b"; 
                    } else if (statusStr.includes('preparacao') && diasParaFesta <= 0) {
                        alertaOperacional = "🚚 Entregar Hoje!"; 
                        corAlerta = "#ef4444"; 
                    } else if (statusStr.includes('entregue') && devDate.getTime() <= hoje.getTime()) {
                        alertaOperacional = "⏳ Cobrar Devolução!"; 
                        corAlerta = "#ef4444"; 
                    }
                }

                return (
                  <tr key={item.id} className={temProblema ? 'linha-alerta' : ''} style={{ opacity: isCancelado ? 0.6 : 1, cursor: 'pointer' }} onClick={() => navigate(`/locacoes/editar/${item.id}`)}>
                    <td className="pedido-id-cell">
                      {item.numeroPedido ? `#${item.numeroPedido}` : item.id ? `#${item.id.substring(0,6).toUpperCase()}` : item.isOrcamentoVencido ? <span style={{color: '#ef4444', fontWeight: 'bold', fontSize: '11px'}}>PERDIDO</span> : isOrcamento ? <span style={{color: '#f59e0b', fontWeight: 'bold', fontSize: '11px'}}>ORÇAMENTO</span> : <span style={{color: '#94a3b8', fontWeight: 'bold'}}>#S/N</span>}
                    </td>
                    <td className="cliente-info-cell">
                      <strong style={{textDecoration: isCancelado ? 'line-through' : 'none', color: 'var(--texto-principal)', fontSize: '15px'}}>{item.clienteNome}</strong>
                      <div className="tags-row">
                        <span className={`tag-servico ${item.tipoServicoFormatado.includes('PEGUE') ? 'pegue' : 'deco'}`}>{item.tipoServicoFormatado}</span>
                        {temProblema && <span className="tag-alerta erro">B.O. NA DEVOLUÇÃO</span>}
                      </div>
                    </td>
                    <td className="mobile-stack"><span className="mobile-label">DATA:</span><span>{item.dataRetirada ? new Date(item.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span></td>
                    <td className="mobile-stack"><span className="mobile-label">TOTAL:</span><span className="valor-total">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></td>
                    <td className="mobile-stack"><span className="mobile-label">A RECEBER:</span><span className={saldoDevedor > 0 ? "txt-perigo" : "txt-sucesso"}>{saldoDevedor > 0 ? `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✅ PAGO'}</span></td>
                    <td className="status-cell">
                      <span className={`status-pill-v2 ${item.isOrcamentoVencido ? 'cancelado' : statusStr.replace(' ', '')}`}>{item.isOrcamentoVencido ? 'PERDIDO' : item.status?.trim().toUpperCase() || 'S/S'}</span>
                      {alertaOperacional && <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: '800', color: corAlerta, textTransform: 'uppercase' }}>{alertaOperacional}</div>}
                    </td>
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="dropdown-container">
                        <button className="btn-pontinhos" onClick={(e) => { e.stopPropagation(); setMenuAberto(menuAberto === item.id ? null : item.id); }}>⋮</button>
                        
                        {menuAberto === item.id && (
                          <div className="menu-suspenso">
                            {saldoDevedor > 0 && !isCancelado && !isOrcamento && (
                              <button onClick={(e) => { e.stopPropagation(); setPedidoSelecionado(item); setModalPagamento(true); setMenuAberto(null); }} className="item-menu">💰 Receber Pagamento</button>
                            )}

                            {!isOrcamento && !isCancelado && !statusStr.includes('finalizado') && (
                              <button onClick={(e) => { e.stopPropagation(); abrirModalChecklist(item, statusStr.includes('entregue') ? 'volta' : 'ida'); }} className="item-menu" style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '8px' }}>
                                {statusStr.includes('entregue') ? '📥 Checklist de Devolução' : '📦 Checklist de Saída'}
                              </button>
                            )}
                            
                            {statusStr.includes('finalizado') && (
                              <button onClick={(e) => { e.stopPropagation(); abrirModalChecklist(item, 'volta'); }} className="item-menu" style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '8px' }}>
                                🔎 Ver Conferência (Checklist)
                              </button>
                            )}

                            {temProblema && (
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/termo-ocorrencia/${item.id}`); }} className="item-menu" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', fontWeight: '700' }}>
                                ⚠️ Imprimir Termo (Avaria/Falta)
                              </button>
                            )}

                            <button onClick={(e) => { e.stopPropagation(); navigate(`/locacoes/editar/${item.id}`); }} className="item-menu" style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '8px' }}>✏️ Editar Pedido</button>
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

      {modalChecklist && pedidoChecklist && (
        <div className="modal-overlay-v2" onClick={() => setModalChecklist(false)}>
            <div className="modal-box-v2" style={{maxWidth: '550px', padding: '0', overflow: 'hidden'}} onClick={e => e.stopPropagation()}>
                
                <div style={{padding: '20px 25px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                   <div>
                       <h3 style={{margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px'}}>
                           📝 Checklist {modoChecklist === 'ida' ? 'de Saída' : 'de Devolução'}
                       </h3>
                       <span style={{color: '#64748b', fontSize: '13px'}}>
                           {pedidoChecklist.clienteNome} • {pedidoChecklist.status.toUpperCase()}
                       </span>
                   </div>
                   <button onClick={() => setModalChecklist(false)} style={{background: 'none', border: 'none', fontSize: '24px', color: '#94a3b8', cursor: 'pointer'}}>×</button>
                </div>

                <div style={{padding: '20px 25px', maxHeight: '60vh', overflowY: 'auto', background: '#f8fafc'}}>
                    {itensChecklist.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#94a3b8'}}>Nenhum item neste pedido.</p>
                    ) : (
                        itensChecklist.map(item => (
                            <div key={item.id} style={{background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '15px', marginBottom: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'}}>
                                
                                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                    {modoChecklist === 'ida' && (
                                        <input 
                                            type="checkbox" 
                                            checked={item.idaOk} 
                                            onChange={() => toggleIda(item.id)}
                                            style={{width: '22px', height: '22px', cursor: 'pointer', accentColor: '#3b82f6'}}
                                        />
                                    )}
                                    <div style={{width: '45px', height: '45px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden'}}>
                                        {item.foto ? <img src={item.foto} style={{width:'100%', height:'100%', objectFit:'cover'}} alt=""/> : <span style={{fontSize: '20px'}}>📷</span>}
                                    </div>
                                    <strong style={{color: '#0f172a', fontSize: '15px'}}>{item.qtd}x {item.nome}</strong>
                                </div>

                                {modoChecklist === 'volta' && (
                                    <div style={{display: 'flex', gap: '8px', marginTop: '15px'}}>
                                        <button 
                                            onClick={() => setStatusVolta(item.id, 'ok')}
                                            className={`checklist-btn-volta ${item.voltaStatus === 'ok' ? 'ok-active' : ''}`}
                                        >
                                            ✔ OK
                                        </button>
                                        <button 
                                            onClick={() => setStatusVolta(item.id, 'avaria')}
                                            className={`checklist-btn-volta ${item.voltaStatus === 'avaria' ? 'avaria-active' : ''}`}
                                        >
                                            ⚠️ AVARIA
                                        </button>
                                        <button 
                                            onClick={() => setStatusVolta(item.id, 'sumiu')}
                                            className={`checklist-btn-volta ${item.voltaStatus === 'sumiu' ? 'sumiu-active' : ''}`}
                                        >
                                            ❌ SUMIU
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div style={{padding: '20px 25px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#fff'}}>
                    <button 
                        onClick={salvarChecklistNoBanco} 
                        disabled={salvandoChecklist}
                        style={{background: '#0f172a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: salvandoChecklist ? 'not-allowed' : 'pointer'}}
                    >
                        {salvandoChecklist ? 'Salvando...' : 'Salvar e Fechar'}
                    </button>
                </div>

            </div>
        </div>
      )}

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
                      <input type="number" step="0.01" value={pagamento.valor} onChange={e => setPagamento({...pagamento, valor: e.target.value})} required autoFocus />
                    </div>
                    <div className="form-group-pag">
                      <label>Forma de Pagamento</label>
                      <select value={pagamento.formaPagto} onChange={e => setPagamento({...pagamento, formaPagto: e.target.value})}>
                          <option value="Pix">Pix</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Cartão de Débito">Cartão de Débito</option>
                      </select>
                    </div>
                    <div className="form-group-pag">
                      <label>Data do Pagamento</label>
                      <input type="date" value={pagamento.data} onChange={e => setPagamento({...pagamento, data: e.target.value})} required />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={() => setModalPagamento(false)}>Cancelar</button>
                        <button type="submit" className="btn-confirm" disabled={salvandoPagamento}>Confirmar</button>
                    </div>
                </form>
            </div>
         </div>
      )}

    </div>
  );
};

export default Locacoes;