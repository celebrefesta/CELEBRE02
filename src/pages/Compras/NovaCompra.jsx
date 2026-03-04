import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; 
import { db } from '../../firebaseConfig';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore'; 
import './NovaCompra.css';

const NovaCompra = () => {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const isEditing = !!id; 

  const [salvando, setSalvando] = useState(false);
  const [carregandoEdicao, setCarregandoEdicao] = useState(isEditing);

  // --- ESTADOS DO FORMULÁRIO ---
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [valorEstimado, setValorEstimado] = useState('');
  const [valorAluguel, setValorAluguel] = useState('');
  
  const [categoria, setCategoria] = useState('acervo'); 
  const [formato, setFormato] = useState('unidade'); 
  const [quantidadePecasKit, setQuantidadePecasKit] = useState(2); 
  
  const [condicao, setCondicao] = useState('pronto'); 
  const [destino, setDestino] = useState('geral'); 
  
  // LOGÍSTICA
  const [tipoEntrega, setTipoEntrega] = useState('10'); 
  const [diasPersonalizados, setDiasPersonalizados] = useState('');
  const [erroPrazo, setErroPrazo] = useState(false); 
  const [mensagemPrazo, setMensagemPrazo] = useState(''); 
  const [prazo, setPrazo] = useState(''); 
  const [permitirSimulador, setPermitirSimulador] = useState(!isEditing); 

  const [fornecedor, setFornecedor] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // --- ESTADOS DO VÍNCULO (PEDIDO) ---
  const [modalPedidosAberto, setModalPedidosAberto] = useState(false);
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState([]);
  const [buscaPedido, setBuscaPedido] = useState('');
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

  useEffect(() => {
    carregarPedidosFuturos();
    if (isEditing) {
        carregarDadosEdicao();
    }
  }, [id]);

  const carregarDadosEdicao = async () => {
    try {
        const docRef = doc(db, "lista_compras", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            setNome(data.nome || '');
            setQuantidade(data.quantidade || 1);

            if (data.valorEstimado) setValorEstimado(Number(data.valorEstimado).toFixed(2).replace('.', ','));
            if (data.valorAluguel) setValorAluguel(Number(data.valorAluguel).toFixed(2).replace('.', ','));

            setCategoria(data.categoria || 'acervo');
            setFormato(data.formato || 'unidade');
            setQuantidadePecasKit(data.quantidadePecasKit || 2);
            setCondicao(data.condicaoChegada || 'pronto');
            setDestino(data.vinculoTipo || 'geral');
            setPrazo(data.prazo || '');
            setFornecedor(data.fornecedor || '');
            setObservacoes(data.obs || '');
            
            // 🔥 CARREGA OS DADOS DO FRETE SALVOS 🔥
            if (data.tipoEntrega) setTipoEntrega(data.tipoEntrega);
            if (data.diasFrete !== undefined && data.tipoEntrega === 'outro') {
                setDiasPersonalizados(String(data.diasFrete));
            }

            if (data.vinculoTipo === 'pedido' && data.vinculoId) {
                const pedRef = doc(db, "locacoes", data.vinculoId);
                const pedSnap = await getDoc(pedRef);
                if (pedSnap.exists()) {
                    setPedidoSelecionado({ id: pedSnap.id, ...pedSnap.data() });
                } else {
                    setPedidoSelecionado({ id: data.vinculoId, clienteNome: data.vinculo, temaFesta: '', dataRetirada: data.prazo });
                }
            }
        } else {
            alert("Erro: Item não encontrado no banco de dados.");
            navigate('/compras');
        }
    } catch (error) {
        console.error("Erro ao carregar edição:", error);
    } finally {
        setCarregandoEdicao(false);
    }
  };

  const carregarPedidosFuturos = async () => {
    try {
      const q = query(collection(db, "locacoes"), orderBy("dataRetirada", "desc"));
      const snapshot = await getDocs(q);
      const locacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pedidosAtivos = locacoes.filter(loc => !['cancelado', 'finalizado'].includes((loc.status || '').toLowerCase()));
      setPedidosDisponiveis(pedidosAtivos);
    } catch (error) { console.error("Erro ao buscar pedidos:", error); }
  };

  useEffect(() => {
    if (!permitirSimulador) return;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    const diasDeEntrega = tipoEntrega === 'outro' ? (Number(diasPersonalizados) || 0) : Number(tipoEntrega);
    const diasDePreparo = condicao === 'preparar' ? 3 : 0;
    
    const dataChegada = new Date(hoje);
    dataChegada.setDate(dataChegada.getDate() + diasDeEntrega);

    const dataPronta = new Date(dataChegada);
    dataPronta.setDate(dataPronta.getDate() + diasDePreparo);

    if (destino === 'pedido' && pedidoSelecionado && pedidoSelecionado.dataRetirada) {
        const dataFesta = new Date(pedidoSelecionado.dataRetirada + 'T00:00:00');
        
        const dataLimiteRecebimento = new Date(dataFesta);
        dataLimiteRecebimento.setDate(dataLimiteRecebimento.getDate() - diasDePreparo);
        setPrazo(dataLimiteRecebimento.toISOString().split('T')[0]);

        if (dataPronta > dataFesta) {
            setErroPrazo(true);
            setMensagemPrazo(`❌ INVIÁVEL: A festa é dia ${dataFesta.toLocaleDateString('pt-BR')}, mas a peça só ficará pronta em ${dataPronta.toLocaleDateString('pt-BR')}.`);
        } else {
            setErroPrazo(false);
            setMensagemPrazo(`✅ TEMPO HÁBIL: Chega dia ${dataChegada.toLocaleDateString('pt-BR')} e estará pronta a tempo.`);
        }
    } else {
        setErroPrazo(false);
        setMensagemPrazo('');
        setPrazo(dataChegada.toISOString().split('T')[0]);
    }
  }, [condicao, pedidoSelecionado, destino, tipoEntrega, diasPersonalizados, permitirSimulador]);

  const maskCurrency = (value) => {
    let v = value.replace(/\D/g, "");
    if (!v) return "";
    return (v / 100).toFixed(2).replace(".", ",").replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,").replace(/(\d)(\d{3}),/g, "$1.$2,");
  };

  const selecionarPedido = (pedido) => {
    setPermitirSimulador(true); 
    setPedidoSelecionado(pedido);
    setDestino('pedido');
    setModalPedidosAberto(false);
  };

  const salvarCompra = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return alert("Digite o nome do item!");
    if (destino === 'pedido' && !pedidoSelecionado) return alert("Selecione o pedido para vincular a compra!");
    if (erroPrazo && destino === 'pedido') return alert("O sistema bloqueou a operação: O item não chegará a tempo da festa!");

    setSalvando(true);
    try {
      const custoNum = valorEstimado ? Number(valorEstimado.replace(/\./g, "").replace(",", ".")) : 0;
      const aluguelNum = valorAluguel ? Number(valorAluguel.replace(/\./g, "").replace(",", ".")) : 0;

      let nomeVinculo = "Estoque Geral";
      let idVinculo = null;

      if (destino === 'pedido' && pedidoSelecionado) {
        nomeVinculo = pedidoSelecionado.temaFesta 
            ? `${pedidoSelecionado.temaFesta} - ${pedidoSelecionado.clienteNome}` 
            : `Pedido de ${pedidoSelecionado.clienteNome}`;
        idVinculo = pedidoSelecionado.id;
      }

      // 🔥 SALVA OS DIAS DE FRETE EXATOS NO BANCO 🔥
      const diasDeEntrega = tipoEntrega === 'outro' ? (Number(diasPersonalizados) || 0) : Number(tipoEntrega);

      const dadosDaCompra = {
        nome: nome.trim(),
        quantidade: Number(quantidade),
        valorEstimado: custoNum,
        valorAluguel: aluguelNum,
        categoria: categoria,
        formato: categoria === 'acervo' ? formato : 'unidade',
        quantidadePecasKit: categoria === 'acervo' && formato === 'kit' ? Number(quantidadePecasKit) : 0,
        condicaoChegada: condicao,
        prazo: prazo,
        fornecedor: fornecedor,
        obs: observacoes,
        vinculoTipo: destino,
        vinculoId: idVinculo,
        vinculo: nomeVinculo,
        tipoEntrega: tipoEntrega, 
        diasFrete: diasDeEntrega 
      };

      if (isEditing) {
          const docRef = doc(db, "lista_compras", id);
          await updateDoc(docRef, {
              ...dadosDaCompra,
              atualizadoEm: serverTimestamp()
          });
          alert("Solicitação atualizada com sucesso!");
      } else {
          await addDoc(collection(db, "lista_compras"), {
            ...dadosDaCompra,
            status: "pendente",
            createdAt: serverTimestamp()
          });
          alert("Nova solicitação de compra criada!");
      }

      navigate('/compras');
    } catch (error) {
      alert("Erro ao salvar a operação.");
    } finally {
      setSalvando(false);
    }
  };

  const pedidosFiltrados = pedidosDisponiveis.filter(p => {
    const termo = buscaPedido.toLowerCase();
    return (p.clienteNome || '').toLowerCase().includes(termo) || 
           (p.temaFesta || '').toLowerCase().includes(termo) ||
           (p.numeroPedido || '').includes(termo);
  });

  if (carregandoEdicao) return <div style={{padding: '50px', textAlign: 'center'}}>Carregando dados da compra...</div>;

  return (
    <div className="nova-compra-page">
      
      <div className="page-header-premium">
        <div className="header-titles">
          <h1>{isEditing ? '✏️ Editar Solicitação de Compra' : 'Nova Solicitação de Compra'}</h1>
          <p>{isEditing ? 'Altere as informações do item, fornecedor ou prazo abaixo.' : 'Adicione itens necessários para o acervo ou pedidos.'}</p>
        </div>
        <button className="btn-voltar-simples" onClick={() => navigate('/compras')}>
          <span style={{marginRight: '5px'}}>←</span> Voltar para Lista
        </button>
      </div>

      <form className="nova-compra-grid" onSubmit={salvarCompra}>
        
        {/* --- COLUNA ESQUERDA: O PRODUTO --- */}
        <div className="compra-card-premium">
          <div className="card-header-linha">
            <div className="icone-titulo">🛍️</div>
            <h3 className="card-title">O QUE PRECISA COMPRAR?</h3>
          </div>
          
          <div className="form-group-modern">
            <label>NOME DO PRODUTO / ITEM *</label>
            <input 
              type="text" 
              placeholder="Ex: Cilindro M, Trio de Mesas..." 
              required 
              value={nome}
              onChange={e => setNome(e.target.value)}
              autoFocus={!isEditing}
            />
          </div>

          <div className="form-row-modern">
            <div className="form-group-modern" style={{ flex: 1 }}>
              <label>QUANTIDADE *</label>
              <input 
                type="number" 
                min="1" 
                required 
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
              />
            </div>
            <div className="form-group-modern" style={{ flex: 2 }}>
              <label>CUSTO ESTIMADO TOTAL (R$)</label>
              <input 
                type="text" 
                placeholder="0,00" 
                value={valorEstimado}
                onChange={e => setValorEstimado(maskCurrency(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group-modern mt-15">
            <label>TIPO DE ITEM</label>
            <div className="segment-control">
              <button 
                type="button" 
                className={categoria === 'acervo' ? 'active' : ''} 
                onClick={() => { setCategoria('acervo'); setFormato('unidade'); }}
              >
                🏺 Peça p/ Acervo
              </button>
              <button 
                type="button" 
                className={categoria === 'material' ? 'active' : ''} 
                onClick={() => setCategoria('material')}
              >
                ✂️ Material Consumo
              </button>
            </div>
          </div>

          {categoria === 'acervo' && (
            <div className="form-group-modern mt-15 fade-in">
              <label>FORMATO DO ITEM</label>
              <div className="segment-control">
                <button 
                  type="button" 
                  className={formato === 'unidade' ? 'active' : ''} 
                  onClick={() => setFormato('unidade')}
                >
                  📦 Peça Única
                </button>
                <button 
                  type="button" 
                  className={formato === 'kit' ? 'active' : ''} 
                  onClick={() => setFormato('kit')}
                >
                  🪆 É um Kit (Múltiplo)
                </button>
              </div>
            </div>
          )}

          {categoria === 'acervo' && formato === 'kit' && (
            <div className="form-group-modern mt-15 fade-in box-destaque-kit">
              <label style={{color: '#166534'}}>QUANTAS PEÇAS VÊM NESTE KIT?</label>
              <input 
                type="number" 
                min="2" 
                value={quantidadePecasKit}
                onChange={e => setQuantidadePecasKit(e.target.value)}
                style={{ borderColor: '#86efac', backgroundColor: 'white', color: '#14532d' }}
              />
              <span className="helper-text" style={{color: '#16a34a'}}>
                Isso agilizará o desmembramento das peças quando a compra chegar no acervo!
              </span>
            </div>
          )}

          {categoria === 'acervo' && (
            <div className="form-group-modern mt-15 fade-in input-destaque">
              <label>SUGESTÃO DE ALUGUEL DO ITEM/KIT (R$)</label>
              <input 
                type="text" 
                placeholder="Valor que será cobrado por locação..." 
                value={valorAluguel}
                onChange={e => setValorAluguel(maskCurrency(e.target.value))}
              />
            </div>
          )}
        </div>

        {/* --- COLUNA DIREITA: LOGÍSTICA E VÍNCULO --- */}
        <div className="compra-card-premium">
          <div className="card-header-linha">
            <div className="icone-titulo">🔗</div>
            <h3 className="card-title">LOGÍSTICA E DESTINO</h3>
          </div>

          <div className="form-group-modern">
            <label>PARA ONDE VAI ESSA COMPRA?</label>
            <div className="segment-control">
              <button 
                type="button" 
                className={destino === 'geral' ? 'active' : ''} 
                onClick={() => { setPermitirSimulador(true); setDestino('geral'); setPedidoSelecionado(null); }}
              >
                📦 Estoque Geral
              </button>
              <button 
                type="button" 
                className={destino === 'pedido' ? 'active' : ''} 
                onClick={() => setModalPedidosAberto(true)}
              >
                🎉 Vincular a um Pedido
              </button>
            </div>
          </div>

          {destino === 'pedido' && (
            <div className="pedido-selecionado-box fade-in">
              {pedidoSelecionado ? (
                <>
                  <div className="ps-info">
                    <span className="ps-festa">{pedidoSelecionado.temaFesta || 'Tema não informado'}</span>
                    <strong className="ps-cliente">{pedidoSelecionado.clienteNome}</strong>
                    <span className="ps-data">📅 Festa: {pedidoSelecionado.dataRetirada.split('-').reverse().join('/')}</span>
                  </div>
                  <button type="button" className="btn-trocar-pedido" onClick={() => setModalPedidosAberto(true)}>Alterar</button>
                </>
              ) : (
                <div className="ps-vazio">
                  <span>Nenhum pedido selecionado.</span>
                  <button type="button" onClick={() => setModalPedidosAberto(true)}>Buscar Pedido 🔍</button>
                </div>
              )}
            </div>
          )}

          <div className="form-group-modern mt-20">
            <label>CONDIÇÃO DA PEÇA NA CHEGADA</label>
            <div className="segment-control condition-toggle">
              <button 
                type="button" 
                className={condicao === 'pronto' ? 'active ok' : ''} 
                onClick={() => { setPermitirSimulador(true); setCondicao('pronto'); }}
              >
                ✅ Pronta p/ Uso
              </button>
              <button 
                type="button" 
                className={condicao === 'preparar' ? 'active alert' : ''} 
                onClick={() => { setPermitirSimulador(true); setCondicao('preparar'); }}
              >
                🎨 Crua (Precisa Pintar)
              </button>
            </div>
          </div>

          <div className="simulador-frete-box mt-15">
            <div className="form-group-modern">
                <label style={{color: '#0f172a'}}>ONDE VOCÊ VAI COMPRAR? (Simulador)</label>
                <select value={tipoEntrega} onChange={e => { setPermitirSimulador(true); setTipoEntrega(e.target.value); }}>
                    <option value="0">Loja Física na Cidade (Pronta Entrega)</option>
                    <option value="2">Mercado Livre (FULL) - ~2 dias</option>
                    <option value="5">Mercado Livre (Normal) - ~5 dias</option>
                    <option value="10">Shopee (Vendedor Nacional) - ~10 dias</option>
                    <option value="25">Shopee/AliExpress (Internacional) - ~25 dias</option>
                    <option value="outro">Outro Fornecedor Personalizado...</option>
                </select>
            </div>

            {tipoEntrega === 'outro' && (
                <div className="form-group-modern mt-10 fade-in">
                    <label>QUANTOS DIAS DE FRETE?</label>
                    <input 
                        type="number" 
                        min="0" 
                        placeholder="Ex: 8"
                        value={diasPersonalizados} 
                        onChange={e => { setPermitirSimulador(true); setDiasPersonalizados(e.target.value); }} 
                    />
                </div>
            )}

            {destino === 'pedido' && mensagemPrazo && permitirSimulador && (
                <div className={`mensagem-prazo-risco ${erroPrazo ? 'bloqueado' : 'ok'} mt-10`}>
                    {mensagemPrazo}
                </div>
            )}
          </div>

          <div className="form-row-modern mt-15">
            <div className="form-group-modern" style={{ flex: 1 }}>
              <label>DATA LIMITE PREVISTA</label>
              <input 
                type="date" 
                value={prazo}
                onChange={e => { setPermitirSimulador(false); setPrazo(e.target.value); }}
              />
            </div>
            <div className="form-group-modern" style={{ flex: 1.5 }}>
              <label>NOME DO FORNECEDOR OU LINK</label>
              <input 
                type="text" 
                placeholder="Cole o link ou digite o nome..." 
                value={fornecedor}
                onChange={e => setFornecedor(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group-modern mt-15">
            <label>OBSERVAÇÕES INTERNAS</label>
            <textarea 
              rows="2" 
              placeholder="Ex: Pedir para não envernizar, atenção na medida..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            ></textarea>
          </div>

          <div className="form-actions-premium mt-20">
            <button type="button" className="btn-cancelar-premium" onClick={() => navigate('/compras')}>Cancelar</button>
            <button 
                type="submit" 
                className={`btn-salvar-premium ${erroPrazo && destino === 'pedido' ? 'disabled-error' : ''}`} 
                disabled={salvando || (erroPrazo && destino === 'pedido')}
            >
              {salvando ? 'Processando...' : erroPrazo && destino === 'pedido' ? '⛔ Inviável' : isEditing ? 'Atualizar ✔' : 'Criar ✔'}
            </button>
          </div>
        </div>
      </form>

      {modalPedidosAberto && (
        <div className="modal-overlay-premium">
          <div className="modal-box-pedido">
            <div className="modal-header-pedido">
              <div>
                <h3>Selecione o Evento</h3>
                <p>Busque o pedido do cliente na lista abaixo.</p>
              </div>
              <button className="btn-fechar-modal" onClick={() => {
                if(!pedidoSelecionado) setDestino('geral'); 
                setModalPedidosAberto(false);
              }}>✕</button>
            </div>

            <div className="modal-search-box">
              <span className="icon">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por cliente, tema ou código..." 
                value={buscaPedido}
                onChange={e => setBuscaPedido(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-lista-pedidos">
              {pedidosFiltrados.length === 0 ? (
                <div className="lista-vazia">Nenhum evento encontrado.</div>
              ) : (
                pedidosFiltrados.map(pedido => (
                  <div 
                    key={pedido.id} 
                    className="card-pedido-select"
                    onClick={() => selecionarPedido(pedido)}
                  >
                    <div className="cp-left">
                      <span className="cp-id">#{pedido.numeroPedido || 'S/N'}</span>
                      <strong className="cp-nome">{pedido.clienteNome}</strong>
                      <span className="cp-tema">🎈 {pedido.temaFesta || 'Tema não definido'}</span>
                    </div>
                    <div className="cp-right">
                      <div className="cp-data-box">
                        <span className="label">Data da Festa</span>
                        <strong>{pedido.dataRetirada ? pedido.dataRetirada.split('-').reverse().join('/') : 'S/D'}</strong>
                      </div>
                      <span className={`cp-status ${pedido.status?.toLowerCase()}`}>
                        {pedido.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NovaCompra;