import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebrePadrao from '../assets/LOGO_CELEBRE.png';
import { verificarAssinaturaAtiva } from './periodoTesteUtils';

/**
 * 🧹 Sanitiza textos removendo emojis sem corromper acentos do português (Latin-1)
 */
const sanitizar = (texto) => {
  if (!texto) return '';
  return String(texto)
    // Remove apenas emojis e símbolos fora da faixa básica
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatarMoeda = (valor) => {
  const num = typeof valor === 'number' ? valor : parseFloat(String(valor || '0').replace(',', '.'));
  return (isNaN(num) ? 0 : num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * 📄 GERADOR EXECUTIVO DO RELATÓRIO MENSAL DE FATURAMENTO & AUDITORIA MASTER
 * Padrão Visual: Celebre Luxury Enterprise (Stripe / Goldman Sachs Inspired)
 */
export const gerarRelatorioFaturamentoAdminPDF = ({
  faturas = [],
  clientes = [],
  periodoRotulo = 'MÊS ATUAL',
  mesNome = '',
  ano = new Date().getFullYear(),
  somenteQuitadas = false,
  modo = 'download' // 'download' | 'preview'
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Cores Nobres Celebre
  const primaryColor = [15, 23, 42];     // #0f172a (Azul Marinho Noturno)
  const goldColor = [197, 160, 89];      // #c5a059 (Dourado Celebre)
  const darkGray = [51, 65, 85];         // #334155
  const slateGray = [100, 116, 139];     // #64748b
  const lightGray = [248, 250, 252];     // #f8fafc
  const cardBorderColor = [226, 232, 240]; // #e2e8f0
  const successColor = [22, 163, 74];    // #16a34a (Verde Quitado)
  const dangerColor = [220, 38, 38];     // #dc2626 (Vermelho Recusa)
  const blueColor = [37, 99, 235];       // #2563eb (Azul Cortesia)

  // Filtragem se selecionado apenas quitadas
  const faturasProcessar = somenteQuitadas 
    ? faturas.filter(f => f.status === 'concluido' || f.status === 'cortesia')
    : faturas;

  // 1. CÁLCULO DAS MÉTRICAS DO RELATÓRIO
  let receitaTotalQuitada = 0;
  let totalQuitadas = 0;
  let totalRecusadas = 0;
  let totalTentativas = 0;
  let totalCortesias = 0;

  let totalPixValor = 0;
  let totalPixQtd = 0;
  let totalCartaoValor = 0;
  let totalCartaoQtd = 0;
  let totalBoletoValor = 0;
  let totalBoletoQtd = 0;

  let planosMap = {
    basico: { nome: 'Plano Básico', valorUnitario: 'R$ 49,90/mês', qtd: 0, valor: 0 },
    premium: { nome: 'Plano Premium', valorUnitario: 'R$ 99,90/mês', qtd: 0, valor: 0 },
    plus: { nome: 'Plano Plus', valorUnitario: 'R$ 159,90/mês', qtd: 0, valor: 0 },
    cortesia: { nome: 'Cortesia VIP (Licença)', valorUnitario: 'Isento (R$ 0,00)', qtd: 0, valor: 0 }
  };

  faturasProcessar.forEach(f => {
    const v = Number(f.valor) || 0;
    const met = String(f.metodo || '').toLowerCase();
    const detLower = String(f.detalhes || '').toLowerCase();

    if (f.status === 'concluido') {
      receitaTotalQuitada += v;
      totalQuitadas++;

      // Segmentação por Método
      if (met.includes('pix') || detLower.includes('pix')) {
        totalPixValor += v;
        totalPixQtd++;
      } else if (met.includes('bol') || detLower.includes('boleto')) {
        totalBoletoValor += v;
        totalBoletoQtd++;
      } else {
        totalCartaoValor += v;
        totalCartaoQtd++;
      }

      // Segmentação por Plano
      if (detLower.includes('basic') || detLower.includes('básic') || v <= 55) {
        planosMap.basico.qtd++;
        planosMap.basico.valor += v;
      } else if (detLower.includes('plus') || v > 120) {
        planosMap.plus.qtd++;
        planosMap.plus.valor += v;
      } else {
        planosMap.premium.qtd++;
        planosMap.premium.valor += v;
      }

    } else if (f.status === 'falha') {
      totalRecusadas++;
    } else if (f.status === 'cortesia') {
      totalCortesias++;
      planosMap.cortesia.qtd++;
    } else {
      totalTentativas++;
    }
  });

  // Cálculo do MRR e Assinantes Ativos
  let mrrTotal = 0;
  let totalAssinantesAtivos = 0;
  clientes.forEach(c => {
    // 🚫 Filtro rigoroso: descarta equipe, admin e contas suspensas ou bloqueadas
    if (c.isFuncionarioVinculado || c.role === 'funcionario') return;
    if (c.status === 'admin' || c.email === 'celebrefesta25@gmail.com') return;
    if (c.status === 'suspenso' || c.statusConta === 'suspenso' || c.rawUserData?.statusConta === 'suspenso' || c.status === 'excluido') return;
    if (c.status === 'bloqueado') return;

    const isAtivo = c.status === 'ativo' && (c.assinaturaAtiva === true || c.statusAssinatura === 'ativa' || c.plano === 'pago' || c.isAssinantePago) && verificarAssinaturaAtiva(c).ativa;
    if (isAtivo) {
      totalAssinantesAtivos++;
      const rawP = String(c.planoId || c.plano || '').toLowerCase();
      if (c.rawUserData?.valorAssinatura) {
        mrrTotal += parseFloat(String(c.rawUserData.valorAssinatura).replace(',', '.'));
      } else if (rawP.includes('plus')) {
        mrrTotal += 159.90;
      } else if (rawP.includes('basico')) {
        mrrTotal += 49.90;
      } else {
        mrrTotal += 99.90;
      }
    }
  });

  const totalTransacoesConsideradas = totalQuitadas + totalRecusadas + totalTentativas;
  const taxaAprovacao = totalTransacoesConsideradas > 0 
    ? ((totalQuitadas / totalTransacoesConsideradas) * 100).toFixed(1) 
    : '100.0';

  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hashProtocolo = `FAT-REL-${ano}-${Math.floor(100000 + Math.random() * 900000)}`;

  doc.setProperties({
    title: `Relatório de Faturamento Celebre - ${periodoRotulo}`,
    subject: 'Auditoria Mensal de Faturamento & Assinaturas SaaS',
    author: 'Celebre Super Admin',
    creator: 'Celebre Sistema Integrado (CELEBRE02)'
  });

  // ============================================================================
  // 1. CABEÇALHO MASTER LUXURY (Azul Marinho Noturno + Borda Dourada Celebre)
  // ============================================================================
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 30, 'F');

  doc.setFillColor(...goldColor);
  doc.rect(0, 30, 210, 2, 'F');

  // Logotipo Celebre
  let textStartX = 14;
  if (logoCelebrePadrao) {
    try {
      doc.addImage(logoCelebrePadrao, 'PNG', 12, 4, 22, 22);
      textStartX = 38;
    } catch (e) {
      console.warn("Aviso logotipo PDF:", e);
    }
  }

  // Bloco Esquerdo: Nome da Marca & Subtítulo
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text('CELEBRE GESTÃO INTEGRADA', textStartX, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // #cbd5e1
  doc.text('CONTROLE GERAL & AUDITORIA MASTER DE ASSINATURAS', textStartX, 16.8);
  doc.text(`Protocolo: ${hashProtocolo}   |   Autenticação Oficial Firestore`, textStartX, 22);

  // Bloco Direito: Título do Documento & Badge do Período
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...goldColor);
  doc.text('RELATÓRIO MENSAL DE FATURAMENTO', 196, 11, { align: 'right' });

  // Badge Dourado do Período
  const periodoTexto = sanitizar(periodoRotulo.toUpperCase());
  const badgeWidth = doc.getTextWidth(periodoTexto) + 10;
  const badgeX = 196 - badgeWidth;
  doc.setFillColor(...goldColor);
  doc.roundedRect(badgeX, 13.5, badgeWidth, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text(periodoTexto, badgeX + (badgeWidth / 2), 17.7, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emissão: ${dataEmissao} às ${horaEmissao}`, 196, 24.5, { align: 'right' });

  // ============================================================================
  // 2. PAINEL EXECUTIVO DE INDICADORES (4 CARDS MODERNOS COM STRIPE LATERAL)
  // ============================================================================
  let y = 37;
  const boxWidth = 43.5;
  const boxHeight = 20;
  const gap = 3;
  const startX = 14;

  const kpis = [
    {
      titulo: 'RECEITA QUITADA',
      valor: `R$ ${formatarMoeda(receitaTotalQuitada)}`,
      sub: `${totalQuitadas} ${totalQuitadas === 1 ? 'fatura paga' : 'faturas pagas'}`,
      corBorda: successColor,
      corFundo: [240, 253, 244], // #f0fdf4
      corTagFundo: [220, 252, 231],
      corTagTexto: [22, 101, 52]
    },
    {
      titulo: 'RECEITA RECORRENTE (MRR)',
      valor: `R$ ${formatarMoeda(mrrTotal)}`,
      sub: 'Previsão Mensal das Assinaturas',
      corBorda: goldColor,
      corFundo: [254, 252, 232], // #fefce8
      corTagFundo: [254, 240, 138],
      corTagTexto: [133, 77, 14]
    },
    {
      titulo: 'ASSINANTES ATIVOS',
      valor: `${totalAssinantesAtivos}`,
      sub: `${totalAssinantesAtivos} empresas ativas`,
      corBorda: blueColor,
      corFundo: [239, 246, 255], // #eff6ff
      corTagFundo: [219, 234, 254],
      corTagTexto: [30, 64, 175]
    },
    {
      titulo: 'TAXA DE SUCESSO',
      valor: `${taxaAprovacao}%`,
      sub: totalRecusadas > 0 ? `${totalRecusadas} ${totalRecusadas === 1 ? 'recusa no período' : 'recusas no período'}` : 'Zero falhas no período',
      corBorda: totalRecusadas > 0 ? dangerColor : [16, 185, 129],
      corFundo: totalRecusadas > 0 ? [254, 242, 242] : [240, 253, 244],
      corTagFundo: totalRecusadas > 0 ? [254, 226, 226] : [220, 252, 231],
      corTagTexto: totalRecusadas > 0 ? [153, 27, 27] : [22, 101, 52]
    }
  ];

  kpis.forEach((kpi, idx) => {
    const bx = startX + idx * (boxWidth + gap);

    // Fundo do card
    doc.setFillColor(...kpi.corFundo);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'F');

    // Borda colorida elegante e sem vazamento
    doc.setDrawColor(...kpi.corBorda);
    doc.setLineWidth(0.45);
    doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'D');

    // Tag Superior de Categoria
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...kpi.corTagTexto);
    doc.text(kpi.titulo, bx + 3.8, y + 5.2);

    // Valor em destaque
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(kpi.valor, bx + 3.8, y + 12.2);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...darkGray);
    doc.text(kpi.sub, bx + 3.8, y + 17);
  });

  y += boxHeight + 6;

  // ============================================================================
  // 3. TABELAS DE SEGMENTAÇÃO: MÉTODO DE PAGAMENTO & PLANOS (ESTRUTURA CORPORATIVA)
  // ============================================================================
  const wTable = 89;
  const startX2 = 107;

  // Bloco Esquerdo: Métodos de Pagamento
  doc.setFillColor(...lightGray);
  doc.roundedRect(startX, y, wTable, 25, 2, 2, 'F');
  doc.setDrawColor(...cardBorderColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, y, wTable, 25, 2, 2, 'D');

  // Cabeçalho Bloco Esquerdo
  doc.setFillColor(...primaryColor);
  doc.roundedRect(startX, y, wTable, 6, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('LIQUIDAÇÃO POR MÉTODO DE PAGAMENTO', startX + 4, y + 4.2);
  doc.text('QTD', startX + 54, y + 4.2);
  doc.text('TOTAL (R$)', startX + 85, y + 4.2, { align: 'right' });

  // Linhas Bloco Esquerdo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...darkGray);

  // PIX
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('• PIX Instantâneo', startX + 4, y + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`${totalPixQtd} transação`, startX + 54, y + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatarMoeda(totalPixValor)}`, startX + 85, y + 10.5, { align: 'right' });

  // Cartão
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('• Cartão de Crédito', startX + 4, y + 15.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`${totalCartaoQtd} transações`, startX + 54, y + 15.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatarMoeda(totalCartaoValor)}`, startX + 85, y + 15.5, { align: 'right' });

  // Boleto
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('• Boleto Bancário', startX + 4, y + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`${totalBoletoQtd} transações`, startX + 54, y + 20.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatarMoeda(totalBoletoValor)}`, startX + 85, y + 20.5, { align: 'right' });


  // Bloco Direito: Categorias de Planos
  doc.setFillColor(...lightGray);
  doc.roundedRect(startX2, y, wTable, 25, 2, 2, 'F');
  doc.setDrawColor(...cardBorderColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX2, y, wTable, 25, 2, 2, 'D');

  // Cabeçalho Bloco Direito
  doc.setFillColor(...primaryColor);
  doc.roundedRect(startX2, y, wTable, 6, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('FATURAMENTO POR CATEGORIA DE PLANO', startX2 + 4, y + 4.2);
  doc.text('ATIVOS', startX2 + 56, y + 4.2);
  doc.text('TOTAL (R$)', startX2 + 85, y + 4.2, { align: 'right' });

  // Linhas Bloco Direito
  // Básico
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('• Plano Básico', startX2 + 4, y + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`${planosMap.basico.qtd} quitados`, startX2 + 56, y + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatarMoeda(planosMap.basico.valor)}`, startX2 + 85, y + 10.5, { align: 'right' });

  // Premium
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('• Plano Premium', startX2 + 4, y + 15.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`${planosMap.premium.qtd} quitados`, startX2 + 56, y + 15.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatarMoeda(planosMap.premium.valor)}`, startX2 + 85, y + 15.5, { align: 'right' });

  // Cortesias
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('• Cortesias VIP', startX2 + 4, y + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`${totalCortesias} licenças`, startX2 + 56, y + 20.5);
  doc.setFont('helvetica', 'bold');
  doc.text('R$ 0,00 (Isento)', startX2 + 85, y + 20.5, { align: 'right' });

  y += 30;

  // ============================================================================
  // 4. TABELA ANALÍTICA COMPLETA DE TRANSAÇÕES AUDITADAS (autoTable)
  // ============================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text(`DEMONSTRATIVO ANALÍTICO DE FATURAS (${faturasProcessar.length} REGISTROS AUDITADOS)`, startX, y - 2);

  const colunas = [
    { header: 'FATURA / CÓD', dataKey: 'codigo' },
    { header: 'EMPRESA / ASSINANTE', dataKey: 'empresa' },
    { header: 'DATA & HORA', dataKey: 'data' },
    { header: 'EVENTO / PLANO', dataKey: 'descricao' },
    { header: 'MÉTODO', dataKey: 'metodo' },
    { header: 'VALOR', dataKey: 'valor' },
    { header: 'STATUS', dataKey: 'status' }
  ];

  const linhas = faturasProcessar.map(f => {
    let statusLabel = 'QUITADO';
    if (f.status === 'falha') statusLabel = 'RECUSADO';
    else if (f.status === 'cortesia') statusLabel = 'CORTESIA VIP';
    else if (f.status === 'tentativa') statusLabel = 'TENTATIVA';
    else if (f.status === 'mudanca') statusLabel = 'MIGRAÇÃO';
    else if (f.status === 'pendente') statusLabel = 'PENDENTE';

    let valorStr = f.status === 'cortesia' ? 'R$ 0,00' : `R$ ${formatarMoeda(f.valor)}`;

    const nomeEmp = sanitizar(f.empresaNome || 'Empresa');
    const emailEmp = sanitizar(f.email || '');
    const empresaFull = emailEmp ? `${nomeEmp}\n${emailEmp}` : nomeEmp;

    return {
      codigo: f.codigo || '—',
      empresa: empresaFull,
      data: `${f.dataFormatada || ''} ${f.horaFormatada || ''}`,
      descricao: sanitizar(f.acao || f.detalhes || 'Assinatura'),
      metodo: sanitizar(f.metodo || 'PIX'),
      valor: valorStr,
      status: statusLabel,
      _rawStatus: f.status
    };
  });

  autoTable(doc, {
    startY: y,
    columns: colunas,
    body: linhas,
    theme: 'plain',
    margin: { left: 14, right: 14, bottom: 20 },
    styles: {
      fontSize: 7.2,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 },
      valign: 'middle',
      lineColor: cardBorderColor,
      lineWidth: 0.25,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // #f8fafc
    },
    // Larguras calibradas rigorosamente para somar exatamente 182mm (Margens de 14mm em A4 210mm)
    columnStyles: {
      codigo: { cellWidth: 26, fontStyle: 'bold', textColor: primaryColor, fontSize: 7, cellPadding: { left: 1.5, right: 1.5, top: 3.2, bottom: 3.2 } },
      empresa: { cellWidth: 42 },
      data: { cellWidth: 20, fontSize: 6.8, halign: 'center' },
      descricao: { cellWidth: 35 },
      metodo: { cellWidth: 15, halign: 'center' },
      valor: { cellWidth: 19, halign: 'right', fontStyle: 'bold' },
      status: { cellWidth: 25, halign: 'center', fontStyle: 'bold' } // Garante que "RECUSADO" e "CORTESIA VIP" nunca quebrem linha!
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.dataKey === 'status') {
        const rawSt = data.row.raw._rawStatus;
        if (rawSt === 'concluido') {
          data.cell.styles.textColor = successColor;
        } else if (rawSt === 'falha') {
          data.cell.styles.textColor = dangerColor;
        } else if (rawSt === 'cortesia') {
          data.cell.styles.textColor = blueColor;
        } else {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
      if (data.section === 'body' && data.column.dataKey === 'valor') {
        const rawSt = data.row.raw._rawStatus;
        if (rawSt === 'concluido') {
          data.cell.styles.textColor = successColor;
        } else if (rawSt === 'falha') {
          data.cell.styles.textColor = dangerColor;
        } else {
          data.cell.styles.textColor = primaryColor;
        }
      }
    },
    foot: [
      [
        { content: 'TOTAL GERAL LIQUIDADO NO PERÍODO:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, textColor: primaryColor } },
        { content: `R$ ${formatarMoeda(receitaTotalQuitada)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: successColor, fontSize: 8.8 } },
        { content: `${totalQuitadas} quitados`, styles: { halign: 'center', fontSize: 7.2, fontStyle: 'bold', textColor: successColor } }
      ]
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: primaryColor,
      lineColor: cardBorderColor,
      lineWidth: 0.3
    }
  });

  // ============================================================================
  // 5. BLOCO DE HOMOLOGAÇÃO & AUDITORIA FINAL
  // ============================================================================
  const finalY = doc.lastAutoTable?.finalY || 200;
  if (finalY < 240) {
    const auditBoxY = finalY + 8;
    doc.setFillColor(...lightGray);
    doc.roundedRect(14, auditBoxY, 182, 22, 2, 2, 'F');
    doc.setDrawColor(...cardBorderColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, auditBoxY, 182, 22, 2, 2, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...primaryColor);
    doc.text('TERMO DE AUDITORIA & CONCILIAÇÃO BANCÁRIA MASTER', 18, auditBoxY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...darkGray);
    doc.text('Declaramos que todos os valores e eventos constantes neste demonstrativo foram processados pelo gateway oficial Mercado Pago e', 18, auditBoxY + 9.5);
    doc.text('conciliados de forma atômica na coleção logs_atividades e registros de usuários no banco de dados Celebre Sistema Integrado.', 18, auditBoxY + 13);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...goldColor);
    doc.text(`Homologado por: Super Admin Celebre   •   Data: ${dataEmissao} às ${horaEmissao}   •   Chave de Autenticação: ${hashProtocolo}`, 18, auditBoxY + 18);
  }

  // ============================================================================
  // 6. RODAPÉ INSTITUCIONAL & NUMERAÇÃO DE PÁGINAS (Página X de Y)
  // ============================================================================
  const totalPaginas = doc.internal.getNumberOfPages();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);

    // Linha divisória de rodapé
    doc.setDrawColor(...cardBorderColor);
    doc.setLineWidth(0.3);
    doc.line(14, 287, 196, 287);

    // Texto de autenticidade
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateGray);
    doc.text('Celebre Festas & Sistema de Gestão  •  Relatório Oficial de Auditoria Contábil e Assinaturas  •  celebrefesta.com.br', 14, 291.5);

    // Paginação
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPaginas}`, 196, 291.5, { align: 'right' });
  }

  // ============================================================================
  // 7. SAÍDA (DOWNLOAD OU PREVIEW)
  // ============================================================================
  const nomeArquivoSanitizado = `Celebre_Relatorio_Mensal_${sanitizar(mesNome || 'Auditoria')}_${ano}.pdf`.replace(/\s+/g, '_');

  if (modo === 'preview') {
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    doc.save(nomeArquivoSanitizado);
  }

  return true;
};
