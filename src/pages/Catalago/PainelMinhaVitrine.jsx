import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import './PainelMinhaVitrine.css';

// 🎨 PALETAS EXCLUSIVAS DE COR DA MARCA PARA O CATÁLOGO
const CORES_VITRINE = [
  { id: 'gold', nome: 'Dourado Real', cor: '#c5a059', border: '#dfba73', icone: '👑' },
  { id: 'rose', nome: 'Rosa Quartz', cor: '#e11d48', border: '#fb7185', icone: '💖' },
  { id: 'pink', nome: 'Pink Vibrante', cor: '#ec4899', border: '#f472b6', icone: '🌸' },
  { id: 'purple', nome: 'Lilás Lavanda', cor: '#8b5cf6', border: '#a78bfa', icone: '💜' },
  { id: 'terracota', nome: 'Terracota Chic', cor: '#c2410c', border: '#fb923c', icone: '🍂' },
  { id: 'emerald', nome: 'Verde Botânico', cor: '#059669', border: '#34d399', icone: '🌿' },
  { id: 'cyan', nome: 'Azul Celeste', cor: '#0284c7', border: '#38bdf8', icone: '🌊' },
  { id: 'blue', nome: 'Azul Royal', cor: '#2563eb', border: '#60a5fa', icone: '💙' },
  { id: 'dark', nome: 'Ônix Minimal', cor: '#18181b', border: '#3f3f46', icone: '🖤' }
];

// 🖼️ COMPRESSOR AUTOMÁTICO DE IMAGENS (NUNCA ULTRAPASSA O LIMITE DO FIRESTORE DE 1MB)
const comprimirImagemParaUpload = (file, maxLargura, maxAltura, qualidade = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxLargura || height > maxAltura) {
          if (width / height > maxLargura / maxAltura) {
            height = Math.round((height * maxLargura) / width);
            width = maxLargura;
          } else {
            width = Math.round((width * maxAltura) / height);
            height = maxAltura;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Gera JPEG otimizado e ultraleve (< 85KB)
        const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const PainelMinhaVitrine = () => {
  const navigate = useNavigate();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoSucesso, setSalvoSucesso] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(false);

  // Estados da Configuração da Vitrine
  const [catalogoAtivo, setCatalogoAtivo] = useState(true);
  const [corMarca, setCorMarca] = useState('#c5a059');
  const [tituloLoja, setTituloLoja] = useState('');
  const [descricaoLoja, setDescricaoLoja] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [capaUrl, setCapaUrl] = useState('');
  const [msgManutencao, setMsgManutencao] = useState('');

  // 🆕 Novos Recursos de Personalização Solicitados
  const [ocultarPrecos, setOcultarPrecos] = useState(false);
  const [avisoSinalCaucao, setAvisoSinalCaucao] = useState('');
  const [regioesAtendidas, setRegioesAtendidas] = useState('');
  const [msgPadraoWhats, setMsgPadraoWhats] = useState('');
  const [tituloDestaques, setTituloDestaques] = useState('Destaques da Vitrine');

  // 📦 Gestão de Acervo e Visibilidade
  const [abaAtiva, setAbaAtiva] = useState('config'); // 'config' | 'acervo'
  const [itensAcervo, setItensAcervo] = useState([]);
  const [buscaAcervo, setBuscaAcervo] = useState('');
  const [filtroStatusAcervo, setFiltroStatusAcervo] = useState('todos'); // 'todos' | 'visiveis' | 'ocultos' | 'destaques'
  const [atualizandoItemId, setAtualizandoItemId] = useState(null);

  // Upload previews e states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [salvandoCor, setSalvandoCor] = useState(false);
  const [avisoCor, setAvisoCor] = useState('');

  // Estados de Diagnóstico do Acervo (Health Score)
  const [metricasEstoque, setMetricasEstoque] = useState({
    totalItens: 0,
    itensComFoto: 0,
    itensSemFoto: 0,
    itensComPreco: 0,
    itensSemPreco: 0
  });

  // URL Base do Catálogo Oficial
  const urlCatalogo = useMemo(() => {
    if (!tenantId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://celebrefesta.com.br';
    return `${origin}/catalogo/${tenantId}`;
  }, [tenantId]);

  // Carrega dados da empresa e métricas do estoque
  useEffect(() => {
    const carregarDados = async () => {
      if (!tenantId) return;
      setLoading(true);

      try {
        // 1. Carrega dados de configuração da empresa
        const refEmpresa = doc(db, "configuracoes_empresa", tenantId);
        const snapEmpresa = await getDoc(refEmpresa);

        if (snapEmpresa.exists()) {
          const d = snapEmpresa.data();
          setCatalogoAtivo(d.catalogoAtivo !== false);
          setCorMarca(d.corMarcaCatalogo || d.accentColor || '#c5a059');
          setTituloLoja(d.tituloCatalogo || d.nomeEmpresa || d.nome || '');
          setDescricaoLoja(d.descricaoCatalogo || 'Vitrine Oficial de Locação & Cenografia');
          setWhatsapp(d.whatsapp || d.telefone || '');
          setInstagram(d.instagram || '');
          setLogoUrl(d.logoUrl || d.logo || '');
          setCapaUrl(d.bannerUrl || d.capaUrl || '');
          setMsgManutencao(d.msgManutencaoCatalogo || 'Estamos atualizando nosso acervo de peças e temas. Fale conosco no WhatsApp para atendimento!');
          setOcultarPrecos(Boolean(d.ocultarPrecos));
          setAvisoSinalCaucao(d.avisoSinalCaucao || '');
          setRegioesAtendidas(d.regioesAtendidas || '');
          setMsgPadraoWhats(d.msgPadraoWhats || '');
          setTituloDestaques(d.tituloDestaques || 'Destaques da Vitrine');
        }

        // 2. Analisa dados do estoque para o Checklist de Prontidão (busca por userId, tenantId e empresaId)
        const uidsAlvo = new Set([
          tenantId,
          usuarioLogado?.uid,
          localStorage.getItem('tenantId')
        ].filter(Boolean));

        const rawImp = localStorage.getItem('impersonatingTenant');
        if (rawImp) {
          try {
            const imp = JSON.parse(rawImp);
            if (imp.uid) uidsAlvo.add(imp.uid);
            if (imp.originalUid) uidsAlvo.add(imp.originalUid);
            if (Array.isArray(imp.allUids)) imp.allUids.forEach(u => u && uidsAlvo.add(u));
          } catch (e) {}
        }

        try {
          const userDoc = await getDoc(doc(db, "usuarios", tenantId));
          if (userDoc.exists()) {
            const ud = userDoc.data();
            if (ud.tenantId) uidsAlvo.add(ud.tenantId);
            if (ud.empresaId) uidsAlvo.add(ud.empresaId);
          }
        } catch (e) {}

        const mapEstoque = new Map();
        for (const uId of uidsAlvo) {
          const [snapU, snapT, snapE] = await Promise.all([
            getDocs(query(collection(db, "estoque"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, "estoque"), where("tenantId", "==", uId))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, "estoque"), where("empresaId", "==", uId))).catch(() => ({ docs: [] }))
          ]);
          [...snapU.docs, ...snapT.docs, ...snapE.docs].forEach(docItem => mapEstoque.set(docItem.id, docItem.data()));
        }

        const listaAcervo = [];
        let comFoto = 0;
        let comPreco = 0;
        let total = 0;

        mapEstoque.forEach((item, id) => {
          if (item.status === 'inativo') return;
          total++;

          const temImg = Boolean(item.foto || item.imagem || (Array.isArray(item.fotos) && item.fotos.length > 0));
          if (temImg) comFoto++;

          const precoItem = Number(item.valorLocacao || item.valor || item.financeiro?.valorAluguel || 0);
          if (precoItem > 0) comPreco++;

          listaAcervo.push({
            id,
            ...item,
            nome: item.nome || 'Peça sem nome',
            categoria: item.categoria || 'Geral',
            preco: precoItem,
            foto: item.foto || item.imagem || (Array.isArray(item.fotos) && item.fotos[0]) || '',
            visivelCatalogo: item.visivelCatalogo !== false && item.configuracao?.visivelCatalogo !== false,
            destaqueCatalogo: Boolean(item.destaqueCatalogo || item.configuracao?.destaqueCatalogo)
          });
        });

        listaAcervo.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setItensAcervo(listaAcervo);

        setMetricasEstoque({
          totalItens: total,
          itensComFoto: comFoto,
          itensSemFoto: Math.max(0, total - comFoto),
          itensComPreco: comPreco,
          itensSemPreco: Math.max(0, total - comPreco)
        });

      } catch (err) {
        console.error("Erro ao carregar dados da vitrine:", err);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [tenantId]);

  // Cálculo do Índice de Prontidão (Health Score da Vitrine de 0% a 100%)
  const checklist = useMemo(() => {
    const itens = [
      {
        id: 'titulo',
        label: 'Título da vitrine preenchido',
        ok: Boolean(tituloLoja?.trim()),
        tipo: 'obrigatorio'
      },
      {
        id: 'whats',
        label: 'WhatsApp válido para receber pedidos',
        ok: Boolean(whatsapp?.replace(/\D/g, '').length >= 10),
        tipo: 'obrigatorio'
      },
      {
        id: 'itens',
        label: 'Ao menos 1 item publicado no acervo',
        ok: metricasEstoque.totalItens > 0,
        detalhe: `${metricasEstoque.totalItens} peças publicadas`,
        tipo: 'obrigatorio'
      },
      {
        id: 'fotos',
        label: 'Itens com imagem fotográfica',
        ok: metricasEstoque.totalItens > 0 && metricasEstoque.itensSemFoto === 0,
        detalhe: `${metricasEstoque.itensComFoto}/${metricasEstoque.totalItens} com foto`,
        alerta: metricasEstoque.itensSemFoto > 0 ? `${metricasEstoque.itensSemFoto} peça(s) sem foto` : null,
        tipo: 'recomendado'
      },
      {
        id: 'precos',
        label: 'Itens com preço de locação definido',
        ok: metricasEstoque.totalItens > 0 && metricasEstoque.itensSemPreco === 0,
        detalhe: `${metricasEstoque.itensComPreco}/${metricasEstoque.totalItens} com preço`,
        alerta: metricasEstoque.itensSemPreco > 0 ? `${metricasEstoque.itensSemPreco} peça(s) sem preço` : null,
        tipo: 'recomendado'
      },
      {
        id: 'logo',
        label: 'Logotipo da empresa configurado',
        ok: Boolean(logoUrl),
        tipo: 'recomendado'
      },
      {
        id: 'capa',
        label: 'Imagem de capa da vitrine configurada',
        ok: Boolean(capaUrl),
        tipo: 'recomendado'
      }
    ];

    const concluidos = itens.filter(i => i.ok).length;
    const porcentagem = Math.round((concluidos / itens.length) * 100);

    return {
      itens,
      concluidos,
      total: itens.length,
      porcentagem
    };
  }, [tituloLoja, whatsapp, metricasEstoque, logoUrl, capaUrl]);

  // Troca instantânea e auto-save da cor de destaque do catálogo
  const handleTrocarCor = async (novaCor) => {
    setCorMarca(novaCor);
    localStorage.setItem('corMarcaCatalogo', novaCor);

    if (tenantId) {
      setSalvandoCor(true);
      try {
        const refEmpresa = doc(db, "configuracoes_empresa", tenantId);
        await setDoc(refEmpresa, { 
          corMarcaCatalogo: novaCor,
          atualizadoEm: new Date().toISOString()
        }, { merge: true });

        const nomeCor = CORES_VITRINE.find(c => c.cor === novaCor)?.nome || novaCor;
        setAvisoCor(`✓ Cor "${nomeCor}" aplicada e salva para o Catálogo!`);
        setTimeout(() => setAvisoCor(''), 3500);
      } catch (err) {
        console.warn("Erro ao auto-salvar cor:", err);
      } finally {
        setSalvandoCor(false);
      }
    }
  };

  // Salvar configurações
  const handleSalvar = async () => {
    if (!tenantId) return;
    setSalvando(true);
    setSalvoSucesso(false);
    localStorage.setItem('corMarcaCatalogo', corMarca);

    try {
      const refEmpresa = doc(db, "configuracoes_empresa", tenantId);
      const snapEmpresa = await getDoc(refEmpresa);

      // 🛡️ Proteção de tamanho: se a capa for uma string base64 gigante (> 400KB), comprime antes de salvar
      let bannerFinal = capaUrl;
      if (bannerFinal && bannerFinal.startsWith('data:image') && bannerFinal.length > 400000) {
        try {
          bannerFinal = await new Promise((res) => {
            const img = new Image();
            img.src = bannerFinal;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let w = img.width, h = img.height;
              if (w > 1200) { h = Math.round((h * 1200) / w); w = 1200; }
              canvas.width = w; canvas.height = h;
              canvas.getContext('2d').drawImage(img, 0, 0, w, h);
              res(canvas.toDataURL('image/jpeg', 0.78));
            };
            img.onerror = () => res('');
          });
          setCapaUrl(bannerFinal);
        } catch (e) {
          console.warn("Erro ao comprimir capa no save:", e);
        }
      }

      // 🛡️ Proteção de tamanho para logo
      let logoFinal = logoUrl;
      if (logoFinal && logoFinal.startsWith('data:image') && logoFinal.length > 400000) {
        try {
          logoFinal = await new Promise((res) => {
            const img = new Image();
            img.src = logoFinal;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let w = img.width, h = img.height;
              if (w > 400) { h = Math.round((h * 400) / w); w = 400; }
              canvas.width = w; canvas.height = h;
              canvas.getContext('2d').drawImage(img, 0, 0, w, h);
              res(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => res('');
          });
          setLogoUrl(logoFinal);
        } catch (e) {
          console.warn("Erro ao comprimir logo no save:", e);
        }
      }

      const dadosParaSalvar = {
        catalogoAtivo,
        corMarcaCatalogo: corMarca,
        tituloCatalogo: tituloLoja,
        descricaoCatalogo: descricaoLoja,
        whatsapp,
        instagram,
        logoUrl: logoFinal,
        bannerUrl: bannerFinal,
        msgManutencaoCatalogo: msgManutencao,
        ocultarPrecos,
        avisoSinalCaucao,
        regioesAtendidas,
        msgPadraoWhats,
        tituloDestaques,
        atualizadoEm: new Date().toISOString()
      };

      if (snapEmpresa.exists()) {
        await updateDoc(refEmpresa, dadosParaSalvar);
      } else {
        await setDoc(refEmpresa, dadosParaSalvar, { merge: true });
      }

      setSalvoSucesso(true);
      setTimeout(() => setSalvoSucesso(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar vitrine:", err);
      alert("Erro ao salvar configurações da vitrine.");
    } finally {
      setSalvando(false);
    }
  };

  // 👁️ Alternar Visibilidade da Peça no Catálogo Online
  const handleToggleVisibilidade = async (item) => {
    const novoStatus = !(item.visivelCatalogo !== false && item.configuracao?.visivelCatalogo !== false);
    setAtualizandoItemId(item.id);

    // Otimista
    setItensAcervo(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          visivelCatalogo: novoStatus,
          configuracao: { ...(i.configuracao || {}), visivelCatalogo: novoStatus }
        };
      }
      return i;
    }));

    try {
      const refItem = doc(db, "estoque", item.id);
      await updateDoc(refItem, {
        visivelCatalogo: novoStatus,
        "configuracao.visivelCatalogo": novoStatus,
        atualizadoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error("Erro ao alterar visibilidade:", err);
      setItensAcervo(prev => prev.map(i => {
        if (i.id === item.id) {
          return {
            ...i,
            visivelCatalogo: !novoStatus,
            configuracao: { ...(i.configuracao || {}), visivelCatalogo: !novoStatus }
          };
        }
        return i;
      }));
      alert("Não foi possível atualizar a visibilidade no momento.");
    } finally {
      setAtualizandoItemId(null);
    }
  };

  // ⭐ Alternar Destaque da Peça na Vitrine
  const handleToggleDestaque = async (item) => {
    const novoStatus = !(item.destaqueCatalogo || item.configuracao?.destaqueCatalogo);
    setAtualizandoItemId(item.id);

    // Otimista
    setItensAcervo(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          destaqueCatalogo: novoStatus,
          configuracao: { ...(i.configuracao || {}), destaqueCatalogo: novoStatus }
        };
      }
      return i;
    }));

    try {
      const refItem = doc(db, "estoque", item.id);
      await updateDoc(refItem, {
        destaqueCatalogo: novoStatus,
        "configuracao.destaqueCatalogo": novoStatus,
        atualizadoEm: new Date().toISOString()
      });
    } catch (err) {
      console.error("Erro ao alterar destaque:", err);
      setItensAcervo(prev => prev.map(i => {
        if (i.id === item.id) {
          return {
            ...i,
            destaqueCatalogo: !novoStatus,
            configuracao: { ...(i.configuracao || {}), destaqueCatalogo: !novoStatus }
          };
        }
        return i;
      }));
      alert("Não foi possível atualizar o destaque no momento.");
    } finally {
      setAtualizandoItemId(null);
    }
  };

  // 🏷️ Inserir Tag no Modelo do WhatsApp
  const inserirTagWhats = (tag) => {
    setMsgPadraoWhats(prev => {
      if (!prev) return tag;
      return `${prev} ${tag}`;
    });
  };

  // 🔄 Restaurar Modelo Padrão do WhatsApp
  const restaurarModeloWhats = () => {
    const modeloDefault = `🌟 *SOLICITAÇÃO DE ORÇAMENTO - {empresa}* 🌟\n\n👤 *Cliente:* {cliente}\n📅 *Data do Evento:* {data}\n\n🛍️ *Peças Selecionadas:*\n{itens}\n\n💰 *Total Estimado:* {total}\n{condicoes}\nOlá! Vi essas peças no catálogo online e gostaria de verificar a disponibilidade para minha festa! ✨`;
    setMsgPadraoWhats(modeloDefault);
  };

  // Cálculos do Gestor de Acervo
  const totalVisiveis = useMemo(() => itensAcervo.filter(i => i.visivelCatalogo).length, [itensAcervo]);
  const totalOcultas = useMemo(() => itensAcervo.filter(i => !i.visivelCatalogo).length, [itensAcervo]);
  const totalDestaques = useMemo(() => itensAcervo.filter(i => i.destaqueCatalogo).length, [itensAcervo]);

  const itensFiltradosAcervo = useMemo(() => {
    return itensAcervo.filter(item => {
      if (buscaAcervo) {
        const termo = buscaAcervo.toLowerCase();
        const nome = String(item.nome || '').toLowerCase();
        const cat = String(item.categoria || '').toLowerCase();
        const cod = String(item.codigo || '').toLowerCase();
        if (!nome.includes(termo) && !cat.includes(termo) && !cod.includes(termo)) return false;
      }
      if (filtroStatusAcervo === 'visiveis' && !item.visivelCatalogo) return false;
      if (filtroStatusAcervo === 'ocultos' && item.visivelCatalogo) return false;
      if (filtroStatusAcervo === 'destaques' && !item.destaqueCatalogo) return false;
      return true;
    });
  }, [itensAcervo, buscaAcervo, filtroStatusAcervo]);

  // Copiar link oficial
  const handleCopiarLink = async () => {
    if (!urlCatalogo) return;
    try {
      await navigator.clipboard.writeText(urlCatalogo);
      setCopiadoLink(true);
      setTimeout(() => setCopiadoLink(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  // Compartilhar WhatsApp
  const handleCompartilharWhats = () => {
    const texto = encodeURIComponent(`Olá! Conheça nosso Catálogo Online exclusivo com acervo completo de peças e decorações para sua festa:\n\n✨ Acesse aqui: ${urlCatalogo}`);
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
  };

  // Upload inteligente e comprimido de Logo (< 35KB)
  const handleUploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const otimizado = await comprimirImagemParaUpload(file, 400, 400, 0.85);
      setLogoUrl(otimizado);
    } catch (err) {
      console.error("Erro ao processar logotipo:", err);
      alert("Não foi possível processar a imagem do logotipo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Upload inteligente e comprimido de Capa (< 85KB, nunca estoura Firestore)
  const handleUploadCapa = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCapa(true);
    try {
      const otimizado = await comprimirImagemParaUpload(file, 1200, 480, 0.78);
      setCapaUrl(otimizado);
    } catch (err) {
      console.error("Erro ao processar imagem de capa:", err);
      alert("Não foi possível processar a imagem da capa.");
    } finally {
      setUploadingCapa(false);
    }
  };

  if (loading) {
    return (
      <div className="minha-vitrine-container">
        <div className="vitrine-loading-state">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando Central da Minha Vitrine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="minha-vitrine-container fade-in">

      {/* 👑 CABEÇALHO EXECUTIVO */}
      <header className="vitrine-hero-header">
        <div className="vitrine-header-info">
          <button 
            type="button" 
            className="btn-voltar-dash" 
            onClick={() => navigate('/dashboard')}
            title="Voltar ao Painel"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <div className="vitrine-title-badge-row">
              <h1 className="vitrine-main-title">Minha Vitrine Online</h1>
              <span className={`badge-vitrine-status ${catalogoAtivo ? 'online' : 'paused'}`}>
                <span className="pulse-dot"></span>
                {catalogoAtivo ? 'Vitrine No Ar' : 'Pausada / Em Manutenção'}
              </span>
            </div>
            <p className="vitrine-main-subtitle">
              Personalize a identidade da sua loja, acompanhe a saúde do acervo e veja como seus clientes navegam.
            </p>
          </div>
        </div>

        <div className="vitrine-header-actions">
          <button 
            type="button" 
            className="btn-secondary-celebre btn-ver-vitrine"
            onClick={() => navigate(`/catalogo/${tenantId}`)}
            title="Abrir o Catálogo como seu cliente visualiza"
          >
            <i className="fas fa-eye"></i>
            <span>Visualizar Vitrine</span>
          </button>

          <button 
            type="button" 
            className="btn-primary-celebre btn-salvar-vitrine"
            onClick={handleSalvar}
            disabled={salvando}
          >
            <i className={salvando ? "fas fa-spinner fa-spin" : salvoSucesso ? "fas fa-check" : "fas fa-floppy-disk"}></i>
            <span>{salvando ? "Salvando..." : salvoSucesso ? "Salvo com Sucesso!" : "Salvar Alterações"}</span>
          </button>
        </div>
      </header>

      {/* 📊 1. CARDS DE KPI EXECUTIVOS (1 LINHA NO DESKTOP / 2 COLUNAS NO MOBILE) */}
      <div className="clientes-stats-grid vitrine-kpis-grid">
        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(197, 160, 89, 0.12)', color: '#c5a059' }}>
            <i className="fas fa-boxes-stacked"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">ITENS PUBLICADOS</span>
            <div className="stat-value-row">
              <strong className="stat-num">{metricasEstoque.totalItens}</strong>
              <span className="stat-unit">peças no ar</span>
            </div>
            <span className="stat-sub positive">Vitrine sincronizada</span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669' }}>
            <i className="fas fa-camera"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">COM IMAGEM</span>
            <div className="stat-value-row">
              <strong className="stat-num">{metricasEstoque.itensComFoto}</strong>
              <span className="stat-unit">com foto</span>
            </div>
            <span className={`stat-sub ${metricasEstoque.itensSemFoto > 0 ? 'warning' : 'positive'}`}>
              {metricasEstoque.itensSemFoto > 0 ? `${metricasEstoque.itensSemFoto} sem foto` : '100% com foto'}
            </span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
            <i className="fas fa-tag"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">COM PREÇO VISÍVEL</span>
            <div className="stat-value-row">
              <strong className="stat-num">{metricasEstoque.itensComPreco}</strong>
              <span className="stat-unit">com valor</span>
            </div>
            <span className="stat-sub neutral">Transparência para o cliente</span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
            <i className="fas fa-heart-pulse"></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">SAÚDE DA LOJA</span>
            <div className="stat-value-row">
              <strong className="stat-num">{checklist.porcentagem}%</strong>
              <span className="stat-unit">prontidão</span>
            </div>
            <span className={`stat-sub ${checklist.porcentagem >= 80 ? 'positive' : 'warning'}`}>
              {checklist.porcentagem >= 80 ? 'Excelente estado' : 'Requer atenção'}
            </span>
          </div>
        </div>

        <div className="stat-card-pro">
          <div className="stat-icon-wrapper" style={{ background: catalogoAtivo ? 'rgba(5, 150, 105, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: catalogoAtivo ? '#059669' : '#ef4444' }}>
            <i className={catalogoAtivo ? "fas fa-globe" : "fas fa-pause"}></i>
          </div>
          <div className="stat-info-content">
            <span className="stat-title">ESTADO DA VITRINE</span>
            <div className="stat-value-row">
              <strong className="stat-num" style={{ fontSize: '1.05rem', color: catalogoAtivo ? '#059669' : '#ef4444' }}>
                {catalogoAtivo ? 'DISPONÍVEL' : 'PAUSADA'}
              </strong>
            </div>
            <span className="stat-sub neutral">{catalogoAtivo ? 'Recebendo visitas' : 'Acesso pausado'}</span>
          </div>
        </div>
      </div>

      {/* ⚠️ ALERTA PROATIVO CASO A VITRINE PRECISE DE AJUSTES */}
      {metricasEstoque.itensSemFoto > 0 && (
        <div className="vitrine-alerta-proativo">
          <div className="alerta-icon-box">
            <i className="fas fa-triangle-exclamation"></i>
          </div>
          <div className="alerta-texto-box">
            <strong>Atenção: Você possui {metricasEstoque.itensSemFoto} peça(s) publicada(s) sem foto!</strong>
            <p>Clientes costumam ignorar peças sem imagem. Adicione fotos reais para aumentar as conversões da sua vitrine.</p>
          </div>
          <button 
            type="button" 
            className="btn-alerta-acao" 
            onClick={() => navigate('/estoque')}
          >
            Ajustar no Estoque →
          </button>
        </div>
      )}

      {/* 🧭 NAVEGAÇÃO ENTRE CONFIGURAÇÕES DA VITRINE E GESTÃO DO ACERVO */}
      <div className="vitrine-nav-tabs-bar">
        <button 
          type="button" 
          className={`vitrine-nav-tab ${abaAtiva === 'config' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('config')}
        >
          <i className="fas fa-sliders"></i>
          <span>Identidade, Regras & Comunicação</span>
        </button>
        <button 
          type="button" 
          className={`vitrine-nav-tab ${abaAtiva === 'acervo' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('acervo')}
        >
          <i className="fas fa-boxes-stacked"></i>
          <span>Gerenciar Peças na Vitrine</span>
          <span className="tab-counter-badge">{itensAcervo.length}</span>
        </button>
      </div>

      {/* ⚙️ ABA 1: CONFIGURAÇÕES, REGRAS & IDENTIDADE */}
      {abaAtiva === 'config' && (
        <div className="vitrine-content-grid">

          {/* 🔗 BLOCO 1: PUBLICAÇÃO & LINK DA VITRINE */}
          <div className="vitrine-card-block span-2">
            <div className="block-header">
              <div className="block-icon gold">
                <i className="fas fa-link"></i>
              </div>
              <div>
                <h3>Publicação e Link Oficial</h3>
                <p>Controle a visibilidade da sua vitrine e o endereço que você envia para seus clientes.</p>
              </div>
            </div>

            <div className="block-body">
              {/* Chave Ativar / Pausar */}
              <div className="vitrine-toggle-row">
                <div className="toggle-info">
                  <strong>Ativar Catálogo Online</strong>
                  <span>Quando ativo, seu catálogo fica disponível publicamente para clientes visualizarem e enviarem pedidos.</span>
                </div>
                <label className="celebre-switch-label">
                  <input 
                    type="checkbox" 
                    checked={catalogoAtivo} 
                    onChange={(e) => setCatalogoAtivo(e.target.checked)} 
                  />
                  <span className="celebre-switch-slider"></span>
                </label>
              </div>

              {/* Input e Ações do Link */}
              <div className="vitrine-link-dock mt-16">
                <span className="link-label">Endereço Público da sua Vitrine:</span>
                <div className="link-input-group">
                  <input 
                    type="text" 
                    readOnly 
                    value={urlCatalogo} 
                    className="link-field" 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    type="button" 
                    className="btn-link-action btn-copy" 
                    onClick={handleCopiarLink}
                    title="Copiar Link"
                  >
                    <i className={copiadoLink ? "fas fa-check" : "fas fa-copy"}></i>
                    <span>{copiadoLink ? "Copiado!" : "Copiar"}</span>
                  </button>
                  <button 
                    type="button" 
                    className="btn-link-action btn-zap" 
                    onClick={handleCompartilharWhats}
                    title="Compartilhar no WhatsApp"
                  >
                    <i className="fab fa-whatsapp"></i>
                    <span>Compartilhar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 🎨 BLOCO 2: IDENTIDADE VISUAL & COR DA MARCA */}
          <div className="vitrine-card-block">
            <div className="block-header">
              <div className="block-icon purple">
                <i className="fas fa-palette"></i>
              </div>
              <div>
                <h3>Identidade da Vitrine</h3>
                <p>Personalize as cores, logotipo e o visual que representam sua marca.</p>
              </div>
            </div>

            <div className="block-body">
              {/* Seletor de Cores da Marca */}
              <div className="form-group-celebre">
                <label className="field-label">
                  Cor de Destaque da Vitrine (Botões, Badges e Carrinho):
                </label>
                <div className="cores-palette-picker">
                  {CORES_VITRINE.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`color-pill-btn ${corMarca === p.cor ? 'active' : ''}`}
                      style={{ backgroundColor: p.cor }}
                      onClick={() => handleTrocarCor(p.cor)}
                      title={`${p.nome} (${p.cor})`}
                    >
                      {corMarca === p.cor && <i className="fas fa-check"></i>}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span className="field-help-text">
                    Cor ativa: <strong style={{ color: corMarca }}>{CORES_VITRINE.find(c => c.cor === corMarca)?.nome || corMarca}</strong>
                  </span>
                  {salvandoCor && (
                    <small style={{ color: '#c5a059', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fas fa-spinner fa-spin"></i> Salvando cor...
                    </small>
                  )}
                  {avisoCor && (
                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.78rem' }}>
                      {avisoCor}
                    </span>
                  )}
                </div>

                {/* 🌟 PREVIEW EM TEMPO REAL DA COR NA VITRINE */}
                <div className="mini-vitrine-color-preview-card" style={{
                  marginTop: '14px',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: 'var(--fundo-principal, #f8fafc)',
                  border: '1.5px solid var(--borda, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '38px', 
                      height: '38px', 
                      borderRadius: '10px', 
                      background: corMarca, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '16px',
                      boxShadow: `0 3px 10px ${corMarca}40`
                    }}>
                      <i className="fas fa-magic"></i>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', color: 'var(--texto-principal, #0f172a)' }}>
                        Prévia dos Botões & Preços no Catálogo
                      </span>
                      <small style={{ fontSize: '0.73rem', color: 'var(--texto-secundario, #64748b)' }}>
                        Esta cor personaliza os botões, links, abas ativas e carrinho na vitrine do seu cliente.
                      </small>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button type="button" style={{
                      background: corMarca,
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      boxShadow: `0 3px 10px ${corMarca}40`,
                      cursor: 'default',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <i className="fas fa-plus"></i> Adicionar
                    </button>
                    <span style={{
                      color: corMarca,
                      fontWeight: 900,
                      fontSize: '0.92rem'
                    }}>
                      R$ 180,00
                    </span>
                  </div>
                </div>
              </div>

              {/* Título e Descrição */}
              <div className="form-group-celebre mt-14">
                <label className="field-label">Título da Loja (Nome na Vitrine):</label>
                <input 
                  type="text" 
                  className="celebre-input" 
                  placeholder="Ex.: Mimos & Festas Decorações" 
                  value={tituloLoja} 
                  onChange={(e) => setTituloLoja(e.target.value)} 
                />
              </div>

              <div className="form-group-celebre mt-12">
                <label className="field-label">Descrição / Slogan de Boas-Vindas:</label>
                <textarea 
                  className="celebre-textarea" 
                  rows="2" 
                  placeholder="Ex.: Peças exclusivas, kits pegue e monte e decorações completas para seu evento." 
                  value={descricaoLoja} 
                  onChange={(e) => setDescricaoLoja(e.target.value)} 
                />
              </div>

              {/* Uploads de Logo e Capa */}
              <div className="form-row-2col mt-14">
                <div className="upload-box-mini">
                  <span className="upload-label">Logotipo da Loja:</span>
                  <div className="upload-preview-area">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="thumb-logo-preview" />
                    ) : (
                      <div className="thumb-placeholder"><i className="fas fa-image"></i></div>
                    )}
                    <label className="btn-upload-file">
                      <i className={uploadingLogo ? "fas fa-spinner fa-spin" : "fas fa-upload"}></i>
                      <span>{logoUrl ? "Trocar Logo" : "Enviar Logo"}</span>
                      <input type="file" accept="image/*" onChange={handleUploadLogo} hidden />
                    </label>
                  </div>
                </div>

                <div className="upload-box-mini">
                  <span className="upload-label">Imagem de Capa (Banner):</span>
                  <div className="upload-preview-area">
                    {capaUrl ? (
                      <img src={capaUrl} alt="Capa" className="thumb-capa-preview" />
                    ) : (
                      <div className="thumb-placeholder"><i className="fas fa-panorama"></i></div>
                    )}
                    <label className="btn-upload-file">
                      <i className={uploadingCapa ? "fas fa-spinner fa-spin" : "fas fa-upload"}></i>
                      <span>{capaUrl ? "Trocar Capa" : "Enviar Capa"}</span>
                      <input type="file" accept="image/*" onChange={handleUploadCapa} hidden />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 📋 BLOCO 3: CHECKLIST DE PRONTIDÃO (DIAGNÓSTICO REAL) */}
          <div className="vitrine-card-block">
            <div className="block-header">
              <div className="block-icon emerald">
                <i className="fas fa-clipboard-check"></i>
              </div>
              <div>
                <h3>Prontidão do Catálogo</h3>
                <p>Checklist inteligente gerado com base no acervo atual da sua empresa.</p>
              </div>
            </div>

            <div className="block-body">
              {/* Barra de Progresso Geral */}
              <div className="readiness-meter-box">
                <div className="meter-header">
                  <strong>Índice de Prontidão da Vitrine</strong>
                  <span className="meter-pct" style={{ color: checklist.porcentagem >= 80 ? '#059669' : '#c5a059' }}>
                    {checklist.porcentagem}% Concluído
                  </span>
                </div>
                <div className="meter-track">
                  <div 
                    className="meter-fill" 
                    style={{ 
                      width: `${checklist.porcentagem}%`,
                      backgroundColor: checklist.porcentagem >= 80 ? '#059669' : '#c5a059'
                    }}
                  ></div>
                </div>
              </div>

              {/* Lista do Checklist */}
              <div className="checklist-items-stack mt-16">
                {checklist.itens.map(item => (
                  <div key={item.id} className={`checklist-item-row ${item.ok ? 'checked' : 'pending'}`}>
                    <div className="check-status-icon">
                      <i className={item.ok ? "fas fa-circle-check" : "far fa-circle"}></i>
                    </div>
                    <div className="check-text-content">
                      <span className="check-label">{item.label}</span>
                      {item.detalhe && <small className="check-detail">{item.detalhe}</small>}
                      {item.alerta && <span className="check-alert">{item.alerta}</span>}
                    </div>
                    {item.tipo === 'recomendado' && !item.ok && (
                      <span className="badge-recomendado">Recomendado</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 💰 BLOCO 4 (NOVO): REGRAS COMERCIAIS & PREÇOS */}
          <div className="vitrine-card-block">
            <div className="block-header">
              <div className="block-icon gold">
                <i className="fas fa-coins"></i>
              </div>
              <div>
                <h3>Políticas Comerciais & Preços</h3>
                <p>Configure a exibição de valores e as regras de sinal para reserva das festas.</p>
              </div>
            </div>

            <div className="block-body">
              {/* Alternador Ocultar Preços */}
              <div className="vitrine-toggle-row">
                <div className="toggle-info">
                  <strong>Ocultar Preços das Peças (Modo Sob Consulta)</strong>
                  <span>Quando ativado, os valores em R$ não são exibidos abertamente para clientes. Os itens mostram "Sob Consulta" e o orçamento é orçado sob medida.</span>
                </div>
                <label className="celebre-switch-label">
                  <input 
                    type="checkbox" 
                    checked={ocultarPrecos} 
                    onChange={(e) => setOcultarPrecos(e.target.checked)} 
                  />
                  <span className="celebre-switch-slider"></span>
                </label>
              </div>

              {/* Aviso de Sinal / Caução */}
              <div className="form-group-celebre mt-16">
                <label className="field-label">Aviso de Sinal / Caução de Reserva:</label>
                <input 
                  type="text" 
                  className="celebre-input"
                  placeholder="Ex.: Reserva confirmada mediante 50% de sinal. Caução devolvida na devolução."
                  value={avisoSinalCaucao}
                  onChange={(e) => setAvisoSinalCaucao(e.target.value)}
                />
                <div className="sugestoes-sinal-row">
                  <span style={{ fontSize: '0.73rem', color: 'var(--texto-secundario, #64748b)' }}>Sugestões rápidas:</span>
                  <button 
                    type="button" 
                    className="sugestao-pill-btn"
                    onClick={() => setAvisoSinalCaucao('Reserva confirmada mediante 50% de sinal.')}
                  >
                    + 50% de Sinal
                  </button>
                  <button 
                    type="button" 
                    className="sugestao-pill-btn"
                    onClick={() => setAvisoSinalCaucao('Reserva mediante 30% de sinal no contrato.')}
                  >
                    + 30% de Sinal
                  </button>
                  <button 
                    type="button" 
                    className="sugestao-pill-btn"
                    onClick={() => setAvisoSinalCaucao('Caução de segurança reembolsável após devolução.')}
                  >
                    + Caução Reembolsável
                  </button>
                  <button 
                    type="button" 
                    className="sugestao-pill-btn"
                    onClick={() => setAvisoSinalCaucao('50% na reserva e 50% no dia da retirada/entrega.')}
                  >
                    + 50% Reserva + 50% Entrega
                  </button>
                </div>
                <small className="field-help-text" style={{ display: 'block', marginTop: '6px' }}>
                  Este aviso aparece em destaque no resumo do carrinho e no envio do pedido no WhatsApp.
                </small>
              </div>
            </div>
          </div>

          {/* 🚚 BLOCO 5 (NOVO): LOGÍSTICA & CIDADES ATENDIDAS */}
          <div className="vitrine-card-block">
            <div className="block-header">
              <div className="block-icon blue">
                <i className="fas fa-truck-ramp-box"></i>
              </div>
              <div>
                <h3>Cidades & Regiões Atendidas</h3>
                <p>Informe o raio de atuação e cidades que sua empresa faz entregas ou montagem.</p>
              </div>
            </div>

            <div className="block-body">
              <div className="form-group-celebre">
                <label className="field-label">Cidades e Bairros Atendidos:</label>
                <input 
                  type="text" 
                  className="celebre-input"
                  placeholder="Ex.: Vargem Grande do Sul, São João da Boa Vista, Aguaí e região"
                  value={regioesAtendidas}
                  onChange={(e) => setRegioesAtendidas(e.target.value)}
                />
                <small className="field-help-text" style={{ display: 'block', marginTop: '6px' }}>
                  Exibido com ícone de entrega 🚚 no cabeçalho e na tela de finalização do carrinho.
                </small>
              </div>

              {regioesAtendidas && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(37, 99, 235, 0.08)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '1rem', color: '#2563eb' }}>📍</span>
                  <span style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 700 }}>
                    Prévia no Catálogo: "🚚 Atendemos: {regioesAtendidas}"
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 💬 BLOCO 6 (NOVO): PERSONALIZAÇÃO DA MENSAGEM DO WHATSAPP */}
          <div className="vitrine-card-block span-2">
            <div className="block-header">
              <div className="block-icon emerald">
                <i className="fab fa-whatsapp"></i>
              </div>
              <div>
                <h3>Personalização da Mensagem de Envio (WhatsApp)</h3>
                <p>Personalize o texto automático que seu cliente envia ao finalizar o pedido no catálogo.</p>
              </div>
            </div>

            <div className="block-body">
              <div className="form-group-celebre">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="field-label" style={{ margin: 0 }}>Modelo do Texto do WhatsApp:</label>
                  <button 
                    type="button" 
                    className="btn-restaurar-tpl"
                    onClick={restaurarModeloWhats}
                  >
                    Restaurar Modelo Padrão
                  </button>
                </div>

                <textarea 
                  className="celebre-textarea"
                  rows="4"
                  placeholder="Escreva a mensagem ou utilize as tags inteligentes abaixo..."
                  value={msgPadraoWhats}
                  onChange={(e) => setMsgPadraoWhats(e.target.value)}
                />

                {/* Barra de Tags Inteligentes */}
                <div className="tags-helper-bar">
                  <span className="tags-helper-title">Clique para inserir variáveis automáticas:</span>
                  <button type="button" className="tag-pill-btn" onClick={() => inserirTagWhats('{cliente}')}>
                    + {'{cliente}'}
                  </button>
                  <button type="button" className="tag-pill-btn" onClick={() => inserirTagWhats('{itens}')}>
                    + {'{itens}'}
                  </button>
                  <button type="button" className="tag-pill-btn" onClick={() => inserirTagWhats('{data}')}>
                    + {'{data}'}
                  </button>
                  <button type="button" className="tag-pill-btn" onClick={() => inserirTagWhats('{total}')}>
                    + {'{total}'}
                  </button>
                  <button type="button" className="tag-pill-btn" onClick={() => inserirTagWhats('{empresa}')}>
                    + {'{empresa}'}
                  </button>
                  <button type="button" className="tag-pill-btn" onClick={() => inserirTagWhats('{condicoes}')}>
                    + {'{condicoes}'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 📞 BLOCO 7: CONTATO & CANAIS DE ATENDIMENTO */}
          <div className="vitrine-card-block span-2">
            <div className="block-header">
              <div className="block-icon blue">
                <i className="fas fa-comments"></i>
              </div>
              <div>
                <h3>Contato e Atendimento</h3>
                <p>Canais oficiais onde o cliente entrará em contato para fechar o aluguel.</p>
              </div>
            </div>

            <div className="block-body">
              <div className="form-row-2col">
                <div className="form-group-celebre">
                  <label className="field-label">WhatsApp para Receber Solicitações:</label>
                  <div className="input-with-icon">
                    <i className="fab fa-whatsapp input-icon-prefix"></i>
                    <input 
                      type="text" 
                      className="celebre-input with-prefix" 
                      placeholder="(00) 00000-0000" 
                      value={whatsapp} 
                      onChange={(e) => setWhatsapp(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-group-celebre">
                  <label className="field-label">Instagram da Empresa (Opcional):</label>
                  <div className="input-with-icon">
                    <i className="fab fa-instagram input-icon-prefix"></i>
                    <input 
                      type="text" 
                      className="celebre-input with-prefix" 
                      placeholder="@suaempresa" 
                      value={instagram} 
                      onChange={(e) => setInstagram(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              {/* Mensagem em caso de manutenção */}
              {!catalogoAtivo && (
                <div className="form-group-celebre mt-16">
                  <label className="field-label" style={{ color: '#ef4444' }}>
                    <i className="fas fa-triangle-exclamation"></i> Mensagem exibida para o cliente enquanto o catálogo estiver pausado:
                  </label>
                  <textarea 
                    className="celebre-textarea" 
                    rows="2" 
                    value={msgManutencao} 
                    onChange={(e) => setMsgManutencao(e.target.value)} 
                  />
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 📦 ABA 2: GESTOR DE ACERVO, VISIBILIDADE & DESTAQUES */}
      {abaAtiva === 'acervo' && (
        <div className="acervo-gestor-wrapper">
          {/* Controles do Topo */}
          <div className="acervo-top-controls">
            <div className="acervo-search-group">
              <i className="fas fa-search acervo-search-icon"></i>
              <input 
                type="text" 
                className="acervo-search-input"
                placeholder="Buscar peça por nome, categoria ou código..."
                value={buscaAcervo}
                onChange={e => setBuscaAcervo(e.target.value)}
              />
              {buscaAcervo && (
                <button 
                  type="button" 
                  onClick={() => setBuscaAcervo('')}
                  style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="acervo-status-pills">
              <button 
                type="button" 
                className={`acervo-tab-chip ${filtroStatusAcervo === 'todos' ? 'active' : ''}`}
                onClick={() => setFiltroStatusAcervo('todos')}
              >
                Todas ({itensAcervo.length})
              </button>
              <button 
                type="button" 
                className={`acervo-tab-chip ${filtroStatusAcervo === 'visiveis' ? 'active' : ''}`}
                onClick={() => setFiltroStatusAcervo('visiveis')}
              >
                👁️ No Catálogo ({totalVisiveis})
              </button>
              <button 
                type="button" 
                className={`acervo-tab-chip ${filtroStatusAcervo === 'ocultos' ? 'active' : ''}`}
                onClick={() => setFiltroStatusAcervo('ocultos')}
              >
                👁️‍🗨️ Ocultas ({totalOcultas})
              </button>
              <button 
                type="button" 
                className={`acervo-tab-chip ${filtroStatusAcervo === 'destaques' ? 'active' : ''}`}
                onClick={() => setFiltroStatusAcervo('destaques')}
              >
                ⭐ Destaques ({totalDestaques})
              </button>
            </div>
          </div>

          {/* Configuração do Nome da Coleção de Destaques */}
          <div style={{
            marginBottom: '16px',
            padding: '12px 18px',
            borderRadius: '12px',
            background: 'var(--fundo-card, #ffffff)',
            border: '1.5px solid var(--borda, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem', color: '#c5a059' }}>⭐</span>
              <div>
                <strong style={{ fontSize: '0.86rem', display: 'block', color: 'var(--texto-principal, #0f172a)' }}>
                  Título da Coleção em Destaque na Vitrine:
                </strong>
                <small style={{ fontSize: '0.74rem', color: 'var(--texto-secundario, #64748b)' }}>
                  Este nome aparecerá como aba especial na lateral do seu catálogo para destacar seus kits e peças favoritas.
                </small>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="text" 
                className="celebre-input"
                style={{ height: '36px', minWidth: '220px', fontSize: '0.82rem' }}
                value={tituloDestaques}
                onChange={e => setTituloDestaques(e.target.value)}
                placeholder="Ex.: Destaques da Vitrine"
              />
              <button 
                type="button" 
                className="btn-primary-celebre"
                style={{ height: '36px', padding: '0 14px', fontSize: '0.78rem' }}
                onClick={handleSalvar}
                disabled={salvando}
              >
                Salvar Título
              </button>
            </div>
          </div>

          {/* Grid de Peças do Acervo */}
          {itensFiltradosAcervo.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'var(--fundo-card, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--borda, #e2e8f0)'
            }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🔍</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px 0' }}>Nenhuma peça encontrada</h3>
              <p style={{ color: 'var(--texto-secundario, #64748b)', fontSize: '0.85rem' }}>
                Tente buscar por outro termo ou mude o filtro de status acima.
              </p>
            </div>
          ) : (
            <div className="acervo-grid-cards">
              {itensFiltradosAcervo.map(item => {
                const emAtualizacao = atualizandoItemId === item.id;
                return (
                  <div key={item.id} className={`acervo-card-manage ${!item.visivelCatalogo ? 'oculto' : ''}`}>
                    <div className="acervo-card-main-info">
                      <div className="acervo-card-thumb-wrap">
                        {item.foto ? (
                          <img src={item.foto} alt={item.nome} className="acervo-card-thumb" />
                        ) : (
                          <span className="acervo-card-no-thumb">📦</span>
                        )}
                      </div>
                      <div className="acervo-card-texts">
                        <h4 className="acervo-card-name" title={item.nome}>{item.nome}</h4>
                        <span className="acervo-card-cat-badge">{item.categoria}</span>
                        <div className="acervo-card-price">
                          {item.preco > 0 ? `R$ ${item.preco.toFixed(2)}` : 'Preço a definir'}
                        </div>
                      </div>
                    </div>

                    <div className="acervo-card-actions-bar">
                      <button 
                        type="button" 
                        className={`btn-action-visivel ${item.visivelCatalogo ? 'visivel' : 'oculto'}`}
                        onClick={() => handleToggleVisibilidade(item)}
                        disabled={emAtualizacao}
                        title={item.visivelCatalogo ? "Clique para ocultar do catálogo público" : "Clique para exibir no catálogo público"}
                      >
                        <i className={emAtualizacao ? "fas fa-spinner fa-spin" : item.visivelCatalogo ? "fas fa-eye" : "fas fa-eye-slash"}></i>
                        <span>{item.visivelCatalogo ? 'No Catálogo' : 'Oculto'}</span>
                      </button>

                      <button 
                        type="button" 
                        className={`btn-action-destaque ${item.destaqueCatalogo ? 'destaque-ativo' : 'destaque-inativo'}`}
                        onClick={() => handleToggleDestaque(item)}
                        disabled={emAtualizacao}
                        title={item.destaqueCatalogo ? "Remover dos destaques" : "Marcar como destaque na vitrine"}
                      >
                        <i className={item.destaqueCatalogo ? "fas fa-star" : "far fa-star"}></i>
                        <span>{item.destaqueCatalogo ? 'Destaque' : 'Destacar'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default PainelMinhaVitrine;
