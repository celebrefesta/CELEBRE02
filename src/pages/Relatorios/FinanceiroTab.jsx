import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { gerarRelatorioFinanceiroPDF } from '../../utils/gerarRelatorioFinanceiroPDF';
import './FinanceiroTab.css';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const FinanceiroTab = ({ mostrarIndicadores = true, alternarIndicadores }) => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const dataHoje = new Date();
  const mesAtualNum = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const anoAtualNum = String(dataHoje.getFullYear());

  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState(mesAtualNum);
  const [filtroAno, setFiltroAno] = useState(anoAtualNum);
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'receita' | 'despesa'
  const [visaoRelatorio, setVisaoRelatorio] = useState('dre'); // 'dre' | 'extrato' | 'formas' | 'temas'

  const [todasLocacoes, setTodasLocacoes] = useState([]);
  const [todasCompras, setTodasCompras] = useState([]);
  const [todosLancamentos, setTodosLancamentos] = useState([]);

  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: localStorage.getItem('nomeEmpresa') || localStorage.getItem('funcName') || usuarioLogado?.displayName || '',
    logotipo: localStorage.getItem('logotipoEmpresa') || '',
    cnpj: '',
    endereco: '',
    chavePix: ''
  });

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
      console.error("Erro ao gravar log da auditoria financeira:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) return; 

    const buscarDados = async () => {
      try {
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const qCompras = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
        const qLancamentos = query(collection(db, "financeiro_lancamentos"), where("userId", "==", tenantId));
        const docConfigRef = doc(db, "configuracoes_empresa", tenantId);

        const [snapLocacoes, snapCompras, snapLancamentos, snapConfig] = await Promise.all([
          getDocs(qLocacoes),
          getDocs(qCompras),
          getDocs(qLancamentos).catch(() => ({ docs: [] })),
          getDoc(docConfigRef).catch(() => ({ exists: () => false }))
        ]);

        if (snapConfig.exists && snapConfig.exists()) {
          const cfg = snapConfig.data();
          const nomeFinal = cfg.nomeEmpresa || cfg.nomeFantasia || cfg.razaoSocial || cfg.nome || localStorage.getItem('nomeEmpresa') || localStorage.getItem('funcName') || usuarioLogado?.displayName || 'Minha Empresa';
          setDadosEmpresa({
            nomeEmpresa: nomeFinal,
            logotipo: cfg.logotipo || cfg.logo || '',
            cnpj: cfg.cnpj || '',
            endereco: cfg.endereco || '',
            chavePix: cfg.chavePix || cfg.pix || ''
          });
          if (nomeFinal) localStorage.setItem('nomeEmpresa', nomeFinal);
        } else {
          try {
            const snapUser = await getDoc(doc(db, "usuarios", tenantId));
            if (snapUser.exists()) {
              const u = snapUser.data();
              const uNome = u.nomeEmpresa || u.nomeCompleto || u.empresaNome || u.nomeExibicao;
              if (uNome) {
                setDadosEmpresa(prev => ({ ...prev, nomeEmpresa: uNome }));
                localStorage.setItem('nomeEmpresa', uNome);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }

        setTodasLocacoes(snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() })));
        setTodasCompras(snapCompras.docs.map(d => ({ id: d.id, ...d.data() })));
        setTodosLancamentos(snapLancamentos.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao carregar dados do relatório financeiro:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDados();
  }, [usuarioLogado, tenantId]);

  // 🔥 FORMATADOR UNIFICADO DE TRANSAÇÕES
  const transacoesBrutas = useMemo(() => {
    const lista = [];

    const formatarData = (dataBase) => {
      if (!dataBase) return new Date().toLocaleDateString('pt-BR');
      if (typeof dataBase === 'string') {
        const partes = dataBase.split('T')[0].split('-');
        if (partes.length >= 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return dataBase;
      }
      if (dataBase.toDate) return dataBase.toDate().toLocaleDateString('pt-BR');
      return new Date(dataBase).toLocaleDateString('pt-BR');
    };

    const pegarTimestamp = (dataBase) => {
      if (!dataBase) return new Date().getTime();
      if (typeof dataBase === 'string') return new Date(dataBase + 'T12:00:00').getTime();
      if (dataBase.toDate) return dataBase.toDate().getTime();
      return new Date(dataBase).getTime();
    };

    const pegarAnoMes = (dataBase) => {
      if (!dataBase) {
        const d = new Date();
        return { ano: String(d.getFullYear()), mes: String(d.getMonth() + 1).padStart(2, '0') };
      }
      if (typeof dataBase === 'string') {
        const p = dataBase.split('T')[0].split('-');
        if (p.length >= 2) return { ano: p[0], mes: p[1] };
      }
      if (dataBase.toDate) {
        const d = dataBase.toDate();
        return { ano: String(d.getFullYear()), mes: String(d.getMonth() + 1).padStart(2, '0') };
      }
      const d = new Date(dataBase);
      return { ano: String(d.getFullYear()), mes: String(d.getMonth() + 1).padStart(2, '0') };
    };

    // 1. RECEITAS DE LOCAÇÕES
    todasLocacoes.forEach(loc => {
      const st = String(loc.status || '').toLowerCase();
      if (st.includes('cancel')) return;

      const valorPago = Number(loc.valorPago || loc.sinal || loc.valorSinal || 0);
      const dataRef = loc.dataRetirada || loc.dataEvento || loc.criadoEm;
      const { ano, mes } = pegarAnoMes(dataRef);

      if (valorPago > 0) {
        lista.push({
          id: `loc_${loc.id}`,
          dataTimestamp: pegarTimestamp(dataRef),
          dataStr: formatarData(dataRef),
          ano,
          mes,
          descricao: `Locação #${loc.numeroPedido || loc.id.slice(0,6)} · ${loc.clienteNome || 'Cliente'}`,
          categoria: 'Locações e Eventos',
          tipo: 'receita',
          formaPagto: loc.formaPagamento || loc.formaPagto || 'Pix',
          valor: valorPago,
          tema: loc.temaFesta || loc.tema || 'Locação Geral',
          clienteNome: loc.clienteNome || 'Cliente'
        });
      }
    });

    // 2. COMPRAS DE ACERVO / INSUMOS
    todasCompras.forEach(comp => {
      const statusLimpo = String(comp.status || '').toLowerCase().trim();
      if (statusLimpo === 'comprado' || statusLimpo === 'chegou') {
        const valUnit = Number(comp.valorPago || comp.valorEstimado || 0);
        const qtd = Number(comp.quantidade) || 1;
        const totalComp = valUnit * qtd;
        const dataRef = comp.dataCompra || comp.dataChegada || comp.createdAt;
        const { ano, mes } = pegarAnoMes(dataRef);

        lista.push({
          id: `comp_${comp.id}`,
          dataTimestamp: pegarTimestamp(dataRef),
          dataStr: formatarData(dataRef),
          ano,
          mes,
          descricao: `Compra: ${comp.nome || 'Acervo/Material'} (${qtd}x)`,
          categoria: comp.categoria === 'material' ? 'Insumos e Embalagens' : 'Aquisição de Acervo',
          tipo: 'despesa',
          formaPagto: comp.formaPagto || 'Pix',
          valor: totalComp,
          fornecedor: comp.fornecedor || 'Fornecedor'
        });
      }
    });

    // 3. LANÇAMENTOS DO FINANCEIRO
    todosLancamentos.forEach(lan => {
      const valorLan = Number(lan.valor || 0);
      const isEntrada = lan.tipo === 'entrada' || lan.tipo === 'receita';
      const dataRef = lan.data || lan.criadoEm;
      const { ano, mes } = pegarAnoMes(dataRef);

      lista.push({
        id: `lan_${lan.id}`,
        dataTimestamp: pegarTimestamp(dataRef),
        dataStr: formatarData(dataRef),
        ano,
        mes,
        descricao: lan.descricao || lan.categoria || 'Caixa',
        categoria: lan.categoria || (isEntrada ? 'Locações e Eventos' : 'Despesas Fixas'),
        tipo: isEntrada ? 'receita' : 'despesa',
        formaPagto: lan.formaPagto || 'Pix',
        valor: valorLan,
        clienteNome: lan.clienteNome || lan.cliente || ''
      });
    });

    lista.sort((a, b) => b.dataTimestamp - a.dataTimestamp);
    return lista;
  }, [todasLocacoes, todasCompras, todosLancamentos]);

  // FILTRAGEM POR PERÍODO (MÊS / ANO)
  const transacoesPeriodo = useMemo(() => {
    return transacoesBrutas.filter(t => {
      if (filtroAno && t.ano !== filtroAno) return false;
      if (filtroMes && t.mes !== filtroMes) return false;
      return true;
    });
  }, [transacoesBrutas, filtroMes, filtroAno]);

  const transacoesFiltradasTabela = useMemo(() => {
    return transacoesPeriodo.filter(t => {
      if (filtroTipo === 'todos') return true;
      return t.tipo === filtroTipo;
    });
  }, [transacoesPeriodo, filtroTipo]);

  const [filtroFormaSelecionada, setFiltroFormaSelecionada] = useState('todas'); 
  // 'todas' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'cheque' | 'outros'

  const resumoExtrato = useMemo(() => {
    const totalEntradas = transacoesPeriodo.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
    const totalSaidas = transacoesPeriodo.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
    const saldo = totalEntradas - totalSaidas;
    return { totalEntradas, totalSaidas, saldo };
  }, [transacoesPeriodo]);

  const receitasPorForma = useMemo(() => {
    return transacoesPeriodo.filter(t => t.tipo === 'receita');
  }, [transacoesPeriodo]);

  // Contagem individual por modalidade de pagamento
  const contagemFormas = useMemo(() => {
    let pix = 0, credito = 0, debito = 0, dinheiro = 0, cheque = 0, outros = 0;
    receitasPorForma.forEach(t => {
      const f = String(t.formaPagto || '').toLowerCase();
      if (f.includes('pix')) pix++;
      else if (f.includes('déb') || f.includes('deb')) debito++;
      else if (f.includes('créd') || f.includes('cred') || f.includes('cart')) credito++;
      else if (f.includes('dinheiro') || f.includes('especie') || f.includes('espécie')) dinheiro++;
      else if (f.includes('cheque')) cheque++;
      else outros++;
    });
    return { todas: receitasPorForma.length, pix, credito, debito, dinheiro, cheque, outros };
  }, [receitasPorForma]);

  const transacoesFormasFiltradas = useMemo(() => {
    if (filtroFormaSelecionada === 'todas') return receitasPorForma;
    return receitasPorForma.filter(t => {
      const f = String(t.formaPagto || '').toLowerCase();
      if (filtroFormaSelecionada === 'pix') return f.includes('pix');
      if (filtroFormaSelecionada === 'cartao_credito') {
        return f.includes('créd') || f.includes('cred') || (f.includes('cart') && !f.includes('deb') && !f.includes('déb'));
      }
      if (filtroFormaSelecionada === 'cartao_debito') {
        return f.includes('déb') || f.includes('deb');
      }
      if (filtroFormaSelecionada === 'dinheiro') {
        return f.includes('dinheiro') || f.includes('especie') || f.includes('espécie');
      }
      if (filtroFormaSelecionada === 'cheque') {
        return f.includes('cheque');
      }
      if (filtroFormaSelecionada === 'outros') {
        const isPix = f.includes('pix');
        const isCred = f.includes('créd') || f.includes('cred') || (f.includes('cart') && !f.includes('deb') && !f.includes('déb'));
        const isDeb = f.includes('deb') || f.includes('déb');
        const isDinheiro = f.includes('dinheiro') || f.includes('especie') || f.includes('espécie');
        const isCheque = f.includes('cheque');
        return !isPix && !isCred && !isDeb && !isDinheiro && !isCheque;
      }
      return true;
    });
  }, [receitasPorForma, filtroFormaSelecionada]);

  const totalFormasSelecionado = useMemo(() => {
    return transacoesFormasFiltradas.reduce((acc, t) => acc + t.valor, 0);
  }, [transacoesFormasFiltradas]);

  // 📊 CÁLCULOS DRE CONSOLIDADOS
  const metricasDRE = useMemo(() => {
    const receitas = transacoesPeriodo.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
    const saidas = transacoesPeriodo.filter(t => t.tipo === 'despesa');

    const custosAquisicao = saidas.filter(t => 
      t.categoria === 'Aquisição de Acervo' || t.categoria === 'Compra para Estoque' || t.categoria?.toLowerCase().includes('acervo')
    ).reduce((acc, t) => acc + t.valor, 0);

    const custosInsumos = saidas.filter(t => 
      t.categoria === 'Insumos e Embalagens' || t.categoria === 'Material de Consumo' || t.categoria?.toLowerCase().includes('insumo')
    ).reduce((acc, t) => acc + t.valor, 0);

    const custosManutencao = saidas.filter(t => 
      t.categoria === 'Manutenção e Reparos' || t.categoria?.toLowerCase().includes('manuten')
    ).reduce((acc, t) => acc + t.valor, 0);

    const totalCustosDiretos = custosAquisicao + custosInsumos + custosManutencao;
    const margemBruta = receitas - totalCustosDiretos;

    const despesasFixas = saidas.filter(t => 
      !['Aquisição de Acervo', 'Compra para Estoque', 'Insumos e Embalagens', 'Material de Consumo', 'Manutenção e Reparos'].includes(t.categoria)
    ).reduce((acc, t) => acc + t.valor, 0);

    const totalDespesasGerais = totalCustosDiretos + despesasFixas;
    const lucroLiquido = receitas - totalDespesasGerais;
    const margemLiquidaPct = receitas > 0 ? Math.round((lucroLiquido / receitas) * 100) : (totalDespesasGerais > 0 ? -100 : 0);

    // Formas de Pagamento
    const formas = { pix: 0, cartao: 0, dinheiro: 0, outros: 0 };
    transacoesPeriodo.filter(t => t.tipo === 'receita').forEach(t => {
      const f = String(t.formaPagto || '').toLowerCase();
      if (f.includes('pix')) formas.pix += t.valor;
      else if (f.includes('cart') || f.includes('cred') || f.includes('deb')) formas.cartao += t.valor;
      else if (f.includes('dinheiro') || f.includes('especie')) formas.dinheiro += t.valor;
      else formas.outros += t.valor;
    });

    // Ranking de Temas
    const temasMap = {};
    transacoesPeriodo.filter(t => t.tipo === 'receita' && t.tema).forEach(t => {
      if (!temasMap[t.tema]) temasMap[t.tema] = { tema: t.tema, total: 0, qtd: 0 };
      temasMap[t.tema].total += t.valor;
      temasMap[t.tema].qtd += 1;
    });
    const rankingTemas = Object.values(temasMap).sort((a, b) => b.total - a.total).slice(0, 5);

    // Contratos Futuros a Receber
    let saldoFuturoAReceber = 0;
    let qtdFestasPendentes = 0;
    todasLocacoes.forEach(loc => {
      const st = String(loc.status || '').toLowerCase();
      if (!st.includes('cancel') && !st.includes('orcam')) {
        const tot = Number(loc.valorTotal || loc.total || 0);
        const pag = Number(loc.valorPago || loc.sinal || 0);
        const pend = Math.max(0, tot - pag);
        if (pend > 0) {
          saldoFuturoAReceber += pend;
          qtdFestasPendentes += 1;
        }
      }
    });

    return {
      receitas,
      custosAquisicao,
      custosInsumos,
      custosManutencao,
      totalCustosDiretos,
      margemBruta,
      despesasFixas,
      totalDespesasGerais,
      lucroLiquido,
      margemLiquidaPct,
      formas,
      rankingTemas,
      saldoFuturoAReceber,
      qtdFestasPendentes
    };
  }, [transacoesPeriodo, todasLocacoes]);

  // EXPORTAR EXCEL / CSV (COMPATIBILIDADE 100% COM MICROSOFT EXCEL UTF-8 BOM)
  const exportarCSV = () => {
    const cabecalho = ["Data", "Descricao / Origem", "Categoria", "Operacao", "Forma de Pagamento", "Valor (R$)"];
    const linhas = transacoesFiltradasTabela.map(t => [
      `"${t.dataStr}"`,
      `"${(t.descricao || '').replace(/"/g, '""')}"`,
      `"${(t.categoria || 'Geral').replace(/"/g, '""')}"`,
      `"${t.tipo === 'receita' ? 'Entrada' : 'Saida'}"`,
      `"${(t.formaPagto || 'Pix').replace(/"/g, '""')}"`,
      `"${t.valor.toFixed(2).replace('.', ',')}"`
    ]);

    const csvContent = [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const nomeEmpresaSanitizado = (dadosEmpresa.nomeEmpresa || 'Empresa').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Extrato_Financeiro_${nomeEmpresaSanitizado}_${filtroMes || 'Geral'}_${filtroAno || 'Geral'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    registrarLog("EXPORTACAO_CSV_RELATORIO", `Exportou planilha CSV do financeiro (${filtroMes}/${filtroAno}).`);
  };

  // EXPORTAR PDF EXECUTIVO (PADRÃO LUXO ENTERPRISE)
  const exportarPDF = async () => {
    try {
      gerarRelatorioFinanceiroPDF({
        empresa: dadosEmpresa,
        metricasDRE,
        transacoes: transacoesFiltradasTabela,
        filtroMes,
        filtroAno,
        usuarioEmail: usuarioLogado?.email
      });
      await registrarLog("EXPORTACAO_PDF_DRE", `Fez o download do PDF executivo do DRE (${filtroMes}/${filtroAno}).`);
    } catch (error) {
      console.error("Erro ao gerar PDF: ", error);
      alert("Erro ao gerar o PDF financeiro.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>Calculando inteligência financeira e DRE...</div>;

  const totalMov = metricasDRE.receitas + metricasDRE.totalDespesasGerais || 1;
  const percReceita = Math.min(100, Math.max(0, Math.round((metricasDRE.receitas / totalMov) * 100)));

  return (
    <div className="fade-in">
      
      {/* 🗓️ BARRA SUPERIOR DE FILTRO DINÂMICO DE PERÍODO */}
      <div className="rel-filter-card">
        <div className="rel-filter-info">
          <span style={{ fontSize: '1.4rem' }}>📈</span>
          <div>
            <strong className="rel-filter-title">Período de Análise Financeira & DRE</strong>
            <p className="rel-filter-sub">
              {filtroMes && filtroAno ? `${NOMES_MESES[Number(filtroMes)-1]} / ${filtroAno}` : 'Histórico Consolidado'} · {dadosEmpresa.nomeEmpresa}
            </p>
          </div>
        </div>

        <div className="rel-filter-controls">
          <select 
            value={filtroMes} 
            onChange={e => setFiltroMes(e.target.value)}
            className="rel-select-custom"
          >
            <option value="">📅 Mês: Todos</option>
            {NOMES_MESES.map((m, idx) => {
              const numMes = idx + 1;
              const ehMesFuturo = filtroAno === anoAtualNum && numMes > Number(mesAtualNum);
              return (
                <option 
                  key={idx} 
                  value={String(numMes).padStart(2, '0')}
                  disabled={ehMesFuturo}
                >
                  📅 Mês: {m} {ehMesFuturo ? '(Futuro)' : ''}
                </option>
              );
            })}
          </select>

          <select 
            value={filtroAno} 
            onChange={e => {
              const novoAno = e.target.value;
              setFiltroAno(novoAno);
              if (novoAno === anoAtualNum && filtroMes && Number(filtroMes) > Number(mesAtualNum)) {
                setFiltroMes(mesAtualNum);
              }
            }}
            className="rel-select-custom"
          >
            <option value="">📆 Ano: Todos</option>
            {Array.from({ length: 4 }, (_, i) => Number(anoAtualNum) - 3 + i).map(ano => (
              <option key={ano} value={String(ano)}>📆 Ano: {ano}</option>
            ))}
          </select>

          <button 
            type="button" 
            onClick={() => { setFiltroMes(mesAtualNum); setFiltroAno(anoAtualNum); }}
            className={`rel-quick-btn ${filtroMes === mesAtualNum && filtroAno === anoAtualNum ? 'active' : ''}`}
          >
            Este Mês
          </button>

          <button 
            type="button" 
            onClick={() => { setFiltroMes(''); setFiltroAno(''); }}
            className={`rel-quick-btn ${!filtroMes && !filtroAno ? 'active' : ''}`}
          >
            Histórico
          </button>
        </div>
      </div>

      {/* 4 CARDS KPI BLINDADOS (GOLDEN RULE 1 & 2) */}
      {mostrarIndicadores && (
        <div className="clientes-stats-grid">
          <div className="stat-card-pro card-green">
            <div className="stat-icon-wrapper icon-green">🟢</div>
            <div className="stat-content">
              <span className="stat-title">RECEITA OPERACIONAL</span>
              <strong className="stat-number">R$ {metricasDRE.receitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
              <small className="stat-desc">Entradas de contratos</small>
            </div>
          </div>
          
          <div className="stat-card-pro card-red">
            <div className="stat-icon-wrapper icon-red">🔴</div>
            <div className="stat-content">
              <span className="stat-title">CUSTOS &amp; DESPESAS</span>
              <strong className="stat-number">R$ {metricasDRE.totalDespesasGerais.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
              <small className="stat-desc">Acervo, compras e fixas</small>
            </div>
          </div>

          <div className="stat-card-pro card-purple">
            <div className="stat-icon-wrapper icon-purple">🏦</div>
            <div className="stat-content">
              <span className="stat-title">LUCRO LÍQUIDO (DRE)</span>
              <strong className="stat-number" style={{ color: metricasDRE.lucroLiquido >= 0 ? '#10b981' : '#ef4444' }}>
                R$ {metricasDRE.lucroLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
              <small className="stat-desc">{metricasDRE.margemLiquidaPct}% margem real</small>
            </div>
          </div>

          <div className="stat-card-pro card-amber">
            <div className="stat-icon-wrapper icon-amber">🔮</div>
            <div className="stat-content">
              <span className="stat-title">SALDO A RECEBER</span>
              <strong className="stat-number">R$ {metricasDRE.saldoFuturoAReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
              <small className="stat-desc">{metricasDRE.qtdFestasPendentes} festas agendadas</small>
            </div>
          </div>
        </div>
      )}

      {/* 📊 SELETOR DE SUB-VISÕES DO RELATÓRIO */}
      <div className="rel-subtabs-container">
        <div className="rel-subtabs-group">
          <button
            type="button"
            onClick={() => setVisaoRelatorio('dre')}
            className={`rel-subtab-btn ${visaoRelatorio === 'dre' ? 'active' : ''}`}
          >
            📈 Demonstrativo DRE
          </button>

          <button
            type="button"
            onClick={() => setVisaoRelatorio('extrato')}
            className={`rel-subtab-btn ${visaoRelatorio === 'extrato' ? 'active' : ''}`}
          >
            📋 Extrato Livro Caixa ({transacoesPeriodo.length})
          </button>

          <button
            type="button"
            onClick={() => setVisaoRelatorio('formas')}
            className={`rel-subtab-btn ${visaoRelatorio === 'formas' ? 'active' : ''}`}
          >
            ⚡ Formas de Pagamento
          </button>

          <button 
            type="button" 
            onClick={alternarIndicadores}
            className={`rel-subtab-btn rel-btn-toggle-kpi ${mostrarIndicadores ? 'kpi-ativo' : ''}`}
          >
            {mostrarIndicadores ? '👁️ Ocultar KPIs' : '📊 Ver KPIs'}
          </button>
        </div>
      </div>

      {/* VISÃO 1: DEMONSTRATIVO DRE CONTÁBIL */}
      {visaoRelatorio === 'dre' && (
        <div className="rel-card-unificado">
          <div className="rel-card-header">
            <div>
              <h3 className="rel-card-title">
                Demonstração do Resultado do Exercício (DRE Gerencial)
              </h3>
              <p className="rel-card-sub">
                Visão contábil detalhada com margem de contribuição e lucro operacional limpo.
              </p>
            </div>

            <div className="rel-card-actions">
              <div className="rel-export-btn-group">
                <button 
                  type="button" 
                  onClick={exportarCSV}
                  className="rel-btn-action-outline"
                >
                  📊 Exportar Excel (CSV)
                </button>
                <button 
                  type="button" 
                  onClick={exportarPDF}
                  className="rel-btn-action-primary"
                >
                  📄 Baixar PDF Executivo
                </button>
              </div>
            </div>
          </div>

          <div className="rel-table-scroll-wrapper">
            <table className="rel-dre-table">
              <thead>
                <tr>
                  <th className="rel-dre-th-desc">ESTRUTURA DE RESULTADOS</th>
                  <th className="rel-dre-th-val">VALOR (R$)</th>
                  <th className="rel-dre-th-pct">% RECEITA</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. RECEITA OPERACIONAL */}
                <tr className="rel-dre-row-highlight">
                  <td className="rel-dre-label">(+) 1. RECEITA OPERACIONAL BRUTA (Locações e Eventos)</td>
                  <td className="rel-dre-val positive">R$ {metricasDRE.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="rel-dre-pct">100.0%</td>
                </tr>

                {/* 2. CUSTOS DIRETOS */}
                <tr className="rel-dre-row-sub">
                  <td className="rel-dre-sublabel">(-) Aquisição de Acervo e Compras para Estoque</td>
                  <td className="rel-dre-val negative">- R$ {metricasDRE.custosAquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="rel-dre-pct-sub">{metricasDRE.receitas > 0 ? ((metricasDRE.custosAquisicao / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="rel-dre-row-sub">
                  <td className="rel-dre-sublabel">(-) Insumos, Materiais &amp; Embalagens</td>
                  <td className="rel-dre-val negative">- R$ {metricasDRE.custosInsumos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="rel-dre-pct-sub">{metricasDRE.receitas > 0 ? ((metricasDRE.custosInsumos / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="rel-dre-row-sub border-end">
                  <td className="rel-dre-sublabel">(-) Manutenção &amp; Reparos do Acervo</td>
                  <td className="rel-dre-val negative">- R$ {metricasDRE.custosManutencao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="rel-dre-pct-sub">{metricasDRE.receitas > 0 ? ((metricasDRE.custosManutencao / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
                </tr>

                {/* 3. MARGEM DE CONTRIBUIÇÃO */}
                <tr className="rel-dre-row-highlight">
                  <td className="rel-dre-label">(=) MARGEM DE CONTRIBUIÇÃO / LUCRO BRUTO</td>
                  <td className={`rel-dre-val ${metricasDRE.margemBruta >= 0 ? 'positive' : 'negative'}`}>
                    R$ {metricasDRE.margemBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="rel-dre-pct">{metricasDRE.receitas > 0 ? ((metricasDRE.margemBruta / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
                </tr>

                {/* 4. DESPESAS FIXAS */}
                <tr className="rel-dre-row-sub border-end">
                  <td className="rel-dre-sublabel">(-) Despesas Fixas, Equipe, Aluguel &amp; Operacionais</td>
                  <td className="rel-dre-val negative">- R$ {metricasDRE.despesasFixas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="rel-dre-pct-sub">{metricasDRE.receitas > 0 ? ((metricasDRE.despesasFixas / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
                </tr>

                {/* 5. LUCRO LÍQUIDO FINAL */}
                <tr className="rel-dre-row-total">
                  <td className="rel-dre-totallabel">🏆 (=) RESULTADO OPERACIONAL LÍQUIDO</td>
                  <td className={`rel-dre-totalval ${metricasDRE.lucroLiquido >= 0 ? 'positive' : 'negative'}`}>
                    R$ {metricasDRE.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`rel-dre-totalval ${metricasDRE.lucroLiquido >= 0 ? 'positive' : 'negative'}`}>
                    {metricasDRE.margemLiquidaPct}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISÃO 2: EXTRATO COMPLETO LIVRO CAIXA */}
      {visaoRelatorio === 'extrato' && (
        <div className="rel-card-unificado">
          
          {/* CABEÇALHO DO EXTRATO COM CONTROLES */}
          <div className="rel-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 className="rel-card-title">📋 Extrato Livro Caixa</h3>
                <span className="rel-extrato-counter-badge">{transacoesFiltradasTabela.length} lançamentos</span>
              </div>
              <p className="rel-card-sub">Histórico analítico de entradas e saídas do período selecionado.</p>
            </div>
            
            <div className="rel-card-actions">
              {/* FILTRO SEGMENTADO (TODOS / ENTRADAS / SAÍDAS) */}
              <div className="rel-segmented-filter">
                <button 
                  type="button" 
                  className={`rel-seg-btn ${filtroTipo === 'todos' ? 'active' : ''}`} 
                  onClick={() => setFiltroTipo('todos')}
                >
                  Todos ({transacoesPeriodo.length})
                </button>
                <button 
                  type="button" 
                  className={`rel-seg-btn verde ${filtroTipo === 'receita' ? 'active' : ''}`} 
                  onClick={() => setFiltroTipo('receita')}
                >
                  🟢 Entradas ({transacoesPeriodo.filter(t => t.tipo === 'receita').length})
                </button>
                <button 
                  type="button" 
                  className={`rel-seg-btn vermelho ${filtroTipo === 'despesa' ? 'active' : ''}`} 
                  onClick={() => setFiltroTipo('despesa')}
                >
                  🔴 Saídas ({transacoesPeriodo.filter(t => t.tipo === 'despesa').length})
                </button>
              </div>

              {/* BOTÕES DE EXPORTAÇÃO */}
              <div className="rel-export-btn-group">
                <button 
                  type="button" 
                  onClick={exportarCSV} 
                  className="rel-btn-action-outline"
                  title="Exportar planilha em formato Excel (CSV)"
                >
                  📊 Excel (CSV)
                </button>
                <button 
                  type="button" 
                  onClick={exportarPDF} 
                  className="rel-btn-action-primary"
                  title="Baixar Relatório Executivo em PDF"
                >
                  📄 Baixar PDF
                </button>
              </div>
            </div>
          </div>

          {/* TABELA DE LANÇAMENTOS COM DESIGN LUXO */}
          <div className="rel-table-scroll-wrapper">
            <table className="rel-extrato-table">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>DATA</th>
                  <th style={{ width: '40%' }}>DESCRIÇÃO / ORIGEM</th>
                  <th style={{ width: '22%' }}>CATEGORIA & MÉTODO</th>
                  <th style={{ width: '11%', textAlign: 'center' }}>OPERAÇÃO</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>VALOR (R$)</th>
                </tr>
              </thead>
              <tbody>
                {transacoesFiltradasTabela.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="rel-empty-row">
                      <div className="rel-empty-box">
                        <span style={{ fontSize: '2rem' }}>📂</span>
                        <strong>Nenhuma movimentação encontrada</strong>
                        <p>Altere os filtros de mês/ano ou tipo de lançamento para visualizar os registros.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transacoesFiltradasTabela.map((t) => (
                    <tr key={t.id} className="rel-extrato-row">
                      <td className="rel-col-data">
                        <span className="rel-date-badge">
                          <i className="far fa-calendar-alt" style={{ marginRight: '5px', opacity: 0.6 }}></i>
                          {t.dataStr}
                        </span>
                      </td>

                      <td className="rel-col-desc">
                        <strong className="rel-desc-title">{t.descricao}</strong>
                        {t.tema && (
                          <div className="rel-desc-tema">
                            <i className="fas fa-magic" style={{ fontSize: '0.65rem', marginRight: '4px', color: '#c5a059' }}></i>
                            {t.tema}
                          </div>
                        )}
                      </td>

                      <td className="rel-col-meta">
                        <span className="rel-tag-categoria">{t.categoria || 'Geral'}</span>
                        <span className="rel-tag-pagto">⚡ {t.formaPagto || 'Pix'}</span>
                      </td>

                      <td className="rel-col-tipo" style={{ textAlign: 'center' }}>
                        <span className={`rel-tipo-pill ${t.tipo}`}>
                          {t.tipo === 'receita' ? '🟢 Entrada' : '🔴 Saída'}
                        </span>
                      </td>

                      <td className={`rel-col-valor ${t.tipo === 'receita' ? 'positive' : 'negative'}`} style={{ textAlign: 'right' }}>
                        {t.tipo === 'receita' ? '+ ' : '- '}
                        R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISÃO 3: RAIO-X DE FORMAS DE PAGAMENTO COM LISTAGEM ANALÍTICA */}
      {visaoRelatorio === 'formas' && (
        <div className="rel-card-unificado">
          <div className="rel-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 className="rel-card-title">⚡ Distribuição de Recebimentos por Forma de Pagamento</h3>
              </div>
              <p className="rel-card-sub">Concentração de receita por método de liquidação e extrato detalhado por modalidade.</p>
            </div>

            <div className="rel-card-actions">
              <div className="rel-export-btn-group">
                <button 
                  type="button" 
                  onClick={exportarCSV} 
                  className="rel-btn-action-outline"
                  title="Exportar planilha Excel (CSV)"
                >
                  📊 Excel (CSV)
                </button>
                <button 
                  type="button" 
                  onClick={exportarPDF} 
                  className="rel-btn-action-primary"
                  title="Baixar Relatório Executivo em PDF"
                >
                  📄 Baixar PDF
                </button>
              </div>
            </div>
          </div>
          
          {/* CARDS PURAMENTE INFORMATIVOS DE FORMAS DE PAGAMENTO */}
          <div className="rel-formas-grid">
            <div className="rel-forma-card pix">
              <div className="rel-forma-header">
                <span className="rel-forma-label">⚡ PIX</span>
              </div>
              <strong className="rel-forma-val">
                R$ {metricasDRE.formas.pix.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>

            <div className="rel-forma-card cartao">
              <div className="rel-forma-header">
                <span className="rel-forma-label">💳 CARTÃO</span>
              </div>
              <strong className="rel-forma-val">
                R$ {metricasDRE.formas.cartao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>

            <div className="rel-forma-card dinheiro">
              <div className="rel-forma-header">
                <span className="rel-forma-label">💵 DINHEIRO</span>
              </div>
              <strong className="rel-forma-val">
                R$ {metricasDRE.formas.dinheiro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>

            <div className="rel-forma-card outros">
              <div className="rel-forma-header">
                <span className="rel-forma-label">🏦 OUTROS</span>
              </div>
              <strong className="rel-forma-val">
                R$ {metricasDRE.formas.outros.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>
          </div>

          {/* BARRA DE FILTRO RÁPIDO E CONTEXTO DO MÉTODO SELECIONADO */}
          <div className="rel-formas-subbar">
            <div className="rel-formas-subbar-info">
              <span className="rel-formas-subbar-title">
                {filtroFormaSelecionada === 'todas' && '📄 Todos os Recebimentos'}
                {filtroFormaSelecionada === 'pix' && '⚡ Recebimentos via PIX'}
                {filtroFormaSelecionada === 'cartao_credito' && '💳 Cartão de Crédito'}
                {filtroFormaSelecionada === 'cartao_debito' && '💳 Cartão de Débito'}
                {filtroFormaSelecionada === 'dinheiro' && '💵 Recebimentos em Dinheiro'}
                {filtroFormaSelecionada === 'cheque' && '📑 Recebimentos em Cheque'}
                {filtroFormaSelecionada === 'outros' && '🏦 Outros Meios (Boleto/Transf.)'}
              </span>
              <span className="rel-formas-subbar-count">
                Volume Total: <strong style={{ color: '#15803d' }}>R$ {totalFormasSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>

            {/* SELETOR EM GAVETA (DROPDOWN) EXCLUSIVO E ELEGANTE */}
            <div className="rel-formas-select-container">
              <label className="rel-formas-select-label">
                <i className="fas fa-filter" style={{ color: '#c5a059' }}></i> Filtrar Modalidade:
              </label>
              <select 
                className="rel-formas-select-dropdown"
                value={filtroFormaSelecionada}
                onChange={(e) => setFiltroFormaSelecionada(e.target.value)}
              >
                <option value="todas">📋 Todos os Recebimentos ({contagemFormas.todas})</option>
                <option value="pix">⚡ PIX ({contagemFormas.pix})</option>
                <option value="cartao_credito">💳 Cartão de Crédito ({contagemFormas.credito})</option>
                <option value="cartao_debito">💳 Cartão de Débito ({contagemFormas.debito})</option>
                <option value="dinheiro">💵 Dinheiro ({contagemFormas.dinheiro})</option>
                <option value="cheque">📑 Cheque ({contagemFormas.cheque})</option>
                <option value="outros">🏦 Outros Meios (Boleto / Transf.) ({contagemFormas.outros})</option>
              </select>
            </div>
          </div>

          {/* TABELA DE LANÇAMENTOS POR FORMA DE PAGAMENTO */}
          <div className="rel-table-scroll-wrapper">
            <table className="rel-extrato-table">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>DATA</th>
                  <th style={{ width: '40%' }}>CLIENTE / ORIGEM DO RECEBIMENTO</th>
                  <th style={{ width: '22%' }}>MÉTODO DE PAGAMENTO</th>
                  <th style={{ width: '11%', textAlign: 'center' }}>CATEGORIA</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>VALOR RECEBIDO</th>
                </tr>
              </thead>
              <tbody>
                {transacoesFormasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="rel-empty-row">
                      <div className="rel-empty-box">
                        <span style={{ fontSize: '2rem' }}>💳</span>
                        <strong>Nenhum recebimento registrado para esta modalidade</strong>
                        <p>Selecione outra forma de pagamento ou altere o período no topo da página.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transacoesFormasFiltradas.map((t) => (
                    <tr key={t.id} className="rel-extrato-row">
                      <td className="rel-col-data">
                        <span className="rel-date-badge">
                          <i className="far fa-calendar-alt" style={{ marginRight: '5px', opacity: 0.6 }}></i>
                          {t.dataStr}
                        </span>
                      </td>

                      <td className="rel-col-desc">
                        <strong className="rel-desc-title">{t.descricao}</strong>
                        {t.tema && (
                          <div className="rel-desc-tema">
                            <i className="fas fa-magic" style={{ fontSize: '0.65rem', marginRight: '4px', color: '#c5a059' }}></i>
                            {t.tema}
                          </div>
                        )}
                      </td>

                      <td className="rel-col-meta">
                        <span className={`rel-tag-forma-destaque ${
                          String(t.formaPagto || '').toLowerCase().includes('pix') ? 'pix' : 
                          String(t.formaPagto || '').toLowerCase().includes('cart') || String(t.formaPagto || '').toLowerCase().includes('cred') || String(t.formaPagto || '').toLowerCase().includes('deb') ? 'cartao' : 
                          String(t.formaPagto || '').toLowerCase().includes('dinheiro') || String(t.formaPagto || '').toLowerCase().includes('especie') ? 'dinheiro' : 
                          String(t.formaPagto || '').toLowerCase().includes('cheque') ? 'cheque' : 'outros'
                        }`}>
                          {String(t.formaPagto || '').toLowerCase().includes('pix') && '⚡ '}
                          {(String(t.formaPagto || '').toLowerCase().includes('cart') || String(t.formaPagto || '').toLowerCase().includes('cred') || String(t.formaPagto || '').toLowerCase().includes('deb')) && '💳 '}
                          {(String(t.formaPagto || '').toLowerCase().includes('dinheiro') || String(t.formaPagto || '').toLowerCase().includes('especie')) && '💵 '}
                          {String(t.formaPagto || '').toLowerCase().includes('cheque') && '📑 '}
                          {!String(t.formaPagto || '').toLowerCase().includes('pix') && !String(t.formaPagto || '').toLowerCase().includes('cart') && !String(t.formaPagto || '').toLowerCase().includes('cred') && !String(t.formaPagto || '').toLowerCase().includes('deb') && !String(t.formaPagto || '').toLowerCase().includes('dinheiro') && !String(t.formaPagto || '').toLowerCase().includes('especie') && !String(t.formaPagto || '').toLowerCase().includes('cheque') && '🏦 '}
                          {t.formaPagto || 'Pix'}
                        </span>
                      </td>

                      <td className="rel-col-tipo" style={{ textAlign: 'center' }}>
                        <span className="rel-tag-categoria">
                          {t.categoria || 'Locações e Eventos'}
                        </span>
                      </td>

                      <td className="rel-col-valor positive" style={{ textAlign: 'right' }}>
                        + R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

export default FinanceiroTab;