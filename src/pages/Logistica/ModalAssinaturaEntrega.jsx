import React, { useRef, useState, useEffect } from 'react';

/**
 * ✍️ MODAL DE ASSINATURA DIGITAL DE ENTREGA (TOUCH / MOUSE)
 * Permite ao cliente assinar no celular do motorista confirmando o recebimento das peças.
 */
export const ModalAssinaturaEntrega = ({ 
  loc, 
  isOpen, 
  onClose, 
  onSalvarAssinatura 
}) => {
  const canvasRef = useRef(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);
  const [recebidoPor, setRecebidoPor] = useState(loc?.clienteNome || '');
  const [documento, setDocumento] = useState('');
  const [obsEntrega, setObsEntrega] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      limparCanvas();
    }
  }, [isOpen]);

  if (!isOpen || !loc) return null;

  const obterCoordenadas = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const iniciarDesenho = (e) => {
    e.preventDefault();
    const { x, y } = obterCoordenadas(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDesenhando(true);
  };

  const desenhar = (e) => {
    if (!desenhando) return;
    e.preventDefault();
    const { x, y } = obterCoordenadas(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setTemAssinatura(true);
  };

  const finalizarDesenho = (e) => {
    if (!desenhando) return;
    e.preventDefault();
    setDesenhando(false);
  };

  const limparCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemAssinatura(false);
  };

  const handleSalvar = async () => {
    if (!recebidoPor.trim()) {
      alert("⚠️ Por favor, digite o nome de quem está recebendo o material.");
      return;
    }
    if (!temAssinatura && !loc.logistica?.assinaturaEntrega) {
      alert("⚠️ Por favor, solicite a assinatura na tela antes de confirmar.");
      return;
    }

    setSalvando(true);
    try {
      const canvas = canvasRef.current;
      const assinaturaBase64 = temAssinatura ? canvas.toDataURL('image/png') : (loc.logistica?.assinaturaEntrega || null);
      const agoraStr = new Date().toLocaleString('pt-BR');

      await onSalvarAssinatura(loc.id, {
        assinaturaEntrega: assinaturaBase64,
        recebidoPor: recebidoPor.trim(),
        documentoRecebedor: documento.trim(),
        obsEntrega: obsEntrega.trim(),
        dataHoraAssinatura: agoraStr
      });

      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar assinatura.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay-v3" onClick={onClose}>
      <div className="modal-content-v3 modal-assinatura-entrega" onClick={e => e.stopPropagation()}>
        
        {/* CABEÇALHO */}
        <div className="modal-header-v3">
          <div>
            <span className="logistica-badge-head" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
              ✍️ COMPROVANTE DIGITAL
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: '850' }}>
              Assinatura de Recebimento
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Pedido #{loc.numeroPedido || loc.id.substring(0,6).toUpperCase()} • {loc.clienteNome}
            </span>
          </div>
          <button type="button" onClick={onClose} className="k-btn-close-modal">✕</button>
        </div>

        {/* CORPO */}
        <div className="modal-assinatura-body">
          
          {/* DADOS DE QUEM RECEBE */}
          <div className="form-group-assinatura">
            <label>Nome do Responsável pelo Recebimento: *</label>
            <input 
              type="text" 
              placeholder="Ex: Maria da Silva (Cliente ou Cerimonial)" 
              value={recebidoPor}
              onChange={e => setRecebidoPor(e.target.value)}
              className="input-assinatura"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group-assinatura">
              <label>Documento (RG / CPF - opcional):</label>
              <input 
                type="text" 
                placeholder="Ex: 12.345.678-9" 
                value={documento}
                onChange={e => setDocumento(e.target.value)}
                className="input-assinatura"
              />
            </div>

            <div className="form-group-assinatura">
              <label>Observação de Entrega:</label>
              <input 
                type="text" 
                placeholder="Ex: Deixado no quiosque da piscina" 
                value={obsEntrega}
                onChange={e => setObsEntrega(e.target.value)}
                className="input-assinatura"
              />
            </div>
          </div>

          {/* ÁREA DE ASSINATURA TOUCH CANVAS */}
          <div className="canvas-container-assinatura">
            <div className="canvas-header-info">
              <span>✍️ Desenhe a assinatura com o dedo ou caneta abaixo:</span>
              <button type="button" onClick={limparCanvas} className="btn-limpar-canvas">
                🗑️ Limpar
              </button>
            </div>

            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                width={480}
                height={160}
                className="canvas-touch-box"
                onMouseDown={iniciarDesenho}
                onMouseMove={desenhar}
                onMouseUp={finalizarDesenho}
                onMouseLeave={finalizarDesenho}
                onTouchStart={iniciarDesenho}
                onTouchMove={desenhar}
                onTouchEnd={finalizarDesenho}
              />
              <div className="linha-assinatura-guia">
                <span>✕ Assinatura do Cliente / Responsável</span>
              </div>
            </div>

            {loc.logistica?.assinaturaEntrega && !temAssinatura && (
              <div className="aviso-assinatura-anterior">
                <span>✅ Já existe uma assinatura salva em {loc.logistica.dataHoraAssinatura}. Desenhe acima para substituir.</span>
              </div>
            )}
          </div>

          {/* TERMO DE DECLARAÇÃO */}
          <p className="termo-recebimento-txt">
            Declaro ter conferido e recebido todos os itens alugados constantes neste contrato em perfeito estado de conservação e funcionamento.
          </p>

        </div>

        {/* RODAPÉ COM BOTÕES DE AÇÃO */}
        <div className="modal-footer-v3">
          <button type="button" onClick={onClose} className="btn-cancelar-modal">
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSalvar} 
            disabled={salvando}
            className="btn-salvar-assinatura"
          >
            {salvando ? 'Gravando...' : '✅ Salvar Comprovante de Entrega'}
          </button>
        </div>

      </div>
    </div>
  );
};
