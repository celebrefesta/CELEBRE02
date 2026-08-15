import React, { useState } from 'react';

/**
 * 🚗 MODAL DE DESIGNAÇÃO DE MOTORISTA, VEÍCULO & EMBALAGENS RETORNÁVEIS (CLEAN & DIRECT)
 */
export const ModalDesignarMotorista = ({
  loc,
  isOpen,
  onClose,
  onSalvar,
  listaMotoristasExistentes = []
}) => {
  const [motoristaNome, setMotoristaNome] = useState(loc?.logistica?.motoristaNome || '');
  const [veiculo, setVeiculo] = useState(loc?.logistica?.veiculo || '');
  const [caixas, setCaixas] = useState(Number(loc?.embalagens?.caixas || loc?.embalagens?.caixasPlasticas || 0));
  const [sacolas, setSacolas] = useState(Number(loc?.embalagens?.sacolas || loc?.embalagens?.sacolasTecido || 0));
  const [capas, setCapas] = useState(Number(loc?.embalagens?.capas || loc?.embalagens?.capasPainel || 0));
  const [obsLogistica, setObsLogistica] = useState(loc?.logistica?.obsLogistica || '');
  const [salvando, setSalvando] = useState(false);

  if (!isOpen || !loc) return null;

  const totalEmbalagens = Number(caixas || 0) + Number(sacolas || 0) + Number(capas || 0);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(loc.id, {
        logistica: {
          ...(loc.logistica || {}),
          motoristaNome: motoristaNome.trim(),
          veiculo: veiculo.trim(),
          obsLogistica: obsLogistica.trim()
        },
        embalagens: {
          caixas: Number(caixas) || 0,
          sacolas: Number(sacolas) || 0,
          capas: Number(capas) || 0
        }
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar dados de transporte.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay-v3" onClick={onClose}>
      <div className="modal-content-v3 modal-designar-motorista animate-pop" onClick={e => e.stopPropagation()}>
        
        {/* CABEÇALHO */}
        <div className="modal-header-v3 header-transporte-luxury">
          <div>
            <span className="logistica-badge-head badge-transporte-glow">
              🚚 GESTÃO DE TRANSPORTE &amp; CARGA
            </span>
            <h3 className="transporte-modal-title">
              Motorista, Veículo &amp; Embalagens
            </h3>
            <span className="transporte-modal-sub">
              Pedido #{loc.numeroPedido || loc.id.substring(0,6).toUpperCase()} • {loc.clienteNome}
            </span>
          </div>
          <button type="button" onClick={onClose} className="k-btn-close-modal-clean">✕</button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="modal-assinatura-body transporte-modal-body">
          
          {/* SEÇÃO 1: MOTORISTA & VEÍCULO */}
          <div className="transporte-card-section">
            <div className="transporte-card-header">
              <span className="transporte-card-icon">🚗</span>
              <div>
                <h4 className="transporte-card-title">Equipe de Transporte &amp; Veículo</h4>
                <p className="transporte-card-desc">Defina quem vai levar e qual veículo será utilizado para a rota.</p>
              </div>
            </div>

            <div className="transporte-grid-inputs">
              {/* MOTORISTA */}
              <div className="form-group-transporte">
                <label>Motorista / Montador:</label>
                <input 
                  type="text" 
                  list="motoristas-sugestoes"
                  placeholder="Ex: Carlos ou Equipe A" 
                  value={motoristaNome}
                  onChange={e => setMotoristaNome(e.target.value)}
                  className="input-transporte-field"
                />
                <datalist id="motoristas-sugestoes">
                  {listaMotoristasExistentes.map((m, i) => (
                    <option key={i} value={m} />
                  ))}
                </datalist>
              </div>

              {/* VEÍCULO */}
              <div className="form-group-transporte">
                <label>Veículo Designado:</label>
                <input 
                  type="text" 
                  placeholder="Ex: Fiorino / Van 01" 
                  value={veiculo}
                  onChange={e => setVeiculo(e.target.value)}
                  className="input-transporte-field"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: EMBALAGENS RETORNÁVEIS DO GALPÃO */}
          <div className="transporte-card-section embalagens-section-gold">
            <div className="transporte-card-header">
              <span className="transporte-card-icon">📦</span>
              <div>
                <h4 className="transporte-card-title gold-txt">Controle de Embalagens Retornáveis (Galpão)</h4>
                <p className="transporte-card-desc gold-desc">
                  Anote as embalagens que saíram para exigir a devolução completa na coleta pós-festa.
                </p>
              </div>
            </div>

            <div className="embalagens-steppers-grid">
              {/* CAIXAS PLÁSTICAS */}
              <div className="embalagem-stepper-card">
                <span className="embalagem-card-lbl">📦 Caixas Plásticas</span>
                <div className="stepper-pack-controls">
                  <button type="button" className="btn-step-pack" onClick={() => setCaixas(prev => Math.max(0, prev - 1))}>-</button>
                  <input 
                    type="number" 
                    min="0"
                    value={caixas}
                    onChange={e => setCaixas(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-step-pack"
                  />
                  <button type="button" className="btn-step-pack" onClick={() => setCaixas(prev => prev + 1)}>+</button>
                </div>
              </div>

              {/* SACOLAS */}
              <div className="embalagem-stepper-card">
                <span className="embalagem-card-lbl">🛍️ Sacolas / Térmicas</span>
                <div className="stepper-pack-controls">
                  <button type="button" className="btn-step-pack" onClick={() => setSacolas(prev => Math.max(0, prev - 1))}>-</button>
                  <input 
                    type="number" 
                    min="0"
                    value={sacolas}
                    onChange={e => setSacolas(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-step-pack"
                  />
                  <button type="button" className="btn-step-pack" onClick={() => setSacolas(prev => prev + 1)}>+</button>
                </div>
              </div>

              {/* CAPAS DE PAINEL */}
              <div className="embalagem-stepper-card">
                <span className="embalagem-card-lbl">🎒 Capas de Painel</span>
                <div className="stepper-pack-controls">
                  <button type="button" className="btn-step-pack" onClick={() => setCapas(prev => Math.max(0, prev - 1))}>-</button>
                  <input 
                    type="number" 
                    min="0"
                    value={capas}
                    onChange={e => setCapas(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-step-pack"
                  />
                  <button type="button" className="btn-step-pack" onClick={() => setCapas(prev => prev + 1)}>+</button>
                </div>
              </div>
            </div>

            {/* RESUMO TOTAL DE EMBALAGENS */}
            <div className="total-embalagens-footer-badge">
              <span>🏷️ Total de Embalagens Vinculadas:</span>
              <strong>{totalEmbalagens} itens de galpão</strong>
            </div>
          </div>

          {/* SEÇÃO 3: OBSERVAÇÕES DE TRANSPORTE */}
          <div className="transporte-card-section">
            <div className="transporte-card-header">
              <span className="transporte-card-icon">📝</span>
              <div>
                <h4 className="transporte-card-title">Instruções de Rota / Dica de Campo</h4>
                <p className="transporte-card-desc">Observação que sai impressa no Romaneio de Entrega do motorista.</p>
              </div>
            </div>

            <textarea 
              rows="2"
              placeholder="Ex: Entregar pelos fundos do buffet / ligar 15 minutos antes de chegar..." 
              value={obsLogistica}
              onChange={e => setObsLogistica(e.target.value)}
              className="textarea-transporte-field"
            />
          </div>

        </div>

        {/* RODAPÉ */}
        <div className="modal-footer-v3 footer-transporte-actions">
          <button type="button" onClick={onClose} className="btn-cancelar-modal" disabled={salvando}>
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSalvar} 
            disabled={salvando}
            className="btn-salvar-transporte-luxury"
          >
            {salvando ? '💾 Salvando Transporte...' : '💾 Salvar Alterações'}
          </button>
        </div>

      </div>
    </div>
  );
};
