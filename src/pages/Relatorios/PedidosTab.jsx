import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './PedidosTab.css'; 

const PedidosTab = () => {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ 
    total: 0, 
    faturamento: 0, 
    futuros: 0 
  });
  const [statusContagem, setStatusContagem] = useState([]);
  const [proximosEventos, setProximosEventos] = useState([]);
  const [pedidosLista, setPedidosLista] = useState([]);
  
  const [filtroAtual, setFiltroAtual] = useState('TODOS');
  const [taxaConversao, setTaxaConversao] = useState(0);

  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: ''
  });

  useEffect(() => {
    const buscarDadosPedidosEConfigs = async () => {
      try {
        const [snapLocacoes, snapConfig] = await Promise.all([
          getDocs(collection(db, "locacoes")),
          getDoc(doc(db, "sistema", "parametros"))
        ]);

        if (snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeEmpresa || 'Ágape Decorações',
            logotipo: configData.logotipo || ''
          });
        }

        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));

        let faturamentoTotal = 0;
        let eventosFuturosCount = 0;
        const contagemStatus = {};
        
        let qtdOrcamentos = 0;
        let qtdFechados = 0;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const pedidosFormatados = locacoes.map(loc => {
          const valor = Number(loc.valorTotal) || 0;
          faturamentoTotal += valor;

          const statusRaw = loc.status || 'Pendente';
          const statusLimpo = String(statusRaw).toUpperCase().trim();
          contagemStatus[statusLimpo] = (contagemStatus[statusLimpo] || 0) + 1;

          let dataFesta = null;
          if (loc.dataRetirada) {
            dataFesta = new Date(loc.dataRetirada.includes('T') ? loc.dataRetirada : `${loc.dataRetirada}T12:00:00`);
          } else if (loc.criadoEm?.toDate) {
            dataFesta = loc.criadoEm.toDate();
          }

          if (dataFesta && dataFesta >= hoje && !statusLimpo.includes('CANCELADO')) {
            eventosFuturosCount++;
          }

          if (statusLimpo.includes('ORÇAMENTO') || statusLimpo.includes('ORCAMENTO') || statusLimpo.includes('PENDENTE')) {
            qtdOrcamentos++;
          } else if (!statusLimpo.includes('CANCELADO')) {
            qtdFechados++;
          }

          let tipoServico = "DECORAÇÃO"; 
          if (loc.tipoServico || loc.tipoDaFesta || loc.modalidade) {
             tipoServico = String(loc.tipoServico || loc.tipoDaFesta || loc.modalidade).toUpperCase();
          } 
          else if (loc.logistica && String(loc.logistica.tipoFrete || loc.logistica.frete).toUpperCase().includes('RETIRADA')) {
             tipoServico = "PEGUE E MONTE";
          }

          return {
            id: loc.id,
            numero: loc.numeroPedido || loc.id.substring(0, 6).toUpperCase(),
            cliente: loc.clienteNome || "Cliente não informado",
            dataObj: dataFesta,
            dataStr: dataFesta ? dataFesta.toLocaleDateString('pt-BR') : "Sem data",
            valor: valor,
            status: statusLimpo,
            tipoServico: tipoServico
          };
        });

        pedidosFormatados.sort((a, b) => (b.dataObj || 0) - (a.dataObj || 0));

        const futuros = pedidosFormatados
          .filter(p => p.dataObj && p.dataObj >= hoje && !p.status.includes('CANCELADO'))
          .sort((a, b) => a.dataObj - b.dataObj)
          .slice(0, 5); 

        const statusArray = Object.entries(contagemStatus).sort((a, b) => b[1] - a[1]);
        const totalOportunidades = qtdFechados + qtdOrcamentos;
        const taxa = totalOportunidades > 0 ? (qtdFechados / totalOportunidades) * 100 : 0;

        setMetricas({ total: locacoes.length, faturamento: faturamentoTotal, futuros: eventosFuturosCount });
        setStatusContagem(statusArray);
        setProximosEventos(futuros);
        setPedidosLista(pedidosFormatados);
        setTaxaConversao(taxa);

      } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarDadosPedidosEConfigs();
  }, []);

  const getStatusClass = (status) => {
    if (status.includes('ORÇAMENTO') || status.includes('ORCAMENTO') || status.includes('PENDENTE')) return 'status-orcamento';
    if (status.includes('AGENDADO') || status.includes('CONFIRMADO')) return 'status-agendado';
    if (status.includes('ANDAMENTO') || status.includes('RETIRADO') || status.includes('FESTA')) return 'status-andamento';
    if (status.includes('CANCELADO')) return 'status-cancelado';
    return 'status-concluido'; 
  };

  const pedidosFiltrados = pedidosLista.filter(p => {
    if (filtroAtual === 'TODOS') return true;
    if (filtroAtual === 'ORÇAMENTOS') return p.status.includes('ORÇAMENTO') || p.status.includes('ORCAMENTO') || p.status.includes('PENDENTE');
    if (filtroAtual === 'FECHADOS') return !p.status.includes('ORÇAMENTO') && !p.status.includes('ORCAMENTO') && !p.status.includes('PENDENTE') && !p.status.includes('CANCELADO');
    if (filtroAtual === 'CANCELADOS') return p.status.includes('CANCELADO');
    if (filtroAtual === 'PEGUE_MONTE') return p.tipoServico.includes('PEGUE');
    if (filtroAtual === 'DECORACAO') return !p.tipoServico.includes('PEGUE');
    return true;
  });

  const exportarPDFPedidos = () => {
    try {
      const doc = new jsPDF();
      let startY = 25;
      const dataHoje = new Date().toLocaleDateString('pt-BR');

      if (dadosEmpresa.logotipo) {
        doc.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 30, 30);
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text(dadosEmpresa.nomeEmpresa, 48, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Relatório de Pedidos | Gerado em: ${dataHoje} | Total: ${pedidosFiltrados.length}`, 48, 30);
        startY = 45;
      } else {
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42); 
        doc.text(`Relatório de Pedidos - ${dadosEmpresa.nomeEmpresa}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Gerado em: ${dataHoje} | Total Filtrado: ${pedidosFiltrados.length}`, 14, 30);
        startY = 38;
      }

      autoTable(doc, {
        head: [["Nº Pedido", "Cliente", "Tipo", "Data da Festa", "Valor (R$)", "Status"]],
        body: pedidosFiltrados.map(p => [
          `#${p.numero}`, 
          p.cliente, 
          p.tipoServico,
          p.dataStr, 
          `R$ ${p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          p.status
        ]),
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Pedidos_${dadosEmpresa.nomeEmpresa.replace(/\s+/g, '_')}.pdf`);
    } catch (e) { alert("Erro ao gerar PDF"); }
  };

  if (loading) return <div className="loading-v3">Carregando inteligência de contratos...</div>;

  return (
    <div className="fade-in">
      <div className="kpi-grid">
        <div className="kpi-card card-destaque">
          <span>VOLUME DE VENDAS</span>
          <h2>{metricas.total}</h2>
          <small>Contratos gerados</small>
        </div>
        <div className="kpi-card card-verde">
          <span>RECEITA PROJETADA</span>
          <h2>R$ {metricas.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
          <small>Soma de todos os contratos</small>
        </div>
        <div className="kpi-card card-alerta">
          <span>PRÓXIMOS EVENTOS</span>
          <h2>{metricas.futuros}</h2>
          <small>Festas aguardando montagem</small>
        </div>
      </div>

      <div className="clientes-layout-split mt-20">
        
        <div className="col-esquerda">
          <div className="main-card-premium" style={{ marginBottom: '20px' }}>
            <div className="card-header-flex">
              <h3>🗓️ Agenda da Semana</h3>
            </div>
            <p style={{fontSize: '11px', color: 'var(--texto-secundario)', marginBottom: '15px', marginTop: '-10px'}}>
              Seus próximos eventos agendados.
            </p>
            <div className="agenda-lista">
              {proximosEventos.map((ev, i) => (
                <div key={i} className="agenda-item">
                  <div className="agenda-data">
                    <strong>{ev.dataObj ? ev.dataObj.getDate() : '-'}</strong>
                    <span>{ev.dataObj ? ev.dataObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase() : '-'}</span>
                  </div>
                  <div className="agenda-info">
                    <div className="agenda-cliente">{ev.cliente}</div>
                    <div className="agenda-detalhe">
                      <span style={{color: ev.tipoServico.includes('PEGUE') ? 'var(--dourado)' : 'var(--texto-principal)', fontWeight: '800'}}>
                        {ev.tipoServico.includes('PEGUE') ? '📦 Pegue e Monte' : '✨ Decoração'}
                      </span> • Pedido #{ev.numero}
                    </div>
                  </div>
                  <div className={`agenda-status ${getStatusClass(ev.status)}`}>
                    {ev.status}
                  </div>
                </div>
              ))}
              {proximosEventos.length === 0 && (
                <div className="agenda-vazia">Nenhum evento futuro agendado.</div>
              )}
            </div>
          </div>

          <div className="main-card-premium">
            <div className="card-header-flex">
              <h3>📊 Funil de Pedidos</h3>
            </div>
            <p style={{fontSize: '11px', color: 'var(--texto-secundario)', marginBottom: '15px', marginTop: '-10px'}}>
              Distribuição dos contratos por etapa.
            </p>
            <div className="ranking-visual-container">
              {statusContagem.map(([status, total], i) => {
                const porcentagem = metricas.total > 0 ? (total / metricas.total) * 100 : 0;
                return (
                  <div key={i} className="rank-item-v4">
                    <div className="rank-info-v4">
                      <strong>{status}</strong>
                      <span style={{ color: 'var(--texto-principal)' }}>{total} ({porcentagem.toFixed(0)}%)</span>
                    </div>
                    <div className="rank-bar-bg-v4" style={{ height: '6px' }}>
                      <div className="rank-bar-fill-v4" style={{ width: `${porcentagem}%`, background: 'linear-gradient(90deg, var(--texto-secundario), var(--texto-principal))' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="box-conversao mt-20">
              <div className="conversao-info">
                <span className="conversao-label">Taxa de Conversão</span>
                <span className="conversao-desc">Orçamentos que viram festa</span>
              </div>
              <div className="conversao-valor">{taxaConversao.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <div className="main-card-premium col-tabela">
          <div className="card-header-flex">
            <h3>📝 Histórico de Contratos</h3>
            <button className="btn-export-pdf-clientes" onClick={exportarPDFPedidos}>📄 Baixar Relatório</button>
          </div>
          
          <div className="filtros-tabela-container">
            <button className={`btn-filtro ${filtroAtual === 'TODOS' ? 'ativo' : ''}`} onClick={() => setFiltroAtual('TODOS')}>Todos</button>
            <button className={`btn-filtro ${filtroAtual === 'FECHADOS' ? 'ativo' : ''}`} onClick={() => setFiltroAtual('FECHADOS')}>Festas Fechadas</button>
            <button className={`btn-filtro ${filtroAtual === 'ORÇAMENTOS' ? 'ativo' : ''}`} onClick={() => setFiltroAtual('ORÇAMENTOS')}>Orçamentos</button>
            <button className={`btn-filtro ${filtroAtual === 'PEGUE_MONTE' ? 'ativo' : ''}`} onClick={() => setFiltroAtual('PEGUE_MONTE')}>Pegue e Monte</button>
            <button className={`btn-filtro ${filtroAtual === 'DECORACAO' ? 'ativo' : ''}`} onClick={() => setFiltroAtual('DECORACAO')}>Decoração</button>
          </div>
          
          {/* REMOVIDO: scroll interno para a tabela fluir livremente */}
          <div style={{ paddingRight: '5px' }}>
            <table className="table-pedidos-v4">
              <thead>
                <tr><th width="20%">Nº PEDIDO</th><th width="40%">CLIENTE / DATA</th><th width="20%" className="direita">VALOR TOTAL</th><th width="20%" className="centro">STATUS</th></tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((pedido, i) => (
                  <tr key={i} className="fade-in">
                    <td style={{fontWeight: '800', color: 'var(--texto-secundario)'}}>#{pedido.numero}</td>
                    <td>
                      <div className="td-name" style={{color: 'var(--texto-principal)', fontWeight: '700'}}>{pedido.cliente}</div>
                      <div style={{fontSize: '11px', color: 'var(--texto-secundario)', marginBottom: '4px'}}>{pedido.dataStr}</div>
                      <span className={`badge-tipo-servico ${pedido.tipoServico.includes('PEGUE') ? 'tipo-pm' : 'tipo-dec'}`}>
                        {pedido.tipoServico.includes('PEGUE') ? '📦 PEGUE E MONTE' : '✨ DECORAÇÃO'}
                      </span>
                    </td>
                    <td className="direita bold text-verde">
                      R$ {pedido.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="centro">
                      <span className={`badge-status-pedido ${getStatusClass(pedido.status)}`}>
                        {pedido.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidosTab;