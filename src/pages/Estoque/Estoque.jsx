import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './Estoque.css';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, query, deleteDoc, updateDoc, writeBatch, where, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORIAS_FISICAS } from '../../catalogoDeTemas'; 

// Page component for Estoque Management
const Estoque = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🔥 CHAVE MESTRA: Pega o ID da empresa no navegador ou o do próprio usuário
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [temAcesso, setTemAcesso] = useState(false);
  const [limiteEstoque, setLimiteEstoque] = useState(0);
  const [itens, setItens] = useState([]);
  const [locacoes, setLocacoes] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [limpandoNomes, setLimandoNomes] = useState(false);
  const [busca, setBusca] = useState('');
  const [dataFiltro, setDataFiltro] = useState(''); 
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [localizacaoFiltro, setLocalizacaoFiltro] = useState('');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('A-Z'); 

  const [imagemAmpliada, setImagemAmpliada] = useState(null);
  const [modalManutencao, setModalManutencao] = useState(false);
  const [itemParaManutencao, setItemParaManutencao] = useState(null);
  const [qtdMaint, setQtdMaint] = useState(1);
  const [motivoManutencao, setMotivoManutencao] = useState('');
  const [custoManutencao, setCustoManutencao] = useState('');
  const [dataInicioManutencao, setDataInicioManutencao] = useState(new Date().toISOString().split('T')[0]);
  const [dataPrevisaoRetorno, setDataPrevisaoRetorno] = useState('');
  const [lancarDespesaFinanceiro, setLancarDespesaFinanceiro] = useState(true);

  // 📊 MODAL DE ROI & RENTABILIDADE
  const [modalRoiItem, setModalRoiItem] = useState(null);
  const [ocultarMetricasRoi, setOcultarMetricasRoi] = useState(() => localStorage.getItem('celebre_ocultar_roi') === 'true');

  const alternarOcultarMetricasRoi = () => {
    setOcultarMetricasRoi(prev => {
      const next = !prev;
      localStorage.setItem('celebre_ocultar_roi', String(next));
      return next;
    });
  };

  // 🛒 MODAL DE REPOSIÇÃO / PEDIDO DE COMPRA
  const [modalReposicaoItem, setModalReposicaoItem] = useState(null);
  const [qtdReposicao, setQtdReposicao] = useState(1);
  const [modoReposicao, setModoReposicao] = useState('pacote'); // 'pacote' | 'pecas'
  const [pecasReposicaoSelecionadas, setPecasReposicaoSelecionadas] = useState([]);
  const [toastMsg, setToastMsg] = useState('');

  const [modalAddPedidoAberto, setModalAddPedidoAberto] = useState(false);
  const [itemParaPedido, setItemParaPedido] = useState(null);
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState('');
  const [adicionandoAoPedido, setAdicionandoAoPedido] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);

  // ☑️ SELEÇÃO EM MASSA
  const [itensSelecionados, setItensSelecionados] = useState(new Set());
  // 🔢 MODO DE VISUALIZAÇÃO
  const [modoVisualizacao, setModoVisualizacao] = useState('lista'); // 'lista' | 'grid'

  // 📷 CÂMERA DE ESCANEAMENTO DE ACERVO
  const [cameraEstoqueAberta, setCameraEstoqueAberta] = useState(false);
  const html5QrCodeEstoqueRef = useRef(null);

  const iniciarScannerEstoque = async () => {
    setCameraEstoqueAberta(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader-camera-estoque");
        html5QrCodeEstoqueRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            setBusca(decodedText);
            if (html5QrCodeEstoqueRef.current) {
              html5QrCodeEstoqueRef.current.stop().then(() => {
                html5QrCodeEstoqueRef.current.clear();
                html5QrCodeEstoqueRef.current = null;
                setCameraEstoqueAberta(false);
              }).catch(() => setCameraEstoqueAberta(false));
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Erro ao iniciar câmera no estoque:", err);
        alert("⚠️ Permissão de câmera negada ou dispositivo sem câmera.");
        setCameraEstoqueAberta(false);
      }
    }, 350);
  };

  const pararScannerEstoque = async () => {
    if (html5QrCodeEstoqueRef.current) {
      try {
        await html5QrCodeEstoqueRef.current.stop();
        html5QrCodeEstoqueRef.current.clear();
      } catch (e) {}
      html5QrCodeEstoqueRef.current = null;
    }
    setCameraEstoqueAberta(false);
  };

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE ESTOQUE - LISTAGEM)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
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
      console.error("Erro ao gravar log da auditoria do estoque:", error);
    }
  };

  useEffect(() => { 
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    carregarDados(); 
  }, [usuarioLogado, navigate, tenantId]);

  const carregarDados = async () => {
    if (!usuarioLogado) return;
    setLoading(true);
    try {
      // 🔥 1. VERIFICAÇÃO DE PLANO E LIMITES NA CONTA DA EMPRESA
      const userRef = doc(db, 'usuarios', tenantId);
      const userSnap = await getDoc(userRef);
      
      let acessoLiberado = false;
      let limiteMaximo = 50; // Padrão se der erro

      if (userSnap.exists()) {
          const userData = userSnap.data();

          // 🛡️ BYPASS DO SUPER ADMIN (Acesso irrestrito)
          const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
          if (isSuperAdmin) {
              acessoLiberado = true;
              limiteMaximo = 99999;
          } else {
          // 🔥 VERIFICAÇÃO DO PERÍODO DE TESTE GRÁTIS (7 DIAS) 🔥
          let testeAtivo = false;
          if (userData.dataFimTeste) {
              const dataFim = new Date(userData.dataFimTeste);
              if (new Date() <= dataFim) testeAtivo = true;
          } else if (userData.dataCadastro) {
              let dataCad = userData.dataCadastro;
              if (dataCad.toDate) dataCad = dataCad.toDate();
              const diffTime = new Date().getTime() - new Date(dataCad).getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
              if (diffDays <= 7) testeAtivo = true;
          } else {
              // Fallback: se não encontrar data, libera para não travar o cliente
              testeAtivo = true;
          }

          // Se está no teste grátis, acesso total com limite máximo
          if (testeAtivo) {
              acessoLiberado = true;
              limiteMaximo = 10000; // Acesso completo durante o teste
          } else if (userData.plano === 'pago' || userData.statusPagamentoVulso === 'pago' || userData.statusAssinatura === 'ativa' || userData.assinaturaAtiva === true) {
              // Teste acabou, mas a empresa pagou um plano
              acessoLiberado = true;
              limiteMaximo = 1000; // Assume Básico como padrão

              if (userData.planoId) {
                  try {
                      const planoSnap = await getDoc(doc(db, "planos", userData.planoId));
                      if (planoSnap.exists()) {
                          const nomePlano = planoSnap.data().nome?.toLowerCase() || '';
                          if (nomePlano.includes('premium')) {
                              limiteMaximo = 5000;
                          } else if (nomePlano.includes('pro')) {
                              limiteMaximo = 10000;
                          } else {
                              limiteMaximo = 1000; // Básico
                          }
                      } else if (userData.planoId === "gGRLzfUfHNUurTw3ppqQ") {
                          limiteMaximo = 1000; // Fallback caso plano seja apagado
                      }
                  } catch (err) {
                      console.error("Erro ao buscar nome do plano:", err);
                  }
              }
          }
          } // fim do else do super admin
      }

      setTemAcesso(acessoLiberado);
      setLimiteEstoque(limiteMaximo);

      if (!acessoLiberado) {
          setLoading(false);
          return;
      }

      // 🔥 2. FILTRO BLINDADO NO ESTOQUE (DA EMPRESA)
      const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
      const snapEstoque = await getDocs(qEstoque);
      let listaEstoque = snapEstoque.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listaEstoque.sort((a, b) => {
          const tempoA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
          const tempoB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
          return tempoB - tempoA; 
      });

      // 🔥 3. FILTRO BLINDADO NAS LOCAÇÕES (DA EMPRESA)
      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
      const snapLocacoes = await getDocs(qLocacoes);
      const listaLocacoes = snapLocacoes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setItens(listaEstoque);
      setLocacoes(listaLocacoes);
    } catch (error) { 
        console.error("Erro ao carregar dados:", error);
    } finally { 
        setLoading(false); 
    }
  };



  const irParaCadastro = (item = null) => {
    if (!item && itens.length >= limiteEstoque) {
      alert(`⚠️ LIMITE ATINGIDO!\n\nSeu plano atual permite cadastrar até ${limiteEstoque.toLocaleString('pt-BR')} itens. Faça um upgrade no seu plano para cadastrar mais peças e continuar crescendo seu acervo!`);
      navigate('/planos');
      return;
    }

    if (item) {
      navigate('/cadastro-estoque', { state: { itemEditando: item } });
    } else {
      navigate('/cadastro-estoque');
    }
  };

  const duplicarItem = (item) => {
      if (itens.length >= limiteEstoque) {
        alert(`⚠️ LIMITE ATINGIDO!\n\nSeu plano atual permite cadastrar até ${limiteEstoque.toLocaleString('pt-BR')} itens. Faça um upgrade no seu plano para duplicar esta peça!`);
        navigate('/planos');
        return;
      }

      const confirmar = window.confirm(
          "⚠️ ATENÇÃO:\n\n" +
          "Use a duplicação apenas se a nova peça tiver alguma DIFERENÇA (ex: Cor, Tamanho, Voltagem).\n\n" +
          "Se for uma peça EXATAMENTE IGUAL à que já existe, NÃO duplique! Apenas clique em Editar e aumente a 'Quantidade Física'.\n\n" +
          "Deseja continuar e criar uma variação desta peça?"
      );
      if (confirmar) navigate('/cadastro-estoque', { state: { itemDuplicando: item } });
  };

  // ☑️ TOGGLE DE SELEÇÃO INDIVIDUAL
  const toggleSelecao = (id) => {
      setItensSelecionados(prev => {
          const novo = new Set(prev);
          if (novo.has(id)) novo.delete(id);
          else novo.add(id);
          return novo;
      });
  };

  // 🗑️ EXCLUIR SELECIONADOS EM MASSA
  const excluirEmMassa = async () => {
      if (itensSelecionados.size === 0) return;
      const qtd = itensSelecionados.size;
      if (!window.confirm(`⚠️ Excluir permanentemente ${qtd} item${qtd > 1 ? 'ns' : ''} do acervo?\n\nEsta ação NÃO pode ser desfeita.`)) return;
      try {
          const batch = writeBatch(db);
          itensSelecionados.forEach(id => batch.delete(doc(db, 'estoque', id)));
          await batch.commit();
          await registrarLog('EXCLUSÃO EM MASSA', `Excluiu ${qtd} itens do acervo em massa via seleção.`);
          setItensSelecionados(new Set());
          carregarDados();
      } catch (e) {
          alert('Erro ao excluir os itens selecionados.');
      }
  };

  const parseValorCusto = (valStr) => {
    if (!valStr) return 0;
    const limpo = String(valStr).replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  const handleBlurCusto = () => {
    if (!custoManutencao || String(custoManutencao).trim() === '') return;
    const valNum = parseValorCusto(custoManutencao);
    if (valNum >= 0) {
      setCustoManutencao(valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const abrirModalManutencao = (item) => {
    setItemParaManutencao(item);
    const qtdAtual = item.qtdManutencao !== undefined ? item.qtdManutencao : (item.status === 'manutencao' ? item.quantidade : 0);
    setQtdMaint(qtdAtual === 0 ? 1 : qtdAtual);
    setMotivoManutencao(item.motivoManutencao || '');
    
    const valCustoExistente = item.custoManutencao !== undefined && item.custoManutencao !== null ? Number(item.custoManutencao) : 0;
    setCustoManutencao(valCustoExistente > 0 ? valCustoExistente.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    
    setDataInicioManutencao(item.dataInicioManutencao ? item.dataInicioManutencao.split('T')[0] : new Date().toISOString().split('T')[0]);
    setDataPrevisaoRetorno(item.dataPrevisaoRetorno || '');
    setModalManutencao(true);
  };

  const formatarDataBR = (dataIso) => {
    if (!dataIso) return '';
    const [a, m, d] = dataIso.split('-');
    return `${d}/${m}/${a}`;
  };

  // 📈 CÁLCULO DE MÉTRICAS DE RETORNO (ROI & GIRO) DA PEÇA
  const calcularMetricasItem = (peca) => {
    if (!peca) return { vezesAlugada: 0, totalFaturado: 0, custoAquisicao: 0, custoManutencao: 0, lucroLiquido: 0, roiPercentual: 0, historicoPedidos: [] };

    let vezesAlugada = 0;
    let totalFaturado = 0;
    const historicoPedidos = [];

    (locacoes || []).forEach(loc => {
      const statusLoc = String(loc.status || '').toLowerCase();
      if (statusLoc.includes('cancelado') || loc.isOrcamentoVencido) return;

      const itensPedido = loc.itens || loc.carrinho || loc.pecas || [];
      const itemEncontrado = itensPedido.find(it => 
        (it.id && String(it.id) === String(peca.id)) || 
        (it.codigo && peca.codigo && it.codigo === peca.codigo) || 
        (it.nome && peca.nome && it.nome.trim().toLowerCase() === peca.nome.trim().toLowerCase())
      );

      if (itemEncontrado) {
        const qtdNoPedido = Number(itemEncontrado.quantidade || itemEncontrado.qtd || 1);
        vezesAlugada += qtdNoPedido;
        const precoUnitario = Number(itemEncontrado.preco || itemEncontrado.valor || peca.preco || peca.financeiro?.valorAluguel || 0);
        const subTotalItem = precoUnitario * qtdNoPedido;
        totalFaturado += subTotalItem;
        historicoPedidos.push({
          id: loc.id,
          numeroPedido: loc.numeroPedido || loc.numero || (loc.id ? loc.id.slice(0, 6).toUpperCase() : '-'),
          clienteNome: loc.clienteNome || loc.nomeCliente || 'Cliente',
          dataRetirada: loc.dataRetirada || loc.dataEvento,
          qtd: qtdNoPedido,
          valorGerado: subTotalItem,
          status: loc.status
        });
      }
    });

    const custoAquisicao = Number(peca.precoAquisicao || peca.valorCompra || peca.custoCompra || peca.custo || peca.financeiro?.custoCompra || 0);
    const custoManutencao = Number(peca.custoManutencao || peca.totalManutencao || 0);
    const custoTotal = custoAquisicao + custoManutencao;
    const lucroLiquido = totalFaturado - custoTotal;
    
    const roiPercentual = custoTotal > 0 
      ? ((totalFaturado - custoTotal) / custoTotal) * 100 
      : (totalFaturado > 0 ? 100 : 0);

    return {
      vezesAlugada,
      totalFaturado,
      custoAquisicao,
      custoManutencao,
      custoTotal,
      lucroLiquido,
      roiPercentual,
      historicoPedidos
    };
  };

  // 🛒 ABRIR MODAL DE REPOSIÇÃO (COM DETECÇÃO DE KIT / DECORAÇÃO)
  const abrirModalReposicao = (item) => {
    if (!item) return;
    setModalReposicaoItem(item);
    setQtdReposicao(1);
    const pecas = item.especificacoes?.itensDecoracao || item.especificacoes?.itensDoKit || [];
    if (pecas.length > 0) {
      setPecasReposicaoSelecionadas(pecas.map(p => ({
        ...p,
        selecionado: true,
        qtdReposicao: Number(p.qtd) || 1
      })));
      setModoReposicao('pecas'); // Padrão inteligente: desmembrar itens do kit
    } else {
      setPecasReposicaoSelecionadas([]);
      setModoReposicao('pacote');
    }
  };

  // 🛒 PEDIR REPOSIÇÃO DIRETA PARA O MÓDULO DE COMPRAS
  const pedirReposicaoCompra = async (item, qtd = 1) => {
    if (!item) return;
    const pecasDoKit = item.especificacoes?.itensDecoracao || item.especificacoes?.itensDoKit || [];
    const isDeco = (item.especificacoes?.isDecoracao || item.categoria === 'Decoração Completa' || item.tipoCadastro === 'decoracao') && pecasDoKit.length > 0;

    try {
      if (isDeco && modoReposicao === 'pecas') {
        const pecasFiltradas = pecasReposicaoSelecionadas.filter(p => p.selecionado && Number(p.qtdReposicao) > 0);
        if (pecasFiltradas.length === 0) {
          alert("⚠️ Selecione ao menos 1 peça da composição da decoração para enviar para compras.");
          return;
        }

        for (const peca of pecasFiltradas) {
          await addDoc(collection(db, "lista_compras"), {
            userId: tenantId,
            empresaId: tenantId,
            nome: peca.nome,
            item: peca.nome,
            categoria: peca.categoria || 'Acervo / Reposição',
            quantidade: Number(peca.qtdReposicao) || 1,
            valorEstimado: Number(peca.valorCompra || peca.preco || peca.precoOriginal || 0),
            status: 'pendente',
            prioridade: 'alta',
            foto: peca.foto || item.foto || '',
            origem: 'reposicao_decoracao_kit',
            decoracaoOrigem: item.nome,
            decoracaoId: item.id,
            estoqueId: peca.id || item.id,
            codigoPeca: peca.codigo || '',
            observacoes: `Peça individual do kit/tema "${item.nome}" (Cód: ${item.codigo || 'S/N'}).`,
            criadoEm: serverTimestamp()
          });
        }

        await registrarLog("REPOSIÇÃO DE DECORAÇÃO", `Enviou ${pecasFiltradas.length} peças desmembradas da decoração "${item.nome}" para a Lista de Compras.`);
        setModalReposicaoItem(null);
        setToastMsg(`🛒 ${pecasFiltradas.length} ${pecasFiltradas.length === 1 ? 'peça enviada' : 'peças enviadas'} da decoração "${item.nome}" para Compras!`);
        setTimeout(() => setToastMsg(''), 4000);
      } else {
        // Envio do Pacote Fechado / Peça Única
        await addDoc(collection(db, "lista_compras"), {
          userId: tenantId,
          empresaId: tenantId,
          nome: item.nome,
          item: item.nome,
          categoria: item.categoria || 'Acervo / Reposição',
          quantidade: Number(qtd) || 1,
          valorEstimado: Number(item.precoAquisicao || item.valorCompra || item.custoCompra || item.financeiro?.custoCompra || 0),
          status: 'pendente',
          prioridade: 'alta',
          foto: item.foto || '',
          origem: isDeco ? 'reposicao_decoracao_pacote' : 'reposicao_estoque',
          estoqueId: item.id,
          codigoPeca: item.codigo || '',
          observacoes: isDeco 
            ? `Reposição do Tema Completo "${item.nome}" (Cód: ${item.codigo || 'S/N'}).`
            : `Reposição solicitada diretamente do Estoque (Cód: ${item.codigo || 'S/N'}).`,
          criadoEm: serverTimestamp()
        });

        await registrarLog("REPOSIÇÃO DE ACERVO", `Enviou pedido de reposição de "${item.nome}" (${qtd} un) para a Lista de Compras.`);
        setModalReposicaoItem(null);
        setToastMsg(`🛒 Pedido de compra de "${item.nome}" (${qtd} un) enviado com sucesso!`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    } catch (err) {
      console.error("Erro ao pedir reposição:", err);
      alert("Erro ao enviar pedido de reposição.");
    }
  };

  const somarDiasISO = (dataIso, dias) => {
    if (!dataIso) return '';
    const parts = dataIso.split('-');
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + dias);
    const ano = dt.getFullYear();
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const dia = String(dt.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const verificarConflitoManutencaoLocacao = (item, valorQtdMaint, dataPrevisao) => {
    if (!item || valorQtdMaint <= 0) return null;

    const hojeStr = new Date().toISOString().split('T')[0];
    const conflitos = [];

    (locacoes || []).forEach(loc => {
      if (loc.arquivado || loc.archived) return;
      const status = (loc.status || '').toLowerCase().trim();
      if (['cancelado', 'arquivado', 'finalizado', 'orcamento', 'orçamento'].includes(status)) return;

      if (!loc.dataRetirada || !loc.dataDevolucao) return;
      if (loc.dataDevolucao < hojeStr) return;

      let qtdAlugadaTotalNoPedido = 0;
      let nomeItemOuKit = '';

      (loc.itens || loc.carrinho || []).forEach(i => {
        const iQtd = Math.max(1, Number(i.qtd || i.quantidade || 1));
        const bateItemDireto = String(i.id) === String(item.id) || 
          (i.codigo && item.codigo && i.codigo === item.codigo) || 
          (i.nome && item.nome && i.nome.trim().toLowerCase() === item.nome.trim().toLowerCase());

        if (bateItemDireto) {
          qtdAlugadaTotalNoPedido += iQtd;
        }

        // Checar composição de kits/decorações
        const pecasCompostas = i.itensDecoracao || i.itensDoKit || i.pecasKit || i.especificacoes?.itensDecoracao || i.especificacoes?.itensDoKit || i.especificacoes?.pecasKit || [];
        pecasCompostas.forEach(p => {
          const pBate = String(p.id) === String(item.id) || 
            (p.codigo && item.codigo && p.codigo === item.codigo) || 
            (p.nome && item.nome && p.nome.trim().toLowerCase() === item.nome.trim().toLowerCase());
          if (pBate) {
            const pQtdUnit = Math.max(1, Number(p.qtd || p.quantidade || 1));
            qtdAlugadaTotalNoPedido += pQtdUnit * iQtd;
            nomeItemOuKit = i.nome || i.titulo || 'Decoração/Kit';
          }
        });
      });

      if (qtdAlugadaTotalNoPedido > 0) {
        const qtdFisica = Math.max(1, Number(item.quantidade || 1));
        const estoqueRestanteSemMaint = qtdFisica - valorQtdMaint;

        if (qtdAlugadaTotalNoPedido > estoqueRestanteSemMaint) {
          const dataLimiteProntidao = somarDiasISO(loc.dataRetirada, -1);
          const qtdMaxManutencaoSegura = Math.max(0, qtdFisica - qtdAlugadaTotalNoPedido);

          // Se a prontidão não foi informada OU for posterior à saída da peça
          if (!dataPrevisao || dataPrevisao > dataLimiteProntidao) {
            conflitos.push({
              numPedido: loc.numeroPedido || loc.id?.substring(0,6).toUpperCase(),
              clienteNome: loc.clienteNome || 'Cliente',
              dataRetirada: loc.dataRetirada,
              dataDevolucao: loc.dataDevolucao,
              dataLimiteProntidao,
              qtdAlugada: qtdAlugadaTotalNoPedido,
              qtdMaxManutencaoSegura,
              nomeItemOuKit
            });
          }
        }
      }
    });

    return conflitos;
  };

  const salvarManutencao = async () => {
    if (!itemParaManutencao) return;
    const valorQtd = parseInt(qtdMaint);
    if (isNaN(valorQtd) || valorQtd < 0 || valorQtd > itemParaManutencao.quantidade) {
      alert("Quantidade em manutenção não pode exceder a quantidade total em estoque!");
      return;
    }

    // 🛡️ VALIDAÇÃO DE CONFLITO: Garante que o reparo fique pronto antes da saída do próximo pedido
    if (valorQtd > 0) {
      const conflitos = verificarConflitoManutencaoLocacao(itemParaManutencao, valorQtd, dataPrevisaoRetorno);
      if (conflitos && conflitos.length > 0) {
        const p = conflitos[0];
        const dataLimiteBR = formatarDataBR(p.dataLimiteProntidao);
        const aceitaAjustar = window.confirm(
          `🚨 ATENÇÃO: CONFLITO DE MANUTENÇÃO X LOCAÇÃO AGENDADA!\n\n` +
          `A peça "${itemParaManutencao.nome}" tem ${p.qtdAlugada} unidade(s) alugada(s) no Pedido #${p.numPedido} (${p.clienteNome}${p.nomeItemOuKit ? ` via ${p.nomeItemOuKit}` : ''}) para ${formatarDataBR(p.dataRetirada)} a ${formatarDataBR(p.dataDevolucao)}.\n\n` +
          `Se você enviar ${valorQtd} un para reparo, o estoque livre ficará em apenas ${Math.max(0, itemParaManutencao.quantidade - valorQtd)} un, GERANDO FALTA DE PEÇA PARA O CLIENTE!\n\n` +
          `👉 Clique em "OK" para limitar a manutenção à quantidade livre segura (${p.qtdMaxManutencaoSegura} un).\n` +
          `👉 Ou clique em "Cancelar" para definir uma Data de Prontidão anterior a ${dataLimiteBR}.`
        );

        if (aceitaAjustar) {
          setQtdMaint(String(p.qtdMaxManutencaoSegura));
          return;
        } else {
          return;
        }
      }
    }

    const valCustoNum = parseValorCusto(custoManutencao);

    try {
      // 1. Atualizar estoque com os dados de manutenção
      await updateDoc(doc(db, "estoque", itemParaManutencao.id), {
        qtdManutencao: valorQtd,
        motivoManutencao: motivoManutencao.trim(),
        custoManutencao: valCustoNum,
        dataInicioManutencao: dataInicioManutencao || new Date().toISOString().split('T')[0],
        dataPrevisaoRetorno: dataPrevisaoRetorno || '',
        status: valorQtd === itemParaManutencao.quantidade ? 'manutencao' : 'ok'
      });

      // 2. Se houver custo de manutenção > 0 e a quantidade for > 0, lançar automaticamente no Financeiro como DESPESA (Saída)
      if (valCustoNum > 0 && valorQtd > 0) {
        const descFinanceiro = `🛠️ Manutenção/Reparo: ${itemParaManutencao.nome}${motivoManutencao ? ` (${motivoManutencao})` : ''}`;
        await addDoc(collection(db, "financeiro_lancamentos"), {
          userId: tenantId,
          empresaId: tenantId,
          tipo: "saida",
          categoria: "Manutenção de Acervo",
          descricao: descFinanceiro,
          valor: valCustoNum,
          valorTotal: valCustoNum,
          data: new Date().toISOString().split('T')[0],
          status: "pago",
          formaPagamento: "Outros",
          origem: "manutencao_estoque",
          itemId: itemParaManutencao.id,
          itemNome: itemParaManutencao.nome,
          createdAt: serverTimestamp()
        });

        await registrarLog("DESPESA FINANCEIRA", `Lançou despesa de R$ ${valCustoNum.toFixed(2)} referente à manutenção da peça "${itemParaManutencao.nome}".`);
      }

      const msg = valorQtd === 0 
        ? `Devolveu todas as unidades da peça "${itemParaManutencao.nome}" ao estoque livre.`
        : `Definiu ${valorQtd} unidade(s) da peça "${itemParaManutencao.nome}" em manutenção (Motivo: ${motivoManutencao || 'Reparo generalizado'}${valCustoNum > 0 ? `, Custo: R$ ${valCustoNum.toFixed(2)}` : ''}).`;

      await registrarLog("MANUTENÇÃO DE ACERVO", msg);
      setModalManutencao(false);
      carregarDados();
    } catch (error) { 
      console.error("Erro ao atualizar manutenção:", error);
      alert("Erro ao atualizar manutenção."); 
    }
  };

  const concluirManutencaoHoje = async () => {
    if (!itemParaManutencao) return;
    setQtdMaint(0);
    const valCustoNum = parseValorCusto(custoManutencao);
    
    try {
      await updateDoc(doc(db, "estoque", itemParaManutencao.id), {
        qtdManutencao: 0,
        motivoManutencao: motivoManutencao.trim(),
        custoManutencao: valCustoNum,
        dataPrevisaoRetorno: '',
        status: 'ok'
      });

      if (valCustoNum > 0 && Number(itemParaManutencao.qtdManutencao || itemParaManutencao.manutencao || 0) > 0) {
        const descFinanceiro = `🛠️ Manutenção Concluída (Antecipada): ${itemParaManutencao.nome}${motivoManutencao ? ` (${motivoManutencao})` : ''}`;
        await addDoc(collection(db, "financeiro_lancamentos"), {
          userId: tenantId,
          empresaId: tenantId,
          tipo: "saida",
          categoria: "Manutenção de Acervo",
          descricao: descFinanceiro,
          valor: valCustoNum,
          valorTotal: valCustoNum,
          data: new Date().toISOString().split('T')[0],
          status: "pago",
          formaPagamento: "Outros",
          origem: "manutencao_estoque",
          itemId: itemParaManutencao.id,
          itemNome: itemParaManutencao.nome,
          createdAt: serverTimestamp()
        });
      }

      await registrarLog("MANUTENÇÃO DE ACERVO", `🎉 Concluiu o reparo antecipadamente e liberou "${itemParaManutencao.nome}" de volta ao acervo!`);
      setModalManutencao(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao concluir manutenção:", error);
      alert("Erro ao concluir manutenção.");
    }
  };

  const concluirManutencaoDireta = async (item) => {
    if (!item) return;
    const confirm = window.confirm(`🎉 Confirmar conclusão do reparo da peça "${item.nome}"?\n\nTodas as unidades em manutenção serão liberadas para o estoque livre!`);
    if (!confirm) return;

    try {
      await updateDoc(doc(db, "estoque", item.id), {
        qtdManutencao: 0,
        motivoManutencao: '',
        custoManutencao: 0,
        dataPrevisaoRetorno: '',
        status: 'ok',
        atualizadoEm: new Date().toISOString()
      });

      await registrarLog("REPARO CONCLUÍDO", `Concluiu o reparo de "${item.nome}" e devolveu as unidades ao estoque disponível.`);
      alert(`✅ Reparo Concluído com Sucesso!\n\nA peça "${item.nome}" foi totalmente liberada para aluguel no seu estoque!`);
      carregarDados();
    } catch (e) {
      console.error("Erro ao concluir reparo direto:", e);
      alert("Erro ao atualizar o reparo no estoque.");
    }
  };

  const concluirManutencaoEmMassa = async () => {
    if (itensSelecionados.size === 0) return;
    const selecionadosArray = Array.from(itensSelecionados);
    const itensParaLiberar = itens.filter(i => selecionadosArray.includes(i.id) && (Number(i.qtdManutencao || 0) > 0 || i.status === 'manutencao'));

    if (itensParaLiberar.length === 0) {
      alert("Nenhum dos itens selecionados possui unidades em manutenção/reparo no momento.");
      return;
    }

    if (!window.confirm(`🎉 Confirmar a conclusão do reparo de ${itensParaLiberar.length} peça(s) selecionada(s)?\n\nAs unidades serão totalmente devolvidas ao estoque livre!`)) {
      return;
    }

    try {
      for (const item of itensParaLiberar) {
        await updateDoc(doc(db, "estoque", item.id), {
          qtdManutencao: 0,
          status: 'ok',
          motivoManutencao: '',
          dataPrevisaoRetorno: '',
          atualizadoEm: new Date().toISOString()
        });
      }

      await registrarLog("MANUTENÇÃO EM MASSA", `Concluiu a manutenção em lote de ${itensParaLiberar.length} peça(s) e devolveu as unidades ao acervo.`);
      alert(`✅ Reparos Concluídos!\n\n${itensParaLiberar.length} peça(s) foram devolvidas ao estoque livre!`);
      setItensSelecionados(new Set());
      carregarDados();
    } catch (error) {
      console.error("Erro ao concluir manutenção em massa:", error);
      alert("Erro ao concluir manutenção das peças selecionadas.");
    }
  };

  const salvarItemNoPedido = async () => {
      if (!pedidoSelecionadoId) return alert("Por favor, selecione um pedido na lista!");
      setAdicionandoAoPedido(true);

      try {
          const locacaoAlvo = locacoes.find(l => l.id === pedidoSelecionadoId);
          if (!locacaoAlvo) throw new Error("Pedido não encontrado.");

          const precoItem = Number(itemParaPedido.financeiro?.valorAluguel || 0);
          const novoItemFormatado = {
              ...itemParaPedido,
              qtd: 1,
              preco: precoItem,
              foto: itemParaPedido.foto || itemParaPedido.fotos?.[0] || '',
              qtdOriginal: Number(itemParaPedido.quantidade) || 1,
              checkedSeparacao: false,
              checkedDevolucao: false,
              avaria: false,
              faltou: false
          };

          let itensAtualizados = [...(locacaoAlvo.itens || [])];
          const indexExistente = itensAtualizados.findIndex(i => i.id === itemParaPedido.id);

          if (indexExistente >= 0) {
              itensAtualizados[indexExistente].qtd += 1;
          } else {
              itensAtualizados.push(novoItemFormatado);
          }

          const novoSubtotal = itensAtualizados.reduce((acc, item) => acc + (Number(item.preco) * Number(item.qtd)), 0);
          const frete = Number(locacaoAlvo.logistica?.frete) || 0;
          const desconto = Number(locacaoAlvo.desconto) || 0;
          const novoTotal = Math.max(0, novoSubtotal + frete - desconto);

          await updateDoc(doc(db, "locacoes", pedidoSelecionadoId), {
              itens: itensAtualizados,
              valorTotal: novoTotal
          });

          await registrarLog("INSERÇÃO RÁPIDA EM PEDIDO", `Adicionou a peça "${itemParaPedido.nome}" diretamente pelo painel de estoque ao pedido de "${locacaoAlvo.clienteNome}".`);
          alert(`✅ A peça "${itemParaPedido.nome}" foi adicionada com sucesso ao pedido de ${locacaoAlvo.clienteNome}!`);
          setModalAddPedidoAberto(false);
          carregarDados();
      } catch(e) {
          alert("Erro ao adicionar peça.");
      } finally {
          setAdicionandoAoPedido(false);
      }
  };

  const limparFiltroData = () => {
      setDataFiltro('');
      if (statusFiltro === 'indisponivel') setStatusFiltro('');
  };

  const calcularDisponibilidadeNaData = (item) => {
      const isDeco = item.especificacoes?.isDecoracao || item.categoria === 'Decoração Completa';
      const qtdBase = isDeco ? 1 : (Number(item.quantidade) || 0); 
      
      const emMaint = item.qtdManutencao !== undefined ? Number(item.qtdManutencao) : (item.status === 'manutencao' ? qtdBase : 0);
      let alugadosNaData = 0;

      if (dataFiltro) {
          const pedidosNessaData = locacoes.filter(loc => 
              !loc.arquivado &&
              !loc.archived &&
              loc.status !== 'cancelado' && 
              loc.status !== 'arquivado' &&
              loc.status !== 'finalizado'
          );
          pedidosNessaData.forEach(pedido => {
              if (pedido.itens && Array.isArray(pedido.itens)) {
                  const itemEncontrado = pedido.itens.find(i => 
                    i.id === item.id ||
                    (i.codigo && item.codigo && i.codigo === item.codigo) ||
                    (i.nome && item.nome && i.nome.trim().toLowerCase() === item.nome.trim().toLowerCase())
                  );
                  if (itemEncontrado) alugadosNaData += Number(itemEncontrado.qtd || itemEncontrado.quantidade || 1);
              }
          });
      }

      const tudoQuebrado = qtdBase > 0 && emMaint >= qtdBase;
      const estaTotalmenteAlugado = dataFiltro && qtdBase > 0 && (alugadosNaData + emMaint >= qtdBase);
      const disponivelTotal = Math.max(0, qtdBase - emMaint - alugadosNaData);

      return { 
          qtdBase, disponivelTotal, alugados: alugadosNaData, emMaint, emManutencao: emMaint, tudoQuebrado, estaTotalmenteAlugado, isDeco
      };
  };

  const dbCategorias = itens.map(i => i.categoria).filter(Boolean);
  const padraoCategorias = Object.keys(CATEGORIAS_FISICAS);
  const categoriasUnicas = Array.from(new Set([...padraoCategorias, ...dbCategorias])).sort();
  const localizacoesUnicas = Array.from(new Set(itens.map(i => i.localizacao).filter(Boolean))).sort();

  const totalItens = itens.length;
  const valorAcervo = itens.reduce((acc, i) => acc + (Number(i.financeiro?.valorCompra || i.valorCompra || i.financeiro?.valorReposicao || 0) * Number(i.quantidade || 1)), 0);
  const valorReposicaoTotal = itens.reduce((acc, i) => acc + (Number(i.valorReposicao || i.financeiro?.valorReposicao || (Number(i.financeiro?.valorAluguel || i.preco || 0) * 3)) * Number(i.quantidade || 1)), 0);
  const emManutencaoTotal = itens.reduce((acc, i) => acc + (i.qtdManutencao !== undefined ? i.qtdManutencao : (i.status === 'manutencao' ? i.quantidade : 0)), 0);
  const visiveis = itens.filter(i => i.configuracao?.visivelCatalogo !== false).length;
  const percentualVisivel = totalItens > 0 ? Math.round((visiveis / totalItens) * 100) : 0;

  const pedidosAtivos = locacoes.filter(loc => {
      const s = String(loc.status || '').toLowerCase();
      return s.includes('confirmado') || s.includes('preparacao');
  });

  pedidosAtivos.sort((a,b) => {
      const dA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 9999999999999;
      const dB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 9999999999999;
      return dA - dB;
  });

  let itensFiltrados = itens
    .filter(i => {
        const termo = busca.toLowerCase();
        return i.nome?.toLowerCase().includes(termo) || i.codigo?.toLowerCase().includes(termo);
    })
    .filter(i => {
        if (!categoriaFiltro) return true;
        return i.categoria === categoriaFiltro;
    })
    .filter(i => {
        if (!localizacaoFiltro) return true;
        return i.localizacao === localizacaoFiltro;
    })
    .filter(i => {
        const { tudoQuebrado, estaTotalmenteAlugado, emManutencao } = calcularDisponibilidadeNaData(i);
        if (statusFiltro === 'disponivel') return !tudoQuebrado && !estaTotalmenteAlugado;
        if (statusFiltro === 'indisponivel') return tudoQuebrado || estaTotalmenteAlugado;
        if (statusFiltro === 'manutencao') return emManutencao > 0;
        return true;
    });

  itensFiltrados.sort((a, b) => {
      const nomeA = (a.nome || '').toLowerCase();
      const nomeB = (b.nome || '').toLowerCase();
      if (ordemAlfabetica === 'A-Z') return nomeA.localeCompare(nomeB);
      if (ordemAlfabetica === 'Z-A') return nomeB.localeCompare(nomeA);
      return 0;
  });

  const itensEmReparoSelecionados = itens.filter(i => 
    itensSelecionados.has(i.id) && (Number(i.qtdManutencao || 0) > 0 || i.status === 'manutencao')
  );

  const imprimirListaFiltrada = async () => {
      const pdfDoc = new jsPDF();
      const agora = new Date();
      const dataHora = agora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // 🔥 Busca dados da empresa no Firestore (configuracoes_empresa)
      let nomeEmpresa = 'CELEBRE SISTEMA DE GESTÃO';
      let logoUrl = null;
      try {
          const confRef = doc(db, 'configuracoes_empresa', tenantId);
          const confSnap = await getDoc(confRef);
          if (confSnap.exists()) {
              const data = confSnap.data();
              if (data.nomeEmpresa) nomeEmpresa = data.nomeEmpresa.toUpperCase();
              if (data.logotipo) logoUrl = data.logotipo;
          }
      } catch (e) { console.warn('Erro ao buscar config empresa para PDF:', e); }

      const nomeImpressor = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || 'Usuário';

      // ── CABEÇALHO ──────────────────────────────────────────────
      const pageWidth = pdfDoc.internal.pageSize.getWidth();

      // Fundo do cabeçalho
      pdfDoc.setFillColor(15, 23, 42);
      pdfDoc.rect(0, 0, pageWidth, 38, 'F');

      // Logo da empresa (se existir)
      if (logoUrl) {
          try {
              const formato = logoUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
              pdfDoc.addImage(logoUrl, formato, 10, 5, 28, 28);
          } catch (e) { console.warn('Erro ao inserir logo no PDF:', e); }
      }

      const textoX = logoUrl ? 44 : 14;

      // Nome da empresa
      pdfDoc.setFontSize(15);
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setTextColor(255, 255, 255);
      pdfDoc.text(nomeEmpresa, textoX, 14);

      // Título do relatório
      let tituloRelatorio = 'Lista de Verificação de Estoque';
      if (localizacaoFiltro) tituloRelatorio += ` · ${localizacaoFiltro}`;
      else if (categoriaFiltro) tituloRelatorio += ` · Categoria: ${categoriaFiltro}`;

      pdfDoc.setFontSize(10);
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setTextColor(203, 213, 225);
      pdfDoc.text(tituloRelatorio, textoX, 23);

      // Linha separadora fina
      pdfDoc.setDrawColor(71, 85, 105);
      pdfDoc.line(textoX, 27, pageWidth - 14, 27);

      // Data, hora e quem imprimiu
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(148, 163, 184);
      pdfDoc.text(`Impresso em: ${dataHora}   |   Por: ${nomeImpressor}   |   Peças listadas: ${itensFiltrados.length}`, textoX, 34);

      // ── TABELA ──────────────────────────────────────────────────
      const colunas = [["CÓDIGO", "PRODUTO", "CATEGORIA", "LOCALIZAÇÃO", "QTD FÍSICA"]];
      const linhas = itensFiltrados.map(item => {
          const { qtdBase, isDeco } = calcularDisponibilidadeNaData(item);
          return [
              item.codigo || "S/N",
              item.nome,
              item.categoria || "-",
              item.localizacao || "-",
              isDeco ? "1 Kit" : `${qtdBase} pçs`
          ];
      });

      autoTable(pdfDoc, {
          head: colunas,
          body: linhas,
          startY: 44,
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
              0: { cellWidth: 28, fontStyle: 'bold', textColor: [30, 41, 59] },
              4: { halign: 'center', fontStyle: 'bold' }
          },
          didDrawPage: () => {
              const paginaAtual = pdfDoc.internal.getCurrentPageInfo().pageNumber;
              pdfDoc.setFontSize(8);
              pdfDoc.setTextColor(148, 163, 184);
              pdfDoc.text(
                  `${nomeEmpresa}  ·  Página ${paginaAtual}`,
                  14,
                  pdfDoc.internal.pageSize.getHeight() - 8
              );
              pdfDoc.text(
                  dataHora,
                  pageWidth - 14,
                  pdfDoc.internal.pageSize.getHeight() - 8,
                  { align: 'right' }
              );
          }
      });

      pdfDoc.save(`Lista_Estoque_${localizacaoFiltro || 'Geral'}_${agora.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);

      await registrarLog("EXPORTAÇÃO DE INVENTÁRIO", `Imprimiu a lista de verificação de estoque em PDF. Filtro: ${localizacaoFiltro || categoriaFiltro || 'Geral'}. Itens: ${itensFiltrados.length}.`);
  };

  if (loading) return <div style={{padding: '50px', textAlign: 'center', color: '#64748b'}}>Verificando permissões de acesso...</div>;

  if (!temAcesso) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', backgroundColor: '#f8fafc', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🔒</div>
          <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>Recurso Exclusivo</h2>
          <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '25px' }}>A gestão de Estoque e Acervo faz parte de um plano superior. Faça um upgrade agora mesmo para desbloquear todo o potencial do Celebre!</p>
          <button onClick={() => navigate('/planos')} style={{ background: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}>Ver Planos Disponíveis</button>
        </div>
      </div>
    );
  }

  return (
    <div className="estoque-container clientes-container fade-in" onClick={() => setMenuAberto(null)}>
      
      {/* HERO CABEÇALHO IDÊNTICO AO GESTÃO DE CLIENTES */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            <i className="fas fa-boxes-stacked"></i>
          </div>
          <div className="welcome-text">
            <h1>Gestão de Acervo e Estoque</h1>
            <p>Controle logístico, financeiro e catálogo online. <strong style={{color: totalItens >= limiteEstoque ? '#ef4444' : '#15803d', whiteSpace: 'nowrap', display: 'inline-block'}}>(Limite: {totalItens.toLocaleString('pt-BR')} / {limiteEstoque.toLocaleString('pt-BR')})</strong></p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary-celebre" onClick={imprimirListaFiltrada}>
            <i className="fas fa-print"></i>
            <span>Imprimir Lista</span>
          </button>
          <button type="button" className="btn-primary-celebre" onClick={() => irParaCadastro()} style={{ opacity: totalItens >= limiteEstoque ? 0.7 : 1 }}>
            <i className="fas fa-plus"></i>
            <span>NOVO ITEM</span>
          </button>
        </div>
      </div>

      {/* MODAL DE CÂMERA AO VIVO NO ESTOQUE */}
      {cameraEstoqueAberta && (
        <div className="modal-checkin-overlay">
          <div className="modal-checkin-box animate-pop" style={{ maxWidth: '420px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', color: '#0f172a' }}>
              <strong style={{ fontSize: '0.9rem' }}><i className="fas fa-camera"></i> Escanear Código de Barras / QR Code</strong>
              <button type="button" onClick={pararScannerEstoque} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>✕ Fechar</button>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 10px 0' }}>Aproxime a etiqueta com QR Code ou Código de Barras da peça para localizá-la no acervo.</p>
            <div id="reader-camera-estoque" style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', background: '#000' }}></div>
          </div>
        </div>
      )}

      {/* CARDS DE DASHBOARD 4 COLUNAS IDÊNTICOS AO GESTÃO DE CLIENTES */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro card-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-boxes-stacked"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">TOTAL DE ITENS</span>
            <strong className="stat-number">{totalItens}</strong>
            <small className="stat-desc">Cadastrados no acervo</small>
          </div>
        </div>

        <div className="stat-card-pro card-amber">
          <div className="stat-icon-wrapper icon-amber">
            <i className="fas fa-coins"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">VALOR DO ACERVO</span>
            <strong className="stat-number">R$ {valorAcervo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Patrimônio investido</small>
          </div>
        </div>

        <div className="stat-card-pro card-blue">
          <div className="stat-icon-wrapper icon-blue">
            <i className="fas fa-shield-halved"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">VALOR REPOSIÇÃO</span>
            <strong className="stat-number">R$ {valorReposicaoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Garantia total acervo</small>
          </div>
        </div>

        <div 
          className={`stat-card-pro card-red ${statusFiltro === 'manutencao' ? 'ativo' : ''}`}
          onClick={() => setStatusFiltro(prev => prev === 'manutencao' ? '' : 'manutencao')}
          style={{ cursor: 'pointer', border: statusFiltro === 'manutencao' ? '2px solid #ef4444' : undefined }}
          title="Clique para filtrar apenas as peças em manutenção/reparo"
        >
          <div className="stat-icon-wrapper icon-red">
            <i className="fas fa-wrench"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">EM MANUTENÇÃO</span>
            <strong className="stat-number">{emManutencaoTotal}</strong>
            <small className="stat-desc">{statusFiltro === 'manutencao' ? '🎯 Filtrando reparos' : 'Necessitam reparos'}</small>
          </div>
        </div>

        <div className="stat-card-pro card-green">
          <div className="stat-icon-wrapper icon-green">
            <i className="fas fa-store"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">VISÍVEL CATÁLOGO</span>
            <strong className="stat-number">{percentualVisivel}%</strong>
            <small className="stat-desc">Disponível no catálogo</small>
          </div>
        </div>
      </div>

      {/* ── BANNER DE ALERTA DE PREVISÃO DE PRONTIDÃO ── */}
      {(() => {
        const hojeISO = new Date().toISOString().split('T')[0];
        const itensComPrevisaoAlerta = itens.filter(i => {
          const emMaint = i.qtdManutencao !== undefined ? Number(i.qtdManutencao) : (i.status === 'manutencao' ? Number(i.quantidade || 1) : 0);
          return emMaint > 0 && i.dataPrevisaoRetorno && i.dataPrevisaoRetorno <= hojeISO;
        });

        if (itensComPrevisaoAlerta.length === 0) return null;

        return (
          <div className="banner-alerta-prontidao">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '0', flex: 1 }}>
              <span className="alerta-icon-circulo"><i className="fas fa-triangle-exclamation"></i></span>
              <strong style={{ color: '#991b1b', fontSize: '0.82rem', fontWeight: '800', lineHeight: '1.2' }}>
                {itensComPrevisaoAlerta.length} peça(s) com prontidão de reparo {itensComPrevisaoAlerta.some(i => i.dataPrevisaoRetorno < hojeISO) ? 'VENCIDA' : 'para HOJE'}!
              </strong>
            </div>
            <button 
              type="button"
              onClick={() => setStatusFiltro(prev => prev === 'manutencao' ? '' : 'manutencao')} 
              className="btn-acao-alerta-reparo"
            >
              {statusFiltro === 'manutencao' ? <><i className="fas fa-eye-slash"></i> Limpar Filtro</> : <><i className="fas fa-wrench"></i> Ver Peças</>}
            </button>
          </div>
        );
      })()}

      {/* CONTAINER TABELA E FILTROS IDÊNTICOS AO GESTÃO DE CLIENTES */}
      <div className="table-card-container">
        <div className="table-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon"><i className="fas fa-magnifying-glass"></i></span>
            <input type="text" placeholder="Buscar por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          {/* 🔢 Toggle de Visualização (Lista / Cards) em linha exclusiva no mobile */}
          <div className="view-toggle-group">
            <button
              type="button"
              className={`view-toggle-btn${modoVisualizacao === 'lista' ? ' active' : ''}`}
              onClick={() => setModoVisualizacao('lista')}
              title="Visão em Lista"
            >
              <i className="fas fa-list"></i>
              <span>Lista</span>
            </button>
            <button
              type="button"
              className={`view-toggle-btn${modoVisualizacao === 'grid' ? ' active' : ''}`}
              onClick={() => setModoVisualizacao('grid')}
              title="Visão em Cards"
            >
              <i className="fas fa-grip"></i>
              <span>Cards</span>
            </button>
          </div>

          <div className="filter-select-container filter-date-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="date" className="filter-select" value={dataFiltro} onChange={e => {
                setDataFiltro(e.target.value);
                if (!e.target.value && statusFiltro === 'indisponivel') setStatusFiltro('');
            }} />
            {dataFiltro && <button className="btn-limpar-data" onClick={limparFiltroData} title="Limpar Data">✕</button>}
          </div>

          <div className="filter-select-container filter-localizacao-container">
            <select className="filter-select" value={localizacaoFiltro} onChange={e => setLocalizacaoFiltro(e.target.value)}>
              <option value="">Galpão: Todos</option>
              {localizacoesUnicas.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-container filter-status-container">
            <select className="filter-select" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
              <option value="">Status: Todos</option>
              <option value="disponivel">Somente Disponíveis</option>
              <option value="manutencao">Somente em Manutenção</option>
              {dataFiltro && <option value="indisponivel">Somente Alugados / Esgotados</option>}
            </select>
          </div>

          <div className="filter-select-container filter-categoria-container">
            <select className="filter-select" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
              <option value="">Categoria: Todas</option>
              {categoriasUnicas.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button className="btn-secondary-celebre btn-ordem-estoque" onClick={() => setOrdemAlfabetica(prev => prev === 'A-Z' ? 'Z-A' : 'A-Z')} title="Alterar Ordem Alfabética">
              {ordemAlfabetica === 'A-Z' ? <><i className="fas fa-arrow-down-a-z"></i> A - Z</> : <><i className="fas fa-arrow-up-z-a"></i> Z - A</>}
          </button>
        </div>

        {/* ── BARRA DE SELEÇÃO EM MASSA ── */}
        {itensSelecionados.size > 0 && (
          <div className="bulk-action-bar">
            <div className="bulk-info">
              <label className="bulk-select-all-label" title="Clique para selecionar ou desmarcar todos os itens visíveis">
                <input
                  type="checkbox"
                  checked={itensFiltrados.length > 0 && itensSelecionados.size === itensFiltrados.length}
                  onChange={() => {
                    if (itensSelecionados.size === itensFiltrados.length) setItensSelecionados(new Set());
                    else setItensSelecionados(new Set(itensFiltrados.map(i => i.id)));
                  }}
                />
                <span className="bulk-select-all-text">
                  {itensSelecionados.size === itensFiltrados.length ? 'Todos selecionados' : 'Selecionar todos'}
                </span>
              </label>
              <span className="bulk-count-badge">{itensSelecionados.size} de {itensFiltrados.length}</span>
            </div>
            <div className="bulk-buttons">
              {itensEmReparoSelecionados.length > 0 && (
                <button 
                  type="button"
                  className="bulk-btn-success" 
                  onClick={concluirManutencaoEmMassa}
                  title={`Concluir Reparo dos ${itensEmReparoSelecionados.length} item(ns) em manutenção`}
                >
                  <i className="fas fa-check-circle"></i>
                  <span className="bulk-btn-text-desktop">Concluir Reparo ({itensEmReparoSelecionados.length})</span>
                  <span className="bulk-btn-text-mobile">Liberar ({itensEmReparoSelecionados.length})</span>
                </button>
              )}
              <button 
                type="button"
                className="bulk-btn-danger" 
                onClick={excluirEmMassa}
                title={`Excluir ${itensSelecionados.size} item(ns) selecionado(s)`}
              >
                <i className="fas fa-trash-can"></i>
                <span>Excluir ({itensSelecionados.size})</span>
              </button>
              <button 
                type="button"
                className="bulk-btn-cancel" 
                onClick={() => setItensSelecionados(new Set())}
                title="Desmarcar seleção"
              >
                <i className="fas fa-xmark"></i>
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{padding: '50px', textAlign: 'center', color: '#64748b'}}>Carregando acervo...</div>
        ) : modoVisualizacao === 'grid' ? (

          /* ── VISÃO EM CARDS ── */
          <div className="estoque-cards-grid">
            {itensFiltrados.map(item => {
              const { qtdBase, disponivelTotal, estaTotalmenteAlugado, tudoQuebrado, isDeco } = calcularDisponibilidadeNaData(item);
              let labelPill = 'DISPONÍVEL';
              let bgPill = '#f0fdf4', colorPill = '#166534', borderPill = '#bbf7d0';
              if (estaTotalmenteAlugado) { labelPill = 'ALUGADO'; bgPill = '#fef2f2'; colorPill = '#b91c1c'; borderPill = '#fecaca'; }
              else if (tudoQuebrado) { labelPill = 'EM REPARO'; bgPill = '#fffbeb'; colorPill = '#b45309'; borderPill = '#fde68a'; }
              else if (qtdBase === 0 && !isDeco) { labelPill = 'S/ ESTOQUE'; bgPill = '#f8fafc'; colorPill = '#64748b'; borderPill = '#e2e8f0'; }
              const valorAluguelFormatado = item.financeiro?.valorAluguel ? Number(item.financeiro.valorAluguel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
              const posImg = item.posicoesFoco?.[0];
              const ehKitPai = item.especificacoes?.isKitPai || item.especificacoes?.isKit || (item.especificacoes?.pecasKit?.length > 0);
              const ehSubPeca = item.especificacoes?.isSubPeca || (item.codigo && /-P\d+$/.test(item.codigo) && !ehKitPai);
              const selecionado = itensSelecionados.has(item.id);

              return (
                <div key={item.id} className={`estoque-card${selecionado ? ' estoque-card-selected' : ''}`} style={{ opacity: estaTotalmenteAlugado ? 0.75 : 1 }}>
                  <input type="checkbox" className="estoque-card-check" checked={selecionado} onChange={() => toggleSelecao(item.id)} onClick={e => e.stopPropagation()} />

                  <div className="estoque-card-photo" onClick={() => item.foto && setImagemAmpliada(item.foto)}>
                    {item.foto
                      ? <img src={item.foto} alt={item.nome} style={{ objectPosition: posImg ? `${posImg.x}% ${posImg.y}%` : '50% 50%' }} />
                      : <div className="estoque-card-no-photo"><i className="fas fa-image"></i></div>}
                    {item.foto && <div className="photo-zoom-hint" title="Clique para ampliar foto"><i className="fas fa-magnifying-glass-plus"></i></div>}
                    <span className="badge estoque-card-status" style={{ backgroundColor: bgPill, color: colorPill, border: `1px solid ${borderPill}` }}>{labelPill}</span>
                  </div>

                  {(ehKitPai || ehSubPeca || isDeco) && (
                    <div className="estoque-card-badges">
                      {ehKitPai && <span className="card-badge-kit"><i className="fas fa-box"></i> KIT</span>}
                      {ehSubPeca && <span className="card-badge-peca"><i className="fas fa-puzzle-piece"></i> PEÇA</span>}
                      {isDeco && <span className="card-badge-deco"><i className="fas fa-wand-magic-sparkles"></i> DECO</span>}
                    </div>
                  )}

                  <div className="estoque-card-info">
                    <strong className="estoque-card-nome" style={{ color: item.nome.includes('⚠️') ? '#ef4444' : 'var(--texto-principal, #0f172a)' }}>{item.nome}</strong>
                    <span className="estoque-card-codigo">CÓD: {item.codigo || 'S/N'}</span>
                    <span className="estoque-card-cat">{item.categoria || '—'}</span>
                    {item.localizacao && <span className="estoque-card-loc"><i className="fas fa-location-dot"></i> {item.localizacao}</span>}
                  </div>

                    <div className="estoque-card-footer">
                      <div className="estoque-card-price-row">
                        <strong>R$ {valorAluguelFormatado}</strong>
                        <span>{disponivelTotal} {isDeco ? 'kit' : 'un'} disp.</span>
                      </div>
                      <div className="estoque-card-actions">
                        <button className="action-btn roi" onClick={(e) => { e.stopPropagation(); setModalRoiItem(item); }} title="Ver Raio-X e ROI da Peça"><i className="fas fa-chart-pie"></i></button>
                        <button className="action-btn reposicao" onClick={(e) => { e.stopPropagation(); abrirModalReposicao(item); }} title="Pedir Reposição / Compra"><i className="fas fa-cart-plus"></i></button>
                        <button className="action-btn add-pedido" onClick={(e) => { e.stopPropagation(); setItemParaPedido(item); setPedidoSelecionadoId(''); setModalAddPedidoAberto(true); }} title="Inserir direto num Pedido"><i className="fas fa-plus"></i></button>
                        <button className="action-btn manutencao" onClick={(e) => { e.stopPropagation(); abrirModalManutencao(item); }} title="Manutenção / Reparo"><i className="fas fa-screwdriver-wrench"></i></button>
                        <button className="action-btn edit" onClick={(e) => { e.stopPropagation(); irParaCadastro(item); }} title="Editar"><i className="fas fa-pen-to-square"></i></button>
                        <button className="action-btn duplicate" onClick={(e) => { e.stopPropagation(); duplicarItem(item); }} title="Duplicar Item"><i className="fas fa-clone"></i></button>
                        <button className="action-btn delete" onClick={async (e) => { e.stopPropagation(); if(window.confirm('Excluir permanentemente do acervo?')) { await registrarLog('EXCLUSÃO DE ACERVO', `Apagou permanentemente o item "${item.nome}" do estoque.`); deleteDoc(doc(db, 'estoque', item.id)).then(carregarDados); }}} title="Excluir"><i className="fas fa-trash-can"></i></button>
                      </div>
                    </div>
                </div>
              );
            })}
            {itensFiltrados.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#64748b' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🕵️‍♀️</div>
                <strong>Nenhuma peça encontrada com esses filtros!</strong>
                <p style={{ fontSize: '12px', marginTop: '5px' }}>Tente mudar a categoria, o status ou limpar a data.</p>
              </div>
            )}
          </div>

        ) : (

          /* ── VISÃO EM LISTA ── */
          <div className="table-responsive-wrapper">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{width:'40px', textAlign:'center'}}>
                    <input
                      type="checkbox"
                      title="Selecionar todos visíveis"
                      checked={itensFiltrados.length > 0 && itensSelecionados.size === itensFiltrados.length}
                      onChange={() => {
                        if (itensSelecionados.size === itensFiltrados.length) setItensSelecionados(new Set());
                        else setItensSelecionados(new Set(itensFiltrados.map(i => i.id)));
                      }}
                    />
                  </th>
                  <th>PRODUTO</th>
                  <th>CATEGORIA</th>
                  <th>VALOR LOCAÇÃO</th>
                  <th style={{textAlign: 'center'}}>{dataFiltro ? 'NO DIA' : 'ESTOQUE'}</th>
                  <th style={{textAlign: 'center'}}>STATUS</th>
                  <th style={{textAlign: 'right'}}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map(item => {
                  const { qtdBase, disponivelTotal, emMaint, estaTotalmenteAlugado, tudoQuebrado, isDeco } = calcularDisponibilidadeNaData(item);
                  let labelPill = 'DISPONÍVEL';
                  let bgPill = '#f0fdf4'; let colorPill = '#166534'; let borderPill = '#bbf7d0';
                  if (estaTotalmenteAlugado) { labelPill = 'ALUGADO'; bgPill = '#fef2f2'; colorPill = '#b91c1c'; borderPill = '#fecaca'; }
                  else if (tudoQuebrado) { labelPill = 'EM REPARO'; bgPill = '#fffbeb'; colorPill = '#b45309'; borderPill = '#fde68a'; }
                  else if (qtdBase === 0 && !isDeco) { labelPill = 'S/ ESTOQUE'; bgPill = '#f8fafc'; colorPill = '#64748b'; borderPill = '#e2e8f0'; }
                  const estoqueBaixo = !dataFiltro && item.configuracao?.alertaEstoque === 'Avisar' && qtdBase > 0 && disponivelTotal <= item.estoqueMinimo;
                  const valorAluguelFormatado = item.financeiro?.valorAluguel ? Number(item.financeiro.valorAluguel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                  const posImg = item.posicoesFoco?.[0];
                  const ehKitPai = item.especificacoes?.isKitPai || item.especificacoes?.isKit || (item.especificacoes?.pecasKit && item.especificacoes?.pecasKit.length > 0);
                  const ehSubPeca = item.especificacoes?.isSubPeca || (item.codigo && /-P\d+$/.test(item.codigo) && !ehKitPai);
                  const selecionado = itensSelecionados.has(item.id);

                  return (
                    <tr key={item.id} style={{ opacity: estaTotalmenteAlugado ? 0.6 : 1, background: selecionado ? 'var(--azul-selecionado, #eff6ff)' : undefined }}>
                      <td style={{textAlign:'center'}}>
                        <input type="checkbox" checked={selecionado} onChange={() => toggleSelecao(item.id)} onClick={e => e.stopPropagation()} />
                      </td>
                      <td>
                        <div className="pro-product-cell-wrapper" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, maxWidth: '100%' }}>
                          <div className="pro-product-photo-box" style={{ width: '48px', height: '48px', backgroundColor: 'var(--fundo-cinza, #f8fafc)', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid var(--borda, #e2e8f0)', flexShrink: 0, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {item.foto ? (
                                <img src={item.foto} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', objectPosition: posImg ? `${posImg.x}% ${posImg.y}%` : '50% 50%' }} onClick={(e) => { e.stopPropagation(); setImagemAmpliada(item.foto); }} title="Ampliar"/>
                              ) : ( <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', color:'#94a3b8' }}><i className="fas fa-image"></i></div> )}
                          </div>
                          <div className="pro-product-info-col" style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                              {/* 1. NOME DO ITEM */}
                              <strong className="pro-product-title-text" style={{ display: 'block', color: item.nome.includes('⚠️') ? '#ef4444' : 'var(--texto-principal, #0f172a)', fontSize: '0.93rem', fontWeight: '700', lineHeight: '1.25' }}>
                                  {item.nome}
                              </strong>

                              {/* 2. CÓDIGO + SE É KIT OU AVULSO */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '1px' }}>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--texto-secundario, #64748b)', fontWeight: '600' }}>
                                      CÓD: {item.codigo || 'S/N'}
                                  </span>
                                  {ehKitPai && <span style={{background: '#0f172a', color: '#fde68a', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '800', border: '1px solid #c5a059', display: 'inline-block'}}>📦 KIT</span>}
                                  {ehSubPeca && <span style={{background: '#fef3c7', color: '#b48a3c', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '800', border: '1px solid #fde68a', display: 'inline-block'}}>🧩 PEÇA</span>}
                                  {isDeco && <span style={{background: '#b45309', color: '#fff', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px', display: 'inline-block'}}>✨ DECO</span>}
                              </div>

                              {/* 3. LOCALIZAÇÃO (SE HOUVER) */}
                              {item.localizacao && (
                                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '1px' }}>
                                      📍 {item.localizacao}
                                  </span>
                              )}

                              {/* 4. ALERTA E AÇÕES DE PRONTIDÃO DE REPARO */}
                              {emMaint > 0 && (() => {
                                const prevData = item.dataPrevisaoRetorno || '';
                                const hojeLocal = new Date().toISOString().split('T')[0];
                                const eProntidaoVencida = prevData && prevData < hojeLocal;
                                const eProntidaoHoje = prevData && prevData === hojeLocal;
                                const diffDias = prevData && prevData > hojeLocal 
                                  ? Math.ceil((new Date(prevData + 'T00:00:00') - new Date(hojeLocal + 'T00:00:00')) / (1000 * 3600 * 24))
                                  : 999;
                                const eProntidaoProxima = diffDias >= 1 && diffDias <= 3;

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '3px' }}>
                                    <span style={{ 
                                       background: (eProntidaoVencida || eProntidaoHoje) ? '#fef2f2' : eProntidaoProxima ? '#fffbeb' : '#f8fafc', 
                                       color: (eProntidaoVencida || eProntidaoHoje) ? '#991b1b' : eProntidaoProxima ? '#b45309' : '#475569', 
                                       border: (eProntidaoVencida || eProntidaoHoje) ? '1px solid #fecaca' : eProntidaoProxima ? '1px solid #fde68a' : '1px solid #e2e8f0', 
                                       fontSize: '0.73rem', 
                                       padding: '4px 8px', 
                                       borderRadius: '6px', 
                                       fontWeight: '800', 
                                       display: 'inline-flex', 
                                       alignItems: 'center', 
                                       gap: '4px', 
                                       maxWidth: '100%',
                                       whiteSpace: 'normal',
                                       wordBreak: 'break-word',
                                       lineHeight: '1.35',
                                       boxSizing: 'border-box'
                                     }}>
                                       {eProntidaoVencida 
                                         ? `⏰ REPARO VENCIDO (Prevista: ${formatarDataBR(prevData)})` 
                                         : eProntidaoHoje 
                                         ? `🔔 PRONTIDÃO HOJE (${formatarDataBR(prevData)})` 
                                         : eProntidaoProxima 
                                         ? `⚠️ Reparo Urgente (${diffDias === 1 ? 'Amanhã' : `em ${diffDias} dias`} - ${formatarDataBR(prevData)})` 
                                         : `🛠️ ${emMaint} un em manutenção${prevData ? ` (Prev: ${formatarDataBR(prevData)})` : ''}`}
                                     </span>

                                     {(eProntidaoVencida || eProntidaoHoje || eProntidaoProxima) && (
                                       <button
                                         type="button"
                                         onClick={(e) => { e.stopPropagation(); concluirManutencaoDireta(item); }}
                                         style={{ 
                                           background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', 
                                           color: '#ffffff', 
                                           border: 'none', 
                                           padding: '5px 10px', 
                                           borderRadius: '6px', 
                                           fontSize: '0.74rem', 
                                           fontWeight: '800', 
                                           cursor: 'pointer', 
                                           display: 'inline-flex', 
                                           alignItems: 'center', 
                                           justifyContent: 'center',
                                           gap: '4px', 
                                           maxWidth: '100%',
                                           whiteSpace: 'normal',
                                           wordBreak: 'break-word',
                                           lineHeight: '1.3',
                                           boxSizing: 'border-box',
                                           boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)' 
                                         }}
                                         title="Reparo concluído? Clique para disponibilizar todas as unidades no acervo livre!"
                                       >
                                         ✅ Concluir Reparo (Liberar Estoque)
                                       </button>
                                     )}

                                    {/* 🚨 INSÍGNIA DE CONFLITO OPERACIONAL COM PEDIDOS ATIVOS */}
                                    {(() => {
                                       const conflitosAtivos = (locacoes || []).filter(loc => {
                                         if (loc.arquivado || loc.archived) return false;
                                         const st = (loc.status || '').toLowerCase();
                                         if (['cancelado', 'arquivado', 'finalizado', 'orcamento', 'orçamento'].includes(st)) return false;
                                         if (!loc.dataRetirada || !loc.dataDevolucao) return false;
                                         const temNoPedido = (loc.itens || loc.carrinho || []).some(it => {
                                           const bateDireto = String(it.id) === String(item.id) || (it.codigo && item.codigo && it.codigo === item.codigo) || (it.nome && item.nome && it.nome.trim().toLowerCase() === item.nome.trim().toLowerCase());
                                           if (bateDireto) return true;
                                           const comps = it.itensDecoracao || it.itensDoKit || it.pecasKit || it.especificacoes?.itensDecoracao || it.especificacoes?.itensDoKit || it.especificacoes?.pecasKit || [];
                                           return comps.some(p => String(p.id) === String(item.id) || (p.codigo && item.codigo && p.codigo === item.codigo) || (p.nome && item.nome && p.nome.trim().toLowerCase() === item.nome.trim().toLowerCase()));
                                         });
                                         if (!temNoPedido) return false;
                                         const prevRet = item.dataPrevisaoRetorno;
                                         if (!prevRet) return true;
                                         return prevRet >= loc.dataRetirada;
                                       });

                                       if (conflitosAtivos.length === 0) return null;
                                       const conf1 = conflitosAtivos[0];
                                       const numPedConf = conf1.numeroPedido || conf1.id?.substring(0,6).toUpperCase();

                                       return (
                                         <span style={{ 
                                           background: '#fee2e2', 
                                           color: '#b91c1c', 
                                           border: '1.5px solid #ef4444', 
                                           fontSize: '0.73rem', 
                                           padding: '4px 8px', 
                                           borderRadius: '6px', 
                                           fontWeight: '900', 
                                           display: 'inline-flex', 
                                           alignItems: 'center', 
                                           gap: '4px',
                                           marginTop: '2px',
                                           maxWidth: '100%',
                                           whiteSpace: 'normal',
                                           wordBreak: 'break-word',
                                           lineHeight: '1.35',
                                           boxSizing: 'border-box',
                                           boxShadow: '0 2px 6px rgba(239, 68, 68, 0.2)'
                                         }}>
                                           🚨 CONFLITO DE LOCAÇÃO: Pedido #{numPedConf} ({conf1.clienteNome} - {conf1.dataRetirada.split('-').reverse().join('/')})
                                         </span>
                                       );
                                     })()}
                                  </div>
                                );
                              })()}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.85rem' }}><span className="cat-text-val">{item.categoria || '-'}</span></td>
                      <td><strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>R$ {valorAluguelFormatado}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: (estaTotalmenteAlugado || tudoQuebrado || (qtdBase===0 && !isDeco)) ? '#94a3b8' : '#334155' }}>
                                {disponivelTotal} <span style={{fontSize: '0.75rem', fontWeight: 'normal'}}>{isDeco ? 'kit' : 'un'}</span>
                            </strong>
                            {emMaint > 0 && !tudoQuebrado && (
                              <span style={{ fontSize: '9px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '4px', marginTop: '3px', fontWeight: '800' }}>
                                🛠️ {emMaint} em reparo
                              </span>
                            )}
                            {estoqueBaixo && <span style={{fontSize: '9px', color: '#ea580c', background: '#ffedd5', padding: '2px 6px', borderRadius: '4px', marginTop: '4px'}}>Baixo</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge" style={{ backgroundColor: bgPill, color: colorPill, border: `1px solid ${borderPill}` }}>{labelPill}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions-container">
                            <button className="action-btn roi" onClick={(e) => { e.stopPropagation(); setModalRoiItem(item); }} title="Ver ROI e Giro da Peça"><i className="fas fa-chart-pie"></i></button>
                            <button className="action-btn reposicao" onClick={(e) => { e.stopPropagation(); abrirModalReposicao(item); }} title="Pedir Reposição / Compra"><i className="fas fa-cart-plus"></i></button>
                            <button className="action-btn add-pedido" onClick={(e) => { e.stopPropagation(); setItemParaPedido(item); setPedidoSelecionadoId(''); setModalAddPedidoAberto(true); }} title="Inserir direto num Pedido"><i className="fas fa-plus"></i></button>
                            <button className="action-btn manutencao" onClick={(e) => { e.stopPropagation(); abrirModalManutencao(item); }} title="Manutenção / Reparo"><i className="fas fa-screwdriver-wrench"></i></button>
                            <button className="action-btn edit" onClick={(e) => { e.stopPropagation(); irParaCadastro(item); }} title="Editar"><i className="fas fa-pen-to-square"></i></button>
                            <button className="action-btn duplicate" onClick={(e) => { e.stopPropagation(); duplicarItem(item); }} title="Duplicar Item"><i className="fas fa-clone"></i></button>
                            <button className="action-btn delete" onClick={async (e) => { e.stopPropagation(); if(window.confirm("Excluir permanentemente do acervo?")) { await registrarLog("EXCLUSÃO DE ACERVO", `Apagou permanentemente o item "${item.nome}" do estoque.`); deleteDoc(doc(db, "estoque", item.id)).then(carregarDados); }}} title="Excluir"><i className="fas fa-trash-can"></i></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {itensFiltrados.length === 0 && (
                    <tr>
                        <td colSpan="7" style={{textAlign:'center', padding:'40px', color:'#64748b'}}>
                            <div style={{fontSize: '40px', marginBottom: '10px'}}>🕵️‍♀️</div>
                            <strong>Nenhuma peça encontrada com esses filtros!</strong>
                            <p style={{fontSize: '12px', marginTop: '5px'}}>Tente mudar a categoria, o status ou limpar a data.</p>
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAddPedidoAberto && (
        <div className="modal-overlay-blur">
          <div className="modal-maintenance-card" style={{maxWidth: '550px'}}>
            <div className="modal-maintenance-header">
              <h3 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '10px'}}>🛒 Adicionar ao Pedido</h3>
              <button className="close-btn-modern" onClick={() => setModalAddPedidoAberto(false)}>×</button>
            </div>
            
            <div className="modal-maintenance-body" style={{padding: '20px'}}>
              <p style={{marginBottom: '20px', color: '#475569', fontSize: '14px', lineHeight: '1.5'}}>
                  Escolha abaixo em qual festa/pedido você quer inserir a peça:<br/>
                  <strong style={{color: '#0f172a', fontSize: '16px'}}>✨ {itemParaPedido?.nome}</strong>
              </p>
              
              <div className="lista-pedidos-moderna" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                {pedidosAtivos.length === 0 ? (
                    <div style={{textAlign: 'center', padding: '20px', background: '#f1f5f9', borderRadius: '8px', color: '#64748b'}}>
                        Nenhum pedido "Em Preparação" ou "Confirmado" no momento.
                    </div>
                ) : (
                    pedidosAtivos.map(p => {
                        const ehPreparacao = String(p.status).toLowerCase().includes('preparacao');
                        const isSelected = pedidoSelecionadoId === p.id;

                        return (
                            <div 
                                key={p.id}
                                onClick={() => setPedidoSelecionadoId(p.id)}
                                style={{
                                    padding: '12px 15px',
                                    border: isSelected ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                                    backgroundColor: isSelected ? '#eff6ff' : '#fff',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.2s',
                                    boxShadow: isSelected ? '0 4px 10px rgba(59, 130, 246, 0.1)' : 'none'
                                }}
                            >
                                <div>
                                    <strong style={{ display: 'block', color: isSelected ? '#1d4ed8' : '#0f172a', fontSize: '14px' }}>
                                        👤 {p.clienteNome}
                                    </strong>
                                    <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                                        📅 {p.dataRetirada ? p.dataRetirada.split('-').reverse().join('/') : 'Sem data'}
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: ehPreparacao ? '#ede9fe' : '#dcfce7',
                                    color: ehPreparacao ? '#7c3aed' : '#166534',
                                    textTransform: 'uppercase',
                                    border: `1px solid ${ehPreparacao ? '#c4b5fd' : '#86efac'}`
                                }}>
                                    {p.status}
                                </span>
                            </div>
                        )
                    })
                )}
              </div>
            </div>

            <div className="modal-maintenance-footer" style={{display: 'flex', gap: '10px', padding: '20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0'}}>
              <button className="btn-modal-cancel" style={{flex: 1, padding: '12px'}} onClick={() => setModalAddPedidoAberto(false)}>Cancelar</button>
              <button 
                  className="btn-modal-save" 
                  style={{flex: 2, padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: (!pedidoSelecionadoId || adicionandoAoPedido) ? 0.5 : 1}} 
                  onClick={salvarItemNoPedido} 
                  disabled={adicionandoAoPedido || !pedidoSelecionadoId}
              >
                  {adicionandoAoPedido ? 'Salvando...' : 'Adicionar ao Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalManutencao && ReactDOM.createPortal(
        <div className="modal-overlay-blur" onClick={() => setModalManutencao(false)}>
          <div className="modal-maintenance-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', borderRadius: '20px', overflow: 'hidden' }}>
            
            {/* CABEÇALHO */}
            <div className="modal-maintenance-header" style={{ background: '#0f172a', color: '#fff', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fde68a', fontWeight: '800' }}>🛠️ Controle de Manutenção & Reparabilidade</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
                  Gerencie o status de avaria, reparo e prontidão da peça
                </p>
              </div>
              <button className="close-btn-modern" onClick={() => setModalManutencao(false)} style={{ color: '#fff', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            <div className="modal-maintenance-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* ITEM SELECIONADO INFO CARD */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', background: '#e2e8f0', flexShrink: 0 }}>
                  {itemParaManutencao?.foto ? (
                    <img src={itemParaManutencao.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📷</div>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.95rem' }}>{itemParaManutencao?.nome}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    CÓD: <b>{itemParaManutencao?.codigo || 'S/N'}</b> | Estoque Total: <b>{itemParaManutencao?.quantidade || 1} un</b>
                  </div>
                </div>
              </div>

              {/* QUANTIDADE EM MANUTENÇÃO */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  QUANTIDADE NECESSITANDO REPARO (MÁX: {itemParaManutencao?.quantidade})
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    value={qtdMaint} 
                    onChange={(e) => setQtdMaint(e.target.value)}
                    min="0" 
                    max={itemParaManutencao?.quantidade} 
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '1rem', fontWeight: 'bold' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setQtdMaint(itemParaManutencao?.quantidade || 1)}
                    style={{ padding: '10px 14px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    Selecionar Todas ({itemParaManutencao?.quantidade})
                  </button>
                </div>
              </div>

              {/* MOTIVO DO REPARO / AVARIA */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  MOTIVO DO REPARO / DESCRIÇÃO DA AVARIA
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: Tinta descascada, perna trincada, limpeza profunda..." 
                  value={motivoManutencao} 
                  onChange={(e) => setMotivoManutencao(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                />
                
                {/* TAGS RÁPIDAS DE MOTIVOS */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {['🎨 Retoque de Pintura', '🔨 Marcenaria', '🧼 Higienização Profunda', '💥 Avaria Pós-Festa', '✨ Restauração'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setMotivoManutencao(tag)}
                      style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* CUSTO ESTIMADO DO CONSERTO E PREVISÃO DE PRONTIDÃO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    CUSTO ESTIMADO (R$)
                  </label>
                  <input 
                    type="text" 
                    placeholder="0,00" 
                    value={custoManutencao} 
                    onChange={(e) => setCustoManutencao(e.target.value)}
                    onBlur={handleBlurCusto}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'bold' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    PREVISÃO DE PRONTIDÃO
                  </label>
                  <input 
                    type="date" 
                    value={dataPrevisaoRetorno} 
                    onChange={(e) => setDataPrevisaoRetorno(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* 💰 VÍNCULO COM O FINANCEIRO */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '800', color: '#166534', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={lancarDespesaFinanceiro} 
                    onChange={e => setLancarDespesaFinanceiro(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                  />
                  💰 Registrar despesa de R$ {custoManutencao || '0,00'} no Financeiro automaticamente
                </label>

                {parseValorCusto(custoManutencao) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalManutencao(false);
                      navigate('/novo-lancamento', {
                        state: {
                          tipo: 'saida',
                          categoria: 'Manutenção e Reparos',
                          pecaId: itemParaManutencao.id,
                          pecaNome: itemParaManutencao.nome,
                          valor: parseValorCusto(custoManutencao),
                          descricao: `Manutenção de Peça: ${itemParaManutencao.nome}${motivoManutencao ? ' - ' + motivoManutencao : ''}`
                        }
                      });
                    }}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      background: '#ffffff',
                      border: '1px solid #86efac',
                      color: '#15803d',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    🔗 Abrir no Novo Lançamento Financeiro Completo
                  </button>
                )}
              </div>

            </div>

            {/* RODAPÉ DO MODAL */}
            <div className="modal-maintenance-footer" style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 20px 20px', display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className="btn-modal-cancel" 
                onClick={() => setModalManutencao(false)}
                style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 'bold', cursor: 'pointer', background: '#ffffff', color: '#475569' }}
              >
                Cancelar
              </button>

              {(Number(itemParaManutencao?.manutencao || itemParaManutencao?.emManutencao || itemParaManutencao?.qtdManutencao || 0) > 0 || itemParaManutencao?.status === 'manutencao') && (
                <button 
                  type="button" 
                  onClick={concluirManutencaoHoje}
                  style={{ flex: 1, padding: '12px 10px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(22,163,74,0.25)' }}
                >
                  ✅ Reparo Concluído (Liberar)
                </button>
              )}

              <button 
                type="button" 
                onClick={salvarManutencao}
                style={{ flex: 1, padding: '12px 10px', background: '#c5a059', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                🛠️ Confirmar Manutenção ({qtdMaint} un)
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* 📊 MODAL DE ROI & RENTABILIDADE / CONTABILIDADE DA PEÇA */}
      {modalRoiItem && ReactDOM.createPortal(
        (() => {
          const m = calcularMetricasItem(modalRoiItem);
          const precoAluguel = Number(modalRoiItem.financeiro?.valorAluguel || modalRoiItem.preco || 0);

          return (
            <div className="modal-roi-overlay" onClick={() => setModalRoiItem(null)}>
              <div className="modal-roi-card animate-pop" onClick={e => e.stopPropagation()}>
                
                {/* 👑 CABEÇALHO COMPACTO E SOFISTICADO */}
                <div className="modal-roi-header">
                  <div className="modal-roi-header-content">
                    <div className="modal-roi-header-icon">
                      <i className="fas fa-chart-pie"></i>
                    </div>
                    <div className="modal-roi-header-text">
                      <div className="modal-roi-badge-top">
                        <span className="modal-roi-badge-pill">INTELIGÊNCIA DE ACERVO</span>
                        <span className="modal-roi-badge-code">CÓD: {modalRoiItem.codigo || 'S/N'}</span>
                      </div>
                      <h3>Raio-X de Rentabilidade & ROI</h3>
                      <p>Performance operacional e histórico da peça</p>
                    </div>
                  </div>
                  
                  <div className="modal-roi-header-actions-right">
                    <button 
                      type="button" 
                      className={`modal-roi-btn-toggle-eye ${ocultarMetricasRoi ? 'active' : ''}`}
                      onClick={alternarOcultarMetricasRoi}
                      title={ocultarMetricasRoi ? "Mostrar métricas financeiras" : "Ocultar métricas financeiras"}
                    >
                      <i className={ocultarMetricasRoi ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                      <span>{ocultarMetricasRoi ? "Oculto" : "Visível"}</span>
                    </button>

                    <button className="modal-roi-btn-close" onClick={() => setModalRoiItem(null)} title="Fechar">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </div>

                <div className="modal-roi-body">
                  
                  {/* 🖼️ IDENTIFICAÇÃO DO PRODUTO EM 2 COLUNAS COMPACTAS */}
                  <div className="modal-roi-product-hero">
                    <div className="modal-roi-hero-photo-box">
                      {modalRoiItem.foto ? (
                        <img src={modalRoiItem.foto} alt={modalRoiItem.nome} />
                      ) : (
                        <div className="modal-roi-hero-no-photo"><i className="fas fa-image"></i></div>
                      )}
                    </div>
                    <div className="modal-roi-hero-details">
                      <h4 className="modal-roi-hero-title">{modalRoiItem.nome}</h4>
                      <div className="modal-roi-hero-grid-2">
                        <span className="modal-roi-info-chip"><i className="fas fa-tag"></i> {modalRoiItem.categoria || 'Geral'}</span>
                        <span className="modal-roi-info-chip price"><i className="fas fa-coins"></i> Aluguel: <b>R$ {precoAluguel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></span>
                        <span className="modal-roi-info-chip"><i className="fas fa-boxes-stacked"></i> Estoque: <b>{modalRoiItem.quantidade || 0} un</b></span>
                        <span className="modal-roi-info-chip"><i className="fas fa-barcode"></i> Cód: <b>{modalRoiItem.codigo || 'S/N'}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* 📊 SEÇÃO DE MÉTRICAS & CONTABILIDADE COM OPÇÃO DE OCULTAR */}
                  {ocultarMetricasRoi ? (
                    <div className="modal-roi-hidden-placeholder" onClick={alternarOcultarMetricasRoi}>
                      <div className="modal-roi-hidden-content">
                        <i className="fas fa-eye-slash"></i>
                        <span>Métricas financeiras ocultas</span>
                      </div>
                      <span className="modal-roi-hidden-btn-reveal">Toque para exibir</span>
                    </div>
                  ) : (
                    <div className="modal-roi-metrics-container">
                      
                      {/* PAINEL COMPACTO EM 2 COLUNAS */}
                      <div className="modal-roi-slim-stats-grid">
                        
                        <div className="modal-roi-slim-stat card-kpi-blue">
                          <div className="stat-left">
                            <span className="stat-label">Giro no Acervo</span>
                            <strong className="stat-val">{m.vezesAlugada}x</strong>
                          </div>
                          <span className="stat-tag">alugadas</span>
                        </div>

                        <div className="modal-roi-slim-stat card-kpi-emerald">
                          <div className="stat-left">
                            <span className="stat-label">Faturamento Total</span>
                            <strong className="stat-val">R$ {m.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                          </div>
                          <span className="stat-tag">bruto</span>
                        </div>

                        <div className={`modal-roi-slim-stat ${m.roiPercentual >= 0 ? 'card-kpi-gold' : 'card-kpi-red'}`}>
                          <div className="stat-left">
                            <span className="stat-label">Retorno (ROI)</span>
                            <strong className="stat-val">{m.roiPercentual > 0 ? '+' : ''}{m.roiPercentual.toFixed(0)}%</strong>
                          </div>
                          <span className="stat-tag">retorno</span>
                        </div>

                        <div className={`modal-roi-slim-stat ${m.lucroLiquido >= 0 ? 'card-kpi-emerald' : 'card-kpi-red'}`}>
                          <div className="stat-left">
                            <span className="stat-label">Lucro Líquido Real</span>
                            <strong className="stat-val">R$ {m.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                          </div>
                          <span className="stat-tag">líquido</span>
                        </div>

                      </div>

                      {/* DETALHAMENTO DE CUSTOS SLIM EM 2 COLUNAS */}
                      <div className="modal-roi-slim-costs-row">
                        <div className="modal-roi-slim-cost-chip">
                          <span className="cost-lbl">Custo Aquisição:</span>
                          <span className="cost-num">R$ {m.custoAquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="modal-roi-slim-cost-chip">
                          <span className="cost-lbl">Gastos c/ Reparos:</span>
                          <span className="cost-num text-amber">R$ {m.custoManutencao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* 📜 HISTÓRICO DE LOCAÇÕES RECENTES */}
                  <div className="modal-roi-history-wrapper">
                    <div className="modal-roi-history-header">
                      <div className="modal-roi-history-header-title">
                        <i className="fas fa-calendar-check"></i>
                        <span>Histórico de Locações</span>
                      </div>
                      <span className="modal-roi-history-counter">{m.historicoPedidos.length} {m.historicoPedidos.length === 1 ? 'locação' : 'locações'}</span>
                    </div>

                    {m.historicoPedidos.length === 0 ? (
                      <div className="modal-roi-empty-box">
                        <i className="fas fa-folder-open"></i>
                        <span>Nenhuma locação finalizada encontrada para esta peça até o momento.</span>
                      </div>
                    ) : (
                      <div className="modal-roi-history-scroll">
                        {m.historicoPedidos.map((ped, idx) => (
                          <div key={idx} className="modal-roi-history-card">
                            <div className="modal-roi-history-card-left">
                              <div className="modal-roi-ped-badge">#{ped.numeroPedido}</div>
                              <div className="modal-roi-ped-info">
                                <span className="modal-roi-client-name"><i className="fas fa-user"></i> {ped.clienteNome}</span>
                                <span className="modal-roi-ped-date">
                                  <i className="fas fa-calendar-alt"></i> {ped.dataRetirada ? ped.dataRetirada.split('-').reverse().join('/') : '-'} 
                                  <span className="modal-roi-ped-qtd">• {ped.qtd} {ped.qtd === 1 ? 'un' : 'uns'}</span>
                                </span>
                              </div>
                            </div>
                            <div className="modal-roi-history-card-right">
                              <span className="modal-roi-badge-gain">+ R$ {ped.valorGerado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* 🔘 RODAPÉ DE AÇÕES */}
                <div className="modal-roi-actions-footer">
                  <button 
                    type="button"
                    className="modal-roi-btn-action btn-action-reposicao"
                    onClick={() => { const item = modalRoiItem; setModalRoiItem(null); abrirModalReposicao(item); }}
                  >
                    <i className="fas fa-cart-plus"></i>
                    <span>Pedir Reposição</span>
                  </button>

                  <button 
                    type="button"
                    className="modal-roi-btn-action btn-action-reparo"
                    onClick={() => { const it = modalRoiItem; setModalRoiItem(null); abrirModalManutencao(it); }}
                  >
                    <i className="fas fa-screwdriver-wrench"></i>
                    <span>Registrar Reparo</span>
                  </button>

                  <button 
                    type="button"
                    className="modal-roi-btn-action btn-action-close"
                    onClick={() => setModalRoiItem(null)}
                  >
                    <span>Fechar</span>
                  </button>
                </div>

              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* 🛒 MODAL DE PEDIDO DE REPOSIÇÃO / COMPRAS */}
      {modalReposicaoItem && ReactDOM.createPortal(
        (() => {
          const pecasDoKit = modalReposicaoItem.especificacoes?.itensDecoracao || modalReposicaoItem.especificacoes?.itensDoKit || [];
          const isDecoComPecas = (modalReposicaoItem.especificacoes?.isDecoracao || modalReposicaoItem.categoria === 'Decoração Completa' || modalReposicaoItem.tipoCadastro === 'decoracao') && pecasDoKit.length > 0;
          const pecasSelecionadasCount = pecasReposicaoSelecionadas.filter(p => p.selecionado).length;
          const totalUnidadesPecas = pecasReposicaoSelecionadas.filter(p => p.selecionado).reduce((acc, p) => acc + (Number(p.qtdReposicao) || 1), 0);

          const alternarSelecaoTodasPecas = () => {
            const todosMarcados = pecasReposicaoSelecionadas.every(p => p.selecionado);
            setPecasReposicaoSelecionadas(prev => prev.map(p => ({ ...p, selecionado: !todosMarcados })));
          };

          const alterarQtdPeca = (pecaId, delta) => {
            setPecasReposicaoSelecionadas(prev => prev.map(p => {
              if (p.id === pecaId) {
                const novaQtd = Math.max(1, (Number(p.qtdReposicao) || 1) + delta);
                return { ...p, qtdReposicao: novaQtd, selecionado: true };
              }
              return p;
            }));
          };

          const togglePeca = (pecaId) => {
            setPecasReposicaoSelecionadas(prev => prev.map(p => {
              if (p.id === pecaId) {
                return { ...p, selecionado: !p.selecionado };
              }
              return p;
            }));
          };

          return (
            <div className="modal-roi-overlay" onClick={() => setModalReposicaoItem(null)}>
              <div className="modal-roi-card modal-reposicao-card animate-pop" onClick={e => e.stopPropagation()}>
                
                {/* 👑 CABEÇALHO COMPACTO E SOFISTICADO */}
                <div className="modal-roi-header">
                  <div className="modal-roi-header-content">
                    <div className="modal-roi-header-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', boxShadow: '0 3px 10px rgba(37, 99, 235, 0.3)' }}>
                      <i className="fas fa-cart-plus"></i>
                    </div>
                    <div className="modal-roi-header-text">
                      <div className="modal-roi-badge-top">
                        <span className="modal-roi-badge-pill" style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.12)', borderColor: 'rgba(37, 99, 235, 0.25)' }}>
                          SUPRIMENTOS & COMPRAS
                        </span>
                        <span className="modal-roi-badge-code">CÓD: {modalReposicaoItem.codigo || 'S/N'}</span>
                      </div>
                      <h3>Solicitar Reposição de Peça</h3>
                      <p>Envie a peça diretamente para a Lista de Compras</p>
                    </div>
                  </div>
                  <button className="modal-roi-btn-close" onClick={() => setModalReposicaoItem(null)} title="Fechar">
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="modal-roi-body">
                  
                  {/* 🖼️ IDENTIFICAÇÃO DO PRODUTO */}
                  <div className="modal-roi-product-hero">
                    <div className="modal-roi-hero-photo-box">
                      {modalReposicaoItem.foto ? (
                        <img src={modalReposicaoItem.foto} alt={modalReposicaoItem.nome} />
                      ) : (
                        <div className="modal-roi-hero-no-photo"><i className="fas fa-image"></i></div>
                      )}
                    </div>
                    <div className="modal-roi-hero-details">
                      <h4 className="modal-roi-hero-title">{modalReposicaoItem.nome}</h4>
                      <div className="modal-roi-hero-grid-2">
                        <span className="modal-roi-info-chip"><i className="fas fa-tag"></i> {modalReposicaoItem.categoria || 'Geral'}</span>
                        <span className="modal-roi-info-chip"><i className="fas fa-boxes-stacked"></i> Estoque Atual: <b>{modalReposicaoItem.quantidade || 0} un</b></span>
                      </div>
                    </div>
                  </div>

                  {/* 🔀 SELETOR DE MODALIDADE (QUANDO FOR DECORAÇÃO COM ITENS VINCULADOS) */}
                  {isDecoComPecas && (
                    <div className="modal-reposicao-mode-tabs">
                      <button 
                        type="button" 
                        className={`modal-reposicao-mode-tab ${modoReposicao === 'pecas' ? 'active' : ''}`}
                        onClick={() => setModoReposicao('pecas')}
                      >
                        <i className="fas fa-puzzle-piece"></i>
                        <span>Desmembrar Peças ({pecasDoKit.length})</span>
                      </button>
                      <button 
                        type="button" 
                        className={`modal-reposicao-mode-tab ${modoReposicao === 'pacote' ? 'active' : ''}`}
                        onClick={() => setModoReposicao('pacote')}
                      >
                        <i className="fas fa-box-open"></i>
                        <span>Kit Fechado (Tema)</span>
                      </button>
                    </div>
                  )}

                  {/* 🧩 MODO 1: DESMEMBRAR PEÇAS DO KIT */}
                  {isDecoComPecas && modoReposicao === 'pecas' ? (
                    <div className="modal-reposicao-pecas-container">
                      <div className="modal-reposicao-pecas-header">
                        <span className="pecas-count-lbl">
                          <i className="fas fa-list-check"></i>
                          <b>{pecasSelecionadasCount}</b> de {pecasReposicaoSelecionadas.length} peças selecionadas
                        </span>
                        <button 
                          type="button" 
                          className="btn-toggle-all-pecas"
                          onClick={alternarSelecaoTodasPecas}
                        >
                          {pecasReposicaoSelecionadas.every(p => p.selecionado) ? 'Desmarcar Todas' : 'Marcar Todas'}
                        </button>
                      </div>

                      <div className="modal-reposicao-pecas-list">
                        {pecasReposicaoSelecionadas.map((peca) => (
                          <div 
                            key={peca.id} 
                            className={`modal-reposicao-peca-card ${peca.selecionado ? 'selected' : ''}`}
                            onClick={() => togglePeca(peca.id)}
                          >
                            <div className="peca-card-left">
                              <input 
                                type="checkbox" 
                                checked={!!peca.selecionado} 
                                onChange={() => {}} 
                                className="peca-checkbox"
                              />
                              <div className="peca-thumb">
                                {peca.foto ? (
                                  <img src={peca.foto} alt={peca.nome} />
                                ) : (
                                  <i className="fas fa-shapes"></i>
                                )}
                              </div>
                              <div className="peca-info">
                                <strong className="peca-name">{peca.nome}</strong>
                                <span className="peca-cat">{peca.categoria || 'Item do Tema'}</span>
                              </div>
                            </div>

                            <div className="peca-card-right" onClick={e => e.stopPropagation()}>
                              <div className="peca-mini-stepper">
                                <button 
                                  type="button" 
                                  className="mini-step-btn"
                                  onClick={() => alterarQtdPeca(peca.id, -1)}
                                  disabled={!peca.selecionado || peca.qtdReposicao <= 1}
                                >
                                  <i className="fas fa-minus"></i>
                                </button>
                                <span className="mini-step-val">{peca.qtdReposicao || 1}</span>
                                <button 
                                  type="button" 
                                  className="mini-step-btn"
                                  onClick={() => alterarQtdPeca(peca.id, 1)}
                                  disabled={!peca.selecionado}
                                >
                                  <i className="fas fa-plus"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* 📦 MODO 2: PACOTE COMPLETO OU ITEM AVULSO NORMAL */
                    <div className="modal-reposicao-qtd-section">
                      <label className="modal-reposicao-label">
                        <i className="fas fa-calculator"></i>
                        <span>{isDecoComPecas ? 'Quantidade de Kits Temáticos a Comprar:' : 'Quantidade a Comprar / Repor:'}</span>
                      </label>
                      
                      <div className="modal-reposicao-stepper">
                        <button 
                          type="button" 
                          className="btn-step"
                          onClick={() => setQtdReposicao(Math.max(1, (parseInt(qtdReposicao) || 1) - 1))}
                        >
                          <i className="fas fa-minus"></i>
                        </button>
                        <input 
                          type="number" 
                          min="1" 
                          value={qtdReposicao} 
                          onChange={e => setQtdReposicao(Math.max(1, parseInt(e.target.value) || 1))}
                          className="modal-reposicao-input-val"
                        />
                        <button 
                          type="button" 
                          className="btn-step"
                          onClick={() => setQtdReposicao((parseInt(qtdReposicao) || 1) + 1)}
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 💡 DICA INFORMATIVA */}
                  <div className="modal-reposicao-tip">
                    <i className="fas fa-lightbulb"></i>
                    <div className="tip-text">
                      <strong>Fluxo Automático:</strong> Ao confirmar, {isDecoComPecas && modoReposicao === 'pecas' ? 'as peças selecionadas entrarão individualmente' : 'a solicitação entrará'} na aba <b>"Compras"</b> para cotação de preços com fornecedores!
                    </div>
                  </div>

                </div>

                {/* 🔘 RODAPÉ DE AÇÕES */}
                <div className="modal-roi-actions-footer">
                  <button 
                    type="button" 
                    className="modal-roi-btn-action btn-action-close"
                    onClick={() => setModalReposicaoItem(null)}
                  >
                    Cancelar
                  </button>

                  <button 
                    type="button" 
                    className="modal-roi-btn-action btn-action-confirm-reposicao"
                    onClick={() => pedirReposicaoCompra(modalReposicaoItem, qtdReposicao)}
                  >
                    <i className="fas fa-cart-plus"></i>
                    <span>
                      {isDecoComPecas && modoReposicao === 'pecas' 
                        ? `Confirmar Envio (${pecasSelecionadasCount} ${pecasSelecionadasCount === 1 ? 'modelo' : 'modelos'} · ${totalUnidadesPecas} un)`
                        : `Confirmar Envio (${qtdReposicao} ${isDecoComPecas ? 'kit' : 'un'})`
                      }
                    </span>
                  </button>
                </div>

              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* TOAST DE FEEDBACK */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 999999,
          fontSize: '0.85rem',
          fontWeight: '800',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMsg}
        </div>
      )}

      {imagemAmpliada && (
        <div className="image-zoom-overlay" onClick={() => setImagemAmpliada(null)}>
          <img src={imagemAmpliada} className="image-zoom-content" alt="Zoom" />
          <p className="zoom-caption">Clique em qualquer lugar para fechar</p>
        </div>
      )}
    </div>
  );
};

export default Estoque;