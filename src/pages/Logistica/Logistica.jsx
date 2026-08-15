import React, { useState, useEffect, useMemo } from 'react';
import './Logistica.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, getDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import ModalCheckinLocacao from '../Locacoes/ModalCheckinLocacao';
import { gerarEtiquetasCaixotePDF } from '../../utils/gerarEtiquetasCaixotePDF';
import { gerarComprovanteCheckinPDF } from '../../utils/gerarComprovanteCheckinPDF';
import { gerarRomaneioPDF } from './gerarRomaneioPDF';
import { gerarFolhaSeparacaoGalpaoPDF } from './gerarFolhaSeparacaoGalpaoPDF';
import { ModalAssinaturaEntrega } from './ModalAssinaturaEntrega';
import { ModalDesignarMotorista } from './ModalDesignarMotorista';

const Logistica = () => {
  const navigate = useNavigate();

  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [locacoes, setLocacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTempo, setFiltroTempo] = useState('mes_atual'); // 'hoje' | 'mes_atual' | 'tudo'
  const [filtroMotorista, setFiltroMotorista] = useState('todos');
  const [vistaAtual, setVistaAtual] = useState('kanban'); // 'kanban' | 'lista'
  const [etapaMobileAtiva, setEtapaMobileAtiva] = useState('preparacao'); // 'orcamento' | 'confirmado' | 'preparacao' | 'entregue' | 'finalizado'
  
  const [checklistModalId, setChecklistModalId] = useState(null);
  const [relatorioModalLoc, setRelatorioModalLoc] = useState(null);
  const [modalAssinaturaLoc, setModalAssinaturaLoc] = useState(null);
  const [modalDesignarLoc, setModalDesignarLoc] = useState(null);
  const [parametros, setParametros] = useState(null);
  const [textoRelatorio, setTextoRelatorio] = useState('');

  // 🛫🛬 MODAL DE CHECK-IN DE IDA E VOLTA
  const [modalCheckinAberta, setModalCheckinAberta] = useState(false);
  const [locacaoCheckin, setLocacaoCheckin] = useState(null);
  const [modoCheckin, setModoCheckin] = useState('IDA');

  const abrirCheckin = (loc, modo) => {
    setLocacaoCheckin(loc);
    setModoCheckin(modo);
    setModalCheckinAberta(true);
  };

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO CORPORATIVO)
  const registrarLog = async (acao, detalhes, pedidoId = "S/N", numeroPedido = "S/N") => {
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        pedidoId: pedidoId,
        numeroPedido: numeroPedido,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria:", error);
    }
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
      const snap = await getDocs(qLocacoes);
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ordenados = dados.sort((a, b) => (a.dataRetirada || '').localeCompare(b.dataRetirada || ''));
      setLocacoes(ordenados);

      // Busca parâmetros da empresa para o PDF (Logo, Nome, etc)
      const docRef = doc(db, "configuracoes_empresa", tenantId);
      const docSnap = await getDoc(docRef).catch(() => ({ exists: () => false }));
      if (docSnap && docSnap.exists()) {
        setParametros(docSnap.data());
      }

      // Busca texto base do relatório de avarias da empresa
      const contratoRef = doc(db, "relatorio_avarias", tenantId);
      const contratoSnap = await getDoc(contratoRef).catch(() => ({ exists: () => false }));
      if (contratoSnap && contratoSnap.exists()) {
        setTextoRelatorio(contratoSnap.data().conteudo || contratoSnap.data().texto || '');
      }

    } catch (e) {
      console.error("Erro ao carregar logística:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    carregarDados();
  }, [usuarioLogado, navigate, tenantId]);

  const moverCard = async (id, novoStatus, forcar = false) => {
    const locacaoAlvo = locacoes.find(l => l.id === id);
    if (!locacaoAlvo) return;
    const hojeStr = new Date().toISOString().split('T')[0];

    if (novoStatus === 'finalizado' && !forcar) {
        if (locacaoAlvo.dataRetirada > hojeStr) {
            alert(`🚫 BLOQUEADO:\nA data do evento é ${locacaoAlvo.dataRetirada.split('-').reverse().join('/')}. Você não pode receber peças de volta de uma festa que ainda nem aconteceu!`);
            return; 
        }
        if (locacaoAlvo.dataDevolucao && locacaoAlvo.dataDevolucao > hojeStr) {
            const confAntecipada = window.confirm(`⚠️ DEVOLUÇÃO ANTECIPADA:\nA devolução estava marcada para ${locacaoAlvo.dataDevolucao.split('-').reverse().join('/')}, mas o cliente devolveu hoje. Confirmar o recebimento no galpão?`);
            if (!confAntecipada) return;
        } else {
            const confirmacao = window.confirm('O material chegou no galpão? Ele irá para a coluna de Devolvidos para conferência final.');
            if (!confirmacao) return;
        }
    }

    try {
      const statusAntigo = (locacaoAlvo.status || 'indefinido').toUpperCase();
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      setLocacoes(prev => prev.map(loc => loc.id === id ? { ...loc, status: novoStatus } : loc));
      
      // 🔥 Auditoria de movimento
      await registrarLog(
        "MOVIMENTAÇÃO DE ESTEIRA", 
        `Avançou o pedido #${locacaoAlvo.numeroPedido || id.substring(0,6).toUpperCase()} de ${statusAntigo} para ${novoStatus.toUpperCase()}${forcar ? ' (FORÇADO/REGULARIZAÇÃO)' : ''}.`,
        id,
        locacaoAlvo.numeroPedido
      );
    } catch (e) {
      alert("Erro ao atualizar o status.");
    }
  };

  // ⚡ FORÇAR AVANÇO DIRETO PARA PEDIDOS COM DATA PASSADA
  const forcarAvancar = async (id, destinoStatus = 'finalizado') => {
    const locacaoAlvo = locacoes.find(l => l.id === id);
    if (!locacaoAlvo) return;
    
    const conf = window.confirm(`⚡ REGULARIZAR PEDIDO #${locacaoAlvo.numeroPedido || id.substring(0,6).toUpperCase()}:\nDeseja forçar o avanço deste pedido diretamente para a etapa de "${destinoStatus.toUpperCase()}"?`);
    if (!conf) return;

    await moverCard(id, destinoStatus, true);
  };

  // ⚡ REGULARIZAR TODOS OS ATRASADOS EM LOTE
  const regularizarTodosAtrasados = async () => {
    const hojeStr = new Date().toISOString().split('T')[0];
    const atrasados = locacoes.filter(l => l.dataRetirada && l.dataRetirada < hojeStr && l.status !== 'finalizado');
    if (atrasados.length === 0) {
      alert("Nenhum pedido com data retroativa pendente.");
      return;
    }

    const conf = window.confirm(`⚡ REGULARIZAR ${atrasados.length} PEDIDOS ATRASADOS EM LOTE:\n\nExistem ${atrasados.length} pedidos cujas datas de eventos já passaram.\nDeseja mover todos eles diretamente para "5. Devolvidos" para liberar o fluxo de galpão?`);
    if (!conf) return;

    setLoading(true);
    try {
      for (const loc of atrasados) {
        await updateDoc(doc(db, "locacoes", loc.id), { status: 'finalizado' });
        await registrarLog("REGULARIZAÇÃO EM LOTE", `Regularizou pedido atrasado #${loc.numeroPedido || loc.id} movendo para FINALIZADO.`, loc.id, loc.numeroPedido);
      }
      setLocacoes(prev => prev.map(loc => {
        if (loc.dataRetirada && loc.dataRetirada < hojeStr && loc.status !== 'finalizado') {
          return { ...loc, status: 'finalizado' };
        }
        return loc;
      }));
      alert(`✅ Sucesso! ${atrasados.length} pedidos atrasados foram regularizados e movidos para Devolvidos.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao regularizar pedidos.");
    } finally {
      setLoading(false);
    }
  };

  const toggleItemChecklist = async (locId, itemIndex, tipo) => {
    const locacao = locacoes.find(l => l.id === locId);
    if (!locacao || !locacao.itens) return;

    const itemAlvo = locacao.itens[itemIndex];
    const novosItens = locacao.itens.map((item, idx) => {
      if (idx === itemIndex) return { ...item, [tipo]: !item[tipo] };
      return item;
    });

    setLocacoes(prev => prev.map(loc => loc.id === locId ? { ...loc, itens: novosItens } : loc));
    
    try { 
      await updateDoc(doc(db, "locacoes", locId), { itens: novosItens });
      
      if (tipo === 'checkedSeparacao') {
        const acao = !itemAlvo.checkedSeparacao ? "ITEM SEPARADO" : "ITEM PENDENTE";
        registrarLog(
          acao, 
          `Checklist de Saída: Marcou "${itemAlvo.nome}" como ${!itemAlvo.checkedSeparacao ? 'CONFERIDO' : 'NÃO CONFERIDO'}.`, 
          locId, 
          locacao.numeroPedido
        );
      }
    } catch (e) {
        console.error("Erro no checklist", e);
    }
  };

  const registrarRetornoItem = async (locId, itemIndex, status) => {
    const locacao = locacoes.find(l => l.id === locId);
    if (!locacao || !locacao.itens) return;

    const itemAlvo = locacao.itens[itemIndex];
    const novosItens = locacao.itens.map((item, idx) => {
      if (idx === itemIndex) {
        if (status === 'ok') return { ...item, checkedDevolucao: true, avaria: false, faltou: false };
        if (status === 'avaria') return { ...item, checkedDevolucao: true, avaria: true, faltou: false };
        if (status === 'faltou') return { ...item, checkedDevolucao: true, avaria: false, faltou: true };
        if (status === 'desmarcar') return { ...item, checkedDevolucao: false, avaria: false, faltou: false };
      }
      return item;
    });

    setLocacoes(prev => prev.map(loc => loc.id === locId ? { ...loc, itens: novosItens } : loc));
    
    try { 
      await updateDoc(doc(db, "locacoes", locId), { itens: novosItens });
      
      let txtStatus = status === 'ok' ? 'DEVOLVIDO OK' : status === 'avaria' ? 'COM AVARIA' : status === 'faltou' ? 'FALTANDO/EXTRAVIO' : 'DESMARCADO';
      registrarLog("CONFERÊNCIA DE RETORNO", `Marcou o item "${itemAlvo.nome}" como ${txtStatus}.`, locId, locacao.numeroPedido);
    } catch (e) {
      console.error("Erro no registro de retorno", e);
    }
  };

  // 🚚 HELPER DE DETECÇÃO ROBUSTA DE ENTREGA VS RETIRADA NA LOJA
  const verificarSeEhEntrega = (loc) => {
    if (!loc) return false;
    const freteTipo = String(
      loc.tipoFrete || 
      loc.modalidadeFrete || 
      loc.tipoEnvio || 
      loc.logistica?.tipo || 
      loc.logistica?.tipoFrete || 
      ''
    ).toLowerCase().trim();

    if (freteTipo.includes('entrega') || freteTipo.includes('frete') || freteTipo.includes('transport') || freteTipo.includes('levar')) {
      return true;
    }
    if (freteTipo.includes('loja') || freteTipo.includes('retirada') || freteTipo.includes('balcao') || freteTipo.includes('pegue')) {
      return false;
    }
    if (loc.modalidadeServico === 'decoracao_completa' || loc.modalidadeServico === 'decoracao') {
      return true;
    }
    if (Number(loc.taxaEntrega || loc.valorFrete || loc.frete || 0) > 0) {
      return true;
    }
    const end = loc.logistica?.endereco || loc.endereco || '';
    if (end.trim() && !end.toLowerCase().includes('retirada') && !end.toLowerCase().includes('balcão') && !end.toLowerCase().includes('loja')) {
      return true;
    }
    return false;
  };

  // 📍 HELPER DE ENDEREÇO COMPLETO PARA GPS
  const obterEnderecoCompleto = (loc) => {
    if (!loc) return '';
    const partes = [
      loc.logistica?.endereco || loc.endereco,
      loc.logistica?.numero || loc.numero,
      loc.logistica?.bairro || loc.bairro,
      loc.logistica?.cidade || loc.cidade,
      loc.logistica?.estado || loc.estado || 'Brasil'
    ].filter(Boolean);
    return partes.join(', ');
  };

  // Ações de Campo (GPS / WhatsApp)
  const abrirGPS = (loc) => {
    const enderecoCompleto = obterEnderecoCompleto(loc);
    if (!enderecoCompleto.trim()) {
      alert("Nenhum endereço cadastrado para esta locação.");
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
    window.open(url, '_blank');
  };

  const abrirWhatsApp = (loc) => {
    const fone = String(loc.clienteTelefone || loc.telefone || '').replace(/\D/g, '');
    if (!fone) {
      alert("Telefone do cliente não cadastrado.");
      return;
    }
    const numLimpo = fone.length <= 11 ? `55${fone}` : fone;
    const nome = loc.clienteNome || 'Cliente';
    const msg = encodeURIComponent(`Olá ${nome}! Aqui é da equipe Celebre Decorações. Estamos cuidando da logística do seu pedido #${loc.numeroPedido || ''}. Qualquer dúvida, estamos à disposição! 🎉`);
    window.open(`https://wa.me/${numLimpo}?text=${msg}`, '_blank');
  };

  // ✍️ SALVAR ASSINATURA DIGITAL DE ENTREGA
  const salvarAssinaturaEntrega = async (locId, dadosAssinatura) => {
    const locAlvo = locacoes.find(l => l.id === locId);
    if (!locAlvo) return;
    
    const novaLogistica = {
      ...(locAlvo.logistica || {}),
      ...dadosAssinatura
    };

    setLocacoes(prev => prev.map(loc => loc.id === locId ? { ...loc, logistica: novaLogistica } : loc));
    
    try {
      await updateDoc(doc(db, "locacoes", locId), { logistica: novaLogistica });
      await registrarLog(
        "ASSINATURA DIGITAL",
        `Comprovante de entrega assinado digitalmente por "${dadosAssinatura.recebidoPor}".`,
        locId,
        locAlvo.numeroPedido
      );
      alert(`✅ Comprovante de entrega assinado por ${dadosAssinatura.recebidoPor} gravado com sucesso!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar assinatura.");
    }
  };

  // 🚗 SALVAR DESIGNAÇÃO DE MOTORISTA E EMBALAGENS
  const salvarDesignacaoMotorista = async (locId, dados) => {
    const locAlvo = locacoes.find(l => l.id === locId);
    if (!locAlvo) return;

    setLocacoes(prev => prev.map(loc => loc.id === locId ? { ...loc, logistica: dados.logistica, embalagens: dados.embalagens } : loc));

    try {
      await updateDoc(doc(db, "locacoes", locId), {
        logistica: dados.logistica,
        embalagens: dados.embalagens
      });
      await registrarLog(
        "DESIGNAÇÃO DE TRANSPORTE",
        `Definiu motorista: "${dados.logistica.motoristaNome || 'Nenhum'}" (${dados.logistica.veiculo || 'S/V'}) e caixas: ${dados.embalagens.caixas}.`,
        locId,
        locAlvo.numeroPedido
      );
      alert(`✅ Motorista e embalagens atualizados com sucesso!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar transporte.");
    }
  };

  // Filtragem Inteligente com Busca, Período e Motorista
  const hojeStr = new Date().toISOString().split('T')[0];
  const mesAtual = hojeStr.substring(0, 7);
  
  // Lista única de motoristas cadastrados
  const listaMotoristas = useMemo(() => {
    const todos = locacoes.map(l => l.logistica?.motoristaNome).filter(Boolean);
    return Array.from(new Set(todos));
  }, [locacoes]);

  const locacoesFiltradas = useMemo(() => {
    return locacoes.filter(loc => {
      // 1. Busca Textual (Cliente, Pedido, Tema, Telefone, Cidade)
      if (termoBusca.trim() !== '') {
        const busca = termoBusca.toLowerCase();
        const match = 
          (loc.clienteNome || '').toLowerCase().includes(busca) ||
          String(loc.numeroPedido || '').toLowerCase().includes(busca) ||
          (loc.tema || loc.temaFesta || '').toLowerCase().includes(busca) ||
          (loc.clienteTelefone || loc.telefone || '').includes(busca) ||
          (loc.logistica?.cidade || loc.cidade || '').toLowerCase().includes(busca) ||
          (loc.logistica?.endereco || loc.endereco || '').toLowerCase().includes(busca) ||
          (loc.logistica?.motoristaNome || '').toLowerCase().includes(busca);
        if (!match) return false;
      }

      // 2. Filtro de Tempo
      if (loc.dataRetirada) {
        if (filtroTempo === 'hoje' && !(loc.dataRetirada === hojeStr || (loc.dataDevolucao === hojeStr && loc.status === 'entregue'))) return false;
        if (filtroTempo === 'mes_atual' && !(loc.dataRetirada.startsWith(mesAtual) || (loc.dataDevolucao && loc.dataDevolucao.startsWith(mesAtual)))) return false;
      }

      // 3. Filtro por Motorista
      if (filtroMotorista !== 'todos') {
        const mot = loc.logistica?.motoristaNome || '';
        if (mot.toLowerCase() !== filtroMotorista.toLowerCase()) return false;
      }

      return true; 
    });
  }, [locacoes, termoBusca, filtroTempo, filtroMotorista, hojeStr, mesAtual]);

  // 📦 ESTEIRA OPERACIONAL DE GALPÃO (4 ETAPAS REAIS)
  const colunas = useMemo(() => ({
    confirmado: locacoesFiltradas.filter(l => l.status === 'confirmado' || l.status === 'aprovado' || l.status === 'a_separar'),
    preparacao: locacoesFiltradas.filter(l => l.status === 'preparacao' || l.status === 'em_preparacao'),
    entregue: locacoesFiltradas.filter(l => l.status === 'entregue' || l.status === 'em_transito'),
    finalizado: locacoesFiltradas.filter(l => l.status === 'finalizado' || l.status === 'devolvido'),
  }), [locacoesFiltradas]);

  const locacaoModalAtiva = locacoes.find(l => l.id === checklistModalId);

  // Contagem de pedidos atrasados não finalizados
  const pedidosAtrasados = useMemo(() => {
    return locacoes.filter(l => l.dataRetirada && l.dataRetirada < hojeStr && l.status !== 'finalizado');
  }, [locacoes, hojeStr]);

  if (loading) return <div className="carregando-kanban">Atualizando esteira logística e rotas... ⏳</div>;

  const etapasInfo = [
    { key: 'confirmado', nome: '1. A Separar', cor: '#3b82f6', badgeBg: '#eff6ff', badgeColor: '#1d4ed8', count: colunas.confirmado.length },
    { key: 'preparacao', nome: '2. Em Separação', cor: '#f59e0b', badgeBg: '#fef3c7', badgeColor: '#b45309', count: colunas.preparacao.length },
    { key: 'entregue', nome: '3. Na Rua / Evento', cor: '#8b5cf6', badgeBg: '#f5f3ff', badgeColor: '#6d28d9', count: colunas.entregue.length },
    { key: 'finalizado', nome: '4. Devolvidos', cor: '#10b981', badgeBg: '#f0fdf4', badgeColor: '#15803d', count: colunas.finalizado.length },
  ];

  return (
    <div className={`kanban-container fade-in ${vistaAtual === 'lista' ? 'modo-lista-ativa' : ''}`}>
      
      {/* CABEÇALHO EXECUTIVO DA LOGÍSTICA */}
      <header className="kanban-header-top">
        <div className="kanban-titles">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span className="logistica-badge-head">🚚 OPERAÇÃO &amp; FLUXO DE GALPÃO</span>
          </div>
          <h1>Logística &amp; Roteiro</h1>
          <p>Esteira operacional de separação, transporte, eventos em andamento e devoluções.</p>
        </div>

        <div className="kanban-top-actions">
          
          {/* 📄 BOTÃO GERAR ROMANEIO DE CARGA EM PDF */}
          <button 
            type="button" 
            className="btn-romaneio-pdf"
            onClick={() => gerarRomaneioPDF(locacoesFiltradas, { data: filtroTempo === 'hoje' ? hojeStr : null, motorista: filtroMotorista !== 'todos' ? filtroMotorista : null }, parametros)}
            title="Gerar Romaneio de Carga e Rota do Motorista em PDF"
          >
            📋 Romaneio da Rota (PDF)
          </button>

          {/* 📦 BOTÃO GERAR MAPA GERAL DE SEPARAÇÃO EM PDF */}
          <button 
            type="button" 
            className="btn-romaneio-pdf"
            style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', border: '1px solid #475569' }}
            onClick={() => gerarFolhaSeparacaoGalpaoPDF(locacoesFiltradas, { data: filtroTempo === 'hoje' ? hojeStr : null }, parametros)}
            title="Gerar Folha de Separação de Peças de Galpão em PDF"
          >
            📦 Mapa de Separação (PDF)
          </button>

          {/* 🚗 FILTRO POR MOTORISTA / VEÍCULO */}
          {listaMotoristas.length > 0 && (
            <div className="driver-filter-box">
              <label>🚗</label>
              <select 
                value={filtroMotorista} 
                onChange={e => setFiltroMotorista(e.target.value)}
                className="select-filtro-motorista"
                title="Filtrar pedidos por motorista/equipe"
              >
                <option value="todos">Todos os Motoristas ({locacoes.length})</option>
                {listaMotoristas.map((m, i) => (
                  <option key={i} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* SELETOR DE VISÃO */}
          <div className="view-switcher-log">
            <button 
              type="button"
              className={vistaAtual === 'kanban' ? 'ativo' : ''} 
              onClick={() => setVistaAtual('kanban')}
            >
              🖥️ Kanban
            </button>
            <button 
              type="button"
              className={vistaAtual === 'lista' ? 'ativo' : ''} 
              onClick={() => setVistaAtual('lista')}
            >
              📋 Roteiro / Lista
            </button>
          </div>

          {/* FILTRO DE TEMPO */}
          <div className="kanban-filters">
            <button 
              type="button"
              className={filtroTempo === 'hoje' ? 'ativo' : ''} 
              onClick={() => setFiltroTempo('hoje')}
            >
              🚀 Hoje
            </button>
            <button 
              type="button"
              className={filtroTempo === 'mes_atual' ? 'ativo' : ''} 
              onClick={() => setFiltroTempo('mes_atual')}
            >
              📆 Este Mês
            </button>
            <button 
              type="button"
              className={filtroTempo === 'tudo' ? 'ativo' : ''} 
              onClick={() => setFiltroTempo('tudo')}
            >
              🌐 Tudo
            </button>
          </div>
        </div>
      </header>

      {/* BARRA DE PESQUISA RÁPIDA */}
      <div className="logistica-search-bar">
        <div style={{ flex: '1', minWidth: '180px' }}>
          <input 
            type="text" 
            placeholder="🔍 Buscar por cliente, pedido #, motorista, tema ou endereço..." 
            value={termoBusca}
            onChange={e => setTermoBusca(e.target.value)}
            className="logistica-input-busca"
          />
        </div>

        {termoBusca && (
          <button 
            type="button" 
            onClick={() => setTermoBusca('')}
            className="btn-limpar-busca"
          >
            Limpar
          </button>
        )}

        {pedidosAtrasados.length > 0 && (
          <button 
            type="button" 
            onClick={regularizarTodosAtrasados}
            className="btn-destravar-desktop-only"
            title="Mover todos os pedidos com eventos já passados para a etapa de Devolvidos"
          >
            ⚡ Destravar Atrasados ({pedidosAtrasados.length})
          </button>
        )}
      </div>

      {/* 📱 BANNER DE DESTRAVAMENTO EM LOTE EXCLUSIVO PARA O CELULAR */}
      {pedidosAtrasados.length > 0 && (
        <div className="alerta-atrasados-mobile-banner">
          <div className="banner-txt">
            <span>⚡ <strong>{pedidosAtrasados.length}</strong> {pedidosAtrasados.length === 1 ? 'pedido atrasado pendente' : 'pedidos atrasados pendentes'}</span>
          </div>
          <button 
            type="button" 
            onClick={regularizarTodosAtrasados}
            className="banner-btn"
          >
            Regularizar Todos
          </button>
        </div>
      )}

      {/* 📱 PÍLULAS DE ETAPAS EXCLUSIVAS PARA O CELULAR */}
      <div className="mobile-etapas-bar">
        {etapasInfo.map(et => (
          <button
            key={et.key}
            type="button"
            className={`mobile-etapa-pill ${etapaMobileAtiva === et.key ? 'ativa' : ''}`}
            onClick={() => setEtapaMobileAtiva(et.key)}
            style={{
              borderTop: `1.5px solid ${etapaMobileAtiva === et.key ? et.cor : '#e2e8f0'}`,
              borderRight: `1.5px solid ${etapaMobileAtiva === et.key ? et.cor : '#e2e8f0'}`,
              borderBottom: `1.5px solid ${etapaMobileAtiva === et.key ? et.cor : '#e2e8f0'}`,
              borderLeft: `4px solid ${et.cor}`
            }}
          >
            <span className="mobile-etapa-nome">{et.nome.replace(/^\d+\.\s*/, '')}</span>
            <span 
              className="mobile-etapa-count"
              style={{ background: et.badgeBg, color: et.badgeColor }}
            >
              {et.count}
            </span>
          </button>
        ))}
      </div>

      {/* 📱 MODO CELULAR: LISTAGEM DIRETA DA ETAPA SELECIONADA */}
      <div className="mobile-only-col-view">
        <div className="mobile-col-header">
          <span className="dot" style={{ background: etapasInfo.find(e => e.key === etapaMobileAtiva)?.cor }}></span>
          <h3>{etapasInfo.find(e => e.key === etapaMobileAtiva)?.nome}</h3>
          <span className="badge-count">{colunas[etapaMobileAtiva]?.length || 0}</span>
        </div>

        <div className="mobile-col-body">
          {colunas[etapaMobileAtiva]?.length === 0 ? (
            <div className="coluna-vazia-aviso">
              <span>🍃 Nenhum pedido nesta etapa no momento.</span>
            </div>
          ) : (
            colunas[etapaMobileAtiva]?.map(loc => (
              <CartaoKanban 
                key={loc.id} 
                loc={loc} 
                navigate={navigate} 
                verificarSeEhEntrega={verificarSeEhEntrega}
                obterEnderecoCompleto={obterEnderecoCompleto}
                onAvancar={() => {
                  if (etapaMobileAtiva === 'confirmado') moverCard(loc.id, 'preparacao');
                  else if (etapaMobileAtiva === 'preparacao') moverCard(loc.id, 'entregue');
                  else if (etapaMobileAtiva === 'entregue') abrirCheckin(loc, 'VOLTA');
                }}
                onVoltar={() => moverCard(loc.id, 'entregue')}
                onForcarAvanco={(destino) => forcarAvancar(loc.id, destino)}
                onAbrirAssinatura={() => setModalAssinaturaLoc(loc)}
                onAbrirDesignar={() => setModalDesignarLoc(loc)}
                btnTxt={
                  etapaMobileAtiva === 'confirmado' ? 'Separar ➔' :
                  etapaMobileAtiva === 'preparacao' ? 'Enviar ➔' :
                  etapaMobileAtiva === 'entregue' ? 'Receber ➔' : 'Voltar'
                } 
                btnCor={etapasInfo.find(e => e.key === etapaMobileAtiva)?.cor || '#3b82f6'} 
                isFinal={etapaMobileAtiva === 'finalizado'}
                onAbrirChecklist={() => {
                  if (etapaMobileAtiva === 'preparacao') abrirCheckin(loc, 'IDA');
                  else if (etapaMobileAtiva === 'entregue' || etapaMobileAtiva === 'finalizado') abrirCheckin(loc, 'VOLTA');
                  else setChecklistModalId(loc.id);
                }} 
                onAbrirRelatorio={() => setRelatorioModalLoc(loc)} 
                onAbrirCheckinIda={() => abrirCheckin(loc, 'IDA')}
                onAbrirCheckinVolta={() => abrirCheckin(loc, 'VOLTA')}
                onAbrirGPS={() => abrirGPS(loc)}
                onAbrirWhatsApp={() => abrirWhatsApp(loc)}
                isModoLista={true} 
                parametros={parametros}
              />
            ))
          )}
        </div>
      </div>

      {/* 🖥️ MODO DESKTOP (KANBAN POLIDO DE 4 ETAPAS OPERACIONAIS) */}
      <div className={`kanban-board desktop-only-board ${vistaAtual === 'lista' ? 'board-lista' : 'board-colunas'}`}>
        
        {/* COLUNA 1: A SEPARAR / CONFIRMADOS */}
        <div className="kanban-col">
          <div className="col-header">
            <span className="dot" style={{background: '#3b82f6'}}></span>
            <h3>1. A Separar</h3>
            <span className="badge-count">{colunas.confirmado.length}</span>
          </div>
          <div className="col-body">
            {colunas.confirmado.length === 0 ? (
              <div className="coluna-vazia-placeholder">Nenhum pedido</div>
            ) : (
              colunas.confirmado.map(loc => (
                <CartaoKanban 
                  key={loc.id} loc={loc} navigate={navigate} 
                  verificarSeEhEntrega={verificarSeEhEntrega}
                  obterEnderecoCompleto={obterEnderecoCompleto}
                  onAvancar={() => moverCard(loc.id, 'preparacao')} 
                  onForcarAvanco={(destino) => forcarAvancar(loc.id, destino)}
                  onAbrirAssinatura={() => setModalAssinaturaLoc(loc)}
                  onAbrirDesignar={() => setModalDesignarLoc(loc)}
                  btnTxt="Separar ➔" btnCor="#3b82f6" 
                  onAbrirChecklist={() => setChecklistModalId(loc.id)} 
                  onAbrirRelatorio={() => setRelatorioModalLoc(loc)} 
                  onAbrirGPS={() => abrirGPS(loc)}
                  onAbrirWhatsApp={() => abrirWhatsApp(loc)}
                  isModoLista={vistaAtual === 'lista'} 
                  parametros={parametros}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 2: EM SEPARAÇÃO */}
        <div className="kanban-col">
          <div className="col-header">
            <span className="dot" style={{background: '#f59e0b'}}></span>
            <h3>2. Em Separação</h3>
            <span className="badge-count">{colunas.preparacao.length}</span>
          </div>
          <div className="col-body">
            {colunas.preparacao.length === 0 ? (
              <div className="coluna-vazia-placeholder">Nenhum pedido</div>
            ) : (
              colunas.preparacao.map(loc => (
                <CartaoKanban 
                  key={loc.id} loc={loc} navigate={navigate} 
                  verificarSeEhEntrega={verificarSeEhEntrega}
                  obterEnderecoCompleto={obterEnderecoCompleto}
                  onAvancar={() => moverCard(loc.id, 'entregue')} 
                  onForcarAvanco={(destino) => forcarAvancar(loc.id, destino)}
                  onAbrirAssinatura={() => setModalAssinaturaLoc(loc)}
                  onAbrirDesignar={() => setModalDesignarLoc(loc)}
                  btnTxt="Enviar ➔" btnCor="#f59e0b" 
                  onAbrirChecklist={() => abrirCheckin(loc, 'IDA')} 
                  onAbrirRelatorio={() => setRelatorioModalLoc(loc)} 
                  onAbrirCheckinIda={() => abrirCheckin(loc, 'IDA')}
                  onAbrirCheckinVolta={() => abrirCheckin(loc, 'VOLTA')}
                  onAbrirGPS={() => abrirGPS(loc)}
                  onAbrirWhatsApp={() => abrirWhatsApp(loc)}
                  isModoLista={vistaAtual === 'lista'} 
                  parametros={parametros}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 3: NA RUA / EVENTO */}
        <div className="kanban-col">
          <div className="col-header">
            <span className="dot" style={{background: '#8b5cf6'}}></span>
            <h3>3. Na Rua / Evento</h3>
            <span className="badge-count">{colunas.entregue.length}</span>
          </div>
          <div className="col-body">
            {colunas.entregue.length === 0 ? (
              <div className="coluna-vazia-placeholder">Nenhum pedido</div>
            ) : (
              colunas.entregue.map(loc => (
                <CartaoKanban 
                  key={loc.id} loc={loc} navigate={navigate} 
                  verificarSeEhEntrega={verificarSeEhEntrega}
                  obterEnderecoCompleto={obterEnderecoCompleto}
                  onAvancar={() => abrirCheckin(loc, 'VOLTA')} 
                  onForcarAvanco={(destino) => forcarAvancar(loc.id, destino)}
                  onAbrirAssinatura={() => setModalAssinaturaLoc(loc)}
                  onAbrirDesignar={() => setModalDesignarLoc(loc)}
                  btnTxt="Receber ➔" btnCor="#8b5cf6" 
                  onAbrirChecklist={() => abrirCheckin(loc, 'VOLTA')} 
                  onAbrirRelatorio={() => setRelatorioModalLoc(loc)} 
                  onAbrirCheckinIda={() => abrirCheckin(loc, 'IDA')}
                  onAbrirCheckinVolta={() => abrirCheckin(loc, 'VOLTA')}
                  onAbrirGPS={() => abrirGPS(loc)}
                  onAbrirWhatsApp={() => abrirWhatsApp(loc)}
                  isModoLista={vistaAtual === 'lista'} 
                  parametros={parametros}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 4: DEVOLVIDOS */}
        <div className="kanban-col">
          <div className="col-header">
            <span className="dot" style={{background: '#10b981'}}></span>
            <h3>4. Devolvidos</h3>
            <span className="badge-count">{colunas.finalizado.length}</span>
          </div>
          <div className="col-body">
            {colunas.finalizado.length === 0 ? (
              <div className="coluna-vazia-placeholder">Nenhum pedido</div>
            ) : (
              colunas.finalizado.slice(0, 20).map(loc => (
                <CartaoKanban 
                  key={loc.id} loc={loc} navigate={navigate} isFinal={true} 
                  verificarSeEhEntrega={verificarSeEhEntrega}
                  obterEnderecoCompleto={obterEnderecoCompleto}
                  onVoltar={() => moverCard(loc.id, 'entregue')} 
                  onForcarAvanco={(destino) => forcarAvancar(loc.id, destino)}
                  onAbrirAssinatura={() => setModalAssinaturaLoc(loc)}
                  onAbrirDesignar={() => setModalDesignarLoc(loc)}
                  onAbrirChecklist={() => abrirCheckin(loc, 'VOLTA')} 
                  onAbrirRelatorio={() => setRelatorioModalLoc(loc)} 
                  onAbrirCheckinIda={() => abrirCheckin(loc, 'IDA')}
                  onAbrirCheckinVolta={() => abrirCheckin(loc, 'VOLTA')}
                  onAbrirGPS={() => abrirGPS(loc)}
                  onAbrirWhatsApp={() => abrirWhatsApp(loc)}
                  isModoLista={vistaAtual === 'lista'} 
                  parametros={parametros}
                />
              ))
            )}
            {colunas.finalizado.length > 20 && <p className="limite-aviso">+ {colunas.finalizado.length - 20} arquivados...</p>}
          </div>
        </div>

      </div>

      {/* 🛫🛬 MODAL CHECK-IN DE IDA E VOLTA */}
      <ModalCheckinLocacao 
        isOpen={modalCheckinAberta}
        onClose={() => setModalCheckinAberta(false)}
        locacao={locacaoCheckin}
        modo={modoCheckin}
        tenantId={tenantId}
        usuarioLogado={usuarioLogado}
        onSalvarSucesso={carregarDados}
      />

      {locacaoModalAtiva && (
        <ModalChecklist 
          loc={locacaoModalAtiva} 
          onClose={() => setChecklistModalId(null)} 
          onToggleChecklist={toggleItemChecklist} 
          onRegistrarRetorno={registrarRetornoItem} 
        />
      )}

      {relatorioModalLoc && (
        <ModalRelatorioAvarias 
          loc={relatorioModalLoc} 
          parametros={parametros} 
          textoBase={textoRelatorio} 
          onClose={() => setRelatorioModalLoc(null)} 
          tenantId={tenantId}
          registrarLog={registrarLog}
        />
      )}

      {/* ✍️ MODAL ASSINATURA DIGITAL NO CELULAR */}
      {modalAssinaturaLoc && (
        <ModalAssinaturaEntrega 
          loc={modalAssinaturaLoc}
          isOpen={!!modalAssinaturaLoc}
          onClose={() => setModalAssinaturaLoc(null)}
          onSalvarAssinatura={salvarAssinaturaEntrega}
        />
      )}

      {/* 🚗 MODAL DESIGNAR MOTORISTA, VEÍCULO & EMBALAGENS */}
      {modalDesignarLoc && (
        <ModalDesignarMotorista 
          loc={modalDesignarLoc}
          isOpen={!!modalDesignarLoc}
          onClose={() => setModalDesignarLoc(null)}
          onSalvar={salvarDesignacaoMotorista}
          listaMotoristasExistentes={listaMotoristas}
        />
      )}

    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 COMPONENTE CARTÃO KANBAN DE ALTA PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════
const CartaoKanban = ({ 
  loc, 
  navigate, 
  onAvancar, 
  onVoltar, 
  onForcarAvanco,
  onAbrirAssinatura,
  onAbrirDesignar,
  btnTxt, 
  btnCor, 
  isFinal, 
  onAbrirChecklist, 
  onAbrirRelatorio, 
  onAbrirGPS,
  onAbrirWhatsApp,
  isModoLista, 
  parametros,
  verificarSeEhEntrega,
  obterEnderecoCompleto
}) => {
  const [expandido, setExpandido] = useState(false);
  const isEntrega = verificarSeEhEntrega ? verificarSeEhEntrega(loc) : (loc.logistica?.tipo === 'entrega');
  const dataBr = loc.dataRetirada ? loc.dataRetirada.split('-').reverse().join('/') : '--/--/----';
  const dataDevBr = loc.dataDevolucao ? loc.dataDevolucao.split('-').reverse().join('/') : '';
  
  const hojeStr = new Date().toISOString().split('T')[0];
  const eventoJaPassou = loc.dataRetirada && loc.dataRetirada < hojeStr;

  const getAlertaUrgencia = () => {
    if (!loc.dataRetirada || isFinal || loc.status === 'orcamento') return null;
    
    const hojeDate = new Date(); 
    hojeDate.setHours(0,0,0,0);
    
    const locDate = new Date(loc.dataRetirada + 'T00:00:00'); 
    const diffTime = locDate.getTime() - hojeDate.getTime();
    const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDias < 0 && loc.status !== 'entregue') return <div className="alerta-urgente atrasado">🔥 ATRASADO!</div>;
    
    if (diffDias <= 0 && loc.status === 'entregue' && loc.dataDevolucao) {
       const devolucaoDate = new Date(loc.dataDevolucao + 'T00:00:00');
       const diffDev = Math.ceil((devolucaoDate.getTime() - hojeDate.getTime()) / (1000 * 60 * 60 * 24));
       if (diffDev < 0) return <div className="alerta-urgente devolver">🚨 DEVOLUÇÃO ATRASADA</div>;
       if (diffDev === 0) return <div className="alerta-urgente devolver">⚠️ BUSCAR HOJE!</div>;
    }
    
    if (diffDias === 0 && loc.status !== 'entregue') return <div className="alerta-urgente hoje">🚨 ENTREGAR HOJE!</div>;
    if (diffDias === 1 && loc.status !== 'entregue') return <div className="alerta-urgente amanha">⚠️ FESTA É AMANHÃ!</div>;
    
    return null;
  };

  const isFaseSeparacao = loc.status === 'preparacao' || loc.status === 'a_separar' || loc.status === 'confirmado' || loc.status === 'aprovado';
  const isFaseTransito = loc.status === 'em_transito' || loc.status === 'entregue';
  const isFaseDevolucao = loc.status === 'finalizado' || loc.status === 'devolvido'; 
  const hasItens = loc.itens && loc.itens.length > 0;
  
  let totalItens = hasItens ? loc.itens.length : 0;
  let itensCheckados = 0;
  let checklistBloqueiaBotao = false;
  let temAvaria = false;
  let temFalta = false;

  if (hasItens) {
    temAvaria = loc.itens.some(i => i.avaria === true);
    temFalta = loc.itens.some(i => i.faltou === true);
    
    if (loc.status === 'preparacao') {
      itensCheckados = loc.itens.filter(i => i.checkedSeparacao).length;
      checklistBloqueiaBotao = itensCheckados < totalItens;
    } else if (isFaseDevolucao) {
      itensCheckados = loc.itens.filter(i => i.checkedDevolucao).length;
    }
  }

  const pctProgresso = totalItens > 0 ? Math.round((itensCheckados / totalItens) * 100) : 0;

  const handleAvancarClick = () => {
    if (checklistBloqueiaBotao) {
      if (eventoJaPassou) {
        const conf = window.confirm(`⚡ EVENTO COM DATA PASSADA (${dataBr}):\nAs peças ainda não foram marcadas no checklist, mas a festa já ocorreu.\n\nDeseja destravar e avançar para "${btnTxt}" mesmo assim?`);
        if (conf) {
          onAvancar();
          return;
        }
      }
      onAbrirChecklist();
      alert(`⚠️ Você precisa conferir todas as peças no checklist antes de enviar.`);
    } else {
      onAvancar();
    }
  };

  let btnChecklistTxt = 'Ver Peças';
  if (loc.status === 'preparacao') btnChecklistTxt = `Separar (${itensCheckados}/${totalItens})`;
  if (isFaseDevolucao || loc.status === 'entregue') btnChecklistTxt = `Conferir (${itensCheckados}/${totalItens})`;

  const motoristaDesignado = loc.logistica?.motoristaNome;
  const veiculoDesignado = loc.logistica?.veiculo;
  const caixasQtd = loc.embalagens?.caixas || loc.embalagens?.caixasPlasticas || 0;
  const sacolasQtd = loc.embalagens?.sacolas || loc.embalagens?.sacolasTecido || 0;
  const temAssinatura = !!loc.logistica?.assinaturaEntrega;
  const enderecoFormatado = obterEnderecoCompleto ? obterEnderecoCompleto(loc) : (loc.logistica?.endereco || loc.endereco || '');

  return (
    <div className={`k-card ${temAvaria ? 'card-com-avaria' : ''} ${temFalta ? 'card-com-falta' : ''} ${isModoLista ? 'card-modo-lista' : ''}`}>
      {getAlertaUrgencia()}
      {temFalta && <div className="alerta-urgente falta-badge">❌ FALTAM PEÇAS</div>}
      {temAvaria && !temFalta && <div className="alerta-urgente avaria-badge">⚠️ AVARIAS</div>}

      {/* CABEÇALHO DO CARD */}
      <div className="k-card-header">
        <div className="k-card-cliente">
          <strong>{loc.clienteNome || 'Cliente'}</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
            <span className="k-card-pedido">{loc.numeroPedido ? `#${loc.numeroPedido}` : ''}</span>
            {loc.tema && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>• {loc.tema}</span>}
          </div>
        </div>
        <span className={`k-tag ${isEntrega ? 'tag-entrega' : 'tag-loja'}`}>
          {isEntrega ? '🚚 Entrega' : '🏬 Loja'}
        </span>
      </div>

      {/* BADGES DE MOTORISTA, EMBALAGENS E ASSINATURA */}
      {(motoristaDesignado || caixasQtd > 0 || sacolasQtd > 0 || temAssinatura) && (
        <div className="k-card-badges-row">
          {motoristaDesignado && (
            <span className="badge-micro badge-micro-motorista" title={`Motorista: ${motoristaDesignado}`}>
              🚗 {motoristaDesignado} {veiculoDesignado ? `(${veiculoDesignado})` : ''}
            </span>
          )}
          {(caixasQtd > 0 || sacolasQtd > 0) && (
            <span className="badge-micro badge-micro-embalagens" title="Embalagens de transporte">
              📦 {caixasQtd > 0 ? `${caixasQtd}cx ` : ''}{sacolasQtd > 0 ? `${sacolasQtd}sc` : ''}
            </span>
          )}
          {temAssinatura && (
            <span className="badge-micro badge-micro-assinado" title={`Assinado por ${loc.logistica.recebidoPor} em ${loc.logistica.dataHoraAssinatura || ''}`}>
              ✍️ Assinado
            </span>
          )}
        </div>
      )}

      {/* BARRA DE PROGRESSO VISUAL DE CONFERÊNCIA */}
      {hasItens && (isFaseSeparacao || isFaseDevolucao) && (
        <div style={{ margin: '2px 0', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', height: '5px', position: 'relative' }}>
          <div 
            style={{ 
              width: `${pctProgresso}%`, 
              height: '100%', 
              background: pctProgresso === 100 ? '#10b981' : '#f59e0b',
              transition: 'width 0.3s ease'
            }} 
          />
        </div>
      )}

      {/* DATA ESSENCIAL */}
      <div className="k-card-info-compact">
        <div className="info-linha">
          <span>📅 Data:</span> 
          <strong>{dataBr} {loc.horarioRetirada ? `às ${loc.horarioRetirada}` : ''}</strong>
        </div>
      </div>

      {/* AÇÕES PRINCIPAIS RÁPIDAS (SEPARAR / AVANÇAR + CHECKLIST) */}
      <div className="k-card-actions-main">
        <button 
          type="button"
          className={`k-btn-itens-toggle ${(isFaseSeparacao || (isFaseDevolucao && itensCheckados < totalItens)) ? 'pulse-btn' : ''}`} 
          onClick={onAbrirChecklist}
        >
          📝 {btnChecklistTxt}
        </button>

        {!isFinal ? (
          <button 
            type="button"
            className={`k-btn-move ${checklistBloqueiaBotao ? 'btn-bloqueado' : ''}`} 
            style={{ backgroundColor: checklistBloqueiaBotao ? '#cbd5e1' : btnCor, color: checklistBloqueiaBotao ? '#64748b' : 'white' }} 
            onClick={handleAvancarClick}
          >
            {checklistBloqueiaBotao ? `🔒 Trava` : btnTxt}
          </button>
        ) : (
          <button type="button" className="k-btn-view" onClick={onVoltar} style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
            ⏪ Voltar
          </button>
        )}
      </div>

      {/* 🔽 BOTÃO SANFONA "VER MAIS / RECOLHER" */}
      <button 
        type="button" 
        className="k-btn-expandir-toggle"
        onClick={() => setExpandido(prev => !prev)}
        title={expandido ? "Ocultar detalhes adicionais" : "Expandir endereço, GPS, WhatsApp e etiquetas"}
      >
        <span>{expandido ? '▲ Menos Informações' : '▼ Ver Mais'}</span>
      </button>

      {/* 📦 DETALHES EXPANDIDOS (QUANDO O USUÁRIO CLICA EM VER MAIS) */}
      {expandido && (
        <div className="k-card-detalhes-expandidos fade-in">
          <div className="k-card-info">
            {dataDevBr && (
              <div className="info-linha">
                <span>🔄 Devolução:</span> 
                <strong>{dataDevBr} {loc.horarioDevolucao ? `às ${loc.horarioDevolucao}` : ''}</strong>
              </div>
            )}
            <div className="info-linha">
              <span>📍 Local:</span> 
              <strong style={{ fontSize: '0.74rem', color: '#0f172a' }}>
                {isEntrega ? (enderecoFormatado || 'Endereço cadastrado') : 'Retirada na Loja'}
              </strong>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════
              BOTÕES CONTEXTUAIS CONFORME A ETAPA DA LOGÍSTICA
             ═════════════════════════════════════════════════════════ */}
          {isFaseDevolucao ? (
            /* ═══ ABA 5. DEVOLVIDOS (GALPÃO / PÓS-EVENTO) ═══ */
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button 
                type="button" 
                onClick={onAbrirWhatsApp}
                className="k-btn-view"
                style={{ flex: 1, padding: '7px 6px', fontSize: '0.74rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                title="Chamar cliente no WhatsApp"
              >
                💬 WhatsApp
              </button>

              <button 
                type="button"
                className="k-btn-view" 
                onClick={() => navigate(`/locacoes/editar/${loc.id}`)}
                style={{ flex: 1, padding: '7px 6px', fontSize: '0.74rem', fontWeight: '750' }}
              >
                🔍 Detalhes
              </button>

              {(loc.dataCheckinRetorno || loc.obsRetorno || loc.assinaturaRetornoUrl) && (
                <button 
                  type="button"
                  className="k-btn-view" 
                  onClick={() => gerarComprovanteCheckinPDF(
                    loc, 
                    loc.itens || [], 
                    'VOLTA', 
                    { 
                      responsavel: loc.responsavelRetorno || 'Equipe Galpão',
                      observacoes: loc.obsRetorno || '',
                      assinaturaUrl: loc.assinaturaRetornoUrl || null
                    }, 
                    parametros
                  )}
                  style={{ flex: 1.2, padding: '7px 6px', backgroundColor: '#f8fafc', color: '#334155', borderColor: '#cbd5e1', fontWeight: '800', fontSize: '0.74rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  title="Visualizar Comprovante de Vistoria de Devolução em PDF"
                >
                  📄 Vistoria PDF
                </button>
              )}
            </div>
          ) : isFaseTransito ? (
            /* ═══ ABA 4. NA RUA / EM TRÂNSITO / ENTREGUE (CAMPO) ═══ */
            <>
              <div className="k-card-quick-actions">
                {isEntrega && (
                  <button 
                    type="button" 
                    onClick={onAbrirGPS}
                    className="k-quick-btn gps-btn"
                    title="Abrir rota no Google Maps / Waze"
                  >
                    📍 Rota GPS
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={onAbrirWhatsApp}
                  className="k-quick-btn wpp-btn"
                  title="Chamar cliente no WhatsApp"
                >
                  💬 WhatsApp
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                <button 
                  type="button"
                  className="k-btn-view"
                  onClick={onAbrirDesignar}
                  style={{ backgroundColor: motoristaDesignado ? '#eff6ff' : '#ffffff', color: motoristaDesignado ? '#1d4ed8' : '#334155', borderColor: motoristaDesignado ? '#bfdbfe' : '#cbd5e1', fontWeight: '800', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  title="Definir motorista, veículo e contagem de caixas"
                >
                  🚚 {motoristaDesignado ? `Transporte (${motoristaDesignado})` : 'Transporte & Carga'}
                </button>

                <button 
                  type="button"
                  className="k-btn-view"
                  onClick={onAbrirAssinatura}
                  style={{ backgroundColor: temAssinatura ? '#f0fdf4' : '#ffffff', color: temAssinatura ? '#15803d' : '#334155', borderColor: temAssinatura ? '#86efac' : '#cbd5e1', fontWeight: '800', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  title="Coletar ou visualizar assinatura do cliente no celular"
                >
                  ✍️ {temAssinatura ? 'Ver Assinatura' : 'Assinar Entrega'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button 
                  type="button"
                  className="k-btn-view" 
                  onClick={() => navigate(`/locacoes/editar/${loc.id}`)}
                  style={{ width: '100%', padding: '6px', fontSize: '0.72rem' }}
                >
                  🔍 Detalhes do Pedido
                </button>
              </div>
            </>
          ) : (
            /* ═══ ABAS 1, 2, 3 (A FAZER, A SEPARAR, EM SEPARAÇÃO / EXPEDIÇÃO) ═══ */
            <>
              <div className="k-card-quick-actions">
                <button 
                  type="button" 
                  onClick={onAbrirWhatsApp}
                  className="k-quick-btn wpp-btn"
                  title="Chamar cliente no WhatsApp"
                >
                  💬 WhatsApp
                </button>

                <button 
                  type="button"
                  className="k-quick-btn"
                  onClick={onAbrirDesignar}
                  style={{ backgroundColor: motoristaDesignado ? '#eff6ff' : '#ffffff', color: motoristaDesignado ? '#1d4ed8' : '#334155', borderColor: motoristaDesignado ? '#bfdbfe' : '#cbd5e1', fontWeight: '800', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  title="Definir motorista, veículo e contagem de caixas"
                >
                  🚚 {motoristaDesignado ? `Transporte (${motoristaDesignado})` : 'Transporte & Carga'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button 
                  type="button"
                  className="k-btn-view" 
                  onClick={() => navigate(`/locacoes/editar/${loc.id}`)}
                  style={{ flex: 1, padding: '6px', fontSize: '0.72rem' }}
                >
                  🔍 Detalhes
                </button>

                <button 
                  type="button"
                  className="k-btn-view" 
                  onClick={() => gerarEtiquetasCaixotePDF(loc, parametros)} 
                  style={{ flex: 1.2, padding: '6px', backgroundColor: '#fefce8', color: '#b45309', borderColor: '#fde68a', fontWeight: 'bold', fontSize: '0.72rem' }}
                  title="Gerar etiquetas de caixote em PDF para colar antes da saída"
                >
                  🏷️ Etiqueta PDF
                </button>
              </div>
            </>
          )}

          {/* ⚡ BOTÃO DE DESTRAVAMENTO RÁPIDO PARA EVENTOS PASSADOS */}
          {eventoJaPassou && !isFinal && onForcarAvanco && (
            <button 
              type="button"
              className="k-btn-view" 
              onClick={() => onForcarAvanco('finalizado')} 
              style={{ width: '100%', marginTop: '6px', backgroundColor: '#fefce8', color: '#b45309', borderColor: '#fde68a', fontWeight: '850', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              title="Mover este pedido diretamente para Devolvidos para regularizar o estoque"
            >
              ⚡ Destravar e Mover para Devolvidos
            </button>
          )}

          {(temAvaria || temFalta) && (
            <button 
              type="button"
              className="k-btn-view" 
              onClick={onAbrirRelatorio} 
              style={{ width: '100%', marginTop: '6px', backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', fontWeight: 'bold', fontSize: '0.72rem' }}
            >
              📄 Gerar Laudo de Avarias (PDF)
            </button>
          )}
        </div>
      )}

    </div>
  );
};

// ==========================================
// SUB-COMPONENTE: MODAL RELATÓRIO AVARIAS
// ==========================================
const ModalRelatorioAvarias = ({ loc, parametros, textoBase, onClose, tenantId, registrarLog }) => {
  const [itensProblema, setItensProblema] = useState([]);
  const [carregandoValores, setCarregandoValores] = useState(true);

  useEffect(() => {
    const buscarValoresNoEstoque = async () => {
      try {
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const estoqueSnap = await getDocs(qEstoque);
        const estoqueData = estoqueSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const itensBase = loc.itens.filter(i => i.avaria || i.faltou);

        const itensComValorNovo = itensBase.map((item) => {
          let precoEncontrado = 0;
          const nomePecaLimpo = (item.nome || '').trim().toUpperCase();
          let pecaNoEstoque = estoqueData.find(e => e.id === item.id || e.id === item.produtoId || e.id === item.pecaId);

          if (!pecaNoEstoque) {
            pecaNoEstoque = estoqueData.find(e => {
              const nomeEstoqueLimpo = (e.nome || e.titulo || '').trim().toUpperCase();
              return nomeEstoqueLimpo === nomePecaLimpo;
            });
          }

          if (pecaNoEstoque) {
            const valorBruto = pecaNoEstoque.financeiro?.valorReposicao || pecaNoEstoque.valorReposicao || 0;
            let valorString = String(valorBruto).replace(/[R$\s]/g, '');
            if (valorString.includes('.') && valorString.includes(',')) valorString = valorString.replace(/\./g, '');
            valorString = valorString.replace(',', '.');
            precoEncontrado = parseFloat(valorString);
          }

          const valorFinalValido = (!precoEncontrado || isNaN(precoEncontrado)) ? 0 : precoEncontrado;
          return {
            ...item,
            valorBaseEstoque: valorFinalValido, 
            valorCobrado: valorFinalValido > 0 ? valorFinalValido.toFixed(2) : '' 
          };
        });

        setItensProblema(itensComValorNovo);
        setCarregandoValores(false);
      } catch (erro) {
        console.error("Erro na busca inteligente de estoque:", erro);
        setCarregandoValores(false);
      }
    };
    buscarValoresNoEstoque();
  }, [loc, tenantId]);

  const handleValorChange = (index, value) => {
    const novosItens = [...itensProblema];
    novosItens[index].valorCobrado = value;
    setItensProblema(novosItens);
  };

  const totalCobrar = itensProblema.reduce((acc, item) => acc + (parseFloat(item.valorCobrado || 0) * (Number(item.quantidade) || Number(item.qtd) || 1)), 0);
  const formatarMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const gerarTermoPDF = () => {
    const nomeEmpresa = parametros?.nomeFantasia || parametros?.razaoSocial || parametros?.nome || 'Celebre Festas';
    const logoEmpresa = parametros?.logotipo || parametros?.logo || parametros?.logoUrl || null;
    const telefoneEmpresa = parametros?.telefone || parametros?.whatsapp || '';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Termo de Ocorrência - ${loc.clienteNome}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
            .empresa-info { text-align: left; }
            .empresa-info img { max-height: 80px; object-fit: contain; margin-bottom: 8px; display: block; }
            .empresa-info h2 { margin: 0; font-size: 20px; color: #0f172a; font-weight: 900; text-transform: uppercase;}
            .empresa-info p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: bold; }
            .doc-titulo { text-align: right; }
            .doc-titulo h1 { margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;}
            .doc-titulo p { margin: 5px 0 0; color: #dc2626; font-size: 13px; font-weight: bold;}
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px; line-height: 1.8; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .table th, .table td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 14px; }
            .table th { background: #e2e8f0; color: #0f172a; font-weight: bold; }
            .valor-td { text-align: right !important; }
            .total-box { text-align: right; font-size: 18px; font-weight: bold; color: #0f172a; padding: 15px; background: #f1f5f9; border: 1px solid #cbd5e1; border-top: none; margin-bottom: 30px; border-radius: 0 0 8px 8px;}
            .total-box span { color: #dc2626; font-size: 22px; margin-left: 10px;}
            .assinaturas { margin-top: 80px; display: flex; justify-content: space-between; gap: 40px; }
            .assinaturas div { border-top: 1px solid #0f172a; flex: 1; text-align: center; padding-top: 10px; font-weight: bold; color: #0f172a;}
            .aviso-legal { font-size: 14px; color: #475569; line-height: 1.6; text-align: justify; margin-bottom: 50px; white-space: pre-wrap;}
          </style>
        </head>
        <body>
          <div class="header">
            <div class="empresa-info">
              ${logoEmpresa ? `<img src="${logoEmpresa}" alt="Logo Empresa" />` : ''}
              <h2>${nomeEmpresa}</h2>
              <p>Locação de Peças e Mobiliário ${telefoneEmpresa ? `| ${telefoneEmpresa}` : ''}</p>
            </div>
            <div class="doc-titulo">
              <h1>TERMO DE OCORRÊNCIA</h1>
              <p>Relatório de Avaria e/ou Extravio</p>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr><th width="8%">Qtd</th><th width="35%">Produto</th><th width="27%">Ocorrência</th><th width="15%" class="valor-td">Valor Unit.</th><th width="15%" class="valor-td">Subtotal</th></tr>
            </thead>
            <tbody>
              ${itensProblema.map(i => `
                <tr>
                  <td>${i.quantidade || i.qtd || 1}x</td>
                  <td>${i.nome}</td>
                  <td>${i.avaria ? '⚠️ AVARIA' : '❌ EXTRAVIO'}</td>
                  <td class="valor-td">${formatarMoeda(i.valorCobrado)}</td>
                  <td class="valor-td" style="font-weight: bold;">${formatarMoeda(parseFloat(i.valorCobrado || 0) * (Number(i.quantidade) || Number(i.qtd) || 1))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total-box"> VALOR TOTAL A PAGAR: <span>${formatarMoeda(totalCobrar)}</span> </div>
          <div class="aviso-legal">${textoBase || 'Declaramos que os itens listados acima apresentaram avarias.\nNossa equipe entrará em contato.'}</div>
          <div class="assinaturas"><div>Equipe de Logística</div><div>Ciente: ${loc.clienteNome}</div></div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 800);
    
    registrarLog("RELATÓRIO GERADO", `Gerou PDF de Ocorrências (Total: ${formatarMoeda(totalCobrar)}) para o cliente ${loc.clienteNome}.`, loc.id, loc.numeroPedido);
    onClose(); 
  };

  return (
    <div className="modal-overlay-v3" onClick={onClose}>
      <div className="modal-content-v3" style={{maxWidth: '750px', width: '95vw', padding: '0'}} onClick={e => e.stopPropagation()}>
        <div style={{padding: '20px 25px', borderBottom: '1px solid #e2e8f0', background: '#fef2f2', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2 style={{margin: 0, color: '#dc2626'}}>🚨 Laudo de Ocorrências</h2>
          <button onClick={onClose} style={{background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#dc2626'}}>✖</button>
        </div>
 
        <div style={{padding: '20px 25px', maxHeight: '50vh', overflowY: 'auto'}}>
          {carregandoValores ? ( <div style={{textAlign: 'center', padding: '30px'}}> 🔄 Buscando valores no estoque... </div> ) : (
            itensProblema.map((it, idx) => (
              <div key={idx} className="config-valor-row">
                <div className="config-item-info">
                   <strong>{it.quantidade || it.qtd || 1}x {it.nome}</strong>
                   <span style={{fontSize: '0.8rem', color: '#64748b'}}> Base estoque: <strong style={{color: '#d97706'}}>{formatarMoeda(it.valorBaseEstoque)}</strong></span>
                </div>
                <div className="config-item-input">
                   <label>Cobrar (R$):</label>
                   <input type="number" step="0.01" value={it.valorCobrado} onChange={(e) => handleValorChange(idx, e.target.value)} />
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{padding: '20px 25px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
           <div style={{fontWeight: 'bold'}}> Total: <span style={{color: '#dc2626', fontSize: '1.4rem'}}>{formatarMoeda(totalCobrar)}</span> </div>
           <button onClick={gerarTermoPDF} disabled={carregandoValores} style={{background: '#dc2626', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}> 🖨️ Imprimir Laudo </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENTE: MODAL CHECKLIST
// ==========================================
const ModalChecklist = ({ loc, onClose, onToggleChecklist, onRegistrarRetorno }) => {
  const isFaseSeparacao = loc.status === 'preparacao';
  const isFaseDevolucao = loc.status === 'finalizado'; 
  
  return (
    <div className="modal-overlay-v3" onClick={onClose}>
      <div className="modal-content-v3 modal-checklist-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header-v3">
          <div>
            <h3 style={{marginBottom: '5px'}}>📝 Checklist de Conferência</h3>
            <p style={{fontSize: '0.85rem', color: '#64748b', margin: 0}}>{loc.clienteNome} • {loc.status.toUpperCase()}</p>
          </div>
          <button onClick={onClose} style={{fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'}}>✖</button>
        </div>
        
        <div className="modal-checklist-body">
          {loc.itens && loc.itens.length > 0 ? (
            loc.itens.map((it, idx) => {
              const qtdItem = it.quantidade || it.qtd || 1;
              if (isFaseSeparacao) {
                return (
                  <div key={idx} className={`checklist-row ${it.checkedSeparacao ? 'checked' : ''}`} onClick={() => onToggleChecklist(loc.id, idx, 'checkedSeparacao')}>
                    <input type="checkbox" checked={!!it.checkedSeparacao} readOnly className="chk-large" />
                    {it.foto ? <img src={it.foto} alt="" className="chk-foto" /> : <div className="chk-foto vazio">📷</div>}
                    <span className="chk-nome"><strong>{qtdItem}x</strong> {it.nome}</span>
                  </div>
                )
              }
              if (isFaseDevolucao) {
                return (
                  <div key={idx} className={`checklist-row dev-row ${it.avaria ? 'avaria' : ''} ${it.faltou ? 'faltou' : ''} ${it.checkedDevolucao && !it.avaria && !it.faltou ? 'checked' : ''}`}>
                    {it.foto ? <img src={it.foto} alt="" className="chk-foto" /> : <div className="chk-foto vazio">📷</div>}
                    <span className="chk-nome"><strong>{qtdItem}x</strong> {it.nome}</span>
                    
                    <div className="chk-botoes-volta">
                       <button 
                         className={`btn-volta ok ${it.checkedDevolucao && !it.avaria && !it.faltou ? 'ativo' : ''}`} 
                         onClick={(e) => { e.stopPropagation(); onRegistrarRetorno(loc.id, idx, (it.checkedDevolucao && !it.avaria && !it.faltou) ? 'desmarcar' : 'ok'); }}
                       >
                         ✔️ OK
                       </button>
                       <button 
                         className={`btn-volta bad ${it.avaria ? 'ativo' : ''}`} 
                         onClick={(e) => { e.stopPropagation(); onRegistrarRetorno(loc.id, idx, it.avaria ? 'desmarcar' : 'avaria'); }}
                       >
                         ⚠️ AVARIA
                       </button>
                       <button 
                         className={`btn-volta lost ${it.faltou ? 'ativo' : ''}`} 
                         onClick={(e) => { e.stopPropagation(); onRegistrarRetorno(loc.id, idx, it.faltou ? 'desmarcar' : 'faltou'); }}
                       >
                         ❌ SUMIU
                       </button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={idx} className="checklist-row">
                  {it.foto ? <img src={it.foto} alt="" className="chk-foto" /> : <div className="chk-foto vazio">📷</div>}
                  <span className="chk-nome"><strong>{qtdItem}x</strong> {it.nome}</span>
                </div>
              )
            })
          ) : (<p style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhuma peça neste pedido.</p>)}
        </div>
        
        <div style={{padding: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end'}}>
           <button onClick={onClose} style={{background: '#0f172a', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>Concluído</button>
        </div>
      </div>
    </div>
  );
};

export default Logistica;