import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './ModalLightboxFotos.css';

/**
 * 📸 MODAL LIGHTBOX DE FOTOS DE VISTORIA (FULLSCREEN TOUCH & DESKTOP)
 * Permite visualizar fotos de vistoria em alta resolução com navegação e zoom.
 */
export const ModalLightboxFotos = ({
  isOpen,
  onClose,
  fotos = [],
  titulo = 'Fotos da Vistoria',
  initialIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleProxima();
      if (e.key === 'ArrowLeft') handleAnterior();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, fotos.length]);

  if (!isOpen || !fotos || fotos.length === 0) return null;

  const handleProxima = () => {
    setCurrentIndex((prev) => (prev + 1) % fotos.length);
  };

  const handleAnterior = () => {
    setCurrentIndex((prev) => (prev - 1 + fotos.length) % fotos.length);
  };

  const fotoAtual = fotos[currentIndex];
  const urlFoto = typeof fotoAtual === 'string' ? fotoAtual : fotoAtual?.url || fotoAtual?.dataUrl;
  const legendaFoto = fotoAtual?.legenda || fotoAtual?.tipo || `Foto ${currentIndex + 1} de ${fotos.length}`;

  const lightboxContent = (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Cabeçalho */}
        <div className="lightbox-header">
          <div className="lightbox-info">
            <span className="lightbox-title">{titulo}</span>
            <span className="lightbox-counter">{currentIndex + 1} / {fotos.length}</span>
          </div>

          <button type="button" className="lightbox-btn-close" onClick={onClose} title="Fechar (Esc)">
            ✕
          </button>
        </div>

        {/* Área Central da Imagem */}
        <div className="lightbox-body">
          {fotos.length > 1 && (
            <button type="button" className="lightbox-nav-btn btn-prev" onClick={handleAnterior} title="Foto Anterior (←)">
              ‹
            </button>
          )}

          <div className="lightbox-image-wrapper">
            <img src={urlFoto} alt={legendaFoto} className="lightbox-image" />
            <div className="lightbox-caption">{legendaFoto}</div>
          </div>

          {fotos.length > 1 && (
            <button type="button" className="lightbox-nav-btn btn-next" onClick={handleProxima} title="Próxima Foto (→)">
              ›
            </button>
          )}
        </div>

        {/* Faixa de Miniaturas */}
        {fotos.length > 1 && (
          <div className="lightbox-thumbnails">
            {fotos.map((f, idx) => {
              const u = typeof f === 'string' ? f : f?.url || f?.dataUrl;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`lightbox-thumb-btn ${idx === currentIndex ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  <img src={u} alt="" className="lightbox-thumb-img" />
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );

  return ReactDOM.createPortal(lightboxContent, document.body);
};

export default ModalLightboxFotos;
