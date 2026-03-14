import './Auth.css'; 
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebaseConfig';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      navigate('/dashboard'); // 🔥 AGORA VAI PRO LUGAR CERTO!
    } catch (error) {
      console.error("Erro no login:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErro('E-mail ou senha incorretos. Tente novamente.');
      } else {
        setErro('Ocorreu um erro ao tentar entrar. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErro('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/dashboard'); // 🔥 AGORA VAI PRO LUGAR CERTO!
    } catch (error) {
      console.error("Erro no login com Google:", error);
      setErro('Erro ao entrar com o Google. Fechou a janela antes da hora?');
    }
  };

  return (
    <div className="auth-container">
      
      {/* ⬅️ Lado Esquerdo: Formulário Moderno */}
      <main className="auth-main">
        <div className="auth-box">
          
          {/* Logo Estilizada */}
          <div className="logo-placeholder">
            <div className="logo-circle"></div> Celebre
          </div>
          
          <h2>Bem-vindo de volta! 👋</h2>
          <p>Insira seus dados para acessar o seu painel.</p>

          {erro && <div className="auth-erro">{erro}</div>}

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>E-MAIL</label>
              <input 
                type="email" 
                placeholder="nome@exemplo.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="input-group">
              <label>SENHA</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" disabled={loading} className="btn-auth">
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="auth-divisor">
            <span>ou continue com</span>
          </div>

          <button type="button" onClick={handleGoogleLogin} className="btn-google">
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" width="18" />
            Entrar com Google
          </button>

          <p className="auth-link">
            Ainda não tem uma conta? <Link to="/cadastro">Criar conta</Link>
          </p>
        </div>
      </main>

      {/* ➡️ Lado Direito: O "Detalhe" Elegante (SaaS Premium) */}
      <aside className="auth-side-panel">
        <div className="side-content">
          <h1>Gerencie seu <br/> acervo com <br/> inteligência.</h1>
          <p>O Celebre ajuda você a organizar cada detalhe dos seus eventos em um só lugar, de forma simples e rápida.</p>
        </div>
      </aside>

    </div>
  );
};

export default Login;