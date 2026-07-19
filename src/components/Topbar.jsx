import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import SininhoNotificacoes from './SininhoNotificacoes';
import './Topbar.css';

const Topbar = () => {
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const [usuario, setUsuario] = useState(null); 
  const [userAuthObj, setUserAuthObj] = useState(null);
  const [isAdminConta, setIsAdminConta] = useState(false);
  const menuRef = useRef(null);

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