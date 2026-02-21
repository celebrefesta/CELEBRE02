import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './NovaLocacao.css'; 
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'; 

const EditarLocacao = () => {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const [loading, setLoading] = useState(true);

  // --- ESTADOS ---
  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [temaFesta, setTemaFesta] = useState('');
  const [tipoServico, setTipoServico] = useState('PEGUE E MONTE'); 
  const [datas, setDatas] = useState({ retirada: '', devolucao: '' });
  
  const [logistica, setLogistica] = useState({ 
    tipo: 'entrega', cep: '', rua: '', numero: '', bairro: '', cidade: '', frete: '', obsTransporte: '' 
  });
  const [desconto, setDesconto] = useState(0);
  const [obsInternas, setObsInternas] = useState('');
  
  const [numeroPedido, setNumeroPedido] = useState('');
  const [statusAtual, setStatusAtual] = useState('');

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [snapCli, snapEst] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "estoque"))
        ]);
        setClientes(snapCli.docs.map(d => ({ id: d.id, ...d.data() })));
        setEstoque(snapEst.docs.map(d => ({ id: d.id, ...d.data() })));

        if (id) {
          const docRef = doc(db, "locacoes", id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            setNumeroPedido(data.numeroPedido || '');
            setStatusAtual(data.status || 'orcamento'); // Se não tiver, começa como orçamento
            setClienteSelecionado(data.clienteId || '');
            setTemaFesta(data.temaFesta || '');
            setTipoServico(data.tipoServico || 'PEGUE E MONTE');
            setDatas({ retirada: data.dataRetirada || '', devolucao: data.dataDevolucao || '' });
            
            const log = data.logistica || {};
            let freteFormatado = '';
            if (log.frete) {
              freteFormatado = Number(log.frete).toFixed(2).replace('.', ',');
            }

            setLogistica({
              tipo: log.tipo || 'entrega',
              cep: log.cep || '',
              rua: log.rua || log.endereco || '',
              numero: log.numero || '',
              bairro: log.bairro || '',
              cidade: log.cidade || '',
              frete: freteFormatado,
              obsTransporte: log.obsTransporte || ''
            });

            setCarrinho(data.itens || []);
            setDesconto(data.desconto || 0);
            setObsInternas(data.obsInternas || '');
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, [id]);

  const categoriasUnicas = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];

  const addCarrinho = (item) => {
    const precoItem = Number(item.financeiro?.valorAluguel || item.preco || 0);
    const existe = carrinho.find(i => i.id === item.id);
    if (existe) {
      setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setCarrinho([...carrinho, { ...item, qtd: 1, preco: precoItem }]);
    }
  };

  const getFreteNumerico = () => {
    if (!logistica.frete) return 0;
    return Number(logistica.frete.toString().replace(/\./g, "").replace(",", "."));
  };

  const calcularTotal = () => {
    const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const total = subtotal + getFreteNumerico() - Number(desconto);
    return { subtotal, total };
  };

  const handleCepChange = async (e) => {
    let value = e.target.value.replace(/\D/g, "");
    let cepFormatado = value.replace(/^(\d{5})(\d)/, "$1-$2").substring(0, 9);
    setLogistica(prev => ({ ...prev, cep: cepFormatado }));

    if (value.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const dados = await res.json();
        if (!dados.erro) {
          setLogistica(prev => ({
            ...prev, 
            cep: cepFormatado,
            rua: dados.logradouro || '',
            bairro: dados.bairro || '',
            cidade: `${dados.localidade || ''} - ${dados.uf || ''}`
          }));
          setTimeout(() => document.getElementById('numeroInput').focus(), 100);
        }
      } catch (e) { console.error("Erro ao buscar CEP"); }
    }
  };

  const handleFreteChange = (e) => {
    let v = e.target.value.replace(/\D/g, ""); 
    if (!v) { setLogistica({ ...logistica, frete: "" }); return; }
    v = (v / 100).toFixed(2) + ""; 
    v = v.replace(".", ","); 
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); 
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    setLogistica({ ...logistica, frete: v });
  };

  const handleSalvar = async (novoStatus) => {
    if (!clienteSelecionado || !datas.retirada) return alert("Preencha cliente e data de retirada!");
    
    // Confirmação para último passo (Dar Baixa)
    if (novoStatus === 'finalizado') {
        const confirmacao = window.confirm("Checklist de Volta OK? Esta ação marca as peças como devolvidas e finaliza o pedido.");
        if (!confirmacao) return;
    }

    try {
      const nomeCliente = clientes.find(c => c.id === clienteSelecionado)?.nome || 'Cliente';
      const logisticaParaSalvar = { ...logistica, frete: getFreteNumerico() };
      const statusFinal = novoStatus || statusAtual;

      const docRef = doc(db, "locacoes", id);
      await updateDoc(docRef, {
        clienteId: clienteSelecionado,
        clienteNome: nomeCliente,
        temaFesta,
        tipoServico, 
        dataRetirada: datas.retirada,
        dataDevolucao: datas.devolucao,
        itens: carrinho,
        logistica: logisticaParaSalvar,
        obsInternas,
        desconto: Number(desconto),
        valorTotal: calcularTotal().total,
        status: statusFinal,
        atualizadoEm: new Date()
      });
      
      if (novoStatus && novoStatus !== statusAtual) {
          alert(`✅ Pedido avançou para: ${novoStatus.toUpperCase()}`);
      } else {
          alert(`Alterações salvas com sucesso!`);
      }
      
      navigate('/locacoes');
    } catch (e) { alert("Erro ao atualizar o pedido."); }
  };

  const itensFiltrados = estoque.filter(item => {
    const matchesBusca = (item.nome || '').toLowerCase().includes(busca.toLowerCase());
    const matchesCategoria = filtroCategoria === 'Todos' || item.categoria === filtroCategoria;
    return matchesBusca && matchesCategoria;
  });

  // 🌟 FUNÇÃO QUE DEFINE A ETIQUETA VISUAL NO TOPO DA TELA 🌟
  const getBadgeStatus = () => {
    switch(statusAtual) {
      case 'orcamento': return { txt: '📝 ORÇAMENTO', cor: '#64748b' };
      case 'confirmado': return { txt: '✔ PEDIDO CONFIRMADO', cor: '#3b82f6' };
      case 'preparacao': return { txt: '📦 EM SEPARAÇÃO', cor: '#f59e0b' };
      case 'entregue': return { txt: '🚚 ENTREGUE / COM O CLIENTE', cor: '#8b5cf6' };
      case 'finalizado': return { txt: '✅ FINALIZADO (DEVOLVIDO)', cor: '#10b981' };
      default: return { txt: 'Desconhecido', cor: '#ccc' };
    }
  };

  const badgeInfo = getBadgeStatus();

  if (loading) return <div className="loading-v3">Carregando Pedido...</div>;

  return (
    <div className="pag-nova-locacao-v3">
      <header className="header-v3">
        <button className="btn-voltar-v3" onClick={() => navigate('/locacoes')}>← Voltar</button>
        <h2>
          Editar Pedido {numeroPedido && <span style={{color: '#c5a059'}}>#{numeroPedido}</span>}
        </h2>
        
        {/* SELO DE STATUS DINÂMICO */}
        <span style={{background: badgeInfo.cor, color: 'white', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', marginLeft: '15px'}}>
          {badgeInfo.txt}
        </span>
      </header>

      <div className="grid-v3">
        <div className="col-principal-v3">
          
          {/* --- DADOS DO EVENTO --- */}
          <div className="card-v3">
            <h3>👤 Dados do Evento</h3>

            <div className="form-row-v3" style={{ marginBottom: '20px' }}>
               <div className="input-group-v3 flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 <label>Modalidade de Serviço *</label>
                 <div style={{ display: 'flex', gap: '10px' }}>
                   <button 
                     type="button" 
                     onClick={() => { setTipoServico('PEGUE E MONTE'); setLogistica({...logistica, tipo: 'retirada', frete: ''}); }}
                     style={{
                       flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: 'pointer',
                       backgroundColor: tipoServico === 'PEGUE E MONTE' ? '#fef3c7' : '#fff',
                       color: tipoServico === 'PEGUE E MONTE' ? '#b45309' : '#64748b',
                       borderColor: tipoServico === 'PEGUE E MONTE' ? '#fde68a' : '#e2e8f0',
                       transition: 'all 0.2s'
                     }}>
                     📦 PEGUE E MONTE
                   </button>
                   <button 
                     type="button" 
                     onClick={() => { setTipoServico('DECORACAO COMPLETA'); setLogistica({...logistica, tipo: 'entrega'}); }}
                     style={{
                       flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: 'pointer',
                       backgroundColor: tipoServico === 'DECORACAO COMPLETA' ? '#0f172a' : '#fff',
                       color: tipoServico === 'DECORACAO COMPLETA' ? '#fff' : '#64748b',
                       borderColor: tipoServico === 'DECORACAO COMPLETA' ? '#0f172a' : '#e2e8f0',
                       transition: 'all 0.2s'
                     }}>
                     ✨ DECORAÇÃO COMPLETA
                   </button>
                 </div>
               </div>
            </div>

            <div className="form-row-v3" style={{ marginBottom: '15px' }}>
              <div className="input-group-v3 flex-2">
                <label>Cliente *</label>
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)}>
                  <option value="">Selecione...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome || c.nomeFantasia}</option>)}
                </select>
              </div>
              <div className="input-group-v3 flex-2">
                <label>Tema da Festa</label>
                <input type="text" placeholder="Ex: Safari, Casamento..." value={temaFesta} onChange={e => setTemaFesta(e.target.value)} />
              </div>
            </div>
            <div className="form-row-v3">
              <div className="input-group-v3 flex-1"><label>Data de Retirada / Evento *</label><input type="date" value={datas.retirada} onChange={e => setDatas({...datas, retirada: e.target.value})} /></div>
              <div className="input-group-v3 flex-1"><label>Data de Devolução</label><input type="date" value={datas.devolucao} onChange={e => setDatas({...datas, devolucao: e.target.value})} /></div>
            </div>
          </div>

          {/* --- LOGÍSTICA --- */}
          <div className="card-v3 logistica-card">
            <div className="header-logistica">
              <h3>🚚 Logística & Entrega</h3>
              <div className="logistica-toggle">
                <button type="button" className={logistica.tipo === 'entrega' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'entrega'})}>Com Frete</button>
                <button type="button" className={logistica.tipo === 'retirada' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'retirada', frete: ''})}>Retirada na Loja</button>
              </div>
            </div>

            {logistica.tipo === 'entrega' && (
              <>
                <div className="form-row-v3" style={{ marginBottom: '15px' }}>
                  <div className="input-group-v3 flex-1">
                    <label>CEP</label>
                    <input type="text" placeholder="00000-000" maxLength="9" value={logistica.cep} onChange={handleCepChange} />
                  </div>
                  <div className="input-group-v3 flex-2">
                    <label>Cidade / UF</label>
                    <input type="text" placeholder="Ex: Campinas - SP" value={logistica.cidade} onChange={e => setLogistica({...logistica, cidade: e.target.value})} />
                  </div>
                  <div className="input-group-v3 flex-1">
                    <label>Taxa de Entrega (R$)</label>
                    <input type="text" placeholder="0,00" value={logistica.frete} onChange={handleFreteChange} />
                  </div>
                </div>

                <div className="form-row-v3" style={{ marginBottom: '15px' }}>
                  <div className="input-group-v3 flex-2">
                    <label>Rua / Logradouro</label>
                    <input type="text" placeholder="Ex: Av. das Nações..." value={logistica.rua} onChange={e => setLogistica({...logistica, rua: e.target.value})} />
                  </div>
                  <div className="input-group-v3 flex-1">
                    <label>Número</label>
                    <input type="text" id="numeroInput" placeholder="Ex: 123" value={logistica.numero} onChange={e => setLogistica({...logistica, numero: e.target.value})} />
                  </div>
                  <div className="input-group-v3 flex-1">
                    <label>Bairro</label>
                    <input type="text" placeholder="Ex: Centro" value={logistica.bairro} onChange={e => setLogistica({...logistica, bairro: e.target.value})} />
                  </div>
                </div>
                
                <div className="form-row-v3">
                  <div className="input-group-v3 flex-2">
                    <label>Observações de Transporte</label>
                    <textarea rows="2" placeholder="Ex: Casa de esquina, portão branco, deixar com porteiro..." value={logistica.obsTransporte} onChange={e => setLogistica({...logistica, obsTransporte: e.target.value})}></textarea>
                  </div>
                </div>
              </>
            )}
            {logistica.tipo === 'retirada' && (
              <p style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', padding: '10px 0' }}>O cliente fará a retirada dos itens diretamente no nosso galpão/loja.</p>
            )}
          </div>

          {/* --- ITENS --- */}
          <div className="card-v3">
            <div className="topo-itens-v3">
              <h3>📦 Itens do Pedido</h3>
              <button className="btn-abrir-modal-v3" onClick={() => setModalAberto(true)}>+ SELECIONAR PEÇAS</button>
            </div>
            <table className="tabela-itens-v3">
              <thead><tr><th width="60">FOTO</th><th>PRODUTO</th><th className="centro">QTD</th><th className="direita">TOTAL</th><th></th></tr></thead>
              <tbody>
                {carrinho.map(item => (
                  <tr key={item.id}>
                    <td>
                      {item.foto ? (
                        <img src={item.foto} alt="Peça" style={{ width: '45px', height: '45px', borderRadius: '6px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '45px', height: '45px', background: '#e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📷</div>
                      )}
                    </td>
                    <td>
                      <strong>{item.nome}</strong>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>R$ {Number(item.preco).toFixed(2)} un</div>
                    </td>
                    <td className="centro">
                      <div className="qty-control-v3">
                        <button onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: Math.max(1, i.qtd-1)} : i))}>-</button>
                        <span>{item.qtd}</span>
                        <button onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: i.qtd+1} : i))}>+</button>
                      </div>
                    </td>
                    <td className="direita"><strong>R$ {(item.preco * item.qtd).toFixed(2)}</strong></td>
                    <td className="centro"><button className="btn-remover-v3" onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))}>×</button></td>
                  </tr>
                ))}
                {carrinho.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>Nenhuma peça adicionada ao pedido ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card-v3">
            <h3>🔒 Observações Internas</h3>
            <div className="input-group-v3">
              <textarea 
                rows="3" 
                placeholder="Anotações visíveis apenas para a equipe" 
                value={obsInternas} 
                onChange={e => setObsInternas(e.target.value)}
              ></textarea>
            </div>
          </div>

        </div>

        {/* --- FINANCEIRO E FUNIL DE PRODUÇÃO --- */}
        <aside className="col-lateral-v3">
          <div className="card-v3 sticky-v3">
            <h3>💰 Financeiro</h3>
            <div className="lin-resumo-v3"><span>Subtotal Itens</span> <span>R$ {calcularTotal().subtotal.toFixed(2)}</span></div>
            <div className="lin-resumo-v3"><span>Frete</span> <span>+ R$ {getFreteNumerico().toFixed(2)}</span></div>
            <div className="lin-resumo-v3"><span>Desconto</span> <input type="number" value={desconto} onChange={e => setDesconto(e.target.value)} /></div>
            <div className="total-destaque-v3">R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            
            <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0'}} />
            
            <h3 style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase'}}>
              Próximo Passo do Pedido
            </h3>

            {/* 🚨 A ESTEIRA DE PRODUÇÃO (SÓ VAI PRA FRENTE) 🚨 */}
            
            {statusAtual === 'orcamento' && (
              <button onClick={() => handleSalvar('confirmado')} style={{width: '100%', padding: '14px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', transition: '0.2s', marginBottom: '10px'}}>
                ✔ APROVAR PEDIDO
              </button>
            )}

            {statusAtual === 'confirmado' && (
              <button onClick={() => handleSalvar('preparacao')} style={{width: '100%', padding: '14px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer', backgroundColor: '#f59e0b', color: 'white', transition: '0.2s', marginBottom: '10px'}}>
                📦 INICIAR SEPARAÇÃO
              </button>
            )}

            {statusAtual === 'preparacao' && (
              <button onClick={() => handleSalvar('entregue')} style={{width: '100%', padding: '14px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer', backgroundColor: '#8b5cf6', color: 'white', transition: '0.2s', marginBottom: '10px'}}>
                🚚 MARCAR COMO ENTREGUE
              </button>
            )}

            {statusAtual === 'entregue' && (
              <button onClick={() => handleSalvar('finalizado')} style={{width: '100%', padding: '14px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', transition: '0.2s', marginBottom: '10px'}}>
                ✅ RECEBER E FINALIZAR
              </button>
            )}

            {statusAtual === 'finalizado' && (
              <div style={{background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', marginBottom: '10px'}}>
                🎉 Ciclo Concluído! Tudo Certo.
              </div>
            )}

            {/* Botão de Salvar apenas alterações no texto/itens (Não muda a etapa) */}
            {statusAtual !== 'finalizado' && (
              <button onClick={() => handleSalvar()} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700', cursor: 'pointer', backgroundColor: '#f8fafc', color: '#475569', transition: '0.2s'}}>
                💾 Apenas Salvar Alterações
              </button>
            )}

          </div>
        </aside>
      </div>

      {/* --- MODAL DO ESTOQUE --- */}
      {modalAberto && (
        <div className="modal-overlay-v3">
          <div className="modal-content-v3">
            <div className="modal-header-v3">
              <h3>Catálogo de Peças</h3>
              <button onClick={() => setModalAberto(false)}>X</button>
            </div>
            
            <input className="modal-busca-v3" placeholder="Pesquisar por nome..." value={busca} onChange={e => setBusca(e.target.value)} />
            
            <div className="modal-categorias-v3">
              {categoriasUnicas.map(cat => (
                <button 
                  key={cat} 
                  className={`btn-cat-v3 ${filtroCategoria === cat ? 'ativo' : ''}`}
                  onClick={() => setFiltroCategoria(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="modal-grid-v3">
              {itensFiltrados.map(item => (
                <div key={item.id} className="item-modal-card-v3" onClick={() => addCarrinho(item)}>
                  {item.foto ? <img src={item.foto} alt="" /> : <div className="no-img-v3">📷</div>}
                  <div className="info-item-v3">
                    <b>{item.nome}</b>
                    <small>{item.categoria}</small>
                    <span>R$ {item.financeiro?.valorAluguel || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditarLocacao;