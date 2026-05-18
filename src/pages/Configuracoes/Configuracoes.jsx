import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, getDocs, where, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
import SignatureCanvas from 'react-signature-canvas'; 
import './Configuracoes.css';

import { CATALOGO_TEMAS, CATEGORIAS_FISICAS } from '../../catalogoDeTemas';

const Configuracoes = () => {
  const navigate = useNavigate();
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [abaAtiva, setAbaAtiva] = useState('listas'); 
  
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'padrao');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'pt');
  
  const sigGlobal = useRef({});
  const [config, setConfig] = useState({
    localizacoes: [], 
    categoriasFisicas: [], 
    subcategoriasFisicas: {}, 
    tamanhosPorCategoria: {}, 
    catalogoVitrine: {}, 
    
    nomeEmpresa: '', cnpj: '', telefone: '', emailEmpresa: '',
    endereco: '', instagram: '', logotipo: '', slogan: '', site: '',
    assinatura: '', pixelFacebook: '' 
  });
  const [loading, setLoading] = useState(true);

  const [inputCatFisica, setInputCatFisica] = useState(''); 
  const [inputSubCatFisica, setInputSubCatFisica] = useState('');
  
  const [inputCatVitrine, setInputCatVitrine] = useState('');
  const [inputSubCatVitrine, setInputSubCatVitrine] = useState('');
  const [inputGrupoVitrine, setInputGrupoVitrine] = useState('');
  const [inputTemaVitrine, setInputTemaVitrine] = useState('');

  const [inputLoc, setInputLoc] = useState('');
  const [inputTam, setInputTam] = useState('');

  const [catFisicaSelecionada, setCatFisicaSelecionada] = useState('');
  const [subCatFisicaSelecionada, setSubCatFisicaSelecionada] = useState('');
  
  const [catVitrineSelecionada, setCatVitrineSelecionada] = useState('');
  const [subCatVitrineSelecionada, setSubCatVitrineSelecionada] = useState('');
  const [grupoVitrineSelecionado, setGrupoVitrineSelecionado] = useState('');
  const [temaVitrineSelecionado, setTemaVitrineSelecionado] = useState('');

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE CONFIGURAÇÕES VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: tenantId, // 🎯 SALVA VINCULADO À EMPRESA
        empresaId: tenantId,
        funcionarioId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de configurações:", error);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    document.documentElement.setAttribute('data-lang', language); 
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', fontSize);
  }, [theme, fontSize, language]);

  const handleMudarIdiomaAutomatico = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    if (lang === 'pt') {
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + window.location.hostname + "; path=/;";
    } else {
      document.cookie = `googtrans=/pt/${lang}; path=/;`;
      document.cookie = `googtrans=/pt/${lang}; domain=${window.location.hostname}; path=/;`;
    }
    setTimeout(() => { window.location.reload(); }, 300);
  };

  useEffect(() => { 
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    buscarConfiguracoes(); 
  }, [usuarioLogado, navigate, tenantId]);

  // 🔥 Helper para obter a referência do cofre da empresa logada (TENANT)
  const getDocConfigRef = () => doc(db, "configuracoes_empresa", tenantId);

  const sincronizarComArquivoJS = async () => {
    if (!usuarioLogado) return;
    try {
        const docRef = getDocConfigRef();
        const docSnap = await getDoc(docRef);
        let dados = docSnap.exists() ? docSnap.data() : {};

        let dbCatFis = dados.categoriasFisicas || [];
        let dbSubCatFis = dados.subcategoriasFisicas || {};
        let dbTamCat = dados.tamanhosPorCategoria || {};
        let dbCatVitrine = dados.catalogoVitrine;

        let precisaAtualizarDB = false;
        if (dbCatFis.length === 0 && Object.keys(CATEGORIAS_FISICAS).length > 0) {
            dbCatFis = Object.keys(CATEGORIAS_FISICAS);
            dbSubCatFis = CATEGORIAS_FISICAS;
            precisaAtualizarDB = true;
        }

        if (!dbCatVitrine || Object.keys(dbCatVitrine).length === 0) {
            dbCatVitrine = CATALOGO_TEMAS;
            precisaAtualizarDB = true;
        }

        const newState = {
            ...dados,
            userId: tenantId, // 🎯 Garante que pertence à empresa
            categoriasFisicas: dbCatFis,
            subcategoriasFisicas: dbSubCatFis,
            tamanhosPorCategoria: dbTamCat,
            catalogoVitrine: dbCatVitrine || {}
        };

        if (precisaAtualizarDB || !docSnap.exists()) {
             await setDoc(docRef, newState, { merge: true });
        }
        setConfig(prev => ({ ...prev, ...newState }));
    } catch (e) { console.error("Erro na sincronização:", e); }
  };

  const buscarConfiguracoes = async () => {
    setLoading(true);
    await sincronizarComArquivoJS(); 
    setLoading(false);
  };

  const verificarUsoNoEstoque = async (nomeDoCampoDeBusca, valorProcurado) => {
      if (!usuarioLogado) return 0;
      // 🔥 BLINDAGEM MULTI-EMPRESA: Busca no estoque da empresa
      const q = query(
          collection(db, "estoque"), 
          where("userId", "==", tenantId),
          where(nomeDoCampoDeBusca, "==", valorProcurado)
      );
      const snap = await getDocs(q);
      return snap.size; 
  };

  const atualizarNomeNoEstoqueEmLote = async (campoBanco, valorAntigo, valorNovo) => {
      if (!campoBanco || !usuarioLogado) return;
      try {
          // 🔥 BLINDAGEM MULTI-EMPRESA: Atualiza no estoque da empresa
          const q = query(
              collection(db, "estoque"), 
              where("userId", "==", tenantId),
              where(campoBanco, "==", valorAntigo)
          );
          const snap = await getDocs(q);
          if (snap.empty) return; 

          const batch = writeBatch(db);
          snap.forEach(docSnap => {
              batch.update(docSnap.ref, { [campoBanco]: valorNovo });
          });
          await batch.commit(); 
      } catch(e) { console.error("Erro ao atualizar lote de estoque:", e); }
  };

  // ========================================================
  // LÓGICA DA VITRINE
  // ========================================================
  const adicionarVitrine = async (nivel, valor) => {
      if (!valor.trim() || !usuarioLogado) return;
      const docRef = getDocConfigRef();
      let novaVitrine = JSON.parse(JSON.stringify(config.catalogoVitrine || {}));

      try {
          if (nivel === 1) { 
              if (novaVitrine[valor.trim()]) { alert("Esta Categoria já existe!"); return; }
              novaVitrine[valor.trim()] = {};
              setInputCatVitrine('');
          } else if (nivel === 2) { 
              if (!catVitrineSelecionada) { alert("Selecione uma Categoria primeiro!"); return; }
              if (novaVitrine[catVitrineSelecionada][valor.trim()]) { alert("Esta Subcategoria já existe!"); return; }
              novaVitrine[catVitrineSelecionada][valor.trim()] = {};
              setInputSubCatVitrine('');
          } else if (nivel === 3) { 
              if (!subCatVitrineSelecionada) { alert("Selecione uma Subcategoria primeiro!"); return; }
              if (novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valor.trim()]) { alert("Este Grupo já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valor.trim()] = [];
              setInputGrupoVitrine('');
          } else if (nivel === 4) { 
              if (!grupoVitrineSelecionado) { alert("Selecione um Grupo primeiro!"); return; }
              if (novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado].includes(valor.trim())) { alert("Este Tema já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado].push(valor.trim());
              setInputTemaVitrine('');
          }

          await updateDoc(docRef, { catalogoVitrine: novaVitrine });
          setConfig(prev => ({...prev, catalogoVitrine: novaVitrine}));
      } catch(e) { alert("Erro ao salvar."); }
  };

  const removerVitrine = async (nivel, valor) => {
      let campoBanco = '';
      if (nivel === 1) campoBanco = 'categoriaTema';
      if (nivel === 2) campoBanco = 'subcategoriaTema';
      if (nivel === 3) campoBanco = 'grupoTema';
      if (nivel === 4) campoBanco = 'tema';

      if (campoBanco) {
          const emUso = await verificarUsoNoEstoque(campoBanco, valor);
          if (emUso > 0) { 
              alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${emUso} peça(s) no Acervo usando "${valor}". Mude as peças antes de excluir.`);
              return; 
          }
      }

      if (!window.confirm(`Tem certeza que deseja apagar "${valor}"?`)) return;
      const docRef = getDocConfigRef();
      let novaVitrine = JSON.parse(JSON.stringify(config.catalogoVitrine || {}));

      try {
          if (nivel === 1) {
              delete novaVitrine[valor];
              setCatVitrineSelecionada(''); setSubCatVitrineSelecionada(''); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado('');
          } else if (nivel === 2) {
              delete novaVitrine[catVitrineSelecionada][valor];
              setSubCatVitrineSelecionada(''); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado('');
          } else if (nivel === 3) {
              delete novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valor];
              setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado('');
          } else if (nivel === 4) {
              let listaTemas = novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado];
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado] = listaTemas.filter(t => t !== valor);
              if (temaVitrineSelecionado === valor) setTemaVitrineSelecionado('');
          }

          await updateDoc(docRef, { catalogoVitrine: novaVitrine });
          setConfig(prev => ({...prev, catalogoVitrine: novaVitrine}));
      } catch(e) { alert("Erro ao excluir."); }
  };

  const editarVitrine = async (nivel, valorAntigo) => {
      const valorNovo = window.prompt(`Renomear "${valorAntigo}" para:`, valorAntigo);
      if (!valorNovo || valorNovo.trim() === valorAntigo) return;
      const novoTrim = valorNovo.trim();

      let campoBanco = '';
      if (nivel === 1) campoBanco = 'categoriaTema';
      if (nivel === 2) campoBanco = 'subcategoriaTema';
      if (nivel === 3) campoBanco = 'grupoTema';
      if (nivel === 4) campoBanco = 'tema';

      const docRef = getDocConfigRef();
      let novaVitrine = JSON.parse(JSON.stringify(config.catalogoVitrine || {}));

      try {
          if (nivel === 1) {
              if(novaVitrine[novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[novoTrim] = novaVitrine[valorAntigo];
              delete novaVitrine[valorAntigo];
              if(catVitrineSelecionada === valorAntigo) setCatVitrineSelecionada(novoTrim);
          } else if (nivel === 2) {
              if(novaVitrine[catVitrineSelecionada][novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][novoTrim] = novaVitrine[catVitrineSelecionada][valorAntigo];
              delete novaVitrine[catVitrineSelecionada][valorAntigo];
              if(subCatVitrineSelecionada === valorAntigo) setSubCatVitrineSelecionada(novoTrim);
          } else if (nivel === 3) {
              if(novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][novoTrim] = novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valorAntigo];
              delete novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valorAntigo];
              if(grupoVitrineSelecionado === valorAntigo) setGrupoVitrineSelecionado(novoTrim);
          } else if (nivel === 4) {
              let listaTemas = novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado];
              if(listaTemas.includes(novoTrim)) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado] = listaTemas.map(t => t === valorAntigo ? novoTrim : t);
          }

          await updateDoc(docRef, { catalogoVitrine: novaVitrine });
          setConfig(prev => ({...prev, catalogoVitrine: novaVitrine}));
          await atualizarNomeNoEstoqueEmLote(campoBanco, valorAntigo, novoTrim);
          
      } catch(e) { alert("Erro ao editar."); console.error(e); }
  };

  // ========================================================
  // LÓGICA FÍSICA
  // ========================================================
  const adicionarFisicoOuTamanho = async (campoPrincipal, campoSub, chavePai, valorNovo) => {
      if (!valorNovo.trim() || !usuarioLogado) return;
      if (!chavePai && campoSub) { alert("Selecione um item acima primeiro!"); return; }
      
      const docRef = getDocConfigRef();
      try {
          if (campoSub) {
              const objetoAtual = { ...config[campoSub] };
              if (!objetoAtual[chavePai]) objetoAtual[chavePai] = [];
              if (objetoAtual[chavePai].includes(valorNovo.trim())) { alert("Este item já existe!"); return; }
              objetoAtual[chavePai].push(valorNovo.trim());
              await updateDoc(docRef, { [campoSub]: objetoAtual });
          } else {
              if (config[campoPrincipal].includes(valorNovo.trim())) { alert("Este item já existe!"); return; }
              await updateDoc(docRef, { [campoPrincipal]: arrayUnion(valorNovo.trim()) });
          }

          if (campoPrincipal === 'categoriasFisicas') setInputCatFisica('');
          if (campoSub === 'subcategoriasFisicas') setInputSubCatFisica('');
          if (campoSub === 'tamanhosPorCategoria') setInputTam('');

          buscarConfiguracoes();
      } catch (e) { alert("Erro ao adicionar."); console.error(e); }
  };

  const removerFisicoOuTamanho = async (campoPrincipal, campoSub, chavePai, valorRemover) => {
      let campoNoBancoDeDados = '';
      if (campoPrincipal === 'categoriasFisicas') campoNoBancoDeDados = 'categoria';
      else if (campoSub === 'subcategoriasFisicas') campoNoBancoDeDados = 'subCategoria';
      else if (campoSub === 'tamanhosPorCategoria') campoNoBancoDeDados = 'especificacoes.tamanho';

      if (campoNoBancoDeDados) {
          const quantidadeEmUso = await verificarUsoNoEstoque(campoNoBancoDeDados, valorRemover);
          if (quantidadeEmUso > 0) {
              alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${quantidadeEmUso} peça(s) no seu Acervo usando "${valorRemover}". Remova o vínculo nas peças antes de apagar daqui.`);
              return; 
          }
      }

      if (!window.confirm(`Tem certeza que deseja remover "${valorRemover}"?`)) return;
      const docRef = getDocConfigRef();
      try {
          if (campoSub) {
              const objetoAtual = { ...config[campoSub] };
              objetoAtual[chavePai] = objetoAtual[chavePai].filter(i => i !== valorRemover);
              await updateDoc(docRef, { [campoSub]: objetoAtual });
              if(campoSub === 'subcategoriasFisicas' && subCatFisicaSelecionada === valorRemover) setSubCatFisicaSelecionada('');
          } else {
              await updateDoc(docRef, { [campoPrincipal]: arrayRemove(valorRemover) });
              if (campoPrincipal === 'categoriasFisicas' && catFisicaSelecionada === valorRemover) {
                  setCatFisicaSelecionada('');
                  setSubCatFisicaSelecionada('');
              }
          }
          buscarConfiguracoes();
      } catch (e) { alert("Erro ao remover."); }
  };

  const editarFisicoOuTamanho = async (campoPrincipal, campoSub, chavePai, valorAntigo) => {
      const valorNovo = window.prompt(`Renomear "${valorAntigo}" para:`, valorAntigo);
      if (!valorNovo || valorNovo.trim() === valorAntigo) return;
      const novoTrim = valorNovo.trim();

      let campoBanco = '';
      if (campoPrincipal === 'categoriasFisicas') campoBanco = 'categoria';
      else if (campoSub === 'subcategoriasFisicas') campoBanco = 'subCategoria';
      else if (campoSub === 'tamanhosPorCategoria') campoBanco = 'especificacoes.tamanho';

      const docRef = getDocConfigRef();
      try {
          if (campoPrincipal === 'categoriasFisicas') {
              if (config.categoriasFisicas.includes(novoTrim)) { alert("Já existe!"); return; }
              
              const arrIndex = config.categoriasFisicas.indexOf(valorAntigo);
              let newCats = [...config.categoriasFisicas];
              newCats[arrIndex] = novoTrim;

              let newSubs = { ...config.subcategoriasFisicas };
              if(newSubs[valorAntigo]){ newSubs[novoTrim] = newSubs[valorAntigo]; delete newSubs[valorAntigo]; }

              let newTams = { ...config.tamanhosPorCategoria };
              if(newTams[valorAntigo]){ newTams[novoTrim] = newTams[valorAntigo]; delete newTams[valorAntigo]; }

              await updateDoc(docRef, { categoriasFisicas: newCats, subcategoriasFisicas: newSubs, tamanhosPorCategoria: newTams });
              if(catFisicaSelecionada === valorAntigo) setCatFisicaSelecionada(novoTrim);

          } else if (campoSub) {
              const objetoAtual = { ...config[campoSub] };
              if (objetoAtual[chavePai].includes(novoTrim)) { alert("Já existe!"); return; }
              objetoAtual[chavePai] = objetoAtual[chavePai].map(i => i === valorAntigo ? novoTrim : i);
              let dadosParaSalvar = { [campoSub]: objetoAtual };
              
              if(campoSub === 'subcategoriasFisicas'){
                  let newTams = { ...config.tamanhosPorCategoria };
                  if(newTams[valorAntigo]){ newTams[novoTrim] = newTams[valorAntigo]; delete newTams[valorAntigo]; }
                  dadosParaSalvar.tamanhosPorCategoria = newTams;
              }

              await updateDoc(docRef, dadosParaSalvar);
          }

          buscarConfiguracoes();
          await atualizarNomeNoEstoqueEmLote(campoBanco, valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar."); console.error(e); }
  };

  // ========================================================
  // LÓGICA LOCALIZAÇÕES
  // ========================================================
  const adicionarLocalizacao = async (valor) => {
    if (!valor.trim() || !usuarioLogado) return;
    const docRef = getDocConfigRef();
    try {
        await updateDoc(docRef, { localizacoes: arrayUnion(valor.trim()) });
        setInputLoc('');
        buscarConfiguracoes();
    } catch (e) { alert("Erro ao adicionar."); }
  };

  const removerLocalizacao = async (valor) => {
    const quantidadeEmUso = await verificarUsoNoEstoque('localizacao', valor);
    if (quantidadeEmUso > 0) {
         alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${quantidadeEmUso} peça(s) guardadas em "${valor}".`);
         return;
    }
    if (!window.confirm(`Remover prateleira/local "${valor}"?`)) return;
    const docRef = getDocConfigRef();
    try {
        await updateDoc(docRef, { localizacoes: arrayRemove(valor) });
        buscarConfiguracoes();
    } catch (e) { alert("Erro ao remover."); }
  };

  const editarLocalizacao = async (valorAntigo) => {
      const valorNovo = window.prompt(`Renomear "${valorAntigo}" para:`, valorAntigo);
      if (!valorNovo || valorNovo.trim() === valorAntigo) return;
      const novoTrim = valorNovo.trim();

      if(config.localizacoes.includes(novoTrim)) { alert("Esta localização já existe!"); return; }

      const docRef = getDocConfigRef();
      try {
          await updateDoc(docRef, { localizacoes: arrayRemove(valorAntigo) });
          await updateDoc(docRef, { localizacoes: arrayUnion(novoTrim) });
          
          buscarConfiguracoes();
          await atualizarNomeNoEstoqueEmLote('localizacao', valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar localização."); }
  };

  // Funções Gerais da Empresa e 🔥 Auditoria 🔥
  const handleConfigChange = (campo, valor) => setConfig(prev => ({ ...prev, [campo]: valor }));

  const salvarConfigTextual = async (campo, valor) => {
    if (!usuarioLogado) return;
    try { 
        await updateDoc(getDocConfigRef(), { [campo]: valor });
        
        // 🔥 REGISTA AUDITORIA DE ALTERAÇÃO DE DADOS VITAIS
        const nomesAmigaveis = {
            nomeEmpresa: 'Nome da Empresa', cnpj: 'CNPJ / CPF', telefone: 'WhatsApp / Telefone', 
            emailEmpresa: 'E-mail', endereco: 'Endereço Completo', instagram: 'Instagram', 
            slogan: 'Slogan', site: 'Site / Link', pixelFacebook: 'Pixel do Facebook'
        };
        await registrarLog("ALTERAÇÃO DE CONFIGURAÇÃO", `Atualizou o campo "${nomesAmigaveis[campo] || campo}" da empresa para: "${valor}".`);
        
    } catch (e) { console.error(e); }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !usuarioLogado) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
        else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const base64Logo = canvas.toDataURL('image/png', 0.9);
        setConfig(prev => ({ ...prev, logotipo: base64Logo }));
        try { 
            await updateDoc(getDocConfigRef(), { logotipo: base64Logo });
            await registrarLog("IDENTIDADE VISUAL", "Atualizou o Logotipo da empresa.");
        } catch (e) { console.error(e); }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removerLogo = async () => {
    if(!window.confirm("Remover logotipo?")) return;
    setConfig(prev => ({ ...prev, logotipo: '' }));
    try { 
        await updateDoc(getDocConfigRef(), { logotipo: '' });
        await registrarLog("IDENTIDADE VISUAL", "Removeu o Logotipo da empresa.");
    } catch (e) { console.error(e); }
  };

  const limparAssinatura = () => { if(sigGlobal.current) sigGlobal.current.clear(); };
  
  const salvarAssinaturaGlobal = async () => {
    if (sigGlobal.current.isEmpty()) { alert("⚠️ Por favor, desenhe sua assinatura antes de salvar."); return; }
    const base64Sig = sigGlobal.current.getCanvas().toDataURL("image/png");
    setConfig(prev => ({ ...prev, assinatura: base64Sig }));
    try { 
        await updateDoc(getDocConfigRef(), { assinatura: base64Sig });
        await registrarLog("ASSINATURA DIGITAL", "Criou uma nova assinatura padrão para os contratos.");
        alert("✅ Assinatura padrão salva com sucesso!");
    } catch (e) { console.error(e); }
  };

  const removerAssinaturaGlobal = async () => {
    if(!window.confirm("Tem certeza que deseja apagar a assinatura padrão?")) return;
    setConfig(prev => ({ ...prev, assinatura: '' }));
    try { 
        await updateDoc(getDocConfigRef(), { assinatura: '' });
        await registrarLog("ASSINATURA DIGITAL", "Apagou a assinatura padrão dos contratos.");
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="loading-config">Carregando painel de controle...</div>;
  
  const categoriasVitrineArr = Object.keys(config.catalogoVitrine || {});
  const subcategoriasVitrineArr = catVitrineSelecionada ? Object.keys(config.catalogoVitrine[catVitrineSelecionada] || {}) : [];
  const gruposVitrineArr = (catVitrineSelecionada && subCatVitrineSelecionada) ? Object.keys(config.catalogoVitrine[catVitrineSelecionada][subCatVitrineSelecionada] || {}) : [];
  const temasVitrineArr = (catVitrineSelecionada && subCatVitrineSelecionada && grupoVitrineSelecionado) ? (config.catalogoVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado] || []) : [];
  const alvoTamanhoFisico = subCatFisicaSelecionada || catFisicaSelecionada;

  return (
    <div className="config-container fade-in">
      <header className="config-header-top">
        <div className="header-titles">
          <h1>Configurações do Sistema</h1>
          <p>Painel de controle geral da {config.nomeEmpresa || 'sua empresa'}</p>
        </div>
      </header>

      <nav className="config-top-tabs">
        <button className={abaAtiva === 'listas' ? 'active' : ''} onClick={() => setAbaAtiva('listas')}>📦 Tabelas e Catálogo</button>
        <button className={abaAtiva === 'empresa' ? 'active' : ''} onClick={() => setAbaAtiva('empresa')}>🏢 Dados da Empresa</button>
        <button className={abaAtiva === 'aparencia' ? 'active' : ''} onClick={() => setAbaAtiva('aparencia')}>🎨 Aparência</button>
      </nav>

      <main className="config-main-area">
        
        {abaAtiva === 'listas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
            {/* ========================================== */}
            {/* SESSÃO 1: GALPÃO */}
            {/* ========================================== */}
            <div>
              <h2 style={{borderBottom: '2px solid #3b82f6', paddingBottom: '8px', color: '#0f172a', margin: '0 0 15px 0', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800'}}>📦 Estrutura do Galpão (Físico)</h2>
 
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                  
                  <div className="config-card" style={{margin: 0}}>
                    <div className="card-top-bar blue-bar"></div>
                    <h3>🏷️ Categorias Físicas (Prateleira)</h3>
                    <div className="add-item-box">
                      <input type="text" placeholder="Ex: Móveis, Painéis..." value={inputCatFisica} onChange={(e) => setInputCatFisica(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarFisicoOuTamanho('categoriasFisicas', null, null, inputCatFisica)} />
                      <button className="btn-add" onClick={() => adicionarFisicoOuTamanho('categoriasFisicas', null, null, inputCatFisica)}>Add</button>
                    </div>
                    <ul className="config-list">
                      {config.categoriasFisicas?.map(cat => (
                        <li key={cat} onClick={() => { setCatFisicaSelecionada(cat); setSubCatFisicaSelecionada(''); }} className={catFisicaSelecionada === cat ? 'active' : ''}>
                          <span>{cat}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={(e) => {e.stopPropagation(); editarFisicoOuTamanho('categoriasFisicas', null, null, cat)}} title="Editar Nome">✏️</span>
                              <span className="del-icon" onClick={(e) => {e.stopPropagation(); removerFisicoOuTamanho('categoriasFisicas', null, null, cat)}} title="Excluir">✕</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="config-card" style={{margin: 0}}>
                    <div className="card-top-bar blue-bar"></div>
                    <h3>📂 Subcategorias Físicas</h3>
                    {!catFisicaSelecionada ? <div className="empty-state">Selecione uma Categoria ao lado.</div> : (
                      <>
                        <div className="add-item-box">
                          <input type="text" placeholder="Ex: Cilindros, Mesas..." value={inputSubCatFisica} onChange={(e) => setInputSubCatFisica(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarFisicoOuTamanho(null, 'subcategoriasFisicas', catFisicaSelecionada, inputSubCatFisica)} />
                          <button className="btn-add" onClick={() => adicionarFisicoOuTamanho(null, 'subcategoriasFisicas', catFisicaSelecionada, inputSubCatFisica)}>Add</button>
                        </div>
                        <ul className="config-list">
                          {config.subcategoriasFisicas[catFisicaSelecionada]?.map(sub => (
                            <li key={sub} onClick={() => setSubCatFisicaSelecionada(sub)} className={subCatFisicaSelecionada === sub ? 'active' : ''}>
                                <span>{sub}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={(e) => {e.stopPropagation(); editarFisicoOuTamanho(null, 'subcategoriasFisicas', catFisicaSelecionada, sub)}} title="Editar Nome">✏️</span>
                                    <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerFisicoOuTamanho(null, 'subcategoriasFisicas', catFisicaSelecionada, sub); }} title="Excluir">✕</span>
                                </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
              </div>
            </div>

            {/* ========================================== */}
            {/* SESSÃO 2: VITRINE */}
            {/* ========================================== */}
            <div>
              <h2 style={{borderBottom: '2px solid var(--dourado)', paddingBottom: '8px', color: '#0f172a', margin: '0 0 15px 0', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800'}}>🌐 Catálogo Virtual (Filtros do Site)</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  
                  <div className="config-card" style={{margin: 0}}>
                    <div className="card-top-bar gold-bar"></div>
                    <h3 title="Categoria Principal na Vitrine">1. Categoria na Vitrine</h3>
                    <div className="add-item-box">
                      <input type="text" placeholder="Ex: Aniversário..." value={inputCatVitrine} onChange={(e) => setInputCatVitrine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(1, inputCatVitrine)} />
                      <button className="btn-add" onClick={() => adicionarVitrine(1, inputCatVitrine)}>Add</button>
                    </div>
                    <ul className="config-list">
                      {categoriasVitrineArr.map(cat => (
                        <li key={cat} onClick={() => { setCatVitrineSelecionada(cat); setSubCatVitrineSelecionada(''); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado(''); }} className={catVitrineSelecionada === cat ? 'active-gold' : ''}>
                           <span>{cat}</span> 
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={(e) => {e.stopPropagation(); editarVitrine(1, cat)}} title="Editar Nome">✏️</span>
                              <span className="del-icon" onClick={(e) => {e.stopPropagation(); removerVitrine(1, cat)}} title="Excluir">✕</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="config-card" style={{margin: 0}}>
                    <div className="card-top-bar gold-bar"></div>
                    <h3 title="Subcategoria de Público">2. Subcategoria</h3>
                    {!catVitrineSelecionada ? <div className="empty-state">Selecione uma Categoria.</div> : (
                      <>
                        <div className="add-item-box">
                          <input type="text" placeholder="Ex: Infantil..." value={inputSubCatVitrine} onChange={(e) => setInputSubCatVitrine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(2, inputSubCatVitrine)} />
                          <button className="btn-add" onClick={() => adicionarVitrine(2, inputSubCatVitrine)}>Add</button>
                        </div>
                        <ul className="config-list">
                          {subcategoriasVitrineArr.map(sub => (
                            <li key={sub} onClick={() => { setSubCatVitrineSelecionada(sub); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado(''); }} className={subCatVitrineSelecionada === sub ? 'active-gold' : ''}>
                              <span>{sub}</span> 
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={(e) => {e.stopPropagation(); editarVitrine(2, sub)}} title="Editar Nome">✏️</span>
                                  <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerVitrine(2, sub); }} title="Excluir">✕</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div className="config-card" style={{margin: 0}}>
                    <div className="card-top-bar gold-bar"></div>
                    <h3 title="Agrupamento de Temas">3. Filtro de Grupo</h3>
                    {!subCatVitrineSelecionada ? <div className="empty-state">Selecione uma Subcategoria.</div> : (
                      <>
                        <div className="add-item-box">
                          <input type="text" placeholder="Ex: Ursinhos..." value={inputGrupoVitrine} onChange={(e) => setInputGrupoVitrine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(3, inputGrupoVitrine)} />
                          <button className="btn-add" onClick={() => adicionarVitrine(3, inputGrupoVitrine)}>Add</button>
                        </div>
                        <ul className="config-list">
                          {gruposVitrineArr.map(grupo => (
                            <li key={grupo} onClick={() => { setGrupoVitrineSelecionado(grupo); setTemaVitrineSelecionado(''); }} className={grupoVitrineSelecionado === grupo ? 'active-gold' : ''}>
                              <span>{grupo}</span> 
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={(e) => {e.stopPropagation(); editarVitrine(3, grupo)}} title="Editar Nome">✏️</span>
                                  <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerVitrine(3, grupo); }} title="Excluir">✕</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div className="config-card" style={{margin: 0}}>
                    <div className="card-top-bar gold-bar"></div>
                    <h3 title="O Tema exato da festa">4. Filtro Específico</h3>
                    {!grupoVitrineSelecionado ? <div className="empty-state">Selecione um Grupo.</div> : (
                      <>
                        <div className="add-item-box">
                          <input type="text" placeholder="Ex: Urso Aviador..." value={inputTemaVitrine} onChange={(e) => setInputTemaVitrine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(4, inputTemaVitrine)} />
                          <button className="btn-add" onClick={() => adicionarVitrine(4, inputTemaVitrine)}>Add</button>
                        </div>
                        <ul className="config-list">
                          {temasVitrineArr.map(tema => (
                            <li key={tema} onClick={() => setTemaVitrineSelecionado(tema)} className={temaVitrineSelecionado === tema ? 'active-gold' : ''}>
                              <span>{tema}</span> 
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={(e) => {e.stopPropagation(); editarVitrine(4, tema)}} title="Editar Nome">✏️</span>
                                  <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerVitrine(4, tema); }} title="Excluir">✕</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

              </div>
            </div>

            {/* ========================================== */}
            {/* SESSÃO 3: EXTRAS */}
            {/* ========================================== */}
            <div>
                <h2 style={{borderBottom: '2px solid #94a3b8', paddingBottom: '8px', color: '#0f172a', margin: '0 0 15px 0', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800'}}>🛠️ Parâmetros Extras</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                    
                    <div className="config-card" style={{margin: 0}}>
                      <div className="card-top-bar gray-bar"></div>
                      <h3>📍 Localizações Físicas (Prateleiras)</h3>
                      <div className="add-item-box">
                        <input type="text" placeholder="Ex: Corredor A, Prateleira 2..." value={inputLoc} onChange={(e) => setInputLoc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarLocalizacao(inputLoc)} />
                        <button className="btn-add" onClick={() => adicionarLocalizacao(inputLoc)}>Add</button>
                      </div>
                      <ul className="config-list" style={{maxHeight: '150px'}}>
                        {config.localizacoes?.map(loc => (
                          <li key={loc}>
                            <span>{loc}</span> 
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={() => editarLocalizacao(loc)} title="Editar Nome">✏️</span>
                                <span className="del-icon" onClick={() => removerLocalizacao(loc)} title="Excluir">✕</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 🔥 CAIXA DE TAMANHOS INTELIGENTE 🔥 */}
                    <div className="config-card" style={{margin: 0}}>
                      <div className="card-top-bar gray-bar"></div>
                      <h3>📏 Tamanhos de "{alvoTamanhoFisico || '...'}"</h3>
                      
                      {!alvoTamanhoFisico ? (
                          <div className="empty-state">Selecione uma Categoria ou Subcategoria Física acima para cadastrar os tamanhos específicos dela.</div>
                      ) : (
                          <>
                            <div className="add-item-box">
                              <input type="text" placeholder={`Add tamanho a ${alvoTamanhoFisico}...`} value={inputTam} onChange={(e) => setInputTam(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarFisicoOuTamanho(null, 'tamanhosPorCategoria', alvoTamanhoFisico, inputTam)} />
                              <button className="btn-add" onClick={() => adicionarFisicoOuTamanho(null, 'tamanhosPorCategoria', alvoTamanhoFisico, inputTam)}>Add</button>
                            </div>
                            <ul className="config-list" style={{maxHeight: '150px'}}>
                              {config.tamanhosPorCategoria?.[alvoTamanhoFisico]?.map(tam => (
                                <li key={tam}>
                                  <span>{tam}</span> 
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{cursor: 'pointer', fontSize: '14px'}} onClick={() => editarFisicoOuTamanho(null, 'tamanhosPorCategoria', alvoTamanhoFisico, tam)} title="Editar Nome">✏️</span>
                                      <span className="del-icon" onClick={() => removerFisicoOuTamanho(null, 'tamanhosPorCategoria', alvoTamanhoFisico, tam)} title="Excluir">✕</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                      )}
                    </div>

                </div>
            </div>

          </div>
        )}

        {abaAtiva === 'empresa' && (
          <div className="config-empresa-grid">
            <div className="config-card">
              <div className="card-top-bar gold-bar"></div>
              <h3>✨ Identidade Visual</h3>
              <p className="subtext">A marca da sua empresa nos catálogos e orçamentos.</p>
              
              <div className="empresa-id-wrapper">
                <div className="logo-preview-box">
                  {config.logotipo ? <img src={config.logotipo} alt="Logo" /> : <span style={{fontSize: '30px', opacity: 0.3}}>📷</span>}
                </div>
                <div className="logo-actions">
                  <label className="btn-outline">
                    Carregar Nova Logo
                    <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleLogoUpload} />
                  </label>
                  {config.logotipo && <button className="btn-danger-outline" onClick={removerLogo}>Remover Logo</button>}
                  <small>Use PNG com fundo transparente.</small>
                </div>
              </div>

              <div className="f-group" style={{marginTop: '15px'}}>
                <label>Razão Social / Nome Fantasia</label>
                <input type="text" value={config.nomeEmpresa || ''} onChange={(e) => handleConfigChange('nomeEmpresa', e.target.value)} onBlur={(e) => salvarConfigTextual('nomeEmpresa', e.target.value)} placeholder="Ex: VICHINHSK FESTA" />
              </div>
              <div className="f-group" style={{marginTop: '15px'}}>
                <label>Slogan ou Breve Descrição</label>
                <input type="text" value={config.slogan || ''} onChange={(e) => handleConfigChange('slogan', e.target.value)} onBlur={(e) => salvarConfigTextual('slogan', e.target.value)} placeholder="Ex: Transformando sonhos em decorações inesquecíveis!" />
              </div>
            </div>

            <div className="config-card">
              <div className="card-top-bar blue-bar"></div>
              <h3>📱 Atendimento e Redes</h3>
              <p className="subtext">Canais de contato direto com o cliente.</p>
              
              <div className="form-grid-2-col">
                <div className="f-group">
                  <label>WhatsApp Comercial</label>
                  <input type="text" value={config.telefone || ''} onChange={(e) => handleConfigChange('telefone', e.target.value)} onBlur={(e) => salvarConfigTextual('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div className="f-group">
                  <label>Instagram</label>
                  <input type="text" value={config.instagram || ''} onChange={(e) => handleConfigChange('instagram', e.target.value)} onBlur={(e) => salvarConfigTextual('instagram', e.target.value)} placeholder="@seuinstagram" />
                </div>
                <div className="f-group span-2-col">
                  <label>E-mail de Contato</label>
                  <input type="email" value={config.emailEmpresa || ''} onChange={(e) => handleConfigChange('emailEmpresa', e.target.value)} onBlur={(e) => salvarConfigTextual('emailEmpresa', e.target.value)} placeholder="contato@suaempresa.com.br" />
                </div>
                <div className="f-group span-2-col">
                  <label>Site ou LinkTree</label>
                  <input type="text" value={config.site || ''} onChange={(e) => handleConfigChange('site', e.target.value)} onBlur={(e) => salvarConfigTextual('site', e.target.value)} placeholder="https://www.suaempresa.com.br" />
                </div>
              </div>
            </div>

            <div className="config-card span-2-col-full">
              <div className="card-top-bar gray-bar"></div>
              <h3>🏢 Dados Fiscais e Sede</h3>
              <p className="subtext">Informações legais para a geração de contratos.</p>
              
              <div className="form-grid-2-col">
                <div className="f-group">
                  <label>CNPJ / CPF</label>
                  <input type="text" value={config.cnpj || ''} onChange={(e) => handleConfigChange('cnpj', e.target.value)} onBlur={(e) => salvarConfigTextual('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
                <div className="f-group">
                  <label>Endereço Completo (Sede / Galpão)</label>
                  <textarea 
                    rows="3" 
                    value={config.endereco || ''} 
                    onChange={(e) => handleConfigChange('endereco', e.target.value)} 
                    onBlur={(e) => salvarConfigTextual('endereco', e.target.value)} 
                    placeholder="Rua, Número, Complemento, Bairro - Cidade/UF"
                    className="config-textarea"
                  />
                </div>
              </div>
            </div>

            <div className="config-card span-2-col-full">
              <div className="card-top-bar blue-bar"></div>
              <h3>📈 Marketing e Rastreamento</h3>
              <p className="subtext">Conecte o seu catálogo à inteligência do Instagram/Facebook Ads.</p>
              
              <div className="form-grid-2-col">
                <div className="f-group span-2-col">
                  <label>ID do Pixel (Facebook / Meta)</label>
                  <input 
                    type="text" 
                    value={config.pixelFacebook || ''} 
                    onChange={(e) => handleConfigChange('pixelFacebook', e.target.value)} 
                    onBlur={(e) => salvarConfigTextual('pixelFacebook', e.target.value)} 
                    placeholder="Ex: 123456789012345 (Apenas números)" 
                  />
                </div>
              </div>
            </div>

            <div className="config-card span-2-col-full">
              <div className="card-top-bar gold-bar"></div>
              <h3>✍️ Assinatura Oficial da Empresa</h3>
              <p className="subtext">Assine aqui uma única vez. O sistema vai aplicar esta assinatura automaticamente em todos os novos contratos.</p>
              
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {config.assinatura ? (
                  <div className="assinatura-trancada ouro-border" style={{width: '100%', maxWidth: '500px'}}>
                    <div className="selo-ok">✅ ASSINATURA SALVA NO SISTEMA</div>
                    <img src={config.assinatura} alt="Assinatura Padrão" />
                    <button className="btn-danger-outline" onClick={removerAssinaturaGlobal} style={{marginTop: '15px'}}>Remover e Fazer Nova</button>
                  </div>
                ) : (
                  <div style={{width: '100%', maxWidth: '500px'}}>
                    <div className="canvas-border ouro-border">
                      <SignatureCanvas
                        ref={sigGlobal}
                        penColor="#b48a3c"
                        canvasProps={{ className: "sigCanvas" }}
                        backgroundColor="transparent"
                      />
                    </div>
                    <div style={{display: 'flex', gap: '15px', marginTop: '15px'}}>
                      <button className="btn-outline" style={{flex: 1}} onClick={limparAssinatura}>Apagar Traço</button>
                      <button className="btn-salvar-config" style={{flex: 2}} onClick={salvarAssinaturaGlobal}>Salvar Assinatura Padrão</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {abaAtiva === 'aparencia' && (
          <div className="config-empresa-grid">
            <div className="config-card large-padding">
              <div className="card-top-bar blue-bar"></div>
              <h3>🎨 Modo de Cor</h3>
              <p className="subtext">Escolha o tema do sistema.</p>
              <div className="btn-group-toggle">
                <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>☀️ Claro</button>
                <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>🌙 Escuro</button>
              </div>
            </div>

            <div className="config-card large-padding">
              <div className="card-top-bar blue-bar"></div>
              <h3>👓 Tamanho da Fonte</h3>
              <p className="subtext">Ajuste o zoom da interface.</p>
              <div className="btn-group-toggle">
                <button className={fontSize === 'padrao' ? 'active' : ''} onClick={() => setFontSize('padrao')}>Normal</button>
                <button className={fontSize === 'ampliado' ? 'active' : ''} onClick={() => setFontSize('ampliado')}>Ampliado</button>
              </div>
            </div>

            <div className="config-card large-padding span-2-col-full">
              <div className="card-top-bar gold-bar"></div>
              <h3>🌐 Idioma do Sistema</h3>
              <p className="subtext">Selecione a linguagem principal da interface do painel.</p>
              <div className="lang-grid">
                <button className={`btn-lang ${language === 'pt' ? 'active' : ''}`} onClick={() => handleMudarIdiomaAutomatico('pt')}>🇧🇷 Português</button>
                <button className={`btn-lang ${language === 'en' ? 'active' : ''}`} onClick={() => handleMudarIdiomaAutomatico('en')}>🇺🇸 English</button>
                <button className={`btn-lang ${language === 'es' ? 'active' : ''}`} onClick={() => handleMudarIdiomaAutomatico('es')}>🇪🇸 Español</button>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default Configuracoes;