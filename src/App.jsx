import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'; 
import { db } from './firebaseConfig'; 

// --- MENU & TOPBAR ---
import Navbar from './components/Navbar';
import Topbar from './components/Topbar'; 
import './App.css';

// --- AUTENTICAÇÃO E VITRINE ---
import LandingPage from './pages/LandingPage/LandingPage'; 
import Login from './pages/Auth/Login';
import Cadastro from './pages/Auth/Cadastro';
import Checkout from './pages/Checkout/Checkout'; 
import RotaPrivada from './components/RotaPrivada'; 
import RotaAdmin from './components/RotaAdmin'; 

// --- PÁGINAS ---
import Dashboard from './pages/Dashboard/Dashboard';
import Clientes from './pages/Clientes/Clientes';
import CadastroCliente from './pages/Clientes/CadastroCliente'; 
import AutoCadastro from './pages/Clientes/AutoCadastro'; 

import Estoque from './pages/Estoque/Estoque';
import CadastroEstoque from './pages/Estoque/CadastroEstoque';

// --- LOCAÇÕES ---
import Locacoes from './pages/Locacoes/Locacoes';
import NovaLocacao from './pages/Locacoes/NovaLocacao';
import EditarLocacao from './pages/Locacoes/EditarLocacao';

// --- FINANCEIRO & COMPRAS ---
import Fornecedores from './pages/Fornecedores/Fornecedores';
import NovoFornecedor from './pages/Fornecedores/NovoFornecedor';
import Compras from './pages/Compras/Compras';
import NovaCompra from './pages/Compras/NovaCompra';
import Financeiro from './pages/Financeiro/Financeiro';
import NovoLancamento from './pages/Financeiro/NovoLancamento';

// --- OPERACIONAL ---
import Agenda from './pages/Agenda/Agenda';
import Logistica from './pages/Logistica/Logistica';
import Contratos from './pages/Contratos/Contratos';
import NovoContrato from "./pages/Contratos/NovoContrato";
import EditarContrato from "./pages/Contratos/EditarContrato";
import AssinaturaContrato from "./pages/Contratos/AssinaturaContrato";
import ModelosContrato from "./pages/Contratos/ModelosContrato";
import VisualizarContrato from "./pages/Contratos/VisualizarContrato";

// --- GESTÃO ---
import Relatorios from './pages/Relatorios/Relatorios';
import Configuracoes from './pages/Configuracoes/Configuracoes';
import Perfil from './pages/Perfil/Perfil';
import Moodboard from './pages/Moodboard/Moodboard';
import Catalogo from './pages/Catalago/Catalago'; 
import Notificacoes from './pages/Notificacoes/Notificacoes';

import Usuarios from './Usuarios/Usuarios'; 
import Monitoramento from './Usuarios/Monitoramento'; 
import GestaoASO from './Usuarios/GestaoASO'; 

// --- PLANOS & ASSINATURA ---
import Planos from './pages/Planos/Planos';
import AdminPlanos from './pages/Planos/AdminPlanos';
import PaginaUpgrade from './pages/Planos/PaginaUpgrade';
import ControleGeral from './pages/Admin/ControleGeral';

// 🛡️🔥 BLINDAGEM MÁXIMA DE ROTA (Dupla Verificação em Tempo Real)
const TravaSeguranca = ({ children, modulo, recursoExigido }) => {
  const [statusAcesso, setStatusAcesso] = useState('verificando'); 

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatusAcesso('bloqueado');
        return;
      }

      try {
        const emailAdmin = "celebrefesta25@gmail.com";
        if (user.email === emailAdmin) {
            setStatusAcesso('permitido');
            return;
        }

        // 1. Identificar quem está logado
        const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
        const snapFunc = await getDocs(qFunc);

        const isFuncionarioReal = !snapFunc.empty;
        let tenantId = user.uid;
        let permissoesFuncionario = {};

        if (isFuncionarioReal) {
            const dadosFunc = snapFunc.docs[0].data();
            tenantId = dadosFunc.empresaId || user.uid;
            permissoesFuncionario = dadosFunc.permissoes || {};
        }

        // 2. VERIFICAÇÃO DO PLANO DA EMPRESA (Trava o Cadeado Vermelho na Rota)
        if (recursoExigido) {
            const userSnap = await getDoc(doc(db, "usuarios", tenantId));
            let empresaPagou = false;

            if (userSnap.exists()) {
                const dadosUsr = userSnap.data();
                const testeAtivo = dadosUsr.dataFimTeste ? new Date() <= new Date(dadosUsr.dataFimTeste) : false;
                const assinaturaAtiva = dadosUsr.assinaturaAtiva === true || dadosUsr.plano === 'pago' || dadosUsr.statusPagamentoVulso === 'pago';
                const congelado = !testeAtivo && !assinaturaAtiva;

                if (testeAtivo) {
                    empresaPagou = true;
                } else if (!congelado && dadosUsr.planoId) {
                    const planoSnap = await getDoc(doc(db, "planos", dadosUsr.planoId));
                    if (planoSnap.exists()) {
                        const beneficios = planoSnap.data().beneficios || [];
                        // Ignora maiúsculas e minúsculas para garantir a checagem
                        empresaPagou = beneficios.some(b => b.toLowerCase().includes(recursoExigido.toLowerCase()));
                    }
                } else if (assinaturaAtiva && !dadosUsr.planoId) {
                    // Fallback se tiver assinatura ativa mas sem planoId preenchido
                    empresaPagou = true; 
                }
            }

            // Se o plano não cobrir, bloqueia a URL na hora!
            if (!empresaPagou) {
                setStatusAcesso('bloqueado');
                return;
            }
        }

        // 3. VERIFICAÇÃO DO FUNCIONÁRIO (Trava o Cadeado Branco na Rota)
        if (isFuncionarioReal && modulo) {
            // Áreas expressamente proibidas para funcionários (Finanças, Relatórios, etc)
            if (['Financeiro', 'Relatorios', 'Assinatura', 'Equipe'].includes(modulo)) {
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
                setStatusAcesso('bloqueado');
                return;
            }
        }

        // Passou nos dois seguranças! Pode entrar.
        setStatusAcesso('permitido');

      } catch (error) {
        console.error("Erro na blindagem de rota:", error);
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

  // Se não foi permitido, atira de volta para o dashboard
  return statusAcesso === 'permitido' ? children : <Navigate to="/dashboard" replace />;
};

const AppContent = () => {
  const location = useLocation();
  const [usuarioLogado, setUsuarioLogado] = useState(null);

  useEffect(() => {
    localStorage.removeItem('simulatingName');
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUsuarioLogado(user);
      if (user) {
        // Ignora bypass do Super Admin e garante que seu tenantId está correto
        if (user.email === "celebrefesta25@gmail.com") {
          localStorage.setItem('tenantId', user.uid);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, "usuarios", user.uid));
          if (!userDoc.exists()) {
            const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
            const snapFunc = await getDocs(qFunc);
            if (snapFunc.empty) {
              console.warn("Usuário autenticado mas não encontrado no Firestore. Efetuando logout...");
              await auth.signOut();
              alert("Sua conta não foi encontrada ou foi removida. Por favor, cadastre-se novamente.");
              window.location.href = '/cadastro';
            }
          }
        } catch (error) {
          console.error("Erro ao verificar integridade da conta:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const rotasSemMenu = ['/', '/login', '/cadastro', '/checkout', '/planos', '/upgrade'];

  const showNavbar = !rotasSemMenu.includes(location.pathname) && 
                     !location.pathname.includes('/assinatura') && 
                     !location.pathname.includes('/catalogo') &&
                     !location.pathname.includes('/visualizar') &&
                     !location.pathname.includes('/autocadastro');

  return (
    <div className={`App ${!showNavbar ? 'no-navbar' : ''}`}>
      {showNavbar && <Navbar />}
      
      <main className="main-content">
        {showNavbar && <Topbar />}

        <Routes>
          {/* 🌍 VITRINE PÚBLICA */}
          <Route path="/" element={<LandingPage />} />

          {/* 🔓 OUTRAS ROTAS PÚBLICAS */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/checkout" element={<Checkout />} /> 
          
          <Route path="/autocadastro/:idEmpresa" element={<AutoCadastro />} /> 
          <Route path="/catalogo/:idEmpresa" element={<Catalogo />} />
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
          
          {/* 📦 ESTOQUE */}
          <Route path="/estoque" element={<RotaPrivada><TravaSeguranca modulo="Estoque" recursoExigido="Estoque"><Estoque /></TravaSeguranca></RotaPrivada>} />
          <Route path="/cadastro-estoque" element={<RotaPrivada><TravaSeguranca modulo="Estoque" recursoExigido="Estoque"><CadastroEstoque /></TravaSeguranca></RotaPrivada>} />
          
          {/* 📅 LOCAÇÕES */}
          <Route path="/locacoes" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><Locacoes /></TravaSeguranca></RotaPrivada>} />
          <Route path="/locacoes/nova" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><NovaLocacao /></TravaSeguranca></RotaPrivada>} />
          <Route path="/locacoes/editar/:id" element={<RotaPrivada><TravaSeguranca modulo="Locacoes" recursoExigido="Gestão de Pedidos"><EditarLocacao /></TravaSeguranca></RotaPrivada>} />
          
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
          <Route path="/configuracoes" element={<RotaPrivada><TravaSeguranca modulo="Equipe"><Configuracoes /></TravaSeguranca></RotaPrivada>} />
          <Route path="/perfil" element={<RotaPrivada><Perfil /></RotaPrivada>} />
          <Route path="/notificacoes" element={<RotaPrivada><Notificacoes /></RotaPrivada>} /> 
          
          {/* 👥 GESTÃO DE EQUIPE E RH */}
          <Route path="/usuarios" element={<RotaPrivada><TravaSeguranca modulo="Equipe" recursoExigido="Equipe"><Usuarios /></TravaSeguranca></RotaPrivada>} />
          <Route path="/monitoramento" element={<RotaPrivada><TravaSeguranca modulo="Equipe" recursoExigido="Equipe"><Monitoramento /></TravaSeguranca></RotaPrivada>} />
          <Route path="/asos" element={<RotaPrivada><TravaSeguranca modulo="Equipe" recursoExigido="Equipe"><GestaoASO /></TravaSeguranca></RotaPrivada>} />
        </Routes>
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