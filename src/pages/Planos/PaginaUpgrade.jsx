import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PaginaUpgrade.css';

const PaginaUpgrade = () => {
  const navigate = useNavigate();

  return (
    <div className="upgrade-wrapper">
      <div className="upgrade-card">
        <div className="icone-cadeado">
          <i className="fas fa-lock"></i>
        </div>
        
        <h1 className="upgrade-titulo">Recurso Exclusivo</h1>
        
        <p className="upgrade-texto">
          A funcionalidade que você tentou acessar faz parte de um plano superior. 
          Faça um upgrade agora mesmo para desbloquear todo o potencial do Celebre e escalar o seu negócio!
        </p>
        
        <div className="upgrade-botoes">
          <button className="btn-voltar" onClick={() => navigate(-1)}>
            Voltar
          </button>
          <button className="btn-ver-planos" onClick={() => navigate('/planos')}>
            Ver Planos Disponíveis <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaginaUpgrade;