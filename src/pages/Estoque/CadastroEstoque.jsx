import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroEstoque.css';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query, setDoc, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

import { CATALOGO_TEMAS, CATEGORIAS_FISICAS } from '../../catalogoDeTemas';

const CadastroEstoque = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const itemEditando = location.state?.itemEditando || null;
  const itemDuplicando = location.state?.itemDuplicando || null; 
  const dadosCompra = location.state?.dadosCompra || null; 

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🔥 IDENTIFICAÇÃO CORPORATIVA (A chave para puxar e salvar dados no cofre da empresa)
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

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
  const [tagsInput, setTagsInput] = useState('');
  
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
  const [modalNovaPecaAberto, setModalNovaPecaAberto] = useState(false);
  const [novaPecaNome, setNovaPecaNome] = useState('');
  const [novaPecaCategoria, setNovaPecaCategoria] = useState('Geral');
  const [novaPecaPreco, setNovaPecaPreco] = useState('');
  const [novaPecaQtd, setNovaPecaQtd] = useState(1);
  const [salvandoNovaPecaRapida, setSalvandoNovaPecaRapida] = useState(false);

  // 📷 LEITOR DE CÂMERA DE QR/BARCODE PARA O SKU DA PEÇA
  const [cameraCadastroAberta, setCameraCadastroAberta] = useState(false);
  const html5QrCodeCadastroRef = useRef(null);

  const iniciarScannerCadastro = async () => {
    setCameraCadastroAberta(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader-camera-cadastro");
        html5QrCodeCadastroRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            setCodigo(decodedText);
            if (html5QrCodeCadastroRef.current) {
              html5QrCodeCadastroRef.current.stop().then(() => {
                html5QrCodeCadastroRef.current.clear();
                html5QrCodeCadastroRef.current = null;
                setCameraCadastroAberta(false);
              }).catch(() => setCameraCadastroAberta(false));
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Erro ao iniciar câmera no cadastro:", err);
        alert("⚠️ Permissão de câmera negada ou dispositivo sem câmera.");
        setCameraCadastroAberta(false);
      }
    }, 350);
  };

  const pararScannerCadastro = async () => {
    if (html5QrCodeCadastroRef.current) {
      try {
        await html5QrCodeCadastroRef.current.stop();
        html5QrCodeCadastroRef.current.clear();
      } catch (e) {}
      html5QrCodeCadastroRef.current = null;
    }
    setCameraCadastroAberta(false);
  };

  const salvarNovaPecaRapidaNoAcervo = async (e) => {
    e.preventDefault();
    if (!novaPecaNome.trim()) return alert("Digite o nome da nova peça!");
    if (!usuarioLogado) return alert("Erro: Você precisa estar logado!");

    setSalvandoNovaPecaRapida(true);
    try {
      const valNumber = Number(String(novaPecaPreco).replace(',', '.')) || 0;
      const prefixo = novaPecaCategoria ? novaPecaCategoria.substring(0, 3).toUpperCase() : 'PEC';
      const novoCodigo = `${prefixo}-${String(itensExistentes.length + 1).padStart(3, '0')}`;

      const novaPecaDados = {
        userId: tenantId,
        nome: novaPecaNome.trim(),
        codigo: novoCodigo,
        categoria: novaPecaCategoria || 'Geral',
        subCategoria: 'Peça Avulsa',
        categoriaTema: novaPecaCategoria || 'Acessórios e Decoração',
        subcategoriaTema: 'Objetos Decorativos',
        grupoTema: 'Geral',
        tema: 'Geral',
        status: 'ok',
        quantidade: Number(novaPecaQtd) || 1,
        estoqueMinimo: 1,
        financeiro: { valorAluguel: valNumber, valorCompra: 0, valorReposicao: 0 },
        especificacoes: { isDecoracao: false, isKitPai: false, isSubPeca: false, tamanho: '', cor: '' },
        configuracao: { tipoDisponibilidade: 'Aluguel', visivelCatalogo: true },
        foto: '', fotos: [],
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "estoque"), novaPecaDados);
      const novaPecaCriada = { id: docRef.id, ...novaPecaDados };

      setItensExistentes(prev => [novaPecaCriada, ...prev]);

      // Adiciona automaticamente à Decoração Completa
      adicionarPecaAoKit({
        id: docRef.id,
        nome: novaPecaNome.trim(),
        precoOriginal: valNumber,
        categoria: novaPecaCategoria || 'Geral',
        foto: ''
      });

      setNovaPecaNome('');
      setNovaPecaPreco('');
      setNovaPecaQtd(1);
      setModalNovaPecaAberto(false);
      alert(`✨ Peça "${novaPecaNome.trim()}" cadastrada no acervo e adicionada ao pacote!`);
    } catch (err) {
      console.error("Erro ao cadastrar nova peça rápida:", err);
      alert("Erro ao cadastrar peça no acervo.");
    } finally {
      setSalvandoNovaPecaRapida(false);
    }
  };
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
  const [modalCorredor, setModalCorredor] = useState('');
  const [modalPrateleira, setModalPrateleira] = useState('');
  const [modalBandeja, setModalBandeja] = useState('');
  const [localizacoesEditaveis, setLocalizacoesEditaveis] = useState([]);
  const [salvandoLocalizacoes, setSalvandoLocalizacoes] = useState(false);

  const gerarPreviewModalEndereco = () => {
    const partes = [];
    if (modalCorredor.trim()) partes.push(modalCorredor.trim().toUpperCase().startsWith('CORREDOR') ? modalCorredor.trim() : `Corredor ${modalCorredor.trim()}`);
    if (modalPrateleira.trim()) partes.push(modalPrateleira.trim().toUpperCase().startsWith('PRATELEIRA') || modalPrateleira.trim().toUpperCase().startsWith('ESTANTE') ? modalPrateleira.trim() : `Prateleira ${modalPrateleira.trim()}`);
    if (modalBandeja.trim()) partes.push(modalBandeja.trim().toUpperCase().startsWith('BANDEJA') || modalBandeja.trim().toUpperCase().startsWith('CAIXOTÃO') || modalBandeja.trim().toUpperCase().startsWith('NICHO') ? modalBandeja.trim() : `Bandeja ${modalBandeja.trim()}`);
    if (partes.length === 0 && novaLocalizacaoText.trim()) return novaLocalizacaoText.trim();
    if (partes.length === 0) return '';
    return partes.join(' - ');
  };

  const handleAddLocalizacaoEspecial = () => {
    const endereco = gerarPreviewModalEndereco();
    if (!endereco) {
      alert("Preencha pelo menos o Corredor ou a Prateleira.");
      return;
    }
    if (localizacoesEditaveis.includes(endereco)) {
      alert("Esta localização já foi adicionada!");
      return;
    }
    setLocalizacoesEditaveis([...localizacoesEditaveis, endereco].sort());
    setModalCorredor('');
    setModalPrateleira('');
    setModalBandeja('');
    setNovaLocalizacaoText('');
  };

  const [categoriasFisicasDict, setCategoriasFisicasDict] = useState(CATEGORIAS_FISICAS);
  const [catalogoVitrineDict, setCatalogoVitrineDict] = useState(CATALOGO_TEMAS);

  const categoriasFisicasUnicas = Object.keys(categoriasFisicasDict);
  const subcategoriasFisicasDisponiveis = categoria ? categoriasFisicasDict[categoria] || [] : [];
  const ocultarVitrineFisica = categoria === "Capas e Têxteis" && (subCategoria === "Capas de Painel" || subCategoria === "Capas de Cilindro" || subCategoria === "Kits de Capas (Painel + Cilindros)");
  const EVENTOS_VITRINE = [
      "Aniversário", "Casamento", "Mêsversário", "Chá de Bebê", 
      "Chá Revelação", "Chá de Panela / Casa Nova", "Noivado", 
      "15 anos", "Formatura", "Religioso", "Corporativo", 
      "Escolar", "Datas Comemorativas"
  ];
  const categoriasDeTemaUnicas = Object.keys(catalogoVitrineDict).filter(cat => {
      if (tipoCadastro === 'decoracao') {
          return EVENTOS_VITRINE.includes(cat);
      } else {
          if (ocultarVitrineFisica && (cat === "Móveis e Estruturas" || cat === "Acessórios e Decoração")) {
              return false;
          }
          return true;
      }
  });

  const subcategoriasDisponiveis = categoriaTema ? Object.keys(catalogoVitrineDict[categoriaTema] || {}) : [];
  const gruposDisponiveis = (categoriaTema && subcategoriaTema) ? Object.keys(catalogoVitrineDict[categoriaTema]?.[subcategoriaTema] || {}) : [];
  const temasDisponiveis = (categoriaTema && subcategoriaTema && grupoTemaSelecionado) ? catalogoVitrineDict[categoriaTema]?.[subcategoriaTema]?.[grupoTemaSelecionado] || [] : [];

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      const activeTenant = localStorage.getItem('tenantId') || user?.uid;
      if (!user && !activeTenant) {
        alert("Sessão expirada. Faça login novamente.");
        navigate('/login');
        return;
      }

      if (!activeTenant) return;

      const fetchItensEConfig = async () => {
        let locsEstoque = [];
        try {
          const q = query(collection(db, "estoque"), where("userId", "==", activeTenant));
          const snap = await getDocs(q);
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setItensExistentes(docs);
          locsEstoque = docs.map(d => d.localizacao).filter(Boolean);
        } catch (e) {
          console.error("Erro ao buscar itens de estoque:", e);
        }

        let locsConfig = [];
        let tamsConfig = [];

        try {
          const docRefEmpresa = doc(db, "configuracoes_empresa", activeTenant);
          const docSnapEmpresa = await getDoc(docRefEmpresa);
          if (docSnapEmpresa.exists()) {
            const dadosE = docSnapEmpresa.data();
            if (Array.isArray(dadosE.localizacoes) && dadosE.localizacoes.length > 0) {
              locsConfig = dadosE.localizacoes;
            }
            if (Array.isArray(dadosE.categoriasFisicas) && dadosE.categoriasFisicas.length > 0) {
              const mapFisico = {};
              dadosE.categoriasFisicas.forEach(cat => {
                mapFisico[cat] = dadosE.subcategoriasFisicas?.[cat] || CATEGORIAS_FISICAS[cat] || [];
              });
              setCategoriasFisicasDict(mapFisico);
            }
            if (dadosE.catalogoVitrine && Object.keys(dadosE.catalogoVitrine).length > 0) {
              setCatalogoVitrineDict(dadosE.catalogoVitrine);
            }
          }
        } catch (eEmpresa) {
          // Silenciosamente ignora qualquer restricao sem poluir o console
        }

        // 🎯 UNIFICA PRATELEIRAS SALVAS EM CONFIGURAÇÕES COM AS PRATELEIRAS JÁ EM USO NOS ITENS DO GALPÃO
        const locsUnificadas = Array.from(new Set([...locsConfig, ...locsEstoque])).filter(Boolean).sort();

        setListasSistema({
          localizacoes: locsUnificadas,
          tamanhos: tamsConfig
        });
        setLocalizacoesEditaveis(locsUnificadas);
      };

      fetchItensEConfig();
    });

    return () => unsub();
  }, []);

  useEffect(() => {
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
      setFornecedor(itemBase.fornecedor || '');
      setLinkFornecedor(itemBase.linkFornecedor || '');
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
      setStatus('ok'); 
      if (dadosCompra.formato === 'kit') setTipoCadastro('kit');
    }
  }, [itemEditando, itemDuplicando, dadosCompra, usuarioLogado, navigate, tenantId]);

  const gerarSKUAutomatico = (tipo = tipoCadastro, catTema = categoriaTema, nomeItem = nome) => {
    if (itemEditando) return; // Mantém código salvo em peças que estão sendo editadas

    let prefixo = 'PEC';
    if (tipo === 'decoracao') {
      prefixo = 'DEC';
    } else if (tipo === 'kit') {
      prefixo = 'KIT';
    } else if (catTema && catTema.trim()) {
      const palavras = catTema.trim().split(' ');
      const palavraChave = palavras[0].length >= 3 ? palavras[0] : (palavras[1] || palavras[0]);
      prefixo = palavraChave.substring(0, 3).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } else if (nomeItem && nomeItem.trim()) {
      const palavras = nomeItem.trim().split(' ');
      const palavraChave = palavras[0].length >= 3 ? palavras[0] : (palavras[1] || palavras[0]);
      prefixo = palavraChave.substring(0, 3).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    if (!prefixo || prefixo.length < 2) prefixo = 'PEC';

    let maiorNumero = 0;
    itensExistentes.forEach(item => {
      if (item.codigo && item.codigo.toUpperCase().startsWith(`${prefixo}-`)) {
        const parteNum = item.codigo.split('-')[1];
        const num = parseInt(parteNum, 10);
        if (!isNaN(num) && num > maiorNumero) {
          maiorNumero = num;
        }
      }
    });

    const proximoNumero = String(maiorNumero + 1).padStart(3, '0');
    setCodigo(`${prefixo}-${proximoNumero}`);
  };

  useEffect(() => {
    if (!itemEditando) {
      gerarSKUAutomatico();
    }
  }, [itensExistentes, tipoCadastro, categoriaTema]);

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
          gerarSKUAutomatico('decoracao');
      } else if (novoTipo === 'kit') {
          setUnidadeMedida('Kit');
          setCategoria('');
          setSubCategoria('');
          gerarSKUAutomatico('kit');
      } else {
          setUnidadeMedida('Unidade');
          setCategoria('');
          setSubCategoria('');
          gerarSKUAutomatico('avulsa');
      }
  };

  const autoPreencherVitrine = (catFis, subCatFis) => {
    let cTema = '';
    let sTema = ''; let gTema = '';

    if (catFis === "Painéis e Estruturas") {
        cTema = "Móveis e Estruturas";
        sTema = "Painéis e Fundos";
    } else if (catFis === "Móveis") {
        cTema = "Móveis e Estruturas";
        if (subCatFis === "Mesas" || subCatFis === "Aparadores" || subCatFis === "Carrinhos") sTema = "Mesas e Aparadores";
        else if (subCatFis === "Cilindros" || subCatFis === "Cubos") sTema = "Cilindros e Cubos";
    } else if (catFis === "Bandejas e Suportes") {
        cTema = "Acessórios e Decoração";
        sTema = "Bandejas e Suportes";
    } else if (catFis === "Personagens e Displays") {
        cTema = "";
    } else if (catFis === "Vasos") {
        cTema = "Acessórios e Decoração";
        sTema = "Vasos";
    } else if (catFis === "Florais e Natureza") {
        cTema = "Acessórios e Decoração";
        sTema = "Florais e Natureza";
    } else if (catFis === "Tapetes e Pisos") {
        cTema = "Acessórios e Decoração";
        sTema = "Tapetes e Pisos";
    } else if (catFis === "Capas e Têxteis") {
        if (subCatFis.includes("Toalhas") || subCatFis.includes("Cortinas")) {
            cTema = "Acessórios e Decoração";
            sTema = "Mesas e Cortinas";
        } else {
            cTema = "";
        }
    } else if (catFis === "Iluminação") {
        cTema = "Acessórios e Decoração";
        sTema = "Complementos e Iluminação"; gTema = "Iluminação";
    } else if (catFis === "Complementos de Chão") {
        cTema = "Acessórios e Decoração";
        sTema = "Complementos e Iluminação"; gTema = "Objetos Decorativos";
    } else if (catFis === "Utensílios de Festa") {
        cTema = "Acessórios e Decoração";
        sTema = "Bandejas e Suportes"; 
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
    
    gerarSKUAutomatico(tipoCadastro, nome, novaCat);
    
    let novaSub = '';
    if (categoriasFisicasDict[novaCat] && categoriasFisicasDict[novaCat].length > 0) {
        novaSub = categoriasFisicasDict[novaCat][0];
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
          setItensDoKit([...itensDoKit, { 
              id: peca.id, 
              nome: peca.nome, 
              precoOriginal: Number(peca.financeiro?.valorAluguel || peca.valorAluguel || 0), 
              foto: peca.foto || peca.fotos?.[0] || '', 
              qtd: 1 
          }]);
      }
  };

  const decrementarPecaNoKit = (pecaId) => {
      const item = itensDoKit.find(i => i.id === pecaId);
      if (!item) return;
      if (item.qtd <= 1) {
          setItensDoKit(itensDoKit.filter(i => i.id !== pecaId));
      } else {
          setItensDoKit(itensDoKit.map(i => i.id === pecaId ? {...i, qtd: i.qtd - 1} : i));
      }
  };

  const removerPecaDoKit = (pecaId) => {
      setItensDoKit(itensDoKit.filter(i => i.id !== pecaId));
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
      if (!usuarioLogado) return;
      setSalvandoLocalizacoes(true);
      try {
          const refEmpresa = doc(db, "configuracoes_empresa", tenantId);
          await setDoc(refEmpresa, { localizacoes: localizacoesEditaveis }, { merge: true });

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
      if (itemEditando && item.id === itemEditando.id) return false;
      const naoEHDecoracao = !item.especificacoes?.isDecoracao;
      const busca = buscaCatalogo.toLowerCase().trim();
      const bateNomeOuCodigo = (item.nome || '').toLowerCase().includes(busca) || 
                               (item.codigo || '').toLowerCase().includes(busca);
      const bateCategoria = (filtroCategoriaCatalogo === 'Todos' || item.categoria === filtroCategoriaCatalogo);

      return naoEHDecoracao && bateNomeOuCodigo && bateCategoria;
  });

  const salvarItem = async (e) => {
    e.preventDefault();
    if (!usuarioLogado) return alert("Erro: Você precisa estar logado para salvar peças.");

    const isDecoracao = tipoCadastro === 'decoracao';
    const isKitNovo = tipoCadastro === 'kit';

    if (!categoriaTema) return alert("❌ Selecione a Categoria da Vitrine do Site.");
    if (!subcategoriaTema) return alert("❌ Selecione a Subcategoria da Vitrine.");
    if (!grupoTemaSelecionado) return alert("❌ Selecione o Grupo na Vitrine.");
    
    if (temaSelecionado === 'OUTRO_TEMA' && !temaDigitadoPersonalizado) {
        return alert("❌ Digite o nome do filtro personalizado!");
    } else if (!temaSelecionado) {
        return alert("❌ Selecione o Tema/Filtro Específico.");
    }
    
    if (isKitNovo && pecasKitNovas.some(p => (!p.nome.trim() && !p.tamanho.trim() && !p.cor.trim()))) {
        return alert("❌ Preencha a identificação (Nome, Tamanho ou Cor) de cada peça do Kit.");
    }
    if (isKitNovo && pecasKitNovas.some(p => !p.valorAluguel.trim())) {
        return alert("❌ Todas as peças do Kit precisam ter um valor de aluguel avulso preenchido.");
    }

    if (isDecoracao && itensDoKit.length === 0) {
        return alert("❌ Um Pacote precisa ter pelo menos 1 peça dentro dele. Abra o catálogo e adicione as peças.");
    }

    setSalvando(true);
    try {
      const limparValor = (val) => Number(String(val).replace(',', '.'));
      const catFinal = isDecoracao ? 'Decoração Completa' : (categoria || 'Geral');
      const subCatFinal = isDecoracao ? 'Pacote' : (subCategoria || 'Geral');
      const temaFinalParaSalvar = temaSelecionado === 'OUTRO_TEMA' ? temaDigitadoPersonalizado : temaSelecionado;

      const nomePrincipalFormatado = (isKitNovo && !nome.toUpperCase().includes('KIT')) ? `KIT ${nome.trim()}` : nome.trim();

      const dados = {
        userId: tenantId, // 🎯 SALVA VINCULADO À EMPRESA, NÃO AO FUNCIONÁRIO
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
            itensDoKit: isDecoracao ? itensDoKit : [],
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

        if (dadosCompra && dadosCompra.id) {
             const compraRef = doc(db, "lista_compras", dadosCompra.id);
             await updateDoc(compraRef, {
                 status: 'chegou',
                 dataChegada: new Date().toISOString()
             });
        }

        if (isDecoracao) alert(`✨ ${tipoPacote} salvo! Pronto para o catálogo.`);
        else if (isKitNovo) alert("📦 Conjunto salvo e peças desmembradas com sucesso no estoque!");
        else alert(itemDuplicando ? "📋 Peça duplicada com sucesso!" : "🧩 Peça avulsa adicionada com sucesso!");
      }

      // 🔥 INÍCIO DO ESPIÃO NÍVEL 2 (MONITORIZAÇÃO DE ESTOQUE) 🔥
      try {
        let detalhesAcao = "";
        const nomeExibicao = dados.nome || 'Peça sem nome';

        if (itemEditando) {
          const mudancas = [];
          if (String(itemEditando.nome || '').trim() !== String(dados.nome || '').trim()) {
            mudancas.push(`Nome (de '${itemEditando.nome || 'Vazio'}' para '${dados.nome}')`);
          }
          if (String(itemEditando.quantidade || '0') !== String(dados.quantidade || '0')) {
            mudancas.push(`Quantidade (de '${itemEditando.quantidade || '0'}' para '${dados.quantidade || '0'}')`);
          }
          if (String(itemEditando.status || 'ok') !== String(dados.status || 'ok')) {
            mudancas.push(`Status (de '${itemEditando.status || 'ok'}' para '${dados.status}')`);
          }
          if (String(itemEditando.financeiro?.valorAluguel || '0') !== String(dados.financeiro?.valorAluguel || '0')) {
            mudancas.push(`Valor Aluguer (de '${itemEditando.financeiro?.valorAluguel || '0'}' para '${dados.financeiro?.valorAluguel}')`);
          }
          if (String(itemEditando.financeiro?.valorReposicao || '0') !== String(dados.financeiro?.valorReposicao || '0')) {
            mudancas.push(`Valor Reposição (de '${itemEditando.financeiro?.valorReposicao || '0'}' para '${dados.financeiro?.valorReposicao}')`);
          }

          if (mudancas.length > 0) {
            detalhesAcao = `Editou o item do acervo: ${nomeExibicao}. Alterações: ${mudancas.join(' | ')}`;
          } else {
            detalhesAcao = `Acedeu e guardou o item ${nomeExibicao} sem fazer alterações relevantes.`;
          }
        } else {
          const tipoNome = tipoCadastro === 'decoracao' ? 'o pacote' : tipoCadastro === 'kit' ? 'o conjunto' : 'a peça';
          detalhesAcao = `Registou ${tipoNome} no acervo: ${nomeExibicao}`;
          if (dados.quantidade > 1) detalhesAcao += ` (Qtd: ${dados.quantidade})`;
        }

        // 🎯 ESPIÃO VINCULADO À EMPRESA
        await addDoc(collection(db, "logs_atividades"), {
          empresaId: tenantId, 
          userId: tenantId,
          funcionarioId: usuarioLogado.uid,
          nomeFuncionario: localStorage.getItem('funcName') || usuarioLogado.displayName || usuarioLogado.email || "Equipe",
          acao: itemEditando ? "EDIÇÃO DE ESTOQUE" : "NOVO ITEM NO ESTOQUE",
          tipo: itemEditando ? "EDICAO" : "CRIACAO",
          detalhes: detalhesAcao,
          dataHora: new Date().toISOString()
        });
      } catch (errorEspiao) {
        console.error("Falha ao registar auditoria de estoque:", errorEspiao);
      }
      // 🔥 FIM DO ESPIÃO 🔥
      
      navigate(dadosCompra ? '/compras' : '/estoque');
    } catch (error) { 
        alert("Erro ao salvar.");
    } finally { 
        setSalvando(false); 
    }
  };

  const handleTextChange = (setter) => (e) => {
    const input = e.target.value;
    setter(input.charAt(0).toUpperCase() + input.slice(1).toLowerCase());
  };

  const focoAtual = getFocoAtual();

  return (
    <div className="clientes-container fade-in">
      
      {/* HERO CABEÇALHO IDÊNTICO AO GESTÃO DE CLIENTES */}
      <div className="clientes-hero-header">
        <div className="header-title-row">
          <div className="header-icon-badge">
            {itemEditando ? '✏️' : '✨'}
          </div>
          <div className="welcome-text">
            <h1>{itemEditando ? 'Editar Peça / Acervo' : itemDuplicando ? 'Duplicar Peça' : dadosCompra ? 'Finalizar Cadastro de Compra' : 'Cadastro de Acervo'}</h1>
            <p>{itemDuplicando ? 'Altere as especificações (como cor ou tamanho) da nova peça antes de salvar.' : 'Cadastre peças unitárias, conjuntos ou pacotes de decoração prontos.'}</p>
          </div>
        </div>
        <div className="header-actions">
          <Link to="/estoque" className="btn-secondary-celebre">
            ⬅️ VOLTAR AO ESTOQUE
          </Link>
          <button type="button" onClick={salvarItem} className="btn-primary-celebre" disabled={salvando}>
            {salvando ? '💾 SALVANDO...' : '💾 SALVAR ACERVO'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <form onSubmit={salvarItem}>
          
          {/* SEÇÃO 1: SELETOR DE MODALIDADE DE CADASTRO */}
          <div className="ce-card-container">
            <div className="ce-card-header-clean">
              <div className="ce-card-header-title">
                <span>1. O QUE VOCÊ ESTÁ CADASTRANDO?</span>
              </div>
              <span className="ce-badge-gold">
                Selecione o Tipo
              </span>
            </div>

            <div className="ce-tipo-grid">
              <div 
                onClick={() => handleTipoCadastroChange('avulsa')} 
                className={`ce-tipo-card ${tipoCadastro === 'avulsa' ? 'active' : ''}`}
              >
                <span style={{ fontSize: '28px' }}>{tipoCadastro === 'avulsa' ? '🧩' : '⬜'}</span>
                <div>
                  <strong style={{ fontSize: '15px', display: 'block' }}>PEÇA AVULSA / UNIDADE</strong>
                  <span style={{ fontSize: '12px' }}>Item único (ex: 1 Bandeja, 1 Painel)</span>
                </div>
              </div>

              <div 
                onClick={() => handleTipoCadastroChange('kit')} 
                className={`ce-tipo-card ${tipoCadastro === 'kit' ? 'active' : ''}`}
              >
                <span style={{ fontSize: '28px' }}>{tipoCadastro === 'kit' ? '📦' : '⬜'}</span>
                <div>
                  <strong style={{ fontSize: '15px', display: 'block' }}>KIT / CONJUNTO</strong>
                  <span style={{ fontSize: '12px' }}>Gera peças separadas (ex: Trio Cilindro)</span>
                </div>
              </div>

              <div 
                onClick={() => handleTipoCadastroChange('decoracao')} 
                className={`ce-tipo-card ${tipoCadastro === 'decoracao' ? 'active' : ''}`}
              >
                <span style={{ fontSize: '28px' }}>{tipoCadastro === 'decoracao' ? '✨' : '⬜'}</span>
                <div>
                  <strong style={{ fontSize: '15px', display: 'block' }}>DECORAÇÃO COMPLETA</strong>
                  <span style={{ fontSize: '12px' }}>Junta peças prontas que já existem.</span>
                </div>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            
            <div style={{ width: '100%', maxWidth: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* CARD 1: FOTOS DO PRODUTO */}
              <div className="ce-card-container">
                  <div className="ce-card-header-clean">
                    <div className="ce-card-header-title">
                      <span>📸 FOTO PRINCIPAL DO ACERVO</span>
                    </div>
                    {fotos.length > 0 && (
                      <span className="ce-badge-gold">
                        {fotos.length} foto(s)
                      </span>
                    )}
                  </div>
                  
                  {tipoCadastro === 'decoracao' && (
                    <div style={{ marginBottom: '14px', padding: '8px 12px', background: 'rgba(197, 160, 89, 0.1)', border: '1px solid #c5a059', borderRadius: '12px', fontSize: '11px', color: '#b48a3c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>✨</span> Foto Geral do Cenário Completo (Capa única do catálogo)
                    </div>
                  )}
                  
                  <div>
                    {/* Moldura da Imagem */}
                    <div style={{ width: '100%', height: '310px', backgroundColor: '#f8fafc', borderRadius: '16px', border: fotos.length > 0 ? '3px solid #c5a059' : '2px dashed #cbd5e1', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: fotos.length > 0 ? '0 10px 25px rgba(197, 160, 89, 0.2)' : 'none', transition: '0.2s' }}>
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
                        <div style={{position: 'absolute', top: '12px', right: '12px', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(6px)', color: '#ffffff', fontSize: '11px', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.2)'}}>
                            ✥ Arraste para enquadrar
                        </div>
                        </>
                    ) : (
                        <label htmlFor="upload-principal" style={{cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center'}}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ffffff', border: '3px solid #c5a059', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#c5a059', marginBottom: '14px', boxShadow: '0 8px 20px rgba(197, 160, 89, 0.25)' }}>📸</div>
                        <span style={{color: '#0f172a', fontWeight: '800', fontSize: '0.95rem', marginBottom: '4px'}}>+ Adicionar Foto</span>
                        <span style={{color: '#64748b', fontSize: '0.75rem'}}>PNG, JPG ou WebP sem fundo ou decorada</span>
                        <input id="upload-principal" type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                        </label>
                    )}
                    </div>
                    
                    {fotos.length > 0 && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', background: '#0f172a', padding: '12px 16px', borderRadius: '14px', border: '1px solid #1e293b'}}>
                            <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); setFotoPreencher(!fotoPreencher); }} 
                                style={{
                                    background: fotoPreencher ? 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)' : '#1e293b', 
                                    color: '#ffffff', 
                                    border: fotoPreencher ? 'none' : '1px solid #334155', 
                                    padding: '8px 14px', 
                                    borderRadius: '8px', 
                                    fontSize: '0.78rem', 
                                    fontWeight: '800', 
                                    cursor: 'pointer', 
                                    transition: '0.2s', 
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: fotoPreencher ? '0 2px 8px rgba(197, 160, 89, 0.3)' : 'none'
                                }}
                            >
                                <span style={{fontSize: '13px'}}>{fotoPreencher ? '🔲' : '🖼️'}</span>
                                {fotoPreencher ? 'Preenchendo' : 'Foto Inteira'}
                            </button>
                            
                            <div style={{width: '1px', height: '22px', background: '#334155', margin: '0 2px'}}></div>
                            
                            <span style={{fontSize: '14px', color: '#c5a059'}}>🔍</span>
                            <input 
                                type="range" 
                                min="1" max="3" step="0.1" 
                                value={focoAtual.z || 1} 
                                onChange={handleZoomChange} 
                                style={{flex: 1, cursor: 'pointer', accentColor: '#c5a059'}}
                            />
                        </div>
                    )}

                    {fotos.length > 0 && (
                        <div className="photo-thumbnails-row" style={{display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', marginTop: '16px'}}>
                            {fotos.map((f, idx) => {
                            const tFoco = getFocoThumb(idx);
                            return (
                            <div key={idx} style={{width: '64px', height: '64px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden', border: idx === fotoPrincipalIndex ? '3px solid #c5a059' : '1.5px solid #cbd5e1', position: 'relative', cursor: 'pointer', boxShadow: idx === fotoPrincipalIndex ? '0 4px 12px rgba(197, 160, 89, 0.4)' : 'none', background: '#ffffff'}} onClick={() => setFotoPrincipalIndex(idx)}>
                                <img src={f} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: `${tFoco.x}% ${tFoco.y}%`, transform: `scale(${tFoco.z})` }} />
                                <button type="button" onClick={(e) => {e.stopPropagation(); removerFoto(idx)}} style={{position: 'absolute', top: '2px', right: '2px', background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', width: '20px', height: '20px', borderRadius: '50%', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}} title="Remover foto">×</button>
                            </div>
                        )})}
                        <label title="Adicionar mais fotos" style={{width: '64px', height: '64px', flexShrink: 0, borderRadius: '12px', border: '2px dashed #c5a059', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '22px', color: '#b48a3c', background: '#fef3c7', transition: '0.2s'}}>
                            +
                            <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                        </label>
                        </div>
                    )}
                  </div>
              </div>

              {/* CARD: CARACTERÍSTICAS FÍSICAS (OPCIONAL) */}
              {tipoCadastro === 'avulsa' && (
                <div className="ce-card-container">
                  <div className="ce-card-header-clean">
                    <div className="ce-card-header-title">
                      <span>📏 CARACTERÍSTICAS & DIMENSÕES</span>
                    </div>
                    <span className="ce-badge-gold">
                      Opcional
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="ce-input-group">
                      <label className="ce-input-label">TAMANHO / REF.</label>
                      <input className="ce-input-field" value={tamanho} onChange={e => setTamanho(e.target.value.toUpperCase())} placeholder="Ex: P / M / G / 20CM" style={{ fontWeight: '700', textTransform: 'uppercase' }} />
                    </div>
                    <div className="ce-input-group">
                      <label className="ce-input-label">COR PREDOMINANTE</label>
                      <input className="ce-input-field" value={cor} onChange={handleTextChange(setCor)} placeholder="Ex: Rosa Gold" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div className="ce-input-group">
                      <label className="ce-input-label">LARG (cm)</label>
                      <input className="ce-input-field" type="number" value={largura} onChange={e => setLargura(e.target.value)} placeholder="0" style={{ textAlign: 'center', fontWeight: '600' }} />
                    </div>
                    <div className="ce-input-group">
                      <label className="ce-input-label">ALT (cm)</label>
                      <input className="ce-input-field" type="number" value={altura} onChange={e => setAltura(e.target.value)} placeholder="0" style={{ textAlign: 'center', fontWeight: '600' }} />
                    </div>
                    <div className="ce-input-group">
                      <label className="ce-input-label">DIÂM (cm)</label>
                      <input className="ce-input-field" type="number" value={diametro} onChange={e => setDiametro(e.target.value)} placeholder="0" style={{ textAlign: 'center', fontWeight: '600' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* CARD 2: IDENTIFICAÇÃO E DADOS BÁSICOS */}
              <div className="ce-card-container">
                <div className="ce-card-header-clean">
                  <div className="ce-card-header-title">
                    <span>📝 2. IDENTIFICAÇÃO E DADOS BÁSICOS</span>
                  </div>
                  <span className="ce-badge-gold">
                    Campos Principais *
                  </span>
                </div>

                <div className="form-grid-4" style={{ alignItems: 'flex-start' }}>
                  <div className="form-group span-3">
                    <div style={{ display: 'flex', alignItems: 'center', height: '26px', marginBottom: '6px' }}>
                      <label className="ce-input-label" style={{ margin: 0 }}>NOME DO {tipoCadastro === 'decoracao' ? 'PACOTE' : tipoCadastro === 'kit' ? 'CONJUNTO / KIT' : 'PRODUTO'} *</label>
                    </div>
                    <input className="ce-input-field" value={nome} onChange={handleTextChange(setNome)} required placeholder={tipoCadastro === 'decoracao' ? "Ex: Decoração Completa Safari" : "Ex: Trio de Cilindros..."} />
                    {nome.trim().length >= 3 && itensExistentes.some(i => i.id !== itemEditando?.id && i.nome?.trim().toLowerCase() === nome.trim().toLowerCase()) && (
                      <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '800', marginTop: '4px', display: 'block' }}>
                        💡 Atenção: Você já possui um item com o nome "{nome.trim()}" cadastrado no acervo.
                      </span>
                    )}
                  </div>
                  
                  <div className="form-group span-1">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '26px', marginBottom: '6px' }}>
                      <label className="ce-input-label" style={{ margin: 0 }}>SKU / CÓDIGO *</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          type="button" 
                          onClick={() => gerarSKUAutomatico()}
                          style={{ fontSize: '10px', color: '#ffffff', background: '#0f172a', border: '1px solid #c5a059', padding: '2px 7px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          title="Gerar código sequencial automático"
                        >
                          ⚡ Auto
                        </button>
                        <button 
                          type="button" 
                          onClick={iniciarScannerCadastro}
                          style={{ fontSize: '10px', color: '#ffffff', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', border: 'none', padding: '2px 7px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(197, 160, 89, 0.3)', whiteSpace: 'nowrap' }}
                          title="Escanear Etiqueta de Código de Barras / QR Code com a Câmera"
                        >
                          📷 Scan
                        </button>
                      </div>
                    </div>
                    <input 
                      className="ce-input-field"
                      value={codigo} 
                      onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                      placeholder="Ex: VAS-001"
                      style={{ 
                        fontWeight: '800', 
                        letterSpacing: '1px',
                        border: (codigo && itensExistentes.some(i => i.id !== itemEditando?.id && i.codigo?.toUpperCase() === codigo.trim().toUpperCase())) ? '2px solid #ef4444' : undefined 
                      }}
                    />
                    {codigo && itensExistentes.some(i => i.id !== itemEditando?.id && i.codigo?.toUpperCase() === codigo.trim().toUpperCase()) && (
                      <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '800', marginTop: '2px', display: 'block' }}>
                        ⚠️ Este código SKU já existe no acervo!
                      </span>
                    )}
                  </div>

                  <div className="form-group span-4" style={{ marginTop: '12px' }}>
                    <label className="ce-input-label">🏷️ TAGS / PALAVRAS-CHAVE DE BUSCA (SEPARADAS POR VÍRGULA)</label>
                    <input 
                      className="ce-input-field" 
                      value={tagsInput} 
                      onChange={e => setTagsInput(e.target.value)} 
                      placeholder="Ex: #rustico, #dourado, #casamento, #boho, #provencal" 
                    />
                  </div>
                </div>
              </div>

              {/* MODAL CÂMERA SCANNER NO CADASTRO DE ESTOQUE */}
              {cameraCadastroAberta && (
                <div className="modal-checkin-overlay">
                  <div className="modal-checkin-box animate-pop" style={{ maxWidth: '420px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', color: '#0f172a' }}>
                      <strong style={{ fontSize: '0.9rem' }}>📷 Escanear Código para o SKU da Peça</strong>
                      <button type="button" onClick={pararScannerCadastro} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>✕ Fechar</button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 10px 0' }}>Aproxime o Código de Barras ou QR Code da etiqueta para preencher o código da peça.</p>
                    <div id="reader-camera-cadastro" style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', background: '#000' }}></div>
                  </div>
                </div>
              )}

              {/* CARD 3: VITRINE DO CATÁLOGO & GALPÃO */}
              <div className="ce-card-container">
                <div className="ce-card-header-clean">
                  <div className="ce-card-header-title">
                    <span>🌐 3. CATEGORIZAÇÃO NA VITRINE ONLINE</span>
                  </div>
                  <span className="ce-badge-gold">
                    Filtros do Site *
                  </span>
                </div>

                {tipoCadastro !== 'decoracao' && (
                  <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1.5px solid var(--borda, #e2e8f0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <label className="ce-input-label">📦 LOCALIZAÇÃO NO GALPÃO *</label>
                      <button 
                        type="button" 
                        onClick={abrirModalLocalizacao} 
                        style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b48a3c', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        + Gerenciar Prateleiras
                      </button>
                    </div>
                    <select 
                      className="ce-input-field"
                      value={localizacao} 
                      onChange={e => setLocalizacao(e.target.value)}
                    >
                      <option value="">Selecione a Prateleira / Local...</option>
                      {listasSistema.localizacoes.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                )}

                <div className="vitrine-grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {tipoCadastro === 'decoracao' && (
                    <div className="ce-input-group" style={{ gridColumn: 'span 2' }}>
                      <label className="ce-input-label">📌 FORMATO / MODALIDADE DE EXIBIÇÃO NO SITE *</label>
                      <select 
                        className="ce-input-field"
                        value={tipoPacote}
                        onChange={e => setTipoPacote(e.target.value)}
                        style={{ fontWeight: '800', color: '#0f172a', border: '1.5px solid #c5a059', background: '#fef3c7' }}
                      >
                        <option value="PEGUE E MONTE">📦 Pegue e Monte</option>
                        <option value="DECORAÇÃO">✨ Decoração</option>
                      </select>
                    </div>
                  )}
                  <div className="ce-input-group">
                    <label className="ce-input-label">CATEGORIA NA VITRINE *</label>
                    <select 
                      className="ce-input-field"
                      value={categoriaTema} 
                      onChange={e => {
                        const novaCat = e.target.value;
                        setCategoriaTema(novaCat);
                        const subsDaCat = novaCat ? Object.keys(CATALOGO_TEMAS[novaCat] || {}) : [];
                        if (subsDaCat.length === 1) {
                          setSubcategoriaTema(subsDaCat[0]);
                          const gruposDaSub = Object.keys(CATALOGO_TEMAS[novaCat][subsDaCat[0]] || {});
                          if (gruposDaSub.length === 1) { setGrupoTemaSelecionado(gruposDaSub[0]); } else { setGrupoTemaSelecionado(''); }
                        } else { 
                          setSubcategoriaTema('');
                          setGrupoTemaSelecionado(''); 
                        }
                        setTemaSelecionado('');
                      }} 
                      required
                    >
                      <option value="" disabled hidden>Selecione...</option>
                      {categoriasDeTemaUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  
                  <div className="ce-input-group">
                    <label className="ce-input-label">SUBCATEGORIA (Público/Tipo) *</label>
                    <select 
                      className="ce-input-field"
                      value={subcategoriaTema} 
                      onChange={e => {
                        const novaSub = e.target.value;
                        setSubcategoriaTema(novaSub);
                        const gruposDaSub = (categoriaTema && novaSub) ? Object.keys(CATALOGO_TEMAS[categoriaTema][novaSub] || {}) : [];
                        if (gruposDaSub.length === 1) { setGrupoTemaSelecionado(gruposDaSub[0]); } else { setGrupoTemaSelecionado(''); }
                        setTemaSelecionado('');
                      }} 
                      disabled={!categoriaTema || subcategoriasDisponiveis.length === 1} 
                      required
                    >
                      <option value="" disabled hidden>{!categoriaTema ? 'Aguardando...' : 'Selecione...'}</option>
                      {subcategoriasDisponiveis.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </div>

                  <div className="ce-input-group">
                    <label className="ce-input-label">FILTRO DE GRUPO *</label>
                    <select 
                      className="ce-input-field"
                      value={grupoTemaSelecionado} 
                      onChange={e => {
                        setGrupoTemaSelecionado(e.target.value);
                        setTemaSelecionado('');
                      }} 
                      disabled={!subcategoriaTema || gruposDisponiveis.length === 1} 
                      required
                    >
                      <option value="" disabled hidden>{!subcategoriaTema ? 'Aguardando...' : 'Selecione...'}</option>
                      {gruposDisponiveis.map(grupo => <option key={grupo} value={grupo}>{grupo}</option>)}
                    </select>
                  </div>

                  <div className="ce-input-group">
                    <label className="ce-input-label">FILTRO ESPECÍFICO *</label>
                    <select 
                      className="ce-input-field"
                      value={temaSelecionado} 
                      onChange={e => setTemaSelecionado(e.target.value)} 
                      disabled={(!grupoTemaSelecionado && temaSelecionado !== 'OUTRO_TEMA')} 
                      required
                    >
                      <option value="" disabled hidden>{!grupoTemaSelecionado ? 'Aguardando...' : 'Selecione o item exato...'}</option>
                      {temasDisponiveis.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="OUTRO_TEMA" style={{ fontWeight: 'bold', color: '#c5a059' }}>✏️ Digitar Outro Tema...</option>
                    </select>
                  </div>
                </div>

                {temaSelecionado === 'OUTRO_TEMA' && (
                  <div className="ce-input-group" style={{ marginTop: '16px' }}>
                    <label className="ce-input-label">NOME DO TEMA PERSONALIZADO *</label>
                    <input 
                      className="ce-input-field"
                      type="text" 
                      placeholder="Ex: Safari Baby..." 
                      value={temaDigitadoPersonalizado} 
                      onChange={e => setTemaDigitadoPersonalizado(e.target.value)} 
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {tipoCadastro === 'decoracao' && (
                <div className="ce-card-container">
                  <div className="ce-card-header-clean">
                    <div className="ce-card-header-title">
                      <span>✨ MONTAGEM DA DECORAÇÃO</span>
                    </div>
                    <span className="ce-badge-gold">
                      Seleção do Acervo
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario, #64748b)', margin: '0 0 16px 0' }}>
                    Abra o acervo do galpão para selecionar peças existentes ou cadastre peças novas na hora para este pacote!
                  </p>
                  
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setModalCatalogoAberto(true)} style={{ flex: 1, minWidth: '200px', height: '46px', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', transition: '0.2s', fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      📦 ABRIR ACERVO E ADICIONAR PEÇAS
                    </button>

                    <button type="button" onClick={() => setModalNovaPecaAberto(true)} style={{ flex: 1, minWidth: '200px', height: '46px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', transition: '0.2s', fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      ➕ CADASTRA PEÇA NOVA NO ACERVO
                    </button>
                  </div>
                  
                  {itensDoKit.length > 0 ? (
                    <div style={{ background: 'var(--fundo-card, #ffffff)', borderRadius: '16px', border: '1.5px solid var(--borda, #e2e8f0)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)' }}>
                      {itensDoKit.map((item, idx) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: idx !== itensDoKit.length - 1 ? '1px solid var(--borda, #f1f5f9)' : 'none' }}>
                          <div style={{ width: '48px', height: '48px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.foto ? (
                              <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '20px' }}>📦</span>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: '0' }}>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--texto-principal, #0f172a)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.nome}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--texto-secundario, #64748b)', fontWeight: '600' }}>
                              Valor avulso base: R$ {(item.precoOriginal || 0).toFixed(2).replace('.', ',')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '10px', padding: '3px 6px', border: '1px solid #cbd5e1' }}>
                            <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? { ...i, qtd: Math.max(1, i.qtd - 1) } : i))} style={{ border: 'none', background: '#ffffff', color: '#0f172a', borderRadius: '6px', width: '26px', height: '26px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>-</button>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', width: '32px', textAlign: 'center', color: '#0f172a' }}>{item.qtd}</span>
                            <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i))} style={{ border: 'none', background: '#ffffff', color: '#0f172a', borderRadius: '6px', width: '26px', height: '26px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>+</button>
                          </div>

                          <button type="button" onClick={() => setItensDoKit(itensDoKit.filter(i => i.id !== item.id))} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: '800', fontSize: '0.75rem' }}>
                            ✕ Remover
                          </button>
                        </div>
                      ))}

                      <div style={{ background: '#f8fafc', padding: '14px 20px', textAlign: 'right', borderTop: '1.5px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700' }}>
                          ✨ Soma das Peças Avulsas:
                        </span>
                        <strong style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: '800' }}>
                          R$ {calcularTotalSomaAvulsaKit().toFixed(2).replace('.', ',')}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }}>
                      📦 Nenhuma peça foi adicionada ao pacote de decoração ainda.<br/>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Clique em "📦 ABRIR ACERVO E ADICIONAR PEÇAS" acima para compor esta decoração.</span>
                    </div>
                  )}
                </div>
              )}

              {tipoCadastro === 'kit' && (
                <div className="ce-card-container">
                  <div className="ce-card-header-clean">
                    <div className="ce-card-header-title">
                      <span>🧩 DESMEMBRAR KIT EM PEÇAS AVULSAS</span>
                    </div>
                    <span className="ce-badge-gold">
                      Opcional
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario, #64748b)', marginBottom: '20px', lineHeight: '1.4' }}>
                    💡 Adicione as peças individuais deste kit se você desejar alugá-las separadamente no sistema (ex: alugar apenas um vaso do conjunto).
                  </p>
                  
                  {pecasKitNovas.map((p, idx) => (
                    <div key={p.id} style={{background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '16px', marginBottom: '14px'}}>
                        <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center'}}>
                        <div style={{flex: 2, minWidth: '150px'}}>
                          <label style={{fontSize: '0.72rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px'}}>NOME DA PEÇA (Ex: Vaso M, Tampo)</label>
                          <input type="text" placeholder="Ex: Vaso Médio Palha" value={p.nome} onChange={e => atualizarPecaKitNova(idx, 'nome', e.target.value)} style={{width: '100%', height: '42px', padding: '0 12px', fontSize: '0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '100px'}}>
                          <label style={{fontSize: '0.72rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px'}}>TAMANHO <span style={{fontSize: '10px', color: '#94a3b8'}}>(opcional)</span></label>
                          <input type="text" placeholder="Ex: P, M, 2X2" value={p.tamanho} onChange={e => atualizarPecaKitNova(idx, 'tamanho', e.target.value.toUpperCase())} style={{width: '100%', height: '42px', padding: '0 12px', fontSize: '0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', fontWeight: '700', textTransform: 'uppercase'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '100px'}}>
                          <label style={{fontSize: '0.72rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px'}}>COR <span style={{fontSize: '10px', color: '#94a3b8'}}>(opcional)</span></label>
                          <input type="text" placeholder="Ex: Rosa" value={p.cor} onChange={e => atualizarPecaKitNova(idx, 'cor', e.target.value)} style={{width: '100%', height: '42px', padding: '0 12px', fontSize: '0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '120px'}}>
                          <label style={{fontSize: '0.72rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px'}}>VALOR AVULSO (R$) *</label>
                          <input type="text" placeholder="0,00" value={p.valorAluguel} onChange={e => atualizarPecaKitNova(idx, 'valorAluguel', e.target.value)} onBlur={e => {
                              let val = e.target.value.replace(',', '.');
                              const num = parseFloat(val);
                              if(!isNaN(num)) atualizarPecaKitNova(idx, 'valorAluguel', num.toFixed(2).replace('.', ','));
                          }} style={{width: '100%', height: '42px', padding: '0 12px', fontSize: '0.9rem', fontWeight: '800', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none'}} />
                        </div>
                        
                        <button type="button" onClick={() => setPecasKitNovas(pecasKitNovas.filter(item => item.id !== p.id))} style={{background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '10px', padding: '0 14px', cursor: 'pointer', fontWeight: '800', height: '42px', marginTop: '18px', fontSize: '0.8rem'}}>Remover</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setPecasKitNovas([...pecasKitNovas, { id: Date.now(), nome: '', valorAluguel: '', cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' }])} style={{width: '100%', height: '46px', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', transition: '0.2s', fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)'}}>+ Adicionar Peça ao Kit</button>
                </div>
              )}

              {/* CARD 4: FINANCEIRO & ESTOQUE */}
              <div className="ce-card-container">
                <div className="ce-card-header-clean">
                  <div className="ce-card-header-title">
                    <span>💰 4. FINANCEIRO & QUANTIDADE EM ESTOQUE</span>
                  </div>
                  <span className="ce-badge-gold">
                    Valores em R$
                  </span>
                </div>
                
                {/* Grid Valores */}
                <div className="financeiro-grid-responsive" style={{ display: 'grid', gridTemplateColumns: tipoCadastro === 'decoracao' ? '1fr' : '2fr 1fr 1fr', gap: '16px', marginBottom: tipoCadastro === 'decoracao' ? '12px' : '20px' }}>
                  <div style={{ background: 'var(--fundo-cinza, #fffdfa)', border: '2px solid #c5a059', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.15)' }}>
                    <label className="ce-input-label" style={{ color: 'var(--texto-principal)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span>{tipoCadastro === 'decoracao' ? 'VALOR DO ALUGUEL DESTE PACOTE (R$) *' : 'PREÇO DO ALUGUEL (R$) *'}</span>
                      <span style={{ fontSize: '11px', color: '#b48a3c', background: '#fef3c7', padding: '3px 10px', borderRadius: '12px', fontWeight: '800' }}>
                        {tipoCadastro === 'decoracao' ? '✨ Decoração' : '⭐ Principal'}
                      </span>
                    </label>
                    <input 
                      type="text" 
                      value={valorAluguel} 
                      onChange={e => setValorAluguel(e.target.value)} 
                      onBlur={formatarMoedaBlur(setValorAluguel)} 
                      required 
                      className="ce-input-field"
                      style={{ height: '48px', border: '1.5px solid #c5a059', fontSize: '1.25rem', fontWeight: '800' }} 
                      placeholder="0,00"
                    />
                  </div>

                  {tipoCadastro !== 'decoracao' && (
                    <>
                      <div className="ce-input-group">
                        <label className="ce-input-label">VALOR COMPRA (R$)</label>
                        <input className="ce-input-field" type="text" value={valorCompra} onChange={e => setValorCompra(e.target.value)} onBlur={formatarMoedaBlur(setValorCompra)} placeholder="0,00" style={{ fontWeight: '700' }} />
                      </div>
                      <div className="ce-input-group">
                        <label className="ce-input-label">REPOSIÇÃO (R$)</label>
                        <input className="ce-input-field" type="text" value={valorReposicao} onChange={e => setValorReposicao(e.target.value)} onBlur={formatarMoedaBlur(setValorReposicao)} placeholder="0,00" style={{ fontWeight: '700' }} />
                      </div>
                    </>
                  )}
                </div>

                {/* 📊 CALCULADORA DE PAYBACK / RETORNO DE INVESTIMENTO & SUGESTÃO INTELIGENTE */}
                {(() => {
                  const vCompra = Number(String(valorCompra || '0').replace(/\./g, '').replace(',', '.'));
                  const vAluguel = Number(String(valorAluguel || '0').replace(/\./g, '').replace(',', '.'));
                  if (vCompra > 0 && vAluguel > 0) {
                    const qtdAlugueisPayback = Math.ceil(vCompra / vAluguel);
                    const margemPorAluguel = ((vAluguel / vCompra) * 100).toFixed(1);
                    return (
                      <div style={{ marginBottom: '20px', background: 'rgba(197, 160, 89, 0.08)', border: '1.5px solid #c5a059', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>📊</span>
                          <div>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--texto-principal, #0f172a)', display: 'block' }}>Retorno do Investimento (Payback)</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--texto-secundario, #64748b)' }}>
                              A peça se paga com <strong>{qtdAlugueisPayback} locação(ões)</strong> (Taxa de retorno: {margemPorAluguel}% do valor de compra por aluguel).
                            </span>
                          </div>
                        </div>
                        <span style={{ background: '#c5a059', color: '#ffffff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800' }}>
                          📈 Lucro líquido a partir do {qtdAlugueisPayback}º aluguel
                        </span>
                      </div>
                    );
                  } else if (vCompra > 0 && (!vAluguel || vAluguel === 0)) {
                    const sugestao25 = (vCompra * 0.25).toFixed(2).replace('.', ',');
                    const sugestao30 = (vCompra * 0.30).toFixed(2).replace('.', ',');
                    return (
                      <div style={{ marginBottom: '20px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#b48a3c', fontWeight: '700' }}>
                          💡 Sugestão de Aluguel no mercado (25% a 30% do valor de compra): R$ {sugestao25} a R$ {sugestao30}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setValorAluguel(sugestao25)}
                          style={{ background: '#b48a3c', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                        >
                          Usar R$ {sugestao25}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Banner Comparativo Decoração */}
                {tipoCadastro === 'decoracao' && (
                  <div style={{ background: 'var(--fundo-cinza, #f8fafc)', border: '1.5px solid var(--borda, #cbd5e1)', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--texto-secundario, #64748b)', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>
                        Soma das peças selecionadas no acervo:
                      </span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--texto-principal, #0f172a)', fontWeight: '800' }}>
                        R$ {calcularTotalSomaAvulsaKit().toFixed(2).replace('.', ',')}
                      </strong>
                    </div>
                    <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b48a3c', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800' }}>
                      💡 Pacote de Decoração
                    </div>
                  </div>
                )}

                {/* Grid Quantidade & Estoque Mínimo */}
                {tipoCadastro !== 'decoracao' && (
                  <div className="estoque-grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="ce-input-group">
                      <label className="ce-input-label">QUANTIDADE DISPONÍVEL</label>
                      {tipoCadastro === 'kit' ? (
                        <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fundo-cinza, #f8fafc)', borderRadius: '12px', fontSize: '0.85rem', color: '#b48a3c', fontWeight: '800', border: '1.5px solid var(--borda, #e2e8f0)' }}>
                          ⚡ Calculada das Peças
                        </div>
                      ) : (
                        <input className="ce-input-field" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} min="1" style={{ fontWeight: '800', textAlign: 'center' }}/>
                      )}
                    </div>
                    <div className="ce-input-group">
                      <label className="ce-input-label">ESTOQUE MÍNIMO DE SEGURANÇA</label>
                      <input className="ce-input-field" type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} disabled={alertaEstoque === 'NaoAvisar'} style={{ fontWeight: '700', textAlign: 'center' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* BARRA FIXA DE AÇÃO: CANCELAR E SALVAR */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1.5px solid var(--borda, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                <Link to={dadosCompra ? "/compras" : "/estoque"} className="btn-secondary-celebre" style={{ height: '44px', textDecoration: 'none' }}>
                  CANCELAR
                </Link>
                <button type="submit" disabled={salvando} className="btn-primary-celebre" style={{ height: '44px', padding: '0 32px' }}>
                  {salvando ? '💾 SALVANDO...' : (tipoCadastro === 'decoracao' ? `💾 SALVAR ${tipoPacote}` : tipoCadastro === 'kit' ? '💾 SALVAR CONJUNTO' : '💾 SALVAR ACERVO')}
                </button>
              </div>

            </div>
          </div>
        </form>
      </div>

      {modalCatalogoAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="catalogo-modal-container" style={{ maxWidth: '1100px', width: '92%', height: '86vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', border: '1px solid rgba(197, 160, 89, 0.3)' }}>
            
            {/* LUXURY HEADER ISOLATED */}
            <div style={{ padding: '18px 28px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '2px solid #c5a059', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '26px' }}>📦</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: '800', lineHeight: '1.2' }}>
                    Acervo Físico
                  </h3>
                  <span style={{ color: '#c5a059', fontSize: '0.82rem', fontWeight: '600', display: 'block', marginTop: '2px' }}>
                    Escolha as peças que compõem este pacote de decoração
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {itensDoKit.length > 0 && (
                  <div style={{ background: 'rgba(197, 160, 89, 0.2)', border: '1px solid #c5a059', padding: '6px 14px', borderRadius: '20px', color: '#fef08a', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🛒</span> {itensDoKit.reduce((acc, i) => acc + i.qtd, 0)} item(ns) selecionado(s)
                  </div>
                )}
                <button 
                  type="button" 
                  onClick={() => setModalNovaPecaAberto(true)} 
                  style={{ background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(197, 160, 89, 0.35)', transition: 'all 0.2s' }}
                >
                  ➕ Cadastrar Nova Peça
                </button>
                <button 
                  type="button" 
                  onClick={() => setModalCatalogoAberto(false)} 
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* SEARCH & FILTERS BAR */}
            <div style={{ padding: '16px 28px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '480px' }}>
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', pointerEvents: 'none', zIndex: 5 }}>🔍</span>
                  <input 
                    type="text" 
                    style={{ border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', paddingLeft: '46px', paddingRight: buscaCatalogo ? '36px' : '16px', paddingTop: '10px', paddingBottom: '10px', borderRadius: '12px', width: '100%', fontSize: '0.88rem', fontWeight: '600', outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', boxSizing: 'border-box' }} 
                    placeholder="Buscar por nome, categoria ou código..." 
                    value={buscaCatalogo} 
                    onChange={e => setBuscaCatalogo(e.target.value)} 
                  />
                  {buscaCatalogo && (
                    <button 
                      type="button" 
                      onClick={() => setBuscaCatalogo('')} 
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', zIndex: 6 }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: '700' }}>
                  Exibindo <strong style={{ color: '#0f172a' }}>{itensCatalogoFiltrados.length}</strong> {itensCatalogoFiltrados.length === 1 ? 'peça' : 'peças'}
                </div>
              </div>

              {/* CATEGORY CHIPS */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {categoriasCatalogoUnicas.map(cat => {
                  const isActive = filtroCategoriaCatalogo === cat;
                  return (
                    <button 
                      key={cat} 
                      type="button" 
                      onClick={() => setFiltroCategoriaCatalogo(cat)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease',
                        border: isActive ? '1px solid #c5a059' : '1.5px solid #cbd5e1',
                        background: isActive ? 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)' : '#ffffff',
                        color: isActive ? '#ffffff' : '#475569',
                        boxShadow: isActive ? '0 4px 10px rgba(197, 160, 89, 0.25)' : 'none'
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CATALOG GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px', overflowY: 'auto', padding: '20px 28px', background: '#f1f5f9', flexGrow: 1, alignContent: 'start' }}>
              {itensCatalogoFiltrados.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '50px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1.5px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '44px' }}>📦</span>
                  <h4 style={{ margin: 0, color: '#0f172a', fontWeight: '800', fontSize: '1.05rem' }}>Nenhuma peça encontrada</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', maxWidth: '380px' }}>Tente alterar a busca ou o filtro de categoria selecionado.</p>
                  <button type="button" onClick={() => setModalNovaPecaAberto(true)} style={{ marginTop: '6px', background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}>
                    + Cadastrar Nova Peça
                  </button>
                </div>
              ) : (
                itensCatalogoFiltrados.map(item => {
                  const qtdFisicaTotal = parseInt(item.quantidade || 0) || parseInt(item.estoque || 0) || 1;
                  const pecaNoKit = itensDoKit.find(i => i.id === item.id);
                  const qtdNoKit = pecaNoKit ? pecaNoKit.qtd : 0;
                  const foiAdicionado = qtdNoKit > 0;
                  const excedeEstoque = foiAdicionado && qtdNoKit > qtdFisicaTotal;
                  const faltamPecas = qtdNoKit - qtdFisicaTotal;
                  const valorAluguelItem = Number(item.financeiro?.valorAluguel || item.valorAluguel || item.precoOriginal || 0);

                  return (
                    <div 
                      key={item.id} 
                      style={{ 
                        background: '#ffffff', 
                        border: foiAdicionado ? (excedeEstoque ? '2.5px solid #f59e0b' : '2.5px solid #c5a059') : '1.5px solid #e2e8f0', 
                        borderRadius: '16px', 
                        overflow: 'hidden', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        boxShadow: foiAdicionado ? '0 8px 20px -4px rgba(197, 160, 89, 0.25)' : '0 4px 6px -1px rgba(0, 0, 0, 0.04)', 
                        transition: 'all 0.2s ease', 
                        position: 'relative' 
                      }} 
                    >
                      {/* INCLUDED RIBBON BADGE */}
                      {foiAdicionado && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: excedeEstoque ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{excedeEstoque ? '⚠️' : '✓'}</span> Incluso: {qtdNoKit}x
                        </div>
                      )}

                      {/* IMAGE CONTAINER */}
                      <div 
                        onClick={() => adicionarPecaAoKit(item)}
                        style={{ height: '145px', width: '100%', flexShrink: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                      >
                        {item.foto ? (
                          <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                            <span style={{ fontSize: '36px' }}>📷</span>
                            <span style={{ fontSize: '10px', fontWeight: '700' }}>Sem Foto</span>
                          </div>
                        )}
                        
                        {/* CATEGORY BADGE ON IMAGE */}
                        <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 2, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff', fontSize: '9px', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                          {item.categoria || 'Geral'}
                        </div>
                      </div>
                      
                      {/* CARD CONTENT */}
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: '#0f172a', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: '800', margin: 0 }}>
                            {item.nome}
                          </strong>
                          {item.codigo && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block', marginTop: '2px' }}>
                              CÓD: {item.codigo}
                            </span>
                          )}
                        </div>
                        
                        {/* BOTTOM ROW: PRICE AND ACTION */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.88rem', color: '#c5a059', fontWeight: '800' }}>
                            {valorAluguelItem > 0 ? `R$ ${valorAluguelItem.toFixed(2).replace('.', ',')}` : 'Sob consulta'}
                          </div>

                          {/* ACTION CONTROLS - PERMITE COMPOR PACOTE LIVREMENTE */}
                          {!foiAdicionado ? (
                            <button 
                              type="button" 
                              onClick={() => adicionarPecaAoKit(item)} 
                              style={{ 
                                background: '#0f172a', 
                                color: '#ffffff', 
                                border: 'none', 
                                padding: '8px 16px', 
                                borderRadius: '10px', 
                                fontWeight: '800', 
                                fontSize: '0.8rem', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                                transition: 'all 0.2s'
                              }}
                            >
                              <span>+</span> Incluir
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1.5px solid #c5a059', borderRadius: '10px', padding: '2px 4px' }}>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); decrementarPecaNoKit(item.id); }} 
                                style={{ width: '28px', height: '28px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                -
                              </button>
                              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a', minWidth: '20px', textAlign: 'center' }}>
                                {qtdNoKit}
                              </span>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); adicionarPecaAoKit(item); }} 
                                style={{ 
                                  width: '28px', 
                                  height: '28px', 
                                  background: '#0f172a', 
                                  color: '#ffffff', 
                                  border: 'none', 
                                  borderRadius: '6px', 
                                  fontWeight: 'bold', 
                                  fontSize: '14px', 
                                  cursor: 'pointer', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center'
                                }}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>

                        {/* WARNING BADGE IF INCLUDED QUANTITY EXCEEDS INVENTORY STOCK */}
                        {excedeEstoque && (
                          <div style={{ marginTop: '2px', background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '6px 10px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                            <span>⚠️ Acervo atual: {qtdFisicaTotal} un</span>
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem' }}>Falta comprar +{faltamPecas}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* STICKY FOOTER SUMMARY */}
            <div style={{ padding: '16px 28px', background: '#ffffff', borderTop: '2px solid #e2e8f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', display: 'block' }}>
                  PEÇAS SELECIONADAS:
                </span>
                <strong style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '800' }}>
                  {itensDoKit.length} {itensDoKit.length === 1 ? 'modelo selecionado' : 'modelos selecionados'} ({itensDoKit.reduce((acc, i) => acc + i.qtd, 0)} itens no total)
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', display: 'block' }}>Soma das peças avulsas:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#c5a059', fontWeight: '800' }}>
                    R$ {calcularTotalSomaAvulsaKit().toFixed(2).replace('.', ',')}
                  </strong>
                </div>

                <button 
                  type="button" 
                  onClick={() => setModalCatalogoAberto(false)} 
                  style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', border: '1px solid #c5a059', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)', transition: 'all 0.2s' }}
                >
                  ✓ Concluir Seleção
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 🔥 MODAL DE CADASTRO RÁPIDO DE NOVA PEÇA NO ACERVO 🔥 */}
      {modalNovaPecaAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 999999, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-box-premium" style={{ maxWidth: '520px', width: '92%', padding: '28px', borderRadius: '20px', backgroundColor: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✨</span> Cadastrar Nova Peça no Acervo
              </h3>
              <button type="button" className="btn-fechar" onClick={() => setModalNovaPecaAberto(false)}>X</button>
            </div>

            <form onSubmit={salvarNovaPecaRapidaNoAcervo}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>NOME DA NOVA PEÇA *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Vaso Murano Dourado, Painel Rústico" 
                  value={novaPecaNome} 
                  onChange={e => setNovaPecaNome(e.target.value)} 
                  style={{ width: '100%', height: '46px', padding: '0 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>CATEGORIA *</label>
                  <select 
                    value={novaPecaCategoria} 
                    onChange={e => setNovaPecaCategoria(e.target.value)} 
                    style={{ width: '100%', height: '46px', padding: '0 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                  >
                    <option value="Vasos">Vasos</option>
                    <option value="Utensílios de Festa">Utensílios de Festa</option>
                    <option value="Móveis">Móveis</option>
                    <option value="Painéis">Painéis</option>
                    <option value="Tapetes e Pisos">Tapetes e Pisos</option>
                    <option value="Iluminação">Iluminação</option>
                    <option value="Capas e Têxteis">Capas e Têxteis</option>
                    <option value="Geral">Geral / Outros</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>VALOR ALUGUEL (R$) *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="0,00" 
                    value={novaPecaPreco} 
                    onChange={e => setNovaPecaPreco(e.target.value)} 
                    onBlur={formatarMoedaBlur(setNovaPecaPreco)}
                    style={{ width: '100%', height: '46px', padding: '0 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>QUANTIDADE EM ESTOQUE *</label>
                <input 
                  type="number" 
                  min="1" 
                  required 
                  value={novaPecaQtd} 
                  onChange={e => setNovaPecaQtd(e.target.value)} 
                  style={{ width: '100%', height: '46px', padding: '0 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700', outline: 'none', textAlign: 'center' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalNovaPecaAberto(false)} style={{ height: '44px', padding: '0 20px', borderRadius: '10px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontWeight: '700', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoNovaPecaRapida} style={{ height: '44px', padding: '0 26px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)' }}>
                  {salvandoNovaPecaRapida ? 'Salvando...' : '💾 Cadastrar e Incluir no Pacote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔥 MODAL EXECUTIVE PARA GERENCIAR PRATELEIRAS & ENDEREÇAMENTO FÍSICO 🔥 */}
      {modalLocalizacaoAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 100000, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-box-premium" style={{ maxWidth: '540px', width: '92%', padding: '30px', borderRadius: '24px', backgroundColor: '#ffffff', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)', border: '1px solid #e2e8f0' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#b48a3c' }}>
                  📍
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.05rem', fontWeight: '800' }}>Gerenciar Prateleiras do Galpão</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cadastre corredores, prateleiras e caixotões</span>
                </div>
              </div>
              <button 
                onClick={() => setModalLocalizacaoAberto(false)} 
                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>
            
            {/* CONSTRUTOR RÁPIDO DE ENDEREÇO */}
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>
                + CADASTRAR NOVO ENDEREÇO
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '3px' }}>CORREDOR</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Corredor A" 
                    value={modalCorredor} 
                    onChange={e => setModalCorredor(e.target.value)}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.82rem', outline: 'none', background: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '3px' }}>PRATELEIRA</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Prateleira 1" 
                    value={modalPrateleira} 
                    onChange={e => setModalPrateleira(e.target.value)}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.82rem', outline: 'none', background: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '3px' }}>BANDEJA</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Bandeja 3" 
                    value={modalBandeja} 
                    onChange={e => setModalBandeja(e.target.value)}
                    style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.82rem', outline: 'none', background: '#fff' }}
                  />
                </div>
              </div>

              {gerarPreviewModalEndereco() && (
                <div style={{ fontSize: '0.78rem', color: '#b48a3c', background: '#fef3c7', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fde68a', fontWeight: '700', marginBottom: '10px' }}>
                  Prévia: {gerarPreviewModalEndereco()}
                </div>
              )}

              <button 
                type="button" 
                onClick={handleAddLocalizacaoEspecial}
                style={{ width: '100%', height: '38px', borderRadius: '20px', fontWeight: '800', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                + Adicionar esta Prateleira
              </button>
            </div>

            {/* LISTA DE LOCALIZAÇÕES CADASTRADAS */}
            <div style={{ marginBottom: '8px', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
              PRATELEIRAS SALVAS NO SISTEMA:
            </div>

            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', padding: '6px' }}>
                {localizacoesEditaveis.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Nenhuma localização cadastrada ainda.</div>
                ) : (
                    localizacoesEditaveis.map((loc, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', marginBottom: '4px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>📍 {loc}</span>
                            <button 
                                type="button" 
                                onClick={() => handleRemoveLocalizacao(loc)}
                                style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}
                                title="Remover"
                            >
                              ×
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <button 
                type="button" 
                onClick={() => setModalLocalizacaoAberto(false)} 
                style={{ padding: '10px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                  Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSaveLocalizacoes} 
                disabled={salvandoLocalizacoes} 
                style={{ padding: '10px 24px', borderRadius: '30px', background: 'linear-gradient(135deg, #c5a059 0%, #a4803c 100%)', color: '#ffffff', border: 'none', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.35)', textTransform: 'uppercase' }}
              >
                  {salvandoLocalizacoes ? 'Salvando...' : '💾 Salvar no Sistema'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CadastroEstoque;