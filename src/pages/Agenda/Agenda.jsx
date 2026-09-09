import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Agenda.css';

const TIPOS = {
  entrega:   { label: 'Entrega',   cor: '#3b82f6', dot: 'blue'   },
  devolucao: { label: 'Devolução', cor: '#f97316', dot: 'orange' },
  reuniao:   { label: 'Reunião',   cor: '#8b5cf6', dot: 'purple' },
  visita:    { label: 'Visita Técnica', cor: '#22c55e', dot: 'green'  },
  pagamento: { label: 'Cobrança/Pgto', cor: '#eab308', dot: 'yellow' },
  tarefa:    { label: 'Tarefa Interna', cor: '#64748b', dot: 'gray'   },
  bloqueio:  { label: 'Bloqueio de Data', cor: '#ef4444', dot: 'red'  },
};

const FORM_VAZIO = {
  id: null, titulo: '', clienteId: '', clienteNome: '', tipo: 'reuniao',
  dataISO: '', horario: '', local: '', observacoes: '', recorrencia: 'nenhuma', 
  status: 'pendente', origem: 'manual',
};

const LISTA_FILTROS_AGENDA = [
  { id: 'todos', label: 'Todos', icon: 'fas fa-layer-group', desc: 'Todos os compromissos e eventos' },
  { id: 'entrega', label: 'Entregas', icon: 'fas fa-truck', desc: 'Saídas de locação e fretes programados' },
  { id: 'devolucao', label: 'Devoluções', icon: 'fas fa-undo-alt', desc: 'Retornos de materiais e devoluções' },
  { id: 'reuniao', label: 'Reuniões', icon: 'fas fa-handshake', desc: 'Alinhamentos e reuniões com clientes' },
  { id: 'visita', label: 'Visitas', icon: 'fas fa-map-marker-alt', desc: 'Visitas técnicas e inspeções no local' },
  { id: 'pagamento', label: 'Cobranças', icon: 'fas fa-dollar-sign', desc: 'Lembretes financeiros e cobranças' },
  { id: 'tarefa', label: 'Tarefas', icon: 'fas fa-clipboard-check', desc: 'Tarefas internas e lembretes da equipe' },
  { id: 'bloqueio', label: 'Bloqueios', icon: 'fas fa-lock', desc: 'Datas bloqueadas e indisponibilidades' },
];

const isoParaDMA = (iso) => {
  if (!iso || typeof iso !== 'string') return null;
  const dataPura = iso.split('T')[0].trim();
  let ano, mes, dia;
  if (dataPura.includes('/')) {
    const partes = dataPura.split('/');
    if (partes.length === 3) {
      dia = Number(partes[0]);
      mes = Number(partes[1]);
      ano = Number(partes[2]);
    }
  } else if (dataPura.includes('-')) {
    const partes = dataPura.split('-');
    if (partes.length === 3) {
      ano = Number(partes[0]);
      mes = Number(partes[1]);
      dia = Number(partes[2]);
    }
  }
  if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return null;
  return { dia, mes: mes - 1, ano };
};

const dmaParaISO = (dia, mes, ano) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

const Agenda = () => {
  const navigate = useNavigate();
  
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🔥 IDENTIFICAÇÃO CORPORATIVA
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [dataAtual, setDataAtual] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date().getDate());
  const [viewPrincipal, setViewPrincipal] = useState('calendario');
  const [viewLista, setViewLista] = useState('mes');
  const [clientes, setClientes]   = useState([]);
  const [locacoes, setLocacoes]   = useState([]);
  const [eventosManual, setEventosManual] = useState([]);
  const [dadosEmpresa, setDadosEmpresa] = useState({ nomeEmpresa: 'Celebre Festa', logotipo: '' });

  const [loadingFB, setLoadingFB] = useState(true);
  const [salvando, setSalvando]   = useState(false); 
  const [toastMsg, setToastMsg] = useState('');
  
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [gavetaFiltrosAberta, setGavetaFiltrosAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaClienteModal, setBuscaClienteModal] = useState('');
  const [mostrarDropdownModal, setMostrarDropdownModal] = useState(false);

  const [modalFormAberto, setModalFormAberto] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [formData, setFormData] = useState(FORM_VAZIO);

  // 🔥 SISTEMA DE AUDITORIA PADRONIZADO
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipe,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria da agenda:", error);
    }
  };

  const mostrarToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500); 
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarDados = async () => {
      setLoadingFB(true);
      try {
        const qCli = query(collection(db, 'clientes'), where("userId", "==", tenantId));
        const sc = await getDocs(qCli);
        setClientes(sc.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('Erro Clientes:', e); }

      try {
        const qLoc = query(collection(db, 'locacoes'), where("userId", "==", tenantId));
        const sl = await getDocs(qLoc);
        setLocacoes(sl.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('Erro Locações:', e); }


      try {
        const qAg = query(collection(db, 'agenda_eventos'), where("userId", "==", tenantId));
        const sa = await getDocs(qAg);
        setEventosManual(sa.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        const backupLocal = JSON.parse(localStorage.getItem('agenda_eventos_v3')) || [];
        setEventosManual(backupLocal);
      }

      try {
        const snapConfig = await getDoc(doc(db, "configuracoes_empresa", tenantId));
        if (snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeEmpresa || 'Celebre Festa',
            logotipo: configData.logotipo || ''
          });
        }
      } catch (e) { console.error('Erro ao buscar dados da Empresa:', e); }

      setLoadingFB(false);
    };

    carregarDados();
  }, [usuarioLogado, navigate, tenantId]);

  const eventosLocacao = useMemo(() => {
    const evs = [];
    locacoes.forEach(loc => {
      const nome = loc.clienteNome || 'Cliente';
      const num  = loc.numeroPedido ? `#${loc.numeroPedido}` : '';
      const servicoStr = String(loc.tipoServico || '').toUpperCase();
      
      let rotuloServico = '🚚 Entrega';
      if (servicoStr.includes('DECORA')) {
        rotuloServico = '✨ Decoração Completa';
      } else if (servicoStr.includes('PEGUE')) {
        rotuloServico = '📦 Pegue e Monte';
      }

      const base = {
        clienteId: loc.clienteId || '', 
        clienteNome: nome,
        origem: 'locacao', 
        locacaoId: loc.id,
        numeroPedido: loc.numeroPedido, 
        tipoServico: loc.tipoServico,
        valorTotal: loc.valorTotal, 
        valorPago: loc.valorPago, 
        status: loc.status,
        local: loc.logistica?.rua ? `${loc.logistica.rua}, ${loc.logistica.numero || ''} - ${loc.logistica.bairro || ''} (${loc.logistica.cidade || ''})` : (loc.enderecoEntrega || ''), 
      };
      
      const stLoc = (loc.status || '').toLowerCase();
      const isLocInativa = (
        stLoc.includes('cancelad') ||
        stLoc.includes('perdid') ||
        stLoc.includes('abandonad') ||
        stLoc.includes('esquecid') ||
        stLoc.includes('finalizad') ||
        stLoc.includes('devolv') ||
        stLoc.includes('concluid')
      );

      if (loc.dataRetirada && !isLocInativa) {
        const dma = isoParaDMA(loc.dataRetirada);
        const horarioExt = (typeof loc.dataRetirada === 'string' && loc.dataRetirada.includes('T')) ? loc.dataRetirada.split('T')[1].substring(0, 5) : '';
        if (dma) evs.push({ ...base, id: `loc-ent-${loc.id}`, tipo: 'entrega', titulo: `${rotuloServico} ${num} - ${nome}`, horario: horarioExt, ...dma });
      }
    
      if (loc.dataDevolucao && !isLocInativa) {
        const dma = isoParaDMA(loc.dataDevolucao);
        const horarioExt = (typeof loc.dataDevolucao === 'string' && loc.dataDevolucao.includes('T')) ? loc.dataDevolucao.split('T')[1].substring(0, 5) : '';
        if (dma) evs.push({ ...base, id: `loc-dev-${loc.id}`, tipo: 'devolucao', titulo: `Devolução ${num} - ${nome}`, horario: horarioExt, ...dma });
      }
    });
    return evs;
  }, [locacoes]);

  const todosEventos = useMemo(() => [...eventosManual, ...eventosLocacao], [eventosManual, eventosLocacao]);

  const getDiasNoMes = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getDiaSemanaInicio = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

  let mesPuro = dataAtual.toLocaleString('pt-BR', { month: 'long' });
  mesPuro = mesPuro.charAt(0).toUpperCase() + mesPuro.slice(1);
  const nomeMes = `${mesPuro} ${dataAtual.getFullYear()}`;

  const eventoVisivel = (ev) =>
    (filtroAtivo === 'todos' || ev.tipo === filtroAtivo) &&
    (!busca.trim() || (ev.titulo || '').toLowerCase().includes(busca.toLowerCase()) || (ev.clienteNome || '').toLowerCase().includes(busca.toLowerCase()) || (ev.local || '').toLowerCase().includes(busca.toLowerCase()));

  const eventosMesAtual = useMemo(() => todosEventos.filter(e => e.mes === dataAtual.getMonth() && e.ano === dataAtual.getFullYear()), [todosEventos, dataAtual]);

  const contadores = useMemo(() => {
    const c = { todos: 0, entrega: 0, devolucao: 0, visita: 0, bloqueio: 0, reuniao: 0, pagamento: 0, tarefa: 0 };
    eventosMesAtual.forEach(e => { c[e.tipo] = (c[e.tipo] || 0) + 1; c.todos++; });
    return c;
  }, [eventosMesAtual]);

  const eventosDoDia = (dia, mesOv, anoOv) => {
    const m = mesOv !== undefined ? mesOv : dataAtual.getMonth();
    const a = anoOv !== undefined ? anoOv : dataAtual.getFullYear();
    return todosEventos.filter(e => e.dia === dia && e.mes === m && e.ano === a);
  };

  // 📊 CÁLCULO INTELIGENTE DE KPIS OPERACIONAIS
  const statsKPI = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const evsHoje = todosEventos.filter(e => {
      return e.dia === hoje.getDate() && e.mes === hoje.getMonth() && e.ano === hoje.getFullYear() && e.tipo !== 'bloqueio';
    }).length;

    const evsMes = eventosMesAtual.filter(e => e.tipo !== 'bloqueio').length;

    const bloqFuturos = todosEventos.filter(e => {
      if (e.tipo !== 'bloqueio') return false;
      const d = new Date(e.ano, e.mes, e.dia);
      d.setHours(0, 0, 0, 0);
      return d >= hoje;
    }).length;

    const diasMes = getDiasNoMes(dataAtual);
    let totalConflitos = 0;
    const diasComConflito = new Set();

    for (let d = 1; d <= diasMes; d++) {
      const evs = eventosDoDia(d);
      const temBloqueio = evs.some(e => e.tipo === 'bloqueio');
      const outros = evs.filter(e => e.tipo !== 'bloqueio');

      if (temBloqueio && outros.length > 0) {
        diasComConflito.add(d);
        totalConflitos++;
      } else if (outros.length > 1) {
        const horarios = outros.filter(e => e.horario && e.horario.trim() !== '').map(e => e.horario.trim());
        const horariosUnicos = new Set(horarios);
        if (horarios.length !== horariosUnicos.size) {
          diasComConflito.add(d);
          totalConflitos++;
        }
      }
    }

    return {
      eventosHoje: evsHoje,
      eventosNoMes: evsMes,
      bloqueiosFuturos: bloqFuturos,
      conflitos: totalConflitos,
      diasComConflito
    };
  }, [todosEventos, eventosMesAtual, dataAtual]);

  // 📅 INFORMAÇÕES DA DATA SELECIONADA PARA O PAINEL LATERAL
  const infoDiaSelecionado = useMemo(() => {
    const dia = diaSelecionado || new Date().getDate();
    const d = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dia);
    const hoje = new Date();
    const isHoje = hoje.getDate() === dia && hoje.getMonth() === dataAtual.getMonth() && hoje.getFullYear() === dataAtual.getFullYear();
    
    let titulo = '';
    const mesNome = d.toLocaleString('pt-BR', { month: 'long' });
    if (isHoje) {
      titulo = `Hoje, ${dia} de ${mesNome}`;
    } else {
      let diaSemana = d.toLocaleString('pt-BR', { weekday: 'long' });
      diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
      titulo = `${dia} de ${mesNome} · ${diaSemana}`;
    }
    
    const evs = eventosDoDia(dia).filter(eventoVisivel);
    return { dia, isHoje, titulo, eventos: evs };
  }, [diaSelecionado, dataAtual, todosEventos, filtroAtivo, busca]);

  const handleDiaClick = (dia) => {
    setDiaSelecionado(dia);
  };

  const abrirModalForm = (dia, ev = null) => {
    const d = dia || diaSelecionado || new Date().getDate();
    if (ev) {
      setEventoSelecionado(ev);
      const anoEv = ev.ano || dataAtual.getFullYear();
      const mesEv = ev.mes !== undefined ? ev.mes : dataAtual.getMonth();
      setFormData({ ...FORM_VAZIO, ...ev, dataISO: dmaParaISO(ev.dia, mesEv, anoEv) });
      setBuscaClienteModal(ev.clienteNome || ''); 
    } else {
      setEventoSelecionado(null);
      setFormData({ ...FORM_VAZIO, dataISO: dmaParaISO(d, dataAtual.getMonth(), dataAtual.getFullYear()) });
      setBuscaClienteModal('');
    }
    setModalFormAberto(true);
  };

  const abrirModalBloqueio = (dia) => {
    setEventoSelecionado(null);
    const d = dia || diaSelecionado || new Date().getDate();
    setFormData({
      ...FORM_VAZIO,
      tipo: 'bloqueio',
      titulo: 'Bloqueio de Data',
      dataISO: dmaParaISO(d, dataAtual.getMonth(), dataAtual.getFullYear())
    });
    setBuscaClienteModal('');
    setModalFormAberto(true);
  };

  const salvarEvento = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const [anoStr, mesStr, diaStr] = formData.dataISO.split('-');
    const cli = clientes.find(c => c.id === formData.clienteId || (c.nome || c.nomeFantasia) === buscaClienteModal);

    const evParaSalvar = {
      titulo: formData.titulo, 
      clienteId: cli ? cli.id : '', 
      clienteNome: cli ? (cli.nome || cli.nomeFantasia) : buscaClienteModal,
      tipo: formData.tipo, 
      horario: formData.horario, 
      local: formData.local || '', 
      status: formData.status || 'pendente', 
      observacoes: formData.observacoes, 
      origem: 'manual',
      dia: parseInt(diaStr), 
      mes: parseInt(mesStr) - 1, 
      ano: parseInt(anoStr),
      userId: tenantId
    };

    try {
      if (eventoSelecionado) {
        const docRef = doc(db, 'agenda_eventos', eventoSelecionado.id);
        await updateDoc(docRef, evParaSalvar);
        setEventosManual(prev => prev.map(x => x.id === eventoSelecionado.id ? { id: eventoSelecionado.id, ...evParaSalvar } : x));
        await registrarLog("EDIÇÃO NA AGENDA", `Editou o compromisso: "${evParaSalvar.titulo}".`);
        mostrarToast('✅ Evento atualizado!');
      } else {
        let evsCriados = [];
        const docRef = await addDoc(collection(db, 'agenda_eventos'), evParaSalvar);
        evsCriados.push({ id: docRef.id, ...evParaSalvar });
        await registrarLog("NOVO NA AGENDA", `Adicionou o compromisso: "${evParaSalvar.titulo}" para a data ${diaStr}/${mesStr}/${anoStr}.`);

        if (formData.recorrencia !== 'nenhuma') {
          for (let i = 1; i <= 3; i++) {
            const d = new Date(evParaSalvar.ano, evParaSalvar.mes + (formData.recorrencia === 'mensal' ? i : 0), formData.recorrencia === 'semanal' ? evParaSalvar.dia + (i * 7) : evParaSalvar.dia);
            const repEv = { ...evParaSalvar, dia: d.getDate(), mes: d.getMonth(), ano: d.getFullYear() };
            const repRef = await addDoc(collection(db, 'agenda_eventos'), repEv);
            evsCriados.push({ id: repRef.id, ...repEv });
          }
        }
        setEventosManual(prev => [...prev, ...evsCriados]);
        mostrarToast('✨ Novo compromisso salvo!');
      }
      setModalFormAberto(false);
    } catch (err) {
      console.error(err);
      const novaLista = eventoSelecionado 
        ? eventosManual.map(x => x.id === eventoSelecionado.id ? {id: eventoSelecionado.id, ...evParaSalvar} : x)
        : [...eventosManual, {id: Date.now().toString(), ...evParaSalvar}];
      setEventosManual(novaLista);
      localStorage.setItem('agenda_eventos_v3', JSON.stringify(novaLista));
      mostrarToast('⚠️ Salvo offline.');
      setModalFormAberto(false);
    } finally { setSalvando(false); }
  };

  const excluirEvento = async () => {
    if (formData.origem === 'locacao') return;
    if (window.confirm('Apagar este evento definitivamente?')) {
      setSalvando(true);
      try {
        await deleteDoc(doc(db, 'agenda_eventos', formData.id));
        await registrarLog("EXCLUSÃO NA AGENDA", `Apagou o compromisso: "${formData.titulo}".`);
        setEventosManual(prev => prev.filter(x => x.id !== formData.id));
        mostrarToast('🗑️ Evento apagado.');
        setModalFormAberto(false);
      } catch (err) {
        const novaLista = eventosManual.filter(x => x.id !== formData.id);
        setEventosManual(novaLista);
        localStorage.setItem('agenda_eventos_v3', JSON.stringify(novaLista));
        mostrarToast('🗑️ Evento apagado (offline).');
        setModalFormAberto(false);
      } finally { setSalvando(false); }
    }
  };

  const abrirGoogleMaps = (endereco) => {
      if (!endereco) return;
      const isLink = endereco.startsWith('http://') || endereco.startsWith('https://');
      const url = isLink ? endereco : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
      window.open(url, '_blank');
  };

  const exportarPDF = () => {
    try {
      const docPDF = new jsPDF();
      let listaExportacao = [];
      let tituloRelatorio = '';
      let subtituloRelatorio = '';
      
      const PDF_COLORS = {
        entrega:   { bg: '#eff6ff', text: '#1e3a8a' },
        devolucao: { bg: '#fff7ed', text: '#9a3412' },
        visita:    { bg: '#f0fdf4', text: '#166534' },
        bloqueio:  { bg: '#fef2f2', text: '#991b1b' },
        reuniao:   { bg: '#faf5ff', text: '#6b21a8' },
        pagamento: { bg: '#fefce8', text: '#854d0e' },
        tarefa:    { bg: '#f8fafc', text: '#334155' }
      };

      let eventosFiltrados = [];
      if (viewPrincipal === 'calendario' || (viewPrincipal === 'lista' && viewLista === 'mes')) {
        eventosFiltrados = eventosMesAtual.filter(eventoVisivel);
        tituloRelatorio = `Agenda Mensal: ${nomeMes}`;
      } else if (viewPrincipal === 'lista' && viewLista === 'semana') {
        const diaSemana = dataAtual.getDay();
        const inicio = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate() - diaSemana);
        const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
        
        eventosFiltrados = todosEventos.filter(e => {
          if (!eventoVisivel(e)) return false;
          const dataEv = new Date(e.ano, e.mes, e.dia);
          dataEv.setHours(0,0,0,0); inicio.setHours(0,0,0,0); fim.setHours(23,59,59,999);
          return dataEv >= inicio && dataEv <= fim;
        });
        tituloRelatorio = `Agenda Semanal (${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')})`;
      } else {
        eventosFiltrados = todosEventos.filter(e => {
          if (!eventoVisivel(e)) return false;
          return e.ano === dataAtual.getFullYear() && e.mes === dataAtual.getMonth() && e.dia === dataAtual.getDate();
        });
        tituloRelatorio = `Agenda Diária: ${dataAtual.toLocaleDateString('pt-BR')}`;
      }

      listaExportacao = eventosFiltrados
        .sort((a, b) => {
          if (a.ano !== b.ano) return a.ano - b.ano;
          if (a.mes !== b.mes) return a.mes - b.mes;
          if (a.dia !== b.dia) return a.dia - b.dia;
          return (a.horario || '99:99').localeCompare(b.horario || '99:99');
        })
        .map(e => {
          const cor = PDF_COLORS[e.tipo] || { bg: '#f1f5f9', text: '#475569' };
          return [
            `${String(e.dia).padStart(2, '0')}/${String(e.mes + 1).padStart(2, '0')}`,
            e.horario || '--:--',
            { 
                content: TIPOS[e.tipo]?.label || '', 
                styles: { fillColor: cor.bg, textColor: cor.text, fontStyle: 'bold', halign: 'center' } 
            },
            e.titulo || '', 
            e.clienteNome || 'Não informado'
          ];
        });

      let startY = 35; let startXTexto = 14;
      if (dadosEmpresa.logotipo && dadosEmpresa.logotipo.startsWith('data:image')) {
        try { docPDF.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 25, 25);
        startXTexto = 45; } catch(e) {}
      }

      docPDF.setFontSize(22);
      docPDF.setTextColor(15, 23, 42); docPDF.setFont("helvetica", "bold");
      docPDF.text(dadosEmpresa.nomeEmpresa.toUpperCase(), startXTexto, 22);

      docPDF.setFontSize(10); docPDF.setTextColor(150, 150, 150); docPDF.setFont("helvetica", "normal");
      docPDF.text("DEPARTAMENTO DE LOGÍSTICA / AGENDA", startXTexto, 28);

      docPDF.setFontSize(14); docPDF.setTextColor(0, 0, 0); docPDF.setFont("helvetica", "bold");
      docPDF.text(tituloRelatorio, 14, 45);

      docPDF.setFontSize(9); docPDF.setTextColor(100); docPDF.setFont("helvetica", "normal");
      docPDF.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 51);
      
      if (subtituloRelatorio) { docPDF.text(subtituloRelatorio, 14, 56); startY = 65;
      } else { startY = 60; }

      docPDF.setLineWidth(0.5); docPDF.setDrawColor(200, 200, 200);
      docPDF.line(14, startY - 4, 196, startY - 4);

      let colunasDef = [["Data", "Horário", "Tipo", "Título do Evento", "Cliente"]];
      
      autoTable(docPDF, {
        startY: startY, head: colunasDef, body: listaExportacao, theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' }, 
        styles: { fontSize: 9, cellPadding: 5, valign: 'middle' }, 
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      
      const nomeArquivoSafe = dadosEmpresa.nomeEmpresa.replace(/[^a-z0-9]/gi, '_');
      docPDF.save(`${nomeArquivoSafe}_${tituloRelatorio.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      mostrarToast('📄 PDF gerado com sucesso!');
    } catch (error) { mostrarToast('❌ Erro ao gerar o arquivo PDF.'); }
  };

  const mudarAno = (dir) => { const d = new Date(dataAtual); d.setFullYear(dataAtual.getFullYear() + dir); setDataAtual(d); };
  const mudarMes = (dir) => { const d = new Date(dataAtual); d.setMonth(dataAtual.getMonth() + dir); setDataAtual(d); };
  const mudarDia = (dir) => { const d = new Date(dataAtual); d.setDate(dataAtual.getDate() + dir); setDataAtual(d); };
  const mudarSemana = (dir) => { const d = new Date(dataAtual); d.setDate(dataAtual.getDate() + dir * 7); setDataAtual(d); };

  const renderCardEvento = (ev) => {
    const saldo = ev.origem === 'locacao' ? Number(ev.valorTotal || 0) - Number(ev.valorPago || 0) : null;
    return (
      <div key={ev.id} className={`list-item-card${ev.origem === 'locacao' ? ' card-locacao' : ''}`} onClick={() => abrirModalForm(ev.dia, ev)}>
        <div className={`list-left-bar bar-${ev.tipo}`} />
        <div className="list-info">
          <div className="list-item-header">
            <h4>
                {ev.status === 'concluido' ? '✅ ' : ''}
                {ev.status === 'cancelado' ? '❌ ' : ''}
                <span style={{ textDecoration: ev.status === 'cancelado' ? 'line-through' : 'none' }}>{ev.titulo}</span>
            </h4>
            {ev.horario && <span className="list-horario">🕐 {ev.horario}</span>}
            {ev.origem === 'locacao' && <span className="badge-locacao-origem">🔗 Locação</span>}
          </div>
          {ev.clienteNome && <span className="list-cliente">👤 {ev.clienteNome}</span>}
          
          {ev.local && (
              <span className="link-maps-card" onClick={(e) => { e.stopPropagation(); abrirGoogleMaps(ev.local); }}>
                  📍 {ev.local}
              </span>
          )}

          {ev.tipoServico  && <span className="list-obs">📦 {ev.tipoServico}</span>}
          {ev.observacoes  && <span className="list-obs">📝 {ev.observacoes}</span>}
       
          {saldo !== null && Number(ev.valorTotal) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span className="list-financeiro">
                💰 R$ {Number(ev.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ·{' '}
                {saldo > 0 ? <span className="saldo-devedor">Falta R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> : <span className="saldo-pago">✅ Pago</span>}
              </span>

              {saldo > 0 && (
                <button
                  type="button"
                  className="btn-quick-receber-agenda"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/novo-lancamento', {
                      state: {
                        locacaoId: ev.locacaoId || ev.id,
                        clienteNome: ev.clienteNome,
                        tipo: 'entrada'
                      }
                    });
                  }}
                  style={{
                    padding: '4px 10px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 5px rgba(16,185,129,0.25)'
                  }}
                  title="Lançar Recebimento deste pedido no Financeiro"
                >
                  💰 Receber Saldo
                </button>
              )}
            </div>
          )}
        </div>
        
        <span className={`list-tipo-badge badge-${ev.tipo}`}>{TIPOS[ev.tipo]?.label}</span>
      </div>
    );
  };

  // 🗓️ RENDER DO CALENDÁRIO COM DIAS COMPLETOS E SELEÇÃO VISUAL
  const renderCalendario = () => {
    const totalDias = getDiasNoMes(dataAtual);
    const diaInicio = getDiaSemanaInicio(dataAtual);
    const hojeD = new Date();
    const MAX = 2;

    const diasMesAnterior = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 0).getDate();
    const diasPrev = [];
    for (let i = diaInicio - 1; i >= 0; i--) {
      diasPrev.push(diasMesAnterior - i);
    }

    const diasAtuais = [];
    for (let dia = 1; dia <= totalDias; dia++) {
      diasAtuais.push(dia);
    }

    const totalCelulas = diasPrev.length + diasAtuais.length;
    const diasNextCount = (7 - (totalCelulas % 7)) % 7;
    const diasNext = [];
    for (let i = 1; i <= diasNextCount; i++) {
      diasNext.push(i);
    }

    return (
      <div className="agenda-calendar-panel-box">
        {/* Cabeçalho Interno do Calendário */}
        <div className="cal-header-bar">
          <div className="cal-nav-controls">
            <button className="cal-btn-nav" onClick={() => mudarMes(-1)} title="Mês anterior">
              <i className="fas fa-chevron-left"></i>
            </button>
            <button className="cal-btn-nav" onClick={() => mudarMes(1)} title="Próximo mês">
              <i className="fas fa-chevron-right"></i>
            </button>
            <h3 className="cal-title-month">{nomeMes}</h3>
          </div>

          <button 
            type="button"
            className="cal-btn-today" 
            onClick={() => { 
              const hoje = new Date();
              setDataAtual(hoje); 
              setDiaSelecionado(hoje.getDate()); 
            }}
          >
            Hoje
          </button>
        </div>

        {/* Legendas e Dicas */}
        <div className="cal-legend-bar">
          <span className="cal-legend-item"><span className="cal-dot-legend event-dot"></span> Evento</span>
          <span className="cal-legend-item"><i className="fas fa-lock cal-icon-legend lock-icon"></i> Bloqueio</span>
          <span className="cal-legend-item"><i className="fas fa-exclamation-triangle cal-icon-legend alert-icon"></i> Conflito</span>
          <span className="cal-legend-hint">· No celular, toque e segure uma data para bloquear</span>
        </div>

        {/* Grade do Calendário */}
        <div className="cal-grid-outer">
          <div className="cal-weekdays-row">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="cal-weekday-name">{d}</div>
            ))}
          </div>

          <div className="cal-days-grid">
            {/* Dias do mês anterior */}
            {diasPrev.map((diaP, idx) => (
              <div key={`prev-${idx}`} className="cal-day-cell cal-other-month">
                <span className="cal-day-num muted">{diaP}</span>
              </div>
            ))}

            {/* Dias do mês atual */}
            {diasAtuais.map(dia => {
              const evsDia = eventosDoDia(dia).filter(eventoVisivel);
              const isHoje = hojeD.getDate() === dia && hojeD.getMonth() === dataAtual.getMonth() && hojeD.getFullYear() === dataAtual.getFullYear();
              const isSelecionado = diaSelecionado === dia;
              const temConflito = statsKPI.diasComConflito.has(dia);
              const extra = evsDia.length - MAX;

              return (
                <div
                  key={`cur-${dia}`}
                  className={`cal-day-cell${isHoje ? ' is-today' : ''}${isSelecionado ? ' is-selected' : ''}${temConflito ? ' has-conflict' : ''}`}
                  onClick={() => handleDiaClick(dia)}
                >
                  <div className="cal-day-cell-top">
                    <span className="cal-day-num">{dia}</span>
                    {temConflito && <span className="cal-conflict-tag" title="Conflito de horários nesta data">⚠️</span>}
                  </div>

                  {/* Tags compactas no desktop */}
                  <div className="cal-cell-events">
                    {evsDia.slice(0, MAX).map(ev => (
                      <div
                        key={ev.id}
                        className={`cal-event-pill type-${ev.tipo}${ev.origem === 'locacao' ? ' from-locacao' : ''}`}
                        title={`${ev.horario ? ev.horario + ' - ' : ''}${ev.titulo}`}
                      >
                        {ev.tipo === 'bloqueio' && <i className="fas fa-lock pill-lock-icon"></i>}
                        <span className="pill-text">{ev.titulo}</span>
                      </div>
                    ))}
                    {extra > 0 && (
                      <span className="cal-more-pill">+{extra} mais</span>
                    )}
                  </div>

                  {/* Pontinhos para celular */}
                  {evsDia.length > 0 && (
                    <div className="cal-dots-row-mobile">
                      {evsDia.slice(0, 4).map((ev, idx) => (
                        <span 
                          key={idx} 
                          className="cal-dot-micro" 
                          style={{ background: TIPOS[ev.tipo]?.cor || '#3b82f6' }}
                        />
                      ))}
                      {evsDia.length > 4 && <span className="cal-dot-more">+{evsDia.length - 4}</span>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Dias do próximo mês */}
            {diasNext.map((diaN, idx) => (
              <div key={`next-${idx}`} className="cal-day-cell cal-other-month">
                <span className="cal-day-num muted">{diaN}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 📋 RENDER DO PAINEL LATERAL DEDICADO À DATA CLICADA
  const renderPainelLateral = () => {
    const { dia, isHoje, titulo, eventos } = infoDiaSelecionado;

    return (
      <aside className="agenda-side-panel">
        <div className="side-panel-header">
          <div className="side-panel-title-wrap">
            <h3 className="side-panel-date-title">{titulo}</h3>
            <span className="side-panel-count-subtitle">
              {eventos.length === 0 ? 'Nenhum evento' : `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`}
            </span>
          </div>

          <button
            type="button"
            className="btn-side-header-add"
            onClick={() => abrirModalForm(dia)}
            title="Novo evento nesta data"
          >
            <i className="fas fa-plus"></i> Novo
          </button>
        </div>

        <div className="side-panel-body custom-scrollbar">
          {eventos.length === 0 ? (
            /* 📅 ESTADO VAZIO: DIA LIVRE (IDÊNTICO AO 1º PRINT) */
            <div className="side-panel-empty-state">
              <div className="side-empty-icon-box">
                <i className="far fa-calendar-alt"></i>
              </div>
              <h4 className="side-empty-title">Dia livre</h4>
              <p className="side-empty-desc">
                Aproveite para criar um evento ou bloquear esta data.
              </p>

              <div className="side-empty-buttons-row">
                <button
                  type="button"
                  className="btn-empty-action btn-empty-create"
                  onClick={() => abrirModalForm(dia)}
                >
                  <i className="far fa-calendar-plus"></i> Criar evento
                </button>
                <button
                  type="button"
                  className="btn-empty-action btn-empty-block"
                  onClick={() => abrirModalBloqueio(dia)}
                >
                  <i className="fas fa-lock"></i> Bloquear esta data
                </button>
              </div>
            </div>
          ) : (
            /* 📦 LISTA DE EVENTOS DO DIA (IDÊNTICO AO 2º PRINT) */
            <div className="side-events-list">
              {eventos.map(ev => {
                const saldo = ev.origem === 'locacao' ? Number(ev.valorTotal || 0) - Number(ev.valorPago || 0) : null;
                const isBloqueio = ev.tipo === 'bloqueio';

                return (
                  <div
                    key={ev.id}
                    className={`side-event-card type-${ev.tipo}${ev.origem === 'locacao' ? ' card-locacao' : ''}`}
                    onClick={() => abrirModalForm(dia, ev)}
                  >
                    <div className="side-card-top-row">
                      <h4 className="side-card-title">
                        {isBloqueio && '🔒 '}
                        {ev.status === 'concluido' && '✅ '}
                        {ev.status === 'cancelado' && '❌ '}
                        <span style={{ textDecoration: ev.status === 'cancelado' ? 'line-through' : 'none' }}>
                          {ev.titulo}
                        </span>
                      </h4>

                      {ev.origem === 'locacao' ? (
                        <span className={`side-status-badge status-${(ev.status || 'pendente').toLowerCase()}`}>
                          {ev.status ? ev.status.toUpperCase() : 'CONTRATO'}
                        </span>
                      ) : (
                        <span className={`side-status-badge badge-${ev.tipo}`}>
                          {TIPOS[ev.tipo]?.label || ev.tipo}
                        </span>
                      )}
                    </div>

                    {ev.tipoServico && (
                      <div className="side-card-tag-pill">
                        {ev.tipoServico}
                      </div>
                    )}

                    <div className="side-card-meta-list">
                      {ev.horario && (
                        <div className="side-meta-item">
                          <i className="far fa-clock"></i>
                          <span>{ev.horario}</span>
                        </div>
                      )}

                      {ev.clienteNome && ev.clienteNome !== ev.titulo && (
                        <div className="side-meta-item">
                          <i className="far fa-user"></i>
                          <span>{ev.clienteNome}</span>
                        </div>
                      )}

                      {ev.local && (
                        <div
                          className="side-meta-item side-link-maps"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirGoogleMaps(ev.local);
                          }}
                          title="Abrir no Google Maps"
                        >
                          <i className="fas fa-map-marker-alt"></i>
                          <span>{ev.local}</span>
                        </div>
                      )}

                      {ev.observacoes && (
                        <div className="side-meta-item side-obs-text">
                          <i className="far fa-sticky-note"></i>
                          <span>{ev.observacoes}</span>
                        </div>
                      )}
                    </div>

                    {saldo !== null && Number(ev.valorTotal) > 0 && (
                      <div className="side-card-finance-box">
                        <div className="finance-values">
                          <span>💰 R$ {Number(ev.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          {saldo > 0 ? (
                            <span className="finance-pending">Falta R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="finance-paid">✅ Quitado</span>
                          )}
                        </div>

                        {saldo > 0 && (
                          <button
                            type="button"
                            className="btn-side-receber"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/novo-lancamento', {
                                state: {
                                  locacaoId: ev.locacaoId || ev.id,
                                  clienteNome: ev.clienteNome,
                                  tipo: 'entrada'
                                }
                              });
                            }}
                          >
                            💰 Receber Saldo
                          </button>
                        )}
                      </div>
                    )}

                    <div className="side-card-actions-bar">
                      {ev.origem === 'locacao' ? (
                        <button
                          type="button"
                          className="btn-side-action btn-locacao"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/locacoes');
                          }}
                        >
                          📋 Ver em Locações
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-side-action btn-edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirModalForm(dia, ev);
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            className="btn-side-action btn-del"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('Apagar este compromisso definitivamente?')) {
                                setSalvando(true);
                                try {
                                  await deleteDoc(doc(db, 'agenda_eventos', ev.id));
                                  await registrarLog("EXCLUSÃO NA AGENDA", `Apagou o compromisso: "${ev.titulo}".`);
                                  setEventosManual(prev => prev.filter(x => x.id !== ev.id));
                                  mostrarToast('🗑️ Evento apagado.');
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setSalvando(false);
                                }
                              }
                            }}
                          >
                            🗑️ Apagar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                className="btn-side-add-bottom"
                onClick={() => abrirModalForm(dia)}
              >
                <i className="fas fa-plus"></i> Novo compromisso neste dia
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  };

  const renderAno = () => {
    const anoAtual = dataAtual.getFullYear();
    const listaAno = todosEventos.filter(e => e.ano === anoAtual && eventoVisivel(e)).sort((a, b) => {
      if (a.mes !== b.mes) return a.mes - b.mes;
      if (a.dia !== b.dia) return a.dia - b.dia;
      return (a.horario || '99:99').localeCompare(b.horario || '99:99');
    });
    
    if (listaAno.length === 0) return <div className="vista-vazia">Nenhum evento agendado para {anoAtual}.</div>;
    
    let ultimoMes = null;
    let ultimoDia = null;
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    return (
      <div className="list-view-container">
        {listaAno.map(ev => {
          const novoMes = ev.mes !== ultimoMes;
          const novoDia = ev.dia !== ultimoDia || novoMes;
          ultimoMes = ev.mes; ultimoDia = ev.dia;
          return (
            <React.Fragment key={ev.id}>
              {novoMes && <div className="list-month-header">{mesesNomes[ev.mes]} de {anoAtual}</div>}
              {novoDia && <div className="list-day-subheader">Dia {ev.dia}</div>}
              {renderCardEvento(ev)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderMes = () => {
    const lista = eventosMesAtual.filter(eventoVisivel).sort((a, b) => {
      if (a.dia !== b.dia) return a.dia - b.dia;
      return (a.horario || '99:99').localeCompare(b.horario || '99:99');
    });
    
    if (lista.length === 0) return <div className="vista-vazia">Nenhum evento este mês.</div>;
    let ultimoDia = null;
    
    return (
      <div className="list-view-container">
        {lista.map(ev => {
          const novoGrupo = ev.dia !== ultimoDia;
          ultimoDia = ev.dia;
          return (
            <React.Fragment key={ev.id}>
              {novoGrupo && <div className="list-day-header">{ev.dia} de {dataAtual.toLocaleString('pt-BR', { month: 'long' })}</div>}
              {renderCardEvento(ev)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderSemana = () => {
    const diaSemana = dataAtual.getDay();
    const inicio = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate() - diaSemana);
    const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
    
    const listaSemana = todosEventos.filter(e => {
      if (!eventoVisivel(e)) return false;
      const dataEv = new Date(e.ano, e.mes, e.dia);
      dataEv.setHours(0,0,0,0); inicio.setHours(0,0,0,0); fim.setHours(23,59,59,999);
      return dataEv >= inicio && dataEv <= fim;
    }).sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      if (a.mes !== b.mes) return a.mes - b.mes;
      if (a.dia !== b.dia) return a.dia - b.dia;
      return (a.horario || '99:99').localeCompare(b.horario || '99:99');
    });

    if (listaSemana.length === 0) return <div className="vista-vazia">Nenhum evento agendado para esta semana.</div>;
    
    let ultimoDia = null;
    
    return (
      <div className="list-view-container">
        {listaSemana.map(ev => {
          const dataObj = new Date(ev.ano, ev.mes, ev.dia);
          const formatoDia = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
          const formatoDiaCap = formatoDia.charAt(0).toUpperCase() + formatoDia.slice(1);
          const novoGrupo = formatoDiaCap !== ultimoDia;
          ultimoDia = formatoDiaCap;

          return (
            <React.Fragment key={ev.id}>
              {novoGrupo && <div className="list-day-header">{formatoDiaCap}</div>}
              {renderCardEvento(ev)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderDia = () => {
    const evsDia = eventosDoDia(dataAtual.getDate()).filter(eventoVisivel).sort((a, b) => (a.horario || '99:99').localeCompare(b.horario || '99:99'));
    const tituloData = dataAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    
    return (
      <div className="vista-dia-container">
        <div className="vista-dia-titulo">{tituloData}</div>
        {evsDia.length === 0
          ? <div className="vista-vazia">Nenhum evento neste dia. <button className="link-btn" onClick={() => abrirModalForm(dataAtual.getDate())}>+ Adicionar</button></div>
          : evsDia.map(ev => renderCardEvento(ev))
        }
      </div>
    );
  };

  const renderConteudo = () => {
    if (viewPrincipal === 'calendario') {
      return (
        <div className="agenda-workspace-layout">
          {renderCalendario()}
          {renderPainelLateral()}
        </div>
      );
    }

    return (
      <div className="agenda-list-wrapper">
        <div className="list-sub-switcher-bar">
          <button className={`sub-btn ${viewLista === 'ano' ? 'active' : ''}`} onClick={() => setViewLista('ano')}>Ano</button>
          <button className={`sub-btn ${viewLista === 'mes' ? 'active' : ''}`} onClick={() => setViewLista('mes')}>Mês</button>
          <button className={`sub-btn ${viewLista === 'semana' ? 'active' : ''}`} onClick={() => setViewLista('semana')}>Semana</button>
          <button className={`sub-btn ${viewLista === 'dia' ? 'active' : ''}`} onClick={() => setViewLista('dia')}>Dia</button>
        </div>
        {viewLista === 'ano' && renderAno()}
        {viewLista === 'mes' && renderMes()}
        {viewLista === 'semana' && renderSemana()}
        {viewLista === 'dia' && renderDia()}
      </div>
    );
  };

  const renderModalForm = () => {
    const ehLocacao = formData.origem === 'locacao';
    const saldo = ehLocacao ? Number(formData.valorTotal || 0) - Number(formData.valorPago || 0) : 0;
    
    return (
      <div className="modal-overlay" onClick={() => !salvando && setModalFormAberto(false)}>
        <div className="modal-content modal-form-content" onClick={e => e.stopPropagation()}>
          
          <div className="modal-header">
            <h3>{ehLocacao ? '🔗 Detalhes da Locação' : (eventoSelecionado ? '✏️ Editar Compromisso' : (formData.tipo === 'bloqueio' ? '🔒 Bloqueio de Data' : '📝 Novo Compromisso'))}</h3>
            <button className="btn-close" onClick={() => !salvando && setModalFormAberto(false)}>×</button>
          </div>

          {ehLocacao ? (
            <div className="locacao-detalhe">
              <div className="locacao-detalhe-row"><span>Cliente</span><strong>👤 {formData.clienteNome}</strong></div>
              <div className="locacao-detalhe-row"><span>Pedido</span><strong>#{formData.numeroPedido || '-'}</strong></div>
              {formData.tipoServico && <div className="locacao-detalhe-row"><span>Modalidade</span><strong>{formData.tipoServico}</strong></div>}
              
              {formData.local && (
                <div className="locacao-detalhe-row">
                    <span>Local</span>
                    <span className="link-maps-card" style={{cursor:'pointer'}} onClick={() => abrirGoogleMaps(formData.local)}>
                        📍 {formData.local}
                    </span>
                </div>
              )}

              <div className="locacao-detalhe-row"><span>Evento</span><span className={`list-tipo-badge badge-${formData.tipo}`}>{TIPOS[formData.tipo]?.label}</span></div>
              {formData.status && <div className="locacao-detalhe-row"><span>Status</span><strong className={`status-locacao ${formData.status}`}>{formData.status.toUpperCase()}</strong></div>}
              {Number(formData.valorTotal) > 0 && (
                <div className="locacao-detalhe-financeiro">
                  <div className="fin-row"><span>Total</span><strong>R$ {Number(formData.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                  <div className="fin-row"><span>Pago</span><strong style={{ color: '#22c55e' }}>R$ {Number(formData.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                  <div className="fin-row fin-saldo"><span>Saldo</span><strong style={{ color: saldo > 0 ? '#ef4444' : '#22c55e' }}>{saldo > 0 ? `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a receber` : '✅ Pago'}</strong></div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {saldo > 0 && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setModalFormAberto(false);
                      navigate('/novo-lancamento', { 
                        state: { 
                          locacaoId: formData.locacaoId || formData.id,
                          clienteNome: formData.clienteNome,
                          tipo: 'entrada' 
                        } 
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 3px 8px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    💰 Lançar Recebimento (R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => {
                    setModalFormAberto(false);
                    navigate('/locacoes');
                  }}
                  style={{
                    padding: '10px 14px',
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  📋 Ver em Locações
                </button>
              </div>

              <p className="locacao-aviso" style={{ marginTop: '12px' }}>⚠️ Entregas e Devoluções são sincronizadas com a tela de Locações.</p>
            </div>
          ) : (
            <form onSubmit={salvarEvento} className="modal-form">
              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label-clean">📅 DATA *</label>
                  <input 
                    type="date" 
                    value={formData.dataISO} 
                    onChange={e => setFormData({ ...formData, dataISO: e.target.value })} 
                    required 
                    disabled={salvando}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label-clean">⏰ HORÁRIO <span className="label-hint-inline">(opcional)</span></label>
                  <input 
                    type="time" 
                    value={formData.horario} 
                    onChange={e => setFormData({ ...formData, horario: e.target.value })} 
                    disabled={salvando}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label-clean">📌 TÍTULO DO COMPROMISSO *</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={formData.titulo} 
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })} 
                  placeholder="Ex: Visita técnica no salão" 
                  required 
                  disabled={salvando}
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label-clean">💼 TIPO DE TAREFA</label>
                  <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} disabled={salvando}>
                    <option value="reuniao">🤝 Reunião com Cliente</option>
                    <option value="visita">📍 Visita Técnica / Local</option>
                    <option value="pagamento">💰 Lembrete Financeiro</option>
                    <option value="tarefa">📌 Tarefa Administrativa</option>
                    <option value="bloqueio">🚫 Bloqueio de Data</option>
                  </select>
                </div>
         
                {!eventoSelecionado ? (
                  <div className="form-group">
                    <label className="form-label-clean">🔄 REPETIR LEMBRETE</label>
                    <select value={formData.recorrencia} onChange={e => setFormData({ ...formData, recorrencia: e.target.value })} disabled={salvando}>
                      <option value="nenhuma">Apenas nesta data</option>
                      <option value="semanal">Semanalmente (3x)</option>
                      <option value="mensal">Mensalmente (3x)</option>
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label-clean">📋 STATUS</label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} disabled={salvando}>
                      <option value="pendente">⏳ Pendente</option>
                      <option value="concluido">✅ Concluído</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label-clean">👤 CLIENTE <span className="label-hint-inline">(opcional)</span></label>
                  <div className="custom-autocomplete-container">
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={buscaClienteModal}
                      onFocus={() => setMostrarDropdownModal(true)}
                      onChange={(e) => {
                        setBuscaClienteModal(e.target.value);
                        if (e.target.value === '') setFormData({...formData, clienteId: ''});
                      }}
                      disabled={salvando}
                    />
                    {mostrarDropdownModal && buscaClienteModal.length > 0 && (
                      <ul className="autocomplete-results" style={{maxHeight: '150px'}}>
                        {clientes
                          .filter(c => (c.nome || c.nomeFantasia || '').toLowerCase().includes(buscaClienteModal.toLowerCase()))
                          .sort((a, b) => (a.nome || a.nomeFantasia || '').localeCompare(b.nome || b.nomeFantasia || ''))
                          .map(c => (
                            <li key={c.id} onClick={() => {
                              setFormData({...formData, clienteId: c.id});
                              setBuscaClienteModal(c.nome || c.nomeFantasia);
                              setMostrarDropdownModal(false);
                            }}>
                              {c.nome || c.nomeFantasia}
                            </li>
                          ))}
                         {clientes.filter(c => (c.nome || c.nomeFantasia || '').toLowerCase().includes(buscaClienteModal.toLowerCase())).length === 0 && (
                            <li style={{ color: 'var(--texto-secundario)', cursor: 'default' }}>Usar nome avulso: "{buscaClienteModal}"</li>
                          )}
                      </ul>
                    )}
                    {mostrarDropdownModal && <div className="autocomplete-overlay" onClick={() => setMostrarDropdownModal(false)} />}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label-clean">📍 LOCAL / ENDEREÇO</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input 
                      type="text" 
                      value={formData.local} 
                      onChange={e => setFormData({ ...formData, local: e.target.value })} 
                      placeholder="Ex: Espaço Vida" 
                      disabled={salvando}
                      style={{ flex: 1 }}
                    />
                    {formData.local && (
                      <button 
                        type="button" 
                        className="btn-maps" 
                        title="Pesquisar no Google Maps"
                        onClick={() => abrirGoogleMaps(formData.local)}
                      >
                        📍 Maps
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label-clean">📝 OBSERVAÇÕES EXTRA</label>
                <textarea 
                  value={formData.observacoes} 
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })} 
                  placeholder="Links, referências de peças ou notas..." 
                  rows={2} 
                  disabled={salvando}
                />
              </div>
              
              <div className="modal-actions">
                {eventoSelecionado && <button type="button" className="btn-excluir-modal" onClick={excluirEvento} disabled={salvando}>Apagar</button>}
                <button type="button" className="btn-cancelar-modal" onClick={() => setModalFormAberto(false)} disabled={salvando}>Cancelar</button>
                <button type="submit" className="btn-salvar-modal" disabled={salvando}>{salvando ? 'Salvando...' : (eventoSelecionado ? 'Atualizar' : 'Salvar Compromisso')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="agenda-container clientes-container fade-in">
      {toastMsg && (
        <div className="toast-mensagem fade-in">
          {toastMsg}
        </div>
      )}

      {/* ── HERO CABEÇALHO (PADRÃO OFICIAL CELEBRE) ── */}
      <header className="clientes-hero-header">
        <div className="welcome-text">
          <div className="header-title-row">
            <span className="header-icon-badge">
              <i className="fas fa-calendar-alt"></i>
            </span>
            <div>
              <h1>Agenda</h1>
              <p>Sua central operacional: eventos, bloqueios e conflitos em um só lugar.</p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary-celebre"
            onClick={() => abrirModalBloqueio(diaSelecionado)}
          >
            <i className="fas fa-lock"></i> BLOQUEAR DATA
          </button>

          <button
            type="button"
            className="btn-secondary-celebre"
            onClick={exportarPDF}
            title="Exportar Relatório em PDF"
          >
            <i className="fas fa-file-pdf"></i> EXPORTAR
          </button>

          <button
            type="button"
            className="btn-primary-celebre"
            onClick={() => abrirModalForm(diaSelecionado)}
          >
            + NOVO EVENTO
          </button>
        </div>
      </header>

      {/* ── CARDS DE DASHBOARD KPI (PADRÃO OFICIAL CELEBRE - OPERAÇÃO LOGÍSTICA) ── */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro border-blue">
          <div className="stat-icon-wrapper icon-blue">
            <i className="fas fa-truck"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">ENTREGAS NO MÊS</span>
            <span className="stat-value">{contadores.entrega}</span>
            <span className="stat-sub">Saídas programadas</span>
          </div>
        </div>

        <div className="stat-card-pro border-orange">
          <div className="stat-icon-wrapper icon-orange">
            <i className="fas fa-undo-alt"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">DEVOLUÇÕES NO MÊS</span>
            <span className="stat-value">{contadores.devolucao}</span>
            <span className="stat-sub">Retornos previstos</span>
          </div>
        </div>

        <div className="stat-card-pro border-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-handshake"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">VISITAS & REUNIÕES</span>
            <span className="stat-value">{(contadores.visita || 0) + (contadores.reuniao || 0)}</span>
            <span className="stat-sub">Atendimentos no mês</span>
          </div>
        </div>

        <div className="stat-card-pro border-red">
          <div className="stat-icon-wrapper icon-red">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">CONFLITOS</span>
            <span className="stat-value" style={{ color: statsKPI.conflitos > 0 ? '#dc2626' : 'inherit' }}>
              {statsKPI.conflitos}
            </span>
            <span className="stat-sub">Sobreposição de horários</span>
          </div>
        </div>
      </div>

      {/* ── PAINEL DE FILTROS E BUSCA (PADRÃO OFICIAL CELEBRE) ── */}
      <div className="advanced-filter-bar agenda-filter-bar">
        <div className="filter-top-row">
          <div className="search-input-box">
            <i className="fas fa-search search-box-icon"></i>
            <input
              type="text"
              placeholder="Buscar por evento, cliente ou local..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="search-input-field"
            />
            {busca && (
              <button type="button" className="btn-clear-input" onClick={() => setBusca('')}>✕</button>
            )}
          </div>

          <div className="filter-controls-group">
            <div className="view-toggle-group">
              <button
                type="button"
                className={`btn-view-toggle ${viewPrincipal === 'calendario' ? 'active' : ''}`}
                onClick={() => setViewPrincipal('calendario')}
              >
                📅 Calendário
              </button>
              <button
                type="button"
                className={`btn-view-toggle ${viewPrincipal === 'lista' ? 'active' : ''}`}
                onClick={() => setViewPrincipal('lista')}
              >
                📋 Lista
              </button>
            </div>
          </div>
        </div>

        {/* 📱 GAVETA DE FILTROS INLINE NO PRÓPRIO LOCAL (EXCLUSIVO MOBILE) */}
        <div className="mobile-filter-accordion-box">
          <button
            type="button"
            className={`btn-trigger-gaveta-filtros ${gavetaFiltrosAberta ? 'aberta' : ''}`}
            onClick={() => setGavetaFiltrosAberta(!gavetaFiltrosAberta)}
            aria-expanded={gavetaFiltrosAberta}
          >
            <div className="trigger-gaveta-left">
              <span className={`trigger-icon-circle type-${filtroAtivo}`}>
                <i className={LISTA_FILTROS_AGENDA.find(f => f.id === filtroAtivo)?.icon || 'fas fa-layer-group'}></i>
              </span>
              <div className="trigger-text-group">
                <span className="trigger-subtitle">Filtrar Categoria</span>
                <span className="trigger-current-name">
                  {LISTA_FILTROS_AGENDA.find(f => f.id === filtroAtivo)?.label || 'Todos'}
                </span>
              </div>
            </div>
            <div className="trigger-gaveta-right">
              <span className={`trigger-count-badge ${(contadores[filtroAtivo] || 0) > 0 ? 'has-items' : ''}`}>
                {contadores[filtroAtivo] || 0}
              </span>
              <span className="trigger-chevron">
                <i className={`fas fa-chevron-${gavetaFiltrosAberta ? 'up' : 'down'}`}></i>
              </span>
            </div>
          </button>

          {/* 📂 CONTEÚDO DA GAVETA EXPANSÍVEL NO PRÓPRIO LOCAL */}
          {gavetaFiltrosAberta && (
            <div className="agenda-inline-gaveta-panel fade-in">
              <div className="agenda-inline-gaveta-grid">
                {LISTA_FILTROS_AGENDA.map(f => {
                  const isAtivo = filtroAtivo === f.id;
                  const qtd = contadores[f.id] || 0;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`agenda-inline-filter-btn type-${f.id} ${isAtivo ? 'ativo' : ''}`}
                      onClick={() => {
                        setFiltroAtivo(f.id);
                        setGavetaFiltrosAberta(false);
                      }}
                    >
                      <span className={`inline-btn-icon type-${f.id}`}>
                        <i className={f.icon}></i>
                      </span>
                      <span className="inline-btn-label">{f.label}</span>
                      <span className={`inline-btn-badge ${qtd > 0 ? 'has-items' : ''}`}>
                        {qtd}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="agenda-inline-gaveta-actions">
                {filtroAtivo !== 'todos' && (
                  <button
                    type="button"
                    className="btn-inline-limpar"
                    onClick={() => {
                      setFiltroAtivo('todos');
                      setGavetaFiltrosAberta(false);
                    }}
                  >
                    <i className="fas fa-undo"></i> Mostrar Todos
                  </button>
                )}
                <button
                  type="button"
                  className="btn-inline-fechar"
                  onClick={() => setGavetaFiltrosAberta(false)}
                >
                  <i className="fas fa-chevron-up"></i> Recolher
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 💻 PÍLULAS DE FILTRO EXCLUSIVAS PARA DESKTOP */}
        <div className="desktop-pills-only custom-scrollbar">
          {LISTA_FILTROS_AGENDA.map(f => (
            <button
              key={f.id}
              type="button"
              className={`agenda-filter-chip type-${f.id} ${filtroAtivo === f.id ? 'active' : ''}`}
              onClick={() => setFiltroAtivo(f.id)}
            >
              <span className="chip-icon-box">
                <i className={f.icon}></i>
              </span>
              <span className="chip-label">{f.label}</span>
              <span className={`chip-badge ${(contadores[f.id] || 0) > 0 ? 'has-items' : ''}`}>
                {contadores[f.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>


      {/* ── ÁREA PRINCIPAL: CALENDÁRIO + PAINEL DO DIA LADO A LADO ── */}
      <div className="agenda-main-area">
        {loadingFB ? (
          <div className="loading-agenda">Sincronizando compromissos...</div>
        ) : (
          renderConteudo()
        )}
      </div>

      {/* MODAL DE NOVO / EDITAR EVENTO */}
      {modalFormAberto && renderModalForm()}
    </div>
  );
};

export default Agenda;