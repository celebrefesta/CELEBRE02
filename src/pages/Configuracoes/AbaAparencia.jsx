import React, { useState, useEffect } from 'react';

const AbaAparencia = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'padrao');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'pt');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    document.documentElement.setAttribute('data-lang', language); 
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', fontSize);
  }, [theme, fontSize, language]);

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

  return (
    <div className="config-empresa-grid">
      <div className="config-card large-padding">
        <div className="card-top-bar blue-bar"></div>
        <h3>🎨 Modo de Cor</h3>
        <p className="subtext">Escolha o tema do sistema.</p>
        <div className="btn-group-toggle">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>☀️ Claro</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>🌙 Escuro</button>
        </div>
      </div>

      <div className="config-card large-padding">
        <div className="card-top-bar blue-bar"></div>
        <h3>👓 Tamanho da Fonte</h3>
        <p className="subtext">Ajuste o zoom da interface.</p>
        <div className="btn-group-toggle">
          <button className={fontSize === 'padrao' ? 'active' : ''} onClick={() => setFontSize('padrao')}>Normal</button>
          <button className={fontSize === 'ampliado' ? 'active' : ''} onClick={() => setFontSize('ampliado')}>Ampliado</button>
        </div>
      </div>

      <div className="config-card large-padding span-2-col-full">
        <div className="card-top-bar gold-bar"></div>
        <h3>🌐 Idioma do Sistema</h3>
        <p className="subtext">Selecione a linguagem principal da interface do painel.</p>
        <div className="lang-grid">
          <button className={`btn-lang ${language === 'pt' ? 'active' : ''}`} onClick={() => handleMudarIdiomaAutomatico('pt')}>🇧🇷 Português</button>
          <button className={`btn-lang ${language === 'en' ? 'active' : ''}`} onClick={() => handleMudarIdiomaAutomatico('en')}>🇺🇸 English</button>
          <button className={`btn-lang ${language === 'es' ? 'active' : ''}`} onClick={() => handleMudarIdiomaAutomatico('es')}>🇪🇸 Español</button>
        </div>
      </div>
    </div>
  );
};

export default AbaAparencia;
