import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebrePadrao from '../assets/LOGO_CELEBRE.png';

/**
 * Remove emojis e caracteres especiais que corrompem fontes nativas do jsPDF
 */
const sanitizarTexto = (texto) => {
  if (!texto) return '';
  return String(texto)
    // Remove emojis e símbolos fora da faixa básica
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    // Substitui traços longos por traço padrão
    .replace(/[\u2013\u2014]/g, '-')
    // Limpa múltiplos espaços
    .replace(/\s+/g, ' ')
    .trim();
};

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * 📄 GERADOR EXECUTIVO DE RELATÓRIO FINANCEIRO & DRE EM PDF (PADRÃO LUXO ENTERPRISE)
 */
export const gerarRelatorioFinanceiroPDF = ({
  empresa = {},
  metricasDRE = {},
  transacoes = [],
  filtroMes = '',
  filtroAno = '',
  usuarioEmail = ''
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [15, 23, 42];    // #0f172a (Azul Marinho Noturno)
  const goldColor = [197, 160, 89];     // #c5a059 (Dourado Celebre)
  const darkGray = [51, 65, 85];        // #334155
  const lightGray = [248, 250, 252];    // #f8fafc
  const borderColor = [226, 232, 240];  // #e2e8f0
  const successColor = [22, 163, 74];   // #16a34a (Verde)
  const dangerColor = [220, 38, 38];    // #dc2626 (Vermelho)

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

  const periodoTexto = (filtroMes && filtroAno)
    ? `${NOMES_MESES[Number(filtroMes) - 1]} de ${filtroAno}`.toUpperCase()
    : 'HISTÓRICO GERAL CONSOLIDADO';

  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  doc.setProperties({
    title: `DRE EXECUTIVO - ${nomeEmpresa} - ${periodoTexto}`,
    subject: 'Demonstrativo de Resultado do Exercício & Extrato Gerencial',
    author: nomeEmpresa,
    creator: 'Sistema de Gestão Celebre'
  });

  // 1. TOP HEADER BANNER (Marinho Noturno com acento Dourado)
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFillColor(...goldColor);
  doc.rect(0, 28, 210, 2, 'F');

  // Inserção do Logotipo ou Ícone da Empresa
  const logoEmpresaSrc = empresa?.logotipo || empresa?.logoUrl || empresa?.logo || logoCelebrePadrao;
  let textStartX = 14;

  if (logoEmpresaSrc && typeof logoEmpresaSrc === 'string' && logoEmpresaSrc.length > 20) {
    try {
      const isJpeg = logoEmpresaSrc.includes('image/jpeg') || logoEmpresaSrc.includes('image/jpg');
      const format = isJpeg ? 'JPEG' : 'PNG';
      doc.addImage(logoEmpresaSrc, format, 12, 3, 22, 22);
      textStartX = 38;
    } catch (e) {
      console.error("Erro ao desenhar logotipo no PDF financeiro:", e);
    }
  }

  // Nome da Empresa
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(nomeEmpresa, textStartX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const infoEmpresaLinha = [cnpjEmpresa, telEmpresa, emailEmpresa].filter(Boolean).join(' | ');
  doc.text(infoEmpresaLinha, textStartX, 18);

  // Título e Período no Canto Direito do Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...goldColor);
  doc.text('DRE & RELATÓRIO FINANCEIRO', 196, 12, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(periodoTexto, 196, 18, { align: 'right' });

  // 2. SUB-BARRA DE METADADOS
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
  doc.text(`Doc: DRE Gerencial Contábil`, 192, y + 4.8, { align: 'right' });

  y += 12;

  // 3. CARDS KPI EXECUTIVOS (4 BLOCOS)
  const cardWidth = 43;
  const cardHeight = 22;
  const cardGap = 3.3;
  const startX = 14;

  const receitas = metricasDRE.receitas || 0;
  const custos = metricasDRE.totalCustosDiretos || 0;
  const despesas = metricasDRE.despesasFixas || 0;
  const lucro = metricasDRE.lucroLiquido || 0;
  const margem = metricasDRE.margemLiquidaPct || 0;

  // Card 1: Receita Bruta
  doc.setFillColor(240, 253, 244); // light green
  doc.roundedRect(startX, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(startX, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(...successColor);
  doc.rect(startX, y, 2.5, cardHeight, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('(+) RECEITA BRUTA', startX + 5, y + 6);
  doc.setFontSize(10.5);
  doc.text(`R$ ${receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, startX + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Locações & Vendas', startX + 5, y + 18);

  // Card 2: Custos Diretos
  const x2 = startX + cardWidth + cardGap;
  doc.setFillColor(254, 242, 242); // light red
  doc.roundedRect(x2, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(x2, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(...dangerColor);
  doc.rect(x2, y, 2.5, cardHeight, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(153, 27, 27);
  doc.text('(-) CUSTOS DIRETOS', x2 + 5, y + 6);
  doc.setFontSize(10.5);
  doc.text(`R$ ${custos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x2 + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Acervo & Insumos', x2 + 5, y + 18);

  // Card 3: Despesas Fixas
  const x3 = x2 + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252); // light slate
  doc.roundedRect(x3, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x3, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(...darkGray);
  doc.rect(x3, y, 2.5, cardHeight, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('(-) DESPESAS FIXAS', x3 + 5, y + 6);
  doc.setFontSize(10.5);
  doc.text(`R$ ${despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x3 + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Estrutura & Operação', x3 + 5, y + 18);

  // Card 4: Lucro Líquido
  const x4 = x3 + cardWidth + cardGap;
  const isPositivo = lucro >= 0;
  doc.setFillColor(isPositivo ? 240 : 254, isPositivo ? 253 : 242, isPositivo ? 244 : 242);
  doc.roundedRect(x4, y, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(isPositivo ? 187 : 254, isPositivo ? 247 : 202, isPositivo ? 208 : 202);
  doc.roundedRect(x4, y, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFillColor(isPositivo ? 22 : 220, isPositivo ? 163 : 38, isPositivo ? 74 : 38);
  doc.rect(x4, y, 2.5, cardHeight, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isPositivo ? 22 : 153, isPositivo ? 101 : 27, isPositivo ? 52 : 27);
  doc.text(isPositivo ? '(=) LUCRO LÍQUIDO' : '(=) PREJUÍZO LÍQUIDO', x4 + 5, y + 6);
  doc.setFontSize(10.5);
  doc.text(`R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x4 + 5, y + 13);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Margem: ${margem}%`, x4 + 5, y + 18);

  y += cardHeight + 8;

  // 4. TABELA ESTRUTURADA DE DRE GERENCIAL
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('1. DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)', 14, y);
  y += 3;

  const perc = (v) => receitas > 0 ? `${((v / receitas) * 100).toFixed(1)}%` : '0.0%';

  const dreRows = [
    [
      '(+) 1. RECEITA OPERACIONAL BRUTA (Locações e Eventos)',
      `R$ ${receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      '100.0%'
    ],
    [
      '    (-) Aquisição de Peças e Compras para Estoque',
      `- R$ ${(metricasDRE.custosAquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      perc(metricasDRE.custosAquisicao || 0)
    ],
    [
      '    (-) Insumos, Materiais & Embalagens de Festa',
      `- R$ ${(metricasDRE.custosInsumos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      perc(metricasDRE.custosInsumos || 0)
    ],
    [
      '    (-) Manutenção & Reparos do Acervo',
      `- R$ ${(metricasDRE.custosManutencao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      perc(metricasDRE.custosManutencao || 0)
    ],
    [
      '(=) MARGEM DE CONTRIBUIÇÃO / LUCRO BRUTO',
      `R$ ${(metricasDRE.margemBruta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      perc(metricasDRE.margemBruta || 0)
    ],
    [
      '    (-) Despesas Fixas, Equipe, Aluguel & Operacionais',
      `- R$ ${(metricasDRE.despesasFixas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      perc(metricasDRE.despesasFixas || 0)
    ],
    [
      '(=) RESULTADO OPERACIONAL LÍQUIDO DO PERÍODO',
      `R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `${margem}%`
    ]
  ];

  autoTable(doc, {
    head: [['Estrutura de Resultados', 'Valor (R$)', '% da Receita']],
    body: dreRows,
    startY: y,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 116 },
      1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'right' }
    },
    styles: {
      fontSize: 7.8,
      cellPadding: 2.2,
      lineColor: borderColor,
      lineWidth: 0.2
    },
    didParseCell: (data) => {
      // Linha 0 (Receita Bruta)
      if (data.row.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 253, 244];
        if (data.column.index === 1) data.cell.styles.textColor = successColor;
      }
      // Linha 4 (Margem de Contribuição)
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [248, 250, 252];
      }
      // Linha 6 (Lucro Líquido Final)
      if (data.row.index === 6) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.5;
        data.cell.styles.fillColor = isPositivo ? [240, 253, 244] : [254, 242, 242];
        if (data.column.index >= 1) {
          data.cell.styles.textColor = isPositivo ? successColor : dangerColor;
        }
      }
    }
  });

  y = doc.lastAutoTable.finalY + 8;

  // 5. DISTRIBUIÇÃO POR MEIOS DE PAGAMENTO
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('2. DISTRIBUIÇÃO DE RECEBIMENTOS POR FORMA DE PAGAMENTO', 14, y);
  y += 3;

  const formas = metricasDRE.formas || { pix: 0, cartao: 0, dinheiro: 0, outros: 0 };
  const totalFormas = (formas.pix + formas.cartao + formas.dinheiro + formas.outros) || 1;

  const formasRows = [
    [
      'PIX / Transferência Instantânea',
      `R$ ${formas.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `${((formas.pix / totalFormas) * 100).toFixed(0)}%`
    ],
    [
      'Cartão de Crédito / Débito',
      `R$ ${formas.cartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `${((formas.cartao / totalFormas) * 100).toFixed(0)}%`
    ],
    [
      'Dinheiro / Espécie',
      `R$ ${formas.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `${((formas.dinheiro / totalFormas) * 100).toFixed(0)}%`
    ],
    [
      'Outros Meios (Boleto / Cheque / Convênio)',
      `R$ ${formas.outros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `${((formas.outros / totalFormas) * 100).toFixed(0)}%`
    ]
  ];

  autoTable(doc, {
    head: [['Forma de Pagamento', 'Volume Total (R$)', '% Participação']],
    body: formasRows,
    startY: y,
    theme: 'grid',
    headStyles: {
      fillColor: darkGray,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 116 },
      1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'right' }
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: borderColor,
      lineWidth: 0.2
    }
  });

  y = doc.lastAutoTable.finalY + 8;

  // Se o espaço na página for insuficiente para a tabela de extrato, quebra de página
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  // 6. EXTRATO ANALÍTICO DAS TRANSAÇÕES
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('3. EXTRATO ANALÍTICO DE OPERAÇÕES DO PERÍODO', 14, y);
  y += 3;

  const transacoesRows = transacoes.map(t => [
    t.dataStr || '-',
    sanitizarTexto(t.descricao || 'Operação Geral'),
    sanitizarTexto(t.categoria || 'Geral'),
    t.tipo === 'receita' ? 'Entrada (+)' : 'Saída (-)',
    `${t.tipo === 'receita' ? '+' : '-'} R$ ${Number(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  ]);

  if (transacoesRows.length === 0) {
    transacoesRows.push(['-', 'Nenhum lançamento no período selecionado.', '-', '-', 'R$ 0,00']);
  }

  autoTable(doc, {
    head: [['Data', 'Descrição da Operação', 'Categoria', 'Tipo', 'Valor (R$)']],
    body: transacoesRows,
    startY: y,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 84 },
      2: { cellWidth: 38 },
      3: { cellWidth: 20 },
      4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      lineColor: borderColor,
      lineWidth: 0.15
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw || '');
        if (text.startsWith('+')) {
          data.cell.styles.textColor = successColor;
        } else if (text.startsWith('-')) {
          data.cell.styles.textColor = dangerColor;
        }
      }
    }
  });

  // 7. RODAPÉ DE PÁGINA COM NUMERAÇÃO EM TODAS AS PÁGINAS
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

  // DOWNLOAD DO ARQUIVO PDF
  const nomeArquivo = `DRE_Executivo_${nomeEmpresa.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_')}_${filtroMes || 'Consolidado'}_${filtroAno || 'Geral'}.pdf`;
  doc.save(nomeArquivo);
};
