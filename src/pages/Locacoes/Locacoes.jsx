import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Locacoes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import { gerarPropostaPDF } from '../../utils/gerarPropostaPDF';
import ModalCalendarioDisponibilidade from './ModalCalendarioDisponibilidade';
import ModalCheckinLocacao from './ModalCheckinLocacao';
import ModalRomaneioSeparacao from './ModalRomaneioSeparacao';

// 🏷️ TIPOS DE EVENTO DISPONÍVEIS
const TIPOS_EVENTO = [
  { value: 'aniversario',       label: 'Aniversário',       emoji: '🎂' },
  { value: 'casamento',         label: 'Casamento',         emoji: '💍' },
  { value: 'formatura',         label: 'Formatura',         emoji: '🎓' },
  { value: 'corporativo',       label: 'Corporativo',       emoji: '💼' },
  { value: 'cha_bebe',          label: 'Chá de Bebê',       emoji: '👶' },
  { value: 'debutante',         label: 'Debutante',         emoji: '👑' },
  { value: 'batizado',          label: 'Batizado',          emoji: '⛪' },
  { value: 'confraternizacao',  label: 'Confraternização', emoji: '🥂' },
  { value: 'outro',             label: 'Outro',             emoji: '🎉' },
];

const Locacoes = () => {
  const navigate = useNavigate();
  const location = useLocation(); 

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  
  // 🔥 CHAVE MESTRA: Pega o ID da empresa no navegador ou o do próprio usuário
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroServico, setFiltroServico] = useState('todos'); 
  const [filtroOrdenacao, setFiltroOrdenacao] = useState('recentes');
  const [filtroDataEvento, setFiltroDataEvento] = useState(''); 
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');
  // 🚨 FILTROS RÁPIDOS DE OPERAÇÃO DO DIA E ROMANEIO
  const [filtroOperacao, setFiltroOperacao] = useState('todos'); // 'todos' | 'saem_hoje' | 'entram_hoje' | 'atrasados'
  const [modalRomaneioPedido, setModalRomaneioPedido] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(null);

  // 📅 MODAL CALENDÁRIO & ESTOQUE / CONFIG
  const [modalCalendarioAberto, setModalCalendarioAberto] = useState(false);
  const [estoque, setEstoque] = useState([]);
  const [configEmpresa, setConfigEmpresa] = useState({});
  const [clientesObjMap, setClientesObjMap] = useState({});

  // 🛫🛬 MODAL DE CHECK-IN DE IDA E VOLTA
  const [modalCheckinAberta, setModalCheckinAberta] = useState(false);
  const [locacaoCheckin, setLocacaoCheckin] = useState(null);
  const [modoCheckin, setModoCheckin] = useState('IDA');

  const abrirCheckin = (loc, modo) => {
    setMenuAberto(null);
    if (modo === 'volta' || modo === 'VOLTA') {
      navigate(`/checkout/${loc.id}`);
    } else {
      navigate(`/checkin/${loc.id}/ida`);
    }
  };

  // Fecha o menu suspenso de ações ao clicar em qualquer lugar da tela
  useEffect(() => {
    const handleFecharMenuGlobal = () => setMenuAberto(null);
    window.addEventListener('click', handleFecharMenuGlobal);
    return () => window.removeEventListener('click', handleFecharMenuGlobal);
  }, []);

  // 👁️ PREVIEW AO PAIRAR
  const [hoveredPedido, setHoveredPedido] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  // 🏷️ MODAL DE TIPO DE EVENTO
  const [modalEvento, setModalEvento] = useState(null);

  const [modalPagamento, setModalPagamento] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [pagamento, setPagamento] = useState({ 
    valor: '', 
    formaPagto: 'Pix', 
    data: new Date().toISOString().split('T')[0],
    comprovanteNome: '',
    comprovantePreview: ''
  });
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // 📲 DISPARO RÁPIDO VIA WHATSAPP DO PEDIDO
  const enviarWhatsAppPedido = (pedido) => {
    const tel = (pedido.clienteCelular || pedido.celular || pedido.telefone || '').replace(/\D/g, '');
    const nome = (pedido.clienteNome || 'Cliente').split(' ')[0];
    const num = pedido.numeroPedido || (pedido.id ? pedido.id.substring(0, 6).toUpperCase() : 'S/N');
    const total = Number(pedido.valorTotal || pedido.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const dataEv = pedido.dataRetirada ? new Date(pedido.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir';
    
    let msg = `Olá, *${nome}*! Tudo bem? 😊\n\nPassando para confirmar os detalhes do seu pedido *#${num}* na Celebre Festas:\n\n📅 *Data do Evento:* ${dataEv}\n💰 *Valor Total:* R$ ${total}\n\nQualquer dúvida estamos à disposição! 🎈✨`;
    
    if (tel) {
      window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      alert("Telefone/WhatsApp do cliente não encontrado.");
    }
  };

  // 🖨️ IMPRESSÃO DE RECIBO / COMPROVANTE DO PEDIDO EM PDF
  const imprimirComprovante = (pedido) => {
    const num = pedido.numeroPedido || (pedido.id ? pedido.id.substring(0, 6).toUpperCase() : 'S/N');
    const cliente = pedido.clienteNome || 'Cliente';
    const dataEv = pedido.dataRetirada ? new Date(pedido.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data';
    const dataDev = pedido.dataDevolucao ? new Date(pedido.dataDevolucao + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data';
    const itens = pedido.carrinho || pedido.itens || [];
    const total = Number(pedido.valorTotal || pedido.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const pago = Number(pedido.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const saldo = (Number(pedido.valorTotal || pedido.total || 0) - Number(pedido.valorPago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo - Pedido #${num}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #0f172a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #c5a059; padding-bottom: 15px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: 900; color: #c5a059; letter-spacing: 1px; }
            .title { font-size: 18px; font-weight: bold; text-align: right; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .table th { background: #0f172a; color: #fff; padding: 10px; font-size: 12px; text-transform: uppercase; text-align: left; }
            .table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .totals { margin-left: auto; width: 280px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
            .totals-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .totals-row.total { font-weight: 900; font-size: 18px; color: #c5a059; border-top: 1px solid #cbd5e1; padding-top: 8px; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">CELEBRE FESTAS</div>
            <div class="title">COMPROVANTE DE LOCAÇÃO<br><small style="color: #64748b; font-size: 12px;">Pedido #${num}</small></div>
          </div>
          <div class="info-grid">
            <div><strong>Cliente:</strong> ${cliente}</div>
            <div><strong>Serviço:</strong> ${pedido.tipoServicoFormatado || 'Locação'}</div>
            <div><strong>Data Retirada/Evento:</strong> ${dataEv}</div>
            <div><strong>Data Devolução:</strong> ${dataDev}</div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Item / Peça</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Unitário</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itens.length > 0 ? itens.map(i => `
                <tr>
                  <td>${i.nome || i.titulo || 'Item'}</td>
                  <td style="text-align: center;">${i.qtd || 1}</td>
                  <td style="text-align: right;">R$ ${Number(i.preco || 0).toFixed(2)}</td>
                  <td style="text-align: right;">R$ ${(Number(i.preco || 0) * Number(i.qtd || 1)).toFixed(2)}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center;">Locação Registrada</td></tr>'}
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-row"><span>Valor Total:</span> <strong>R$ ${total}</strong></div>
            <div class="totals-row"><span>Valor Pago:</span> <span>R$ ${pago}</span></div>
            <div class="totals-row total"><span>Saldo Restante:</span> <span>R$ ${saldo}</span></div>
          </div>
          <div class="footer">Obrigado pela preferência! Celebre Festas - Eventos & Locações</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    if (location.state && location.state.buscarPedidoId) {
      const idCurto = location.state.buscarPedidoId.substring(0, 6);
      setBusca(idCurto);
    }
    carregarLocacoes();
  }, [location, usuarioLogado, tenantId]);

  const carregarLocacoes = async () => {
    if (!usuarioLogado) return;
    setLoading(true);
    
    try {
      // 🎯 BUSCA DADOS DA EMPRESA EM PARALELO
      const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));
      const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
      const docConfigRef = doc(db, "configuracoes_empresa", tenantId);

      const [clientesSnapshot, snapEstoque, querySnapshot, docConf] = await Promise.all([
        getDocs(qClientes),
        getDocs(qEstoque),
        getDocs(qLocacoes),
        getDoc(docConfigRef)
      ]);

      const dicionarioClientes = {};
      const mapaObjetosClientes = {};
      clientesSnapshot.forEach(d => {
          const cData = d.data();
          const nomeC = cData.nome || cData.nomeFantasia || cData.razaoSocial || cData.nomeCompleto || "Sem Nome";
          dicionarioClientes[d.id] = nomeC;
          mapaObjetosClientes[d.id] = { id: d.id, ...cData };
      });
      setClientesObjMap(mapaObjetosClientes);

      setEstoque(snapEstoque.docs.map(d => ({ id: d.id, ...d.data() })));
      if (docConf.exists()) setConfigEmpresa(docConf.data());

      const hojeStr = new Date().toISOString().split('T')[0];

      const dados = querySnapshot.docs.map(doc => {
        const data = doc.data();

        let nomeDoClienteReal = data.clienteNome || data.nomeCliente || "Cliente";
        const idSalvo = data.clienteId || data.idCliente || (typeof data.cliente === 'string' ? data.cliente : null);

        if (idSalvo && dicionarioClientes[idSalvo]) {
            nomeDoClienteReal = dicionarioClientes[idSalvo];
        } else if (data.cliente && typeof data.cliente === 'object') {
            nomeDoClienteReal = data.cliente.nome || data.cliente.nomeFantasia || nomeDoClienteReal;
        }

        let tipoServico = "DECORAÇÃO";
        if (data.tipoServico || data.tipoDaFesta || data.modalidade) {
           tipoServico = String(data.tipoServico || data.tipoDaFesta || data.modalidade).toUpperCase();
        } else if (data.logistica && String(data.logistica.tipoFrete || data.logistica.frete).toUpperCase().includes('RETIRADA')) {
           tipoServico = "PEGUE E MONTE";
        }
        
        let timestampCriacao = 0;
        if (data.criadoEm) {
            timestampCriacao = data.criadoEm.toMillis ? data.criadoEm.toMillis() : new Date(data.criadoEm).getTime();
        }

        let statusReal = String(data.status || '').toLowerCase().trim();
        let isVencido = false;

        if (data.dataRetirada && data.dataRetirada < hojeStr) {
            if (statusReal.includes('orcam') || statusReal.includes('confirmado') || statusReal.includes('preparacao')) {
                isVencido = true;
            }
        }

        return { 
            id: doc.id, 
            ...data, 
            status: statusReal, 
            isOrcamentoVencido: isVencido,
            clienteNome: nomeDoClienteReal, 
            tipoServicoFormatado: tipoServico, 
            createdAtMs: timestampCriacao 
        };
      });

      setLista(dados);
    } catch (error) { 
        console.error(error);
    } finally { 
        setLoading(false); 
    }
  };

  const handleExcluir = async (id) => {
    if (window.confirm("Apagar pedido definitivamente?")) {
      try {
        const pedidoParaExcluir = lista.find(i => i.id === id);
        await deleteDoc(doc(db, "locacoes", id));
        setLista(lista.filter(i => i.id !== id));

        // 🔥 INÍCIO DO ESPIÃO (EXCLUSÃO DE PEDIDO) 🔥
        if (pedidoParaExcluir) {
          try {
            await addDoc(collection(db, "logs_atividades"), {
              empresaId: tenantId, 
              funcionarioId: usuarioLogado.uid,
              nomeFuncionario: localStorage.getItem('funcName') || usuarioLogado.displayName || usuarioLogado.email || "Equipe",
              acao: "EXCLUSÃO DE PEDIDO",
              tipo: "EXCLUSAO",
              detalhes: `Excluiu permanentemente o pedido #${pedidoParaExcluir.numeroPedido || id.substring(0,6).toUpperCase()} do cliente ${pedidoParaExcluir.clienteNome}`,
              dataHora: new Date().toISOString()
            });
          } catch (errorEspiao) {
            console.error("Erro no espião de exclusão:", errorEspiao);
          }
        }
        // 🔥 FIM DO ESPIÃO 🔥

      } catch (error) {
        alert("Erro ao excluir.");
      }
    }
  };

  // 📎 MANIPULADOR DE COMPROVANTE DE PAGAMENTO COM COMPRESSÃO AUTOMÁTICA DE IMAGEM
  const handleFileComprovante = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("⚠️ O arquivo deve ter no máximo 10MB.");
      return;
    }

    if (file.type.startsWith('image/')) {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800; // Redimensiona para no máximo 800px para caber com folga no Firestore (< 60kb)
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Converte para JPEG ultra leve (qualidade 0.65 -> ~40kb)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
          setPagamento(prev => ({
            ...prev,
            comprovanteNome: file.name,
            comprovantePreview: compressedDataUrl
          }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      // Arquivo PDF ou documento
      const reader = new FileReader();
      reader.onloadend = () => {
        setPagamento(prev => ({
          ...prev,
          comprovanteNome: file.name,
          comprovantePreview: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const registrarPagamento = async (e) => {
    e.preventDefault();
    if (!pagamento.valor || Number(pagamento.valor) <= 0) {
      alert("Por favor, digite um valor válido.");
      return;
    }
    setSalvandoPagamento(true);
    
    try {
      const novoValorPago = Number(pedidoSelecionado.valorPago || 0) + Number(pagamento.valor);
      await updateDoc(doc(db, "locacoes", pedidoSelecionado.id), { 
        valorPago: novoValorPago,
        ultimoComprovanteUrl: pagamento.comprovantePreview || null,
        ultimoComprovanteNome: pagamento.comprovanteNome || null
      });
      
      // 🎯 CAIXA DA EMPRESA
      await addDoc(collection(db, "financeiro_lancamentos"), {
        tipo: 'entrada', 
        categoria: 'Locação', 
        valor: Number(pagamento.valor), 
        formaPagto: pagamento.formaPagto,
        data: pagamento.data, 
        status: 'pago', 
        comprovanteUrl: pagamento.comprovantePreview || null,
        comprovanteNome: pagamento.comprovanteNome || null,
        createdAt: serverTimestamp(),
        descricao: `Ref. Pedido #${pedidoSelecionado.numeroPedido || (pedidoSelecionado.id ? pedidoSelecionado.id.substring(0,6) : 'S/N')} - ${pedidoSelecionado.clienteNome}`,
        userId: tenantId 
      });

      // 🔥 INÍCIO DO ESPIÃO (REGISTRO DE PAGAMENTO) 🔥
      try {
        await addDoc(collection(db, "logs_atividades"), {
          empresaId: tenantId, 
          funcionarioId: usuarioLogado.uid,
          nomeFuncionario: localStorage.getItem('funcName') || usuarioLogado.displayName || usuarioLogado.email || "Equipe",
          acao: "REGISTRO DE PAGAMENTO",
          tipo: "EDICAO",
          detalhes: `Registrou entrada de R$ ${Number(pagamento.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})} via ${pagamento.formaPagto} no pedido #${pedidoSelecionado.numeroPedido || pedidoSelecionado.id.substring(0,6).toUpperCase()} (${pedidoSelecionado.clienteNome})`,
          dataHora: new Date().toISOString()
        });
      } catch (errorEspiao) {
        console.error("Erro no espião de pagamento:", errorEspiao);
      }
      // 🔥 FIM DO ESPIÃO 🔥

      alert("Recebido com sucesso!");
      carregarLocacoes();
      setModalPagamento(false);
    } catch (e) { 
      console.error("Erro ao registrar pagamento:", e);
      alert(`Erro ao salvar pagamento: ${e.message || 'Erro desconhecido'}`);
    } finally { 
      setSalvandoPagamento(false); 
    }
  };

  let filtrados = [...lista];

  if (busca) {
    const termo = busca.toLowerCase();
    filtrados = filtrados.filter(i => {
      const nomeMatch = (i.clienteNome || '').toLowerCase().includes(termo);
      const numeroAppMatch = (i.numeroPedido || '').includes(termo);
      const idRealMatch = (i.id || '').toLowerCase().includes(termo); 
      return nomeMatch || numeroAppMatch || idRealMatch;
    });
  }

  if (filtroDataEvento) {
      filtrados = filtrados.filter(i => i.dataRetirada === filtroDataEvento);
  }

  if (filtroPeriodo === 'hoje') {
    const hojeStr = new Date().toISOString().split('T')[0];
    filtrados = filtrados.filter(i => i.dataRetirada === hojeStr || i.dataEvento === hojeStr);
  } else if (filtroPeriodo === 'fimsemana') {
    const hojeObj = new Date();
    const diaSemana = hojeObj.getDay();
    const sabadoObj = new Date(hojeObj);
    sabadoObj.setDate(hojeObj.getDate() + (6 - diaSemana));
    const domingoObj = new Date(hojeObj);
    domingoObj.setDate(hojeObj.getDate() + (7 - diaSemana));
    const sabStr = sabadoObj.toISOString().split('T')[0];
    const domStr = domingoObj.toISOString().split('T')[0];
    filtrados = filtrados.filter(i => (i.dataRetirada >= sabStr && i.dataRetirada <= domStr));
  } else if (filtroPeriodo === 'mes') {
    const mesAnoAtual = new Date().toISOString().split('T')[0].substring(0, 7);
    filtrados = filtrados.filter(i => (i.dataRetirada || '').startsWith(mesAnoAtual));
  }

  // 🚨 CÁLCULO DAS DATAS E FILTRO OPERACIONAL DO DIA
  const hojeStr = new Date().toISOString().split('T')[0];

  const saemHojeCount = lista.filter(i => {
    const st = String(i.status || '').toLowerCase();
    if (st.includes('cancelado') || st.includes('finalizado') || i.isOrcamentoVencido) return false;
    return i.dataRetirada === hojeStr || i.dataEvento === hojeStr;
  }).length;

  const entramHojeCount = lista.filter(i => {
    const st = String(i.status || '').toLowerCase();
    if (st.includes('cancelado') || st.includes('finalizado') || i.isOrcamentoVencido) return false;
    return i.dataDevolucao === hojeStr;
  }).length;

  const atrasadosCount = lista.filter(i => {
    const st = String(i.status || '').toLowerCase();
    if (st.includes('cancelado') || st.includes('finalizado') || i.isOrcamentoVencido) return false;
    return i.dataDevolucao && i.dataDevolucao < hojeStr;
  }).length;

  if (filtroOperacao === 'saem_hoje') {
    filtrados = filtrados.filter(i => {
      const st = String(i.status || '').toLowerCase();
      if (st.includes('cancelado') || st.includes('finalizado') || i.isOrcamentoVencido) return false;
      return i.dataRetirada === hojeStr || i.dataEvento === hojeStr;
    });
  } else if (filtroOperacao === 'entram_hoje') {
    filtrados = filtrados.filter(i => {
      const st = String(i.status || '').toLowerCase();
      if (st.includes('cancelado') || st.includes('finalizado') || i.isOrcamentoVencido) return false;
      return i.dataDevolucao === hojeStr;
    });
  } else if (filtroOperacao === 'atrasados') {
    filtrados = filtrados.filter(i => {
      const st = String(i.status || '').toLowerCase();
      if (st.includes('cancelado') || st.includes('finalizado') || i.isOrcamentoVencido) return false;
      return i.dataDevolucao && i.dataDevolucao < hojeStr;
    });
  }

  if (filtroStatus === 'todos') {
      filtrados = filtrados.filter(i => {
          const st = String(i.status || '').toLowerCase();
          return !st.includes('cancelado') && !st.includes('finalizado') && !i.isOrcamentoVencido;
      });
  } else if (filtroStatus === 'orcamentos') {
      filtrados = filtrados.filter(i => {
          const st = String(i.status || '').toLowerCase();
          return st.includes('orcam') && !i.isOrcamentoVencido;
      });
  } else if (filtroStatus === 'confirmados') {
      filtrados = filtrados.filter(i => {
          const st = String(i.status || '').toLowerCase();
          return !st.includes('orcam') && !st.includes('cancelado') && !st.includes('finalizado') && !i.isOrcamentoVencido;
      });
  } else if (filtroStatus === 'finalizados') {
      filtrados = filtrados.filter(i => {
          const st = String(i.status || '').toLowerCase();
          return st.includes('finalizado');
      });
  } else if (filtroStatus === 'cancelados') {
      filtrados = filtrados.filter(i => {
          const st = String(i.status || '').toLowerCase();
          return st.includes('cancelado') || i.isOrcamentoVencido;
      });
  }

  if (filtroServico === 'pegue') {
      filtrados = filtrados.filter(i => i.tipoServicoFormatado.includes('PEGUE'));
  } else if (filtroServico === 'decoracao') {
      filtrados = filtrados.filter(i => !i.tipoServicoFormatado.includes('PEGUE'));
  }

  filtrados.sort((a, b) => {
    const getPriority = (item) => {
        const st = String(item.status || '').toLowerCase();
        if (st.includes('cancelado') || item.isOrcamentoVencido) return 3; 
        if (st.includes('finalizado')) return 2; 
        return 1; 
    };

    const pA = getPriority(a);
    const pB = getPriority(b);

    if (pA !== pB) return pA - pB;

    if (filtroOrdenacao === 'proximos') {
      const dataA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 9999999999999;
      const dataB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 9999999999999;
      return dataA - dataB;
    } else if (filtroOrdenacao === 'maiorValor') {
      return Number(b.valorTotal || 0) - Number(a.valorTotal || 0);
    } else {
      return b.createdAtMs - a.createdAtMs; 
    }
  });

  // Helper function for golden avatars matching Clientes page
  const getInitials = (name = 'Cliente') => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'C';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // KPIs Calculations
  const countAtivos = lista.filter(i => {
    const s = String(i.status || '').toLowerCase();
    return !s.includes('orcam') && !s.includes('cancelado') && !s.includes('finalizado') && !i.isOrcamentoVencido;
  }).length;

  const countOrcamentos = lista.filter(i => 
    String(i.status || '').toLowerCase().includes('orcam') && !i.isOrcamentoVencido
  ).length;

  const countConfirmados = lista.filter(i => {
    const s = String(i.status || '').toLowerCase();
    return (s.includes('confirmado') || s.includes('preparacao') || s.includes('entregue')) && !s.includes('cancelado') && !i.isOrcamentoVencido;
  }).length;

  const totalAReceber = lista.filter(i => {
    const s = String(i.status || '').toLowerCase();
    return !s.includes('cancelado') && !i.isOrcamentoVencido;
  }).reduce((acc, i) => acc + Math.max(0, Number(i.valorTotal || 0) - Number(i.valorPago || 0)), 0);

  // Chips count
  const chipCountEmProcesso = countAtivos;
  const chipCountOrcamentos = countOrcamentos;
  const chipCountConfirmados = countConfirmados;
  const chipCountArquivados = lista.filter(i => String(i.status || '').toLowerCase().includes('finalizado')).length;
  const chipCountCancelados = lista.filter(i => String(i.status || '').toLowerCase().includes('cancelado') || i.isOrcamentoVencido).length;

  // 📈 TAXA DE CONVERSÃO
  const totalParaConversao = countAtivos + countOrcamentos;
  const taxaConversao = totalParaConversao > 0 ? Math.round((countAtivos / totalParaConversao) * 100) : 0;

  // 🏷️ SALVAR TIPO DE EVENTO
  const salvarTipoEvento = async (tipoValue) => {
      if (!modalEvento) return;
      try {
          await updateDoc(doc(db, 'locacoes', modalEvento.id), { tipoEvento: tipoValue || null });
          setLista(prev => prev.map(i => i.id === modalEvento.id ? { ...i, tipoEvento: tipoValue || null } : i));
          setModalEvento(null);
      } catch (e) { alert('Erro ao salvar tipo de evento.'); }
  };

  return (
    <div className="locacoes-container dashboard-container fade-in">
      {/* HERO CABEÇALHO (IDÊNTICO AO DA PÁGINA CLIENTES) */}
      <header className="clientes-hero-header">
        <div className="welcome-text">
          <div className="header-title-row">
            <span className="header-icon-badge"><i className="fas fa-boxes"></i></span>
            <div>
              <h1>Gestão de Locações</h1>
              <p>Gestão de pedidos, datas e recebimentos.</p>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn-primary-celebre" 
            onClick={() => navigate('/locacoes/nova')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
          >
            + NOVA LOCAÇÃO
          </button>
          <button 
            className="btn-secundario-alerta" 
            onClick={() => setModalCalendarioAberto(true)}
            title="Ver Matriz de Disponibilidade do Acervo"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
          >
            📅 DISPONIBILIDADE
          </button>
        </div>
      </header>

      {/* CARDS DE DASHBOARD (KPIs 4 COLUNAS NA MESMA LINHA - IDÊNTICO A CLIENTES) */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro border-green">
          <div className="stat-icon-wrapper icon-green">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">LOCAÇÕES ATIVAS</span>
            <span className="stat-value">{countAtivos}</span>
            <span className="stat-sub">Em andamento / preparação</span>
          </div>
        </div>

        <div className="stat-card-pro border-amber">
          <div className="stat-icon-wrapper icon-amber">
            <i className="fas fa-folder"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">ORÇAMENTOS FUTUROS</span>
            <span className="stat-value">{countOrcamentos}</span>
            <span className="stat-sub">Aguardando confirmação</span>
          </div>
        </div>

        <div className="stat-card-pro border-red">
          <div className="stat-icon-wrapper icon-red">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">TOTAL A RECEBER</span>
            <span className="stat-value">R$ {totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="stat-sub">Saldo pendente em aberto</span>
          </div>
        </div>

        <div className="stat-card-pro border-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-gem"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">CONFIRMADOS / CONTRATADOS</span>
            <span className="stat-value">{countConfirmados}</span>
            <span className="stat-sub">Festas garantidas no calendário</span>
          </div>
        </div>
      </div>

      {/* 📈 TAXA DE CONVERSÃO */}
      {totalParaConversao > 0 && (
        <div className="conversao-strip">
          <div className="conversao-left">
            <span className="conversao-strip-icon">📈</span>
            <div className="conversao-strip-text">
              <span className="conversao-strip-title">TAXA DE CONVERSÃO</span>
              <span className="conversao-strip-sub">{countAtivos} confirmados de {totalParaConversao} ativos</span>
            </div>
          </div>
          <div className="conversao-strip-center">
            <div className="conversao-strip-barra">
              <div className="conversao-strip-fill" style={{ width: `${taxaConversao}%` }} />
            </div>
          </div>
          <div className="conversao-strip-right">
            <strong className="conversao-strip-pct">{taxaConversao}%</strong>
            <span className="conversao-strip-desc">
              {taxaConversao >= 70 ? '🔥 Excelente' : taxaConversao >= 40 ? '👍 Bom ritmo' : '📊 Crescendo'}
            </span>
          </div>
        </div>
      )}

      {/* PAINEL DE FILTROS E BUSCA AVANÇADA */}
      <div className="advanced-filter-bar">
        {/* LINHA 1: BUSCA + CHIPS OPERACIONAIS DO DIA */}
        <div className="filter-row-top">
          <div className="search-input-box">
            <i className="fas fa-search search-box-icon"></i>
            <input 
              type="text" 
              placeholder="Buscar por cliente, pedido, CPF..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
              className="search-input-field"
            />
            {busca && (
              <button type="button" className="btn-clear-input" onClick={() => setBusca('')} title="Limpar busca">
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          <div className="operacao-chips-grid">
            <button 
              type="button" 
              className={`chip-operacao gold ${filtroOperacao === 'saem_hoje' ? 'active' : ''}`}
              onClick={() => setFiltroOperacao(filtroOperacao === 'saem_hoje' ? 'todos' : 'saem_hoje')}
              title="Filtrar pedidos com saída/retirada para hoje"
            >
              🚚 SAEM HOJE <span className="chip-badge gold">{saemHojeCount}</span>
            </button>

            <button 
              type="button" 
              className={`chip-operacao emerald ${filtroOperacao === 'entram_hoje' ? 'active' : ''}`}
              onClick={() => setFiltroOperacao(filtroOperacao === 'entram_hoje' ? 'todos' : 'entram_hoje')}
              title="Filtrar pedidos com devolução para hoje"
            >
              📦 ENTRAM HOJE <span className="chip-badge emerald">{entramHojeCount}</span>
            </button>

            <button 
              type="button" 
              className={`chip-operacao rose ${filtroOperacao === 'atrasados' ? 'active' : ''} ${atrasadosCount > 0 ? 'pulse' : ''}`}
              onClick={() => setFiltroOperacao(filtroOperacao === 'atrasados' ? 'todos' : 'atrasados')}
              title="Filtrar pedidos com devolução atrasada"
            >
              ⚠️ ATRASADOS <span className={`chip-badge rose ${atrasadosCount > 0 ? 'alert' : ''}`}>{atrasadosCount}</span>
            </button>

            {filtroOperacao !== 'todos' && (
              <button 
                type="button" 
                className="chip-operacao-limpar"
                onClick={() => setFiltroOperacao('todos')}
                title="Limpar filtro operacional"
              >
                ✕ Ver Todos
              </button>
            )}
          </div>
        </div>

        {/* NÍVEL 2: PÍLULAS DE STATUS 100% APARENTES (SEM BARRA DE ROLAGEM) */}
        <div className="filter-pills-grid">
          <button type="button" className={`pill-btn ${filtroStatus === 'todos' ? 'active' : ''}`} onClick={() => setFiltroStatus('todos')}>
            Em Processo <span className="pill-badge">{chipCountEmProcesso}</span>
          </button>
          <button type="button" className={`pill-btn ${filtroStatus === 'orcamentos' ? 'active' : ''}`} onClick={() => setFiltroStatus('orcamentos')}>
            Orçamentos <span className="pill-badge">{chipCountOrcamentos}</span>
          </button>
          <button type="button" className={`pill-btn ${filtroStatus === 'confirmados' ? 'active' : ''}`} onClick={() => setFiltroStatus('confirmados')}>
            Confirmados <span className="pill-badge">{chipCountConfirmados}</span>
          </button>
          <button type="button" className={`pill-btn ${filtroStatus === 'finalizados' ? 'active' : ''}`} onClick={() => setFiltroStatus('finalizados')}>
            Arquivados <span className="pill-badge">{chipCountArquivados}</span>
          </button>
          <button type="button" className={`pill-btn ${filtroStatus === 'cancelados' ? 'active' : ''}`} onClick={() => setFiltroStatus('cancelados')}>
            Lixeira / Perdidos <span className="pill-badge">{chipCountCancelados}</span>
          </button>
        </div>

        {/* NÍVEL 3: SUB-FILTROS DE DATA, PERÍODO, SERVIÇO E ORDENAÇÃO */}
        <div className="filter-sub-grid">
          <div className="date-input-wrapper">
            <input 
              type="date" 
              value={filtroDataEvento} 
              onChange={e => setFiltroDataEvento(e.target.value)} 
              className="select-pill-filter"
              title="Filtrar por data do evento"
            />
            {filtroDataEvento && (
              <button 
                type="button"
                onClick={() => setFiltroDataEvento('')} 
                className="btn-clear-search-date"
                title="Limpar Data"
              >
                ✕
              </button>
            )}
          </div>

          <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className="select-pill-filter">
            <option value="todos">🗓️ Período: Todos</option>
            <option value="hoje">📅 Eventos de Hoje</option>
            <option value="fimsemana">🎉 Fim de Semana</option>
            <option value="mes">📅 Este Mês</option>
          </select>

          <select value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)} className="select-pill-filter">
            <option value="todos">🔧 Serviço: Todos</option>
            <option value="pegue">📦 Pegue e Monte</option>
            <option value="decoracao">✨ Decoração</option>
          </select>

          <select value={filtroOrdenacao} onChange={(e) => setFiltroOrdenacao(e.target.value)} className="select-pill-filter">
            <option value="recentes">🌟 Mais Recentes</option>
            <option value="proximos">📅 Eventos Próximos</option>
            <option value="maiorValor">💰 Maior Valor</option>
            <option value="menorValor">📉 Menor Valor</option>
          </select>
        </div>
      </div>

      {/* TABELA DE PEDIDOS (ESTILO CLIENTES) */}
      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>PEDIDO</th>
              <th>CLIENTE / SERVIÇO</th>
              <th>DATA EVENTO</th>
              <th>VALOR TOTAL</th>
              <th>A RECEBER</th>
              <th>STATUS</th>
              <th width="50px"></th>
            </tr>
          </thead>
          <tbody>
            
            {loading && (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  Carregando locações...
                </td>
              </tr>
            )}

            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  Nenhum pedido encontrado nesta filtragem.
                </td>
              </tr>
            )}

            {!loading && filtrados.length > 0 && filtrados.map(item => {
                const valorTotal = Number(item.valorTotal || 0);
                const valorPago = Number(item.valorPago || 0);
                const saldoDevedor = valorTotal - valorPago;
                const statusStr = String(item.status || '').toLowerCase();
                const isCancelado = statusStr.includes('cancelado') || item.isOrcamentoVencido;
                const isOrcamento = statusStr.includes('orcam'); 
                
                const temAvaria = item.itens?.some(i => i.avaria);
                const temFalta = item.itens?.some(i => i.faltou);
                const temAlertas = temAvaria || temFalta;

                const initials = getInitials(item.clienteNome);
                const tipoEventoInfo = item.tipoEvento ? TIPOS_EVENTO.find(t => t.value === item.tipoEvento) : null;

                let alertaOperacional = null;
                let corAlerta = '';
                
                if (item.dataRetirada && !statusStr.includes('finalizado') && !statusStr.includes('cancelado') && !item.isOrcamentoVencido) {
                    const hojeObj = new Date();
                    hojeObj.setHours(0,0,0,0);
                    const locDateObj = new Date(item.dataRetirada + 'T00:00:00');
                    const devDateObj = item.dataDevolucao ? new Date(item.dataDevolucao + 'T00:00:00') : locDateObj;
                    const diffMs = locDateObj.getTime() - hojeObj.getTime();
                    const diasParaFesta = Math.ceil(diffMs / (1000 * 3600 * 24));
                    
                    if (statusStr.includes('confirmado') && diasParaFesta <= 4 && diasParaFesta >= 0) {
                        alertaOperacional = `📦 Separar Peças! (${diasParaFesta === 0 ? 'É Hoje!' : `Faltam ${diasParaFesta} dias`})`; 
                        corAlerta = "#f59e0b";
                    } else if (statusStr.includes('preparacao') && diasParaFesta <= 0) {
                        alertaOperacional = "🚚 Entregar Hoje!";
                        corAlerta = "#ef4444"; 
                    } else if (statusStr.includes('entregue') && devDateObj.getTime() <= hojeObj.getTime()) {
                        alertaOperacional = "⏳ Cobrar Devolução!";
                        corAlerta = "#ef4444"; 
                    }

                    // 🛠️ ALERTA CRÍTICO: VERIFICAR SE O PEDIDO CONTÉM PEÇAS EM REPARO/MANUTENÇÃO NO PERÍODO DA FESTA
                    const pecasEmManutencaoNoPedido = [];
                    (item.itens || item.carrinho || []).forEach(it => {
                      const pecaEstoque = (estoque || []).find(p => String(p.id) === String(it.id) || (p.codigo && p.codigo === it.codigo) || (p.nome && it.nome && p.nome.trim().toLowerCase() === it.nome.trim().toLowerCase()));
                      if (pecaEstoque) {
                        const emMaint = pecaEstoque.qtdManutencao !== undefined ? Number(pecaEstoque.qtdManutencao) : (pecaEstoque.status === 'manutencao' ? Number(pecaEstoque.quantidade || 1) : 0);
                        if (emMaint > 0) {
                          const dataProntidao = pecaEstoque.dataPrevisaoRetorno;
                          if (!dataProntidao || dataProntidao >= item.dataRetirada) {
                            pecasEmManutencaoNoPedido.push({ nome: pecaEstoque.nome, dataProntidao });
                          }
                        }
                      }

                      const pecasCompostas = it.itensDecoracao || it.itensDoKit || it.pecasKit || it.especificacoes?.itensDecoracao || it.especificacoes?.itensDoKit || it.especificacoes?.pecasKit || [];
                      pecasCompostas.forEach(p => {
                        const pecaCompEstoque = (estoque || []).find(pe => String(pe.id) === String(p.id) || (pe.codigo && pe.codigo === p.codigo) || (pe.nome && p.nome && pe.nome.trim().toLowerCase() === p.nome.trim().toLowerCase()));
                        if (pecaCompEstoque) {
                          const emMaint = pecaCompEstoque.qtdManutencao !== undefined ? Number(pecaCompEstoque.qtdManutencao) : (pecaCompEstoque.status === 'manutencao' ? Number(pecaCompEstoque.quantidade || 1) : 0);
                          if (emMaint > 0) {
                            const dataProntidao = pecaCompEstoque.dataPrevisaoRetorno;
                            if (!dataProntidao || dataProntidao >= item.dataRetirada) {
                              if (!pecasEmManutencaoNoPedido.some(pm => pm.nome === pecaCompEstoque.nome)) {
                                pecasEmManutencaoNoPedido.push({ nome: pecaCompEstoque.nome, dataProntidao });
                              }
                            }
                          }
                        }
                      });
                    });

                    if (pecasEmManutencaoNoPedido.length > 0) {
                      const p1 = pecasEmManutencaoNoPedido[0];
                      alertaOperacional = `🚨 REPARO PENDENTE! (${p1.nome}${p1.dataProntidao ? ` até ${p1.dataProntidao.split('-').reverse().join('/')}` : ' sem data'})`;
                      corAlerta = "#dc2626";
                    }
                }

                return (
                  <tr 
                    key={item.id} 
                    className={temAlertas ? 'linha-alerta' : ''} 
                    style={{ opacity: isCancelado ? 0.6 : 1, cursor: 'pointer' }}
                    onClick={() => navigate(`/locacoes/editar/${item.id}`)}
                    title="Clique para abrir detalhes do pedido"
                  >
                    <td className="pedido-id-cell">
                      <div className="mobile-card-header-row">
                        <span 
                          className="pedido-id-text"
                          onMouseEnter={(e) => { setHoveredPedido(item); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                          onMouseLeave={() => setHoveredPedido(null)}
                          onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                        >
                          {item.numeroPedido ? (
                            `#${item.numeroPedido}`
                          ) : item.id ? (
                            `#${item.id.substring(0,6).toUpperCase()}`
                          ) : item.isOrcamentoVencido ? (
                            <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '11px' }}>PERDIDO</span>
                          ) : isOrcamento ? (
                            <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '11px' }}>ORÇAMENTO</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>#S/N</span>
                          )}
                        </span>

                        <div className="mobile-header-status-badge">
                          <span className={`status-pill-v2 ${item.isOrcamentoVencido ? 'cancelado' : statusStr.replace(/\s+/g, '')}`}>
                            {item.isOrcamentoVencido ? 'PERDIDO' : item.status?.trim().toUpperCase() || 'S/S'}
                          </span>
                        </div>

                        <div 
                          className="dropdown-container mobile-top-menu"
                          onMouseEnter={(e) => { e.stopPropagation(); setHoveredPedido(null); }}
                          onMouseLeave={(e) => e.stopPropagation()}
                        >
                          <button 
                            type="button"
                            className="btn-pontinhos" 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setHoveredPedido(null);
                              setMenuAberto(menuAberto === item.id ? null : item.id); 
                            }}
                            title="Opções do pedido"
                          >
                            ⋮
                          </button>
                          
                          {menuAberto === item.id && (
                            <div className="menu-suspenso animate-pop" onClick={(e) => e.stopPropagation()}>
                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  enviarWhatsAppPedido(item);
                                  setMenuAberto(null);
                                }} 
                                className="item-menu"
                              >
                                <span className="item-icon green">💬</span> Enviar por WhatsApp
                              </button>

                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  imprimirComprovante(item);
                                  setMenuAberto(null);
                                }} 
                                className="item-menu"
                              >
                                <span className="item-icon gold">🖨️</span> Imprimir Recibo
                              </button>

                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setModalPagamento(item);
                                  setMenuAberto(null);
                                }} 
                                className="item-menu"
                              >
                                <span className="item-icon emerald">💳</span> Registrar Pagamento
                              </button>

                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setModalRomaneioPedido(item);
                                  setMenuAberto(null);
                                }} 
                                className="item-menu"
                              >
                                <span className="item-icon gold">📋</span> Romaneio & Checklist
                              </button>

                              <div className="menu-divider" />

                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  handleExcluir(item.id);
                                  setMenuAberto(null);
                                }} 
                                className="item-menu item-excluir"
                              >
                                <span className="item-icon red">🗑️</span> Excluir Pedido
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="cliente-info-cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* AVATAR DOURADO PADRÃO CLIENTES */}
                        <div className="avatar-quadrado avatar-letra-gold">
                          {initials}
                        </div>
                        <div>
                          <strong style={{ textDecoration: isCancelado ? 'line-through' : 'none', color: 'var(--texto-principal)', fontSize: '0.94rem', fontWeight: '800' }}>
                            {item.clienteNome}
                          </strong>
                          <div 
                            className="tags-row" 
                            style={{ marginTop: '4px' }}
                            onMouseEnter={(e) => { setHoveredPedido(item); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                            onMouseLeave={() => setHoveredPedido(null)}
                            onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                          >
                            <span className={`tag-servico ${item.tipoServicoFormatado.includes('PEGUE') ? 'pegue' : 'deco'}`}>
                              {item.tipoServicoFormatado}
                            </span>
                            {/* 🏷️ TAG TIPO DE EVENTO */}
                            {tipoEventoInfo ? (
                              <span
                                className="tag-evento"
                                onClick={(e) => { e.stopPropagation(); setModalEvento(item); }}
                                title="Clique para alterar tipo de evento"
                              >
                                {tipoEventoInfo.emoji} {tipoEventoInfo.label}
                              </span>
                            ) : (
                              <button
                                className="btn-add-tipo-evento"
                                onClick={(e) => { e.stopPropagation(); setModalEvento(item); }}
                                title="Definir tipo de evento"
                              >
                                + Evento
                              </button>
                            )}
                            {temFalta && <span className="tag-alerta erro">FALTAM PEÇAS</span>}
                            {temAvaria && <span className="tag-alerta aviso">AVARIAS</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="desktop-only-cell">
                      <span className="mobile-label">DATA EVENTO:</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        {item.dataRetirada ? new Date(item.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </td>
                    
                    {/* DESKTOP COLUNAS SEPARADAS DE VALOR E A RECEBER */}
                    <td className="desktop-only-cell valor-cell">
                      <span className="valor-total" style={{ fontSize: '0.9rem', fontWeight: '800' }}>R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </td>
                    
                    <td className="desktop-only-cell receber-cell">
                      {saldoDevedor > 0 ? (
                        <span className="badge-status-pro devedor">
                          ▲ R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="badge-status-pro ok">
                          ✓ PAGO
                        </span>
                      )}
                    </td>

                    {/* MOBILE PAINEL INTEGRADO EM 2 COLUNAS DE LUXO */}
                    <td className="mobile-only-finance-cell">
                      <div className="mobile-finance-integrated-panel">
                        <div className="mobile-finance-panel-col">
                          <span className="mobile-finance-panel-label">📅 DATA DO EVENTO</span>
                          <span className="mobile-finance-panel-val">
                            {item.dataRetirada ? new Date(item.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                          </span>
                        </div>
                        <div className="mobile-finance-panel-col border-left">
                          <span className="mobile-finance-panel-label">💰 VALOR & STATUS</span>
                          <div className="mobile-finance-panel-val-row">
                            <strong className="valor-total" style={{ fontSize: '0.88rem', fontWeight: '850' }}>
                              R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </strong>
                            {saldoDevedor > 0 ? (
                              <span className="badge-status-pro devedor">
                                ▲ R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="badge-status-pro ok">
                                ✓ PAGO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="status-cell">
                      <span className={`status-pill-v2 ${item.isOrcamentoVencido ? 'cancelado' : statusStr.replace(/\s+/g, '')}`}>
                        {item.isOrcamentoVencido ? 'PERDIDO / ABANDONADO' : item.status?.trim().toUpperCase() || 'S/S'}
                      </span>
                      {alertaOperacional && (
                         <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: '800', color: corAlerta, textTransform: 'uppercase' }}>
                           {alertaOperacional}
                         </div>
                      )}
                    </td>
                  
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="actions-row-cell">
                        {!isOrcamento && !isCancelado && (
                          <>
                            <button 
                              type="button"
                              className="btn-quick-checkin ida"
                              title="Fazer Check-in de Saída (IDA)"
                              onClick={(e) => { e.stopPropagation(); abrirCheckin(item, 'IDA'); }}
                            >
                              🛫 IDA
                            </button>
                            <button 
                              type="button"
                              className="btn-quick-checkin volta"
                              title="Fazer Check-in de Devolução (VOLTA)"
                              onClick={(e) => { e.stopPropagation(); abrirCheckin(item, 'VOLTA'); }}
                            >
                              🛬 VOLTA
                            </button>
                          </>
                        )}

                        <div className="dropdown-container">
                          <button 
                            className="btn-pontinhos" 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setMenuAberto(menuAberto === item.id ? null : item.id); 
                            }}
                          >
                            ⋮
                          </button>
                          
                          {menuAberto === item.id && (
                            <div className="menu-suspenso animate-pop" onClick={(e) => e.stopPropagation()}>
                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  enviarWhatsAppPedido(item);
                                  setMenuAberto(null);
                                }} 
                                className="item-menu"
                              >
                                <span className="item-icon green">💬</span> Enviar por WhatsApp
                              </button>

                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  const cliObj = clientesObjMap[item.clienteId] || {};
                                  gerarPropostaPDF(item, configEmpresa, cliObj, 'preview');
                                  setMenuAberto(null);
                                }} 
                                className="item-menu"
                              >
                                <span className="item-icon gold">📄</span> Proposta PDF (Luxo)
                              </button>

                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  imprimirComprovante(item);
                                  setMenuAberto(null);
                                }} 
                                className="item-menu"
                              >
                                <span className="item-icon slate">🖨️</span> Imprimir Recibo / PDF
                              </button>

                              {item.ultimoComprovanteUrl && (
                                <button 
                                  type="button"
                                  onClick={(e) => { 
                                    e.stopPropagation();
                                    const win = window.open();
                                    if (win) {
                                      win.document.write(`<title>Comprovante - Pedido #${item.numeroPedido || item.id.substring(0,6)}</title><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#0f172a;"><img src="${item.ultimoComprovanteUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
                                    }
                                    setMenuAberto(null);
                                  }} 
                                  className="item-menu"
                                >
                                  <span className="item-icon blue">📎</span> Ver Comprovante
                                </button>
                              )}

                              {saldoDevedor > 0 && !isCancelado && !isOrcamento && (
                                <button 
                                  type="button"
                                  onClick={(e) => { 
                                    e.stopPropagation();
                                    setPedidoSelecionado(item); 
                                    setPagamento({ valor: '', formaPagto: 'Pix', data: new Date().toISOString().split('T')[0] });
                                    setModalPagamento(true); 
                                    setMenuAberto(null); 
                                  }} 
                                  className="item-menu"
                                >
                                  <span className="item-icon emerald">💰</span> Receber Pagamento
                                </button>
                              )}

                              <div className="menu-divider" />

                              {temAlertas && (
                                <button 
                                  type="button"
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    navigate(`/termo-ocorrencia/${item.id}`); 
                                  }} 
                                  className="item-menu"
                                  style={{ color: '#b91c1c' }}
                                >
                                  <span className="item-icon red">⚠️</span> Termo (Avaria/Falta)
                                </button>
                              )}

                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); navigate(`/locacoes/editar/${item.id}`); }} 
                                className="item-menu"
                              >
                                <span className="item-icon slate">✏️</span> Editar Pedido
                              </button>

                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleExcluir(item.id); }} 
                                className="item-menu item-excluir"
                              >
                                <span className="item-icon red">🗑️</span> Excluir Pedido
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DE PAGAMENTO ENTERPRISE LUXURY */}
      {modalPagamento && pedidoSelecionado && (
         <div className="modal-overlay-v2">
            <div className="modal-box-v2 pagamento-box-luxury">
                {/* CABEÇALHO DOURADO */}
                <div className="modal-header-luxury">
                  <div className="header-title-flex">
                    <div className="header-badge-gold">
                      <i className="fas fa-wallet"></i>
                    </div>
                    <div>
                      <h3>Registrar Recebimento</h3>
                      <p>Baixa no caixa da empresa e anexo de comprovante</p>
                    </div>
                  </div>
                  <button type="button" className="btn-fechar-modal" onClick={() => setModalPagamento(false)}>✕</button>
                </div>

                {/* BANNER DO CLIENTE E SALDO PENDENTE */}
                <div className="card-saldo-banner">
                  <div className="saldo-main-info">
                    <span className="cliente-label">CLIENTE</span>
                    <strong className="cliente-nome-val">{pedidoSelecionado.clienteNome}</strong>
                  </div>
                  <div className="saldo-val-row">
                    <div>
                      <span className="sub-val-title">Total do Pedido</span>
                      <strong className="sub-val-num">R$ {Number(pedidoSelecionado.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="saldo-destaque-box">
                      <span className="sub-val-title danger">Saldo Pendente</span>
                      <strong className="sub-val-num danger">R$ {(Number(pedidoSelecionado.valorTotal || 0) - Number(pedidoSelecionado.valorPago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn-quitar-saldo"
                    onClick={() => {
                      const saldo = Number(pedidoSelecionado.valorTotal || 0) - Number(pedidoSelecionado.valorPago || 0);
                      setPagamento(prev => ({ ...prev, valor: saldo > 0 ? saldo.toFixed(2) : '0.00' }));
                    }}
                  >
                    ⚡ Preencher Saldo Total (R$ {(Number(pedidoSelecionado.valorTotal || 0) - Number(pedidoSelecionado.valorPago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                  </button>
                </div>

                <form onSubmit={registrarPagamento} className="form-pagamento-luxury">
                    <div className="form-row-2col">
                      <div className="form-group-pag">
                        <label>VALOR RECEBIDO (R$)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={pagamento.valor} 
                          onChange={e => setPagamento({...pagamento, valor: e.target.value})} 
                          placeholder="0,00"
                          required 
                          autoFocus 
                        />
                      </div>
                      <div className="form-group-pag">
                        <label>DATA DO PAGAMENTO</label>
                        <input 
                          type="date" 
                          value={pagamento.data} 
                          onChange={e => setPagamento({...pagamento, data: e.target.value})} 
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-group-pag">
                      <label>FORMA DE PAGAMENTO</label>
                      <div className="grid-metodos-pagamento">
                        {[
                          { id: 'Pix', label: 'Pix', icon: '⚡' },
                          { id: 'Dinheiro', label: 'Dinheiro', icon: '💵' },
                          { id: 'Cartão de Crédito', label: 'Crédito', icon: '💳' },
                          { id: 'Cartão de Débito', label: 'Débito', icon: '💳' },
                          { id: 'Transferência', label: 'Transferência', icon: '🏦' }
                        ].map(m => (
                          <button
                            type="button"
                            key={m.id}
                            className={`btn-metodo-item ${pagamento.formaPagto === m.id ? 'active' : ''}`}
                            onClick={() => setPagamento({...pagamento, formaPagto: m.id})}
                          >
                            <span>{m.icon}</span>
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UPLOAD DE COMPROVANTE DE PAGAMENTO */}
                    <div className="form-group-pag">
                      <label>📎 COMPROVANTE DE PAGAMENTO (OPCIONAL)</label>
                      {pagamento.comprovantePreview ? (
                        <div className="comprovante-preview-box">
                          {pagamento.comprovantePreview.startsWith('data:image') ? (
                            <img src={pagamento.comprovantePreview} alt="Comprovante" className="img-comprovante-thumb" />
                          ) : (
                            <div className="pdf-comprovante-thumb">📄 PDF</div>
                          )}
                          <div className="comprovante-meta">
                            <strong className="comprovante-nome">{pagamento.comprovanteNome}</strong>
                            <span className="comprovante-success">✓ Anexado com sucesso</span>
                          </div>
                          <button 
                            type="button" 
                            className="btn-remover-comprovante"
                            onClick={() => setPagamento(prev => ({ ...prev, comprovanteNome: '', comprovantePreview: '' }))}
                            title="Remover Anexo"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="dropzone-comprovante">
                          <input 
                            type="file" 
                            accept="image/*,application/pdf" 
                            onChange={handleFileComprovante} 
                            style={{ display: 'none' }} 
                          />
                          <i className="fas fa-cloud-upload-alt dropzone-icon"></i>
                          <span>Clique para anexar foto ou PDF do comprovante</span>
                          <small>Formatos aceitos: JPG, PNG, PDF (Máx 5MB)</small>
                        </label>
                      )}
                    </div>

                    <div className="modal-actions-luxury">
                        <button type="button" className="btn-cancel-luxury" onClick={() => setModalPagamento(false)}>Cancelar</button>
                        <button type="submit" className="btn-confirm-gold" disabled={salvandoPagamento}>
                          {salvandoPagamento ? (
                            <>
                              <i className="fas fa-spinner fa-spin"></i> Salvando...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-check-circle"></i> Confirmar Recebimento
                            </>
                          )}
                        </button>
                    </div>
                </form>
            </div>
         </div>
      )}

      {/* 👁️ PREVIEW FLUTUANTE AO PAIRAR */}
      {hoveredPedido && !menuAberto && (() => {
        const itensPreview = hoveredPedido.itens || hoveredPedido.carrinho || [];
        const saldoPreview = Number(hoveredPedido.valorTotal || 0) - Number(hoveredPedido.valorPago || 0);
        return (
          <div
            className="preview-hover-card"
            style={{
              pointerEvents: 'none',
              zIndex: 99999,
              top: Math.min(hoverPos.y + 18, window.innerHeight - 340),
              left: Math.min(hoverPos.x + 18, window.innerWidth - 300),
            }}
          >
            <div className="phc-header">
              <strong>#{hoveredPedido.numeroPedido || hoveredPedido.id?.substring(0,6).toUpperCase() || 'S/N'}</strong>
              <span className="phc-status">{String(hoveredPedido.status || '').toUpperCase()}</span>
            </div>
            <div className="phc-body">
              {!itensPreview.length
                ? <p className="phc-empty">Nenhum item cadastrado</p>
                : itensPreview.slice(0, 6).map((it, i) => (
                    <div key={i} className="phc-row">
                      <div className="phc-thumb">
                        {it.foto ? <img src={it.foto} alt="" /> : <span>📦</span>}
                      </div>
                      <span className="phc-name">{it.nome}</span>
                      <span className="phc-qty">×{it.qtd || it.quantidade || 1}</span>
                    </div>
                  ))
              }
              {itensPreview.length > 6 && (
                <p className="phc-more">+{itensPreview.length - 6} itens…</p>
              )}
            </div>
            <div className="phc-footer">
              <span>💰 R$ {Number(hoveredPedido.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              {saldoPreview > 0 && (
                <span className="phc-devedor">A receber: R$ {saldoPreview.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* 🏷️ MODAL TIPO DE EVENTO */}
      {modalEvento && (
        <div className="modal-overlay-evento" onClick={() => setModalEvento(null)}>
          <div className="modal-evento-card" onClick={e => e.stopPropagation()}>
            <div className="modal-evento-header">
              <h3>🏷️ Tipo de Evento</h3>
              <button className="btn-fechar-evento" onClick={() => setModalEvento(null)}>×</button>
            </div>
            <p className="modal-evento-sub">Selecione o tipo de evento para <strong>{modalEvento.clienteNome}</strong>:</p>
            <div className="grid-tipos-evento">
              {TIPOS_EVENTO.map(tipo => (
                <button
                  key={tipo.value}
                  className={`btn-tipo-evento${modalEvento.tipoEvento === tipo.value ? ' ativo' : ''}`}
                  onClick={() => salvarTipoEvento(tipo.value)}
                >
                  <span className="btn-tipo-emoji">{tipo.emoji}</span>
                  <span>{tipo.label}</span>
                </button>
              ))}
              {modalEvento.tipoEvento && (
                <button className="btn-tipo-evento remover" onClick={() => salvarTipoEvento(null)}>
                  <span>✕</span><span>Remover Tag</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📅 MODAL CALENDÁRIO DE DISPONIBILIDADE */}
      <ModalCalendarioDisponibilidade
        isOpen={modalCalendarioAberto}
        onClose={() => setModalCalendarioAberto(false)}
        estoque={estoque}
        locacoes={lista}
      />

      {/* 🛫🛬 MODAL CHECK-IN DE IDA E VOLTA */}
      <ModalCheckinLocacao 
        isOpen={modalCheckinAberta}
        onClose={() => setModalCheckinAberta(false)}
        locacao={locacaoCheckin}
        modo={modoCheckin}
        tenantId={tenantId}
        usuarioLogado={usuarioLogado}
        onSalvarSucesso={carregarLocacoes}
      />

      {/* 📋 MODAL DE ROMANEIO & CHECKLIST DE GALPÃO */}
      {modalRomaneioPedido && (
        <ModalRomaneioSeparacao
          pedido={modalRomaneioPedido}
          onClose={() => setModalRomaneioPedido(null)}
        />
      )}

    </div>
  );
};

export default Locacoes;