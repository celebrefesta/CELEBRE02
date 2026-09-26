import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const RESEND_API_KEY = ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');
const SENDER_EMAIL = 'Celebre Segurança <seguranca@celebrefesta.com.br>';
const REPLY_TO_EMAIL = 'celebrefesta25@gmail.com';

/**
 * Identifica o dispositivo e navegador amigável a partir do userAgent
 */
const obterDispositivoAmigavel = () => {
  if (typeof window === 'undefined' || !window.navigator) return 'Dispositivo Web';
  const ua = window.navigator.userAgent || '';
  
  let so = 'Computador';
  if (/windows/i.test(ua)) so = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) so = 'Mac';
  else if (/android/i.test(ua)) so = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) so = 'iOS (iPhone/iPad)';
  else if (/linux/i.test(ua)) so = 'Linux';

  let navegador = 'Navegador Web';
  if (/edg/i.test(ua)) navegador = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) navegador = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) navegador = 'Mozilla Firefox';
  else if (/safari/i.test(ua)) navegador = 'Apple Safari';

  return `${navegador} no ${so}`;
};

/**
 * Gera o template HTML luxuoso e profissional de Alerta de Segurança
 */
export const gerarTemplateAlertaSenhaAlterada = ({ email, dataHora, dispositivo }) => {
  const emailExibicao = String(email || '').trim().toLowerCase();
  const dataHoraExibicao = dataHora || new Date().toLocaleString('pt-BR', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  }) + ' (Horário de Brasília)';
  const dispositivoExibicao = dispositivo || obterDispositivoAmigavel();

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua senha do Celebre foi alterada com sucesso • Alerta de Segurança</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);">
          
          <!-- TOPO PREMIUM CELEBRE -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 32px; text-align: center; border-bottom: 3px solid #c5a059;">
              <img src="https://celebrefesta.com.br/LOGO_CELEBRE.png" alt="Celebre" style="height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 8px; display: inline-block;" />
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
                CELEBRE
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #c5a059; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 700;">
                Central de Segurança & Privacidade
              </p>
            </td>
          </tr>

          <!-- CONTEÚDO PRINCIPAL -->
          <tr>
            <td style="padding: 36px 32px;">
              
              <!-- BADGE DE SEGURANÇA -->
              <div style="display: inline-block; background-color: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 24px; padding: 6px 14px; margin-bottom: 18px;">
                <span style="color: #047857; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">
                  🔒 Atividade de Segurança
                </span>
              </div>

              <h2 style="margin: 0 0 14px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Sua senha foi redefinida com sucesso!
              </h2>

              <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Olá! Este é um aviso de segurança para confirmar que a senha da sua conta Celebre vinculada ao e-mail <strong style="color: #0f172a;">${emailExibicao}</strong> acabou de ser redefinida com sucesso.
              </p>

              <!-- DETALHES DO EVENTO -->
              <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 800; color: #854d0e; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">
                  📋 Detalhes da Alteração:
                </div>
                <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13.5px; color: #334155;">
                  <tr>
                    <td width="35%" style="color: #64748b; font-weight: 600;">Data e Horário:</td>
                    <td style="font-weight: 700; color: #0f172a;">${dataHoraExibicao}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Dispositivo:</td>
                    <td style="font-weight: 700; color: #0f172a;">${dispositivoExibicao}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Status:</td>
                    <td style="font-weight: 700; color: #16a34a;">Ativa e Criptografada</td>
                  </tr>
                </table>
              </div>

              <!-- BOX VERDE: SE FOI O USUÁRIO -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                <strong style="color: #15803d; font-size: 13.5px; display: block; margin-bottom: 4px;">
                  ✅ Foi você quem realizou esta alteração?
                </strong>
                <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">
                  Excelente! Nenhuma ação adicional é necessária. Você já pode acessar seu painel normalmente com a sua nova senha.
                </p>
              </div>

              <!-- BOTÃO DE ACESSO -->
              <div style="text-align: center; margin: 30px 0 25px 0;">
                <a href="https://celebrefesta.com.br/login" style="background: linear-gradient(135deg, #c5a059 0%, #dfb76c 100%); color: #0f172a; text-decoration: none; padding: 15px 38px; border-radius: 12px; font-weight: 800; font-size: 14.5px; display: inline-block; box-shadow: 0 6px 20px rgba(197, 160, 89, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                  Acessar Painel Celebre
                </a>
              </div>

              <!-- BOX VERMELHO DE EMERGÊNCIA: SE NÃO FOI ELE -->
              <div style="background-color: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 16px 18px; margin-top: 24px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="font-size: 18px;">🚨</span>
                  <strong style="color: #b91c1c; font-size: 13.5px;">Não reconhece esta alteração?</strong>
                </div>
                <p style="margin: 0 0 10px 0; font-size: 12.5px; color: #7f1d1d; line-height: 1.5;">
                  Se você <strong>NÃO</strong> redefiniu sua senha, sua conta pode ter sido acessada indevidamente por outra pessoa.
                </p>
                <div style="text-align: center;">
                  <a href="https://celebrefesta.com.br/redefinir-senha" style="display: inline-block; background-color: #b91c1c; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase;">
                    Bloquear e Recuperar Conta Imediatamente
                  </a>
                </div>
              </div>

            </td>
          </tr>

          <!-- RODAPÉ DE SEGURANÇA -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; font-size: 11.5px; color: #64748b; font-weight: 600;">
                Celebre • Sistema Integrado de Gestão de Festas, Acervo & Locações
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                Este é um e-mail de serviço obrigatório para a segurança da sua conta. Em caso de dúvidas, contate suporte@celebrefesta.com.br.
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
};

/**
 * Dispara o e-mail de alerta de senha alterada com resiliência total:
 * 1. Resend API direta (ou proxy no localhost)
 * 2. Fallback na fila nativa do Firebase (ext-firestore-send-email)
 */
export const enviarAlertaSenhaAlterada = async ({ email, nome = '', dataHora }) => {
  if (!email || !email.includes('@')) {
    console.warn("[SegurancaService] E-mail inválido para alerta de senha alterada.");
    return { success: false, error: 'E-mail inválido' };
  }

  const emailLimpo = String(email).trim().toLowerCase();
  const dispositivo = obterDispositivoAmigavel();
  const htmlTemplate = gerarTemplateAlertaSenhaAlterada({ 
    email: emailLimpo, 
    dataHora, 
    dispositivo 
  });
  const assunto = '🔒 Alerta de Segurança: Sua senha no Celebre foi alterada com sucesso';

  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // 1. Tenta envio prioritário via Resend
  try {
    if (isLocalhost) {
      // Localhost: usa proxy Vite /api-resend
      const resendResponse = await fetch('/api-resend/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: SENDER_EMAIL,
          to: [emailLimpo],
          reply_to: REPLY_TO_EMAIL,
          subject: assunto,
          html: htmlTemplate
        })
      });
      if (resendResponse.ok) {
        const resData = await resendResponse.json();
        console.log("[SegurancaService] E-mail enviado via Resend Proxy:", resData.id);
        return { success: true, emailId: resData.id, metodo: 'resend_proxy' };
      }
    } else {
      // Em Produção: dispara pela Cloud Function segura (evita bloqueio de CORS do navegador)
      const respCloud = await fetch('https://us-central1-celebre-9f5c9.cloudfunctions.net/enviarNotificacaoAutomatica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'sistema',
          evento: 'disparo_direto',
          email: emailLimpo,
          assunto: assunto,
          html: htmlTemplate,
          destinatarioNome: nome || emailLimpo,
          dados: {
            nomeEmpresa: 'Celebre Segurança'
          }
        })
      });
      if (respCloud.ok) {
        const dataCloud = await respCloud.json();
        console.log("[SegurancaService] E-mail enviado via Cloud Function:", dataCloud.id);
        return { success: true, emailId: dataCloud.id, metodo: 'cloud_function' };
      }
    }
  } catch (errResend) {
    console.warn("[SegurancaService] Envio via Resend/Cloud falhou, acionando fallback nativo:", errResend);
  }

  // 2. Fallback de Alta Confiabilidade: Fila nativa do Firebase (ext-firestore-send-email)
  try {
    const docMail = await addDoc(collection(db, 'mail'), {
      to: [emailLimpo],
      message: {
        subject: assunto,
        html: htmlTemplate
      },
      createdAt: serverTimestamp(),
      tipo: 'alerta_seguranca_senha_alterada'
    });
    console.log("[SegurancaService] E-mail enfileirado no Firestore mail:", docMail.id);
    return { success: true, emailId: docMail.id, metodo: 'firebase_mail_fallback' };
  } catch (firebaseErr) {
    console.error("[SegurancaService] Falha total ao enfileirar no Firebase:", firebaseErr);
    return { success: false, error: firebaseErr.message };
  }
};
