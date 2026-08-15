import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebreMarcaDagua from '../assets/LOGO_CELEBRE.png';

// ─────────────────────────────────────────────────────────────────────────────
// 🏆 GERADOR DE COMPROVANTE DE VISTORIA (CHECK-IN / CHECK-OUT) — PREMIUM v3
//    Tabela zebrificada · Avarias em vermelho · Fotos embutidas · Paginação
// ─────────────────────────────────────────────────────────────────────────────
export const gerarComprovanteCheckinPDF = (
  locacao,
  modo = 'IDA',
  itensConferidos = [],
  dadosAdicionais = {},
  dadosEmpresa = {}
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const isIda = modo === 'IDA';
  const numeroPedido = locacao.numeroPedido || locacao.id?.substring(0, 6).toUpperCase();
  const clienteNome = locacao.clienteNome || locacao.cliente?.nome || 'Cliente não informado';
  const nomeEmpresaAssinante =
    dadosEmpresa?.nomeEmpresa || dadosEmpresa?.nomeFantasia || dadosEmpresa?.nome || 'CELEBRE FESTAS & DECORAÇÕES';
  const logoEmpresaAssinante =
    dadosEmpresa?.logotipo || dadosEmpresa?.logoUrl || dadosEmpresa?.logo || null;

  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // ── PALETA DE CORES ──────────────────────────────────────────────────────
  const corDourado      = [197, 160, 89];
  const corAzulEscuro   = [15, 23, 42];
  const corVermelho     = [185, 28, 28];    // vermelho escuro texto
  const corVermelhoFill = [255, 235, 235];  // vermelho suave linha avaria
  const corLaranjaFill  = [255, 243, 205];  // laranja suave linha falta
  const corZebra        = [248, 250, 252];  // cinza levíssimo linhas pares
  const corBranco       = [255, 255, 255];

  // ── SEPARAÇÃO DOS ITENS POR STATUS ──────────────────────────────────────
  const itensAvaria  = itensConferidos.filter(i => i.statusRetorno === 'avaria');
  const itensFalta   = itensConferidos.filter(
    i => i.statusRetorno === 'faltou' || (i.qtdConferida !== undefined && Number(i.qtdConferida) < Number(i.quantidade))
  );
  const temIrregularidades = !isIda && (itensAvaria.length > 0 || itensFalta.length > 0);

  // ── FOTOS DE VISTORIA ────────────────────────────────────────────────────
  const fotosVistoria = Array.isArray(dadosAdicionais.fotosVistoria)
    ? dadosAdicionais.fotosVistoria.filter(Boolean)
    : [];

  // ════════════════════════════════════════════════════════════════════════
  // ── FUNÇÃO AUXILIAR: CABEÇALHO + RODAPÉ ─────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════
  const adicionarCabecalhoRodape = (paginaAtual, totalPaginas) => {
    // ── Marca d'água suave ────────────────────────────────────────────────
    try {
      doc.saveGraphicsState();
      if (typeof doc.setGState === 'function') {
        doc.setGState(new doc.GState({ opacity: 0.04 }));
      }
      doc.addImage(logoCelebreMarcaDagua, 'PNG', 55, 100, 100, 100);
      doc.restoreGraphicsState();
    } catch (_) {}

    // ── Faixa de cabeçalho ────────────────────────────────────────────────
    doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.rect(0, 0, 210, 32, 'F');

    // Faixa dourada
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 32, 210, 2.5, 'F');

    // Logo da empresa
    let xTexto = 14;
    if (logoEmpresaAssinante && String(logoEmpresaAssinante).trim().length > 20) {
      try {
        const isJpeg =
          String(logoEmpresaAssinante).includes('jpeg') ||
          String(logoEmpresaAssinante).includes('jpg');
        doc.addImage(logoEmpresaAssinante, isJpeg ? 'JPEG' : 'PNG', 12, 4, 24, 24);
        xTexto = 42;
      } catch (_) {}
    }

    // Texto do cabeçalho
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const tituloDoc = isIda
      ? 'COMPROVANTE DE VISTORIA — EXPEDIÇÃO (IDA)'
      : 'COMPROVANTE DE VISTORIA — DEVOLUÇÃO (VOLTA)';
    doc.text(tituloDoc, xTexto, 14);

    doc.setFontSize(9.5);
    doc.setTextColor(253, 230, 138);
    doc.text(nomeEmpresaAssinante.toUpperCase(), xTexto, 21);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240);
    doc.text(`Emissão: ${dataHoje} às ${horaHoje}`, xTexto, 27);

    // Número de página no canto superior direito do cabeçalho
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Pág. ${paginaAtual} de ${totalPaginas}`, 196, 27, { align: 'right' });

    // ── Rodapé ────────────────────────────────────────────────────────────
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Documento emitido por ${nomeEmpresaAssinante}  •  Powered by Celebre Sistema de Gestão`,
      105, 289, { align: 'center' }
    );

    // Linha separadora do rodapé
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 285, 196, 285);
  };

  // ════════════════════════════════════════════════════════════════════════
  // ── PÁGINA 1: INFORMAÇÕES + TABELA DE ITENS ──────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  // Calcular páginas totais estimadas (será refinado ao final — jsPDF não tem pré-cálculo)
  // Usamos uma estimativa simples; o rodapé mostrará o total corretamente após montagem
  let totalPaginas = 1;
  if (temIrregularidades) totalPaginas++;
  if (fotosVistoria.length > 0) totalPaginas++;

  adicionarCabecalhoRodape(1, totalPaginas);

  // ── Quadro de Informações da Locação ─────────────────────────────────────
  let y = 40;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, y, 186, 30, 3, 3, 'FD');

  // Badge de modo (IDA/VOLTA)
  const badgeColor = isIda ? [16, 185, 129] : [234, 88, 12]; // verde / laranja
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.roundedRect(156, y + 3, 38, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(isIda ? 'SAÍDA' : 'DEVOLUÇÃO', 175, y + 9.5, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`PEDIDO  #${numeroPedido}`, 18, y + 9);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clienteNome}`, 18, y + 16);
  doc.text(
    `Data Saída / Evento: ${locacao.dataRetirada ? locacao.dataRetirada.split('-').reverse().join('/') : 'S/D'}`,
    18, y + 22
  );

  doc.text(
    `Modalidade: ${locacao.modalidadeServico === 'pegue_monte' ? 'Pegue e Monte' : 'Decoração Completa'}`,
    105, y + 9
  );
  doc.text(`Responsável: ${dadosAdicionais.responsavel || 'Equipe Galpão'}`, 105, y + 16);
  if (locacao.dataDevolucao) {
    doc.text(
      `Data Devolução: ${locacao.dataDevolucao.split('-').reverse().join('/')}`,
      105, y + 22
    );
  }

  y += 37;

  // ── TABELA DE ITENS ───────────────────────────────────────────────────────
  const tableHead = [['#', 'Código SKU', 'Peça / Item do Acervo', 'Qtd', 'Status', 'Observações / Vistoria']];

  const tableRows = itensConferidos.map((item, idx) => {
    const qtdContratada = Number(item.quantidade || 1);
    const qtdConf = Number(item.qtdConferida ?? qtdContratada);
    const isConferidoTot = qtdConf >= qtdContratada;

    let statusTxt = 'OK';
    let obsLinha = isConferidoTot
      ? `Conferido (${qtdConf}/${qtdContratada} un)`
      : '___________________________';

    if (!isIda && item.statusRetorno === 'avaria') {
      statusTxt = 'AVARIA';
      const custoNum = typeof item.custoAvaria === 'number' 
        ? item.custoAvaria 
        : Number(String(item.custoAvaria || '0').replace(/\./g, '').replace(',', '.'));
      obsLinha = item.obsRetorno || item.motivoAvaria
        ? `Dano: ${item.obsRetorno || item.motivoAvaria}${custoNum > 0 ? `  |  Est. R$ ${custoNum.toFixed(2)}` : ''}`
        : 'Peça danificada — avaliar reparo';
    } else if (!isIda && (item.statusRetorno === 'faltou' || qtdConf < qtdContratada)) {
      statusTxt = 'FALTOU';
      obsLinha = `Devolvido: ${qtdConf} de ${qtdContratada} un — EXTRAVIO`;
    } else if (isIda && !isConferidoTot) {
      statusTxt = 'PEND.';
    }

    return [
      idx + 1,
      item.codigo || 'S/C',
      item.nome || item.descricao || 'Item sem nome',
      `${qtdContratada} un`,
      statusTxt,
      obsLinha
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: corAzulEscuro,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: corAzulEscuro,
      lineColor: [226, 232, 240],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 24 },
      2: { cellWidth: 56 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 58 }
    },
    // ── Zebragem e destaque por status ──────────────────────────────────
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const item = itensConferidos[data.row.index];
      if (!item) return;

      const isAvaria = !isIda && item.statusRetorno === 'avaria';
      const isFalta  = !isIda && (item.statusRetorno === 'faltou' ||
        (Number(item.qtdConferida ?? item.quantidade) < Number(item.quantidade)));

      if (isAvaria) {
        data.cell.styles.fillColor = corVermelhoFill;
        data.cell.styles.textColor = corVermelho;
        data.cell.styles.fontStyle = 'bold';
      } else if (isFalta) {
        data.cell.styles.fillColor = corLaranjaFill;
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontStyle = 'bold';
      } else if (data.row.index % 2 === 1) {
        // Zebragem suave para linhas ímpares normais
        data.cell.styles.fillColor = corZebra;
      } else {
        data.cell.styles.fillColor = corBranco;
      }
    },
    // ── Borda dourada na esquerda para avarias ────────────────────────────
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const item = itensConferidos[data.row.index];
      if (!item) return;
      if (!isIda && item.statusRetorno === 'avaria' && data.column.index === 0) {
        doc.setFillColor(corVermelho[0], corVermelho[1], corVermelho[2]);
        doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F');
      }
    },
    margin: { left: 12, right: 12 }
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Observações Gerais ────────────────────────────────────────────────────
  if (dadosAdicionais.observacoes) {
    if (y > 238) { doc.addPage(); adicionarCabecalhoRodape(2, totalPaginas); y = 40; }
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.roundedRect(12, y, 186, 3, 0, 0, 'F'); // linha superior dourada
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.text('Observações Gerais da Vistoria:', 14, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitObs = doc.splitTextToSize(dadosAdicionais.observacoes, 180);
    doc.text(splitObs, 14, y + 14);
    y += (splitObs.length * 4.5) + 18;
  } else {
    y += 4;
  }

  // ── Seção de Assinaturas ─────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); adicionarCabecalhoRodape(2, totalPaginas); y = 40; }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.text('DECLARAÇÃO E TERMO DE CONFIRMAÇÃO DE VISTORIA:', 14, y);
  y += 6;

  // Caixa de assinatura da empresa
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, y, 88, 28, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Responsável pela Vistoria', 56, y + 5, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.line(20, y + 20, 92, y + 20);
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(dadosAdicionais.responsavel || 'Equipe Galpão', 56, y + 25, { align: 'center' });

  // Caixa de assinatura do cliente
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(108, y, 90, 28, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Assinatura do Cliente / Retirante', 153, y + 5, { align: 'center' });

  // Imagem da assinatura digital (se existir)
  if (dadosAdicionais.assinaturaUrl) {
    try {
      doc.addImage(dadosAdicionais.assinaturaUrl, 'PNG', 113, y + 6, 80, 16);
    } catch (_) {}
  }
  doc.setDrawColor(148, 163, 184);
  doc.line(116, y + 20, 194, y + 20);
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(clienteNome, 153, y + 25, { align: 'center' });

  y += 34;

  // Texto de declaração
  if (y > 270) { doc.addPage(); adicionarCabecalhoRodape(2, totalPaginas); y = 40; }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Declaro que conferi e estou de acordo com o estado e quantidade das peças relacionadas neste documento.',
    14, y, { maxWidth: 182 }
  );
  doc.text(`Data/Hora: ${dataHoje} às ${horaHoje}`, 14, y + 6);

  // ════════════════════════════════════════════════════════════════════════
  // ── PÁGINA 2 (OPCIONAL): SUMÁRIO DE IRREGULARIDADES (apenas VOLTA) ───────
  // ════════════════════════════════════════════════════════════════════════
  let paginaAtual = 2;

  if (temIrregularidades) {
    doc.addPage();
    adicionarCabecalhoRodape(paginaAtual, totalPaginas);
    paginaAtual++;

    let yIrreg = 42;

    // Título da seção
    doc.setFillColor(185, 28, 28);
    doc.roundedRect(12, yIrreg, 186, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE IRREGULARIDADES NA DEVOLUÇÃO', 105, yIrreg + 7, { align: 'center' });
    yIrreg += 16;

    // Contador de avarias e faltas
    doc.setFillColor(255, 235, 235);
    doc.setDrawColor(185, 28, 28);
    doc.roundedRect(12, yIrreg, 88, 16, 2, 2, 'FD');
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${itensAvaria.length}`, 56, yIrreg + 8, { align: 'center' });
    doc.setFontSize(8);
    doc.text('item(ns) com Avaria / Dano', 56, yIrreg + 13, { align: 'center' });

    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(146, 64, 14);
    doc.roundedRect(108, yIrreg, 90, 16, 2, 2, 'FD');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${itensFalta.length}`, 153, yIrreg + 8, { align: 'center' });
    doc.setFontSize(8);
    doc.text('item(ns) Faltante(s) / Extravio', 153, yIrreg + 13, { align: 'center' });

    yIrreg += 22;

    // ── Tabela de avarias ────────────────────────────────────────────────
    if (itensAvaria.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('Peças com Avaria / Dano:', 14, yIrreg);
      yIrreg += 5;

      const rowsAvaria = itensAvaria.map((item, idx) => {
        const custoNum = typeof item.custoAvaria === 'number' 
          ? item.custoAvaria 
          : Number(String(item.custoAvaria || '0').replace(/\./g, '').replace(',', '.'));
        return [
          idx + 1,
          item.codigo || 'S/C',
          item.nome || 'Item sem nome',
          `${item.quantidade || 1} un`,
          item.obsRetorno || item.motivoAvaria || 'Avaria registrada',
          custoNum > 0 ? `R$ ${custoNum.toFixed(2)}` : 'A avaliar'
        ];
      });

      // Total custo avarias
      const totalCustoAvaria = itensAvaria.reduce(
        (acc, i) => acc + (typeof i.custoAvaria === 'number' ? i.custoAvaria : Number(String(i.custoAvaria || '0').replace(/\./g, '').replace(',', '.'))), 0
      );

      autoTable(doc, {
        startY: yIrreg,
        head: [['#', 'SKU', 'Peça', 'Qtd', 'Descrição do Dano', 'Custo Est.']],
        body: rowsAvaria,
        foot: totalCustoAvaria > 0
          ? [['', '', '', '', 'Total Estimado de Reparos:', `R$ ${totalCustoAvaria.toFixed(2)}`]]
          : undefined,
        theme: 'grid',
        headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [255, 235, 235], textColor: [185, 28, 28], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3, fillColor: [255, 235, 235], textColor: [185, 28, 28] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 54 },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 60 },
          5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 12, right: 12 }
      });

      yIrreg = doc.lastAutoTable.finalY + 10;
    }

    // ── Tabela de faltas ─────────────────────────────────────────────────
    if (itensFalta.length > 0) {
      if (yIrreg > 240) { doc.addPage(); adicionarCabecalhoRodape(paginaAtual, totalPaginas); paginaAtual++; yIrreg = 42; }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(146, 64, 14);
      doc.text('Peças Faltantes / Extravio:', 14, yIrreg);
      yIrreg += 5;

      const rowsFalta = itensFalta.map((item, idx) => [
        idx + 1,
        item.codigo || 'S/C',
        item.nome || 'Item sem nome',
        `${item.quantidade || 1} un`,
        `${Number(item.qtdConferida ?? 0)} un devolvidas`,
        `${Number(item.quantidade || 1) - Number(item.qtdConferida ?? 0)} un em falta`
      ]);

      autoTable(doc, {
        startY: yIrreg,
        head: [['#', 'SKU', 'Peça', 'Contratado', 'Devolvido', 'Faltando']],
        body: rowsFalta,
        theme: 'grid',
        headStyles: { fillColor: [146, 64, 14], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3, fillColor: corLaranjaFill, textColor: [146, 64, 14] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 54 },
          3: { cellWidth: 26, halign: 'center' },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }
        },
        margin: { left: 12, right: 12 }
      });

      yIrreg = doc.lastAutoTable.finalY + 10;
    }

    // Nota de providências
    if (yIrreg < 260) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(
        'As peças com avaria foram automaticamente encaminhadas ao módulo de Manutenção do Estoque para avaliação e reparo.',
        14, yIrreg, { maxWidth: 182 }
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // ── PÁGINA FINAL (OPCIONAL): FOTOS DE VISTORIA ───────────────────────────
  // ════════════════════════════════════════════════════════════════════════
  if (fotosVistoria.length > 0) {
    doc.addPage();
    adicionarCabecalhoRodape(paginaAtual, totalPaginas);

    let yFotos = 42;

    // Título da seção de fotos
    doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.roundedRect(12, yFotos, 186, 10, 2, 2, 'F');
    doc.setTextColor(253, 230, 138);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('FOTOS DA VISTORIA DE DEVOLUÇÃO', 105, yFotos + 7, { align: 'center' });
    yFotos += 16;

    // Info complementar
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Total de fotos: ${fotosVistoria.length}${fotosVistoria.length > 6 ? '  •  Exibindo as 6 primeiras' : ''}`,
      14, yFotos
    );
    doc.text(`Pedido #${numeroPedido}  |  Cliente: ${clienteNome}  |  Data: ${dataHoje}`, 196, yFotos, { align: 'right' });
    yFotos += 8;

    // Grade 2x3 de fotos (máx 6)
    const fotosMostrar = fotosVistoria.slice(0, 6);
    const fotoCols = 2;
    const fotoW = 85;
    const fotoH = 60;
    const fotoGapX = 16;
    const fotoGapY = 10;
    const fotoLegendaH = 7;
    const xInicio = 14;

    fotosMostrar.forEach((fotoDataUrl, idx) => {
      const col = idx % fotoCols;
      const row = Math.floor(idx / fotoCols);
      const fx = xInicio + col * (fotoW + fotoGapX);
      const fy = yFotos + row * (fotoH + fotoGapY + fotoLegendaH);

      // Borda da foto
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(fx, fy, fotoW, fotoH, 2, 2, 'FD');

      // Imagem
      try {
        const isJpeg = fotoDataUrl.includes('jpeg') || fotoDataUrl.includes('jpg');
        doc.addImage(fotoDataUrl, isJpeg ? 'JPEG' : 'PNG', fx + 1, fy + 1, fotoW - 2, fotoH - 2);
      } catch (_) {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Erro ao carregar imagem', fx + fotoW / 2, fy + fotoH / 2, { align: 'center' });
      }

      // Legenda
      doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
      doc.roundedRect(fx, fy + fotoH, fotoW, fotoLegendaH, 0, 0, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`Foto ${idx + 1} — Vistoria de Devolução`, fx + fotoW / 2, fy + fotoH + 4.5, { align: 'center' });
    });

    // Aviso se houver mais de 6 fotos
    if (fotosVistoria.length > 6) {
      const linhasUsadas = Math.ceil(fotosMostrar.length / fotoCols);
      const yAviso = yFotos + linhasUsadas * (fotoH + fotoGapY + fotoLegendaH) + 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Aviso: ${fotosVistoria.length - 6} foto(s) adicional(is) não exibida(s) por limite de espaço. Acesse o sistema para visualizá-las.`,
        14, yAviso, { maxWidth: 182 }
      );
    }
  }

  // ── SALVAR PDF ───────────────────────────────────────────────────────────
  const nomeArquivo = `Comprovante_Vistoria_${modo}_Pedido_${numeroPedido}.pdf`;
  doc.save(nomeArquivo);

  return doc;
};
