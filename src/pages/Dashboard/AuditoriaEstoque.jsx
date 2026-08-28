import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { executarLimpezaMidiasExpiradas } from '../../utils/limpezaMidiaService';
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

  const [limpandoMidia, setLimpandoMidia] = useState(false);

  const handleExecutarLimpezaMidia = async () => {
    try {
      setLimpandoMidia(true);
      const res = await executarLimpezaMidiasExpiradas(db, tenantId);
      if (res.sucesso) {
        if (res.totalProcessados === 0) {
          alert("✨ Nenhuma mídia de vistoria expirada para remover no momento.");
        } else {
          alert(`🧹 Limpeza concluída com sucesso!\n• ${res.totalProcessados} locação(ões) limpa(s)\n• ${res.totalFotosLimpas} foto(s) expirada(s) removida(s) do banco.`);
        }
      } else {
        alert(`⚠️ Erro ao executar limpeza: ${res.erro}`);
      }
    } catch (err) {
      console.error("Erro na limpeza manual de mídia:", err);
      alert("Ocorreu um erro ao processar a limpeza de mídias.");
    } finally {
      setLimpandoMidia(false);
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

        {/* ABAS DE FILTRO SEGMENTADAS E CENTRALIZADAS */}
        <div className="auditoria-tabs-container">
          <div className="auditoria-segmented-tabs">
            <button 
              className={`seg-tab ${filtroCategoria === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroCategoria('todos')}
            >
              Todas <span className="seg-count">{pedidosComProblema.length}</span>
            </button>
            {qtdDevolucao > 0 && (
              <button 
                className={`seg-tab ${filtroCategoria === 'devolucao' ? 'active' : ''}`}
                onClick={() => setFiltroCategoria('devolucao')}
              >
                ⏰ Atrasadas <span className="seg-count count-amber">{qtdDevolucao}</span>
              </button>
            )}
            {qtdFinanceiro > 0 && (
              <button 
                className={`seg-tab ${filtroCategoria === 'financeiro' ? 'active' : ''}`}
                onClick={() => setFiltroCategoria('financeiro')}
              >
                💰 Pendências <span className="seg-count count-red">{qtdFinanceiro}</span>
              </button>
            )}
            {qtdEstoque > 0 && (
              <button 
                className={`seg-tab ${filtroCategoria === 'estoque' ? 'active' : ''}`}
                onClick={() => setFiltroCategoria('estoque')}
              >
                🔒 Estoque <span className="seg-count count-purple">{qtdEstoque}</span>
              </button>
            )}
            {qtdAvarias > 0 && (
              <button 
                className={`seg-tab ${filtroCategoria === 'avaria' ? 'active' : ''}`}
                onClick={() => setFiltroCategoria('avaria')}
              >
                ⚠️ Avarias <span className="seg-count count-orange">{qtdAvarias}</span>
              </button>
            )}
          </div>
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
                  {/* LINHA 1: CLIENTE + STATUS */}
                  <div className="card-top-row">
                    <div className="client-badge-group">
                      <div className="avatar-mini-gold">{clienteNome.charAt(0).toUpperCase()}</div>
                      <div className="client-info-col">
                        <strong className="cliente-nome-txt">{clienteNome}</strong>
                        <span className="pedido-id-code">#{pedido.id.slice(-5).toUpperCase()}</span>
                      </div>
                    </div>

                    <span className={`badge-pill-status status-${(pedido.status || '').toLowerCase()}`}>
                      {pedido.status?.toUpperCase() || 'LOCAÇÃO'}
                    </span>
                  </div>

                  {/* LINHA 2: DATAS */}
                  {(pedido.dataRetirada || pedido.dataDevolucao) && (
                    <div className="card-dates-row">
                      {pedido.dataRetirada && (
                        <span className="date-item">
                          <i className="far fa-calendar-alt"></i> Retirada: <b>{pedido.dataRetirada.split('-').reverse().join('/')}</b>
                        </span>
                      )}
                      {pedido.dataRetirada && pedido.dataDevolucao && <span className="date-separator">•</span>}
                      {pedido.dataDevolucao && (
                        <span className="date-item">
                          <i className="fas fa-undo-alt"></i> Devolução: <b>{pedido.dataDevolucao.split('-').reverse().join('/')}</b>
                        </span>
                      )}
                    </div>
                  )}

                  {/* LINHA 3: PEÇAS AFETADAS */}
                  <div className="order-items-preview">
                    <span className="items-icon">📦</span>
                    <span className="items-text-truncated">{listaItensStr}</span>
                  </div>

                  {/* LINHA 4: RESUMO FINANCEIRO */}
                  {valorTotal > 0 && (
                    <div className="financial-preview-bar">
                      <span className="fin-val">Total: <b>R$ {valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                      <span className="fin-val">Pago: <b className="text-green">R$ {valorPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                      {saldo > 0 ? (
                        <span className="fin-val text-red">Pendente: <b>R$ {saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                      ) : (
                        <span className="fin-val text-green">Quitado ✓</span>
                      )}
                    </div>
                  )}

                  {/* LINHA 5: TAGS DE ALERTA */}
                  {pedido.alertas && pedido.alertas.length > 0 && (
                    <div className="auditoria-tags-erro">
                      {pedido.alertas.map((alerta, idx) => (
                        <span key={idx} className={`tag-erro ${alerta.tipo}`}>
                          {alerta.texto}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* LINHA 6: AÇÕES */}
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

        {/* FOOTER DISCRETO PARA LIMPEZA DE ARMAZENAMENTO */}
        <div className="auditoria-footer-luxury">
          <button 
            type="button" 
            className="btn-limpar-midias-footer"
            onClick={handleExecutarLimpezaMidia}
            disabled={limpandoMidia}
            title="Remove fotos de vistorias sem avarias de pedidos concluídos há mais de 15 dias"
          >
            {limpandoMidia ? '⏳ Limpando fotos antigas...' : '🧹 Limpar Fotos Antigas de Vistorias (+15 dias)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditoriaEstoque;