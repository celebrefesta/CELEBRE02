import React, { useState, useMemo } from 'react';

const AbaMarketing = ({
  config = {},
  handleConfigChange,
  salvarConfigTextual,
  tenantId = '',
  nomeEmpresa = 'Sua Empresa',
  salvarTudo,
  salvandoTudo
}) => {
  // Estado local para gerador de links UTM
  const [canalUtm, setCanalUtm] = useState('insta_bio');
  const [nomeCampanhaCustom, setNomeCampanhaCustom] = useState('');
  const [copiadoUtm, setCopiadoUtm] = useState(false);
  const [abaDicas, setAbaDicas] = useState(null);
  const [salvoMarketingLocal, setSalvoMarketingLocal] = useState(false);

  // Garante a recuperação segura do tenantId da loja
  const idLojaResolvido = tenantId || (typeof localStorage !== 'undefined' ? localStorage.getItem('tenantId') : '') || '';

  // Domínio de Produção Oficial (celebrefesta.com.br ou domínio em que a aplicação está hospedada)
  const dominioProducaoOficial = useMemo(() => {
    if (typeof window !== 'undefined') {
      const { hostname, origin } = window.location;
      if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.includes('192.168.')) {
        return origin;
      }
    }
    return config.dominioOficial || 'https://celebrefesta.com.br';
  }, [config.dominioOficial]);

  // URL Base do Catálogo Online Oficial (Rota padrão: /catalogo/:idEmpresa)
  const urlCatalogoBase = useMemo(() => {
    if (!idLojaResolvido) return '';
    return `${dominioProducaoOficial}/catalogo/${idLojaResolvido}`;
  }, [dominioProducaoOficial, idLojaResolvido]);

  // Canais predefinidos de UTM
  const canaisDisponiveis = [
    { id: 'insta_bio', label: '📸 Bio do Instagram', source: 'instagram', medium: 'bio', defaultCamp: 'perfil_oficial' },
    { id: 'insta_stories', label: '📱 Stories / Destaques', source: 'instagram', medium: 'stories', defaultCamp: 'stories_diario' },
    { id: 'whatsapp', label: '💬 WhatsApp / Grupos', source: 'whatsapp', medium: 'chat', defaultCamp: 'atendimento_direto' },
    { id: 'parceria', label: '🤝 Parcerias (Buffet/Cerimonial)', source: 'parceiro', medium: 'indicacao', defaultCamp: 'espaco_festa' },
    { id: 'meta_ads', label: '🎯 Anúncio Pago (Meta Ads)', source: 'meta_ads', medium: 'cpc', defaultCamp: 'campanha_trafego' },
    { id: 'google_ads', label: '🔍 Google Ads (Busca)', source: 'google', medium: 'cpc', defaultCamp: 'pesquisa_festas' }
  ];

  // Cálculo da URL rastreada com UTM
  const canalSelecionado = canaisDisponiveis.find(c => c.id === canalUtm) || canaisDisponiveis[0];
  const campanhaSanitizada = (nomeCampanhaCustom || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  const urlRastreadaFinal = useMemo(() => {
    if (!urlCatalogoBase) return '';
    const params = [`utm_source=${canalSelecionado.source}`, `utm_medium=${canalSelecionado.medium}`];
    if (campanhaSanitizada) {
      params.push(`utm_campaign=${campanhaSanitizada}`);
    }
    return `${urlCatalogoBase}?${params.join('&')}`;
  }, [urlCatalogoBase, canalSelecionado, campanhaSanitizada]);

  // URL do QR Code Dinâmico Oficial
  const urlQrCodeAtual = useMemo(() => {
    if (!urlRastreadaFinal) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlRastreadaFinal)}`;
  }, [urlRastreadaFinal]);

  const copiarLinkRastreado = async () => {
    if (!urlRastreadaFinal) return;
    try {
      await navigator.clipboard.writeText(urlRastreadaFinal);
      setCopiadoUtm(true);
      setTimeout(() => setCopiadoUtm(false), 2500);
    } catch (err) {
      console.error("Erro ao copiar link:", err);
    }
  };

  const baixarQrCodeUtm = async () => {
    try {
      const response = await fetch(urlQrCodeAtual);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-${canalSelecionado.source}${campanhaSanitizada ? `-${campanhaSanitizada}` : ''}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      window.open(urlQrCodeAtual, '_blank');
    }
  };

  const empresaNomeExibicao = config.nomeEmpresa || nomeEmpresa || '';
  const ogTituloExibicao = config.ogTitulo || (empresaNomeExibicao ? `${empresaNomeExibicao} • Catálogo Oficial` : 'Catálogo Oficial de Peças & Decoração');
  const ogDescExibicao = config.ogDescricao || 'Confira nosso acervo completo e monte seu orçamento de peças para festas.';

  // Função para imprimir plaquinha de balcão para feiras/loja
  const imprimirPlaquinhaBalcao = () => {
    const printWin = window.open('', '_blank', 'width=750,height=800');
    if (!printWin) {
      alert("Por favor, habilite pop-ups para imprimir a plaquinha.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Display de Balcão • ${empresaNomeExibicao}</title>
          <meta charset="utf-8" />
          <style>
            @page { margin: 12mm; size: A5 portrait; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 20px;
              text-align: center;
              color: #0f172a;
              background: #ffffff;
            }
            .border-box {
              border: 3px solid #c5a059;
              border-radius: 20px;
              padding: 26px 18px;
              min-height: 86vh;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
            }
            .logo { max-height: 65px; object-fit: contain; margin-bottom: 10px; }
            h1 { font-size: 22px; margin: 0 0 6px 0; color: #0f172a; font-weight: 800; }
            .badge {
              display: inline-block;
              background: #fef3c7;
              color: #92400e;
              padding: 4px 14px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 16px;
            }
            .qr-wrapper {
              margin: 10px auto;
              padding: 14px;
              border: 2px dashed #cbd5e1;
              border-radius: 16px;
              display: inline-block;
              background: #fafafa;
            }
            .qr-wrapper img { width: 190px; height: 190px; display: block; }
            .instructions { font-size: 15px; color: #334155; font-weight: 700; margin: 14px 0 6px 0; }
            .subtext { font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.4; }
            .footer-channel { font-size: 10.5px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 14px; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 16px; text-align: right;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #c5a059; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(197, 160, 89, 0.3);">
              🖨️ Imprimir Plaquinha
            </button>
          </div>
          <div class="border-box">
            <div>
              ${config.logotipo ? `<img src="${config.logotipo}" class="logo" alt="Logo" />` : ''}
              <h1>${empresaNomeExibicao}</h1>
              <div class="badge">✨ Conheça Nosso Acervo Completo</div>
            </div>

            <div class="qr-wrapper">
              <img src="${urlQrCodeAtual}" alt="QR Code Catálogo" />
            </div>

            <div>
              <p class="instructions">📱 Aponte a câmera do celular</p>
              <p class="subtext">Acesse nosso catálogo digital e monte sua seleção de peças e orçamentos em tempo real!</p>
              <p class="footer-channel">Origem Rastreada: ${canalSelecionado.label} • Catálogo Online</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(() => printWin.print(), 400);
  };

  // Botão de testar no WhatsApp
  const testarNoWhatsApp = () => {
    if (!urlRastreadaFinal) return;
    const msg = `${ogTituloExibicao}\n\n${ogDescExibicao}\n\n${urlRastreadaFinal}`;
    const link = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(link, '_blank');
  };

  // Inserir tag dinâmica na mensagem
  const inserirTagMensagem = (tag) => {
    const textoAtual = config.msgPadraoWhats || '';
    const novoTexto = textoAtual ? `${textoAtual} ${tag}` : tag;
    handleConfigChange('msgPadraoWhats', novoTexto);
    salvarConfigTextual('msgPadraoWhats', novoTexto);
  };

  // Ação de salvar configurações completas
  const handleSalvarMarketingGeral = async () => {
    if (salvarTudo) {
      await salvarTudo();
      setSalvoMarketingLocal(true);
      setTimeout(() => setSalvoMarketingLocal(false), 3500);
    } else {
      setSalvoMarketingLocal(true);
      setTimeout(() => setSalvoMarketingLocal(false), 3500);
    }
  };

  return (
    <div className="config-tab-content-container aba-marketing-container fade-in">
      
      {/* ── BANNER DE CABEÇALHO DA ABA MARKETING ── */}
      <div className="marketing-hero-banner">
        <div className="marketing-hero-content">
          <div className="marketing-hero-tag-row">
            <span className="marketing-badge-glow">Inteligência de Vendas</span>
            <span className="marketing-badge-sub">Catálogo Vitrine & Tráfego Pago</span>
          </div>
          <h2 className="marketing-hero-title">
            Marketing, Rastreamento & Conversão
          </h2>
          <p className="marketing-hero-desc">
            Conecte suas campanhas de tráfego pago (Instagram, Facebook e Google), rastreie a origem exata de cada pedido e encante suas clientes no primeiro contato via WhatsApp.
          </p>
        </div>

        {/* ── COCKPIT EXECUTIVO DE CONECTIVIDADE (4 CANAIS) ── */}
        <div className="marketing-cockpit-grid">
          {/* 1. Meta Pixel */}
          <div className={`cockpit-status-card ${config.pixelFacebook ? 'ativo' : 'inativo'}`}>
            <div className="cockpit-icon meta">
              <i className="fab fa-facebook-f"></i>
            </div>
            <div className="cockpit-info">
              <span className="cockpit-label">Meta Ads (Insta)</span>
              <span className="cockpit-status">
                <span className="status-dot"></span>
                {config.pixelFacebook ? 'Conectado' : 'Inativo'}
              </span>
            </div>
          </div>

          {/* 2. Google GA4 */}
          <div className={`cockpit-status-card ${config.googleAnalyticsId ? 'ativo' : 'inativo'}`}>
            <div className="cockpit-icon ga4">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="cockpit-info">
              <span className="cockpit-label">Google GA4</span>
              <span className="cockpit-status">
                <span className="status-dot"></span>
                {config.googleAnalyticsId ? 'Conectado' : 'Inativo'}
              </span>
            </div>
          </div>

          {/* 3. Google Ads */}
          <div className={`cockpit-status-card ${config.googleAdsId ? 'ativo' : 'inativo'}`}>
            <div className="cockpit-icon gads">
              <i className="fas fa-bullhorn"></i>
            </div>
            <div className="cockpit-info">
              <span className="cockpit-label">Google Ads</span>
              <span className="cockpit-status">
                <span className="status-dot"></span>
                {config.googleAdsId ? 'Conectado' : 'Inativo'}
              </span>
            </div>
          </div>

          {/* 4. TikTok Ads */}
          <div className={`cockpit-status-card ${config.tiktokPixelId ? 'ativo' : 'inativo'}`}>
            <div className="cockpit-icon tiktok">
              <i className="fab fa-tiktok"></i>
            </div>
            <div className="cockpit-info">
              <span className="cockpit-label">TikTok Ads</span>
              <span className="cockpit-status">
                <span className="status-dot"></span>
                {config.tiktokPixelId ? 'Conectado' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD 1: PIXELS E TAGS DE CONVERSÃO (TRÁFEGO PAGO) ── */}
      <div className="config-card span-2-col-full marketing-card">
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fas fa-bullseye"></i>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Pixels & Tags de Conversão (Tráfego Pago)</h3>
            <p className="subtext">
              Rastreie visitantes que entram no catálogo, visualizam peças, adicionam ao carrinho e finalizam orçamentos.
            </p>
          </div>
        </div>

        <div className="form-grid-2-col" style={{ gap: '10px' }}>
          
          {/* 1.1 META PIXEL */}
          <div className="f-group" style={{ margin: 0 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><i className="fab fa-facebook-square" style={{ color: '#1877F2' }}></i> Meta Pixel ID (Instagram & Facebook)</span>
              {config.pixelFacebook && (
                <span className="badge-sucesso-conexao">✓ Rastreando Vitrine</span>
              )}
            </label>
            <div className="input-with-icon">
              <i className="fab fa-facebook input-icon" style={{ color: '#1877F2' }}></i>
              <input 
                type="text" 
                id="meta-pixel-id"
                name="meta-pixel-id"
                autoComplete="off"
                value={config.pixelFacebook || ''} 
                onChange={(e) => handleConfigChange('pixelFacebook', e.target.value.replace(/\D/g, ''))} 
                onBlur={(e) => salvarConfigTextual('pixelFacebook', e.target.value.trim())} 
                placeholder="" 
              />
            </div>
            <small className="field-help-text">
              Exemplo: <code>123456789012345</code> • Dispara eventos <strong>PageView</strong>, <strong>ViewContent</strong> e <strong>AddToCart</strong> na vitrine.
            </small>
          </div>

          {/* 1.2 GOOGLE ANALYTICS 4 (GA4) */}
          <div className="f-group" style={{ margin: 0 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><i className="fab fa-google" style={{ color: '#EA4335' }}></i> Google Analytics 4 (ID de Métrica)</span>
              {config.googleAnalyticsId && (
                <span className="badge-sucesso-conexao">✓ Conectado</span>
              )}
            </label>
            <div className="input-with-icon">
              <i className="fas fa-chart-bar input-icon" style={{ color: '#F4B400' }}></i>
              <input 
                type="text" 
                id="ga4-id"
                name="ga4-id"
                autoComplete="off"
                value={config.googleAnalyticsId || ''} 
                onChange={(e) => handleConfigChange('googleAnalyticsId', e.target.value.toUpperCase().trim())} 
                onBlur={(e) => salvarConfigTextual('googleAnalyticsId', e.target.value.toUpperCase().trim())} 
                placeholder="" 
              />
            </div>
            <small className="field-help-text">
              Exemplo: <code>G-XXXXXXXXXX</code> • Mede número de visitantes, cidades e peças mais visualizadas.
            </small>
          </div>

          {/* 1.3 GOOGLE ADS */}
          <div className="f-group" style={{ margin: 0 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><i className="fas fa-ad" style={{ color: '#4285F4' }}></i> Google Ads (ID de Conversão)</span>
              {config.googleAdsId && (
                <span className="badge-sucesso-conexao">✓ Conectado</span>
              )}
            </label>
            <div className="input-with-icon">
              <i className="fas fa-bullhorn input-icon" style={{ color: '#4285F4' }}></i>
              <input 
                type="text" 
                id="google-ads-id"
                name="google-ads-id"
                autoComplete="off"
                value={config.googleAdsId || ''} 
                onChange={(e) => handleConfigChange('googleAdsId', e.target.value.toUpperCase().trim())} 
                onBlur={(e) => salvarConfigTextual('googleAdsId', e.target.value.toUpperCase().trim())} 
                placeholder="" 
              />
            </div>
            <small className="field-help-text">
              Exemplo: <code>AW-123456789</code> • Para campanhas de busca paga ("aluguel de peças decorativas").
            </small>
          </div>

          {/* 1.4 TIKTOK ADS */}
          <div className="f-group" style={{ margin: 0 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><i className="fab fa-tiktok" style={{ color: '#111827' }}></i> TikTok Ads (Pixel ID)</span>
              {config.tiktokPixelId && (
                <span className="badge-sucesso-conexao">✓ Conectado</span>
              )}
            </label>
            <div className="input-with-icon">
              <i className="fab fa-tiktok input-icon" style={{ color: '#111827' }}></i>
              <input 
                type="text" 
                id="tiktok-pixel-id"
                name="tiktok-pixel-id"
                autoComplete="off"
                value={config.tiktokPixelId || ''} 
                onChange={(e) => handleConfigChange('tiktokPixelId', e.target.value.trim())} 
                onBlur={(e) => salvarConfigTextual('tiktokPixelId', e.target.value.trim())} 
                placeholder="" 
              />
            </div>
            <small className="field-help-text">
              Exemplo: <code>C1234567890ABCDE</code> • Para anúncios em vídeo de montagem de mesas e acervo.
            </small>
          </div>

        </div>

        {/* GUIA RÁPIDO DE AJUDA */}
        <div className="marketing-help-accordion">
          <div className="help-tabs-row">
            <button
              type="button"
              className={`btn-help-tab ${abaDicas === 'meta' ? 'active meta' : ''}`}
              onClick={() => setAbaDicas(prev => prev === 'meta' ? null : 'meta')}
            >
              <i className="fab fa-facebook" style={{ color: abaDicas === 'meta' ? 'inherit' : '#1877F2' }}></i>
              <span>Como pegar o Meta Pixel</span>
            </button>
            <button
              type="button"
              className={`btn-help-tab ${abaDicas === 'ga4' ? 'active ga4' : ''}`}
              onClick={() => setAbaDicas(prev => prev === 'ga4' ? null : 'ga4')}
            >
              <i className="fab fa-google" style={{ color: abaDicas === 'ga4' ? 'inherit' : '#EA4335' }}></i>
              <span>Como pegar o Google Analytics</span>
            </button>
          </div>

          {abaDicas === 'meta' && (
            <p className="help-tab-content">
              1. Acesse o <strong>Gerenciador de Eventos da Meta</strong> (business.facebook.com/events_manager).<br />
              2. Selecione sua <strong>Fonte de Dados / Pixel</strong>.<br />
              3. Na aba <strong>Configurações</strong>, localize a linha <strong>Identificação do Conjunto de Dados / ID do Pixel</strong> (código com 15 a 16 dígitos) e cole no campo acima.
            </p>
          )}

          {abaDicas === 'ga4' && (
            <p className="help-tab-content">
              1. Acesse <strong>analytics.google.com</strong> e vá na engrenagem de <strong>Administrador</strong>.<br />
              2. Em <strong>Coleta e modificação de dados &gt; Fluxos de dados</strong>, clique no seu fluxo web.<br />
              3. Copie o <strong>ID DA MÉTRICA</strong> (inicia com <code>G-</code>) e cole no campo acima.
            </p>
          )}
        </div>
      </div>

      {/* ── CARD 2: GERADOR DE LINKS RASTREADOS & QR CODE DINÂMICO ── */}
      <div className="config-card span-2-col-full marketing-card">
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fas fa-qrcode"></i>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Gerador de Links Rastreados & QR Code de Balcão (UTMs)</h3>
            <p className="subtext">
              Gere links e QR Codes com rastreamento para saber exatamente se a cliente veio da Bio, Stories, Parcerias com Buffets ou Plaquinhas de Eventos.
            </p>
          </div>
        </div>

        {/* SELETOR DE CANAIS */}
        <div style={{ marginBottom: '10px' }}>
          <label className="section-step-label">
            1. Onde você vai divulgar esse link ou colocar o QR Code?
          </label>
          <div className="utm-channels-grid">
            {canaisDisponiveis.map(c => {
              const isSelected = canalUtm === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanalUtm(c.id)}
                  className={`btn-utm-channel ${isSelected ? 'ativo' : ''}`}
                >
                  <span className="channel-label">{c.label}</span>
                  {isSelected && <i className="fas fa-check-circle channel-check"></i>}
                </button>
              );
            })}
          </div>
        </div>

        {/* NOME DA CAMPANHA */}
        <div className="f-group" style={{ marginBottom: '10px' }}>
          <label className="section-step-label">
            2. Nome da Campanha, Evento ou Buffet Parceiro (Opcional)
          </label>
          <input 
            type="text" 
            value={nomeCampanhaCustom} 
            onChange={(e) => setNomeCampanhaCustom(e.target.value)} 
            placeholder="" 
            style={{ maxWidth: '480px' }}
          />
          <small className="field-help-text">
            Opcional. Use para identificar ações específicas (ex: <code>feira_noivas_2026</code>, <code>buffet_villa_real</code>, <code>display_balcao</code>). Se não preencher, o link funciona normalmente.
          </small>
        </div>

        {/* CAIXA INTEGRADA: LINK RASTREADO + QR CODE DINÂMICO */}
        <div className="utm-output-panel">
          
          {/* LADO ESQUERDO: LINK TEXTUAL */}
          <div className="utm-text-col">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="utm-col-title" style={{ margin: 0 }}>
                <i className="fas fa-link"></i> Link Rastreado Oficial:
              </span>
              <span className="utm-mode-badge producao">
                🌐 Link Oficial
              </span>
            </div>
            <div className="utm-link-display">
              {urlRastreadaFinal || 'Carregando link...'}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button
                type="button"
                onClick={copiarLinkRastreado}
                className={`btn-utm-action ${copiadoUtm ? 'sucesso' : 'primary'}`}
              >
                <i className={`fas ${copiadoUtm ? 'fa-check' : 'fa-copy'}`}></i>
                <span>{copiadoUtm ? 'Link Copiado!' : 'Copiar Link Rastreado'}</span>
              </button>

              <a
                href={urlRastreadaFinal}
                target="_blank"
                rel="noreferrer"
                className="btn-utm-action secondary"
                title="Abrir o catálogo em nova aba para testar os parâmetros"
              >
                <i className="fas fa-external-link-alt"></i>
                <span>Abrir Catálogo</span>
              </a>
            </div>
          </div>

          {/* LADO DIREITO: QR CODE DINÂMICO DE BALCÃO */}
          <div className="utm-qr-col">
            <span className="utm-col-title">
              <i className="fas fa-qrcode"></i> QR Code para Display Físico:
            </span>
            
            <div className="utm-qr-card">
              <div className="qr-image-wrapper">
                <img src={urlQrCodeAtual} alt="QR Code UTM" />
              </div>
              
              <div className="qr-actions-buttons">
                <button
                  type="button"
                  onClick={baixarQrCodeUtm}
                  className="btn-qr-action download"
                  title="Baixar imagem PNG do QR Code em alta resolução"
                >
                  <i className="fas fa-download"></i> Baixar PNG
                </button>

                <button
                  type="button"
                  onClick={imprimirPlaquinhaBalcao}
                  className="btn-qr-action print"
                  title="Imprimir Display A5 pronto para mesa de buffet ou balcão"
                >
                  <i className="fas fa-print"></i> Imprimir Display A5
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── CARD 3: PRÉVIA NO WHATSAPP (OPEN GRAPH & COMPARTILHAMENTO) ── */}
      <div className="config-card span-2-col-full marketing-card">
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fab fa-whatsapp"></i>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Aparência no WhatsApp (Card de Compartilhamento)</h3>
            <p className="subtext">
              Personalize como o link do seu catálogo é apresentado quando compartilhado em conversas do WhatsApp com noivas e clientes.
            </p>
          </div>
        </div>

        <div className="whatsapp-preview-grid">
          
          {/* FORMULÁRIO DE CUSTOMIZAÇÃO */}
          <div className="whatsapp-form-col">
            <div className="f-group" style={{ margin: 0 }}>
              <label><i className="fas fa-heading" style={{ color: '#25D366' }}></i> Título de Apresentação</label>
              <input 
                type="text" 
                value={config.ogTitulo || ''} 
                onChange={(e) => handleConfigChange('ogTitulo', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('ogTitulo', e.target.value)} 
                placeholder="" 
              />
              <small className="field-help-text">
                Exemplo: <em>Nome da sua Empresa • Catálogo de Festas</em> (opcional).
              </small>
            </div>

            <div className="f-group" style={{ margin: 0 }}>
              <label><i className="fas fa-align-left" style={{ color: '#25D366' }}></i> Breve Descrição de Impacto</label>
              <textarea 
                rows="3"
                value={config.ogDescricao || ''} 
                onChange={(e) => handleConfigChange('ogDescricao', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('ogDescricao', e.target.value)} 
                placeholder="" 
                style={{ resize: 'vertical', minHeight: '80px', borderRadius: '8px', padding: '8px 10px' }}
              />
              <small className="field-help-text">
                Exemplo: <em>Confira nosso acervo completo e monte sua seleção de peças.</em> (opcional).
              </small>
            </div>

            {/* BOTÃO TESTAR NO MEU WHATSAPP */}
            <div style={{ paddingTop: '8px' }}>
              <button
                type="button"
                onClick={testarNoWhatsApp}
                className="btn-testar-whats-ao-vivo"
              >
                <i className="fab fa-whatsapp"></i>
                <span>Testar no Meu WhatsApp ao Vivo</span>
              </button>
              <small className="field-help-text" style={{ marginTop: '6px' }}>
                Abre o WhatsApp com o link para você testar no seu celular.
              </small>
            </div>
          </div>

          {/* MOCKUP HIPER-REALISTA DO WHATSAPP */}
          <div className="whatsapp-mockup-col">
            <div className="mockup-header-title">
              <i className="fas fa-mobile-alt"></i> Prévia em Tempo Real no WhatsApp da Cliente:
            </div>

            <div className="whatsapp-phone-screen">
              <div className="whatsapp-bubble">
                
                {/* CARD DO LINK */}
                <div className="whatsapp-link-preview-box">
                  <div className="whatsapp-link-cover">
                    {config.logotipo ? (
                      <img src={config.logotipo} alt="Logo" className="whatsapp-cover-logo" />
                    ) : (
                      <span className="whatsapp-cover-fallback">
                        ✨ {empresaNomeExibicao || 'Sua Empresa'}
                      </span>
                    )}
                  </div>

                  <div className="whatsapp-link-body">
                    <strong className="whatsapp-preview-title">{ogTituloExibicao}</strong>
                    <p className="whatsapp-preview-desc">{ogDescExibicao}</p>
                    <span className="whatsapp-preview-host">
                      {typeof window !== 'undefined' && !window.location.hostname.includes('localhost') ? window.location.hostname : 'celebrefesta.com.br'}
                    </span>
                  </div>
                </div>

                {/* TEXTO DO LINK */}
                <div className="whatsapp-link-url">
                  {urlCatalogoBase || 'https://celebrefesta.com.br/catalogo'}
                </div>
                
                <div className="whatsapp-timestamp">
                  11:42 <span className="blue-ticks">✓✓</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── CARD 4: MENSAGEM PADRÃO DO PEDIDO PELO WHATSAPP ── */}
      <div className="config-card span-2-col-full marketing-card">
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fas fa-comment-dots"></i>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Mensagem de Abertura do WhatsApp do Catálogo</h3>
            <p className="subtext">
              Configure o texto introdutório que é gerado quando a cliente finaliza a seleção de itens no catálogo e clica para falar com sua equipe.
            </p>
          </div>
        </div>

        <div className="f-group" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <label style={{ margin: 0 }}>
              <i className="fas fa-comment-alt" style={{ color: '#8b5cf6' }}></i> Mensagem de Abertura Inicial
            </label>
            
            {/* VARIÁVEIS RÁPIDAS CLICÁVEIS */}
            <div className="mensagem-tags-bar">
              <span className="tags-label">Tags rápidas:</span>
              <button 
                type="button" 
                className="btn-var-tag"
                onClick={() => inserirTagMensagem('{nome_empresa}')}
                title="Insere o nome da sua empresa"
              >
                + &#123;nome_empresa&#125;
              </button>
              <button 
                type="button" 
                className="btn-var-tag"
                onClick={() => inserirTagMensagem('{data_evento}')}
                title="Insere a data do evento selecionada"
              >
                + &#123;data_evento&#125;
              </button>
            </div>
          </div>

          <textarea 
            rows="3"
            value={config.msgPadraoWhats || ''} 
            onChange={(e) => handleConfigChange('msgPadraoWhats', e.target.value)} 
            onBlur={(e) => salvarConfigTextual('msgPadraoWhats', e.target.value)} 
            placeholder="" 
            style={{ resize: 'vertical', minHeight: '75px', borderRadius: '8px', padding: '8px 10px' }}
          />
          <small className="field-help-text" style={{ marginTop: '5px' }}>
            Campo 100% opcional. Se deixar vazio, o catálogo envia automaticamente: <em>"Olá! Vi essas peças no catálogo online e gostaria de verificar a disponibilidade para minha festa..."</em>.
          </small>
        </div>
      </div>

      {/* ── CARD 5: BARRA EXECUTIVA DE SALVAMENTO & SINCRONIZAÇÃO ── */}
      <div className="marketing-save-bar">
        <div className="marketing-save-info">
          <div className="marketing-save-icon">
            <i className="fas fa-cloud-upload-alt"></i>
          </div>
          <div>
            <div className="marketing-save-title">Sincronização de Tráfego & Conversão</div>
            <p className="marketing-save-desc">
              Pixels, tags de rastreamento, links UTM e aparência no WhatsApp são salvos ao editar. Use este botão para <span className="highlight">confirmar e salvar tudo de uma vez</span> na nuvem.
            </p>
          </div>
        </div>

        <button
          type="button"
          className={`btn-salvar-marketing-destaque ${(salvandoTudo) ? 'loading' : salvoMarketingLocal ? 'sucesso' : ''}`}
          onClick={handleSalvarMarketingGeral}
          disabled={salvandoTudo}
        >
          {salvandoTudo ? (
            <><i className="fas fa-spinner fa-spin"></i> Salvando na Nuvem...</>
          ) : salvoMarketingLocal ? (
            <><i className="fas fa-check-circle"></i> Configurações de Marketing Salvas!</>
          ) : (
            <><i className="fas fa-save"></i> Salvar Configurações de Marketing</>
          )}
        </button>
      </div>

    </div>
  );
};

export default AbaMarketing;
