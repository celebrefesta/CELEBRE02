import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import './Configuracoes.css';

const Configuracoes = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [config, setConfig] = useState({
    categorias: [],
    subcategorias: {},
    localizacoes: [],
    tamanhos: []
  });
  const [loading, setLoading] = useState(true);

  // Estados independentes para cada campo de busca/adição
  const [inputCat, setInputCat] = useState('');
  const [inputSub, setInputSub] = useState('');
  const [inputLoc, setInputLoc] = useState('');
  const [inputTam, setInputTam] = useState('');
  
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    buscarConfiguracoes();
  }, [theme]);

  const buscarConfiguracoes = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "sistema", "parametros");
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setConfig(docSnap.data());
      } else {
        // Se o documento não existir no Firebase, criamos ele vazio
        await setDoc(docRef, { categorias: [], subcategorias: {}, localizacoes: [], tamanhos: [] });
      }
    } catch (e) { console.error("Erro ao buscar configs:", e); }
    setLoading(false);
  };

  const adicionarItem = async (campo, valor, subPath = null) => {
    if (!valor) return;
    const docRef = doc(db, "sistema", "parametros");
    try {
      if (subPath) {
        const novasSub = { ...config.subcategorias };
        if (!novasSub[subPath]) novasSub[subPath] = [];
        novasSub[subPath].push(valor);
        await updateDoc(docRef, { subcategorias: novasSub });
        setInputSub(''); // Limpa apenas o campo de subcategoria
      } else {
        await updateDoc(docRef, { [campo]: arrayUnion(valor) });
        // Limpa o campo específico que foi preenchido
        if(campo === 'categorias') setInputCat('');
        if(campo === 'localizacoes') setInputLoc('');
        if(campo === 'tamanhos') setInputTam('');
      }
      buscarConfiguracoes(); // Recarrega a lista do Firebase
    } catch (e) { alert("Erro ao adicionar."); }
  };

  const removerItem = async (campo, valor, subPath = null) => {
    if (!window.confirm(`Remover "${valor}"?`)) return;
    const docRef = doc(db, "sistema", "parametros");
    try {
      if (subPath) {
        const novasSub = { ...config.subcategorias };
        novasSub[subPath] = novasSub[subPath].filter(i => i !== valor);
        await updateDoc(docRef, { subcategorias: novasSub });
      } else {
        await updateDoc(docRef, { [campo]: arrayRemove(valor) });
      }
      buscarConfiguracoes();
    } catch (e) { alert("Erro ao remover."); }
  };

  if (loading) return <div className="loading-config">Sincronizando com o Firebase...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-text">
          <h1>CONFIGURAÇÕES DO SISTEMA</h1>
          <p>Gerencie as listas que aparecem no cadastro de itens e a aparência do Celebre.</p>
        </div>
      </div>

      {/* --- PERSONALIZAÇÃO --- */}
      <div className="main-card theme-section">
        <h3>🎨 Aparência</h3>
        <div className="theme-switch-container">
          <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>☀️ Modo Diurno</button>
          <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>🌙 Modo Noturno</button>
        </div>
      </div>

      <div className="config-grid">
        {/* CATEGORIAS */}
        <div className="main-card config-section">
          <h3>📦 Categorias</h3>
          <div className="add-item-box">
            <input type="text" placeholder="Nova categoria..." value={inputCat} onChange={(e) => setInputCat(e.target.value)} />
            <button className="btn-add" onClick={() => adicionarItem('categorias', inputCat)}>Add</button>
          </div>
          <ul className="config-list">
            {config.categorias?.map(cat => (
              <li key={cat} onClick={() => setCategoriaSelecionada(cat)} className={categoriaSelecionada === cat ? 'active' : ''}>
                {cat} <span className="del-icon" onClick={(e) => {e.stopPropagation(); removerItem('categorias', cat)}}>🗑️</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SUBCATEGORIAS */}
        <div className="main-card config-section">
          <h3>📂 Subcategorias {categoriaSelecionada && `de ${categoriaSelecionada}`}</h3>
          {!categoriaSelecionada ? (
            <div className="empty-state">Selecione uma categoria para gerenciar suas subcategorias.</div>
          ) : (
            <>
              <div className="add-item-box">
                <input type="text" placeholder="Nova sub..." value={inputSub} onChange={(e) => setInputSub(e.target.value)} />
                <button className="btn-add" onClick={() => adicionarItem('subcategorias', inputSub, categoriaSelecionada)}>Add</button>
              </div>
              <ul className="config-list">
                {config.subcategorias[categoriaSelecionada]?.map(sub => (
                  <li key={sub}>{sub} <span className="del-icon" onClick={() => removerItem('subcategorias', sub, categoriaSelecionada)}>🗑️</span></li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* LOCALIZAÇÕES */}
        <div className="main-card config-section">
          <h3>📍 Localizações</h3>
          <div className="add-item-box">
            <input type="text" placeholder="Ex: Galpão A, Prateleira 2..." value={inputLoc} onChange={(e) => setInputLoc(e.target.value)} />
            <button className="btn-add" onClick={() => adicionarItem('localizacoes', inputLoc)}>Add</button>
          </div>
          <ul className="config-list">
            {config.localizacoes?.map(loc => (
              <li key={loc}>{loc} <span className="del-icon" onClick={() => removerItem('localizacoes', loc)}>🗑️</span></li>
            ))}
          </ul>
        </div>

        {/* TAMANHOS */}
        <div className="main-card config-section">
          <h3>📏 Tamanhos</h3>
          <div className="add-item-box">
            <input type="text" placeholder="Ex: P, M, G, 2x2m..." value={inputTam} onChange={(e) => setInputTam(e.target.value)} />
            <button className="btn-add" onClick={() => adicionarItem('tamanhos', inputTam)}>Add</button>
          </div>
          <ul className="config-list">
            {config.tamanhos?.map(tam => (
              <li key={tam}>{tam} <span className="del-icon" onClick={() => removerItem('tamanhos', tam)}>🗑️</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;