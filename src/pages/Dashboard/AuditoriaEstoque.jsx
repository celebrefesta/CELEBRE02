import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './AuditoriaEstoque.css';

const AuditoriaEstoque = () => {
  const navigate = useNavigate();

  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [pedidosComProblema, setPedidosComProblema] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visivel, setVisivel] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');

  useEffect(() => {
    if (!usuarioLogado) return;

    const realizarAuditoriaUnificada = async () => {
      try {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        const hoje = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];

        const q = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snap = await getDocs(q);
        
        const anomalias = [];

        snap.docs.forEach(docSnap => {
          const item = { id: docSnap.id, ...docSnap.data() };
          const statusStr = (item.status || '').toLowerCase();
          
          if (statusStr === 'cancelado') return;

          const isOrcamento = statusStr.includes('orcam');
          if (isOrcamento && item.dataRetirada && item.dataRetirada < hoje) return; 

          let alertas = [];
          let permiteAcaoRapida = false;

          if (['confirmado', 'preparacao'].includes(statusStr) && item.dataRetirada && item.dataRetirada < hoje) {
            alertas.push({ tipo: 'estoque', texto: '🔒 Estoque Travado (Data Passou)' });
            permiteAcaoRapida = true; 
          }
          else if (['confirmado', 'preparacao'].includes(statusStr) && item.dataRetirada === hoje) {
            alertas.push({ tipo: 'entrega', texto: '🚚 Separar / Entregar Hoje!' });
          }

          if (statusStr === 'entregue' && item.dataDevolucao && item.dataDevolucao < hoje) {
            alertas.push({ tipo: 'devolucao', texto: '⏰ Devolução Atrasada' });
          }

          const saldoDevedor = Number(item.valorTotal || item.total || 0) - Number(item.valorPago || 0);
          if (saldoDevedor > 0 && !isOrcamento && item.dataDevolucao && item.dataDevolucao <= hoje) {
            alertas.push({ tipo: 'financeiro', texto: `💰 Pagamento Pendente (R$ ${saldoDevedor.toFixed(2)})` });
          }

          const temAvaria = item.itens?.some(i => i.avaria);
          const temFalta = item.itens?.some(i => i.faltou);
          
          if (temAvaria) { 
            alertas.push({ tipo: 'avaria', texto: '⚠️ Peça Avariada' });
          }
          if (temFalta) { 
            alertas.push({ tipo: 'falta', texto: '⚠️ Peça Faltando' });
          }

          if (statusStr === 'finalizado' && !temAvaria && !temFalta && saldoDevedor <= 0) return;

          if (alertas.length > 0) {
            anomalias.push({ ...item, alertas, permiteAcaoRapida, saldoDevedor });
          }
        });

        if (anomalias.length > 0 && !sessionStorage.getItem('auditoria_fechada')) {
          setPedidosComProblema(anomalias);
          setVisivel(true);
        }

      } catch (error) {
        console.error("Erro na auditoria unificada:", error);
      } finally {
        setLoading(false);
      }
    };

    realizarAuditoriaUnificada();
  }, [usuarioLogado, tenantId]);

  const handleResolverRapido = async (id, novoStatus) => {
    try {
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      const novaLista = pedidosComProblema.filter(p => p.id !== id);
      setPedidosComProblema(novaLista);
      if (novaLista.length === 0) setVisivel(false);
    } catch (e) {
      alert("Erro ao atualizar pedido.");
    }
  };

  const abrirZapCobranca = (pedido) => {
    const nomeCliente = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
    const fone = (pedido.clienteCelular || pedido.cliente?.celular || pedido.celular || '').replace(/\D/g, '');
    const saldo = (pedido.saldoDevedor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const idCurto = pedido.id.slice(-5).toUpperCase();

    let texto = `Olá ${nomeCliente}! Tudo bem? Passando para alinhar os detalhes do encerramento da sua locação #${idCurto} na Celebre.`;
    if (pedido.saldoDevedor > 0) {
      texto += ` Consta um saldo restante de R$ ${saldo}.`;
    }
    texto += ` Qualquer dúvida estamos à disposição! 🎈`;

    const link = fone ? `https://wa.me/55${fone}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(link, '_blank');
  };

  if (!visivel || loading) return null;

  // Filtros de Categoria
  const qtdEstoque = pedidosComProblema.filter(p => p.alertas.some(a => a.tipo === 'estoque')).length;
  const qtdDevolucao = pedidosComProblema.filter(p => p.alertas.some(a => a.tipo === 'devolucao')).length;
  const qtdFinanceiro = pedidosComProblema.filter(p => p.alertas.some(a => a.tipo === 'financeiro')).length;
  const qtdAvarias = pedidosComProblema.filter(p => p.alertas.some(a => a.tipo === 'avaria' || a.tipo === 'falta')).length;

  const anomaliasFiltradas = pedidosComProblema.filter(p => {
    if (filtroCategoria === 'estoque') return p.alertas.some(a => a.tipo === 'estoque');
    if (filtroCategoria === 'devolucao') return p.alertas.some(a => a.tipo === 'devolucao');
    if (filtroCategoria === 'financeiro') return p.alertas.some(a => a.tipo === 'financeiro');
    if (filtroCategoria === 'avaria') return p.alertas.some(a => a.tipo === 'avaria' || a.tipo === 'falta');
    return true;
  });

  return (
    <div className="auditoria-overlay fade-in">
      <div className="auditoria-modal modal-auditoria-luxury">
        
        {/* HEADER EXECUTIVO COM RADAR EM TEMPO REAL */}
        <div className="auditoria-header-luxury">
          <button 
            className="btn-fechar-modal-luxury" 
            onClick={() => {
              sessionStorage.setItem('auditoria_fechada', 'true');
              setVisivel(false);
            }}
            title="Fechar diagnóstico"
          >
            ✕
          </button>


          <div className="header-badge-pulse">
            <span className="pulse-dot"></span> CENTRAL DE AUDITORIA OPERACIONAL E RAIO-X
          </div>

          <h2>🚨 Diagnóstico do Sistema</h2>
          <p>
            Foram identificadas <strong>{pedidosComProblema.length} anomalias operacionais</strong> no seu inventário e caixa. Resolva abaixo para manter seu estoque livre e sem inconsistências.
          </p>
        </div>

        {/* BARRA DE FILTROS RÁPIDOS */}
        <div className="auditoria-filter-chips">
          <button 
            className={`chip-filter ${filtroCategoria === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroCategoria('todos')}
          >
            Todas ({pedidosComProblema.length})
          </button>
          {qtdEstoque > 0 && (
            <button 
              className={`chip-filter chip-purple ${filtroCategoria === 'estoque' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('estoque')}
            >
              🔒 Estoque Travado ({qtdEstoque})
            </button>
          )}
          {qtdDevolucao > 0 && (
            <button 
              className={`chip-filter chip-amber ${filtroCategoria === 'devolucao' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('devolucao')}
            >
              ⏰ Devolução Atrasada ({qtdDevolucao})
            </button>
          )}
          {qtdFinanceiro > 0 && (
            <button 
              className={`chip-filter chip-red ${filtroCategoria === 'financeiro' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('financeiro')}
            >
              💰 Saldo Pendente ({qtdFinanceiro})
            </button>
          )}
          {qtdAvarias > 0 && (
            <button 
              className={`chip-filter chip-orange ${filtroCategoria === 'avaria' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('avaria')}
            >
              ⚠️ Avarias/Faltas ({qtdAvarias})
            </button>
          )}
        </div>

        {/* CORPO DA MODAL */}
        <div className="auditoria-corpo-luxury">
          {anomaliasFiltradas.length === 0 ? (
            <div className="empty-auditoria-state">
              <span>✅</span>
              <p>Nenhuma anomalia nesta categoria selecionada.</p>
            </div>
          ) : (
            anomaliasFiltradas.map(pedido => {
              const clienteNome = pedido.clienteNome || pedido.cliente?.nome || 'Cliente Não Informado';
              const fone = pedido.clienteCelular || pedido.cliente?.celular || pedido.celular;
              const valorTotal = Number(pedido.valorTotal || pedido.total || 0);
              const valorPago = Number(pedido.valorPago || 0);
              const saldo = pedido.saldoDevedor || (valorTotal - valorPago);
              const listaItensStr = pedido.itens?.map(i => `${i.qtd || 1}x ${i.nome}`).join(', ') || 'Nenhum item discriminado';

              return (
                <div key={pedido.id} className="auditoria-card-luxury">
                  
                  <div className="auditoria-main-info">
                    {/* TOPO DO CARD */}
                    <div className="card-top-row">
                      <div className="client-badge-group">
                        <div className="avatar-mini-gold">{clienteNome.charAt(0)}</div>
                        <div>
                          <strong className="cliente-nome-txt">{clienteNome}</strong>
                          <span className="pedido-id-code">Pedido #{pedido.id.slice(-5).toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="badges-row">
                        <span className="badge-pill-status">Status: <b>{pedido.status?.toUpperCase()}</b></span>
                        {pedido.dataRetirada && (
                          <span className="badge-pill-date">📅 Retirada: {pedido.dataRetirada.split('-').reverse().join('/')}</span>
                        )}
                        {pedido.dataDevolucao && (
                          <span className="badge-pill-date">🔄 Devolução: {pedido.dataDevolucao.split('-').reverse().join('/')}</span>
                        )}
                      </div>
                    </div>

                    {/* ITENS ALUGADOS (RAIO-X DE PEÇAS) */}
                    <div className="order-items-preview">
                      <strong>📦 Peças Afetadas:</strong>
                      <span className="items-text-truncated">{listaItensStr}</span>
                    </div>

                    {/* RESUMO FINANCEIRO */}
                    {valorTotal > 0 && (
                      <div className="financial-preview-bar">
                        <span>Total: <b>R$ {valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                        <span>Pago: <b className="text-green">R$ {valorPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                        {saldo > 0 && (
                          <span className="badge-saldo-pendente">Pendência: <b>R$ {saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                        )}
                      </div>
                    )}

                    {/* TAGS DE ANOMALIA */}
                    <div className="auditoria-tags-erro">
                      {pedido.alertas.map((alerta, idx) => (
                        <span key={idx} className={`tag-erro ${alerta.tipo}`}>
                          {alerta.texto}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* COLUNA DE AÇÕES RÁPIDAS */}
                  <div className="auditoria-actions-col">
                    {fone && (
                      <button 
                        type="button" 
                        className="btn-auditoria-zap"
                        onClick={() => abrirZapCobranca(pedido)}
                        title="Enviar mensagem direta no WhatsApp do cliente"
                      >
                        <i className="fab fa-whatsapp"></i> WhatsApp
                      </button>
                    )}

                    {pedido.permiteAcaoRapida ? (
                      <div className="btn-group-quick">
                        <button className="btn-auditoria-check" onClick={() => handleResolverRapido(pedido.id, 'FINALIZADO')} title="Marcar como devolvido/finalizado e liberar acervo">
                          ✓ Finalizar
                        </button>
                        <button className="btn-auditoria-cancel" onClick={() => handleResolverRapido(pedido.id, 'CANCELADO')} title="Cancelar este pedido">
                          ✕ Cancelar
                        </button>
                      </div>
                    ) : (
                      <button className="btn-auditoria-abrir" onClick={() => navigate(`/locacoes/editar/${pedido.id}`)}>
                        Abrir Pedido <i className="fas fa-arrow-right"></i>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditoriaEstoque;