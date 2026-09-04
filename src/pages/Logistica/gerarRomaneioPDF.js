import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebreMarcaDagua from '../../assets/LOGO_CELEBRE.png';

/**
 * 📄 GERADOR DE ROMANEIO DE CARGA & ROTA DO MOTORISTA (PDF)
 * Folha de Campo Executiva para Motoristas, Montadores e Galpão
 * Design 100% blindado sem caracteres especiais corrompidos e sem sobreposições.
 */
export const gerarRomaneioPDF = (
  locacoes = [],
  filtroInfo = {},
  dadosEmpresa = {},
  acao = 'preview'
) => {
  if (!locacoes || locacoes.length === 0) {
    alert("⚠️ Não há pedidos na lista para gerar o Romaneio de Carga.");
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

  const dataRota = filtroInfo.data 
    ? filtroInfo.data.split('-').reverse().join('/') 
    : dataHoje;
  const motoristaNome = filtroInfo.motorista || 'Todos os Motoristas / Veículos';

  // ── PALETA DE CORES LUXURY ──
  const corDourado = [197, 160, 89];
  const corAzulEscuro = [15, 23, 42];
  const corZebra = [248, 250, 252];
  const corCinzaTexto = [100, 116, 139];

  // ── CÁLCULO DOS KPIS DA ROTA ──
  let totalEntregas = 0;
  let totalColetas = 0;
  let totalSaldoReceber = 0;
  let totalCaixas = 0;
  let totalSacolas = 0;

  locacoes.forEach(loc => {
    const isEntrega = loc.logistica?.tipo === 'entrega' || String(loc.logistica?.tipoFrete || '').toLowerCase().includes('entrega') || loc.status !== 'finalizado';
    if (isEntrega) totalEntregas++;
    else totalColetas++;

    // Saldo Devedor
    const valorTotal = Number(loc.valorTotal || loc.total || 0);
    const valorPago = Number(loc.valorPago || loc.sinal || 0);
    const saldoPendente = Math.max(0, valorTotal - valorPago);
    totalSaldoReceber += saldoPendente;

    // Embalagens
    if (loc.embalagens) {
      totalCaixas += Number(loc.embalagens.caixas || loc.embalagens.caixasPlasticas || 0);
      totalSacolas += Number(loc.embalagens.sacolas || loc.embalagens.sacolasTecido || 0);
    }
  });

  // ── RESUMO EXECUTIVO (KPIS DA ROTA - PÁGINA 1) ──
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 32, pageWidth - 28, 13, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);

  doc.text(`PARADAS: ${locacoes.length}`, 18, 40);
  doc.text(`ENTREGAS: ${totalEntregas}`, 46, 40);
  doc.text(`COLETAS: ${totalColetas}`, 74, 40);
  
  if (totalCaixas > 0 || totalSacolas > 0) {
    doc.text(`EMBALAGENS: ${totalCaixas} CX / ${totalSacolas} SC`, 102, 40);
  }

  doc.setTextColor(180, 83, 9); // Dourado escuro
  const txtSaldo = `SALDO A COBRAR: ${totalSaldoReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  doc.text(txtSaldo, pageWidth - 18, 40, { align: 'right' });

  // ── TABELA DE PARADAS DA ROTA ──
  const tableData = locacoes.map((loc, idx) => {
    const isEntrega = loc.logistica?.tipo === 'entrega' || String(loc.logistica?.tipoFrete || '').toLowerCase().includes('entrega') || loc.status !== 'finalizado';
    const tipoTxt = isEntrega ? 'ENTREGA' : 'COLETA';
    const numPed = loc.numeroPedido ? `#${loc.numeroPedido}` : `#${loc.id.substring(0, 5).toUpperCase()}`;
    const foneCliente = loc.clienteTelefone || loc.telefone || 'Sem telefone';
    const clienteTxt = `${loc.clienteNome || 'Cliente'}\n${foneCliente}`;
    
    // Endereço (se for longo, cai pra baixo em 2 linhas devido à largura de 31mm)
    const endCompleto = loc.logistica?.endereco || loc.endereco || 'Retirada no Galpão';
    const bairroCidade = [loc.logistica?.bairro, loc.logistica?.cidade].filter(Boolean).join(' - ');
    const localTxt = `${endCompleto}${bairroCidade ? `\n${bairroCidade}` : ''}`;

    const horaPrev = isEntrega 
      ? (loc.horarioRetirada || loc.hora || '--:--')
      : (loc.horarioDevolucao || '--:--');

    // Saldo
    const valorTotal = Number(loc.valorTotal || loc.total || 0);
    const valorPago = Number(loc.valorPago || loc.sinal || 0);
    const saldoPendente = Math.max(0, valorTotal - valorPago);
    const saldoTxt = saldoPendente > 0 
      ? `A RECEBER:\n${saldoPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      : 'QUITADO';

    // Resumo de Peças / Embalagens
    const qtdItens = loc.itens ? loc.itens.length : 0;
    const cxInfo = loc.embalagens?.caixas ? `${loc.embalagens.caixas} cx` : '';
    const scInfo = loc.embalagens?.sacolas ? `${loc.embalagens.sacolas} sc` : '';
    const embTxt = [cxInfo, scInfo].filter(Boolean).join(', ');

    const itensDesc = loc.itens && loc.itens.length > 0 
      ? loc.itens.slice(0, 3).map(i => `• ${i.qtd || 1}x ${i.nome}`).join('\n') + (loc.itens.length > 3 ? `\n(+${loc.itens.length - 3} itens...)` : '')
      : `${qtdItens} itens`;

    const pecaLabel = qtdItens === 1 ? 'peça' : 'peças';
    const cargaTxt = `${qtdItens} ${pecaLabel} ${embTxt ? `[${embTxt}]` : ''}\n${itensDesc}`;

    return [
      `${idx + 1}º\n${horaPrev}`,
      tipoTxt,
      `${numPed}\n${clienteTxt}`,
      localTxt,
      saldoTxt,
      cargaTxt,
      'Visto / Recebedor:\n\n________________________'
    ];
  });

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14, top: 32, bottom: 20 },
    head: [['Parada / Hora', 'Tipo', 'Pedido / Cliente', 'Endereço / Local', 'Cobrança', 'Carga / Embalagens', 'Recebido por']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: corAzulEscuro,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 2.8
    },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 2.5,
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: corZebra
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 31 },
      3: { cellWidth: 31, overflow: 'linebreak' }, // Reduzido de 42mm para 31mm (quebra em 2 linhas)
      4: { cellWidth: 21, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 31 },
      6: { cellWidth: 34, halign: 'center', fontSize: 6.5 } // Ampliado de 20mm para 34mm (assinatura espaçosa)
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 4) {
        if (data.cell.raw && data.cell.raw.includes('A RECEBER')) {
          data.cell.styles.textColor = [220, 38, 38]; // Vermelho
        } else {
          data.cell.styles.textColor = [22, 163, 74]; // Verde
        }
      }
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'ENTREGA') {
          data.cell.styles.textColor = [37, 99, 235]; // Azul
        } else {
          data.cell.styles.textColor = [124, 58, 237]; // Roxo
        }
      }
    }
  });

  // ── ASSINATURAS FINAIS DO MOTORISTA E EXPEDIÇÃO ──
  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 200;
  if (finalY + 22 > pageHeight - 16) {
    doc.addPage();
    finalY = 38;
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(24, finalY + 10, 85, finalY + 10);
  doc.line(pageWidth - 85, finalY + 10, pageWidth - 24, finalY + 10);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(corCinzaTexto[0], corCinzaTexto[1], corCinzaTexto[2]);
  doc.text(`Motorista / Transportador: ${motoristaNome}`, 54.5, finalY + 14, { align: 'center' });
  doc.text(`Expedição / Conferência Galpão`, pageWidth - 54.5, finalY + 14, { align: 'center' });

  // ── CABEÇALHO E RODAPÉ APLICADOS EM TODAS AS PÁGINAS ──
  const totalPaginas = doc.internal.getNumberOfPages();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);

    // Marca d'água central
    try {
      doc.saveGraphicsState();
      if (typeof doc.setGState === 'function') {
        doc.setGState(new doc.GState({ opacity: 0.035 }));
      }
      doc.addImage(logoCelebreMarcaDagua, 'PNG', (pageWidth - 90) / 2, (pageHeight - 90) / 2, 90, 90);
      doc.restoreGraphicsState();
    } catch (e) {}

    // Top Bar Dourado
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 0, pageWidth, 2.5, 'F');

    // Header Principal Navy
    doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.rect(0, 2.5, pageWidth, 24, 'F');

    // Borda inferior dourada fina do Header
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 26.5, pageWidth, 1.2, 'F');

    // Logo da Empresa
    let textStartX = 14;
    if (logoEmpresaSrc) {
      try {
        const isJpeg = typeof logoEmpresaSrc === 'string' && (logoEmpresaSrc.includes('image/jpeg') || logoEmpresaSrc.includes('image/jpg'));
        const format = isJpeg ? 'JPEG' : 'PNG';
        doc.addImage(logoEmpresaSrc, format, 14, 4, 21, 20.5);
        textStartX = 38;
      } catch (e) {
        console.warn("Logotipo não pôde ser renderizado no romaneio:", e);
      }
    }

    // Nome da Empresa em Destaque
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(nomeEmpresa.toUpperCase(), textStartX, 9.5);

    // Contato da Empresa
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(203, 213, 225);
    const infoEmpresa = [telEmpresa, dadosEmpresa?.cnpj || dadosEmpresa?.cidade].filter(Boolean).join(' • ');
    if (infoEmpresa) {
      doc.text(infoEmpresa, textStartX, 14);
    }

    // Subtítulo da Rota
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(253, 230, 138); // Dourado claro
    doc.text(`Data da Rota: ${dataRota}   |   Motorista: ${motoristaNome.toUpperCase()}`, textStartX, infoEmpresa ? 18.5 : 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Emitido em: ${dataHoje} às ${horaHoje}`, textStartX, infoEmpresa ? 23 : 20.5);

    // Lado Direito do Cabeçalho: Título Oficial do Documento
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.text('ROMANEIO DE CARGA', pageWidth - 14, 10, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('ROTA DE ENTREGAS & COLETAS', pageWidth - 14, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - 14, 20.5, { align: 'right' });

    // Rodapé Limpo
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(corCinzaTexto[0], corCinzaTexto[1], corCinzaTexto[2]);
    doc.text(`${nomeEmpresa} • Sistema Celebre Logística`, 14, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  // ── SALVAR OU RETORNAR OBJETO DE PREVIEW ──
  const nomeArquivo = `Romaneio_Rota_${dataRota.replace(/\//g, '-')}_${motoristaNome.replace(/\s+/g, '_')}.pdf`;
  const titulo = `Romaneio da Rota (${motoristaNome} • ${locacoes.length} paradas)`;

  if (acao === 'download') {
    doc.save(nomeArquivo);
    return { doc, nomeArquivo, titulo };
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { doc, blob, url, nomeArquivo, titulo };
};
