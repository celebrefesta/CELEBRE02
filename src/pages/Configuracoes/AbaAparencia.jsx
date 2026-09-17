import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import './Configuracoes.css';
import { aplicarCorDestaqueGlobal } from '../../utils/themeUtils';

const ACCENT_COLORS = [
  { id: 'gold', name: 'Dourado Celebre', color: '#c5a059', icon: '👑' },
  { id: 'rose', name: 'Rosa Glamour', color: '#e11d48', icon: '💖' },
  { id: 'pink', name: 'Pink Vibrante', color: '#ec4899', icon: '🌸' },
  { id: 'purple', name: 'Roxo Imperial', color: '#9333ea', icon: '💜' },
  { id: 'blue', name: 'Azul Royal', color: '#2563eb', icon: '💙' },
  { id: 'green', name: 'Verde Esmeralda', color: '#059669', icon: '💚' },
];

const AbaAparencia = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [accentColor, setAccentColor] = useState(localStorage.getItem('accentColor') || '#c5a059');
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'padrao');
  const [highContrast, setHighContrast] = useState(localStorage.getItem('highContrast') === 'true');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'pt');
  const [salvoFeedback, setSalvoFeedback] = useState(false);

  // Carrega configurações salvas na nuvem (Firestore) ao montar
  useEffect(() => {
    const carregarConfiguracoesFirestore = async () => {
      try {
        const tenantId = localStorage.getItem('tenantId') || auth.currentUser?.uid;
        if (!tenantId) return;
        const ref = doc(db, "configuracoes_empresa", tenantId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.accentColor) {
            setAccentColor(data.accentColor);
            localStorage.setItem('accentColor', data.accentColor);
            aplicarCorDestaqueGlobal(data.accentColor);
          }
          if (data.theme) {
            setTheme(data.theme);
            localStorage.setItem('theme', data.theme);
          }
          if (data.fontSize) {
            setFontSize(data.fontSize);
            localStorage.setItem('fontSize', data.fontSize);
          }
          if (data.highContrast !== undefined) {
            setHighContrast(data.highContrast);
            localStorage.setItem('highContrast', data.highContrast);
          }
          if (data.language) {
            setLanguage(data.language);
            localStorage.setItem('language', data.language);
          }
        }
      } catch (err) {
        console.warn("Erro ao carregar preferências de aparência:", err);
      }
    };
    carregarConfiguracoesFirestore();
  }, []);

  // Aplicação das variáveis dinâmicas no documento HTML
  useEffect(() => {
    let effectiveTheme = theme;
    let darkStyle = 'gray';

    if (theme === 'dark-midnight') {
      effectiveTheme = 'dark';
      darkStyle = 'midnight';
    } else if (theme === 'dark-gray' || theme === 'dark') {
      effectiveTheme = 'dark';
      darkStyle = 'gray';
    } else if (theme === 'auto') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
      darkStyle = prefersDark ? 'gray' : 'none';
    } else {
      effectiveTheme = 'light';
      darkStyle = 'none';
    }

    const escurecerHex = (hex, percent = 18) => {
      try {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        let r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
        let g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * (percent / 100)));
        let b = Math.max(0, (num & 0x0000FF) - Math.round(255 * (percent / 100)));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      } catch (e) {
        return hex;
      }
    };

    const darkerAccent = escurecerHex(accentColor, 18);

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-dark-style', darkStyle);
    document.documentElement.setAttribute('data-font-size', fontSize);
    document.documentElement.setAttribute('data-lang', language);
    document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : 'normal');

    // Aplica a cor primária no CSS root para todo o sistema
    document.documentElement.style.setProperty('--dourado', accentColor, 'important');
    document.documentElement.style.setProperty('--cor-destaque', accentColor, 'important');
    document.documentElement.style.setProperty('--primary-color', accentColor, 'important');
    document.documentElement.style.setProperty('--gold-primary', accentColor, 'important');
    document.documentElement.style.setProperty('--gold-dark', darkerAccent, 'important');
    aplicarCorDestaqueGlobal(accentColor);

    // Salva no localStorage
    localStorage.setItem('theme', theme);
    localStorage.setItem('darkStyle', darkStyle);
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('fontSize', fontSize);
    localStorage.setItem('highContrast', highContrast);
    localStorage.setItem('language', language);

    // Dispara evento global para todos os componentes reagirem na hora
    window.dispatchEvent(new Event('theme-change'));

    // Salva automaticamente no Firestore para garantir persistência total
    const salvarAutoFirestore = async () => {
      try {
        const tenantId = localStorage.getItem('tenantId') || auth.currentUser?.uid;
        if (tenantId) {
          const ref = doc(db, "configuracoes_empresa", tenantId);
          await setDoc(ref, {
            accentColor,
            theme,
            darkStyle,
            fontSize,
            highContrast,
            language
          }, { merge: true });
        }
      } catch (errSilent) {}
    };
    salvarAutoFirestore();
  }, [theme, accentColor, fontSize, highContrast, language]);

  const handleSalvarPreferencias = async () => {
    try {
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) {
        const ref = doc(db, "configuracoes_empresa", tenantId);
        await setDoc(ref, {
          accentColor,
          theme,
          darkStyle,
          fontSize,
          highContrast,
          language
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Erro ao salvar preferências no Firestore:", e);
    }
    setSalvoFeedback(true);
    setTimeout(() => setSalvoFeedback(false), 2500);
  };

  const handleMudarIdiomaAutomatico = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    if (lang === 'pt') {
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + window.location.hostname + "; path=/;";
    } else {
      document.cookie = `googtrans=/pt/${lang}; path=/;`;
      document.cookie = `googtrans=/pt/${lang}; domain=${window.location.hostname}; path=/;`;
    }
    setTimeout(() => { window.location.reload(); }, 300);
  };

  // Tema efetivo para o Live Preview
  const previewIsDark = theme.startsWith('dark') || (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const previewBg = theme === 'dark-gray' ? '#121212' : (previewIsDark ? '#0b0f19' : '#f8fafc');
  const previewCardBg = theme === 'dark-gray' ? '#18181b' : (previewIsDark ? '#111827' : '#ffffff');

  return (
    <div className="aparencia-container fade-in">

      {/* 🖼️ SELEÇÃO DE TEMA + LIVE PREVIEW MOCKUP */}
      <div className="aparencia-card">
        <div className="aparencia-card-header">
          <div className="aparencia-card-icon blue">
            🖼️
          </div>
          <div>
            <h3>Seletor de Tema & Pré-visualização Interativa</h3>
            <p>Escolha a aparência visual do painel Celebre com simulação em tempo real.</p>
          </div>
        </div>

        <div className="aparencia-preview-grid">
          
          {/* BOTÕES DE OPÇÃO DE TEMA */}
          <div className="aparencia-theme-options">
            <button 
              type="button" 
              className={`btn-aparencia-tema ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              style={theme === 'light' ? { borderColor: accentColor } : {}}
            >
              <span>☀️ Modo Claro (Clean Light)</span>
              {theme === 'light' && <i className="fas fa-check-circle theme-check-icon" style={{ color: accentColor }}></i>}
            </button>

            <button 
              type="button" 
              className={`btn-aparencia-tema ${theme === 'dark-gray' || theme === 'dark-neutral' ? 'active' : ''}`}
              onClick={() => setTheme('dark-gray')}
              style={(theme === 'dark-gray' || theme === 'dark-neutral') ? { borderColor: accentColor } : {}}
            >
              <span>🪨 Modo Escuro (Grafite Clássico)</span>
              {(theme === 'dark-gray' || theme === 'dark-neutral') && <i className="fas fa-check-circle theme-check-icon" style={{ color: accentColor }}></i>}
            </button>

            <button 
              type="button" 
              className={`btn-aparencia-tema ${theme === 'dark-midnight' || theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark-midnight')}
              style={(theme === 'dark-midnight' || theme === 'dark') ? { borderColor: accentColor } : {}}
            >
              <span>🌙 Modo Escuro (Azul Midnight)</span>
              {(theme === 'dark-midnight' || theme === 'dark') && <i className="fas fa-check-circle theme-check-icon" style={{ color: accentColor }}></i>}
            </button>

            <button 
              type="button" 
              className={`btn-aparencia-tema ${theme === 'auto' ? 'active' : ''}`}
              onClick={() => setTheme('auto')}
              style={theme === 'auto' ? { borderColor: accentColor } : {}}
            >
              <span>💻 Sincronizado com o Sistema</span>
              {theme === 'auto' && <i className="fas fa-check-circle theme-check-icon" style={{ color: accentColor }}></i>}
            </button>
          </div>

          {/* LIVE PREVIEW MOCKUP CARD */}
          <div 
            className="aparencia-preview-card"
            style={{
              background: previewBg,
              color: previewIsDark ? '#f8fafc' : '#0f172a',
              borderColor: accentColor
            }}
          >
            <div className="aparencia-preview-card-header" style={{ borderBottomColor: previewIsDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
              <div className="aparencia-preview-brand">
                <div className="aparencia-preview-logo-badge" style={{ background: accentColor }}>C</div>
                <strong>Celebre Dashboard</strong>
              </div>
              <span className="aparencia-preview-live-badge" style={{ background: accentColor }}>LIVE PREVIEW</span>
            </div>

            <div className="aparencia-preview-stat-grid">
              <div className="aparencia-preview-stat-box" style={{ background: previewCardBg, borderColor: previewIsDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                <span className="stat-box-lbl" style={{ color: previewIsDark ? '#94a3b8' : '#64748b' }}>Locações Mês</span>
                <strong className="stat-box-val" style={{ color: accentColor }}>R$ 48.500,00</strong>
              </div>
              <div className="aparencia-preview-stat-box" style={{ background: previewCardBg, borderColor: previewIsDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                <span className="stat-box-lbl" style={{ color: previewIsDark ? '#94a3b8' : '#64748b' }}>Eventos Ativos</span>
                <strong className="stat-box-val" style={{ color: previewIsDark ? '#ffffff' : '#0f172a' }}>34 Festas</strong>
              </div>
            </div>

            <button type="button" className="btn-aparencia-preview-cta" style={{ background: accentColor }}>
              🚀 Botão Exemplo Celebre
            </button>
          </div>

        </div>
      </div>


      {/* 🌈 PALETA DE CORES DA MARCA (ACCENT COLORS) */}
      <div className="aparencia-card">
        <div className="aparencia-card-header">
          <div className="aparencia-card-icon gold" style={{ color: accentColor }}>
            🌈
          </div>
          <div>
            <h3>Paleta de Cores de Destaque da Marca</h3>
            <p>Selecione a cor que destaca os botões, ícones e elementos principais do Celebre.</p>
          </div>
        </div>

        <div className="aparencia-colors-grid">
          {ACCENT_COLORS.map(c => {
            const isSelected = accentColor === c.color;
            return (
              <button
                key={c.id}
                type="button"
                className={`btn-color-swatch ${isSelected ? 'active' : ''}`}
                onClick={() => setAccentColor(c.color)}
                style={isSelected ? { borderColor: c.color, boxShadow: `0 4px 14px ${c.color}33` } : {}}
              >
                <div className="color-swatch-circle" style={{ background: c.color }}>
                  {isSelected ? <i className="fas fa-check"></i> : c.icon}
                </div>
                <strong className="color-swatch-name">{c.name}</strong>
              </button>
            );
          })}
        </div>
      </div>


      {/* 🔍 ESCALA DE FONTE & ACESSIBILIDADE */}
      <div className="aparencia-card">
        <div className="aparencia-card-header">
          <div className="aparencia-card-icon green">
            🔍
          </div>
          <div>
            <h3>Escala de Fonte & Acessibilidade Visual</h3>
            <p>Ajuste o tamanho dos textos e ative modos de alto contraste para leitura confortável.</p>
          </div>
        </div>

        <div className="aparencia-accessibility-grid">
          
          {/* SELETOR DE TAMANHO DE FONTE */}
          <div className="aparencia-font-box">
            <label className="aparencia-ctrl-label">
              TAMANHO DOS TEXTOS (ZOOM):
            </label>
            <div className="aparencia-font-btns">
              <button
                type="button"
                className={`btn-font-zoom ${fontSize === 'pequeno' ? 'active' : ''}`}
                onClick={() => setFontSize('pequeno')}
                style={fontSize === 'pequeno' ? { borderColor: accentColor } : {}}
              >
                <span>🔬 Pequeno (90%)</span>
              </button>

              <button
                type="button"
                className={`btn-font-zoom ${fontSize === 'padrao' ? 'active' : ''}`}
                onClick={() => setFontSize('padrao')}
                style={fontSize === 'padrao' ? { borderColor: accentColor } : {}}
              >
                <span>👓 Padrão (100%)</span>
              </button>

              <button
                type="button"
                className={`btn-font-zoom ${fontSize === 'ampliado' ? 'active' : ''}`}
                onClick={() => setFontSize('ampliado')}
                style={fontSize === 'ampliado' ? { borderColor: accentColor } : {}}
              >
                <span>🔍 Ampliado (110%)</span>
              </button>
            </div>
          </div>

          {/* CHAVE DE ALTO CONTRASTE */}
          <div className="aparencia-contrast-card">
            <div className="contrast-card-info">
              <strong>⚡ Modo Alto Contraste</strong>
              <span>Aumenta o contraste das bordas e textos para leitura clara.</span>
            </div>
            <button
              type="button"
              className={`btn-contrast-toggle ${highContrast ? 'active' : ''}`}
              onClick={() => setHighContrast(!highContrast)}
              style={highContrast ? { background: accentColor } : {}}
              aria-label="Alternar Modo Alto Contraste"
            >
              <div className="contrast-toggle-thumb" />
            </button>
          </div>

        </div>
      </div>


      {/* 🌐 IDIOMA & MOEDA DA INTERFACE */}
      <div className="aparencia-card">
        <div className="aparencia-card-header">
          <div className="aparencia-card-icon cyan">
            🌐
          </div>
          <div>
            <h3>Idioma & Região do Sistema</h3>
            <p>Selecione a linguagem e os símbolos de moeda exibidos nos módulos de relatórios e contratos.</p>
          </div>
        </div>

        <div className="aparencia-lang-grid">
          <button 
            type="button" 
            className={`btn-aparencia-lang ${language === 'pt' ? 'active' : ''}`} 
            onClick={() => handleMudarIdiomaAutomatico('pt')}
            style={language === 'pt' ? { borderColor: accentColor } : {}}
          >
            <span className="lang-name">🇧🇷 Português (Brasil)</span>
            <span className="lang-curr-pill brl">R$ BRL</span>
          </button>

          <button 
            type="button" 
            className={`btn-aparencia-lang ${language === 'en' ? 'active' : ''}`} 
            onClick={() => handleMudarIdiomaAutomatico('en')}
            style={language === 'en' ? { borderColor: accentColor } : {}}
          >
            <span className="lang-name">🇺🇸 English (US)</span>
            <span className="lang-curr-pill usd">$ USD</span>
          </button>

          <button 
            type="button" 
            className={`btn-aparencia-lang ${language === 'es' ? 'active' : ''}`} 
            onClick={() => handleMudarIdiomaAutomatico('es')}
            style={language === 'es' ? { borderColor: accentColor } : {}}
          >
            <span className="lang-name">🇪🇸 Español</span>
            <span className="lang-curr-pill eur">€ EUR</span>
          </button>
        </div>
      </div>

      {/* BOTÃO DE CONFIRMAÇÃO GLOBAL DE SALVAMENTO */}
      <div className="aparencia-save-bar">
        <button
          type="button"
          className="btn-salvar-aparencia"
          onClick={handleSalvarPreferencias}
          style={{
            background: accentColor,
            boxShadow: `0 4px 16px ${accentColor}44`
          }}
        >
          {salvoFeedback ? <i className="fas fa-check"></i> : <i className="fas fa-save"></i>}
          <span>{salvoFeedback ? 'PREFERÊNCIAS SALVAS COM SUCESSO!' : 'SALVAR PREFERÊNCIAS DE APARÊNCIA'}</span>
        </button>
      </div>

    </div>
  );
};

export default AbaAparencia;
