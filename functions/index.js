/* eslint-disable */
const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { MercadoPagoConfig, PreApproval, Payment } = require("mercadopago");

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

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