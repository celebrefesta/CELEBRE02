import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas'; // 🔥 IMPORTAÇÃO DO CANVAS ADICIONADA
import './Configuracoes.css';

const Configuracoes = () => {
  const [abaAtiva, setAbaAtiva] = useState('empresa'); 
  
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'padrao');
  
  // 🔥 REFERÊNCIA PARA A ASSINATURA
  const sigGlobal = useRef({});

  const [config, setConfig] = useState({
    categorias: [], subcategorias: {}, localizacoes: [], tamanhos: [],
    gruposTema: [], temasPorGrupo: {},
    nomeEmpresa: '', cnpj: '', telefone: '', emailEmpresa: '',
    endereco: '', instagram: '', logotipo: '', slogan: '', site: '',
    assinatura: '' // 🔥 CAMPO NOVO ADICIONADO AQUI
  });
  const [loading, setLoading] = useState(true);

  const [inputCat, setInputCat] = useState(''); const [inputSub, setInputSub] = useState('');
  const [inputLoc, setInputLoc] = useState(''); const [inputTam, setInputTam] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [inputGrupoTema, setInputGrupoTema] = useState(''); const [inputTema, setInputTema] = useState('');
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', fontSize);
  }, [theme, fontSize]);

  useEffect(() => { buscarConfiguracoes(); }, []);

  const buscarConfiguracoes = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "sistema", "parametros");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dados = docSnap.data();
        setConfig(prev => ({
          ...prev, ...dados,
          gruposTema: dados.gruposTema || [], temasPorGrupo: dados.temasPorGrupo || {}
        }));
      } else { await setDoc(docRef, config); }
    } catch (e) { console.error("Erro:", e); }
    setLoading(false);
  };

  const adicionarItem = async (campo, valor, subPath = null) => {
    if (!valor) return;
    const docRef = doc(db, "sistema", "parametros");
    try {
      if (subPath) {
        const objetoAtual = { ...config[campo] };
        if (!objetoAtual[subPath]) objetoAtual[subPath] = [];
        objetoAtual[subPath].push(valor);
        await updateDoc(docRef, { [campo]: objetoAtual });
        if (campo === 'subcategorias') setInputSub('');
        if (campo === 'temasPorGrupo') setInputTema('');
      } else {
        await updateDoc(docRef, { [campo]: arrayUnion(valor) });
        if(campo === 'categorias') setInputCat(''); if(campo === 'localizacoes') setInputLoc('');
        if(campo === 'tamanhos') setInputTam(''); if(campo === 'gruposTema') setInputGrupoTema('');
      }
      buscarConfiguracoes();
    } catch (e) { alert("Erro ao adicionar."); }
  };

  const removerItem = async (campo, valor, subPath = null) => {
    if (!window.confirm(`Remover "${valor}"?`)) return;
    const docRef = doc(db, "sistema", "parametros");
    try {
      if (subPath) {
        const objetoAtual = { ...config[campo] };
        objetoAtual[subPath] = objetoAtual[subPath].filter(i => i !== valor);
        await updateDoc(docRef, { [campo]: objetoAtual });
      } else { await updateDoc(docRef, { [campo]: arrayRemove(valor) }); }
      buscarConfiguracoes();
    } catch (e) { alert("Erro ao remover."); }
  };

  const handleConfigChange = (campo, valor) => setConfig(prev => ({ ...prev, [campo]: valor }));
  const salvarConfigTextual = async (campo, valor) => {
    try { await updateDoc(doc(db, "sistema", "parametros"), { [campo]: valor }); } catch (e) { console.error(e); }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas'); const MAX_SIZE = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
        else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        const base64Logo = canvas.toDataURL('image/png', 0.9);
        setConfig(prev => ({ ...prev, logotipo: base64Logo }));
        try { await updateDoc(doc(db, "sistema", "parametros"), { logotipo: base64Logo }); } catch (e) { console.error(e); }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removerLogo = async () => {
    if(!window.confirm("Remover logotipo?")) return;
    setConfig(prev => ({ ...prev, logotipo: '' }));
    try { await updateDoc(doc(db, "sistema", "parametros"), { logotipo: '' }); } catch (e) { console.error(e); }
  };

  // 🔥 FUNÇÕES DA ASSINATURA GLOBAL 🔥
  const limparAssinatura = () => { if(sigGlobal.current) sigGlobal.current.clear(); };

  const salvarAssinaturaGlobal = async () => {
    if (sigGlobal.current.isEmpty()) {
      alert("⚠️ Por favor, desenhe sua assinatura antes de salvar.");
      return;
    }
    const base64Sig = sigGlobal.current.getCanvas().toDataURL("image/png");
    setConfig(prev => ({ ...prev, assinatura: base64Sig }));
    
    try {
      await updateDoc(doc(db, "sistema", "parametros"), { assinatura: base64Sig });
      alert("✅ Assinatura padrão salva com sucesso! Ela será usada em todos os novos contratos.");
    } catch (e) {
      alert("❌ Erro ao salvar assinatura.");
      console.error(e);
    }
  };

  const removerAssinaturaGlobal = async () => {
    if(!window.confirm("Tem certeza que deseja apagar a assinatura padrão do sistema?")) return;
    setConfig(prev => ({ ...prev, assinatura: '' }));
    try {
      await updateDoc(doc(db, "sistema", "parametros"), { assinatura: '' });
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="loading-config">Carregando painel de controle...</div>;

  return (
    <div className="config-container fade-in">
      <header className="config-header-top">
        <div className="header-titles">
          <h1>Configurações do Sistema</h1>
          <p>Painel de controle geral da {config.nomeEmpresa || 'sua empresa'}</p>
        </div>
      </header>

      <nav className="config-top-tabs">
        <button className={abaAtiva === 'listas' ? 'active' : ''} onClick={() => setAbaAtiva('listas')}>📦 Tabelas e Estoque</button>
        <button className={abaAtiva === 'empresa' ? 'active' : ''} onClick={() => setAbaAtiva('empresa')}>🏢 Dados da Empresa</button>
        <button className={abaAtiva === 'aparencia' ? 'active' : ''} onClick={() => setAbaAtiva('aparencia')}>🎨 Aparência</button>
      </nav>

      <main className="config-main-area">
        
        {abaAtiva === 'listas' && (
          <div className="config-grid-columns">
            <div className="config-col">
              <div className="config-card">
                <div className="card-top-bar blue-bar"></div>
                <h3>🏷️ Categorias de Produto</h3>
                <div className="add-item-box">
                  <input type="text" placeholder="Nova categoria..." value={inputCat} onChange={(e) => setInputCat(e.target.value)} />
                  <button className="btn-add" onClick={() => adicionarItem('categorias', inputCat)}>Add</button>
                </div>
                <ul className="config-list">
                  {config.categorias?.map(cat => (
                    <li key={cat} onClick={() => setCategoriaSelecionada(cat)} className={categoriaSelecionada === cat ? 'active' : ''}>
                      {cat} <span className="del-icon" onClick={(e) => {e.stopPropagation(); removerItem('categorias', cat)}}>✕</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="config-card">
                <div className="card-top-bar blue-bar"></div>
                <h3>📂 Subcategorias {categoriaSelecionada && `de "${categoriaSelecionada}"`}</h3>
                {!categoriaSelecionada ? <div className="empty-state">Selecione uma categoria acima.</div> : (
                  <>
                    <div className="add-item-box">
                      <input type="text" placeholder="Nova subcategoria..." value={inputSub} onChange={(e) => setInputSub(e.target.value)} />
                      <button className="btn-add" onClick={() => adicionarItem('subcategorias', inputSub, categoriaSelecionada)}>Add</button>
                    </div>
                    <ul className="config-list">
                      {config.subcategorias[categoriaSelecionada]?.map(sub => (
                        <li key={sub}>{sub} <span className="del-icon" onClick={() => removerItem('subcategorias', sub, categoriaSelecionada)}>✕</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="config-col">
              <div className="config-card">
                <div className="card-top-bar gold-bar"></div>
                <h3>🎭 Grupos de Tema (Catálogo)</h3>
                <div className="add-item-box">
                  <input type="text" placeholder="Ex: Infantil, Casamento..." value={inputGrupoTema} onChange={(e) => setInputGrupoTema(e.target.value)} />
                  <button className="btn-add" onClick={() => adicionarItem('gruposTema', inputGrupoTema)}>Add</button>
                </div>
                <ul className="config-list">
                  {config.gruposTema?.map(grupo => (
                    <li key={grupo} onClick={() => setGrupoTemaSelecionado(grupo)} className={grupoTemaSelecionado === grupo ? 'active-gold' : ''}>
                      {grupo} <span className="del-icon" onClick={(e) => {e.stopPropagation(); removerItem('gruposTema', grupo)}}>✕</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="config-card">
                <div className="card-top-bar gold-bar"></div>
                <h3>🎨 Temas {grupoTemaSelecionado && `de "${grupoTemaSelecionado}"`}</h3>
                {!grupoTemaSelecionado ? <div className="empty-state">Selecione um Grupo de Tema acima.</div> : (
                  <>
                    <div className="add-item-box">
                      <input type="text" placeholder="Ex: Homem Aranha, Princesas..." value={inputTema} onChange={(e) => setInputTema(e.target.value)} />
                      <button className="btn-add" onClick={() => adicionarItem('temasPorGrupo', inputTema, grupoTemaSelecionado)}>Add</button>
                    </div>
                    <ul className="config-list">
                      {config.temasPorGrupo[grupoTemaSelecionado]?.map(tema => (
                        <li key={tema}>{tema} <span className="del-icon" onClick={() => removerItem('temasPorGrupo', tema, grupoTemaSelecionado)}>✕</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="config-col">
              <div className="config-card">
                <div className="card-top-bar gray-bar"></div>
                <h3>📍 Localização Física</h3>
                <div className="add-item-box">
                  <input type="text" placeholder="Novo corredor/prateleira..." value={inputLoc} onChange={(e) => setInputLoc(e.target.value)} />
                  <button className="btn-add" onClick={() => adicionarItem('localizacoes', inputLoc)}>Add</button>
                </div>
                <ul className="config-list">
                  {config.localizacoes?.map(loc => (
                    <li key={loc}>{loc} <span className="del-icon" onClick={() => removerItem('localizacoes', loc)}>✕</span></li>
                  ))}
                </ul>
              </div>

              <div className="config-card">
                <div className="card-top-bar gray-bar"></div>
                <h3>📏 Grade de Tamanhos</h3>
                <div className="add-item-box">
                  <input type="text" placeholder="Novo tamanho..." value={inputTam} onChange={(e) => setInputTam(e.target.value)} />
                  <button className="btn-add" onClick={() => adicionarItem('tamanhos', inputTam)}>Add</button>
                </div>
                <ul className="config-list">
                  {config.tamanhos?.map(tam => (
                    <li key={tam}>{tam} <span className="del-icon" onClick={() => removerItem('tamanhos', tam)}>✕</span></li>
                  ))}
                </ul>
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

            {/* 🔥 NOVO BLOCO: ASSINATURA PADRÃO DA EMPRESA 🔥 */}
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
          </div>
        )}

      </main>
    </div>
  );
};

export default Configuracoes;