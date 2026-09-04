import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebreMarcaDagua from '../../assets/LOGO_CELEBRE.png';

/**
 * 🚚 DETECÇÃO ROBUSTA DE ENTREGA VS RETIRADA NA LOJA
 */
const verificarSeEhEntrega = (loc) => {
  if (!loc) return false;
  const freteTipo = String(
    loc.tipoFrete || 
    loc.modalidadeFrete || 
    loc.tipoEnvio || 
    loc.logistica?.tipo || 
    loc.logistica?.tipoFrete || 
    ''
  ).toLowerCase().trim();

  if (freteTipo.includes('entrega') || freteTipo.includes('frete') || freteTipo.includes('transport') || freteTipo.includes('levar')) {
    return true;
  }
  if (freteTipo.includes('loja') || freteTipo.includes('retirada') || freteTipo.includes('balcao') || freteTipo.includes('pegue')) {
    return false;
  }
  if (loc.modalidadeServico === 'decoracao_completa' || loc.modalidadeServico === 'decoracao') {
    return true;
  }
  if (Number(loc.taxaEntrega || loc.valorFrete || loc.frete || 0) > 0) {
    return true;
  }
  const end = loc.logistica?.endereco || loc.endereco || '';
  if (end.trim() && !end.toLowerCase().includes('retirada') && !end.toLowerCase().includes('balcão') && !end.toLowerCase().includes('loja')) {
    return true;
  }
  return false;
};

/**
 * 📍 FORMATAÇÃO DE ENDEREÇO COMPLETO
 */
const obterEnderecoCompleto = (loc) => {
  if (!loc) return '';
  const partes = [
    loc.logistica?.endereco || loc.endereco,
    loc.logistica?.numero || loc.numero,
    loc.logistica?.bairro || loc.bairro,
    loc.logistica?.cidade || loc.cidade,
    loc.logistica?.estado || loc.estado
  ].filter(Boolean);
  return partes.join(', ');
};

/**
 * 📦 GERADOR DE FOLHA DE SEPARAÇÃO GERAL DE GALPÃO (PDF)
 * Layout Luxury 100% Blindado agrupado por Pedido / Cliente
 */
export const gerarFolhaSeparacaoGalpaoPDF = (
  locacoes = [],
  filtroInfo = {},
  dadosEmpresa = {},
  acao = 'preview'
) => {
  // 🛡️ REGRA DE OURO DA SEPARAÇÃO:
  // Galpão só separa pedidos pendentes (A Separar / Em Preparação) e de eventos HOJE ou FUTUROS!
  const hojeIso = new Date().toISOString().split('T')[0];
  const pedidosValidos = (locacoes || []).filter(loc => {
    const st = String(loc.status || '').toLowerCase().trim();
    if (st.includes('finaliz') || st.includes('devolv') || st.includes('concluid') || st.includes('cancel') || st.includes('orcam')) return false;
    if (st === 'entregue' || st.includes('transito') || st.includes('rua')) return false;

    const dataSaida = loc.dataRetirada || loc.dataEvento;
    if (dataSaida && dataSaida < hojeIso && !filtroInfo?.permitirPassados) return false;

    return true;
  });

  if (!pedidosValidos || pedidosValidos.length === 0) {
    alert("⚠️ Não há pedidos pendentes de separação ativa (com data hoje ou futura) para gerar a Folha de Separação.");
    return null;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const nomeEmpresa = dadosEmpresa?.nomeEmpresa 
    || dadosEmpresa?.nomeFantasia 
    || dadosEmpresa?.razaoSocial 
    || localStorage.getItem('nomeEmpresa') 
    || 'CELEBRE FESTAS & DECORAÇÕES';
  const logoEmpresaSrc = dadosEmpresa?.logotipo 
    || dadosEmpresa?.logoUrl 
    || dadosEmpresa?.logo 
    || logoCelebreMarcaDagua;
  const telEmpresa = dadosEmpresa?.telefone || dadosEmpresa?.whatsapp || '';

  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // 🎨 PALETA DE CORES LUXURY CELEBRE
  const corDourado = [197, 160, 89];
  const corAzulEscuro = [15, 23, 42];
  const corCinzaBorda = [203, 213, 225];
  const corCinzaFundo = [248, 250, 252];
  const corTextoEscuro = [15, 23, 42];
  const corTextoSuave = [100, 116, 139];

  // 💧 MARCA D'ÁGUA SUAVE
  const adicionarMarcaDagua = () => {
    try {
      doc.saveGraphicsState();
      if (typeof doc.setGState === 'function') {
        doc.setGState(new doc.GState({ opacity: 0.035 }));
      }
      doc.addImage(logoCelebreMarcaDagua, 'PNG', (pageWidth - 90) / 2, (pageHeight - 90) / 2, 90, 90);
      doc.restoreGraphicsState();
    } catch (e) {}
  };

  // 📐 CÁLCULO DE KPIS CONSOLIDADOS
  let totalPecasGeral = 0;
  let totalEntregas = 0;
  let totalRetiradas = 0;

  pedidosValidos.forEach(loc => {
    const isEnt = verificarSeEhEntrega(loc);
    if (isEnt) totalEntregas++;
    else totalRetiradas++;

    const itens = loc.itens || [];
    itens.forEach(item => {
      totalPecasGeral += Number(item.quantidade || item.qtd || 1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 1. CABEÇALHO PRINCIPAL DA FOLHA (COM LOGOTIPO OFICIAL)
  // ═══════════════════════════════════════════════════════════
  const desenharCabecalhoPrincipal = () => {
    // Top Bar Dourado
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 0, pageWidth, 3.5, 'F');

    // Barra Superior Azul Navy
    doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.rect(0, 3.5, pageWidth, 24.5, 'F');

    // Borda inferior dourada fina do Header
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 28, pageWidth, 1.2, 'F');

    // Logotipo da Empresa
    let textStartX = 14;
    if (logoEmpresaSrc) {
      try {
        const isJpeg = typeof logoEmpresaSrc === 'string' && (logoEmpresaSrc.includes('image/jpeg') || logoEmpresaSrc.includes('image/jpg'));
        const format = isJpeg ? 'JPEG' : 'PNG';
        doc.addImage(logoEmpresaSrc, format, 14, 4.5, 20.5, 20.5);
        textStartX = 38;
      } catch (e) {
        console.warn("Logotipo não pôde ser renderizado no mapa:", e);
      }
    }

    // Título Principal
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('MAPA GERAL DE SEPARACAO & EXPEDICAO (GALPAO)', textStartX, 10.5);

    // Subtítulo e Empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.text(nomeEmpresa.toUpperCase(), textStartX, 16.5);

    // Metadados
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(7);
    const infoMeta = [`Emissao: ${dataHoje} as ${horaHoje}`, telEmpresa ? `Tel: ${telEmpresa}` : ''].filter(Boolean).join('   •   ');
    doc.text(infoMeta, textStartX, 22);

    // Canto Direito do Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.text('LOGISTICA & GALPAO', pageWidth - 14, 11, { align: 'right' });

    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text('CONFERENCIA FISICA DE ACERVO', pageWidth - 14, 16.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text('Controle de Saida e Devolucao', pageWidth - 14, 21.5, { align: 'right' });
  };

  // Mini-Cabeçalho para páginas subsequentes (Página 2, 3, etc.)
  const desenharMiniCabecalhoPagina = (pageNum) => {
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 0, pageWidth, 2.5, 'F');

    doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.rect(0, 2.5, pageWidth, 9, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`MAPA DE SEPARACAO DE GALPAO  •  ${nomeEmpresa.toUpperCase()}`, 14, 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.text(`Continuacao — Pagina ${pageNum}`, pageWidth - 14, 8, { align: 'right' });
  };

  desenharCabecalhoPrincipal();
  adicionarMarcaDagua();

  // ═══════════════════════════════════════════════════════════
  // 2. RESUMO EXECUTIVO (KPIS EM PÍLULAS MODERNAS)
  // ═══════════════════════════════════════════════════════════
  let currentY = 32;
  const textoFiltro = filtroInfo.data 
    ? `Data: ${filtroInfo.data}` 
    : (filtroInfo.motorista ? `Motorista: ${filtroInfo.motorista}` : 'Geral / Todos');

  const kpiStartX = 14;
  const kpiTotalWidth = pageWidth - 28; // 182mm
  const kpiCount = 5;
  const kpiGap = 2.5;
  const kpiWidth = (kpiTotalWidth - (kpiGap * (kpiCount - 1))) / kpiCount; // ~34.4mm
  const kpiHeight = 11.5;

  const kpis = [
    { label: 'PEDIDOS', val: `${pedidosValidos.length}`, corVal: [15, 23, 42], bg: [248, 250, 252], border: [203, 213, 225] },
    { label: 'TOTAL PECAS', val: `${totalPecasGeral} un.`, corVal: [197, 160, 89], bg: [255, 253, 245], border: [253, 230, 138] },
    { label: 'ENTREGAS', val: `${totalEntregas}`, corVal: [37, 99, 235], bg: [239, 246, 255], border: [191, 219, 254] },
    { label: 'BALCAO / LOJA', val: `${totalRetiradas}`, corVal: [217, 119, 6], bg: [254, 252, 232], border: [254, 240, 138] },
    { label: 'FILTRO', val: textoFiltro.length > 14 ? `${textoFiltro.substring(0, 12)}..` : textoFiltro, corVal: [13, 148, 136], bg: [240, 253, 250], border: [153, 246, 228] }
  ];

  kpis.forEach((kpi, idx) => {
    const x = kpiStartX + idx * (kpiWidth + kpiGap);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, currentY, kpiWidth, kpiHeight, 1.8, 1.8, 'FD');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + (kpiWidth / 2), currentY + 3.8, { align: 'center' });

    // Valor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(kpi.corVal[0], kpi.corVal[1], kpi.corVal[2]);
    doc.text(kpi.val, x + (kpiWidth / 2), currentY + 8.8, { align: 'center' });
  });

  currentY += kpiHeight + 5; // Y = ~48.5

  // ═══════════════════════════════════════════════════════════
  // 3. RENDERIZAÇÃO DOS PEDIDOS (AGRUPADO POR CLIENTE / PEDIDO)
  // ═══════════════════════════════════════════════════════════
  pedidosValidos.forEach((loc, pedIdx) => {
    const numPed = loc.numeroPedido ? `#${loc.numeroPedido}` : `PED-${pedIdx + 1}`;
    const clienteNome = loc.clienteNome || 'Cliente nao informado';
    const foneCliente = loc.clienteTelefone || loc.telefone || '';
    const tema = loc.tema || loc.temaFesta || '';
    const isEntrega = verificarSeEhEntrega(loc);
    const endereco = obterEnderecoCompleto(loc);

    const dataSaidaBr = loc.dataRetirada ? loc.dataRetirada.split('-').reverse().join('/') : '--/--/----';
    const horaSaida = loc.horarioRetirada ? `as ${loc.horarioRetirada}` : '';
    const dataDevBr = loc.dataDevolucao ? loc.dataDevolucao.split('-').reverse().join('/') : '';
    const horaDev = loc.horarioDevolucao ? `as ${loc.horarioDevolucao}` : '';

    const motorista = loc.logistica?.motoristaNome;
    const veiculo = loc.logistica?.veiculo;
    const caixasQtd = loc.embalagens?.caixas || loc.embalagens?.caixasPlasticas || 0;
    const sacolasQtd = loc.embalagens?.sacolas || loc.embalagens?.sacolasTecido || 0;
    const capasQtd = loc.embalagens?.capas || loc.embalagens?.capasPainel || 0;
    const observacoes = loc.observacoes || loc.obsSeparacao || loc.logistica?.instrucoesMotorista || '';

    const itens = loc.itens || [];
    const totalPecasPedido = itens.reduce((acc, it) => acc + Number(it.quantidade || it.qtd || 1), 0);

    // Calcular altura necessária para o cabeçalho do pedido
    const temInfoTransporte = motorista || caixasQtd > 0 || sacolasQtd > 0 || capasQtd > 0;
    let cardHeaderHeight = 22;
    if (temInfoTransporte) cardHeaderHeight += 5;
    if (observacoes) cardHeaderHeight += 5;

    // 🔒 PREVENÇÃO DE CABEÇALHO ÓRFÃO:
    // Garante que o cabeçalho do pedido só seja desenhado se houver espaço para ele E para o início da tabela!
    const alturaMinimaNecessaria = cardHeaderHeight + 26;
    if (currentY + alturaMinimaNecessaria > pageHeight - 16) {
      doc.addPage();
      adicionarMarcaDagua();
      desenharMiniCabecalhoPagina(doc.internal.getNumberOfPages());
      currentY = 16;
    }

    // ── BOX DO CABEÇALHO DO PEDIDO ──
    const cardHeaderY = currentY;

    doc.setFillColor(corCinzaFundo[0], corCinzaFundo[1], corCinzaFundo[2]);
    doc.setDrawColor(corCinzaBorda[0], corCinzaBorda[1], corCinzaBorda[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(14, cardHeaderY, pageWidth - 28, cardHeaderHeight, 2, 2, 'FD');

    // Faixa esquerda indicadora de modalidade (Azul Safira para Entrega / Âmbar Dourado para Balcão)
    doc.setFillColor(isEntrega ? 37 : 217, isEntrega ? 99 : 119, isEntrega ? 235 : 6);
    doc.roundedRect(14, cardHeaderY, 3.5, cardHeaderHeight, 1, 1, 'F');

    // Linha 1: Pedido #, Cliente e Tag de Frete
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    const textoClienteHeader = `${numPed} — ${clienteNome.toUpperCase()}${foneCliente ? ` (Tel: ${foneCliente})` : ''}`;
    doc.text(textoClienteHeader.length > 58 ? `${textoClienteHeader.substring(0, 56)}...` : textoClienteHeader, 21, cardHeaderY + 5.8);

    // Tag Frete no Canto Direito (Pílula moderna sem colchetes)
    const tagTxt = isEntrega ? 'ENTREGA PROGRAMADA' : 'RETIRADA NO BALCAO';
    const tagBg = isEntrega ? [239, 246, 255] : [254, 252, 232];
    const tagBorder = isEntrega ? [191, 219, 254] : [254, 240, 138];
    const tagColor = isEntrega ? [29, 78, 216] : [161, 98, 7];

    const tagWidth = 46;
    const tagX = pageWidth - 14 - tagWidth - 2.5;
    doc.setFillColor(tagBg[0], tagBg[1], tagBg[2]);
    doc.setDrawColor(tagBorder[0], tagBorder[1], tagBorder[2]);
    doc.roundedRect(tagX, cardHeaderY + 2, tagWidth, 5.5, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(tagColor[0], tagColor[1], tagColor[2]);
    doc.text(tagTxt, tagX + (tagWidth / 2), cardHeaderY + 5.7, { align: 'center' });

    // Linha 2: Datas de Saída / Retorno e Tema
    let linha2Y = cardHeaderY + 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(corTextoEscuro[0], corTextoEscuro[1], corTextoEscuro[2]);

    let textoLinha2 = `SAIDA: ${dataSaidaBr} ${horaSaida}`;
    if (dataDevBr) textoLinha2 += `   |   RETORNO: ${dataDevBr} ${horaDev}`;
    if (tema) textoLinha2 += `   |   TEMA: ${tema}`;
    doc.text(textoLinha2, 21, linha2Y);

    // Linha 3: Local / Endereço
    let linha3Y = linha2Y + 5;
    const localExibir = isEntrega ? (endereco || 'Endereco de entrega nao informado') : 'Retirada no Galpao / Loja';
    doc.text(`LOCAL: ${localExibir.length > 85 ? `${localExibir.substring(0, 82)}...` : localExibir}`, 21, linha3Y);

    // Linha 4 (Opcional): Transporte e Embalagens
    let proximaLinhaY = linha3Y;
    if (temInfoTransporte) {
      proximaLinhaY += 5;
      const partesTransp = [];
      if (motorista) partesTransp.push(`MOTORISTA: ${motorista}${veiculo ? ` (${veiculo})` : ''}`);
      const partesEmb = [];
      if (caixasQtd > 0) partesEmb.push(`${caixasQtd}cx`);
      if (sacolasQtd > 0) partesEmb.push(`${sacolasQtd}sc`);
      if (capasQtd > 0) partesEmb.push(`${capasQtd}cp`);
      if (partesEmb.length > 0) partesTransp.push(`EMBALAGENS: ${partesEmb.join(', ')}`);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(partesTransp.join('   |   '), 21, proximaLinhaY);
    }

    // Linha 5 (Opcional): Observações
    if (observacoes) {
      proximaLinhaY += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(180, 83, 9);
      doc.text(`OBSERVACOES: ${observacoes.length > 88 ? `${observacoes.substring(0, 85)}...` : observacoes}`, 21, proximaLinhaY);
    }

    currentY += cardHeaderHeight + 2;

    // ── TABELA DE PEÇAS DESTE PEDIDO ──
    const tabelaItensPedido = itens.map(it => {
      const qtd = String(it.quantidade || it.qtd || 1);
      const cod = it.codigo || it.sku || '-';
      const nome = it.nome || it.descricao || 'Item sem nome';
      const localizacao = it.localizacao || it.prateleira || '';
      const nomeComLocal = localizacao ? `${nome}\n[Local: ${localizacao}]` : nome;
      const cat = it.categoria || 'Geral';
      const obsItem = it.observacoes || it.obs || (it.checkedSeparacao ? '[Pre-separado]' : '-');

      return [
        '', // Coluna 0: Checkbox vetorial renderizado via didDrawCell
        qtd,
        cod,
        nomeComLocal,
        cat,
        obsItem
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['CONF', 'QTD', 'CODIGO / SKU', 'DESCRICAO DA PECA / ACERVO', 'CATEGORIA', 'OBSERVACOES DE SEPARACAO']],
      body: tabelaItensPedido.length > 0 ? tabelaItensPedido : [['', '0', '-', 'Nenhuma peca cadastrada neste pedido', '-', '-']],
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        valign: 'middle',
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 7.5,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 13, halign: 'center' },
        1: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 26, halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42] },
        3: { cellWidth: 'auto', fontStyle: 'bold' },
        4: { cellWidth: 32 },
        5: { cellWidth: 44, fontSize: 7, textColor: [71, 85, 105] }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data) => {
        // Desenha quadradinho vetorial de checkbox elegante para conferência a caneta
        if (data.section === 'body' && data.column.index === 0) {
          const dim = 4.2;
          const x = data.cell.x + (data.cell.width - dim) / 2;
          const y = data.cell.y + (data.cell.height - dim) / 2;
          doc.saveGraphicsState();
          doc.setDrawColor(148, 163, 184); // Slate 400
          doc.setFillColor(255, 255, 255);
          doc.setLineWidth(0.35);
          doc.roundedRect(x, y, dim, dim, 0.8, 0.8, 'FD');
          doc.restoreGraphicsState();
        }
      },
      didDrawPage: () => {
        adicionarMarcaDagua();
      }
    });

    // ── SUBTOTAL DO PEDIDO COM CHECK DE SEPARAÇÃO & VISTO ──
    const finalTableY = doc.lastAutoTable.finalY;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, finalTableY, pageWidth - 28, 6.5, 'FD');

    // Mini checkbox de conferência do pedido no subtotal
    doc.setDrawColor(148, 163, 184);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.roundedRect(18, finalTableY + 1.4, 3.8, 3.8, 0.6, 0.6, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text('Separacao Concluida', 23.5, finalTableY + 4.2);

    doc.text('Conferido por: _________________________________', 55, finalTableY + 4.2);

    // Total de peças à direita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`Subtotal do Pedido ${numPed}: ${totalPecasPedido} peca(s)`, pageWidth - 18, finalTableY + 4.2, { align: 'right' });

    currentY = finalTableY + 9;
  });

  // ═══════════════════════════════════════════════════════════
  // 4. ÁREA DE EXPEDIÇÃO & ASSINATURAS (RODAPÉ FINAL)
  // ═══════════════════════════════════════════════════════════
  if (currentY + 34 > pageHeight - 14) {
    doc.addPage();
    adicionarMarcaDagua();
    desenharMiniCabecalhoPagina(doc.internal.getNumberOfPages());
    currentY = 18;
  }

  // Box de Orientação de Galpão
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(14, currentY, pageWidth - 28, 8, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(161, 98, 7);
  doc.text('ORIENTACAO DE GALPAO:', 18, currentY + 5.2);
  doc.setFont('helvetica', 'normal');
  doc.text('Conferir a integridade e estado de conservacao de cada peca antes do carregamento. Acondicionar em embalagens apropriadas.', 56, currentY + 5.2);

  currentY += 14;

  // Linhas de Assinatura
  const sigWidth = 54;
  const sigGap = (pageWidth - 28 - (sigWidth * 3)) / 2;

  const sigs = [
    { label: 'Responsavel pela Separacao', sub: 'Assinatura / Galpao' },
    { label: 'Conferente de Expedicao', sub: 'Conferencia de Saida' },
    { label: 'Motorista / Retirante', sub: 'Recebido para Transporte' }
  ];

  sigs.forEach((sig, sIdx) => {
    const sigX = 14 + sIdx * (sigWidth + sigGap);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(sigX, currentY + 7, sigX + sigWidth, currentY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.label, sigX + (sigWidth / 2), currentY + 11, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.sub, sigX + (sigWidth / 2), currentY + 14, { align: 'center' });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. NUMERAÇÃO DE PÁGINAS & AUDITORIA DE RODAPÉ
  // ═══════════════════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Linha divisória de rodapé
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${nomeEmpresa} • Mapa Geral de Separacao de Galpao`, 14, pageHeight - 5);
    doc.text(`Pagina ${p} de ${totalPages}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
  }

  // Nome do arquivo e Título
  const nomeArquivo = `Mapa_Separacao_Galpao_${dataHoje.replace(/\//g, '-')}.pdf`;
  const titulo = `Mapa de Separacao de Galpao (${pedidosValidos.length} pedidos)`;

  if (acao === 'download') {
    doc.save(nomeArquivo);
    return { doc, nomeArquivo, titulo };
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { doc, blob, url, nomeArquivo, titulo };
};
