import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
// --- IMPORTAÇÕES DO PDF ---
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

import './FinanceiroTab.css';

const FinanceiroTab = () => {
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ receitas: 0, despesas: 0, lucro: 0 });
  const [transacoes, setTransacoes] = useState([]);
  
  // 🔥 NOVO ESTADO: Controla qual aba do Livro Caixa está ativa
  const [filtroTipo, setFiltroTipo] = useState('todos');
  
  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: '',
    cnpj: '',
    endereco: ''
  });

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO FINANCEIRO VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: tenantId, // 🎯 SALVA VINCULADO À EMPRESA
        empresaId: tenantId,
        funcionarioId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria financeira:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) return; 

    const buscarDadosFinanceirosEConfigs = async () => {
      try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS as informações da sua empresa
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const qCompras = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
        const qLancamentos = query(collection(db, "financeiro_lancamentos"), where("userId", "==", tenantId));

        const [snapLocacoes, snapCompras, snapLancamentos, snapConfig] = await Promise.all([
          getDocs(qLocacoes),
          getDocs(qCompras),
          getDocs(qLancamentos).catch(() => ({ docs: [] })),
          getDoc(doc(db, "sistema", "parametros"))
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
                  descricao: `Pagamento de Pedido: ${loc.clienteNome} ${loc.numeroPedido ? `(#${loc.numeroPedido})` : ''}`,
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
                descricao: `Sinal / Pagamento: ${loc.clienteNome} ${loc.numeroPedido ? `(#${loc.numeroPedido})` : ''}`,
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
              descricao: `Compra: ${comp.nome} (${comp.quantidade}x)`,
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
            descricao: `Lançamento: ${lan.descricao || lan.categoria} (${lan.formaPagto || 'Manual'})`,
            tipo: isReceita ? 'receita' : 'despesa',
            valor: valorLan
          });
        });
        
        listaTransacoes.sort((a, b) => b.dataTimestamp - a.dataTimestamp);
        setTransacoes(listaTransacoes);
        setMetricas({ receitas: totalReceitas, despesas: totalDespesas, lucro: totalReceitas - totalDespesas });
      } catch (error) {
        console.error("Erro ao carregar o financeiro:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosFinanceirosEConfigs();
  }, [usuarioLogado, tenantId]);
  
  // 🔥 LÓGICA DE FILTRO: Só mostra o que o utilizador escolheu no botão
  const transacoesFiltradas = transacoes.filter(t => {
    if (filtroTipo === 'todos') return true;
    return t.tipo === filtroTipo;
  });
  
  // --- FUNÇÃO GERAR PDF ---
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
        doc.text(`Relatório Financeiro - ${dadosEmpresa.nomeEmpresa}`, 14, 22);
        startY = 35;
      }

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      
      // Ajusta o título do PDF conforme o filtro selecionado
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
      
      const saldoText = `SALDO EM CAIXA: R$ ${metricas.lucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
      doc.setFont(undefined, 'bold');
      doc.setTextColor(metricas.lucro >= 0 ? 22 : 220, metricas.lucro >= 0 ? 163 : 38, metricas.lucro >= 0 ? 74 : 38);
      doc.text(saldoText, 110, startY + 12);

      const tableColumn = ["Data", "Descrição da Movimentação", "Tipo", "Valor (R$)"];
      
      // O PDF agora imprime apenas as transações filtradas!
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
      
      doc.save(`Relatorio_${filtroTipo}_${dataHoje.replace(/\//g, '-')}.pdf`);

      // 🔥 Aciona o espião de exportação financeira
      await registrarLog("EXPORTAÇÃO DE RELATÓRIO FINANCEIRO", `Fez o download do DRE/Livro Caixa em PDF (Filtro utilizado: ${filtroTipo}).`);
    } catch (error) {
      console.error("Erro ao gerar PDF: ", error);
      alert("Erro ao gerar o PDF financeiro.");
    }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center', color: 'var(--texto-secundario)', fontWeight: 'bold'}}>Calculando DRE do Caixa...</div>;
  
  const totalMovimentado = metricas.receitas + metricas.despesas || 1; 
  const percReceita = Math.max(10, (metricas.receitas / totalMovimentado) * 100);
  const percDespesa = Math.max(10, (metricas.despesas / totalMovimentado) * 100);

  return (
    <div className="fade-in">
      <div className="kpi-grid">
        <div className="kpi-card card-verde">
          <span>ENTRADAS EFETIVAS</span>
          <h2>R$ {metricas.receitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
          <small>Sinais e recebimentos pagos</small>
        </div>
        
        <div className="kpi-card card-vermelho">
          <span>SAÍDAS EFETIVAS</span>
          <h2>R$ {metricas.despesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
          <small>Compras e despesas pagas</small>
        </div>
        
        <div className="kpi-card card-destaque">
          <span>SALDO EM CAIXA (DRE)</span>
          <h2 style={{ color: metricas.lucro >= 0 ? '#10b981' : '#ef4444' }}>
            R$ {metricas.lucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
          </h2>
          <small>Dinheiro real disponível</small>
        </div>
      </div>

      <div className="main-card mt-20">
        <h3>📊 Saúde do Fluxo de Caixa</h3>
        <p style={{fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '15px'}}>Proporção entre recebimentos e pagamentos consolidados.</p>
        <div className="progress-container">
          <div className="progress-bar-green" style={{ width: `${percReceita}%` }}></div>
          <div className="progress-bar-red" style={{ width: `${percDespesa}%` }}></div>
        </div>
        <div className="progress-labels">
          <span style={{color: '#10b981', fontWeight: 'bold'}}>Entradas ({percReceita.toFixed(0)}%)</span>
          <span style={{color: '#ef4444', fontWeight: 'bold'}}>Saídas ({percDespesa.toFixed(0)}%)</span>
        </div>
      </div>

      <div className="main-card mt-20">
        <div className="dre-header">
          <div>
            <h3>📋 DRE - Livro Caixa</h3>
            <p style={{fontSize: '13px', color: 'var(--texto-secundario)', marginTop: '4px'}}>Extrato real de entradas e saídas efetivadas na empresa.</p>
          </div>
          
          {/* 🔥 AQUI ENTRAM OS NOVOS BOTÕES DE FILTRO AO LADO DO PDF 🔥 */}
          <div className="dre-actions-group">
            <div className="dre-filter-buttons">
              <button 
                className={filtroTipo === 'todos' ? 'active' : ''} 
                onClick={() => setFiltroTipo('todos')}
              >
                Todos
              </button>
              <button 
                className={filtroTipo === 'receita' ? 'active btn-verde' : ''} 
                onClick={() => setFiltroTipo('receita')}
              >
                ⬆ Entradas
              </button>
              <button 
                className={filtroTipo === 'despesa' ? 'active btn-vermelho' : ''} 
                onClick={() => setFiltroTipo('despesa')}
              >
                ⬇ Saídas
              </button>
            </div>
            
            <button className="btn-export-pdf" onClick={exportarPDF}>
              📄 Salvar PDF
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
              {/* O map agora roda em cima das transacoesFiltradas! */}
              {transacoesFiltradas.length === 0 ? (
                <tr>
                   <td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhuma movimentação encontrada para este filtro.</td>
                </tr>
              ) : (
                transacoesFiltradas.map((t) => (
                  <tr key={t.id}>
                    <td style={{color: 'var(--texto-secundario)', fontWeight: '500'}}>{t.dataStr}</td>
                    <td>
                      <strong style={{color: 'var(--texto-principal)'}}>{t.descricao}</strong>
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <span className={`badge-dre ${t.tipo}`}>
                        {t.tipo === 'receita' ? '⬆ Entrada' : '⬇ Saída'}
                      </span>
                    </td>
                    <td style={{
                      textAlign: 'right', 
                      fontWeight: '800', 
                      color: t.tipo === 'receita' ? '#10b981' : '#ef4444'
                    }}>
                      {t.tipo === 'receita' ? '+ ' : '- '} 
                      {t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
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