import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, getDocs, serverTimestamp, query, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import './NovaCompra.css';

const NovaCompra = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id; 

  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

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

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE COMPRAS VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de compras:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    carregarPedidosFuturos();
    if (isEditing) {
        carregarDadosEdicao();
    } else {
        // 🔥 Captura parâmetros de Pedido em Aberto se vindo de NovaLocacao
        const queryParams = new URLSearchParams(window.location.search);
        const cliNome = queryParams.get('clienteNome') || queryParams.get('cliente');
        const dRetirada = queryParams.get('dataRetirada') || queryParams.get('data');
        const tFesta = queryParams.get('temaFesta') || queryParams.get('tema');

        if (cliNome || tFesta) {
          setDestino('pedido');
          setPedidoSelecionado({
            id: `temp_${Date.now()}`,
            clienteNome: cliNome || 'Cliente em Atendimento',
            dataRetirada: dRetirada || '',
            temaFesta: tFesta || 'Pedido em Aberto',
            status: 'EM ABERTO'
          });
        }
    }
  }, [id, usuarioLogado, navigate, tenantId]);

  const carregarDadosEdicao = async () => {
    try {
        const docRef = doc(db, "lista_compras", id);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const data = snap.data();
            
            if (data.userId && data.userId !== tenantId) {
                alert("Acesso negado: Esta compra não pertence à sua empresa.");
                navigate('/compras');
                return;
            }

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
    if (!usuarioLogado) return;
    try {
      const q = query(collection(db, "locacoes"), where("userId", "==", tenantId));
      const snapshot = await getDocs(q);
      
      let locacoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordena por data de criação / data de retirada (mais recentes primeiro)
      locacoes.sort((a, b) => {
          const timeA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : (a.dataRetirada ? new Date(a.dataRetirada).getTime() : 0);
          const timeB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : (b.dataRetirada ? new Date(b.dataRetirada).getTime() : 0);
          return timeB - timeA;
      });

      // Inclui pedidos em aberto, orçamentos, confirmados, etc. (apenas exclui os estritamente cancelados)
      const pedidosAtivos = locacoes.filter(loc => {
        const st = (loc.status || '').toLowerCase().trim();
        return !st.includes('cancelado');
      });

      setPedidosDisponiveis(pedidosAtivos);
    } catch (error) { 
      console.error("Erro ao buscar pedidos:", error);
    }
  };

  const cadastrarPedidoManual = () => {
    const nomeCli = prompt("Digite o nome do Cliente ou Pedido em Aberto:");
    if (nomeCli && nomeCli.trim()) {
      const dataFesta = prompt("Data da festa (AAAA-MM-DD) [opcional]:", "") || "";
      const novoPedido = {
        id: `manual_${Date.now()}`,
        clienteNome: nomeCli.trim(),
        dataRetirada: dataFesta,
        temaFesta: "Pedido em Aberto (Manual)",
        status: "EM ABERTO"
      };
      selecionarPedido(novoPedido);
    }
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
          await registrarLog("EDIÇÃO DE COMPRA", `Atualizou os dados da solicitação de compra: "${dadosDaCompra.nome}".`);
          alert("Solicitação atualizada com sucesso!");
      } else {
          await addDoc(collection(db, "lista_compras"), {
            ...dadosDaCompra,
            status: "pendente",
            createdAt: serverTimestamp(),
            userId: tenantId
          });
          await registrarLog("NOVA COMPRA", `Criou uma solicitação de compra para: "${dadosDaCompra.nome}" (Qtd: ${dadosDaCompra.quantidade}).`);
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
           (p.numeroPedido || '').includes(termo) ||
           (p.status || '').toLowerCase().includes(termo);
  });

  if (carregandoEdicao) return <div style={{padding: '50px', textAlign: 'center'}}>Carregando dados da compra...</div>;

  return (
    <div className="nova-compra-page fade-in">
      
      <div className="page-header-premium">
        <div className="header-titles">
          <span className="badge-header-gold">✨ GESTÃO DE COMPRAS & AQUISIÇÕES</span>
          <h1>{isEditing ? '✏️ Editar Solicitação de Compra' : 'Nova Solicitação de Compra'}</h1>
          <p>Cadastre peças, insumos ou infraestrutura para sua empresa.</p>
        </div>
        <button className="btn-voltar-premium" onClick={() => navigate('/compras')}>
          ← Voltar para Lista
        </button>
      </div>

      <form className="form-grid-layout" onSubmit={salvarCompra}>
        
        {/* BLOCO ESQUERDO: DADOS DO ITEM */}
        <div className="form-card-section">
          <div className="card-top-accent gold"></div>
          
          <div className="card-header-styled">
            <div className="icon-pill-gold">
              <span>📦</span>
            </div>
            <div>
              <h3>Informações do Item</h3>
              <p className="card-subtext">Preencha os detalhes e especificações da peça ou insumo</p>
            </div>
          </div>
          
          <div className="form-group-full mb-15">
            <label>Nome do Item / Peça *</label>
            <input 
              type="text" 
              placeholder="Ex: Vaso de Cerâmica Rosa Bebê, Boleira Ouro..." 
              value={nome} 
              onChange={e => {
                const val = e.target.value;
                const formatado = val.replace(/(?:^|\s)\S/g, a => a.toUpperCase());
                setNome(formatado);
              }}
              autoCapitalize="words"
              required 
            />
          </div>

          <div className="form-row-2 mb-15">
            <div className="form-group">
              <label>Quantidade *</label>
              <input 
                type="number" 
                min="1" 
                value={quantidade} 
                onChange={e => setQuantidade(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label>Categoria *</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                <option value="acervo">📦 Peça de Acervo / Decoração</option>
                <option value="insumo">🛠️ Insumo / Consumível (Balões, Fitas)</option>
                <option value="infraestrutura">🏢 Infraestrutura / Escritório</option>
              </select>
            </div>
          </div>

          {categoria === 'acervo' && (
            <div className="form-row-2 mb-15">
              <div className="form-group">
                <label>Formato *</label>
                <select value={formato} onChange={e => setFormato(e.target.value)}>
                  <option value="unidade">Peça Avulsa / Única</option>
                  <option value="kit">Kit / Conjunto de Peças</option>
                </select>
              </div>

              {formato === 'kit' && (
                <div className="form-group">
                  <label>Nº de Peças no Kit *</label>
                  <input 
                    type="number" 
                    min="2" 
                    value={quantidadePecasKit} 
                    onChange={e => setQuantidadePecasKit(e.target.value)} 
                  />
                </div>
              )}
            </div>
          )}

          <div className="form-row-2 mb-15">
            <div className="form-group">
              <label>Custo Estimado (Unitário R$)</label>
              <input 
                type="text" 
                placeholder="0,00" 
                value={valorEstimado} 
                onChange={e => setValorEstimado(maskCurrency(e.target.value))} 
              />
            </div>

            {categoria === 'acervo' && (
              <div className="form-group">
                <label>Preço Sugerido de Aluguel (R$)</label>
                <input 
                  type="text" 
                  placeholder="0,00" 
                  value={valorAluguel} 
                  onChange={e => setValorAluguel(maskCurrency(e.target.value))} 
                />
              </div>
            )}
          </div>

          <div className="form-group-full mb-15">
            <label>Fornecedor / Link da Compra (Opcional)</label>
            <input 
              type="text" 
              placeholder="Ex: Mercado Livre, Shopee, Armarinho Fernando..." 
              value={fornecedor} 
              onChange={e => setFornecedor(e.target.value)} 
            />
          </div>

          <div className="form-group-full">
            <label>Observações / Especificações de Cor ou Tamanho</label>
            <textarea 
              rows="3" 
              placeholder="Ex: Comprar preferencialmente na cor Dourado Fosco..." 
              value={observacoes} 
              onChange={e => setObservacoes(e.target.value)}
            ></textarea>
          </div>
        </div>

        {/* BLOCO DIREITO: VÍNCULO & PRAZO */}
        <div className="form-card-section">
          <div className="card-top-accent blue"></div>

          <div className="card-header-styled">
            <div className="icon-pill-blue">
              <span>🎯</span>
            </div>
            <div>
              <h3>Destino & Simulação de Prazo</h3>
              <p className="card-subtext">Defina se a compra é para um cliente específico ou estoque geral</p>
            </div>
          </div>
          
          <div className="form-group-full mb-15">
            <label>Destino da Compra *</label>
            <div className="toggle-options-grid">
              <button 
                type="button" 
                className={`btn-toggle-option ${destino === 'geral' ? 'active' : ''}`}
                onClick={() => { setDestino('geral'); setPedidoSelecionado(null); }}
              >
                🏢 Reposição para Estoque Geral
              </button>
              <button 
                type="button" 
                className={`btn-toggle-option ${destino === 'pedido' ? 'active' : ''}`}
                onClick={() => { setDestino('pedido'); setModalPedidosAberto(true); }}
              >
                🎈 Compra Exclusiva para Pedido/Cliente
              </button>
            </div>
          </div>

          {destino === 'pedido' && (
            <div className="card-pedido-vinculado mb-15">
              {pedidoSelecionado ? (
                <div className="pedido-info-box">
                  <div className="p-header">
                    <strong>{pedidoSelecionado.clienteNome}</strong>
                    <span className="p-badge-status">{pedidoSelecionado.status || 'EM ABERTO'}</span>
                  </div>
                  <p className="p-meta">🎉 Festa: <b>{pedidoSelecionado.temaFesta || 'Tema não informado'}</b></p>
                  <p className="p-meta">📅 Data Retirada: <b>{pedidoSelecionado.dataRetirada ? pedidoSelecionado.dataRetirada.split('-').reverse().join('/') : 'A definir'}</b></p>
                  <button type="button" className="btn-alterar-pedido" onClick={() => setModalPedidosAberto(true)}>
                    🔄 Trocar Pedido
                  </button>
                </div>
              ) : (
                <div className="pedido-empty-box" onClick={() => setModalPedidosAberto(true)}>
                  <span>🔍 Clique aqui para buscar e vincular o pedido do cliente...</span>
                </div>
              )}
            </div>
          )}

          <div className="form-group-full mb-15">
            <label>Condição de Chegada do Item *</label>
            <select value={condicao} onChange={e => setCondicao(e.target.value)}>
              <option value="pronto">✅ Item Pronto para Uso (Não precisa montagem/pintura)</option>
              <option value="preparar">🛠️ Necessita Preparação (+3 dias úteis de lixa/pintura/montagem)</option>
            </select>
          </div>

          <div className="form-group-full mb-15">
            <label>Tipo de Frete / Prazo de Entrega Estimado *</label>
            <select value={tipoEntrega} onChange={e => setTipoEntrega(e.target.value)}>
              <option value="1">⚡ Retirada Presencial / Compra Local (1 dia)</option>
              <option value="5">🚚 Frete Expresso / Sedex (Até 5 dias úteis)</option>
              <option value="10">📦 Frete Padrão / PAC (Até 10 dias úteis)</option>
              <option value="20">🚢 Frete Internacional / China (Até 20 dias úteis)</option>
              <option value="outro">✏️ Informar Dias Personalizados</option>
            </select>
          </div>

          {tipoEntrega === 'outro' && (
            <div className="form-group-full mb-15">
              <label>Nº de Dias Úteis de Frete *</label>
              <input 
                type="number" 
                min="1" 
                value={diasPersonalizados} 
                onChange={e => setDiasPersonalizados(e.target.value)} 
                placeholder="Ex: 15"
              />
            </div>
          )}

          {destino === 'pedido' && pedidoSelecionado && mensagemPrazo && (
            <div className={`alerta-prazo-box ${erroPrazo ? 'erro' : 'sucesso'}`}>
              <p>{mensagemPrazo}</p>
            </div>
          )}

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

      {/* MODAL DE SELEÇÃO DE PEDIDOS COM SUPORTE A PEDIDOS EM ABERTO */}
      {modalPedidosAberto && (
        <div className="modal-overlay-premium">
          <div className="modal-box-pedido">
            <div className="modal-header-pedido">
              <div>
                <h3>Selecione o Evento</h3>
                <p>Busque o pedido do cliente na lista abaixo ou vincule a um pedido em atendimento.</p>
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
              {/* BOTÃO PARA DIGITAR MANUALMENTE OU VINCULAR A PEDIDO EM ABERTO */}
              <div 
                className="card-pedido-select"
                onClick={cadastrarPedidoManual}
                style={{ background: '#fffbeb', borderColor: '#fde68a', cursor: 'pointer' }}
              >
                <div className="cp-left">
                  <span className="cp-id">➕ NOVO</span>
                  <strong className="cp-nome" style={{ color: '#b45309' }}>Vincular a Pedido em Aberto / Digitar Cliente</strong>
                  <span className="cp-tema">Clique para digitar o nome do cliente em atendimento</span>
                </div>
                <div className="cp-right">
                  <span className="cp-status" style={{ background: '#fef08a', color: '#854d0e', fontWeight: 'bold' }}>EM ABERTO</span>
                </div>
              </div>

              {pedidosFiltrados.length === 0 ? (
                <div className="lista-vazia">Nenhum evento encontrado no banco de dados. Use a opção acima para digitar o cliente.</div>
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
                      <span className={`cp-status ${(pedido.status || 'aberto').toLowerCase()}`}>
                        {pedido.status || 'EM ABERTO'}
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