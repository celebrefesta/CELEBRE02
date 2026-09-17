import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { calcularPeriodoTeste, parseDataGenerica } from '../../utils/periodoTesteUtils';
import { aplicarCorDestaqueGlobal } from '../../utils/themeUtils';
import { formatCPF } from '../../utils/mascaras';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// 🔥 INICIALIZAÇÃO DE PRODUÇÃO MERCADO PAGO
initMercadoPago('APP_USR-4c525755-f2c1-4e28-8c9e-020787a172a1', { locale: 'pt-BR' });

// 📅 Função inteligente para projetar sempre o próximo ciclo de faturamento real
export const calcularProximaDataRenovacao = (uData, assinatura, dataCriacaoConta, isSuperAdmin) => {
  if (isSuperAdmin) {
    return 'Vitalício';
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // 1. Se o usuário estiver ATUALMENTE no Período de Teste VIP ativo
  if (uData) {
    const infoT = calcularPeriodoTeste(uData);
    if (infoT.emTeste && infoT.dataFimDate && infoT.dataFimDate >= hoje) {
      return infoT.dataFimFormatada;
    }
  }

  // 2. Se houver uma data de vencimento/cobrança futura explícita (>= hoje)
  const dataCandidataRaw = uData?.dataProximaCobranca 
    || uData?.dataVencimento 
    || assinatura?.dataProximaCobranca 
    || assinatura?.dataVencimento;

  if (dataCandidataRaw) {
    const dataCand = parseDataGenerica(dataCandidataRaw);
    if (dataCand) {
      const dataCandMeia = new Date(dataCand);
      dataCandMeia.setHours(0, 0, 0, 0);
      if (dataCandMeia >= hoje) {
        return dataCandMeia.toLocaleDateString('pt-BR');
      }
    }
  }

  // 3. Determinar o dia fixo do ciclo mensal de cobrança (ex: dia 21)
  let diaCiclo = 21;
  if (uData) {
    const infoT = calcularPeriodoTeste(uData);
    if (infoT.dataFimDate) {
      diaCiclo = infoT.dataFimDate.getDate();
    }
  }
  if ((!diaCiclo || diaCiclo === 21) && dataCriacaoConta) {
    const parsedCad = parseDataGenerica(dataCriacaoConta);
    if (parsedCad) {
      const dC = new Date(parsedCad);
      dC.setDate(dC.getDate() + 7);
      diaCiclo = dC.getDate();
    }
  }
  if (!diaCiclo || isNaN(diaCiclo)) diaCiclo = 21;

  // 4. Projetar a próxima data futura de renovação no ciclo mensal (nunca no passado)
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaHoje = hoje.getDate();

  let proximaData;
  if (diaHoje <= diaCiclo) {
    // Cobrança no mês corrente (ex: hoje é 17/09 e o ciclo é 21 -> 21/09)
    const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const diaReal = Math.min(diaCiclo, ultimoDiaMes);
    proximaData = new Date(anoAtual, mesAtual, diaReal);
  } else {
    // Cobrança no mês seguinte (ex: hoje é 25/09 e o ciclo foi dia 21 -> 21/10)
    const proximoMes = mesAtual + 1;
    const anoProximo = proximoMes > 11 ? anoAtual + 1 : anoAtual;
    const mesCalculado = proximoMes % 12;
    const ultimoDiaProximoMes = new Date(anoProximo, mesCalculado + 1, 0).getDate();
    const diaReal = Math.min(diaCiclo, ultimoDiaProximoMes);
    proximaData = new Date(anoProximo, mesCalculado, diaReal);
  }

  return proximaData.toLocaleDateString('pt-BR');
};

// 💎 HIERARQUIA DE NÍVEIS DE PLANO (PARA DETECÇÃO DE UPGRADE VS DOWNGRADE)
const HIERARQUIA_PLANOS = { basico: 1, premium: 2, plus: 3 };

// 💎 MATRIZ OFICIAL DE TODOS OS PLANOS DISPONÍVEIS NA CELEBRE (MENSAL E ANUAL)
const LISTA_PLANOS_DISPONIVEIS = [
  {
    id: 'basico',
    idMensal: 'plano_basico',
    idAnual: 'plano_basico_anual',
    nome: 'Básico',
    tag: 'Essencial',
    usuarios: '1 Usuário',
    limiteUsuarios: 1,
    precoMensal: 49.90,
    precoMensalFormatado: '49,90',
    precoAnualTotal: 479.00,
    precoAnualTotalFormatado: '479,00',
    precoAnualOriginalTotalFormatado: '598,80',
    precoAnualEquivMesFormatado: '39,90',
    economiaAnualFormatada: '119,80',
    icone: 'fas fa-seedling',
    corIcone: '#10b981',
    destaque: false,
    beneficios: [
      '1 Usuário na equipe',
      'Gestão de Estoque & Peças',
      'Gestão de Clientes & Locações',
      '1 Modelo de Contrato PDF',
      'Agenda de Eventos e Reservas'
    ]
  },
  {
    id: 'premium',
    idMensal: 'plano_premium',
    idAnual: 'plano_premium_anual',
    nome: 'Premium',
    tag: 'Mais Popular',
    usuarios: 'Até 3 Usuários',
    limiteUsuarios: 3,
    precoMensal: 99.90,
    precoMensalFormatado: '99,90',
    precoAnualTotal: 958.80,
    precoAnualTotalFormatado: '958,80',
    precoAnualOriginalTotalFormatado: '1.198,80',
    precoAnualEquivMesFormatado: '79,90',
    economiaAnualFormatada: '240,00',
    icone: 'fas fa-crown',
    corIcone: 'var(--dourado)',
    destaque: true,
    beneficios: [
      'Até 3 Usuários com acessos individuais',
      'Acervo Ilimitado com Fotos HD',
      'Gestão Financeira Completa & Caixa',
      'Catálogo Digital Vitrine Online',
      'Moodboard 2D de Decoração',
      'Assinatura Digital de Contratos'
    ]
  },
  {
    id: 'plus',
    idMensal: 'plano_plus',
    idAnual: 'plano_plus_anual',
    nome: 'Plus',
    tag: 'Máxima Performance',
    usuarios: 'Até 5 Usuários',
    limiteUsuarios: 5,
    precoMensal: 159.90,
    precoMensalFormatado: '159,90',
    precoAnualTotal: 1535.00,
    precoAnualTotalFormatado: '1.535,00',
    precoAnualOriginalTotalFormatado: '1.918,80',
    precoAnualEquivMesFormatado: '127,90',
    economiaAnualFormatada: '383,80',
    icone: 'fas fa-rocket',
    corIcone: '#3b82f6',
    destaque: false,
    beneficios: [
      'Até 5 Usuários simultâneos na equipe',
      'Relatórios Executivos & DRE Completo',
      'Múltiplos Galpões e Logística VIP',
      'Suporte Prioritário VIP 24/7',
      'Todas as ferramentas liberadas'
    ]
  }
];

const AbaAssinaturaUso = ({
  isSuperAdmin,
  assinatura,
  usoPlano,
  cancelando,
  handleCancelarAssinatura,
  dataCriacaoConta
}) => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [estatisticasReais, setEstatisticasReais] = useState({
    totalItensEstoque: 0,
    totalLocacoes: 0,
    totalClientes: 0,
    dataRenovacao: null
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Modal simples para editar E-mail de Faturamento
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  // 👑 MODAL VIP DE MIGRAÇÃO PARA PLANO ANUAL / UPGRADE DE PLANO (TODOS OS PLANOS)
  const [modalMigracaoAberto, setModalMigracaoAberto] = useState(false);
  const [modalCiclo, setModalCiclo] = useState('anual'); // 'anual' ou 'mensal'
  const [modalPlanoSelecionado, setModalPlanoSelecionado] = useState('premium'); // 'basico', 'premium' ou 'plus'
  const [metodoMigracao, setMetodoMigracao] = useState('pix'); // 'pix' ou 'cartao'
  const [cpfMigracao, setCpfMigracao] = useState('');
  const [gerandoPix, setGerandoPix] = useState(false);
  const [dadosPixMigracao, setDadosPixMigracao] = useState(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [erroPix, setErroPix] = useState('');
  const [cienteDowngrade, setCienteDowngrade] = useState(false);

  // 💳 ESTADOS PARA CHECKOUT DE CARTÃO DIRETO NO MODAL
  const [processandoCartaoModal, setProcessandoCartaoModal] = useState(false);
  const [statusCartaoModal, setStatusCartaoModal] = useState(null); // { tipo: 'sucesso' | 'erro' | 'info', texto: '' }

  // 📄 ESTADOS PARA EMISSÃO DE BOLETO DIRETO NO MODAL E ENVIO POR E-MAIL
  const [dadosBoletoMigracao, setDadosBoletoMigracao] = useState(null);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [erroBoleto, setErroBoleto] = useState('');
  const [emailEnvioBoleto, setEmailEnvioBoleto] = useState('');
  const [linhaDigitavelCopiada, setLinhaDigitavelCopiada] = useState(false);

  useEffect(() => {
    if (assinatura?.emailCobranca || usuarioLogado?.email) {
      const email = assinatura?.emailCobranca || usuarioLogado?.email || '';
      setNovoEmail(email);
      setEmailEnvioBoleto(email);
    }
  }, [assinatura, usuarioLogado]);

  // 🎨 Garante aplicação imediata da Cor da Marca na Aba Assinatura
  useEffect(() => {
    const savedAccent = localStorage.getItem('accentColor') || '#c5a059';
    aplicarCorDestaqueGlobal(savedAccent);

    const handleThemeChange = () => {
      const currentAccent = localStorage.getItem('accentColor') || '#c5a059';
      aplicarCorDestaqueGlobal(currentAccent);
    };

    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  useEffect(() => {
    const carregarEstatisticasUso = async () => {
      if (!usuarioLogado) return;
      try {
        const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
        
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));

        const [snapEst, snapLoc, snapCli] = await Promise.all([
          getDocs(qEstoque).catch(() => ({ size: 0 })),
          getDocs(qLocacoes).catch(() => ({ size: 0 })),
          getDocs(qClientes).catch(() => ({ size: 0 }))
        ]);

        const userDoc = await getDoc(doc(db, "usuarios", tenantId)).catch(() => null);
        const uData = userDoc && userDoc.exists() ? userDoc.data() : null;

        const docRaw = uData?.cpf || uData?.documento || '';
        const apenasDigitos = String(docRaw).replace(/\D/g, '');
        if (apenasDigitos.length === 11) {
          setCpfMigracao(formatCPF(apenasDigitos));
        } else {
          setCpfMigracao('');
        }

        const proximaData = calcularProximaDataRenovacao(uData, assinatura, dataCriacaoConta, isSuperAdmin);

        setEstatisticasReais({
          totalItensEstoque: snapEst.size || 0,
          totalLocacoes: snapLoc.size || 0,
          totalClientes: snapCli.size || 0,
          dataRenovacao: proximaData
        });
      } catch (err) {
        console.error("Erro ao buscar estatísticas de uso:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    carregarEstatisticasUso();
  }, [usuarioLogado, dataCriacaoConta, assinatura, isSuperAdmin]);

  // ⚡ GERAÇÃO DO PIX DINÂMICO PARA QUALQUER PLANO E CICLO VIA ROBÔ MERCADO PAGO
  const handleGerarPixModal = async (e) => {
    e.preventDefault();
    const cpfLimpo = cpfMigracao.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErroPix('⚠️ Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }
    setGerandoPix(true);
    setErroPix('');
    try {
      const planoObj = LISTA_PLANOS_DISPONIVEIS.find(p => p.id === modalPlanoSelecionado) || LISTA_PLANOS_DISPONIVEIS[1];
      const valor = modalCiclo === 'anual' ? planoObj.precoAnualTotal : planoObj.precoMensal;
      const idPlano = modalCiclo === 'anual' ? planoObj.idAnual : planoObj.idMensal;

      const URL_DO_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
      const payload = {
        payment_method_id: 'pix',
        transaction_amount: valor,
        payer: {
          email: novoEmail || usuarioLogado?.email,
          identification: { type: 'CPF', number: cpfLimpo }
        },
        userId: usuarioLogado?.uid,
        planoId: idPlano
      };

      const resp = await fetch(URL_DO_ROBO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await resp.json();
      if (resJson.point_of_interaction?.transaction_data) {
        setDadosPixMigracao({
          qrCodeBase64: resJson.point_of_interaction.transaction_data.qr_code_base64,
          copiaECola: resJson.point_of_interaction.transaction_data.qr_code,
          valor: valor,
          planoNome: planoObj.nome,
          ciclo: modalCiclo
        });
      } else {
        setErroPix('❌ Não foi possível gerar o QR Code no Mercado Pago. Verifique seu CPF e tente novamente.');
      }
    } catch (err) {
      console.error("Erro ao gerar PIX:", err);
      setErroPix('⚠️ Falha de comunicação com o servidor de pagamentos.');
    } finally {
      setGerandoPix(false);
    }
  };

  const handleCopiarPix = () => {
    if (dadosPixMigracao?.copiaECola) {
      navigator.clipboard.writeText(dadosPixMigracao.copiaECola);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 3000);
    }
  };

  const handleSalvarEmail = async (e) => {
    e.preventDefault();
    if (!usuarioLogado) return;
    setSalvandoEmail(true);
    try {
      const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
      const userRef = doc(db, "usuarios", tenantId);
      await updateDoc(userRef, { emailCobranca: novoEmail });
      alert("✅ E-mail de faturamento atualizado com sucesso!");
      setModalEmailAberto(false);
    } catch (err) {
      console.error("Erro ao salvar e-mail:", err);
      alert("Erro ao atualizar e-mail.");
    } finally {
      setSalvandoEmail(false);
    }
  };

  const handleImprimirComprovante = () => {
    const janelaImpressao = window.open('', '_blank');
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const codigoFatura = "FAT-" + Math.floor(100000 + Math.random() * 900000);
    const planoNome = assinatura?.planoNome || "Plano Premium";
    const valor = assinatura?.precoMensal || "99,90";
    const email = novoEmail || usuarioLogado?.email;

    janelaImpressao.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo de Pagamento - Celebre Sistema</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 700px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #c5a059; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: 2px; }
          .badge-pago { background: #dcfce7; color: #15803d; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; }
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .info-box label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 4px; }
          .info-box p { margin: 0; font-size: 15px; font-weight: bold; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #0f172a; color: white; padding: 12px; text-align: left; font-size: 13px; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">CELEBRE</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Comprovante Oficial de Assinatura</div>
          </div>
          <div class="badge-pago">✓ PAGAMENTO CONCLUÍDO</div>
        </div>

        <div class="grid-info">
          <div class="info-box">
            <label>Código da Fatura</label>
            <p>${codigoFatura}</p>
          </div>
          <div class="info-box">
            <label>Data de Emissão</label>
            <p>${dataHoje}</p>
          </div>
          <div class="info-box">
            <label>E-mail Cadastrado</label>
            <p>${email}</p>
          </div>
          <div class="info-box">
            <label>Processamento</label>
            <p>Mercado Pago Transações</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item / Descrição</th>
              <th>Período</th>
              <th>Método</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Assinatura ${planoNome}</strong> - Licença Celebre</td>
              <td>Mensal/Anual</td>
              <td>Mercado Pago (Cartão / PIX)</td>
              <td style="text-align: right; font-weight: bold;">R$ ${valor}</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align: right; margin-bottom: 40px;">
          <div style="font-size: 14px; color: #64748b;">Total Pago:</div>
          <div style="font-size: 26px; font-weight: 800; color: #10b981;">R$ ${valor}</div>
        </div>

        <div class="footer">
          <p>Celebre Sistema de Gestão de Eventos e Locações • CNPJ 00.000.000/0001-00</p>
          <p>Este comprovante serve como recibo oficial de pagamento referente à assinatura do sistema.</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    janelaImpressao.document.close();
  };

  const limiteVagas = isSuperAdmin ? 9999 : (usoPlano?.limite || 3);
  const vagasUsadas = usoPlano?.usado || 1;
  const pctVagas = Math.min(Math.round((vagasUsadas / limiteVagas) * 100), 100);

  const corBarraVagas = isSuperAdmin 
    ? 'var(--dourado)' 
    : (pctVagas >= 100 ? '#ef4444' : (pctVagas > 70 ? '#f59e0b' : '#10b981'));

  const planoNomeAtual = assinatura?.planoNome || "Básico";
  const precoMensalAtual = assinatura?.precoMensal || "0,00";

  // 🔍 Detecção do plano que o usuário já paga
  const detectarPlanoAtualKey = () => {
    const nome = (assinatura?.planoNome || '').toLowerCase();
    const id = (assinatura?.planoId || '').toLowerCase();
    if (id.includes('plus') || nome.includes('plus') || nome.includes('pro')) return 'plus';
    if (id.includes('premium') || nome.includes('premium') || precoMensalAtual === '99,90') return 'premium';
    if (id.includes('basico') || id.includes('básico') || nome.includes('basico') || nome.includes('básico') || precoMensalAtual === '49,90') return 'basico';
    return 'premium';
  };

  const planoAtualKey = detectarPlanoAtualKey();
  const isUsuarioAnualAtual = Boolean(
    assinatura?.ciclo === 'anual' || 
    assinatura?.planoId?.includes('anual') ||
    assinatura?.periodo === 'anual'
  );

  const abrirModalUpgrade = () => {
    const proximo = planoAtualKey === 'basico' ? 'premium' : 'plus';
    setModalPlanoSelecionado(proximo);
    setModalCiclo('mensal');
    setDadosPixMigracao(null);
    setErroPix('');
    setStatusCartaoModal(null);
    setProcessandoCartaoModal(false);
    setDadosBoletoMigracao(null);
    setErroBoleto('');
    setModalMigracaoAberto(true);
  };

  const abrirModalAnual = () => {
    setModalPlanoSelecionado(planoAtualKey);
    setModalCiclo('anual');
    setDadosPixMigracao(null);
    setErroPix('');
    setStatusCartaoModal(null);
    setProcessandoCartaoModal(false);
    setDadosBoletoMigracao(null);
    setErroBoleto('');
    setModalMigracaoAberto(true);
  };

  // 💳 PROCESSAMENTO DO CARTÃO DIRETO DENTRO DO MODAL VIA MERCADO PAGO
  const onSubmitCartaoModal = async ({ selectedPaymentMethod, formData }) => {
    setStatusCartaoModal({ tipo: 'info', texto: 'Processando pagamento seguro no Mercado Pago...' });
    setProcessandoCartaoModal(true);

    return new Promise(async (resolve, reject) => {
      try {
        const planoObj = LISTA_PLANOS_DISPONIVEIS.find(p => p.id === modalPlanoSelecionado) || LISTA_PLANOS_DISPONIVEIS[1];
        const valor = modalCiclo === 'anual' ? planoObj.precoAnualTotal : planoObj.precoMensal;
        const idPlano = modalCiclo === 'anual' ? planoObj.idAnual : planoObj.idMensal;

        const URL_DO_SEU_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
        const payload = {
          ...formData,
          userId: usuarioLogado.uid,
          planoId: idPlano,
          valorOriginal: valor,
          valorCobrado: valor
        };

        const resposta = await fetch(URL_DO_SEU_ROBO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resultado = await resposta.json();

        if (resultado.status === 'authorized' || resultado.status === 'approved' || resultado.status === 'in_process') {
          try {
            const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
            const userRef = doc(db, 'usuarios', tenantId);
            await updateDoc(userRef, {
              statusConta: 'ativo',
              dataSuspensao: null,
              plano: 'pago',
              statusAssinatura: 'ativa',
              planoId: idPlano,
              valorAssinatura: valor,
              ciclo: modalCiclo,
              planoNome: `Plano ${planoObj.nome}`
            });
          } catch (errAtualizar) {
            console.warn("Aviso ao atualizar conta após pagamento no modal:", errAtualizar);
          }

          setStatusCartaoModal({
            tipo: 'sucesso',
            texto: `🎉 Pagamento Aprovado com Sucesso! Seu plano foi atualizado para ${planoObj.nome} (${modalCiclo === 'anual' ? 'Licença Anual' : 'Assinatura Mensal'}).`
          });
          resolve();

          setTimeout(() => {
            setModalMigracaoAberto(false);
            window.location.reload();
          }, 2500);
        } else {
          const msgErro = resultado.message || resultado.status_detail || 'Não foi possível autorizar o pagamento. Verifique os dados do cartão.';
          setStatusCartaoModal({ tipo: 'erro', texto: `❌ ${msgErro}` });
          reject();
        }
      } catch (err) {
        console.error("Erro no processamento do cartão no modal:", err);
        setStatusCartaoModal({ tipo: 'erro', texto: '⚠️ Falha de comunicação com o Mercado Pago. Tente novamente.' });
        reject();
      } finally {
        setProcessandoCartaoModal(false);
      }
    });
  };

  // 📄 EMISSÃO DE BOLETO BANCÁRIO MERCADO PAGO E ENVIO POR E-MAIL
  const handleGerarBoletoModal = async (e) => {
    e.preventDefault();
    const cpfLimpo = cpfMigracao.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErroBoleto('⚠️ Por favor, informe um CPF válido com 11 dígitos para emissão do boleto.');
      return;
    }
    const emailDestino = emailEnvioBoleto || novoEmail || usuarioLogado?.email;
    if (!emailDestino || !emailDestino.includes('@')) {
      setErroBoleto('⚠️ Por favor, informe um e-mail válido para envio do boleto.');
      return;
    }

    setGerandoBoleto(true);
    setErroBoleto('');
    try {
      const planoObj = LISTA_PLANOS_DISPONIVEIS.find(p => p.id === modalPlanoSelecionado) || LISTA_PLANOS_DISPONIVEIS[1];
      const valor = modalCiclo === 'anual' ? planoObj.precoAnualTotal : planoObj.precoMensal;
      const idPlano = modalCiclo === 'anual' ? planoObj.idAnual : planoObj.idMensal;

      const URL_DO_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
      const payload = {
        payment_method_id: 'bolbradesco',
        transaction_amount: valor,
        payer: {
          email: emailDestino,
          identification: { type: 'CPF', number: cpfLimpo }
        },
        userId: usuarioLogado?.uid,
        planoId: idPlano
      };

      const resp = await fetch(URL_DO_ROBO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await resp.json();
      if (resJson.transaction_details?.external_resource_url) {
        const urlBoleto = resJson.transaction_details.external_resource_url;
        const barcodeContent = resJson.barcode?.content || '';

        setDadosBoletoMigracao({
          link: urlBoleto,
          codigoBarras: barcodeContent,
          valor: valor,
          planoNome: planoObj.nome,
          ciclo: modalCiclo,
          emailEnvio: emailDestino
        });

        // Atualiza a preferência no Firebase para registrar o método e o link
        try {
          const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;
          const userRef = doc(db, 'usuarios', tenantId);
          await updateDoc(userRef, {
            metodoPagamento: 'Boleto Bancário',
            ultimoBoletoUrl: urlBoleto,
            emailCobranca: emailDestino
          });
        } catch (errDb) {
          console.warn("Aviso ao salvar link do boleto no Firestore:", errDb);
        }
      } else {
        const msg = resJson.message || 'Não foi possível emitir o Boleto no Mercado Pago. Verifique seu CPF e tente novamente.';
        setErroBoleto(`❌ ${msg}`);
      }
    } catch (err) {
      console.error("Erro ao gerar boleto:", err);
      setErroBoleto('⚠️ Falha de comunicação com o servidor bancário do Mercado Pago.');
    } finally {
      setGerandoBoleto(false);
    }
  };

  const handleCopiarLinhaDigitavel = () => {
    if (dadosBoletoMigracao?.codigoBarras) {
      navigator.clipboard.writeText(dadosBoletoMigracao.codigoBarras);
      setLinhaDigitavelCopiada(true);
      setTimeout(() => setLinhaDigitavelCopiada(false), 3000);
    }
  };

  const handleProsseguirCartao = () => {
    setModalMigracaoAberto(false);
    const planoObj = LISTA_PLANOS_DISPONIVEIS.find(p => p.id === modalPlanoSelecionado) || LISTA_PLANOS_DISPONIVEIS[1];
    const precoStr = modalCiclo === 'anual' ? planoObj.precoAnualTotalFormatado : planoObj.precoMensalFormatado;
    const idPlano = modalCiclo === 'anual' ? planoObj.idAnual : planoObj.idMensal;
    const parcelamentoStr = modalCiclo === 'anual'
      ? `R$ ${planoObj.precoAnualTotalFormatado} à vista no PIX ou 1x Cartão (ou parcele em até 12x com acréscimo da operadora)`
      : 'Assinatura Mensal sem fidelidade';

    navigate('/checkout', {
      state: {
        isUpgrade: true,
        from: '/configuracoes?tab=assinatura',
        plano: {
          id: idPlano,
          nome: `${planoObj.nome} (${modalCiclo === 'anual' ? 'Licença Anual 20% OFF' : 'Assinatura Mensal'})`,
          preco: precoStr,
          parcelamento: parcelamentoStr,
          beneficios: planoObj.beneficios
        }
      }
    });
  };

  return (
    <div className="aba-assinatura-container">
      
      {/* 📊 PAINEL DE CONSUMO E LIMITES (USAGE KPI CARDS: 1 LINHA DESKTOP / 2 COLUNAS MOBILE) */}
      <div className="assinatura-kpi-grid">
        <div className="assinatura-kpi-card">
          <div className="kpi-card-top-row">
            <span className="kpi-card-label">
              <i className="fas fa-users" style={{ color: '#3b82f6' }}></i> Usuários (Equipe)
            </span>
          </div>
          <div className="kpi-card-main-val" style={{ color: corBarraVagas }}>
            {isSuperAdmin ? 'Ilimitado' : `${vagasUsadas} / ${limiteVagas}`}
          </div>
          <div className="kpi-progress-bar-track">
            <div className="kpi-progress-bar-fill" style={{ width: `${isSuperAdmin ? 100 : pctVagas}%`, background: corBarraVagas }}></div>
          </div>
          <span className="kpi-card-hint">
            {isSuperAdmin ? 'Sem restrição' : `${limiteVagas - vagasUsadas > 0 ? (limiteVagas - vagasUsadas) + ' vaga(s) disponível(is)' : 'Limite de vagas atingido'}`}
          </span>
        </div>

        <div className="assinatura-kpi-card">
          <div className="kpi-card-top-row">
            <span className="kpi-card-label">
              <i className="fas fa-boxes" style={{ color: '#10b981' }}></i> Itens no Acervo
            </span>
          </div>
          <div className="kpi-card-main-val">
            {loadingStats ? '...' : estatisticasReais.totalItensEstoque} <span className="kpi-unit">Peças</span>
          </div>
          <div className="kpi-progress-bar-track">
            <div className="kpi-progress-bar-fill" style={{ width: '100%', background: '#10b981' }}></div>
          </div>
          <span className="kpi-card-hint sucesso">
            <i className="fas fa-check-circle"></i> Cadastro Ilimitado
          </span>
        </div>

        <div className="assinatura-kpi-card">
          <div className="kpi-card-top-row">
            <span className="kpi-card-label">
              <i className="fas fa-file-contract" style={{ color: '#8b5cf6' }}></i> Locações Criadas
            </span>
          </div>
          <div className="kpi-card-main-val">
            {loadingStats ? '...' : estatisticasReais.totalLocacoes} <span className="kpi-unit">Pedidos</span>
          </div>
          <div className="kpi-progress-bar-track">
            <div className="kpi-progress-bar-fill" style={{ width: '100%', background: '#8b5cf6' }}></div>
          </div>
          <span className="kpi-card-hint roxo">
            <i className="fas fa-check-circle"></i> Sem limite
          </span>
        </div>

        <div className="assinatura-kpi-card">
          <div className="kpi-card-top-row">
            <span className="kpi-card-label">
              <i className="fas fa-user-friends" style={{ color: '#f59e0b' }}></i> Carteira Clientes
            </span>
          </div>
          <div className="kpi-card-main-val">
            {loadingStats ? '...' : estatisticasReais.totalClientes} <span className="kpi-unit">Clientes</span>
          </div>
          <div className="kpi-progress-bar-track">
            <div className="kpi-progress-bar-fill" style={{ width: '100%', background: '#f59e0b' }}></div>
          </div>
          <span className="kpi-card-hint ambar">
            <i className="fas fa-check-circle"></i> Base liberada
          </span>
        </div>
      </div>

      {/* ── CARD PRINCIPAL: STATUS DO PLANO & PRÓXIMA COBRANÇA ── */}
      <div className="config-card span-2-col-full assinatura-card-topo">
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fas fa-crown"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div className="plano-top-badges">
              <span className={`plano-status-badge ${assinatura?.isActive || isSuperAdmin ? 'ativo' : 'alerta'}`}>
                <span className="status-dot"></span>
                {assinatura?.status || 'Plano Ativo'}
              </span>
              <span className="plano-tipo-badge">
                {isSuperAdmin ? 'PAINEL MASTER VITALÍCIO' : 'ASSINATURA MENSAL'}
              </span>
              {dataCriacaoConta && (
                <span className="plano-criacao-tag">
                  <i className="fas fa-calendar-check"></i> Conta Criada em: {dataCriacaoConta}
                </span>
              )}
            </div>
            <h3 style={{ margin: '4px 0 2px 0' }}>{planoNomeAtual}</h3>
            <p className="subtext">
              {!isSuperAdmin ? (
                <>Valor da assinatura: <strong>R$ {precoMensalAtual}</strong>/mês</>
              ) : (
                'Acesso total e irrestrito a todos os módulos do sistema Celebre.'
              )}
            </p>
          </div>

          <button 
            type="button" 
            className="btn-upgrade-plano"
            onClick={abrirModalUpgrade}
          >
            <i className="fas fa-rocket"></i> <span>Fazer Upgrade de Plano</span>
          </button>
        </div>

        {/* 📅 BANNER DE DESTAQUE: DATA DE RENOVAÇÃO / VENCIMENTO DA COBRANÇA */}
        <div className="assinatura-vencimento-banner">
          <div className="vencimento-banner-icon">
            <i className={`fas ${isSuperAdmin ? 'fa-infinity' : 'fa-calendar-alt'}`}></i>
          </div>
          <div className="vencimento-banner-info">
            <div className="vencimento-titulo">
              {isSuperAdmin ? 'Licença Celebre:' : 'Data de Renovação / Vencimento:'}{' '}
              <span className="vencimento-data-destaque">{estatisticasReais.dataRenovacao || '—'}</span>
            </div>
            <p className="vencimento-subtexto">
              {!isSuperAdmin ? (
                <>A sua assinatura será cobrada automaticamente no cartão cadastrado em <strong>{estatisticasReais.dataRenovacao || '—'}</strong>. Seu acesso aos recursos premium permanece ativo sem interrupções.</>
              ) : (
                'Sua conta é Master Vitalícia e não possui cobranças ou renovações recorrentes.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 💳 SEÇÃO 2: DADOS DO PAGAMENTO & INFORMAÇÃO TRANSPARENTE DE COBRANÇA */}
      <div className="assinatura-card-bloco">
        <div className="card-bloco-header">
          <h3 className="card-bloco-title">
            <i className="fas fa-credit-card" style={{ color: 'var(--dourado)' }}></i> Dados do Pagamento & Renovação
          </h3>

          <span className="assinatura-mp-badge">
            <i className="fas fa-sync-alt"></i> Cobrança Recorrente Mercado Pago
          </span>
        </div>

        <div className="assinatura-billing-grid">
          <div className="billing-info-box destaque-vencimento">
            <div>
              <span className="billing-box-label">{isSuperAdmin ? 'Status da Licença' : 'Próxima Cobrança / Vencimento'}</span>
              <strong className="billing-box-val data-destaque">
                {estatisticasReais.dataRenovacao || '—'}
              </strong>
              <small className="billing-box-sub">
                {isSuperAdmin ? '✓ Acesso Master permanente' : '✓ Cobrança automática no cartão'}
              </small>
            </div>
            <i className={`fas ${isSuperAdmin ? 'fa-award' : 'fa-calendar-check'} billing-box-icon`} style={{ color: 'var(--dourado)' }}></i>
          </div>

          <div className="billing-info-box">
            <div>
              <span className="billing-box-label">Forma de Pagamento</span>
              <strong className="billing-box-val">{assinatura?.metodoPagamento || 'Mercado Pago (Cartão / PIX)'}</strong>
              <small className="billing-box-sub">
                ✓ Cobrança Automática no Cartão
              </small>
            </div>
            <i className="fas fa-credit-card billing-box-icon"></i>
          </div>

          <div className="billing-info-box">
            <div>
              <span className="billing-box-label">E-mail para Faturas</span>
              <strong className="billing-box-val">{novoEmail || usuarioLogado?.email}</strong>
            </div>
            <button 
              type="button" 
              onClick={() => setModalEmailAberto(true)} 
              className="btn-billing-edit-email"
              title="Alterar E-mail"
            >
              <i className="fas fa-pen"></i>
            </button>
          </div>

          <div className="billing-info-box">
            <div>
              <span className="billing-box-label">ID da Assinatura</span>
              <strong className="billing-box-val mono">
                {assinatura?.subscriptionId || 'SUB-' + (usuarioLogado?.uid?.substring(0, 10) || 'CELEBRE').toUpperCase()}
              </strong>
            </div>
            <i className="fas fa-fingerprint billing-box-icon"></i>
          </div>
        </div>



        {/* BOTÕES DE AÇÃO */}
        <div className="assinatura-action-btns-row">
          <button 
            type="button" 
            className="btn-alterar-cartao"
            onClick={() => {
              navigate('/gerenciar-pagamento');
            }}
          >
            <i className="fas fa-credit-card"></i> Gerenciar Pagamento, Cartões & Recorrência
          </button>

          {assinatura?.isActive && !isSuperAdmin && (
            <button 
              type="button" 
              onClick={handleCancelarAssinatura} 
              disabled={cancelando} 
              className="btn-cancelar-assinatura"
            >
              <i className="fas fa-ban"></i> {cancelando ? 'Cancelando...' : 'Cancelar Assinatura'}
            </button>
          )}
        </div>
      </div>

      {/* ⭐ SEÇÃO 3: RECURSOS INCLUÍDOS NO SEU PLANO (GRID FULL WIDTH BALANCEADO 4x2) */}
      <div className="assinatura-card-bloco">
        <div className="card-bloco-header">
          <div>
            <h3 className="card-bloco-title">
              <i className="fas fa-star" style={{ color: 'var(--dourado)' }}></i> Recursos Incluídos no Seu Plano
            </h3>
            <p className="card-bloco-desc">Todas as ferramentas ativas e disponíveis para a sua empresa.</p>
          </div>
          <span className="modulos-liberados-badge">
            <i className="fas fa-check-double"></i> 8 Módulos Liberados
          </span>
        </div>

        <div className="assinatura-modulos-grid">
          {[
            { icon: 'fas fa-users', color: '#3b82f6', title: 'Gestão de Clientes', desc: 'CRM completo e histórico de clientes' },
            { icon: 'fas fa-boxes', color: '#10b981', title: 'Gestão de Estoque', desc: 'Acervo com controle de peças e valores' },
            { icon: 'fas fa-hand-holding-heart', color: '#ec4899', title: 'Locações e Pedidos', desc: 'Orçamentos, reservas e agendamentos' },
            { icon: 'fas fa-truck', color: '#f59e0b', title: 'Logística & Entregas', desc: 'Controle de saídas, devoluções e frete' },
            { icon: 'fas fa-file-contract', color: '#8b5cf6', title: 'Emissão de Contratos', desc: 'Gerador e assinatura digital' },
            { icon: 'fas fa-store', color: '#06b6d4', title: 'Catálogo Digital', desc: 'Vitrine online para seus clientes' },
            { icon: 'fas fa-palette', color: '#f43f5e', title: 'Projetos Moodboard', desc: 'Criação de projetos visuais e decoração' },
            { icon: 'fas fa-chart-line', color: '#6366f1', title: 'Financeiro & DRE', desc: 'Controle de caixa, entradas e relatórios' }
          ].map((item, index) => (
            <div key={index} className="modulo-item-card">
              <div className="modulo-top-row">
                <div className="modulo-icon-box" style={{ backgroundColor: `${item.color}1a`, color: item.color }}>
                  <i className={item.icon}></i>
                </div>
                <span className="modulo-incluido-tag">
                  <i className="fas fa-check-circle"></i> Incluído
                </span>
              </div>

              <div className="modulo-text-block">
                <h4 className="modulo-title">{item.title}</h4>
                <p className="modulo-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 📄 SEÇÃO 4: HISTÓRICO DE FATURAMENTO RECENTE */}
      <div className="assinatura-card-bloco">
        <h3 className="card-bloco-title" style={{ marginBottom: '14px' }}>
          <i className="fas fa-history" style={{ color: 'var(--texto-secundario)' }}></i> Histórico Recente de Faturamento
        </h3>

        <div className="assinatura-tabela-wrapper">
          <table className="assinatura-tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Método</th>
                <th>Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Recibo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="data-col">{new Date().toLocaleDateString('pt-BR')}</td>
                <td className="desc-col">Assinatura Mensal - {planoNomeAtual}</td>
                <td className="metodo-col">Mercado Pago (Cartão / PIX)</td>
                <td className="valor-col">R$ {precoMensalAtual}</td>
                <td>
                  <span className="status-concluido-pill">Concluído</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button 
                    type="button" 
                    onClick={handleImprimirComprovante}
                    className="btn-imprimir-recibo"
                  >
                    <i className="fas fa-print"></i> Imprimir Recibo
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR E-MAIL DE FATURAS */}
      {modalEmailAberto && (
        <div className="assinatura-modal-overlay">
          <div className="assinatura-modal-card">
            <h3 className="assinatura-modal-title">
              Alterar E-mail de Faturamento
            </h3>
            <form onSubmit={handleSalvarEmail}>
              <input 
                type="email" 
                value={novoEmail}
                onChange={e => setNovoEmail(e.target.value)}
                required
                className="assinatura-modal-input"
              />
              <div className="assinatura-modal-actions">
                <button 
                  type="button"
                  onClick={() => setModalEmailAberto(false)}
                  className="btn-modal-cancelar"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={salvandoEmail}
                  className="btn-modal-salvar"
                >
                  {salvandoEmail ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 👑 MODAL VIP DE UPGRADE & MIGRAÇÃO DE PLANO (TODOS OS PLANOS E CICLOS) */}
      {modalMigracaoAberto && (
        <div className="assinatura-modal-overlay" onClick={() => setModalMigracaoAberto(false)}>
          <div className="modal-migracao-anual-card modal-migracao-multi-planos" onClick={e => e.stopPropagation()}>
            
            {/* CABEÇALHO DO MODAL */}
            <div className="modal-migracao-header">
              <div>
                <span className="modal-migracao-badge">
                  <i className="fas fa-crown"></i> UPGRADE & PLANOS CELEBRE
                </span>
                <h3 className="modal-migracao-title">
                  Planos Disponíveis para sua Empresa
                </h3>
                <p className="modal-migracao-sub">
                  Escolha o plano ideal para sua estrutura. No ciclo <strong>Anual você ganha 2 meses grátis (20% OFF)</strong> com pagamento à vista no PIX/Cartão ou parcelamento em até 12x com encargos da operadora.
                </p>
              </div>
              <button 
                type="button" 
                className="modal-migracao-close-btn"
                onClick={() => setModalMigracaoAberto(false)}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* SELETOR DE CICLO: COBRANÇA MENSAL VS COBRANÇA ANUAL */}
            <div className="modal-ciclo-toggle-wrapper">
              <div className="modal-ciclo-toggle-track">
                <button
                  type="button"
                  className={`modal-ciclo-toggle-btn ${modalCiclo === 'mensal' ? 'active' : ''}`}
                  onClick={() => {
                    setModalCiclo('mensal');
                    setDadosPixMigracao(null);
                    setErroPix('');
                  }}
                >
                  <i className="fas fa-calendar-alt"></i>
                  <span>Cobrança Mensal</span>
                </button>
                <button
                  type="button"
                  className={`modal-ciclo-toggle-btn ${modalCiclo === 'anual' ? 'active' : ''}`}
                  onClick={() => {
                    setModalCiclo('anual');
                    setDadosPixMigracao(null);
                    setErroPix('');
                  }}
                >
                  <i className="fas fa-crown"></i>
                  <span>Cobrança Anual (20% OFF)</span>
                  <span className="modal-ciclo-pill-gratis">2 MESES GRÁTIS</span>
                </button>
              </div>
            </div>

            {/* GRID DE CARDS DOS 3 PLANOS */}
            <div className="modal-planos-grid">
              {LISTA_PLANOS_DISPONIVEIS.map((plano) => {
                const isPlanoAtual = plano.id === planoAtualKey;
                const isSelected = modalPlanoSelecionado === plano.id;
                const isDestaque = plano.destaque;
                const nivelPlanoAtual = HIERARQUIA_PLANOS[planoAtualKey] || 2;
                const nivelPlanoCard = HIERARQUIA_PLANOS[plano.id] || 1;
                const isDowngradeCard = nivelPlanoCard < nivelPlanoAtual;

                return (
                  <div
                    key={plano.id}
                    className={`modal-plano-card ${isPlanoAtual ? 'is-plano-atual' : ''} ${isSelected ? 'is-selected' : ''} ${isDowngradeCard && !isPlanoAtual ? 'is-downgrade-card' : ''} ${isDestaque && !isPlanoAtual && !isDowngradeCard ? 'is-destaque' : ''}`}
                    onClick={() => {
                      setModalPlanoSelecionado(plano.id);
                      setCienteDowngrade(false);
                      setDadosPixMigracao(null);
                      setErroPix('');
                    }}
                  >
                    {/* RIBBON / SELO SUPERIOR */}
                    {isPlanoAtual ? (
                      <div className="modal-plano-ribbon atual">
                        <i className="fas fa-check-circle"></i> SEU PLANO ATUAL
                      </div>
                    ) : isDowngradeCard ? (
                      <div className="modal-plano-ribbon downgrade">
                        <i className="fas fa-arrow-down"></i> REDUÇÃO DE PLANO
                      </div>
                    ) : isDestaque ? (
                      <div className="modal-plano-ribbon popular">
                        <i className="fas fa-star"></i> MAIS POPULAR
                      </div>
                    ) : plano.id === 'plus' ? (
                      <div className="modal-plano-ribbon plus">
                        <i className="fas fa-rocket"></i> EXPANDIR EQUIPE
                      </div>
                    ) : (
                      <div className="modal-plano-ribbon basico">
                        <i className="fas fa-seedling"></i> ENTRADA
                      </div>
                    )}

                    {/* CABEÇALHO DO CARD */}
                    <div className="modal-plano-head">
                      <div className="modal-plano-icon-box" style={{ color: plano.corIcone, backgroundColor: `${plano.corIcone}1a` }}>
                        <i className={plano.icone}></i>
                      </div>
                      <div className="modal-plano-title-wrap">
                        <h4 className="modal-plano-name">{plano.nome}</h4>
                        <span className="modal-plano-users-badge">
                          <i className="fas fa-users"></i> {plano.usuarios}
                        </span>
                      </div>
                      <div className={`modal-plano-radio-circle ${isSelected ? 'selected' : ''}`}>
                        <i className="fas fa-check"></i>
                      </div>
                    </div>

                    {/* BLOCO DE PREÇO */}
                    <div className="modal-plano-price-box">
                      {modalCiclo === 'anual' ? (
                        <>
                          <span className="modal-plano-strike">
                            De: R$ {plano.precoAnualOriginalTotalFormatado}/ano
                          </span>
                          <div className="modal-plano-price-row">
                            <span className="modal-price-cur">R$</span>
                            <strong className="modal-price-val">{plano.precoAnualEquivMesFormatado}</strong>
                            <span className="modal-price-period">/mês*</span>
                          </div>
                          <span className="modal-plano-price-footer-sub">
                            R$ {plano.precoAnualTotalFormatado}/ano à vista no PIX ou 1x Cartão
                          </span>
                          <div className="modal-plano-savings-pill">
                            <i className="fas fa-gift"></i> Economize R$ {plano.economiaAnualFormatada}/ano
                          </div>
                          <span className="modal-plano-disclaimer-juros">
                            *Equiv. mensal no anual • Em até 12x com juros da operadora
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="modal-plano-strike-hidden">—</span>
                          <div className="modal-plano-price-row">
                            <span className="modal-price-cur">R$</span>
                            <strong className="modal-price-val">{plano.precoMensalFormatado}</strong>
                            <span className="modal-price-period">/mês</span>
                          </div>
                          <span className="modal-plano-price-footer-sub">
                            Cobrança mensal sem fidelidade
                          </span>
                          <div className="modal-plano-savings-pill neutral">
                            <i className="fas fa-percentage"></i> Disponível no Anual com 20% OFF
                          </div>
                        </>
                      )}
                    </div>

                    {/* STATUS DE PLANO QUE JÁ PAGA */}
                    {isPlanoAtual && (
                      <div className="modal-plano-atual-badge-tag">
                        <i className="fas fa-check-double"></i>
                        <span>
                          {modalCiclo === 'mensal' && !isUsuarioAnualAtual
                            ? `Você já paga este plano mensalmente (R$ ${precoMensalAtual}/mês)`
                            : `Seu plano atual • Migre para Anual e economize 2 meses!`}
                        </span>
                      </div>
                    )}

                    {/* LISTA DE BENEFÍCIOS */}
                    <ul className="modal-plano-features">
                      {plano.beneficios.map((ben, idx) => (
                        <li key={idx}>
                          <i className="fas fa-check"></i>
                          <span>{ben}</span>
                        </li>
                      ))}
                    </ul>

                    {/* BOTÃO DE SELEÇÃO INTERNO */}
                    <div className="modal-plano-btn-footer">
                      {isPlanoAtual && modalCiclo === 'mensal' && !isUsuarioAnualAtual ? (
                        <div className="modal-btn-plano-ativo">
                          <i className="fas fa-check-circle"></i>
                          <span>Plano Atual Ativo</span>
                        </div>
                      ) : isPlanoAtual && modalCiclo === 'anual' ? (
                        <div className={`modal-btn-plano-selecionar migrar ${isSelected ? 'selected' : ''}`}>
                          <i className="fas fa-crown"></i>
                          <span>{isSelected ? '✓ Plano Selecionado' : 'Migrar para Anual'}</span>
                        </div>
                      ) : isDowngradeCard ? (
                        <div className={`modal-btn-plano-selecionar downgrade ${isSelected ? 'selected' : ''}`}>
                          <i className="fas fa-arrow-down"></i>
                          <span>{isSelected ? '✓ Redução Selecionada' : `Reduzir para ${plano.nome}`}</span>
                        </div>
                      ) : (
                        <div className={`modal-btn-plano-selecionar ${isSelected ? 'selected' : ''}`}>
                          <i className={isSelected ? 'fas fa-check' : (plano.id === 'plus' ? 'fas fa-rocket' : 'fas fa-arrow-right')}></i>
                          <span>{isSelected ? '✓ Plano Selecionado' : (plano.id === 'plus' ? 'Escolher Plus' : `Escolher ${plano.nome}`)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* BANDEJA INFERIOR: AVISO SE FOR PLANO ATUAL MENSAL OU CHECKOUT TRAY */}
            {(() => {
              const planoSelecionadoObj = LISTA_PLANOS_DISPONIVEIS.find(p => p.id === modalPlanoSelecionado) || LISTA_PLANOS_DISPONIVEIS[1];
              const isMesmoPlanoEMensal = modalPlanoSelecionado === planoAtualKey && modalCiclo === 'mensal' && !isUsuarioAnualAtual;
              const nivelPlanoAtual = HIERARQUIA_PLANOS[planoAtualKey] || 2;
              const nivelPlanoSelecionado = HIERARQUIA_PLANOS[modalPlanoSelecionado] || 1;
              const isDowngrade = nivelPlanoSelecionado < nivelPlanoAtual;
              const equipeExcedente = vagasUsadas > planoSelecionadoObj.limiteUsuarios;

              if (isMesmoPlanoEMensal) {
                return (
                  <div className="modal-plano-mesmo-notice">
                    <div className="mesmo-notice-icon gold">
                      <i className="fas fa-shield-alt"></i>
                    </div>
                    <div className="mesmo-notice-text">
                      <strong>Você já é assinante do {planoSelecionadoObj.nome} Mensal (R$ {precoMensalAtual}/mês).</strong>
                      <p>
                        Para economizar <strong>2 meses de presente (R$ {planoSelecionadoObj.economiaAnualFormatada}/ano)</strong>, clique em <strong>Cobrança Anual (20% OFF)</strong> acima! Caso queira aumentar o limite de equipe para até 5 colaboradores, selecione o <strong>Plano Plus</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-switch-anual-rapido"
                      onClick={() => {
                        setModalCiclo('anual');
                        setDadosPixMigracao(null);
                        setErroPix('');
                      }}
                    >
                      <i className="fas fa-crown"></i> Ver Opção Anual (20% OFF)
                    </button>
                  </div>
                );
              }

              return (
                <div className={`modal-checkout-tray ${isDowngrade ? 'is-downgrade-mode' : ''}`}>
                  {/* RESUMO DO PLANO ESCOLHIDO */}
                  <div className="modal-tray-header">
                    <div className="modal-tray-info">
                      <span className={`modal-tray-pre-title ${isDowngrade ? 'downgrade-tag' : ''}`}>
                        {isDowngrade ? 'SOLICITAÇÃO DE REDUÇÃO DE PLANO:' : 'PLANO SELECIONADO:'}
                      </span>
                      <h4 className="modal-tray-title">
                        {planoSelecionadoObj.nome} • {modalCiclo === 'anual' ? 'Licença Anual (20% OFF)' : 'Assinatura Mensal'}
                      </h4>
                      <p className="modal-tray-desc">
                        {modalCiclo === 'anual'
                          ? `Pagamento de R$ ${planoSelecionadoObj.precoAnualTotalFormatado} à vista no PIX ou 1x Cartão (ou parcele em até 12x com encargos da operadora) • Economize R$ ${planoSelecionadoObj.economiaAnualFormatada}/ano`
                          : `R$ ${planoSelecionadoObj.precoMensalFormatado}/mês sem fidelidade • Cancele quando quiser`}
                      </p>
                    </div>

                    <div className="modal-tray-price-badge">
                      <span className="tray-cur">R$</span>
                      <strong className="tray-val">
                        {modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotalFormatado : planoSelecionadoObj.precoMensalFormatado}
                      </strong>
                      <span className="tray-per">{modalCiclo === 'anual' ? '/ano' : '/mês'}</span>
                    </div>
                  </div>

                  {/* ⚠️ ALERTA TRANSPARENTE DE DOWNGRADE / REDUÇÃO DE PLANO */}
                  {isDowngrade && (
                    <div className="modal-downgrade-warning-card">
                      <div className="downgrade-warning-header">
                        <div className="downgrade-icon-box">
                          <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <div>
                          <h5 className="downgrade-warning-title">
                            Atenção às Alterações ao Reduzir para o Plano {planoSelecionadoObj.nome}
                          </h5>
                          <span className="downgrade-warning-sub">
                            Seus dados continuam 100% seguros, mas observe a mudança de limites e recursos:
                          </span>
                        </div>
                      </div>

                      <div className="downgrade-diff-grid">
                        <div className="downgrade-diff-item">
                          <div className="diff-icon"><i className="fas fa-users"></i></div>
                          <div className="diff-texts">
                            <span className="diff-label">Limite da Equipe</span>
                            <span className="diff-desc">
                              Passará para <strong>{planoSelecionadoObj.usuarios}</strong> (atualmente você tem limite para {LISTA_PLANOS_DISPONIVEIS.find(p => p.id === planoAtualKey)?.usuarios}).
                            </span>
                          </div>
                        </div>

                        {planoSelecionadoObj.id === 'basico' && (
                          <div className="downgrade-diff-item">
                            <div className="diff-icon"><i className="fas fa-chart-line"></i></div>
                            <div className="diff-texts">
                              <span className="diff-label">Módulos Avançados</span>
                              <span className="diff-desc">
                                Gestão Financeira Completa & DRE ficarão desativados no Plano Básico.
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="downgrade-diff-item safe">
                          <div className="diff-icon safe"><i className="fas fa-shield-alt"></i></div>
                          <div className="diff-texts">
                            <span className="diff-label safe">Acervo e Clientes Preservados</span>
                            <span className="diff-desc">
                              Nenhuma peça do acervo, fotos, histórico de locações ou clientes será apagada.
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ALERTA CRÍTICO: SE HOUVER MAIS USUÁRIOS ATIVOS DO QUE O LIMITE DO PLANO ALVO */}
                      {equipeExcedente ? (
                        <div className="downgrade-vagas-bloqueio">
                          <i className="fas fa-user-times"></i>
                          <div style={{ flex: 1 }}>
                            <strong>Ajuste de Equipe Necessário:</strong>
                            <p>
                              Você possui atualmente <strong>{vagasUsadas} usuários ativos</strong> na equipe. Como o {planoSelecionadoObj.nome} permite apenas <strong>{planoSelecionadoObj.limiteUsuarios} acesso</strong>, desative os colaboradores extras no menu <strong>Equipe / Usuários</strong> antes de efetivar a redução.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-ir-usuarios"
                            onClick={() => {
                              setModalMigracaoAberto(false);
                              navigate('/usuarios');
                            }}
                          >
                            <i className="fas fa-users-cog"></i> Gerenciar Usuários
                          </button>
                        </div>
                      ) : (
                        <div className="downgrade-vigencia-note">
                          <i className="fas fa-calendar-check"></i>
                          <span>
                            Como a fatura do <strong>{planoNomeAtual}</strong> já foi paga neste mês, seu acesso completo atual permanece ativo até <strong>{estatisticasReais.dataRenovacao || 'a data de renovação'}</strong>. A nova cobrança reduzida de R$ {modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotalFormatado : planoSelecionadoObj.precoMensalFormatado} passará a vigorar no próximo ciclo.
                          </span>
                        </div>
                      )}

                      {/* CHECKBOX DE CONCORDÂNCIA */}
                      <label className="modal-downgrade-checkbox-label">
                        <input
                          type="checkbox"
                          checked={cienteDowngrade}
                          onChange={e => setCienteDowngrade(e.target.checked)}
                          disabled={equipeExcedente}
                        />
                        <span>
                          Estou ciente da redução do limite para <strong>{planoSelecionadoObj.usuarios}</strong> e confirmo a alteração de plano.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* SELETOR DE MÉTODO: PIX VS CARTÃO VS BOLETO */}
                  <div className="modal-migracao-tabs-bar">
                    <button 
                      type="button"
                      className={`modal-migracao-tab-btn ${metodoMigracao === 'pix' ? 'active' : ''}`}
                      onClick={() => setMetodoMigracao('pix')}
                    >
                      <i className="fab fa-pix" style={{ color: metodoMigracao === 'pix' ? '#00bdae' : 'inherit' }}></i>
                      <span>PIX Instantâneo</span>
                    </button>
                    <button 
                      type="button"
                      className={`modal-migracao-tab-btn ${metodoMigracao === 'cartao' ? 'active' : ''}`}
                      onClick={() => setMetodoMigracao('cartao')}
                    >
                      <i className="fas fa-credit-card" style={{ color: metodoMigracao === 'cartao' ? 'var(--dourado)' : 'inherit' }}></i>
                      <span>Cartão de Crédito</span>
                    </button>
                    <button 
                      type="button"
                      className={`modal-migracao-tab-btn ${metodoMigracao === 'boleto' ? 'active' : ''}`}
                      onClick={() => setMetodoMigracao('boleto')}
                    >
                      <i className="fas fa-barcode" style={{ color: metodoMigracao === 'boleto' ? '#f59e0b' : 'inherit' }}></i>
                      <span>Boleto por E-mail</span>
                    </button>
                  </div>

                  {/* ABA PIX */}
                  {metodoMigracao === 'pix' && (
                    <div className="modal-pix-content">
                      {!dadosPixMigracao ? (
                        <form onSubmit={handleGerarPixModal}>
                          <label className="modal-pix-label">
                            <i className="fas fa-id-card"></i>
                            <span>CPF do Titular (necessário para emissão do PIX no Mercado Pago):</span>
                          </label>
                          <div className="modal-input-cpf-wrapper">
                            <i className="fas fa-fingerprint input-inner-icon"></i>
                            <input 
                              type="text"
                              placeholder="000.000.000-00"
                              value={cpfMigracao}
                              onChange={e => setCpfMigracao(formatCPF(e.target.value))}
                              maxLength={14}
                              required
                              className="modal-pix-cpf-input"
                            />
                          </div>
                          {erroPix && (
                            <p className="modal-pix-erro-msg">
                              <i className="fas fa-exclamation-circle"></i> {erroPix}
                            </p>
                          )}
                          <button 
                            type="submit"
                            disabled={gerandoPix || (isDowngrade && (!cienteDowngrade || equipeExcedente))}
                            className={`btn-modal-gerar-pix ${isDowngrade ? 'btn-downgrade-confirm' : ''}`}
                          >
                            <i className={`fas ${gerandoPix ? 'fa-spinner fa-spin' : isDowngrade ? 'fa-check' : 'fa-qrcode'}`}></i>
                            <span>
                              {gerandoPix 
                                ? 'Processando no Mercado Pago...' 
                                : isDowngrade
                                  ? (equipeExcedente 
                                      ? 'Desative os usuários excedentes para prosseguir' 
                                      : (!cienteDowngrade 
                                          ? 'Marque a confirmação de redução acima' 
                                          : `Confirmar Redução via PIX (R$ ${modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotalFormatado : planoSelecionadoObj.precoMensalFormatado})`))
                                  : `Gerar QR Code PIX (R$ ${modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotalFormatado : planoSelecionadoObj.precoMensalFormatado})`}
                            </span>
                          </button>
                        </form>
                      ) : (
                        <div className="modal-pix-qrcode-box">
                          <img 
                            src={`data:image/jpeg;base64,${dadosPixMigracao.qrCodeBase64}`} 
                            alt="QR Code PIX Mercado Pago"
                            className="modal-pix-qrcode-img"
                          />
                          <span style={{ fontSize: '12.5px', color: '#10b981', fontWeight: '800', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fas fa-clock"></i> Aguardando Pagamento • Valor: R$ {dadosPixMigracao.valor ? dadosPixMigracao.valor.toFixed(2).replace('.', ',') : (modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotalFormatado : planoSelecionadoObj.precoMensalFormatado)}
                          </span>
                          <div className="modal-pix-copy-row">
                            <input 
                              type="text" 
                              readOnly 
                              value={dadosPixMigracao.copiaECola} 
                              className="modal-pix-input"
                            />
                            <button 
                              type="button" 
                              onClick={handleCopiarPix}
                              className="btn-copiar-pix-modal"
                            >
                              <i className={`fas ${pixCopiado ? 'fa-check' : 'fa-copy'}`}></i>
                              <span>{pixCopiado ? 'Copiado!' : 'Copiar PIX'}</span>
                            </button>
                          </div>
                          <p style={{ fontSize: '11.5px', color: 'var(--texto-secundario)', margin: '12px 0 0 0', textAlign: 'center' }}>
                            Após pagar pelo aplicativo do seu banco, o sistema reconhece o pagamento automaticamente em segundos!
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA CARTÃO - CHECKOUT DIRETO DENTRO DO MODAL SEM SAIR DA TELA */}
                  {metodoMigracao === 'cartao' && (
                    <div className="modal-cartao-content">
                      {statusCartaoModal?.texto && (
                        <div className={`modal-cartao-status-alert ${statusCartaoModal.tipo}`}>
                          <i className={`fas ${statusCartaoModal.tipo === 'sucesso' ? 'fa-check-circle' : statusCartaoModal.tipo === 'erro' ? 'fa-exclamation-circle' : 'fa-spinner fa-spin'}`}></i>
                          <span>{statusCartaoModal.texto}</span>
                        </div>
                      )}

                      {statusCartaoModal?.tipo !== 'sucesso' && (
                        <>
                          <div className="modal-cartao-info-strip">
                            <i className="fas fa-shield-alt"></i>
                            <div>
                              <strong>Pagamento Seguro via Mercado Pago</strong>
                              <p>
                                {modalCiclo === 'anual'
                                  ? `Total de R$ ${planoSelecionadoObj.precoAnualTotalFormatado} à vista ou parcele em até 12x no cartão (juros da sua operadora).`
                                  : `Mensalidade de R$ ${planoSelecionadoObj.precoMensalFormatado}/mês • Renovação automática sem fidelidade.`}
                              </p>
                            </div>
                          </div>

                          {isDowngrade && (!cienteDowngrade || equipeExcedente) ? (
                            <div className="modal-cartao-bloqueio-aviso">
                              <i className="fas fa-exclamation-triangle"></i>
                              <span>
                                {equipeExcedente 
                                  ? 'Desative os colaboradores excedentes no menu Usuários antes de prosseguir com a redução de plano.'
                                  : 'Por favor, marque a confirmação de redução de plano acima para liberar o formulário do cartão.'}
                              </span>
                            </div>
                          ) : (
                            <div className="modal-payment-brick-wrapper">
                              <Payment
                                key={`${planoSelecionadoObj.id}-${modalCiclo}-${modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotal : planoSelecionadoObj.precoMensal}`}
                                initialization={{
                                  amount: modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotal : planoSelecionadoObj.precoMensal,
                                  payer: { email: novoEmail || usuarioLogado?.email, entityType: 'individual' }
                                }}
                                customization={{
                                  paymentMethods: { creditCard: 'all' },
                                  visual: { style: { theme: 'default' } }
                                }}
                                onSubmit={onSubmitCartaoModal}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ABA BOLETO - ENVIO DIRETO POR E-MAIL E 2ª VIA */}
                  {metodoMigracao === 'boleto' && (
                    <div className="modal-boleto-content">
                      {!dadosBoletoMigracao ? (
                        <form onSubmit={handleGerarBoletoModal}>
                          <div className="modal-boleto-info-banner">
                            <div className="boleto-banner-icon">
                              <i className="fas fa-envelope-open-text"></i>
                            </div>
                            <div className="boleto-banner-text">
                              <strong>Envio Automático do Boleto por E-mail:</strong>
                              <p>
                                O boleto oficial com código de barras será gerado pelo Mercado Pago e enviado imediatamente para o seu e-mail cadastrado.
                                {modalCiclo === 'mensal' && ' Em cada novo ciclo mensal, o sistema continuará enviando o boleto atualizado automaticamente para você.'}
                              </p>
                            </div>
                          </div>

                          <div className="modal-boleto-inputs-grid">
                            <div>
                              <label className="modal-pix-label">
                                <i className="fas fa-id-card"></i>
                                <span>CPF do Titular (obrigatório para registro bancário):</span>
                              </label>
                              <div className="modal-input-cpf-wrapper">
                                <i className="fas fa-fingerprint input-inner-icon"></i>
                                <input 
                                  type="text" 
                                  placeholder="000.000.000-00" 
                                  value={cpfMigracao} 
                                  onChange={e => setCpfMigracao(formatCPF(e.target.value))} 
                                  maxLength={14} 
                                  required 
                                  className="modal-pix-cpf-input" 
                                />
                              </div>
                            </div>

                            <div>
                              <label className="modal-pix-label">
                                <i className="fas fa-at"></i>
                                <span>E-mail para Recebimento do Boleto:</span>
                              </label>
                              <div className="modal-input-cpf-wrapper">
                                <i className="fas fa-envelope input-inner-icon"></i>
                                <input 
                                  type="email" 
                                  placeholder="seuemail@exemplo.com" 
                                  value={emailEnvioBoleto} 
                                  onChange={e => setEmailEnvioBoleto(e.target.value)} 
                                  required 
                                  className="modal-pix-cpf-input" 
                                />
                              </div>
                            </div>
                          </div>

                          {erroBoleto && (
                            <p className="modal-pix-erro-msg">
                              <i className="fas fa-exclamation-circle"></i> {erroBoleto}
                            </p>
                          )}

                          <button 
                            type="submit"
                            disabled={gerandoBoleto || (isDowngrade && (!cienteDowngrade || equipeExcedente))}
                            className="btn-modal-gerar-pix btn-gerar-boleto"
                          >
                            <i className={`fas ${gerandoBoleto ? 'fa-spinner fa-spin' : 'fa-barcode'}`}></i>
                            <span>
                              {gerandoBoleto 
                                ? 'Emitindo Boleto no Mercado Pago...' 
                                : isDowngrade
                                  ? (equipeExcedente 
                                      ? 'Desative os usuários excedentes para prosseguir' 
                                      : (!cienteDowngrade 
                                          ? 'Marque a confirmação de redução acima' 
                                          : `Confirmar Redução via Boleto (R$ ${modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotalFormatado : planoSelecionadoObj.precoMensalFormatado})`))
                                  : `Gerar e Enviar Boleto por E-mail (R$ ${modalCiclo === 'anual' ? planoSelecionadoObj.precoAnualTotalFormatado : planoSelecionadoObj.precoMensalFormatado})`}
                            </span>
                          </button>
                        </form>
                      ) : (
                        <div className="modal-boleto-qrcode-box">
                          <div className="boleto-sucesso-header">
                            <div className="boleto-sucesso-icon">
                              <i className="fas fa-check-circle"></i>
                            </div>
                            <div>
                              <h4 className="boleto-sucesso-title">Boleto Emitido com Sucesso!</h4>
                              <p className="boleto-sucesso-sub">
                                Enviamos a via oficial completa para o e-mail: <strong>{dadosBoletoMigracao.emailEnvio}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="boleto-acoes-grid">
                            <a 
                              href={dadosBoletoMigracao.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="btn-abrir-boleto-modal"
                            >
                              <i className="fas fa-file-pdf"></i>
                              <span>Abrir / Imprimir Boleto Bancário</span>
                              <i className="fas fa-external-link-alt" style={{ fontSize: '11px', marginLeft: '6px' }}></i>
                            </a>

                            {dadosBoletoMigracao.codigoBarras && (
                              <div className="boleto-linha-digitavel-box">
                                <span className="linha-digitavel-label">Linha Digitável / Código de Barras:</span>
                                <div className="modal-pix-copy-row">
                                  <input 
                                    type="text" 
                                    readOnly 
                                    value={dadosBoletoMigracao.codigoBarras} 
                                    className="modal-pix-input" 
                                  />
                                  <button 
                                    type="button" 
                                    onClick={handleCopiarLinhaDigitavel} 
                                    className="btn-copiar-pix-modal btn-copiar-boleto"
                                  >
                                    <i className={`fas ${linhaDigitavelCopiada ? 'fa-check' : 'fa-copy'}`}></i>
                                    <span>{linhaDigitavelCopiada ? 'Copiado!' : 'Copiar Código'}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="boleto-aviso-compensacao">
                            <i className="fas fa-info-circle"></i>
                            <span>
                              O boleto tem vencimento em 3 dias úteis. A compensação bancária ocorre em até 1 a 2 dias úteis, e o sistema ativa automaticamente seu plano assim que o banco confirmar!
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      )}

    </div>
  );
};

export default AbaAssinaturaUso;
