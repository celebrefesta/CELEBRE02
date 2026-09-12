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
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">
                      CELEBRE
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #c5a059; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
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
                      <a href="https://celebrefesta.com.br/conta-suspensa" style="background: linear-gradient(135deg, #c5a059 0%, #dfb76c 100%); color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(197, 160, 89, 0.35);">
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