import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebreMarcaDagua from '../../assets/LOGO_CELEBRE.png';

/**
 * 📦 GERADOR DE FOLHA DE SEPARAÇÃO GERAL DE GALPÃO (PDF)
 * Consolida todas as peças a serem separadas para as festas do período selecionado.
 */
export const gerarFolhaSeparacaoGalpaoPDF = (
  locacoes = [],
  filtroInfo = {},
  dadosEmpresa = {}
) => {
  if (!locacoes || locacoes.length === 0) {
    alert("⚠️ Não há pedidos na lista para gerar a Folha de Separação.");
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const nomeEmpresa = dadosEmpresa?.nomeEmpresa || dadosEmpresa?.nomeFantasia || dadosEmpresa?.nome || 'CELEBRE FESTAS & DECORAÇÕES';
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const corDourado = [197, 160, 89];
  const corAzulEscuro = [15, 23, 42];

  // Marca d'água
  const adicionarMarcaDagua = () => {
    try {
      doc.saveGraphicsState();
      if (typeof doc.setGState === 'function') {
        doc.setGState(new doc.GState({ opacity: 0.04 }));
      }
      doc.addImage(logoCelebreMarcaDagua, 'PNG', 55, 90, 100, 100);
      doc.restoreGraphicsState();
    } catch (e) {}
  };

  adicionarMarcaDagua();

  // Cabeçalho Top Bar
  doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
  doc.rect(0, 0, pageWidth, 3, 'F');

  doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.rect(0, 3, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MAPA GERAL DE SEPARACAO & EXPEDICAO (GALPAO)', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(corDourado[0], corDourado[1], corDourado[2]);
  doc.text(`${nomeEmpresa.toUpperCase()} • EMISSAO: ${dataHoje} as ${horaHoje}`, 14, 20);

  // Consolidação de Peças
  const tabelaLinhas = [];
  let totalPecasConsolidado = 0;

  locacoes.forEach((loc, idx) => {
    const numPed = loc.numeroPedido ? `#${loc.numeroPedido}` : `PED-${idx + 1}`;
    const cliente = loc.clienteNome || 'Cliente';
    const dataFesta = loc.dataRetirada ? loc.dataRetirada.split('-').reverse().join('/') : '--/--/----';
    const itens = loc.itens || [];

    itens.forEach(item => {
      const qtd = Number(item.quantidade || item.qtd || 1);
      totalPecasConsolidado += qtd;
      tabelaLinhas.push([
        '[  ]',
        String(qtd),
        item.codigo || item.sku || '-',
        item.nome || item.descricao || 'Item do Acervo',
        `${numPed} - ${cliente}`,
        dataFesta
      ]);
    });
  });

  // KPIs
  let startY = 32;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, pageWidth - 28, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total de Pedidos: ${locacoes.length}`, 18, startY + 9);
  doc.text(`Total de Peças a Separar: ${totalPecasConsolidado} un.`, 80, startY + 9);
  doc.text(`Filtro: ${filtroInfo.data ? filtroInfo.data : 'Geral'}`, 155, startY + 9);

  // Tabela com autotable
  autoTable(doc, {
    startY: startY + 18,
    head: [['CONF', 'QTD', 'COD / SKU', 'DESCRICAO DA PECA / ACERVO', 'PEDIDO / CLIENTE', 'DATA SAIDA']],
    body: tabelaLinhas,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      valign: 'middle',
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 46 },
      5: { cellWidth: 22, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      adicionarMarcaDagua();
      // Rodapé
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Celebre Sistema de Gestao • Folha de Galpao • Pagina ${doc.internal.getNumberOfPages()}`, 14, pageHeight - 8);
    }
  });

  const totalPages = doc.internal.getNumberOfPages();
  const finalY = doc.lastAutoTable.finalY + 12;

  if (finalY + 25 < pageHeight) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.line(14, finalY + 10, 85, finalY + 10);
    doc.text('Responsavel pela Separacao', 14, finalY + 15);

    doc.line(125, finalY + 10, 196, finalY + 10);
    doc.text('Conferente / Expedicao', 125, finalY + 15);
  }

  doc.save(`Folha_Separacao_Galpao_${dataHoje.replace(/\//g, '-')}.pdf`);
};
