import './Auth.css'; 
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider, db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 🔥 NOVO ESTADO: Controla a visualização da senha (Olhinho)
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // 🔥 ESPIÃO INTELIGENTE: Registra o login no cofre do dono da empresa
  const registrarLogin = async (user, metodo, tipoUsuario, donoId) => {
    try {
      const nomeEquipa = localStorage.getItem('funcName') || user.displayName || user.email || "Usuário";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: user.email,
        acao: "LOGIN",
        detalhes: `Acessou o sistema via ${metodo} como ${tipoUsuario}.`,
        userId: donoId
      });
    } catch (error) {
      console.error("Erro ao registrar log de login:", error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    const emailLimpo = email.trim(); // Remove espaços invisíveis acidentais

    try {
      let userCred;

      try {
         // 1. Tenta o login normal no Firebase
         userCred = await signInWithEmailAndPassword(auth, emailLimpo, senha);
      } catch (err) {
         // Se der erro de credencial, vamos ver se é um novo funcionário
         if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            
            const qEquipe = query(collection(db, "equipe"), where("email", "==", emailLimpo), where("senhaTemporaria", "==", senha));
            const snapEquipe = await getDocs(qEquipe);

            if (!snapEquipe.empty) {
                try {
                    // É um funcionário! Cria a conta dele no Firebase Auth oficialmente
                    userCred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
                    const funcData = snapEquipe.docs[0].data();
                    await updateProfile(userCred.user, { displayName: funcData.nome });

                    // Apaga a senha temporária por segurança
                    await setDoc(doc(db, "equipe", snapEquipe.docs[0].id), { senhaTemporaria: "" }, { merge: true });
                } catch (createErr) {
                    throw createErr; // Se a senha for muito fraca (<6), passa o erro para o catch principal
                }
            } else {
                throw err; // Não é funcionário e errou a senha
            }
         } else {
            throw err;
         }
      }

      const user = userCred.user;

      // 🔥 DESCOBRINDO O CARGO (DONO OU FUNCIONÁRIO)
      const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
      const snapFunc = await getDocs(qFunc);

      let tipoUsuario = 'Admin/Dono';
      let empresaId = user.uid;

      if (!snapFunc.empty) {
          // 👨‍💼 FUNCIONÁRIO
          const dadosFuncionario = snapFunc.docs[0].data();
          tipoUsuario = `Funcionário (${dadosFuncionario.cargo || 'Equipe'})`;
          empresaId = dadosFuncionario.empresaId; 
          
          localStorage.setItem('tenantId', empresaId);
          localStorage.setItem('userRole', 'funcionario');
          localStorage.setItem('userPermissions', JSON.stringify(dadosFuncionario.permissoes));
          localStorage.setItem('funcName', dadosFuncionario.nome);
      } else {
          // 👑 DONA DA CONTA
          localStorage.setItem('tenantId', user.uid);
          localStorage.setItem('userRole', 'admin');
          localStorage.setItem('userPermissions', 'all');
          localStorage.setItem('funcName', user.displayName || 'Administrador');
      }

      await registrarLogin(user, 'E-mail/Senha', tipoUsuario, empresaId);
      navigate('/dashboard');

    } catch (error) {
      console.error("Erro no login:", error);
      
      // MENSAGENS DE ERRO CLARAS E TRADUZIDAS
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErro('E-mail ou senha incorretos. Tente novamente.');
      } else if (error.code === 'auth/weak-password') {
        setErro('❌ A senha temporária é muito fraca (mínimo de 6 caracteres). Peça ao Administrador para editar sua senha no painel.');
      } else if (error.code === 'auth/email-already-in-use') {
        setErro('Este e-mail já está em uso. Tente recuperar a senha.');
      } else if (error.code === 'auth/network-request-failed') {
        setErro('Sem conexão com a internet.');
      } else {
        setErro(`Erro ao entrar: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErro('');
    try {
      const credencial = await signInWithPopup(auth, googleProvider);
      const user = credencial.user;

      const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
      const snapFunc = await getDocs(qFunc);

      let tipoUsuario = 'Admin/Dono';
      let empresaId = user.uid;

      if (!snapFunc.empty) {
          const dadosFuncionario = snapFunc.docs[0].data();
          tipoUsuario = `Funcionário (${dadosFuncionario.cargo || 'Equipe'})`;
          empresaId = dadosFuncionario.empresaId;
          
          localStorage.setItem('tenantId', empresaId);
          localStorage.setItem('userRole', 'funcionario');
          localStorage.setItem('userPermissions', JSON.stringify(dadosFuncionario.permissoes));
          localStorage.setItem('funcName', dadosFuncionario.nome);
      } else {
          localStorage.setItem('tenantId', user.uid);
          localStorage.setItem('userRole', 'admin');
          localStorage.setItem('userPermissions', 'all');
          localStorage.setItem('funcName', user.displayName || 'Administrador');
      }

      await registrarLogin(user, 'Google', tipoUsuario, empresaId);
      navigate('/dashboard');

    } catch (error) {
      console.error("Erro no login com Google:", error);
      setErro('Erro ao entrar com o Google. Fechou a janela antes da hora?');
    }
  };

  return (
    <div className="auth-container">
      
      {/* ⬅️ Lado Esquerdo: Área Branca 100% Centralizada */}
      <main className="auth-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%', padding: '20px' }}>
        <div className="auth-box" style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>
          
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
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
               />
            </div>

            <div className="input-group">
              <label>SENHA</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={mostrarSenha ? "text" : "password"} 
                  placeholder="••••••••"
                  value={senha} 
                  onChange={(e) => setSenha(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '12px', paddingRight: '45px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
                
                {/* 🔥 BOTÃO DO OLHINHO AQUI */}
                <button 
                  type="button" 
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  title={mostrarSenha ? "Ocultar Senha" : "Mostrar Senha"}
                >
                  <i className={`fas ${mostrarSenha ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-auth" style={{ width: '100%', marginTop: '10px' }}>
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="auth-divisor">
            <span>ou continue com</span>
          </div>

          <button type="button" onClick={handleGoogleLogin} className="btn-google" style={{ width: '100%' }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" width="18" />
            Entrar com Google
          </button>

          <p className="auth-link" style={{ textAlign: 'center', marginTop: '20px' }}>
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