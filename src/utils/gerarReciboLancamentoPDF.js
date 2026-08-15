import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Gerador de Recibo Oficial em PDF com o Celebre Luxury Design System
 */
export const gerarReciboLancamentoPDF = (lancamento, dadosEmpresa = {}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const dourado = [197, 160, 89]; // #c5a059
  const escuro = [15, 23, 42]; // #0f172a
  const verde = [16, 185, 129]; // #10b981
  const vermelho = [239, 68, 68]; // #ef4444

  const isEntrada = lancamento.tipo === 'entrada';
  const corDestaque = isEntrada ? verde : vermelho;

  // 1. Moldura e Fundo de Luxo
  doc.setLineWidth(0.5);
  doc.setDrawColor(...dourado);
  doc.rect(8, 8, 194, 281);

  // 2. Banner de Cabeçalho Superior
  doc.setFillColor(...escuro);
  doc.rect(10, 10, 190, 32, 'F');

  // Marca D'água / Título da Empresa
  doc.setTextColor(...dourado);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(dadosEmpresa.nomeEmpresa || 'CELEBRE FESTAS & DECORAÇÕES', 16, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(dadosEmpresa.subtitulo || 'Sistema Integrado de Gestão de Acervo e Eventos', 16, 29);

  // 3. Título do Recibo
  doc.setFillColor(...corDestaque);
  doc.rect(10, 44, 190, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    isEntrada ? 'RECIBO DE RECEBIMENTO (ENTRADA)' : 'RECIBO DE PAGAMENTO (DESPESA)',
    16,
    52
  );

  const valorTotal = Number(lancamento.valorTotal || lancamento.valor || 0);
  const valorFormatted = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // 4. Box de Destaque de Valor
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, 62, 186, 24, 3, 3, 'FD');

  doc.setTextColor(...escuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('VALOR DO COMPROVANTE:', 18, 72);

  doc.setTextColor(...corDestaque);
  doc.setFontSize(18);
  doc.text(valorFormatted, 18, 81);

  // 5. Tabela de Detalhes do Lançamento (jspdf-autotable)
  const dataBr = lancamento.data ? lancamento.data.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');

  const tableRows = [
    ['Descrição / Título', lancamento.descricao || '-'],
    ['Tipo de Operação', isEntrada ? 'Receita / Entrada' : 'Despesa / Saída'],
    ['Categoria', lancamento.categoria || '-'],
    ['Centro de Custo / Tag', lancamento.centroCusto || '-'],
    ['Forma de Pagamento', lancamento.formaPagto || '-'],
    ['Situação do Pagamento', lancamento.status === 'pago' ? (isEntrada ? 'RECEBIDO' : 'PAGO') : 'PENDENTE'],
    ['Data do Registro', dataBr],
    ['Pedido / Locação Atrelada', lancamento.locacaoNumero ? `#${lancamento.locacaoNumero}` : 'Nenhum'],
    ['Cliente / Fornecedor', lancamento.clienteNome || lancamento.fornecedorNome || 'Não especificado'],
    ['Observações Internas', lancamento.observacoes || 'Sem observações adicionais.']
  ];

  autoTable(doc, {
    startY: 92,
    margin: { left: 12, right: 12 },
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 4,
      textColor: escuro
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 55 },
      1: { cellWidth: 131 }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 25;

  // 6. Linha de Assinatura
  doc.setDrawColor(...escuro);
  doc.setLineWidth(0.3);
  doc.line(40, finalY, 170, finalY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...escuro);
  doc.text('ASSINATURA DO RESPONSÁVEL', 105, finalY + 6, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(dadosEmpresa.nomeEmpresa || 'Celebre Festas & Decorações', 105, finalY + 11, { align: 'center' });

  // 7. Rodapé do Documento
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} — Celebre System SaaS`, 105, 283, { align: 'center' });

  // Salva o PDF
  const nomeArquivo = `Recibo_${isEntrada ? 'Receita' : 'Despesa'}_${Date.now()}.pdf`;
  doc.save(nomeArquivo);
};
