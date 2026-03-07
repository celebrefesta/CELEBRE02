import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// --- MENU & TOPBAR ---
import Navbar from './components/Navbar';
import Topbar from './components/Topbar'; // 🔥 IMPORTAÇÃO DA BARRA SUPERIOR AQUI 🔥
import './App.css';

// --- PÁGINAS ---
import Dashboard from './pages/Dashboard/Dashboard';
import Clientes from './pages/Clientes/Clientes';
import CadastroCliente from './pages/Clientes/CadastroCliente'; 

// 🔥 CAMINHO 100% CORRIGIDO BASEADO NA SUA FOTO 🔥
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
  
  // 🌟 Esconde o menu mestre na Assinatura, Catálogo, Visualizar e AUTOCADASTRO 🌟
  const showNavbar = !location.pathname.includes('/assinatura') && 
                     !location.pathname.includes('/catalogo') &&
                     !location.pathname.includes('/visualizar') &&
                     !location.pathname.includes('/autocadastro'); 

  return (
    <div className={`App ${!showNavbar ? 'no-navbar' : ''}`}>
      {showNavbar && <Navbar />}
      
      <main className="main-content">
        
        {/* 🔥 BARRA SUPERIOR EXIBIDA AQUI (Só aparece se o menu lateral também estiver visível) 🔥 */}
        {showNavbar && <Topbar />}

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cadastro-cliente" element={<CadastroCliente />} />
          
          {/* 🔥 ROTA OFICIAL DO CATÁLOGO PARA O CLIENTE 🔥 */}
          <Route path="/autocadastro" element={<AutoCadastro />} /> 
          
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/cadastro-estoque" element={<CadastroEstoque />} />
          
          <Route path="/locacoes" element={<Locacoes />} />
          <Route path="/locacoes/nova" element={<NovaLocacao />} />
          <Route path="/locacoes/editar/:id" element={<EditarLocacao />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/fornecedores/novo" element={<NovoFornecedor />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/compras/nova" element={<NovaCompra />} />
          <Route path="/compras/editar/:id" element={<NovaCompra />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/financeiro/novo" element={<NovoLancamento />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/novo-contrato" element={<NovoContrato />} />
          <Route path="/modelos-contrato" element={<ModelosContrato />} />
          <Route path="/editar-contrato/:id" element={<EditarContrato />} />
          <Route path="/assinatura/:id" element={<AssinaturaContrato />} />
          <Route path="/visualizar/:id" element={<VisualizarContrato />} /> 
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/moodboard" element={<Moodboard />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/perfil" element={<Perfil />} />
          
          {/* 🔥 ROTA DE NOTIFICAÇÕES AQUI 🔥 */}
          <Route path="/notificacoes" element={<Notificacoes />} /> 
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