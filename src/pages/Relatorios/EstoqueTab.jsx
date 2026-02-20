import React from "react";
import "./EstoqueTab.css";

function EstoqueTab() {
  return (
    <div className="estoque">
      <h2>📦 Relatório de Estoque</h2>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantidade</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Balão Rosa</td>
            <td>50</td>
            <td>OK</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default EstoqueTab;
