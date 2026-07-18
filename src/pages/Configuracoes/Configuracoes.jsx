import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, getDocs, where, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile } from 'firebase/auth'; 
import SignatureCanvas from 'react-signature-canvas'; 
import './Configuracoes.css';

import { CATALOGO_TEMAS, CATEGORIAS_FISICAS } from '../../catalogoDeTemas';

const Configuracoes = () => {
  const navigate = useNavigate();
  // 🔥 Autenticação e Hierarquia
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
  const isOwner = tenantId === usuarioLogado?.uid;
  const isCollaborator = !isSuperAdmin && !isOwner;

  // 🔥 ESTADOS GERAIS E ABAS
  const [abaAtiva, setAbaAtiva] = useState('meu_perfil'); 
  const [loading, setLoading] = useState(true);

  // ==========================================
  // ESTADOS DO MEU PERFIL E ASSINATURA
  // ==========================================
  const [dadosPerfil, setDadosPerfil] = useState({
    nome: '', sobrenome: '', cpf: '', telefone: '', endereco: '', email: '',
    senhaAtual: '', novaSenha: '', confirmarSenha: '',
    asoStatus: 'Pendente', asoTipo: 'Admissional', asoDataExame: '', asoValidade: '', asoObservacoes: ''
  });

  const [assinatura, setAssinatura] = useState({
    planoNome: 'Carregando...', precoMensal: '0,00', status: 'Carregando...',
    corBg: '#f1f5f9', corTexto: '#64748b', metodoPagamento: 'Nenhum', emailCobranca: '-',
    subscriptionId: null, isActive: false 
  });

  const [usoPlano, setUsoPlano] = useState({ limite: 1, usado: 1 });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // ==========================================
  // ESTADOS DE CONFIGURAÇÕES DO SISTEMA (MANTIDOS INTACTOS)
  // ==========================================
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'padrao');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'pt');
  
  const sigGlobal = useRef({});
  const [config, setConfig] = useState({
    localizacoes: [], categoriasFisicas: [], subcategoriasFisicas: {}, tamanhosPorCategoria: {}, catalogoVitrine: {}, 
    nomeEmpresa: '', cnpj: '', telefone: '', emailEmpresa: '', endereco: '', instagram: '', logotipo: '', slogan: '', site: '', assinatura: '', pixelFacebook: '' 
  });

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

  // ==========================================
  // 🔥 AUDITORIA GERAL (UNIFICADA)
  // ==========================================
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(), criadoEm: serverTimestamp(), funcionario: nomeEquipa,
        usuarioNome: nomeEquipa, usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(), detalhes: detalhes, userId: tenantId, empresaId: tenantId,
        funcionarioId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de configurações:", error);
    }
  };

  // ==========================================
  // EFEITOS GERAIS
  // ==========================================
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
    if (!usuarioLogado) { navigate('/login'); return; }
    carregarTudoUnificado(); 
  }, [usuarioLogado, navigate, tenantId]);

  // ==========================================
  // 🔥 CARREGAMENTO UNIFICADO (PERFIL E SISTEMA)
  // ==========================================
  const getDocConfigRef = () => doc(db, "configuracoes_empresa", tenantId);

  const carregarTudoUnificado = async () => {
    setLoading(true);
    try {
        // 1. DADOS DE CONFIGURAÇÃO DO SISTEMA (A sua lógica intocada)
        const docRef = getDocConfigRef();
        const docSnap = await getDoc(docRef);
        let dadosConf = docSnap.exists() ? docSnap.data() : {};

        let dbCatFis = dadosConf.categoriasFisicas || [];
        let dbSubCatFis = dadosConf.subcategoriasFisicas || {};
        let dbTamCat = dadosConf.tamanhosPorCategoria || {};
        let dbCatVitrine = dadosConf.catalogoVitrine;

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
            ...dadosConf, userId: tenantId, categoriasFisicas: dbCatFis, subcategoriasFisicas: dbSubCatFis,
            tamanhosPorCategoria: dbTamCat, catalogoVitrine: dbCatVitrine || {}
        };

        if (precisaAtualizarDB || !docSnap.exists()) {
             await setDoc(docRef, newState, { merge: true });
        }
        setConfig(prev => ({ ...prev, ...newState }));

        // 2. DADOS DO MEU PERFIL (Usuário Logado)
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const uData = userSnap.data();
            setDadosPerfil(prev => ({
                ...prev,
                nome: uData.nomeCompleto || uData.nomeExibicao || usuarioLogado.displayName || (isCollaborator ? 'Colaborador' : 'Admin'),
                sobrenome: uData.sobrenome || '', cpf: uData.cpf || uData.documento || '',
                telefone: uData.telefone || '', endereco: uData.endereco || '', email: usuarioLogado.email || ''
            }));

            if (isCollaborator) {
                const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
                const snapEquipe = await getDocs(qEquipe);
                if (!snapEquipe.empty) {
                    const equipeData = snapEquipe.docs[0].data();
                    setDadosPerfil(prev => ({
                        ...prev, asoStatus: equipeData.asoStatus || 'Pendente', asoTipo: equipeData.asoTipo || 'Admissional',
                        asoDataExame: equipeData.asoDataExame || '', asoValidade: equipeData.asoValidade || '', asoObservacoes: equipeData.asoObservacoes || ''
                    }));
                }
            }

            if (!isCollaborator) {
                const contaAlvoRef = isSuperAdmin ? doc(db, 'usuarios', usuarioLogado.uid) : doc(db, 'usuarios', tenantId);
                const contaAlvoSnap = await getDoc(contaAlvoRef);
                
                let statusReal = "Inativa / Sem Plano", corBg = "#fef2f2", corTexto = "#991b1b", textoMetodo = "Nenhum método cadastrado";
                let isActive = false, nomeDoPlano = "Básico (Gratuito)", precoDoPlano = "0,00", limiteAtual = 1;
                let emailCobranca = usuarioLogado.email, subId = null;

                if (contaAlvoSnap.exists()) {
                    const cData = contaAlvoSnap.data();
                    let testeAtivo = cData.dataFimTeste ? new Date() <= new Date(cData.dataFimTeste) : false;

                    if (cData.assinaturaAtiva || cData.statusAssinatura === 'ativa' || cData.plano === 'pago') {
                        statusReal = "Assinatura Ativa"; corBg = "#f0fdf4"; corTexto = "#166534"; 
                        textoMetodo = cData.metodoPagamento || "Cartão de Crédito"; isActive = true;
                    } else if (testeAtivo) {
                        statusReal = "Em Período de Teste (VIP)"; corBg = "#fffbeb"; corTexto = "#b45309"; 
                    }

                    if (cData.planoId) {
                        const planoSnap = await getDoc(doc(db, "planos", cData.planoId));
                        if (planoSnap.exists()) {
                            nomeDoPlano = planoSnap.data().nome; precoDoPlano = planoSnap.data().preco;
                            if (nomeDoPlano.toLowerCase().includes('premium')) limiteAtual = 3;
                            else if (nomeDoPlano.toLowerCase().includes('pro')) limiteAtual = 5;
                        }
                    }
                    emailCobranca = cData.email || usuarioLogado.email; subId = cData.subscriptionId || null;
                }

                if (isSuperAdmin) {
                    nomeDoPlano = "Plano Master (Ilimitado)"; limiteAtual = 9999; statusReal = "Acesso Vitalício";
                    corBg = "#fef3c7"; corTexto = "#92400e"; isActive = true; textoMetodo = "Administração Global";
                }

                setAssinatura({
                    planoNome: nomeDoPlano, precoMensal: precoDoPlano, status: statusReal, corBg: corBg,
                    corTexto: corTexto, metodoPagamento: textoMetodo, emailCobranca: emailCobranca,
                    subscriptionId: subId, isActive: isActive
                });

                const qEquipe = query(collection(db, 'equipe'), where('empresaId', '==', tenantId));
                const snapEquipe = await getDocs(qEquipe);
                setUsoPlano({ limite: limiteAtual, usado: snapEquipe.size + 1 });
            }
        }
    } catch (e) { console.error("Erro unificado:", e); }
    setLoading(false);
  };

  // ========================================================
  // 🔥 LÓGICA DO MEU PERFIL E SEGURANÇA
  // ========================================================
  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
        await updateProfile(usuarioLogado, { displayName: dadosPerfil.nome });
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        await updateDoc(userRef, { 
            nomeCompleto: dadosPerfil.nome, sobrenome: dadosPerfil.sobrenome, cpf: dadosPerfil.cpf,
            telefone: dadosPerfil.telefone, endereco: dadosPerfil.endereco
        });

        if (isCollaborator) {
            const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
            const snapEquipe = await getDocs(qEquipe);
            if (!snapEquipe.empty) {
                const funcDocId = snapEquipe.docs[0].id;
                await updateDoc(doc(db, 'equipe', funcDocId), { nome: dadosPerfil.nome, telefone: dadosPerfil.telefone, cpf: dadosPerfil.cpf });
            }
        }
        await registrarLog("ATUALIZAÇÃO DE PERFIL", `Atualizou os dados da ficha pessoal.`);
        alert('✅ Dados atualizados com sucesso!');
    } catch (error) { alert('Ocorreu um erro ao salvar o perfil.'); } 
    finally { setSalvandoPerfil(false); }
  };

  const validarSenha = (senha) => ({
      tamanho: senha.length >= 8, maiuscula: /[A-Z]/.test(senha), minuscula: /[a-z]/.test(senha),
      numero: /[0-9]/.test(senha), especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(senha)
  });

  const criterios = validarSenha(dadosPerfil.novaSenha);
  const isSenhaForte = Object.values(criterios).every(Boolean);

  const handleTrocarSenha = async (e) => {
    e.preventDefault();
    setSalvandoSenha(true);
    try {
        if (!dadosPerfil.senhaAtual || !dadosPerfil.novaSenha || !dadosPerfil.confirmarSenha) return alert('⚠️ Preencha todos os campos do cofre de segurança.');
        if (!isSenhaForte) return alert('❌ A nova senha não atende aos critérios mínimos de segurança.');
        if (dadosPerfil.novaSenha !== dadosPerfil.confirmarSenha) return alert('❌ As senhas novas não coincidem!');

        const credential = EmailAuthProvider.credential(usuarioLogado.email, dadosPerfil.senhaAtual);
        try { await reauthenticateWithCredential(usuarioLogado, credential); } 
        catch (authError) { return alert('❌ A Senha Atual está incorreta. Acesso negado.'); }

        await updatePassword(usuarioLogado, dadosPerfil.novaSenha);
        await registrarLog("ALTERAÇÃO DE SENHA", `A palavra-passe foi alterada com sucesso.`);
        alert('✅ Senha atualizada com sucesso! Seu sistema está seguro.');
        setDadosPerfil({...dadosPerfil, senhaAtual: '', novaSenha: '', confirmarSenha: ''});
        setModalSenhaAberto(false);
    } catch (error) { alert('Ocorreu um erro inesperado ao alterar a senha.'); } 
    finally { setSalvandoSenha(false); }
  };

  const handleCancelarAssinatura = async () => {
    if (!assinatura.subscriptionId) return alert("Não foi possível encontrar o ID da assinatura para cancelar.");
    if (!window.confirm("Tem certeza que deseja cancelar a sua assinatura? Perderá o acesso às ferramentas premium.")) return;
    setCancelando(true);
    try {
      const URL_FUNCAO_CANCELAR = 'https://us-central1-celebre-9f5c9.cloudfunctions.net/cancelarAssinatura';
      const resposta = await fetch(URL_FUNCAO_CANCELAR, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usuarioLogado.uid, subscriptionId: assinatura.subscriptionId })
      });
      if (resposta.ok) {
        await registrarLog("CANCELAMENTO DE ASSINATURA", `A assinatura da empresa foi cancelada no Mercado Pago.`);
        alert("Assinatura cancelada com sucesso.");
        setAssinatura(prev => ({ ...prev, status: 'Cancelada / Inativa', corBg: '#fef2f2', corTexto: '#991b1b', isActive: false }));
      } else { alert("Não foi possível cancelar no momento. Tente novamente."); }
    } catch (error) { alert("Erro de conexão ao tentar cancelar a assinatura."); } 
    finally { setCancelando(false); }
  };

  // ========================================================
  // 🔥 LÓGICA DAS CONFIGURAÇÕES DO SISTEMA (INTACTA)
  // ========================================================
  const verificarUsoNoEstoque = async (nomeDoCampoDeBusca, valorProcurado) => {
      if (!usuarioLogado) return 0;
      const q = query(collection(db, "estoque"), where("userId", "==", tenantId), where(nomeDoCampoDeBusca, "==", valorProcurado));
      const snap = await getDocs(q);
      return snap.size; 
  };

  const atualizarNomeNoEstoqueEmLote = async (campoBanco, valorAntigo, valorNovo) => {
      if (!campoBanco || !usuarioLogado) return;
      try {
          const q = query(collection(db, "estoque"), where("userId", "==", tenantId), where(campoBanco, "==", valorAntigo));
          const snap = await getDocs(q);
          if (snap.empty) return; 
          const batch = writeBatch(db);
          snap.forEach(docSnap => { batch.update(docSnap.ref, { [campoBanco]: valorNovo }); });
          await batch.commit(); 
      } catch(e) { console.error("Erro ao atualizar lote de estoque:", e); }
  };

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
              novaVitrine[novoTrim] = novaVitrine[valorAntigo]; delete novaVitrine[valorAntigo];
              if(catVitrineSelecionada === valorAntigo) setCatVitrineSelecionada(novoTrim);
          } else if (nivel === 2) {
              if(novaVitrine[catVitrineSelecionada][novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][novoTrim] = novaVitrine[catVitrineSelecionada][valorAntigo]; delete novaVitrine[catVitrineSelecionada][valorAntigo];
              if(subCatVitrineSelecionada === valorAntigo) setSubCatVitrineSelecionada(novoTrim);
          } else if (nivel === 3) {
              if(novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][novoTrim] = novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valorAntigo]; delete novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valorAntigo];
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
          carregarTudoUnificado();
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
              if (campoPrincipal === 'categoriasFisicas' && catFisicaSelecionada === valorRemover) { setCatFisicaSelecionada(''); setSubCatFisicaSelecionada(''); }
          }
          carregarTudoUnificado();
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
              let newCats = [...config.categoriasFisicas]; newCats[arrIndex] = novoTrim;
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
          carregarTudoUnificado();
          await atualizarNomeNoEstoqueEmLote(campoBanco, valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar."); console.error(e); }
  };

  const adicionarLocalizacao = async (valor) => {
    if (!valor.trim() || !usuarioLogado) return;
    const docRef = getDocConfigRef();
    try { await updateDoc(docRef, { localizacoes: arrayUnion(valor.trim()) }); setInputLoc(''); carregarTudoUnificado(); } 
    catch (e) { alert("Erro ao adicionar."); }
  };

  const removerLocalizacao = async (valor) => {
    const quantidadeEmUso = await verificarUsoNoEstoque('localizacao', valor);
    if (quantidadeEmUso > 0) { alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${quantidadeEmUso} peça(s) guardadas em "${valor}".`); return; }
    if (!window.confirm(`Remover prateleira/local "${valor}"?`)) return;
    try { await updateDoc(getDocConfigRef(), { localizacoes: arrayRemove(valor) }); carregarTudoUnificado(); } 
    catch (e) { alert("Erro ao remover."); }
  };

  const editarLocalizacao = async (valorAntigo) => {
      const valorNovo = window.prompt(`Renomear "${valorAntigo}" para:`, valorAntigo);
      if (!valorNovo || valorNovo.trim() === valorAntigo) return;
      const novoTrim = valorNovo.trim();
      if(config.localizacoes.includes(novoTrim)) { alert("Esta localização já existe!"); return; }
      try {
          await updateDoc(getDocConfigRef(), { localizacoes: arrayRemove(valorAntigo) });
          await updateDoc(getDocConfigRef(), { localizacoes: arrayUnion(novoTrim) });
          carregarTudoUnificado();
          await atualizarNomeNoEstoqueEmLote('localizacao', valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar localização."); }
  };

  const handleConfigChange = (campo, valor) => setConfig(prev => ({ ...prev, [campo]: valor }));

  const salvarConfigTextual = async (campo, valor) => {
    if (!usuarioLogado) return;
    try { 
        await updateDoc(getDocConfigRef(), { [campo]: valor });
        const nomesAmigaveis = { nomeEmpresa: 'Nome da Empresa', cnpj: 'CNPJ / CPF', telefone: 'WhatsApp / Telefone', emailEmpresa: 'E-mail', endereco: 'Endereço Completo', instagram: 'Instagram', slogan: 'Slogan', site: 'Site / Link', pixelFacebook: 'Pixel do Facebook' };
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
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
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

  const porcentagemUso = isSuperAdmin ? 100 : (usoPlano.usado / usoPlano.limite) * 100;
  const corBarraUso = isSuperAdmin ? '#c5a059' : (porcentagemUso >= 100 ? '#ef4444' : (porcentagemUso > 70 ? '#f59e0b' : '#10b981'));

  return (
    <div className="config-container fade-in">
      <header className="config-header-top">
        <div className="header-titles">
          <h1>Painel de Controle Central</h1>
          <p>Gerencie todos os aspetos do seu sistema num único lugar.</p>
        </div>
      </header>

      {/* 🔥 MENU DE ABAS ESTILO NOTION/SHOPIFY 🔥 */}
      <nav className="config-top-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        <button className={abaAtiva === 'meu_perfil' ? 'active' : ''} onClick={() => setAbaAtiva('meu_perfil')}>👤 Meu Perfil</button>
        {!isCollaborator && <button className={abaAtiva === 'empresa' ? 'active' : ''} onClick={() => setAbaAtiva('empresa')}>🏢 Empresa</button>}
        {!isCollaborator && <button className={abaAtiva === 'listas' ? 'active' : ''} onClick={() => setAbaAtiva('listas')}>📦 Catálogo e Estoque</button>}
        {!isCollaborator && <button className={abaAtiva === 'assinatura' ? 'active' : ''} onClick={() => setAbaAtiva('assinatura')}>💳 Assinatura e Uso</button>}
        <button className={abaAtiva === 'seguranca' ? 'active' : ''} onClick={() => setAbaAtiva('seguranca')}>🛡️ Segurança</button>
        <button className={abaAtiva === 'aparencia' ? 'active' : ''} onClick={() => setAbaAtiva('aparencia')}>🎨 Aparência</button>
      </nav>

      <main className="config-main-area">
        
        {/* ========================================== */}
        {/* ABA: MEU PERFIL (Trazida do antigo Perfil.jsx) */}
        {/* ========================================== */}
        {abaAtiva === 'meu_perfil' && (
          <form className="config-empresa-grid" onSubmit={handleSalvarPerfil}>
            <div className="config-card span-2-col-full large-padding">
              <div className="card-top-bar gray-bar"></div>
              <h3>👤 Informações Pessoais (Ficha RH)</h3>
              <p className="subtext">Dados da pessoa que está a operar a conta atualmente.</p>
              
              <div className="form-grid-2-col" style={{marginTop: '20px'}}>
                <div className="f-group">
                    <label>Nome Completo</label>
                    <input type="text" value={dadosPerfil.nome} onChange={(e) => setDadosPerfil({...dadosPerfil, nome: e.target.value})} placeholder="Nome" />
                </div>
                <div className="f-group">
                    <label>Sobrenome / Apelido</label>
                    <input type="text" value={dadosPerfil.sobrenome} onChange={(e) => setDadosPerfil({...dadosPerfil, sobrenome: e.target.value})} placeholder="Sobrenome" />
                </div>
                <div className="f-group">
                    <label>CPF do Titular</label>
                    <input type="text" value={dadosPerfil.cpf} onChange={(e) => setDadosPerfil({...dadosPerfil, cpf: e.target.value})} placeholder="000.000.000-00" />
                </div>
                <div className="f-group">
                    <label>Telefone / WhatsApp Pessoal</label>
                    <input type="text" value={dadosPerfil.telefone} onChange={(e) => setDadosPerfil({...dadosPerfil, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
                <div className="f-group span-2-col">
                    <label>Endereço Residencial</label>
                    <input type="text" value={dadosPerfil.endereco} onChange={(e) => setDadosPerfil({...dadosPerfil, endereco: e.target.value})} placeholder="Rua, Número, Bairro, Cidade - UF" />
                </div>
                <div className="f-group span-2-col">
                    <label>E-mail de Login (Acesso ao Sistema)</label>
                    <input type="email" value={dadosPerfil.email} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} title="Inalterável" />
                </div>
              </div>
              <button type="submit" className="btn-salvar-config" style={{marginTop: '20px'}} disabled={salvandoPerfil}>{salvandoPerfil ? 'Salvando...' : 'Salvar Dados Pessoais'}</button>
            </div>

            {isCollaborator && (
                <div className="config-card span-2-col-full large-padding" style={{ border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                    <h3 style={{color: '#0f172a'}}><i className="fas fa-notes-medical" style={{ color: '#10b981', marginRight: '8px' }}></i> Saúde Ocupacional (ASO)</h3>
                    <p className="subtext">Ficha de saúde preenchida pelo seu gestor.</p>
                    
                    <div className="form-grid-2-col" style={{marginTop: '20px'}}>
                        <div className="f-group">
                            <label>Status do Exame</label>
                            <input type="text" value={dadosPerfil.asoStatus} readOnly style={{background: '#e2e8f0', cursor: 'not-allowed', color: dadosPerfil.asoStatus === 'Apto' ? '#166534' : (dadosPerfil.asoStatus === 'Inapto' ? '#991b1b' : '#0f172a'), fontWeight: 'bold'}} />
                        </div>
                        <div className="f-group">
                            <label>Tipo de Exame</label>
                            <input type="text" value={dadosPerfil.asoTipo} readOnly style={{background: '#e2e8f0', cursor: 'not-allowed'}} />
                        </div>
                        <div className="f-group">
                            <label>Data de Realização</label>
                            <input type="text" value={dadosPerfil.asoDataExame ? dadosPerfil.asoDataExame.split('-').reverse().join('/') : 'Não informada'} readOnly style={{background: '#e2e8f0', cursor: 'not-allowed'}} />
                        </div>
                        <div className="f-group">
                            <label>Validade do Exame</label>
                            <input type="text" value={dadosPerfil.asoValidade ? dadosPerfil.asoValidade.split('-').reverse().join('/') : 'Não informada'} readOnly style={{background: '#e2e8f0', cursor: 'not-allowed'}} />
                        </div>
                        <div className="f-group span-2-col">
                            <label>Observações / Restrições Médicas</label>
                            <input type="text" value={dadosPerfil.asoObservacoes || 'Nenhuma restrição registrada.'} readOnly style={{background: '#e2e8f0', cursor: 'not-allowed'}} />
                        </div>
                    </div>
                </div>
            )}
          </form>
        )}

        {/* ========================================== */}
        {/* ABA: DADOS DA EMPRESA (Intacta) */}
        {/* ========================================== */}
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
                      <SignatureCanvas ref={sigGlobal} penColor="#b48a3c" canvasProps={{ className: "sigCanvas" }} backgroundColor="transparent" />
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

        {/* ========================================== */}
        {/* ABA: TABELAS E CATÁLOGO (Intacta) */}
        {/* ========================================== */}
        {abaAtiva === 'listas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
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

        {/* ========================================== */}
        {/* ABA: ASSINATURA E USO DO PLANO */}
        {/* ========================================== */}
        {abaAtiva === 'assinatura' && (
          <div className="config-empresa-grid">
            <div className="config-card span-2-col-full large-padding">
                <div className="card-top-bar gold-bar"></div>
                <h3><i className="fas fa-crown"></i> Detalhes da Assinatura</h3>
                <p className="subtext">Acompanhe os limites da sua conta e controle a sua assinatura Celebre.</p>
                
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Usuários Cadastrados (Você + Equipe)</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: corBarraUso }}>
                            {isSuperAdmin ? 'Acesso Ilimitado' : `${usoPlano.usado} de ${usoPlano.limite} vagas no ${assinatura.planoNome}`}
                        </span>
                    </div>
                    <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '50px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(porcentagemUso, 100)}%`, background: corBarraUso, height: '100%', borderRadius: '50px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    {!isSuperAdmin && porcentagemUso >= 100 && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ Limite de funcionários atingido. Faça upgrade para adicionar mais.</p>
                    )}
                </div>

                <div className="assinatura-card" style={{ display: 'block', width: '100%', minWidth: '100%', boxSizing: 'border-box', background: assinatura.corBg, border: `1px solid ${assinatura.corTexto}40` }}>
                    <div className="assinatura-header">
                        <div className="assinatura-titulo">
                            <h4 style={{ color: assinatura.corTexto }}>{assinatura.planoNome}</h4>
                            {!isSuperAdmin && <span className="preco-assinatura" style={{ color: assinatura.corTexto }}>R$ {assinatura.precoMensal} <span>/mês</span></span>}
                        </div>
                        <div className="status-badge" style={{ background: assinatura.corTexto, color: '#fff' }}>{assinatura.status}</div>
                    </div>
                    <hr style={{ borderColor: `${assinatura.corTexto}20` }} />
                    <div className="assinatura-details">
                        <div className="detail-item">
                            <label style={{ color: `${assinatura.corTexto}90` }}>MÉTODO DE PAGAMENTO</label>
                            <p style={{ color: assinatura.corTexto }}><i className={isSuperAdmin ? "fas fa-shield-alt" : "fas fa-credit-card"}></i> {assinatura.metodoPagamento}</p>
                        </div>
                        <div className="detail-item">
                            <label style={{ color: `${assinatura.corTexto}90` }}>E-MAIL DE CONTATO</label>
                            <p style={{ color: assinatura.corTexto }}><i className="fas fa-envelope"></i> {assinatura.emailCobranca}</p>
                        </div>
                    </div>
                </div>
                
                <div style={{display:'flex', gap: '15px', marginTop: 20, flexWrap: 'wrap'}}>
                  <button type="button" className="btn-salvar-config" onClick={() => navigate('/planos')}>Gerenciar Plano e Pagamentos <i className="fas fa-arrow-right" style={{marginLeft: '8px'}}></i></button>
                  {assinatura.isActive && !isSuperAdmin && (
                      <button type="button" onClick={handleCancelarAssinatura} disabled={cancelando} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: cancelando ? 'not-allowed' : 'pointer', transition: '0.2s', opacity: cancelando ? 0.6 : 1 }}>
                      <i className="fas fa-ban" style={{marginRight: '8px'}}></i> {cancelando ? 'Cancelando...' : 'Cancelar Assinatura'}
                      </button>
                  )}
                </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* ABA: SEGURANÇA E ACESSO */}
        {/* ========================================== */}
        {abaAtiva === 'seguranca' && (
          <div className="config-empresa-grid">
            <div className="config-card span-2-col-full large-padding" style={{textAlign: 'center'}}>
                <div className="card-top-bar blue-bar"></div>
                <div style={{fontSize: '40px', color: '#3b82f6', marginBottom: '15px'}}><i className="fas fa-shield-alt"></i></div>
                <h3>Segurança da Conta</h3>
                <p className="subtext" style={{maxWidth: '600px', margin: '0 auto 20px'}}>A sua palavra-passe é criptografada de ponta a ponta. Caso suspeite de acessos indevidos ou queira atualizar as suas credenciais, inicie o processo seguro abaixo.</p>
                <button type="button" className="btn-salvar-config" onClick={() => setModalSenhaAberto(true)}><i className="fas fa-lock"></i> Abrir Cofre para Alterar Senha</button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* ABA: APARÊNCIA */}
        {/* ========================================== */}
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

      {/* =========================================
          MODAL DE TROCA DE SENHA
      ========================================= */}
      {modalSenhaAberto && (
        <div className="modal-overlay-senha" onClick={() => setModalSenhaAberto(false)}>
            <div className="modal-senha-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-senha-header">
                    <div className="icon-cofre"><i className="fas fa-key"></i></div>
                    <h2>Verificação de Segurança</h2>
                    <p>Para alterar a sua palavra-passe, confirme a sua identidade.</p>
                </div>
                <form onSubmit={handleTrocarSenha} className="modal-senha-body">
                    <div className="input-group">
                        <label>PALAVRA-PASSE ATUAL <span style={{color: '#ef4444'}}>*</span></label>
                        <div className="password-wrapper">
                            <input type={mostrarSenhaAtual ? "text" : "password"} value={dadosPerfil.senhaAtual} onChange={e => setDadosPerfil({...dadosPerfil, senhaAtual: e.target.value})} placeholder="Digite a sua senha atual" autoFocus />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}><i className={`fas ${mostrarSenhaAtual ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                    </div>
                    <div className="senha-divider"></div>
                    <div className="input-group">
                        <label>NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input type={mostrarNovaSenha ? "text" : "password"} value={dadosPerfil.novaSenha} onChange={e => setDadosPerfil({...dadosPerfil, novaSenha: e.target.value})} placeholder="Crie uma senha forte" />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}><i className={`fas ${mostrarNovaSenha ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                        <div className="senha-criterios">
                            <p>Sua senha deve conter:</p>
                            <ul>
                                <li className={criterios.tamanho ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.tamanho ? "fa-check-circle" : "fa-circle"}`}></i> Mínimo de 8 caracteres</li>
                                <li className={criterios.maiuscula && criterios.minuscula ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.maiuscula && criterios.minuscula ? "fa-check-circle" : "fa-circle"}`}></i> Letras maiúsculas e minúsculas</li>
                                <li className={criterios.numero ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.numero ? "fa-check-circle" : "fa-circle"}`}></i> Pelo menos 1 número</li>
                                <li className={criterios.especial ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.especial ? "fa-check-circle" : "fa-circle"}`}></i> Caractere especial (!@#$%&*)</li>
                            </ul>
                        </div>
                    </div>
                    <div className="input-group">
                        <label>CONFIRMAR NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input type={mostrarConfirmarSenha ? "text" : "password"} value={dadosPerfil.confirmarSenha} onChange={e => setDadosPerfil({...dadosPerfil, confirmarSenha: e.target.value})} placeholder="Repita a nova senha" />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}><i className={`fas ${mostrarConfirmarSenha ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                    </div>
                    <div className="modal-senha-footer">
                        <button type="button" className="btn-cancelar-senha" onClick={() => { setModalSenhaAberto(false); setDadosPerfil({...dadosPerfil, senhaAtual: '', novaSenha: '', confirmarSenha: ''}); }}>Cancelar</button>
                        <button type="submit" className="btn-confirmar-senha" disabled={salvandoSenha || !isSenhaForte}>{salvandoSenha ? 'Autenticando...' : 'Confirmar Alteração'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default Configuracoes;