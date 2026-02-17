import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const Dashboard = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS DO DASHBOARD ---
  const [estatisticas, setEstatisticas] = useState({
    acervo: 0, ativas: 0, eventos: 0, manutencao: 0
  });
  const [queridinhos, setQueridinhos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [categoriasData, setCategoriasData] = useState([]);
  const [faturamentoData, setFaturamentoData] = useState([0, 0, 0, 0]);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const hojeStr = new Date().toLocaleDateString('en-CA');

        // 1. BUSCAR ACERVO
        const estSnap = await getDocs(collection(db, "estoque"));
        const itens = estSnap.docs.map(d => d.data());
        
        // Agrupar categorias para o gráfico de Pizza
        const cats = {};
        itens.forEach(i => cats[i.categoria || 'Outros'] = (cats[i.categoria || 'Outros'] || 0) + 1);
        const catsArray = Object.entries(cats).map(([name, value]) => ({ name, value }));

        // 2. BUSCAR LOCAÇÕES
        const locSnap = await getDocs(collection(db, "locacoes"));
        const locs = locSnap.docs.map(d => d.data());
        const confirmadas = locs.filter(l => l.status === 'confirmado');

        // Simulação de faturamento semanal (distribuição visual)
        const fatSemanal = [0, 0, 0, 0];
        confirmadas.forEach(l => {
            // Distribui aleatoriamente nas 4 semanas para efeito visual
            const semana = Math.floor(Math.random() * 4); 
            fatSemanal[semana] += Number(l.valorTotal || 0);
        });

        // 3. RANKING (Top 5 Itens)
        const rankCount = {};
        locs.forEach(l => l.itens?.forEach(i => rankCount[i.nome] = (rankCount[i.nome] || 0) + i.qtd));
        const top5 = Object.entries(rankCount).sort((a,b) => b[1]-a[1]).slice(0,5);

        // 4. ATIVIDADES RECENTES
        const recents = locs.slice(-4).reverse().map(l => ({ 
            txt: `Nova locação: ${l.clienteNome || 'Cliente'}`, time: 'Recente' 
        }));

        // ATUALIZAR ESTADOS
        setEstatisticas({
            acervo: estSnap.size,
            ativas: confirmadas.length,
            eventos: confirmadas.filter(l => l.dataRetirada >= hojeStr).length,
            manutencao: itens.filter(i => i.status === 'manutencao').length
        });
        setCategoriasData(catsArray);
        setFaturamentoData(fatSemanal);
        setQueridinhos(top5);
        setAtividades(recents);
        setAlertas(locs.filter(l => l.status === 'confirmado' && l.dataDevolucao < hojeStr));

      } catch (e) { console.error("Erro dashboard:", e); }
    };
    carregarDados();
  }, []);

  // Cores do Gráfico de Pizza
  const CORES = ['#0f3460', '#e94560', '#16213e', '#533483', '#00bbf9'];

  return (
    <div className="dash-wide-container">
      
      {/* 1. CABEÇALHO + BOTÕES CORRIGIDOS */}
      <header className="dash-wide-header">
        <div className="header-titles">
          <h1>Olá, Camila!</h1>
          <p>Visão geral do sistema <strong>CELEBRE</strong>.</p>
        </div>
        <div className="dash-actions-row">
          <button onClick={() => navigate('/clientes/novo')}>👤 NOVO CLIENTE</button>
          <button onClick={() => navigate('/locacoes/nova')}>🛒 NOVA LOCAÇÃO</button>
          <button onClick={() => navigate('/estoque/novo')}>📦 NOVO ITEM</button>
          <button onClick={() => navigate('/fornecedores/novo')}>🚚 NOVO FORNECEDOR</button>
          <button onClick={() => navigate('/tarefas/nova')}>✅ NOVA TAREFA</button>
          <button onClick={() => navigate('/eventos/novo')}>🗓️ NOVO EVENTO</button>
        </div>
      </header>

      {/* 2. LINHA DE INDICADORES */}
      <div className="stats-wide-row">
        <div className="stat-card-wide border-gold"><span>ACERVO TOTAL</span><strong>{estatisticas.acervo}</strong></div>
        <div className="stat-card-wide border-blue"><span>LOCAÇÕES ATIVAS</span><strong>{estatisticas.ativas}</strong></div>
        <div className="stat-card-wide border-green"><span>PRÓXIMOS EVENTOS</span><strong>{estatisticas.eventos}</strong></div>
        <div className="stat-card-wide border-red"><span>EM MANUTENÇÃO</span><strong>{estatisticas.manutencao}</strong></div>
      </div>

      {/* 3. GRÁFICO DE BARRAS E RANKING */}
      <div className="dash-main-grid-wide">
        
        {/* GRÁFICO DE BARRAS */}
        <section className="dash-card-wide chart-card">
          <h3>💸 Faturamento Mensal (Previsão)</h3>
          <div className="css-bar-chart">
            {faturamentoData.map((val, idx) => (
              <div key={idx} className="bar-group">
                <div className="bar" style={{height: `${Math.min((val/1000)*100, 100)}%`}}></div>
                <span>Sem {idx+1}</span>
                <small>R$ {val}</small>
              </div>
            ))}
          </div>
        </section>

        {/* TOP 5 */}
        <section className="dash-card-wide ranking-card">
          <h3>🏆 Top 5 Itens</h3>
          <div className="ranking-list">
            {queridinhos.length > 0 ? queridinhos.map(([nome, qtd], i) => (
              <div key={i} className="rank-item">
                <div className="rank-pos">{i+1}</div>
                <div className="rank-info"><b>{nome}</b><span>{qtd} aluguéis</span></div>
              </div>
            )) : <p style={{textAlign:'center', color:'#ccc', marginTop: 20}}>Sem dados ainda.</p>}
          </div>
        </section>
      </div>

      {/* 4. PIZZA, ALERTAS E ATIVIDADES */}
      <div className="dash-bottom-grid-wide">
        
        {/* GRÁFICO DE PIZZA */}
        <section className="dash-card-wide">
            <h3>📦 Distribuição do Acervo</h3>
            <div className="pie-wrapper">
                <div className="pie-chart" style={{
                    background: categoriasData.length > 0 ? `conic-gradient(
                        ${categoriasData.map((c, i, arr) => {
                            const start = (arr.slice(0, i).reduce((a, b) => a + b.value, 0) / estatisticas.acervo) * 100;
                            const end = start + (c.value / estatisticas.acervo) * 100;
                            return `${CORES[i % CORES.length]} ${start}% ${end}%`;
                        }).join(', ')}
                    )` : '#eee'
                }}></div>
                <div className="pie-legend">
                    {categoriasData.slice(0,4).map((c, i) => (
                        <div key={i}><span style={{background: CORES[i%CORES.length]}}></span>{c.name} ({c.value})</div>
                    ))}
                </div>
            </div>
        </section>

        {/* PENDÊNCIAS */}
        <section className="dash-card-wide alert-card">
            <h3>⚠️ Pendências</h3>
            {alertas.length > 0 ? alertas.map((a, i) => (
                <div key={i} className="alert-row">Atraso: {a.clienteNome}</div>
            )) : <div className="ok-state">Nenhum atraso hoje!</div>}
        </section>

        {/* ATIVIDADES */}
        <section className="dash-card-wide">
            <h3>🕒 Últimas Atividades</h3>
            <div className="activity-feed">
                {atividades.length > 0 ? atividades.map((a, i) => (
                    <div key={i} className="feed-row"><span>●</span> {a.txt}</div>
                )) : <p style={{color:'#ccc'}}>Nenhuma atividade recente.</p>}
            </div>
        </section>
      </div>

    </div>
  );
};

export default Dashboard;