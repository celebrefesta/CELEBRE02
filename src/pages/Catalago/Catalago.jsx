import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import html2canvas from 'html2canvas';
import './Catalago.css';

const Catalogo = () => {
  const navigate = useNavigate();
  const { idEmpresa } = useParams();

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  
  const tenantId = idEmpresa || (usuarioLogado ? usuarioLogado.uid : null);

  const [estoque, setEstoque] = useState([]);
  const [locacoes, setLocacoes] = useState([]);
  const [empresa, setEmpresa] = useState({ 
    nome: 'CELEBRE FESTAS', logo: '', whats: '', endereco: '', insta: '', pixelFacebook: '', capa: '' 
  });

  const [loading, setLoading] = useState(true);
  const [lojaInvalida, setLojaInvalida] = useState(false);
  
  // Filtros de Navegação
  const [filtroModalidade, setFiltroModalidade] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroTema, setFiltroTema] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [dataEventoFiltro, setDataEventoFiltro] = useState('');
  const [ordenacao, setOrdenacao] = useState('destaques');
  const [verApenasFavoritos, setVerApenasFavoritos] = useState(false);

  // ❤️ Favoritos / Pasta de Inspiração (LocalStorage)
  const [favoritos, setFavoritos] = useState(() => {
    try {
      const salvas = localStorage.getItem(`celebre_favs_${tenantId || 'global'}`);
      return salvas ? JSON.parse(salvas) : [];
    } catch {
      return [];
    }
  });

  // Carrinho & Drawer
  const [carrinho, setCarrinho] = useState([]);
  const [cartDrawerAberto, setCartDrawerAberto] = useState(false);

  // 🎨 Mini Simulador de Combinações (Painel de Harmonia)
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const painelSimuladorRef = useRef(null);
  const [gerandoImagemPainel, setGerandoImagemPainel] = useState(false);

  // Formulário do Cliente
  const [dadosCliente, setDadosCliente] = useState({ nome: '', whats: '', dataEvento: '' });
  const [tipoFluxo, setTipoFluxo] = useState('orcamento');

  // Menu Mobile Drawer & Detalhe
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [produtoDetalhe, setProdutoDetalhe] = useState(null);

  // Salvar favoritos no storage local
  useEffect(() => {
    if (tenantId) {
      localStorage.setItem(`celebre_favs_${tenantId}`, JSON.stringify(favoritos));
    }
  }, [favoritos, tenantId]);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DO CATÁLOGO)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = usuarioLogado?.displayName || usuarioLogado?.email || "Cliente Web (Catálogo)";
      const uid = usuarioLogado?.uid || tenantId;
      if (!uid) return;

      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid || "cliente_vitrine",
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "N/A",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log do catálogo:", error);
    }
  };

  useEffect(() => {
    const inicializar = async () => {
      if (!tenantId) {
        setLojaInvalida(true);
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "configuracoes_empresa", tenantId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const d = docSnap.data();
          setEmpresa({
            nome: d.nomeEmpresa || d.nome || 'CELEBRE FESTAS',
            logo: d.logoUrl || d.logo || d.logotipo || '',
            whats: d.whatsapp || d.telefone || '',
            endereco: d.endereco || '',
            insta: d.instagram || '',
            capa: d.bannerUrl || d.capaUrl || '',
            pixelFacebook: d.pixelFacebook || d.pixel || '' 
          });
        }

        // Carrega Estoque (Incluindo todas as peças, inclusive em reparo)
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snapEstoque = await getDocs(qEstoque);
        const itens = snapEstoque.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(i => i.status !== 'inativo' && !( (i.status === 'manutencao' || i.status === 'reparo') && !i.dataPrevisaoRetorno )); 
        setEstoque(itens);

        // Carrega Locações Ativas para Checagem de Disponibilidade Real
        const qLoc = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snapLoc = await getDocs(qLoc);
        const listaLoc = snapLoc.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.status !== 'cancelada' && l.status !== 'devolvido');
        setLocacoes(listaLoc);

      } catch (e) { 
        console.error(e);
      } finally { 
        setLoading(false); 
      }
    };
    inicializar();
  }, [tenantId]);

  // Pixel Facebook
  useEffect(() => {
    if (empresa.pixelFacebook) {
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      
      window.fbq('init', empresa.pixelFacebook);
      window.fbq('track', 'PageView'); 
    }
  }, [empresa.pixelFacebook]);

  const dispararPixel = (nomeEvento, dados = {}) => {
    if (window.fbq && empresa.pixelFacebook) {
      window.fbq('track', nomeEvento, dados);
    }
  };

  // 🏷️ Categorias Dinâmicas (Direto do Estoque)
  const categoriasDinamicas = useMemo(() => {
    return [...new Set(estoque.map(i => i.categoria ? String(i.categoria).trim() : "").filter(Boolean))].sort();
  }, [estoque]);

  // 🎭 Temas Dinâmicos (Direto do Estoque Real)
  const temasDinamicos = useMemo(() => {
    const temasSet = new Set();
    estoque.forEach(item => {
      const t = item.tema ? String(item.tema).trim() : '';
      if (t && t.toLowerCase() !== 'geral' && t.toLowerCase() !== 'outros' && t.toLowerCase() !== 'sem tema') {
        temasSet.add(t);
      }
    });
    return Array.from(temasSet).sort();
  }, [estoque]);

  // Contagens para as Abas de Formato
  const qtdPegueMonte = useMemo(() => {
    return estoque.filter(i => String(i.modalidade || '').toLowerCase().includes('pegue')).length;
  }, [estoque]);

  const qtdDecoracao = useMemo(() => {
    return estoque.filter(i => String(i.modalidade || '').toLowerCase().includes('decor') || i.especificacoes?.isDecoracao).length;
  }, [estoque]);

  // 📅 Normalizador de Datas ISO (YYYY-MM-DD)
  const formatarDataISO = (dStr) => {
    if (!dStr || typeof dStr !== 'string') return '';
    const limpo = dStr.split('T')[0].trim();
    if (limpo.includes('/')) {
      const p = limpo.split('/');
      if (p.length === 3) {
        if (p[0].length === 4) return `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`;
        return `${p[2]}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`;
      }
    }
    return limpo;
  };

  // 🏷️ Formatação Elegante de Títulos (Title Case)
  const formatarNomeTitulo = (nome) => {
    if (!nome) return '';
    return String(nome)
      .trim()
      .split(' ')
      .filter(Boolean)
      .map(palavra => {
        const lower = palavra.toLowerCase();
        if (['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'por'].includes(lower)) {
          return lower;
        }
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');
  };

  // 🎨 Ícones Inteligentes para Categorias e Temas
  const getCategoriaIcon = (catNome) => {
    const c = (catNome || '').toLowerCase();
    if (c.includes('vaso') || c.includes('louca') || c.includes('cerâmica') || c.includes('ceramica')) return '🏺';
    if (c.includes('móve') || c.includes('move') || c.includes('mobili') || c.includes('mesa') || c.includes('cadeira')) return '🛋️';
    if (c.includes('painel') || c.includes('estrutura') || c.includes('arco') || c.includes('backdrop')) return '🖼️';
    if (c.includes('cilindro')) return '📦';
    if (c.includes('personagen') || c.includes('display') || c.includes('boneco') || c.includes('pelúcia') || c.includes('bale')) return '🧸';
    if (c.includes('boleira') || c.includes('doce') || c.includes('bandeja') || c.includes('prato')) return '🧁';
    if (c.includes('ilumina') || c.includes('lustre') || c.includes('led') || c.includes('neon')) return '💡';
    if (c.includes('flor') || c.includes('arranjo') || c.includes('folhagem')) return '🌸';
    if (c.includes('toalha') || c.includes('tecido')) return '🧺';
    if (c.includes('kit') || c.includes('pacote')) return '✨';
    return '🏷️';
  };

  const getTemaIcon = (temaNome) => {
    const t = (temaNome || '').toLowerCase();
    if (t.includes('infantil') || t.includes('circo') || t.includes('safari') || t.includes('disney')) return '🎈';
    if (t.includes('casamento') || t.includes('noiva')) return '💍';
    if (t.includes('15 anos') || t.includes('debutante')) return '👑';
    if (t.includes('bebê') || t.includes('bebe') || t.includes('chá') || t.includes('maternidade')) return '👶';
    if (t.includes('batizado')) return '⛪';
    if (t.includes('boho') || t.includes('rústico') || t.includes('rustico')) return '🌿';
    if (t.includes('corporativo')) return '💼';
    return '🎉';
  };

  // 📅 1. CHECAGEM DE DISPONIBILIDADE REAL POR DATA (SEM JARGÃO OPERACIONAL DE OFICINA)
  const calcularDisponibilidadeItem = (item) => {
    const isManutencao = item.status === 'manutencao' || item.status === 'reparo';

    if (!dataEventoFiltro) {
      // Quando o cliente ainda não filtrou data, não exibimos avisos de oficina
      return { checado: false, disponivel: true, qtdLivre: Number(item.quantidade || 1), status: 'neutro' };
    }

    const dataAlvo = formatarDataISO(dataEventoFiltro);
    const qtdTotal = Number(item.quantidade || 1);
    let qtdReservada = 0;

    // Se estiver em manutenção com data de previsão de retorno
    if (isManutencao && item.dataPrevisaoRetorno) {
      const dataRetorno = formatarDataISO(item.dataPrevisaoRetorno);
      if (dataRetorno && dataAlvo < dataRetorno) {
        return { 
          checado: true, 
          disponivel: false, 
          qtdLivre: 0, 
          status: 'esgotado', 
          label: `Indisponível nesta data` 
        };
      }
    } else if (isManutencao) {
      return { 
        checado: true, 
        disponivel: false, 
        qtdLivre: 0, 
        status: 'esgotado', 
        label: `Indisponível nesta data` 
      };
    }

    locacoes.forEach(loc => {
      const inicio = formatarDataISO(loc.dataRetirada || loc.dataEvento || loc.dataFesta);
      const fim = formatarDataISO(loc.dataDevolucao || loc.dataRetirada || loc.dataEvento || loc.dataFesta);

      const estaNoPeriodo = inicio && fim 
        ? (dataAlvo >= inicio && dataAlvo <= fim)
        : (inicio === dataAlvo);

      if (estaNoPeriodo && Array.isArray(loc.itens)) {
        loc.itens.forEach(p => {
          if (p.id === item.id || p.nome === item.nome) {
            qtdReservada += Number(p.qtd || 1);
          }
        });
      }
    });

    const qtdLivre = Math.max(0, qtdTotal - qtdReservada);

    if (qtdLivre <= 0) {
      return { checado: true, disponivel: false, qtdLivre: 0, status: 'esgotado', label: 'Esgotado nesta data' };
    }
    if (qtdLivre === 1) {
      return { checado: true, disponivel: true, qtdLivre: 1, status: 'urgencia', label: '⚡ Última unidade!' };
    }
    return { checado: true, disponivel: true, qtdLivre: qtdLivre, status: 'disponivel', label: `🟢 Disponível` };
  };

  // ❤️ 2. GERENCIAMENTO DE FAVORITOS
  const toggleFavorito = (itemId, e) => {
    if (e) e.stopPropagation();
    if (favoritos.includes(itemId)) {
      setFavoritos(favoritos.filter(id => id !== itemId));
    } else {
      setFavoritos([...favoritos, itemId]);
      dispararPixel('AddToWishlist', { content_ids: [itemId] });
    }
  };

  const isFavorito = (itemId) => favoritos.includes(itemId);

  // Formatação de Dimensões
  const formatarDimensoes = (dim) => {
    if (!dim) return null;
    if (typeof dim === 'string') return dim;
    if (typeof dim === 'object') {
      let partes = [];
      if (dim.altura) partes.push(`A:${dim.altura}cm`);
      if (dim.largura) partes.push(`L:${dim.largura}cm`);
      if (dim.comprimento) partes.push(`C:${dim.comprimento}cm`);
      if (dim.diametro) partes.push(`Ø:${dim.diametro}cm`);
      return partes.length > 0 ? partes.join(' × ') : null;
    }
    return null;
  };

  const formatarDimensoesDetalhe = (esp) => {
    if (!esp) return null;
    let partes = [];
    if (Number(esp.largura) > 0) partes.push(`Largura: ${esp.largura}cm`);
    if (Number(esp.altura) > 0) partes.push(`Altura: ${esp.altura}cm`);
    if (Number(esp.diametro) > 0) partes.push(`Diâmetro: ${esp.diametro}cm`);
    if (Number(esp.comprimento) > 0) partes.push(`Comprimento: ${esp.comprimento}cm`);
    return partes.length > 0 ? partes.join(' • ') : null;
  };

  // 🛒 Controle de Carrinho
  const toggleNoCarrinho = (item) => {
    const disp = calcularDisponibilidadeItem(item);
    if (disp.checado && !disp.disponivel) {
      alert(`⚠️ A peça "${item.nome}" já está totalmente reservada para a data selecionada (${dataEventoFiltro}).`);
      return;
    }

    const existe = carrinho.find(i => i.id === item.id);
    if (existe) {
      setCarrinho(carrinho.filter(i => i.id !== item.id));
    } else {
      setCarrinho([...carrinho, { ...item, qtd: 1 }]);
      dispararPixel('AddToCart', { 
        content_name: item.nome, 
        value: Number(item.financeiro?.valorAluguel || 0), 
        currency: 'BRL' 
      });
    }
  };

  const alterarQtd = (id, delta) => {
    setCarrinho(prev => prev.map(item => {
      if (item.id === id) {
        const novaQtd = (item.qtd || 1) + delta;
        return novaQtd > 0 ? { ...item, qtd: novaQtd } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removerDoCarrinho = (id) => {
    setCarrinho(prev => prev.filter(item => item.id !== id));
  };

  const isNoCarrinho = (id) => carrinho.some(i => i.id === id);

  const getQtdNoCarrinho = (id) => {
    const item = carrinho.find(i => i.id === id);
    return item ? (item.qtd || 1) : 0;
  };

  const calcularTotal = () => carrinho.reduce((acc, i) => acc + (Number(i.financeiro?.valorAluguel || 0) * (i.qtd || 1)), 0);

  const calcularTotalEconomia = () => {
    let economia = 0;
    carrinho.forEach(item => {
      const { desconto } = calcularAncoragemKit(item);
      if (desconto > 0) {
        economia += desconto * (item.qtd || 1);
      }
    });
    return economia;
  };

  const abrirCarrinho = () => {
    setCartDrawerAberto(true);
    dispararPixel('InitiateCheckout', { value: calcularTotal(), currency: 'BRL' });
  };

  // Ancoragem de Kit vs Peças Avulsas
  const calcularAncoragemKit = (item) => {
    const precoAtual = Number(item.financeiro?.valorAluguel || 0);
    let precoSomaAvulso = 0;
    if (item.especificacoes?.isDecoracao && item.especificacoes?.itensDecoracao) {
      precoSomaAvulso = item.especificacoes.itensDecoracao.reduce((acc, peca) => acc + (Number(peca.precoOriginal || 0) * (peca.qtd || 1)), 0);
    }
    const desconto = precoSomaAvulso - precoAtual;
    return { precoAtual, precoSomaAvulso, desconto, isVantajoso: desconto > 0 };
  };

  // 🎨 3. BAIXAR OU COMPARTILHAR O SIMULADOR DE HARMONIA
  const exportarPainelSimulador = async (compartilharWhatsApp = false) => {
    if (!painelSimuladorRef.current) return;
    setGerandoImagemPainel(true);
    try {
      const canvas = await html2canvas(painelSimuladorRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a'
      });
      const dataUrl = canvas.toDataURL('image/png');

      if (compartilharWhatsApp) {
        const link = document.createElement('a');
        link.download = `painel-harmonia-${empresa.nome.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = dataUrl;
        link.click();

        const whatsDestino = empresa.whats ? empresa.whats.replace(/\D/g, '') : '';
        const msg = `Olá! Montei um painel de harmonia com essas peças no catálogo online e gostaria de verificar o orçamento! ✨`;
        window.open(`https://wa.me/${whatsDestino}?text=${encodeURIComponent(msg)}`, '_blank');
      } else {
        const link = document.createElement('a');
        link.download = `painel-decoracao-${empresa.nome.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error("Erro ao gerar imagem do painel:", err);
      alert("Não foi possível gerar a imagem no momento.");
    } finally {
      setGerandoImagemPainel(false);
    }
  };

  // 📤 Envio de Orçamento para o WhatsApp
  const enviarOrcamento = async (e) => {
    if (e) e.preventDefault();
    if (carrinho.length === 0) return alert("Sua lista está vazia! Adicione peças ao carrinho.");

    const nome = dadosCliente.nome.trim();
    const whats = dadosCliente.whats.trim();
    const dataFesta = dadosCliente.dataEvento || dataEventoFiltro;

    if (!dataFesta) {
      return alert("📅 Por favor, informe a Data da sua Festa para verificarmos a disponibilidade das peças!");
    }
    if (!nome) return alert("Por favor, preencha o seu nome.");
    if (!whats) return alert("Por favor, preencha o seu WhatsApp.");

    const total = calcularTotal();
    const resumoItens = carrinho.map(i => `• ${i.qtd || 1}x *${i.nome}* - R$ ${(Number(i.financeiro?.valorAluguel || 0) * (i.qtd || 1)).toFixed(2)}`).join('\n');
    const economiaTotal = calcularTotalEconomia();

    try {
      await addDoc(collection(db, "locacoes"), {
        clienteNome: nome,
        clienteWhats: whats,
        temaFesta: `Catálogo: Orçamento Web`,
        dataRetirada: dataFesta,
        itens: carrinho,
        valorTotal: total,
        status: 'orcamento',
        origem: 'catalogo_publico',
        criadoEm: serverTimestamp(),
        userId: tenantId 
      });

      await registrarLog("NOVO ORÇAMENTO WEB", `O cliente "${nome}" gerou um orçamento público via Catálogo no valor de R$ ${total.toFixed(2)} com ${carrinho.length} itens para a data ${dataFesta}.`);

      dispararPixel('Lead', { value: total, currency: 'BRL' });

      const whatsDestino = empresa.whats ? empresa.whats.replace(/\D/g, '') : "5519999999999";
      
      let texto = `🌟 *SOLICITAÇÃO DE ORÇAMENTO - ${empresa.nome.toUpperCase()}* 🌟\n\n`;
      texto += `👤 *Cliente:* ${nome}\n`;
      texto += `📱 *WhatsApp:* ${whats}\n`;
      texto += `📅 *Data da Festa:* ${dataFesta.split('-').reverse().join('/')}\n`;
      texto += `\n🛍️ *Peças Selecionadas (${carrinho.length}):*\n${resumoItens}\n\n`;
      texto += `💰 *Valor Total Estimado:* R$ ${total.toFixed(2)}\n`;
      if (economiaTotal > 0) {
        texto += `🎁 *Economia em Pacotes:* R$ ${economiaTotal.toFixed(2)}\n`;
      }
      texto += `\nOlá! Vi essas peças no catálogo online e gostaria de verificar a disponibilidade para minha festa nesta data e fechar a locação! ✨`;

      window.open(`https://wa.me/${whatsDestino}?text=${encodeURIComponent(texto)}`, '_blank');
      setCartDrawerAberto(false);

    } catch (err) { 
      console.error("Erro ao enviar orçamento:", err);
      alert("Erro ao processar o orçamento. Tente novamente.");
    }
  };

  // 🔍 4. FILTRAGEM E ORDENAÇÃO INTELIGENTE DOS PRODUTOS
  const itensFiltrados = useMemo(() => {
    let resultado = estoque.filter(item => {
      // Favoritos
      if (verApenasFavoritos && !favoritos.includes(item.id)) return false;

      // Busca por texto
      if (busca) {
        const t = busca.toLowerCase();
        const nome = String(item.nome || '').toLowerCase();
        const cat = String(item.categoria || '').toLowerCase();
        const tema = String(item.tema || '').toLowerCase();
        const tags = String(item.tags || '').toLowerCase();
        const desc = String(item.observacoes || '').toLowerCase();
        const match = nome.includes(t) || cat.includes(t) || tema.includes(t) || tags.includes(t) || desc.includes(t);
        if (!match) return false;
      }

      // Modalidade / Formato
      if (filtroModalidade !== 'Todas') {
        const mod = String(item.modalidade || '').toLowerCase();
        const isDecor = Boolean(item.especificacoes?.isDecoracao);
        if (filtroModalidade === 'Pegue e Monte' && !mod.includes('pegue')) return false;
        if (filtroModalidade === 'Decoração Completa' && !mod.includes('decor') && !isDecor) return false;
      }

      // Categoria
      if (filtroCategoria !== 'Todas') {
        const cat = String(item.categoria || '').toLowerCase();
        if (!cat.includes(filtroCategoria.toLowerCase())) return false;
      }

      // Tema
      if (filtroTema !== 'Todos') {
        const tema = String(item.tema || '').toLowerCase();
        if (tema !== filtroTema.toLowerCase()) return false;
      }

      return true;
    });

    // 🔀 Ordenação
    if (ordenacao === 'preco-asc') {
      resultado.sort((a, b) => Number(a.financeiro?.valorAluguel || 0) - Number(b.financeiro?.valorAluguel || 0));
    } else if (ordenacao === 'preco-desc') {
      resultado.sort((a, b) => Number(b.financeiro?.valorAluguel || 0) - Number(a.financeiro?.valorAluguel || 0));
    } else if (ordenacao === 'nome-asc') {
      resultado.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
    } else if (ordenacao === 'kits') {
      resultado.sort((a, b) => (b.especificacoes?.isDecoracao ? 1 : 0) - (a.especificacoes?.isDecoracao ? 1 : 0));
    }

    return resultado;
  }, [estoque, busca, filtroModalidade, filtroCategoria, filtroTema, ordenacao, verApenasFavoritos, favoritos]);

  // Compartilhar Peça
  const compartilharPeca = (item) => {
    const whatsDestino = empresa.whats ? empresa.whats.replace(/\D/g, '') : '';
    const link = window.location.href;
    const msg = `Olha essa peça linda que encontrei na ${empresa.nome}:\n*${item.nome}* por apenas R$ ${Number(item.financeiro?.valorAluguel || 0).toFixed(2)}\n\nVeja no catálogo: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const selecionarFiltro = (tipo, valor) => {
    if (tipo === 'categoria') {
      setFiltroCategoria(valor);
      setFiltroTema('Todos');
      setFiltroModalidade('Todas');
    } else if (tipo === 'tema') {
      setFiltroTema(valor);
      setFiltroCategoria('Todas');
      setFiltroModalidade('Todas');
    } else if (tipo === 'modalidade') {
      setFiltroModalidade(valor);
      setFiltroCategoria('Todas');
      setFiltroTema('Todos');
    }
    setMenuMobileAberto(false);
  };

  const limparTodosFiltros = () => {
    setFiltroCategoria('Todas');
    setFiltroModalidade('Todas');
    setFiltroTema('Todos');
    setBusca('');
    setVerApenasFavoritos(false);
    setOrdenacao('destaques');
  };

  if (loading) {
    return (
      <div className="loader-catalogo-container">
        <div className="loader-catalogo-spinner"></div>
        <h2 className="loader-catalogo-title">Carregando Acervo Exclusivo...</h2>
        <p className="loader-catalogo-sub">Preparando a vitrine com as melhores peças para sua festa</p>
      </div>
    );
  }

  if (lojaInvalida) {
    return (
      <div className="loja-invalida-screen">
        <div className="loja-invalida-card">
          <span className="loja-invalida-icon">🏪</span>
          <h2>Catálogo não encontrado</h2>
          <p>Por favor, solicite o link oficial à decoradora para ter acesso ao acervo de peças e decorações.</p>
          <button className="btn-voltar-home" onClick={() => navigate('/')}>Ir para Página Inicial</button>
        </div>
      </div>
    );
  }

  return (
    <div className="catalogo-luxury-page">

      {/* 🌟 1. HERO HEADER BOUTIQUE DE LUXO */}
      <header 
        className="cat-hero-header"
        style={empresa.capa ? { backgroundImage: `linear-gradient(180deg, rgba(7, 10, 18, 0.78) 0%, rgba(15, 23, 42, 0.94) 100%), url(${empresa.capa})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        <div className="cat-hero-overlay"></div>
        
        <div className="cat-header-top-bar">
          <div className="cat-header-brand">
            {empresa.logo ? (
              <img src={empresa.logo} alt={empresa.nome} className="cat-brand-logo" />
            ) : (
              <div className="cat-brand-avatar">👑</div>
            )}
            <div className="cat-brand-info">
              <h1 className="cat-brand-title">{empresa.nome}</h1>
              <span className="cat-brand-tagline">✨ Vitrine Oficial de Locação & Cenografia</span>
            </div>
          </div>

          <div className="cat-header-actions">
            {/* ❤️ Botão Topo Favoritos / Inspirações */}
            <button 
              type="button" 
              className={`btn-header-fav-pill ${verApenasFavoritos ? 'active' : ''}`}
              onClick={() => setVerApenasFavoritos(!verApenasFavoritos)}
              title="Ver minha pasta de inspiração salva"
            >
              <span>❤️</span>
              <span className="fav-label">Inspirações ({favoritos.length})</span>
            </button>

            {empresa.whats && (
              <a 
                href={`https://wa.me/${empresa.whats.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${empresa.nome}! Estou navegando no catálogo online e gostaria de falar com uma cenógrafa.`)}`} 
                target="_blank" 
                rel="noreferrer"
                className="btn-header-zap"
                title="Atendimento VIP no WhatsApp"
              >
                <span>💬 Falar com a Cenógrafa</span>
              </a>
            )}
          </div>
        </div>

        {/* Informações de Contato & Badges de Autoridade */}
        <div className="cat-header-meta-row">
          {empresa.endereco && (
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(empresa.endereco)}`}
              target="_blank"
              rel="noreferrer"
              className="meta-item meta-link"
              title="Ver endereço no Google Maps"
            >
              <span className="meta-icon">📍</span> {empresa.endereco}
            </a>
          )}
          {empresa.insta && (
            <a 
              href={`https://instagram.com/${empresa.insta.replace('@', '')}`} 
              target="_blank" 
              rel="noreferrer" 
              className="meta-item meta-link"
              title="Instagram Oficial"
            >
              <span className="meta-icon">📸</span> @{empresa.insta.replace('@', '')}
            </a>
          )}
          <span className="meta-item meta-badge-trust">
            <span className="meta-icon">✨</span> Peças 100% Higienizadas
          </span>
        </div>
      </header>

      {/* 🏛️ 2. LAYOUT PRINCIPAL: SIDEBAR PURA DE CATEGORIAS + VITRINE AMPLA */}
      <div className="cat-container-main">

        {/* Overlay Mobile */}
        {menuMobileAberto && (
          <div className="cat-sidebar-overlay" onClick={() => setMenuMobileAberto(false)} />
        )}

        {/* 📌 MENU LATERAL: FOCADO 100% NO ACERVO, CATEGORIAS & TEMAS DO ESTOQUE */}
        <aside className={`cat-sidebar ${menuMobileAberto ? 'open' : ''}`}>
          
          <div className="sidebar-mobile-header">
            <h3>🧭 Categorias</h3>
            <button className="btn-fechar-sidebar" onClick={() => setMenuMobileAberto(false)}>✕</button>
          </div>

          {/* Seção: Coleção & Modalidades */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Coleção</h3>
            <ul className="sidebar-list">
              <li
                className={filtroCategoria === 'Todas' && filtroTema === 'Todos' && filtroModalidade === 'Todas' && !verApenasFavoritos ? 'active destak' : 'destak'}
                onClick={() => {
                  setVerApenasFavoritos(false);
                  selecionarFiltro('categoria', 'Todas');
                }}
              >
                <span>🌟 Todo o Acervo</span>
                <span className="sidebar-count">{estoque.length}</span>
              </li>

              {qtdPegueMonte > 0 && (
                <li
                  className={filtroModalidade === 'Pegue e Monte' && !verApenasFavoritos ? 'active' : ''}
                  onClick={() => {
                    setVerApenasFavoritos(false);
                    selecionarFiltro('modalidade', 'Pegue e Monte');
                  }}
                >
                  <span>📦 Pegue & Monte</span>
                  <span className="sidebar-count">{qtdPegueMonte}</span>
                </li>
              )}

              {qtdDecoracao > 0 && (
                <li
                  className={filtroModalidade === 'Decoração Completa' && !verApenasFavoritos ? 'active' : ''}
                  onClick={() => {
                    setVerApenasFavoritos(false);
                    selecionarFiltro('modalidade', 'Decoração Completa');
                  }}
                >
                  <span>✨ Decorações Completas</span>
                  <span className="sidebar-count">{qtdDecoracao}</span>
                </li>
              )}
            </ul>
          </div>

          <div className="sidebar-divider"></div>

          {/* Seção: Categorias do Acervo Real */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Categorias</h3>
            <ul className="sidebar-list">
              {categoriasDinamicas.map(cat => {
                const count = estoque.filter(i => String(i.categoria || '').trim() === cat).length;
                return (
                  <li
                    key={cat}
                    className={filtroCategoria === cat && !verApenasFavoritos ? 'active' : ''}
                    onClick={() => {
                      setVerApenasFavoritos(false);
                      selecionarFiltro('categoria', cat);
                    }}
                  >
                    <span>{getCategoriaIcon(cat)} {cat}</span>
                    <span className="sidebar-count">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Seção: Temas (Apenas se houver temas reais no estoque) */}
          {temasDinamicos.length > 0 && (
            <>
              <div className="sidebar-divider"></div>
              <div className="sidebar-section">
                <h3 className="sidebar-title">Temas Cadastrados</h3>
                <ul className="sidebar-list">
                  {temasDinamicos.map(tema => {
                    const count = estoque.filter(i => String(i.tema || '').trim().toLowerCase() === tema.toLowerCase()).length;
                    return (
                      <li
                        key={tema}
                        className={filtroTema === tema && !verApenasFavoritos ? 'active' : ''}
                        onClick={() => {
                          setVerApenasFavoritos(false);
                          selecionarFiltro('tema', tema);
                        }}
                      >
                        <span>{getTemaIcon(tema)} {tema}</span>
                        <span className="sidebar-count">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

        </aside>

        {/* 🛍️ CONTEÚDO PRINCIPAL (ÁREA DA VITRINE AMPLA) */}
        <main className="cat-content">
          
          {/* 🔍 BARRA DE CONTROLES: BUSCA, DATA DISPONIBILIDADE E ORDENAÇÃO */}
          <div className="cat-top-bar-controls">

            {/* 📱 Botão de Categorias exclusivo para celular */}
            <button 
              type="button" 
              className="btn-trigger-mobile-filter"
              onClick={() => setMenuMobileAberto(true)}
              title="Ver Categorias"
            >
              <span>🧭</span>
              <span>Categorias</span>
            </button>
            
            {/* Campo de Busca */}
            <div className="cat-search-input-wrap">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="O que procura para sua festa? (Ex: Cilindros, Vasos, Painel...)" 
                value={busca} 
                onChange={e => setBusca(e.target.value)}
                className="cat-search-field"
              />
              {busca && (
                <button className="btn-clear-search" onClick={() => setBusca('')}>✕</button>
              )}
            </div>

            {/* 📅 Campo de Data com Feedback de Disponibilidade */}
            <div className="cat-date-picker-wrap">
              <span className="date-icon">📅</span>
              <input 
                type="date" 
                value={dataEventoFiltro} 
                onChange={e => {
                  setDataEventoFiltro(e.target.value);
                  setDadosCliente(prev => ({ ...prev, dataEvento: e.target.value }));
                }}
                className="cat-date-field"
                title="Data prevista da festa (verifica disponibilidade em tempo real)"
              />
              {dataEventoFiltro && (
                <button 
                  type="button" 
                  className="btn-clear-date-filter" 
                  onClick={() => {
                    setDataEventoFiltro('');
                    setDadosCliente(prev => ({ ...prev, dataEvento: '' }));
                  }}
                  title="Limpar filtro de data"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 🔀 Seletor de Ordenação Rápida */}
            <div className="cat-sort-select-wrap">
              <span className="sort-icon">🔀</span>
              <select 
                value={ordenacao} 
                onChange={e => setOrdenacao(e.target.value)}
                className="cat-sort-select"
                title="Ordenar produtos"
              >
                <option value="destaques">🌟 Mais Populares</option>
                <option value="preco-asc">💲 Menor Preço</option>
                <option value="preco-desc">💎 Maior Preço</option>
                <option value="nome-asc">🔤 Nome (A-Z)</option>
                <option value="kits">✨ Kits e Pacotes Primeiro</option>
              </select>
            </div>

          </div>

          {/* Feedback de Filtros Ativos & Urgência de Data */}
          <div className="cat-active-filters-bar">
            <div className="active-filters-info">
              Exibindo <strong>{itensFiltrados.length}</strong> peças
              
              {dataEventoFiltro && (
                <span className="date-availability-status-tag">
                  📅 Disponibilidade em tempo real para: <strong>{dataEventoFiltro.split('-').reverse().join('/')}</strong>
                </span>
              )}

              {verApenasFavoritos && (
                <span className="filter-pill-active fav-active-pill">❤️ Minha Pasta de Inspirações</span>
              )}

              {(filtroCategoria !== 'Todas' || filtroModalidade !== 'Todas' || filtroTema !== 'Todos' || busca) && (
                <span className="active-filters-labels">
                  • 
                  {filtroModalidade !== 'Todas' && <span className="filter-pill-active">{filtroModalidade}</span>}
                  {filtroCategoria !== 'Todas' && <span className="filter-pill-active">{filtroCategoria}</span>}
                  {filtroTema !== 'Todos' && <span className="filter-pill-active">Tema: {filtroTema}</span>}
                </span>
              )}
            </div>

            {(filtroCategoria !== 'Todas' || filtroModalidade !== 'Todas' || filtroTema !== 'Todos' || busca || verApenasFavoritos || dataEventoFiltro) && (
              <button className="btn-reset-active-filters" onClick={limparTodosFiltros}>
                ✕ Limpar Seleção
              </button>
            )}
          </div>

          {/* Grid de Cards */}
          {itensFiltrados.length === 0 ? (
            <div className="cat-empty-results">
              <span className="empty-icon">{verApenasFavoritos ? '❤️' : '🔍'}</span>
              <h3>
                {verApenasFavoritos 
                  ? 'Você ainda não salvou nenhuma peça como favorita' 
                  : 'Nenhuma peça encontrada nessa seleção'}
              </h3>
              <p>
                {verApenasFavoritos 
                  ? 'Clique no coraçãozinho das peças para salvar suas ideias preferidas nesta pasta.'
                  : 'Tente buscar por outro termo ou selecionar outra categoria.'}
              </p>
              <button className="btn-reset-filters" onClick={limparTodosFiltros}>
                Ver Todo o Acervo
              </button>
            </div>
          ) : (
            <div className="cat-grid">
              {itensFiltrados.map(item => {
                const isSelected = isNoCarrinho(item.id);
                const qtd = getQtdNoCarrinho(item.id);
                const preco = Number(item.financeiro?.valorAluguel || 0);
                const { isVantajoso, desconto } = calcularAncoragemKit(item);
                const isDecoracao = Boolean(item.especificacoes?.isDecoracao);
                const fav = isFavorito(item.id);
                const disp = calcularDisponibilidadeItem(item);

                return (
                  <div key={item.id} className={`cat-card ${isSelected ? 'in-cart' : ''} ${disp.checado && !disp.disponivel ? 'card-esgotado' : ''}`}>
                    
                    {/* Imagem & Badges */}
                    <div className="cat-img-wrapper" onClick={() => setProdutoDetalhe(item)}>
                      {item.foto ? (
                        <img 
                          src={item.foto} 
                          alt={item.nome} 
                          className="cat-card-img" 
                          loading="lazy" 
                          crossOrigin="anonymous"
                          draggable="false"
                        />
                      ) : (
                        <div className="cat-no-img-luxury">
                          <div className="cat-no-img-icon-wrap">
                            <span className="cat-crown-gold">👑</span>
                          </div>
                          <span className="cat-no-img-brand">{empresa.nome || 'CELEBRE'}</span>
                          <span className="cat-no-img-tag">Foto em Produção</span>
                        </div>
                      )}

                      {/* ❤️ Botão de Favoritar no Canto do Card */}
                      <button 
                        type="button"
                        className={`btn-fav-card-corner ${fav ? 'favorited' : ''}`}
                        onClick={(e) => toggleFavorito(item.id, e)}
                        title={fav ? "Remover dos favoritos" : "Salvar na minha pasta de inspiração"}
                      >
                        {fav ? '❤️' : '🤍'}
                      </button>

                      {/* Badges Flutuantes */}
                      <div className="product-badges-corner">
                        {isDecoracao && (
                          <span className="badge-luxury badge-decor">✨ Kit Completo</span>
                        )}
                        {item.modalidade === 'Pegue e Monte' && !isDecoracao && (
                          <span className="badge-luxury badge-pegue">📦 Pegue & Monte</span>
                        )}
                        {isVantajoso && (
                          <span className="badge-luxury badge-discount">Economize R$ {desconto.toFixed(0)}</span>
                        )}

                        {/* 📅 Badge de Disponibilidade em Tempo Real */}
                        {disp.checado && (
                          <span className={`badge-disp-real badge-disp-${disp.status}`}>
                            {disp.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Informações da Peça */}
                    <div className="cat-info">
                      <h4 className="cat-title-text" onClick={() => setProdutoDetalhe(item)} title={item.nome}>
                        {formatarNomeTitulo(item.nome)}
                      </h4>

                      {formatarDimensoes(item.dimensoes) && (
                        <p className="cat-medida">
                          📏 {formatarDimensoes(item.dimensoes)}
                        </p>
                      )}

                      <div className="product-card-pricing-row">
                        <div className="pricing-box">
                          <span className="price-label">Locação • Diária</span>
                          <div className="cat-price">R$ {preco.toFixed(2)}</div>
                        </div>

                        {/* Botão Adicionar ao Carrinho */}
                        {isSelected ? (
                          <div className="cart-qty-inline-ctrl">
                            <button 
                              type="button" 
                              className="btn-qty-mini" 
                              onClick={() => alterarQtd(item.id, -1)}
                              title="Diminuir"
                            >
                              -
                            </button>
                            <span className="qty-number">{qtd}</span>
                            <button 
                              type="button" 
                              className="btn-qty-mini" 
                              onClick={() => alterarQtd(item.id, 1)}
                              title="Aumentar"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`btn-add-lista ${disp.checado && !disp.disponivel ? 'btn-disabled' : ''}`}
                            onClick={() => toggleNoCarrinho(item)}
                            disabled={disp.checado && !disp.disponivel}
                            title={disp.checado && !disp.disponivel ? "Indisponível nesta data" : "Adicionar à lista de orçamento"}
                          >
                            {disp.checado && !disp.disponivel ? 'Indisponível' : '+ Adicionar'}
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </main>
      </div>

      {/* 📱 BOTÃO FLUTUANTE DE CATEGORIAS NO CELULAR */}
      <button 
        type="button"
        className="btn-mobile-filtros-fab" 
        onClick={() => setMenuMobileAberto(!menuMobileAberto)}
        title="Ver Categorias"
      >
        {menuMobileAberto ? '✕' : '☰ Categorias'}
      </button>

      {/* 🛍️ 3. CART DRAWER LATERAL */}
      {cartDrawerAberto && (
        <div className="cat-cart-drawer-backdrop" onClick={() => setCartDrawerAberto(false)}>
          <div className="cat-cart-drawer" onClick={e => e.stopPropagation()}>
            
            {/* Header do Drawer */}
            <div className="cart-drawer-header">
              <div className="cart-drawer-title-group">
                <span className="cart-icon">🛍️</span>
                <div>
                  <h3>Minha Lista de Peças</h3>
                  <small>{carrinho.length} {carrinho.length === 1 ? 'item selecionado' : 'itens selecionados'}</small>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-close-cart-drawer" 
                onClick={() => setCartDrawerAberto(false)}
                title="Fechar Carrinho"
              >
                ✕
              </button>
            </div>

            {/* Corpo do Drawer */}
            <div className="cart-drawer-body">
              {carrinho.length === 0 ? (
                <div className="cart-empty-state">
                  <span className="empty-cart-icon">🛒</span>
                  <h4>Sua lista está vazia</h4>
                  <p>Explore nosso acervo e adicione as peças e decorações que você quer na sua festa!</p>
                  <button 
                    type="button" 
                    className="btn-start-shopping"
                    onClick={() => setCartDrawerAberto(false)}
                  >
                    Ver Todo o Acervo
                  </button>
                </div>
              ) : (
                <>
                  {/* 📅 CHECADOR DE DATA OBRIGATÓRIO NO TOPO DO CARRINHO */}
                  <div className={`cart-date-checker-card ${(dadosCliente.dataEvento || dataEventoFiltro) ? 'date-selected' : 'date-needed'}`}>
                    <div className="checker-header-row">
                      <span className="checker-icon">📅</span>
                      <div className="checker-text-info">
                        <strong>Para qual data é a sua festa? *</strong>
                        <small>Informe para checar a disponibilidade imediata das peças</small>
                      </div>
                    </div>

                    <div className="checker-input-row">
                      <input 
                        type="date"
                        required
                        value={dadosCliente.dataEvento || dataEventoFiltro}
                        onChange={e => {
                          setDataEventoFiltro(e.target.value);
                          setDadosCliente(prev => ({ ...prev, dataEvento: e.target.value }));
                        }}
                        className="cart-date-input-highlight"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    {/* Feedback Geral de Disponibilidade do Carrinho */}
                    {(dadosCliente.dataEvento || dataEventoFiltro) ? (
                      <div className="cart-disp-feedback-box disp-ok">
                        <span>✨ Checagem ativa para {(dadosCliente.dataEvento || dataEventoFiltro).split('-').reverse().join('/')}</span>
                      </div>
                    ) : (
                      <div className="cart-disp-feedback-box disp-pending">
                        <span>👆 Selecione o dia do evento acima para validar a reserva</span>
                      </div>
                    )}
                  </div>

                  {/* 🎨 3. BOTÃO DE ABRIR SIMULADOR VISUAL DE COMBINAÇÕES */}
                  <div className="cart-simulador-callout">
                    <button 
                      type="button" 
                      className="btn-open-simulador-harmonia"
                      onClick={() => setSimuladorAberto(true)}
                    >
                      <span>🎨</span> Ver Combinação Visual das Peças (Harmonia)
                    </button>
                  </div>

                  {/* Lista de Itens */}
                  <div className="cart-items-scroll">
                    {carrinho.map(item => {
                      const precoUnit = Number(item.financeiro?.valorAluguel || 0);
                      const subtotalItem = precoUnit * (item.qtd || 1);
                      const disp = calcularDisponibilidadeItem(item);

                      return (
                        <div key={item.id} className="cart-item-row">
                          <div className="cart-item-img-wrap">
                            {item.foto ? (
                              <img src={item.foto} alt={item.nome} crossOrigin="anonymous" />
                            ) : (
                              <span>📷</span>
                            )}
                          </div>

                          <div className="cart-item-info">
                            <h4 className="cart-item-name">{item.nome}</h4>
                            
                            <div className="cart-item-meta-row">
                              <span className="cart-item-unit-price">R$ {precoUnit.toFixed(2)} / un</span>
                              {disp.checado && (
                                <span className={`cart-item-disp-badge badge-disp-${disp.status}`}>
                                  {disp.label}
                                </span>
                              )}
                            </div>
                            
                            <div className="cart-item-controls">
                              <div className="cart-qty-stepper">
                                <button type="button" onClick={() => alterarQtd(item.id, -1)}>-</button>
                                <span>{item.qtd || 1}</span>
                                <button type="button" onClick={() => alterarQtd(item.id, 1)}>+</button>
                              </div>

                              <span className="cart-item-subtotal">R$ {subtotalItem.toFixed(2)}</span>

                              <button 
                                type="button" 
                                className="btn-remove-item"
                                onClick={() => removerDoCarrinho(item.id)}
                                title="Remover item da lista"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumo Financeiro */}
                  <div className="cart-summary-box">
                    <div className="summary-row">
                      <span>Subtotal das Peças:</span>
                      <strong>R$ {calcularTotal().toFixed(2)}</strong>
                    </div>

                    {calcularTotalEconomia() > 0 && (
                      <div className="summary-row discount-row">
                        <span>🎁 Economia em Pacotes:</span>
                        <strong className="discount-text">- R$ {calcularTotalEconomia().toFixed(2)}</strong>
                      </div>
                    )}

                    <div className="summary-row total-row">
                      <span>Total Estimado:</span>
                      <strong className="total-highlight">R$ {calcularTotal().toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Alternador de Fluxo */}
                  <div className="cart-flow-toggle">
                    <button 
                      type="button"
                      className={`flow-btn ${tipoFluxo === 'orcamento' ? 'active' : ''}`}
                      onClick={() => setTipoFluxo('orcamento')}
                    >
                      💬 Orçamento Rápido
                    </button>
                    <button 
                      type="button"
                      className={`flow-btn ${tipoFluxo === 'cadastro' ? 'active' : ''}`}
                      onClick={() => setTipoFluxo('cadastro')}
                    >
                      🌟 Virar Cliente Oficial
                    </button>
                  </div>

                  {/* Formulário de Orçamento WhatsApp */}
                  {tipoFluxo === 'orcamento' ? (
                    <form className="cart-checkout-form" onSubmit={enviarOrcamento}>
                      <div className="form-group-mini">
                        <label>Seu Nome Completo *</label>
                        <input 
                          type="text" 
                          placeholder="Como podemos te chamar?" 
                          required 
                          value={dadosCliente.nome}
                          onChange={e => setDadosCliente({ ...dadosCliente, nome: e.target.value })}
                        />
                      </div>

                      <div className="form-group-mini">
                        <label>Seu WhatsApp com DDD *</label>
                        <input 
                          type="tel" 
                          placeholder="(11) 99999-9999" 
                          required 
                          value={dadosCliente.whats}
                          onChange={e => setDadosCliente({ ...dadosCliente, whats: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="btn-send-whatsapp-checkout">
                        <span>🟢</span> Enviar Orçamento no WhatsApp
                      </button>
                      <small className="checkout-disclaimer">
                        🔒 Sem compromisso. Enviaremos a confirmação de disponibilidade imediatamente!
                      </small>
                    </form>
                  ) : (
                    <div className="cart-autocadastro-box">
                      <h4>Faça seu Cadastro Oficial 🌟</h4>
                      <p>Agilize seu contrato, ganhe prioridade na reserva de datas e acompanhe o status da sua locação online!</p>
                      <button 
                        type="button" 
                        className="btn-ir-autocadastro"
                        onClick={() => navigate(`/autocadastro/${tenantId}`, { 
                          state: { 
                            carrinhoCatalogo: carrinho, 
                            empresaConfig: empresa, 
                            empresaId: tenantId 
                          } 
                        })}
                      >
                        Ir para Cadastro Oficial ➔
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 🎨 3. MODAL SIMULADOR VISUAL DE COMBINAÇÕES (MOODBOARD DE HARMONIA) */}
      {simuladorAberto && (
        <div className="product-modal-backdrop" onClick={() => setSimuladorAberto(false)}>
          <div className="product-modal-card simulador-modal-card" onClick={e => e.stopPropagation()}>
            <button className="btn-close-modal-x" onClick={() => setSimuladorAberto(false)}>✕</button>

            <div className="simulador-header">
              <div className="simulador-title-grp">
                <span className="sim-badge">✨ Harmonia do Seu Evento</span>
                <h2>Painel Visual das Peças Escolhidas</h2>
                <p>Veja como as peças e cores que você selecionou combinam entre si na decoração:</p>
              </div>
            </div>

            {/* Painel que será capturado como imagem */}
            <div className="simulador-canvas-board" ref={painelSimuladorRef}>
              <div className="simulador-brand-watermark">
                <strong>{empresa.nome}</strong>
                <small>Proposta de Composição • {carrinho.length} itens</small>
              </div>

              <div className="simulador-pieces-collage">
                {carrinho.map(peca => (
                  <div key={peca.id} className="sim-collage-item">
                    <div className="sim-item-thumb">
                      {peca.foto ? (
                        <img src={peca.foto} alt={peca.nome} crossOrigin="anonymous" />
                      ) : (
                        <span className="no-img-icon">📷</span>
                      )}
                      <span className="sim-qty-badge">{peca.qtd || 1}x</span>
                    </div>
                    <span className="sim-item-title">{peca.nome}</span>
                  </div>
                ))}
              </div>

              <div className="simulador-footer-bar">
                <span>Total Estimado: <strong>R$ {calcularTotal().toFixed(2)}</strong></span>
                {dataEventoFiltro && <span>Data Prevista: <strong>{dataEventoFiltro.split('-').reverse().join('/')}</strong></span>}
              </div>
            </div>

            {/* Ações do Simulador */}
            <div className="simulador-actions-bar">
              <button 
                type="button" 
                className="btn-download-painel"
                onClick={() => exportarPainelSimulador(false)}
                disabled={gerandoImagemPainel}
              >
                💾 {gerandoImagemPainel ? 'Gerando Imagem...' : 'Baixar Imagem do Painel'}
              </button>

              <button 
                type="button" 
                className="btn-share-painel-zap"
                onClick={() => exportarPainelSimulador(true)}
                disabled={gerandoImagemPainel}
              >
                📲 Enviar Painel no WhatsApp
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🖼️ 4. MODAL DE DETALHES DO PRODUTO */}
      {produtoDetalhe && (
        <div className="product-modal-backdrop" onClick={() => setProdutoDetalhe(null)}>
          <div className="product-modal-card" onClick={e => e.stopPropagation()}>
            <button className="btn-close-modal-x" onClick={() => setProdutoDetalhe(null)}>✕</button>

            <div className="modal-content-grid">
              
              {/* Lado Esquerdo: Foto Principal & Peças Inclusas */}
              <div className="modal-left-gallery">
                <div className="modal-main-image-wrap">
                  {produtoDetalhe.foto ? (
                    <img src={produtoDetalhe.foto} alt={produtoDetalhe.nome} crossOrigin="anonymous" />
                  ) : (
                    <div className="modal-no-img">📷 Sem Foto Disponível</div>
                  )}
                </div>

                {/* Se for Decoração Completa, exibe as peças do kit */}
                {produtoDetalhe.especificacoes?.isDecoracao && produtoDetalhe.especificacoes?.itensDecoracao?.length > 0 && (
                  <div className="modal-kit-breakdown">
                    <div className="kit-breakdown-title">
                      <span>✨</span>
                      <strong>Peças inclusas neste pacote:</strong>
                    </div>
                    <div className="kit-pieces-grid">
                      {produtoDetalhe.especificacoes.itensDecoracao.map((peca, idx) => (
                        <div key={idx} className="kit-piece-chip">
                          <div className="kit-piece-thumb">
                            {peca.foto ? <img src={peca.foto} alt="" /> : <span>📷</span>}
                            <span className="kit-piece-qty">{peca.qtd}x</span>
                          </div>
                          <span className="kit-piece-name">{peca.nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Lado Direito: Ficha Técnica & Ação */}
              <div className="modal-right-info">
                <div className="modal-cat-badge">
                  {produtoDetalhe.especificacoes?.isDecoracao ? '✨ Pacote Completo' : (produtoDetalhe.categoria || 'Acervo')}
                </div>

                <h2 className="modal-product-title">{produtoDetalhe.nome}</h2>

                {/* Ficha Técnica */}
                <div className="modal-tech-specs-box">
                  <h4 className="tech-specs-title">📋 Especificações Técnicas</h4>
                  <div className="tech-specs-grid">
                    {produtoDetalhe.categoria && (
                      <div className="spec-field">
                        <small>Categoria:</small>
                        <strong>{produtoDetalhe.categoria}</strong>
                      </div>
                    )}
                    {produtoDetalhe.tema && (
                      <div className="spec-field">
                        <small>Tema Sugerido:</small>
                        <strong>{produtoDetalhe.tema}</strong>
                      </div>
                    )}
                    {produtoDetalhe.especificacoes?.cor && (
                      <div className="spec-field">
                        <small>Cor Principal:</small>
                        <strong>{produtoDetalhe.especificacoes.cor}</strong>
                      </div>
                    )}
                    {produtoDetalhe.especificacoes?.tamanho && (
                      <div className="spec-field">
                        <small>Porte / Tamanho:</small>
                        <strong>{produtoDetalhe.especificacoes.tamanho}</strong>
                      </div>
                    )}
                    {formatarDimensoesDetalhe(produtoDetalhe.especificacoes) && (
                      <div className="spec-field full-width">
                        <small>Medidas Oficiais:</small>
                        <strong>{formatarDimensoesDetalhe(produtoDetalhe.especificacoes)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Observações / Dicas */}
                {produtoDetalhe.observacoes && (
                  <div className="modal-notes-box">
                    <strong>💡 Dicas & Recomendações:</strong>
                    <p>{produtoDetalhe.observacoes}</p>
                  </div>
                )}

                {/* Ancoragem de Preço ou Economia de Kit */}
                <div className="modal-pricing-section">
                  {(() => {
                    const { precoAtual, precoSomaAvulso, desconto, isVantajoso } = calcularAncoragemKit(produtoDetalhe);

                    if (isVantajoso) {
                      return (
                        <div className="kit-savings-card">
                          <div className="savings-comparison">
                            <span>Alugando avulso: <s className="strike-price">R$ {precoSomaAvulso.toFixed(2)}</s></span>
                            <span className="current-package-price">Pacote Completo: <strong>R$ {precoAtual.toFixed(2)}</strong></span>
                          </div>
                          <div className="savings-highlight-badge">
                            🎉 Viu como compensa? Você economiza R$ {desconto.toFixed(2)}!
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="simple-pricing-box">
                          <span className="simple-price-label">Valor da Locação:</span>
                          <strong className="simple-price-val">R$ {precoAtual.toFixed(2)}</strong>
                        </div>
                      );
                    }
                  })()}

                  {/* Botões de Ação do Modal */}
                  <div className="modal-actions-row">
                    <button
                      type="button"
                      className={`btn-modal-add-cart ${isNoCarrinho(produtoDetalhe.id) ? 'already-added' : ''}`}
                      onClick={() => {
                        toggleNoCarrinho(produtoDetalhe);
                        setProdutoDetalhe(null);
                        setCartDrawerAberto(true);
                      }}
                    >
                      {isNoCarrinho(produtoDetalhe.id) ? '✓ Peça na Minha Lista (Ver Carrinho)' : '+ Adicionar à Minha Lista'}
                    </button>

                    <button
                      type="button"
                      className="btn-modal-share"
                      onClick={() => compartilharPeca(produtoDetalhe)}
                      title="Compartilhar no WhatsApp"
                    >
                      📲 Compartilhar
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🛍️ 5. BARRA FLUTUANTE INFERIOR DO CARRINHO (ESTILO IFOOD / LUXURY APP) */}
      {carrinho.length > 0 && (
        <div className="cat-floating-cart-pill" onClick={abrirCarrinho}>
          <div className="floating-cart-info">
            <div className="floating-cart-bag-wrap">
              <span className="floating-cart-bag">🛍️</span>
              <span className="floating-cart-badge-count">{carrinho.reduce((a, b) => a + (b.qtd || 1), 0)}</span>
            </div>
            <div className="floating-cart-texts">
              <strong className="floating-cart-title">
                {carrinho.reduce((a, b) => a + (b.qtd || 1), 0)} {carrinho.reduce((a, b) => a + (b.qtd || 1), 0) === 1 ? 'peça selecionada' : 'peças selecionadas'}
              </strong>
              <small className="floating-cart-sub">Subtotal Estimado: R$ {calcularTotal().toFixed(2)}</small>
            </div>
          </div>

          <button type="button" className="btn-floating-view-cart">
            <span>VER ORÇAMENTO</span>
            <span className="btn-arrow-icon">➔</span>
          </button>
        </div>
      )}

      {/* 🌟 6. SEÇÃO: COMO FUNCIONA A LOCAÇÃO & CTA SLIM */}
      <footer className="cat-how-it-works-section">
        <div className="cat-how-it-works-container">
          
          <div className="how-it-works-header">
            <span className="how-it-works-badge">✨ Simples & Rápido</span>
            <h3 className="how-it-works-title">Como Funciona a Locação na {empresa.nome}?</h3>
            <p className="how-it-works-subtitle">Veja como é fácil transformar a sua festa em um momento inesquecível em apenas 3 passos:</p>
          </div>

          <div className="how-it-works-steps-grid">
            <div className="step-card">
              <div className="step-icon-wrap">🛍️</div>
              <span className="step-number">Passo 01</span>
              <h4>Monte sua Lista</h4>
              <p>Explore nosso acervo, selecione as peças ou o kit completo e adicione ao carrinho.</p>
            </div>

            <div className="step-arrow-divider">➔</div>

            <div className="step-card">
              <div className="step-icon-wrap">💬</div>
              <span className="step-number">Passo 02</span>
              <h4>Envie seu Orçamento</h4>
              <p>Envie sua lista com 1 clique para nosso WhatsApp com a data prevista do seu evento.</p>
            </div>

            <div className="step-arrow-divider">➔</div>

            <div className="step-card">
              <div className="step-icon-wrap">🎉</div>
              <span className="step-number">Passo 03</span>
              <h4>Celebre seu Momento</h4>
              <p>Retire no modelo <strong>Pegue & Monte</strong> ou combine a entrega e montagem no local da festa!</p>
            </div>
          </div>

          {/* CTA para Atendimento Personalizado */}
          <div className="cat-custom-help-cta-box">
            <div className="cta-help-content">
              <span className="cta-help-icon">💡</span>
              <div className="cta-help-texts">
                <h4>Precisa de um tema personalizado ou tem alguma dúvida?</h4>
                <p>Nossa equipe de decoração está pronta para te atender e montar uma proposta sob medida.</p>
              </div>
            </div>

            {empresa.whats && (
              <a 
                href={`https://wa.me/${empresa.whats.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${empresa.nome}! Gostaria de tirar dúvidas ou solicitar uma decoração personalizada para minha festa.`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-cta-help-zap"
              >
                <span>💬 Falar no WhatsApp</span>
              </a>
            )}
          </div>

          {/* Selos de Confiança & Garantia */}
          <div className="cat-trust-guarantees-grid">
            <div className="trust-item">
              <span className="trust-icon">✨</span>
              <div className="trust-texts">
                <strong>Peças 100% Higienizadas</strong>
                <small>Revisadas e embaladas com proteção máxima</small>
              </div>
            </div>
            <div className="trust-item">
              <span className="trust-icon">🚚</span>
              <div className="trust-texts">
                <strong>Retirada ou Frete com Montagem</strong>
                <small>Pegue & Monte no galpão ou entrega no local</small>
              </div>
            </div>
            <div className="trust-item">
              <span className="trust-icon">💖</span>
              <div className="trust-texts">
                <strong>Suporte com Cenógrafa</strong>
                <small>Ajuda especializada para compor sua festa</small>
              </div>
            </div>
          </div>

          {/* Barra de Copyright e Acesso da Equipe */}
          <div className="cat-bottom-credits-bar">
            <div className="credits-left">
              <span>© {new Date().getFullYear()} {empresa.nome}. Todos os direitos reservados.</span>
              <span className="powered-text">Vitrine Oficial • Celebre Festas</span>
            </div>
            <button 
              type="button" 
              className="btn-footer-admin-link"
              onClick={() => navigate(usuarioLogado ? '/dashboard' : '/login')}
              title="Acesso restrito para equipe interna"
            >
              🔒 Área da Equipe
            </button>
          </div>

        </div>
      </footer>

    </div>
  );
};

export default Catalogo;