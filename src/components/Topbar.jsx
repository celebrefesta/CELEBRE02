import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc } from 'firebase/firestore'; // 🔥 Precisamos do Firestore para verificar o cargo
import { auth, db } from '../firebaseConfig'; // 🔥 Importando o db junto com o auth
import SininhoNotificacoes from './SininhoNotificacoes';
import './Topbar.css';

const Topbar = () => {
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const [usuario, setUsuario] = useState(null); 
  const [isAdminConta, setIsAdminConta] = useState(false); // 🔥 Estado para saber se é a Dona da conta
  const menuRef = useRef(null);

  // Fica vigiando para ver quem está logado no sistema e verifica o cargo
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario({
          nome: user.displayName || "Admin Celebre",
          foto: user.photoURL || null,
          email: user.email
        });

        // 🔥 Lógica para descobrir se é a Dona da Conta ou Funcionário
        try {
          const userRef = doc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setIsAdminConta(true); // É a Dona!
          } else {
            setIsAdminConta(false); // É funcionário!
          }
        } catch (error) {
          console.error("Erro ao verificar nível de acesso do topbar:", error);
        }

      } else {
        setUsuario(null);
        setIsAdminConta(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fecha a gaveta se o usuário clicar fora dela
  useEffect(() => {
    const handleClickFora = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  // Função para navegar e fechar o menu ao mesmo tempo
  const irPara = (caminho) => {
    navigate(caminho);
    setMenuAberto(false);
  };

  // 🔥 Função Oficial de Sair do Sistema 🔥
  const handleSair = async () => {
    try {
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
        
        {/* O nosso sininho mágico de notificações */}
        <SininhoNotificacoes />
        
        <div className="topbar-divisor"></div>

        {/* 🔥 MENU GAVETA ESTILO FACEBOOK 🔥 */}
        <div className="perfil-dropdown-container" ref={menuRef}>
          
          {/* Botão que fica sempre visível na barra */}
          <button 
            className="perfil-btn-trigger" 
            onClick={() => setMenuAberto(!menuAberto)}
          >
            <div className="perfil-avatar">
              {/* Se tiver foto do Google, mostra a foto. Se não, mostra o ícone */}
              {usuario?.foto ? (
                <img src={usuario.foto} alt="Perfil" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
              ) : (
                <i className="fas fa-user"></i>
              )}
            </div>
            
            {/* O nome agora é dinâmico! */}
            <span className="perfil-nome">{usuario?.nome || "Carregando..."}</span>
            <i className={`fas fa-chevron-down seta-menu ${menuAberto ? 'girar' : ''}`}></i>
          </button>

          {/* A Gaveta que abre ao clicar */}
          {menuAberto && (
            <div className="perfil-dropdown-menu">
              
              <div className="dropdown-cabecalho">
                <strong>{usuario?.nome || "Usuário"}</strong>
                <span style={{fontSize: '11px', color: '#94a3b8'}}>{usuario?.email || "Gerenciador do Sistema"}</span>
              </div>
              
              <button className="dropdown-item" onClick={() => irPara('/perfil')}>
                <i className="fas fa-user-circle"></i> 
                Meu Perfil
              </button>
              
              {/* 🔥 A MÁGICA AQUI: Equipe e Configurações SÓ aparecem se for a Dona da conta! */}
              {isAdminConta && (
                <>
                  <button className="dropdown-item" onClick={() => irPara('/usuarios')}>
                    <i className="fas fa-users-cog"></i> 
                    Equipe
                  </button>
                  <button className="dropdown-item" onClick={() => irPara('/configuracoes')}>
                    <i className="fas fa-cog"></i> 
                    Configurações
                  </button>
                </>
              )}
              
              <div className="dropdown-divisor"></div>
              
              {/* Botão Oficial de SAIR que dispara o handleSair() */}
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