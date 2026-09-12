import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'; 
import { db } from './firebaseConfig'; 
import { verificarELimparMidiasBackground } from './utils/limpezaMidiaService'; 

// --- MENU & TOPBAR ---
import Navbar from './components/Navbar';
import Topbar from './components/Topbar'; 
import InstallAppPrompt from './components/InstallAppPrompt/InstallAppPrompt';
import './App.css';
import './styles/design-lock.css'; /* 🔒 DESIGN LOCK — importado por último, vence toda a cascata */
import { aplicarCorDestaqueGlobal } from './utils/themeUtils';
import { calcularPeriodoTeste } from './utils/periodoTesteUtils';

import RotaPrivada from './components/RotaPrivada'; 
import RotaAdmin from './components/RotaAdmin'; 

// --- AUTENTICAÇÃO E VITRINE (Code-Splitting via React.lazy) ---
const LandingPage = lazy(() => import('./pages/LandingPage/LandingPage')); 
const TermosDeUso = lazy(() => import('./pages/Institucional/TermosDeUso'));
const PoliticaPrivacidade = lazy(() => import('./pages/Institucional/PoliticaPrivacidade'));
const ExcluirConta = lazy(() => import('./pages/Institucional/ExcluirConta'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Cadastro = lazy(() => import('./pages/Auth/Cadastro'));
const RedefinirSenha = lazy(() => import('./pages/Auth/RedefinirSenha'));
const ConfirmarEmail = lazy(() => import('./pages/Auth/ConfirmarEmail'));
const Checkout = lazy(() => import('./pages/Checkout/Checkout')); 

// --- PÁGINAS ---
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes/Clientes'));
const CadastroCliente = lazy(() => import('./pages/Clientes/CadastroCliente')); 
const AutoCadastro = lazy(() => import('./pages/Clientes/AutoCadastro')); 

const Estoque = lazy(() => import('./pages/Estoque/Estoque'));
const CadastroEstoque = lazy(() => import('./pages/Estoque/CadastroEstoque'));

// --- LOCAÇÕES ---
const Locacoes = lazy(() => import('./pages/Locacoes/Locacoes'));
const NovaLocacao = lazy(() => import('./pages/Locacoes/NovaLocacao'));
const EditarLocacao = lazy(() => import('./pages/Locacoes/EditarLocacao'));
const CheckinPage = lazy(() => import('./pages/Locacoes/CheckinPage'));
const CheckoutPage = lazy(() => import('./pages/Locacoes/CheckoutPage'));
const Disponibilidade = lazy(() => import('./pages/Locacoes/Disponibilidade'));

// --- FINANCEIRO & COMPRAS ---
const Fornecedores = lazy(() => import('./pages/Fornecedores/Fornecedores'));
const NovoFornecedor = lazy(() => import('./pages/Fornecedores/NovoFornecedor'));
const Compras = lazy(() => import('./pages/Compras/Compras'));
const NovaCompra = lazy(() => import('./pages/Compras/NovaCompra'));
const Financeiro = lazy(() => import('./pages/Financeiro/Financeiro'));
const NovoLancamento = lazy(() => import('./pages/Financeiro/NovoLancamento'));
const ContasFixas = lazy(() => import('./pages/Financeiro/ContasFixas'));

// --- OPERACIONAL ---
const Agenda = lazy(() => import('./pages/Agenda/Agenda'));
const Logistica = lazy(() => import('./pages/Logistica/Logistica'));
const Contratos = lazy(() => import('./pages/Contratos/Contratos'));
const NovoContrato = lazy(() => import('./pages/Contratos/NovoContrato'));
const EditarContrato = lazy(() => import('./pages/Contratos/EditarContrato'));
const AssinaturaContrato = lazy(() => import('./pages/Contratos/AssinaturaContrato'));
const ModelosContrato = lazy(() => import('./pages/Contratos/ModelosContrato'));
const VisualizarContrato = lazy(() => import('./pages/Contratos/VisualizarContrato'));

// --- GESTÃO ---
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes/Configuracoes'));
const Moodboard = lazy(() => import('./pages/Moodboard/Moodboard'));
const Catalogo = lazy(() => import('./pages/Catalago/Catalago')); 
const Notificacoes = lazy(() => import('./pages/Notificacoes/Notificacoes'));

const Usuarios = lazy(() => import('./Usuarios/Usuarios')); 
const Monitoramento = lazy(() => import('./Usuarios/Monitoramento')); 
const GestaoASO = lazy(() => import('./Usuarios/GestaoASO')); 

// --- PLANOS & ASSINATURA ---
const Planos = lazy(() => import('./pages/Planos/Planos'));
const AdminPlanos = lazy(() => import('./pages/Planos/AdminPlanos'));
const PaginaUpgrade = lazy(() => import('./pages/Planos/PaginaUpgrade'));
const ContaSuspensa = lazy(() => import('./pages/Auth/ContaSuspensa'));
const ControleGeral = lazy(() => import('./pages/Admin/ControleGeral'));

const parseFirestoreDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal.toDate) {
      try { return dateVal.toDate(); } catch (e) {}
  }
  if (dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
  }
  
  const str = String(dateVal).trim();
  
  // 1. Formato ISO ou AAAA-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
      const ano = parseInt(isoMatch[1], 10);
      const mes = parseInt(isoMatch[2], 10) - 1;
      const dia = parseInt(isoMatch[3], 10);
      return new Date(ano, mes, dia);
  }

  // 2. Formato brasileiro DD/MM/AAAA
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
      const dia = parseInt(brMatch[1], 10);
      const mes = parseInt(brMatch[2], 10) - 1;
      const ano = parseInt(brMatch[3], 10);
      return new Date(ano, mes, dia);
  }
  
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
      parsed.setHours(0,0,0,0);
      return parsed;
  }
  
  return null;
};

// ⚡ Cache de segurança em memória para transição instantânea entre páginas (0ms de espera)
const cachePermissoesRotas = new Map();

// 🛡️🔥 BLINDAGEM MÁXIMA DE ROTA (Dupla Verificação em Tempo Real com Cache Rápido)
const TravaSeguranca = ({ children, modulo, recursoExigido }) => {
  const auth = getAuth();
  const usuarioAtual = auth.currentUser;
  const uid = usuarioAtual?.uid || localStorage.getItem('tenantId') || 'guest';
  const cacheKey = `${uid}_${modulo || 'todos'}_${recursoExigido || 'geral'}`;

  const [statusAcesso, setStatusAcesso] = useState(() => {
    const emCache = cachePermissoesRotas.get(cacheKey);
    // Se já foi validado nesta sessão nos últimos 10 minutos, entra instantaneamente
    if (emCache && (Date.now() - emCache.timestamp < 1000 * 60 * 10)) {
      return emCache.status;
    }
    return 'verificando';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        cachePermissoesRotas.set(cacheKey, { status: 'bloqueado', timestamp: Date.now() });
        setStatusAcesso('bloqueado');
        return;
      }

      try {
        const emailAdmin = "celebrefesta25@gmail.com";
        if (user.email === emailAdmin) {
            cachePermissoesRotas.set(cacheKey, { status: 'permitido', timestamp: Date.now() });
            setStatusAcesso('permitido');
            return;
        }

        let ownDocSnap = await getDoc(doc(db, "usuarios", user.uid));

        let tenantId = user.uid;
        let isFuncionarioReal = false;
        let permissoesFuncionario = {};

        if (ownDocSnap.exists()) {
            const userData = ownDocSnap.data();
            if (userData.role && userData.role !== 'owner' && userData.tenantId) {
                tenantId = userData.tenantId;
                isFuncionarioReal = true;
                const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
                const snapFunc = await getDocs(qFunc);
                if (!snapFunc.empty) {
                    permissoesFuncionario = snapFunc.docs[0].data().permissoes || {};
                }
            } else {
                tenantId = user.uid;
            }
        } else {
            // Verifica se é funcionário de outra empresa
            const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
            const snapFunc = await getDocs(qFunc);
            if (!snapFunc.empty) {
                const dadosFunc = snapFunc.docs[0].data();
                tenantId = dadosFunc.empresaId || user.uid;
                permissoesFuncionario = dadosFunc.permissoes || {};
                isFuncionarioReal = true;
            } else {
                // Auto-cura instantânea para novas contas do Google ou e-mail
                const dataAtual = new Date();
                const dataFimTeste = new Date(dataAtual);
                dataFimTeste.setDate(dataFimTeste.getDate() + 7);
                const emailLimpo = user.email ? user.email.toLowerCase().trim() : '';
                const nomePadrao = user.displayName || (emailLimpo ? emailLimpo.split('@')[0] : 'Usuário');

                await setDoc(doc(db, "usuarios", user.uid), {
                  email: emailLimpo,
                  nomeCompleto: nomePadrao,
                  nomeExibicao: nomePadrao,
                  role: 'owner',
                  tenantId: user.uid,
                  dataCadastro: dataAtual.toISOString(),
                  dataFimTeste: dataFimTeste.toISOString(),
                  planoId: 'plano_basico',
                  statusConta: 'ativo',
                  assinaturaAtiva: false,
                  authProvider: user.providerData?.[0]?.providerId || 'google.com',
                  criadoEm: dataAtual.toISOString()
                }, { merge: true });

                ownDocSnap = await getDoc(doc(db, "usuarios", user.uid));
            }
        }

        // 2. VERIFICAÇÃO DO PLANO E TESTE DA EMPRESA (Trava Geral para Contas Expiradas)
        const userSnap = await getDoc(doc(db, "usuarios", tenantId));
        if (userSnap.exists()) {
            const dadosUsr = userSnap.data();
            
            // ⏸️ CONTA SUSPENSA POR INATIVIDADE:
            // Redireciona imediatamente para a tela dedicada de reativação
            if (dadosUsr.statusConta === 'suspenso' || dadosUsr.status === 'suspenso') {
                cachePermissoesRotas.set(cacheKey, { status: 'suspenso', timestamp: Date.now() });
                setStatusAcesso('suspenso');
                return;
            }

            const assinaturaAtiva = 
                dadosUsr.assinaturaAtiva === true || 
                dadosUsr.statusAssinatura === 'ativa' || 
                dadosUsr.plano === 'pago' || 
                dadosUsr.statusPagamentoVulso === 'pago';

            // LÓGICA SIMPLES: 7 dias a partir de dataCadastro da empresa (Centralizado e Unificado)
            let testeAtivo = false;
            if (!assinaturaAtiva) {
                const infoT = calcularPeriodoTeste(dadosUsr);
                testeAtivo = infoT.emTeste;
            } else {
                testeAtivo = true;
            }

            // 🚫 CONTA EXPIRADA: Se o período de teste expirou e não possui plano pago ativo,
            // NENHUMA rota interna (nem configurações, nem equipe, nem operacional) pode ser acessada!
            if (!testeAtivo && !assinaturaAtiva) {
                cachePermissoesRotas.set(cacheKey, { status: 'bloqueado', timestamp: Date.now() });
                setStatusAcesso('bloqueado');
                return;
            }

            // Se o módulo exige benefício específico contratado no plano
            if (recursoExigido) {
                let temBeneficio = false;
                if (testeAtivo) {
                    temBeneficio = true;
                } else if (assinaturaAtiva && dadosUsr.planoId) {
                    const planoSnap = await getDoc(doc(db, "planos", dadosUsr.planoId));
                    if (planoSnap.exists()) {
                        const beneficios = planoSnap.data().beneficios || [];
                        temBeneficio = beneficios.some(b => b.toLowerCase().includes(recursoExigido.toLowerCase()));
                    }
                } else if (assinaturaAtiva) {
                    temBeneficio = true; 
                }

                if (!temBeneficio) {
                    cachePermissoesRotas.set(cacheKey, { status: 'bloqueado', timestamp: Date.now() });
                    setStatusAcesso('bloqueado');
                    return;
                }
            }
        }

        // 3. VERIFICAÇÃO DO FUNCIONÁRIO (Trava o Cadeado Branco na Rota)
        if (isFuncionarioReal && modulo) {
            // Áreas expressamente proibidas para funcionários (Finanças, Relatórios, etc)
            if (['Financeiro', 'Relatorios', 'Assinatura', 'Equipe'].includes(modulo)) {
                cachePermissoesRotas.set(cacheKey, { status: 'bloqueado', timestamp: Date.now() });
                setStatusAcesso('bloqueado');
                return;
            }

            const removerAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const moduloLimpo = removerAcentos(modulo);

            let valorEncontrado = false;
            
            if (Array.isArray(permissoesFuncionario)) {
                valorEncontrado = permissoesFuncionario.map(removerAcentos).includes(moduloLimpo);
            } else if (typeof permissoesFuncionario === 'object' && permissoesFuncionario !== null) {
                const chaves = Object.keys(permissoesFuncionario);
                for (let k of chaves) {
                    if (removerAcentos(k) === moduloLimpo) {
                        valorEncontrado = permissoesFuncionario[k] === true;
                        break;
                    }
                }
            }

            // Se o funcionário não tiver permissão para esse módulo, bloqueia a URL!
            if (!valorEncontrado) {
                cachePermissoesRotas.set(cacheKey, { status: 'bloqueado', timestamp: Date.now() });
                setStatusAcesso('bloqueado');
                return;
            }
        }

        // Passou nos dois seguranças! Pode entrar.
        cachePermissoesRotas.set(cacheKey, { status: 'permitido', timestamp: Date.now() });
        setStatusAcesso('permitido');

      } catch (error) {
        console.error("Erro na blindagem de rota:", error);
        cachePermissoesRotas.set(cacheKey, { status: 'bloqueado', timestamp: Date.now() });
        setStatusAcesso('bloqueado'); 
      }
    });

    return () => unsubscribe();
  }, [modulo, recursoExigido]);

  if (statusAcesso === 'verificando') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#64748b' }}>
        <i className="fas fa-shield-alt fa-spin" style={{ marginRight: '10px', color: '#c5a059' }}></i>
        Validando segurança da rota...
      </div>
    );
  }

  if (statusAcesso === 'suspenso') {
    return <Navigate to="/conta-suspensa" replace />;
  }

  // Se não foi permitido, atira de volta para o dashboard
  return statusAcesso === 'permitido' ? children : <Navigate to="/dashboard" replace />;
};

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [impersonatedTenant, setImpersonatedTenant] = useState(() => {
    try {
      const raw = localStorage.getItem('impersonatingTenant');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const syncImpersonate = () => {
      try {
        const raw = localStorage.getItem('impersonatingTenant');
        setImpersonatedTenant(raw ? JSON.parse(raw) : null);
      } catch {
        setImpersonatedTenant(null);
      }
    };
    syncImpersonate();
    window.addEventListener('storage', syncImpersonate);
    return () => window.removeEventListener('storage', syncImpersonate);
  }, [location.pathname]);

  const handleSairModoSuporte = () => {
    localStorage.removeItem('impersonatingTenant');
    const auth = getAuth();
    if (auth.currentUser) {
      localStorage.setItem('tenantId', auth.currentUser.uid);
      localStorage.setItem('funcName', auth.currentUser.displayName || 'Celebre Festa');
      localStorage.setItem('userRole', 'owner');
    } else {
      localStorage.removeItem('tenantId');
      localStorage.removeItem('funcName');
      localStorage.removeItem('userRole');
    }
    setImpersonatedTenant(null);
    window.location.href = '/gestao-usuarios';
  };

  useEffect(() => {
    localStorage.removeItem('simulatingName');
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUsuarioLogado(user);
      if (user) {
        // Ignora bypass do Super Admin e garante que seu tenantId está correto
        if (user.email === "celebrefesta25@gmail.com") {
          const impersonating = localStorage.getItem('impersonatingTenant');
          if (impersonating) {
            try {
              const impData = JSON.parse(impersonating);
              if (impData && impData.uid) {
                localStorage.setItem('tenantId', impData.uid);
                if (impData.nome) localStorage.setItem('funcName', impData.nome);
                if (impData.role) localStorage.setItem('userRole', impData.role);
                return;
              }
            } catch (e) {}
          }
          localStorage.setItem('tenantId', user.uid);
          localStorage.setItem('funcName', user.displayName || 'Celebre Festa');
          localStorage.setItem('userRole', 'owner');
          return;
        }

        try {
          const userDocRef = doc(db, "usuarios", user.uid);
          
          let role = 'owner';
          let tenantId = user.uid;
          let nomeExibido = user.displayName || user.email || 'Usuário';

          // 1. Consulta equipe PRIMEIRO (essa query é sempre permitida pela regra de e-mail e não causa deadlock)
          const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
          const snapFunc = await getDocs(qFunc);

          if (!snapFunc.empty) {
            // É funcionário!
            const dadosFunc = snapFunc.docs[0].data();
            const empresaId = dadosFunc.empresaId;
            role = dadosFunc.cargo || 'Funcionário';
            tenantId = empresaId;
            nomeExibido = dadosFunc.nome || nomeExibido;

            // Grava ou atualiza o perfil em /usuarios/{user.uid} (operação de escrita é permitida pois é seu próprio uid)
            await setDoc(userDocRef, {
              email: user.email,
              nomeCompleto: nomeExibido,
              role: role,
              tenantId: tenantId,
              criadoEm: new Date().toISOString()
            }, { merge: true });

            // Tenta duplicar em /equipe/{user.uid} (embrulhado em try/catch para não quebrar o fluxo caso a regra de escrita de equipe não esteja publicada)
            try {
              const equipeUidRef = doc(db, "equipe", user.uid);
              await setDoc(equipeUidRef, {
                ...dadosFunc,
                criadoEm: dadosFunc.criadoEm || new Date().toISOString()
              }, { merge: true });
            } catch (errEquipeSync) {
              // Sincronização secundária opcional (regra de escrita /equipe restrita no console)
            }
          } else {
            // É dono de conta!
            // Tentamos ler o doc próprio. Se der erro (ex: regras antigas rejeitando leitura), caímos no catch e tentamos criar.
            let userDocSnap = null;
            try {
              userDocSnap = await getDoc(userDocRef);
            } catch (e) {
              console.log("Perfil não pôde ser lido (provavelmente não existe ou regras de leitura restritas), criando novo...");
            }

            if (userDocSnap && userDocSnap.exists()) {
              const userData = userDocSnap.data();
              role = userData.role || 'owner';
              tenantId = userData.tenantId || user.uid;
              nomeExibido = userData.nomeExibicao || userData.nomeCompleto || nomeExibido;

              // Garante que o email está preenchido e minúsculo
              const emailLimpo = user.email ? user.email.toLowerCase().trim() : '';
              const updates = {};
              if (emailLimpo && (!userData.email || userData.email !== emailLimpo)) {
                updates.email = emailLimpo;
              }
              if (Object.keys(updates).length > 0) {
                await setDoc(userDocRef, updates, { merge: true });
              }
            } else {
              // Se não existe, cria um perfil de owner padrão com 7 dias VIP
              const dataAtual = new Date();
              const dataFimTeste = new Date(dataAtual);
              dataFimTeste.setDate(dataFimTeste.getDate() + 7);
              const emailLimpo = user.email ? user.email.toLowerCase().trim() : '';

              await setDoc(userDocRef, {
                email: emailLimpo,
                nomeCompleto: nomeExibido,
                nomeExibicao: nomeExibido,
                role: 'owner',
                tenantId: user.uid,
                dataCadastro: dataAtual.toISOString(),
                dataFimTeste: dataFimTeste.toISOString(),
                planoId: 'plano_basico',
                statusConta: 'ativo',
                assinaturaAtiva: false,
                authProvider: user.providerData?.[0]?.providerId || 'google.com',
                criadoEm: dataAtual.toISOString()
              }, { merge: true });

              // Garante configurações da empresa
              try {
                const cfgRef = doc(db, 'configuracoes_empresa', user.uid);
                const cfgSnap = await getDoc(cfgRef);
                if (!cfgSnap.exists()) {
                  await setDoc(cfgRef, {
                    nomeFantasia: nomeExibido,
                    email: emailLimpo,
                    criadoEm: dataAtual.toISOString()
                  }, { merge: true });
                }
              } catch (eCfg) {}
            }
          }

          // Sincroniza localStorage
          localStorage.setItem('tenantId', tenantId);
          localStorage.setItem('funcName', nomeExibido);
          localStorage.setItem('userRole', role);

          // 🧹 Limpeza silenciosa de mídias de vistoria expiradas em segundo plano (1x por dia)
          verificarELimparMidiasBackground(db, tenantId);
        } catch (error) {
          console.error("Erro ao verificar integridade da conta:", error);
        }
      } else {
        // 🔒 Usuário deslogado: limpar preferências residuais e restaurar a identidade padrão Celebre
        localStorage.removeItem('tenantId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userPermissions');
        localStorage.removeItem('funcName');
        localStorage.removeItem('accentColor');
        aplicarCorDestaqueGlobal('#c5a059');
      }
    });
    return () => unsubscribe();
  }, []);

  // 🎨 SINCRONIZAÇÃO GLOBAL DE TEMA E COR DE DESTAQUE DA MARCA
  useEffect(() => {
    const aplicarTemaGlobal = () => {
      const isLanding = location.pathname === '/';
      const tenantId = localStorage.getItem('tenantId');

      // 🔒 Se for a Landing Page ou se NÃO houver tenant logado, SEMPRE utiliza o Dourado Celebre padrão (#c5a059)
      const savedTheme = (!isLanding && tenantId) ? (localStorage.getItem('theme') || 'light') : 'light';
      const savedAccent = (!isLanding && tenantId) ? (localStorage.getItem('accentColor') || '#c5a059') : '#c5a059';
      const savedFontSize = (!isLanding && tenantId) ? (localStorage.getItem('fontSize') || 'padrao') : 'padrao';
      const savedContrast = (!isLanding && tenantId) ? (localStorage.getItem('highContrast') === 'true') : false;

      let effectiveTheme = 'light';
      let darkStyle = 'none';

      if (savedTheme === 'dark-midnight') {
        effectiveTheme = 'dark';
        darkStyle = 'midnight';
      } else if (savedTheme === 'dark-gray' || savedTheme === 'dark') {
        effectiveTheme = 'dark';
        darkStyle = localStorage.getItem('darkStyle') || 'gray';
      } else if (savedTheme === 'auto') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = prefersDark ? 'dark' : 'light';
        darkStyle = prefersDark ? (localStorage.getItem('darkStyle') || 'gray') : 'none';
      }

      const escurecerHex = (hex, percent = 18) => {
        try {
          let c = hex.replace('#', '');
          if (c.length === 3) c = c.split('').map(x => x + x).join('');
          const num = parseInt(c, 16);
          let r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
          let g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * (percent / 100)));
          let b = Math.max(0, (num & 0x0000FF) - Math.round(255 * (percent / 100)));
          return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        } catch (e) {
          return hex;
        }
      };

      const darkerAccent = escurecerHex(savedAccent, 18);

      document.documentElement.setAttribute('data-theme', effectiveTheme);
      document.documentElement.setAttribute('data-dark-style', darkStyle);
      document.documentElement.setAttribute('data-font-size', savedFontSize);
      document.documentElement.setAttribute('data-contrast', savedContrast ? 'high' : 'normal');
      document.documentElement.style.setProperty('--dourado', savedAccent, 'important');
      document.documentElement.style.setProperty('--cor-destaque', savedAccent, 'important');
      document.documentElement.style.setProperty('--primary-color', savedAccent, 'important');
      document.documentElement.style.setProperty('--gold-primary', savedAccent, 'important');
      document.documentElement.style.setProperty('--gold-dark', darkerAccent, 'important');
      aplicarCorDestaqueGlobal(savedAccent);
    };

    aplicarTemaGlobal();
    window.addEventListener('storage', aplicarTemaGlobal);
    window.addEventListener('theme-change', aplicarTemaGlobal);
    return () => {
      window.removeEventListener('storage', aplicarTemaGlobal);
      window.removeEventListener('theme-change', aplicarTemaGlobal);
    };
  }, [location.pathname]);

  const rotasSemMenu = ['/', '/login', '/cadastro', '/redefinir-senha', '/confirmar-email', '/checkout', '/planos', '/upgrade', '/moodboard', '/termos', '/privacidade', '/excluir-conta', '/conta-suspensa'];

  const showNavbar = !rotasSemMenu.includes(location.pathname) && 
                     !location.pathname.includes('/assinatura') && 
                     !location.pathname.includes('/catalogo') &&
                     !location.pathname.includes('/visualizar') &&
                     !location.pathname.includes('/autocadastro');

  return (
    <div className={`App ${!showNavbar ? 'no-navbar' : ''}`}>
      <InstallAppPrompt />
      {showNavbar && <Navbar />}
      
      <main className="main-content">
        {impersonatedTenant && usuarioLogado?.email === 'celebrefesta25@gmail.com' && (
          <div className="celebre-support-mode-banner">
            <div className="support-banner-left">
              <span className="support-shield-badge">
                <i className="fas fa-shield-alt"></i> MODO SUPORTE ATIVO
              </span>
              <div className="support-banner-desc">
                <span>Você está operando como: <strong>{impersonatedTenant.nome}</strong> ({impersonatedTenant.email})</span>
                <small>Livre acesso administrativo para auxiliar o cliente. As alterações refletem na conta desta empresa.</small>
              </div>
            </div>
            <div className="support-banner-right">
              <button 
                type="button" 
                className="btn-banner-controle" 
                onClick={() => navigate('/gestao-usuarios')}
              >
                <i className="fas fa-sliders-h"></i> Painel Master
              </button>
              <button 
                type="button" 
                className="btn-banner-exit" 
                onClick={handleSairModoSuporte}
              >
                <i className="fas fa-sign-out-alt"></i> Sair do Modo Suporte
              </button>
            </div>
          </div>
        )}
        {showNavbar && <Topbar />}

        <Suspense fallback={
          <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5a059', fontWeight: '500' }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ marginRight: '12px' }}></i>
            <span>Carregando módulo...</span>
          </div>
        }>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/termos" element={<TermosDeUso />} />
            <Route path="/privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/excluir-conta" element={<ExcluirConta />} />
            <Route path="/conta-suspensa" element={<ContaSuspensa />} />

            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/confirmar-email" element={<ConfirmarEmail />} />
            <Route path="/checkout" element={<Checkout />} /> 
            
            <Route path="/autocadastro/:idEmpresa" element={<AutoCadastro />} /> 
            <Route path="/catalogo/:idEmpresa" element={<Catalogo />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/assinatura/:id" element={<AssinaturaContrato />} />
            <Route path="/visualizar/:id" element={<VisualizarContrato />} /> 

            {/* 🔐 ROTAS PRIVADAS DO SISTEMA (Base) */}
            <Route path="/dashboard" element={<RotaPrivada><Dashboard /></RotaPrivada>} />
            <Route path="/planos" element={<RotaPrivada><Planos /></RotaPrivada>} />
            <Route path="/upgrade" element={<RotaPrivada><PaginaUpgrade /></RotaPrivada>} />
            
            {/* ⚙️ ROTA ADMIN EXCLUSIVA */}
            <Route path="/admin-planos" element={<RotaAdmin><AdminPlanos /></RotaAdmin>} />
            <Route path="/gestao-usuarios" element={<RotaAdmin><ControleGeral /></RotaAdmin>} />
            
            {/* 👥 CLIENTES */}
            <Route path="/clientes" element={<RotaPrivada><TravaSeguranca modulo="Clientes" recursoExigido="Gestão Clientes"><Clientes /></TravaSeguranca></RotaPrivada>} />
            <Route path="/cadastro-cliente" element={<RotaPrivada><TravaSeguranca modulo="Clientes" recursoExigido="Gestão Clientes"><CadastroCliente /></TravaSeguranca></RotaPrivada>} />
            <Route path="/novo-cliente" element={<Navigate to="/cadastro-cliente" replace />} />
            
            {/* 📦 ESTOQUE */}
            <Route path="/estoque" element={<RotaPrivada><TravaSeguranca modulo="Estoque" recursoExigido="Estoque"><Estoque /></TravaSeguranca></RotaPrivada>} />
            <Route path="/cadastro-estoque" element={<RotaPrivada><TravaSeguranca modulo="Estoque" recursoExigido="Estoque"><CadastroEstoque /></TravaSeguranca></RotaPrivada>} />
            
            {/* 📅 LOCAÇÕES */}
            <Route path="/locacoes" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><Locacoes /></TravaSeguranca></RotaPrivada>} />
            <Route path="/locacoes/nova" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><NovaLocacao /></TravaSeguranca></RotaPrivada>} />
            <Route path="/locacoes/editar/:id" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><EditarLocacao /></TravaSeguranca></RotaPrivada>} />
            <Route path="/checkin/:id/:modo?" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><CheckinPage /></TravaSeguranca></RotaPrivada>} />
            <Route path="/checkout/:id" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><CheckoutPage /></TravaSeguranca></RotaPrivada>} />
            <Route path="/disponibilidade" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><Disponibilidade /></TravaSeguranca></RotaPrivada>} />
            <Route path="/locacoes/disponibilidade" element={<Navigate to="/disponibilidade" replace />} />
            
            {/* 🤝 FORNECEDORES E COMPRAS */}
            <Route path="/fornecedores" element={<RotaPrivada><TravaSeguranca modulo="Compras" recursoExigido="Gestão Fornecedores"><Fornecedores /></TravaSeguranca></RotaPrivada>} />
            <Route path="/fornecedores/novo" element={<RotaPrivada><TravaSeguranca modulo="Compras" recursoExigido="Gestão Fornecedores"><NovoFornecedor /></TravaSeguranca></RotaPrivada>} />
            <Route path="/fornecedores/editar/:id" element={<RotaPrivada><TravaSeguranca modulo="Compras" recursoExigido="Gestão Fornecedores"><NovoFornecedor /></TravaSeguranca></RotaPrivada>} />
            <Route path="/compras" element={<RotaPrivada><TravaSeguranca modulo="Compras" recursoExigido="Gestão Fornecedores"><Compras /></TravaSeguranca></RotaPrivada>} />
            <Route path="/compras/nova" element={<RotaPrivada><TravaSeguranca modulo="Compras" recursoExigido="Gestão Fornecedores"><NovaCompra /></TravaSeguranca></RotaPrivada>} />
            <Route path="/compras/editar/:id" element={<RotaPrivada><TravaSeguranca modulo="Compras" recursoExigido="Gestão Fornecedores"><NovaCompra /></TravaSeguranca></RotaPrivada>} />
            
            {/* 💰 FINANCEIRO */}
            <Route path="/financeiro" element={<RotaPrivada><TravaSeguranca modulo="Financeiro" recursoExigido="Gestão Financeira"><Financeiro /></TravaSeguranca></RotaPrivada>} />
            <Route path="/financeiro/novo" element={<RotaPrivada><TravaSeguranca modulo="Financeiro" recursoExigido="Gestão Financeira"><NovoLancamento /></TravaSeguranca></RotaPrivada>} />
            <Route path="/novo-lancamento" element={<RotaPrivada><TravaSeguranca modulo="Financeiro" recursoExigido="Gestão Financeira"><NovoLancamento /></TravaSeguranca></RotaPrivada>} />
            <Route path="/financeiro/contas-fixas" element={<RotaPrivada><TravaSeguranca modulo="Financeiro" recursoExigido="Gestão Financeira"><ContasFixas /></TravaSeguranca></RotaPrivada>} />
            
            {/* 🚚 LOGÍSTICA E AGENDA */}
            <Route path="/agenda" element={<RotaPrivada><TravaSeguranca modulo="Agenda" recursoExigido="Agenda"><Agenda /></TravaSeguranca></RotaPrivada>} />
            <Route path="/logistica" element={<RotaPrivada><TravaSeguranca modulo="Logistica" recursoExigido="Logística"><Logistica /></TravaSeguranca></RotaPrivada>} />
            
            {/* 📝 CONTRATOS */}
            <Route path="/contratos" element={<RotaPrivada><TravaSeguranca modulo="Contratos" recursoExigido="Contratos"><Contratos /></TravaSeguranca></RotaPrivada>} />
            <Route path="/novo-contrato" element={<RotaPrivada><TravaSeguranca modulo="Contratos" recursoExigido="Contratos"><NovoContrato /></TravaSeguranca></RotaPrivada>} />
            <Route path="/modelos-contrato" element={<RotaPrivada><TravaSeguranca modulo="Contratos" recursoExigido="Contratos"><ModelosContrato /></TravaSeguranca></RotaPrivada>} />
            <Route path="/editar-contrato/:id" element={<RotaPrivada><TravaSeguranca modulo="Contratos" recursoExigido="Contratos"><EditarContrato /></TravaSeguranca></RotaPrivada>} />
            
            {/* 📊 GESTÃO */}
            <Route path="/relatorios" element={<RotaPrivada><TravaSeguranca modulo="Relatorios" recursoExigido="Relatórios"><Relatorios /></TravaSeguranca></RotaPrivada>} />
            <Route path="/moodboard" element={<RotaPrivada><TravaSeguranca modulo="Moodboard" recursoExigido="Moodboard"><Moodboard /></TravaSeguranca></RotaPrivada>} />
            <Route path="/configuracoes" element={<RotaPrivada><TravaSeguranca modulo="Configuracoes"><Configuracoes /></TravaSeguranca></RotaPrivada>} />
            <Route path="/perfil" element={<Navigate to="/configuracoes" replace />} />
            <Route path="/notificacoes" element={<RotaPrivada><TravaSeguranca modulo="Notificacoes"><Notificacoes /></TravaSeguranca></RotaPrivada>} /> 
            
            {/* 👥 GESTÃO DE EQUIPE E RH */}
            <Route path="/usuarios" element={<RotaPrivada><TravaSeguranca modulo="Equipe" recursoExigido="Equipe"><Usuarios /></TravaSeguranca></RotaPrivada>} />
            <Route path="/monitoramento" element={<RotaPrivada><TravaSeguranca modulo="Equipe" recursoExigido="Equipe"><Monitoramento /></TravaSeguranca></RotaPrivada>} />
            <Route path="/asos" element={<RotaPrivada><TravaSeguranca modulo="Equipe" recursoExigido="Equipe"><GestaoASO /></TravaSeguranca></RotaPrivada>} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;