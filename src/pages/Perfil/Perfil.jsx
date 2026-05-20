import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Perfil.css';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile } from 'firebase/auth';

const Perfil = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // --- NAVEGAÇÃO DE ABAS ---
  const [abaAtiva, setAbaAtiva] = useState('perfil'); // 'perfil' ou 'equipe'

  // --- ESTADOS DO PERFIL ---
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [dados, setDados] = useState({
    nome: '',
    sobrenome: 'Administrador(a)',
    email: '',
    senhaAtual: '', 
    novaSenha: '',
    confirmarSenha: ''
  });

  const [empresa, setEmpresa] = useState({ nome: '', logo: '' });
  const [assinatura, setAssinatura] = useState({
    planoNome: 'Carregando...',
    precoMensal: '0,00',
    status: 'Carregando...',
    corBg: '#f1f5f9',
    corTexto: '#64748b',
    metodoPagamento: 'Nenhum',
    emailCobranca: '-',
    subscriptionId: null,
    isActive: false 
  });

  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  // --- ESTADOS DA EQUIPE ---
  const [equipe, setEquipe] = useState([]);
  const [carregandoEquipe, setCarregandoEquipe] = useState(false);
  const [modalEquipeAberto, setModalEquipeAberto] = useState(false);
  const [membroEditando, setMembroEditando] = useState(null);
  const [dadosMembro, setDadosMembro] = useState({
      nome: '',
      email: '',
      cargo: 'Atendimento',
      acessoFinanceiro: false,
      acessoMoodboard: false,
      acessoLogistica: true
  });
  const [salvandoMembro, setSalvandoMembro] = useState(false);

  // 🔥 ESPIÃO (AUDITORIA CORPORATIVA)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: tenantId, 
        empresaId: tenantId,
        funcionarioId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log:", error);
    }
  };

  // --- CARREGAMENTO INICIAL (PERFIL) ---
  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    setDados(prev => ({
        ...prev,
        nome: usuarioLogado.displayName || 'Admin',
        email: usuarioLogado.email || ''
    }));

    const carregarDadosReais = async () => {
      try {
        const empRef = doc(db, 'configuracoes_empresa', tenantId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const p = empSnap.data();
          setEmpresa({ nome: p.nomeEmpresa || p.nome || 'Sua Empresa', logo: p.logotipo || p.logoUrl || '' });
        }

        const userRef = doc(db, 'usuarios', tenantId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const uData = userSnap.data();
            
            let statusReal = "Inativa";
            let corBg = "#fef2f2"; 
            let corTexto = "#991b1b"; 
            let textoMetodo = "Nenhum método cadastrado";
            let isActive = false;

            let testeAtivo = false;
            if (uData.dataFimTeste) {
                testeAtivo = new Date() <= new Date(uData.dataFimTeste);
            }

            if (uData.assinaturaAtiva || uData.statusAssinatura === 'ativa' || uData.plano === 'pago') {
                statusReal = "Assinatura Ativa";
                corBg = "#f0fdf4"; 
                corTexto = "#166534"; 
                textoMetodo = uData.metodoPagamento || "Cartão de Crédito";
                isActive = true;
            } else if (testeAtivo) {
                statusReal = "Em Período de Teste (VIP)";
                corBg = "#fffbeb"; 
                corTexto = "#b45309"; 
            } else {
                statusReal = "Cancelada / Inativa";
                corBg = "#fef2f2"; 
                corTexto = "#991b1b"; 
            }

            let nomeDoPlano = "Nenhum Plano";
            let precoDoPlano = "0,00";
            if (uData.planoId) {
                const planoSnap = await getDoc(doc(db, "planos", uData.planoId));
                if (planoSnap.exists()) {
                    nomeDoPlano = planoSnap.data().nome;
                    precoDoPlano = planoSnap.data().preco;
                }
            }

            setAssinatura(prev => ({
                ...prev,
                planoNome: nomeDoPlano,
                precoMensal: precoDoPlano,
                status: statusReal,
                corBg: corBg,
                corTexto: corTexto,
                metodoPagamento: textoMetodo,
                emailCobranca: uData.email || usuarioLogado.email,
                subscriptionId: uData.subscriptionId || null,
                isActive: isActive
            }));
        } else {
            setAssinatura(prev => ({
                ...prev, planoNome: 'Nenhum Plano', precoMensal: '0,00', status: 'Sem Assinatura',
                corBg: '#fef2f2', corTexto: '#991b1b', metodoPagamento: 'Nenhum', emailCobranca: usuarioLogado.email, isActive: false
            }));
        }
      } catch (e) { 
          console.error('Erro ao buscar dados:', e);
          setAssinatura(prev => ({...prev, planoNome: 'Não foi possível carregar', status: 'Erro de conexão', isActive: false }));
      }
    };
    carregarDadosReais();
  }, [usuarioLogado, navigate, tenantId]);

  // --- CARREGAMENTO DA EQUIPE ---
  useEffect(() => {
      if (abaAtiva === 'equipe') {
          carregarEquipe();
      }
  }, [abaAtiva, tenantId]);

  const carregarEquipe = async () => {
      setCarregandoEquipe(true);
      try {
          // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa apenas os funcionários desta empresa
          const q = query(collection(db, 'usuarios_equipe'), where('empresaId', '==', tenantId));
          const snap = await getDocs(q);
          setEquipe(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
          console.error("Erro ao carregar equipe:", error);
      } finally {
          setCarregandoEquipe(false);
      }
  };

  // --- FUNÇÕES DO PERFIL ---
  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
        await updateProfile(usuarioLogado, { displayName: dados.nome });
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        await updateDoc(userRef, { nomeCompleto: dados.nome });
        await registrarLog("ATUALIZAÇÃO DE PERFIL", `Atualizou os dados básicos do perfil master.`);
        alert('✅ Dados do perfil atualizados com sucesso!');
    } catch (error) {
        alert('Ocorreu um erro ao salvar o perfil.');
    } finally {
        setSalvandoPerfil(false);
    }
  };

  const validarSenha = (senha) => {
    return {
      tamanho: senha.length >= 8, maiuscula: /[A-Z]/.test(senha), minuscula: /[a-z]/.test(senha),
      numero: /[0-9]/.test(senha), especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(senha)
    };
  };

  const criterios = validarSenha(dados.novaSenha);
  const isSenhaForte = Object.values(criterios).every(Boolean);

  const handleTrocarSenha = async (e) => {
    e.preventDefault();
    setSalvandoSenha(true);
    try {
        if (!dados.senhaAtual || !dados.novaSenha || !dados.confirmarSenha) {
            alert('⚠️ Preencha todos os campos do cofre de segurança.');
            return;
        }
        if (!isSenhaForte) {
            alert('❌ A nova senha não atende aos critérios mínimos de segurança.');
            return;
        }
        if (dados.novaSenha !== dados.confirmarSenha) {
            alert('❌ As senhas novas não coincidem!');
            return;
        }

        const credential = EmailAuthProvider.credential(usuarioLogado.email, dados.senhaAtual);
        try {
            await reauthenticateWithCredential(usuarioLogado, credential);
        } catch (authError) {
            alert('❌ A Senha Atual está incorreta. Acesso negado.');
            return;
        }

        await updatePassword(usuarioLogado, dados.novaSenha);
        await registrarLog("ALTERAÇÃO DE SENHA", `A palavra-passe master foi alterada com sucesso.`);
        alert('✅ Senha atualizada com sucesso! Seu sistema está seguro.');
        setDados({...dados, senhaAtual: '', novaSenha: '', confirmarSenha: ''});
        setModalSenhaAberto(false);
    } catch (error) {
        alert('Ocorreu um erro inesperado ao alterar a senha.');
    } finally {
        setSalvandoSenha(false);
    }
  };

  const handleCancelarAssinatura = async () => {
    if (!assinatura.subscriptionId) return alert("Não foi possível encontrar o ID da assinatura para cancelar.");
    if (!window.confirm("Tem certeza que deseja cancelar a sua assinatura? Perderá o acesso às ferramentas premium no final do período.")) return;

    setCancelando(true);
    try {
      const URL_FUNCAO_CANCELAR = 'https://us-central1-celebre-9f5c9.cloudfunctions.net/cancelarAssinatura';
      const resposta = await fetch(URL_FUNCAO_CANCELAR, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usuarioLogado.uid, subscriptionId: assinatura.subscriptionId })
      });

      if (resposta.ok) {
        await registrarLog("CANCELAMENTO DE ASSINATURA", `A assinatura da empresa foi cancelada no Mercado Pago.`);
        alert("Assinatura cancelada com sucesso.");
        setAssinatura(prev => ({ ...prev, status: 'Cancelada / Inativa', corBg: '#fef2f2', corTexto: '#991b1b', isActive: false }));
      } else {
        alert("Não foi possível cancelar no momento. Tente novamente.");
      }
    } catch (error) {
      alert("Erro de conexão ao tentar cancelar a assinatura.");
    } finally {
      setCancelando(false);
    }
  };

  // --- FUNÇÕES DA EQUIPE ---
  const abrirModalNovoMembro = () => {
      setMembroEditando(null);
      setDadosMembro({ nome: '', email: '', cargo: 'Atendimento', acessoFinanceiro: false, acessoMoodboard: false, acessoLogistica: true });
      setModalEquipeAberto(true);
  };

  const abrirModalEditarMembro = (membro) => {
      setMembroEditando(membro);
      setDadosMembro({
          nome: membro.nome || '',
          email: membro.email || '',
          cargo: membro.cargo || 'Atendimento',
          acessoFinanceiro: membro.acessoFinanceiro || false,
          acessoMoodboard: membro.acessoMoodboard || false,
          acessoLogistica: membro.acessoLogistica !== false 
      });
      setModalEquipeAberto(true);
  };

  const handleSalvarMembro = async (e) => {
      e.preventDefault();
      setSalvandoMembro(true);
      try {
          if (membroEditando) {
              await updateDoc(doc(db, 'usuarios_equipe', membroEditando.id), dadosMembro);
              await registrarLog("EDIÇÃO DE EQUIPE", `Alterou as permissões do funcionário "${dadosMembro.nome}".`);
          } else {
              // 🔥 Para um sistema real, aqui você também chamaria uma Cloud Function 
              // para criar o Auth real do funcionário no Firebase.
              await addDoc(collection(db, 'usuarios_equipe'), {
                  ...dadosMembro,
                  empresaId: tenantId, // 🔥 Cadeado da Empresa
                  criadoEm: serverTimestamp()
              });
              await registrarLog("NOVO FUNCIONÁRIO", `Adicionou "${dadosMembro.nome}" à equipe.`);
          }
          alert("✅ Membro da equipe salvo com sucesso!");
          setModalEquipeAberto(false);
          carregarEquipe();
      } catch (error) {
          alert("Erro ao salvar dados do funcionário.");
      } finally {
          setSalvandoMembro(false);
      }
  };

  const handleExcluirMembro = async (id, nome) => {
      if (window.confirm(`⚠️ Tem certeza que deseja remover "${nome}" da equipe? Ele perderá o acesso imediatamente.`)) {
          try {
              await deleteDoc(doc(db, 'usuarios_equipe', id));
              await registrarLog("EXCLUSÃO DE FUNCIONÁRIO", `Removeu "${nome}" da equipe.`);
              carregarEquipe();
          } catch (error) {
              alert("Erro ao remover funcionário.");
          }
      }
  };

  return (
    <div className="perfil-page fade-in">
      <div className="perfil-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
        <div>
            <h1>Configurações da Conta</h1>
            <p>Gerencie informações, faturamento e acessos da equipe.</p>
        </div>
        
        {/* 🔥 TABS DE NAVEGAÇÃO 🔥 */}
        <div style={{ display: 'flex', gap: '10px', background: '#f8fafc', padding: '6px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <button 
                onClick={() => setAbaAtiva('perfil')} 
                style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', background: abaAtiva === 'perfil' ? '#fff' : 'transparent', color: abaAtiva === 'perfil' ? '#0f172a' : '#64748b', boxShadow: abaAtiva === 'perfil' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
                👤 Meu Perfil
            </button>
            <button 
                onClick={() => setAbaAtiva('equipe')} 
                style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', background: abaAtiva === 'equipe' ? '#fff' : 'transparent', color: abaAtiva === 'equipe' ? '#0f172a' : '#64748b', boxShadow: abaAtiva === 'equipe' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
                👥 Minha Equipe
            </button>
        </div>
      </div>

      <div className="perfil-container">
        {/* COLUNA LATERAL ESQUERDA (Exibida em ambas as abas) */}
        <div className="perfil-sidebar">
          <div className="avatar-large">{dados.nome ? dados.nome.charAt(0).toUpperCase() : 'A'}</div>
          <h3>{dados.nome}</h3>
          <span className="badge-admin">Administrador Master</span>
          <hr />
          <button className="btn-change-photo">Alterar Foto</button>
        </div>

        {/* =========================================
            ABA 1: MEU PERFIL (Master)
        ========================================= */}
        {abaAtiva === 'perfil' && (
            <form className="perfil-form" onSubmit={handleSalvarPerfil} style={{ animation: 'fadeIn 0.3s' }}>
            <section className="form-section">
                <h3><i className="fas fa-id-card"></i> Informações Pessoais</h3>
                <div className="input-row">
                <div className="input-group">
                    <label>Nome</label>
                    <input type="text" value={dados.nome} onChange={(e) => setDados({...dados, nome: e.target.value})} />
                </div>
                <div className="input-group">
                    <label>Sobrenome</label>
                    <input type="text" value={dados.sobrenome} onChange={(e) => setDados({...dados, sobrenome: e.target.value})} />
                </div>
                </div>
                <div className="input-group">
                <label>E-mail (Login)</label>
                <input type="email" value={dados.email} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} title="O e-mail de login não pode ser alterado por aqui." />
                </div>
            </section>

            <section className="form-section">
                <h3><i className="fas fa-building"></i> Dados da Empresa</h3>
                <div className="input-row">
                <div className="input-group">
                    <label>Nome da Empresa</label>
                    <input type="text" value={empresa.nome} readOnly style={{background: '#f1f5f9'}} />
                </div>
                <div className="input-group">
                    <label>Logo</label>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    {empresa.logo 
                        ? <img src={empresa.logo} alt="logo" style={{height: 54, borderRadius: 6, border: '1px solid #e6e6e6', background: '#fff'}} /> 
                        : <div style={{height:54,width:54,background:'#f3f4f6',borderRadius:6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#cbd5e1'}}>🏢</div>
                    }
                    <Link to="/configuracoes" className="btn-edit-config">Editar em Configurações</Link>
                    </div>
                </div>
                </div>
            </section>

            <section className="form-section">
                <h3><i className="fas fa-crown"></i> Assinatura e Faturamento</h3>
                <div className="assinatura-card" style={{ display: 'block', width: '100%', minWidth: '100%', boxSizing: 'border-box', background: assinatura.corBg, border: `1px solid ${assinatura.corTexto}40` }}>
                    <div className="assinatura-header">
                        <div className="assinatura-titulo">
                            <h4 style={{ color: assinatura.corTexto }}>{assinatura.planoNome}</h4>
                            <span className="preco-assinatura" style={{ color: assinatura.corTexto }}>R$ {assinatura.precoMensal} <span>/mês</span></span>
                        </div>
                        <div className="status-badge" style={{ background: assinatura.corTexto, color: '#fff' }}>{assinatura.status}</div>
                    </div>
                    <hr style={{ borderColor: `${assinatura.corTexto}20` }} />
                    <div className="assinatura-details">
                        <div className="detail-item">
                            <label style={{ color: `${assinatura.corTexto}90` }}>MÉTODO DE PAGAMENTO</label>
                            <p style={{ color: assinatura.corTexto }}><i className="fas fa-credit-card"></i> {assinatura.metodoPagamento}</p>
                        </div>
                        <div className="detail-item">
                            <label style={{ color: `${assinatura.corTexto}90` }}>E-MAIL DE COBRANÇA</label>
                            <p style={{ color: assinatura.corTexto }}><i className="fas fa-envelope"></i> {assinatura.emailCobranca}</p>
                        </div>
                    </div>
                </div>
                
                <div style={{display:'flex', gap: '15px', marginTop: 20, flexWrap: 'wrap'}}>
                <button type="button" className="btn-change-plan" onClick={() => navigate('/planos')}>Gerenciar Plano e Pagamentos <i className="fas fa-arrow-right" style={{marginLeft: '8px'}}></i></button>
                {assinatura.isActive && (
                    <button type="button" onClick={handleCancelarAssinatura} disabled={cancelando} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: cancelando ? 'not-allowed' : 'pointer', transition: '0.2s', opacity: cancelando ? 0.6 : 1 }}>
                    <i className="fas fa-ban" style={{marginRight: '8px'}}></i> {cancelando ? 'Cancelando...' : 'Cancelar Assinatura'}
                    </button>
                )}
                </div>
            </section>

            <section className="form-section">
                <h3><i className="fas fa-shield-alt"></i> Segurança e Acesso</h3>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>A sua palavra-passe é criptografada de ponta a ponta. Caso suspeite de acessos indevidos ou queira atualizar as suas credenciais, inicie o processo seguro abaixo.</p>
                <button type="button" className="btn-abrir-cofre" onClick={() => setModalSenhaAberto(true)}><i className="fas fa-lock"></i> Alterar Palavra-passe</button>
            </section>

            <button type="submit" className="btn-save-perfil" disabled={salvandoPerfil}>{salvandoPerfil ? 'Salvando Perfil...' : 'Salvar Alterações do Perfil'}</button>
            </form>
        )}

        {/* =========================================
            ABA 2: GESTÃO DE EQUIPE
        ========================================= */}
        {abaAtiva === 'equipe' && (
            <div className="perfil-form" style={{ animation: 'fadeIn 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e2e8f0' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>👥 Membros da Equipe</h3>
                        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '14px' }}>Gerencie acessos e permissões dos seus funcionários.</p>
                    </div>
                    <button 
                        onClick={abrirModalNovoMembro}
                        style={{ padding: '12px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        + Adicionar Funcionário
                    </button>
                </div>

                {carregandoEquipe ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Buscando equipe...</div>
                ) : equipe.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <span style={{ fontSize: '40px', display: 'block', marginBottom: '15px' }}>👩‍💻</span>
                        <h4 style={{ color: '#0f172a', margin: '0 0 10px 0' }}>Sua equipe ainda está vazia</h4>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Adicione membros para trabalharem no Celebre junto com você.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {equipe.map(membro => (
                            <div key={membro.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '50px', height: '50px', background: '#eff6ff', color: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px' }}>
                                        {membro.nome.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '16px' }}>{membro.nome}</h4>
                                        <span style={{ color: '#64748b', fontSize: '13px' }}>{membro.email} • <strong>{membro.cargo}</strong></span>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            {membro.acessoFinanceiro && <span style={{ background: '#dcfce7', color: '#166534', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>💰 Financeiro</span>}
                                            {membro.acessoMoodboard && <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>✨ Moodboard</span>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => abrirModalEditarMembro(membro)} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Editar</button>
                                    <button onClick={() => handleExcluirMembro(membro.id, membro.nome)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Remover</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* =========================================
          MODAL DE TROCA DE SENHA
      ========================================= */}
      {modalSenhaAberto && (
        <div className="modal-overlay-senha" onClick={() => setModalSenhaAberto(false)}>
            <div className="modal-senha-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-senha-header">
                    <div className="icon-cofre"><i className="fas fa-key"></i></div>
                    <h2>Verificação de Segurança</h2>
                    <p>Para alterar a sua palavra-passe, confirme a sua identidade.</p>
                </div>
                <form onSubmit={handleTrocarSenha} className="modal-senha-body">
                    <div className="input-group">
                        <label>PALAVRA-PASSE ATUAL <span style={{color: '#ef4444'}}>*</span></label>
                        <div className="password-wrapper">
                            <input type={mostrarSenhaAtual ? "text" : "password"} value={dados.senhaAtual} onChange={e => setDados({...dados, senhaAtual: e.target.value})} placeholder="Digite a sua senha atual" autoFocus />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}><i className={`fas ${mostrarSenhaAtual ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                    </div>
                    <div className="senha-divider"></div>
                    <div className="input-group">
                        <label>NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input type={mostrarNovaSenha ? "text" : "password"} value={dados.novaSenha} onChange={e => setDados({...dados, novaSenha: e.target.value})} placeholder="Crie uma senha forte" />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}><i className={`fas ${mostrarNovaSenha ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                        <div className="senha-criterios">
                            <p>Sua senha deve conter:</p>
                            <ul>
                                <li className={criterios.tamanho ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.tamanho ? "fa-check-circle" : "fa-circle"}`}></i> Mínimo de 8 caracteres</li>
                                <li className={criterios.maiuscula && criterios.minuscula ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.maiuscula && criterios.minuscula ? "fa-check-circle" : "fa-circle"}`}></i> Letras maiúsculas e minúsculas</li>
                                <li className={criterios.numero ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.numero ? "fa-check-circle" : "fa-circle"}`}></i> Pelo menos 1 número</li>
                                <li className={criterios.especial ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.especial ? "fa-check-circle" : "fa-circle"}`}></i> Caractere especial (!@#$%&*)</li>
                            </ul>
                        </div>
                    </div>
                    <div className="input-group">
                        <label>CONFIRMAR NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input type={mostrarConfirmarSenha ? "text" : "password"} value={dados.confirmarSenha} onChange={e => setDados({...dados, confirmarSenha: e.target.value})} placeholder="Repita a nova senha" />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}><i className={`fas ${mostrarConfirmarSenha ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                    </div>
                    <div className="modal-senha-footer">
                        <button type="button" className="btn-cancelar-senha" onClick={() => { setModalSenhaAberto(false); setDados({...dados, senhaAtual: '', novaSenha: '', confirmarSenha: ''}); }}>Cancelar</button>
                        <button type="submit" className="btn-confirmar-senha" disabled={salvandoSenha || !isSenhaForte}>{salvandoSenha ? 'Autenticando...' : 'Confirmar Alteração'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* =========================================
          MODAL DE EDIÇÃO DE EQUIPE
      ========================================= */}
      {modalEquipeAberto && (
          <div className="modal-overlay-senha" onClick={() => setModalEquipeAberto(false)} style={{ zIndex: 100000 }}>
              <div className="modal-senha-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                  <div style={{ padding: '20px 25px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>{membroEditando ? 'Editar Permissões' : 'Novo Funcionário'}</h2>
                      <button onClick={() => setModalEquipeAberto(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                  </div>
                  <form onSubmit={handleSalvarMembro} style={{ padding: '25px' }}>
                      <div className="input-row" style={{ marginBottom: '15px' }}>
                          <div className="input-group">
                              <label>Nome Completo *</label>
                              <input type="text" value={dadosMembro.nome} onChange={e => setDadosMembro({...dadosMembro, nome: e.target.value})} required placeholder="Ex: Thiago Silva" />
                          </div>
                      </div>
                      <div className="input-row" style={{ marginBottom: '15px' }}>
                          <div className="input-group">
                              <label>E-mail de Acesso *</label>
                              <input type="email" value={dadosMembro.email} onChange={e => setDadosMembro({...dadosMembro, email: e.target.value})} required placeholder="thiago@suaempresa.com" disabled={!!membroEditando} />
                          </div>
                          <div className="input-group">
                              <label>Cargo / Função</label>
                              <select value={dadosMembro.cargo} onChange={e => setDadosMembro({...dadosMembro, cargo: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                  <option value="Atendimento">Atendimento</option>
                                  <option value="Decorador(a)">Decorador(a)</option>
                                  <option value="Logística">Logística / Motorista</option>
                                  <option value="Gerente">Gerente</option>
                              </select>
                          </div>
                      </div>

                      <h4 style={{ margin: '25px 0 15px', color: '#0f172a', fontSize: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Permissões de Acesso Especial</h4>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', cursor: 'pointer', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <input type="checkbox" checked={dadosMembro.acessoFinanceiro} onChange={e => setDadosMembro({...dadosMembro, acessoFinanceiro: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                          <div>
                              <strong style={{ color: '#0f172a', display: 'block', fontSize: '14px' }}>Acesso ao Financeiro</strong>
                              <span style={{ color: '#64748b', fontSize: '12px' }}>Permite ver fluxo de caixa, pagamentos e receitas.</span>
                          </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', cursor: 'pointer', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <input type="checkbox" checked={dadosMembro.acessoMoodboard} onChange={e => setDadosMembro({...dadosMembro, acessoMoodboard: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                          <div>
                              <strong style={{ color: '#0f172a', display: 'block', fontSize: '14px' }}>Acesso ao Moodboard</strong>
                              <span style={{ color: '#64748b', fontSize: '12px' }}>Permite criar projetos em 2D usando o acervo da empresa.</span>
                          </div>
                      </label>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                          <button type="button" onClick={() => setModalEquipeAberto(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>Cancelar</button>
                          <button type="submit" disabled={salvandoMembro} style={{ flex: 2, padding: '14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: salvandoMembro ? 'not-allowed' : 'pointer' }}>{salvandoMembro ? 'Salvando...' : 'Salvar Funcionário'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};

export default Perfil;