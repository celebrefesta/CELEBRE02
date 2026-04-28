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

// ============================================================================
// 💰 FUNÇÃO 1: GATEWAY DE PAGAMENTO (RECORRÊNCIA E AVULSO)
// ============================================================================

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

      // 🔀 BIFURCAÇÃO 1: É PIX ou Boleto? (Pagamento Único de 30 dias)
      if (payment_method_id === 'pix' || payment_method_id === 'bolbradesco') {
          const payment = new Payment(client);
          const result = await payment.create({
              body: {
                  transaction_amount: Number(transaction_amount),
                  description: "Acesso de 30 dias - Celebre Sistemas",
                  payment_method_id: payment_method_id,
                  payer: { 
                      email: payer.email,
                      first_name: "Camila", // 🔥 NOME REAL PREENCHIDO
                      last_name: "Vichinhsk", // 🔥 SOBRENOME REAL PREENCHIDO
                      identification: {
                          type: "CPF",
                          number: "44157485890" // 🔥 SUBSTITUA PELO SEU CPF (SÓ NÚMEROS)
                      }
                  }
              }
          });

          // Deixa o status do usuário como pendente até o cliente pagar
          if (result.id) {
              await db.collection("usuarios").doc(userId).update({
                  statusPagamentoVulso: "pendente",
                  idPagamento: result.id
              });
          }

          return res.status(200).send(result);
      } 
      
      // 🔀 BIFURCAÇÃO 2: Se não é PIX/Boleto, é Cartão (Assinatura Mensal Automática)
      else {
          const preApproval = new PreApproval(client);
          const subscriptionData = {
              body: {
                  preapproval_plan_id: "3ea107b1310c447898e274a0eec43d7f",
                  reason: "Assinatura Celebre Sistemas",
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
      res.status(500).send({ message: "Erro interno no servidor de pagamentos", error });
    }
  });
});

// ============================================================================
// 🤖 FUNÇÃO 2: ROBÔ DE FAXINA (CONTAS EXPIRADAS HÁ 180 DIAS)
// ============================================================================

exports.limpezaDeContasExpiradas = onSchedule(
    { schedule: "every day 00:00", timeZone: "America/Sao_Paulo" }, 
    async (event) => {
        console.log("Iniciando varredura de contas inativas...");

        const hoje = new Date();
        const limiteDias = 180;
        
        try {
            const usuariosRef = db.collection("usuarios");
            const snapshot = await usuariosRef.where("plano", "!=", "pago").get();

            if (snapshot.empty) {
                console.log("Nenhuma conta inadimplente encontrada hoje.");
                return;
            }

            const promessas = [];

            snapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.status === 'deletado_definitivamente') return;

                if (userData.dataCadastro) {
                    const dataCadastro = new Date(userData.dataCadastro);
                    const diffTime = Math.abs(hoje - dataCadastro);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
            console.log("Faxina concluída com sucesso!");

        } catch (error) {
            console.error("Erro ao executar a limpeza:", error);
        }
});

async function deletarDadosDoUsuario(uid) {
    const colecoesParaLimpar = ["estoque", "locacoes", "clientes", "compras"];
    
    for (const nomeColecao of colecoesParaLimpar) {
        const colecaoRef = db.collection(nomeColecao);
        const snapshot = await colecaoRef.where("userId", "==", uid).get();
        
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
    }
}