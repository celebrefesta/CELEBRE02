/**
 * 📅 calendarSyncUtils.js
 * Utilitários para sincronização da Agenda Celebre com Google Agenda e Calendários Universais (.ICS).
 * Suporte a Google Calendar, Apple Calendar (iPhone/Mac), Microsoft Outlook e dispositivos móveis.
 */

/**
 * Formata número com 2 dígitos
 */
const pad2 = (num) => String(num).padStart(2, '0');

/**
 * Converte data e horário do evento para formato iCalendar / Google Calendar.
 * Suporta dia/mes/ano numéricos, dataISO ('YYYY-MM-DD'), dataRetirada, dataDevolucao ou Date.
 */
export const formatarDataHoraAgenda = (evento = {}) => {
  let ano, mes, dia;

  // 1. Tentar extrair de dataISO ('YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm')
  const strData = evento.dataISO || evento.dataRetirada || evento.dataDevolucao;
  if (typeof strData === 'string' && strData.includes('-')) {
    const apenasData = strData.split('T')[0].trim();
    const partes = apenasData.split('-');
    if (partes.length === 3) {
      ano = Number(partes[0]);
      mes = Number(partes[1]); // 1 a 12
      dia = Number(partes[2]);
    }
  }

  // 2. Se não encontrou, verificar dia, mes (0 a 11), ano numéricos
  if (!ano || isNaN(ano)) {
    if (evento.ano && evento.dia && evento.mes !== undefined) {
      ano = Number(evento.ano);
      mes = Number(evento.mes) + 1; // converte base 0 para 1..12
      dia = Number(evento.dia);
    } else {
      // Fallback para data atual se estiver vazio
      const agora = new Date();
      ano = agora.getFullYear();
      mes = agora.getMonth() + 1;
      dia = agora.getDate();
    }
  }

  const dataStr = `${ano}${pad2(mes)}${pad2(dia)}`;

  // Verificar se há horário especificado
  let horario = evento.horario;
  if (!horario && typeof strData === 'string' && strData.includes('T')) {
    horario = strData.split('T')[1].substring(0, 5);
  }

  if (horario && typeof horario === 'string' && horario.includes(':')) {
    const [h, m] = horario.split(':').map(Number);
    const horaValida = !isNaN(h) ? h : 9;
    const minutoValido = !isNaN(m) ? m : 0;
    
    const inicio = `${dataStr}T${pad2(horaValida)}${pad2(minutoValido)}00`;

    // Duração estimada padrão: 1 hora para compromissos gerais, 2 horas para montagens/entregas
    const duracaoHoras = evento.tipo === 'entrega' || evento.tipo === 'devolucao' ? 2 : 1;
    const dataFim = new Date(ano, mes - 1, dia, horaValida + duracaoHoras, minutoValido);
    
    const fim = `${dataFim.getFullYear()}${pad2(dataFim.getMonth() + 1)}${pad2(dataFim.getDate())}T${pad2(dataFim.getHours())}${pad2(dataFim.getMinutes())}00`;

    return {
      allDay: false,
      startGoogle: inicio,
      endGoogle: fim,
      startICS: inicio,
      endICS: fim,
    };
  }

  // Evento de dia inteiro (ex: bloqueios ou saídas sem hora estipulada)
  const proximoDia = new Date(ano, mes - 1, dia + 1);
  const endStr = `${proximoDia.getFullYear()}${pad2(proximoDia.getMonth() + 1)}${pad2(proximoDia.getDate())}`;

  return {
    allDay: true,
    startGoogle: dataStr,
    endGoogle: endStr,
    startICS: dataStr,
    endICS: endStr,
  };
};

/**
 * Monta os detalhes textuais do evento para incluir na descrição
 */
export const montarDetalhesEvento = (evento, nomeEmpresa = 'Celebre Festas') => {
  const linhas = [];

  const tipoLabel = {
    entrega: '🚚 Entrega / Montagem',
    devolucao: '📦 Devolução / Retorno',
    reuniao: '🤝 Reunião / Atendimento',
    visita: '📍 Visita Técnica',
    pagamento: '💰 Cobrança / Pagamento',
    tarefa: '📋 Tarefa Operacional',
    bloqueio: '🔒 Bloqueio de Data / Indisponível'
  }[evento.tipo] || '📅 Evento';

  linhas.push(`Tipo: ${tipoLabel}`);
  
  if (evento.clienteNome) {
    linhas.push(`Cliente: ${evento.clienteNome}`);
  }

  if (evento.numeroPedido) {
    linhas.push(`Pedido: #${evento.numeroPedido}`);
  }

  if (evento.tipoServico) {
    linhas.push(`Modalidade: ${evento.tipoServico}`);
  }

  if (evento.local) {
    linhas.push(`Local: ${evento.local}`);
  }

  if (evento.horario) {
    linhas.push(`Horário Agendado: ${evento.horario}`);
  }

  if (evento.valorTotal && Number(evento.valorTotal) > 0) {
    const total = Number(evento.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const pago = Number(evento.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const saldo = Number(evento.valorTotal) - Number(evento.valorPago || 0);
    linhas.push(`Valor Total: R$ ${total} (Pago: R$ ${pago}${saldo > 0 ? ` | Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ' - Quitado'})`);
  }

  if (evento.observacoes) {
    linhas.push(`Observações: ${evento.observacoes}`);
  }

  linhas.push(`\n---\nAgendado via ${nomeEmpresa} - Sistema de Gestão`);

  return linhas.join('\n');
};

/**
 * Gera o link direto para adicionar o evento ao Google Calendar em 1 clique
 * Abre template web: https://calendar.google.com/calendar/render?action=TEMPLATE...
 */
export const gerarLinkGoogleCalendar = (evento, nomeEmpresa = 'Celebre Festas') => {
  const { startGoogle, endGoogle } = formatarDataHoraAgenda(evento);

  const prefixoTipo = {
    entrega: '[Entrega]',
    devolucao: '[Devolução]',
    reuniao: '[Reunião]',
    visita: '[Visita]',
    pagamento: '[Cobrança]',
    tarefa: '[Tarefa]',
    bloqueio: '[Bloqueio]'
  }[evento.tipo] || '[Evento]';

  const tituloLimpo = evento.titulo || 'Compromisso';
  const tituloFinal = tituloLimpo.startsWith('[') ? tituloLimpo : `${prefixoTipo} ${tituloLimpo}`;

  const detalhes = montarDetalhesEvento(evento, nomeEmpresa);
  const localizacao = evento.local || '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: tituloFinal,
    dates: `${startGoogle}/${endGoogle}`,
    details: detalhes,
    location: localizacao,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Abre o Google Calendar para o evento em uma nova aba
 */
export const abrirGoogleAgenda = (evento, nomeEmpresa = 'Celebre Festas') => {
  const url = gerarLinkGoogleCalendar(evento, nomeEmpresa);
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Escapa texto para o formato iCalendar RFC 5545
 */
const escaparTextoICS = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
};

/**
 * Gera o conteúdo no formato iCalendar (.ics) para uma lista de eventos
 * Compatível com Apple Calendar, Google Calendar, Outlook, Android e iOS
 */
export const gerarConteudoICS = (eventos = [], nomeEmpresa = 'Celebre Festas') => {
  const agora = new Date();
  const dtStamp = `${agora.getUTCFullYear()}${pad2(agora.getUTCMonth() + 1)}${pad2(agora.getUTCDate())}T${pad2(agora.getUTCHours())}${pad2(agora.getUTCMinutes())}${pad2(agora.getUTCSeconds())}Z`;

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${nomeEmpresa}//Agenda Celebre//PT`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Agenda - ${nomeEmpresa}`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
  ];

  eventos.forEach((ev, idx) => {
    const { allDay, startICS, endICS } = formatarDataHoraAgenda(ev);
    const uid = `ev-${ev.id || `${ev.ano}${ev.mes}${ev.dia}-${idx}`}@celebre-festas`;
    const resumo = escaparTextoICS(ev.titulo || 'Compromisso Celebre');
    const descricao = escaparTextoICS(montarDetalhesEvento(ev, nomeEmpresa));
    const local = escaparTextoICS(ev.local || '');

    linhas.push('BEGIN:VEVENT');
    linhas.push(`UID:${uid}`);
    linhas.push(`DTSTAMP:${dtStamp}`);

    if (allDay) {
      linhas.push(`DTSTART;VALUE=DATE:${startICS}`);
      linhas.push(`DTEND;VALUE=DATE:${endICS}`);
    } else {
      linhas.push(`DTSTART:${startICS}`);
      linhas.push(`DTEND:${endICS}`);
    }

    linhas.push(`SUMMARY:${resumo}`);
    linhas.push(`DESCRIPTION:${descricao}`);
    if (local) {
      linhas.push(`LOCATION:${local}`);
    }
    linhas.push('STATUS:CONFIRMED');
    linhas.push('END:VEVENT');
  });

  linhas.push('END:VCALENDAR');

  return linhas.join('\r\n');
};

/**
 * Dispara o download de um arquivo .ics no navegador
 */
export const baixarArquivoICS = (eventos = [], nomeEmpresa = 'Celebre Festas', tituloArquivo = 'Agenda_Celebre') => {
  if (!eventos || eventos.length === 0) {
    throw new Error('Nenhum evento para exportar.');
  }

  const icsConteudo = gerarConteudoICS(eventos, nomeEmpresa);
  const blob = new Blob([icsConteudo], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const nomeSeguro = tituloArquivo.replace(/[^a-z0-9_-]/gi, '_');
  link.download = `${nomeSeguro}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
