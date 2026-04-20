import React, { useState } from 'react';
import './Relatorios.css';

import FinanceiroTab from './FinanceiroTab';
import ClientesTab from './ClientesTab';
import EstoqueTab from './EstoqueTab';
import PedidosTab from './PedidosTab';

const Relatorios = () => {
  const [activeTab, setActiveTab] = useState('financeiro');

  return (
    <div className="dashboard-container">
      
      {/* CABEÇALHO OTIMIZADO: Título e Abas na mesma linha */}
      <div className="dashboard-header relatorios-header-ajuste">
        <div className="header-text">
          <h1>RELATÓRIOS ESTRATÉGICOS</h1>
          <p>Acompanhe a saúde financeira e o desempenho do seu acervo.</p>
        </div>

        <div className="tabs-relatorios-compacto">
          <button 
            className={activeTab === 'financeiro' ? 'active' : ''} 
            onClick={() => setActiveTab('financeiro')}
          >
            💰 Financeiro
          </button>
          <button 
            className={activeTab === 'clientes' ? 'active' : ''} 
            onClick={() => setActiveTab('clientes')}
          >
            👥 Clientes
          </button>
          <button 
            className={activeTab === 'estoque' ? 'active' : ''} 
            onClick={() => setActiveTab('estoque')}
          >
            📦 Estoque
          </button>
          <button 
            className={activeTab === 'pedidos' ? 'active' : ''} 
            onClick={() => setActiveTab('pedidos')}
          >
            📑 Pedidos
          </button>
        </div>
      </div>

      <div className="relatorio-content">
        {activeTab === 'financeiro' && <FinanceiroTab />}
        {activeTab === 'clientes' && <ClientesTab />}
        {activeTab === 'estoque' && <EstoqueTab />}
        {activeTab === 'pedidos' && <PedidosTab />}
      </div>
      
    </div>
  );
};

export default Relatorios;