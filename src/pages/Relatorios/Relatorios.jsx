import React, { useState } from "react";
import "./Relatorios.css";

import FinanceiroTab from "./FinanceiroTab";
import ClientesTab from "./ClientesTab";
import EstoqueTab from "./EstoqueTab";
import PedidosTab from "./PedidosTab";

function Relatorios() {
  const [activeTab, setActiveTab] = useState("financeiro");

  return (
    <div className="relatorios-container">
      <header className="rel-header-v3">
        <h1>📊 Relatórios Estratégicos</h1>
        <div className="tabs-v3">
          <button className={activeTab === "financeiro" ? "active" : ""} onClick={() => setActiveTab("financeiro")}>Financeiro</button>
          <button className={activeTab === "clientes" ? "active" : ""} onClick={() => setActiveTab("clientes")}>Clientes</button>
          <button className={activeTab === "estoque" ? "active" : ""} onClick={() => setActiveTab("estoque")}>Estoque</button>
          <button className={activeTab === "pedidos" ? "active" : ""} onClick={() => setActiveTab("pedidos")}>Pedidos</button>
        </div>
      </header>

      <div className="tab-content-v3">
        {activeTab === "financeiro" && <FinanceiroTab />}
        {activeTab === "clientes" && <ClientesTab />}
        {activeTab === "estoque" && <EstoqueTab />}
        {activeTab === "pedidos" && <PedidosTab />}
      </div>
    </div>
  );
}

export default Relatorios;