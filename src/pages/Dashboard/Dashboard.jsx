import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import AuditoriaEstoque from './AuditoriaEstoque';

const Dashboard = () => {
  const navigate = useNavigate();
  
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const tenantIdLocal = localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const nomeUsuario = localStorage.getItem('funcName') || usuarioLogado?.displayName || "Equipe";

  const emailAdmin = "celebrefesta25@gmail.com";
  const isSuperAdmin = usuarioLogado?.email === emailAdmin;
  
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

  const [diasTeste, setDiasTeste] = useState(1);
  const [statusConta, setStatusConta] = useState('ativo'); 

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarDados = async () => {
      try {
        const hojeISO = new Date().toISOString().split('T')[0];
        const mesAtual = hojeISO.substring(0, 7);

        let idDaEmpresaCorreta = tenantIdLocal;
        
        const qEquipe = query(collection(db, "equipe"), where("email", "==", usuarioLogado.email));
        const snapEquipe = await getDocs(qEquipe);
        
        if (!snapEquipe.empty) {
            idDaEmpresaCorreta = snapEquipe.docs[0].data().empresaId;
            localStorage.setItem('tenantId', idDaEmpresaCorreta);
        }

        const userDocRef = doc(db, "usuarios", idDaEmpresaCorreta);
        const userDocSnap = await getDoc(userDocRef);
        
        let dataCadastroSegura = usuarioLogado.metadata.creationTime; 
        let usuarioJaPagou = false;

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.plano === 'pago' || userData.statusPagamentoVulso === 'pago' || userData.statusAssinatura === 'ativa') {
                usuarioJaPagou = true;
            }
            if (userData.dataCadastro) {
                dataCadastroSegura = userData.dataCadastro;
            }
        }

        if (dataCadastroSegura) {
            let dataCadastroStr = dataCadastroSegura;
            if (dataCadastroStr.toDate) {
                dataCadastroStr = dataCadastroStr.toDate().toISOString();
            }
            
            const hojeApenasData = new Date().toISOString().split('T')[0];
            const cadastroApenasData = new Date(dataCadastroStr).toISOString().split('T')[0];
            const hojeMilissegundos = new Date(hojeApenasData).getTime();
            const cadastroMilissegundos = new Date(cadastroApenasData).getTime();
            const diffTime = hojeMilissegundos - cadastroMilissegundos;
            let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays < 1) diffDays = 1;

            setDiasTeste(diffDays);

            if (!isSuperAdmin && !usuarioJaPagou) {
                if (diffDays > 180) {
                    setStatusConta('excluido');
                    setLoading(false);
                    return; 
                } else if (diffDays > 7) {
                    setStatusConta('bloqueado');
                    setLoading(false);
                    return; 
                }
            }
        }

        const qEstoque = query(collection(db, "estoque"), where("userId", "==", idDaEmpresaCorreta));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", idDaEmpresaCorreta));

        const estSnap = await getDocs(qEstoque);
        const locSnap = await getDocs(qLocacoes);
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
        
      } catch (e) { 
          console.error("Erro dashboard:", e);
      } finally { 
          setLoading(false); 
      }
    };
    
    carregarDados();
  }, [usuarioLogado, isSuperAdmin, navigate, tenantIdLocal]);

  if (loading) return <div className="loading-v3">Atualizando central de comando...</div>;

  const maxFat = Math.max(...faturamentoData, 1);
  const totalG = statusChart.total || 1;
  const p1 = (statusChart.orcamento / totalG) * 100;
  const p2 = (statusChart.confirmado / totalG) * 100;
  const p3 = (statusChart.preparacao / totalG) * 100;
  const p4 = (statusChart.entregue / totalG) * 100;
  const p5 = (statusChart.finalizado / totalG) * 100;
  
  if (statusConta === 'excluido') {
      return (
          <div className="dash-wide-container dash-status-screen fade-in">
              <div className="dash-status-card dash-status-card--danger">
                  <h2>🚫 Conta Desativada</h2>
                  <p>
                      Seu período de inatividade ultrapassou <strong>6 meses</strong>. Por segurança e limpeza do sistema, o acesso a esta conta foi suspenso e os dados programados para exclusão.
                  </p>
                  <p className="dash-status-card__footnote">
                      Dúvidas? Entre em contato com o suporte: contato@celebreapp.com
                  </p>
              </div>
          </div>
      );
  }

  if (statusConta === 'bloqueado') {
      return (
          <div className="dash-wide-container dash-status-screen fade-in">
              <div className="dash-status-card dash-status-card--warning">
                  <h2>⏳ Seu período de teste voou!</h2>
                  <p>
                      Esperamos que o <strong>Celebre</strong> tenha ajudado a organizar suas festas nestes últimos dias. Para destravar seu painel e não perder nenhum dado importante, escolha o seu plano.
                  </p>
                  <button onClick={() => navigate('/planos')} className="dash-status-btn">
                      Ver Planos e Assinar
                  </button>
              </div>
        </div>
      );
  }

  return (
    <div className="dash-wide-container fade-in">
      
      {!isSuperAdmin && statusConta === 'ativo' && diasTeste <= 7 && (
        <div className="dash-trial-banner">
          ⏳ Você está no dia {diasTeste} de 7 do seu teste gratuito do Celebre. Aproveite!
        </div>
      )}

      <AuditoriaEstoque />

      <header className="dash-wide-header">
        <div className="header-titles">
          <h1>Olá, {nomeUsuario}! 👋</h1>
          <p>Visão geral e inteligência de negócios.</p>
        </div>
        
        <div className="dash-actions-row">
          <button onClick={() => navigate('/cadastro-cliente')}><i className="fas fa-user-plus"></i> NOVO CLIENTE</button>
          <button onClick={() => navigate('/locacoes/nova')}><i className="fas fa-shopping-cart"></i> NOVA LOCAÇÃO</button>
          <button onClick={() => navigate('/cadastro-estoque')}><i className="fas fa-box-open"></i> NOVO ITEM</button>
          <button onClick={() => navigate('/compras/nova')}><i className="fas fa-hand-holding-usd"></i> NOVA COMPRA</button>
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
          <strong>R$ {estatisticas.aReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
        </div>
      </div>

      <div className="dash-main-grid-wide">
        <div className="dash-column">
          <section className="dash-card-wide flex-grow dash-card-column">
            
            <div className="dash-section-header">
              <h3>📊 Status e Volume</h3>
              <span className="dash-count-pill">
                {statusChart.total} PEDIDOS NO MÊS
              </span>
            </div>

            <div className="horizontal-stacked-bar">
                {p1 > 0 && <div className="segment-orcamento" style={{width: `${p1}%`}} title={`Orçamentos: ${statusChart.orcamento}`}></div>}
                {p2 > 0 && <div className="segment-confirmado" style={{width: `${p2}%`}} title={`Confirmados: ${statusChart.confirmado}`}></div>}
                {p3 > 0 && <div className="segment-preparacao" style={{width: `${p3}%`}} title={`Separação: ${statusChart.preparacao}`}></div>}
                {p4 > 0 && <div className="segment-entregue" style={{width: `${p4}%`}} title={`Entregue: ${statusChart.entregue}`}></div>}
                {p5 > 0 && <div className="segment-finalizado" style={{width: `${p5}%`}} title={`Finalizados: ${statusChart.finalizado}`}></div>}
                {statusChart.total === 0 && <div className="segment-empty" style={{width: '100%'}}></div>}
            </div>

            <div className="chart-legend-pills">
              <div><span className="segment-orcamento"></span> Orçamentos <b>{statusChart.orcamento}</b></div>
              <div><span className="segment-confirmado"></span> Confirmados <b>{statusChart.confirmado}</b></div>
              <div><span className="segment-preparacao"></span> Separação <b>{statusChart.preparacao}</b></div>
              <div><span className="segment-entregue"></span> Entregue <b>{statusChart.entregue}</b></div>
              <div><span className="segment-finalizado"></span> Finalizados <b>{statusChart.finalizado}</b></div>
            </div>

            <div className="dash-financial-summary">
              <h4><span className="dash-financial-summary__icon">💰</span> PIPELINE FINANCEIRO</h4>
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

        <div className="dash-column">
          <section className="dash-card-wide flex-grow">
            <h3>📝 Orçamentos Pendentes</h3>
            <p className="card-subtitle">Negócios abertos aguardando fechamento.</p>
            <div className="activity-feed">
              {orcamentosPendentes.length > 0 ?
                orcamentosPendentes.map((orc, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${orc.id}`)}>
                  <div className="feed-icon warning-icon">🔔</div>
                  <div className="feed-info">
                    <p>{orc.clienteNome || 'Sem Nome'}</p>
                    <span className="feed-sub">Festa: {orc.dataRetirada ? orc.dataRetirada.split('-').reverse().join('/') : '?'}</span>
                  </div>
                </div>
              )) : <p className="empty-feed">🗒️ Nenhum orçamento pendente.</p>}
            </div>
          </section>

          <section className="dash-card-wide flex-grow">
            <h3>🛒 Últimas Vendas Confirmadas</h3>
            <div className="activity-feed">
              {atividades.length > 0 ?
                atividades.map((a, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${a.id}`)}>
                  <div className="feed-icon blue-icon">🛍️</div>
                  <div className="feed-info">
                    <p>{a.txt}</p>
                    {a.valor && <span className="feed-valor">{a.valor}</span>}
                  </div>
                </div>
              )) : <p className="empty-feed">🛍️ Nenhuma venda recente.</p>}
            </div>
          </section>
        </div>

        <div className="dash-column">
          <section className="dash-card-wide flex-grow">
            <h3>🚨 Radar de Cobrança</h3>
            <p className="card-subtitle">A festa passou e o pagamento não concluiu.</p>
            <div className="activity-feed">
              {cobrancasAtrasadas.length > 0 ?
                cobrancasAtrasadas.map((cob, i) => (
                <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${cob.id}`)}>
                  <div className="feed-icon danger-icon">⚠️</div>
                  <div className="feed-info">
                    <p>{cob.cliente}</p>
                    <span className="feed-sub">Data Festa: {cob.data}</span>
                  </div>
                  <div className="feed-valor feed-valor--danger">R$ {cob.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
              )) : <p className="empty-feed empty-feed--success">✅ Nenhum atraso detectado.</p>}
            </div>
          </section>

          <section className="dash-card-wide flex-grow">
            <h3>📈 Ranking de Peças (Top 5)</h3>
            <div className="activity-feed">
              {topPecas.length > 0 ?
                topPecas.map((peca, i) => (
                <div key={i} className="feed-row-moderno cursor-default">
                  <div className="feed-icon feed-icon--rank">{i+1}º</div>
                  <div className="feed-info">
                    <p>{peca.nome}</p>
                    <span className="feed-sub">Alugada {peca.qtd} vezes</span>
                  </div>
                </div>
              )) : <p className="empty-feed">📊 Dados insuficientes.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;