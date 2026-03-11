import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NovaLocacao.css'; 
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, addDoc, getCountFromServer, serverTimestamp } from 'firebase/firestore'; 
// 🔥 IMPORTANDO O NOSSO DICIONÁRIO DE TEMAS 🔥
import { CATALOGO_TEMAS } from '../../catalogoDeTemas'; 

const NovaLocacao = () => {
  const navigate = useNavigate();
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
  
  // 🔥 ESTADOS PARA A CASCATA DE TEMAS 🔥
  const [categoriaTema, setCategoriaTema] = useState('');
  const [subcategoriaTema, setSubcategoriaTema] = useState('');
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');
  const [temaFesta, setTemaFesta] = useState('');
  const [temaDigitadoPersonalizado, setTemaDigitadoPersonalizado] = useState('');

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
  const [pecasSimilaresPlanoB, setPecasSimilaresPlanoB] = useState([]);
  const [previewPlanoB, setPreviewPlanoB] = useState(null); 

  const [salvandoCompra, setSalvandoCompra] = useState(false);
  const [acaoSalvar, setAcaoSalvar] = useState('fechar');

  const [modalSinalAberto, setModalSinalAberto] = useState(false);
  const [valorSinal, setValorSinal] = useState('');
  const [formaPagtoSinal, setFormaPagtoSinal] = useState('Pix');
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [statusParaSalvar, setStatusParaSalvar] = useState(''); 

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [snapCli, snapEst, snapLoc] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "estoque")),
          getDocs(collection(db, "locacoes"))
        ]);
        
        setClientes(snapCli.docs.map(d => ({ id: d.id, ...d.data() })));
        setEstoque(snapEst.docs.map(d => ({ id: d.id, ...d.data() })));
        setTodasLocacoes(snapLoc.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao carregar:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  const categoriasUnicasEstoque = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];

  // =========================================================================
  // 🔥 LÓGICA DO EFEITO CASCATA (LENDO DO ARQUIVO JS) 🔥
  // =========================================================================
  const categoriasDeTemaUnicas = Object.keys(CATALOGO_TEMAS);
  
  const subcategoriasDisponiveis = categoriaTema 
      ? Object.keys(CATALOGO_TEMAS[categoriaTema] || {}) 
      : [];

  const gruposDisponiveis = (categoriaTema && subcategoriaTema)
      ? Object.keys(CATALOGO_TEMAS[categoriaTema][subcategoriaTema] || {}) 
      : [];

  const temasDisponiveis = (categoriaTema && subcategoriaTema && grupoTemaSelecionado)
      ? CATALOGO_TEMAS[categoriaTema][subcategoriaTema][grupoTemaSelecionado] || []
      : [];


  const isOverlapping = (start1, end1, start2, end2) => {
      if (!start1 || !end1 || !start2 || !end2) return false;
      const s1 = new Date(start1 + 'T00:00:00').getTime();
      const e1 = new Date(end1 + 'T00:00:00').getTime();
      const s2 = new Date(start2 + 'T00:00:00').getTime();
      const e2 = new Date(end2 + 'T00:00:00').getTime();
      return s1 <= e2 && e1 >= s2;
  };

  const getQuantidadeDisponivel = (pecaId) => {
      const peca = estoque.find(e => e.id === pecaId);
      if (!peca) return 0;

      const qtdFisica = parseInt(peca.quantidade || 0) || parseInt(peca.estoque || 0) || 0;
      const qtdManutencao = parseInt(peca.manutencao || 0) || parseInt(peca.emManutencao || 0) || parseInt(peca.qtdManutencao || 0) || parseInt(peca.avariadas || 0) || parseInt(peca.defeito || 0) || parseInt(peca.quebradas || 0) || 0;

      let livres = Math.max(0, qtdFisica - qtdManutencao);

      if (datas.retirada && datas.devolucao) {
          let qtdReservada = 0;
          todasLocacoes.forEach(loc => {
              const status = (loc.status || '').toLowerCase();
              if (['confirmado', 'preparacao', 'entregue'].includes(status)) {
                  if (isOverlapping(datas.retirada, datas.devolucao, loc.dataRetirada, loc.dataDevolucao)) {
                      const itemNoPedido = loc.itens?.find(i => i.id === pecaId);
                      if (itemNoPedido) {
                          qtdReservada += (parseInt(itemNoPedido.qtd) || 0);
                      }
                  }
              }
          });
          livres = Math.max(0, livres - qtdReservada);
      }

      return livres;
  };

  const abrirCatalogo = () => {
      if (!datas.retirada || !datas.devolucao) {
          alert("📅 ATENÇÃO: Por favor, preencha as DATAS DE RETIRADA e DEVOLUÇÃO no topo da tela primeiro!\n\nO sistema precisa das datas para calcular o que está livre.");
          return;
      }
      setModalAberto(true);
  };

  const buscarSimilaresNoEstoque = (itemFaltante) => {
    if (!itemFaltante || !itemFaltante.nome) return [];

    const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
    const palavrasAlvo = normalize(itemFaltante.nome)
        .split(' ')
        .filter(p => p.length > 2 && !['com', 'para', 'das', 'dos', 'kit', 'par', 'festa', 'tema', 'locacao'].includes(p));

    if (palavrasAlvo.length === 0) return [];

    const palavraPrincipal = palavrasAlvo[0]; 
    const temaAtual = normalize(temaFesta); 

    let similares = estoque.map(peca => {
        const qtdLivre = getQuantidadeDisponivel(peca.id);
        if (peca.id === itemFaltante.id || qtdLivre <= 0) return { ...peca, score: -1 };

        let score = 0;
        const nomePecaNorm = normalize(peca.nome);
        const palavrasPeca = nomePecaNorm.split(' ');

        if (palavrasPeca.includes(palavraPrincipal)) score += 10;
        if (temaAtual && temaAtual.length > 2 && nomePecaNorm.includes(temaAtual)) score += 15; 
        
        palavrasAlvo.forEach(palavra => {
            if (nomePecaNorm.includes(palavra) && palavra !== palavraPrincipal) score += 5;
        });

        return { ...peca, score, qtdLivre };
    });

    similares = similares.filter(p => p.score >= 10);
    similares.sort((a, b) => b.score - a.score);
    return similares.slice(0, 4);
  };

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
    const precoItem = Number(item.financeiro?.valorAluguel || item.preco || 0);
    const qtdFisicaTotal = Number(item.quantidade) || 1; 
    
    const qtdLivreNaData = getQuantidadeDisponivel(item.id);
    
    const existe = carrinho.find(i => i.id === item.id);
    
    if (existe) {
      if (isSubstituicao) {
          setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
          return;
      }

      if (existe.qtd >= qtdLivreNaData && !existe.isPendenteCompra) {
          alert(`⚠️ ESTOQUE MÁXIMO ATINGIDO!\nVocê só tem ${qtdLivreNaData} unidade(s) livre(s) de "${item.nome}" para esta data.\n\nVamos buscar um Plano B!`);
          dispararCompraAutomatica(item);
          return;
      }
      setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      if (qtdLivreNaData < 1 && !isSubstituicao) {
          alert(`⚠️ PEÇA INDISPONÍVEL!\nEsta peça está em manutenção ou já alugada para esta data.\n\nVamos ver alternativas no acervo!`);
          dispararCompraAutomatica(item);
          return;
      }
      setCarrinho([...carrinho, { ...item, qtd: 1, preco: precoItem, foto: item.foto, qtdOriginal: qtdFisicaTotal, qtdLivreNestaData: qtdLivreNaData, checkedSeparacao: false, checkedDevolucao: false, avaria: false, faltou: false }]); 
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
          const livresAgora = getQuantidadeDisponivel(itemId);

          if (qtdDesejada > livresAgora) {
              alert(`⚠️ OPERAÇÃO BLOQUEADA!\nO limite absoluto para "${itemCarrinho.nome}" nesta data é: ${livresAgora} unidade(s).\n\nO sistema corrigiu o valor para o máximo permitido.`);
              setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: livresAgora} : i));
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

  const calcularTotal = () => {
    const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * (Number(item.qtd)||1)), 0);
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

    if (carrinho.length === 0) {
        return alert("Você precisa adicionar pelo menos 1 peça no pedido!");
    }

    for (let item of carrinho) {
        if (item.isPendenteCompra) continue;
        const livresAgora = getQuantidadeDisponivel(item.id);
        const qtdNoCarrinho = Number(item.qtd) || 1;
        
        if (qtdNoCarrinho > livresAgora) {
            return alert(`⛔ ERRO GRAVE DE ESTOQUE:\nA peça "${item.nome}" possui apenas ${livresAgora} unidade(s) livre(s) para esta data.\nDiminua a quantidade antes de salvar.`);
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

      await addDoc(coll, {
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
        desconto: Number(desconto), 
        valorTotal: calcularTotal().total, 
        valorPago: valorRecebidoNoCaixa, 
        sinalNegociado: valorSinalNegociado > 0 ? valorSinalNegociado : null,
        status: statusFinal, 
        criadoEm: serverTimestamp()
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
            descricao: `SINAL - Pedido #${codigo} - ${nomeClienteReal}`
        });
      }

      alert(`✅ Pedido ${codigo} salvo com sucesso!`);
      navigate('/locacoes');
    } catch (e) { 
        console.error(e);
        alert("Erro ao salvar o pedido."); 
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
      const confirmouSemSinal = window.confirm("⚠️ ALERTA DE RISCO!\n\nVocê deixou o valor de entrada como R$ 0,00.\n\nTem certeza que deseja CONFIRMAR este pedido assumindo o risco de não ter recebido nenhum sinal?");
      if (confirmouSemSinal) {
          executarSalvamentoFinal('confirmado', 0, 0);
      }
  };

  const abrirWhatsAppCobranca = () => {
      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeClienteVIP = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeFantasia || '') : '';
      const telefoneC = clienteEncontrado?.celular ? clienteEncontrado.celular.replace(/\D/g, '') : '';
      
      const vTotal = calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2});
      const vSinalFormatado = valorSinal || '0,00';

      const texto = `Olá, ${nomeClienteVIP}! 🎉\n\nSua locação no valor total de *R$ ${vTotal}* já foi separada em nosso sistema.\n\nPara confirmarmos a reserva das peças para a sua data, aguardamos o pagamento do sinal no valor de *R$ ${vSinalFormatado}*.\n\n💳 *Nossa Chave PIX:* \n(SUA CHAVE AQUI)\n\nAssim que o pagamento for feito, por favor, me envie o comprovante por aqui. Muito obrigada! 🥰`;

      const msgEncoded = encodeURIComponent(texto);
      const url = telefoneC 
            ? `https://wa.me/55${telefoneC}?text=${msgEncoded}` 
            : `https://api.whatsapp.com/send?text=${msgEncoded}`;
            
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
        nome: formCompra.nome, quantidade: Number(formCompra.quantidade), valorEstimado: valorCusto, categoria: formCompra.categoria, 
        prazo: formCompra.prazo || datas.retirada || "", fornecedor: formCompra.fornecedor, obs: formCompra.obs, vinculoTipo: "pedido", vinculoId: "pendente_salvamento", 
        vinculo: nomeVinculo, status: "pendente", createdAt: serverTimestamp()
      });

      const itemParaCarrinho = {
        id: novaCompraRef.id, nome: formCompra.nome, categoria: formCompra.categoria, foto: '', preco: valorAluguel, qtd: Number(formCompra.quantidade), qtdOriginal: Number(formCompra.quantidade), isPendenteCompra: true 
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
                <button type="button" className={`btn-toggle ${tipoServico === 'PEGUE E MONTE' ? 'active-pegue' : ''}`} onClick={() => { setTipoServico('PEGUE E MONTE'); setLogistica({...logistica, tipo: 'retirada', frete: ''}); }}>📦 PEGUE E MONTE</button>
                <button type="button" className={`btn-toggle ${tipoServico === 'DECORACAO COMPLETA' ? 'active-deco' : ''}`} onClick={() => { setTipoServico('DECORACAO COMPLETA'); setLogistica({...logistica, tipo: 'entrega'}); }}>✨ DECORAÇÃO COMPLETA</button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label>Cliente *</label>
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)}>
                  <option value="">Selecione um cliente cadastrado...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome || c.nomeFantasia || c.razaoSocial}</option>)}
                </select>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 🔥 OS 4 NÍVEIS DE TEMA EM CASCATA 🔥 */}
            {/* ========================================================================= */}
            
            <div className="form-row mt-10">
                <div className="form-group flex-1">
                    <label>Categoria do Tema *</label>
                    <select value={categoriaTema} onChange={e => {
                        setCategoriaTema(e.target.value);
                        setSubcategoriaTema('');
                        setGrupoTemaSelecionado('');
                        setTemaFesta('');
                    }}>
                        <option value="">Selecione a Categoria...</option>
                        {categoriasDeTemaUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                
                <div className="form-group flex-1">
                    <label>Subcategoria do Tema *</label>
                    <select value={subcategoriaTema} onChange={e => {
                        setSubcategoriaTema(e.target.value);
                        setGrupoTemaSelecionado('');
                        setTemaFesta('');
                    }} disabled={!categoriaTema}>
                        <option value="">Selecione a Subcategoria...</option>
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
                    }} disabled={!subcategoriaTema}>
                        <option value="">Selecione o Grupo...</option>
                        {gruposDisponiveis.map(grupo => <option key={grupo} value={grupo}>{grupo}</option>)}
                    </select>
                </div>

                <div className="form-group flex-1">
                    <label>Tema Específico *</label>
                    <select value={temaFesta} onChange={e => setTemaFesta(e.target.value)} disabled={!grupoTemaSelecionado && temaFesta !== 'OUTRO_TEMA'}>
                        <option value="">Selecione o Tema...</option>
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
                            onChange={e => setTemaDigitadoPersonalizado(e.target.value)} 
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
                                     <strong style={{color: '#0f172a', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px'}}>{item.nome}</strong>
                                     <span style={{color: '#64748b', fontSize: '12px'}}>R$ {Number(item.preco).toFixed(2)} un.</span>
                                     {item.isPendenteCompra ? (
                                         <span style={{color: '#d97706', fontSize: '10px', fontWeight: 'bold', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', width: 'max-content', marginTop: '4px'}}>⏳ COMPRA PENDENTE</span>
                                     ) : (
                                         <span style={{color: '#10b981', fontSize: '10px', fontWeight: 'bold', marginTop: '4px'}}>📦 Confirmado p/ Evento!</span>
                                     )}
                                  </div>
                               </div>
                            </td>

                            <td style={{padding: '12px 10px', textAlign: 'center'}}>
                              <div style={{display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                <button type="button" onClick={() => handleChangeQtdCarrinho(item.id, (Number(item.qtd) || 1) - 1)} style={{width: '28px', height: '28px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#0f172a'}}>-</button>
                                <input type="number" min="1" value={item.qtd} onChange={(e) => handleChangeQtdCarrinho(item.id, e.target.value)} onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) handleChangeQtdCarrinho(item.id, 1); }} style={{width: '40px', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '14px', color: '#0f172a', appearance: 'textfield'}} />
                                <button type="button" onClick={() => {
                                    if (item.isPendenteCompra) {
                                        handleChangeQtdCarrinho(item.id, (Number(item.qtd) || 1) + 1);
                                    } else {
                                        const livresAgora = getQuantidadeDisponivel(item.id);
                                        if ((Number(item.qtd) || 1) >= livresAgora) {
                                            alert(`⚠️ LIMITE ATINGIDO!\nVocê possui apenas ${livresAgora} unidade(s) livre(s) de "${item.nome}" para esta data.\n\nVamos buscar um Plano B!`);
                                            dispararCompraAutomatica(item);
                                        } else {
                                            handleChangeQtdCarrinho(item.id, (Number(item.qtd) || 1) + 1);
                                        }
                                    }
                                }} style={{width: '28px', height: '28px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#0f172a'}}>+</button>
                              </div>
                            </td>

                            <td style={{padding: '12px 10px', textAlign: 'right'}}>
                              <strong style={{color: '#0f172a', fontSize: '15px'}}>R$ {(item.preco * (Number(item.qtd) || 1)).toFixed(2)}</strong>
                            </td>

                            <td style={{padding: '12px 10px', textAlign: 'center'}}>
                              <button type="button" className="btn-remover-item" onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))} style={{background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s'}} onMouseEnter={e => e.currentTarget.style.background = '#fca5a5'} onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>🗑️</button>
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
              <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('confirmado')}>✔ CONFIRMAR PEDIDO</button>
              <button type="button" className="btn-voltar-link" style={{width: '100%', justifyContent: 'center', marginTop: '10px'}} onClick={() => interceptarSalvamento('orcamento')}>💾 Salvar como Orçamento</button>
            </div>
          </div>
        </aside>
      </div>

      {modalSinalAberto && (
        <div className="modal-overlay-premium" style={{zIndex: 99999}}>
          <div className="modal-box-premium" style={{maxWidth: '500px', background: '#fff', borderRadius: '16px', overflow: 'hidden'}}>
            
            <div style={{background: '#f8fafc', padding: '25px', borderBottom: '1px solid #e2e8f0', textAlign: 'center'}}>
               <h3 style={{margin: 0, color: '#0f172a', fontSize: '22px'}}>💰 Confirmação e Sinal</h3>
               
               <div style={{marginTop: '20px', padding: '20px', background: '#eff6ff', border: '2px dashed #3b82f6', borderRadius: '12px'}}>
                  <span style={{fontSize: '13px', color: '#1e3a8a', display: 'block', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px'}}>Valor Total do Pedido</span>
                  <strong style={{fontSize: '32px', color: '#1d4ed8'}}>R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
               </div>
            </div>
            
            <form onSubmit={(e) => e.preventDefault()} style={{padding: '25px'}}>
               
               <div style={{display: 'flex', gap: '15px', marginBottom: '20px'}}>
                   <div className="form-group-pag" style={{flex: 1}}>
                     <label style={{fontWeight: 'bold', color: '#334155', fontSize: '13px'}}>Valor da Entrada (R$)</label>
                     <input 
                        type="text" 
                        placeholder="0,00" 
                        autoFocus
                        style={{fontSize: '22px', padding: '15px', textAlign: 'center', borderColor: '#3b82f6', color: '#1e3a8a', backgroundColor: '#fff', fontWeight: 'bold'}}
                        value={valorSinal} 
                        onChange={e => setValorSinal(maskCurrency(e.target.value))} 
                     />
                   </div>

                   <div className="form-group-pag" style={{flex: 1}}>
                     <label style={{fontWeight: 'bold', color: '#334155', fontSize: '13px'}}>Forma de Pagto.</label>
                     <select 
                        value={formaPagtoSinal} 
                        onChange={e => setFormaPagtoSinal(e.target.value)}
                        style={{padding: '15px', fontSize: '16px', height: '100%', borderColor: '#cbd5e1', backgroundColor: '#fff'}}
                     >
                         <option value="Pix">Pix</option>
                         <option value="Dinheiro">Dinheiro</option>
                         <option value="Cartão de Crédito">Cartão de Crédito</option>
                         <option value="Cartão de Débito">Cartão de Débito</option>
                     </select>
                   </div>
               </div>

               <div style={{ marginBottom: '20px' }}>
                  <button
                      type="button"
                      onClick={abrirWhatsAppCobranca}
                      style={{ width: '100%', padding: '14px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '15px', transition: '0.2s', boxShadow: '0 4px 6px rgba(34, 197, 94, 0.2)' }}
                  >
                      <span style={{fontSize: '20px'}}>📱</span> Enviar Cobrança no WhatsApp
                  </button>
              </div>

              <hr style={{border: 'none', borderTop: '1px solid #e2e8f0', margin: '25px 0'}} />

              {/* BOTOES DE AÇÃO */}
              {valorDigitadoNum > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                     <button type="button" onClick={salvarSinalRecebido} disabled={salvandoPedido} style={{padding: '16px', background: '#0f172a', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: salvandoPedido ? 'not-allowed' : 'pointer', transition: '0.2s'}}>
                       {salvandoPedido ? 'Salvando...' : '✅ O cliente JÁ PAGOU (Aprovar Pedido)'}
                     </button>
                     
                     <button type="button" onClick={salvarAguardandoPagamento} disabled={salvandoPedido} style={{padding: '16px', background: '#fffbeb', border: '2px solid #fde68a', borderRadius: '10px', color: '#b45309', fontWeight: 'bold', fontSize: '15px', cursor: salvandoPedido ? 'not-allowed' : 'pointer', transition: '0.2s'}}>
                       {salvandoPedido ? 'Salvando...' : '⏳ AINDA VAI PAGAR (Manter Orçamento)'}
                     </button>
                  </div>
               ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                      <button type="button" onClick={salvarSemSinal} disabled={salvandoPedido} style={{padding: '16px', background: '#ef4444', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: salvandoPedido ? 'not-allowed' : 'pointer', transition: '0.2s'}}>
                          {salvandoPedido ? 'Salvando...' : '⚠️ Aprovar Pedido SEM RECEBER SINAL'}
                      </button>
                  </div>
               )}

               <button type="button" onClick={() => setModalSinalAberto(false)} style={{marginTop: '20px', width: '100%', padding: '14px', background: 'transparent', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline'}}>
                  Cancelar e Voltar
               </button>
            </form>
          </div>
        </div>
      )}

      {/* CATÁLOGO OTIMIZADO */}
      {modalCompraAberto && (
        <div className="modal-overlay-premium" style={{zIndex: 99999}}>
          <div className="modal-box-premium" style={{maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="modal-header" style={{borderBottom: 'none', paddingBottom: '0'}}>
              <h3>🛒 Faltou a peça?</h3>
              <button className="btn-fechar" onClick={() => setModalCompraAberto(false)}>X</button>
            </div>
            
            {pecasSimilaresPlanoB.length > 0 && (
                <div style={{margin: '15px 30px', padding: '15px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px'}}>
                        <span style={{fontSize: '24px'}}>💡</span>
                        <div>
                            <strong style={{color: '#0f172a', display: 'block', fontSize: '15px'}}>Plano B: Salve a venda!</strong>
                            <span style={{color: '#475569', fontSize: '13px'}}>O sistema encontrou opções COERENTES e LIVRES NESTA DATA:</span>
                        </div>
                    </div>
                    
                    {previewPlanoB ? (
                        <div style={{background: '#fff', border: '2px solid #10b981', borderRadius: '10px', padding: '20px', textAlign: 'center', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.15)', animation: 'fadeIn 0.3s'}}>
                           <p style={{fontSize: '13px', color: '#64748b', marginBottom: '10px'}}>Você está substituindo <b>{formCompra.nome}</b> por:</p>
                           
                           <div style={{width: '180px', height: '180px', background: '#f1f5f9', borderRadius: '10px', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', overflow: 'hidden'}}>
                               {previewPlanoB.foto ? <img src={previewPlanoB.foto} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}}/> : '📷'}
                           </div>
                           
                           <h3 style={{margin: '0 0 10px 0', color: '#0f172a', fontSize: '20px'}}>{previewPlanoB.nome}</h3>
                           <span style={{background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold'}}>📦 {previewPlanoB.qtdLivre} livres p/ esta data</span>

                           <div style={{display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px'}}>
                               <button type="button" onClick={() => setPreviewPlanoB(null)} style={{padding: '12px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#475569'}}>← Cancelar e Voltar</button>
                               <button type="button" onClick={() => aceitarSugestaoPlanoB(previewPlanoB)} style={{padding: '12px 20px', background: '#10b981', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#fff', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'}}>✅ Confirmar Substituição</button>
                           </div>
                        </div>
                    ) : (
                        <div style={{display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px'}}>
                            {pecasSimilaresPlanoB.map(pecaB => (
                                <div key={pecaB.id} style={{minWidth: '130px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'}}>
                                    <div style={{width: '60px', height: '60px', background: '#f1f5f9', borderRadius: '8px', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'}}>
                                        {pecaB.foto ? <img src={pecaB.foto} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px'}}/> : '📷'}
                                    </div>
                                    <strong style={{fontSize: '12px', display: 'block', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '8px'}} title={pecaB.nome}>{pecaB.nome}</strong>
                                    <button type="button" onClick={() => setPreviewPlanoB(pecaB)} style={{background: '#0f172a', color: 'white', border: 'none', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', width: '100%', fontWeight: 'bold', transition: '0.2s'}} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1e293b'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0f172a'}>
                                        🔎 Ver & Trocar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <p style={{fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '15px', padding: '0 30px'}}>
              O cliente faz questão da peça original? Preencha abaixo para solicitar a COMPRA dela.
            </p>
            
            <form onSubmit={handleSalvarCompraRapida} className="form-pagamento" style={{padding: '0 30px 30px 30px', opacity: previewPlanoB ? 0.3 : 1, pointerEvents: previewPlanoB ? 'none' : 'auto'}}>
              
              <div className="form-group-pag" style={{position: 'relative'}}>
                <label>Nome do Item que será comprado *</label>
                <input id="compraNomeInput" type="text" required autoComplete="off" value={formCompra.nome} 
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
                      {sugestoesCompra.map(item => {
                         const livres = getQuantidadeDisponivel(item.id);
                         return (
                         <div 
                           key={item.id} 
                           onMouseDown={() => { 
                              let valorAlg = item.financeiro?.valorAluguel || "0,00";
                              if (typeof valorAlg === 'number') valorAlg = valorAlg.toFixed(2).replace(".", ",");
                              setFormCompra({...formCompra, nome: item.nome, categoria: item.categoria || "acervo", valorAluguel: valorAlg});
                              setSugestoesCompra([]);
                           }}
                           style={{padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
                           onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                           onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                         >
                           <span style={{fontWeight: 'bold', color: '#0f172a', fontSize: '13px'}}>{item.nome} {livres <= 0 && '(ALUGADO)'}</span>
                           <span style={{fontSize: '11px', color: livres > 0 ? '#166534' : '#ef4444', backgroundColor: livres > 0 ? '#dcfce7' : '#fee2e2', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'}}>Livres: {livres}</span>
                         </div>
                      )})}
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