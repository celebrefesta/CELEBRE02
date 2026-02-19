import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, query } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#0f172a', '#c5a059', '#64748b', '#94a3b8', '#e2e8f0'];
const limparValor = (v) => parseFloat(v?.toString().replace(/[^\d,-]/g, '').replace(',', '.') || 0);

const AcervoTab = () => {
  const [acervo, setAcervo] = useState({ total: 0, valor: 0, grafico: [], topItens: [] });

  useEffect(() => {
    const carregar = async () => {
        const snap = await getDocs(query(collection(db, "estoque")));
        let totalVal = 0;
        const cats = {};
        const itens = snap.docs.map(d => {
            const val = limparValor(d.data().valorCompra || d.data().custo || d.data().preco || 0);
            totalVal += val;
            const c = d.data().categoria || "Geral";
            cats[c] = (cats[c] || 0) + 1;
            return { nome: d.data().nome, categoria: c, valor: val };
        });

        setAcervo({
            total: itens.length,
            valor: totalVal,
            grafico: Object.keys(cats).map(k => ({ name: k, value: cats[k] })),
            topItens: itens.sort((a,b) => b.valor - a.valor).slice(0, 10)
        });
    };
    carregar();
  }, []);

  return (
    <div>
        <div className="kpi-row">
            <div className="kpi-card"><span>TOTAL DE PEÇAS</span><h3>{acervo.total}</h3></div>
            <div className="kpi-card"><span>VALOR PATRIMONIAL</span><h3 className="dourado">R$ {acervo.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
        </div>
        <div className="chart-cols">
            <div className="chart-box">
                <h3>💎 Itens Mais Valiosos</h3>
                <table className="dre-table">
                    <thead><tr><th>Item</th><th>Valor</th></tr></thead>
                    <tbody>{acervo.topItens.map((i,x)=>(<tr key={x}><td>{i.nome}</td><td className="val">R$ {i.valor.toLocaleString('pt-BR')}</td></tr>))}</tbody>
                </table>
            </div>
            <div className="chart-box">
                <h3>Categorias</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={acervo.grafico} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>{acervo.grafico.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
  );
};
export default AcervoTab;