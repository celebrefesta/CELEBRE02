import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Locacoes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'; 

const Locacoes = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(null);

  const [modalPagamento, setModalPagamento] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [pagamento, setPagamento] = useState({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  const [pedidosEsquecidos, setPedidosEsquecidos] = useState([]);
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
        return { id: doc.id, ...data, tipoServicoFormatado: tipoServico };
      });

      const ordenado = dados.sort((a, b) => (b.numeroPedido || '').localeCompare(a.numeroPedido || ''));
      setLista(ordenado);

      // Auditoria
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const esquecidos = ordenado.filter(item => {
        if (!item.dataRetirada || ['entregue', 'finalizado', 'cancelado'].includes((item.status || '').toLowerCase())) return false;
        const locDate = new Date(item.dataRetirada + 'T00:00:00');
        return (locDate.getTime() - hoje.getTime()) < 0;
      });

      if (esquecidos.length > 0) {
        setPedidosEsquecidos(esquecidos);
        setMostrarAuditoria(true);
      }
      setLoading(false);
    } catch (error) { console.error(error); setLoading(false); }
  };

  const resolverPedidoEsquecido = async (id, novoStatus) => {
    try {
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      setLista(prev => prev.map(item => item.id === id ? { ...item, status: novoStatus } : item));
      const novaListaEsquecidos = pedidosEsquecidos.filter(item => item.id !== id);
      setPedidosEsquecidos(novaListaEsquecidos);
      if(novaListaEsquecidos.length === 0) setMostrarAuditoria(false);
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

  const filtrados = lista.filter(i => 
    (i.clienteNome || '').toLowerCase().includes(busca.toLowerCase()) || (i.numeroPedido || '').includes(busca)
  );

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
          <span>Orçamentos</span>
          <strong>{lista.filter(i => (i.status || '').toLowerCase() === 'orcamento').length}</strong>
        </div>
      </div>

      <div className="filter-wrapper-clean">
        <div className="search-bar-container">
          <span className="search-icon">🔍</span>
          <input className="search-input-clean" placeholder="Buscar por cliente ou nº do pedido..." value={busca} onChange={e => setBusca(e.target.value)} />
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
              <th>A RECEBER</th> {/* 🔥 Título alterado no PC */}
              <th>STATUS</th>
              <th width="50px"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading-td">Carregando locações...</td></tr>
            ) : (
              filtrados.map(item => {
                const valorTotal = Number(item.valorTotal || 0);
                const valorPago = Number(item.valorPago || 0);
                const saldoDevedor = valorTotal - valorPago;
                const isCancelado = (item.status || '').toLowerCase() === 'cancelado';
                const isOrcamento = (item.status || '').toLowerCase().includes('orcam'); // 🔥 Verificação de Orçamento
                const temAlertas = item.itens?.some(i => i.avaria || i.faltou);

                return (
                  <tr key={item.id} className={temAlertas ? 'linha-alerta' : ''} style={{ opacity: isCancelado ? 0.6 : 1 }}>
                    <td className="pedido-id-cell">#{item.numeroPedido || '---'}</td>
                    <td className="cliente-info-cell">
                      <strong style={{textDecoration: isCancelado ? 'line-through' : 'none', color: 'var(--texto-principal)', fontSize: '15px'}}>{item.clienteNome}</strong>
                      <div className="tags-row">
                        <span className={`tag-servico ${item.tipoServicoFormatado.includes('PEGUE') ? 'pegue' : 'deco'}`}>
                          {item.tipoServicoFormatado}
                        </span>
                        {item.itens?.some(i => i.faltou) && <span className="tag-alerta erro">FALTAM PEÇAS</span>}
                        {item.itens?.some(i => i.avaria) && <span className="tag-alerta aviso">AVARIAS</span>}
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
                      <span className="mobile-label">A RECEBER:</span> {/* 🔥 Legenda alterada no Celular */}
                      <span className={saldoDevedor > 0 ? "txt-perigo" : "txt-sucesso"}>
                        {saldoDevedor > 0 ? `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✅ PAGO'}
                      </span>
                    </td>
                    
                    <td className="status-cell">
                      <span className={`status-pill-v2 ${(item.status || '').toLowerCase()}`}>
                        {item.status?.toUpperCase() || 'S/S'}
                      </span>
                    </td>
                    
                    <td className="actions-cell">
                      <div className="dropdown-container">
                        <button className="btn-pontinhos" onClick={() => setMenuAberto(menuAberto === item.id ? null : item.id)}>⋮</button>
                        {menuAberto === item.id && (
                          <div className="menu-suspenso">
                            
                            {/* 🔥 A MÁGICA: Botão oculto para Orçamento, Cancelado ou Saldo Zero */}
                            {saldoDevedor > 0 && !isCancelado && !isOrcamento && (
                              <button 
                                onClick={() => { 
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

                            <button onClick={() => navigate(`/locacoes/editar/${item.id}`)} className="item-menu">✏️ Editar</button>
                            <button onClick={() => handleExcluir(item.id)} className="item-menu item-excluir">🗑️ Excluir</button>
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
                      <input type="number" step="0.01" value={pagamento.valor} onChange={e => setPagamento({...pagamento, valor: e.target.value})} required autoFocus/>
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

      {/* MODAL AUDITORIA */}
      {mostrarAuditoria && (
        <div className="modal-overlay-v2">
          <div className="modal-box-v2 auditoria-box">
            <div className="auditoria-header">
              <h2>🚨 Auditoria de Estoque: Pedidos Atrasados!</h2>
              <p>As datas dos eventos abaixo já passaram, mas o sistema diz que eles ainda não saíram da loja. <b>Isso está bloqueando as suas peças no estoque!</b></p>
            </div>
            
            <div className="auditoria-body">
              {pedidosEsquecidos.map(req => (
                <div key={req.id} className="auditoria-card">
                  <div className="auditoria-info">
                    <strong>{req.clienteNome}</strong> <span>#{req.numeroPedido || 'S/N'}</span><br/>
                    <div className="auditoria-detalhes">
                      Data da Festa: <b className="auditoria-data">{req.dataRetirada.split('-').reverse().join('/')}</b>
                      <span className="divisor">|</span> 
                      Travado em: <b style={{textTransform: 'uppercase'}}>{req.status}</b>
                    </div>
                  </div>
                  <div className="auditoria-acoes">
                    <button onClick={() => resolverPedidoEsquecido(req.id, 'cancelado')} className="btn-resolver cancel">
                      ❌ Cancelou a festa
                    </button>
                    <button onClick={() => resolverPedidoEsquecido(req.id, 'finalizado')} className="btn-resolver ok">
                      ✔️ Já levou e devolveu
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="auditoria-footer">
              <button onClick={() => setMostrarAuditoria(false)}>
                Ignorar e corrigir depois (Não recomendado)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locacoes;