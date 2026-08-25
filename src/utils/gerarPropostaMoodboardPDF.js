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
 * @param {Array} [params.paletaEvento] - Lista de cores hex da paleta do evento
 * @param {string} [params.observacoes] - Observações / instruções do projeto
 * @param {string} [params.status] - Status do projeto (rascunho, aprovado, etc.)
 * @param {number} [params.versao] - Versão do projeto (1, 2, 3...)
 * @param {boolean} [params.exibirValores] - Se true exibe os valores unitários e total. Se false (padrão cliente) oculta todos os preços.
 */
export const gerarPropostaMoodboardPDF = async ({
  imagemMoodboard,
  nomeProjeto = 'Projeto de Decoração',
  itens = [],
  valorTotal = 0,
  empresa = {},
  cliente = null,
  paletaEvento = [],
  observacoes = '',
  status = 'rascunho',
  versao = 1,
  exibirValores = false
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

    const statusLabels = {
      rascunho: 'RASCUNHO',
      em_analise: 'EM ANÁLISE',
      aprovado: 'APROVADO',
      em_producao: 'EM PRODUÇÃO',
      concluido: 'CONCLUÍDO'
    };
    const statusText = statusLabels[status] || 'PROPOSTA';

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
      doc.text('CELEBRE', 12, 16);
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

    // Tag lateral "PROPOSTA VISUAL / STATUS"
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(145, 6, 53, 14, 2, 2, 'F');
    doc.setTextColor(...goldColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${statusText} ${versao > 1 ? `(v${versao})` : ''}`, 171.5, 12, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('pt-BR'), 171.5, 17, { align: 'center' });

    let currentY = 33;

    // 2. DADOS DO PROJETO & CLIENTE & PALETA
    doc.setFillColor(...lightGray);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(12, currentY, 186, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);
    doc.text('Projeto Decorativo:', 16, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.text(`${nomeProjeto} ${versao > 1 ? `(Versão ${versao})` : ''}`, 48, currentY + 6);

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
    doc.text(`Total Peças: ${itens.reduce((acc, i) => acc + (i.quantidade || 1), 0)} un.`, 145, currentY + 7);

    // Renderizar Círculos da Paleta de Cores do Evento (se houver)
    if (Array.isArray(paletaEvento) && paletaEvento.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...darkGray);
      doc.text('Paleta:', 130, currentY + 14);

      let paletaX = 143;
      paletaEvento.slice(0, 5).forEach(corHex => {
        try {
          const hexClean = corHex.replace('#', '');
          const r = parseInt(hexClean.substring(0, 2), 16) || 200;
          const g = parseInt(hexClean.substring(2, 4), 16) || 200;
          const b = parseInt(hexClean.substring(4, 6), 16) || 200;
          doc.setFillColor(r, g, b);
          doc.setDrawColor(203, 213, 225);
          doc.circle(paletaX, currentY + 13, 3, 'FD');
          paletaX += 8;
        } catch {}
      });
    }

    currentY += 23;

    // 3. IMAGEM DO MOODBOARD (RENDER DO CENÁRIO)
    if (imagemMoodboard) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('SIMULAÇÃO VISUAL DO CENÁRIO', 12, currentY + 1);

      currentY += 4;

      // Moldura da imagem
      const imgWidth = 186;
      const imgHeight = 92;
      
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, currentY, imgWidth, imgHeight, 2, 2, 'FD');

      try {
        doc.addImage(imagemMoodboard, 'PNG', 13, currentY + 1, imgWidth - 2, imgHeight - 2);
      } catch (errImg) {
        console.warn('Erro ao inserir imagem no PDF:', errImg);
      }

      currentY += imgHeight + 5;
    }

    // 4. OBSERVAÇÕES / INSTRUÇÕES (se houver)
    if (observacoes && observacoes.trim()) {
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(12, currentY, 186, 12, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      doc.text('Observações do Projeto:', 16, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const obsCortada = observacoes.length > 130 ? observacoes.substring(0, 127) + '...' : observacoes;
      doc.text(obsCortada, 16, currentY + 9.5);

      currentY += 15;
    }

    // 5. TABELA DE PEÇAS UTILIZADAS NO PROJETO
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryColor);
    doc.text('COMPOSIÇÃO DAS PEÇAS & CENOGRAFIA', 12, currentY + 1);

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

    // Se exibirValores for true: mostra Unitário e Subtotal. Se false: mostra apenas Código, Descrição, Categoria, Qtd
    let cabecalhoTabela = [];
    let linhasTabela = [];
    let colunasEstilo = {};

    if (exibirValores) {
      cabecalhoTabela = [['Código', 'Descrição da Peça', 'Categoria', 'Qtd', 'Unitário', 'Subtotal']];
      linhasTabela = Object.values(mapaItens).map(it => [
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
      colunasEstilo = {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      };
    } else {
      cabecalhoTabela = [['Código', 'Descrição da Peça & Cenografia', 'Categoria', 'Quantidade']];
      linhasTabela = Object.values(mapaItens).map(it => [
        it.codigo,
        it.nome,
        it.categoria,
        `${it.quantidade} un.`
      ]);
      if (linhasTabela.length === 0) {
        linhasTabela.push(['—', 'Decoração personalizada conforme layout visual', 'Cenografia', '1 un.']);
      }
      colunasEstilo = {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 45 },
        3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
      };
    }

    autoTable(doc, {
      startY: currentY,
      head: cabecalhoTabela,
      body: linhasTabela,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: colunasEstilo,
      styles: {
        fontSize: 7.5,
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

    // 6. CAIXA DE TOTAIS (SOMENTE SE exibirValores FOR TRUE) & RODAPÉ
    const totalBoxY = finalY > 260 ? 260 : finalY;
    
    if (exibirValores) {
      doc.setFillColor(...primaryColor);
      doc.roundedRect(120, totalBoxY, 78, 14, 2, 2, 'F');
      doc.setTextColor(...goldColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('VALOR TOTAL ESTIMADO:', 125, totalBoxY + 6);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 193, totalBoxY + 10, { align: 'right' });
    }

    // Observações / Rodapé
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('* Proposta visual sujeita a confirmação de disponibilidade nas datas do evento.', 12, totalBoxY + (exibirValores ? 8 : 4));
    doc.text('Gerado pelo Decorador Virtual Celebre — Software para Locação & Festas', 12, 290);
    doc.text(`Página 1/1`, 198, 290, { align: 'right' });

    // Salva o PDF
    const tipoDoc = exibirValores ? 'Orcamento' : 'Proposta_Visual';
    const nomeArquivo = `${tipoDoc}_${nomeProjeto.replace(/[/\\?%*:|"<>]/g, '').trim() || 'Moodboard'}.pdf`;
    doc.save(nomeArquivo);

  } catch (error) {
    console.error('Erro ao gerar PDF do Moodboard:', error);
    alert('Erro ao gerar PDF da proposta. Tente novamente.');
  }
};
