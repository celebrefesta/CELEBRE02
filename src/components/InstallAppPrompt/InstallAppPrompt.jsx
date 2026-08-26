import React, { useState, useEffect } from 'react';
import './InstallAppPrompt.css';

const InstallAppPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('celebre_pwa_dismissed') === 'true';
  });

  useEffect(() => {
    // Detecta se já está rodando como PWA/App Instalado (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      return; // Já está no App!
    }

    // Detecta iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    
    if (isIosDevice && isSafari) {
      setIsIOS(true);
      setIsInstallable(true);
    }

    // Captura o evento nativo de instalação do Chrome / Edge / Android
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('celebre_pwa_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSTip(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (!isInstallable || isDismissed) {
    return null;
  }

  return (
    <>
      <div className="celebre-pwa-install-banner">
        <div className="pwa-banner-content">
          <div className="pwa-app-badge">
            <span className="pwa-icon">📱</span>
          </div>
          <div className="pwa-banner-texts">
            <strong>Instale o App Celebre</strong>
            <small>Acesso rápido, modo offline e tela cheia no seu celular ou PC</small>
          </div>
        </div>

        <div className="pwa-banner-actions">
          <button 
            type="button" 
            className="btn-pwa-install"
            onClick={handleInstallClick}
          >
            📲 Instalar App
          </button>
          <button 
            type="button" 
            className="btn-pwa-dismiss"
            onClick={handleDismiss}
            title="Fechar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Dica para Usuários de iPhone (iOS) */}
      {showIOSTip && (
        <div className="pwa-ios-modal-backdrop" onClick={() => setShowIOSTip(false)}>
          <div className="pwa-ios-modal-card" onClick={e => e.stopPropagation()}>
            <div className="pwa-ios-header">
              <span className="pwa-ios-icon">🍎</span>
              <h3>Como instalar no iPhone / iPad</h3>
              <button className="btn-close-ios-tip" onClick={() => setShowIOSTip(false)}>✕</button>
            </div>
            <ol className="pwa-ios-steps">
              <li>No Safari, toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima ⎋ na barra inferior).</li>
              <li>Role a lista para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> (ícone de ➕).</li>
              <li>Toque em <strong>"Adicionar"</strong> no canto superior direito.</li>
            </ol>
            <p className="pwa-ios-sub">Pronto! O ícone do Celebre aparecerá junto aos seus outros aplicativos! ✨</p>
            <button className="btn-pwa-ios-ok" onClick={() => setShowIOSTip(false)}>Entendi!</button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppPrompt;
