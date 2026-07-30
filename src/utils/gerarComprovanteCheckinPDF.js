import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebreMarcaDagua from '../assets/LOGO_CELEBRE.png';

export const gerarComprovanteCheckinPDF = (locacao, modo = 'IDA', itensConferidos = [], dadosAdicionais = {}, dadosEmpresa = {}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const isIda = modo === 'IDA';
  const numeroPedido = locacao.numeroPedido || locacao.id?.substring(0, 6).toUpperCase();
  const clienteNome = locacao.clienteNome || locacao.cliente?.nome || 'Cliente não informado';
  const nomeEmpresaAssinante = dadosEmpresa?.nomeEmpresa || dadosEmpresa?.nomeFantasia || dadosEmpresa?.nome || 'ÁGAPE DECORAÇÕES & EVENTOS';
  const logoEmpresaAssinante = dadosEmpresa?.logotipo || dadosEmpresa?.logoUrl || dadosEmpresa?.logo || null;

  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // 💎 COR DOURADA E AZUL ESCURO CELEBRE
  const corDourado = [197, 160, 89];
  const corAzulEscuro = [15, 23, 42];

  // 🚀 MARCA D'ÁGUA SUAVE CELEBRE NO CENTRO DA PÁGINA (OPACIDADE LEVE)
  try {
    // Adiciona a marca d'água no centro da folha A4 (X: 55mm, Y: 100mm, W: 100mm, H: 100mm)
    // Usando a logo Celebre com baixa presença de opacidade visual
    doc.saveGraphicsState();
    if (typeof doc.setGState === 'function') {
      doc.setGState(new doc.GState({ opacity: 0.05 }));
    }
    doc.addImage(logoCelebreMarcaDagua, 'PNG', 55, 100, 100, 100);
    doc.restoreGraphicsState();
  } catch (e) {
    console.error("Erro ao desenhar marca d'água no PDF:", e);
  }

  // 🚀 CABEÇALHO PRINCIPAL DO COMPROVANTE
  doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.rect(0, 0, 210, 32, 'F');

  // Faixa Dourada no rodapé do cabeçalho
  doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
  doc.rect(0, 32, 210, 2.5, 'F');

  // Desenhar a Logo EXCLUSIVA da Empresa Assinante (Se cadastrada em Identidade Visual)
  let xTexto = 14;
  if (logoEmpresaAssinante && String(logoEmpresaAssinante).trim().length > 20) {
    try {
      const isJpeg = String(logoEmpresaAssinante).includes('jpeg') || String(logoEmpresaAssinante).includes('jpg');
      const formato = isJpeg ? 'JPEG' : 'PNG';
      doc.addImage(logoEmpresaAssinante, formato, 12, 4, 24, 24);
      xTexto = 42;
    } catch (e) {
      console.error("Erro ao desenhar logotipo da empresa contratante:", e);
      xTexto = 14;
    }
  }

  // Título do Comprovante e Nome da Empresa Contratante no Cabeçalho
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const tituloDoc = isIda 
    ? 'COMPROVANTE DE VISTORIA - EXPEDIÇÃO (IDA)' 
    : 'COMPROVANTE DE VISTORIA - DEVOLUÇÃO (VOLTA)';
  doc.text(tituloDoc, xTexto, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(253, 230, 138); // Dourado Claro da Empresa
  doc.text(nomeEmpresaAssinante.toUpperCase(), xTexto, 21);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(`Emissão: ${dataHoje} às ${horaHoje}`, xTexto, 27);

  // 📋 QUADRO DE INFORMAÇÕES DA LOCAÇÃO E CLIENTE
  let y = 40;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, y, 186, 28, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`PEDIDO #${numeroPedido}`, 18, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clienteNome}`, 18, y + 15);
  doc.text(`Data Evento / Retirada: ${locacao.dataRetirada ? locacao.dataRetirada.split('-').reverse().join('/') : 'S/D'}`, 18, y + 21);

  doc.text(`Modalidade: ${locacao.modalidadeServico === 'pegue_monte' ? 'Pegue e Monte' : 'Decoração Completa'}`, 110, y + 8);
  doc.text(`Responsável: ${dadosAdicionais.responsavel || 'Equipe Galpão'}`, 110, y + 15);
  if (locacao.dataDevolucao) {
    doc.text(`Data Devolução: ${locacao.dataDevolucao.split('-').reverse().join('/')}`, 110, y + 21);
  }

  y += 34;

  // 📦 TABELA DE ITENS COM CHECKBOX E LINHA PARA ANOTAÇÃO EM PAPEL
  const tableHead = [['Check [  ]', '#', 'Código SKU', 'Peça / Item do Acervo', 'Qtd', 'Observações / Vistoria Física (Anotações)']];
  
  const tableRows = itensConferidos.map((item, idx) => {
    const qtdContratada = item.quantidade || 1;
    const isConferidoTot = item.qtdConferida >= qtdContratada;

    let obsLinha = '__________________________________________________';
    if (!isIda && item.statusRetorno === 'avaria') {
      obsLinha = `AVARIA: ${item.motivoAvaria || 'Danificado'}`;
    } else if (!isIda && item.statusRetorno === 'faltou') {
      obsLinha = 'ITEM FALTANTE / EXTRAVIO';
    } else if (isConferidoTot) {
      obsLinha = `Conferido OK (${item.qtdConferida}/${qtdContratada} un)`;
    }

    return [
      isConferidoTot ? '[ X ]' : '[   ]',
      idx + 1,
      item.codigo || 'S/C',
      item.nome || item.descricao || 'Item sem nome',
      `${qtdContratada} un`,
      obsLinha
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: corDourado,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center'
    },
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 26 },
      3: { cellWidth: 62 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 50 }
    }
  });

  y = doc.lastAutoTable.finalY + 10;

  // 📝 OBSERVAÇÕES DA VISTORIA
  if (dadosAdicionais.observacoes) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações Gerais do Check-in:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitObs = doc.splitTextToSize(dadosAdicionais.observacoes, 180);
    doc.text(splitObs, 14, y + 4);
    y += (splitObs.length * 4) + 8;
  } else {
    y += 4;
  }

  // ✍️ SEÇÃO DE ASSINATURAS E CONFIRMAÇÃO
  if (y > 230) {
    doc.addPage();
    y = 30;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARAÇÃO E TERMO DE CONFIRMAÇÃO DE VISTORIA:', 14, y);
  
  y += 18;

  // Assinatura do Responsável da Empresa Contratante
  doc.setDrawColor(148, 163, 184);
  doc.line(14, y, 95, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Responsável: ${dadosAdicionais.responsavel || 'Equipe Galpão'}`, 14, y + 4);
  doc.text(`Data/Hora: ${dataHoje} às ${horaHoje}`, 14, y + 8);

  // Assinatura do Cliente
  if (dadosAdicionais.assinaturaUrl) {
    try {
      doc.addImage(dadosAdicionais.assinaturaUrl, 'PNG', 115, y - 16, 65, 14);
    } catch (e) {
      console.error("Erro ao desenhar assinatura no PDF:", e);
    }
  }
  
  doc.line(115, y, 196, y);
  doc.text(`Assinatura do Cliente / Retirante: ${clienteNome}`, 115, y + 4);
  doc.text('Declaro que conferi e confirmo o estado e vistoria das peças acima.', 115, y + 8);

  // 📌 RODAPÉ FIXO DO PDF COM CRÉDITO DISCRETO DO SISTEMA E NOME DA EMPRESA
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento emitido por ${nomeEmpresaAssinante}  •  Powered by Celebre Sistema de Gestão`, 105, 287, { align: 'center' });

  // 💾 SALVAR ARQUIVO PDF
  const nomeArquivo = `Comprovante_Vistoria_${modo}_Pedido_${numeroPedido}.pdf`;
  doc.save(nomeArquivo);

  return doc;
};
