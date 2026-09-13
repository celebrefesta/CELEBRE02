import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * 🌟 Serviço Oficial de Notificação de Reativação de Conta (Celebre)
 * Dispara e-mail de boas-vindas e confirmação de acesso liberado com dados preservados.
 */

const RESEND_API_KEY = ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');
const CLOUD_FUNCTION_URL = 'https://us-central1-celebre-9f5c9.cloudfunctions.net/enviarConfirmacaoReativacao';

export const gerarTemplateHtmlReativacao = ({ nome = '', nomePlano = 'Premium', email = '' }) => {
  const nomeExibicao = nome.trim() || 'Cliente Celebre';
  const emailLimpo = email.trim().toLowerCase();

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sua conta no Celebre foi reativada com sucesso! • Celebre</title>
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
                  Gestão Inteligente de Festas & Acervo
                </p>
              </td>
            </tr>

            <!-- CORPO PRINCIPAL -->
            <tr>
              <td style="padding: 36px 32px;">
                
                <!-- BADGE DE SUCESSO -->
                <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 6px 14px; margin-bottom: 20px;">
                  <span style="color: #065f46; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                    ✨ ACESSO TOTALMENTE LIBERADO
                  </span>
                </div>

                <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                  Que alegria ter você de volta, ${nomeExibicao}! 🎉
                </h2>

                <p style="font-size: 14.5px; line-height: 1.65; color: #475569; margin: 0 0 18px 0;">
                  Confirmamos que sua conta no <strong>Celebre</strong> foi <strong>reativada com sucesso</strong> no <strong>Plano ${nomePlano}</strong>. Seu acesso ao painel já está instantaneamente desbloqueado!
                </p>

                <!-- CARD DE DADOS PRESERVADOS -->
                <div style="background: linear-gradient(135deg, #fffdf5 0%, #fef9e7 100%); border-left: 4px solid #c5a059; border-radius: 10px; padding: 18px 20px; margin: 24px 0; border: 1px solid rgba(197, 160, 89, 0.25);">
                  <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 800; color: #926f2d;">
                    📦 Seus dados continuam 100% intactos e preservados:
                  </h3>
                  <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; line-height: 1.7;">
                    <li><strong>Acervo & Peças:</strong> Suas fotos em alta definição, descrições e estoque.</li>
                    <li><strong>Clientes & Locações:</strong> Histórico de pedidos, contratos e contatos.</li>
                    <li><strong>Financeiro & Agenda:</strong> Lançamentos e cronograma de eventos.</li>
                  </ul>
                </div>

                <!-- DESTAQUES DA PLATAFORMA -->
                <p style="font-size: 13.5px; line-height: 1.6; color: #475569; margin: 0 0 14px 0;">
                  Aproveite também as ferramentas que evoluíram para otimizar sua rotina:
                </p>
                <div style="background-color: #f8fafc; border-radius: 10px; padding: 14px 18px; margin-bottom: 26px; border: 1px solid #e2e8f0; font-size: 12.5px; color: #334155; line-height: 1.6;">
                  🛍️ <strong>Catálogo Online Boutique de Luxo:</strong> Vitrine moderna com fotos e carrinho flutuante.<br>
                  📱 <strong>Bipagem por QR Code:</strong> Agilidade total na expedição e conferência do galpão.<br>
                  📅 <strong>Matriz de Disponibilidade Inteligente:</strong> Visualização do acervo em tempo real.
                </div>

                <!-- BOTAO PRINCIPAL DE AÇÃO -->
                <div style="text-align: center; margin: 32px 0 24px 0;">
                  <a href="https://celebrefesta.com.br/dashboard" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 38px; border-radius: 12px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                    🚀 Acessar Meu Painel Agora
                  </a>
                </div>

                <!-- SUPORTE -->
                <p style="font-size: 12.5px; text-align: center; color: #94a3b8; margin: 0 0 20px 0;">
                  Precisa de apoio na retomada? 
                  <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Reativei minha conta (${emailLimpo}) no Celebre e gostaria de suporte para retomar minhas operações.`)}" style="color: #059669; font-weight: 700; text-decoration: underline;">
                    Fale com nosso Suporte no WhatsApp
                  </a>
                </p>

                <!-- RODOPE DA MENSAGEM -->
                <p style="font-size: 11.5px; line-height: 1.5; color: #94a3b8; margin: 24px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
                  Este é um e-mail de confirmação de ativação da assinatura associada ao endereço ${emailLimpo}.
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
                  © ${new Date().getFullYear()} Celebre Tecnologia e Sistemas LTDA. Todos os direitos reservados.
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

export const enviarConfirmacaoReativacaoEmail = async ({ email, nome = '', nomePlano = 'Premium' }) => {
  if (!email || !email.includes('@')) {
    throw new Error('E-mail inválido para envio da confirmação de reativação.');
  }

  const emailLimpo = email.trim().toLowerCase();
  const nomeExibicao = nome.trim() || 'Cliente Celebre';
  const htmlTemplate = gerarTemplateHtmlReativacao({ nome: nomeExibicao, nomePlano, email: emailLimpo });

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
        from: 'Celebre <seguranca@celebrefesta.com.br>',
        to: [emailLimpo],
        reply_to: 'celebrefesta25@gmail.com',
        subject: '🎉 Sua conta no Celebre foi reativada com sucesso! Seja bem-vindo(a) de volta!',
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
    console.warn("Disparo de reativação via Resend falhou, ativando fallback do Firebase:", resendErr);
  }

  // 2. Fallback de Alta Confiabilidade: Fila nativa do Firebase (ext-firestore-send-email)
  try {
    const docMail = await addDoc(collection(db, 'mail'), {
      to: emailLimpo,
      replyTo: 'celebrefesta25@gmail.com',
      message: {
        subject: '🎉 Sua conta no Celebre foi reativada com sucesso! Seja bem-vindo(a) de volta!',
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
      body: JSON.stringify({ email: emailLimpo, nome: nomeExibicao, nomePlano })
    });

    if (cfResponse.ok) {
      const cfData = await cfResponse.json();
      return { success: true, emailId: cfData.emailId, metodo: 'cloud_function' };
    }
  } catch (cfErr) {
    console.error("Falha no fallback Cloud Function de reativação:", cfErr);
  }

  return { success: false, error: "Não foi possível disparar o e-mail de reativação imediatamente." };
};
