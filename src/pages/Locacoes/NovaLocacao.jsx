import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NovaLocacao.css'; 
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, addDoc, getCountFromServer, serverTimestamp } from 'firebase/firestore'; 

const NovaLocacao = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DO PEDIDO ---
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
    tipo: 'retirada', 
    cep: '', 
    rua: '', 
    numero: '', 
    bairro: '', 
    cidade: '', 
    frete: '', 
    obsTransporte: '' 
  });
  const [desconto, setDesconto] = useState(0);
  const [obsInternas, setObsInternas] = useState('');

  // 🌟 ESTADOS DO MODAL DE COMPRA RÁPIDA 🌟
  const [modalCompraAberto, setModalCompraAberto] = useState(false);
  const [formCompra, setFormCompra] = useState({
    nome: "", quantidade: 1, valorEstimado: "", categoria: "material", prazo: "", obs: ""
  });
  const [salvandoCompra, setSalvandoCompra] = useState(false);
  const [acaoSalvar, setAcaoSalvar] = useState('fechar'); // 'fechar' ou 'continuar'

  // --- CARREGAR DADOS ---
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [snapCli, snapEst] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "estoque"))
        ]);
        setClientes(snapCli.docs.map(d => ({ id: d.id, ...d.data() })));
        setEstoque(snapEst.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao carregar:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  const categoriasUnicas = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];

  const addCarrinho = (item) => {
    const precoItem = Number(item.financeiro?.valorAluguel || 0);
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
        } else {
          alert("CEP não encontrado.");
        }
      } catch (e) { console.error("Erro ao buscar CEP"); }
    }
  };

  const handleFreteChange = (e) => {
    let v = e.target.value.replace(/\D/g, ""); 
    if (!v) {
      setLogistica({ ...logistica, frete: "" });
      return;
    }
    v = (v / 100).toFixed(2) + ""; 
    v = v.replace(".", ","); 
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); 
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    setLogistica({ ...logistica, frete: v });
  };

  const handleSalvar = async (status) => {
    if (!clienteSelecionado || !datas.retirada) return alert("Preencha cliente e data de retirada!");
    try {
      const coll = collection(db, "locacoes");
      const snap = await getCountFromServer(coll);
      const count = snap.data().count + 1;
      const codigo = `${new Date().getFullYear()}-${count.toString().padStart(3, '0')}`;
      const nomeCliente = clientes.find(c => c.id === clienteSelecionado)?.nome || 'Cliente';

      const logisticaParaSalvar = {
        ...logistica,
        frete: getFreteNumerico()
      };

      await addDoc(coll, {
        numeroPedido: codigo,
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
        status,
        criadoEm: new Date()
      });
      alert(`Pedido ${codigo} salvo!`);
      navigate('/locacoes');
    } catch (e) { alert("Erro ao salvar."); }
  };

  const itensFiltrados = estoque.filter(item => {
    const matchesBusca = (item.nome || '').toLowerCase().includes(busca.toLowerCase());
    const matchesCategoria = filtroCategoria === 'Todos' || item.categoria === filtroCategoria;
    return matchesBusca && matchesCategoria;
  });

  // 🌟 FUNÇÕES DA COMPRA RÁPIDA ATUALIZADA 🌟
  const abrirModalCompra = () => {
    if (!clienteSelecionado) {
      alert("Selecione um cliente primeiro para podermos vincular as compras ao pedido dele!");
      return;
    }
    setModalCompraAberto(true);
  };

  const maskCurrency = (value) => {
    let v = value.replace(/\D/g, ""); 
    if (!v) return "";
    v = (v / 100).toFixed(2) + ""; 
    v = v.replace(".", ","); 
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); 
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    return v;
  };

  const handleSalvarCompraRapida = async (e) => {
    e.preventDefault();
    setSalvandoCompra(true);

    try {
      const nomeCliente = clientes.find(c => c.id === clienteSelecionado)?.nome || 'Cliente Atual';
      const nomeVinculo = temaFesta ? `${temaFesta} - ${nomeCliente}` : `Pedido em Criação de ${nomeCliente}`;
      
      let valorNumerico = 0;
      if (formCompra.valorEstimado) {
        valorNumerico = Number(formCompra.valorEstimado.replace(/\./g, "").replace(",", "."));
      }

      await addDoc(collection(db, "lista_compras"), {
        nome: formCompra.nome,
        quantidade: Number(formCompra.quantidade),
        valorEstimado: valorNumerico,
        categoria: formCompra.categoria,
        prazo: formCompra.prazo || datas.retirada || "",
        obs: formCompra.obs,
        vinculoTipo: "pedido",
        vinculoId: "pendente_salvamento", 
        vinculo: nomeVinculo,
        status: "pendente",
        createdAt: serverTimestamp()
      });

      // Limpa os campos para o próximo item
      setFormCompra({ nome: "", quantidade: 1, valorEstimado: "", categoria: "material", prazo: "", obs: "" });

      // Decide se fecha a tela ou não com base no botão clicado
      if (acaoSalvar === 'fechar') {
        alert("Item adicionado à lista de Compras com sucesso!");
        setModalCompraAberto(false);
      } else {
        alert("✅ Item salvo na lista! Pode digitar o próximo produto.");
        document.getElementById('compraNomeInput').focus(); // Foca no campo de nome de novo automaticamente
      }

    } catch (err) {
      alert("Erro ao salvar compra.");
      console.error(err);
    } finally {
      setSalvandoCompra(false);
    }
  };

  if (loading) return <div className="loading-v3">Carregando...</div>;

  return (
    <div className="pag-nova-locacao-v3">
      <header className="header-v3">
        <button className="btn-voltar-v3" onClick={() => navigate('/locacoes')}>← Voltar</button>
        <h2>Nova Locação</h2>
      </header>

      <div className="grid-v3">
        <div className="col-principal-v3">
          
          <div className="card-v3">
            <h3>👤 Dados do Evento</h3>
            
            <div className="form-row-v3" style={{ marginBottom: '20px' }}>
               <div className="input-group-v3 flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 <label>Modalidade de Serviço *</label>
                 <div style={{ display: 'flex', gap: '10px' }}>
                   <button 
                     type="button" 
                     onClick={() => {
                       setTipoServico('PEGUE E MONTE');
                       setLogistica({...logistica, tipo: 'retirada', frete: ''});
                     }}
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
                     onClick={() => {
                       setTipoServico('DECORACAO COMPLETA');
                       setLogistica({...logistica, tipo: 'entrega'});
                     }}
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

          <div className="card-v3">
            <div className="topo-itens-v3" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <h3>📦 Itens do Pedido</h3>
              <div style={{display: 'flex', gap: '10px'}}>
                <button className="btn-abrir-modal-v3" onClick={abrirModalCompra} style={{background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a'}}>
                  🛒 Faltou algo? (Comprar)
                </button>
                <button className="btn-abrir-modal-v3" onClick={() => setModalAberto(true)}>+ SELECIONAR PEÇAS</button>
              </div>
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
                placeholder="Anotações visíveis apenas para a equipe (ex: Cliente chorou desconto, verificar estado da peça XYZ no retorno...)" 
                value={obsInternas} 
                onChange={e => setObsInternas(e.target.value)}
              ></textarea>
            </div>
          </div>

        </div>

        <aside className="col-lateral-v3">
          <div className="card-v3 sticky-v3">
            <h3>💰 Financeiro</h3>
            <div className="lin-resumo-v3"><span>Subtotal Itens</span> <span>R$ {calcularTotal().subtotal.toFixed(2)}</span></div>
            <div className="lin-resumo-v3"><span>Frete</span> <span>+ R$ {getFreteNumerico().toFixed(2)}</span></div>
            <div className="lin-resumo-v3"><span>Desconto</span> <input type="number" value={desconto} onChange={e => setDesconto(e.target.value)} /></div>
            <div className="total-destaque-v3">R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            <button className="btn-confirmar-v3" onClick={() => handleSalvar('confirmado')}>✔ CONFIRMAR PEDIDO</button>
            <button className="btn-orcamento-v3" onClick={() => handleSalvar('orcamento')}>💾 SALVAR ORÇAMENTO</button>
          </div>
        </aside>
      </div>

      {/* MODAL DE PEÇAS */}
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

      {/* 🌟 MODAL: COMPRA RÁPIDA (COM BOTÕES DUPLOS) 🌟 */}
      {modalCompraAberto && (
        <div className="modal-overlay-v3" style={{zIndex: 9999}}>
          <div className="modal-content-v3" style={{maxWidth: '550px'}}>
            <div className="modal-header-v3" style={{borderBottom: 'none'}}>
              <div>
                <h3 style={{color: '#b45309', margin: 0, display: 'flex', alignItems: 'center', gap: '8px'}}>🛒 Adicionar à Lista de Compras</h3>
                <p style={{fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0'}}>Item será vinculado a este pedido automaticamente.</p>
              </div>
              <button onClick={() => setModalCompraAberto(false)}>X</button>
            </div>
            
            <form onSubmit={handleSalvarCompraRapida} style={{padding: '0 20px 20px 20px'}}>
              <div className="form-row-v3" style={{marginBottom: '15px'}}>
                <div className="input-group-v3 flex-1">
                  <label>O que precisa comprar? *</label>
                  <input id="compraNomeInput" type="text" placeholder="Ex: Bexiga Neon N9" value={formCompra.nome} onChange={e => setFormCompra({...formCompra, nome: e.target.value})} required autoFocus />
                </div>
              </div>

              <div className="form-row-v3" style={{marginBottom: '15px'}}>
                <div className="input-group-v3" style={{width: '80px'}}>
                  <label>Qtd *</label>
                  <input type="number" min="1" value={formCompra.quantidade} onChange={e => setFormCompra({...formCompra, quantidade: e.target.value})} required />
                </div>
                <div className="input-group-v3 flex-1">
                  <label>Valor Unit. Estimado (R$)</label>
                  <input type="text" placeholder="0,00" value={formCompra.valorEstimado} onChange={e => setFormCompra({...formCompra, valorEstimado: maskCurrency(e.target.value)})} />
                </div>
              </div>

              <div className="form-row-v3" style={{marginBottom: '15px'}}>
                <div className="input-group-v3 flex-1">
                  <label>Categoria da Compra</label>
                  <select value={formCompra.categoria} onChange={e => setFormCompra({...formCompra, categoria: e.target.value})}>
                    <option value="material">Material de Consumo (Bexiga, Fita...)</option>
                    <option value="acervo">Peça de Acervo (Vaso, Móvel...)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-v3" style={{marginBottom: '20px'}}>
                <div className="input-group-v3 flex-1">
                  <label>Observação (Onde comprar, cor...)</label>
                  <textarea rows="2" value={formCompra.obs} onChange={e => setFormCompra({...formCompra, obs: e.target.value})}></textarea>
                </div>
              </div>

              {/* 🌟 BOTÕES DE SALVAMENTO INTELIGENTES 🌟 */}
              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                <button type="button" onClick={() => setModalCompraAberto(false)} style={{flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#475569', cursor: 'pointer'}}>
                  Cancelar
                </button>
                <button type="submit" onClick={() => setAcaoSalvar('continuar')} disabled={salvandoCompra} style={{flex: 1, padding: '12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', fontWeight: 'bold', color: '#b45309', cursor: 'pointer', transition: '0.2s'}}>
                  {salvandoCompra && acaoSalvar === 'continuar' ? 'Salvando...' : '+ Salvar e Novo'}
                </button>
                <button type="submit" onClick={() => setAcaoSalvar('fechar')} disabled={salvandoCompra} style={{flex: 1, padding: '12px', background: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: '0.2s'}}>
                  {salvandoCompra && acaoSalvar === 'fechar' ? 'Salvando...' : 'Salvar e Fechar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default NovaLocacao;