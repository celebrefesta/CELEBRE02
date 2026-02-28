import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../../firebaseConfig';
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
};

const Moodboard = () => {
  const navigate = useNavigate(); 
  const [estoqueReal, setEstoqueReal] = useState([]);
  const [itensCanvas, setItensCanvas] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('acervo'); 
  const [editingTextId, setEditingTextId] = useState(null);

  const [wallBackground, setWallBackground] = useState('#f1f5f9');
  const [floorBackground, setFloorBackground] = useState('#e2e8f0');
  const [activeSurface, setActiveSurface] = useState('wall');

  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
  const [modalAbrirAberto, setModalAbrirAberto] = useState(false);
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [projetosSalvos, setProjetosSalvos] = useState([]);

  const boardRef = useRef(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, itemId: null });

  const fontesDisponiveis = [ { nome: 'Moderna (Poppins)', valor: "'Poppins', sans-serif" }, { nome: 'Clássica (Playfair)', valor: "'Playfair Display', serif" }, { nome: 'Elegante (Great Vibes)', valor: "'Great Vibes', cursive" }, { nome: 'Manuscrita (Dancing)', valor: "'Dancing Script', cursive" }, { nome: 'Divertida (Pacifico)', valor: "'Pacifico', cursive" }, { nome: 'Simples (Montserrat)', valor: "'Montserrat', sans-serif" } ];
  const texturasParede = [ { nome: 'Tijolinho Branco', url: 'https://images.unsplash.com/photo-1558611997-0950a7cf6161?q=80&w=2070&auto=format&fit=crop' }, { nome: 'Cimento Queimado', url: 'https://images.unsplash.com/photo-1518640027989-a30d5d7e498e?q=80&w=2070&auto=format&fit=crop' } ];
  const texturasChao = [ { nome: 'Madeira Clara', url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=1974&auto=format&fit=crop' }, { nome: 'Grama', url: 'https://images.unsplash.com/photo-1589556264800-08ae9e129a8c?q=80&w=2070&auto=format&fit=crop' } ];
  const paletaCores = ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#fee2e2', '#dbeafe', '#dcfce7', '#fef3c7', '#f3e8ff', '#0f172a', '#334155'];

  const grouped = useMemo(() => {
    const mapa = {};
    estoqueReal.forEach(i => { const c = i.categoria || 'Sem Categoria'; if (!mapa[c]) mapa[c] = []; mapa[c].push(i); });
    return mapa;
  }, [estoqueReal]);

  const interactionMode = useRef('none');
  const activeItemId = useRef(null);
  const resizeDir = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const carregar = async () => {
      try {
        const q = query(collection(db, 'estoque'), orderBy('criadoEm', 'desc'));
        const snap = await getDocs(q);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const norm = lista.map(i => ({ ...i, imagem: i.foto || i.imagem || (i.fotos?.[0]) || '' }));
        setEstoqueReal(norm);
      } catch (err) {
        const dadosLocal = JSON.parse(localStorage.getItem('estoque')) || [];
        setEstoqueReal(dadosLocal);
      }
    };
    carregar();
  }, []);

  const handleAbrirModalSalvar = () => {
    if (itensCanvas.length === 0) return alert("O projeto está vazio!");
    setNomeProjeto("");
    setModalSalvarAberto(true);
  };

  const salvarProjeto = async () => {
    if (!nomeProjeto.trim()) return alert("Digite um nome para o projeto!");
    try {
        await addDoc(collection(db, "projetos_moodboard"), {
            nome: nomeProjeto, itens: itensCanvas, wallBackground, floorBackground, createdAt: new Date().toISOString()
        });
        alert("Projeto salvo com sucesso! ✅");
        setModalSalvarAberto(false);
    } catch (error) { alert("Erro ao salvar projeto."); }
  };

  const handleAbrirListaProjetos = async () => {
    try {
        const q = query(collection(db, "projetos_moodboard"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setProjetosSalvos(lista);
        setModalAbrirAberto(true);
    } catch (error) { alert("Erro ao buscar projetos."); }
  };

  const carregarProjeto = (projeto) => {
    if (window.confirm(`Carregar o projeto "${projeto.nome}"? O desenho atual será perdido.`)) {
        setItensCanvas(projeto.itens || []);
        setWallBackground(projeto.wallBackground || '#f1f5f9');
        setFloorBackground(projeto.floorBackground || '#e2e8f0');
        setModalAbrirAberto(false);
    }
  };

  const deletarProjetoSalvo = async (id) => {
    if (window.confirm("Excluir este projeto salvo?")) {
        try {
            await deleteDoc(doc(db, "projetos_moodboard", id));
            setProjetosSalvos(prev => prev.filter(p => p.id !== id));
        } catch (error) { alert("Erro ao excluir."); }
    }
  };

  const handleContextMenu = (e, id) => { e.preventDefault(); setSelecionadoId(id); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, itemId: id }); };
  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, itemId: null });
  const bringToFront = () => { if (!contextMenu.itemId) return; setItensCanvas(prev => { const idx = prev.findIndex(i => i.uniqueId === contextMenu.itemId); if(idx < 0) return prev; const item = prev[idx]; const rest = prev.filter(i => i.uniqueId !== contextMenu.itemId); return [...rest, item]; }); closeContextMenu(); };
  const sendToBack = () => { if (!contextMenu.itemId) return; setItensCanvas(prev => { const idx = prev.findIndex(i => i.uniqueId === contextMenu.itemId); if(idx < 0) return prev; const item = prev[idx]; const rest = prev.filter(i => i.uniqueId !== contextMenu.itemId); return [item, ...rest]; }); closeContextMenu(); };
  const toggleLock = () => { if (!contextMenu.itemId) return; setItensCanvas(prev => prev.map(i => i.uniqueId === contextMenu.itemId ? { ...i, locked: !i.locked } : i)); closeContextMenu(); };
  const toggleCategory = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  const adicionarAoCanvas = (item) => {
    const novoItem = { ...item, type: 'image', uniqueId: `img_${Date.now()}`, x: 50, y: 50, width: 150, height: 150, rotation: 0, flipH: false, locked: false, opacity: 100, brightness: 100, contrast: 100, shadow: 0 };
    setItensCanvas(prev => [...prev, novoItem]); setSelecionadoId(novoItem.uniqueId); setAbaAtiva('efeitos');
  };

  const adicionarTexto = () => {
    const idUnico = `txt_${Date.now()}`;
    const itemTexto = { type: 'text', content: "Novo Texto", color: "#1e293b", fontSize: 32, fontFamily: "'Poppins', sans-serif", uniqueId: idUnico, x: 50, y: 50, width: 250, height: 60, rotation: 0, locked: false, opacity: 100, shadow: 0 };
    setItensCanvas(prev => [...prev, itemTexto]); setSelecionadoId(idUnico); setEditingTextId(idUnico);
  };

  const aplicarAoFundo = (valor) => {
    const estiloFinal = valor.startsWith('http') ? `url(${valor})` : valor;
    if (activeSurface === 'wall') setWallBackground(estiloFinal); else setFloorBackground(estiloFinal);
  };

  const handleClearProject = () => { 
      if (window.confirm("⚠️ Tem certeza que deseja limpar a tela?")) { 
          setItensCanvas([]); setWallBackground('#f1f5f9'); setFloorBackground('#e2e8f0'); 
      }
  };
  
  const handleExportImage = async () => { 
      if (!boardRef.current) return; 
      setSelecionadoId(null); 
      setTimeout(async () => { 
          const canvas = await html2canvas(boardRef.current, { useCORS: true, allowTaint: true, backgroundColor: null }); 
          const link = document.createElement('a'); 
          link.download = `Projeto_Agape.png`; 
          link.href = canvas.toDataURL(); 
          link.click(); 
      }, 200); 
  };

  const handlePointerDown = (e, id, type, dir = null) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    setSelecionadoId(id);
    
    if (!dir) {
        if (type === 'text') setAbaAtiva('texto'); else setAbaAtiva('efeitos');
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
            let newW = item.width; let newH = item.height;
            if (resizeDir.current.includes('e')) newW += adjDx;
            if (resizeDir.current.includes('s')) newH += adjDy;
            return { ...item, width: Math.max(30, newW), height: Math.max(30, newH) };
        }
      } return item;
    }));
  };

  const handlePointerUp = (e) => {
    try { e.target.releasePointerCapture(e.pointerId); } catch(err){}
    interactionMode.current = 'none';
    activeItemId.current = null;
    resizeDir.current = null;
  };
  
  const handleCanvasClick = () => {
      setSelecionadoId(null);
      setEditingTextId(null); 
      closeContextMenu();
  };

  const atualizarItem = (id, alt) => setItensCanvas(prev => prev.map(i => i.uniqueId === id ? { ...i, ...alt } : i));
  const deleteItem = (id) => { setItensCanvas(prev => prev.filter(i => i.uniqueId !== id)); setSelecionadoId(null); };

  const itemSelecionado = itensCanvas.find(i => i.uniqueId === selecionadoId);
  const getStyle = (valor) => (!valor ? { background: '#fff' } : valor.startsWith('url') ? { backgroundImage: valor, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: valor });

  return (
    <div className="studio-page" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onClick={handleCanvasClick}>
      
      {/* BARRA DE FERRAMENTAS */}
      <div className="studio-toolbar" onClick={e => e.stopPropagation()}>
        <div className="tool-logo"><Icons.Crown /></div>
        <div className={`tool-item ${abaAtiva === 'acervo' ? 'active' : ''}`} onClick={() => setAbaAtiva('acervo')}><Icons.Couch /><span>Acervo</span></div>
        <div className={`tool-item ${abaAtiva === 'texto' ? 'active' : ''}`} onClick={() => setAbaAtiva('texto')}><Icons.Type /><span>Texto</span></div>
        <div className={`tool-item ${abaAtiva === 'fundo' ? 'active' : ''}`} onClick={() => setAbaAtiva('fundo')}><Icons.Layers /><span>Cenário</span></div>
        <div className={`tool-item ${abaAtiva === 'efeitos' ? 'active' : ''}`} onClick={() => setAbaAtiva('efeitos')}><Icons.Magic /><span>Efeitos</span></div>
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
                           <div className="card-thumb"><img src={item.imagem || 'https://via.placeholder.com/120'} crossOrigin="anonymous" alt={item.nome} /></div>
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
                {itemSelecionado ? (
                    <div className="effects-tools">
                        <div className="selected-preview"><span>Editando: {itemSelecionado.nome || "Item"}</span></div>
                        {itemSelecionado.type === 'image' && (
                          <>
                            <div className="slider-group"><label>Brilho ({itemSelecionado.brightness}%)</label><input type="range" min="0" max="200" value={itemSelecionado.brightness || 100} onChange={e => atualizarItem(selecionadoId, {brightness: Number(e.target.value)})} /></div>
                            <div className="slider-group"><label>Contraste ({itemSelecionado.contrast}%)</label><input type="range" min="0" max="200" value={itemSelecionado.contrast || 100} onChange={e => atualizarItem(selecionadoId, {contrast: Number(e.target.value)})} /></div>
                          </>
                        )}
                        <div className="slider-group"><label>Opacidade ({itemSelecionado.opacity}%)</label><input type="range" min="10" max="100" value={itemSelecionado.opacity || 100} onChange={e => atualizarItem(selecionadoId, {opacity: Number(e.target.value)})} /></div>
                        <div className="slider-group"><label>Sombra ({itemSelecionado.shadow}px) {itemSelecionado.shadow === 0 && <small>(Off)</small>}</label><input type="range" min="0" max="50" value={itemSelecionado.shadow || 0} onChange={e => atualizarItem(selecionadoId, {shadow: Number(e.target.value)})} /></div>
                        <div className="action-buttons-grid">
                            <button className={`btn-secondary ${itemSelecionado.locked ? 'active' : ''}`} onClick={() => atualizarItem(selecionadoId, {locked: !itemSelecionado.locked})}>{itemSelecionado.locked ? <><Icons.Lock width={14} /> Bloqueado</> : <><Icons.Unlock width={14} /> Bloquear</>}</button>
                            <button className="btn-secondary" onClick={() => atualizarItem(selecionadoId, {flipH: !itemSelecionado.flipH})}><Icons.Flip width={14} /> Virar</button>
                        </div>
                        <button className="btn-danger-action" onClick={() => deleteItem(selecionadoId)}>Remover Item</button>
                    </div>
                ) : (<div className="empty-state-panel"><Icons.Magic style={{opacity: 0.2, width: 40, height: 40}} /><p>Selecione um item.</p></div>)}
            </div>
        )}

        {abaAtiva === 'texto' && (
             <div className="panel-content">
                <h3 className="panel-title">EDITOR DE TEXTO</h3>
                <div className="text-tools">
                    <button className="btn-primary-action" onClick={adicionarTexto}>+ Novo Texto</button>
                    {itemSelecionado?.type === 'text' ? (
                        <div className="edit-box">
                            <textarea value={itemSelecionado.content} onChange={e => atualizarItem(selecionadoId, {content: e.target.value})} rows={2} />
                            <select className="font-selector" value={itemSelecionado.fontFamily} onChange={e => atualizarItem(selecionadoId, {fontFamily: e.target.value})}>{fontesDisponiveis.map(f => <option key={f.nome} value={f.valor}>{f.nome}</option>)}</select>
                            <div className="style-row">
                                <button className={`btn-style ${itemSelecionado.fontWeight === 'bold' ? 'active' : ''}`} onClick={() => atualizarItem(selecionadoId, {fontWeight: itemSelecionado.fontWeight === 'bold' ? 'normal' : 'bold'})}><Icons.Bold /></button>
                                <button className={`btn-style ${itemSelecionado.fontStyle === 'italic' ? 'active' : ''}`} onClick={() => atualizarItem(selecionadoId, {fontStyle: itemSelecionado.fontStyle === 'italic' ? 'normal' : 'italic'})}><Icons.Italic /></button>
                                <div className="divider-v"></div>
                                <input type="color" className="color-input-mini" value={itemSelecionado.color} onChange={e => atualizarItem(selecionadoId, {color: e.target.value})} />
                            </div>
                            <input type="range" min="12" max="150" value={itemSelecionado.fontSize} onChange={e => atualizarItem(selecionadoId, {fontSize: Number(e.target.value)})} />
                        </div>
                    ) : <p className="hint-text">Selecione um texto.</p>}
                </div>
            </div>
        )}

        {abaAtiva === 'fundo' && (
             <div className="panel-content">
                <h3 className="panel-title">CENÁRIO</h3>
                <div className="surface-switcher"><button className={`switch-btn ${activeSurface === 'wall' ? 'active' : ''}`} onClick={() => setActiveSurface('wall')}>🧱 PAREDE</button><button className={`switch-btn ${activeSurface === 'floor' ? 'active' : ''}`} onClick={() => setActiveSurface('floor')}>🟧 CHÃO</button></div>
                
                <div className="bg-tools">
                    <div className="bg-options-grid">
                        {/* 🔥 NOVO SELETOR DE CORES INFINITAS (COLOR PICKER) 🔥 */}
                        <div className="bg-option-item color-picker-btn" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} title="Cor Personalizada">
                            <input type="color" 
                                   className="invisible-color-input"
                                   onChange={(e) => aplicarAoFundo(e.target.value)} 
                            />
                        </div>
                        {/* Cores Padrão */}
                        {paletaCores.map(c => <div key={c} className="bg-option-item" style={{backgroundColor: c}} onClick={() => aplicarAoFundo(c)} />)}
                    </div>
                    <div className="bg-presets-grid">{(activeSurface === 'wall' ? texturasParede : texturasChao).map((bg, idx) => <div key={idx} className="bg-preset-item" style={{backgroundImage: `url(${bg.url})`}} onClick={() => aplicarAoFundo(bg.url)}><span>{bg.nome}</span></div>)}</div>
                </div>
            </div>
        )}
      </div>

      {/* ÁREA DA PRANCHETA (AGORA MAIOR E MAIS LIMPA!) */}
      <div className="studio-canvas" onContextMenu={(e) => { e.preventDefault(); }}>
        
        {/* HEADER FLUTUANTE DE CONTROLES */}
        <div className="canvas-header-overlay" onClick={e => e.stopPropagation()}>
             <button className="btn-voltar-moodboard" onClick={() => navigate(-1)}>
                 ← <span className="btn-text">Voltar</span>
             </button>

             <div className="header-actions-group">
                 <button className="btn-header-action" onClick={handleAbrirListaProjetos}><Icons.Folder /> <span className="btn-text">Abrir</span></button>
                 <button className="btn-header-action" onClick={handleAbrirModalSalvar}><Icons.Save /> <span className="btn-text">Salvar</span></button>
                 <div className="header-divider"></div>
                 <button className="btn-header-action" onClick={handleClearProject}><Icons.Trash /> <span className="btn-text">Limpar</span></button>
                 <button className="btn-header-action primary" onClick={handleExportImage}><Icons.Download /> <span className="btn-text">Baixar</span></button>
             </div>
        </div>
        
        {/* 🔥 O QUADRO BRANCO RESPONSIVO 🔥 */}
        <div className="canvas-artboard" ref={boardRef}>
            <div className="canvas-layers">
                <div className="layer-wall" style={getStyle(wallBackground)}></div>
                <div className="layer-floor" style={getStyle(floorBackground)}></div>
            </div>
            
            {itensCanvas.map((item, index) => (
              <div key={item.uniqueId} className={`canvas-object ${selecionadoId === item.uniqueId ? 'selected' : ''} ${item.locked ? 'locked-item' : ''}`}
                style={{ 
                    left: item.x, top: item.y, width: item.width, height: item.height, zIndex: index + 10,
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
                
                {item.type === 'text' ? (
                    <div style={{ width:'100%', fontSize: `${item.fontSize}px`, color: item.color, fontFamily: item.fontFamily, fontWeight: item.fontWeight, fontStyle: item.fontStyle, textAlign: item.textAlign }}>{item.content}</div>
                ) : <img src={item.imagem} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} crossOrigin="anonymous" alt="" />}
                
                {selecionadoId === item.uniqueId && !item.locked && !editingTextId && (
                    <><div className="resize-handle se" onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'se')} /><div className="selection-border" /></>
                )}
              </div>
            ))}
        </div>

        {contextMenu.visible && (
            <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
                <div className="ctx-item" onClick={bringToFront}><Icons.Layers style={{transform: 'rotate(180deg)'}} /> Trazer p/ Frente</div>
                <div className="ctx-item" onClick={sendToBack}><Icons.Layers /> Enviar p/ Trás</div>
                <div className="ctx-divider"></div>
                <div className="ctx-item" onClick={toggleLock}><Icons.Lock /> {itensCanvas.find(i => i.uniqueId === contextMenu.itemId)?.locked ? 'Desbloquear' : 'Bloquear'}</div>
                <div className="ctx-divider"></div>
                <div className="ctx-item delete" onClick={() => { deleteItem(contextMenu.itemId); closeContextMenu(); }}><Icons.Trash /> Excluir</div>
            </div>
        )}

        {/* MODAIS */}
        {modalSalvarAberto && (
            <div className="modal-overlay">
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
            <div className="modal-overlay">
                <div className="modal-content large">
                    <h3>Projetos Salvos</h3>
                    <div className="projects-list">
                        {projetosSalvos.length === 0 ? <p>Nenhum projeto salvo.</p> : projetosSalvos.map(proj => (
                            <div key={proj.id} className="project-item-row">
                                <span onClick={() => carregarProjeto(proj)}>{proj.nome}</span>
                                <button onClick={() => deletarProjetoSalvo(proj.id)} className="btn-icon-del"><Icons.Trash /></button>
                            </div>
                        ))}
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