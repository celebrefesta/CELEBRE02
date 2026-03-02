import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SininhoNotificacoes from './SininhoNotificacoes';
import './Topbar.css';

const Topbar = () => {
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  // Nome provisório que vai aparecer na tela (depois pode vir do seu banco de dados)
  const nomeUsuario = "Admin Celebre"; 

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
              <i className="fas fa-user"></i>
            </div>
            <span className="perfil-nome">{nomeUsuario}</span>
            <i className={`fas fa-chevron-down seta-menu ${menuAberto ? 'girar' : ''}`}></i>
          </button>

          {/* A Gaveta que abre ao clicar */}
          {menuAberto && (
            <div className="perfil-dropdown-menu">
              
              <div className="dropdown-cabecalho">
                <strong>{nomeUsuario}</strong>
                <span>Gerenciador do Sistema</span>
              </div>
              
              <button className="dropdown-item" onClick={() => irPara('/perfil')}>
                <i className="fas fa-user-circle"></i> 
                Meu Perfil
              </button>
              
              <button className="dropdown-item" onClick={() => irPara('/configuracoes')}>
                <i className="fas fa-cog"></i> 
                Configurações
              </button>
              
              <div className="dropdown-divisor"></div>
              
              <button className="dropdown-item sair" onClick={() => alert('Em breve faremos a tela de login!')}>
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