import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import html2canvas from 'html2canvas'; 
import './Moodboard.css';

// Ícones SVG
const Icons = {
  Crown: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>,
  Couch: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20v8H2zm0 0l2-6h16l2 6M6 16v4m12-4v4"/></svg>,
  Type: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>,
  Layers: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>,
  Minus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>,
  Trash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Front: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 8h12v12H8zM4 4h12v4H4z"/></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h12v12H4zM8 8h12v4H8z"/></svg>,
  FlipH: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v-2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M12 4v16M4 12l4-4m-4 4l4 4m12-4l-4-4m4 4l-4 4"/></svg>,
  Bold: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>,
  Italic: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>,
  Upload: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
};

const Moodboard = () => {
  const [estoqueReal, setEstoqueReal] = useState([]);
  const [itensCanvas, setItensCanvas] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('acervo'); 
  const [editingTextId, setEditingTextId] = useState(null);
  const [canvasBackground, setCanvasBackground] = useState(null); 
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, itemId: null });

  const interactionMode = useRef('none');
  const activeItemId = useRef(null);
  const resizeDir = useRef('');

  const fontesDisponiveis = [
    { nome: 'Moderna (Padrão)', valor: "'Poppins', sans-serif" },
    { nome: 'Elegante (Serifa)', valor: "'Playfair Display', serif" },
    { nome: 'Manuscrita (Convite)', valor: "'Dancing Script', cursive" },
  ];

  const fundosProntos = [
    { nome: 'Chácara', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1932&auto=format&fit=crop' },
    { nome: 'Tijolinho', url: 'https://images.unsplash.com/photo-1456315138460-858d1089dd7f?q=80&w=2070&auto=format&fit=crop' },
  ];

  useEffect(() => {
    const carregar = async () => {
      try {
        const q = query(collection(db, 'estoque'), orderBy('criadoEm', 'desc'));
        const snap = await getDocs(q);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (lista && lista.length) {
          const norm = lista.map(i => ({ ...i, imagem: i.foto || i.imagem || (i.fotos && i.fotos.length ? i.fotos[0] : '') }));
          setEstoqueReal(norm);
          return;
        }
      } catch (err) {
        // se Firestore falhar, cairemos para localStorage
        console.debug('Moodboard: erro ao buscar estoque no Firestore, usando localStorage', err);
      }

      const dadosLocal = JSON.parse(localStorage.getItem('estoque')) || [];
      const dadosAntigos = JSON.parse(localStorage.getItem('celebre_estoque')) || [];
      const origem = dadosLocal.length ? dadosLocal : dadosAntigos;
      const normalizados = origem.map(i => ({ ...i, imagem: i.foto || i.imagem || (i.fotos && i.fotos.length ? i.fotos[0] : '') }));
      setEstoqueReal(normalizados);
    };
    carregar();
  }, []);

  const adicionarAoCanvas = (item) => {
    const novoItem = { ...item, type: 'image', uniqueId: `img_${Date.now()}`, x: 350, y: 250, width: 120, height: 120, flipH: false, opacity: 1 };
    setItensCanvas((prev) => [...prev, novoItem]); setSelecionadoId(novoItem.uniqueId);
  };

  const adicionarTexto = () => {
    const idUnico = `txt_${Date.now()}`;
    const itemTexto = { type: 'text', content: "Seu Texto Aqui", color: "#000000", fontSize: 32, fontFamily: "'Poppins', sans-serif", fontWeight: 'normal', fontStyle: 'normal', uniqueId: idUnico, x: 300, y: 250, width: 300, height: 60, flipH: false, opacity: 1 };
    setItensCanvas((prev) => [...prev, itemTexto]); setSelecionadoId(idUnico); setEditingTextId(idUnico);
  };

  const handleClearProject = () => {
    if (window.confirm("Apagar projeto atual?")) { setItensCanvas([]); setCanvasBackground(null); setSelecionadoId(null); }
  };

  const handleExportImage = async () => {
    if (!canvasRef.current) return;
    setSelecionadoId(null);
    setTimeout(async () => {
        const canvas = await html2canvas(canvasRef.current, { useCORS: true, ignoreElements: (el) => el.classList.contains('canvas-header-overlay') });
        const link = document.createElement('a');
        link.download = 'projeto.png'; link.href = canvas.toDataURL(); link.click();
    }, 200);
  };

  const handleItemMouseDown = (e, id, type) => {
    e.stopPropagation(); setSelecionadoId(id);
    if (type === 'text') setAbaAtiva('texto');
    if (id !== editingTextId) { interactionMode.current = 'drag'; activeItemId.current = id; }
  };

  const handleContextMenu = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    setSelecionadoId(id);
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, itemId: id });
  };

  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, itemId: null });

  const bringToFront = (id) => {
    setItensCanvas(prev => {
      const idx = prev.findIndex(i => i.uniqueId === id);
      if (idx === -1) return prev;
      const item = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      return [...rest, item];
    });
    closeContextMenu();
  };

  const sendToBack = (id) => {
    setItensCanvas(prev => {
      const idx = prev.findIndex(i => i.uniqueId === id);
      if (idx === -1) return prev;
      const item = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      return [item, ...rest];
    });
    closeContextMenu();
  };

  const deleteItem = (id) => {
    setItensCanvas(prev => prev.filter(i => i.uniqueId !== id));
    setSelecionadoId(null);
    closeContextMenu();
  };

  const handleResizeMouseDown = (e, id, dir) => { e.stopPropagation(); interactionMode.current = 'resize'; resizeDir.current = dir; activeItemId.current = id; };

  const handleMouseMove = (e) => {
    if (interactionMode.current === 'none' || !activeItemId.current) return;
    setItensCanvas((prev) => prev.map((item) => {
      if (item.uniqueId === activeItemId.current) {
        if (interactionMode.current === 'drag') return { ...item, x: item.x + e.movementX, y: item.y + e.movementY };
        if (interactionMode.current === 'resize') {
            let newW = item.width; let newH = item.height;
            if (resizeDir.current.includes('e')) newW += e.movementX;
            if (resizeDir.current.includes('s')) newH += e.movementY;
            return { ...item, width: Math.max(30, newW), height: Math.max(30, newH) };
        }
      } return item;
    }));
  };

  const handleMouseUp = () => { interactionMode.current = 'none'; activeItemId.current = null; };
  const atualizarItem = (id, alt) => setItensCanvas(prev => prev.map(i => i.uniqueId === id ? { ...i, ...alt } : i));
  const executarAcao = (acao) => {
    const item = itensCanvas.find(i => i.uniqueId === selecionadoId);
    let lista = [...itensCanvas]; const index = lista.findIndex(i => i.uniqueId === selecionadoId);
    if (acao === 'remover') { lista.splice(index, 1); setItensCanvas(lista); setSelecionadoId(null); }
    if (acao === 'frente') { lista.splice(index, 1); lista.push(item); setItensCanvas(lista); }
    if (acao === 'tras') { lista.splice(index, 1); lista.unshift(item); setItensCanvas(lista); }
  };

  const itemSelecionado = itensCanvas.find(i => i.uniqueId === selecionadoId);
  const canvasStyle = canvasBackground ? (canvasBackground.startsWith('url') ? { background: canvasBackground } : { backgroundColor: canvasBackground }) : {};

  return (
    <div className="studio-page" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={() => setSelecionadoId(null)}>
      <div className="studio-toolbar" onClick={e => e.stopPropagation()}>
        <div className="tool-logo"><Icons.Crown /></div>
        <div className={`tool-item ${abaAtiva === 'acervo' ? 'active' : ''}`} onClick={() => setAbaAtiva('acervo')}><Icons.Couch /></div>
        <div className={`tool-item ${abaAtiva === 'texto' ? 'active' : ''}`} onClick={() => setAbaAtiva('texto')}><Icons.Type /></div>
        <div className={`tool-item ${abaAtiva === 'fundo' ? 'active' : ''}`} onClick={() => setAbaAtiva('fundo')}><Icons.Layers /></div>
      </div>

      <div className="studio-panel" onClick={e => e.stopPropagation()}>
        {abaAtiva === 'acervo' && (
            <div className="acervo-list-scroll">
                {estoqueReal.map(item => (
                  <div key={item.id} className="acervo-item-row" onClick={() => adicionarAoCanvas(item)}>
                    <div className="item-thumb"><img src={item.imagem || 'https://via.placeholder.com/120?text=Sem+Imagem'} alt={item.nome} /></div>
                    <strong>{item.nome}</strong>
                  </div>
                ))}
            </div>
        )}
        {abaAtiva === 'texto' && (
            <div className="text-tools">
                {itemSelecionado?.type === 'text' ? (
                    <><h3>Editar Texto</h3><textarea value={itemSelecionado.content} onChange={e => atualizarItem(selecionadoId, {content: e.target.value})} /><button className="btn-add-text danger" onClick={() => executarAcao('remover')}>EXCLUIR</button></>
                ) : <button className="btn-add-text" onClick={adicionarTexto}>+ TEXTO</button>}
            </div>
        )}
        {abaAtiva === 'fundo' && (
            <div className="bg-tools">
                <div className="bg-options-grid">{['#ffffff', '#fee2e2', '#dbeafe'].map(c => <div key={c} className="bg-option-item" style={{backgroundColor: c}} onClick={() => setCanvasBackground(c)} />)}</div>
                <div className="bg-presets-grid">{fundosProntos.map((bg, idx) => <div key={idx} className="bg-preset-item" style={{backgroundImage: `url(${bg.url})`}} onClick={() => setCanvasBackground(`url(${bg.url}) no-repeat center/cover`)} />)}</div>
            </div>
        )}
      </div>

      <div className="studio-canvas" ref={canvasRef} style={canvasStyle}>
        <div className="canvas-header-overlay">
             <button className="btn-header-action danger" onClick={handleClearProject}><Icons.Trash /> Limpar</button>
             <button className="btn-header-action success" onClick={handleExportImage}><Icons.Download /> Baixar</button>
        </div>
        {itensCanvas.map((item, index) => (
          <div key={item.uniqueId} className={`canvas-object ${selecionadoId === item.uniqueId ? 'selected' : ''}`}
            style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: index, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseDown={e => handleItemMouseDown(e, item.uniqueId, item.type)} onClick={e => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); if (item.type === 'text') setEditingTextId(item.uniqueId); }} onContextMenu={e => handleContextMenu(e, item.uniqueId)}>
            {item.type === 'text' ? (
                editingTextId === item.uniqueId ? <textarea className="text-editor-input" value={item.content} onChange={e => atualizarItem(item.uniqueId, {content: e.target.value})} autoFocus onBlur={() => setEditingTextId(null)} style={{fontSize: `${item.fontSize}px`, color: item.color, background: 'transparent', border: 'none', textAlign: 'center'}} />
                : <div style={{ fontSize: `${item.fontSize}px`, color: item.color, fontFamily: item.fontFamily }}>{item.content}</div>
            ) : <img src={item.imagem} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            {selecionadoId === item.uniqueId && !editingTextId && <><div className="resize-handle se" onMouseDown={e => handleResizeMouseDown(e, item.uniqueId, 'se')} /><div className="selection-border" /></>}
          </div>
        ))}
        {contextMenu.visible && (
          <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', zIndex: 9999 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => bringToFront(contextMenu.itemId)}>Trazer para frente</div>
            <div style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => sendToBack(contextMenu.itemId)}>Enviar para trás</div>
            <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
            <div style={{ padding: '8px 12px', cursor: 'pointer', color: '#c92a2a' }} onClick={() => deleteItem(contextMenu.itemId)}>Excluir</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Moodboard;