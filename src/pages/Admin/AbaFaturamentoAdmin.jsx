import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import ModalReciboOficial from '../../components/ModalReciboOficial';
import { calcularPeriodoTeste } from '../../utils/periodoTesteUtils';
import './AbaFaturamentoAdmin.css';

// 🎯 Tabela canônica de planos para cálculo de MRR e valores padrão
const TABELA_VALORES_PLANOS = {
  basico: { nome: 'Plano Básico', mensal: 49.90, anual: 479.00 },
  premium: { nome: 'Plano Premium', mensal: 99.90, anual: 958.80 },
  plus: { nome: 'Plano Plus', mensal: 159.90, anual: 1535.00 }
};

const formatarMoeda = (valor) => {
  const num = typeof valor === 'number' ? valor : parseFloat(String(valor || '0').replace(',', '.'));
  return (isNaN(num) ? 0 : num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const AbaFaturamentoAdmin = ({ clientes = [], onAbrirSuporteCliente }) => {
  const [loading, setLoading] = useState(true);
  const [faturas, setFaturas] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'concluido' | 'falha' | 'pendente' | 'mudanca'
  const [filtroMetodo, setFiltroMetodo] = useState('todos'); // 'todos' | 'cartao' | 'pix' | 'boleto'
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos'); // 'todos' | 'hoje' | '7dias' | 'mes_atual' | 'mes_anterior'
  const [itemDetalhesModal, setItemDetalhesModal] = useState(null);
  const [faturaReciboModal, setFaturaReciboModal] = useState(null);

  // 🔄 CARREGAR LOGS FINANCEIROS E CONSOLIDAR COM A BASE DE CLIENTES
  const carregarDadosFinanceiros = async () => {
    setLoading(true);
    try {
      let snapLogs;
      try {
        const qLogs = query(collection(db, "logs_atividades"), orderBy("criadoEm", "desc"), limit(350));
        snapLogs = await getDocs(qLogs);
      } catch (eOrder) {
        // Fallback caso índice composto ainda não esteja gerado no Firebase
        const qLogs = query(collection(db, "logs_atividades"), limit(350));
        snapLogs = await getDocs(qLogs);
      }

      // Mapa rápido de clientes indexados por tenantId, uid e email
      const mapaClientes = {};
      clientes.forEach(c => {
        if (c.uid) mapaClientes[c.uid] = c;
        if (c.tenantId) mapaClientes[c.tenantId] = c;
        if (c.email) mapaClientes[String(c.email).toLowerCase()] = c;
      });

      const listaConsolidada = [];
      const empresasComFaturaAtiva = new Set();

      if (snapLogs && snapLogs.docs) {
        snapLogs.docs.forEach(docSnap => {
          const d = docSnap.data();
          const acao = String(d.acao || '').toUpperCase();
          const detalhes = String(d.detalhes || '');
          const acaoUpper = String(acao).toUpperCase();
          const detLower = String(detalhes).toLowerCase();

          // 🚫 Ignora logs meramente informativos de navegação/abertura de checkout
          // (O clique para ver o checkout não é uma fatura ou tentativa de cobrança)
          if (
            detLower.includes('iniciou o processo de checkout') ||
            detLower.includes('iniciou checkout') ||
            detLower.includes('acessou a tela de checkout') ||
            acaoUpper.includes('ACESSO AO CHECKOUT') ||
            acaoUpper.includes('NAVEGAÇÃO')
          ) {
            return;
          }

          // Filtra apenas logs com impacto financeiro ou assinatura
          const isFinanceiro = 
            acao.includes('ASSINATURA') || 
            acao.includes('PAGAMENTO') || 
            acao.includes('CHECKOUT') || 
            acao.includes('PLANO') || 
            acao.includes('UPGRADE') || 
            acao.includes('MIGRACAO') || 
            acao.includes('CANCELAMENTO') || 
            acao.includes('FALHA') || 
            acao.includes('RECUSADO') || 
            acao.includes('ERRO');

          if (!isFinanceiro) return;

          const clienteRelacionado = 
            mapaClientes[d.empresaId] || 
            mapaClientes[d.userId] || 
            (d.usuarioEmail ? mapaClientes[String(d.usuarioEmail).toLowerCase()] : null) || 
            null;
          const targetUser = clienteRelacionado ? (clienteRelacionado.rawUserData || {}) : {};

          // Extração da data/hora
          const rawData = d.dataHora ? new Date(d.dataHora) : (d.criadoEm?.toDate ? d.criadoEm.toDate() : null);
          const dataObj = rawData && !isNaN(rawData.getTime()) ? rawData : new Date();
          const dataFormatada = dataObj.toLocaleDateString('pt-BR');
          const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          // Verifica se o usuário já possui quitação confirmada desta assinatura
          const userJaQuitou = Boolean(
            targetUser.statusAssinatura === 'ativa' || 
            targetUser.plano === 'pago' || 
            targetUser.statusPagamentoVulso === 'aprovado' ||
            clienteRelacionado?.statusAssinatura === 'ativa' ||
            clienteRelacionado?.plano === 'pago'
          );

          let statusItem = 'pendente';
          let tipoEvento = 'pendente';

          if (acaoUpper.includes('APROVAD') || acaoUpper.includes('PAGAMENTO CONFIRMADO') || acaoUpper.includes('PAGAMENTO PROCESSADO') || detLower.includes('processado com sucesso') || acaoUpper === 'ASSINATURA ATIVA') {
            statusItem = 'concluido';
            tipoEvento = 'pagamento';
          } else if (acaoUpper.includes('TENTATIVA') || detLower.includes('tentativa')) {
            if (userJaQuitou) {
              statusItem = 'concluido';
              tipoEvento = 'pagamento';
            } else {
              statusItem = 'tentativa';
              tipoEvento = 'tentativa';
            }
          } else if (acaoUpper.includes('FALHA') || acaoUpper.includes('RECUSADO') || acaoUpper.includes('ERRO') || detLower.includes('recusad') || detLower.includes('falhou')) {
            statusItem = 'falha';
            tipoEvento = 'erro_pagamento';
          } else if (acaoUpper.includes('CANCELAMENTO')) {
            statusItem = 'mudanca';
            tipoEvento = 'cancelamento';
          } else if (acaoUpper.includes('UPGRADE') || acaoUpper.includes('MIGRACAO')) {
            statusItem = 'mudanca';
            tipoEvento = 'upgrade';
          } else if (acaoUpper.includes('VIP') || acaoUpper.includes('CORTESIA') || detLower.includes('ativada pelo super admin') || detLower.includes('liberação vip')) {
            statusItem = 'cortesia';
            tipoEvento = 'cortesia';
          } else if (acaoUpper.includes('GERAÇÃO DE PIX') || acaoUpper.includes('GERAÇÃO DE BOLETO') || acaoUpper.includes('PENDENTE') || detLower.includes('aguardando')) {
            if (userJaQuitou) {
              statusItem = 'concluido';
              tipoEvento = 'pagamento';
            } else {
              statusItem = 'pendente';
              tipoEvento = 'pendente';
            }
          }

          // Identificação do Método
          let metodo = 'Cartão de Crédito';
          if (detLower.includes('pix')) metodo = 'PIX';
          else if (detLower.includes('boleto')) metodo = 'Boleto Bancário';
          else if (targetUser.metodoPagamento) metodo = targetUser.metodoPagamento;
          else if (statusItem === 'tentativa') metodo = 'Pendente';

          // Extração do Valor com verificação no detalhe do plano
          let valorNum = 99.90;
          const matchValor = detalhes.match(/R\$\s?([\d.,]+)/i);
          if (matchValor && matchValor[1]) {
            valorNum = parseFloat(matchValor[1].replace('.', '').replace(',', '.'));
          } else if (targetUser.valorAssinatura) {
            valorNum = parseFloat(String(targetUser.valorAssinatura).replace(',', '.'));
          } else {
            const rawP = (String(targetUser.planoId || targetUser.plano || '') + ' ' + detalhes).toLowerCase();
            if (rawP.includes('plus')) valorNum = 159.90;
            else if (rawP.includes('basic') || rawP.includes('básic')) valorNum = 49.90;
            else valorNum = 99.90;
          }

          // Se a tentativa foi convertida pela quitação do usuário, ajustar a exibição visual da linha
          let acaoExibicao = acao;
          let detalhesExibicao = detalhes;
          if (acaoUpper.includes('TENTATIVA') && userJaQuitou) {
            acaoExibicao = `ASSINATURA APROVADA (${metodo})`;
            detalhesExibicao = detalhes.replace(/iniciou o processo de checkout para o plano:/i, 'Assinatura confirmada e quitada para o plano:');
          }

          const empNome = clienteRelacionado?.nomeExibicao || clienteRelacionado?.nomeCompleto || d.nomeFuncionario || 'Empresa Assinante';
          const empEmail = clienteRelacionado?.email || d.usuarioEmail || 'contato@cliente.com';
          const empTelefone = clienteRelacionado?.telefone || targetUser.telefone || '';

          // Apenas faturas efetivamente quitadas ou de cortesia ativa contam como fatura emitida
          if (statusItem === 'concluido' || statusItem === 'cortesia') {
            if (clienteRelacionado?.tenantId) {
              empresasComFaturaAtiva.add(clienteRelacionado.tenantId);
            }
            if (clienteRelacionado?.uid) {
              empresasComFaturaAtiva.add(clienteRelacionado.uid);
            }
          }

          let dFimL = new Date(dataObj);
          const isCicloAnual = Boolean(targetUser.ciclo === 'anual' || acao.includes('ANUAL'));
          if (isCicloAnual) {
            dFimL.setFullYear(dFimL.getFullYear() + 1);
          } else {
            dFimL.setMonth(dFimL.getMonth() + 1);
          }
          const perInicio = dataFormatada;
          const perFim = dFimL.toLocaleDateString('pt-BR');

          listaConsolidada.push({
            id: docSnap.id,
            codigo: `FAT-${docSnap.id.substring(0, 8).toUpperCase()}`,
            dataObj,
            dataFormatada,
            horaFormatada,
            acao: acaoExibicao || acao,
            detalhes: detalhesExibicao || detalhes,
            empresaNome: empNome,
            email: empEmail,
            telefone: empTelefone,
            clienteObj: clienteRelacionado,
            metodo,
            valor: valorNum,
            status: statusItem,
            tipoEvento,
            rawLog: d,
            periodo: `${perInicio} a ${perFim}`,
            periodoInicio: perInicio,
            periodoFim: perFim,
            cicloNome: isCicloAnual ? 'Anual' : 'Mensal'
          });
        });
      }

      // 🛡️ SÍNTESE DO CICLO CORRENTE PARA EMPRESAS VIP/CORTESIA SEM LOG NO GATEWAY
      clientes.forEach(cli => {
        // Ignora totalmente funcionários de equipe (não pagam assinatura própria)
        if (cli.isFuncionarioVinculado || cli.role === 'funcionario') return;

        // Ignora a conta do Super Admin (não possui faturamento a auditar)
        if (cli.status === 'admin' || cli.email === 'celebrefesta25@gmail.com') return;

        const uD = cli.rawUserData || {};
        const infoTeste = calcularPeriodoTeste(uD);

        // Ignora contas em período de teste gratuito (NUNCA sintetiza fatura para quem está em teste/degustação)
        if (cli.status === 'teste' || infoTeste.emTeste) return;

        const pagou = cli.assinaturaAtiva === true || cli.statusAssinatura === 'ativa' || cli.plano === 'pago';
        if (pagou && !empresasComFaturaAtiva.has(cli.tenantId) && !empresasComFaturaAtiva.has(cli.uid)) {
          // Só sintetiza se houver data de pagamento explicitamente informada
          if (!uD.dataPagamento) return;
          let dPag = new Date(uD.dataPagamento);
          if (isNaN(dPag.getTime())) return;

          const isAnualFallback = Boolean(uD.ciclo === 'anual' || String(cli.planoId || '').includes('anual'));
          let dFimFallback = new Date(dPag);
          if (isAnualFallback) {
            dFimFallback.setFullYear(dFimFallback.getFullYear() + 1);
          } else {
            dFimFallback.setMonth(dFimFallback.getMonth() + 1);
          }
          const perInicioF = dPag.toLocaleDateString('pt-BR');
          const perFimF = dFimFallback.toLocaleDateString('pt-BR');

          listaConsolidada.push({
            id: `fat-ativa-${cli.uid}`,
            codigo: `FAT-${(cli.tenantId || cli.uid).substring(0, 8).toUpperCase()}`,
            dataObj: dPag,
            dataFormatada: perInicioF,
            horaFormatada: '10:00',
            acao: 'LIBERAÇÃO VIP (SUPER ADMIN)',
            detalhes: `Assinatura de ${cli.nomePlano || 'Plano Premium'} concedida pelo Super Admin como Licença Especial / Cortesia VIP.`,
            empresaNome: cli.nomeExibicao || cli.nomeCompleto || 'Empresa Assinante',
            email: cli.email,
            telefone: cli.telefone || '',
            clienteObj: cli,
            metodo: 'Cortesia VIP (Admin)',
            valor: 0.00,
            status: 'cortesia',
            tipoEvento: 'cortesia',
            rawLog: null,
            periodo: `${perInicioF} a ${perFimF}`,
            periodoInicio: perInicioF,
            periodoFim: perFimF,
            cicloNome: isAnualFallback ? 'Anual' : 'Mensal'
          });
        }
      });

      // Ordena por data decrescente (mais recentes primeiro)
      listaConsolidada.sort((a, b) => b.dataObj.getTime() - a.dataObj.getTime());

      setFaturas(listaConsolidada);
    } catch (err) {
      console.error("Erro ao carregar auditoria financeira no Controle Geral:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosFinanceiros();
  }, [clientes]);

  // 📊 CÁLCULO DOS INDICADORES FINANCEIROS (KPIS)
  const metricas = useMemo(() => {
    let receitaTotalQuitada = 0;
    let totalConcluidos = 0;
    let totalTentativas = 0;
    let totalFalhas = 0;
    let totalMudancas = 0;
    let totalCortesias = 0;

    faturas.forEach(f => {
      if (f.status === 'concluido') {
        receitaTotalQuitada += f.valor;
        totalConcluidos++;
      } else if (f.status === 'tentativa') {
        totalTentativas++;
      } else if (f.status === 'falha') {
        totalFalhas++;
      } else if (f.status === 'mudanca') {
        totalMudancas++;
      } else if (f.status === 'cortesia') {
        totalCortesias++;
      }
    });

    // Cálculo do MRR da base de clientes ativa e contagem de assinantes
    let mrrTotal = 0;
    let totalAssinantesAtivos = 0;
    clientes.forEach(c => {
      const isAtivo = c.assinaturaAtiva === true || c.statusAssinatura === 'ativa' || c.plano === 'pago';
      if (isAtivo) {
        totalAssinantesAtivos++;
        const rawP = String(c.planoId || c.plano || '').toLowerCase();
        if (c.rawUserData?.valorAssinatura) {
          mrrTotal += parseFloat(String(c.rawUserData.valorAssinatura).replace(',', '.'));
        } else if (rawP.includes('plus')) {
          mrrTotal += 159.90;
        } else if (rawP.includes('basico')) {
          mrrTotal += 49.90;
        } else {
          mrrTotal += 99.90;
        }
      }
    });

    return {
      receitaTotalQuitada,
      totalConcluidos,
      totalTentativas,
      totalFalhas,
      totalMudancas,
      totalCortesias,
      totalAssinantesAtivos,
      mrrTotal,
      totalGeral: faturas.length
    };
  }, [faturas, clientes]);

  // 🔍 FILTRAGEM DINÂMICA
  const faturasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const agora = new Date();
    const hojeZero = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const seteDiasAtras = new Date(hojeZero.getTime() - 7 * 24 * 60 * 60 * 1000);
    const primeiroDiaMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const primeiroDiaMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const ultimoDiaMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);

    return faturas.filter(f => {
      // 1. Busca textual
      if (termo) {
        const matchCod = f.codigo.toLowerCase().includes(termo);
        const matchEmp = f.empresaNome.toLowerCase().includes(termo);
        const matchEmail = f.email.toLowerCase().includes(termo);
        const matchDet = f.detalhes.toLowerCase().includes(termo);
        if (!matchCod && !matchEmp && !matchEmail && !matchDet) return false;
      }

      // 2. Filtro de Status
      if (filtroStatus !== 'todos') {
        if (f.status !== filtroStatus) return false;
      }

      // 3. Filtro de Método
      if (filtroMetodo !== 'todos') {
        const m = f.metodo.toLowerCase();
        if (filtroMetodo === 'cartao' && !m.includes('cartão') && !m.includes('credit')) return false;
        if (filtroMetodo === 'pix' && !m.includes('pix')) return false;
        if (filtroMetodo === 'boleto' && !m.includes('boleto')) return false;
      }

      // 4. Filtro de Período
      if (filtroPeriodo !== 'todos') {
        const t = f.dataObj.getTime();
        if (filtroPeriodo === 'hoje' && t < hojeZero.getTime()) return false;
        if (filtroPeriodo === '7dias' && t < seteDiasAtras.getTime()) return false;
        if (filtroPeriodo === 'mes_atual' && t < primeiroDiaMesAtual.getTime()) return false;
        if (filtroPeriodo === 'mes_anterior' && (t < primeiroDiaMesAnterior.getTime() || t > ultimoDiaMesAnterior.getTime())) return false;
      }

      return true;
    });
  }, [faturas, busca, filtroStatus, filtroMetodo, filtroPeriodo]);

  // 🖨️ ABERTURA DO COMPROVANTE OFICIAL EM MODAL ELEGANTE
  const abrirReciboModal = (fatura) => {
    setFaturaReciboModal(fatura);
  };

  // 📥 EXPORTAÇÃO COMPLETA PARA CSV (COMPATÍVEL COM EXCEL)
  const exportarParaCSV = () => {
    if (faturasFiltradas.length === 0) return alert("Não há faturas para exportar no filtro atual.");

    const cabecalho = ["Código", "Data", "Hora", "Empresa", "E-mail", "Telefone", "Evento", "Método", "Valor", "Status", "Detalhes"];
    const linhas = faturasFiltradas.map(f => [
      `"${f.codigo}"`,
      `"${f.dataFormatada}"`,
      `"${f.horaFormatada}"`,
      `"${(f.empresaNome || '').replace(/"/g, '""')}"`,
      `"${(f.email || '').replace(/"/g, '""')}"`,
      `"${(f.telefone || '').replace(/"/g, '""')}"`,
      `"${(f.acao || '').replace(/"/g, '""')}"`,
      `"${f.metodo}"`,
      `"${formatarMoeda(f.valor)}"`,
      `"${f.status.toUpperCase()}"`,
      `"${(f.detalhes || '').replace(/"/g, '""')}"`
    ]);

    const conteudoCSV = "\uFEFF" + [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\r\n');
    const blob = new Blob([conteudoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `celebre_auditoria_faturas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="cg-faturamento-container fade-in">
      
      {/* 🌟 BARRA SUPERIOR DE KPI EXECUTIVO (Desktop: 6 Colunas em 1 Linha / Mobile: 2 Colunas Simétricas) */}
      <div className="cg-fat-kpi-grid">
        
        {/* CARD 1: RECEITA TOTAL QUITADA */}
        <div 
          className={`cg-fat-kpi-card destaque-verde ${filtroStatus === 'concluido' ? 'card-ativo' : ''}`}
          onClick={() => setFiltroStatus('concluido')}
          title="Ver faturas quitadas com sucesso"
        >
          <span className="kpi-title">Receita Total</span>
          <div className="kpi-valor-row">
            <div className="kpi-icon-box verde">
              <i className="fas fa-hand-holding-usd"></i>
            </div>
            <div className="kpi-num-wrap">
              <span className="kpi-cur">R$</span>
              <span className="kpi-num">{formatarMoeda(metricas.receitaTotalQuitada)}</span>
            </div>
          </div>
          <span className="kpi-sub green">
            <i className="fas fa-check-circle"></i> {metricas.totalConcluidos === 1 ? '1 quitado' : `${metricas.totalConcluidos} quitados`}
          </span>
        </div>

        {/* CARD 2: MRR ESTIMADO */}
        <div 
          className={`cg-fat-kpi-card destaque-ouro ${filtroStatus === 'todos' ? '' : ''}`}
          onClick={() => setFiltroStatus('todos')}
          title="Receita Recorrente Mensal estimada da base"
        >
          <span className="kpi-title">MRR Estimado</span>
          <div className="kpi-valor-row">
            <div className="kpi-icon-box ouro">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="kpi-num-wrap">
              <span className="kpi-cur">R$</span>
              <span className="kpi-num">{formatarMoeda(metricas.mrrTotal)}</span>
            </div>
          </div>
          <span className="kpi-sub gold">
            <i className="fas fa-crown"></i> Recorrência ativa
          </span>
        </div>

        {/* CARD 3: FATURAS PAGAS */}
        <div 
          className={`cg-fat-kpi-card destaque-azul ${filtroStatus === 'concluido' ? 'card-ativo' : ''}`} 
          onClick={() => setFiltroStatus('concluido')}
          title="Total de pagamentos aprovados"
        >
          <span className="kpi-title">Faturas Pagas</span>
          <div className="kpi-valor-row">
            <div className="kpi-icon-box azul">
              <i className="fas fa-file-invoice-dollar"></i>
            </div>
            <div className="kpi-num-wrap">
              <span className="kpi-num">{metricas.totalConcluidos}</span>
            </div>
          </div>
          <span className="kpi-sub blue">
            <i className="fas fa-receipt"></i> {metricas.totalConcluidos === 1 ? '1 paga' : `${metricas.totalConcluidos} pagas`}
          </span>
        </div>

        {/* CARD 4: ASSINANTES ATIVOS */}
        <div 
          className="cg-fat-kpi-card destaque-ciano"
          onClick={() => setFiltroStatus('todos')}
          title="Empresas com assinatura ativa na Celebre"
        >
          <span className="kpi-title">Assinantes Ativos</span>
          <div className="kpi-valor-row">
            <div className="kpi-icon-box ciano">
              <i className="fas fa-users"></i>
            </div>
            <div className="kpi-num-wrap">
              <span className="kpi-num">{metricas.totalAssinantesAtivos}</span>
            </div>
          </div>
          <span className="kpi-sub ciano">
            <i className="fas fa-user-check"></i> {metricas.totalAssinantesAtivos === 1 ? '1 ativo' : `${metricas.totalAssinantesAtivos} ativos`}
          </span>
        </div>

        {/* CARD 5: FALHAS E RECUSAS */}
        <div 
          className={`cg-fat-kpi-card destaque-vermelho ${filtroStatus === 'falha' ? 'card-ativo' : ''}`} 
          onClick={() => setFiltroStatus('falha')}
          title="Pagamentos recusados ou tentativas com falha"
        >
          <span className="kpi-title">Falhas / Recusas</span>
          <div className="kpi-valor-row">
            <div className="kpi-icon-box vermelho">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div className="kpi-num-wrap">
              <span className="kpi-num red">{metricas.totalFalhas}</span>
            </div>
          </div>
          <span className="kpi-sub red">
            <i className="fas fa-times-circle"></i> {metricas.totalFalhas > 0 ? (metricas.totalFalhas === 1 ? '1 recusa' : `${metricas.totalFalhas} recusas`) : 'Nenhuma falha'}
          </span>
        </div>

        {/* CARD 6: MUDANÇAS DE PLANO */}
        <div 
          className={`cg-fat-kpi-card destaque-roxo ${filtroStatus === 'mudanca' ? 'card-ativo' : ''}`} 
          onClick={() => setFiltroStatus('mudanca')}
          title="Histórico de migrações e upgrades de plano"
        >
          <span className="kpi-title">Mudanças de Plano</span>
          <div className="kpi-valor-row">
            <div className="kpi-icon-box roxo">
              <i className="fas fa-random"></i>
            </div>
            <div className="kpi-num-wrap">
              <span className="kpi-num">{metricas.totalMudancas}</span>
            </div>
          </div>
          <span className="kpi-sub purple">
            <i className="fas fa-sync-alt"></i> {metricas.totalMudancas === 1 ? '1 migração' : `${metricas.totalMudancas} migrações`}
          </span>
        </div>

      </div>

      {/* 🛠️ BARRA DE FILTROS, BUSCA E FERRAMENTAS DO SUPER ADMIN */}
      <div className="cg-fat-toolbar">
        
        {/* LINHA 1: BUSCA GLOBAL + BOTÕES DE AÇÃO */}
        <div className="cg-fat-search-row">
          <div className="cg-fat-search-box">
            <i className="fas fa-search cg-fat-search-icon"></i>
            <input 
              type="text" 
              placeholder="Buscar por código FAT-, empresa, e-mail ou motivo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="cg-fat-input-search"
            />
            {busca && (
              <button 
                type="button" 
                className="cg-fat-btn-clear" 
                onClick={() => setBusca('')}
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          <div className="cg-fat-toolbar-actions">
            <button 
              type="button" 
              className="cg-fat-btn-action" 
              onClick={carregarDadosFinanceiros}
              title="Recarregar dados em tempo real"
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              <span>Sincronizar</span>
            </button>

            <button 
              type="button" 
              className="cg-fat-btn-action export" 
              onClick={exportarParaCSV}
              title="Baixar planilha CSV para o Excel"
            >
              <i className="fas fa-file-csv"></i>
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* LINHA 2: PÍLULAS DE STATUS + SELETORES DE MÉTODO E PERÍODO */}
        <div className="cg-fat-filters-row">
          
          {/* Pílulas de Status */}
          <div className="cg-fat-status-pills">
            <button 
              type="button" 
              className={`cg-fat-pill ${filtroStatus === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('todos')}
            >
              Todos ({faturas.length})
            </button>
            <button 
              type="button" 
              className={`cg-fat-pill green ${filtroStatus === 'concluido' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('concluido')}
            >
              <i className="fas fa-check-circle"></i> Quitados ({metricas.totalConcluidos})
            </button>
            <button 
              type="button" 
              className={`cg-fat-pill orange ${filtroStatus === 'tentativa' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('tentativa')}
              style={{ borderColor: filtroStatus === 'tentativa' ? '#f59e0b' : undefined }}
            >
              <i className="fas fa-hourglass-start"></i> Tentativas ({metricas.totalTentativas})
            </button>
            <button 
              type="button" 
              className={`cg-fat-pill red ${filtroStatus === 'falha' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('falha')}
            >
              <i className="fas fa-times-circle"></i> Recusados / Falhas ({metricas.totalFalhas})
            </button>
            <button 
              type="button" 
              className={`cg-fat-pill purple ${filtroStatus === 'mudanca' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('mudanca')}
            >
              <i className="fas fa-sync-alt"></i> Mudanças de Plano ({metricas.totalMudancas})
            </button>
            {metricas.totalCortesias > 0 && (
              <button 
                type="button" 
                className={`cg-fat-pill blue ${filtroStatus === 'cortesia' ? 'active' : ''}`}
                onClick={() => setFiltroStatus('cortesia')}
              >
                <i className="fas fa-award"></i> VIP / Cortesia ({metricas.totalCortesias})
              </button>
            )}
          </div>

          {/* Menus Suspensos Auxiliares */}
          <div className="cg-fat-selects-group">
            <select 
              value={filtroMetodo} 
              onChange={e => setFiltroMetodo(e.target.value)}
              className="cg-fat-select"
            >
              <option value="todos">Método: Todos</option>
              <option value="cartao">Cartão de Crédito</option>
              <option value="pix">PIX</option>
              <option value="boleto">Boleto Bancário</option>
            </select>

            <select 
              value={filtroPeriodo} 
              onChange={e => setFiltroPeriodo(e.target.value)}
              className="cg-fat-select"
            >
              <option value="todos">Período: Todo o Histórico</option>
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="mes_atual">Este Mês</option>
              <option value="mes_anterior">Mês Anterior</option>
            </select>
          </div>

        </div>

      </div>

      {/* 📄 TABELA DE FATURAS E AUDITORIA FINANCEIRA */}
      <div className="cg-fat-table-card">
        {loading ? (
          <div className="cg-fat-loading-box">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Carregando faturas e auditoria de pagamentos...</p>
          </div>
        ) : faturasFiltradas.length === 0 ? (
          <div className="cg-fat-empty-box">
            <i className="fas fa-receipt"></i>
            <h4>Nenhum registro encontrado</h4>
            <p>Não há faturas ou movimentações que correspondam aos filtros selecionados.</p>
            {(busca || filtroStatus !== 'todos' || filtroMetodo !== 'todos' || filtroPeriodo !== 'todos') && (
              <button 
                type="button" 
                className="cg-fat-btn-reset-filters"
                onClick={() => {
                  setBusca('');
                  setFiltroStatus('todos');
                  setFiltroMetodo('todos');
                  setFiltroPeriodo('todos');
                }}
              >
                Limpar Todos os Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="cg-fat-table-responsive">
            <table className="cg-fat-table">
              <thead>
                <tr>
                  <th>Fatura / Cód</th>
                  <th>Empresa / Assinante</th>
                  <th>Data & Horário</th>
                  <th>Evento / Descrição</th>
                  <th>Método</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações Super Admin</th>
                </tr>
              </thead>
              <tbody>
                {faturasFiltradas.map((fat) => {
                  const isConcluido = fat.status === 'concluido';
                  const isFalha = fat.status === 'falha';
                  const isMudanca = fat.status === 'mudanca';

                  return (
                    <tr key={fat.id} className={`linha-fat ${fat.status}`}>
                      
                      {/* CÓDIGO DA FATURA */}
                      <td className="fat-col-codigo">
                        <span className="fat-code-badge">{fat.codigo}</span>
                      </td>

                      {/* EMPRESA & CLIENTE */}
                      <td className="fat-col-empresa">
                        <div className="fat-empresa-info">
                          <strong className="fat-empresa-nome" title={fat.empresaNome}>
                            {fat.empresaNome}
                          </strong>
                          <span className="fat-empresa-email" title={fat.email}>
                            {fat.email}
                          </span>
                          {fat.telefone && (
                            <span className="fat-empresa-tel">
                              <i className="fab fa-whatsapp"></i> {fat.telefone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* DATA & HORA */}
                      <td className="fat-col-data">
                        <div className="fat-data-box">
                          <span className="fat-data-dia">{fat.dataFormatada}</span>
                          <span className="fat-data-hora">{fat.horaFormatada}</span>
                        </div>
                      </td>

                      {/* DESCRIÇÃO / AÇÃO */}
                      <td className="fat-col-desc">
                        <div className="fat-desc-box">
                          <strong className="fat-desc-acao">{fat.acao}</strong>
                          <p className="fat-desc-detalhe" title={fat.detalhes}>
                            {fat.detalhes}
                          </p>
                        </div>
                      </td>

                      {/* MÉTODO */}
                      <td className="fat-col-metodo">
                        <span className={`fat-metodo-pill ${fat.metodo.toLowerCase().includes('pix') ? 'pix' : fat.metodo.toLowerCase().includes('boleto') ? 'boleto' : (fat.status === 'cortesia' || fat.metodo.toLowerCase().includes('cortesia')) ? 'cortesia' : fat.metodo.toLowerCase().includes('pendente') ? 'pendente' : 'cartao'}`}>
                          {fat.metodo.toLowerCase().includes('pix') ? (
                            <><i className="fas fa-qrcode"></i> PIX</>
                          ) : fat.metodo.toLowerCase().includes('boleto') ? (
                            <><i className="fas fa-barcode"></i> Boleto</>
                          ) : (fat.status === 'cortesia' || fat.metodo.toLowerCase().includes('cortesia')) ? (
                            <><i className="fas fa-award"></i> Cortesia</>
                          ) : fat.metodo.toLowerCase().includes('pendente') ? (
                            <><i className="fas fa-clock"></i> Pendente</>
                          ) : (
                            <><i className="fas fa-credit-card"></i> Cartão</>
                          )}
                        </span>
                      </td>

                      {/* VALOR */}
                      <td className="fat-col-valor">
                        <span className={`fat-valor-tag ${isConcluido ? 'pago' : isFalha ? 'recusado' : fat.status === 'tentativa' ? 'tentativa' : 'neutro'}`}>
                          {isConcluido && '+ '}
                          {isFalha && '✕ '}
                          {fat.status === 'cortesia' ? 'R$ 0,00' : `R$ ${formatarMoeda(fat.valor)}`}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="fat-col-status">
                        {isConcluido && (
                          <span className="fat-status-badge success">
                            <i className="fas fa-check-circle"></i> Quitado
                          </span>
                        )}
                        {fat.status === 'tentativa' && (
                          <span className="fat-status-badge warning" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                            <i className="fas fa-hourglass-start"></i> Tentativa (Não Quitado)
                          </span>
                        )}
                        {fat.status === 'cortesia' && (
                          <span className="fat-status-badge info" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            <i className="fas fa-award"></i> Cortesia VIP
                          </span>
                        )}
                        {isFalha && (
                          <span className="fat-status-badge danger">
                            <i className="fas fa-times-circle"></i> Recusado
                          </span>
                        )}
                        {isMudanca && (
                          <span className="fat-status-badge info">
                            <i className="fas fa-sync-alt"></i> Alteração
                          </span>
                        )}
                        {fat.status === 'pendente' && (
                          <span className="fat-status-badge warning">
                            <i className="fas fa-clock"></i> Pendente
                          </span>
                        )}
                      </td>

                      {/* AÇÕES */}
                      <td className="fat-col-acoes" style={{ textAlign: 'right' }}>
                        <div className="fat-acoes-group">
                          
                          {/* Ver / Imprimir Recibo Oficial - Somente para pagamentos quitados ou cortesias */}
                          {isConcluido || fat.status === 'cortesia' ? (
                            <button 
                              type="button" 
                              className="fat-btn-icon print"
                              onClick={() => abrirReciboModal(fat)}
                              title="Visualizar Comprovante Oficial Celebre"
                            >
                              <i className="fas fa-print"></i>
                            </button>
                          ) : (
                            <button 
                              type="button" 
                              className="fat-btn-icon print disabled"
                              disabled
                              style={{ opacity: 0.35, cursor: 'not-allowed' }}
                              title="Recibo indisponível: cobrança não quitada"
                            >
                              <i className="fas fa-print"></i>
                            </button>
                          )}

                          {/* Ver Detalhes Técnicos */}
                          <button 
                            type="button" 
                            className="fat-btn-icon details"
                            onClick={() => setItemDetalhesModal(fat)}
                            title="Auditar Detalhes do Registro"
                          >
                            <i className="fas fa-info-circle"></i>
                          </button>

                          {/* Abrir Suporte da Empresa */}
                          {fat.clienteObj && onAbrirSuporteCliente && (
                            <button 
                              type="button" 
                              className="fat-btn-icon support"
                              onClick={() => onAbrirSuporteCliente(fat.clienteObj)}
                              title="Abrir Central de Suporte desta Empresa"
                            >
                              <i className="fas fa-user-shield"></i>
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* RODAPÉ INFORMATIVO DA TABELA */}
        <div className="cg-fat-table-footer">
          <span>Exibindo <strong>{faturasFiltradas.length}</strong> de <strong>{faturas.length}</strong> registros auditados</span>
          <span className="cg-fat-footer-tip">
            <i className="fas fa-shield-alt"></i> Dados sincronizados diretamente da auditoria do Firebase Firestore
          </span>
        </div>
      </div>

      {/* 🔍 MODAL DE DETALHES TÉCNICOS DA TRANSAÇÃO */}
      {itemDetalhesModal && (
        <div className="cg-fat-modal-backdrop" onClick={() => setItemDetalhesModal(null)}>
          <div className="cg-fat-modal-card" onClick={e => e.stopPropagation()}>
            
            <div className="cg-fat-modal-header">
              <div className="modal-header-left">
                <div className={`modal-header-icon ${itemDetalhesModal.status}`}>
                  <i className={itemDetalhesModal.status === 'concluido' ? 'fas fa-check' : itemDetalhesModal.status === 'falha' ? 'fas fa-times' : 'fas fa-info'}></i>
                </div>
                <div>
                  <h3 className="modal-title">Auditoria da Transação • {itemDetalhesModal.codigo}</h3>
                  <span className="modal-subtitle">Registro de Faturamento do Super Admin</span>
                </div>
              </div>
              <button type="button" className="modal-btn-close" onClick={() => setItemDetalhesModal(null)}>✕</button>
            </div>

            <div className="cg-fat-modal-body">
              
              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <label>Empresa / Assinante</label>
                  <strong>{itemDetalhesModal.empresaNome}</strong>
                  <span>{itemDetalhesModal.email}</span>
                </div>

                <div className="modal-info-item">
                  <label>Data & Hora</label>
                  <strong>{itemDetalhesModal.dataFormatada} às {itemDetalhesModal.horaFormatada}</strong>
                  <span>Processamento bancário</span>
                </div>

                <div className="modal-info-item">
                  <label>Forma de Processamento</label>
                  <strong>{itemDetalhesModal.metodo}</strong>
                  <span>{itemDetalhesModal.status === 'cortesia' ? 'Concessão Administrativa' : 'Gateway Mercado Pago'}</span>
                </div>

                <div className="modal-info-item">
                  <label>Valor</label>
                  <strong className={itemDetalhesModal.status === 'concluido' ? 'green-text' : itemDetalhesModal.status === 'cortesia' ? 'blue-text' : 'red-text'}>
                    R$ {formatarMoeda(itemDetalhesModal.status === 'cortesia' ? 0 : itemDetalhesModal.valor)}
                  </strong>
                  <span>Status: {itemDetalhesModal.status.toUpperCase()}</span>
                </div>
              </div>

              <div className="modal-detalhes-bloco">
                <label>Descrição Completa do Evento / Motivo</label>
                <div className="detalhes-log-text">
                  {itemDetalhesModal.detalhes || 'Sem detalhes adicionais registrados.'}
                </div>
              </div>

              {itemDetalhesModal.rawLog && (
                <div className="modal-detalhes-bloco">
                  <label>Auditoria Técnica (Logs de Sistema)</label>
                  <pre className="detalhes-json-box">
                    {JSON.stringify({
                      id: itemDetalhesModal.id,
                      acao: itemDetalhesModal.acao,
                      usuarioEmail: itemDetalhesModal.rawLog.usuarioEmail,
                      nomeFuncionario: itemDetalhesModal.rawLog.nomeFuncionario,
                      empresaId: itemDetalhesModal.rawLog.empresaId,
                      dataHora: itemDetalhesModal.rawLog.dataHora
                    }, null, 2)}
                  </pre>
                </div>
              )}

            </div>

            <div className="cg-fat-modal-footer">
              <button 
                type="button" 
                className="btn-modal-secundario"
                onClick={() => setItemDetalhesModal(null)}
              >
                Fechar
              </button>

              <div className="modal-footer-actions">
                {itemDetalhesModal.clienteObj && onAbrirSuporteCliente && (
                  <button 
                    type="button" 
                    className="btn-modal-suporte"
                    onClick={() => {
                      const cli = itemDetalhesModal.clienteObj;
                      setItemDetalhesModal(null);
                      onAbrirSuporteCliente(cli);
                    }}
                  >
                    <i className="fas fa-user-shield"></i> Ver Perfil do Cliente
                  </button>
                )}

                {itemDetalhesModal.status === 'concluido' || itemDetalhesModal.status === 'cortesia' ? (
                  <button 
                    type="button" 
                    className="btn-modal-print"
                    onClick={() => {
                      const f = itemDetalhesModal;
                      setItemDetalhesModal(null);
                      abrirReciboModal(f);
                    }}
                  >
                    <i className="fas fa-receipt"></i> Ver Comprovante Oficial
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="btn-modal-print disabled"
                    disabled
                    style={{ opacity: 0.45, cursor: 'not-allowed' }}
                    title="Tentativas de checkout não geram comprovante fiscal de quitação"
                  >
                    <i className="fas fa-ban"></i> Sem Recibo (Não Quitado)
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 🧾 MODAL DO RECIBO OFICIAL CELEBRE */}
      <ModalReciboOficial
        isOpen={Boolean(faturaReciboModal)}
        onClose={() => setFaturaReciboModal(null)}
        fatura={faturaReciboModal}
        isAdmin={true}
      />

    </div>
  );
};

export default AbaFaturamentoAdmin;
