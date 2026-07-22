import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, getDocs, where, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import './Configuracoes.css';

import { CATALOGO_TEMAS, CATEGORIAS_FISICAS } from '../../catalogoDeTemas';
import AbaMeuPerfil from './AbaMeuPerfil'; 
import AbaEmpresa from './AbaEmpresa'; // 🔥 IMPORTÁMOS A ABA EMPRESA
import AbaCatalogoEstoque from './AbaCatalogoEstoque';
import AbaAssinaturaUso from './AbaAssinaturaUso';
import AbaSeguranca from './AbaSeguranca';
import AbaAparencia from './AbaAparencia';

const Configuracoes = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
  const isOwner = tenantId === usuarioLogado?.uid;
  const isCollaborator = !isSuperAdmin && !isOwner;

  const [abaAtiva, setAbaAtiva] = useState('meu_perfil'); 
  const [loading, setLoading] = useState(true);

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
    nomeEmpresa: '', cnpj: '', telefone: '', emailEmpresa: '', endereco: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', instagram: '', logotipo: '', slogan: '', site: '', assinatura: '', pixelFacebook: '' 
  });



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

        const newState = {
            ...dadosConf, userId: tenantId, categoriasFisicas: dbCatFis, subcategoriasFisicas: dbSubCatFis,
            tamanhosPorCategoria: dbTamCat, catalogoVitrine: dbCatVitrine || {}
        };

        if (precisaAtualizarDB || !docSnap.exists()) {
             await setDoc(docRef, newState, { merge: true });
        }
        setConfig(prev => ({ ...prev, ...newState }));

        if (!isCollaborator) {
            const contaAlvoRef = isSuperAdmin ? doc(db, 'usuarios', usuarioLogado.uid) : doc(db, 'usuarios', tenantId);
            const contaAlvoSnap = await getDoc(contaAlvoRef);
            
            let statusReal = "Inativa / Sem Plano", corBg = "#fef2f2", corTexto = "#991b1b", textoMetodo = "Nenhum método cadastrado";
            let isActive = false, nomeDoPlano = "Básico (Gratuito)", precoDoPlano = "0,00", limiteAtual = 1;
            let emailCobranca = usuarioLogado.email, subId = null;

            if (contaAlvoSnap.exists()) {
                const cData = contaAlvoSnap.data();
                let testeAtivo = cData.dataFimTeste ? new Date() <= new Date(cData.dataFimTeste) : false;

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
                subscriptionId: subId, isActive: isActive
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
        const nomesAmigaveis = { nomeEmpresa: 'Nome da Empresa', cnpj: 'CNPJ / CPF', telefone: 'WhatsApp / Telefone', emailEmpresa: 'E-mail', endereco: 'Endereço Completo', instagram: 'Instagram', slogan: 'Slogan', site: 'Site / Link', pixelFacebook: 'Pixel do Facebook' };
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
  

  return (
    <div className="config-container fade-in">
      <header className="config-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            type="button" 
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fas fa-arrow-left"></i> Voltar ao Painel
          </button>

          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Painel de Controle Central</h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Gerencie todos os aspectos do seu sistema em um único lugar.</p>
          </div>
        </div>
      </header>

      <nav className="config-top-tabs">
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
            className={abaAtiva === 'assinatura' ? 'active' : ''} 
            onClick={() => setAbaAtiva('assinatura')}
          >
            <span className="tab-icon green"><i className="fas fa-credit-card"></i></span>
            <span>Assinatura e Uso</span>
          </button>
        )}

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
      </nav>



      <main className="config-main-area">
        
        {abaAtiva === 'meu_perfil' && (
          <AbaMeuPerfil 
            usuarioLogado={usuarioLogado}
            isCollaborator={isCollaborator}
            isSuperAdmin={isSuperAdmin}
            isOwner={isOwner}
            nomeEmpresa={config.nomeEmpresa}
            registrarLog={registrarLog}
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

        {abaAtiva === 'assinatura' && (
          <AbaAssinaturaUso
            isSuperAdmin={isSuperAdmin}
            assinatura={assinatura}
            usoPlano={usoPlano}
            cancelando={cancelando}
            handleCancelarAssinatura={handleCancelarAssinatura}
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

      </main>

    </div>
  );
};

export default Configuracoes;