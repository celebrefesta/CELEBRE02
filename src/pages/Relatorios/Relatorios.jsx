import React, { useState } from "react";
import "./Relatorios.css";

// Importando as partes separadas (Crie esses arquivos na mesma pasta!)
import FinanceiroTab from "./FinanceiroTab";
import AcervoTab from "./AcervoTab";
import ClientesTab from "./ClientesTab";
import PedidosTab from "./PedidosTab";

const Relatorios = () => {
  const [abaAtiva, setAbaAtiva] = useState('financeiro');

  return (
    <div className="relatorios-page">
      <header className="rel-header">
        <div>
            <h1>Relatórios Estratégicos🚀</h1>
            <p>Tudo aqui atualiza automaticamente!</p>
        </div>
        <div className="tabs">
            <button className={abaAtiva === 'financeiro' ? 'active' : ''} onClick={() => setAbaAtiva('financeiro')}>💰 Financeiro</button>
            <button className={abaAtiva === 'clientes' ? 'active' : ''} onClick={() => setAbaAtiva('clientes')}>👥 Clientes</button>
            <button className={abaAtiva === 'acervo' ? 'active' : ''} onClick={() => setAbaAtiva('acervo')}>📦 Acervo</button>
            <button className={abaAtiva === 'pedidos' ? 'active' : ''} onClick={() => setAbaAtiva('pedidos')}>📝 Pedidos</button>
        </div>
      </header>

      {/* Renderização Condicional Limpa */}
      <div className="tab-content fade-in">
        {abaAtiva === 'financeiro' && <FinanceiroTab />}
        {abaAtiva === 'acervo' && <AcervoTab />}
        {abaAtiva === 'clientes' && <ClientesTab />}
        {abaAtiva === 'pedidos' && <PedidosTab />}
      </div>
    </div>
  );
};

export default Relatorios;