import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebrePadrao from '../assets/LOGO_CELEBRE.png';

/**
 * 📄 GERADOR DE PROPOSTA / ORÇAMENTO EM PDF LUXO
 * @param {Object} pedido - Objeto do pedido/locação
 * @param {Object} empresa - Dados da empresa (configuracoes_empresa)
 * @param {Object} clienteObj - Dados do cliente cadastrado (opcional)
 * @param {string} acao - 'download' ou 'preview' (padrão 'preview')
 */
export const gerarPropostaPDF = (pedido, empresa = {}, clienteObj = {}, acao = 'preview') => {
  if (!pedido) return alert('Dados do pedido inválidos para gerar proposta.');

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

  const numPedido = pedido.numeroPedido ? `#${pedido.numeroPedido}` : (pedido.id ? `#${pedido.id.substring(0, 6).toUpperCase()}` : '#S/N');
  const nomeEmpresa = empresa?.nomeEmpresa || empresa?.nomeFantasia || empresa?.razaoSocial || 'CELEBRE FESTAS & EVENTOS';
  const cnpjEmpresa = empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : '';
  const telEmpresa = empresa?.telefone || empresa?.celular || empresa?.whatsapp || '';
  const emailEmpresa = empresa?.emailEmpresa || empresa?.email || '';

  const nomeCliente = clienteObj?.nome || clienteObj?.nomeFantasia || clienteObj?.razaoSocial || pedido.clienteNome || pedido.nomeCliente || 'Cliente Celebre';
  const telCliente = clienteObj?.celular || clienteObj?.telefone || pedido.clienteCelular || pedido.celular || '';
  const docCliente = clienteObj?.cpfCnpj || clienteObj?.cpf || clienteObj?.cnpj || '';
  const emailCliente = clienteObj?.email || '';

  const dataRetirada = pedido.dataRetirada ? new Date(pedido.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : (pedido.datas?.retirada ? new Date(pedido.datas.retirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'A combinar');
  const dataDevolucao = pedido.dataDevolucao ? new Date(pedido.dataDevolucao + 'T12:00:00').toLocaleDateString('pt-BR') : (pedido.datas?.devolucao ? new Date(pedido.datas.devolucao + 'T12:00:00').toLocaleDateString('pt-BR') : 'A combinar');
  const tipoServico = String(pedido.tipoServico || 'PEGUE E MONTE').toUpperCase();
  const temaFesta = pedido.temaFesta || pedido.tema || 'Festa Celebre';
  const status = (pedido.status || 'orcamento').toUpperCase();

  // 🏷️ TÍTULO DO DOCUMENTO / ARQUIVO: "PROPOSTA ORÇAMENTO - [NOME DO CLIENTE]"
  const nomeClienteFormatado = nomeCliente.replace(/[/\\?%*:|"<>]/g, '').trim();
  const nomeDocumentoFormatado = `PROPOSTA ORÇAMENTO - ${nomeClienteFormatado.toUpperCase()}`;

  doc.setProperties({
    title: nomeDocumentoFormatado,
    subject: 'Proposta Comercial / Orçamento de Locação',
    author: nomeEmpresa,
    creator: 'Celebre Sistema de Gestão'
  });

  // 1. TOP HEADER BANNER (Marinho Noturno com acento Dourado)
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFillColor(...goldColor);
  doc.rect(0, 28, 210, 2, 'F');

  // 🖼️ INSERÇÃO DA LOGO DA EMPRESA (CONFIGURAÇÕES - EMPRESA) OU FALLBACK
  const logoEmpresaSrc = empresa?.logotipo || empresa?.logoUrl || empresa?.logo || logoCelebrePadrao;
  let textStartX = 14;

  if (logoEmpresaSrc && typeof logoEmpresaSrc === 'string' && logoEmpresaSrc.length > 20) {
    try {
      const isJpeg = logoEmpresaSrc.includes('image/jpeg') || logoEmpresaSrc.includes('image/jpg');
      const format = isJpeg ? 'JPEG' : 'PNG';
      // Desenha a logo no canto esquerdo dentro do banner marinho
      doc.addImage(logoEmpresaSrc, format, 12, 3, 22, 22);
      textStartX = 38;
    } catch (e) {
      console.error("Erro ao inserir logotipo da empresa no PDF:", e);
    }
  }

  // Nome da Empresa
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(nomeEmpresa.toUpperCase(), textStartX, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const infoEmpresaLinha = [cnpjEmpresa, telEmpresa, emailEmpresa].filter(Boolean).join(' | ');
  doc.text(infoEmpresaLinha, textStartX, 19);

  // Título da Proposta no Canto Direito do Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...goldColor);
  doc.text('PROPOSTA COMERCIAL', 196, 13, { align: 'right' });

  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`PEDIDO ${numPedido}`, 196, 19, { align: 'right' });

  let y = 36;

  // 2. STATUS BADGE & DATA DE EMISSÃO
  doc.setFillColor(...lightGray);
  doc.roundedRect(14, y, 182, 10, 2, 2, 'FD');
  doc.setDrawColor(...borderColor);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkGray);
  doc.text(`TEMA: ${temaFesta.toUpperCase()}`, 18, y + 6.5);

  doc.setTextColor(...goldColor);
  doc.text(`STATUS: ${status}`, 192, y + 6.5, { align: 'right' });

  y += 15;

  // 3. BLISTERS DE INFORMAÇÕES DO CLIENTE E EVENTO (2 Colunas - Sem Emojis para evitar glitches)
  const colW = 88;
  
  // Coluna 1: Dados do Cliente
  doc.setFillColor(...lightGray);
  doc.roundedRect(14, y, colW, 32, 3, 3, 'FD');
  doc.setFillColor(...primaryColor);
  doc.rect(14, y, colW, 7, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DADOS DO CLIENTE', 18, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkGray);
  doc.text(`Nome: ${nomeCliente}`, 18, y + 13);
  if (telCliente) doc.text(`Contato: ${telCliente}`, 18, y + 18);
  if (docCliente) doc.text(`CPF/CNPJ: ${docCliente}`, 18, y + 23);
  if (emailCliente) doc.text(`E-mail: ${emailCliente}`, 18, y + 28);

  // Coluna 2: Dados do Evento & Logística
  const xCol2 = 108;
  doc.setFillColor(...lightGray);
  doc.roundedRect(xCol2, y, colW, 32, 3, 3, 'FD');
  doc.setFillColor(...goldColor);
  doc.rect(xCol2, y, colW, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DETALHES DO EVENTO & SERVICO', xCol2 + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkGray);
  doc.text(`Modalidade: ${tipoServico}`, xCol2 + 4, y + 13);
  doc.text(`Data Retirada/Evento: ${dataRetirada}`, xCol2 + 4, y + 18);
  doc.text(`Data Devolucao: ${dataDevolucao}`, xCol2 + 4, y + 23);
  
  const tipoLog = (pedido.logistica?.tipo === 'entrega' || pedido.logistica?.frete) ? 'Com Frete (Entrega)' : 'Retirada no Balcao';
  doc.text(`Logistica: ${tipoLog}`, xCol2 + 4, y + 28);

  y += 38;

  // 4. TABELA DE ITENS (jspdf-autotable)
  const itens = pedido.itens || pedido.carrinho || [];

  const tableBody = itens.map((item, idx) => {
    const nome = item.nome || item.titulo || `Peça #${idx + 1}`;
    const qtd = Number(item.qtd || 1);
    const precoUnit = Number(item.preco || item.financeiro?.valorAluguel || 0);
    const subtotal = qtd * precoUnit;

    return [
      `${idx + 1}`,
      nome,
      `${qtd} un.`,
      `R$ ${precoUnit.toFixed(2)}`,
      `R$ ${subtotal.toFixed(2)}`
    ];
  });

  if (tableBody.length === 0) {
    tableBody.push(['-', 'Locação de Itens Selecionados', '1 un.', `R$ ${Number(pedido.valorTotal || 0).toFixed(2)}`, `R$ ${Number(pedido.valorTotal || 0).toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'PECA / ITEM DA LOCACAO', 'QTD', 'UNITARIO', 'TOTAL']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: darkGray,
      borderColor: borderColor
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  y = doc.lastAutoTable.finalY + 8;

  // 5. RESUMO FINANCEIRO (CARD NO CANTO DIREITO)
  const subtotalVal = Number(pedido.valorTotal || pedido.total || 0) + Number(pedido.desconto || 0) - (Number(pedido.logistica?.frete) || 0);
  const freteVal = Number(pedido.logistica?.frete) || 0;
  const descontoVal = Number(pedido.desconto || 0);
  const totalVal = Number(pedido.valorTotal || pedido.total || 0);
  const pagoVal = Number(pedido.valorPago || 0);
  const saldoVal = Math.max(0, totalVal - pagoVal);

  const finW = 90;
  const finX = 106;

  doc.setFillColor(...lightGray);
  doc.roundedRect(finX, y, finW, 44, 3, 3, 'FD');
  doc.setDrawColor(...goldColor);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('RESUMO FINANCEIRO', finX + 6, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);

  doc.text('Subtotal Pecas:', finX + 6, y + 14);
  doc.text(`R$ ${subtotalVal.toFixed(2)}`, finX + finW - 6, y + 14, { align: 'right' });

  doc.text('Taxa de Frete:', finX + 6, y + 19);
  doc.text(`+ R$ ${freteVal.toFixed(2)}`, finX + finW - 6, y + 19, { align: 'right' });

  if (descontoVal > 0) {
    doc.text('Desconto:', finX + 6, y + 24);
    doc.setTextColor(22, 163, 74); // verde
    doc.text(`- R$ ${descontoVal.toFixed(2)}`, finX + finW - 6, y + 24, { align: 'right' });
    doc.setTextColor(...darkGray);
  }

  doc.setDrawColor(...borderColor);
  doc.line(finX + 6, y + 27, finX + finW - 6, y + 27);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...goldColor);
  doc.text('VALOR TOTAL:', finX + 6, y + 33);
  doc.text(`R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, finX + finW - 6, y + 33, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`Sinal / Ja Pago: R$ ${pagoVal.toFixed(2)}`, finX + 6, y + 39);
  doc.setFont('helvetica', 'bold');
  doc.text(`Saldo: R$ ${saldoVal.toFixed(2)}`, finX + finW - 6, y + 39, { align: 'right' });

  // 6. CAIXA DE CONDIÇÕES & CHAVE PIX (CANTO ESQUERDO)
  const condW = 86;
  doc.setFillColor(...lightGray);
  doc.roundedRect(14, y, condW, 44, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('CONDICOES & PAGAMENTO', 18, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...darkGray);

  const chavePix = empresa?.chavePix || 'Solicite por WhatsApp';
  doc.text(`• Chave PIX: ${chavePix}`, 18, y + 14);
  doc.text('• Validade desta proposta: 5 dias uteis', 18, y + 20);
  doc.text('• Reserva garantida mediante sinal (50%)', 18, y + 26);
  doc.text('• Pecas sujeitas a disponibilidade de estoque', 18, y + 32);
  doc.text('• Devolucao no prazo sob pena de diaria extra', 18, y + 38);

  y += 50;

  // 7. FOOTER DA PÁGINA
  doc.setDrawColor(...borderColor);
  doc.line(14, 280, 196, 280);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(` ${nomeEmpresa} - Sistema de Gestao Empresarial`, 14, 285);
  doc.text(`Pagina 1 de 1 - Emissao: ${new Date().toLocaleDateString('pt-BR')}`, 196, 285, { align: 'right' });

  // Ação final: Download ou Preview com título "PROPOSTA ORÇAMENTO - [NOME DO CLIENTE]"
  if (acao === 'download') {
    doc.save(`${nomeDocumentoFormatado}.pdf`);
  } else {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const pdfWindow = window.open(pdfUrl, '_blank');
    if (pdfWindow) {
      try {
        pdfWindow.document.title = nomeDocumentoFormatado;
      } catch (err) {
        console.log("Título da aba ajustado:", err);
      }
    }
  }
};
