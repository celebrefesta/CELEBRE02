import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import AuditoriaEstoque from './AuditoriaEstoque';
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
  const [todasLocacoes, setTodasLocacoes] = useState([]);
  const [statusChart, setStatusChart] = useState({ orcamento: 0, confirmado: 0, preparacao: 0, entregue: 0, finalizado: 0, total: 0 });
  const [valoresPorStatus, setValoresPorStatus] = useState({ orcamento: 0, confirmado: 0 });
  const [topPecas, setTopPecas] = useState([]);
  const [cobrancasAtrasadas, setCobrancasAtrasadas] = useState([]);
  const [aniversariantesDoMes, setAniversariantesDoMes] = useState([]);
  const [aniversariantesProximos, setAniversariantesProximos] = useState([]);
  const [modalAniversariantesAberto, setModalAniversariantesAberto] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes_atual');
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
        setLoading(true);
        let idDaEmpresaCorreta = localStorage.getItem('tenantId') || usuarioLogado?.uid;

        if (!isSuperAdmin) {
            const snapUserDoc = await getDoc(doc(db, "usuarios", usuarioLogado.uid));
            let userData = snapUserDoc.exists() ? snapUserDoc.data() : null;

            if (userData?.role === 'funcionario' && userData.tenantId) {
                idDaEmpresaCorreta = userData.tenantId;
            } else if (userData?.tenantId) {
                idDaEmpresaCorreta = userData.tenantId;
            }

            if (userData) {
                if (userData.assinaturaAtiva === true || userData.statusAssinatura === 'ativa') {
                    setAssinaturaAtiva(true);
                }

                if (userData.statusConta === 'excluido') {
                    setStatusConta('excluido');
                    setLoading(false);
                    return;
                }

                let dataCriacao = null;
                if (userData.dataCadastro) dataCriacao = parseFirestoreDate(userData.dataCadastro);
                else if (userData.criadoEm) dataCriacao = parseFirestoreDate(userData.criadoEm);

                if (dataCriacao) {
                    const agora = new Date();
                    const diffTime = Math.abs(agora - dataCriacao);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    setDiasTeste(diffDays);

                    if (diffDays > 180 && !userData.assinaturaAtiva) {
                        setStatusConta('excluido');
                        try {
                            await updateDoc(doc(db, "usuarios", usuarioLogado.uid), { statusConta: 'excluido' });
                        } catch (eErr) {}
                        setLoading(false);
                        return;
                    }

                    const testeExpirou = diffDays > 7 && !userData.assinaturaAtiva && userData.statusAssinatura !== 'ativa';
                    if (testeExpirou) {
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

        // BUSCA ESTOQUE E LOCAÇÕES COM FALLBACK DE CAMPO (userId ou tenantId)
        let qEstoque = query(collection(db, "estoque"), where("userId", "==", idDaEmpresaCorreta));
        let qLocacoes = query(collection(db, "locacoes"), where("userId", "==", idDaEmpresaCorreta));

        let estSnap = await getDocs(qEstoque);
        let locSnap = await getDocs(qLocacoes);

        if (estSnap.empty) {
          const qEstoqueT = query(collection(db, "estoque"), where("tenantId", "==", idDaEmpresaCorreta));
          const estSnapT = await getDocs(qEstoqueT);
          if (!estSnapT.empty) estSnap = estSnapT;
        }

        if (locSnap.empty) {
          const qLocsT = query(collection(db, "locacoes"), where("tenantId", "==", idDaEmpresaCorreta));
          const locSnapT = await getDocs(qLocsT);
          if (!locSnapT.empty) locSnap = locSnapT;
        }

        const locs = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTodasLocacoes(locs);

        // BUSCA OPCIONAL DE COMPRAS (lista_compras) E LANÇAMENTOS (financeiro_lancamentos)
        let comprasDocs = [];
        try {
          let qCompras = query(collection(db, "lista_compras"), where("userId", "==", idDaEmpresaCorreta));
          let comprasSnap = await getDocs(qCompras);
          if (comprasSnap.empty) {
            const qComprasT = query(collection(db, "lista_compras"), where("tenantId", "==", idDaEmpresaCorreta));
            const comprasSnapT = await getDocs(qComprasT);
            if (!comprasSnapT.empty) comprasSnap = comprasSnapT;
          }
          comprasDocs = comprasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (eComp) {}

        let lancDocs = [];
        try {
          let qLancamentos = query(collection(db, "financeiro_lancamentos"), where("userId", "==", idDaEmpresaCorreta));
          let lancSnap = await getDocs(qLancamentos);
          if (lancSnap.empty) {
            const qLancT = query(collection(db, "financeiro_lancamentos"), where("tenantId", "==", idDaEmpresaCorreta));
            const lancSnapT = await getDocs(qLancT);
            if (!lancSnapT.empty) lancSnap = lancSnapT;
          }
          lancDocs = lancSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (eLanc) {}



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

        
        try {
          let snapClientesDash;
          try {
            const qClientesDash = query(collection(db, "clientes"), where("userId", "==", idDaEmpresaCorreta));
            snapClientesDash = await getDocs(qClientesDash);
          } catch (e1) {
            const qClientesDashT = query(collection(db, "clientes"), where("tenantId", "==", idDaEmpresaCorreta));
            snapClientesDash = await getDocs(qClientesDashT);
          }
          const todosClientesDash = snapClientesDash ? snapClientesDash.docs.map(d => ({ ...d.data(), id: d.id })) : [];


          const extrairMesDia = (dataVal) => {
            if (!dataVal) return { mes: -1, dia: -1 };
            try {
              if (typeof dataVal === 'object' && dataVal !== null) {
                let d;
                if (dataVal.toDate) d = dataVal.toDate();
                else if (dataVal.seconds) d = new Date(dataVal.seconds * 1000);
                else if (dataVal instanceof Date) d = dataVal;
                if (d) return { mes: d.getMonth(), dia: d.getDate() };
              } else {
                const str = String(dataVal).trim();
                if (!str) return { mes: -1, dia: -1 };
                if (str.includes('-')) {
                  const partes = str.split('T')[0].split('-');
                  if (partes.length === 3) return { mes: parseInt(partes[1], 10) - 1, dia: parseInt(partes[2], 10) };
                } else if (str.includes('/')) {
                  const partes = str.split('/');
                  if (partes.length >= 2) return { mes: parseInt(partes[1], 10) - 1, dia: parseInt(partes[0], 10) };
                } else {
                  const d = new Date(str);
                  if (!isNaN(d.getTime())) return { mes: d.getMonth(), dia: d.getDate() };
                }
              }
            } catch (e) {}
            return { mes: -1, dia: -1 };
          };

          const hoje = new Date();
          const mesHoje = hoje.getMonth();
          const diaHoje = hoje.getDate();

          const todosDoMes = todosClientesDash.filter(c => {
            const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.dataAniversario || c.aniversario;
            const { mes } = extrairMesDia(dataVal);
            return mes === mesHoje;
          }).sort((a, b) => {
            const dA = extrairMesDia(a.nascimento || a.dataNascimento || a.dataNasc || a.dataAniversario || a.aniversario).dia;
            const dB = extrairMesDia(b.nascimento || b.dataNascimento || b.dataNasc || b.dataAniversario || b.aniversario).dia;
            return dA - dB;
          });

          const proximosAnivs = todosDoMes.filter(c => {
            const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.dataAniversario || c.aniversario;
            const { dia } = extrairMesDia(dataVal);
            return dia >= diaHoje && dia <= diaHoje + 2;
          });

          setAniversariantesDoMes(todosDoMes);
          setAniversariantesProximos(proximosAnivs);
        } catch (errAniv) {
          console.warn("Aviso ao carregar aniversariantes:", errAniv);
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
      {!isSuperAdmin && !assinaturaAtiva && statusConta === 'ativo' && diasTeste <= 7 && (
        <div className="dash-trial-banner">
          ⏳ Você está no dia {diasTeste} de 7 do seu teste gratuito do Celebre. Aproveite!
        </div>
      )}

      <AuditoriaEstoque />

      <header className="dash-wide-header">
        <div className="header-titles">
          <h1>Olá, {nomeUsuario}! 👋</h1>
          <p>Central de Comando & Inteligência de Acervo Celebre.</p>
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
            <button onClick={() => navigate('/cadastro-cliente')} title="Novo Cliente">
              <i className="fas fa-user-plus"></i> CLIENTE
            </button>
            <button onClick={() => navigate('/locacoes/nova')} title="Nova Locação">
              <i className="fas fa-shopping-cart"></i> LOCAÇÃO
            </button>
            <button onClick={() => navigate('/cadastro-estoque')} title="Novo Item">
              <i className="fas fa-box-open"></i> ITEM
            </button>
          </div>
        </div>
      </header>


      <div className="stats-wide-row">
        <div className="stat-card-pro border-gold">
          <div className="stat-icon-wrapper icon-gold">
            <i className="fas fa-boxes"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Acervo Total</span>
            <strong className="stat-value">{estatisticas.acervo}</strong>
            <span className="stat-sub">📦 Peças cadastradas</span>
          </div>
        </div>

        <div className="stat-card-pro border-blue">
          <div className="stat-icon-wrapper icon-blue">
            <i className="fas fa-shopping-bag"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Locações Ativas</span>
            <strong className="stat-value">{estatisticas.ativas}</strong>
            <span className="stat-sub">⚡ Em andamento</span>
          </div>
        </div>

        <div className="stat-card-pro border-green">
          <div className="stat-icon-wrapper icon-green">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Próximos Eventos</span>
            <strong className="stat-value">{estatisticas.eventos}</strong>
            <span className="stat-sub">📅 Próximos 7 dias</span>
          </div>
        </div>

        <div className="stat-card-pro border-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Ticket Médio</span>
            <strong className="stat-value">R$ {estatisticas.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <span className="stat-sub">▲ Média p/ pedido</span>
          </div>
        </div>

        <div className="stat-card-pro border-amber">
          <div className="stat-icon-wrapper icon-amber">
            <i className="fas fa-file-invoice-dollar"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Em Orçamento</span>
            <strong className="stat-value">R$ {(estatisticas.emOrcamento || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <span className="stat-sub">📋 Pipeline aberto</span>
          </div>
        </div>

        <div className="stat-card-pro border-red">
          <div className="stat-icon-wrapper icon-red">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">A Receber Total</span>
            <strong className="stat-value">R$ {estatisticas.aReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            <span className="stat-sub">
              {estatisticas.aReceber > 0 ? '⚠️ Saldo pendente' : '🟢 100% adimplente'}
            </span>
          </div>
        </div>
      </div>

      <div className="dash-main-grid-wide">
        <div className="dash-column">
          <section className="dash-card-wide chart-card">
            <div className="dash-section-header">
              <div>
                <h3 style={{ margin: 0 }}>📊 Faturamento vs Gastos</h3>
                <p className="card-subtitle" style={{ margin: '2px 0 0 0' }}>
                  Comparativo de Receita (Azul) e Saídas/Despesas (Vermelho)
                </p>
              </div>
              <span className="birthday-count-pill" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a' }}>
                <span style={{ color: '#2563eb', fontWeight: 800 }}>R$ {totalFatPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                {' | '}
                <span style={{ color: '#ef4444', fontWeight: 800 }}>Gastos: R$ {totalGastosPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </span>
            </div>

            <div style={{ width: '100%', height: '210px', minHeight: '210px', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height={210} initialDimension={{ width: 320, height: 210 }}>
                <BarChart data={dataFaturamentoBar} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--borda, #e2e8f0)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11, fill: 'var(--texto-secundario, #64748b)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--texto-secundario, #64748b)' }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                  <Tooltip content={<CustomTooltipFat />} />
                  <Bar dataKey="faturamento" name="Faturamento (Receita)" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="gastos" name="Gastos (Despesas)" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="dash-card-wide flex-grow dash-card-column">
            <div className="dash-section-header">
              <h3>🎯 Conversão & Status</h3>
              <span className="dash-count-pill">
                {statusChart.total} {filtroPeriodo === 'hoje' ? 'PEDIDOS HOJE' : 'PEDIDOS NO PERÍODO'}
              </span>
            </div>

            <div className="status-donut-container-horizontal">
              {/* ESQUERDA: GRÁFICO DONUT */}
              <div className="status-donut-left">
                <div style={{ width: '90px', height: '90px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height={90} initialDimension={{ width: 90, height: 90 }}>
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={dataStatusDonut.length > 0 ? dataStatusDonut : [{ name: 'Sem Pedidos', value: 1, color: '#e2e8f0' }]}
                        innerRadius={24}
                        outerRadius={38}
                        cx="50%"
                        cy="50%"
                        paddingAngle={dataStatusDonut.length > 1 ? 3 : 0}
                        dataKey="value"
                      >
                        {(dataStatusDonut.length > 0 ? dataStatusDonut : [{ color: '#e2e8f0' }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltipDonut />} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--texto-principal, #0f172a)', fontWeight: 900, display: 'block', lineHeight: 1 }}>
                      {statusChart.total > 0 ? `${pctConfirmados}%` : '0%'}
                    </strong>
                    <span style={{ fontSize: '0.48rem', color: 'var(--texto-secundario, #64748b)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {statusChart.total > 0 ? 'Fechados' : 'Sem Pedidos'}
                    </span>
                  </div>
                </div>
              </div>


              {/* DIREITA: DETALHES DE STATUS */}
              <div className="status-info-right">
                <div className="status-list-grid">
                  <div className="status-item-row"><span className="dot" style={{ background: '#10b981' }}></span> <span>Confirmados</span> <strong>{statusChart.confirmado}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#8b5cf6' }}></span> <span>Separação</span> <strong>{statusChart.preparacao}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#f59e0b' }}></span> <span>Orçamentos</span> <strong>{statusChart.orcamento}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#ec4899' }}></span> <span>Entregues</span> <strong>{statusChart.entregue}</strong></div>
                  <div className="status-item-row"><span className="dot" style={{ background: '#3b82f6' }}></span> <span>Finalizados</span> <strong>{statusChart.finalizado}</strong></div>
                  {statusChart.arquivado > 0 && <div className="status-item-row"><span className="dot" style={{ background: '#64748b' }}></span> <span>Arquivados</span> <strong>{statusChart.arquivado}</strong></div>}
                  {statusChart.lixeira > 0 && <div className="status-item-row"><span className="dot" style={{ background: '#ef4444' }}></span> <span>Lixeira / Perdidos</span> <strong>{statusChart.lixeira}</strong></div>}
                </div>
              </div>
            </div>
          </section>

        </div>

        <div className="dash-column">
          <section className="dash-card-wide flex-grow">
            <div className="dash-section-header">
              <h3>📋 Tabela de Pedidos Recentes</h3>
              <button onClick={() => navigate('/locacoes')} className="btn-ver-todos-anivs">
                Ver Todas ({todasLocacoes.length})
              </button>
            </div>
            <p className="card-subtitle">Últimas movimentações de locação.</p>

            <div className="activity-feed">
              {atividades.length > 0 ? (
                atividades.map((a, i) => (
                  <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${a.id}`)}>
                    <div className="feed-icon blue-icon">🛍️</div>
                    <div className="feed-info">
                      <p>{a.txt}</p>
                      <span className="feed-sub">
                        Status: <strong style={{ color: '#10b981' }}>{a.status.toUpperCase()}</strong>
                      </span>
                    </div>
                    {a.valor && <span className="feed-valor">{a.valor}</span>}
                  </div>
                ))
              ) : (
                <p className="empty-feed">🛍️ Nenhuma locação realizada recentemente.</p>
              )}
            </div>
          </section>

          <section className="dash-card-wide flex-grow">
            <h3>📝 Orçamentos Pendentes</h3>
            <p className="card-subtitle">Negócios abertos aguardando fechamento.</p>
            <div className="activity-feed">
              {orcamentosPendentes.length > 0 ? (
                orcamentosPendentes.map((orc, i) => (
                  <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${orc.id}`)}>
                    <div className="feed-icon warning-icon">🔔</div>
                    <div className="feed-info">
                      <p>{orc.clienteNome || 'Sem Nome'}</p>
                      <span className="feed-sub">Festa: {orc.dataRetirada ? orc.dataRetirada.split('-').reverse().join('/') : '?'}</span>
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

        <div className="dash-column">
          <section className="dash-card-wide flex-grow">
            <h3>🚨 Radar de Cobrança</h3>
            <p className="card-subtitle">Devoluções passadas com saldo em aberto.</p>
            <div className="activity-feed">
              {cobrancasAtrasadas.length > 0 ? (
                cobrancasAtrasadas.map((cob, i) => {
                  const fone = cob.fone ? cob.fone.replace(/\D/g, '') : '';
                  const msg = encodeURIComponent(`Olá ${cob.cliente}! Tudo bem? Verificamos pendência de R$ ${cob.valor.toFixed(2)} referente à locação do evento dia ${cob.data}. Podemos enviar a chave PIX?`);
                  const zap = `https://wa.me/55${fone}?text=${msg}`;

                  return (
                    <div key={i} className="feed-row-moderno" onClick={() => navigate(`/locacoes/editar/${cob.id}`)}>
                      <div className="feed-icon danger-icon">⚠️</div>
                      <div className="feed-info">
                        <p>{cob.cliente}</p>
                        <span className="feed-sub">Evento: {cob.data}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span className="feed-valor feed-valor--danger">R$ {cob.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        {cob.fone && (
                          <a 
                            href={zap} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn-dispatch-zap" 
                            onClick={e => e.stopPropagation()}
                            style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                          >
                            <i className="fab fa-whatsapp"></i> Cobrar
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="empty-feed empty-feed--success">✅ Nenhum atraso financeiro detectado.</p>
              )}
            </div>
          </section>

          <section className="dash-card-wide flex-grow crm-birthday-card-dash">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>🎂 Próximos Aniversários</h3>
                <span className="birthday-count-pill">
                  {aniversariantesProximos.length} {aniversariantesProximos.length === 1 ? 'PRÓXIMO' : 'PRÓXIMOS'}
                </span>
                <button 
                  type="button" 
                  onClick={() => setModalAniversariantesAberto(true)}
                  className="btn-ver-todos-anivs"
                  style={{ padding: '2px 10px', fontSize: '0.7rem' }}
                >
                  <i className="fas fa-eye"></i> Ver Todos ({aniversariantesDoMes.length})
                </button>
              </div>
              <p className="card-subtitle" style={{ margin: 0 }}>
                Aniversários nos próximos dias. Envie um cupom especial!
              </p>
            </div>



            <div className="activity-feed">
              {aniversariantesProximos.length > 0 ? (
                aniversariantesProximos.slice(0, 5).map((c) => {
                  const hoje = new Date();
                  const diaHoje = hoje.getDate();
                  const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.dataAniversario || c.aniversario || '';
                  const partesDia = String(dataVal).includes('-') 
                    ? parseInt(String(dataVal).split('T')[0].split('-')[2], 10)
                    : String(dataVal).includes('/') 
                      ? parseInt(String(dataVal).split('/')[0], 10) 
                      : -1;
                  const ehHoje = partesDia === diaHoje;
                  const ehAmanha = partesDia === diaHoje + 1;

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
                          <span className="birthday-date-sub">
                            {ehHoje 
                              ? <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: '800', padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem' }}>🎂 HOJE!</span>
                              : ehAmanha 
                                ? <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: '700', padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem' }}>⏰ Amanhã</span>
                                : <span style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem' }}>📅 Em 2 dias</span>
                            }
                            {' '}<span style={{ opacity: 0.8 }}>• {dataVal}</span>
                          </span>
                        </div>
                      </div>

                      <div className="birthday-dispatch-actions">
                        {c.celular && (
                          <a href={zapLink} target="_blank" rel="noopener noreferrer" className="btn-dispatch-zap" title="Enviar WhatsApp">
                            <i className="fab fa-whatsapp"></i> Whats
                          </a>
                        )}
                        {c.email && (
                          <a href={mailLink} className="btn-dispatch-email" title="Enviar E-mail">
                            <i className="far fa-envelope"></i> E-mail
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="empty-feed">✨ Nenhum aniversário nos próximos 2 dias.</p>
              )}
            </div>
          </section>

          <section className="dash-card-wide flex-grow">
            <div className="dash-section-header">
              <h3 style={{ margin: 0 }}>🏆 Ranking de Peças (Top 3)</h3>
              <button onClick={() => navigate('/estoque')} className="btn-ver-todos-anivs">
                Acervo
              </button>
            </div>

            {topPecas.length > 0 ? (
              <div className="podium-ranking-container">
                {/* 2º LUGAR (ESQUERDA - PRATA) */}
                <div className={`podium-step podium-silver ${topPecas[1] ? '' : 'podium-empty'}`}>
                  <div className="podium-badge">🥈 2º</div>
                  <div className="podium-block">
                    <span className="podium-item-name" title={topPecas[1]?.nome || ''}>{topPecas[1]?.nome || '—'}</span>
                    {topPecas[1] && <span className="podium-item-count">{topPecas[1].qtd} locação{topPecas[1].qtd > 1 ? 'ões' : ''}</span>}
                  </div>
                </div>

                {/* 1º LUGAR (CENTRO - OURO) */}
                <div className={`podium-step podium-gold ${topPecas[0] ? '' : 'podium-empty'}`}>
                  <div className="podium-badge">🥇 1º</div>
                  <div className="podium-block">
                    <span className="podium-item-name" title={topPecas[0]?.nome || ''}>{topPecas[0]?.nome || '—'}</span>
                    {topPecas[0] && <span className="podium-item-count">{topPecas[0].qtd} locação{topPecas[0].qtd > 1 ? 'ões' : ''}</span>}
                  </div>
                </div>

                {/* 3º LUGAR (DIREITA - BRONZE) */}
                <div className={`podium-step podium-bronze ${topPecas[2] ? '' : 'podium-empty'}`}>
                  <div className="podium-badge">🥉 3º</div>
                  <div className="podium-block">
                    <span className="podium-item-name" title={topPecas[2]?.nome || ''}>{topPecas[2]?.nome || '—'}</span>
                    {topPecas[2] && <span className="podium-item-count">{topPecas[2].qtd} locação{topPecas[2].qtd > 1 ? 'ões' : ''}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="empty-feed">📊 Dados insuficientes de ranking.</p>
            )}
          </section>

        </div>
      </div>

      {modalAniversariantesAberto && (
        <div className="modal-overlay-celebre fade-in" onClick={() => setModalAniversariantesAberto(false)}>
          <div className="modal-container-celebre modal-aniversariantes-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header-celebre modal-aniversariantes-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🎂</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: '850' }}>Aniversariantes de {new Date().toLocaleString('pt-BR', { month: 'long' }).replace(/^./, s => s.toUpperCase())} ({aniversariantesDoMes.length})</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#cbd5e1' }}>Central CRM de Retenção & Disparo de Cupons — Todos os clientes do mês</p>
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
                    const diaHojeModal = new Date().getDate();
                    const dataVal = c.nascimento || c.dataNascimento || c.dataNasc || c.dataAniversario || c.aniversario || '';
                    const diaAniv = String(dataVal).includes('-')
                      ? parseInt(String(dataVal).split('T')[0].split('-')[2], 10)
                      : String(dataVal).includes('/')
                        ? parseInt(String(dataVal).split('/')[0], 10)
                        : -1;
                    const ehPassado = diaAniv > 0 && diaAniv < diaHojeModal;
                    const ehHojeM = diaAniv === diaHojeModal;
                    const ehAmanhaM = diaAniv === diaHojeModal + 1;

                    let badgeLabel = '';
                    let badgeStyle = {};
                    if (ehPassado) {
                      badgeLabel = 'Já passou';
                      badgeStyle = { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' };
                    } else if (ehHojeM) {
                      badgeLabel = '🎂 HOJE!';
                      badgeStyle = { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: '900' };
                    } else if (ehAmanhaM) {
                      badgeLabel = '⏰ Amanhã';
                      badgeStyle = { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
                    } else {
                      badgeLabel = `Dia ${diaAniv}`;
                      badgeStyle = { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' };
                    }

                    const nomeFormat = c.nome || c.nomeFantasia || c.razaoSocial || 'Cliente';
                    const fone = c.celular ? c.celular.replace(/\D/g, '') : '';
                    const msgTexto = encodeURIComponent(`Olá ${nomeFormat}! 🎉 A equipe Celebre deseja um Feliz Aniversário! Como presente especial, preparamos 10% OFF na sua próxima locação de acervo. Vamos comemorar? 🎂🎈`);
                    const zapLink = `https://wa.me/55${fone}?text=${msgTexto}`;
                    const mailLink = `mailto:${c.email}?subject=Parabéns do Celebre! 🎂🎈&body=${msgTexto}`;

                    return (
                      <div key={c.id} className="feed-row-birthday" style={{ opacity: ehPassado ? 0.65 : 1 }}>
                        <div className="birthday-client-info">
                          <div className="birthday-avatar" style={{ background: ehPassado ? '#94a3b8' : undefined }}>
                            {nomeFormat.charAt(0)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <strong>{nomeFormat}</strong>
                              <span style={{ fontSize: '0.68rem', fontWeight: '800', padding: '2px 8px', borderRadius: '8px', ...badgeStyle }}>{badgeLabel}</span>
                            </div>
                            <span className="birthday-date-sub">
                              📅 {dataVal}{c.celular ? ` • 📱 ${c.celular}` : ''}{c.email ? ` • ✉️ ${c.email}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="birthday-dispatch-actions">
                          {c.celular && (
                            <a href={zapLink} target="_blank" rel="noopener noreferrer" className="btn-dispatch-zap">
                              <i className="fab fa-whatsapp"></i> WhatsApp
                            </a>
                          )}
                          {c.email && (
                            <a href={mailLink} className="btn-dispatch-email">
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

            <div className="modal-footer-celebre" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--borda, #e2e8f0)', background: 'var(--fundo-card, #f8fafc)' }}>
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