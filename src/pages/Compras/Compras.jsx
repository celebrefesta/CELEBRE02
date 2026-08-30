import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, doc, getDoc, updateDoc, deleteDoc, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import "./Compras.css";

const Compras = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [itens, setItens] = useState([]);
  const [totais, setTotais] = useState({ pendente: 0, urgente: 0, realizado: 0, economia: 0 });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState('');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('Data'); 
  const [loading, setLoading] = useState(true);

  // ⚡ ESTADOS PARA SELEÇÃO EM MASSA & EXPORTAÇÃO (WHATSAPP / PRINT)
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');

  // 💰 ESTADOS PARA REGISTRO DE VALOR PAGO REAL VS. ESTIMADO (ECONOMIA REAL)
  const [modalValorPagoAberto, setModalValorPagoAberto] = useState(false);
  const [itemParaValorPago, setItemParaValorPago] = useState(null);
  const [inputValorPagoUnitario, setInputValorPagoUnitario] = useState('');
  const [statusDestinoValorPago, setStatusDestinoValorPago] = useState(null);

  // 🔗 ESTADO PARA FILTRO E AÇÃO EM LOTE POR VÍNCULO (PEDIDO / DECORAÇÃO)
  const [filtroVinculoAtivo, setFiltroVinculoAtivo] = useState(null);

  // 🎯 ABA ATIVA: 'lista' (Minha Lista) | 'decoracoes' (Peças Faltantes em Decorações)
  const [abaAtiva, setAbaAtiva] = useState('lista');
  const [faltantesDecoracao, setFaltantesDecoracao] = useState([]);
  const [loadingDecoracoes, setLoadingDecoracoes] = useState(false);
  const [buscaDecoracao, setBuscaDecoracao] = useState('');
  const [estoqueExistenteNomes, setEstoqueExistenteNomes] = useState(new Set());

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

    // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS as compras da conta principal
    const q = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordena em memória por data mais recente
      lista.sort((a, b) => {
         const dataA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
         const dataB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
         return dataB - dataA;
      });

      setItens(lista);

      let p = 0; 
      let u = 0; 
      let r = 0; 
      let e = 0; // Economia calculada

      const hoje = new Date();
      hoje.setHours(0,0,0,0);

      lista.forEach(item => {
        const qtd = Number(item.quantidade) || 1;
        const valorUnitEst = Number(item.valorEstimado) || 0;
        const valorUnitPago = (item.valorPago !== undefined && item.valorPago !== null && item.valorPago !== '') 
          ? Number(item.valorPago) 
          : valorUnitEst;

        const subtotalEst = qtd * valorUnitEst;
        const subtotalPago = qtd * valorUnitPago;

        if (item.status === "comprado" || item.status === "chegou") {
          r += subtotalPago;
          if (item.valorPago !== undefined && item.valorPago !== null && item.valorPago !== '') {
            e += (subtotalEst - subtotalPago);
          }
        } else {
          p += subtotalEst;
          if (item.prazo && item.vinculoTipo === 'pedido') {
            const dataPrazo = new Date(item.prazo + 'T00:00:00');
            const diffTime = dataPrazo.getTime() - hoje.getTime();
            const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDias <= 5) u++; 
          }
        }
      });

      setTotais({ pendente: p, urgente: u, realizado: r, economia: e });
      setLoading(false);

      // 🎯 BUSCA PEÇAS FALTANTES EM DECORAÇÕES COMPLETAS
      await carregarFaltantesDecoracoes(lista);
    });

    return () => unsubscribe();
  }, [usuarioLogado, navigate, tenantId]);

  // 🎯 CRUZAMENTO DE DECORAÇÕES COMPLETAS COM ESTOQUE FÍSICO REAL
  const carregarFaltantesDecoracoes = async (listaComprasAtuais) => {
    try {
      setLoadingDecoracoes(true);
      const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
      const snapEstoque = await getDocs(qEstoque);
      const todosOsItens = snapEstoque.docs.map(d => ({ id: d.id, ...d.data() }));

      const conjuntoNomes = new Set(todosOsItens.map(i => (i.nome || '').toLowerCase().trim()).filter(Boolean));
      setEstoqueExistenteNomes(conjuntoNomes);

      const decoracoes = todosOsItens.filter(i => 
        i.especificacoes?.isDecoracao || 
        i.categoria === 'Decorações Completas' || 
        i.tipoCadastro === 'decoracao' ||
        i.tipo === 'decoracao' ||
        (i.especificacoes?.itensDecoracao && i.especificacoes.itensDecoracao.length > 0) ||
        (i.especificacoes?.itensDoKit && i.especificacoes.itensDoKit.length > 0)
      );

      const estoqueMap = {};
      todosOsItens.forEach(i => {
        const qtd = parseInt(i.quantidade || 0) || parseInt(i.estoque || 0) || 0;
        const dados = { 
          id: i.id, 
          nome: i.nome, 
          qtd, 
          foto: i.foto || i.fotos?.[0] || '', 
          valor: Number(i.financeiro?.valorAluguel || i.valorAluguel || 0) 
        };
        estoqueMap[i.id] = dados;
        if (i.nome) {
          estoqueMap[i.nome.toLowerCase().trim()] = dados;
        }
      });

      const listaFaltantes = [];

      decoracoes.forEach(decor => {
        const pecasNoKit = decor.especificacoes?.itensDecoracao || 
                           decor.especificacoes?.itensDoKit || 
                           decor.itensDecoracao || 
                           decor.itensDoKit || 
                           decor.especificacoes?.pecasKit || [];
        pecasNoKit.forEach(peca => {
          const qtdNoKit = parseInt(peca.qtd || 1);
          let dadosPeca = peca.id ? estoqueMap[peca.id] : null;
          if (!dadosPeca && peca.nome) {
            dadosPeca = estoqueMap[peca.nome.toLowerCase().trim()];
          }

          const qtdNoEstoque = dadosPeca ? dadosPeca.qtd : 0;

          if (qtdNoKit > qtdNoEstoque) {
            const faltam = qtdNoKit - qtdNoEstoque;
            const jaNaLista = listaComprasAtuais.some(itemCompra => 
              itemCompra.nome?.toLowerCase() === peca.nome?.toLowerCase() &&
              (itemCompra.vinculo?.includes(decor.nome) || itemCompra.vinculoTipo === 'decoracao')
            );

            listaFaltantes.push({
              idUnico: `${decor.id}_${peca.id || peca.nome}`,
              decoracaoId: decor.id,
              decoracaoNome: decor.nome,
              decoracaoFoto: decor.foto || decor.fotos?.[0] || '',
              pecaId: peca.id || '',
              pecaNome: peca.nome,
              pecaFoto: peca.foto || dadosPeca?.foto || '',
              qtdNoKit,
              qtdNoEstoque,
              faltam,
              valorEstimado: Number(peca.precoOriginal || dadosPeca?.valor || 0),
              jaNaLista
            });
          }
        });
      });

      setFaltantesDecoracao(listaFaltantes);
    } catch (e) {
      console.error("Erro ao cruzar aquisições de decorações:", e);
    } finally {
      setLoadingDecoracoes(false);
    }
  };

  // 🎯 ADICIONAR PEÇA FALTANTE DE DECORAÇÃO DIRETO NA LISTA DE COMPRAS
  const adicionarItemDecoracaoALista = async (itemFaltante) => {
    try {
      await addDoc(collection(db, "lista_compras"), {
        userId: tenantId,
        nome: itemFaltante.pecaNome,
        pecaId: itemFaltante.pecaId || '',
        estoqueId: itemFaltante.pecaId || '',
        isItemExistente: true,
        quantidade: itemFaltante.faltam,
        valorEstimado: itemFaltante.valorEstimado,
        vinculo: `Decoração: ${itemFaltante.decoracaoNome}`,
        vinculoTipo: 'decoracao',
        status: 'pendente',
        tipoEntrega: '0',
        formato: 'avulso',
        createdAt: serverTimestamp()
      });

      await registrarLog("COMPRA DECORAÇÃO ADICIONADA", `Adicionou ${itemFaltante.faltam}x "${itemFaltante.pecaNome}" (Faltante da Decoração "${itemFaltante.decoracaoNome}") à lista de compras.`);
      alert(`🛒 Enviado para a Lista de Compras!\n\n"${itemFaltante.pecaNome}" (${itemFaltante.faltam}x) foi adicionado à sua lista de compras pendentes.`);

      setFaltantesDecoracao(prev => prev.map(i => i.idUnico === itemFaltante.idUnico ? { ...i, jaNaLista: true } : i));
    } catch (e) {
      console.error("Erro ao enviar item para lista de compras:", e);
      alert("Erro ao adicionar item na lista de compras.");
    }
  };

  // 🎯 SOMAR ESTOQUE MANULMENTE (BOTÃO EM COMPRAS CONCLUÍDAS)
  const somarManualAoEstoque = async (item) => {
    try {
      let docExistente = null;

      if (item.pecaId || item.estoqueId) {
        const targetId = item.pecaId || item.estoqueId;
        const snapDirect = await getDoc(doc(db, "estoque", targetId));
        if (snapDirect.exists()) docExistente = snapDirect;
      }

      if (!docExistente) {
        const qAllEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snapAll = await getDocs(qAllEstoque);
        const match = snapAll.docs.find(d => 
          d.id === item.pecaId || 
          d.id === item.estoqueId || 
          (d.data().nome || '').toLowerCase().trim() === (item.nome || '').toLowerCase().trim()
        );
        if (match) docExistente = match;
      }

      if (!docExistente) {
        alert(`⚠️ Não foi encontrado um cadastro correspondente no estoque para a peça "${item.nome}".`);
        return;
      }

      const qtdComprada = Number(item.quantidade) || 1;
      const qtdAtual = Number(docExistente.data().quantidade) || Number(docExistente.data().estoque) || 0;
      const novaQtdTotal = qtdAtual + qtdComprada;

      await updateDoc(doc(db, "estoque", docExistente.id), {
        quantidade: novaQtdTotal,
        estoque: novaQtdTotal,
        atualizadoEm: new Date().toISOString()
      });

      await updateDoc(doc(db, "lista_compras", item.id), {
        estoqueSomado: true,
        estoqueId: docExistente.id
      });

      await registrarLog("ESTOQUE ATUALIZADO", `Somou +${qtdComprada} un de "${item.nome}" ao acervo.`);
      alert(`✅ Sucesso!\n\nForam somadas +${qtdComprada} unidade(s) à peça "${docExistente.data().nome}". Novo saldo no estoque: ${novaQtdTotal} unidades!`);
    } catch (e) {
      console.error("Erro ao somar ao estoque:", e);
      alert("Erro ao atualizar o estoque.");
    }
  };

  // 💰 MODAL E FUNÇÃO DE REGISTRO DE VALOR PAGO (ECONOMIA REAL)
  const abrirModalValorPago = (item, novoStatus = null) => {
    setItemParaValorPago(item);
    setStatusDestinoValorPago(novoStatus);
    const valInicial = (item.valorPago !== undefined && item.valorPago !== null && item.valorPago !== '')
      ? item.valorPago
      : (item.valorEstimado || 0);
    setInputValorPagoUnitario(valInicial.toString());
    setModalValorPagoAberto(true);
  };

  const salvarValorPagoEConcluir = async (e) => {
    if (e) e.preventDefault();
    if (!itemParaValorPago) return;

    const valPagoNum = parseFloat(inputValorPagoUnitario.toString().replace(',', '.')) || 0;

    try {
      const itemRef = doc(db, "lista_compras", itemParaValorPago.id);
      await updateDoc(itemRef, {
        valorPago: valPagoNum,
        updatedAt: new Date().toISOString()
      });

      const itemAtualizado = { ...itemParaValorPago, valorPago: valPagoNum };
      setModalValorPagoAberto(false);

      if (statusDestinoValorPago) {
        await executarTrocaStatus(itemAtualizado, statusDestinoValorPago);
      } else {
        await registrarLog("ATUALIZAÇÃO DE VALOR PAGO", `Registrou valor pago de R$ ${valPagoNum.toFixed(2)} no item "${itemParaValorPago.nome}".`);
      }
    } catch (err) {
      console.error("Erro ao salvar valor pago:", err);
      alert("Erro ao registrar o valor pago.");
    }
  };

  const handleStatusChange = async (item, novoStatus) => {
    if (novoStatus === 'comprado' || novoStatus === 'chegou') {
      abrirModalValorPago(item, novoStatus);
    } else {
      await executarTrocaStatus(item, novoStatus);
    }
  };

  const executarTrocaStatus = async (item, novoStatus) => {
    try {
      let docExistente = null;

      if (item.pecaId || item.estoqueId) {
        const targetId = item.pecaId || item.estoqueId;
        const snapDirect = await getDoc(doc(db, "estoque", targetId));
        if (snapDirect.exists()) docExistente = snapDirect;
      }

      if (!docExistente) {
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId), where("nome", "==", item.nome));
        let snapshotEstoque = await getDocs(qEstoque);
        if (!snapshotEstoque.empty) docExistente = snapshotEstoque.docs[0];
      }

      if (!docExistente) {
        const qAllEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snapAll = await getDocs(qAllEstoque);
        const match = snapAll.docs.find(d => (d.data().nome || '').toLowerCase().trim() === (item.nome || '').toLowerCase().trim());
        if (match) docExistente = match;
      }

      const qtdComprada = Number(item.quantidade) || 1;
      let updatePayload = { status: novoStatus };
      if (item.valorPago !== undefined) updatePayload.valorPago = item.valorPago;

      if (novoStatus === 'chegou') {
        updatePayload.dataChegada = new Date().toISOString();
        if (!item.dataCompra) updatePayload.dataCompra = new Date().toISOString();

        if (docExistente) {
          const qtdAtual = Number(docExistente.data().quantidade) || Number(docExistente.data().estoque) || 0;
          const incremento = (item.formato === 'kit' && item.quantidadePecasKit) ? Number(item.quantidadePecasKit) : qtdComprada;
          const novaQtdTotal = qtdAtual + incremento;

          updatePayload.estoqueSomado = true;
          updatePayload.estoqueId = docExistente.id;

          const itemRef = doc(db, "lista_compras", item.id);
          await updateDoc(itemRef, updatePayload);

          await updateDoc(doc(db, "estoque", docExistente.id), {
            quantidade: novaQtdTotal,
            estoque: novaQtdTotal,
            atualizadoEm: new Date().toISOString()
          });

          await registrarLog("COMPRA RECEBIDA", `Registrou a chegada de "${item.nome}" e somou +${incremento} unidades ao estoque (Total: ${novaQtdTotal}).`);
          alert(`📦 Compra Concluída!\n\nA peça "${item.nome}" já existe no seu acervo. A quantidade no estoque foi somada automaticamente (+${incremento} un, totalizando ${novaQtdTotal} un no acervo)!`);
        } else {
          if (item.categoria === "material") {
             const itemRef = doc(db, "lista_compras", item.id);
             await updateDoc(itemRef, updatePayload);
             
             await registrarLog("COMPRA RECEBIDA", `Registrou a chegada do material "${item.nome}".`);
             alert(`📦 Material de consumo recebido e baixado da lista!`);
          } else {
             const itemRef = doc(db, "lista_compras", item.id);
             await updateDoc(itemRef, updatePayload);

             const querCadastrarAgora = window.confirm(`✨ Compra concluída com sucesso!\n\nComo "${item.nome}" é uma peça INÉDITA, deseja ir para a tela de Cadastro de Estoque AGORA para registrar fotos e detalhes?`);
             if (querCadastrarAgora) {
                 await registrarLog("COMPRA RECEBIDA", `Registrou a compra de "${item.nome}" e iniciou cadastro inédito no acervo.`);
                 navigate('/cadastro-estoque', { state: { dadosCompra: item } });
             }
             return;
          }
        }
      } 
      else if (novoStatus === 'pendente') {
        updatePayload.dataCompra = null;
        updatePayload.dataChegada = null;
        updatePayload.estoqueSomado = false;

        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snapshotEstoque = await getDocs(qEstoque);

        if (item.status === 'chegou' && snapshotEstoque && !snapshotEstoque.empty) {
          const docEx = snapshotEstoque.docs.find(d => d.id === item.estoqueId) || snapshotEstoque.docs[0];
          if (docEx) {
            const qtdAtual = Number(docEx.data().quantidade) || 0;
            const qtdRemover = item.formato === 'kit' && item.quantidadePecasKit ? item.quantidadePecasKit : qtdComprada;
            const novaQtd = Math.max(0, qtdAtual - qtdRemover); 
            
            await updateDoc(doc(db, "estoque", docEx.id), {
              quantidade: novaQtd,
              atualizadoEm: new Date().toISOString()
            });
          }
        }
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);

        await registrarLog("COMPRA PENDENTE", `Voltou o status de "${item.nome}" para Pendente (Falta Comprar).`);
      }
      else if (novoStatus === 'comprado') {
        updatePayload.dataCompra = new Date().toISOString();
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);
        
        // 💰 INTEGRAÇÃO FINANCEIRA: Lançar Saída no Financeiro
        const valorFinalCompra = Number(item.valorPago || item.valorEstimado || 0);
        if (valorFinalCompra > 0) {
          try {
            await addDoc(collection(db, "financeiro_lancamentos"), {
              userId: tenantId,
              empresaId: tenantId,
              tipo: "saida",
              categoria: item.categoria === 'decoracao' ? 'Insumos e Embalagens' : 'Aquisição de Acervo',
              centroCusto: "Aquisição Acervo",
              descricao: `🛒 Compra: ${item.nome || 'Item'}${item.fornecedor ? ` (${item.fornecedor})` : ''}`,
              valor: valorFinalCompra,
              valorTotal: valorFinalCompra,
              data: new Date().toISOString().split('T')[0],
              status: "pago",
              formaPagamento: item.formaPagto || "Pix",
              formaPagto: item.formaPagto || "Pix",
              fornecedorNome: item.fornecedor || "",
              fornecedorTelefone: item.fornecedorTelefone || "",
              compraId: item.id,
              origem: "modulo_compras",
              observacoes: `Compra registrada via módulo de Compras (Qtd: ${item.quantidade || 1}).`,
              criadoEm: serverTimestamp()
            });
          } catch (finErr) {
            console.error("Erro ao gerar lançamento financeiro da compra:", finErr);
          }
        }

        await registrarLog("COMPRA EFETUADA", `Marcou o item "${item.nome}" como Comprado e gerou saída financeira no caixa.`);
        alert(`🛒 Maravilha! A compra foi registrada e a despesa de R$ ${valorFinalCompra.toFixed(2)} foi lançada no Financeiro.`);
      }

    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro na operação.");
    }
  };

  // 🔁 RECOMPRAR ITEM (COMPRAS RECORRENTES DE CONSUMÍVEIS / MATERIAL)
  const handleRecomprar = async (item) => {
    try {
      const novoItemPayload = {
        userId: tenantId,
        nome: item.nome || 'Item Recomprado',
        quantidade: item.quantidade || 1,
        valorEstimado: item.valorEstimado || 0,
        valorPago: null,
        dataCompra: null,
        dataChegada: null,
        formato: item.formato || 'unidade',
        categoria: item.categoria || 'material',
        vinculo: item.vinculo || 'Estoque Geral',
        vinculoTipo: item.vinculoTipo || 'geral',
        fornecedor: item.fornecedor || '',
        fornecedorTelefone: item.fornecedorTelefone || '',
        tipoEntrega: item.tipoEntrega || '0',
        diasFrete: item.diasFrete || 0,
        prazo: item.prazo || '',
        status: 'pendente',
        estoqueSomado: false,
        createdAt: serverTimestamp(),
        criadoEmIso: new Date().toISOString(),
        recorrente: true
      };

      await addDoc(collection(db, "lista_compras"), novoItemPayload);
      await registrarLog("COMPRA RECORRENTE", `Duplicou/Recomprou o item "${item.nome}" na lista de compras.`);
      alert(`🔁 Maravilha! "${item.nome}" foi adicionado novamente à sua Lista de Compras como PENDENTE (Falta Comprar)!`);
    } catch (error) {
      console.error("Erro ao recomprar item:", error);
      alert("Erro ao recriar compra recorrente.");
    }
  };

  // ⚡ AÇÃO EM LOTE POR VÍNCULO (TODOS DO PEDIDO / DECORAÇÃO)
  const alterarStatusPorVinculo = async (vinculoNome, novoStatus) => {
    const itensDoVinculo = itens.filter(i => (i.vinculo || '').toLowerCase().trim() === vinculoNome.toLowerCase().trim());
    if (itensDoVinculo.length === 0) return;

    const acaoNome = novoStatus === 'chegou' ? 'No Acervo' : 'A Caminho';
    if (!window.confirm(`Deseja alterar o status de TODOS os ${itensDoVinculo.length} item(ns) do vínculo "${vinculoNome}" para "${acaoNome}"?`)) return;

    try {
      for (const itemObj of itensDoVinculo) {
        await executarTrocaStatus(itemObj, novoStatus);
      }
      await registrarLog("AÇÃO EM LOTE VÍNCULO", `Alterou status de ${itensDoVinculo.length} itens do vínculo "${vinculoNome}" para ${acaoNome}.`);
      alert(`⚡ Maravilha! Os ${itensDoVinculo.length} itens do vínculo "${vinculoNome}" foram atualizados!`);
    } catch (e) {
      console.error("Erro na ação em lote por vínculo:", e);
      alert("Erro na operação por vínculo.");
    }
  };

  const handleExcluir = async (id, nome) => {
    if (window.confirm(`Tem certeza que deseja remover "${nome}" da lista?`)) {
      try {
        await registrarLog("EXCLUSÃO DE COMPRA", `Removeu a peça "${nome}" da lista de compras.`);
        await deleteDoc(doc(db, "lista_compras", id));
      } catch (error) { 
        alert("Erro ao excluir item.");
      }
    }
  };

  const isItemConcluido = (item) => {
    if (!item) return false;
    const st = (item.status || '').toLowerCase().trim();
    return st === 'chegou' || st === 'no_acervo' || st === 'concluido' || st === 'concluído' || item.estoqueSomado === true;
  };

  const toggleSelecionarItem = (id) => {
    setItensSelecionados(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const toggleSelecionarTodos = () => {
    if (itensSelecionados.length === itensFiltrados.length && itensFiltrados.length > 0) {
      setItensSelecionados([]);
    } else {
      setItensSelecionados(itensFiltrados.map(i => i.id));
    }
  };

  const alterarStatusEmMassa = async (novoStatus) => {
    if (itensSelecionados.length === 0) return;
    const acaoNome = novoStatus === 'chegou' ? 'No Acervo' : novoStatus === 'comprado' ? 'A Caminho' : 'Pendente';
    if (!window.confirm(`Deseja alterar o status de ${itensSelecionados.length} item(ns) para "${acaoNome}"?`)) return;

    try {
      for (const itemId of itensSelecionados) {
        const itemObj = itens.find(i => i.id === itemId);
        if (itemObj) {
          await handleStatusChange(itemObj, novoStatus);
        }
      }
      await registrarLog("AÇÃO EM MASSA COMPRAS", `Alterou status de ${itensSelecionados.length} compras para: ${acaoNome}.`);
      setItensSelecionados([]);
    } catch (e) {
      console.error("Erro ao alterar em massa:", e);
      alert("Erro ao realizar a operação em massa.");
    }
  };

  const excluirEmMassa = async () => {
    if (itensSelecionados.length === 0) return;
    if (!window.confirm(`⚠️ Tem certeza que deseja EXCLUIR permanentemente ${itensSelecionados.length} item(ns) da lista de compras?`)) return;

    try {
      for (const itemId of itensSelecionados) {
        const itemObj = itens.find(i => i.id === itemId);
        await deleteDoc(doc(db, "lista_compras", itemId));
        if (itemObj) {
          await registrarLog("EXCLUSÃO EM MASSA COMPRAS", `Excluiu o item "${itemObj.nome}" da lista.`);
        }
      }
      setItensSelecionados([]);
      alert("Itens excluídos com sucesso!");
    } catch (e) {
      console.error("Erro ao excluir em massa:", e);
      alert("Erro ao excluir itens selecionados.");
    }
  };

  const enviarListaWhatsApp = (apenasCidade = false, apenasSelecionados = false) => {
    let listaParaEnviar = itensFiltrados;

    if (apenasSelecionados) {
      listaParaEnviar = itens.filter(i => itensSelecionados.includes(i.id));
    } else if (apenasCidade) {
      listaParaEnviar = itens.filter(i => (i.tipoEntrega === '1' || Number(i.diasFrete) === 1) && i.status === 'pendente');
    }

    if (listaParaEnviar.length === 0) {
      alert(apenasCidade ? "Nenhum item pendente marcado para compra presencial NA CIDADE no momento." : "Nenhum item selecionado ou encontrado para envio.");
      return;
    }

    const hojeFormatado = new Date().toLocaleDateString('pt-BR');
    const titulo = apenasCidade ? "🛍️ *LISTA DE COMPRAS NA CIDADE — CELEBRE*" : "🛒 *LISTA DE COMPRAS & AQUISIÇÕES — CELEBRE*";

    let textoMsg = `${titulo}\n📅 *Data:* ${hojeFormatado}\n\n`;
    let totalInvestimento = 0;
    let totalUnidades = 0;

    listaParaEnviar.forEach((item, index) => {
      const qtd = Number(item.quantidade) || 1;
      const valUnit = Number(item.valorEstimado) || 0;
      const sub = qtd * valUnit;
      totalInvestimento += sub;
      totalUnidades += qtd;

      const isPresencial = item.tipoEntrega === '1' || Number(item.diasFrete) === 1;

      textoMsg += `*${index + 1}. ${item.nome}* (${qtd}x)\n`;
      if (item.fornecedor) {
        textoMsg += `   📍 *Fornecedor:* ${item.fornecedor}${item.fornecedorTelefone ? ` (Tel: ${item.fornecedorTelefone})` : ''}\n`;
      }
      if (item.vinculo) {
        textoMsg += `   🔗 *Vínculo:* ${item.vinculo}\n`;
      }
      if (isPresencial) {
        textoMsg += `   ⚡ *Compra Local / Na Cidade*\n`;
      }
      if (valUnit > 0) {
        textoMsg += `   💰 *Ref:* R$ ${valUnit.toFixed(2).replace('.', ',')} un (Total: R$ ${sub.toFixed(2).replace('.', ',')})\n`;
      }
      if (item.obs) {
        textoMsg += `   📝 *Obs:* ${item.obs}\n`;
      }
      textoMsg += `\n`;
    });

    textoMsg += `──────────────────────\n`;
    textoMsg += `📊 *Total de Itens:* ${totalUnidades} unidades (${listaParaEnviar.length} produtos)\n`;
    textoMsg += `💰 *Orçamento Estimado:* R$ ${totalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;

    const encodedText = encodeURIComponent(textoMsg);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    setModalExportarAberto(false);
  };

  const abrirWhatsAppFornecedor = (telefone, nomeItem, qtd) => {
    let numLimpo = (telefone || '').replace(/\D/g, '');
    if (!numLimpo) return alert("Telefone do fornecedor não cadastrado.");
    if (!numLimpo.startsWith('55') && numLimpo.length <= 11) {
      numLimpo = '55' + numLimpo;
    }
    const msg = encodeURIComponent(`Olá! Gostaria de consultar a disponibilidade do item *${nomeItem}* (Quantidade: ${qtd || 1} un) para nosso acervo Celebre.`);
    window.open(`https://api.whatsapp.com/send?phone=${numLimpo}&text=${msg}`, '_blank');
  };

  const imprimirListaPDF = (apenasCidade = false) => {
    let listaImprimir = itensFiltrados;
    if (apenasCidade) {
      listaImprimir = itens.filter(i => (i.tipoEntrega === '1' || Number(i.diasFrete) === 1) && i.status === 'pendente');
    }

    if (listaImprimir.length === 0) {
      alert("Nenhum item disponível para impressão.");
      return;
    }

    const janela = window.open('', '_blank');
    const hoje = new Date().toLocaleDateString('pt-BR');
    const totalCalc = listaImprimir.reduce((acc, i) => acc + ((Number(i.quantidade)||1) * (Number(i.valorEstimado)||0)), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Compras — Celebre</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #c5a059; padding-bottom: 10px; }
          .header h2 { margin: 0; color: #0f172a; }
          .header p { margin: 4px 0 0 0; color: #64748b; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 13px; text-align: left; }
          th { background: #f8fafc; font-weight: bold; }
          .total-box { margin-top: 20px; text-align: right; font-size: 16px; font-weight: bold; }
          .check-box { width: 18px; height: 18px; border: 1.5px solid #0f172a; display: inline-block; border-radius: 4px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>👑 CELEBRE — LISTA DE COMPRAS ${apenasCidade ? 'NA CIDADE' : ''}</h2>
          <p>Impresso em: ${hoje} • Total de Itens: ${listaImprimir.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align:center;">[ ]</th>
              <th>ITEM</th>
              <th>QTD</th>
              <th>VÍNCULO / CONTEXTO</th>
              <th>FORNECEDOR</th>
              <th>VALOR UNIT.</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${listaImprimir.map(i => `
              <tr>
                <td style="text-align:center;"><div class="check-box"></div></td>
                <td><b>${i.nome || ''}</b> ${i.obs ? `<br><small style="color:#64748b;">Obs: ${i.obs}</small>` : ''}</td>
                <td style="text-align:center;"><b>${i.quantidade || 1}x</b></td>
                <td>${i.vinculo || 'Estoque Geral'}</td>
                <td>${i.fornecedor || '—'} ${i.fornecedorTelefone ? `<br><small>${i.fornecedorTelefone}</small>` : ''}</td>
                <td>R$ ${(Number(i.valorEstimado)||0).toFixed(2).replace('.',',')}</td>
                <td><b>R$ ${((Number(i.quantidade)||1)*(Number(i.valorEstimado)||0)).toFixed(2).replace('.',',')}</b></td>
                <td>R$ ${(Number(i.valorPago || i.valorEstimado)||0).toFixed(2).replace('.',',')}</td>
                <td><b>R$ ${((Number(i.quantidade)||1)*(Number(i.valorPago || i.valorEstimado)||0)).toFixed(2).replace('.',',')}</b></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total-box">
          TOTAL ESTIMADO: R$ ${totalCalc.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    janela.document.write(htmlContent);
    janela.document.close();
    setModalExportarAberto(false);
  };

  const normalizarTexto = (texto) => {
    return (texto || '')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  let itensFiltrados = itens.filter(item => {
    const termo = normalizarTexto(busca);
    const matchBusca = !termo || normalizarTexto(item.nome).includes(termo);
    const matchStatus = filtroStatus === "todos" ? true : item.status === filtroStatus;

    let matchCat = true;
    if (filtroCategoria === 'cidade') {
      matchCat = item.tipoEntrega === '1' || Number(item.diasFrete) === 1 || item.canalCompra === 'presencial';
    } else if (filtroCategoria === 'pedido') {
      matchCat = item.vinculoTipo === 'pedido' || (item.vinculo && item.vinculo !== 'Estoque Geral');
    } else if (filtroCategoria === 'acervo') {
      const catNome = normalizarTexto(item.categoria);
      const origNome = normalizarTexto(item.origem);
      const vincNome = normalizarTexto(item.vinculo);
      matchCat = catNome.includes('acervo') || 
                 catNome.includes('reposi') || 
                 catNome.includes('geral') || 
                 origNome.includes('reposicao') || 
                 origNome.includes('estoque') ||
                 item.vinculoTipo === 'geral' || 
                 item.vinculoTipo === 'acervo' ||
                 vincNome === 'estoque geral' ||
                 (!item.vinculoTipo && !item.vinculo);
    } else if (filtroCategoria === 'material') {
      const catNome = normalizarTexto(item.categoria);
      matchCat = catNome.includes('material') || catNome.includes('consumo');
    }

    let matchVinculo = true;
    if (filtroVinculoAtivo) {
      matchVinculo = (item.vinculo || '').toLowerCase().trim() === filtroVinculoAtivo.toLowerCase().trim();
    }

    return matchBusca && matchStatus && matchCat && matchVinculo;
  });

  itensFiltrados.sort((a, b) => {
    const concA = isItemConcluido(a) ? 1 : 0;
    const concB = isItemConcluido(b) ? 1 : 0;

    // 🎯 REGRA DE UX: Itens Pendentes / A Caminho NO TOPO (0), Itens Concluídos/No Acervo NO FINAL DA TABELA (1)
    if (concA !== concB) {
      return concA - concB;
    }

    if (ordemAlfabetica === 'A-Z') return (a.nome || '').localeCompare(b.nome || '');
    if (ordemAlfabetica === 'Z-A') return (b.nome || '').localeCompare(a.nome || '');
    return 0; 
  });

  const alternarOrdem = () => {
      setOrdemAlfabetica(prev => prev === 'Data' ? 'A-Z' : prev === 'A-Z' ? 'Z-A' : 'Data');
  };

  const faltantesFiltradosDecoracao = faltantesDecoracao.filter(item => {
    const busca = normalizarTexto(buscaDecoracao);
    if (!busca) return true;
    return normalizarTexto(item.pecaNome).includes(busca) ||
           normalizarTexto(item.decoracaoNome).includes(busca);
  });

  return (
    <div className="compras-container fade-in">
      
      {/* HERO CABEÇALHO IDÊNTICO AO GESTÃO DE CLIENTES */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            <i className="fas fa-cart-shopping"></i>
          </div>
          <div className="welcome-text">
            <h1>Lista de Compras & Aquisições</h1>
            <p>Gerencie aquisições vinculadas aos pedidos, fornecedores e peças faltantes em decorações.</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            type="button" 
            className="btn-export-whats" 
            onClick={() => setModalExportarAberto(true)}
            title="Enviar lista formatada para o WhatsApp"
          >
            <i className="fab fa-whatsapp"></i> Exportar WhatsApp
          </button>
          <button 
            type="button" 
            className="btn-print-pdf" 
            onClick={() => imprimirListaPDF(false)}
            title="Imprimir ou salvar em PDF"
          >
            <i className="fas fa-file-pdf"></i> Imprimir (PDF)
          </button>
          <button className="btn-primary-celebre" onClick={() => navigate("/compras/nova")}>
            <i className="fas fa-plus"></i>
            <span>ADICIONAR ITEM</span>
          </button>
        </div>
      </div>

      {/* TABS DE SELEÇÃO: LISTA GERAL vs PEÇAS FALTANTES EM DECORAÇÕES */}
      <div className="compras-tabs-bar">
        <button 
          type="button"
          onClick={() => setAbaAtiva('lista')}
          className={`tab-btn-celebre ${abaAtiva === 'lista' ? 'active' : ''}`}
        >
          <i className="fas fa-cart-shopping"></i>
          <span>Minha Lista</span>
          <span className="tab-badge">{itens.length}</span>
        </button>

        <button 
          type="button"
          onClick={() => setAbaAtiva('decoracoes')}
          className={`tab-btn-celebre ${abaAtiva === 'decoracoes' ? 'active' : ''}`}
        >
          <i className="fas fa-sparkles"></i>
          <span>Peças Faltantes</span>
          {faltantesDecoracao.length > 0 && (
            <span className="tab-badge warning">{faltantesDecoracao.length}</span>
          )}
        </button>
      </div>

      {/* CARDS DE DASHBOARD 4 COLUNAS */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro card-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-boxes-stacked"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">ITENS NA LISTA</span>
            <strong className="stat-number">{itens.length}</strong>
            <small className="stat-desc">Itens cadastrados</small>
          </div>
        </div>

        <div className="stat-card-pro card-amber">
          <div className="stat-icon-wrapper icon-amber">
            <i className="fas fa-coins"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">A COMPRAR</span>
            <strong className="stat-number">R$ {totais.pendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Orçamento estimado</small>
          </div>
        </div>

        <div className="stat-card-pro card-red">
          <div className="stat-icon-wrapper icon-red">
            <i className="fas fa-puzzle-piece"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">FALTAM EM KITS</span>
            <strong className="stat-number">{faltantesDecoracao.length}</strong>
            <small className="stat-desc">Peças a adquirir</small>
          </div>
        </div>

        <div className="stat-card-pro card-green">
          <div className="stat-icon-wrapper icon-green">
            <i className="fas fa-circle-check"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">INVESTIDO (MÊS)</span>
            <strong className="stat-number">R$ {totais.realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">
              {totais.economia > 0 && `🟢 Economia: R$ ${totais.economia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
              {totais.economia < 0 && `🔴 Excedente: R$ ${Math.abs(totais.economia).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
              {totais.economia === 0 && `Total aprovado`}
            </small>
          </div>
        </div>
      </div>

      {/* SEBA 1: TABELA MINHA LISTA DE COMPRAS */}
      {abaAtiva === 'lista' ? (
        <div className="table-card-container">
          
          {/* BANNER DE AÇÃO EM LOTE POR VÍNCULO (SE HOUVER FILTRO DE VÍNCULO ATIVO) */}
          {filtroVinculoAtivo && (
            <div className="banner-vinculo-lote">
              <div className="banner-vinculo-info">
                <span>🔗 Vínculo Ativo: <strong>{filtroVinculoAtivo}</strong></span>
                <span className="badge-contagem">{itensFiltrados.length} item(ns)</span>
              </div>
              <div className="banner-vinculo-acoes">
                <button 
                  type="button" 
                  className="btn-lote-vinculo comprar"
                  onClick={() => alterarStatusPorVinculo(filtroVinculoAtivo, 'comprado')}
                  title="Marcar todos os itens deste pedido/vínculo como comprados"
                >
                  🚚 Todos A Caminho
                </button>
                <button 
                  type="button" 
                  className="btn-lote-vinculo chegou"
                  onClick={() => alterarStatusPorVinculo(filtroVinculoAtivo, 'chegou')}
                  title="Marcar todos os itens deste pedido/vínculo como entregues/no acervo"
                >
                  📦 Todos no Acervo
                </button>
                <button 
                  type="button" 
                  className="btn-lote-vinculo limpar"
                  onClick={() => setFiltroVinculoAtivo(null)}
                >
                  ✕ Ver Todos
                </button>
              </div>
            </div>
          )}

          {/* BARRA DE AÇÕES EM MASSA QUANDO HÁ ITENS SELECIONADOS */}
          {itensSelecionados.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', padding: '14px 20px', borderRadius: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', border: '1.5px solid #c5a059', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: '#c5a059', color: '#ffffff', borderRadius: '12px', padding: '4px 12px', fontWeight: '900', fontSize: '0.85rem' }}>
                  {itensSelecionados.length} selecionado(s)
                </span>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '600' }}>
                  Total: R$ {itens.filter(i => itensSelecionados.includes(i.id)).reduce((acc, i) => acc + ((Number(i.quantidade)||1)*(Number(i.valorPago || i.valorEstimado)||0)), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => alterarStatusEmMassa('chegou')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}>
                  📦 Marcar No Acervo
                </button>
                <button type="button" onClick={() => alterarStatusEmMassa('comprado')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}>
                  🚚 Marcar A Caminho
                </button>
                <button type="button" onClick={() => alterarStatusEmMassa('pendente')} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}>
                  ⏳ Marcar Pendente
                </button>
                <button type="button" onClick={() => enviarListaWhatsApp(false, true)} style={{ background: '#25d366', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}>
                  📲 Enviar no Whats
                </button>
                <button type="button" onClick={excluirEmMassa} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}>
                  🗑️ Excluir
                </button>
                <button type="button" onClick={() => setItensSelecionados([])} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', padding: '7px 12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}>
                  ✕ Limpar
                </button>
              </div>
            </div>
          )}

          <div className="table-filter-bar">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Buscar por item ou produto..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>

            <div className="compras-filter-trio-row">
              <div className="filter-select-container filter-tipo-container">
                <select className="filter-select" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                  <option value="todos">📦 Tipo: Todos</option>
                  <option value="cidade">🛒 Presencial (Cidade)</option>
                  <option value="pedido">🔗 Vinculado a Pedido</option>
                  <option value="acervo">🏢 Reposição Acervo</option>
                  <option value="material">🛠️ Material Consumo</option>
                </select>
              </div>
              
              <div className="filter-select-container filter-status-container">
                <select className="filter-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                  <option value="todos">📊 Status: Todos</option>
                  <option value="pendente">⏳ Falta Comprar</option>
                  <option value="comprado">🚚 A Caminho</option>
                  <option value="chegou">📦 No Acervo</option>
                </select>
              </div>

              <button className="btn-secondary-celebre btn-ordem-celebre" onClick={alternarOrdem} title="Mudar Ordem">
                <i className={ordemAlfabetica === 'A-Z' ? "fas fa-arrow-down-a-z" : ordemAlfabetica === 'Z-A' ? "fas fa-arrow-down-z-a" : "fas fa-calendar-days"}></i>
                <span>{ordemAlfabetica === 'A-Z' ? 'Ordem: A - Z' : ordemAlfabetica === 'Z-A' ? 'Ordem: Z - A' : 'Mais Recentes'}</span>
              </button>
            </div>
          </div>

          {/* 💻 VISUALIZAÇÃO DESKTOP: TABELA PRO-TABLE (> 900px) */}
          <div className="table-responsive-wrapper compras-desktop-table-view">
            <table className="compras-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={itensFiltrados.length > 0 && itensSelecionados.length === itensFiltrados.length} 
                      onChange={toggleSelecionarTodos} 
                      title="Selecionar Todos"
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th style={{ minWidth: '220px' }}>ITEM & VÍNCULO</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>QTD.</th>
                  <th style={{ width: '130px' }}>VALOR TOTAL</th>
                  <th style={{ width: '110px' }}>STATUS</th>
                  <th style={{ width: '140px' }}>LOGÍSTICA</th>
                  <th style={{ width: '200px', textAlign: 'right', whiteSpace: 'nowrap' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{textAlign: "center", padding: "40px"}}>Carregando lista...</td></tr>
                ) : itensFiltrados.length === 0 ? (
                  <tr><td colSpan="7" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum item encontrado.</td></tr>
                ) : (
                  itensFiltrados.map((item) => {
                    const qtd = Number(item.quantidade) || 1;
                    const valEst = Number(item.valorEstimado) || 0;
                    const valPago = (item.valorPago !== undefined && item.valorPago !== null && item.valorPago !== '') ? Number(item.valorPago) : valEst;
                    const subtotal = qtd * valPago;

                    const isPedido = item.vinculoTipo === 'pedido'; 
                    const isPresencial = item.tipoEntrega === '1' || Number(item.diasFrete) === 1;
                    
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    
                    let alertaClasse = '';
                    let alertaTexto = '';
                    let labelPrazo = 'PRAZO:';
                    let dataExibicao = 'S/D';

                    if (item.status === 'pendente') {
                        if (isPresencial) {
                            labelPrazo = '📍 Tipo:';
                            dataExibicao = 'Presencial';
                            alertaClasse = '';
                            alertaTexto = '';
                        } else if (isPedido && item.prazo) {
                            const dataPrazo = new Date(item.prazo + 'T00:00:00');
                            const diasParaPrazo = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                            
                            labelPrazo = '🎯 Limite:';
                            dataExibicao = item.prazo.split('-').reverse().join('/');
                            
                            if (diasParaPrazo < 0) { 
                                alertaClasse = 'alerta-vencido';
                                alertaTexto = '☠️ ATRASADA'; 
                            } else if (diasParaPrazo === 0) { 
                                alertaClasse = 'alerta-urgente';
                                alertaTexto = '🚨 HOJE!'; 
                            } else if (diasParaPrazo <= 5) { 
                                alertaClasse = 'alerta-urgente';
                                alertaTexto = `🚨 ${diasParaPrazo} dias`; 
                            } else if (diasParaPrazo <= 10) { 
                                alertaClasse = 'alerta-atencao';
                                alertaTexto = `⚠️ ${diasParaPrazo} dias`; 
                            } else { 
                                alertaClasse = 'alerta-seguro';
                                alertaTexto = `✅ Seguro`; 
                            }
                        } else {
                            labelPrazo = '⏳ Tipo:';
                            dataExibicao = 'Online';
                            alertaClasse = '';
                            alertaTexto = '';
                        }
                    } 
                    else if (item.status === 'comprado') {
                        labelPrazo = '🚚 Previsão:';
                        let previsaoDate = null;
                        
                        if (item.dataCompra && item.diasFrete !== undefined) {
                            previsaoDate = new Date(item.dataCompra);
                            previsaoDate.setDate(previsaoDate.getDate() + Number(item.diasFrete));
                        } else if (!isPedido && item.prazo) {
                            previsaoDate = new Date(item.prazo + 'T00:00:00');
                        }

                        if (previsaoDate) {
                            dataExibicao = previsaoDate.toLocaleDateString('pt-BR');
                            const diasParaChegar = Math.ceil((previsaoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                            
                            if (diasParaChegar < 0) { 
                                alertaClasse = 'alerta-urgente';
                                alertaTexto = '🚨 ATRASADO'; 
                            } else if (diasParaChegar === 0) { 
                                alertaClasse = 'alerta-seguro';
                                alertaTexto = '📦 HOJE!'; 
                            } else { 
                                alertaClasse = 'alerta-a-caminho';
                                alertaTexto = `📦 ${diasParaChegar} dias`; 
                            }
                        } else {
                            dataExibicao = 'Aguardando';
                            alertaClasse = '';
                            alertaTexto = ''; 
                        }
                    } 
                    else if (item.status === 'chegou') {
                        labelPrazo = '✅ Status:';
                        dataExibicao = isPresencial ? 'Presencial' : 'Entregue';
                        alertaClasse = '';
                        alertaTexto = '';
                    }

                    let infoExtraRastreio = null;
                    if (item.status === 'comprado' && item.dataCompra) {
                        infoExtraRastreio = `Comprado: ${new Date(item.dataCompra).toLocaleDateString('pt-BR')}`;
                    } else if (item.status === 'chegou' && item.dataChegada) {
                        infoExtraRastreio = `Recebido: ${new Date(item.dataChegada).toLocaleDateString('pt-BR')}`;
                    }

                    const ehConcluido = isItemConcluido(item);

                    return (
                      <tr 
                        key={item.id} 
                        className={`compras-table-row ${ehConcluido ? 'linha-comprado' : ''} ${itensSelecionados.includes(item.id) ? 'linha-selecionada' : ''}`}
                      >
                        <td className="td-checkbox" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={itensSelecionados.includes(item.id)} 
                            onChange={() => toggleSelecionarItem(item.id)} 
                            className="compras-checkbox-input"
                          />
                        </td>
                        <td className="td-item-info">
                          <span className={`nome-produto ${ehConcluido ? 'concluido' : ''}`}>
                            {item.nome} {item.formato === 'kit' && <span className="tag-kit-gold">(KIT)</span>}
                          </span>
                          <div 
                            className="vinculo-tag" 
                            onClick={(e) => { e.stopPropagation(); setFiltroVinculoAtivo(item.vinculo); }}
                            title="Clique para filtrar todos os itens deste vínculo"
                          >
                            <i className={isPedido ? "fas fa-link" : "fas fa-box"}></i>
                            <span>{item.vinculo || "Estoque Geral"}</span>
                          </div>
                          {item.fornecedor && (
                            <div className="fornecedor-container-row">
                              {(item.fornecedor.startsWith('http://') || item.fornecedor.startsWith('https://') || item.fornecedor.startsWith('www.')) ? (
                                <a 
                                  href={item.fornecedor.startsWith('www.') ? `https://${item.fornecedor}` : item.fornecedor} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="fornecedor-link"
                                  title={item.fornecedor}
                                >
                                  <i className="fas fa-arrow-up-right-from-square"></i> Link Fornecedor
                                </a>
                              ) : (
                                <span className="fornecedor-texto-badge"><i className="fas fa-store"></i> {item.fornecedor}</span>
                              )}
                              {item.fornecedorTelefone && (
                                <button 
                                  type="button" 
                                  onClick={() => abrirWhatsAppFornecedor(item.fornecedorTelefone, item.nome, item.quantidade)} 
                                  className="btn-whats-fornecedor"
                                  title="Abrir conversa no WhatsApp com o fornecedor"
                                >
                                  <i className="fab fa-whatsapp"></i> Whats
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        
                        <td data-label="Qtd." className="td-qtd">
                            <strong className="qtd-badge-val">{item.quantidade}x</strong>
                        </td>
                        
                        <td data-label="Valor Total" className="td-valor">
                            <div className="preco-real">
                              R$ {subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </div>
                            <small className="preco-estimado-sub">
                               Est: R$ {valEst.toFixed(2)} un.
                            </small>
                            {item.valorPago !== undefined && item.valorPago !== null && item.valorPago !== '' && (
                              <div className="valor-pago-badge-box">
                                <span 
                                  className={`badge-valor-pago ${valPago < valEst ? 'economia' : valPago > valEst ? 'excedente' : 'igual'}`}
                                  onClick={() => abrirModalValorPago(item, null)}
                                  title="Clique para editar o valor realmente pago"
                                >
                                  {valPago < valEst && `🟢 R$ ${valPago.toFixed(2)} un (-R$ ${(valEst - valPago).toFixed(2)})`}
                                  {valPago > valEst && `🔴 R$ ${valPago.toFixed(2)} un (+R$ ${(valPago - valEst).toFixed(2)})`}
                                  {valPago === valEst && `✅ R$ ${valPago.toFixed(2)} un (Estimado)`}
                                </span>
                              </div>
                            )}
                        </td>
                        
                        <td data-label="Status" className="td-status">
                          <span className={`badge ${item.status}`}>
                            {item.status === 'pendente' && 'Pendente'}
                            {item.status === 'comprado' && 'A Caminho'}
                            {item.status === 'chegou' && 'No Acervo'}
                          </span>
                        </td>

                        <td data-label="Logística" className="td-logistica">
                          <div className="logistica-inner-box">
                            <span className={`prazo-badge ${isPedido ? 'prazo-pedido' : 'prazo-estoque'}`}>
                              <i className={isPedido ? "fas fa-calendar-day" : "fas fa-truck-fast"}></i>
                              {dataExibicao}
                            </span>
                            {infoExtraRastreio && (
                                <span className="extra-rastreio-badge">
                                    {infoExtraRastreio}
                                </span>
                            )}
                            {item.status !== 'chegou' && alertaTexto && (
                                <span className={`alerta-logistica ${alertaClasse}`}>
                                  {alertaTexto}
                                </span>
                            )}
                          </div>
                        </td>

                        <td className="td-acoes">
                          <div className="table-actions-container">
                            {item.status === 'pendente' && (
                               <button 
                                 className="btn-acao-status comprar" 
                                 onClick={() => isPresencial ? handleStatusChange(item, 'chegou') : handleStatusChange(item, 'comprado')}
                                 title={isPresencial ? "Compra presencial (Já está com você)" : "Marcar como comprado via frete"}
                               >
                                  <i className="fas fa-cart-shopping"></i> {isPresencial ? 'Comprado' : 'A Caminho'}
                                </button>
                            )}
                            
                            {item.status === 'comprado' && (
                               <>
                                 <button className="btn-acao-status desfazer" onClick={() => handleStatusChange(item, 'pendente')} title="Voltar para Pendente">
                                   <i className="fas fa-rotate-left"></i> Pendente
                                 </button>
                                 <button className="btn-acao-status chegou" onClick={() => handleStatusChange(item, 'chegou')} title="Confirmar chegada no acervo">
                                   <i className="fas fa-box-open"></i> Chegou
                                 </button>
                               </>
                            )}

                            {item.status === 'chegou' && (
                              item.estoqueSomado ? (
                                <span className="badge-estoque-somado">
                                  <i className="fas fa-check"></i> Estoque Somado (+{item.quantidade || 1})
                                </span>
                              ) : (item.isItemExistente || item.vinculoTipo === 'decoracao' || estoqueExistenteNomes.has((item.nome || '').toLowerCase().trim())) ? (
                                <button 
                                  type="button"
                                  onClick={() => somarManualAoEstoque(item)}
                                  className="btn-somar-estoque-manual"
                                  title="Clique para somar a quantidade comprada ao acervo existente"
                                >
                                  <i className="fas fa-plus"></i> Somar +{item.quantidade || 1} un
                                </button>
                              ) : item.categoria !== "material" ? (
                                <button 
                                  className="btn-cadastrar-acervo" 
                                  onClick={() => navigate('/cadastro-estoque', { state: { dadosCompra: item } })}
                                  title="Cadastrar detalhes da peça inédita no Acervo"
                                >
                                  <i className="fas fa-plus"></i> Cadastrar
                                </button>
                              ) : (
                                <span className="badge-material-baixado">
                                  <i className="fas fa-box"></i> Material Baixado
                                </span>
                              )
                            )}

                            <div className="table-mini-actions-group">
                              <button className="action-btn recomprar" onClick={() => handleRecomprar(item)} title="Recomprar este item"><i className="fas fa-rotate"></i></button>
                              <button className="action-btn edit" onClick={() => navigate(`/compras/editar/${item.id}`)} title="Editar"><i className="fas fa-pen-to-square"></i></button>
                              <button className="action-btn delete" onClick={() => handleExcluir(item.id, item.nome)} title="Excluir"><i className="fas fa-trash-can"></i></button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 📱 VISUALIZAÇÃO MOBILE: CARDS LUXURY ESTRUTURADOS (<= 900px) */}
          <div className="compras-mobile-cards-view">
            {loading ? (
              <div className="compras-empty-state-mobile">
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px', color: '#c5a059' }}></i>
                <span>Carregando lista de compras...</span>
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="compras-empty-state-mobile">
                <i className="fas fa-box-open" style={{ fontSize: '28px', color: '#94a3b8' }}></i>
                <span>Nenhum item encontrado com estes filtros.</span>
              </div>
            ) : (
              itensFiltrados.map((item) => {
                const qtd = Number(item.quantidade) || 1;
                const valEst = Number(item.valorEstimado) || 0;
                const valPago = (item.valorPago !== undefined && item.valorPago !== null && item.valorPago !== '') ? Number(item.valorPago) : valEst;
                const subtotal = qtd * valPago;

                const isPedido = item.vinculoTipo === 'pedido'; 
                const isPresencial = item.tipoEntrega === '1' || Number(item.diasFrete) === 1;
                
                const hoje = new Date();
                hoje.setHours(0,0,0,0);
                
                let alertaClasse = '';
                let alertaTexto = '';
                let dataExibicao = 'S/D';

                if (item.status === 'pendente') {
                    if (isPresencial) {
                        dataExibicao = 'Presencial';
                    } else if (isPedido && item.prazo) {
                        const dataPrazo = new Date(item.prazo + 'T00:00:00');
                        const diasParaPrazo = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                        dataExibicao = item.prazo.split('-').reverse().join('/');
                        
                        if (diasParaPrazo < 0) { 
                            alertaClasse = 'alerta-vencido';
                            alertaTexto = '☠️ ATRASADA'; 
                        } else if (diasParaPrazo === 0) { 
                            alertaClasse = 'alerta-urgente';
                            alertaTexto = '🚨 HOJE!'; 
                        } else if (diasParaPrazo <= 5) { 
                            alertaClasse = 'alerta-urgente';
                            alertaTexto = `🚨 ${diasParaPrazo}d`; 
                        } else if (diasParaPrazo <= 10) { 
                            alertaClasse = 'alerta-atencao';
                            alertaTexto = `⚠️ ${diasParaPrazo}d`; 
                        } else { 
                            alertaClasse = 'alerta-seguro';
                            alertaTexto = `✅ Seguro`; 
                        }
                    } else {
                        dataExibicao = 'Online';
                    }
                } 
                else if (item.status === 'comprado') {
                    let previsaoDate = null;
                    if (item.dataCompra && item.diasFrete !== undefined) {
                        previsaoDate = new Date(item.dataCompra);
                        previsaoDate.setDate(previsaoDate.getDate() + Number(item.diasFrete));
                    } else if (!isPedido && item.prazo) {
                        previsaoDate = new Date(item.prazo + 'T00:00:00');
                    }

                    if (previsaoDate) {
                        dataExibicao = previsaoDate.toLocaleDateString('pt-BR');
                        const diasParaChegar = Math.ceil((previsaoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                        
                        if (diasParaChegar < 0) { 
                            alertaClasse = 'alerta-urgente';
                            alertaTexto = '🚨 ATRASADO'; 
                        } else if (diasParaChegar === 0) { 
                            alertaClasse = 'alerta-seguro';
                            alertaTexto = '📦 HOJE!'; 
                        } else { 
                            alertaClasse = 'alerta-a-caminho';
                            alertaTexto = `📦 ${diasParaChegar}d`; 
                        }
                    } else {
                        dataExibicao = 'Aguardando';
                    }
                } 
                else if (item.status === 'chegou') {
                    dataExibicao = isPresencial ? 'Presencial' : 'Entregue';
                }

                const ehConcluido = isItemConcluido(item);
                const isSelected = itensSelecionados.includes(item.id);

                return (
                  <div 
                    key={item.id} 
                    className={`compras-mobile-card ${ehConcluido ? 'card-comprado' : ''} ${isSelected ? 'card-selecionado' : ''}`}
                  >
                    {/* TOPO: CHECKBOX + NOME + TAG KIT */}
                    <div className="cm-card-top-header">
                      <div className="cm-card-title-group">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelecionarItem(item.id)} 
                          className="compras-checkbox-input"
                        />
                        <span className={`cm-card-nome ${ehConcluido ? 'concluido' : ''}`}>
                          {item.nome} {item.formato === 'kit' && <span className="tag-kit-gold">(KIT)</span>}
                        </span>
                      </div>

                      <span className={`badge ${item.status}`}>
                        {item.status === 'pendente' && 'Pendente'}
                        {item.status === 'comprado' && 'A Caminho'}
                        {item.status === 'chegou' && 'No Acervo'}
                      </span>
                    </div>

                    {/* VÍNCULO & FORNECEDOR */}
                    <div className="cm-card-meta-row">
                      <div 
                        className="vinculo-tag" 
                        onClick={() => setFiltroVinculoAtivo(item.vinculo)}
                        title="Clique para filtrar itens deste vínculo"
                      >
                        <i className={isPedido ? "fas fa-link" : "fas fa-box"}></i>
                        <span>{item.vinculo || "Estoque Geral"}</span>
                      </div>

                      {item.fornecedor && (
                        <div className="cm-card-fornecedor-box">
                          {(item.fornecedor.startsWith('http://') || item.fornecedor.startsWith('https://') || item.fornecedor.startsWith('www.')) ? (
                            <a 
                              href={item.fornecedor.startsWith('www.') ? `https://${item.fornecedor}` : item.fornecedor} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="fornecedor-link"
                            >
                              <i className="fas fa-arrow-up-right-from-square"></i> Link
                            </a>
                          ) : (
                            <span className="fornecedor-texto-badge"><i className="fas fa-store"></i> {item.fornecedor}</span>
                          )}
                          {item.fornecedorTelefone && (
                            <button 
                              type="button" 
                              onClick={() => abrirWhatsAppFornecedor(item.fornecedorTelefone, item.nome, item.quantidade)} 
                              className="btn-whats-fornecedor"
                            >
                              <i className="fab fa-whatsapp"></i> Whats
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* SUB-GRID COM VALOR, QUANTIDADE E LOGÍSTICA */}
                    <div className="cm-card-body-grid">
                      <div className="cm-info-col">
                        <span className="cm-info-label">QUANTIDADE</span>
                        <strong className="cm-info-val-qtd">{item.quantidade}x</strong>
                      </div>

                      <div className="cm-info-col" style={{ textAlign: 'right' }}>
                        <span className="cm-info-label">VALOR TOTAL</span>
                        <strong className="cm-info-val-preco">
                          R$ {subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </strong>
                        <small className="preco-estimado-sub">
                          Est: R$ {valEst.toFixed(2)} un.
                        </small>
                      </div>
                    </div>

                    {/* BADGE DE ECONOMIA (SE HOUVER) */}
                    {item.valorPago !== undefined && item.valorPago !== null && item.valorPago !== '' && (
                      <div className="cm-card-economia-row">
                        <span 
                          className={`badge-valor-pago ${valPago < valEst ? 'economia' : valPago > valEst ? 'excedente' : 'igual'}`}
                          onClick={() => abrirModalValorPago(item, null)}
                        >
                          {valPago < valEst && `🟢 R$ ${valPago.toFixed(2)} un (-R$ ${(valEst - valPago).toFixed(2)})`}
                          {valPago > valEst && `🔴 R$ ${valPago.toFixed(2)} un (+R$ ${(valPago - valEst).toFixed(2)})`}
                          {valPago === valEst && `✅ R$ ${valPago.toFixed(2)} un (Estimado)`}
                        </span>
                      </div>
                    )}

                    {/* LINHA DE LOGÍSTICA / PRAZO */}
                    <div className="cm-card-logistica-line">
                      <span className={`prazo-badge ${isPedido ? 'prazo-pedido' : 'prazo-estoque'}`}>
                        <i className={isPedido ? "fas fa-calendar-day" : "fas fa-truck-fast"}></i>
                        <span>{dataExibicao}</span>
                      </span>

                      {item.status !== 'chegou' && alertaTexto && (
                        <span className={`alerta-logistica ${alertaClasse}`}>
                          {alertaTexto}
                        </span>
                      )}
                    </div>

                    {/* RODAPÉ DE AÇÕES DO CARD */}
                    <div className="cm-card-footer-actions">
                      <div className="cm-status-action-box">
                        {item.status === 'pendente' && (
                          <button 
                            className="btn-acao-status comprar" 
                            onClick={() => isPresencial ? handleStatusChange(item, 'chegou') : handleStatusChange(item, 'comprado')}
                          >
                            <i className="fas fa-cart-shopping"></i> {isPresencial ? 'Comprado' : 'A Caminho'}
                          </button>
                        )}
                        
                        {item.status === 'comprado' && (
                          <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                            <button className="btn-acao-status desfazer" onClick={() => handleStatusChange(item, 'pendente')}>
                              <i className="fas fa-rotate-left"></i> Pendente
                            </button>
                            <button className="btn-acao-status chegou" onClick={() => handleStatusChange(item, 'chegou')}>
                              <i className="fas fa-box-open"></i> Chegou
                            </button>
                          </div>
                        )}

                        {item.status === 'chegou' && (
                          item.estoqueSomado ? (
                            <span className="badge-estoque-somado">
                              <i className="fas fa-check"></i> Estoque Somado (+{item.quantidade || 1})
                            </span>
                          ) : (item.isItemExistente || item.vinculoTipo === 'decoracao' || estoqueExistenteNomes.has((item.nome || '').toLowerCase().trim())) ? (
                            <button 
                              type="button"
                              onClick={() => somarManualAoEstoque(item)}
                              className="btn-somar-estoque-manual"
                            >
                              <i className="fas fa-plus"></i> Somar +{item.quantidade || 1} un
                            </button>
                          ) : item.categoria !== "material" ? (
                            <button 
                              className="btn-cadastrar-acervo" 
                              onClick={() => navigate('/cadastro-estoque', { state: { dadosCompra: item } })}
                            >
                              <i className="fas fa-plus"></i> Cadastrar no Acervo
                            </button>
                          ) : (
                            <span className="badge-material-baixado">
                              <i className="fas fa-box"></i> Material Baixado
                            </span>
                          )
                        )}
                      </div>

                      <div className="table-mini-actions-group">
                        <button className="action-btn recomprar" onClick={() => handleRecomprar(item)} title="Recomprar"><i className="fas fa-rotate"></i></button>
                        <button className="action-btn edit" onClick={() => navigate(`/compras/editar/${item.id}`)} title="Editar"><i className="fas fa-pen-to-square"></i></button>
                        <button className="action-btn delete" onClick={() => handleExcluir(item.id, item.nome)} title="Excluir"><i className="fas fa-trash-can"></i></button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* 🎯 ABA 2: PEÇAS FALTANTES EM DECORAÇÕES COMPLETAS */
        <div className="table-card-container">
          <div className="table-filter-bar">
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por tema da decoração ou peça faltante..." 
                value={buscaDecoracao} 
                onChange={e => setBuscaDecoracao(e.target.value)} 
              />
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569' }}>
              Exibindo <strong style={{ color: '#0f172a' }}>{faltantesFiltradosDecoracao.length}</strong> peças pendentes
            </div>
          </div>

          {/* 💻 VISUALIZAÇÃO DESKTOP: TABELA (> 900px) */}
          <div className="table-responsive-wrapper compras-desktop-table-view">
            <table className="compras-table">
              <thead>
                <tr>
                  <th>DECORAÇÃO (TEMA)</th>
                  <th>PEÇA FALTANTE</th>
                  <th style={{ textAlign: 'center' }}>NO PACOTE</th>
                  <th style={{ textAlign: 'center' }}>ESTOQUE ATUAL</th>
                  <th style={{ textAlign: 'center' }}>FALTA COMPRAR</th>
                  <th style={{ textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loadingDecoracoes ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>Analisando estoque e decorações...</td></tr>
                ) : faltantesFiltradosDecoracao.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>🎉 Nenhuma peça faltante encontrada nas decorações! Todas as peças estão disponíveis no acervo.</td></tr>
                ) : (
                  faltantesFiltradosDecoracao.map(item => (
                    <tr key={item.idUnico}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {item.decoracaoFoto ? (
                            <img src={item.decoracaoFoto} alt={item.decoracaoNome} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>✨</div>
                          )}
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>{item.decoracaoNome}</strong>
                            <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Decoração Completa</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {item.pecaFoto ? (
                            <img src={item.pecaFoto} alt={item.pecaNome} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📦</div>
                          )}
                          <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{item.pecaNome}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.qtdNoKit}x</td>
                      <td style={{ textAlign: 'center', color: item.qtdNoEstoque === 0 ? '#ef4444' : '#f59e0b', fontWeight: '800' }}>{item.qtdNoEstoque}x</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '12px', fontWeight: '850', fontSize: '0.8rem' }}>
                          -{item.faltam}x
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.jaNaLista ? (
                          <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '12px', fontWeight: '800', fontSize: '0.78rem' }}>
                            ✓ Já na Lista de Compras
                          </span>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => adicionarItemDecoracaoALista(item)}
                            style={{ background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '12px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)' }}
                          >
                            🛒 Adicionar à Lista
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 📱 VISUALIZAÇÃO MOBILE: CARDS DE FALTANTES (<= 900px) */}
          <div className="compras-mobile-cards-view">
            {loadingDecoracoes ? (
              <div className="compras-empty-state-mobile">
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px', color: '#c5a059' }}></i>
                <span>Analisando estoque e decorações...</span>
              </div>
            ) : faltantesFiltradosDecoracao.length === 0 ? (
              <div className="compras-empty-state-mobile">
                <i className="fas fa-sparkles" style={{ fontSize: '28px', color: '#c5a059' }}></i>
                <span>🎉 Nenhuma peça faltante! Todas as peças estão disponíveis no acervo.</span>
              </div>
            ) : (
              faltantesFiltradosDecoracao.map(item => (
                <div key={item.idUnico} className="faltante-mobile-card">
                  <div className="fm-card-top-decor">
                    {item.decoracaoFoto ? (
                      <img src={item.decoracaoFoto} alt={item.decoracaoNome} className="fm-decor-thumb" />
                    ) : (
                      <div className="fm-decor-thumb-placeholder">✨</div>
                    )}
                    <div className="fm-decor-info">
                      <strong className="fm-decor-title">{item.decoracaoNome}</strong>
                      <span className="fm-decor-sub">Decoração Completa</span>
                    </div>
                  </div>

                  <div className="fm-card-peca-box">
                    {item.pecaFoto ? (
                      <img src={item.pecaFoto} alt={item.pecaNome} className="fm-peca-thumb" />
                    ) : (
                      <div className="fm-peca-thumb-placeholder">📦</div>
                    )}
                    <div className="fm-peca-info">
                      <span className="fm-peca-label">PEÇA FALTANTE</span>
                      <strong className="fm-peca-title">{item.pecaNome}</strong>
                    </div>
                  </div>

                  <div className="fm-card-stats-row">
                    <div className="fm-stat-item">
                      <span className="fm-stat-label">NO PACOTE</span>
                      <strong className="fm-stat-val">{item.qtdNoKit}x</strong>
                    </div>
                    <div className="fm-stat-item">
                      <span className="fm-stat-label">ESTOQUE</span>
                      <strong className={`fm-stat-val ${item.qtdNoEstoque === 0 ? 'zerado' : ''}`}>{item.qtdNoEstoque}x</strong>
                    </div>
                    <div className="fm-stat-item">
                      <span className="fm-stat-label">FALTA COMPRAR</span>
                      <strong className="fm-stat-val faltam">-{item.faltam}x</strong>
                    </div>
                  </div>

                  <div className="fm-card-action-footer">
                    {item.jaNaLista ? (
                      <span className="badge-ja-na-lista">
                        ✓ Já na Lista de Compras
                      </span>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => adicionarItemDecoracaoALista(item)}
                        className="btn-adicionar-faltante-mobile"
                      >
                        🛒 Adicionar à Lista (-{item.faltam}x)
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL REGISTRO DE VALOR PAGO (ECONOMIA REAL) */}
      {modalValorPagoAberto && itemParaValorPago && (
        <div className="modal-overlay-celebre fade-in">
          <div className="modal-card-celebre" style={{ maxWidth: '420px', padding: '24px' }}>
            <div className="modal-header-celebre" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '850', color: '#0f172a' }}>
                💰 Registrar Valor Pago
              </h3>
              <button 
                type="button" 
                onClick={() => setModalValorPagoAberto(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={salvarValorPagoEConcluir}>
              <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: '800', fontSize: '0.92rem', color: '#0f172a' }}>
                  {itemParaValorPago.nome}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Qtd: {itemParaValorPago.quantidade || 1}x | Estimado: R$ {Number(itemParaValorPago.valorEstimado || 0).toFixed(2)} un.
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '850', color: '#475569', marginBottom: '6px' }}>
                  VALOR UNITÁRIO REALMENTE PAGO (R$):
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={inputValorPagoUnitario}
                  onChange={(e) => setInputValorPagoUnitario(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: '1.5px solid #c5a059', fontSize: '1.1rem', fontWeight: '800', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setModalValorPagoAberto(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                >
                  Confirmar e Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compras;