import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// --- MENU ---
import Navbar from './components/Navbar';
import './App.css';

// --- PÁGINAS ---
import Dashboard from './pages/Dashboard/Dashboard';
import Clientes from './pages/Clientes/Clientes';
import CadastroCliente from './pages/Clientes/CadastroCliente';
import Estoque from './pages/Estoque/Estoque';
import NovoItem from './pages/Estoque/NovoItem';

// --- LOCAÇÕES ---
import Locacoes from './pages/Locacoes/Locacoes';
import NovaLocacao from './pages/Locacoes/NovaLocacao';
import EditarLocacao from './pages/Locacoes/EditarLocacao';

// --- FINANCEIRO & COMPRAS ---
import Fornecedores from './pages/Fornecedores/Fornecedores';
import NovoFornecedor from './pages/Fornecedores/NovoFornecedor';
import Compras from './pages/Compras/Compras'; 
import NovaCompra from './pages/Compras/NovaCompra';// <--- AQUI ESTÁ A MÁGICA
import Financeiro from './pages/Financeiro/Financeiro';

// --- OPERACIONAL ---
import Agenda from './pages/Agenda/Agenda';
import Logistica from './pages/Logistica/Logistica';
import Contratos from './pages/Contratos/Contratos';
import NovoContrato from "./pages/Contratos/NovoContrato";
import EditarContrato from "./pages/Contratos/EditarContrato";
import Assinatura from './pages/Contratos/Assinatura';
import ModelosContrato from "./pages/Contratos/ModelosContrato";

// --- GESTÃO ---
import Relatorios from './pages/Relatorios/Relatorios';
import Configuracoes from './pages/Configuracoes/Configuracoes';
import Perfil from './pages/Perfil/Perfil';
import Moodboard from './pages/Moodboard/Moodboard';


const AppContent = () => {
  const location = useLocation();
  // Esconde o menu se estiver na página de assinatura
  const showNavbar = location.pathname !== '/assinatura';

  return (
    <div className="App" style={{ display: 'flex', minHeight: '100vh' }}>
      {showNavbar && <Navbar />}
      
      <main style={{ flex: 1, padding: '20px', overflowX: 'hidden' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          
          {/* CLIENTES */}
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/novo" element={<CadastroCliente />} />
          
          {/* ESTOQUE */}
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/estoque/novo" element={<NovoItem />} />
          
          {/* LOCAÇÕES */}
          <Route path="/locacoes" element={<Locacoes />} />
          <Route path="/locacoes/nova" element={<NovaLocacao />} />
          <Route path="/locacoes/editar/:id" element={<EditarLocacao />} />

          {/* FINANCEIRO E COMPRAS */}
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/fornecedores/novo" element={<NovoFornecedor />} />
         <Route path="/compras" element={<Compras />} />
         <Route path="/compras/nova" element={<NovaCompra />} />
        <Route path="/compras/editar/:id" element={<NovaCompra />} />
               
          <Route path="/financeiro" element={<Financeiro />} />
          
          {/* OPERACIONAL */}
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/logistica" element={<Logistica />} />
          
          {/* CONTRATOS */}
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/novo-contrato" element={<NovoContrato />} />
          <Route path="/modelos-contrato" element={<ModelosContrato />} />
          <Route path="/editar-contrato/:id" element={<EditarContrato />} />
          <Route path="/assinatura" element={<Assinatura />} />

          {/* GESTÃO */}
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/moodboard" element={<Moodboard />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/perfil" element={<Perfil />} />
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