import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

  const totalEstimado = (Number(quantidade) || 1) * (valorEstimado ? Number(valorEstimado.replace(/\./g, '').replace(',', '.')) : 0);
  const diasEntregaNum = tipoEntrega === 'outro' ? (Number(diasPersonalizados) || 0) : Number(tipoEntrega);

  return (
    <div className="nc-page fade-in">

      {/* ===== HERO HEADER ===== */}
      <div className="nc-hero">
        <div className="nc-hero-left">
          <div className="nc-hero-badge">
            <span>✨</span> GESTÃO DE COMPRAS &amp; AQUISIÇÕES
          </div>
          <h1>{isEditing ? '✏️ Editar Solicitação de Compra' : '🛒 Nova Solicitação de Compra'}</h1>
          <p>Registre itens para o acervo, insumos ou materiais vinculados a pedidos de clientes.</p>
        </div>
        <button className="nc-btn-back" onClick={() => navigate('/compras')}>
          ← Voltar para Lista
        </button>
      </div>

      {/* ===== STEPPER INDICATOR ===== */}
      <div className="nc-steps">
        <div className="nc-step nc-step-active">
          <div className="nc-step-dot">1</div>
          <span>Para quem?</span>
        </div>
        <div className="nc-step-line"></div>
        <div className="nc-step nc-step-active">
          <div className="nc-step-dot">2</div>
          <span>O que comprar?</span>
        </div>
        <div className="nc-step-line"></div>
        <div className="nc-step nc-step-active">
          <div className="nc-step-dot">3</div>
          <span>Onde e como?</span>
        </div>
      </div>

      <form className="nc-form" onSubmit={salvarCompra}>

        {/* ===== SEÇÃO 1: PARA QUEM É ESTA COMPRA (DESTINO) ===== */}
        <div className="nc-section">
          <div className="nc-section-title">
            <div className="nc-section-icon nc-icon-green">🎯</div>
            <div>
              <h2>Para quem é esta compra?</h2>
              <p>Defina se vai para o estoque geral ou para um pedido específico de cliente</p>
            </div>
          </div>

          <div className="nc-destino-grid">
            <button
              type="button"
              className={`nc-destino-card ${destino === 'geral' ? 'nc-destino-ativo' : ''}`}
              onClick={() => { setDestino('geral'); setPedidoSelecionado(null); }}
            >
              <div className="nc-destino-icon">🏢</div>
              <div className="nc-destino-text">
                <strong>Reposição de Acervo</strong>
                <small>Item vai para o estoque geral da empresa</small>
              </div>
              {destino === 'geral' && <div className="nc-destino-check">✓</div>}
            </button>

            <button
              type="button"
              className={`nc-destino-card ${destino === 'pedido' ? 'nc-destino-ativo nc-destino-pedido' : ''}`}
              onClick={() => { setDestino('pedido'); setModalPedidosAberto(true); }}
            >
              <div className="nc-destino-icon">🎈</div>
              <div className="nc-destino-text">
                <strong>Pedido Específico</strong>
                <small>Item exclusivo para um cliente / evento</small>
              </div>
              {destino === 'pedido' && <div className="nc-destino-check">✓</div>}
            </button>
          </div>

          {/* Card do pedido vinculado */}
          {destino === 'pedido' && (
            <div style={{ marginTop: '16px' }}>
              {pedidoSelecionado ? (
                <div className="nc-pedido-vinculado">
                  <div className="nc-pedido-info">
                    <div className="nc-pedido-avatar">🎉</div>
                    <div>
                      <strong>{pedidoSelecionado.clienteNome}</strong>
                      <span>{pedidoSelecionado.temaFesta || 'Tema não informado'}</span>
                      {pedidoSelecionado.dataRetirada && (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          📅 {pedidoSelecionado.dataRetirada.split('-').reverse().join('/')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" className="nc-btn-alterar" onClick={() => setModalPedidosAberto(true)}>
                    🔄 Trocar
                  </button>
                </div>
              ) : (
                <div className="nc-pedido-empty" onClick={() => setModalPedidosAberto(true)}>
                  <span>🔍</span>
                  <span>Clique para buscar e vincular o pedido do cliente</span>
                </div>
              )}
            </div>
          )}

          {/* Alerta de prazo */}
          {destino === 'pedido' && pedidoSelecionado && mensagemPrazo && (
            <div className={`nc-alerta ${erroPrazo ? 'nc-alerta-erro' : 'nc-alerta-ok'}`}>
              <span>{mensagemPrazo}</span>
            </div>
          )}
        </div>

        <div className="nc-divider"></div>

        {/* ===== SEÇÃO 2: O QUE COMPRAR ===== */}
        <div className="nc-section">
          <div className="nc-section-title">
            <div className="nc-section-icon nc-icon-gold">📦</div>
            <div>
              <h2>O que será comprado?</h2>
              <p>Identifique o item, quantidade, categoria e valor estimado</p>
            </div>
          </div>

          <div className="nc-fields-grid nc-grid-3">
            {/* Nome do item — ocupa 2 colunas */}
            <div className="nc-field nc-col-span-2">
              <label htmlFor="nc-nome">Nome do Item / Peça *</label>
              <input
                id="nc-nome"
                type="text"
                placeholder="Ex: Vaso de Cerâmica Rosa Bebê, Boleira Ouro..."
                value={nome}
                onChange={e => {
                  const val = e.target.value;
                  setNome(val.replace(/(?:^|\s)\S/g, a => a.toUpperCase()));
                }}
                autoCapitalize="words"
                required
              />
            </div>

            {/* Quantidade */}
            <div className="nc-field">
              <label htmlFor="nc-qtd">Quantidade *</label>
              <input
                id="nc-qtd"
                type="number"
                min="1"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                required
              />
            </div>

            {/* Categoria */}
            <div className="nc-field">
              <label htmlFor="nc-cat">Categoria *</label>
              <select id="nc-cat" value={categoria} onChange={e => setCategoria(e.target.value)}>
                <option value="acervo">📦 Peça de Acervo / Decoração</option>
                <option value="insumo">🛠️ Insumo / Consumível (Balões, Fitas)</option>
                <option value="infraestrutura">🏢 Infraestrutura / Escritório</option>
              </select>
            </div>

            {/* Formato (só acervo) */}
            {categoria === 'acervo' && (
              <div className="nc-field">
                <label htmlFor="nc-fmt">Formato *</label>
                <select id="nc-fmt" value={formato} onChange={e => setFormato(e.target.value)}>
                  <option value="unidade">Peça Avulsa / Única</option>
                  <option value="kit">Kit / Conjunto de Peças</option>
                </select>
              </div>
            )}

            {/* Nº de peças no kit */}
            {categoria === 'acervo' && formato === 'kit' && (
              <div className="nc-field">
                <label htmlFor="nc-pkit">Nº Peças no Kit *</label>
                <input
                  id="nc-pkit"
                  type="number"
                  min="2"
                  value={quantidadePecasKit}
                  onChange={e => setQuantidadePecasKit(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* CUSTO UNITÁRIO E PREÇO DE ALUGUEL EM 2 COLUNAS */}
          <div className="nc-fields-grid nc-grid-2" style={{ marginTop: '16px' }}>
            <div className="nc-field">
              <label htmlFor="nc-custo">Custo Unitário (R$)</label>
              <div className="nc-input-prefix">
                <span>R$</span>
                <input
                  id="nc-custo"
                  type="text"
                  placeholder="0,00"
                  value={valorEstimado}
                  onChange={e => setValorEstimado(maskCurrency(e.target.value))}
                />
              </div>
            </div>

            {categoria === 'acervo' ? (
              <div className="nc-field">
                <label htmlFor="nc-aluguel">Aluguel (R$)</label>
                <div className="nc-input-prefix">
                  <span>R$</span>
                  <input
                    id="nc-aluguel"
                    type="text"
                    placeholder="0,00"
                    value={valorAluguel}
                    onChange={e => setValorAluguel(maskCurrency(e.target.value))}
                  />
                </div>
              </div>
            ) : (
              totalEstimado > 0 && (
                <div className="nc-field">
                  <label>Total Estimado</label>
                  <div className="nc-total-badge">
                    R$ {totalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )
            )}
          </div>

          {categoria === 'acervo' && totalEstimado > 0 && (
            <div className="nc-field" style={{ marginTop: '14px', maxWidth: '300px' }}>
              <label>Total Estimado</label>
              <div className="nc-total-badge">
                R$ {totalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="nc-field nc-obs-field">
            <label htmlFor="nc-obs">Observações / Especificações de Cor ou Tamanho</label>
            <textarea
              id="nc-obs"
              rows="2"
              placeholder="Ex: Comprar preferencialmente na cor Dourado Fosco, tamanho G..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="nc-divider"></div>

        {/* ===== SEÇÃO 3: FORNECEDOR & LOGÍSTICA ===== */}
        <div className="nc-section">
          <div className="nc-section-title">
            <div className="nc-section-icon nc-icon-blue">🚚</div>
            <div>
              <h2>Onde e como comprar?</h2>
              <p>Canal de compra, fornecedor, tipo de entrega e prazo estimado</p>
            </div>
          </div>

          <div className="nc-canal-toggle">
            <button
              type="button"
              className={`nc-canal-btn ${canalCompra === 'online' ? 'active-online' : ''}`}
              onClick={() => { setCanalCompra('online'); if (tipoEntrega === '1') setTipoEntrega('10'); }}
            >
              <span className="nc-canal-icon">🌐</span>
              <div>
                <strong>Compra Online</strong>
                <small>Mercado Livre, Shopee, Amazon, e-commerce...</small>
              </div>
            </button>
            <button
              type="button"
              className={`nc-canal-btn ${canalCompra === 'presencial' ? 'active-presencial' : ''}`}
              onClick={() => { setCanalCompra('presencial'); setTipoEntrega('1'); }}
            >
              <span className="nc-canal-icon">⚡</span>
              <div>
                <strong>Compra Presencial</strong>
                <small>Loja física, na cidade, atacado local...</small>
              </div>
            </button>
          </div>

          <div className="nc-fields-grid nc-grid-2 nc-grid-logistica">
            {/* Fornecedor / Loja */}
            <div className="nc-field nc-col-span-2">
              <div className="nc-label-row">
                <label htmlFor="nc-fornecedor">
                  {canalCompra === 'online' ? '🛒 Loja / E-commerce' : '🏪 Fornecedor / Loja Física'}
                  {fornecedorId && <span className="nc-badge-cadastrado">✓ Cadastrado</span>}
                </label>
                <button
                  type="button"
                  className="nc-btn-search"
                  onClick={() => setModalFornecedoresAberto(true)}
                >
                  🔍 Buscar Cadastrado {listaFornecedores.length > 0 && `(${listaFornecedores.length})`}
                </button>
              </div>
              {/* Input do fornecedor - sem atalhos rápidos aqui */}
              <input
                id="nc-fornecedor"
                type="text"
                placeholder={canalCompra === 'online' ? 'Ex: Mercado Livre, Shopee, Amazon, AliExpress...' : 'Ex: Festas e Chocolate, Armarinho Fernando, Atacadao...'}
                value={fornecedor}
                onChange={e => {
                  const val = e.target.value;
                  setFornecedor(val);
                  setFornecedorId('');
                  if (val.toLowerCase().includes('mercado livre')) { setCanalCompra('online'); setTipoEntrega('2'); }
                  else if (val.toLowerCase().includes('shopee')) { setCanalCompra('online'); setTipoEntrega('20'); }
                }}
              />
            </div>

            <div className="nc-field">
              <label htmlFor="nc-frete">
                Tipo de Frete / Entrega *
                {fornecedor.toLowerCase().includes('mercado livre') && (
                  <span className="nc-hint-ml">⚡ Opções ML</span>
                )}
              </label>
              <select id="nc-frete" value={tipoEntrega} onChange={e => setTipoEntrega(e.target.value)}>
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
              <div className="nc-field">
                <label htmlFor="nc-dias">Nº de Dias Úteis *</label>
                <input
                  id="nc-dias"
                  type="number"
                  min="1"
                  value={diasPersonalizados}
                  onChange={e => setDiasPersonalizados(e.target.value)}
                  placeholder="Ex: 15"
                />
              </div>
            )}

            <div className="nc-field">
              <label htmlFor="nc-cond">Condição de Chegada *</label>
              <select id="nc-cond" value={condicao} onChange={e => setCondicao(e.target.value)}>
                <option value="pronto">✅ Pronto para Uso (sem preparação)</option>
                <option value="preparar">🛠️ Necessita Preparação (+3 dias)</option>
              </select>
            </div>
          </div>

          {diasEntregaNum > 0 && (
            <div className="nc-prazo-preview">
              <span>📅</span>
              <span>
                Com o frete selecionado, o item chegará em aproximadamente <strong>{diasEntregaNum} dias úteis</strong>
                {condicao === 'preparar' && <span> + <strong>3 dias</strong> de preparação</span>}.
              </span>
            </div>
          )}
        </div>

        {/* ===== FOOTER DE AÇÕES ===== */}
        <div className="nc-footer-actions">
          <button type="button" className="nc-btn-cancel" onClick={() => navigate('/compras')}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`nc-btn-save ${erroPrazo && destino === 'pedido' ? 'nc-btn-blocked' : ''}`}
            disabled={salvando || (erroPrazo && destino === 'pedido')}
          >
            {salvando ? (
              <><span className="nc-spinner"></span> Salvando...</>
            ) : erroPrazo && destino === 'pedido' ? (
              '⛔ Prazo Inviável'
            ) : isEditing ? (
              '✅ Salvar Alterações'
            ) : (
              '🛒 Criar Solicitação de Compra'
            )}
          </button>
        </div>
      </form>

      {/* ===== MODAL: SELECIONAR PEDIDO ===== */}
      {modalPedidosAberto && (
        <div className="modal-overlay-premium">
          <div className="modal-box-pedido">
            <div className="modal-header-pedido">
              <div>
                <h3>Selecione o Evento</h3>
                <p>Busque o pedido do cliente na lista abaixo.</p>
              </div>
              <button className="btn-fechar-modal" onClick={() => { if (!pedidoSelecionado) setDestino('geral'); setModalPedidosAberto(false); }}>✕</button>
            </div>
            <div className="modal-search-box">
              <span className="icon">🔍</span>
              <input type="text" placeholder="Buscar por cliente, tema ou código..." value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)} autoFocus />
            </div>
            <div className="modal-lista-pedidos">
              <div className="card-pedido-select" onClick={cadastrarPedidoManual} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                <div className="cp-left">
                  <span className="cp-id">➕ NOVO</span>
                  <strong className="cp-nome" style={{ color: '#b45309' }}>Vincular a Pedido em Aberto / Digitar Cliente</strong>
                  <span className="cp-tema">Clique para digitar o nome do cliente em atendimento</span>
                </div>
                <div className="cp-right">
                  <span className="cp-status" style={{ background: '#fef08a', color: '#854d0e' }}>EM ABERTO</span>
                </div>
              </div>
              {pedidosFiltrados.length === 0 ? (
                <div className="lista-vazia">Nenhum evento encontrado. Use a opção acima para digitar o cliente.</div>
              ) : (
                pedidosFiltrados.map(pedido => (
                  <div key={pedido.id} className="card-pedido-select" onClick={() => selecionarPedido(pedido)}>
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
                      <span className={`cp-status ${(pedido.status || 'aberto').toLowerCase()}`}>{pedido.status || 'EM ABERTO'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: BUSCAR FORNECEDOR ===== */}
      {modalFornecedoresAberto && (
        <div className="modal-overlay-premium">
          <div className="modal-box-pedido">
            <div className="modal-header-pedido">
              <div>
                <h3>🔍 Buscar Fornecedor Cadastrado</h3>
                <p>Selecione um parceiro já cadastrado ou feche para digitar livremente.</p>
              </div>
              <button type="button" className="btn-fechar-modal" onClick={() => setModalFornecedoresAberto(false)}>✕</button>
            </div>
            <div className="modal-search-box">
              <span className="icon">🔍</span>
              <input type="text" placeholder="Buscar por nome, telefone ou categoria..." value={buscaFornecedor} onChange={e => setBuscaFornecedor(e.target.value)} autoFocus />
            </div>
            {/* Atalhos rápidos dentro do modal */}
            <div className="modal-atalhos">
              <span className="modal-atalhos-label">⚡ Atalhos rápidos:</span>
              <div className="modal-atalhos-chips">
                {[
                  { label: '🛒 Mercado Livre', canal: 'online', frete: '2', nome: 'Mercado Livre' },
                  { label: '🛍️ Shopee', canal: 'online', frete: '20', nome: 'Shopee' },
                  { label: '🏪 Festas e Chocolate', canal: 'presencial', frete: '1', nome: 'Festas e Chocolate' },
                  { label: '📦 Armarinho Fernando', canal: 'presencial', frete: '1', nome: 'Armarinho Fernando' },
                ].map(at => (
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
              <div className="card-pedido-select" onClick={() => { setFornecedorId(''); setModalFornecedoresAberto(false); }} style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                <div className="cp-left">
                  <span className="cp-id">✏️ LIVRE</span>
                  <strong className="cp-nome">Digitar Fornecedor Livre / Loja da Internet</strong>
                  <span className="cp-tema">Fechar e digitar qualquer loja (Mercado Livre, Shopee, etc.)</span>
                </div>
              </div>
              {fornecedoresFiltradosModal.length === 0 ? (
                <div className="lista-vazia">Nenhum fornecedor cadastrado encontrado.</div>
              ) : (
                fornecedoresFiltradosModal.map(f => (
                  <div
                    key={f.id}
                    className="card-pedido-select"
                    onClick={() => { setFornecedor(f.nome || ''); setFornecedorId(f.id); setFornecedorTelefone(f.contato || f.telefone || f.whatsapp || ''); setModalFornecedoresAberto(false); }}
                    style={{ borderLeft: '4px solid #c5a059' }}
                  >
                    <div className="cp-left">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#0f172a' }}>🏭 {f.nome}</strong>
                        {f.categoria && <span style={{ background: '#fef3c7', color: '#b48a3c', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>{f.categoria}</span>}
                      </div>
                      {f.contato && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📞 {f.contato}</span>}
                      {f.endereco && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>📍 {f.endereco}</span>}
                    </div>
                    <div className="cp-right">
                      <span style={{ background: '#c5a059', color: '#fff', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>Selecionar ✓</span>
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
