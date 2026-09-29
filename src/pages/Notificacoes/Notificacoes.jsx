import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './Notificacoes.css';

// 🔤 Helper: Formata nome com 1ª letra Maiúscula e as demais Minúsculas
const formatarNomeCapitalizado = (nomeBruto) => {
  if (!nomeBruto || typeof nomeBruto !== 'string') return '';
  const conectores = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'];
  const palavras = nomeBruto.trim().split(/\s+/);
  return palavras.map((palavra, index) => {
    if (!palavra) return '';
    const lower = palavra.toLowerCase();
    if (index > 0 && conectores.includes(lower)) return lower;
    return palavra.replace(/([\p{L}]+)/gu, (match) => {
      return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });
  }).join(' ');
};

// ⏱️ Helper: Tempo relativo amigável
const formatarTempoDecorrido = (timestamp) => {
  if (!timestamp) return 'Recente';
  const agora = Date.now();
  const diffSegundos = Math.floor((agora - timestamp) / 1000);
  if (diffSegundos < 60) return 'Agora mesmo';
  const diffMinutos = Math.floor(diffSegundos / 60);
  if (diffMinutos < 60) return `Há ${diffMinutos} min`;
  const diffHoras = Math.floor(diffMinutos / 60);
  if (diffHoras < 24) return `Há ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return 'Ontem';
  if (diffDias < 7) return `Há ${diffDias} dias`;
  return new Date(timestamp).toLocaleDateString('pt-BR');
};

// 📞 Helper: Máscara visual de telefone
const formatarTelefoneVisual = (v) => {
  if (!v) return '';
  const limpo = String(v).replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 7)}-${limpo.substring(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 6)}-${limpo.substring(6)}`;
  }
  return v;
};

const Notificacoes = () => {
  const navigate = useNavigate();
  
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [listaUnificada, setListaUnificada] = useState([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'cliente' | 'orcamento'

  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
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
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria:", error);
    }
  };

  const carregarDados = async (isManual = false) => {
    if (!usuarioLogado) return;
    if (isManual) setAtualizando(true);
    else setLoading(true);

    try {
      const qClientes = query(
        collection(db, "clientes"),
        where("situacaoFinanceira", "==", "pendente"),
        where("userId", "==", tenantId)
      );
      const snapClientes = await getDocs(qClientes);
      const listaC = snapClientes.docs.map(d => ({
        id: d.id,
        tipoNotificacao: 'cliente',
        ...d.data(),
        timestampOrdenacao: d.data().criadoEm?.toMillis ? d.data().criadoEm.toMillis() : Date.now()
      }));

      const qPedidos = query(
        collection(db, "locacoes"),
        where("origem", "==", "catalogo_publico"),
        where("status", "==", "orcamento"),
        where("userId", "==", tenantId)
      );
      const snapPedidos = await getDocs(qPedidos);
      const listaP = snapPedidos.docs.map(d => ({
        id: d.id,
        tipoNotificacao: 'orcamento',
        ...d.data(),
        timestampOrdenacao: d.data().criadoEm?.toMillis ? d.data().criadoEm.toMillis() : Date.now()
      }));

      const todasNotificacoes = [...listaC, ...listaP].sort((a, b) => b.timestampOrdenacao - a.timestampOrdenacao);
      setListaUnificada(todasNotificacoes);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
      navigate('/login');
      return;
    }
    carregarDados();
  }, [usuarioLogado, navigate, tenantId]);

  const aprovarCliente = async (id, nomeCliente) => {
    try {
      await updateDoc(doc(db, "clientes", id), {
        situacaoFinanceira: 'adimplente',
        statusAprovacao: 'aprovado'
      });
      await registrarLog("APROVAÇÃO DE CLIENTE", `Aprovou o cadastro do novo cliente: "${nomeCliente || 'Desconhecido'}".`);
      carregarDados();
    } catch (error) {
      console.error("Erro ao aprovar cliente:", error);
      alert("Erro ao aprovar cliente.");
    }
  };

  const recusarCliente = async (id, nomeCliente) => {
    const confirmar = window.confirm("Tem certeza que deseja recusar e excluir este cadastro definitivamente?");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        await registrarLog("RECUSA DE CLIENTE", `Recusou e excluiu o cadastro do cliente: "${nomeCliente || 'Desconhecido'}".`);
        carregarDados();
      } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        alert("Erro ao excluir cliente.");
      }
    }
  };

  // Contadores rápidos
  const contagemClientes = useMemo(() => listaUnificada.filter(i => i.tipoNotificacao === 'cliente').length, [listaUnificada]);
  const contagemOrcamentos = useMemo(() => listaUnificada.filter(i => i.tipoNotificacao === 'orcamento').length, [listaUnificada]);

  // Lista filtrada
  const itensExibidos = useMemo(() => {
    if (filtroTipo === 'todos') return listaUnificada;
    return listaUnificada.filter(i => i.tipoNotificacao === filtroTipo);
  }, [listaUnificada, filtroTipo]);

  return (
    <div className="notificacoes-container fade-in">
      <div className="notificacoes-max-width">
        
        {/* TOP BAR / HEADER */}
        <header className="notificacoes-header">
          <div className="noti-header-info">
            <span className="noti-badge-pill-header">
              <i className="fas fa-bell"></i> Central de Entrada & Notificações
            </span>
            <h1>Caixa de Entrada 📥</h1>
            <p>Gerencie em tempo real novos clientes e pedidos de orçamento que acabaram de chegar.</p>
          </div>

          <div className="noti-header-actions">
            <button
              type="button"
              className="btn-noti-header"
              onClick={() => carregarDados(true)}
              disabled={atualizando || loading}
              title="Recarregar notificações"
            >
              <i className={`fas fa-sync-alt ${atualizando ? 'fa-spin' : ''}`} style={{ color: 'var(--dourado, #c5a059)' }}></i>
              <span>{atualizando ? 'Atualizando...' : 'Atualizar'}</span>
            </button>

            <button
              type="button"
              className="btn-noti-header"
              onClick={() => navigate('/configuracoes', { state: { aba: 'notificacoes' } })}
              title="Configurar disparos automáticos e modelos de notificação"
            >
              <i className="fas fa-sliders-h" style={{ color: 'var(--dourado, #c5a059)' }}></i>
              <span>Configurar Disparos</span>
            </button>
          </div>
        </header>

        {/* BARRA DE FILTROS & TABS */}
        <div className="notificacoes-filtros-bar">
          <button
            type="button"
            className={`noti-filter-chip ${filtroTipo === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroTipo('todos')}
          >
            <span>Todos</span>
            <span className="noti-chip-count">{listaUnificada.length}</span>
          </button>

          <button
            type="button"
            className={`noti-filter-chip ${filtroTipo === 'cliente' ? 'active' : ''}`}
            onClick={() => setFiltroTipo('cliente')}
          >
            <i className="fas fa-user-plus" style={{ fontSize: '0.75rem' }}></i>
            <span>Novos Cadastros</span>
            <span className="noti-chip-count">{contagemClientes}</span>
          </button>

          <button
            type="button"
            className={`noti-filter-chip ${filtroTipo === 'orcamento' ? 'active' : ''}`}
            onClick={() => setFiltroTipo('orcamento')}
          >
            <i className="fas fa-shopping-bag" style={{ fontSize: '0.75rem' }}></i>
            <span>Orçamentos do Catálogo</span>
            <span className="noti-chip-count">{contagemOrcamentos}</span>
          </button>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        {loading ? (
          <div className="loading-notificacoes">
            <i className="fas fa-circle-notch fa-spin fa-2x" style={{ color: 'var(--dourado, #c5a059)' }}></i>
            <span>Buscando novidades em tempo real...</span>
          </div>
        ) : (
          <div className="notificacoes-lista">
            {itensExibidos.length === 0 ? (
              <div className="notificacao-vazia">
                <div className="empty-icon-medallion">
                  <i className="fas fa-check-double"></i>
                </div>
                <h3>Tudo limpo por aqui! 🎉</h3>
                <p>
                  {filtroTipo === 'todos' 
                    ? 'Nenhum novo cadastro ou orçamento aguardando sua revisão no momento. Todos os atendimentos estão em dia!'
                    : `Nenhum item pendente na categoria "${filtroTipo === 'cliente' ? 'Novos Cadastros' : 'Orçamentos do Catálogo'}".`}
                </p>
                <div className="empty-actions-row">
                  <button 
                    type="button" 
                    className="btn-noti-header"
                    onClick={() => navigate('/clientes')}
                  >
                    <i className="fas fa-users" style={{ color: 'var(--dourado, #c5a059)' }}></i>
                    <span>Ver Todos os Clientes</span>
                  </button>
                </div>
              </div>
            ) : (
              itensExibidos.map(item => {
                // CARD DE NOVO CLIENTE
                if (item.tipoNotificacao === 'cliente') {
                  const nomeFormatado = formatarNomeCapitalizado(item.nome || item.nomeCompleto || item.razaoSocial || 'Novo Cliente');
                  const telefone = item.contato || item.celular || item.telefone || '';
                  const telLimpo = telefone.replace(/\D/g, '');
                  const linkZap = telLimpo ? `https://wa.me/55${telLimpo}?text=${encodeURIComponent(`Olá ${nomeFormatado.split(' ')[0]}! Tudo bem? Recebemos seu cadastro na Celebre Festas.`)}` : null;
                  const tempoRelativo = formatarTempoDecorrido(item.timestampOrdenacao);

                  return (
                    <div key={`cli-${item.id}`} className="noti-card-luxury tipo-cliente">
                      <div className="noti-info-bloco">
                        <div className="noti-medallion medallion-cliente" title="Novo Cadastro de Cliente">
                          <i className="fas fa-user-plus"></i>
                        </div>

                        <div className="noti-textos">
                          <div className="noti-tags-row">
                            <span className="noti-pill-tag tag-cliente">
                              <i className="fas fa-id-card"></i> Novo Cadastro
                            </span>
                            <span className="noti-time-stamp">
                              <i className="far fa-clock"></i> {tempoRelativo}
                            </span>
                          </div>

                          <h3 className="noti-title-nome" title={nomeFormatado}>
                            {nomeFormatado}
                          </h3>

                          <div className="noti-detalhes-row">
                            {linkZap ? (
                              <a 
                                href={linkZap} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="noti-whatsapp-link"
                                title="Conversar no WhatsApp"
                              >
                                <i className="fab fa-whatsapp"></i> {formatarTelefoneVisual(telefone)}
                              </a>
                            ) : (
                              <span>WhatsApp não informado</span>
                            )}

                            {item.cidade && (
                              <span className="noti-micro-chip">
                                <i className="fas fa-map-marker-alt" style={{ color: '#64748b' }}></i>
                                {formatarNomeCapitalizado(item.cidade)}{item.bairro ? ` - ${formatarNomeCapitalizado(item.bairro)}` : ''}
                              </span>
                            )}

                            {(item.cpf || item.cnpj) && (
                              <span className="noti-micro-chip">
                                <i className="fas fa-shield-alt" style={{ color: '#16a34a' }}></i>
                                {item.cpf ? `CPF: ${item.cpf}` : `CNPJ: ${item.cnpj}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="noti-acoes-bloco">
                        <button 
                          type="button"
                          className="noti-action-btn btn-revisar" 
                          onClick={() => navigate('/cadastro-cliente', { state: { clienteEditando: item } })}
                          title="Abrir formulário para revisar e editar dados"
                        >
                          <i className="fas fa-edit"></i> Revisar
                        </button>

                        <button 
                          type="button"
                          className="noti-action-btn btn-recusar" 
                          onClick={() => recusarCliente(item.id, nomeFormatado)}
                          title="Recusar e remover este cadastro"
                        >
                          <i className="fas fa-times"></i> Recusar
                        </button>

                        <button 
                          type="button"
                          className="noti-action-btn btn-aprovar" 
                          onClick={() => aprovarCliente(item.id, nomeFormatado)}
                          title="Aprovar e ativar este cliente"
                        >
                          <i className="fas fa-check"></i> Aprovar
                        </button>
                      </div>
                    </div>
                  );
                }

                // CARD DE ORÇAMENTO DO CATÁLOGO
                if (item.tipoNotificacao === 'orcamento') {
                  const nomeFormatado = formatarNomeCapitalizado(item.clienteNome || 'Cliente do Catálogo');
                  const telefone = item.clienteWhats || '';
                  const telLimpo = telefone.replace(/\D/g, '');
                  const qtdItens = item.itens?.length || 0;
                  const valorTotal = Number(item.valorTotal || 0);
                  const linkZap = telLimpo ? `https://wa.me/55${telLimpo}?text=${encodeURIComponent(`Olá ${nomeFormatado.split(' ')[0]}! Recebemos sua lista de ${qtdItens} peça${qtdItens === 1 ? '' : 's'} no valor de R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na Celebre Festas.`)}` : null;
                  const tempoRelativo = formatarTempoDecorrido(item.timestampOrdenacao);
                  const dataEventoFmt = item.dataRetirada ? item.dataRetirada.split('-').reverse().join('/') : null;

                  return (
                    <div key={`orc-${item.id}`} className="noti-card-luxury tipo-orcamento">
                      <div className="noti-info-bloco">
                        <div className="noti-medallion medallion-orcamento" title="Orçamento do Catálogo Online">
                          <i className="fas fa-shopping-bag"></i>
                        </div>

                        <div className="noti-textos">
                          <div className="noti-tags-row">
                            <span className="noti-pill-tag tag-orcamento">
                              <i className="fas fa-globe"></i> Orçamento Web
                            </span>
                            <span className="noti-time-stamp">
                              <i className="far fa-clock"></i> {tempoRelativo}
                            </span>
                          </div>

                          <h3 className="noti-title-nome" title={nomeFormatado}>
                            {nomeFormatado}
                          </h3>

                          <div className="noti-detalhes-row">
                            <span className="noti-valor-badge">
                              R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>

                            {dataEventoFmt && (
                              <span className="noti-micro-chip">
                                <i className="far fa-calendar-alt" style={{ color: '#2563eb' }}></i>
                                Festa: {dataEventoFmt}
                              </span>
                            )}

                            {qtdItens > 0 && (
                              <span className="noti-micro-chip">
                                <i className="fas fa-box-open" style={{ color: '#c5a059' }}></i>
                                {qtdItens} {qtdItens === 1 ? 'peça selecionada' : 'peças selecionadas'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="noti-acoes-bloco">
                        {linkZap && (
                          <a 
                            href={linkZap}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="noti-action-btn btn-zap-pedido"
                            title="Chamar cliente no WhatsApp"
                          >
                            <i className="fab fa-whatsapp"></i> WhatsApp
                          </a>
                        )}

                        <button 
                          type="button"
                          className="noti-action-btn btn-abrir-pedido" 
                          onClick={() => navigate(`/locacoes/editar/${item.id}`)}
                          title="Abrir e gerenciar orçamento na tela de locações"
                        >
                          <span>Abrir Pedido</span>
                          <i className="fas fa-arrow-right"></i>
                        </button>
                      </div>
                    </div>
                  );
                }

                return null;
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Notificacoes;