import React, { useState, useEffect, useRef } from 'react';
import './ModalCheckinLocacao.css';
import SignatureCanvas from 'react-signature-canvas';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { gerarComprovanteCheckinPDF } from '../../utils/gerarComprovanteCheckinPDF';

const ModalCheckinLocacao = ({
  isOpen,
  onClose,
  locacao,
  modo = 'IDA', // 'IDA' ou 'VOLTA'
  tenantId,
  usuarioLogado,
  onSalvarSucesso
}) => {
  const [itensState, setItensState] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [salvando, setSalvando] = useState(false);

  // 🔍 BIPAGEM, BUSCA E CÂMERA DE QR/BARCODE
  const [buscaCodigo, setBuscaCodigo] = useState('');
  const [mensagemBip, setMensagemBip] = useState(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const inputBuscaRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // ✍️ ASSINATURA DIGITAL
  const sigCanvasRef = useRef(null);
  const [assinaturaSalvaUrl, setAssinaturaSalvaUrl] = useState(null);

  // 📷 FOTOS DA VISTORIA
  const [fotosVistoria, setFotosVistoria] = useState([]);

  // 👥 COLABORADORES DA EMPRESA (COLEÇÃO EQUIPE)
  const [listaColaboradores, setListaColaboradores] = useState([]);

  useEffect(() => {
    const carregarColaboradores = async () => {
      if (!tenantId) return;
      try {
        const qEquipe = query(collection(db, "equipe"), where("empresaId", "==", tenantId));
        const snapEquipe = await getDocs(qEquipe).catch(() => ({ docs: [] }));
        const equipeDocs = snapEquipe.docs ? snapEquipe.docs.map(d => d.data()) : [];

        const nomesSet = new Set();
        // Adiciona o usuário logado atual (Proprietário/Dono)
        const nomeAtual = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || 'Proprietário / Admin';
        if (nomeAtual) nomesSet.add(nomeAtual);

        equipeDocs.forEach(u => {
          const n = u.nome || u.nomeCompleto || u.displayName || u.email;
          if (n) nomesSet.add(n);
        });

        setListaColaboradores(Array.from(nomesSet));
      } catch (err) {
        console.error("Erro ao carregar colaboradores da equipe:", err);
        const nomeFallback = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || 'Proprietário / Admin';
        setListaColaboradores([nomeFallback]);
      }
    };

    carregarColaboradores();
  }, [tenantId, usuarioLogado]);

  useEffect(() => {
    if (locacao && locacao.itens) {
      const nomeFunc = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || 'Atendente';
      setResponsavel(prev => prev || nomeFunc);

      // Prepara os itens com quantidade fracionada e status
      const itensPreparados = locacao.itens.map(item => {
        const totalQtd = Number(item.quantidade || 1);
        const qtdConfInicial = item.qtdConferida !== undefined 
          ? Number(item.qtdConferida) 
          : (modo === 'IDA' ? (item.checkedSeparacao ? totalQtd : 0) : (item.checkedDevolucao ? totalQtd : 0));

        return {
          ...item,
          quantidade: totalQtd,
          qtdConferida: Math.min(qtdConfInicial, totalQtd),
          // IDA
          checkedSeparacao: item.checkedSeparacao || qtdConfInicial >= totalQtd,
          // VOLTA
          checkedDevolucao: item.checkedDevolucao !== undefined ? item.checkedDevolucao : false,
          statusRetorno: item.statusRetorno || (item.avaria ? 'avaria' : item.faltou ? 'faltou' : 'ok'),
          motivoAvaria: item.motivoAvaria || '',
          custoAvaria: item.custoAvaria || '',
          enviarManutencao: item.enviarManutencao !== undefined ? item.enviarManutencao : true
        };
      });

      setItensState(itensPreparados);
      setObservacoes(modo === 'IDA' ? (locacao.obsSaida || '') : (locacao.obsRetorno || ''));
      setFotosVistoria(modo === 'IDA' ? (locacao.fotosCheckinSaida || []) : (locacao.fotosCheckinRetorno || []));
      setAssinaturaSalvaUrl(modo === 'IDA' ? (locacao.assinaturaSaidaUrl || null) : (locacao.assinaturaRetornoUrl || null));

      // Foco na busca
      setTimeout(() => {
        if (inputBuscaRef.current) inputBuscaRef.current.focus();
      }, 300);
    }
  }, [locacao, modo, usuarioLogado]);

  if (!isOpen || !locacao) return null;

  const isIda = modo === 'IDA';
  const numeroPedido = locacao.numeroPedido || locacao.id?.substring(0, 6).toUpperCase();
  const clienteNome = locacao.clienteNome || locacao.cliente?.nome || 'Cliente não informado';

  // Grava Log de Auditoria
  const registrarLogAuditoria = async (acao, detalhes) => {
    try {
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: responsavel,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        pedidoId: locacao.id,
        numeroPedido: numeroPedido,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro no log:", err);
    }
  };

  // 🔍 BUSCA RÁPIDA / CONFERÊNCIA POR BIPAGEM, CÓDIGO E BARCODE
  const processarCodigoDetectado = (termoRaw) => {
    if (!termoRaw) return;
    const termo = String(termoRaw).trim().toLowerCase();
    const termoSemHifen = termo.replace(/-/g, '');

    const idxEncontrado = itensState.findIndex(it => {
      const cod = String(it.codigo || '').toLowerCase();
      const codSemHifen = cod.replace(/-/g, '');
      const nome = String(it.nome || '').toLowerCase();
      const barcode = String(it.barcode || it.codigoBarra || it.qrCode || '').toLowerCase();

      return cod === termo || 
             codSemHifen === termoSemHifen || 
             nome.includes(termo) || 
             (barcode && (barcode === termo || barcode.toLowerCase() === termo));
    });

    if (idxEncontrado !== -1) {
      const itemAchado = itensState[idxEncontrado];
      const qtdMax = itemAchado.quantidade;
      const novaQtd = Math.min(itemAchado.qtdConferida + 1, qtdMax);

      setItensState(prev => prev.map((it, idx) => {
        if (idx === idxEncontrado) {
          return {
            ...it,
            qtdConferida: novaQtd,
            checkedSeparacao: novaQtd >= qtdMax,
            checkedDevolucao: true
          };
        }
        return it;
      }));

      setMensagemBip({ tipo: 'sucesso', texto: `✅ "${itemAchado.nome}" (${novaQtd}/${qtdMax} un)` });
    } else {
      setMensagemBip({ tipo: 'erro', texto: `❌ Peça ou código "${termoRaw}" não encontrado no pedido!` });
    }

    setBuscaCodigo('');
    setTimeout(() => setMensagemBip(null), 3500);
  };

  // 📷 LEITOR DE CÂMERA AO VIVO (QR CODE & CÓDIGO DE BARRAS)
  const iniciarScannerCamera = async () => {
    setCameraAberta(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader-camera-checkin");
        html5QrCodeRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            processarCodigoDetectado(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Erro ao abrir câmera para leitura:", err);
        setMensagemBip({ tipo: 'erro', texto: '⚠️ Câmera indisponível ou permissão negada no dispositivo.' });
      }
    }, 350);
  };

  const pararScannerCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error("Erro ao desligar câmera:", e);
      }
      html5QrCodeRef.current = null;
    }
    setCameraAberta(false);
  };

  // 🔢 AJUSTE DE QUANTIDADE FRACIONADA POR ITEM
  const alterarQtdConferida = (index, delta) => {
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        const novaQtd = Math.max(0, Math.min(it.qtdConferida + delta, it.quantidade));
        return {
          ...it,
          qtdConferida: novaQtd,
          checkedSeparacao: novaQtd >= it.quantidade,
          checkedDevolucao: novaQtd > 0
        };
      }
      return it;
    }));
  };

  const setQtdConferidaDireta = (index, valor) => {
    const num = Math.max(0, parseInt(valor) || 0);
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        const novaQtd = Math.min(num, it.quantidade);
        return {
          ...it,
          qtdConferida: novaQtd,
          checkedSeparacao: novaQtd >= it.quantidade,
          checkedDevolucao: novaQtd > 0
        };
      }
      return it;
    }));
  };

  // MARCAR TODOS EM LOTE
  const marcarTodosLote = (modoAcao) => {
    if (modoAcao === 'todos_ida') {
      setItensState(prev => prev.map(it => ({
        ...it,
        qtdConferida: it.quantidade,
        checkedSeparacao: true
      })));
    } else if (modoAcao === 'desmarcar') {
      setItensState(prev => prev.map(it => ({
        ...it,
        qtdConferida: 0,
        checkedSeparacao: false,
        checkedDevolucao: false
      })));
    } else if (modoAcao === 'todos_volta_ok') {
      setItensState(prev => prev.map(it => ({
        ...it,
        qtdConferida: it.quantidade,
        statusRetorno: 'ok',
        checkedDevolucao: true,
        avaria: false,
        faltou: false,
        motivoAvaria: '',
        custoAvaria: ''
      })));
    }
  };

  const setStatusItemRetorno = (index, status) => {
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) {
        return {
          ...it,
          statusRetorno: status,
          checkedDevolucao: true,
          avaria: status === 'avaria',
          faltou: status === 'faltou'
        };
      }
      return it;
    }));
  };

  const setCampoItemRetorno = (index, campo, valor) => {
    setItensState(prev => prev.map((it, idx) => {
      if (idx === index) return { ...it, [campo]: valor };
      return it;
    }));
  };

  // 📷 ADICIONAR FOTOS DA VISTORIA
  const handleUploadFotos = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotosVistoria(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removerFotoVistoria = (index) => {
    setFotosVistoria(prev => prev.filter((_, i) => i !== index));
  };

  // ✍️ ASSINATURA DIGITAL
  const limparAssinatura = () => {
    if (sigCanvasRef.current) sigCanvasRef.current.clear();
    setAssinaturaSalvaUrl(null);
  };

  const capturarAssinatura = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
      setAssinaturaSalvaUrl(dataUrl);
      return dataUrl;
    }
    return assinaturaSalvaUrl;
  };

  // 🖨️ EMITIR PDF
  const handleGerarPDF = () => {
    const sigUrl = capturarAssinatura();
    gerarComprovanteCheckinPDF(locacao, modo, itensState, {
      responsavel,
      observacoes,
      assinaturaUrl: sigUrl
    });
  };

  // 💬 ENVIAR POR WHATSAPP
  const handleEnviarWhatsApp = () => {
    const fone = locacao.clienteTelefone || locacao.cliente?.telefone || '';
    if (!fone) {
      alert("⚠️ Telefone do cliente não cadastrado.");
      return;
    }
    const foneLimpo = fone.replace(/\D/g, '');
    let msg = `Olá *${clienteNome}*! 🎈\n\n`;
    msg += `Aqui está a confirmação de *Check-in de ${isIda ? 'Saída (IDA)' : 'Devolução (VOLTA)'}* do seu Pedido *#${numeroPedido}*:\n\n`;
    
    itensState.forEach(i => {
      const qtdConf = i.qtdConferida || 0;
      const st = isIda ? (qtdConf >= i.quantidade ? '✅' : '⚠️') : (i.statusRetorno === 'ok' ? '🟢 OK' : i.statusRetorno === 'avaria' ? '🛠️ Avaria' : '❌ Falta');
      msg += `• ${i.nome} (${qtdConf}/${i.quantidade} un) - ${st}\n`;
    });

    if (observacoes) msg += `\n📝 *Obs:* ${observacoes}\n`;
    msg += `\n*Responsável:* ${responsavel}\nCelebre Festas & Decorações ✨`;

    const url = `https://api.whatsapp.com/send?phone=55${foneLimpo}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // SALVAR CHECK-IN
  const handleSalvarCheckin = async () => {
    setSalvando(true);
    try {
      const sigUrl = capturarAssinatura();
      const locRef = doc(db, "locacoes", locacao.id);

      const totalContratado = itensState.reduce((acc, i) => acc + Number(i.quantidade || 1), 0);
      const totalConferido = itensState.reduce((acc, i) => acc + Number(i.qtdConferida || 0), 0);

      if (isIda) {
        const totalConcluido = totalConferido >= totalContratado;

        const dadosAtualizar = {
          itens: itensState,
          obsSaida: observacoes,
          responsavelSaida: responsavel,
          dataCheckinSaida: new Date().toISOString(),
          fotosCheckinSaida: fotosVistoria,
          assinaturaSaidaUrl: sigUrl || null,
          statusCheckinSaida: totalConcluido ? 'concluido' : 'parcial'
        };

        if (totalConcluido && locacao.status !== 'em_transito' && locacao.status !== 'finalizado') {
          dadosAtualizar.status = 'preparacao';
        }

        await updateDoc(locRef, dadosAtualizar);

        await registrarLogAuditoria(
          "CHECK-IN DE SAÍDA (EXPEDIÇÃO MÁXIMA)",
          `Conferência de saída finalizada: ${totalConferido}/${totalContratado} peças. Resp: ${responsavel}.`
        );

        alert(`✅ Check-in de Saída (IDA) gravado com sucesso!\n${totalConferido} de ${totalContratado} unidades conferidas.`);
      } else {
        // MODO VOLTA
        const itensAvaria = itensState.filter(i => i.statusRetorno === 'avaria');
        const itensFaltou = itensState.filter(i => i.statusRetorno === 'faltou');

        // Enviar peças avariadas para o estoque de manutenção
        for (const itemAv of itensAvaria) {
          if (itemAv.enviarManutencao && (itemAv.id || itemAv.pecaId)) {
            const pecaId = itemAv.pecaId || itemAv.id;
            try {
              const pecaRef = doc(db, "estoque", pecaId);
              const pecaSnap = await getDoc(pecaRef);
              if (pecaSnap.exists()) {
                const pecaData = pecaSnap.data();
                const qtdMaintAtual = Number(pecaData.qtdManutencao || 0);
                await updateDoc(pecaRef, {
                  qtdManutencao: qtdMaintAtual + Number(itemAv.quantidade || 1),
                  statusManutencao: 'em_manutencao',
                  motivoManutencao: itemAv.motivoAvaria || `Avaria na devolução #${numeroPedido}`,
                  custoManutencao: Number(itemAv.custoAvaria || 0),
                  dataInicioManutencao: new Date().toISOString().split('T')[0]
                });
              }
            } catch (eErr) {
              console.error("Erro na manutenção do estoque:", eErr);
            }
          }
        }

        // 💰 INTEGRAÇÃO FINANCEIRA: Lançar cobrança de taxa de avaria para o cliente no Financeiro
        const totalCustoAvarias = itensAvaria.reduce((acc, i) => acc + Number(i.custoAvaria || 0), 0);
        if (totalCustoAvarias > 0) {
          try {
            await addDoc(collection(db, "financeiro_lancamentos"), {
              userId: tenantId,
              empresaId: tenantId,
              tipo: "entrada",
              categoria: "Manutenção e Reparos",
              centroCusto: "Taxas e Reparações",
              descricao: `🛠️ Taxa de Avaria / Reparo: Pedido #${numeroPedido} - ${clienteNome}`,
              valor: totalCustoAvarias,
              valorTotal: totalCustoAvarias,
              data: new Date().toISOString().split('T')[0],
              status: "pendente",
              formaPagamento: "Pix",
              formaPagto: "Pix",
              locacaoId: locacao.id,
              locacaoNumero: numeroPedido,
              clienteId: locacao.clienteId || "",
              clienteNome: clienteNome,
              origem: "checkin_avaria_devolucao",
              observacoes: `Cobrança de avaria gerada na vistoria de devolução (${itensAvaria.length} peça(s) avariada(s)).`,
              criadoEm: serverTimestamp()
            });
          } catch (finErr) {
            console.error("Erro ao gerar lançamento financeiro de avaria:", finErr);
          }
        }

        const dadosAtualizar = {
          itens: itensState,
          obsRetorno: observacoes,
          responsavelRetorno: responsavel,
          dataCheckinRetorno: new Date().toISOString(),
          fotosCheckinRetorno: fotosVistoria,
          assinaturaRetornoUrl: sigUrl || null,
          statusCheckinRetorno: 'concluido',
          status: 'finalizado'
        };

        await updateDoc(locRef, dadosAtualizar);

        await registrarLogAuditoria(
          "CHECK-IN DE RETORNO (DEVOLUÇÃO MÁXIMA)",
          `Recebimento finalizado: ${totalConferido}/${totalContratado} peças devolvidas. Avarias: ${itensAvaria.length}, Faltas: ${itensFaltou.length}. Resp: ${responsavel}.${totalCustoAvarias > 0 ? ` Taxa de avaria de R$ ${totalCustoAvarias.toFixed(2)} lançada no Financeiro.` : ''}`
        );

        alert(`✅ Check-in de Retorno (VOLTA) finalizado com sucesso!${totalCustoAvarias > 0 ? `\n💰 Uma cobrança de R$ ${totalCustoAvarias.toFixed(2)} por avaria foi lançada no Financeiro.` : ''}`);
      }

      if (onSalvarSucesso) onSalvarSucesso();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar checkin:", err);
      alert("🚫 Erro ao salvar conferência. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const formatarMoedaInput = (valor) => {
    if (!valor && valor !== 0) return '';
    const apenasDigitos = String(valor).replace(/\D/g, '');
    if (!apenasDigitos) return '';
    const num = Number(apenasDigitos) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const extrairValorNumerico = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const limpo = String(val).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
  };

  const totalContratado = itensState.reduce((acc, i) => acc + Number(i.quantidade || 1), 0);
  const totalConferido = itensState.reduce((acc, i) => acc + Number(i.qtdConferida || 0), 0);
  const progressoPct = totalContratado > 0 ? Math.round((totalConferido / totalContratado) * 100) : 0;

  return (
    <div className="modal-checkin-overlay">
      <div className="modal-checkin-box animate-pop modal-checkin-wide">
        
        {/* HEADER MODERNO, LIMPO E COM BORDAS ELEGANTES */}
        <div className={`modal-checkin-header ${isIda ? 'header-ida' : 'header-volta'}`}>
          <div className="header-top-line">
            <span className="badge-modo">{isIda ? 'CONFERÊNCIA DE SAÍDA' : 'VISTORIA DE DEVOLUÇÃO'}</span>
            <div className="header-top-actions">
              <button type="button" className="btn-header-pdf" onClick={handleGerarPDF} title="Baixar PDF">📄 PDF</button>
              <button type="button" className="btn-header-wsp" onClick={handleEnviarWhatsApp} title="Enviar por WhatsApp">💬 Whats</button>
              <button type="button" className="btn-close-modal" onClick={onClose}>✕</button>
            </div>
          </div>
          <div className="header-bottom-line">
            <div className="header-cliente-row">
              <h2 className="cliente-txt">👤 {clienteNome}</h2>
              <span className="header-pedido-txt">Pedido #{numeroPedido}</span>
            </div>
            <div className="header-dates-inline">
              <span>📅 Evento: <strong>{locacao.dataRetirada ? locacao.dataRetirada.split('-').reverse().join('/') : 'S/D'}</strong></span>
              {locacao.dataDevolucao && <span> ➔ Devolução: <strong>{locacao.dataDevolucao.split('-').reverse().join('/')}</strong></span>}
            </div>
          </div>
        </div>

        {/* BARRA DE PROGRESSO & BIPAGEM */}
        <div className="checkin-top-toolbar">
          <div className="progress-section">
            <div className="progress-label">
              <span>Progresso ({totalConferido}/{totalContratado} peças)</span>
              <strong className="pct-badge">{progressoPct}%</strong>
            </div>
            <div className="progress-track">
              <div 
                className={`progress-fill ${isIda ? 'fill-ida' : 'fill-volta'}`} 
                style={{ width: `${progressoPct}%` }} 
              />
            </div>
          </div>

          {/* 🔍 BUSCA RÁPIDA E LEITOR DE CÂMERA DE QR / BARCODE */}
          <div className="bipagem-box">
            <div className="bipagem-input-group">
              <input 
                ref={inputBuscaRef}
                type="text"
                className="input-bipagem"
                placeholder="🔍 Código da peça ou nome..."
                value={buscaCodigo}
                onChange={(e) => setBuscaCodigo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') processarCodigoDetectado(buscaCodigo); }}
              />
              <button 
                type="button" 
                className="btn-bipar-ok"
                onClick={() => processarCodigoDetectado(buscaCodigo)}
                title="Buscar e Conferir Peça"
              >
                Conferir
              </button>
              <button 
                type="button" 
                className={`btn-camera-scan ${cameraAberta ? 'active' : ''}`}
                onClick={cameraAberta ? pararScannerCamera : iniciarScannerCamera}
                title="Escanear com Câmera (QR Code / Código de Barras)"
              >
                📷 {cameraAberta ? 'Fechar' : 'Scanner'}
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK DE BIPAGEM */}
        {mensagemBip && (
          <div className={`toast-bip ${mensagemBip.tipo}`}>
            {mensagemBip.texto}
          </div>
        )}

        {/* PAINEL DA CÂMERA DE LEITURA AO VIVO */}
        {cameraAberta && (
          <div className="camera-scanner-panel">
            <div className="camera-header-row">
              <span>📷 Aproxime o QR Code ou Código de Barras da câmera:</span>
              <button type="button" className="btn-close-cam" onClick={pararScannerCamera}>✕ Fechar Câmera</button>
            </div>
            <div id="reader-camera-checkin" className="camera-video-box"></div>
          </div>
        )}

        {/* CORPO DO CHECK-IN EM 2 COLUNAS NO DESKTOP */}
        <div className="modal-checkin-body modal-checkin-grid-body">
          
          {/* COLUNA ESQUERDA: LISTAGEM DE PEÇAS & CONFERÊNCIA */}
          <div className="modal-col-esquerda">
            {/* BOTÕES DE AÇÃO EM LOTE */}
            <div className="lote-actions-bar">
              {isIda ? (
                <>
                  <button type="button" className="btn-lote-gold" onClick={() => marcarTodosLote('todos_ida')}>
                    Marcar Tudo Conferido
                  </button>
                  <button type="button" className="btn-lote-outline" onClick={() => marcarTodosLote('desmarcar')}>
                    Zerar
                  </button>
                </>
              ) : (
                <button type="button" className="btn-lote-green" onClick={() => marcarTodosLote('todos_volta_ok')}>
                  Marcar Todos como OK
                </button>
              )}
            </div>

            {/* LISTA DE PEÇAS COM CONTROLE QUANTITATIVO FRACIONADO */}
            <div className="checkin-itens-list">
              {itensState.map((item, idx) => {
                const isTotal = item.qtdConferida >= item.quantidade;
                const isParcial = item.qtdConferida > 0 && item.qtdConferida < item.quantidade;

                return (
                  <div 
                    key={idx} 
                    className={`checkin-item-card ${
                      isIda 
                        ? (isTotal ? 'card-checked-ida' : isParcial ? 'card-parcial' : '') 
                        : (item.statusRetorno === 'ok' ? 'card-checked-ok' : item.statusRetorno === 'avaria' ? 'card-checked-avaria' : item.statusRetorno === 'faltou' ? 'card-checked-falta' : '')
                    }`}
                  >
                    {/* LINHA SUPERIOR DO ITEM (FOTO + NOME + TAGS) */}
                    <div className="item-top-header-row">
                      <div className="item-thumb-box">
                        {item.imagem || item.foto ? (
                          <img src={item.imagem || item.foto} alt={item.nome} className="item-thumb-img" />
                        ) : (
                          <div className="item-thumb-placeholder">📦</div>
                        )}
                      </div>

                      <div className="item-info-col">
                        <h4 className="item-nome-txt">{item.nome || item.descricao || 'Peça sem nome'}</h4>
                        <div className="item-tags">
                          <span className="badge-qtd">Total: <strong>{item.quantidade} un</strong></span>
                          {item.categoria && <span className="badge-cat">{item.categoria}</span>}
                          {item.codigo && <span className="badge-cod">Cód: <strong>{item.codigo}</strong></span>}
                        </div>
                      </div>
                    </div>

                    {/* LINHA INFERIOR DE CONTROLES (STEPPER + BOTÕES DE STATUS) */}
                    <div className="item-bottom-controls-row">
                      {/* CONTROLE QUANTITATIVO FRACIONADO */}
                      <div className="stepper-qtd-box">
                        <span className="stepper-title">Conferido:</span>
                        <div className="stepper-controls">
                          <button type="button" className="btn-step" onClick={() => alterarQtdConferida(idx, -1)}>-</button>
                          <input 
                            type="number" 
                            className="input-step-num"
                            value={item.qtdConferida}
                            onChange={(e) => setQtdConferidaDireta(idx, e.target.value)}
                          />
                          <button type="button" className="btn-step" onClick={() => alterarQtdConferida(idx, 1)}>+</button>
                          <button type="button" className="btn-step-max" onClick={() => alterarQtdConferida(idx, item.quantidade)}>Max</button>
                        </div>
                      </div>

                      {/* CONTROLES DO MODO VOLTA (OK / AVARIA / FALTA) */}
                      {!isIda && (
                        <div className="botoes-status-retorno">
                          <button 
                            type="button" 
                            className={`btn-st-retorno st-ok ${item.statusRetorno === 'ok' ? 'active' : ''}`}
                            onClick={() => setStatusItemRetorno(idx, 'ok')}
                          >
                            🟢 OK
                          </button>
                          <button 
                            type="button" 
                            className={`btn-st-retorno st-avaria ${item.statusRetorno === 'avaria' ? 'active' : ''}`}
                            onClick={() => setStatusItemRetorno(idx, 'avaria')}
                          >
                            🛠️ Avaria
                          </button>
                          <button 
                            type="button" 
                            className={`btn-st-retorno st-faltou ${item.statusRetorno === 'faltou' ? 'active' : ''}`}
                            onClick={() => setStatusItemRetorno(idx, 'faltou')}
                          >
                            ❌ Falta
                          </button>
                        </div>
                      )}
                    </div>

                    {/* PAINEL CONDICIONAL DE AVARIA / REPOSIÇÃO */}
                    {!isIda && item.statusRetorno === 'avaria' && (
                      <div className="gaveta-avaria-box animate-fade-down">
                        <div className="gaveta-header">
                          <span>🛠️ REGISTRO DE AVARIA E MANUTENÇÃO</span>
                        </div>
                        <div className="gaveta-inputs-grid">
                          <div className="field-group">
                            <label>Motivo do Dano / Defeito:</label>
                            <input 
                              type="text"
                              placeholder="Ex: Vaso trincado, tecido manchado..."
                              value={item.motivoAvaria || ''}
                              onChange={(e) => setCampoItemRetorno(idx, 'motivoAvaria', e.target.value)}
                            />
                          </div>
                          <div className="field-group short">
                            <label>Custo de Reparação (R$):</label>
                            <input 
                              type="text"
                              placeholder="0,00"
                              value={item.custoAvaria ? (String(item.custoAvaria).includes(',') ? item.custoAvaria : formatarMoedaInput(item.custoAvaria)) : ''}
                              onChange={(e) => setCampoItemRetorno(idx, 'custoAvaria', formatarMoedaInput(e.target.value))}
                            />
                          </div>
                        </div>
                        <label className="checkbox-maint">
                          <input 
                            type="checkbox"
                            checked={item.enviarManutencao !== false}
                            onChange={(e) => setCampoItemRetorno(idx, 'enviarManutencao', e.target.checked)}
                          />
                          <span>Enviar peça automaticamente para a fila de Manutenção do Acervo</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUNA DIREITA: FOTOS, ASSINATURA & OBSERVAÇÕES */}
          <div className="modal-col-direita">
            {/* 📷 ANEXO DE FOTOS DA VISTORIA */}
            <div className="fotos-vistoria-section">
              <div className="section-header-row">
                <label className="section-lbl">📷 Fotos da Vistoria de {isIda ? 'Saída' : 'Devolução'}:</label>
                <label className="btn-upload-foto">
                  + Adicionar Fotos
                  <input type="file" accept="image/*" multiple onChange={handleUploadFotos} style={{ display: 'none' }} />
                </label>
              </div>
              {fotosVistoria.length > 0 ? (
                <div className="fotos-grid">
                  {fotosVistoria.map((ft, fIdx) => (
                    <div key={fIdx} className="foto-item-box">
                      <img src={ft} alt={`Vistoria ${fIdx}`} className="foto-img" />
                      <button type="button" className="btn-del-foto" onClick={() => removerFotoVistoria(fIdx)}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-fotos-txt">Nenhuma foto anexada. Clique em "+ Adicionar Fotos" para registrar a vistoria.</p>
              )}
            </div>

            {/* ✍️ CANVAS DE ASSINATURA DIGITAL */}
            <div className="assinatura-digital-section">
              <div className="section-header-row">
                <label className="section-lbl">✍️ Assinatura Digital do Cliente / Retirante:</label>
                <button type="button" className="btn-limpar-sig" onClick={limparAssinatura}>Limpar</button>
              </div>
              {assinaturaSalvaUrl ? (
                <div className="assinatura-preview-box">
                  <img src={assinaturaSalvaUrl} alt="Assinatura Coletada" className="sig-preview-img" />
                  <span className="sig-badge">✓ Assinatura Confirmada</span>
                </div>
              ) : (
                <div className="canvas-wrapper">
                  <SignatureCanvas 
                    ref={sigCanvasRef} 
                    penColor="#0f172a" 
                    canvasProps={{ 
                      className: "sig-canvas-pad",
                      style: { touchAction: 'none', width: '100%', height: '100%' }
                    }} 
                    backgroundColor="transparent" 
                    velocityFilterWeight={0.7}
                  />
                  <span className="canvas-hint">Assine com o dedo no celular ou com o mouse</span>
                </div>
              )}
            </div>

            {/* OBSERVACÕES E RESPONSÁVEL */}
            <div className="checkin-footer-fields">
              <div className="field-group full">
                <label>📝 Observações da Vistoria ({isIda ? 'Saída' : 'Devolução'}):</label>
                <textarea 
                  rows="2"
                  placeholder={isIda ? "Ex: Embalado na caixa 01 e 02." : "Ex: Material devolvido em ordem."}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
              <div className="field-group full">
                <label>👤 Responsável pela Conferência (Colaborador / Proprietário):</label>
                <select 
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  className="select-colaborador"
                >
                  {listaColaboradores.map((colab, cIdx) => (
                    <option key={cIdx} value={colab}>
                      👤 {colab}
                    </option>
                  ))}
                  {!listaColaboradores.includes(responsavel) && responsavel && (
                    <option value={responsavel}>👤 {responsavel}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER DE AÇÕES */}
        <div className="modal-checkin-footer">
          <button type="button" className="btn-cancelar-modal" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button 
            type="button" 
            className={`btn-salvar-checkin ${isIda ? 'btn-ida' : 'btn-volta'}`}
            onClick={handleSalvarCheckin}
            disabled={salvando}
          >
            {salvando ? 'Gravando Vistoria...' : (isIda ? 'Finalizar Conferência de Saída' : 'Concluir Vistoria de Devolução')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalCheckinLocacao;
