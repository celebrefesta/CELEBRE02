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
import { calcularPeriodoTeste, formatarDataExibicao } from '../../utils/periodoTesteUtils';
import { aplicarCorDestaqueGlobal } from '../../utils/themeUtils';

const Configuracoes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
  const isOwner = tenantId === usuarioLogado?.uid;
  const isCollaborator = !isSuperAdmin && !isOwner;

  const [abaAtiva, setAbaAtiva] = useState(location.state?.aba || 'meu_perfil'); 
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
    if (location.state?.aba) {
      setAbaAtiva(location.state.aba);
    }
  }, [location.state]);
  const [isContaExpirada, setIsContaExpirada] = useState(false);

  // ==========================================
  // ESTADOS DO RESTO DO SISTEMA
  // ==========================================
  const [assinatura, setAssinatura] = useState({
    planoNome: 'Carregando...', precoMensal: '0,00', status: 'Carregando...',
    corBg: '#f1f5f9', corTexto: '#64748b', metodoPagamento: 'Nenhum', emailCobranca: '-',
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
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
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
        const contaAlvoRef = isSuperAdmin ? doc(db, 'usuarios', usuarioLogado.uid) : doc(db, 'usuarios', tenantId);
        const contaAlvoSnap = await getDoc(contaAlvoRef);
        
        let rawDataCriacao = usuarioLogado?.metadata?.creationTime;
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
            let statusReal = "Inativa / Sem Plano", corBg = "#fef2f2", corTexto = "#991b1b", textoMetodo = "Nenhum método cadastrado";
            let isActive = false, nomeDoPlano = "Básico (Gratuito)", precoDoPlano = "0,00", limiteAtual = 1;
            let emailCobranca = usuarioLogado.email, subId = null;

            if (contaAlvoSnap.exists()) {
                const cData = contaAlvoSnap.data();
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
                }

                if (cData.planoId) {
                    const planoSnap = await getDoc(doc(db, "planos", cData.planoId));
                    if (planoSnap.exists()) {
                        nomeDoPlano = planoSnap.data().nome; precoDoPlano = planoSnap.data().preco;
                        if (nomeDoPlano.toLowerCase().includes('premium')) limiteAtual = 3;
                        else if (nomeDoPlano.toLowerCase().includes('pro')) limiteAtual = 5;
                    }
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
                subscriptionId: subId, isActive: isActive, dataCriacao: dataFormatada
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
            onClick={() => navigate('/planos')} 
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
            onClick={() => setAbaAtiva('meu_perfil')}
          >
            <span className="tab-icon purple"><i className="fas fa-user"></i></span>
            <span>Meu Perfil</span>
          </button>

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'empresa' ? 'active' : ''} 
              onClick={() => setAbaAtiva('empresa')}
            >
              <span className="tab-icon blue"><i className="fas fa-building"></i></span>
              <span>Empresa</span>
            </button>
          )}

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'listas' ? 'active' : ''} 
              onClick={() => setAbaAtiva('listas')}
            >
              <span className="tab-icon amber"><i className="fas fa-boxes"></i></span>
              <span>Catálogo e Estoque</span>
            </button>
          )}

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'marketing' ? 'active' : ''} 
              onClick={() => setAbaAtiva('marketing')}
            >
              <span className="tab-icon cyan" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#0891b2' }}><i className="fas fa-chart-line"></i></span>
              <span>Marketing & Rastreamento</span>
            </button>
          )}

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'assinatura' ? 'active' : ''} 
              onClick={() => setAbaAtiva('assinatura')}
            >
              <span className="tab-icon green"><i className="fas fa-credit-card"></i></span>
              <span>Assinatura e Uso</span>
            </button>
          )}

          <button 
            className={abaAtiva === 'notificacoes' ? 'active' : ''} 
            onClick={() => setAbaAtiva('notificacoes')}
          >
            <span className="tab-icon red"><i className="fas fa-bell"></i></span>
            <span>Notificações</span>
          </button>

          <button 
            className={abaAtiva === 'seguranca' ? 'active' : ''} 
            onClick={() => setAbaAtiva('seguranca')}
          >
            <span className="tab-icon cyan"><i className="fas fa-shield-alt"></i></span>
            <span>Segurança</span>
          </button>

          <button 
            className={abaAtiva === 'aparencia' ? 'active' : ''} 
            onClick={() => setAbaAtiva('aparencia')}
          >
            <span className="tab-icon pink"><i className="fas fa-palette"></i></span>
            <span>Aparência</span>
          </button>

          {!isCollaborator && (
            <button 
              className={abaAtiva === 'backup' ? 'active' : ''} 
              onClick={() => setAbaAtiva('backup')}
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
            usuarioLogado={usuarioLogado}
            isCollaborator={isCollaborator}
            isSuperAdmin={isSuperAdmin}
            isOwner={isOwner}
            nomeEmpresa={config.nomeEmpresa}
            registrarLog={registrarLog}
            dataCriacaoConta={dataCriacaoConta}
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
            usuarioLogado={usuarioLogado}
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
          />
        )}

        {abaAtiva === 'notificacoes' && (
          <AbaNotificacoes 
            tenantId={tenantId}
            usuarioLogado={usuarioLogado}
            registrarLog={registrarLog}
          />
        )}

        {abaAtiva === 'seguranca' && (
          <AbaSeguranca
            usuarioLogado={usuarioLogado}
            registrarLog={registrarLog}
          />
        )}

        {abaAtiva === 'aparencia' && (
          <AbaAparencia />
        )}

        {abaAtiva === 'backup' && (
          <AbaBackup 
            tenantId={tenantId}
            usuarioLogado={usuarioLogado}
            registrarLog={registrarLog}
            configEmpresa={config}
          />
        )}

      </main>

    </div>
  );
};

export default Configuracoes;