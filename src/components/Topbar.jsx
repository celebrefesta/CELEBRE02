import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { aplicarCorDestaqueGlobal } from '../utils/themeUtils';
import SininhoNotificacoes from './SininhoNotificacoes';
import './Topbar.css';

const Topbar = () => {
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const [temaMenuAberto, setTemaMenuAberto] = useState(false);
  const [usuario, setUsuario] = useState(null); 
  const [userAuthObj, setUserAuthObj] = useState(null);
  const [isAdminConta, setIsAdminConta] = useState(false);
  const menuRef = useRef(null);
  const temaRef = useRef(null);

  const [temaAtual, setTemaAtual] = useState(localStorage.getItem('theme') || 'light');
  const [darkStyleState, setDarkStyleState] = useState(localStorage.getItem('darkStyle') || 'gray');

  useEffect(() => {
    const atualizarTemaState = () => {
      const savedTheme = localStorage.getItem('theme') || 'light';
      const savedStyle = localStorage.getItem('darkStyle') || 'gray';
      setTemaAtual(savedTheme);
      setDarkStyleState(savedStyle);
    };

    atualizarTemaState();
    window.addEventListener('theme-change', atualizarTemaState);
    window.addEventListener('storage', atualizarTemaState);
    return () => {
      window.removeEventListener('theme-change', atualizarTemaState);
      window.removeEventListener('storage', atualizarTemaState);
    };
  }, []);

  const selecionarTemaDireto = (modo) => {
    let effectiveTheme = 'light';
    let darkStyle = 'none';

    if (modo === 'light') {
      effectiveTheme = 'light';
      darkStyle = 'none';
    } else if (modo === 'dark-gray') {
      effectiveTheme = 'dark';
      darkStyle = 'gray';
    } else if (modo === 'dark-midnight') {
      effectiveTheme = 'dark';
      darkStyle = 'midnight';
    }

    setTemaAtual(modo);
    setDarkStyleState(darkStyle);
    localStorage.setItem('theme', modo);
    localStorage.setItem('darkStyle', darkStyle);

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-dark-style', darkStyle);

    window.dispatchEvent(new Event('theme-change'));
    setTemaMenuAberto(false);
  };

  const getTemaInfo = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const style = document.documentElement.getAttribute('data-dark-style') || darkStyleState;

    if (!isDark || temaAtual === 'light') {
      return { icone: '☀️', rotulo: 'Claro' };
    }
    if (style === 'gray' || temaAtual === 'dark-gray') {
      return { icone: '🪨', rotulo: 'Grafite' };
    }
    return { icone: '🌙', rotulo: 'Midnight' };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserAuthObj(user);
        setUsuario({
          nome: localStorage.getItem('funcName') || user.displayName || "Admin Celebre",
          foto: user.photoURL || null,
          email: user.email
        });

        try {
          const userRef = doc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setIsAdminConta(true); 
          } else {
            setIsAdminConta(false); 
          }
        } catch (error) {
          console.error("Erro ao verificar nível de acesso do topbar:", error);
        }

      } else {
        setUsuario(null);
        setUserAuthObj(null);
        setIsAdminConta(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickFora = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuAberto(false);
      }
      if (temaRef.current && !temaRef.current.contains(event.target)) {
        setTemaMenuAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const irPara = (caminho) => {
    navigate(caminho);
    setMenuAberto(false);
  };

  const registrarLogLogout = async () => {
    if (!userAuthObj) return;
    try {
      const tenantId = localStorage.getItem('tenantId') || userAuthObj.uid;
      const nomeEquipa = localStorage.getItem('funcName') || userAuthObj.displayName || userAuthObj.email || "Usuário";
      
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: userAuthObj.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: userAuthObj.email,
        acao: "LOGOUT",
        detalhes: "Encerrou a sessão e saiu do sistema.",
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log de logout:", error);
    }
  };

  const handleSair = async () => {
    try {
      await registrarLogLogout();
      localStorage.removeItem('tenantId');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userPermissions');
      localStorage.removeItem('funcName');
      localStorage.removeItem('accentColor');
      aplicarCorDestaqueGlobal('#c5a059');

      await signOut(auth);
      navigate('/login'); 
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Houve um erro ao tentar sair do sistema.");
    }
  };

  return (
    <div className="topbar-container">
      <div className="topbar-direita">
        
        {/* SELETOR DE APARÊNCIA DE 3 OPÇÕES (CLARO, CINZA GRAFITE, AZUL MIDNIGHT) */}
        <div style={{ position: 'relative' }} ref={temaRef}>
          <button 
            type="button" 
            onClick={() => setTemaMenuAberto(!temaMenuAberto)}
            className="btn-toggle-tema-topbar"
            title="Alternar entre os 3 Modos de Aparência (Claro ☀️, Cinza Grafite 🪨, Azul Midnight 🌙)"
            style={{
              background: 'var(--fundo-cinza)',
              border: '1px solid var(--borda)',
              color: 'var(--texto-principal)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              marginRight: '8px'
            }}
          >
            <span style={{ fontSize: '15px' }}>{getTemaInfo().icone}</span>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {getTemaInfo().rotulo}
            </span>
            <i className="fas fa-chevron-down" style={{ fontSize: '9px', opacity: 0.6, marginLeft: '2px' }}></i>
          </button>

          {temaMenuAberto && (
            <div style={{
              position: 'absolute',
              top: '115%',
              right: 0,
              background: 'var(--branco)',
              border: '1px solid var(--borda)',
              borderRadius: '14px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '220px',
              zIndex: 99999
            }}>
              <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 900, color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Selecione a Aparência
              </div>
              
              <button 
                type="button"
                onClick={() => selecionarTemaDireto('light')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: temaAtual === 'light' ? 'var(--fundo-cinza)' : 'transparent',
                  color: 'var(--texto-principal)',
                  fontWeight: temaAtual === 'light' ? 800 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>☀️</span> Modo Claro (Clean Light)
                </span>
                {temaAtual === 'light' && <i className="fas fa-check" style={{ color: 'var(--dourado)', fontSize: '12px' }}></i>}
              </button>

              <button 
                type="button"
                onClick={() => selecionarTemaDireto('dark-gray')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: (temaAtual === 'dark-gray' || (temaAtual === 'dark' && darkStyleState === 'gray')) ? 'var(--fundo-cinza)' : 'transparent',
                  color: 'var(--texto-principal)',
                  fontWeight: (temaAtual === 'dark-gray' || (temaAtual === 'dark' && darkStyleState === 'gray')) ? 800 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🪨</span> Escuro Cinza Grafite
                </span>
                {(temaAtual === 'dark-gray' || (temaAtual === 'dark' && darkStyleState === 'gray')) && <i className="fas fa-check" style={{ color: 'var(--dourado)', fontSize: '12px' }}></i>}
              </button>

              <button 
                type="button"
                onClick={() => selecionarTemaDireto('dark-midnight')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: (temaAtual === 'dark-midnight' || (temaAtual === 'dark' && darkStyleState === 'midnight')) ? 'var(--fundo-cinza)' : 'transparent',
                  color: 'var(--texto-principal)',
                  fontWeight: (temaAtual === 'dark-midnight' || (temaAtual === 'dark' && darkStyleState === 'midnight')) ? 800 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🌙</span> Escuro Azul Midnight
                </span>
                {(temaAtual === 'dark-midnight' || (temaAtual === 'dark' && darkStyleState === 'midnight')) && <i className="fas fa-check" style={{ color: 'var(--dourado)', fontSize: '12px' }}></i>}
              </button>
            </div>
          )}
        </div>

        <SininhoNotificacoes />
        
        <div className="topbar-divisor"></div>

        <div className="perfil-dropdown-container" ref={menuRef}>
          
          <button 
            className="perfil-btn-trigger" 
            onClick={() => setMenuAberto(!menuAberto)}
          >
            <div className="perfil-avatar">
              {usuario?.foto ? (
                <img src={usuario.foto} alt="Perfil" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
              ) : (
                <i className="fas fa-user"></i>
              )}
            </div>
            
            <span className="perfil-nome">{usuario?.nome || "Carregando..."}</span>
            <i className={`fas fa-chevron-down seta-menu ${menuAberto ? 'girar' : ''}`}></i>
          </button>

          {menuAberto && (
            <div className="perfil-dropdown-menu">
              
              <div className="dropdown-cabecalho">
                <strong>{usuario?.nome || "Usuário"}</strong>
                <span style={{fontSize: '11px', color: '#94a3b8'}}>{usuario?.email || "Gerenciador do Sistema"}</span>
              </div>
              
              {/* 🔥 BOTAO CENTRAL DE CONFIGURAÇÕES (Para todos) 🔥 */}
              <button className="dropdown-item" onClick={() => irPara('/configuracoes')}>
                <i className="fas fa-cog"></i> 
                Configurações
              </button>
              
              {/* 🔥 EQUPIE (Apenas para a Dona da Conta) 🔥 */}
              {isAdminConta && (
                <button className="dropdown-item" onClick={() => irPara('/usuarios')}>
                  <i className="fas fa-users-cog"></i> 
                  Equipe
                </button>
              )}
              
              <div className="dropdown-divisor"></div>
              
              <button className="dropdown-item sair" onClick={handleSair}>
                <i className="fas fa-sign-out-alt"></i> 
                Sair do Sistema
              </button>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Topbar;