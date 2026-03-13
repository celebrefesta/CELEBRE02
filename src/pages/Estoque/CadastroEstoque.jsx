import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroEstoque.css';
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query, setDoc } from 'firebase/firestore';

import { CATALOGO_TEMAS, CATEGORIAS_FISICAS } from '../../catalogoDeTemas'; 

const CadastroEstoque = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const itemEditando = location.state?.itemEditando || null;
  const itemDuplicando = location.state?.itemDuplicando || null; 
  const dadosCompra = location.state?.dadosCompra || null; 

  const [salvando, setSalvando] = useState(false);
  const [itensExistentes, setItensExistentes] = useState([]);

  const [listasSistema, setListasSistema] = useState({
    localizacoes: [], tamanhos: []
  });

  const [fotos, setFotos] = useState([]);
  const [fotoPrincipalIndex, setFotoPrincipalIndex] = useState(0);
  const [posicoesFoco, setPosicoesFoco] = useState({}); 
  const [dragging, setDragging] = useState(false);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  
  const [fotoPreencher, setFotoPreencher] = useState(false); 

  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  
  const [categoria, setCategoria] = useState('');
  const [subCategoria, setSubCategoria] = useState('');
  
  const [categoriaTema, setCategoriaTema] = useState('');
  const [subcategoriaTema, setSubcategoriaTema] = useState('');
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');
  const [temaSelecionado, setTemaSelecionado] = useState('');
  const [temaDigitadoPersonalizado, setTemaDigitadoPersonalizado] = useState('');
  
  const [tipoCadastro, setTipoCadastro] = useState('avulsa');
  const [tipoPacote, setTipoPacote] = useState('PEGUE E MONTE');

  const [pecasKitNovas, setPecasKitNovas] = useState([{ 
      id: Date.now(), nome: '', valorAluguel: '', cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' 
  }]);

  const [itensDoKit, setItensDoKit] = useState([]); 
  const [modalCatalogoAberto, setModalCatalogoAberto] = useState(false);
  const [buscaCatalogo, setBuscaCatalogo] = useState('');
  const [filtroCategoriaCatalogo, setFiltroCategoriaCatalogo] = useState('Todos');

  const [quantidade, setQuantidade] = useState(1);
  const [estoqueMinimo, setEstoqueMinimo] = useState(1);
  const [alertaEstoque, setAlertaEstoque] = useState('NaoAvisar'); 
  const [fornecedor, setFornecedor] = useState('');
  const [linkFornecedor, setLinkFornecedor] = useState('');
  const [status, setStatus] = useState('ok'); 
  const [localizacao, setLocalizacao] = useState('');

  const [valorCompra, setValorCompra] = useState('');
  const [valorAluguel, setValorAluguel] = useState('');
  const [valorReposicao, setValorReposicao] = useState('');
  
  const [tamanho, setTamanho] = useState('');
  const [cor, setCor] = useState('');
  const [unidadeMedida, setUnidadeMedida] = useState('Unidade');
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [diametro, setDiametro] = useState('');
  const [comprimento, setComprimento] = useState('');
  
  const [tipoDisponibilidade, setTipoDisponibilidade] = useState('Aluguel');
  const [visivelCatalogo, setVisivelCatalogo] = useState(true);
  const [necessitaMontagem, setNecessitaMontagem] = useState('Não');
  const [voltagem, setVoltagem] = useState('Bivolt');
  const [observacoes, setObservacoes] = useState('');

  const [modalLocalizacaoAberto, setModalLocalizacaoAberto] = useState(false);
  const [novaLocalizacaoText, setNovaLocalizacaoText] = useState('');
  const [localizacoesEditaveis, setLocalizacoesEditaveis] = useState([]);
  const [salvandoLocalizacoes, setSalvandoLocalizacoes] = useState(false);

  const categoriasFisicasUnicas = Object.keys(CATEGORIAS_FISICAS);
  const subcategoriasFisicasDisponiveis = categoria ? CATEGORIAS_FISICAS[categoria] || [] : [];
  const ocultarVitrineFisica = categoria === "Capas e Têxteis" && (subCategoria === "Capas de Painel" || subCategoria === "Capas de Cilindro" || subCategoria === "Kits de Capas (Painel + Cilindros)");
  
  const EVENTOS_VITRINE = [
      "Aniversário", "Casamento", "Mêsversário", "Chá de Bebê", 
      "Chá Revelação", "Chá de Panela / Casa Nova", "Noivado", 
      "15 anos", "Formatura", "Religioso", "Corporativo", 
      "Escolar", "Datas Comemorativas"
  ];

  const categoriasDeTemaUnicas = Object.keys(CATALOGO_TEMAS).filter(cat => {
      if (tipoCadastro === 'decoracao') {
          return EVENTOS_VITRINE.includes(cat);
      } else {
          if (ocultarVitrineFisica && (cat === "Móveis e Estruturas" || cat === "Acessórios e Decoração")) {
              return false;
          }
          return true;
      }
  });

  const subcategoriasDisponiveis = categoriaTema ? Object.keys(CATALOGO_TEMAS[categoriaTema] || {}) : [];
  const gruposDisponiveis = (categoriaTema && subcategoriaTema) ? Object.keys(CATALOGO_TEMAS[categoriaTema][subcategoriaTema] || {}) : [];
  const temasDisponiveis = (categoriaTema && subcategoriaTema && grupoTemaSelecionado) ? CATALOGO_TEMAS[categoriaTema][subcategoriaTema][grupoTemaSelecionado] || [] : [];

  useEffect(() => {
    const fetchItens = async () => {
      const q = query(collection(db, "estoque"));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItensExistentes(docs);
    };
    fetchItens();

    const fetchConfiguracoes = async () => {
      try {
        const docRef = doc(db, "sistema", "parametros");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setListasSistema({
            localizacoes: dados.localizacoes || [], 
            tamanhos: dados.tamanhos || []
          });
        }
      } catch (e) { console.error("Erro:", e); }
    };
    fetchConfiguracoes();

    const itemBase = itemEditando || itemDuplicando;

    if (itemBase) {
      let nomeLimpo = itemBase.nome || '';
      if (nomeLimpo.toUpperCase().startsWith('KIT ')) nomeLimpo = nomeLimpo.substring(4).trim();
      setNome(itemDuplicando ? `${nomeLimpo} (Cópia)` : nomeLimpo); 
      
      setCodigo(itemEditando ? itemBase.codigo || '' : ''); 
      
      setCategoria(itemBase.categoria || ''); 
      setSubCategoria(itemBase.subCategoria || '');
      
      setCategoriaTema(itemBase.categoriaTema || '');
      setSubcategoriaTema(itemBase.subcategoriaTema || '');
      setGrupoTemaSelecionado(itemBase.grupoTema || ''); 
      setTemaSelecionado(itemBase.tema || '');
      
      const ehDecoracao = itemBase.especificacoes?.isDecoracao || false;
      const ehKitPai = itemBase.especificacoes?.isKitPai || itemBase.especificacoes?.isKit || false;

      if (ehDecoracao) {
          setTipoCadastro('decoracao');
          setTipoDisponibilidade('Aluguel');
          setItensDoKit(itemBase.especificacoes?.itensDecoracao || itemBase.especificacoes?.itensDoKit || []);
          setTipoPacote(itemBase.especificacoes?.tipoPacote || 'PEGUE E MONTE');
      } else if (ehKitPai) {
          setTipoCadastro('kit');
          setPecasKitNovas(itemBase.especificacoes?.pecasKit || []);
      } else {
          setTipoCadastro('avulsa');
      }

      setQuantidade(itemBase.quantidade || 1); setEstoqueMinimo(itemBase.estoqueMinimo || 1);
      setAlertaEstoque(itemBase.configuracao?.alertaEstoque || 'NaoAvisar'); 
      setFornecedor(itemBase.fornecedor || ''); setLinkFornecedor(itemBase.linkFornecedor || '');
      setLocalizacao(itemBase.localizacao || ''); setStatus(itemBase.status || 'ok');
      setValorCompra(itemBase.financeiro?.valorCompra?.toFixed(2).replace('.', ',') || '');
      setValorAluguel(itemBase.financeiro?.valorAluguel?.toFixed(2).replace('.', ',') || '');
      setValorReposicao(itemBase.financeiro?.valorReposicao?.toFixed(2).replace('.', ',') || '');
      setTamanho(itemBase.especificacoes?.tamanho || ''); setCor(itemBase.especificacoes?.cor || '');
      setUnidadeMedida(itemBase.especificacoes?.unidadeMedida || 'Unidade');
      setLargura(itemBase.especificacoes?.largura || ''); setAltura(itemBase.especificacoes?.altura || '');
      setDiametro(itemBase.especificacoes?.diametro || ''); setComprimento(itemBase.especificacoes?.comprimento || '');
      
      if (!ehDecoracao) setTipoDisponibilidade(itemBase.configuracao?.tipoDisponibilidade || 'Aluguel');
      
      setVisivelCatalogo(itemBase.configuracao?.visivelCatalogo !== false);
      setNecessitaMontagem(itemBase.configuracao?.necessitaMontagem || 'Não');
      setVoltagem(itemBase.configuracao?.voltagem || 'Bivolt');
      setObservacoes(itemBase.observacoes || '');
      setPosicoesFoco(itemBase.posicoesFoco || {});
      
      if (itemBase.fotos && itemBase.fotos.length > 0) setFotos(itemBase.fotos);
      else if (itemBase.foto) setFotos([itemBase.foto]);
    
    } else if (dadosCompra) {
      setNome(dadosCompra.nome || '');
      setQuantidade(dadosCompra.quantidade || 1);
      if (dadosCompra.valorEstimado) setValorCompra(Number(dadosCompra.valorEstimado).toFixed(2).replace('.', ','));
      if (dadosCompra.valorAluguel) setValorAluguel(Number(dadosCompra.valorAluguel).toFixed(2).replace('.', ','));
      setFornecedor(dadosCompra.fornecedor || '');
      setObservacoes(dadosCompra.obs || '');
      setStatus('pintura'); 
    }
  }, [itemEditando, itemDuplicando, dadosCompra]);

  const atualizarSKU = (tipo, cat) => {
    let catAlvo = tipo === 'decoracao' ? 'Decoração Completa' : cat;
    if (!catAlvo) {
        setCodigo('');
        return;
    }
    const prefixo = catAlvo === 'Decoração Completa' ? 'DEC' : catAlvo.substring(0, 3).toUpperCase();
    
    const matches = itensExistentes.filter(i => {
        const catStr = i.categoria || '';
        const pref = catStr === 'Decoração Completa' ? 'DEC' : catStr.substring(0, 3).toUpperCase();
        return pref === prefixo && i.id !== itemEditando?.id;
    });
    
    const novoNumero = matches.length + 1;
    setCodigo(`${prefixo}-${String(novoNumero).padStart(3, '0')}`);
  };

  useEffect(() => {
    if (!itemEditando && !itemDuplicando && itensExistentes.length > 0 && !codigo) {
        if (tipoCadastro === 'decoracao') {
            atualizarSKU('decoracao', '');
        } else if (categoria) {
            atualizarSKU(tipoCadastro, categoria);
        }
    }
  }, [itensExistentes]);

  const handleTipoCadastroChange = (novoTipo) => {
      setTipoCadastro(novoTipo);
      
      setCategoriaTema('');
      setSubcategoriaTema('');
      setGrupoTemaSelecionado('');
      setTemaSelecionado('');

      if (novoTipo === 'decoracao') {
          setUnidadeMedida('Combo');
          setTipoDisponibilidade('Aluguel');
          setCategoria('Decoração Completa');
          setSubCategoria('Pacote');
          atualizarSKU('decoracao', 'Decoração Completa');
      } else if (novoTipo === 'kit') {
          setUnidadeMedida('Kit');
          setCategoria('');
          setSubCategoria('');
          atualizarSKU('kit', '');
      } else {
          setUnidadeMedida('Unidade');
          setCategoria('');
          setSubCategoria('');
          atualizarSKU('avulsa', '');
      }
  };

  const autoPreencherVitrine = (catFis, subCatFis) => {
    let cTema = ''; let sTema = ''; let gTema = '';

    if (catFis === "Painéis e Estruturas") {
        cTema = "Móveis e Estruturas"; sTema = "Painéis e Fundos";
    } else if (catFis === "Móveis") {
        cTema = "Móveis e Estruturas";
        if (subCatFis === "Mesas" || subCatFis === "Aparadores" || subCatFis === "Carrinhos") sTema = "Mesas e Aparadores";
        else if (subCatFis === "Cilindros" || subCatFis === "Cubos") sTema = "Cilindros e Cubos";
    } else if (catFis === "Bandejas e Suportes") {
        cTema = "Acessórios e Decoração"; sTema = "Bandejas e Suportes";
    } else if (catFis === "Personagens e Displays") {
        cTema = ""; 
    } else if (catFis === "Vasos") {
        cTema = "Acessórios e Decoração"; sTema = "Vasos";
    } else if (catFis === "Florais e Natureza") {
        cTema = "Acessórios e Decoração"; sTema = "Florais e Natureza";
    } else if (catFis === "Tapetes e Pisos") {
        cTema = "Acessórios e Decoração"; sTema = "Tapetes e Pisos";
    } else if (catFis === "Capas e Têxteis") {
        if (subCatFis.includes("Toalhas") || subCatFis.includes("Cortinas")) {
            cTema = "Acessórios e Decoração"; sTema = "Mesas e Cortinas";
        } else {
            cTema = "";
        }
    } else if (catFis === "Iluminação") {
        cTema = "Acessórios e Decoração"; sTema = "Complementos e Iluminação"; gTema = "Iluminação";
    } else if (catFis === "Complementos de Chão") {
        cTema = "Acessórios e Decoração"; sTema = "Complementos e Iluminação"; gTema = "Objetos Decorativos";
    } else if (catFis === "Utensílios de Festa") {
        cTema = "Acessórios e Decoração"; sTema = "Bandejas e Suportes"; 
    }

    if (cTema) {
        setCategoriaTema(cTema);
        setSubcategoriaTema(sTema);
        setGrupoTemaSelecionado(gTema);
        setTemaSelecionado(''); 
    } else {
        setCategoriaTema('');
        setSubcategoriaTema('');
        setGrupoTemaSelecionado('');
        setTemaSelecionado('');
    }
  };

  const handleCategoriaChange = (e) => {
    const novaCat = e.target.value;
    setCategoria(novaCat);
    
    atualizarSKU(tipoCadastro, novaCat);
    
    let novaSub = '';
    if (CATEGORIAS_FISICAS[novaCat] && CATEGORIAS_FISICAS[novaCat].length > 0) {
        novaSub = CATEGORIAS_FISICAS[novaCat][0];
        setSubCategoria(novaSub);
    } else {
        setSubCategoria('');
    }

    autoPreencherVitrine(novaCat, novaSub); 
  };

  const formatarMoedaBlur = (setter) => (e) => {
    let valor = e.target.value;
    if (!valor) return;
    valor = valor.replace(',', '.');
    const num = parseFloat(valor);
    if (!isNaN(num)) setter(num.toFixed(2).replace('.', ','));
  };

  const handleFileChange = async (e) => {
    const inputTarget = e.target;
    const files = Array.from(inputTarget.files);
    if (files.length === 0) return;

    inputTarget.value = ''; 

    const novasFotos = await Promise.all(files.map(file => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) { resolve(null); return; }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX = 800; 
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } 
                    else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => resolve(null);
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }));

    const fotosValidas = novasFotos.filter(f => f !== null);
    setFotos(prev => [...prev, ...fotosValidas]);
  };

  const removerFoto = (index) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
    if (index === fotoPrincipalIndex) setFotoPrincipalIndex(0);
  };

  const getFocoAtual = () => {
      const foco = posicoesFoco[fotoPrincipalIndex] || {};
      return { x: foco.x ?? 50, y: foco.y ?? 50, z: foco.z ?? 1 };
  };

  const getFocoThumb = (idx) => {
      const foco = posicoesFoco[idx] || {};
      return { x: foco.x ?? 50, y: foco.y ?? 50, z: foco.z ?? 1 };
  };

  const handlePointerDown = (e) => {
    setDragging(true);
    e.preventDefault(); 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartMouse({ x: clientX, y: clientY });
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startMouse.x;
    const deltaY = clientY - startMouse.y;
    setStartMouse({ x: clientX, y: clientY });
    setPosicoesFoco(prev => {
      const current = prev[fotoPrincipalIndex] || { x: 50, y: 50, z: 1 };
      const velocidade = 0.6 / (current.z || 1); 
      let newX = (current.x ?? 50) + (deltaX * velocidade);
      let newY = (current.y ?? 50) + (deltaY * velocidade);
      return { ...prev, [fotoPrincipalIndex]: { ...current, x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) }};
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleZoomChange = (e) => {
    const novoZ = Number(e.target.value);
    setPosicoesFoco(prev => ({
        ...prev, 
        [fotoPrincipalIndex]: { ...(prev[fotoPrincipalIndex] || {x: 50, y: 50}), z: novoZ }
    }));
  };

  const atualizarPecaKitNova = (idx, campo, valor) => {
      const newPecas = [...pecasKitNovas];
      newPecas[idx][campo] = valor;
      setPecasKitNovas(newPecas);
  };

  const adicionarPecaAoKit = (peca) => {
      const jaExiste = itensDoKit.find(i => i.id === peca.id);
      if (jaExiste) {
          setItensDoKit(itensDoKit.map(i => i.id === peca.id ? {...i, qtd: i.qtd + 1} : i));
      } else {
          setItensDoKit([...itensDoKit, { id: peca.id, nome: peca.nome, precoOriginal: Number(peca.financeiro?.valorAluguel || 0), foto: peca.foto || peca.fotos?.[0] || '', qtd: 1 }]);
      }
  };

  const calcularTotalSomaAvulsaKit = () => {
      return itensDoKit.reduce((acc, item) => acc + (item.precoOriginal * item.qtd), 0);
  };

  const abrirModalLocalizacao = () => {
      setLocalizacoesEditaveis([...listasSistema.localizacoes]);
      setNovaLocalizacaoText('');
      setModalLocalizacaoAberto(true);
  };

  const handleAddLocalizacao = () => {
      if (!novaLocalizacaoText.trim()) return;
      if (localizacoesEditaveis.includes(novaLocalizacaoText.trim())) {
          alert("Esta prateleira/localização já existe!");
          return;
      }
      setLocalizacoesEditaveis([...localizacoesEditaveis, novaLocalizacaoText.trim()].sort());
      setNovaLocalizacaoText('');
  };

  const handleRemoveLocalizacao = (locToRemove) => {
      setLocalizacoesEditaveis(localizacoesEditaveis.filter(l => l !== locToRemove));
  };

  const handleSaveLocalizacoes = async () => {
      setSalvandoLocalizacoes(true);
      try {
          const docRef = doc(db, "sistema", "parametros");
          await setDoc(docRef, { localizacoes: localizacoesEditaveis }, { merge: true });
          
          setListasSistema(prev => ({ ...prev, localizacoes: localizacoesEditaveis }));
          setModalLocalizacaoAberto(false);
      } catch (error) {
          console.error("Erro ao salvar localizações:", error);
          alert("Erro ao salvar as localizações no banco de dados.");
      } finally {
          setSalvandoLocalizacoes(false);
      }
  };

  const categoriasCatalogoUnicas = ['Todos', ...new Set(itensExistentes.map(item => item.categoria).filter(Boolean))];
  
  const itensCatalogoFiltrados = itensExistentes.filter(item => {
      return !item.especificacoes?.isDecoracao && !item.especificacoes?.isKitPai && 
             (item.nome || '').toLowerCase().includes(buscaCatalogo.toLowerCase()) && 
             (filtroCategoriaCatalogo === 'Todos' || item.categoria === filtroCategoriaCatalogo);
  });

  const salvarItem = async (e) => {
    e.preventDefault();

    const isDecoracao = tipoCadastro === 'decoracao';
    const isKitNovo = tipoCadastro === 'kit';

    if (!isDecoracao && !categoria) return alert("❌ Selecione a Categoria física da peça (Ex: Móveis).");
    if (!isDecoracao && !subCategoria) return alert("❌ Selecione a Subcategoria física.");
    
    if (!categoriaTema) return alert("❌ Selecione a Categoria da Vitrine do Site.");
    if (!subcategoriaTema) return alert("❌ Selecione a Subcategoria da Vitrine.");
    if (!grupoTemaSelecionado) return alert("❌ Selecione o Grupo na Vitrine.");
    
    if (temaSelecionado === 'OUTRO_TEMA' && !temaDigitadoPersonalizado) {
        return alert("❌ Digite o nome do filtro personalizado!");
    } else if (!temaSelecionado) {
        return alert("❌ Selecione o Tema/Filtro Específico.");
    }
    
    // 🔥 TRAVA DE SEGURANÇA OBRIGATÓRIA PARA AS FILHAS 🔥
    if (isKitNovo && pecasKitNovas.some(p => (!p.tamanho.trim() && !p.cor.trim()))) {
        return alert("❌ OBRIGATÓRIO: Preencha o TAMANHO ou a COR de todas as peças filhas do Kit para o sistema não gerar nomes duplicados!");
    }
    if (isKitNovo && pecasKitNovas.some(p => !p.valorAluguel.trim())) {
        return alert("❌ Todas as peças filhas precisam ter um valor de aluguel preenchido.");
    }

    if (isDecoracao && itensDoKit.length === 0) {
        return alert("❌ Um Pacote precisa ter pelo menos 1 peça dentro dele. Abra o catálogo e adicione as peças.");
    }

    setSalvando(true);
    try {
      const limparValor = (val) => Number(String(val).replace(',', '.'));
      
      const catFinal = isDecoracao ? 'Decoração Completa' : categoria;
      const subCatFinal = isDecoracao ? 'Pacote' : subCategoria;
      const temaFinalParaSalvar = temaSelecionado === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : temaSelecionado;

      // 🔥 INTELIGÊNCIA DO NOME DO PAI 🔥
      const nomePrincipalFormatado = (isKitNovo && !nome.toUpperCase().includes('KIT')) ? `KIT ${nome.trim()}` : nome.trim();

      const dados = {
        nome: nomePrincipalFormatado, 
        codigo, 
        categoria: catFinal, 
        subCategoria: subCatFinal, 
        
        categoriaTema,
        subcategoriaTema,
        grupoTema: grupoTemaSelecionado, 
        tema: temaFinalParaSalvar, 
          
        status: isDecoracao ? 'ok' : status, 
        fornecedor: isDecoracao ? '' : fornecedor, 
        linkFornecedor: isDecoracao ? '' : linkFornecedor, 
        localizacao: isDecoracao ? '' : localizacao,
        quantidade: isDecoracao ? 0 : Number(quantidade), 
        estoqueMinimo: isDecoracao ? 0 : Number(estoqueMinimo),
        financeiro: { 
            valorCompra: isDecoracao ? 0 : limparValor(valorCompra), 
            valorAluguel: limparValor(valorAluguel), 
            valorReposicao: isDecoracao ? 0 : limparValor(valorReposicao) 
        },
        especificacoes: { 
            tamanho: tipoCadastro === 'avulsa' ? tamanho : '', 
            cor: tipoCadastro === 'avulsa' ? cor : '', 
            unidadeMedida, 
            largura: tipoCadastro === 'avulsa' ? Number(largura) : 0, 
            altura: tipoCadastro === 'avulsa' ? Number(altura) : 0, 
            diametro: tipoCadastro === 'avulsa' ? Number(diametro) : 0, 
            comprimento: tipoCadastro === 'avulsa' ? Number(comprimento) : 0,
            isDecoracao,
            tipoPacote: isDecoracao ? tipoPacote : '', 
            isKitPai: isKitNovo, 
            itensDecoracao: isDecoracao ? itensDoKit : [],
            pecasKit: isKitNovo ? pecasKitNovas : []
        },
        configuracao: { 
            tipoDisponibilidade: isDecoracao ? 'Aluguel' : tipoDisponibilidade, 
            visivelCatalogo, 
            necessitaMontagem, 
            voltagem, 
            alertaEstoque: isDecoracao ? 'NaoAvisar' : alertaEstoque 
        },
        observacoes, fotos, posicoesFoco, foto: fotos.length > 0 ? fotos[0] : '', 
        atualizadoEm: serverTimestamp()
      };

      if (itemEditando) {
        await updateDoc(doc(db, "estoque", itemEditando.id), dados);
        alert("Item atualizado com sucesso!");
      } else {
        const docRef = await addDoc(collection(db, "estoque"), { ...dados, criadoEm: serverTimestamp() });
        const mainId = docRef.id;

        if (isKitNovo && pecasKitNovas.length > 0) {
            for (let i = 0; i < pecasKitNovas.length; i++) {
                const peca = pecasKitNovas[i];
                
                if (peca.nome.trim() || peca.tamanho.trim() || peca.cor.trim()) {
                    const valPeca = Number(peca.valorAluguel.replace(',', '.'));
                    
                    // NOME LIMPO DO PAI PARA USAR NA FILHA
                    let nomePaiPrefixo = nome.trim();
                    if (nomePaiPrefixo.toUpperCase().startsWith('KIT ')) {
                         nomePaiPrefixo = nomePaiPrefixo.substring(4).trim();
                    }
                    
                    const nomePaiLimpoLower = nomePaiPrefixo.toLowerCase();
                    let sufixos = [];

                    if (peca.nome.trim()) {
                        let nomePecaLimpo = peca.nome.trim();
                        let nomePecaLower = nomePecaLimpo.toLowerCase();
                        
                        if (nomePecaLower !== nomePaiLimpoLower && !nomePecaLower.includes('cilindro') && !nomePecaLower.includes('painel')) {
                            if (nomePecaLower.startsWith(nomePaiLimpoLower)) {
                                let cortado = nomePecaLimpo.substring(nomePaiLimpoLower.length).trim();
                                if (cortado.startsWith('-')) cortado = cortado.substring(1).trim();
                                if (cortado) sufixos.push(cortado);
                            } else {
                                 sufixos.push(nomePecaLimpo);
                            }
                        }
                    }

                    if (peca.tamanho.trim()) sufixos.push(peca.tamanho.trim());
                    if (peca.cor.trim()) sufixos.push(peca.cor.trim());

                    let nomeFinalDaPeca = nomePaiPrefixo;
                    if (sufixos.length > 0) {
                        nomeFinalDaPeca = `${nomePaiPrefixo} - ${sufixos.join(' ')}`;
                    } else {
                        nomeFinalDaPeca = `${nomePaiPrefixo} - P${i+1}`;
                    }

                    const pecaDados = {
                        ...dados, 
                        nome: nomeFinalDaPeca, 
                        codigo: `${codigo}-P${i+1}`, 
                        financeiro: { ...dados.financeiro, valorAluguel: isNaN(valPeca) ? 0 : valPeca, valorCompra: 0, valorReposicao: 0 },
                        especificacoes: { 
                            ...dados.especificacoes, 
                            isKitPai: false, 
                            isSubPeca: true, 
                            kitPaiId: mainId, 
                            unidadeMedida: 'Unidade',
                            cor: peca.cor || '',
                            tamanho: peca.tamanho || '',
                            largura: Number(peca.largura) || 0,
                            altura: Number(peca.altura) || 0,
                            diametro: Number(peca.diametro) || 0,
                            comprimento: Number(peca.comprimento) || 0,
                            pecasKit: [],
                            itensDecoracao: []
                        },
                        quantidade: Number(quantidade) 
                    };
                    await addDoc(collection(db, "estoque"), { ...pecaDados, criadoEm: serverTimestamp() });
                }
            }
        }

        if (isDecoracao) alert(`✨ ${tipoPacote} salvo! Pronto para o catálogo.`);
        else if (isKitNovo) alert("📦 Conjunto salvo e peças desmembradas com sucesso no estoque!");
        else alert(itemDuplicando ? "📋 Peça duplicada com sucesso!" : "🧩 Peça avulsa adicionada com sucesso!");
      }
      navigate('/estoque');
    } catch (error) { alert("Erro ao salvar."); } 
    finally { setSalvando(false); }
  };

  const handleTextChange = (setter) => (e) => {
    const input = e.target.value;
    setter(input.charAt(0).toUpperCase() + input.slice(1).toLowerCase());
  };

  const focoAtual = getFocoAtual();

  return (
    <div className="page-container">
      <div className="page-header" style={{marginBottom: '20px'}}>
        <div className="header-text">
          <h1 className="page-title">
            {itemEditando ? 'EDITAR ACERVO' : itemDuplicando ? '📋 DUPLICAR PEÇA' : dadosCompra ? '✨ FINALIZAR COMPRA' : 'CADASTRAR NO ACERVO'}
          </h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>
            {itemDuplicando ? 'Altere as especificações (como cor ou tamanho) da nova peça antes de salvar.' : 'Cadastre peças unitárias, conjuntos ou pacotes de decoração prontos.'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <form onSubmit={salvarItem}>
          
          <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '30px' }}>
              <label style={{color: '#0f172a', fontWeight: '900', display: 'block', marginBottom: '15px', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>1. O QUE VOCÊ ESTÁ CADASTRANDO?</label>
              
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px'}}>
                
                <div onClick={() => handleTipoCadastroChange('avulsa')} style={{padding: '15px 20px', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', border: tipoCadastro === 'avulsa' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: tipoCadastro === 'avulsa' ? '#0f172a' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <span style={{fontSize: '28px'}}>{tipoCadastro === 'avulsa' ? '🧩' : '⬜'}</span>
                  <div>
                      <strong style={{color: tipoCadastro === 'avulsa' ? '#fff' : '#0f172a', fontSize: '15px', display: 'block'}}>PEÇA AVULSA / UNIDADE</strong>
                      <span style={{color: tipoCadastro === 'avulsa' ? '#94a3b8' : '#64748b', fontSize: '12px'}}>Item único (ex: 1 Bandeja, 1 Painel)</span>
                  </div>
                </div>
                
                <div onClick={() => handleTipoCadastroChange('kit')} style={{padding: '15px 20px', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', border: tipoCadastro === 'kit' ? '2px solid #3b82f6' : '1px solid #cbd5e1', background: tipoCadastro === 'kit' ? '#eff6ff' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <span style={{fontSize: '28px'}}>{tipoCadastro === 'kit' ? '📦' : '⬜'}</span>
                  <div>
                      <strong style={{color: tipoCadastro === 'kit' ? '#1d4ed8' : '#0f172a', fontSize: '15px', display: 'block'}}>KIT / CONJUNTO</strong>
                      <span style={{color: tipoCadastro === 'kit' ? '#3b82f6' : '#64748b', fontSize: '12px'}}>Gera peças separadas (ex: Trio Cilindro)</span>
                  </div>
                </div>

                <div onClick={() => handleTipoCadastroChange('decoracao')} style={{padding: '15px 20px', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', border: tipoCadastro === 'decoracao' ? '2px solid #c5a059' : '1px solid #cbd5e1', background: tipoCadastro === 'decoracao' ? '#fffbeb' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <span style={{fontSize: '28px'}}>{tipoCadastro === 'decoracao' ? '✨' : '⬜'}</span>
                  <div>
                      <strong style={{color: tipoCadastro === 'decoracao' ? '#b45309' : '#0f172a', fontSize: '15px', display: 'block'}}>DECORAÇÃO COMPLETA</strong>
                      <span style={{color: tipoCadastro === 'decoracao' ? '#c5a059' : '#64748b', fontSize: '12px'}}>Junta peças prontas que já existem.</span>
                  </div>
                </div>

              </div>

              {tipoCadastro === 'decoracao' && (
                <div style={{ marginTop: '15px', padding: '15px', background: '#fffbeb', borderRadius: '10px', border: '1px dashed #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', animation: 'fadeIn 0.3s' }}>
                    <div>
                        <strong style={{color: '#b45309', display: 'block', fontSize: '14px'}}>Qual é a modalidade deste serviço? *</strong>
                        <span style={{color: '#92400e', fontSize: '12px'}}>Isso ajuda o cliente a saber como funciona.</span>
                    </div>
                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                        <button 
                            type="button" 
                            onClick={() => setTipoPacote('PEGUE E MONTE')}
                            style={{padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', border: tipoPacote === 'PEGUE E MONTE' ? '2px solid #b45309' : '1px solid #fcd34d', background: tipoPacote === 'PEGUE E MONTE' ? '#b45309' : '#fff', color: tipoPacote === 'PEGUE E MONTE' ? '#fff' : '#b45309'}}
                        >
                            📦 Pegue e Monte
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setTipoPacote('DECORAÇÃO')}
                            style={{padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', border: tipoPacote === 'DECORAÇÃO' ? '2px solid #b45309' : '1px solid #fcd34d', background: tipoPacote === 'DECORAÇÃO' ? '#b45309' : '#fff', color: tipoPacote === 'DECORAÇÃO' ? '#fff' : '#b45309'}}
                        >
                            ✨ Decoração (Nós Montamos)
                        </button>
                    </div>
                </div>
              )}
          </div>

          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            
            <div style={{ width: '100%', maxWidth: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <h3 className="section-divider" style={{marginTop: 0, fontSize: '13px'}}>FOTO PRINCIPAL</h3>
                  
                  <div style={{ width: '100%', height: '280px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {fotos.length > 0 ? (
                      <>
                      <img 
                          src={fotos[fotoPrincipalIndex]} 
                          draggable={false} 
                          style={{ 
                            width: '100%', height: '100%', 
                            objectFit: fotoPreencher ? 'cover' : 'contain', 
                            objectPosition: `${focoAtual.x}% ${focoAtual.y}%`, 
                            transform: `scale(${focoAtual.z || 1})`,
                            cursor: dragging ? 'grabbing' : 'grab',
                            transition: dragging ? 'none' : 'transform 0.2s ease-out',
                            transformOrigin: 'center center'
                          }} 
                          onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}
                          onMouseMove={handlePointerMove} onTouchMove={handlePointerMove}
                          onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchEnd={handlePointerUp}
                      />
                      <div style={{position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', padding: '6px 12px', borderRadius: '12px', fontWeight: 'bold', pointerEvents: 'none'}}>
                          ✥ Arraste
                      </div>
                      </>
                  ) : (
                      <label htmlFor="upload-principal" style={{cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                      <span style={{fontSize:'45px', opacity:0.3, marginBottom: '10px'}}>📷</span>
                      <span style={{color: '#64748b', fontWeight: 'bold', fontSize: '13px'}}>Adicionar Foto</span>
                      <input id="upload-principal" type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                      </label>
                  )}
                  </div>
                  
                  {fotos.length > 0 && (
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px', background: '#f8fafc', padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                          <button 
                              type="button" 
                              onClick={(e) => { e.preventDefault(); setFotoPreencher(!fotoPreencher); }} 
                              style={{
                                  background: fotoPreencher ? '#0f172a' : '#fff', 
                                  color: fotoPreencher ? 'white' : '#64748b', 
                                  border: '1px solid #cbd5e1', 
                                  padding: '8px 12px', 
                                  borderRadius: '6px', 
                                  fontSize: '11px', 
                                  fontWeight: 'bold', 
                                  cursor: 'pointer', 
                                  transition: '0.2s', 
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                              }}
                          >
                              <span style={{fontSize: '14px'}}>{fotoPreencher ? '🔲' : '🖼️'}</span>
                              {fotoPreencher ? 'Preenchendo' : 'Foto Inteira'}
                          </button>
                          
                          <div style={{width: '1px', height: '20px', background: '#cbd5e1', margin: '0 5px'}}></div>
                          
                          <span style={{fontSize: '16px'}}>🔍</span>
                          <input 
                              type="range" 
                              min="1" max="3" step="0.1" 
                              value={focoAtual.z || 1} 
                              onChange={handleZoomChange} 
                              style={{flex: 1, cursor: 'pointer', accentColor: '#0f172a'}}
                          />
                      </div>
                  )}

                  {fotos.length > 0 && (
                      <div className="photo-thumbnails-row" style={{display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px', marginTop: '15px'}}>
                      {fotos.map((f, idx) => {
                          const tFoco = getFocoThumb(idx);
                          return (
                          <div key={idx} style={{width: '60px', height: '60px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', border: idx === fotoPrincipalIndex ? '2px solid #0f172a' : '1px solid #cbd5e1', position: 'relative', cursor: 'pointer'}} onClick={() => setFotoPrincipalIndex(idx)}>
                              <img src={f} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: `${tFoco.x}% ${tFoco.y}%`, transform: `scale(${tFoco.z})` }} />
                              <button type="button" onClick={(e) => {e.stopPropagation(); removerFoto(idx)}} style={{position: 'absolute', top: 0, right: 0, background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>×</button>
                          </div>
                      )})}
                      <label title="Adicionar mais fotos" style={{width: '60px', height: '60px', flexShrink: 0, borderRadius: '6px', border: '1px dashed #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', color: '#94a3b8', background: '#f8fafc'}}>
                          +
                          <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                      </label>
                      </div>
                  )}
              </div>

              {tipoCadastro === 'avulsa' && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <label style={{color: '#0f172a', fontWeight: 'bold', marginBottom: '12px', display: 'block', fontSize: '13px'}}>CARACTERÍSTICAS (Opcional)</label>
                  
                  <div style={{display: 'flex', gap: '10px', marginBottom: '12px'}}>
                    <div style={{flex: 1}}>
                      <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>TAMANHO / REF.</label>
                      <input value={tamanho} onChange={e => setTamanho(e.target.value)} placeholder="Ex: P" style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                    </div>
                    <div style={{flex: 1}}>
                      <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>COR PREDOMINANTE</label>
                      <input value={cor} onChange={handleTextChange(setCor)} placeholder="Ex: Rosa" style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                    </div>
                  </div>

                  <div style={{display: 'flex', gap: '10px'}}>
                    <div style={{flex: 1}}>
                      <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>LARG(cm)</label>
                      <input type="number" value={largura} onChange={e => setLargura(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                    </div>
                    <div style={{flex: 1}}>
                      <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>ALT(cm)</label>
                      <input type="number" value={altura} onChange={e => setAltura(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                    </div>
                    <div style={{flex: 1}}>
                      <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>DIÂM(cm)</label>
                      <input type="number" value={diametro} onChange={e => setDiametro(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '0', background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              
              <h3 className="section-divider" style={{marginTop: 0}}>INFORMAÇÕES DO ITEM</h3>
              <div className="form-grid-4">
                <div className="form-group span-3"><label>NOME DO {tipoCadastro === 'decoracao' ? 'PACOTE' : tipoCadastro === 'kit' ? 'CONJUNTO / KIT' : 'PRODUTO'} *</label><input value={nome} onChange={handleTextChange(setNome)} required placeholder={tipoCadastro === 'decoracao' ? "Ex: Decoração Completa Safari" : "Ex: Trio de Cilindros..."} style={{fontSize: '16px', fontWeight: 'bold'}} /></div>
                
                <div className="form-group span-1">
                    <label>CÓDIGO SKU</label>
                    <input 
                        value={codigo} 
                        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                        placeholder="Ex: CAP-001"
                        style={{backgroundColor: '#fff', color: '#0f172a', fontWeight: 'bold', border: '1px solid #cbd5e1'}} 
                    />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                  
                  {tipoCadastro !== 'decoracao' && (
                    <div style={{ flex: 1, minWidth: '300px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '20px' }}>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{fontSize: '20px'}}>📦</span> 1. COMO GUARDAR NO GALPÃO?
                        </h4>
                        <div className="form-group mb-15">
                            <label style={{color: '#334155'}}>CATEGORIA FÍSICA *</label>
                            <select value={categoria} onChange={handleCategoriaChange} required style={{backgroundColor: '#fff'}}>
                                <option value="" disabled hidden>Selecione...</option>
                                {categoriasFisicasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={{color: '#334155'}}>SUBCATEGORIA DA PRATELEIRA *</label>
                            <select value={subCategoria} onChange={e => {
                                const novaSub = e.target.value;
                                setSubCategoria(novaSub);
                                autoPreencherVitrine(categoria, novaSub);
                            }} disabled={!categoria} required style={{backgroundColor: '#fff'}}>
                                <option value="" disabled hidden>{!categoria ? 'Escolha a Categoria antes...' : 'Selecione...'}</option>
                                {subcategoriasFisicasDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                  )}

                  <div style={{ flex: 2, minWidth: '300px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '20px', position: 'relative' }}>
                      <div style={{position: 'absolute', top: '-12px', right: '15px', background: '#3b82f6', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold'}}>✨ Prenchimento Inteligente</div>
                      <h4 style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{fontSize: '20px'}}>🌐</span> 2. COMO O CLIENTE ACHA NO SITE?
                      </h4>
                      
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                        <div className="form-group">
                            <label style={{color: '#1e40af'}}>CATEGORIA NA VITRINE *</label>
                            <select value={categoriaTema} onChange={e => {
                                const novaCat = e.target.value;
                                setCategoriaTema(novaCat);
                                const subsDaCat = novaCat ? Object.keys(CATALOGO_TEMAS[novaCat] || {}) : [];
                                if (subsDaCat.length === 1) {
                                    setSubcategoriaTema(subsDaCat[0]);
                                    const gruposDaSub = Object.keys(CATALOGO_TEMAS[novaCat][subsDaCat[0]] || {});
                                    if (gruposDaSub.length === 1) { setGrupoTemaSelecionado(gruposDaSub[0]); } else { setGrupoTemaSelecionado(''); }
                                } else { setSubcategoriaTema(''); setGrupoTemaSelecionado(''); }
                                setTemaSelecionado('');
                            }} style={{borderColor: '#93c5fd', backgroundColor: '#fff'}} required>
                                <option value="" disabled hidden>Selecione...</option>
                                {categoriasDeTemaUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label style={{color: '#1e40af'}}>SUBCATEGORIA (Público/Tipo) *</label>
                            <select value={subcategoriaTema} onChange={e => {
                                const novaSub = e.target.value;
                                setSubcategoriaTema(novaSub);
                                const gruposDaSub = (categoriaTema && novaSub) ? Object.keys(CATALOGO_TEMAS[categoriaTema][novaSub] || {}) : [];
                                if (gruposDaSub.length === 1) { setGrupoTemaSelecionado(gruposDaSub[0]); } else { setGrupoTemaSelecionado(''); }
                                setTemaSelecionado('');
                            }} disabled={!categoriaTema || subcategoriasDisponiveis.length === 1} style={{borderColor: '#93c5fd', backgroundColor: '#fff'}} required>
                                <option value="" disabled hidden>{!categoriaTema ? 'Aguardando...' : 'Selecione...'}</option>
                                {subcategoriasDisponiveis.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{color: '#1e40af'}}>FILTRO DE GRUPO *</label>
                            <select value={grupoTemaSelecionado} onChange={e => {
                                setGrupoTemaSelecionado(e.target.value);
                                setTemaSelecionado('');
                            }} disabled={!subcategoriaTema || gruposDisponiveis.length === 1} style={{borderColor: '#93c5fd', backgroundColor: '#fff'}} required>
                                <option value="" disabled hidden>{!subcategoriaTema ? 'Aguardando...' : 'Selecione...'}</option>
                                {gruposDisponiveis.map(grupo => <option key={grupo} value={grupo}>{grupo}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{color: '#1e40af'}}>FILTRO ESPECÍFICO *</label>
                            <select value={temaSelecionado} onChange={e => setTemaSelecionado(e.target.value)} disabled={(!grupoTemaSelecionado && temaSelecionado !== 'OUTRO_TEMA')} style={{borderColor: '#93c5fd', backgroundColor: '#fff'}} required>
                                <option value="" disabled hidden>{!grupoTemaSelecionado ? 'Aguardando...' : 'Selecione o item exato...'}</option>
                                {temasDisponiveis.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                                <option value="OUTRO_TEMA" style={{fontWeight: 'bold', color: '#1d4ed8'}}>✏️ Digitar Outro Tema...</option>
                            </select>
                        </div>
                      </div>

                      {temaSelecionado === 'OUTRO_TEMA' && (
                          <div className="form-group" style={{animation: 'fadeIn 0.3s', marginTop: '15px'}}>
                              <label style={{color: '#1d4ed8'}}>NOME DO TEMA PERSONALIZADO *</label>
                              <input type="text" placeholder="Ex: Safari Baby..." value={temaDigitadoPersonalizado} onChange={e => setTemaDigitadoPersonalizado(e.target.value)} style={{borderColor: '#3b82f6', backgroundColor: '#fff'}} autoFocus/>
                          </div>
                      )}
                  </div>
              </div>

              {tipoCadastro === 'decoracao' && (
                <div style={{marginTop: '30px', border: '2px dashed #fde68a', padding: '20px', borderRadius: '10px', backgroundColor: '#fffbeb'}}>
                  <h3 style={{margin: '0 0 5px 0', color: '#b45309'}}>✨ MONTAGEM DA DECORAÇÃO</h3>
                  <p style={{fontSize: '12px', color: '#92400e', marginBottom: '15px'}}>
                    Abra o catálogo abaixo e selecione quais peças do seu galpão compõem esta Decoração. O sistema fará a baixa de todas elas no calendário juntas!
                  </p>
                  
                  <button type="button" onClick={() => setModalCatalogoAberto(true)} style={{width: '100%', padding: '15px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', fontSize: '14px', transition: '0.2s'}}>
                      + ABRIR ACERVO E ADICIONAR PEÇAS
                  </button>
                  
                  {itensDoKit.length > 0 ? (
                      <div style={{background: '#ffffff', borderRadius: '8px', border: '1px solid #fcd34d', overflow: 'hidden'}}>
                          {itensDoKit.map((item, idx) => (
                              <div key={item.id} style={{display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', borderBottom: idx !== itensDoKit.length - 1 ? '1px solid #fef3c7' : 'none'}}>
                                  <div style={{width: '45px', height: '45px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0}}>
                                      {item.foto ? <img src={item.foto} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : ''}
                                  </div>
                                  <div style={{flex: 1}}>
                                      <strong style={{fontSize: '13px', color: '#0f172a', display: 'block'}}>{item.nome}</strong>
                                      <span style={{fontSize: '12px', color: '#64748b'}}>Valor base: R$ {item.precoOriginal.toFixed(2)}</span>
                                  </div>
                                  <div style={{display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', padding: '4px'}}>
                                      <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? {...i, qtd: Math.max(1, i.qtd - 1)} : i))} style={{border: 'none', background: 'white', borderRadius: '4px', width: '25px', height: '25px', fontWeight: 'bold', cursor: 'pointer'}}>-</button>
                                      <span style={{fontSize: '14px', fontWeight: 'bold', width: '30px', textAlign: 'center'}}>{item.qtd}</span>
                                      <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? {...i, qtd: i.qtd + 1} : i))} style={{border: 'none', background: 'white', borderRadius: '4px', width: '25px', height: '25px', fontWeight: 'bold', cursor: 'pointer'}}>+</button>
                                  </div>
                                  <button type="button" onClick={() => setItensDoKit(itensDoKit.filter(i => i.id !== item.id))} style={{background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold'}}>Remover</button>
                              </div>
                          ))}
                          <div style={{background: '#fef3c7', padding: '15px', textAlign: 'right', borderTop: '1px dashed #f59e0b'}}>
                              <span style={{fontSize: '12px', color: '#b45309'}}>Se alugadas avulsas, dariam: </span>
                              <strong style={{fontSize: '18px', color: '#92400e'}}>R$ {calcularTotalSomaAvulsaKit().toFixed(2)}</strong>
                          </div>
                      </div>
                  ) : (
                      <div style={{textAlign: 'center', padding: '30px', color: '#b45309', background: '#fff', borderRadius: '8px', fontSize: '13px'}}>
                          Sua decoração ainda está vazia.
                      </div>
                  )}
                </div>
              )}

              {/* 🔥 MÓDULO INTELIGENTE DO KIT: OBRIGATORIEDADE ATIVADA 🔥 */}
              {tipoCadastro === 'kit' && (
                <div style={{marginTop: '30px', border: '2px dashed #93c5fd', padding: '20px', borderRadius: '10px', backgroundColor: '#eff6ff'}}>
                  <h3 style={{margin: '0 0 5px 0', color: '#1d4ed8'}}>📦 DESMEMBRAR CONJUNTO (PEÇAS FILHAS)</h3>
                  <p style={{fontSize: '12px', color: '#ef4444', marginBottom: '15px', fontWeight: 'bold'}}>
                    ⚠️ Obrigatório: Defina o Tamanho ou a Cor de cada peça para que o sistema possa diferenciá-las.
                  </p>
                  
                  {pecasKitNovas.map((p, idx) => (
                    <div key={p.id} style={{background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'}}>
                      
                      <div style={{display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap'}}>
                        <div style={{flex: 2, minWidth: '120px'}}>
                          <label style={{fontSize: '10px', fontWeight: 'bold', color: '#64748b'}}>NOME (Ex: Tampo, Base)</label>
                          <input type="text" placeholder="Pode ficar vazio..." value={p.nome} onChange={e => atualizarPecaKitNova(idx, 'nome', e.target.value)} style={{width: '100%', padding: '10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '80px'}}>
                          <label style={{fontSize: '10px', fontWeight: 'bold', color: '#1d4ed8'}}>TAMANHO *</label>
                          <input type="text" placeholder="Ex: P, M, 2x2" value={p.tamanho} onChange={e => atualizarPecaKitNova(idx, 'tamanho', e.target.value)} style={{width: '100%', padding: '10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #93c5fd', boxSizing: 'border-box'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '80px'}}>
                          <label style={{fontSize: '10px', fontWeight: 'bold', color: '#1d4ed8'}}>COR *</label>
                          <input type="text" placeholder="Ex: Rosa" value={p.cor} onChange={e => atualizarPecaKitNova(idx, 'cor', e.target.value)} style={{width: '100%', padding: '10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #93c5fd', boxSizing: 'border-box'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '100px'}}>
                          <label style={{fontSize: '10px', fontWeight: 'bold', color: '#64748b'}}>VALOR (R$) *</label>
                          <input type="text" placeholder="0,00" value={p.valorAluguel} onChange={e => atualizarPecaKitNova(idx, 'valorAluguel', e.target.value)} onBlur={e => {
                              let val = e.target.value.replace(',', '.');
                              const num = parseFloat(val);
                              if(!isNaN(num)) atualizarPecaKitNova(idx, 'valorAluguel', num.toFixed(2).replace('.', ','));
                          }} style={{width: '100%', padding: '10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: 'bold', color: '#1d4ed8'}} />
                        </div>
                        
                        <button type="button" onClick={() => setPecasKitNovas(pecasKitNovas.filter(item => item.id !== p.id))} style={{background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', marginTop: '18px', padding: '0 15px', cursor: 'pointer', fontWeight: 'bold', height: '38px'}}>Remover</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setPecasKitNovas([...pecasKitNovas, { id: Date.now(), nome: '', valorAluguel: '', cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' }])} style={{background: '#dbeafe', color: '#1d4ed8', border: 'none', width: '100%', padding: '15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', fontSize: '14px'}}>+ Adicionar Peça Filha</button>
                </div>
              )}

              <div style={{ opacity: tipoCadastro === 'decoracao' ? 0.3 : 1, pointerEvents: tipoCadastro === 'decoracao' ? 'none' : 'auto', transition: '0.3s', marginTop: '30px' }}>
                  <h3 className="section-divider mt-compact">FINANCEIRO & ESTOQUE (Do Item Principal)</h3>
                  
                  <div className="form-grid-4">
                    <div className="form-group span-2">
                        <label style={{color: '#10b981', fontWeight: 900, fontSize: '13px'}}>PREÇO DO ALUGUEL (R$) *</label>
                        <input type="text" value={valorAluguel} onChange={e => setValorAluguel(e.target.value)} onBlur={formatarMoedaBlur(setValorAluguel)} required style={{borderColor: '#10b981', backgroundColor: '#ecfdf5', fontSize: '18px', fontWeight: 'bold', padding: '15px'}} placeholder="0,00"/>
                    </div>
                    
                    <div className="form-group span-1">
                        <label>VALOR COMPRA</label>
                        <input type="text" value={valorCompra} onChange={e => setValorCompra(e.target.value)} onBlur={formatarMoedaBlur(setValorCompra)} placeholder="0,00" tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/>
                    </div>
                    <div className="form-group span-1">
                        <label>REPOSIÇÃO</label>
                        <input type="text" value={valorReposicao} onChange={e => setValorReposicao(e.target.value)} onBlur={formatarMoedaBlur(setValorReposicao)} placeholder="0,00" tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/>
                    </div>
                  </div>

                  <div className="form-grid-4 mt-15">
                    <div className="form-group">
                        <label>QUANTIDADE</label>
                        {tipoCadastro === 'decoracao' || tipoCadastro === 'kit' ? (
                            <div style={{padding: '12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '12px', color: '#64748b', fontWeight: 'bold', border: '1px solid #cbd5e1', textAlign: 'center'}}>
                                Automático
                            </div>
                        ) : (
                            <input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} min="1" style={{fontWeight: 'bold', fontSize: '16px', textAlign: 'center'}}/>
                        )}
                    </div>
                    <div className="form-group"><label>ESTOQUE MÍNIMO</label><input type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} disabled={alertaEstoque === 'NaoAvisar'}/></div>
                    
                    {/* 🔥 CAMPO LOCALIZAÇÃO COM BOTÃO DE GERENCIAR 🔥 */}
                    <div className="form-group span-2">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ margin: 0 }}>LOCALIZAÇÃO NO GALPÃO</label>
                            <button 
                                type="button" 
                                onClick={abrirModalLocalizacao} 
                                style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                + Gerenciar Prateleiras
                            </button>
                        </div>
                        <select value={localizacao} onChange={e => setLocalizacao(e.target.value)}>
                            <option value="" disabled hidden>Corredor / Prateleira...</option>
                            {listasSistema.localizacoes.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                  </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                <Link to={dadosCompra ? "/compras" : "/estoque"} style={{ padding: '16px 30px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: 'bold', textDecoration: 'none', transition: '0.2s' }}>Cancelar</Link>
                <button type="submit" style={{ padding: '16px 40px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', fontSize: '16px', letterSpacing: '0.5px', boxShadow: '0 4px 15px rgba(15,23,42,0.3)', transition: '0.2s' }} disabled={salvando} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    {salvando ? 'Salvando...' : (tipoCadastro === 'decoracao' ? `💾 SALVAR ${tipoPacote}` : tipoCadastro === 'kit' ? '💾 SALVAR CONJUNTO' : '💾 SALVAR PEÇA')}
                </button>
              </div>

            </div>
          </div>
        </form>
      </div>

      {modalCatalogoAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 99999 }}>
          <div className="modal-box-premium catalogo-modal" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
            
            <div className="modal-header" style={{ padding: '20px 30px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>📦 Acervo Físico <span style={{color: '#64748b', fontSize: '14px'}}>(Escolha as peças do pacote)</span></h3>
              <button className="btn-fechar" onClick={() => setModalCatalogoAberto(false)}>X</button>
            </div>
            
            <div className="catalogo-filtros" style={{ padding: '15px 30px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <input type="text" className="search-input-clean" style={{ border: '1px solid #cbd5e1', padding: '14px 18px', borderRadius: '8px', width: '100%', maxWidth: '500px', fontSize: '15px', outline: 'none' }} placeholder="🔎 Buscar peça no acervo..." value={buscaCatalogo} onChange={e => setBuscaCatalogo(e.target.value)} onFocus={e => e.target.style.borderColor = '#0f172a'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
              <div className="chips-categorias" style={{ marginTop: '15px', gap: '8px' }}>
                {categoriasCatalogoUnicas.map(cat => (
                  <button key={cat} type="button" className={`chip-cat ${filtroCategoriaCatalogo === cat ? 'active' : ''}`} onClick={() => setFiltroCategoriaCatalogo(cat)}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="catalogo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', overflowY: 'auto', padding: '20px 30px', background: '#f1f5f9', flexGrow: 1 }}>
              {itensCatalogoFiltrados.map(item => {
                const qtdFisica = parseInt(item.quantidade || 0) || parseInt(item.estoque || 0) || 0;
                const qtdManutencao = parseInt(item.manutencao || 0) || parseInt(item.emManutencao || 0) || parseInt(item.qtdManutencao || 0) || parseInt(item.avariadas || 0) || parseInt(item.defeito || 0) || parseInt(item.quebradas || 0) || 0;
                const totalFisicoReal = Math.max(0, qtdFisica - qtdManutencao);

                const pecaNoKit = itensDoKit.find(i => i.id === item.id);
                const qtdNoKit = pecaNoKit ? pecaNoKit.qtd : 0;
                const foiAdicionado = qtdNoKit > 0;

                return (
                  <div key={item.id} onClick={() => adicionarPecaAoKit(item)} style={{ background: '#fff', border: foiAdicionado ? '2px solid #10b981' : '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '280px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}>
                    
                    <div style={{ height: '140px', width: '100%', flexShrink: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.foto ? <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{fontSize:'35px'}}>📷</span>}
                    </div>
                    
                    <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                        <div>
                            <strong style={{ fontSize: '14px', color: '#0f172a', marginBottom: '2px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.nome}</strong>
                            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>{item.categoria}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                            <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 'bold', display: 'block' }}>LIVRES</span>
                                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{totalFisicoReal}</strong>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                <button style={{ width: '32px', height: '32px', background: '#0f172a', color: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', border: 'none', cursor: 'pointer' }}>
                                    +
                                </button>
                                {foiAdicionado && (
                                    <span style={{background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', position: 'absolute', top: '10px', right: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>Incluso: {qtdNoKit}</span>
                                )}
                            </div>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 NOVO MODAL PARA GERENCIAR LOCALIZAÇÕES (PRATELEIRAS) 🔥 */}
      {modalLocalizacaoAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 100000 }}>
          <div className="modal-box-premium" style={{ maxWidth: '400px', width: '90%', padding: '25px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>📍 Gerenciar Prateleiras</h3>
              <button onClick={() => setModalLocalizacaoAberto(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input 
                  type="text" 
                  placeholder="Ex: Corredor A, Gaveta 3..." 
                  value={novaLocalizacaoText}
                  onChange={e => setNovaLocalizacaoText(e.target.value)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && handleAddLocalizacao()}
              />
              <button 
                  type="button" 
                  onClick={handleAddLocalizacao}
                  style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                  Adicionar
              </button>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc' }}>
                {localizacoesEditaveis.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Nenhuma localização cadastrada.</div>
                ) : (
                    localizacoesEditaveis.map((loc, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderBottom: idx !== localizacoesEditaveis.length - 1 ? '1px solid #e2e8f0' : 'none', background: '#fff' }}>
                            <span style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>{loc}</span>
                            <button 
                                type="button" 
                                onClick={() => handleRemoveLocalizacao(loc)}
                                style={{ background: '#fee2e2', color: '#ef4444', border: 'none', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                                title="Remover"
                            >
                                ×
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" onClick={() => setModalLocalizacaoAberto(false)} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>
                  Cancelar
              </button>
              <button type="button" onClick={handleSaveLocalizacoes} disabled={salvandoLocalizacoes} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {salvandoLocalizacoes ? 'Salvando...' : 'Salvar no Sistema'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CadastroEstoque;