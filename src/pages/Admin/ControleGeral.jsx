import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './ControleGeral.css';

const ControleGeral = () => {
  const [clientes, setClientes] = useState([]);
  const [planos, setPlanos] = useState({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Controle de Modais de Edição/Exclusão
  const [membroEdicao, setMembroEdicao] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Controle do Visualizador de Suporte
  const [membroSuporte, setMembroSuporte] = useState(null);
  const [modalSuporteAberto, setModalSuporteAberto] = useState(false);
  const [tabSuporteActive, setTabSuporteActive] = useState('resumo');
  const [loadingSuporte, setLoadingSuporte] = useState(false);
  const [dadosSuporte, setDadosSuporte] = useState({ estoque: [], locacoes: [], clientes: [] });

  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  useEffect(() => {
    if (!usuarioLogado || usuarioLogado.email !== "celebrefesta25@gmail.com") {
      navigate('/dashboard');
      return;
    }
    carregarDados();
  }, [usuarioLogado]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Carregar todos os planos para referência
      const planosSnap = await getDocs(collection(db, "planos"));
      const planosMap = {};
      planosSnap.docs.forEach(d => {
        planosMap[d.id] = d.data();
      });
      setPlanos(planosMap);

      // 2. Carregar todos os usuários (empresas)
      const usersSnap = await getDocs(collection(db, "usuarios"));
      const hoje = new Date();

      const listaClientes = usersSnap.docs.map(docSnap => {
        const data = docSnap.data();
        const uid = docSnap.id;

        // Calcular status do teste/assinatura
        let status = 'bloqueado';
        let diasRestantes = 0;
        let diasTeste = 0;

        // Verificar teste grátis
        if (data.dataFimTeste) {
          const dataFim = new Date(data.dataFimTeste);
          const diffMs = dataFim.getTime() - hoje.getTime();
          diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          
          if (diasRestantes > 0) {
            status = 'teste';
            diasTeste = 7 - diasRestantes;
          }
        } else if (data.dataCadastro) {
          let dataCad = data.dataCadastro;
          if (dataCad.toDate) dataCad = dataCad.toDate();
          const diffTime = hoje.getTime() - new Date(dataCad).getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          
          if (diffDays <= 7) {
            status = 'teste';
            diasRestantes = 7 - diffDays;
            diasTeste = diffDays;
          }
        }

        // Verificar se pagou
        const pagou = data.assinaturaAtiva === true || 
                      data.statusAssinatura === 'ativa' ||
                      data.plano === 'pago' || 
                      data.statusPagamentoVulso === 'pago';

        if (pagou) {
          status = 'ativo';
        }

        // Verificar se está excluído (mais de 180 dias sem pagar)
        if (status === 'bloqueado' && data.dataCadastro) {
          let dataCad = data.dataCadastro;
          if (dataCad.toDate) dataCad = dataCad.toDate();
          const diffTime = hoje.getTime() - new Date(dataCad).getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 180) {
            status = 'excluido';
          }
        }

        // Super admin é sempre ativo
        if (data.email === "celebrefesta25@gmail.com") {
          status = 'admin';
        }

        // Buscar nome do plano
        const nomePlano = data.planoId && planosMap[data.planoId] 
          ? planosMap[data.planoId].nome 
          : (pagou ? 'Plano Pago' : 'Sem plano');

        // Formatar data de cadastro
        let dataCadastroFormatada = '—';
        if (data.dataCadastro) {
          let dc = data.dataCadastro;
          if (dc.toDate) dc = dc.toDate();
          try {
            dataCadastroFormatada = new Date(dc).toLocaleDateString('pt-BR');
          } catch {
            dataCadastroFormatada = String(dc).split('T')[0] || '—';
          }
        }

        return {
          uid,
          nomeCompleto: data.nomeCompleto || data.nomeExibicao || data.displayName || '—',
          nomeExibicao: data.nomeExibicao || data.nomeCompleto || '—',
          email: data.email || '—',
          documento: data.documento || '—',
          tipoPessoa: data.tipoPessoa || '—',
          dataCadastro: data.dataCadastro ? (data.dataCadastro.toDate ? data.dataCadastro.toDate().toISOString() : data.dataCadastro) : null,
          dataCadastroExibida: dataCadastroFormatada,
          dataFimTeste: data.dataFimTeste ? (data.dataFimTeste.toDate ? data.dataFimTeste.toDate().toISOString().split('T')[0] : data.dataFimTeste.split('T')[0]) : '',
          status,
          diasRestantes: status === 'teste' ? diasRestantes : 0,
          diasTeste,
          nomePlano,
          planoId: data.planoId || 'plano_basico',
          role: data.role || 'owner',
          assinaturaAtiva: data.assinaturaAtiva || false,
          statusPagamentoVulso: data.statusPagamentoVulso || '',
          plano: data.plano || '',
          statusAssinatura: data.statusAssinatura || ''
        };
      });

      // Ordenar: admin primeiro, depois teste, ativo, bloqueado, excluído
      const ordemStatus = { admin: 0, teste: 1, ativo: 2, bloqueado: 3, excluido: 4 };
      listaClientes.sort((a, b) => (ordemStatus[a.status] || 5) - (ordemStatus[b.status] || 5));

      setClientes(listaClientes);
    } catch (error) {
      console.error("Erro ao carregar dados do Controle Geral:", error);
    } finally {
      setLoading(false);
    }
  };

  // Abrir Modal de Edição
  const abrirEdicao = (cliente) => {
    setMembroEdicao({ ...cliente });
    setModalAberto(true);
  };

  // Salvar Edição no Firebase
  const salvarEdicao = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const userRef = doc(db, 'usuarios', membroEdicao.uid);
      
      const payload = {
        nomeExibicao: membroEdicao.nomeExibicao,
        nomeCompleto: membroEdicao.nomeCompleto,
        email: membroEdicao.email,
        documento: membroEdicao.documento,
        planoId: membroEdicao.planoId,
        plano: membroEdicao.plano,
        statusPagamentoVulso: membroEdicao.statusPagamentoVulso,
        assinaturaAtiva: membroEdicao.assinaturaAtiva,
        statusAssinatura: membroEdicao.statusAssinatura,
        dataFimTeste: membroEdicao.dataFimTeste ? new Date(membroEdicao.dataFimTeste).toISOString() : null
      };

      await updateDoc(userRef, payload);

      const configRef = doc(db, 'configuracoes_empresa', membroEdicao.uid);
      await updateDoc(configRef, {
        nomeEmpresa: membroEdicao.nomeExibicao,
        emailContato: membroEdicao.email,
        documentoEmpresa: membroEdicao.documento
      }).catch(() => {});

      if (membroEdicao.documento) {
        const docLimpo = membroEdicao.documento.replace(/\D/g, '');
        if (docLimpo) {
          await setDoc(doc(db, 'registros_documentos', docLimpo), {
            ownerUid: membroEdicao.uid,
            atualizadoEm: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }
      }

      alert("Cadastro atualizado com sucesso!");
      setModalAberto(false);
      carregarDados();
    } catch (err) {
      console.error("Erro ao salvar cadastro:", err);
      alert("Erro ao salvar dados do cliente.");
    } finally {
      setSalvando(false);
    }
  };

  // Solicitar Exclusão
  const confirmarExclusao = (uid, nome) => {
    if (window.confirm(`⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente a empresa "${nome}" do sistema?\n\nEsta ação apagará o cadastro do usuário e não poderá ser desfeita.`)) {
      executarExclusao(uid);
    }
  };

  // Deletar do Firestore e Authentication
  const ejecutarExclusao = async (uid) => {
    try {
      // 1. Apaga do Firebase Authentication via Cloud Function
      try {
        const response = await fetch('https://us-central1-celebre-9f5c9.cloudfunctions.net/excluirUsuarioAuth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uid })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn("Aviso ao remover da autenticação (pode já ter sido excluído manualmente):", errData);
        }
      } catch (errAuth) {
        console.error("Falha na chamada da exclusão de autenticação:", errAuth);
      }

      // 2. Apaga do Firestore
      const userRef = doc(db, 'usuarios', uid);
      
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData.documento) {
          const docLimpo = docData.documento.replace(/\D/g, '');
          if (docLimpo) {
            await deleteDoc(doc(db, 'registros_documentos', docLimpo)).catch(() => {});
          }
        }
      }

      await deleteDoc(userRef);
      await deleteDoc(doc(db, 'configuracoes_empresa', uid)).catch(() => {});

      alert("Empresa excluída com sucesso por completo (Autenticação e Banco de Dados)!");
      carregarDados();
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
      alert("Erro ao excluir usuário.");
    }
  };

  // Abrir Visualizador de Suporte (Carregar Dados do Perfil)
  const abrirVisualizadorSuporte = async (cliente) => {
    setMembroSuporte(cliente);
    setTabSuporteActive('resumo');
    setModalSuporteAberto(true);
    setLoadingSuporte(true);
    
    try {
      // Buscar Estoque, Locações e Clientes cadastrados por essa empresa
      const qEstoque = query(collection(db, "estoque"), where("userId", "==", cliente.uid));
      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", cliente.uid));
      const qClientes = query(collection(db, "clientes"), where("userId", "==", cliente.uid));

      const [snapEst, snapLoc, snapCli] = await Promise.all([
        getDocs(qEstoque),
        getDocs(qLocacoes),
        getDocs(qClientes)
      ]);

      const estoque = snapEst.docs.map(d => ({ id: d.id, ...d.data() }));
      const locacoes = snapLoc.docs.map(d => ({ id: d.id, ...d.data() }));
      const clientes = snapCli.docs.map(d => ({ id: d.id, ...d.data() }));

      setDadosSuporte({ estoque, locacoes, clientes });
    } catch (err) {
      console.error("Erro ao carregar dados de suporte do perfil:", err);
    } finally {
      setLoadingSuporte(false);
    }
  };

  // Filtros
  const clientesFiltrados = clientes.filter(c => {
    const matchBusca = busca === '' || 
      c.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      c.nomeExibicao.toLowerCase().includes(busca.toLowerCase()) ||
      c.email.toLowerCase().includes(busca.toLowerCase()) ||
      c.documento.includes(busca);

    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
    
    return matchBusca && matchStatus;
  });

  // Contadores
  const totalClientes = clientes.filter(c => c.status !== 'admin').length;
  const totalTeste = clientes.filter(c => c.status === 'teste').length;
  const totalAtivos = clientes.filter(c => c.status === 'ativo').length;
  const totalBloqueados = clientes.filter(c => c.status === 'bloqueado').length;
  const totalExcluidos = clientes.filter(c => c.status === 'excluido').length;

  const getStatusBadge = (status) => {
    const badges = {
      admin: { label: 'MASTER', className: 'badge-admin' },
      teste: { label: 'TESTE', className: 'badge-teste' },
      ativo: { label: 'ATIVO', className: 'badge-ativo' },
      bloqueado: { label: 'BLOQUEADO', className: 'badge-bloqueado' },
      excluido: { label: 'EXCLUÍDO', className: 'badge-excluido' }
    };
    const b = badges[status] || badges.bloqueado;
    return <span className={`cg-badge ${b.className}`}>{b.label}</span>;
  };

  return (
    <div className="cg-wrapper">
      {/* HEADER */}
      <div className="cg-header">
        <div className="cg-header-left">
          <h1><i className="fas fa-user-shield"></i> Controle Geral</h1>
          <p>Gerencie planos, estenda períodos de teste e administre todos os clientes.</p>
        </div>
        <button className="cg-btn-refresh" onClick={carregarDados}>
          <i className="fas fa-sync-alt"></i> Atualizar
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="cg-kpi-row">
        <div className="cg-kpi-card" onClick={() => setFiltroStatus('todos')}>
          <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
            <i className="fas fa-building"></i>
          </div>
          <div className="cg-kpi-info">
            <span className="cg-kpi-value">{totalClientes}</span>
            <span className="cg-kpi-label">Total Empresas</span>
          </div>
        </div>

        <div className="cg-kpi-card" onClick={() => setFiltroStatus('teste')}>
          <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <i className="fas fa-flask"></i>
          </div>
          <div className="cg-kpi-info">
            <span className="cg-kpi-value">{totalTeste}</span>
            <span className="cg-kpi-label">Em Teste</span>
          </div>
        </div>

        <div className="cg-kpi-card" onClick={() => setFiltroStatus('ativo')}>
          <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="cg-kpi-info">
            <span className="cg-kpi-value">{totalAtivos}</span>
            <span className="cg-kpi-label">Pagantes</span>
          </div>
        </div>

        <div className="cg-kpi-card" onClick={() => setFiltroStatus('bloqueado')}>
          <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
            <i className="fas fa-lock"></i>
          </div>
          <div className="cg-kpi-info">
            <span className="cg-kpi-value">{totalBloqueados}</span>
            <span className="cg-kpi-label">Bloqueados</span>
          </div>
        </div>

        <div className="cg-kpi-card" onClick={() => setFiltroStatus('excluido')}>
          <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #6b7280, #4b5563)' }}>
            <i className="fas fa-user-slash"></i>
          </div>
          <div className="cg-kpi-info">
            <span className="cg-kpi-value">{totalExcluidos}</span>
            <span className="cg-kpi-label">Excluídos</span>
          </div>
        </div>
      </div>

      {/* BARRA DE BUSCA E FILTROS */}
      <div className="cg-toolbar">
        <div className="cg-search-box">
          <i className="fas fa-search"></i>
          <input 
            type="text" 
            placeholder="Buscar por nome, email ou documento..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button className="cg-search-clear" onClick={() => setBusca('')}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        <div className="cg-filter-pills">
          {['todos', 'teste', 'ativo', 'bloqueado', 'excluido'].map(f => (
            <button 
              key={f} 
              className={`cg-pill ${filtroStatus === f ? 'active' : ''}`}
              onClick={() => setFiltroStatus(f)}
            >
              {f === 'todos' ? 'Todos' : f === 'excluido' ? 'Excluídos' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA DE CLIENTES */}
      <div className="cg-table-container">
        <table className="cg-table">
          <thead>
            <tr>
              <th>Empresa / Nome</th>
              <th>Email</th>
              <th>Documento</th>
              <th>Data Cadastro</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Teste</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan="8" className="cg-empty">
                  <i className="fas fa-inbox"></i>
                  <p>Nenhum cliente encontrado.</p>
                </td>
              </tr>
            ) : (
              clientesFiltrados.map(c => (
                <tr key={c.uid} className={`cg-row cg-row-${c.status}`}>
                  <td className="cg-cell-name">
                    <div className="cg-avatar">
                      {(c.nomeExibicao || '?')[0].toUpperCase()}
                    </div>
                    <div className="cg-name-group">
                      <strong>{c.nomeExibicao}</strong>
                      {c.nomeCompleto !== c.nomeExibicao && (
                        <small>{c.nomeCompleto}</small>
                      )}
                    </div>
                  </td>
                  <td className="cg-cell-email">{c.email}</td>
                  <td className="cg-cell-doc">
                    <span className="cg-doc-type">{c.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}</span>
                    {c.documento || '—'}
                  </td>
                  <td>{c.dataCadastroExibida}</td>
                  <td>
                    <span className="cg-plano-tag">{c.nomePlano}</span>
                  </td>
                  <td>{getStatusBadge(c.status)}</td>
                  <td>
                    {c.status === 'teste' ? (
                      <div className="cg-teste-info">
                        <div className="cg-teste-bar">
                          <div 
                            className="cg-teste-fill" 
                            style={{ width: `${((7 - c.diasRestantes) / 7) * 100}%` }}
                          ></div>
                        </div>
                        <small>{c.diasRestantes}d restantes</small>
                      </div>
                    ) : (
                      <span className="cg-teste-na">—</span>
                    )}
                  </td>
                  <td className="cg-cell-actions">
                    {c.status !== 'admin' ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          className="cg-btn-support" 
                          onClick={() => abrirVisualizadorSuporte(c)}
                          title="Visualizar Perfil (Dar Suporte)"
                        >
                          <i className="fas fa-search-plus"></i>
                        </button>
                        <button 
                          className="cg-btn-edit" 
                          onClick={() => abrirEdicao(c)}
                          title="Editar Cadastro/Plano"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="cg-btn-delete" 
                          onClick={() => confirmarExclusao(c.uid, c.nomeExibicao)}
                          title="Excluir Empresa"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    ) : (
                      <span className="cg-admin-na">Bloqueado</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {modalAberto && membroEdicao && (
        <div className="cg-modal-backdrop" onClick={() => setModalAberto(false)}>
          <div className="cg-modal-content" onClick={e => e.stopPropagation()}>
            <div className="cg-modal-header">
              <h2><i className="fas fa-edit"></i> Editar Cliente</h2>
              <button className="cg-modal-close" onClick={() => setModalAberto(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={salvarEdicao} className="cg-modal-form">
              <div className="cg-form-grid">
                <div className="cg-form-group">
                  <label>Nome Fantasia / Empresa</label>
                  <input 
                    type="text" 
                    value={membroEdicao.nomeExibicao || ''} 
                    onChange={e => setMembroEdicao({ ...membroEdicao, nomeExibicao: e.target.value })}
                    required
                  />
                </div>

                <div className="cg-form-group">
                  <label>Razão Social / Nome Completo</label>
                  <input 
                    type="text" 
                    value={membroEdicao.nomeCompleto || ''} 
                    onChange={e => setMembroEdicao({ ...membroEdicao, nomeCompleto: e.target.value })}
                    required
                  />
                </div>

                <div className="cg-form-group">
                  <label>E-mail do Proprietário</label>
                  <input 
                    type="email" 
                    value={membroEdicao.email || ''} 
                    onChange={e => setMembroEdicao({ ...membroEdicao, email: e.target.value })}
                    required
                  />
                </div>

                <div className="cg-form-group">
                  <label>CPF ou CNPJ</label>
                  <input 
                    type="text" 
                    value={membroEdicao.documento || ''} 
                    onChange={e => setMembroEdicao({ ...membroEdicao, documento: e.target.value })}
                  />
                </div>

                <div className="cg-form-group">
                  <label>Plano Vinculado</label>
                  <select 
                    value={membroEdicao.planoId || ''} 
                    onChange={e => setMembroEdicao({ ...membroEdicao, planoId: e.target.value })}
                  >
                    <option value="">Nenhum</option>
                    {Object.entries(planos).map(([id, p]) => (
                      <option key={id} value={id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="cg-form-group">
                  <label>Término do Período de Teste</label>
                  <input 
                    type="date" 
                    value={membroEdicao.dataFimTeste || ''} 
                    onChange={e => setMembroEdicao({ ...membroEdicao, dataFimTeste: e.target.value })}
                  />
                  <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>Deixe vazio se o teste grátis já acabou ou não deve ser aplicado.</small>
                </div>
              </div>

              <div className="cg-payment-section">
                <h3><i className="fas fa-credit-card"></i> Controle Manual de Assinatura</h3>
                <div className="cg-form-grid" style={{ marginTop: '12px' }}>
                  <div className="cg-form-group">
                    <label>Assinatura Ativa (Passe VIP)</label>
                    <select 
                      value={String(membroEdicao.assinaturaAtiva)} 
                      onChange={e => setMembroEdicao({ ...membroEdicao, assinaturaAtiva: e.target.value === 'true' })}
                    >
                      <option value="false">Não (Bloquear se teste expirar)</option>
                      <option value="true">Sim (Acesso irrestrito pago)</option>
                    </select>
                  </div>

                  <div className="cg-form-group">
                    <label>Status do Plano</label>
                    <select 
                      value={membroEdicao.plano || ''} 
                      onChange={e => setMembroEdicao({ ...membroEdicao, plano: e.target.value })}
                    >
                      <option value="">Sem plano</option>
                      <option value="pago">Pago</option>
                      <option value="gratis">Grátis</option>
                    </select>
                  </div>

                  <div className="cg-form-group">
                    <label>Pagamento Avulso</label>
                    <select 
                      value={membroEdicao.statusPagamentoVulso || ''} 
                      onChange={e => setMembroEdicao({ ...membroEdicao, statusPagamentoVulso: e.target.value })}
                    >
                      <option value="">Nenhum</option>
                      <option value="pago">Pago</option>
                      <option value="pendente">Pendente</option>
                    </select>
                  </div>

                  <div className="cg-form-group">
                    <label>Status da Assinatura</label>
                    <select 
                      value={membroEdicao.statusAssinatura || ''} 
                      onChange={e => setMembroEdicao({ ...membroEdicao, statusAssinatura: e.target.value })}
                    >
                      <option value="">Sem assinatura</option>
                      <option value="ativa">Ativa</option>
                      <option value="cancelada">Cancelada</option>
                      <option value="pendente">Pendente</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="cg-modal-footer">
                <button 
                  type="button" 
                  className="cg-btn-cancel" 
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="cg-btn-save"
                  disabled={salvando}
                >
                  {salvando ? <><i className="fas fa-spinner fa-spin"></i> Salvando...</> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE SUPORTE */}
      {modalSuporteAberto && membroSuporte && (
        <div className="cg-modal-backdrop" onClick={() => setModalSuporteAberto(false)}>
          <div className="cg-modal-content support-modal-width" onClick={e => e.stopPropagation()}>
            <div className="cg-modal-header">
              <h2><i className="fas fa-search-plus"></i> Painel de Suporte: {membroSuporte.nomeExibicao}</h2>
              <button className="cg-modal-close" onClick={() => setModalSuporteAberto(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="cg-support-tabs">
              <button 
                className={`cg-support-tab-btn ${tabSuporteActive === 'resumo' ? 'active' : ''}`}
                onClick={() => setTabSuporteActive('resumo')}
              >
                <i className="fas fa-info-circle"></i> Resumo Perfil
              </button>
              <button 
                className={`cg-support-tab-btn ${tabSuporteActive === 'acervo' ? 'active' : ''}`}
                onClick={() => setTabSuporteActive('acervo')}
              >
                <i className="fas fa-boxes"></i> Acervo ({dadosSuporte.estoque.length})
              </button>
              <button 
                className={`cg-support-tab-btn ${tabSuporteActive === 'locacoes' ? 'active' : ''}`}
                onClick={() => setTabSuporteActive('locacoes')}
              >
                <i className="fas fa-calendar-alt"></i> Locações/Pedidos ({dadosSuporte.locacoes.length})
              </button>
              <button 
                className={`cg-support-tab-btn ${tabSuporteActive === 'clientes' ? 'active' : ''}`}
                onClick={() => setTabSuporteActive('clientes')}
              >
                <i className="fas fa-users"></i> Clientes ({dadosSuporte.clientes.length})
              </button>
            </div>

            <div className="cg-modal-form" style={{ minHeight: '380px' }}>
              {loadingSuporte ? (
                <div className="cg-support-tab-loading">
                  <i className="fas fa-spinner fa-spin"></i>
                  <p>Carregando dados da empresa...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: RESUMO DO PERFIL */}
                  {tabSuporteActive === 'resumo' && (
                    <div className="cg-support-resumo-grid">
                      <div className="cg-support-kpi-subrow">
                        <div className="cg-support-subkpi">
                          <h4>Acervo Total</h4>
                          <span>{dadosSuporte.estoque.length}</span>
                        </div>
                        <div className="cg-support-subkpi">
                          <h4>Total Pedidos</h4>
                          <span>{dadosSuporte.locacoes.length}</span>
                        </div>
                        <div className="cg-support-subkpi">
                          <h4>Total Clientes</h4>
                          <span>{dadosSuporte.clientes.length}</span>
                        </div>
                      </div>

                      <div className="cg-support-details-card">
                        <h3>Informações Gerais</h3>
                        <table className="cg-support-details-table">
                          <tbody>
                            <tr>
                              <td><strong>UID do Usuário:</strong></td>
                              <td style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>{membroSuporte.uid}</td>
                            </tr>
                            <tr>
                              <td><strong>E-mail de Login:</strong></td>
                              <td>{membroSuporte.email}</td>
                            </tr>
                            <tr>
                              <td><strong>Documento (CPF/CNPJ):</strong></td>
                              <td>{membroSuporte.documento || 'Não informado'}</td>
                            </tr>
                            <tr>
                              <td><strong>Plano Selecionado:</strong></td>
                              <td><span className="cg-plano-tag">{membroSuporte.nomePlano}</span></td>
                            </tr>
                            <tr>
                              <td><strong>Data de Cadastro:</strong></td>
                              <td>{membroSuporte.dataCadastroExibida}</td>
                            </tr>
                            <tr>
                              <td><strong>Status do Teste Grátis:</strong></td>
                              <td>
                                {membroSuporte.status === 'teste' ? (
                                  <span style={{ color: '#d97706', fontWeight: 'bold' }}>Período de Teste Ativo ({membroSuporte.diasRestantes} dias restantes)</span>
                                ) : (
                                  <span style={{ color: '#64748b' }}>Teste Finalizado / Expirado</span>
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td><strong>Fim do Período de Teste:</strong></td>
                              <td>{membroSuporte.dataFimTeste ? new Date(membroSuporte.dataFimTeste).toLocaleDateString('pt-BR') : '—'}</td>
                            </tr>
                            <tr>
                              <td><strong>Assinatura Ativa (Passe VIP):</strong></td>
                              <td>{membroSuporte.assinaturaAtiva ? 'Sim (Liberado)' : 'Não'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: ACERVO / ESTOQUE */}
                  {tabSuporteActive === 'acervo' && (
                    <div className="cg-support-table-panel">
                      <table className="cg-support-subtable">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Item</th>
                            <th>Categoria</th>
                            <th>Quantidade</th>
                            <th>Valor Locação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dadosSuporte.estoque.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="cg-empty-tab">Nenhum item cadastrado no acervo.</td>
                            </tr>
                          ) : (
                            dadosSuporte.estoque.map(item => (
                              <tr key={item.id}>
                                <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.codigo || '—'}</td>
                                <td>
                                  <strong>{item.nome}</strong>
                                </td>
                                <td>{item.categoria || 'Sem Categoria'}</td>
                                <td>{item.quantidade || 0} unidades</td>
                                <td>R$ {Number(item.valorLocacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 3: LOCAÇÕES / PEDIDOS */}
                  {tabSuporteActive === 'locacoes' && (
                    <div className="cg-support-table-panel">
                      <table className="cg-support-subtable">
                        <thead>
                          <tr>
                            <th>Festa/Evento</th>
                            <th>Cliente</th>
                            <th>Status</th>
                            <th>Data Retirada</th>
                            <th>Valor Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dadosSuporte.locacoes.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="cg-empty-tab">Nenhuma locação ou orçamento criado.</td>
                            </tr>
                          ) : (
                            dadosSuporte.locacoes.map(loc => (
                              <tr key={loc.id}>
                                <td><strong>{loc.nomeEvento || 'Sem Nome'}</strong></td>
                                <td>{loc.clienteNome || 'Não Informado'}</td>
                                <td>
                                  <span className={`cg-badge badge-${(loc.status || 'orcamento').toLowerCase()}`}>
                                    {loc.status || 'Orçamento'}
                                  </span>
                                </td>
                                <td>{loc.dataRetirada ? loc.dataRetirada.split('-').reverse().join('/') : '—'}</td>
                                <td>R$ {Number(loc.valorTotal || loc.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 4: CLIENTES */}
                  {tabSuporteActive === 'clientes' && (
                    <div className="cg-support-table-panel">
                      <table className="cg-support-subtable">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>E-mail</th>
                            <th>Telefone / WhatsApp</th>
                            <th>CPF / CNPJ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dadosSuporte.clientes.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="cg-empty-tab">Nenhum cliente cadastrado por esta empresa.</td>
                            </tr>
                          ) : (
                            dadosSuporte.clientes.map(cli => (
                              <tr key={cli.id}>
                                <td><strong>{cli.nome || cli.razaoSocial}</strong></td>
                                <td style={{ color: '#3b82f6' }}>{cli.email || '—'}</td>
                                <td>{cli.telefone || cli.celular || '—'}</td>
                                <td>{cli.cpf || cli.cnpj || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="cg-modal-footer" style={{ padding: '0 24px 20px 24px', borderTop: 'none' }}>
              <button className="cg-btn-cancel" onClick={() => setModalSuporteAberto(false)}>
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ */}
      <div className="cg-footer">
        <span>Exibindo {clientesFiltrados.length} de {clientes.length} registros</span>
      </div>
    </div>
  );
};

export default ControleGeral;
