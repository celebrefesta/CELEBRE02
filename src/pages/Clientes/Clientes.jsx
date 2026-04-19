import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Clientes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const getTagStyle = (tag) => {
  if (!tag) return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  const normalizedTag = tag.toUpperCase().trim();
  const styles = {
    'NOVO': { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' }, 
    'VIP': { bg: '#fef08a', color: '#854d0e', border: '#fde047' }, 
    'PROBLEMÁTICO': { bg: '#fecaca', color: '#991b1b', border: '#fca5a5' }, 
    'RECORRENTE': { bg: '#bbf7d0', color: '#166534', border: '#86efac' }, 
    'PECHINCHA': { bg: '#fed7aa', color: '#9a3412', border: '#fdba74' }, 
    'ECONÔMICO': { bg: '#e9d5ff', color: '#6b21a8', border: '#d8b4fe' }, 
    'INDECISO': { bg: '#fbcfe8', color: '#9d174d', border: '#f9a8d4' }, 
    'EXIGENTE': { bg: '#bfdbfe', color: '#1e40af', border: '#93c5fd' }, 
    'ORGANIZADO': { bg: '#a7f3d0', color: '#065f46', border: '#6ee7b7' }, 
    'ÚLTIMA HORA': { bg: '#fecdd3', color: '#be123c', border: '#fda4af' }, 
    'BÁSICO': { bg: '#e5e7eb', color: '#374151', border: '#d1d5db' }, 
    'FAMÍLIA': { bg: '#c7d2fe', color: '#3730a3', border: '#a5b4fc' }, 
    'FAMILIA': { bg: '#c7d2fe', color: '#3730a3', border: '#a5b4fc' }, 
  };
  return styles[normalizedTag] || { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' }; 
};

const Clientes = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); 
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('A-Z');

  const [menuAberto, setMenuAberto] = useState(null); 
  const [allLocacoes, setAllLocacoes] = useState([]); 
  const [modalAberto, setModalAberto] = useState(false);
  const [detalhesDivida, setDetalhesDivida] = useState({ cliente: '', pendencias: [] });

  const [clienteVisualizacao, setClienteVisualizacao] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('dados'); 

  useEffect(() => { 
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    carregarClientes(); 
  }, [usuarioLogado, navigate]);

  const carregarClientes = async () => {
    if (!usuarioLogado) return;
    setLoading(true);
    try {
      const qClientes = query(collection(db, "clientes"), where("userId", "==", usuarioLogado.uid));
      const querySnapshot = await getDocs(qClientes);
      let listaClientes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", usuarioLogado.uid));
      const snapLocacoes = await getDocs(qLocacoes);
      const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllLocacoes(locacoes);

      const hoje = new Date(); 
      hoje.setHours(0, 0, 0, 0);
      const batch = writeBatch(db);
      let precisaAtualizarBanco = false;

      listaClientes = listaClientes.map(cliente => {
        let temDivida = false;
        const locsCliente = locacoes.filter(loc => loc.clienteId === cliente.id || loc.cliente?.id === cliente.id);

        locsCliente.forEach(loc => {
          if (loc.status === 'cancelado' || loc.status === 'orcamento') return;
          const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
          if (dataStr) {
            const dataEvento = new Date(dataStr + 'T00:00:00');
            const pagStatus = (loc.statusPagamento || '').toLowerCase();
            const vTotal = Number(loc.valorTotal || loc.total || 0);
            const vPago = Number(loc.valorPago || 0);
            if (dataEvento < hoje && (vTotal - vPago) > 0.01 && pagStatus !== 'pago' && pagStatus !== 'quitado') {
              temDivida = true;
            }
          }
        });

        const statusCorreto = temDivida ? 'inadimplente' : 'adimplente';
        if (cliente.situacaoFinanceira !== statusCorreto) {
           batch.update(doc(db, "clientes", cliente.id), { situacaoFinanceira: statusCorreto });
           precisaAtualizarBanco = true;
           cliente.situacaoFinanceira = statusCorreto;
        }
        return cliente;
      });

      if (precisaAtualizarBanco) await batch.commit();
      setClientes(listaClientes);

    } catch (error) { 
      console.error("Erro ao carregar clientes:", error);
    } finally { 
      setLoading(false); 
    }
  };

  const verPorQueInadimplente = (e, cliente) => {
    e.stopPropagation(); 
    if (cliente.situacaoFinanceira !== 'inadimplente') return;

    const hoje = new Date(); 
    hoje.setHours(0, 0, 0, 0);

    const pendencias = allLocacoes.filter(loc => {
      if (loc.clienteId !== cliente.id && loc.cliente?.id !== cliente.id) return false;
      if (loc.status === 'cancelado' || loc.status === 'orcamento') return false;
      const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
      if (!dataStr) return false;
      const dataEvento = new Date(dataStr + 'T00:00:00');
      const pagStatus = (loc.statusPagamento || '').toLowerCase();
      const vTotal = Number(loc.valorTotal || loc.total || 0);
      const vPago = Number(loc.valorPago || 0);
      return dataEvento < hoje && (vTotal - vPago) > 0.01 && pagStatus !== 'pago' && pagStatus !== 'quitado';
    });

    setDetalhesDivida({ cliente: cliente.nome || cliente.nomeFantasia, pendencias });
    setModalAberto(true);
  };

  const irParaLocacaoEspecifica = (pedidoId) => {
    setModalAberto(false);
    setClienteVisualizacao(null); 
    navigate(`/locacoes/editar/${pedidoId}`); 
  };

  const excluirCliente = async (id, nome) => {
    if (window.confirm(`ATENÇÃO: Excluir ${nome} apagará todos os pedidos vinculados. Deseja continuar?`)) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        const pedidosSnap = await getDocs(query(collection(db, "locacoes"), where("clienteId", "==", id)));
        if (!pedidosSnap.empty) {
            const batch = writeBatch(db);
            pedidosSnap.forEach((docPedido) => batch.delete(docPedido.ref));
            await batch.commit();
        }
        carregarClientes(); 
        setClienteVisualizacao(null);
      } catch (error) { 
        alert("Erro ao excluir."); 
      }
    }
  };

  const getHistoricoDoCliente = (clienteId) => {
    const historico = allLocacoes.filter(loc => loc.clienteId === clienteId || loc.cliente?.id === clienteId);
    const totalGasto = historico.reduce((soma, loc) => {
        const st = String(loc.status || '').toLowerCase();
        if (!st.includes('cancelado') && !st.includes('orcam')) {
            return soma + Number(loc.valorTotal || loc.total || 0);
        }
        return soma;
    }, 0);
    historico.sort((a, b) => {
        const dataA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 0;
        const dataB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 0;
        return dataB - dataA;
    });
    return { historico, totalGasto };
  };

  const abrirFichario = (c) => {
    setClienteVisualizacao(c);
    setAbaAtiva('dados'); 
  };

  const editarCliente = (e, cliente) => {
    if (e) e.stopPropagation(); 
    navigate('/cadastro-cliente', { state: { clienteEditando: cliente } });
  };

  const toggleMenu = (e, id) => {
    e.stopPropagation(); 
    setMenuAberto(menuAberto === id ? null : id);
  };

  const formatarTelefone = (tel) => {
    if (!tel) return '';
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 11) return `(${limpo.slice(0,2)}) ${limpo.slice(2,7)}-${limpo.slice(7)}`;
    if (limpo.length === 10) return `(${limpo.slice(0,2)}) ${limpo.slice(2,6)}-${limpo.slice(6)}`;
    return tel; 
  };

  const formatarNomeCapitalizado = (nomeBruto) => {
    if (!nomeBruto) return '';
    const palavras = nomeBruto.trim().toLowerCase().split(/\s+/);
    const conectores = ['da', 'de', 'do', 'das', 'dos', 'e'];
    return palavras.map((palavra, index) => {
        if (index > 0 && conectores.includes(palavra)) return palavra;
        return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
  };

  let clientesFiltrados = clientes.filter(c => {
    const termo = busca.toLowerCase();
    const matchBusca = (c.nome?.toLowerCase().includes(termo)) || (c.nomeFantasia?.toLowerCase().includes(termo)) || (c.cpf?.includes(termo)) || (c.cnpj?.includes(termo));
    if (filtroStatus === 'adimplentes') return matchBusca && c.situacaoFinanceira === 'adimplente';
    if (filtroStatus === 'inadimplentes') return matchBusca && c.situacaoFinanceira === 'inadimplente';
    return matchBusca;
  });

  clientesFiltrados.sort((a, b) => {
      const nomeA = (a.tipoPessoa === 'juridica' ? a.nomeFantasia : a.nome || '').toLowerCase();
      const nomeB = (b.tipoPessoa === 'juridica' ? b.nomeFantasia : b.nome || '').toLowerCase();
      if (ordemAlfabetica === 'A-Z') return nomeA.localeCompare(nomeB);
      if (ordemAlfabetica === 'Z-A') return nomeB.localeCompare(nomeA);
      return 0;
  });

  const renderFicharioCliente = () => {
    if (!clienteVisualizacao) return null;

    const nomeBonito = formatarNomeCapitalizado(clienteVisualizacao.tipoPessoa === 'juridica' ? clienteVisualizacao.nomeFantasia : clienteVisualizacao.nome || '?');
    const tagColorida = clienteVisualizacao.tags ? getTagStyle(clienteVisualizacao.tags) : null;
    const { historico, totalGasto } = getHistoricoDoCliente(clienteVisualizacao.id);

    return (
      <div className="modal-overlay-perfil" onClick={() => setClienteVisualizacao(null)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px 10px', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        
        {/* MODAL CONTAINER - Ajustado para não bloquear a rolagem interna no mobile */}
        <div className="modal-content-perfil-large" onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '900px', background: '#fff', borderRadius: '12px', padding: '20px', height: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <button className="btn-fechar-perfil" onClick={() => setClienteVisualizacao(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>

          <div className="perfil-layout-split" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* LADO ESQUERDO: FOTO E RESUMO */}
            <div className="perfil-left-col" style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <div className="perfil-foto-container" style={{ width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #f1f5f9' }}>
                {clienteVisualizacao.foto ? (
                    <img src={clienteVisualizacao.foto} alt={nomeBonito} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 'bold' }}>{nomeBonito.charAt(0)}</div>
                )}
              </div>
              
              <h2 style={{ fontSize: '20px', color: '#0f172a', textAlign: 'center', margin: 0 }}>{nomeBonito}</h2>
              {tagColorida && (
                  <span style={{ backgroundColor: tagColorida.bg, color: tagColorida.color, border: `1px solid ${tagColorida.border}`, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                      {clienteVisualizacao.tags}
                  </span>
              )}

              <div style={{ width: '100%', background: '#f8fafc', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}><span style={{ color: '#64748b' }}>💰 LTV (Gasto):</span> <strong style={{ color: '#0f172a' }}>R$ {totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}><span style={{ color: '#64748b' }}>📦 Locações:</span> <strong style={{ color: '#0f172a' }}>{historico.length}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}><span style={{ color: '#64748b' }}>📅 Cliente Desde:</span> <strong style={{ color: '#0f172a' }}>{clienteVisualizacao.criadoEm ? new Date(clienteVisualizacao.criadoEm).toLocaleDateString('pt-BR') : '-'}</strong></div>
              </div>

              <button onClick={() => { setClienteVisualizacao(null); navigate('/cadastro-cliente', { state: { clienteEditando: clienteVisualizacao } }); }} style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                ✏️ Editar Cadastro
              </button>
            </div>

            {/* LADO DIREITO: ABAS E CONTEÚDO */}
            <div className="perfil-right-col" style={{ flex: '2 1 350px', display: 'flex', flexDirection: 'column' }}>
                
                {/* ABAS - FORÇADAS A NÃO SEREM FIXAS */}
                <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px', position: 'static' }}>
                  <button onClick={() => setAbaAtiva('dados')} style={{ flex: 1, padding: '15px', background: 'none', border: 'none', borderBottom: abaAtiva === 'dados' ? '3px solid #3b82f6' : '3px solid transparent', color: abaAtiva === 'dados' ? '#3b82f6' : '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>👤 Dados Cadastrais</button>
                  <button onClick={() => setAbaAtiva('registros')} style={{ flex: 1, padding: '15px', background: 'none', border: 'none', borderBottom: abaAtiva === 'registros' ? '3px solid #3b82f6' : '3px solid transparent', color: abaAtiva === 'registros' ? '#3b82f6' : '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>📜 Histórico de Locações</button>
                </div>
                
                {/* CONTEÚDO DA ABA - SEM OVERFLOW LIMITANDO */}
                <div style={{ flex: 1 }}>
                  {abaAtiva === 'dados' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                          <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{clienteVisualizacao.tipoPessoa === 'juridica' ? 'Razão Social' : 'Nome Completo'}</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{clienteVisualizacao.nome || clienteVisualizacao.razaoSocial || '-'}</span></div>
                          <div><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{clienteVisualizacao.tipoPessoa === 'juridica' ? 'CNPJ' : 'CPF'}</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{clienteVisualizacao.cpf || clienteVisualizacao.cnpj || '-'}</span></div>
                          <div><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{clienteVisualizacao.tipoPessoa === 'juridica' ? 'Inscrição Estadual' : 'RG'}</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{clienteVisualizacao.rg || clienteVisualizacao.inscricaoEstadual || '-'}</span></div>
                          
                          <div><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Celular / WhatsApp</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{formatarTelefone(clienteVisualizacao.celular) || '-'}</span></div>
                          <div><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Telefone Fixo</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{formatarTelefone(clienteVisualizacao.telefoneFixo) || '-'}</span></div>
                          <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{clienteVisualizacao.email || '-'}</span></div>
                          
                          <div><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Nascimento</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{clienteVisualizacao.nascimento ? new Date(clienteVisualizacao.nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span></div>
                          <div><label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Como nos conheceu?</label><span style={{ color: '#0f172a', fontWeight: '500' }}>{clienteVisualizacao.origem || '-'}</span></div>
                          
                          <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Endereço Completo</label>
                            <span style={{ color: '#0f172a', fontWeight: '500', lineHeight: '1.4' }}>
                              {clienteVisualizacao.logradouro ? 
                              `${clienteVisualizacao.logradouro}, ${clienteVisualizacao.numero || 'S/N'} - ${clienteVisualizacao.complemento ? clienteVisualizacao.complemento + ' - ' : ''}${clienteVisualizacao.bairro}, ${clienteVisualizacao.cidade}/${clienteVisualizacao.uf} (CEP: ${clienteVisualizacao.cep})` 
                              : 'Endereço não cadastrado.'}
                            </span>
                          </div>
                          
                          <div style={{ gridColumn: '1 / -1', background: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                              <label style={{ fontSize: '11px', color: '#b45309', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Observações Internas</label>
                              <p style={{ margin: 0, color: '#92400e', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{clienteVisualizacao.observacoes || 'Nenhuma observação registrada.'}</p>
                          </div>
                      </div>
                  )}

                  {abaAtiva === 'registros' && (
                      <div>
                          {historico.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>Nenhuma locação encontrada para este cliente.</div>
                          ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                                      <th style={{ padding: '12px 8px' }}>Data</th>
                                      <th style={{ padding: '12px 8px' }}>Serviço</th>
                                      <th style={{ padding: '12px 8px' }}>Valor</th>
                                      <th style={{ padding: '12px 8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {historico.map(loc => {
                                      const st = String(loc.status || 'S/S').toLowerCase().replace(' ', '');
                                      const isCancelado = st.includes('cancelado') || loc.isOrcamentoVencido;
                                      
                                      let tipoServico = "DECORAÇÃO";
                                      if (loc.tipoServico || loc.modalidade) tipoServico = String(loc.tipoServico || loc.modalidade).toUpperCase();
                                      else if (loc.logistica && String(loc.logistica.tipoFrete || loc.logistica.frete).toUpperCase().includes('RETIRADA')) tipoServico = "PEGUE E MONTE";
                                      
                                      const temaFesta = loc.tema || loc.temaDaFesta || loc.temaFesta || loc.nomeTema || 'Sem tema';

                                      return (
                                      <tr key={loc.id} onClick={() => irParaLocacaoEspecifica(loc.id)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                          <td style={{ padding: '12px 8px' }}>{loc.dataRetirada ? new Date(loc.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                                          <td style={{ padding: '12px 8px' }}>
                                              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', display: 'block' }}>{tipoServico}</span>
                                              <span style={{ color: '#0f172a', fontWeight: '600' }}>{temaFesta}</span>
                                          </td>
                                          <td style={{ padding: '12px 8px', textDecoration: isCancelado ? 'line-through' : 'none', color: isCancelado ? '#94a3b8' : '#0f172a' }}>
                                            R$ {Number(loc.valorTotal || loc.total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                          </td>
                                          <td style={{ padding: '12px 8px' }}><span className={`h-badge-mini ${st}`}>{loc.status?.toUpperCase() || 'S/S'}</span></td>
                                      </tr>
                                    )})}
                                  </tbody>
                                </table>
                              </div>
                          )}
                        </div>
                  )}
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModalPendencias = () => {
    if (!modalAberto) return null;

    return (
      <div className="modal-overlay-financeiro">
        <div className="modal-content-financeiro">
          <div className="modal-header-fin">
            <div className="header-icon-title">
                <div className="icon-warning">⚠️</div>
                <div>
                    <h2>Análise de Pendência</h2>
                    <p className="modal-subtitle">{detalhesDivida.cliente}</p>
                </div>
            </div>
            <button onClick={() => setModalAberto(false)} className="btn-close-modal" title="Fechar janela">×</button>
          </div>
          <div className="modal-body-fin">
            <div className="alerta-explicativo">
                <strong>Por que consta como inadimplente?</strong>
                <p>O sistema identificou locações que <b>já passaram da data</b>, mas o pagamento ainda não foi marcado como <b>PAGO</b> ou <b>QUITADO</b>.</p>
            </div>
            <div className="lista-pendencias">
              {detalhesDivida.pendencias.map(p => {
                const vTotal = Number(p.valorTotal || p.total || 0);
                const vPago = Number(p.valorPago || 0);
                const saldoDevedor = vTotal - vPago;
                return (
                  <div key={p.id} className="card-pendencia-detalhada">
                    <div className="p-header"><span className="p-id">PEDIDO {p.numeroPedido ? `#${p.numeroPedido}` : `#${p.id.substring(0,6).toUpperCase()}`}</span></div>
                    <div className="p-detalhes">
                      <p>📅 <strong>Vencimento:</strong> {p.dataRetirada || p.dataEvento}</p>
                      <p>💰 <strong>Valor Total:</strong> R$ {vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p>🔴 <strong>Falta Pagar:</strong> <span style={{color: '#e53e3e', fontWeight: 'bold'}}>R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                    </div>
                    <button onClick={() => irParaLocacaoEspecifica(p.id)} className="btn-ir-locacao-destaque">Localizar e Receber 🔍</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="clientes-container dashboard-container">
      
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>MEUS CLIENTES</h1>
          <p>Gestão de carteira, contatos e histórico financeiro.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/cadastro-cliente" className="btn-primary-celebre">+ NOVO CLIENTE</Link>
        </div>
      </header>

      <div className="dashboard-cards">
        <div className="dash-card neutral">
          <div className="dash-icon" style={{background: '#e2e8f0', color: '#475569'}}>👥</div>
          <div className="dash-info">
            <h3 style={{color: '#64748b'}}>Total na Carteira</h3>
            <h2 style={{color: '#0f172a'}}>{clientes.length}</h2>
          </div>
        </div>
        <div className="dash-card success">
          <div className="dash-icon">✅</div>
          <div className="dash-info">
            <h3>Adimplentes (Tudo OK)</h3>
            <h2>{clientes.filter(c => c.situacaoFinanceira === 'adimplente').length}</h2>
          </div>
        </div>
        <div className="dash-card danger">
          <div className="dash-icon" style={{background: '#fef2f2', color: '#ef4444'}}>⚠️</div>
          <div className="dash-info">
            <h3 style={{color: '#b91c1c'}}>Com Pendências</h3>
            <h2 style={{color: '#991b1b'}}>{clientes.filter(c => c.situacaoFinanceira === 'inadimplente').length}</h2>
          </div>
        </div>
      </div>

      <div className="advanced-filter-bar">
        <div className="filter-main-row" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div className="search-group" style={{ flex: 2, minWidth: '200px' }}>
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar cliente por nome, CPF ou CNPJ..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button onClick={() => setOrdemAlfabetica(prev => prev === 'A-Z' ? 'Z-A' : 'A-Z')} style={{ flex: '0 0 auto', padding: '0 20px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
            {ordemAlfabetica === 'A-Z' ? '⬇️ A - Z' : '⬆️ Z - A'}
          </button>
          <div className="select-group" style={{ flex: 1, minWidth: '150px' }}>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 'bold', paddingLeft: '10px'}}>
              <option value="todos">📊 Todos os Status</option>
              <option value="adimplentes">✅ Apenas Adimplentes</option>
              <option value="inadimplentes">⚠️ Apenas Inadimplentes</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Analisando histórico financeiro dos clientes...</div>
      ) : (
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th width="40%">CLIENTE</th>
                <th>CONTATO</th>
                <th>LOCALIZAÇÃO</th>
                <th className="text-center">SITUAÇÃO</th>
                <th width="50px"></th> 
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: "center", padding: "40px", color: "#94a3b8"}}>Nenhum cliente encontrado.</td></tr>
              ) : (
                clientesFiltrados.map(c => {
                  const nomeBonito = formatarNomeCapitalizado(c.tipoPessoa === 'juridica' ? c.nomeFantasia : c.nome || '?');
                  const tagColorida = c.tags ? getTagStyle(c.tags) : null;

                  return (
                    <tr key={c.id} onMouseLeave={() => setMenuAberto(null)} className="table-row-hover" onClick={() => abrirFichario(c)} style={{cursor: 'pointer'}}> 
                      <td className="cliente-cell">
                        <div className="cliente-info-wrapper">
                          {c.foto ? (<img src={c.foto} className="avatar-quadrado" alt={nomeBonito} />) : (<div className="avatar-quadrado" style={{background: '#f1f5f9', color: '#0f172a'}}>{nomeBonito.charAt(0)}</div>)}
                          <div className="user-details">
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                <strong style={{color: '#0f172a', fontSize: '15px'}}>{nomeBonito}</strong>
                                {tagColorida && (
                                    <span style={{ backgroundColor: tagColorida.bg, color: tagColorida.color, border: `1px solid ${tagColorida.border}`, padding: '3px 10px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                                        {c.tags}
                                    </span>
                                )}
                            </div>
                            <span style={{color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block'}}>{c.tipoPessoa === 'juridica' ? `CNPJ: ${c.cnpj}` : c.cpf ? `CPF: ${c.cpf}` : 'Sem documento'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="info-cell mobile-stack" onClick={e => e.stopPropagation()}>
                        {c.celular ? (
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span style={{fontWeight: '600', color: '#334155'}}>{formatarTelefone(c.celular)}</span>
                          </div>
                        ) : '--'}
                      </td>
                      <td className="info-cell mobile-stack">
                        {c.cidade ? (<span style={{display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#475569'}}>📍 {c.cidade}{c.uf ? `/${c.uf}` : ''}</span>) : '--'}
                      </td>
                      <td className="status-cell text-center mobile-stack">
                        <span onClick={(e) => verPorQueInadimplente(e, c)} className={`badge-status ${c.situacaoFinanceira === 'inadimplente' ? 'devedor' : 'ok'}`} style={{ cursor: c.situacaoFinanceira === 'inadimplente' ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: c.situacaoFinanceira === 'inadimplente' ? '0 2px 8px rgba(239, 68, 68, 0.2)' : 'none' }}>
                          {c.situacaoFinanceira === 'inadimplente' ? (<><span>⚠️</span> PENDÊNCIAS</>) : (<><span>✅</span> ADIMPLENTE</>)}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="dropdown-container">
                          <button className="btn-pontinhos" onClick={(e) => toggleMenu(e, c.id)}>⋮</button>
                          {menuAberto === c.id && (
                            <div className="menu-suspenso">
                              <button onClick={() => abrirFichario(c)} className="item-menu">👁️ Ver Perfil</button>
                              <button onClick={(e) => editarCliente(e, c)} className="item-menu">✏️ Editar Cadastro</button>
                              <button onClick={(e) => { e.stopPropagation(); excluirCliente(c.id, c.nome || c.nomeFantasia) }} className="item-menu item-excluir">🗑️ Excluir Cliente</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Renderiza os Modais */}
      {renderFicharioCliente()}
      {renderModalPendencias()}

    </div>
  );
};

export default Clientes;