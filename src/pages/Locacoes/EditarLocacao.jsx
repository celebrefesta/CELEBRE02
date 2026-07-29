import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './NovaLocacao.css';
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import { CATALOGO_TEMAS } from '../../catalogoDeTemas';
import { gerarPropostaPDF } from '../../utils/gerarPropostaPDF';
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

const EditarLocacao = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
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
  const [modalCalendarioAberto, setModalCalendarioAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');

  const handleGerarPropostaPDF = () => {
    const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado)) || {};
    const temaFinal = temaFesta === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : temaFesta;

    const objPedidoAtual = {
      id,
      numeroPedido,
      status: statusAtual,
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
      valorPago: valorJaPago
    };

    gerarPropostaPDF(objPedidoAtual, configEmpresa, clienteEncontrado, 'preview');
  };
  
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [tipoServico, setTipoServico] = useState('PEGUE E MONTE');
  const [datas, setDatas] = useState({ retirada: '', devolucao: '' });
  
  const [categoriaTema, setCategoriaTema] = useState('');
  const [subcategoriaTema, setSubcategoriaTema] = useState('');
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');
  const [temaFesta, setTemaFesta] = useState('');
  const [temaDigitadoPersonalizado, setTemaDigitadoPersonalizado] = useState('');
  
  const [logistica, setLogistica] = useState({ 
    tipo: 'entrega', cep: '', rua: '', numero: '', bairro: '', cidade: '', frete: '', obsTransporte: '' 
  });
  
  const [desconto, setDesconto] = useState(0);
  const [tipoDesconto, setTipoDesconto] = useState('R$'); // 'R$' ou '%'
  const [obsInternas, setObsInternas] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
  const [statusAtual, setStatusAtual] = useState('');
  const [valorJaPago, setValorJaPago] = useState(0); 

  const [modalSinalAberto, setModalSinalAberto] = useState(false);
  const [valorSinal, setValorSinal] = useState('');
  const [formaPagtoSinal, setFormaPagtoSinal] = useState('Pix');
  const [linkMercadoPago, setLinkMercadoPago] = useState('');
  const [gerandoLinkMP, setGerandoLinkMP] = useState(false);
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [statusParaSalvar, setStatusParaSalvar] = useState(''); 
  const [configEmpresa, setConfigEmpresa] = useState(null);
  const [tipoEvento, setTipoEvento] = useState('');  // 🏷️ Tipo de Evento

  const [dadosIniciais, setDadosIniciais] = useState(null);

  const isFinalizado = statusAtual === 'finalizado' || statusAtual === 'cancelado';

  const badgeEsgotado = { position: 'absolute', top: 5, left: 5, background: '#ef4444', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' };
  const badgeBateVolta = { position: 'absolute', top: 5, left: 5, background: '#f59e0b', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' };
  const badgeLivres = { position: 'absolute', top: 5, left: 5, background: '#10b981', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' };

  // 🔥 AUDITORIA
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
        pedidoId: id,
        numeroPedido: numeroPedido || "S/N",
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria:", error);
    }
  };

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

        if (id) {
          const docRef = doc(db, "locacoes", id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            setNumeroPedido(data.numeroPedido || '');
            setStatusAtual(data.status || 'orcamento'); 
            setClienteSelecionado(data.clienteId || '');
            
            const servicoSalvo = data.tipoServico || 'PEGUE E MONTE';
            setTipoServico(servicoSalvo);
            setDatas({ retirada: data.dataRetirada || '', devolucao: data.dataDevolucao || '' });
            setValorJaPago(Number(data.valorPago || 0));

            let temaSalvo = data.temaFesta || data.tema || '';
            let achouCategoria = '';
            let achouSub = '';
            let achouGrupo = '';
            let achouTema = '';

            for (const cat in CATALOGO_TEMAS) {
                for (const sub in CATALOGO_TEMAS[cat]) {
                    for (const grup in CATALOGO_TEMAS[cat][sub]) {
                        if (CATALOGO_TEMAS[cat][sub][grup].includes(temaSalvo)) {
                            achouCategoria = cat;
                            achouSub = sub;
                            achouGrupo = grup;
                            achouTema = temaSalvo;
                            break;
                        }
                    }
                    if (achouTema) break;
                }
                if (achouTema) break;
            }

            if (achouTema) {
                setCategoriaTema(achouCategoria);
                setSubcategoriaTema(achouSub);
                setGrupoTemaSelecionado(achouGrupo);
                setTemaFesta(achouTema);
            } else if (temaSalvo) {
                setTemaFesta('OUTRO_TEMA');
                setTemaDigitadoPersonalizado(temaSalvo);
            }
            
            const log = data.logistica || {};
            let freteFormatado = '';
            if (log.frete) {
              freteFormatado = Number(log.frete).toFixed(2).replace('.', ',');
            }
            
            const tipoLogSalvo = log.tipo || (servicoSalvo === 'PEGUE E MONTE' ? 'retirada' : 'entrega');

            setLogistica({
              tipo: tipoLogSalvo,
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
            setDesconto(data.valorDescontoInput !== undefined ? data.valorDescontoInput : (data.desconto || 0));
            if (data.tipoDesconto) setTipoDesconto(data.tipoDesconto);
            setObsInternas(data.obsInternas || '');
            if (data.tipoEvento) setTipoEvento(data.tipoEvento);  // 🏷️ Carregar tipo de evento salvo

            setDadosIniciais({
                clienteId: data.clienteId || '',
                temaFesta: temaSalvo,
                dataRetirada: data.dataRetirada || '',
                dataDevolucao: data.dataDevolucao || '',
                tipoServico: servicoSalvo,
                tipoLogistica: tipoLogSalvo,
                frete: freteFormatado,
                desconto: data.desconto || 0,
                carrinhoSnapshot: JSON.stringify(itensFormatados.map(i => ({ id: i.id, qtd: i.qtd, nome: i.nome })))
            });
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, [id, usuarioLogado, navigate, tenantId]);

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
              if (loc.id === id) return; 
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
      return { livresReais, livresMaximos, retornaNoDia: qtdRetornaNoDia, emManutencao: qtdManutencao >= qtdFisica };
  };

  const addCarrinho = (item) => {
    if (isFinalizado) return; 
    const disp = getDisponibilidade(item.id);
    const precoItem = Number(item.financeiro?.valorAluguel || item.preco || 0);
    const existe = carrinho.find(i => i.id === item.id);

    if (existe) {
      if (existe.qtd >= disp.livresMaximos) {
          alert(`⚠️ ESTOQUE MÁXIMO ATINGIDO!\nVocê possui o limite absoluto de ${disp.livresMaximos} unidade(s) de "${item.nome}".`);
          return;
      }
      if (existe.qtd >= disp.livresReais && disp.retornaNoDia > 0 && !existe.jaAvisouBateVolta) {
           const querMesmo = window.confirm("⚠️ ATENÇÃO: CONFLITO DE AGENDA (Bate e Volta)!\n\nA peça será DEVOLVIDA por outro cliente exatamente na data deste novo evento.\n\nDeseja adicionar mesmo assim?");
           if(!querMesmo) return;
      }
      setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1, jaAvisouBateVolta: disp.retornaNoDia > 0 ? true : i.jaAvisouBateVolta } : i));
    } else {
      if (disp.livresMaximos < 1) {
          alert("⚠️ PEÇA INDISPONÍVEL!\nEsta peça está em manutenção ou já alugada para esta data.");
          return;
      }
      if (disp.livresReais < 1 && disp.retornaNoDia > 0) {
           const querMesmo = window.confirm("⚠️ ATENÇÃO: CONFLITO DE AGENDA (Bate e Volta)!\n\nA peça será DEVOLVIDA por outro cliente exatamente na data deste novo evento.\n\nDeseja adicionar mesmo assim?");
           if(!querMesmo) return;
      }
      setCarrinho([...carrinho, { ...item, qtd: 1, preco: precoItem, isBateVolta: disp.retornaNoDia > 0, jaAvisouBateVolta: disp.retornaNoDia > 0, checkedSeparacao: false, checkedDevolucao: false, avaria: false, faltou: false }]);
    }
  };

  const handleChangeQtdCarrinho = (itemId, novaQtd) => {
      if (isFinalizado) return;
      const itemCarrinho = carrinho.find(i => i.id === itemId);
      if (!itemCarrinho) return;

      let qtdDesejada = parseInt(novaQtd);
      if (isNaN(qtdDesejada)) qtdDesejada = '';
      
      if (typeof qtdDesejada === 'number' && qtdDesejada > 0) {
          const disp = getDisponibilidade(itemId);
          if (qtdDesejada > disp.livresMaximos) {
              alert(`⚠️ LIMITE ABSOLUTO ATINGIDO!\nVocê possui apenas ${disp.livresMaximos} unidade(s) permitidas de "${itemCarrinho.nome}".`);
              setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: disp.livresMaximos} : i));
          } else {
              setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: qtdDesejada} : i));
          }
      } else {
           setCarrinho(carrinho.map(i => i.id === itemId ? {...i, qtd: qtdDesejada} : i));
      }
  };

  const removerDoCarrinho = (itemId, itemNome) => {
      setCarrinho(carrinho.filter(i => i.id !== itemId));
  };

  const salvarChecklistImediato = async (novosItens) => {
    try {
        await updateDoc(doc(db, "locacoes", id), { itens: novosItens });
    } catch (e) {
        console.error("Erro ao salvar checklist:", e);
    }
  };

  const marcarIda = (itemId) => {
    if (isFinalizado) return;
    const itemEncontrado = carrinho.find(i => i.id === itemId);
    const novoStatusSeparacao = !itemEncontrado.checkedSeparacao;
    
    const novosItens = carrinho.map(item => {
      if (item.id === itemId) return { ...item, checkedSeparacao: novoStatusSeparacao };
      return item;
    });
    
    setCarrinho(novosItens);
    salvarChecklistImediato(novosItens); 
    registrarLog("CHECKLIST: SEPARAÇÃO", `Marcou a peça "${itemEncontrado.nome}" como ${novoStatusSeparacao ? 'SEPARADA (Ida)' : 'PENDENTE (Desmarcou)'}.`);
  };

  const marcarVolta = (itemId, status) => {
    if (isFinalizado) return;
    const itemEncontrado = carrinho.find(i => i.id === itemId);
    let logTexto = "";
    
    const novosItens = carrinho.map(item => {
      if (item.id === itemId) {
        if (status === 'ok') {
          const jaTavaOk = item.checkedDevolucao && !item.avaria && !item.faltou;
          logTexto = jaTavaOk ? `Desmarcou a devolução OK da peça "${item.nome}"` : `Marcou a peça "${item.nome}" como DEVOLVIDA OK`;
          return { ...item, checkedDevolucao: !jaTavaOk, avaria: false, faltou: false };
        }
        if (status === 'avaria') {
          const jaTavaAvaria = item.avaria;
          logTexto = jaTavaAvaria ? `Removeu o alerta de AVARIA da peça "${item.nome}"` : `Marcou a peça "${item.nome}" com AVARIA!`;
          return { ...item, checkedDevolucao: !jaTavaAvaria ? true : false, avaria: !jaTavaAvaria, faltou: false };
        }
        if (status === 'faltou') {
          const jaTavaFaltou = item.faltou;
          logTexto = jaTavaFaltou ? `Removeu o alerta de FALTA da peça "${item.nome}"` : `Marcou que FALTOU a peça "${item.nome}"!`;
          return { ...item, checkedDevolucao: !jaTavaFaltou ? true : false, avaria: false, faltou: !jaTavaFaltou };
        }
      }
      return item;
    });

    setCarrinho(novosItens);
    salvarChecklistImediato(novosItens); 
    if(logTexto) registrarLog("CHECKLIST: DEVOLUÇÃO", logTexto);
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
    const subtotal = carrinho.reduce((acc, item) => {
      const precoValido = Number(item.preco || item.financeiro?.valorAluguel || 0);
      return acc + (precoValido * (item.qtd || 1));
    }, 0);
    const valorDesconto = getValorDescontoCalculado(subtotal);
    const total = subtotal + getFreteNumerico() - valorDesconto;
    return { subtotal, valorDesconto, total: Math.max(0, total) };
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
      } catch (e) {}
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

  const interceptarSalvamento = (novoStatus) => {
    if (!clienteSelecionado || !datas.retirada) return alert("Preencha cliente e data de retirada!");
    if (temaFesta === 'OUTRO_TEMA' && !temaDigitadoPersonalizado) {
        return alert("Por favor, digite o nome do tema personalizado!");
    } else if (!temaFesta) {
        return alert("Selecione o Tema da Festa!");
    }

    const hojeStr = new Date().toISOString().split('T')[0];

    if (novoStatus === 'finalizado') {
        const dataComparacao = datas.devolucao || datas.retirada;
        if (dataComparacao > hojeStr) {
            alert("🚫 BLOQUEADO:\n\nVocê não pode receber as peças de volta de um evento marcado para o futuro. Aguarde a data do evento para finalizar.");
            return;
        }
        
        const temItemSemVolta = carrinho.some(i => !i.checkedDevolucao);
        if (temItemSemVolta) {
             const confirmacaoExtra = window.confirm("⚠️ ALERTA DE CONFERÊNCIA:\n\nExistem itens no pedido que NÃO foram marcados como devolvidos. Tem certeza que deseja finalizar?");
             if (!confirmacaoExtra) return;
        } else {
             const confirmacao = window.confirm("Finalizar o Pedido? Certifique-se que todos os itens foram conferidos.");
             if (!confirmacao) return;
        }
    }

    if (novoStatus === 'entregue' && datas.retirada > hojeStr) {
        const confirmacaoAntecipada = window.confirm("⚠️ ATENÇÃO!\n\nA data do evento é no futuro, mas você está marcando como ENTREGUE hoje. Tem certeza?");
        if (!confirmacaoAntecipada) return;
    }

    const statusFinalDesejado = novoStatus || statusAtual;
    
    if (statusAtual === 'orcamento' && statusFinalDesejado === 'confirmado') {
        setStatusParaSalvar('confirmado');
        setModalSinalAberto(true);
        return;
    }

    executarSalvamentoFinal(statusFinalDesejado, 0, 0); 
  };

  const executarSalvamentoFinal = async (statusFinal, valorSinalEntrandoNoCaixa = 0, valorSinalNegociado = 0) => {
    setSalvandoPedido(true);
    
    try {
      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeCliente = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeFantasia || clienteEncontrado.razaoSocial || 'Cliente') : 'Cliente';
      
      const logisticaParaSalvar = { ...logistica, frete: getFreteNumerico() };
      const novoValorPagoTotal = valorJaPago + valorSinalEntrandoNoCaixa;
      const temaFinalParaSalvar = temaFesta === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : temaFesta;
      const totalFinalCalculado = calcularTotal().total;
      
      const docRef = doc(db, "locacoes", id);
      
      await updateDoc(docRef, {
        clienteId: clienteSelecionado,
        clienteNome: nomeCliente,
        temaFesta: temaFinalParaSalvar,
        tipoServico, 
        tipoEvento: tipoEvento || null,  // 🏷️ Salvar tipo de evento
        dataRetirada: datas.retirada,
        dataDevolucao: datas.devolucao,
        itens: carrinho, 
        logistica: logisticaParaSalvar,
        obsInternas,
        desconto: calcularTotal().valorDesconto,
        tipoDesconto,
        valorDescontoInput: Number(desconto),
        valorTotal: totalFinalCalculado,
        valorPago: novoValorPagoTotal,
        sinalNegociado: valorSinalNegociado > 0 ? valorSinalNegociado : null,
        status: statusFinal,
        atualizadoEm: new Date()
      });

      if (valorSinalEntrandoNoCaixa > 0) {
        await addDoc(collection(db, "financeiro_lancamentos"), {
            tipo: 'entrada', 
            categoria: 'Locação', 
            valor: valorSinalEntrandoNoCaixa, 
            formaPagto: formaPagtoSinal,
            data: new Date().toISOString().split('T')[0], 
            status: 'pago', 
            createdAt: serverTimestamp(),
            descricao: `SINAL (Aprovação) - Pedido ${numeroPedido ? `#${numeroPedido}` : ''} - ${nomeCliente}`,
            userId: tenantId // 🎯 SALVA VINCULADO À EMPRESA
        });
        
        await registrarLog("PAGAMENTO DE SINAL", `Registrou entrada financeira de R$ ${valorSinalEntrandoNoCaixa.toFixed(2)}.`);
        setValorJaPago(novoValorPagoTotal);
      }
      
      // 🔥 ATUALIZAR FINANCEIRO PENDENTE
      const valorRestante = totalFinalCalculado - novoValorPagoTotal;
      try {
          const qPendentes = query(collection(db, "financeiro_lancamentos"), where("pedidoId", "==", id), where("status", "==", "pendente"));
          const snapPendentes = await getDocs(qPendentes);
          
          if (valorRestante > 0 && statusFinal !== 'orcamento') {
              if (!snapPendentes.empty) {
                  const docRefPend = doc(db, "financeiro_lancamentos", snapPendentes.docs[0].id);
                  await updateDoc(docRefPend, {
                      valor: valorRestante,
                      descricao: `Locação #${numeroPedido} - ${nomeCliente}`
                  });
              } else {
                  await addDoc(collection(db, "financeiro_lancamentos"), {
                      userId: tenantId, // 🎯 SALVA VINCULADO À EMPRESA
                      pedidoId: id,
                      numeroPedido: numeroPedido,
                      descricao: `Locação #${numeroPedido} - ${nomeCliente}`,
                      valor: valorRestante,
                      tipo: 'entrada',
                      status: 'pendente',
                      categoria: 'Locação',
                      data: datas.retirada,
                      createdAt: serverTimestamp()
                  });
              }
          } else if (valorRestante <= 0) {
              snapPendentes.docs.forEach(async (d) => {
                  await deleteDoc(doc(db, "financeiro_lancamentos", d.id));
              });
          }
      } catch (errFin) {
          console.error("Erro ao sincronizar pendente no financeiro:", errFin);
      }

      let mudancas = [];
      
      if (dadosIniciais) {
          if (String(clienteSelecionado) !== String(dadosIniciais.clienteId)) {
              const cliAntigo = clientes.find(c => String(c.id) === String(dadosIniciais.clienteId))?.nome || 'Desconhecido';
              mudancas.push(`Cliente (de '${cliAntigo}' para '${nomeCliente}')`);
          }
          if (temaFinalParaSalvar !== dadosIniciais.temaFesta) mudancas.push(`Tema (de '${dadosIniciais.temaFesta}' para '${temaFinalParaSalvar}')`);
          if (datas.retirada !== dadosIniciais.dataRetirada) mudancas.push(`Data Retirada (para '${datas.retirada}')`);
          if (datas.devolucao !== dadosIniciais.dataDevolucao) mudancas.push(`Data Devolução (para '${datas.devolucao}')`);
          if (tipoServico !== dadosIniciais.tipoServico) mudancas.push(`Serviço (de '${dadosIniciais.tipoServico}' para '${tipoServico}')`);
          if (logistica.tipo !== dadosIniciais.tipoLogistica) mudancas.push(`Logística (de '${dadosIniciais.tipoLogistica}' para '${logistica.tipo}')`);
          if (logistica.frete !== dadosIniciais.frete) mudancas.push(`Frete (de '${dadosIniciais.frete}' para '${logistica.frete}')`);
          if (Number(desconto) !== Number(dadosIniciais.desconto)) mudancas.push(`Desconto (para R$${desconto})`);
          
          const carrinhoAntigo = JSON.parse(dadosIniciais.carrinhoSnapshot || '[]');
          let mudancasItens = [];
          
          carrinho.forEach(itemAtual => {
              const itemAntigo = carrinhoAntigo.find(i => i.id === itemAtual.id);
              if (itemAntigo) {
                  if (itemAntigo.qtd !== itemAtual.qtd) mudancasItens.push(`Qtd ${itemAtual.nome} (para ${itemAtual.qtd})`);
              } else {
                  mudancasItens.push(`Adicionou: ${itemAtual.nome}`);
              }
          });
          
          carrinhoAntigo.forEach(itemAntigo => {
              if (!carrinho.find(i => i.id === itemAntigo.id)) mudancasItens.push(`Removeu: ${itemAntigo.nome}`);
          });
          
          if (mudancasItens.length > 0) mudancas.push(`Itens [${mudancasItens.join(', ')}]`);
      }

      if (statusFinal && statusFinal !== statusAtual) {
        let det = `Avançou o pedido #${numeroPedido} de ${statusAtual.toUpperCase()} para ${statusFinal.toUpperCase()}.`;
        if (mudancas.length > 0) det += ` (Também editou: ${mudancas.join(' | ')})`;
        await registrarLog("ATUALIZAÇÃO DE STATUS", det);
      } else if (mudancas.length > 0) {
        await registrarLog("EDIÇÃO DE PEDIDO", `Editou o pedido #${numeroPedido}. Alterações: ${mudancas.join(' | ')}.`);
      }

      setStatusAtual(statusFinal);

      setDadosIniciais({
          clienteId: clienteSelecionado, temaFesta: temaFinalParaSalvar, dataRetirada: datas.retirada, dataDevolucao: datas.devolucao,
          tipoServico: tipoServico, tipoLogistica: logistica.tipo, frete: logistica.frete, desconto: desconto,
          carrinhoSnapshot: JSON.stringify(carrinho.map(i => ({ id: i.id, qtd: i.qtd, nome: i.nome })))
      });
      
      if (statusFinal && statusFinal !== statusAtual) alert(`✅ Pedido salvo! Avançou para a etapa: ${statusFinal.toUpperCase()}`);
      else alert(`✅ Alterações salvas com sucesso!`);
      
    } catch (e) { 
      alert("Erro ao atualizar o pedido.");
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
      const confirmouSemSinal = window.confirm("⚠️ ALERTA DE RISCO!\n\nVocê deixou o valor de entrada como R$ 0,00.\n\nTem certeza que deseja APROVAR este pedido assumindo o risco de não ter recebido nenhum sinal?");
      if (confirmouSemSinal) {
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

      if (!linkFinal) {
        // Link fixo da empresa Celebre como fallback seguro
        linkFinal = `https://link.mercadopago.com.br/celebresistema`;
      }

      setLinkMercadoPago(linkFinal);
      setFormaPagtoSinal('Mercado Pago');
      alert("✅ Link de Pagamento configurado com sucesso para a SUA conta!");

    } catch (e) {
      console.error("Erro MP Preference:", e);
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

  const getBadgeStatus = () => {
      if (statusAtual === 'orcamento') return { txt: '📝 Orçamento', cor: '#f59e0b' };
      if (statusAtual === 'confirmado') return { txt: '✅ Confirmado', cor: '#3b82f6' };
      if (statusAtual === 'preparacao') return { txt: '📦 Em Preparação', cor: '#8b5cf6' };
      if (statusAtual === 'entregue') return { txt: '🚚 Na Rua (Entregue)', cor: '#10b981' };
      if (statusAtual === 'finalizado') return { txt: '✔️ Finalizado', cor: '#0f172a' };
      if (statusAtual === 'cancelado') return { txt: '🗑️ Cancelado', cor: '#ef4444' };
      return { txt: 'Desconhecido', cor: '#64748b' };
  };

  const badgeInfo = getBadgeStatus();
  const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0;

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
        <div className="header-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secundario-alerta" onClick={() => setModalCalendarioAberto(true)}>
            📅 Disponibilidade (Calendário)
          </button>
          <button type="button" className="btn-primary-outline" onClick={handleGerarPropostaPDF}>
            📄 Proposta PDF (Luxo)
          </button>
          <button className="btn-voltar-link" onClick={() => navigate('/locacoes')}>← Voltar à Lista</button>
        </div>
      </header>

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
                  onClick={() => { 
                      if(tipoServico !== 'PEGUE E MONTE') {
                          setTipoServico('PEGUE E MONTE');
                          setLogistica({...logistica, tipo: 'retirada', frete: ''}); 
                      }
                  }}>
                  📦 PEGUE E MONTE
                </button>
                <button type="button" className={`btn-toggle ${tipoServico === 'DECORACAO COMPLETA' ? 'active-deco' : ''}`}
                  onClick={() => { 
                      if(tipoServico !== 'DECORACAO COMPLETA') {
                          setTipoServico('DECORACAO COMPLETA');
                          setLogistica({...logistica, tipo: 'entrega'}); 
                      }
                  }}>
                  ✨ DECORAÇÃO COMPLETA
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label>Cliente *</label>
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)} disabled={isFinalizado}>
                  <option value="">Selecione um cliente cadastrado...</option>
                  <option value={clienteSelecionado} disabled hidden>
                      {clientes.find(c => String(c.id) === String(clienteSelecionado))?.nome || 'Carregando...'}
                  </option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome || c.nomeFantasia || c.razaoSocial}</option>)}
                </select>
              </div>
            </div>
            
            <div className="form-row mt-10">
                <div className="form-group flex-1">
                    <label>Categoria do Tema *</label>
                    <select value={categoriaTema} onChange={e => {
                        setCategoriaTema(e.target.value);
                        setSubcategoriaTema('');
                        setGrupoTemaSelecionado('');
                        setTemaFesta('');
                    }} disabled={isFinalizado}>
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
                    }} disabled={!categoriaTema || isFinalizado}>
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
                    }} disabled={!subcategoriaTema || isFinalizado}>
                        <option value="">Selecione o Grupo...</option>
                        {gruposDisponiveis.map(grupo => <option key={grupo} value={grupo}>{grupo}</option>)}
                    </select>
                </div>
         
                <div className="form-group flex-1">
                    <label>Tema Específico *</label>
                    <select value={temaFesta} onChange={e => setTemaFesta(e.target.value)} disabled={(!grupoTemaSelecionado && temaFesta !== 'OUTRO_TEMA') || isFinalizado}>
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
                            disabled={isFinalizado}
                            autoFocus
                        />
                    </div>
                </div>
            )}
        
            <div className="form-row mt-10">
              <div className="form-group flex-1"><label>Data de Retirada / Evento *</label><input type="date" value={datas.retirada} onChange={e => setDatas({...datas, retirada: e.target.value})} disabled={isFinalizado}/></div>
              <div className="form-group flex-1"><label>Data de Devolução</label><input type="date" value={datas.devolucao} onChange={e => setDatas({...datas, devolucao: e.target.value})} disabled={isFinalizado}/></div>
            </div>
          </div>

          <div className="card-secao">
            <div className="header-com-toggle">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>🚚 LOGÍSTICA & ENTREGA</h3>
              <div className="toggle-simples" style={{pointerEvents: isFinalizado ? 'none' : 'auto'}}>
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

          {statusAtual !== 'orcamento' && carrinho.length > 0 && (
            <div className="card-secao">
              <h3 className="section-divider" style={{marginTop: 0, border: 'none', marginBottom: '8px'}}>📋 CHECK-IN E CONFERÊNCIA (IDA / VOLTA)</h3>
              <p style={{fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '15px'}}>
                Marque as peças que saíram e voltaram. As alterações são <b>salvas automaticamente</b>.
              </p>

              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {carrinho.map(item => {
                  const temProblema = item.avaria || item.faltou; 
                  const taMarcadoOk = item.checkedDevolucao && !item.avaria && !item.faltou;

                  return (
                  <div key={item.id} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: temProblema ? '#fef2f2' : '#f8fafc', border: `1px solid ${temProblema ? '#fca5a5' : '#e2e8f0'}`, borderRadius: '10px'}}>
                    
                    <div style={{flex: '1 1 200px'}}>
                      <strong style={{color: '#0f172a', fontSize: '14px', display: 'block'}}>{item.nome}</strong>
                      <span style={{fontSize: '11px', color: '#64748b', fontWeight: 'bold'}}>QUANTIDADE: {item.qtd} un.</span>
                    </div>

                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      <button 
                         type="button" onClick={() => marcarIda(item.id)} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: item.checkedSeparacao ? '#dcfce7' : '#fff', color: item.checkedSeparacao ? '#166534' : '#64748b', borderColor: item.checkedSeparacao ? '#86efac' : '#cbd5e1', transition: '0.2s'}}>
                        📤 IDA
                      </button>

                      <button 
                         type="button" 
                         onClick={() => marcarVolta(item.id, 'ok')} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: taMarcadoOk ? '#dbeafe' : '#fff', color: taMarcadoOk ? '#1e40af' : '#64748b', borderColor: taMarcadoOk ? '#93c5fd' : '#cbd5e1', transition: '0.2s'}}>
                        📥 VOLTA
                      </button>

                      <button 
                         type="button" 
                         onClick={() => marcarVolta(item.id, 'avaria')} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: item.avaria ? '#fef9c3' : '#fff', color: item.avaria ? '#a16207' : '#64748b', borderColor: item.avaria ? '#fde047' : '#cbd5e1', transition: '0.2s'}}>
                        ⚠️ AVARIA
                      </button>

                      <button 
                         type="button" 
                         onClick={() => marcarVolta(item.id, 'faltou')} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: item.faltou ? '#fee2e2' : '#fff', color: item.faltou ? '#b91c1c' : '#64748b', borderColor: item.faltou ? '#fca5a5' : '#cbd5e1', transition: '0.2s'}}>
                        ❌ FALTA
                      </button>
                    </div>

                  </div>
                  )})}
              </div>
            </div>
          )}

          <div className="card-secao">
            <div className="header-com-botoes">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>📦 ITENS DO PEDIDO</h3>
              {!isFinalizado && (
                  <div className="botoes-acoes-itens" style={{ display: 'flex', gap: '10px' }}>
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
                            <strong>
                              {item.nome}
                              {item.isBateVolta && <span style={{color: '#f59e0b', fontSize: '10px', marginLeft: '6px', background: '#fef3c7', padding: '2px 4px', borderRadius: '4px'}}>⚠️ Bate e Volta (Retorna no Dia)</span>}
                            </strong>
                            <span>R$ {precoExibicao.toFixed(2)} un</span>
                          </td>
                          <td className="text-center">
                            {isFinalizado ? (
                                <div style={{fontWeight: 'bold', fontSize: '14px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '6px', display: 'inline-block'}}>{item.qtd}x</div>
                            ) : (
                                <div className="controle-qtd">
                                  <button type="button" onClick={() => handleChangeQtdCarrinho(item.id, item.qtd - 1)}>-</button>
                                  <span>{item.qtd}</span>
                                  <button type="button" onClick={() => handleChangeQtdCarrinho(item.id, item.qtd + 1)}>+</button>
                                </div>
                            )}
                          </td>
                          <td className="text-right carrinho-total-item">
                            <strong>R$ {(precoExibicao * item.qtd).toFixed(2)}</strong>
                          </td>
                          {!isFinalizado && (
                              <td className="text-center">
                                <button type="button" className="btn-remover-item" onClick={() => removerDoCarrinho(item.id, item.nome)}>🗑️</button>
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
            <div className="fin-linha desconto-linha" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>Desconto</span>
                {!isFinalizado && (
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
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isFinalizado ? (
                  <strong>R$ {calcularTotal().valorDesconto.toFixed(2)}</strong>
                ) : (
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
                )}
              </div>
            </div>
            {!isFinalizado && tipoDesconto === '%' && Number(desconto) > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700', textAlign: 'right', marginTop: '-6px', marginBottom: '8px' }}>
                - R$ {calcularTotal().valorDesconto.toFixed(2)} ({desconto}% desc.)
              </div>
            )}
            
            <div className="fin-total" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0', padding: '12px 0', borderTop: '2px dashed #e2e8f0' }}>
              <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.95rem' }}>TOTAL</span>
              <strong style={{ fontSize: '1.4rem', color: '#c5a059', fontWeight: '900' }}>R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            {valorJaPago > 0 && (
                <div style={{marginTop: '10px', padding: '10px', background: '#f0fdf4', borderRadius: '8px', color: '#166534', fontSize: '13px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold'}}>
                    <span>Já Pago (Sinal):</span>
                    <span>R$ {valorJaPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
            )}
            
            <hr style={{margin: '25px 0', border: 'none', borderTop: '2px dashed var(--borda)'}} />
            
            <h3 className="section-divider" style={{border: 'none', marginBottom: '15px'}}>PRÓXIMO PASSO DO PEDIDO</h3>

            <div className="fin-acoes" style={{marginTop: '0'}}>
                
                {statusAtual === 'orcamento' && (
                   <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('confirmado')} style={{backgroundColor: '#3b82f6', marginBottom: '10px'}} disabled={salvandoPedido}>
                    ✔ APROVAR PEDIDO
                </button>
                )}

                {statusAtual === 'confirmado' && (
                   <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('preparacao')} style={{backgroundColor: '#f59e0b', marginBottom: '10px'}} disabled={salvandoPedido}>
                    📦 INICIAR SEPARAÇÃO
                </button>
                )}

                {statusAtual === 'preparacao' && (
                   <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('entregue')} style={{backgroundColor: '#8b5cf6', marginBottom: '10px'}} disabled={salvandoPedido}>
                    🚚 MARCAR COMO ENTREGUE
                </button>
                )}

                {statusAtual === 'entregue' && (
                  <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('finalizado')} style={{backgroundColor: '#10b981', marginBottom: '10px'}} disabled={salvandoPedido}>
                    ✅ RECEBER E FINALIZAR
                </button>
                )}

                {isFinalizado && (
                  <div style={{background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', marginBottom: '10px', fontSize: '13px'}}>
                    🎉 Ciclo Concluído! Tudo Certo.
                </div>
                )}

                {!isFinalizado && (
                <button type="button" className="btn-voltar-link" style={{width: '100%', justifyContent: 'center'}} onClick={() => interceptarSalvamento()} disabled={salvandoPedido}>
                    💾 Apenas Salvar Alterações
                  </button>
                )}
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
                {categoriasUnicasEstoque.map(cat => (
                  <button key={cat} type="button" className={`chip-cat ${filtroCategoria === cat ? 'active' : ''}`} onClick={() => setFiltroCategoria(cat)}>
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
                    <div key={item.id} className="peca-card" onClick={() => { if(!estaEsgotado) addCarrinho(item); }} style={{opacity: estaEsgotado ? 0.5 : 1, cursor: estaEsgotado ? 'not-allowed' : 'pointer'}}>
                      <div className="peca-img" style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.foto ? (
                              <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                              <span style={{ fontSize: '32px' }}>📷</span>
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

      {/* 📅 MODAL CALENDÁRIO DE DISPONIBILIDADE */}
      <ModalCalendarioDisponibilidade
        isOpen={modalCalendarioAberto}
        onClose={() => setModalCalendarioAberto(false)}
        estoque={estoque}
        locacoes={todasLocacoes}
      />
    </div>
  );
};

export default EditarLocacao;