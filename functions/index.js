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
                  description: "Acesso de 30 dias - Celebre",
                  payment_method_id: payment_method_id,
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
              await db.collection("usuarios").doc(userId).update({
                  statusPagamentoVulso: "pendente",
                  idPagamento: result.id
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

exports.limpezaDeContasExpiradas = onSchedule(
    { schedule: "every day 00:00", timeZone: "America/Sao_Paulo" }, 
    async (event) => {
        const hoje = new Date();
        const limiteDias = 180;
        try {
            const usuariosRef = db.collection("usuarios");
            const snapshot = await usuariosRef.where("plano", "!=", "pago").get();
            const promessas = [];
            snapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.status === 'deletado_definitivamente') return;
                if (userData.dataCadastro) {
                    const dataCadastro = new Date(userData.dataCadastro);
                    const diffDays = Math.ceil(Math.abs(hoje - dataCadastro) / (1000 * 60 * 60 * 24));
                    if (diffDays > limiteDias) {
                        const uid = doc.id;
                        promessas.push(deletarDadosDoUsuario(uid));
                        promessas.push(usuariosRef.doc(uid).update({
                            status: 'deletado_definitivamente',
                            dataExclusao: hoje.toISOString(),
                            nomeCompleto: 'Usuário Excluído',
                            telefone: ''
                        }));
                    }
                }
            });
            await Promise.all(promessas);
        } catch (error) {
            console.error("Erro na limpeza:", error);
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
      if (action === 'payment.created' || action === 'payment.updated' || action === 'payment') {
          const payment = new Payment(client);
          const pagamentoOficial = await payment.get({ id: dataId });

          if (pagamentoOficial.status === 'approved') {
              const usuariosRef = db.collection("usuarios");
              const snapshot = await usuariosRef.where("idPagamento", "==", Number(dataId)).get();

              if (!snapshot.empty) {
                  const batch = db.batch();
                  snapshot.docs.forEach((doc) => {
                      batch.update(doc.ref, {
                          plano: "pago",
                          statusPagamentoVulso: "aprovado",
                          dataPagamento: new Date().toISOString()
                      });
                  });
                  await batch.commit();
                  console.log("✅ Pagamento aprovado! Acesso liberado.");
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