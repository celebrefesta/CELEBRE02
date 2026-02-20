import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot } from "firebase/firestore";

const ClientesTab = () => {
  const [metricas, setMetricas] = useState({ total: 0, inativos: 0, ticketMedio: 0 });
  const [rankingCidades, setRankingCidades] = useState([]);

  useEffect(() => {
    const qLocacoes = query(collection(db, "locacoes"));
    const unsubscribe = onSnapshot(qLocacoes, (snapshot) => {
      const locacoes = snapshot.docs.map(doc => doc.data());
      const cidadesCount = {};
      const clientesUltimaLocacao = {};
      let somaTotal = 0;

      locacoes.forEach(loc => {
        const cidade = loc.logistica?.cidade || "Retirada na Loja";
        cidadesCount[cidade] = (cidadesCount[cidade] || 0) + 1;
        somaTotal += Number(loc.valorTotal || 0);

        const dataLoc = new Date(loc.dataRetirada);
        if (!clientesUltimaLocacao[loc.clienteId] || dataLoc > clientesUltimaLocacao[loc.clienteId]) {
          clientesUltimaLocacao[loc.clienteId] = dataLoc;
        }
      });

      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
      const inativos = Object.values(clientesUltimaLocacao).filter(d => d < seisMesesAtras).length;

      setMetricas({
        total: Object.keys(clientesUltimaLocacao).length,
        inativos,
        ticketMedio: locacoes.length > 0 ? (somaTotal / locacoes.length) : 0
      });

      setRankingCidades(Object.entries(cidadesCount).sort((a, b) => b[1] - a[1]).slice(0, 5));
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="tab-clientes-premium">
      {/* --- CARDS DE MÉTRICAS --- */}
      <div className="rel-grid-topo">
        <div className="card-kpi blue">
          <div className="kpi-icon"><i className="fas fa-user-friends"></i></div>
          <div className="kpi-info">
            <label>Total de Clientes</label>
            <h2>{metricas.total}</h2>
          </div>
        </div>

        <div className="card-kpi green">
          <div className="kpi-icon"><i className="fas fa-chart-line"></i></div>
          <div className="kpi-info">
            <label>Ciclo de Vida (LTV)</label>
            <h2>{metricas.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
          </div>
        </div>

        <div className="card-kpi red">
          <div className="kpi-icon"><i className="fas fa-user-clock"></i></div>
          <div className="kpi-info">
            <label>Inativos (+6 meses)</label>
            <h2>{metricas.inativos}</h2>
          </div>
        </div>
      </div>

      {/* --- SEÇÃO DE RANKING VISUAL --- */}
      <div className="rel-section-main">
        <div className="ranking-header">
          <i className="fas fa-map-marker-alt icon-title"></i>
          <h3>Concentração por Região (Bairros/Cidades)</h3>
        </div>
        
        <div className="ranking-bars-container">
          {rankingCidades.map(([cidade, total], i) => (
            <div key={i} className="ranking-row">
              <div className="row-label">
                <span className="cidade-nome">{cidade}</span>
                <span className="cidade-valor">{total} locações</span>
              </div>
              <div className="progress-bg">
                <div 
                  className="progress-fill-premium" 
                  style={{ width: `${(total / rankingCidades[0][1]) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
          {rankingCidades.length === 0 && <p className="empty">Nenhum dado geográfico disponível.</p>}
        </div>
      </div>
    </div>
  );
};

export default ClientesTab;