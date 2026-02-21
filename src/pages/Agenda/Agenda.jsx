import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Agenda.css';

// ============================================================
// AGENDA v5.4 - NOVO FLUXO ADMINISTRATIVO (REUNIÕES, TAREFAS, ETC)
// ============================================================

const TIPOS = {
  // Automáticos do Sistema (Locações)
  entrega:   { label: 'Entrega',   cor: '#3b82f6', dot: 'blue'   },
  devolucao: { label: 'Devolução', cor: '#f97316', dot: 'orange' },
  
  // Manuais (Administrativo)
  reuniao:   { label: 'Reunião',   cor: '#8b5cf6', dot: 'purple' },
  visita:    { label: 'Visita Técnica', cor: '#22c55e', dot: 'green'  },
  pagamento: { label: 'Cobrança/Pgto', cor: '#eab308', dot: 'yellow' },
  tarefa:    { label: 'Tarefa Interna', cor: '#64748b', dot: 'gray'   },
  bloqueio:  { label: 'Bloqueio de Data', cor: '#ef4444', dot: 'red'    },
};

const FORM_VAZIO = {
  id: null, titulo: '', clienteId: '', clienteNome: '', tipo: 'reuniao',
  dataISO: '', horario: '', observacoes: '', recorrencia: 'nenhuma', origem: 'manual',
};

const isoParaDMA = (iso) => {
  if (!iso || typeof iso !== 'string') return null;
  const dataPura = iso.split('T')[0];
  const partes = dataPura.split('-');
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes.map(Number);
  if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return null;
  return { dia, mes: mes - 1, ano };
};

const dmaParaISO = (dia, mes, ano) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

const Agenda = () => {
  const [dataAtual, setDataAtual] = useState(new Date());
  
  const [viewPrincipal, setViewPrincipal] = useState('calendario'); 
  const [viewLista, setViewLista] = useState('semana');

  // Firebase Dados
  const [clientes, setClientes]   = useState([]);
  const [locacoes, setLocacoes]   = useState([]);
  const [compras, setCompras]     = useState([]);
  const [eventosManual, setEventosManual] = useState([]); 
  
  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: ''
  });

  const [loadingFB, setLoadingFB] = useState(true);
  const [salvando, setSalvando]   = useState(false); 

  const [toastMsg, setToastMsg] = useState('');

  const [filtroAtivo, setFiltroAtivo]     = useState('todos');
  const [busca, setBusca]                 = useState('');

  const [buscaFiltroCliente, setBuscaFiltroCliente] = useState('');
  const [mostrarDropdownCli, setMostrarDropdownCli] = useState(false);

  const [buscaClienteModal, setBuscaClienteModal] = useState('');
  const [mostrarDropdownModal, setMostrarDropdownModal] = useState(false);

  const [modalFormAberto, setModalFormAberto]     = useState(false);
  const [modalListaAberto, setModalListaAberto]   = useState(false);
  const [diaSelecionado, setDiaSelecionado]       = useState(null);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [formData, setFormData]                   = useState(FORM_VAZIO);

  const mostrarToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500); 
  };

  useEffect(() => {
    const carregarDados = async () => {
      setLoadingFB(true);

      try {
        const sc = await getDocs(collection(db, 'clientes'));
        setClientes(sc.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('Erro Clientes:', e); }

      try {
        const sl = await getDocs(collection(db, 'locacoes'));
        setLocacoes(sl.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('Erro Locações:', e); }

      try {
        const sco = await getDocs(collection(db, 'lista_compras'));
        setCompras(sco.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('Erro Compras:', e); }

      try {
        const sa = await getDocs(collection(db, 'agenda_eventos'));
        setEventosManual(sa.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        const backupLocal = JSON.parse(localStorage.getItem('agenda_eventos_v3')) || [];
        setEventosManual(backupLocal);
      }

      try {
        const snapConfig = await getDoc(doc(db, "sistema", "parametros"));
        if (snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeEmpresa || 'Ágape Decorações',
            logotipo: configData.logotipo || ''
          });
        }
      } catch (e) {
        console.error('Erro ao buscar dados da Empresa:', e);
      }

      setLoadingFB(false);
    };

    carregarDados();
  }, []);

  const eventosLocacao = useMemo(() => {
    const evs = [];
    locacoes.forEach(loc => {
      const nome = loc.clienteNome || 'Cliente';
      const num  = loc.numeroPedido ? `#${loc.numeroPedido}` : '';
      const base = {
        clienteId: loc.clienteId || '', clienteNome: nome,
        origem: 'locacao', locacaoId: loc.id,
        numeroPedido: loc.numeroPedido, tipoServico: loc.tipoServico,
        valorTotal: loc.valorTotal, valorPago: loc.valorPago, status: loc.status,
      };
      
      if (loc.dataRetirada) {
        const dma = isoParaDMA(loc.dataRetirada);
        const horarioExt = (typeof loc.dataRetirada === 'string' && loc.dataRetirada.includes('T')) ? loc.dataRetirada.split('T')[1].substring(0, 5) : '';
        if (dma) evs.push({ ...base, id: `loc-ent-${loc.id}`, tipo: 'entrega', titulo: `Entrega ${num} · ${nome}`, horario: horarioExt, ...dma });
      }
      if (loc.dataDevolucao) {
        const dma = isoParaDMA(loc.dataDevolucao);
        const horarioExt = (typeof loc.dataDevolucao === 'string' && loc.dataDevolucao.includes('T')) ? loc.dataDevolucao.split('T')[1].substring(0, 5) : '';
        if (dma) evs.push({ ...base, id: `loc-dev-${loc.id}`, tipo: 'devolucao', titulo: `Devolução ${num} · ${nome}`, horario: horarioExt, ...dma });
      }
    });
    return evs;
  }, [locacoes]);

  const todosEventos = useMemo(() => [...eventosManual, ...eventosLocacao], [eventosManual, eventosLocacao]);

  const getDiasNoMes       = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getDiaSemanaInicio = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const nomeMes = dataAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const eventoVisivel = (ev) =>
    (filtroAtivo === 'todos' || filtroAtivo === 'compras' || ev.tipo === filtroAtivo) &&
    (!busca.trim() || (ev.titulo || '').toLowerCase().includes(busca.toLowerCase()) || (ev.clienteNome || '').toLowerCase().includes(busca.toLowerCase()));

  const eventosMesAtual = useMemo(() => todosEventos.filter(e => e.mes === dataAtual.getMonth() && e.ano === dataAtual.getFullYear()), [todosEventos, dataAtual]);

  const contadores = useMemo(() => {
    const c = { todos: 0, entrega: 0, devolucao: 0, visita: 0, bloqueio: 0, reuniao: 0, pagamento: 0, tarefa: 0 };
    eventosMesAtual.forEach(e => { c[e.tipo] = (c[e.tipo] || 0) + 1; c.todos++; });
    return c;
  }, [eventosMesAtual]);

  const hojeISO = new Date().toISOString().split('T')[0];
  const comprasPendentes = useMemo(() => compras.filter(c => c.status !== 'comprado').sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999')), [compras]);
  const comprasUrgentes = comprasPendentes.filter(c => c.prazo && c.prazo <= hojeISO).length;

  const eventosDoDia = (dia, mesOv, anoOv) => {
    const m = mesOv !== undefined ? mesOv : dataAtual.getMonth();
    const a = anoOv !== undefined ? anoOv : dataAtual.getFullYear();
    return todosEventos.filter(e => e.dia === dia && e.mes === m && e.ano === a);
  };

  const handleDiaClick = (dia) => {
    const evs = eventosDoDia(dia);
    if (evs.length > 0) { setDiaSelecionado(dia); setModalListaAberto(true); }
    else abrirModalForm(dia);
  };

  const abrirModalForm = (dia, ev = null) => {
    setModalListaAberto(false);
    if (ev) {
      setEventoSelecionado(ev);
      const anoEv = ev.ano || dataAtual.getFullYear();
      const mesEv = ev.mes !== undefined ? ev.mes : dataAtual.getMonth();
      setFormData({ ...FORM_VAZIO, ...ev, dataISO: dmaParaISO(ev.dia, mesEv, anoEv) });
      setBuscaClienteModal(ev.clienteNome || ''); 
    } else {
      setEventoSelecionado(null);
      setFormData({ ...FORM_VAZIO, dataISO: dmaParaISO(dia, dataAtual.getMonth(), dataAtual.getFullYear()) });
      setBuscaClienteModal(''); 
    }
    setModalFormAberto(true);
  };

  const salvarEvento = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const [anoStr, mesStr, diaStr] = formData.dataISO.split('-');
    const cli = clientes.find(c => c.id === formData.clienteId || (c.nome || c.nomeFantasia) === buscaClienteModal);
    
    const evParaSalvar = {
      titulo: formData.titulo, clienteId: cli ? cli.id : '', clienteNome: cli ? (cli.nome || cli.nomeFantasia) : buscaClienteModal,
      tipo: formData.tipo, horario: formData.horario, observacoes: formData.observacoes, origem: 'manual',
      dia: parseInt(diaStr), mes: parseInt(mesStr) - 1, ano: parseInt(anoStr),
    };

    try {
      if (eventoSelecionado) {
        const docRef = doc(db, 'agenda_eventos', eventoSelecionado.id);
        await updateDoc(docRef, evParaSalvar);
        setEventosManual(prev => prev.map(x => x.id === eventoSelecionado.id ? { id: eventoSelecionado.id, ...evParaSalvar } : x));
        mostrarToast('✅ Evento atualizado com sucesso!');
      } else {
        let evsCriados = [];
        const docRef = await addDoc(collection(db, 'agenda_eventos'), evParaSalvar);
        evsCriados.push({ id: docRef.id, ...evParaSalvar });

        if (formData.recorrencia !== 'nenhuma') {
          for (let i = 1; i <= 3; i++) {
            const d = new Date(evParaSalvar.ano, evParaSalvar.mes + (formData.recorrencia === 'mensal' ? i : 0), formData.recorrencia === 'semanal' ? evParaSalvar.dia + (i * 7) : evParaSalvar.dia);
            const repEv = { ...evParaSalvar, dia: d.getDate(), mes: d.getMonth(), ano: d.getFullYear() };
            const repRef = await addDoc(collection(db, 'agenda_eventos'), repEv);
            evsCriados.push({ id: repRef.id, ...repEv });
          }
        }
        setEventosManual(prev => [...prev, ...evsCriados]);
        mostrarToast('✨ Novo agendamento salvo!');
      }
      setModalFormAberto(false);
    } catch (err) {
      console.error(err); 
      const novaLista = eventoSelecionado 
        ? eventosManual.map(x => x.id === eventoSelecionado.id ? {id: eventoSelecionado.id, ...evParaSalvar} : x)
        : [...eventosManual, {id: Date.now().toString(), ...evParaSalvar}];
      setEventosManual(novaLista);
      localStorage.setItem('agenda_eventos_v3', JSON.stringify(novaLista));
      mostrarToast('⚠️ Salvo localmente.');
      setModalFormAberto(false);
    } finally { setSalvando(false); }
  };

  const excluirEvento = async () => {
    if (formData.origem === 'locacao') return;
    if (window.confirm('Tem certeza que deseja apagar este evento?')) {
      setSalvando(true);
      try {
        await deleteDoc(doc(db, 'agenda_eventos', formData.id));
        setEventosManual(prev => prev.filter(x => x.id !== formData.id));
        mostrarToast('🗑️ Evento apagado.');
        setModalFormAberto(false);
      } catch (err) {
        console.error(err);
        const novaLista = eventosManual.filter(x => x.id !== formData.id);
        setEventosManual(novaLista);
        localStorage.setItem('agenda_eventos_v3', JSON.stringify(novaLista));
        mostrarToast('🗑️ Evento apagado localmente.');
        setModalFormAberto(false);
      } finally { setSalvando(false); }
    }
  };

  const exportarPDF = () => {
    try {
      const docPDF = new jsPDF();
      let listaExportacao = [];
      let tituloRelatorio = '';
      let subtituloRelatorio = '';

      if (filtroAtivo === 'compras') {
        tituloRelatorio = 'Lista de Compras Pendentes';
        subtituloRelatorio = `${comprasPendentes.length} itens aguardando compra`;
        listaExportacao = comprasPendentes.map(c => [
          c.nome || '-',
          c.quantidade || '1',
          c.valorEstimado ? `R$ ${Number(c.valorEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-',
          c.prazo ? new Date(c.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : '-',
          c.vinculo || '-'
        ]);

      } else {
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
          const strInicio = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          const strFim = fim.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
          tituloRelatorio = `Agenda da Semana: ${strInicio} a ${strFim}`;

        } else if (viewPrincipal === 'lista' && viewLista === 'dia') {
          eventosFiltrados = eventosDoDia(dataAtual.getDate()).filter(eventoVisivel);
          tituloRelatorio = `Agenda do Dia: ${dataAtual.toLocaleDateString('pt-BR')}`;
          
        } else if (viewPrincipal === 'lista' && viewLista === 'ano') {
          eventosFiltrados = todosEventos.filter(e => e.ano === dataAtual.getFullYear() && eventoVisivel(e));
          tituloRelatorio = `Agenda Anual: ${dataAtual.getFullYear()}`;
        }

        listaExportacao = eventosFiltrados
          .sort((a, b) => {
            if (a.ano !== b.ano) return a.ano - b.ano;
            if (a.mes !== b.mes) return a.mes - b.mes;
            if (a.dia !== b.dia) return a.dia - b.dia;
            return (a.horario || '99:99').localeCompare(b.horario || '99:99');
          })
          .map(e => [
            `${String(e.dia).padStart(2, '0')}/${String(e.mes + 1).padStart(2, '0')}`,
            e.horario || '--:--',
            TIPOS[e.tipo]?.label || '',
            e.titulo || '',
            e.clienteNome || 'Não informado'
          ]);
      }

      let startY = 35; 
      let startXTexto = 14;

      if (dadosEmpresa.logotipo && dadosEmpresa.logotipo.startsWith('data:image')) {
        try {
          docPDF.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 25, 25);
          startXTexto = 45;
        } catch(e) { console.error('Erro ao renderizar Logo no PDF'); }
      }

      docPDF.setFontSize(22);
      docPDF.setTextColor(15, 23, 42); 
      docPDF.setFont("helvetica", "bold");
      docPDF.text(dadosEmpresa.nomeEmpresa.toUpperCase(), startXTexto, 22);

      docPDF.setFontSize(10);
      docPDF.setTextColor(150, 150, 150);
      docPDF.setFont("helvetica", "normal");
      docPDF.text("DEPARTAMENTO DE LOGÍSTICA / AGENDA", startXTexto, 28);

      docPDF.setFontSize(14);
      docPDF.setTextColor(0, 0, 0);
      docPDF.setFont("helvetica", "bold");
      docPDF.text(tituloRelatorio, 14, 45);

      docPDF.setFontSize(9);
      docPDF.setTextColor(100);
      docPDF.setFont("helvetica", "normal");
      docPDF.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 51);
      
      if (subtituloRelatorio) {
        docPDF.text(subtituloRelatorio, 14, 56);
        startY = 65;
      } else {
        startY = 60;
      }

      docPDF.setLineWidth(0.5);
      docPDF.setDrawColor(200, 200, 200);
      docPDF.line(14, startY - 4, 196, startY - 4);

      let colunasDef = [["Data", "Horário", "Tipo", "Título do Evento", "Cliente"]];
      if (filtroAtivo === 'compras') {
        colunasDef = [["Item", "Qtd", "Valor Est.", "Prazo", "Referência / Vínculo"]];
      }

      autoTable(docPDF, {
        startY: startY,
        head: colunasDef,
        body: listaExportacao,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' }, 
        styles: { fontSize: 9, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const nomeArquivoSafe = dadosEmpresa.nomeEmpresa.replace(/[^a-z0-9]/gi, '_');
      docPDF.save(`${nomeArquivoSafe}_${tituloRelatorio.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      mostrarToast('📄 PDF gerado com sucesso!');
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      mostrarToast('❌ Erro ao gerar o arquivo PDF.');
    }
  };

  const mudarAno = (dir) => { const d = new Date(dataAtual); d.setFullYear(dataAtual.getFullYear() + dir); setDataAtual(d); };
  const mudarMes = (dir) => { const d = new Date(dataAtual); d.setMonth(dataAtual.getMonth() + dir); setDataAtual(d); };
  const mudarDia = (dir) => { const d = new Date(dataAtual); d.setDate(dataAtual.getDate() + dir); setDataAtual(d); };
  const mudarSemana = (dir) => { const d = new Date(dataAtual); d.setDate(dataAtual.getDate() + dir * 7); setDataAtual(d); };

  // ══════════════════════════════════════════════════════════
  // RENDERS DOS COMPONENTES VISUAIS
  // ══════════════════════════════════════════════════════════

  const renderCardEvento = (ev) => {
    const saldo = ev.origem === 'locacao' ? Number(ev.valorTotal || 0) - Number(ev.valorPago || 0) : null;
    return (
      <div key={ev.id} className={`list-item-card${ev.origem === 'locacao' ? ' card-locacao' : ''}`} onClick={() => abrirModalForm(ev.dia, ev)}>
        <div className="list-left-bar" style={{ backgroundColor: TIPOS[ev.tipo]?.cor }} />
        <div className="list-info">
          <div className="list-item-header">
            <h4>{ev.titulo}</h4>
            {ev.horario && <span className="list-horario">🕐 {ev.horario}</span>}
            {ev.origem === 'locacao' && <span className="badge-locacao-origem">🔗 Locação</span>}
          </div>
          {ev.clienteNome && <span className="list-cliente">👤 {ev.clienteNome}</span>}
          {ev.tipoServico  && <span className="list-obs">📦 {ev.tipoServico}</span>}
          {ev.observacoes  && <span className="list-obs">📝 {ev.observacoes}</span>}
          {saldo !== null && Number(ev.valorTotal) > 0 && (
            <span className="list-financeiro">
              💰 R$ {Number(ev.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ·{' '}
              {saldo > 0 ? <span className="saldo-devedor">Falta R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> : <span className="saldo-pago">✅ Pago</span>}
            </span>
          )}
        </div>
        <span className={`list-tipo-badge badge-${ev.tipo}`}>{TIPOS[ev.tipo]?.label}</span>
      </div>
    );
  };

  const renderCalendario = () => {
    const totalDias = getDiasNoMes(dataAtual);
    const diaInicio = getDiaSemanaInicio(dataAtual);
    const hojeD = new Date();
    const MAX = 3;
    const dias = [];
    for (let i = 0; i < diaInicio; i++) dias.push(<div key={`e${i}`} className="day-cell empty" />);
    for (let dia = 1; dia <= totalDias; dia++) {
      const evsDia = eventosDoDia(dia).filter(eventoVisivel);
      const isHoje = hojeD.getDate() === dia && hojeD.getMonth() === dataAtual.getMonth() && hojeD.getFullYear() === dataAtual.getFullYear();
      const extra  = evsDia.length - MAX;
      dias.push(
        <div key={dia} className={`day-cell${isHoje ? ' today' : ''}`} onClick={() => handleDiaClick(dia)}>
          <span className="day-number">{dia}</span>
          <div className="eventos-container">
            {evsDia.slice(0, MAX).map(ev => (
              <div key={ev.id} className={`event-tag tag-${ev.tipo}${ev.origem === 'locacao' ? ' tag-locacao-origem' : ''}`} onClick={e => { e.stopPropagation(); abrirModalForm(dia, ev); }}>
                {ev.horario && <span className="event-time">{ev.horario}</span>}
                <span className="event-titulo">{ev.titulo}</span>
              </div>
            ))}
            {extra > 0 && <div className="event-tag tag-mais" onClick={e => { e.stopPropagation(); setDiaSelecionado(dia); setModalListaAberto(true); }}>+{extra} mais</div>}
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="calendar-grid-header">
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} className="weekday-header">{d}</div>)}
        </div>
        <div className="calendar-grid">{dias}</div>
      </>
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

  const renderCompras = () => {
    if (comprasPendentes.length === 0) return <div className="vista-vazia">✅ Nenhuma compra pendente!</div>;
    return (
      <div className="list-view-container">
        <div className="compras-legenda">
          <span className="compra-badge urgente">🚨 Urgente</span> prazo vencido ·
          <span className="compra-badge normal" style={{marginLeft:8}}>📅 Pendente</span> a comprar
        </div>
        {comprasPendentes.map(c => {
          const urgente = c.prazo && c.prazo <= hojeISO;
          const subtotal = (Number(c.quantidade) || 1) * (Number(c.valorEstimado) || 0);
          return (
            <div key={c.id} className={`compra-card${urgente ? ' compra-card-urgente' : ''}`}>
              <div className="compra-card-left">
                <div className={`compra-urgencia-bar ${urgente ? 'urgente' : 'normal'}`} />
                <div className="compra-info">
                  <div className="compra-header">
                    <span className="compra-nome">{c.nome}</span>
                    {urgente && <span className="compra-badge urgente">🚨 URGENTE</span>}
                  </div>
                  <div className="compra-meta">
                    {c.vinculo && <span>🔗 {c.vinculo}</span>}
                    {c.quantidade && <span>📦 Qtd: {c.quantidade}</span>}
                    {subtotal > 0 && <span>💰 R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                    {c.prazo && <span className={urgente ? 'prazo-urgente' : ''}>{urgente ? '🚨' : '📅'} Prazo: {new Date(c.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHeader = () => {
    const btnNav = (label, onClick) => <button className="btn-nav" onClick={onClick}>{label}</button>;
    let titulo = ''; let navEsq, navDir;

    if (filtroAtivo === 'compras') {
      titulo = 'Lista de Compras'; 
      navEsq = () => {}; navDir = () => {};
    } else if (viewPrincipal === 'calendario') {
      titulo = nomeMes; navEsq = () => mudarMes(-1); navDir = () => mudarMes(1);
    } else {
      if (viewLista === 'ano') {
        titulo = dataAtual.getFullYear().toString();
        navEsq = () => mudarAno(-1); navDir = () => mudarAno(1);
      } else if (viewLista === 'mes') {
        titulo = nomeMes; navEsq = () => mudarMes(-1); navDir = () => mudarMes(1);
      } else if (viewLista === 'semana') {
        const hojeD = new Date(dataAtual);
        const dom = new Date(hojeD.getFullYear(), hojeD.getMonth(), hojeD.getDate() - hojeD.getDay());
        const sab = new Date(dom.getFullYear(), dom.getMonth(), dom.getDate() + 6);
        titulo = `${dom.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${sab.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        navEsq = () => mudarSemana(-1); navDir = () => mudarSemana(1);
      } else if (viewLista === 'dia') {
        titulo = dataAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        navEsq = () => mudarDia(-1); navDir = () => mudarDia(1);
      }
    }

    return (
      <div className="agenda-header">
        <div className="nav-datas">
          {filtroAtivo !== 'compras' && btnNav('◀', navEsq)}
          <span className="mes-ano-titulo">{titulo}</span>
          {filtroAtivo !== 'compras' && btnNav('▶', navDir)}
          {filtroAtivo !== 'compras' && <button className="btn-nav btn-hoje" onClick={() => setDataAtual(new Date())}>Hoje</button>}
        </div>

        <div className="header-right">
          <div className="view-switcher-wrapper">
            <div className="view-switcher primary">
              <button className={`view-btn ${viewPrincipal === 'calendario' ? 'active' : ''}`} onClick={() => {setViewPrincipal('calendario'); setFiltroAtivo('todos');}}>
                📅 Calendário
              </button>
              <button className={`view-btn ${viewPrincipal === 'lista' ? 'active' : ''}`} onClick={() => {setViewPrincipal('lista'); setFiltroAtivo('todos');}}>
                📝 Lista
              </button>
            </div>

            {viewPrincipal === 'lista' && filtroAtivo !== 'compras' && (
              <div className="view-switcher secondary fade-in">
                <button className={`view-btn sub-btn ${viewLista === 'ano' ? 'active' : ''}`} onClick={() => setViewLista('ano')}>Ano</button>
                <button className={`view-btn sub-btn ${viewLista === 'mes' ? 'active' : ''}`} onClick={() => setViewLista('mes')}>Mês</button>
                <button className={`view-btn sub-btn ${viewLista === 'semana' ? 'active' : ''}`} onClick={() => setViewLista('semana')}>Semana</button>
                <button className={`view-btn sub-btn ${viewLista === 'dia' ? 'active' : ''}`} onClick={() => setViewLista('dia')}>Dia</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderConteudo = () => {
    if (filtroAtivo === 'compras') return renderCompras();
    if (viewPrincipal === 'calendario') return renderCalendario();

    switch (viewLista) {
      case 'ano':      return renderAno();
      case 'mes':      return renderMes();
      case 'semana':   return renderSemana();
      case 'dia':      return renderDia();
      default:         return renderMes();
    }
  };

  // 🚨 O NOVO MODAL ESTÁ AQUI (COM OS NOVOS TIPOS) 🚨
  const renderModalForm = () => {
    const ehLocacao = formData.origem === 'locacao';
    const saldo = ehLocacao ? Number(formData.valorTotal || 0) - Number(formData.valorPago || 0) : 0;

    return (
      <div className="modal-overlay" onClick={() => !salvando && setModalFormAberto(false)}>
        <div className="modal-content modal-form-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{ehLocacao ? '🔗 Detalhe da Locação' : (eventoSelecionado ? '✏️ Editar Compromisso' : '➕ Novo Compromisso')}</h3>
            <button className="btn-close" onClick={() => !salvando && setModalFormAberto(false)}>×</button>
          </div>

          {ehLocacao ? (
            <div className="locacao-detalhe">
              <div className="locacao-detalhe-row"><span>Cliente</span><strong>👤 {formData.clienteNome}</strong></div>
              <div className="locacao-detalhe-row"><span>Pedido</span><strong>#{formData.numeroPedido || '-'}</strong></div>
              {formData.tipoServico && <div className="locacao-detalhe-row"><span>Modalidade</span><strong>{formData.tipoServico}</strong></div>}
              <div className="locacao-detalhe-row"><span>Evento</span><span className={`list-tipo-badge badge-${formData.tipo}`}>{TIPOS[formData.tipo]?.label}</span></div>
              {formData.status && <div className="locacao-detalhe-row"><span>Status</span><strong className={`status-locacao ${formData.status}`}>{formData.status.toUpperCase()}</strong></div>}
              {Number(formData.valorTotal) > 0 && (
                <div className="locacao-detalhe-financeiro">
                  <div className="fin-row"><span>Total</span><strong>R$ {Number(formData.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                  <div className="fin-row"><span>Pago</span><strong style={{ color: '#22c55e' }}>R$ {Number(formData.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                  <div className="fin-row fin-saldo"><span>Saldo</span><strong style={{ color: saldo > 0 ? '#ef4444' : '#22c55e' }}>{saldo > 0 ? `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a receber` : '✅ Pago'}</strong></div>
                </div>
              )}
              <p className="locacao-aviso">⚠️ Entregas e Devoluções só podem ser alteradas na tela de Locações.</p>
            </div>
          ) : (
            <form onSubmit={salvarEvento} className="modal-form">
              <div className="form-row">
                <div className="form-group"><label>Data *</label><input type="date" value={formData.dataISO} onChange={e => setFormData({ ...formData, dataISO: e.target.value })} required disabled={salvando}/></div>
                <div className="form-group"><label>Horário</label><input type="time" value={formData.horario} onChange={e => setFormData({ ...formData, horario: e.target.value })} disabled={salvando}/></div>
              </div>
              <div className="form-group"><label>Título do Compromisso *</label><input autoFocus type="text" value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} placeholder="Ex: Reunião de alinhamento com a noiva" required disabled={salvando}/></div>
              
              <div className="form-group">
                <label>Vincular a um Cliente <span className="label-hint">(Opcional)</span></label>
                <div className="custom-autocomplete-container">
                  <input
                    type="text"
                    placeholder="Digitar nome do cliente..."
                    value={buscaClienteModal}
                    onFocus={() => setMostrarDropdownModal(true)}
                    onChange={(e) => {
                      setBuscaClienteModal(e.target.value);
                      if (e.target.value === '') setFormData({...formData, clienteId: ''});
                    }}
                    disabled={salvando}
                    className="modal-input"
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
                          <li style={{ color: 'var(--texto-secundario)', cursor: 'default' }}>Manter como nome avulso: "{buscaClienteModal}"</li>
                        )}
                    </ul>
                  )}
                  {mostrarDropdownModal && <div className="autocomplete-overlay" onClick={() => setMostrarDropdownModal(false)} />}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de Tarefa</label>
                  <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} disabled={salvando}>
                    <option value="reuniao">🤝 Reunião com Cliente</option>
                    <option value="visita">📍 Visita Técnica / Local</option>
                    <option value="pagamento">💰 Lembrete Financeiro</option>
                    <option value="tarefa">📌 Tarefa Administrativa</option>
                    <option value="bloqueio">🚫 Bloqueio de Data (Não alugar)</option>
                  </select>
                </div>
                {!eventoSelecionado && (
                  <div className="form-group">
                    <label>Repetir Lembrete</label>
                    <select value={formData.recorrencia} onChange={e => setFormData({ ...formData, recorrencia: e.target.value })} disabled={salvando}>
                      <option value="nenhuma">Apenas nesta data</option>
                      <option value="semanal">Semanalmente (3x)</option>
                      <option value="mensal">Mensalmente (3x)</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Detalhes Adicionais</label>
                <textarea 
                  value={formData.observacoes} 
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })} 
                  placeholder="Endereço do local, links de inspiração, valores a cobrar..." 
                  rows={3} 
                  disabled={salvando}
                />
              </div>
              <div className="modal-actions">
                {eventoSelecionado && <button type="button" className="btn-excluir-modal" onClick={excluirEvento} disabled={salvando}>🗑️ Apagar</button>}
                <button type="button" className="btn-cancelar-modal" onClick={() => setModalFormAberto(false)} disabled={salvando}>Cancelar</button>
                <button type="submit" className="btn-salvar-modal" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Compromisso'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="agenda-container">
      {toastMsg && (
        <div className="toast-mensagem fade-in">
          {toastMsg}
        </div>
      )}

      {/* 🚨 SIDEBAR ATUALIZADA COM OS NOVOS FILTROS 🚨 */}
      <div className="agenda-sidebar">
        <button className="btn-novo-agendamento" onClick={() => abrirModalForm(new Date().getDate())}>
          + Novo Compromisso
        </button>

        <div className="busca-box">
          <span className="busca-icon">🔍</span>
          <input type="text" placeholder="Buscar cliente ou título..." value={busca} onChange={e => setBusca(e.target.value)} className="busca-input" />
          {busca && <button className="busca-clear" onClick={() => setBusca('')}>×</button>}
        </div>

        <div className="filtro-box">
          <div className="filtro-item" onClick={() => {setFiltroAtivo('todos'); if(viewPrincipal === 'calendario' && filtroAtivo === 'compras') setViewPrincipal('lista'); }} style={{marginBottom: '15px'}}>
            <span className="dot gray" />
            <span style={{ flex: 1 }}>Mostrar Tudo</span>
          </div>

          <div className="filtro-titulo">Entregas do Sistema</div>
          {[
            ['entrega',  'blue',   'Entregas',   contadores.entrega],
            ['devolucao','orange', 'Devoluções', contadores.devolucao],
          ].map(([tipo, cor, label, count]) => (
            <div key={tipo} className={`filtro-item${filtroAtivo === tipo ? ' ativo' : ''}`} onClick={() => {setFiltroAtivo(tipo); if(viewPrincipal === 'calendario' && tipo === 'compras') setViewPrincipal('lista'); }}>
              <span className={`dot ${cor}`} />
              <span style={{ flex: 1 }}>{label}</span>
              {count > 0 && <span className="filtro-contador">{count}</span>}
            </div>
          ))}

          <div className="filtro-titulo" style={{marginTop: '15px'}}>Compromissos Manuais</div>
          {[
            ['reuniao',  'purple', 'Reuniões',       contadores.reuniao],
            ['visita',   'green',  'Visitas Técnicas',  contadores.visita],
            ['pagamento','yellow', 'Cobranças/Pagamento', contadores.pagamento],
            ['tarefa',   'gray',   'Tarefas Internas',   contadores.tarefa],
            ['bloqueio', 'red',    'Bloqueios',      contadores.bloqueio],
          ].map(([tipo, cor, label, count]) => (
            <div key={tipo} className={`filtro-item${filtroAtivo === tipo ? ' ativo' : ''}`} onClick={() => {setFiltroAtivo(tipo); if(viewPrincipal === 'calendario' && tipo === 'compras') setViewPrincipal('lista'); }}>
              <span className={`dot ${cor}`} />
              <span style={{ flex: 1 }}>{label}</span>
              {count > 0 && <span className="filtro-contador">{count}</span>}
            </div>
          ))}

          <div className="filtro-titulo" style={{marginTop: '15px'}}>Estoque & Logística</div>
          <div className={`filtro-item filtro-compras${filtroAtivo === 'compras' ? ' ativo' : ''}`} onClick={() => {setFiltroAtivo('compras'); setViewPrincipal('lista');}}>
            <span className="dot dot-compras" />
            <span style={{ flex: 1 }}>Compras</span>
            {comprasPendentes.length > 0 && (
              <span className={`filtro-contador${comprasUrgentes > 0 ? ' contador-urgente' : ''}`}>
                {comprasUrgentes > 0 ? `🚨 ${comprasPendentes.length}` : comprasPendentes.length}
              </span>
            )}
          </div>
        </div>

        <button className="btn-exportar" onClick={exportarPDF}>📄 Exportar PDF</button>
      </div>

      <div className="agenda-main">
        {renderHeader()}
        {loadingFB ? <div className="loading-agenda">Buscando dados na nuvem...</div> : renderConteudo()}
      </div>

      {modalListaAberto && (
        <div className="modal-overlay" onClick={() => setModalListaAberto(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📅 {diaSelecionado} de {dataAtual.toLocaleString('pt-BR', { month: 'long' })}</h3>
              <button className="btn-close" onClick={() => setModalListaAberto(false)}>×</button>
            </div>
            <div className="modal-lista-items">
              {eventosDoDia(diaSelecionado).sort((a, b) => (a.horario || '99:99').localeCompare(b.horario || '99:99')).map(ev => (
                <div key={ev.id} className={`item-detalhe-card ${ev.tipo}${ev.origem === 'locacao' ? ' card-locacao' : ''}`} onClick={() => abrirModalForm(diaSelecionado, ev)}>
                  <div className="detalhe-info">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {ev.horario && <span className="detalhe-horario">{ev.horario}</span>}
                      <h4>{ev.titulo}</h4>
                      {ev.origem === 'locacao' && <span className="badge-locacao-origem">🔗</span>}
                    </div>
                    {ev.clienteNome && <span>👤 {ev.clienteNome}</span>}
                    {ev.tipoServico  && <span style={{ fontSize: '0.78rem' }}>📦 {ev.tipoServico}</span>}
                  </div>
                  <span className={`list-tipo-badge badge-${ev.tipo}`}>{TIPOS[ev.tipo]?.label}</span>
                </div>
              ))}
            </div>
            <button className="btn-add-no-dia" onClick={() => abrirModalForm(diaSelecionado)}>+ Adicionar compromisso</button>
          </div>
        </div>
      )}

      {modalFormAberto && renderModalForm()}
    </div>
  );
};

export default Agenda;