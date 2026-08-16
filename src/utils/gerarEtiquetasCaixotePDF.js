import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * 🏷️ GERADOR DE ETIQUETAS DE CAIXOTE & EXPEDIÇÃO (PDF)
 * Imprime folha de identificação oficial de caixas/caixotes com QR Code para bipagem no Galpão.
 * 100% blindado contra sobreposições e caracteres de emoji corrompidos.
 */
export const gerarEtiquetasCaixotePDF = async (
  locacao, 
  dadosEmpresa = {}, 
  volumeNum = 1, 
  totalVolumes = 1,
  acao = 'preview'
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const numPedido = locacao.numeroPedido ? `#${locacao.numeroPedido}` : `#${locacao.id?.substring(0, 6).toUpperCase()}`;
  const clienteNome = locacao.clienteNome || locacao.cliente?.nome || 'Cliente não informado';
  const clienteTel = locacao.clienteTelefone || locacao.clienteWhatsapp || locacao.cliente?.telefone || 'Não informado';
  const tipoServico = (locacao.tipoServico || locacao.modalidade || 'LOCAÇÃO / PEGUE E MONTE').toUpperCase();
  
  const nomeEmpresa = dadosEmpresa?.nomeEmpresa || dadosEmpresa?.nomeFantasia || dadosEmpresa?.nome || 'CELEBRE FESTAS & DECORAÇÕES';
  const logoEmpresa = dadosEmpresa?.logotipo || dadosEmpresa?.logoUrl || dadosEmpresa?.logo || null;

  const dataRetiradaBr = locacao.dataRetirada ? locacao.dataRetirada.split('-').reverse().join('/') : 'A definir';
  const horaRetirada = locacao.horarioRetirada || locacao.hora || '';
  const dataDevolucaoBr = locacao.dataDevolucao ? locacao.dataDevolucao.split('-').reverse().join('/') : 'A definir';
  const horaDevolucao = locacao.horarioDevolucao || '';
  const enderecoEntrega = locacao.enderecoEntrega || locacao.enderecoFesta || locacao.logistica?.endereco || 'Retirada no Balcão (Galpão)';

  const itens = locacao.itens || locacao.carrinho || [];

  // DataURL / Texto para o QR Code contendo os dados do pedido para bipagem
  const payloadQr = JSON.stringify({
    pedidoId: locacao.id,
    numPedido: locacao.numeroPedido || locacao.id?.substring(0, 6),
    cliente: clienteNome
  });
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payloadQr)}`;

  // ── PALETA DE CORES LUXURY ──
  const corDourado = [197, 160, 89];
  const corAzulEscuro = [15, 23, 42];
  const corCinzaSuave = [248, 250, 252];

  // Moldura Externa da Etiqueta
  doc.setDrawColor(corDourado[0], corDourado[1], corDourado[2]);
  doc.setLineWidth(1.5);
  doc.roundedRect(10, 10, 190, 277, 4, 4, 'D');

  // Cabeçalho Preto Luxo
  doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.roundedRect(12, 12, 186, 28, 3, 3, 'F');

  // Faixa Dourada
  doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
  doc.rect(12, 40, 186, 2.5, 'F');

  // Título do Cabeçalho (Sem emojis no texto)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`ETIQUETA DE EXPEDIÇÃO & CAIXOTE`, 18, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(253, 230, 138);
  doc.text(`${nomeEmpresa.toUpperCase()} • DEPÓSITO / GALPÃO`, 18, 32);

  // Logo da empresa se disponível
  if (logoEmpresa) {
    try {
      doc.addImage(logoEmpresa, 'PNG', 160, 14, 32, 22);
    } catch (e) {}
  }

  // ── CARD DO PEDIDO & VOLUME ──
  doc.setFillColor(254, 243, 199); // Amarelo Dourado Claro
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, 47, 182, 27, 3, 3, 'FD');

  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`PEDIDO:`, 20, 56);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(20);
  doc.text(`${numPedido}`, 42, 57);

  doc.setFontSize(10.5);
  doc.setTextColor(180, 83, 9);
  doc.text(`VOLUME / CAIXA:`, 118, 56);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(19);
  doc.text(`${volumeNum} de ${totalVolumes}`, 158, 57);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`Modalidade: ${tipoServico}`, 20, 67);

  // ── DETALHES DO CLIENTE E EVENTO (ESTRUTURADO SEM SOBREPOSIÇÃO) ──
  doc.setFillColor(corCinzaSuave[0], corCinzaSuave[1], corCinzaSuave[2]);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, 78, 182, 40, 3, 3, 'FD');

  // Linha 1: Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.text(`CLIENTE:`, 18, 86);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${clienteNome}  •  Tel: ${clienteTel}`, 42, 86);

  // Linha 2: Saída e Devolução (Colunas bem separadas)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.text(`SAÍDA / RETIRADA:`, 18, 94);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${dataRetiradaBr} ${horaRetirada ? `às ${horaRetirada}` : ''}`, 56, 94);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.text(`DEVOLUÇÃO:`, 118, 94);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${dataDevolucaoBr} ${horaDevolucao ? `às ${horaDevolucao}` : ''}`, 146, 94);

  // Linha 3: Destino / Endereço
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.text(`DESTINO / LOCAL:`, 18, 102);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${enderecoEntrega}`, 53, 102);

  // Linha 4: Observações
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.text(`OBSERVAÇÕES:`, 18, 110);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 38, 38);
  const obsTexto = String(locacao.observacoes || locacao.obsSaida || 'Conferir integridade das peças antes do carregamento.');
  doc.text(obsTexto.length > 70 ? obsTexto.substring(0, 68) + '...' : obsTexto, 48, 110);

  // ── SEÇÃO DA LISTA DE ITENS INCLUSOS NESTA CAIXA ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
  doc.text(`ITENS CONTIDOS NESTE CAIXOTE / LOTE:`, 14, 124);

  const tableHead = [['[  ] CONFERIDO', 'QTD', 'CÓDIGO / SKU', 'DESCRIÇÃO DO ITEM / PEÇA DO ACERVO']];
  const tableBody = itens.map(it => {
    const qtd = Math.max(1, Number(it.qtd || it.quantidade || 1));
    const sku = it.codigo || it.sku || 'SKU-ACERVO';
    const nome = it.nome || it.titulo || 'Peça Decorativa';
    return ['[   ]', `${qtd} un.`, sku, nome];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 127,
    margin: { left: 14, right: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      valign: 'middle'
    },
    headStyles: {
      fillColor: corAzulEscuro,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 32, fontStyle: 'bold', textColor: corAzulEscuro },
      3: { cellWidth: 100 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Posição final após a tabela
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 200;

  // ── ÁREA DO QR CODE DE BIPAGEM E ASSINATURA DA EQUIPE ──
  if (finalY < 242) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, finalY, 196, finalY);

    // QR Code
    try {
      doc.addImage(qrUrl, 'PNG', 14, finalY + 4, 32, 32);
    } catch (e) {
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, finalY + 4, 32, 32);
      doc.setFontSize(7);
      doc.text('QR CODE', 22, finalY + 20);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.text(`BIPAGEM DE CHECK-IN / CHECK-OUT (GALPÃO):`, 50, finalY + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Escaneie este QR Code no aplicativo Celebre para abrir`, 50, finalY + 18);
    doc.text(`imediatamente a conferência e baixa de saída ou retorno.`, 50, finalY + 23);

    // Caixas de Assinatura do Galpão
    doc.setDrawColor(148, 163, 184);
    doc.line(125, finalY + 28, 190, finalY + 28);
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Visto / Conferido por (Galpão)`, 138, finalY + 32);
  }

  // Rodapé da Etiqueta
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Etiqueta gerada via Celebre Festas SaaS em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 105, 282, { align: 'center' });

  // Salvar PDF ou Retornar Preview
  const nomeArquivo = `Etiqueta_Caixote_Pedido_${locacao.numeroPedido || 'S_N'}_Vol_${volumeNum}.pdf`;
  const titulo = `Etiqueta de Caixote (${numPedido} - ${clienteNome})`;

  if (acao === 'download') {
    doc.save(nomeArquivo);
    return { doc, nomeArquivo, titulo };
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { doc, blob, url, nomeArquivo, titulo };
};
