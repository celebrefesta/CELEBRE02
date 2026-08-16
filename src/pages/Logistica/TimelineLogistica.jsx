import React, { useMemo } from 'react';
import './TimelineLogistica.css';

/**
 * ⏱️ VISUALIZADOR DE LINHA DO TEMPO / TIMELINE CRONOLÓGICA (LOGÍSTICA)
 * Organiza saídas, coletas, entregas e devoluções em blocos de horário sequenciais.
 */
export const TimelineLogistica = ({
  locacoes = [],
  navigate,
  onAbrirCheckinIda,
  onAbrirCheckinVolta,
  onAbrirGPS,
  onAbrirWhatsApp,
  verificarSeEhEntrega,
  obterEnderecoCompleto
}) => {
  const hojeStr = new Date().toISOString().split('T')[0];

  // 🕒 ESTRUTURAÇÃO DOS EVENTOS POR HORÁRIO & TIPO
  const eventosOrdenados = useMemo(() => {
    const lista = [];

    locacoes.forEach(loc => {
      const isEntrega = verificarSeEhEntrega ? verificarSeEhEntrega(loc) : (loc.logistica?.tipo === 'entrega');
      const endereco = obterEnderecoCompleto ? obterEnderecoCompleto(loc) : (loc.logistica?.endereco || loc.endereco);
      const totalPecas = (loc.itens || []).reduce((acc, it) => acc + Number(it.quantidade || it.qtd || 1), 0);

      // Evento de Saída / Retirada
      if (loc.dataRetirada) {
        lista.push({
          id: `${loc.id}-saida`,
          locId: loc.id,
          loc: loc,
          tipo: isEntrega ? 'entrega' : 'retirada',
          data: loc.dataRetirada,
          horario: loc.horarioRetirada || '08:00',
          titulo: isEntrega ? '🚚 Saída para Entrega' : '🏬 Retirada no Balcão',
          cliente: loc.clienteNome || 'Cliente',
          telefone: loc.clienteTelefone || loc.telefone,
          tema: loc.tema || loc.temaFesta,
          motorista: loc.logistica?.motoristaNome,
          veiculo: loc.logistica?.veiculo,
          endereco: isEntrega ? (endereco || 'Endereço não especificado') : 'Retirada no Galpão',
          totalPecas,
          status: loc.status,
          isAtrasado: loc.dataRetirada < hojeStr && loc.status !== 'entregue' && loc.status !== 'finalizado'
        });
      }

      // Evento de Devolução / Retorno
      if (loc.dataDevolucao) {
        lista.push({
          id: `${loc.id}-devolucao`,
          locId: loc.id,
          loc: loc,
          tipo: 'devolucao',
          data: loc.dataDevolucao,
          horario: loc.horarioDevolucao || '17:00',
          titulo: '🔄 Devolução / Retorno Previsto',
          cliente: loc.clienteNome || 'Cliente',
          telefone: loc.clienteTelefone || loc.telefone,
          tema: loc.tema || loc.temaFesta,
          motorista: loc.logistica?.motoristaNome,
          veiculo: loc.logistica?.veiculo,
          endereco: isEntrega ? (endereco || 'Coleta no Local') : 'Devolução no Galpão',
          totalPecas,
          status: loc.status,
          isAtrasado: loc.dataDevolucao < hojeStr && loc.status !== 'finalizado'
        });
      }
    });

    // Ordenar por data e horário
    return lista.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.horario.localeCompare(b.horario);
    });
  }, [locacoes, hojeStr, verificarSeEhEntrega, obterEnderecoCompleto]);

  // Agrupar por data
  const gruposPorData = useMemo(() => {
    const grupos = {};
    eventosOrdenados.forEach(ev => {
      if (!grupos[ev.data]) grupos[ev.data] = [];
      grupos[ev.data].push(ev);
    });
    return grupos;
  }, [eventosOrdenados]);

  const datas = Object.keys(gruposPorData);

  return (
    <div className="timeline-container fade-in">
      
      {datas.length === 0 ? (
        <div className="timeline-vazio">
          <span>🕒 Nenhum evento agendado para o período selecionado.</span>
        </div>
      ) : (
        datas.map(dataIso => {
          const eventosData = gruposPorData[dataIso];
          const dataFormatada = dataIso.split('-').reverse().join('/');
          const ehHoje = dataIso === hojeStr;

          return (
            <div key={dataIso} className="timeline-dia-bloco">
              
              {/* CABEÇALHO DO DIA */}
              <div className={`timeline-dia-header ${ehHoje ? 'dia-hoje' : ''}`}>
                <div className="timeline-dia-circulo">📅</div>
                <h3>{dataFormatada} {ehHoje ? '• HOJE' : ''}</h3>
                <span className="timeline-dia-count">{eventosData.length} evento(s)</span>
              </div>

              {/* LISTA SEQUENCIAL DE EVENTOS */}
              <div className="timeline-eventos-lista">
                {eventosData.map((ev, idx) => {
                  const numPed = ev.loc.numeroPedido ? `#${ev.loc.numeroPedido}` : `#${ev.loc.id.substring(0, 5)}`;
                  
                  return (
                    <div 
                      key={ev.id} 
                      className={`timeline-evento-card tipo-${ev.tipo} ${ev.isAtrasado ? 'card-atrasado' : ''}`}
                    >
                      {/* BARRA DE HORÁRIO LATERAL */}
                      <div className="timeline-horario-col">
                        <span className="timeline-hora-txt">{ev.horario}</span>
                        <div className="timeline-hora-line"></div>
                      </div>

                      {/* CORPO DO EVENTO */}
                      <div className="timeline-card-main">
                        <div className="timeline-card-top">
                          <span className={`timeline-tag-tipo tag-${ev.tipo}`}>{ev.titulo}</span>
                          <span className="timeline-ped-num">{numPed}</span>
                          {ev.isAtrasado && <span className="timeline-badge-urgente">🚨 ATRASADO</span>}
                        </div>

                        <div className="timeline-card-content">
                          <h4 className="timeline-cliente-nome">{ev.cliente}</h4>
                          
                          <div className="timeline-detalhes-grid">
                            {ev.tema && <span>🎈 Tema: <strong>{ev.tema}</strong></span>}
                            <span>📦 Acervo: <strong>{ev.totalPecas} peças</strong></span>
                            {ev.motorista && <span>🚗 Motorista: <strong>{ev.motorista}</strong></span>}
                            <span>📍 Local: <strong>{ev.endereco}</strong></span>
                          </div>
                        </div>

                        {/* AÇÕES RÁPIDAS */}
                        <div className="timeline-card-actions">
                          <button 
                            type="button" 
                            className="btn-time-act btn-time-wpp" 
                            onClick={() => onAbrirWhatsApp(ev.loc)}
                            title="Chamar cliente no WhatsApp"
                          >
                            💬 WhatsApp
                          </button>

                          {ev.tipo === 'entrega' && (
                            <button 
                              type="button" 
                              className="btn-time-act btn-time-gps" 
                              onClick={() => onAbrirGPS(ev.loc)}
                              title="Abrir rota no GPS"
                            >
                              📍 GPS
                            </button>
                          )}

                          <button 
                            type="button" 
                            className="btn-time-act" 
                            onClick={() => navigate(`/locacoes/editar/${ev.loc.id}`)}
                          >
                            🔍 Detalhes
                          </button>

                          {ev.tipo === 'devolucao' ? (
                            <button 
                              type="button" 
                              className="btn-time-act btn-time-checkin" 
                              onClick={() => onAbrirCheckinVolta(ev.loc)}
                            >
                              📥 Vistoria (Retorno)
                            </button>
                          ) : (
                            <button 
                              type="button" 
                              className="btn-time-act btn-time-checkin" 
                              onClick={() => onAbrirCheckinIda(ev.loc)}
                            >
                              📤 Vistoria (Saída)
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })
      )}

    </div>
  );
};

export default TimelineLogistica;
