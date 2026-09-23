import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import './PainelMinhaVitrine.css';

// 🎨 PALETAS EXCLUSIVAS DE COR DA MARCA PARA O CATÁLOGO
const CORES_VITRINE = [
  { id: 'gold', nome: 'Dourado Real', cor: '#c5a059', border: '#dfba73', icone: '👑' },
  { id: 'rose', nome: 'Rosa Quartz', cor: '#e11d48', border: '#fb7185', icone: '💖' },
  { id: 'pink', nome: 'Pink Vibrante', cor: '#ec4899', border: '#f472b6', icone: '🌸' },
  { id: 'purple', nome: 'Lilás Lavanda', cor: '#8b5cf6', border: '#a78bfa', icone: '💜' },
  { id: 'terracota', nome: 'Terracota Chic', cor: '#c2410c', border: '#fb923c', icone: '🍂' },
  { id: 'emerald', nome: 'Verde Botânico', cor: '#059669', border: '#34d399', icone: '🌿' },
  { id: 'cyan', nome: 'Azul Celeste', cor: '#0284c7', border: '#38bdf8', icone: '🌊' },
  { id: 'blue', nome: 'Azul Royal', cor: '#2563eb', border: '#60a5fa', icone: '💙' },
  { id: 'dark', nome: 'Ônix Minimal', cor: '#18181b', border: '#3f3f46', icone: '🖤' }
];

const PainelMinhaVitrine = () => {
  const navigate = useNavigate();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoSucesso, setSalvoSucesso] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(false);

  // Estados da Configuração da Vitrine
  const [catalogoAtivo, setCatalogoAtivo] = useState(true);
  const [corMarca, setCorMarca] = useState('#c5a059');
  const [tituloLoja, setTituloLoja] = useState('');
  const [descricaoLoja, setDescricaoLoja] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [capaUrl, setCapaUrl] = useState('');
  const [msgManutencao, setMsgManutencao] = useState('');

  // Upload previews e states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCapa, setUploadingCapa] = useState(false);

  // Estados de Diagnóstico do Acervo (Health Score)
  const [metricasEstoque, setMetricasEstoque] = useState({
    totalItens: 0,
    itensComFoto: 0,
    itensSemFoto: 0,
    itensComPreco: 0,
    itensSemPreco: 0
  });

  // URL Base do Catálogo Oficial
  const urlCatalogo = useMemo(() => {
    if (!tenantId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://celebrefesta.com.br';
    return `${origin}/catalogo/${tenantId}`;
  }, [tenantId]);

  // Carrega dados da empresa e métricas do estoque
  useEffect(() => {
    const carregarDados = async () => {
      if (!tenantId) return;
      setLoading(true);

      try {
        // 1. Carrega dados de configuração da empresa
        const refEmpresa = doc(db, "configuracoes_empresa", tenantId);
        const snapEmpresa = await getDoc(refEmpresa);

        if (snapEmpresa.exists()) {
          const d = snapEmpresa.data();
          setCatalogoAtivo(d.catalogoAtivo !== false);
          setCorMarca(d.corMarcaCatalogo || d.accentColor || '#c5a059');
          setTituloLoja(d.tituloCatalogo || d.nomeEmpresa || d.nome || '');
          setDescricaoLoja(d.descricaoCatalogo || 'Vitrine Oficial de Locação & Cenografia');
          setWhatsapp(d.whatsapp || d.telefone || '');
          setInstagram(d.instagram || '');
          setLogoUrl(d.logoUrl || d.logo || '');
          setCapaUrl(d.bannerUrl || d.capaUrl || '');
          setMsgManutencao(d.msgManutencaoCatalogo || 'Estamos atualizando nosso acervo de peças e temas. Fale conosco no WhatsApp para atendimento!');
        }

        // 2. Analisa dados do estoque para o Checklist de Prontidão
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snapEstoque = await getDocs(qEstoque);

        let comFoto = 0;
        let comPreco = 0;
        let total = 0;

        snapEstoque.forEach(docItem => {
          const item = docItem.data();
          if (item.status === 'inativo') return;
          total++;

          const temImg = Boolean(item.foto || item.imagem || (Array.isArray(item.fotos) && item.fotos.length > 0));
          if (temImg) comFoto++;

          const temValor = Boolean(Number(item.valorLocacao || item.valor || 0) > 0);
          if (temValor) comPreco++;
        });

        setMetricasEstoque({
          totalItens: total,
          itensComFoto: comFoto,
          itensSemFoto: Math.max(0, total - comFoto),
          itensComPreco: comPreco,
          itensSemPreco: Math.max(0, total - comPreco)
        });

      } catch (err) {
        console.error("Erro ao carregar dados da vitrine:", err);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [tenantId]);

  // Cálculo do Índice de Prontidão (Health Score da Vitrine de 0% a 100%)
  const checklist = useMemo(() => {
    const itens = [
      {
        id: 'titulo',
        label: 'Título da vitrine preenchido',
        ok: Boolean(tituloLoja?.trim()),
        tipo: 'obrigatorio'
      },
      {
        id: 'whats',
        label: 'WhatsApp válido para receber pedidos',
        ok: Boolean(whatsapp?.replace(/\D/g, '').length >= 10),
        tipo: 'obrigatorio'
      },
      {
        id: 'itens',
        label: 'Ao menos 1 item publicado no acervo',
        ok: metricasEstoque.totalItens > 0,
        detalhe: `${metricasEstoque.totalItens} peças publicadas`,
        tipo: 'obrigatorio'
      },
      {
        id: 'fotos',
        label: 'Itens com imagem fotográfica',
        ok: metricasEstoque.totalItens > 0 && metricasEstoque.itensSemFoto === 0,
        detalhe: `${metricasEstoque.itensComFoto}/${metricasEstoque.totalItens} com foto`,
        alerta: metricasEstoque.itensSemFoto > 0 ? `${metricasEstoque.itensSemFoto} peça(s) sem foto` : null,
        tipo: 'recomendado'
      },
      {
        id: 'precos',
        label: 'Itens com preço de locação definido',
        ok: metricasEstoque.totalItens > 0 && metricasEstoque.itensSemPreco === 0,
        detalhe: `${metricasEstoque.itensComPreco}/${metricasEstoque.totalItens} com preço`,
        alerta: metricasEstoque.itensSemPreco > 0 ? `${metricasEstoque.itensSemPreco} peça(s) sem preço` : null,
        tipo: 'recomendado'
      },
      {
        id: 'logo',
        label: 'Logotipo da empresa configurado',
        ok: Boolean(logoUrl),
        tipo: 'recomendado'
      },
      {
        id: 'capa',
        label: 'Imagem de capa da vitrine configurada',
        ok: Boolean(capaUrl),
        tipo: 'recomendado'
      }
    ];

    const concluidos = itens.filter(i => i.ok).length;
    const porcentagem = Math.round((concluidos / itens.length) * 100);

    return {
      itens,
      concluidos,
      total: itens.length,
      porcentagem
    };
  }, [tituloLoja, whatsapp, metricasEstoque, logoUrl, capaUrl]);

  // Salvar configurações
  const handleSalvar = async () => {
    if (!tenantId) return;
    setSalvando(true);
    setSalvoSucesso(false);

    try {
      const refEmpresa = doc(db, "configuracoes_empresa", tenantId);
      const snapEmpresa = await getDoc(refEmpresa);

      const dadosParaSalvar = {
        catalogoAtivo,
        corMarcaCatalogo: corMarca,
        tituloCatalogo: tituloLoja,
        descricaoCatalogo: descricaoLoja,
        whatsapp,
        instagram,
        logoUrl,
        bannerUrl: capaUrl,
        msgManutencaoCatalogo: msgManutencao,
        atualizadoEm: new Date().toISOString()
      };

      if (snapEmpresa.exists()) {
        await updateDoc(refEmpresa, dadosParaSalvar);
      } else {
        await setDoc(refEmpresa, dadosParaSalvar, { merge: true });
      }

      setSalvoSucesso(true);
      setTimeout(() => setSalvoSucesso(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar vitrine:", err);
      alert("Erro ao salvar configurações da vitrine.");
    } finally {
      setSalvando(false);
    }
  };

  // Copiar link oficial
  const handleCopiarLink = async () => {
    if (!urlCatalogo) return;
    try {
      await navigator.clipboard.writeText(urlCatalogo);
      setCopiadoLink(true);
      setTimeout(() => setCopiadoLink(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  // Compartilhar WhatsApp
  const handleCompartilharWhats = () => {
    const texto = encodeURIComponent(`Olá! Conheça nosso Catálogo Online exclusivo com acervo completo de peças e decorações para sua festa:\n\n✨ Acesse aqui: ${urlCatalogo}`);
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
  };

  // Upload simples de Logo via FileReader (Base64)
  const handleUploadLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem da logo deve ter no máximo 2MB.");
      return;
    }
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setLogoUrl(uploadEvent.target.result);
      setUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  // Upload simples de Capa via FileReader (Base64)
  const handleUploadCapa = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("A imagem de capa deve ter no máximo 3MB.");
      return;
    }
    setUploadingCapa(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setCapaUrl(uploadEvent.target.result);
      setUploadingCapa(false);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="minha-vitrine-container">
        <div className="vitrine-loading-state">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando Central da Minha Vitrine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="minha-vitrine-container fade-in">

      {/* 👑 CABEÇALHO EXECUTIVO */}
      <header className="vitrine-hero-header">
        <div className="vitrine-header-info">
          <button 
            type="button" 
            className="btn-voltar-dash" 
            onClick={() => navigate('/dashboard')}
            title="Voltar ao Painel"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <div className="vitrine-title-badge-row">
              <h1 className="vitrine-main-title">Minha Vitrine Online</h1>
              <span className={`badge-vitrine-status ${catalogoAtivo ? 'online' : 'paused'}`}>
                <span className="pulse-dot"></span>
                {catalogoAtivo ? 'Vitrine No Ar' : 'Pausada / Em Manutenção'}
              </span>
            </div>
            <p className="vitrine-main-subtitle">
              Personalize a identidade da sua loja, acompanhe a saúde do acervo e veja como seus clientes navegam.
            </p>
          </div>
        </div>

        <div className="vitrine-header-actions">
          <button 
            type="button" 
            className="btn-secondary-celebre btn-ver-vitrine"
            onClick={() => navigate(`/catalogo/${tenantId}`)}
            title="Abrir o Catálogo como seu cliente visualiza"
          >
            <i className="fas fa-eye"></i>
            <span>Visualizar Vitrine</span>
          </button>

          <button 
            type="button" 
            className="btn-primary-celebre btn-salvar-vitrine"
            onClick={handleSalvar}
            disabled={salvando}
          >
            <i className={salvando ? "fas fa-spinner fa-spin" : salvoSucesso ? "fas fa-check" : "fas fa-floppy-disk"}></i>
            <span>{salvando ? "Salvando..." : salvoSucesso ? "Salvo com Sucesso!" : "Salvar Alterações"}</span>
          </button>
        </div>
      </header>

      {/* 📊 1. CARDS DE KPI EXECUTIVOS (1 LINHA NO DESKTOP / 2 COLUNAS NO MOBILE) */}
      <div className="clientes-stats-grid vitrine-kpis-grid">
        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(197, 160, 89, 0.12)', color: '#c5a059' }}>
            <i className="fas fa-boxes-stacked"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">ITENS PUBLICADOS</span>
            <div className="stat-value-row">
              <strong className="stat-num">{metricasEstoque.totalItens}</strong>
              <span className="stat-unit">peças no ar</span>
            </div>
            <span className="stat-sub positive">Vitrine sincronizada</span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669' }}>
            <i className="fas fa-camera"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">COM IMAGEM</span>
            <div className="stat-value-row">
              <strong className="stat-num">{metricasEstoque.itensComFoto}</strong>
              <span className="stat-unit">com foto</span>
            </div>
            <span className={`stat-sub ${metricasEstoque.itensSemFoto > 0 ? 'warning' : 'positive'}`}>
              {metricasEstoque.itensSemFoto > 0 ? `${metricasEstoque.itensSemFoto} sem foto` : '100% com foto'}
            </span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
            <i className="fas fa-tag"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">COM PREÇO VISÍVEL</span>
            <div className="stat-value-row">
              <strong className="stat-num">{metricasEstoque.itensComPreco}</strong>
              <span className="stat-unit">com valor</span>
            </div>
            <span className="stat-sub neutral">Transparência para o cliente</span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
            <i className="fas fa-heart-pulse"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">SAÚDE DA LOJA</span>
            <div className="stat-value-row">
              <strong className="stat-num">{checklist.porcentagem}%</strong>
              <span className="stat-unit">prontidão</span>
            </div>
            <span className={`stat-sub ${checklist.porcentagem >= 80 ? 'positive' : 'warning'}`}>
              {checklist.porcentagem >= 80 ? 'Excelente estado' : 'Requer atenção'}
            </span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: catalogoAtivo ? 'rgba(5, 150, 105, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: catalogoAtivo ? '#059669' : '#ef4444' }}>
            <i className={catalogoAtivo ? "fas fa-globe" : "fas fa-pause"}></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">ESTADO DA VITRINE</span>
            <div className="stat-value-row">
              <strong className="stat-num" style={{ fontSize: '1.05rem', color: catalogoAtivo ? '#059669' : '#ef4444' }}>
                {catalogoAtivo ? 'DISPONÍVEL' : 'PAUSADA'}
              </strong>
            </div>
            <span className="stat-sub neutral">{catalogoAtivo ? 'Recebendo visitas' : 'Acesso pausado'}</span>
          </div>
        </div>
      </div>

      {/* ⚠️ ALERTA PROATIVO CASO A VITRINE PRECISE DE AJUSTES */}
      {metricasEstoque.itensSemFoto > 0 && (
        <div className="vitrine-alerta-proativo">
          <div className="alerta-icon-box">
            <i className="fas fa-triangle-exclamation"></i>
          </div>
          <div className="alerta-texto-box">
            <strong>Atenção: Você possui {metricasEstoque.itensSemFoto} peça(s) publicada(s) sem foto!</strong>
            <p>Clientes costumam ignorar peças sem imagem. Adicione fotos reais para aumentar as conversões da sua vitrine.</p>
          </div>
          <button 
            type="button" 
            className="btn-alerta-acao" 
            onClick={() => navigate('/estoque')}
          >
            Ajustar no Estoque →
          </button>
        </div>
      )}

      {/* 🌐 GRID DE BLOCOS DE CONFIGURAÇÃO */}
      <div className="vitrine-content-grid">

        {/* 🔗 BLOCO 1: PUBLICAÇÃO & LINK DA VITRINE */}
        <div className="vitrine-card-block span-2">
          <div className="block-header">
            <div className="block-icon gold">
              <i className="fas fa-link"></i>
            </div>
            <div>
              <h3>Publicação e Link Oficial</h3>
              <p>Controle a visibilidade da sua vitrine e o endereço que você envia para seus clientes.</p>
            </div>
          </div>

          <div className="block-body">
            {/* Chave Ativar / Pausar */}
            <div className="vitrine-toggle-row">
              <div className="toggle-info">
                <strong>Ativar Catálogo Online</strong>
                <span>Quando ativo, seu catálogo fica disponível publicamente para clientes visualizarem e enviarem pedidos.</span>
              </div>
              <label className="celebre-switch-label">
                <input 
                  type="checkbox" 
                  checked={catalogoAtivo} 
                  onChange={(e) => setCatalogoAtivo(e.target.checked)} 
                />
                <span className="celebre-switch-slider"></span>
              </label>
            </div>

            {/* Input e Ações do Link */}
            <div className="vitrine-link-dock mt-16">
              <span className="link-label">Endereço Público da sua Vitrine:</span>
              <div className="link-input-group">
                <input 
                  type="text" 
                  readOnly 
                  value={urlCatalogo} 
                  className="link-field" 
                  onClick={(e) => e.target.select()}
                />
                <button 
                  type="button" 
                  className="btn-link-action btn-copy" 
                  onClick={handleCopiarLink}
                  title="Copiar Link"
                >
                  <i className={copiadoLink ? "fas fa-check" : "fas fa-copy"}></i>
                  <span>{copiadoLink ? "Copiado!" : "Copiar"}</span>
                </button>
                <button 
                  type="button" 
                  className="btn-link-action btn-zap" 
                  onClick={handleCompartilharWhats}
                  title="Compartilhar no WhatsApp"
                >
                  <i className="fab fa-whatsapp"></i>
                  <span>Compartilhar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 🎨 BLOCO 2: IDENTIDADE VISUAL & COR DA MARCA */}
        <div className="vitrine-card-block">
          <div className="block-header">
            <div className="block-icon purple">
              <i className="fas fa-palette"></i>
            </div>
            <div>
              <h3>Identidade da Vitrine</h3>
              <p>Personalize as cores, logotipo e o visual que representam sua marca.</p>
            </div>
          </div>

          <div className="block-body">
            {/* Seletor de Cores da Marca */}
            <div className="form-group-celebre">
              <label className="field-label">
                Cor de Destaque da Vitrine (Botões, Badges e Carrinho):
              </label>
              <div className="cores-palette-picker">
                {CORES_VITRINE.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`color-pill-btn ${corMarca === p.cor ? 'active' : ''}`}
                    style={{ backgroundColor: p.cor }}
                    onClick={() => setCorMarca(p.cor)}
                    title={`${p.nome} (${p.cor})`}
                  >
                    {corMarca === p.cor && <i className="fas fa-check"></i>}
                  </button>
                ))}
              </div>
              <span className="field-help-text">
                Cor ativa: <strong style={{ color: corMarca }}>{CORES_VITRINE.find(c => c.cor === corMarca)?.nome || corMarca}</strong>
              </span>
            </div>

            {/* Título e Descrição */}
            <div className="form-group-celebre mt-14">
              <label className="field-label">Título da Loja (Nome na Vitrine):</label>
              <input 
                type="text" 
                className="celebre-input" 
                placeholder="Ex.: Mimos & Festas Decorações" 
                value={tituloLoja} 
                onChange={(e) => setTituloLoja(e.target.value)} 
              />
            </div>

            <div className="form-group-celebre mt-12">
              <label className="field-label">Descrição / Slogan de Boas-Vindas:</label>
              <textarea 
                className="celebre-textarea" 
                rows="2" 
                placeholder="Ex.: Peças exclusivas, kits pegue e monte e decorações completas para seu evento." 
                value={descricaoLoja} 
                onChange={(e) => setDescricaoLoja(e.target.value)} 
              />
            </div>

            {/* Uploads de Logo e Capa */}
            <div className="form-row-2col mt-14">
              <div className="upload-box-mini">
                <span className="upload-label">Logotipo da Loja:</span>
                <div className="upload-preview-area">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="thumb-logo-preview" />
                  ) : (
                    <div className="thumb-placeholder"><i className="fas fa-image"></i></div>
                  )}
                  <label className="btn-upload-file">
                    <i className={uploadingLogo ? "fas fa-spinner fa-spin" : "fas fa-upload"}></i>
                    <span>{logoUrl ? "Trocar Logo" : "Enviar Logo"}</span>
                    <input type="file" accept="image/*" onChange={handleUploadLogo} hidden />
                  </label>
                </div>
              </div>

              <div className="upload-box-mini">
                <span className="upload-label">Imagem de Capa (Banner):</span>
                <div className="upload-preview-area">
                  {capaUrl ? (
                    <img src={capaUrl} alt="Capa" className="thumb-capa-preview" />
                  ) : (
                    <div className="thumb-placeholder"><i className="fas fa-panorama"></i></div>
                  )}
                  <label className="btn-upload-file">
                    <i className={uploadingCapa ? "fas fa-spinner fa-spin" : "fas fa-upload"}></i>
                    <span>{capaUrl ? "Trocar Capa" : "Enviar Capa"}</span>
                    <input type="file" accept="image/*" onChange={handleUploadCapa} hidden />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 📋 BLOCO 3: CHECKLIST DE PRONTIDÃO (DIAGNÓSTICO REAL) */}
        <div className="vitrine-card-block">
          <div className="block-header">
            <div className="block-icon emerald">
              <i className="fas fa-clipboard-check"></i>
            </div>
            <div>
              <h3>Prontidão do Catálogo</h3>
              <p>Checklist inteligente gerado com base no acervo atual da sua empresa.</p>
            </div>
          </div>

          <div className="block-body">
            {/* Barra de Progresso Geral */}
            <div className="readiness-meter-box">
              <div className="meter-header">
                <strong>Índice de Prontidão da Vitrine</strong>
                <span className="meter-pct" style={{ color: checklist.porcentagem >= 80 ? '#059669' : '#c5a059' }}>
                  {checklist.porcentagem}% Concluído
                </span>
              </div>
              <div className="meter-track">
                <div 
                  className="meter-fill" 
                  style={{ 
                    width: `${checklist.porcentagem}%`,
                    backgroundColor: checklist.porcentagem >= 80 ? '#059669' : '#c5a059'
                  }}
                ></div>
              </div>
            </div>

            {/* Lista do Checklist */}
            <div className="checklist-items-stack mt-16">
              {checklist.itens.map(item => (
                <div key={item.id} className={`checklist-item-row ${item.ok ? 'checked' : 'pending'}`}>
                  <div className="check-status-icon">
                    <i className={item.ok ? "fas fa-circle-check" : "far fa-circle"}></i>
                  </div>
                  <div className="check-text-content">
                    <span className="check-label">{item.label}</span>
                    {item.detalhe && <small className="check-detail">{item.detalhe}</small>}
                    {item.alerta && <span className="check-alert">{item.alerta}</span>}
                  </div>
                  {item.tipo === 'recomendado' && !item.ok && (
                    <span className="badge-recomendado">Recomendado</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 📞 BLOCO 4: CONTATO & CANAIS DE ATENDIMENTO */}
        <div className="vitrine-card-block span-2">
          <div className="block-header">
            <div className="block-icon blue">
              <i className="fas fa-comments"></i>
            </div>
            <div>
              <h3>Contato e Atendimento</h3>
              <p>Canais oficiais onde o cliente entrará em contato para fechar o aluguel.</p>
            </div>
          </div>

          <div className="block-body">
            <div className="form-row-2col">
              <div className="form-group-celebre">
                <label className="field-label">WhatsApp para Receber Solicitações:</label>
                <div className="input-with-icon">
                  <i className="fab fa-whatsapp input-icon-prefix"></i>
                  <input 
                    type="text" 
                    className="celebre-input with-prefix" 
                    placeholder="(00) 00000-0000" 
                    value={whatsapp} 
                    onChange={(e) => setWhatsapp(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group-celebre">
                <label className="field-label">Instagram da Empresa (Opcional):</label>
                <div className="input-with-icon">
                  <i className="fab fa-instagram input-icon-prefix"></i>
                  <input 
                    type="text" 
                    className="celebre-input with-prefix" 
                    placeholder="@suaempresa" 
                    value={instagram} 
                    onChange={(e) => setInstagram(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Mensagem em caso de manutenção */}
            {!catalogoAtivo && (
              <div className="form-group-celebre mt-16">
                <label className="field-label" style={{ color: '#ef4444' }}>
                  <i className="fas fa-triangle-exclamation"></i> Mensagem exibida para o cliente enquanto o catálogo estiver pausado:
                </label>
                <textarea 
                  className="celebre-textarea" 
                  rows="2" 
                  value={msgManutencao} 
                  onChange={(e) => setMsgManutencao(e.target.value)} 
                />
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default PainelMinhaVitrine;
