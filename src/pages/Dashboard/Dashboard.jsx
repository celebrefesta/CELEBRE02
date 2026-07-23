import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import AuditoriaEstoque from './AuditoriaEstoque';

const parseFirestoreDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal.toDate) {
      try { return dateVal.toDate(); } catch (e) {}
  }
  if (dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
  }
  
  const str = String(dateVal).trim();
  
  // 1. Formato ISO ou AAAA-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
      const ano = parseInt(isoMatch[1], 10);
      const mes = parseInt(isoMatch[2], 10) - 1;
      const dia = parseInt(isoMatch[3], 10);
      return new Date(ano, mes, dia);
  }

  // 2. Formato brasileiro DD/MM/AAAA
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
      const dia = parseInt(brMatch[1], 10);
      const mes = parseInt(brMatch[2], 10) - 1;
      const ano = parseInt(brMatch[3], 10);
      return new Date(ano, mes, dia);
  }
  
  // 3. Formato HTTP / GMT (ex: "Tue, 17 Apr 2026 18:31:45 GMT")
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  
  return null;
};

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
  const [aniversariantesDoMes, setAniversariantesDoMes] = useState([]);
  const [modalAniversariantesAberto, setModalAniversariantesAberto] = useState(false);
  const [loading, setLoading] = useState(true);

  const [diasTeste, setDiasTeste] = useState(1);
  const [statusConta, setStatusConta] = useState('ativo'); 
  const [assinaturaAtiva, setAssinaturaAtiva] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(null);

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarDados = async () => {
      try {
        const hoje = new Date();
        const hojeISO = hoje.toISOString().split('T')[0];
        const mesAtual = hojeISO.substring(0, 7);

        let idDaEmpresaCorreta = usuarioLogado.uid;
        let eUmFuncionario = false;

        const ownDocSnap = await getDoc(doc(db, "usuarios", usuarioLogado.uid));

        if (ownDocSnap.exists()) {
            const userData = ownDocSnap.data();
            if (userData.role && userData.role !== 'owner' && userData.tenantId) {
                idDaEmpresaCorreta = userData.tenantId;
                eUmFuncionario = true;
            } else {
                idDaEmpresaCorreta = usuarioLogado.uid;
            }
        } else {
            const qEquipe = query(collection(db, "equipe"), where("email", "==", usuarioLogado.email));
            const snapEquipe = await getDocs(qEquipe);
            if (!snapEquipe.empty && snapEquipe.docs[0].data().empresaId) {
                idDaEmpresaCorreta = snapEquipe.docs[0].data().empresaId;
                eUmFuncionario = true;
            }
        }

        localStorage.setItem('tenantId', idDaEmpresaCorreta);

        if (!isSuperAdmin) {
            const companySnap = await getDoc(doc(db, "usuarios", idDaEmpresaCorreta));
            const companyData = companySnap.exists() ? companySnap.data() : (ownDocSnap.exists() ? ownDocSnap.data() : {});

            const isPagante = companyData.assinaturaAtiva === true ||
                companyData.statusAssinatura === 'ativa' ||
                companyData.plano === 'pago' ||
                companyData.statusPagamentoVulso === 'pago';

            setAssinaturaAtiva(isPagante);

            if (!isPagante) {
                const rawDateCompany = companyData.dataCadastro 
                    || companyData.criadoEm 
                    || companyData.createdAt 
                    || companyData.dataInicioTeste 
                    || (!eUmFuncionario ? usuarioLogado.metadata?.creationTime : null);

                const dataCadastroDate = parseFirestoreDate(rawDateCompany);

                if (dataCadastroDate) {
                    const cadastroMeia = new Date(dataCadastroDate);
                    cadastroMeia.setHours(0,0,0,0);
                    
                    const dataFimTeste = new Date(cadastroMeia);
                    dataFimTeste.setDate(dataFimTeste.getDate() + 7);

                    const hojeNormalizado = new Date();
                    hojeNormalizado.setHours(0,0,0,0);

                    const diffMs = hojeNormalizado.getTime() - cadastroMeia.getTime();
                    const diaAtual = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

                    setDiasTeste(Math.max(1, diaAtual));

                    const testeExpirou = hojeNormalizado >= dataFimTeste;

                    if (testeExpirou) {
                        setStatusConta('bloqueado');
                        setLoading(false);
                        return;
                    }
                } else {
                    // Sem data de cadastro alguma → bloqueia por segurança
                    setStatusConta('bloqueado');
                    setLoading(false);
                    return;
                }
            }
        }

        // ════════════════════════════════════════════════════════════
        // PASSO 3: CARREGAMENTO DOS DADOS DA EMPRESA
        // ════════════════════════════════════════════════════════════
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
            
            const rawDataFesta = l.dataRetirada || l.dataEvento;
            let dataFesta = "";
            if (rawDataFesta) {
                const dateObj = parseFirestoreDate(rawDataFesta);
                if (dateObj) dataFesta = dateObj.toISOString().split('T')[0];
            }

            faturamentoGeral += valorTotal;
            qtdVendasGeral++;

            if (dataFesta && dataFesta.startsWith(mesAtual)) {
                const dia = parseInt(dataFesta.split('-')[2], 10);
                if (dia <= 7) fatSemanal[0] += valorTotal;
                else if (dia <= 14) fatSemanal[1] += valorTotal;
                else if (dia <= 21) fatSemanal[2] += valorTotal;
                else fatSemanal[3] += valorTotal;
            }

            if (devendo > 0.01) {
              totalAReceber += devendo;
              if (dataFesta && dataFesta < hojeISO && l.status !== 'cancelado') {
                  const nomeCerto = l.clienteNome || l.cliente?.nome || l.razaoSocial || l.nomeFantasia || l.nome || 'Cliente Não Identificado';
                  atrasados.push({ id: l.id, cliente: nomeCerto, data: dataFesta.split('-').reverse().join('/'), valor: devendo });
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
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(entry => ({ nome: entry[0], qtd: entry[1] }));
            
        const recents = confirmadas
            .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
            .slice(0, 5)
            .map(l => ({ 
                id: l.id,
                txt: l.clienteNome || 'Cliente Não Informado', 
                valor: l.valorTotal ? `R$ ${Number(l.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : ''
            }));
            
        const proximos = confirmadas
            .filter(l => {
                const rawData = l.dataRetirada;
                if (!rawData) return false;
                const dateObj = parseFirestoreDate(rawData);
                if (!dateObj) return false;
                return dateObj.toISOString().split('T')[0] >= hojeISO && (l.status === 'confirmado' || l.status === 'preparacao');
            })
            .sort((a, b) => {
                const dA = parseFirestoreDate(a.dataRetirada)?.toISOString() || '';
                const dB = parseFirestoreDate(b.dataRetirada)?.toISOString() || '';
                return dA.localeCompare(dB);
            })
            .slice(0, 5)
            .map(l => {
                const dateObj = parseFirestoreDate(l.dataRetirada);
                return { id: l.id, cliente: l.clienteNome || 'Cliente', data: dateObj ? dateObj.toLocaleDateString('pt-BR') : '—', cidade: l.logistica?.cidade || 'Retirada na Loja' };
            });
            
        const orcamentosRecentes = orcamentos
            .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
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
        
        // BUSCA ANIVERSARIANTES DO MÊS NO DASHBOARD
        try {
          const qClientesDash = query(collection(db, "clientes"), where("userId", "==", idDaEmpresaCorreta));
          const snapClientesDash = await getDocs(qClientesDash);
          const todosClientesDash = snapClientesDash.docs.map(d => ({ ...d.data(), id: d.id }));

          const isAniversarianteDoMes = (cliente) => {
            if (!cliente) return false;
            const dataVal = cliente.nascimento || cliente.dataNascimento || cliente.dataNasc || cliente.dataAniversario || cliente.aniversario;
            if (!dataVal) return false;
            try {
              let mesNasc = -1;
              if (typeof dataVal === 'object' && dataVal !== null) {
                if (dataVal.toDate) mesNasc = dataVal.toDate().getMonth();
                else if (dataVal.seconds) mesNasc = new Date(dataVal.seconds * 1000).getMonth();
                else if (dataVal instanceof Date) mesNasc = dataVal.getMonth();
              } else {
                const str = String(dataVal).trim();
                if (!str) return false;
                if (str.includes('-')) {
                  const partes = str.split('T')[0].split('-');
                  if (partes.length === 3) mesNasc = parseInt(partes[1], 10) - 1;
                } else if (str.includes('/')) {
                  const partes = str.split('/');
                  if (partes.length >= 2) mesNasc = parseInt(partes[1], 10) - 1;
                } else {
                  const d = new Date(str);
                  if (!isNaN(d.getTime())) mesNasc = d.getMonth();
                }
              }
              return mesNasc === new Date().getMonth();
            } catch (e) {
              return false;
            }
          };

          const anivs = todosClientesDash.filter(c => isAniversarianteDoMes(c));
          setAniversariantesDoMes(anivs);
        } catch (errAniv) {
          console.warn("Aviso ao carregar aniversariantes do mês:", errAniv);
        }
        
      } catch (e) { 
          console.error("Erro dashboard:", e);
          setErroCarregamento(e.message || String(e));
      } finally {  
          setLoading(false); 
      }
    };
    
    carregarDados();
  }, [usuarioLogado?.uid]);

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
      

      {!isSuperAdmin && !assinaturaAtiva && statusConta === 'ativo' && diasTeste <= 7 && (
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

          {/* WIDGET CRM ANIVERSARIANTES DO MÊS */}
          <section className="dash-card-wide flex-grow crm-birthday-card-dash">
            <div className="dash-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>🎂 Aniversariantes do Mês</h3>
                <span className="dash-count-pill" style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '800' }}>
                  {aniversariantesDoMes.length} CLIENTE{aniversariantesDoMes.length === 1 ? '' : 'S'}
                </span>
              </div>

              <button 
                type="button" 
                onClick={() => setModalAniversariantesAberto(true)}
                className="btn-ver-todos-anivs"
              >
                <i className="fas fa-eye"></i> VISUALIZAR TODOS
              </button>
            </div>
            <p className="card-subtitle" style={{ margin: '4px 0 10px 0', fontSize: '0.78rem', color: '#64748b' }}>Felicite e envie cupons via WhatsApp, E-mail ou Ambos!</p>

            <div className="activity-feed">
              {aniversariantesDoMes.length > 0 ? (
                aniversariantesDoMes.slice(0, 5).map((c) => {
                  const nomeFormat = c.nome || c.nomeFantasia || c.razaoSocial || 'Cliente';
                  const fone = c.celular ? c.celular.replace(/\D/g, '') : '';
                  const msgTexto = encodeURIComponent(`Olá ${nomeFormat}! 🎉 A equipe Celebre deseja um Feliz Aniversário! Como presente especial, preparamos 10% OFF na sua próxima locação. Vamos comemorar? 🎂🎈`);
                  const zapLink = `https://wa.me/55${fone}?text=${msgTexto}`;
                  const mailLink = `mailto:${c.email}?subject=Parabéns do Celebre! 🎂🎈&body=${msgTexto}`;

                  return (
                    <div key={c.id} className="feed-row-birthday">
                      <div className="birthday-client-info">
                        <div className="birthday-avatar">{nomeFormat.charAt(0)}</div>
                        <div>
                          <strong>{nomeFormat}</strong>
                          <span className="birthday-date-sub">📅 Aniversário: {c.nascimento || c.dataNascimento || c.dataNasc || 'Este Mês'}</span>
                        </div>
                      </div>

                      <div className="birthday-dispatch-actions">
                        {c.celular && (
                          <a href={zapLink} target="_blank" rel="noopener noreferrer" className="btn-dispatch-zap" title="Enviar Whats">
                            <i className="fab fa-whatsapp"></i> Whats
                          </a>
                        )}
                        {c.email && (
                          <a href={mailLink} className="btn-dispatch-email" title="Enviar E-mail">
                            <i className="far fa-envelope"></i> E-mail
                          </a>
                        )}
                        {c.celular && c.email && (
                          <button 
                            type="button" 
                            onClick={() => {
                              window.open(zapLink, '_blank');
                              window.location.href = mailLink;
                            }}
                            className="btn-dispatch-both" 
                            title="Disparar WhatsApp + E-mail simultaneamente"
                          >
                            <i className="fas fa-paper-plane"></i> Ambos
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="empty-feed">🎂 Nenhum cliente faz aniversário este mês.</p>
              )}
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

      {/* MODAL CENTRAL DE ANIVERSARIANTES DO MÊS */}
      {modalAniversariantesAberto && (
        <div className="modal-overlay-celebre fade-in" onClick={() => setModalAniversariantesAberto(false)}>
          <div className="modal-container-celebre modal-aniversariantes-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header-celebre" style={{ background: 'linear-gradient(135deg, #be185d 0%, #9d174d 100%)', color: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🎂</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: '850' }}>Aniversariantes do Mês ({aniversariantesDoMes.length})</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', opacity: 0.9 }}>Central CRM de Retenção & Disparo de Cupons</p>
                </div>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setModalAniversariantesAberto(false)}>✕</button>
            </div>

            <div className="modal-body-celebre" style={{ padding: '20px', maxHeight: '65vh', overflowY: 'auto' }}>
              {aniversariantesDoMes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🎂</span>
                  <p style={{ fontWeight: '700' }}>Nenhum cliente faz aniversário este mês.</p>
                </div>
              ) : (
                <div className="anivs-grid-modal" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {aniversariantesDoMes.map(c => {
                    const nomeFormat = c.nome || c.nomeFantasia || c.razaoSocial || 'Cliente';
                    const fone = c.celular ? c.celular.replace(/\D/g, '') : '';
                    const msgTexto = encodeURIComponent(`Olá ${nomeFormat}! 🎉 A equipe Celebre deseja um Feliz Aniversário! Como presente especial, preparamos 10% OFF na sua próxima locação de acervo. Vamos comemorar? 🎂🎈`);
                    const zapLink = `https://wa.me/55${fone}?text=${msgTexto}`;
                    const mailLink = `mailto:${c.email}?subject=Parabéns do Celebre! 🎂🎈&body=${msgTexto}`;

                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--fundo-card, #ffffff)', border: '1px solid var(--borda, #e2e8f0)', borderRadius: '14px', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', color: '#ffffff', fontWeight: '850', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                            {nomeFormat.charAt(0)}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--texto-principal, #0f172a)', display: 'block' }}>{nomeFormat}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--texto-secundario, #64748b)' }}>
                              📅 Data: {c.nascimento || c.dataNascimento || c.dataNasc || 'Este Mês'} {c.celular ? `• 📱 ${c.celular}` : ''} {c.email ? `• ✉️ ${c.email}` : ''}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.celular && (
                            <a href={zapLink} target="_blank" rel="noopener noreferrer" className="btn-dispatch-zap" style={{ padding: '6px 12px', fontSize: '0.76rem' }}>
                              <i className="fab fa-whatsapp"></i> WhatsApp
                            </a>
                          )}
                          {c.email && (
                            <a href={mailLink} className="btn-dispatch-email" style={{ padding: '6px 12px', fontSize: '0.76rem' }}>
                              <i className="far fa-envelope"></i> E-mail
                            </a>
                          )}
                          {c.celular && c.email && (
                            <button 
                              type="button" 
                              onClick={() => {
                                window.open(zapLink, '_blank');
                                window.location.href = mailLink;
                              }}
                              className="btn-dispatch-both" 
                              style={{ padding: '6px 12px', fontSize: '0.76rem' }}
                            >
                              <i className="fas fa-paper-plane"></i> Ambos
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer-celebre" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--borda, #e2e8f0)', background: 'var(--fundo-card, #f8fafc)' }}>
              <button 
                type="button" 
                onClick={() => { setModalAniversariantesAberto(false); navigate('/clientes'); }}
                className="btn-secondary-celebre"
                style={{ fontSize: '0.78rem' }}
              >
                <i className="fas fa-users"></i> Ir para Gestão de Clientes
              </button>
              <button type="button" className="btn-primary-celebre" onClick={() => setModalAniversariantesAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;