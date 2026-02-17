import React, { useState, useEffect } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const Relatorios = () => {
  const [dados, setDados] = useState({
    totalFaturado: 0,
    qtdLocacoes: 0,
    qtdClientes: 0,
    topItens: []
  });

  useEffect(() => {
    // Busca dados reais das outras páginas
    const locacoes = JSON.parse(localStorage.getItem('locacoes')) || [];
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    
    const faturamento = locacoes.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

    setDados({
      totalFaturado: faturamento,
      qtdLocacoes: locacoes.length,
      qtdClientes: clientes.length,
      topItens: [] // Isso será preenchido conforme você associar itens às locações
    });
  }, []);

  // Gráfico de Comparação Mensal (Zera até ter dados de meses diferentes)
  const barData = {
    labels: ['Janeiro', 'Fevereiro', 'Março', 'Abril'],
    datasets: [
      {
        label: 'Faturamento Mensal (R$)',
        data: [0, dados.totalFaturado, 0, 0], // Foca no mês atual (Fevereiro)
        backgroundColor: '#0f233a',
        borderRadius: 5,
      },
    ],
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: '#0f233a', marginBottom: '20px' }}>Relatórios e Performance</h2>

      {/* CARDS DE INDICADORES REAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TIQUETE MÉDIO</span>
          <h4 style={{ margin: '5px 0', color: '#0f233a' }}>
            R$ {dados.qtdLocacoes > 0 ? (dados.totalFaturado / dados.qtdLocacoes).toFixed(2) : '0,00'}
          </h4>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>TOTAL DE CLIENTES</span>
          <h4 style={{ margin: '5px 0', color: '#0f233a' }}>{dados.qtdClientes}</h4>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>CONTRATOS FECHADOS</span>
          <h4 style={{ margin: '5px 0', color: '#0f233a' }}>{dados.qtdLocacoes}</h4>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>FATURAMENTO ANUAL</span>
          <h4 style={{ margin: '5px 0', color: '#10b981' }}>R$ {dados.totalFaturado.toFixed(2)}</h4>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* GRÁFICO DE BARRAS */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '20px' }}>Comparativo Mensal</h3>
          <Bar data={barData} />
        </div>

        {/* RANKING DE PEÇAS MAIS ALUGADAS */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '20px' }}>Top Peças (Acervo)</h3>
          {dados.topItens.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px', fontSize: '0.9rem' }}>
              Aguardando dados de locações para gerar o ranking.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {/* Lista será preenchida automaticamente no futuro */}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Relatorios;