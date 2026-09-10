/**
 * ⏳ Utilitário centralizado para cálculo unificado do Período de Teste VIP (7 dias)
 * 
 * Regra de Negócio Oficial do Celebre:
 * - Dia do cadastro (Dia 1): Faltam 7 dias de teste.
 * - 1 dia depois (Dia 2 - ontem fez conta, hoje é o dia seguinte): Faltam 6 dias de teste.
 * - 2 dias depois (Dia 3): Faltam 5 dias de teste.
 * - 3 dias depois (Dia 4): Faltam 4 dias de teste.
 * - 4 dias depois (Dia 5): Faltam 3 dias de teste.
 * - 5 dias depois (Dia 6): Faltam 2 dias de teste (Alerta de Teste Vencendo).
 * - 6 dias depois (Dia 7): Falta 1 dia de teste (Último dia de degustação).
 * - 7 dias depois (Dia 8 em diante): Teste encerrado (0 dias restantes) -> Bloqueado.
 */

export const parseDataGenerica = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  if (typeof valor.toDate === 'function') {
    try { return valor.toDate(); } catch { return null; }
  }
  if (typeof valor === 'number') return new Date(valor);
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    // Se for formato apenas data YYYY-MM-DD ou ISO com T00:00:00 (evita bug de recuo de dia no UTC-3)
    const match = limpo.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && (!limpo.includes('T') || limpo.includes('T00:00:00'))) {
      const [_, ano, mes, dia] = match;
      return new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10), 12, 0, 0);
    }
    const d = new Date(limpo);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Converte qualquer formato de data para exibição em pt-BR (DD/MM/AAAA)
 * 100% imune a perdas de 1 dia causadas por fusos horários locais (UTC-3).
 */
export const formatarDataExibicao = (valor) => {
  if (!valor) return '—';
  if (valor.toDate) valor = valor.toDate();
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    const match = limpo.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && (!limpo.includes('T') || limpo.includes('T00:00:00'))) {
      const [_, ano, mes, dia] = match;
      return `${dia}/${mes}/${ano}`;
    }
    try {
      const d = new Date(limpo);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  }
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? '—' : valor.toLocaleDateString('pt-BR');
  }
  return '—';
};

/**
 * Converte qualquer formato de data para o padrão de input HTML (YYYY-MM-DD)
 * no fuso horário local, sem retroceder 1 dia.
 */
export const formatarDataParaInput = (valor) => {
  if (!valor) return '';
  if (valor.toDate) valor = valor.toDate();
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    const match = limpo.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && (!limpo.includes('T') || limpo.includes('T00:00:00'))) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    try {
      const d = new Date(limpo);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dia}`;
    } catch {
      return '';
    }
  }
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }
  return '';
};

export const zerarHorario = (data) => {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const calcularPeriodoTeste = (usuarioOuDados) => {
  if (!usuarioOuDados) {
    return {
      emTeste: false,
      diasRestantes: 0,
      diaAtual: 0,
      diasTranscorridos: 0,
      dataFimFormatada: '—',
      dataFimDate: null
    };
  }

  const rawCadastro = usuarioOuDados.dataCadastro 
    || usuarioOuDados.criadoEm 
    || usuarioOuDados.createdAt 
    || usuarioOuDados.dataInicioTeste;

  const dataCad = parseDataGenerica(rawCadastro) || new Date();
  const cadMeia = zerarHorario(dataCad);
  const hojeMeia = zerarHorario(new Date());

  // Dias transcorridos desde o cadastro em dias de calendário civis cheios
  const diffMs = hojeMeia.getTime() - cadMeia.getTime();
  const diasTranscorridos = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  // Data de término: ou a estipulada manualmente pelo admin em dataFimTeste ou 7 dias após o cadastro
  let dataFimTeste = null;
  if (usuarioOuDados.dataFimTeste) {
    const fimPersonalizado = parseDataGenerica(usuarioOuDados.dataFimTeste);
    if (fimPersonalizado) {
      dataFimTeste = zerarHorario(fimPersonalizado);
    }
  }

  if (!dataFimTeste) {
    dataFimTeste = new Date(cadMeia);
    dataFimTeste.setDate(dataFimTeste.getDate() + 7);
  }

  // Duração total do teste concedida em dias civis
  const diffTotalMs = dataFimTeste.getTime() - cadMeia.getTime();
  const totalDiasTeste = Math.max(1, Math.round(diffTotalMs / (1000 * 60 * 60 * 24)));

  // Dias restantes até a data final
  const diffAteFimMs = dataFimTeste.getTime() - hojeMeia.getTime();
  const diasRestantesCalculados = Math.round(diffAteFimMs / (1000 * 60 * 60 * 24));
  const diasRestantes = Math.max(0, diasRestantesCalculados);

  // Está em teste ativo enquanto a data atual for anterior à data limite e houver dias restantes
  const emTeste = hojeMeia < dataFimTeste && diasRestantesCalculados > 0;

  // Dia atual do teste relativo ao total (ex: Dia 1 de 15, Dia 2 de 15...)
  const diaAtual = Math.min(totalDiasTeste, diasTranscorridos + 1);

  let dataFimFormatada = '—';
  try {
    dataFimFormatada = dataFimTeste.toLocaleDateString('pt-BR');
  } catch {}

  return {
    emTeste,
    diasRestantes,
    diaAtual,
    totalDiasTeste,
    diasTranscorridos,
    dataFimFormatada,
    dataFimDate: dataFimTeste
  };
};

/**
 * 🌟 Identifica se uma empresa/cliente é NOVO (cadastrado nos últimos 3 dias: hoje, ontem ou anteontem)
 */
export const calcularSeEhNovo = (rawDate) => {
  if (!rawDate) return { isNovo: false, rotulo: '', diffDias: 999 };
  const dt = parseDataGenerica(rawDate);
  if (!dt) return { isNovo: false, rotulo: '', diffDias: 999 };

  const hoje = zerarHorario(new Date());
  const dtCliente = zerarHorario(dt);

  const diffMs = hoje.getTime() - dtCliente.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Cadastrado hoje, ontem, há 2 dias ou há 3 dias (também cobre eventuais fusos com diff negativo leve)
  if (diffDias <= 3 && diffDias >= -1) {
    let rotulo = 'Hoje';
    if (diffDias === 1) rotulo = 'Ontem';
    else if (diffDias === 2) rotulo = 'Há 2 dias';
    else if (diffDias === 3) rotulo = 'Há 3 dias';
    return { isNovo: true, rotulo, diffDias: Math.max(0, diffDias) };
  }

  return { isNovo: false, rotulo: '', diffDias };
};
