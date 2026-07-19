import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Usuarios.css';
import { db } from '../firebaseConfig'; 
import { collection, getDocs, doc, query, where, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const Usuarios = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [temAcesso, setTemAcesso] = useState(false);
  const [limiteUsuarios, setLimiteUsuarios] = useState(1);
  const [equipe, setEquipe] = useState([]);
  
  const [isPro, setIsPro] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  
  const [novoUsuario, setNovoUsuario] = useState({
    nome: '', cpf: '', telefone: '', cargo: '', email: '', senhaTemp: '', monitorarAtividade: true, 
    permissoes: { agenda: false, clientes: false, locacoes: false, estoque: false, compras: false, logistica: false, contratos: false, moodboard: false, catalogo: false, acessoFinanceiro: false },
    asoStatus: 'Pendente', asoTipo: 'Admissional', asoDataExame: '', asoValidade: '', asoObservacoes: ''
  });

  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Admin";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipe,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) { navigate('/login'); return; }
    carregarDadosDaConta();
  }, [usuarioLogado, navigate, tenantId]);

  const carregarDadosDaConta = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'usuarios', tenantId);
      const userSnap = await getDoc(userRef);
      let acessoLiberado = false; let limite = 1; let planoEhPro = false;

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.email === "celebrefesta25@gmail.com") {
             acessoLiberado = true; limite = 9999; planoEhPro = true;
        } else if (userData.plano === 'pago' || userData.statusPagamentoVulso === 'pago' || userData.statusAssinatura === 'ativa') {
          if (userData.planoId) {
            const planoSnap = await getDoc(doc(db, "planos", userData.planoId));
            if (planoSnap.exists()) {
              const nomePlano = planoSnap.data().nome?.toLowerCase() || '';
              if (nomePlano.includes('premium')) { limite = 3; acessoLiberado = true; planoEhPro = false; } 
              else if (nomePlano.includes('pro')) { limite = 5; acessoLiberado = true; planoEhPro = true; }
            }
          }
        }
      }

      setTemAcesso(acessoLiberado); setLimiteUsuarios(limite); setIsPro(planoEhPro);

      if (acessoLiberado) {
        const qEquipe = query(collection(db, "equipe"), where("empresaId", "==", tenantId));
        const snapEquipe = await getDocs(qEquipe);
        setEquipe(snapEquipe.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } catch (error) {
      console.error("Erro ao carregar equipe:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNomeChange = (e) => {
    const formatado = e.target.value.split(' ').map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1)).join(' ');
    setNovoUsuario({ ...novoUsuario, nome: formatado });
  };

  const handleCpfChange = (e) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length <= 11) {
      valor = valor.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    setNovoUsuario({ ...novoUsuario, cpf: valor });
  };

  const handleCheckbox = (campo) => {
    setNovoUsuario(prev => ({ ...prev, permissoes: { ...prev.permissoes, [campo]: !prev.permissoes[campo] } }));
  };

  const abrirModalCriacao = () => {
    setEditandoId(null);
    setNovoUsuario({
      nome: '', cpf: '', telefone: '', cargo: 'Atendimento', email: '', senhaTemp: '', monitorarAtividade: true, 
      permissoes: { agenda: false, clientes: false, locacoes: false, estoque: false, compras: false, logistica: false, contratos: false, moodboard: false, catalogo: false, acessoFinanceiro: false },
      asoStatus: 'Pendente', asoTipo: 'Admissional', asoDataExame: '', asoValidade: '', asoObservacoes: ''
    });
    setModalAberto(true);
  };

  const abrirModalEdicao = (membro) => {
    setEditandoId(membro.id);
    setNovoUsuario({
      nome: membro.nome || '', cpf: membro.cpf || '', telefone: membro.telefone || '', cargo: membro.cargo || 'Atendimento', email: membro.email || '', senhaTemp: membro.senhaTemporaria || '', monitorarAtividade: membro.monitorarAtividade ?? true,
      permissoes: membro.permissoes || { agenda: false, clientes: false, locacoes: false, estoque: false, compras: false, logistica: false, contratos: false, moodboard: false, catalogo: false, acessoFinanceiro: false },
      asoStatus: membro.asoStatus || 'Pendente', asoTipo: membro.asoTipo || 'Admissional', asoDataExame: membro.asoDataExame || '', asoValidade: membro.asoValidade || '', asoObservacoes: membro.asoObservacoes || ''
    });
    setModalAberto(true);
  };

  const salvarNovoUsuario = async (e) => {
    e.preventDefault();
    if (!novoUsuario.nome || !novoUsuario.email || (!novoUsuario.senhaTemp && !editandoId)) {
      alert("Nome, E-mail e Senha são obrigatórios!"); return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        await updateDoc(doc(db, "equipe", editandoId), {
          nome: novoUsuario.nome, cpf: novoUsuario.cpf, telefone: novoUsuario.telefone, cargo: novoUsuario.cargo || "Funcionário", email: novoUsuario.email, senhaTemporaria: novoUsuario.senhaTemp, monitorarAtividade: novoUsuario.monitorarAtividade, permissoes: novoUsuario.permissoes, asoStatus: novoUsuario.asoStatus, asoTipo: novoUsuario.asoTipo, asoDataExame: novoUsuario.asoDataExame, asoValidade: novoUsuario.asoValidade, asoObservacoes: novoUsuario.asoObservacoes
        });
        await registrarLog("EDIÇÃO DE FUNCIONÁRIO", `Editou os dados ou permissões de ${novoUsuario.nome}.`);
      } else {
        if (equipe.length + 1 >= limiteUsuarios) {
            alert(`Limite atingido! Seu plano permite ${limiteUsuarios} usuários no total.`); setSalvando(false); return;
        }
        const novoId = doc(collection(db, "equipe")).id;
        await setDoc(doc(db, "equipe", novoId), {
          nome: novoUsuario.nome, cpf: novoUsuario.cpf, telefone: novoUsuario.telefone, cargo: novoUsuario.cargo || "Funcionário", email: novoUsuario.email, senhaTemporaria: novoUsuario.senhaTemp, monitorarAtividade: novoUsuario.monitorarAtividade, permissoes: novoUsuario.permissoes, asoStatus: novoUsuario.asoStatus, asoTipo: novoUsuario.asoTipo, asoDataExame: novoUsuario.asoDataExame, asoValidade: novoUsuario.asoValidade, asoObservacoes: novoUsuario.asoObservacoes, empresaId: tenantId, criadoEm: new Date().toISOString()
        });
        await registrarLog("NOVO FUNCIONÁRIO", `Cadastrou ${novoUsuario.nome}.`);
      }

      const qUser = query(collection(db, "usuarios"), where("email", "==", novoUsuario.email));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        await updateDoc(doc(db, "usuarios", snapUser.docs[0].id), { tenantId: tenantId, role: novoUsuario.cargo || "Funcionário" });
      }

      setModalAberto(false); setEditandoId(null); carregarDadosDaConta();
    } catch (error) {
      alert("Erro ao salvar os dados.");
    } finally {
      setSalvando(false);
    }
  };

  const removerUsuario = async (id, nome) => {
    if (window.confirm(`Tem certeza que deseja remover permanentemente o acesso de ${nome}?`)) {
      await deleteDoc(doc(db, "equipe", id));
      await registrarLog("REMOÇÃO DE FUNCIONÁRIO", `Removeu o acesso do funcionário(a) ${nome}.`);
      carregarDadosDaConta();
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Verificando permissões...</div>;

  if (!temAcesso) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', backgroundColor: '#f8fafc', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '500px', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>👥</div>
          <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>Gestão de Equipe Exclusiva</h2>
          <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '25px' }}>
            Para convidar funcionários e delegar funções, faça um upgrade para o <strong>Premium</strong> ou <strong>Pro</strong>.
          </p>
          <button onClick={() => navigate('/planos')} className="btn-dark-blue" style={{ width: '100%' }}>Fazer Upgrade Agora</button>
        </div>
      </div>
    );
  }

  return (
    <div className="usuarios-page-wrapper">
      
      <div className="header-top">
        <div className="titulo-bloco">
          <h1>Equipe e Acessos</h1>
          <p>
            Gerencie o acesso e a jornada da sua equipe. 
            <strong style={{ color: (equipe.length + 1) >= limiteUsuarios ? '#ef4444' : '#10b981' }}>
              (Uso: {equipe.length + 1} de {limiteUsuarios} vagas)
            </strong>
          </p>
        </div>
        
        <div className="acoes-top">
          <button onClick={() => navigate('/monitoramento')} className="btn-monitoramento">
            <i className="fas fa-desktop" style={{ color: '#c5a059' }}></i> Ver Monitoramento
          </button>
          
          <button onClick={() => navigate('/asos')} className="btn-aso">
            <i className="fas fa-notes-medical"></i> Gestão de ASOs
          </button>

          <button className="btn-dark-blue" onClick={abrirModalCriacao} style={{ opacity: (equipe.length + 1) >= limiteUsuarios ? 0.6 : 1 }}>
            + Novo Funcionário
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table-pro">
          <thead>
            <tr>
              <th>COLABORADOR</th>
              <th>CARGO / FUNÇÃO</th>
              <th style={{ width: '35%' }}>PERMISSÕES ATIVAS</th>
              <th className="td-acoes">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            <tr className="table-row-hover">
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#c5a059', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>AD</div>
                  <div>
                    <strong style={{ color: '#0f172a', display: 'block' }}>Você (Admin)</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{usuarioLogado.email}</span>
                  </div>
                </div>
              </td>
              <td style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>Administração Geral</td>
              <td>
                  <div className="permissoes-container">
                      <span className="perm-badge financeiro">Acesso Total + Financeiro</span>
                  </div>
              </td>
              <td className="td-acoes">
                  <span className="badge-inalteravel">Inalterável</span>
              </td>
            </tr>

            {equipe.map(membro => {
              const semAcesso = !membro.permissoes?.agenda && !membro.permissoes?.clientes && !membro.permissoes?.estoque && !membro.permissoes?.locacoes && !membro.permissoes?.compras && !membro.permissoes?.logistica && !membro.permissoes?.contratos && !membro.permissoes?.catalogo && !(membro.permissoes?.moodboard && isPro);
              return (
              <tr key={membro.id} className="table-row-hover">
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {membro.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a', display: 'block' }}>{membro.nome}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{membro.email}</span>
                    </div>
                  </div>
                </td>
                
                <td style={{ fontSize: '13px', color: '#475569' }}>
                    {membro.cargo || "Não definido"}
                    {membro.monitorarAtividade && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
                            <i className="fas fa-desktop"></i> Atividades Monitoradas
                        </span>
                    )}
                </td>
                
                <td>
                    <div className="permissoes-container">
                        {membro.permissoes?.agenda && <span className="perm-badge">Agenda</span>}
                        {membro.permissoes?.clientes && <span className="perm-badge">Clientes</span>}
                        {membro.permissoes?.locacoes && <span className="perm-badge">Locações</span>}
                        {membro.permissoes?.estoque && <span className="perm-badge">Estoque</span>}
                        {membro.permissoes?.compras && <span className="perm-badge">Compras</span>}
                        {membro.permissoes?.logistica && <span className="perm-badge">Logística</span>}
                        {membro.permissoes?.contratos && <span className="perm-badge">Contratos</span>}
                        {membro.permissoes?.catalogo && <span className="perm-badge">Catálogo</span>}
                        {membro.permissoes?.acessoFinanceiro && <span className="perm-badge financeiro">💰 Financeiro</span>}
                        {membro.permissoes?.moodboard && isPro && <span className="perm-badge moodboard">✨ Moodboard</span>}
                        {semAcesso && <span style={{ color: '#ef4444', fontSize: '11px' }}>Nenhum acesso</span>}
                    </div>
                </td>
                
                <td className="td-acoes">
                  <div className="acoes-tabela">
                    <button onClick={() => abrirModalEdicao(membro)} className="btn-action edit">Editar</button>
                    <button onClick={() => removerUsuario(membro.id, membro.nome)} className="btn-action delete">Remover</button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="modal-overlay-blur">
          <div className="modal-card-custom">
            
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>{editandoId ? 'Editar Funcionário' : 'Ficha do Funcionário'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Cadastre os dados, jornada de trabalho e defina o que ele pode acessar.</p>
              </div>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>

            <div className="modal-body">
                <form onSubmit={salvarNovoUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  <div className="modal-grid-responsivo">
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        <div className="modal-section">
                            <h4 className="modal-section-title"><i className="fas fa-id-card" style={{ color: '#c5a059' }}></i> Dados de Acesso</h4>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label">NOME COMPLETO *</label>
                                <input required type="text" placeholder="Ex: Thiago Vitoriano" value={novoUsuario.nome} onChange={handleNomeChange} className="input-field" />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label">E-MAIL DE ACESSO *</label>
                                <input required type="email" placeholder="thiago@suaempresa.com" value={novoUsuario.email} onChange={e => setNovoUsuario({...novoUsuario, email: e.target.value})} disabled={!!editandoId} className="input-field" />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label">{editandoId ? "SENHA INICIAL (Em branco para não alterar)" : "SENHA INICIAL *"}</label>
                                <input required={!editandoId} type="text" placeholder="Crie uma senha provisória" value={novoUsuario.senhaTemp} onChange={e => setNovoUsuario({...novoUsuario, senhaTemp: e.target.value})} className="input-field" />
                            </div>
                            <div className="flex-row-responsivo">
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">CPF (Opcional)</label>
                                    <input type="text" placeholder="000.000.000-00" value={novoUsuario.cpf} onChange={handleCpfChange} maxLength="14" className="input-field" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">TELEFONE (Opcional)</label>
                                    <input type="text" placeholder="(00) 00000-0000" value={novoUsuario.telefone} onChange={e => setNovoUsuario({...novoUsuario, telefone: e.target.value})} className="input-field" />
                                </div>
                            </div>
                        </div>

                        <div className="modal-section">
                            <h4 className="modal-section-title"><i className="fas fa-notes-medical" style={{ color: '#10b981' }}></i> Saúde Ocupacional (ASO)</h4>
                            <div className="flex-row-responsivo" style={{ marginBottom: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">STATUS DO ASO</label>
                                    <select value={novoUsuario.asoStatus} onChange={e => setNovoUsuario({...novoUsuario, asoStatus: e.target.value})} className="input-field">
                                        <option value="Pendente">Pendente</option>
                                        <option value="Apto">Apto</option>
                                        <option value="Inapto">Inapto</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">TIPO DE EXAME</label>
                                    <select value={novoUsuario.asoTipo} onChange={e => setNovoUsuario({...novoUsuario, asoTipo: e.target.value})} className="input-field">
                                        <option value="Admissional">Admissional</option>
                                        <option value="Periódico">Periódico</option>
                                        <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
                                        <option value="Demissional">Demissional</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex-row-responsivo" style={{ marginBottom: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">DATA DE REALIZAÇÃO</label>
                                    <input type="date" value={novoUsuario.asoDataExame} onChange={e => setNovoUsuario({...novoUsuario, asoDataExame: e.target.value})} className="input-field" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">VALIDADE DO EXAME</label>
                                    <input type="date" value={novoUsuario.asoValidade} onChange={e => setNovoUsuario({...novoUsuario, asoValidade: e.target.value})} className="input-field" />
                                </div>
                            </div>
                            <div>
                                <label className="input-label">OBSERVAÇÕES MÉDICAS</label>
                                <input type="text" value={novoUsuario.asoObservacoes} onChange={e => setNovoUsuario({...novoUsuario, asoObservacoes: e.target.value})} placeholder="Restrições para peso, etc." className="input-field" />
                            </div>
                        </div>

                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        <div className="modal-section">
                            <h4 className="modal-section-title"><i className="fas fa-briefcase" style={{ color: '#c5a059' }}></i> RH & Atividades</h4>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label">CARGO / FUNÇÃO</label>
                                <select value={novoUsuario.cargo} onChange={e => setNovoUsuario({...novoUsuario, cargo: e.target.value})} className="input-field">
                                    <option value="Atendimento">Atendimento</option>
                                    <option value="Decorador(a)">Decorador(a)</option>
                                    <option value="Logística">Logística / Motorista</option>
                                    <option value="Gerente">Gerente</option>
                                </select>
                            </div>
                            <label className="checkbox-card" style={{ background: novoUsuario.monitorarAtividade ? '#f0fdf4' : '#f8fafc', borderColor: novoUsuario.monitorarAtividade ? '#bbf7d0' : '#e2e8f0' }}>
                                <input type="checkbox" checked={novoUsuario.monitorarAtividade} onChange={e => setNovoUsuario({...novoUsuario, monitorarAtividade: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: '#10b981', marginTop: '2px', cursor: 'pointer' }} />
                                <div>
                                    <strong style={{ color: '#0f172a', display: 'block', fontSize: '13px' }}>Monitoramento de Atividades</strong>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '2px' }}>Registrará automaticamente as ações feitas.</span>
                                </div>
                            </label>
                        </div>

                        <div className="modal-section">
                            <h4 className="modal-section-title"><i className="fas fa-lock" style={{ color: '#c5a059' }}></i> Permissões de Acesso</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {['agenda', 'clientes', 'locacoes', 'estoque', 'compras', 'logistica', 'contratos', 'catalogo'].map(mod => (
                                    <label key={mod} className={`checkbox-module ${novoUsuario.permissoes[mod] ? 'active' : ''}`}>
                                        <input type="checkbox" checked={novoUsuario.permissoes[mod]} onChange={() => handleCheckbox(mod)} style={{ width: '16px', height: '16px', accentColor: '#0f172a' }} />
                                        <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: novoUsuario.permissoes[mod] ? '700' : '500', textTransform: 'capitalize' }}>{mod}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="modal-section">
                            <h4 className="modal-section-title"><i className="fas fa-star" style={{ color: '#c5a059' }}></i> Permissões Especiais</h4>
                            <label className="checkbox-card" style={{ marginBottom: '10px' }}>
                                <input type="checkbox" checked={novoUsuario.permissoes.acessoFinanceiro} onChange={() => handleCheckbox('acessoFinanceiro')} style={{ width: '18px', height: '18px', accentColor: '#0f172a', marginTop: '2px', cursor: 'pointer' }} />
                                <div>
                                    <strong style={{ color: '#0f172a', display: 'block', fontSize: '13px' }}>Acesso ao Financeiro</strong>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '2px' }}>Ver fluxo de caixa, pagamentos e receitas.</span>
                                </div>
                            </label>

                            {isPro && (
                                <label className="checkbox-card">
                                    <input type="checkbox" checked={novoUsuario.permissoes.moodboard} onChange={() => handleCheckbox('moodboard')} style={{ width: '18px', height: '18px', accentColor: '#0f172a', marginTop: '2px', cursor: 'pointer' }} />
                                    <div>
                                        <strong style={{ color: '#0f172a', display: 'block', fontSize: '13px' }}>Acesso ao Moodboard</strong>
                                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '2px' }}>Criar projetos em 2D usando o acervo.</span>
                                    </div>
                                </label>
                            )}
                        </div>

                    </div>
                  </div>

                  <div className="modal-acoes-footer">
                    <div className="modal-acoes-wrapper">
                      <button type="button" onClick={() => setModalAberto(false)} className="btn-cancel">Cancelar</button>
                      <button type="submit" disabled={salvando} className="btn-submit">
                        {salvando ? 'A salvar...' : 'Salvar Funcionário'}
                      </button>
                    </div>
                  </div>
                </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;