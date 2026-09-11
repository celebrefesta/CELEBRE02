import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import AuditoriaEstoque from './AuditoriaEstoque';
import { calcularPeriodoTeste } from '../../utils/periodoTesteUtils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';

const CustomTooltipFat = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-chart-tooltip" style={{ background: '#0f172a', color: '#ffffff', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '0.75rem' }}>
        <p className="tooltip-label" style={{ fontWeight: 800, margin: '0 0 4px 0', color: '#94a3b8' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: '2px 0', color: entry.color || '#ffffff', fontWeight: 700 }}>
            {entry.name}: R$ {Number(entry.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


const CustomTooltipDonut = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-chart-tooltip">
        <p className="tooltip-label" style={{ color: payload[0].payload.color }}>{payload[0].name}</p>
        <p className="tooltip-value">{payload[0].value} {payload[0].value === 1 ? 'pedido' : 'pedidos'}</p>
      </div>
    );
  }
  return null;
};

const parseFirestoreDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal.toDate) {
      try { return dateVal.toDate(); } catch (e) {}
  }
  if (dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
  }
  
  const str = String(dateVal).trim();
  
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
      const ano = parseInt(isoMatch[1], 10);
      const mes = parseInt(isoMatch[2], 10) - 1;
      const dia = parseInt(isoMatch[3], 10);
      return new Date(ano, mes, dia);
  }

  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
      const dia = parseInt(brMatch[1], 10);
      const mes = parseInt(brMatch[2], 10) - 1;
      const ano = parseInt(brMatch[3], 10);
      return new Date(ano, mes, dia);
  }
  
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  
  return null;
};

const extrairMesDia = (dataVal) => {
  if (!dataVal) return { mes: -1, dia: -1 };
  try {
    if (typeof dataVal === 'object' && dataVal !== null) {
      let d;
      if (dataVal.toDate) d = dataVal.toDate();
      else if (dataVal.seconds) d = new Date(dataVal.seconds * 1000);
      else if (dataVal instanceof Date) d = dataVal;
      if (d && !isNaN(d.getTime())) return { mes: d.getMonth(), dia: d.getDate() };
    } else {
      const str = String(dataVal).trim();
      if (!str) return { mes: -1, dia: -1 };
      if (str.includes('-')) {
        const partes = str.split('T')[0].split('-');
        if (partes.length === 3) {
          if (partes[0].length === 4) {
            return { mes: parseInt(partes[1], 10) - 1, dia: parseInt(partes[2], 10) };
          } else if (partes[2].length === 4) {
            return { mes: parseInt(partes[1], 10) - 1, dia: parseInt(partes[0], 10) };
          }
        }
      } else if (str.includes('/')) {
        const partes = str.split('/');
        if (partes.length >= 2) {
          return { mes: parseInt(partes[1], 10) - 1, dia: parseInt(partes[0], 10) };
        }
      } else {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return { mes: d.getMonth(), dia: d.getDate() };
      }
    }
  } catch (e) {}
  return { mes: -1, dia: -1 };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const impersonatingRaw = localStorage.getItem('impersonatingTenant');
  let impersonatingData = null;
  if (impersonatingRaw) {
    try { impersonatingData = JSON.parse(impersonatingRaw); } catch (e) {}
  }
  const isImpersonating = Boolean(impersonatingData?.uid);

  const tenantIdLocal = impersonatingData?.uid || localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const nomeUsuario = impersonatingData?.nome || localStorage.getItem('funcName') || usuarioLogado?.displayName || "Equipe";

  const emailAdmin = "celebrefesta25@gmail.com";
  // Quando estiver em Modo Suporte, não opera como Super Admin no Dashboard para adotar a identidade do cliente
  const isSuperAdmin = !isImpersonating && (usuarioLogado?.email === emailAdmin);
  
  const [estatisticas, setEstatisticas] = useState({ acervo: 0, ativas: 0, eventos: 0, aReceber: 0, ticketMedio: 0 });
  const [atividades, setAtividades] = useState([]);
  const [faturamentoData, setFaturamentoData] = useState([0, 0, 0, 0]);
  const [proximosEventos, setProximosEventos] = useState([]);
  const [orcamentosPendentes, setOrcamentosPendentes] = useState([]);
  const [todasLocacoes, setTodasLocacoes] = useState([]);
  const [statusChart, setStatusChart] = useState({ orcamento: 0, confirmado: 0, preparacao: 0, entregue: 0, finalizado: 0, total: 0 });
  const [valoresPorStatus, setValoresPorStatus] = useState({ orcamento: 0, confirmado: 0 });
  const [topPecas, setTopPecas] = useState([]);
  const [categoriaBreakdown, setCategoriaBreakdown] = useState({ locacao: 0, estoque: 0, manutencao: 0, fixo: 0, equipe: 0, outros: 0 });
  const [cobrancasAtrasadas, setCobrancasAtrasadas] = useState([]);
  const [aniversariantesDoMes, setAniversariantesDoMes] = useState([]);
  const [aniversariantesProximos, setAniversariantesProximos] = useState([]);
  const [modalAniversariantesAberto, setModalAniversariantesAberto] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes_atual');
  const [loading, setLoading] = useState(true);

  // 🎨 PROJETOS DO MOODBOARD NO DASHBOARD
  const [projetosMoodboard, setProjetosMoodboard] = useState([]);
  const [moodboardStats, setMoodboardStats] = useState({ total: 0, aprovados: 0, emAnalise: 0, rascunhos: 0 });

  // 📱 CONTROLE DE EXIBIÇÃO DE CARDS KPI NO DASHBOARD (RECOLHER / EXPANDIR)
  const [mostrarKpiDash, setMostrarKpiDash] = useState(() => {
    try {
      const salvo = localStorage.getItem('celebre_dash_show_kpi');
      return salvo !== null ? JSON.parse(salvo) : true;
    } catch {
      return true;
    }
  });

  const toggleKpiDash = () => {
    setMostrarKpiDash(prev => {
      const next = !prev;
      try {
        localStorage.setItem('celebre_dash_show_kpi', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // 🎯 META DE FATURAMENTO MENSAL NO DASHBOARD
  const [metaMensal, setMetaMensal] = useState(() => {
    const saved = localStorage.getItem(`meta_fin_${tenantIdLocal}`);
    return saved ? Number(saved) : 15000;
  });
  const [modalMetaAberto, setModalMetaAberto] = useState(false);
  const [novaMetaInput, setNovaMetaInput] = useState('');

  const [diasTeste, setDiasTeste] = useState(1);
  const [totalDiasTeste, setTotalDiasTeste] = useState(7);
  const [diasRestantes, setDiasRestantes] = useState(7);
  const [dataFimFormatada, setDataFimFormatada] = useState('');
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
        setLoading(true);
        let idDaEmpresaCorreta = impersonatingData?.uid || localStorage.getItem('tenantId') || usuarioLogado?.uid;

        if (!isSuperAdmin) {
            const uidParaConsultar = isImpersonating ? impersonatingData.uid : usuarioLogado.uid;
            const snapUserDoc = await getDoc(doc(db, "usuarios", uidParaConsultar));
            let userData = snapUserDoc.exists() ? snapUserDoc.data() : null;

            // Se a conta for vinculada a um tenant diferente ou for funcionário/alias, busca os dados mestres
            let dadosEmpresa = userData;
            const tenantAlvo = userData?.tenantId;
            if (tenantAlvo && tenantAlvo !== uidParaConsultar) {
                idDaEmpresaCorreta = tenantAlvo;
                try {
                    const snapEmp = await getDoc(doc(db, "usuarios", tenantAlvo));
                    if (snapEmp.exists()) {
                        dadosEmpresa = snapEmp.data();
                    }
                } catch (eEmp) {
                    console.warn("Erro ao buscar dados da empresa mestre:", eEmp);
                }
            } else if (userData?.email) {
                // Caso existam contas com o mesmo e-mail, prioriza a que tiver a dataFimTeste mais atualizada
                try {
                    const qMesmoEmail = query(collection(db, "usuarios"), where("email", "==", userData.email.toLowerCase().trim()));
                    const snapMesmoEmail = await getDocs(qMesmoEmail);
                    if (snapMesmoEmail.size > 1) {
                        snapMesmoEmail.docs.forEach(docE => {
                            const dData = docE.data();
                            if (dData.assinaturaAtiva || (dData.dataFimTeste && (!dadosEmpresa?.dataFimTeste || dData.dataFimTeste > dadosEmpresa.dataFimTeste))) {
                                dadosEmpresa = dData;
                                if (dData.tenantId || docE.id) {
                                    idDaEmpresaCorreta = dData.tenantId || docE.id;
                                }
                            }
                        });
                    }
                } catch (eDup) {}
            }

            if (dadosEmpresa) {
                if (dadosEmpresa.assinaturaAtiva === true || dadosEmpresa.statusAssinatura === 'ativa') {
                    setAssinaturaAtiva(true);
                }

                if (dadosEmpresa.statusConta === 'excluido' && !isImpersonating) {
                    setStatusConta('excluido');
                    setLoading(false);
                    return;
                }

                const infoTeste = calcularPeriodoTeste(dadosEmpresa);
                setDiasTeste(infoTeste.diaAtual);
                setTotalDiasTeste(infoTeste.totalDiasTeste || 7);
                setDiasRestantes(infoTeste.diasRestantes);
                setDataFimFormatada(infoTeste.dataFimFormatada);

                const assinaturaAtiva = dadosEmpresa.assinaturaAtiva === true || 
                                        dadosEmpresa.statusAssinatura === 'ativa' || 
                                        dadosEmpresa.plano === 'pago' || 
                                        dadosEmpresa.statusPagamentoVulso === 'pago';

                if (!assinaturaAtiva && !isImpersonating) {
                    if (infoTeste.diasTranscorridos > 180) {
                        setStatusConta('excluido');
                        try {
                            await updateDoc(doc(db, "usuarios", uidParaConsultar), { statusConta: 'excluido' });
                        } catch (eErr) {}
                        setLoading(false);
                        return;
                    }

                    if (!infoTeste.emTeste) {
                        setStatusConta('bloqueado');
                        setLoading(false);
                        return;
                    }
                }
            }
        }

        if (idDaEmpresaCorreta) {
          localStorage.setItem('tenantId', idDaEmpresaCorreta);
        }

        // Constrói lista de UIDs alvo para busca multi-tenant robusta (Modo Suporte / Aliases / Google Auth)
        const uidsAlvoSet = new Set();
        if (idDaEmpresaCorreta) uidsAlvoSet.add(idDaEmpresaCorreta);
        if (usuarioLogado?.uid) uidsAlvoSet.add(usuarioLogado.uid);

        let emailAlvo = usuarioLogado?.email || '';
        const rawImp = localStorage.getItem('impersonatingTenant');
        if (rawImp) {
          try {
            const imp = JSON.parse(rawImp);
            if (imp.targetTenantId) uidsAlvoSet.add(imp.targetTenantId);
            if (imp.uid) uidsAlvoSet.add(imp.uid);
            if (imp.originalUid) uidsAlvoSet.add(imp.originalUid);
            if (Array.isArray(imp.allUids)) {
              imp.allUids.forEach(u => u && uidsAlvoSet.add(u));
            }
            if (imp.email) emailAlvo = imp.email;
          } catch (e) {}
        }

        if (emailAlvo) {
          try {
            const emailLimpo = emailAlvo.toLowerCase().trim();
            const qEmail = query(collection(db, "usuarios"), where("email", "==", emailLimpo));
            const snapEmail = await getDocs(qEmail);
            snapEmail.docs.forEach(d => {
              uidsAlvoSet.add(d.id);
              if (d.data().tenantId) uidsAlvoSet.add(d.data().tenantId);
            });
          } catch (e) {}
        }

        // BUSCA ESTOQUE E LOCAÇÕES MULTI-TENANT
        const mapEstoque = new Map();
        const mapLocacoes = new Map();
        for (const uId of uidsAlvoSet) {
          const [snapEstU, snapEstT, snapLocU, snapLocT] = await Promise.all([
            getDocs(query(collection(db, "estoque"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, "estoque"), where("tenantId", "==", uId))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, "locacoes"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, "locacoes"), where("tenantId", "==", uId))).catch(() => ({ docs: [] }))
          ]);
          [...snapEstU.docs, ...snapEstT.docs].forEach(d => mapEstoque.set(d.id, { id: d.id, ...d.data() }));
          [...snapLocU.docs, ...snapLocT.docs].forEach(d => mapLocacoes.set(d.id, { id: d.id, ...d.data() }));
        }

        const estoqueDocs = Array.from(mapEstoque.values());
        const estSnap = { docs: estoqueDocs.map(d => ({ data: () => d })), size: estoqueDocs.length };
        const locs = Array.from(mapLocacoes.values());
        setTodasLocacoes(locs);

        // BUSCA MULTI-TENANT DE COMPRAS (lista_compras) E LANÇAMENTOS (financeiro_lancamentos)
        let comprasDocs = [];
        try {
          const mapCompras = new Map();
          for (const uId of uidsAlvoSet) {
            const [snapCompU, snapCompT] = await Promise.all([
              getDocs(query(collection(db, "lista_compras"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
              getDocs(query(collection(db, "lista_compras"), where("tenantId", "==", uId))).catch(() => ({ docs: [] }))
            ]);
            [...snapCompU.docs, ...snapCompT.docs].forEach(d => mapCompras.set(d.id, { id: d.id, ...d.data() }));
          }
          comprasDocs = Array.from(mapCompras.values());
        } catch (eComp) {}

        let lancDocs = [];
        try {
          const mapLanc = new Map();
          for (const uId of uidsAlvoSet) {
            const [snapLancU, snapLancT] = await Promise.all([
              getDocs(query(collection(db, "financeiro_lancamentos"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
              getDocs(query(collection(db, "financeiro_lancamentos"), where("tenantId", "==", uId))).catch(() => ({ docs: [] }))
            ]);
            [...snapLancU.docs, ...snapLancT.docs].forEach(d => mapLanc.set(d.id, { id: d.id, ...d.data() }));
          }
          lancDocs = Array.from(mapLanc.values());
        } catch (eLanc) {}

        // BUSCA DE PROJETOS DO MOODBOARD
        try {
          let qMood = query(collection(db, "projetos_moodboard"), where("userId", "==", idDaEmpresaCorreta));
          let moodSnap = await getDocs(qMood);
          if (moodSnap.empty) {
            const qMoodT = query(collection(db, "projetos_moodboard"), where("tenantId", "==", idDaEmpresaCorreta));
            const moodSnapT = await getDocs(qMoodT);
            if (!moodSnapT.empty) moodSnap = moodSnapT;
          }
          const moodList = moodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          moodList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          setProjetosMoodboard(moodList);
          setMoodboardStats({
            total: moodList.length,
            aprovados: moodList.filter(m => m.status === 'aprovado').length,
            emAnalise: moodList.filter(m => m.status === 'em_analise').length,
            rascunhos: moodList.filter(m => (m.status || 'rascunho') === 'rascunho').length
          });
        } catch (eMood) {
          console.warn("Erro ao buscar projetos moodboard no dashboard:", eMood);
        }



        const agoraObj = new Date();
        const hojeISO = agoraObj.toISOString().split('T')[0];

        // LÓGICA DE FILTRO DE DATA POR PERÍODO SELECIONADO (HORÁRIO LOCAL)
        const pertenceAoPeriodo = (dateObj, itemStatus) => {
          if (filtroPeriodo === 'todos') return true;
          const statusStr = (itemStatus || '').toLowerCase().trim();
          const ehAtivoEmAndamento = ['confirmado', 'preparacao', 'separacao', 'entregue'].includes(statusStr);

          // Se for uma locação ativa em andamento, garante inclusão nos filtros do mês/30 dias
          if (ehAtivoEmAndamento && (filtroPeriodo === 'mes_atual' || filtroPeriodo === 'ultimos_30')) {
            return true;
          }

          if (!dateObj || isNaN(dateObj.getTime())) {
            return filtroPeriodo === 'mes_atual' || filtroPeriodo === 'ano_atual' || filtroPeriodo === 'todos';
          }

          if (filtroPeriodo === 'hoje') {
            return dateObj.getDate() === agoraObj.getDate() &&
                   dateObj.getMonth() === agoraObj.getMonth() &&
                   dateObj.getFullYear() === agoraObj.getFullYear();
          } else if (filtroPeriodo === 'ultimos_30') {
            const diffMs = Math.abs(agoraObj.getTime() - dateObj.getTime());
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            return diffDays <= 30;
          } else if (filtroPeriodo === 'ano_atual') {
            return dateObj.getFullYear() === agoraObj.getFullYear();
          } else {
            // 'mes_atual' (padrão)
            return dateObj.getMonth() === agoraObj.getMonth() &&
                   dateObj.getFullYear() === agoraObj.getFullYear();
          }
        };

        const locsNoPeriodo = locs.filter(l => {
          const rawData = l.dataRetirada || l.dataEvento || l.criadoEm || l.data;
          const dateObj = rawData ? parseFirestoreDate(rawData) : null;
          return pertenceAoPeriodo(dateObj, l.status);
        });


        const confirmadas = locs.filter(l => l.status === 'confirmado' || l.status === 'preparacao' || l.status === 'entregue' || l.status === 'finalizado');
        const confirmadasNoPeriodo = locsNoPeriodo.filter(l => l.status === 'confirmado' || l.status === 'preparacao' || l.status === 'entregue' || l.status === 'finalizado');
        const orcamentos = locsNoPeriodo.filter(l => (l.status || '').toLowerCase().trim() === 'orcamento' || (l.status || '').toLowerCase().trim() === 'orçamento');

        // CONTAGEM COMPLETA DE TODOS OS STATUS (INCLUINDO ARQUIVADOS E LIXEIRA)
        let cOrcamento = 0, cConfirmado = 0, cPreparacao = 0, cEntregue = 0, cFinalizado = 0, cArquivado = 0, cLixeira = 0;
        let vOrcamento = 0, vConfirmado = 0;
        
        locsNoPeriodo.forEach(l => {
          const s = (l.status || '').toLowerCase().trim();
          const valorLoc = Number(l.valorTotal || l.total || 0);

          if (s === 'orcamento' || s === 'orçamento') { cOrcamento++; vOrcamento += valorLoc; }
          else if (s === 'confirmado') { cConfirmado++; vConfirmado += valorLoc; }
          else if (s === 'preparacao' || s === 'preparação' || s === 'separacao' || s === 'separação') { cPreparacao++; }
          else if (s === 'entregue') { cEntregue++; }
          else if (s === 'finalizado') { cFinalizado++; }
          else if (s === 'arquivado' || s === 'arquivados') { cArquivado++; }
          else if (s === 'lixeira' || s === 'deletado' || s === 'cancelado' || s === 'perdido') { cLixeira++; }
          else { cConfirmado++; }
        });
        
        setStatusChart({
          orcamento: cOrcamento, 
          confirmado: cConfirmado, 
          preparacao: cPreparacao, 
          entregue: cEntregue, 
          finalizado: cFinalizado, 
          arquivado: cArquivado,
          lixeira: cLixeira,
          total: locsNoPeriodo.length
        });
        setValoresPorStatus({ orcamento: vOrcamento, confirmado: vConfirmado });

        // CÁLCULO COMPARATIVO: FATURAMENTO (RECEITAS) VS GASTOS (DESPESAS/SAÍDAS)
        let barDataFinal = [];

        if (filtroPeriodo === 'hoje') {
          const fatHoje = [0, 0, 0, 0];
          const gastosHoje = [0, 0, 0, 0];

          confirmadasNoPeriodo.forEach(l => {
            const rawData = l.dataRetirada || l.dataEvento || l.criadoEm;
            const valorTotal = Number(l.valorTotal || 0);
            const d = rawData ? parseFirestoreDate(rawData) : null;
            const h = (d && !isNaN(d.getTime())) ? d.getHours() : 12;
            if (h < 6) fatHoje[0] += valorTotal;
            else if (h < 12) fatHoje[1] += valorTotal;
            else if (h < 18) fatHoje[2] += valorTotal;
            else fatHoje[3] += valorTotal;
          });

          const somarGastoHoje = (val, dateVal) => {
            if (!val || val <= 0) return;
            const d = parseFirestoreDate(dateVal);
            if (d && !isNaN(d.getTime()) && pertenceAoPeriodo(d)) {
              const h = d.getHours();
              if (h < 6) gastosHoje[0] += val;
              else if (h < 12) gastosHoje[1] += val;
              else if (h < 18) gastosHoje[2] += val;
              else gastosHoje[3] += val;
            }
          };

          comprasDocs.forEach(comp => {
            const statusLimpo = comp.status ? String(comp.status).toLowerCase().trim() : '';
            if (statusLimpo !== 'cancelado') {
              const qtd = Number(comp.quantidade) || 1;
              const valorUnit = Number(comp.valorEstimado) || Number(comp.valorTotal) || Number(comp.valor) || 0;
              let val = Number(comp.valorTotal) || (qtd * valorUnit);
              somarGastoHoje(val, comp.dataCompra || comp.createdAt || comp.prazo || comp.data);
            }
          });

          estSnap.docs.forEach(docEst => {
            const itemEst = docEst.data();
            const valCusto = Number(itemEst.custoManutencao || itemEst.custoManut || itemEst.valorManutencao || itemEst.custoReparo || 0);
            somarGastoHoje(valCusto, itemEst.updatedAt || itemEst.dataManutencao || itemEst.criadoEm);
          });

          lancDocs.forEach(lan => {
            let valorLimpo = String(lan.valor || '0').replace(/[^\d,-]/g, '').replace(',', '.');
            const valorLan = Math.abs(Number(valorLimpo)) || 0;
            const isReceita = lan.tipo === 'receita' || lan.categoria === 'Locação' || lan.tipo === 'entrada';
            if (!isReceita) somarGastoHoje(valorLan, lan.data || lan.createdAt);
          });

          barDataFinal = [
            { semana: '00h-06h', faturamento: fatHoje[0], gastos: gastosHoje[0] },
            { semana: '06h-12h', faturamento: fatHoje[1], gastos: gastosHoje[1] },
            { semana: '12h-18h', faturamento: fatHoje[2], gastos: gastosHoje[2] },
            { semana: '18h-24h', faturamento: fatHoje[3], gastos: gastosHoje[3] }
          ];

        } else if (filtroPeriodo === 'ano_atual' || filtroPeriodo === 'todos') {
          const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          const fatMensal = Array(12).fill(0);
          const gastosMensal = Array(12).fill(0);

          confirmadasNoPeriodo.forEach(l => {
            const rawData = l.dataRetirada || l.dataEvento || l.criadoEm;
            const valorTotal = Number(l.valorTotal || 0);
            if (rawData) {
              const d = parseFirestoreDate(rawData);
              if (d && !isNaN(d.getTime())) {
                fatMensal[d.getMonth()] += valorTotal;
              } else {
                fatMensal[agoraObj.getMonth()] += valorTotal;
              }
            } else {
              fatMensal[agoraObj.getMonth()] += valorTotal;
            }
          });

          const somarGastoMensal = (val, dateVal) => {
            if (!val || val <= 0) return;
            const d = parseFirestoreDate(dateVal);
            if (d && !isNaN(d.getTime()) && pertenceAoPeriodo(d)) {
              gastosMensal[d.getMonth()] += val;
            }
          };

          comprasDocs.forEach(comp => {
            const statusLimpo = comp.status ? String(comp.status).toLowerCase().trim() : '';
            if (statusLimpo !== 'cancelado') {
              const qtd = Number(comp.quantidade) || 1;
              const valorUnit = Number(comp.valorEstimado) || Number(comp.valorTotal) || Number(comp.valor) || 0;
              let val = Number(comp.valorTotal) || (qtd * valorUnit);
              somarGastoMensal(val, comp.dataCompra || comp.createdAt || comp.prazo || comp.data);
            }
          });

          estSnap.docs.forEach(docEst => {
            const itemEst = docEst.data();
            const valCusto = Number(itemEst.custoManutencao || itemEst.custoManut || itemEst.valorManutencao || itemEst.custoReparo || 0);
            somarGastoMensal(valCusto, itemEst.updatedAt || itemEst.dataManutencao || itemEst.criadoEm);
          });

          lancDocs.forEach(lan => {
            let valorLimpo = String(lan.valor || '0').replace(/[^\d,-]/g, '').replace(',', '.');
            const valorLan = Math.abs(Number(valorLimpo)) || 0;
            const isReceita = lan.tipo === 'receita' || lan.categoria === 'Locação' || lan.tipo === 'entrada';
            if (!isReceita) somarGastoMensal(valorLan, lan.data || lan.createdAt);
          });

          barDataFinal = mesesNomes.map((mes, idx) => ({ 
            semana: mes, 
            faturamento: fatMensal[idx],
            gastos: gastosMensal[idx]
          }));

        } else {
          // 'mes_atual' ou 'ultimos_30'
          const fatSemanal = [0, 0, 0, 0];
          const gastosSemanal = [0, 0, 0, 0];

          confirmadasNoPeriodo.forEach(l => {
            const rawData = l.dataRetirada || l.dataEvento || l.criadoEm;
            const valorTotal = Number(l.valorTotal || 0);
            if (rawData) {
              const d = parseFirestoreDate(rawData);
              if (d && !isNaN(d.getTime())) {
                const dia = d.getDate();
                if (dia <= 7) fatSemanal[0] += valorTotal;
                else if (dia <= 14) fatSemanal[1] += valorTotal;
                else if (dia <= 21) fatSemanal[2] += valorTotal;
                else fatSemanal[3] += valorTotal;
              } else {
                fatSemanal[0] += valorTotal;
              }
            } else {
              fatSemanal[0] += valorTotal;
            }
          });

          const somarGastoSemana = (val, dateVal) => {
            if (!val || val <= 0) return;
            const d = parseFirestoreDate(dateVal);
            if (d && !isNaN(d.getTime()) && pertenceAoPeriodo(d)) {
              const dia = d.getDate();
              if (dia <= 7) gastosSemanal[0] += val;
              else if (dia <= 14) gastosSemanal[1] += val;
              else if (dia <= 21) gastosSemanal[2] += val;
              else gastosSemanal[3] += val;
            }
          };

          comprasDocs.forEach(comp => {
            const statusLimpo = comp.status ? String(comp.status).toLowerCase().trim() : '';
            if (statusLimpo !== 'cancelado') {
              const qtd = Number(comp.quantidade) || 1;
              const valorUnit = Number(comp.valorEstimado) || Number(comp.valorTotal) || Number(comp.valor) || 0;
              let val = Number(comp.valorTotal) || (qtd * valorUnit);
              somarGastoSemana(val, comp.dataCompra || comp.createdAt || comp.prazo || comp.data);
            }
          });

          estSnap.docs.forEach(docEst => {
            const itemEst = docEst.data();
            const valCusto = Number(itemEst.custoManutencao || itemEst.custoManut || itemEst.valorManutencao || itemEst.custoReparo || 0);
            somarGastoSemana(valCusto, itemEst.updatedAt || itemEst.dataManutencao || itemEst.criadoEm);
          });

          lancDocs.forEach(lan => {
            let valorLimpo = String(lan.valor || '0').replace(/[^\d,-]/g, '').replace(',', '.');
            const valorLan = Math.abs(Number(valorLimpo)) || 0;
            const isReceita = lan.tipo === 'receita' || lan.categoria === 'Locação' || lan.tipo === 'entrada';
            if (!isReceita) somarGastoSemana(valorLan, lan.data || lan.createdAt);
          });

          barDataFinal = [
            { semana: 'Semana 1', faturamento: fatSemanal[0], gastos: gastosSemanal[0] },
            { semana: 'Semana 2', faturamento: fatSemanal[1], gastos: gastosSemanal[1] },
            { semana: 'Semana 3', faturamento: fatSemanal[2], gastos: gastosSemanal[2] },
            { semana: 'Semana 4', faturamento: fatSemanal[3], gastos: gastosSemanal[3] }
          ];
        }



        let totalAReceber = 0;
        let faturamentoGeral = 0;
        let qtdVendasGeral = 0;
        const contagemItens = {};
        const atrasados = [];
        
        confirmadasNoPeriodo.forEach(l => {
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

            if (devendo > 0.01) {
              totalAReceber += devendo;
              if (dataFesta && dataFesta < hojeISO && l.status !== 'cancelado') {
                  const nomeCerto = l.clienteNome || l.cliente?.nome || l.razaoSocial || l.nomeFantasia || l.nome || 'Cliente Não Identificado';
                  const fone = l.clienteCelular || l.clientePhone || l.cliente?.celular || '';
                  atrasados.push({ id: l.id, cliente: nomeCerto, data: dataFesta.split('-').reverse().join('/'), valor: devendo, fone });
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
            
        const recents = confirmadasNoPeriodo
            .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
            .slice(0, 5)
            .map(l => ({ 
                id: l.id,
                txt: l.clienteNome || 'Cliente Não Informado', 
                valor: l.valorTotal ? `R$ ${Number(l.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '',
                status: l.status || 'confirmado'
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
            
        // CÁLCULO DE CATEGORIA BREAKDOWN DE ENTRADAS E SAÍDAS PARA O BI NO DASHBOARD
        let catBreak = { locacao: 0, estoque: 0, manutencao: 0, fixo: 0, equipe: 0, outros: 0 };
        
        confirmadasNoPeriodo.forEach(l => {
          catBreak.locacao += Number(l.valorTotal || l.total || 0);
        });

        comprasDocs.forEach(c => {
          const statusLimpo = c.status ? String(c.status).toLowerCase().trim() : '';
          if (statusLimpo !== 'cancelado') {
            const qtd = Number(c.quantidade) || 1;
            const valorUnit = Number(c.valorEstimado) || Number(c.valorTotal) || Number(c.valor) || 0;
            const total = Number(c.valorTotal) || (qtd * valorUnit);
            catBreak.estoque += total;
          }
        });

        lancDocs.forEach(l => {
          const val = Number(l.valor || 0);
          const catLower = (l.categoria || '').toLowerCase();
          if (catLower.includes('manutenç') || catLower.includes('reparo')) {
            catBreak.manutencao += val;
          } else if (catLower.includes('fixa') || catLower.includes('aluguel') || catLower.includes('luz') || catLower.includes('infra')) {
            catBreak.fixo += val;
          } else if (catLower.includes('equipe') || catLower.includes('salário') || catLower.includes('pessoal')) {
            catBreak.equipe += val;
          } else if (catLower.includes('estoque') || catLower.includes('acervo') || catLower.includes('compra')) {
            catBreak.estoque += val;
          } else if (catLower.includes('locaç') || catLower.includes('evento')) {
            catBreak.locacao += val;
          } else {
            catBreak.outros += val;
          }
        });

        setCategoriaBreakdown(catBreak);

        setEstatisticas({
            acervo: estSnap.size,
            ativas: confirmadasNoPeriodo.filter(l => l.status === 'confirmado' || l.status === 'preparacao').length,
            eventos: proximos.length,
            aReceber: totalAReceber,
            ticketMedio: qtdVendasGeral > 0 ? (faturamentoGeral / qtdVendasGeral) : 0,
            emOrcamento: vOrcamento
        });
        
        setFaturamentoData(barDataFinal);
        setAtividades(recents);
        setProximosEventos(proximos);
        setOrcamentosPendentes(orcamentosRecentes);
        setTopPecas(rankingPecas);
        setCobrancasAtrasadas(atrasados.sort((a, b) => b.valor - a.valor).slice(0, 5));

        
        // BUSCA MULTI-TENANT DE CLIENTES E ANIVERSARIANTES
        try {
          const mapClientesDash = new Map();
          for (const uId of uidsAlvoSet) {
            const [snapCliU, snapCliT] = await Promise.all([
              getDocs(query(collection(db, "clientes"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
              getDocs(query(collection(db, "clientes"), where("tenantId", "==", uId))).catch(() => ({ docs: [] }))
            ]);
            [...snapCliU.docs, ...snapCliT.docs].forEach(d => {
              mapClientesDash.set(d.id, { ...d.data(), id: d.id });
            });
          }
          const todosClientesDash = Array.from(mapClientesDash.values());

          const hoje = new Date();
          const mesHoje = hoje.getMonth();
          const diaHoje = hoje.getDate();

          // Filtra todos os aniversariantes do mês atual
          const todosDoMes = todosClientesDash.filter(c => {
            const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.data_nascimento || c.dataAniversario || c.aniversario || c.nasc;
            const { mes } = extrairMesDia(dataVal);
            return mes === mesHoje;
          }).sort((a, b) => {
            const valA = a.nascimento || a.dataNascimento || a.dataNasc || a.data_nascimento || a.dataAniversario || a.aniversario || a.nasc;
            const valB = b.nascimento || b.dataNascimento || b.dataNasc || b.data_nascimento || b.dataAniversario || b.aniversario || b.nasc;
            const diaA = extrairMesDia(valA).dia;
            const diaB = extrairMesDia(valB).dia;
            
            // Prioriza aniversários a partir de hoje (futuros no mês), depois os que já passaram
            const aFuturo = diaA >= diaHoje;
            const bFuturo = diaB >= diaHoje;
            if (aFuturo && !bFuturo) return -1;
            if (!aFuturo && bFuturo) return 1;
            return diaA - diaB;
          });

          // Aniversariantes próximos (próximos 7 dias para maior utilidade)
          const proximosAnivs = todosDoMes.filter(c => {
            const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.data_nascimento || c.dataAniversario || c.aniversario || c.nasc;
            const { dia } = extrairMesDia(dataVal);
            return dia >= diaHoje && dia <= diaHoje + 7;
          });

          setAniversariantesDoMes(todosDoMes);
          setAniversariantesProximos(proximosAnivs);
        } catch (errAniv) {
          console.warn("Aviso ao carregar aniversariantes:", errAniv);
        }

        // 🎯 CARREGA META FINANCEIRA
        try {
          const qConfig = query(collection(db, "financeiro_config"), where("userId", "==", idDaEmpresaCorreta));
          const snapConfig = await getDocs(qConfig);
          if (!snapConfig.empty) {
            const dConf = snapConfig.docs[0].data();
            if (dConf.metaMensal) {
              setMetaMensal(Number(dConf.metaMensal));
              localStorage.setItem(`meta_fin_${idDaEmpresaCorreta}`, String(dConf.metaMensal));
            }
          }
        } catch (errConf) {
          console.warn("Aviso ao carregar meta financeira no dashboard:", errConf);
        }
        
      } catch (e) { 
          console.error("Erro dashboard:", e);
          setErroCarregamento(e.message || String(e));
      } finally {  
          setLoading(false); 
      }
    };
    
    carregarDados();
  }, [usuarioLogado?.uid, filtroPeriodo]);

  // 🎯 SALVAR META FINANCEIRA DIRETO NO DASHBOARD
  const handleSalvarMeta = async (e) => {
    e.preventDefault();
    const val = Number(String(novaMetaInput).replace(',', '.'));
    if (!val || val <= 0) {
      alert("Por favor, digite um valor válido para a meta.");
      return;
    }
    try {
      setMetaMensal(val);
      localStorage.setItem(`meta_fin_${tenantIdLocal}`, String(val));
      
      const qConfig = query(collection(db, "financeiro_config"), where("userId", "==", tenantIdLocal));
      const snap = await getDocs(qConfig);
      if (!snap.empty) {
        await updateDoc(doc(db, "financeiro_config", snap.docs[0].id), {
          metaMensal: val,
          atualizadoEm: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "financeiro_config"), {
          userId: tenantIdLocal,
          metaMensal: val,
          criadoEm: serverTimestamp()
        });
      }
      setModalMetaAberto(false);
    } catch (err) {
      console.error("Erro ao salvar meta:", err);
      alert("Erro ao salvar meta financeira.");
    }
  };


  if (loading) return <div className="loading-v3">Atualizando central de comando VIP...</div>;

  if (statusConta === 'excluido') {
      return (
          <div className="dash-wide-container dash-status-screen fade-in">
              <div className="dash-status-card dash-status-card--danger">
                  <h2>🚫 Conta Desativada</h2>
                  <p>Seu período de inatividade ultrapassou <strong>6 meses</strong>. Por segurança, a conta foi suspensa.</p>
              </div>
          </div>
      );
  }

  if (statusConta === 'bloqueado') {
      return (
          <div className="dash-wide-container dash-status-screen fade-in">
              <div className="dash-status-card dash-status-card--warning">
                  <h2>⏳ Seu período de teste expirou!</h2>
                  <p>Para continuar gerenciando seus eventos no Celebre, escolha o seu plano.</p>
                  <button onClick={() => navigate('/planos')} className="dash-status-btn">Ver Planos e Assinar</button>
              </div>
        </div>
      );
  }

  const dataFaturamentoBar = Array.isArray(faturamentoData) ? faturamentoData : [];

  const dataStatusDonut = [
    { name: 'Confirmados', value: statusChart.confirmado, color: '#10b981' },
    { name: 'Separação', value: statusChart.preparacao, color: '#8b5cf6' },
    { name: 'Orçamentos', value: statusChart.orcamento, color: '#f59e0b' },
    { name: 'Entregues', value: statusChart.entregue, color: '#ec4899' },
    { name: 'Finalizados', value: statusChart.finalizado, color: '#3b82f6' },
    { name: 'Arquivados', value: statusChart.arquivado || 0, color: '#64748b' },
    { name: 'Lixeira/Perdidos', value: statusChart.lixeira || 0, color: '#ef4444' }
  ].filter(i => i.value > 0);

  const pctConfirmados = statusChart.total > 0 
    ? Math.round(((statusChart.confirmado + statusChart.preparacao + statusChart.entregue + statusChart.finalizado) / statusChart.total) * 100)
    : 100;

  const totalFatPeriodo = dataFaturamentoBar.reduce((a, b) => a + (Number(b.faturamento) || 0), 0);
  const totalGastosPeriodo = dataFaturamentoBar.reduce((a, b) => a + (Number(b.gastos) || 0), 0);

  return (
    <div className="dash-wide-container fade-in">
      {!isSuperAdmin && !assinaturaAtiva && statusConta !== 'bloqueado' && statusConta !== 'excluido' && diasRestantes > 0 && (
        <div className="dash-trial-banner">
          ⏳ Você está no dia {diasTeste} de {totalDiasTeste} do seu teste gratuito ({diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}). Aproveite!
        </div>
      )}

      <AuditoriaEstoque />

      {/* HEADER COMPACTO */}
      <header className="dash-wide-header">
        <div className="header-titles">
          <h1>Olá, {nomeUsuario}! 👋</h1>
          <p>Central de Comando &amp; Inteligência Celebre.</p>
        </div>

        <div className="dash-actions-container-mobile">
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="select-periodo-dash"
          >
            <option value="mes_atual">📅 Este Mês</option>
            <option value="ultimos_30">📅 Últimos 30 Dias</option>
            <option value="hoje">⚡ Hoje</option>
            <option value="ano_atual">📊 Este Ano</option>
            <option value="todos">🌐 Todo o Histórico</option>
          </select>

          <div className="dash-quick-actions-grid">
            <button className="btn-dash-quick-action" onClick={() => navigate('/cadastro-cliente')} title="Novo Cliente">
              <i className="fas fa-user-plus"></i> CLIENTE
            </button>
            <button className="btn-dash-quick-action" onClick={() => navigate('/locacoes/nova')} title="Nova Locação">
              <i className="fas fa-shopping-cart"></i> LOCAÇÃO
            </button>
            <button className="btn-dash-quick-action" onClick={() => navigate('/cadastro-estoque')} title="Novo Item">
              <i className="fas fa-box-open"></i> ITEM
            </button>
          </div>
        </div>
      </header>

      {/* 📱 CONTROLE DE RECOLHER / EXPANDIR CARDS KPI */}
      <div className="kpi-dash-toggle-wrapper">
        <button 
          type="button" 
          className={`btn-toggle-kpi-dash ${!mostrarKpiDash ? 'is-collapsed' : ''}`}
          onClick={toggleKpiDash}
          aria-expanded={mostrarKpiDash}
          title={mostrarKpiDash ? "Recolher cards de indicadores" : "Expandir cards de indicadores"}
        >
          <div className="toggle-kpi-left">
            <span className="toggle-kpi-icon">📊</span>
            {mostrarKpiDash ? (
              <span className="toggle-kpi-title">Resumo de Indicadores da Empresa</span>
            ) : (
              <span className="toggle-kpi-summary">
                <strong>{estatisticas.acervo}</strong> peças • <strong>{estatisticas.ativas}</strong> ativas • <strong>R$ {estatisticas.aReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> a receber
              </span>
            )}
          </div>
          <span className="toggle-kpi-badge">
            {mostrarKpiDash ? (
              <>Ocultar <i className="fas fa-chevron-up"></i></>
            ) : (
              <>Expandir <i className="fas fa-chevron-down"></i></>
            )}
          </span>
        </button>
      </div>

      {/* 6 KPI CARDS COMPACTOS (1 LINHA NO DESKTOP / 2 COLUNAS NO MOBILE) */}
      {mostrarKpiDash && (
        <div className="stats-wide-row fade-in">
          <div className="stat-card-pro border-gold">
            <span className="stat-title">Acervo Total</span>
            <div className="stat-value-row">
              <div className="stat-icon-wrapper icon-gold"><i className="fas fa-boxes"></i></div>
              <strong className="stat-value">{estatisticas.acervo}</strong>
            </div>
            <span className="stat-sub">📦 Peças</span>
          </div>

          <div className="stat-card-pro border-blue">
            <span className="stat-title">Locações Ativas</span>
            <div className="stat-value-row">
              <div className="stat-icon-wrapper icon-blue"><i className="fas fa-shopping-bag"></i></div>
              <strong className="stat-value">{estatisticas.ativas}</strong>
            </div>
            <span className="stat-sub">⚡ Andamento</span>
          </div>

          <div className="stat-card-pro border-green">
            <span className="stat-title">Próx. Eventos</span>
            <div className="stat-value-row">
              <div className="stat-icon-wrapper icon-green"><i className="fas fa-calendar-check"></i></div>
              <strong className="stat-value">{estatisticas.eventos}</strong>
            </div>
            <span className="stat-sub">📅 7 dias</span>
          </div>

          <div className="stat-card-pro border-purple">
            <span className="stat-title">Ticket Médio</span>
            <div className="stat-value-row">
              <div className="stat-icon-wrapper icon-purple"><i className="fas fa-chart-line"></i></div>
              <strong className="stat-value">
                <span className="stat-cur">R$</span> {estatisticas.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>
            <span className="stat-sub">▲ Por pedido</span>
          </div>

          <div className="stat-card-pro border-amber">
            <span className="stat-title">Orçamentos</span>
            <div className="stat-value-row">
              <div className="stat-icon-wrapper icon-amber"><i className="fas fa-file-invoice-dollar"></i></div>
              <strong className="stat-value">
                <span className="stat-cur">R$</span> {(estatisticas.emOrcamento || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>
            <span className="stat-sub">📋 Pipeline</span>
          </div>

          <div className="stat-card-pro border-red">
            <span className="stat-title">A Receber</span>
            <div className="stat-value-row">
              <div className="stat-icon-wrapper icon-red"><i className="fas fa-exclamation-circle"></i></div>
              <strong className="stat-value">
                <span className="stat-cur">R$</span> {estatisticas.aReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </strong>
            </div>
            <span className="stat-sub">{estatisticas.aReceber > 0 ? '⚠️ Pendente' : '🟢 Adimplente'}</span>
          </div>
        </div>
      )}

      {/* 🎯 TERMÔMETRO DE META FINANCEIRA MENSAL NO DASHBOARD */}
      {(() => {
        const metaAlvo = metaMensal > 0 ? metaMensal : 15000;
        const fatMes = totalFatPeriodo || 0;
        const pctMeta = Math.min(100, Math.round((fatMes / metaAlvo) * 100));
        const faltaMeta = Math.max(0, metaAlvo - fatMes);
        const metaBatida = fatMes >= metaAlvo;

        return (
          <div className="dash-meta-card fade-in">
            <div className="dash-meta-header">
              <div className="dash-meta-title-box">
                <span className="dash-meta-icon">🎯</span>
                <div>
                  <h4 className="dash-meta-title">Meta de Faturamento Mensal</h4>
                  <p className="dash-meta-sub">
                    {metaBatida ? (
                      <span className="meta-sub-success">🏆 Parabéns! Meta de faturamento alcançada!</span>
                    ) : (
                      <>
                        <span>Faturamento atual: <strong>R$ {fatMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                        <span className="dash-meta-bullet">•</span>
                        <span>Faltam <strong>R$ {faltaMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="dash-meta-actions">
                <span className={`dash-meta-badge ${metaBatida ? 'batida' : ''}`}>
                  {pctMeta}% Atingido
                </span>
                <button 
                  type="button" 
                  className="btn-ajustar-meta-dash"
                  onClick={() => { setNovaMetaInput(String(metaAlvo)); setModalMetaAberto(true); }}
                  title="Alterar valor da meta mensal"
                >
                  <i className="fas fa-cog"></i> Meta: R$ {metaAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </button>
              </div>
            </div>

            <div className="dash-meta-bar-track">
              <div 
                className={`dash-meta-bar-fill ${metaBatida ? 'gold-fill' : ''}`}
                style={{ width: `${pctMeta}%` }}
              ></div>
            </div>
          </div>
        );
      })()}

      {/* GRID PRINCIPAL: 2 COLUNAS */}
      <div className="dash-main-grid-wide">

        {/* ══════════ COLUNA ESQUERDA (40%) ══════════ */}
        <div className="dash-column">

          {/* 📊 GRÁFICO FATURAMENTO VS GASTOS */}
          <section className="dash-card-wide chart-card" style={{ minHeight: '240px', paddingBottom: '14px' }}>
            <div className="dash-section-header">
              <div>
                <h3 style={{ margin: 0 }}>📊 Faturamento vs Gastos</h3>
                <p className="card-subtitle" style={{ margin: '1px 0 0 0' }}>Receita (azul) × Despesas (vermelho)</p>
              </div>
              <span className="fat-vs-gastos-badge">
                <span className="val-receita">R$ {totalFatPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span className="val-sep">|</span>
                <span className="val-despesa">R$ {totalGastosPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </span>
            </div>

            <div style={{ width: '100%', height: '160px', marginTop: '8px' }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dataFaturamentoBar} margin={{ top: 8, right: 8, left: -10, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--borda, #e2e8f0)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 9.5, fill: 'var(--texto-secundario, #64748b)' }} axisLine={false} tickLine={false} dy={2} />
                  <YAxis tick={{ fontSize: 9.5, fill: 'var(--texto-secundario, #64748b)' }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                  <Tooltip content={<CustomTooltipFat />} />
                  <Bar dataKey="faturamento" name="Faturamento" fill="#2563eb" radius={[3, 3, 0, 0]} barSize={12} />
                  <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 🎯 CONVERSÃO & STATUS */}
          <section className="dash-card-wide dash-card-column" style={{ minHeight: '215px' }}>
            <div className="dash-section-header">
              <h3 style={{ margin: 0 }}>🎯 Conversão &amp; Status</h3>
              <span className="dash-count-pill">
                {statusChart.total} {filtroPeriodo === 'hoje' ? 'HOJE' : 'NO PERÍODO'}
              </span>
            </div>

            <div className="status-donut-container-horizontal">
              <div className="status-donut-left">
                <div style={{ width: '90px', height: '90px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height={90}>
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={dataStatusDonut.length > 0 ? dataStatusDonut : [{ name: 'Sem Pedidos', value: 1, color: '#e2e8f0' }]}
                        innerRadius={26} outerRadius={42} cx="50%" cy="50%"
                        paddingAngle={dataStatusDonut.length > 1 ? 3 : 0} dataKey="value"
                      >
                        {(dataStatusDonut.length > 0 ? dataStatusDonut : [{ color: '#e2e8f0' }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltipDonut />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--texto-principal, #0f172a)', fontWeight: 900, display: 'block', lineHeight: 1 }}>
                      {statusChart.total > 0 ? `${pctConfirmados}%` : '0%'}
                    </strong>
                    <span style={{ fontSize: '0.52rem', color: 'var(--texto-secundario, #64748b)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '2px', display: 'block' }}>
                      {statusChart.total > 0 ? 'Fechados' : 'Sem dados'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="status-info-right">
                <div className="status-list-grid">
                  <div className="status-item-row"><span className="dot" style={{ background: '#10b981' }}></span> <span>Confirmados</span> <strong>{statusChart.confirmado}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#8b5cf6' }}></span> <span>Separação</span> <strong>{statusChart.preparacao}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#f59e0b' }}></span> <span>Orçamentos</span> <strong>{statusChart.orcamento}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#ec4899' }}></span> <span>Entregues</span> <strong>{statusChart.entregue}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#3b82f6' }}></span> <span>Finalizados</span> <strong>{statusChart.finalizado}</strong></div>
                </div>
              </div>
            </div>
          </section>

          {/* 📝 ORÇAMENTOS PENDENTES */}
          <section className="dash-card-wide" style={{ flex: '1' }}>
            <h3>📝 Orçamentos Pendentes</h3>
            <div className="activity-feed">
              {orcamentosPendentes.length > 0 ? (
                orcamentosPendentes.slice(0, 4).map((orc, i) => (
                  <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${orc.id}`)}>
                    <div className="feed-icon warning-icon">🔔</div>
                    <div className="feed-info">
                      <p>{orc.clienteNome || 'Sem Nome'}</p>
                      <span className="feed-sub">{orc.dataRetirada ? orc.dataRetirada.split('-').reverse().join('/') : '?'}</span>
                    </div>
                    <span className="feed-valor" style={{ color: '#d97706' }}>
                      R$ {Number(orc.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="empty-feed">🗒️ Nenhum orçamento pendente.</p>
              )}
            </div>
          </section>

        </div>

        {/* ══════════ COLUNA DIREITA (60%) ══════════ */}
        <div className="dash-column">

          {/* SUB-GRID 2x2 (cima: pedidos + radar / baixo: aniversários + ranking) */}
          <div className="dash-right-subgrid" style={{ flex: '2' }}>

            {/* 📋 PEDIDOS RECENTES */}
            <section className="dash-card-wide">
              <div className="dash-section-header">
                <h3 style={{ margin: 0 }}>📋 Pedidos Recentes</h3>
                <button onClick={() => navigate('/locacoes')} className="btn-ver-todos-anivs">
                  Todos ({todasLocacoes.length})
                </button>
              </div>
              <div className="activity-feed">
                {atividades.length > 0 ? (
                  atividades.slice(0, 5).map((a, i) => (
                    <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${a.id}`)}>
                      <div className="feed-icon blue-icon">🛍️</div>
                      <div className="feed-info">
                        <p>{a.txt}</p>
                        <span className="feed-sub" style={{ color: '#10b981', fontWeight: 700 }}>{a.status.toUpperCase()}</span>
                      </div>
                      {a.valor && <span className="feed-valor">{a.valor}</span>}
                    </div>
                  ))
                ) : (
                  <p className="empty-feed">🛍️ Nenhuma locação recente.</p>
                )}
              </div>
            </section>

            {/* 🚨 RADAR DE COBRANÇA */}
            <section className="dash-card-wide">
              <h3>🚨 Radar de Cobrança</h3>
              <div className="activity-feed">
                {cobrancasAtrasadas.length > 0 ? (
                  cobrancasAtrasadas.slice(0, 5).map((cob, i) => {
                    const fone = cob.fone ? cob.fone.replace(/\D/g, '') : '';
                    const msg = encodeURIComponent(`Olá ${cob.cliente}! Verificamos pendência de R$ ${cob.valor.toFixed(2)} referente ao evento dia ${cob.data}. Podemos enviar a chave PIX?`);
                    const zap = `https://wa.me/55${fone}?text=${msg}`;
                    return (
                      <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${cob.id}`)}>
                        <div className="feed-icon danger-icon">⚠️</div>
                        <div className="feed-info">
                          <p>{cob.cliente}</p>
                          <span className="feed-sub">{cob.data}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span className="feed-valor feed-valor--danger">R$ {cob.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                          {cob.fone && (
                            <a href={zap} target="_blank" rel="noopener noreferrer" className="btn-dispatch-zap" onClick={e => e.stopPropagation()} style={{ padding: '1px 6px', fontSize: '0.62rem' }}>
                              <i className="fab fa-whatsapp"></i>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-feed empty-feed--success">✅ Sem atrasos.</p>
                )}
              </div>
            </section>

            {/* 🎂 ANIVERSÁRIOS */}
            <section className="dash-card-wide crm-birthday-card-dash">
              <div className="dash-section-header">
                <h3 style={{ margin: 0 }}>🎂 Aniversários</h3>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="birthday-count-pill" title={`${aniversariantesDoMes.length} clientes aniversariando este mês`}>
                    {aniversariantesDoMes.length} no mês
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setModalAniversariantesAberto(true)} 
                    className="btn-ver-todos-anivs" 
                    style={{ padding: '2px 8px', fontSize: '0.65rem' }}
                    title="Ver todos os aniversariantes do mês"
                  >
                    <i className="fas fa-eye"></i> Ver Todos
                  </button>
                </div>
              </div>
              <div className="birthday-grid-compact">
                {aniversariantesDoMes.length > 0 ? (
                  aniversariantesDoMes.slice(0, 5).map((c) => {
                    const hoje = new Date();
                    const diaHoje = hoje.getDate();
                    const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.data_nascimento || c.dataAniversario || c.aniversario || c.nasc || '';
                    const { dia: partesDia } = extrairMesDia(dataVal);
                    const ehPassado = partesDia > 0 && partesDia < diaHoje;
                    const ehHoje = partesDia === diaHoje;
                    const ehAmanha = partesDia === diaHoje + 1;
                    const nomeFormat = c.nome || c.nomeFantasia || c.razaoSocial || 'Cliente';
                    const fone = c.celular ? c.celular.replace(/\D/g, '') : '';
                    const msgTexto = encodeURIComponent(`Olá ${nomeFormat}! 🎉 A equipe Celebre deseja um Feliz Aniversário! 🎂🎈 Preparamos uma surpresa especial para o seu próximo evento. Vamos comemorar? ✨`);
                    const zapLink = `https://wa.me/55${fone}?text=${msgTexto}`;
                    return (
                      <div key={c.id} className="birthday-row-compact" style={{ opacity: ehPassado ? 0.7 : 1 }}>
                        <div className="birthday-avatar-mini" style={{ background: ehPassado ? '#94a3b8' : undefined }}>{nomeFormat.charAt(0)}</div>
                        <span className="birthday-name-mini" title={nomeFormat}>{nomeFormat}</span>
                        {ehHoje
                          ? <span className="birthday-tag-mini" style={{ background: '#fef3c7', color: '#b45309', fontWeight: '800' }}>🎂 HOJE</span>
                          : ehAmanha
                            ? <span className="birthday-tag-mini" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: '700' }}>⏰ Amanhã</span>
                            : ehPassado
                              ? <span className="birthday-tag-mini" style={{ background: '#f1f5f9', color: '#64748b' }}>Passou ({String(partesDia).padStart(2, '0')})</span>
                              : <span className="birthday-tag-mini" style={{ background: '#ecfdf5', color: '#047857', fontWeight: '700' }}>📅 Dia {partesDia}</span>
                        }
                        {c.celular && (
                          <a href={zapLink} target="_blank" rel="noopener noreferrer" className="btn-dispatch-zap" style={{ padding: '2px 6px', fontSize: '0.6rem' }} title={`Felicitar ${nomeFormat} no WhatsApp`}>
                            <i className="fab fa-whatsapp"></i>
                          </a>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-feed">✨ Nenhum aniversariante este mês.</p>
                )}
              </div>
            </section>

            {/* 🏆 RANKING TOP 3 (PÓDIO GRÁFICO 3D ESCALONADO) */}
            <section className="dash-card-wide">
              <div className="dash-section-header">
                <h3 style={{ margin: 0 }}>🏆 Top Peças</h3>
                <button onClick={() => navigate('/estoque')} className="btn-ver-todos-anivs">Acervo</button>
              </div>
              {topPecas.length > 0 ? (
                <div className="podium-ranking-container">
                  {/* 2º LUGAR (ESQUERDA - PRATA) */}
                  <div className={`podium-step podium-silver ${topPecas[1] ? '' : 'podium-empty'}`}>
                    <div className="podium-badge">🥈 2º</div>
                    <div className="podium-block">
                      <span className="podium-item-name" title={topPecas[1]?.nome || ''}>{topPecas[1]?.nome || '—'}</span>
                      {topPecas[1] && <span className="podium-item-count">{topPecas[1].qtd} loc.</span>}
                    </div>
                  </div>

                  {/* 1º LUGAR (CENTRO - OURO MAIS ALTO) */}
                  <div className={`podium-step podium-gold ${topPecas[0] ? '' : 'podium-empty'}`}>
                    <div className="podium-badge">🥇 1º</div>
                    <div className="podium-block">
                      <span className="podium-item-name" title={topPecas[0]?.nome || ''}>{topPecas[0]?.nome || '—'}</span>
                      {topPecas[0] && <span className="podium-item-count">{topPecas[0].qtd} loc.</span>}
                    </div>
                  </div>

                  {/* 3º LUGAR (DIREITA - BRONZE MAIS BAIXO) */}
                  <div className={`podium-step podium-bronze ${topPecas[2] ? '' : 'podium-empty'}`}>
                    <div className="podium-badge">🥉 3º</div>
                    <div className="podium-block">
                      <span className="podium-item-name" title={topPecas[2]?.nome || ''}>{topPecas[2]?.nome || '—'}</span>
                      {topPecas[2] && <span className="podium-item-count">{topPecas[2].qtd} loc.</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="empty-feed">📊 Dados insuficientes.</p>
              )}
            </section>

          </div>

          {/* 📊 BI CATEGORIAS (BARRA EMPILHADA + 5 CHIPS) */}
          <section className="dash-card-wide bi-card-section">
            <div className="dash-section-header">
              <div>
                <h3 style={{ margin: 0 }}>📊 BI Financeiro por Categoria</h3>
                <p className="card-subtitle" style={{ margin: '1px 0 0 0' }}>Distribuição percentual do fluxo no período</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/financeiro')}
                className="btn-dash-link-action"
              >
                Financeiro ➔
              </button>
            </div>
            {(() => {
              const totalGeral = (categoriaBreakdown.locacao || 0) + 
                                 (categoriaBreakdown.estoque || 0) + 
                                 (categoriaBreakdown.manutencao || 0) + 
                                 (categoriaBreakdown.fixo || 0) + 
                                 (categoriaBreakdown.equipe || 0) + 
                                 (categoriaBreakdown.outros || 0);

              const itensBreakdown = [
                { id: 'locacao', icon: '🎉', label: 'Locações', valor: categoriaBreakdown.locacao || 0, cor: '#10b981' },
                { id: 'estoque', icon: '📦', label: 'Acervo', valor: categoriaBreakdown.estoque || 0, cor: '#3b82f6' },
                { id: 'manutencao', icon: '🛠️', label: 'Manutenção', valor: categoriaBreakdown.manutencao || 0, cor: '#f59e0b' },
                { id: 'fixo', icon: '🏢', label: 'Fixos', valor: categoriaBreakdown.fixo || 0, cor: '#64748b' },
                { id: 'equipe', icon: '👥', label: 'Equipe', valor: categoriaBreakdown.equipe || 0, cor: '#8b5cf6' },
                { id: 'outros', icon: '🚚', label: 'Outros', valor: categoriaBreakdown.outros || 0, cor: '#ec4899' },
              ];

              return (
                <div className="bi-stacked-bar-wrapper">
                  {/* BARRA EMPILHADA DE DISTRIBUIÇÃO */}
                  <div className="bi-stacked-bar">
                    {totalGeral > 0 ? (
                      itensBreakdown.map(item => {
                        const pct = Math.round((item.valor / totalGeral) * 100);
                        if (pct <= 0) return null;
                        return (
                          <div
                            key={item.id}
                            className="bi-stacked-segment"
                            style={{ width: `${pct}%`, background: item.cor }}
                            title={`${item.label}: R$ ${item.valor.toLocaleString('pt-BR')} (${pct}%)`}
                          />
                        );
                      })
                    ) : (
                      <div className="bi-stacked-empty-pulse" title="Sem movimentações no período selecionado" />
                    )}
                  </div>

                  {/* CHIPS DE TODAS AS 6 CATEGORIAS (3 COLUNAS - 3 CARDS POR LINHA) */}
                  <div className="bi-chips-grid">
                    {itensBreakdown.map(item => {
                      const pct = totalGeral > 0 ? Math.round((item.valor / totalGeral) * 100) : 0;
                      return (
                        <div key={item.id} className="bi-chip-card">
                          <div className="bi-chip-top-row">
                            <span className="bi-chip-dot" style={{ background: item.cor }}></span>
                            <span className="bi-chip-label">{item.icon} {item.label}</span>
                          </div>
                          <div className="bi-chip-bottom-row">
                            <strong className="bi-chip-val">
                              R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </strong>
                            <span className="bi-chip-pct" style={{ color: item.cor }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>

        </div>
      </div>

      {/* MODAL ANIVERSARIANTES */}
      {modalAniversariantesAberto && (
        <div className="modal-overlay-celebre fade-in" onClick={() => setModalAniversariantesAberto(false)}>
          <div className="modal-container-celebre modal-aniversariantes-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header-celebre modal-aniversariantes-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🎂</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: '850' }}>Aniversariantes de {new Date().toLocaleString('pt-BR', { month: 'long' }).replace(/^./, s => s.toUpperCase())} ({aniversariantesDoMes.length})</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#cbd5e1' }}>Central CRM de Retenção &amp; Disparo de Cupons</p>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {aniversariantesDoMes.map(c => {
                    const diaHojeModal = new Date().getDate();
                    const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.data_nascimento || c.dataAniversario || c.aniversario || c.nasc || '';
                    const { dia: diaAniv } = extrairMesDia(dataVal);
                    const ehPassado = diaAniv > 0 && diaAniv < diaHojeModal;
                    const ehHojeM = diaAniv === diaHojeModal;
                    const ehAmanhaM = diaAniv === diaHojeModal + 1;

                    let badgeLabel = '';
                    let badgeStyle = {};
                    if (ehPassado) { badgeLabel = `Já passou (${String(diaAniv).padStart(2, '0')})`; badgeStyle = { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }; }
                    else if (ehHojeM) { badgeLabel = '🎂 HOJE!'; badgeStyle = { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: '900' }; }
                    else if (ehAmanhaM) { badgeLabel = '⏰ Amanhã'; badgeStyle = { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: '700' }; }
                    else { badgeLabel = `📅 Dia ${diaAniv}`; badgeStyle = { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontWeight: '700' }; }

                    const nomeFormat = c.nome || c.nomeFantasia || c.razaoSocial || 'Cliente';
                    const fone = c.celular ? c.celular.replace(/\D/g, '') : '';
                    const msgTexto = encodeURIComponent(`Olá ${nomeFormat}! 🎉 A equipe Celebre deseja um Feliz Aniversário! Como presente especial, preparamos 10% OFF na sua próxima locação de acervo. Vamos comemorar? 🎂🎈`);
                    const zapLink = `https://wa.me/55${fone}?text=${msgTexto}`;
                    const mailLink = `mailto:${c.email}?subject=Parabéns do Celebre! 🎂🎈&body=${msgTexto}`;

                    return (
                      <div key={c.id} className="feed-row-birthday" style={{ opacity: ehPassado ? 0.65 : 1 }}>
                        <div className="birthday-client-info">
                          <div className="birthday-avatar" style={{ background: ehPassado ? '#94a3b8' : undefined }}>{nomeFormat.charAt(0)}</div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <strong>{nomeFormat}</strong>
                              <span style={{ fontSize: '0.68rem', fontWeight: '800', padding: '2px 8px', borderRadius: '8px', ...badgeStyle }}>{badgeLabel}</span>
                            </div>
                            <span className="birthday-date-sub">📅 {dataVal}{c.celular ? ` • 📱 ${c.celular}` : ''}{c.email ? ` • ✉️ ${c.email}` : ''}</span>
                          </div>
                        </div>
                        <div className="birthday-dispatch-actions">
                          {c.celular && (<a href={zapLink} target="_blank" rel="noopener noreferrer" className="btn-dispatch-zap"><i className="fab fa-whatsapp"></i> WhatsApp</a>)}
                          {c.email && (<a href={mailLink} className="btn-dispatch-email"><i className="far fa-envelope"></i> E-mail</a>)}
                          {c.celular && c.email && (
                            <button type="button" onClick={() => { window.open(zapLink, '_blank'); window.location.href = mailLink; }} className="btn-dispatch-both">
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

            <div className="modal-footer-celebre" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--borda, #e2e8f0)', background: 'var(--fundo-card, #f8fafc)' }}>
              <button type="button" onClick={() => { setModalAniversariantesAberto(false); navigate('/clientes'); }} className="btn-secondary-celebre" style={{ fontSize: '0.78rem' }}>
                <i className="fas fa-users"></i> Ir para Clientes
              </button>
              <button type="button" className="btn-primary-celebre" onClick={() => setModalAniversariantesAberto(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 MODAL DE AJUSTE DA META NO DASHBOARD */}
      {modalMetaAberto && (
        <div className="modal-overlay-celebre fade-in" onClick={() => setModalMetaAberto(false)}>
          <div className="modal-card-celebre" style={{ maxWidth: '420px', padding: '22px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header-celebre" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🎯</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '850', color: '#0f172a' }}>
                  Meta de Faturamento Mensal
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setModalMetaAberto(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarMeta}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Valor da Meta Mensal (R$)
                </label>
                <input 
                  type="number" 
                  step="50"
                  min="100"
                  required
                  placeholder="Ex: 15000" 
                  value={novaMetaInput} 
                  onChange={e => setNovaMetaInput(e.target.value)}
                  style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '1rem', fontWeight: '800', boxSizing: 'border-box' }}
                />
                <small style={{ display: 'block', fontSize: '0.70rem', color: '#64748b', marginTop: '4px' }}>
                  Defina a meta de faturamento mensal para acompanhar o termômetro executivo da sua empresa.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setModalMetaAberto(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)' }}
                >
                  💾 Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;

