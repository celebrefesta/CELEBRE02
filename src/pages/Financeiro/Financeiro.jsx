import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, deleteDoc, doc, where, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import "./Financeiro.css";

const Financeiro = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [abaAtiva, setAbaAtiva] = useState('lancamentos'); // 'lancamentos' | 'comprovantes'
  const [transacoes, setTransacoes] = useState([]);
  const [comprovantesExtras, setComprovantesExtras] = useState([]);

  // Filtros da Galeria de Comprovantes
  const [buscaComprovante, setBuscaComprovante] = useState('');
  const [filtroForma, setFiltroForma] = useState('todas');
  const [comprovanteModal, setComprovanteModal] = useState(null);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
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
      console.error("Erro ao gravar log da auditoria financeira:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS as transações da sua empresa 
    const q = query(collection(db, "financeiro_lancamentos"), where("userId", "==", tenantId));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Ordenação segura
      lista.sort((a, b) => {
         const dataA = a.data ? new Date(a.data).getTime() : 0;
         const dataB = b.data ? new Date(b.data).getTime() : 0;
         if (dataB === dataA) {
             const criacaoA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const criacaoB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return criacaoB - criacaoA;
         }
         return dataB - dataA;
      });

      setTransacoes(lista);
    });

    // Busca comprovantes de locações ativas que possuam anexo de comprovante
    const carregarComprovantesLocacoes = async () => {
      try {
        const qLoc = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snapLoc = await getDocs(qLoc);
        const locsComComprovante = snapLoc.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.ultimoComprovanteUrl);
        setComprovantesExtras(locsComComprovante);
      } catch (err) {
        console.error("Erro ao buscar comprovantes de locações:", err);
      }
    };

    carregarComprovantesLocacoes();

    return () => unsubscribe();
  }, [usuarioLogado, navigate, tenantId]);

  // Lista unificada de comprovantes recebidos
  const todosComprovantes = [
    ...transacoes.filter(t => t.comprovanteUrl).map(t => ({
      id: t.id,
      titulo: t.descricao || 'Lançamento de Caixa',
      valor: t.valor,
      data: t.data,
      formaPagto: t.formaPagto || 'Pix',
      comprovanteUrl: t.comprovanteUrl,
      comprovanteNome: t.comprovanteNome || 'Comprovante.jpg',
      origem: 'Caixa'
    })),
    ...comprovantesExtras.map(l => ({
      id: `loc_${l.id}`,
      titulo: `Ref. Pedido #${l.numeroPedido || (l.id ? l.id.substring(0,6).toUpperCase() : 'S/N')} - ${l.clienteNome || 'Cliente'}`,
      valor: l.valorPago || l.valorTotal || 0,
      data: l.dataCriacao || l.dataRetirada || new Date().toISOString().split('T')[0],
      formaPagto: 'Locação',
      comprovanteUrl: l.ultimoComprovanteUrl,
      comprovanteNome: l.ultimoComprovanteNome || 'Comprovante_Pedido.jpg',
      origem: 'Pedido'
    }))
  ];

  // Remove duplicados de URL
  const comprovantesUnicos = todosComprovantes.filter((item, index, self) =>
    index === self.findIndex(t => t.comprovanteUrl === item.comprovanteUrl)
  );

  // Filtragem da galeria
  const comprovantesFiltrados = comprovantesUnicos.filter(item => {
    const termo = buscaComprovante.toLowerCase();
    const bateTexto = item.titulo.toLowerCase().includes(termo) || 
                      (item.comprovanteNome && item.comprovanteNome.toLowerCase().includes(termo)) ||
                      String(item.valor).includes(termo);
    const bateForma = filtroForma === 'todas' || item.formaPagto.toLowerCase().includes(filtroForma.toLowerCase());
    return bateTexto && bateForma;
  });

  // Cálculos dos Cards KPI
  const totalEntradas = transacoes.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0);
  const totalSaidas = transacoes.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0);
  const saldoLiquido = totalEntradas - totalSaidas;

  const handleExcluirLancamento = async (transacao) => {
    const confirmacao = window.confirm(`⚠️ CUIDADO: Tem certeza que deseja excluir "${transacao.descricao}"? Esta ação é irreversível.`);
    if (confirmacao) {
      try {
        const valorFormatado = Number(transacao.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const detalhesLog = `Excluiu um lançamento de ${transacao.tipo.toUpperCase()} no valor de ${valorFormatado}. Descrição: ${transacao.descricao}`;
        
        await registrarLog("EXCLUSÃO FINANCEIRA", detalhesLog);
        await deleteDoc(doc(db, "financeiro_lancamentos", transacao.id));
        
        alert("Lançamento removido com sucesso!");
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir lançamento.");
      }
    }
  };

  return (
    <div className="pag-financeiro-main">
      <div className="financeiro-content">
        
       {/* CABEÇALHO */}
        <header className="fin-header-modern">
          <div className="fin-title-area">
            <h1>Financeiro</h1>
            <p>Controle de caixa, entradas e auditoria de comprovantes</p>
          </div>
  
          <div className="fin-action-buttons">
            <button className="btn-novo-lancamento-unico" onClick={() => navigate('/financeiro/novo')}>
              + Novo Lançamento
            </button>
          </div>
        </header>

        {/* NAVEGAÇÃO ENTRE ABAS */}
        <div className="fin-tabs-nav">
          <button 
            className={`fin-tab-btn ${abaAtiva === 'lancamentos' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('lancamentos')}
          >
            📊 Fluxo de Caixa / Lançamentos
          </button>

          <button 
            className={`fin-tab-btn ${abaAtiva === 'comprovantes' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('comprovantes')}
          >
            📎 Comprovantes Recebidos 
            {comprovantesUnicos.length > 0 && (
              <span className="fin-tab-badge">{comprovantesUnicos.length}</span>
            )}
          </button>
        </div>

        {/* ================= ABA 1: FLUXO DE CAIXA / LANÇAMENTOS ================= */}
        {abaAtiva === 'lancamentos' && (
          <>
            {/* CARDS DE RESUMO (KPIs) */}
            <div className="fin-kpi-grid">
              <div className="kpi-card card-entradas">
                <div className="kpi-header">
                  <span>ENTRADAS (RECEBIDO)</span>
                  <div className="kpi-icon">💰</div>
                </div>
                <h2>{totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
              </div>

              <div className="kpi-card card-saidas">
                <div className="kpi-header">
                  <span>SAÍDAS (PAGO)</span>
                  <div className="kpi-icon">📄</div>
                </div>
                <h2>{totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
              </div>

              <div className="kpi-card card-saldo">
                <div className="kpi-header">
                  <span>SALDO LÍQUIDO</span>
                  <div className="kpi-icon">🏦</div>
                </div>
                <h2>{saldoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
                <p className="kpi-subtitle">Disponível em caixa</p>
              </div>
            </div>

            {/* TABELA DE TRANSAÇÕES */}
            <div className="fin-table-container">
              <table className="fin-table-modern">
                <thead>
                  <tr>
                    <th>DATA</th>
                    <th>CATEGORIA</th>
                    <th>DESCRIÇÃO</th>
                    <th>FORMA PAGTO</th>
                    <th className="centro">COMPROVANTE</th>
                    <th className="direita">VALOR (R$)</th>
                    <th className="centro">SITUAÇÃO</th>
                    <th className="centro">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {transacoes.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="fin-empty">Nenhuma transação registrada.</td>
                    </tr>
                  ) : (
                    transacoes.map(t => (
                      <tr key={t.id}>
                        <td className="col-data">{new Date(t.data + "T12:00").toLocaleDateString('pt-BR')}</td>
                        
                        <td>
                          <span className={`badge-categoria ${t.tipo}`}>
                            {t.categoria || (t.tipo === 'entrada' ? 'Receita' : 'Despesa')}
                          </span>
                        </td>
                        
                        <td className="col-desc"><strong>{t.descricao}</strong></td>
                        
                        <td style={{ color: '#64748b', fontSize: '13px' }}>
                          {t.formaPagto || '---'}
                        </td>

                        <td className="centro">
                          {t.comprovanteUrl ? (
                            <button 
                              className="btn-comprovante-link"
                              onClick={() => setComprovanteModal({
                                titulo: t.descricao,
                                valor: t.valor,
                                data: t.data,
                                formaPagto: t.formaPagto || 'Pix',
                                comprovanteUrl: t.comprovanteUrl,
                                comprovanteNome: t.comprovanteNome || 'Comprovante.jpg'
                              })}
                            >
                              📎 Ver Anexo
                            </button>
                          ) : (
                            <span className="txt-sem-anexo">---</span>
                          )}
                        </td>

                        <td className={`direita col-valor ${t.tipo === 'entrada' ? 'txt-verde' : 'txt-vermelho'}`}>
                          {t.tipo === 'entrada' ? '+ ' : '- '}
                          {Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>

                        <td className="centro">
                          <span style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                            backgroundColor: t.status === 'pendente' ? '#fefce8' : '#ecfdf5',
                            color: t.status === 'pendente' ? '#a16207' : '#15803d',
                            border: `1px solid ${t.status === 'pendente' ? '#fde047' : '#86efac'}`
                          }}>
                            {t.status === 'pendente' ? 'Pendente' : 'Pago'}
                          </span>
                        </td>

                        <td className="centro">
                          <button className="btn-icon-excluir" title="Excluir" onClick={() => handleExcluirLancamento(t)}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ================= ABA 2: GALERIA DE COMPROVANTES RECEBIDOS ================= */}
        {abaAtiva === 'comprovantes' && (
          <div className="secao-comprovantes-galeria">
            {/* CONTROLES DE BUSCA E FILTROS */}
            <div className="bar-filtros-comprovante">
              <div className="search-box-comprovante">
                <i className="fas fa-search search-icon-gold"></i>
                <input 
                  type="text" 
                  placeholder="Buscar por cliente, pedido ou valor..." 
                  value={buscaComprovante}
                  onChange={e => setBuscaComprovante(e.target.value)}
                />
                {buscaComprovante && (
                  <button className="btn-clear-search" onClick={() => setBuscaComprovante('')}>✕</button>
                )}
              </div>

              <div className="pills-filtros-forma">
                {[
                  { id: 'todas', label: 'Todos' },
                  { id: 'Pix', label: '⚡ Pix' },
                  { id: 'Dinheiro', label: '💵 Dinheiro' },
                  { id: 'Cartão', label: '💳 Cartão' },
                  { id: 'Transferência', label: '🏦 Transferência' }
                ].map(f => (
                  <button 
                    key={f.id}
                    className={`pill-forma-btn ${filtroForma === f.id ? 'active' : ''}`}
                    onClick={() => setFiltroForma(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* GRID DA GALERIA */}
            {comprovantesFiltrados.length === 0 ? (
              <div className="empty-comprovantes-card">
                <div className="empty-icon-box">📎</div>
                <h3>Nenhum comprovante anexado</h3>
                <p>Assim que um recebimento for registrado com anexo de comprovante, ele surgirá aqui automaticamente.</p>
              </div>
            ) : (
              <div className="grid-galeria-comprovantes">
                {comprovantesFiltrados.map((item, idx) => (
                  <div className="card-comprovante-item" key={item.id || idx}>
                    <div className="card-comprovante-header">
                      <span className="badge-forma-pagto">{item.formaPagto}</span>
                      <span className="badge-origem-tipo">{item.origem}</span>
                    </div>

                    <div 
                      className="comprovante-thumb-wrapper"
                      onClick={() => setComprovanteModal(item)}
                    >
                      {item.comprovanteUrl.startsWith('data:image') || item.comprovanteUrl.match(/\.(jpeg|jpg|png|webp)/i) ? (
                        <img src={item.comprovanteUrl} alt={item.titulo} className="img-comprovante-cover" />
                      ) : (
                        <div className="pdf-thumb-box">
                          <i className="fas fa-file-pdf icon-pdf"></i>
                          <span>📄 PDF</span>
                        </div>
                      )}
                      <div className="overlay-hover-thumb">
                        <span>🔍 Ampliar</span>
                      </div>
                    </div>

                    <div className="card-comprovante-body">
                      <h4 className="titulo-comprovante">{item.titulo}</h4>
                      <div className="meta-comprovante-row">
                        <span className="data-comprovante">
                          📅 {new Date(item.data + "T12:00").toLocaleDateString('pt-BR')}
                        </span>
                        <strong className="valor-comprovante">
                          R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>

                    <div className="card-comprovante-footer">
                      <button 
                        className="btn-ver-comprovante-full"
                        onClick={() => setComprovanteModal(item)}
                      >
                        👁️ Ver Comprovante
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL DE AMPLIAÇÃO DO COMPROVANTE */}
        {comprovanteModal && (
          <div className="modal-overlay-v2" onClick={() => setComprovanteModal(null)}>
            <div className="modal-box-v2 modal-comprovante-view" onClick={e => e.stopPropagation()}>
              <div className="modal-header-luxury">
                <div className="header-title-flex">
                  <div className="header-badge-gold">
                    <i className="fas fa-receipt"></i>
                  </div>
                  <div>
                    <h3>{comprovanteModal.titulo}</h3>
                    <p>
                      Data: {new Date(comprovanteModal.data + "T12:00").toLocaleDateString('pt-BR')} | 
                      Valor: R$ {Number(comprovanteModal.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({comprovanteModal.formaPagto})
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-fechar-modal" onClick={() => setComprovanteModal(null)}>✕</button>
              </div>

              <div className="body-comprovante-viewer">
                {comprovanteModal.comprovanteUrl.startsWith('data:image') || comprovanteModal.comprovanteUrl.match(/\.(jpeg|jpg|png|webp)/i) ? (
                  <img src={comprovanteModal.comprovanteUrl} alt="Comprovante Ampliado" className="img-comprovante-full" />
                ) : (
                  <iframe src={comprovanteModal.comprovanteUrl} title="Documento PDF" className="iframe-pdf-full"></iframe>
                )}
              </div>

              <div className="modal-actions-luxury">
                <button 
                  type="button" 
                  className="btn-cancel-luxury" 
                  onClick={() => setComprovanteModal(null)}
                >
                  Fechar
                </button>
                <button 
                  type="button" 
                  className="btn-confirm-gold" 
                  onClick={() => {
                    const win = window.open();
                    if (win) {
                      win.document.write(`<title>${comprovanteModal.titulo}</title><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#0f172a;"><img src="${comprovanteModal.comprovanteUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
                    }
                  }}
                >
                  🔗 Abrir em Nova Aba
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Financeiro;