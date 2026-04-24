import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const RotaProtegida = ({ recursoExigido, children }) => {
    const [temAcesso, setTemAcesso] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setTemAcesso(false);
                return;
            }

            try {
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const dadosUsuario = userSnap.data();

                    // 1. VERIFICA O TESTE DE 7 DIAS
                    let testeAtivo = false;
                    if (dadosUsuario.dataFimTeste) {
                        const dataFim = new Date(dadosUsuario.dataFimTeste);
                        const agora = new Date();
                        if (agora <= dataFim) {
                            testeAtivo = true;
                        }
                    }

                    // 🔥 2. A NOVA REGRA DE CONGELAMENTO 🔥
                    // Verifica se o cliente realmente pagou o plano
                    const assinaturaAtiva = dadosUsuario.assinaturaAtiva === true; 

                    // Se o teste acabou E ele não pagou, CONGELA O SISTEMA.
                    if (!testeAtivo && !assinaturaAtiva) {
                        setTemAcesso(false);
                        return; 
                    }

                    // 3. Se está no teste grátis, é VIP e tem passe livre
                    if (testeAtivo) {
                        setTemAcesso(true);
                        return;
                    }

                    // 4. Se o teste acabou MAS ELE PAGOU, verifica as regras do plano
                    const planoId = dadosUsuario.planoId;
                    if (planoId && assinaturaAtiva) {
                        const planoRef = doc(db, "planos", planoId);
                        const planoSnap = await getDoc(planoRef);
                        
                        if (planoSnap.exists()) {
                            const beneficios = planoSnap.data().beneficios || [];
                            const acessoLiberado = beneficios.includes(recursoExigido);
                            
                            setTemAcesso(acessoLiberado);
                            return;
                        }
                    }
                }
                
                setTemAcesso(false);
            } catch (error) {
                console.error("Erro ao verificar proteção de rota:", error);
                setTemAcesso(false);
            }
        });

        return () => unsubscribe();
    }, [recursoExigido]);

    if (temAcesso === null) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b', fontFamily: 'sans-serif' }}>
                <h3>A validar acesso seguro do Celebre...</h3>
            </div>
        );
    }

    // 🔒 CONGELADO: Envia para a tela de Assinatura/Upgrade
    if (temAcesso === false) {
        return <Navigate to="/upgrade" replace />;
    }

    return children;
};

export default RotaProtegida;