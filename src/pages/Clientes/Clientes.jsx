import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Clientes.css';
import { db, storage } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc, query, where, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const getTagStyle = (tag) => {
  if (!tag) return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  const normalizedTag = tag.toUpperCase().trim();
  const styles = {
    'NOVO': { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' }, 
    'VIP': { bg: '#fef08a', color: '#854d0e', border: '#fde047' }, 
    'PROBLEMÁTICO': { bg: '#fecaca', color: '#991b1b', border: '#fca5a5' }, 
    'RECORRENTE': { bg: '#bbf7d0', color: '#166534', border: '#86efac' }, 
    'PECHINCHA': { bg: '#fed7aa', color: '#9a3412', border: '#fdba74' }, 
    'ECONÔMICO': { bg: '#e9d5ff', color: '#6b21a8', border: '#d8b4fe' }, 
    'INDECISO': { bg: '#fbcfe8', color: '#9d174d', border: '#f9a8d4' }, 
    'EXIGENTE': { bg: '#bfdbfe', color: '#1e40af', border: '#93c5fd' }, 
    'ORGANIZADO': { bg: '#a7f3d0', color: '#065f46', border: '#6ee7b7' }, 
    'ÚLTIMA HORA': { bg: '#fecdd3', color: '#be123c', border: '#fda4af' }, 
    'BÁSICO': { bg: '#e5e7eb', color: '#374151', border: '#d1d5db' }, 
    'FAMÍLIA': { bg: '#c7d2fe', color: '#3730a3', border: '#a5b4fc' }
  };
  return styles[normalizedTag] || { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' }; 
};

const Clientes = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const navigate = useNavigate();

  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState('A-Z');

  const [menuAberto, setMenuAberto] = useState(null); 
  const [allLocacoes, setAllLocacoes] = useState([]); 
  const [modalAberto, setModalAberto] = useState(false);
  const [detalhesDivida, setDetalhesDivida] = useState({ cliente: '', pendencias: [] });
  const [modalTravaLocacao, setModalTravaLocacao] = useState(null); // { cliente, pendencias, valorDevido }

  const [clienteVisualizacao, setClienteVisualizacao] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('dados');

  // ESTADOS DA MODAL DE SELEÇÃO DE MENSAGEM E ANEXO DO WHATSAPP
  const [modalZapCliente, setModalZapCliente] = useState(null);
  const [tipoMensagemZap, setTipoMensagemZap] = useState('atendimento');
  const [textoMensagemZap, setTextoMensagemZap] = useState('');
  const [imagemAnexoFile, setImagemAnexoFile] = useState(null);
  const [imagemPreviewUrl, setImagemPreviewUrl] = useState('');
  const [carregandoUploadImg, setCarregandoUploadImg] = useState(false);
  const [imagemCopiadaComSucesso, setImagemCopiadaComSucesso] = useState(false);

  // NOVOS ESTADOS: Filtro por Tipo de Evento e Exportar
  const [filtroTipoEvento, setFiltroTipoEvento] = useState('todos');
  const [exportandoLista, setExportandoLista] = useState(false);
  const exportMenuRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => { 
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    carregarClientes(); 
  }, [usuarioLogado, navigate, tenantId]);

  const carregarClientes = async () => {
    if (!usuarioLogado) return;
    setLoading(true);
    try {
      const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));
      const querySnapshot = await getDocs(qClientes);
      let listaClientes = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
      const locacoesSnapshot = await getDocs(qLocacoes);
      const locs = locacoesSnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setAllLocacoes(locs);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const batch = writeBatch(db);
      let precisaAtualizarBanco = false;

      listaClientes = listaClientes.map(cliente => {
        let temDivida = false;
        locs.forEach(loc => {
          if (loc.clienteId === cliente.id || loc.cliente?.id === cliente.id) {
            if (loc.status === 'cancelado' || loc.status === 'orcamento' || loc.status === 'orçamento') return;
            const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
            if (!dataStr) return;
            const dataEvento = new Date(dataStr + 'T00:00:00');
            const pagStatus = (loc.statusPagamento || '').toLowerCase();
            const vTotal = Number(loc.valorTotal || loc.total || 0);
            const vPago = Number(loc.valorPago || 0);
            if (dataEvento < hoje && (vTotal - vPago) > 0.01 && pagStatus !== 'pago' && pagStatus !== 'quitado') {
                temDivida = true;
            }
          }
        });

        let statusCorreto = temDivida ? 'inadimplente' : 'adimplente';
        if (cliente.statusAprovacao === 'pendente' || cliente.situacaoFinanceira === 'pendente') {
          statusCorreto = 'pendente';
        }

        if (cliente.situacaoFinanceira !== statusCorreto) {
           batch.update(doc(db, "clientes", cliente.id), { situacaoFinanceira: statusCorreto });
           precisaAtualizarBanco = true;
           cliente.situacaoFinanceira = statusCorreto;
        }
        return cliente;
      });

      if (precisaAtualizarBanco) {
        await batch.commit();
      }
      setClientes(listaClientes);
    } catch (error) { 
        console.error("Erro ao carregar clientes:", error);
    } finally { 
        setLoading(false); 
    }
  };

  // 🚨 TRAVA DE SEGURANÇA: Verifica se o cliente tem pendências antes de iniciar nova locação
  const verificarETentarNovaLocacao = (cliente) => {
    setMenuAberto(null);
    if (!cliente) return;

    const hoje = new Date(); 
    hoje.setHours(0, 0, 0, 0);

    const pendencias = allLocacoes.filter(loc => {
      if (loc.clienteId !== cliente.id && loc.cliente?.id !== cliente.id) return false;
      if (loc.status === 'cancelado' || loc.status === 'orcamento' || loc.status === 'orçamento') return false;
      const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
      if (!dataStr) return false;
      const dataEvento = new Date(dataStr + 'T00:00:00');
      const pagStatus = (loc.statusPagamento || '').toLowerCase();
      const vTotal = Number(loc.valorTotal || loc.total || 0);
      const vPago = Number(loc.valorPago || 0);
      return dataEvento < hoje && (vTotal - vPago) > 0.01 && pagStatus !== 'pago' && pagStatus !== 'quitado';
    });

    const valorDevido = pendencias.reduce((acc, loc) => {
      const vTotal = Number(loc.valorTotal || loc.total || 0);
      const vPago = Number(loc.valorPago || 0);
      return acc + Math.max(0, vTotal - vPago);
    }, 0);

    const isInadimplente = cliente.situacaoFinanceira === 'inadimplente' || pendencias.length > 0;

    if (isInadimplente) {
      setModalTravaLocacao({
        cliente,
        pendencias,
        valorDevido
      });
      return;
    }

    setClienteVisualizacao(null);
    navigate('/locacoes/nova', { state: { clienteSelecionado: cliente } });
  };

  const verPorQueInadimplente = (e, cliente) => {
    e.stopPropagation(); 
    if (cliente.situacaoFinanceira !== 'inadimplente') return;

    const hoje = new Date(); 
    hoje.setHours(0, 0, 0, 0);

    const pendencias = allLocacoes.filter(loc => {
      if (loc.clienteId !== cliente.id && loc.cliente?.id !== cliente.id) return false;
      if (loc.status === 'cancelado' || loc.status === 'orcamento' || loc.status === 'orçamento') return false;
      const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
      if (!dataStr) return false;
      const dataEvento = new Date(dataStr + 'T00:00:00');
      const pagStatus = (loc.statusPagamento || '').toLowerCase();
      const vTotal = Number(loc.valorTotal || loc.total || 0);
      const vPago = Number(loc.valorPago || 0);
      return dataEvento < hoje && (vTotal - vPago) > 0.01 && pagStatus !== 'pago' && pagStatus !== 'quitado';
    });

    setDetalhesDivida({ clienteObj: cliente, cliente: cliente.nome || cliente.nomeFantasia, pendencias });
    setModalAberto(true);
  };

  const irParaLocacaoEspecifica = (pedidoId) => {
    setModalAberto(false);
    setClienteVisualizacao(null);
    navigate(`/locacoes/editar/${pedidoId}`); 
  };

  const excluirCliente = async (id, nome) => {
    if (!id) {
      alert("⚠️ Não foi possível identificar o ID único do cliente para exclusão.");
      return;
    }

    if (window.confirm(`ATENÇÃO: Excluir ${nome || 'este cliente'} apagará o cadastro e os pedidos vinculados. Deseja continuar?`)) {
      try {
        await deleteDoc(doc(db, "clientes", id));

        try {
          const pedidosSnap = await getDocs(query(collection(db, "locacoes"), where("clienteId", "==", id)));
          if (!pedidosSnap.empty) {
              const batch = writeBatch(db);
              pedidosSnap.forEach((docPedido) => batch.delete(docPedido.ref));
              await batch.commit();
          }
        } catch (errPedidos) {
          console.warn("Aviso ao buscar pedidos do cliente excluído:", errPedidos);
        }
        
        try {
          const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
          await addDoc(collection(db, "logs_atividades"), {
            empresaId: tenantId,
            userId: tenantId,
            funcionarioId: usuarioLogado?.uid,
            nomeFuncionario: nomeEquipe,
            usuarioEmail: usuarioLogado?.email || "Desconhecido",
            acao: "EXCLUSÃO DE CLIENTE",
            detalhes: `Excluiu permanentemente o cliente "${nome}" e seus pedidos vinculados.`,
            dataHora: new Date().toISOString(),
            criadoEm: serverTimestamp()
          });
        } catch (errorEspiao) {
          console.error("Erro no espião de exclusão:", errorEspiao);
        }

        alert("✅ Cliente excluído com sucesso!");
        carregarClientes(); 
        setClienteVisualizacao(null);
      } catch (error) { 
        console.error("Erro ao excluir cliente:", error);
        alert(`Erro ao excluir: ${error.message || "Erro de conexão"}`);
      }
    }
  };

  const aprovarCliente = async (e, clienteId, clienteNome) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, "clientes", clienteId), {
        statusAprovacao: 'aprovado',
        situacaoFinanceira: 'adimplente'
      });

      try {
        const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
        await addDoc(collection(db, "logs_atividades"), {
          empresaId: tenantId,
          userId: tenantId,
          funcionarioId: usuarioLogado?.uid,
          nomeFuncionario: nomeEquipe,
          usuarioEmail: usuarioLogado?.email || "Desconhecido",
          acao: "APROVAÇÃO DE CLIENTE",
          detalhes: `Aprovou o cadastro do cliente "${clienteNome}".`,
          dataHora: new Date().toISOString()
        });
      } catch (errLog) {}

      alert(`✅ Cadastro de "${clienteNome}" aprovado com sucesso!`);
      carregarClientes();
      if (clienteVisualizacao?.id === clienteId) {
        setClienteVisualizacao(prev => prev ? ({ ...prev, statusAprovacao: 'aprovado', situacaoFinanceira: 'adimplente' }) : null);
      }
    } catch (error) {
      console.error("Erro ao aprovar cliente:", error);
      alert("Erro ao aprovar cliente.");
    }
  };

  const getHistoricoDoCliente = (clienteId) => {
    const historico = allLocacoes.filter(loc => loc.clienteId === clienteId || loc.cliente?.id === clienteId);
    const totalGasto = historico.reduce((soma, loc) => {
        const st = String(loc.status || '').toLowerCase();
        if (!st.includes('cancelado') && !st.includes('orcam')) {
            return soma + Number(loc.valorTotal || loc.total || 0);
        }
        return soma;
    }, 0);

    historico.sort((a, b) => {
        const dataA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 0;
        const dataB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 0;
        return dataB - dataA;
    });

    return { historico, totalGasto };
  };

  const getSeloVIPCliente = (clienteId) => {
    const { historico, totalGasto } = getHistoricoDoCliente(clienteId);
    const qtdFestas = historico.filter(h => {
      const st = String(h.status || '').toLowerCase();
      return !st.includes('cancelado') && !st.includes('orcam');
    }).length;

    if (totalGasto >= 5000) {
      return {
        badge: `⭐ VIP Ouro — R$ ${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        totalGasto,
        qtdFestas,
        bg: '#fefce8',
        color: '#a16207',
        border: '#fde047'
      };
    }
    if (totalGasto >= 2000) {
      return {
        badge: `✨ VIP Prata — R$ ${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        totalGasto,
        qtdFestas,
        bg: '#f8fafc',
        color: '#334155',
        border: '#cbd5e1'
      };
    }
    if (totalGasto >= 800 || qtdFestas >= 2) {
      return {
        badge: `⭐ Cliente VIP — R$ ${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        totalGasto,
        qtdFestas,
        bg: '#eff6ff',
        color: '#1d4ed8',
        border: '#bfdbfe'
      };
    }
    return null;
  };

  const getUltimaLocacao = (clienteId) => {
    const locs = allLocacoes.filter(loc => loc.clienteId === clienteId || loc.cliente?.id === clienteId);
    const validas = locs.filter(loc => {
      const st = String(loc.status || '').toLowerCase();
      return !st.includes('cancelado') && !st.includes('orcam');
    });

    if (validas.length === 0) return null;

    validas.sort((a, b) => {
      const dataA = a.dataRetirada || a.dataEvento || a.dataDevolucao || '';
      const dataB = b.dataRetirada || b.dataEvento || b.dataDevolucao || '';
      return new Date(dataB).getTime() - new Date(dataA).getTime();
    });

    const ultima = validas[0];
    const dataStr = ultima.dataRetirada || ultima.dataEvento || ultima.dataDevolucao;
    const tema = ultima.tema || ultima.temaDaFesta || ultima.nomeTema || ultima.tipoServico || 'Locação';
    return {
      data: dataStr ? new Date(dataStr + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data',
      tema: tema,
      status: ultima.status
    };
  };

  const isAniversarianteDoMes = (clienteOuDataStr) => {
    if (!clienteOuDataStr) return false;
    let dataVal = clienteOuDataStr;

    if (typeof clienteOuDataStr === 'object' && clienteOuDataStr !== null && !(clienteOuDataStr instanceof Date)) {
      dataVal = clienteOuDataStr.nascimento || clienteOuDataStr.dataNascimento || clienteOuDataStr.dataNasc || clienteOuDataStr.dataAniversario || clienteOuDataStr.aniversario;
    }
    if (!dataVal) return false;

    try {
      let mesNasc = -1;
      if (typeof dataVal === 'object' && dataVal !== null) {
        if (dataVal.toDate) mesNasc = dataVal.toDate().getMonth();
        else if (dataVal.seconds) mesNasc = new Date(dataVal.seconds * 1000).getMonth();
        else if (dataVal instanceof Date) mesNasc = dataVal.getMonth();
      } else {
        const str = String(dataVal).trim();
        if (!str) return false;
        if (str.includes('-')) {
          const partes = str.split('T')[0].split('-');
          if (partes.length === 3) mesNasc = parseInt(partes[1], 10) - 1;
        } else if (str.includes('/')) {
          const partes = str.split('/');
          if (partes.length >= 2) mesNasc = parseInt(partes[1], 10) - 1;
        } else {
          const d = new Date(str);
          if (!isNaN(d.getTime())) mesNasc = d.getMonth();
        }
      }
      return mesNasc === new Date().getMonth();
    } catch (e) {
      return false;
    }
  };

  // GERADOR DE MODELOS DE TEXTO PARA O WHATSAPP
  const gerarTextoModeloWhatsApp = (cliente, tipo) => {
    if (!cliente) return '';
    const primeiroNome = (cliente.nome || cliente.nomeFantasia || 'Cliente').trim().split(' ')[0];

    if (tipo === 'cobranca') {
      const res = getHistoricoDoCliente(cliente.id);
      const pendencias = res.historico.filter(loc => {
        const st = String(loc.statusPagamento || '').toLowerCase();
        return st !== 'pago' && st !== 'quitado' && !String(loc.status || '').toLowerCase().includes('cancel');
      });
      const totalDevido = pendencias.reduce((acc, p) => acc + (Number(p.valorTotal || p.total || 0) - Number(p.valorPago || 0)), 0);

      return `Olá, *${primeiroNome}*! Tudo bem? 😊\n\nPassando aqui da Celebre referente à sua locação de artigos para festa. Consta um valor pendente de *R$ ${totalDevido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}*.\n\nSe quiser, posso te mandar a chave Pix para facilitar o acerto! Como prefere fazer? 🎈✨`;
    } else if (tipo === 'agradecimento') {
      return `Olá, *${primeiroNome}*! Tudo bem? 😊\n\nPassando em nome de toda a equipe Celebre para agradecer muito pela confiança em realizar a sua festa com a gente! 🎉💖\n\nEsperamos que tenha sido um momento inesquecível! Deu tudo certo com os itens? Estamos sempre à disposição para os próximos eventos! 🎈✨`;
    } else if (tipo === 'aniversario') {
      return `Olá, *${primeiroNome}*! 🎂🎉\n\nA equipe Celebre te deseja um Feliz Aniversário repleto de alegrias, saúde e muitas festas!\n\nPreparamos um desconto super especial para você comemorar essa data incrível com a gente. Vamos montar um projeto lindo? 🥳✨`;
    } else if (tipo === 'promocao') {
      return `Olá, *${primeiroNome}*! Como vai? 😊\n\nChegaram peças e acervos novos incríveis aqui na Celebre Festas! 🚚✨\n\nPreparamos uma condição exclusiva para o seu próximo evento. Vamos agendar uma visita ou montar um orçamento personalizado? 🎈🎨`;
    } else {
      return `Olá, *${primeiroNome}*! Tudo bem? 😊\n\nEntro em contato pela Celebre para conversarmos sobre seus eventos e locações. Como posso te ajudar hoje? 🎉🎈`;
    }
  };

  const abrirModalWhatsApp = (cliente, tipoInicial = null) => {
    let tipo = tipoInicial;
    if (!tipo) {
      if (cliente.situacaoFinanceira === 'inadimplente') tipo = 'cobranca';
      else if (isAniversarianteDoMes(cliente.dataNascimento || cliente.dataNasc)) tipo = 'aniversario';
      else tipo = 'atendimento';
    }
    const textoInicial = gerarTextoModeloWhatsApp(cliente, tipo);
    setModalZapCliente(cliente);
    setTipoMensagemZap(tipo);
    setTextoMensagemZap(textoInicial);
    setImagemAnexoFile(null);
    setImagemPreviewUrl('');
    setImagemCopiadaComSucesso(false);
  };

  const selecionarModeloZap = (tipo) => {
    setTipoMensagemZap(tipo);
    if (tipo !== 'custom') {
      let txt = gerarTextoModeloWhatsApp(modalZapCliente, tipo);
      if (imagemPreviewUrl && !txt.includes('📸 Imagem anexada:')) {
        txt += `\n\n📸 Imagem em anexo no link: ${imagemPreviewUrl}`;
      }
      setTextoMensagemZap(txt);
    }
  };

  const handleUparImagemZap = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Criar preview local instantâneo
    const previewUrlLocal = URL.createObjectURL(file);
    setImagemAnexoFile(file);
    setImagemPreviewUrl(previewUrlLocal);
    setImagemCopiadaComSucesso(false);

    // Tentar upload para o Firebase Storage para gerar link público de compartilhamento
    if (storage) {
      setCarregandoUploadImg(true);
      try {
        const storageRef = ref(storage, `whatsapp_anexos/${tenantId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const urlPublica = await getDownloadURL(storageRef);
        setImagemPreviewUrl(urlPublica);
        
        // Anexar o link da imagem ao texto da mensagem se ainda não estiver presente
        if (!textoMensagemZap.includes(urlPublica)) {
          setTextoMensagemZap(prev => `${prev}\n\n📸 Imagem do catálogo/anexo: ${urlPublica}`);
        }
      } catch (err) {
        console.warn("Aviso ao salvar no Firebase Storage (usando preview local):", err);
      } finally {
        setCarregandoUploadImg(false);
      }
    }
  };

  const copiarImagemAreaTransferencia = async () => {
    if (!imagemAnexoFile) return;
    try {
      // Converte imagem em blob e copia para a área de transferência do sistema
      const blob = imagemAnexoFile.slice(0, imagemAnexoFile.size, imagemAnexoFile.type);
      await navigator.clipboard.write([
        new ClipboardItem({ [imagemAnexoFile.type]: blob })
      ]);
      setImagemCopiadaComSucesso(true);
      setTimeout(() => setImagemCopiadaComSucesso(false), 4000);
    } catch (err) {
      console.error("Erro ao copiar imagem:", err);
      alert("💡 Dica: A imagem foi salva! Você pode arrastar a imagem diretamente para o chat do WhatsApp Web.");
    }
  };

  const removerImagemZap = () => {
    setImagemAnexoFile(null);
    setImagemPreviewUrl('');
    setImagemCopiadaComSucesso(false);
  };

  const dispararWhatsAppFinal = () => {
    if (!modalZapCliente?.celular) return;
    const numLimpo = modalZapCliente.celular.replace(/\D/g, '');
    const url = `https://wa.me/55${numLimpo}?text=${encodeURIComponent(textoMensagemZap)}`;
    window.open(url, '_blank');
    setModalZapCliente(null);
  };

  const formatarTelefone = (tel) => {
    if (!tel) return '';
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 11) return `(${limpo.slice(0,2)}) ${limpo.slice(2,7)}-${limpo.slice(7)}`;
    if (limpo.length === 10) return `(${limpo.slice(0,2)}) ${limpo.slice(2,6)}-${limpo.slice(6)}`;
    return tel; 
  };

  const formatarNomeCapitalizado = (nomeBruto) => {
    if (!nomeBruto) return '';
    const palavras = nomeBruto.trim().toLowerCase().split(/\s+/);
    const conectores = ['da', 'de', 'do', 'das', 'dos', 'e'];
    return palavras.map((palavra, index) => {
        if (index > 0 && conectores.includes(palavra)) return palavra;
        return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
  };

  const ltvTotalCarteira = allLocacoes.reduce((soma, loc) => {
    const st = String(loc.status || '').toLowerCase();
    if (!st.includes('cancelado') && !st.includes('orcam')) {
      return soma + Number(loc.valorTotal || loc.total || 0);
    }
    return soma;
  }, 0);

  const [filtroTagCRM, setFiltroTagCRM] = useState('todas');

  // ============================================================
  // LISTA DE TIPOS DE EVENTOS ÚNICOS (para o filtro)
  // ============================================================
  const tiposEventoUnicos = React.useMemo(() => {
    const tipos = new Set();
    allLocacoes.forEach(loc => {
      const tipo = loc.tipoServico || loc.modalidade || loc.tema || loc.temaDaFesta || loc.nomeTema;
      if (tipo) tipos.add(String(tipo).trim());
    });
    return Array.from(tipos).sort();
  }, [allLocacoes]);

  // ============================================================
  // BADGE RECORRENTE: clientes com 2+ locações confirmadas
  // ============================================================
  const clientesRecorrentesSet = React.useMemo(() => {
    const s = new Set();
    clientes.forEach(c => {
      const locs = allLocacoes.filter(loc => (loc.clienteId === c.id || loc.cliente?.id === c.id));
      const confirmadas = locs.filter(loc => {
        const st = String(loc.status || '').toLowerCase();
        return !st.includes('cancelado') && !st.includes('orcam');
      });
      if (confirmadas.length >= 2) s.add(c.id);
    });
    return s;
  }, [clientes, allLocacoes]);

  // ============================================================
  // LINHA DO TEMPO DO PEDIDO: marcos das locações do cliente
  // ============================================================
  const gerarTimelineCompleta = (clienteId) => {
    const locs = allLocacoes.filter(loc => loc.clienteId === clienteId || loc.cliente?.id === clienteId);
    const eventos = [];

    locs.forEach(loc => {
      const tema = loc.tema || loc.temaDaFesta || loc.nomeTema || 'Locação';
      const pedidoNum = loc.numeroPedido ? `#${loc.numeroPedido}` : `#${loc.id.substring(0,6).toUpperCase()}`;

      // Evento: criação do pedido
      if (loc.criadoEm || loc.dataCriacao) {
        const dt = loc.criadoEm || loc.dataCriacao;
        const data = dt?.toDate ? dt.toDate() : new Date(dt);
        if (!isNaN(data.getTime())) {
          eventos.push({ data, tipo: 'criacao', icone: '📝', cor: '#6366f1', bg: '#eef2ff', label: `Pedido ${pedidoNum} criado`, sub: tema, id: `${loc.id}-criacao` });
        }
      }

      // Evento: data do evento/retirada
      if (loc.dataRetirada || loc.dataEvento) {
        const str = loc.dataRetirada || loc.dataEvento;
        const data = new Date(str + 'T12:00:00');
        if (!isNaN(data.getTime())) {
          eventos.push({ data, tipo: 'evento', icone: '🎉', cor: '#f59e0b', bg: '#fffbeb', label: `Evento: ${tema}`, sub: `Pedido ${pedidoNum}`, id: `${loc.id}-evento` });
        }
      }

      // Evento: devolução
      if (loc.dataDevolucao) {
        const data = new Date(loc.dataDevolucao + 'T12:00:00');
        if (!isNaN(data.getTime())) {
          eventos.push({ data, tipo: 'devolucao', icone: '📦', cor: '#64748b', bg: '#f1f5f9', label: `Devolução ${pedidoNum}`, sub: tema, id: `${loc.id}-devolucao` });
        }
      }

      // Evento: pagamento quitado
      const pagSt = String(loc.statusPagamento || '').toLowerCase();
      if (pagSt === 'pago' || pagSt === 'quitado') {
        const str = loc.dataPagamento || loc.dataRetirada || loc.dataEvento;
        if (str) {
          const data = new Date(str + 'T12:00:00');
          if (!isNaN(data.getTime())) {
            eventos.push({ data, tipo: 'pagamento', icone: '✅', cor: '#10b981', bg: '#ecfdf5', label: `Pagamento quitado ${pedidoNum}`, sub: `R$ ${Number(loc.valorTotal || loc.total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`, id: `${loc.id}-pag` });
          }
        }
      }
    });

    eventos.sort((a, b) => b.data - a.data);
    return eventos;
  };

  // ============================================================
  // EXPORTAR LISTA DE CLIENTES (CSV e IMPRESSÃO)
  // ============================================================
  const exportarCSV = () => {
    setExportandoLista(true);
    try {
      const cabecalho = ['Nome', 'Tipo', 'CPF/CNPJ', 'Celular', 'E-mail', 'Situação', 'Tag CRM', 'Total Locações', 'LTV (R$)'];
      const linhas = clientesFiltrados.map(c => {
        const res = getHistoricoDoCliente(c.id);
        return [
          formatarNomeCapitalizado(c.tipoPessoa === 'juridica' ? c.nomeFantasia : c.nome || ''),
          c.tipoPessoa === 'juridica' ? 'PJ' : 'PF',
          c.cpf || c.cnpj || '',
          c.celular || '',
          c.email || '',
          c.situacaoFinanceira || '',
          c.tags || '',
          res.historico.length,
          res.totalGasto.toFixed(2).replace('.', ',')
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
      });
      const csvContent = '\uFEFF' + [cabecalho.map(h => `"${h}"`).join(';'), ...linhas].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clientes_celebre_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportandoLista(false);
      setShowExportMenu(false);
    }
  };

  const exportarImprimir = () => {
    setShowExportMenu(false);
    window.print();
  };

  // Mapeamento de Ranking dos Melhores Clientes por locações/LTV
  const rankingsClientesMap = React.useMemo(() => {
    const map = {};
    const listaComLocs = clientes.map(c => {
      const res = getHistoricoDoCliente(c.id);
      return { id: c.id, count: res.historico.length, gasto: res.totalGasto };
    }).filter(c => c.count > 0);

    listaComLocs.sort((a, b) => b.count - a.count || b.gasto - a.gasto);

    listaComLocs.forEach((item, index) => {
      if (index === 0) map[item.id] = { badge: '🥇 TOP 1', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' };
      else if (index === 1) map[item.id] = { badge: '🥈 TOP 2', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
      else if (index === 2) map[item.id] = { badge: '🥉 TOP 3', color: '#7c2d12', bg: '#ffedd5', border: '#fdba74' };
      else if (item.count >= 3) map[item.id] = { badge: '⭐ FREQUENTE', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' };
    });

    return map;
  }, [clientes, allLocacoes]);

  let clientesFiltrados = clientes.filter(c => {
    const termo = busca.toLowerCase();
    const matchBusca = (c.nome?.toLowerCase().includes(termo)) || 
                       (c.nomeFantasia?.toLowerCase().includes(termo)) || 
                       (c.cpf?.includes(termo)) || 
                       (c.cnpj?.includes(termo)) ||
                       (c.email?.toLowerCase().includes(termo));
                       
    let passStatus = true;
    if (filtroStatus === 'adimplentes') passStatus = c.situacaoFinanceira === 'adimplente';
    if (filtroStatus === 'inadimplentes') passStatus = c.situacaoFinanceira === 'inadimplente';
    if (filtroStatus === 'pendentes') passStatus = c.statusAprovacao === 'pendente' || c.situacaoFinanceira === 'pendente';
    if (filtroStatus === 'vip') passStatus = (c.tags || '').toUpperCase().includes('VIP');
    if (filtroStatus === 'aniversariantes') passStatus = isAniversarianteDoMes(c.dataNascimento || c.dataNasc);

    let passTag = true;
    if (filtroTagCRM !== 'todas') {
      passTag = (c.tags || '').toUpperCase() === filtroTagCRM.toUpperCase();
    }

    // FILTRO POR TIPO DE EVENTO
    let passTipoEvento = true;
    if (filtroTipoEvento !== 'todos') {
      const locsCliente = allLocacoes.filter(loc => loc.clienteId === c.id || loc.cliente?.id === c.id);
      passTipoEvento = locsCliente.some(loc => {
        const tipo = loc.tipoServico || loc.modalidade || loc.tema || loc.temaDaFesta || loc.nomeTema || '';
        return String(tipo).trim().toLowerCase() === filtroTipoEvento.toLowerCase();
      });
    }

    return matchBusca && passStatus && passTag && passTipoEvento;
  });

  clientesFiltrados.sort((a, b) => {
      const nomeA = (a.tipoPessoa === 'juridica' ? a.nomeFantasia : a.nome || '').toLowerCase();
      const nomeB = (b.tipoPessoa === 'juridica' ? b.nomeFantasia : b.nome || '').toLowerCase();
      if (ordemAlfabetica === 'A-Z') return nomeA.localeCompare(nomeB);
      if (ordemAlfabetica === 'Z-A') return nomeB.localeCompare(nomeA);
      return 0;
  });

  let perfilNomeBonito = '';
  let perfilTagColorida = null;
  let perfilHistorico = [];
  let perfilTotalGasto = 0;

  if (clienteVisualizacao) {
      perfilNomeBonito = formatarNomeCapitalizado(clienteVisualizacao.tipoPessoa === 'juridica' ? clienteVisualizacao.nomeFantasia : clienteVisualizacao.nome || '?');
      perfilTagColorida = clienteVisualizacao.tags ? getTagStyle(clienteVisualizacao.tags) : null;
      const res = getHistoricoDoCliente(clienteVisualizacao.id);
      perfilHistorico = res.historico;
      perfilTotalGasto = res.totalGasto;
  }

  const numAniversariantes = clientes.filter(c => isAniversarianteDoMes(c.dataNascimento || c.dataNasc)).length;
  const numPendentesAprovacao = clientes.filter(c => c.statusAprovacao === 'pendente' || c.situacaoFinanceira === 'pendente').length;

  const copiarLinkAutoCadastro = () => {
    const link = `${window.location.origin}/autocadastro/${tenantId}`;
    navigator.clipboard.writeText(link);
    alert(`📋 Link de Auto-Cadastro copiado com sucesso!\n\n${link}\n\nEnvie este link para os seus clientes pelo WhatsApp para que eles preencham o cadastro diretamente no celular!`);
  };

  return (
    <div className="clientes-container dashboard-container fade-in">
      
      {/* HERO / CABEÇALHO */}
      <header className="clientes-hero-header">
        <div className="welcome-text">
          <div className="header-title-row">
            <span className="header-icon-badge"><i className="fas fa-users"></i></span>
            <div>
              <h1>Gestão de Clientes</h1>
              <p>Carteira de clientes, CRM de aniversariantes e disparo inteligente de mensagens com foto.</p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button 
            type="button"
            onClick={copiarLinkAutoCadastro}
            className="btn-secondary-celebre"
            title="Copiar Link de Auto-Cadastro para enviar aos clientes pelo WhatsApp"
          >
            <i className="fas fa-link"></i> Link Auto-Cadastro
          </button>

          {/* BOTÃO EXPORTAR LISTA */}
          <div className="export-dropdown-wrapper" ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn-export-celebre"
              onClick={() => setShowExportMenu(v => !v)}
              disabled={exportandoLista}
              title="Exportar lista de clientes"
            >
              {exportandoLista
                ? <><i className="fas fa-spinner fa-spin"></i> Exportando...</>
                : <><i className="fas fa-file-export"></i> Exportar</>}
            </button>
            {showExportMenu && (
              <div className="export-dropdown-menu fade-in">
                <button onClick={exportarCSV} className="export-dropdown-item">
                  <i className="fas fa-file-csv" style={{ color: '#16a34a' }}></i>
                  <div>
                    <strong>Planilha CSV</strong>
                    <span>Abre no Excel e Google Sheets</span>
                  </div>
                </button>
                <button onClick={exportarImprimir} className="export-dropdown-item">
                  <i className="fas fa-print" style={{ color: '#6366f1' }}></i>
                  <div>
                    <strong>Imprimir / Salvar PDF</strong>
                    <span>Gera PDF pelo navegador</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Link to="/cadastro-cliente" className="btn-primary-celebre">
            <i className="fas fa-plus"></i> NOVO CLIENTE
          </Link>
        </div>
      </header>

      {/* BANNER INTERATIVO DE PENDENTES DE APROVAÇÃO (AUTO-CADASTRO) */}
      {numPendentesAprovacao > 0 && (
        <div className="crm-birthday-alert-banner fade-in" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', borderColor: '#fdba74', marginBottom: '16px' }} onClick={() => setFiltroStatus('pendentes')}>
          <div className="alert-banner-left">
            <span className="banner-cake-icon" style={{ background: '#ffedd5', color: '#c2410c' }}>⏳</span>
            <div>
              <strong style={{ color: '#9a3412' }}>{numPendentesAprovacao} cadastro{numPendentesAprovacao === 1 ? '' : 's'} de auto-cadastro aguardando sua aprovação!</strong>
              <p style={{ color: '#c2410c' }}>Revise as informações cadastradas via link público e aprove o perfil com 1 clique.</p>
            </div>
          </div>
          <button type="button" className="btn-banner-action" style={{ background: '#c2410c', color: '#fff' }}>
            Aprovar Cadastros <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      )}

      {/* BANNER INTERATIVO DE ANIVERSARIANTES DO MÊS */}
      {numAniversariantes > 0 && (
        <div className="crm-birthday-alert-banner fade-in" onClick={() => setFiltroStatus('aniversariantes')}>
          <div className="alert-banner-left">
            <span className="banner-cake-icon">🎂</span>
            <div>
              <strong style={{ color: '#be185d' }}>{numAniversariantes} cliente{numAniversariantes === 1 ? '' : 's'} faz{numAniversariantes === 1 ? '' : 'em'} aniversário este mês!</strong>
              <p>Aproveite para enviar felicitações e cupons de desconto para impulsionar novas locações.</p>
            </div>
          </div>
          <button type="button" className="btn-banner-action">
            Ver Aniversariantes <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      )}

      {/* KPI CARDS (MÉTRICAS DA CARTEIRA) */}
      <div className="clientes-stats-grid">
        <div className="stat-card-pro border-purple">
          <div className="stat-icon-wrapper icon-purple">
            <i className="fas fa-address-book"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Total na Carteira</span>
            <strong className="stat-value">{clientes.length}</strong>
            <span className="stat-sub">Cadastrados</span>
          </div>
        </div>

        <div className="stat-card-pro border-amber" onClick={() => setFiltroStatus('pendentes')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper icon-amber">
            <i className="fas fa-user-clock"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Aguardando Aprovação</span>
            <strong className="stat-value">{numPendentesAprovacao}</strong>
            <span className="stat-sub">Auto-cadastro</span>
          </div>
        </div>
 
        <div className="stat-card-pro border-green">
          <div className="stat-icon-wrapper icon-green">
            <i className="fas fa-user-check"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Adimplentes</span>
            <strong className="stat-value">{clientes.filter(c => c.situacaoFinanceira === 'adimplente').length}</strong>
            <span className="stat-sub">Sem pendências</span>
          </div>
        </div>
        
        <div className="stat-card-pro border-red">
          <div className="stat-icon-wrapper icon-red">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="stat-content">
            <span className="stat-title">Com Pendências</span>
            <strong className="stat-value">{clientes.filter(c => c.situacaoFinanceira === 'inadimplente').length}</strong>
            <span className="stat-sub">Exigem atenção</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA (NATIVO MOBILE + DESKTOP LUXURY) */}
      <div className="advanced-filter-bar">
        <div className="filter-top-row">
          
          <div className="search-input-box">
            <i className="fas fa-search search-box-icon"></i>
            <input 
              type="text" 
              placeholder="Buscar por Nome, CPF, CNPJ ou E-mail..." 
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

          <div className="filter-controls-group">
            {/* DROPDOWN DE STATUS NATIVO EXCLUSIVO PARA CELULAR (SEM ROLAGEM) */}
            <select 
              value={filtroStatus} 
              onChange={(e) => setFiltroStatus(e.target.value)} 
              className="select-pill-filter mobile-status-select"
            >
              <option value="todos">👥 Todos os Clientes ({clientes.length})</option>
              {numPendentesAprovacao > 0 && <option value="pendentes">⏳ Aguardando Aprovação ({numPendentesAprovacao})</option>}
              <option value="adimplentes">✅ Adimplentes ({clientes.filter(c => c.situacaoFinanceira === 'adimplente').length})</option>
              <option value="inadimplentes">⚠️ Pendências ({clientes.filter(c => c.situacaoFinanceira === 'inadimplente').length})</option>
              <option value="aniversariantes">🎂 Aniversariantes ({numAniversariantes})</option>
              <option value="vip">👑 VIPs ({clientes.filter(c => (c.tags || '').toUpperCase().includes('VIP')).length})</option>
            </select>

            <select 
              value={filtroTagCRM} 
              onChange={(e) => setFiltroTagCRM(e.target.value)}
              className="select-pill-filter"
            >
              <option value="todas">🏷️ Tag CRM</option>
              <option value="VIP">👑 VIP</option>
              <option value="RECORRENTE">🔄 RECORRENTE</option>
              <option value="NOVO">✨ NOVO</option>
              <option value="EXIGENTE">⭐ EXIGENTE</option>
              <option value="ORGANIZADO">📋 ORGANIZADO</option>
              <option value="ECONÔMICO">🏷️ ECONÔMICO</option>
              <option value="FAMÍLIA">👪 FAMÍLIA</option>
              <option value="PROBLEMÁTICO">⚠️ PROBLEMÁTICO</option>
            </select>

            {/* FILTRO POR TIPO DE EVENTO */}
            {tiposEventoUnicos.length > 0 && (
              <select
                value={filtroTipoEvento}
                onChange={(e) => setFiltroTipoEvento(e.target.value)}
                className="select-pill-filter"
              >
                <option value="todos">🎭 Evento</option>
                {tiposEventoUnicos.map(tipo => (
                  <option key={tipo} value={tipo}>🎉 {tipo}</option>
                ))}
              </select>
            )}

            <button type="button" onClick={() => setOrdemAlfabetica(prev => prev === 'A-Z' ? 'Z-A' : 'A-Z')} className="select-pill-filter btn-sort-celebre">
              <i className={ordemAlfabetica === 'A-Z' ? "fas fa-sort-alpha-down" : "fas fa-sort-alpha-up"}></i> Ordem: {ordemAlfabetica}
            </button>
          </div>
        </div>

        {/* PÍLULAS DE STATUS DESKTOP */}
        <div className="filter-pills-strip desktop-pills-only">
          <button 
            type="button"
            className={`pill-btn ${filtroStatus === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('todos')}
          >
            Todos <span className="pill-badge">{clientes.length}</span>
          </button>
          {numPendentesAprovacao > 0 && (
            <button 
              type="button"
              className={`pill-btn ${filtroStatus === 'pendentes' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('pendentes')}
            >
              ⏳ Aguardando Aprovação <span className="pill-badge">{numPendentesAprovacao}</span>
            </button>
          )}
          <button 
            type="button"
            className={`pill-btn ${filtroStatus === 'adimplentes' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('adimplentes')}
          >
            Adimplentes <span className="pill-badge">{clientes.filter(c => c.situacaoFinanceira === 'adimplente').length}</span>
          </button>
          <button 
            type="button"
            className={`pill-btn ${filtroStatus === 'inadimplentes' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('inadimplentes')}
          >
            Pendências <span className="pill-badge">{clientes.filter(c => c.situacaoFinanceira === 'inadimplente').length}</span>
          </button>
          <button 
            type="button"
            className={`pill-btn ${filtroStatus === 'aniversariantes' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('aniversariantes')}
          >
            🎂 Aniversariantes <span className="pill-badge">{numAniversariantes}</span>
          </button>
          <button 
            type="button"
            className={`pill-btn ${filtroStatus === 'vip' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('vip')}
          >
            👑 VIPs <span className="pill-badge">{clientes.filter(c => (c.tags || '').toUpperCase().includes('VIP')).length}</span>
          </button>
        </div>
      </div>

      {/* TABELA DE CLIENTES (DESKTOP) & LISTA DE CARDS (MOBILE) */}
      {loading ? (
        <div className="loading-state-box">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Carregando carteira de clientes...</p>
        </div>
      ) : (
        <>
          {/* TABELA TRADICIONAL PARA DESKTOP */}
          <div className="table-responsive-card table-desktop-view">
            <table className="custom-table-pro">
              <thead>
                <tr>
                  <th width="35%">CLIENTE</th>
                  <th width="23%">CONTATO</th>
                  <th width="22%">ÚLTIMA LOCAÇÃO</th>
                  <th width="15%" className="text-center">SITUAÇÃO</th>
                  <th width="5%" className="text-center">AÇÕES</th> 
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 ? (
                   <tr>
                     <td colSpan="5" className="empty-table-cell">
                       <i className="fas fa-folder-open empty-icon"></i>
                       <p>Nenhum cliente encontrado para os filtros selecionados.</p>
                     </td>
                   </tr>
                ) : (
                  clientesFiltrados.map(c => {
                    const nomeBonito = formatarNomeCapitalizado(c.tipoPessoa === 'juridica' ? c.nomeFantasia : c.nome || '?');
                    const tagColorida = c.tags ? getTagStyle(c.tags) : null;
                    const eAniversariante = isAniversarianteDoMes(c.dataNascimento || c.dataNasc);
                    const isInadimplente = c.situacaoFinanceira === 'inadimplente';
                    const isRecorrente = clientesRecorrentesSet.has(c.id);

                    return (
                      <tr key={c.id} onMouseLeave={() => setMenuAberto(null)} className="table-row-hover" onClick={() => { setClienteVisualizacao(c); setAbaAtiva('dados'); }}> 
                        
                        {/* CLIENTE & AVATAR */}
                        <td className="cliente-cell">
                          <div className="cliente-info-wrapper">
                            {c.foto ? (
                                <img src={c.foto} className="avatar-quadrado" alt={nomeBonito} />
                            ) : (
                                <div className="avatar-quadrado avatar-letra-gold">{nomeBonito.charAt(0)}</div>
                            )}
                            <div className="user-details">
                              <div className="client-header-info" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                 <strong className="client-name">{nomeBonito}</strong>
                                 {(() => {
                                   const vip = getSeloVIPCliente(c.id);
                                   if (vip) {
                                     return (
                                       <span 
                                         className="badge-ranking-cliente" 
                                         style={{ backgroundColor: vip.bg, color: vip.color, border: `1px solid ${vip.border}`, padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '850', cursor: 'pointer' }}
                                         title={`LTV Acumulado: R$ ${vip.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${vip.qtdFestas} locações`}
                                       >
                                         {vip.badge}
                                       </span>
                                     );
                                   }
                                   return isRecorrente ? (
                                     <span className="badge-recorrente-cliente" title="Cliente Recorrente: 2 ou mais locações confirmadas">
                                       💎 RECORRENTE
                                     </span>
                                   ) : null;
                                 })()}
                                  {eAniversariante && (
                                    <span className="badge-aniversario-mini" title="Aniversariante deste Mês!">
                                      🎂 ANIVERSARIANTE
                                    </span>
                                  )}
                                  {tagColorida && (
                                      <span className="tag-badge-dynamic" style={{ backgroundColor: tagColorida.bg, color: tagColorida.color, border: `1px solid ${tagColorida.border}` }}>
                                          {c.tags}
                                      </span>
                                  )}
                              </div>
                              <span className="client-doc">
                                <i className="far fa-id-card"></i> {c.tipoPessoa === 'juridica' ? `CNPJ: ${c.cnpj || '-'}` : c.cpf ? `CPF: ${c.cpf}` : 'Sem documento'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* CONTATO & WHATSAPP */}
                        <td className="info-cell" onClick={e => e.stopPropagation()}>
                          {c.celular ? (
                            <div className="contact-whatsapp-row">
                              <span className="contact-phone">{formatarTelefone(c.celular)}</span>
                              <button 
                                onClick={() => abrirModalWhatsApp(c)}
                                className={`btn-zap-icon ${isInadimplente ? 'btn-zap-cobranca' : eAniversariante ? 'btn-zap-aniversario' : ''}`}
                                title="Enviar WhatsApp (Escolher modelo / Anexar Imagem)"
                              >
                                <i className="fab fa-whatsapp"></i>
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted">--</span>
                          )}
                          {c.email && (
                            <div className="contact-email-sub">{c.email}</div>
                          )}
                        </td>

                        {/* ÚLTIMA LOCAÇÃO */}
                        <td className="info-cell">
                          {(() => {
                            const ult = getUltimaLocacao(c.id);
                            if (ult) {
                              return (
                                <div className="last-rental-box">
                                  <span className="rental-date">
                                    <i className="far fa-calendar-alt text-amber"></i> {ult.data}
                                  </span>
                                  <span className="rental-theme" title={ult.tema}>
                                    🎉 {ult.tema}
                                  </span>
                                </div>
                              );
                            }
                            return <span className="text-muted">-- Sem locações</span>;
                          })()}
                        </td>

                        {/* SITUAÇÃO FINANCEIRA E APROVAÇÃO */}
                        <td className="status-cell text-center">
                          {c.statusAprovacao === 'pendente' || c.situacaoFinanceira === 'pendente' ? (
                            <span className="badge-status-pro pendente" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74', fontWeight: '850' }}>
                              <i className="fas fa-clock"></i> AGUARDANDO APROVAÇÃO
                            </span>
                          ) : c.situacaoFinanceira === 'inadimplente' ? (
                            <span 
                              onClick={(e) => verPorQueInadimplente(e, c)} 
                              className="badge-status-pro devedor"
                            >
                              <i className="fas fa-exclamation-triangle"></i> PENDÊNCIAS
                            </span>
                          ) : (
                            <span className="badge-status-pro ok">
                              <i className="fas fa-check-circle"></i> ADIMPLENTE
                            </span>
                          )}
                        </td>

                        {/* MENU DE AÇÕES */}
                        <td className="actions-cell text-center" onClick={e => e.stopPropagation()}>
                          <div className="dropdown-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {(c.statusAprovacao === 'pendente' || c.situacaoFinanceira === 'pendente') && (
                              <button 
                                type="button"
                                onClick={(e) => aprovarCliente(e, c.id, c.nome || c.nomeFantasia)} 
                                className="btn-aprovar-card"
                                title="Aprovar Cadastro do Cliente"
                                style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.74rem', fontWeight: '850', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)' }}
                              >
                                ✓ Aprovar
                              </button>
                            )}

                            <button className="btn-pontinhos" onClick={(e) => { e.stopPropagation(); setMenuAberto(menuAberto === c.id ? null : c.id); }}>
                              <i className="fas fa-ellipsis-v"></i>
                            </button>

                            {menuAberto === c.id && (
                              <div className="menu-suspenso fade-in">
                                {(c.statusAprovacao === 'pendente' || c.situacaoFinanceira === 'pendente') && (
                                  <button onClick={(e) => { aprovarCliente(e, c.id, c.nome || c.nomeFantasia); setMenuAberto(null); }} className="item-menu" style={{ color: '#10b981', fontWeight: '800' }}>
                                    <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i> Aprovar Cadastro
                                  </button>
                                )}

                                <button onClick={() => { setClienteVisualizacao(c); setAbaAtiva('dados'); setMenuAberto(null); }} className="item-menu">
                                  <i className="fas fa-user-circle color-purple"></i> Ver Perfil Completo
                                </button>

                                <button onClick={() => { navigate('/cadastro-cliente', { state: { clienteEditando: c } }); setMenuAberto(null); }} className="item-menu">
                                  <i className="fas fa-edit color-blue"></i> Editar Cadastro
                                </button>
                                <button onClick={() => verificarETentarNovaLocacao(c)} className="item-menu">
                                  <i className="fas fa-cart-plus color-green"></i> Nova Locação
                                </button>
                                <div className="menu-divider"></div>
                                <button onClick={() => { excluirCliente(c.id, c.nome || c.nomeFantasia); setMenuAberto(null); }} className="item-menu item-excluir">
                                  <i className="fas fa-trash-alt"></i> Excluir Cliente
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* LISTA DE CARDS DEDICADOS EXCLUSIVA PARA CELULAR */}
          <div className="clientes-mobile-cards-list">
            {clientesFiltrados.length === 0 ? (
              <div className="empty-state-mobile">
                <i className="fas fa-folder-open empty-icon"></i>
                <p>Nenhum cliente encontrado.</p>
              </div>
            ) : (
              clientesFiltrados.map(c => {
                const nomeBonito = formatarNomeCapitalizado(c.tipoPessoa === 'juridica' ? c.nomeFantasia : c.nome || '?');
                const eAniversariante = isAniversarianteDoMes(c.dataNascimento || c.dataNasc);
                const isRecorrente = clientesRecorrentesSet.has(c.id);
                const ultLoc = getUltimaLocacao(c.id);
                const vip = getSeloVIPCliente(c.id);

                return (
                  <div key={c.id} className="cliente-card-mobile" onClick={() => { setClienteVisualizacao(c); setAbaAtiva('dados'); }}>
                    
                    {/* CABEÇALHO DO CARD */}
                    <div className="card-mobile-header">
                      <div className="card-mobile-avatar-col">
                        {c.foto ? (
                          <img src={c.foto} className="card-avatar-circle" alt={nomeBonito} />
                        ) : (
                          <div className="card-avatar-circle">{nomeBonito.charAt(0)}</div>
                        )}
                      </div>

                      <div className="card-mobile-title-col">
                        <div className="card-mobile-name-row">
                          <span className="card-client-name">{nomeBonito}</span>
                          {vip ? (
                            <span className="card-badge-vip" style={{ backgroundColor: vip.bg, color: vip.color, border: `1px solid ${vip.border}` }}>
                              {vip.badge}
                            </span>
                          ) : isRecorrente ? (
                            <span className="card-badge-recorrente">💎 RECORRENTE</span>
                          ) : null}
                          {eAniversariante && (
                            <span className="card-badge-bday" title="Aniversariante do Mês">🎂</span>
                          )}
                        </div>
                        <span className="card-client-doc">
                          <i className="far fa-id-card"></i> {c.tipoPessoa === 'juridica' ? `CNPJ: ${c.cnpj || '-'}` : c.cpf ? `CPF: ${c.cpf}` : 'Sem documento'}
                        </span>
                      </div>

                      <div className="card-mobile-actions-col" onClick={e => e.stopPropagation()}>
                        <button 
                          type="button" 
                          className="btn-dots-mobile"
                          onClick={() => setMenuAberto(menuAberto === c.id ? null : c.id)}
                        >
                          <i className="fas fa-ellipsis-v"></i>
                        </button>

                        {menuAberto === c.id && (
                          <div className="menu-suspenso fade-in">
                            {(c.statusAprovacao === 'pendente' || c.situacaoFinanceira === 'pendente') && (
                              <button onClick={(e) => { aprovarCliente(e, c.id, c.nome || c.nomeFantasia); setMenuAberto(null); }} className="item-menu" style={{ color: '#10b981', fontWeight: '800' }}>
                                <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i> Aprovar Cadastro
                              </button>
                            )}
                            <button onClick={() => { setClienteVisualizacao(c); setAbaAtiva('dados'); setMenuAberto(null); }} className="item-menu">
                              <i className="fas fa-user-circle color-purple"></i> Ver Perfil Completo
                            </button>
                            <button onClick={() => { navigate('/cadastro-cliente', { state: { clienteEditando: c } }); setMenuAberto(null); }} className="item-menu">
                              <i className="fas fa-edit color-blue"></i> Editar Cadastro
                            </button>
                            <button onClick={() => verificarETentarNovaLocacao(c)} className="item-menu">
                              <i className="fas fa-cart-plus color-green"></i> Nova Locação
                            </button>
                            <div className="menu-divider"></div>
                            <button onClick={() => { excluirCliente(c.id, c.nome || c.nomeFantasia); setMenuAberto(null); }} className="item-menu item-excluir">
                              <i className="fas fa-trash-alt"></i> Excluir Cliente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CORPO EM 2 COLUNAS */}
                    <div className="card-mobile-body-grid">
                      
                      {/* COLUNA ESQUERDA (DADOS) */}
                      <div className="card-mobile-left">
                        <div className="card-mobile-data-row">
                          <i className="fas fa-phone-alt icon-muted"></i>
                          <span className="card-phone-text">{c.celular ? formatarTelefone(c.celular) : '--'}</span>
                        </div>
                        <div className="card-mobile-data-row">
                          <i className="far fa-calendar-alt icon-amber"></i>
                          <span className="card-event-text">
                            {ultLoc ? `${ultLoc.data} · 🎉 ${ultLoc.tema}` : 'Sem locações'}
                          </span>
                        </div>
                      </div>

                      {/* COLUNA DIREITA (WHATSAPP + STATUS) */}
                      <div className="card-mobile-right" onClick={e => e.stopPropagation()}>
                        {c.celular && (
                          <button 
                            type="button"
                            onClick={() => abrirModalWhatsApp(c)}
                            className="card-btn-zap"
                            title="Enviar WhatsApp"
                          >
                            <i className="fab fa-whatsapp"></i> WhatsApp
                          </button>
                        )}

                        {c.statusAprovacao === 'pendente' || c.situacaoFinanceira === 'pendente' ? (
                          <span className="card-status-badge badge-pendente">
                            <i className="fas fa-clock"></i> PENDENTE
                          </span>
                        ) : c.situacaoFinanceira === 'inadimplente' ? (
                          <span onClick={(e) => verPorQueInadimplente(e, c)} className="card-status-badge badge-devedor">
                            <i className="fas fa-exclamation-triangle"></i> PENDÊNCIAS
                          </span>
                        ) : (
                          <span className="card-status-badge badge-ok">
                            <i className="fas fa-check-circle"></i> ADIMPLENTE
                          </span>
                        )}
                      </div>

                    </div>

                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* FICHÁRIO COMPLETO DO CLIENTE (PERFIL DE LUXO) */}
      {clienteVisualizacao && (() => {
        const perfilNomeBonito = formatarNomeCapitalizado(
          clienteVisualizacao.tipoPessoa === 'juridica' 
            ? (clienteVisualizacao.nomeFantasia || clienteVisualizacao.razaoSocial || clienteVisualizacao.nome) 
            : (clienteVisualizacao.nome || clienteVisualizacao.razaoSocial)
        );

        const { historico: perfilHistorico = [], totalGasto: perfilTotalGasto = 0 } = getHistoricoDoCliente(clienteVisualizacao.id);

        const tagTexto = clienteVisualizacao.tags || (perfilTotalGasto >= 5000 || perfilHistorico.length >= 5 ? 'VIP' : perfilHistorico.length >= 2 ? 'RECORRENTE' : 'NOVO');
        const perfilTagColorida = getTagStyle ? getTagStyle(tagTexto) : { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' };
        const historicoNotasCliente = clienteVisualizacao.historicoNotas || [];

        const enderecoCompletoStr = clienteVisualizacao.logradouro 
          ? `${clienteVisualizacao.logradouro}, ${clienteVisualizacao.numero || 'S/N'}${clienteVisualizacao.complemento ? ' - ' + clienteVisualizacao.complemento : ''}, ${clienteVisualizacao.bairro || ''}, ${clienteVisualizacao.cidade || ''}/${clienteVisualizacao.uf || ''} (CEP: ${clienteVisualizacao.cep || ''})` 
          : null;

        const mapsUrl = enderecoCompletoStr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompletoStr)}` : null;

        return (
          <div onClick={() => setClienteVisualizacao(null)} className="modal-overlay-perfil fade-in">
            <div onClick={e => e.stopPropagation()} className="modal-content-perfil-large">
              <button onClick={() => setClienteVisualizacao(null)} className="btn-fechar-perfil">&times;</button>

              <div className="perfil-layout-split">
                
                {/* ESQUERDA: SIDEBAR EXECUTIVE DO CLIENTE */}
                <div className="perfil-left-col">
                  <div className={`perfil-foto-max ${!clienteVisualizacao.foto ? 'placeholder-foto-max' : ''}`}>
                    {clienteVisualizacao.foto ? (
                      <img src={clienteVisualizacao.foto} alt={perfilNomeBonito} />
                    ) : (
                      perfilNomeBonito.charAt(0)
                    )}
                  </div>
                  
                  <h2 className="perfil-nome-titulo">{perfilNomeBonito}</h2>
                  
                  {/* PÍLULAS DE ETIQUETAS E STAKEHOLDERS */}
                  <div className="perfil-tags-row-flex" style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <span className="perfil-tag-destaque" style={{ backgroundColor: perfilTagColorida.bg, color: perfilTagColorida.color, border: `1px solid ${perfilTagColorida.border}` }}>
                      <i className="fas fa-crown"></i> {tagTexto}
                    </span>
                    <span className={`badge-status-pro ${clienteVisualizacao.situacaoFinanceira === 'inadimplente' ? 'devedor' : 'ok'}`}>
                      {clienteVisualizacao.situacaoFinanceira === 'inadimplente' ? '⚠️ PENDÊNCIAS' : '✅ ADIMPLENTE'}
                    </span>
                    <span className="badge-tipo-pessoa" style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '800' }}>
                      {clienteVisualizacao.tipoPessoa === 'juridica' ? '🏢 PJ' : '👤 PF'}
                    </span>
                  </div>

                  <div className="perfil-mini-stats">
                    <div className="stat-line">
                      <span><i className="fas fa-coins text-gold"></i> LTV (Gasto Acumulado):</span> 
                      <strong>R$ {perfilTotalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                    </div>
                    <div className="stat-line">
                      <span><i className="fas fa-boxes text-blue"></i> Total Locações:</span> 
                      <strong>{perfilHistorico.length} pedido{perfilHistorico.length === 1 ? '' : 's'}</strong>
                    </div>
                    <div className="stat-line">
                      <span><i className="fas fa-calendar-alt text-purple"></i> Cliente Desde:</span> 
                      <strong>{clienteVisualizacao.criadoEm ? new Date(clienteVisualizacao.criadoEm).toLocaleDateString('pt-BR') : '-'}</strong>
                    </div>
                  </div>

                  <div className="perfil-actions-stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '14px' }}>
                    {clienteVisualizacao.celular && (
                      <button 
                        onClick={() => abrirModalWhatsApp(clienteVisualizacao)}
                        className="btn-primary-celebre"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <i className="fab fa-whatsapp"></i> Falar no WhatsApp
                      </button>
                    )}

                    <button 
                      onClick={() => verificarETentarNovaLocacao(clienteVisualizacao)} 
                      className="btn-add-nota"
                      style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', height: '38px', borderRadius: '10px', fontSize: '0.78rem' }}
                    >
                      <i className="fas fa-cart-plus"></i> Criar Nova Locação
                    </button>

                    <button 
                      onClick={() => { setClienteVisualizacao(null); navigate('/cadastro-cliente', { state: { clienteEditando: clienteVisualizacao } }); }} 
                      className="btn-editar-perfil-full"
                    >
                      <i className="fas fa-edit"></i> Editar Cadastro
                    </button>
                  </div>
                </div>

                {/* DIREITA: ABAS E DETALHES RICAS */}
                <div className="perfil-right-col">
                  <div className="perfil-tabs-header">
                    <button onClick={() => setAbaAtiva('dados')} className={`ptab ${abaAtiva === 'dados' ? 'active' : ''}`}>
                      <i className="fas fa-user"></i> Dados Cadastrais & CRM
                    </button>
                    <button onClick={() => setAbaAtiva('registros')} className={`ptab ${abaAtiva === 'registros' ? 'active' : ''}`}>
                      <i className="fas fa-history"></i> Histórico de Locações ({perfilHistorico.length})
                    </button>
                    <button onClick={() => setAbaAtiva('timeline')} className={`ptab ${abaAtiva === 'timeline' ? 'active' : ''}`}>
                      <i className="fas fa-stream"></i> Linha do Tempo ({gerarTimelineCompleta(clienteVisualizacao.id).length + historicoNotasCliente.length})
                    </button>
                    <button onClick={() => setAbaAtiva('financeiro')} className={`ptab ${abaAtiva === 'financeiro' ? 'active' : ''}`}>
                      <i className="fas fa-wallet"></i> Extrato Financeiro & Saldo
                    </button>
                  </div>
                  
                  <div className="perfil-tab-body">
                    {/* ABA 1: DADOS CADASTRAIS */}
                    {abaAtiva === 'dados' && (
                      <div className="perfil-dados-grid-wrapper">
                        
                        {/* QUADRO 1: IDENTIFICAÇÃO */}
                        <div className="perfil-section-box">
                          <h4 className="p-sec-title"><i className="fas fa-id-card"></i> Identificação do Cliente</h4>
                          <div className="perfil-dados-grid">
                            <div className="d-group">
                              <label>NOME / RAZÃO SOCIAL</label>
                              <span>{perfilNomeBonito}</span>
                            </div>
                            <div className="d-group">
                              <label>{clienteVisualizacao.tipoPessoa === 'juridica' ? 'CNPJ' : 'CPF'}</label>
                              <span>{clienteVisualizacao.cpf || clienteVisualizacao.cnpj || '-'}</span>
                            </div>
                            <div className="d-group">
                              <label>{clienteVisualizacao.tipoPessoa === 'juridica' ? 'INSCRIÇÃO ESTADUAL' : 'RG'}</label>
                              <span>{clienteVisualizacao.rg || clienteVisualizacao.inscricaoEstadual || '-'}</span>
                            </div>
                            <div className="d-group">
                              <label>🎂 DATA DE NASCIMENTO / ANIVERSÁRIO</label>
                              <span>{clienteVisualizacao.dataNascimento || clienteVisualizacao.dataNasc || '-'}</span>
                            </div>
                          </div>
                        </div>

                        {/* QUADRO 2: CONTATO & ORIGEM */}
                        <div className="perfil-section-box" style={{ marginTop: '16px' }}>
                          <h4 className="p-sec-title"><i className="fas fa-phone-alt"></i> Contatos e Origem</h4>
                          <div className="perfil-dados-grid">
                            <div className="d-group">
                              <label>CELULAR / WHATSAPP</label>
                              <span>{formatarTelefone(clienteVisualizacao.celular) || '-'}</span>
                            </div>
                            <div className="d-group">
                              <label>TELEFONE FIXO</label>
                              <span>{formatarTelefone(clienteVisualizacao.telefoneFixo) || '-'}</span>
                            </div>
                            <div className="d-group">
                              <label>E-MAIL</label>
                              <span style={{ wordBreak: 'break-all' }}>{clienteVisualizacao.email || '-'}</span>
                            </div>
                            <div className="d-group">
                              <label>COMO NOS CONHECEU?</label>
                              <span>{clienteVisualizacao.origem || 'Não informado'}</span>
                            </div>
                          </div>
                        </div>

                        {/* QUADRO 3: CRM & DATAS FESTIVAS DA FAMÍLIA */}
                        {clienteVisualizacao.datasComemorativas && (
                          <div className="perfil-section-box" style={{ marginTop: '16px', background: '#fdf2f8', borderColor: '#fbcfe8' }}>
                            <h4 className="p-sec-title" style={{ color: '#be185d' }}><i className="fas fa-gift"></i> 🎁 Aniversários da Família & Datas Festivas</h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#9d174d', fontWeight: '600' }}>
                              {clienteVisualizacao.datasComemorativas}
                            </p>
                          </div>
                        )}

                        {/* QUADRO 4: ENDEREÇO COMPLETO E ROTA NO GOOGLE MAPS */}
                        <div className="obs-group obs-box-wrapper" style={{ marginTop: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                              <i className="fas fa-map-marker-alt" style={{ color: '#ef4444' }}></i> ENDEREÇO COMPLETO DE ENTREGA
                            </label>
                            {mapsUrl && (
                              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-tmpl-chip" style={{ background: '#3b82f6', color: '#ffffff', borderColor: '#2563eb', fontWeight: '800', textDecoration: 'none' }}>
                                <i className="fas fa-directions"></i> Abrir Rota no Maps
                              </a>
                            )}
                          </div>
                          <div className="obs-box" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                            <p style={{ fontStyle: 'normal', color: 'var(--texto-principal)', margin: 0, fontWeight: '500' }}>
                              {enderecoCompletoStr || 'Endereço não cadastrado.'}
                            </p>
                          </div>
                        </div>

                        {/* QUADRO 5: OBSERVAÇÕES INTERNAS */}
                        <div className="obs-group obs-box-wrapper" style={{ marginTop: '16px' }}>
                          <label style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                            <i className="far fa-sticky-note"></i> OBSERVAÇÕES INTERNAS GERAIS
                          </label>
                          <div className="obs-box" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                            <p style={{ color: '#92400e', whiteSpace: 'pre-wrap', fontStyle: 'normal', margin: 0 }}>
                              {clienteVisualizacao.observacoes || 'Nenhuma observação registrada.'}
                            </p>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* ABA 2: HISTÓRICO DE PEDIDOS */}
                    {abaAtiva === 'registros' && (
                      <div className="historico-wrapper">
                        {perfilHistorico.length === 0 ? (
                          <div className="empty-history">
                            <i className="fas fa-calendar-times"></i> Nenhuma locação encontrada para este cliente.
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table-historico-simples">
                              <thead>
                                <tr>
                                  <th>Data / Serviço</th>
                                  <th>Valor Total</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {perfilHistorico.map(loc => {
                                  const st = String(loc.status || 'S/S').toLowerCase().replace(' ', '');
                                  const isCancelado = st.includes('cancelado') || loc.isOrcamentoVencido;
                                  let tipoServico = "DECORAÇÃO";
                                  if (loc.tipoServico || loc.modalidade) tipoServico = String(loc.tipoServico || loc.modalidade).toUpperCase();
                                  else if (loc.logistica && String(loc.logistica.tipoFrete || loc.logistica.frete).toUpperCase().includes('RETIRADA')) tipoServico = "PEGUE E MONTE";
                                  return (
                                    <tr key={loc.id} onClick={() => irParaLocacaoEspecifica(loc.id)} style={{ cursor: 'pointer' }}>
                                      <td>
                                        <span className="h-date">{loc.dataRetirada ? new Date(loc.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                                        <strong className="h-theme">{loc.tema || loc.temaDaFesta || loc.nomeTema || 'Sem tema'}</strong>
                                        <span className="h-type">{tipoServico}</span>
                                      </td>
                                      <td style={{ textDecoration: isCancelado ? 'line-through' : 'none', color: isCancelado ? '#94a3b8' : '#0f172a', fontWeight: '700' }}>
                                        R$ {Number(loc.valorTotal || loc.total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                      </td>
                                      <td><span className={`h-badge-mini ${st}`}>{loc.status?.toUpperCase() || 'S/S'}</span></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ABA 3: LINHA DO TEMPO & NOTAS CRM */}
                    {abaAtiva === 'timeline' && (() => {
                      const eventosLocacoes = gerarTimelineCompleta(clienteVisualizacao.id);
                      const notasCRM = historicoNotasCliente.map(n => ({
                        ...n,
                        _isNota: true,
                        data: new Date(n.dataHora)
                      }));

                      // Mesclar eventos de locação + notas CRM, ordenados por data desc
                      const todasEntradas = [
                        ...eventosLocacoes.map(e => ({ ...e, _isNota: false })),
                        ...notasCRM
                      ].sort((a, b) => b.data - a.data);

                      if (todasEntradas.length === 0) {
                        return (
                          <div className="timeline-wrapper">
                            <div className="empty-timeline-box" style={{ padding: '24px' }}>
                              <div className="empty-icon-circle"><i className="fas fa-route"></i></div>
                              <h4>Nenhum evento na linha do tempo</h4>
                              <p>Os marcos das locações e as notas CRM aparecerão aqui automaticamente.</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="timeline-wrapper">
                          <div className="timeline-feed-list-v2">
                            {todasEntradas.map((entrada, idx) => (
                              entrada._isNota ? (
                                // NOTA CRM
                                <div key={`nota-${entrada.id || idx}`} className="tl-item tl-nota">
                                  <div className="tl-dot" style={{ background: '#8b5cf6', borderColor: '#6d28d9' }}>💬</div>
                                  <div className="tl-card tl-card-nota">
                                    <div className="tl-card-header">
                                      <span className="tl-badge" style={{ background: '#f5f3ff', color: '#6d28d9' }}>{entrada.tipo || 'Nota'}</span>
                                      <span className="tl-date">{entrada.data.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <p className="tl-text">{entrada.texto}</p>
                                    <div className="tl-author">
                                      <i className="fas fa-user-circle"></i> {entrada.autor || 'Equipe'}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // EVENTO DE LOCAÇÃO
                                <div key={`loc-${entrada.id || idx}`} className="tl-item tl-locacao">
                                  <div className="tl-dot" style={{ background: '#3b82f6', borderColor: '#1d4ed8' }}>📦</div>
                                  <div className="tl-card tl-card-loc">
                                    <div className="tl-card-header">
                                      <span className="tl-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pedido #{entrada.numeroPedido || entrada.id?.substring(0,6)}</span>
                                      <span className="tl-date">{entrada.data.toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <h5 className="tl-title">{entrada.titulo}</h5>
                                    <p className="tl-sub">{entrada.descricao}</p>
                                    <div className="tl-footer">
                                      <span className={`status-pill ${entrada.status}`}>{entrada.status}</span>
                                      <strong className="tl-val">R$ {Number(entrada.valorTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong>
                                    </div>
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ABA 4: EXTRATO FINANCEIRO & SALDO */}
                    {abaAtiva === 'financeiro' && (() => {
                      const locacoesValidas = perfilHistorico.filter(l => !String(l.status || '').toLowerCase().includes('cancelado'));
                      const totalContratado = locacoesValidas.reduce((acc, l) => acc + Number(l.valorTotal || l.total || 0), 0);
                      const totalPago = locacoesValidas.reduce((acc, l) => acc + Number(l.valorPago || 0), 0);
                      const saldoDevedor = Math.max(0, totalContratado - totalPago);

                      return (
                        <div className="perfil-financeiro-wrapper">
                          
                          {/* CARDS DE BALANÇO DO CLIENTE */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>👑 Total Contratado (LTV)</span>
                              <div style={{ fontSize: '1.15rem', fontWeight: '850', color: '#0f172a', marginTop: '2px' }}>
                                R$ {totalContratado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>

                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>✅ Total Liquidado (Pago)</span>
                              <div style={{ fontSize: '1.15rem', fontWeight: '850', color: '#15803d', marginTop: '2px' }}>
                                R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>

                            <div style={{ background: saldoDevedor > 0 ? '#fef2f2' : '#f8fafc', border: saldoDevedor > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: saldoDevedor > 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase' }}>
                                {saldoDevedor > 0 ? '⚠️ Saldo Devedor / A Receber' : '🟢 Situação Financeira'}
                              </span>
                              <div style={{ fontSize: '1.15rem', fontWeight: '850', color: saldoDevedor > 0 ? '#b91c1c' : '#16a34a', marginTop: '2px' }}>
                                {saldoDevedor > 0 ? `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '100% Quitado'}
                              </div>
                            </div>
                          </div>

                          {/* LISTAGEM DE PEDIDOS COM STATUS FINANCEIRO E BOTÃO LANÇAR RECEBIMENTO */}
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#334155', fontWeight: '800', textTransform: 'uppercase' }}>
                            📋 Extrato de Pedidos & Pagamentos
                          </h4>

                          {locacoesValidas.length === 0 ? (
                            <div className="empty-history">
                              <i className="fas fa-wallet"></i> Nenhum pedido registrado para este cliente.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {locacoesValidas.map(loc => {
                                const tot = Number(loc.valorTotal || loc.total || 0);
                                const pg = Number(loc.valorPago || 0);
                                const sld = Math.max(0, tot - pg);
                                const numPed = loc.numeroPedido || (loc.id ? loc.id.slice(0,6).toUpperCase() : '');

                                return (
                                  <div 
                                    key={loc.id}
                                    style={{
                                      background: '#ffffff',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '12px',
                                      padding: '12px 14px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '12px',
                                      flexWrap: 'wrap'
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Pedido #{numPed}</strong>
                                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                          {loc.dataRetirada ? new Date(loc.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                        </span>
                                        <span style={{ 
                                          padding: '2px 6px', 
                                          borderRadius: '6px', 
                                          fontSize: '0.65rem', 
                                          fontWeight: '800',
                                          background: sld === 0 ? '#dcfce7' : (pg > 0 ? '#fef3c7' : '#fee2e2'),
                                          color: sld === 0 ? '#166534' : (pg > 0 ? '#92400e' : '#991b1b')
                                        }}>
                                          {sld === 0 ? 'QUITADO' : (pg > 0 ? 'PARCIAL' : 'PENDENTE')}
                                        </span>
                                      </div>

                                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                                        Total: <b>R$ {tot.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b> | 
                                        Pago: <b style={{ color: '#16a34a' }}>R$ {pg.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b> | 
                                        Resta: <b style={{ color: sld > 0 ? '#b91c1c' : '#16a34a' }}>R$ {sld.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      {sld > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setClienteVisualizacao(null);
                                            navigate('/novo-lancamento', {
                                              state: {
                                                locacaoId: loc.id,
                                                clienteId: clienteVisualizacao.id,
                                                clienteNome: perfilNomeBonito,
                                                tipo: 'entrada'
                                              }
                                            });
                                          }}
                                          style={{
                                            padding: '6px 12px',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '800',
                                            fontSize: '0.74rem',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
                                          }}
                                        >
                                          💰 Lançar Recebimento
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => irParaLocacaoEspecifica(loc.id)}
                                        style={{
                                          padding: '6px 10px',
                                          background: '#f1f5f9',
                                          color: '#475569',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '8px',
                                          fontSize: '0.74rem',
                                          fontWeight: '700',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Ver Pedido
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {saldoDevedor > 0 && clienteVisualizacao.celular && (
                            <div style={{ marginTop: '16px', padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <div>
                                <strong style={{ color: '#92400e', fontSize: '0.85rem' }}>💬 Cobrança Rápida por WhatsApp</strong>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#b45309' }}>Envie um lembrete amigável com o saldo devedor e os dados de pagamento.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => abrirModalWhatsApp(clienteVisualizacao, 'cobranca')}
                                style={{
                                  padding: '8px 14px',
                                  background: '#25d366',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontWeight: '800',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <i className="fab fa-whatsapp"></i> Cobrar Saldo
                              </button>
                            </div>
                          )}

                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL ANÁLISE DE PENDÊNCIA */}
      {modalAberto && (
        <div className="modal-overlay-financeiro fade-in">
          <div className="modal-content-financeiro">
            <div className="modal-header-fin">
              <div className="header-icon-title">
                  <div className="icon-warning"><i className="fas fa-exclamation-triangle"></i></div>
                  <div>
                      <h2>Análise de Pendência</h2>
                      <p className="modal-subtitle">{detalhesDivida.cliente}</p>
                  </div>
              </div>
              <button onClick={() => setModalAberto(false)} className="btn-close-modal">&times;</button>
            </div>
            <div className="modal-body-fin">
              <div className="alerta-explicativo">
                  <strong>Por que consta como inadimplente?</strong>
                  <p>O sistema identificou locações que <b>já passaram da data</b>, mas o pagamento ainda não foi marcado como <b>PAGO</b> ou <b>QUITADO</b>.</p>
              </div>
              <div className="lista-pendencias">
                {detalhesDivida.pendencias.map(p => {
                  const vTotal = Number(p.valorTotal || p.total || 0);
                  const vPago = Number(p.valorPago || 0);
                  const saldoDevedor = vTotal - vPago;
                  return (
                    <div key={p.id} className="card-pendencia-detalhada">
                      <div className="p-header"><span className="p-id">PEDIDO {p.numeroPedido ? `#${p.numeroPedido}` : `#${p.id.substring(0,6).toUpperCase()}`}</span></div>
                      <div className="p-detalhes">
                        <p>📅 <strong>Vencimento:</strong> {p.dataRetirada || p.dataEvento}</p>
                        <p>💰 <strong>Valor Total:</strong> R$ {vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p>🔴 <strong>Falta Pagar:</strong> <span style={{color: '#e53e3e', fontWeight: 'bold'}}>R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                      </div>

                      <div className="pendencia-actions-row">
                        {detalhesDivida.clienteObj?.celular && (
                          <button 
                            onClick={() => { setModalAberto(false); abrirModalWhatsApp(detalhesDivida.clienteObj, 'cobranca'); }}
                            className="btn-cobranca-whatsapp"
                          >
                            <i className="fab fa-whatsapp"></i> Enviar Cobrança Pix
                          </button>
                        )}
                        <button onClick={() => irParaLocacaoEspecifica(p.id)} className="btn-ir-locacao-destaque">
                          Localizar e Receber <i className="fas fa-arrow-right"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL INTERATIVA DE SELEÇÃO DE MENSAGEM DO WHATSAPP + ANEXO DE IMAGEM 🔥 */}
      {modalZapCliente && (
        <div onClick={() => setModalZapCliente(null)} className="modal-overlay-zap fade-in">
          <div onClick={e => e.stopPropagation()} className="modal-content-zap">
            
            <div className="modal-header-zap">
              <div className="zap-header-title">
                <span className="icon-zap-header"><i className="fab fa-whatsapp"></i></span>
                <div>
                  <h3>Enviar WhatsApp com Imagem</h3>
                  <p>Para: <strong>{formatarNomeCapitalizado(modalZapCliente.nome || modalZapCliente.nomeFantasia)}</strong> ({formatarTelefone(modalZapCliente.celular)})</p>
                </div>
              </div>
              <button onClick={() => setModalZapCliente(null)} className="btn-close-modal">&times;</button>
            </div>

            <div className="modal-body-zap">
              
              {/* MODELOS DE TEXTO */}
              <label className="zap-section-title"><i className="fas fa-sliders-h"></i> 1. Escolha o modelo da mensagem:</label>
              
              <div className="zap-modelos-grid">
                <button 
                  className={`model-card-zap ${tipoMensagemZap === 'atendimento' ? 'active' : ''}`}
                  onClick={() => selecionarModeloZap('atendimento')}
                >
                  <i className="fas fa-comment-dots icon-blue"></i>
                  <span>Atendimento / Geral</span>
                </button>

                <button 
                  className={`model-card-zap ${tipoMensagemZap === 'agradecimento' ? 'active' : ''}`}
                  onClick={() => selecionarModeloZap('agradecimento')}
                >
                  <i className="fas fa-heart icon-green"></i>
                  <span>Agradecimento Pós-Festa</span>
                </button>

                <button 
                  className={`model-card-zap ${tipoMensagemZap === 'cobranca' ? 'active' : ''}`}
                  onClick={() => selecionarModeloZap('cobranca')}
                >
                  <i className="fas fa-hand-holding-usd icon-red"></i>
                  <span>Cobrança / Pendência Pix</span>
                </button>

                <button 
                  className={`model-card-zap ${tipoMensagemZap === 'aniversario' ? 'active' : ''}`}
                  onClick={() => selecionarModeloZap('aniversario')}
                >
                  <i className="fas fa-birthday-cake icon-pink"></i>
                  <span>Feliz Aniversário</span>
                </button>

                <button 
                  className={`model-card-zap ${tipoMensagemZap === 'promocao' ? 'active' : ''}`}
                  onClick={() => selecionarModeloZap('promocao')}
                >
                  <i className="fas fa-gift icon-gold"></i>
                  <span>Novidades / Promoção</span>
                </button>
              </div>

              {/* UPLOAD / ANEXO DE IMAGEM */}
              <div className="zap-image-upload-section">
                <label className="zap-section-title"><i className="fas fa-paperclip"></i> 2. Anexar Imagem / Foto do Acervo ou Comprovante (Opcional):</label>
                
                {imagemPreviewUrl ? (
                  <div className="zap-img-preview-card">
                    <div className="preview-img-wrapper">
                      <img src={imagemPreviewUrl} alt="Preview Anexo" />
                    </div>
                    <div className="preview-img-info">
                      <strong>{imagemAnexoFile ? imagemAnexoFile.name : 'Imagem anexada'}</strong>
                      {carregandoUploadImg ? (
                        <span className="status-upload-link"><i className="fas fa-spinner fa-spin"></i> Gerando link de acesso...</span>
                      ) : (
                        <span className="status-upload-link ok"><i className="fas fa-check-circle"></i> Link da imagem adicionado ao texto!</span>
                      )}

                      <div className="preview-img-actions">
                        <button onClick={copiarImagemAreaTransferencia} className="btn-copy-img" title="Copiar Imagem para colar (Ctrl+V) no WhatsApp">
                          <i className="fas fa-copy"></i> {imagemCopiadaComSucesso ? 'COPIADA! (CTRL+V)' : 'COPIAR IMAGEM'}
                        </button>
                        <button onClick={removerImagemZap} className="btn-remove-img" title="Remover Imagem">
                          <i className="fas fa-trash"></i> Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="zap-upload-dropzone">
                    <i className="fas fa-cloud-upload-alt upload-icon"></i>
                    <span>Clique aqui para selecionar uma Foto / Imagem do computador</span>
                    <small>Formatações aceitas: PNG, JPG, JPEG ou WEBP</small>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleUparImagemZap} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                )}
              </div>

              {/* TEXTAREA MENSAGEM */}
              <div className="zap-edit-area">
                <label className="zap-section-title">
                  <i className="fas fa-edit"></i> 3. Texto Final da Mensagem (pode editar livremente):
                </label>
                <textarea 
                  rows="5"
                  className="zap-textarea"
                  value={textoMensagemZap}
                  onChange={(e) => { setTextoMensagemZap(e.target.value); setTipoMensagemZap('custom'); }}
                />
              </div>

            </div>

            <div className="modal-footer-zap">
              <button onClick={() => setModalZapCliente(null)} className="btn-secondary-celebre">
                Cancelar
              </button>
              <button onClick={dispararWhatsAppFinal} className="btn-send-zap">
                <i className="fab fa-whatsapp"></i> ABRIR NO WHATSAPP
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🚨 MODAL DE TRAVA DE SEGURANÇA: CLIENTE COM PENDÊNCIAS FINANCEIRAS */}
      {modalTravaLocacao && (
        <div 
          className="fade-in" 
          onClick={() => setModalTravaLocacao(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{
              maxWidth: '540px',
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(220, 38, 38, 0.2)',
              borderTop: '6px solid #dc2626'
            }}
          >
            <div style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  🚨
                </div>
                <div>
                  <h3 style={{ color: '#991b1b', margin: 0, fontSize: '1.05rem', fontWeight: '900', letterSpacing: '-0.2px' }}>
                    TRAVA DE SEGURANÇA: PENDÊNCIAS
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: '700' }}>
                    Atenção antes de formalizar nova locação de acervo
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setModalTravaLocacao(null)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: 'none',
                  color: '#dc2626',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontSize: '1.3rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '22px' }}>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '14px', padding: '16px', marginBottom: '18px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#9f1239', lineHeight: '1.55' }}>
                  O(a) cliente <strong>{modalTravaLocacao.cliente.nome || modalTravaLocacao.cliente.nomeFantasia}</strong> possui <strong>débitos em aberto / status inadimplente</strong> no valor acumulado de <strong style={{ color: '#e11d48', fontSize: '1.05rem', display: 'inline-block', marginLeft: '4px' }}>R$ {modalTravaLocacao.valorDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                </p>
              </div>

              {modalTravaLocacao.pendencias && modalTravaLocacao.pendencias.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: '850', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    📌 Pedidos com Saldo Devedor em Aberto:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '170px', overflowY: 'auto' }}>
                    {modalTravaLocacao.pendencias.map(p => {
                      const vTotal = Number(p.valorTotal || p.total || 0);
                      const vPago = Number(p.valorPago || 0);
                      const saldo = vTotal - vPago;
                      const num = p.numeroPedido ? `#${p.numeroPedido}` : `#${p.id.slice(0, 6).toUpperCase()}`;
                      const dt = p.dataRetirada ? p.dataRetirada.split('-').reverse().join('/') : (p.dataEvento ? p.dataEvento.split('-').reverse().join('/') : '--/--/----');
                      return (
                        <div key={p.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Pedido {num}</strong>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Vencimento: {dt} | Total: R$ {vTotal.toFixed(2)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.88rem', color: '#dc2626', fontWeight: '900' }}>R$ {saldo.toFixed(2)}</span>
                            <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: '850' }}>EM ABERTO</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {modalTravaLocacao.cliente.celular && (
                  <button 
                    type="button" 
                    onClick={() => {
                      const c = modalTravaLocacao.cliente;
                      setModalTravaLocacao(null);
                      abrirModalWhatsApp(c, 'cobranca');
                    }}
                    style={{ background: '#25d366', color: '#ffffff', border: 'none', borderRadius: '12px', height: '44px', fontWeight: '850', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)' }}
                  >
                    <i className="fab fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Cobrar / Negociar Pendência no WhatsApp
                  </button>
                )}

                <button 
                  type="button" 
                  onClick={() => {
                    const c = modalTravaLocacao.cliente;
                    setModalTravaLocacao(null);
                    setClienteVisualizacao(null);
                    navigate('/locacoes/nova', { state: { clienteSelecionado: c, autorizacaoPendente: true } });
                  }}
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', height: '44px', fontWeight: '850', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)' }}
                >
                  ⚠️ Autorizar e Prosseguir com a Nova Locação
                </button>

                <button 
                  type="button" 
                  onClick={() => setModalTravaLocacao(null)}
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '12px', height: '40px', fontWeight: '750', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  ❌ Cancelar e Bloquear Nova Locação
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Clientes;