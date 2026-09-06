import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import './ModalBipagemGalpao.css';

/**
 * ⚡ MODAL DE BIPAGEM CONTÍNUA DE GALPÃO / PEDIDO (SCANNER TOUCH & LEITOR USB)
 * Permite bipar peças de cada locação com a câmera do celular ou leitor de código de barras.
 * Inclui: Lanterna (Torch), Feedback Háptico (Vibração), Controle de Som,
 * Debounce anti-leitura dupla, suporte a quantidades fracionadas e avanço de etapa.
 */
export const ModalBipagemGalpao = ({
  isOpen,
  onClose,
  locacoes = [],
  locacaoSelecionada = null,
  onAtualizarLocacoes,
  tenantId
}) => {
  const [pedidoAtual, setPedidoAtual] = useState(locacaoSelecionada);
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState(locacaoSelecionada?.id || 'todos');
  const [codigoInput, setCodigoInput] = useState('');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [torchAtiva, setTorchAtiva] = useState(false);
  const [torchDisponivel, setTorchDisponivel] = useState(false);
  const [somAtivo, setSomAtivo] = useState(() => {
    try {
      return localStorage.getItem('celebre_som_bipagem') !== 'false';
    } catch (e) {
      return true;
    }
  });
  const [ultimoItemBipado, setUltimoItemBipado] = useState(null);
  const [historicoBipagens, setHistoricoBipagens] = useState([]);
  const [mensagemStatus, setMensagemStatus] = useState({ tipo: '', texto: '' });
  const [avancandoEtapa, setAvancandoEtapa] = useState(false);

  const html5QrCodeRef = useRef(null);
  const inputRef = useRef(null);
  const ultimoScanRef = useRef({ codigo: '', timestamp: 0 });

  // Sincroniza com a locação selecionada quando aberta
  useEffect(() => {
    if (locacaoSelecionada) {
      setPedidoAtual(locacaoSelecionada);
      setPedidoSelecionadoId(locacaoSelecionada.id);
    }
  }, [locacaoSelecionada]);

  // 📳 FEEDBACK HÁPTICO (VIBRAÇÃO EM SMARTPHONES)
  const vibrar = (tipo = 'sucesso') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (tipo === 'sucesso') {
          navigator.vibrate(80);
        } else if (tipo === 'completo') {
          navigator.vibrate([100, 50, 100, 50, 150]);
        } else if (tipo === 'alerta') {
          navigator.vibrate([100, 60, 100]);
        }
      }
    } catch (e) {}
  };

  // 🔊 SINTETIZADOR DE ÁUDIO WEB API (BIPES SEM ARQUIVOS EXTERNOS)
  const tocarBip = (tipo = 'sucesso') => {
    if (!somAtivo) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (tipo === 'sucesso') {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // Tom A5 (agudo limpo)
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (tipo === 'completo') {
        // Tom duplo festivo
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      } else if (tipo === 'alerta') {
        osc.frequency.setValueAtTime(300, ctx.currentTime); // Tom grave
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {}
  };

  const toggleSom = () => {
    setSomAtivo(prev => {
      const next = !prev;
      try { localStorage.setItem('celebre_som_bipagem', String(next)); } catch (e) {}
      return next;
    });
  };

  // 🔦 CONTROLE DE LANTERNA (TORCH / FLASH DA CÂMERA)
  const toggleTorch = async () => {
    try {
      const videoElem = document.querySelector("#leitor-camera-galpao video");
      if (videoElem && videoElem.srcObject) {
        const track = videoElem.srcObject.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities ? track.getCapabilities() : {};
          if (capabilities.torch) {
            const novoEstado = !torchAtiva;
            await track.applyConstraints({ advanced: [{ torch: novoEstado }] });
            setTorchAtiva(novoEstado);
            return;
          }
        }
      }
      setMensagemStatus({
        tipo: 'alerta',
        texto: '🔦 Lanterna não disponível nesta câmera ou navegador.'
      });
    } catch (err) {
      console.warn("Erro ao alternar lanterna:", err);
    }
  };

  // 🔍 PROCESSAMENTO DO CÓDIGO BIPADO (SKU, BARCODE, NOME OU PEDIDO)
  const processarCodigo = async (codigoRaw, isCamera = false) => {
    if (!codigoRaw) return;
    const codigoLimpo = String(codigoRaw).trim().toLowerCase();
    const codigoSemHifen = codigoLimpo.replace(/[-_]/g, '');

    // 🛡️ DEBOUNCE ANTI-DUPLO BIP PARA CÂMERA (1.3s de cooldown para a mesma etiqueta)
    const agora = Date.now();
    if (isCamera && codigoLimpo === ultimoScanRef.current.codigo && (agora - ultimoScanRef.current.timestamp) < 1300) {
      return;
    }
    ultimoScanRef.current = { codigo: codigoLimpo, timestamp: agora };

    // Determina a lista de pedidos alvo
    const pedidosAlvo = pedidoAtual
      ? [pedidoAtual]
      : (pedidoSelecionadoId === 'todos'
          ? locacoes.filter(l => l.status === 'confirmado' || l.status === 'preparacao')
          : locacoes.filter(l => l.id === pedidoSelecionadoId));

    let itemEncontrado = null;
    let pedidoEncontrado = null;
    let itemIndex = -1;

    for (const ped of pedidosAlvo) {
      const itens = ped.itens || ped.carrinho || [];
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        const itCod = String(it.codigo || it.sku || '').toLowerCase();
        const itBarcode = String(it.barcode || it.codigoBarra || it.qrCode || '').toLowerCase();
        const itNome = String(it.nome || it.descricao || '').toLowerCase();

        if (
          itCod === codigoLimpo ||
          itCod.replace(/[-_]/g, '') === codigoSemHifen ||
          itBarcode === codigoLimpo ||
          (itBarcode && itBarcode.includes(codigoLimpo)) ||
          itNome === codigoLimpo
        ) {
          itemEncontrado = it;
          pedidoEncontrado = ped;
          itemIndex = i;
          break;
        }
      }
      if (itemEncontrado) break;
    }

    if (itemEncontrado && pedidoEncontrado) {
      const numPed = pedidoEncontrado.numeroPedido ? `#${pedidoEncontrado.numeroPedido}` : `#${pedidoEncontrado.id.substring(0, 5)}`;
      const totalQtd = Number(itemEncontrado.quantidade || itemEncontrado.qtd || 1);
      const confAtual = Number(itemEncontrado.qtdConferida !== undefined ? itemEncontrado.qtdConferida : (itemEncontrado.checkedSeparacao ? totalQtd : 0));

      if (confAtual >= totalQtd) {
        // Item já 100% conferido
        tocarBip('alerta');
        vibrar('alerta');
        setMensagemStatus({
          tipo: 'alerta',
          texto: `⚠️ Todas as ${totalQtd}x peças de "${itemEncontrado.nome || itemEncontrado.descricao}" já foram conferidas!`
        });
        setCodigoInput('');
        if (inputRef.current) inputRef.current.focus();
        return;
      }

      // Incrementa a quantidade conferida
      const novaQtd = confAtual + 1;
      const novoChecked = novaQtd >= totalQtd;

      tocarBip(novoChecked ? 'sucesso' : 'sucesso');
      vibrar('sucesso');

      // Atualiza os itens
      const itensOrig = pedidoEncontrado.itens || pedidoEncontrado.carrinho || [];
      const novosItens = [...itensOrig];
      novosItens[itemIndex] = {
        ...itemEncontrado,
        qtdConferida: novaQtd,
        checkedSeparacao: novoChecked,
        dataBipagem: new Date().toISOString()
      };

      const pedidoAtualizado = { ...pedidoEncontrado, itens: novosItens };
      if (pedidoAtual && pedidoAtual.id === pedidoEncontrado.id) {
        setPedidoAtual(pedidoAtualizado);
      }

      const nomeExib = itemEncontrado.nome || itemEncontrado.descricao;
      setUltimoItemBipado({
        nome: `${novaQtd}/${totalQtd}x — ${nomeExib}`,
        codigo: itemEncontrado.codigo || itemEncontrado.sku || '-',
        pedido: `${numPed} - ${pedidoEncontrado.clienteNome || 'Cliente'}`,
        horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      setHistoricoBipagens(prev => [
        {
          id: Date.now(),
          nome: `${novaQtd}/${totalQtd}x ${nomeExib}`,
          codigo: itemEncontrado.codigo || itemEncontrado.sku || '-',
          pedido: numPed,
          cliente: pedidoEncontrado.clienteNome,
          horario: new Date().toLocaleTimeString('pt-BR')
        },
        ...prev.slice(0, 19)
      ]);

      setMensagemStatus({
        tipo: 'sucesso',
        texto: novoChecked 
          ? `✓ Concluído: ${nomeExib} (${novaQtd}/${totalQtd})`
          : `+1 Bipado: ${nomeExib} (${novaQtd}/${totalQtd})`
      });

      // Salva no Firestore
      try {
        const pedRef = doc(db, 'locacoes', pedidoEncontrado.id);
        await updateDoc(pedRef, { itens: novosItens });
        if (onAtualizarLocacoes) onAtualizarLocacoes();
      } catch (err) {
        console.error("Erro ao salvar bipagem:", err);
      }
    } else {
      tocarBip('alerta');
      vibrar('alerta');
      setMensagemStatus({
        tipo: 'alerta',
        texto: `⚠️ Peça não encontrada neste pedido: "${codigoRaw}"`
      });
    }

    setCodigoInput('');
    if (inputRef.current) inputRef.current.focus();
  };

  // Alterna manualmente o status de conferência de um item (toggle completo)
  const alternarItemManual = async (it, itIdx) => {
    const alvo = pedidoAtual || (pedidoSelecionadoId !== 'todos' ? locacoes.find(l => l.id === pedidoSelecionadoId) : null);
    if (!alvo) return;

    const itensOrig = alvo.itens || alvo.carrinho || [];
    const novosItens = [...itensOrig];
    const totalQtd = Number(it.quantidade || it.qtd || 1);
    const confAtual = Number(it.qtdConferida !== undefined ? it.qtdConferida : (it.checkedSeparacao ? totalQtd : 0));
    
    // Se já estava completo, zera. Se estava incompleto ou zerado, completa 100%.
    const novoStatus = confAtual < totalQtd;
    const novaQtd = novoStatus ? totalQtd : 0;

    novosItens[itIdx] = {
      ...novosItens[itIdx],
      qtdConferida: novaQtd,
      checkedSeparacao: novoStatus,
      dataBipagem: novoStatus ? new Date().toISOString() : null
    };

    const atualizado = { ...alvo, itens: novosItens };
    setPedidoAtual(atualizado);

    if (novoStatus) {
      tocarBip('sucesso');
      vibrar('sucesso');
      setMensagemStatus({
        tipo: 'sucesso',
        texto: `✓ Conferido: ${it.nome || it.descricao} (${novaQtd}/${totalQtd})`
      });
    }

    try {
      const pedRef = doc(db, 'locacoes', alvo.id);
      await updateDoc(pedRef, { itens: novosItens });
      if (onAtualizarLocacoes) onAtualizarLocacoes();
    } catch (err) {
      console.error("Erro ao salvar item:", err);
    }
  };

  // Incremento pontual +1 manual
  const incrementarItemManual = async (e, it, itIdx) => {
    e.stopPropagation();
    const alvo = pedidoAtual || (pedidoSelecionadoId !== 'todos' ? locacoes.find(l => l.id === pedidoSelecionadoId) : null);
    if (!alvo) return;

    const itensOrig = alvo.itens || alvo.carrinho || [];
    const novosItens = [...itensOrig];
    const totalQtd = Number(it.quantidade || it.qtd || 1);
    const confAtual = Number(it.qtdConferida !== undefined ? it.qtdConferida : (it.checkedSeparacao ? totalQtd : 0));

    if (confAtual >= totalQtd) return;

    const novaQtd = confAtual + 1;
    const novoChecked = novaQtd >= totalQtd;

    novosItens[itIdx] = {
      ...novosItens[itIdx],
      qtdConferida: novaQtd,
      checkedSeparacao: novoChecked,
      dataBipagem: new Date().toISOString()
    };

    const atualizado = { ...alvo, itens: novosItens };
    setPedidoAtual(atualizado);

    tocarBip('sucesso');
    vibrar('sucesso');
    setMensagemStatus({
      tipo: 'sucesso',
      texto: `+1 Marcado: ${it.nome || it.descricao} (${novaQtd}/${totalQtd})`
    });

    try {
      const pedRef = doc(db, 'locacoes', alvo.id);
      await updateDoc(pedRef, { itens: novosItens });
      if (onAtualizarLocacoes) onAtualizarLocacoes();
    } catch (err) {
      console.error("Erro ao salvar item:", err);
    }
  };

  // 🚚 AVANÇO RÁPIDO DE ETAPA DO PEDIDO APÓS 100%
  const avancarEtapaPedido = async () => {
    if (!pedidoAtual) return;
    setAvancandoEtapa(true);
    try {
      const pedRef = doc(db, 'locacoes', pedidoAtual.id);
      const novoStatus = 'entregue'; // na rua / pronto na esteira de galpão
      await updateDoc(pedRef, {
        status: novoStatus,
        etapaLogistica: 'entregue',
        dataSeparacaoConcluida: new Date().toISOString()
      });

      tocarBip('completo');
      vibrar('completo');

      setMensagemStatus({
        tipo: 'sucesso',
        texto: `🚀 Pedido #${pedidoAtual.numeroPedido || pedidoAtual.id.substring(0, 5)} avançado para "Na Rua / Pronto"!`
      });

      setPedidoAtual(prev => ({ ...prev, status: novoStatus, etapaLogistica: 'entregue' }));
      if (onAtualizarLocacoes) onAtualizarLocacoes();
    } catch (err) {
      console.error("Erro ao avançar etapa do pedido:", err);
      setMensagemStatus({
        tipo: 'alerta',
        texto: '⚠️ Erro ao atualizar status do pedido no banco de dados.'
      });
    } finally {
      setAvancandoEtapa(false);
    }
  };

  // 🛡️ PARAR SCANNER COM TOTAL SEGURANÇA CONTRA ERROS
  const pararScannerSeguro = async () => {
    setTorchAtiva(false);
    setTorchDisponivel(false);
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.warn("Aviso ao parar scanner:", err);
      }
      try {
        await html5QrCodeRef.current.clear();
      } catch (clearErr) {}
      html5QrCodeRef.current = null;
    }
  };

  // 📷 INICIAR / PARAR CÂMERA SCANNER
  useEffect(() => {
    if (!isOpen) {
      pararScannerSeguro();
      setCameraAtiva(false);
      return;
    }

    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }

    return () => {
      pararScannerSeguro();
    };
  }, [isOpen]);

  const toggleCamera = async () => {
    if (cameraAtiva) {
      await pararScannerSeguro();
      setCameraAtiva(false);
    } else {
      setCameraAtiva(true);
      setTimeout(async () => {
        try {
          const qrCode = new Html5Qrcode("leitor-camera-galpao");
          html5QrCodeRef.current = qrCode;
          await qrCode.start(
            { facingMode: "environment" },
            { fps: 12, qrbox: { width: 260, height: 260 } },
            (decodedText) => {
              processarCodigo(decodedText, true);
            },
            () => {}
          );

          // Checa suporte à lanterna após inicializar
          setTimeout(() => {
            try {
              const videoElem = document.querySelector("#leitor-camera-galpao video");
              if (videoElem && videoElem.srcObject) {
                const track = videoElem.srcObject.getVideoTracks()[0];
                if (track && track.getCapabilities && track.getCapabilities().torch) {
                  setTorchDisponivel(true);
                }
              }
            } catch (e) {}
          }, 600);

        } catch (e) {
          console.warn("Erro ao abrir câmera:", e);
          setMensagemStatus({
            tipo: 'alerta',
            texto: '⚠️ Permissão de câmera negada ou indisponível. Você pode digitar ou usar o leitor USB normalmente.'
          });
          await pararScannerSeguro();
          setCameraAtiva(false);
        }
      }, 200);
    }
  };

  if (!isOpen) return null;

  // Itens do pedido ativo
  const itensAtivos = pedidoAtual?.itens || pedidoAtual?.carrinho || [];
  let totalPecas = 0;
  let totalBipadas = 0;

  if (pedidoAtual) {
    itensAtivos.forEach(it => {
      const q = Number(it.quantidade || it.qtd || 1);
      const conf = Number(it.qtdConferida !== undefined ? it.qtdConferida : (it.checkedSeparacao ? q : 0));
      totalPecas += q;
      totalBipadas += Math.min(conf, q);
    });
  } else {
    const pedidosFiltrados = pedidoSelecionadoId === 'todos'
      ? locacoes.filter(l => l.status === 'confirmado' || l.status === 'preparacao')
      : locacoes.filter(l => l.id === pedidoSelecionadoId);

    pedidosFiltrados.forEach(p => {
      (p.itens || p.carrinho || []).forEach(it => {
        const q = Number(it.quantidade || it.qtd || 1);
        const conf = Number(it.qtdConferida !== undefined ? it.qtdConferida : (it.checkedSeparacao ? q : 0));
        totalPecas += q;
        totalBipadas += Math.min(conf, q);
      });
    });
  }

  const pct = totalPecas > 0 ? Math.round((totalBipadas / totalPecas) * 100) : 0;
  const numPedidoFormatado = pedidoAtual?.numeroPedido ? `#${pedidoAtual.numeroPedido}` : (pedidoAtual?.id ? `#${pedidoAtual.id.substring(0,6)}` : '');
  const dataEventoBr = pedidoAtual?.dataRetirada ? pedidoAtual.dataRetirada.split('-').reverse().join('/') : '';
  const pedidoJaPronto = pedidoAtual?.status === 'entregue' || pedidoAtual?.status === 'finalizado';

  const modalContent = (
    <div className="bipagem-overlay" onClick={onClose}>
      <div className="bipagem-container" onClick={(e) => e.stopPropagation()}>
        
        {/* CABEÇALHO */}
        <div className="bipagem-header">
          <div className="bipagem-header-left">
            <span className="bipagem-badge">
              {pedidoAtual ? `⚡ BIPAR PEDIDO ${numPedidoFormatado}` : '⚡ SCANNER DE SEPARAÇÃO'}
            </span>
            <h2>{pedidoAtual ? `Conferência — ${pedidoAtual.clienteNome || 'Cliente'}` : 'Scanner de Separação de Peças'}</h2>
          </div>

          <div className="bipagem-header-actions">
            {/* TOGGLE ÁUDIO MUDO / LIGADO */}
            <button
              type="button"
              className={`btn-header-util ${somAtivo ? 'som-ativo' : 'som-mudo'}`}
              onClick={toggleSom}
              title={somAtivo ? 'Desativar som de bip' : 'Ativar som de bip'}
            >
              {somAtivo ? '🔊' : '🔇'}
            </button>

            {/* BOTÃO FECHAR */}
            <button type="button" className="bipagem-close-btn" onClick={onClose} title="Fechar Scanner">✕</button>
          </div>
        </div>

        {/* CONTROLES DO TOPO */}
        <div className="bipagem-top-controls">
          {pedidoAtual ? (
            <div className="bipagem-pedido-info-chip">
              <span className="chip-cliente">👤 {pedidoAtual.clienteNome}</span>
              {dataEventoBr && <span className="chip-data">📅 Retirada: {dataEventoBr}</span>}
              {pedidoAtual.tema && <span className="chip-tema">✨ {pedidoAtual.tema}</span>}
            </div>
          ) : (
            <div className="bipagem-select-box">
              <label>Filtrar Pedido:</label>
              <select
                value={pedidoSelecionadoId}
                onChange={(e) => setPedidoSelecionadoId(e.target.value)}
                className="bipagem-select"
              >
                <option value="todos">📦 Todos os Pedidos a Separar ({locacoes.length})</option>
                {locacoes
                  .filter(l => l.status === 'confirmado' || l.status === 'preparacao')
                  .map(l => (
                    <option key={l.id} value={l.id}>
                      #{l.numeroPedido || l.id.substring(0, 5)} - {l.clienteNome} ({l.itens?.length || 0} itens)
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="bipagem-camera-btn-group">
            {cameraAtiva && (
              <button
                type="button"
                className={`btn-torch-toggle ${torchAtiva ? 'torch-on' : ''}`}
                onClick={toggleTorch}
                title="Ligar/Desligar lanterna"
              >
                {torchAtiva ? '🔦 Lanterna Ligada' : '🔦 Lanterna'}
              </button>
            )}

            <button
              type="button"
              className={`btn-camera-toggle ${cameraAtiva ? 'ativa' : ''}`}
              onClick={toggleCamera}
            >
              {cameraAtiva ? '📷 Parar Câmera' : '📷 Ativar Câmera'}
            </button>
          </div>
        </div>

        {/* CÂMERA SCANNER (SE ATIVA) */}
        {cameraAtiva && (
          <div className="bipagem-camera-wrapper">
            <div id="leitor-camera-galpao" className="bipagem-camera-viewport"></div>
            <div className="bipagem-camera-footer">
              <span className="bipagem-camera-hint">Aponte a câmera para o QR Code ou Código de Barras da peça</span>
            </div>
          </div>
        )}

        {/* INPUT DE DIGITAÇÃO / LEITOR USB */}
        <form
          className="bipagem-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            processarCodigo(codigoInput, false);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Aproxime o leitor USB ou digite o Código / SKU / Barcode..."
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            className="bipagem-input"
          />
          <button type="submit" className="bipagem-submit-btn">
            Bipar (Enter)
          </button>
        </form>

        {/* MENSAGEM DE STATUS */}
        {mensagemStatus.texto && (
          <div className={`bipagem-status-msg ${mensagemStatus.tipo}`}>
            {mensagemStatus.texto}
          </div>
        )}

        {/* BARRA DE PROGRESSO DE SEPARAÇÃO */}
        <div className="bipagem-progress-box">
          <div className="bipagem-progress-info">
            <span>Progresso: <strong>{totalBipadas} / {totalPecas} peças ({pct}%)</strong></span>
            {pct === 100 && <span className="bipagem-completo-tag">🎉 100% Conferido!</span>}
          </div>
          <div className="bipagem-progress-bar">
            <div className={`bipagem-progress-fill ${pct === 100 ? 'concluido' : ''}`} style={{ width: `${pct}%` }}></div>
          </div>
        </div>

        {/* 🚚 BANNER DE AVANÇO RÁPIDO (QUANDO ATINGE 100%) */}
        {pct === 100 && totalPecas > 0 && pedidoAtual && !pedidoJaPronto && (
          <div className="bipagem-banner-concluido">
            <div className="bipagem-concluido-info">
              <span className="concluido-icon">🎉</span>
              <div>
                <strong>Separação 100% Concluída!</strong>
                <p>Todas as peças deste pedido foram bipadas e validadas no galpão.</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-avancar-etapa-galpao"
              onClick={avancarEtapaPedido}
              disabled={avancandoEtapa}
            >
              {avancandoEtapa ? 'Atualizando...' : '🚚 Mover para "Na Rua / Pronto" ➔'}
            </button>
          </div>
        )}

        {/* 📋 LISTAGEM DE PEÇAS DESTE PEDIDO (SELECIONADO) */}
        {pedidoAtual && itensAtivos.length > 0 && (
          <div className="bipagem-lista-itens-box">
            <div className="bipagem-lista-header">
              <h4>📦 Peças do Pedido ({itensAtivos.length})</h4>
              <small>Toque na peça para marcar ou use o [+] para contagem unitária</small>
            </div>
            <div className="bipagem-itens-grid">
              {itensAtivos.map((it, idx) => {
                const totalQtd = Number(it.quantidade || it.qtd || 1);
                const confAtual = Number(it.qtdConferida !== undefined ? it.qtdConferida : (it.checkedSeparacao ? totalQtd : 0));
                const isSeparado = confAtual >= totalQtd;

                return (
                  <div
                    key={idx}
                    className={`bipagem-item-card ${isSeparado ? 'conferido' : 'pendente'}`}
                    onClick={() => alternarItemManual(it, idx)}
                    title="Clique para alternar tudo ou use o botão +1"
                  >
                    <div className="bipagem-item-check">
                      {isSeparado ? '✓' : '○'}
                    </div>

                    <div className="bipagem-item-info">
                      <strong className="bipagem-item-nome">{it.nome || it.descricao}</strong>
                      <div className="bipagem-item-meta">
                        <span className="meta-qtd">
                          <strong>{confAtual}</strong> / {totalQtd}x
                        </span>
                        {(it.codigo || it.sku) && <span className="meta-cod">Cód: {it.codigo || it.sku}</span>}
                      </div>
                    </div>

                    <div className="bipagem-item-actions" onClick={e => e.stopPropagation()}>
                      {!isSeparado && totalQtd > 1 && (
                        <button
                          type="button"
                          className="btn-item-plus-one"
                          onClick={(e) => incrementarItemManual(e, it, idx)}
                          title="Adicionar +1 unidade"
                        >
                          +1
                        </button>
                      )}
                      <span className={`bipagem-item-badge ${isSeparado ? 'ok' : 'pendente'}`}>
                        {isSeparado ? 'Separado' : `${confAtual}/${totalQtd}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ÚLTIMO ITEM BIPADO EM DESTAQUE */}
        {ultimoItemBipado && (
          <div className="bipagem-ultimo-box">
            <div className="bipagem-ultimo-tag">ÚLTIMO ITEM CONFERIDO</div>
            <div className="bipagem-ultimo-info">
              <span className="bipagem-ultimo-nome">{ultimoItemBipado.nome}</span>
              <span className="bipagem-ultimo-cod">Código: <strong>{ultimoItemBipado.codigo}</strong></span>
              <span className="bipagem-ultimo-ped">Destino: <strong>{ultimoItemBipado.pedido}</strong></span>
              <span className="bipagem-ultimo-hora">{ultimoItemBipado.horario}</span>
            </div>
          </div>
        )}

        {/* HISTÓRICO RECENTE DE BIPAGENS */}
        <div className="bipagem-historico-box">
          <h4>📋 Histórico Recente de Bipagem ({historicoBipagens.length})</h4>
          {historicoBipagens.length === 0 ? (
            <div className="bipagem-vazio">Nenhum item bipado nesta sessão. Use o leitor ou câmera para começar.</div>
          ) : (
            <div className="bipagem-historico-list">
              {historicoBipagens.map(item => (
                <div key={item.id} className="bipagem-historico-item">
                  <span className="hist-check">✓</span>
                  <div className="hist-detalhes">
                    <strong>{item.nome}</strong>
                    <small>Cód: {item.codigo} | Pedido {item.pedido} - {item.cliente}</small>
                  </div>
                  <span className="hist-hora">{item.horario}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ModalBipagemGalpao;
