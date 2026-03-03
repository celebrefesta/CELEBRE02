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
    tipo: 'retirada', cep: '', rua: '', numero: '', bairro: '', cidade: '', frete: '', referencia: '', obsTransporte: '' 
  });
  const [desconto, setDesconto] = useState(0);
  const [obsInternas, setObsInternas] = useState('');

  const [modalCompraAberto, setModalCompraAberto] = useState(false);
  
  const [formCompra, setFormCompra] = useState({ 
      nome: "", quantidade: 1, valorEstimado: "", valorAluguel: "", categoria: "material", prazo: "", fornecedor: "", obs: "" 
  });
  
  const [sugestoesCompra, setSugestoesCompra] = useState([]);

  const [salvandoCompra, setSalvandoCompra] = useState(false);
  const [acaoSalvar, setAcaoSalvar] = useState('fechar');

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

  const dispararCompraAutomatica = (item) => {
    let valorAlg = item.financeiro?.valorAluguel || "0,00";
    if (typeof valorAlg === 'number') valorAlg = valorAlg.toFixed(2).replace(".", ",");
    else if (!valorAlg && item.preco) valorAlg = Number(item.preco).toFixed(2).replace(".", ",");

    setFormCompra({
        nome: item.nome,
        quantidade: 1, 
        valorEstimado: "",
        valorAluguel: valorAlg,
        categoria: item.categoria || "acervo",
        prazo: datas.retirada || "",
        fornecedor: "",
        obs: "Peça adicionada automaticamente por falta de estoque no momento do pedido."
    });
    setModalCompraAberto(true);
  };

  const addCarrinho = (item) => {
    const precoItem = Number(item.financeiro?.valorAluguel || 0);
    const qtdEstoque = Number(item.quantidade) || 1; 
    
    const existe = carrinho.find(i => i.id === item.id);
    
    if (existe) {
      if (existe.qtd >= qtdEstoque && !existe.isPendenteCompra) {
          alert(`⚠️ Estoque Insuficiente!\nVocê possui apenas ${qtdEstoque} unidade(s) de "${item.nome}".\n\nVamos abrir a tela de COMPRA para adicionar a unidade faltante!`);
          dispararCompraAutomatica(item);
          return;
      }
      setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      if (qtdEstoque < 1) {
          alert(`⚠️ Estoque Zerado!\nVocê não possui "${item.nome}" disponível no acervo no momento.\n\nVamos abrir a tela de COMPRA para encomendar!`);
          dispararCompraAutomatica(item);
          return;
      }
      setCarrinho([...carrinho, { ...item, qtd: 1, preco: precoItem, qtdOriginal: qtdEstoque }]); 
    }
  };

  const getFreteNumerico = () => {
    if (!logistica.frete) return 0;
    return Number(logistica.frete.toString().replace(/\./g, "").replace(",", "."));
  };

  const calcularTotal = () => {
    const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const total = subtotal + getFreteNumerico() - Number(desconto);
    return { subtotal, total: Math.max(0, total) };
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
            ...prev, cep: cepFormatado, rua: dados.logradouro || '', bairro: dados.bairro || '', cidade: `${dados.localidade || ''} - ${dados.uf || ''}`
          }));
          setTimeout(() => document.getElementById('numeroInput').focus(), 100);
        }
      } catch (e) { console.error("Erro ao buscar CEP"); }
    }
  };

  const handleFreteChange = (e) => {
    let v = e.target.value.replace(/\D/g, ""); 
    if (!v) return setLogistica({ ...logistica, frete: "" });
    v = (v / 100).toFixed(2) + ""; 
    v = v.replace(".", ",").replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,").replace(/(\d)(\d{3}),/g, "$1.$2,");
    setLogistica({ ...logistica, frete: v });
  };

  const handleDataRetiradaChange = (e) => {
    const novaData = e.target.value;
    setDatas(prev => {
      if (prev.devolucao && novaData > prev.devolucao) {
        return { retirada: novaData, devolucao: novaData };
      }
      return { ...prev, retirada: novaData };
    });
  };

  const handleSalvar = async (status) => {
    if (!clienteSelecionado) return alert("Selecione o Cliente!");
    if (!temaFesta) return alert("Preencha o Tema da Festa!");
    if (!datas.retirada) return alert("Preencha a Data de Retirada!");
    if (!datas.devolucao) return alert("Preencha a Data de Devolução!");
    
    if (datas.devolucao && datas.retirada > datas.devolucao) {
        return alert("A data de devolução não pode ser menor que a data de retirada!");
    }

    try {
      const coll = collection(db, "locacoes");
      const snap = await getCountFromServer(coll);
      const count = snap.data().count + 1;
      const codigo = `${new Date().getFullYear()}-${count.toString().padStart(3, '0')}`;
      const nomeCliente = clientes.find(c => c.id === clienteSelecionado)?.nome || 'Cliente';

      await addDoc(coll, {
        numeroPedido: codigo, clienteId: clienteSelecionado, clienteNome: nomeCliente, temaFesta, tipoServico, 
        dataRetirada: datas.retirada, dataDevolucao: datas.devolucao, itens: carrinho, logistica: { ...logistica, frete: getFreteNumerico() }, 
        obsInternas, desconto: Number(desconto), valorTotal: calcularTotal().total, status, criadoEm: new Date()
      });
      alert(`Pedido ${codigo} salvo!`);
      navigate('/locacoes');
    } catch (e) { alert("Erro ao salvar."); }
  };

  const itensFiltrados = estoque.filter(item => {
    return (item.nome || '').toLowerCase().includes(busca.toLowerCase()) && 
           (filtroCategoria === 'Todos' || item.categoria === filtroCategoria);
  });

  const maskCurrency = (value) => {
    let v = value.replace(/\D/g, ""); 
    if (!v) return "";
    return (v / 100).toFixed(2).replace(".", ",").replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,").replace(/(\d)(\d{3}),/g, "$1.$2,");
  };

  const handleSalvarCompraRapida = async (e) => {
    e.preventDefault();
    setSalvandoCompra(true);
    try {
      const nomeCliente = clientes.find(c => c.id === clienteSelecionado)?.nome || 'Cliente Atual';
      const nomeVinculo = temaFesta ? `${temaFesta} - ${nomeCliente}` : `Pedido em Criação de ${nomeCliente}`;
      
      let valorCusto = formCompra.valorEstimado ? Number(formCompra.valorEstimado.replace(/\./g, "").replace(",", ".")) : 0;
      let valorAluguel = formCompra.valorAluguel ? Number(formCompra.valorAluguel.replace(/\./g, "").replace(",", ".")) : 0;

      const novaCompraRef = await addDoc(collection(db, "lista_compras"), {
        nome: formCompra.nome, quantidade: Number(formCompra.quantidade), valorEstimado: valorCusto, categoria: formCompra.categoria, 
        prazo: formCompra.prazo || datas.retirada || "", fornecedor: formCompra.fornecedor, obs: formCompra.obs, vinculoTipo: "pedido", vinculoId: "pendente_salvamento", 
        vinculo: nomeVinculo, status: "pendente", createdAt: serverTimestamp()
      });

      const itemParaCarrinho = {
        id: novaCompraRef.id, 
        nome: formCompra.nome,
        categoria: formCompra.categoria,
        foto: '', 
        preco: valorAluguel,
        qtd: Number(formCompra.quantidade),
        qtdOriginal: Number(formCompra.quantidade), 
        isPendenteCompra: true 
      };

      setCarrinho(prev => [...prev, itemParaCarrinho]);
      setFormCompra({ nome: "", quantidade: 1, valorEstimado: "", valorAluguel: "", categoria: "material", prazo: "", fornecedor: "", obs: "" });
      setSugestoesCompra([]);
      
      if (acaoSalvar === 'fechar') {
        alert("Lista de Compras e Carrinho atualizados com sucesso!");
        setModalCompraAberto(false);
      } else {
        alert("✅ Salvo no carrinho! Digite o próximo.");
        document.getElementById('compraNomeInput').focus();
      }
    } catch (err) { alert("Erro ao salvar compra."); } finally { setSalvandoCompra(false); }
  };

  if (loading) return <div className="loading-state">Carregando formulário...</div>;

  return (
    <div className="locacao-form-container">
      <header className="page-header">
        <h1 className="page-title">Nova Locação</h1>
        <button className="btn-voltar-link" onClick={() => navigate('/locacoes')}>← Voltar</button>
      </header>

      <div className="layout-duas-colunas">
        
        <div className="coluna-form">
          
          <div className="card-secao">
            <h3 className="section-divider">👤 DADOS DO EVENTO</h3>
            
            <div className="form-group mb-15">
              <label>MODALIDADE DE SERVIÇO *</label>
              <div className="toggle-servico">
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
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)}>
                  <option value="">Selecione um cliente cadastrado...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome || c.nomeFantasia}</option>)}
                </select>
              </div>
              <div className="form-group flex-2">
                <label>Tema da Festa *</label>
                <input type="text" placeholder="Ex: Safari, Casamento..." value={temaFesta} onChange={e => setTemaFesta(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Data de Retirada / Evento *</label>
                <input type="date" value={datas.retirada} onChange={handleDataRetiradaChange} />
              </div>
              <div className="form-group flex-1">
                <label>Data de Devolução *</label>
                <input type="date" min={datas.retirada} value={datas.devolucao} onChange={e => setDatas({...datas, devolucao: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="card-secao">
            <div className="header-com-toggle">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>🚚 LOGÍSTICA & ENTREGA</h3>
              <div className="toggle-simples">
                <button type="button" className={logistica.tipo === 'entrega' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'entrega'})}>Com Frete</button>
                <button type="button" className={logistica.tipo === 'retirada' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'retirada', frete: ''})}>Retirada na Loja</button>
              </div>
            </div>

            {logistica.tipo === 'entrega' ? (
              <div className="logistica-form mt-15">
                <div className="form-row">
                  <div className="form-group flex-1"><label>CEP</label><input type="text" placeholder="00000-000" maxLength="9" value={logistica.cep} onChange={handleCepChange} /></div>
                  <div className="form-group flex-2"><label>Cidade / UF</label><input type="text" placeholder="Ex: Campinas - SP" value={logistica.cidade} onChange={e => setLogistica({...logistica, cidade: e.target.value})} /></div>
                  <div className="form-group flex-1"><label>Taxa Frete (R$)</label><input type="text" placeholder="0,00" value={logistica.frete} onChange={handleFreteChange} /></div>
                </div>
                
                <div className="form-row mt-10">
                  <div className="form-group flex-2"><label>Logradouro</label><input type="text" placeholder="Av. das Nações..." value={logistica.rua} onChange={e => setLogistica({...logistica, rua: e.target.value})} /></div>
                  <div className="form-group flex-1"><label>Número</label><input type="text" id="numeroInput" placeholder="123" value={logistica.numero} onChange={e => setLogistica({...logistica, numero: e.target.value})} /></div>
                  <div className="form-group flex-2"><label>Bairro</label><input type="text" placeholder="Centro" value={logistica.bairro} onChange={e => setLogistica({...logistica, bairro: e.target.value})} /></div>
                </div>
                <div className="form-row mt-10">
                  <div className="form-group flex-1">
                    <label>Ponto de Referência</label>
                    <input type="text" placeholder="Ex: Ao lado do mercado, portão preto..." value={logistica.referencia} onChange={e => setLogistica({...logistica, referencia: e.target.value})} />
                  </div>
                </div>

                <div className="form-group mt-10">
                  <label>Observações de Transporte</label>
                  <textarea rows="2" placeholder="Casa de esquina, deixar com porteiro..." value={logistica.obsTransporte} onChange={e => setLogistica({...logistica, obsTransporte: e.target.value})}></textarea>
                </div>
              </div>
            ) : (
              <p className="texto-aviso-logistica mt-15">⚠️ O cliente fará a retirada e devolução dos itens diretamente no local.</p>
            )}
          </div>

          <div className="card-secao">
            <div className="header-com-botoes">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>📦 ITENS DO PEDIDO</h3>
              <div className="botoes-acoes-itens">
                <button type="button" className="btn-secundario-alerta" onClick={() => { if(!clienteSelecionado) return alert("Selecione o cliente primeiro."); setModalCompraAberto(true);}}>🛒 Faltou algo? (Comprar)</button>
                <button type="button" className="btn-primary-outline" onClick={() => setModalAberto(true)}>+ ADC. PEÇAS</button>
              </div>
            </div>

            <div className="carrinho-container mt-15">
              {carrinho.length === 0 ? (
                <div className="carrinho-vazio">Nenhuma peça adicionada ainda. Clique em "+ Adc. Peças".</div>
              ) : (
                <table className="tabela-carrinho">
                  <thead><tr><th width="50"></th><th>PRODUTO</th><th className="text-center">QTD</th><th className="text-right">TOTAL</th><th width="40"></th></tr></thead>
                  <tbody>
                    {carrinho.map(item => (
                      <tr key={item.id} className="carrinho-item-card">
                        <td className="carrinho-img">
                          {item.foto ? <img src={item.foto} alt="Peça"/> : <div className="img-placeholder">📷</div>}
                        </td>
                        <td className="carrinho-info">
                          <strong>
                            {item.nome}
                            {item.isPendenteCompra && (
                                <span style={{marginLeft: '8px', background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold'}}>
                                    ⏳ COMPRA PENDENTE
                                </span>
                            )}
                          </strong>
                          <span>R$ {Number(item.preco).toFixed(2)} un</span>
                          
                          {/* 🔥 NOVO: EXIBIÇÃO DE ESTOQUE DENTRO DO CARRINHO 🔥 */}
                          {!item.isPendenteCompra && (
                              <span style={{fontSize: '0.75rem', color: '#3b82f6', fontWeight: '600', display: 'block', marginTop: '4px'}}>
                                  📦 Em estoque: {item.qtdOriginal} unid.
                              </span>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="controle-qtd">
                            <button type="button" onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: Math.max(1, i.qtd-1)} : i))}>-</button>
                            <span>{item.qtd}</span>
                            <button type="button" onClick={() => {
                                if (item.isPendenteCompra) {
                                    setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: i.qtd+1} : i));
                                } else if (item.qtd >= item.qtdOriginal) {
                                    alert(`⚠️ Estoque Insuficiente!\nVocê possui apenas ${item.qtdOriginal} unidade(s) de "${item.nome}".\n\nVamos abrir a tela de COMPRA para a unidade extra!`);
                                    dispararCompraAutomatica(item);
                                } else {
                                    setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: i.qtd+1} : i));
                                }
                            }}>+</button>
                          </div>
                        </td>
                        <td className="text-right carrinho-total-item">
                          <strong>R$ {(item.preco * item.qtd).toFixed(2)}</strong>
                        </td>
                        <td className="text-center">
                          <button type="button" className="btn-remover-item" onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card-secao">
            <h3 className="section-divider">🔒 OBSERVAÇÕES INTERNAS</h3>
            <div className="form-group">
              <textarea rows="2" placeholder="Anotações para a equipe (Ex: Verificar estado da mesa na volta...)" value={obsInternas} onChange={e => setObsInternas(e.target.value)}></textarea>
            </div>
          </div>

        </div>

        <aside className="coluna-financeiro">
          <div className="card-financeiro-sticky">
            <h3>Resumo Financeiro</h3>
            <div className="fin-linha"><span>Subtotal Itens</span> <span>R$ {calcularTotal().subtotal.toFixed(2)}</span></div>
            <div className="fin-linha"><span>Frete</span> <span>+ R$ {getFreteNumerico().toFixed(2)}</span></div>
            <div className="fin-linha desconto-linha">
              <span>Desconto (R$)</span> 
              <input type="number" min="0" value={desconto} onChange={e => setDesconto(e.target.value)} />
            </div>
            
            <div className="fin-total">
              <span>TOTAL</span>
              <strong>R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            <div className="fin-acoes">
              <button type="button" className="btn-salvar-form" onClick={() => handleSalvar('confirmado')}>✔ CONFIRMAR PEDIDO</button>
              <button type="button" className="btn-voltar-link" style={{width: '100%', justifyContent: 'center', marginTop: '10px'}} onClick={() => handleSalvar('orcamento')}>💾 Salvar como Orçamento</button>
            </div>
          </div>
        </aside>
      </div>

      {modalAberto && (
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
                    <div style={{position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold'}}>
                        Qtd: {item.quantidade || 1}
                    </div>
                    <button className="btn-add-peca">+</button>
                  </div>
                  
                  <div className="peca-info">
                    <strong>{item.nome}</strong>
                    <span>{item.categoria}</span>
                    <b className="txt-sucesso">R$ {item.financeiro?.valorAluguel || 0}</b>
                  </div>

                </div>
              ))}
              {itensFiltrados.length === 0 && <p className="text-center w-100 mt-15" style={{color: 'var(--texto-secundario)'}}>Nenhuma peça encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {modalCompraAberto && (
        <div className="modal-overlay-premium" style={{zIndex: 99999}}>
          <div className="modal-box-premium" style={{maxWidth: '650px'}}>
            <div className="modal-header">
              <h3>🛒 Comprar Item & Adicionar ao Pedido</h3>
              <button className="btn-fechar" onClick={() => setModalCompraAberto(false)}>X</button>
            </div>
            <p style={{fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '20px'}}>
              Se a peça já existir no seu acervo, selecione na lista abaixo para não criar cadastros duplicados!
            </p>
            
            <form onSubmit={handleSalvarCompraRapida} className="form-pagamento">
              
              <div className="form-group-pag" style={{position: 'relative'}}>
                <label>Nome do Item que será comprado *</label>
                <input 
                  id="compraNomeInput" 
                  type="text" 
                  required 
                  autoFocus 
                  autoComplete="off"
                  value={formCompra.nome} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormCompra({...formCompra, nome: val});
                    
                    if(val.length >= 2) {
                       const filtrados = estoque.filter(item => item.nome.toLowerCase().includes(val.toLowerCase()));
                       setSugestoesCompra(filtrados);
                    } else {
                       setSugestoesCompra([]);
                    }
                  }} 
                  onBlur={() => setTimeout(() => setSugestoesCompra([]), 200)}
                />
                
                {sugestoesCompra.length > 0 && (
                   <div style={{position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', zIndex: 100, maxHeight: '180px', overflowY: 'auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}}>
                      {sugestoesCompra.map(item => (
                         <div 
                           key={item.id} 
                           onMouseDown={() => { 
                              let valorAlg = item.financeiro?.valorAluguel || "0,00";
                              if (typeof valorAlg === 'number') valorAlg = valorAlg.toFixed(2).replace(".", ",");
                              
                              setFormCompra({
                                 ...formCompra, 
                                 nome: item.nome,
                                 categoria: item.categoria || "acervo",
                                 valorAluguel: valorAlg
                              });
                              setSugestoesCompra([]);
                           }}
                           style={{padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
                           onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                           onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                         >
                           <span style={{fontWeight: 'bold', color: '#0f172a', fontSize: '13px'}}>{item.nome}</span>
                           <span style={{fontSize: '11px', color: '#64748b', backgroundColor: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'}}>No Acervo: {item.quantidade}</span>
                         </div>
                      ))}
                   </div>
                )}
              </div>
              
              <div className="form-group-row mt-10">
                <div className="form-group-pag" style={{width: '80px'}}>
                  <label>Qtd *</label>
                  <input type="number" min="1" required value={formCompra.quantidade} onChange={e => setFormCompra({...formCompra, quantidade: e.target.value})} />
                </div>
                <div className="form-group-pag flex-1">
                  <label title="Quanto você vai gastar na loja">Custo Est. (R$)</label>
                  <input type="text" placeholder="0,00" value={formCompra.valorEstimado} onChange={e => setFormCompra({...formCompra, valorEstimado: maskCurrency(e.target.value)})} />
                </div>
                <div className="form-group-pag flex-1">
                  <label title="Quanto vai custar para o cliente alugar">Cobrar Aluguel</label>
                  <input type="text" placeholder="0,00" style={{borderColor: '#c5a059', backgroundColor: '#fffbeb'}} value={formCompra.valorAluguel} onChange={e => setFormCompra({...formCompra, valorAluguel: maskCurrency(e.target.value)})} />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group-pag flex-1">
                  <label>Data Limite (Chegada)</label>
                  <input type="date" value={formCompra.prazo} onChange={e => setFormCompra({...formCompra, prazo: e.target.value})} />
                </div>
                <div className="form-group-pag flex-2">
                  <label>Fornecedor (Nome ou Link)</label>
                  <input type="text" placeholder="Ex: Mercado Livre..." value={formCompra.fornecedor} onChange={e => setFormCompra({...formCompra, fornecedor: e.target.value})} />
                </div>
              </div>

              <div className="form-group-pag">
                <label>Categoria</label>
                <select value={formCompra.categoria} onChange={e => setFormCompra({...formCompra, categoria: e.target.value})}>
                  <option value="material">Material de Consumo (Bexiga, Fita...)</option>
                  <option value="acervo">Peça de Acervo (Vaso, Móvel...)</option>
                </select>
              </div>
              
              <div className="form-group-pag">
                <label>Observação (Cor, tamanho, etc)</label>
                <textarea rows="2" value={formCompra.obs} onChange={e => setFormCompra({...formCompra, obs: e.target.value})}></textarea>
              </div>

              <div className="modal-actions" style={{flexWrap: 'wrap', marginTop: '20px'}}>
                <button type="button" className="btn-cancel" style={{flex: 1}} onClick={() => setModalCompraAberto(false)}>Cancelar</button>
                <button type="submit" className="btn-secundario-alerta" style={{flex: 1, padding: '12px', border: '1px solid #fde68a'}} onClick={() => setAcaoSalvar('continuar')} disabled={salvandoCompra}>
                  {salvandoCompra && acaoSalvar === 'continuar' ? 'Salvando...' : '+ Salvar e Novo'}
                </button>
                <button type="submit" className="btn-salvar-form" style={{flex: 1, padding: '12px'}} onClick={() => setAcaoSalvar('fechar')} disabled={salvandoCompra}>
                  {salvandoCompra && acaoSalvar === 'fechar' ? 'Salvando...' : 'Salvar e Inserir'}
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