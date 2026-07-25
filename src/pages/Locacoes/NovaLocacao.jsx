import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NovaLocacao.css';
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, doc, getDoc, addDoc, getCountFromServer, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import { CATALOGO_TEMAS } from '../../catalogoDeTemas';

const NovaLocacao = () => {
  const navigate = useNavigate();
  
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🔥 IDENTIFICAÇÃO CORPORATIVA (A chave para puxar e salvar dados no cofre da empresa)
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);

  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [todasLocacoes, setTodasLocacoes] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [tipoServico, setTipoServico] = useState('PEGUE E MONTE');
  const [datas, setDatas] = useState({ retirada: '', devolucao: '' });
  
  const [categoriaTema, setCategoriaTema] = useState('');
  const [subcategoriaTema, setSubcategoriaTema] = useState('');
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');
  const [temaFesta, setTemaFesta] = useState('');
  const [temaDigitadoPersonalizado, setTemaDigitadoPersonalizado] = useState('');
  
  const [logistica, setLogistica] = useState({ 
    tipo: 'retirada', 
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
        
        setClientes(snapCli.docs.map(d => ({ id: d.id, ...d.data() })));
        setEstoque(snapEst.docs.map(d => ({ id: d.id, ...d.data() })));
        setTodasLocacoes(snapLoc.docs.map(d => ({ id: d.id, ...d.data() })));
        if (snapConf.exists()) setConfigEmpresa(snapConf.data());
      } catch (error) {
        console.error("Erro ao carregar:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [usuarioLogado, navigate, tenantId]);

  const categoriasUnicasEstoque = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];
  const categoriasDeTemaUnicas = Object.keys(CATALOGO_TEMAS);
  const subcategoriasDisponiveis = categoriaTema ? Object.keys(CATALOGO_TEMAS[categoriaTema] || {}) : [];
  const gruposDisponiveis = (categoriaTema && subcategoriaTema) ? Object.keys(CATALOGO_TEMAS[categoriaTema][subcategoriaTema] || {}) : [];
  const temasDisponiveis = (categoriaTema && subcategoriaTema && grupoTemaSelecionado) ? CATALOGO_TEMAS[categoriaTema][subcategoriaTema][grupoTemaSelecionado] || [] : [];

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
                      const itemNoPedido = loc.itens?.find(i => 
                        i.id === pecaId || 
                        (i.codigo && peca.codigo && i.codigo === peca.codigo) ||
                        (i.nome && peca.nome && i.nome.trim().toLowerCase() === peca.nome.trim().toLowerCase())
                      );
                      if (itemNoPedido) {
                          const qtdAlugada = parseInt(itemNoPedido.qtd) || parseInt(itemNoPedido.quantidade) || 1;
                          if (loc.dataDevolucao === datas.retirada) {
                              qtdRetornaNoDia += qtdAlugada;
                          } else {
                              qtdReservadaForte += qtdAlugada;
                          }
                      }
                  }
              }
          });
      }
      
      const livresReais = Math.max(0, disponiveisTotais - qtdReservadaForte - qtdRetornaNoDia);
      const livresMaximos = Math.max(0, disponiveisTotais - qtdReservadaForte);
      return { livresReais, livresMaximos, retornaNoDia: qtdRetornaNoDia };
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
          qtd: 1, 
          preco: precoItem, 
          foto: item.foto, 
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
    return Number(logistica.frete.toString().replace(/\./g, "").replace(",", "."));
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

  const interceptarSalvamento = (status) => {
    if (!clienteSelecionado) return alert("Selecione o Cliente!");
    
    if (temaFesta === 'OUTRO_TEMA' && !temaDigitadoPersonalizado) {
        return alert("Por favor, digite o nome do tema personalizado!");
    } else if (!temaFesta) {
        return alert("Selecione o Tema da Festa!");
    }

    if (!datas.retirada) return alert("Preencha a Data de Retirada!");
    if (!datas.devolucao) return alert("Preencha a Data de Devolução!");
    
    if (datas.devolucao && datas.retirada > datas.devolucao) {
        return alert("A data de devolução não pode ser menor que a data de retirada!");
    }
    
    if (carrinho.length === 0) return alert("Você precisa adicionar pelo menos 1 peça no pedido!");
    
    for (let item of carrinho) {
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
      const snap = await getCountFromServer(coll);
      const count = snap.data().count + 1;
      const codigo = `${new Date().getFullYear()}-${count.toString().padStart(3, '0')}`;

      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeClienteReal = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeFantasia || clienteEncontrado.razaoSocial || "Cliente") : "Cliente";
      const temaFinalParaSalvar = temaFesta === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : temaFesta;
      
      const docRef = await addDoc(coll, {
        numeroPedido: codigo, 
        clienteId: clienteSelecionado, 
        clienteNome: nomeClienteReal, 
        temaFesta: temaFinalParaSalvar, 
        tipoServico, 
        dataRetirada: datas.retirada, 
        dataDevolucao: datas.devolucao, 
        itens: carrinho, 
        logistica: { ...logistica, frete: getFreteNumerico() }, 
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
            categoria: 'Locação', 
            valor: valorRecebidoNoCaixa, 
            formaPagto: formaPagtoSinal,
            data: new Date().toISOString().split('T')[0], 
            status: 'pago', 
            createdAt: serverTimestamp(), 
            descricao: `SINAL - Pedido #${codigo} - ${nomeClienteReal}`,
            userId: tenantId // 🎯 SALVA VINCULADO À EMPRESA
        });
        
        await registrarLog("PAGAMENTO Lançado", `Registrou entrada financeira de R$ ${valorRecebidoNoCaixa.toFixed(2)} na criação do pedido.`, docRef.id, codigo);
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
        linkFinal = `https://link.mercadopago.com.br/sualoja?valor=${valorDigitadoNum.toFixed(2)}`;
      }

      setLinkMercadoPago(linkFinal);
      setFormaPagtoSinal('Mercado Pago');
      alert("✅ Cobrança gerada com sucesso! Você pode editar o link no campo abaixo se desejar.");

    } catch (e) {
      console.error("Erro MP Preference:", e);
      setLinkMercadoPago(`https://link.mercadopago.com.br/sualoja`);
      setFormaPagtoSinal('Mercado Pago');
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
                <button 
                  type="button" 
                  className={`btn-toggle ${tipoServico === 'PEGUE E MONTE' ? 'active-pegue' : ''}`} 
                  onClick={() => {
                    setTipoServico('PEGUE E MONTE');
                    setLogistica(prev => ({ ...prev, tipo: 'retirada', frete: '' }));
                  }}
                >
                  📦 PEGUE E MONTE
                </button>
                <button 
                  type="button" 
                  className={`btn-toggle ${tipoServico === 'DECORACAO COMPLETA' ? 'active-deco' : ''}`} 
                  onClick={() => {
                    setTipoServico('DECORACAO COMPLETA');
                    setLogistica(prev => ({ ...prev, tipo: 'entrega' }));
                  }}
                >
                  ✨ DECORAÇÃO COMPLETA
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label>Cliente *</label>
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)}>
                  <option value="" disabled hidden>Selecione um cliente cadastrado...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome || c.nomeFantasia || c.razaoSocial}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row mt-10">
                <div className="form-group flex-1">
                    <label>Categoria do Tema *</label>
                    <select value={categoriaTema} onChange={e => {
                        const novaCat = e.target.value;
                        setCategoriaTema(novaCat);
                        const subsDaCat = novaCat ? Object.keys(CATALOGO_TEMAS[novaCat] || {}) : [];
                        if (subsDaCat.length === 1) {
                            const unicaSub = subsDaCat[0];
                            setSubcategoriaTema(unicaSub);
                            const gruposDaSub = Object.keys(CATALOGO_TEMAS[novaCat][unicaSub] || {});
                            if (gruposDaSub.length === 1) setGrupoTemaSelecionado(gruposDaSub[0]);
                            else setGrupoTemaSelecionado('');
                        } else {
                            setSubcategoriaTema('');
                            setGrupoTemaSelecionado('');
                        }
                        setTemaFesta('');
                    }}>
                        <option value="" disabled hidden>Selecione a Categoria...</option>
                        {categoriasDeTemaUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
       
                <div className="form-group flex-1">
                    <label>Subcategoria do Tema *</label>
                    <select value={subcategoriaTema} onChange={e => {
                        const novaSub = e.target.value;
                        setSubcategoriaTema(novaSub);
                        const gruposDaSub = (categoriaTema && novaSub) ? Object.keys(CATALOGO_TEMAS[categoriaTema][novaSub] || {}) : [];
                        if (gruposDaSub.length === 1) setGrupoTemaSelecionado(gruposDaSub[0]);
                        else setGrupoTemaSelecionado('');
                        setTemaFesta('');
                    }} disabled={!categoriaTema || subcategoriasDisponiveis.length === 1}>
                        <option value="" disabled hidden>{!categoriaTema ? 'Escolha a Categoria antes...' : 'Selecione a Subcategoria...'}</option>
                        {subcategoriasDisponiveis.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-row mt-10">
              <div className="form-group flex-1">
                    <label>Grupo de Tema *</label>
                    <select value={grupoTemaSelecionado} onChange={e => {
                        setGrupoTemaSelecionado(e.target.value);
                        setTemaFesta('');
                    }} disabled={!subcategoriaTema || gruposDisponiveis.length === 1}>
                        <option value="" disabled hidden>{!subcategoriaTema ? 'Escolha a Subcategoria antes...' : 'Selecione o Grupo...'}</option>
                        {gruposDisponiveis.map(grupo => <option key={grupo} value={grupo}>{grupo}</option>)}
                    </select>
                </div>

                <div className="form-group flex-1">
                  <label>Tema Específico *</label>
                    <select value={temaFesta} onChange={e => setTemaFesta(e.target.value)} disabled={(!grupoTemaSelecionado && temaFesta !== 'OUTRO_TEMA')}>
                        <option value="" disabled hidden>{!grupoTemaSelecionado ? 'Escolha o Grupo antes...' : 'Selecione o Tema...'}</option>
                        {temasDisponiveis.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="OUTRO_TEMA" style={{fontWeight: 'bold', color: '#3b82f6'}}>✏️ Outro (Digitar Novo Tema)</option>
                    </select>
                </div>
            </div>

            {temaFesta === 'OUTRO_TEMA' && (
                <div className="form-row" style={{animation: 'fadeIn 0.3s'}}>
                    <div className="form-group flex-1" style={{background: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px dashed #3b82f6'}}>
                        <label style={{color: '#1d4ed8'}}>Digite o nome do novo tema *</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Bailarina Rosa com Ouro..." 
                          value={temaDigitadoPersonalizado} 
                          onChange={e => {
                            const val = e.target.value;
                            const formatado = val.replace(/(?:^|\s)\S/g, a => a.toUpperCase());
                            setTemaDigitadoPersonalizado(formatado);
                          }} 
                          autoCapitalize="words"
                          style={{borderColor: '#bfdbfe'}} 
                          autoFocus
                        />
                    </div>
                </div>
            )}

            <div className="form-row mt-10">
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
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>CEP</label>
                    <input type="text" placeholder="00000-000" maxLength="9" value={logistica.cep} onChange={handleCepChange} />
                  </div>
                  <div className="form-group flex-2">
                    <label>Cidade / UF</label>
                    <input type="text" placeholder="Ex: Campinas - SP" value={logistica.cidade} onChange={e => setLogistica({...logistica, cidade: e.target.value})} />
                  </div>
                  <div className="form-group flex-1">
                    <label>Taxa Frete (R$)</label>
                    <input type="text" placeholder="0,00" value={logistica.frete} onChange={handleFreteChange} />
                  </div>
                </div>
                
                <div className="form-row mt-10">
                  <div className="form-group flex-2">
                    <label>Logradouro</label>
                    <input type="text" placeholder="Av. das Nações..." value={logistica.rua} onChange={e => setLogistica({...logistica, rua: e.target.value})} />
                  </div>
                  <div className="form-group flex-1">
                    <label>Número</label>
                    <input type="text" id="numeroInput" placeholder="123" value={logistica.numero} onChange={e => setLogistica({...logistica, numero: e.target.value})} />
                  </div>
                  <div className="form-group flex-2">
                    <label>Bairro</label>
                    <input type="text" placeholder="Centro" value={logistica.bairro} onChange={e => setLogistica({...logistica, bairro: e.target.value})} />
                  </div>
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
                <button 
                  type="button" 
                  className="btn-secundario-alerta" 
                  onClick={() => { 
                    const clienteObj = clientes.find(c => String(c.id) === String(clienteSelecionado));
                    const nomeCli = clienteObj ? (clienteObj.nome || clienteObj.nomeFantasia || clienteObj.razaoSocial || '') : (clienteSelecionado || 'Cliente em Atendimento');
                    const nomeTema = temaFesta === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : (temaFesta || '');
                    const url = `/compras/nova?clienteNome=${encodeURIComponent(nomeCli)}&temaFesta=${encodeURIComponent(nomeTema)}&dataRetirada=${encodeURIComponent(datas.retirada || '')}`;
                    window.open(url, '_blank');
                  }}
                >
                  🛒 Faltou algo? (Comprar)
                </button>
                <button type="button" className="btn-primary-outline" onClick={abrirCatalogo}>+ ADC. PEÇAS</button>
              </div>
            </div>

            <div className="carrinho-container mt-15">
              {carrinho.length === 0 ? (
                <div className="carrinho-vazio">Nenhuma peça adicionada ainda. Clique em "+ Adc. Peças".</div>
              ) : (
                <div style={{overflowX: 'auto'}}>
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
                        {carrinho.map(item => (
                          <tr key={item.id} style={{borderBottom: '1px solid #f1f5f9', transition: '0.2s'}}>
                            <td style={{padding: '12px 10px'}}>
                               <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                  <div style={{width: '45px', height: '45px', backgroundColor: '#f8fafc', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                      {item.foto ? <img src={item.foto} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <span style={{fontSize:'20px'}}>📷</span>}
                                  </div>
                                  <div style={{display: 'flex', flexDirection: 'column'}}>
                                     <strong style={{color: '#0f172a', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px'}}>
                                        {item.nome}
                                        {item.isBateVolta && <span style={{color: '#f59e0b', fontSize: '10px', marginLeft: '6px', background: '#fef3c7', padding: '2px 4px', borderRadius: '4px'}}>⚠️ Bate e Volta (Retorna no Dia)</span>}
                                     </strong>
                                     <span style={{color: '#64748b', fontSize: '12px'}}>R$ {Number(item.preco).toFixed(2)} un.</span>
                                     
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
                        ))}
                      </tbody>
                    </table>
                </div>
              )}
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
            <h3>Resumo Financeiro</h3>
            <div className="fin-linha">
              <span>Subtotal Itens</span> 
              <span>R$ {calcularTotal().subtotal.toFixed(2)}</span>
            </div>
            
            <div className="fin-linha">
              <span>Frete</span> 
              <span>+ R$ {getFreteNumerico().toFixed(2)}</span>
            </div>
            
            <div className="fin-linha desconto-linha" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>Desconto</span>
                <div className="tipo-desconto-toggle" style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px', border: '1px solid #cbd5e1' }}>
                  <button 
                    type="button" 
                    onClick={() => setTipoDesconto('R$')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: tipoDesconto === 'R$' ? '#c5a059' : 'transparent',
                      color: tipoDesconto === 'R$' ? '#ffffff' : '#64748b',
                      transition: '0.2s'
                    }}
                  >
                    R$
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setTipoDesconto('%')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: tipoDesconto === '%' ? '#c5a059' : 'transparent',
                      color: tipoDesconto === '%' ? '#ffffff' : '#64748b',
                      transition: '0.2s'
                    }}
                  >
                    %
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input 
                  type="number" 
                  min="0" 
                  max={tipoDesconto === '%' ? 100 : undefined}
                  step={tipoDesconto === '%' ? '1' : '0.01'}
                  value={desconto} 
                  onChange={e => setDesconto(e.target.value)} 
                  style={{
                    width: '90px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1.5px solid #c5a059',
                    fontSize: '0.9rem',
                    fontWeight: '800',
                    textAlign: 'right'
                  }}
                  placeholder={tipoDesconto === 'R$' ? '0,00' : '0%'}
                />
              </div>
            </div>
            {tipoDesconto === '%' && Number(desconto) > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700', textAlign: 'right', marginTop: '-6px', marginBottom: '8px' }}>
                - R$ {calcularTotal().valorDesconto.toFixed(2)} ({desconto}% desc.)
              </div>
            )}
            
            <div className="fin-total" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0', padding: '12px 0', borderTop: '2px dashed #e2e8f0' }}>
              <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.95rem' }}>TOTAL</span>
              <strong style={{ fontSize: '1.4rem', color: '#c5a059', fontWeight: '900' }}>R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>
            
            <div className="fin-acoes">
              <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('confirmado')}>✔ CONFIRMAR PEDIDO</button>
              <button type="button" className="btn-voltar-link" style={{width: '100%', justifyContent: 'center', marginTop: '10px'}} onClick={() => interceptarSalvamento('orcamento')}>💾 Salvar como Orçamento</button>
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
            
            <div className="catalogo-filtros">
              <input 
                type="text" 
                className="search-input-clean" 
                style={{border: '1px solid var(--borda)', padding: '10px', borderRadius: '8px'}} 
                placeholder="🔎 Buscar peça..." 
                value={busca} 
                onChange={e => setBusca(e.target.value)} 
              />
              <div className="chips-categorias">
                {categoriasUnicasEstoque.map(cat => (
                  <button 
                    key={cat} 
                    type="button" 
                    className={`chip-cat ${filtroCategoria === cat ? 'active' : ''}`} 
                    onClick={() => setFiltroCategoria(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="catalogo-grid">
              {itensFiltrados.map(item => {
                  const disp = getDisponibilidade(item.id);
                  const estaEsgotado = disp.livresMaximos <= 0;
                  const ehBateVolta = disp.livresReais <= 0 && disp.retornaNoDia > 0;

                  return (
                    <div 
                      key={item.id} 
                      className="peca-card" 
                      onClick={() => { if(!estaEsgotado) addCarrinho(item); }} 
                      style={{opacity: estaEsgotado ? 0.5 : 1, cursor: estaEsgotado ? 'not-allowed' : 'pointer'}}
                    >
                      <div className="peca-img" style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.foto ? (
                              <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                              <span style={{ fontSize: '32px' }}>📷</span>
                          )}
                          
                          {estaEsgotado ? (
                              <span style={badgeEsgotado}>ALUGADO</span>
                          ) : ehBateVolta ? (
                              <span style={badgeBateVolta}>⚠️ VOLTA NO DIA ({disp.livresMaximos})</span>
                          ) : (
                             <span style={badgeLivres}>Livres: {disp.livresReais}</span>
                          )}

                          {!estaEsgotado && <button className="btn-add-peca" type="button">+</button>}
                      </div>
                      
                      <div className="peca-info">
                        <strong>{item.nome}</strong>
                        <span>{item.categoria}</span>
                        <b className="txt-sucesso">R$ {item.financeiro?.valorAluguel || item.preco || 0}</b>
                      </div>
                    </div>
                  );
              })}
              {itensFiltrados.length === 0 && <p className="text-center w-100 mt-15" style={{color: 'var(--texto-secundario)'}}>Nenhuma peça encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovaLocacao;