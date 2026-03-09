import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import AuditoriaEstoque from './AuditoriaEstoque'; 

const Dashboard = () => {
  const navigate = useNavigate();
  
  const [estatisticas, setEstatisticas] = useState({ acervo: 0, ativas: 0, eventos: 0, aReceber: 0, ticketMedio: 0 });
  const [atividades, setAtividades] = useState([]);
  const [faturamentoData, setFaturamentoData] = useState([0, 0, 0, 0]);
  const [proximosEventos, setProximosEventos] = useState([]);
  const [orcamentosPendentes, setOrcamentosPendentes] = useState([]);
  const [statusChart, setStatusChart] = useState({ orcamento: 0, confirmado: 0, preparacao: 0, entregue: 0, finalizado: 0, total: 0 });
  
  const [valoresPorStatus, setValoresPorStatus] = useState({ orcamento: 0, confirmado: 0 });
  const [topPecas, setTopPecas] = useState([]);
  const [cobrancasAtrasadas, setCobrancasAtrasadas] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const hojeISO = new Date().toISOString().split('T')[0];
        const mesAtual = hojeISO.substring(0, 7);

        const estSnap = await getDocs(collection(db, "estoque"));
        const locSnap = await getDocs(collection(db, "locacoes"));
        const locs = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const confirmadas = locs.filter(l => l.status === 'confirmado' || l.status === 'preparacao' || l.status === 'entregue' || l.status === 'finalizado');
        const orcamentos = locs.filter(l => (l.status || '').toLowerCase() === 'orcamento');

        let cOrcamento = 0, cConfirmado = 0, cPreparacao = 0, cEntregue = 0, cFinalizado = 0;
        let vOrcamento = 0, vConfirmado = 0;
        
        locs.forEach(l => {
          const s = (l.status || '').toLowerCase();
          const valorLoc = Number(l.valorTotal || l.total || 0);

          if (s === 'orcamento') { cOrcamento++; vOrcamento += valorLoc; }
          else if (s === 'confirmado') { cConfirmado++; vConfirmado += valorLoc; }
          else if (s === 'preparacao') { cPreparacao++; }
          else if (s === 'entregue') { cEntregue++; }
          else if (s === 'finalizado') { cFinalizado++; }
        });

        setStatusChart({
          orcamento: cOrcamento, confirmado: cConfirmado, preparacao: cPreparacao, entregue: cEntregue, finalizado: cFinalizado, total: cOrcamento + cConfirmado + cPreparacao + cEntregue + cFinalizado
        });

        setValoresPorStatus({ orcamento: vOrcamento, confirmado: vConfirmado });

        const fatSemanal = [0, 0, 0, 0];
        let totalAReceber = 0;
        let faturamentoGeral = 0;
        let qtdVendasGeral = 0;
        const contagemItens = {};
        const atrasados = [];

        confirmadas.forEach(l => {
            const valorTotal = Number(l.valorTotal || 0);
            const valorPago = Number(l.valorPago || 0);
            const devendo = valorTotal - valorPago;
            const dataFesta = l.dataRetirada || l.dataEvento;

            faturamentoGeral += valorTotal;
            qtdVendasGeral++;

            if (dataFesta && dataFesta.startsWith(mesAtual)) {
                const dia = parseInt(dataFesta.split('-')[2]);
                if (dia <= 7) fatSemanal[0] += valorTotal;
                else if (dia <= 14) fatSemanal[1] += valorTotal;
                else if (dia <= 21) fatSemanal[2] += valorTotal;
                else fatSemanal[3] += valorTotal;
            }

            if (devendo > 0.01) {
              totalAReceber += devendo;
              if (dataFesta && dataFesta < hojeISO && l.status !== 'cancelado') {
                  const nomeCerto = l.clienteNome || l.cliente?.nome || l.razaoSocial || l.nomeFantasia || l.nome || 'Cliente Não Identificado';
                  atrasados.push({
                      id: l.id,
                      cliente: nomeCerto,
                      data: dataFesta.split('-').reverse().join('/'),
                      valor: devendo
                  });
              }
            }

            if (l.itens && Array.isArray(l.itens)) {
                l.itens.forEach(item => {
                    if (item.nome) {
                        if (!contagemItens[item.nome]) contagemItens[item.nome] = 0;
                        contagemItens[item.nome] += (Number(item.qtd) || 1);
                    }
                });
            }
        });

        const rankingPecas = Object.entries(contagemItens)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => ({ nome: entry[0], qtd: entry[1] }));

        const recents = confirmadas
            .sort((a, b) => {
                const dataA = a.criadoEm?.seconds ? a.criadoEm.seconds : 0;
                const dataB = b.criadoEm?.seconds ? b.criadoEm.seconds : 0;
                return dataB - dataA; 
            })
            .slice(0, 5)
            .map(l => ({ 
                id: l.id,
                txt: `${l.clienteNome || 'Cliente Não Informado'}`, 
                valor: l.valorTotal ? `R$ ${Number(l.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : ''
            }));

        const proximos = confirmadas
            .filter(l => l.dataRetirada && l.dataRetirada >= hojeISO && (l.status === 'confirmado' || l.status === 'preparacao'))
            .sort((a, b) => a.dataRetirada.localeCompare(b.dataRetirada))
            .slice(0, 5)
            .map(l => ({
                id: l.id,
                cliente: l.clienteNome || 'Cliente',
                data: l.dataRetirada.split('-').reverse().join('/'),
                cidade: l.logistica?.cidade || 'Retirada na Loja'
            }));

        const orcamentosRecentes = orcamentos
            .sort((a, b) => {
                const dataA = a.criadoEm?.seconds ? a.criadoEm.seconds : 0;
                const dataB = b.criadoEm?.seconds ? b.criadoEm.seconds : 0;
                return dataB - dataA; 
            })
            .slice(0, 5);

        setEstatisticas({
            acervo: estSnap.size,
            ativas: confirmadas.filter(l => l.status === 'confirmado' || l.status === 'preparacao').length,
            eventos: proximos.length,
            aReceber: totalAReceber,
            ticketMedio: qtdVendasGeral > 0 ? (faturamentoGeral / qtdVendasGeral) : 0
        });
        
        setFaturamentoData(fatSemanal);
        setAtividades(recents);
        setProximosEventos(proximos);
        setOrcamentosPendentes(orcamentosRecentes);
        setTopPecas(rankingPecas);
        setCobrancasAtrasadas(atrasados.sort((a, b) => b.valor - a.valor).slice(0, 5));

      } catch (e) { console.error("Erro dashboard:", e); } 
      finally { setLoading(false); }
    };
    carregarDados();
  }, []);

  if (loading) return <div className="loading-v3">Atualizando central de comando...</div>;

  const maxFat = Math.max(...faturamentoData, 1); 
  const totalG = statusChart.total || 1; 
  
  const p1 = (statusChart.orcamento / totalG) * 100;
  const p2 = (statusChart.confirmado / totalG) * 100;
  const p3 = (statusChart.preparacao / totalG) * 100;
  const p4 = (statusChart.entregue / totalG) * 100;
  const p5 = (statusChart.finalizado / totalG) * 100;

  const off1 = 0;
  const off2 = 100 - p1;
  const off3 = 100 - (p1 + p2);
  const off4 = 100 - (p1 + p2 + p3);
  const off5 = 100 - (p1 + p2 + p3 + p4);

  return (
    <div className="dash-wide-container fade-in">
      <AuditoriaEstoque />

      <header className="dash-wide-header">
        <div className="header-titles">
          <h1>Olá, Admin! 👋</h1>
          <p>Visão geral e inteligência de negócios.</p>
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
        <div className="stat-card-wide border-purple">
            <span>TICKET MÉDIO</span>
            <strong>R$ {estatisticas.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
        </div>
        <div className="stat-card-wide border-red">
          <span>A RECEBER TOTAL</span>
          <strong style={{color: '#dc2626'}}>R$ {estatisticas.aReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
        </div>
      </div>

      <div className="dash-main-grid-wide">
        
        {/* ================= COLUNA 1: MÉTRICAS E FINANCEIRO ================= */}
        <div className="dash-column">
          
          {/* 🔥 NOVO DESIGN DA CAIXA DO GRÁFICO 🔥 */}
          <section className="dash-card-wide flex-grow" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3>📊 Status e Volume</h3>
            
            <div className="chart-circle-container">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                {p1 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" strokeWidth="4" strokeDasharray={`${p1} ${100 - p1}`} strokeDashoffset={off1} strokeLinecap="round" />}
                {p2 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4" strokeDasharray={`${p2} ${100 - p2}`} strokeDashoffset={off2} strokeLinecap="round" />}
                {p3 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#8b5cf6" strokeWidth="4" strokeDasharray={`${p3} ${100 - p3}`} strokeDashoffset={off3} strokeLinecap="round" />}
                {p4 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#ec4899" strokeWidth="4" strokeDasharray={`${p4} ${100 - p4}`} strokeDashoffset={off4} strokeLinecap="round" />}
                {p5 > 0 && <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${p5} ${100 - p5}`} strokeDashoffset={off5} strokeLinecap="round" />}
              </svg>
              <div className="chart-center-text">
                <strong>{statusChart.total}</strong>
                <span>Pedidos</span>
              </div>
            </div>

            {/* 🔥 LEGENDA EM FORMATO DE "PÍLULAS" 🔥 */}
            <div className="chart-legend-pills">
              <div><span style={{background: '#f59e0b'}}></span> Orçamentos <b>{statusChart.orcamento}</b></div>
              <div><span style={{background: '#10b981'}}></span> Confirmados <b>{statusChart.confirmado}</b></div>
              <div><span style={{background: '#8b5cf6'}}></span> Separação <b>{statusChart.preparacao}</b></div>
              <div><span style={{background: '#ec4899'}}></span> Entregue <b>{statusChart.entregue}</b></div>
              <div><span style={{background: '#3b82f6'}}></span> Finalizados <b>{statusChart.finalizado}</b></div>
            </div>

            {/* 🔥 NOVO CARTÃO DO PIPELINE FINANCEIRO 🔥 */}
            <div className="dash-financial-summary">
                <h4><span style={{fontSize: '14px'}}>💰</span> PIPELINE FINANCEIRO</h4>
                <div className="summary-item warning-text">
                    <span>Orçamentos Abertos</span>
                    <strong>R$ {valoresPorStatus.orcamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                </div>
                <div className="summary-item green-text">
                    <span>Confirmados (Garantido)</span>
                    <strong>R$ {valoresPorStatus.confirmado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                </div>
            </div>
          </section>

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

        </div>

        {/* ================= COLUNA 2: VENDAS E INTELIGÊNCIA ================= */}
        <div className="dash-column">
          <section className="dash-card-wide border-top-yellow flex-grow">
            <h3>📝 Orçamentos Pendentes</h3>
            <p className="card-subtitle">Negócios abertos aguardando fechamento.</p>
            <div className="activity-feed">
              {orcamentosPendentes.length > 0 ? orcamentosPendentes.map((orc, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${orc.id}`)}>
                  <div className="feed-icon warning-icon">🔔</div>
                  <div className="feed-info">
                    <p>{orc.clienteNome || 'Sem Nome'}</p>
                    <span className="feed-sub">Festa: {orc.dataRetirada ? orc.dataRetirada.split('-').reverse().join('/') : '?'}</span>
                  </div>
                </div>
              )) : <p className="empty-feed">Nenhum orçamento pendente.</p>}
            </div>
          </section>

          <section className="dash-card-wide flex-grow">
            <h3>🛒 Últimas Vendas Confirmadas</h3>
            <div className="activity-feed">
              {atividades.length > 0 ? atividades.map((a, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${a.id}`)}>
                  <div className="feed-icon blue-icon">🛍️</div>
                  <div className="feed-info">
                    <p>{a.txt}</p>
                    {a.valor && <span className="feed-valor">{a.valor}</span>}
                  </div>
                </div>
              )) : <p className="empty-feed">Nenhuma venda recente.</p>}
            </div>
          </section>
        </div>

        {/* ================= COLUNA 3: OPERACIONAL E ALERTAS ================= */}
        <div className="dash-column">
          
          <section className="dash-card-wide border-top-red flex-grow">
            <h3>🚨 Radar de Cobrança</h3>
            <p className="card-subtitle" style={{marginBottom: '10px'}}>A festa passou e o pagamento não concluiu.</p>
            <div className="activity-feed">
              {cobrancasAtrasadas.length > 0 ? cobrancasAtrasadas.map((cob, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${cob.id}`)}>
                  <div className="feed-icon danger-icon">⚠️</div>
                  <div className="feed-info">
                    <p>{cob.cliente}</p>
                    <span className="feed-sub">Data Festa: {cob.data}</span>
                  </div>
                  <div className="feed-valor" style={{color: '#dc2626'}}>R$ {cob.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
              )) : <p className="empty-feed" style={{color: '#10b981', background: '#ecfdf5', padding: '10px', borderRadius: '8px'}}>✅ Nenhum atraso detectado.</p>}
            </div>
          </section>

          <section className="dash-card-wide flex-grow">
            <h3>📈 Ranking de Peças (Top 5)</h3>
            <div className="activity-feed">
              {topPecas.length > 0 ? topPecas.map((peca, i) => (
                <div key={i} className="feed-row-moderno cursor-default">
                  <div className="feed-icon" style={{background: '#f8fafc', color: '#64748b', fontSize: '14px', fontWeight: 'bold'}}>{i+1}º</div>
                  <div className="feed-info">
                    <p>{peca.nome}</p>
                    <span className="feed-sub">Alugada {peca.qtd} vezes</span>
                  </div>
                </div>
              )) : <p className="empty-feed">Dados insuficientes.</p>}
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};

export default Dashboard;