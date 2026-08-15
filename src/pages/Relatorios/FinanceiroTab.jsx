import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    nomeEmpresa: 'Celebre Festas',
    logotipo: '',
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
          setDadosEmpresa({
            nomeEmpresa: cfg.nomeFantasia || cfg.razaoSocial || cfg.nome || 'Celebre Festas',
            logotipo: cfg.logo || cfg.logotipo || '',
            cnpj: cfg.cnpj || '',
            endereco: cfg.endereco || '',
            chavePix: cfg.chavePix || cfg.pix || ''
          });
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

  // EXPORTAR EXCEL / CSV
  const exportarCSV = () => {
    const cabecalho = ["Data", "Descricao", "Categoria", "Operacao", "Forma Pagto", "Valor (R$)"];
    const linhas = transacoesFiltradasTabela.map(t => [
      `"${t.dataStr}"`,
      `"${t.descricao?.replace(/"/g, '""')}"`,
      `"${t.categoria || 'Geral'}"`,
      `"${t.tipo === 'receita' ? 'Entrada' : 'Saida'}"`,
      `"${t.formaPagto || 'Pix'}"`,
      `"${t.valor.toFixed(2).replace('.', ',')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DRE_Financeiro_${filtroMes || 'Geral'}_${filtroAno || 'Geral'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    registrarLog("EXPORTACAO_CSV_RELATORIO", `Exportou planilha CSV do DRE financeiro (${filtroMes}/${filtroAno}).`);
  };

  // EXPORTAR PDF EXECUTIVO
  const exportarPDF = async () => {
    try {
      const doc = new jsPDF();
      const dataHojeStr = new Date().toLocaleDateString('pt-BR');
      let startY = 22;

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text(dadosEmpresa.nomeEmpresa, 14, startY);
      
      doc.setFontSize(9);
      doc.setTextColor(100);
      const periodoTexto = (filtroMes && filtroAno) ? `${NOMES_MESES[Number(filtroMes) - 1]} de ${filtroAno}` : 'Histórico Geral Consolidado';
      doc.text(`DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO (DRE) · Período: ${periodoTexto}`, 14, startY + 6);
      doc.text(`Gerado em: ${dataHojeStr} por ${usuarioLogado?.email || 'Administrador'}`, 14, startY + 11);

      // Resumo DRE Box
      doc.setFillColor(248, 250, 252);
      doc.rect(14, startY + 16, 182, 32, 'F');

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`(+) Receita Bruta: R$ ${metricasDRE.receitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, startY + 24);
      doc.text(`(-) Custos Diretos: R$ ${metricasDRE.totalCustosDiretos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, startY + 31);
      doc.text(`(-) Despesas Fixas: R$ ${metricasDRE.despesasFixas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, startY + 38);

      doc.setFont(undefined, 'bold');
      doc.setTextColor(metricasDRE.lucroLiquido >= 0 ? 22 : 220, metricasDRE.lucroLiquido >= 0 ? 163 : 38, metricasDRE.lucroLiquido >= 0 ? 74 : 38);
      doc.text(`LUCRO LÍQUIDO: R$ ${metricasDRE.lucroLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${metricasDRE.margemLiquidaPct}% Margem)`, 100, startY + 31);

      const tableColumn = ["Data", "Descrição da Operação", "Categoria", "Tipo", "Valor (R$)"];
      const tableRows = transacoesFiltradasTabela.map(t => [
        t.dataStr || '-',
        t.descricao || '-',
        t.categoria || 'Geral',
        t.tipo === 'receita' ? 'Entrada' : 'Saída',
        `${t.tipo === 'receita' ? '+' : '-'} R$ ${t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY + 54, 
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }, 
        styles: { fontSize: 8.5 },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
      });

      doc.save(`DRE_Executivo_${dadosEmpresa.nomeEmpresa}_${filtroMes}_${filtroAno}.pdf`);
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
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #e2e8f0', padding: '14px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>📈</span>
          <div>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Período de Análise Financeira & DRE</strong>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              {filtroMes && filtroAno ? `${NOMES_MESES[Number(filtroMes)-1]} / ${filtroAno}` : 'Histórico Consolidado'} · {dadosEmpresa.nomeEmpresa}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={filtroMes} 
            onChange={e => setFiltroMes(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a', background: '#f8fafc' }}
          >
            <option value="">📆 Mês: Todos</option>
            {NOMES_MESES.map((m, idx) => (
              <option key={idx} value={String(idx + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>

          <select 
            value={filtroAno} 
            onChange={e => setFiltroAno(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a', background: '#f8fafc' }}
          >
            <option value="">📆 Ano: Todos</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>

          <button 
            type="button" 
            onClick={() => { setFiltroMes(mesAtualNum); setFiltroAno(anoAtualNum); }}
            style={{ padding: '7px 12px', borderRadius: '8px', border: filtroMes === mesAtualNum ? '1.5px solid #0f172a' : '1px solid #cbd5e1', background: filtroMes === mesAtualNum ? '#0f172a' : '#ffffff', color: filtroMes === mesAtualNum ? '#ffffff' : '#334155', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Este Mês
          </button>

          <button 
            type="button" 
            onClick={() => { setFiltroMes(''); setFiltroAno(''); }}
            style={{ padding: '7px 12px', borderRadius: '8px', border: !filtroMes && !filtroAno ? '1.5px solid #0f172a' : '1px solid #cbd5e1', background: !filtroMes && !filtroAno ? '#0f172a' : '#ffffff', color: !filtroMes && !filtroAno ? '#ffffff' : '#334155', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Tudo
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 12px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setVisaoRelatorio('dre')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: visaoRelatorio === 'dre' ? '#0f172a' : '#f1f5f9',
              color: visaoRelatorio === 'dre' ? '#ffffff' : '#475569',
              fontWeight: '800',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            📈 Demonstrativo DRE
          </button>

          <button
            type="button"
            onClick={() => setVisaoRelatorio('extrato')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: visaoRelatorio === 'extrato' ? '#0f172a' : '#f1f5f9',
              color: visaoRelatorio === 'extrato' ? '#ffffff' : '#475569',
              fontWeight: '800',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            📋 Extrato Livro Caixa ({transacoesPeriodo.length})
          </button>

          <button
            type="button"
            onClick={() => setVisaoRelatorio('formas')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: visaoRelatorio === 'formas' ? '#0f172a' : '#f1f5f9',
              color: visaoRelatorio === 'formas' ? '#ffffff' : '#475569',
              fontWeight: '800',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            ⚡ Formas de Pagamento
          </button>

          <button
            type="button"
            onClick={() => setVisaoRelatorio('temas')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: visaoRelatorio === 'temas' ? '#0f172a' : '#f1f5f9',
              color: visaoRelatorio === 'temas' ? '#ffffff' : '#475569',
              fontWeight: '800',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            🏆 Temas Mais Rentáveis
          </button>
        </div>

        <button 
          type="button" 
          onClick={alternarIndicadores}
          style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          {mostrarIndicadores ? '👁️ Ocultar Indicadores' : '📊 Ver Indicadores & KPIs'}
        </button>
      </div>

      {/* VISÃO 1: DEMONSTRATIVO DRE CONTÁBIL */}
      {visaoRelatorio === 'dre' && (
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', overflow: 'hidden', padding: '20px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: '850' }}>
                Demonstração do Resultado do Exercício (DRE Gerencial)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                Visão contábil detalhada com margem de contribuição e lucro operacional limpo.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                onClick={exportarCSV}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                📊 Exportar Excel (CSV)
              </button>
              <button 
                type="button" 
                onClick={exportarPDF}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#0f172a', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                📄 Baixar PDF Executivo
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left' }}>Estrutura de Resultados</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', width: '180px' }}>Valor (R$)</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', width: '120px' }}>% da Receita</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. RECEITA OPERACIONAL */}
              <tr style={{ background: '#f8fafc', fontWeight: '850', borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 18px', color: '#0f172a' }}>(+) 1. RECEITA OPERACIONAL BRUTA (Locações e Eventos)</td>
                <td style={{ padding: '12px 18px', textAlign: 'right', color: '#15803d' }}>R$ {metricasDRE.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>100.0%</td>
              </tr>

              {/* 2. CUSTOS DIRETOS */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 18px 10px 36px', color: '#64748b' }}>(-) Aquisição de Acervo e Compras para Estoque</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#dc2626' }}>- R$ {metricasDRE.custosAquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#94a3b8' }}>{metricasDRE.receitas > 0 ? ((metricasDRE.custosAquisicao / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 18px 10px 36px', color: '#64748b' }}>(-) Insumos, Materiais & Embalagens</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#dc2626' }}>- R$ {metricasDRE.custosInsumos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#94a3b8' }}>{metricasDRE.receitas > 0 ? ((metricasDRE.custosInsumos / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                <td style={{ padding: '10px 18px 10px 36px', color: '#64748b' }}>(-) Manutenção & Reparos do Acervo</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#dc2626' }}>- R$ {metricasDRE.custosManutencao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#94a3b8' }}>{metricasDRE.receitas > 0 ? ((metricasDRE.custosManutencao / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
              </tr>

              {/* 3. MARGEM DE CONTRIBUIÇÃO */}
              <tr style={{ background: '#f8fafc', fontWeight: '850', borderBottom: '1.5px solid #cbd5e1' }}>
                <td style={{ padding: '12px 18px', color: '#0f172a' }}>(=) MARGEM DE CONTRIBUIÇÃO / LUCRO BRUTO</td>
                <td style={{ padding: '12px 18px', textAlign: 'right', color: metricasDRE.margemBruta >= 0 ? '#15803d' : '#dc2626' }}>R$ {metricasDRE.margemBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '12px 18px', textAlign: 'right', color: '#0f172a' }}>{metricasDRE.receitas > 0 ? ((metricasDRE.margemBruta / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
              </tr>

              {/* 4. DESPESAS FIXAS */}
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                <td style={{ padding: '10px 18px 10px 36px', color: '#64748b' }}>(-) Despesas Fixas, Equipe, Aluguel & Operacionais</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#dc2626' }}>- R$ {metricasDRE.despesasFixas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '10px 18px', textAlign: 'right', color: '#94a3b8' }}>{metricasDRE.receitas > 0 ? ((metricasDRE.despesasFixas / metricasDRE.receitas) * 100).toFixed(1) : 0}%</td>
              </tr>

              {/* 5. LUCRO LÍQUIDO FINAL */}
              <tr style={{ background: '#f8fafc', fontWeight: '900', fontSize: '1rem' }}>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>🏆 (=) RESULTADO OPERACIONAL LÍQUIDO</td>
                <td style={{ padding: '14px 18px', textAlign: 'right', color: metricasDRE.lucroLiquido >= 0 ? '#15803d' : '#b91c1c' }}>
                  R$ {metricasDRE.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', color: metricasDRE.lucroLiquido >= 0 ? '#15803d' : '#b91c1c' }}>
                  {metricasDRE.margemLiquidaPct}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* VISÃO 2: EXTRATO COMPLETO LIVRO CAIXA */}
      {visaoRelatorio === 'extrato' && (
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
          <div className="dre-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>📋 Extrato Livro Caixa ({transacoesFiltradasTabela.length})</h3>
              <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Movimentações do período selecionado.</p>
            </div>
            
            <div className="dre-actions-group">
              <div className="dre-filter-buttons">
                <button type="button" className={filtroTipo === 'todos' ? 'active' : ''} onClick={() => setFiltroTipo('todos')}>Todos</button>
                <button type="button" className={filtroTipo === 'receita' ? 'active btn-verde' : ''} onClick={() => setFiltroTipo('receita')}>🟢 Entradas</button>
                <button type="button" className={filtroTipo === 'despesa' ? 'active btn-vermelho' : ''} onClick={() => setFiltroTipo('despesa')}>🔴 Saídas</button>
              </div>

              <button type="button" className="btn-export-pdf" onClick={exportarPDF}>
                📄 Baixar PDF
              </button>
            </div>
          </div>

          <div className="table-container" style={{ marginTop: '15px' }}>
            <table className="custom-table table-pro">
              <thead>
                <tr>
                  <th width="15%">DATA</th>
                  <th width="45%">DESCRIÇÃO / ORIGEM</th>
                  <th style={{textAlign: 'center'}} width="20%">OPERAÇÃO</th>
                  <th style={{textAlign: 'right'}} width="20%">VALOR (R$)</th>
                </tr>
              </thead>
              <tbody>
                {transacoesFiltradasTabela.length === 0 ? (
                  <tr>
                     <td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhuma movimentação encontrada para o período selecionado.</td>
                  </tr>
                ) : (
                  transacoesFiltradasTabela.map((t) => (
                    <tr key={t.id}>
                      <td style={{color: '#64748b', fontWeight: '600'}}>{t.dataStr}</td>
                      <td>
                        <strong style={{color: '#0f172a'}}>{t.descricao}</strong>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{t.categoria} · {t.formaPagto}</div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <span className={`badge-dre ${t.tipo}`}>
                          {t.tipo === 'receita' ? '🟢 Entrada' : '🔴 Saída'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '850', color: t.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                        {t.tipo === 'receita' ? '+ ' : '- '} 
                        R$ {t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISÃO 3: RAIO-X DE FORMAS DE PAGAMENTO */}
      {visaoRelatorio === 'formas' && (
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>⚡ Distribuição de Recebimentos por Forma de Pagamento</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#166534' }}>⚡ PIX</span>
                <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 'bold' }}>
                  {metricasDRE.receitas > 0 ? ((metricasDRE.formas.pix / metricasDRE.receitas) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#15803d', display: 'block', marginTop: '6px' }}>
                R$ {metricasDRE.formas.pix.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#1e40af' }}>💳 CARTÃO</span>
                <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 'bold' }}>
                  {metricasDRE.receitas > 0 ? ((metricasDRE.formas.cartao / metricasDRE.receitas) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#1d4ed8', display: 'block', marginTop: '6px' }}>
                R$ {metricasDRE.formas.cartao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>

            <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#854d0e' }}>💵 DINHEIRO</span>
                <span style={{ fontSize: '0.7rem', color: '#a16207', fontWeight: 'bold' }}>
                  {metricasDRE.receitas > 0 ? ((metricasDRE.formas.dinheiro / metricasDRE.receitas) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#ca8a04', display: 'block', marginTop: '6px' }}>
                R$ {metricasDRE.formas.dinheiro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#475569' }}>🏦 OUTROS</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>
                  {metricasDRE.receitas > 0 ? ((metricasDRE.formas.outros / metricasDRE.receitas) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#334155', display: 'block', marginTop: '6px' }}>
                R$ {metricasDRE.formas.outros.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* VISÃO 4: TEMAS MAIS RENTÁVEIS */}
      {visaoRelatorio === 'temas' && (
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>🏆 Top Temas e Serviços Mais Rentáveis no Período</h3>

          {metricasDRE.rankingTemas.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Nenhum tema com faturamento no período selecionado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {metricasDRE.rankingTemas.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#c5a059' }}>#{idx + 1}</span>
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{t.tema}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>{t.qtd} locações realizadas</span>
                    </div>
                  </div>
                  <strong style={{ fontSize: '1rem', color: '#15803d' }}>
                    R$ {t.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default FinanceiroTab;