import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import './ModalBipagemGalpao.css';

/**
 * ⚡ MODAL DE BIPAGEM CONTÍNUA DE GALPÃO (SCANNER TOUCH & LEITOR USB)
 * Permite bipar peças ou etiquetas com a câmera do celular ou leitor de código de barras.
 */
export const ModalBipagemGalpao = ({
  isOpen,
  onClose,
  locacoes = [],
  onAtualizarLocacoes,
  tenantId
}) => {
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState('todos');
  const [codigoInput, setCodigoInput] = useState('');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [ultimoItemBipado, setUltimoItemBipado] = useState(null);
  const [historicoBipagens, setHistoricoBipagens] = useState([]);
  const [mensagemStatus, setMensagemStatus] = useState({ tipo: '', texto: '' });

  const html5QrCodeRef = useRef(null);
  const inputRef = useRef(null);

  // 🔊 SINTETIZADOR DE ÁUDIO WEB API (BIPES SEM ARQUIVOS EXTERNOS)
  const tocarBip = (tipo = 'sucesso') => {
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
      } else if (tipo === 'alerta') {
        osc.frequency.setValueAtTime(300, ctx.currentTime); // Tom grave
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {}
  };

  // 🔍 PROCESSAMENTO DO CÓDIGO BIPADO (SKU, BARCODE, NOME OU PEDIDO)
  const processarCodigo = async (codigoRaw) => {
    if (!codigoRaw) return;
    const codigoLimpo = String(codigoRaw).trim().toLowerCase();
    const codigoSemHifen = codigoLimpo.replace(/[-_]/g, '');

    // Filtra lista de pedidos a buscar
    const pedidosAlvo = pedidoSelecionadoId === 'todos'
      ? locacoes.filter(l => l.status === 'confirmado' || l.status === 'preparacao')
      : locacoes.filter(l => l.id === pedidoSelecionadoId);

    let itemEncontrado = null;
    let pedidoEncontrado = null;
    let itemIndex = -1;

    for (const ped of pedidosAlvo) {
      const itens = ped.itens || [];
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
      tocarBip('sucesso');
      const numPed = pedidoEncontrado.numeroPedido ? `#${pedidoEncontrado.numeroPedido}` : `#${pedidoEncontrado.id.substring(0, 5)}`;
      const novoChecked = true;

      // Atualiza localmente o item como separado
      const novosItens = [...pedidoEncontrado.itens];
      novosItens[itemIndex] = {
        ...itemEncontrado,
        checkedSeparacao: novoChecked,
        dataBipagem: new Date().toISOString()
      };

      setUltimoItemBipado({
        nome: itemEncontrado.nome || itemEncontrado.descricao,
        codigo: itemEncontrado.codigo || itemEncontrado.sku || '-',
        pedido: `${numPed} - ${pedidoEncontrado.clienteNome || 'Cliente'}`,
        horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      setHistoricoBipagens(prev => [
        {
          id: Date.now(),
          nome: itemEncontrado.nome || itemEncontrado.descricao,
          codigo: itemEncontrado.codigo || itemEncontrado.sku || '-',
          pedido: numPed,
          cliente: pedidoEncontrado.clienteNome,
          horario: new Date().toLocaleTimeString('pt-BR')
        },
        ...prev.slice(0, 19)
      ]);

      setMensagemStatus({
        tipo: 'sucesso',
        texto: `✓ Bipado: ${itemEncontrado.nome} para ${numPed} (${pedidoEncontrado.clienteNome})`
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
      setMensagemStatus({
        tipo: 'alerta',
        texto: `⚠️ Peça não encontrada nos pedidos ativos: "${codigoRaw}"`
      });
    }

    setCodigoInput('');
    if (inputRef.current) inputRef.current.focus();
  };

  // 🛡️ PARAR SCANNER COM TOTAL SEGURANÇA CONTRA ERROS
  const pararScannerSeguro = async () => {
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
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              processarCodigo(decodedText);
            },
            () => {}
          );
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

  // Contagem de progresso de separação
  const pedidosFiltrados = pedidoSelecionadoId === 'todos'
    ? locacoes.filter(l => l.status === 'confirmado' || l.status === 'preparacao')
    : locacoes.filter(l => l.id === pedidoSelecionadoId);

  let totalPecas = 0;
  let totalBipadas = 0;

  pedidosFiltrados.forEach(p => {
    (p.itens || []).forEach(it => {
      const q = Number(it.quantidade || it.qtd || 1);
      totalPecas += q;
      if (it.checkedSeparacao) totalBipadas += q;
    });
  });

  const pct = totalPecas > 0 ? Math.round((totalBipadas / totalPecas) * 100) : 0;

  const modalContent = (
    <div className="bipagem-overlay" onClick={onClose}>
      <div className="bipagem-container" onClick={(e) => e.stopPropagation()}>
        
        {/* CABEÇALHO */}
        <div className="bipagem-header">
          <div className="bipagem-header-left">
            <span className="bipagem-badge">⚡ BIPAGEM CONTÍNUA DE GALPÃO</span>
            <h2>Scanner de Separação &amp; Acervo</h2>
          </div>
          <button type="button" className="bipagem-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* CONTROLES DO TOPO: SELETOR DE PEDIDO & BOTÃO CÂMERA */}
        <div className="bipagem-top-controls">
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

          <button
            type="button"
            className={`btn-camera-toggle ${cameraAtiva ? 'ativa' : ''}`}
            onClick={toggleCamera}
          >
            {cameraAtiva ? '📷 Desativar Câmera' : '📷 Ativar Câmera Scanner'}
          </button>
        </div>

        {/* CÂMERA SCANNER (SE ATIVA) */}
        {cameraAtiva && (
          <div className="bipagem-camera-wrapper">
            <div id="leitor-camera-galpao" className="bipagem-camera-viewport"></div>
            <span className="bipagem-camera-hint">Aponte a câmera para o QR Code ou Código de Barras da peça</span>
          </div>
        )}

        {/* INPUT DE DIGITAÇÃO / LEITOR USB */}
        <form
          className="bipagem-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            processarCodigo(codigoInput);
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
            <span>Progresso da Separação: <strong>{totalBipadas} / {totalPecas} peças ({pct}%)</strong></span>
          </div>
          <div className="bipagem-progress-bar">
            <div className="bipagem-progress-fill" style={{ width: `${pct}%` }}></div>
          </div>
        </div>

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
          <h4>📋 Histórico Recente de Separação ({historicoBipagens.length})</h4>
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
