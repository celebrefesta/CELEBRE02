import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, deleteDoc, updateDoc, doc, where, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import "./Financeiro.css";

const CustomTooltipCat = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div style={{ background: '#0f172a', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
        <div>{data.name}</div>
        <div style={{ color: data.payload.color || '#38bdf8' }}>
          R$ {Number(data.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>
    );
  }
  return null;
};

const Financeiro = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // Obter mês e ano atuais
  const dataHoje = new Date();
  const mesAtualNum = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const anoAtualNum = String(dataHoje.getFullYear());

  const [abaAtiva, setAbaAtiva] = useState('lancamentos'); // 'lancamentos' | 'comprovantes'
  const [transacoes, setTransacoes] = useState([]);
  const [itensCompras, setItensCompras] = useState([]);
  const [comprovantesExtras, setComprovantesExtras] = useState([]);
  const [totalAReceber, setTotalAReceber] = useState(0);

  // 🗓️ FILTRO PERSONALIZADO DE MÊS E ANO
  const [filtroMes, setFiltroMes] = useState(mesAtualNum);
  const [filtroAno, setFiltroAno] = useState(anoAtualNum);

  // Filtros da Galeria de Comprovantes e Lançamentos
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'entrada' | 'saida' | 'pendente'
  const [buscaComprovante, setBuscaComprovante] = useState('');
  const [filtroForma, setFiltroForma] = useState('todas');
  const [comprovanteModal, setComprovanteModal] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO VINCULADO À EMPRESA)
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
      console.error("Erro ao gravar log da auditoria financeira:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    // 1. 🔥 PUXA LANÇAMENTOS DE CAIXA MANUAIS (financeiro_lancamentos)
    const q = query(collection(db, "financeiro_lancamentos"), where("userId", "==", tenantId));
    const unsubLancamentos = onSnapshot(q, (snap) => {
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransacoes(lista);
      setLoading(false);
    });

    // 2. 🛒 PUXA REGISTROS DE COMPRAS AUTOMÁTICAS (lista_compras)
    const qCompras = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
    const unsubCompras = onSnapshot(qCompras, (snap) => {
      let listaC = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItensCompras(listaC);
    });

    // 3. 📦 PUXA COMPROVANTES E CALCULA TOTAL A RECEBER DAS LOCAÇÕES (locacoes)
    const carregarDadosLocacoes = async () => {
      try {
        const qLoc = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snapLoc = await getDocs(qLoc);
        const locs = snapLoc.docs.map(d => ({ id: d.id, ...d.data() }));

        const locsComComprovante = locs.filter(l => l.ultimoComprovanteUrl);
        setComprovantesExtras(locsComComprovante);

        // Saldo pendente a receber de pedidos abertos
        let pendente = 0;
        locs.forEach(l => {
          const st = (l.status || '').toLowerCase();
          if (st !== 'cancelada' && st !== 'cancelado') {
            const tot = Number(l.valorTotal) || Number(l.total) || 0;
            const pag = Number(l.valorPago) || 0;
            const rest = Math.max(0, tot - pag);
            pendente += rest;
          }
        });
        setTotalAReceber(pendente);
      } catch (err) {
        console.error("Erro ao buscar comprovantes de locações:", err);
      }
    };

    carregarDadosLocacoes();

    return () => {
      unsubLancamentos();
      unsubCompras();
    };
  }, [usuarioLogado, navigate, tenantId]);

  // 🛒 FORMATAÇÃO DOS ITENS DE COMPRA PARA ENTRAR NO FLUXO DE CAIXA COMO SAÍDA (GASTO)
  const comprasFormatadas = itensCompras.map(c => {
    const isPago = c.status === 'comprado' || c.status === 'chegou';
    
    // Prioriza o valor real pago, se informado; caso contrário, usa o valor estimado * quantidade
    const valUnit = (c.valorPago !== null && c.valorPago !== undefined && Number(c.valorPago) > 0)
      ? Number(c.valorPago)
      : Number(c.valorEstimado || 0);
    const qtd = Number(c.quantidade) || 1;
    const valorTotal = valUnit * qtd;

    // Extração de data segura
    let dataIso = c.dataCompra || c.dataChegada || c.criadoEmIso;
    let dataStr = new Date().toISOString().split('T')[0];
    if (dataIso) {
      dataStr = dataIso.split('T')[0];
    } else if (c.createdAt?.toDate) {
      dataStr = c.createdAt.toDate().toISOString().split('T')[0];
    }

    return {
      id: `compra_${c.id}`,
      origemDocId: c.id,
      isOrigemCompras: true,
      tipo: 'saida',
      categoria: c.categoria === 'material' ? 'Material de Consumo' : 'Compra para Estoque',
      descricao: `📦 Compra: ${c.nome}${c.vinculo ? ` (${c.vinculo})` : ''}`,
      formaPagto: c.formaPagto || 'Pix',
      valor: valorTotal,
      data: dataStr,
      status: isPago ? 'pago' : 'pendente',
      comprovanteUrl: c.comprovanteUrl || null
    };
  });

  // UNIFICAÇÃO DE LANÇAMENTOS MANUAIS + COMPRAS AUTOMÁTICAS
  const todasTransacoesUnificadas = [...transacoes, ...comprasFormatadas];

  // Ordenação por data (da mais recente para a mais antiga)
  todasTransacoesUnificadas.sort((a, b) => {
    const dataA = a.data ? new Date(a.data + "T12:00").getTime() : 0;
    const dataB = b.data ? new Date(b.data + "T12:00").getTime() : 0;
    return dataB - dataA;
  });

  // Lista unificada de comprovantes recebidos
  const todosComprovantes = [
    ...todasTransacoesUnificadas.filter(t => t.comprovanteUrl).map(t => ({
      id: t.id,
      titulo: t.descricao || 'Lançamento de Caixa',
      valor: t.valor,
      data: t.data,
      formaPagto: t.formaPagto || 'Pix',
      comprovanteUrl: t.comprovanteUrl,
      comprovanteNome: t.comprovanteNome || 'Comprovante.jpg',
      origem: t.isOrigemCompras ? 'Módulo Compras' : 'Caixa'
    })),
    ...comprovantesExtras.map(l => ({
      id: `loc_${l.id}`,
      titulo: `Ref. Pedido #${l.numeroPedido || (l.id ? l.id.substring(0,6).toUpperCase() : 'S/N')} - ${l.clienteNome || 'Cliente'}`,
      valor: l.valorPago || l.valorTotal || 0,
      data: l.dataCriacao || l.dataRetirada || new Date().toISOString().split('T')[0],
      formaPagto: 'Locação',
      comprovanteUrl: l.ultimoComprovanteUrl,
      comprovanteNome: l.ultimoComprovanteNome || 'Comprovante_Pedido.jpg',
      origem: 'Pedido Locação'
    }))
  ];

  // Remove duplicados de URL
  const comprovantesUnicos = todosComprovantes.filter((item, index, self) =>
    index === self.findIndex(t => t.comprovanteUrl === item.comprovanteUrl)
  );

  // Filtragem da galeria de comprovantes (Mês e Ano)
  const comprovantesFiltrados = comprovantesUnicos.filter(item => {
    const termo = buscaComprovante.toLowerCase();
    const bateTexto = item.titulo.toLowerCase().includes(termo) || 
                      (item.comprovanteNome && item.comprovanteNome.toLowerCase().includes(termo)) ||
                      String(item.valor).includes(termo);
    const bateForma = filtroForma === 'todas' || item.formaPagto.toLowerCase().includes(filtroForma.toLowerCase());
    
    let matchData = true;
    if (item.data) {
      const [anoItem, mesItem] = item.data.split('-');
      if (filtroAno && anoItem !== filtroAno) matchData = false;
      if (filtroMes && mesItem !== filtroMes) matchData = false;
    }

    return bateTexto && bateForma && matchData;
  });

  // Transações filtradas para a tabela principal (Mês, Ano e Visão Gastos vs Entradas)
  const transacoesFiltradas = todasTransacoesUnificadas.filter(t => {
    const termo = busca.toLowerCase();
    const matchBusca = (t.descricao || '').toLowerCase().includes(termo) ||
                       (t.categoria || '').toLowerCase().includes(termo) ||
                       (t.formaPagto || '').toLowerCase().includes(termo) ||
                       String(t.valor || '').includes(termo);

    let matchTipo = true;
    if (filtroTipo === 'entrada') matchTipo = t.tipo === 'entrada';
    else if (filtroTipo === 'saida') matchTipo = t.tipo === 'saida';
    else if (filtroTipo === 'pendente') matchTipo = t.status === 'pendente';

    let matchData = true;
    if (t.data) {
      const [anoItem, mesItem] = t.data.split('-');
      if (filtroAno && anoItem !== filtroAno) matchData = false;
      if (filtroMes && mesItem !== filtroMes) matchData = false;
    }

    return matchBusca && matchTipo && matchData;
  });

  // Cálculos dos Cards KPI
  const totalEntradas = todasTransacoesUnificadas.filter(t => {
    if (t.tipo !== 'entrada' || t.status === 'pendente') return false;
    if (!t.data) return true;
    const [anoItem, mesItem] = t.data.split('-');
    if (filtroAno && anoItem !== filtroAno) return false;
    if (filtroMes && mesItem !== filtroMes) return false;
    return true;
  }).reduce((acc, t) => acc + Number(t.valor), 0);

  const totalSaidas = todasTransacoesUnificadas.filter(t => {
    if (t.tipo !== 'saida' || t.status === 'pendente') return false;
    if (!t.data) return true;
    const [anoItem, mesItem] = t.data.split('-');
    if (filtroAno && anoItem !== filtroAno) return false;
    if (filtroMes && mesItem !== filtroMes) return false;
    return true;
  }).reduce((acc, t) => acc + Number(t.valor), 0);

  const saldoLiquido = totalEntradas - totalSaidas;

  // 💳 RESUMO POR FORMA DE PAGAMENTO (VALORES RECEBIDOS)
  const formasResumo = transacoesFiltradas.reduce((acc, t) => {
    if (t.tipo === 'entrada' && t.status !== 'pendente') {
      const f = (t.formaPagto || 'Outros').toLowerCase();
      const val = Number(t.valor) || 0;
      if (f.includes('pix')) acc.pix += val;
      else if (f.includes('cart') || f.includes('credito') || f.includes('debito')) acc.cartao += val;
      else if (f.includes('dinheiro')) acc.dinheiro += val;
      else acc.outros += val;
    }
    return acc;
  }, { pix: 0, cartao: 0, dinheiro: 0, outros: 0 });

  // 🏷️ RÓTULO DE CATEGORIA COM ÍCONES VISUAIS
  const renderBadgeCategoria = (categoria, tipo) => {
    const catLower = (categoria || '').toLowerCase();
    const isEntrada = tipo === 'entrada';
    
    let icone = isEntrada ? '🟢' : '🔴';
    if (catLower.includes('locaç') || catLower.includes('reserva') || catLower.includes('evento')) icone = '🎉';
    else if (catLower.includes('estoque') || catLower.includes('acervo') || catLower.includes('compra')) icone = '📦';
    else if (catLower.includes('frete') || catLower.includes('logística') || catLower.includes('transporte')) icone = '🚚';
    else if (catLower.includes('fixa') || catLower.includes('aluguel') || catLower.includes('luz') || catLower.includes('internet')) icone = '🏢';
    else if (catLower.includes('equipe') || catLower.includes('fornecedor') || catLower.includes('salário')) icone = '👥';
    else if (catLower.includes('manutenç') || catLower.includes('conserto')) icone = '🛠️';
    else if (catLower.includes('imposto') || catLower.includes('taxa')) icone = '🧾';
    else if (catLower.includes('venda')) icone = '🏷️';
    else if (catLower.includes('multa') || catLower.includes('acréscimo')) icone = '⚡';

    return (
      <span className={`badge-categoria ${isEntrada ? 'entrada' : 'saida'}`}>
        <span style={{ marginRight: '4px' }}>{icone}</span>
        {categoria || (isEntrada ? 'Receita' : 'Despesa')}
      </span>
    );
  };

  // ✅ BAIXA RÁPIDA DE LANÇAMENTO PENDENTE (1 CLIQUE)
  const handleQuitarLancamento = async (transacao) => {
    try {
      if (transacao.isOrigemCompras) {
        const itemRef = doc(db, "lista_compras", transacao.origemDocId);
        await updateDoc(itemRef, {
          status: 'comprado',
          dataCompra: new Date().toISOString()
        });
        await registrarLog("QUITAÇÃO COMPRA", `Marcou a compra "${transacao.descricao}" como Efetuada.`);
        alert(`✅ Compra "${transacao.descricao}" marcada como paga com sucesso!`);
      } else {
        const itemRef = doc(db, "financeiro_lancamentos", transacao.id);
        await updateDoc(itemRef, {
          status: 'pago',
          dataPago: new Date().toISOString()
        });

        const valorFormatado = Number(transacao.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        await registrarLog("QUITAÇÃO FINANCEIRA", `Confirmou quitação do lançamento "${transacao.descricao}" no valor de ${valorFormatado}.`);
        alert(`✅ Lançamento "${transacao.descricao}" quitado com sucesso!`);
      }
    } catch (error) {
      console.error("Erro ao quitar lançamento:", error);
      alert("Erro ao dar baixa no lançamento.");
    }
  };

  const handleExcluirLancamento = async (transacao) => {
    const confirmacao = window.confirm(`⚠️ CUIDADO: Tem certeza que deseja excluir "${transacao.descricao}"? Esta ação é irreversível.`);
    if (confirmacao) {
      try {
        const valorFormatado = Number(transacao.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        if (transacao.isOrigemCompras) {
          await registrarLog("EXCLUSÃO COMPRA", `Excluiu a compra de acervo/material "${transacao.descricao}" de ${valorFormatado}.`);
          await deleteDoc(doc(db, "lista_compras", transacao.origemDocId));
        } else {
          await registrarLog("EXCLUSÃO FINANCEIRA", `Excluiu lançamento "${transacao.descricao}" de ${valorFormatado}.`);
          await deleteDoc(doc(db, "financeiro_lancamentos", transacao.id));
        }

        alert("Lançamento removido com sucesso!");
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir lançamento.");
      }
    }
  };

  const setFiltroMesPredefinido = (opcao) => {
    const d = new Date();
    if (opcao === 'atual') {
      setFiltroMes(String(d.getMonth() + 1).padStart(2, '0'));
      setFiltroAno(String(d.getFullYear()));
    } else if (opcao === 'anterior') {
      d.setMonth(d.getMonth() - 1);
      setFiltroMes(String(d.getMonth() + 1).padStart(2, '0'));
      setFiltroAno(String(d.getFullYear()));
    } else if (opcao === 'todos') {
      setFiltroMes('');
      setFiltroAno('');
    }
  };

  const handleExportarExcel = () => {
    if (transacoesFiltradas.length === 0) {
      alert("Nenhum registro para exportar.");
      return;
    }
    let csv = "Data;Tipo;Categoria;Descricao;Forma Pagamento;Valor (R$);Status\n";
    transacoesFiltradas.forEach(t => {
      const data = t.data || '';
      const tipo = t.tipo === 'entrada' ? 'Entrada (Receita)' : 'Saída (Gasto)';
      const cat = (t.categoria || '').replace(/;/g, ' ');
      const desc = (t.descricao || '').replace(/;/g, ' ');
      const forma = t.formaPagto || '';
      const valor = Number(t.valor || 0).toFixed(2).replace('.', ',');
      const status = t.status || 'pago';
      csv += `${data};${tipo};${cat};${desc};${forma};${valor};${status}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Financeiro_Celebre_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const nomesMeses = [
    { num: '01', nome: 'Janeiro' },
    { num: '02', nome: 'Fevereiro' },
    { num: '03', nome: 'Março' },
    { num: '04', nome: 'Abril' },
    { num: '05', nome: 'Maio' },
    { num: '06', nome: 'Junho' },
    { num: '07', nome: 'Julho' },
    { num: '08', nome: 'Agosto' },
    { num: '09', nome: 'Setembro' },
    { num: '10', nome: 'Outubro' },
    { num: '11', nome: 'Novembro' },
    { num: '12', nome: 'Dezembro' }
  ];

  return (
    <div className="clientes-container fade-in">
      
      {/* HERO CABEÇALHO CELEBRE */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            💰
          </div>
          <div className="welcome-text">
            <h1>Controle Financeiro & Fluxo de Caixa</h1>
            <p>Gerencie receitas, despesas de operação, saldo em caixa e auditoria de comprovantes.</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-primary-celebre" onClick={() => navigate("/financeiro/novo")}>
            + NOVO LANÇAMENTO
          </button>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO SEGMENTADAS (100% LARGURA) */}
      <div className="compras-tabs-bar">
        <button 
          type="button"
          onClick={() => setAbaAtiva('lancamentos')}
          className={`tab-btn-celebre ${abaAtiva === 'lancamentos' ? 'active' : ''}`}
        >
          <span>📊 Fluxo de Caixa / Lançamentos</span>
          <span className="tab-badge">{transacoesFiltradas.length}</span>
        </button>

        <button 
          type="button"
          onClick={() => setAbaAtiva('comprovantes')}
          className={`tab-btn-celebre ${abaAtiva === 'comprovantes' ? 'active' : ''}`}
        >
          <span>📎 Galeria de Comprovantes Anexados</span>
          {comprovantesUnicos.length > 0 && (
            <span className="tab-badge">{comprovantesUnicos.length}</span>
          )}
        </button>
      </div>

      {/* CARDS DE DASHBOARD INTERATIVOS (CLIQUE PARA FILTRAR) (GOLDEN RULE 1 & 2) */}
      <div className="clientes-stats-grid">
        <div 
          className={`stat-card-pro card-green interactive-card ${filtroTipo === 'entrada' ? 'card-active-glow' : ''}`}
          onClick={() => { setAbaAtiva('lancamentos'); setFiltroTipo('entrada'); }}
          title="Clique para filtrar apenas Entradas"
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon-wrapper icon-green">
            🟢
          </div>
          <div className="stat-content">
            <span className="stat-title">ENTRADAS (RECEBIDO)</span>
            <strong className="stat-number">R$ {totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Receitas • Clique p/ filtrar</small>
          </div>
        </div>

        <div 
          className={`stat-card-pro card-red interactive-card ${filtroTipo === 'saida' ? 'card-active-glow' : ''}`}
          onClick={() => { setAbaAtiva('lancamentos'); setFiltroTipo('saida'); }}
          title="Clique para filtrar apenas Gastos e Saídas"
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon-wrapper icon-red">
            🔴
          </div>
          <div className="stat-content">
            <span className="stat-title">GASTOS (SAÍDAS / COMPRAS)</span>
            <strong className="stat-number">R$ {totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Despesas • Clique p/ filtrar</small>
          </div>
        </div>

        <div 
          className={`stat-card-pro card-amber interactive-card ${filtroTipo === 'pendente' ? 'card-active-glow' : ''}`}
          onClick={() => { setAbaAtiva('lancamentos'); setFiltroTipo('pendente'); }}
          title="Clique para filtrar apenas Pendentes"
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon-wrapper icon-amber">
            ⏳
          </div>
          <div className="stat-content">
            <span className="stat-title">A RECEBER (LOCAÇÕES)</span>
            <strong className="stat-number">R$ {totalAReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Saldo em pedidos • Filtrar</small>
          </div>
        </div>

        <div 
          className={`stat-card-pro card-purple interactive-card ${filtroTipo === 'todos' ? 'card-active-glow' : ''}`}
          onClick={() => { setAbaAtiva('lancamentos'); setFiltroTipo('todos'); }}
          title="Clique para ver todos os registros"
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon-wrapper icon-purple">
            🏦
          </div>
          <div className="stat-content">
            <span className="stat-title">SALDO LÍQUIDO REAL</span>
            <strong className="stat-number">R$ {saldoLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">
              Est. Fim Mês: <strong style={{ color: (saldoLiquido + totalAReceber) >= 0 ? '#16a34a' : '#dc2626' }}>R$ {(saldoLiquido + totalAReceber).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </small>
          </div>
        </div>
      </div>

      {/* 💳 BARRINHA DE RESUMO POR FORMA DE PAGAMENTO */}
      <div className="fin-formas-bar">
        <div className="forma-item pix" title="Total recebido via Pix no período">
          <span className="forma-icon">⚡</span>
          <span className="forma-label">Pix:</span>
          <strong>R$ {formasResumo.pix.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
        </div>

        <div className="forma-item cartao" title="Total recebido em Cartão no período">
          <span className="forma-icon">💳</span>
          <span className="forma-label">Cartão:</span>
          <strong>R$ {formasResumo.cartao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
        </div>

        <div className="forma-item dinheiro" title="Total recebido em Dinheiro no período">
          <span className="forma-icon">💵</span>
          <span className="forma-label">Dinheiro:</span>
          <strong>R$ {formasResumo.dinheiro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
        </div>

        {formasResumo.outros > 0 && (
          <div className="forma-item outros" title="Outras formas de pagamento">
            <span className="forma-icon">🏦</span>
            <span className="forma-label">Outros:</span>
            <strong>R$ {formasResumo.outros.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
          </div>
        )}
      </div>

      {/* ABA 1: FLUXO DE CAIXA / LANÇAMENTOS */}
      {abaAtiva === 'lancamentos' && (
        <div className="table-card-container">
          
          {/* 🔥 BARRINHA DE SELEÇÃO RÁPIDA: VER GASTOS vs ENTRADAS vs TODOS */}
          <div className="fin-tipo-toggle-bar">
            <button 
              type="button" 
              className={`btn-tipo-pill ${filtroTipo === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('todos')}
            >
              📊 Todos os Registros
            </button>

            <button 
              type="button" 
              className={`btn-tipo-pill entrada ${filtroTipo === 'entrada' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('entrada')}
            >
              🟢 Apenas Entradas (Receitas)
            </button>

            <button 
              type="button" 
              className={`btn-tipo-pill saida ${filtroTipo === 'saida' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('saida')}
            >
              🔴 Apenas Gastos (Saídas / Compras)
            </button>

            <button 
              type="button" 
              className={`btn-tipo-pill pendente ${filtroTipo === 'pendente' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('pendente')}
            >
              ⏳ Pendentes de Baixa
            </button>
          </div>

          {/* 📊 GRÁFICO DE DISTRIBUIÇÃO POR CATEGORIA FINANCEIRA */}
          {(() => {
            const catBreakdown = transacoesFiltradas.reduce((acc, t) => {
              const cat = (t.categoria || '').toLowerCase();
              const val = Number(t.valor) || 0;
              if (t.tipo === 'entrada') {
                acc.locacao += val;
              } else if (t.tipo === 'saida') {
                if (cat.includes('estoque') || cat.includes('acervo') || cat.includes('compra')) acc.estoque += val;
                else if (cat.includes('manutenç') || cat.includes('conserto') || cat.includes('reparo')) acc.manutencao += val;
                else if (cat.includes('fixa') || cat.includes('aluguel') || cat.includes('luz') || cat.includes('internet')) acc.fixo += val;
                else if (cat.includes('equipe') || cat.includes('salário') || cat.includes('frete') || cat.includes('logística')) acc.equipe += val;
                else acc.outros += val;
              }
              return acc;
            }, { locacao: 0, estoque: 0, manutencao: 0, fixo: 0, equipe: 0, outros: 0 });

            const totalCatGeral = Object.values(catBreakdown).reduce((a, b) => a + b, 0);

            const itensBreakdown = [
              { id: 'locacao', icon: '🎉', label: 'Locações', valor: catBreakdown.locacao, cor: '#10b981' },
              { id: 'estoque', icon: '📦', label: 'Acervo', valor: catBreakdown.estoque, cor: '#3b82f6' },
              { id: 'manutencao', icon: '🛠️', label: 'Manutenção', valor: catBreakdown.manutencao, cor: '#f59e0b' },
              { id: 'fixo', icon: '🏢', label: 'Fixos', valor: catBreakdown.fixo, cor: '#64748b' },
              { id: 'equipe', icon: '👥', label: 'Equipe', valor: catBreakdown.equipe, cor: '#8b5cf6' },
            ];

            const dataPieCategorias = itensBreakdown
              .filter(i => i.valor > 0)
              .map(i => ({ name: `${i.icon} ${i.label}`, value: i.valor, color: i.cor }));

            return (
              <div className="fin-chart-card">
                <div className="fin-chart-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: '850', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📊 Distribuição por Categoria Financeira
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.73rem', color: '#64748b' }}>
                      Análise gráfica proporcional dos investimentos e receitas do período
                    </p>
                  </div>
                  <span className="fin-chart-total-pill">
                    Total: <strong>R$ {totalCatGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>

                <div className="fin-chart-body">
                  {/* 🍩 GRÁFICO DONUT RECHARTS */}
                  <div className="fin-chart-donut-wrapper">
                    <div style={{ width: '130px', height: '130px', position: 'relative' }}>
                      <ResponsiveContainer width="100%" height={130} minWidth={0} minHeight={130} initialDimension={{ width: 130, height: 130 }}>
                        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                          <Pie
                            data={dataPieCategorias.length > 0 ? dataPieCategorias : [{ name: 'Sem Lançamentos', value: 1, color: '#e2e8f0' }]}
                            innerRadius={38}
                            outerRadius={58}
                            cx="50%"
                            cy="50%"
                            paddingAngle={dataPieCategorias.length > 1 ? 4 : 0}
                            dataKey="value"
                          >
                            {(dataPieCategorias.length > 0 ? dataPieCategorias : [{ color: '#e2e8f0' }]).map((entry, index) => (
                              <Cell key={`cell-cat-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltipCat />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="fin-donut-center-text">
                        <strong style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 900 }}>
                          {dataPieCategorias.length}
                        </strong>
                        <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>Categorias</span>
                      </div>
                    </div>
                  </div>

                  {/* 📋 BARRAS DE PROGRESSO DE CADA CATEGORIA */}
                  <div className="fin-chart-legend-grid">
                    {itensBreakdown.map(item => {
                      const pct = totalCatGeral > 0 ? Math.round((item.valor / totalCatGeral) * 100) : 0;
                      return (
                        <div key={item.id} className="fin-category-bar-row">
                          <div className="fin-cat-info">
                            <span className="fin-cat-name">
                              <span className="fin-cat-dot" style={{ background: item.cor }}></span>
                              {item.icon} <strong>{item.label}</strong>
                            </span>
                            <span className="fin-cat-val" style={{ color: item.cor }}>
                              R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              <span className="fin-cat-pct">({pct}%)</span>
                            </span>
                          </div>
                          <div className="fin-cat-bar-track">
                            <div className="fin-cat-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: item.cor }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* BARRA DE FILTROS + SELETOR DESIGNER DE MÊS E ANO */}
          <div className="table-filter-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
            
            {/* BUSCA RÁPIDA */}
            <div className="search-input-wrapper" style={{ flex: '1 1 240px' }}>
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por descrição, categoria ou forma..." 
                value={busca} 
                onChange={e => setBusca(e.target.value)} 
              />
            </div>

            {/* 🗓️ SELETOR EXECUTIVO DE MÊS / ANO */}
            <div className="fin-mes-selector-wrapper">
              <select 
                className="fin-select-custom" 
                value={filtroMes} 
                onChange={e => setFiltroMes(e.target.value)}
                title="Selecionar Mês"
              >
                <option value="">📅 Todos os Meses</option>
                {nomesMeses.map(m => (
                  <option key={m.num} value={m.num}>{m.nome}</option>
                ))}
              </select>

              <select 
                className="fin-select-custom" 
                value={filtroAno} 
                onChange={e => setFiltroAno(e.target.value)}
                title="Selecionar Ano"
              >
                <option value="">📆 Todos os Anos</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>

              <div className="fin-quick-dates">
                <button 
                  type="button" 
                  className={`btn-date-quick ${filtroMes === mesAtualNum && filtroAno === anoAtualNum ? 'active' : ''}`}
                  onClick={() => setFiltroMesPredefinido('atual')}
                >
                  Este Mês
                </button>
                <button 
                  type="button" 
                  className={`btn-date-quick ${filtroMes === '' && filtroAno === '' ? 'active' : ''}`}
                  onClick={() => setFiltroMesPredefinido('todos')}
                >
                  Histórico Completo
                </button>
              </div>
            </div>

            {/* 📥 BOTÃO DE EXPORTAR EXCEL (.CSV) */}
            <button
              type="button"
              className="btn-export-excel"
              onClick={handleExportarExcel}
              title="Baixar planilha formatada em Excel/CSV"
            >
              📥 Exportar (.CSV)
            </button>

          </div>

          <div className="table-responsive-wrapper">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>DATA</th>
                  <th style={{ width: '150px' }}>CATEGORIA</th>
                  <th style={{ minWidth: '180px' }}>DESCRIÇÃO</th>
                  <th style={{ width: '130px' }}>FORMA PAGTO</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>COMPROVANTE</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>VALOR (R$)</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>SITUAÇÃO</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: "center", padding: "40px" }}>Carregando lançamentos de caixa...</td></tr>
                ) : transacoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                      Nenhum registro de {filtroTipo === 'entrada' ? 'Entrada' : filtroTipo === 'saida' ? 'Gasto/Saída' : 'Lançamento'} encontrado para este período.
                    </td>
                  </tr>
                ) : (
                  transacoesFiltradas.map((t) => {
                    const isEntrada = t.tipo === 'entrada';
                    const isPendente = t.status === 'pendente';

                    return (
                      <tr key={t.id}>
                        <td data-label="Data" className="td-data">
                          {t.data ? new Date(t.data + "T12:00").toLocaleDateString('pt-BR') : '—'}
                        </td>
                        
                        <td data-label="Categoria" className="td-categoria">
                          {renderBadgeCategoria(t.categoria, t.tipo)}
                        </td>
                        
                        <td data-label="Descrição" className="td-item-info">
                          <strong className="nome-produto">{t.descricao}</strong>
                        </td>
                        
                        <td data-label="Forma Pagto" className="td-forma-pagto">
                          <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '600' }}>
                            {t.formaPagto || '---'}
                          </span>
                        </td>

                        <td data-label="Comprovante" className="td-comprovante" style={{ textAlign: 'center' }}>
                          {t.comprovanteUrl ? (
                            <button 
                              type="button"
                              className="btn-comprovante-link"
                              onClick={() => setComprovanteModal({
                                titulo: t.descricao,
                                valor: t.valor,
                                data: t.data,
                                formaPagto: t.formaPagto || 'Pix',
                                comprovanteUrl: t.comprovanteUrl,
                                comprovanteNome: t.comprovanteNome || 'Comprovante.jpg'
                              })}
                            >
                              📎 Anexo
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>

                        <td data-label="Valor" className="td-valor" style={{ textAlign: 'right' }}>
                          <div className={`preco-real ${isEntrada ? 'txt-verde' : 'txt-vermelho'}`}>
                            {isEntrada ? '+ ' : '- '}
                            R$ {Number(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </td>

                        <td data-label="Situação" className="td-status" style={{ textAlign: 'center' }}>
                          <span className={`badge ${isPendente ? 'pendente' : 'comprado'}`}>
                            {isPendente ? 'Pendente' : 'Pago'}
                          </span>
                        </td>

                        <td className="td-acoes" style={{ textAlign: 'right' }}>
                          <div className="table-actions-container" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                            
                            {/* ✅ BOTÃO BAIXA RÁPIDA (1 CLIQUE) */}
                            {isPendente && (
                              <button 
                                type="button"
                                className="action-btn quit-btn" 
                                title="Quitar / Dar Baixa no Lançamento" 
                                onClick={() => handleQuitarLancamento(t)}
                              >
                                ✅ Quitar
                              </button>
                            )}

                            <button 
                              className="action-btn delete" 
                              title="Excluir Lançamento" 
                              onClick={() => handleExcluirLancamento(t)}
                            >
                              🗑️
                            </button>
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
      )}

      {/* ABA 2: GALERIA DE COMPROVANTES RECEBIDOS */}
      {abaAtiva === 'comprovantes' && (
        <div className="table-card-container">
          <div className="table-filter-bar">
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por cliente, pedido ou valor do comprovante..." 
                value={buscaComprovante}
                onChange={e => setBuscaComprovante(e.target.value)}
              />
              {buscaComprovante && (
                <button className="btn-clear-search" onClick={() => setBuscaComprovante('')}>✕</button>
              )}
            </div>

            <div className="filter-select-container">
              <select 
                className="filter-select"
                value={filtroForma}
                onChange={(e) => setFiltroForma(e.target.value)}
                style={{ fontWeight: '700' }}
              >
                <option value="todas">Forma: Todas</option>
                <option value="Pix">⚡ Pix</option>
                <option value="Dinheiro">💵 Dinheiro</option>
                <option value="Cartão">💳 Cartão</option>
                <option value="Transferência">🏦 Transferência</option>
              </select>
            </div>

            {/* SELETORES MÊS E ANO NA GALERIA */}
            <div className="fin-mes-selector-wrapper">
              <select 
                className="fin-select-custom" 
                value={filtroMes} 
                onChange={e => setFiltroMes(e.target.value)}
              >
                <option value="">📅 Todos os Meses</option>
                {nomesMeses.map(m => (
                  <option key={m.num} value={m.num}>{m.nome}</option>
                ))}
              </select>

              <select 
                className="fin-select-custom" 
                value={filtroAno} 
                onChange={e => setFiltroAno(e.target.value)}
              >
                <option value="">📆 Todos os Anos</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          {comprovantesFiltrados.length === 0 ? (
            <div className="empty-comprovantes-card">
              <div className="empty-icon-box">📎</div>
              <h3>Nenhum comprovante anexado no período</h3>
              <p>Assim que um recebimento for registrado com anexo de comprovante, ele surgirá aqui automaticamente.</p>
            </div>
          ) : (
            <div className="grid-galeria-comprovantes">
              {comprovantesFiltrados.map((item, idx) => (
                <div className="card-comprovante-item" key={item.id || idx}>
                  <div className="card-comprovante-header">
                    <span className="badge-forma-pagto">{item.formaPagto}</span>
                    <span className="badge-origem-tipo">{item.origem}</span>
                  </div>

                  <div 
                    className="comprovante-thumb-wrapper"
                    onClick={() => setComprovanteModal(item)}
                  >
                    {item.comprovanteUrl.startsWith('data:image') || item.comprovanteUrl.match(/\.(jpeg|jpg|png|webp)/i) ? (
                      <img src={item.comprovanteUrl} alt={item.titulo} className="img-comprovante-cover" />
                    ) : (
                      <div className="pdf-thumb-box">
                        <i className="fas fa-file-pdf icon-pdf"></i>
                        <span>📄 PDF</span>
                      </div>
                    )}
                    <div className="overlay-hover-thumb">
                      <span>🔍 Ampliar</span>
                    </div>
                  </div>

                  <div className="card-comprovante-body">
                    <h4 className="titulo-comprovante">{item.titulo}</h4>
                    <div className="meta-comprovante-row">
                      <span className="data-comprovante">
                        📅 {new Date(item.data + "T12:00").toLocaleDateString('pt-BR')}
                      </span>
                      <strong className="valor-comprovante">
                        R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  <div className="card-comprovante-footer">
                    <button 
                      className="btn-ver-comprovante-full"
                      onClick={() => setComprovanteModal(item)}
                    >
                      👁️ Ver Comprovante
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE AMPLIAÇÃO DO COMPROVANTE */}
      {comprovanteModal && (
        <div className="modal-overlay-celebre fade-in" onClick={() => setComprovanteModal(null)}>
          <div className="modal-card-celebre" style={{ maxWidth: '640px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header-celebre" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '850', color: '#0f172a' }}>
                  {comprovanteModal.titulo}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Data: {new Date(comprovanteModal.data + "T12:00").toLocaleDateString('pt-BR')} | Valor: R$ {Number(comprovanteModal.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({comprovanteModal.formaPagto})
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setComprovanteModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="body-comprovante-viewer" style={{ textAlign: 'center', background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', maxHeight: '70vh', overflowY: 'auto' }}>
              {comprovanteModal.comprovanteUrl.startsWith('data:image') || comprovanteModal.comprovanteUrl.match(/\.(jpeg|jpg|png|webp)/i) ? (
                <img src={comprovanteModal.comprovanteUrl} alt="Comprovante Ampliado" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '10px', objectFit: 'contain' }} />
              ) : (
                <iframe src={comprovanteModal.comprovanteUrl} title="Documento PDF" style={{ width: '100%', height: '500px', border: 'none', borderRadius: '10px' }}></iframe>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button 
                type="button" 
                onClick={() => setComprovanteModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const win = window.open();
                  if (win) {
                    win.document.write(`<title>${comprovanteModal.titulo}</title><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#0f172a;"><img src="${comprovanteModal.comprovanteUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
                  }
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)' }}
              >
                🔗 Abrir em Nova Aba
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Financeiro;