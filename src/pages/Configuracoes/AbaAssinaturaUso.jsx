import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { calcularPeriodoTeste, parseDataGenerica, obterMelhorContaPorEmail } from '../../utils/periodoTesteUtils';
import { aplicarCorDestaqueGlobal } from '../../utils/themeUtils';
import { formatCPF } from '../../utils/mascaras';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import ModalReciboOficial from '../../components/ModalReciboOficial';

// 🔥 INICIALIZAÇÃO DE PRODUÇÃO MERCADO PAGO
initMercadoPago('APP_USR-4c525755-f2c1-4e28-8c9e-020787a172a1', { locale: 'pt-BR' });

// 📅 Função inteligente para projetar sempre o próximo ciclo de faturamento real
export const calcularProximaDataRenovacao = (uData, assinatura, dataCriacaoConta, isSuperAdmin, dataPagamentoLog = null) => {
  if (isSuperAdmin) {
    return 'Vitalício';
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Detecta se há assinatura paga ativa via qualquer campo possível do sistema
  const temAssinaturaAtiva = Boolean(
    uData?.assinaturaAtiva === true ||
    uData?.statusAssinatura === 'ativa' ||
    uData?.plano === 'pago' ||
    uData?.statusPagamentoVulso === 'pago' ||
    assinatura?.isActive === true ||
    assinatura?.ativa === true ||
    assinatura?.status === 'Assinatura Ativa'
  );

  // 1. Se o usuário estiver ATUALMENTE no Período de Teste VIP ativo (e não possuir assinatura ativa)
  if (!temAssinaturaAtiva && uData) {
    const infoT = calcularPeriodoTeste(uData);
    if (infoT.emTeste && infoT.dataFimDate && infoT.dataFimDate >= hoje) {
      return infoT.dataFimFormatada;
    }
  }

  // 2. Determina se o ciclo é anual
  const rawPId = String(uData?.planoId || uData?.plano || assinatura?.planoNome || '').toLowerCase();
  const isAnual = Boolean(
    rawPId.includes('anual') || 
    String(uData?.cicloAssinatura || uData?.ciclo || assinatura?.ciclo || '').toLowerCase() === 'anual'
  );

  // 3. Determinar o dia fixo do ciclo de cobrança
  let diaCiclo = null;
  let dataBaseCiclo = null;

  // 3a. Âncora de Ouro: log de pagamento / transação real
  if (dataPagamentoLog) {
    const parsedLog = dataPagamentoLog instanceof Date ? dataPagamentoLog : parseDataGenerica(dataPagamentoLog);
    if (parsedLog && !isNaN(parsedLog.getTime())) {
      dataBaseCiclo = parsedLog;
      diaCiclo = parsedLog.getDate();
    }
  }

  // 3b. Data de pagamento real registrada no documento do usuário (se não for cópia do dataFimTeste)
  if (!diaCiclo) {
    const rawDataPagamento = uData?.dataPagamento || uData?.dataUltimoPagamento || assinatura?.dataPagamento;
    if (rawDataPagamento) {
      const parsedPag = parseDataGenerica(rawDataPagamento);
      if (parsedPag && !isNaN(parsedPag.getTime())) {
        const fimTesteDate = uData?.dataFimTeste ? parseDataGenerica(uData.dataFimTeste) : null;
        const isMesmoDiaFimTeste = fimTesteDate && parsedPag.getDate() === fimTesteDate.getDate() && parsedPag.getMonth() === fimTesteDate.getMonth();
        if (!isMesmoDiaFimTeste || !temAssinaturaAtiva) {
          dataBaseCiclo = parsedPag;
          diaCiclo = parsedPag.getDate();
        }
      }
    }
  }

  // 3c. Se houver uma data de vencimento/cobrança explícita e válida no documento
  // (Apenas se não for idêntica ao dataFimTeste de uma conta com assinatura ativa)
  if (!diaCiclo) {
    const dataCandidataRaw = uData?.dataProximaCobranca 
      || uData?.dataVencimento 
      || assinatura?.dataProximaCobranca 
      || assinatura?.dataVencimento;

    if (dataCandidataRaw) {
      const dataCand = parseDataGenerica(dataCandidataRaw);
      if (dataCand && !isNaN(dataCand.getTime())) {
        const fimTesteDate = uData?.dataFimTeste ? parseDataGenerica(uData.dataFimTeste) : null;
        const isMesmoDiaFimTeste = fimTesteDate && dataCand.getDate() === fimTesteDate.getDate() && dataCand.getMonth() === fimTesteDate.getMonth();
        if (!isMesmoDiaFimTeste || !temAssinaturaAtiva) {
          const dataCandMeia = new Date(dataCand);
          dataCandMeia.setHours(0, 0, 0, 0);
          if (dataCandMeia >= hoje) {
            return dataCandMeia.toLocaleDateString('pt-BR');
          }
          diaCiclo = dataCand.getDate();
        }
      }
    }
  }

  // 3d. Fallback para data de criação da conta se não tiver pagamento nem log
  if (!diaCiclo && dataCriacaoConta) {
    const parsedCad = parseDataGenerica(dataCriacaoConta);
    if (parsedCad && !isNaN(parsedCad.getTime())) {
      diaCiclo = parsedCad.getDate();
    }
  }

  // 3e. Usa data de fim de teste SOMENTE se não houver assinatura ativa
  if (!diaCiclo && uData && !temAssinaturaAtiva) {
    const infoT = calcularPeriodoTeste(uData);
    if (infoT.dataFimDate) {
      diaCiclo = infoT.dataFimDate.getDate();
    }
  }

  if (!diaCiclo || isNaN(diaCiclo)) {
    diaCiclo = hoje.getDate();
  }

  // 4. Projetar a próxima data futura de renovação no ciclo (nunca no passado)
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaHoje = hoje.getDate();

  let proximaData;
  if (isAnual) {
    let anoCandidato = dataBaseCiclo ? dataBaseCiclo.getFullYear() + 1 : anoAtual;
    let mesBase = dataBaseCiclo ? dataBaseCiclo.getMonth() : mesAtual;
    let dataCand = new Date(anoCandidato, mesBase, diaCiclo);
    while (dataCand <= hoje) {
      anoCandidato++;
      dataCand = new Date(anoCandidato, mesBase, diaCiclo);
    }
    proximaData = dataCand;
  } else {
    if (diaHoje < diaCiclo) {
      // Cobrança no mês corrente
      const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
      const diaReal = Math.min(diaCiclo, ultimoDiaMes);
      proximaData = new Date(anoAtual, mesAtual, diaReal);
    } else {
      // Cobrança no próximo mês
      const proximoMes = mesAtual + 1;
      const anoProximo = proximoMes > 11 ? anoAtual + 1 : anoAtual;
      const mesCalculado = proximoMes % 12;
      const ultimoDiaProximoMes = new Date(anoProximo, mesCalculado + 1, 0).getDate();
      const diaReal = Math.min(diaCiclo, ultimoDiaProximoMes);
      proximaData = new Date(anoProximo, mesCalculado, diaReal);
    }
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

// ⭐ LISTA DOS 8 MÓDULOS INCLUÍDOS NO PLANO (EXIBIDOS NO MODAL DE RECURSOS)
const LISTA_MODULOS_INCLUIDOS = [
  { icon: 'fas fa-users', color: '#3b82f6', title: 'Gestão de Clientes', desc: 'CRM completo e histórico de clientes' },
  { icon: 'fas fa-boxes', color: '#10b981', title: 'Gestão de Estoque', desc: 'Acervo com controle de peças e valores' },
  { icon: 'fas fa-hand-holding-heart', color: '#ec4899', title: 'Locações e Pedidos', desc: 'Orçamentos, reservas e agendamentos' },
  { icon: 'fas fa-truck', color: '#f59e0b', title: 'Logística & Entregas', desc: 'Controle de saídas, devoluções e frete' },
  { icon: 'fas fa-file-contract', color: '#8b5cf6', title: 'Emissão de Contratos', desc: 'Gerador e assinatura digital' },
  { icon: 'fas fa-store', color: '#06b6d4', title: 'Catálogo Digital', desc: 'Vitrine online para seus clientes' },
  { icon: 'fas fa-palette', color: '#f43f5e', title: 'Projetos Moodboard', desc: 'Criação de projetos visuais e decoração' },
  { icon: 'fas fa-chart-line', color: '#6366f1', title: 'Financeiro & DRE', desc: 'Controle de caixa, entradas e relatórios' }
];

const AbaAssinaturaUso = ({
  isSuperAdmin,
  assinatura,
  usoPlano,
  cancelando,
  handleCancelarAssinatura,
  dataCriacaoConta,
  usuarioLogado: propUsuarioLogado,
  isImpersonating: propIsImpersonating
}) => {
  const navigate = useNavigate();
  const auth = getAuth();

  const rawImp = localStorage.getItem('impersonatingTenant');
  let impData = null;
  if (rawImp) {
    try { impData = JSON.parse(rawImp); } catch (e) {}
  }
  const isImpersonating = propIsImpersonating !== undefined ? propIsImpersonating : Boolean(impData?.uid);

  const usuarioLogado = propUsuarioLogado || (isImpersonating ? {
    uid: impData.uid,
    originalUid: impData.originalUid,
    email: impData.email,
    displayName: impData.nome,
    isImpersonating: true
  } : auth.currentUser);

  const [estatisticasReais, setEstatisticasReais] = useState({
    totalItensEstoque: 0,
    totalLocacoes: 0,
    totalClientes: 0,
    dataRenovacao: null
  });
  const [dadosUsuario, setDadosUsuario] = useState(null);
  const [historicoFaturas, setHistoricoFaturas] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Modal simples para editar E-mail de Faturamento
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  // ⭐ MODAL VIP DE RECURSOS & MÓDULOS DO PLANO
  const [modalRecursosAberto, setModalRecursosAberto] = useState(false);

  // 👑 MODAL VIP DE MIGRAÇÃO PARA PLANO ANUAL / UPGRADE DE PLANO (TODOS OS PLANOS)
  const [modalMigracaoAberto, setModalMigracaoAberto] = useState(false);
  const [modalCiclo, setModalCiclo] = useState('anual'); // 'anual' ou 'mensal'
  const [modalPlanoSelecionado, setModalPlanoSelecionado] = useState('premium'); // 'basico', 'premium' ou 'plus'
  const [carouselIndex, setCarouselIndex] = useState(1);
  const [touchStartX, setTouchStartX] = useState(null);
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
  const [faturaReciboModal, setFaturaReciboModal] = useState(null);

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

  // 🔍 Detecção e resolução inteligente do plano e valores
  const detectarPlanoAtualKey = (uD = dadosUsuario, ass = assinatura) => {
    const nome = (ass?.planoNome || uD?.planoNome || uD?.plano || '').toLowerCase();
    const id = (ass?.planoId || uD?.planoId || '').toLowerCase();
    const pr = String(ass?.precoMensal || uD?.valorAssinatura || '').replace('.', ',');
    if (id.includes('plus') || nome.includes('plus') || nome.includes('pro') || pr === '159,90') return 'plus';
    if (id.includes('basico') || id.includes('básico') || nome.includes('basico') || nome.includes('básico') || pr === '49,90') return 'basico';
    return 'premium';
  };

  const resolverPlanoInfo = (uD = dadosUsuario, ass = assinatura) => {
    const key = detectarPlanoAtualKey(uD, ass);
    const planoObj = LISTA_PLANOS_DISPONIVEIS.find(p => p.id === key) || LISTA_PLANOS_DISPONIVEIS[1];
    const isAnual = Boolean(
      ass?.ciclo === 'anual' || 
      ass?.planoId?.includes('anual') || 
      ass?.periodo === 'anual' || 
      uD?.ciclo === 'anual' || 
      uD?.cicloAssinatura === 'anual' ||
      String(uD?.planoId || '').includes('anual')
    );

    let nome = planoObj.nome;
    if (ass?.planoNome && ass.planoNome !== 'Carregando...' && ass.planoNome !== 'Básico (Gratuito)') {
      nome = ass.planoNome;
    } else if (uD?.planoNome) {
      nome = uD.planoNome;
    }

    let preco = isAnual ? planoObj.precoAnualTotalFormatado : planoObj.precoMensalFormatado;
    if (ass?.precoMensal && ass.precoMensal !== '0,00' && ass.precoMensal !== '0') {
      preco = String(ass.precoMensal).replace('.', ',');
    } else if (uD?.valorAssinatura && uD.valorAssinatura !== '0,00' && uD.valorAssinatura !== 0) {
      preco = String(uD.valorAssinatura).replace('.', ',');
    }

    let metodo = 'Cartão de Crédito';
    if (ass?.metodoPagamento && ass.metodoPagamento !== 'Nenhum' && ass.metodoPagamento !== 'Nenhum método cadastrado') {
      metodo = ass.metodoPagamento;
    } else if (uD?.metodoPagamento && uD.metodoPagamento !== 'Nenhum' && uD.metodoPagamento !== 'Nenhum método cadastrado') {
      metodo = uD.metodoPagamento;
    }

    return { key, nome, preco, metodo, isAnual, planoObj };
  };

  useEffect(() => {
    const carregarEstatisticasUso = async () => {
      if (!usuarioLogado) return;
      try {
        const tenantId = impData?.uid || localStorage.getItem('tenantId') || usuarioLogado.uid;
        const uid = isImpersonating ? (impData?.originalUid || impData?.uid || usuarioLogado.uid) : usuarioLogado.uid;
        const uEmail = (isImpersonating ? (impData?.email || usuarioLogado.email) : (usuarioLogado.email || assinatura?.emailCobranca || '')).trim();
        const uEmailLower = uEmail.toLowerCase();
        
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));

        // 🔍 BUSCA TOTAL DE LOGS (empresaId, userId, usuarioEmail e para SuperAdmin histórico global)
        const promessasConsultas = [
          getDocs(qEstoque).catch(() => ({ size: 0 })),
          getDocs(qLocacoes).catch(() => ({ size: 0 })),
          getDocs(qClientes).catch(() => ({ size: 0 })),
          getDocs(query(collection(db, "logs_atividades"), where("empresaId", "==", tenantId), limit(60))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "logs_atividades"), where("userId", "==", uid), limit(60))).catch(() => ({ docs: [] }))
        ];

        if (tenantId !== uid) {
          promessasConsultas.push(getDocs(query(collection(db, "logs_atividades"), where("empresaId", "==", uid), limit(60))).catch(() => ({ docs: [] })));
          promessasConsultas.push(getDocs(query(collection(db, "logs_atividades"), where("userId", "==", tenantId), limit(60))).catch(() => ({ docs: [] })));
        }

        if (uEmail) {
          promessasConsultas.push(getDocs(query(collection(db, "logs_atividades"), where("usuarioEmail", "==", uEmail), limit(80))).catch(() => ({ docs: [] })));
          if (uEmailLower !== uEmail) {
            promessasConsultas.push(getDocs(query(collection(db, "logs_atividades"), where("usuarioEmail", "==", uEmailLower), limit(80))).catch(() => ({ docs: [] })));
          }
        }

        // 🛡️ Busca todos os UIDs vinculados ao e-mail para cobrir 100% de aliases (Google e senha)
        let uData = null;
        if (uEmailLower) {
          try {
            const qUsersEmail = query(collection(db, "usuarios"), where("email", "==", uEmailLower));
            const snapUsersEmail = await getDocs(qUsersEmail);
            if (snapUsersEmail.docs.length > 0) {
              const melhorDoc = obterMelhorContaPorEmail(snapUsersEmail.docs);
              if (melhorDoc) {
                uData = { ...melhorDoc, id: melhorDoc.uid || tenantId };
              }
              snapUsersEmail.docs.forEach(uDoc => {
                const docId = uDoc.id;
                if (docId && docId !== tenantId && docId !== uid) {
                  promessasConsultas.push(getDocs(query(collection(db, "logs_atividades"), where("empresaId", "==", docId), limit(60))).catch(() => ({ docs: [] })));
                  promessasConsultas.push(getDocs(query(collection(db, "logs_atividades"), where("userId", "==", docId), limit(60))).catch(() => ({ docs: [] })));
                }
              });
            }
          } catch (eAlias) {
            console.warn("Aviso ao mapear contas vinculadas por email:", eAlias);
          }
        }

        if (isSuperAdmin) {
          promessasConsultas.push(getDocs(query(collection(db, "logs_atividades"), limit(150))).catch(() => ({ docs: [] })));
        }

        const [snapEst, snapLoc, snapCli, ...snapLogsArr] = await Promise.all(promessasConsultas);

        // Consolidação dos logs em Mapa único para eliminar duplicidades
        const mapaLogsDocs = new Map();
        snapLogsArr.forEach(resSnap => {
          if (resSnap && resSnap.docs) {
            resSnap.docs.forEach(docSnap => {
              const d = docSnap.data();
              const bateEmpresa = d.empresaId === tenantId || d.empresaId === uid || (uData?.uid && d.empresaId === uData.uid);
              const bateUser = d.userId === tenantId || d.userId === uid || (uData?.uid && d.userId === uData.uid);
              const dEmail = String(d.usuarioEmail || d.email || '').toLowerCase().trim();
              const bateEmail = Boolean(uEmailLower && dEmail && dEmail === uEmailLower);
              if (isSuperAdmin || bateEmpresa || bateUser || bateEmail) {
                mapaLogsDocs.set(docSnap.id, docSnap);
              }
            });
          }
        });

        if (!uData) {
          const userDoc = await getDoc(doc(db, "usuarios", tenantId)).catch(() => null);
          uData = userDoc && userDoc.exists() ? userDoc.data() : null;
          if (!uData && tenantId !== uid) {
            const userDocFallback = await getDoc(doc(db, "usuarios", uid)).catch(() => null);
            if (userDocFallback && userDocFallback.exists()) {
              uData = userDocFallback.data();
            }
          }
        }
        setDadosUsuario(uData);

        const docRaw = uData?.cpf || uData?.documento || '';
        const apenasDigitos = String(docRaw).replace(/\D/g, '');
        if (apenasDigitos.length === 11) {
          setCpfMigracao(formatCPF(apenasDigitos));
        } else {
          setCpfMigracao('');
        }

        // 📄 Montar lista de faturas idêntica ao Controle Geral (Super Admin)
        const faturasList = [];
        const infoP = resolverPlanoInfo(uData, assinatura);
        const isAnual = infoP.isAnual;
        const pNome = infoP.nome;
        const pValor = infoP.preco;
        const pMetodo = infoP.metodo;

        const temAssinaturaAtivaReal = Boolean(
          uData?.assinaturaAtiva === true ||
          uData?.statusAssinatura === 'ativa' ||
          uData?.plano === 'pago' ||
          uData?.statusPagamentoVulso === 'pago' ||
          assinatura?.isActive === true ||
          assinatura?.ativa === true ||
          assinatura?.status === 'Assinatura Ativa'
        );

        let logMaisRecenteDate = null;
        const docsOrdenados = Array.from(mapaLogsDocs.values()).sort((a, b) => {
          const da = a.data();
          const db = b.data();
          const ta = da.criadoEm?.toMillis ? da.criadoEm.toMillis() : (da.dataHora ? new Date(da.dataHora).getTime() : 0);
          const tb = db.criadoEm?.toMillis ? db.criadoEm.toMillis() : (db.dataHora ? new Date(db.dataHora).getTime() : 0);
          return tb - ta;
        });

        docsOrdenados.forEach(docSnap => {
          const dataLog = docSnap.data();
          const acao = String(dataLog.acao || '').toUpperCase();
          const detalhes = String(dataLog.detalhes || '');
          const detalhesLower = detalhes.toLowerCase();

          // 🛡️ Filtra estritamente: tentativas de checkout, falhas e cancelamentos NUNCA entram como faturas pagas
          const isTentativaOuErro = 
            acao.includes('TENTATIVA') || 
            acao.includes('FALHA') || 
            acao.includes('RECUSAD') || 
            acao.includes('ERRO') ||
            acao.includes('CANCELAMENTO') ||
            detalhesLower.includes('iniciou o processo') || 
            detalhesLower.includes('falhou') || 
            detalhesLower.includes('recusad');

          if (isTentativaOuErro) return;

          // Apenas pagamentos efetivamente aprovados ou liberações oficiais de VIP
          const isAprovado = 
            acao.includes('APROVAD') || 
            acao.includes('PAGAMENTO CONFIRMADO') || 
            acao.includes('PAGAMENTO PROCESSADO') || 
            acao.includes('ASSINATURA ATIVA') ||
            acao.includes('VIP') ||
            acao.includes('CORTESIA') ||
            detalhesLower.includes('processado com sucesso') ||
            detalhesLower.includes('ativada pelo super admin');

          if (isAprovado) {
            const rawData = dataLog.dataHora ? new Date(dataLog.dataHora) : (dataLog.criadoEm?.toDate ? dataLog.criadoEm.toDate() : null);
            const dLog = rawData && !isNaN(rawData.getTime()) ? rawData : new Date();
            
            if (!logMaisRecenteDate) {
              logMaisRecenteDate = dLog;
            }

            const dataFmt = dLog.toLocaleDateString('pt-BR');
            const horaFmt = dLog.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            let dFimL = new Date(dLog);
            if (isAnual) {
              dFimL.setFullYear(dFimL.getFullYear() + 1);
            } else {
              dFimL.setMonth(dFimL.getMonth() + 1);
            }
            const dataFimFmt = dFimL.toLocaleDateString('pt-BR');

            let val = pValor;
            const matchValor = detalhes.match(/R\$\s?([\d.,]+)/i);
            if (matchValor && matchValor[1]) {
              val = matchValor[1];
            }

            const isVipAdmin = acao.includes('VIP') || acao.includes('CORTESIA') || detalhesLower.includes('ativada pelo super admin');

            faturasList.push({
              id: docSnap.id,
              codigo: `FAT-${docSnap.id.substring(0, 8).toUpperCase()}`,
              dataPagamento: dataFmt,
              hora: horaFmt,
              descricao: isVipAdmin 
                ? `Licença Especial - Cortesia VIP (${pNome})` 
                : `Assinatura ${isAnual ? 'Anual' : 'Mensal'} - ${pNome}`,
              periodo: `${dataFmt} a ${dataFimFmt}`,
              periodoInicio: dataFmt,
              periodoFim: dataFimFmt,
              metodo: isVipAdmin ? 'Cortesia VIP (Super Admin)' : (detalhesLower.includes('pix') ? 'PIX' : detalhesLower.includes('boleto') ? 'Boleto Bancário' : pMetodo),
              valor: isVipAdmin ? '0,00 (VIP)' : val,
              status: isVipAdmin ? 'Cortesia VIP' : 'Concluído'
            });
          }
        });

        // 📅 Projeção do ciclo com ancoragem real na data da transação
        const proximaData = calcularProximaDataRenovacao(uData, assinatura, dataCriacaoConta, isSuperAdmin, logMaisRecenteDate);

        setEstatisticasReais({
          totalItensEstoque: snapEst.size || 0,
          totalLocacoes: snapLoc.size || 0,
          totalClientes: snapCli.size || 0,
          dataRenovacao: proximaData
        });

        // 🛡️ Saneamento de dados: Se a conta NÃO possui assinatura ativa paga (está em teste),
        // remove qualquer dataPagamento residual no passado gerada por versões anteriores
        if (uData && !isSuperAdmin && !temAssinaturaAtivaReal && uData.dataPagamento) {
          try {
            const targetDocId = uData.uid || tenantId;
            await updateDoc(doc(db, "usuarios", targetDocId), { dataPagamento: null });
            if (tenantId && tenantId !== targetDocId) {
              await updateDoc(doc(db, "usuarios", tenantId), { dataPagamento: null }).catch(() => {});
            }
          } catch (eClean) {
            console.warn("Aviso ao limpar dataPagamento residual:", eClean);
          }
        }

        // Fatura sintética de contingência SOMENTE para contas com assinatura ativa/VIP sem log registrado
        if (temAssinaturaAtivaReal && faturasList.length === 0) {
          if (isSuperAdmin) {
            const dtInicioFmt = dataCriacaoConta ? (parseDataGenerica(dataCriacaoConta) || new Date()).toLocaleDateString('pt-BR') : '23/04/2026';
            faturasList.push({
              id: 'fat-master-vitalicio',
              dataPagamento: dtInicioFmt,
              hora: '10:00',
              descricao: 'Licença Master Oficial (Acesso Total Vitalício)',
              periodo: 'Vitalício (Acesso Permanente)',
              periodoInicio: dtInicioFmt,
              periodoFim: 'Vitalício',
              metodo: 'Administração Global Celebre',
              valor: '0,00 (Master)',
              status: 'Vitalício',
              codigo: 'MASTER-VITALICIO'
            });
          } else {
            const rawInicio = uData?.dataPagamento || uData?.dataAtivacaoVip;
            if (rawInicio) {
              const dIniReal = parseDataGenerica(rawInicio) || new Date();
              let dFimReal = new Date(dIniReal);
              if (isAnual) {
                dFimReal.setFullYear(dFimReal.getFullYear() + 1);
              } else {
                dFimReal.setMonth(dFimReal.getMonth() + 1);
              }
              const dtInicioFmt = dIniReal.toLocaleDateString('pt-BR');
              const dtFimFmt = dFimReal.toLocaleDateString('pt-BR');
              faturasList.push({
                id: 'fat-ciclo-ativo',
                dataPagamento: dtInicioFmt,
                hora: '10:00',
                descricao: `Licença Especial - Cortesia VIP (${pNome})`,
                periodo: `${dtInicioFmt} a ${dtFimFmt}`,
                periodoInicio: dtInicioFmt,
                periodoFim: dtFimFmt,
                metodo: 'Cortesia VIP (Super Admin)',
                valor: '0,00 (VIP)',
                status: 'Cortesia VIP',
                codigo: `FAT-${(tenantId || 'CELEBRE').substring(0, 8).toUpperCase()}`
              });
            }
          }
        }

        setHistoricoFaturas(faturasList);
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

  const infoPlanoAtual = resolverPlanoInfo(dadosUsuario, assinatura);
  const planoNomeAtual = infoPlanoAtual.nome;
  const precoMensalAtual = infoPlanoAtual.preco;
  const planoAtualKey = infoPlanoAtual.key;
  const isUsuarioAnualAtual = infoPlanoAtual.isAnual;

  // 📅 Cálculo dinâmico das datas do recibo de pagamento e histórico
  const obterDatasRecibo = (faturaCustom = {}) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const cicloNome = isUsuarioAnualAtual ? 'Anual' : 'Mensal';

    // 1. Se foi passada uma fatura específica com dados já consolidados
    if (faturaCustom.dataPagamento || faturaCustom.data) {
      const dataPag = faturaCustom.dataPagamento || faturaCustom.data;
      const horaPag = faturaCustom.hora || '10:00';
      let perInicio = faturaCustom.periodoInicio;
      let perFim = faturaCustom.periodoFim;

      if (!perInicio || !perFim) {
        const partesP = String(faturaCustom.periodo || '').split(' a ');
        perInicio = partesP[0] || dataPag;
        perFim = partesP[1];
        if (!perFim) {
          const partesD = String(perInicio).split('/');
          if (partesD.length === 3) {
            const d = new Date(parseInt(partesD[2], 10), parseInt(partesD[1], 10) - 1, parseInt(partesD[0], 10));
            if (!isNaN(d.getTime())) {
              if (cicloNome === 'Anual') d.setFullYear(d.getFullYear() + 1);
              else d.setMonth(d.getMonth() + 1);
              perFim = d.toLocaleDateString('pt-BR');
            }
          }
        }
      }

      return {
        dataPagamento: dataPag,
        horaPagamento: horaPag,
        periodoInicio: perInicio,
        periodoFim: perFim || estatisticasReais.dataRenovacao || dataPag,
        periodoTexto: `${perInicio} a ${perFim || estatisticasReais.dataRenovacao || dataPag}`,
        cicloNome,
        proximaRenovacao: perFim || estatisticasReais.dataRenovacao || dataPag
      };
    }

    // 2. Se houver faturas já carregadas no histórico do componente
    if (historicoFaturas && historicoFaturas.length > 0) {
      const fat = historicoFaturas[0];
      return {
        dataPagamento: fat.dataPagamento,
        horaPagamento: fat.hora || '10:00',
        periodoInicio: fat.periodoInicio || fat.dataPagamento,
        periodoFim: fat.periodoFim || estatisticasReais.dataRenovacao || fat.dataPagamento,
        periodoTexto: fat.periodo,
        cicloNome,
        proximaRenovacao: fat.periodoFim || estatisticasReais.dataRenovacao || fat.dataPagamento
      };
    }

    // 3. Fallback inteligente: data do pagamento é a data de início da vigência do ciclo ativo
    let dRenov = null;
    if (estatisticasReais.dataRenovacao && estatisticasReais.dataRenovacao !== 'Vitalício') {
      const partes = String(estatisticasReais.dataRenovacao).split('/');
      if (partes.length === 3) {
        const parsed = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10), 12, 0, 0);
        if (!isNaN(parsed.getTime())) dRenov = parsed;
      }
    }

    let dInicio = null;
    const rawPag = dadosUsuario?.dataPagamento || dadosUsuario?.dataUltimoPagamento || assinatura?.dataPagamento;
    if (rawPag) {
      const p = parseDataGenerica(rawPag);
      if (p) dInicio = p;
    }

    if (!dInicio && dRenov) {
      dInicio = new Date(dRenov);
      if (isUsuarioAnualAtual) {
        dInicio.setFullYear(dInicio.getFullYear() - 1);
      } else {
        dInicio.setMonth(dInicio.getMonth() - 1);
      }
    }

    if (!dRenov && dInicio) {
      dRenov = new Date(dInicio);
      if (isUsuarioAnualAtual) {
        dRenov.setFullYear(dRenov.getFullYear() + 1);
      } else {
        dRenov.setMonth(dRenov.getMonth() + 1);
      }
    }

    if (!dInicio) dInicio = hoje;
    if (!dRenov) {
      dRenov = new Date(dInicio);
      if (isUsuarioAnualAtual) dRenov.setFullYear(dRenov.getFullYear() + 1);
      else dRenov.setMonth(dRenov.getMonth() + 1);
    }

    if (isSuperAdmin) {
      const dataPagFmt = dInicio ? dInicio.toLocaleDateString('pt-BR') : 'Acesso Master';
      return {
        dataPagamento: dataPagFmt,
        horaPagamento: '10:00',
        periodoInicio: dataPagFmt,
        periodoFim: 'Vitalício',
        periodoTexto: 'Acesso Vitalício Contínuo',
        cicloNome: 'Vitalício',
        proximaRenovacao: 'Vitalício'
      };
    }

    const dtInicioFmt = dInicio.toLocaleDateString('pt-BR');
    const dtFimFmt = dRenov.toLocaleDateString('pt-BR');

    return {
      dataPagamento: dtInicioFmt,
      horaPagamento: '10:00',
      periodoInicio: dtInicioFmt,
      periodoFim: dtFimFmt,
      periodoTexto: `${dtInicioFmt} a ${dtFimFmt} (${cicloNome})`,
      cicloNome,
      proximaRenovacao: dtFimFmt
    };
  };

  const infoDatasPadrao = obterDatasRecibo();

  const handleImprimirComprovante = (faturaCustom = {}) => {
    const infoDatas = obterDatasRecibo(faturaCustom);
    const codigoFatura = faturaCustom.codigo || ("FAT-" + Math.floor(100000 + Math.random() * 900000));
    const infoP = resolverPlanoInfo(dadosUsuario, assinatura);

    let rawNome = faturaCustom.planoNome || faturaCustom.descricao || infoP.nome;
    if (rawNome.includes('Carregando...') || rawNome === 'Básico (Gratuito)') {
      rawNome = infoP.nome;
    }
    rawNome = rawNome.replace(/^Assinatura (Mensal|Anual) - /, '').trim();
    const planoNome = rawNome.toLowerCase().startsWith('plano') ? rawNome : `Plano ${rawNome}`;

    let valor = faturaCustom.valor;
    if (!valor || valor === '0,00' || valor === '0') {
      valor = infoP.preco;
    }

    let metodoPagamento = faturaCustom.metodo;
    if (!metodoPagamento || metodoPagamento === 'Nenhum' || metodoPagamento === 'Nenhum método cadastrado') {
      metodoPagamento = infoP.metodo;
    }

    const email = novoEmail || usuarioLogado?.email || "contato@celebre.com";
    const nomeCliente = localStorage.getItem('nomeEmpresa') 
      || usuarioLogado?.displayName 
      || (usuarioLogado?.email ? usuarioLogado.email.split('@')[0].toUpperCase() : 'ASSINANTE CELEBRE');

    setFaturaReciboModal({
      codigo: codigoFatura,
      status: faturaCustom.status || 'concluido',
      dataPagamento: infoDatas.dataPagamento,
      horaPagamento: infoDatas.horaPagamento || '10:00',
      periodoInicio: infoDatas.periodoInicio,
      periodoFim: infoDatas.periodoFim,
      cicloNome: infoDatas.cicloNome,
      empresaNome: nomeCliente,
      email: email,
      metodo: metodoPagamento,
      descricao: `Assinatura ${planoNome.replace(/^Plano /, '')}`,
      detalhes: 'Licença de Software Celebre • Sistema de Gestão',
      valor: valor
    });
  };

  const limiteVagas = isSuperAdmin ? 9999 : (usoPlano?.limite || 3);
  const vagasUsadas = usoPlano?.usado || 1;
  const pctVagas = Math.min(Math.round((vagasUsadas / limiteVagas) * 100), 100);

  const corBarraVagas = isSuperAdmin 
    ? 'var(--dourado)' 
    : (pctVagas >= 100 ? '#ef4444' : (pctVagas > 70 ? '#f59e0b' : '#10b981'));

  const irParaPlanoAnterior = () => {
    setCarouselIndex((prev) => {
      const nextIdx = prev > 0 ? prev - 1 : LISTA_PLANOS_DISPONIVEIS.length - 1;
      const p = LISTA_PLANOS_DISPONIVEIS[nextIdx];
      if (p) {
        setModalPlanoSelecionado(p.id);
        setCienteDowngrade(false);
        setDadosPixMigracao(null);
        setErroPix('');
      }
      return nextIdx;
    });
  };

  const irParaProximoPlano = () => {
    setCarouselIndex((prev) => {
      const nextIdx = prev < LISTA_PLANOS_DISPONIVEIS.length - 1 ? prev + 1 : 0;
      const p = LISTA_PLANOS_DISPONIVEIS[nextIdx];
      if (p) {
        setModalPlanoSelecionado(p.id);
        setCienteDowngrade(false);
        setDadosPixMigracao(null);
        setErroPix('');
      }
      return nextIdx;
    });
  };

  const selecionarPlanoPorIndex = (idx) => {
    setCarouselIndex(idx);
    const p = LISTA_PLANOS_DISPONIVEIS[idx];
    if (p) {
      setModalPlanoSelecionado(p.id);
      setCienteDowngrade(false);
      setDadosPixMigracao(null);
      setErroPix('');
    }
  };

  const abrirModalUpgrade = () => {
    const proximo = planoAtualKey === 'basico' ? 'premium' : 'plus';
    const idx = LISTA_PLANOS_DISPONIVEIS.findIndex(p => p.id === proximo);
    setCarouselIndex(idx >= 0 ? idx : 1);
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
    const idx = LISTA_PLANOS_DISPONIVEIS.findIndex(p => p.id === planoAtualKey);
    setCarouselIndex(idx >= 0 ? idx : 1);
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
        
        <div className="assinatura-topo-hero">
          {/* BLOCO PRINCIPAL: ÍCONE + BADGES + TÍTULO E VALOR */}
          <div className="assinatura-topo-main">
            <div className="assinatura-crown-medallion">
              <i className="fas fa-crown"></i>
            </div>
            
            <div className="assinatura-topo-info">
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

              <div className="plano-title-price-row">
                <h3 className="plano-hero-nome">{planoNomeAtual}</h3>
                {!isSuperAdmin ? (
                  <div className="plano-hero-preco">
                    <span className="preco-rotulo">Valor da assinatura:</span>
                    <strong className="preco-valor">R$ {precoMensalAtual}</strong>
                    <span className="preco-ciclo">/mês</span>
                  </div>
                ) : (
                  <span className="plano-master-pill">Acesso Total Vitalício</span>
                )}
              </div>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO DO PLANO */}
          <div className="plano-header-actions">
            <button 
              type="button" 
              className="btn-ver-recursos-plano"
              onClick={() => setModalRecursosAberto(true)}
              title="Ver recursos e ferramentas incluídas no seu plano"
            >
              <i className="fas fa-star" style={{ color: 'var(--dourado)' }}></i> <span>Recursos (8)</span>
            </button>

            <button 
              type="button" 
              className="btn-upgrade-plano"
              onClick={abrirModalUpgrade}
            >
              <i className="fas fa-rocket"></i> <span>Upgrade de Plano</span>
            </button>
          </div>
        </div>

        {/* 📅 BANNER DE DESTAQUE: DATA DE RENOVAÇÃO / VENCIMENTO DA COBRANÇA */}
        <div className="assinatura-vencimento-banner">
          <div className="vencimento-banner-icon">
            <i className={`fas ${isSuperAdmin ? 'fa-infinity' : 'fa-calendar-alt'}`}></i>
          </div>
          <div className="vencimento-banner-info">
            <div className="vencimento-header-row">
              <span className="vencimento-label">
                {isSuperAdmin ? 'Licença Celebre:' : 'Data de Renovação / Vencimento:'}
              </span>
              <span className="vencimento-data-destaque">
                {estatisticasReais.dataRenovacao || '—'}
              </span>
              {!isSuperAdmin && estatisticasReais.dataRenovacao && estatisticasReais.dataRenovacao !== 'Vitalício' && (
                <span className="vencimento-dias-pill" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  fontSize: '11.5px',
                  fontWeight: '600'
                }}>
                  <i className="fas fa-clock"></i> Ciclo de 30 dias ativo
                </span>
              )}
            </div>
            <p className="vencimento-subtexto">
              {!isSuperAdmin ? (
                <>Cobrança automática no cartão cadastrado em <strong>{estatisticasReais.dataRenovacao || '—'}</strong> · Acesso aos recursos premium ativo e sem interrupções.</>
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

      {/* 📄 SEÇÃO 3: HISTÓRICO DE FATURAMENTO RECENTE */}
      <div className="assinatura-card-bloco">
        <h3 className="card-bloco-title" style={{ marginBottom: '14px' }}>
          <i className="fas fa-history" style={{ color: 'var(--texto-secundario)' }}></i> Histórico Recente de Faturamento
        </h3>

        <div className="assinatura-tabela-wrapper">
          <table className="assinatura-tabela">
            <thead>
              <tr>
                <th>Data Pagamento</th>
                <th>Descrição</th>
                <th>Período / Vigência</th>
                <th>Método</th>
                <th>Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Recibo</th>
              </tr>
            </thead>
            <tbody>
              {historicoFaturas && historicoFaturas.length > 0 ? (
                historicoFaturas.map((fat, idx) => {
                  const valorExibido = (fat.valor && fat.valor !== '0,00' && fat.valor !== '0') ? fat.valor : infoPlanoAtual.preco;
                  const metodoExibido = (fat.metodo && fat.metodo !== 'Nenhum' && fat.metodo !== 'Nenhum método cadastrado') ? fat.metodo : infoPlanoAtual.metodo;
                  const descExibida = (!fat.descricao || fat.descricao.includes('Carregando...'))
                    ? `Assinatura ${infoDatasPadrao.cicloNome} - ${infoPlanoAtual.nome}`
                    : fat.descricao;

                  const faturaSaneada = {
                    ...fat,
                    valor: valorExibido,
                    metodo: metodoExibido,
                    descricao: descExibida
                  };

                  return (
                    <tr key={fat.id || idx}>
                      <td className="data-col">{fat.dataPagamento}</td>
                      <td className="desc-col">{descExibida}</td>
                      <td className="periodo-col">
                        <span className="periodo-badge">{fat.periodo}</span>
                      </td>
                      <td className="metodo-col">{metodoExibido}</td>
                      <td className="valor-col">R$ {valorExibido}</td>
                      <td>
                        <span className="status-concluido-pill">{fat.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          type="button" 
                          onClick={() => handleImprimirComprovante(faturaSaneada)}
                          className="btn-imprimir-recibo"
                        >
                          <i className="fas fa-print"></i> Imprimir Recibo
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--texto-secundario)' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <i className="fas fa-gift" style={{ fontSize: '28px', color: 'var(--dourado)' }}></i>
                      <strong style={{ fontSize: '15px', color: 'var(--texto-principal)' }}>
                        {isSuperAdmin ? 'Acesso Master Vitalício Permanente' : 'Período de Teste Gratuito Ativo'}
                      </strong>
                      <p style={{ margin: 0, fontSize: '13px', maxWidth: '440px', lineHeight: '1.4' }}>
                        {isSuperAdmin
                          ? 'Sua conta de Super Administrador possui licença permanente sem necessidade de faturas.'
                          : `Sua empresa está em período de avaliação gratuita até ${estatisticasReais.dataRenovacao || 'o término do teste'}. Nenhuma cobrança foi realizada e não há faturas pendentes.`
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              )}
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

      {/* ⭐ MODAL VIP: RECURSOS & MÓDULOS INCLUÍDOS NO PLANO */}
      {modalRecursosAberto && (
        <div className="assinatura-modal-overlay" onClick={() => setModalRecursosAberto(false)}>
          <div className="modal-recursos-plano-card" onClick={e => e.stopPropagation()}>
            
            {/* CABEÇALHO DO MODAL */}
            <div className="modal-recursos-header">
              <div className="modal-recursos-header-left">
                <div className="modal-recursos-icon-circle">
                  <i className="fas fa-crown"></i>
                </div>
                <div>
                  <div className="modal-recursos-top-badges">
                    <span className="modal-recursos-badge-plano">Plano {planoNomeAtual}</span>
                    <span className="modulos-liberados-badge">
                      <i className="fas fa-check-double"></i> 8 Módulos Liberados
                    </span>
                  </div>
                  <h3 className="modal-recursos-title">
                    Recursos Incluídos no Seu Plano
                  </h3>
                  <p className="modal-recursos-sub">
                    Todas as ferramentas ativas, ilimitadas e prontas para uso na sua empresa.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-recursos-close-btn"
                onClick={() => setModalRecursosAberto(false)}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* GRID DE MÓDULOS NO MODAL */}
            <div className="modal-recursos-grid">
              {LISTA_MODULOS_INCLUIDOS.map((item, index) => (
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

            {/* RODAPÉ DO MODAL */}
            <div className="modal-recursos-footer">
              <div className="modal-recursos-footer-info">
                <i className="fas fa-shield-alt" style={{ color: '#10b981' }}></i>
                <span>Acesso ilimitado e irrestrito sem cobranças adicionais por módulo.</span>
              </div>
              <button 
                type="button" 
                className="btn-modal-recursos-fechar"
                onClick={() => setModalRecursosAberto(false)}
              >
                Entendido
              </button>
            </div>

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

            {/* 📱 CONTROLE DE NAVEGAÇÃO LATERAL MOBILE (FLECHAS INDICATIVAS & ABAS RÁPIDAS) */}
            <div className="modal-carousel-nav-wrapper">
              <button
                type="button"
                className="modal-carousel-arrow-btn prev"
                onClick={irParaPlanoAnterior}
                title="Plano Anterior"
                aria-label="Plano Anterior"
              >
                <i className="fas fa-chevron-left"></i>
              </button>

              <div className="modal-carousel-pills-track">
                {LISTA_PLANOS_DISPONIVEIS.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`modal-carousel-pill-item ${idx === carouselIndex ? 'active' : ''}`}
                    onClick={() => selecionarPlanoPorIndex(idx)}
                  >
                    <span className="pill-dot"></span>
                    <span>{p.nome}</span>
                    {p.id === planoAtualKey && <span className="pill-sub-tag">Atual</span>}
                    {p.destaque && p.id !== planoAtualKey && <span className="pill-sub-tag gold">★</span>}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="modal-carousel-arrow-btn next"
                onClick={irParaProximoPlano}
                title="Próximo Plano"
                aria-label="Próximo Plano"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            {/* CONTAINER COM FLECHAS FLUTUANTES LATERAIS E SUPORTE A TOUCH SWIPE */}
            <div 
              className="modal-planos-carousel-container"
              onTouchStart={(e) => setTouchStartX(e.targetTouches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchStartX === null) return;
                const touchEndX = e.changedTouches[0].clientX;
                const diff = touchStartX - touchEndX;
                if (diff > 40) irParaProximoPlano();
                else if (diff < -40) irParaPlanoAnterior();
                setTouchStartX(null);
              }}
            >
              {/* FLECHA LATERAL ESQUERDA FLUTUANTE */}
              <button
                type="button"
                className="modal-carousel-floating-arrow prev"
                onClick={irParaPlanoAnterior}
                title="Plano Anterior"
                aria-label="Plano Anterior"
              >
                <i className="fas fa-chevron-left"></i>
              </button>

              {/* GRID DE CARDS DOS 3 PLANOS */}
              <div className="modal-planos-grid">
                {LISTA_PLANOS_DISPONIVEIS.map((plano, idx) => {
                  const isPlanoAtual = plano.id === planoAtualKey;
                  const isSelected = modalPlanoSelecionado === plano.id;
                  const isCarouselActive = idx === carouselIndex;
                  const isDestaque = plano.destaque;
                  const nivelPlanoAtual = HIERARQUIA_PLANOS[planoAtualKey] || 2;
                  const nivelPlanoCard = HIERARQUIA_PLANOS[plano.id] || 1;
                  const isDowngradeCard = nivelPlanoCard < nivelPlanoAtual;

                  return (
                    <div
                      key={plano.id}
                      className={`modal-plano-card ${isPlanoAtual ? 'is-plano-atual' : ''} ${isSelected ? 'is-selected' : ''} ${isCarouselActive ? 'is-carousel-active' : ''} ${isDowngradeCard && !isPlanoAtual ? 'is-downgrade-card' : ''} ${isDestaque && !isPlanoAtual && !isDowngradeCard ? 'is-destaque' : ''}`}
                      onClick={() => {
                        selecionarPlanoPorIndex(idx);
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

              {/* FLECHA LATERAL DIREITA FLUTUANTE */}
              <button
                type="button"
                className="modal-carousel-floating-arrow next"
                onClick={irParaProximoPlano}
                title="Próximo Plano"
                aria-label="Próximo Plano"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
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

      {/* 🧾 MODAL DO RECIBO OFICIAL CELEBRE */}
      <ModalReciboOficial
        isOpen={Boolean(faturaReciboModal)}
        onClose={() => setFaturaReciboModal(null)}
        fatura={faturaReciboModal}
        isAdmin={false}
      />

    </div>
  );
};

export default AbaAssinaturaUso;
