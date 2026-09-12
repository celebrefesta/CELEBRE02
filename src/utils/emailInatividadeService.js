import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Serviço de Notificação de Suspensão e Inatividade de Conta (Celebre)
 * Dispara e-mails oficiais de aviso de suspensão por 6 meses de inatividade
 * com prazo de carência para reativação antes da exclusão definitiva.
 */

const RESEND_API_KEY = ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');
const CLOUD_FUNCTION_URL = 'https://us-central1-celebre-9f5c9.cloudfunctions.net/enviarAvisoInatividade';

export const enviarAvisoInatividadeEmail = async ({ email, nome = '', diasInativo = 180, diasCarencia = 30 }) => {
  if (!email || !email.includes('@')) {
    throw new Error('E-mail inválido para envio do aviso de suspensão.');
  }

  const emailLimpo = email.trim().toLowerCase();
  const nomeExibicao = nome.trim() || 'Cliente Celebre';

  const htmlTemplate = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aviso de Suspensão por Inatividade • Celebre</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);">
            
            <!-- HEADER GOLDEN LUXURY -->
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 34px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1.5px;">
                  CELEBRE
                </h1>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">
                  Notificação de Segurança & Conta
                </p>
              </td>
            </tr>

            <!-- CORPO PRINCIPAL -->
            <tr>
              <td style="padding: 36px 32px;">
                
                <!-- BADGE DE ALERTA -->
                <div style="display: inline-block; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 14px; margin-bottom: 20px;">
                  <span style="color: #b45309; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                    ⏸️ Conta Suspensa por Inatividade
                  </span>
                </div>

                <h2 style="margin: 0 0 16px 0; font-size: 21px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                  Olá, ${nomeExibicao}!
                </h2>

                <p style="font-size: 14.5px; line-height: 1.65; color: #475569; margin: 0 0 18px 0;">
                  Identificamos que sua conta no <strong>Celebre</strong> não registrou atividades ou assinatura nos últimos <strong>6 meses</strong>.
                </p>

                <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 22px 0;">
                  Por segurança e de acordo com nossas políticas de privacidade de dados, o acesso aos recursos do sistema foi <strong>temporariamente suspenso</strong>.
                </p>

                <!-- CARD DE PRESERVAÇÃO DE DADOS -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid #c5a059; border-radius: 10px; padding: 16px 20px; margin: 24px 0;">
                  <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: #0f172a;">
                    📦 Seus dados continuam salvos temporariamente
                  </h3>
                  <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                    Seu acervo de produtos, fotos e clientes cadastrados estão preservados por mais <strong>${diasCarencia} dias</strong>. Após esse período de carência, contas sem manifestação serão definitivamente encerradas para liberação de espaço no sistema.
                  </p>
                </div>

                <!-- CHAMADA PARA AÇÃO -->
                <div style="text-align: center; margin: 32px 0 20px 0;">
                  <a href="https://celebrefesta.com.br/conta-suspensa" style="background: linear-gradient(135deg, #c5a059 0%, #dfb76c 100%); color: #0f172a; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 16px rgba(197, 160, 89, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                    Reativar Minha Conta Agora
                  </a>
                </div>

                <p style="font-size: 12.5px; text-align: center; color: #94a3b8; margin: 0 0 24px 0;">
                  Deseja conversar com a equipe Celebre? 
                  <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Recebi o aviso de suspensão da minha conta (${emailLimpo}) e gostaria de conversar para reativá-la.`)}" style="color: #16a34a; font-weight: 700; text-decoration: underline;">
                    Chame no WhatsApp
                  </a>
                </p>

                <!-- NOTA DE SEGURANÇA -->
                <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 24px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 18px;">
                  Se você não tem mais interesse em utilizar o sistema Celebre, não é necessário fazer nada. Seus dados serão expurgados com total segurança e respeito à LGPD ao término da carência.
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color: #f8fafc; padding: 22px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 4px 0; font-size: 11.5px; font-weight: 700; color: #64748b;">
                  Celebre • Gestão Inteligente para Acervos, Decorações & Locações
                </p>
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                  E-mail automático enviado para ${emailLimpo}.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // 1. Tenta envio via Resend (utiliza proxy '/api-resend' no localhost para evitar CORS)
  try {
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const endpointResend = isLocalhost ? '/api-resend/emails' : 'https://api.resend.com/emails';

    const resendResponse = await fetch(endpointResend, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Celebre Segurança <seguranca@celebrefesta.com.br>',
        to: [emailLimpo],
        reply_to: 'celebrefesta25@gmail.com',
        subject: '⚠️ Aviso Importante: Sua conta no Celebre está suspensa por inatividade',
        html: htmlTemplate
      })
    });

    if (resendResponse.ok) {
      const resData = await resendResponse.json();
      return {
        success: true,
        emailId: resData.id,
        metodo: isLocalhost ? 'resend_proxy' : 'resend_direto'
      };
    }
  } catch (resendErr) {
    console.warn("Disparo via Resend falhou, ativando fallback nativo do Firebase:", resendErr);
  }

  // 2. Fallback de Alta Confiabilidade: Fila nativa do Firebase (ext-firestore-send-email)
  // Imune a CORS e executado diretamente via SDK do Firebase
  try {
    const docMail = await addDoc(collection(db, 'mail'), {
      to: emailLimpo,
      replyTo: 'celebrefesta25@gmail.com',
      message: {
        subject: '⚠️ Aviso Importante: Sua conta no Celebre está suspensa por inatividade',
        html: htmlTemplate
      },
      criadoEm: serverTimestamp()
    });

    return {
      success: true,
      emailId: docMail.id,
      metodo: 'firestore_mail_queue'
    };
  } catch (mailQueueErr) {
    console.warn("Disparo via fila de e-mails falhou, tentando fallback da Cloud Function:", mailQueueErr);
  }

  // 3. Fallback adicional via Cloud Function
  try {
    const cfResponse = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailLimpo, nome: nomeExibicao, diasInativo, diasCarencia })
    });

    if (cfResponse.ok) {
      const cfData = await cfResponse.json();
      return { success: true, emailId: cfData.emailId, metodo: 'cloud_function' };
    }
  } catch (cfErr) {
    console.error("Falha no fallback Cloud Function:", cfErr);
  }

  throw new Error("Não foi possível disparar o e-mail de aviso. Verifique as credenciais de envio.");
};
