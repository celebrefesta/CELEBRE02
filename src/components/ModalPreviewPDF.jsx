import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import './ModalPreviewPDF.css';

/**
 * 💎 MODAL UNIVERSAL DE PRÉ-VISUALIZAÇÃO DE DOCUMENTOS EM PDF (LUXURY)
 * Permite visualizar qualquer documento gerado em alta resolução antes de baixar ou imprimir.
 */
export const ModalPreviewPDF = ({
  isOpen,
  onClose,
  pdfUrl,
  pdfBlob,
  doc,
  titulo = 'Visualização de Documento',
  nomeArquivo = 'Documento_Celebre.pdf'
}) => {
  const iframeRef = useRef(null);

  if (!isOpen || !pdfUrl) return null;

  // 📥 Ação de Baixar o PDF
  const handleBaixar = () => {
    if (doc && typeof doc.save === 'function') {
      doc.save(nomeArquivo);
      return;
    }

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🖨️ Ação de Imprimir
  const handleImprimir = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      }
    } catch (e) {
      console.warn("Impressão direta do iframe bloqueada por CORS/Navegador. Abrindo aba para impressão:", e);
    }
    const win = window.open(pdfUrl, '_blank');
    if (win) {
      win.focus();
      win.print();
    }
  };

  // 🔗 Ação de Abrir em Nova Aba
  const handleAbrirNovaGuia = () => {
    window.open(pdfUrl, '_blank');
  };

  const modalContent = (
    <div className="modal-preview-pdf-overlay" onClick={onClose}>
      <div className="modal-preview-pdf-container" onClick={(e) => e.stopPropagation()}>
        
        {/* ═══ CABEÇALHO DO VISUALIZADOR LUXURY ═══ */}
        <div className="modal-preview-pdf-header">
          <div className="modal-preview-pdf-info">
            <div className="modal-preview-pdf-badge">📄 VISUALIZAÇÃO PRÉVIA</div>
            <h3 className="modal-preview-pdf-title" title={titulo}>{titulo}</h3>
            <span className="modal-preview-pdf-filename">{nomeArquivo}</span>
          </div>

          <div className="modal-preview-pdf-actions">
            <button 
              type="button" 
              className="btn-preview-action btn-preview-tab" 
              onClick={handleAbrirNovaGuia}
              title="Abrir este documento em uma nova aba do navegador"
            >
              🔗 Nova Guia
            </button>

            <button 
              type="button" 
              className="btn-preview-action btn-preview-print" 
              onClick={handleImprimir}
              title="Imprimir documento agora"
            >
              🖨️ Imprimir
            </button>

            <button 
              type="button" 
              className="btn-preview-action btn-preview-download" 
              onClick={handleBaixar}
              title="Salvar arquivo PDF no computador / celular"
            >
              📥 Baixar PDF
            </button>

            <button 
              type="button" 
              className="btn-preview-close" 
              onClick={onClose}
              title="Fechar visualizador"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ═══ CORPO DO DOCUMENTO (IFRAME DE ALTA DEFINIÇÃO) ═══ */}
        <div className="modal-preview-pdf-body">
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="modal-preview-pdf-iframe"
            title={titulo}
          />
        </div>

        {/* ═══ RODAPÉ MOBILE COM AÇÕES RÁPIDAS ═══ */}
        <div className="modal-preview-pdf-footer-mobile">
          <button type="button" className="btn-mobile-act" onClick={handleAbrirNovaGuia}>
            🔗 Abrir
          </button>
          <button type="button" className="btn-mobile-act" onClick={handleImprimir}>
            🖨️ Imprimir
          </button>
          <button type="button" className="btn-mobile-act btn-mobile-download" onClick={handleBaixar}>
            📥 Baixar PDF
          </button>
        </div>

      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ModalPreviewPDF;
