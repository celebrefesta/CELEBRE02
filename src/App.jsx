import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { collection, query, where, getDocs } from 'firebase/firestore'; 
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
import RotaProtegida from './components/RotaProtegida'; 

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

// 🛡️🔥 BLINDAGEM MÁXIMA DE ROTA (Consulta direta ao Banco de Dados)
const BloqueioPermissao = ({ children, modulo }) => {
  const [statusAcesso, setStatusAcesso] = useState('verificando'); 

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatusAcesso('bloqueado');
        return;
      }

      try {
        // Ignora a memória do navegador e vai perguntar diretamente ao Firebase
        const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
        const snapFunc = await getDocs(qFunc);

        // Se a busca voltar vazia, é porque é a conta da Administradora! Portas abertas!
        if (snapFunc.empty) {
          setStatusAcesso('permitido');
          return;
        }

        // A partir daqui, temos a certeza absoluta que é um Funcionário
        
        // 1. Áreas proibidas por padrão (Nem perca tempo a procurar)
        if (['Financeiro', 'Relatorios', 'Assinatura', 'Equipe'].includes(modulo)) {
          setStatusAcesso('bloqueado');
          return;
        }

        // 2. Verifica a aba específica no banco de dados dele
        const dadosFunc = snapFunc.docs[0].data();
        const permissoes = dadosFunc.permissoes || {};

        const removerAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const moduloLimpo = removerAcentos(modulo);

        let valorEncontrado = false;
        
        if (Array.isArray(permissoes)) {
            valorEncontrado = permissoes.map(removerAcentos).includes(moduloLimpo);
        } else if (typeof permissoes === 'object' && permissoes !== null) {
            const chaves = Object.keys(permissoes);
            for (let k of chaves) {
                if (removerAcentos(k) === moduloLimpo) {
                    valorEncontrado = permissoes[k] === true;
                    break;
                }
            }
        }

        setStatusAcesso(valorEncontrado ? 'permitido' : 'bloqueado');

      } catch (error) {
        console.error("Erro na blindagem de rota:", error);
        setStatusAcesso('bloqueado'); // Na dúvida perante um erro, tranca a porta
      }
    });

    return () => unsubscribe();
  }, [modulo]);

  if (statusAcesso === 'verificando') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#64748b' }}>
        <i className="fas fa-shield-alt fa-spin" style={{ marginRight: '10px', color: '#c5a059' }}></i>
        Verificando credenciais de segurança...
      </div>
    );
  }

  // Se for permitido, mostra a página. Se for hackeado, pontapé para o Início!
  return statusAcesso === 'permitido' ? children : <Navigate to="/dashboard" replace />;
};

const AppContent = () => {
  const location = useLocation();

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
          <Route path="/planos" element={<RotaPrivada><BloqueioPermissao modulo="Assinatura"><Planos /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/upgrade" element={<RotaPrivada><BloqueioPermissao modulo="Assinatura"><PaginaUpgrade /></BloqueioPermissao></RotaPrivada>} />
          
          {/* ⚙️ ROTA ADMIN EXCLUSIVA */}
          <Route path="/admin-planos" element={<RotaAdmin><AdminPlanos /></RotaAdmin>} />
          
          {/* 👥 CLIENTES */}
          <Route path="/clientes" element={<RotaPrivada><BloqueioPermissao modulo="Clientes"><Clientes /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/cadastro-cliente" element={<RotaPrivada><BloqueioPermissao modulo="Clientes"><CadastroCliente /></BloqueioPermissao></RotaPrivada>} />
          
          {/* 📦 ESTOQUE */}
          <Route path="/estoque" element={<RotaPrivada><BloqueioPermissao modulo="Estoque"><RotaProtegida recursoExigido="Estoque"><Estoque /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          <Route path="/cadastro-estoque" element={<RotaPrivada><BloqueioPermissao modulo="Estoque"><RotaProtegida recursoExigido="Estoque"><CadastroEstoque /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          
          {/* 📅 LOCAÇÕES */}
          <Route path="/locacoes" element={<RotaPrivada><BloqueioPermissao modulo="Locacoes"><Locacoes /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/locacoes/nova" element={<RotaPrivada><BloqueioPermissao modulo="Locacoes"><NovaLocacao /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/locacoes/editar/:id" element={<RotaPrivada><BloqueioPermissao modulo="Locacoes"><EditarLocacao /></BloqueioPermissao></RotaPrivada>} />
          
          {/* 🤝 FORNECEDORES E COMPRAS */}
          <Route path="/fornecedores" element={<RotaPrivada><BloqueioPermissao modulo="Compras"><Fornecedores /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/fornecedores/novo" element={<RotaPrivada><BloqueioPermissao modulo="Compras"><NovoFornecedor /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/fornecedores/editar/:id" element={<RotaPrivada><BloqueioPermissao modulo="Compras"><NovoFornecedor /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/compras" element={<RotaPrivada><BloqueioPermissao modulo="Compras"><Compras /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/compras/nova" element={<RotaPrivada><BloqueioPermissao modulo="Compras"><NovaCompra /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/compras/editar/:id" element={<RotaPrivada><BloqueioPermissao modulo="Compras"><NovaCompra /></BloqueioPermissao></RotaPrivada>} />
          
          {/* 💰 FINANCEIRO */}
          <Route path="/financeiro" element={<RotaPrivada><BloqueioPermissao modulo="Financeiro"><Financeiro /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/financeiro/novo" element={<RotaPrivada><BloqueioPermissao modulo="Financeiro"><NovoLancamento /></BloqueioPermissao></RotaPrivada>} />
          
          {/* 🚚 LOGÍSTICA E AGENDA */}
          <Route path="/agenda" element={<RotaPrivada><BloqueioPermissao modulo="Agenda"><Agenda /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/logistica" element={<RotaPrivada><BloqueioPermissao modulo="Logistica"><RotaProtegida recursoExigido="Logística"><Logistica /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          
          {/* 📝 CONTRATOS */}
          <Route path="/contratos" element={<RotaPrivada><BloqueioPermissao modulo="Contratos"><RotaProtegida recursoExigido="Contratos"><Contratos /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          <Route path="/novo-contrato" element={<RotaPrivada><BloqueioPermissao modulo="Contratos"><RotaProtegida recursoExigido="Contratos"><NovoContrato /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          <Route path="/modelos-contrato" element={<RotaPrivada><BloqueioPermissao modulo="Contratos"><RotaProtegida recursoExigido="Contratos"><ModelosContrato /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          <Route path="/editar-contrato/:id" element={<RotaPrivada><BloqueioPermissao modulo="Contratos"><RotaProtegida recursoExigido="Contratos"><EditarContrato /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          
          {/* 📊 GESTÃO */}
          <Route path="/relatorios" element={<RotaPrivada><BloqueioPermissao modulo="Relatorios"><Relatorios /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/moodboard" element={<RotaPrivada><BloqueioPermissao modulo="Moodboard"><Moodboard /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/configuracoes" element={<RotaPrivada><BloqueioPermissao modulo="Equipe"><Configuracoes /></BloqueioPermissao></RotaPrivada>} />
          <Route path="/perfil" element={<RotaPrivada><Perfil /></RotaPrivada>} />
          <Route path="/notificacoes" element={<RotaPrivada><Notificacoes /></RotaPrivada>} /> 
          
          {/* 👥 GESTÃO DE EQUIPE E RH */}
          <Route path="/usuarios" element={<RotaPrivada><BloqueioPermissao modulo="Equipe"><RotaProtegida recursoExigido="Equipe"><Usuarios /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          <Route path="/monitoramento" element={<RotaPrivada><BloqueioPermissao modulo="Equipe"><RotaProtegida recursoExigido="Equipe"><Monitoramento /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
          
          {/* 🔥 GESTÃO DE ASOS */}
          <Route path="/asos" element={<RotaPrivada><BloqueioPermissao modulo="Equipe"><RotaProtegida recursoExigido="Equipe"><GestaoASO /></RotaProtegida></BloqueioPermissao></RotaPrivada>} />
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