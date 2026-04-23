import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const RotaProtegida = ({ recursoExigido, children }) => {
    const [temAcesso, setTemAcesso] = useState(null);

    useEffect(() => {
        const verificarAcesso = async () => {
            try {
                // ⚠️ AQUI VOCÊ DEVE PEGAR O ID DO USUÁRIO LOGADO!
                // Exemplo: const userId = localStorage.getItem("uid");
                const userId = "id_do_usuario_logado"; // Substitua pela sua lógica de login
                
                // 1. Busca os dados do usuário
                const userRef = doc(db, "usuarios", userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const idPlanoDoUsuario = userSnap.data().planoId;
                    
                    // 2. Busca o plano que ele assina
                    const planoRef = doc(db, "planos", idPlanoDoUsuario);
                    const planoSnap = await getDoc(planoRef);
                    
                    if (planoSnap.exists()) {
                        const beneficios = planoSnap.data().beneficios || [];
                        
                        // 3. Verifica se a palavra exigida (ex: "Contratos") está nos benefícios
                        const acessoLiberado = beneficios.some(b => 
                            b.toLowerCase().includes(recursoExigido.toLowerCase())
                        );
                        
                        setTemAcesso(acessoLiberado);
                        return;
                    }
                }
                setTemAcesso(false);
            } catch (error) {
                console.error("Erro ao verificar proteção de rota:", error);
                setTemAcesso(false);
            }
        };

        verificarAcesso();
    }, [recursoExigido]);

    // Enquanto carrega a verificação do banco de dados
    if (temAcesso === null) {
        return <div className="loading-screen" style={{ textAlign: 'center', marginTop: '50px' }}>Verificando permissões...</div>;
    }

    // Se NÃO tem acesso, arremessa o usuário para a página de Upgrade
    if (temAcesso === false) {
        return <Navigate to="/upgrade" replace />;
    }

    // Se TEM acesso, mostra a página normalmente
    return children;
};

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const RotaProtegida = ({ recursoExigido, children }) => {
    const [temAcesso, setTemAcesso] = useState(null);

    useEffect(() => {
        const verificarAcesso = async () => {
            try {
                // ⚠️ AQUI ENTRA A SUA LÓGICA DE LOGIN 
                // Você precisa pegar o ID do usuário que acabou de logar no sistema.
                // Exemplo se você salva no LocalStorage ao logar:
                // const userId = localStorage.getItem("uid"); 
                
                const userId = "COLOQUE_AQUI_A_VARIAVEL_DO_SEU_USUARIO_LOGADO"; 
                
                if (!userId || userId === "COLOQUE_AQUI_A_VARIAVEL_DO_SEU_USUARIO_LOGADO") {
                     // Se não tem usuário logado, vamos fingir que tem acesso falso só para não quebrar sua tela agora
                     console.warn("Lógica de usuário não conectada na RotaProtegida");
                     setTemAcesso(true); // Mude para false quando arrumar o Login
                     return;
                }

                // 1. Vai no Firebase e olha quem é o usuário
                const userRef = doc(db, "usuarios", userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const idPlanoDoUsuario = userSnap.data().planoId;
                    
                    // 2. Vai no Firebase e olha o plano que ele assina (Que você edita no AdminPlanos!)
                    const planoRef = doc(db, "planos", idPlanoDoUsuario);
                    const planoSnap = await getDoc(planoRef);
                    
                    if (planoSnap.exists()) {
                        const beneficios = planoSnap.data().beneficios || [];
                        
                        // 3. A MÁGICA: Ele olha se o nome da linha (ex: "Contratos") está com o Check Verde no plano dele
                        const acessoLiberado = beneficios.some(b => 
                            b.toLowerCase().includes(recursoExigido.toLowerCase())
                        );
                        
                        setTemAcesso(acessoLiberado);
                        return;
                    }
                }
                setTemAcesso(false);
            } catch (error) {
                console.error("Erro ao verificar proteção de rota:", error);
                setTemAcesso(false);
            }
        };

        verificarAcesso();
    }, [recursoExigido]);

    // Tela de carregamento enquanto o sistema "pensa"
    if (temAcesso === null) {
        return <div className="loading-screen" style={{ textAlign: 'center', marginTop: '100px', fontWeight: 'bold', color: '#0f172a' }}>Verificando permissões do plano...</div>;
    }

    // Se ele NÃO TEM a linha marcada de verde no Admin Planos, é expulso para a tela de Upgrade!
    if (temAcesso === false) {
        return <Navigate to="/upgrade" replace />;
    }

    // Se está verdinho lá no Admin Planos, a página abre normalmente!
    return children;
};


export default RotaProtegida;