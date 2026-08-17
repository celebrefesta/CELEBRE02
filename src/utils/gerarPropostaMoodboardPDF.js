import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCelebrePadrao from '../assets/LOGO_CELEBRE.png';

/**
 * 📄 GERADOR DE PROPOSTA VISUAL / ORÇAMENTO DECORATIVO EM PDF
 * @param {Object} params
 * @param {string} params.imagemMoodboard - Base64 da imagem renderizada do projeto
 * @param {string} params.nomeProjeto - Nome do projeto
 * @param {Array} params.itens - Lista de itens do acervo presentes no cenário
 * @param {number} params.valorTotal - Valor total dos itens calculados
 * @param {Object} params.empresa - Configurações da empresa (nome, cnpj, contato, etc.)
 * @param {Object} [params.cliente] - Dados do cliente (se houver)
 */
export const gerarPropostaMoodboardPDF = async ({
  imagemMoodboard,
  nomeProjeto = 'Projeto de Decoração',
  itens = [],
  valorTotal = 0,
  empresa = {},
  cliente = null
}) => {
  try {
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

    const nomeEmpresa = empresa?.nomeEmpresa || empresa?.nomeFantasia || empresa?.razaoSocial || 'CELEBRE FESTAS & EVENTOS';
    const cnpjEmpresa = empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : '';
    const telEmpresa = empresa?.telefone || empresa?.celular || empresa?.whatsapp || '';
    const emailEmpresa = empresa?.emailEmpresa || empresa?.email || '';

    doc.setProperties({
      title: `PROPOSTA VISUAL - ${nomeProjeto.toUpperCase()}`,
      subject: 'Proposta de Decoração & Locação de Peças',
      author: nomeEmpresa,
      creator: 'Celebre Decorador Virtual'
    });

    // 1. BANNER DO CABEÇALHO
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 26, 'F');

    doc.setFillColor(...goldColor);
    doc.rect(0, 26, 210, 2, 'F');

    // Logo da Empresa
    const logoImg = empresa?.logoUrl || logoCelebrePadrao;
    try {
      doc.addImage(logoImg, 'PNG', 12, 4, 18, 18);
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('👑 CELEBRE', 12, 16);
    }

    // Título da Empresa e Documento
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(nomeEmpresa.toUpperCase(), 36, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    const contatos = [cnpjEmpresa, telEmpresa ? `Tel: ${telEmpresa}` : '', emailEmpresa].filter(Boolean).join(' | ');
    doc.text(contatos || 'Sistema Integrado de Gestão & Decoração', 36, 18);

    // Tag lateral "PROPOSTA DECORATIVA"
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(145, 6, 53, 14, 2, 2, 'F');
    doc.setTextColor(...goldColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PROPOSTA VISUAL', 171.5, 12, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('pt-BR'), 171.5, 17, { align: 'center' });

    let currentY = 33;

    // 2. DADOS DO PROJETO & CLIENTE
    doc.setFillColor(...lightGray);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(12, currentY, 186, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryColor);
    doc.text('Projeto Decorativo:', 16, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.text(nomeProjeto, 50, currentY + 6);

    if (cliente) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('Cliente:', 16, currentY + 12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.text(cliente.nome || cliente.nomeFantasia || 'Cliente', 31, currentY + 12);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('Emissão:', 16, currentY + 12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.text(new Date().toLocaleString('pt-BR'), 33, currentY + 12);
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...goldColor);
    doc.text(`Total Peças: ${itens.reduce((acc, i) => acc + (i.quantidade || 1), 0)} un.`, 150, currentY + 9);

    currentY += 21;

    // 3. IMAGEM DO MOODBOARD (RENDER DO CENÁRIO)
    if (imagemMoodboard) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('🎨 SIMULAÇÃO VISUAL DO CENÁRIO', 12, currentY + 1);

      currentY += 4;

      // Moldura da imagem
      const imgWidth = 186;
      const imgHeight = 98; // Proporção equilibrada para caber a tabela abaixo
      
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, currentY, imgWidth, imgHeight, 2, 2, 'FD');

      try {
        doc.addImage(imagemMoodboard, 'PNG', 13, currentY + 1, imgWidth - 2, imgHeight - 2);
      } catch (errImg) {
        console.warn('Erro ao inserir imagem no PDF:', errImg);
      }

      currentY += imgHeight + 6;
    }

    // 4. TABELA DE PEÇAS UTILIZADAS NO PROJETO
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('📦 PEÇAS & ITENS DO ACERVO NESTA DECORAÇÃO', 12, currentY + 1);

    currentY += 3;

    // Agrupa itens repetidos caso haja múltiplos no canvas
    const mapaItens = {};
    itens.forEach(item => {
      const chave = item.id || item.nome;
      if (!mapaItens[chave]) {
        mapaItens[chave] = {
          codigo: item.codigo || '—',
          nome: item.nome || 'Peça Decorativa',
          categoria: item.categoria || 'Acervo Geral',
          valorUnit: Number(item.valor || item.preco || item.valorLocacao || item.precoUnitario || 0),
          quantidade: 0
        };
      }
      mapaItens[chave].quantidade += (item.quantidade || 1);
    });

    const linhasTabela = Object.values(mapaItens).map(it => [
      it.codigo,
      it.nome,
      it.categoria,
      `${it.quantidade} un.`,
      `R$ ${it.valorUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${(it.valorUnit * it.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    if (linhasTabela.length === 0) {
      linhasTabela.push(['—', 'Decoração personalizada conforme layout visual', 'Cenografia', '1', `R$ ${valorTotal.toFixed(2)}`, `R$ ${valorTotal.toFixed(2)}`]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [['Código', 'Descrição da Peça', 'Categoria', 'Qtd', 'Unitário', 'Subtotal']],
      body: linhasTabela,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: darkGray,
        lineColor: borderColor,
        lineWidth: 0.2
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 12, right: 12 }
    });

    const finalY = doc.lastAutoTable.finalY + 4;

    // 5. CAIXA DE TOTAIS & RODAPÉ
    const totalBoxY = finalY > 260 ? 260 : finalY;
    
    // Caixa de Total
    doc.setFillColor(...primaryColor);
    doc.roundedRect(120, totalBoxY, 78, 14, 2, 2, 'F');
    doc.setTextColor(...goldColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('VALOR TOTAL ESTIMADO:', 125, totalBoxY + 6);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 193, totalBoxY + 10, { align: 'right' });

    // Observações / Rodapé
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('* Orçamento visual sujeito a confirmação de disponibilidade nas datas do evento.', 12, totalBoxY + 8);
    doc.text('Gerado pelo Decorador Virtual Celebre — Software para Locação & Festas', 12, 290);
    doc.text(`Página 1/1`, 198, 290, { align: 'right' });

    // Salva o PDF
    const nomeArquivo = `Proposta_Visual_${nomeProjeto.replace(/[/\\?%*:|"<>]/g, '').trim() || 'Moodboard'}.pdf`;
    doc.save(nomeArquivo);

  } catch (error) {
    console.error('Erro ao gerar PDF do Moodboard:', error);
    alert('Erro ao gerar PDF da proposta. Tente novamente.');
  }
};
