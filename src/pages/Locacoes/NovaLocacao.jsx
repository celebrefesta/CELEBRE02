import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './NovaLocacao.css';
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, doc, getDoc, addDoc, getCountFromServer, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import { CATALOGO_TEMAS } from '../../catalogoDeTemas';
import { gerarPropostaPDF } from '../../utils/gerarPropostaPDF';
import { calcularDistanciaGoogleMaps } from '../../utils/googleMapsService';
import ModalCalendarioDisponibilidade from './ModalCalendarioDisponibilidade';

// 🏷️ TIPOS DE EVENTO (mesmos da tela de Locações)
const TIPOS_EVENTO = [
  { value: 'aniversario',      label: 'Aniversário',      emoji: '🎂' },
  { value: 'casamento',        label: 'Casamento',        emoji: '💍' },
  { value: 'formatura',        label: 'Formatura',        emoji: '🎓' },
  { value: 'corporativo',      label: 'Corporativo',      emoji: '💼' },
  { value: 'cha_bebe',         label: 'Chá de Bebê',      emoji: '👶' },
  { value: 'debutante',        label: 'Debutante',        emoji: '👑' },
  { value: 'batizado',         label: 'Batizado',         emoji: '⛪' },
  { value: 'confraternizacao', label: 'Confraternização', emoji: '🥂' },
  { value: 'outro',            label: 'Outro',            emoji: '🎉' },
];

// 👑 SISTEMA CELEBRE - NOVA LOCAÇÃO (ENTERPRISE EDITION)
const NovaLocacao = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🔥 IDENTIFICAÇÃO CORPORATIVA (A chave para puxar e salvar dados no cofre da empresa)
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);

  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [todasLocacoes, setTodasLocacoes] = useState([]);
  const [carrinho, setCarrinho] = useState([]);

  // 🚨 ESTADOS DA TRAVA DE SEGURANÇA CONTRA INADIMPLÊNCIA / PENDÊNCIAS
  const [modalTravaCliente, setModalTravaCliente] = useState(null); // { cliente, pendencias, valorDevido }
  const [autorizacaoExcepcional, setAutorizacaoExcepcional] = useState(false);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [modalCalendarioAberto, setModalCalendarioAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'decoracao' | 'avulso'
  const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
  const [ordemClassificacao, setOrdemClassificacao] = useState('relevancia');

  const handleGerarPropostaPDF = () => {
    const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado)) || {};
    const temaFinal = temaFesta === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : temaFesta;

    const objPedidoAtual = {
      numeroPedido: 'RASCUNHO',
      status: 'orcamento',
      clienteNome: clienteEncontrado.nome || clienteEncontrado.nomeFantasia || 'Cliente',
      clienteCelular: clienteEncontrado.celular || clienteEncontrado.telefone || '',
      temaFesta: temaFinal,
      tipoServico,
      dataRetirada: datas.retirada,
      dataDevolucao: datas.devolucao,
      logistica,
      itens: carrinho,
      desconto: calcularTotal().valorDesconto,
      valorTotal: calcularTotal().total,
      valorPago: Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0
    };

    gerarPropostaPDF(objPedidoAtual, configEmpresa, clienteEncontrado, 'preview');
  };
  
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [tipoServico, setTipoServico] = useState('PEGUE E MONTE');
  const [datas, setDatas] = useState({ 
    retirada: '', 
    horarioRetirada: '09:00', 
    devolucao: '', 
    horarioDevolucao: '18:00',
    horarioFesta: '19:00' 
  });

  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const [formNovoCliente, setFormNovoCliente] = useState({ nome: '', celular: '', cpfCnpj: '', email: '' });
  const [salvandoNovoCliente, setSalvandoNovoCliente] = useState(false);

  const [formaPagtoRestante, setFormaPagtoRestante] = useState('Pix na Devolução');
  const [exigirCaucao, setExigirCaucao] = useState(false);
  const [valorCaucao, setValorCaucao] = useState('');

  const handleSalvarNovoClienteRapido = async (e) => {
    e.preventDefault();
    if (!formNovoCliente.nome.trim() || !formNovoCliente.celular.trim()) {
      alert("⚠️ Preencha pelo menos o Nome e Celular/WhatsApp do cliente.");
      return;
    }
    try {
      setSalvandoNovoCliente(true);
      const novoCliData = {
        userId: tenantId,
        tenantId: tenantId,
        nome: formNovoCliente.nome.trim(),
        celular: formNovoCliente.celular.trim(),
        cpfCnpj: formNovoCliente.cpfCnpj.trim(),
        email: formNovoCliente.email.trim(),
        criadoEm: serverTimestamp(),
        dataCadastro: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "clientes"), novoCliData);
      const novoClienteObj = { id: docRef.id, ...novoCliData };
      setClientes(prev => [novoClienteObj, ...prev]);
      setClienteSelecionado(docRef.id);
      setModalNovoClienteAberto(false);
      setFormNovoCliente({ nome: '', celular: '', cpfCnpj: '', email: '' });
      alert(`✅ Cliente "${formNovoCliente.nome}" cadastrado e selecionado com sucesso!`);
    } catch (err) {
      console.error("Erro ao cadastrar cliente rápido:", err);
      alert("❌ Erro ao cadastrar cliente: " + err.message);
    } finally {
      setSalvandoNovoCliente(false);
    }
  };

  const calcularValorReposicao = () => {
    return carrinho.reduce((acc, item) => {
      const valReposicao = Number(item.valorReposicao || item.custoManutencao || item.financeiro?.valorReposicao || (Number(item.preco || 0) * 3));
      return acc + (valReposicao * (Number(item.qtd) || 1));
    }, 0);
  };
  
  const [categoriaTema, setCategoriaTema] = useState('');
  const [subcategoriaTema, setSubcategoriaTema] = useState('');
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');
  const [temaFesta, setTemaFesta] = useState('');
  const [temaDigitadoPersonalizado, setTemaDigitadoPersonalizado] = useState('');
  const [modoBuscaRapidaTema, setModoBuscaRapidaTema] = useState(false);
  const [buscaClienteTexto, setBuscaClienteTexto] = useState('');
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);
  const seletorClienteRef = useRef(null);

  // 🛡️ Fecha a gaveta de busca de clientes ao clicar fora ou apertar Esc
  useEffect(() => {
    const handleClickFora = (e) => {
      if (seletorClienteRef.current && !seletorClienteRef.current.contains(e.target)) {
        setMostrarDropdownCliente(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMostrarDropdownCliente(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    document.addEventListener('touchstart', handleClickFora);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      document.removeEventListener('touchstart', handleClickFora);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  const [logistica, setLogistica] = useState({ 
    tipo: 'retirada', 
    statusLocal: 'definido', // 'definido' | 'a_definir' | 'estimado'
    cep: '', 
    rua: '', 
    numero: '', 
    bairro: '', 
    cidade: '', 
    frete: '', 
    referencia: '', 
    obsTransporte: '' 
  });
  
  const [desconto, setDesconto] = useState(0);
  const [tipoDesconto, setTipoDesconto] = useState('R$'); // 'R$' ou '%'
  const [obsInternas, setObsInternas] = useState('');
  const [kmDistancia, setKmDistancia] = useState('');
  const [taxaPorKm, setTaxaPorKm] = useState('3.50');

  // 🚚 Parâmetros avançados de frete baseados em veículo e combustível
  const [paramFrete, setParamFrete] = useState({
    tipoCombustivel: 'gasolina', // 'gasolina', 'alcool', 'gasolina_aditivada', 'diesel', 'gnv'
    precoGasolina: '5.90',
    veiculo: '1.0',
    consumoKmL: '12.0',
    viagens: '4',
    custoAdicionalKm: '1.50',
    taxaMinima: '0'
  });
  const [mostrarAjusteFrete, setMostrarAjusteFrete] = useState(false);
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [infoRota, setInfoRota] = useState(null);

  const [modalCompraAberto, setModalCompraAberto] = useState(false);
  const [formCompra, setFormCompra] = useState({ 
      nome: "", 
      quantidade: 1, 
      valorEstimado: "", 
      valorAluguel: "", 
      categoria: "material", 
      prazo: "", 
      fornecedor: "", 
      obs: "" 
  });
  
  const [sugestoesCompra, setSugestoesCompra] = useState([]);
  const [pecasSimilaresPlanoB, setPecasSimilaresPlanoB] = useState([]);
  const [previewPlanoB, setPreviewPlanoB] = useState(null); 

  const [salvandoCompra, setSalvandoCompra] = useState(false);
  const [acaoSalvar, setAcaoSalvar] = useState('fechar');

  const [modalSinalAberto, setModalSinalAberto] = useState(false);
  const [valorSinal, setValorSinal] = useState('');
  const [formaPagtoSinal, setFormaPagtoSinal] = useState('Pix');
  const [linkMercadoPago, setLinkMercadoPago] = useState('');
  const [gerandoLinkMP, setGerandoLinkMP] = useState(false);
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [statusParaSalvar, setStatusParaSalvar] = useState('');
  const [tipoEvento, setTipoEvento] = useState('');  // 🏷️ Tipo de Evento (Aniversário, Casamento, etc.)

  const badgeEsgotado = { position: 'absolute', top: 5, left: 5, background: '#ef4444', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' };
  const badgeBateVolta = { position: 'absolute', top: 5, left: 5, background: '#f59e0b', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' };
  const badgeLivres = { position: 'absolute', top: 5, left: 5, background: '#10b981', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' };

  // 🔥 AUDITORIA (BLINDADA PARA A EMPRESA)
  const registrarLog = async (acao, detalhes, pedidoIdGerado, numeroPedidoGerado) => {
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
        pedidoId: pedidoIdGerado || "S/N",
        numeroPedido: numeroPedidoGerado || "S/N",
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria:", error);
    }
  };

  // 🚨 Helper para identificar pendências de um cliente
  const getPendenciasCliente = (cId, clientesList = clientes, locacoesList = todasLocacoes) => {
    if (!cId) return { temPendencia: false, valorDevido: 0, qtdPendencias: 0, pendencias: [], clienteObj: null };
    const clienteObj = clientesList.find(c => c.id === cId || String(c.id) === String(cId));
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const pendencias = locacoesList.filter(loc => {
      if (loc.clienteId !== cId && loc.cliente?.id !== cId) return false;
      const status = (loc.status || '').toLowerCase().trim();
      if (status === 'cancelado' || status === 'orcamento' || status === 'orçamento') return false;
      
      const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
      if (!dataStr) return false;
      const dataEvento = new Date(dataStr + 'T00:00:00');
      const pagStatus = (loc.statusPagamento || '').toLowerCase();
      const vTotal = Number(loc.valorTotal || loc.total || 0);
      const vPago = Number(loc.valorPago || 0);
      return dataEvento < hoje && (vTotal - vPago) > 0.01 && pagStatus !== 'pago' && pagStatus !== 'quitado';
    });

    const valorDevido = pendencias.reduce((acc, loc) => {
      const vTotal = Number(loc.valorTotal || loc.total || 0);
      const vPago = Number(loc.valorPago || 0);
      return acc + Math.max(0, vTotal - vPago);
    }, 0);

    const isInadimplenteCadastral = clienteObj?.situacaoFinanceira === 'inadimplente';
    const temPendencia = isInadimplenteCadastral || pendencias.length > 0;

    return { temPendencia, valorDevido, qtdPendencias: pendencias.length, pendencias, clienteObj };
  };

  // ➕ Incorpora a pendência financeira do cliente diretamente no pedido atual
  const handleAutorizarESomarDebito = () => {
    if (!modalTravaCliente) return;
    const { valorDevido, pendencias } = modalTravaCliente;
    
    const numPedsStr = pendencias?.map(p => p.numeroPedido ? `#${p.numeroPedido}` : `#${p.id.slice(0,6).toUpperCase()}`).join(', ') || 'Anterior';
    const itemDebito = {
      id: `debito_anterior_${Date.now()}`,
      nome: `💳 Regularização: Saldo Devedor Anterior (${numPedsStr})`,
      preco: Number(valorDevido || 0),
      qtd: 1,
      quantidade: 1,
      categoria: 'Regularização Financeira',
      isDebitoAnterior: true,
      pendenciasVinculadas: pendencias,
      foto: ''
    };

    setCarrinho(prev => [...prev.filter(i => !i.isDebitoAnterior), itemDebito]);

    setObsInternas(prev => {
      const nota = `[REGULARIZAÇÃO FINANCEIRA]: Incluído valor de R$ ${Number(valorDevido).toFixed(2)} referente ao saldo devedor de locações anteriores (${numPedsStr}) para quitação unificada nesta locação.`;
      return prev ? `${prev}\n${nota}` : nota;
    });

    setAutorizacaoExcepcional(true);
    setModalTravaCliente(null);
  };

  const handleAutorizarSemSomar = () => {
    setAutorizacaoExcepcional(true);
    setModalTravaCliente(null);
  };

  const [configEmpresa, setConfigEmpresa] = useState(null);

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarDados = async () => {
      try {
        // 🎯 BUSCA VINCULADA À EMPRESA (TENANT)
        const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const docConfigRef = doc(db, "configuracoes_empresa", tenantId);

        const [snapCli, snapEst, snapLoc, snapConf] = await Promise.all([
          getDocs(qClientes),
          getDocs(qEstoque),
          getDocs(qLocacoes),
          getDoc(docConfigRef)
        ]);
        
        const clis = snapCli.docs.map(d => ({ id: d.id, ...d.data() }));
        const ests = snapEst.docs.map(d => ({ id: d.id, ...d.data() }));
        const locs = snapLoc.docs.map(d => ({ id: d.id, ...d.data() }));

        setClientes(clis);
        setEstoque(ests);
        setTodasLocacoes(locs);
        if (snapConf.exists()) {
          const conf = snapConf.data();
          setConfigEmpresa(conf);
          setParamFrete({
            precoGasolina: conf.precoGasolina !== undefined ? String(conf.precoGasolina) : '5.90',
            veiculo: conf.veiculoPadrao || '1.0',
            consumoKmL: conf.consumoKmL !== undefined ? String(conf.consumoKmL) : '12.0',
            viagens: conf.tipoViagemPadrao !== undefined ? String(conf.tipoViagemPadrao) : '4',
            custoAdicionalKm: conf.custoAdicionalKm !== undefined ? String(conf.custoAdicionalKm) : '1.50',
            taxaMinima: conf.taxaMinimaFrete !== undefined ? String(conf.taxaMinimaFrete) : '25.00'
          });
        }

        // Se veio clienteSelecionado pelo state da navegação:
        if (location.state?.clienteSelecionado) {
          const cliPassado = location.state.clienteSelecionado;
          const cId = cliPassado.id;
          setClienteSelecionado(cId);

          if (location.state.autorizacaoPendente) {
            setAutorizacaoExcepcional(true);
          } else {
            const infoPend = getPendenciasCliente(cId, clis, locs);
            if (infoPend.temPendencia) {
              setModalTravaCliente({
                cliente: infoPend.clienteObj || cliPassado,
                pendencias: infoPend.pendencias,
                valorDevido: infoPend.valorDevido
              });
            }
          }
        }

        // 🎨 Se veio itensMoodboard do Decorador Virtual:
        if (location.state?.itensMoodboard && Array.isArray(location.state.itensMoodboard)) {
          const itensMapeados = [];
          location.state.itensMoodboard.forEach(mItem => {
            const itemEstoque = ests.find(e => e.id === mItem.id || e.id === mItem.pecaId);
            const baseItem = itemEstoque || mItem;
            const precoItem = Number(baseItem.financeiro?.valorAluguel || baseItem.preco || baseItem.valorLocacao || baseItem.valor || 0);
            const isDeco = baseItem.especificacoes?.isDecoracao || baseItem.categoria === 'Decoração Completa' || baseItem.tipoCadastro === 'decoracao';
            const pecasCompostas = baseItem.especificacoes?.itensDecoracao || baseItem.especificacoes?.itensDoKit || baseItem.itensDecoracao || baseItem.itensDoKit || [];
            
            itensMapeados.push({
              ...baseItem,
              id: baseItem.id || `mood_${Date.now()}_${Math.random()}`,
              nome: baseItem.nome || 'Peça do Acervo',
              isDecoracao: isDeco,
              itensDecoracao: pecasCompostas,
              itensDoKit: pecasCompostas,
              qtd: mItem.quantidade || 1,
              preco: precoItem,
              foto: baseItem.foto || baseItem.imagem || (baseItem.fotos?.[0]) || '',
              qtdOriginal: Number(baseItem.quantidade) || 1,
              checkedSeparacao: false,
              checkedDevolucao: false,
              avaria: false,
              faltou: false
            });
          });
          if (itensMapeados.length > 0) {
            setCarrinho(itensMapeados);
          }
          if (location.state?.nomeProjeto) {
            setTemaDigitadoPersonalizado(location.state.nomeProjeto);
            setTemaFesta('OUTRO_TEMA');
          }
        }
      } catch (error) {
        console.error("Erro ao carregar:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [usuarioLogado, navigate, tenantId, location.state]);

  const categoriasUnicasEstoque = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];
  const catalogoFonte = (configEmpresa?.catalogoVitrine && Object.keys(configEmpresa.catalogoVitrine).length > 0)
    ? configEmpresa.catalogoVitrine
    : CATALOGO_TEMAS;

  const categoriasDeTemaUnicas = Object.keys(catalogoFonte);
  const subcategoriasDisponiveis = categoriaTema ? Object.keys(catalogoFonte[categoriaTema] || {}) : [];
  const gruposDisponiveis = (categoriaTema && subcategoriaTema) ? Object.keys(catalogoFonte[categoriaTema][subcategoriaTema] || {}) : [];
  const temasDisponiveis = (categoriaTema && subcategoriaTema && grupoTemaSelecionado) ? (catalogoFonte[categoriaTema][subcategoriaTema][grupoTemaSelecionado] || []) : [];

  // 🔍 Índice Geral de Temas para Busca Instantânea Inteligente
  const todosTemasIndexados = React.useMemo(() => {
    const lista = [];
    Object.keys(catalogoFonte).forEach(cat => {
      const subs = catalogoFonte[cat] || {};
      Object.keys(subs).forEach(sub => {
        const grupos = subs[sub] || {};
        Object.keys(grupos).forEach(grupo => {
          const temas = grupos[grupo] || [];
          temas.forEach(t => {
            lista.push({
              categoria: cat,
              subcategoria: sub,
              grupo: grupo,
              tema: t,
              caminhoCompleto: `${cat} › ${sub} › ${grupo} › ${t}`
            });
          });
        });
      });
    });
    return lista;
  }, [catalogoFonte]);

  // 🔍 Busca Instantânea de Clientes (Nome, Telefone, Documento)
  const clientesFiltrados = React.useMemo(() => {
    if (!buscaClienteTexto || !buscaClienteTexto.trim()) return clientes.slice(0, 20);
    const termo = buscaClienteTexto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return clientes.filter(c => {
      const nome = (c.nome || c.nomeFantasia || c.razaoSocial || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const tel = (c.celular || c.telefone || '').replace(/\D/g, '');
      const doc = (c.cpf || c.cnpj || '').replace(/\D/g, '');
      return nome.includes(termo) || tel.includes(termo) || doc.includes(termo);
    }).slice(0, 20);
  }, [clientes, buscaClienteTexto]);

  const handleSelecionarCliente = (cId) => {
    setClienteSelecionado(cId);
    setAutorizacaoExcepcional(false);
    setMostrarDropdownCliente(false);
    setBuscaClienteTexto('');
    if (cId) {
      const infoPend = getPendenciasCliente(cId);
      if (infoPend.temPendencia) {
        setModalTravaCliente({
          cliente: infoPend.clienteObj,
          pendencias: infoPend.pendencias,
          valorDevido: infoPend.valorDevido
        });
      }

      // Preenche endereço do cliente na logística se houver
      const cli = clientes.find(c => String(c.id) === String(cId));
      if (cli && (cli.rua || cli.endereco || cli.cep || cli.cidade)) {
        const endCli = {
          cep: cli.cep || '',
          rua: cli.rua || cli.endereco || '',
          numero: cli.numero || '',
          bairro: cli.bairro || '',
          cidade: cli.cidade ? `${cli.cidade}${cli.uf ? ` - ${cli.uf}` : ''}` : ''
        };
        setLogistica(prev => ({
          ...prev,
          cep: prev.cep || endCli.cep,
          rua: prev.rua || endCli.rua,
          numero: prev.numero || endCli.numero,
          bairro: prev.bairro || endCli.bairro,
          cidade: prev.cidade || endCli.cidade
        }));

        if (endCli.rua || endCli.cep) {
          calcularDistanciaAutomatica(endCli);
        }
      }
    }
  };

  const isOverlapping = (start1, end1, start2, end2) => {
      if (!start1 || !end1 || !start2 || !end2) return false;
      const s1 = new Date(start1 + 'T00:00:00').getTime();
      const e1 = new Date(end1 + 'T00:00:00').getTime();
      const s2 = new Date(start2 + 'T00:00:00').getTime();
      const e2 = new Date(end2 + 'T00:00:00').getTime();
      return s1 <= e2 && e1 >= s2;
  };

  const getDisponibilidade = (pecaId) => {
      const peca = estoque.find(e => e.id === pecaId);
      if (!peca) return { livresReais: 0, livresMaximos: 0, retornaNoDia: 0 };
      
      const isDeco = peca.especificacoes?.isDecoracao || peca.categoria === 'Decoração Completa';
      const qtdFisica = isDeco ? 1 : (parseInt(peca.quantidade) || parseInt(peca.estoque) || parseInt(peca.qtd) || parseInt(peca.quantidadeTotal) || parseInt(peca.unidades) || parseInt(peca.quantidadeEstoque) || 1);
      const qtdManutencao = parseInt(peca.manutencao || 0) || parseInt(peca.emManutencao || 0) || parseInt(peca.qtdManutencao || 0) || parseInt(peca.avariadas || 0) || parseInt(peca.defeito || 0) || parseInt(peca.quebradas || 0) || 0;
      
      let disponiveisTotais = Math.max(0, qtdFisica - qtdManutencao);
      let qtdReservadaForte = 0;
      let qtdRetornaNoDia = 0;

      if (datas.retirada && datas.devolucao) {
          todasLocacoes.forEach(loc => {
              if (loc.arquivado || loc.archived) return;

              const status = (loc.status || '').toLowerCase().trim();
              if (['cancelado', 'arquivado', 'finalizado', 'orcamento', 'orçamento'].includes(status)) return;

              if (['confirmado', 'preparacao', 'entregue', 'aprovado', 'em andamento'].includes(status)) {
                  if (isOverlapping(datas.retirada, datas.devolucao, loc.dataRetirada, loc.dataDevolucao)) {
                      const itensPedido = loc.itens || loc.carrinho || [];
                      itensPedido.forEach(i => {
                          const iQtd = parseInt(i.qtd) || parseInt(i.quantidade) || 1;
                          
                          // A) É a própria peça alugada diretamente
                          const eMesmaPeca = (
                            (i.id && String(i.id) === String(pecaId)) || 
                            (i.codigo && peca.codigo && i.codigo === peca.codigo) ||
                            (i.nome && peca.nome && i.nome.trim().toLowerCase() === peca.nome.trim().toLowerCase())
                          );

                          if (eMesmaPeca) {
                              if (loc.dataDevolucao === datas.retirada) {
                                  qtdRetornaNoDia += iQtd;
                              } else {
                                  qtdReservadaForte += iQtd;
                              }
                          }

                          // B) É uma Decoração/Kit que contém esta peça em sua composição
                          const pecasCompostas = i.itensDecoracao || i.itensDoKit || i.pecasKit || i.especificacoes?.itensDecoracao || i.especificacoes?.itensDoKit || i.especificacoes?.pecasKit || [];
                          pecasCompostas.forEach(p => {
                              const eItemDoKit = (
                                (p.id && String(p.id) === String(pecaId)) ||
                                (p.codigo && peca.codigo && p.codigo === peca.codigo) ||
                                (p.nome && peca.nome && p.nome.trim().toLowerCase() === peca.nome.trim().toLowerCase())
                              );

                              if (eItemDoKit) {
                                  const pQtdUnitaria = parseInt(p.qtd) || parseInt(p.quantidade) || 1;
                                  const pQtdTotal = pQtdUnitaria * iQtd;
                                  if (loc.dataDevolucao === datas.retirada) {
                                      qtdRetornaNoDia += pQtdTotal;
                                  } else {
                                      qtdReservadaForte += pQtdTotal;
                                  }
                              }
                          });
                      });
                  }
              }
          });
      }
      
      const livresReais = Math.max(0, disponiveisTotais - qtdReservadaForte - qtdRetornaNoDia);
      const livresMaximos = Math.max(0, disponiveisTotais - qtdReservadaForte);
      return { livresReais, livresMaximos, retornaNoDia: qtdRetornaNoDia, emManutencao: qtdManutencao >= qtdFisica };
  };

  const abrirCatalogo = () => {
      if (!datas.retirada || !datas.devolucao) {
          alert("📅 ATENÇÃO: Por favor, preencha as DATAS DE RETIRADA e DEVOLUÇÃO no topo da tela primeiro!");
          return;
      }
      setModalAberto(true);
  };

  const buscarSimilaresNoEstoque = (itemFaltante) => {
    if (!itemFaltante || !itemFaltante.nome) return [];
    
    const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
    const palavrasAlvo = normalize(itemFaltante.nome).split(' ').filter(p => p.length > 2 && !['com', 'para', 'das', 'dos', 'kit', 'par', 'festa', 'tema', 'locacao'].includes(p));
    
    if (palavrasAlvo.length === 0) return [];
    
    const palavraPrincipal = palavrasAlvo[0]; 
    const temaAtual = normalize(temaFesta);
    
    let similares = estoque.map(peca => {
        const disp = getDisponibilidade(peca.id);
        if (peca.id === itemFaltante.id || disp.livresMaximos <= 0) return { ...peca, score: -1 };
        
        let score = 0;
        const nomePecaNorm = normalize(peca.nome);
        const palavrasPeca = nomePecaNorm.split(' ');
        
        if (palavrasPeca.includes(palavraPrincipal)) score += 10;
        if (temaAtual && temaAtual.length > 2 && nomePecaNorm.includes(temaAtual)) score += 15; 
        
        palavrasAlvo.forEach(palavra => {
            if (nomePecaNorm.includes(palavra) && palavra !== palavraPrincipal) score += 5;
        });
        
        return { ...peca, score, qtdLivre: disp.livresMaximos };
    });

    similares = similares.filter(p => p.score >= 10);
    similares.sort((a, b) => b.score - a.score);
    return similares.slice(0, 4);
  };

  const dispararCompraAutomatica = (item) => {
    let valorAlg = item.financeiro?.valorAluguel || "0,00";
    if (typeof valorAlg === 'number') {
        valorAlg = valorAlg.toFixed(2).replace(".", ",");
    } else if (!valorAlg && item.preco) {
        valorAlg = Number(item.preco).toFixed(2).replace(".", ",");
    }
    
    setFormCompra({
        nome: item.nome, 
        quantidade: 1, 
        valorEstimado: "", 
        valorAluguel: valorAlg, 
        categoria: item.categoria || "acervo", 
        prazo: datas.retirada || "", 
        fornecedor: "", 
        obs: "Falta de estoque para esta data."
    });
    
    setPreviewPlanoB(null);
    const planoB = buscarSimilaresNoEstoque(item);
    setPecasSimilaresPlanoB(planoB);
    setModalCompraAberto(true);
  };

  const aceitarSugestaoPlanoB = (pecaSubstituta) => {
      addCarrinho(pecaSubstituta, true);
      setModalCompraAberto(false);
      setPreviewPlanoB(null);
      alert(`✅ Excelente! A peça "${pecaSubstituta.nome}" foi adicionada ao pedido!`);
  };

  const addCarrinho = (item, isSubstituicao = false) => {
    const disp = getDisponibilidade(item.id);
    const precoItem = Number(item.financeiro?.valorAluguel || item.preco || 0);
    const qtdFisicaTotal = Number(item.quantidade) || 1;
    const isDeco = item.especificacoes?.isDecoracao || item.categoria === 'Decoração Completa' || item.tipoCadastro === 'decoracao';
    const pecasCompostas = item.especificacoes?.itensDecoracao || item.especificacoes?.itensDoKit || item.itensDecoracao || item.itensDoKit || item.especificacoes?.pecasKit || [];
    const existe = carrinho.find(i => i.id === item.id);
    
    if (existe) {
      if (isSubstituicao) {
          setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
          return;
      }
      
      if (existe.qtd >= disp.livresMaximos && !existe.isPendenteCompra) {
          alert(`⚠️ ESTOQUE MÁXIMO ATINGIDO!\nVocê possui o limite absoluto de ${disp.livresMaximos} unidade(s) de "${item.nome}" para esta data.\n\nVamos buscar um Plano B!`);
          dispararCompraAutomatica(item);
          return;
      }
      
      if (existe.qtd >= disp.livresReais && disp.retornaNoDia > 0 && !existe.jaAvisouBateVolta) {
          const querMesmo = window.confirm(`⚠️ ATENÇÃO: CONFLITO DE AGENDA (Bate e Volta)!\n\nA peça será DEVOLVIDA por outro cliente exatamente na data deste novo evento.\n\nDeseja adicionar a peça mesmo assim?`);
          if (!querMesmo) return;
      }
      
      setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1, jaAvisouBateVolta: disp.retornaNoDia > 0 ? true : i.jaAvisouBateVolta } : i));
    
    } else {
      if (disp.livresMaximos < 1 && !isSubstituicao) {
          alert(`⚠️ PEÇA INDISPONÍVEL!\nEsta peça está em manutenção ou o limite máximo já foi atingido para esta data.\n\nVamos ver alternativas no acervo!`);
          dispararCompraAutomatica(item);
          return;
      }
      
      if (disp.livresReais < 1 && disp.retornaNoDia > 0) {
          const querMesmo = window.confirm(`⚠️ ATENÇÃO: CONFLITO DE AGENDA (Bate e Volta)!\n\nA peça será DEVOLVIDA por outro cliente exatamente na data deste novo evento.\n\nDeseja adicionar a peça mesmo assim?`);
          if (!querMesmo) return;
      }
      
      setCarrinho([...carrinho, { 
          ...item, 
          isDecoracao: isDeco,
          itensDecoracao: pecasCompostas,
          itensDoKit: pecasCompostas,
          qtd: 1, 
          preco: precoItem, 
          foto: item.foto || item.fotos?.[0] || '', 
          isBateVolta: disp.retornaNoDia > 0, 
          jaAvisouBateVolta: disp.retornaNoDia > 0, 
          qtdOriginal: qtdFisicaTotal, 
          checkedSeparacao: false, 
          checkedDevolucao: false, 
          avaria: false, 
          faltou: false 
      }]);
    }
  };

  const handleChangeQtdCarrinho = (itemId, novaQtd) => {
      const itemCarrinho = carrinho.find(i => i.id === itemId);
      if (!itemCarrinho) return;
      
      let qtdDesejada = parseInt(novaQtd);
      if (isNaN(qtdDesejada)) qtdDesejada = '';
      
      if (itemCarrinho.isPendenteCompra) {
           setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: qtdDesejada} : i));
           return;
      }
      
      if (typeof qtdDesejada === 'number' && qtdDesejada > 0) {
          const disp = getDisponibilidade(itemId);
          
          if (qtdDesejada > disp.livresMaximos) {
              alert(`⚠️ LIMITE ABSOLUTO ATINGIDO!\nO limite para "${itemCarrinho.nome}" nesta data é: ${disp.livresMaximos} unidade(s).`);
              setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: disp.livresMaximos} : i));
          } else {
              setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: qtdDesejada} : i));
          }
      } else {
           setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: qtdDesejada} : i));
      }
  };

  const getFreteNumerico = () => {
    if (!logistica.frete) return 0;
    if (typeof logistica.frete === 'number') return logistica.frete;
    const str = String(logistica.frete).trim();
    if (str.includes(',')) {
      const limpo = str.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(limpo);
      return isNaN(n) ? 0 : n;
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  };

  const calcularFreteEstimado = (distanciaKm) => {
    const km = Number(String(distanciaKm).replace(',', '.')) || 0;
    if (km <= 0) return { freteTotal: 0, custoGasolina: 0, custoDesgaste: 0, taxaEfetivaKm: '0.00', viagens: 4, consumo: 12, precoGas: 5.9, custoOp: 1.5 };

    const precoGas = Number(String(paramFrete.precoGasolina || 5.90).replace(',', '.')) || 5.90;
    const consumo = Number(String(paramFrete.consumoKmL || 12.0).replace(',', '.')) || 12.0;
    const viagens = Number(paramFrete.viagens) || 4;
    const custoOp = Number(String(paramFrete.custoAdicionalKm || 0).replace(',', '.')) || 0;
    const taxaMin = Number(String(paramFrete.taxaMinima || 0).replace(',', '.')) || 0;

    const custoGasolina = ((km * viagens) / consumo) * precoGas;
    const custoDesgaste = km * custoOp;
    const somaReal = custoGasolina + custoDesgaste;
    const freteTotal = Math.max(taxaMin, somaReal);
    const taxaEfetivaKm = km > 0 ? (somaReal / km).toFixed(2) : '0.00';

    return { 
      freteTotal: Math.round(freteTotal * 100) / 100, 
      somaReal: Math.round(somaReal * 100) / 100,
      custoGasolina: Math.round(custoGasolina * 100) / 100, 
      custoDesgaste: Math.round(custoDesgaste * 100) / 100, 
      taxaEfetivaKm, 
      viagens, 
      consumo, 
      precoGas, 
      custoOp 
    };
  };

  const getValorDescontoCalculado = (subtotal) => {
    const descNum = Number(desconto) || 0;
    if (tipoDesconto === '%') {
      return (subtotal * descNum) / 100;
    }
    return descNum;
  };

  const calcularTotal = () => {
    const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * (Number(item.qtd) || 1)), 0);
    const valorDesconto = getValorDescontoCalculado(subtotal);
    const total = subtotal + getFreteNumerico() - valorDesconto;
    return { subtotal, valorDesconto, total: Math.max(0, total) };
  };

  const calcularDistanciaAutomatica = async (destinoCustom = null, isManual = false) => {
    const dest = destinoCustom || logistica;
    const ruaDest = (dest.rua || '').trim();
    let cidadeDest = (dest.cidade || '').trim();
    let ufDest = '';
    if (cidadeDest.includes('-')) {
      const parts = cidadeDest.split('-');
      cidadeDest = parts[0].trim();
      ufDest = (parts[1] || '').trim().toUpperCase();
    } else if (cidadeDest.includes('/')) {
      const parts = cidadeDest.split('/');
      cidadeDest = parts[0].trim();
      ufDest = (parts[1] || '').trim().toUpperCase();
    }

    const cepDest = (dest.cep || '').replace(/\D/g, '');
    const numDest = (dest.numero || '').trim();

    const conf = configEmpresa || {};
    let cidadeOrigem = (conf.cidade || '').trim();
    let ufOrigem = (conf.uf || '').trim().toUpperCase();
    if (cidadeOrigem.includes('-')) {
      const p = cidadeOrigem.split('-');
      cidadeOrigem = p[0].trim();
      if (!ufOrigem && p[1]) ufOrigem = p[1].trim().toUpperCase();
    }
    const ruaOrigem = (conf.rua || conf.endereco || '').trim();
    const cepOrigem = (conf.cep || '').replace(/\D/g, '');

    const temOrigemValida = Boolean(cidadeOrigem || (cepOrigem.length === 8) || ruaOrigem);

    // Montar endereços para Google Maps Directions de forma limpa e precisa:
    // Formato: Rua, Número, Cidade - UF, Brasil (sem enfiar bairro ou CEP no meio que causam conflitos no Maps)
    const buildMapsAddress = (rua, num, bairro, cidade, uf, cep) => {
      const ruaLimpa = (rua || '').trim();
      const numLimpo = (num || '').trim();
      const cidLimpa = (cidade || '').trim();
      const ufLimpa = (uf || 'SP').trim().toUpperCase();

      if (ruaLimpa && numLimpo && cidLimpa) {
        return `${ruaLimpa}, ${numLimpo}, ${cidLimpa} - ${ufLimpa}, Brasil`;
      }
      if (ruaLimpa && cidLimpa) {
        return `${ruaLimpa}, ${cidLimpa} - ${ufLimpa}, Brasil`;
      }
      if (cep && cidLimpa) {
        return `${cidLimpa} - ${ufLimpa}, ${cep}, Brasil`;
      }
      if (cep) return `${cep}, Brasil`;
      return [ruaLimpa, numLimpo, cidLimpa, ufLimpa].filter(Boolean).join(', ');
    };

    const endOrigem = buildMapsAddress(ruaOrigem, conf.numero, conf.bairro, cidadeOrigem, ufOrigem, conf.cep);
    const endDestino = buildMapsAddress(ruaDest, numDest, dest.bairro, cidadeDest, ufDest || ufOrigem, dest.cep);
    const googleMapsUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(endOrigem) + '&destination=' + encodeURIComponent(endDestino);

    if (!ruaDest && cepDest.length < 8 && !cidadeDest) {
      if (isManual) alert("Por favor, informe o CEP ou o endereço do local da festa para calcular a distância.");
      return;
    }

    if (!temOrigemValida || endOrigem.length < 3) {
      if (isManual) alert("⚠️ Endereço da sede/estoque da sua empresa ainda não foi configurado!\n\nAcesse 'Configurações > Empresa' e preencha o endereço onde seus materiais ficam guardados (sua loja, galpão ou sua residência) para que o sistema saiba de onde partir para calcular o frete.");
      return;
    }

    setCalculandoDistancia(true);
    try {
      let kmCalculado = 0;
      let duracaoTextoGoogle = null;
      let oficialGoogle = false;
      let numeroNaoMapeado = false;

      // 🌟 1. PRIORIDADE MÁXIMA: GOOGLE MAPS API OFICIAL (SE CONFIGURADO)
      const apiKeyGoogle = (conf.googleMapsApiKey || '').trim();
      if (apiKeyGoogle) {
        try {
          const resGoogle = await calcularDistanciaGoogleMaps(endOrigem, endDestino, apiKeyGoogle);
          if (resGoogle && resGoogle.km > 0) {
            kmCalculado = resGoogle.km;
            duracaoTextoGoogle = resGoogle.duracaoTexto;
            oficialGoogle = true;
          }
        } catch (errGoogle) {
          console.warn("Google Maps API oficial retornou erro, usando contingência:", errGoogle);
        }
      }

      // 🌐 2. CONTINGÊNCIA GRATUITA (OPENSTREETMAP / OSRM) CASO NÃO TENHA CHAVE GOOGLE
      if (!kmCalculado) {
        // Helper para extrair o nome do logradouro se houver nome comercial antes (ex: "Panificadora X, R. Y")
        const extrairLogradouro = (texto) => {
          if (!texto) return '';
          const regex = /(?:^|,\s*)(r\.|rua|av\.|avenida|alameda|travessa|rodovia|estrada)\s+([^,]+)/i;
          const match = texto.match(regex);
          if (match) {
            return (match[1] + ' ' + match[2]).trim();
          }
          return texto.trim();
        };

        const buscarCoord = async (qList, numBuscado = null) => {
          let tentouComNumero = false;
          for (let i = 0; i < qList.length; i++) {
            const q = qList[i];
            const queryTemNumero = numBuscado && q.includes(String(numBuscado));
            if (queryTemNumero) tentouComNumero = true;

            if (!q || q.trim().length < 3) continue;
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=1&q=${encodeURIComponent(q.trim())}`, {
                headers: { 'Accept-Language': 'pt-BR' }
              });
              const data = await res.json();
              if (data && data.length > 0 && data[0].lat && data[0].lon) {
                if (tentouComNumero && !queryTemNumero && numBuscado) {
                  numeroNaoMapeado = true;
                }
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), displayName: data[0].display_name || '' };
              }
            } catch (e) {
              // fallback
            }
          }
          return null;
        };

        // Geocodificar Origem (Empresa / Estoque)
        const ruaOrigemLimpa = extrairLogradouro(ruaOrigem);
        const queriesOrigem = [];
        if (ruaOrigemLimpa && conf.numero && cidadeOrigem) queriesOrigem.push(`${ruaOrigemLimpa}, ${conf.numero}, ${cidadeOrigem} - ${ufOrigem}, Brasil`);
        if (ruaOrigemLimpa && cidadeOrigem) queriesOrigem.push(`${ruaOrigemLimpa}, ${cidadeOrigem} - ${ufOrigem}, Brasil`);
        if (ruaOrigem && conf.numero && cidadeOrigem) queriesOrigem.push(`${ruaOrigem}, ${conf.numero}, ${cidadeOrigem} - ${ufOrigem}, Brasil`);
        if (cepOrigem.length === 8) queriesOrigem.push(conf.cep + ', Brasil');
        if (conf.bairro && cidadeOrigem) queriesOrigem.push(`${conf.bairro}, ${cidadeOrigem} - ${ufOrigem}, Brasil`);
        if (cidadeOrigem && ufOrigem) queriesOrigem.push(`${cidadeOrigem} - ${ufOrigem}, Brasil`);

        const coordOrigem = await buscarCoord(queriesOrigem, conf.numero);

        // Geocodificar Destino (Local da Festa)
        const ruaDestLimpa = extrairLogradouro(ruaDest);
        const queriesDestino = [];
        if (ruaDestLimpa && numDest && cidadeDest) queriesDestino.push(`${ruaDestLimpa}, ${numDest}, ${cidadeDest} - ${ufDest || ufOrigem}, Brasil`);
        if (ruaDestLimpa && cidadeDest) queriesDestino.push(`${ruaDestLimpa}, ${cidadeDest} - ${ufDest || ufOrigem}, Brasil`);
        if (ruaDest && numDest && cidadeDest) queriesDestino.push(`${ruaDest}, ${numDest}, ${cidadeDest} - ${ufDest || ufOrigem}, Brasil`);
        if (cepDest.length === 8) queriesDestino.push(dest.cep + ', Brasil');
        if (dest.bairro && cidadeDest) queriesDestino.push(`${dest.bairro}, ${cidadeDest} - ${ufDest || ufOrigem}, Brasil`);
        if (cidadeDest) queriesDestino.push(`${cidadeDest} - ${ufDest || ufOrigem}, Brasil`);

        const coordDestino = await buscarCoord(queriesDestino, numDest);

        if (coordOrigem && coordDestino) {
          const lat1 = coordOrigem.lat, lon1 = coordOrigem.lon;
          const lat2 = coordDestino.lat, lon2 = coordDestino.lon;

          // Normalização para comparar cidades (sem acentos)
          const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const mesmaCidade = cidadeOrigem && cidadeDest && norm(cidadeOrigem) === norm(cidadeDest);

          // Haversine (linha reta em km)
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          const distHaversine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          // 1. Tentar rota viária real via OSRM
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 6000);
            const resRoute = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`,
              { signal: ctrl.signal }
            );
            clearTimeout(timer);
            const dataRoute = await resRoute.json();
            if (dataRoute.routes?.length > 0 && dataRoute.routes[0].distance > 0) {
              const osrmKm = dataRoute.routes[0].distance / 1000;
              if (!(mesmaCidade && osrmKm > 40)) {
                kmCalculado = Math.max(0.5, Math.round(osrmKm * 10) / 10);
              }
            }
          } catch (eRoute) {
            console.warn('OSRM indisponível, usando estimativa Haversine viária', eRoute);
          }

          // 2. Fallback por estimativa viária (fator 1.35x sobre a linha reta)
          if (!kmCalculado && distHaversine > 0) {
            kmCalculado = Math.max(1, Math.round(distHaversine * 1.35 * 10) / 10);
          }
        }
      }

      // Disponibilizar link Maps com ou sem km e status do número
      const infoAtualizada = {
        origem: endOrigem,
        destino: endDestino,
        mapsUrl: googleMapsUrl,
        km: kmCalculado || null,
        duracaoTexto: duracaoTextoGoogle,
        oficialGoogle: oficialGoogle,
        numeroNaoMapeado: Boolean(numDest && numeroNaoMapeado && !oficialGoogle),
        numeroDigitado: numDest || ''
      };
      setInfoRota(infoAtualizada);

      if (kmCalculado > 0) {
        setKmDistancia(String(kmCalculado));
      } else if (isManual) {
        alert("⚠️ Não conseguimos calcular a distância automaticamente com precisão.\n\nO Google Maps foi aberto para você ver a rota real e digitar o KM correto manualmente no campo 'Distância do Trajeto'.");
        window.open(googleMapsUrl, '_blank');
      }
    } catch (err) {
      console.error("Erro ao calcular rota automática:", err);
      if (isManual) alert("Não foi possível conectar ao serviço de rotas. Você pode preencher o KM manualmente.");
    } finally {
      setCalculandoDistancia(false);
    }
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
          const novaRua = dados.logradouro || '';
          const novoBairro = dados.bairro || '';
          const novaCidade = `${dados.localidade || ''} - ${dados.uf || ''}`;

          setLogistica(prev => ({
            ...prev, 
            cep: cepFormatado, 
            rua: novaRua, 
            bairro: novoBairro, 
            cidade: novaCidade
          }));

          setTimeout(() => document.getElementById('numeroInput')?.focus(), 100);

          // 🚀 Calcula a distância automaticamente com base na sede da empresa!
          calcularDistanciaAutomatica({
            cep: cepFormatado,
            rua: novaRua,
            bairro: novoBairro,
            cidade: dados.localidade || '',
            uf: dados.uf || ''
          });
        }
      } catch (e) {
          console.error("Erro ao buscar CEP");
      }
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

  // ⚡ ATALHOS RÁPIDOS DE DATAS PARA LOCAÇÃO DE EVENTOS
  const aplicarAtalhoDatas = (tipo) => {
    const hoje = new Date();
    const formatYMD = (d) => {
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    };

    const addDays = (d, dias) => {
      const res = new Date(d);
      res.setDate(res.getDate() + dias);
      return res;
    };

    if (tipo === 'hoje_amanha') {
      const ret = hoje;
      const dev = addDays(hoje, 1);
      setDatas(prev => ({
        ...prev,
        retirada: formatYMD(ret),
        devolucao: formatYMD(dev)
      }));
    } else if (tipo === 'proxima_sexta_segunda') {
      const diaSemana = hoje.getDay(); // 0 Dom, 1 Seg, ..., 5 Sex, 6 Sab
      const diasAteSexta = (5 - diaSemana + 7) % 7;
      const sexta = addDays(hoje, diasAteSexta === 0 && diaSemana !== 5 ? 7 : diasAteSexta);
      const segunda = addDays(sexta, 3);
      setDatas(prev => ({
        ...prev,
        retirada: formatYMD(sexta),
        devolucao: formatYMD(segunda)
      }));
    } else if (tipo === 'proximo_sabado_segunda') {
      const diaSemana = hoje.getDay();
      const diasAteSabado = (6 - diaSemana + 7) % 7;
      const sabado = addDays(hoje, diasAteSabado === 0 && diaSemana !== 6 ? 7 : diasAteSabado);
      const segunda = addDays(sabado, 2);
      setDatas(prev => ({
        ...prev,
        retirada: formatYMD(sabado),
        devolucao: formatYMD(segunda)
      }));
    } else if (tipo === 'proximo_sabado_domingo') {
      const diaSemana = hoje.getDay();
      const diasAteSabado = (6 - diaSemana + 7) % 7;
      const sabado = addDays(hoje, diasAteSabado === 0 && diaSemana !== 6 ? 7 : diasAteSabado);
      const domingo = addDays(sabado, 1);
      setDatas(prev => ({
        ...prev,
        retirada: formatYMD(sabado),
        devolucao: formatYMD(domingo)
      }));
    }
  };

  const interceptarSalvamento = (status) => {
    if (!clienteSelecionado) return alert("Selecione o Cliente!");
    
    if (!temaFesta || !temaFesta.trim()) {
        return alert("Por favor, preencha o Tema da Festa / Evento!");
    }

    if (!datas.retirada) return alert("Preencha a Data de Retirada!");
    if (!datas.devolucao) return alert("Preencha a Data de Devolução!");
    
    if (datas.devolucao && datas.retirada > datas.devolucao) {
        return alert("A data de devolução não pode ser menor que a data de retirada!");
    }
    
    const pecasFisicasNoCarrinho = carrinho.filter(i => !i.isDebitoAnterior && !i.isTaxa && !i.isServico);
    if (pecasFisicasNoCarrinho.length === 0) {
      return alert("Você precisa adicionar pelo menos 1 peça do acervo no pedido!");
    }
    
    for (let item of pecasFisicasNoCarrinho) {
        if (item.isPendenteCompra) continue;
        const disp = getDisponibilidade(item.id);
        const qtdNoCarrinho = Number(item.qtd) || 1;
        if (qtdNoCarrinho > disp.livresMaximos) {
            return alert(`⛔ ERRO GRAVE DE ESTOQUE:\nA peça "${item.nome}" possui apenas ${disp.livresMaximos} unidade(s) permitida(s).`);
        }
    }

    setStatusParaSalvar(status);
    if (status === 'orcamento') { 
        executarSalvamentoFinal('orcamento', 0, 0);
    } else { 
        setModalSinalAberto(true); 
    }
  };

  const executarSalvamentoFinal = async (statusFinal, valorRecebidoNoCaixa = 0, valorSinalNegociado = 0) => {
    setSalvandoPedido(true);
    
    try {
      const coll = collection(db, "locacoes");
      // ✅ Filtrar por tenantId para respeitar as regras de segurança do Firestore
      const qCount = query(coll, where("userId", "==", tenantId));
      const snap = await getCountFromServer(qCount);
      const count = snap.data().count + 1;
      const codigo = `${new Date().getFullYear()}-${count.toString().padStart(3, '0')}`;

      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeClienteReal = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeFantasia || clienteEncontrado.razaoSocial || "Cliente") : "Cliente";
      const estFrete = calcularFreteEstimado(kmDistancia);

      const docRef = await addDoc(coll, {
        numeroPedido: codigo, 
        clienteId: clienteSelecionado, 
        clienteNome: nomeClienteReal, 
        temaFesta: (temaFesta || '').trim(), 
        tipoServico, 
        tipoEvento: tipoEvento || null,  // 🏷️ Tipo de evento salvo automaticamente
        dataRetirada: datas.retirada, 
        dataDevolucao: datas.devolucao, 
        itens: carrinho, 
        logistica: { 
          ...logistica, 
          frete: getFreteNumerico(),
          distanciaKm: Number(kmDistancia) || 0,
          paramFrete: paramFrete,
          custoCombustivel: estFrete.custoGasolina || 0,
          custoDesgaste: estFrete.custoDesgaste || 0,
          custoTotalLogistica: (estFrete.custoGasolina + estFrete.custoDesgaste) || 0
        }, 
        obsInternas, 
        desconto: calcularTotal().valorDesconto, 
        tipoDesconto,
        valorDescontoInput: Number(desconto),
        valorTotal: calcularTotal().total, 
        valorPago: valorRecebidoNoCaixa, 
        sinalNegociado: valorSinalNegociado > 0 ? valorSinalNegociado : null,
        status: statusFinal, 
        criadoEm: serverTimestamp(),
        userId: tenantId // 🎯 SALVA VINCULADO À EMPRESA
      });

      if (valorRecebidoNoCaixa > 0) {
        await addDoc(collection(db, "financeiro_lancamentos"), {
            tipo: 'entrada', 
            categoria: 'Locações e Eventos', 
            centroCusto: 'Receitas Operacionais',
            valor: valorRecebidoNoCaixa, 
            valorTotal: valorRecebidoNoCaixa,
            formaPagamento: formaPagtoSinal || 'Pix',
            formaPagto: formaPagtoSinal || 'Pix',
            data: new Date().toISOString().split('T')[0], 
            status: 'pago', 
            locacaoId: docRef.id,
            locacaoNumero: codigo,
            clienteId: clienteSelecionado || '',
            clienteNome: nomeClienteReal,
            origem: 'novo_pedido_sinal',
            descricao: `Sinal / Entrada - Pedido #${codigo} (${nomeClienteReal})`,
            observacoes: `Pagamento de sinal/entrada registrado na assinatura da locação (${tipoServico}).`,
            userId: tenantId,
            empresaId: tenantId,
            createdAt: serverTimestamp(),
            criadoEm: serverTimestamp()
        });
        
        await registrarLog("PAGAMENTO Lançado", `Registrou entrada financeira de R$ ${valorRecebidoNoCaixa.toFixed(2)} (Sinal da Locação) na criação do pedido #${codigo}.`, docRef.id, codigo);
      }

      const acaoLog = statusFinal === 'orcamento' ? 'NOVO ORÇAMENTO' : 'NOVA LOCAÇÃO';
      await registrarLog(acaoLog, `Gerou um novo ${statusFinal.toLowerCase()} do zero no valor de R$ ${calcularTotal().total.toFixed(2)} para: ${nomeClienteReal} (${tipoServico})`, docRef.id, codigo);
      
      alert(`✅ Pedido ${codigo} salvo com sucesso!`);
      navigate('/locacoes');
      
    } catch (e) { 
        alert("Erro ao salvar o pedido.");
        console.error(e);
    } finally {
        setSalvandoPedido(false);
        setModalSinalAberto(false);
    }
  };

  const salvarSinalRecebido = () => {
      const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0;
      executarSalvamentoFinal('confirmado', valorDigitadoNum, valorDigitadoNum);
  };

  const salvarAguardandoPagamento = () => {
      const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0;
      executarSalvamentoFinal('orcamento', 0, valorDigitadoNum);
  };

  const salvarSemSinal = () => {
      if (window.confirm("⚠️ ALERTA DE RISCO!\n\nVocê deixou o valor de entrada como R$ 0,00.\n\nTem certeza que deseja CONFIRMAR este pedido assumindo o risco de não ter recebido nenhum sinal?")) {
          executarSalvamentoFinal('confirmado', 0, 0);
      }
  };

  const gerarLinkMercadoPago = async () => {
    const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || (calcularTotal().total * 0.5);
    if (valorDigitadoNum <= 0) {
      alert("⚠️ Por favor, informe um valor de sinal/entrada válido maior que R$ 0,00!");
      return;
    }

    setGerandoLinkMP(true);
    try {
      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeClienteVIP = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeFantasia || 'Cliente Celebre') : 'Cliente Celebre';

      const mpToken = configEmpresa?.mpAccessToken;
      const mpLinkEmpresa = configEmpresa?.linkMercadoPago;
      const chavePixEmpresa = configEmpresa?.chavePix;

      let linkFinal = "";

      if (mpToken) {
        try {
          const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${mpToken}`
            },
            body: JSON.stringify({
              items: [
                {
                  title: `Sinal de Locação (${temaFesta || 'Celebre Festas'}) - ${nomeClienteVIP}`.substring(0, 250),
                  quantity: 1,
                  currency_id: "BRL",
                  unit_price: Number(valorDigitadoNum.toFixed(2))
                }
              ],
              back_urls: {
                success: window.location.href,
                failure: window.location.href,
                pending: window.location.href
              },
              auto_return: "approved"
            })
          });
          const data = await response.json();
          if (data && (data.init_point || data.sandbox_init_point)) {
            linkFinal = data.init_point || data.sandbox_init_point;
          }
        } catch (errApi) {
          console.warn("Aviso API MP Empresa:", errApi);
        }
      }

      if (!linkFinal && mpLinkEmpresa) {
        linkFinal = mpLinkEmpresa.includes('http') ? mpLinkEmpresa : `https://${mpLinkEmpresa}`;
      }

      if (!linkFinal && chavePixEmpresa) {
        linkFinal = `Chave Pix: ${chavePixEmpresa}`;
      }

      if (!linkFinal) {
        // Link fixo da empresa Celebre como fallback seguro
        linkFinal = `https://link.mercadopago.com.br/celebresistema`;
      }

      setLinkMercadoPago(linkFinal);
      setFormaPagtoSinal('Mercado Pago');
      alert("✅ Cobrança gerada com sucesso para a SUA conta! Você pode editar o link no campo abaixo se desejar.");

    } catch (e) {
      console.error("Erro MP Preference:", e);
      alert("❌ Erro ao gerar cobrança. Verifique suas configurações de pagamento em Configurações > Empresa.");
    } finally {
      setGerandoLinkMP(false);
    }
  };

  const abrirWhatsAppCobranca = () => {
      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeClienteVIP = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeFantasia || 'Cliente') : 'Cliente';
      const telefoneC = clienteEncontrado?.celular ? clienteEncontrado.celular.replace(/\D/g, '') : '';
      const vTotal = calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2});
      const vSinalFormatado = valorSinal || (calcularTotal().total * 0.5).toFixed(2).replace('.', ',');
      const chavePixEmpresa = configEmpresa?.chavePix;
      
      let texto = `Olá, *${nomeClienteVIP}*! 🎉\n\nSua reserva para o tema *${temaFesta || 'Festas'}* no valor de *R$ ${vTotal}* foi registrada!\n\nPara confirmarmos a data (*${datas.retirada || 'a combinar'}*), o valor da entrada é de *R$ ${vSinalFormatado}*.\n\n`;

      if (linkMercadoPago) {
        texto += `💳 *Link de Pagamento Automático (Pix / Cartão Mercado Pago):*\n${linkMercadoPago}\n\n`;
      } else if (chavePixEmpresa) {
        texto += `💳 *Chave PIX da Empresa:*\n${chavePixEmpresa}\n\n`;
      } else {
        texto += `💳 *Pagamento via PIX:*\nSolicite nossa chave por aqui!\n\n`;
      }

      texto += `Assim que efetuado, seu pedido é aprovado na hora! 🥰`;
      
      const msgEncoded = encodeURIComponent(texto);
      const url = telefoneC ? `https://wa.me/55${telefoneC}?text=${msgEncoded}` : `https://api.whatsapp.com/send?text=${msgEncoded}`;
      window.open(url, '_blank');
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
      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeClienteReal = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeFantasia) : 'Cliente Não Identificado';
      const nomeTemaFinal = temaFesta === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : temaFesta;
      const nomeVinculo = nomeTemaFinal ? `${nomeTemaFinal} - ${nomeClienteReal}` : `Pedido em Criação de ${nomeClienteReal}`;
      
      let valorCusto = formCompra.valorEstimado ? Number(formCompra.valorEstimado.replace(/\./g, "").replace(",", ".")) : 0;
      let valorAluguel = formCompra.valorAluguel ? Number(formCompra.valorAluguel.replace(/\./g, "").replace(",", ".")) : 0;
      
      const novaCompraRef = await addDoc(collection(db, "lista_compras"), {
        nome: formCompra.nome, 
        quantidade: Number(formCompra.quantidade), 
        valorEstimado: valorCusto, 
        categoria: formCompra.categoria, 
        prazo: formCompra.prazo || datas.retirada || "", 
        fornecedor: formCompra.fornecedor, 
        obs: formCompra.obs, 
        vinculoTipo: "pedido", 
        vinculoId: "pendente_salvamento", 
        vinculo: nomeVinculo, 
        status: "pendente", 
        createdAt: serverTimestamp(),
        userId: tenantId // 🎯 SALVA VINCULADO À EMPRESA
      });
      
      await registrarLog("NOVA COMPRA PENDENTE", `Adicionou "${formCompra.nome}" à lista de compras, urgente para nova locação.`, novaCompraRef.id, "S/N");
      
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
    } catch (err) { 
        alert("Erro ao salvar compra.");
    } finally { 
        setSalvandoCompra(false); 
    }
  };

  const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0;

  if (loading) return <div className="loading-state">Carregando formulário...</div>;

  return (
    <div className="locacao-form-container">
      <header className="page-header-compact">
        <div className="header-top-row">
          <h1 className="page-title">Nova Locação</h1>
          <button className="btn-voltar-compact" onClick={() => navigate('/locacoes')}>
            ← Voltar
          </button>
        </div>
        
        <div className="header-tools-row">
          <button type="button" className="btn-tool-chip" onClick={() => setModalCalendarioAberto(true)}>
            📅 Disponibilidade
          </button>
          <button type="button" className="btn-tool-chip gold" onClick={handleGerarPropostaPDF}>
            📄 Proposta PDF
          </button>
        </div>
      </header>

      <div className="layout-duas-colunas">
        
        <div className="coluna-form">
          <div className="card-secao">
            <h3 className="section-divider">👤 DADOS DO EVENTO & CLIENTE</h3>
            
            <div className="form-group mb-20">
              <label style={{ fontWeight: '800', fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MODALIDADE DE SERVIÇO *</label>
              <div className="toggle-servico-vip">
                <button 
                  type="button" 
                  className={`btn-servico-card ${tipoServico === 'PEGUE E MONTE' ? 'active' : ''}`} 
                  onClick={() => {
                    setTipoServico('PEGUE E MONTE');
                    setLogistica(prev => ({ ...prev, tipo: 'retirada', frete: '' }));
                  }}
                >
                  <span className="servico-icon">📦</span>
                  <div className="servico-info">
                    <strong>PEGUE E MONTE</strong>
                    <small>Cliente retira e devolve no balcão da loja</small>
                  </div>
                </button>
                <button 
                  type="button" 
                  className={`btn-servico-card ${tipoServico === 'DECORACAO COMPLETA' ? 'active' : ''}`} 
                  onClick={() => {
                    setTipoServico('DECORACAO COMPLETA');
                    setLogistica(prev => ({ ...prev, tipo: 'entrega' }));
                  }}
                >
                  <span className="servico-icon">✨</span>
                  <div className="servico-info">
                    <strong>DECORAÇÃO COMPLETA</strong>
                    <small>Entrega, montagem e recolhimento Celebre</small>
                  </div>
                </button>
              </div>
            </div>

            {/* 👤 SELEÇÃO DE CLIENTE LUXO (BUSCA SEARCHABLE + CARD EXECUTIVO) */}
            <div className="form-group mt-15 mb-15">
              <label className="label-secao-sub" style={{ marginBottom: '6px' }}>👤 CLIENTE *</label>

              {(() => {
                const clienteObjSelecionado = clientes.find(c => String(c.id) === String(clienteSelecionado));
                const pendenciasClienteAtual = getPendenciasCliente(clienteSelecionado);

                if (!clienteObjSelecionado) {
                  return (
                    <div className="seletor-cliente-container" ref={seletorClienteRef}>
                      <div className="seletor-cliente-input-box">
                        <i className="fas fa-search seletor-cliente-icon"></i>
                        <input
                          type="text"
                          placeholder="Buscar cliente por Nome, WhatsApp ou CPF..."
                          value={buscaClienteTexto}
                          onChange={e => {
                            setBuscaClienteTexto(e.target.value);
                            setMostrarDropdownCliente(true);
                          }}
                          onFocus={() => setMostrarDropdownCliente(true)}
                          className="input-busca-cliente"
                        />
                        {buscaClienteTexto && (
                          <button
                            type="button"
                            className="btn-limpar-busca-cli"
                            onClick={() => {
                              setBuscaClienteTexto('');
                              setMostrarDropdownCliente(false);
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* DROPDOWN POPUP DE CLIENTES */}
                      {mostrarDropdownCliente && (
                        <div className="popover-clientes-lista">
                          {clientesFiltrados.length > 0 ? (
                            clientesFiltrados.map(c => {
                              const infoPend = getPendenciasCliente(c.id);
                              const nome = c.nome || c.nomeFantasia || c.razaoSocial || 'Cliente sem nome';
                              const tel = c.celular || c.telefone || '';
                              const doc = c.cpf || c.cnpj || '';

                              return (
                                <div
                                  key={c.id}
                                  className={`cliente-opcao-card ${infoPend.temPendencia ? 'com-pendencia' : ''}`}
                                  onClick={() => handleSelecionarCliente(c.id)}
                                >
                                  <div className="cliente-opcao-avatar">
                                    {nome.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="cliente-opcao-dados">
                                    <div className="cliente-opcao-nome">
                                      {nome}
                                    </div>
                                    <div className="cliente-opcao-sub">
                                      {tel && <span>📱 {tel}</span>}
                                      {doc && <span>📄 {doc}</span>}
                                    </div>
                                  </div>
                                  <div className="cliente-opcao-status">
                                    {infoPend.temPendencia ? (
                                      <span className="badge-pendencia-pill">
                                        ⚠️ Débito R$ {infoPend.valorDevido.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="badge-ok-pill">✓ Ativo</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="cliente-opcao-vazia">
                              <p style={{ margin: 0 }}>Nenhum cliente cadastrado encontrado com "<strong>{buscaClienteTexto}</strong>".</p>
                              <small style={{ color: '#94a3b8' }}>Cadastre o cliente previamente na aba Clientes.</small>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                /* CARD DO CLIENTE SELECIONADO */
                return (
                  <div className={`card-cliente-selecionado ${pendenciasClienteAtual.temPendencia ? 'alerta-debito' : ''}`}>
                    <div className="card-cli-left">
                      <div className="card-cli-avatar">
                        {(clienteObjSelecionado.nome || clienteObjSelecionado.nomeFantasia || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="card-cli-info">
                        <div className="card-cli-nome-row">
                          <strong>{clienteObjSelecionado.nome || clienteObjSelecionado.nomeFantasia || clienteObjSelecionado.razaoSocial}</strong>
                          {pendenciasClienteAtual.temPendencia ? (
                            <span className="badge-pendencia-pill">
                              ⚠️ Débito R$ {pendenciasClienteAtual.valorDevido.toFixed(2)}
                            </span>
                          ) : (
                            <span className="badge-ok-pill">✓ Regular</span>
                          )}
                        </div>
                        <div className="card-cli-sub-info">
                          {(clienteObjSelecionado.celular || clienteObjSelecionado.telefone) && (
                            <span>📱 {clienteObjSelecionado.celular || clienteObjSelecionado.telefone}</span>
                          )}
                          {(clienteObjSelecionado.cpf || clienteObjSelecionado.cnpj) && (
                            <span>📄 {clienteObjSelecionado.cpf || clienteObjSelecionado.cnpj}</span>
                          )}
                          {clienteObjSelecionado.cidade && (
                            <span>📍 {clienteObjSelecionado.cidade}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="card-cli-actions">
                      {pendenciasClienteAtual.temPendencia && (
                        <button
                          type="button"
                          className="btn-ver-pendencia-mini"
                          onClick={() => setModalTravaCliente({
                            cliente: pendenciasClienteAtual.clienteObj,
                            pendencias: pendenciasClienteAtual.pendencias,
                            valorDevido: pendenciasClienteAtual.valorDevido
                          })}
                        >
                          🔍 Ver Débito
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-trocar-cliente"
                        onClick={() => {
                          setClienteSelecionado('');
                          setMostrarDropdownCliente(true);
                        }}
                        title="Trocar Cliente"
                      >
                        Trocar ✕
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 🏷️ TIPO DE EVENTO & 🎭 TEMA DA FESTA (DIRETO E SEM BUROCRACIA) */}
            {/* 🏷️ TIPO DE EVENTO & 🎭 TEMA DA FESTA (GRID 2 COLUNAS LIMPO E DIRETO) */}
            <div className="grid-temas-2col mt-12">
              {/* 1. TIPO DE EVENTO */}
              <div className="form-group">
                <label>🏷️ Tipo de Evento</label>
                <select
                  value={tipoEvento}
                  onChange={e => setTipoEvento(e.target.value)}
                  className="select-gaveta-evento"
                >
                  <option value="">Selecione o Tipo de Evento...</option>
                  {TIPOS_EVENTO.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.emoji} {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. 1º CATEGORIA */}
              <div className="form-group">
                <label>🎭 1º Categoria *</label>
                <select
                  value={categoriaTema}
                  onChange={e => {
                    setCategoriaTema(e.target.value);
                    setSubcategoriaTema('');
                    setGrupoTemaSelecionado('');
                    setTemaFesta('');
                  }}
                >
                  <option value="">Selecione a Categoria...</option>
                  {categoriasDeTemaUnicas.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 3. 2º SUBCATEGORIA */}
              <div className="form-group">
                <label>2º Subcategoria *</label>
                <select
                  value={subcategoriaTema}
                  onChange={e => {
                    setSubcategoriaTema(e.target.value);
                    setGrupoTemaSelecionado('');
                    setTemaFesta('');
                  }}
                  disabled={!categoriaTema}
                >
                  <option value="">Selecione a Subcategoria...</option>
                  {subcategoriasDisponiveis.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* 4. 3º GRUPO / ESTILO */}
              <div className="form-group">
                <label>3º Grupo / Estilo *</label>
                <select
                  value={grupoTemaSelecionado}
                  onChange={e => {
                    setGrupoTemaSelecionado(e.target.value);
                    setTemaFesta('');
                  }}
                  disabled={!subcategoriaTema}
                >
                  <option value="">Selecione o Grupo...</option>
                  {gruposDisponiveis.map(grupo => (
                    <option key={grupo} value={grupo}>{grupo}</option>
                  ))}
                </select>
              </div>

              {/* 5. 4º TEMA ESPECÍFICO (DESTAQUE NA LARGURA TOTAL) */}
              <div className="form-group tema-destaque-campo">
                <label>🎉 4º Tema Específico da Festa / Evento *</label>
                <select
                  value={temaFesta}
                  onChange={e => setTemaFesta(e.target.value)}
                  disabled={!grupoTemaSelecionado && temaFesta !== 'OUTRO_TEMA'}
                >
                  <option value="">Selecione o Tema...</option>
                  {temasDisponiveis.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="OUTRO_TEMA" style={{ fontWeight: 'bold', color: '#c5a059' }}>✏️ Outro (Digitar Novo Tema Personalizado)</option>
                </select>
              </div>
            </div>

            {/* SE DIGITAR OUTRO TEMA */}
            {temaFesta === 'OUTRO_TEMA' && (
              <div className="form-group mt-10" style={{ background: 'rgba(197, 160, 89, 0.08)', padding: '12px 14px', borderRadius: '10px', border: '1.5px dashed #c5a059' }}>
                <label style={{ color: '#926f2d', fontWeight: '800' }}>✏️ Digite o nome do Tema Personalizado *</label>
                <input
                  type="text"
                  placeholder="Ex: Bailarina Rosa com Ouro..."
                  value={temaDigitadoPersonalizado}
                  onChange={e => setTemaDigitadoPersonalizado(e.target.value)}
                  style={{ borderColor: '#c5a059', marginTop: '4px' }}
                  autoFocus
                />
              </div>
            )}

            {/* ⚡ ATALHOS RÁPIDOS DE DATAS */}
            <div className="barra-atalhos-datas mt-12">
              <span className="label-atalhos-datas">
                ⚡ Atalhos Rápidos:
              </span>
              <div className="grupo-botoes-atalhos-datas">
                <button
                  type="button"
                  className="btn-chip-data"
                  onClick={() => aplicarAtalhoDatas('proxima_sexta_segunda')}
                  title="Retira Sexta (14h) e devolve Segunda (12h)"
                >
                  🎉 Sex ➔ Seg
                </button>
                <button
                  type="button"
                  className="btn-chip-data"
                  onClick={() => aplicarAtalhoDatas('proximo_sabado_segunda')}
                  title="Retira Sábado (09h) e devolve Segunda (12h)"
                >
                  🎈 Sáb ➔ Seg
                </button>
                <button
                  type="button"
                  className="btn-chip-data"
                  onClick={() => aplicarAtalhoDatas('proximo_sabado_domingo')}
                  title="Retira Sábado (09h) e devolve Domingo (18h)"
                >
                  📅 Sáb ➔ Dom
                </button>
                <button
                  type="button"
                  className="btn-chip-data"
                  onClick={() => aplicarAtalhoDatas('hoje_amanha')}
                  title="Retira Hoje (09h) e devolve Amanhã (18h)"
                >
                  ⚡ Hoje ➔ Amanhã
                </button>
              </div>
            </div>

            {/* 📅 DATAS E HORÁRIOS EM GRID ROBUSTO (4 COLUNAS NO DESKTOP, 2x2 NO MOBILE) */}
            <div className="grid-datas-celebre mt-10">
              <div className="form-group">
                <label>📅 Data Retirada *</label>
                <input 
                  type="date" 
                  value={datas.retirada} 
                  onChange={handleDataRetiradaChange} 
                />
              </div>

              <div className="form-group">
                <label>⏰ Hora Retirada</label>
                <input 
                  type="time" 
                  value={datas.horarioRetirada || '09:00'} 
                  onChange={e => setDatas({...datas, horarioRetirada: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>📅 Data Devolução *</label>
                <input 
                  type="date" 
                  min={datas.retirada} 
                  value={datas.devolucao} 
                  onChange={e => setDatas({...datas, devolucao: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>⏰ Hora Devolução</label>
                <input 
                  type="time" 
                  value={datas.horarioDevolucao || '18:00'} 
                  onChange={e => setDatas({...datas, horarioDevolucao: e.target.value})} 
                />
              </div>
            </div>

            {/* 🎉 HORÁRIO PREVISTO DA FESTA */}
            <div className="form-group mt-12">
              <label>🎉 Horário Previsto da Festa / Evento</label>
              <input 
                type="time" 
                value={datas.horarioFesta || '19:00'} 
                onChange={e => setDatas({...datas, horarioFesta: e.target.value})} 
              />
            </div>
          </div>

          <div className="card-secao">
            <div className="header-com-toggle">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>🚚 LOGÍSTICA & ENTREGA</h3>
              <div className="toggle-simples">
                <button 
                  type="button" 
                  className={logistica.tipo === 'entrega' ? 'active' : ''} 
                  onClick={() => {
                    if (tipoServico === 'PEGUE E MONTE') {
                      alert("📦 Na modalidade Pegue e Monte, a retirada e devolução são feitas pelo cliente no balcão da loja. Se precisar de frete, altere a modalidade do serviço para DECORAÇÃO COMPLETA.");
                      return;
                    }
                    setLogistica({...logistica, tipo: 'entrega'});
                  }}
                  style={tipoServico === 'PEGUE E MONTE' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  Com Frete {tipoServico === 'PEGUE E MONTE' && '🔒'}
                </button>
                <button 
                  type="button" 
                  className={logistica.tipo === 'retirada' ? 'active' : ''} 
                  onClick={() => setLogistica({...logistica, tipo: 'retirada', frete: ''})}
                >
                  Retirada na Loja
                </button>
              </div>
            </div>

            {logistica.tipo === 'entrega' ? (
              <div className="logistica-form mt-15">
                
                {/* 📍 SELETOR DE STATUS DO LOCAL / FRETE */}
                <div className="seletor-status-local">
                  <button
                    type="button"
                    className={`btn-status-local ${(!logistica.statusLocal || logistica.statusLocal === 'definido') ? 'ativo' : ''}`}
                    onClick={() => setLogistica(prev => ({ ...prev, statusLocal: 'definido' }))}
                  >
                    <span className="icon">📍</span>
                    <div className="texto">
                      <strong>Endereço Definido</strong>
                      <small>Local completo informado</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`btn-status-local warning ${logistica.statusLocal === 'a_definir' ? 'ativo' : ''}`}
                    onClick={() => {
                      setLogistica(prev => ({ 
                        ...prev, 
                        statusLocal: 'a_definir', 
                        frete: '' // Zera o frete para não cobrar antes de saber a distância
                      }));
                      setKmDistancia('');
                    }}
                  >
                    <span className="icon">⏳</span>
                    <div className="texto">
                      <strong>Local a Definir</strong>
                      <small>Frete lançado após envio</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`btn-status-local info ${logistica.statusLocal === 'estimado' ? 'ativo' : ''}`}
                    onClick={() => setLogistica(prev => ({ ...prev, statusLocal: 'estimado' }))}
                  >
                    <span className="icon">🚚</span>
                    <div className="texto">
                      <strong>Frete Estimado</strong>
                      <small>Taxa sugestiva com ajuste</small>
                    </div>
                  </button>
                </div>

                {/* MODO 1: LOCAL A DEFINIR (FRETE PENDENTE) */}
                {logistica.statusLocal === 'a_definir' && (
                  <div className="container-status-modo mt-12">
                    <div className="banner-status-local warning">
                      <span className="banner-icon">⏳</span>
                      <div>
                        <strong>Local da Festa & Frete a Definir pelo Cliente</strong>
                        <p>
                          O valor do frete <strong>não será somado agora</strong>. O orçamento e o contrato constarão com a observação oficial de que o frete será calculado e adicionado ao pedido assim que o cliente confirmar o endereço final.
                        </p>
                      </div>
                    </div>

                    <div className="grid-logistica-linha2 mt-12">
                      <div className="form-group">
                        <label>Cidade / Região Prevista (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: Vargem Grande do Sul - SP"
                          value={logistica.cidade}
                          onChange={e => setLogistica({...logistica, cidade: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Status Frete</label>
                        <input
                          type="text"
                          value="A CALCULAR"
                          disabled
                          style={{ fontWeight: '800', color: '#d97706', background: '#fef3c7', borderColor: '#fde68a' }}
                        />
                      </div>
                    </div>

                    <div className="form-group mt-12">
                      <label>📝 Observações ou Preferências de Transporte</label>
                      <input
                        type="text"
                        placeholder="Ex: Cliente está escolhendo entre 2 chácaras na saída da cidade..."
                        value={logistica.referencia || logistica.obsTransporte || ''}
                        onChange={e => setLogistica({...logistica, referencia: e.target.value, obsTransporte: ''})}
                      />
                    </div>
                  </div>
                )}

                {/* MODO 2: FRETE ESTIMADO (SUJEITO A REAJUSTE POR KM) */}
                {logistica.statusLocal === 'estimado' && (
                  <div className="container-status-modo mt-12">
                    <div className="banner-status-local info">
                      <span className="banner-icon">🚚</span>
                      <div>
                        <strong>Frete Sugestivo (Sujeito a Ajuste por KM)</strong>
                        <p>
                          Preencha abaixo o valor estimado de frete (ex: tarifa urbana). O orçamento deixará explícito que caso o evento ocorra em chácaras, zona rural ou outro município, haverá reajuste de acordo com a quilometragem final.
                        </p>
                      </div>
                    </div>

                    <div className="grid-logistica-linha1 mt-12">
                      <div className="form-group">
                        <label>Cidade / Região Prevista</label>
                        <input
                          type="text"
                          placeholder="Ex: Vargem Grande do Sul - SP"
                          value={logistica.cidade}
                          onChange={e => setLogistica({...logistica, cidade: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Bairro / Área Prevista</label>
                        <input
                          type="text"
                          placeholder="Ex: Centro / Perímetro Urbano"
                          value={logistica.bairro}
                          onChange={e => setLogistica({...logistica, bairro: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Taxa Frete Estimada (R$)</label>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Ex: 50,00"
                            value={logistica.frete}
                            onChange={handleFreteChange}
                            style={{ fontWeight: '800', color: getFreteNumerico() > 0 ? '#16a34a' : 'var(--texto-principal, #0f172a)' }}
                          />
                          {getFreteNumerico() > 0 && (
                            <button
                              type="button"
                              onClick={() => setLogistica(prev => ({ ...prev, frete: '' }))}
                              style={{ padding: '6px 8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
                              title="Zerar Frete"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="form-group mt-12">
                      <label>📝 Observações de Transporte</label>
                      <input
                        type="text"
                        placeholder="Ex: Tarifa estimada para centro/bairros urbanos..."
                        value={logistica.referencia || logistica.obsTransporte || ''}
                        onChange={e => setLogistica({...logistica, referencia: e.target.value, obsTransporte: ''})}
                      />
                    </div>
                  </div>
                )}

                {/* MODO 3: ENDEREÇO DEFINIDO (COMPLETO COM CALCULADORA) */}
                {(!logistica.statusLocal || logistica.statusLocal === 'definido') && (
                  <>
                    {/* LINHA 1: CEP | Cidade/UF | Taxa de Frete */}
                    <div className="grid-logistica-linha1 mt-12">
                      <div className="form-group">
                        <label>CEP do Local da Festa</label>
                        <input type="text" placeholder="00000-000" maxLength="9" value={logistica.cep} onChange={handleCepChange} />
                      </div>
                      <div className="form-group">
                        <label>Cidade / UF</label>
                        <input type="text" placeholder="Ex: Campinas - SP" value={logistica.cidade} onChange={e => setLogistica({...logistica, cidade: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Taxa de Frete Final (R$)</label>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="0,00"
                            value={logistica.frete}
                            onChange={handleFreteChange}
                            style={{ fontWeight: '800', color: getFreteNumerico() > 0 ? '#16a34a' : 'var(--texto-principal, #0f172a)' }}
                          />
                          {getFreteNumerico() > 0 && (
                            <button
                              type="button"
                              onClick={() => setLogistica(prev => ({ ...prev, frete: '' }))}
                              style={{ padding: '6px 8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
                              title="Zerar Frete"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* LINHA 2: Logradouro | Número (mesma linha) */}
                    <div className="grid-logistica-linha2 mt-12">
                      <div className="form-group">
                        <label>Logradouro (Rua / Av.)</label>
                        <input type="text" placeholder="Av. das Nações..." value={logistica.rua} onChange={e => setLogistica({...logistica, rua: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Número</label>
                        <input type="text" id="numeroInput" placeholder="123" value={logistica.numero} onChange={e => setLogistica({...logistica, numero: e.target.value})} />
                      </div>
                    </div>

                    {/* LINHA 3: Bairro */}
                    <div className="grid-logistica-linha3 mt-12">
                      <div className="form-group">
                        <label>Bairro</label>
                        <input type="text" placeholder="Centro" value={logistica.bairro} onChange={e => setLogistica({...logistica, bairro: e.target.value})} />
                      </div>
                    </div>

                    <div className="form-group mt-12">
                      <label>📝 Referência / Observações de Transporte</label>
                      <input
                        type="text"
                        placeholder="Ex: Portão preto ao lado do mercado, deixar com porteiro, casa de esquina..."
                        value={logistica.referencia || logistica.obsTransporte || ''}
                        onChange={e => setLogistica({...logistica, referencia: e.target.value, obsTransporte: ''})}
                      />
                    </div>
                  </>
                )}

                {/* 🧮 CALCULADORA INTEGRADA DE FRETE POR KM AUTOMÁTICA */}
                <div className="box-calculadora-frete">
                  <div className="calc-frete-header">
                    <div className="calc-frete-header-info">
                      <div className="calc-frete-icon-badge">🧮</div>
                      <div>
                        <strong>Calculadora de Frete por KM</strong>
                        <p>Cálculo automático de rota e estimativa de custos de transporte</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarAjusteFrete(!mostrarAjusteFrete)}
                      className={`btn-toggle-veiculo ${mostrarAjusteFrete ? 'ativo' : ''}`}
                    >
                      <i className="fas fa-sliders-h"></i>
                      {mostrarAjusteFrete ? 'Fechar Ajustes' : 'Configurar Veículo'}
                    </button>
                  </div>

                  {/* 📍 BANNER DE ENDEREÇO DE ORIGEM (SEDE/ESTOQUE) */}
                  {(() => {
                    const conf = configEmpresa || {};
                    const temEndereco = Boolean(conf.rua || conf.cidade || (conf.cep && conf.cep.replace(/\D/g, '').length === 8));
                    const endTexto = [conf.rua, conf.numero, conf.bairro, conf.cidade && conf.uf ? `${conf.cidade}/${conf.uf}` : conf.cidade].filter(Boolean).join(', ');
                    
                    return temEndereco ? (
                      <div className="origem-frete-tag" title="Endereço cadastrado em Configurações > Empresa">
                        📍 <span><strong>Origem (Estoque):</strong> {endTexto || conf.cep || 'Sede da Empresa'}</span>
                      </div>
                    ) : (
                      <div className="origem-frete-tag alerta">
                        ⚠️ <span><strong>Atenção:</strong> Endereço da Empresa/Estoque não cadastrado em Configurações &gt; Empresa</span>
                      </div>
                    );
                  })()}

                  {/* PAINEL RETRÁTIL DE AJUSTE RÁPIDO DO VEÍCULO & GASOLINA */}
                  {mostrarAjusteFrete && (
                    <div className="painel-ajuste-veiculo">
                      <div className="grid-ajuste-veiculo">
                        <div className="ajuste-campo">
                          <label>🚗 Veículo & Consumo</label>
                          <select
                            value={paramFrete.veiculo}
                            onChange={(e) => {
                              const v = e.target.value;
                              const consumos = { '1.0': '12.0', '1.6': '9.5', '2.0': '7.5', 'fiorino': '6.5', 'caminhao': '4.5' };
                              setParamFrete(prev => ({
                                ...prev,
                                veiculo: v,
                                consumoKmL: consumos[v] || prev.consumoKmL
                              }));
                            }}
                          >
                            <option value="1.0">🚗 Carro 1.0 (12 km/l)</option>
                            <option value="1.6">🚗 Carro 1.4 / 1.6 (9.5 km/l)</option>
                            <option value="2.0">🚙 Carro 2.0 / SUV (7.5 km/l)</option>
                            <option value="fiorino">🚐 Fiorino / Van (6.5 km/l)</option>
                            <option value="caminhao">🚛 Caminhão (4.5 km/l)</option>
                          </select>
                        </div>

                        <div className="ajuste-campo">
                          <label>⛽ Tipo de Combustível</label>
                          <select
                            value={paramFrete.tipoCombustivel || 'gasolina'}
                            onChange={(e) => {
                              const tipo = e.target.value;
                              const precosSugeridos = {
                                gasolina: '5.90',
                                alcool: '3.85',
                                gasolina_aditivada: '6.25',
                                diesel: '6.10',
                                gnv: '4.80'
                              };
                              setParamFrete(prev => ({
                                ...prev,
                                tipoCombustivel: tipo,
                                precoGasolina: precosSugeridos[tipo] || prev.precoGasolina
                              }));
                            }}
                          >
                            <option value="gasolina">⛽ Gasolina Comum</option>
                            <option value="alcool">⚡ Etanol / Álcool</option>
                            <option value="gasolina_aditivada">🚀 Gasolina Aditivada</option>
                            <option value="diesel">🛢️ Diesel S10</option>
                            <option value="gnv">💨 GNV (Gás Natural)</option>
                          </select>
                        </div>

                        <div className="ajuste-campo">
                          <label>
                            {paramFrete.tipoCombustivel === 'alcool' 
                              ? '⚡ Preço Etanol (R$/L)' 
                              : paramFrete.tipoCombustivel === 'gasolina_aditivada' 
                              ? '🚀 Gas. Aditivada (R$/L)' 
                              : paramFrete.tipoCombustivel === 'diesel' 
                              ? '🛢️ Preço Diesel (R$/L)' 
                              : paramFrete.tipoCombustivel === 'gnv' 
                              ? '💨 Preço GNV (R$/m³)' 
                              : '⛽ Preço Gasolina (R$/L)'}
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            value={paramFrete.precoGasolina}
                            onChange={(e) => setParamFrete(prev => ({ ...prev, precoGasolina: e.target.value }))}
                          />
                        </div>

                        <div className="ajuste-campo">
                          <label>🔁 Trajetos</label>
                          <select
                            value={paramFrete.viagens}
                            onChange={(e) => setParamFrete(prev => ({ ...prev, viagens: e.target.value }))}
                          >
                            <option value="4">🔁 4 Viagens (Levar + Buscar)</option>
                            <option value="2">➡️ 2 Viagens (Apenas Entrega)</option>
                          </select>
                        </div>

                        <div className="ajuste-campo">
                          <label>🛠️ Desgaste (R$/km)</label>
                          <input
                            type="number"
                            step="0.10"
                            value={paramFrete.custoAdicionalKm}
                            onChange={(e) => setParamFrete(prev => ({ ...prev, custoAdicionalKm: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GRID PRINCIPAL: DISTÂNCIA KM + BOTÃO CALCULAR AUTOMÁTICO */}
                  <div className="grid-frete-controles">
                    <div className="form-group-km">
                      <label>📏 Distância do Trajeto (KM Ida)</label>
                      <div className="input-km-wrapper">
                        <input 
                          type="number" 
                          min="0"
                          step="0.1"
                          placeholder="Ex: 15.5" 
                          value={kmDistancia} 
                          onChange={e => setKmDistancia(e.target.value)}
                          className="input-km-distancia"
                        />
                        <span className="unidade-km-badge">km</span>
                        {kmDistancia && (
                          <button
                            type="button"
                            onClick={() => setKmDistancia('')}
                            className="btn-limpar-km"
                            title="Limpar KM"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="botoes-rota-acoes">
                      <button
                        type="button"
                        onClick={() => calcularDistanciaAutomatica(null, true)}
                        disabled={calculandoDistancia}
                        className="btn-calcular-distancia-main"
                      >
                        {calculandoDistancia ? (
                          <><i className="fas fa-spinner fa-spin"></i> Calculando Rota...</>
                        ) : (
                          <><i className="fas fa-route"></i> Calcular Rota Automática</>
                        )}
                      </button>

                      {infoRota?.mapsUrl && (
                        <a
                          href={infoRota.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-abrir-maps-link"
                        >
                          <i className="fas fa-external-link-alt"></i> Maps
                        </a>
                      )}
                    </div>
                  </div>

                  {/* RESULTADO CALCULADO COM MEMÓRIA DE CÁLCULO E BOTÕES DE APLICAÇÃO */}
                  {(() => {
                    const est = calcularFreteEstimado(kmDistancia);
                    if (!kmDistancia || est.freteTotal <= 0) return null;

                    const freteFormatado = est.freteTotal.toFixed(2).replace('.', ',');
                    const freteNum = getFreteNumerico();
                    const jaAplicado = Math.abs(freteNum - est.freteTotal) < 0.01;

                    const nomeVeiculo = {
                      '1.0': 'Carro 1.0 (12 km/l)',
                      '1.6': 'Carro 1.4 / 1.6 (9.5 km/l)',
                      '2.0': 'Carro 2.0 / SUV (7.5 km/l)',
                      'fiorino': 'Fiorino / Van (6.5 km/l)',
                      'caminhao': 'Caminhão (4.5 km/l)'
                    }[paramFrete.veiculo] || 'Veículo';

                    const labelCombustivel = {
                      gasolina: 'Gasolina',
                      alcool: 'Etanol/Álcool',
                      gasolina_aditivada: 'Gas. Aditivada',
                      diesel: 'Diesel',
                      gnv: 'GNV'
                    }[paramFrete.tipoCombustivel] || 'Gasolina';

                    return (
                      <div className="card-resultado-frete">
                        {infoRota?.oficialGoogle && (
                          <div style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.74rem',
                            color: '#1e40af',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontWeight: '700'
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fab fa-google" style={{ color: '#2563eb' }}></i>
                              Rota Oficial Google Maps (Porta a Porta)
                            </span>
                            {infoRota.duracaoTexto && (
                              <span style={{ color: '#3b82f6', fontWeight: '800' }}>
                                ⏱️ ~{infoRota.duracaoTexto}
                              </span>
                            )}
                          </div>
                        )}
                        {infoRota?.numeroNaoMapeado && (
                          <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '0.74rem',
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                            <div>
                              <strong>Numeração específica (Nº {infoRota.numeroDigitado}) não localizada no mapa desta rua:</strong> A distância foi estimada pelo início/centro da via. Confira a rota no botão <strong>Maps</strong>.
                            </div>
                          </div>
                        )}
                        <div className="resultado-frete-topo">
                          <div className="resultado-frete-destaque">
                            <span className="badge-veiculo-info">
                              {kmDistancia} km · {nomeVeiculo} · {labelCombustivel} · {est.viagens} viagens
                            </span>
                            <div className="resultado-frete-valor">
                              R$ {freteFormatado}
                            </div>
                          </div>

                          <div className="resultado-frete-botoes">
                            <button
                              type="button"
                              onClick={() => {
                                setLogistica(prev => ({ ...prev, tipo: 'entrega', frete: freteFormatado }));
                              }}
                              className={`btn-aplicar-frete ${jaAplicado ? 'ja-aplicado' : ''}`}
                            >
                              {jaAplicado ? (
                                <><i className="fas fa-check-circle"></i> Frete Aplicado ao Pedido</>
                              ) : (
                                <><i className="fas fa-plus-circle"></i> Aplicar ao Pedido (R$ {freteFormatado})</>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setLogistica(prev => ({ ...prev, frete: '' }))}
                              className="btn-frete-gratis"
                              title="Remover frete e zerar valor"
                            >
                              Zerar Frete
                            </button>
                          </div>
                        </div>

                        <div className="box-memoria-calculo">
                          <span>⛽ {labelCombustivel}: <strong>R$ {est.custoGasolina.toFixed(2)}</strong></span>
                          <span>🛠️ Desgaste: <strong>R$ {est.custoDesgaste.toFixed(2)}</strong></span>
                          <span>📊 Taxa Média: <strong>~R$ {est.taxaEfetivaKm}/km</strong></span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            ) : (
              <p className="texto-aviso-logistica mt-15">⚠️ O cliente fará a retirada e devolução dos itens diretamente no local.</p>
            )}
          </div>

          <div className="card-secao">
            <div className="header-com-botoes">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>📦 ITENS DO PEDIDO</h3>
              {carrinho.length > 0 && (
                <div className="botoes-acoes-itens">
                  <button type="button" className="btn-destaque-adc-pecas" onClick={abrirCatalogo}>
                    ✨ + Adicionar Mais Peças
                  </button>
                </div>
              )}
            </div>

            <div className="carrinho-container mt-15">
              {/* 🚨 ALERTA DE CONFLITO DE AGENDA / SOBRELOCAÇÃO EM TEMPO REAL (APENAS PEÇAS FÍSICAS) */}
              {(() => {
                const itensConflito = carrinho
                  .filter(item => !item.isDebitoAnterior && !item.isTaxa && !item.isServico)
                  .map(item => {
                    const disp = getDisponibilidade(item.id);
                    const qtdPedida = Number(item.qtd) || 1;
                    const falta = Math.max(0, qtdPedida - disp.livresReais);
                    return { item, disp, qtdPedida, falta, temConflito: falta > 0 };
                  }).filter(c => c.temConflito);

                if (itensConflito.length === 0) return null;

                return (
                  <div style={{
                    background: '#fff1f2',
                    border: '2px solid #fecdd3',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '16px',
                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: '850', fontSize: '0.92rem' }}>
                      <span>🚨 ALERTA: CONFLITO DE AGENDA / SOBRELOCAÇÃO!</span>
                    </div>
                    <p style={{ margin: '6px 0 10px 0', fontSize: '0.8rem', color: '#881337', lineHeight: '1.4' }}>
                      As seguintes peças <strong>não possuem estoque livre suficiente</strong> para o período de <strong>{datas.retirada ? new Date(datas.retirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'retirada'}</strong> até <strong>{datas.devolucao ? new Date(datas.devolucao + 'T12:00:00').toLocaleDateString('pt-BR') : 'devolução'}</strong>:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {itensConflito.map(({ item, disp, qtdPedida, falta }, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecdd3', fontSize: '0.78rem' }}>
                          <div>
                            <strong style={{ color: '#be123c' }}>{item.nome}</strong> · Solicitado: <strong>{qtdPedida} un</strong> | Livre no período: <strong style={{ color: '#059669' }}>{disp.livresReais} un</strong> (<span style={{ color: '#dc2626', fontWeight: 'bold' }}>Faltam {falta} un</span>)
                          </div>
                          <button
                            type="button"
                            onClick={() => dispararCompraAutomatica(item)}
                            style={{ background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            🛒 Pedir Reposição (+{falta})
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {carrinho.length === 0 ? (
                <div className="carrinho-vazio-destaque" onClick={abrirCatalogo}>
                  <div className="vazio-icone">🛍️</div>
                  <div className="vazio-texto">
                    <strong>Nenhuma peça adicionada ao pedido ainda</strong>
                    <p>Clique no botão abaixo para abrir o catálogo e selecionar mesas, painéis, louças e suportes.</p>
                  </div>
                  <button type="button" className="btn-vazio-abrir-catalogo">
                    ✨ + Adicionar Peças do Acervo
                  </button>
                </div>
              ) : (
                <div style={{overflowX: 'auto'}}>
                  {carrinho.filter(i => !i.isDebitoAnterior).length === 0 && (
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', color: '#475569', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>💡</span>
                      <span><strong>Débito anterior incorporado!</strong> Agora adicione as peças da nova locação clicando no botão <strong>"+ Adicionar Mais Peças"</strong> acima.</span>
                    </div>
                  )}
                    <table style={{width: '100%', borderCollapse: 'collapse', minWidth: '500px'}}>
                      <thead>
                        <tr style={{borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left'}}>
                          <th style={{padding: '12px 10px', width: '50%'}}>Produto</th>
                          <th style={{padding: '12px 10px', textAlign: 'center', width: '20%'}}>Quantidade</th>
                          <th style={{padding: '12px 10px', textAlign: 'right', width: '20%'}}>Total</th>
                          <th style={{padding: '12px 10px', width: '10%'}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {carrinho.map(item => {
                          if (item.isDebitoAnterior) {
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid #fee2e2', background: '#fff1f2', transition: '0.2s' }}>
                                <td style={{ padding: '12px 10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '45px', height: '45px', backgroundColor: '#fee2e2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, border: '1px solid #fecdd3' }}>
                                      💳
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ background: '#dc2626', color: '#ffffff', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '850', width: 'fit-content', marginBottom: '3px' }}>
                                        REGULARIZAÇÃO DE DÉBITO ANTERIOR
                                      </span>
                                      <strong style={{ color: '#991b1b', fontSize: '14px' }}>
                                        {item.nome}
                                      </strong>
                                      <span style={{ color: '#b91c1c', fontSize: '11px', marginTop: '2px' }}>Soma unificada para quitação conjunta nesta locação</span>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                  <span style={{ background: '#fecdd3', color: '#9f1239', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '850' }}>
                                    1 un. (Fixo)
                                  </span>
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '900', color: '#dc2626', fontSize: '14px' }}>
                                  + R$ {Number(item.preco).toFixed(2)}
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                  <button 
                                    type="button" 
                                    onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))} 
                                    style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px' }}
                                    title="Remover Acréscimo do Débito"
                                  >
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          const isDeco = item.isDecoracao || item.especificacoes?.isDecoracao || item.categoria === 'Decoração Completa' || item.tipoCadastro === 'decoracao';
                          const pecasCompostas = item.itensDecoracao || item.itensDoKit || item.especificacoes?.itensDecoracao || item.especificacoes?.itensDoKit || [];

                          return (
                            <tr key={item.id} style={{borderBottom: '1px solid #f1f5f9', transition: '0.2s'}}>
                              <td style={{padding: '12px 10px'}}>
                                 <div style={{display: 'flex', alignItems: 'flex-start', gap: '15px'}}>
                                    <div style={{width: '45px', height: '45px', backgroundColor: '#f8fafc', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px'}}>
                                        {item.foto ? <img src={item.foto} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <span style={{fontSize:'20px'}}>📷</span>}
                                    </div>
                                    <div style={{display: 'flex', flexDirection: 'column'}}>
                                       {isDeco && (
                                         <span style={{ background: '#0f172a', color: '#fde68a', border: '1px solid #c5a059', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '800', width: 'fit-content', marginBottom: '2px' }}>
                                           ✨ DECORAÇÃO COMPLETA
                                         </span>
                                       )}
                                       <strong style={{color: '#0f172a', fontSize: '14px'}}>
                                          {item.nome}
                                          {item.isBateVolta && <span style={{color: '#f59e0b', fontSize: '10px', marginLeft: '6px', background: '#fef3c7', padding: '2px 4px', borderRadius: '4px'}}>⚠️ Bate e Volta</span>}
                                       </strong>
                                       <span style={{color: '#64748b', fontSize: '12px'}}>R$ {Number(item.preco).toFixed(2)} un.</span>

                                       {/* 🧩 COMPOSIÇÃO DA DECORAÇÃO */}
                                       {isDeco && pecasCompostas.length > 0 && (
                                         <div style={{ marginTop: '6px', borderLeft: '2.5px solid #c5a059', paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                           <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#b45309' }}>
                                             🧩 Peças que compõem este tema:
                                           </span>
                                           {pecasCompostas.map((p, idx) => (
                                             <span key={idx} style={{ fontSize: '0.74rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                               • <strong>{(Number(p.qtd) || 1) * (Number(item.qtd) || 1)}x</strong> {p.nome}
                                             </span>
                                           ))}
                                         </div>
                                       )}
                                       
                                       {item.isPendenteCompra ? (
                                          <span style={{color: '#d97706', fontSize: '10px', fontWeight: 'bold', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', width: 'max-content', marginTop: '4px'}}>⏳ COMPRA PENDENTE</span> 
                                       ) : (
                                          <span style={{color: '#10b981', fontSize: '10px', fontWeight: 'bold', marginTop: '4px'}}>📦 Confirmado!</span>
                                       )}
                                    </div>
                                 </div>
                              </td>
                            <td style={{padding: '12px 10px', textAlign: 'center'}}>
                              <div style={{display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                <button 
                                  type="button" 
                                  onClick={() => handleChangeQtdCarrinho(item.id, (Number(item.qtd) || 1) - 1)} 
                                  style={{width: '28px', height: '28px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#0f172a'}}
                                >
                                  -
                                </button>
                                
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={item.qtd} 
                                  onChange={(e) => handleChangeQtdCarrinho(item.id, e.target.value)} 
                                  onBlur={(e) => { 
                                    if (!e.target.value || parseInt(e.target.value) < 1) handleChangeQtdCarrinho(item.id, 1);
                                  }} 
                                  style={{width: '40px', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '14px', color: '#0f172a', appearance: 'textfield'}} 
                                />
                                
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    if (item.isPendenteCompra) {
                                        handleChangeQtdCarrinho(item.id, (Number(item.qtd) || 1) + 1);
                                    } else {
                                        const disp = getDisponibilidade(item.id);
                                        if ((Number(item.qtd) || 1) >= disp.livresMaximos) {
                                            alert(`⚠️ LIMITE ATINGIDO!\nVocê possui apenas ${disp.livresMaximos} unidade(s) livre(s) de "${item.nome}".`);
                                            dispararCompraAutomatica(item);
                                        } else {
                                            handleChangeQtdCarrinho(item.id, (Number(item.qtd) || 1) + 1);
                                        }
                                    }
                                  }} 
                                  style={{width: '28px', height: '28px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#0f172a'}}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td style={{padding: '12px 10px', textAlign: 'right'}}>
                              <strong style={{color: '#0f172a', fontSize: '15px'}}>R$ {(item.preco * (Number(item.qtd) || 1)).toFixed(2)}</strong>
                            </td>
                            <td style={{padding: '12px 10px', textAlign: 'center'}}>
                              <button 
                                type="button" 
                                className="btn-remover-item" 
                                onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))} 
                                style={{background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s'}} 
                                onMouseEnter={e => e.currentTarget.style.background = '#fca5a5'} 
                                onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                </div>
              )}
            </div>

            {/* 🛒 RODAPÉ COM OPÇÃO DISCRETA DE COMPRAR PEÇA EM FALTA */}
            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--borda, #f1f5f9)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-link-comprar-opcional" 
                onClick={() => { 
                  const clienteObj = clientes.find(c => String(c.id) === String(clienteSelecionado));
                  const nomeCli = clienteObj ? (clienteObj.nome || clienteObj.nomeFantasia || clienteObj.razaoSocial || '') : (clienteSelecionado || 'Cliente em Atendimento');
                  const url = `/compras/nova?clienteNome=${encodeURIComponent(nomeCli)}&temaFesta=${encodeURIComponent(temaFesta || '')}&dataRetirada=${encodeURIComponent(datas.retirada || '')}`;
                  window.open(url, '_blank');
                }}
                title="Faltou alguma peça no acervo? Solicite a compra para o setor de compras"
              >
                🛒 Faltou alguma peça no acervo? (Comprar)
              </button>
            </div>
          </div>

          <div className="card-secao">
            <h3 className="section-divider">🔒 OBSERVAÇÕES INTERNAS</h3>
            <div className="form-group">
              <textarea 
                rows="2" 
                placeholder="Anotações para a equipe (Ex: Verificar estado da mesa na volta...)" 
                value={obsInternas} 
                onChange={e => setObsInternas(e.target.value)}
              ></textarea>
            </div>
          </div>

        </div>

        <aside className="coluna-financeiro">
          <div className="card-financeiro-sticky">
            <div className="header-resumo-financeiro">
              <h3>💰 Resumo Financeiro</h3>
            </div>

            <div className="fin-corpo">
              <div className="fin-linha">
                <span>Subtotal Itens</span> 
                <strong>R$ {calcularTotal().subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>

              <div className="fin-linha">
                <span>Frete / Logística</span> 
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: getFreteNumerico() > 0 ? '#0f172a' : '#64748b' }}>
                    {getFreteNumerico() > 0 ? `+ R$ ${getFreteNumerico().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Grátis / Balcão'}
                  </strong>
                  {getFreteNumerico() > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setLogistica(prev => ({ ...prev, frete: '' }))}
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}
                      title="Remover / Zerar Frete"
                    >
                      <i className="fas fa-times-circle"></i>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="fin-linha desconto-linha">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '700' }}>Desconto</span>
                  <div className="tipo-desconto-toggle">
                    <button 
                      type="button" 
                      className={tipoDesconto === 'R$' ? 'active' : ''}
                      onClick={() => setTipoDesconto('R$')}
                    >
                      R$
                    </button>
                    <button 
                      type="button" 
                      className={tipoDesconto === '%' ? 'active' : ''}
                      onClick={() => setTipoDesconto('%')}
                    >
                      %
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input 
                    type="number" 
                    min="0" 
                    max={tipoDesconto === '%' ? 100 : undefined}
                    step={tipoDesconto === '%' ? '1' : '0.01'}
                    value={desconto} 
                    onChange={e => setDesconto(e.target.value)} 
                    className="input-desconto-fin"
                    placeholder={tipoDesconto === 'R$' ? '0,00' : '0%'}
                  />
                </div>
              </div>

              {tipoDesconto === '%' && Number(desconto) > 0 && (
                <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: '750', textAlign: 'right', marginTop: '-4px' }}>
                  - R$ {calcularTotal().valorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({desconto}% desc.)
                </div>
              )}

              {/* 📊 TERMÔMETRO DE MARGEM COMERCIAL (EXIBE APENAS QUANDO HÁ ITENS NO PEDIDO) */}
              {(() => {
                const tot = calcularTotal();
                const sub = tot.subtotal;
                if (!sub || sub <= 0) return null;

                const desc = tot.valorDesconto;
                const margem = ((sub - desc) / sub) * 100;
                let statusCor = '#16a34a';
                let statusTxt = 'Margem Saudável';
                if (margem < 80 && margem >= 65) {
                  statusCor = '#d97706';
                  statusTxt = 'Margem Moderada';
                } else if (margem < 65) {
                  statusCor = '#dc2626';
                  statusTxt = 'Desconto Alto';
                }

                return (
                  <div className="box-margem-comercial" style={{ borderColor: `${statusCor}40` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: statusCor, fontSize: '0.74rem' }}>
                      <span>Margem: {margem.toFixed(0)}%</span>
                      <span>● {statusTxt}</span>
                    </div>
                  </div>
                );
              })()}
              
              <div className="fin-linha-total">
                <span>VALOR TOTAL</span>
                <strong>R$ {calcularTotal().total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            </div>
            
            <div className="fin-acoes">
              <button type="button" className="btn-confirmar-pedido" onClick={() => interceptarSalvamento('confirmado')}>
                <i className="fas fa-check-circle"></i> CONFIRMAR PEDIDO
              </button>
              <button type="button" className="btn-salvar-orcamento" onClick={() => interceptarSalvamento('orcamento')}>
                <i className="fas fa-file-invoice-dollar"></i> Salvar como Orçamento
              </button>
            </div>
          </div>
        </aside>
      </div>

      {modalSinalAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 99999 }}>
          <div className="modal-box-premium" style={{ maxWidth: '540px', background: '#ffffff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)', border: '1px solid #e2e8f0' }}>
            
            {/* CABEÇALHO DOURADO LUXO */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '22px 28px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '850', color: '#ffffff' }}>💰 Confirmação de Pedido & Sinal</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Escolha como registrar a entrada para garantir a reserva</p>
              </div>
              <button 
                type="button" 
                onClick={() => setModalSinalAberto(false)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px 28px' }}>
              
              {/* CARD DE VALOR TOTAL */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VALOR TOTAL DO PEDIDO</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                    R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '800' }}>SINAL RÁPIDO:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button" 
                      onClick={() => setValorSinal((calcularTotal().total * 0.5).toFixed(2).replace('.', ','))}
                      style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '850', cursor: 'pointer' }}
                    >
                      50% Sinal
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setValorSinal(calcularTotal().total.toFixed(2).replace('.', ','))}
                      style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '850', cursor: 'pointer' }}
                    >
                      100% Total
                    </button>
                  </div>
                </div>
              </div>

              {/* CAMPOS DE VALOR E FORMA DE PAGAMENTO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Valor da Entrada (R$)</label>
                  <input 
                    type="text" 
                    placeholder="0,00" 
                    autoFocus 
                    value={valorSinal} 
                    onChange={e => setValorSinal(maskCurrency(e.target.value))} 
                    style={{ fontSize: '1.2rem', padding: '12px', textAlign: 'center', borderColor: '#c5a059', color: '#0f172a', fontWeight: '850', borderRadius: '12px', background: '#ffffff' }}
                  />
                </div>
                
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Forma de Pagto.</label>
                  <select 
                    value={formaPagtoSinal} 
                    onChange={e => setFormaPagtoSinal(e.target.value)} 
                    style={{ padding: '12px', fontSize: '0.88rem', borderRadius: '12px', borderColor: '#cbd5e1', fontWeight: '700', background: '#ffffff' }}
                  >
                    <option value="Pix">📱 Pix Direto</option>
                    <option value="Mercado Pago">✨ Link Mercado Pago</option>
                    <option value="Dinheiro">💵 Dinheiro no Balcão</option>
                    <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                    <option value="Cartão de Débito">💳 Cartão de Débito</option>
                  </select>
                </div>
              </div>

              {/* ÁREA INTEGRADA MERCADO PAGO */}
              <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '16px', padding: '14px 16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>💳</span>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0369a1', display: 'block' }}>Link / Cobrança Mercado Pago & Pix</strong>
                      <span style={{ fontSize: '0.72rem', color: '#0284c7' }}>Gere a cobrança ou cole o link para enviar no WhatsApp</span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={gerarLinkMercadoPago}
                    disabled={gerandoLinkMP}
                    style={{ background: 'linear-gradient(135deg, #009ee3 0%, #0072bb 100%)', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '850', fontSize: '0.78rem', cursor: gerandoLinkMP ? 'not-allowed' : 'pointer', boxShadow: '0 4px 10px rgba(0,158,227,0.3)', whiteSpace: 'nowrap' }}
                  >
                    {gerandoLinkMP ? '⏳ Gerando...' : '⚡ Gerar Cobrança'}
                  </button>
                </div>

                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #7dd3fc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: '800' }}>Link de Pagamento / Chave Pix:</label>
                  <input 
                    type="text" 
                    value={linkMercadoPago} 
                    onChange={e => setLinkMercadoPago(e.target.value)} 
                    placeholder="Cole seu link do Mercado Pago ou Chave Pix..." 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #7dd3fc', fontSize: '0.82rem', color: '#0f172a', fontWeight: '600', background: '#ffffff' }}
                  />
                  {linkMercadoPago && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button 
                        type="button" 
                        onClick={() => { navigator.clipboard.writeText(linkMercadoPago); alert("✅ Link de cobrança copiado!"); }}
                        style={{ flex: 1, padding: '8px', background: '#ffffff', border: '1px solid #38bdf8', color: '#0284c7', borderRadius: '8px', fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        📋 Copiar Link
                      </button>
                      <button 
                        type="button" 
                        onClick={abrirWhatsAppCobranca}
                        style={{ flex: 1, padding: '8px', background: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '850', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        📱 Enviar no WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTOES DE ACAO DO PEDIDO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Number(valorSinal.replace(/\./g, "").replace(",", ".")) > 0 ? (
                  <>
                    <button 
                      type="button" 
                      onClick={salvarSinalRecebido} 
                      disabled={salvandoPedido} 
                      style={{ padding: '14px', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', border: 'none', borderRadius: '12px', color: '#ffffff', fontWeight: '850', fontSize: '0.9rem', cursor: salvandoPedido ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(197, 160, 89, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {salvandoPedido ? 'Salvando...' : '✅ O CLIENTE JÁ PAGOU (Confirmar e Registrar Caixa)'}
                    </button>

                    <button 
                      type="button" 
                      onClick={salvarAguardandoPagamento} 
                      disabled={salvandoPedido} 
                      style={{ padding: '12px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', color: '#0f172a', fontWeight: '800', fontSize: '0.84rem', cursor: salvandoPedido ? 'not-allowed' : 'pointer' }}
                    >
                      {salvandoPedido ? 'Salvando...' : '⏳ AINDA VAI PAGAR (Manter Orçamento / Baixa Automática)'}
                    </button>
                  </>
                ) : (
                  <button 
                    type="button" 
                    onClick={salvarSemSinal} 
                    disabled={salvandoPedido} 
                    style={{ padding: '14px', background: '#ef4444', border: 'none', borderRadius: '12px', color: '#ffffff', fontWeight: '850', fontSize: '0.88rem', cursor: salvandoPedido ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {salvandoPedido ? 'Salvando...' : '⚠️ Aprovar Pedido SEM RECEBER SINAL (Risco)'}
                  </button>
                )}

                <button 
                  type="button" 
                  onClick={() => setModalSinalAberto(false)} 
                  style={{ padding: '8px', background: 'transparent', border: 'none', color: '#64748b', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancelar e Voltar
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CATÁLOGO DE PEÇAS */}
      {modalAberto && (
        <div className="modal-overlay-premium">
          <div className="modal-box-premium catalogo-modal">
            <div className="modal-header">
              <h3>📦 Catálogo de Peças</h3>
              <button className="btn-fechar" onClick={() => setModalAberto(false)}>X</button>
            </div>
            
            {(() => {
              const totalDecoracoes = estoque.filter(i => i.especificacoes?.isDecoracao || i.categoria === 'Decoração Completa' || i.tipoCadastro === 'decoracao').length;
              const totalAvulsos = estoque.length - totalDecoracoes;

              const getIconeCategoria = (nomeCat) => {
                const n = (nomeCat || '').toLowerCase();
                if (n === 'todos') return '📦';
                if (n.includes('decora') || n.includes('kit') || n.includes('tema')) return '✨';
                if (n.includes('vaso') || n.includes('planta') || n.includes('flor')) return '🪴';
                if (n.includes('prato') || n.includes('louça') || n.includes('utensíl') || n.includes('talher')) return '🎂';
                if (n.includes('móvel') || n.includes('movel') || n.includes('mesa') || n.includes('cadeira') || n.includes('painel')) return '🪑';
                if (n.includes('luz') || n.includes('ilumina') || n.includes('letreiro') || n.includes('neon')) return '💡';
                if (n.includes('suporte') || n.includes('bandeja') || n.includes('boleira')) return '🧁';
                if (n.includes('pelúcia') || n.includes('pelucia') || n.includes('boneco') || n.includes('display')) return '🧸';
                return '🏷️';
              };

              const categoriasNominais = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];
              const categoriasComContagem = categoriasNominais.map(cat => {
                const qtd = cat === 'Todos' 
                  ? estoque.length 
                  : estoque.filter(i => i.categoria === cat).length;
                return { nome: cat, qtd, icone: getIconeCategoria(cat) };
              });

              const itensFiltradosCalculados = estoque
                .filter(item => {
                  const isDeco = item.especificacoes?.isDecoracao || item.categoria === 'Decoração Completa' || item.tipoCadastro === 'decoracao';

                  // 1. Filtro por Tipo (Todos, Decorações, Avulsos)
                  if (filtroTipo === 'decoracao' && !isDeco) return false;
                  if (filtroTipo === 'avulso' && isDeco) return false;

                  // 2. Filtro por Categoria
                  if (filtroCategoria !== 'Todos' && item.categoria !== filtroCategoria) return false;

                  // 3. Filtro de Apenas Disponíveis na Data do Evento
                  const disp = getDisponibilidade(item.id);
                  if (apenasDisponiveis && disp.livresMaximos <= 0) return false;

                  // 4. Busca por Texto Inteligente
                  if (busca.trim()) {
                    const termo = busca.toLowerCase().trim();
                    const nomeMatch = (item.nome || '').toLowerCase().includes(termo);
                    const codigoMatch = (item.codigo || '').toLowerCase().includes(termo);
                    const catMatch = (item.categoria || '').toLowerCase().includes(termo);
                    const pecasCompostas = item.especificacoes?.itensDecoracao || item.especificacoes?.itensDoKit || item.itensDecoracao || item.itensDoKit || [];
                    const composicaoMatch = pecasCompostas.some(p => (p.nome || '').toLowerCase().includes(termo));

                    if (!nomeMatch && !codigoMatch && !catMatch && !composicaoMatch) return false;
                  }

                  return true;
                });

              return (
                <>
                  {/* BARRA DE BUSCA E FILTROS ULTRA-CLEAN EM UMA ÚNICA LINHA */}
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    
                    {/* INPUT DE BUSCA */}
                    <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94a3b8' }}>🔎</span>
                      <input 
                        type="text" 
                        placeholder="Buscar peça por nome, código ou tema..." 
                        value={busca} 
                        onChange={e => setBusca(e.target.value)} 
                        style={{ width: '100%', padding: '8px 30px 8px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#ffffff', color: '#0f172a', fontWeight: '500' }}
                      />
                      {busca && (
                        <button 
                          type="button" 
                          onClick={() => setBusca('')}
                          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: '#e2e8f0', border: 'none', color: '#64748b', borderRadius: '50%', width: '20px', height: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* SELECT DE TIPO (TODOS, DECORAÇÕES, AVULSO) */}
                    <select 
                      value={filtroTipo} 
                      onChange={e => setFiltroTipo(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '600', color: '#334155', background: '#ffffff', cursor: 'pointer' }}
                    >
                      <option value="todos">📦 Todos os Tipos ({estoque.length})</option>
                      <option value="decoracao">✨ Decorações Completas ({totalDecoracoes})</option>
                      <option value="avulso">🧩 Peças Avulsas ({totalAvulsos})</option>
                    </select>

                    {/* SELECT DE CATEGORIA */}
                    <select 
                      value={filtroCategoria} 
                      onChange={e => setFiltroCategoria(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '600', color: '#334155', background: '#ffffff', cursor: 'pointer' }}
                    >
                      <option value="Todos">📁 Todas Categorias</option>
                      {categoriasNominais.filter(c => c !== 'Todos').map(cat => (
                        <option key={cat} value={cat}>
                          {cat} ({estoque.filter(i => i.categoria === cat).length})
                        </option>
                      ))}
                    </select>

                    {/* BOTÃO TOGGLE PILL - APENAS LIVRES */}
                    <button
                      type="button"
                      onClick={() => setApenasDisponiveis(prev => !prev)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: apenasDisponiveis ? '1px solid #16a34a' : '1px solid #cbd5e1',
                        background: apenasDisponiveis ? '#dcfce7' : '#ffffff',
                        color: apenasDisponiveis ? '#15803d' : '#64748b',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        transition: '0.2s'
                      }}
                    >
                      <span>{apenasDisponiveis ? '✅' : '⚡'}</span>
                      <span>Apenas Livres</span>
                    </button>

                    {/* BOTÃO LIMPAR SE HOUVER FILTRO ATIVO */}
                    {(busca || filtroCategoria !== 'Todos' || filtroTipo !== 'todos' || apenasDisponiveis) && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setBusca('');
                          setFiltroCategoria('Todos');
                          setFiltroTipo('todos');
                          setApenasDisponiveis(false);
                        }}
                        style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        🧹 Limpar
                      </button>
                    )}
                  </div>

                  {/* GRID DE CARDS DAS PEÇAS */}
                  <div className="catalogo-grid">
                    {itensFiltradosCalculados.map(item => {
                        const disp = getDisponibilidade(item.id);
                        const estaEsgotado = disp.livresMaximos <= 0;
                        const ehBateVolta = disp.livresReais <= 0 && disp.retornaNoDia > 0;
                        const isDeco = item.especificacoes?.isDecoracao || item.categoria === 'Decoração Completa' || item.tipoCadastro === 'decoracao';
                        const pecasCompostas = item.especificacoes?.itensDecoracao || item.especificacoes?.itensDoKit || item.itensDecoracao || item.itensDoKit || item.especificacoes?.pecasKit || [];

                        return (
                          <div 
                            key={item.id} 
                            className="peca-card" 
                            onClick={() => { if(!estaEsgotado) addCarrinho(item); }} 
                            style={{
                              opacity: estaEsgotado ? 0.5 : 1, 
                              cursor: estaEsgotado ? 'not-allowed' : 'pointer',
                              border: isDeco ? '1.5px solid #c5a059' : undefined,
                              boxShadow: isDeco ? '0 4px 14px rgba(197, 160, 89, 0.2)' : undefined
                            }}
                          >
                            <div className="peca-img" style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.foto ? (
                                    <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                ) : (
                                    <span style={{ fontSize: '32px' }}>📷</span>
                                )}
                                
                                {isDeco && (
                                  <span style={{ background: '#0f172a', color: '#fde68a', border: '1px solid #c5a059', padding: '3px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: '800', position: 'absolute', top: '8px', right: '8px', zIndex: 2 }}>
                                    ✨ DECORAÇÃO
                                  </span>
                                )}

                                {disp.emManutencao ? (
                                    <span style={{ ...badgeEsgotado, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>🛠️ MANUTENÇÃO</span>
                                ) : estaEsgotado ? (
                                    <span style={badgeEsgotado}>ALUGADO</span>
                                ) : ehBateVolta ? (
                                    <span style={badgeBateVolta}>⚠️ VOLTA NO DIA ({disp.livresMaximos})</span>
                                ) : (
                                   <span style={badgeLivres}>Livres: {disp.livresReais}</span>
                                )}

                                {!estaEsgotado && <button className="btn-add-peca" type="button">+</button>}
                            </div>
                            
                            <div className="peca-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{item.nome}</strong>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.categoria}</span>

                              {isDeco && pecasCompostas.length > 0 && (
                                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                                  <strong style={{ color: '#b45309', display: 'block', marginBottom: '2px', fontSize: '0.7rem' }}>🧩 Composição do Pacote:</strong>
                                  <div style={{ lineHeight: '1.3', color: '#334155' }}>
                                    {pecasCompostas.map(p => `${p.qtd || 1}x ${p.nome}`).join(' • ')}
                                  </div>
                                </div>
                              )}

                              <b className="txt-sucesso" style={{ marginTop: '4px' }}>R$ {item.financeiro?.valorAluguel || item.preco || 0}</b>
                            </div>
                          </div>
                        );
                    })}
                    {itensFiltradosCalculados.length === 0 && <p className="text-center w-100 mt-15" style={{color: 'var(--texto-secundario)'}}>Nenhuma peça encontrada para os filtros selecionados.</p>}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 📅 MODAL CALENDÁRIO DE DISPONIBILIDADE */}
      <ModalCalendarioDisponibilidade
        isOpen={modalCalendarioAberto}
        onClose={() => setModalCalendarioAberto(false)}
        estoque={estoque}
        locacoes={todasLocacoes}
      />

      {/* 👤 MODAL NOVO CLIENTE RÁPIDO */}
      {modalNovoClienteAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 99999 }}>
          <div className="modal-box-premium" style={{ maxWidth: '480px', background: '#ffffff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)', border: '1px solid #e2e8f0' }}>
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '20px 24px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '850', color: '#ffffff' }}>👤 Cadastro Rápido de Cliente</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Cadastre e selecione no pedido instantaneamente</p>
              </div>
              <button 
                type="button" 
                onClick={() => setModalNovoClienteAberto(false)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarNovoClienteRapido} style={{ padding: '20px 24px' }}>
              <div className="form-group mb-12">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b' }}>Nome Completo *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Maria das Graças Silva"
                  value={formNovoCliente.nome}
                  onChange={e => setFormNovoCliente({ ...formNovoCliente, nome: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}
                  autoFocus
                />
              </div>

              <div className="form-group mb-12">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b' }}>WhatsApp / Celular *</label>
                <input 
                  type="text" 
                  required
                  placeholder="(00) 90000-0000"
                  value={formNovoCliente.celular}
                  onChange={e => setFormNovoCliente({ ...formNovoCliente, celular: e.target.value })}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}
                />
              </div>

              <div className="form-row mb-12">
                <div className="form-group flex-1">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b' }}>CPF / CNPJ (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00"
                    value={formNovoCliente.cpfCnpj}
                    onChange={e => setFormNovoCliente({ ...formNovoCliente, cpfCnpj: e.target.value })}
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}
                  />
                </div>
                <div className="form-group flex-1">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b' }}>E-mail (Opcional)</label>
                  <input 
                    type="email" 
                    placeholder="cliente@email.com"
                    value={formNovoCliente.email}
                    onChange={e => setFormNovoCliente({ ...formNovoCliente, email: e.target.value })}
                    style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button 
                  type="submit" 
                  disabled={salvandoNovoCliente}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: '850',
                    fontSize: '0.85rem',
                    cursor: salvandoNovoCliente ? 'not-allowed' : 'pointer'
                  }}
                >
                  {salvandoNovoCliente ? 'Cadastrando...' : '✔ Cadastrar e Selecionar'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setModalNovoClienteAberto(false)}
                  style={{
                    padding: '12px 18px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚨 MODAL DE TRAVA DE SEGURANÇA: CLIENTE COM PENDÊNCIAS EM NOVA LOCAÇÃO */}
      {modalTravaCliente && (
        <div className="modal-overlay-fin fade-in" onClick={() => setModalTravaCliente(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content-fin" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%', background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', borderTop: '6px solid #dc2626' }}>
            <div style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.6rem', color: '#dc2626' }}>🚨</span>
                <div>
                  <h3 style={{ color: '#991b1b', margin: 0, fontSize: '1.05rem', fontWeight: '900' }}>
                    TRAVA DE SEGURANÇA: CLIENTE COM PENDÊNCIAS!
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: '700' }}>
                    Alerta de restrição antes de formalizar novo pedido
                  </span>
                </div>
              </div>
              <button onClick={() => setModalTravaCliente(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#9f1239', lineHeight: '1.5' }}>
                  O(a) cliente <strong>{modalTravaCliente.cliente?.nome || modalTravaCliente.cliente?.nomeFantasia || 'Cliente'}</strong> possui <strong>débitos em aberto / pendências financeiras</strong> no valor acumulado de <strong style={{ color: '#e11d48', fontSize: '1rem' }}>R$ {modalTravaCliente.valorDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                </p>
              </div>

              {modalTravaCliente.pendencias && modalTravaCliente.pendencias.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: '850', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    📌 Pedidos com Saldo Devedor em Aberto:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                    {modalTravaCliente.pendencias.map(p => {
                      const vTotal = Number(p.valorTotal || p.total || 0);
                      const vPago = Number(p.valorPago || 0);
                      const saldo = vTotal - vPago;
                      const num = p.numeroPedido ? `#${p.numeroPedido}` : `#${p.id.slice(0, 6).toUpperCase()}`;
                      const dt = p.dataRetirada || p.dataEvento || '--/--/----';
                      return (
                        <div key={p.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Pedido {num}</strong>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Data: {dt} | Total: R$ {vTotal.toFixed(2)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.84rem', color: '#dc2626', fontWeight: '900' }}>R$ {saldo.toFixed(2)}</span>
                            <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: '800' }}>EM ABERTO</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={handleAutorizarESomarDebito}
                  style={{
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontWeight: '850',
                    fontSize: '0.86rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.28)'
                  }}
                >
                  <i className="fas fa-plus-circle" style={{ fontSize: '1rem' }}></i> 
                  Autorizar e SOMAR Débito Anterior (+ R$ {Number(modalTravaCliente.valorDevido || 0).toFixed(2)}) no Pedido
                </button>

                <button 
                  type="button" 
                  onClick={handleAutorizarSemSomar}
                  style={{
                    background: '#f59e0b',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '11px 16px',
                    fontWeight: '850',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  ⚠️ Autorizar Sem Somar (Cobrar Débito Separadamente)
                </button>

                <button 
                  type="button" 
                  onClick={() => {
                    setClienteSelecionado('');
                    setModalTravaCliente(null);
                  }}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    height: '40px',
                    fontWeight: '750',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  ❌ Cancelar / Trocar de Cliente
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NovaLocacao;