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
  const [alertas, setAlertas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [faturamentoData, setFaturamentoData] = useState([0, 0, 0, 0]);
  const [proximosEventos, setProximosEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const hojeISO = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const mesAtual = hojeISO.substring(0, 7); // YYYY-MM

        // 1. BUSCAR ACERVO
        const estSnap = await getDocs(collection(db, "estoque"));
        const itens = estSnap.docs.map(d => d.data());
        
        // 2. BUSCAR LOCAÇÕES
        const locSnap = await getDocs(collection(db, "locacoes"));
        const locs = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const confirmadas = locs.filter(l => l.status === 'confirmado');

        // 3. FATURAMENTO REAL (Semanas do Mês Atual)
        const fatSemanal = [0, 0, 0, 0];
        confirmadas.forEach(l => {
            if (l.dataRetirada && l.dataRetirada.startsWith(mesAtual)) {
                const dia = parseInt(l.dataRetirada.split('-')[2]);
                const valor = Number(l.valorTotal) || 0;
                
                if (dia <= 7) fatSemanal[0] += valor;
                else if (dia <= 14) fatSemanal[1] += valor;
                else if (dia <= 21) fatSemanal[2] += valor;
                else fatSemanal[3] += valor;
            }
        });

        // 4. ATIVIDADES RECENTES (Últimas Locações Feitas)
        const recents = locs
            .sort((a, b) => {
                const dataA = a.criadoEm?.seconds ? a.criadoEm.seconds : 0;
                const dataB = b.criadoEm?.seconds ? b.criadoEm.seconds : 0;
                return dataB - dataA; 
            })
            .slice(0, 5)
            .map(l => ({ 
                txt: `${l.clienteNome || 'Cliente Não Informado'}`, 
                valor: l.valorTotal ? `R$ ${Number(l.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : ''
            }));

        // 5. PRÓXIMAS ENTREGAS / EVENTOS 
        const proximos = confirmadas
            .filter(l => l.dataRetirada && l.dataRetirada >= hojeISO)
            .sort((a, b) => a.dataRetirada.localeCompare(b.dataRetirada))
            .slice(0, 5)
            .map(l => ({
                id: l.id,
                cliente: l.clienteNome || 'Cliente',
                data: l.dataRetirada.split('-').reverse().join('/'),
                cidade: l.logistica?.cidade || 'Retirada na Loja'
            }));

        // ATUALIZAR ESTADOS
        setEstatisticas({
            acervo: estSnap.size,
            ativas: confirmadas.length,
            eventos: confirmadas.filter(l => l.dataRetirada >= hojeISO).length,
            manutencao: itens.filter(i => i.status === 'manutencao').length
        });
        
        setFaturamentoData(fatSemanal);
        setAtividades(recents);
        setProximosEventos(proximos);
        
        // ALERTAS REAIS: Confirmadas com devolução atrasada
        setAlertas(locs.filter(l => l.status === 'confirmado' && l.dataDevolucao && l.dataDevolucao < hojeISO));

      } catch (e) { 
        console.error("Erro dashboard:", e); 
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  if (loading) return <div className="loading-v3">Atualizando seu painel...</div>;

  const maxFat = Math.max(...faturamentoData, 1); 

  return (
    <div className="dash-wide-container fade-in">
      
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

      <div className="stats-wide-row">
        <div className="stat-card-wide border-gold"><span>ACERVO TOTAL</span><strong>{estatisticas.acervo}</strong></div>
        <div className="stat-card-wide border-blue"><span>LOCAÇÕES ATIVAS</span><strong>{estatisticas.ativas}</strong></div>
        <div className="stat-card-wide border-green"><span>PRÓXIMOS EVENTOS</span><strong>{estatisticas.eventos}</strong></div>
        <div className="stat-card-wide border-red"><span>EM MANUTENÇÃO</span><strong>{estatisticas.manutencao}</strong></div>
      </div>

      {alertas.length > 0 && (
        <div className="dash-alertas-banner">
          <div className="alertas-header">
            <h3>⚠️ AVISO: DEVOLUÇÕES EM ATRASO</h3>
            <span>{alertas.length} pendência(s)</span>
          </div>
          <div className="alertas-grid">
            {alertas.map((a, i) => (
              /* 🚨 ROTA CORRIGIDA PARA "/locacoes/editar/ID" 🚨 */
              <div key={i} className="alerta-item" onClick={() => navigate(`/locacoes/editar/${a.id}`)}>
                <strong>{a.clienteNome}</strong>
                <span>Previsto para: {a.dataDevolucao.split('-').reverse().join('/')}</span>
                <button>Resolver Pendência</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dash-main-grid-wide" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        
        {/* QUADRO 1: FATURAMENTO */}
        <section className="dash-card-wide chart-card">
          <h3>💸 Faturamento do Mês</h3>
          <div className="compact-chart">
            {faturamentoData.map((val, idx) => (
              <div key={idx} className="compact-bar-group">
                <span className="compact-bar-label">Sem {idx+1}</span>
                <div className="compact-bar-track">
                  <div className="compact-bar-fill" style={{width: `${(val / maxFat) * 100}%`}}></div>
                </div>
                <span className="compact-bar-value">R$ {val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
              </div>
            ))}
          </div>
        </section>

        {/* QUADRO 2: PRÓXIMAS ENTREGAS */}
        <section className="dash-card-wide agenda-card">
          <h3>🚚 Próximas Entregas</h3>
          <div className="activity-feed">
            {proximosEventos.length > 0 ? proximosEventos.map((ev, i) => (
              /* 🚨 ROTA CORRIGIDA AQUI TAMBÉM 🚨 */
              <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${ev.id}`)} style={{cursor: 'pointer'}}>
                <div className="feed-icon box-green">📅</div>
                <div className="feed-info">
                  <p>{ev.cliente}</p>
                  <span className="feed-sub">📍 {ev.cidade} • <strong>{ev.data}</strong></span>
                </div>
              </div>
            )) : <p style={{color:'#94a3b8', textAlign: 'center', marginTop: '20px'}}>Sua agenda está livre!</p>}
          </div>
        </section>

        {/* QUADRO 3: ÚLTIMAS LOCAÇÕES FEITAS */}
        <section className="dash-card-wide">
          <h3>🛒 Últimas Vendas</h3>
          <div className="activity-feed">
            {atividades.length > 0 ? atividades.map((a, i) => (
              <div key={i} className="feed-row-moderno">
                <div className="feed-icon box-blue">🛍️</div>
                <div className="feed-info">
                  <p>{a.txt}</p>
                  {a.valor && <span className="feed-valor">{a.valor}</span>}
                </div>
              </div>
            )) : <p style={{color:'#94a3b8', textAlign: 'center', marginTop: '20px'}}>Nenhuma venda recente.</p>}
          </div>
        </section>

      </div>
    </div>
  );
};

export default Dashboard;