import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// --- MENU ---
import Navbar from './components/Navbar'; // Assumindo que este é o seu menu lateral
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
import NovaCompra from './pages/Compras/NovaCompra';
import Financeiro from './pages/Financeiro/Financeiro';

// --- OPERACIONAL ---
import Agenda from './pages/Agenda/Agenda';
import Logistica from './pages/Logistica/Logistica';
import Contratos from './pages/Contratos/Contratos';
import NovoContrato from "./pages/Contratos/NovoContrato";
import EditarContrato from "./pages/Contratos/EditarContrato";
import AssinaturaContrato from "./pages/Contratos/AssinaturaContrato";
import ModelosContrato from "./pages/Contratos/ModelosContrato";

// --- GESTÃO ---
import Relatorios from './pages/Relatorios/Relatorios';
import Configuracoes from './pages/Configuracoes/Configuracoes';
import Perfil from './pages/Perfil/Perfil';
import Moodboard from './pages/Moodboard/Moodboard';

// Componente interno para lidar com a lógica de rotas e layout
const AppContent = () => {
  const location = useLocation();
  
  // Verifica se deve mostrar o menu (esconde na página de assinatura)
  const showNavbar = !location.pathname.includes('/assinatura');

  return (
    <div className="App">
      {/* Menu Lateral (Fixo) */}
      {showNavbar && <Navbar />}
      
      {/* ÁREA DE CONTEÚDO PRINCIPAL 
         Aqui está a mágica: 'marginLeft' empurra o conteúdo para não ficar atrás do menu 
      */}
      <main 
        style={{ 
          marginLeft: showNavbar ? '260px' : '0', // Só empurra se o menu estiver visível
          width: showNavbar ? 'calc(100% - 260px)' : '100%', 
          minHeight: '100vh',
          backgroundColor: '#f1f5f9',
          padding: '20px',
          transition: 'all 0.3s ease' // Suaviza a transição se o menu sumir
        }}
      >
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
          <Route path="/assinatura/:id" element={<AssinaturaContrato />} />

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

// Componente Principal que envolve tudo no Router ( toda largura da pagina foi configurada e lacrada aqui))
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;