import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import logoImage from '../../assets/LOGO_CELEBRE.png';
import './ContaSuspensa.css';

const ContaSuspensa = () => {
  const navigate = useNavigate();

  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [dadosConta, setDadosConta] = useState(null);
  const [statusVerificacao, setStatusVerificacao] = useState('carregando'); // 'suspenso' | 'ativo' | 'deslogado'

  // Estados de Login (para quando o cliente acessa deslogado pelo link do e-mail)
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [erroLogin, setErroLogin] = useState('');



  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Conta Suspensa por Inatividade • Celebre";

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        try {
          const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            setDadosConta(data);

            const ehSuspenso = data.statusConta === 'suspenso' || data.status === 'suspenso' || data.status === 'excluido';
            if (ehSuspenso) {
              setStatusVerificacao('suspenso');
            } else {
              setStatusVerificacao('ativo');
            }
          } else {
            // Documento não encontrado, tenta via tenantId se houver
            setStatusVerificacao('ativo');
          }
        } catch (err) {
          console.error("Erro ao checar status da conta suspensa:", err);
          setStatusVerificacao('suspenso');
        }
      } else {
        setUsuario(null);
        setDadosConta(null);
        setStatusVerificacao('deslogado');
      }
      setCarregandoAuth(false);
    });

    return () => unsubscribe();
  }, []);



  // 🔑 LOGIN COM E-MAIL E SENHA
  const handleLoginEmail = async (e) => {
    e.preventDefault();
    setLoadingLogin(true);
    setErroLogin('');
    try {
      await signInWithEmailAndPassword(auth, emailLogin.trim().toLowerCase(), senhaLogin);
    } catch (err) {
      console.error("Erro no login:", err);
      setErroLogin('E-mail ou senha incorretos. Por favor, confira seus dados.');
    } finally {
      setLoadingLogin(false);
    }
  };

  // 🌐 LOGIN COM GOOGLE
  const handleLoginGoogle = async () => {
    setLoadingLogin(true);
    setErroLogin('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Erro no login Google:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErroLogin('Falha na autenticação Google. Tente entrar com seu e-mail e senha.');
      }
    } finally {
      setLoadingLogin(false);
    }
  };

  // 🚪 SAIR DA CONTA / TROCAR DE USUÁRIO
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setStatusVerificacao('deslogado');
    } catch (e) {
      console.error(e);
    }
  };

  if (carregandoAuth) {
    return (
      <div className="cs-loading-screen">
        <div className="cs-loading-spinner"></div>
        <p>Verificando situação cadastral segura...</p>
      </div>
    );
  }

  const nomeExibicao = dadosConta?.nomeExibicao || dadosConta?.nomeCompleto || usuario?.displayName || usuario?.email?.split('@')[0] || 'Cliente';
  const emailExibicao = dadosConta?.email || usuario?.email || '';

  return (
    <div className="cs-wrapper fade-in">
      <div className="cs-background-glow"></div>

      <div className="cs-card">
        {/* HEADER / LOGO */}
        <div className="cs-header">
          <img src={logoImage} alt="Celebre Logo" className="cs-logo" />
          <span className="cs-brand-tag">Gestão Inteligente de Festas & Acervo</span>
        </div>

        {/* CENÁRIO 1: CONTA SUSPENSA IDENTIFICADA (USUÁRIO LOGADO) */}
        {statusVerificacao === 'suspenso' && (
          <div className="cs-content-body">
            <div className="cs-badge-suspended">
              <i className="fas fa-pause-circle"></i> Conta Suspensa por Inatividade
            </div>

            <h1 className="cs-title">
              Olá, {nomeExibicao}!
            </h1>
            
            <p className="cs-description">
              Identificamos que sua conta (<span>{emailExibicao}</span>) não registrou acessos ou assinatura ativa nos últimos <strong>6 meses</strong>. Por segurança, o acesso ao painel foi temporariamente suspenso.
            </p>

            {/* CARD DE PRESERVAÇÃO DE DADOS */}
            <div className="cs-preserved-box">
              <div className="cs-preserved-icon">
                <i className="fas fa-shield-alt"></i>
              </div>
              <div className="cs-preserved-text">
                <strong>📦 Seus dados continuam salvos temporariamente</strong>
                <p>
                  Seu acervo de produtos, fotos e clientes cadastrados estão preservados por mais <strong>30 dias</strong>. Após esse período de carência, contas sem manifestação serão definitivamente encerradas para liberação de espaço no sistema.
                </p>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="cs-actions-container">
              <button 
                type="button" 
                className="cs-btn-reactivate"
                onClick={() => navigate('/planos')}
              >
                <i className="fas fa-crown"></i> Reativar Minha Conta Agora
              </button>

              <a 
                href={`https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Minha conta (${emailExibicao}) está suspensa por inatividade e gostaria de ajuda para regularizar.`)}`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="cs-btn-whatsapp"
              >
                <i className="fab fa-whatsapp"></i> Deseja conversar com a equipe Celebre? <strong>Chame no WhatsApp</strong>
              </a>
            </div>

            {/* RODAPÉ DO CARD */}
            <div className="cs-card-footer">
              <button type="button" className="cs-btn-logout" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt"></i> Sair / Trocar de Conta
              </button>

              <span className="cs-footer-dot">•</span>

              <Link to="/excluir-conta" className="cs-link-delete">
                Não desejo mais utilizar o sistema (Excluir Definitivamente)
              </Link>
            </div>
          </div>
        )}

        {/* CENÁRIO 2: USUÁRIO DESLOGADO (ABRIU O LINK DO E-MAIL DIRETAMENTE) */}
        {statusVerificacao === 'deslogado' && (
          <div className="cs-content-body">
            <div className="cs-badge-suspended">
              <i className="fas fa-pause-circle"></i> Reativação de Conta Suspensa
            </div>

            <h1 className="cs-title">
              Reativar seu Acesso
            </h1>

            <p className="cs-description">
              Sua conta foi pausada por mais de 6 meses de inatividade. Faça login abaixo para recuperar seu acervo, fotos e clientes guardados na carência de 30 dias:
            </p>

            {erroLogin && (
              <div className="cs-error-alert">
                <i className="fas fa-exclamation-circle"></i> {erroLogin}
              </div>
            )}

            {/* BOTÃO GOOGLE */}
            <button 
              type="button" 
              className="cs-btn-google-login" 
              onClick={handleLoginGoogle}
              disabled={loadingLogin}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '10px' }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Entrar com o Google
            </button>

            <div className="cs-divider">
              <span>ou entre com e-mail</span>
            </div>

            {/* FORMULÁRIO DE LOGIN */}
            <form onSubmit={handleLoginEmail} className="cs-login-form">
              <div className="cs-input-group">
                <label>E-mail cadastrado</label>
                <div className="cs-input-icon-wrap">
                  <i className="fas fa-envelope"></i>
                  <input 
                    type="email" 
                    placeholder="seuemail@exemplo.com"
                    value={emailLogin}
                    onChange={e => setEmailLogin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="cs-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Senha</label>
                  <Link to="/redefinir-senha" className="cs-link-forgot">Esqueceu a senha?</Link>
                </div>
                <div className="cs-input-icon-wrap">
                  <i className="fas fa-lock"></i>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={senhaLogin}
                    onChange={e => setSenhaLogin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="cs-btn-submit-login" 
                disabled={loadingLogin}
              >
                {loadingLogin ? (
                  <><i className="fas fa-spinner fa-spin"></i> Entrando...</>
                ) : (
                  <><i className="fas fa-sign-in-alt"></i> Entrar e Reativar Conta</>
                )}
              </button>
            </form>
          </div>
        )}

        {/* CENÁRIO 3: STATUS NÃO IDENTIFICADO COMO SUSPENSO — REDIRECIONA PARA PLANOS */}
        {statusVerificacao === 'ativo' && (
          <div className="cs-content-body cs-active-state">
            <div className="cs-badge-suspended">
              <i className="fas fa-exclamation-circle"></i> Verificação de Acesso
            </div>

            <h1 className="cs-title">Regularize seu acesso</h1>
            <p className="cs-description">
              Olá, <strong>{nomeExibicao}</strong>! Para garantir o acesso completo ao sistema, escolha ou confirme seu plano ativo. Se já possui uma assinatura vigente, entre em contato com o suporte.
            </p>

            <div className="cs-actions-container">
              <button 
                type="button" 
                className="cs-btn-reactivate"
                onClick={() => navigate('/planos')}
              >
                <i className="fas fa-crown"></i> Ver Planos e Reativar Acesso
              </button>

              <a 
                href={`https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Preciso de ajuda para regularizar minha conta (${emailExibicao}) no Celebre.`)}`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="cs-btn-whatsapp"
              >
                <i className="fab fa-whatsapp"></i> Falar com Suporte no WhatsApp
              </a>
            </div>

            <div className="cs-card-footer" style={{ marginTop: '20px' }}>
              <button type="button" className="cs-btn-logout" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt"></i> Sair da Conta
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ContaSuspensa;
