import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Perfil.css';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile } from 'firebase/auth';

const Perfil = () => {
  const navigate = useNavigate();
  
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);

  // 🔥 ESTADOS PARA O OLHINHO (VISIBILIDADE)
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

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
  });

  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

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
        const empRef = doc(db, 'configuracoes_empresa', usuarioLogado.uid);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const p = empSnap.data();
          setEmpresa({ nome: p.nomeEmpresa || p.nome || 'Sua Empresa', logo: p.logotipo || p.logoUrl || '' });
        }

        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const uData = userSnap.data();
            
            let statusReal = "Inativa";
            let corBg = "#fef2f2"; 
            let corTexto = "#991b1b"; 
            let textoMetodo = "Nenhum método cadastrado";

            let testeAtivo = false;
            if (uData.dataFimTeste) {
                testeAtivo = new Date() <= new Date(uData.dataFimTeste);
            }

            if (uData.assinaturaAtiva) {
                statusReal = "Assinatura Ativa";
                corBg = "#f0fdf4"; 
                corTexto = "#166534"; 
                textoMetodo = uData.metodoPagamento || "Cartão de Crédito";
            } else if (testeAtivo) {
                statusReal = "Em Período de Teste (VIP)";
                corBg = "#fffbeb"; 
                corTexto = "#b45309"; 
            } else {
                statusReal = "Congelada (Teste Expirado)";
                corBg = "#fef2f2"; 
                corTexto = "#991b1b"; 
            }

            let nomeDoPlano = "Plano Básico";
            let precoDoPlano = "49,90";
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
                emailCobranca: uData.email || usuarioLogado.email
            }));
        }
      } catch (e) { 
          console.error('Erro ao buscar dados do perfil:', e);
      }
    };
    
    carregarDadosReais();
  }, [usuarioLogado, navigate]);

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
        await updateProfile(usuarioLogado, { displayName: dados.nome });
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        await updateDoc(userRef, { nomeCompleto: dados.nome });
        alert('✅ Dados do perfil atualizados com sucesso!');
    } catch (error) {
        console.error(error);
        alert('Ocorreu um erro ao salvar o perfil.');
    } finally {
        setSalvandoPerfil(false);
    }
  };

  const validarSenha = (senha) => {
    return {
      tamanho: senha.length >= 8,
      maiuscula: /[A-Z]/.test(senha),
      minuscula: /[a-z]/.test(senha),
      numero: /[0-9]/.test(senha),
      especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(senha)
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
            setSalvandoSenha(false);
            return;
        }

        if (!isSenhaForte) {
            alert('❌ A nova senha não atende aos critérios mínimos de segurança.');
            setSalvandoSenha(false);
            return;
        }

        if (dados.novaSenha !== dados.confirmarSenha) {
            alert('❌ As senhas novas não coincidem!');
            setSalvandoSenha(false);
            return;
        }

        const credential = EmailAuthProvider.credential(usuarioLogado.email, dados.senhaAtual);
        
        try {
            await reauthenticateWithCredential(usuarioLogado, credential);
        } catch (authError) {
            console.error("Erro de credencial:", authError);
            alert('❌ A Senha Atual está incorreta. Acesso negado.');
            setSalvandoSenha(false);
            return;
        }

        await updatePassword(usuarioLogado, dados.novaSenha);
        alert('✅ Senha atualizada com sucesso! Seu sistema está seguro.');
        
        setDados({...dados, senhaAtual: '', novaSenha: '', confirmarSenha: ''});
        setModalSenhaAberto(false);

    } catch (error) {
        console.error(error);
        alert('Ocorreu um erro inesperado ao alterar a senha.');
    } finally {
        setSalvandoSenha(false);
    }
  };

  return (
    <div className="perfil-page fade-in">
      <div className="perfil-header">
        <h1>Meu Perfil</h1>
        <p>Gerencie suas informações, dados da empresa e assinaturas.</p>
      </div>

      <div className="perfil-container">
        <div className="perfil-sidebar">
          <div className="avatar-large">{dados.nome ? dados.nome.charAt(0).toUpperCase() : 'A'}</div>
          <h3>{dados.nome}</h3>
          <span className="badge-admin">Administrador Master</span>
          <hr />
          <button className="btn-change-photo">Alterar Foto</button>
        </div>

        <form className="perfil-form" onSubmit={handleSalvarPerfil}>
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
                    ? <img src={empresa.logo} alt="logo" style={{height: 54, borderRadius: 6, border: '1px solid #e6e6e6'}} /> 
                    : <div style={{height:54,width:54,background:'#f3f4f6',borderRadius:6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#cbd5e1'}}>🏢</div>
                  }
                  <Link to="/configuracoes" className="btn-edit-config">Editar em Configurações</Link>
                </div>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3><i className="fas fa-crown"></i> Assinatura e Faturamento</h3>
            <div className="assinatura-card" style={{ background: assinatura.corBg, border: `1px solid ${assinatura.corTexto}40` }}>
                <div className="assinatura-header">
                    <div className="assinatura-titulo">
                        <h4 style={{ color: assinatura.corTexto }}>{assinatura.planoNome}</h4>
                        <span className="preco-assinatura" style={{ color: assinatura.corTexto }}>
                            R$ {assinatura.precoMensal} <span>/mês</span>
                        </span>
                    </div>
                    <div className="status-badge" style={{ background: assinatura.corTexto, color: '#fff' }}>
                        {assinatura.status}
                    </div>
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
            <div style={{display:'flex', marginTop: 20}}>
              {/* 🔥 CORREÇÃO AQUI: navigate('/planos') em vez de '/upgrade' 🔥 */}
              <button type="button" className="btn-change-plan" onClick={() => navigate('/planos')}>
                 Gerenciar Plano e Pagamentos <i className="fas fa-arrow-right" style={{marginLeft: '8px'}}></i>
              </button>
            </div>
          </section>

          <section className="form-section">
            <h3><i className="fas fa-shield-alt"></i> Segurança e Acesso</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>
               A sua palavra-passe é criptografada de ponta a ponta. Caso suspeite de acessos indevidos ou queira atualizar as suas credenciais, inicie o processo seguro abaixo.
            </p>
            <button type="button" className="btn-abrir-cofre" onClick={() => setModalSenhaAberto(true)}>
               <i className="fas fa-lock"></i> Alterar Palavra-passe
            </button>
          </section>

          <button type="submit" className="btn-save-perfil" disabled={salvandoPerfil}>
            {salvandoPerfil ? 'Salvando Perfil...' : 'Salvar Alterações do Perfil'}
          </button>
        </form>
      </div>

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
                            <input 
                                type={mostrarSenhaAtual ? "text" : "password"} 
                                value={dados.senhaAtual} 
                                onChange={e => setDados({...dados, senhaAtual: e.target.value})} 
                                placeholder="Digite a sua senha atual" 
                                autoFocus
                            />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}>
                                <i className={`fas ${mostrarSenhaAtual ? "fa-eye-slash" : "fa-eye"}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className="senha-divider"></div>

                    <div className="input-group">
                        <label>NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input 
                                type={mostrarNovaSenha ? "text" : "password"} 
                                value={dados.novaSenha} 
                                onChange={e => setDados({...dados, novaSenha: e.target.value})} 
                                placeholder="Crie uma senha forte" 
                            />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}>
                                <i className={`fas ${mostrarNovaSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                            </button>
                        </div>

                        <div className="senha-criterios">
                            <p>Sua senha deve conter:</p>
                            <ul>
                                <li className={criterios.tamanho ? "criterio-ok" : "criterio-falha"}>
                                    <i className={`fas ${criterios.tamanho ? "fa-check-circle" : "fa-circle"}`}></i> Mínimo de 8 caracteres
                                </li>
                                <li className={criterios.maiuscula && criterios.minuscula ? "criterio-ok" : "criterio-falha"}>
                                    <i className={`fas ${criterios.maiuscula && criterios.minuscula ? "fa-check-circle" : "fa-circle"}`}></i> Letras maiúsculas e minúsculas
                                </li>
                                <li className={criterios.numero ? "criterio-ok" : "criterio-falha"}>
                                    <i className={`fas ${criterios.numero ? "fa-check-circle" : "fa-circle"}`}></i> Pelo menos 1 número
                                </li>
                                <li className={criterios.especial ? "criterio-ok" : "criterio-falha"}>
                                    <i className={`fas ${criterios.especial ? "fa-check-circle" : "fa-circle"}`}></i> Caractere especial (!@#$%&*)
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="input-group">
                        <label>CONFIRMAR NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input 
                                type={mostrarConfirmarSenha ? "text" : "password"} 
                                value={dados.confirmarSenha} 
                                onChange={e => setDados({...dados, confirmarSenha: e.target.value})} 
                                placeholder="Repita a nova senha" 
                            />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}>
                                <i className={`fas ${mostrarConfirmarSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className="modal-senha-footer">
                        <button 
                            type="button" 
                            className="btn-cancelar-senha" 
                            onClick={() => {
                                setModalSenhaAberto(false);
                                setDados({...dados, senhaAtual: '', novaSenha: '', confirmarSenha: ''});
                            }}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="btn-confirmar-senha" disabled={salvandoSenha || !isSenhaForte}>
                            {salvandoSenha ? 'Autenticando...' : 'Confirmar Alteração'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
      )}

    </div>
  );
};

export default Perfil;