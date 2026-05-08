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

                    // 🔥 2. A NOVA REGRA BLINDADA DE IDENTIFICAÇÃO DE PAGAMENTO 🔥
                    // O sistema agora reconhece qualquer formato de status de pagamento ativo
                    const usuarioPagou = 
                        dadosUsuario.assinaturaAtiva === true || 
                        dadosUsuario.statusAssinatura === 'ativa' || 
                        dadosUsuario.plano === 'pago' || 
                        dadosUsuario.statusPagamentoVulso === 'pago';

                    if (!testeAtivo && !usuarioPagou) {
                        setTemAcesso(false);
                        return; 
                    }

                    // Se está no teste grátis, é VIP e tem passe livre
                    if (testeAtivo) {
                        setTemAcesso(true);
                        return;
                    }

                    // 4. Se o teste acabou MAS ELE PAGOU
                    if (usuarioPagou) {
                        const planoId = dadosUsuario.planoId;
                        
                        if (planoId) {
                            const planoRef = doc(db, "planos", planoId);
                            const planoSnap = await getDoc(planoRef);
                            
                            if (planoSnap.exists()) {
                                const nomePlano = (planoSnap.data().nome || '').toLowerCase();
                                const beneficios = planoSnap.data().beneficios || [];
                                
                                // 1ª Tentativa: Busca no array de benefícios oficial do banco
                                if (beneficios.includes(recursoExigido)) {
                                    setTemAcesso(true);
                                    return;
                                }
                                
                                // 🔥 2ª Tentativa (SALVA-VIDAS) 🔥
                                // Caso a dona não tenha configurado o array 'beneficios' direito no Firebase
                                if (recursoExigido === "Equipe") {
                                    // Apenas Premium e Pro podem acessar a tela de Equipe
                                    if (nomePlano.includes('pro') || nomePlano.includes('premium')) {
                                        setTemAcesso(true); 
                                        return;
                                    }
                                } else {
                                    // Para Estoque, Logística, Contratos... Qualquer plano pago (Básico, Premium, Pro) entra!
                                    setTemAcesso(true);
                                    return;
                                }
                            } else {
                                // Se o documento do plano sumiu, mas a pessoa tem ID de plano pago, libera!
                                setTemAcesso(true);
                                return;
                            }
                        } else {
                            // Se a pessoa pagou mas deu algum erro no checkout e o ID não salvou, libera para não trancar o cliente!
                            setTemAcesso(true);
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