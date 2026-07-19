import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, query, getDocs, where, writeBatch } from 'firebase/firestore';

const AbaCatalogoEstoque = ({
  config,
  setConfig,
  carregarConfiguracoesGerais,
  tenantId,
  usuarioLogado
}) => {
  const [catFisicaSelecionada, setCatFisicaSelecionada] = useState('');
  const [subCatFisicaSelecionada, setSubCatFisicaSelecionada] = useState('');
  const [catVitrineSelecionada, setCatVitrineSelecionada] = useState('');
  const [subCatVitrineSelecionada, setSubCatVitrineSelecionada] = useState('');
  const [grupoVitrineSelecionado, setGrupoVitrineSelecionado] = useState('');
  const [temaVitrineSelecionado, setTemaVitrineSelecionado] = useState('');

  const [inputCatFisica, setInputCatFisica] = useState(''); 
  const [inputSubCatFisica, setInputSubCatFisica] = useState('');
  const [inputCatVitrine, setInputCatVitrine] = useState('');
  const [inputSubCatVitrine, setInputSubCatVitrine] = useState('');
  const [inputGrupoVitrine, setInputGrupoVitrine] = useState('');
  const [inputTemaVitrine, setInputTemaVitrine] = useState('');
  const [inputLoc, setInputLoc] = useState('');
  const [inputTam, setInputTam] = useState('');

  const getDocConfigRef = () => doc(db, "configuracoes_empresa", tenantId);

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
          carregarConfiguracoesGerais();
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
          carregarConfiguracoesGerais();
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
          carregarConfiguracoesGerais();
          await atualizarNomeNoEstoqueEmLote(campoBanco, valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar."); console.error(e); }
  };

  const adicionarLocalizacao = async (valor) => {
    if (!valor.trim() || !usuarioLogado) return;
    const docRef = getDocConfigRef();
    try { await updateDoc(docRef, { localizacoes: arrayUnion(valor.trim()) }); setInputLoc(''); carregarConfiguracoesGerais(); } 
    catch (e) { alert("Erro ao adicionar."); }
  };

  const removerLocalizacao = async (valor) => {
    const quantidadeEmUso = await verificarUsoNoEstoque('localizacao', valor);
    if (quantidadeEmUso > 0) { alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${quantidadeEmUso} peça(s) guardadas em "${valor}".`); return; }
    if (!window.confirm(`Remover prateleira/local "${valor}"?`)) return;
    try { await updateDoc(getDocConfigRef(), { localizacoes: arrayRemove(valor) }); carregarConfiguracoesGerais(); } 
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
          carregarConfiguracoesGerais();
          await atualizarNomeNoEstoqueEmLote('localizacao', valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar localização."); }
  };

  const categoriasVitrineArr = Object.keys(config.catalogoVitrine || {});
  const subcategoriasVitrineArr = catVitrineSelecionada ? Object.keys(config.catalogoVitrine[catVitrineSelecionada] || {}) : [];
  const gruposVitrineArr = (catVitrineSelecionada && subCatVitrineSelecionada) ? Object.keys(config.catalogoVitrine[catVitrineSelecionada][subCatVitrineSelecionada] || {}) : [];
  const temasVitrineArr = (catVitrineSelecionada && subCatVitrineSelecionada && grupoVitrineSelecionado) ? (config.catalogoVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado] || []) : [];
  const alvoTamanhoFisico = subCatFisicaSelecionada || catFisicaSelecionada;

  return (
    <div className="aba-listas-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
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
  );
};

export default AbaCatalogoEstoque;
