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
          if (userData.plano === 'pago' || userData.statusPagamentoVulso === 'pago' || userData.statusAssinatura === 'ativa' || userData.assinaturaAtiva === true) {
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
              loc.dataRetirada === dataFiltro && 
              loc.status !== 'cancelado' && 
              loc.status !== 'finalizado'
          );
          pedidosNessaData.forEach(pedido => {
              if (pedido.itens && Array.isArray(pedido.itens)) {
                  const itemEncontrado = pedido.itens.find(i => i.id === item.id);
                  if (itemEncontrado) alugadosNaData += Number(itemEncontrado.qtd || 1);
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
      const doc = new jsPDF();
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      
      let tituloRelatorio = "Lista de Verificação de Estoque";
      if (localizacaoFiltro) tituloRelatorio += ` - ${localizacaoFiltro.toUpperCase()}`;
      else if (categoriaFiltro) tituloRelatorio += ` - Categoria: ${categoriaFiltro}`;
      
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); 
      doc.text(tituloRelatorio, 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${dataHoje} | Peças Listadas: ${itensFiltrados.length}`, 14, 30);

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

      autoTable(doc, {
          head: colunas,
          body: linhas,
          startY: 38,
          theme: 'grid', 
          headStyles: { fillColor: [15, 23, 42] },
          styles: { fontSize: 9 }
      });

      doc.save(`Lista_Estoque_${localizacaoFiltro || 'Geral'}.pdf`);
      
      await registrarLog("EXPORTAÇÃO DE INVENTÁRIO", "Fez o download da lista de verificação de estoque em PDF.");
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
    <div className="estoque-premium" onClick={() => setMenuAberto(null)}>
      <div className="header-top">
        <div className="titulo-bloco">
          <h1>Gestão de Acervo e Estoque</h1>
          <p>Controle logístico, financeiro e catálogo online. <strong style={{color: totalItens >= limiteEstoque ? '#ef4444' : '#10b981'}}>(Limite: {totalItens.toLocaleString('pt-BR')} / {limiteEstoque.toLocaleString('pt-BR')})</strong></p>
        </div>
        <div className="acoes-top" style={{ display: 'flex', gap: '10px' }}>
         
          <button 
            onClick={corrigirNomesDuplicados} 
            style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={limpandoNomes}
            title="Adiciona 'KIT' nos pacotes e puxa as características das filhas"
          >
            {limpandoNomes ? '⏳ Ajustando...' : '🧹 Ajustar Nomes (Kits e Peças)'}
          </button>

          <button 
            className="btn-dark-blue" 
            onClick={imprimirListaFiltrada} 
            style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }}
          >
            🖨️ Imprimir Lista
          </button>
          
          <button 
            className="btn-dark-blue" 
            onClick={() => irParaCadastro()}
            style={{ opacity: totalItens >= limiteEstoque ? 0.7 : 1 }}
          >
            + Novo Item
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="card-stat"><span className="label-stat">TOTAL DE ITENS</span><div className="value-stat">{totalItens}</div><div className="icon-stat">📦</div></div>
        <div className="card-stat"><span className="label-stat">VALOR DO ACERVO</span><div className="value-stat text-accent">R$ {valorAcervo.toLocaleString('pt-BR')}</div><div className="icon-stat">📊</div></div>
        <div className="card-stat"><span className="label-stat">EM MANUTENÇÃO</span><div className="value-stat text-orange">{emManutencaoTotal}</div><div className="icon-stat">🛠️</div></div>
        <div className="card-stat"><span className="label-stat">VISÍVEL NO CATÁLOGO</span><div className="value-stat text-green">{percentualVisivel}%</div><div className="icon-stat">👁️</div></div>
      </div>

      <div className="filtros-inteligentes-container">
          
          <div className="filtro-grupo barra-pesquisa">
              <span className="filtro-icone">🔍</span>
              <input type="text" placeholder="Buscar por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <div className="filtro-grupo">
              <span className="filtro-label">ORDEM:</span>
              <button 
                  onClick={() => setOrdemAlfabetica(prev => prev === 'A-Z' ? 'Z-A' : 'A-Z')}
                  style={{ 
                      height: '42px', width: '100%', background: '#fff', 
                      border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', 
                      fontSize: '13px', fontWeight: 'bold', color: '#475569', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={e => {e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a';}}
                  onMouseLeave={e => {e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569';}}
                  title="Alterar Ordem Alfabética"
              >
                  {ordemAlfabetica === 'A-Z' ? '⬇️ A - Z' : '⬆️ Z - A'}
              </button>
          </div>

          <div className="filtro-grupo barra-select">
              <span className="filtro-label">📂 CATEGORIA:</span>
              <select className="filtro-select" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
                  <option value="">Todas as Categorias</option>
                  {categoriasUnicas.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                  ))}
              </select>
          </div>

          <div className="filtro-grupo barra-select">
              <span className="filtro-label">📍 LOCAL:</span>
              <select className="filtro-select" value={localizacaoFiltro} onChange={e => setLocalizacaoFiltro(e.target.value)}>
                  <option value="">Todo o Galpão</option>
                  {localizacoesUnicas.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                  ))}
              </select>
          </div>

          <div className="filtro-grupo barra-select">
              <span className="filtro-label">🚦 STATUS:</span>
              <select className="filtro-select" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                  <option value="">Todos (Livres e Alugados)</option>
                  <option value="disponivel">✅ Somente Disponíveis</option>
                  <option value="manutencao">🛠️ Somente em Manutenção</option>
                  {dataFiltro && <option value="indisponivel">🚫 Somente Alugados / Esgotados</option>}
              </select>
          </div>
          
          <div className="filtro-grupo seletor-data">
              <span className="filtro-label">📅 VER NO DIA:</span>
              <div className="data-input-wrapper">
                  <input type="date" value={dataFiltro} onChange={e => {
                      setDataFiltro(e.target.value);
                      if (!e.target.value && statusFiltro === 'indisponivel') setStatusFiltro('');
                  }} />
                  {dataFiltro && <button className="btn-limpar-data" onClick={limparFiltroData} title="Limpar Data">✕</button>}
              </div>
          </div>
      </div>

      {loading ? (
          <div style={{padding: '50px', textAlign: 'center', color: '#64748b'}}>Carregando acervo...</div>
      ) : (
          <div className="table-container" style={{overflow: 'visible'}}> 
            <table className="table-pro" style={{ borderSpacing: '0', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'visible', width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{padding: '15px 20px', textAlign: 'left'}}>PRODUTO</th>
                  <th style={{padding: '15px', textAlign: 'left'}}>CATEGORIA</th>
                  <th style={{padding: '15px', textAlign: 'left'}}>VALOR LOCAÇÃO</th>
                  <th style={{padding: '15px', textAlign: 'center'}}>{dataFiltro ? 'NO DIA' : 'ESTOQUE'}</th>
                  <th style={{padding: '15px', textAlign: 'center'}}>STATUS</th>
                  <th style={{padding: '15px', textAlign: 'right'}}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map(item => {
                  
                  const { qtdBase, disponivelTotal, estaTotalmenteAlugado, tudoQuebrado, isDeco } = calcularDisponibilidadeNaData(item);
                  let labelPill = 'DISPONÍVEL';
                  let bgPill = '#f0fdf4'; let colorPill = '#166534'; let borderPill = '#bbf7d0';

                  if (estaTotalmenteAlugado) { 
                      labelPill = 'ALUGADO';
                      bgPill = '#fef2f2'; colorPill = '#b91c1c'; borderPill = '#fecaca';
                  } else if (tudoQuebrado) { 
                      labelPill = 'EM REPARO';
                      bgPill = '#fffbeb'; colorPill = '#b45309'; borderPill = '#fde68a';
                  } else if (qtdBase === 0 && !isDeco) {
                      labelPill = 'S/ ESTOQUE';
                      bgPill = '#f8fafc'; colorPill = '#64748b'; borderPill = '#e2e8f0';
                  }

                  const estoqueBaixo = !dataFiltro && item.configuracao?.alertaEstoque === 'Avisar' && qtdBase > 0 && disponivelTotal <= item.estoqueMinimo;
                  const valorAluguelFormatado = item.financeiro?.valorAluguel ? Number(item.financeiro.valorAluguel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                  const posImg = item.posicoesFoco?.[0];
                  const isMenuOpen = menuAberto === item.id;
                  
                  const ehKitPai = item.especificacoes?.isKitPai || item.especificacoes?.isKit || (item.especificacoes?.pecasKit && item.especificacoes?.pecasKit.length > 0);
                  const ehSubPeca = item.especificacoes?.isSubPeca || (item.codigo && /-P\d+$/.test(item.codigo) && !ehKitPai);

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: estaTotalmenteAlugado ? 0.6 : 1 }}>
                      
                      <td style={{ padding: '15px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ width: '45px', height: '45px', backgroundColor: '#f8fafc', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                              {item.foto ? (
                                <img src={item.foto} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', objectPosition: posImg ? `${posImg.x}% ${posImg.y}%` : '50% 50%' }} onClick={(e) => { e.stopPropagation(); setImagemAmpliada(item.foto); }} title="Ampliar"/>
                              ) : ( <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', color:'#cbd5e1' }}>📷</div> )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                              
                              <strong style={{ color: item.nome.includes('⚠️') ? '#ef4444' : '#0f172a', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {item.nome}
                                  {ehKitPai && <span style={{background: '#1d4ed8', color: '#fff', fontSize: '9px', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.5px'}}>📦 KIT PAI</span>}
                                  {ehSubPeca && <span style={{background: '#f1f5f9', color: '#475569', fontSize: '9px', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.5px', border: '1px solid #cbd5e1'}}>🧩 PEÇA FILHA</span>}
                                  {isDeco && <span style={{background: '#b45309', color: '#fff', fontSize: '9px', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.5px'}}>✨ DECORAÇÃO</span>}
                              </strong>
                              
                              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                  CÓD: {item.codigo || 'S/N'} 
                                  {item.localizacao ? ` • 📍 ${item.localizacao}` : ''}
                              </span>
                          </div>
                        </div>
                      </td>
                      
                      <td style={{ color: '#475569', fontSize: '13px', padding: '15px' }}>
                        {item.categoria || '-'}
                      </td>
                      
                      <td style={{ padding: '15px' }}>
                        <strong style={{ color: '#0f172a', fontSize: '14px' }}>R$ {valorAluguelFormatado}</strong>
                      </td>
                      
                      <td style={{ textAlign: 'center', padding: '15px' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                            <strong style={{ fontSize: '14px', color: (estaTotalmenteAlugado || tudoQuebrado || (qtdBase===0 && !isDeco)) ? '#94a3b8' : '#334155' }}>
                                {disponivelTotal} <span style={{fontSize: '12px', fontWeight: 'normal'}}>{isDeco ? 'kit' : 'un'}</span>
                            </strong>
                            {estoqueBaixo && <span style={{fontSize: '10px', color: '#ea580c', background: '#ffedd5', padding: '2px 6px', borderRadius: '4px', marginTop: '4px'}}>Baixo</span>}
                        </div>
                      </td>
                      
                      <td style={{ textAlign: 'center', padding: '15px' }}>
                        <span style={{ backgroundColor: bgPill, color: colorPill, border: `1px solid ${borderPill}`, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                            {labelPill}
                        </span>
                      </td>
              
                      <td style={{ textAlign: 'right', padding: '15px', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); setItemParaPedido(item); setPedidoSelecionadoId(''); setModalAddPedidoAberto(true); }}
                                style={{ background: '#fff', color: '#10b981', border: '1px solid #10b981', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: '0.2s' }}
                                title="Inserir direto num Pedido"
                                onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#10b981'; }}
                            >
                                🛒
                            </button>

                            <div style={{ position: 'relative' }}>
                                <button 
                                    onClick={(e) => { 
                                       e.stopPropagation();
                                       setMenuAberto(isMenuOpen ? null : item.id); 
                                    }}
                                    style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', width: '32px', height: '32px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                >
                                    ⋮
                                </button>
                                
                                {isMenuOpen && (
                                    <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '5px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 99999, minWidth: '150px', display: 'flex', flexDirection: 'column', padding: '5px' }}>
                                        <button onClick={(e) => { e.stopPropagation(); irParaCadastro(item); }} style={{ padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#334155', textAlign: 'left', display: 'flex', gap: '8px' }} onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>✏️ Editar</button>
                                        <button onClick={(e) => { e.stopPropagation(); duplicarItem(item); }} style={{ padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#334155', textAlign: 'left', display: 'flex', gap: '8px' }} onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>📋 Duplicar</button>
                                        <button onClick={(e) => { e.stopPropagation(); abrirModalManutencao(item); setMenuAberto(null); }} style={{ padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#334155', textAlign: 'left', display: 'flex', gap: '8px' }} onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>🛠️ Manutenção</button>
                                        <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>
                                        
                                        {/* 🔥 AÇÃO COM ESPIÃO NÍVEL MÁXIMO 🔥 */}
                                        <button 
                                          onClick={async (e) => { 
                                            e.stopPropagation();
                                            if(window.confirm("Excluir permanentemente do acervo?")) {
                                              await registrarLog("EXCLUSÃO DE ACERVO", `Apagou permanentemente o item "${item.nome}" do estoque.`);
                                              deleteDoc(doc(db, "estoque", item.id)).then(carregarDados); 
                                            }
                                          }} 
                                          style={{ padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#ef4444', textAlign: 'left', fontWeight: 'bold', display: 'flex', gap: '8px' }} 
                                          onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} 
                                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                                        >
                                          🗑️ Excluir
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {itensFiltrados.length === 0 && (
                    <tr>
                        <td colSpan="6" style={{textAlign:'center', padding:'40px', color:'#64748b'}}>
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