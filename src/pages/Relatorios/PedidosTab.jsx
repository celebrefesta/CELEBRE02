import React from "react";
import "./PedidosTab.css";

function PedidosTab() {
  return (
    <div className="pedidos">
      <h2>📝 Relatório de Pedidos</h2>

      <table>
        <thead>
          <tr>
            <th>Nº Pedido</th>
            <th>Cliente</th>
            <th>Data</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>#0012</td>
            <td>Carla Mendes</td>
            <td>12/05/2025</td>
            <td>Pendente</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default PedidosTab;
