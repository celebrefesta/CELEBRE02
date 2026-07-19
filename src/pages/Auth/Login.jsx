import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; 
import './Auth.css'; 

import logoImage from '../../assets/LOGO_CELEBRE.png';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  // 🔥 A MÁGICA ACONTECE AQUI: LÓGICA INTELIGENTE DE TENANT (EMPRESA)
  const finalizarLogin = async (user) => {
    // Busca todos os dados do usuário no banco de dados
    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Verifica se ele tem um tenantId associado (ou seja, se é funcionário). 
      // Se não tiver, assume que ele é o dono e o tenantId é o próprio uid dele.
      const tenantIdDaEmpresa = userData.tenantId || user.uid;
      
      localStorage.setItem('tenantId', tenantIdDaEmpresa);
      localStorage.setItem('funcName', userData.nomeExibicao || userData.nomeCompleto);
      localStorage.setItem('userRole', userData.role || 'owner'); // Salva o cargo (owner, admin, etc.)
      
    } else {
      // Fallback de segurança caso o documento não exista
      localStorage.setItem('tenantId', user.uid);
      localStorage.setItem('funcName', user.displayName || 'Usuário');
      localStorage.setItem('userRole', 'owner');
    }
    
    // 🔥 REGISTRAR LOG DE LOGIN
    try {
      const tenantId = localStorage.getItem('tenantId') || user.uid;
      const nomeEquipe = localStorage.getItem('funcName') || user.displayName || user.email || 'Usuário';
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: user.uid,
        nomeFuncionario: nomeEquipe,
        usuarioEmail: user.email,
        acao: "LOGIN",
        detalhes: "Iniciou sessão no sistema.",
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (logErr) {
      console.error("Erro ao gravar log de login:", logErr);
    }

    navigate('/dashboard');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      await finalizarLogin(userCredential.user);
    } catch (error) {
      console.error("Erro no login:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErro('E-mail ou palavra-passe incorretos.');
      } else {
        setErro('Erro ao iniciar sessão. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErro('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        const dataAtual = new Date();
        const dataFimTeste = new Date(dataAtual);
        dataFimTeste.setDate(dataFimTeste.getDate() + 7);

        await setDoc(userDocRef, {
          uid: user.uid,
          nomeCompleto: user.displayName,
          nomeExibicao: user.displayName,
          tipoPessoa: 'fisica',
          documento: '',
          email: user.email,
          dataCadastro: dataAtual.toISOString(),
          dataFimTeste: dataFimTeste.toISOString(), 
          role: 'owner', // Quem cria via Google e não existe no banco, entra como dono da própria empresa
          planoId: 'plano_basico' 
        });

        await setDoc(doc(db, "configuracoes_empresa", user.uid), {
          nomeEmpresa: user.displayName,
          documentoEmpresa: '',
          emailContato: user.email,
          criadoEm: serverTimestamp()
        });
      }

      await finalizarLogin(user);

    } catch (error) {
      console.error("Erro no login com Google:", error);
      setErro('Erro ao iniciar sessão com o Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <main className="auth-main">
        <div className="auth-box">
          
          <div className="auth-logo-wrapper">
            <img src={logoImage} alt="Logotipo Celebre" className="auth-logo-img" />
            <span className="auth-logo-text">Celebre</span>
          </div>
          
          <h2>Bem-vindo de volta! 👋</h2>
          <p>Insira seus dados para acessar o seu painel.</p>
          
          {erro && <div className="auth-erro">{erro}</div>}
          
          <form onSubmit={handleLogin} className="auth-form-elements">
            
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
              <div className="input-with-icon">
                  <input 
                      type={mostrarSenha ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={senha} 
                      onChange={(e) => setSenha(e.target.value)} 
                      required 
                  />
                  <button 
                    type="button" 
                    className="btn-olhinho" 
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                  >
                      <i className={`fas ${mostrarSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="btn-auth">
              {loading ? 'A entrar...' : 'Entrar no Sistema'}
            </button>
            
          </form>

          <div className="auth-divider">
            <span>ou continue com</span>
          </div>

          <button type="button" onClick={handleGoogleLogin} disabled={loading} className="btn-google">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" />
            Entrar com Google
          </button>
          
          <p className="auth-link">
            Ainda não tem uma conta? <Link to="/cadastro">Criar conta</Link>
          </p>
        </div>
      </main>
      
      {/* LADO DIREITO (BANNER AZUL NAVAL) */}
      <aside className="auth-side-panel">
        <div className="side-content">
          <h1>Gerencie seu <br/> acervo com <br/> inteligência.</h1>
          <p style={{ marginTop: '20px' }}>
            O Celebre ajuda você a organizar cada detalhe dos seus eventos em um só lugar, de forma simples e rápida.
          </p>
        </div>
      </aside>
    </div>
  );
};

export default Login;