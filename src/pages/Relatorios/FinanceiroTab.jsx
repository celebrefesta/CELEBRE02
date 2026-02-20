import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot } from "firebase/firestore";

const FinanceiroTab = () => {
  const [metricas, setMetricas] = useState({ faturamento: 0, despesas: 0, lucro: 0, pendente: 0 });

  useEffect(() => {
    const q = query(collection(db, "financeiro_lancamentos"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ ...doc.data() }));
      
      const faturamento = lista.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0);
      const despesas = lista.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0);
      const pendente = lista.filter(t => t.status === 'pendente').reduce((acc, t) => acc + Number(t.valor), 0);

      setMetricas({ faturamento, despesas, lucro: faturamento - despesas, pendente });
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="tab-financeiro-v3">
      <div className="rel-grid-topo">
        <div className="card-rel faturamento">
          <label>Faturamento Total</label>
          <h2>{metricas.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
          <p className="verde">Total recebido</p>
        </div>
        <div className="card-rel despesas">
          <label>Total Despesas</label>
          <h2>{metricas.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
          <p className="vermelho">{metricas.pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} pendentes</p>
        </div>
        <div className="card-rel lucro">
          <label>Lucro Líquido</label>
          <h2 className={metricas.lucro >= 0 ? "verde" : "vermelho"}>
            {metricas.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h2>
          <p>Resultado acumulado</p>
        </div>
      </div>

      <div className="rel-section-v3">
        <h3>📊 Saúde do Fluxo de Caixa</h3>
        <div className="grafico-barra-simples">
          <div className="label-graf">
             <span>Entradas vs Saídas</span>
             <span>{Math.round((metricas.faturamento / (metricas.faturamento + metricas.despesas || 1)) * 100)}%</span>
          </div>
          <div className="barra-fundo">
            <div 
              className="barra-preenchimento" 
              style={{ width: `${(metricas.faturamento / (metricas.faturamento + metricas.despesas || 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceiroTab;