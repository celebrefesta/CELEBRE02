/* eslint-disable */
const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { MercadoPagoConfig, Payment } = require("mercadopago");

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