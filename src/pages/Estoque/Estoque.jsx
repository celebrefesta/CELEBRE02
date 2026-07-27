import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Estoque.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, query, deleteDoc, updateDoc, writeBatch, where, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORIAS_FISICAS } from '../../catalogoDeTemas'; 

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

  const [modalAddPedidoAberto, setModalAddPedidoAberto] = useState(false);
  const [itemParaPedido, setItemParaPedido] = useState(null);
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState('');
  const [adicionandoAoPedido, setAdicionandoAoPedido] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);

  // ☑️ SELEÇÃO EM MASSA
  const [itensSelecionados, setItensSelecionados] = useState(new Set());
  // 🔢 MODO DE VISUALIZAÇÃO
  const [modoVisualizacao, setModoVisualizacao] = useState('lista'); // 'lista' | 'grid'

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

  const corrigirNomesDuplicados = async () => {
      if (!usuarioLogado) return;
      setLimandoNomes(true);
      try {
          // 🎯 BUSCA NA EMPRESA
          const q = query(collection(db, "estoque"), where("userId", "==", tenantId));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          let alterados = 0;

          snap.forEach(docSnap => {
              const item = docSnap.data();
              let nomeAtual = item.nome || '';
              let nomeNovo = nomeAtual;

              const ehKit = item.especificacoes?.isKitPai || item.especificacoes?.isKit || (item.especificacoes?.pecasKit && item.especificacoes?.pecasKit.length > 0);
              const ehFilha = item.especificacoes?.isSubPeca || (item.codigo && /-P\d+$/.test(item.codigo) && !ehKit);

              if (ehKit) {
                  if (!nomeAtual.toUpperCase().includes('KIT')) {
                      nomeNovo = `KIT ${nomeAtual}`;
                  }
              } else if (ehFilha) {
                  let pai = nomeAtual;
                  if (nomeAtual.includes(' - ')) pai = nomeAtual.split(' - ')[0].trim();
                  if (pai.toUpperCase().startsWith('KIT ')) pai = pai.substring(4).trim();
                  
                  const tam = item.especificacoes?.tamanho || '';
                  const cor = item.especificacoes?.cor || '';
                  
                  let sufixos = [];
                  if (tam) sufixos.push(tam.trim());
                  if (cor) sufixos.push(cor.trim());

                  if (sufixos.length > 0) {
                      nomeNovo = `${pai} - ${sufixos.join(' ')}`;
                  } else {
                      let filhaLimpa = '';
                      if (nomeAtual.includes(' - ')) {
                          let filha = nomeAtual.split(' - ').slice(1).join(' - ').trim();
                          let regexPai = new RegExp(pai, "ig");
                          filhaLimpa = filha.replace(regexPai, "").replace(/^[- ]+/g, "").replace(/cilindro/ig, "").replace(/painel/ig, "").trim();
                      }

                      if (!filhaLimpa || /^P\d+$/i.test(filhaLimpa)) {
                          nomeNovo = `${pai} - ⚠️ Sem Medida (Edite)`;
                      } else {
                          nomeNovo = `${pai} - ${filhaLimpa}`;
                      }
                  }
              }

              if (nomeNovo && nomeNovo !== nomeAtual) {
                  batch.update(docSnap.ref, { 
                      nome: nomeNovo,
                      ...(ehFilha ? { "especificacoes.isSubPeca": true } : {}) 
                  });
                  alterados++;
              }
          });

          if (alterados > 0) {
              await batch.commit();
              await registrarLog("AJUSTE EM LOTE NO ESTOQUE", `Executou a limpeza e padronização automática de nomes de ${alterados} kits e peças.`);
              alert(`✅ Mágica Feita! O robô arrumou os nomes de ${alterados} peças e kits! Verifique as que ficaram com o aviso "Sem Medida".`);
              carregarDados();
          } else {
              alert("✨ Tudo já está perfeitamente organizado!");
          }
      } catch(e) {
          console.error("Erro ao limpar nomes:", e);
          alert("Erro ao executar a limpeza.");
      } finally {
          setLimandoNomes(false);
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

  const abrirModalManutencao = (item) => {
    setItemParaManutencao(item);
    const qtdAtual = item.qtdManutencao !== undefined ? item.qtdManutencao : (item.status === 'manutencao' ? item.quantidade : 0);
    setQtdMaint(qtdAtual === 0 ? 1 : qtdAtual);
    setModalManutencao(true);
  };

  const salvarManutencao = async () => {
    if (!itemParaManutencao) return;
    const valor = parseInt(qtdMaint);
    if (isNaN(valor) || valor < 0 || valor > itemParaManutencao.quantidade) {
      alert("Quantidade inválida!");
      return;
    }
    try {
      await updateDoc(doc(db, "estoque", itemParaManutencao.id), {
        qtdManutencao: valor,
        status: valor === itemParaManutencao.quantidade ? 'manutencao' : 'ok'
      });
      await registrarLog("MANUTENÇÃO DE ACERVO", `Moveu ${valor} unidades da peça "${itemParaManutencao.nome}" para o status de manutenção/reparo.`);
      setModalManutencao(false);
      carregarDados();
    } catch (error) { alert("Erro ao atualizar."); }
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
          qtdBase, disponivelTotal, alugados: alugadosNaData, emManutencao: emMaint, tudoQuebrado, estaTotalmenteAlugado, isDeco
      };
  };

  const dbCategorias = itens.map(i => i.categoria).filter(Boolean);
  const padraoCategorias = Object.keys(CATEGORIAS_FISICAS);
  const categoriasUnicas = Array.from(new Set([...padraoCategorias, ...dbCategorias])).sort();
  const localizacoesUnicas = Array.from(new Set(itens.map(i => i.localizacao).filter(Boolean))).sort();

  const totalItens = itens.length;
  const valorAcervo = itens.reduce((acc, i) => acc + ((i.financeiro?.valorReposicao || i.financeiro?.valorCompra || 0) * i.quantidade), 0);
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
    <div className="clientes-container fade-in" onClick={() => setMenuAberto(null)}>
      
      {/* HERO CABEÇALHO IDÊNTICO AO GESTÃO DE CLIENTES */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            📦
          </div>
          <div className="welcome-text">
            <h1>Gestão de Acervo e Estoque</h1>
            <p>Controle logístico, financeiro e catálogo online. <strong style={{color: totalItens >= limiteEstoque ? '#ef4444' : '#15803d'}}>(Limite: {totalItens.toLocaleString('pt-BR')} / {limiteEstoque.toLocaleString('pt-BR')})</strong></p>
          </div>
        </div>
        <div className="header-actions">
          {/* 🔢 Toggle de Visualização */}
          <div className="view-toggle-group">
            <button
              className={`view-toggle-btn${modoVisualizacao === 'lista' ? ' active' : ''}`}
              onClick={() => setModoVisualizacao('lista')}
              title="Visão em Lista"
            >
              ☰ Lista
            </button>
            <button
              className={`view-toggle-btn${modoVisualizacao === 'grid' ? ' active' : ''}`}
              onClick={() => setModoVisualizacao('grid')}
              title="Visão em Cards"
            >
              ⊞ Cards
            </button>
          </div>
          <button 
            className="btn-secondary-celebre" 
            onClick={corrigirNomesDuplicados} 
            disabled={limpandoNomes}
            title="Adiciona 'KIT' nos pacotes e puxa as características das filhas"
          >
            {limpandoNomes ? '⏳ Ajustando...' : '🧹 Ajustar Nomes'}
          </button>
          <button className="btn-secondary-celebre" onClick={imprimirListaFiltrada}>
            🖨️ Imprimir Lista
          </button>
          <button className="btn-primary-celebre" onClick={() => irParaCadastro()} style={{ opacity: totalItens >= limiteEstoque ? 0.7 : 1 }}>
            + NOVO ITEM
          </button>
        </div>
      </div>

      {/* CARDS DE DASHBOARD 4 COLUNAS IDÊNTICOS AO GESTÃO DE CLIENTES */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro">
          <div className="stat-icon-wrapper icon-purple">
            📦
          </div>
          <div className="stat-content">
            <span className="stat-title">TOTAL DE ITENS</span>
            <strong className="stat-number">{totalItens}</strong>
            <small style={{color: '#7e22ce', fontSize: '0.75rem', fontWeight: '600'}}>Cadastrados no acervo</small>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper icon-amber">
            📊
          </div>
          <div className="stat-content">
            <span className="stat-title">VALOR DO ACERVO</span>
            <strong className="stat-number">R$ {valorAcervo.toLocaleString('pt-BR')}</strong>
            <small style={{color: '#b45309', fontSize: '0.75rem', fontWeight: '600'}}>Patrimônio investido</small>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper icon-red">
            🛠️
          </div>
          <div className="stat-content">
            <span className="stat-title">EM MANUTENÇÃO</span>
            <strong className="stat-number">{emManutencaoTotal}</strong>
            <small style={{color: '#b91c1c', fontSize: '0.75rem', fontWeight: 'bold'}}>Necessitam reparos</small>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper icon-green">
            👁️
          </div>
          <div className="stat-content">
            <span className="stat-title">VISÍVEL CATÁLOGO</span>
            <strong className="stat-number">{percentualVisivel}%</strong>
            <small style={{color: '#15803d', fontSize: '0.75rem', fontWeight: '600'}}>Disponível no catálogo</small>
          </div>
        </div>
      </div>

      {/* CONTAINER TABELA E FILTROS IDÊNTICOS AO GESTÃO DE CLIENTES */}
      <div className="table-card-container">
        <div className="table-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <button className="btn-secondary-celebre" onClick={() => setOrdemAlfabetica(prev => prev === 'A-Z' ? 'Z-A' : 'A-Z')} title="Alterar Ordem Alfabética">
              {ordemAlfabetica === 'A-Z' ? '⬇️ A - Z' : '⬆️ Z - A'}
          </button>

          <div className="filter-select-container">
            <select className="filter-select" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
              <option value="">📂 Categoria: Todas</option>
              {categoriasUnicas.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-container">
            <select className="filter-select" value={localizacaoFiltro} onChange={e => setLocalizacaoFiltro(e.target.value)}>
              <option value="">📍 Galpão: Todos</option>
              {localizacoesUnicas.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-container">
            <select className="filter-select" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
              <option value="">🚦 Status: Todos</option>
              <option value="disponivel">✅ Somente Disponíveis</option>
              <option value="manutencao">🛠️ Somente em Manutenção</option>
              {dataFiltro && <option value="indisponivel">🚫 Somente Alugados / Esgotados</option>}
            </select>
          </div>

          <div className="filter-select-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="date" className="filter-select" value={dataFiltro} onChange={e => {
                setDataFiltro(e.target.value);
                if (!e.target.value && statusFiltro === 'indisponivel') setStatusFiltro('');
            }} />
            {dataFiltro && <button className="btn-limpar-data" onClick={limparFiltroData} title="Limpar Data">✕</button>}
          </div>
        </div>

        {/* ── BARRA DE SELEÇÃO EM MASSA ── */}
        {itensSelecionados.size > 0 && (
          <div className="bulk-action-bar">
            <div className="bulk-info">
              <input
                type="checkbox"
                title="Marcar/desmarcar todos"
                checked={itensFiltrados.length > 0 && itensSelecionados.size === itensFiltrados.length}
                onChange={() => {
                  if (itensSelecionados.size === itensFiltrados.length) setItensSelecionados(new Set());
                  else setItensSelecionados(new Set(itensFiltrados.map(i => i.id)));
                }}
              />
              <span><strong>{itensSelecionados.size}</strong> {itensSelecionados.size === 1 ? 'item selecionado' : 'itens selecionados'}</span>
            </div>
            <div className="bulk-buttons">
              <button className="bulk-btn-danger" onClick={excluirEmMassa}>🗑️ Excluir Selecionados</button>
              <button className="bulk-btn-cancel" onClick={() => setItensSelecionados(new Set())}>✕ Cancelar Seleção</button>
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
                      : <div className="estoque-card-no-photo">📷</div>}
                    <span className="badge estoque-card-status" style={{ backgroundColor: bgPill, color: colorPill, border: `1px solid ${borderPill}` }}>{labelPill}</span>
                  </div>

                  {(ehKitPai || ehSubPeca || isDeco) && (
                    <div className="estoque-card-badges">
                      {ehKitPai && <span className="card-badge-kit">📦 KIT</span>}
                      {ehSubPeca && <span className="card-badge-peca">🧩 PEÇA</span>}
                      {isDeco && <span className="card-badge-deco">✨ DECO</span>}
                    </div>
                  )}

                  <div className="estoque-card-info">
                    <strong className="estoque-card-nome" style={{ color: item.nome.includes('⚠️') ? '#ef4444' : 'var(--texto-principal, #0f172a)' }}>{item.nome}</strong>
                    <span className="estoque-card-codigo">CÓD: {item.codigo || 'S/N'}</span>
                    <span className="estoque-card-cat">{item.categoria || '—'}</span>
                    {item.localizacao && <span className="estoque-card-loc">📍 {item.localizacao}</span>}
                  </div>

                  <div className="estoque-card-footer">
                    <div className="estoque-card-price-row">
                      <strong>R$ {valorAluguelFormatado}</strong>
                      <span>{disponivelTotal} {isDeco ? 'kit' : 'un'} disp.</span>
                    </div>
                    <div className="estoque-card-actions">
                      <button className="action-btn" onClick={() => { setItemParaPedido(item); setPedidoSelecionadoId(''); setModalAddPedidoAberto(true); }} title="Adicionar ao Pedido">🛒</button>
                      <button className="action-btn edit" onClick={() => irParaCadastro(item)} title="Editar">✏️</button>
                      <button className="action-btn duplicate" onClick={() => duplicarItem(item)} title="Duplicar Item">📋</button>
                      <button className="action-btn delete" onClick={async () => { if(window.confirm('Excluir permanentemente do acervo?')) { await registrarLog('EXCLUSÃO DE ACERVO', `Apagou permanentemente o item "${item.nome}" do estoque.`); deleteDoc(doc(db, 'estoque', item.id)).then(carregarDados); }}} title="Excluir">🗑️</button>
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
                  const { qtdBase, disponivelTotal, estaTotalmenteAlugado, tudoQuebrado, isDeco } = calcularDisponibilidadeNaData(item);
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '44px', height: '44px', backgroundColor: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                              {item.foto ? (
                                <img src={item.foto} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', objectPosition: posImg ? `${posImg.x}% ${posImg.y}%` : '50% 50%' }} onClick={(e) => { e.stopPropagation(); setImagemAmpliada(item.foto); }} title="Ampliar"/>
                              ) : ( <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', color:'#cbd5e1' }}>📷</div> )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ color: item.nome.includes('⚠️') ? '#ef4444' : '#0f172a', fontSize: '0.95rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {item.nome}
                                  {ehKitPai && <span style={{background: '#0f172a', color: '#fde68a', fontSize: '9px', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', border: '1px solid #c5a059'}}>📦 CONJUNTO / KIT</span>}
                                  {ehSubPeca && <span style={{background: '#fef3c7', color: '#b48a3c', fontSize: '9px', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', border: '1px solid #fde68a'}}>🧩 PEÇA DO KIT</span>}
                                  {isDeco && <span style={{background: '#b45309', color: '#fff', fontSize: '9px', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.5px'}}>✨ DECORAÇÃO</span>}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                  CÓD: {item.codigo || 'S/N'} 
                                  {item.localizacao ? ` • 📍 ${item.localizacao}` : ''}
                              </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.85rem' }}>{item.categoria || '-'}</td>
                      <td><strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>R$ {valorAluguelFormatado}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: (estaTotalmenteAlugado || tudoQuebrado || (qtdBase===0 && !isDeco)) ? '#94a3b8' : '#334155' }}>
                                {disponivelTotal} <span style={{fontSize: '0.75rem', fontWeight: 'normal'}}>{isDeco ? 'kit' : 'un'}</span>
                            </strong>
                            {estoqueBaixo && <span style={{fontSize: '9px', color: '#ea580c', background: '#ffedd5', padding: '2px 6px', borderRadius: '4px', marginTop: '4px'}}>Baixo</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge" style={{ backgroundColor: bgPill, color: colorPill, border: `1px solid ${borderPill}` }}>{labelPill}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions-container">
                            <button className="action-btn" onClick={(e) => { e.stopPropagation(); setItemParaPedido(item); setPedidoSelecionadoId(''); setModalAddPedidoAberto(true); }} title="Inserir direto num Pedido">🛒</button>
                            <button className="action-btn edit" onClick={(e) => { e.stopPropagation(); irParaCadastro(item); }} title="Editar">✏️</button>
                            <button className="action-btn duplicate" onClick={(e) => { e.stopPropagation(); duplicarItem(item); }} title="Duplicar Item">📋</button>
                            <button className="action-btn delete" onClick={async (e) => { e.stopPropagation(); if(window.confirm("Excluir permanentemente do acervo?")) { await registrarLog("EXCLUSÃO DE ACERVO", `Apagou permanentemente o item "${item.nome}" do estoque.`); deleteDoc(doc(db, "estoque", item.id)).then(carregarDados); }}} title="Excluir">🗑️</button>
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

      {modalManutencao && (
        <div className="modal-overlay-blur">
          <div className="modal-maintenance-card">
            <div className="modal-maintenance-header">
              <h3>🛠️ Enviar para Manutenção</h3>
              <button className="close-btn-modern" onClick={() => setModalManutencao(false)}>×</button>
            </div>
            <div className="modal-maintenance-body">
              <p>Quantas unidades de <strong>{itemParaManutencao?.nome}</strong> precisam de reparos?</p>
              <div className="input-group-modern">
                <label>QUANTIDADE (MÁX: {itemParaManutencao?.quantidade})</label>
                <input 
                  type="number" value={qtdMaint} onChange={(e) => setQtdMaint(e.target.value)}
                  min="0" max={itemParaManutencao?.quantidade} className="modal-input-highlight"
                />
                <span className="helper-text">Dica: Digite 0 para devolver todas as peças ao estoque livre.</span>
              </div>
            </div>
            <div className="modal-maintenance-footer">
              <button className="btn-modal-cancel" onClick={() => setModalManutencao(false)}>Cancelar</button>
              <button className="btn-modal-save" onClick={salvarManutencao}>Atualizar</button>
            </div>
          </div>
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