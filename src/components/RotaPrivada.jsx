import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const RotaPrivada = ({ children }) => {
  const [carregando, setCarregando] = useState(true);
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    // O Firebase fica vigiando se alguém entrou ou saiu
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLogado(true);
      } else {
        setLogado(false);
      }
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  if (carregando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#0f172a', fontWeight: 'bold' }}>
        Verificando acesso... 🔐
      </div>
    );
  }

  // Se não estiver logado, chuta para a tela de login!
  if (!logado) {
    return <Navigate to="/login" replace />;
  }

  // Se estiver logado, deixa ver a página normalmente
  return children;
};

export default RotaPrivada;