import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import logoCelebreMarcaDagua from '../assets/LOGO_CELEBRE.png';

/**
 * 📄 GERADOR AVANÇADO DE MAPA DE SEPARAÇÃO & ROMANEIO DE GALPÃO (PDF)
 * Formato Paisagem (Landscape A4) — Padrão Celebre Luxury Enterprise
 * 
 * Suporta dois modos:
 * 1. 'acervo': Visão Geral do Acervo (por Peça & Localização no Galpão)
 * 2. 'romaneio': Romaneio de Expedição (por Festa / Pedido com QR Code de Bipagem)
 */
export const gerarMapaSeparacaoPDF = async (
  mesNome = 'Setembro',
  ano = 2026,
  estoqueFiltrado = [],
  mapaOcupacao = { porItem: {}, porDiaGeral: {} },
  kpisMes = { totalFestas: 0, totalPecasAlugadas: 0, taxaOcupacao: 0 },
  dadosEmpresa = {},
  opcoesFiltro = {}
) => {
  const {
    tituloPeriodo = 'Mês Inteiro',
    dataInicio = null, // ex: '2026-09-11'
    dataFim = null,    // ex: '2026-09-14'
    apenasComReserva = false,
    incluirCheckbox = true,
    modoRelatorio = 'acervo', // 'acervo' | 'romaneio'
    locacoes = []
  } = opcoesFiltro;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const nomeEmpresa = dadosEmpresa?.nomeEmpresa || dadosEmpresa?.nomeFantasia || dadosEmpresa?.nome || 'CELEBRE FESTAS & DECORAÇÕES';
  const logoEmpresa = dadosEmpresa?.logotipo || dadosEmpresa?.logoUrl || dadosEmpresa?.logo || null;
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // ── PALETA DE CORES CELEBRE ──
  const corDourado = [197, 160, 89];
  const corDouradoClaro = [253, 230, 138];
  const corAzulEscuro = [15, 23, 42];
  const corAzulMedio = [30, 41, 59];
  const corZebra = [248, 250, 252];
  const corCinzaTexto = [100, 116, 139];
  const corCinzaBorda = [226, 232, 240];
  const corVerdeSucesso = [16, 185, 129];
  const corVerdeFundo = [236, 253, 245];

  // ── HELPER DE FORMATAÇÃO DE DATA ──
  const formatarDataBR = (dStr) => {
    if (!dStr) return '';
    const limpo = String(dStr).split('T')[0].trim();
    if (limpo.includes('-')) {
      const p = limpo.split('-');
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return limpo;
  };

  // ── AUXILIAR DE MARCA D'ÁGUA E CABEÇALHO/RODAPÉ ──
  const adicionarCabecalhoRodape = (paginaAtual, totalPaginas, tituloDoc) => {
    try {
      doc.saveGraphicsState();
      if (typeof doc.setGState === 'function') {
        doc.setGState(new doc.GState({ opacity: 0.035 }));
      }
      doc.addImage(logoCelebreMarcaDagua, 'PNG', 98, 55, 100, 100);
      doc.restoreGraphicsState();
    } catch (e) {
      // Ignora erro caso a imagem local não seja renderizável no contexto
    }

    // Top Bar Dourado
    doc.setFillColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.rect(0, 0, 297, 3, 'F');

    // Cabeçalho Principal Azul Escuro
    doc.setFillColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.rect(0, 3, 297, 26, 'F');

    // Título e Subtítulo
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.text(tituloDoc, 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(corDouradoClaro[0], corDouradoClaro[1], corDouradoClaro[2]);
    doc.text(`Período: ${tituloPeriodo.toUpperCase()} (${mesNome.toUpperCase()} / ${ano}) — ${nomeEmpresa}`, 14, 21);

    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Emitido em: ${dataHoje} às ${horaHoje}`, 297 - 14, 21, { align: 'right' });

    // Logo no canto superior se existir
    if (logoEmpresa) {
      try {
        doc.addImage(logoEmpresa, 'PNG', 297 - 45, 6, 30, 16);
      } catch (e) {}
    }

    // Rodapé
    doc.setDrawColor(corCinzaBorda[0], corCinzaBorda[1], corCinzaBorda[2]);
    doc.setLineWidth(0.3);
    doc.line(14, 200, 297 - 14, 200);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(corCinzaTexto[0], corCinzaTexto[1], corCinzaTexto[2]);
    doc.text(`${nomeEmpresa} • Gestão de Acervo, Logística & Separação de Galpão`, 14, 205);
    doc.text(`Página ${paginaAtual} de ${totalPaginas}`, 297 - 14, 205, { align: 'right' });
  };

  // ── HELPER PARA DESENHAR PROTOCOLO DE CONFERÊNCIA E ASSINATURA ──
  const desenharProtocoloAssinaturas = (startY) => {
    let y = startY;
    if (y > 155) {
      doc.addPage();
      y = 35;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(corDourado[0], corDourado[1], corDourado[2]);
    doc.setLineWidth(0.6);
    doc.roundedRect(14, y, 269, 36, 3, 3, 'FD');

    // Título do Bloco
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
    doc.text('PROTOCOLO OFICIAL DE SEPARAÇÃO, CONFERÊNCIA & EXPEDIÇÃO DE GALPÃO', 20, y + 7);

    // 3 Colunas de Assinatura
    const colW = 82;
    const colY = y + 14;

    // Coluna 1: Separador
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(corCinzaTexto[0], corCinzaTexto[1], corCinzaTexto[2]);
    doc.text('1. SEPARADO POR (GALPÃO):', 20, colY);
    doc.setFont('helvetica', 'normal');
    doc.text('Nome: _________________________________', 20, colY + 6);
    doc.text('Data/Hora: ____/____/____ às ____:____', 20, colY + 11);
    doc.text('Assinatura: ____________________________', 20, colY + 16);

    // Coluna 2: Conferente
    const col2X = 20 + colW + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('2. CONFERIDO POR (SUPERVISOR):', col2X, colY);
    doc.setFont('helvetica', 'normal');
    doc.text('Nome: _________________________________', col2X, colY + 6);
    doc.text('Data/Hora: ____/____/____ às ____:____', col2X, colY + 11);
    doc.text('Assinatura: ____________________________', col2X, colY + 16);

    // Coluna 3: Retirada / Expedição
    const col3X = col2X + colW + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('3. RETIRADO POR (CLIENTE / MOTORISTA):', col3X, colY);
    doc.setFont('helvetica', 'normal');
    doc.text('Nome: _________________________________', col3X, colY + 6);
    doc.text('Doc / RG: ______________________________', col3X, colY + 11);
    doc.text('Assinatura: ____________________________', col3X, colY + 16);

    // Disclaimer
    doc.setFontSize(6.5);
    doc.setTextColor(corCinzaTexto[0], corCinzaTexto[1], corCinzaTexto[2]);
    doc.text(
      '* As assinaturas acima atestam que todas as peças foram inspecionadas fisicamente quanto a quantidade, integridade e limpeza na expedição.',
      20,
      y + 33
    );
  };

  // ===========================================================================
  // MODO 1: MAPA GERAL DO ACERVO (VISÃO POR PEÇA & LOCALIZAÇÃO)
  // ===========================================================================
  if (modoRelatorio === 'acervo') {
    // ── CARD DE KPIS DO MÊS / PERÍODO ──
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 33, 269, 13, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);

    doc.text(`TOTAL DE FESTAS: `, 20, 41.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${kpisMes.totalFestas || 0} eventos`, 55, 41.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`RESERVAS NO ACERVO: `, 102, 41.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${kpisMes.totalPecasAlugadas || 0} unidades alugadas`, 142, 41.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`TAXA DE OCUPAÇÃO: `, 204, 41.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${kpisMes.taxaOcupacao || 0}% dos dias ocupados`, 240, 41.5);

    // ── CABEÇALHO DA TABELA ──
    const tableHead = incluirCheckbox
      ? [['[ ] OK', 'CÓDIGO', 'PEÇA / ITEM & LOCALIZAÇÃO NO GALPÃO', 'CATEGORIA', 'QTD TOTAL', 'CRONOGRAMA DE SAÍDA & RESERVAS']]
      : [['CÓDIGO', 'PEÇA / ITEM & LOCALIZAÇÃO NO GALPÃO', 'CATEGORIA', 'QTD TOTAL', 'CRONOGRAMA DE SAÍDA & RESERVAS']];

    const tableBody = [];

    estoqueFiltrado.forEach((item) => {
      const cod = item.codigo || item.sku || `ID-${String(item.id).substring(0, 5)}`;
      const nome = item.nome || 'Sem Nome';
      const cat = item.categoria || 'Geral';
      const qtdTotal = Number(item.quantidade || 1);

      // Localização física no galpão
      const localGalpao = item.galpao || item.localizacao || 'Galpão Principal';
      const localPrat = item.prateleira ? `Prat. ${item.prateleira}` : '';
      const localSetor = item.setor ? `Setor: ${item.setor}` : '';
      const localCompleto = [localGalpao, localPrat, localSetor].filter(Boolean).join(' | ');

      const nomeComLocal = localCompleto ? `${nome}\n[Local: ${localCompleto}]` : nome;

      // Agenda de reservas
      const ocupacaoItem = mapaOcupacao.porItem[item.id] || mapaOcupacao.porItem[item.nome] || {};
      let datasComReserva = Object.keys(ocupacaoItem).sort();

      if (dataInicio && dataFim) {
        datasComReserva = datasComReserva.filter(d => d >= dataInicio && d <= dataFim);
      } else if (dataInicio) {
        datasComReserva = datasComReserva.filter(d => d >= dataInicio);
      }

      let detalhamentoAgenda = 'Livre no período';

      if (datasComReserva.length > 0) {
        const linhasDet = [];
        datasComReserva.forEach(dataIso => {
          const info = ocupacaoItem[dataIso];
          if (info && info.alugados > 0) {
            const pData = dataIso.split('-');
            const dataBr = `${pData[2]}/${pData[1]}`;
            
            const clientes = (info.reservas || []).map(r => {
              const numPed = r.numPedido || '#S/N';
              const modTag = (r.tipoServico || '').toLowerCase().includes('pegue') 
                ? '[Pegue & Monte]' 
                : (r.tipoServico || '').toLowerCase().includes('decora') 
                  ? '[Decoração]' 
                  : '';
              return `${r.clienteNome || 'Cliente'} (${numPed} - ${r.qtd} un.) ${modTag}`;
            }).join(' | ');

            linhasDet.push(`- ${dataBr}: ${info.alugados} un. alugada(s) -> ${clientes}`);
          }
        });

        if (linhasDet.length > 0) {
          detalhamentoAgenda = linhasDet.join('\n');
        }
      }

      if (apenasComReserva && datasComReserva.length === 0) {
        return;
      }

      const linha = incluirCheckbox
        ? ['[   ]', cod, nomeComLocal, cat, `${qtdTotal} un.`, detalhamentoAgenda]
        : [cod, nomeComLocal, cat, `${qtdTotal} un.`, detalhamentoAgenda];

      tableBody.push(linha);
    });

    // ── TRATAMENTO PROFISSIONAL DE ESTADO VAZIO ──
    if (tableBody.length === 0) {
      const msgVazia = `NENHUMA RESERVA AGENDADA NESTE PERÍODO\nTodo o acervo do galpão encontra-se 100% livre e disponível para locações no período selecionado.`;
      const linhaVazia = incluirCheckbox
        ? ['[ OK ]', '—', msgVazia, '—', '—', 'Nenhum bloqueio ou conflito no acervo']
        : ['—', msgVazia, '—', '—', 'Nenhum bloqueio ou conflito no acervo'];
      tableBody.push(linhaVazia);
    }

    const columnStyles = incluirCheckbox
      ? {
          0: { cellWidth: 16, halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
          1: { cellWidth: 22, fontStyle: 'bold', textColor: corAzulEscuro },
          2: { cellWidth: 68, fontStyle: 'bold' },
          3: { cellWidth: 28 },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 117, textColor: corAzulMedio }
        }
      : {
          0: { cellWidth: 24, fontStyle: 'bold', textColor: corAzulEscuro },
          1: { cellWidth: 72, fontStyle: 'bold' },
          2: { cellWidth: 32 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 121, textColor: corAzulMedio }
        };

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: 50,
      margin: { left: 14, right: 14, bottom: 20 },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: corAzulEscuro,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left'
      },
      columnStyles: columnStyles,
      alternateRowStyles: {
        fillColor: corZebra
      },
      didDrawPage: (data) => {
        const totalPaginas = doc.internal.getNumberOfPages();
        adicionarCabecalhoRodape(data.pageNumber, totalPaginas, 'MAPA DE SEPARAÇÃO & DISPONIBILIDADE DO ACERVO');
      }
    });

    // Desenha protocolo de conferência no final da última página
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 60;
    desenharProtocoloAssinaturas(finalY);
  }

  // ===========================================================================
  // MODO 2: ROMANEIO DE EXPEDIÇÃO & CARGA (VISÃO POR FESTA / PEDIDO COM QR CODE)
  // ===========================================================================
  else if (modoRelatorio === 'romaneio') {
    // Filtrar pedidos ativos no período
    const locacoesAtivas = locacoes.filter(loc => {
      const st = (loc.status || '').toLowerCase();
      const isInativo = st.includes('cancel') || st.includes('perdid') || st.includes('arquiv');
      if (isInativo) return false;

      const ret = (loc.dataRetirada || '').split('T')[0];
      if (!ret) return false;

      if (dataInicio && dataFim) {
        return ret >= dataInicio && ret <= dataFim;
      } else if (dataInicio) {
        return ret >= dataInicio;
      } else {
        // Todo o mês selecionado
        const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const mIdx = mesesNomes.indexOf(mesNome);
        const mStr = String(mIdx >= 0 ? mIdx + 1 : new Date().getMonth() + 1).padStart(2, '0');
        const anoMesAlvo = `${ano}-${mStr}`;
        return ret.startsWith(anoMesAlvo);
      }
    });

    // Ordenar por data e horário de retirada
    locacoesAtivas.sort((a, b) => {
      const dA = `${a.dataRetirada || ''} ${a.horaRetirada || '12:00'}`;
      const dB = `${b.dataRetirada || ''} ${b.horaRetirada || '12:00'}`;
      return dA.localeCompare(dB);
    });

    let currentY = 34;

    // Se não houver pedidos no período
    if (locacoesAtivas.length === 0) {
      doc.setFillColor(corVerdeFundo[0], corVerdeFundo[1], corVerdeFundo[2]);
      doc.setDrawColor(corVerdeSucesso[0], corVerdeSucesso[1], corVerdeSucesso[2]);
      doc.setLineWidth(0.6);
      doc.roundedRect(14, 40, 269, 30, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(4, 120, 87);
      doc.text('NENHUMA EXPEDIÇÃO OU SAÍDA DE LOCAÇÃO AGENDADA PARA ESTE PERÍODO', 20, 52);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(corAzulMedio[0], corAzulMedio[1], corAzulMedio[2]);
      doc.text('Não há festas com entrega, retirada ou montagem previstas para as datas selecionadas.', 20, 60);

      adicionarCabecalhoRodape(1, 1, 'ROMANEIO DE CARGA & EXPEDIÇÃO DE GALPÃO');
    } else {
      // Loop sobre cada pedido gerando bloco visual e QR Code
      for (let i = 0; i < locacoesAtivas.length; i++) {
        const loc = locacoesAtivas[i];
        const numPed = loc.numeroPedido ? `#${loc.numeroPedido}` : `#${loc.id.substring(0, 6).toUpperCase()}`;
        const clienteNome = loc.clienteNome || loc.cliente?.nome || 'Cliente não identificado';
        const telefone = loc.clienteTelefone || loc.telefone || loc.cliente?.telefone || '—';
        const dataRet = formatarDataBR(loc.dataRetirada);
        const horaRet = loc.horaRetirada || '14:00';
        const dataDev = formatarDataBR(loc.dataDevolucao);
        const horaDev = loc.horaDevolucao || '18:00';

        const tipoServico = (loc.tipoServico || 'LOCAÇÃO').toUpperCase();
        const isPegueMonte = tipoServico.includes('PEGUE');
        const isDecoracao = tipoServico.includes('DECORA');
        const modalidadeBadge = isPegueMonte 
          ? '[BALCÃO: PEGUE & MONTE]' 
          : isDecoracao 
            ? '[CARREGAMENTO: DECORAÇÃO COMPLETA]' 
            : '[TRANSPORTE / LOGÍSTICA]';

        const itensDoPedido = loc.itens || loc.carrinho || [];

        // Verifica se precisa de nova página antes do bloco do pedido
        const alturaEstimadaBloco = 30 + (itensDoPedido.length * 8) + 16;
        if (currentY + alturaEstimadaBloco > 195 && currentY > 36) {
          doc.addPage();
          currentY = 34;
        }

        // ── GERAR QR CODE DO PEDIDO PARA LEITURA NO CELULAR / COLETOR ──
        let qrDataUrl = null;
        try {
          const urlBase = typeof window !== 'undefined' ? window.location.origin : 'https://app.celebre.com';
          const qrLink = `${urlBase}/locacoes?pedido=${loc.numeroPedido || loc.id}`;
          qrDataUrl = await QRCode.toDataURL(qrLink, {
            margin: 1,
            width: 80,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
        } catch (err) {
          console.error("Erro gerando QR Code:", err);
        }

        // Card do Cabeçalho do Pedido
        doc.setFillColor(corZebra[0], corZebra[1], corZebra[2]);
        doc.setDrawColor(corCinzaBorda[0], corCinzaBorda[1], corCinzaBorda[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(14, currentY, 269, 22, 2, 2, 'FD');

        // Faixa indicativa da modalidade (Lateral esquerda)
        doc.setFillColor(isPegueMonte ? corDourado[0] : 16, isPegueMonte ? corDourado[1] : 185, isPegueMonte ? corDourado[2] : 129);
        doc.roundedRect(14, currentY, 4, 22, 1, 1, 'F');

        // Dados do Pedido
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
        doc.text(`PEDIDO ${numPed} — ${clienteNome.toUpperCase()}`, 22, currentY + 6.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(isPegueMonte ? 180 : 4, isPegueMonte ? 83 : 120, isPegueMonte ? 9 : 87);
        doc.text(modalidadeBadge, 22, currentY + 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(corAzulMedio[0], corAzulMedio[1], corAzulMedio[2]);
        doc.text(`Telefone: ${telefone} | Endereço/Evento: ${loc.enderecoEvento || loc.cidade || 'Retirada no Galpão'}`, 22, currentY + 18);

        // Datas e Horários
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(corAzulEscuro[0], corAzulEscuro[1], corAzulEscuro[2]);
        doc.text(`SAÍDA: ${dataRet} às ${horaRet}`, 175, currentY + 8);
        doc.text(`DEVOLUÇÃO: ${dataDev} às ${horaDev}`, 175, currentY + 15);

        // QR Code no canto direito do pedido
        if (qrDataUrl) {
          try {
            doc.addImage(qrDataUrl, 'PNG', 258, currentY + 1.5, 19, 19);
            doc.setFontSize(5.5);
            doc.setTextColor(corCinzaTexto[0], corCinzaTexto[1], corCinzaTexto[2]);
            doc.text('BIPAR PEDIDO', 267.5, currentY + 21, { align: 'center' });
          } catch (e) {}
        }

        // ── TABELA DE ITENS DESTE PEDIDO ──
        const pedidoTableHead = [['[ ] OK', 'CÓDIGO', 'PEÇA / ITEM A SEPARAR', 'LOCALIZAÇÃO NO GALPÃO', 'QTD SOLICITADA', 'CONFERÊNCIA']];
        const pedidoTableBody = [];

        itensDoPedido.forEach(it => {
          const pCod = it.codigo || it.sku || `ID-${String(it.id).substring(0, 5)}`;
          const pNome = it.nome || it.titulo || 'Peça';
          const pQtd = it.qtd || it.quantidade || 1;

          // Busca localização da peça no estoque oficial
          const pecaOficial = estoqueFiltrado.find(e => String(e.id) === String(it.id) || e.nome === it.nome);
          const pLocal = pecaOficial
            ? [pecaOficial.galpao || pecaOficial.localizacao || 'Principal', pecaOficial.prateleira ? `Prat. ${pecaOficial.prateleira}` : '', pecaOficial.setor ? `Setor: ${pecaOficial.setor}` : ''].filter(Boolean).join(' | ')
            : 'Galpão Principal';

          pedidoTableBody.push([
            '[   ]',
            pCod,
            pNome,
            `Local: ${pLocal}`,
            `${pQtd} un.`,
            '[   ] OK'
          ]);
        });

        autoTable(doc, {
          head: pedidoTableHead,
          body: pedidoTableBody,
          startY: currentY + 23,
          margin: { left: 14, right: 14, bottom: 20 },
          styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 2,
            valign: 'middle'
          },
          headStyles: {
            fillColor: corAzulMedio,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5
          },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
            1: { cellWidth: 22, fontStyle: 'bold', textColor: corAzulEscuro },
            2: { cellWidth: 110, fontStyle: 'bold' },
            3: { cellWidth: 62 },
            4: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
            5: { cellWidth: 32, halign: 'center', fontStyle: 'bold', textColor: [16, 185, 129] }
          },
          alternateRowStyles: {
            fillColor: corZebra
          }
        });

        currentY = doc.lastAutoTable.finalY + 10;
      }

      // Adiciona cabeçalho e rodapé em todas as páginas geradas
      const totalPaginas = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPaginas; p++) {
        doc.setPage(p);
        adicionarCabecalhoRodape(p, totalPaginas, 'ROMANEIO DE CARGA & EXPEDIÇÃO DE GALPÃO');
      }

      // Protocolo final de assinaturas
      desenharProtocoloAssinaturas(currentY);
    }
  }

  // ── DOWNLOAD DO ARQUIVO PDF ──
  const nomeSufixo = tituloPeriodo.replace(/[^a-zA-Z0-9]/g, '_');
  const tipoDoc = modoRelatorio === 'romaneio' ? 'Romaneio_Expedicao' : 'Mapa_Separacao_Acervo';
  const nomeArquivo = `${tipoDoc}_${nomeSufixo}_${mesNome}_${ano}.pdf`;
  doc.save(nomeArquivo);
};
