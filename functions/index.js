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
// 🔔 FUNÇÃO 3: WEBHOOK - ESCUTA APROVAÇÕES DE PAGAMENTO DO MERCADO PAGO
// ============================================================================

exports.webhookMercadoPago = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // O Mercado Pago pode enviar o ID do pagamento no corpo (body) ou na URL (query)
      const paymentId = req.body?.data?.id || req.query['data.id'];
      const action = req.body?.action || req.body?.type;

      // Se não tiver ID ou não for uma atualização de pagamento, ignoramos e damos OK
      if (!paymentId || (action !== 'payment.created' && action !== 'payment.updated' && action !== 'payment')) {
        return res.status(200).send("Aviso ignorado ou sem ID");
      }

      console.log(`Recebido aviso sobre o pagamento ID: ${paymentId}`);

      // Vamos perguntar ao Mercado Pago o status oficial desse pagamento
      const payment = new Payment(client);
      const pagamentoOficial = await payment.get({ id: paymentId });

      // Se o status for "approved" (Boleto compensado ou PIX pago)
      if (pagamentoOficial.status === 'approved') {
          const usuariosRef = db.collection("usuarios");
          
          // Procuramos qual cliente do Celebre tem esse Boleto/PIX atrelado
          const snapshot = await usuariosRef.where("idPagamento", "==", Number(paymentId)).get();

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
              console.log("✅ Acesso liberado com sucesso para a cliente!");
          }
      }

      // É OBRIGATÓRIO devolver status 200 rápido para o Mercado Pago não tentar enviar de novo
      res.status(200).send("Webhook recebido com sucesso");

    } catch (error) {
      console.error("Erro no processamento do webhook:", error);
      res.status(500).send("Erro interno");
    }
  });
});