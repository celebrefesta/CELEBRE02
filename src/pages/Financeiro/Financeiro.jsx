import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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

const CATEGORIAS_FIXAS_CONFIG = [
  { valor: 'Equipe e Pessoal', label: '👥 Equipe & Pessoal (Salários / Diárias / Pró-labore)', cor: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { valor: 'Despesas Fixas', label: '🏢 Despesas Fixas (Aluguel, Luz, Água, Internet)', cor: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  { valor: 'Manutenção e Reparos', label: '🛠️ Manutenção & Reparos', cor: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { valor: 'Insumos e Embalagens', label: '📦 Insumos & Materiais', cor: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { valor: 'Marketing e Vendas', label: '📢 Marketing & Divulgação', cor: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
  { valor: 'Impostos e Contabilidade', label: '🏦 Impostos & Contabilidade', cor: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { valor: 'Taxas Bancárias', label: '💳 Taxas & Tarifas Bancárias', cor: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  { valor: 'Outros', label: '🏦 Outros Gastos Recorrentes', cor: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
];

const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

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

const Financeiro = ({ initialAba = 'lancamentos' }) => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // Obter mês e ano atuais
  const dataHoje = new Date();
  const mesAtualNum = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const anoAtualNum = String(dataHoje.getFullYear());

  const [abaAtiva, setAbaAtiva] = useState(initialAba); // 'lancamentos' | 'comprovantes' | 'contas-fixas'
  const [transacoes, setTransacoes] = useState([]);
  const [itensCompras, setItensCompras] = useState([]);
  const [comprovantesExtras, setComprovantesExtras] = useState([]);
  const [totalAReceber, setTotalAReceber] = useState(0);
  const [todasLocacoes, setTodasLocacoes] = useState([]);

  // 🗓️ FILTRO PERSONALIZADO DE MÊS E ANO
  const [filtroMes, setFiltroMes] = useState(mesAtualNum);
  const [filtroAno, setFiltroAno] = useState(anoAtualNum);

  // Filtros da Galeria de Comprovantes e Lançamentos
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'entrada' | 'saida' | 'pendente'
  const [buscaComprovante, setBuscaComprovante] = useState('');
  const [filtroForma, setFiltroForma] = useState('todas');
  const [modoVisualizacaoComprovantes, setModoVisualizacaoComprovantes] = useState('grid'); // 'grid' | 'lista'
  const [comprovanteModal, setComprovanteModal] = useState(null);
  const [modalDetalhesRegistro, setModalDetalhesRegistro] = useState(null);
  const [cardDetalheAberto, setCardDetalheAberto] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🗓️ DESPESAS RECORRENTES / CONTAS FIXAS
  const [despesasRecorrentes, setDespesasRecorrentes] = useState([]);
  const [formContaFixaAberto, setFormContaFixaAberto] = useState(false);
  const [editandoContaId, setEditandoContaId] = useState(null);
  const [salvandoContaFixa, setSalvandoContaFixa] = useState(false);
  const [lancandoContasFixasLote, setLancandoContasFixasLote] = useState(false);
  const [filtroCategoriaFixa, setFiltroCategoriaFixa] = useState('todas');
  const [formContaFixa, setFormContaFixa] = useState({
    descricao: '',
    categoria: 'Equipe e Pessoal',
    valor: 0,
    valorFormatado: '',
    diaVencimento: '10',
    formaPagto: 'Pix',
    observacoes: ''
  });

  // 💰 MÁSCARA AUTOMÁTICA DE MOEDA EM TEMPO REAL (PONTUAÇÃO FINANCEIRA R$)
  const handleValorContaFixaChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setFormContaFixa(prev => ({ ...prev, valor: 0, valorFormatado: '' }));
      return;
    }
    const num = Number(raw) / 100;
    const fmt = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setFormContaFixa(prev => ({ ...prev, valor: num, valorFormatado: fmt }));
  };

  const toggleDetalhes = (id) => {
    setCardDetalheAberto(prev => prev === id ? null : id);
  };

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
        setTodasLocacoes(locs);

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

    // 4. 🗓️ PUXA DESPESAS RECORRENTES CADASTRADAS (financeiro_recorrentes)
    const qRec = query(collection(db, "financeiro_recorrentes"), where("userId", "==", tenantId));
    const unsubRec = onSnapshot(qRec, (snap) => {
      const listaR = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDespesasRecorrentes(listaR);
    });

    carregarDadosLocacoes();

    return () => {
      unsubLancamentos();
      unsubCompras();
      unsubRec();
    };
  }, [usuarioLogado, navigate, tenantId]);

  // 📈 CÁLCULOS DO DRE GERENCIAL (MÊS/ANO SELECIONADO OU GERAL)
  const calcularDRE = () => {
    const entradasDoPeriodo = transacoesFiltradas.filter(t => t.tipo === 'entrada');
    const receitaBruta = entradasDoPeriodo.reduce((acc, t) => acc + Number(t.valor || 0), 0);
    
    const saidasDoPeriodo = transacoesFiltradas.filter(t => t.tipo === 'saida');
    
    const custosAquisicao = saidasDoPeriodo.filter(t => 
      t.categoria === 'Aquisição de Acervo' || t.categoria === 'Compra para Estoque'
    ).reduce((acc, t) => acc + Number(t.valor || 0), 0);

    const custosInsumos = saidasDoPeriodo.filter(t => 
      t.categoria === 'Insumos e Embalagens' || t.categoria === 'Material de Consumo'
    ).reduce((acc, t) => acc + Number(t.valor || 0), 0);

    const custosManutencao = saidasDoPeriodo.filter(t => 
      t.categoria === 'Manutenção e Reparos'
    ).reduce((acc, t) => acc + Number(t.valor || 0), 0);

    const totalCustosDiretos = custosAquisicao + custosInsumos + custosManutencao;
    const margemContribuicao = receitaBruta - totalCustosDiretos;

    const despesasEquipe = saidasDoPeriodo.filter(t => t.categoria === 'Equipe e Pessoal').reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const despesasFixasPredio = saidasDoPeriodo.filter(t => t.categoria === 'Despesas Fixas').reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const despesasMarketing = saidasDoPeriodo.filter(t => t.categoria === 'Marketing e Vendas').reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const despesasImpostos = saidasDoPeriodo.filter(t => t.categoria === 'Impostos e Contabilidade').reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const despesasTaxas = saidasDoPeriodo.filter(t => t.categoria === 'Taxas Bancárias').reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const despesasOutras = saidasDoPeriodo.filter(t => 
      !['Aquisição de Acervo', 'Compra para Estoque', 'Insumos e Embalagens', 'Material de Consumo', 'Manutenção e Reparos', 'Equipe e Pessoal', 'Despesas Fixas', 'Marketing e Vendas', 'Impostos e Contabilidade', 'Taxas Bancárias'].includes(t.categoria)
    ).reduce((acc, t) => acc + Number(t.valor || 0), 0);

    const totalDespesasFixas = despesasEquipe + despesasFixasPredio + despesasMarketing + despesasImpostos + despesasTaxas + despesasOutras;
    const resultadoLiquido = margemContribuicao - totalDespesasFixas;
    const margemLiquidaPct = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

    return {
      receitaBruta,
      custosAquisicao,
      custosInsumos,
      custosManutencao,
      totalCustosDiretos,
      margemContribuicao,
      despesasEquipe,
      despesasFixasPredio,
      despesasMarketing,
      despesasImpostos,
      despesasTaxas,
      despesasOutras,
      totalDespesasFixas,
      resultadoLiquido,
      margemLiquidaPct
    };
  };

  // 🔮 CÁLCULOS DO FLUXO DE CAIXA PROJETADO (PRÓXIMOS 30 E 60 DIAS)
  const calcularFluxoProjetado = () => {
    const hoje = new Date();
    const em30Dias = new Date();
    em30Dias.setDate(hoje.getDate() + 30);
    const em60Dias = new Date();
    em60Dias.setDate(hoje.getDate() + 60);

    const locacoesFuturas30 = [];
    const locacoesFuturas60 = [];

    todasLocacoes.forEach(loc => {
      const st = String(loc.status || '').toLowerCase();
      if (st.includes('cancel') || st.includes('orcam')) return;
      const tot = Number(loc.valorTotal || loc.total || 0);
      const pag = Number(loc.valorPago || 0);
      const saldo = Math.max(0, tot - pag);
      if (saldo <= 0) return;

      const dataRef = loc.dataRetirada || loc.dataDevolucao;
      if (!dataRef) return;
      const dt = new Date(dataRef + 'T12:00:00');
      if (dt >= hoje && dt <= em30Dias) {
        locacoesFuturas30.push({ ...loc, saldo, dataRef, dt });
      } else if (dt > em30Dias && dt <= em60Dias) {
        locacoesFuturas60.push({ ...loc, saldo, dataRef, dt });
      }
    });

    const entradasPrevistas30 = locacoesFuturas30.reduce((acc, l) => acc + l.saldo, 0);
    const entradasPrevistas60 = locacoesFuturas60.reduce((acc, l) => acc + l.saldo, 0);

    const totalContasFixasMes = despesasRecorrentes.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    const saidasPrevistas30 = totalContasFixasMes;
    const saidasPrevistas60 = totalContasFixasMes * 2;

    const saldoProjetado30 = entradasPrevistas30 - saidasPrevistas30;
    const saldoProjetado60 = (entradasPrevistas30 + entradasPrevistas60) - saidasPrevistas60;

    return {
      locacoesFuturas30,
      locacoesFuturas60,
      entradasPrevistas30,
      entradasPrevistas60,
      totalContasFixasMes,
      saidasPrevistas30,
      saidasPrevistas60,
      saldoProjetado30,
      saldoProjetado60
    };
  };



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
    ...todasTransacoesUnificadas.filter(t => t.comprovanteUrl).map(t => {
      let desc = t.descricao || 'Lançamento de Caixa';
      let cli = t.cliente || t.clienteNome || t.fornecedor || '';
      if (!cli && desc.includes(' - ')) {
        const parts = desc.split(' - ');
        desc = parts[0];
        cli = parts.slice(1).join(' - ');
      }
      return {
        id: t.id,
        clienteNome: cli,
        titulo: desc,
        tipo: t.tipo || 'entrada',
        valor: t.valor,
        data: t.data,
        formaPagto: t.formaPagto || 'Pix',
        comprovanteUrl: t.comprovanteUrl,
        comprovanteNome: t.comprovanteNome || 'Comprovante.jpg',
        origem: t.isOrigemCompras ? 'Módulo Compras' : 'Caixa'
      };
    }),
    ...comprovantesExtras.map(l => ({
      id: `loc_${l.id}`,
      clienteNome: l.clienteNome || l.cliente?.nome || 'Cliente',
      titulo: `Ref. Pedido #${l.numeroPedido || (l.id ? l.id.substring(0,6).toUpperCase() : 'S/N')}`,
      tipo: 'entrada',
      valor: l.valorPago || l.valorTotal || 0,
      data: l.dataCriacao || l.dataRetirada || l.dataEvento || new Date().toISOString().split('T')[0],
      formaPagto: l.formaPagamento || l.formaPagto || 'Locação',
      comprovanteUrl: l.ultimoComprovanteUrl,
      comprovanteNome: l.ultimoComprovanteNome || 'Comprovante_Pedido.jpg',
      origem: 'Pedido Locação'
    }))
  ];

  // ⬇️ DOWNLOAD DO COMPROVANTE COM NOME PERSONALIZADO E CONVERSÃO EM BLOB
  const handleDownloadComprovante = async (item, e) => {
    if (e) e.stopPropagation();
    try {
      // 1. Gera nome limpo e elegante
      const dataStr = item.data ? item.data.split('-').reverse().join('-') : '2026';
      const cleanTitle = (item.titulo || 'Comprovante')
        .replace(/Ref\.\s*Pedido\s*#/i, 'Pedido_')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const cleanClient = (item.clienteNome && item.clienteNome !== item.titulo)
        ? `_${item.clienteNome.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_')}`
        : '';
      
      const fileName = `Comprovante_${cleanTitle}${cleanClient}_${dataStr}.jpg`;

      // 2. Se for base64
      if (item.comprovanteUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = item.comprovanteUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // 3. Se for URL externa, converte para Blob para o navegador forçar o nome desejado
      const response = await fetch(item.comprovanteUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.warn("Download via fetch falhou (CORS ou restrição), usando fallback:", err);
      const link = document.createElement('a');
      link.href = item.comprovanteUrl;
      link.target = '_blank';
      link.download = `Comprovante_${(item.titulo || 'Celebre').replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 🖨️ IMPRESSÃO SILENCIOSA E DIRETA DO COMPROVANTE (SEM ABRIR PÁGINA FEIA)
  const handleImprimirComprovante = (item, e) => {
    if (e) e.stopPropagation();
    const isImg = item.comprovanteUrl.startsWith('data:image') || item.comprovanteUrl.match(/\.(jpeg|jpg|png|webp)/i);
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${item.titulo || 'Comprovante'}</title>
          <style>
            @page { margin: 10mm; size: auto; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; margin: 0; padding: 20px; color: #0f172a; }
            .header-print { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
            .header-print h2 { margin: 0 0 4px 0; font-size: 18px; color: #0f172a; }
            .header-print p { margin: 0; font-size: 13px; color: #64748b; font-weight: 600; }
            .meta-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; display: inline-block; margin-bottom: 18px; font-size: 13px; }
            .meta-bar strong { color: #166534; font-size: 15px; }
            .img-wrap { max-width: 95%; margin: 0 auto; text-align: center; }
            img { max-width: 100%; max-height: 80vh; border-radius: 8px; border: 1px solid #cbd5e1; object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="header-print">
            <h2>Comprovante de Pagamento — Celebre</h2>
            <p>${item.titulo} ${item.clienteNome && item.clienteNome !== item.titulo ? `• ${item.clienteNome}` : ''}</p>
          </div>
          <div class="meta-bar">
            <span>📅 Data: <strong>${item.data ? new Date(item.data + "T12:00").toLocaleDateString('pt-BR') : '—'}</strong></span> &nbsp;|&nbsp;
            <span>Forma: <strong>${item.formaPagto}</strong></span> &nbsp;|&nbsp;
            <span>Valor: <strong>R$ ${Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
          </div>
          <div class="img-wrap">
            ${isImg ? `<img src="${item.comprovanteUrl}" />` : `<p>Documento PDF</p>`}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 400);
  };

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

  // 📥 EXPORTAÇÃO EXECUTIVA DA DRE EM CSV / PLANILHA
  const handleExportarDRE = () => {
    const dre = calcularDRE();
    const nomeMes = nomesMeses.find(m => m.num === filtroMes)?.nome || 'Todos os Meses';
    const anoStr = filtroAno || 'Geral';
    
    let csv = `DEMONSTRACAO DO RESULTADO DO EXERCICIO (DRE) - CELEBRE FESTAS\n`;
    csv += `Periodo: ${nomeMes} / ${anoStr}\n\n`;
    csv += `Linha;Valor (R$);% da Receita\n`;
    csv += `(+) 1. RECEITA OPERACIONAL BRUTA;${dre.receitaBruta.toFixed(2).replace('.', ',')};100,0%\n`;
    csv += `(-) Aquisicao de Acervo & Estoque;-${dre.custosAquisicao.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.custosAquisicao / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(-) Insumos e Materiais;-${dre.custosInsumos.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.custosInsumos / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(-) Manutencao e Reparos;-${dre.custosManutencao.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.custosManutencao / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(=) MARGEM DE CONTRIBUICAO / LUCRO BRUTO;${dre.margemContribuicao.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.margemContribuicao / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(-) Equipe & Pessoal;-${dre.despesasEquipe.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.despesasEquipe / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(-) Despesas Prediais & Fixas;-${dre.despesasFixasPredio.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.despesasFixasPredio / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(-) Marketing & Vendas;-${dre.despesasMarketing.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.despesasMarketing / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(-) Impostos & Contabilidade;-${dre.despesasImpostos.toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? ((dre.despesasImpostos / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(-) Taxas Bancarias & Outros;-${(dre.despesasTaxas + dre.despesasOutras).toFixed(2).replace('.', ',')};${dre.receitaBruta > 0 ? (((dre.despesasTaxas + dre.despesasOutras) / dre.receitaBruta) * 100).toFixed(1).replace('.', ',') : '0,0'}%\n`;
    csv += `(=) RESULTADO / LUCRO LIQUIDO;${dre.resultadoLiquido.toFixed(2).replace('.', ',')};${dre.margemLiquidaPct.toFixed(1).replace('.', ',')}%\n`;

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DRE_Celebre_${nomeMes}_${anoStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 📝 SALVAR CONTA FIXA (NOVA OU EDIÇÃO)
  const handleSalvarContaFixa = async (e) => {
    e.preventDefault();
    if (!formContaFixa.descricao.trim()) {
      alert("Preencha a descrição da conta.");
      return;
    }
    if (!formContaFixa.valor || formContaFixa.valor <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    setSalvandoContaFixa(true);
    try {
      if (editandoContaId) {
        await updateDoc(doc(db, "financeiro_recorrentes", editandoContaId), {
          descricao: formContaFixa.descricao.trim(),
          categoria: formContaFixa.categoria || 'Equipe e Pessoal',
          valor: Number(formContaFixa.valor) || 0,
          diaVencimento: Number(formContaFixa.diaVencimento) || 10,
          formaPagto: formContaFixa.formaPagto || 'Pix',
          observacoes: formContaFixa.observacoes?.trim() || '',
          atualizadoEm: serverTimestamp()
        });
        await registrarLog("ATUALIZAR_CONTA_FIXA", `Conta fixa atualizada: ${formContaFixa.descricao} - R$ ${formContaFixa.valor.toFixed(2)}`);
      } else {
        await addDoc(collection(db, "financeiro_recorrentes"), {
          userId: tenantId,
          descricao: formContaFixa.descricao.trim(),
          categoria: formContaFixa.categoria || 'Equipe e Pessoal',
          valor: Number(formContaFixa.valor) || 0,
          diaVencimento: Number(formContaFixa.diaVencimento) || 10,
          formaPagto: formContaFixa.formaPagto || 'Pix',
          observacoes: formContaFixa.observacoes?.trim() || '',
          criadoEm: serverTimestamp()
        });
        await registrarLog("CRIAR_CONTA_FIXA", `Conta fixa criada: ${formContaFixa.descricao} - R$ ${formContaFixa.valor.toFixed(2)}`);
      }

      setFormContaFixa({
        descricao: '',
        categoria: 'Equipe e Pessoal',
        valor: 0,
        valorFormatado: '',
        diaVencimento: '10',
        formaPagto: 'Pix',
        observacoes: ''
      });
      setEditandoContaId(null);
      setFormContaFixaAberto(false);
    } catch (err) {
      console.error("Erro ao salvar conta fixa:", err);
      alert("Erro ao salvar conta fixa: " + (err.message || err));
    } finally {
      setSalvandoContaFixa(false);
    }
  };

  const handleEditarContaFixa = (item) => {
    setEditandoContaId(item.id);
    const num = Number(item.valor) || 0;
    setFormContaFixa({
      descricao: item.descricao || '',
      categoria: item.categoria || 'Equipe e Pessoal',
      valor: num,
      valorFormatado: num > 0 ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      diaVencimento: String(item.diaVencimento || 10),
      formaPagto: item.formaPagto || 'Pix',
      observacoes: item.observacoes || ''
    });
    setFormContaFixaAberto(true);
    window.scrollTo({ top: 160, behavior: 'smooth' });
  };

  const handleExcluirContaFixa = async (item) => {
    if (!window.confirm(`Tem certeza que deseja excluir a conta fixa "${item.descricao}"?`)) return;
    try {
      await deleteDoc(doc(db, "financeiro_recorrentes", item.id));
      await registrarLog("EXCLUIR_CONTA_FIXA", `Conta fixa excluída: ${item.descricao}`);
    } catch (err) {
      console.error("Erro ao excluir conta fixa:", err);
      alert("Erro ao excluir conta fixa.");
    }
  };

  const handleLancarContaFixaIndividual = async (item) => {
    const mesAnoAlvo = `${filtroAno || anoAtualNum}-${filtroMes || mesAtualNum}`;
    const nomeMes = nomesMeses.find(m => m.num === (filtroMes || mesAtualNum))?.nome;

    const jaExiste = transacoes.some(t => 
      t.tipo === 'saida' &&
      (t.descricao || '').toLowerCase() === item.descricao.toLowerCase() &&
      (t.data || '').startsWith(mesAnoAlvo)
    );

    if (jaExiste) {
      alert(`⚠️ A conta "${item.descricao}" já foi lançada no fluxo de caixa de ${nomeMes}/${filtroAno || anoAtualNum}.`);
      return;
    }

    if (!window.confirm(`Deseja lançar a despesa "${item.descricao}" de R$ ${Number(item.valor).toFixed(2)} no caixa de ${nomeMes}/${filtroAno || anoAtualNum}?`)) {
      return;
    }

    try {
      const dia = String(item.diaVencimento || 10).padStart(2, '0');
      const dataLancamento = `${filtroAno || anoAtualNum}-${filtroMes || mesAtualNum}-${dia}`;

      await addDoc(collection(db, "financeiro_lancamentos"), {
        userId: tenantId,
        tipo: 'saida',
        categoria: item.categoria || 'Equipe e Pessoal',
        descricao: item.descricao,
        valor: Number(item.valor) || 0,
        formaPagto: item.formaPagto || 'Pix',
        data: dataLancamento,
        status: 'pago',
        origemRecorrente: true,
        criadoEm: serverTimestamp()
      });

      await registrarLog("LANCAR_CONTA_FIXA_INDIVIDUAL", `Conta ${item.descricao} lançada em ${dataLancamento}`);
      alert(`✅ Sucesso! "${item.descricao}" lançada no fluxo de caixa de ${nomeMes}/${filtroAno || anoAtualNum}.`);
    } catch (err) {
      console.error("Erro ao lançar conta individual:", err);
      alert("Erro ao lançar conta no caixa.");
    }
  };

  const handleLancarTodasContasFixasDoMes = async () => {
    if (despesasRecorrentes.length === 0) {
      alert("Nenhuma conta fixa cadastrada para lançar.");
      return;
    }

    const mesAnoAlvo = `${filtroAno || anoAtualNum}-${filtroMes || mesAtualNum}`;
    const nomeMes = nomesMeses.find(m => m.num === (filtroMes || mesAtualNum))?.nome;

    setLancandoContasFixasLote(true);
    try {
      let criados = 0;
      for (const rec of despesasRecorrentes) {
        const dia = String(rec.diaVencimento || 10).padStart(2, '0');
        const dataLancamento = `${filtroAno || anoAtualNum}-${filtroMes || mesAtualNum}-${dia}`;

        const jaExiste = transacoes.some(t => 
          t.tipo === 'saida' &&
          (t.descricao || '').toLowerCase() === rec.descricao.toLowerCase() &&
          (t.data || '').startsWith(mesAnoAlvo)
        );

        if (!jaExiste) {
          await addDoc(collection(db, "financeiro_lancamentos"), {
            userId: tenantId,
            tipo: 'saida',
            categoria: rec.categoria || 'Equipe e Pessoal',
            descricao: rec.descricao,
            valor: Number(rec.valor) || 0,
            formaPagto: rec.formaPagto || 'Pix',
            data: dataLancamento,
            status: 'pago',
            origemRecorrente: true,
            criadoEm: serverTimestamp()
          });
          criados++;
        }
      }

      if (criados > 0) {
        await registrarLog("LANCAR_CONTAS_FIXAS_LOTE", `${criados} contas fixas lançadas para o período ${mesAnoAlvo}`);
        alert(`✅ Sucesso! ${criados} despesa(s) fixa(s) lançada(s) no caixa de ${nomeMes}/${filtroAno || anoAtualNum}.`);
      } else {
        alert(`ℹ️ Todas as contas fixas já constam lançadas no caixa de ${nomeMes}/${filtroAno || anoAtualNum}.`);
      }
    } catch (err) {
      console.error("Erro ao lançar contas em lote:", err);
      alert("Erro ao lançar contas fixas no caixa.");
    } finally {
      setLancandoContasFixasLote(false);
    }
  };

  // 📊 CÁLCULOS DE CONTAS FIXAS
  const totalCustoFixoGeral = despesasRecorrentes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const totalEquipeFixa = despesasRecorrentes.filter(c => (c.categoria || '').toLowerCase().includes('equipe') || (c.categoria || '').toLowerCase().includes('salário') || (c.categoria || '').toLowerCase().includes('pessoal')).reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const totalInfraFixa = despesasRecorrentes.filter(c => (c.categoria || '').toLowerCase().includes('fixa') || (c.categoria || '').toLowerCase().includes('infra') || (c.categoria || '').toLowerCase().includes('aluguel')).reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  
  const lancadasFixasNoMesCount = despesasRecorrentes.filter(c => {
    const mesAnoAlvo = `${filtroAno || anoAtualNum}-${filtroMes || mesAtualNum}`;
    return transacoes.some(t => t.tipo === 'saida' && (t.descricao || '').toLowerCase() === (c.descricao || '').toLowerCase() && (t.data || '').startsWith(mesAnoAlvo));
  }).length;

  const formasResumoFixas = {
    pix: despesasRecorrentes.filter(c => (c.formaPagto || '').toLowerCase().includes('pix')).reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
    cartao: despesasRecorrentes.filter(c => (c.formaPagto || '').toLowerCase().includes('cart')).reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
    dinheiro: despesasRecorrentes.filter(c => (c.formaPagto || '').toLowerCase().includes('dinheiro')).reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
    outros: despesasRecorrentes.filter(c => !(c.formaPagto || '').toLowerCase().includes('pix') && !(c.formaPagto || '').toLowerCase().includes('cart') && !(c.formaPagto || '').toLowerCase().includes('dinheiro')).reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
  };

  const contasFixasFiltradas = despesasRecorrentes.filter(c => {
    const termo = busca.toLowerCase();
    const matchBusca = (c.descricao || '').toLowerCase().includes(termo) ||
                       (c.categoria || '').toLowerCase().includes(termo) ||
                       (c.formaPagto || '').toLowerCase().includes(termo);

    if (filtroCategoriaFixa === 'todas') return matchBusca;
    if (filtroCategoriaFixa === 'Equipe e Pessoal') return matchBusca && c.categoria === 'Equipe e Pessoal';
    if (filtroCategoriaFixa === 'Despesas Fixas') return matchBusca && c.categoria === 'Despesas Fixas';
    if (filtroCategoriaFixa === 'outros') return matchBusca && c.categoria !== 'Equipe e Pessoal' && c.categoria !== 'Despesas Fixas';
    return matchBusca;
  });

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

  // 🏷️ RENDERIZADOR DE CHIPS DE VÍNCULO INTERATIVOS (Locação, Cliente, Fornecedor, Peça, Compra)
  const renderChipsVinculo = (t) => {
    const hasVinculo = t.locacaoNumero || t.locacaoId || t.clienteNome || t.fornecedorNome || t.pecaNome || t.itemNome || t.compraId;
    if (!hasVinculo) return null;

    return (
      <div className="chips-vinculos-container">
        {(t.locacaoNumero || t.locacaoId) && (
          <span 
            className="chip-vinculo-fin chip-locacao"
            onClick={(e) => {
              e.stopPropagation();
              setModalDetalhesRegistro({
                tipo: 'locacao',
                titulo: `Locação Pedido #${t.locacaoNumero || (t.locacaoId ? t.locacaoId.slice(0,6) : '')}`,
                id: t.locacaoId,
                numero: t.locacaoNumero,
                cliente: t.clienteNome,
                valor: t.valor,
                data: t.data,
                descricao: t.descricao
              });
            }}
            title="Ver detalhes da Locação vinculada"
          >
            🔗 #{t.locacaoNumero || (t.locacaoId ? t.locacaoId.slice(0,6) : '')}
          </span>
        )}

        {t.clienteNome && (
          <span 
            className="chip-vinculo-fin chip-cliente"
            onClick={(e) => {
              e.stopPropagation();
              setModalDetalhesRegistro({
                tipo: 'cliente',
                titulo: `Cliente: ${t.clienteNome}`,
                nome: t.clienteNome,
                id: t.clienteId,
                valor: t.valor,
                data: t.data
              });
            }}
            title="Ver detalhes do Cliente"
          >
            👤 {t.clienteNome}
          </span>
        )}

        {t.fornecedorNome && (
          <span 
            className="chip-vinculo-fin chip-fornecedor"
            onClick={(e) => {
              e.stopPropagation();
              setModalDetalhesRegistro({
                tipo: 'fornecedor',
                titulo: `Fornecedor: ${t.fornecedorNome}`,
                nome: t.fornecedorNome,
                tel: t.fornecedorTelefone,
                valor: t.valor,
                data: t.data
              });
            }}
            title="Ver detalhes do Fornecedor"
          >
            🏢 {t.fornecedorNome}
          </span>
        )}

        {(t.pecaNome || t.itemNome) && (
          <span 
            className="chip-vinculo-fin chip-peca"
            onClick={(e) => {
              e.stopPropagation();
              setModalDetalhesRegistro({
                tipo: 'peca',
                titulo: `Acervo: ${t.pecaNome || t.itemNome}`,
                nome: t.pecaNome || t.itemNome,
                id: t.pecaId || t.itemId,
                valor: t.valor,
                data: t.data
              });
            }}
            title="Ver detalhes da Peça do Acervo"
          >
            📦 {t.pecaNome || t.itemNome}
          </span>
        )}

        {t.compraId && (
          <span 
            className="chip-vinculo-fin chip-compra"
            onClick={(e) => {
              e.stopPropagation();
              setModalDetalhesRegistro({
                tipo: 'compra',
                titulo: `Ordem de Compra`,
                id: t.compraId,
                descricao: t.descricao,
                valor: t.valor,
                data: t.data
              });
            }}
            title="Ver detalhes da Compra"
          >
            🛒 Compra
          </span>
        )}
      </div>
    );
  };

  const dre = calcularDRE();
  const proj = calcularFluxoProjetado();

  return (
    <div className="financeiro-container clientes-container fade-in">
      
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
          <button 
            type="button" 
            className="btn-secondary-celebre" 
            onClick={() => navigate(-1)}
            title="Voltar para a página anterior"
          >
            ← Voltar
          </button>

          {abaAtiva === 'contas-fixas' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn-lancar-lote-contas"
                onClick={handleLancarContasFixasMesAtual}
                disabled={lancandoContasFixasLote || despesasRecorrentes.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontWeight: '800',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 3px 10px rgba(79, 70, 229, 0.25)'
                }}
              >
                {lancandoContasFixasLote ? '⏳ Lançando...' : `⚡ Gerar Contas Fixas de ${nomesMeses.find(m => m.num === (filtroMes || mesAtualNum))?.nome || 'Mês'}`}
              </button>

              <button 
                type="button" 
                className="btn-primary-celebre"
                onClick={() => {
                  setEditandoContaId(null);
                  setFormContaFixa({
                    descricao: '',
                    categoria: 'Equipe e Pessoal',
                    valor: 0,
                    valorFormatado: '',
                    diaVencimento: '10',
                    formaPagto: 'Pix',
                    observacoes: ''
                  });
                  setFormContaFixaAberto(true);
                }}
              >
                + CADASTRAR NOVA CONTA
              </button>
            </div>
          ) : (
            <button className="btn-primary-celebre" onClick={() => navigate("/financeiro/novo")}>
              + NOVO LANÇAMENTO
            </button>
          )}
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO SEGMENTADAS (GARANTIDAS NA MESMA LINHA) */}
      <div className="fin-tabs-bar">
        <button 
          type="button"
          onClick={() => setAbaAtiva('lancamentos')}
          className={`tab-btn-celebre ${abaAtiva === 'lancamentos' ? 'active' : ''}`}
        >
          <span>📊 Fluxo de Caixa</span>
          <span className="tab-badge">{transacoesFiltradas.length}</span>
        </button>

        <button 
          type="button"
          onClick={() => setAbaAtiva('dre-gerencial')}
          className={`tab-btn-celebre ${abaAtiva === 'dre-gerencial' ? 'active' : ''}`}
        >
          <span>📈 DRE Gerencial</span>
        </button>

        <button 
          type="button"
          onClick={() => setAbaAtiva('fluxo-projetado')}
          className={`tab-btn-celebre ${abaAtiva === 'fluxo-projetado' ? 'active' : ''}`}
        >
          <span>🔮 Projeção (30/60d)</span>
        </button>

        <button 
          type="button"
          onClick={() => {
            setAbaAtiva('comprovantes');
            setFiltroMes('');
            setFiltroAno('');
          }}
          className={`tab-btn-celebre ${abaAtiva === 'comprovantes' ? 'active' : ''}`}
        >
          <span>📎 Comprovantes</span>
          {comprovantesUnicos.length > 0 && (
            <span className="tab-badge">{comprovantesUnicos.length}</span>
          )}
        </button>

        <button 
          type="button"
          onClick={() => setAbaAtiva('contas-fixas')}
          className={`tab-btn-celebre ${abaAtiva === 'contas-fixas' ? 'active' : ''}`}
        >
          <span>🏢 Contas Fixas</span>
          {despesasRecorrentes.length > 0 && (
            <span className="tab-badge">{despesasRecorrentes.length}</span>
          )}
        </button>
      </div>

      {/* CARDS DE DASHBOARD INTERATIVOS (PADRÃO UNIFICADO EM TODAS AS ABAS) (GOLDEN RULE 1 & 2) */}
      <div className="clientes-stats-grid">
        {abaAtiva === 'contas-fixas' ? (
          <>
            {/* CARD 1: CUSTO FIXO TOTAL */}
            <div 
              className={`stat-card-pro card-red interactive-card ${filtroCategoriaFixa === 'todas' ? 'card-active-glow' : ''}`}
              onClick={() => setFiltroCategoriaFixa('todas')}
              title="Clique para ver todas as contas fixas"
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-icon-wrapper icon-red">
                📌
              </div>
              <div className="stat-content">
                <span className="stat-title">CUSTO FIXO TOTAL</span>
                <strong className="stat-number">
                  R$ {totalCustoFixoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
                <small className="stat-desc">{despesasRecorrentes.length} contas cadastradas</small>
              </div>
            </div>

            {/* CARD 2: EQUIPE & PESSOAL */}
            <div 
              className={`stat-card-pro card-purple interactive-card ${filtroCategoriaFixa === 'Equipe e Pessoal' ? 'card-active-glow' : ''}`}
              onClick={() => setFiltroCategoriaFixa('Equipe e Pessoal')}
              title="Clique para filtrar apenas Equipe e Salários"
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-icon-wrapper icon-purple">
                👥
              </div>
              <div className="stat-content">
                <span className="stat-title">EQUIPE & PESSOAL</span>
                <strong className="stat-number">
                  R$ {totalEquipeFixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
                <small className="stat-desc">Salários, diárias e pró-labore</small>
              </div>
            </div>

            {/* CARD 3: INFRAESTRUTURA & FIXAS */}
            <div 
              className={`stat-card-pro card-blue interactive-card ${filtroCategoriaFixa === 'Despesas Fixas' ? 'card-active-glow' : ''}`}
              onClick={() => setFiltroCategoriaFixa('Despesas Fixas')}
              title="Clique para filtrar apenas Infraestrutura e Fixas"
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-icon-wrapper">
                🏢
              </div>
              <div className="stat-content">
                <span className="stat-title">INFRA & DESPESAS</span>
                <strong className="stat-number">
                  R$ {totalInfraFixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
                <small className="stat-desc">Aluguel, energia, internet</small>
              </div>
            </div>

            {/* CARD 4: STATUS DO MÊS */}
            <div 
              className="stat-card-pro card-green interactive-card"
              style={{ cursor: 'default' }}
            >
              <div className="stat-icon-wrapper icon-green">
                ⚡
              </div>
              <div className="stat-content">
                <span className="stat-title">STATUS EM {(nomesMeses.find(m => m.num === (filtroMes || mesAtualNum))?.nome || 'MÊS').toUpperCase()}</span>
                <strong className="stat-number">
                  {lancadasFixasNoMesCount} / {despesasRecorrentes.length}
                </strong>
                <small className="stat-desc">
                  {lancadasFixasNoMesCount === despesasRecorrentes.length && despesasRecorrentes.length > 0 ? '✅ 100% lançadas' : 'Lançadas no caixa'}
                </small>
              </div>
            </div>
          </>
        ) : abaAtiva === 'dre-gerencial' ? (
          <>
            {/* CARD 1: RECEITA BRUTA */}
            <div className="stat-card-pro card-green interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-green">
                🟢
              </div>
              <div className="stat-content">
                <span className="stat-title">1. RECEITA BRUTA</span>
                <strong className="stat-number">R$ {dre.receitaBruta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Entradas de contratos</small>
              </div>
            </div>

            {/* CARD 2: CUSTOS DIRETOS */}
            <div className="stat-card-pro card-red interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-red">
                🔴
              </div>
              <div className="stat-content">
                <span className="stat-title">2. CUSTOS DIRETOS</span>
                <strong className="stat-number">R$ {dre.totalCustosDiretos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Acervo, insumos & reparos</small>
              </div>
            </div>

            {/* CARD 3: DESPESAS FIXAS */}
            <div className="stat-card-pro card-amber interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-amber">
                🏢
              </div>
              <div className="stat-content">
                <span className="stat-title">3. DESPESAS FIXAS</span>
                <strong className="stat-number">R$ {dre.totalDespesasFixas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Equipe, aluguel, luz, net</small>
              </div>
            </div>

            {/* CARD 4: LUCRO LÍQUIDO */}
            <div className={`stat-card-pro ${dre.resultadoLiquido >= 0 ? 'card-green' : 'card-red'} interactive-card`} style={{ cursor: 'default' }}>
              <div className={`stat-icon-wrapper ${dre.resultadoLiquido >= 0 ? 'icon-green' : 'icon-red'}`}>
                {dre.resultadoLiquido >= 0 ? '🏆' : '⚠️'}
              </div>
              <div className="stat-content">
                <span className="stat-title">4. LUCRO LÍQUIDO</span>
                <strong className="stat-number" style={{ color: dre.resultadoLiquido >= 0 ? '#15803d' : '#b91c1c' }}>
                  R$ {dre.resultadoLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </strong>
                <small className="stat-desc">
                  Margem: <strong style={{ color: dre.resultadoLiquido >= 0 ? '#16a34a' : '#dc2626' }}>{dre.margemLiquidaPct.toFixed(1)}%</strong>
                </small>
              </div>
            </div>
          </>
        ) : abaAtiva === 'fluxo-projetado' ? (
          <>
            {/* CARD 1: ENTRADAS 30D */}
            <div className="stat-card-pro card-blue interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-blue">
                🔮
              </div>
              <div className="stat-content">
                <span className="stat-title">ENTRADAS (30D)</span>
                <strong className="stat-number">R$ {proj.entradasPrevistas30.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">{proj.locacoesFuturas30.length} festas agendadas</small>
              </div>
            </div>

            {/* CARD 2: SAIDAS FIXAS 30D */}
            <div className="stat-card-pro card-red interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-red">
                🔴
              </div>
              <div className="stat-content">
                <span className="stat-title">FIXAS A VENCER (30D)</span>
                <strong className="stat-number">R$ {proj.saidasPrevistas30.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Contas do mês</small>
              </div>
            </div>

            {/* CARD 3: ENTRADAS 60D */}
            <div className="stat-card-pro card-purple interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-purple">
                🚀
              </div>
              <div className="stat-content">
                <span className="stat-title">ENTRADAS (60D)</span>
                <strong className="stat-number">R$ {(proj.entradasPrevistas30 + proj.entradasPrevistas60).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">{proj.locacoesFuturas30.length + proj.locacoesFuturas60.length} contratos no horizonte</small>
              </div>
            </div>

            {/* CARD 4: SALDO PROJETADO */}
            <div className={`stat-card-pro ${proj.saldoProjetado60 >= 0 ? 'card-green' : 'card-red'} interactive-card`} style={{ cursor: 'default' }}>
              <div className={`stat-icon-wrapper ${proj.saldoProjetado60 >= 0 ? 'icon-green' : 'icon-red'}`}>
                🏦
              </div>
              <div className="stat-content">
                <span className="stat-title">SALDO PREVISTO (60D)</span>
                <strong className="stat-number" style={{ color: proj.saldoProjetado60 >= 0 ? '#15803d' : '#b91c1c' }}>
                  R$ {proj.saldoProjetado60.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </strong>
                <small className="stat-desc">Após despesas dos 2 meses</small>
              </div>
            </div>
          </>
        ) : abaAtiva === 'comprovantes' ? (
          <>
            {/* CARD 1: COMPROVANTES */}
            <div className="stat-card-pro card-blue interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-blue">
                📎
              </div>
              <div className="stat-content">
                <span className="stat-title">COMPROVANTES</span>
                <strong className="stat-number">{todosComprovantes.length}</strong>
                <small className="stat-desc">Documentos auditados</small>
              </div>
            </div>

            {/* CARD 2: PIX */}
            <div className="stat-card-pro card-green interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-green">
                ⚡
              </div>
              <div className="stat-content">
                <span className="stat-title">TOTAL EM PIX</span>
                <strong className="stat-number">R$ {formasResumo.pix.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Recebimentos instantâneos</small>
              </div>
            </div>

            {/* CARD 3: CARTÃO */}
            <div className="stat-card-pro card-purple interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-purple">
                💳
              </div>
              <div className="stat-content">
                <span className="stat-title">TOTAL EM CARTÃO</span>
                <strong className="stat-number">R$ {formasResumo.cartao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Crédito e débito</small>
              </div>
            </div>

            {/* CARD 4: DINHEIRO */}
            <div className="stat-card-pro card-amber interactive-card" style={{ cursor: 'default' }}>
              <div className="stat-icon-wrapper icon-amber">
                💵
              </div>
              <div className="stat-content">
                <span className="stat-title">EM DINHEIRO</span>
                <strong className="stat-number">R$ {formasResumo.dinheiro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Recebimentos em espécie</small>
              </div>
            </div>
          </>
        ) : (
          <>
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
                <span className="stat-title">ENTRADAS</span>
                <strong className="stat-number">R$ {totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Receitas confirmadas</small>
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
                <span className="stat-title">GASTOS / SAÍDAS</span>
                <strong className="stat-number">R$ {totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Despesas pagas</small>
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
                <span className="stat-title">A RECEBER</span>
                <strong className="stat-number">R$ {totalAReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">Locações em aberto</small>
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
                <span className="stat-title">SALDO REAL</span>
                <strong className="stat-number">R$ {saldoLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                <small className="stat-desc">
                  Previsto: <strong style={{ color: (saldoLiquido + totalAReceber) >= 0 ? '#16a34a' : '#dc2626' }}>R$ {(saldoLiquido + totalAReceber).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                </small>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 💳 BARRINHA DE RESUMO POR FORMA DE PAGAMENTO (SEMPRE NO MESMO LUGAR) */}
      <div className="fin-formas-bar">
        {abaAtiva === 'contas-fixas' ? (
          <>
            <div className="forma-item pix" title="Total a pagar via Pix">
              <span className="forma-icon">⚡</span>
              <span className="forma-label">Pix:</span>
              <strong>R$ {formasResumoFixas.pix.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            <div className="forma-item cartao" title="Total a pagar em Cartão">
              <span className="forma-icon">💳</span>
              <span className="forma-label">Cartão:</span>
              <strong>R$ {formasResumoFixas.cartao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            <div className="forma-item dinheiro" title="Total a pagar em Dinheiro">
              <span className="forma-icon">💵</span>
              <span className="forma-label">Dinheiro:</span>
              <strong>R$ {formasResumoFixas.dinheiro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            {formasResumoFixas.outros > 0 && (
              <div className="forma-item outros" title="Total a pagar via Boleto / Outros">
                <span className="forma-icon">📄</span>
                <span className="forma-label">Boleto/Outros:</span>
                <strong>R$ {formasResumoFixas.outros.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
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
              📊 Todos
            </button>

            <button 
              type="button" 
              className={`btn-tipo-pill entrada ${filtroTipo === 'entrada' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('entrada')}
            >
              🟢 Entradas
            </button>

            <button 
              type="button" 
              className={`btn-tipo-pill saida ${filtroTipo === 'saida' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('saida')}
            >
              🔴 Gastos
            </button>

            <button 
              type="button" 
              className={`btn-tipo-pill pendente ${filtroTipo === 'pendente' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('pendente')}
            >
              ⏳ Pendentes
            </button>
          </div>

          {/* BARRA DE FILTROS + SELETOR DESIGNER DE MÊS E ANO */}
          <div className="table-filter-bar">
            
            {/* BUSCA RÁPIDA */}
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por descrição, categoria ou forma..." 
                value={busca} 
                onChange={e => setBusca(e.target.value)} 
              />
              {busca && (
                <button className="btn-clear-search" onClick={() => setBusca('')}>✕</button>
              )}
            </div>

            {/* 🗓️ SELETOR DE MÊS E ANO DELICADO */}
            <div className="fin-mes-selector-wrapper">
              <div className="fin-selects-row">
                <select 
                  className="fin-select-custom" 
                  value={filtroMes} 
                  onChange={e => setFiltroMes(e.target.value)}
                  title="Selecionar Mês"
                >
                  <option value="">📅 Mês: Todos</option>
                  {nomesMeses.map(m => (
                    <option key={m.num} value={m.num}>📅 Mês: {m.nome}</option>
                  ))}
                </select>

                <select 
                  className="fin-select-custom" 
                  value={filtroAno} 
                  onChange={e => setFiltroAno(e.target.value)}
                  title="Selecionar Ano"
                >
                  <option value="">📆 Ano: Todos</option>
                  <option value="2024">📆 Ano: 2024</option>
                  <option value="2025">📆 Ano: 2025</option>
                  <option value="2026">📆 Ano: 2026</option>
                  <option value="2027">📆 Ano: 2027</option>
                  <option value="2028">📆 Ano: 2028</option>
                </select>
              </div>

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
                  Histórico
                </button>
              </div>
            </div>

          </div>

          {/* 💻 VISUALIZAÇÃO DESKTOP: TABELA COMPLETA PRO-TABLE */}
          <div className="table-responsive-wrapper fin-desktop-table-view">
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
                        <td className="td-data">
                          {t.data ? new Date(t.data + "T12:00").toLocaleDateString('pt-BR') : '—'}
                        </td>
                        
                        <td className="td-categoria">
                          {renderBadgeCategoria(t.categoria, t.tipo)}
                        </td>
                        
                        <td className="td-item-info">
                          <strong className="nome-produto">{t.descricao}</strong>
                          {renderChipsVinculo(t)}
                        </td>
                        
                        <td className="td-forma-pagto">
                          <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '600' }}>
                            {t.formaPagto || '---'}
                          </span>
                        </td>

                        <td className="td-comprovante" style={{ textAlign: 'center' }}>
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

                        <td className="td-valor" style={{ textAlign: 'right' }}>
                          <div className={`preco-real ${isEntrada ? 'txt-verde' : 'txt-vermelho'}`}>
                            {isEntrada ? '+ ' : '- '}
                            R$ {Number(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </td>

                        <td className="td-status" style={{ textAlign: 'center' }}>
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

          {/* 📱 VISUALIZAÇÃO MOBILE: CARD ESTRUTURADO (CATEGORIA, DATA, DESPESA OU NÃO, ITEM E VER MAIS) */}
          <div className="fin-mobile-cards-view">
            {loading ? (
              <div className="fin-empty-mobile">Carregando lançamentos...</div>
            ) : transacoesFiltradas.length === 0 ? (
              <div className="fin-empty-mobile">
                Nenhum registro encontrado para este período.
              </div>
            ) : (
              transacoesFiltradas.map((t) => {
                const isEntrada = t.tipo === 'entrada';
                const isPendente = t.status === 'pendente';
                const isAberto = cardDetalheAberto === t.id;

                return (
                  <div key={t.id} className={`fin-mobile-card ${isAberto ? 'card-expanded' : ''}`}>
                    {/* 1. TOPO: CATEGORIA (ESQUERDA) + SE É DESPESA/RECEITA E VALOR (DIREITA) */}
                    <div className="fin-mcard-top-row">
                      <div className="fin-mcard-cat-box">
                        {renderBadgeCategoria(t.categoria, t.tipo)}
                      </div>
                      <span className={`fin-natureza-pill ${isEntrada ? 'natureza-entrada' : 'natureza-despesa'}`}>
                        {isEntrada ? '🟢 Entrada: + ' : '🔴 Despesa: - '}
                        R$ {Number(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* 2. DATA DO LANÇAMENTO */}
                    <div className="fin-mcard-date-line">
                      <span className="fin-mcard-data-badge">
                        📅 {t.data ? new Date(t.data + "T12:00").toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </div>

                    {/* 3. ITEM COMPRADO / DESCRIÇÃO COM CHIPS */}
                    <div className="fin-mcard-item-box">
                      <span className="fin-mcard-item-title">{t.descricao}</span>
                      {renderChipsVinculo(t)}
                    </div>

                    {/* 4. RODAPÉ COM BOTÃO VER MAIS E LIXEIRA */}
                    <div className="fin-mcard-footer-row">
                      <button
                        type="button"
                        className={`btn-mcard-toggle-details ${isAberto ? 'active' : ''}`}
                        onClick={() => toggleDetalhes(t.id)}
                      >
                        {isAberto ? '▲ Menos detalhes' : '▼ Ver mais'}
                      </button>

                      <button 
                        className="action-btn delete" 
                        title="Excluir Lançamento" 
                        onClick={() => handleExcluirLancamento(t)}
                      >
                        🗑️
                      </button>
                    </div>

                    {/* 5. GAVETA DE DETALHES (FORMA DE PAGTO, SITUAÇÃO, COMPROVANTE, QUITAR) */}
                    {isAberto && (
                      <div className="fin-mcard-drawer fade-in">
                        <div className="fin-drawer-row">
                          <span className="fin-drawer-label">FORMA DE PAGAMENTO:</span>
                          <span className="fin-drawer-val">{t.formaPagto || 'Não informada'}</span>
                        </div>

                        <div className="fin-drawer-row">
                          <span className="fin-drawer-label">SITUAÇÃO:</span>
                          <span className={`badge ${isPendente ? 'pendente' : 'comprado'}`}>
                            {isPendente ? 'Pendente' : 'Pago'}
                          </span>
                        </div>

                        {isPendente && (
                          <div className="fin-drawer-row">
                            <span className="fin-drawer-label">BAIXA:</span>
                            <button 
                              type="button"
                              className="action-btn quit-btn" 
                              onClick={() => handleQuitarLancamento(t)}
                            >
                              ✅ Quitar Lançamento
                            </button>
                          </div>
                        )}

                        <div className="fin-drawer-row">
                          <span className="fin-drawer-label">COMPROVANTE:</span>
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
                              📎 Ver Anexo
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Sem anexo</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ABA: DRE GERENCIAL (DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO) */}
      {abaAtiva === 'dre-gerencial' && (
        <div className="table-card-container fade-in">
          {(() => {
            const dre = calcularDRE();
            return (
              <div>
                {/* BARRA DE FILTRO DE PERÍODO DRE */}
                <div className="table-filter-bar dre-filter-bar">
                  <div className="dre-header-info">
                    <span className="dre-header-badge">📈 DRE Gerencial</span>
                    <span className="dre-periodo-tag">
                      {filtroMes ? `${nomesMeses.find(m => m.num === filtroMes)?.nome} / ${filtroAno || anoAtualNum}` : 'Histórico Consolidado'}
                    </span>
                  </div>

                  <div className="fin-mes-selector-wrapper">
                    <div className="fin-selects-row">
                      <select 
                        className="fin-select-custom" 
                        value={filtroMes} 
                        onChange={e => setFiltroMes(e.target.value)}
                        title="Selecionar Mês"
                      >
                        <option value="">📅 Mês: Todos</option>
                        {nomesMeses.map(m => (
                          <option key={m.num} value={m.num}>📅 Mês: {m.nome}</option>
                        ))}
                      </select>

                      <select 
                        className="fin-select-custom" 
                        value={filtroAno} 
                        onChange={e => setFiltroAno(e.target.value)}
                        title="Selecionar Ano"
                      >
                        <option value="">📆 Ano: Todos</option>
                        <option value="2024">📆 Ano: 2024</option>
                        <option value="2025">📆 Ano: 2025</option>
                        <option value="2026">📆 Ano: 2026</option>
                        <option value="2027">📆 Ano: 2027</option>
                        <option value="2028">📆 Ano: 2028</option>
                      </select>
                    </div>

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
                        className={`btn-date-quick ${!filtroMes && !filtroAno ? 'active' : ''}`}
                        onClick={() => setFiltroMesPredefinido('todos')}
                      >
                        Histórico Geral
                      </button>
                    </div>
                  </div>

                  <button type="button" className="btn-export-excel btn-export-dre" onClick={handleExportarDRE}>
                    📥 Exportar DRE
                  </button>
                </div>

                {/* TABELA ESTRUTURADA DE DRE CONTÁBIL */}
                <div className="fin-table-scroll-wrapper dre-scroll-card">
                  <table className="dre-table-vip">
                    <thead>
                      <tr>
                        <th>Demonstrativo Contábil (DRE)</th>
                        <th className="text-right">Valor (R$)</th>
                        <th className="text-right">% Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* SEÇÃO 1: RECEITA BRUTA */}
                      <tr className="dre-row-section dre-row-receita">
                        <td className="dre-col-desc">
                          <div className="dre-item-flex">
                            <span className="dre-tag-op tag-pos">(+)</span>
                            <strong>1. RECEITA OPERACIONAL BRUTA</strong>
                          </div>
                          <small className="dre-sub-desc">Locações & Eventos realizados no período</small>
                        </td>
                        <td className="dre-col-val val-pos">
                          <span className="dre-val-num">R$ {dre.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-pos">100.0% da receita</span>
                        </td>
                        <td className="dre-col-pct">
                          <span className="dre-pct-pill pill-pos">100.0%</span>
                        </td>
                      </tr>

                      {/* SEÇÃO 2: CUSTOS DIRETOS */}
                      <tr className="dre-row-sub">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Aquisição de Acervo & Peças para Estoque</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {dre.custosAquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.custosAquisicao / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? ((dre.custosAquisicao / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      <tr className="dre-row-sub">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Insumos, Materiais & Embalagens</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {dre.custosInsumos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.custosInsumos / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? ((dre.custosInsumos / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      <tr className="dre-row-sub border-group-end">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Manutenção & Reparos do Acervo</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {dre.custosManutencao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.custosManutencao / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? ((dre.custosManutencao / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      {/* TOTAL MARGEM DE CONTRIBUIÇÃO */}
                      <tr className="dre-row-total dre-row-margem">
                        <td className="dre-col-desc">
                          <div className="dre-item-flex">
                            <span className="dre-tag-op tag-eq">(=)</span>
                            <strong>MARGEM DE CONTRIBUIÇÃO / LUCRO BRUTO</strong>
                          </div>
                          <small className="dre-sub-desc">Receita líquida disponível após custos diretos</small>
                        </td>
                        <td className={`dre-col-val ${dre.margemContribuicao >= 0 ? 'val-pos' : 'val-neg'}`}>
                          <span className="dre-val-num">R$ {dre.margemContribuicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.margemContribuicao / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          <span className="dre-pct-pill pill-neutral">
                            {dre.receitaBruta > 0 ? ((dre.margemContribuicao / dre.receitaBruta) * 100).toFixed(1) : 0}%
                          </span>
                        </td>
                      </tr>

                      {/* SEÇÃO 3: DESPESAS OPERACIONAIS FIXAS */}
                      <tr className="dre-row-sub">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Equipe & Pessoal (Salários, Diárias, Pró-Labore)</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {dre.despesasEquipe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.despesasEquipe / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? ((dre.despesasEquipe / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      <tr className="dre-row-sub">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Despesas Prediais (Aluguel, Luz, Água, Internet)</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {dre.despesasFixasPredio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.despesasFixasPredio / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? ((dre.despesasFixasPredio / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      <tr className="dre-row-sub">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Marketing, Anúncios & Vendas</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {dre.despesasMarketing.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.despesasMarketing / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? ((dre.despesasMarketing / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      <tr className="dre-row-sub">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Impostos, Taxas Fiscais & Contabilidade</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {dre.despesasImpostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? ((dre.despesasImpostos / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? ((dre.despesasImpostos / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      <tr className="dre-row-sub border-group-end">
                        <td className="dre-col-desc pl-indent">
                          <span className="dre-bullet">•</span>
                          <span>Taxas Bancárias, Maquininhas & Outros</span>
                        </td>
                        <td className="dre-col-val val-neg">
                          <span className="dre-val-num">- R$ {(dre.despesasTaxas + dre.despesasOutras).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="dre-pct-mobile pill-neutral">{dre.receitaBruta > 0 ? (((dre.despesasTaxas + dre.despesasOutras) / dre.receitaBruta) * 100).toFixed(1) : 0}% s/ receita</span>
                        </td>
                        <td className="dre-col-pct">
                          {dre.receitaBruta > 0 ? (((dre.despesasTaxas + dre.despesasOutras) / dre.receitaBruta) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>

                      {/* RESULTADO FINAL / LUCRO LÍQUIDO */}
                      <tr className={`dre-row-final ${dre.resultadoLiquido >= 0 ? 'dre-final-lucro' : 'dre-final-prejuizo'}`}>
                        <td className="dre-col-desc">
                          <div className="dre-item-flex">
                            <span className="dre-tag-op tag-final">{dre.resultadoLiquido >= 0 ? '🏆' : '⚠️'} (=)</span>
                            <strong>RESULTADO / LUCRO LÍQUIDO DO EXERCÍCIO</strong>
                          </div>
                          <small className="dre-sub-desc">Resultado contábil final apurado para o período</small>
                        </td>
                        <td className={`dre-col-val ${dre.resultadoLiquido >= 0 ? 'val-lucro-final' : 'val-prejuizo-final'}`}>
                          <span className="dre-val-num">R$ {dre.resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className={`dre-pct-mobile ${dre.resultadoLiquido >= 0 ? 'badge-lucro' : 'badge-prejuizo'}`}>
                            {dre.margemLiquidaPct.toFixed(1)}% Margem Líquida
                          </span>
                        </td>
                        <td className="dre-col-pct">
                          <span className={`dre-pct-badge ${dre.resultadoLiquido >= 0 ? 'badge-lucro' : 'badge-prejuizo'}`}>
                            {dre.margemLiquidaPct.toFixed(1)}% Margem
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ABA: FLUXO DE CAIXA PROJETADO (30 E 60 DIAS) */}
      {abaAtiva === 'fluxo-projetado' && (
        <div className="table-card-container fade-in">
          {(() => {
            const proj = calcularFluxoProjetado();
            return (
              <div>
                {/* CABEÇALHO DA PROJEÇÃO */}
                <div className="table-filter-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🔮</span>
                    <strong className="fin-proj-section-title">Fluxo de Caixa Futuro & Previsibilidade</strong>
                  </div>
                  <span className="fin-proj-section-sub">
                    Baseado em contratos ativos com saldo a receber e contas fixas cadastradas.
                  </span>
                </div>

                {/* 2 GRANDES CARDS DE PROJEÇÃO (RESPONSIVOS) */}
                <div className="fin-projecao-cards-grid">
                  
                  {/* CARD 30 DIAS */}
                  <div className="fin-proj-card card-30d">
                    <div className="fin-proj-card-header">
                      <span className="fin-proj-card-title">🔮 Projeção dos Próximos 30 Dias</span>
                      <span className="fin-proj-badge">{proj.locacoesFuturas30.length} festas agendadas</span>
                    </div>

                    <div className="fin-proj-card-body">
                      <div className="fin-proj-card-row">
                        <span className="fin-proj-row-label">Entradas de Contratos a Receber:</span>
                        <strong className="fin-proj-val-pos">+ R$ {proj.entradasPrevistas30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="fin-proj-card-row">
                        <span className="fin-proj-row-label">Contas Fixas a Vencer no Mês:</span>
                        <strong className="fin-proj-val-neg">- R$ {proj.saidasPrevistas30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    <div className="fin-proj-card-footer">
                      <span className="fin-proj-footer-label">Saldo Projetado em Caixa (30d):</span>
                      <strong className={`fin-proj-total ${proj.saldoProjetado30 >= 0 ? 'pos' : 'neg'}`}>
                        R$ {proj.saldoProjetado30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  {/* CARD 60 DIAS */}
                  <div className="fin-proj-card card-60d">
                    <div className="fin-proj-card-header">
                      <span className="fin-proj-card-title">🚀 Projeção Acumulada 60 Dias</span>
                      <span className="fin-proj-badge">{proj.locacoesFuturas30.length + proj.locacoesFuturas60.length} festas no horizonte</span>
                    </div>

                    <div className="fin-proj-card-body">
                      <div className="fin-proj-card-row">
                        <span className="fin-proj-row-label">Total de Entradas em 60 dias:</span>
                        <strong className="fin-proj-val-pos">+ R$ {(proj.entradasPrevistas30 + proj.entradasPrevistas60).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="fin-proj-card-row">
                        <span className="fin-proj-row-label">Contas Fixas dos 2 meses:</span>
                        <strong className="fin-proj-val-neg">- R$ {proj.saidasPrevistas60.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    <div className="fin-proj-card-footer">
                      <span className="fin-proj-footer-label">Saldo Projetado em Caixa (60d):</span>
                      <strong className={`fin-proj-total ${proj.saldoProjetado60 >= 0 ? 'pos' : 'neg'}`}>
                        R$ {proj.saldoProjetado60.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                </div>

                {/* LISTA DE CONTRATOS COM SALDO A RECEBER */}
                <div className="fin-table-scroll-wrapper">
                  <div className="fin-table-header-bar">
                    <strong className="fin-table-header-title">📅 Contratos com Saldo a Receber nos Próximos 60 Dias</strong>
                    <span className="fin-table-header-sub">{proj.locacoesFuturas30.length + proj.locacoesFuturas60.length} pedidos pendentes</span>
                  </div>

                  {proj.locacoesFuturas30.length + proj.locacoesFuturas60.length === 0 ? (
                    <div className="fin-table-empty">
                      ✨ Todos os contratos futuros já foram 100% quitados ou não há novos pedidos agendados no período!
                    </div>
                  ) : (
                    <table className="pro-table fin-proj-table">
                      <thead>
                        <tr>
                          <th>Data Prevista</th>
                          <th>Pedido / Cliente</th>
                          <th style={{ textAlign: 'right' }}>Total do Contrato</th>
                          <th style={{ textAlign: 'right' }}>Já Pago</th>
                          <th style={{ textAlign: 'right' }}>Saldo a Receber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...proj.locacoesFuturas30, ...proj.locacoesFuturas60].map((loc, idx) => (
                          <tr key={idx}>
                            <td className="td-data">
                              📅 {new Date(loc.dataRef + "T12:00").toLocaleDateString('pt-BR')}
                            </td>
                            <td>
                              <strong>#{loc.numeroPedido || loc.id.slice(0,6)}</strong> · {loc.clienteNome}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              R$ {Number(loc.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', color: '#16a34a' }}>
                              R$ {Number(loc.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '850', color: '#dc2626' }}>
                              R$ {loc.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ABA 2: GALERIA VIP DE COMPROVANTES RECEBIDOS */}
      {abaAtiva === 'comprovantes' && (
        <div className="table-card-container fade-in">
          
          {/* BARRA DE FILTROS DA GALERIA DE COMPROVANTES (DESIGN HARMONIOSO & ALINHADO) */}
          <div className="table-filter-bar">
            {/* BUSCA RÁPIDA */}
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por cliente, pedido, valor ou arquivo..." 
                value={buscaComprovante}
                onChange={e => setBuscaComprovante(e.target.value)}
              />
              {buscaComprovante && (
                <button className="btn-clear-search" onClick={() => setBuscaComprovante('')}>✕</button>
              )}
            </div>

            {/* SELETORES MÊS, ANO E FORMA */}
            <div className="fin-mes-selector-wrapper">
              <select 
                className="fin-select-custom fin-select-full"
                value={filtroForma}
                onChange={(e) => setFiltroForma(e.target.value)}
                title="Filtrar Forma de Pagamento"
              >
                <option value="todas">💳 Forma: Todas</option>
                <option value="Pix">⚡ Pix</option>
                <option value="Dinheiro">💵 Dinheiro</option>
                <option value="Cartão">💳 Cartão</option>
                <option value="Boleto">📄 Boleto</option>
                <option value="Transferência">🏦 Transferência</option>
              </select>

              <div className="fin-selects-row">
                <select 
                  className="fin-select-custom" 
                  value={filtroMes} 
                  onChange={e => setFiltroMes(e.target.value)}
                  title="Selecionar Mês"
                >
                  <option value="">📅 Mês: Todos</option>
                  {nomesMeses.map(m => (
                    <option key={m.num} value={m.num}>📅 Mês: {m.nome}</option>
                  ))}
                </select>

                <select 
                  className="fin-select-custom" 
                  value={filtroAno} 
                  onChange={e => setFiltroAno(e.target.value)}
                  title="Selecionar Ano"
                >
                  <option value="">📆 Ano: Todos</option>
                  <option value="2024">📆 Ano: 2024</option>
                  <option value="2025">📆 Ano: 2025</option>
                  <option value="2026">📆 Ano: 2026</option>
                  <option value="2027">📆 Ano: 2027</option>
                  <option value="2028">📆 Ano: 2028</option>
                </select>
              </div>

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
                  className={`btn-date-quick ${!filtroMes && !filtroAno ? 'active' : ''}`}
                  onClick={() => setFiltroMesPredefinido('todos')}
                >
                  Histórico
                </button>
              </div>
            </div>
          </div>

          {/* KPI RESUMO + SELETOR DE MODO (GRADE / LISTA) */}
          <div className="comprovantes-summary-bar">
            <div className="comp-sum-left">
              <span className="comp-sum-count">
                📎 <strong>{comprovantesFiltrados.length}</strong> {comprovantesFiltrados.length === 1 ? 'comprovante' : 'comprovantes'}
              </span>
              <span className="comp-sum-divider">•</span>
              <span className="comp-sum-total">
                Total: <strong>R$ {comprovantesFiltrados.reduce((acc, c) => acc + (Number(c.valor) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>

            <div className="comp-view-toggle">
              <button 
                type="button" 
                className={`btn-view-toggle ${modoVisualizacaoComprovantes === 'grid' ? 'active' : ''}`}
                onClick={() => setModoVisualizacaoComprovantes('grid')}
                title="Visualização em Grade com Fotos"
              >
                ⊞ Grade
              </button>
              <button 
                type="button" 
                className={`btn-view-toggle ${modoVisualizacaoComprovantes === 'lista' ? 'active' : ''}`}
                onClick={() => setModoVisualizacaoComprovantes('lista')}
                title="Visualização em Lista sem Fotos"
              >
                ☰ Lista
              </button>
            </div>
          </div>

          {comprovantesFiltrados.length === 0 ? (
            <div className="empty-comprovantes-card">
              <div className="empty-icon-box">📎</div>
              <h3>Nenhum comprovante anexado no período</h3>
              <p>Assim que um recebimento for registrado com anexo de comprovante, ele surgirá aqui automaticamente.</p>
            </div>
          ) : modoVisualizacaoComprovantes === 'grid' ? (
            /* 🖼️ MODO GRADE VIP DE COMPROVANTES (COM FOTO) */
            <div className="grid-comprovantes-vip fade-in">
              {comprovantesFiltrados.map((item, idx) => {
                const isImg = item.comprovanteUrl.startsWith('data:image') || item.comprovanteUrl.match(/\.(jpeg|jpg|png|webp)/i);
                return (
                  <div key={item.id || idx} className="comp-vip-card fade-in">
                    {/* TOPO DO CARD */}
                    <div className="comp-vip-header">
                      <span className="comp-vip-badge-forma">
                        {item.formaPagto.toLowerCase().includes('pix') ? '⚡ ' : item.formaPagto.toLowerCase().includes('cart') ? '💳 ' : item.formaPagto.toLowerCase().includes('bol') ? '📄 ' : '💵 '}
                        {item.formaPagto}
                      </span>
                      <span className="comp-vip-badge-origem">{item.origem}</span>
                    </div>

                    {/* PREVIEW DA IMAGEM / DOCUMENTO */}
                    <div 
                      className="comp-vip-thumb-wrapper"
                      onClick={() => setComprovanteModal(item)}
                      title="Clique para visualizar em tela cheia"
                    >
                      {isImg ? (
                        <img src={item.comprovanteUrl} alt={item.titulo} className="comp-vip-img" />
                      ) : (
                        <div className="comp-vip-pdf-box">
                          <span style={{ fontSize: '28px' }}>📄</span>
                          <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>Documento PDF</span>
                        </div>
                      )}
                      <div className="comp-vip-hover-overlay">
                        <span>🔍 Visualizar</span>
                      </div>
                    </div>

                    {/* CORPO DO CARD COM DADOS DO PEDIDO */}
                    <div className="comp-vip-body">
                      <span className="comp-vip-date">
                        📅 {item.data ? new Date(item.data + "T12:00").toLocaleDateString('pt-BR') : '—'}
                      </span>
                      <h4 className="comp-vip-title" title={item.titulo}>{item.titulo}</h4>
                      {item.clienteNome && item.clienteNome !== item.titulo && (
                        <span className="comp-vip-client">👤 {item.clienteNome}</span>
                      )}
                      <div className="comp-vip-price-box">
                        <span className="comp-vip-price-label">Valor:</span>
                        <strong className="comp-vip-price-val">
                          R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>

                    {/* RODAPÉ DE AÇÕES RÁPIDAS */}
                    <div className="comp-vip-footer">
                      <button 
                        type="button" 
                        className="btn-vip-action ver"
                        onClick={() => setComprovanteModal(item)}
                      >
                        👁️ Ver Comprovante
                      </button>
                      <button 
                        type="button" 
                        className="btn-vip-action baixar"
                        onClick={(e) => handleDownloadComprovante(item, e)}
                        title="Baixar arquivo"
                      >
                        ⬇️ Baixar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 📋 MODO LISTA LIMPA (SEM FOTO) */
            <div className="comp-lista-view fade-in">
              {/* DESKTOP TABLE */}
              <div className="comp-lista-desktop">
                <table className="tabela-comprovantes-clean">
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>DATA</th>
                      <th style={{ width: '220px' }}>PEDIDO / DESCRIÇÃO</th>
                      <th>CLIENTE / FAVORECIDO</th>
                      <th style={{ width: '120px' }}>FORMA</th>
                      <th style={{ width: '130px' }}>ORIGEM</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>VALOR</th>
                      <th style={{ width: '210px', textAlign: 'center' }}>AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprovantesFiltrados.map((item, idx) => (
                      <tr key={item.id || idx} className="tr-comp-clean">
                        <td className="td-comp-date">
                          📅 {item.data ? new Date(item.data + "T12:00").toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="td-comp-desc">
                          <strong>{item.titulo}</strong>
                        </td>
                        <td className="td-comp-client">
                          {item.clienteNome ? item.clienteNome : '—'}
                        </td>
                        <td className="td-comp-forma">
                          <span className="badge-comp-forma">
                            {item.formaPagto.toLowerCase().includes('pix') ? '⚡ ' : item.formaPagto.toLowerCase().includes('cart') ? '💳 ' : item.formaPagto.toLowerCase().includes('bol') ? '📄 ' : '💵 '}
                            {item.formaPagto}
                          </span>
                        </td>
                        <td className="td-comp-origem">
                          <span className={`badge-comp-origem ${item.origem.toLowerCase().includes('loc') ? 'loc' : item.origem.toLowerCase().includes('comp') ? 'comp' : 'caixa'}`}>
                            {item.origem}
                          </span>
                        </td>
                        <td className="td-comp-val">
                          R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="td-comp-actions">
                          <div className="comp-actions-group">
                            <button 
                              type="button" 
                              className="btn-clean-act ver"
                              onClick={() => setComprovanteModal(item)}
                              title="Visualizar comprovante"
                            >
                              👁️ Ver
                            </button>
                            <button 
                              type="button" 
                              className="btn-clean-act baixar"
                              onClick={(e) => handleDownloadComprovante(item, e)}
                              title="Baixar comprovante"
                            >
                              ⬇️ Baixar
                            </button>
                            <button 
                              type="button" 
                              className="btn-clean-act imprimir"
                              onClick={(e) => handleImprimirComprovante(item, e)}
                              title="Imprimir comprovante"
                            >
                              🖨️ Imprimir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}
              <div className="comp-lista-mobile">
                {comprovantesFiltrados.map((item, idx) => (
                  <div key={item.id || idx} className="comp-lista-mobile-card">
                    <div className="comp-lcard-header">
                      <span className="badge-comp-forma">{item.formaPagto}</span>
                      <strong className="comp-lcard-val">
                        R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="comp-lcard-body">
                      <h4 className="comp-lcard-title">{item.titulo}</h4>
                      {item.clienteNome && item.clienteNome !== item.titulo && (
                        <span className="comp-lcard-client">👤 {item.clienteNome}</span>
                      )}
                      <div className="comp-lcard-meta">
                        <span>📅 {item.data ? new Date(item.data + "T12:00").toLocaleDateString('pt-BR') : '—'}</span>
                        <span>•</span>
                        <span>{item.origem}</span>
                      </div>
                    </div>

                    <div className="comp-lcard-actions">
                      <button 
                        type="button" 
                        className="btn-mcard-act ver"
                        onClick={() => setComprovanteModal(item)}
                      >
                        👁️ Ver
                      </button>
                      <button 
                        type="button" 
                        className="btn-mcard-act baixar"
                        onClick={(e) => handleDownloadComprovante(item, e)}
                      >
                        ⬇️ Baixar
                      </button>
                      <button 
                        type="button" 
                        className="btn-mcard-act imprimir"
                        onClick={(e) => handleImprimirComprovante(item, e)}
                      >
                        🖨️ Imprimir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: CONTAS FIXAS & DESPESAS RECORRENTES */}
      {abaAtiva === 'contas-fixas' && (
        <div className="fade-in">
          {/* MODAL DE CADASTRO / EDIÇÃO DE CONTA FIXA (PORTAL PARA O BODY) */}
          {formContaFixaAberto && createPortal(
            <div className="modal-cf-overlay fade-in" onClick={() => setFormContaFixaAberto(false)}>
              <div className="modal-cf-box" onClick={e => e.stopPropagation()}>
                
                {/* CABEÇALHO DO MODAL */}
                <div className="modal-cf-header">
                  <div className="modal-cf-header-left">
                    <div className="modal-cf-icon-badge">
                      {editandoContaId ? '✏️' : '🏢'}
                    </div>
                    <div>
                      <h3 className="modal-cf-title">
                        {editandoContaId ? `Editar Conta Fixa` : 'Cadastrar Nova Conta Fixa'}
                      </h3>
                      <p className="modal-cf-subtitle">
                        {editandoContaId ? `Alterando dados de "${formContaFixa.descricao}"` : 'Previsibilidade de despesas mensais e folha de pagamento.'}
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="modal-cf-close-btn"
                    onClick={() => setFormContaFixaAberto(false)}
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>

                {/* FORMULÁRIO DO MODAL */}
                <form onSubmit={handleSalvarContaFixa}>
                  <div className="modal-cf-body">
                    
                    {/* LINHA 1: DESCRIÇÃO / FAVORECIDO */}
                    <div className="modal-cf-field">
                      <label className="modal-cf-label">
                        Favorecido / Nome da Despesa ou Funcionário <span className="req">*</span>
                      </label>
                      <div className="modal-cf-input-wrap">
                        <span className="modal-cf-input-icon">👤</span>
                        <input 
                          type="text" 
                          required 
                          autoFocus
                          placeholder="Ex: Salário Maria - Atendente, Aluguel Galpão, Internet..." 
                          value={formContaFixa.descricao}
                          onChange={e => setFormContaFixa({ ...formContaFixa, descricao: e.target.value })}
                          className="modal-cf-input has-icon"
                        />
                      </div>
                    </div>

                    {/* LINHA 2: CATEGORIA + FORMA DE PAGAMENTO (2 COLUNAS) */}
                    <div className="modal-cf-grid-2">
                      <div className="modal-cf-field">
                        <label className="modal-cf-label">
                          Categoria <span className="req">*</span>
                        </label>
                        <select 
                          value={formContaFixa.categoria}
                          onChange={e => setFormContaFixa({ ...formContaFixa, categoria: e.target.value })}
                          className="modal-cf-select"
                        >
                          {CATEGORIAS_FIXAS_CONFIG.map(cat => (
                            <option key={cat.valor} value={cat.valor}>{cat.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="modal-cf-field">
                        <label className="modal-cf-label">
                          Forma de Pagamento <span className="req">*</span>
                        </label>
                        <select 
                          value={formContaFixa.formaPagto}
                          onChange={e => setFormContaFixa({ ...formContaFixa, formaPagto: e.target.value })}
                          className="modal-cf-select"
                        >
                          <option value="Pix">⚡ Pix</option>
                          <option value="Boleto">📄 Boleto</option>
                          <option value="Cartão">💳 Cartão</option>
                          <option value="Dinheiro">💵 Dinheiro</option>
                          <option value="Transferência">🏦 Transferência</option>
                        </select>
                      </div>
                    </div>

                    {/* LINHA 3: VALOR ESTIMADO + DIA DE VENCIMENTO (2 COLUNAS) */}
                    <div className="modal-cf-grid-2">
                      <div className="modal-cf-field">
                        <label className="modal-cf-label">
                          Valor Mensal Estimado <span className="req">*</span>
                        </label>
                        <div className="modal-cf-input-wrap">
                          <span className="modal-cf-input-currency-badge">R$</span>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            required 
                            placeholder="0,00" 
                            value={formContaFixa.valorFormatado}
                            onChange={handleValorContaFixaChange}
                            className="modal-cf-input has-currency"
                          />
                        </div>
                      </div>

                      <div className="modal-cf-field">
                        <label className="modal-cf-label">
                          Dia de Vencimento <span className="req">*</span>
                        </label>
                        <div className="modal-cf-input-wrap">
                          <span className="modal-cf-input-icon">📅</span>
                          <input 
                            type="number" 
                            min="1" 
                            max="31" 
                            required 
                            placeholder="10" 
                            value={formContaFixa.diaVencimento}
                            onChange={e => setFormContaFixa({ ...formContaFixa, diaVencimento: e.target.value })}
                            className="modal-cf-input has-icon"
                          />
                        </div>
                      </div>
                    </div>

                    {/* LINHA 4: OBSERVAÇÕES / DETALHES */}
                    <div className="modal-cf-field">
                      <label className="modal-cf-label">
                        Observações / Chave Pix (Opcional)
                      </label>
                      <div className="modal-cf-input-wrap">
                        <span className="modal-cf-input-icon">📝</span>
                        <input 
                          type="text" 
                          placeholder="Ex: Chave Pix CNPJ, contrato até 2027, vencimento útil..." 
                          value={formContaFixa.observacoes}
                          onChange={e => setFormContaFixa({ ...formContaFixa, observacoes: e.target.value })}
                          className="modal-cf-input has-icon"
                        />
                      </div>
                    </div>

                  </div>

                  {/* RODAPÉ DO MODAL */}
                  <div className="modal-cf-footer">
                    <button 
                      type="button" 
                      className="btn-cf-modal-cancel"
                      onClick={() => setFormContaFixaAberto(false)}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="btn-cf-modal-save"
                      disabled={salvandoContaFixa}
                    >
                      {salvandoContaFixa ? '⏳ Gravando...' : editandoContaId ? '💾 Atualizar Conta' : '💾 Salvar Conta Fixa'}
                    </button>
                  </div>
                </form>

              </div>
            </div>,
            document.body
          )}

          <div className="table-card-container">
            {/* 🔥 BARRINHA DE SELEÇÃO RÁPIDA: CATEGORIAS */}
            <div className="fin-tipo-toggle-bar">
              <button 
                type="button" 
                className={`btn-tipo-pill ${filtroCategoriaFixa === 'todas' ? 'active' : ''}`}
                onClick={() => setFiltroCategoriaFixa('todas')}
              >
                📊 Todas ({despesasRecorrentes.length})
              </button>

              <button 
                type="button" 
                className={`btn-tipo-pill entrada ${filtroCategoriaFixa === 'Equipe e Pessoal' ? 'active' : ''}`}
                onClick={() => setFiltroCategoriaFixa('Equipe e Pessoal')}
              >
                👥 Equipe & Pessoal ({despesasRecorrentes.filter(c => c.categoria === 'Equipe e Pessoal').length})
              </button>

              <button 
                type="button" 
                className={`btn-tipo-pill saida ${filtroCategoriaFixa === 'Despesas Fixas' ? 'active' : ''}`}
                onClick={() => setFiltroCategoriaFixa('Despesas Fixas')}
              >
                🏢 Infraestrutura ({despesasRecorrentes.filter(c => c.categoria === 'Despesas Fixas').length})
              </button>

              <button 
                type="button" 
                className={`btn-tipo-pill pendente ${filtroCategoriaFixa === 'outros' ? 'active' : ''}`}
                onClick={() => setFiltroCategoriaFixa('outros')}
              >
                🛠️ Manutenção & Outros ({despesasRecorrentes.filter(c => c.categoria !== 'Equipe e Pessoal' && c.categoria !== 'Despesas Fixas').length})
              </button>
            </div>

            {/* BARRA DE FILTROS + SELETOR DE MÊS/ANO */}
            <div className="table-filter-bar">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Buscar por descrição, categoria ou forma..." 
                  value={busca} 
                  onChange={e => setBusca(e.target.value)} 
                />
                {busca && (
                  <button className="btn-clear-search" onClick={() => setBusca('')}>✕</button>
                )}
              </div>

              <div className="fin-mes-selector-wrapper">
                <div className="fin-selects-row">
                  <select 
                    className="fin-select-custom" 
                    value={filtroMes} 
                    onChange={e => setFiltroMes(e.target.value)}
                    title="Selecionar Mês"
                  >
                    <option value="">📅 Mês: Todos</option>
                    {nomesMeses.map(m => (
                      <option key={m.num} value={m.num}>📅 Mês: {m.nome}</option>
                    ))}
                  </select>

                  <select 
                    className="fin-select-custom" 
                    value={filtroAno} 
                    onChange={e => setFiltroAno(e.target.value)}
                    title="Selecionar Ano"
                  >
                    <option value="">📆 Ano: Todos</option>
                    <option value="2024">📆 Ano: 2024</option>
                    <option value="2025">📆 Ano: 2025</option>
                    <option value="2026">📆 Ano: 2026</option>
                    <option value="2027">📆 Ano: 2027</option>
                    <option value="2028">📆 Ano: 2028</option>
                  </select>
                </div>

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
                    Histórico
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-lancar-inline"
                  onClick={handleLancarTodasContasFixasDoMes}
                  disabled={lancandoContasFixasLote || despesasRecorrentes.length === 0}
                  title={`Lançar todas as contas fixas no caixa`}
                >
                  {lancandoContasFixasLote ? '⏳ Lançando...' : `⚡ Lançar no Caixa`}
                </button>
              </div>
            </div>

            {/* TABELA PRO-TABLE */}
            <div className="table-responsive-wrapper fin-desktop-table-view">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th style={{ width: '100px' }}>DIA</th>
                    <th style={{ width: '150px' }}>CATEGORIA</th>
                    <th style={{ minWidth: '180px' }}>DESCRIÇÃO</th>
                    <th style={{ width: '130px' }}>FORMA PAGTO</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>VALOR (R$)</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>SITUAÇÃO</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                        Carregando contas fixas...
                      </td>
                    </tr>
                  ) : contasFixasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏢</div>
                        <strong>Nenhuma conta fixa encontrada</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem' }}>
                          Clique no botão "+ CADASTRAR NOVA CONTA" acima para adicionar custos fixos e salários.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    contasFixasFiltradas.map((item) => {
                      const mesAnoAlvo = `${filtroAno || anoAtualNum}-${filtroMes || mesAtualNum}`;
                      const jaLancado = transacoes.some(t => 
                        t.tipo === 'saida' &&
                        (t.descricao || '').toLowerCase() === item.descricao.toLowerCase() &&
                        (t.data || '').startsWith(mesAnoAlvo)
                      );

                      const catObj = CATEGORIAS_FIXAS_CONFIG.find(c => c.valor === item.categoria) || CATEGORIAS_FIXAS_CONFIG[0];

                      return (
                        <tr key={item.id}>
                          <td className="td-data">
                            <span className="cf-dia-badge">
                              📅 Dia {item.diaVencimento || 10}
                            </span>
                          </td>

                          <td className="td-categoria">
                            <span 
                              className="badge-categoria saida"
                              style={{ color: catObj.cor, background: catObj.bg, borderColor: catObj.border }}
                            >
                              {catObj.label.split('(')[0].trim()}
                            </span>
                          </td>

                          <td className="td-item-info">
                            <strong className="nome-produto">{item.descricao}</strong>
                            {item.observacoes && (
                              <span className="cf-row-sub">{item.observacoes}</span>
                            )}
                          </td>

                          <td className="td-forma-pagto">
                            <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '600' }}>
                              {item.formaPagto?.toLowerCase().includes('pix') ? '⚡ ' : item.formaPagto?.toLowerCase().includes('cart') ? '💳 ' : item.formaPagto?.toLowerCase().includes('bol') ? '📄 ' : '💵 '}
                              {item.formaPagto || 'Pix'}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: '750' }}>
                              - R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </strong>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            {jaLancado ? (
                              <span className="badge-status pago" style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '800', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', display: 'inline-block' }}>
                                PAGO
                              </span>
                            ) : (
                              <span className="badge-status pendente" style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '800', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', display: 'inline-block' }}>
                                PENDENTE
                              </span>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div className="td-actions" style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
                              {!jaLancado && (
                                <button 
                                  type="button" 
                                  className="btn-action-view"
                                  onClick={() => handleLancarContaFixaIndividual(item)}
                                  title="Lançar no fluxo de caixa"
                                  style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.70rem', fontWeight: '750', cursor: 'pointer' }}
                                >
                                  ⚡ Lançar
                                </button>
                              )}
                              <button 
                                type="button" 
                                className="btn-action-view"
                                onClick={() => handleEditarContaFixa(item)}
                                title="Editar conta"
                                style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '0.70rem', cursor: 'pointer' }}
                              >
                                ✏️
                              </button>
                              <button 
                                type="button" 
                                className="btn-action-delete"
                                onClick={() => handleExcluirContaFixa(item)}
                                title="Excluir conta"
                                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '6px', padding: '4px 8px', fontSize: '0.70rem', cursor: 'pointer' }}
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

            {/* MOBILE VIEW */}
            <div className="cf-cards-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  Carregando contas fixas...
                </div>
              ) : contasFixasFiltradas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 12px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>🏢</div>
                  <strong>Nenhuma conta fixa cadastrada</strong>
                </div>
              ) : (
                contasFixasFiltradas.map((item) => {
                  const mesAnoAlvo = `${filtroAno || anoAtualNum}-${filtroMes || mesAtualNum}`;
                  const jaLancado = transacoes.some(t => 
                    t.tipo === 'saida' &&
                    (t.descricao || '').toLowerCase() === item.descricao.toLowerCase() &&
                    (t.data || '').startsWith(mesAnoAlvo)
                  );
                  const catObj = CATEGORIAS_FIXAS_CONFIG.find(c => c.valor === item.categoria) || CATEGORIAS_FIXAS_CONFIG[0];

                  return (
                    <div key={item.id} className="cf-mobile-card">
                      <div className="cf-mcard-top">
                        <div className="cf-mcard-main-info">
                          <span className="cf-dia-badge">📅 Dia {item.diaVencimento || 10}</span>
                          <strong className="cf-mcard-title">{item.descricao}</strong>
                        </div>
                        <span className="cf-row-valor" style={{ color: '#dc2626', fontWeight: '800' }}>
                          - R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="cf-mcard-meta">
                        <span 
                          className="cf-cat-badge"
                          style={{ color: catObj.cor, background: catObj.bg, borderColor: catObj.border }}
                        >
                          {catObj.label.split('(')[0].trim()}
                        </span>
                        <span className="badge-comp-forma">{item.formaPagto || 'Pix'}</span>
                        {jaLancado ? (
                          <span className="cf-status-badge lancado">✅ Lançado no mês</span>
                        ) : (
                          <span className="cf-status-badge pendente">⏳ Pendente de lançamento</span>
                        )}
                      </div>

                      {item.observacoes && (
                        <div className="cf-mcard-obs">
                          📝 {item.observacoes}
                        </div>
                      )}

                      <div className="cf-mcard-actions">
                        {!jaLancado && (
                          <button 
                            type="button" 
                            className="btn-cf-action lancar full"
                            onClick={() => handleLancarContaFixaIndividual(item)}
                          >
                            ⚡ Lançar no Caixa
                          </button>
                        )}
                        <button 
                          type="button" 
                          className="btn-cf-action editar"
                          onClick={() => handleEditarContaFixa(item)}
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          type="button" 
                          className="btn-cf-action excluir"
                          onClick={() => handleExcluirContaFixa(item)}
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE AMPLIAÇÃO DO COMPROVANTE VIP (PORTAL PARA O BODY) */}
      {comprovanteModal && createPortal(
        <div className="modal-overlay-celebre fade-in" onClick={() => setComprovanteModal(null)}>
          <div className="modal-card-celebre modal-comprovante-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header-celebre" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '850', color: '#0f172a' }}>
                  📎 {comprovanteModal.titulo}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  📅 Data: {comprovanteModal.data ? new Date(comprovanteModal.data + "T12:00").toLocaleDateString('pt-BR') : '—'} &nbsp;|&nbsp; 
                  Forma: <strong>{comprovanteModal.formaPagto}</strong> &nbsp;|&nbsp; 
                  Valor: <strong style={{ color: '#166534' }}>R$ {Number(comprovanteModal.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
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

            <div className="body-comprovante-viewer" style={{ textAlign: 'center', background: '#0f172a', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', maxHeight: '68vh', overflowY: 'auto' }}>
              {comprovanteModal.comprovanteUrl.startsWith('data:image') || comprovanteModal.comprovanteUrl.match(/\.(jpeg|jpg|png|webp)/i) ? (
                <img src={comprovanteModal.comprovanteUrl} alt="Comprovante Ampliado" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '10px', objectFit: 'contain' }} />
              ) : (
                <iframe src={comprovanteModal.comprovanteUrl} title="Documento PDF" style={{ width: '100%', height: '500px', border: 'none', borderRadius: '10px', background: '#ffffff' }}></iframe>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => setComprovanteModal(null)}
                style={{ flex: '1 1 90px', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button 
                type="button" 
                onClick={(e) => handleDownloadComprovante(comprovanteModal, e)}
                style={{ flex: '1 1 120px', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                ⬇️ Baixar Arquivo
              </button>
              <button 
                type="button" 
                onClick={(e) => handleImprimirComprovante(comprovanteModal, e)}
                style={{ flex: '1 1 110px', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                🖨️ Imprimir
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const win = window.open();
                  if (win) {
                    win.document.write(`<title>${comprovanteModal.titulo}</title><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#0f172a;"><img src="${comprovanteModal.comprovanteUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
                  }
                }}
                style={{ flex: '1 1 130px', padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)' }}
              >
                🔗 Abrir em Nova Aba
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🏷️ MODAL DE DETALHES DO REGISTRO / VÍNCULO (POPUP RÁPIDO) */}
      {modalDetalhesRegistro && createPortal(
        <div className="modal-cf-overlay fade-in" onClick={() => setModalDetalhesRegistro(null)}>
          <div className="modal-cf-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', borderRadius: '20px', overflow: 'hidden' }}>
            
            {/* CABEÇALHO */}
            <div className="modal-cf-header" style={{ background: '#0f172a', color: '#ffffff', padding: '18px 24px' }}>
              <div className="modal-cf-header-left">
                <div className="modal-cf-icon-badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#fde68a' }}>
                  {modalDetalhesRegistro.tipo === 'locacao' ? '🔗' : modalDetalhesRegistro.tipo === 'cliente' ? '👤' : modalDetalhesRegistro.tipo === 'fornecedor' ? '🏢' : modalDetalhesRegistro.tipo === 'peca' ? '📦' : '🛒'}
                </div>
                <div>
                  <h3 className="modal-cf-title" style={{ color: '#fde68a', fontSize: '1.1rem', margin: 0 }}>
                    {modalDetalhesRegistro.titulo}
                  </h3>
                  <p className="modal-cf-subtitle" style={{ color: '#cbd5e1', fontSize: '0.75rem', margin: '2px 0 0 0' }}>
                    Vínculo direto com o registro no sistema
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-cf-close-btn" 
                onClick={() => setModalDetalhesRegistro(null)}
                style={{ color: '#ffffff', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* CONTEÚDO */}
            <div className="modal-cf-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {modalDetalhesRegistro.tipo === 'locacao' && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Número do Pedido: <strong style={{ color: '#0f172a' }}>#{modalDetalhesRegistro.numero || (modalDetalhesRegistro.id ? modalDetalhesRegistro.id.slice(0,6) : '')}</strong>
                  </div>
                  {modalDetalhesRegistro.cliente && (
                    <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                      Cliente: <strong>{modalDetalhesRegistro.cliente}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Valor do Lançamento: <strong style={{ color: '#16a34a' }}>R$ {Number(modalDetalhesRegistro.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Data: <strong>{modalDetalhesRegistro.data ? new Date(modalDetalhesRegistro.data + "T12:00").toLocaleDateString('pt-BR') : '-'}</strong>
                  </div>
                </div>
              )}

              {modalDetalhesRegistro.tipo === 'cliente' && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: '800' }}>👤 {modalDetalhesRegistro.nome}</div>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Movimentação no Caixa: <strong style={{ color: '#16a34a' }}>R$ {Number(modalDetalhesRegistro.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              )}

              {modalDetalhesRegistro.tipo === 'fornecedor' && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: '800' }}>🏢 {modalDetalhesRegistro.nome}</div>
                  {modalDetalhesRegistro.tel && (
                    <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                      Telefone / WhatsApp: <strong>{modalDetalhesRegistro.tel}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Valor Pago: <strong style={{ color: '#dc2626' }}>R$ {Number(modalDetalhesRegistro.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              )}

              {modalDetalhesRegistro.tipo === 'peca' && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: '800' }}>📦 {modalDetalhesRegistro.nome}</div>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Custo / Movimentação: <strong style={{ color: '#b45309' }}>R$ {Number(modalDetalhesRegistro.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              )}

              {modalDetalhesRegistro.tipo === 'compra' && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: '800' }}>🛒 Ordem de Compra</div>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Item / Descrição: <strong>{modalDetalhesRegistro.descricao}</strong>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Valor Pago: <strong style={{ color: '#dc2626' }}>R$ {Number(modalDetalhesRegistro.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              )}

            </div>

            {/* RODAPÉ */}
            <div className="modal-cf-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
              {modalDetalhesRegistro.tipo === 'locacao' && (
                <button
                  type="button"
                  onClick={() => {
                    setModalDetalhesRegistro(null);
                    navigate('/locacoes');
                  }}
                  style={{ flex: 1, padding: '10px 14px', background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  📋 Abrir em Locações
                </button>
              )}

              {modalDetalhesRegistro.tipo === 'cliente' && (
                <button
                  type="button"
                  onClick={() => {
                    setModalDetalhesRegistro(null);
                    navigate('/clientes');
                  }}
                  style={{ flex: 1, padding: '10px 14px', background: '#db2777', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  👤 Abrir em Clientes
                </button>
              )}

              {modalDetalhesRegistro.tipo === 'peca' && (
                <button
                  type="button"
                  onClick={() => {
                    setModalDetalhesRegistro(null);
                    navigate('/estoque');
                  }}
                  style={{ flex: 1, padding: '10px 14px', background: '#c5a059', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  📦 Abrir no Estoque
                </button>
              )}

              {modalDetalhesRegistro.tipo === 'compra' && (
                <button
                  type="button"
                  onClick={() => {
                    setModalDetalhesRegistro(null);
                    navigate('/compras');
                  }}
                  style={{ flex: 1, padding: '10px 14px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  🛒 Abrir em Compras
                </button>
              )}

              <button
                type="button"
                className="btn-cf-modal-cancel"
                onClick={() => setModalDetalhesRegistro(null)}
                style={{ padding: '10px 16px', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Financeiro;