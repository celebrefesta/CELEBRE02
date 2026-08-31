import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, getDocs, serverTimestamp, query, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import './NovaCompra.css';

const NovaCompra = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  // Autenticação e Chave Mestra
  const auth = getAuth();
  const [usuarioLogado, setUsuarioLogado] = useState(auth.currentUser);
  const [tenantId, setTenantId] = useState(
    localStorage.getItem('tenantId') || auth.currentUser?.uid || null
  );

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
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedorTelefone, setFornecedorTelefone] = useState('');
  const [listaFornecedores, setListaFornecedores] = useState([]);
  const [observacoes, setObservacoes] = useState('');

  // --- ESTADOS DO VÍNCULO (PEDIDO & FORNECEDORES) ---
  const [modalPedidosAberto, setModalPedidosAberto] = useState(false);
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [buscaPedido, setBuscaPedido] = useState('');
  const [modalFornecedoresAberto, setModalFornecedoresAberto] = useState(false);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [canalCompra, setCanalCompra] = useState('online'); // 'online' | 'presencial'

  // Formatação de data brasileira
  const formatarData = (dataStr) => {
    if (!dataStr) return 'Data não informada';
    const partes = String(dataStr).split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
  };

  // SISTEMA DE AUDITORIA
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || 'Equipe';
      await addDoc(collection(db, 'logs_atividades'), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || 'Desconhecido',
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao gravar log da auditoria de compras:', error);
    }
  };

  // Escuta o estado de autenticação de forma segura
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      setUsuarioLogado(user);
      const tid = localStorage.getItem('tenantId') || user.uid;
      setTenantId(tid);
    });
    return () => unsubscribe();
  }, [navigate]);

  // Carrega dados quando o tenantId estiver disponível
  useEffect(() => {
    if (!tenantId) return;
    carregarPedidosFuturos();
    carregarFornecedores();
    if (isEditing) {
      carregarDadosEdicao();
    } else {
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
          status: 'EM ABERTO',
        });
      }
    }
  }, [tenantId, isEditing]);

  const carregarDadosEdicao = async () => {
    try {
      const docRef = doc(db, 'lista_compras', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.userId && data.userId !== tenantId) {
          alert('Acesso negado: Esta compra não pertence à sua empresa.');
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
        if (data.tipoEntrega === '1' || data.diasFrete === 1) {
          setCanalCompra('presencial');
        } else {
          setCanalCompra('online');
        }
        if (data.diasFrete !== undefined && data.tipoEntrega === 'outro') {
          setDiasPersonalizados(String(data.diasFrete));
        }
        if (data.vinculoTipo === 'pedido' && data.vinculoId) {
          const pedRef = doc(db, 'locacoes', data.vinculoId);
          const pedSnap = await getDoc(pedRef);
          if (pedSnap.exists()) {
            setPedidoSelecionado({ id: pedSnap.id, ...pedSnap.data() });
          } else {
            setPedidoSelecionado({ id: data.vinculoId, clienteNome: data.vinculo, temaFesta: '', dataRetirada: data.prazo });
          }
        }
      } else {
        alert('Erro: Item não encontrado no banco de dados.');
        navigate('/compras');
      }
    } catch (error) {
      console.error('Erro ao carregar edição:', error);
    } finally {
      setCarregandoEdicao(false);
    }
  };

  const carregarPedidosFuturos = async () => {
    if (!tenantId) return;
    try {
      const q = query(collection(db, 'locacoes'), where('userId', '==', tenantId));
      const snapshot = await getDocs(q);
      let locacoes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      locacoes.sort((a, b) => {
        const timeA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : (a.dataRetirada ? new Date(a.dataRetirada).getTime() : 0);
        const timeB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : (b.dataRetirada ? new Date(b.dataRetirada).getTime() : 0);
        return timeB - timeA;
      });
      const pedidosAtivos = locacoes.filter(loc => {
        const st = (loc.status || '').toLowerCase().trim();
        return !st.includes('cancelado');
      });
      setPedidosDisponiveis(pedidosAtivos);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    }
  };

  const carregarFornecedores = async () => {
    const activeUid = tenantId || usuarioLogado?.uid;
    if (!activeUid) return;
    try {
      let snapshot;
      try {
        const q = query(collection(db, 'fornecedores'), where('userId', '==', activeUid));
        snapshot = await getDocs(q);
      } catch (err) {
        if (usuarioLogado?.uid && usuarioLogado.uid !== activeUid) {
          const q2 = query(collection(db, 'fornecedores'), where('userId', '==', usuarioLogado.uid));
          snapshot = await getDocs(q2);
        }
      }
      if (snapshot) {
        const listaF = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setListaFornecedores(listaF);
      }
    } catch (error) {
      setListaFornecedores([]);
    }
  };

  const cadastrarPedidoManual = () => {
    const nomeCli = prompt('Digite o nome do Cliente ou Pedido em Aberto:');
    if (nomeCli && nomeCli.trim()) {
      const dataFesta = prompt('Data da festa (AAAA-MM-DD) [opcional]:', '') || '';
      const novoPedido = {
        id: `manual_${Date.now()}`,
        clienteNome: nomeCli.trim(),
        dataRetirada: dataFesta,
        temaFesta: 'Pedido em Aberto (Manual)',
        status: 'EM ABERTO',
      };
      selecionarPedido(novoPedido);
    }
  };

  useEffect(() => {
    if (!permitirSimulador) return;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
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
    let v = value.replace(/\D/g, '');
    if (!v) return '';
    return (v / 100).toFixed(2).replace('.', ',').replace(/(\d)(\d{3})(\d{3}),/g, '$1.$2.$3,').replace(/(\d)(\d{3}),/g, '$1.$2,');
  };

  const selecionarPedido = (pedido) => {
    setPermitirSimulador(true);
    setPedidoSelecionado(pedido);
    setDestino('pedido');
    setModalPedidosAberto(false);
  };

  const salvarCompra = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return alert('Digite o nome do item!');
    if (destino === 'pedido' && !pedidoSelecionado) return alert('Selecione o pedido para vincular a compra!');
    if (erroPrazo && destino === 'pedido') return alert('O sistema bloqueou a operação: O item não chegará a tempo da festa!');
    setSalvando(true);
    try {
      const custoNum = valorEstimado ? Number(valorEstimado.replace(/\./g, '').replace(',', '.')) : 0;
      const aluguelNum = valorAluguel ? Number(valorAluguel.replace(/\./g, '').replace(',', '.')) : 0;
      let nomeVinculo = 'Estoque Geral';
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
        fornecedorId: fornecedorId === 'OUTRO' ? '' : fornecedorId,
        fornecedorTelefone: fornecedorTelefone || '',
        obs: observacoes,
        vinculoTipo: destino,
        vinculoId: idVinculo,
        vinculo: nomeVinculo,
        tipoEntrega: tipoEntrega,
        diasFrete: diasDeEntrega,
      };
      if (isEditing) {
        const docRef = doc(db, 'lista_compras', id);
        await updateDoc(docRef, { ...dadosDaCompra, atualizadoEm: serverTimestamp() });
        await registrarLog('EDIÇÃO DE COMPRA', `Atualizou os dados da solicitação de compra: "${dadosDaCompra.nome}".`);
        alert('Solicitação atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'lista_compras'), {
          ...dadosDaCompra,
          status: 'pendente',
          createdAt: serverTimestamp(),
          userId: tenantId,
        });
        await registrarLog('NOVA COMPRA', `Criou uma solicitação de compra para: "${dadosDaCompra.nome}" (Qtd: ${dadosDaCompra.quantidade}).`);
        alert('Nova solicitação de compra criada!');
      }
      navigate('/compras');
    } catch (error) {
      alert('Erro ao salvar a operação.');
    } finally {
      setSalvando(false);
    }
  };

  const pedidosFiltrados = pedidosDisponiveis.filter(p => {
    const termo = buscaPedido.toLowerCase();
    return (
      (p.clienteNome || '').toLowerCase().includes(termo) ||
      (p.temaFesta || '').toLowerCase().includes(termo) ||
      (p.numeroPedido || '').includes(termo) ||
      (p.status || '').toLowerCase().includes(termo)
    );
  });

  const fornecedoresFiltradosModal = listaFornecedores.filter(f => {
    const termo = buscaFornecedor.toLowerCase().trim();
    if (!termo) return true;
    return (
      (f.nome || '').toLowerCase().includes(termo) ||
      (f.contato || '').includes(termo) ||
      (f.categoria || '').toLowerCase().includes(termo)
    );
  });

  if (carregandoEdicao) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', border: '4px solid #e2e8f0', borderTop: '4px solid #c5a059', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
      <span style={{ color: '#64748b', fontWeight: '700' }}>Carregando dados da compra...</span>
    </div>
  );

  const diasEntregaNum = tipoEntrega === 'outro' ? (Number(diasPersonalizados) || 0) : Number(tipoEntrega);

  return (
    <div className="nova-compra-page form-page-container fade-in">

      {/* ===== HERO CABEÇALHO & BREADCRUMB (PADRÃO CLIENTES) ===== */}
      <div className="cadastro-hero-header">
        <div className="cadastro-hero-left">
          <div className="breadcrumb-nav">
            <Link to="/compras"><i className="fas fa-cart-shopping"></i> Compras</Link>
            <span className="separator">/</span>
            <span className="current-page">{isEditing ? 'Editar Solicitação' : 'Nova Solicitação'}</span>
          </div>
          <div className="hero-title-group">
            <div className="header-icon-badge">
              <i className={isEditing ? "fas fa-pen-to-square" : "fas fa-cart-shopping"}></i>
            </div>
            <div>
              <h1 className="form-page-title">{isEditing ? 'Editar Solicitação de Compra' : 'Nova Solicitação de Compra'}</h1>
              <p className="form-page-subtitle">Registre itens para o acervo, insumos ou materiais vinculados a pedidos de clientes.</p>
            </div>
          </div>
        </div>
        <div className="cadastro-hero-right-actions">
          <button type="button" className="btn-secondary-celebre" onClick={() => navigate('/compras')}>
            <i className="fas fa-arrow-left"></i>
            <span>Voltar para Lista</span>
          </button>
        </div>
      </div>

      {/* ===== FORMULÁRIO WIDESCREEN & CARTÃO UNIFICADO ===== */}
      <div className="form-widescreen">
        <form onSubmit={salvarCompra}>
          <div className="form-section-card unified-sheet-card">

            {/* SEÇÃO 1: DESTINO DA COMPRA */}
            <div className="unified-section-header">
              <span className="section-header-icon">
                <i className="fas fa-bullseye"></i>
              </span>
              <div>
                <h3>PARA QUEM É ESTA COMPRA?</h3>
                <p>Defina se vai para o estoque geral ou para um pedido específico de cliente</p>
              </div>
            </div>

            <div className="toggle-servico-vip nc-destino-grid">
              <button
                type="button"
                className={`btn-servico-card ${destino === 'geral' ? 'active' : ''}`}
                onClick={() => { setDestino('geral'); setPedidoSelecionado(null); }}
                title="Item vai para o estoque geral da empresa"
              >
                <div className="servico-icon-box">
                  <i className="fas fa-boxes-stacked"></i>
                </div>
                <div className="servico-info">
                  <strong>Reposição de Acervo</strong>
                  <small>Estoque geral da loja</small>
                </div>
                <div className="servico-check-badge">
                  {destino === 'geral' && <span className="check-mark">✓</span>}
                </div>
              </button>

              <button
                type="button"
                className={`btn-servico-card ${destino === 'pedido' ? 'active' : ''}`}
                onClick={() => { setDestino('pedido'); setModalPedidosAberto(true); }}
                title="Item exclusivo para um cliente ou evento"
              >
                <div className="servico-icon-box">
                  <i className="fas fa-champagne-glasses"></i>
                </div>
                <div className="servico-info">
                  <strong>Pedido Específico</strong>
                  <small>Para cliente ou festa</small>
                </div>
                <div className="servico-check-badge">
                  {destino === 'pedido' && <span className="check-mark">✓</span>}
                </div>
              </button>
            </div>

            {/* Card do pedido vinculado */}
            {destino === 'pedido' && (
              <div style={{ marginTop: '14px' }}>
                {pedidoSelecionado ? (
                  <div className="nc-pedido-vinculado">
                    <div className="nc-pedido-info">
                      <div className="nc-pedido-avatar">
                        <i className="fas fa-champagne-glasses" style={{ color: '#c5a059' }}></i>
                      </div>
                      <div>
                        <div className="nc-pedido-tag">PEDIDO #{pedidoSelecionado.numeroPedido || pedidoSelecionado.id?.substring(0,6)}</div>
                        <strong>{pedidoSelecionado.cliente?.nome || pedidoSelecionado.clienteNome || 'Cliente em Atendimento'}</strong>
                        <p>
                          {pedidoSelecionado.temaFesta || pedidoSelecionado.tema || 'Tema não informado'} • Evento: {formatarData(pedidoSelecionado.dataEvento || pedidoSelecionado.dataRetirada)}
                        </p>
                      </div>
                    </div>
                    <div className="nc-pedido-actions">
                      <button
                        type="button"
                        className="nc-btn-trocar"
                        onClick={() => setModalPedidosAberto(true)}
                      >
                        <i className="fas fa-arrow-rotate-right"></i> Trocar
                      </button>
                      <button
                        type="button"
                        className="nc-btn-remover-pedido"
                        onClick={() => setPedidoSelecionado(null)}
                        title="Desvincular pedido"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="nc-pedido-empty" onClick={() => setModalPedidosAberto(true)}>
                    <div className="nc-vazio-icon"><i className="fas fa-link"></i></div>
                    <div>
                      <strong>Nenhum pedido vinculado</strong>
                      <p>Clique aqui para selecionar a qual locação ou cliente este item pertence</p>
                    </div>
                    <button type="button" className="nc-btn-vincular">
                      <i className="fas fa-search"></i> Vincular Pedido
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Alerta de prazo */}
            {destino === 'pedido' && pedidoSelecionado && mensagemPrazo && (
              <div className={`nc-alerta ${erroPrazo ? 'nc-alerta-erro' : 'nc-alerta-ok'}`}>
                <i className={erroPrazo ? "fas fa-triangle-exclamation" : "fas fa-circle-check"}></i>
                <span>{mensagemPrazo}</span>
              </div>
            )}

            {/* SEÇÃO 2: DETALHES DO ITEM E VALORES */}
            <div className="form-section-divider"></div>

            <div className="unified-section-header">
              <span className="section-header-icon">
                <i className="fas fa-tag"></i>
              </span>
              <div>
                <h3>O QUE SERÁ COMPRADO?</h3>
                <p>Identifique o item, quantidade, categoria e valores estimados</p>
              </div>
            </div>

            <div className="form-grid-4">
              {/* LINHA 1: NOME DO ITEM (Largo) + QUANTIDADE (Compacto) NA MESMA LINHA */}
              <div className="nc-row-nome-qtd span-4">
                <div className="form-group nc-field-nome">
                  <label htmlFor="nc-nome">NOME DO ITEM / PEÇA *</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fas fa-box-open"></i></span>
                    <input
                      id="nc-nome"
                      type="text"
                      placeholder="Ex: Vaso Murano Âmbar 30cm, Boleira Ouro..."
                      value={nome}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNome(val.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase()));
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group nc-field-qtd">
                  <label htmlFor="nc-qtd">QTD *</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fas fa-hashtag"></i></span>
                    <input
                      id="nc-qtd"
                      type="number"
                      min="1"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      className="nc-input-center"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* LINHA 2: CATEGORIA + FORMATO (OU KIT COM Nº PEÇAS) */}
              <div className={`form-group ${categoria === 'acervo' ? (formato === 'kit' ? 'span-2 col-mobile-half' : 'span-2 col-mobile-half') : 'span-4'}`}>
                <label htmlFor="nc-cat">CATEGORIA *</label>
                <select
                  id="nc-cat"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="acervo">📦 Peça de Acervo / Decoração</option>
                  <option value="insumo">🛠️ Insumo / Consumível (Balões, Fitas)</option>
                  <option value="infraestrutura">🏢 Infraestrutura / Escritório</option>
                </select>
              </div>

              {categoria === 'acervo' && (
                <div className={`form-group ${formato === 'kit' ? 'span-1 col-mobile-half' : 'span-2 col-mobile-half'}`}>
                  <label htmlFor="nc-fmt">FORMATO *</label>
                  <select
                    id="nc-fmt"
                    value={formato}
                    onChange={(e) => setFormato(e.target.value)}
                  >
                    <option value="unidade">Peça Avulsa / Única</option>
                    <option value="kit">Kit / Conjunto de Peças</option>
                  </select>
                </div>
              )}

              {categoria === 'acervo' && formato === 'kit' && (
                <div className="form-group span-1 col-mobile-half">
                  <label htmlFor="nc-pkit">Nº PEÇAS NO KIT *</label>
                  <input
                    id="nc-pkit"
                    type="number"
                    min="2"
                    value={quantidadePecasKit}
                    onChange={(e) => setQuantidadePecasKit(e.target.value)}
                    className="nc-input-center"
                  />
                </div>
              )}

              {/* LINHA 3: CUSTO UNITÁRIO ESTIMADO + ALUGUEL ESTIMADO DA PEÇA */}
              <div className={`form-group ${categoria === 'acervo' ? 'span-2 col-mobile-half' : 'span-4'}`}>
                <label htmlFor="nc-custo">CUSTO UNITÁRIO ESTIMADO</label>
                <div className="input-icon-wrapper">
                  <span className="input-left-icon"><strong style={{ fontSize: '0.75rem', color: '#c5a059' }}>R$</strong></span>
                  <input
                    id="nc-custo"
                    type="text"
                    placeholder="0,00"
                    value={valorEstimado}
                    onChange={(e) => setValorEstimado(maskCurrency(e.target.value))}
                  />
                </div>
              </div>

              {categoria === 'acervo' && (
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="nc-aluguel">ALUGUEL ESTIMADO DA PEÇA</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><strong style={{ fontSize: '0.75rem', color: '#16a34a' }}>R$</strong></span>
                    <input
                      id="nc-aluguel"
                      type="text"
                      placeholder="0,00"
                      value={valorAluguel}
                      onChange={(e) => setValorAluguel(maskCurrency(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {/* LINHA 4: OBSERVAÇÕES */}
              <div className="form-group span-4">
                <label htmlFor="nc-obs">OBSERVAÇÕES / ESPECIFICAÇÕES (COR, TAMANHO, LINK)</label>
                <textarea
                  id="nc-obs"
                  rows="2"
                  placeholder="Ex: Comprar preferencialmente na cor Dourado Fosco, tamanho G..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                ></textarea>
              </div>
            </div>

            {/* SEÇÃO 3: LOGÍSTICA, CANAL E FORNECEDOR */}
            <div className="form-section-divider"></div>

            <div className="unified-section-header">
              <span className="section-header-icon">
                <i className="fas fa-truck-fast"></i>
              </span>
              <div>
                <h3>ONDE E COMO COMPRAR?</h3>
                <p>Canal de compra, fornecedor, tipo de frete e prazo estimado</p>
              </div>
            </div>

            <div className="toggle-servico-vip nc-canal-toggle">
              <button
                type="button"
                className={`btn-servico-card ${canalCompra === 'online' ? 'active' : ''}`}
                onClick={() => { setCanalCompra('online'); if (tipoEntrega === '1') setTipoEntrega('10'); }}
                title="Mercado Livre, Shopee, Amazon, e-commerce..."
              >
                <div className="servico-icon-box">
                  <i className="fas fa-globe"></i>
                </div>
                <div className="servico-info">
                  <strong>Compra Online</strong>
                  <small>Mercado Livre, Shopee, E-commerce...</small>
                </div>
                <div className="servico-check-badge">
                  {canalCompra === 'online' && <span className="check-mark">✓</span>}
                </div>
              </button>

              <button
                type="button"
                className={`btn-servico-card ${canalCompra === 'presencial' ? 'active' : ''}`}
                onClick={() => { setCanalCompra('presencial'); setTipoEntrega('1'); }}
                title="Loja física, na cidade, atacado local..."
              >
                <div className="servico-icon-box">
                  <i className="fas fa-store"></i>
                </div>
                <div className="servico-info">
                  <strong>Compra Presencial</strong>
                  <small>Loja física ou comércio na cidade</small>
                </div>
                <div className="servico-check-badge">
                  {canalCompra === 'presencial' && <span className="check-mark">✓</span>}
                </div>
              </button>
            </div>

            <div className="form-grid-4" style={{ marginTop: '14px' }}>
              <div className="form-group span-4">
                <div className="tag-header-row">
                  <label htmlFor="nc-fornecedor">
                    {canalCompra === 'online' ? 'LOJA / E-COMMERCE' : 'FORNECEDOR / LOJA FÍSICA'}
                    {fornecedorId && <span className="nc-badge-cadastrado">✓ Cadastrado</span>}
                  </label>
                  <button
                    type="button"
                    className="btn-auto-tag-suggest"
                    onClick={() => setModalFornecedoresAberto(true)}
                  >
                    <i className="fas fa-magnifying-glass"></i> Buscar Cadastrado {listaFornecedores.length > 0 && `(${listaFornecedores.length})`}
                  </button>
                </div>
                <div className="input-icon-wrapper">
                  <span className="input-left-icon">
                    <i className={canalCompra === 'online' ? "fas fa-globe" : "fas fa-store"}></i>
                  </span>
                  <input
                    id="nc-fornecedor"
                    type="text"
                    placeholder={canalCompra === 'online' ? 'Ex: Mercado Livre, Shopee, Amazon, AliExpress...' : 'Ex: Festas e Chocolate, Armarinho Fernando, Atacado local...'}
                    value={fornecedor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFornecedor(val);
                      setFornecedorId('');
                      if (val.toLowerCase().includes('mercado livre')) { setCanalCompra('online'); setTipoEntrega('2'); }
                      else if (val.toLowerCase().includes('shopee')) { setCanalCompra('online'); setTipoEntrega('20'); }
                    }}
                  />
                </div>
              </div>

              <div className="form-group span-2 col-mobile-half">
                <label htmlFor="nc-frete">
                  TIPO DE FRETE / ENTREGA *
                  {fornecedor.toLowerCase().includes('mercado livre') && (
                    <span className="nc-hint-ml">⚡ Opções ML</span>
                  )}
                </label>
                <select id="nc-frete" value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)}>
                  {canalCompra === 'online' ? (
                    fornecedor.toLowerCase().includes('mercado livre') ? (
                      <>
                        <option value="2">⚡ ML Full / Entrega Amanhã (1–2 dias úteis)</option>
                        <option value="5">🚚 Mercado Envios / Expresso (até 5 dias)</option>
                        <option value="10">📦 Mercado Envios / Padrão (até 10 dias)</option>
                        <option value="outro">✏️ Dias Personalizados</option>
                      </>
                    ) : (
                      <>
                        <option value="2">⚡ Expresso / Full (1–2 dias úteis)</option>
                        <option value="5">🚚 Sedex / Expresso (até 5 dias úteis)</option>
                        <option value="10">📦 PAC / Padrão (até 10 dias úteis)</option>
                        <option value="20">🚢 Internacional / Shopee / China (até 20 dias)</option>
                        <option value="outro">✏️ Dias Personalizados</option>
                      </>
                    )
                  ) : (
                    <>
                      <option value="1">⚡ Compra Local / Retirada na Loja (1 dia)</option>
                      <option value="3">🏬 Encomenda em Loja Física (até 3 dias úteis)</option>
                      <option value="outro">✏️ Dias Personalizados</option>
                    </>
                  )}
                </select>
              </div>

              {tipoEntrega === 'outro' && (
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="nc-dias">Nº DE DIAS ÚTEIS *</label>
                  <input
                    id="nc-dias"
                    type="number"
                    min="1"
                    value={diasPersonalizados}
                    onChange={(e) => setDiasPersonalizados(e.target.value)}
                    placeholder="Ex: 15"
                  />
                </div>
              )}

              <div className="form-group span-2 col-mobile-half">
                <label htmlFor="nc-cond">CONDIÇÃO DE CHEGADA *</label>
                <select id="nc-cond" value={condicao} onChange={(e) => setCondicao(e.target.value)}>
                  <option value="pronto">✅ Pronto para Uso (sem preparação)</option>
                  <option value="preparar">🛠️ Necessita Preparação (+3 dias)</option>
                </select>
              </div>
            </div>

            {diasEntregaNum > 0 && (
              <div className="nc-prazo-preview">
                <i className="fas fa-calendar-day" style={{ fontSize: '18px', color: '#c5a059' }}></i>
                <span>
                  Com o frete selecionado, o item chegará em aproximadamente <strong>{diasEntregaNum} dias úteis</strong>
                  {condicao === 'preparar' && <span> + <strong>3 dias</strong> de preparação</span>}.
                </span>
              </div>
            )}

            {/* BARRA DE AÇÕES NO RODAPÉ DO CARTÃO UNIFICADO */}
            <div className="unified-card-actions-bar">
              <button type="button" className="btn-cancelar-celebre" onClick={() => navigate('/compras')}>
                <i className="fas fa-times"></i> Cancelar
              </button>
              <button
                type="submit"
                className={`btn-salvar-celebre-gold ${erroPrazo && destino === 'pedido' ? 'nc-btn-blocked' : ''}`}
                disabled={salvando || (erroPrazo && destino === 'pedido')}
              >
                {salvando ? (
                  <><i className="fas fa-spinner fa-spin"></i> Salvando...</>
                ) : erroPrazo && destino === 'pedido' ? (
                  '⛔ Prazo Inviável'
                ) : isEditing ? (
                  <><i className="fas fa-check"></i> Salvar Alterações</>
                ) : (
                  <><i className="fas fa-cart-plus"></i> Criar Solicitação de Compra</>
                )}
              </button>
            </div>

          </div>
        </form>
      </div>

      {/* ===== MODAL: SELECIONAR EVENTO / PEDIDO ===== */}
      {modalPedidosAberto && (
        <div className="modal-overlay-premium" onClick={() => { if (!pedidoSelecionado) setDestino('geral'); setModalPedidosAberto(false); }}>
          <div className="modal-box-pedido" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-pedido">
              <div className="modal-header-left">
                <div className="modal-header-icon-badge">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <div>
                  <h3>Selecione o Evento</h3>
                  <p>Vincule esta compra a um pedido ou evento de cliente</p>
                </div>
              </div>
              <button 
                type="button"
                className="btn-fechar-modal" 
                onClick={() => { if (!pedidoSelecionado) setDestino('geral'); setModalPedidosAberto(false); }}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="modal-search-box">
              <i className="fas fa-magnifying-glass modal-search-icon"></i>
              <input 
                type="text" 
                placeholder="Buscar por cliente, tema ou código..." 
                value={buscaPedido} 
                onChange={(e) => setBuscaPedido(e.target.value)} 
                autoFocus 
              />
              {buscaPedido && (
                <button type="button" className="modal-search-clear" onClick={() => setBuscaPedido('')}>
                  ✕
                </button>
              )}
            </div>

            <div className="modal-lista-pedidos">
              {/* Opção de vincular manualmente / em atendimento */}
              <div className="card-pedido-select card-pedido-novo" onClick={cadastrarPedidoManual}>
                <div className="cp-left">
                  <span className="cp-badge-novo"><i className="fas fa-plus"></i> NOVO / AVULSO</span>
                  <strong className="cp-nome">Digitar Cliente / Pedido em Atendimento</strong>
                  <span className="cp-tema">Clique para digitar o nome do cliente ou evento em negociação</span>
                </div>
                <div className="cp-right">
                  <span className="cp-status-pill status-aberto">EM ABERTO</span>
                </div>
              </div>

              {pedidosFiltrados.length === 0 ? (
                <div className="modal-lista-vazia">
                  <i className="fas fa-inbox"></i>
                  <span>Nenhum evento encontrado. Use a opção acima para digitar o cliente.</span>
                </div>
              ) : (
                pedidosFiltrados.map((pedido) => {
                  const statusRaw = (pedido.status || 'aberto').toLowerCase();
                  let statusClass = 'status-aberto';
                  if (statusRaw.includes('aprov') || statusRaw.includes('pago') || statusRaw.includes('confirm')) statusClass = 'status-aprovado';
                  else if (statusRaw.includes('entreg')) statusClass = 'status-entregue';
                  else if (statusRaw.includes('finaliz') || statusRaw.includes('devolv') || statusRaw.includes('concl')) statusClass = 'status-finalizado';
                  else if (statusRaw.includes('orcam') || statusRaw.includes('orçam')) statusClass = 'status-orcamento';

                  return (
                    <div key={pedido.id} className="card-pedido-select" onClick={() => selecionarPedido(pedido)}>
                      <div className="cp-left">
                        <div className="cp-meta-row">
                          <span className="cp-id">#{pedido.numeroPedido || 'S/N'}</span>
                          {pedido.temaFesta && (
                            <span className="cp-tema">
                              <i className="fas fa-cake-candles"></i> {pedido.temaFesta}
                            </span>
                          )}
                        </div>
                        <strong className="cp-nome">{pedido.clienteNome}</strong>
                      </div>
                      <div className="cp-right">
                        <div className="cp-data-box">
                          <span className="label">Data do Evento</span>
                          <strong>{pedido.dataRetirada ? pedido.dataRetirada.split('-').reverse().join('/') : 'S/D'}</strong>
                        </div>
                        <span className={`cp-status-pill ${statusClass}`}>
                          {pedido.status || 'EM ABERTO'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: BUSCAR FORNECEDOR ===== */}
      {modalFornecedoresAberto && (
        <div className="modal-overlay-premium" onClick={() => setModalFornecedoresAberto(false)}>
          <div className="modal-box-pedido" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-pedido">
              <div className="modal-header-left">
                <div className="modal-header-icon-badge">
                  <i className="fas fa-truck-field"></i>
                </div>
                <div>
                  <h3>Buscar Fornecedor Cadastrado</h3>
                  <p>Selecione um parceiro ou feche para digitar livremente</p>
                </div>
              </div>
              <button type="button" className="btn-fechar-modal" onClick={() => setModalFornecedoresAberto(false)} title="Fechar">✕</button>
            </div>

            <div className="modal-search-box">
              <i className="fas fa-magnifying-glass modal-search-icon"></i>
              <input 
                type="text" 
                placeholder="Buscar por nome, telefone ou categoria..." 
                value={buscaFornecedor} 
                onChange={(e) => setBuscaFornecedor(e.target.value)} 
                autoFocus 
              />
              {buscaFornecedor && (
                <button type="button" className="modal-search-clear" onClick={() => setBuscaFornecedor('')}>
                  ✕
                </button>
              )}
            </div>

            {/* Atalhos rápidos dentro do modal */}
            <div className="modal-atalhos">
              <span className="modal-atalhos-label"><i className="fas fa-bolt" style={{ color: '#c5a059' }}></i> Atalhos Rápidos:</span>
              <div className="modal-atalhos-chips">
                {[
                  { label: '🛒 Mercado Livre', canal: 'online', frete: '2', nome: 'Mercado Livre' },
                  { label: '🛍️ Shopee', canal: 'online', frete: '20', nome: 'Shopee' },
                  { label: '🏪 Festas e Chocolate', canal: 'presencial', frete: '1', nome: 'Festas e Chocolate' },
                  { label: '📦 Armarinho Fernando', canal: 'presencial', frete: '1', nome: 'Armarinho Fernando' },
                ].map((at) => (
                  <button
                    key={at.nome}
                    type="button"
                    className={`nc-chip ${fornecedor === at.nome ? 'nc-chip-active' : ''}`}
                    onClick={() => { setFornecedor(at.nome); setFornecedorId(''); setCanalCompra(at.canal); setTipoEntrega(at.frete); setModalFornecedoresAberto(false); }}
                  >
                    {at.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-lista-pedidos">
              <div className="card-pedido-select card-pedido-livre" onClick={() => { setFornecedorId(''); setModalFornecedoresAberto(false); }}>
                <div className="cp-left">
                  <span className="cp-badge-novo"><i className="fas fa-pen"></i> DIGITAÇÃO LIVRE</span>
                  <strong className="cp-nome">Digitar Fornecedor / Loja da Internet</strong>
                  <span className="cp-tema">Fechar e digitar qualquer loja (Mercado Livre, Shopee, fornecedor local, etc.)</span>
                </div>
              </div>

              {fornecedoresFiltradosModal.length === 0 ? (
                <div className="modal-lista-vazia">
                  <i className="fas fa-inbox"></i>
                  <span>Nenhum fornecedor cadastrado encontrado.</span>
                </div>
              ) : (
                fornecedoresFiltradosModal.map((f) => (
                  <div
                    key={f.id}
                    className="card-pedido-select card-fornecedor"
                    onClick={() => { setFornecedor(f.nome || ''); setFornecedorId(f.id); setFornecedorTelefone(f.contato || f.telefone || f.whatsapp || ''); setModalFornecedoresAberto(false); }}
                  >
                    <div className="cp-left">
                      <div className="cp-meta-row">
                        <strong className="cp-nome-fornecedor"><i className="fas fa-store"></i> {f.nome}</strong>
                        {f.categoria && <span className="cp-cat-badge">{f.categoria}</span>}
                      </div>
                      {f.contato && <span className="cp-contato"><i className="fas fa-phone"></i> {f.contato}</span>}
                      {f.endereco && <span className="cp-endereco"><i className="fas fa-location-dot"></i> {f.endereco}</span>}
                    </div>
                    <div className="cp-right">
                      <span className="btn-selecionar-pill">Selecionar <i className="fas fa-check"></i></span>
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
