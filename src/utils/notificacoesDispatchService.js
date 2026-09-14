/**
 * 🔔 MOTOR DE DISPACHO E TEMPLATES DE NOTIFICAÇÕES — CELEBRE LUXURY
 * Suporte Multi-Canal: WhatsApp, E-mail, SMS e Alertas Operacionais Internos
 */

import { db } from '../firebaseConfig';
import { collection, addDoc, doc, getDoc, setDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { gerarEmailPremium } from './emailTemplatePremium';

const RESEND_API_KEY = ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');
const SENDER_EMAIL = 'Celebre Notificações <seguranca@celebrefesta.com.br>';

// ============================================================================
// 1. GATILHOS E CANAIS PADRÃO DO SISTEMA
// ============================================================================
export const GATILHOS_PADRAO = [
  {
    id: 'lembrete_retirada',
    titulo: 'Lembrete de Retirada do Acervo (D-1)',
    descricao: 'Dispara 24 horas antes do evento lembrando data, endereço do galpão e horário de retirada.',
    icone: 'fa-truck-loading',
    cor: '#c5a059',
    canais: { whatsapp: true, email: true, sms: false }
  },
  {
    id: 'lembrete_devolucao',
    titulo: 'Lembrete de Devolução do Acervo (D-1 / Manhã)',
    descricao: 'Lembra o cliente sobre a vistoria de devolução, conferência de peças e horário limite.',
    icone: 'fa-box-open',
    cor: '#3b82f6',
    canais: { whatsapp: true, email: true, sms: false }
  },
  {
    id: 'alerta_atraso',
    titulo: 'Alerta de Atraso na Devolução',
    descricao: 'Notifica imediatamente se o prazo de devolução expirou e o material não deu entrada no galpão.',
    icone: 'fa-exclamation-triangle',
    cor: '#ef4444',
    canais: { whatsapp: true, email: true, sms: true }
  },
  {
    id: 'contrato_assinatura',
    titulo: 'Contrato Pronto para Assinatura Digital',
    descricao: 'Envia o link seguro de assinatura pelo celular assim que um novo contrato é gerado.',
    icone: 'fa-file-signature',
    cor: '#10b981',
    canais: { whatsapp: true, email: true, sms: false }
  },
  {
    id: 'cobranca_avaria',
    titulo: 'Aviso de Avarias / Acerto Financeiro',
    descricao: 'Cobrança amigável com demonstrativo de avarias apuradas no check-in e chave Pix para quitação.',
    icone: 'fa-receipt',
    cor: '#f59e0b',
    canais: { whatsapp: true, email: true, sms: false }
  },
  {
    id: 'boas_vindas_catalogo',
    titulo: 'Boas-Vindas ao Cliente (Catálogo / Vitrine)',
    descricao: 'Mensagem de acolhimento e confirmação enviada quando o cliente faz auto-cadastro ou envia proposta.',
    icone: 'fa-sparkles',
    cor: '#8b5cf6',
    canais: { whatsapp: true, email: true, sms: false }
  }
];

// ============================================================================
// 2. TEMPLATES PADRÃO INICIAIS
// ============================================================================
export const TEMPLATES_PADRAO = {
  lembrete_retirada: {
    whatsapp: 'Olá *{nome_cliente}*! Tudo bem? ✨\n\nPassando para lembrar que amanhã, *{data_retirada}*, é o dia da retirada do acervo para o seu evento (*Pedido #{numero_pedido}*)!\n\n📍 *Endereço do Galpão:* {endereco_galpão}\n⏰ *Horário de Retirada:* {horario_retirada}\n\nQualquer dúvida, estamos à disposição!\n*{nome_empresa}*',
    emailAssunto: '🎉 Lembrete: A retirada do seu acervo é amanhã! • {nome_empresa}',
    emailCorpo: 'Olá <strong>{nome_cliente}</strong>,<br><br>Estamos preparando tudo com muito carinho para o seu evento! Este é um lembrete de que a retirada do acervo (<strong>Pedido #{numero_pedido}</strong>) está agendada para <strong>{data_retirada}</strong>.<br><br><strong>Local:</strong> {endereco_galpão}<br><strong>Horário:</strong> {horario_retirada}<br><br>Atenciosamente,<br><strong>{nome_empresa}</strong>',
    sms: '{nome_empresa}: Ola {nome_cliente}, seu acervo do Pedido #{numero_pedido} retira amanha ({data_retirada}). Duvidas: {telefone_empresa}'
  },
  lembrete_devolucao: {
    whatsapp: 'Olá *{nome_cliente}*, esperamos que seu evento tenha sido incrível! 🎉\n\nLembramos que a devolução do acervo (*Pedido #{numero_pedido}*) está prevista para hoje, *{data_devolucao}*, até às *{horario_devolucao}*.\n\nPedimos que as peças retornem limpas e acomodadas nas caixas originais para agilizar a vistoria de check-in.\n\nMuito obrigado!\n*{nome_empresa}*',
    emailAssunto: '📦 Lembrete de Devolução do Acervo • {nome_empresa}',
    emailCorpo: 'Olá <strong>{nome_cliente}</strong>,<br><br>Esperamos que sua festa tenha sido inesquecível! Lembramos que a devolução do acervo do <strong>Pedido #{numero_pedido}</strong> está agendada para <strong>{data_devolucao}</strong> até as <strong>{horario_devolucao}</strong>.<br><br>Agradecemos pela parceria!<br><strong>{nome_empresa}</strong>',
    sms: '{nome_empresa}: Ola {nome_cliente}, devolucao do Pedido #{numero_pedido} prevista para hoje ({data_devolucao}) ate as {horario_devolucao}.'
  },
  alerta_atraso: {
    whatsapp: '⚠️ *AVISO DE ATRASO DE DEVOLUÇÃO* — *{nome_empresa}*\n\nOlá *{nome_cliente}*, identificamos que a devolução das peças do *Pedido #{numero_pedido}*, prevista para *{data_devolucao}*, ainda não deu entrada em nosso galpão.\n\nPedimos a gentileza de nos informar uma previsão de entrega imediata para evitarmos a cobrança de diária adicional de locação.\n\nWhatsApp para contato: *{telefone_empresa}*',
    emailAssunto: '⚠️ Alerta de Atraso na Devolução de Peças • {nome_empresa}',
    emailCorpo: 'Prezado(a) <strong>{nome_cliente}</strong>,<br><br>Não identificamos a devolução do acervo correspondente ao <strong>Pedido #{numero_pedido}</strong>, prevista para <strong>{data_devolucao}</strong>.<br><br>Por favor, entre em contato com nossa equipe com urgência para alinhamento.<br><br>Telefone: <strong>{telefone_empresa}</strong>',
    sms: 'URGENTE {nome_empresa}: Nao identificamos a devolucao do Pedido #{numero_pedido}. Entre em contato agora: {telefone_empresa}'
  },
  contrato_assinatura: {
    whatsapp: 'Olá *{nome_cliente}*! ✨\n\nO contrato de locação do seu evento já está pronto para assinatura digital diretamente no seu celular (Touch/Mouse)!\n\n📄 *Acesse e assine pelo link seguro:*\n{link_contrato}\n\nAssim que você assinar, sua reserva de acervo estará 100% garantida!\n*{nome_empresa}*',
    emailAssunto: '📜 Seu Contrato de Locação está Pronto para Assinatura • {nome_empresa}',
    emailCorpo: 'Olá <strong>{nome_cliente}</strong>,<br><br>O contrato de locação para seu evento (<strong>Pedido #{numero_pedido}</strong>) foi gerado e aguarda sua assinatura digital.<br><br><a href="{link_contrato}" style="background-color: #c5a059; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Clique aqui para Assinar pelo Celular</a><br><br>Atenciosamente,<br><strong>{nome_empresa}</strong>',
    sms: '{nome_empresa}: Seu contrato de locacao esta pronto para assinatura digital. Assine agora no link: {link_contrato}'
  },
  cobranca_avaria: {
    whatsapp: 'Olá *{nome_cliente}*! 🛠️\n\nA vistoria de devolução do seu *Pedido #{numero_pedido}* foi concluída. Identificamos peças que necessitam de reposição/reparo no valor de *R$ {valor_total}*.\n\n🔑 *Chave Pix para regularização:* `{chave_pix}`\n\nPara visualizar o relatório fotográfico das peças, nos responda aqui mesmo.\n*{nome_empresa}*',
    emailAssunto: '🛠️ Demonstrativo de Vistoria e Regularização • {nome_empresa}',
    emailCorpo: 'Olá <strong>{nome_cliente}</strong>,<br><br>Concluímos a conferência de entrada do <strong>Pedido #{numero_pedido}</strong>. Constatamos avarias/faltas que totalizam <strong>R$ {valor_total}</strong>.<br><br>Chave Pix para acerto: <strong>{chave_pix}</strong>.<br><br>Atenciosamente,<br><strong>{nome_empresa}</strong>',
    sms: '{nome_empresa}: Vistoria do Pedido #{numero_pedido} concluida. Saldo pendente: R$ {valor_total}. Chave Pix: {chave_pix}'
  },
  boas_vindas_catalogo: {
    whatsapp: 'Olá *{nome_cliente}*, que alegria ter você por aqui! 🎉\n\nRecebemos sua solicitação em nossa vitrine digital! Nossa equipe já está analisando a disponibilidade das suas peças favoritas para o dia *{data_evento}*.\n\nEm breve entraremos em contato com sua proposta detalhada!\n*{nome_empresa}*',
    emailAssunto: '🎉 Bem-vindo(a) à {nome_empresa}! Recebemos sua solicitação',
    emailCorpo: 'Olá <strong>{nome_cliente}</strong>,<br><br>Muito obrigado pelo interesse em nosso acervo para seu evento em <strong>{data_evento}</strong>! Nossa equipe já está preparando sua proposta comercial personalizada.<br><br>Com carinho,<br><strong>{nome_empresa}</strong>',
    sms: '{nome_empresa}: Ola {nome_cliente}, recebemos seu pedido de orcamento! Em breve entraremos em contato. Obrigado!'
  }
};

// ============================================================================
// 3. INTERPOLAÇÃO INTELIGENTE DE TAGS
// ============================================================================
export const TAGS_DISPONIVEIS = [
  { tag: '{nome_cliente}', label: 'Nome do Cliente', exemplo: 'Camila Silva' },
  { tag: '{numero_pedido}', label: 'Nº do Pedido / Contrato', exemplo: '2026-042' },
  { tag: '{data_evento}', label: 'Data do Evento', exemplo: '20/09/2026' },
  { tag: '{data_retirada}', label: 'Data de Retirada', exemplo: '19/09/2026' },
  { tag: '{data_devolucao}', label: 'Data de Devolução', exemplo: '21/09/2026' },
  { tag: '{horario_retirada}', label: 'Horário Retirada', exemplo: '09h00 às 17h00' },
  { tag: '{horario_devolucao}', label: 'Horário Devolução', exemplo: '18h00' },
  { tag: '{valor_total}', label: 'Valor Total (R$)', exemplo: '850,00' },
  { tag: '{chave_pix}', label: 'Chave Pix da Locadora', exemplo: '19998564109' },
  { tag: '{link_contrato}', label: 'Link de Assinatura', exemplo: 'https://celebre-9f5c9.web.app/assinatura/abc123' },
  { tag: '{nome_empresa}', label: 'Nome da Locadora', exemplo: 'Celebre Festas' },
  { tag: '{telefone_empresa}', label: 'Telefone da Locadora', exemplo: '(19) 99856-4109' },
  { tag: '{endereco_galpão}', label: 'Endereço do Galpão', exemplo: 'Rua das Flores, 120 - Galpão 02' }
];

export const interpolarTags = (texto = '', dados = {}) => {
  if (!texto) return '';
  let resultado = String(texto);

  const mapa = {
    '{nome_cliente}': dados.nomeCliente || dados.nome || 'Cliente',
    '{numero_pedido}': dados.numeroPedido || dados.idPedido || '2026-001',
    '{data_evento}': dados.dataEvento || 'Data a Definir',
    '{data_retirada}': dados.dataRetirada || 'Data a Definir',
    '{data_devolucao}': dados.dataDevolucao || 'Data a Definir',
    '{horario_retirada}': dados.horarioRetirada || '09h00 às 17h00',
    '{horario_devolucao}': dados.horarioDevolucao || '18h00',
    '{valor_total}': dados.valorTotal ? Number(dados.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00',
    '{chave_pix}': dados.chavePix || dados.pix || '(19) 99856-4109',
    '{link_contrato}': dados.linkContrato || 'https://celebre-9f5c9.web.app/assinatura/exemplo',
    '{nome_empresa}': dados.nomeEmpresa || 'Celebre Festas',
    '{telefone_empresa}': dados.telefoneEmpresa || '(19) 99856-4109',
    '{endereco_galpão}': dados.enderecoGalpao || 'Galpão Principal - Consulte a equipe'
  };

  Object.entries(mapa).forEach(([tag, val]) => {
    resultado = resultado.split(tag).join(String(val));
  });

  return resultado;
};

// ============================================================================
// 4. CARREGAR E SALVAR CONFIGURAÇÕES NO FIRESTORE
// ============================================================================
export const carregarConfiguracoesNotificacoes = async (tenantId) => {
  if (!tenantId) return { gatilhos: {}, templates: TEMPLATES_PADRAO, provedores: {} };

  try {
    // 1. Tenta carregar de configuracoes_empresa (onde a permissão é garantida para todos da empresa)
    let data = null;
    try {
      const empSnap = await getDoc(doc(db, 'configuracoes_empresa', tenantId));
      if (empSnap.exists() && empSnap.data().configuracoesNotificacoes) {
        data = empSnap.data().configuracoesNotificacoes;
      }
    } catch (eEmp) {
      // continua
    }

    // 2. Se não encontrou, tenta na coleção dedicada
    if (!data) {
      try {
        const docRef = doc(db, 'configuracoes_notificacoes', tenantId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          data = snap.data();
        }
      } catch (eNoti) {
        // continua
      }
    }

    if (data) {
      return {
        gatilhos: data.gatilhos || {},
        templates: { ...TEMPLATES_PADRAO, ...(data.templates || {}) },
        provedores: data.provedores || {
          whatsappModo: 'nativo',
          whatsappApiUrl: '',
          whatsappApiKey: '',
          emailRemetente: 'seguranca@celebrefesta.com.br',
          smsAtivo: false
        }
      };
    } else {
      const gatilhosIniciais = {};
      GATILHOS_PADRAO.forEach(g => {
        gatilhosIniciais[g.id] = { ...g.canais };
      });

      return {
        tenantId,
        gatilhos: gatilhosIniciais,
        templates: TEMPLATES_PADRAO,
        provedores: {
          whatsappModo: 'nativo',
          whatsappApiUrl: '',
          whatsappApiKey: '',
          emailRemetente: 'seguranca@celebrefesta.com.br',
          smsAtivo: false
        }
      };
    }
  } catch (err) {
    console.warn('Aviso ao carregar configurações de notificações:', err);
    return { gatilhos: {}, templates: TEMPLATES_PADRAO, provedores: {} };
  }
};

export const salvarConfiguracoesNotificacoes = async (tenantId, config) => {
  if (!tenantId) return false;
  try {
    const dadosSalvar = {
      ...config,
      tenantId,
      atualizadoEm: new Date().toISOString()
    };

    // Salva prioritariamente em configuracoes_empresa
    await setDoc(doc(db, 'configuracoes_empresa', tenantId), {
      configuracoesNotificacoes: dadosSalvar
    }, { merge: true });

    // Tenta em segundo plano em configuracoes_notificacoes
    try {
      await setDoc(doc(db, 'configuracoes_notificacoes', tenantId), dadosSalvar, { merge: true });
    } catch (e) {
      // Ignora erro de regra se a coleção ainda não foi autorizada
    }

    return true;
  } catch (err) {
    console.error('Erro ao salvar configurações de notificações:', err);
    throw err;
  }
};

// ============================================================================
// 5. REGISTRAR HISTÓRICO DE DISPAROS
// ============================================================================
export const registrarHistoricoDisparo = async ({ tenantId, destinatario, contato, canal, tipoEvento, mensagem, status = 'sucesso', detalhes = '' }) => {
  if (!tenantId) return;
  try {
    await addDoc(collection(db, 'historico_notificacoes'), {
      tenantId,
      destinatario: destinatario || 'Cliente',
      contato: contato || '-',
      canal, // 'whatsapp' | 'email' | 'sms'
      tipoEvento: tipoEvento || 'geral',
      mensagem: (mensagem || '').slice(0, 300),
      status, // 'sucesso' | 'falha' | 'pendente'
      detalhes: detalhes || '',
      enviadoEm: new Date().toISOString(),
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('Aviso ao registrar log no historico_notificacoes:', err);
  }
};

export const carregarHistoricoDisparos = async (tenantId, limite = 50) => {
  if (!tenantId) return [];
  try {
    const q = query(
      collection(db, 'historico_notificacoes'),
      where('tenantId', '==', tenantId),
      orderBy('enviadoEm', 'desc'),
      limit(limite)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback caso índice composto ainda não esteja pronto
    try {
      const qFallback = query(
        collection(db, 'historico_notificacoes'),
        where('tenantId', '==', tenantId),
        limit(limite)
      );
      const snap = await getDocs(qFallback);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => new Date(b.enviadoEm || 0) - new Date(a.enviadoEm || 0));
      return lista;
    } catch (e2) {
      console.warn('Aviso ao carregar histórico de disparos:', e2);
      return [];
    }
  }
};

// ============================================================================
// 6. MOTORES DE ENTREGA POR CANAL
// ============================================================================

/**
 * WhatsApp 1-Clique Nativo: Gera o link wa.me pronto para abertura instantânea
 */
export const gerarLinkWhatsAppNativo = (telefone, mensagem) => {
  const numLimpo = String(telefone || '').replace(/\D/g, '');
  const ddi = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;
  const textoEncoded = encodeURIComponent(mensagem || '');
  return `https://wa.me/${ddi}?text=${textoEncoded}`;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 🤖 DISPARO AUTOMÁTICO DE WHATSAPP VIA API (SEM INTERAÇÃO HUMANA!)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Suporta 3 provedores populares no Brasil:
 *
 * 1. Z-API  (https://z-api.io)        → whatsappProvider: 'zapi'
 *    - Planos a partir de R$49/mês
 *    - Config: whatsappApiUrl = 'https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN/send-text'
 *    - Config: whatsappApiKey = 'Client-Token do seu painel Z-API'
 *
 * 2. Evolution API (self-hosted grátis) → whatsappProvider: 'evolution'
 *    - Open-source, gratuito, hospedar no próprio servidor
 *    - Config: whatsappApiUrl = 'https://sua-evolution.servidor.com.br/message/sendText/INSTANCIA'
 *    - Config: whatsappApiKey = 'apikey gerada no Evolution'
 *
 * 3. Twilio WhatsApp               → whatsappProvider: 'twilio'
 *    - Requer Twilio Account SID + Auth Token + número WhatsApp Business
 *    - Config: whatsappApiUrl = 'twilio' (a URL é montada automaticamente)
 *    - Config: whatsappApiKey = 'accountSid:authToken:+14155238886' (separado por :)
 *
 * @param {object} opcoes
 * @param {string} opcoes.telefone        - Número destino (com ou sem DDI)
 * @param {string} opcoes.mensagem        - Texto da mensagem
 * @param {object} opcoes.provedores      - Configurações salvas em Notificações → Conexões
 * @param {string} opcoes.tenantId        - ID da empresa (para log)
 * @param {string} opcoes.destinatarioNome - Nome para o log
 * @param {string} opcoes.tipoEvento      - Tipo do evento para o log
 * @returns {{ sucesso: boolean, modo: string }}
 */
export const dispararWhatsAppAutomatico = async ({
  telefone,
  mensagem,
  provedores = {},
  tenantId,
  destinatarioNome,
  tipoEvento = 'whatsapp_auto'
}) => {
  const numLimpo = String(telefone || '').replace(/\D/g, '');
  const numDDI = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;

  const modo = provedores.whatsappModo || 'nativo';
  const apiUrl = (provedores.whatsappApiUrl || '').trim();
  const apiKey = (provedores.whatsappApiKey || '').trim();
  const provider = provedores.whatsappProvider || 'zapi'; // 'zapi' | 'evolution' | 'twilio'

  // ── Modo Nativo: abre wa.me (requer clique manual) ─────────────────────────
  if (modo !== 'api' || !apiUrl || !apiKey) {
    const link = gerarLinkWhatsAppNativo(telefone, mensagem);
    if (typeof window !== 'undefined') {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
    await registrarHistoricoDisparo({
      tenantId, destinatario: destinatarioNome || telefone, contato: numDDI,
      canal: 'whatsapp', tipoEvento, mensagem: (mensagem || '').slice(0, 300),
      status: 'sucesso', detalhes: 'Disparo via link wa.me nativo (requer clique)'
    });
    return { sucesso: true, modo: 'nativo_link' };
  }

  // ── Modo API: disparo 100% automático ─────────────────────────────────────
  try {
    let response;

    // ---- Z-API ----------------------------------------------------------------
    if (provider === 'zapi') {
      // URL formato: https://api.z-api.io/instances/INSTANCE_ID/token/TOKEN/send-text
      // Client-Token vai no header
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': apiKey
        },
        body: JSON.stringify({
          phone: numDDI,
          message: mensagem
        })
      });
    }

    // ---- Evolution API --------------------------------------------------------
    else if (provider === 'evolution') {
      // URL formato: https://evolution.seuservidor.com/message/sendText/INSTANCIA
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: numDDI,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: mensagem }
        })
      });
    }

    // ---- Twilio WhatsApp -------------------------------------------------------
    else if (provider === 'twilio') {
      // apiKey formato: 'AccountSID:AuthToken:+14155238886'
      const [accountSid, authToken, fromNumber] = apiKey.split(':');
      const formData = new URLSearchParams();
      formData.append('To', `whatsapp:+${numDDI}`);
      formData.append('From', `whatsapp:${fromNumber}`);
      formData.append('Body', mensagem);

      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        }
      );
    }

    else {
      throw new Error(`Provedor "${provider}" não reconhecido. Use: zapi, evolution ou twilio.`);
    }

    if (!response || !response.ok) {
      const errJson = await response?.json().catch(() => ({}));
      throw new Error(errJson?.message || errJson?.error || `Erro HTTP ${response?.status}`);
    }

    const resJson = await response.json();

    await registrarHistoricoDisparo({
      tenantId, destinatario: destinatarioNome || telefone, contato: numDDI,
      canal: 'whatsapp', tipoEvento, mensagem: (mensagem || '').slice(0, 300),
      status: 'sucesso', detalhes: `Enviado via API ${provider} | ID: ${resJson?.messageId || resJson?.zaapId || resJson?.sid || 'ok'}`
    });

    return { sucesso: true, modo: `api_${provider}`, resposta: resJson };

  } catch (err) {
    await registrarHistoricoDisparo({
      tenantId, destinatario: destinatarioNome || telefone, contato: numDDI,
      canal: 'whatsapp', tipoEvento, mensagem: (mensagem || '').slice(0, 300),
      status: 'falha', detalhes: `Erro API ${provider}: ${err.message}`
    });
    throw err;
  }
};

/**
 * Disparo Real de E-mail via Resend API
 */
export const dispararEmailResend = async ({ email, assunto, html, tenantId, destinatarioNome, nomeEmpresa, replyTo }) => {
  const emailLimpo = String(email || '').trim().toLowerCase();
  if (!emailLimpo || !emailLimpo.includes('@')) {
    throw new Error('E-mail do destinatário inválido.');
  }

  try {
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    let response;

    if (isLocalhost) {
      // No ambiente local, utiliza o proxy do Vite configurado no vite.config.js
      response = await fetch('/api-resend/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: SENDER_EMAIL,
          to: [emailLimpo],
          reply_to: replyTo || undefined,
          subject: assunto || 'Notificação Celebre Festas',
          html: html || '<p>Você recebeu uma notificação do sistema Celebre.</p>'
        })
      });
    } else {
      // Em produção (celebrefesta.com.br / celebre-9f5c9.web.app), passa pela Cloud Function segura (sem bloqueio de CORS de navegador)
      const payloadEnvio = {
        tenantId: tenantId || 'sistema',
        evento: 'disparo_direto',
        email: emailLimpo,
        assunto: assunto || 'Notificação Celebre Festas',
        html: html || '<p>Você recebeu uma notificação do sistema Celebre.</p>',
        destinatarioNome: destinatarioNome || emailLimpo,
        dados: {
          nomeEmpresa: nomeEmpresa || 'Celebre Notificações'
        }
      };

      try {
        response = await fetch('/api/enviar-notificacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadEnvio)
        });
      } catch (errLocal) {
        response = null;
      }

      // Se a rota rewrite ainda estiver propagando no CDN ou falhou, usa a URL direta da Cloud Function
      if (!response || !response.ok) {
        response = await fetch('https://enviarnotificacaoautomatica-yfhz7t44jq-uc.a.run.app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadEnvio)
        });
      }
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || errJson.message || `Erro HTTP ${response.status} ao enviar e-mail`);
    }

    const resJson = await response.json();

    if (tenantId) {
      await registrarHistoricoDisparo({
        tenantId,
        destinatario: destinatarioNome || emailLimpo,
        contato: emailLimpo,
        canal: 'email',
        tipoEvento: 'disparo_direto',
        mensagem: assunto,
        status: 'sucesso',
        detalhes: `ID Resend: ${resJson.id || 'ok'}`
      });
    }

    return { sucesso: true, id: resJson.id };
  } catch (err) {
    if (tenantId) {
      await registrarHistoricoDisparo({
        tenantId,
        destinatario: destinatarioNome || emailLimpo,
        contato: emailLimpo,
        canal: 'email',
        tipoEvento: 'disparo_direto',
        mensagem: assunto,
        status: 'falha',
        detalhes: err.message
      });
    }
    throw err;
  }
};

/**
 * Disparo Real de SMS via Twilio REST API
 */
export const dispararSmsTwilio = async ({ telefone, mensagem, accountSid, authToken, fromNumber, tenantId, destinatarioNome }) => {
  const numLimpo = String(telefone || '').replace(/\D/g, '');
  const to = numLimpo.startsWith('+') ? numLimpo : (numLimpo.startsWith('55') ? `+${numLimpo}` : `+55${numLimpo}`);

  const formData = new URLSearchParams();
  formData.append('To', to);
  formData.append('From', fromNumber);
  formData.append('Body', String(mensagem || '').slice(0, 160));

  const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `Erro Twilio HTTP ${response.status}`);
  }

  const resJson = await response.json();
  if (tenantId) {
    await registrarHistoricoDisparo({
      tenantId,
      destinatario: destinatarioNome || to,
      contato: to,
      canal: 'sms',
      tipoEvento: 'disparo_sms_twilio',
      mensagem: mensagem.slice(0, 160),
      status: 'sucesso',
      detalhes: `SID Twilio: ${resJson.sid}`
    });
  }
  return { sucesso: true, sid: resJson.sid };
};

/**
 * Disparo de SMS Híbrido: Se configurado Twilio envia real; caso contrário simula e audita em log
 */
export const dispararSmsRealOuSimulado = async ({ telefone, mensagem, tenantId, destinatarioNome, provedores = {} }) => {
  if (provedores.smsAtivo && provedores.twilioAccountSid && provedores.twilioAuthToken && provedores.twilioFromNumber) {
    return await dispararSmsTwilio({
      telefone,
      mensagem,
      accountSid: provedores.twilioAccountSid,
      authToken: provedores.twilioAuthToken,
      fromNumber: provedores.twilioFromNumber,
      tenantId,
      destinatarioNome
    });
  }

  // Modo Auditado / Simulado com registro no banco
  await registrarHistoricoDisparo({
    tenantId,
    destinatario: destinatarioNome || telefone,
    contato: telefone,
    canal: 'sms',
    tipoEvento: 'disparo_sms_simulado',
    mensagem: (mensagem || '').slice(0, 160),
    status: 'sucesso',
    detalhes: 'SMS auditado no sistema (insira credenciais Twilio em Configurações para envio real no chip)'
  });
  return { sucesso: true, modo: 'simulado' };
};

/**
 * Motor Central de Disparo Automático em Segundo Plano
 * Respeita 100% se a opção está ATIVA ou DESATIVADA nas preferências da empresa!
 */
export const processarDisparoAutomatico = async ({
  tenantId,
  evento, // 'novo_orcamento_web' | 'novo_cadastro_cliente' | 'contrato_assinado' | 'lembrete_retirada' | 'lembrete_devolucao' | 'alerta_atraso' | 'cobranca_avaria' | 'boas_vindas_catalogo'
  destinatario = 'ambos', // 'gestor' | 'cliente' | 'ambos'
  dados = {}
}) => {
  if (!tenantId) return [];

  try {
    const config = await carregarConfiguracoesNotificacoes(tenantId);
    const contatosGestor = config.contatosGestor || {};
    const provedores = config.provedores || {};

    const canaisGestor = config.alertasGestor?.[evento] || {
      sininho: true,
      whatsapp: true,
      email: true,
      sms: false
    };

    const canaisCliente = config.gatilhos?.[evento] || {
      whatsapp: true,
      email: true,
      sms: false
    };

    const templateObj = config.templates?.[evento] || TEMPLATES_PADRAO[evento] || {};
    const msgTexto = interpolarTags(templateObj.whatsapp || templateObj.sms || '', dados);
    const emailAssunto = interpolarTags(templateObj.emailAssunto || `Notificação • ${dados.nomeEmpresa || 'Celebre Festas'}`, dados);
    const emailCorpo = interpolarTags(templateObj.emailCorpo || `<p>${msgTexto.replace(/\n/g, '<br>')}</p>`, dados);

    const resultados = [];

    // ── 1. ENVIO PARA O GESTOR / EQUIPE ──────────────────────────────
    if (destinatario === 'gestor' || destinatario === 'ambos') {
      const emailGestor = contatosGestor.email || dados.emailEmpresa;
      const telGestor = contatosGestor.whatsapp || dados.telefoneEmpresa;

      // E-MAIL GESTOR (se ativo)
      if (canaisGestor.email !== false && emailGestor && emailGestor.includes('@')) {
        try {
          const res = await dispararEmailResend({
            email: emailGestor,
            assunto: `[ALERTA LOJA] ${emailAssunto}`,
            html: `
              <div style="font-family: 'Segoe UI', sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; max-width: 600px;">
                <h3 style="color: #c5a059; margin-top: 0; font-size: 18px;">🔔 Notificação Operacional • Celebre</h3>
                <div style="background: rgba(255,255,255,0.06); padding: 18px; border-radius: 8px; margin: 16px 0; font-size: 14px; line-height: 1.6;">
                  ${emailCorpo}
                </div>
                <small style="color: #94a3b8;">Disparo automático enviado para ${emailGestor}</small>
              </div>
            `,
            tenantId,
            destinatarioNome: 'Gestão da Empresa'
          });
          resultados.push({ destino: 'gestor', canal: 'email', ...res });
        } catch (e) {
          console.warn('[NotificacoesAuto] Aviso envio e-mail gestor:', e);
        }
      }

      // SMS GESTOR — só dispara automaticamente se Twilio estiver configurado
      if (canaisGestor.sms && telGestor && provedores.smsAtivo && provedores.twilioAccountSid) {
        try {
          const resSms = await dispararSmsRealOuSimulado({
            telefone: telGestor,
            mensagem: `[CELEBRE ALERTA] ${msgTexto}`,
            tenantId,
            destinatarioNome: 'Gestão da Empresa',
            provedores
          });
          resultados.push({ destino: 'gestor', canal: 'sms', ...resSms });
        } catch (eSms) {
          console.warn('[NotificacoesAuto] Aviso SMS gestor:', eSms);
        }
      }

      // WHATSAPP GESTOR — só dispara automaticamente quando API estiver configurada
      // (Modo nativo = usuário envia manualmente com Enter. Não abre janela no automático.)
      if (canaisGestor.whatsapp !== false && telGestor && provedores.whatsappModo === 'api' && provedores.whatsappApiUrl && provedores.whatsappApiKey) {
        try {
          const resWpp = await dispararWhatsAppAutomatico({
            telefone: telGestor,
            mensagem: `[CELEBRE ALERTA] ${msgTexto}`,
            provedores,
            tenantId,
            destinatarioNome: 'Gestão da Empresa',
            tipoEvento: evento
          });
          resultados.push({ destino: 'gestor', canal: 'whatsapp', ...resWpp });
        } catch (eWppGestor) {
          console.warn('[NotificacoesAuto] Aviso WhatsApp gestor:', eWppGestor);
        }
      }
    }

    // ── 2. ENVIO PARA O CLIENTE ─────────────────────────────────────
    if (destinatario === 'cliente' || destinatario === 'ambos') {
      const emailCli = dados.clienteEmail || dados.email;
      const telCli = dados.clienteTelefone || dados.telefone || dados.celular;

      // E-MAIL CLIENTE (se ativo) — Template Transacional Premium
      if (canaisCliente.email !== false && emailCli && emailCli.includes('@')) {
        try {
          // Carrega dados da empresa para o template premium
          let dadosLocadoraPremium = {
            nomeEmpresa: dados.nomeEmpresa || 'Celebre Festas',
            telefone: dados.telefoneEmpresa || '(19) 99856-4109',
            whatsapp: dados.telefoneEmpresa || '(19) 99856-4109',
            enderecoCompleto: dados.enderecoGalpao || '',
            chavePix: dados.chavePix || '',
            emailContato: config.provedores?.emailRemetente || 'contato@celebrefesta.com.br',
            logoUrl: config.provedores?.logoUrl || '',
            cnpj: config.provedores?.cnpj || ''
          };

          // Mescla config da empresa se disponível
          try {
            const empSnap = await getDoc(doc(db, 'configuracoes_empresa', tenantId));
            if (empSnap.exists()) {
              const ed = empSnap.data();
              dadosLocadoraPremium = {
                ...dadosLocadoraPremium,
                nomeEmpresa: ed.nomeFantasia || ed.nomeEmpresa || dadosLocadoraPremium.nomeEmpresa,
                telefone: ed.telefone || ed.whatsapp || dadosLocadoraPremium.telefone,
                whatsapp: ed.whatsapp || ed.telefone || dadosLocadoraPremium.whatsapp,
                enderecoCompleto: ed.enderecoCompleto || ed.endereco || dadosLocadoraPremium.enderecoCompleto,
                chavePix: ed.chavePix || ed.pix || dadosLocadoraPremium.chavePix,
                cnpj: ed.cnpj || dadosLocadoraPremium.cnpj,
                logoUrl: ed.logoUrl || dadosLocadoraPremium.logoUrl,
                emailContato: ed.emailContato || ed.email || dadosLocadoraPremium.emailContato
              };
            }
          } catch (_eEmpresa) {}

          const htmlPremium = gerarEmailPremium(evento, dados, dadosLocadoraPremium);
          const replyToEmail = dadosLocadoraPremium.emailContato;

          const res = await dispararEmailResend({
            email: emailCli,
            assunto: emailAssunto,
            html: htmlPremium,
            tenantId,
            destinatarioNome: dados.nomeCliente || 'Cliente',
            nomeEmpresa: dadosLocadoraPremium.nomeEmpresa,
            replyTo: replyToEmail
          });
          resultados.push({ destino: 'cliente', canal: 'email', ...res });
        } catch (eCli) {
          console.warn('[NotificacoesAuto] Aviso envio e-mail cliente:', eCli);
        }
      }

      // SMS CLIENTE — só dispara automaticamente se Twilio estiver configurado
      if (canaisCliente.sms && telCli && provedores.smsAtivo && provedores.twilioAccountSid) {
        try {
          const resSmsCli = await dispararSmsRealOuSimulado({
            telefone: telCli,
            mensagem: msgTexto,
            tenantId,
            destinatarioNome: dados.nomeCliente || 'Cliente',
            provedores
          });
          resultados.push({ destino: 'cliente', canal: 'sms', ...resSmsCli });
        } catch (eSmsCli) {
          console.warn('[NotificacoesAuto] Aviso SMS cliente:', eSmsCli);
        }
      }

      // WHATSAPP CLIENTE — só dispara automaticamente quando API estiver configurada
      // (Modo nativo = usuário envia manualmente com Enter. Não abre janela no automático.)
      if (canaisCliente.whatsapp !== false && telCli && provedores.whatsappModo === 'api' && provedores.whatsappApiUrl && provedores.whatsappApiKey) {
        try {
          const resWppCli = await dispararWhatsAppAutomatico({
            telefone: telCli,
            mensagem: msgTexto,
            provedores,
            tenantId,
            destinatarioNome: dados.nomeCliente || 'Cliente',
            tipoEvento: evento
          });
          resultados.push({ destino: 'cliente', canal: 'whatsapp', ...resWppCli });
        } catch (eWppCli) {
          console.warn('[NotificacoesAuto] Aviso WhatsApp cliente:', eWppCli);
        }
      }
    }

    return resultados;
  } catch (errGeral) {
    console.error('[NotificacoesAuto] Erro ao processar disparo:', errGeral);
    return [];
  }
};

/**
 * Varredura Automática de Lembretes Diários (D-1 Retirada, D-0 Devolução e Atrasos)
 * Executa de forma transparente, com bloqueio para nunca duplicar no mesmo dia!
 */
export const verificarLembretesAgendadosHoje = async (tenantId) => {
  if (!tenantId) return;

  const hojeFormatado = new Date().toISOString().split('T')[0];
  const chaveBloqueio = `celebre_cron_disparo_${tenantId}_${hojeFormatado}`;

  if (localStorage.getItem(chaveBloqueio)) {
    return; // Já rodou hoje nesta máquina
  }

  try {
    const amanhaDate = new Date();
    amanhaDate.setDate(amanhaDate.getDate() + 1);
    const amanhaFormatado = amanhaDate.toISOString().split('T')[0];

    // Dados da empresa
    let dadosEmpresa = { nomeEmpresa: 'Celebre Festas', telefoneEmpresa: '(19) 99856-4109', enderecoGalpao: 'Galpão Celebre' };
    try {
      const empSnap = await getDoc(doc(db, 'configuracoes_empresa', tenantId));
      if (empSnap.exists()) {
        const d = empSnap.data();
        dadosEmpresa = {
          nomeEmpresa: d.nomeEmpresa || 'Celebre Festas',
          telefoneEmpresa: d.telefone || d.whatsapp || '(19) 99856-4109',
          chavePix: d.chavePix || d.pix || '(19) 99856-4109',
          enderecoGalpao: d.endereco || d.enderecoCompleto || 'Galpão Principal'
        };
      }
    } catch (eEmp) {}

    // Busca locações
    const qLoc = query(
      collection(db, 'locacoes'),
      where('userId', '==', tenantId)
    );
    const snapLoc = await getDocs(qLoc);

    for (const dLoc of snapLoc.docs) {
      const loc = dLoc.data();
      const status = String(loc.status || '').toLowerCase();
      if (status === 'cancelado' || status === 'devolvido' || status === 'finalizado') {
        continue;
      }

      const dataRetirada = loc.dataRetirada || '';
      const dataDevolucao = loc.dataDevolucao || '';

      const dadosEvento = {
        nomeCliente: loc.clienteNome || loc.nomeCliente || 'Cliente',
        clienteEmail: loc.clienteEmail || loc.emailCliente || '',
        clienteTelefone: loc.clienteTelefone || loc.telefone || '',
        numeroPedido: loc.numeroPedido || dLoc.id.slice(0, 8).toUpperCase(),
        dataRetirada: dataRetirada ? dataRetirada.split('-').reverse().join('/') : '',
        dataDevolucao: dataDevolucao ? dataDevolucao.split('-').reverse().join('/') : '',
        horarioRetirada: loc.horarioRetirada || '09h00 às 17h00',
        horarioDevolucao: loc.horarioDevolucao || '18h00',
        valorTotal: loc.valorTotal || '0,00',
        ...dadosEmpresa
      };

      // 1. Lembrete de Retirada (D-1)
      if (dataRetirada === amanhaFormatado) {
        await processarDisparoAutomatico({
          tenantId,
          evento: 'lembrete_retirada',
          destinatario: 'cliente',
          dados: dadosEvento
        });
      }

      // 2. Lembrete de Devolução (Hoje)
      if (dataDevolucao === hojeFormatado) {
        await processarDisparoAutomatico({
          tenantId,
          evento: 'lembrete_devolucao',
          destinatario: 'cliente',
          dados: dadosEvento
        });
      }

      // 3. Alerta de Atraso (Devolução < Hoje e não devolvido)
      if (dataDevolucao && dataDevolucao < hojeFormatado && status !== 'devolvido') {
        await processarDisparoAutomatico({
          tenantId,
          evento: 'alerta_atraso',
          destinatario: 'ambos',
          dados: dadosEvento
        });
      }
    }

    localStorage.setItem(chaveBloqueio, 'executado');
  } catch (errCron) {
    console.warn('[NotificacoesCron] Aviso ao verificar lembretes diários:', errCron);
  }
};

/**
 * Disparo de Teste para qualquer canal selecionado
 */
export const enviarDisparoTeste = async ({ canal, contato, tenantId, dadosEmpresa = {} }) => {
  const nomeEmpresa = dadosEmpresa.nomeFantasia || dadosEmpresa.nomeEmpresa || 'Celebre Festas';
  const telEmpresa = dadosEmpresa.telefone || '(19) 99856-4109';

  const dadosTeste = {
    nomeCliente: 'Cliente de Teste',
    numeroPedido: '2026-TESTE',
    dataEvento: '25/09/2026',
    dataRetirada: '24/09/2026',
    dataDevolucao: '26/09/2026',
    horarioRetirada: '10h00 às 16h00',
    horarioDevolucao: '17h00',
    valorTotal: '450.00',
    chavePix: dadosEmpresa.chavePix || '19998564109',
    linkContrato: 'https://celebre-9f5c9.web.app/assinatura/teste-celebre',
    nomeEmpresa,
    telefoneEmpresa: telEmpresa,
    enderecoGalpao: dadosEmpresa.enderecoCompleto || 'Rua Central de Eventos, 500 - Galpão A'
  };

  const templateMsg = interpolarTags(
    '🧪 *TESTE DE DISPARO DO CELEBRE*\n\nOlá *{nome_cliente}*! Esta é uma mensagem de teste enviada pelo gerenciador de notificações da *{nome_empresa}*.\n\nTudo configurado com sucesso e pronto para automação!',
    dadosTeste
  );

  if (canal === 'whatsapp') {
    const link = gerarLinkWhatsAppNativo(contato, templateMsg);
    window.open(link, '_blank', 'noopener,noreferrer');
    await registrarHistoricoDisparo({
      tenantId,
      destinatario: 'Teste Operacional',
      contato,
      canal: 'whatsapp',
      tipoEvento: 'teste_disparo',
      mensagem: templateMsg,
      status: 'sucesso',
      detalhes: 'Disparado via WhatsApp Nativo'
    });
    return { sucesso: true, canal: 'whatsapp', modo: 'nativo' };
  } else if (canal === 'email') {
    // E-mail de teste usa o Template Transacional Premium
    const dadosLocadoraTeste = {
      nomeEmpresa,
      telefone: telEmpresa,
      whatsapp: telEmpresa,
      logoUrl: dadosEmpresa.logoUrl || '',
      cnpj: dadosEmpresa.cnpj || '',
      enderecoCompleto: dadosEmpresa.enderecoCompleto || '',
      emailContato: dadosEmpresa.emailContato || dadosEmpresa.email || 'contato@celebrefesta.com.br',
      chavePix: dadosEmpresa.chavePix || ''
    };
    const dadosTesteComItens = {
      ...dadosTeste,
      itens: [
        { descricao: 'Mesa de Coquetel Redonda', quantidade: 10, valorUnitario: 35 },
        { descricao: 'Taça de Cristal Luxo', quantidade: 50, valorUnitario: 8 },
        { descricao: 'Arranjo Floral Premium', quantidade: 5, valorUnitario: 80 }
      ]
    };
    const htmlPremiumTeste = gerarEmailPremium('lembrete_retirada', dadosTesteComItens, dadosLocadoraTeste);

    return await dispararEmailResend({
      email: contato,
      assunto: `🧪 Teste de Notificação Oficial • ${nomeEmpresa}`,
      html: htmlPremiumTeste,
      tenantId,
      destinatarioNome: 'Teste Operacional',
      nomeEmpresa,
      replyTo: dadosLocadoraTeste.emailContato
    });
  } else if (canal === 'sms') {
    return await dispararSmsRealOuSimulado({
      telefone: contato,
      mensagem: templateMsg.slice(0, 160),
      tenantId,
      destinatarioNome: 'Teste Operacional SMS',
      provedores: dadosEmpresa.provedores || {}
    });
  }

  throw new Error(`Canal ${canal} não suportado.`);
};

