import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
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
  const [totais, setTotais] = useState({ pendente: 0, urgente: 0, realizado: 0 });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState('');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('Data'); 
  const [loading, setLoading] = useState(true);

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
 
      const hoje = new Date();
      hoje.setHours(0,0,0,0);

      lista.forEach(item => {
        const qtd = Number(item.quantidade) || 1;
        const valorUnit = Number(item.valorEstimado) || 0;
        const subtotal = qtd * valorUnit;

        if (item.status === "comprado" || item.status === "chegou") {
          r += subtotal;
        } else {
          p += subtotal;
          if (item.prazo && item.vinculoTipo === 'pedido') {
            const dataPrazo = new Date(item.prazo + 'T00:00:00');
            const diffTime = dataPrazo.getTime() - hoje.getTime();
            const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDias <= 5) u++; 
          }
        }
      });

      setTotais({ pendente: p, urgente: u, realizado: r });
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

  const handleStatusChange = async (item, novoStatus) => {
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

        if (item.status === 'chegou' && !snapshotEstoque.empty) {
          const docExistente = snapshotEstoque.docs[0];
          const qtdAtual = Number(docExistente.data().quantidade) || 0;
          const qtdRemover = item.formato === 'kit' && item.quantidadePecasKit ? item.quantidadePecasKit : qtdComprada;
          const novaQtd = Math.max(0, qtdAtual - qtdRemover); 
          
          await updateDoc(doc(db, "estoque", docExistente.id), {
            quantidade: novaQtd,
            atualizadoEm: new Date().toISOString()
          });
        }
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);

        await registrarLog("COMPRA PENDENTE", `Voltou o status de "${item.nome}" para Pendente (Falta Comprar).`);
      }
      else if (novoStatus === 'comprado') {
        updatePayload.dataCompra = new Date().toISOString();
        const itemRef = doc(db, "lista_compras", item.id);
        await updateDoc(itemRef, updatePayload);
        
        await registrarLog("COMPRA EFETUADA", `Marcou o item "${item.nome}" como Comprado (A Caminho).`);
        alert(`🛒 Maravilha! A compra foi registrada. O sistema vai rastrear a entrega a partir de hoje.`);
      }

    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro na operação.");
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

  let itensFiltrados = itens.filter(item => {
    const termo = busca.toLowerCase();
    const matchBusca = (item.nome || '').toLowerCase().includes(termo) || (item.vinculo || '').toLowerCase().includes(termo);
    const matchStatus = filtroStatus === "todos" ? true : item.status === filtroStatus;
    return matchBusca && matchStatus;
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
    const busca = buscaDecoracao.toLowerCase().trim();
    if (!busca) return true;
    return (item.decoracaoNome || '').toLowerCase().includes(busca) ||
           (item.pecaNome || '').toLowerCase().includes(busca);
  });

  return (
    <div className="clientes-container fade-in">
      
      {/* HERO CABEÇALHO IDÊNTICO AO GESTÃO DE CLIENTES */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            🛒
          </div>
          <div className="welcome-text">
            <h1>Lista de Compras & Aquisições</h1>
            <p>Gerencie aquisições vinculadas aos pedidos, fornecedores, e peças faltantes em decorações.</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-primary-celebre" onClick={() => navigate("/compras/nova")}>
            + ADICIONAR ITEM
          </button>
        </div>
      </div>

      {/* TABS DE SELEÇÃO: LISTA GERAL vs PEÇAS FALTANTES EM DECORAÇÕES */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button 
          type="button"
          onClick={() => setAbaAtiva('lista')}
          style={{
            background: abaAtiva === 'lista' ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : '#ffffff',
            color: abaAtiva === 'lista' ? '#ffffff' : '#475569',
            border: abaAtiva === 'lista' ? '1.5px solid #c5a059' : '1.5px solid #cbd5e1',
            padding: '12px 24px',
            borderRadius: '20px',
            fontWeight: '850',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: abaAtiva === 'lista' ? '0 6px 20px rgba(15, 23, 42, 0.25)' : '0 2px 8px rgba(0,0,0,0.03)',
            transition: 'all 0.25s ease'
          }}
        >
          <span>🛒 Minha Lista de Compras</span>
          <span style={{
            background: abaAtiva === 'lista' ? '#c5a059' : '#f1f5f9',
            color: abaAtiva === 'lista' ? '#ffffff' : '#0f172a',
            borderRadius: '12px',
            padding: '2px 9px',
            fontSize: '0.78rem',
            fontWeight: '900'
          }}>
            {itens.length}
          </span>
        </button>

        <button 
          type="button"
          onClick={() => setAbaAtiva('decoracoes')}
          style={{
            background: abaAtiva === 'decoracoes' ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : '#ffffff',
            color: abaAtiva === 'decoracoes' ? '#ffffff' : '#475569',
            border: abaAtiva === 'decoracoes' ? '1.5px solid #c5a059' : '1.5px solid #cbd5e1',
            padding: '12px 24px',
            borderRadius: '20px',
            fontWeight: '850',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: abaAtiva === 'decoracoes' ? '0 6px 20px rgba(197, 160, 89, 0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
            transition: 'all 0.25s ease'
          }}
        >
          <span>✨ Peças Faltantes p/ Decorações</span>
          {faltantesDecoracao.length > 0 && (
            <span style={{ 
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
              color: '#ffffff', 
              borderRadius: '12px', 
              padding: '2px 9px', 
              fontSize: '0.78rem', 
              fontWeight: '900',
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)' 
            }}>
              {faltantesDecoracao.length}
            </span>
          )}
        </button>
      </div>

      {/* CARDS DE DASHBOARD 4 COLUNAS */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro card-purple">
          <div className="stat-icon-wrapper icon-purple">
            🛒
          </div>
          <div className="stat-content">
            <span className="stat-title">TOTAL NA LISTA</span>
            <strong className="stat-number">{itens.length}</strong>
            <small className="stat-desc">Itens cadastrados</small>
          </div>
        </div>

        <div className="stat-card-pro card-amber">
          <div className="stat-icon-wrapper icon-amber">
            📂
          </div>
          <div className="stat-content">
            <span className="stat-title">ORÇAMENTO PENDENTE</span>
            <strong className="stat-number">R$ {totais.pendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Estimado p/ compras</small>
          </div>
        </div>

        <div className="stat-card-pro card-red">
          <div className="stat-icon-wrapper icon-red">
            ✨
          </div>
          <div className="stat-content">
            <span className="stat-title">FALTANTES EM DECORAÇÃO</span>
            <strong className="stat-number">{faltantesDecoracao.length}</strong>
            <small className="stat-desc">Itens a adquirir</small>
          </div>
        </div>

        <div className="stat-card-pro card-green">
          <div className="stat-icon-wrapper icon-green">
            ✅
          </div>
          <div className="stat-content">
            <span className="stat-title">REALIZADO (MÊS)</span>
            <strong className="stat-number">R$ {totais.realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Investimento aprovado</small>
          </div>
        </div>
      </div>

      {/* SEBA 1: TABELA MINHA LISTA DE COMPRAS */}
      {abaAtiva === 'lista' ? (
        <div className="table-card-container">
          <div className="table-filter-bar">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Buscar por item ou pedido..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>

            <button className="btn-secondary-celebre" onClick={alternarOrdem} title="Mudar Ordem">
                {ordemAlfabetica === 'A-Z' ? '⬇️ A - Z' : ordemAlfabetica === 'Z-A' ? '⬆️ Z - A' : '📅 Recentes'}
            </button>
            
            <div className="filter-select-container">
              <select className="filter-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="todos">📊 Status: Todos</option>
                <option value="pendente">⏳ Falta Comprar</option>
                <option value="comprado">🚚 A Caminho</option>
                <option value="chegou">📦 No Acervo</option>
              </select>
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="pro-table">
              <thead>
                <tr>
                  <th>ITEM & VÍNCULO</th>
                  <th>QTD.</th>
                  <th>VALOR TOTAL</th>
                  <th>STATUS</th>
                  <th>LOGÍSTICA</th>
                  <th style={{ textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{textAlign: "center", padding: "40px"}}>Carregando lista...</td></tr>
                ) : itensFiltrados.length === 0 ? (
                  <tr><td colSpan="6" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum item encontrado.</td></tr>
                ) : (
                  itensFiltrados.map((item) => {
                    const subtotal = (Number(item.quantidade) || 1) * (Number(item.valorEstimado) || 0);
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
                            labelPrazo = '📍 Local:';
                            dataExibicao = 'Compra Presencial';
                            alertaClasse = 'alerta-seguro';
                            alertaTexto = '⚡ Na Cidade';
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
                            labelPrazo = '⏳ Prazo:';
                            dataExibicao = 'Livre';
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
                        dataExibicao = isPresencial ? 'Comprado na Loja' : 'Entregue';
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
                        className={ehConcluido ? 'linha-comprado' : ''}
                        style={{
                          opacity: ehConcluido ? 0.45 : 1,
                          background: ehConcluido ? 'rgba(248, 250, 252, 0.75)' : undefined,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <td>
                          <span className="nome-produto" style={{ textDecoration: ehConcluido ? 'line-through' : 'none', color: ehConcluido ? '#64748b' : undefined }}>
                            {item.nome} {item.formato === 'kit' && <span className="tag-kit-gold">(KIT)</span>}
                          </span>
                          <div className="vinculo-tag" style={{ marginTop: '4px', opacity: ehConcluido ? 0.7 : 1 }}>
                            {isPedido ? '🔗' : '📦'} {item.vinculo || "Estoque Geral"}
                          </div>
                        </td>
                        
                        <td data-label="Quantidade">
                            <strong style={{fontSize: '15px', color: '#0f172a'}}>{item.quantidade}x</strong>
                        </td>
                        
                        <td data-label="Valor Total">
                            <div className="preco-real">
                              R$ {subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </div>
                            <small style={{fontSize: '10px', color: '#94a3b8', display: 'block'}}>
                               R$ {Number(item.valorEstimado).toFixed(2)} un.
                            </small>
                        </td>
                        
                        <td data-label="Status Atual">
                          <span className={`badge ${item.status}`}>
                            {item.status === 'pendente' && 'Pendente'}
                            {item.status === 'comprado' && 'A Caminho'}
                            {item.status === 'chegou' && 'No Acervo'}
                          </span>
                        </td>

                        <td data-label="Logística">
                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', textAlign: 'right'}}>
                            <span className="prazo-badge" style={{background: isPedido ? '#f0fdf4' : '#f8fafc', border: isPedido ? '1px solid #bbf7d0' : '1px solid #e2e8f0', color: isPedido ? '#166534' : '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800'}}>
                              {dataExibicao}
                            </span>
                            {infoExtraRastreio && (
                                <span style={{ fontSize: '9px', color: '#0f172a', fontWeight: '800', background: '#fffbeb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fcd34d'}}>
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

                        <td>
                          <div className="table-actions-container">
                            {item.status === 'pendente' && (
                               <button 
                                 className="btn-acao-status comprar" 
                                 onClick={() => isPresencial ? handleStatusChange(item, 'chegou') : handleStatusChange(item, 'comprado')}
                                 title={isPresencial ? "Compra presencial (Já está com você)" : "Marcar como comprado via frete"}
                               >
                                 🛒 {isPresencial ? 'Comprado (Já Comigo)' : 'Comprado'}
                               </button>
                            )}
                            
                            {item.status === 'comprado' && (
                               <>
                                 <button className="btn-acao-status desfazer" onClick={() => handleStatusChange(item, 'pendente')} title="Voltar para Pendente">
                                   ↩ Pendente
                                 </button>
                                 <button className="btn-acao-status chegou" onClick={() => handleStatusChange(item, 'chegou')}>
                                   📦 Chegou
                                 </button>
                               </>
                            )}

                            {item.status === 'chegou' && (
                              item.estoqueSomado ? (
                                <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  ✓ Estoque Somado (+{item.quantidade || 1} un)
                                </span>
                              ) : (item.isItemExistente || item.vinculoTipo === 'decoracao' || estoqueExistenteNomes.has((item.nome || '').toLowerCase().trim())) ? (
                                <button 
                                  type="button"
                                  onClick={() => somarManualAoEstoque(item)}
                                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)' }}
                                  title="Clique para somar a quantidade comprada ao acervo existente"
                                >
                                  ➕ Somar +{item.quantidade || 1} un ao Estoque
                                </button>
                              ) : item.categoria !== "material" ? (
                                <button 
                                  className="btn-cadastrar-acervo" 
                                  onClick={() => navigate('/cadastro-estoque', { state: { dadosCompra: item } })}
                                  title="Cadastrar detalhes da peça inédita no Acervo"
                                >
                                  ➕ Cadastrar
                                </button>
                              ) : (
                                <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem' }}>
                                  📦 Material Baixado
                                </span>
                              )
                            )}

                            <button className="action-btn edit" onClick={() => navigate(`/compras/editar/${item.id}`)} title="Editar">✏️</button>
                            <button className="action-btn delete" onClick={() => handleExcluir(item.id, item.nome)} title="Excluir">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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

          <div className="table-responsive-wrapper">
            <table className="pro-table">
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
                  <tr><td colSpan="6" style={{textAlign: "center", padding: "40px"}}>Cruzando acervo com decorações...</td></tr>
                ) : faltantesFiltradosDecoracao.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{textAlign: "center", padding: "50px 20px"}}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '40px' }}>🎉</span>
                        <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>Tudo completo no seu acervo!</strong>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Todas as decorações completas possuem peças suficientes no estoque.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  faltantesFiltradosDecoracao.map((item) => (
                    <tr key={item.idUnico}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {item.decoracaoFoto ? (
                            <img src={item.decoracaoFoto} alt={item.decoracaoNome} style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                          ) : (
                            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>✨</div>
                          )}
                          <div>
                            <strong style={{ fontSize: '0.92rem', color: '#0f172a', display: 'block' }}>
                              {item.decoracaoNome}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                              Pacote Completo
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {item.pecaFoto && (
                            <img src={item.pecaFoto} alt={item.pecaNome} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
                          )}
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                              {item.pecaNome}
                            </strong>
                            {item.valorEstimado > 0 && (
                              <small style={{ display: 'block', color: '#c5a059', fontWeight: '800', fontSize: '0.75rem' }}>
                                Ref: R$ {item.valorEstimado.toFixed(2).replace('.', ',')} un.
                              </small>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', color: '#0f172a' }}>
                          {item.qtdNoKit}x
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: item.qtdNoEstoque > 0 ? '#f0fdf4' : '#fff1f2', color: item.qtdNoEstoque > 0 ? '#166534' : '#991b1b', border: item.qtdNoEstoque > 0 ? '1px solid #bbf7d0' : '1px solid #fecdd3', padding: '4px 10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem' }}>
                          {item.qtdNoEstoque}x
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a', padding: '6px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.88rem', boxShadow: '0 2px 6px rgba(245,158,11,0.15)' }}>
                          +{item.faltam} un
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {item.jaNaLista ? (
                          <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            ✓ Na Lista de Compras
                          </span>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => adicionarItemDecoracaoALista(item)}
                            style={{ 
                              background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', 
                              color: '#ffffff', 
                              border: 'none', 
                              padding: '9px 16px', 
                              borderRadius: '10px', 
                              fontWeight: '800', 
                              fontSize: '0.8rem', 
                              cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)',
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            🛒 + Enviar p/ Lista de Compras
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compras;