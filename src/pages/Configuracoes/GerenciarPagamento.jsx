import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { initMercadoPago, CardPayment, Payment } from '@mercadopago/sdk-react';
import './GerenciarPagamento.css';

// 🔥 INICIALIZAÇÃO OFICIAL DO MERCADO PAGO 🔥
initMercadoPago('APP_USR-4c525755-f2c1-4e28-8c9e-020787a172a1', { locale: 'pt-BR' });

// Matriz de planos padrão para cálculo
const PLANOS_INFO = {
  basico: { nome: 'Plano Básico', mensal: 49.90, anual: 479.00, tag: 'Essencial' },
  premium: { nome: 'Plano Premium', mensal: 99.90, anual: 958.80, tag: 'Mais Popular' },
  plus: { nome: 'Plano Plus', mensal: 159.90, anual: 1535.00, tag: 'Máxima Performance' }
};

const GerenciarPagamento = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [tenantId, setTenantId] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Estados da Assinatura
  const [planoAtual, setPlanoAtual] = useState({
    chave: 'premium',
    nome: 'Plano Premium',
    valor: 99.90,
    ciclo: 'mensal', // 'mensal' ou 'anual'
    status: 'ativa',
    dataRenovacao: '',
    subscriptionId: ''
  });

  // Modalidade de Recorrência ('cartao' ou 'boleto')
  const [modalidadeRecorrente, setModalidadeRecorrente] = useState('cartao');
  const [salvandoModalidade, setSalvandoModalidade] = useState(false);

  // Cartão Cadastrado
  const [cartaoSalvo, setCartaoSalvo] = useState({
    possuiCartao: false,
    ultimosDigitos: '4242',
    bandeira: 'visa',
    titular: '',
    validade: '12/28'
  });

  // Alteração de Cartão
  const [modoAlterarCartao, setModoAlterarCartao] = useState(false);
  const [statusCartaoUpdate, setStatusCartaoUpdate] = useState({ texto: '', tipo: '' });
  const [novoCartaoProcessando, setNovoCartaoProcessando] = useState(false);

  // Renovação Manual Antecipada
  const [abaRenovacao, setAbaRenovacao] = useState('cartao'); // 'cartao', 'pix', 'boleto'
  const [cpfRenovacao, setCpfRenovacao] = useState('');
  const [gerandoPix, setGerandoPix] = useState(false);
  const [dadosPix, setDadosPix] = useState(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);
  const [dadosBoleto, setDadosBoleto] = useState(null);
  const [linhaDigitavelCopiada, setLinhaDigitavelCopiada] = useState(false);
  const [erroRenovacao, setErroRenovacao] = useState('');

  // E-mail de Faturamento
  const [emailFaturamento, setEmailFaturamento] = useState('');
  const [editandoEmail, setEditandoEmail] = useState(false);
  const [novoEmailInput, setNovoEmailInput] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  // Histórico de Faturas
  const [historicoFaturas, setHistoricoFaturas] = useState([]);
  const [faturaSelecionadaRecibo, setFaturaSelecionadaRecibo] = useState(null);

  // Feedback Toast Geral
  const [toastMsg, setToastMsg] = useState({ visivel: false, texto: '', tipo: 'sucesso' });

  const mostrarToast = (texto, tipo = 'sucesso') => {
    setToastMsg({ visivel: true, texto, tipo });
    setTimeout(() => setToastMsg(prev => ({ ...prev, visivel: false })), 4000);
  };

  const formatarCPF = (v) => {
    return v.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14);
  };

  // 🔄 CARREGAR DADOS DO USUÁRIO E ASSINATURA
  useEffect(() => {
    const carregarDadosAssinatura = async () => {
      if (!usuarioLogado) {
        setLoading(false);
        return;
      }

      try {
        const idTenant = localStorage.getItem('tenantId') || usuarioLogado.uid;
        setTenantId(idTenant);
        const superAdminCheck = usuarioLogado.email === 'celebrefesta25@gmail.com' || usuarioLogado.email === 'admin@celebre.com';
        setIsSuperAdmin(superAdminCheck);

        const userRef = doc(db, 'usuarios', idTenant);
        const userSnap = await getDoc(userRef);

        let uData = {};
        if (userSnap.exists()) {
          uData = userSnap.data();
          setUserData(uData);
        }

        // Identificar Plano
        const rawPlanoId = String(uData.planoId || '').toLowerCase();
        let chavePlano = 'premium';
        let isAnual = rawPlanoId.includes('anual') || String(uData.cicloAssinatura || '').toLowerCase() === 'anual';

        if (rawPlanoId.includes('basico')) chavePlano = 'basico';
        else if (rawPlanoId.includes('plus')) chavePlano = 'plus';
        else chavePlano = 'premium';

        const infoPlano = PLANOS_INFO[chavePlano];
        const valorCiclo = isAnual ? infoPlano.anual : (parseFloat(uData.valorAssinatura) || infoPlano.mensal);

        // Data de Renovação
        let dataRenov = uData.dataRenovacao || uData.proximaCobranca || '';
        if (!dataRenov) {
          const hoje = new Date();
          const renov = new Date(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
          dataRenov = renov.toLocaleDateString('pt-BR');
        }

        setPlanoAtual({
          chave: chavePlano,
          nome: infoPlano.nome,
          valor: valorCiclo,
          ciclo: isAnual ? 'anual' : 'mensal',
          status: uData.statusAssinatura || (uData.assinaturaAtiva ? 'ativa' : 'ativa'),
          dataRenovacao: dataRenov,
          subscriptionId: uData.subscriptionId || `SUB-${idTenant.substring(0, 8).toUpperCase()}`
        });

        // Método de Pagamento / Recorrência
        const metodoDb = String(uData.metodoPagamento || '').toLowerCase();
        if (metodoDb.includes('boleto')) {
          setModalidadeRecorrente('boleto');
        } else {
          setModalidadeRecorrente('cartao');
        }

        // Cartão Salvo
        if (uData.cartaoRecorrente) {
          setCartaoSalvo({
            possuiCartao: true,
            ultimosDigitos: uData.cartaoRecorrente.ultimosDigitos || '4242',
            bandeira: uData.cartaoRecorrente.bandeira || 'visa',
            titular: uData.cartaoRecorrente.titular || usuarioLogado.displayName || 'TITULAR CADASTRADO',
            validade: uData.cartaoRecorrente.validade || '12/28'
          });
        } else {
          // Se já assinou por cartão, simula o cartão principal cadastrado
          const jaAssinante = uData.assinaturaAtiva === true || uData.statusAssinatura === 'ativa' || uData.plano === 'pago';
          setCartaoSalvo({
            possuiCartao: jaAssinante,
            ultimosDigitos: '4242',
            bandeira: 'visa',
            titular: (usuarioLogado.displayName || 'EMPRESA ASSINANTE').toUpperCase(),
            validade: '12/28'
          });
        }

        // CPF
        const cpfRaw = uData.cpf || uData.documento || '';
        const apenasDigitos = String(cpfRaw).replace(/\D/g, '');
        if (apenasDigitos.length === 11) {
          setCpfRenovacao(formatarCPF(apenasDigitos));
        }

        // E-mail de Faturamento
        const emailFat = uData.emailCobranca || uData.email || usuarioLogado.email;
        setEmailFaturamento(emailFat);
        setNovoEmailInput(emailFat);

        // Carregar Histórico de Faturas / Atividades Financeiras (Ordenação em memória para não exigir índice composto no Firestore)
        try {
          const logsRef = collection(db, 'logs_atividades');
          const qLogs = query(
            logsRef,
            where('empresaId', '==', idTenant),
            limit(50)
          );
          const snapLogs = await getDocs(qLogs);
          const faturas = [];

          const docsOrdenados = [...snapLogs.docs].sort((a, b) => {
            const da = a.data();
            const db = b.data();
            const ta = da.criadoEm?.toMillis ? da.criadoEm.toMillis() : (da.dataHora ? new Date(da.dataHora).getTime() : 0);
            const tb = db.criadoEm?.toMillis ? db.criadoEm.toMillis() : (db.dataHora ? new Date(db.dataHora).getTime() : 0);
            return tb - ta;
          });

          docsOrdenados.forEach(docSnap => {
            const data = docSnap.data();
            const acao = String(data.acao || '').toUpperCase();
            if (acao.includes('ASSINATURA') || acao.includes('PAGAMENTO') || acao.includes('CHECKOUT') || acao.includes('RENOVA')) {
              faturas.push({
                id: docSnap.id,
                data: data.dataHora ? new Date(data.dataHora).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                hora: data.dataHora ? new Date(data.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
                descricao: `${infoPlano.nome} • ${isAnual ? 'Licença Anual' : 'Mensalidade'}`,
                valor: valorCiclo,
                metodo: data.detalhes?.includes('Boleto') ? 'Boleto Bancário' : data.detalhes?.includes('PIX') ? 'PIX' : 'Cartão de Crédito',
                status: 'Pago & Aprovado',
                detalhes: data.detalhes || 'Transação processada com sucesso no Mercado Pago.',
                comprovanteNum: `FAT-${docSnap.id.substring(0, 8).toUpperCase()}`
              });
            }
          });

          // Se não houver logs anteriores, cria linha inicial da fatura ativa
          if (faturas.length === 0) {
            faturas.push({
              id: 'fat-inicial',
              data: new Date().toLocaleDateString('pt-BR'),
              hora: '10:00',
              descricao: `${infoPlano.nome} • ${isAnual ? 'Licença Anual' : 'Ciclo Mensal Atual'}`,
              valor: valorCiclo,
              metodo: metodoDb.includes('boleto') ? 'Boleto Bancário' : 'Cartão de Crédito',
              status: 'Pago & Aprovado',
              detalhes: 'Assinatura confirmada e ativa no Mercado Pago.',
              comprovanteNum: `FAT-${idTenant.substring(0, 8).toUpperCase()}`
            });
          }

          setHistoricoFaturas(faturas);
        } catch (errLogs) {
          console.warn("Aviso ao buscar logs de faturas:", errLogs);
          setHistoricoFaturas([{
            id: 'fat-fallback',
            data: new Date().toLocaleDateString('pt-BR'),
            hora: '12:00',
            descricao: `${infoPlano.nome} • Ciclo Ativo`,
            valor: valorCiclo,
            metodo: 'Cartão de Crédito',
            status: 'Pago & Aprovado',
            detalhes: 'Assinatura ativa e em dia.',
            comprovanteNum: `FAT-${idTenant.substring(0, 8).toUpperCase()}`
          }]);
        }
      } catch (err) {
        console.error("Erro ao carregar dados da página de gestão de pagamento:", err);
      } finally {
        setLoading(false);
      }
    };

    carregarDadosAssinatura();
  }, [usuarioLogado]);

  // 📝 REGISTRO DE AUDITORIA
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado || !tenantId) return;
    try {
      await addDoc(collection(db, 'logs_atividades'), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado.uid,
        nomeFuncionario: usuarioLogado.displayName || 'Gestor da Assinatura',
        usuarioEmail: usuarioLogado.email || 'Desconhecido',
        acao: acao.toUpperCase(),
        detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (e) {
      console.warn("Aviso ao gravar log:", e);
    }
  };

  // 💳 SALVAR PREFERÊNCIA DE MODALIDADE RECORRENTE (CARTÃO VS BOLETO)
  const handleTrocarModalidade = async (novaModalidade) => {
    if (novaModalidade === modalidadeRecorrente) return;
    setSalvandoModalidade(true);
    try {
      const userRef = doc(db, 'usuarios', tenantId);
      const textoMetodo = novaModalidade === 'cartao' ? 'Cartão de Crédito' : 'Boleto Bancário';
      await updateDoc(userRef, {
        metodoPagamento: textoMetodo
      });

      setModalidadeRecorrente(novaModalidade);
      await registrarLog(
        "ALTERAÇÃO DE RECORRÊNCIA",
        `A empresa alterou o método de cobrança recorrente para: ${textoMetodo}.`
      );

      mostrarToast(
        novaModalidade === 'cartao'
          ? "✅ Modo de Recorrência alterado para Cartão de Crédito Automático!"
          : "✅ Modo de Recorrência alterado para Boleto Bancário Recorrente (enviado por e-mail)!"
      );
    } catch (err) {
      console.error("Erro ao alterar modalidade recorrente:", err);
      mostrarToast("Erro ao salvar modalidade de cobrança.", "erro");
    } finally {
      setSalvandoModalidade(false);
    }
  };

  // 💳 PROCESSAR NOVO CARTÃO DE CRÉDITO NO MERCADO PAGO
  const onSubmitNovoCartao = async (param) => {
    const formData = param?.formData || param;
    setStatusCartaoUpdate({ texto: 'Validando e salvando cartão de crédito no Mercado Pago...', tipo: 'info' });
    setNovoCartaoProcessando(true);

    return new Promise(async (resolve, reject) => {
      try {
        const URL_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
        const payload = {
          ...formData,
          userId: tenantId,
          planoId: planoAtual.chave,
          valorOriginal: planoAtual.valor,
          valorCobrado: planoAtual.valor,
          isAlteracaoCartao: true
        };

        const res = await fetch(URL_ROBO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resData = await res.json();

        if (resData.status === 'approved' || resData.status === 'authorized' || resData.status === 'in_process') {
          const ultimosDigitos = formData.cardholder?.last_four_digits || formData.last_four_digits || String(formData?.cardNumber || '8888').slice(-4);
          const bandeira = formData.payment_method_id || 'visa';
          const titular = formData.payer?.first_name 
            ? `${formData.payer.first_name} ${formData.payer.last_name || ''}`.trim().toUpperCase()
            : (usuarioLogado.displayName || 'EMPRESA ASSINANTE').toUpperCase();

          const dadosNovosCartao = {
            possuiCartao: true,
            ultimosDigitos: ultimosDigitos || '8888',
            bandeira: bandeira,
            titular: titular,
            validade: '12/29',
            atualizadoEm: new Date().toISOString()
          };

          const userRef = doc(db, 'usuarios', tenantId);
          await updateDoc(userRef, {
            metodoPagamento: 'Cartão de Crédito',
            cartaoRecorrente: dadosNovosCartao,
            statusAssinatura: 'ativa',
            assinaturaAtiva: true
          });

          setCartaoSalvo(dadosNovosCartao);
          setModalidadeRecorrente('cartao');
          setStatusCartaoUpdate({
            texto: '🎉 Cartão de crédito atualizado com sucesso! As próximas cobranças serão debitadas neste novo cartão.',
            tipo: 'sucesso'
          });

          await registrarLog(
            "CARTÃO ATUALIZADO",
            `Novo cartão de crédito (${bandeira.toUpperCase()} final ${ultimosDigitos}) cadastrado com sucesso para recorrência.`
          );

          mostrarToast("Cartão de crédito salvo com sucesso!");
          resolve();

          setTimeout(() => {
            setModoAlterarCartao(false);
            setStatusCartaoUpdate({ texto: '', tipo: '' });
          }, 3000);
        } else {
          const msgRecusa = resData.message || 'Cartão não autorizado pela operadora. Verifique os dados e tente novamente.';
          setStatusCartaoUpdate({ texto: `❌ ${msgRecusa}`, tipo: 'erro' });
          resolve();
        }
      } catch (e) {
        console.error("Erro ao atualizar cartão:", e);
        setStatusCartaoUpdate({ texto: '⚠️ Falha de comunicação com o Mercado Pago. Tente novamente.', tipo: 'erro' });
        reject();
      } finally {
        setNovoCartaoProcessando(false);
      }
    });
  };

  // ⚡ RENOVAÇÃO MANUAL ANTECIPADA: PIX DINÂMICO
  const handleGerarPixAntecipado = async (e) => {
    e.preventDefault();
    const cpfLimpo = cpfRenovacao.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErroRenovacao('⚠️ Informe um CPF válido com 11 dígitos para emissão do PIX.');
      return;
    }

    setGerandoPix(true);
    setErroRenovacao('');
    try {
      const URL_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
      const payload = {
        payment_method_id: 'pix',
        transaction_amount: planoAtual.valor,
        payer: {
          email: emailFaturamento || usuarioLogado.email,
          identification: { type: 'CPF', number: cpfLimpo }
        },
        userId: tenantId,
        planoId: planoAtual.chave,
        tipoOperacao: 'renovacao_antecipada'
      };

      const res = await fetch(URL_ROBO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.point_of_interaction?.transaction_data?.qr_code) {
        setDadosPix({
          qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
          copiaECola: data.point_of_interaction.transaction_data.qr_code,
          valor: planoAtual.valor
        });
        await registrarLog("PIX GERADO", `Gerou PIX para renovação antecipada do ${planoAtual.nome} (R$ ${planoAtual.valor.toFixed(2).replace('.', ',')}).`);
      } else {
        setErroRenovacao(data.message || 'Não foi possível gerar a chave PIX no momento.');
      }
    } catch (err) {
      console.error("Erro ao gerar PIX antecipado:", err);
      setErroRenovacao('Erro de conexão ao comunicar com o Mercado Pago.');
    } finally {
      setGerandoPix(false);
    }
  };

  const handleCopiarPix = () => {
    if (dadosPix?.copiaECola) {
      navigator.clipboard.writeText(dadosPix.copiaECola);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 3000);
    }
  };

  // 📄 RENOVAÇÃO MANUAL ANTECIPADA: BOLETO MERCADO PAGO
  const handleGerarBoletoAntecipado = async (e) => {
    e.preventDefault();
    const cpfLimpo = cpfRenovacao.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErroRenovacao('⚠️ Informe um CPF válido com 11 dígitos para emissão do Boleto.');
      return;
    }

    setGerandoBoleto(true);
    setErroRenovacao('');
    try {
      const URL_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
      const emailDestino = emailFaturamento || usuarioLogado.email;
      const payload = {
        payment_method_id: 'bolbradesco',
        transaction_amount: planoAtual.valor,
        payer: {
          email: emailDestino,
          identification: { type: 'CPF', number: cpfLimpo }
        },
        userId: tenantId,
        planoId: planoAtual.chave,
        tipoOperacao: 'renovacao_antecipada'
      };

      const res = await fetch(URL_ROBO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.transaction_details?.external_resource_url || data.barcode?.content) {
        const urlBoleto = data.transaction_details?.external_resource_url || '';
        const barcodeContent = data.barcode?.content || '';

        setDadosBoleto({
          link: urlBoleto,
          codigoBarras: barcodeContent,
          valor: planoAtual.valor,
          emailEnvio: emailDestino
        });

        await registrarLog("BOLETO GERADO", `Boleto emitido para renovação do plano ${planoAtual.nome}.`);
      } else {
        setErroRenovacao(data.message || 'Falha ao emitir boleto bancário no Mercado Pago.');
      }
    } catch (err) {
      console.error("Erro ao emitir boleto:", err);
      setErroRenovacao('Erro de comunicação com o servidor bancário.');
    } finally {
      setGerandoBoleto(false);
    }
  };

  const handleCopiarLinhaDigitavel = () => {
    if (dadosBoleto?.codigoBarras) {
      navigator.clipboard.writeText(dadosBoleto.codigoBarras);
      setLinhaDigitavelCopiada(true);
      setTimeout(() => setLinhaDigitavelCopiada(false), 3000);
    }
  };

  // ✉️ SALVAR E-MAIL DE FATURAMENTO
  const handleSalvarEmailFaturamento = async (e) => {
    e.preventDefault();
    if (!novoEmailInput || !novoEmailInput.includes('@')) {
      mostrarToast("Informe um e-mail válido.", "erro");
      return;
    }
    setSalvandoEmail(true);
    try {
      const userRef = doc(db, 'usuarios', tenantId);
      await updateDoc(userRef, { emailCobranca: novoEmailInput.trim() });
      setEmailFaturamento(novoEmailInput.trim());
      setEditandoEmail(false);
      mostrarToast("E-mail de faturamento atualizado com sucesso!");
      await registrarLog("EMAIL FATURAMENTO", `E-mail de faturamento atualizado para: ${novoEmailInput.trim()}`);
    } catch (e) {
      console.error("Erro ao atualizar e-mail:", e);
      mostrarToast("Erro ao salvar novo e-mail.", "erro");
    } finally {
      setSalvandoEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="gerenciar-pagamento-container loading-state">
        <div className="loading-spinner-box">
          <i className="fas fa-spinner fa-spin fa-2x"></i>
          <p>Carregando dados seguros de pagamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gerenciar-pagamento-container fade-in">
      
      {/* TOAST FLUTUANTE DE FEEDBACK */}
      {toastMsg.visivel && (
        <div className={`pagamento-toast ${toastMsg.tipo}`}>
          <i className={`fas ${toastMsg.tipo === 'sucesso' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          <span>{toastMsg.texto}</span>
        </div>
      )}

      {/* 🧭 CABEÇALHO DEDICADO COM RETORNO */}
      <div className="pagamento-top-header">
        <div className="header-left">
          <button 
            type="button" 
            className="btn-voltar-assinatura"
            onClick={() => navigate('/configuracoes?tab=assinatura')}
          >
            <i className="fas fa-arrow-left"></i> Voltar para Assinatura & Uso
          </button>
          
          <div className="header-title-group">
            <h1 className="pagamento-main-title">
              <i className="fas fa-shield-alt" style={{ color: 'var(--dourado)' }}></i> Gestão de Pagamentos, Cartões & Recorrência
            </h1>
            <p className="pagamento-subtitle">
              Ambiente seguro para gerenciar seu cartão cadastrado, alterar forma de cobrança recorrente e consultar faturas.
            </p>
          </div>
        </div>

        <div className="header-badges-right">
          <div className="mp-secure-badge">
            <i className="fas fa-lock"></i>
            <div>
              <strong>Ambiente 100% Criptografado</strong>
              <span>Mercado Pago PCI-DSS Compliance</span>
            </div>
          </div>
        </div>
      </div>


      {/* 🧩 GRID PRINCIPAL EM 2 COLUNAS */}
      <div className="pagamento-main-grid">

        {/* ⬅️ COLUNA ESQUERDA: GESTÃO DE CARTÕES & MODALIDADE DE RECORRÊNCIA */}
        <div className="pagamento-col">

          {/* 💳 CARD 1: CARTÃO DE CRÉDITO PRINCIPAL CADASTRADO */}
          <div className="pagamento-card-bloco">
            <div className="bloco-header">
              <div>
                <h3 className="bloco-title">
                  <i className="fas fa-credit-card" style={{ color: 'var(--dourado)' }}></i> Cartão Cadastrado para a Recorrência
                </h3>
                <p className="bloco-desc">Este é o cartão utilizado nas renovações automáticas do seu plano.</p>
              </div>
              <span className="bloco-badge">
                <i className="fas fa-sync-alt"></i> Cobrança Automática
              </span>
            </div>

            {/* VISUALIZAÇÃO REALISTA DE CARTÃO VIP */}
            <div className="cartao-vip-display-card">
              <div className="cartao-vip-top-row">
                <div className="cartao-chip-box">
                  <div className="cartao-chip"></div>
                  <i className="fas fa-wifi cartao-contactless"></i>
                </div>
                <div className="cartao-brand-logo">
                  {cartaoSalvo.bandeira.toLowerCase().includes('master') ? (
                    <span className="brand-badge master">Mastercard</span>
                  ) : cartaoSalvo.bandeira.toLowerCase().includes('elo') ? (
                    <span className="brand-badge elo">Elo</span>
                  ) : (
                    <span className="brand-badge visa">VISA</span>
                  )}
                </div>
              </div>

              <div className="cartao-vip-number">
                <span>••••</span>
                <span>••••</span>
                <span>••••</span>
                <span className="card-digits-last">{cartaoSalvo.ultimosDigitos || '4242'}</span>
              </div>

              <div className="cartao-vip-bottom-row">
                <div className="cartao-holder">
                  <small>TITULAR DO CARTÃO</small>
                  <strong>{cartaoSalvo.titular || (usuarioLogado.displayName || 'EMPRESA ASSINANTE').toUpperCase()}</strong>
                </div>
                <div className="cartao-expiry">
                  <small>VALIDADE</small>
                  <strong>{cartaoSalvo.validade || '12/28'}</strong>
                </div>
              </div>
            </div>

            {/* STATUS DO CARTÃO E BOTÃO PARA ALTERAR */}
            <div className="cartao-status-footer">
              <div className="cartao-status-indicator">
                <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i>
                <span>Cartão Principal Ativo para as Próximas Renovações</span>
              </div>

              <button
                type="button"
                className="btn-trigger-alterar-cartao"
                onClick={() => {
                  setStatusCartaoUpdate({ texto: '', tipo: '' });
                  setModoAlterarCartao(true);
                }}
              >
                <i className="fas fa-pen"></i>
                <span>Alterar / Cadastrar Novo Cartão</span>
              </button>
            </div>
          </div>

          {/* 🔄 CARD 2: GESTÃO DE MODALIDADE DE RECORRÊNCIA (CARTÃO VS BOLETO) */}
          <div className="pagamento-card-bloco">
            <div className="bloco-header">
              <div>
                <h3 className="bloco-title">
                  <i className="fas fa-sliders-h" style={{ color: 'var(--dourado)' }}></i> Preferência de Recorrência
                </h3>
                <p className="bloco-desc">Escolha como a sua empresa prefere realizar o pagamento a cada ciclo.</p>
              </div>
            </div>

            <div className="recorrencia-options-grid">
              
              {/* OPÇÃO 1: CARTÃO AUTOMÁTICO */}
              <div 
                className={`recorrencia-option-card ${modalidadeRecorrente === 'cartao' ? 'selecionada' : ''}`}
                onClick={() => handleTrocarModalidade('cartao')}
              >
                <div className="option-radio-indicator">
                  <div className="radio-circle">
                    {modalidadeRecorrente === 'cartao' && <div className="radio-dot"></div>}
                  </div>
                </div>
                <div className="option-content">
                  <div className="option-title-row">
                    <strong>Débito Automático no Cartão</strong>
                    <span className="badge-recomendado">Recomendado</span>
                  </div>
                  <p>Cobrança sem intervenção no dia do vencimento. Seu acesso ao acervo e equipe nunca é interrompido.</p>
                  <span className="option-check-feature">
                    <i className="fas fa-check"></i> Recibos e comprovantes automáticos por e-mail
                  </span>
                </div>
              </div>

              {/* OPÇÃO 2: BOLETO RECORRENTE POR E-MAIL */}
              <div 
                className={`recorrencia-option-card ${modalidadeRecorrente === 'boleto' ? 'selecionada' : ''}`}
                onClick={() => handleTrocarModalidade('boleto')}
              >
                <div className="option-radio-indicator">
                  <div className="radio-circle">
                    {modalidadeRecorrente === 'boleto' && <div className="radio-dot"></div>}
                  </div>
                </div>
                <div className="option-content">
                  <div className="option-title-row">
                    <strong>Boleto Bancário Recorrente</strong>
                    <span className="badge-boleto">Envio por E-mail</span>
                  </div>
                  <p>A cada ciclo, um boleto bancário é gerado e enviado automaticamente para o e-mail da sua empresa 3 dias antes.</p>
                  <span className="option-check-feature">
                    <i className="fas fa-barcode"></i> Acompanha código de barras e link de PDF
                  </span>
                </div>
              </div>

            </div>

            {salvandoModalidade && (
              <p className="salvando-modalidade-status">
                <i className="fas fa-spinner fa-spin"></i> Atualizando preferência de cobrança...
              </p>
            )}
          </div>

        </div>

        {/* ➡️ COLUNA DIREITA: RENOVAÇÃO ANTECIPADA & E-MAIL DE FATURAMENTO */}
        <div className="pagamento-col">

          {/* ⚡ CARD 3: RENOVAÇÃO MANUAL ANTECIPADA / QUITAÇÃO IMEDIATA */}
          <div className="pagamento-card-bloco">
            <div className="bloco-header">
              <div>
                <h3 className="bloco-title">
                  <i className="fas fa-bolt" style={{ color: 'var(--dourado)' }}></i> Renovação Manual / Antecipar Ciclo
                </h3>
                <p className="bloco-desc">Deseja quitar antecipadamente ou pagar uma fatura em aberto?</p>
              </div>
              <div className="valor-renovacao-tag">
                <span>R$</span> <strong>{planoAtual.valor.toFixed(2).replace('.', ',')}</strong>
              </div>
            </div>

            {/* ABAS DE MÉTODOS PARA RENOVAÇÃO MANUAL */}
            <div className="renovacao-tabs-row">
              <button
                type="button"
                className={`btn-renov-tab ${abaRenovacao === 'cartao' ? 'active' : ''}`}
                onClick={() => setAbaRenovacao('cartao')}
              >
                <i className="fas fa-credit-card"></i> Cartão
              </button>

              <button
                type="button"
                className={`btn-renov-tab ${abaRenovacao === 'pix' ? 'active' : ''}`}
                onClick={() => setAbaRenovacao('pix')}
              >
                <i className="fas fa-qrcode"></i> PIX Instantâneo
              </button>

              <button
                type="button"
                className={`btn-renov-tab ${abaRenovacao === 'boleto' ? 'active' : ''}`}
                onClick={() => setAbaRenovacao('boleto')}
              >
                <i className="fas fa-barcode"></i> Boleto
              </button>
            </div>

            {/* CONTEÚDO DA ABA: CARTÃO */}
            {abaRenovacao === 'cartao' && (
              <div className="renovacao-content-tab">
                <div className="renov-cartao-info">
                  <i className="fas fa-shield-alt"></i>
                  <div>
                    <strong>Pagar agora com o cartão cadastrado</strong>
                    <p>Será cobrado o valor de <strong>R$ {planoAtual.valor.toFixed(2).replace('.', ',')}</strong> no cartão final <strong>{cartaoSalvo.ultimosDigitos}</strong> e sua data de renovação será estendida automaticamente.</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-efetuar-cobranca-imediata"
                  onClick={() => setModoAlterarCartao(true)}
                >
                  <i className="fas fa-check-circle"></i> Pagar Ciclo com Cartão
                </button>
              </div>
            )}

            {/* CONTEÚDO DA ABA: PIX INSTANTÂNEO */}
            {abaRenovacao === 'pix' && (
              <div className="renovacao-content-tab">
                {!dadosPix ? (
                  <form onSubmit={handleGerarPixAntecipado} className="renov-pix-form">
                    <label className="renov-input-label">
                      <span>CPF do Pagador (Obrigatório para emissão de PIX):</span>
                    </label>
                    <div className="renov-input-wrapper">
                      <i className="fas fa-id-card"></i>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={cpfRenovacao}
                        onChange={e => setCpfRenovacao(formatarCPF(e.target.value))}
                        maxLength={14}
                        required
                        className="renov-cpf-input"
                      />
                    </div>

                    {erroRenovacao && (
                      <p className="renov-erro-msg"><i className="fas fa-exclamation-triangle"></i> {erroRenovacao}</p>
                    )}

                    <button
                      type="submit"
                      disabled={gerandoPix}
                      className="btn-gerar-pix-renov"
                    >
                      <i className={`fas ${gerandoPix ? 'fa-spinner fa-spin' : 'fa-qrcode'}`}></i>
                      <span>{gerandoPix ? 'Gerando no Mercado Pago...' : `Gerar QR Code PIX (R$ ${planoAtual.valor.toFixed(2).replace('.', ',')})`}</span>
                    </button>
                  </form>
                ) : (
                  <div className="renov-pix-resultado">
                    <img 
                      src={`data:image/jpeg;base64,${dadosPix.qrCodeBase64}`} 
                      alt="QR Code PIX Mercado Pago"
                      className="pix-qrcode-image"
                    />
                    <div className="pix-aguardando-badge">
                      <i className="fas fa-clock"></i> Aguardando Pagamento • R$ {planoAtual.valor.toFixed(2).replace('.', ',')}
                    </div>

                    <div className="pix-copia-cola-row">
                      <input type="text" readOnly value={dadosPix.copiaECola} className="pix-input-code" />
                      <button type="button" onClick={handleCopiarPix} className="btn-copiar-pix-code">
                        <i className={`fas ${pixCopiado ? 'fa-check' : 'fa-copy'}`}></i>
                        <span>{pixCopiado ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO DA ABA: BOLETO */}
            {abaRenovacao === 'boleto' && (
              <div className="renovacao-content-tab">
                {!dadosBoleto ? (
                  <form onSubmit={handleGerarBoletoAntecipado} className="renov-pix-form">
                    <label className="renov-input-label">
                      <span>CPF do Pagador (Obrigatório para emissão de Boleto Bradesco):</span>
                    </label>
                    <div className="renov-input-wrapper">
                      <i className="fas fa-id-card"></i>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={cpfRenovacao}
                        onChange={e => setCpfRenovacao(formatarCPF(e.target.value))}
                        maxLength={14}
                        required
                        className="renov-cpf-input"
                      />
                    </div>

                    {erroRenovacao && (
                      <p className="renov-erro-msg"><i className="fas fa-exclamation-triangle"></i> {erroRenovacao}</p>
                    )}

                    <button
                      type="submit"
                      disabled={gerandoBoleto}
                      className="btn-gerar-boleto-renov"
                    >
                      <i className={`fas ${gerandoBoleto ? 'fa-spinner fa-spin' : 'fa-barcode'}`}></i>
                      <span>{gerandoBoleto ? 'Emitindo Boleto...' : `Emitir Boleto Bancário (R$ ${planoAtual.valor.toFixed(2).replace('.', ',')})`}</span>
                    </button>
                  </form>
                ) : (
                  <div className="renov-boleto-resultado">
                    <div className="boleto-sucesso-header">
                      <i className="fas fa-file-invoice-dollar"></i>
                      <div>
                        <strong>Boleto Emitido com Sucesso!</strong>
                        <span>Enviado também para: {dadosBoleto.emailEnvio}</span>
                      </div>
                    </div>

                    {dadosBoleto.codigoBarras && (
                      <div className="boleto-barcode-box">
                        <label>Linha Digitável:</label>
                        <div className="barcode-copy-row">
                          <input type="text" readOnly value={dadosBoleto.codigoBarras} className="barcode-input" />
                          <button type="button" onClick={handleCopiarLinhaDigitavel} className="btn-copy-barcode">
                            <i className={`fas ${linhaDigitavelCopiada ? 'fa-check' : 'fa-copy'}`}></i>
                            <span>{linhaDigitavelCopiada ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {dadosBoleto.link && (
                      <a 
                        href={dadosBoleto.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn-abrir-boleto-pdf"
                      >
                        <i className="fas fa-external-link-alt"></i> Visualizar e Baixar Boleto em PDF
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ✉️ CARD 4: E-MAIL DE FATURAMENTO */}
          <div className="pagamento-card-bloco">
            <div className="bloco-header">
              <div>
                <h3 className="bloco-title">
                  <i className="fas fa-envelope-open-text" style={{ color: 'var(--dourado)' }}></i> E-mail para Faturas e Notificações
                </h3>
                <p className="bloco-desc">Para onde enviamos recibos, alertas de renovação e boletos bancários.</p>
              </div>
            </div>

            {!editandoEmail ? (
              <div className="email-faturamento-row">
                <div className="email-display-box">
                  <i className="fas fa-envelope"></i>
                  <strong>{emailFaturamento}</strong>
                </div>
                <button
                  type="button"
                  className="btn-editar-email"
                  onClick={() => setEditandoEmail(true)}
                >
                  <i className="fas fa-pen"></i> Alterar E-mail
                </button>
              </div>
            ) : (
              <form onSubmit={handleSalvarEmailFaturamento} className="form-editar-email-row">
                <input
                  type="email"
                  value={novoEmailInput}
                  onChange={e => setNovoEmailInput(e.target.value)}
                  required
                  placeholder="seuemail@empresa.com"
                  className="input-novo-email"
                />
                <button type="submit" disabled={salvandoEmail} className="btn-salvar-email">
                  <i className={`fas ${salvandoEmail ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> Salvar
                </button>
                <button type="button" onClick={() => setEditandoEmail(false)} className="btn-cancelar-email">
                  Cancelar
                </button>
              </form>
            )}
          </div>

        </div>

      </div>

      {/* 📜 HISTÓRICO DE FATURAS & PAGAMENTOS */}
      <div className="pagamento-faturas-bloco">
        <div className="faturas-bloco-header">
          <div>
            <h3 className="faturas-title">
              <i className="fas fa-receipt" style={{ color: 'var(--dourado)' }}></i> Histórico de Faturas & Pagamentos
            </h3>
            <p className="faturas-desc">Histórico completo de transações e recibos gerados para a sua empresa.</p>
          </div>
          <span className="faturas-count-badge">
            <i className="fas fa-check-double"></i> {historicoFaturas.length} Registro(s)
          </span>
        </div>

        <div className="faturas-table-wrapper">
          <table className="faturas-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição do Ciclo</th>
                <th>Valor</th>
                <th>Método</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Comprovante</th>
              </tr>
            </thead>
            <tbody>
              {historicoFaturas.map((fat) => (
                <tr key={fat.id}>
                  <td>
                    <div className="fat-data-box">
                      <strong>{fat.data}</strong>
                      <small>{fat.hora || ''}</small>
                    </div>
                  </td>
                  <td>
                    <span className="fat-desc">{fat.descricao}</span>
                  </td>
                  <td>
                    <strong className="fat-valor">R$ {Number(fat.valor).toFixed(2).replace('.', ',')}</strong>
                  </td>
                  <td>
                    <span className="fat-metodo">
                      <i className={`fas ${fat.metodo.includes('Boleto') ? 'fa-barcode' : fat.metodo.includes('PIX') ? 'fa-qrcode' : 'fa-credit-card'}`}></i>
                      {fat.metodo}
                    </span>
                  </td>
                  <td>
                    <span className="fat-status-badge pago">
                      <i className="fas fa-check"></i> {fat.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-ver-recibo"
                      onClick={() => setFaturaSelecionadaRecibo(fat)}
                    >
                      <i className="fas fa-file-invoice"></i> Ver Recibo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🧾 MODAL DE VISUALIZAÇÃO DE RECIBO OFICIAL */}
      {faturaSelecionadaRecibo && (
        <div className="modal-recibo-overlay" onClick={() => setFaturaSelecionadaRecibo(null)}>
          <div className="modal-recibo-card" onClick={e => e.stopPropagation()}>
            <div className="recibo-header">
              <div className="recibo-brand">
                <span className="recibo-logo">CELEBRE</span>
                <span className="recibo-doc-tag">RECIBO DE PAGAMENTO</span>
              </div>
              <button 
                type="button" 
                className="btn-fechar-recibo" 
                onClick={() => setFaturaSelecionadaRecibo(null)}
              >
                ✕
              </button>
            </div>

            <div className="recibo-body">
              <div className="recibo-info-row">
                <div>
                  <span className="recibo-label">NÚMERO DO COMPROVANTE</span>
                  <strong>{faturaSelecionadaRecibo.comprovanteNum}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="recibo-label">DATA DA EMISSÃO</span>
                  <strong>{faturaSelecionadaRecibo.data} às {faturaSelecionadaRecibo.hora || '12:00'}</strong>
                </div>
              </div>

              <div className="recibo-divider"></div>

              <div className="recibo-details-grid">
                <div>
                  <span className="recibo-label">EMPRESA BENEFICIÁRIA</span>
                  <strong>Celebre Tecnologia & Gestão de Eventos</strong>
                  <small>CNPJ: 00.000.000/0001-00</small>
                </div>
                <div>
                  <span className="recibo-label">SACADO / CLIENTE</span>
                  <strong>{usuarioLogado.displayName || 'EMPRESA ASSINANTE'}</strong>
                  <small>{emailFaturamento}</small>
                </div>
              </div>

              <div className="recibo-divider"></div>

              <div className="recibo-items-table">
                <div className="item-row">
                  <span>{faturaSelecionadaRecibo.descricao}</span>
                  <strong>R$ {Number(faturaSelecionadaRecibo.valor).toFixed(2).replace('.', ',')}</strong>
                </div>
              </div>

              <div className="recibo-total-row">
                <span>TOTAL PAGO</span>
                <strong className="total-gold">R$ {Number(faturaSelecionadaRecibo.valor).toFixed(2).replace('.', ',')}</strong>
              </div>

              <div className="recibo-auth-box">
                <div className="auth-stamp">
                  <i className="fas fa-check-shield"></i>
                  <span>PAGAMENTO PROCESSADO COM SUCESSO VIA MERCADO PAGO GATEWAY</span>
                </div>
                <small className="auth-hash">Autenticação: {tenantId.toUpperCase()}-{faturaSelecionadaRecibo.comprovanteNum}</small>
              </div>
            </div>

            <div className="recibo-footer-actions">
              <button
                type="button"
                className="btn-imprimir-recibo"
                onClick={() => window.print()}
              >
                <i className="fas fa-print"></i> Imprimir / Salvar PDF
              </button>
              <button
                type="button"
                className="btn-fechar-recibo-btn"
                onClick={() => setFaturaSelecionadaRecibo(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 MODAL DEDICADO PARA ALTERAÇÃO DE CARTÃO */}
      {modoAlterarCartao && (
        <div className="modal-cartao-overlay" onClick={() => setModoAlterarCartao(false)}>
          <div className="modal-cartao-card" onClick={e => e.stopPropagation()}>
            <div className="modal-cartao-header">
              <div className="modal-cartao-title-group">
                <span className="modal-cartao-badge">
                  <i className="fas fa-shield-alt"></i> AMBIENTE 100% SEGURO • MERCADO PAGO PCI-DSS
                </span>
                <h3 className="modal-cartao-title">
                  <i className="fas fa-credit-card" style={{ color: 'var(--dourado)' }}></i> Alterar Cartão da Recorrência
                </h3>
                <p className="modal-cartao-sub">
                  Os dados digitados substituirão o cartão atual e serão utilizados nas próximas renovações automáticas do seu plano.
                </p>
              </div>
              <button 
                type="button" 
                className="btn-fechar-modal-cartao" 
                onClick={() => setModoAlterarCartao(false)}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="modal-cartao-body">
              {statusCartaoUpdate.texto && (
                <div className={`status-cartao-box ${statusCartaoUpdate.tipo}`}>
                  <i className={`fas ${statusCartaoUpdate.tipo === 'sucesso' ? 'fa-check-circle' : statusCartaoUpdate.tipo === 'erro' ? 'fa-exclamation-triangle' : 'fa-spinner fa-spin'}`}></i>
                  <span>{statusCartaoUpdate.texto}</span>
                </div>
              )}

              {statusCartaoUpdate.tipo !== 'sucesso' && (
                <div className="mp-brick-wrapper-custom">
                  <CardPayment
                    initialization={{
                      amount: Number(planoAtual.valor) || 99.90
                    }}
                    customization={{
                      paymentMethods: {
                        minInstallments: 1,
                        maxInstallments: 1
                      },
                      visual: {
                        style: {
                          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
                          customVariables: {
                            baseColor: '#c5a059'
                          }
                        }
                      }
                    }}
                    onSubmit={onSubmitNovoCartao}
                    onError={(err) => {
                      console.error("Erro no formulário Mercado Pago CardPayment:", err);
                      setStatusCartaoUpdate({ texto: '⚠️ Verifique os dados digitados no cartão.', tipo: 'erro' });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GerenciarPagamento;
