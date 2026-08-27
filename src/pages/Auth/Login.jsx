import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc, query, where, getDocs } from 'firebase/firestore';
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

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (erro) setErro('');
  };

  const handleSenhaChange = (e) => {
    setSenha(e.target.value);
    if (erro) setErro('');
  };

  // 🔥 A MÁGICA ACONTECE AQUI: LÓGICA INTELIGENTE DE TENANT (EMPRESA)
  const finalizarLogin = async (user) => {
    try {
      // Busca todos os dados do usuário no banco de dados
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      
      if (userDoc.exists()) {
        let userData = userDoc.data();
        
        // RECUPERAÇÃO AUTOMÁTICA SE THIAGO FOI SEQUESTRADO COMO FUNCIONÁRIO
        if (user.email === 'thidovi12@gmail.com' && (userData.role !== 'owner' || userData.tenantId !== user.uid)) {
            await updateDoc(doc(db, 'usuarios', user.uid), {
                role: 'owner',
                tenantId: user.uid
            });
            userData.role = 'owner';
            userData.tenantId = user.uid;
        }

        const tenantIdDaEmpresa = userData.tenantId || user.uid;
        
        localStorage.setItem('tenantId', tenantIdDaEmpresa);
        localStorage.setItem('funcName', userData.nomeExibicao || userData.nomeCompleto || user.displayName || 'Usuário');
        localStorage.setItem('userRole', userData.role || 'owner');
      } else {
        // Se o documento no /usuarios não existe, vamos checar se ele está cadastrado na equipe
        const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
        const snapFunc = await getDocs(qFunc);
        
        if (!snapFunc.empty) {
          const dadosFunc = snapFunc.docs[0].data();
          const empresaId = dadosFunc.empresaId;
          
          // Criamos o documento /usuarios/{user.uid} para o funcionário ter permissões no firestore rules!
          await setDoc(doc(db, "usuarios", user.uid), {
            email: user.email,
            nomeCompleto: dadosFunc.nome || user.displayName || 'Funcionário',
            role: dadosFunc.cargo || 'Funcionário',
            tenantId: empresaId,
            criadoEm: new Date().toISOString()
          });
          
          localStorage.setItem('tenantId', empresaId);
          localStorage.setItem('funcName', dadosFunc.nome || 'Funcionário');
          localStorage.setItem('userRole', dadosFunc.cargo || 'Funcionário');
        } else {
          // Não é funcionário e nem dono pré-existente (ex: novo cadastro via Google ou email novo)
          // Criamos o perfil básico de owner
          await setDoc(doc(db, "usuarios", user.uid), {
            email: user.email,
            nomeCompleto: user.displayName || user.email || 'Usuário',
            role: 'owner',
            tenantId: user.uid,
            dataCadastro: new Date().toISOString(),
            assinaturaAtiva: false
          });
          
          localStorage.setItem('tenantId', user.uid);
          localStorage.setItem('funcName', user.displayName || user.email || 'Usuário');
          localStorage.setItem('userRole', 'owner');
        }
      }
    } catch (errUserDoc) {
      console.error("Erro ao carregar dados do usuário no Firestore:", errUserDoc);
      localStorage.setItem('tenantId', user.uid);
      localStorage.setItem('funcName', user.displayName || user.email || 'Usuário');
      localStorage.setItem('userRole', 'owner');
    }
    
    // 🔥 REGISTRAR LOG DE LOGIN (Assíncrono sem await para não travar o fluxo de login nem o botão)
    try {
      const tenantId = localStorage.getItem('tenantId') || user.uid;
      const nomeEquipe = localStorage.getItem('funcName') || user.displayName || user.email || 'Usuário';
      addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: user.uid,
        nomeFuncionario: nomeEquipe,
        usuarioEmail: user.email,
        acao: "LOGIN",
        detalhes: "Iniciou sessão no sistema.",
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      }).catch(logErr => console.error("Erro ao gravar log de login:", logErr));
    } catch (logErr) {
      console.error("Erro ao tentar gravar log de login:", logErr);
    }

    navigate('/dashboard');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    const emailLimpo = email ? email.trim().toLowerCase() : '';
    const senhaOriginal = senha || '';

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, emailLimpo, senhaOriginal);
      } catch (authErr) {
        // Se falhou por senha incorreta e a senha tinha espaços acidentais no celular
        if (
          (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') &&
          senhaOriginal !== senhaOriginal.trim()
        ) {
          userCredential = await signInWithEmailAndPassword(auth, emailLimpo, senhaOriginal.trim());
        } else {
          throw authErr;
        }
      }
      await finalizarLogin(userCredential.user);
    } catch (error) {
      console.error("Erro no login:", error);
      const code = error.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setErro('E-mail ou senha incorretos.');
      } else if (code === 'auth/invalid-email') {
        setErro('Formato de e-mail inválido.');
      } else if (code === 'auth/too-many-requests') {
        setErro('Muitas tentativas sem sucesso. Aguarde alguns instantes e tente novamente.');
      } else if (code === 'auth/user-disabled') {
        setErro('Esta conta de usuário foi desativada.');
      } else if (code === 'auth/network-request-failed') {
        setErro('Falha de conexão com a internet. Verifique sua rede e tente novamente.');
      } else {
        setErro('Erro ao entrar. Verifique seus dados e tente novamente.');
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

      // 🔍 Busca tenantId existente para o usuário
      let tenantIdParaSalvar = user.uid;

      try {
        const qEquipe = query(collection(db, "equipe"), where("email", "==", user.email));
        const snapEquipe = await getDocs(qEquipe);
        if (!snapEquipe.empty) {
          tenantIdParaSalvar = snapEquipe.docs[0].data().empresaId;
        }
      } catch (errBusca) {
        console.error("Erro ao verificar vínculo com equipe:", errBusca);
      }

      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          nomeCompleto: user.displayName || 'Usuário Google',
          role: 'owner',
          tenantId: tenantIdParaSalvar,
          dataCadastro: new Date().toISOString().split('T')[0],
          assinaturaAtiva: false,
          criadoEm: serverTimestamp()
        });
      }

      await finalizarLogin(user);

    } catch (error) {
      console.error("Erro no login com Google:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setErro('Login com o Google cancelado.');
      } else {
        setErro('Erro ao entrar com o Google.');
      }
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
          <p>Insira seus dados para acessar seu painel.</p>
          
          {erro && <div className="auth-erro">{erro}</div>}
          
          <form onSubmit={handleLogin} className="auth-form-elements">
            
            <div className="input-group">
              <label>E-MAIL</label>
              <input 
                type="email" 
                placeholder="nome@exemplo.com" 
                value={email} 
                onChange={handleEmailChange} 
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required 
              />
            </div>
            
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>SENHA</label>
                <Link to="/redefinir-senha" style={{ fontSize: '0.78rem', color: 'var(--dourado)', fontWeight: '600', textDecoration: 'none' }}>
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="input-with-icon">
                  <input 
                      type={mostrarSenha ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={senha} 
                      onChange={handleSenhaChange} 
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
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
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
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