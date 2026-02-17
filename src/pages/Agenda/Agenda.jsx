import React, { useState, useEffect } from 'react';
import './Agenda.css';

const Agenda = () => {
  const [dataAtual, setDataAtual] = useState(new Date());
  const [modoVisualizacao, setModoVisualizacao] = useState('calendario');
  const [eventos, setEventos] = useState([]);
  
  // MODAIS
  const [modalFormAberto, setModalFormAberto] = useState(false);
  const [modalListaAberto, setModalListaAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  
  const [formData, setFormData] = useState({ titulo: '', cliente: '', tipo: 'entrega', dataISO: '' });

  // --- NOVA LÓGICA DE FILTRO (SELEÇÃO ÚNICA) ---
  // Opções: 'todos', 'entrega', 'devolucao', 'visita', 'bloqueio'
  const [filtroAtivo, setFiltroAtivo] = useState('todos');

  useEffect(() => {
    const dadosSalvos = JSON.parse(localStorage.getItem('agenda_eventos')) || [];
    setEventos(dadosSalvos);
  }, []);

  // Função auxiliar para verificar se o evento passa no filtro
  const eventoVisivel = (evento) => {
    if (filtroAtivo === 'todos') return true;
    return evento.tipo === filtroAtivo;
  };

  // --- OPERAÇÕES DE CALENDÁRIO ---
  const handleDiaClick = (dia) => {
    // Busca eventos do dia (Respeitando o filtro? Vamos deixar o calendário mostrar TUDO para não perder datas)
    // Se quiser que o calendário TAMBÉM filtre, adicione && eventoVisivel(e) abaixo.
    // Por padrão de usabilidade, calendário costuma mostrar tudo, mas a lista filtra.
    
    const eventosDoDia = eventos.filter(e => {
      const eMes = e.mes !== undefined ? e.mes : dataAtual.getMonth();
      const eAno = e.ano !== undefined ? e.ano : dataAtual.getFullYear();
      return e.dia === dia && eMes === dataAtual.getMonth() && eAno === dataAtual.getFullYear();
    });

    if (eventosDoDia.length > 0) {
      setDiaSelecionado(dia);
      setModalListaAberto(true);
    } else {
      abrirModalForm(dia);
    }
  };

  // --- FORMATADORES ---
  const formatarDataParaInput = (dia, mes, ano) => {
    const sAno = String(ano);
    const sMes = String(mes + 1).padStart(2, '0');
    const sDia = String(dia).padStart(2, '0');
    return `${sAno}-${sMes}-${sDia}`;
  };

  // --- OPERAÇÕES DE MODAL ---
  const abrirModalForm = (dia, eventoExistente = null) => {
    setModalListaAberto(false);
    if (eventoExistente) {
      setEventoSelecionado(eventoExistente);
      const anoEv = eventoExistente.ano || dataAtual.getFullYear();
      const mesEv = eventoExistente.mes !== undefined ? eventoExistente.mes : dataAtual.getMonth();
      const diaEv = eventoExistente.dia;
      setFormData({ ...eventoExistente, dataISO: formatarDataParaInput(diaEv, mesEv, anoEv) });
    } else {
      setEventoSelecionado(null);
      const anoAtual = dataAtual.getFullYear();
      const mesAtual = dataAtual.getMonth();
      setFormData({ 
        id: Date.now(), titulo: '', cliente: '', tipo: 'entrega',
        dataISO: formatarDataParaInput(dia, mesAtual, anoAtual)
      });
    }
    setModalFormAberto(true);
  };

  const salvarEvento = (e) => {
    e.preventDefault();
    const [anoStr, mesStr, diaStr] = formData.dataISO.split('-');
    const eventoPronto = {
      ...formData,
      dia: parseInt(diaStr),
      mes: parseInt(mesStr) - 1,
      ano: parseInt(anoStr)
    };
    let novaLista;
    if (eventoSelecionado) {
      novaLista = eventos.map(ev => ev.id === eventoSelecionado.id ? eventoPronto : ev);
    } else {
      novaLista = [...eventos, eventoPronto];
    }
    setEventos(novaLista);
    localStorage.setItem('agenda_eventos', JSON.stringify(novaLista));
    setModalFormAberto(false);
  };

  const excluirEvento = () => {
    if (window.confirm("Tem certeza?")) {
      const novaLista = eventos.filter(ev => ev.id !== formData.id);
      setEventos(novaLista);
      localStorage.setItem('agenda_eventos', JSON.stringify(novaLista));
      setModalFormAberto(false);
    }
  };

  // --- NAVEGAÇÃO ---
  const mudarMes = (direcao) => {
    const novaData = new Date(dataAtual);
    novaData.setMonth(dataAtual.getMonth() + direcao);
    setDataAtual(novaData);
  };

  const getDiasNoMes = (data) => new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  const getDiaSemanaInicio = (data) => new Date(data.getFullYear(), data.getMonth(), 1).getDay();
  const nomeMes = dataAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // --- RENDERIZADORES ---
  const renderCalendario = () => {
    const totalDias = getDiasNoMes(dataAtual);
    const diaInicio = getDiaSemanaInicio(dataAtual);
    const dias = [];
    for (let i = 0; i < diaInicio; i++) dias.push(<div key={`empty-${i}`} className="day-cell empty"></div>);

    for (let dia = 1; dia <= totalDias; dia++) {
      // CALENDÁRIO: Mostra tudo (para visão geral)
      const eventosDoDia = eventos.filter(e => {
        const eMes = e.mes !== undefined ? e.mes : dataAtual.getMonth();
        const eAno = e.ano !== undefined ? e.ano : dataAtual.getFullYear();
        return e.dia === dia && eMes === dataAtual.getMonth() && eAno === dataAtual.getFullYear();
      });
      
      const isHoje = new Date().getDate() === dia && new Date().getMonth() === dataAtual.getMonth();

      dias.push(
        <div key={dia} className={`day-cell ${isHoje ? 'today' : ''}`} onClick={() => handleDiaClick(dia)}>
          <span className="day-number">{dia}</span>
          <div className="eventos-container">
            {eventosDoDia.map(evento => (
              // As tags no calendário ficam meio transparentes se não forem do filtro ativo
              <div 
                key={evento.id} 
                className={`event-tag tag-${evento.tipo}`}
                style={{ opacity: eventoVisivel(evento) ? 1 : 0.3 }} 
                onClick={(e) => { e.stopPropagation(); abrirModalForm(dia, evento); }}
              >
                {evento.titulo}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return <><div className="calendar-grid-header">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="weekday-header">{d}</div>)}</div><div className="calendar-grid">{dias}</div></>;
  };

  const renderListaGeral = () => {
    // LISTA: APLICA O FILTRO RIGOROSAMENTE
    const eventosFiltradosLista = eventos.filter(e => {
      const eMes = e.mes !== undefined ? e.mes : dataAtual.getMonth();
      const eAno = e.ano !== undefined ? e.ano : dataAtual.getFullYear();
      const dataBate = eMes === dataAtual.getMonth() && eAno === dataAtual.getFullYear();
      return dataBate && eventoVisivel(e); // Aplica o filtro aqui!
    }).sort((a, b) => a.dia - b.dia);

    if (eventosFiltradosLista.length === 0) return <div style={{padding:'20px', color:'#64748b'}}>Nenhum evento encontrado para esta categoria.</div>;

    return (
      <div className="list-view-container">
        {eventosFiltradosLista.map(evento => (
          <div key={evento.id} className="list-item-card" onClick={() => abrirModalForm(evento.dia, evento)}>
            <div className="list-info">
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <span className={`dot ${evento.tipo === 'entrega' ? 'blue' : evento.tipo === 'devolucao' ? 'orange' : evento.tipo === 'visita' ? 'green' : 'red'}`}></span>
                <h4>{evento.dia} - {evento.titulo}</h4>
              </div>
              <span style={{marginLeft:'20px'}}>Cliente: {evento.cliente}</span>
            </div>
            <button className="icon-btn">✏️</button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="agenda-container">
      <div className="agenda-sidebar">
        <button className="btn-novo-agendamento" onClick={() => abrirModalForm(new Date().getDate())}>
          + Novo Agendamento
        </button>
        
        {/* --- MENU DE FILTROS (SELEÇÃO ÚNICA) --- */}
        <div className="filtro-box">
          <div className="filtro-titulo">Visualizar</div>
          
          <div className={`filtro-item ${filtroAtivo === 'todos' ? 'ativo' : ''}`} onClick={() => setFiltroAtivo('todos')}>
            <span className="dot gray"></span> Todos
          </div>

          <div className={`filtro-item ${filtroAtivo === 'entrega' ? 'ativo' : ''}`} onClick={() => setFiltroAtivo('entrega')}>
            <span className="dot blue"></span> Entregas
          </div>
          
          <div className={`filtro-item ${filtroAtivo === 'devolucao' ? 'ativo' : ''}`} onClick={() => setFiltroAtivo('devolucao')}>
            <span className="dot orange"></span> Devoluções
          </div>
          
          <div className={`filtro-item ${filtroAtivo === 'visita' ? 'ativo' : ''}`} onClick={() => setFiltroAtivo('visita')}>
            <span className="dot green"></span> Visitas
          </div>
          
          <div className={`filtro-item ${filtroAtivo === 'bloqueio' ? 'ativo' : ''}`} onClick={() => setFiltroAtivo('bloqueio')}>
            <span className="dot red"></span> Bloqueios
          </div>
        </div>
      </div>

      <div className="agenda-main">
        <div className="agenda-header">
          <div className="nav-datas">
            <button className="btn-nav" onClick={() => mudarMes(-1)}>◀</button>
            <span className="mes-ano-titulo">{nomeMes}</span>
            <button className="btn-nav" onClick={() => mudarMes(1)}>▶</button>
            <button className="btn-nav" style={{width:'auto', padding:'0 10px'}} onClick={() => setDataAtual(new Date())}>Hoje</button>
          </div>
          <div className="view-switcher">
            <button className={`view-btn ${modoVisualizacao === 'calendario' ? 'active' : ''}`} onClick={() => setModoVisualizacao('calendario')}>📅</button>
            <button className={`view-btn ${modoVisualizacao === 'lista' ? 'active' : ''}`} onClick={() => setModoVisualizacao('lista')}>📝</button>
          </div>
        </div>
        
        {modoVisualizacao === 'calendario' ? renderCalendario() : renderListaGeral()}
      </div>

      {/* --- MODAIS MANTIDOS IGUAIS --- */}
      {modalListaAberto && (
        <div className="modal-overlay" onClick={() => setModalListaAberto(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agenda: {diaSelecionado} de {nomeMes}</h3>
              <button className="btn-close" onClick={() => setModalListaAberto(false)}>×</button>
            </div>
            <div className="modal-lista-items">
              {eventos.filter(e => {
                   const eMes = e.mes !== undefined ? e.mes : dataAtual.getMonth();
                   const eAno = e.ano !== undefined ? e.ano : dataAtual.getFullYear();
                   return e.dia === diaSelecionado && eMes === dataAtual.getMonth() && eAno === dataAtual.getFullYear();
                }).map(evento => (
                  <div key={evento.id} className={`item-detalhe-card ${evento.tipo}`} onClick={() => abrirModalForm(diaSelecionado, evento)}>
                    <div className="detalhe-info"><h4>{evento.titulo}</h4><span>{evento.cliente}</span></div>
                    <span style={{fontSize:'1.2rem'}}>✏️</span>
                  </div>
              ))}
            </div>
            <button className="btn-add-no-dia" onClick={() => abrirModalForm(diaSelecionado)}>+ Adicionar evento</button>
          </div>
        </div>
      )}

      {modalFormAberto && (
        <div className="modal-overlay" onClick={() => setModalFormAberto(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{eventoSelecionado ? 'Editar Evento' : 'Novo Evento'}</h3>
              <button className="btn-close" onClick={() => setModalFormAberto(false)}>×</button>
            </div>
            <form onSubmit={salvarEvento} className="modal-form">
              <div><label>Data</label><input type="date" value={formData.dataISO} onChange={(e) => setFormData({...formData, dataISO: e.target.value})} required style={{ fontWeight: 'bold', color: '#0f233a' }}/></div>
              <div><label>Título</label><input autoFocus type="text" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} placeholder="Ex: Entrega Juliana" required /></div>
              <div><label>Cliente / Local</label><input type="text" value={formData.cliente} onChange={(e) => setFormData({...formData, cliente: e.target.value})} placeholder="Nome do cliente ou local" /></div>
              <div><label>Tipo</label><select value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})}><option value="entrega">🔵 Entrega</option><option value="devolucao">🟠 Devolução</option><option value="visita">🟢 Visita</option><option value="bloqueio">🔴 Bloqueio</option></select></div>
              <div className="modal-actions">{eventoSelecionado && (<button type="button" className="btn-excluir-modal" onClick={excluirEvento}>🗑️</button>)}<button type="button" className="btn-cancelar-modal" onClick={() => setModalFormAberto(false)}>Cancelar</button><button type="submit" className="btn-salvar-modal">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;