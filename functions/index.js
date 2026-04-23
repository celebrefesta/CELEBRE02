/* eslint-disable */
const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { MercadoPagoConfig, Payment } = require("mercadopago");

// 🔥 Importações necessárias para o Robô de Limpeza
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ============================================================================
// 💰 FUNÇÃO 1: GATEWAY DE PAGAMENTO (MERCADO PAGO)
// ============================================================================

// 🔥 TROCADO PARA PRODUÇÃO 🔥
// Cole abaixo o seu Access Token de Produção do painel do Mercado Pago
const client = new MercadoPagoConfig({ 
  accessToken: "APP_USR-3626101868283261-041714-787f6d6687f899ca426df63ee41ec903-3201169000" 
});

exports.processarPagamento = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Método não permitido");
    }

    try {
      const paymentData = req.body; 

      const payment = new Payment(client);
      
      // O Mercado Pago processará agora cobranças reais com este token
      const resultado = await payment.create({ body: paymentData });

      res.status(200).send(resultado);
 
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
            // 1. Busca todos os usuários que NÃO são pagantes
            const usuariosRef = db.collection("usuarios");
            const snapshot = await usuariosRef.where("plano", "!=", "pago").get();

            if (snapshot.empty) {
                console.log("Nenhuma conta inadimplente encontrada hoje.");
                return;
            }

            // 2. Analisa cada usuário
            const promessas = [];

            snapshot.forEach((doc) => {
                const userData = doc.data();
                
                // Evita processar quem já foi deletado
                if (userData.status === 'deletado_definitivamente') return;

                if (userData.dataCadastro) {
                    const dataCadastro = new Date(userData.dataCadastro);
                    const diffTime = Math.abs(hoje - dataCadastro);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // 3. Se passou de 180 dias, executa a exclusão dos dados
                    if (diffDays > limiteDias) {
                        const uid = doc.id;
                        console.log(`Excluindo dados do usuário: ${uid} (Inativo há ${diffDays} dias)`);

                        // Deleta os dados atrelados a este usuário nas outras coleções
                        promessas.push(deletarDadosDoUsuario(uid));

                        // 4. Atualiza a ficha do usuário para 'deletado', mas MANTÉM o documento 
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

// 🧹 Função Auxiliar do Robô
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