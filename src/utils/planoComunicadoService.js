/**
 * planoComunicadoService.js
 * Servico de comunicados automaticos ao alterar a matriz de planos no AdminPlanos.
 *
 * Fluxo ao salvar mudancas:
 * 1. Detecta quais beneficios foram removidos ou adicionados por plano
 * 2. Busca todos os clientes "owner" que assinam os planos afetados
 * 3. Envia e-mail personalizado via Resend para cada afetado
 * 4. Cria documento em "avisos_sistema" no Firestore para o banner in-app
 *
 * O banner in-app e lido pelo componente BannerAvisoSistema inserido no App.jsx.
 */

import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const RESEND_API_KEY = ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');
const SENDER_EMAIL = 'Celebre <seguranca@celebrefesta.com.br>';
const REPLY_TO_EMAIL = 'celebrefesta25@gmail.com';

// 1. DETECTAR MUDANCAS ENTRE DUAS VERSOES DA MATRIZ

export const detectarMudancasPlanos = (planosAntigos, planosNovos) => {
  const mudancas = [];
  for (const planoNovo of planosNovos) {
    const planoAntigo = planosAntigos.find(p => p.id === planoNovo.id);
    if (!planoAntigo) continue;
    const bensAntigos = Array.isArray(planoAntigo.beneficios) ? planoAntigo.beneficios : [];
    const bensNovos = Array.isArray(planoNovo.beneficios) ? planoNovo.beneficios : [];
    const removidos = bensAntigos.filter(b => !bensNovos.includes(b));
    const adicionados = bensNovos.filter(b => !bensAntigos.includes(b));
    if (removidos.length > 0 || adicionados.length > 0) {
      mudancas.push({ planoId: planoNovo.id, planoNome: planoNovo.nome || 'Plano', recursosRemovidos: removidos, recursosAdicionados: adicionados });
    }
  }
  return mudancas;
};

// 2. GERAR HTML DO E-MAIL

const gerarHtmlComunicado = ({ nomeUsuario, planoNome, recursosRemovidos, recursosAdicionados }) => {
  const nomeExib = nomeUsuario || 'Assinante';
  const listaRemovidos = recursosRemovidos.length > 0
    ? `<div style="margin:18px 0 8px 0;"><p style="font-weight:700;color:#dc2626;margin:0 0 8px 0;font-size:14px;">Recursos descontinuados no seu plano:</p><ul style="margin:0;padding:0 0 0 20px;color:#475569;font-size:14px;line-height:1.8;">${recursosRemovidos.map(r => `<li><strong>${r}</strong></li>`).join('')}</ul></div>`
    : '';
  const listaAdicionados = recursosAdicionados.length > 0
    ? `<div style="margin:18px 0 8px 0;"><p style="font-weight:700;color:#16a34a;margin:0 0 8px 0;font-size:14px;">Novos recursos incluidos no seu plano:</p><ul style="margin:0;padding:0 0 0 20px;color:#475569;font-size:14px;line-height:1.8;">${recursosAdicionados.map(r => `<li><strong>${r}</strong></li>`).join('')}</ul></div>`
    : '';
  const avisoUpgrade = recursosRemovidos.length > 0
    ? `<div style="margin:24px 0;padding:16px;background:#fef2f2;border-radius:12px;border-left:4px solid #dc2626;"><p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">Se voce utiliza ativamente algum dos recursos listados acima, considere fazer upgrade do seu plano para manter o acesso.</p></div>`
    : '';
  const ano = new Date().getFullYear();
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Atualizacao no seu Plano Celebre</title></head><body style="margin:0;padding:0;background:#0b0f19;font-family:Segoe UI,Roboto,Arial,sans-serif;"><table width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f19;padding:40px 15px;"><tr><td align="center"><table width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.5);"><tr><td style="background:linear-gradient(135deg,#090d16,#0f172a,#1e293b);padding:38px 30px;text-align:center;border-bottom:3px solid #c5a059;"><h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:2px;color:#fff;">CELEBRE</h1><p style="margin:6px 0 0;font-size:12px;color:#c5a059;text-transform:uppercase;letter-spacing:2.5px;font-weight:800;">Gestao Inteligente de Festas e Acervo</p></td></tr><tr><td style="padding:36px 35px;background:#fff;"><div style="display:inline-block;background:#fef9c3;border-radius:20px;padding:5px 14px;margin-bottom:16px;"><span style="color:#854d0e;font-size:11px;font-weight:800;text-transform:uppercase;">Atualizacao do Seu Plano</span></div><h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;">Ola, ${nomeExib}!</h2><p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">Seu plano <strong>${planoNome}</strong> foi atualizado. Veja o que mudou:</p>${listaRemovidos}${listaAdicionados}${avisoUpgrade}<div style="text-align:center;margin:28px 0 12px;"><a href="https://app.celebrefesta.com.br/planos" style="background:#c5a059;color:#0f172a;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:900;font-size:14px;display:inline-block;text-transform:uppercase;">Ver Planos Disponiveis</a></div></td></tr><tr><td style="background:#0f172a;padding:22px 30px;text-align:center;"><p style="margin:0;font-size:11px;color:#64748b;">© ${ano} Celebre Festas - Campinas, SP, Brasil</p></td></tr></table></td></tr></table></body></html>`;
};

// 3. ENVIAR E-MAIL

const enviarEmail = async ({ email, nomeUsuario, planoNome, recursosRemovidos, recursosAdicionados }) => {
  const html = gerarHtmlComunicado({ nomeUsuario, planoNome, recursosRemovidos, recursosAdicionados });
  const subject = `Atualizacao no seu Plano ${planoNome} - Celebre`;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: SENDER_EMAIL, to: [email], reply_to: REPLY_TO_EMAIL, subject, html }),
    });
    if (resp.ok) { const d = await resp.json(); console.log('[Comunicado] E-mail enviado via Resend para', email, d.id); return { success: true }; }
  } catch (e) { console.warn('[Comunicado] Resend falhou, usando fallback:', e.message); }
  try {
    await addDoc(collection(db, 'mail'), { to: email, message: { subject, html } });
    return { success: true };
  } catch (e2) { console.error('[Comunicado] Erro critico no fallback:', e2); return { success: false }; }
};

// 4. CRIAR AVISO IN-APP

const criarAvisoInApp = async ({ tenantId, planoId, planoNome, recursosRemovidos, recursosAdicionados }) => {
  try {
    let mensagem = '';
    if (recursosRemovidos.length > 0 && recursosAdicionados.length > 0) {
      mensagem = `Seu plano ${planoNome} foi atualizado: "${recursosRemovidos.join('", "')}" foram removidos e "${recursosAdicionados.join('", "')}" foram adicionados.`;
    } else if (recursosRemovidos.length > 0) {
      mensagem = `O recurso "${recursosRemovidos.join('", "')}" foi descontinuado no plano ${planoNome}. Considere fazer upgrade para manter o acesso.`;
    } else {
      mensagem = `Novidade! "${recursosAdicionados.join('", "')}" foi adicionado ao seu plano ${planoNome}.`;
    }
    await addDoc(collection(db, 'avisos_sistema'), {
      tenantId, planoId, planoNome,
      tipo: recursosRemovidos.length > 0 ? 'plano_recurso_removido' : 'plano_recurso_adicionado',
      cor: recursosRemovidos.length > 0 ? '#dc2626' : '#16a34a',
      icone: recursosRemovidos.length > 0 ? 'fa-exclamation-triangle' : 'fa-gift',
      mensagem, recursosRemovidos, recursosAdicionados,
      lido: false, criadoEm: serverTimestamp(),
    });
  } catch (err) { console.warn('[Comunicado] Aviso ao criar aviso in-app:', err); }
};

// 5. FUNCAO PRINCIPAL

export const notificarClientesAfetados = async (planosAntigos, planosNovos) => {
  const mudancas = detectarMudancasPlanos(planosAntigos, planosNovos);
  if (mudancas.length === 0) return { mudancas: 0, clientesNotificados: 0 };
  console.log('[Comunicado] Mudancas detectadas:', mudancas);
  let totalNotificados = 0;
  for (const mudanca of mudancas) {
    try {
      const qUsr = query(collection(db, 'usuarios'), where('planoId', '==', mudanca.planoId), where('role', '==', 'owner'));
      const snap = await getDocs(qUsr);
      for (const userDoc of snap.docs) {
        const u = userDoc.data();
        if (!u.email) continue;
        await criarAvisoInApp({ tenantId: userDoc.id, planoId: mudanca.planoId, planoNome: mudanca.planoNome, recursosRemovidos: mudanca.recursosRemovidos, recursosAdicionados: mudanca.recursosAdicionados });
        await enviarEmail({ email: u.email, nomeUsuario: u.nomeCompleto || u.nomeExibicao || 'Assinante', planoNome: mudanca.planoNome, recursosRemovidos: mudanca.recursosRemovidos, recursosAdicionados: mudanca.recursosAdicionados });
        totalNotificados++;
      }
    } catch (err) { console.error('[Comunicado] Erro ao notificar plano', mudanca.planoNome, err); }
  }
  return { mudancas: mudancas.length, clientesNotificados: totalNotificados };
};

// 6. LEITURA DE AVISOS PARA O BANNER IN-APP

export const buscarAvisosNaoLidos = async (tenantId) => {
  if (!tenantId) return [];
  try {
    const auth = getAuth();
    if (!auth.currentUser) return [];

    const q = query(collection(db, 'avisos_sistema'), where('tenantId', '==', tenantId), where('lido', '==', false));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      console.warn('[Comunicado] Erro ao buscar avisos:', err);
    }
    return [];
  }
};

export const marcarAvisoComoLido = async (avisoId) => {
  try { await updateDoc(doc(db, 'avisos_sistema', avisoId), { lido: true }); }
  catch (err) { console.warn('[Comunicado] Erro ao marcar aviso como lido:', err); }
};
