import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroEstoque.css';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query, setDoc, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

import { CATALOGO_TEMAS, CATEGORIAS_FISICAS } from '../../catalogoDeTemas';

const OPCOES_TAMANHO_PREDEFINIDAS = [
  'Único',
  'P (Pequeno)',
  'M (Médio)',
  'G (Grande)',
  'GG (Extra Grande)',
  '10 cm',
  '15 cm',
  '20 cm',
  '25 cm',
  '30 cm',
  '35 cm',
  '40 cm',
  '50 cm',
  '60 cm',
  '80 cm',
  '1 Metro',
  '1.5 Metros',
  '2 Metros'
];

const OPCOES_COR_PREDEFINIDAS = [
  'Dourado / Ouro',
  'Rosa Gold',
  'Prata / Inox',
  'Branco',
  'Preto',
  'Rústico / Madeira',
  'Transparente / Acrílico',
  'Azul Bebê',
  'Azul Marinho',
  'Azul Royal',
  'Rosa Bebê',
  'Rosa Chiclete',
  'Rosê / Rose',
  'Vermelho',
  'Verde Menta',
  'Verde Botânico',
  'Verde Oliva',
  'Amarelo',
  'Laranja / Terracota',
  'Lilás / Lavanda',
  'Roxo / Violeta',
  'Palha / Nude / Bege',
  'Marrom / Café',
  'Colorido / Multicolor'
];

const OPCOES_MEDIDAS_CM = Array.from({ length: 251 }, (_, i) => i);

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
  const [tooltipTipoAberto, setTooltipTipoAberto] = useState(null);

  // ☁️ Fechar tooltip de tipo ao clicar fora em qualquer ponto da tela
  useEffect(() => {
    const handleFecharTooltip = () => setTooltipTipoAberto(null);
    if (tooltipTipoAberto) {
      window.addEventListener('click', handleFecharTooltip);
      return () => window.removeEventListener('click', handleFecharTooltip);
    }
  }, [tooltipTipoAberto]);
  
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
  const [modoTamanhoCustom, setModoTamanhoCustom] = useState(false);
  const [modoCorCustom, setModoCorCustom] = useState(false);
  const [unidadeMedida, setUnidadeMedida] = useState('Unidade');
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [diametro, setDiametro] = useState('');
  const [comprimento, setComprimento] = useState('');
  
  const [modoLarguraCustom, setModoLarguraCustom] = useState(false);
  const [modoAlturaCustom, setModoAlturaCustom] = useState(false);
  const [modoDiametroCustom, setModoDiametroCustom] = useState(false);
  
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
    if (e.cancelable && !e.touches) {
      e.preventDefault(); 
    }
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartMouse({ x: clientX, y: clientY });
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    if (e.cancelable && !e.touches) {
      e.preventDefault();
    }
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
    <div className="form-page-container fade-in">
      
      {/* HERO ENTERPRISE PADRONIZADO (IGUAL AO NOVO CLIENTE) */}
      <header className="cadastro-hero-header">
        <div className="cadastro-hero-left">
          <div className="breadcrumb-nav">
            <Link to="/estoque"><i className="fas fa-boxes-stacked"></i> Estoque</Link>
            <span className="separator">/</span>
            <span className="current-page">{itemEditando ? 'Editar Peça' : itemDuplicando ? 'Duplicar Peça' : dadosCompra ? 'Finalizar Compra' : 'Novo Item'}</span>
          </div>

          <div className="hero-title-group">
            <span className="header-icon-badge">
              <i className={itemEditando ? "fas fa-pen-to-square" : itemDuplicando ? "fas fa-clone" : "fas fa-boxes-stacked"}></i>
            </span>
            <div className="header-text">
              <h1 className="form-page-title">{itemEditando ? 'EDITAR PEÇA / ACERVO' : itemDuplicando ? 'DUPLICAR PEÇA' : dadosCompra ? 'FINALIZAR CADASTRO DE COMPRA' : 'CADASTRO DE ACERVO'}</h1>
              <p className="form-page-subtitle">
                {itemDuplicando ? 'Altere as especificações (como cor ou tamanho) da nova peça antes de salvar.' : 'Cadastre peças unitárias, conjuntos ou pacotes de decoração prontos.'}
              </p>
            </div>
          </div>
        </div>

        <div className="cadastro-hero-right-actions">
          <button type="button" onClick={() => navigate(dadosCompra ? "/compras" : "/estoque")} className="btn-secondary-celebre">
            <i className="fas fa-arrow-left"></i> Voltar à Lista
          </button>
        </div>
      </header>

      <div className="form-widescreen">
        <form id="estoque-form-main" onSubmit={salvarItem} className="estoque-form-layout" autoComplete="on">
          
          {/* COLUNA ESQUERDA: CARD LATERAL DE FOTOS E PREVIEW DO PRODUTO (PADRÃO EXECUTIVE SIDEBAR) */}
          <div className="left-photo-col">
            <div className="profile-card-banner"></div>
            
            <div className="profile-card-body">
              {/* MOLDURA DA FOTO DO PRODUTO */}
              <div className="item-photo-frame-wrapper">
                {fotos.length > 0 ? (
                  <div className="item-photo-preview-box">
                    <img 
                      src={fotos[fotoPrincipalIndex]} 
                      draggable={false} 
                      className="item-photo-img"
                      alt="Foto da peça"
                      style={{ 
                        objectFit: fotoPreencher ? 'cover' : 'contain', 
                        objectPosition: `${focoAtual.x}% ${focoAtual.y}%`, 
                        transform: `scale(${focoAtual.z || 1})`,
                        cursor: dragging ? 'grabbing' : 'grab',
                        transition: dragging ? 'none' : 'transform 0.2s ease-out',
                        transformOrigin: 'center center',
                        touchAction: 'none'
                      }} 
                      onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}
                      onMouseMove={handlePointerMove} onTouchMove={handlePointerMove}
                      onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchEnd={handlePointerUp}
                    />
                    <div className="drag-hint-overlay">
                      <span><i className="fas fa-arrows-alt"></i> Arraste</span>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="upload-principal" className="item-photo-empty-label" title="Clique para adicionar foto">
                    <i className="fas fa-camera avatar-camera-icon"></i>
                    <span>+ Adicionar Fotos</span>
                    <small style={{ fontSize: '0.64rem', color: '#94a3b8' }}>PNG, JPG ou WebP</small>
                    <input id="upload-principal" type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                  </label>
                )}
              </div>

              {/* AÇÕES E CONTROLES DA FOTO */}
              {fotos.length > 0 && (
                <>
                  <div className="avatar-actions-row" style={{ marginTop: '8px' }}>
                    <label htmlFor="upload-principal" className="btn-avatar-mini" title="Adicionar mais fotos">
                      <i className="fas fa-plus"></i> Adicionar
                    </label>
                    <button 
                      type="button" 
                      onClick={(e) => { e.preventDefault(); setFotoPreencher(!fotoPreencher); }} 
                      className="btn-avatar-mini"
                      title="Alternar entre foto inteira ou preenchida"
                    >
                      <i className={fotoPreencher ? "fas fa-expand" : "fas fa-compress"}></i> {fotoPreencher ? 'Preenchendo' : 'Inteira'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => removerFoto(fotoPrincipalIndex)} 
                      className="btn-avatar-mini remove" 
                      title="Remover foto atual"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                    <input id="upload-principal" type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                  </div>

                  {/* ZOOM SLIDER COMPACTO */}
                  <div className="photo-zoom-bar-slim">
                    <i className="fas fa-magnifying-glass" style={{ fontSize: '11px', color: '#c5a059' }}></i>
                    <input 
                      type="range" 
                      min="1" max="3" step="0.1" 
                      value={focoAtual.z || 1} 
                      onChange={handleZoomChange} 
                      className="photo-zoom-slider"
                    />
                  </div>

                  {/* THUMBNAILS DAS FOTOS */}
                  <div className="photo-thumbnails-strip">
                    {fotos.map((f, idx) => {
                      const tFoco = getFocoThumb(idx);
                      return (
                        <div 
                          key={idx} 
                          className={`photo-thumb-item ${idx === fotoPrincipalIndex ? 'active' : ''}`} 
                          onClick={() => setFotoPrincipalIndex(idx)}
                        >
                          <img src={f} alt={`Foto ${idx+1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: `${tFoco.x}% ${tFoco.y}%`, transform: `scale(${tFoco.z})` }} />
                          <button type="button" onClick={(e) => {e.stopPropagation(); removerFoto(idx)}} className="btn-thumb-remove" title="Remover">×</button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* IDENTIDADE E RESUMO DO PRODUTO (IGUAL CLIENTE) */}
              <div className="profile-identity-box" style={{ marginTop: fotos.length > 0 ? '6px' : '10px' }}>
                <h3 className="profile-client-name">
                  {nome || (tipoCadastro === 'decoracao' ? 'Nova Decoração' : tipoCadastro === 'kit' ? 'Novo Conjunto' : 'Nova Peça')}
                </h3>
                
                <div className="profile-document-pill">
                  <i className="fas fa-barcode"></i> 
                  <span>{codigo || 'SKU Auto'}</span>
                </div>

                {categoriaTema && (
                  <div className="profile-tag-pill" style={{ backgroundColor: 'rgba(197, 160, 89, 0.15)', color: '#9e7a3b', border: '1px solid rgba(197, 160, 89, 0.3)' }}>
                    <span>🏷️ {categoriaTema} {subcategoriaTema ? `• ${subcategoriaTema}` : ''}</span>
                  </div>
                )}
              </div>

              {/* STATUS MINI CARDS */}
              <div className="profile-status-cards">
                <div className="status-mini-card aprovado">
                  <span className="status-label">ESTOQUE</span>
                  <strong className="status-val">
                    {tipoCadastro === 'kit' ? '⚡ Kit' : `${quantidade || 1} un`}
                  </strong>
                </div>

                <div className="status-mini-card adimplente">
                  <span className="status-label">ALUGUEL</span>
                  <strong className="status-val">
                    {valorAluguel ? `R$ ${valorAluguel}` : 'R$ 0,00'}
                  </strong>
                </div>
              </div>

              {/* DATA DE CADASTRO FOOTER */}
              <div className="profile-since-footer">
                <i className="far fa-calendar-alt"></i> Cadastrado em: {itemEditando?.criadoEm ? new Date(itemEditando.criadoEm).toLocaleDateString('pt-BR') : 'Hoje'}
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA: FORMULÁRIO WIDESCREEN ALINHADO COM CARDS PADRONIZADOS */}
          <div className="right-data-col">
            
            {/* SELETOR DE MODALIDADE DE CADASTRO (CARDS INTERATIVOS LUXURY) */}
            <div className="modalidade-cadastro-section">
              <div className="label-modalidade-header">
                <label className="label-modalidade-servico">
                  <i className="fas fa-layer-group" style={{ color: '#c5a059' }}></i> Modalidade de Cadastro <span className="label-obrigatorio">*</span>
                </label>
              </div>
              
              <div className="toggle-servico-vip estoque-modalidade-grid">
                {/* 1. PEÇA AVULSA */}
                <button 
                  type="button" 
                  className={`btn-servico-card ${tipoCadastro === 'avulsa' ? 'active' : ''}`} 
                  onClick={() => handleTipoCadastroChange('avulsa')}
                >
                  <div className="servico-icon-box">
                    <i className="fas fa-box-open"></i>
                  </div>
                  <div className="servico-info">
                    <strong>Peça Avulsa</strong>
                    <small>Item unitário individual no acervo</small>
                  </div>
                  <div className="servico-check-badge">
                    {tipoCadastro === 'avulsa' && <span className="check-mark">✓</span>}
                  </div>
                </button>

                {/* 2. KIT / CONJUNTO */}
                <button 
                  type="button" 
                  className={`btn-servico-card ${tipoCadastro === 'kit' ? 'active' : ''}`} 
                  onClick={() => handleTipoCadastroChange('kit')}
                >
                  <div className="servico-icon-box">
                    <i className="fas fa-cubes"></i>
                  </div>
                  <div className="servico-info">
                    <strong>Kit / Conjunto</strong>
                    <small>Conjunto com peças desmembráveis</small>
                  </div>
                  <div className="servico-check-badge">
                    {tipoCadastro === 'kit' && <span className="check-mark">✓</span>}
                  </div>
                </button>

                {/* 3. DECORAÇÃO COMPLETA */}
                <button 
                  type="button" 
                  className={`btn-servico-card ${tipoCadastro === 'decoracao' ? 'active' : ''}`} 
                  onClick={() => handleTipoCadastroChange('decoracao')}
                >
                  <div className="servico-icon-box">
                    <i className="fas fa-truck-fast"></i>
                  </div>
                  <div className="servico-info">
                    <strong>Decoração Completa</strong>
                    <small>Pacote pronto montado com acervo</small>
                  </div>
                  <div className="servico-check-badge">
                    {tipoCadastro === 'decoracao' && <span className="check-mark">✓</span>}
                  </div>
                </button>
              </div>
            </div>

            {/* CARTÃO UNIFICADO DE PREENCHIMENTO DO ACERVO */}
            <div className="form-section-card unified-sheet-card">
              
              {/* SEÇÃO 1: DADOS BÁSICOS & IDENTIFICAÇÃO */}
              <div className="unified-section-header">
                <span className="section-header-icon">
                  <i className="fas fa-id-card-alt"></i>
                </span>
                <div>
                  <h3>DADOS BÁSICOS & IDENTIFICAÇÃO</h3>
                  <p>Informações principais de identificação, dimensões e código do item</p>
                </div>
              </div>

              <div className="form-grid-4">
                {/* LINHA 1: NOME DO PRODUTO */}
                <div className="form-group span-4">
                  <label htmlFor="ce-nome">NOME DO {tipoCadastro === 'decoracao' ? 'PACOTE' : tipoCadastro === 'kit' ? 'CONJUNTO / KIT' : 'PRODUTO'} *</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fas fa-box"></i></span>
                    <input 
                      id="ce-nome" 
                      name="nome" 
                      type="text" 
                      value={nome} 
                      onChange={handleTextChange(setNome)} 
                      required 
                      placeholder={tipoCadastro === 'decoracao' ? "Ex: Decoração Completa Safari" : "Ex: Trio de Cilindros..."} 
                    />
                  </div>
                  {nome.trim().length >= 3 && itensExistentes.some(i => i.id !== itemEditando?.id && i.nome?.trim().toLowerCase() === nome.trim().toLowerCase()) && (
                    <span className="ce-input-warning" style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '3px' }}>
                      💡 Atenção: Você já possui um item com o nome "{nome.trim()}" cadastrado no acervo.
                    </span>
                  )}
                </div>

                {/* LINHA 2: SKU / CÓDIGO E TAGS / BUSCA */}
                <div className="form-group span-2 col-mobile-half">
                  <div className="ce-label-with-actions">
                    <label htmlFor="ce-codigo" style={{ margin: 0 }}>SKU / CÓDIGO *</label>
                    <div className="ce-sku-toolbar">
                      <button 
                        type="button" 
                        onClick={() => gerarSKUAutomatico()}
                        className="ce-sku-btn-auto"
                        title="Gerar código sequencial automático"
                      >
                        <i className="fas fa-bolt"></i> Auto
                      </button>
                      <button 
                        type="button" 
                        onClick={iniciarScannerCadastro}
                        className="ce-sku-btn-scan"
                        title="Escanear Etiqueta com a Câmera"
                      >
                        <i className="fas fa-barcode"></i> Scan
                      </button>
                    </div>
                  </div>
                  <input 
                    id="ce-codigo" 
                    name="codigo" 
                    type="text" 
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
                    <span className="ce-input-error" style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>
                      ⚠️ Este código SKU já existe no acervo!
                    </span>
                  )}
                </div>

                <div className="form-group span-2 col-mobile-half">
                  <div className="ce-label-with-actions">
                    <label htmlFor="ce-tags" style={{ margin: 0 }}>
                      <i className="fas fa-tags" style={{ marginRight: '4px', color: '#c5a059' }}></i>
                      TAGS / BUSCA
                    </label>
                    <span className="ce-badge-neutral" style={{ fontSize: '7.5px', padding: '1px 4px' }}>Vírgulas</span>
                  </div>
                  <input 
                    id="ce-tags" 
                    name="tags" 
                    type="text" 
                    value={tagsInput} 
                    onChange={e => setTagsInput(e.target.value)} 
                    placeholder="Ex: #rustico, #dourado, #boho" 
                  />
                </div>

                {/* LINHA 3: COR PREDOMINANTE E TAMANHO / REF. NA MESMA LINHA */}
                {tipoCadastro === 'avulsa' && (
                  <>
                    <div className="form-group span-2 col-mobile-half">
                      <label htmlFor="ce-cor">COR PREDOMINANTE</label>
                      <select 
                        id="ce-cor"
                        name="cor"
                        value={modoCorCustom ? 'OUTRA_COR' : (OPCOES_COR_PREDEFINIDAS.includes(cor) ? cor : (cor ? 'OUTRA_COR' : ''))} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'OUTRA_COR') {
                            setModoCorCustom(true);
                          } else {
                            setModoCorCustom(false);
                            setCor(val);
                          }
                        }}
                      >
                        <option value="">Selecione...</option>
                        {OPCOES_COR_PREDEFINIDAS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="OUTRA_COR" style={{ fontWeight: '800', color: '#c5a059' }}>✏️ Digitar Outra...</option>
                      </select>
                      {(modoCorCustom || (cor && !OPCOES_COR_PREDEFINIDAS.includes(cor))) && (
                        <input 
                          id="ce-cor-custom"
                          name="corCustom"
                          style={{ marginTop: '6px' }} 
                          value={cor} 
                          onChange={handleTextChange(setCor)} 
                          placeholder="Digite a cor..." 
                          autoFocus
                        />
                      )}
                    </div>

                    <div className="form-group span-2 col-mobile-half">
                      <label htmlFor="ce-tamanho">TAMANHO / REF.</label>
                      <select 
                        id="ce-tamanho"
                        name="tamanho"
                        value={modoTamanhoCustom ? 'OUTRO_TAMANHO' : (OPCOES_TAMANHO_PREDEFINIDAS.includes(tamanho) ? tamanho : (tamanho ? 'OUTRO_TAMANHO' : ''))} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'OUTRO_TAMANHO') {
                            setModoTamanhoCustom(true);
                          } else {
                            setModoTamanhoCustom(false);
                            setTamanho(val);
                          }
                        }}
                      >
                        <option value="">Selecione...</option>
                        {OPCOES_TAMANHO_PREDEFINIDAS.map(tam => (
                          <option key={tam} value={tam}>{tam}</option>
                        ))}
                        <option value="OUTRO_TAMANHO" style={{ fontWeight: '800', color: '#c5a059' }}>✏️ Digitar Outro...</option>
                      </select>
                      {(modoTamanhoCustom || (tamanho && !OPCOES_TAMANHO_PREDEFINIDAS.includes(tamanho))) && (
                        <input 
                          id="ce-tamanho-custom"
                          name="tamanhoCustom"
                          style={{ marginTop: '6px', fontWeight: '700', textTransform: 'uppercase' }} 
                          value={tamanho} 
                          onChange={e => setTamanho(e.target.value.toUpperCase())} 
                          placeholder="Digite o tamanho..." 
                          autoFocus
                        />
                      )}
                    </div>

                    {/* LINHA 4: OS 3 CAMPOS DE MEDIDAS (LARGURA, ALTURA, DIÂMETRO) NA MESMA LINHA */}
                    <div className="form-group span-4">
                      <div className="medidas-grid-3col">
                        <div className="form-group">
                          <label htmlFor="ce-largura">LARGURA (L)</label>
                          <div className="input-unit-wrapper">
                            <input id="ce-largura" name="largura" type="number" value={largura} onChange={e => setLargura(e.target.value)} placeholder="0" min="0" />
                            <span className="input-unit-tag">cm</span>
                          </div>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ce-altura">ALTURA (A)</label>
                          <div className="input-unit-wrapper">
                            <input id="ce-altura" name="altura" type="number" value={altura} onChange={e => setAltura(e.target.value)} placeholder="0" min="0" />
                            <span className="input-unit-tag">cm</span>
                          </div>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ce-diametro">DIÂMETRO (Ø)</label>
                          <div className="input-unit-wrapper">
                            <input id="ce-diametro" name="diametro" type="number" value={diametro} onChange={e => setDiametro(e.target.value)} placeholder="0" min="0" />
                            <span className="input-unit-tag">cm</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* SEÇÃO 2: LOCALIZAÇÃO NO GALPÃO & ESTOQUE */}
              {tipoCadastro !== 'decoracao' && (
                <>
                  <div className="form-section-divider"></div>
                  
                  <div className="unified-section-header">
                    <span className="section-header-icon">
                      <i className="fas fa-warehouse"></i>
                    </span>
                    <div>
                      <h3>LOCALIZAÇÃO NO GALPÃO & ESTOQUE</h3>
                      <p>Prateleiras, corredores e controle de quantidade de segurança</p>
                    </div>
                  </div>

                  <div className="form-grid-4">
                    <div className="form-group span-4">
                      <div className="ce-label-with-actions">
                        <label htmlFor="ce-localizacao" style={{ margin: 0 }}>ENDEREÇO / PRATELEIRA NO GALPÃO *</label>
                        <button 
                          type="button" 
                          onClick={abrirModalLocalizacao} 
                          className="btn-gerenciar-prateleiras-mini"
                          title="Gerenciar lista de prateleiras e corredores"
                        >
                          <i className="fas fa-layer-group"></i> + Gerenciar Prateleiras
                        </button>
                      </div>
                      <select 
                        id="ce-localizacao"
                        name="localizacao"
                        value={localizacao} 
                        onChange={e => setLocalizacao(e.target.value)}
                      >
                        <option value="">Selecione a Prateleira / Local no Galpão...</option>
                        {(listasSistema?.localizacoes || []).map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>

                    <div className="form-group span-2 col-mobile-half">
                      <label htmlFor="ce-quantidade">QUANTIDADE DISPONÍVEL</label>
                      {tipoCadastro === 'kit' ? (
                        <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fundo-cinza, #f8fafc)', borderRadius: '9px', fontSize: '0.82rem', color: '#c5a059', fontWeight: '800', border: '1px solid var(--borda, #cbd5e1)' }}>
                          ⚡ Calculada das Peças
                        </div>
                      ) : (
                        <input id="ce-quantidade" name="quantidade" type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} min="1" style={{ fontWeight: '800', textAlign: 'center' }} />
                      )}
                    </div>

                    <div className="form-group span-2 col-mobile-half">
                      <label htmlFor="ce-estoque-minimo">ESTOQUE MÍNIMO DE SEGURANÇA</label>
                      <input id="ce-estoque-minimo" name="estoqueMinimo" type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} disabled={alertaEstoque === 'NaoAvisar'} style={{ fontWeight: '700', textAlign: 'center' }} />
                    </div>
                  </div>
                </>
              )}

              {/* SEÇÃO 3: CATEGORIZAÇÃO NA VITRINE ONLINE */}
              <div className="form-section-divider"></div>
              
              <div className="unified-section-header">
                <span className="section-header-icon">
                  <i className="fas fa-globe"></i>
                </span>
                <div>
                  <h3>CATEGORIZAÇÃO NA VITRINE ONLINE</h3>
                  <p>Filtros hierárquicos e organização do catálogo virtual</p>
                </div>
              </div>

              <div className="form-grid-4">
                {tipoCadastro === 'decoracao' && (
                  <div className="form-group span-4">
                    <label htmlFor="ce-tipo-pacote">📌 FORMATO / MODALIDADE NO SITE *</label>
                    <select 
                      id="ce-tipo-pacote"
                      name="tipoPacote"
                      value={tipoPacote}
                      onChange={e => setTipoPacote(e.target.value)}
                      style={{ fontWeight: '800', color: 'var(--texto-principal, #0f172a)', border: '1.5px solid #c5a059' }}
                    >
                      <option value="PEGUE E MONTE">📦 Pegue e Monte</option>
                      <option value="DECORAÇÃO">✨ Decoração Completa</option>
                    </select>
                  </div>
                )}

                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="ce-categoria-tema">CATEGORIA NA VITRINE *</label>
                  <select 
                    id="ce-categoria-tema"
                    name="categoriaTema"
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

                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="ce-subcategoria-tema">SUBCATEGORIA (TIPO) *</label>
                  <select 
                    id="ce-subcategoria-tema"
                    name="subcategoriaTema"
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

                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="ce-grupo-tema">FILTRO DE GRUPO *</label>
                  <select 
                    id="ce-grupo-tema"
                    name="grupoTema"
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

                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="ce-tema-selecionado">FILTRO ESPECÍFICO / TEMA *</label>
                  <select 
                    id="ce-tema-selecionado"
                    name="temaSelecionado"
                    value={temaSelecionado} 
                    onChange={e => setTemaSelecionado(e.target.value)} 
                    disabled={(!grupoTemaSelecionado && temaSelecionado !== 'OUTRO_TEMA')} 
                    required
                  >
                    <option value="" disabled hidden>{!grupoTemaSelecionado ? 'Aguardando...' : 'Selecione o tema...'}</option>
                    {temasDisponiveis.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="OUTRO_TEMA" style={{ fontWeight: 'bold', color: '#c5a059' }}>✏️ Digitar Outro Tema...</option>
                  </select>
                </div>

                {temaSelecionado === 'OUTRO_TEMA' && (
                  <div className="form-group span-4">
                    <label htmlFor="ce-tema-personalizado">NOME DO TEMA PERSONALIZADO *</label>
                    <input 
                      id="ce-tema-personalizado"
                      name="temaPersonalizado"
                      type="text" 
                      placeholder="Ex: Safari Baby..." 
                      value={temaDigitadoPersonalizado} 
                      onChange={e => setTemaDigitadoPersonalizado(e.target.value)} 
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* SEÇÃO 4: MONTAGEM DA DECORAÇÃO (SE DECORAÇÃO) */}
              {tipoCadastro === 'decoracao' && (
                <>
                  <div className="form-section-divider"></div>
                  
                  <div className="unified-section-header">
                    <span className="section-header-icon">
                      <i className="fas fa-wand-magic-sparkles"></i>
                    </span>
                    <div>
                      <h3>MONTAGEM DA DECORAÇÃO</h3>
                      <p>Composição de peças do acervo no pacote pronto</p>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario, #64748b)', margin: '0 0 16px 0' }}>
                    Abra o acervo do galpão para selecionar peças existentes ou cadastre peças novas na hora para este pacote!
                  </p>
                  
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setModalCatalogoAberto(true)} className="btn-primary-celebre" style={{ flex: 1, minWidth: '200px', height: '44px', justifyContent: 'center' }}>
                      <i className="fas fa-box-open"></i> ABRIR ACERVO E ADICIONAR PEÇAS
                    </button>

                    <button type="button" onClick={() => setModalNovaPecaAberto(true)} className="btn-secondary-celebre" style={{ flex: 1, minWidth: '200px', height: '44px', justifyContent: 'center', background: '#0f172a', color: '#fff', borderColor: '#0f172a' }}>
                      <i className="fas fa-plus"></i> CADASTRAR PEÇA NOVA NO ACERVO
                    </button>
                  </div>
                  
                  {itensDoKit.length > 0 ? (
                    <div style={{ background: 'var(--fundo-card, #ffffff)', borderRadius: '14px', border: '1px solid var(--borda, #e2e8f0)', overflow: 'hidden' }}>
                      {itensDoKit.map((item, idx) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: idx !== itensDoKit.length - 1 ? '1px solid var(--borda, #f1f5f9)' : 'none' }}>
                          <div style={{ width: '42px', height: '42px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.foto ? (
                              <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <i className="fas fa-box" style={{ fontSize: '16px', color: '#94a3b8' }}></i>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: '0' }}>
                            <strong style={{ fontSize: '0.84rem', color: 'var(--texto-principal, #0f172a)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.nome}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario, #64748b)', fontWeight: '600' }}>
                              Valor avulso base: R$ {(item.precoOriginal || 0).toFixed(2).replace('.', ',')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '2px 4px', border: '1px solid #cbd5e1' }}>
                            <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? { ...i, qtd: Math.max(1, i.qtd - 1) } : i))} style={{ border: 'none', background: '#ffffff', color: '#0f172a', borderRadius: '4px', width: '24px', height: '24px', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                            <span style={{ fontSize: '0.8rem', fontWeight: '800', width: '28px', textAlign: 'center', color: '#0f172a' }}>{item.qtd}</span>
                            <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i))} style={{ border: 'none', background: '#ffffff', color: '#0f172a', borderRadius: '4px', width: '24px', height: '24px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                          </div>

                          <button type="button" onClick={() => setItensDoKit(itensDoKit.filter(i => i.id !== item.id))} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.72rem' }}>
                            ✕
                          </button>
                        </div>
                      ))}

                      <div style={{ background: '#f8fafc', padding: '12px 16px', textAlign: 'right', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                          Soma das Peças Avulsas:
                        </span>
                        <strong style={{ fontSize: '0.98rem', color: '#0f172a', fontWeight: '800' }}>
                          R$ {calcularTotalSomaAvulsaKit().toFixed(2).replace('.', ',')}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1.5px dashed #cbd5e1', fontSize: '0.82rem', fontWeight: '600' }}>
                      <i className="fas fa-box-open" style={{ fontSize: '22px', marginBottom: '6px', color: '#c5a059', display: 'block' }}></i>
                      Nenhuma peça adicionada ao pacote de decoração ainda.<br/>
                      <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Clique no botão dourado acima para selecionar itens do acervo.</span>
                    </div>
                  )}
                </>
              )}

              {/* SEÇÃO 5: DESMEMBRAR KIT EM PEÇAS AVULSAS (SE KIT) */}
              {tipoCadastro === 'kit' && (
                <>
                  <div className="form-section-divider"></div>
                  
                  <div className="unified-section-header">
                    <span className="section-header-icon">
                      <i className="fas fa-cubes"></i>
                    </span>
                    <div>
                      <h3>DESMEMBRAR KIT EM PEÇAS AVULSAS</h3>
                      <p>Cadastre peças avulsas desmembráveis deste conjunto</p>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario, #64748b)', marginBottom: '16px' }}>
                    Adicione as peças individuais deste kit se você desejar alugá-las separadamente no sistema (ex: trio de cilindros que pode ser alugado junto ou avulso).
                  </p>

                  {pecasKitNovas.map((p, idx) => (
                    <div key={p.id} style={{background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', marginBottom: '10px'}}>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center'}}>
                        <div style={{flex: 2, minWidth: '130px'}}>
                          <label style={{fontSize: '0.68rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '3px'}}>NOME DA PEÇA *</label>
                          <input type="text" placeholder="Ex: Vaso Médio" value={p.nome} onChange={e => atualizarPecaKitNova(idx, 'nome', e.target.value)} style={{width: '100%', height: '38px', padding: '0 10px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '80px'}}>
                          <label style={{fontSize: '0.68rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '3px'}}>TAMANHO</label>
                          <input type="text" placeholder="Ex: P, M" value={p.tamanho} onChange={e => atualizarPecaKitNova(idx, 'tamanho', e.target.value.toUpperCase())} style={{width: '100%', height: '38px', padding: '0 10px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', fontWeight: '700', textTransform: 'uppercase'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '80px'}}>
                          <label style={{fontSize: '0.68rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '3px'}}>COR</label>
                          <input type="text" placeholder="Ex: Rosa" value={p.cor} onChange={e => atualizarPecaKitNova(idx, 'cor', e.target.value)} style={{width: '100%', height: '38px', padding: '0 10px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none'}} />
                        </div>
                        <div style={{flex: 1, minWidth: '100px'}}>
                          <label style={{fontSize: '0.68rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '3px'}}>VALOR AVULSO (R$) *</label>
                          <input type="text" placeholder="0,00" value={p.valorAluguel} onChange={e => atualizarPecaKitNova(idx, 'valorAluguel', e.target.value)} onBlur={e => {
                              let val = e.target.value.replace(',', '.');
                              const num = parseFloat(val);
                              if(!isNaN(num)) atualizarPecaKitNova(idx, 'valorAluguel', num.toFixed(2).replace('.', ','));
                          }} style={{width: '100%', height: '38px', padding: '0 10px', fontSize: '0.85rem', fontWeight: '800', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none'}} />
                        </div>
                        
                        <button type="button" onClick={() => setPecasKitNovas(pecasKitNovas.filter(item => item.id !== p.id))} style={{background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0 10px', cursor: 'pointer', fontWeight: '800', height: '38px', marginTop: '16px', fontSize: '0.74rem'}}>✕</button>
                      </div>
                    </div>
                  ))}
                  
                  <button type="button" onClick={() => setPecasKitNovas([...pecasKitNovas, { id: Date.now(), nome: '', valorAluguel: '', cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' }])} className="btn-secondary-celebre" style={{ width: '100%', justifyContent: 'center', height: '40px' }}>
                    <i className="fas fa-plus"></i> Adicionar Peça ao Kit
                  </button>
                </>
              )}

              {/* SEÇÃO 6: PREÇOS & FINANCEIRO */}
              <div className="form-section-divider"></div>
              
              <div className="unified-section-header">
                <span className="section-header-icon">
                  <i className="fas fa-coins"></i>
                </span>
                <div>
                  <h3>PREÇOS & FINANCEIRO</h3>
                  <p>Valores de locação, aquisição e retorno de investimento</p>
                </div>
              </div>

              <div className="form-grid-4">
                <div className="form-group span-4">
                  <div className="precos-grid-3col">
                    <div className="form-group">
                      <label htmlFor="ce-valor-aluguel" style={{ color: 'var(--texto-principal, #0f172a)', fontWeight: '850' }}>
                        {tipoCadastro === 'decoracao' ? 'VALOR DO ALUGUEL (R$) *' : 'PREÇO DO ALUGUEL (R$) *'}
                      </label>
                      <div className="input-icon-wrapper">
                        <span className="input-left-icon"><i className="fas fa-dollar-sign" style={{ color: '#c5a059' }}></i></span>
                        <input 
                          id="ce-valor-aluguel"
                          name="valorAluguel"
                          type="text" 
                          value={valorAluguel} 
                          onChange={e => setValorAluguel(e.target.value)} 
                          onBlur={formatarMoedaBlur(setValorAluguel)} 
                          required 
                          style={{ height: '42px', border: '1.5px solid #c5a059', fontSize: '1rem', fontWeight: '850' }} 
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    {tipoCadastro !== 'decoracao' && (
                      <>
                        <div className="form-group">
                          <label htmlFor="ce-valor-compra">VALOR COMPRA (R$)</label>
                          <input id="ce-valor-compra" name="valorCompra" type="text" value={valorCompra} onChange={e => setValorCompra(e.target.value)} onBlur={formatarMoedaBlur(setValorCompra)} placeholder="0,00" style={{ height: '42px', fontWeight: '700' }} />
                        </div>

                        <div className="form-group">
                          <label htmlFor="ce-valor-reposicao">REPOSIÇÃO (R$)</label>
                          <input id="ce-valor-reposicao" name="valorReposicao" type="text" value={valorReposicao} onChange={e => setValorReposicao(e.target.value)} onBlur={formatarMoedaBlur(setValorReposicao)} placeholder="0,00" style={{ height: '42px', fontWeight: '700' }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 📊 CALCULADORA DE PAYBACK */}
                {(() => {
                  const vCompra = Number(String(valorCompra || '0').replace(/\./g, '').replace(',', '.'));
                  const vAluguel = Number(String(valorAluguel || '0').replace(/\./g, '').replace(',', '.'));
                  if (vCompra > 0 && vAluguel > 0) {
                    const qtdAlugueisPayback = Math.ceil(vCompra / vAluguel);
                    const margemPorAluguel = ((vAluguel / vCompra) * 100).toFixed(1);
                    return (
                      <div className="form-group span-4" style={{ marginTop: '6px', background: 'rgba(197, 160, 89, 0.08)', border: '1.5px solid #c5a059', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px', color: '#c5a059' }}>
                            <i className="fas fa-chart-pie"></i>
                          </span>
                          <div>
                            <strong style={{ fontSize: '0.82rem', color: '#0f172a', display: 'block' }}>Retorno do Investimento (Payback)</strong>
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              A peça se paga com <strong>{qtdAlugueisPayback} locação(ões)</strong> (Retorno de {margemPorAluguel}% por locação).
                            </span>
                          </div>
                        </div>
                        <span style={{ background: '#c5a059', color: '#ffffff', padding: '3px 10px', borderRadius: '16px', fontSize: '0.72rem', fontWeight: '800' }}>
                          ✓ Lucro a partir do {qtdAlugueisPayback}º aluguel
                        </span>
                      </div>
                    );
                  } else if (vCompra > 0 && (!vAluguel || vAluguel === 0)) {
                    const sugestao25 = (vCompra * 0.25).toFixed(2).replace('.', ',');
                    const sugestao30 = (vCompra * 0.30).toFixed(2).replace('.', ',');
                    return (
                      <div className="form-group span-4" style={{ marginTop: '6px', background: 'rgba(197, 160, 89, 0.1)', border: '1px solid rgba(197, 160, 89, 0.25)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.76rem', color: '#c5a059', fontWeight: '700' }}>
                          💡 Sugestão de Aluguel (25% a 30% da compra): R$ {sugestao25} a R$ {sugestao30}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setValorAluguel(sugestao25)}
                          style={{ background: '#c5a059', color: '#ffffff', border: 'none', padding: '5px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer' }}
                        >
                          Usar R$ {sugestao25}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* BARRA DE AÇÃO NO RODAPÉ INTEGRADA */}
              <div className="unified-card-actions-bar">
                <button type="button" onClick={() => navigate(dadosCompra ? "/compras" : "/estoque")} className="btn-secondary-celebre">
                  <i className="fas fa-arrow-left"></i> Cancelar
                </button>
                <button type="submit" className="btn-primary-celebre" disabled={salvando}>
                  <i className={salvando ? "fas fa-spinner fa-spin" : "fas fa-save"}></i> {salvando ? 'Salvando...' : (tipoCadastro === 'decoracao' ? `Salvar ${tipoPacote}` : tipoCadastro === 'kit' ? 'Salvar Conjunto' : 'Salvar Peça')}
                </button>
              </div>

            </div>

          </div>
        </form>
      </div>

      {modalCatalogoAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="catalogo-modal-container" style={{ maxWidth: '1100px', width: '92%', height: '86vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', border: '1px solid color-mix(in srgb, var(--cor-destaque, #c5a059) 30%, transparent)' }}>
            
            {/* LUXURY HEADER ISOLATED */}
            <div style={{ padding: '18px 28px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '2px solid var(--cor-destaque, #c5a059)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '26px' }}>📦</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: '800', lineHeight: '1.2' }}>
                    Acervo Físico
                  </h3>
                  <span style={{ color: 'var(--cor-destaque, #c5a059)', fontSize: '0.82rem', fontWeight: '600', display: 'block', marginTop: '2px' }}>
                    Escolha as peças que compõem este pacote de decoração
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {itensDoKit.length > 0 && (
                  <div style={{ background: 'color-mix(in srgb, var(--cor-destaque, #c5a059) 20%, transparent)', border: '1px solid var(--cor-destaque, #c5a059)', padding: '6px 14px', borderRadius: '20px', color: '#ffffff', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🛒</span> {itensDoKit.reduce((acc, i) => acc + i.qtd, 0)} item(ns) selecionado(s)
                  </div>
                )}
                <button 
                  type="button" 
                  onClick={() => setModalNovaPecaAberto(true)} 
                  style={{ background: 'var(--cor-destaque, #c5a059)', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px color-mix(in srgb, var(--cor-destaque, #c5a059) 35%, transparent)', transition: 'all 0.2s' }}
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
                        border: isActive ? '1px solid var(--cor-destaque, #c5a059)' : '1.5px solid #cbd5e1',
                        background: isActive ? 'var(--cor-destaque, #c5a059)' : '#ffffff',
                        color: isActive ? '#ffffff' : '#475569',
                        boxShadow: isActive ? '0 4px 10px color-mix(in srgb, var(--cor-destaque, #c5a059) 25%, transparent)' : 'none'
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
                        border: foiAdicionado ? (excedeEstoque ? '2.5px solid #f59e0b' : '2.5px solid var(--cor-destaque, #c5a059)') : '1.5px solid #e2e8f0', 
                        borderRadius: '16px', 
                        overflow: 'hidden', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        boxShadow: foiAdicionado ? '0 8px 20px -4px color-mix(in srgb, var(--cor-destaque, #c5a059) 25%, transparent)' : '0 4px 6px -1px rgba(0, 0, 0, 0.04)', 
                        transition: 'all 0.2s ease', 
                        position: 'relative' 
                      }} 
                    >
                      {/* INCLUDED RIBBON BADGE */}
                      {foiAdicionado && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: excedeEstoque ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'var(--cor-destaque, #c5a059)', color: '#ffffff', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                          <div style={{ fontSize: '0.88rem', color: 'var(--cor-destaque, #c5a059)', fontWeight: '800' }}>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1.5px solid var(--cor-destaque, #c5a059)', borderRadius: '10px', padding: '2px 4px' }}>
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
                  <strong style={{ fontSize: '1.1rem', color: 'var(--cor-destaque, #c5a059)', fontWeight: '800' }}>
                    R$ {calcularTotalSomaAvulsaKit().toFixed(2).replace('.', ',')}
                  </strong>
                </div>

                <button 
                  type="button" 
                  onClick={() => setModalCatalogoAberto(false)} 
                  style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', border: '1px solid var(--cor-destaque, #c5a059)', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)', transition: 'all 0.2s' }}
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
                <button type="submit" disabled={salvandoNovaPecaRapida} style={{ height: '44px', padding: '0 26px', borderRadius: '10px', border: 'none', background: 'var(--cor-destaque, #c5a059)', color: '#ffffff', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px color-mix(in srgb, var(--cor-destaque, #c5a059) 30%, transparent)' }}>
                  {salvandoNovaPecaRapida ? 'Salvando...' : '💾 Cadastrar e Incluir no Pacote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔥 MODAL EXECUTIVE PARA GERENCIAR PRATELEIRAS & ENDEREÇAMENTO FÍSICO 🔥 */}
      {modalLocalizacaoAberto && (
        <div className="modal-overlay-premium" onClick={() => setModalLocalizacaoAberto(false)}>
          <div className="modal-prateleiras-box" onClick={e => e.stopPropagation()}>
            
            {/* CABEÇALHO DO MODAL */}
            <div className="modal-prateleiras-header">
              <div className="modal-prateleiras-header-title">
                <div className="modal-prateleiras-icon">
                  <i className="fas fa-layer-group"></i>
                </div>
                <div>
                  <h3>Gerenciar Prateleiras do Galpão</h3>
                  <span>Cadastre e organize corredores, prateleiras e nichos</span>
                </div>
              </div>
              <button 
                type="button"
                className="modal-prateleiras-btn-close"
                onClick={() => setModalLocalizacaoAberto(false)} 
                title="Fechar"
              >
                ✕
              </button>
            </div>
            
            {/* FORMULÁRIO DE NOVO ENDEREÇO */}
            <div className="modal-prateleiras-form-card">
              <div className="modal-prateleiras-form-title">
                <i className="fas fa-plus-circle" style={{ color: '#c5a059' }}></i>
                Cadastrar Novo Endereço
              </div>
              
              <div className="modal-prateleiras-inputs-grid">
                <div className="modal-prateleiras-input-group">
                  <label>CORREDOR</label>
                  <input 
                    type="text" 
                    placeholder="Ex: A, B..." 
                    value={modalCorredor} 
                    onChange={e => setModalCorredor(e.target.value)}
                  />
                </div>
                <div className="modal-prateleiras-input-group">
                  <label>PRATELEIRA</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 1, 2..." 
                    value={modalPrateleira} 
                    onChange={e => setModalPrateleira(e.target.value)}
                  />
                </div>
                <div className="modal-prateleiras-input-group">
                  <label>BANDEJA / NICHO</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 3, 4..." 
                    value={modalBandeja} 
                    onChange={e => setModalBandeja(e.target.value)}
                  />
                </div>
              </div>

              {gerarPreviewModalEndereco() && (
                <div className="modal-prateleiras-preview-tag">
                  <i className="fas fa-map-pin"></i>
                  <span>Prévia: <strong>{gerarPreviewModalEndereco()}</strong></span>
                </div>
              )}

              <button 
                type="button" 
                onClick={handleAddLocalizacaoEspecial}
                className="modal-prateleiras-btn-add"
              >
                <i className="fas fa-plus"></i> Adicionar à Lista
              </button>
            </div>

            {/* LISTA DE LOCALIZAÇÕES SALVAS */}
            <div className="modal-prateleiras-list-section">
              <div className="modal-prateleiras-list-title">
                PRATELEIRAS REGISTRADAS NO SISTEMA ({localizacoesEditaveis.length})
              </div>

              <div className="modal-prateleiras-list-box">
                {localizacoesEditaveis.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                    <i className="fas fa-warehouse" style={{ fontSize: '24px', display: 'block', marginBottom: '8px', opacity: 0.5 }}></i>
                    Nenhuma prateleira cadastrada ainda.
                  </div>
                ) : (
                  localizacoesEditaveis.map((loc, idx) => (
                    <div key={idx} className="modal-prateleiras-item-row">
                      <span className="modal-prateleiras-item-text">
                        <i className="fas fa-map-marker-alt" style={{ color: '#c5a059' }}></i>
                        {loc}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLocalizacao(loc)}
                        className="modal-prateleiras-btn-delete"
                        title="Remover prateleira"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RODAPÉ COM BOTÕES DE AÇÃO */}
            <div className="modal-prateleiras-footer">
              <button 
                type="button" 
                onClick={() => setModalLocalizacaoAberto(false)} 
                className="modal-prateleiras-btn-cancel"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSaveLocalizacoes} 
                disabled={salvandoLocalizacoes} 
                className="modal-prateleiras-btn-save"
              >
                <i className="fas fa-save"></i>
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