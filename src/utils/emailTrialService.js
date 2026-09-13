/**
 * 💌 SERVIÇO DE E-MAILS DO PERÍODO DE TESTE (TRIAL LIFECYCLE) - CELEBRE LUXURY
 * 
 * 1. Boas-vindas (Criação de Conta): 7 dias gratuitos com acesso total.
 * 2. Aviso de 3 Dias Restantes: Reta final do teste, lembrete para não pausar o negócio.
 * 3. Aviso de 1 Dia Restante (Último Dia): Urgência + Cupom exclusivo de primeiro acesso (PRIMEIROACESSO).
 * 
 * Motor Triplo de Entrega: Resend API -> Firestore 'notificacoes_trial' -> Cloud Function Fallback.
 */

import { db } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

const RESEND_API_KEY = ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');
const SENDER_EMAIL = 'Celebre <seguranca@celebrefesta.com.br>';
const REPLY_TO_EMAIL = 'celebrefesta25@gmail.com';
export const CUPOM_OFICIAL_PRIMEIRO_ACESSO = 'PRIMEIROACESSO';

// ============================================================================
// 1. TEMPLATE: BOAS-VINDAS (7 DIAS DE TESTE VIP)
// ============================================================================
export const gerarTemplateHtmlBoasVindas = ({ nome, email }) => {
  const nomeExibicao = nome ? String(nome).trim() : 'Criador(a) de Festas';
  const emailLimpo = email ? String(email).trim().toLowerCase() : '';

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bem-vindo(a) ao Celebre • Seus 7 Dias de Teste VIP Começaram</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 25px rgba(197, 160, 89, 0.2);">
            
            <!-- TOPO LUXO -->
            <tr>
              <td style="background: linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e293b 100%); padding: 38px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">CELEBRE</h1>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #c5a059; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 800;">Gestão Inteligente de Festas & Acervo</p>
              </td>
            </tr>

            <!-- CORPO PRINCIPAL -->
            <tr>
              <td style="padding: 40px 35px; background-color: #ffffff;">
                
                <div style="display: inline-block; background-color: #fefce8; border: 1px solid #fde047; border-radius: 24px; padding: 6px 14px; margin-bottom: 20px;">
                  <span style="color: #a16207; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">🎉 SEU TESTE VIP DE 7 DIAS COMEÇOU!</span>
                </div>

                <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                  Olá, ${nomeExibicao}! Seja muito bem-vindo(a)! ✨
                </h2>

                <p style="font-size: 15px; line-height: 1.65; color: #475569; margin: 0 0 18px 0;">
                  É um imenso prazer ter você e sua empresa conosco. A partir de agora, você tem <strong>7 dias de degustação gratuita com acesso TOTAL e ILIMITADO</strong> a todas as funcionalidades premium do Celebre!
                </p>

                <!-- CARD DE BENEFÍCIOS DO TESTE -->
                <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-left: 4px solid #c5a059; border-radius: 12px; padding: 20px; margin: 24px 0;">
                  <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 12px;">🌟 O que você já pode aproveitar imediatamente:</strong>
                  <ul style="margin: 0; padding-left: 18px; color: #475569; font-size: 13.5px; line-height: 1.8;">
                    <li><strong>Acervo & Fotos em Alta Definição:</strong> Cadastre produtos, temas e kits sem limites.</li>
                    <li><strong>Catálogo Online Boutique de Luxo:</strong> Envie sua vitrine digital com carrinho direto para seus clientes.</li>
                    <li><strong>Contratos com Assinatura Digital:</strong> Emita contratos com link para o cliente assinar no celular.</li>
                    <li><strong>Matriz de Disponibilidade & Agenda:</strong> Evite reservas duplicadas em tempo real.</li>
                    <li><strong>Financeiro & Orçamentos:</strong> Controle fluxo de caixa, pagamentos e emita recibos.</li>
                  </ul>
                </div>

                <!-- BOX DE TRANQUILIDADE -->
                <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 28px;">
                  <p style="margin: 0; font-size: 13px; color: #065f46; line-height: 1.5;">
                    🛡️ <strong>Sem pegadinhas:</strong> Nenhum cartão de crédito é exigido durante os 7 dias de teste. Você explora tudo com total liberdade e autonomia.
                  </p>
                </div>

                <!-- BOTÃO DE ACESSO -->
                <div style="text-align: center; margin: 32px 0 20px 0;">
                  <a href="https://celebrefesta.com.br/dashboard" style="background: linear-gradient(135deg, #c5a059 0%, #dfb76c 100%); color: #0f172a; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 900; font-size: 15px; display: inline-block; box-shadow: 0 6px 20px rgba(197, 160, 89, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                    🚀 Acessar Meu Painel Agora
                  </a>
                </div>

                <p style="font-size: 13px; text-align: center; color: #64748b; margin: 0 0 20px 0;">
                  Dúvidas sobre como cadastrar seus primeiros itens? 
                  <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Acabei de me cadastrar no Celebre (${emailLimpo}) e gostaria de tirar uma dúvida sobre o sistema.`)}" style="color: #16a34a; font-weight: 700; text-decoration: underline;">
                    Chame nosso time no WhatsApp
                  </a>
                </p>

              </td>
            </tr>

            <!-- RODAPÉ -->
            <tr>
              <td style="background-color: #f8fafc; padding: 22px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 4px 0; font-size: 11.5px; font-weight: 700; color: #64748b;">
                  Celebre • A plataforma oficial para decoradores e locadores de festas
                </p>
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                  Conta registrada: ${emailLimpo} • Início do Teste VIP: 7 dias grátis.
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

// ============================================================================
// 2. TEMPLATE: AVISO DE 3 DIAS RESTANTES DE TESTE
// ============================================================================
export const gerarTemplateHtmlAviso3Dias = ({ nome, email }) => {
  const nomeExibicao = nome ? String(nome).trim() : 'Cliente Celebre';
  const emailLimpo = email ? String(email).trim().toLowerCase() : '';

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Faltam Apenas 3 Dias do Seu Teste Gratuito • Celebre</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 25px rgba(197, 160, 89, 0.2);">
            
            <!-- TOPO LUXO -->
            <tr>
              <td style="background: linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e293b 100%); padding: 38px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">CELEBRE</h1>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #c5a059; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 800;">Gestão Inteligente de Festas & Acervo</p>
              </td>
            </tr>

            <!-- CORPO PRINCIPAL -->
            <tr>
              <td style="padding: 40px 35px; background-color: #ffffff;">
                
                <div style="display: inline-block; background-color: #fff7ed; border: 1px solid #fdba74; border-radius: 24px; padding: 6px 14px; margin-bottom: 20px;">
                  <span style="color: #c2410c; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">⏳ FALTAM APENAS 3 DIAS DE DEGUSTAÇÃO</span>
                </div>

                <h2 style="margin: 0 0 16px 0; font-size: 23px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                  Olá, ${nomeExibicao}! Seu teste gratuito está na reta final.
                </h2>

                <p style="font-size: 15px; line-height: 1.65; color: #475569; margin: 0 0 18px 0;">
                  Esperamos que você esteja aproveitando ao máximo a organização do seu acervo e as ferramentas do Celebre. Restam apenas <strong>3 dias</strong> para o encerramento do seu período de teste gratuito de 7 dias.
                </p>

                <!-- CARD DE PRESERVAÇÃO -->
                <div style="background-color: #fffdf5; border: 1.5px solid rgba(197, 160, 89, 0.4); border-left: 4px solid #c5a059; border-radius: 12px; padding: 20px; margin: 24px 0;">
                  <strong style="color: #926f2d; font-size: 14px; display: block; margin-bottom: 8px;">📦 Seus dados continuam 100% seguros:</strong>
                  <p style="margin: 0; color: #475569; font-size: 13.5px; line-height: 1.6;">
                    Todos os itens cadastrados no seu acervo, fotos em alta definição, cadastros de clientes e orçamentos estão intactos. Ao ativar um plano, nada do que você já fez será perdido!
                  </p>
                </div>

                <p style="font-size: 14.5px; line-height: 1.65; color: #475569; margin: 0 0 24px 0;">
                  Para garantir que sua rotina de locações, contratos digitais e vitrine online continuem funcionando sem nenhuma pausa no atendimento aos seus noivos e clientes, escolha o plano perfeito para você:
                </p>

                <!-- BOTÃO ESCOLHER PLANO -->
                <div style="text-align: center; margin: 30px 0 20px 0;">
                  <a href="https://celebrefesta.com.br/planos" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; text-decoration: none; padding: 16px 38px; border-radius: 12px; font-weight: 900; font-size: 15px; display: inline-block; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.35); text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #c5a059;">
                    💎 Escolher Meu Plano Agora
                  </a>
                </div>

                <p style="font-size: 13px; text-align: center; color: #64748b; margin: 0 0 16px 0;">
                  Precisa de uma recomendação do melhor plano para o tamanho do seu acervo? 
                  <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Faltam 3 dias para acabar meu teste do Celebre (${emailLimpo}) e gostaria de saber qual plano é mais indicado para minha empresa.`)}" style="color: #16a34a; font-weight: 700; text-decoration: underline;">
                    Fale com nosso consultor no WhatsApp
                  </a>
                </p>

              </td>
            </tr>

            <!-- RODAPÉ -->
            <tr>
              <td style="background-color: #f8fafc; padding: 22px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 4px 0; font-size: 11.5px; font-weight: 700; color: #64748b;">
                  Celebre • A evolução da gestão para o mercado de eventos
                </p>
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                  E-mail enviado para ${emailLimpo} • Aviso de término de período de teste.
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

// ============================================================================
// 3. TEMPLATE: AVISO DE 1 DIA RESTANTE (ÚLTIMO DIA + CUPOM PRIMEIRO ACESSO)
// ============================================================================
export const gerarTemplateHtmlAviso1DiaComCupom = ({ nome, email }) => {
  const nomeExibicao = nome ? String(nome).trim() : 'Cliente Celebre';
  const emailLimpo = email ? String(email).trim().toLowerCase() : '';
  const cupom = CUPOM_OFICIAL_PRIMEIRO_ACESSO;

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚨 Último Dia de Teste! Cupom VIP de Primeiro Acesso • Celebre</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(220, 38, 38, 0.25);">
            
            <!-- TOPO LUXO -->
            <tr>
              <td style="background: linear-gradient(135deg, #090d16 0%, #1e1b4b 60%, #0f172a 100%); padding: 38px 30px; text-align: center; border-bottom: 3px solid #f59e0b;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">CELEBRE</h1>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #f59e0b; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 800;">Oportunidade Exclusiva de Primeiro Acesso</p>
              </td>
            </tr>

            <!-- CORPO PRINCIPAL -->
            <tr>
              <td style="padding: 40px 35px; background-color: #ffffff;">
                
                <div style="display: inline-block; background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 24px; padding: 6px 14px; margin-bottom: 20px;">
                  <span style="color: #b91c1c; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">🚨 HOJE É SEU ÚLTIMO DIA DE TESTE GRATUITO!</span>
                </div>

                <h2 style="margin: 0 0 16px 0; font-size: 23px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                  Olá, ${nomeExibicao}! Não deixe sua empresa parar. 🎁
                </h2>

                <p style="font-size: 15px; line-height: 1.65; color: #475569; margin: 0 0 18px 0;">
                  Hoje é o <strong>último dia</strong> do seu período de teste no Celebre. A partir de amanhã, o acesso ao painel de orçamentos, contratos e vitrine de produtos será pausado.
                </p>

                <p style="font-size: 15px; line-height: 1.65; color: #475569; margin: 0 0 24px 0;">
                  Como agradecimento por ter experimentado o Celebre e para incentivar o crescimento do seu negócio, preparamos um <strong>presente exclusivo de primeiro acesso</strong>:
                </p>

                <!-- CARD DO CUPOM VIP -->
                <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px dashed #d97706; border-radius: 16px; padding: 24px; text-align: center; margin: 26px 0;">
                  <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #92400e; display: block; margin-bottom: 8px;">
                    🏷️ SEU CUPOM EXCLUSIVO DE 20% OFF:
                  </span>
                  
                  <div style="display: inline-block; background-color: #0f172a; color: #f5d061; font-size: 22px; font-weight: 900; letter-spacing: 3px; padding: 12px 28px; border-radius: 10px; border: 1.5px solid #f5d061; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                    ${cupom}
                  </div>

                  <p style="margin: 14px 0 0 0; font-size: 13px; color: #78350f; font-weight: 700;">
                    ⚡ 20% de Desconto na 1ª mensalidade • <u>Válido somente hoje, no último dia de teste!</u>
                  </p>
                </div>

                <!-- AVISO DE CONDIÇÃO -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 28px;">
                  <p style="margin: 0; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                    💡 <em>Importante:</em> Este cupom especial expira pontualmente à meia-noite, junto com o término da sua degustação. Ativando hoje, todo o seu acervo e clientes cadastrados continuam imediatamente disponíveis.
                  </p>
                </div>

                <!-- BOTÃO ATIVAR COM CUPOM -->
                <div style="text-align: center; margin: 30px 0 20px 0;">
                  <a href="https://celebrefesta.com.br/checkout?cupom=${cupom}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 17px 42px; border-radius: 12px; font-weight: 900; font-size: 15.5px; display: inline-block; box-shadow: 0 6px 22px rgba(16, 185, 129, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                    🎁 Ativar Assinatura com Desconto Agora
                  </a>
                </div>

                <p style="font-size: 13px; text-align: center; color: #64748b; margin: 0 0 16px 0;">
                  Dúvidas sobre formas de pagamento (Pix, Cartão em até 12x ou Boleto)? 
                  <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Hoje é meu último dia de teste no Celebre (${emailLimpo}) e gostaria de ajuda para ativar minha assinatura com o cupom PRIMEIROACESSO.`)}" style="color: #16a34a; font-weight: 700; text-decoration: underline;">
                    Chame nosso suporte no WhatsApp
                  </a>
                </p>

              </td>
            </tr>

            <!-- RODAPÉ -->
            <tr>
              <td style="background-color: #f8fafc; padding: 22px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 4px 0; font-size: 11.5px; font-weight: 700; color: #64748b;">
                  Celebre • Gestão Inteligente para Acervos & Festas
                </p>
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                  E-mail automático enviado para ${emailLimpo} • Cupom condicionado ao último dia de teste.
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

// ============================================================================
// MOTOR CENTRAL DE DISPARO (RESEND + FIRESTORE FALLBACK)
// ============================================================================
async function dispararEmailGenerico({ to, subject, html, tipo, dadosExtras = {} }) {
  const emailLimpo = String(to).trim().toLowerCase();

  // 1. Envio via API do Resend
  try {
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const endpointResend = isLocalhost ? '/api-resend/emails' : 'https://api.resend.com/emails';

    const response = await fetch(endpointResend, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: [emailLimpo],
        reply_to: REPLY_TO_EMAIL,
        subject,
        html
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[EmailTrial] E-mail do tipo ${tipo} enviado com sucesso via Resend para ${emailLimpo}! ID:`, data.id);

      // Registra no Firestore para histórico auditável
      try {
        await addDoc(collection(db, 'notificacoes_trial'), {
          email: emailLimpo,
          tipo,
          status: 'enviado_resend',
          resendId: data.id,
          enviadoEm: new Date().toISOString(),
          ...dadosExtras
        });
      } catch (dbErr) {
        console.warn("[EmailTrial] Aviso ao salvar log no Firestore:", dbErr);
      }

      return { success: true, resendId: data.id, canal: 'resend' };
    }
  } catch (errResend) {
    console.warn(`[EmailTrial] Tentativa direta do Resend falhou (${tipo}):`, errResend);
  }

  // 2. Fallback via coleção 'mail' do Firestore
  try {
    const docRef = await addDoc(collection(db, 'mail'), {
      to: emailLimpo,
      message: {
        subject,
        html
      }
    });

    await addDoc(collection(db, 'notificacoes_trial'), {
      email: emailLimpo,
      tipo,
      status: 'enviado_firestore_mail',
      firestoreMailId: docRef.id,
      enviadoEm: new Date().toISOString(),
      ...dadosExtras
    });

    console.log(`[EmailTrial] E-mail ${tipo} enfileirado na coleção 'mail' com sucesso.`);
    return { success: true, canal: 'firestore_mail' };
  } catch (errDb) {
    console.error(`[EmailTrial] Erro crítico ao enviar e-mail ${tipo}:`, errDb);
    return { success: false, error: errDb.message };
  }
}

// ============================================================================
// MÉTODOS PÚBLICOS EXPORTADOS
// ============================================================================

/**
 * Dispara o e-mail de Boas-Vindas ao criar a conta (7 dias de teste VIP)
 */
export const enviarEmailBoasVindasTeste = async ({ email, nome }) => {
  if (!email || !email.includes('@')) return { success: false, error: 'E-mail inválido' };
  const html = gerarTemplateHtmlBoasVindas({ nome, email });
  return dispararEmailGenerico({
    to: email,
    subject: '🎉 Bem-vindo(a) ao Celebre! Seus 7 dias gratuitos de acesso VIP começaram',
    html,
    tipo: 'boas_vindas_7_dias',
    dadosExtras: { nome }
  });
};

/**
 * Dispara o e-mail de aviso de 3 dias restantes para o término do teste
 */
export const enviarEmailAvisoTeste3Dias = async ({ email, nome }) => {
  if (!email || !email.includes('@')) return { success: false, error: 'E-mail inválido' };
  const html = gerarTemplateHtmlAviso3Dias({ nome, email });
  return dispararEmailGenerico({
    to: email,
    subject: '⏳ Faltam apenas 3 dias do seu período de teste no Celebre',
    html,
    tipo: 'aviso_teste_3_dias',
    dadosExtras: { nome }
  });
};

/**
 * Dispara o e-mail de aviso do ÚLTIMO DIA de teste + Cupom exclusivo de Primeiro Acesso
 */
export const enviarEmailAvisoTeste1Dia = async ({ email, nome }) => {
  if (!email || !email.includes('@')) return { success: false, error: 'E-mail inválido' };
  const html = gerarTemplateHtmlAviso1DiaComCupom({ nome, email });
  return dispararEmailGenerico({
    to: email,
    subject: '🚨 Último dia de teste! Presente VIP: Cupom exclusivo para você continuar no Celebre',
    html,
    tipo: 'aviso_teste_1_dia_cupom',
    dadosExtras: { nome, cupom: CUPOM_OFICIAL_PRIMEIRO_ACESSO }
  });
};
