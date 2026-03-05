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

  // 🔥 TRAVA PRINCIPAL 🔥
  const isFinalizado = statusAtual === 'finalizado' || statusAtual === 'cancelado';

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
            setStatusAtual(data.status || 'orcamento'); 
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

            const itensFormatados = (data.itens || []).map(item => ({
              ...item,
              preco: Number(item.preco || item.financeiro?.valorAluguel || 0)
            }));
            setCarrinho(itensFormatados);
            
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
    if (isFinalizado) return; // Segurança extra
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
    const subtotal = carrinho.reduce((acc, item) => {
      const precoValido = Number(item.preco || item.financeiro?.valorAluguel || 0);
      return acc + (precoValido * (item.qtd || 1));
    }, 0);
    const total = subtotal + getFreteNumerico() - Number(desconto || 0);
    return { subtotal, total: Math.max(0, total) };
  };

  const handleCepChange = async (e) => {
    if (isFinalizado) return;
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
    if (isFinalizado) return;
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
    return (item.nome || '').toLowerCase().includes(busca.toLowerCase()) && 
           (filtroCategoria === 'Todos' || item.categoria === filtroCategoria);
  });

  const getBadgeStatus = () => {
    switch(statusAtual) {
      case 'orcamento': return { txt: '📝 ORÇAMENTO', cor: '#64748b' };
      case 'confirmado': return { txt: '✔ PEDIDO CONFIRMADO', cor: '#3b82f6' };
      case 'preparacao': return { txt: '📦 EM SEPARAÇÃO', cor: '#f59e0b' };
      case 'entregue': return { txt: '🚚 ENTREGUE / COM O CLIENTE', cor: '#8b5cf6' };
      case 'finalizado': return { txt: '✅ FINALIZADO (DEVOLVIDO)', cor: '#10b981' };
      case 'cancelado': return { txt: '❌ CANCELADO', cor: '#ef4444' };
      default: return { txt: 'Desconhecido', cor: '#ccc' };
    }
  };

  const badgeInfo = getBadgeStatus();

  if (loading) return <div className="loading-state">Carregando Pedido...</div>;

  return (
    <div className="locacao-form-container">
      
      <header className="page-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap'}}>
            <h1 className="page-title">{isFinalizado ? '🔎 Visualizar Pedido' : 'Editar Pedido'} {numeroPedido && <span style={{color: 'var(--dourado)'}}>#{numeroPedido}</span>}</h1>
            <span style={{background: badgeInfo.cor, color: 'white', padding: '6px 14px', borderRadius: '20px', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase'}}>
                {badgeInfo.txt}
            </span>
        </div>
        <button className="btn-voltar-link" onClick={() => navigate('/locacoes')}>← Voltar</button>
      </header>

      {/* AVISO DE MODO LEITURA */}
      {isFinalizado && (
          <div style={{background: '#f8fafc', borderLeft: '4px solid #94a3b8', padding: '12px 20px', marginBottom: '20px', color: '#475569', fontSize: '13px', borderRadius: '0 8px 8px 0'}}>
              <b>🔒 Modo Somente Leitura:</b> Este pedido já foi {statusAtual}, portanto seus dados e itens não podem mais ser alterados.
          </div>
      )}

      <div className="layout-duas-colunas">
        <div className="coluna-form" style={{opacity: isFinalizado ? 0.8 : 1}}>
          
          <div className="card-secao">
            <h3 className="section-divider">👤 DADOS DO EVENTO</h3>

            <div className="form-group mb-15">
              <label>MODALIDADE DE SERVIÇO *</label>
              <div className="toggle-servico" style={{pointerEvents: isFinalizado ? 'none' : 'auto'}}>
                <button type="button" className={`btn-toggle ${tipoServico === 'PEGUE E MONTE' ? 'active-pegue' : ''}`}
                  onClick={() => { setTipoServico('PEGUE E MONTE'); setLogistica({...logistica, tipo: 'retirada', frete: ''}); }}>
                  📦 PEGUE E MONTE
                </button>
                <button type="button" className={`btn-toggle ${tipoServico === 'DECORACAO COMPLETA' ? 'active-deco' : ''}`}
                  onClick={() => { setTipoServico('DECORACAO COMPLETA'); setLogistica({...logistica, tipo: 'entrega'}); }}>
                  ✨ DECORAÇÃO COMPLETA
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label>Cliente *</label>
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)} disabled={isFinalizado}>
                  <option value="">Selecione um cliente cadastrado...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome || c.nomeFantasia}</option>)}
                </select>
              </div>
              <div className="form-group flex-2">
                <label>Tema da Festa</label>
                <input type="text" placeholder="Ex: Safari, Casamento..." value={temaFesta} onChange={e => setTemaFesta(e.target.value)} disabled={isFinalizado}/>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group flex-1"><label>Data de Retirada / Evento *</label><input type="date" value={datas.retirada} onChange={e => setDatas({...datas, retirada: e.target.value})} disabled={isFinalizado}/></div>
              <div className="form-group flex-1"><label>Data de Devolução</label><input type="date" value={datas.devolucao} onChange={e => setDatas({...datas, devolucao: e.target.value})} disabled={isFinalizado}/></div>
            </div>
          </div>

          <div className="card-secao">
            <div className="header-com-toggle">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>🚚 LOGÍSTICA & ENTREGA</h3>
              <div className="toggle-simples" style={{pointerEvents: isFinalizado ? 'none' : 'auto'}}>
                <button type="button" className={logistica.tipo === 'entrega' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'entrega'})}>Com Frete</button>
                <button type="button" className={logistica.tipo === 'retirada' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'retirada', frete: ''})}>Retirada na Loja</button>
              </div>
            </div>

            {logistica.tipo === 'entrega' ? (
              <div className="logistica-form mt-15">
                <div className="form-row">
                  <div className="form-group flex-1"><label>CEP</label><input type="text" placeholder="00000-000" maxLength="9" value={logistica.cep} onChange={handleCepChange} disabled={isFinalizado}/></div>
                  <div className="form-group flex-2"><label>Cidade / UF</label><input type="text" placeholder="Ex: Campinas - SP" value={logistica.cidade} onChange={e => setLogistica({...logistica, cidade: e.target.value})} disabled={isFinalizado}/></div>
                  <div className="form-group flex-1"><label>Taxa Frete (R$)</label><input type="text" placeholder="0,00" value={logistica.frete} onChange={handleFreteChange} disabled={isFinalizado}/></div>
                </div>
                <div className="form-row">
                  <div className="form-group flex-2"><label>Logradouro</label><input type="text" placeholder="Av. das Nações..." value={logistica.rua} onChange={e => setLogistica({...logistica, rua: e.target.value})} disabled={isFinalizado}/></div>
                  <div className="form-group-inline flex-2">
                    <div className="form-group flex-1"><label>Número</label><input type="text" id="numeroInput" placeholder="123" value={logistica.numero} onChange={e => setLogistica({...logistica, numero: e.target.value})} disabled={isFinalizado}/></div>
                    <div className="form-group flex-2"><label>Bairro</label><input type="text" placeholder="Centro" value={logistica.bairro} onChange={e => setLogistica({...logistica, bairro: e.target.value})} disabled={isFinalizado}/></div>
                  </div>
                </div>
                <div className="form-group mt-10">
                  <label>Observações de Transporte</label>
                  <textarea rows="2" placeholder="Casa de esquina, deixar com porteiro..." value={logistica.obsTransporte} onChange={e => setLogistica({...logistica, obsTransporte: e.target.value})} disabled={isFinalizado}></textarea>
                </div>
              </div>
            ) : (
              <p className="texto-aviso-logistica mt-15">⚠️ O cliente fará a retirada e devolução dos itens diretamente no local.</p>
            )}
          </div>

          <div className="card-secao">
            <div className="header-com-botoes">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>📦 ITENS DO PEDIDO</h3>
              {/* Oculta botão de adicionar se estiver finalizado */}
              {!isFinalizado && (
                  <div className="botoes-acoes-itens">
                    <button type="button" className="btn-primary-outline" onClick={() => setModalAberto(true)}>+ ADC. PEÇAS</button>
                  </div>
              )}
            </div>

            <div className="carrinho-container mt-15">
              {carrinho.length === 0 ? (
                <div className="carrinho-vazio">Nenhuma peça adicionada.</div>
              ) : (
                <table className="tabela-carrinho">
                  <thead><tr><th width="50"></th><th>PRODUTO</th><th className="text-center">QTD</th><th className="text-right">TOTAL</th>{!isFinalizado && <th width="40"></th>}</tr></thead>
                  <tbody>
                    {carrinho.map(item => {
                      const precoExibicao = Number(item.preco || item.financeiro?.valorAluguel || 0);
                      
                      return (
                        <tr key={item.id} className="carrinho-item-card">
                          <td className="carrinho-img">
                            {item.foto ? <img src={item.foto} alt="Peça"/> : <div className="img-placeholder">📷</div>}
                          </td>
                          <td className="carrinho-info">
                            <strong>{item.nome}</strong>
                            <span>R$ {precoExibicao.toFixed(2)} un</span>
                          </td>
                          <td className="text-center">
                            {/* Controle de QTD blindado se finalizado */}
                            {isFinalizado ? (
                                <div style={{fontWeight: 'bold', fontSize: '14px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '6px', display: 'inline-block'}}>{item.qtd}x</div>
                            ) : (
                                <div className="controle-qtd">
                                  <button type="button" onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: Math.max(1, i.qtd-1)} : i))}>-</button>
                                  <span>{item.qtd}</span>
                                  <button type="button" onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: i.qtd+1} : i))}>+</button>
                                </div>
                            )}
                          </td>
                          <td className="text-right carrinho-total-item">
                            <strong>R$ {(precoExibicao * item.qtd).toFixed(2)}</strong>
                          </td>
                          {!isFinalizado && (
                              <td className="text-center">
                                <button type="button" className="btn-remover-item" onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))}>🗑️</button>
                              </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card-secao">
            <h3 className="section-divider">🔒 OBSERVAÇÕES INTERNAS</h3>
            <div className="form-group">
              <textarea rows="2" placeholder="Anotações visíveis apenas para a equipe" value={obsInternas} onChange={e => setObsInternas(e.target.value)} disabled={isFinalizado}></textarea>
            </div>
          </div>

        </div>

        <aside className="coluna-financeiro">
          <div className="card-financeiro-sticky">
            <h3>💰 Financeiro</h3>
            <div className="fin-linha"><span>Subtotal Itens</span> <span>R$ {calcularTotal().subtotal.toFixed(2)}</span></div>
            <div className="fin-linha"><span>Frete</span> <span>+ R$ {getFreteNumerico().toFixed(2)}</span></div>
            <div className="fin-linha desconto-linha">
              <span>Desconto (R$)</span> 
              {isFinalizado ? (
                  <strong>{desconto}</strong>
              ) : (
                  <input type="number" min="0" value={desconto} onChange={e => setDesconto(e.target.value)} />
              )}
            </div>
            
            <div className="fin-total">
              <span>TOTAL</span>
              <strong>R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>
            
            <hr style={{margin: '25px 0', border: 'none', borderTop: '2px dashed var(--borda)'}} />
            
            <h3 className="section-divider" style={{border: 'none', marginBottom: '15px'}}>PRÓXIMO PASSO DO PEDIDO</h3>

            <div className="fin-acoes" style={{marginTop: '0'}}>
                
                {statusAtual === 'orcamento' && (
                <button type="button" className="btn-salvar-form" onClick={() => handleSalvar('confirmado')} style={{backgroundColor: '#3b82f6', marginBottom: '10px'}}>
                    ✔ APROVAR PEDIDO
                </button>
                )}

                {statusAtual === 'confirmado' && (
                <button type="button" className="btn-salvar-form" onClick={() => handleSalvar('preparacao')} style={{backgroundColor: '#f59e0b', marginBottom: '10px'}}>
                    📦 INICIAR SEPARAÇÃO
                </button>
                )}

                {statusAtual === 'preparacao' && (
                <button type="button" className="btn-salvar-form" onClick={() => handleSalvar('entregue')} style={{backgroundColor: '#8b5cf6', marginBottom: '10px'}}>
                    🚚 MARCAR COMO ENTREGUE
                </button>
                )}

                {statusAtual === 'entregue' && (
                <button type="button" className="btn-salvar-form" onClick={() => handleSalvar('finalizado')} style={{backgroundColor: '#10b981', marginBottom: '10px'}}>
                    ✅ RECEBER E FINALIZAR
                </button>
                )}

                {isFinalizado && (
                <div style={{background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', marginBottom: '10px', fontSize: '13px'}}>
                    🎉 Ciclo Concluído! Tudo Certo.
                </div>
                )}

                {!isFinalizado && (
                <button type="button" className="btn-voltar-link" style={{width: '100%', justifyContent: 'center'}} onClick={() => handleSalvar()}>
                    💾 Apenas Salvar Alterações
                </button>
                )}
            </div>
          </div>
        </aside>
      </div>

      {modalAberto && !isFinalizado && (
        <div className="modal-overlay-premium">
          <div className="modal-box-premium catalogo-modal">
            <div className="modal-header">
              <h3>📦 Catálogo de Peças</h3>
              <button className="btn-fechar" onClick={() => setModalAberto(false)}>X</button>
            </div>
            
            <div className="catalogo-filtros">
              <input type="text" className="search-input-clean" style={{border: '1px solid var(--borda)', padding: '10px', borderRadius: '8px'}} placeholder="🔎 Buscar peça..." value={busca} onChange={e => setBusca(e.target.value)} />
              <div className="chips-categorias">
                {categoriasUnicas.map(cat => (
                  <button key={cat} type="button" className={`chip-cat ${filtroCategoria === cat ? 'active' : ''}`} onClick={() => setFiltroCategoria(cat)}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="catalogo-grid">
              {itensFiltrados.map(item => (
                <div key={item.id} className="peca-card" onClick={() => addCarrinho(item)}>
                  <div className="peca-img">
                      {item.foto ? <img src={item.foto} alt=""/> : '📷'}
                      <button className="btn-add-peca">+</button>
                  </div>
                  <div className="peca-info">
                    <strong>{item.nome}</strong>
                    <span>{item.categoria}</span>
                    <b className="txt-sucesso">R$ {item.financeiro?.valorAluguel || item.preco || 0}</b>
                  </div>
                </div>
              ))}
              {itensFiltrados.length === 0 && <p className="text-center w-100 mt-15" style={{color: 'var(--texto-secundario)'}}>Nenhuma peça encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditarLocacao;