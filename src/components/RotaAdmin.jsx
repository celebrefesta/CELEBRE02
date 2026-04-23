import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const RotaAdmin = ({ children }) => {
  const [carregando, setCarregando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const auth = getAuth();

  // 🔥 O e-mail que você definiu
  const emailAdmin = "celebrefesta25@gmail.com"; 

  useEffect(() => {
    // Escuta a mudança de estado de autenticação (espera o Firebase responder)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === emailAdmin) {
        setAutorizado(true);
      } else {
        setAutorizado(false);
      }
      setCarregando(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // Enquanto o Firebase não responde quem é o usuário, mostramos uma tela de espera
  if (carregando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Verificando credenciais de Administradora...</p>
      </div>
    );
  }

  // Se o carregamento terminou e NÃO está autorizado, redireciona
  if (!autorizado) {
    return <Navigate to="/dashboard" replace />;
  }

  // Se estiver tudo certo, mostra a página de edição
  return children;
};

export default RotaAdmin;