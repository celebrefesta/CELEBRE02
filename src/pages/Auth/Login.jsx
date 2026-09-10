import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; 
import './Auth.css'; 

import logoImage from '../../assets/LOGO_CELEBRE.png';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem('celebre_saved_email') || '');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarAcesso, setLembrarAcesso] = useState(() => localStorage.getItem('celebre_lembrar_acesso') !== 'false');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  // 🚀 Se o usuário já estiver logado no aparelho, pula a tela de login e entra direto (estilo Instagram/Facebook)
  useEffect(() => {
    if (auth.currentUser) {
      navigate('/dashboard', { replace: true });
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/dashboard', { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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
        const tenantIdDaEmpresa = userData.tenantId || user.uid;
        
        localStorage.setItem('tenantId', tenantIdDaEmpresa);
        localStorage.setItem('funcName', userData.nomeExibicao || userData.nomeCompleto || user.displayName || 'Usuário');
        localStorage.setItem('userRole', userData.role || 'owner');
      } else {
        // Se o documento no /usuarios não existe, vamos checar se ele está cadastrado na equipe
        const emailLimpo = user.email ? user.email.toLowerCase().trim() : '';
        const qFunc = query(collection(db, "equipe"), where("email", "==", emailLimpo));
        const snapFunc = await getDocs(qFunc);
        
        if (!snapFunc.empty) {
          const dadosFunc = snapFunc.docs[0].data();
          const empresaId = dadosFunc.empresaId;
          
          // Criamos o documento /usuarios/{user.uid} para o funcionário ter permissões no firestore rules!
          await setDoc(doc(db, "usuarios", user.uid), {
            email: emailLimpo,
            nomeCompleto: dadosFunc.nome || user.displayName || 'Funcionário',
            role: dadosFunc.cargo || 'Funcionário',
            tenantId: empresaId,
            criadoEm: new Date().toISOString()
          });
          
          localStorage.setItem('tenantId', empresaId);
          localStorage.setItem('funcName', dadosFunc.nome || 'Funcionário');
          localStorage.setItem('userRole', dadosFunc.cargo || 'Funcionário');
        } else {
          // Checa se já existe outra conta criada com este mesmo e-mail na coleção /usuarios
          let tenantIdParaSalvar = user.uid;
          let roleParaSalvar = 'owner';
          let nomePadrao = user.displayName || emailLimpo.split('@')[0] || 'Usuário';
          let isAlias = false;
          let contaVinculadaUid = null;

          try {
            const qExistente = query(collection(db, "usuarios"), where("email", "==", emailLimpo));
            const snapExistente = await getDocs(qExistente);
            if (!snapExistente.empty) {
              const outrosDocs = snapExistente.docs
                .filter(d => d.id !== user.uid)
                .map(d => ({ id: d.id, ...d.data() }));

              if (outrosDocs.length > 0) {
                outrosDocs.sort((a, b) => {
                  if (a.documento && !b.documento) return -1;
                  if (!a.documento && b.documento) return 1;
                  const aSelf = (a.tenantId === a.id);
                  const bSelf = (b.tenantId === b.id);
                  if (aSelf && !bSelf) return -1;
                  if (!aSelf && bSelf) return 1;
                  const dataA = new Date(a.dataCadastro || a.criadoEm || 0).getTime();
                  const dataB = new Date(b.dataCadastro || b.criadoEm || 0).getTime();
                  return dataA - dataB;
                });

                const docPrincipal = outrosDocs[0];
                tenantIdParaSalvar = docPrincipal.tenantId || docPrincipal.id;
                roleParaSalvar = docPrincipal.role || 'owner';
                nomePadrao = docPrincipal.nomeExibicao || docPrincipal.nomeCompleto || nomePadrao;
                isAlias = true;
                contaVinculadaUid = docPrincipal.id;
              }
            }
          } catch (errCheckExistente) {
            console.error("Erro ao verificar conta pré-existente por e-mail:", errCheckExistente);
          }

          const dataAtual = new Date();
          const dataFimTeste = new Date(dataAtual);
          dataFimTeste.setDate(dataFimTeste.getDate() + 7);

          const novoUsuarioDoc = {
            email: emailLimpo,
            nomeCompleto: nomePadrao,
            nomeExibicao: nomePadrao,
            role: roleParaSalvar,
            tenantId: tenantIdParaSalvar,
            dataCadastro: dataAtual.toISOString(),
            dataFimTeste: dataFimTeste.toISOString(),
            planoId: 'plano_basico',
            statusConta: 'ativo',
            assinaturaAtiva: false,
            criadoEm: serverTimestamp()
          };

          if (isAlias) {
            novoUsuarioDoc.isAlias = true;
            novoUsuarioDoc.contaVinculadaDe = contaVinculadaUid;
          }

          await setDoc(doc(db, "usuarios", user.uid), novoUsuarioDoc, { merge: true });
          
          localStorage.setItem('tenantId', tenantIdParaSalvar);
          localStorage.setItem('funcName', nomePadrao);
          localStorage.setItem('userRole', roleParaSalvar);
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

    // Salva preferências de "Lembrar meu acesso"
    if (lembrarAcesso) {
      localStorage.setItem('celebre_saved_email', user.email ? user.email.toLowerCase().trim() : emailLimpo);
      localStorage.setItem('celebre_lembrar_acesso', 'true');
    } else {
      localStorage.removeItem('celebre_saved_email');
      localStorage.setItem('celebre_lembrar_acesso', 'false');
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
      try {
        await setPersistence(auth, lembrarAcesso ? browserLocalPersistence : browserSessionPersistence);
      } catch (pErr) {
        console.warn("Aviso ao definir persistência do auth:", pErr);
      }

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
      if (code === 'auth/user-not-found') {
        setErro('Nenhuma conta cadastrada foi encontrada com este e-mail no Celebre.');
      } else if (code === 'auth/wrong-password') {
        setErro('Senha incorreta. Verifique os dados digitados ou clique em "Esqueceu a senha?".');
      } else if (code === 'auth/invalid-credential') {
        // Checagem inteligente para identificar se a conta não existe ou se foi apenas senha errada
        try {
          const resp = await fetch('https://enviarlinkredefinicaosenha-yfhz7t44jq-uc.a.run.app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailLimpo, verificarApenas: true })
          });

          if (resp.status === 404) {
            setErro('Nenhuma conta cadastrada foi encontrada com este e-mail no Celebre.');
            return;
          }

          if (resp.ok) {
            const data = await resp.json();
            if (data.isGoogleOnly) {
              setErro('Esta conta foi cadastrada com o Google. Clique no botão "Entrar com o Google" abaixo.');
              return;
            }
          }
        } catch (checkErr) {
          console.warn("Falha ao checar existência da conta:", checkErr);
        }

        setErro('Senha incorreta. Verifique os dados digitados ou clique em "Esqueceu a senha?".');
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
      try {
        await setPersistence(auth, lembrarAcesso ? browserLocalPersistence : browserSessionPersistence);
      } catch (pErr) {
        console.warn("Aviso ao definir persistência do auth Google:", pErr);
      }

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const emailLimpo = user.email ? user.email.toLowerCase().trim() : '';
      const nomeGoogle = user.displayName || emailLimpo.split('@')[0] || 'Usuário Google';

      // 🔍 1. Busca tenantId existente para o usuário (equipe ou conta pré-existente)
      let tenantIdParaSalvar = user.uid;
      let roleParaSalvar = 'owner';
      let nomeParaSalvar = nomeGoogle;
      let isAlias = false;
      let contaVinculadaUid = null;
      let docPrincipalExistente = null;

      try {
        const qEquipe = query(collection(db, "equipe"), where("email", "==", emailLimpo));
        const snapEquipe = await getDocs(qEquipe);
        if (!snapEquipe.empty) {
          const dadosEquipe = snapEquipe.docs[0].data();
          tenantIdParaSalvar = dadosEquipe.empresaId;
          roleParaSalvar = dadosEquipe.cargo || 'Funcionário';
          nomeParaSalvar = dadosEquipe.nome || nomeGoogle;
        }
      } catch (errBusca) {
        console.error("Erro ao verificar vínculo com equipe:", errBusca);
      }

      // 🔍 2. Se não for de equipe, verifica se já existe uma conta na coleção 'usuarios' com este mesmo e-mail
      if (tenantIdParaSalvar === user.uid) {
        try {
          const qUsuarios = query(collection(db, "usuarios"), where("email", "==", emailLimpo));
          const snapUsuarios = await getDocs(qUsuarios);
          if (!snapUsuarios.empty) {
            const outrosDocs = snapUsuarios.docs
              .filter(d => d.id !== user.uid)
              .map(d => ({ id: d.id, ...d.data() }));

            if (outrosDocs.length > 0) {
              outrosDocs.sort((a, b) => {
                if (a.documento && !b.documento) return -1;
                if (!a.documento && b.documento) return 1;
                const aSelf = (a.tenantId === a.id);
                const bSelf = (b.tenantId === b.id);
                if (aSelf && !bSelf) return -1;
                if (!aSelf && bSelf) return 1;
                const dataA = new Date(a.dataCadastro || a.criadoEm || 0).getTime();
                const dataB = new Date(b.dataCadastro || b.criadoEm || 0).getTime();
                return dataA - dataB;
              });

              docPrincipalExistente = outrosDocs[0];
              tenantIdParaSalvar = docPrincipalExistente.tenantId || docPrincipalExistente.id;
              roleParaSalvar = docPrincipalExistente.role || 'owner';
              nomeParaSalvar = docPrincipalExistente.nomeExibicao || docPrincipalExistente.nomeCompleto || nomeGoogle;
              isAlias = true;
              contaVinculadaUid = docPrincipalExistente.id;
            }
          }
        } catch (errBuscaUser) {
          console.error("Erro ao verificar conta existente em usuarios:", errBuscaUser);
        }
      }

      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      const dataAtual = new Date();
      const dataFimTeste = new Date(dataAtual);
      dataFimTeste.setDate(dataFimTeste.getDate() + 7);

      if (!userDocSnap.exists()) {
        const dadosNovos = {
          email: emailLimpo,
          nomeCompleto: nomeParaSalvar,
          nomeExibicao: nomeParaSalvar,
          role: roleParaSalvar,
          tenantId: tenantIdParaSalvar,
          dataCadastro: docPrincipalExistente?.dataCadastro || dataAtual.toISOString(),
          dataFimTeste: docPrincipalExistente?.dataFimTeste || dataFimTeste.toISOString(),
          planoId: docPrincipalExistente?.planoId || 'plano_basico',
          statusConta: docPrincipalExistente?.statusConta || 'ativo',
          assinaturaAtiva: docPrincipalExistente?.assinaturaAtiva || false,
          authProvider: 'google.com',
          criadoEm: serverTimestamp()
        };

        if (isAlias) {
          dadosNovos.isAlias = true;
          dadosNovos.contaVinculadaDe = contaVinculadaUid;
        }

        await setDoc(userDocRef, dadosNovos, { merge: true });

        // Garante configurações da empresa apenas se NÃO for alias e for owner
        if (!isAlias && roleParaSalvar === 'owner') {
          try {
            const cfgRef = doc(db, 'configuracoes_empresa', tenantIdParaSalvar);
            const cfgSnap = await getDoc(cfgRef);
            if (!cfgSnap.exists()) {
              await setDoc(cfgRef, {
                nomeFantasia: nomeParaSalvar,
                email: emailLimpo,
                criadoEm: dataAtual.toISOString()
              }, { merge: true });
            }
          } catch (eCfg) {}
        }
      } else {
        const existingData = userDocSnap.data();
        const updates = {};
        if (!existingData.email || existingData.email !== emailLimpo) updates.email = emailLimpo;

        // Se encontramos uma conta original e esta conta está com tenantId desvinculado:
        if (isAlias && existingData.tenantId !== tenantIdParaSalvar) {
          updates.tenantId = tenantIdParaSalvar;
          updates.role = roleParaSalvar;
          updates.isAlias = true;
          updates.contaVinculadaDe = contaVinculadaUid;
        }

        if (!existingData.dataFimTeste && !existingData.assinaturaAtiva) {
          updates.dataFimTeste = dataFimTeste.toISOString();
        }
        if (Object.keys(updates).length > 0) {
          await setDoc(userDocRef, updates, { merge: true });
        }
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
          
          <form onSubmit={handleLogin} className="auth-form-elements" name="login" autoComplete="on">
            
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
                autoComplete="username"
                required 
              />
            </div>
            
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>SENHA</label>
                <Link 
                  to={email ? `/redefinir-senha?email=${encodeURIComponent(email.trim())}` : '/redefinir-senha'} 
                  state={{ email: email ? email.trim() : '' }}
                  style={{ fontSize: '0.78rem', color: 'var(--dourado)', fontWeight: '600', textDecoration: 'none' }}
                >
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
                      autoComplete="current-password"
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

            {/* 🛡️ OPÇÃO: LEMBRAR ACESSO NESTE APARELHO (COMO INSTAGRAM / FACEBOOK) */}
            <div className="auth-remember-row">
              <label className="auth-remember-label" title="Mantém sua sessão salva neste celular para não precisar logar de novo">
                <input 
                  type="checkbox" 
                  checked={lembrarAcesso} 
                  onChange={(e) => setLembrarAcesso(e.target.checked)} 
                />
                <span className="auth-remember-custom-check">
                  <i className="fas fa-check"></i>
                </span>
                <span>Lembrar meu acesso neste aparelho</span>
              </label>
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