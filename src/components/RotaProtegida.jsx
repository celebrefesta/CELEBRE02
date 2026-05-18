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

            // 🔥 A CHAVE MESTRA: Ensina o porteiro a olhar para a Dona da Conta
            const tenantId = localStorage.getItem('tenantId') || user.uid;
            
            // Bypass para a Super-Admin (Você)
            const isSuperAdmin = user.email === "celebrefesta25@gmail.com";
            if (isSuperAdmin) {
                setTemAcesso(true);
                return;
            }

            try {
                // 🎯 BUSCA O PLANO DA EMPRESA E NÃO DO FUNCIONÁRIO
                const userRef = doc(db, "usuarios", tenantId);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const dadosUsuario = userSnap.data();

                    // 🔥 CORREÇÃO CRUCIAL: CÁLCULO DO TESTE GRÁTIS IGUAL AO DO DASHBOARD 🔥
                    let testeAtivo = false;
                    
                    if (dadosUsuario.dataFimTeste) {
                        const dataFim = new Date(dadosUsuario.dataFimTeste);
                        if (new Date() <= dataFim) testeAtivo = true;
                    } else if (dadosUsuario.dataCadastro) {
                        // Se não tem dataFimTeste, calcula 7 dias a partir do dia que a conta foi criada
                        let dataCad = dadosUsuario.dataCadastro;
                        if (dataCad.toDate) dataCad = dataCad.toDate();
                        
                        const diffTime = new Date().getTime() - new Date(dataCad).getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        
                        if (diffDays <= 7) {
                            testeAtivo = true;
                        }
                    } else {
                        // Fallback de segurança: Se não achar a data, libera para não travar o cliente à toa
                        testeAtivo = true;
                    }

                    // Identificação de pagamento ativo
                    const usuarioPagou = 
                        dadosUsuario.assinaturaAtiva === true || 
                        dadosUsuario.statusAssinatura === 'ativa' ||
                        dadosUsuario.plano === 'pago' || 
                        dadosUsuario.statusPagamentoVulso === 'pago';

                    // 1. Se NÃO está no teste e NÃO pagou = Bloqueio (vai para /upgrade)
                    if (!testeAtivo && !usuarioPagou) {
                        setTemAcesso(false);
                        return; 
                    }

                    // 2. Se está no teste grátis, é VIP e tem passe livre para testar tudo
                    if (testeAtivo) {
                        setTemAcesso(true);
                        return;
                    }

                    // 3. Se o teste acabou MAS A EMPRESA PAGOU
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
                                
                                // 2ª Tentativa (SALVA-VIDAS)
                                if (recursoExigido === "Equipe") {
                                    // Apenas Premium e Pro podem acessar a tela de Equipe
                                    if (nomePlano.includes('pro') || nomePlano.includes('premium')) {
                                        setTemAcesso(true);
                                        return;
                                    }
                                } else {
                                    // Para Estoque, Logística, Contratos... Qualquer plano pago entra!
                                    setTemAcesso(true);
                                    return;
                                }
                            } else {
                                setTemAcesso(true);
                                return;
                            }
                        } else {
                            setTemAcesso(true);
                            return;
                        }
                    }
                }
                
                // Se o documento da empresa não existir, bloqueia por segurança
                setTemAcesso(false);
            } catch (error) {
                console.error("Erro ao verificar proteção de rota:", error);
                setTemAcesso(false);
            }
        });

        return () => unsubscribe();
    }, [recursoExigido]);

    // Tela de Carregamento Rápido
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

    // ✅ TUDO OK: Renderiza a página
    return children;
};

export default RotaProtegida;