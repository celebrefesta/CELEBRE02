import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { calcularPeriodoTeste, verificarAssinaturaAtiva, parseDataGenerica } from '../utils/periodoTesteUtils';

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

                // 1. Sempre verifica se o e-mail está cadastrado na equipe de alguma empresa
                const emailLimpo = user.email ? user.email.toLowerCase().trim() : '';
                if (emailLimpo) {
                    try {
                        const qFunc = query(collection(db, "equipe"), where("email", "==", emailLimpo));
                        const snapFunc = await getDocs(qFunc);
                        if (!snapFunc.empty) {
                            const dadosFunc = snapFunc.docs[0].data();
                            if (dadosFunc.empresaId && dadosFunc.empresaId !== user.uid) {
                                tenantId = dadosFunc.empresaId;
                                isFuncionarioReal = true;
                                localStorage.setItem('tenantId', tenantId);
                                localStorage.setItem('userRole', 'funcionario');
                                localStorage.setItem('userRoleCargo', dadosFunc.cargo || 'Equipe');
                            }
                        }
                    } catch (eEq) {
                        console.warn("Aviso ao buscar equipe em RotaProtegida:", eEq);
                    }
                }

                if (ownDocSnap.exists()) {
                    const userData = ownDocSnap.data();
                    if (isFuncionarioReal) {
                        if (userData.tenantId !== tenantId || userData.role !== 'funcionario') {
                            updateDoc(doc(db, "usuarios", user.uid), {
                                tenantId: tenantId,
                                role: 'funcionario'
                            }).catch(() => {});
                        }
                    } else if (userData.role && userData.role !== 'owner' && userData.tenantId) {
                        tenantId = userData.tenantId;
                        isFuncionarioReal = true;
                        localStorage.setItem('tenantId', tenantId);
                    } else if (userData.tenantId && userData.tenantId !== user.uid) {
                        tenantId = userData.tenantId;
                        localStorage.setItem('tenantId', tenantId);
                    } else {
                        tenantId = user.uid;
                        localStorage.setItem('tenantId', user.uid);
                    }
                }

                const userSnap = await getDoc(doc(db, "usuarios", tenantId));

                if (userSnap.exists()) {
                    const dadosUsuario = userSnap.data();

                    // 🔍 Cálculo da data de última atividade real da conta:
                    const datasAtividade = [
                        parseDataGenerica(dadosUsuario.dataPagamento),
                        parseDataGenerica(dadosUsuario.dataProximaCobranca),
                        parseDataGenerica(dadosUsuario.dataFimTeste),
                        parseDataGenerica(dadosUsuario.ultimoAcesso),
                        parseDataGenerica(dadosUsuario.dataCadastro || dadosUsuario.criadoEm)
                    ].filter(Boolean);

                    const timestampMaisRecente = datasAtividade.length > 0 
                        ? Math.max(...datasAtividade.map(d => d.getTime()))
                        : 0;

                    const diasSemAtividade = timestampMaisRecente > 0
                        ? Math.max(0, Math.round((Date.now() - timestampMaisRecente) / (1000 * 60 * 60 * 24)))
                        : 999;

                    // ⏸️ CONTA SUSPENSA POR INATIVIDADE:
                    // Só bloqueia na tela de suspensão se a conta realmente estiver sem atividade há mais de 180 dias
                    if (dadosUsuario.statusConta === 'suspenso' || dadosUsuario.status === 'suspenso') {
                        if (diasSemAtividade <= 180) {
                            // Falso-positivo de inatividade (ex: teve cortesia ou pagamento recente). Auto-corrige!
                            try {
                                updateDoc(doc(db, "usuarios", tenantId), { 
                                    statusConta: 'bloqueado',
                                    status: 'bloqueado'
                                }).catch(() => {});
                            } catch (eFix) {}
                        } else {
                            setTemAcesso('suspenso');
                            return;
                        }
                    }

                    const infoAssinatura = verificarAssinaturaAtiva(dadosUsuario);
                    const assinaturaAtiva = infoAssinatura.ativa;

                    // LÓGICA SIMPLES DE TESTE: 7 dias a partir de dataCadastro da empresa (Centralizado e Unificado)
                    let testeAtivo = false;
                    if (!assinaturaAtiva) {
                        const infoT = calcularPeriodoTeste(dadosUsuario);
                        testeAtivo = infoT.emTeste;
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

    // ⏸️ Conta Suspensa por Inatividade
    if (temAcesso === 'suspenso') {
        return <Navigate to="/conta-suspensa" replace />;
    }

    // 🔒 CONGELADO: Envia para a tela de Assinatura/Upgrade
    if (temAcesso === false) {
        return <Navigate to="/upgrade" replace />;
    }

    // ✅ TUDO OK: Renderiza a página
    return children;
};

export default RotaProtegida;