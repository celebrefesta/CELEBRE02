import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebrePadrao from '../assets/LOGO_CELEBRE.png';

const sanitizarTexto = (texto) => {
  if (!texto) return '';
  return String(texto)
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
};

export const gerarRelatorioPedidosPDF = ({
  empresa = {},
  metricas = {},
  pedidos = [],
  totaisFiltro = {},
  filtroAtual = 'TODOS',
  filtroMes = '',
  filtroAno = '',
  usuarioEmail = ''
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [15, 23, 42];    // #0f172a
  const goldColor = [197, 160, 89];     // #c5a059
  const darkGray = [51, 65, 85];        // #334155
  const lightGray = [248, 250, 252];    // #f8fafc
  const borderColor = [226, 232, 240];  // #e2e8f0
  const successColor = [22, 163, 74];   // #16a34a

  const nomeEmpresa = sanitizarTexto(
    empresa?.nomeEmpresa || 
    empresa?.nomeFantasia || 
    empresa?.razaoSocial || 
    localStorage.getItem('nomeEmpresa') || 
    localStorage.getItem('funcName') || 
    'EMPRESA'
  );
  const cnpjEmpresa = empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : '';
  const telEmpresa = empresa?.telefone || empresa?.celular || '';
  const emailEmpresa = empresa?.emailEmpresa || empresa?.email || '';

  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  doc.setProperties({
    title: `RELATÓRIO COMERCIAL DE PEDIDOS - ${nomeEmpresa}`,
    subject: 'Relatório Executivo de Contratos, Orçamentos e Faturamento',
    author: nomeEmpresa,
    creator: 'Sistema de Gestão Celebre'
  });

  // 1. BANNER CABEÇALHO
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFillColor(...goldColor);
  doc.rect(0, 28, 210, 2, 'F');

  const logoEmpresaSrc = empresa?.logotipo || empresa?.logoUrl || empresa?.logo || logoCelebrePadrao;
  let textStartX = 14;

  if (logoEmpresaSrc && typeof logoEmpresaSrc === 'string' && logoEmpresaSrc.length > 20) {
    try {
      const isJpeg = logoEmpresaSrc.includes('image/jpeg') || logoEmpresaSrc.includes('image/jpg');
      const format = isJpeg ? 'JPEG' : 'PNG';
      doc.addImage(logoEmpresaSrc, format, 12, 3, 22, 22);
      textStartX = 38;
    } catch (e) {
      console.error("Erro ao desenhar logotipo:", e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(nomeEmpresa, textStartX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const infoEmpresaLinha = [cnpjEmpresa, telEmpresa, emailEmpresa].filter(Boolean).join(' | ');
  doc.text(infoEmpresaLinha, textStartX, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...goldColor);
  doc.text('PEDIDOS & DESEMPENHO COMERCIAL', 196, 12, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`FILTRO: ${filtroAtual.toUpperCase()}`, 196, 18, { align: 'right' });

  // 2. METADADOS
  let y = 35;
  doc.setFillColor(...lightGray);
  doc.rect(14, y, 182, 7, 'F');
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(14, y, 182, 7, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`Emissão: ${dataEmissao} às ${horaEmissao}`, 18, y + 4.8);
  doc.text(`Operador: ${usuarioEmail || 'Administrador'}`, 105, y + 4.8, { align: 'center' });
  doc.text(`Total: ${pedidos.length} pedidos listados`, 192, y + 4.8, { align: 'right' });

  y += 12;

  // 3. KPI STATS CARDS
  const cardWidth = 43;
  const cardHeight = 22;
  const cardGap = 3.3;
  const startX = 14;

  const total = metricas.total || 0;
  const faturamento = metricas.faturamento || 0;
  const taxaConversao = metricas.taxaConversao || 0;
  const futuros = metricas.futuros || 0;

  // Card 1
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(startX, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(startX, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(...successColor);
  doc.rect(startX, y, 2.5, cardHeight, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('TOTAL DE CONTRATOS', startX + 5, y + 6);
  doc.setFontSize(11);
  doc.text(`${total}`, startX + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Pedidos no histórico', startX + 5, y + 18);

  // Card 2
  const x2 = startX + cardWidth + cardGap;
  doc.setFillColor(254, 252, 232);
  doc.roundedRect(x2, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(x2, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(...goldColor);
  doc.rect(x2, y, 2.5, cardHeight, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(133, 77, 14);
  doc.text('FATURAMENTO TOTAL', x2 + 5, y + 6);
  doc.setFontSize(9.5);
  doc.text(`R$ ${faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x2 + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Contratos fechados', x2 + 5, y + 18);

  // Card 3
  const x3 = x2 + cardWidth + cardGap;
  doc.setFillColor(245, 243, 255);
  doc.roundedRect(x3, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(221, 214, 254);
  doc.roundedRect(x3, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(139, 92, 246);
  doc.rect(x3, y, 2.5, cardHeight, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(109, 40, 217);
  doc.text('TAXA DE CONVERSÃO', x3 + 5, y + 6);
  doc.setFontSize(11);
  doc.text(`${taxaConversao}%`, x3 + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Orçamentos fechados', x3 + 5, y + 18);

  // Card 4
  const x4 = x3 + cardWidth + cardGap;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(x4, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(x4, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(37, 99, 235);
  doc.rect(x4, y, 2.5, cardHeight, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('FESTAS FUTURAS', x4 + 5, y + 6);
  doc.setFontSize(11);
  doc.text(`${futuros}`, x4 + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Próximas no calendário', x4 + 5, y + 18);

  y += cardHeight + 8;

  // 4. TABELA DE PEDIDOS
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('HISTÓRICO COMERCIAL DE LOCAÇÕES & CONTRATOS', 14, y);
  y += 3;

  const tableRows = pedidos.map(p => [
    `#${p.numero || 'S/N'}`,
    sanitizarTexto(p.cliente || 'Cliente'),
    p.dataStr || '-',
    sanitizarTexto(p.tipoServico || 'Pegue e Monte'),
    sanitizarTexto(p.tema || 'Festa'),
    `R$ ${(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    sanitizarTexto(p.status || 'Confirmado')
  ]);

  autoTable(doc, {
    head: [['Pedido #', 'Cliente', 'Data Festa', 'Modalidade', 'Tema', 'Valor Total', 'Status']],
    body: tableRows,
    startY: y,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 42 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 32 },
      4: { cellWidth: 32 },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 14, halign: 'center' }
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      lineColor: borderColor,
      lineWidth: 0.15
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = successColor;
      }
    }
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.line(0, 287, 210, 287);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.text(`Documento Gerencial Confidencial · Emitido por ${nomeEmpresa}`, 14, 293);
    doc.text(`Página ${i} de ${totalPages}`, 196, 293, { align: 'right' });
  }

  const nomeArquivo = `Relatorio_Pedidos_${nomeEmpresa.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
};
