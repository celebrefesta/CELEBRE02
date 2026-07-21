import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Perfil.css';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile } from 'firebase/auth';

const Perfil = () => {
  const navigate = useNavigate();
  
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
  const isOwner = tenantId === usuarioLogado?.uid;
  const isCollaborator = !isSuperAdmin && !isOwner;

  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [dados, setDados] = useState({
    nome: '', sobrenome: '', cpf: '', telefone: '', endereco: '', email: '',
    senhaAtual: '', novaSenha: '', confirmarSenha: '',
    asoStatus: 'Pendente', asoTipo: 'Admissional', asoDataExame: '', asoValidade: '', asoObservacoes: ''
  });

  const [assinatura, setAssinatura] = useState({
    planoNome: 'Carregando...', precoMensal: '0,00', status: 'Carregando...',
    corBg: '#f1f5f9', corTexto: '#64748b', metodoPagamento: 'Nenhum', emailCobranca: '-',
    subscriptionId: null, isActive: false 
  });

  const [usoPlano, setUsoPlano] = useState({ limite: 1, usado: 1 });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

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
      console.error("Erro ao gravar log:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) { navigate('/login'); return; }

    const carregarDadosReais = async () => {
      try {
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const uData = userSnap.data();
            setDados(prev => ({
                ...prev,
                nome: uData.nomeCompleto || uData.nomeExibicao || usuarioLogado.displayName || (isCollaborator ? 'Colaborador' : 'Admin'),
                sobrenome: uData.sobrenome || '', cpf: uData.cpf || uData.documento || '',
                telefone: uData.telefone || '', endereco: uData.endereco || '', email: usuarioLogado.email || ''
            }));

            if (isCollaborator) {
                const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
                const snapEquipe = await getDocs(qEquipe);
                if (!snapEquipe.empty) {
                    const equipeData = snapEquipe.docs[0].data();
                    setDados(prev => ({
                        ...prev, asoStatus: equipeData.asoStatus || 'Pendente', asoTipo: equipeData.asoTipo || 'Admissional',
                        asoDataExame: equipeData.asoDataExame || '', asoValidade: equipeData.asoValidade || '', asoObservacoes: equipeData.asoObservacoes || ''
                    }));
                }
            }

            if (!isCollaborator) {
                const contaAlvoRef = isSuperAdmin ? doc(db, 'usuarios', usuarioLogado.uid) : doc(db, 'usuarios', tenantId);
                const contaAlvoSnap = await getDoc(contaAlvoRef);
                
                let statusReal = "Inativa / Sem Plano", corBg = "#fef2f2", corTexto = "#991b1b", textoMetodo = "Nenhum método cadastrado";
                let isActive = false, nomeDoPlano = "Básico (Gratuito)", precoDoPlano = "0,00", limiteAtual = 1;
                let emailCobranca = usuarioLogado.email, subId = null;

                if (contaAlvoSnap.exists()) {
                    const cData = contaAlvoSnap.data();
                    let testeAtivo = cData.dataFimTeste ? new Date() <= new Date(cData.dataFimTeste) : false;

                    if (cData.assinaturaAtiva || cData.statusAssinatura === 'ativa' || cData.plano === 'pago') {
                        statusReal = "Assinatura Ativa"; corBg = "#f0fdf4"; corTexto = "#166534"; 
                        textoMetodo = cData.metodoPagamento || "Cartão de Crédito"; isActive = true;
                    } else if (testeAtivo) {
                        statusReal = "Em Período de Teste (VIP)"; corBg = "#fffbeb"; corTexto = "#b45309"; 
                    }

                    if (cData.planoId) {
                        const planoSnap = await getDoc(doc(db, "planos", cData.planoId));
                        if (planoSnap.exists()) {
                            nomeDoPlano = planoSnap.data().nome; precoDoPlano = planoSnap.data().preco;
                            if (nomeDoPlano.toLowerCase().includes('premium')) limiteAtual = 3;
                            else if (nomeDoPlano.toLowerCase().includes('pro')) limiteAtual = 5;
                        }
                    }
                    emailCobranca = cData.email || usuarioLogado.email; subId = cData.subscriptionId || null;
                }

                if (isSuperAdmin) {
                    nomeDoPlano = "Plano Master (Ilimitado)"; limiteAtual = 9999; statusReal = "Acesso Vitalício";
                    corBg = "#fef3c7"; corTexto = "#92400e"; isActive = true; textoMetodo = "Administração Global";
                }

                setAssinatura({
                    planoNome: nomeDoPlano, precoMensal: precoDoPlano, status: statusReal, corBg: corBg,
                    corTexto: corTexto, metodoPagamento: textoMetodo, emailCobranca: emailCobranca,
                    subscriptionId: subId, isActive: isActive
                });

                const qEquipe = query(collection(db, 'equipe'), where('empresaId', '==', tenantId));
                const snapEquipe = await getDocs(qEquipe);
                setUsoPlano({ limite: limiteAtual, usado: snapEquipe.size + 1 });
            }
        }
      } catch (e) { 
          console.error('Erro ao buscar dados:', e);
          setAssinatura(prev => ({ ...prev, planoNome: 'Básico', status: 'Erro ao carregar plano' }));
      }
    };
    carregarDadosReais();
  }, [usuarioLogado, navigate, tenantId, isCollaborator, isSuperAdmin]);

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
        await updateProfile(usuarioLogado, { displayName: dados.nome });
        
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        await updateDoc(userRef, { 
            nomeCompleto: dados.nome, sobrenome: dados.sobrenome, cpf: dados.cpf,
            telefone: dados.telefone, endereco: dados.endereco
        });

        if (isCollaborator) {
            const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
            const snapEquipe = await getDocs(qEquipe);
            if (!snapEquipe.empty) {
                const funcDocId = snapEquipe.docs[0].id;
                await updateDoc(doc(db, 'equipe', funcDocId), { nome: dados.nome, telefone: dados.telefone, cpf: dados.cpf });
            }
        }

        await registrarLog("ATUALIZAÇÃO DE PERFIL", `Atualizou os dados da ficha pessoal.`);
        alert('✅ Dados atualizados com sucesso!');
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
        if (!dados.senhaAtual || !dados.novaSenha || !dados.confirmarSenha) return alert('⚠️ Preencha todos os campos do cofre de segurança.');
        if (!isSenhaForte) return alert('❌ A nova senha não atende aos critérios mínimos de segurança.');
        if (dados.novaSenha !== dados.confirmarSenha) return alert('❌ As senhas novas não coincidem!');

        const credential = EmailAuthProvider.credential(usuarioLogado.email, dados.senhaAtual);
        try { await reauthenticateWithCredential(usuarioLogado, credential); } 
        catch (authError) { return alert('❌ A Senha Atual está incorreta. Acesso negado.'); }

        await updatePassword(usuarioLogado, dados.novaSenha);
        await registrarLog("ALTERAÇÃO DE SENHA", `A senha foi alterada com sucesso.`);
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

  const porcentagemUso = isSuperAdmin ? 100 : (usoPlano.usado / usoPlano.limite) * 100;
  const corBarraUso = isSuperAdmin ? '#c5a059' : (porcentagemUso >= 100 ? '#ef4444' : (porcentagemUso > 70 ? '#f59e0b' : '#10b981'));

  return (
    <div className="perfil-page fade-in">
      <div className="perfil-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
        <div>
            <h1>Configurações da Conta</h1>
            <p>Gerencie informações pessoais, faturamento e segurança.</p>
        </div>
      </div>

      <div className="perfil-container">
        <div className="perfil-sidebar">
          <div className="avatar-large" style={{ background: isSuperAdmin ? '#c5a059' : '#0f172a' }}>{dados.nome ? dados.nome.charAt(0).toUpperCase() : 'U'}</div>
          <h3>{dados.nome}</h3>
          <span className="badge-admin" style={{ background: isSuperAdmin ? '#fef3c7' : (isOwner ? '#f1f5f9' : '#e2e8f0'), color: isSuperAdmin ? '#92400e' : (isOwner ? '#475569' : '#64748b'), border: `1px solid ${isSuperAdmin ? '#fde68a' : '#cbd5e1'}` }}>
              {isSuperAdmin ? '👑 Super-Admin' : (isOwner ? '💼 Proprietário(a)' : '🤝 Colaborador(a)')}
          </span>
          <hr />
          <button className="btn-change-photo">Alterar Foto</button>
        </div>

        <form className="perfil-form" onSubmit={handleSalvarPerfil} style={{ animation: 'fadeIn 0.3s' }}>
        
        {isCollaborator && (
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-info-circle" style={{ color: '#3b82f6', fontSize: '20px' }}></i>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                    Você está conectado com <strong>acesso de colaborador</strong>. Preencha seus dados cadastrais. As configurações da empresa são geridas pelo proprietário.
                </p>
            </div>
        )}

        <section className="form-section">
            <h3><i className="fas fa-id-card"></i> Informações Pessoais (Ficha de RH)</h3>
            <div className="input-row">
                <div className="input-group">
                    <label>Nome Completo</label>
                    <input type="text" value={dados.nome} onChange={(e) => setDados({...dados, nome: e.target.value})} placeholder="Nome" />
                </div>
                <div className="input-group">
                    <label>Sobrenome / Apelido</label>
                    <input type="text" value={dados.sobrenome} onChange={(e) => setDados({...dados, sobrenome: e.target.value})} placeholder="Sobrenome" />
                </div>
            </div>
            <div className="input-row">
                <div className="input-group">
                    <label>CPF do Titular</label>
                    <input type="text" value={dados.cpf} onChange={(e) => setDados({...dados, cpf: e.target.value})} placeholder="000.000.000-00" />
                </div>
                <div className="input-group">
                    <label>Telefone / WhatsApp</label>
                    <input type="text" value={dados.telefone} onChange={(e) => setDados({...dados, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
            </div>
            <div className="input-group">
                <label>Endereço Completo</label>
                <input type="text" value={dados.endereco} onChange={(e) => setDados({...dados, endereco: e.target.value})} placeholder="Rua, Número, Bairro, Cidade - UF" />
            </div>
            <div className="input-group" style={{ marginTop: '15px' }}>
                <label>E-mail (Login)</label>
                <input type="email" value={dados.email} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} title="O e-mail de login não pode ser alterado por aqui." />
            </div>
        </section>

        {isCollaborator && (
            <section className="form-section" style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '12px' }}>
                <h3><i className="fas fa-notes-medical" style={{ color: '#10b981', marginRight: '8px' }}></i> Saúde Ocupacional (ASO)</h3>
                <div style={{ background: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fas fa-lock" style={{ color: '#64748b', fontSize: '16px' }}></i>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                        Estes dados são preenchidos e geridos exclusivamente pelo RH ou Proprietário(a) da empresa.
                    </p>
                </div>
                <div className="input-row">
                    <div className="input-group">
                        <label>Status do Exame</label>
                        <input type="text" value={dados.asoStatus} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed', color: dados.asoStatus === 'Apto' ? '#166534' : (dados.asoStatus === 'Inapto' ? '#991b1b' : '#0f172a'), fontWeight: 'bold'}} />
                    </div>
                    <div className="input-group">
                        <label>Tipo de Exame</label>
                        <input type="text" value={dados.asoTipo} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} />
                    </div>
                </div>
                <div className="input-row">
                    <div className="input-group">
                        <label>Data de Realização</label>
                        <input type="text" value={dados.asoDataExame ? dados.asoDataExame.split('-').reverse().join('/') : 'Não informada'} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} />
                    </div>
                    <div className="input-group">
                        <label>Validade do Exame</label>
                        <input type="text" value={dados.asoValidade ? dados.asoValidade.split('-').reverse().join('/') : 'Não informada'} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} />
                    </div>
                </div>
                <div className="input-group" style={{ marginTop: '15px' }}>
                    <label>Observações / Restrições Médicas</label>
                    <input type="text" value={dados.asoObservacoes || 'Nenhuma restrição registrada.'} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} />
                </div>
            </section>
        )}

        {!isCollaborator && (
            <section className="form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3><i className="fas fa-crown"></i> Assinatura e Uso do Plano</h3>
                </div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Usuários Cadastrados (Você + Equipe)</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: corBarraUso }}>
                            {isSuperAdmin ? 'Acesso Ilimitado' : `${usoPlano.usado} de ${usoPlano.limite} vagas no ${assinatura.planoNome}`}
                        </span>
                    </div>
                    <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '50px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(porcentagemUso, 100)}%`, background: corBarraUso, height: '100%', borderRadius: '50px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    {!isSuperAdmin && porcentagemUso >= 100 && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ Limite de funcionários atingido. Faça upgrade para adicionar mais.</p>
                    )}
                </div>
                <div className="assinatura-card" style={{ display: 'block', width: '100%', minWidth: '100%', boxSizing: 'border-box', background: assinatura.corBg, border: `1px solid ${assinatura.corTexto}40` }}>
                    <div className="assinatura-header">
                        <div className="assinatura-titulo">
                            <h4 style={{ color: assinatura.corTexto }}>{assinatura.planoNome}</h4>
                            {!isSuperAdmin && <span className="preco-assinatura" style={{ color: assinatura.corTexto }}>R$ {assinatura.precoMensal} <span>/mês</span></span>}
                        </div>
                        <div className="status-badge" style={{ background: assinatura.corTexto, color: '#fff' }}>{assinatura.status}</div>
                    </div>
                    <hr style={{ borderColor: `${assinatura.corTexto}20` }} />
                    <div className="assinatura-details">
                        <div className="detail-item">
                            <label style={{ color: `${assinatura.corTexto}90` }}>MÉTODO DE PAGAMENTO</label>
                            <p style={{ color: assinatura.corTexto }}><i className={isSuperAdmin ? "fas fa-shield-alt" : "fas fa-credit-card"}></i> {assinatura.metodoPagamento}</p>
                        </div>
                        <div className="detail-item">
                            <label style={{ color: `${assinatura.corTexto}90` }}>E-MAIL DE CONTATO</label>
                            <p style={{ color: assinatura.corTexto }}><i className="fas fa-envelope"></i> {assinatura.emailCobranca}</p>
                        </div>
                    </div>
                </div>
                <div style={{display:'flex', gap: '15px', marginTop: 20, flexWrap: 'wrap'}}>
                <button type="button" className="btn-change-plan" onClick={() => navigate('/planos')}>Gerenciar Plano e Pagamentos <i className="fas fa-arrow-right" style={{marginLeft: '8px'}}></i></button>
                {assinatura.isActive && !isSuperAdmin && (
                    <button type="button" onClick={handleCancelarAssinatura} disabled={cancelando} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: cancelando ? 'not-allowed' : 'pointer', transition: '0.2s', opacity: cancelando ? 0.6 : 1 }}>
                    <i className="fas fa-ban" style={{marginRight: '8px'}}></i> {cancelando ? 'Cancelando...' : 'Cancelar Assinatura'}
                    </button>
                )}
                </div>
            </section>
        )}

        <section className="form-section">
            <h3><i className="fas fa-shield-alt"></i> Segurança e Acesso</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>Sua senha é criptografada de ponta a ponta. Caso suspeite de acessos indevidos ou queira atualizar suas credenciais, inicie o processo seguro abaixo.</p>
            <button type="button" className="btn-abrir-cofre" onClick={() => setModalSenhaAberto(true)}><i className="fas fa-lock"></i> Alterar Senha</button>
        </section>

        <button type="submit" className="btn-save-perfil" disabled={salvandoPerfil}>{salvandoPerfil ? 'Salvando Perfil...' : 'Salvar Alterações do Perfil'}</button>
        </form>
      </div>

      {/* MODAL DE TROCA DE SENHA */}
      {modalSenhaAberto && (
        <div className="modal-overlay-senha" onClick={() => setModalSenhaAberto(false)}>
            <div className="modal-senha-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-senha-header">
                    <div className="icon-cofre"><i className="fas fa-key"></i></div>
                    <h2>Verificação de Segurança</h2>
                    <p>Para alterar sua senha, confirme sua identidade.</p>
                </div>
                <form onSubmit={handleTrocarSenha} className="modal-senha-body">
                    <div className="input-group">
                        <label>SENHA ATUAL <span style={{color: '#ef4444'}}>*</span></label>
                        <div className="password-wrapper">
                            <input type={mostrarSenhaAtual ? "text" : "password"} value={dados.senhaAtual} onChange={e => setDados({...dados, senhaAtual: e.target.value})} placeholder="Digite sua senha atual" autoFocus />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}><i className={`fas ${mostrarSenhaAtual ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                    </div>
                    <div className="senha-divider"></div>
                    <div className="input-group">
                        <label>NOVA SENHA</label>
                        <div className="password-wrapper">
                            <input type={mostrarNovaSenha ? "text" : "password"} value={dados.novaSenha} onChange={e => setDados({...dados, novaSenha: e.target.value})} placeholder="Crie uma senha forte" />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}><i className={`fas ${mostrarNovaSenha ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                        <div className="senha-criterios">
                            <p style={{color: '#ef4444', fontWeight: 'bold', fontSize: '11px', margin: '5px 0'}}>Todos os requisitos abaixo são obrigatórios:</p>
                            <ul>
                                <li className={criterios.tamanho ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.tamanho ? "fa-check-circle" : "fa-circle"}`}></i> Mínimo de 8 caracteres</li>
                                <li className={criterios.maiuscula && criterios.minuscula ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.maiuscula && criterios.minuscula ? "fa-check-circle" : "fa-circle"}`}></i> Letras maiúsculas e minúsculas</li>
                                <li className={criterios.numero ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.numero ? "fa-check-circle" : "fa-circle"}`}></i> Pelo menos 1 número</li>
                                <li className={criterios.especial ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.especial ? "fa-check-circle" : "fa-circle"}`}></i> Caractere especial (!@#$%&*)</li>
                            </ul>
                        </div>
                    </div>
                    <div className="input-group">
                        <label>CONFIRMAR NOVA SENHA</label>
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
    </div>
  );
};

export default Perfil;