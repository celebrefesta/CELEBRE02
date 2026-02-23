import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const Dashboard = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS DO DASHBOARD ---
  const [estatisticas, setEstatisticas] = useState({
    acervo: 0, ativas: 0, eventos: 0, manutencao: 0, aReceber: 0
  });
  const [alertas, setAlertas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [faturamentoData, setFaturamentoData] = useState([0, 0, 0, 0]);
  const [proximosEventos, setProximosEventos] = useState([]);
  const [orcamentosPendentes, setOrcamentosPendentes] = useState([]);
  
  // 🌟 NOVO: ESTADO PARA O GRÁFICO DONUT 🌟
  const [statusChart, setStatusChart] = useState({
    orcamento: 0, confirmado: 0, andamento: 0, concluido: 0, total: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const hojeISO = new Date().toISOString().split('T')[0];
        const mesAtual = hojeISO.substring(0, 7);

        // 1. BUSCAR ACERVO
        const estSnap = await getDocs(collection(db, "estoque"));
        const itens = estSnap.docs.map(d => d.data());
        
        // 2. BUSCAR LOCAÇÕES
        const locSnap = await getDocs(collection(db, "locacoes"));
        const locs = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const confirmadas = locs.filter(l => l.status === 'confirmado');
        const orcamentos = locs.filter(l => (l.status || '').toLowerCase() === 'orcamento');

        // 🌟 NOVO: DADOS PARA O GRÁFICO DE ROSCA 🌟
        let cOrcamento = 0, cConfirmado = 0, cAndamento = 0, cConcluido = 0;
        locs.forEach(l => {
          const s = (l.status || '').toLowerCase();
          if (s === 'orcamento') cOrcamento++;
          else if (s === 'confirmado') cConfirmado++;
          else if (s === 'preparacao' || s === 'entregue') cAndamento++;
          else if (s === 'finalizado') cConcluido++;
        });

        setStatusChart({
          orcamento: cOrcamento,
          confirmado: cConfirmado,
          andamento: cAndamento,
          concluido: cConcluido,
          total: cOrcamento + cConfirmado + cAndamento + cConcluido
        });

        // 3. FATURAMENTO E A RECEBER
        const fatSemanal = [0, 0, 0, 0];
        let totalAReceber = 0;

        confirmadas.forEach(l => {
            if (l.dataRetirada && l.dataRetirada.startsWith(mesAtual)) {
                const dia = parseInt(l.dataRetirada.split('-')[2]);
                const valor = Number(l.valorTotal) || 0;
                
                if (dia <= 7) fatSemanal[0] += valor;
                else if (dia <= 14) fatSemanal[1] += valor;
                else if (dia <= 21) fatSemanal[2] += valor;
                else fatSemanal[3] += valor;
            }

            const valorTotal = Number(l.valorTotal || 0);
            const valorPago = Number(l.valorPago || 0);
            if (valorTotal > valorPago) {
              totalAReceber += (valorTotal - valorPago);
            }
        });

        // 4. ATIVIDADES RECENTES
        const recents = confirmadas
            .sort((a, b) => {
                const dataA = a.criadoEm?.seconds ? a.criadoEm.seconds : 0;
                const dataB = b.criadoEm?.seconds ? b.criadoEm.seconds : 0;
                return dataB - dataA; 
            })
            .slice(0, 4)
            .map(l => ({ 
                txt: `${l.clienteNome || 'Cliente Não Informado'}`, 
                valor: l.valorTotal ? `R$ ${Number(l.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : ''
            }));

        // 5. PRÓXIMAS ENTREGAS
        const proximos = confirmadas
            .filter(l => l.dataRetirada && l.dataRetirada >= hojeISO)
            .sort((a, b) => a.dataRetirada.localeCompare(b.dataRetirada))
            .slice(0, 4)
            .map(l => ({
                id: l.id,
                cliente: l.clienteNome || 'Cliente',
                data: l.dataRetirada.split('-').reverse().join('/'),
                cidade: l.logistica?.cidade || 'Retirada na Loja'
            }));

        // 6. ORÇAMENTOS PENDENTES
        const orcamentosRecentes = orcamentos
            .sort((a, b) => {
                const dataA = a.criadoEm?.seconds ? a.criadoEm.seconds : 0;
                const dataB = b.criadoEm?.seconds ? b.criadoEm.seconds : 0;
                return dataB - dataA; 
            })
            .slice(0, 4);

        // ATUALIZAR ESTADOS
        setEstatisticas({
            acervo: estSnap.size,
            ativas: confirmadas.length,
            eventos: confirmadas.filter(l => l.dataRetirada >= hojeISO).length,
            manutencao: itens.filter(i => i.status === 'manutencao').length,
            aReceber: totalAReceber
        });
        
        setFaturamentoData(fatSemanal);
        setAtividades(recents);
        setProximosEventos(proximos);
        setOrcamentosPendentes(orcamentosRecentes);
        
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

  // 🌟 MÁTEMATICA DO GRÁFICO SVG NATIVO 🌟
  const totalG = statusChart.total || 1; 
  const p1 = (statusChart.orcamento / totalG) * 100;
  const p2 = (statusChart.confirmado / totalG) * 100;
  const p3 = (statusChart.andamento / totalG) * 100;
  const p4 = (statusChart.concluido / totalG) * 100;

  const off1 = 0;
  const off2 = 100 - p1;
  const off3 = 100 - (p1 + p2);
  const off4 = 100 - (p1 + p2 + p3);

  return (
    <div className="dash-wide-container fade-in">
      
      <header className="dash-wide-header">
        <div className="header-titles">
          <h1>Olá, Camila!</h1>
          <p>Visão geral do sistema <strong>CELEBRE</strong>.</p>
        </div>
        
        <div className="dash-actions-row">
          <button onClick={() => navigate('/cadastro-cliente')}>👤 NOVO CLIENTE</button>
          <button onClick={() => navigate('/locacoes/nova')}>🛒 NOVA LOCAÇÃO</button>
          <button onClick={() => navigate('/cadastro-estoque')}>📦 NOVO ITEM</button>
          <button onClick={() => navigate('/compras/nova')}>💰 NOVA COMPRA</button>
        </div>
      </header>

      <div className="stats-wide-row">
        <div className="stat-card-wide border-gold"><span>ACERVO TOTAL</span><strong>{estatisticas.acervo}</strong></div>
        <div className="stat-card-wide border-blue"><span>LOCAÇÕES ATIVAS</span><strong>{estatisticas.ativas}</strong></div>
        <div className="stat-card-wide border-green"><span>PRÓXIMOS EVENTOS</span><strong>{estatisticas.eventos}</strong></div>
        <div className="stat-card-wide border-red">
          <span>A RECEBER (R$)</span>
          <strong style={{color: '#dc2626'}}>R$ {estatisticas.aReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="dash-alertas-banner">
          <div className="alertas-header">
            <h3>⚠️ AVISO: DEVOLUÇÕES EM ATRASO</h3>
            <span>{alertas.length} pendência(s)</span>
          </div>
          <div className="alertas-grid">
            {alertas.map((a, i) => (
              <div key={i} className="alerta-item" onClick={() => navigate(`/locacoes/editar/${a.id}`)}>
                <strong>{a.clienteNome}</strong>
                <span>Previsto para: {a.dataDevolucao.split('-').reverse().join('/')}</span>
                <button>Resolver Pendência</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dash-main-grid-wide" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* COLUNA 1: FINANCEIRO E VENDAS */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <section className="dash-card-wide chart-card">
            <h3>💸 Faturamento do Mês</h3>
            <div className="compact-chart" style={{marginTop: '15px'}}>
              {faturamentoData.map((val, idx) => (
                <div key={idx} className="compact-bar-group" style={{display: 'flex', alignItems: 'center', marginBottom: '12px'}}>
                  <span className="compact-bar-label" style={{width: '50px', fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold'}}>Sem {idx+1}</span>
                  {/* 🌟 GRÁFICO DE BARRAS MELHORADO COM GRADIENTE 🌟 */}
                  <div className="compact-bar-track" style={{flex: 1, height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', margin: '0 15px'}}>
                    <div className="compact-bar-fill" style={{width: `${(val / maxFat) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #1e3a8a)', borderRadius: '6px', transition: 'width 1s ease-in-out'}}></div>
                  </div>
                  <span className="compact-bar-value" style={{fontWeight: 'bold', color: '#0f172a', width: '90px', textAlign: 'right'}}>R$ {val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dash-card-wide" style={{borderTop: '4px solid #f59e0b'}}>
            <h3>📝 Orçamentos Abertos</h3>
            <p style={{fontSize: '0.8rem', color: '#64748b', marginTop: '-5px', marginBottom: '15px'}}>Feche esses negócios para aumentar o caixa.</p>
            <div className="activity-feed">
              {orcamentosPendentes.length > 0 ? orcamentosPendentes.map((orc, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${orc.id}`)} style={{cursor: 'pointer'}}>
                  <div className="feed-icon" style={{background: '#fef3c7', color: '#b45309'}}>🔔</div>
                  <div className="feed-info">
                    <p>{orc.clienteNome || 'Sem Nome'}</p>
                    <span className="feed-sub">Festa: {orc.dataRetirada ? orc.dataRetirada.split('-').reverse().join('/') : '?'}</span>
                  </div>
                </div>
              )) : <p style={{color:'#94a3b8', textAlign: 'center'}}>Nenhum orçamento pendente.</p>}
            </div>
          </section>
        </div>

        {/* COLUNA 2: LOGÍSTICA E STATUS GERAL */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <section className="dash-card-wide agenda-card">
            <h3>🚚 Próximas Entregas / Saídas</h3>
            <div className="activity-feed">
              {proximosEventos.length > 0 ? proximosEventos.map((ev, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate('/logistica')} style={{cursor: 'pointer'}}>
                  <div className="feed-icon box-green">📤</div>
                  <div className="feed-info">
                    <p>{ev.cliente}</p>
                    <span className="feed-sub">📍 {ev.cidade} • <strong>{ev.data}</strong></span>
                  </div>
                </div>
              )) : <p style={{color:'#94a3b8', textAlign: 'center'}}>Nenhuma saída prevista.</p>}
            </div>
          </section>

          {/* 🌟 NOVO GRÁFICO DE ROSCA (DONUT CHART) 🌟 */}
          <section className="dash-card-wide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <h3 style={{ width: '100%', textAlign: 'left', marginBottom: '0' }}>📊 Status da Empresa</h3>
            
            <div style={{ position: 'relative', width: '180px', height: '180px', margin: '20px 0' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {/* Fundo Cinza */}
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                
                {/* Segmentos do Gráfico */}
                {p1 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" strokeWidth="4" strokeDasharray={`${p1} ${100 - p1}`} strokeDashoffset={off1} strokeLinecap="round" />}
                {p2 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4" strokeDasharray={`${p2} ${100 - p2}`} strokeDashoffset={off2} strokeLinecap="round" />}
                {p3 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#8b5cf6" strokeWidth="4" strokeDasharray={`${p3} ${100 - p3}`} strokeDashoffset={off3} strokeLinecap="round" />}
                {p4 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${p4} ${100 - p4}`} strokeDashoffset={off4} strokeLinecap="round" />}
              </svg>
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>{statusChart.total}</span>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Pedidos</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', width: '100%', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '50%' }}></span> Orçamentos ({statusChart.orcamento})</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%' }}></span> Confirmados ({statusChart.confirmado})</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', background: '#8b5cf6', borderRadius: '50%' }}></span> Logística ({statusChart.andamento})</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '50%' }}></span> Finalizados ({statusChart.concluido})</div>
            </div>
          </section>

        </div>

        {/* COLUNA 3: ÚLTIMAS LOCAÇÕES */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <section className="dash-card-wide" style={{flex: 1}}>
            <h3>🛒 Últimas Vendas Confirmadas</h3>
            <div className="activity-feed">
              {atividades.length > 0 ? atividades.map((a, i) => (
                <div key={i} className="feed-row-moderno">
                  <div className="feed-icon box-blue">🛍️</div>
                  <div className="feed-info">
                    <p>{a.txt}</p>
                    {a.valor && <span className="feed-valor" style={{color: '#10b981', fontWeight: 'bold'}}>{a.valor}</span>}
                  </div>
                </div>
              )) : <p style={{color:'#94a3b8', textAlign: 'center', marginTop: '20px'}}>Nenhuma venda recente.</p>}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;