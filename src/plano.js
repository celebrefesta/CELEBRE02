const criarPlanoMP = async () => {
  const url = "https://api.mercadopago.com/preapproval_plan";
  
  // 🔴 COLE A SUA CHAVE ACCESS TOKEN DE PRODUÇÃO AQUI 🔴
  const token = "APP_USR-3626101868283261-041714-787f6d6687f899ca426df63ee41ec903-3201169000"; 

  const payload = {
    reason: "Plano Básico - Celebre Sistemas",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 49.90,
      currency_id: "BRL"
    },
    back_url: "https://seusite.com/dashboard", 
    payment_methods_allowed: {
      payment_types: [
        { id: "credit_card" } 
      ]
    }
  };

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const dados = await resposta.json();

    if (dados.id) {
        console.log("\n✅ SUCESSO! O SEU ID DO PLANO É:");
        console.log("===================================");
        console.log(dados.id);
        console.log("===================================\n");
    } else {
        console.error("❌ ERRO:", dados);
    }
  } catch (erro) {
    console.error("Erro:", erro);
  }
};

criarPlanoMP();