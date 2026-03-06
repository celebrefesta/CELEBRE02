import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Locacoes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'; 

const Locacoes = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    carregarLocacoes();
  }, []);

  const carregarLocacoes = async () => {
    try {
      const clientesSnapshot = await getDocs(collection(db, "clientes"));
      const dicionarioClientes = {};
      clientesSnapshot.forEach(doc => {
          const cData = doc.data();
          dicionarioClientes[doc.id] = cData.nome || cData.nomeCompleto || cData.razaoSocial || "Sem Nome";
      });

      const querySnapshot = await getDocs(collection(db, "locacoes"));
      
      const hoje = new Date();
      hoje.setHours(0,0,0,0);

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
        if (data.criadoEm) {
            timestampCriacao = data.criadoEm.toMillis ? data.criadoEm.toMillis() : new Date(data.criadoEm).getTime();
        }

        let statusReal = (data.status || '').toLowerCase();
        let isVencido = false;

        // 🔥 LIXEIRO AUTOMÁTICO DE ORÇAMENTOS VENCIDOS 🔥
        if (statusReal.includes('orcam') && data.dataRetirada) {
            const locDate = new Date(data.dataRetirada + 'T00:00:00');
            if (locDate.getTime() < hoje.getTime()) {
                // Se passou da data da festa e não foi confirmado, arquiva como Lead Perdido
                isVencido = true;
            }
        }

        return { 
            id: doc.id, 
            ...data, 
            status: statusReal, 
            isOrcamentoVencido: isVencido,
            clienteNome: nomeDoClienteReal, 
            tipoServicoFormatado: tipoServico, 
            createdAtMs: timestampCriacao 
        };
      });

      setLista(dados);
      setLoading(false);
    } catch (error) { 
        console.error(error); 
        setLoading(false); 
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

  let filtrados = [...lista];
  if (busca) {
    const termo = busca.toLowerCase();
    filtrados = filtrados.filter(i => 
      (i.clienteNome || '').toLowerCase().includes(termo) || 
      (i.numeroPedido || '').includes(termo)
    );
  }

  if (filtroStatus === 'todos') {
      filtrados = filtrados.filter(i => {
          const st = (i.status || '').toLowerCase();
          return st !== 'cancelado' && !i.isOrcamentoVencido;
      });
  } else if (filtroStatus === 'orcamentos') {
      filtrados = filtrados.filter(i => {
          const st = (i.status || '').toLowerCase();
          return st.includes('orcam') && !i.isOrcamentoVencido;
      });
  } else if (filtroStatus === 'confirmados') {
      filtrados = filtrados.filter(i => {
          const st = (i.status || '').toLowerCase();
          return !st.includes('orcam') && st !== 'cancelado' && !i.isOrcamentoVencido;
      });
  } else if (filtroStatus === 'cancelados') {
      filtrados = filtrados.filter(i => {
          const st = (i.status || '').toLowerCase();
          return st === 'cancelado' || i.isOrcamentoVencido;
      });
  }

  if (filtroServico === 'pegue') {
      filtrados = filtrados.filter(i => i.tipoServicoFormatado.includes('PEGUE'));
  } else if (filtroServico === 'decoracao') {
      filtrados = filtrados.filter(i => !i.tipoServicoFormatado.includes('PEGUE'));
  }

  filtrados.sort((a, b) => {
    const getPriority = (item) => {
        const st = (item.status || '').toLowerCase();
        if (st === 'cancelado' || item.isOrcamentoVencido) return 3; 
        if (st.includes('orcam')) return 2; 
        return 1; 
    };

    const pA = getPriority(a);
    const pB = getPriority(b);

    if (pA !== pB) return pA - pB;

    if (filtroOrdenacao === 'proximos') {
      const dataA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 9999999999999;
      const dataB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 9999999999999;
      return dataA - dataB;
    } else if (filtroOrdenacao === 'maiorValor') {
      return Number(b.valorTotal || 0) - Number(a.valorTotal || 0);
    } else if (filtroOrdenacao === 'menorValor') {
      return Number(a.valorTotal || 0) - Number(b.valorTotal || 0);
    } else {
      return b.createdAtMs - a.createdAtMs;
    }
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

      <div className="dashboard-cards">
        <div className="dash-card success">
          <div className="dash-icon">✅</div>
          <div className="dash-info">
            <h3>Confirmados / Ativos</h3>
            <h2>{lista.filter(i => {
                const s = (i.status || '').toLowerCase();
                return !['orcamento', 'cancelado'].includes(s) && !i.isOrcamentoVencido;
            }).length}</h2>
          </div>
        </div>
        <div className="dash-card warning">
          <div className="dash-icon">📂</div>
          <div className="dash-info">
            <h3>Orçamentos Futuros</h3>
            <h2>{lista.filter(i => (i.status || '').toLowerCase().includes('orcam') && !i.isOrcamentoVencido).length}</h2>
          </div>
        </div>
      </div>

      <div className="advanced-filter-bar">
        <div className="filter-main-row">
          <div className="search-group">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar por cliente ou pedido..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
            />
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
              <option value="menorValor">📉 Menor Valor</option>
            </select>
          </div>
        </div>

        <div className="filter-chips-row">
          <span className="chips-label">STATUS DOS PEDIDOS:</span>
          <div className="chips-list">
            <button type="button" className={`chip-btn ${filtroStatus === 'todos' ? 'active' : ''}`} onClick={() => setFiltroStatus('todos')}>Todos (Ativos)</button>
            <button type="button" className={`chip-btn ${filtroStatus === 'orcamentos' ? 'active orcamento' : ''}`} onClick={() => setFiltroStatus('orcamentos')}>Leads / Orçamentos</button>
            <button type="button" className={`chip-btn ${filtroStatus === 'confirmados' ? 'active confirmado' : ''}`} onClick={() => setFiltroStatus('confirmados')}>Confirmados</button>
            <button type="button" className={`chip-btn ${filtroStatus === 'cancelados' ? 'active cancelado' : ''}`} onClick={() => setFiltroStatus('cancelados')}>Lixeira / Leads Perdidos</button>
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
              <tr><td colSpan="7" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum pedido encontrado nesta filtragem.</td></tr>
            ) : (
              filtrados.map(item => {
                const valorTotal = Number(item.valorTotal || 0);
                const valorPago = Number(item.valorPago || 0);
                const saldoDevedor = valorTotal - valorPago;
                const statusStr = (item.status || '').toLowerCase();
                const isCancelado = statusStr === 'cancelado' || item.isOrcamentoVencido;
                const isOrcamento = statusStr.includes('orcam'); 
                
                const temAvaria = item.itens?.some(i => i.avaria);
                const temFalta = item.itens?.some(i => i.faltou);
                const temAlertas = temAvaria || temFalta;

                let alertaOperacional = null;
                let corAlerta = '';

                if (item.dataRetirada && !['finalizado', 'cancelado'].includes(statusStr) && !item.isOrcamentoVencido) {
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    
                    const amanha = new Date();
                    amanha.setDate(amanha.getDate() + 1);
                    amanha.setHours(0,0,0,0);

                    const locDate = new Date(item.dataRetirada + 'T00:00:00');
                    const devDate = item.dataDevolucao ? new Date(item.dataDevolucao + 'T00:00:00') : locDate;

                    if (statusStr === 'confirmado' && locDate.getTime() <= amanha.getTime()) {
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
                      ) : item.isOrcamentoVencido ? (
                        <span style={{color: '#ef4444', fontWeight: 'bold', fontSize: '11px'}}>LEAD PERDIDO</span>
                      ) : isOrcamento ? (
                        <span style={{color: '#f59e0b', fontWeight: 'bold', fontSize: '11px'}}>ORÇAMENTO DO SITE</span>
                      ) : (
                        <span style={{color: '#94a3b8', fontWeight: 'bold'}}>#S/N</span>
                      )}
                    </td>
                    <td className="cliente-info-cell">
                      <strong style={{textDecoration: isCancelado ? 'line-through' : 'none', color: 'var(--texto-principal)', fontSize: '15px'}}>
                        {item.clienteNome}
                      </strong>
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
                      <span className={`status-pill-v2 ${item.isOrcamentoVencido ? 'cancelado' : statusStr}`}>
                        {item.isOrcamentoVencido ? 'LEAD PERDIDO' : item.status?.toUpperCase() || 'S/S'}
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