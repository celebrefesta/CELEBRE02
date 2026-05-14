import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './PaginaUpgrade.css';

const PaginaUpgrade = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE INTENÇÃO DE UPGRADE)
  const registrarLog = async () => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = usuarioLogado?.displayName || usuarioLogado?.email || "Usuário";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: "INTERESSE EM UPGRADE",
        detalhes: "Esbarrou num bloqueio de funcionalidade e clicou para ver os Planos Disponíveis.",
        userId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log de intenção de upgrade:", error);
    }
  };

  const handleVerPlanos = async () => {
    await registrarLog();
    navigate('/planos');
  };

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
          <button className="btn-ver-planos" onClick={handleVerPlanos}>
            Ver Planos Disponíveis <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaginaUpgrade;