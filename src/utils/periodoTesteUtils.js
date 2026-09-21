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
    // Suporte ao formato brasileiro DD/MM/YYYY (ex: 14/03/2026)
    const brMatch = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      const [_, dia, mes, ano] = brMatch;
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

/**
 * 👑 Utilitário Oficial Celebre para Verificação Rigorosa de Assinatura e Cortesia
 * 
 * Regra de Ouro:
 * - Contas suspensas ou excluídas: NUNCA ativas.
 * - Super Admin: Sempre ativo (vitalício).
 * - Planos Pagos / Cortesias VIP: Devem possuir vigência comprovada.
 * - Se a data de vencimento / próxima cobrança (dataProximaCobranca ou dataPagamento + ciclo)
 *   já passou do HORÁRIO EXATO (hora:minuto:segundo), a assinatura é considerada EXPIRADA imediatamente!
 */
export const verificarAssinaturaAtiva = (usuarioOuDados) => {
  if (!usuarioOuDados) {
    return { ativa: false, expirada: false, motivo: 'sem_dados', dataVencimento: null };
  }

  // 1. Suspensão por inatividade ou exclusão anula qualquer assinatura
  const statusConta = usuarioOuDados.statusConta;
  const status = usuarioOuDados.status;
  if (statusConta === 'suspenso' || status === 'suspenso' || statusConta === 'excluido' || status === 'excluido') {
    return { ativa: false, expirada: false, motivo: 'suspenso', dataVencimento: null };
  }

  // 2. Super Admin da Celebre é sempre vitalício
  if (usuarioOuDados.email === 'celebrefesta25@gmail.com' || status === 'admin') {
    return { ativa: true, expirada: false, motivo: 'admin', dataVencimento: null };
  }

  // 3. Flags de contratação ou concessão VIP
  const temFlagAssinatura = Boolean(
    usuarioOuDados.assinaturaAtiva === true ||
    usuarioOuDados.assinaturaAtiva === 'true' ||
    usuarioOuDados.statusAssinatura === 'ativa' ||
    usuarioOuDados.plano === 'pago' ||
    usuarioOuDados.statusPagamentoVulso === 'pago' ||
    usuarioOuDados.statusPagamentoVulso === 'aprovado' ||
    usuarioOuDados.isAssinantePago === true
  );

  if (!temFlagAssinatura) {
    return { ativa: false, expirada: false, motivo: 'sem_assinatura', dataVencimento: null };
  }

  // 4. Determinação da data e horário exato de vencimento
  const rawVencimento = usuarioOuDados.dataProximaCobranca 
    || usuarioOuDados.dataVencimento 
    || usuarioOuDados.vencimento;

  let dataVenc = null;

  if (rawVencimento) {
    dataVenc = parseDataGenerica(rawVencimento);
    // Se a data veio em formato puro YYYY-MM-DD (sem horário), herda o horário do pagamento ou cadastro
    if (dataVenc && typeof rawVencimento === 'string' && !rawVencimento.includes('T')) {
      const dRef = parseDataGenerica(usuarioOuDados.dataPagamento || usuarioOuDados.dataCadastro);
      if (dRef) {
        dataVenc.setHours(dRef.getHours(), dRef.getMinutes(), dRef.getSeconds(), dRef.getMilliseconds());
      }
    }
  }

  // Se não possui dataProximaCobranca explícita, projeta a partir da data de pagamento
  if (!dataVenc && usuarioOuDados.dataPagamento) {
    const dPag = parseDataGenerica(usuarioOuDados.dataPagamento);
    if (dPag) {
      dataVenc = new Date(dPag);
      const isAnual = Boolean(
        usuarioOuDados.ciclo === 'anual' ||
        String(usuarioOuDados.planoId || '').toLowerCase().includes('anual')
      );
      if (isAnual) {
        dataVenc.setFullYear(dataVenc.getFullYear() + 1);
      } else {
        dataVenc.setMonth(dataVenc.getMonth() + 1);
      }
    }
  }

  // Fallback para data de cadastro caso não haja nenhuma data de pagamento
  if (!dataVenc && usuarioOuDados.dataCadastro) {
    const dCad = parseDataGenerica(usuarioOuDados.dataCadastro);
    if (dCad) {
      dataVenc = new Date(dCad);
      dataVenc.setMonth(dataVenc.getMonth() + 1);
    }
  }

  // Se tem flag de assinatura mas nenhuma data pôde ser extraída, considera ativo
  if (!dataVenc) {
    return { ativa: true, expirada: false, motivo: 'ativa_sem_data', dataVencimento: null };
  }

  // 5. ⏰ VERIFICAÇÃO DE HORÁRIO EXATO:
  // Se o instante atual já ultrapassou o horário exato de término da assinatura / cortesia
  const agora = new Date();
  const expirou = agora.getTime() >= dataVenc.getTime();

  if (expirou) {
    return {
      ativa: false,
      expirada: true,
      motivo: 'vencida',
      dataVencimento: dataVenc
    };
  }

  return {
    ativa: true,
    expirada: false,
    motivo: 'vigente',
    dataVencimento: dataVenc
  };
};

export const calcularPeriodoTeste = (usuarioOuDados) => {
  if (!usuarioOuDados) {
    return {
      emTeste: false,
      diasRestantes: 0,
      diaAtual: 0,
      diasTranscorridos: 0,
      dataFimFormatada: '—',
      dataFimHoraFormatada: '',
      dataFimDate: null
    };
  }

  const rawCadastro = usuarioOuDados.dataCadastro 
    || usuarioOuDados.criadoEm 
    || usuarioOuDados.createdAt 
    || usuarioOuDados.dataInicioTeste;

  const dataCad = parseDataGenerica(rawCadastro) || new Date();
  const agora = new Date();

  // Dias transcorridos desde o cadastro em dias de calendário civis cheios
  const cadMeia = zerarHorario(dataCad);
  const hojeMeia = zerarHorario(agora);
  const diffMs = hojeMeia.getTime() - cadMeia.getTime();
  const diasTranscorridos = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  // Data de término: ou a estipulada em dataFimTeste ou 7 dias após o cadastro
  // PRESERVA o horário exato (hora, minuto, segundo) para expiração no momento preciso!
  let dataFimTeste = null;
  if (usuarioOuDados.dataFimTeste) {
    const fimPersonalizado = parseDataGenerica(usuarioOuDados.dataFimTeste);
    if (fimPersonalizado) {
      dataFimTeste = new Date(fimPersonalizado);
      // Se veio no formato puro YYYY-MM-DD sem hora:
      if (typeof usuarioOuDados.dataFimTeste === 'string' && !usuarioOuDados.dataFimTeste.includes('T')) {
        // Herda o horário de cadastro para expirar no mesmo horário
        dataFimTeste.setHours(dataCad.getHours(), dataCad.getMinutes(), dataCad.getSeconds(), dataCad.getMilliseconds());
      }
    }
  }

  if (!dataFimTeste) {
    dataFimTeste = new Date(dataCad);
    dataFimTeste.setDate(dataFimTeste.getDate() + 7);
  }

  // Duração total do teste concedida em dias civis
  const diffTotalMs = dataFimTeste.getTime() - dataCad.getTime();
  const totalDiasTeste = Math.max(1, Math.round(diffTotalMs / (1000 * 60 * 60 * 24)));

  // ⏰ VERIFICAÇÃO DE HORÁRIO EXATO DO TESTE:
  // O teste está ativo SOMENTE ENQUANTO o timestamp atual for menor que dataFimTeste
  const emTeste = agora.getTime() < dataFimTeste.getTime();

  // Dias restantes até a data final
  const diffAteFimMs = dataFimTeste.getTime() - agora.getTime();
  const diasRestantes = emTeste 
    ? Math.max(1, Math.ceil(diffAteFimMs / (1000 * 60 * 60 * 24)))
    : 0;

  // Dia atual do teste relativo ao total (ex: Dia 1 de 7, Dia 2 de 7...)
  const diaAtual = Math.min(totalDiasTeste, diasTranscorridos + 1);

  let dataFimFormatada = '—';
  let dataFimHoraFormatada = '';
  try {
    dataFimFormatada = dataFimTeste.toLocaleDateString('pt-BR');
    dataFimHoraFormatada = `${String(dataFimTeste.getHours()).padStart(2, '0')}:${String(dataFimTeste.getMinutes()).padStart(2, '0')}`;
  } catch {}

  return {
    emTeste,
    diasRestantes,
    diaAtual,
    totalDiasTeste,
    diasTranscorridos,
    dataFimFormatada,
    dataFimHoraFormatada,
    dataFimDate: dataFimTeste
  };
};

/**
 * 🏆 Compara N documentos Firestore do mesmo e-mail e retorna o que tem maior validade.
 * Prioridade: assinaturaAtiva > maior dataFimTeste > mais antigo (dataCadastro menor).
 * Retorna { melhorDoc, melhorId } onde melhorDoc é o data() e melhorId é o docId.
 */
export const obterMelhorContaPorEmail = (docs) => {
  if (!docs || docs.length === 0) return { melhorDoc: null, melhorId: null };
  if (docs.length === 1) {
    const d = docs[0];
    return { melhorDoc: typeof d.data === 'function' ? d.data() : d, melhorId: d.id || null };
  }

  let melhorDoc = null;
  let melhorId = null;
  let melhorFim = null;

  for (const docSnap of docs) {
    const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
    const id = docSnap.id || data.id || null;

    // Assinatura ativa (não vencida) sempre vence
    const temAssinatura = verificarAssinaturaAtiva(data).ativa;
    const melhorTemAssinatura = melhorDoc ? verificarAssinaturaAtiva(melhorDoc).ativa : false;

    if (!melhorDoc) {
      melhorDoc = data;
      melhorId = id;
      melhorFim = parseDataGenerica(data.dataFimTeste);
      continue;
    }

    // Se o candidato tem assinatura e o melhor não → candidato vence
    if (temAssinatura && !melhorTemAssinatura) {
      melhorDoc = data;
      melhorId = id;
      melhorFim = parseDataGenerica(data.dataFimTeste);
      continue;
    }

    // Se ambos têm (ou nenhum tem) assinatura → quem tem dataFimTeste maior vence
    if (!melhorTemAssinatura) {
      const candidatoFim = parseDataGenerica(data.dataFimTeste);
      if (candidatoFim && (!melhorFim || candidatoFim > melhorFim)) {
        melhorDoc = data;
        melhorId = id;
        melhorFim = candidatoFim;
      }
    }
  }

  return { melhorDoc, melhorId };
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
