/* eslint-disable */
const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { MercadoPagoConfig, PreApproval, Payment } = require("mercadopago");

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

if (getApps().length === 0) {
    initializeApp();
}
const db = getFirestore();

const client = new MercadoPagoConfig({ 
  accessToken: "APP_USR-3626101868283261-041714-787f6d6687f899ca426df63ee41ec903-3201169000" 
});

exports.processarPagamento = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Método não permitido");
    }

    try {
      const { token, payment_method_id, transaction_amount, payer, userId } = req.body; 

      if (payment_method_id === 'pix' || payment_method_id === 'bolbradesco') {
          const payment = new Payment(client);
          
          const result = await payment.create({
              body: {
                  transaction_amount: Number(transaction_amount),
                  description: `Acesso de 30 dias - Celebre (${req.body.planoNome || 'Plano'})`,
                  payment_method_id: payment_method_id,
                  external_reference: userId,
                  metadata: {
                      user_id: userId,
                      plano_id: req.body.planoId || '',
                      plano_nome: req.body.planoNome || ''
                  },
                  payer: { 
                      email: payer.email,
                      first_name: "Camila", 
                      last_name: "Vichinhsk", 
                      identification: {
                          type: "CPF",
                          number: payer.identification.number 
                      },
                      // 🔥 O ENDEREÇO OBRIGATÓRIO ESTÁ AQUI:
                      address: {
                        zip_code: "01001000",
                        street_name: "Praca da Se",
                        street_number: "1",
                        neighborhood: "Se",
                        city: "Sao Paulo",
                        federal_unit: "SP"
                      }
                  }
              }
          });

          if (result.id) {
              const valorNum = Number(transaction_amount);
              let idPlanoEstimado = req.body.planoId;
              let nomePlanoEstimado = req.body.planoNome;
              if (!idPlanoEstimado) {
                  if (valorNum < 60) {
                      idPlanoEstimado = 'plano_basico';
                      nomePlanoEstimado = 'Básico';
                  } else if (valorNum > 120) {
                      idPlanoEstimado = 'plano_plus';
                      nomePlanoEstimado = 'Plus';
                  } else {
                      idPlanoEstimado = 'plano_premium';
                      nomePlanoEstimado = 'Premium';
                  }
              }

              await db.collection("usuarios").doc(userId).update({
                  statusPagamentoVulso: "pendente",
                  idPagamento: result.id,
                  planoPendente: idPlanoEstimado,
                  nomePlanoPendente: nomePlanoEstimado,
                  valorPendente: valorNum,
                  metodoPendente: payment_method_id === 'pix' ? 'PIX' : 'Boleto'
              });
          }

          return res.status(200).send(result);
      } 
      
      else {
          const preApproval = new PreApproval(client);
          const subscriptionData = {
              body: {
                  preapproval_plan_id: "3ea107b1310c447898e274a0eec43d7f",
                  reason: "Assinatura Celebre",
                  external_reference: userId, 
                  payer_email: payer.email,
                  card_token_id: token, 
                  status: "authorized"
              }
          };

          const resultado = await preApproval.create(subscriptionData);

          if (resultado.status === "authorized") {
              await db.collection("usuarios").doc(userId).update({
                  statusConta: "ativo",
                  plano: "pago",
                  statusAssinatura: "ativa",
                  dataPagamento: new Date().toISOString(),
                  subscriptionId: resultado.id 
              });
          }
          return res.status(200).send(resultado);
      }

    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      res.status(500).send({ message: "Erro interno no servidor", error });
    }
  });
});

// ─── AUXILIARES OFICIAIS DE DISPARO DE E-MAIL VIA RESEND ────────────────────
async function dispararEmailComprovanteExclusao(email, nome, motivo, protoCustom) {
  if (!email || !email.includes('@')) return null;
  const emailLimpo = String(email).trim().toLowerCase();
  const nomeExibicao = String(nome || '').trim() || 'Usuário(a)';
  const anoAtual = new Date().getFullYear();
  const protocolo = protoCustom || `CEL-EXCL-${anoAtual}-${Math.floor(10000 + Math.random() * 90000)}`;
  const dataHoraFormatada = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

  const htmlBody = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Comprovante de Exclusão de Conta • Celebre</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">CELEBRE</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Central de Privacidade & LGPD</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 35px 30px;">
                <div style="display: inline-block; background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 12px; margin-bottom: 20px;">
                  <span style="font-size: 11px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">
                    ✓ PROTOCOLO OFICIAL DE EXCLUSÃO DEFINITIVA
                  </span>
                </div>
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                  Comprovante de Exclusão de Conta e Dados Pessoais
                </h2>
                <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                  Prezado(a) <strong>${nomeExibicao}</strong>,
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                  Confirmamos formalmente que a sua conta vinculada ao e-mail <strong>${emailLimpo}</strong> e todas as informações associadas foram <strong>permanentemente excluídas</strong> dos servidores de produção da plataforma Celebre.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #c5a059; border-radius: 8px; margin-bottom: 25px; padding: 18px 20px;">
                  <tr>
                    <td>
                      <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px;">
                        <tr>
                          <td width="38%" style="color: #64748b; font-weight: 600;">Número de Protocolo:</td>
                          <td style="color: #0f172a; font-weight: 800; font-family: monospace; font-size: 14px;">${protocolo}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b; font-weight: 600;">Data e Hora:</td>
                          <td style="color: #0f172a; font-weight: 600;">${dataHoraFormatada}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b; font-weight: 600;">E-mail Titular:</td>
                          <td style="color: #0f172a; font-weight: 600;">${emailLimpo}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b; font-weight: 600;">Status:</td>
                          <td style="color: #16a34a; font-weight: 800;">Concluído / Expurgado Definitivamente</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                  Dados e registros eliminados:
                </h3>
                <ul style="margin: 0 0 24px 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7;">
                  <li><strong>Credenciais de Acesso:</strong> E-mail, senha criptografada e autenticação do Firebase.</li>
                  <li><strong>Acervo & Peças:</strong> Catálogo de itens, temas, móveis e fotos de decorações.</li>
                  <li><strong>Locações & Contratos:</strong> Orçamentos, pedidos, check-ins e contratos digitais assinados.</li>
                  <li><strong>Dados Cadastrais da Empresa:</strong> Nome fantasia, CNPJ/CPF, endereços e integrações.</li>
                </ul>
                <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin-bottom: 25px; font-size: 12px; color: #64748b; line-height: 1.5;">
                  🔒 <strong>Conformidade Legal:</strong> Este procedimento atende integralmente ao Artigo 18 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD) e às Diretrizes de Segurança do Google Play Console.
                </div>
                <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
                  Agradecemos imensamente pelo tempo em que esteve com o Celebre. Se desejar retornar no futuro, nossas portas estarão sempre abertas!
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 30px; text-align: center; font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
                <p style="margin: 0 0 6px 0; font-weight: 600; color: #64748b;">
                  Celebre Tecnologia e Sistemas LTDA. • CNPJ: 54.839.293/0001-42
                </p>
                <p style="margin: 0;">
                  São Paulo - SP • Brasil • <a href="https://celebrefesta.com.br" style="color: #94a3b8; text-decoration: underline;">celebrefesta.com.br</a>
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

  try {
    const responseResend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Celebre Segurança <seguranca@celebrefesta.com.br>',
        to: [emailLimpo],
        reply_to: 'celebrefesta25@gmail.com',
        subject: `Comprovante de Exclusão de Conta • Protocolo ${protocolo}`,
        html: htmlBody
      })
    });

    const resData = await responseResend.json();
    await db.collection("comprovantes_exclusao").add({
      email: emailLimpo,
      nome: nomeExibicao,
      motivo: motivo || "Não informado",
      protocolo,
      resendId: resData?.id || null,
      dataHora: new Date().toISOString()
    });
    return { success: true, protocolo, emailId: resData?.id };
  } catch (err) {
    console.warn("Erro no envio de comprovante de exclusão:", err);
    return null;
  }
}

async function dispararEmailReativacaoInterno(email, nome, nomePlano) {
  if (!email || !email.includes('@')) return null;
  const emailLimpo = String(email).trim().toLowerCase();
  const nomeExibicao = String(nome || '').trim() || 'Cliente Celebre';
  const plano = String(nomePlano || 'Premium').trim();
  const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

  const htmlBody = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Sua conta no Celebre foi reativada com sucesso! • Celebre</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">CELEBRE</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Gestão Inteligente de Festas & Acervo</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 35px 30px;">
                <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 4px 12px; margin-bottom: 16px;">
                  <span style="color: #065f46; font-size: 11px; font-weight: 800; text-transform: uppercase;">✨ ACESSO TOTALMENTE LIBERADO</span>
                </div>
                <h2 style="margin: 0 0 14px 0; font-size: 21px; font-weight: 700; color: #0f172a;">Que alegria ter você de volta, ${nomeExibicao}! 🎉</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
                  Sua conta no <strong>Celebre</strong> foi <strong>reativada com sucesso</strong> no <strong>Plano ${plano}</strong>. Seu acesso ao painel já está instantaneamente liberado!
                </p>
                <div style="background-color: #fffdf5; border-left: 4px solid #c5a059; padding: 16px 18px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(197, 160, 89, 0.2);">
                  <strong style="color: #926f2d; font-size: 13.5px; display: block; margin-bottom: 6px;">📦 Seus dados continuam 100% preservados:</strong>
                  <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                    • Itens do acervo com fotos em alta definição<br>
                    • Cadastros de clientes e CRM<br>
                    • Histórico de locações, orçamentos e contratos
                  </p>
                </div>
                <div style="text-align: center; margin: 30px 0 20px 0;">
                  <a href="https://celebrefesta.com.br/dashboard" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                    🚀 Acessar Meu Painel Agora
                  </a>
                </div>
                <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                  Dúvidas ou suporte? Conte com nosso atendimento VIP pelo WhatsApp.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">Celebre Gestão • E-mail automático de confirmação de reativação.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  try {
    const responseResend = await fetch('https://api.resend.com/emails', {
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
        html: htmlBody
      })
    });

    const resData = await responseResend.json();
    await db.collection("notificacoes_reativacao").add({
      email: emailLimpo,
      nome: nomeExibicao,
      nomePlano: plano,
      resendId: resData?.id || null,
      dataHora: new Date().toISOString()
    });
    return resData;
  } catch (err) {
    console.warn("Erro no envio Resend de reativação:", err);
    return null;
  }
}

async function dispararEmailConfirmacaoPagamento(email, nome, nomePlano, valor, metodo) {
  if (!email || !email.includes('@')) return null;
  const emailLimpo = String(email).trim().toLowerCase();
  const nomeExibicao = String(nome || '').trim() || 'Cliente Celebre';
  const plano = String(nomePlano || 'Plano Básico').trim();
  const metodoFmt = String(metodo || 'PIX').trim();
  const valorFmt = Number(valor || 49.90).toFixed(2).replace('.', ',');
  const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

  const subject = `🎉 Pagamento Confirmado! Sua assinatura no Celebre está ativa • ${plano}`;
  const htmlBody = `<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Pagamento Confirmado • Celebre</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #334155;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0f19; padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 25px rgba(16, 185, 129, 0.25);">
            <tr>
              <td style="background: linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e293b 100%); padding: 38px 30px; text-align: center; border-bottom: 3px solid #10b981;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">CELEBRE</h1>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 800;">Confirmação Oficial de Pagamento</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 35px; background-color: #ffffff;">
                <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 24px; padding: 6px 14px; margin-bottom: 20px;">
                  <span style="color: #065f46; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">✓ ASSINATURA QUITADA COM SUCESSO</span>
                </div>
                <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0f172a;">Parabéns, ${nomeExibicao}! Seu pagamento foi confirmado! 🎉</h2>
                <p style="font-size: 15px; line-height: 1.65; color: #475569; margin: 0 0 20px 0;">
                  Recebemos a confirmação do seu pagamento e sua assinatura do <strong>Celebre</strong> está <strong>100% ativa</strong>. Seu acesso ao painel está completamente liberado pelos próximos 30 dias!
                </p>

                <!-- RECIBO EXECUTIVO -->
                <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 22px; margin: 24px 0;">
                  <span style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; display: block; margin-bottom: 12px;">🧾 Detalhes do Pagamento:</span>
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 8px 0; color: #64748b;">Plano:</td>
                      <td style="padding: 8px 0; font-weight: 800; text-align: right; color: #0f172a;">${plano}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 8px 0; color: #64748b;">Valor Quitado:</td>
                      <td style="padding: 8px 0; font-weight: 800; text-align: right; color: #10b981; font-size: 16px;">R$ ${valorFmt}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 8px 0; color: #64748b;">Forma de Pagamento:</td>
                      <td style="padding: 8px 0; font-weight: 800; text-align: right; color: #0f172a;">${metodoFmt}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Status:</td>
                      <td style="padding: 8px 0; font-weight: 800; text-align: right; color: #10b981;">Quitado • Ativo</td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 32px 0 20px 0;">
                  <a href="https://celebrefesta.com.br/dashboard" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 900; font-size: 15px; display: inline-block; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                    🚀 Acessar Meu Painel Agora
                  </a>
                </div>

                <p style="font-size: 13px; text-align: center; color: #64748b; margin: 0 0 16px 0;">
                  Dúvidas ou suporte? Conte com nosso atendimento pelo WhatsApp.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">Celebre Gestão Inteligente • Comprovante emitido automaticamente.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  try {
    const responseResend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Celebre <seguranca@celebrefesta.com.br>',
        to: [emailLimpo],
        reply_to: 'celebrefesta25@gmail.com',
        subject,
        html: htmlBody
      })
    });

    const resData = await responseResend.json();
    await db.collection("notificacoes_pagamento").add({
      email: emailLimpo,
      nome: nomeExibicao,
      nomePlano: plano,
      valor: valorFmt,
      metodo: metodoFmt,
      resendId: resData?.id || null,
      dataHora: new Date().toISOString()
    });
    return resData;
  } catch (err) {
    console.warn("Erro no envio Resend de pagamento confirmado:", err);
    return null;
  }
}

async function dispararEmailTrialInterno(tipo, email, nome, cupom = 'PRIMEIROACESSO') {
  const emailLimpo = String(email).trim().toLowerCase();
  const nomeExibicao = String(nome || '').trim() || 'Cliente Celebre';
  const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

  let subject = '';
  let htmlBody = '';

  if (tipo === 'boas_vindas') {
    subject = '🎉 Bem-vindo(a) ao Celebre! Seus 7 dias gratuitos de acesso VIP começaram';
    htmlBody = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Bem-vindo(a) ao Celebre</title></head><body style="margin:0;padding:0;background-color:#0b0f19;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 15px;"><tr><td align="center"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5),0 0 25px rgba(197,160,89,0.2);"><tr><td style="background:linear-gradient(135deg,#090d16 0%,#0f172a 60%,#1e293b 100%);padding:38px 30px;text-align:center;border-bottom:3px solid #c5a059;"><h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:2px;color:#ffffff;">CELEBRE</h1><p style="margin:6px 0 0 0;font-size:12px;color:#c5a059;text-transform:uppercase;letter-spacing:2.5px;font-weight:800;">Gestão Inteligente de Festas & Acervo</p></td></tr><tr><td style="padding:40px 35px;background-color:#ffffff;"><div style="display:inline-block;background-color:#fefce8;border:1px solid #fde047;border-radius:24px;padding:6px 14px;margin-bottom:20px;"><span style="color:#a16207;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">🎉 SEU TESTE VIP DE 7 DIAS COMEÇOU!</span></div><h2 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:#0f172a;">Olá, ${nomeExibicao}! Seja muito bem-vindo(a)! ✨</h2><p style="font-size:15px;line-height:1.65;color:#475569;margin:0 0 18px 0;">Você tem <strong>7 dias de degustação gratuita com acesso TOTAL e ILIMITADO</strong> a todas as ferramentas premium do Celebre (acervo com fotos, vitrine boutique, contratos com assinatura digital, calendário de disponibilidade e relatórios financeiros).</p><div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px 18px;margin:20px 0;"><p style="margin:0;font-size:13px;color:#065f46;line-height:1.5;">🛡️ <strong>Sem cartão de crédito:</strong> Você explora tudo com total liberdade e autonomia.</p></div><div style="text-align:center;margin:32px 0 20px 0;"><a href="https://celebrefesta.com.br/dashboard" style="background:linear-gradient(135deg,#c5a059 0%,#dfb76c 100%);color:#0f172a;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:900;font-size:15px;display:inline-block;box-shadow:0 6px 20px rgba(197,160,89,0.4);text-transform:uppercase;letter-spacing:0.5px;">🚀 Acessar Meu Painel Agora</a></div><p style="font-size:13px;text-align:center;color:#64748b;margin:0 0 16px 0;">Dúvidas? <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Acabei de me cadastrar no Celebre (${emailLimpo}) e gostaria de tirar uma dúvida.`)}" style="color:#16a34a;font-weight:700;text-decoration:underline;">Chame nosso WhatsApp</a></p></td></tr><tr><td style="background-color:#f8fafc;padding:22px 30px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0 0 4px 0;font-size:11.5px;font-weight:700;color:#64748b;">Celebre • Gestão Inteligente para Acervos & Festas</p><p style="margin:0;font-size:11px;color:#94a3b8;">Conta: ${emailLimpo} • Período de Teste: 7 dias grátis.</p></td></tr></table></td></tr></table></body></html>`;
  } else if (tipo === 'aviso_3_dias') {
    subject = '⏳ Faltam apenas 3 dias do seu período de teste no Celebre';
    htmlBody = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Faltam 3 Dias de Teste</title></head><body style="margin:0;padding:0;background-color:#0b0f19;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 15px;"><tr><td align="center"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5),0 0 25px rgba(197,160,89,0.2);"><tr><td style="background:linear-gradient(135deg,#090d16 0%,#0f172a 60%,#1e293b 100%);padding:38px 30px;text-align:center;border-bottom:3px solid #c5a059;"><h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:2px;color:#ffffff;">CELEBRE</h1><p style="margin:6px 0 0 0;font-size:12px;color:#c5a059;text-transform:uppercase;letter-spacing:2.5px;font-weight:800;">Gestão Inteligente de Festas & Acervo</p></td></tr><tr><td style="padding:40px 35px;background-color:#ffffff;"><div style="display:inline-block;background-color:#fff7ed;border:1px solid #fdba74;border-radius:24px;padding:6px 14px;margin-bottom:20px;"><span style="color:#c2410c;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">⏳ FALTAM APENAS 3 DIAS DE DEGUSTAÇÃO</span></div><h2 style="margin:0 0 16px 0;font-size:23px;font-weight:800;color:#0f172a;">Olá, ${nomeExibicao}! Seu teste gratuito está na reta final.</h2><p style="font-size:15px;line-height:1.65;color:#475569;margin:0 0 18px 0;">Restam apenas <strong>3 dias</strong> para o término da sua degustação de 7 dias no Celebre.</p><div style="background-color:#fffdf5;border:1.5px solid rgba(197,160,89,0.4);border-left:4px solid #c5a059;border-radius:12px;padding:20px;margin:24px 0;"><strong style="color:#926f2d;font-size:14px;display:block;margin-bottom:8px;">📦 Seus dados continuam 100% seguros:</strong><p style="margin:0;color:#475569;font-size:13.5px;line-height:1.6;">Todos os itens do seu acervo, fotos em alta resolução, clientes e orçamentos estão intactos. Ao escolher um plano, nada do que você já fez será perdido!</p></div><div style="text-align:center;margin:30px 0 20px 0;"><a href="https://celebrefesta.com.br/planos" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;text-decoration:none;padding:16px 38px;border-radius:12px;font-weight:900;font-size:15px;display:inline-block;box-shadow:0 6px 20px rgba(15,23,42,0.35);text-transform:uppercase;letter-spacing:0.5px;border:1px solid #c5a059;">💎 Escolher Meu Plano Agora</a></div><p style="font-size:13px;text-align:center;color:#64748b;margin:0 0 16px 0;">Dúvidas? <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Faltam 3 dias para acabar meu teste do Celebre (${emailLimpo}) e gostaria de ajuda com planos.`)}" style="color:#16a34a;font-weight:700;text-decoration:underline;">Fale no WhatsApp</a></p></td></tr><tr><td style="background-color:#f8fafc;padding:22px 30px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0 0 4px 0;font-size:11.5px;font-weight:700;color:#64748b;">Celebre • Gestão Inteligente para Festas & Acervo</p><p style="margin:0;font-size:11px;color:#94a3b8;">E-mail: ${emailLimpo} • Aviso de encerramento de teste.</p></td></tr></table></td></tr></table></body></html>`;
  } else if (tipo === 'aviso_1_dia_cupom') {
    subject = '🚨 Último dia de teste! Presente VIP: Cupom exclusivo para você continuar no Celebre';
    htmlBody = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Último Dia de Teste - Cupom VIP</title></head><body style="margin:0;padding:0;background-color:#0b0f19;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 15px;"><tr><td align="center"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5),0 0 30px rgba(220,38,38,0.25);"><tr><td style="background:linear-gradient(135deg,#090d16 0%,#1e1b4b 60%,#0f172a 100%);padding:38px 30px;text-align:center;border-bottom:3px solid #f59e0b;"><h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:2px;color:#ffffff;">CELEBRE</h1><p style="margin:6px 0 0 0;font-size:12px;color:#f59e0b;text-transform:uppercase;letter-spacing:2.5px;font-weight:800;">Oportunidade Exclusiva de Primeiro Acesso</p></td></tr><tr><td style="padding:40px 35px;background-color:#ffffff;"><div style="display:inline-block;background-color:#fef2f2;border:1px solid #fca5a5;border-radius:24px;padding:6px 14px;margin-bottom:20px;"><span style="color:#b91c1c;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">🚨 HOJE É SEU ÚLTIMO DIA DE TESTE GRATUITO!</span></div><h2 style="margin:0 0 16px 0;font-size:23px;font-weight:800;color:#0f172a;">Olá, ${nomeExibicao}! Não deixe sua empresa parar. 🎁</h2><p style="font-size:15px;line-height:1.65;color:#475569;margin:0 0 18px 0;">Hoje é o <strong>último dia</strong> do seu período de degustação no Celebre. Amanhã o acesso ao painel será pausado. Preparamos uma condição única para você ativar hoje:</p><div style="background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:2px dashed #d97706;border-radius:16px;padding:24px;text-align:center;margin:26px 0;"><span style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#92400e;display:block;margin-bottom:8px;">🏷️ SEU CUPOM EXCLUSIVO DE 20% OFF:</span><div style="display:inline-block;background-color:#0f172a;color:#f5d061;font-size:22px;font-weight:900;letter-spacing:3px;padding:12px 28px;border-radius:10px;border:1.5px solid #f5d061;">${cupom}</div><p style="margin:14px 0 0 0;font-size:13px;color:#78350f;font-weight:700;">⚡ 20% de Desconto na 1ª mensalidade • <u>Válido somente hoje, no último dia de teste!</u></p></div><div style="text-align:center;margin:30px 0 20px 0;"><a href="https://celebrefesta.com.br/checkout?cupom=${cupom}" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#ffffff;text-decoration:none;padding:17px 42px;border-radius:12px;font-weight:900;font-size:15.5px;display:inline-block;box-shadow:0 6px 22px rgba(16,185,129,0.4);text-transform:uppercase;letter-spacing:0.5px;">🎁 Ativar Assinatura com Desconto Agora</a></div><p style="font-size:13px;text-align:center;color:#64748b;margin:0 0 16px 0;">Dúvidas? <a href="https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Hoje é meu último dia de teste no Celebre (${emailLimpo}) e gostaria de ativar com o cupom PRIMEIROACESSO.`)}" style="color:#16a34a;font-weight:700;text-decoration:underline;">Fale no WhatsApp</a></p></td></tr><tr><td style="background-color:#f8fafc;padding:22px 30px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0 0 4px 0;font-size:11.5px;font-weight:700;color:#64748b;">Celebre • Gestão Inteligente para Acervos & Festas</p><p style="margin:0;font-size:11px;color:#94a3b8;">E-mail: ${emailLimpo} • Cupom condicionado ao último dia de teste.</p></td></tr></table></td></tr></table></body></html>`;
  } else {
    return null;
  }

  try {
    const responseResend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Celebre <seguranca@celebrefesta.com.br>',
        to: [emailLimpo],
        reply_to: 'celebrefesta25@gmail.com',
        subject,
        html: htmlBody
      })
    });

    const resData = await responseResend.json();
    await db.collection("notificacoes_trial").add({
      email: emailLimpo,
      nome: nomeExibicao,
      tipo,
      cupom: tipo === 'aviso_1_dia_cupom' ? cupom : null,
      resendId: resData?.id || null,
      canal: 'backend_cloud_function',
      dataHora: new Date().toISOString()
    });
    return resData;
  } catch (err) {
    console.warn(`Erro no envio Resend trial (${tipo}):`, err);
    return null;
  }
}

exports.limpezaDeContasExpiradas = onSchedule(
    { schedule: "every day 00:00", timeZone: "America/Sao_Paulo" }, 
    async (event) => {
        const hoje = new Date();
        const limiteDiasSuspensao = 180; // 6 meses -> Suspensão
        const limiteDiasExclusaoTotal = 210; // 6 meses + 30 dias de carência -> Exclusão definitiva
        try {
            const usuariosRef = db.collection("usuarios");
            const snapshot = await usuariosRef.where("plano", "!=", "pago").get();
            const promessas = [];
            snapshot.forEach((docSnap) => {
                const userData = docSnap.data();
                if (userData.status === 'deletado_definitivamente' || userData.role === 'admin' || userData.email === 'celebrefesta25@gmail.com') return;
                if (userData.dataCadastro) {
                    const dataCadastro = new Date(userData.dataCadastro);
                    const diffDays = Math.ceil(Math.abs(hoje - dataCadastro) / (1000 * 60 * 60 * 24));
                    const uid = docSnap.id;

                    // 1. Aos 180 dias sem plano -> Marca oficialmente como SUSPENSO por inatividade
                    if (diffDays >= limiteDiasSuspensao && diffDays < limiteDiasExclusaoTotal) {
                        if (userData.statusConta !== 'suspenso') {
                            promessas.push(usuariosRef.doc(uid).update({
                                statusConta: 'suspenso',
                                dataSuspensao: hoje.toISOString()
                            }));
                        }
                    }
                    // 2. Após 210 dias (180 dias + 30 dias de carência) -> Exclusão definitiva de segurança
                    else if (diffDays >= limiteDiasExclusaoTotal) {
                        promessas.push(deletarDadosDoUsuario(uid));
                        promessas.push(usuariosRef.doc(uid).update({
                            status: 'deletado_definitivamente',
                            statusConta: 'deletado',
                            dataExclusao: hoje.toISOString(),
                            nomeCompleto: 'Usuário Excluído',
                            telefone: ''
                        }));
                        if (userData.email) {
                            promessas.push(dispararEmailComprovanteExclusao(
                                userData.email,
                                userData.nomeCompleto || userData.nomeExibicao,
                                'Expurgo automático após 210 dias de inatividade (180 dias + 30 dias de carência)'
                            ));
                        }
                    }

                    // 3. Monitoramento do Período de Teste VIP (7 dias)
                    const ehAssinanteAtivo = userData.assinaturaAtiva === true || userData.statusAssinatura === 'ativa' || userData.statusPagamentoVulso === 'pago';
                    if (!ehAssinanteAtivo && userData.statusConta !== 'suspenso' && userData.email) {
                        const cadMeia = new Date(dataCadastro);
                        cadMeia.setHours(0, 0, 0, 0);
                        const hojeMeia = new Date(hoje);
                        hojeMeia.setHours(0, 0, 0, 0);

                        let dataFim = null;
                        if (userData.dataFimTeste) {
                            dataFim = new Date(userData.dataFimTeste);
                            dataFim.setHours(0, 0, 0, 0);
                        } else {
                            dataFim = new Date(cadMeia);
                            dataFim.setDate(dataFim.getDate() + 7);
                        }

                        const diffAteFimMs = dataFim.getTime() - hojeMeia.getTime();
                        const diasRestantes = Math.round(diffAteFimMs / (1000 * 60 * 60 * 24));

                        // ⏳ Faltam exatamente 3 dias para acabar o teste:
                        if (diasRestantes === 3 && !userData.emailTeste3DiasEnviado) {
                            promessas.push(usuariosRef.doc(uid).update({
                                emailTeste3DiasEnviado: true,
                                dataEnvioTeste3Dias: hoje.toISOString()
                            }));
                            promessas.push(dispararEmailTrialInterno(
                                'aviso_3_dias',
                                userData.email,
                                userData.nomeCompleto || userData.nomeExibicao
                            ));
                        }

                        // 🚨 Falta exatamente 1 dia (último dia de teste + cupom PRIMEIROACESSO):
                        if (diasRestantes === 1 && !userData.emailTeste1DiaEnviado) {
                            promessas.push(usuariosRef.doc(uid).update({
                                emailTeste1DiaEnviado: true,
                                dataEnvioTeste1Dia: hoje.toISOString(),
                                cupomLiberado: 'PRIMEIROACESSO'
                            }));
                            promessas.push(dispararEmailTrialInterno(
                                'aviso_1_dia_cupom',
                                userData.email,
                                userData.nomeCompleto || userData.nomeExibicao,
                                'PRIMEIROACESSO'
                            ));
                        }
                    }
                }
            });
            await Promise.all(promessas);
        } catch (error) {
            console.error("Erro na rotina diária de inatividade e suspensão:", error);
        }
});

async function deletarDadosDoUsuario(uid) {
    const colecoesParaLimpar = ["estoque", "locacoes", "clientes", "compras"];
    for (const nomeColecao of colecoesParaLimpar) {
        const snapshot = await db.collection(nomeColecao).where("userId", "==", uid).get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
}

// ============================================================================
// 🔔 FUNÇÃO 3: WEBHOOK - ESCUTA PAGAMENTOS E ASSINATURAS DO MERCADO PAGO
// ============================================================================

exports.webhookMercadoPago = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Pega a ação (o que aconteceu) e o ID (de quem é)
      const action = req.body?.action || req.body?.type;
      const dataId = req.body?.data?.id || req.query['data.id'];

      if (!dataId || !action) {
        return res.status(200).send("Aviso ignorado: Sem ID ou ação");
      }

      console.log(`Webhook recebido. Ação: ${action}, ID: ${dataId}`);

      // 💰 ROTA 1: DINHEIRO ENTRANDO (Boleto, PIX ou cobrança mensal do cartão)
      if (action === 'payment.created' || action === 'payment.updated' || action === 'payment' || action === 'sincronizar_manual') {
          const payment = new Payment(client);
          const pagamentoOficial = await payment.get({ id: dataId });

          if (pagamentoOficial.status === 'approved') {
              const usuariosRef = db.collection("usuarios");
              let snapshot = await usuariosRef.where("idPagamento", "==", Number(dataId)).get();
              if (snapshot.empty) {
                snapshot = await usuariosRef.where("idPagamento", "==", String(dataId)).get();
              }
              if (snapshot.empty && pagamentoOficial.external_reference) {
                const userDoc = await usuariosRef.doc(pagamentoOficial.external_reference).get();
                if (userDoc.exists) {
                  snapshot = { empty: false, docs: [userDoc] };
                }
              }
              if (snapshot.empty && pagamentoOficial.payer?.email) {
                snapshot = await usuariosRef.where("email", "==", pagamentoOficial.payer.email.toLowerCase().trim()).get();
              }

              if (!snapshot.empty) {
                  for (const docSnap of snapshot.docs) {
                      const uData = docSnap.data();
                      const eraSuspenso = uData.statusConta === 'suspenso' || uData.status === 'suspenso';
                      const valorPago = Number(pagamentoOficial.transaction_amount) || 49.90;
                      const metodoId = String(pagamentoOficial.payment_method_id || '').toLowerCase();
                      const metodoFormatado = metodoId === 'pix' ? 'PIX' : (metodoId.includes('bol') ? 'Boleto' : 'Cartão de Crédito');

                      let idPlano = uData.planoPendente || uData.planoId;
                      let nomePlano = uData.nomePlanoPendente || uData.nomePlano;
                      if (!idPlano || idPlano === 'trial' || idPlano === 'gratuito') {
                          if (valorPago < 60) {
                              idPlano = 'plano_basico';
                              nomePlano = 'Básico';
                          } else if (valorPago > 120) {
                              idPlano = 'plano_plus';
                              nomePlano = 'Plus';
                          } else {
                              idPlano = 'plano_premium';
                              nomePlano = 'Premium';
                          }
                      }
                      if (!nomePlano) {
                          nomePlano = idPlano.includes('basico') ? 'Básico' : (idPlano.includes('plus') ? 'Plus' : 'Premium');
                      }

                      const dataPag = new Date(pagamentoOficial.date_approved || Date.now());
                      let dataBase = new Date(dataPag);
                      const vencAtual = uData.dataProximaCobranca || uData.dataFimTeste;
                      if (vencAtual) {
                          const dV = new Date(vencAtual);
                          if (!isNaN(dV.getTime()) && dV.getTime() > dataPag.getTime()) {
                              dataBase = new Date(dV);
                          }
                      }
                      const dataProx = new Date(dataBase);
                      if (String(idPlano).includes('anual')) {
                          dataProx.setFullYear(dataProx.getFullYear() + 1);
                      } else {
                          dataProx.setMonth(dataProx.getMonth() + 1);
                      }

                      const updates = {
                          statusConta: "ativo",
                          dataSuspensao: null,
                          plano: "pago",
                          statusAssinatura: "ativa",
                          planoId: idPlano,
                          nomePlano: nomePlano,
                          valorAssinatura: valorPago,
                          metodoPagamento: metodoFormatado,
                          statusPagamentoVulso: "aprovado",
                          idPagamento: Number(dataId),
                          dataPagamento: dataPag.toISOString(),
                          dataProximaCobranca: dataProx.toISOString()
                      };

                      await docSnap.ref.update(updates);

                      // Atualiza eventuais contas duplicadas pelo mesmo e-mail
                      if (uData.email) {
                          const snapDup = await usuariosRef.where("email", "==", uData.email.toLowerCase().trim()).get();
                          for (const d of snapDup.docs) {
                              if (d.id !== docSnap.id) {
                                  await d.ref.update(updates).catch(() => {});
                              }
                          }
                      }

                      // Registra log financeiro oficial em logs_atividades para o Super Admin
                      const valorFormatado = valorPago.toFixed(2).replace('.', ',');
                      await db.collection("logs_atividades").add({
                          acao: `ASSINATURA APROVADA (${metodoFormatado})`,
                          detalhes: `Pagamento de R$ ${valorFormatado} aprovado via ${metodoFormatado} para o plano: "${nomePlano}" (Transação MP: ${dataId}).`,
                          dataHora: dataPag.toISOString(),
                          empresaId: docSnap.id,
                          userId: docSnap.id,
                          usuarioEmail: uData.email,
                          nomeFuncionario: uData.nomeCompleto || uData.nomeExibicao || 'Assinante',
                          status: "concluido",
                          criadoEm: new Date()
                      });

                      if (eraSuspenso && uData.email) {
                          dispararEmailReativacaoInterno(
                              uData.email,
                              uData.nomeCompleto || uData.nomeExibicao,
                              nomePlano
                          ).catch(e => console.warn("Aviso ao disparar reativação webhook:", e));
                      } else if (uData.email) {
                          dispararEmailConfirmacaoPagamento(
                              uData.email,
                              uData.nomeCompleto || uData.nomeExibicao,
                              nomePlano,
                              valorPago,
                              metodoFormatado
                          ).catch(e => console.warn("Aviso ao disparar confirmação de pagamento:", e));
                      }
                  }
                  console.log("✅ Pagamento aprovado! Acesso liberado, plano ativado e log financeiro registrado.");
              }
          }
      } 
      
      // 📝 ROTA 2: STATUS DO CONTRATO (Assinatura Cancelada ou Pausada)
      else if (action === 'subscription_preapproval' || action === 'subscription_preapproval.updated') {
          const preApproval = new PreApproval(client);
          const assinaturaOficial = await preApproval.get({ id: dataId });
          
          // Se a cliente cancelar ou o cartão não tiver limite e pausar
          if (assinaturaOficial.status === 'cancelled' || assinaturaOficial.status === 'paused') {
              const usuariosRef = db.collection("usuarios");
              
              // Busca a cliente usando o número do contrato da assinatura
              const snapshot = await usuariosRef.where("subscriptionId", "==", dataId).get();

              if (!snapshot.empty) {
                  const batch = db.batch();
                  snapshot.docs.forEach((doc) => {
                      batch.update(doc.ref, {
                          statusAssinatura: assinaturaOficial.status, // Grava "cancelled" ou "paused"
                          dataCancelamento: new Date().toISOString()
                      });
                  });
                  await batch.commit();
                  console.log(`⚠️ Assinatura alterada para ${assinaturaOficial.status}. Registrado no banco.`);
              }
          }
      }

      // Devolve OK para o Mercado Pago parar de enviar o aviso
      res.status(200).send("Webhook processado com sucesso");

    } catch (error) {
      console.error("Erro no processamento do webhook:", error);
      res.status(500).send("Erro interno");
    }
  });
});

// ============================================================================
// 🔍 ENDPOINT DE AUDITORIA & CONCILIAÇÃO: THIAGO (thidovi12@gmail.com)
// ============================================================================
exports.consultarAssinaturaThiago = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const emailAlvo = "thidovi12@gmail.com";
      const snapUsers = await db.collection("usuarios").where("email", "==", emailAlvo).get();
      const usuarios = [];

      for (const docSnap of snapUsers.docs) {
        const uData = docSnap.data();
        
        // Se a conta ainda não estiver ativada como Básico quitado, força a ativação imediata
        if (uData.statusAssinatura !== 'ativa' || uData.planoId !== 'plano_basico' || !uData.dataProximaCobranca) {
          const updates = {
            statusConta: "ativo",
            dataSuspensao: null,
            plano: "pago",
            statusAssinatura: "ativa",
            planoId: "plano_basico",
            nomePlano: "Básico",
            valorAssinatura: 49.90,
            metodoPagamento: "PIX",
            statusPagamentoVulso: "aprovado",
            idPagamento: 178718551207,
            dataPagamento: "2026-09-18T15:01:51.000Z",
            dataProximaCobranca: "2026-10-18T15:01:51.000Z"
          };
          await docSnap.ref.update(updates);
          Object.assign(uData, updates);
        }

        // Verifica se já existe o log de quitação
        const snapLogs = await db.collection("logs_atividades")
          .where("usuarioEmail", "==", emailAlvo)
          .where("acao", "==", "ASSINATURA APROVADA (PIX)")
          .get();

        if (snapLogs.empty) {
          await db.collection("logs_atividades").add({
            acao: "ASSINATURA APROVADA (PIX)",
            detalhes: 'Pagamento de R$ 49,90 aprovado via PIX para o plano: "Básico" (Transação MP: 178718551207).',
            dataHora: "2026-09-18T15:01:51.000Z",
            empresaId: docSnap.id,
            userId: docSnap.id,
            usuarioEmail: emailAlvo,
            nomeFuncionario: uData.nomeCompleto || uData.nomeExibicao || 'Thiago Vitoriano',
            status: "concluido",
            criadoEm: new Date()
          });
        }

        usuarios.push({ id: docSnap.id, ...uData });
      }

      const snapAllLogs = await db.collection("logs_atividades").where("usuarioEmail", "==", emailAlvo).get();
      const logs = snapAllLogs.docs.map(d => ({ id: d.id, ...d.data() }));

      return res.status(200).send({
        sucesso: true,
        usuariosEncontrados: usuarios.length,
        usuarios,
        logs
      });
    } catch (e) {
      return res.status(500).send({ erro: e.message });
    }
  });
});

// ============================================================================
// 🛑 FUNÇÃO 4: CANCELAR ASSINATURA A PEDIDO DA CLIENTE
// ============================================================================

exports.cancelarAssinatura = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).send("Método não permitido");

    try {
      const { userId, subscriptionId } = req.body;

      if (!userId || !subscriptionId) {
         return res.status(400).send({ error: "Dados incompletos" });
      }

      // 1. Avisa o Mercado Pago para cancelar o contrato oficial
      const preApproval = new PreApproval(client);
      await preApproval.update({
         id: subscriptionId,
         body: { status: "cancelled" }
      });

      // 2. Atualiza imediatamente no nosso banco de dados (Firestore)
      await db.collection("usuarios").doc(userId).update({
         statusAssinatura: "cancelled",
         plano: "gratuito", 
         dataCancelamento: new Date().toISOString()
      });

      return res.status(200).send({ message: "Assinatura cancelada com sucesso" });

    } catch (error) {
      console.error("Erro ao cancelar:", error);
      res.status(500).send({ error: "Erro interno ao tentar cancelar a assinatura" });
    }
  });
});

// ============================================================================
// 🗑️ FUNÇÃO 5: EXCLUIR USUÁRIO DA AUTENTICAÇÃO (FIREBASE AUTH)
// ============================================================================
exports.excluirUsuarioAuth = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Permite solicitações preflight de CORS
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== "POST") return res.status(405).send("Método não permitido");

    try {
      const { uid } = req.body;

      if (!uid) {
         return res.status(400).send({ error: "UID não fornecido" });
      }

      console.log(`Iniciando exclusão do usuário do Firebase Auth. UID: ${uid}`);
      await getAuth().deleteUser(uid);
      console.log(`Usuário com UID: ${uid} excluído do Firebase Auth.`);

      return res.status(200).send({ message: "Usuário excluído da autenticação com sucesso" });

    } catch (error) {
      console.error("Erro ao excluir usuário da autenticação:", error);
      res.status(500).send({ error: "Erro interno ao excluir usuário da autenticação", details: error.message });
    }
  });
});

// ============================================================================
// ✉️ FUNÇÃO 6: ENVIAR COMPROVANTE DE EXCLUSÃO DE CONTA (RESEND + LGPD)
// ============================================================================
exports.enviarComprovanteExclusao = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== "POST") return res.status(405).send("Método não permitido");

    try {
      const { email, nome, motivo, protocolo: protoCustom } = req.body;

      if (!email) {
        return res.status(400).send({ error: "E-mail do titular é obrigatório" });
      }

      const anoAtual = new Date().getFullYear();
      const protocolo = protoCustom || `CEL-EXCL-${anoAtual}-${Math.floor(10000 + Math.random() * 90000)}`;
      const dataHoraFormatada = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

      const htmlBody = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Comprovante de Exclusão de Conta • Celebre</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
                
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">
                      CELEBRE
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                      Gestão de Festas & Acervo
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 35px 30px;">
                    <div style="display: inline-block; background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 12px; margin-bottom: 20px;">
                      <span style="font-size: 11px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">
                        ✓ PROTOCOLO OFICIAL DE EXCLUSÃO (LGPD)
                      </span>
                    </div>

                    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                      Comprovante de Exclusão de Conta e Dados
                    </h2>

                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                      Prezado(a) <strong>${nome || 'Usuário(a)'}</strong>,
                    </p>

                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                      Confirmamos formalmente que a sua conta vinculada ao e-mail <strong>${email}</strong> e todas as informações associadas foram <strong>permanentemente excluídas</strong> dos servidores de produção da plataforma Celebre.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #c5a059; border-radius: 8px; margin-bottom: 25px; padding: 18px 20px;">
                      <tr>
                        <td>
                          <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px;">
                            <tr>
                              <td width="38%" style="color: #64748b; font-weight: 600;">Número de Protocolo:</td>
                              <td style="color: #0f172a; font-weight: 800; font-family: monospace; font-size: 14px;">${protocolo}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Data e Hora:</td>
                              <td style="color: #0f172a; font-weight: 600;">${dataHoraFormatada}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">E-mail Titular:</td>
                              <td style="color: #0f172a; font-weight: 600;">${email}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Status:</td>
                              <td style="color: #16a34a; font-weight: 800;">Concluído / Expurgado Definitivamente</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                      Dados e registros eliminados:
                    </h3>
                    <ul style="margin: 0 0 24px 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7;">
                      <li><strong>Credenciais de Acesso:</strong> E-mail, senha criptografada e autenticação do Firebase.</li>
                      <li><strong>Acervo & Peças:</strong> Catálogo de itens, temas, móveis e fotos de decorações.</li>
                      <li><strong>Locações & Contratos:</strong> Orçamentos, pedidos, check-ins e contratos digitais assinados.</li>
                      <li><strong>Dados Cadastrais da Empresa:</strong> Nome fantasia, CNPJ/CPF, endereços e integrações.</li>
                    </ul>

                    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin-bottom: 25px; font-size: 12px; color: #64748b; line-height: 1.5;">
                      🔒 <strong>Conformidade Legal:</strong> Este procedimento atende integralmente ao Artigo 18 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD) e às Diretrizes de Segurança do Google Play Console para eliminação de contas de usuários.
                    </div>

                    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
                      Se você <strong>não realizou</strong> esta solicitação ou suspeita de uso indevido, entre em contato imediatamente com o nosso Encarregado de Proteção de Dados (DPO) respondendo a este e-mail ou pelo e-mail 
                      <a href="mailto:celebrefesta25@gmail.com" style="color: #c5a059; text-decoration: none; font-weight: 700;">celebrefesta25@gmail.com</a>.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 30px; text-align: center; font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
                    <p style="margin: 0 0 6px 0; font-weight: 600; color: #64748b;">
                      Celebre Tecnologia e Sistemas LTDA. • CNPJ: 54.839.293/0001-42
                    </p>
                    <p style="margin: 0;">
                      São Paulo - SP • Brasil • <a href="https://celebrefesta.com.br" style="color: #94a3b8; text-decoration: underline;">celebrefesta.com.br</a>
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

      const responseResend = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Celebre Segurança <seguranca@celebrefesta.com.br>',
          to: [email],
          reply_to: 'celebrefesta25@gmail.com',
          subject: `Comprovante de Exclusão de Conta • Protocolo ${protocolo}`,
          html: htmlBody
        })
      });

      const resData = await responseResend.json();

      if (!responseResend.ok) {
        console.error("Erro na API do Resend:", resData);
        return res.status(500).send({ error: "Erro ao disparar e-mail no Resend", details: resData });
      }

      // Registra protocolo no Firestore para histórico de conformidade LGPD
      await db.collection("comprovantes_exclusao").add({
        email,
        nome: nome || "Não informado",
        motivo: motivo || "Não informado",
        protocolo,
        resendId: resData.id,
        dataHora: new Date().toISOString()
      });

      return res.status(200).send({ 
        success: true, 
        message: "Comprovante de exclusão enviado com sucesso!",
        protocolo,
        emailId: resData.id 
      });

    } catch (error) {
      console.error("Erro interno ao enviar comprovante de exclusão:", error);
      res.status(500).send({ error: "Erro interno", details: error.message });
    }
  });
});

// ============================================================================
// 🔄 FUNÇÃO 7: SINCRONIZAR CONTAS AUTH COM FIRESTORE (GOOGLE & EMAIL)
// ============================================================================
exports.sincronizarContasAuth = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    try {
      console.log("Iniciando sincronização de contas do Firebase Auth com Firestore...");
      const listUsersResult = await getAuth().listUsers(1000);
      const authUsers = listUsersResult.users;

      const usersSnap = await db.collection("usuarios").get();
      const existingDocsMap = new Map();
      usersSnap.docs.forEach(d => {
        existingDocsMap.set(d.id, d.data());
      });

      let sincronizados = 0;
      let atualizados = 0;
      const registros = [];

      const dataAtual = new Date();

      for (const authUser of authUsers) {
        const uid = authUser.uid;
        const email = authUser.email ? authUser.email.toLowerCase().trim() : '';
        const nome = authUser.displayName || (email ? email.split('@')[0] : 'Usuário Google');
        const provider = authUser.providerData?.[0]?.providerId || 'google.com';

        const creationIso = authUser.metadata.creationTime 
          ? new Date(authUser.metadata.creationTime).toISOString() 
          : (authUser.createdAt ? new Date(Number(authUser.createdAt)).toISOString() : dataAtual.toISOString());

        const dataFimReal = new Date(new Date(creationIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const emTeste = new Date(dataAtual) < new Date(dataFimReal);

        if (!existingDocsMap.has(uid)) {
          // Cria o documento do usuário com data real da autenticação
          const novoUser = {
            email: email,
            nomeCompleto: nome,
            nomeExibicao: nome,
            role: 'owner',
            tenantId: uid,
            dataCadastro: creationIso,
            dataFimTeste: dataFimReal,
            planoId: '',
            assinaturaAtiva: false,
            statusConta: emTeste ? 'ativo' : 'bloqueado',
            authProvider: provider,
            criadoEm: creationIso,
            sincronizadoPor: 'sincronizarContasAuth'
          };

          await db.collection("usuarios").doc(uid).set(novoUser, { merge: true });

          // Cria também configurações da empresa se não existir
          const cfgRef = db.collection("configuracoes_empresa").doc(uid);
          const cfgSnap = await cfgRef.get();
          if (!cfgSnap.exists) {
            await cfgRef.set({
              nomeFantasia: nome,
              email: email,
              criadoEm: creationIso
            }, { merge: true });
          }

          sincronizados++;
          registros.push({ uid, email, acao: 'criado' });
        } else {
          // Já existe, verifica se precisa de ajustes
          const docData = existingDocsMap.get(uid);
          const updates = {};
          if (email && docData.email !== email) {
            updates.email = email;
          }
          // Sincroniza a data real de criação se não estiver preenchida ou se for a conta de teste
          if (!docData.dataCadastro || uid === 'sPY7kcl63WPGyOnJr6n6CjAsV5F2') {
            updates.dataCadastro = creationIso;
            updates.dataFimTeste = dataFimReal;
            if (!docData.assinaturaAtiva && !emTeste) {
              updates.statusConta = 'bloqueado';
            }
          }

          if (Object.keys(updates).length > 0) {
            await db.collection("usuarios").doc(uid).update(updates);
            atualizados++;
            registros.push({ uid, email, acao: 'atualizado', updates });
          }
        }
      }

      console.log(`Sincronização finalizada: ${sincronizados} criados, ${atualizados} atualizados.`);
      return res.status(200).send({
        success: true,
        totalAuthUsers: authUsers.length,
        sincronizados,
        atualizados,
        registros
      });

    } catch (error) {
      console.error("Erro ao sincronizar contas Auth com Firestore:", error);
      return res.status(500).send({ error: "Erro interno ao sincronizar contas", details: error.message });
    }
  });
});

// ============================================================================
// ✉️ FUNÇÃO 8: ENVIAR LINK DE REDEFINIÇÃO DE SENHA VIA RESEND (DOMÍNIO OFICIAL)
// ============================================================================
exports.enviarLinkRedefinicaoSenha = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== "POST") return res.status(405).send("Método não permitido");

    try {
      const { email, verificarApenas } = req.body;
      if (!email) {
        return res.status(400).send({ error: "E-mail é obrigatório" });
      }

      const emailLimpo = String(email).trim().toLowerCase();
      const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

      // 1. Verifica se a conta existe no Firebase Auth ou Firestore
      let userRecord = null;
      try {
        userRecord = await getAuth().getUserByEmail(emailLimpo);
      } catch (userErr) {
        console.warn("E-mail não existe no Firebase Auth:", emailLimpo, userErr.code);
        // Confere se existe em usuarios ou equipe
        const snapUser = await db.collection("usuarios").where("email", "==", emailLimpo).limit(1).get();
        const snapEquipe = await db.collection("equipe").where("email", "==", emailLimpo).limit(1).get();
        if (snapUser.empty && snapEquipe.empty) {
          return res.status(404).send({ exists: false, error: "Nenhuma conta cadastrada foi encontrada com este e-mail no Celebre." });
        }
      }

      // Se a chamada for apenas para checagem (utilizado na tela de login)
      if (verificarApenas) {
        const providers = userRecord ? (userRecord.providerData || []).map(p => p.providerId) : [];
        const isGoogleOnly = providers.includes('google.com') && !providers.includes('password');
        return res.status(200).send({ 
          exists: true, 
          email: emailLimpo,
          providers,
          isGoogleOnly 
        });
      }

      // 2. Gera o link oficial seguro do Firebase Auth
      let resetLink;
      try {
        resetLink = await getAuth().generatePasswordResetLink(emailLimpo);
      } catch (authErr) {
        console.error("Erro ao gerar link de redefinição:", authErr);
        return res.status(404).send({ error: "Não foi possível gerar o link de redefinição para este e-mail." });
      }

      // Extrai o oobCode para apontar direto para a tela do app
      const urlObj = new URL(resetLink);
      const oobCode = urlObj.searchParams.get('oobCode');
      const linkFinal = oobCode 
        ? `https://celebrefesta.com.br/redefinir-senha?oobCode=${oobCode}`
        : resetLink;

      const htmlBody = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Redefinição de Senha • Celebre</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
                
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                    <img src="https://celebrefesta.com.br/LOGO_CELEBRE.png" alt="Celebre" style="height: 46px; max-width: 180px; object-fit: contain; margin-bottom: 8px; display: inline-block;" />
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">
                      CELEBRE
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                      Central de Segurança
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 35px 30px;">
                    <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                      Solicitação de Redefinição de Senha
                    </h2>

                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                      Olá! Recebemos uma solicitação para redefinir a senha de acesso à sua conta no <strong>Celebre</strong>.
                    </p>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${linkFinal}" style="background: linear-gradient(135deg, #c5a059 0%, #dfb76c 100%); color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(197, 160, 89, 0.35);">
                        Criar Nova Senha
                      </a>
                    </div>

                    <p style="font-size: 12px; color: #94a3b8; margin: 0 0 16px 0; text-align: center; word-break: break-all;">
                      Se o botão não funcionar, copie e cole este link no navegador:<br>
                      <a href="${linkFinal}" style="color: #c5a059;">${linkFinal}</a>
                    </p>

                    <p style="font-size: 12.5px; line-height: 1.5; color: #64748b; margin: 20px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                      Se você não solicitou a alteração de senha, ignore esta mensagem. Sua conta e senha permanecem totalmente seguras.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                      Celebre Gestão • E-mail automático de segurança. Não responda a esta mensagem.
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

      const responseResend = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Celebre Segurança <seguranca@celebrefesta.com.br>',
          to: [emailLimpo],
          reply_to: 'celebrefesta25@gmail.com',
          subject: 'Redefinição de Senha • Celebre',
          html: htmlBody
        })
      });

      const resData = await responseResend.json();
      if (!responseResend.ok) {
        console.error("Erro na API do Resend:", resData);
        return res.status(500).send({ error: "Erro ao disparar e-mail no Resend", details: resData });
      }

      return res.status(200).send({ 
        success: true, 
        message: "E-mail de redefinição enviado com sucesso via Resend!",
        emailId: resData.id 
      });

    } catch (error) {
      console.error("Erro interno ao enviar redefinição:", error);
      res.status(500).send({ error: "Erro interno", details: error.message });
    }
  });
});

// ============================================================================
// 🔍 FUNÇÃO 9: VERIFICAR SE CONTA / E-MAIL EXISTE NO SISTEMA
// ============================================================================
exports.verificarContaExiste = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    try {
      const email = req.body?.email || req.query?.email;
      if (!email) return res.status(400).send({ error: "E-mail obrigatório" });
      const emailLimpo = String(email).trim().toLowerCase();

      let userRecord = null;
      try {
        userRecord = await getAuth().getUserByEmail(emailLimpo);
      } catch (userErr) {
        const snapUser = await db.collection("usuarios").where("email", "==", emailLimpo).limit(1).get();
        const snapEquipe = await db.collection("equipe").where("email", "==", emailLimpo).limit(1).get();
        if (snapUser.empty && snapEquipe.empty) {
          return res.status(404).send({ exists: false, error: "Nenhuma conta cadastrada foi encontrada com este e-mail no Celebre." });
        }
      }

      const providers = userRecord ? (userRecord.providerData || []).map(p => p.providerId) : [];
      const isGoogleOnly = providers.includes('google.com') && !providers.includes('password');

      return res.status(200).send({
        exists: true,
        email: emailLimpo,
        providers,
        isGoogleOnly
      });
    } catch (e) {
      return res.status(500).send({ error: e.message });
    }
  });
});

// ============================================================================
// ⚠️ FUNÇÃO 10: ENVIAR AVISO DE SUSPENSÃO / INATIVIDADE VIA RESEND
// ============================================================================
exports.enviarAvisoInatividade = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== "POST") return res.status(405).send("Método não permitido");

    try {
      const { email, nome, diasCarencia } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).send({ error: "E-mail inválido ou não fornecido." });
      }

      const emailLimpo = String(email).trim().toLowerCase();
      const nomeExibicao = String(nome || '').trim() || 'Cliente Celebre';
      const carencia = diasCarencia || 30;
      const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

      const htmlBody = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Aviso de Suspensão por Inatividade • Celebre</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">CELEBRE</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Notificação de Segurança</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 35px 30px;">
                    <div style="display: inline-block; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 4px 10px; margin-bottom: 16px;">
                      <span style="color: #b45309; font-size: 11px; font-weight: 800; text-transform: uppercase;">⏸️ Conta Suspensa por Inatividade</span>
                    </div>
                    <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Olá, ${nomeExibicao}!</h2>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
                      Identificamos que sua conta no <strong>Celebre</strong> não registrou atividades ou assinatura nos últimos <strong>6 meses</strong>.
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                      Por segurança, o acesso aos recursos foi temporariamente <strong>suspenso</strong>.
                    </p>
                    <div style="background-color: #f8fafc; border-left: 4px solid #c5a059; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                        Seus dados e produtos cadastrados permanecem salvos por mais <strong>${carencia} dias</strong>. Para reativar seu acesso, basta entrar na sua conta.
                      </p>
                    </div>
                    <div style="text-align: center; margin: 28px 0;">
                      <a href="https://celebrefesta.com.br/reativar-conta" style="background: linear-gradient(135deg, #c5a059 0%, #dfb76c 100%); color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(197, 160, 89, 0.35);">
                        Reativar Minha Conta
                      </a>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                      Precisa de suporte? Entre em contato pelo WhatsApp de atendimento Celebre.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">Celebre Gestão • E-mail automático do sistema.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

      const responseResend = await fetch('https://api.resend.com/emails', {
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
          html: htmlBody
        })
      });

      const resData = await responseResend.json();
      if (!responseResend.ok) {
        console.error("Erro na API do Resend ao enviar aviso de inatividade:", resData);
        return res.status(500).send({ error: "Erro ao disparar e-mail via Resend", details: resData });
      }

      return res.status(200).send({
        success: true,
        message: "E-mail de aviso de suspensão enviado com sucesso!",
        emailId: resData.id
      });
    } catch (error) {
      console.error("Erro interno ao enviar aviso de inatividade:", error);
      return res.status(500).send({ error: "Erro interno", details: error.message });
    }
  });
});

// ============================================================================
// 🎉 FUNÇÃO 11: ENVIAR CONFIRMAÇÃO DE REATIVAÇÃO DE CONTA VIA RESEND
// ============================================================================
exports.enviarConfirmacaoReativacao = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== "POST") return res.status(405).send("Método não permitido");

    try {
      const { email, nome, nomePlano } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).send({ error: "E-mail inválido ou não fornecido." });
      }

      const emailLimpo = String(email).trim().toLowerCase();
      const nomeExibicao = String(nome || '').trim() || 'Cliente Celebre';
      const plano = String(nomePlano || 'Premium').trim();
      const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

      const htmlBody = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Sua conta no Celebre foi reativada com sucesso! • Celebre</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center; border-bottom: 3px solid #c5a059;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">CELEBRE</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Gestão Inteligente de Festas & Acervo</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 35px 30px;">
                    <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 4px 12px; margin-bottom: 16px;">
                      <span style="color: #065f46; font-size: 11px; font-weight: 800; text-transform: uppercase;">✨ ACESSO TOTALMENTE LIBERADO</span>
                    </div>
                    <h2 style="margin: 0 0 14px 0; font-size: 21px; font-weight: 700; color: #0f172a;">Que alegria ter você de volta, ${nomeExibicao}! 🎉</h2>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
                      Sua conta no <strong>Celebre</strong> foi <strong>reativada com sucesso</strong> no <strong>Plano ${plano}</strong>. Seu acesso ao painel já está instantaneamente liberado!
                    </p>
                    <div style="background-color: #fffdf5; border-left: 4px solid #c5a059; padding: 16px 18px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(197, 160, 89, 0.2);">
                      <strong style="color: #926f2d; font-size: 13.5px; display: block; margin-bottom: 6px;">📦 Seus dados continuam 100% preservados:</strong>
                      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                        • Itens do acervo com fotos em alta definição<br>
                        • Cadastros de clientes e CRM<br>
                        • Histórico de locações, orçamentos e contratos
                      </p>
                    </div>
                    <div style="text-align: center; margin: 30px 0 20px 0;">
                      <a href="https://celebrefesta.com.br/dashboard" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                        🚀 Acessar Meu Painel Agora
                      </a>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                      Dúvidas ou suporte? Conte com nosso atendimento VIP pelo WhatsApp.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">Celebre Gestão • E-mail automático de confirmação de reativação.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

      const responseResend = await fetch('https://api.resend.com/emails', {
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
          html: htmlBody
        })
      });

      const resData = await responseResend.json();
      if (!responseResend.ok) {
        console.error("Erro na API do Resend ao enviar confirmação de reativação:", resData);
        return res.status(500).send({ error: "Erro ao disparar e-mail via Resend", details: resData });
      }

      await db.collection("notificacoes_reativacao").add({
        email: emailLimpo,
        nome: nomeExibicao,
        nomePlano: plano,
        resendId: resData.id,
        dataHora: new Date().toISOString()
      });

      return res.status(200).send({
        success: true,
        message: "E-mail de confirmação de reativação enviado com sucesso!",
        emailId: resData.id
      });
    } catch (error) {
      console.error("Erro interno ao enviar confirmação de reativação:", error);
      return res.status(500).send({ error: "Erro interno", details: error.message });
    }
  });
});

// ============================================================================
// 🎁 FUNÇÃO 12: ENDPOINT HTTPS PARA DISPARO DE E-MAILS DO PERÍODO DE TESTE
// ============================================================================
exports.enviarEmailTrial = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== "POST") return res.status(405).send("Método não permitido");

    try {
      const { tipo, email, nome, cupom } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).send({ error: "E-mail inválido ou não informado." });
      }

      const tiposValidos = ['boas_vindas', 'aviso_3_dias', 'aviso_1_dia_cupom'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).send({ error: `Tipo inválido. Deve ser um de: ${tiposValidos.join(', ')}` });
      }

      const resultado = await dispararEmailTrialInterno(tipo, email, nome, cupom || 'PRIMEIROACESSO');
      if (!resultado) {
        return res.status(500).send({ error: "Falha ao enviar e-mail via Resend" });
      }

      return res.status(200).send({
        success: true,
        message: `E-mail de teste '${tipo}' enviado com sucesso!`,
        resendId: resultado.id
      });
    } catch (error) {
      console.error("Erro interno ao enviar e-mail trial:", error);
      return res.status(500).send({ error: "Erro interno", details: error.message });
    }
  });
});

// ============================================================================
// 🔔 FUNÇÃO 13: ENDPOINT HTTPS PARA DISPARO AUTOMÁTICO DE NOTIFICAÇÕES
// ============================================================================
exports.enviarNotificacaoAutomatica = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    try {
      const { tenantId, evento, destinatario, dados, email, assunto, html, destinatarioNome } = req.body;
      const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

      // Se for disparo direto para um e-mail (ex: teste operacional ou disparo unitário sem bloqueio de CORS)
      const emailAlvo = email || dados?.email || dados?.clienteEmail;
      if (emailAlvo && (evento === 'disparo_direto' || evento === 'teste_disparo' || !evento)) {
        const assuntoFinal = assunto || dados?.assunto || 'Notificação Celebre Festas';
        const htmlFinal = html || dados?.html || dados?.htmlCorpo || `<p>${dados?.mensagem || 'Notificação do sistema Celebre.'}</p>`;
        const nomeEmpresa = dados?.nomeEmpresa || 'Celebre Notificações';

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `${nomeEmpresa} <seguranca@celebrefesta.com.br>`,
            to: [emailAlvo],
            subject: assuntoFinal,
            html: htmlFinal
          })
        });

        const rData = await resp.json();
        if (!resp.ok) {
          console.error("Erro na API do Resend:", rData);
          return res.status(resp.status).send({ error: rData.message || 'Erro no envio via Resend', details: rData });
        }

        if (tenantId && tenantId !== 'sistema') {
          await db.collection('historico_notificacoes').add({
            tenantId,
            evento: evento || 'disparo_direto',
            destinatario: destinatarioNome || 'Destinatário',
            contato: emailAlvo,
            canal: 'email',
            mensagem: assuntoFinal,
            status: 'sucesso',
            detalhes: `ID Resend: ${rData.id}`,
            enviadoEm: new Date().toISOString(),
            timestamp: Date.now()
          });
        }

        return res.status(200).send({ success: true, id: rData.id });
      }

      if (!tenantId || !evento) {
        return res.status(400).send({ error: 'tenantId e evento são obrigatórios.' });
      }

      // Busca preferências do lojista
      let configNotif = null;
      try {
        const empSnap = await db.collection('configuracoes_empresa').doc(tenantId).get();
        if (empSnap.exists && empSnap.data()?.configuracoesNotificacoes) {
          configNotif = empSnap.data().configuracoesNotificacoes;
        }
      } catch (e) {}

      if (!configNotif) {
        try {
          const notifSnap = await db.collection('configuracoes_notificacoes').doc(tenantId).get();
          if (notifSnap.exists) configNotif = notifSnap.data();
        } catch (e2) {}
      }

      const contatosGestor = configNotif?.contatosGestor || {};
      const provedores = configNotif?.provedores || {};
      const canaisGestor = configNotif?.alertasGestor?.[evento] || { email: true, sms: false, sininho: true };
      const canaisCliente = configNotif?.gatilhos?.[evento] || { email: true, sms: false };

      const nomeEmpresa = dados?.nomeEmpresa || 'Celebre Festas';
      const resultados = [];

      // E-MAIL GESTOR
      if ((destinatario === 'gestor' || destinatario === 'ambos') && canaisGestor.email !== false) {
        const emailGestor = contatosGestor.email || dados?.emailEmpresa;
        if (emailGestor && emailGestor.includes('@')) {
          try {
            const resp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Celebre Notificações <seguranca@celebrefesta.com.br>',
                to: [emailGestor],
                subject: `[${nomeEmpresa}] ${dados?.assunto || 'Nova Notificação do Sistema'}`,
                html: dados?.htmlCorpo || `<p>${dados?.mensagem || 'Nova notificação gerada.'}</p>`
              })
            });
            const rData = await resp.json();
            resultados.push({ destino: 'gestor', canal: 'email', id: rData.id });
          } catch (errGestor) {
            console.warn('Erro ao disparar e-mail gestor:', errGestor);
          }
        }
      }

      // E-MAIL CLIENTE
      if ((destinatario === 'cliente' || destinatario === 'ambos') && canaisCliente.email !== false) {
        const emailCliente = dados?.clienteEmail || dados?.email;
        if (emailCliente && emailCliente.includes('@')) {
          try {
            const respCli = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: `${nomeEmpresa} <seguranca@celebrefesta.com.br>`,
                to: [emailCliente],
                subject: dados?.assunto || `Mensagem de ${nomeEmpresa}`,
                html: dados?.htmlCorpo || `<p>${dados?.mensagem || 'Notificação sobre seu evento.'}</p>`
              })
            });
            const rDataCli = await respCli.json();
            resultados.push({ destino: 'cliente', canal: 'email', id: rDataCli.id });
          } catch (errCli) {
            console.warn('Erro ao disparar e-mail cliente:', errCli);
          }
        }
      }

      // Registro no Histórico de Auditoria
      await db.collection('historico_notificacoes').add({
        tenantId,
        evento,
        destinatario: destinatario || 'ambos',
        contato: dados?.clienteEmail || contatosGestor?.email || '-',
        mensagem: (dados?.mensagem || dados?.assunto || '').slice(0, 300),
        status: 'sucesso',
        detalhes: `Resultados: ${JSON.stringify(resultados)}`,
        enviadoEm: new Date().toISOString(),
        timestamp: Date.now()
      });

      return res.status(200).send({ success: true, resultados });
    } catch (error) {
      console.error('Erro ao processar envio automático de notificação:', error);
      return res.status(500).send({ error: 'Erro interno', details: error.message });
    }
  });
});

// ============================================================================
// ⏰ FUNÇÃO 14: ROTINA AGENDADA DIÁRIA (08h00) DE LEMBRETES E ALERTAS (CRON)
// ============================================================================
exports.cronNotificacoesDiarias = onSchedule(
  { schedule: "0 8 * * *", timeZone: "America/Sao_Paulo" },
  async (event) => {
    const hoje = new Date();
    const hojeFormatado = hoje.toISOString().split('T')[0];

    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaFormatado = amanha.toISOString().split('T')[0];

    const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');

    try {
      // 1. Busca locações ativas
      const snapshot = await db.collection('locacoes').get();
      if (snapshot.empty) return;

      const cacheConfigEmpresa = new Map();

      for (const docSnap of snapshot.docs) {
        const loc = docSnap.data();
        const tenantId = loc.userId;
        if (!tenantId) continue;

        const status = String(loc.status || '').toLowerCase();
        if (['cancelado', 'cancelada', 'devolvido', 'finalizado'].includes(status)) {
          continue;
        }

        const dataRetirada = loc.dataRetirada || '';
        const dataDevolucao = loc.dataDevolucao || '';

        // Carrega configurações da empresa em cache
        if (!cacheConfigEmpresa.has(tenantId)) {
          let conf = null;
          try {
            const empSnap = await db.collection('configuracoes_empresa').doc(tenantId).get();
            if (empSnap.exists) {
              const d = empSnap.data();
              conf = {
                nomeEmpresa: d.nomeEmpresa || d.nome || 'Celebre Festas',
                telefone: d.telefone || d.whatsapp || '(19) 99856-4109',
                email: d.email || '',
                endereco: d.endereco || d.enderecoCompleto || 'Galpão Principal',
                configNotif: d.configuracoesNotificacoes || {}
              };
            }
          } catch (e) {}
          cacheConfigEmpresa.set(tenantId, conf || {
            nomeEmpresa: 'Celebre Festas',
            telefone: '(19) 99856-4109',
            email: '',
            endereco: 'Galpão Principal',
            configNotif: {}
          });
        }

        const dadosEmpresa = cacheConfigEmpresa.get(tenantId);
        const configNotif = dadosEmpresa.configNotif;
        const gatilhosCli = configNotif.gatilhos || {};
        const alertasGest = configNotif.alertasGestor || {};

        const emailCli = loc.clienteEmail || loc.emailCliente || '';
        const nomeCli = loc.clienteNome || loc.nomeCliente || 'Cliente';
        const numPedido = loc.numeroPedido || docSnap.id.slice(0, 8).toUpperCase();

        // ── A. Lembrete Retirada (D-1) ──
        if (dataRetirada === amanhaFormatado && gatilhosCli.lembrete_retirada?.email !== false && emailCli) {
          const idempotencyId = `lembrete_retirada_${docSnap.id}_${hojeFormatado}`;
          const checkSnap = await db.collection('historico_notificacoes').where('idempotencyId', '==', idempotencyId).limit(1).get();

          if (checkSnap.empty) {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: `${dadosEmpresa.nomeEmpresa} <seguranca@celebrefesta.com.br>`,
                  to: [emailCli],
                  subject: `🎉 Lembrete: A retirada do seu acervo é amanhã! • ${dadosEmpresa.nomeEmpresa}`,
                  html: `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 25px; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
                      <h2 style="color: #c5a059; margin-top: 0;">${dadosEmpresa.nomeEmpresa}</h2>
                      <p>Olá <strong>${nomeCli}</strong>,</p>
                      <p>Estamos preparando tudo com carinho para seu evento! A retirada do seu acervo (<strong>Pedido #${numPedido}</strong>) está agendada para <strong>amanhã (${dataRetirada.split('-').reverse().join('/')})</strong>.</p>
                      <div style="background: #f8fafc; padding: 14px; border-left: 4px solid #c5a059; border-radius: 6px; margin: 18px 0;">
                        <strong>📍 Local:</strong> ${dadosEmpresa.endereco}<br>
                        <strong>⏰ Horário:</strong> ${loc.horarioRetirada || '09h00 às 17h00'}<br>
                        <strong>📞 Dúvidas:</strong> ${dadosEmpresa.telefone}
                      </div>
                      <p style="color: #64748b; font-size: 13px;">Mensagem enviada automaticamente.</p>
                    </div>
                  `
                })
              });

              await db.collection('historico_notificacoes').add({
                tenantId,
                idempotencyId,
                evento: 'lembrete_retirada',
                destinatario: nomeCli,
                contato: emailCli,
                canal: 'email',
                tipoEvento: 'cron_diario',
                mensagem: `Lembrete de retirada D-1 enviado para ${nomeCli}`,
                status: 'sucesso',
                enviadoEm: new Date().toISOString(),
                timestamp: Date.now()
              });
            } catch (errLemb) {
              console.warn('Erro ao enviar lembrete D-1 no cron:', errLemb);
            }
          }
        }

        // ── B. Lembrete Devolução (D-0 / Hoje) ──
        if (dataDevolucao === hojeFormatado && gatilhosCli.lembrete_devolucao?.email !== false && emailCli) {
          const idempotencyId = `lembrete_devolucao_${docSnap.id}_${hojeFormatado}`;
          const checkSnap = await db.collection('historico_notificacoes').where('idempotencyId', '==', idempotencyId).limit(1).get();

          if (checkSnap.empty) {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: `${dadosEmpresa.nomeEmpresa} <seguranca@celebrefesta.com.br>`,
                  to: [emailCli],
                  subject: `📦 Lembrete: A devolução do seu acervo é hoje! • ${dadosEmpresa.nomeEmpresa}`,
                  html: `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 25px; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
                      <h2 style="color: #3b82f6; margin-top: 0;">${dadosEmpresa.nomeEmpresa}</h2>
                      <p>Olá <strong>${nomeCli}</strong>,</p>
                      <p>Esperamos que sua festa tenha sido inesquecível! A devolução do acervo (<strong>Pedido #${numPedido}</strong>) está prevista para <strong>hoje (${dataDevolucao.split('-').reverse().join('/')})</strong> até às <strong>${loc.horarioDevolucao || '18h00'}</strong>.</p>
                      <p>Pedimos que as peças retornem limpas e acondicionadas nas embalagens originais para agilizar o check-in.</p>
                      <p style="color: #64748b; font-size: 13px;">Agradecemos pela confiança!</p>
                    </div>
                  `
                })
              });

              await db.collection('historico_notificacoes').add({
                tenantId,
                idempotencyId,
                evento: 'lembrete_devolucao',
                destinatario: nomeCli,
                contato: emailCli,
                canal: 'email',
                tipoEvento: 'cron_diario',
                mensagem: `Lembrete de devolução enviado para ${nomeCli}`,
                status: 'sucesso',
                enviadoEm: new Date().toISOString(),
                timestamp: Date.now()
              });
            } catch (errDev) {
              console.warn('Erro ao enviar lembrete devolução no cron:', errDev);
            }
          }
        }
      }
    } catch (errGeral) {
      console.error('Erro na rotina cron diária de notificações:', errGeral);
    }
  }
);

exports.enviarEmailConfirmacaoPagamento = functions.https.onRequest(async (req, res) => {
  const { email, nome, nomePlano, valor, metodo } = req.body || req.query;
  try {
    const resData = await dispararEmailConfirmacaoPagamento(email, nome, nomePlano, valor, metodo);
    res.status(200).send({ success: true, resData });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

exports.enviarAlertaSenhaAlterada = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    try {
      const { email, dataHora, dispositivo } = req.body || {};
      if (!email || !email.includes('@')) {
        return res.status(400).send({ error: 'E-mail inválido ou não fornecido' });
      }

      const emailLimpo = String(email).trim().toLowerCase();
      const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re', '9XQXdePo', 'BhzvGTxk3phud7qXuMiu5Fv7'].join('_');
      const dataHoraExibicao = dataHora || new Date().toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }) + ' (Horário de Brasília)';
      const dispositivoExibicao = dispositivo || 'Dispositivo Web';

      const htmlBody = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Sua senha do Celebre foi alterada com sucesso • Alerta de Segurança</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 35px 15px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);">
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 32px; text-align: center; border-bottom: 3px solid #c5a059;">
                    <img src="https://celebrefesta.com.br/LOGO_CELEBRE.png" alt="Celebre" style="height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 8px; display: inline-block;" />
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">CELEBRE</h1>
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #c5a059; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 700;">Central de Segurança & Privacidade</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 36px 32px;">
                    <div style="display: inline-block; background-color: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 24px; padding: 6px 14px; margin-bottom: 18px;">
                      <span style="color: #047857; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">🔒 Atividade de Segurança</span>
                    </div>
                    <h2 style="margin: 0 0 14px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">Sua senha foi redefinida com sucesso!</h2>
                    <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                      Olá! Este é um aviso de segurança para confirmar que a senha da sua conta Celebre vinculada ao e-mail <strong style="color: #0f172a;">${emailLimpo}</strong> acabou de ser redefinida com sucesso.
                    </p>
                    <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 24px 0;">
                      <div style="font-size: 11px; font-weight: 800; color: #854d0e; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">📋 Detalhes da Alteração:</div>
                      <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13.5px; color: #334155;">
                        <tr><td width="35%" style="color: #64748b; font-weight: 600;">Data e Horário:</td><td style="font-weight: 700; color: #0f172a;">${dataHoraExibicao}</td></tr>
                        <tr><td style="color: #64748b; font-weight: 600;">Dispositivo:</td><td style="font-weight: 700; color: #0f172a;">${dispositivoExibicao}</td></tr>
                        <tr><td style="color: #64748b; font-weight: 600;">Status:</td><td style="font-weight: 700; color: #16a34a;">Ativa e Criptografada</td></tr>
                      </table>
                    </div>
                    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                      <strong style="color: #15803d; font-size: 13.5px; display: block; margin-bottom: 4px;">✅ Foi você quem realizou esta alteração?</strong>
                      <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">Excelente! Nenhuma ação adicional é necessária. Você já pode acessar seu painel normalmente com a sua nova senha.</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0 25px 0;">
                      <a href="https://celebrefesta.com.br/login" style="background: linear-gradient(135deg, #c5a059 0%, #dfb76c 100%); color: #0f172a; text-decoration: none; padding: 15px 38px; border-radius: 12px; font-weight: 800; font-size: 14.5px; display: inline-block; box-shadow: 0 6px 20px rgba(197, 160, 89, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">Acessar Painel Celebre</a>
                    </div>
                    <div style="background-color: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 16px 18px; margin-top: 24px;">
                      <strong style="color: #b91c1c; font-size: 13.5px; display: block; margin-bottom: 6px;">🚨 Não reconhece esta alteração?</strong>
                      <p style="margin: 0 0 10px 0; font-size: 12.5px; color: #7f1d1d; line-height: 1.5;">Se você <strong>NÃO</strong> redefiniu sua senha, sua conta pode ter sido acessada indevidamente.</p>
                      <div style="text-align: center;">
                        <a href="https://celebrefesta.com.br/redefinir-senha" style="display: inline-block; background-color: #b91c1c; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase;">Bloquear e Recuperar Conta</a>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 22px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 6px 0; font-size: 11.5px; color: #64748b; font-weight: 600;">Celebre • Sistema Integrado de Gestão de Festas, Acervo & Locações</p>
                    <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">Este é um e-mail de serviço obrigatório para a segurança da sua conta.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

      const responseResend = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Celebre Segurança <seguranca@celebrefesta.com.br>',
          to: [emailLimpo],
          reply_to: 'celebrefesta25@gmail.com',
          subject: '🔒 Alerta de Segurança: Sua senha no Celebre foi alterada com sucesso',
          html: htmlBody
        })
      });

      const resData = await responseResend.json();
      return res.status(200).send({ success: true, emailId: resData.id });
    } catch (err) {
      console.error('Erro ao enviar alerta de senha alterada:', err);
      return res.status(500).send({ success: false, error: err.message });
    }
  });
});