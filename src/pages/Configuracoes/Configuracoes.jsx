import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import './Configuracoes.css';

const Configuracoes = () => {
  const [abaAtiva, setAbaAtiva] = useState('aparencia');
  
  // Estados Visuais (Salvos no navegador)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'padrao');
  
  const [config, setConfig] = useState({
    categorias: [],
    subcategorias: {},
    localizacoes: [],
    tamanhos: [],
    metaFaturamento: 5000,
    nomeEmpresa: 'Ágape Decorações',
    cnpj: '',
    telefone: '',
    emailEmpresa: '',
    endereco: '',
    instagram: '', // Novo campo
    logotipo: ''   // Novo campo
  });
  const [loading, setLoading] = useState(true);

  // Estados dos inputs de listas
  const [inputCat, setInputCat] = useState('');
  const [inputSub, setInputSub] = useState('');
  const [inputLoc, setInputLoc] = useState('');
  const [inputTam, setInputTam] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');

  // Aplica o tema e a fonte globalmente
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', fontSize);
  }, [theme, fontSize]);

  useEffect(() => {
    buscarConfiguracoes();
  }, []);

  const buscarConfiguracoes = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "sistema", "parametros");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setConfig({ ...config, ...docSnap.data() });
      else await setDoc(docRef, config);
    } catch (e) { console.error("Erro ao buscar configs:", e); }
    setLoading(false);
  };

  // --- FUNÇÕES DE LISTAS (ESTOQUE) ---
  const adicionarItem = async (campo, valor, subPath = null) => {
    if (!valor) return;
    const docRef = doc(db, "sistema", "parametros");
    try {
      if (subPath) {
        const novasSub = { ...config.subcategorias };
        if (!novasSub[subPath]) novasSub[subPath] = [];
        novasSub[subPath].push(valor);
        await updateDoc(docRef, { subcategorias: novasSub });
        setInputSub('');
      } else {
        await updateDoc(docRef, { [campo]: arrayUnion(valor) });
        if(campo === 'categorias') setInputCat('');
        if(campo === 'localizacoes') setInputLoc('');
        if(campo === 'tamanhos') setInputTam('');
      }
      buscarConfiguracoes();
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

  // --- FUNÇÕES DA EMPRESA E UPLOAD DE LOGO ---
  const handleConfigChange = (campo, valor) => {
    setConfig(prev => ({ ...prev, [campo]: valor }));
  };

  const salvarConfigTextual = async (campo, valor) => {
    try {
      const docRef = doc(db, "sistema", "parametros");
      await updateDoc(docRef, { [campo]: valor });
    } catch (error) {
      console.error("Erro ao salvar dado da empresa:", error);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        // Redimensiona o logo para não pesar o banco de dados (Max 400px)
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
          const docRef = doc(db, "sistema", "parametros");
          await updateDoc(docRef, { logotipo: base64Logo });
        } catch (error) { console.error("Erro ao salvar logo:", error); }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removerLogo = async () => {
    if(!window.confirm("Remover logotipo?")) return;
    setConfig(prev => ({ ...prev, logotipo: '' }));
    try {
      const docRef = doc(db, "sistema", "parametros");
      await updateDoc(docRef, { logotipo: '' });
    } catch (error) { console.error("Erro ao remover logo:", error); }
  };

  if (loading) return <div className="loading-config" style={{padding: '40px'}}>Sincronizando Celebre...</div>;

  return (
    <div className="config-container fade-in">
      <div className="dashboard-header">
          <h1>CONFIGURAÇÕES</h1>
          <p>Painel de controle da Ágape Decorações</p>
      </div>

      <div className="config-layout">
        <aside className="config-menu">
          <button className={abaAtiva === 'aparencia' ? 'active' : ''} onClick={() => setAbaAtiva('aparencia')}>🎨 Aparência Visual</button>
          <button className={abaAtiva === 'listas' ? 'active' : ''} onClick={() => setAbaAtiva('listas')}>📦 Configuração pág. Estoque</button>
          <button className={abaAtiva === 'empresa' ? 'active' : ''} onClick={() => setAbaAtiva('empresa')}>🏢 Minha Empresa</button>
        </aside>

        <main className="config-content">
          
          {/* ================================== ABA APARÊNCIA ================================== */}
          {abaAtiva === 'aparencia' && (
            <>
              <div className="main-card theme-section">
                <h3>🎨 Cores do Sistema</h3>
                <p>Escolha o modo que melhor se adapta à sua visão.</p>
                <div className="theme-switch-container">
                  <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>☀️ Modo Diurno</button>
                  <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>🌙 Modo Noturno</button>
                </div>
              </div>

              <div className="main-card theme-section">
                <h3>👓 Acessibilidade de Leitura</h3>
                <p>Ajuste o tamanho da tela para uma leitura mais confortável.</p>
                <div className="theme-switch-container">
                  <button className={`theme-btn ${fontSize === 'padrao' ? 'active' : ''}`} onClick={() => setFontSize('padrao')}>
                    <span style={{fontSize: '14px'}}>Aa</span> Tamanho Padrão
                  </button>
                  <button className={`theme-btn ${fontSize === 'ampliado' ? 'active' : ''}`} onClick={() => setFontSize('ampliado')}>
                    <span style={{fontSize: '20px'}}>Aa</span> Tamanho Ampliado
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ================================== ABA LISTAS ================================== */}
          {abaAtiva === 'listas' && (
            <div className="config-grid-inner">
              <div className="main-card config-section">
                <h3>🏷️ Categorias</h3>
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

              <div className="main-card config-section">
                <h3>📂 Subcategorias {categoriaSelecionada && `de "${categoriaSelecionada}"`}</h3>
                {!categoriaSelecionada ? <div className="empty-state">Selecione uma categoria ao lado.</div> : (
                  <>
                    <div className="add-item-box">
                      <input type="text" placeholder="Nova subcategoria..." value={inputSub} onChange={(e) => setInputSub(e.target.value)} />
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

              <div className="main-card config-section">
                <h3>📍 Localizações de Estoque</h3>
                <div className="add-item-box">
                  <input type="text" placeholder="Nova localização..." value={inputLoc} onChange={(e) => setInputLoc(e.target.value)} />
                  <button className="btn-add" onClick={() => adicionarItem('localizacoes', inputLoc)}>Add</button>
                </div>
                <ul className="config-list">
                  {config.localizacoes?.map(loc => (
                    <li key={loc}>
                      {loc} <span className="del-icon" onClick={() => removerItem('localizacoes', loc)}>🗑️</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="main-card config-section">
                <h3>📏 Especificações (Tamanhos)</h3>
                <div className="add-item-box">
                  <input type="text" placeholder="Novo tamanho..." value={inputTam} onChange={(e) => setInputTam(e.target.value)} />
                  <button className="btn-add" onClick={() => adicionarItem('tamanhos', inputTam)}>Add</button>
                </div>
                <ul className="config-list">
                  {config.tamanhos?.map(tam => (
                    <li key={tam}>
                      {tam} <span className="del-icon" onClick={() => removerItem('tamanhos', tam)}>🗑️</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ================================== ABA EMPRESA ================================== */}
          {abaAtiva === 'empresa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div className="main-card">
                <h3>🏢 Detalhes da Empresa</h3>
                <p>Estas informações aparecerão no cabeçalho de orçamentos e recibos.</p>
                
                {/* UPLOAD DE LOGO */}
                <div className="logo-upload-container">
                  <div className="logo-preview-box">
                    {config.logotipo ? (
                      <img src={config.logotipo} alt="Logo Empresa" />
                    ) : (
                      <span style={{opacity: 0.3, fontSize: '30px'}}>🖼️</span>
                    )}
                  </div>
                  <div className="logo-actions">
                    <label className="btn-upload-logo">
                      Upload Nova Logo
                      <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleLogoUpload} />
                    </label>
                    {config.logotipo && (
                      <button className="btn-remove-logo" onClick={removerLogo}>Remover</button>
                    )}
                    <p style={{fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '8px'}}>Formatos recomendados: PNG ou JPG. Fundo transparente.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div className="form-group-config">
                    <label>Nome Fantasia / Razão Social</label>
                    <input 
                      type="text" 
                      value={config.nomeEmpresa || ''} 
                      onChange={(e) => handleConfigChange('nomeEmpresa', e.target.value)}
                      onBlur={(e) => salvarConfigTextual('nomeEmpresa', e.target.value)}
                      placeholder="Ex: Ágape Decorações"
                    />
                  </div>
                  <div className="form-group-config">
                    <label>CNPJ / CPF</label>
                    <input 
                      type="text" 
                      value={config.cnpj || ''} 
                      onChange={(e) => handleConfigChange('cnpj', e.target.value)}
                      onBlur={(e) => salvarConfigTextual('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="form-group-config">
                    <label>WhatsApp Comercial</label>
                    <input 
                      type="text" 
                      value={config.telefone || ''} 
                      onChange={(e) => handleConfigChange('telefone', e.target.value)}
                      onBlur={(e) => salvarConfigTextual('telefone', e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="form-group-config">
                    <label>E-mail de Contato</label>
                    <input 
                      type="email" 
                      value={config.emailEmpresa || ''} 
                      onChange={(e) => handleConfigChange('emailEmpresa', e.target.value)}
                      onBlur={(e) => salvarConfigTextual('emailEmpresa', e.target.value)}
                      placeholder="contato@empresa.com"
                    />
                  </div>
                  <div className="form-group-config" style={{ gridColumn: '1 / -1' }}>
                    <label>Endereço Completo (Sede / Galpão)</label>
                    <input 
                      type="text" 
                      value={config.endereco || ''} 
                      onChange={(e) => handleConfigChange('endereco', e.target.value)}
                      onBlur={(e) => salvarConfigTextual('endereco', e.target.value)}
                      placeholder="Rua, Número, Bairro - Cidade / UF"
                    />
                  </div>
                  {/* NOVO CAMPO DE INSTAGRAM */}
                  <div className="form-group-config" style={{ gridColumn: '1 / -1' }}>
                    <label>Instagram da Empresa</label>
                    <input 
                      type="text" 
                      value={config.instagram || ''} 
                      onChange={(e) => handleConfigChange('instagram', e.target.value)}
                      onBlur={(e) => salvarConfigTextual('instagram', e.target.value)}
                      placeholder="Ex: @agapedecoracoes"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO: METAS */}
              <div className="main-card">
                <h3>🎯 Metas de Faturamento</h3>
                <p>Defina seu alvo mensal para acompanhar o progresso no Dashboard.</p>
                <div className="form-group-config">
                  <label>Sua Meta Mensal (R$)</label>
                  <input 
                    type="number" 
                    value={config.metaFaturamento || ''} 
                    onChange={(e) => handleConfigChange('metaFaturamento', e.target.value)}
                    onBlur={(e) => salvarConfigTextual('metaFaturamento', Number(e.target.value))}
                    style={{fontSize: '20px', fontWeight: '800', color: 'var(--dourado)', borderColor: 'var(--dourado)', maxWidth: '300px'}}
                  />
                </div>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default Configuracoes;