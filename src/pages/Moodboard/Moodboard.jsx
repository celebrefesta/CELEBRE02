import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, getDocs, getDoc, updateDoc, setDoc, query, addDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../../firebaseConfig';
import { getAuth } from 'firebase/auth';
import html2canvas from 'html2canvas'; 
import './Moodboard.css';

const Icons = {
  Crown: (props) => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>,
  Couch: (props) => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20v8H2zm0 0l2-6h16l2 6M6 16v4m12-4v4"/></svg>,
  Type: (props) => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>,
  Layers: (props) => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>,
  Magic: (props) => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  Save: (props) => <svg {...props} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>,
  Folder: (props) => <svg {...props} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
  Trash: (props) => <svg {...props} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Download: (props) => <svg {...props} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  Lock: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Unlock: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>,
  Rotate: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>,
  Flip: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12l-4-4m4 4l-4 4m4-4H9m-4 0l4-4m-4 4l4 4m-4-4h10"/></svg>,
  Bold: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>,
  Italic: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>,
  ArrowUp: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  ArrowDown: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
};

const Moodboard = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [estoqueReal, setEstoqueReal] = useState([]);
  const [itensCanvas, setItensCanvas] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('acervo'); 
  const [editingTextId, setEditingTextId] = useState(null);
  const [wallBackground, setWallBackground] = useState('#f1f5f9');
  const [floorBackground, setFloorBackground] = useState('#e2e8f0');
  const [activeSurface, setActiveSurface] = useState('wall');
  
  const [texturasParede, setTexturasParede] = useState([
    { nome: 'Tijolinho Branco', url: 'https://images.unsplash.com/photo-1558611997-0950a7cf6161?q=80&w=2070&auto=format&fit=crop' }
  ]);
  
  const [texturasChao, setTexturasChao] = useState([
    { nome: 'Madeira Clara', url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=1974&auto=format&fit=crop' }
  ]);
  
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
  const [modalAbrirAberto, setModalAbrirAberto] = useState(false);
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [projetosSalvos, setProjetosSalvos] = useState([]);
  
  const boardRef = useRef(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, itemId: null });
  
  const fontesDisponiveis = [ 
    { nome: 'Moderna (Poppins)', valor: "'Poppins', sans-serif" }, 
    { nome: 'Clássica (Playfair)', valor: "'Playfair Display', serif" }, 
    { nome: 'Elegante (Great Vibes)', valor: "'Great Vibes', cursive" }, 
    { nome: 'Manuscrita (Dancing)', valor: "'Dancing Script', cursive" }, 
    { nome: 'Divertida (Pacifico)', valor: "'Pacifico', cursive" }, 
    { nome: 'Simples (Montserrat)', valor: "'Montserrat', sans-serif" } 
  ];
  
  const grouped = useMemo(() => {
    const mapa = {};
    estoqueReal.forEach(i => { 
        const c = i.categoria || 'Sem Categoria'; 
        if (!mapa[c]) mapa[c] = []; 
        mapa[c].push(i); 
    });
    return mapa;
  }, [estoqueReal]);
  
  const interactionMode = useRef('none');
  const activeItemId = useRef(null);
  const resizeDir = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE MOODBOARD VINCULADO À EMPRESA)
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
      console.error("Erro ao gravar log da auditoria do Moodboard:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarTudo = async () => {
      try {
        // 🔥 BLINDAGEM: Carrega APENAS o estoque da empresa
        const q = query(collection(db, 'estoque'), where("userId", "==", tenantId));
        const snap = await getDocs(q);
  
        let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => {
            const dataA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
            const dataB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
            return dataB - dataA;
        });

        const norm = lista.map(i => ({ ...i, imagem: i.foto || i.imagem || (i.fotos?.[0]) || '' }));
        setEstoqueReal(norm);

        // 🔥 BLINDAGEM: Lê as texturas salvas apenas no cofre da empresa
        const paramSnap = await getDoc(doc(db, "configuracoes_empresa", tenantId));
        if (paramSnap.exists()) {
            const data = paramSnap.data();
            if(data.texturasParede && data.texturasParede.length > 0) setTexturasParede(data.texturasParede);
            if(data.texturasChao && data.texturasChao.length > 0) setTexturasChao(data.texturasChao);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do Moodboard:", err);
      }
    };
    carregarTudo();
  }, [usuarioLogado, navigate, tenantId]);

  const adicionarTextura = async (tipo) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                const nome = prompt("Nome para este fundo (ex: Painel Redondo Rosa):");
                if (!nome) return;
                
                const nova = { nome, url: base64 };
                try {
                    // 🔥 BLINDAGEM: Salva a textura APENAS nas configurações da empresa
                    if (tipo === 'wall') {
                        const atualizadas = [...texturasParede, nova];
                        setTexturasParede(atualizadas);
                        await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasParede: atualizadas }, { merge: true });
                    } else {
                        const atualizadas = [...texturasChao, nova];
                        setTexturasChao(atualizadas);
                        await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasChao: atualizadas }, { merge: true });
                    }
                    alert("✅ Fundo salvo na galeria com sucesso!");
                } catch(err) { 
                    alert("❌ Erro ao salvar fundo. Imagem muito grande.");
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
  };

  const removerTextura = async (tipo, urlParaRemover) => {
    if(!window.confirm("Deseja mesmo excluir este fundo da galeria?")) return;
    try {
        // 🔥 BLINDAGEM: Remove a textura APENAS nas configurações da empresa
        if (tipo === 'wall') {
            const atualizadas = texturasParede.filter(t => t.url !== urlParaRemover);
            setTexturasParede(atualizadas);
            await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasParede: atualizadas }, { merge: true });
        } else {
            const atualizadas = texturasChao.filter(t => t.url !== urlParaRemover);
            setTexturasChao(atualizadas);
            await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasChao: atualizadas }, { merge: true });
        }
    } catch(e) { 
        alert("Erro ao remover fundo.");
    }
  };

  const handleAbrirModalSalvar = () => {
    if (itensCanvas.length === 0) return alert("O projeto está vazio!");
    setNomeProjeto("");
    setModalSalvarAberto(true);
  };

  const salvarProjeto = async () => {
    if (!nomeProjeto.trim()) return alert("Digite um nome para o projeto!");
    
    try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Salva o projeto no cofre principal
        await addDoc(collection(db, "projetos_moodboard"), {
            nome: nomeProjeto, 
            itens: itensCanvas, 
            wallBackground, 
            floorBackground, 
            createdAt: new Date().toISOString(),
            userId: tenantId, // 🎯 SALVA VINCULADO À EMPRESA
            empresaId: tenantId,
            funcionarioId: usuarioLogado.uid 
        });
        
        // 🔥 REGISTA AUDITORIA
        await registrarLog("NOVO PROJETO MOODBOARD", `Salvou um novo projeto de design no Moodboard chamado "${nomeProjeto}".`);
        
        alert("Projeto salvo com sucesso! ✅");
        setModalSalvarAberto(false);
    } catch (error) { 
        alert("Erro ao salvar projeto.");
    }
  };

  const handleAbrirListaProjetos = async () => {
    try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS os projetos da empresa
        const q = query(collection(db, "projetos_moodboard"), where("userId", "==", tenantId));
        const snapshot = await getDocs(q);
        
        let lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Ordena na memória por data
        lista.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setProjetosSalvos(lista);
        setModalAbrirAberto(true);
    } catch (error) { 
        alert("Erro ao buscar projetos.");
    }
  };

  const carregarProjeto = (projeto) => {
    if (window.confirm(`Carregar o projeto "${projeto.nome}"? O desenho atual será perdido.`)) {
        setItensCanvas(projeto.itens || []);
        setWallBackground(projeto.wallBackground || '#f1f5f9');
        setFloorBackground(projeto.floorBackground || '#e2e8f0');
        setModalAbrirAberto(false);
    }
  };
  
  const deletarProjetoSalvo = async (id, nomeProjetoApagado) => {
    if (window.confirm("Excluir este projeto salvo?")) {
        try {
            await deleteDoc(doc(db, "projetos_moodboard", id));
            setProjetosSalvos(prev => prev.filter(p => p.id !== id));
            
            // 🔥 REGISTA AUDITORIA
            await registrarLog("EXCLUSÃO DE PROJETO MOODBOARD", `Excluiu o projeto de design "${nomeProjetoApagado || 'Desconhecido'}".`);
        } catch (error) { 
            alert("Erro ao excluir.");
        }
    }
  };

  const handleContextMenu = (e, id) => { 
      e.preventDefault();
      setSelecionadoId(id);
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, itemId: id }); 
  };
  
  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, itemId: null });
  
  const bringToFront = (targetId = null) => { 
      const id = targetId || contextMenu.itemId;
      if (!id) return; 
      
      setItensCanvas(prev => { 
          const idx = prev.findIndex(i => i.uniqueId === id); 
          if(idx < 0) return prev; 
          const item = prev[idx]; 
          const rest = prev.filter(i => i.uniqueId !== id); 
          return [...rest, item]; 
      });
      closeContextMenu(); 
  };
  
  const sendToBack = (targetId = null) => { 
      const id = targetId || contextMenu.itemId;
      if (!id) return; 
      
      setItensCanvas(prev => { 
          const idx = prev.findIndex(i => i.uniqueId === id); 
          if(idx < 0) return prev; 
          const item = prev[idx]; 
          const rest = prev.filter(i => i.uniqueId !== id); 
          return [item, ...rest]; 
      });
      closeContextMenu(); 
  };

  const toggleLock = (targetId = null) => { 
      const id = targetId || contextMenu.itemId;
      if (!id) return; 
      setItensCanvas(prev => prev.map(i => i.uniqueId === id ? { ...i, locked: !i.locked } : i)); 
      closeContextMenu();
  };
  
  const toggleCategory = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  
  const adicionarAoCanvas = (item) => {
    const novoItem = { 
        ...item, 
        type: 'image', 
        uniqueId: `img_${Date.now()}`, 
        x: 50, 
        y: 50, 
        width: 150, 
        height: 150, 
        rotation: 0, 
        flipH: false, 
        locked: false, 
        opacity: 100, 
        brightness: 100, 
        contrast: 100, 
        shadow: 0 
    };
    setItensCanvas(prev => [...prev, novoItem]); 
    setSelecionadoId(novoItem.uniqueId); 
    setAbaAtiva('efeitos');
  };

  const adicionarTexto = () => {
    const idUnico = `txt_${Date.now()}`;
    const itemTexto = { 
        type: 'text', 
        content: "", 
        color: "#000000", 
        neonColor: "#c5a059", 
        fontSize: 48, 
        fontFamily: "'Pacifico', cursive", 
        uniqueId: idUnico, 
        x: window.innerWidth < 600 ? 20 : 100, 
        y: window.innerWidth < 600 ? 50 : 100, 
        width: 150, 
        height: 60, 
        rotation: 0, 
        locked: false, 
        opacity: 100, 
        shadow: 0,
        neonGlow: 0 
    };
    
    setItensCanvas(prev => [...prev, itemTexto]); 
    setSelecionadoId(idUnico); 
    setEditingTextId(idUnico); 
    setAbaAtiva('texto');
  };

  const aplicarAoFundo = (valor) => {
    const estiloFinal = valor.startsWith('data:image') || valor.startsWith('http') ? `url(${valor})` : valor;
    if (activeSurface === 'wall') {
        setWallBackground(estiloFinal); 
    } else {
        setFloorBackground(estiloFinal);
    }
  };
  
  const handleClearProject = () => { 
      if (window.confirm("⚠️ Tem certeza que deseja limpar a tela?")) { 
          setItensCanvas([]);
          setWallBackground('#f1f5f9'); 
          setFloorBackground('#e2e8f0'); 
      }
  };
  
  const handleExportImage = async () => { 
      if (!boardRef.current) return;
      setSelecionadoId(null); 
      
      setTimeout(async () => { 
          const canvas = await html2canvas(boardRef.current, { useCORS: true, allowTaint: true, backgroundColor: null }); 
          const link = document.createElement('a'); 
          link.download = `Projeto_Moodboard.png`; 
          link.href = canvas.toDataURL(); 
          link.click(); 
          
          // 🔥 REGISTA AUDITORIA
          await registrarLog("EXPORTAÇÃO DE MOODBOARD", `Fez o download de um projeto do Moodboard em imagem (PNG).`);
      }, 200);
  };

  const handlePointerDown = (e, id, type, dir = null) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    setSelecionadoId(id);
    
    if (!dir) {
        if (type === 'text') setAbaAtiva('texto'); 
        else setAbaAtiva('efeitos');
    }

    const item = itensCanvas.find(i => i.uniqueId === id);
    if (id !== editingTextId && !item?.locked) {
        interactionMode.current = dir ? 'resize' : 'drag';
        activeItemId.current = id;
        resizeDir.current = dir;
        lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };
  
  const handlePointerMove = (e) => {
    if (interactionMode.current === 'none' || !activeItemId.current) return;
    
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    
    let scale = 1;
    if (boardRef.current) scale = boardRef.current.getBoundingClientRect().width / boardRef.current.offsetWidth;
    
    const adjDx = dx / scale;
    const adjDy = dy / scale;

    setItensCanvas(prev => prev.map(item => {
      if (item.uniqueId === activeItemId.current && !item.locked) {
        if (interactionMode.current === 'drag') {
            return { ...item, x: item.x + adjDx, y: item.y + adjDy };
        }
        if (interactionMode.current === 'resize') {
            if (item.type === 'text') {
                let sizeChange = (adjDx + adjDy) * 0.4; 
                let newFontSize = (item.fontSize || 48) + sizeChange;
                return { ...item, fontSize: Math.max(12, Math.round(newFontSize)) };
            } else {
                let newW = item.width; 
                let newH = item.height;
                if (resizeDir.current.includes('e')) newW += adjDx;
                if (resizeDir.current.includes('s')) newH += adjDy;
                return { ...item, width: Math.max(30, newW), height: Math.max(30, newH) };
            }
        }
      } 
      return item;
    }));
  };

  const handlePointerUp = (e) => {
    try { 
        e.target.releasePointerCapture(e.pointerId);
    } catch(err){}
    
    interactionMode.current = 'none';
    activeItemId.current = null;
    resizeDir.current = null;
  };
  
  const handleCanvasClick = () => {
      if (selecionadoId) {
          setAbaAtiva('acervo');
      }
      setSelecionadoId(null);
      setEditingTextId(null); 
      closeContextMenu();
  };
  
  const atualizarItem = (id, alt) => setItensCanvas(prev => prev.map(i => i.uniqueId === id ? { ...i, ...alt } : i));
  
  const deleteItem = (id) => { 
      setItensCanvas(prev => prev.filter(i => i.uniqueId !== id)); 
      setSelecionadoId(null); 
  };
  
  const itemSelecionado = itensCanvas.find(i => i.uniqueId === selecionadoId);
  
  const getStyle = (valor) => (!valor ? { background: '#fff' } : valor.startsWith('url') ? { backgroundImage: valor, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: valor });
  
  return (
    <div className="studio-page" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onClick={handleCanvasClick}>
      
      {/* BARRA DE FERRAMENTAS */}
      <div className="studio-toolbar" onClick={e => e.stopPropagation()}>
        <div className="tool-logo"><Icons.Crown /></div>
        <div className={`tool-item ${abaAtiva === 'acervo' ? 'active' : ''}`} onClick={() => setAbaAtiva('acervo')}>
            <Icons.Couch /><span>Acervo</span>
        </div>
        <div className={`tool-item ${abaAtiva === 'texto' ? 'active' : ''}`} onClick={() => setAbaAtiva('texto')}>
            <Icons.Type /><span>Texto</span>
        </div>
        <div className={`tool-item ${abaAtiva === 'fundo' ? 'active' : ''}`} onClick={() => setAbaAtiva('fundo')}>
            <Icons.Layers /><span>Cenário</span>
        </div>
        <div className={`tool-item ${abaAtiva === 'efeitos' ? 'active' : ''}`} onClick={() => setAbaAtiva('efeitos')}>
            <Icons.Magic /><span>Efeitos</span>
        </div>
      </div>

      {/* PAINEL LATERAL/INFERIOR */}
      <div className="studio-panel" onClick={e => e.stopPropagation()}>
        {abaAtiva === 'acervo' && (
           <div className="panel-content">
             <h3 className="panel-title">SEU ACERVO</h3>
             <div className="acervo-list-scroll">
               {Object.keys(grouped).sort().map(cat => (
                 <div key={cat} className="acervo-category">
                   <div className={`acervo-category-header ${expandedCats[cat] ? 'expanded' : ''}`} onClick={() => toggleCategory(cat)}>
                     <span className="cat-name">{cat}</span> <span className="count">{grouped[cat].length}</span>
                   </div>
                   {expandedCats[cat] && (
                     <div className="acervo-grid">
                       {grouped[cat].map(item => (
                         <div key={item.id} className="acervo-card" onClick={() => adicionarAoCanvas(item)}>
                           <div className="card-thumb">
                               <img src={item.imagem || 'https://via.placeholder.com/120'} crossOrigin="anonymous" alt={item.nome} />
                           </div>
                           <div className="card-name">{item.nome}</div>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               ))}
             </div>
           </div>
        )}

         {abaAtiva === 'efeitos' && (
            <div className="panel-content">
                <h3 className="panel-title">EFEITOS & AJUSTES</h3>
                <button 
                    className="btn-primary-action" 
                    style={{ backgroundColor: '#c5a059', color: '#0f172a', marginBottom: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
                    onClick={() => { setSelecionadoId(null); setAbaAtiva('acervo'); }}
                >
                    + Adicionar Mais Itens
                </button>

                {itemSelecionado ? (
                    <div className="effects-tools">
                        <div className="selected-preview">
                            <span>Editando: {itemSelecionado.nome || (itemSelecionado.type === 'text' ? 'Texto' : 'Item')}</span>
                        </div>
                        
                        {itemSelecionado.type === 'image' && (
                          <>
                            <div className="slider-group" title="Dê 2 cliques na bolinha para voltar ao normal">
                                <label>Brilho ({itemSelecionado.brightness}%)</label>
                                <input 
                                    type="range" min="0" max="200" 
                                    value={itemSelecionado.brightness || 100} 
                                    onChange={e => atualizarItem(selecionadoId, {brightness: Number(e.target.value)})} 
                                    onDoubleClick={() => atualizarItem(selecionadoId, {brightness: 100})} 
                                />
                            </div>
               
                            <div className="slider-group" title="Dê 2 cliques na bolinha para voltar ao normal">
                                <label>Contraste ({itemSelecionado.contrast}%)</label>
                                <input 
                                    type="range" min="0" max="200" 
                                    value={itemSelecionado.contrast || 100} 
                                    onChange={e => atualizarItem(selecionadoId, {contrast: Number(e.target.value)})} 
                                    onDoubleClick={() => atualizarItem(selecionadoId, {contrast: 100})}
                                />
                            </div>
                          </>
                        )}
        
                        <div className="slider-group" title="Dê 2 cliques na bolinha para voltar ao normal">
                            <label>Opacidade ({itemSelecionado.opacity}%)</label>
                            <input 
                                type="range" min="10" max="100" 
                                value={itemSelecionado.opacity || 100} 
                                onChange={e => atualizarItem(selecionadoId, {opacity: Number(e.target.value)})} 
                                onDoubleClick={() => atualizarItem(selecionadoId, {opacity: 100})}
                            />
                        </div>
                        
                        <div className="slider-group" title="Dê 2 cliques na bolinha para voltar ao normal">
                            <label>Sombra ({itemSelecionado.shadow}px) {itemSelecionado.shadow === 0 && <small>(Off)</small>}</label>
                            <input 
                                type="range" min="0" max="50" 
                                value={itemSelecionado.shadow || 0} 
                                onChange={e => atualizarItem(selecionadoId, {shadow: Number(e.target.value)})} 
                                onDoubleClick={() => atualizarItem(selecionadoId, {shadow: 0})}
                            />
                        </div>
                        
                        <div className="action-buttons-grid" style={{marginTop: '10px'}}>
                            <button className="btn-secondary" onClick={() => bringToFront(selecionadoId)}><Icons.ArrowUp width={14} /> Frente</button>
                            <button className="btn-secondary" onClick={() => sendToBack(selecionadoId)}><Icons.ArrowDown width={14} /> Trás</button>
                        </div>

                        <div className="action-buttons-grid">
                            <button className={`btn-secondary ${itemSelecionado.locked ? 'active' : ''}`} onClick={() => toggleLock(selecionadoId)}>
                                {itemSelecionado.locked ? <><Icons.Lock width={14} /> Bloqueado</> : <><Icons.Unlock width={14} /> Bloquear</>}
                            </button>
                            <button className="btn-secondary" onClick={() => atualizarItem(selecionadoId, {flipH: !itemSelecionado.flipH})}>
                                <Icons.Flip width={14} /> Virar
                            </button>
                        </div>
                        
                        <button className="btn-danger-action" onClick={() => deleteItem(selecionadoId)}>
                            <Icons.Trash width={14} /> Remover Item
                        </button>
                    </div>
                ) : (
                    <div className="empty-state-panel">
                        <p style={{fontSize: '13px', color: '#64748b'}}>Selecione um item no quadro.</p>
                    </div>
                )}
            </div>
        )}

        {abaAtiva === 'texto' && (
             <div className="panel-content">
                <h3 className="panel-title">ESTILO DO TEXTO</h3>
                <div className="text-tools">
                    <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                        <button className="btn-primary-action" style={{marginBottom: 0}} onClick={adicionarTexto}>+ Novo Texto</button>
                        <button className="btn-secondary" style={{flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 'bold'}} onClick={() => { setSelecionadoId(null); setAbaAtiva('acervo'); }}>Ver Peças</button>
                    </div>
                    
                    {itemSelecionado?.type === 'text' ? (
                        <div className="edit-box">
                            <p className="hint-text" style={{margin: '0 0 10px 0', color: '#0f172a', fontWeight: 'bold'}}>💡 Dê 2 cliques no texto na tela para editar!</p>
                            
                            <select className="font-selector" value={itemSelecionado.fontFamily} onChange={e => atualizarItem(selecionadoId, {fontFamily: e.target.value})}>
                                {fontesDisponiveis.map(f => <option key={f.nome} value={f.valor}>{f.nome}</option>)}
                            </select>
 
                            <div className="style-controls-row">
                                <button className={`btn-style ${itemSelecionado.fontWeight === 'bold' ? 'active' : ''}`} onClick={() => atualizarItem(selecionadoId, {fontWeight: itemSelecionado.fontWeight === 'bold' ? 'normal' : 'bold'})}><Icons.Bold /></button>
                                <button className={`btn-style ${itemSelecionado.fontStyle === 'italic' ? 'active' : ''}`} onClick={() => atualizarItem(selecionadoId, {fontStyle: itemSelecionado.fontStyle === 'italic' ? 'normal' : 'italic'})}><Icons.Italic /></button>
                                <div className="divider-v"></div>
                                <label className="color-picker-wrapper">
                                    Cor: <input type="color" className="color-input-mini" value={itemSelecionado.color} onChange={e => atualizarItem(selecionadoId, {color: e.target.value})} />
                                </label>
                            </div>

                            <div className="slider-group" style={{marginTop: '10px'}} title="Dê 2 cliques para voltar ao normal">
                                 <label>Tamanho da Fonte ({itemSelecionado.fontSize}px)</label>
                                 <input type="range" min="12" max="150" value={itemSelecionado.fontSize} 
                                    onChange={e => atualizarItem(selecionadoId, {fontSize: Number(e.target.value)})} 
                                    onDoubleClick={() => atualizarItem(selecionadoId, {fontSize: 48})}
                                 />
                            </div>

                            <div className="slider-group" style={{marginTop: '15px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                    <label style={{color: '#c5a059', margin: 0}} title="Dê 2 cliques na bolinha abaixo para desligar">🌟 Efeito LED ({(itemSelecionado.neonGlow || 0)}px)</label>
                                    
                                    <label className="color-picker-wrapper" style={{fontSize: '10px', cursor: 'pointer'}}>
                                        Cor LED: <input type="color" className="color-input-mini" style={{width: '20px', height: '20px'}} value={itemSelecionado.neonColor || itemSelecionado.color} onChange={e => atualizarItem(selecionadoId, {neonColor: e.target.value})} />
                                    </label>
                                </div>
                          
                                <input type="range" min="0" max="50" value={itemSelecionado.neonGlow || 0} 
                                    onChange={e => atualizarItem(selecionadoId, {neonGlow: Number(e.target.value)})} 
                                    onDoubleClick={() => atualizarItem(selecionadoId, {neonGlow: 0})}
                                />
                            </div>

                        </div>
                    ) : <p className="hint-text">Crie ou selecione um texto.</p>}
                 </div>
            </div>
        )}

        {abaAtiva === 'fundo' && (
             <div className="panel-content">
                 <h3 className="panel-title">CENÁRIO</h3>
                 <div className="surface-switcher">
                    <button className={`switch-btn ${activeSurface === 'wall' ? 'active' : ''}`} onClick={() => setActiveSurface('wall')}>🧱 PAREDE</button>
                    <button className={`switch-btn ${activeSurface === 'floor' ? 'active' : ''}`} onClick={() => setActiveSurface('floor')}>🟧 CHÃO</button>
                 </div>
                
                <div className="bg-tools">
                    <div className="bg-options-grid" style={{ justifyContent: 'center' }}>
                         <div className="color-picker-btn" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} title="Escolha qualquer cor">
                            <input type="color" className="invisible-color-input" onChange={(e) => aplicarAoFundo(e.target.value)} />
                         </div>
                     </div>
       
                    <div className="adm-header-flex">
                        <h4>Texturas Salvas</h4>
                        <button className="btn-add-textura" onClick={() => adicionarTextura(activeSurface)}>+ Enviar Imagem</button>
                    </div>

                    <div className="bg-presets-grid">
                        {(activeSurface === 'wall' ? texturasParede : texturasChao).map((bg, idx) => (
                            <div key={idx} className="bg-preset-item" style={{backgroundImage: `url(${bg.url})`}} onClick={() => aplicarAoFundo(bg.url)}>
                                <span>{bg.nome}</span>
                                <div className="btn-del-bg" onClick={(e) => { e.stopPropagation(); removerTextura(activeSurface, bg.url); }}>✕</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* ÁREA DA PRANCHETA */}
      <div className="studio-canvas" onContextMenu={(e) => { e.preventDefault(); }}>
        
        <div className="canvas-header-overlay" onClick={e => e.stopPropagation()}>
             <div className="header-actions-group">
                 <button className="btn-header-action" onClick={handleAbrirListaProjetos}><Icons.Folder /> <span className="btn-text">ABRIR PROJETOS</span></button>
                 <button className="btn-header-action" onClick={handleAbrirModalSalvar}><Icons.Save /> <span className="btn-text">SALVAR NOVO PROJETO</span></button>
                 <div className="header-divider"></div>
 
                 <button className="btn-header-action" onClick={handleClearProject}><Icons.Trash /> <span className="btn-text">LIMPAR TELA</span></button>
                 <button className="btn-header-action primary" onClick={handleExportImage}><Icons.Download /> <span className="btn-text">BAIXAR PROJETO (PNG)</span></button>
                 <div className="header-divider"></div>
                 
                 <button className="btn-header-action" style={{backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold'}} onClick={() => navigate('/dashboard')}>
                     ✕ <span className="btn-text">SAIR</span>
                 </button>
             </div>
         </div>
        
        {/* O QUADRO BRANCO */}
        <div className="canvas-artboard" ref={boardRef}>
            <div className="canvas-layers">
                <div className="layer-wall" style={getStyle(wallBackground)}></div>
                <div className="layer-floor" style={getStyle(floorBackground)}></div>
            </div>
    
            {itensCanvas.map((item, index) => (
                <div key={item.uniqueId} 
                    className={`canvas-object ${selecionadoId === item.uniqueId ? 'selected' : ''} ${item.locked ? 'locked-item' : ''}`}
                    style={{ 
                        left: item.x, 
                        top: item.y, 
                        width: item.type === 'text' ? 'max-content' : `${item.width}px`, 
                        height: item.type === 'text' ? 'max-content' : `${item.height}px`, 
                        zIndex: index + 10,
                        transform: `rotate(${item.rotation || 0}deg) scaleX(${item.flipH ? -1 : 1})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        filter: `brightness(${item.brightness}%) contrast(${item.contrast}%) ${item.shadow > 0 ? `drop-shadow(5px 5px ${item.shadow}px rgba(0,0,0,0.5))` : ''}`,
                        opacity: item.opacity / 100, cursor: item.locked ? 'not-allowed' : 'grab',
                        touchAction: 'none'
                    }}
                    onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type)} 
                    onClick={e => e.stopPropagation()} 
                    onContextMenu={(e) => handleContextMenu(e, item.uniqueId)}
                >
                
                {/* LÓGICA DE TEXTO APRIMORADA */}
                {item.type === 'text' ? (
                    editingTextId === item.uniqueId ? (
                        <textarea
                            autoFocus
                            wrap="off" 
                            onFocus={(e) => {
                                const val = e.target.value;
                                e.target.setSelectionRange(val.length, val.length);
                            }}
                            value={item.content}
                            onChange={(e) => {
                                e.target.style.width = '100px'; 
                                e.target.style.width = (e.target.scrollWidth + 10) + 'px';
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                                atualizarItem(item.uniqueId, { content: e.target.value });
                            }}
                            onBlur={(e) => {
                                setEditingTextId(null);
                                if(!e.target.value.trim()) deleteItem(item.uniqueId); 
                            }} 
                            style={{
                                minWidth: '100px',
                                width: item.content ? 'auto' : '150px',
                                height: 'auto',
                                fontSize: `${item.fontSize}px`, color: item.color, fontFamily: item.fontFamily,
                                fontWeight: item.fontWeight, fontStyle: item.fontStyle, textAlign: item.textAlign,
                                background: 'rgba(255,255,255,0.9)', border: '2px dashed #0f172a', borderRadius: '6px',
                                outline: 'none', resize: 'none', overflow: 'hidden', padding: '5px 10px',
                                lineHeight: '1.2', whiteSpace: 'pre',
                                textShadow: item.neonGlow > 0 ? `0 0 5px ${item.neonColor || item.color}, 0 0 ${item.neonGlow}px ${item.neonColor || item.color}, 0 0 ${item.neonGlow * 2}px ${item.neonColor || item.color}` : 'none'
                            }}
                        />
                    ) : (
                        <div 
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(item.uniqueId); }}
                            style={{ 
                                width:'max-content', height: 'max-content', 
                                fontSize: `${item.fontSize}px`, color: item.color, 
                                fontFamily: item.fontFamily, fontWeight: item.fontWeight, 
                                fontStyle: item.fontStyle, textAlign: item.textAlign, cursor: 'text',
                                whiteSpace: 'pre-wrap', padding: '5px 10px', lineHeight: '1.2',
                                textShadow: item.neonGlow > 0 ? `0 0 5px ${item.neonColor || item.color}, 0 0 ${item.neonGlow}px ${item.neonColor || item.color}, 0 0 ${item.neonGlow * 2}px ${item.neonColor || item.color}` : 'none'
                            }}>
                            {item.content || <span style={{opacity: 0, paddingLeft: '50px'}}>_</span>}
                        </div>
                    )
                ) : (
                    <img src={item.imagem} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} crossOrigin="anonymous" alt="" />
                )}
                
                {/* 🔥 BOTÃO FLUTUANTE "EDITAR" */}
                {selecionadoId === item.uniqueId && !item.locked && !editingTextId && (
                    <>
                        <div className="resize-handle se" onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'se')} />
                        <div className="selection-border" />
                     
                        {item.type === 'text' && window.innerWidth < 900 && (
                            <div 
                                onPointerDown={(e) => e.stopPropagation()} 
                                onClick={(e) => { e.stopPropagation(); setEditingTextId(item.uniqueId); }}
                                onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setEditingTextId(item.uniqueId); }}
                                style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', zIndex: 1000 }}
                            >
                                ✏️ Editar
                            </div>
                        )}
                    </>
                 )}
              </div>
            ))}
        </div>

        {/* MENU DE CONTEXTO */}
        {contextMenu.visible && (
            <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
                <div className="ctx-item" onClick={() => bringToFront()}><Icons.Layers style={{transform: 'rotate(180deg)'}} width={16} /> Trazer p/ Frente</div>
                <div className="ctx-item" onClick={() => sendToBack()}><Icons.Layers width={16} /> Enviar p/ Trás</div>
                <div className="ctx-divider"></div>
                <div className="ctx-item" onClick={() => toggleLock()}>
                    <Icons.Lock /> {itensCanvas.find(i => i.uniqueId === contextMenu.itemId)?.locked ? 'Desbloquear' : 'Bloquear'}
                </div>
                <div className="ctx-divider"></div>
                <div className="ctx-item delete" onClick={() => { deleteItem(contextMenu.itemId); closeContextMenu(); }}>
                    <Icons.Trash /> Excluir
                </div>
            </div>
        )}

        {/* MODAIS */}
        {modalSalvarAberto && (
            <div className="overlay">
                <div className="modal-content">
                    <h3>Salvar Projeto</h3>
                    <input type="text" placeholder="Nome do Projeto" value={nomeProjeto} onChange={(e) => setNomeProjeto(e.target.value)} autoFocus />
                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setModalSalvarAberto(false)}>Cancelar</button>
                        <button className="btn-confirm" onClick={salvarProjeto}>Salvar</button>
                    </div>
                </div>
            </div>
        )}

        {modalAbrirAberto && (
             <div className="overlay">
                <div className="modal-content large">
                    <h3>Projetos Salvos</h3>
                    <div className="projects-list">
                        {projetosSalvos.length === 0 ? (
                            <p>Nenhum projeto salvo.</p> 
                        ) : (
                            projetosSalvos.map(proj => (
                                <div key={proj.id} className="project-item-row">
                                    <span onClick={() => carregarProjeto(proj)}>{proj.nome}</span>
                                    <button onClick={() => deletarProjetoSalvo(proj.id, proj.nome)} className="btn-icon-del"><Icons.Trash /></button>
                                </div>
                            ))
                        )}
                    </div>
                    <button className="btn-cancel full" onClick={() => setModalAbrirAberto(false)}>Fechar</button>
                </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default Moodboard;