import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './FinanceiroTab.css';

const FinanceiroTab = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ receitas: 0, despesas: 0, lucro: 0, margem: 0 });
  const [transacoes, setTransacoes] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  
  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: '',
    cnpj: '',
    endereco: ''
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

    const buscarDadosFinanceirosEConfigs = async () => {
      try {
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const qCompras = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
        const qLancamentos = query(collection(db, "financeiro_lancamentos"), where("userId", "==", tenantId));

        const [snapLocacoes, snapCompras, snapLancamentos, snapConfig] = await Promise.all([
          getDocs(qLocacoes),
          getDocs(qCompras),
          getDocs(qLancamentos).catch(() => ({ docs: [] })),
          getDoc(doc(db, "sistema", "parametros")).catch(() => ({ exists: () => false }))
        ]);

        if (snapConfig.exists()) {
          const cfg = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: cfg.nomeEmpresa || 'Ágape Decorações',
            logotipo: cfg.logotipo || '',
            cnpj: cfg.cnpj || '',
            endereco: cfg.endereco || ''
          });
        }

        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));
        const compras = snapCompras.docs.map(d => ({ id: d.id, ...d.data() }));
        const lancamentos = snapLancamentos.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let totalReceitas = 0;
        let totalDespesas = 0;
        const listaTransacoes = [];
        
        const formatarData = (dataBase) => {
          if (!dataBase) return new Date().toLocaleDateString('pt-BR');
          if (typeof dataBase === 'string') {
            const partes = dataBase.split('-');
            if (partes.length >= 3) return `${partes[2].substring(0,2)}/${partes[1]}/${partes[0]}`;
            return dataBase;
          }
          if (dataBase.toDate) return dataBase.toDate().toLocaleDateString('pt-BR');
          return new Date(dataBase).toLocaleDateString('pt-BR');
        };

        const pegarTimestamp = (dataBase) => {
          if (!dataBase) return new Date().getTime();
          if (dataBase.toDate) return dataBase.toDate().getTime();
          return new Date(dataBase).getTime();
        };

        // 1. ENTRADAS
        locacoes.forEach(loc => {
          if (loc.pagamentos && Array.isArray(loc.pagamentos)) {
            loc.pagamentos.forEach((pag, index) => {
              const valorPag = Number(pag.valor) || 0;
              if (valorPag > 0) {
                totalReceitas += valorPag;
                listaTransacoes.push({
                  id: `loc_pag_${loc.id}_${index}`,
                  dataTimestamp: pegarTimestamp(pag.data || loc.criadoEm),
                  dataStr: formatarData(pag.data || loc.criadoEm),
                  descricao: `Pagamento de Pedido: ${loc.clienteNome || 'Cliente'} ${loc.numeroPedido ? `(#${loc.numeroPedido})` : ''}`,
                  tipo: 'receita',
                  valor: valorPag
                });
              }
            });
          } else if (loc.valorPago || loc.sinal || loc.valorSinal) {
            const valorPag = Number(loc.valorPago || loc.sinal || loc.valorSinal) || 0;
            if (valorPag > 0) {
              totalReceitas += valorPag;
              listaTransacoes.push({
                id: `loc_sinal_${loc.id}`,
                dataTimestamp: pegarTimestamp(loc.criadoEm),
                dataStr: formatarData(loc.criadoEm),
                descricao: `Sinal / Pagamento: ${loc.clienteNome || 'Cliente'} ${loc.numeroPedido ? `(#${loc.numeroPedido})` : ''}`,
                tipo: 'receita',
                valor: valorPag
              });
            }
          }
        });
        
        // 2. SAÍDAS (COMPRAS)
        compras.forEach(comp => {
          const statusLimpo = comp.status ? String(comp.status).toLowerCase().trim() : '';
          if (statusLimpo === 'comprado' || statusLimpo === 'chegou') {
            let valorLimpoStr = String(comp.valorEstimado || '0').replace(/[^\d.,-]/g, '').replace(',', '.');
            const valorComp = (Number(valorLimpoStr) || 0) * (Number(comp.quantidade) || 1);
            
            totalDespesas += valorComp;
  
            let dataReal = comp.dataCompra || comp.createdAt || comp.prazo || new Date();
            listaTransacoes.push({
              id: `comp_${comp.id}`,
              dataTimestamp: pegarTimestamp(dataReal),
              dataStr: formatarData(dataReal),
              descricao: `Compra: ${comp.nome || 'Acervo/Material'} (${comp.quantidade || 1}x)`,
              tipo: 'despesa',
              valor: valorComp
            });
          }
        });
        
        // 3. LANÇAMENTOS MANUAIS
        lancamentos.forEach(lan => {
          let valorLimpo = String(lan.valor || '0').replace(/[^\d,-]/g, '').replace(',', '.');
          const valorLan = Math.abs(Number(valorLimpo)) || 0;
          const isReceita = lan.tipo === 'receita' || lan.categoria === 'Locação' || lan.tipo === 'entrada' || Number(valorLimpo) > 0;
          
          if (isReceita) totalReceitas += valorLan;
          else totalDespesas += valorLan;
 
          listaTransacoes.push({
            id: `lan_${lan.id}`,
            dataTimestamp: pegarTimestamp(lan.data || lan.criadoEm),
            dataStr: formatarData(lan.data || lan.criadoEm),
            descricao: `Lançamento: ${lan.descricao || lan.categoria || 'Caixa'} (${lan.formaPagto || 'Manual'})`,
            tipo: isReceita ? 'receita' : 'despesa',
            valor: valorLan
          });
        });
        
        listaTransacoes.sort((a, b) => b.dataTimestamp - a.dataTimestamp);
        setTransacoes(listaTransacoes);
        
        const lucroCalc = totalReceitas - totalDespesas;
        const margemCalc = totalReceitas > 0 ? Math.round((lucroCalc / totalReceitas) * 100) : (totalDespesas > 0 ? -100 : 100);

        setMetricas({ 
          receitas: totalReceitas, 
          despesas: totalDespesas, 
          lucro: lucroCalc,
          margem: margemCalc
        });
      } catch (error) {
        console.error("Erro ao carregar o financeiro:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosFinanceirosEConfigs();
  }, [usuarioLogado, tenantId]);
  
  const transacoesFiltradas = transacoes.filter(t => {
    if (filtroTipo === 'todos') return true;
    return t.tipo === filtroTipo;
  });

  const dadosGraficoMensal = React.useMemo(() => {
    const mapa = {};
    transacoes.forEach(t => {
      if (!t.dataStr) return;
      const partes = t.dataStr.split('/');
      if (partes.length === 3) {
        const mesAno = `${partes[1]}/${partes[2]}`;
        if (!mapa[mesAno]) mapa[mesAno] = { mes: mesAno, Receitas: 0, Despesas: 0 };
        if (t.tipo === 'receita') mapa[mesAno].Receitas += t.valor;
        else mapa[mesAno].Despesas += t.valor;
      }
    });
    const list = Object.values(mapa).reverse().slice(-5);
    if (list.length === 0) {
      return [{ mes: 'Mês Atual', Receitas: metricas.receitas, Despesas: metricas.despesas }];
    }
    return list;
  }, [transacoes, metricas.receitas, metricas.despesas]);

  const exportarPDF = async () => {
    try {
      const doc = new jsPDF();
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      let startY = 25;

      if (dadosEmpresa.logotipo && dadosEmpresa.logotipo.startsWith('data:image')) {
        try {
          doc.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 30, 30);
        } catch(e) {}
        
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text(dadosEmpresa.nomeEmpresa, 48, 20);
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        if (dadosEmpresa.cnpj) doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, 48, 26);
        if (dadosEmpresa.endereco) {
           const splitEndereco = doc.splitTextToSize(dadosEmpresa.endereco, 140);
           doc.text(splitEndereco, 48, 31);
        }
        startY = 50;
      } else {
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42); 
        doc.text(`Relatório Financeiro DRE - ${dadosEmpresa.nomeEmpresa}`, 14, 22);
        startY = 35;
      }

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      
      let tituloPDF = `DEMONSTRATIVO DE RESULTADOS (DRE)`;
      if (filtroTipo === 'receita') tituloPDF = `RELATÓRIO DE ENTRADAS (RECEITAS)`;
      if (filtroTipo === 'despesa') tituloPDF = `RELATÓRIO DE SAÍDAS (DESPESAS)`;
      
      doc.text(tituloPDF, 14, startY - 5);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${dataHoje}`, 160, startY - 5);

      doc.setFillColor(248, 250, 252);
      doc.rect(14, startY, 182, 25, 'F');
      
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`Total de Entradas: R$ ${metricas.receitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, startY + 8);
      doc.text(`Total de Saídas: R$ ${metricas.despesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, startY + 16);
      
      const saldoText = `SALDO EM CAIXA: R$ ${metricas.lucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${metricas.margem}% Margem)`;
      doc.setFont(undefined, 'bold');
      doc.setTextColor(metricas.lucro >= 0 ? 22 : 220, metricas.lucro >= 0 ? 163 : 38, metricas.lucro >= 0 ? 74 : 38);
      doc.text(saldoText, 100, startY + 12);

      const tableColumn = ["Data", "Descrição da Movimentação", "Tipo", "Valor (R$)"];
      
      const tableRows = transacoesFiltradas.map(t => [
        t.dataStr || '-',
        t.descricao || '-',
        t.tipo === 'receita' ? 'Entrada' : 'Saída',
        `${t.tipo === 'receita' ? '+' : '-'} R$ ${t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
      ]);
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY + 32, 
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }, 
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
      });
      
      doc.save(`Relatorio_DRE_${filtroTipo}_${dataHoje.replace(/\//g, '-')}.pdf`);
      await registrarLog("EXPORTAÇÃO DE RELATÓRIO FINANCEIRO", `Fez o download do DRE/Livro Caixa em PDF (Filtro utilizado: ${filtroTipo}).`);
    } catch (error) {
      console.error("Erro ao gerar PDF: ", error);
      alert("Erro ao gerar o PDF financeiro.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>Calculando DRE e indicadores de caixa...</div>;
  
  const totalMovimentado = metricas.receitas + metricas.despesas || 1; 
  const percReceita = Math.min(100, Math.max(0, Math.round((metricas.receitas / totalMovimentado) * 100)));

  let statusInsight = {
    icon: '🟢',
    label: 'FLUXO DE CAIXA SAUDÁVEL',
    tag: 'OPERAÇÃO LUCRATIVA',
    text: `Lucro real de R$ ${metricas.lucro.toLocaleString('pt-BR')} com margem de ${metricas.margem}%.`,
    bg: '#dcfce7',
    color: '#15803d',
    accentColor: '#10b981'
  };

  if (metricas.lucro < 0) {
    statusInsight = {
      icon: '🚨',
      label: 'ATENÇÃO AO FLUXO DE CAIXA',
      tag: 'DÉFICIT OPERACIONAL',
      text: `As saídas (R$ ${metricas.despesas.toLocaleString('pt-BR')}) superaram as receitas. Avalie compras e despesas.`,
      bg: '#fee2e2',
      color: '#b91c1c',
      accentColor: '#ef4444'
    };
  } else if (metricas.margem < 25) {
    statusInsight = {
      icon: '🟡',
      label: 'MARGEM DE LUCRO COMPRIMIDA',
      tag: 'ATENÇÃO OPERACIONAL',
      text: `Margem em ${metricas.margem}% (abaixo do ideal de 25%). Otimize compras de acervo e despesas fixas.`,
      bg: '#fef3c7',
      color: '#b45309',
      accentColor: '#f59e0b'
    };
  }

  return (
    <div className="fade-in">
      
      {/* 💡 CARD DE INSIGHT INTELIGENTE COMPACTO */}
      <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderLeft: `5px solid ${statusInsight.accentColor}`, padding: '14px 18px', borderRadius: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.3rem' }}>{statusInsight.icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '0.82rem', color: '#0f172a', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{statusInsight.label}</strong>
              <span style={{ fontSize: '0.66rem', fontWeight: 850, padding: '2px 8px', borderRadius: '6px', background: statusInsight.bg, color: statusInsight.color }}>
                {statusInsight.tag}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.3 }}>{statusInsight.text}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Margem Real</div>
          <strong style={{ fontSize: '1rem', color: metricas.lucro >= 0 ? '#10b981' : '#ef4444', fontWeight: 900 }}>
            {metricas.margem}%
          </strong>
        </div>
      </div>

      {/* 4 CARDS KPI BLINDADOS (GOLDEN RULE 1 & 2) */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro card-green">
          <div className="stat-icon-wrapper icon-green">🟢</div>
          <div className="stat-content">
            <span className="stat-title">ENTRADAS EFETIVAS</span>
            <strong className="stat-number">R$ {metricas.receitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Receitas consolidadas</small>
          </div>
        </div>
        
        <div className="stat-card-pro card-red">
          <div className="stat-icon-wrapper icon-red">🔴</div>
          <div className="stat-content">
            <span className="stat-title">SAÍDAS &amp; CUSTOS</span>
            <strong className="stat-number">R$ {metricas.despesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <small className="stat-desc">Despesas &amp; Compras</small>
          </div>
        </div>

        <div className="stat-card-pro card-purple">
          <div className="stat-icon-wrapper icon-purple">🏦</div>
          <div className="stat-content">
            <span className="stat-title">LUCRO OPERACIONAL (DRE)</span>
            <strong className="stat-number" style={{ color: metricas.lucro >= 0 ? '#10b981' : '#ef4444' }}>
              R$ {metricas.lucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </strong>
            <small className="stat-desc">Caixa líquido real</small>
          </div>
        </div>

        <div className="stat-card-pro card-amber">
          <div className="stat-icon-wrapper icon-amber">📈</div>
          <div className="stat-content">
            <span className="stat-title">MARGEM DE LUCRO REAL</span>
            <strong className="stat-number">{metricas.margem}%</strong>
            <small className="stat-desc">Eficiência operacional</small>
          </div>
        </div>
      </div>

      {/* 📊 PAINEL COMPACTO DE BALANÇO & RESUMO MENSAL (ZERO WHITE BOXES!) */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #e2e8f0', padding: '16px 20px', margin: '16px 0', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: '850' }}>📊 Balanço Proporcional de Entradas vs Saídas</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>Proporção consolidada do volume financeiro</p>
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981' }}>🟢 Entradas: R$ {metricas.receitas.toLocaleString('pt-BR')} ({percReceita}%)</span>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ef4444' }}>🔴 Saídas: R$ {metricas.despesas.toLocaleString('pt-BR')} ({100 - percReceita}%)</span>
          </div>
        </div>

        {/* BARRA EMPILHADA SLEEK DE 10px */}
        <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex', marginBottom: '12px' }}>
          <div style={{ width: `${percReceita}%`, background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', transition: 'width 0.8s ease' }} title={`Entradas: ${percReceita}%`} />
          <div style={{ width: `${100 - percReceita}%`, background: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)', transition: 'width 0.8s ease' }} title={`Saídas: ${100 - percReceita}%`} />
        </div>

        {/* CHIPS COMPACTOS DE MÊS */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {dadosGraficoMensal.map((item, idx) => (
            <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 10px', borderRadius: '10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ color: '#0f172a' }}>📅 {item.mes}:</strong>
              <span style={{ color: '#10b981', fontWeight: 800 }}>+R$ {item.Receitas >= 1000 ? (item.Receitas/1000).toFixed(1) + 'k' : item.Receitas.toLocaleString('pt-BR')}</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span style={{ color: '#ef4444', fontWeight: 800 }}>-R$ {item.Despesas >= 1000 ? (item.Despesas/1000).toFixed(1) + 'k' : item.Despesas.toLocaleString('pt-BR')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* EXTRATO DRE & TABELA */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}>
        <div className="dre-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: '850' }}>📋 DRE - Livro Caixa Efetivado</h3>
            <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>Extrato detalhado de movimentações registradas na empresa.</p>
          </div>
          
          <div className="dre-actions-group">
            <div className="dre-filter-buttons">
              <button 
                type="button"
                className={filtroTipo === 'todos' ? 'active' : ''} 
                onClick={() => setFiltroTipo('todos')}
              >
                Todos
              </button>
              <button 
                type="button"
                className={filtroTipo === 'receita' ? 'active btn-verde' : ''} 
                onClick={() => setFiltroTipo('receita')}
              >
                🟢 Entradas
              </button>
              <button 
                type="button"
                className={filtroTipo === 'despesa' ? 'active btn-vermelho' : ''} 
                onClick={() => setFiltroTipo('despesa')}
              >
                🔴 Saídas
              </button>
            </div>
            
            <button type="button" className="btn-export-pdf" onClick={exportarPDF}>
              📄 Baixar Relatório (PDF)
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
              {transacoesFiltradas.length === 0 ? (
                <tr>
                   <td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhuma movimentação encontrada para este filtro.</td>
                </tr>
              ) : (
                transacoesFiltradas.map((t) => (
                  <tr key={t.id}>
                    <td style={{color: '#64748b', fontWeight: '600'}}>{t.dataStr}</td>
                    <td>
                      <strong style={{color: '#0f172a'}}>{t.descricao}</strong>
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <span className={`badge-dre ${t.tipo}`}>
                        {t.tipo === 'receita' ? '🟢 Entrada' : '🔴 Saída'}
                      </span>
                    </td>
                    <td style={{
                      textAlign: 'right', 
                      fontWeight: '850', 
                      color: t.tipo === 'receita' ? '#10b981' : '#ef4444'
                    }}>
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
    </div>
  );
};

export default FinanceiroTab;