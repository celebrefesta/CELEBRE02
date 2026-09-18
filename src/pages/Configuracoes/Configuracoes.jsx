import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, getDocs, where, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import './Configuracoes.css';

import { CATALOGO_TEMAS, CATEGORIAS_FISICAS } from '../../catalogoDeTemas';
import AbaMeuPerfil from './AbaMeuPerfil'; 
import AbaEmpresa from './AbaEmpresa'; // 🔥 IMPORTÁMOS A ABA EMPRESA
import AbaMarketing from './AbaMarketing';
import AbaCatalogoEstoque from './AbaCatalogoEstoque';
import AbaAssinaturaUso from './AbaAssinaturaUso';
import AbaSeguranca from './AbaSeguranca';
import AbaAparencia from './AbaAparencia';
import AbaBackup from './AbaBackup';
import AbaNotificacoes from './AbaNotificacoes';
import { calcularPeriodoTeste, formatarDataExibicao, obterMelhorContaPorEmail } from '../../utils/periodoTesteUtils';
import { aplicarCorDestaqueGlobal } from '../../utils/themeUtils';

const Configuracoes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🛡️ DETECÇÃO DE MODO SUPORTE / IMPERSONAÇÃO DE CLIENTE PELO SUPER ADMIN
  const rawImp = localStorage.getItem('impersonatingTenant');
  let impData = null;
  if (rawImp) {
    try { impData = JSON.parse(rawImp); } catch (e) {}
  }
  const isImpersonating = Boolean(impData?.uid);

  const tenantId = impData?.uid || localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const isSuperAdminReal = usuarioLogado?.email === "celebrefesta25@gmail.com";
  // Quando estiver em modo suporte / impersonando cliente, opera com a visão e dados do cliente, NÃO como Super Admin global
  const isSuperAdmin = !isImpersonating && isSuperAdminReal;

  const targetUid = isImpersonating ? (impData.originalUid || impData.uid) : usuarioLogado?.uid;
  const targetEmail = isImpersonating ? (impData.email || '') : (usuarioLogado?.email || '');
  const targetNome = isImpersonating ? (impData.nome || '') : (usuarioLogado?.displayName || '');
  const targetRole = isImpersonating ? (impData.role || 'owner') : (localStorage.getItem('userRole') || 'owner');

  const isOwner = isImpersonating 
    ? (targetRole === 'owner' || targetRole === 'admin' || !targetRole || tenantId === targetUid)
    : (tenantId === usuarioLogado?.uid);
  const isCollaborator = !isSuperAdmin && !isOwner;

  const effectiveUser = isImpersonating ? {
    uid: targetUid,
    tenantId: tenantId,
    originalUid: impData.originalUid,
    email: targetEmail,
    displayName: targetNome,
    role: targetRole,
    isImpersonating: true,
    allUids: impData.allUids || []
  } : usuarioLogado;

  const queryTab = new URLSearchParams(location.search).get('tab');
  const [abaAtiva, setAbaAtiva] = useState(queryTab || location.state?.aba || 'meu_perfil'); 
  const [loading, setLoading] = useState(true);
  const [dataCriacaoConta, setDataCriacaoConta] = useState('');

  // 🎨 Sincronização em tempo real da Cor de Destaque da Marca (Aparência)
  useEffect(() => {
    const savedAccent = localStorage.getItem('accentColor') || '#c5a059';
    aplicarCorDestaqueGlobal(savedAccent);

    const handleThemeChange = () => {
      const currentAccent = localStorage.getItem('accentColor') || '#c5a059';
      aplicarCorDestaqueGlobal(currentAccent);
    };

    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  useEffect(() => {
    const qTab = new URLSearchParams(location.search).get('tab');
    if (location.state?.aba) {
      setAbaAtiva(location.state.aba);
    } else if (qTab) {
      setAbaAtiva(qTab);
    }
  }, [location.state, location.search]);

  const trocarAba = (novaAba) => {
    setAbaAtiva(novaAba);
    navigate(`/configuracoes?tab=${novaAba}`, { replace: true, state: { aba: novaAba } });
  };
  const [isContaExpirada, setIsContaExpirada] = useState(false);

  // ==========================================
  // ESTADOS DO RESTO DO SISTEMA
  // ==========================================
  const [assinatura, setAssinatura] = useState({
    planoNome: 'Plano Premium', precoMensal: '99,90', status: 'Carregando...',
    corBg: '#f1f5f9', corTexto: '#64748b', metodoPagamento: 'Cartão de Crédito', emailCobranca: '-',
    subscriptionId: null, isActive: false 
  });
  const [usoPlano, setUsoPlano] = useState({ limite: 1, usado: 1 });
  const [cancelando, setCancelando] = useState(false);


  
  const sigGlobal = useRef({});
  const [config, setConfig] = useState({
    localizacoes: [], categoriasFisicas: [], subcategoriasFisicas: {}, tamanhosPorCategoria: {}, catalogoVitrine: {}, 
    nomeEmpresa: '', cnpj: '', telefone: '', emailEmpresa: '', endereco: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', instagram: '', logotipo: '', slogan: '', site: '', assinatura: '', pixelFacebook: '',
    googleAnalyticsId: '', googleAdsId: '', tiktokPixelId: '', ogTitulo: '', ogDescricao: '', msgPadraoWhats: '', chavePix: '', linkPagamento: '' 
  });

  // ==========================================
  // CONTROLE DE ROLAGEM E FLECHAS LATERAIS DAS ABAS
  // ==========================================
  const tabsNavRef = useRef(null);
  const [podeRolarEsquerda, setPodeRolarEsquerda] = useState(false);
  const [podeRolarDireita, setPodeRolarDireita] = useState(false);

  const verificarScrollAbas = () => {
    const el = tabsNavRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Margem de segurança de 4px
    setPodeRolarEsquerda(scrollLeft > 4);
    setPodeRolarDireita(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    verificarScrollAbas();
    const t1 = setTimeout(verificarScrollAbas, 80);
    const t2 = setTimeout(verificarScrollAbas, 350);

    let resizeObserver;
    if (typeof window !== 'undefined' && window.ResizeObserver && tabsNavRef.current) {
      resizeObserver = new ResizeObserver(() => {
        verificarScrollAbas();
      });
      resizeObserver.observe(tabsNavRef.current);
    }
    window.addEventListener('resize', verificarScrollAbas);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', verificarScrollAbas);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [abaAtiva, isCollaborator]);

  // Centralizar suavemente a aba selecionada na viewport ao alternar
  useEffect(() => {
    const el = tabsNavRef.current;
    if (!el) return;
    const btnAtivo = el.querySelector('button.active');
    if (btnAtivo) {
      btnAtivo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setTimeout(verificarScrollAbas, 350);
    }
  }, [abaAtiva]);

  const rolarAbas = (direcao) => {
    const el = tabsNavRef.current;
    if (!el) return;
    const deslocamento = direcao === 'direita' ? 220 : -220;
    el.scrollBy({ left: deslocamento, behavior: 'smooth' });
    setTimeout(verificarScrollAbas, 350);
  };



  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || targetNome || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: targetEmail || usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de configurações:", error);
    }
  };



  useEffect(() => { 
    if (!usuarioLogado) { navigate('/login'); return; }
    carregarConfiguracoesGerais(); 
  }, [usuarioLogado, navigate, tenantId]);

  const getDocConfigRef = () => doc(db, "configuracoes_empresa", tenantId);

  const carregarConfiguracoesGerais = async () => {
    setLoading(true);
    try {
        const docRef = getDocConfigRef();
        const docSnap = await getDoc(docRef);
        let dadosConf = docSnap.exists() ? docSnap.data() : {};

        // 🎨 Sincroniza tema e cor da marca salvos no Firestore
        if (dadosConf.accentColor) {
          localStorage.setItem('accentColor', dadosConf.accentColor);
          aplicarCorDestaqueGlobal(dadosConf.accentColor);
        }
        if (dadosConf.theme) {
          localStorage.setItem('theme', dadosConf.theme);
        }
        if (dadosConf.highContrast !== undefined) {
          localStorage.setItem('highContrast', dadosConf.highContrast);
          document.documentElement.setAttribute('data-contrast', dadosConf.highContrast ? 'high' : 'normal');
        }

        let dbCatFis = dadosConf.categoriasFisicas || [];
        let dbSubCatFis = dadosConf.subcategoriasFisicas || {};
        let dbTamCat = dadosConf.tamanhosPorCategoria || {};
        let dbCatVitrine = dadosConf.catalogoVitrine;

        let precisaAtualizarDB = false;
        if (dbCatFis.length === 0 && Object.keys(CATEGORIAS_FISICAS).length > 0) {
            dbCatFis = Object.keys(CATEGORIAS_FISICAS);
            dbSubCatFis = CATEGORIAS_FISICAS;
            precisaAtualizarDB = true;
        }

        if (!dbCatVitrine || Object.keys(dbCatVitrine).length === 0) {
            dbCatVitrine = CATALOGO_TEMAS;
            precisaAtualizarDB = true;
        }
        const contaAlvoRef = isSuperAdmin ? doc(db, 'usuarios', usuarioLogado.uid) : doc(db, 'usuarios', targetUid || tenantId);
        let contaAlvoSnap = await getDoc(contaAlvoRef);
        if (!contaAlvoSnap.exists() && tenantId && tenantId !== targetUid) {
          const fallbackSnap = await getDoc(doc(db, 'usuarios', tenantId)).catch(() => null);
          if (fallbackSnap && fallbackSnap.exists()) {
            contaAlvoSnap = fallbackSnap;
          }
        }
        
        let rawDataCriacao = !isImpersonating ? usuarioLogado?.metadata?.creationTime : null;
        if (contaAlvoSnap.exists()) {
          const cData = contaAlvoSnap.data();
          rawDataCriacao = cData.dataCadastro || cData.criadoEm || rawDataCriacao;
        }
        const dataFormatada = formatarDataExibicao(rawDataCriacao);
        setDataCriacaoConta(dataFormatada);

        const newState = {
            ...dadosConf, userId: tenantId, categoriasFisicas: dbCatFis, subcategoriasFisicas: dbSubCatFis,
            tamanhosPorCategoria: dbTamCat, catalogoVitrine: dbCatVitrine || {},
            dataCadastro: dataFormatada
        };

        if (precisaAtualizarDB || !docSnap.exists()) {
             await setDoc(docRef, newState, { merge: true });
        }
        if (dadosConf.nomeEmpresa) {
          localStorage.setItem('nomeEmpresa', dadosConf.nomeEmpresa);
        }
        setConfig(prev => ({ ...prev, ...newState, dataCadastro: dataFormatada }));

        if (!isCollaborator) {
            let statusReal = "Inativa / Sem Plano", corBg = "#fef2f2", corTexto = "#991b1b", textoMetodo = "Cartão de Crédito";
            let isActive = false, nomeDoPlano = "Plano Premium", precoDoPlano = "99,90", limiteAtual = 3;
            let emailCobranca = targetEmail || usuarioLogado.email, subId = null;

            let cData = contaAlvoSnap.exists() ? contaAlvoSnap.data() : null;
            if (!cData && tenantId !== usuarioLogado.uid) {
              const fallbackSnap = await getDoc(doc(db, 'usuarios', tenantId)).catch(() => null);
              if (fallbackSnap && fallbackSnap.exists()) cData = fallbackSnap.data();
            }

            const emailBuscaConta = targetEmail || usuarioLogado.email;
            if (emailBuscaConta) {
              try {
                const qEmail = query(collection(db, 'usuarios'), where('email', '==', emailBuscaConta.toLowerCase().trim()));
                const snapEmail = await getDocs(qEmail);
                if (snapEmail.docs.length > 0) {
                  const melhor = obterMelhorContaPorEmail(snapEmail.docs);
                  if (melhor) cData = { ...(cData || {}), ...melhor };
                }
              } catch (eBest) {
                console.warn('Aviso ao buscar melhor conta por email em Configuracoes:', eBest);
              }
            }

            if (cData) {
                const infoT = calcularPeriodoTeste(cData);
                let testeAtivo = infoT.emTeste;
                const assinaturaAtiva = cData.assinaturaAtiva || cData.statusAssinatura === 'ativa' || cData.plano === 'pago';

                if (!isSuperAdmin && !testeAtivo && !assinaturaAtiva) {
                    setIsContaExpirada(true);
                } else {
                    setIsContaExpirada(false);
                }

                if (cData.assinaturaAtiva || cData.statusAssinatura === 'ativa' || cData.plano === 'pago') {
                    statusReal = "Assinatura Ativa"; corBg = "#f0fdf4"; corTexto = "#166534"; 
                    textoMetodo = cData.metodoPagamento || "Cartão de Crédito"; isActive = true;
                } else if (testeAtivo) {
                    statusReal = "Em Período de Teste (VIP)"; corBg = "#fffbeb"; corTexto = "#b45309"; 
                    textoMetodo = cData.metodoPagamento || "Cartão de Crédito";
                }

                // Identificação canônica do plano e ciclo
                const rawPId = String(cData.planoId || cData.plano || '').toLowerCase();
                let fallbackKey = 'premium';
                if (rawPId.includes('plus') || rawPId.includes('pro')) fallbackKey = 'plus';
                else if (rawPId.includes('basico') || rawPId.includes('básico')) fallbackKey = 'basico';
                else fallbackKey = 'premium';

                const isCicloAnual = Boolean(rawPId.includes('anual') || String(cData.cicloAssinatura || cData.ciclo || '').toLowerCase() === 'anual');

                if (fallbackKey === 'plus') {
                    nomeDoPlano = 'Plano Plus';
                    precoDoPlano = isCicloAnual ? '1.535,00' : '159,90';
                    limiteAtual = 5;
                } else if (fallbackKey === 'basico') {
                    nomeDoPlano = 'Plano Básico';
                    precoDoPlano = isCicloAnual ? '479,00' : '49,90';
                    limiteAtual = 1;
                } else {
                    nomeDoPlano = 'Plano Premium';
                    precoDoPlano = isCicloAnual ? '958,80' : '99,90';
                    limiteAtual = 3;
                }

                if (cData.planoId) {
                    try {
                        const planoSnap = await getDoc(doc(db, "planos", cData.planoId));
                        if (planoSnap && planoSnap.exists()) {
                            const pData = planoSnap.data();
                            if (pData.nome) nomeDoPlano = pData.nome;
                            if (pData.preco) precoDoPlano = String(pData.preco).replace('.', ',');
                            else if (pData.precoMensal) precoDoPlano = String(pData.precoMensal).replace('.', ',');
                            if (nomeDoPlano.toLowerCase().includes('premium')) limiteAtual = 3;
                            else if (nomeDoPlano.toLowerCase().includes('pro') || nomeDoPlano.toLowerCase().includes('plus')) limiteAtual = 5;
                        }
                    } catch (ePlano) {
                        console.warn("Aviso ao buscar plano no Firestore:", ePlano);
                    }
                }

                if (cData.valorAssinatura && cData.valorAssinatura !== '0,00' && cData.valorAssinatura !== 0) {
                    precoDoPlano = String(cData.valorAssinatura).replace('.', ',');
                }

                if (!textoMetodo || textoMetodo === "Nenhum método cadastrado" || textoMetodo === "Nenhum") {
                    textoMetodo = cData.metodoPagamento || (isActive ? "Cartão de Crédito" : "Mercado Pago (Cartão / PIX)");
                }

                emailCobranca = cData.email || usuarioLogado.email; subId = cData.subscriptionId || null;
            }

            if (isSuperAdmin) {
                nomeDoPlano = "Plano Master (Ilimitado)"; limiteAtual = 9999; statusReal = "Acesso Vitalício";
                corBg = "#fef3c7"; corTexto = "#92400e"; isActive = true; textoMetodo = "Administração Global";
            }

            setAssinatura({
                planoNome: nomeDoPlano, precoMensal: precoDoPlano, status: statusReal, corBg: corBg,
                corTexto: corTexto, metodoPagamento: textoMetodo, emailCobranca: emailCobranca,
                subscriptionId: subId, isActive: isActive,
                // Campo unificado de detecção: garante que calcularProximaDataRenovacao
                // ignore o período de teste quando a assinatura está ativa
                ativa: isActive,
                dataCriacao: dataFormatada,
                dataPagamento: cData?.dataPagamento || null,
                dataProximaCobranca: cData?.dataProximaCobranca || null,
                dataVencimento: cData?.dataVencimento || null
            });

            const qEquipe = query(collection(db, 'equipe'), where('empresaId', '==', tenantId));
            const snapEquipe = await getDocs(qEquipe);
            setUsoPlano({ limite: limiteAtual, usado: snapEquipe.size + 1 });
        }
    } catch (e) { console.error("Erro unificado:", e); }
    setLoading(false);
  };



  const handleCancelarAssinatura = async () => {
    if (!assinatura.subscriptionId) return alert("Não foi possível encontrar o ID da assinatura para cancelar.");
    if (!window.confirm("Tem certeza que deseja cancelar a sua assinatura? Perderá o acesso às ferramentas premium.")) return;
    setCancelando(true);
    try {
      const URL_FUNCAO_CANCELAR = 'https://us-central1-celebre-9f5c9.cloudfunctions.net/cancelarAssinatura';
      const resposta = await fetch(URL_FUNCAO_CANCELAR, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usuarioLogado.uid, subscriptionId: assinatura.subscriptionId })
      });
      if (resposta.ok) {
        await registrarLog("CANCELAMENTO DE ASSINATURA", `A assinatura da empresa foi cancelada no Mercado Pago.`);
        alert("Assinatura cancelada com sucesso.");
        setAssinatura(prev => ({ ...prev, status: 'Cancelada / Inativa', corBg: '#fef2f2', corTexto: '#991b1b', isActive: false }));
      } else { alert("Não foi possível cancelar no momento. Tente novamente."); }
    } catch (error) { alert("Erro de conexão ao tentar cancelar a assinatura."); } 
    finally { setCancelando(false); }
  };
  const handleConfigChange = (campo, valor) => setConfig(prev => ({ ...prev, [campo]: valor }));

  const salvarConfigTextual = async (campo, valor) => {
    if (!usuarioLogado) return;
    try { 
        await updateDoc(getDocConfigRef(), { [campo]: valor });
        if (campo === 'nomeEmpresa') {
          localStorage.setItem('nomeEmpresa', valor);
        }
        const nomesAmigaveis = { 
          nomeEmpresa: 'Nome da Empresa', cnpj: 'CNPJ / CPF', telefone: 'WhatsApp / Telefone', emailEmpresa: 'E-mail', endereco: 'Endereço Completo', instagram: 'Instagram', slogan: 'Slogan', site: 'Site / Link', pixelFacebook: 'Pixel do Facebook',
          googleAnalyticsId: 'Google Analytics 4', googleAdsId: 'Google Ads', tiktokPixelId: 'TikTok Pixel', ogTitulo: 'Título do Catálogo WhatsApp', ogDescricao: 'Descrição do Catálogo WhatsApp', msgPadraoWhats: 'Mensagem Padrão WhatsApp',
          chavePix: 'Chave PIX', linkPagamento: 'Link de Pagamento / Cartão'
        };
        await registrarLog("ALTERAÇÃO DE CONFIGURAÇÃO", `Atualizou o campo "${nomesAmigaveis[campo] || campo}" da empresa para: "${valor}".`);
    } catch (e) { console.error(e); }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !usuarioLogado) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
        else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        const base64Logo = canvas.toDataURL('image/png', 0.9);
        setConfig(prev => ({ ...prev, logotipo: base64Logo }));
        try { 
            await updateDoc(getDocConfigRef(), { logotipo: base64Logo });
            await registrarLog("IDENTIDADE VISUAL", "Atualizou o Logotipo da empresa.");
        } catch (e) { console.error(e); }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removerLogo = async () => {
    if(!window.confirm("Remover logotipo?")) return;
    setConfig(prev => ({ ...prev, logotipo: '' }));
    try { 
        await updateDoc(getDocConfigRef(), { logotipo: '' });
        await registrarLog("IDENTIDADE VISUAL", "Removeu o Logotipo da empresa.");
    } catch (e) { console.error(e); }
  };

  const limparAssinatura = () => { if(sigGlobal.current) sigGlobal.current.clear(); };
  
  const salvarAssinaturaGlobal = async () => {
    if (sigGlobal.current.isEmpty()) { alert("⚠️ Por favor, desenhe sua assinatura antes de salvar."); return; }
    const base64Sig = sigGlobal.current.getCanvas().toDataURL("image/png");
    setConfig(prev => ({ ...prev, assinatura: base64Sig }));
    try { 
        await updateDoc(getDocConfigRef(), { assinatura: base64Sig });
        await registrarLog("ASSINATURA DIGITAL", "Criou uma nova assinatura padrão para os contratos.");
        alert("✅ Assinatura padrão salva com sucesso!");
    } catch (e) { console.error(e); }
  };

  const removerAssinaturaGlobal = async () => {
    if(!window.confirm("Tem certeza que deseja apagar a assinatura padrão?")) return;
    setConfig(prev => ({ ...prev, assinatura: '' }));
    try { 
        await updateDoc(getDocConfigRef(), { assinatura: '' });
        await registrarLog("ASSINATURA DIGITAL", "Apagou a assinatura padrão dos contratos.");
    } catch (e) { console.error(e); }
  };

  const [salvandoTudo, setSalvandoTudo] = useState(false);

  const salvarConfiguracoesCompletas = async () => {
    if (!usuarioLogado) return;
    setSalvandoTudo(true);
    try {
      await setDoc(getDocConfigRef(), config, { merge: true });
      await registrarLog("SALVAR CONFIGURAÇÕES", "Salvou todas as configurações do sistema.");
      alert("✅ Configurações salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      alert("Erro ao salvar configurações do sistema.");
    } finally {
      setSalvandoTudo(false);
    }
  };

  if (loading) return <div className="loading-config">Carregando painel de controle...</div>;
  
  if (isContaExpirada) {
    return (
      <div className="config-container fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ background: 'var(--branco)', padding: '40px 32px', borderRadius: '16px', border: '1px solid var(--borda)', textAlign: 'center', maxWidth: '480px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '46px', marginBottom: '14px' }}>⏳</div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '10px' }}>Seu período de teste expirou!</h2>
          <p style={{ color: 'var(--texto-secundario)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            Para gerenciar ou alterar as configurações da sua empresa, escolha um plano ativo no Celebre.
          </p>
          <button 
            type="button" 
            onClick={() => navigate('/planos', { state: { from: '/configuracoes', aba: 'assinatura' } })} 
            style={{ width: '100%', padding: '14px', background: 'var(--dourado)', color: '#0f172a', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(197, 160, 89, 0.4)' }}
          >
            Ver Planos e Assinar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="config-container fade-in">
      <header className="config-header-top">
        <div className="config-header-brand-row">
          <button 
            type="button" 
            onClick={() => navigate('/dashboard')}
            className="config-btn-voltar"
          >
            <i className="fas fa-arrow-left"></i> Voltar ao Painel
          </button>

          <div className="config-header-text">
            <h1 className="config-header-title">Painel de Controle Central</h1>
            <p className="config-header-subtitle">Gerencie todos os aspectos do seu sistema em um único lugar.</p>
          </div>
        </div>
      </header>

      <div className="config-tabs-nav-wrapper">
        {podeRolarEsquerda && (
          <div className="config-tabs-arrow-wrapper-left">
            <button 
              type="button" 
              className="config-tabs-arrow-btn left"
              onClick={() => rolarAbas('esquerda')}
              aria-label="Rolar abas para a esquerda"
              title="Ver abas anteriores"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
          </div>
        )}

        <nav 
          className="config-top-tabs"
          ref={tabsNavRef}
          onScroll={verificarScrollAbas}
        >
          <button 
            className={abaAtiva === 'meu_perfil' ? 'active' : ''} 
            onClick={() => trocarAba('meu_perfil')}
          >
            <span className="tab-icon purple"><i className="fas fa-user"></i></span>
            <span>Meu Perfil</span>
          </button>

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'empresa' ? 'active' : ''} 
              onClick={() => trocarAba('empresa')}
            >
              <span className="tab-icon blue"><i className="fas fa-building"></i></span>
              <span>Empresa</span>
            </button>
          )}

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'listas' ? 'active' : ''} 
              onClick={() => trocarAba('listas')}
            >
              <span className="tab-icon amber"><i className="fas fa-boxes"></i></span>
              <span>Catálogo e Estoque</span>
            </button>
          )}

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'marketing' ? 'active' : ''} 
              onClick={() => trocarAba('marketing')}
            >
              <span className="tab-icon cyan" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#0891b2' }}><i className="fas fa-chart-line"></i></span>
              <span>Marketing & Rastreamento</span>
            </button>
          )}

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'assinatura' ? 'active' : ''} 
              onClick={() => trocarAba('assinatura')}
            >
              <span className="tab-icon green"><i className="fas fa-credit-card"></i></span>
              <span>Assinatura e Uso</span>
            </button>
          )}

          <button 
            className={abaAtiva === 'notificacoes' ? 'active' : ''} 
            onClick={() => trocarAba('notificacoes')}
          >
            <span className="tab-icon red"><i className="fas fa-bell"></i></span>
            <span>Notificações</span>
          </button>

          <button 
            className={abaAtiva === 'seguranca' ? 'active' : ''} 
            onClick={() => trocarAba('seguranca')}
          >
            <span className="tab-icon cyan"><i className="fas fa-shield-alt"></i></span>
            <span>Segurança</span>
          </button>

          <button 
            className={abaAtiva === 'aparencia' ? 'active' : ''} 
            onClick={() => trocarAba('aparencia')}
          >
            <span className="tab-icon pink"><i className="fas fa-palette"></i></span>
            <span>Aparência</span>
          </button>

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'backup' ? 'active' : ''} 
              onClick={() => trocarAba('backup')}
            >
              <span className="tab-icon indigo"><i className="fas fa-database"></i></span>
              <span>Backup & LGPD</span>
            </button>
          )}
        </nav>

        {podeRolarDireita && (
          <div className="config-tabs-arrow-wrapper-right">
            <button 
              type="button" 
              className="config-tabs-arrow-btn right"
              onClick={() => rolarAbas('direita')}
              aria-label="Rolar abas para a direita"
              title="Ver mais abas de configurações"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>



      <main className="config-main-area">
        
        {abaAtiva === 'meu_perfil' && (
          <AbaMeuPerfil 
            usuarioLogado={effectiveUser}
            isCollaborator={isCollaborator}
            isSuperAdmin={isSuperAdmin}
            isOwner={isOwner}
            nomeEmpresa={config.nomeEmpresa}
            registrarLog={registrarLog}
            dataCriacaoConta={dataCriacaoConta}
            isImpersonating={isImpersonating}
          />
        )}

        {/* 🔥 RENDERIZANDO A NOVA ABA EMPRESA AQUI 🔥 */}
        {abaAtiva === 'empresa' && (
          <AbaEmpresa 
            config={config}
            handleConfigChange={handleConfigChange}
            salvarConfigTextual={salvarConfigTextual}
            handleLogoUpload={handleLogoUpload}
            removerLogo={removerLogo}
            sigGlobal={sigGlobal}
            limparAssinatura={limparAssinatura}
            salvarAssinaturaGlobal={salvarAssinaturaGlobal}
            removerAssinaturaGlobal={removerAssinaturaGlobal}
            salvarTudo={salvarConfiguracoesCompletas}
            salvandoTudo={salvandoTudo}
            dataCriacaoConta={dataCriacaoConta}
          />
        )}

        {/* ========================================== */}
        {/* ABA: TABELAS E CATÁLOGO (Intacta) */}
        {/* ========================================== */}
        {abaAtiva === 'listas' && (
          <AbaCatalogoEstoque
            config={config}
            setConfig={setConfig}
            carregarConfiguracoesGerais={carregarConfiguracoesGerais}
            tenantId={tenantId}
            usuarioLogado={effectiveUser}
          />
        )}

        {/* ========================================== */}
        {/* ABA: MARKETING & RASTREAMENTO */}
        {/* ========================================== */}
        {abaAtiva === 'marketing' && (
          <AbaMarketing 
            config={config}
            handleConfigChange={handleConfigChange}
            salvarConfigTextual={salvarConfigTextual}
            tenantId={tenantId}
            nomeEmpresa={config.nomeEmpresa}
            salvarTudo={salvarConfiguracoesCompletas}
            salvandoTudo={salvandoTudo}
          />
        )}

        {abaAtiva === 'assinatura' && (
          <AbaAssinaturaUso
            isSuperAdmin={isSuperAdmin}
            assinatura={assinatura}
            usoPlano={usoPlano}
            cancelando={cancelando}
            handleCancelarAssinatura={handleCancelarAssinatura}
            dataCriacaoConta={dataCriacaoConta}
            usuarioLogado={effectiveUser}
            isImpersonating={isImpersonating}
          />
        )}

        {abaAtiva === 'notificacoes' && (
          <AbaNotificacoes 
            tenantId={tenantId}
            usuarioLogado={effectiveUser}
            registrarLog={registrarLog}
          />
        )}

        {abaAtiva === 'seguranca' && (
          <AbaSeguranca
            usuarioLogado={effectiveUser}
            registrarLog={registrarLog}
            isImpersonating={isImpersonating}
          />
        )}

        {abaAtiva === 'aparencia' && (
          <AbaAparencia />
        )}

        {abaAtiva === 'backup' && (
          <AbaBackup 
            tenantId={tenantId}
            usuarioLogado={effectiveUser}
            registrarLog={registrarLog}
            configEmpresa={config}
          />
        )}

      </main>

    </div>
  );
};

export default Configuracoes;