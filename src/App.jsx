import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

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
import RotaProtegida from './components/RotaProtegida'; // 🔥 A nossa nova Trava de Segurança!

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

// --- PLANOS & ASSINATURA ---
import Planos from './pages/Planos/Planos';
import AdminPlanos from './pages/Planos/AdminPlanos';
import PaginaUpgrade from './pages/Planos/PaginaUpgrade';

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
          <Route path="/planos" element={<RotaPrivada><Planos /></RotaPrivada>} />
          <Route path="/upgrade" element={<RotaPrivada><PaginaUpgrade /></RotaPrivada>} />
          
          {/* ⚙️ ROTA ADMIN EXCLUSIVA */}
          <Route path="/admin-planos" element={<RotaAdmin><AdminPlanos /></RotaAdmin>} />
          
          {/* 👥 CLIENTES */}
          <Route path="/clientes" element={<RotaPrivada><Clientes /></RotaPrivada>} />
          <Route path="/cadastro-cliente" element={<RotaPrivada><CadastroCliente /></RotaPrivada>} />
          
          {/* 📦 ESTOQUE (🔒 PROTEGIDO PELO PLANO) */}
          <Route path="/estoque" element={<RotaPrivada><RotaProtegida recursoExigido="Estoque"><Estoque /></RotaProtegida></RotaPrivada>} />
          <Route path="/cadastro-estoque" element={<RotaPrivada><RotaProtegida recursoExigido="Estoque"><CadastroEstoque /></RotaProtegida></RotaPrivada>} />
          
          {/* 📅 LOCAÇÕES */}
          <Route path="/locacoes" element={<RotaPrivada><Locacoes /></RotaPrivada>} />
          <Route path="/locacoes/nova" element={<RotaPrivada><NovaLocacao /></RotaPrivada>} />
          <Route path="/locacoes/editar/:id" element={<RotaPrivada><EditarLocacao /></RotaPrivada>} />
          
          {/* 🤝 FORNECEDORES E COMPRAS */}
          <Route path="/fornecedores" element={<RotaPrivada><Fornecedores /></RotaPrivada>} />
          <Route path="/fornecedores/novo" element={<RotaPrivada><NovoFornecedor /></RotaPrivada>} />
          <Route path="/fornecedores/editar/:id" element={<RotaPrivada><NovoFornecedor /></RotaPrivada>} />
          <Route path="/compras" element={<RotaPrivada><Compras /></RotaPrivada>} />
          <Route path="/compras/nova" element={<RotaPrivada><NovaCompra /></RotaPrivada>} />
          <Route path="/compras/editar/:id" element={<RotaPrivada><NovaCompra /></RotaPrivada>} />
          
          {/* 💰 FINANCEIRO */}
          <Route path="/financeiro" element={<RotaPrivada><Financeiro /></RotaPrivada>} />
          <Route path="/financeiro/novo" element={<RotaPrivada><NovoLancamento /></RotaPrivada>} />
          
          {/* 🚚 LOGÍSTICA (🔒 PROTEGIDA PELO PLANO) */}
          <Route path="/agenda" element={<RotaPrivada><Agenda /></RotaPrivada>} />
          <Route path="/logistica" element={<RotaPrivada><RotaProtegida recursoExigido="Logística"><Logistica /></RotaProtegida></RotaPrivada>} />
          
          {/* 📝 CONTRATOS (🔒 PROTEGIDO PELO PLANO) */}
          <Route path="/contratos" element={<RotaPrivada><RotaProtegida recursoExigido="Contratos"><Contratos /></RotaProtegida></RotaPrivada>} />
          <Route path="/novo-contrato" element={<RotaPrivada><RotaProtegida recursoExigido="Contratos"><NovoContrato /></RotaProtegida></RotaPrivada>} />
          <Route path="/modelos-contrato" element={<RotaPrivada><RotaProtegida recursoExigido="Contratos"><ModelosContrato /></RotaProtegida></RotaPrivada>} />
          <Route path="/editar-contrato/:id" element={<RotaPrivada><RotaProtegida recursoExigido="Contratos"><EditarContrato /></RotaProtegida></RotaPrivada>} />
          
          {/* 📊 GESTÃO */}
          <Route path="/relatorios" element={<RotaPrivada><Relatorios /></RotaPrivada>} />
          <Route path="/moodboard" element={<RotaPrivada><Moodboard /></RotaPrivada>} />
          <Route path="/configuracoes" element={<RotaPrivada><Configuracoes /></RotaPrivada>} />
          <Route path="/perfil" element={<RotaPrivada><Perfil /></RotaPrivada>} />
          <Route path="/notificacoes" element={<RotaPrivada><Notificacoes /></RotaPrivada>} /> 
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