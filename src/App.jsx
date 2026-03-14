import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// --- MENU & TOPBAR ---
import Navbar from './components/Navbar';
import Topbar from './components/Topbar'; 
import './App.css';

// --- AUTENTICAÇÃO E VITRINE ---
import LandingPage from './pages/LandingPage/LandingPage'; // 🔥 NOSSA NOVA TELA INICIAL
import Login from './pages/Auth/Login';
import Cadastro from './pages/Auth/Cadastro';
import RotaPrivada from './components/RotaPrivada'; 

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

const AppContent = () => {
  const location = useLocation();
  
  // 🔥 Esconde o menu mestre (Navbar preta e Topbar) nas telas públicas
  const rotasSemMenu = ['/', '/login', '/cadastro'];
  
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
          {/* 🌍 VITRINE PÚBLICA (Página Inicial Oficial) */}
          <Route path="/" element={<LandingPage />} />

          {/* 🔓 OUTRAS ROTAS PÚBLICAS */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/autocadastro" element={<AutoCadastro />} /> 
          <Route path="/assinatura/:id" element={<AssinaturaContrato />} />
          <Route path="/visualizar/:id" element={<VisualizarContrato />} /> 
          <Route path="/catalogo" element={<Catalogo />} />

          {/* 🔐 ROTAS PRIVADAS DO SISTEMA (Apenas Logados) */}
          {/* O Dashboard agora mora no /dashboard */}
          <Route path="/dashboard" element={<RotaPrivada><Dashboard /></RotaPrivada>} />
          
          <Route path="/clientes" element={<RotaPrivada><Clientes /></RotaPrivada>} />
          <Route path="/cadastro-cliente" element={<RotaPrivada><CadastroCliente /></RotaPrivada>} />
          
          <Route path="/estoque" element={<RotaPrivada><Estoque /></RotaPrivada>} />
          <Route path="/cadastro-estoque" element={<RotaPrivada><CadastroEstoque /></RotaPrivada>} />
          
          <Route path="/locacoes" element={<RotaPrivada><Locacoes /></RotaPrivada>} />
          <Route path="/locacoes/nova" element={<RotaPrivada><NovaLocacao /></RotaPrivada>} />
          <Route path="/locacoes/editar/:id" element={<RotaPrivada><EditarLocacao /></RotaPrivada>} />
          
          <Route path="/fornecedores" element={<RotaPrivada><Fornecedores /></RotaPrivada>} />
          <Route path="/fornecedores/novo" element={<RotaPrivada><NovoFornecedor /></RotaPrivada>} />
          <Route path="/compras" element={<RotaPrivada><Compras /></RotaPrivada>} />
          <Route path="/compras/nova" element={<RotaPrivada><NovaCompra /></RotaPrivada>} />
          <Route path="/compras/editar/:id" element={<RotaPrivada><NovaCompra /></RotaPrivada>} />
          
          <Route path="/financeiro" element={<RotaPrivada><Financeiro /></RotaPrivada>} />
          <Route path="/financeiro/novo" element={<RotaPrivada><NovoLancamento /></RotaPrivada>} />
          
          <Route path="/agenda" element={<RotaPrivada><Agenda /></RotaPrivada>} />
          <Route path="/logistica" element={<RotaPrivada><Logistica /></RotaPrivada>} />
          <Route path="/contratos" element={<RotaPrivada><Contratos /></RotaPrivada>} />
          <Route path="/novo-contrato" element={<RotaPrivada><NovoContrato /></RotaPrivada>} />
          <Route path="/modelos-contrato" element={<RotaPrivada><ModelosContrato /></RotaPrivada>} />
          <Route path="/editar-contrato/:id" element={<RotaPrivada><EditarContrato /></RotaPrivada>} />
          
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