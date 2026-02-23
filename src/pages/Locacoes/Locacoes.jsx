import React, { useState, useEffect } from 'react';
import './Locacoes.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'; 

const Locacoes = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DO MODAL DE PAGAMENTO ---
  const [modalPagamento, setModalPagamento] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [pagamento, setPagamento] = useState({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // 🌟 NOVO: ESTADOS DA AUDITORIA DE ESQUECIDOS 🌟
  const [pedidosEsquecidos, setPedidosEsquecidos] = useState([]);
  const [mostrarAuditoria, setMostrarAuditoria] = useState(false);

  // --- CARREGAR DADOS DO FIREBASE ---
  useEffect(() => {
    const carregarLocacoes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "locacoes"));
        const dados = querySnapshot.docs.map(doc => {
          const data = doc.data();
          
          // INTELIGÊNCIA: Define o tipo de serviço para aparecer na lista
          let tipoServico = "DECORAÇÃO";
          if (data.tipoServico || data.tipoDaFesta || data.modalidade) {
             tipoServico = String(data.tipoServico || data.tipoDaFesta || data.modalidade).toUpperCase();
          } else if (data.logistica && String(data.logistica.tipoFrete || data.logistica.frete).toUpperCase().includes('RETIRADA')) {
             tipoServico = "PEGUE E MONTE";
          }

          return {
            id: doc.id,
            ...data,
            tipoServicoFormatado: tipoServico
          };
        });

        const ordenado = dados.sort((a, b) => {
          const numA = a.numeroPedido || '';
          const numB = b.numeroPedido || '';
          return numB.localeCompare(numA);
        });

        // 🌟 INTELIGÊNCIA DE AUDITORIA: Procurar pedidos que já passaram da data e não foram resolvidos
        const hojeDate = new Date();
        hojeDate.setHours(0,0,0,0);

        const esquecidos = ordenado.filter(item => {
          if (!item.dataRetirada) return false;
          
          const statusAtual = (item.status || '').toLowerCase();
          // Se já está entregue, finalizado ou cancelado, ele seguiu o fluxo, não é esquecido
          if (['entregue', 'finalizado', 'cancelado'].includes(statusAtual)) return false;
          
          const locDate = new Date(item.dataRetirada + 'T00:00:00');
          const diffTime = locDate.getTime() - hojeDate.getTime();
          const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Se a diferença for menor que 0, a data da festa já passou!
          return diffDias < 0; 
        });

        if (esquecidos.length > 0) {
          setPedidosEsquecidos(esquecidos);
          setMostrarAuditoria(true); // Abre o popup forçando a correção
        }

        setLista(ordenado);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar locações:", error);
        setLoading(false);
      }
    };
    carregarLocacoes();
  }, []);

  // 🌟 NOVO: FUNÇÃO PARA RESOLVER PEDIDOS ESQUECIDOS DIRETO NO POPUP 🌟
  const resolverPedidoEsquecido = async (id, novoStatus) => {
    try {
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      
      // Atualiza a lista principal de fundo
      setLista(prev => prev.map(item => item.id === id ? { ...item, status: novoStatus } : item));
      
      // Remove do popup
      const novaListaEsquecidos = pedidosEsquecidos.filter(item => item.id !== id);
      setPedidosEsquecidos(novaListaEsquecidos);
      
      // Se não tiver mais nenhum erro, fecha o popup sozinho
      if(novaListaEsquecidos.length === 0) setMostrarAuditoria(false);
      
    } catch (e) {
      alert("Erro ao corrigir o pedido.");
    }
  };


  // --- FUNÇÃO EXCLUIR ---
  const handleExcluir = async (id) => {
    if (window.confirm("Tem certeza que deseja apagar este pedido?")) {
      try {
        await deleteDoc(doc(db, "locacoes", id));
        setLista(lista.filter(item => item.id !== id));
      } catch (error) {
        alert("Erro ao excluir.");
      }
    }
  };

  // --- ABRIR MODAL DE PAGAMENTO ---
  const handleAbrirPagamento = (pedido) => {
    setPedidoSelecionado(pedido);
    setPagamento({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
    setModalPagamento(true);
  };

  // --- REGISTRAR PAGAMENTO ---
  const registrarPagamento = async (e) => {
    e.preventDefault();
    if (!pagamento.valor || Number(pagamento.valor) <= 0) return alert("Insira um valor válido.");

    setSalvandoPagamento(true);
    try {
      const valorPagoNum = Number(pagamento.valor);
      const valorJaPago = Number(pedidoSelecionado.valorPago || 0);
      const novoValorPago = valorJaPago + valorPagoNum;

      const pedidoRef = doc(db, "locacoes", pedidoSelecionado.id);
      await updateDoc(pedidoRef, { valorPago: novoValorPago });

      await addDoc(collection(db, "financeiro_lancamentos"), {
        tipo: 'entrada',
        categoria: 'Locação',
        descricao: `Ref. Pedido #${pedidoSelecionado.numeroPedido || 'S/N'} - ${pedidoSelecionado.clienteNome}`,
        valor: valorPagoNum,
        formaPagto: pagamento.formaPagto,
        data: pagamento.data,
        status: 'pago',
        createdAt: serverTimestamp()
      });

      alert("Pagamento registrado com sucesso no Caixa!");
      
      setLista(lista.map(item => 
        item.id === pedidoSelecionado.id ? { ...item, valorPago: novoValorPago } : item
      ));

      setModalPagamento(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao registrar pagamento.");
    } finally {
      setSalvandoPagamento(false);
    }
  };

  // --- FILTRO DE BUSCA ---
  const filtrados = lista.filter(item => 
    (item.clienteNome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (item.numeroPedido || '').includes(busca)
  );

  return (
    <div className="pagina-lista-v2">
      <header className="cabecalho-v2">
        <div>
          <h1>Minhas Locações</h1>
          <p>Gerencie seus pedidos e pagamentos</p>
        </div>
        <button className="btn-novo-v2" onClick={() => navigate('/locacoes/nova')}>
          + NOVA LOCAÇÃO
        </button>
      </header>

      {/* CARDS DE RESUMO */}
      <div className="resumo-topo-v2">
        <div className="card-resumo-v2">
          <span>Confirmados</span>
          <strong>{lista.filter(i => (i.status || '').toLowerCase() !== 'orcamento' && (i.status || '').toLowerCase() !== 'cancelado').length}</strong>
        </div>
        <div className="card-resumo-v2">
          <span>Orçamentos</span>
          <strong>{lista.filter(i => (i.status || '').toLowerCase() === 'orcamento').length}</strong>
        </div>
        <div className="card-resumo-v2">
          <span>Total Pedidos</span>
          <strong>{lista.length}</strong>
        </div>
      </div>

      <div className="barra-busca-v2">
        <input 
          placeholder="🔎 Buscar por cliente ou nº do pedido..." 
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      <div className="tabela-container-v2">
        <table className="tabela-v2">
          <thead>
            <tr>
              <th>PEDIDO</th>
              <th>CLIENTE / TIPO</th>
              <th>DATA EVENTO</th>
              <th>VALOR TOTAL</th>
              <th>FALTA RECEBER</th>
              <th>STATUS</th>
              <th className="centro">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="centro" style={{padding: '30px', color: '#64748b'}}>Carregando locações...</td></tr>
            ) : (
              filtrados.map((item) => {
                const valorTotal = Number(item.valorTotal || 0);
                const valorPago = Number(item.valorPago || 0);
                const saldoDevedor = valorTotal - valorPago;
                const isOrcamento = (item.status || '').toLowerCase().includes('orcam');
                const isCancelado = (item.status || '').toLowerCase() === 'cancelado';
                const isPegueMonte = item.tipoServicoFormatado.includes('PEGUE');

                const temAvaria = item.itens?.some(i => i.avaria === true);
                const temFalta = item.itens?.some(i => i.faltou === true);

                return (
                  <tr key={item.id} style={{ backgroundColor: (temAvaria || temFalta) ? '#fef2f2' : (isCancelado ? '#f1f5f9' : 'transparent'), opacity: isCancelado ? 0.6 : 1 }}>
                    <td className="destaque-azul">
                      {item.numeroPedido ? `#${item.numeroPedido}` : <span className="tag-antigo">Antigo</span>}
                    </td>
                    <td>
                      <strong style={{textDecoration: isCancelado ? 'line-through' : 'none'}}>{item.clienteNome}</strong>
                      
                      {/* ALERTAS DE AVARIA E FALTA DIRETO NA TABELA */}
                      {temFalta && (
                        <span style={{fontSize: '0.65rem', background: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold'}}>
                          ❌ FALTAM PEÇAS
                        </span>
                      )}
                      {temAvaria && !temFalta && (
                        <span style={{fontSize: '0.65rem', background: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold'}}>
                          ⚠️ AVARIAS
                        </span>
                      )}
                      
                      <br/>
                      
                      <span style={{
                        fontSize: '9px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-block',
                        backgroundColor: isPegueMonte ? '#fef3c7' : '#f1f5f9',
                        color: isPegueMonte ? '#b45309' : '#0f172a',
                        border: `1px solid ${isPegueMonte ? '#fde68a' : '#e2e8f0'}`
                      }}>
                        {isPegueMonte ? '📦 PEGUE E MONTE' : '✨ DECORAÇÃO'}
                      </span>
                    </td>
                    <td>
                      {item.dataRetirada ? new Date(item.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    
                    <td>R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    
                    <td className={saldoDevedor > 0 ? "txt-vermelho" : "txt-verde"}>
                      {saldoDevedor > 0 ? `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✅ Pago'}
                    </td>
                    
                    <td>
                      {isCancelado ? (
                        <span className="status-pill orcamento" style={{background: '#cbd5e1', color: '#334155'}}>CANCELADO</span>
                      ) : (
                        <span className={`status-pill ${isOrcamento ? 'orcamento' : 'confirmado'}`}>
                          {isOrcamento ? 'ORÇAMENTO' : 'CONFIRMADO'}
                        </span>
                      )}
                    </td>
                    <td className="centro col-acoes">
                      
                      <button className="btn-acao pagamento" title="Registrar Pagamento" onClick={() => handleAbrirPagamento(item)} disabled={saldoDevedor <= 0 || isCancelado} style={{ opacity: (saldoDevedor <= 0 || isCancelado) ? 0.3 : 1 }}>
                        💰
                      </button>

                      <button className="btn-acao editar" title="Editar" onClick={() => navigate(`/locacoes/editar/${item.id}`)}>
                        ✏️
                      </button>

                      <button className="btn-acao excluir" title="Excluir" onClick={() => handleExcluir(item.id)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL DE REGISTRAR PAGAMENTO --- */}
      {modalPagamento && pedidoSelecionado && (
        <div className="modal-overlay-v2">
          <div className="modal-box-v2 pagamento-box">
            <div className="modal-header">
              <h3>💰 Receber Pagamento</h3>
              <button className="btn-fechar" onClick={() => setModalPagamento(false)}>X</button>
            </div>
            
            <div className="info-pedido-pagamento">
              <p><strong>Cliente:</strong> {pedidoSelecionado.clienteNome}</p>
              <p><strong>Pedido:</strong> #{pedidoSelecionado.numeroPedido}</p>
              <p><strong>Falta Receber:</strong> R$ {(Number(pedidoSelecionado.valorTotal || 0) - Number(pedidoSelecionado.valorPago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>

            <form onSubmit={registrarPagamento} className="form-pagamento">
              <div className="form-group-pag">
                <label>Valor Recebido (R$)</label>
                <input type="number" step="0.01" required autoFocus value={pagamento.valor} onChange={e => setPagamento({...pagamento, valor: e.target.value})} />
              </div>
              <div className="form-group-pag">
                <label>Forma de Pagamento</label>
                <select value={pagamento.formaPagto} onChange={e => setPagamento({...pagamento, formaPagto: e.target.value})}>
                  <option value="Pix">PIX</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Transferência">Transferência / TED</option>
                </select>
              </div>
              <div className="form-group-pag">
                <label>Data do Recebimento</label>
                <input type="date" required value={pagamento.data} onChange={e => setPagamento({...pagamento, data: e.target.value})} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalPagamento(false)}>Cancelar</button>
                <button type="submit" className="btn-confirm" disabled={salvandoPagamento}>
                  {salvandoPagamento ? "Registrando..." : "✔ Confirmar Recebimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 NOVO MODAL: AUDITORIA DE PEDIDOS ESQUECIDOS (FORÇA CORREÇÃO) 🌟 */}
      {mostrarAuditoria && (
        <div className="modal-overlay-v2" style={{zIndex: 9999, backgroundColor: 'rgba(15, 23, 42, 0.85)'}}>
          <div className="modal-box-v2" style={{maxWidth: '850px', padding: 0, overflow: 'hidden'}}>
            
            <div style={{background: '#fef2f2', padding: '25px', borderBottom: '3px solid #fecaca'}}>
              <h2 style={{color: '#dc2626', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
                <span style={{fontSize: '2rem'}}>🚨</span> Auditoria de Estoque: Pedidos Atrasados!
              </h2>
              <p style={{color: '#991b1b', margin: 0, fontSize: '0.95rem', fontWeight: '500', lineHeight: '1.5'}}>
                As datas dos eventos abaixo já passaram, mas o sistema diz que eles ainda não saíram da loja (estão como Orçamento ou Separação). <b>Isso está bloqueando e mentindo sobre a disponibilidade das suas peças no estoque!</b>
              </p>
            </div>
            
            <div style={{padding: '20px', maxHeight: '55vh', overflowY: 'auto', background: '#f8fafc'}}>
              {pedidosEsquecidos.map(req => (
                <div key={req.id} style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', padding: '15px 20px', borderRadius: '10px', marginBottom: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)'}}>
                  
                  <div style={{flex: 1, minWidth: '250px'}}>
                    <strong style={{fontSize: '1.1rem', color: '#0f172a'}}>{req.clienteNome}</strong> <span style={{color: '#64748b'}}>#{req.numeroPedido || 'S/N'}</span><br/>
                    <div style={{marginTop: '5px', fontSize: '0.85rem', color: '#475569'}}>
                      Data da Festa: <b style={{color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px'}}>{req.dataRetirada.split('-').reverse().join('/')}</b>
                      <span style={{margin: '0 10px'}}>|</span> 
                      Travado em: <b style={{textTransform: 'uppercase'}}>{req.status}</b>
                    </div>
                  </div>

                  <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                    <button 
                      onClick={() => resolverPedidoEsquecido(req.id, 'cancelado')} 
                      style={{background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'}}
                      onMouseOver={(e) => e.target.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.target.style.background = '#ffffff'}
                    >
                      ❌ Cancelou a festa
                    </button>
                    
                    <button 
                      onClick={() => resolverPedidoEsquecido(req.id, 'finalizado')} 
                      style={{background: '#10b981', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)', transition: '0.2s'}}
                      onMouseOver={(e) => e.target.style.filter = 'brightness(0.9)'}
                      onMouseOut={(e) => e.target.style.filter = 'none'}
                    >
                      ✔️ Já levou e devolveu
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{padding: '15px 25px', background: '#ffffff', borderTop: '1px solid #e2e8f0', textAlign: 'right'}}>
              <button 
                onClick={() => setMostrarAuditoria(false)} 
                style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem'}}
              >
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