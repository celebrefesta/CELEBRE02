import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebreMarcaDagua from '../assets/LOGO_CELEBRE.png';

/**
 * 📄 GERADOR DE RELATÓRIO DO MAPA DE SEPARAÇÃO E DISPONIBILIDADE DO ACERVO (PDF)
 * Formato Paisagem (Landscape A4) — Design Celebre Luxury
 */
export const gerarMapaSeparacaoPDF = (
  mesNome = 'Agosto',
  ano = 2026,
  estoqueFiltrado = [],
  mapaOcupacao = { porItem: {}, porDiaGeral: {} },
  kpisMes = { totalFestas: 0, totalPecasAlugadas: 0, taxaOcupacao: 0 },
  dadosEmpresa = {}
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const nomeEmpresa = dadosEmpresa?.nomeEmpresa || dadosEmpresa?.nomeFantasia || dadosEmpresa?.nome || 'CELEBRE FESTAS & DECORAÇÕES';
  const logoEmpresa = dadosEmpresa?.logotipo || dadosEmpresa?.logoUrl || dadosEmpresa?.logo || null;
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // ── CORES ──
  const corDourado = [197, 160, 89];
  const corAzulEscuro = [15, 23, 42];
  const corZebra = [248, 250, 252];
  const corCinzaTexto = [100, 116, 139];

  // ── AUXILIAR DE MARCA D'ÁGUA E CABEÇALHO/RODAPÉ ──
  const adicionarCabecalhoRodape = (paginaAtual, totalPaginas) => {
    try {
      doc.saveGraphicsState();
      if (typeof doc.setGState === 'function') {
        doc.setGState(new doc.GState({ opacity: 0.04 }));
      }
      doc.addImage(logoCelebreMarcaDagua, 'PNG', 98, 55, 100, 100);
      doc.restoreGraphicsState();
    } catch (e) {
      // Caso ocorra erro no carregamento da imagem estática
    }

    // Top Bar Dourado
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 0, 297, 3, 'F');

    // Cabeçalho Principal
    doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.rect(0, 3, 297, 26, 'F');

    // Título e Subtítulo
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`MAPA DE SEPARAÇÃO & DISPONIBILIDADE DO ACERVO`, 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(253, 230, 138); // Amarelo suave
    doc.text(`Mês de Referência: ${mesNome.toUpperCase()} / ${ano} — ${nomeEmpresa}`, 14, 21);

    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Emitido em: ${dataHoje} às ${horaHoje}`, 297 - 14, 21, { align: 'right' });

    // Logo no canto superior se existir
    if (logoEmpresa) {
      try {
        doc.addImage(logoEmpresa, 'PNG', 297 - 45, 6, 30, 16);
      } catch (e) {}
    }

    // Rodapé
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 200, 297 - 14, 200);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(corCinzaTexto[0], corCinzaTexto[1], corCinzaTexto[2]);
    doc.text(`${nomeEmpresa} • Sistema Celebre (Gestão de Acervo & Separação)`, 14, 205);
    doc.text(`Página ${paginaAtual} de ${totalPaginas}`, 297 - 14, 205, { align: 'right' });
  };

  // ── CARD DE KPIS DO MÊS ──
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 33, 269, 14, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);

  doc.text(`🎉 Total de Festas: `, 20, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`${kpisMes.totalFestas || 0} eventos`, 52, 42);

  doc.setFont('helvetica', 'bold');
  doc.text(`📦 Reservas no Acervo: `, 100, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`${kpisMes.totalPecasAlugadas || 0} unidades alugadas`, 140, 42);

  doc.setFont('helvetica', 'bold');
  doc.text(`📈 Taxa de Ocupação: `, 200, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`${kpisMes.taxaOcupacao || 0}% dos dias ocupados`, 238, 42);

  // ── PREPARAÇÃO DOS DADOS DA TABELA ──
  const tableHead = [['CÓDIGO', 'PEÇA / ITEM DO ACERVO', 'CATEGORIA', 'QTD TOTAL', 'RESERVAS & CRONOGRAMA DE SAÍDA NO MÊS']];

  const tableBody = estoqueFiltrado.map((item) => {
    const cod = item.codigo || item.sku || `ID-${String(item.id).substring(0, 5)}`;
    const nome = item.nome || 'Sem Nome';
    const cat = item.categoria || 'Geral';
    const qtdTotal = Number(item.quantidade || 1);

    // Formatar agenda de reservas no mês para este item
    const ocupacaoItem = mapaOcupacao.porItem[item.id] || mapaOcupacao.porItem[item.nome] || {};
    const datasComReserva = Object.keys(ocupacaoItem).sort();

    let detalhamentoAgenda = '🟢 Livre em todo o mês';

    if (datasComReserva.length > 0) {
      const linhasDet = [];
      datasComReserva.forEach(dataIso => {
        const info = ocupacaoItem[dataIso];
        if (info && info.alugados > 0) {
          const pData = dataIso.split('-');
          const dataBr = `${pData[2]}/${pData[1]}`;
          const clientes = (info.reservas || [])
            .map(r => `${r.clienteNome || 'Cliente'} (${r.numPedido || '#S/N'} - Qtd: ${r.qtd})`)
            .join(' | ');

          linhasDet.push(`• ${dataBr}: ${info.alugados} un. alugada(s) ➔ ${clientes}`);
        }
      });

      if (linhasDet.length > 0) {
        detalhamentoAgenda = linhasDet.join('\n');
      }
    }

    return [cod, nome, cat, `${qtdTotal} un.`, detalhamentoAgenda];
  });

  // ── RENDERIZAÇÃO DA TABELA COM AUTO-TABLE ──
  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 51,
    margin: { left: 14, right: 14, bottom: 15 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3,
      valign: 'middle',
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: corAzulEscuro,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold', textColor: corAzulEscuro },
      1: { cellWidth: 65, fontStyle: 'bold' },
      2: { cellWidth: 35 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 121, textColor: [30, 41, 59] }
    },
    alternateRowStyles: {
      fillColor: corZebra
    },
    didDrawPage: (data) => {
      // Adiciona cabeçalho e rodapé em cada página gerada
      const totalPaginas = doc.internal.getNumberOfPages();
      adicionarCabecalhoRodape(data.pageNumber, totalPaginas);
    }
  });

  // ── DOWNLOAD DO ARQUIVO PDF ──
  const nomeArquivo = `Mapa_Separacao_Acervo_${mesNome}_${ano}.pdf`;
  doc.save(nomeArquivo);
};
