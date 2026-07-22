import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const parseFirestoreDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal.toDate) {
      try { return dateVal.toDate(); } catch (e) {}
  }
  if (dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
  }
  
  const str = String(dateVal).trim();
  
  // 1. Formato ISO ou AAAA-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
      const ano = parseInt(isoMatch[1], 10);
      const mes = parseInt(isoMatch[2], 10) - 1;
      const dia = parseInt(isoMatch[3], 10);
      return new Date(ano, mes, dia);
  }

  // 2. Formato brasileiro DD/MM/AAAA
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
      const dia = parseInt(brMatch[1], 10);
      const mes = parseInt(brMatch[2], 10) - 1;
      const ano = parseInt(brMatch[3], 10);
      return new Date(ano, mes, dia);
  }
  
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
      parsed.setHours(0,0,0,0);
      return parsed;
  }
  
  return null;
};

const RotaProtegida = ({ recursoExigido, children }) => {
    const [temAcesso, setTemAcesso] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setTemAcesso(false);
                return;
            }

            // Bypass para a Super-Admin
            if (user.email === "celebrefesta25@gmail.com") {
                setTemAcesso(true);
                return;
            }

            try {
                // RESOLUÇÃO CORRETA: Verifica doc próprio primeiro (é dono ou funcionário?)
                const ownDocSnap = await getDoc(doc(db, "usuarios", user.uid));

                let tenantId = user.uid;
                let isFuncionarioReal = false;

                 if (ownDocSnap.exists()) {
                     const userData = ownDocSnap.data();
                     if (userData.role && userData.role !== 'owner' && userData.tenantId) {
                         tenantId = userData.tenantId;
                         isFuncionarioReal = true;
                         localStorage.setItem('tenantId', tenantId);
                     } else {
                         tenantId = user.uid;
                         localStorage.setItem('tenantId', user.uid);
                     }
                 } else {
                     // Verifica se é funcionário de outra empresa
                     const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
                     const snapFunc = await getDocs(qFunc);
                     if (!snapFunc.empty && snapFunc.docs[0].data().empresaId) {
                         tenantId = snapFunc.docs[0].data().empresaId;
                         isFuncionarioReal = true;
                         localStorage.setItem('tenantId', tenantId);
                     }
                 }

                const userSnap = await getDoc(doc(db, "usuarios", tenantId));

                if (userSnap.exists()) {
                    const dadosUsuario = userSnap.data();

                    const assinaturaAtiva =
                        dadosUsuario.assinaturaAtiva === true || 
                        dadosUsuario.statusAssinatura === 'ativa' ||
                        dadosUsuario.plano === 'pago' || 
                        dadosUsuario.statusPagamentoVulso === 'pago';

                    // LÓGICA SIMPLES DE TESTE: 7 dias a partir de dataCadastro da empresa
                    let testeAtivo = false;
                    if (!assinaturaAtiva) {
                        const rawDateCompany = dadosUsuario.dataCadastro 
                            || dadosUsuario.criadoEm 
                            || dadosUsuario.createdAt 
                            || dadosUsuario.dataInicioTeste 
                            || (!isFuncionarioReal ? user.metadata?.creationTime : null);

                        const dataCadastroDate = parseFirestoreDate(rawDateCompany);

                        if (dataCadastroDate) {
                            const cadastroMeia = new Date(dataCadastroDate);
                            cadastroMeia.setHours(0,0,0,0);
                            
                            const dataFimTeste = new Date(cadastroMeia);
                            dataFimTeste.setDate(dataFimTeste.getDate() + 7);

                            const hojeNormalizado = new Date();
                            hojeNormalizado.setHours(0,0,0,0);

                            testeAtivo = hojeNormalizado < dataFimTeste;
                        }
                    } else {
                        testeAtivo = true;
                    }

                    // Teste expirou e não pagou → bloqueia
                    if (!testeAtivo && !assinaturaAtiva) {
                        setTemAcesso(false);
                        return;
                    }

                    // Dentro do período de teste → acesso total
                    if (testeAtivo) {
                        setTemAcesso(true);
                        return;
                    }

                    // Pagou — verifica o plano
                    if (assinaturaAtiva) {
                        const planoId = dadosUsuario.planoId;
                        if (!planoId || !recursoExigido) {
                            setTemAcesso(true);
                            return;
                        }
                        const planoSnap = await getDoc(doc(db, "planos", planoId));
                        if (planoSnap.exists()) {
                            const beneficios = planoSnap.data().beneficios || [];
                            if (beneficios.some(b => b.toLowerCase().includes(recursoExigido.toLowerCase()))) {
                                setTemAcesso(true);
                                return;
                            }
                        } else {
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