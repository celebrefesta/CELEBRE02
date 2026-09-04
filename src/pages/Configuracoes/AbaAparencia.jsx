import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* 🖼️ SELEÇÃO DE TEMA + LIVE PREVIEW MOCKUP */}
      <div style={{ background: 'var(--branco)', borderRadius: '16px', padding: '24px', border: '1px solid var(--borda)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🖼️
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--texto-principal)' }}>Seletor de Tema & Pré-visualização Interativa</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>Escolha a aparência visual do painel Celebre com simulação em tempo real.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
          
          {/* BOTÕES DE OPÇÃO DE TEMA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
            <button 
              type="button" 
              onClick={() => setTheme('light')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                border: theme === 'light' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
                background: theme === 'light' ? 'var(--fundo-cinza)' : 'var(--branco)',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--texto-principal)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>☀️ Modo Claro (Clean Light)</span>
              {theme === 'light' && <i className="fas fa-check-circle" style={{ color: accentColor, fontSize: '16px' }}></i>}
            </button>

            <button 
              type="button" 
              onClick={() => setTheme('dark-gray')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                border: (theme === 'dark-gray' || theme === 'dark-neutral') ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
                background: (theme === 'dark-gray' || theme === 'dark-neutral') ? 'var(--fundo-cinza)' : 'var(--branco)',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--texto-principal)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>🪨 Modo Escuro (Cinza Grafite Clássico)</span>
              {(theme === 'dark-gray' || theme === 'dark-neutral') && <i className="fas fa-check-circle" style={{ color: accentColor, fontSize: '16px' }}></i>}
            </button>

            <button 
              type="button" 
              onClick={() => setTheme('dark-midnight')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                border: (theme === 'dark-midnight' || theme === 'dark') ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
                background: (theme === 'dark-midnight' || theme === 'dark') ? 'var(--fundo-cinza)' : 'var(--branco)',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--texto-principal)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>🌙 Modo Escuro (Azul Midnight Vibrante)</span>
              {(theme === 'dark-midnight' || theme === 'dark') && <i className="fas fa-check-circle" style={{ color: accentColor, fontSize: '16px' }}></i>}
            </button>

            <button 
              type="button" 
              onClick={() => setTheme('auto')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                border: theme === 'auto' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
                background: theme === 'auto' ? 'var(--fundo-cinza)' : 'var(--branco)',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--texto-principal)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>💻 Sincronizado com o Sistema</span>
              {theme === 'auto' && <i className="fas fa-check-circle" style={{ color: accentColor, fontSize: '16px' }}></i>}
            </button>
          </div>

          {/* LIVE PREVIEW MOCKUP CARD */}
          <div style={{
            background: previewBg,
            color: previewIsDark ? '#f8fafc' : '#0f172a',
            border: `2px solid ${accentColor}`,
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${previewIsDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: accentColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900 }}>C</div>
                <strong style={{ fontSize: '13px' }}>Celebre Dashboard</strong>
              </div>
              <span style={{ fontSize: '10px', background: accentColor, color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>LIVE PREVIEW</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: previewCardBg, padding: '10px', borderRadius: '10px', border: `1px solid ${previewIsDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
                <span style={{ fontSize: '10px', color: previewIsDark ? '#94a3b8' : '#64748b', display: 'block' }}>Locações Mês</span>
                <strong style={{ fontSize: '15px', color: accentColor }}>R$ 48.500,00</strong>
              </div>
              <div style={{ background: previewCardBg, padding: '10px', borderRadius: '10px', border: `1px solid ${previewIsDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
                <span style={{ fontSize: '10px', color: previewIsDark ? '#94a3b8' : '#64748b', display: 'block' }}>Eventos Ativos</span>
                <strong style={{ fontSize: '15px', color: previewIsDark ? '#ffffff' : '#0f172a' }}>34 Festas</strong>
              </div>
            </div>

            <button type="button" style={{ background: accentColor, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}>
              🚀 Botão Exemplo Celebre
            </button>
          </div>

        </div>
      </div>


      {/* 🌈 PALETA DE CORES DA MARCA (ACCENT COLORS) */}
      <div style={{ background: 'var(--branco)', borderRadius: '16px', padding: '24px', border: '1px solid var(--borda)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(197, 160, 89, 0.15)', color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🌈
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--texto-principal)' }}>Paleta de Cores de Destaque da Marca</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>Selecione a cor que destaca os botões, ícones e elementos principais do Celebre.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {ACCENT_COLORS.map(c => {
            const isSelected = accentColor === c.color;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setAccentColor(c.color)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 12px',
                  borderRadius: '14px',
                  border: isSelected ? `2.5px solid ${c.color}` : '1.5px solid var(--borda)',
                  background: isSelected ? 'var(--fundo-cinza)' : 'var(--branco)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 4px 14px ${c.color}33` : 'none'
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '16px', marginBottom: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                  {isSelected ? <i className="fas fa-check"></i> : c.icon}
                </div>
                <strong style={{ fontSize: '12.5px', color: 'var(--texto-principal)', textAlign: 'center' }}>{c.name}</strong>
              </button>
            );
          })}
        </div>
      </div>


      {/* 🔍 ESCALA DE FONTE & ACESSIBILIDADE */}
      <div style={{ background: 'var(--branco)', borderRadius: '16px', padding: '24px', border: '1px solid var(--borda)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(4, 120, 87, 0.15)', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🔍
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--texto-principal)' }}>Escala de Fonte & Acessibilidade Visual</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>Ajuste o tamanho dos textos e ative modos de alto contraste para leitura confortável.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          
          {/* SELETOR DE TAMANHO DE FONTE */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--texto-secundario)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              TAMANHO DOS TEXTOS (ZOOM):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setFontSize('pequeno')}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: fontSize === 'pequeno' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
                  background: fontSize === 'pequeno' ? 'var(--fundo-cinza)' : 'var(--branco)',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: 'var(--texto-principal)'
                }}
              >
                🔬 Pequeno (90%)
              </button>

              <button
                type="button"
                onClick={() => setFontSize('padrao')}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: fontSize === 'padrao' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
                  background: fontSize === 'padrao' ? 'var(--fundo-cinza)' : 'var(--branco)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: 'var(--texto-principal)'
                }}
              >
                👓 Padrão (100%)
              </button>

              <button
                type="button"
                onClick={() => setFontSize('ampliado')}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: fontSize === 'ampliado' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
                  background: fontSize === 'ampliado' ? 'var(--fundo-cinza)' : 'var(--branco)',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--texto-principal)'
                }}
              >
                🔍 Ampliado (110%)
              </button>
            </div>
          </div>

          {/* CHAVE DE ALTO CONTRASTE */}
          <div style={{ background: 'var(--fundo-cinza)', border: '1px solid var(--borda)', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong style={{ fontSize: '13.5px', color: 'var(--texto-principal)', display: 'block' }}>⚡ Modo Alto Contraste</strong>
              <span style={{ fontSize: '11.5px', color: 'var(--texto-secundario)' }}>Aumenta o contraste das bordas e textos para leitura clara.</span>
            </div>
            <button
              type="button"
              onClick={() => setHighContrast(!highContrast)}
              style={{
                width: '50px',
                height: '26px',
                borderRadius: '13px',
                background: highContrast ? accentColor : '#cbd5e1',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: highContrast ? '26px' : '4px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>

        </div>
      </div>


      {/* 🌐 IDIOMA & MOEDA DA INTERFACE */}
      <div style={{ background: 'var(--branco)', borderRadius: '16px', padding: '24px', border: '1px solid var(--borda)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(14, 116, 144, 0.15)', color: '#0e7490', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🌐
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--texto-principal)' }}>Idioma & Região do Sistema</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>Selecione a linguagem e os símbolos de moeda exibidos nos módulos de relatórios e contratos.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <button 
            type="button" 
            className={`btn-lang ${language === 'pt' ? 'active' : ''}`} 
            onClick={() => handleMudarIdiomaAutomatico('pt')}
            style={{
              padding: '14px',
              borderRadius: '12px',
              border: language === 'pt' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
              background: language === 'pt' ? 'var(--fundo-cinza)' : 'var(--branco)',
              fontWeight: 800,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--texto-principal)'
            }}
          >
            <span>🇧🇷 Português (Brasil)</span>
            <span style={{ fontSize: '11px', background: 'rgba(29, 78, 216, 0.15)', color: '#1d4ed8', padding: '2px 6px', borderRadius: '6px' }}>R$ BRL</span>
          </button>

          <button 
            type="button" 
            className={`btn-lang ${language === 'en' ? 'active' : ''}`} 
            onClick={() => handleMudarIdiomaAutomatico('en')}
            style={{
              padding: '14px',
              borderRadius: '12px',
              border: language === 'en' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
              background: language === 'en' ? 'var(--fundo-cinza)' : 'var(--branco)',
              fontWeight: 800,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--texto-principal)'
            }}
          >
            <span>🇺🇸 English (US)</span>
            <span style={{ fontSize: '11px', background: 'rgba(4, 120, 87, 0.15)', color: '#047857', padding: '2px 6px', borderRadius: '6px' }}>$ USD</span>
          </button>

          <button 
            type="button" 
            className={`btn-lang ${language === 'es' ? 'active' : ''}`} 
            onClick={() => handleMudarIdiomaAutomatico('es')}
            style={{
              padding: '14px',
              borderRadius: '12px',
              border: language === 'es' ? `2px solid ${accentColor}` : '1.5px solid var(--borda)',
              background: language === 'es' ? 'var(--fundo-cinza)' : 'var(--branco)',
              fontWeight: 800,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--texto-principal)'
            }}
          >
            <span>🇪🇸 Español</span>
            <span style={{ fontSize: '11px', background: 'rgba(180, 83, 9, 0.15)', color: '#b45309', padding: '2px 6px', borderRadius: '6px' }}>€ EUR</span>
          </button>
        </div>
      </div>

      {/* BOTÃO DE CONFIRMAÇÃO GLOBAL DE SALVAMENTO */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button
          type="button"
          onClick={handleSalvarPreferencias}
          style={{
            background: accentColor,
            color: 'white',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: `0 4px 16px ${accentColor}44`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          {salvoFeedback ? <i className="fas fa-check"></i> : <i className="fas fa-save"></i>}
          {salvoFeedback ? 'PREFERÊNCIAS SALVAS COM SUCESSO!' : 'SALVAR PREFERÊNCIAS DE APARÊNCIA'}
        </button>
      </div>

    </div>
  );
};

export default AbaAparencia;
