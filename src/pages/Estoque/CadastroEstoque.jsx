import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroEstoque.css';
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query } from 'firebase/firestore';

const CadastroEstoque = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const itemEditando = location.state?.itemEditando || null;
  const dadosCompra = location.state?.dadosCompra || null; 

  const [salvando, setSalvando] = useState(false);
  const [itensExistentes, setItensExistentes] = useState([]);

  const [listasSistema, setListasSistema] = useState({
    categorias: [], subcategorias: {}, localizacoes: [], tamanhos: [], gruposTema: [], temasPorGrupo: {} 
  });

  const [fotos, setFotos] = useState([]);
  const [fotoPrincipalIndex, setFotoPrincipalIndex] = useState(0);
  const [posicoesFoco, setPosicoesFoco] = useState({}); 
  const [dragging, setDragging] = useState(false);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });

  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subCategoria, setSubCategoria] = useState('');
  
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');
  const [temaSelecionado, setTemaSelecionado] = useState('');
  
  const [isKit, setIsKit] = useState(false);
  const [pecasKit, setPecasKit] = useState([{ 
      id: Date.now(), nome: '', valorAluguel: '', 
      cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' 
  }]);

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
  const [unidadeMedida, setUnidadeMedida] = useState('Unidade');
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [diametro, setDiametro] = useState('');
  const [comprimento, setComprimento] = useState('');
  
  const [tipoDisponibilidade, setTipoDisponibilidade] = useState('Aluguel');
  const [visivelCatalogo, setVisivelCatalogo] = useState(true);
  const [necessitaMontagem, setNecessitaMontagem] = useState('Não');
  const [voltagem, setVoltagem] = useState('Bivolt');
  const [observacoes, setObservacoes] = useState('');

  const unidades = ["Unidade", "Par", "Metro", "Jogo", "Kit", "Peça"];

  useEffect(() => {
    const fetchItens = async () => {
      const q = query(collection(db, "estoque"));
      const snap = await getDocs(q);
      setItensExistentes(snap.docs.map(d => d.data()));
    };
    fetchItens();

    const fetchConfiguracoes = async () => {
      try {
        const docRef = doc(db, "sistema", "parametros");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setListasSistema({
            categorias: dados.categorias || [], subcategorias: dados.subcategorias || {}, localizacoes: dados.localizacoes || [],
            tamanhos: dados.tamanhos || [], gruposTema: dados.gruposTema || [], temasPorGrupo: dados.temasPorGrupo || {} 
          });

          if (!itemEditando && !dadosCompra) {
            if (dados.categorias?.length > 0) {
              setCategoria(dados.categorias[0]);
              if (dados.subcategorias?.[dados.categorias[0]]?.length > 0) setSubCategoria(dados.subcategorias[dados.categorias[0]][0]);
            }
            if (dados.localizacoes?.length > 0) setLocalizacao(dados.localizacoes[0]);
          }
        }
      } catch (e) { console.error("Erro:", e); }
    };
    fetchConfiguracoes();

    if (itemEditando) {
      setNome(itemEditando.nome || ''); setCodigo(itemEditando.codigo || '');
      setCategoria(itemEditando.categoria || ''); setSubCategoria(itemEditando.subCategoria || '');
      setGrupoTemaSelecionado(itemEditando.grupoTema || ''); setTemaSelecionado(itemEditando.tema || '');
      
      setIsKit(itemEditando.especificacoes?.isKit || false);
      if (itemEditando.especificacoes?.pecasKit) {
         setPecasKit(itemEditando.especificacoes.pecasKit);
      }

      setQuantidade(itemEditando.quantidade || 1); setEstoqueMinimo(itemEditando.estoqueMinimo || 1);
      setAlertaEstoque(itemEditando.configuracao?.alertaEstoque || 'NaoAvisar'); 
      setFornecedor(itemEditando.fornecedor || ''); setLinkFornecedor(itemEditando.linkFornecedor || '');
      setLocalizacao(itemEditando.localizacao || ''); setStatus(itemEditando.status || 'ok');
      setValorCompra(itemEditando.financeiro?.valorCompra?.toFixed(2).replace('.', ',') || '');
      setValorAluguel(itemEditando.financeiro?.valorAluguel?.toFixed(2).replace('.', ',') || '');
      setValorReposicao(itemEditando.financeiro?.valorReposicao?.toFixed(2).replace('.', ',') || '');
      setTamanho(itemEditando.especificacoes?.tamanho || ''); setCor(itemEditando.especificacoes?.cor || '');
      setUnidadeMedida(itemEditando.especificacoes?.unidadeMedida || 'Unidade');
      setLargura(itemEditando.especificacoes?.largura || ''); setAltura(itemEditando.especificacoes?.altura || '');
      setDiametro(itemEditando.especificacoes?.diametro || ''); setComprimento(itemEditando.especificacoes?.comprimento || '');
      setTipoDisponibilidade(itemEditando.configuracao?.tipoDisponibilidade || 'Aluguel');
      setVisivelCatalogo(itemEditando.configuracao?.visivelCatalogo !== false);
      setNecessitaMontagem(itemEditando.configuracao?.necessitaMontagem || 'Não');
      setVoltagem(itemEditando.configuracao?.voltagem || 'Bivolt');
      setObservacoes(itemEditando.observacoes || '');
      setPosicoesFoco(itemEditando.posicoesFoco || {});
      
      if (itemEditando.fotos && itemEditando.fotos.length > 0) setFotos(itemEditando.fotos);
      else if (itemEditando.foto) setFotos([itemEditando.foto]);
    
    } else if (dadosCompra) {
      setNome(dadosCompra.nome || '');
      setQuantidade(dadosCompra.quantidade || 1);
      if (dadosCompra.valorEstimado) setValorCompra(Number(dadosCompra.valorEstimado).toFixed(2).replace('.', ','));
      if (dadosCompra.valorAluguel) setValorAluguel(Number(dadosCompra.valorAluguel).toFixed(2).replace('.', ','));
      setFornecedor(dadosCompra.fornecedor || '');
      setObservacoes(dadosCompra.obs || '');
      setStatus('pintura'); 
    }
  }, [itemEditando, dadosCompra]);

  const gerarSKU = (cat) => {
    if (!cat) return '';
    const prefixo = cat.substring(0, 3).toUpperCase();
    const total = itensExistentes.filter(i => i.categoria === cat).length;
    return `${prefixo}-${String(total + 1).padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!itemEditando && itensExistentes.length > 0 && !codigo && categoria) setCodigo(gerarSKU(categoria));
  }, [itensExistentes, categoria]);

  const handleCategoriaChange = (e) => {
    const novaCat = e.target.value;
    setCategoria(novaCat);
    if (!itemEditando) setCodigo(gerarSKU(novaCat));
    if (listasSistema.subcategorias[novaCat] && listasSistema.subcategorias[novaCat].length > 0) setSubCategoria(listasSistema.subcategorias[novaCat][0]);
    else setSubCategoria('');
  };

  const handleGrupoTemaChange = (e) => {
    const novoGrupo = e.target.value;
    setGrupoTemaSelecionado(novoGrupo);
    if (listasSistema.temasPorGrupo[novoGrupo] && listasSistema.temasPorGrupo[novoGrupo].length > 0) setTemaSelecionado(listasSistema.temasPorGrupo[novoGrupo][0]);
    else setTemaSelecionado('');
  };

  const formatarMoedaBlur = (setter) => (e) => {
    let valor = e.target.value;
    if (!valor) return;
    valor = valor.replace(',', '.');
    const num = parseFloat(valor);
    if (!isNaN(num)) setter(num.toFixed(2).replace('.', ','));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 600;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          setFotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.8)]);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const removerFoto = (index) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
    if (index === fotoPrincipalIndex) setFotoPrincipalIndex(0);
  };

  const handlePointerDown = (e) => {
    setDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartMouse({ x: clientX, y: clientY });
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startMouse.x;
    const deltaY = clientY - startMouse.y;
    setStartMouse({ x: clientX, y: clientY });
    setPosicoesFoco(prev => {
      const current = prev[fotoPrincipalIndex] || { x: 50, y: 50 };
      let newX = current.x - (deltaX * 0.4);
      let newY = current.y - (deltaY * 0.4);
      return { ...prev, [fotoPrincipalIndex]: { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) }};
    });
  };

  const handlePointerUp = () => setDragging(false);

  const atualizarPecaKit = (idx, campo, valor) => {
      const newPecas = [...pecasKit];
      newPecas[idx][campo] = valor;
      setPecasKit(newPecas);
  };

  const salvarItem = async (e) => {
    e.preventDefault();

    if (!categoria) return alert("❌ Selecione a Categoria principal.");
    if (!subCategoria) return alert("❌ Selecione a Subcategoria.");
    if (!grupoTemaSelecionado) return alert("❌ Selecione o Grupo de Tema.");
    if (!temaSelecionado) return alert("❌ Selecione o Tema Específico.");
    
    if (isKit) {
        const hasEmptyPeca = pecasKit.some(p => !p.nome.trim() || !p.valorAluguel.trim());
        if (hasEmptyPeca) return alert("❌ Preencha o nome e o valor de aluguel de TODAS as peças do Kit, ou clique na lixeira para remover as linhas vazias.");
    }

    setSalvando(true);
    try {
      const limparValor = (val) => Number(String(val).replace(',', '.'));

      const dados = {
        nome, codigo, categoria, subCategoria, 
        grupoTema: grupoTemaSelecionado, tema: temaSelecionado,          
        status, fornecedor, linkFornecedor, localizacao,
        quantidade: Number(quantidade), estoqueMinimo: Number(estoqueMinimo),
        financeiro: { valorCompra: limparValor(valorCompra), valorAluguel: limparValor(valorAluguel), valorReposicao: limparValor(valorReposicao) },
        
        especificacoes: { 
            tamanho: isKit ? '' : tamanho, 
            cor: isKit ? '' : cor, 
            unidadeMedida, 
            largura: isKit ? 0 : Number(largura), 
            altura: isKit ? 0 : Number(altura), 
            diametro: isKit ? 0 : Number(diametro), 
            comprimento: isKit ? 0 : Number(comprimento),
            isKit, pecasKit: isKit ? pecasKit : [] 
        },
        
        configuracao: { tipoDisponibilidade, visivelCatalogo, necessitaMontagem, voltagem, alertaEstoque },
        observacoes, fotos, posicoesFoco, foto: fotos.length > 0 ? fotos[0] : '', 
        atualizadoEm: serverTimestamp()
      };

      if (itemEditando) {
        await updateDoc(doc(db, "estoque", itemEditando.id), dados);
        alert("Item atualizado!");
      } else {
        const docRef = await addDoc(collection(db, "estoque"), { ...dados, criadoEm: serverTimestamp() });
        const mainId = docRef.id;

        if (isKit && pecasKit.length > 0) {
            for (let i = 0; i < pecasKit.length; i++) {
                const peca = pecasKit[i];
                if (peca.nome.trim()) {
                    const valPeca = Number(peca.valorAluguel.replace(',', '.'));
                    const pecaDados = {
                        ...dados, 
                        nome: `${nome} - ${peca.nome}`, 
                        codigo: `${codigo}-P${i+1}`, 
                        financeiro: { ...dados.financeiro, valorAluguel: isNaN(valPeca) ? 0 : valPeca, valorCompra: 0, valorReposicao: 0 },
                        especificacoes: { 
                            ...dados.especificacoes, 
                            isKit: false, 
                            isSubPeca: true, 
                            kitPaiId: mainId, 
                            unidadeMedida: 'Unidade',
                            cor: peca.cor || '',
                            tamanho: peca.tamanho || '',
                            largura: Number(peca.largura) || 0,
                            altura: Number(peca.altura) || 0,
                            diametro: Number(peca.diametro) || 0,
                            comprimento: Number(peca.comprimento) || 0
                        },
                        quantidade: 1 
                    };
                    await addDoc(collection(db, "estoque"), { ...pecaDados, criadoEm: serverTimestamp() });
                }
            }
        }
        alert(isKit ? "Mágica feita! O Kit e as peças avulsas com suas medidas foram gerados com sucesso no Acervo!" : "Novo item adicionado com sucesso ao Acervo!");
      }
      navigate('/estoque');
    } catch (error) { alert("Erro ao salvar."); } 
    finally { setSalvando(false); }
  };

  const handleTextChange = (setter) => (e) => {
    const input = e.target.value;
    setter(input.charAt(0).toUpperCase() + input.slice(1).toLowerCase());
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-text">
          <h1 className="page-title">
            {itemEditando ? 'EDITAR ITEM DO ACERVO' : dadosCompra ? '✨ FINALIZAR CADASTRO DE COMPRA' : 'NOVO ITEM DO ACERVO'}
          </h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>
            {dadosCompra ? 'Você indicou que já comprou este item! Adicione a foto, confira o status e salve no acervo.' : 'Configure as regras de estoque e detalhes da peça'}
          </p>
        </div>
      </div>

      <div className="form-widescreen">
        <form onSubmit={salvarItem} className="estoque-form-layout">
          
          <div className="left-photo-col">
            <h3 className="section-divider" style={{marginTop: 0}}>FOTOS DO PRODUTO</h3>
            <div className="main-photo-display">
              {fotos.length > 0 ? (
                <>
                  <img 
                    src={fotos[fotoPrincipalIndex]} 
                    className="main-photo-preview" 
                    style={{ 
                      objectPosition: `${posicoesFoco[fotoPrincipalIndex]?.x ?? 50}% ${posicoesFoco[fotoPrincipalIndex]?.y ?? 50}%`, 
                      cursor: dragging ? 'grabbing' : 'grab' 
                    }} 
                    onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}
                    onMouseMove={handlePointerMove} onTouchMove={handlePointerMove}
                    onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchEnd={handlePointerUp}
                  />
                  <div style={{position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', pointerEvents: 'none'}}>
                    <span style={{background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px'}}>Arrastar para enquadrar</span>
                  </div>
                </>
              ) : (
                <label htmlFor="upload-principal" style={{cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                  <span style={{fontSize:'40px', opacity:0.3}}>📷</span>
                  <span className="photo-text" style={{marginTop: '10px', color: '#94a3b8', fontWeight: 'bold'}}>Clique para adicionar</span>
                  <input id="upload-principal" type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                </label>
              )}
            </div>
            
            <div className="photo-thumbnails-row">
              {fotos.map((f, idx) => (
                <div key={idx} className={`thumb-item ${idx === fotoPrincipalIndex ? 'active' : ''}`} onClick={() => setFotoPrincipalIndex(idx)}>
                  <img src={f} style={{ objectPosition: `${posicoesFoco[idx]?.x ?? 50}% ${posicoesFoco[idx]?.y ?? 50}%` }} />
                  <button type="button" className="btn-remove-thumb" onClick={(e) => {e.stopPropagation(); removerFoto(idx)}}>×</button>
                </div>
              ))}
              <label className="thumb-upload-btn"><span>+</span><input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} /></label>
            </div>

            {/* 🔥 TIPO DE CADASTRO E ESPECIFICAÇÕES AQUI NA ESQUERDA 🔥 */}
            <div className="tipo-cadastro-container" style={{background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '20px'}}>
                <label style={{color: '#0f172a', fontWeight: 'bold', display: 'block', marginBottom: '10px'}}>TIPO DE CADASTRO</label>
                <div className="toggle-simples" style={{marginBottom: '10px'}}>
                  <button type="button" className={!isKit ? 'active' : ''} onClick={() => { setIsKit(false); setUnidadeMedida('Unidade'); }}>Peça Única</button>
                  <button type="button" className={isKit ? 'active' : ''} onClick={() => { setIsKit(true); setUnidadeMedida('Kit'); }}>📦 É um Kit</button>
                </div>
                
                {isKit ? (
                  <div className="kit-builder mt-10">
                    <label style={{color: '#c5a059', fontWeight: 'bold', marginBottom: '5px', display: 'block'}}>O QUE VEM NESTE KIT?</label>
                    <p style={{fontSize: '11.5px', color: '#64748b', marginBottom: '15px', lineHeight: '1.4'}}>
                      Ao salvar, o sistema criará magicamente o cadastro individual de cada uma das peças abaixo.
                    </p>
                    
                    {pecasKit.map((p, idx) => (
                      <div key={p.id} style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'}}>
                        
                        <div style={{display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center'}}>
                          <input type="text" placeholder={`Ex: Bandeja P`} value={p.nome} onChange={e => atualizarPecaKit(idx, 'nome', e.target.value)} style={{flex: 2, padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
                          <input type="text" placeholder="R$ Aluguel" value={p.valorAluguel} onChange={e => atualizarPecaKit(idx, 'valorAluguel', e.target.value)} onBlur={e => {
                             let val = e.target.value.replace(',', '.');
                             const num = parseFloat(val);
                             if(!isNaN(num)) atualizarPecaKit(idx, 'valorAluguel', num.toFixed(2).replace('.', ','));
                          }} style={{flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
                          <button type="button" onClick={() => setPecasKit(pecasKit.filter(item => item.id !== p.id))} style={{background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', height: '36px', width: '36px', cursor: 'pointer', fontWeight: 'bold'}}>X</button>
                        </div>

                        <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                          <input type="text" placeholder="Cor (Ex: Azul Bebê)" value={p.cor} onChange={e => atualizarPecaKit(idx, 'cor', e.target.value)} style={{flex: 1, padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1'}} />
                          <select value={p.tamanho} onChange={e => atualizarPecaKit(idx, 'tamanho', e.target.value)} style={{flex: 1, padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff'}}>
                            <option value="">Tamanho...</option>
                            {listasSistema.tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        {/* 🔥 CORREÇÃO DO LAYOUT VAZANDO COM FLEXWRAP 🔥 */}
                        <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                          <div style={{flex: '1 1 20%', minWidth: '60px'}}>
                            <input type="number" placeholder="Larg(cm)" value={p.largura} onChange={e => atualizarPecaKit(idx, 'largura', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center'}} title="Largura" />
                          </div>
                          <div style={{flex: '1 1 20%', minWidth: '60px'}}>
                            <input type="number" placeholder="Alt(cm)" value={p.altura} onChange={e => atualizarPecaKit(idx, 'altura', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center'}} title="Altura" />
                          </div>
                          <div style={{flex: '1 1 20%', minWidth: '60px'}}>
                            <input type="number" placeholder="Diâm(cm)" value={p.diametro} onChange={e => atualizarPecaKit(idx, 'diametro', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center'}} title="Diâmetro" />
                          </div>
                          <div style={{flex: '1 1 20%', minWidth: '60px'}}>
                            <input type="number" placeholder="Comp(cm)" value={p.comprimento} onChange={e => atualizarPecaKit(idx, 'comprimento', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center'}} title="Comprimento" />
                          </div>
                        </div>

                      </div>
                    ))}
                    <button type="button" onClick={() => setPecasKit([...pecasKit, { id: Date.now(), nome: '', valorAluguel: '', cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' }])} style={{background: '#0f172a', color: '#fff', border: 'none', width: '100%', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px', transition: 'all 0.2s'}}>+ Adicionar Nova Peça ao Kit</button>
                  </div>
                ) : (
                  <div className="single-item-builder mt-10" style={{borderTop: '1px dashed #cbd5e1', paddingTop: '15px'}}>
                    <label style={{color: '#c5a059', fontWeight: 'bold', marginBottom: '10px', display: 'block'}}>ESPECIFICAÇÕES DA PEÇA</label>
                    
                    <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>TAMANHO</label>
                        <select value={tamanho} onChange={e => setTamanho(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#fff'}}>
                          <option value="">Selecione...</option>
                          {listasSistema.tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>COR</label>
                        <input value={cor} onChange={handleTextChange(setCor)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1'}} />
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>UNIDADE</label>
                        <select value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#fff'}}>
                          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
                      <div style={{flex: 1}}>
                        {categoria === "Iluminação" ? (
                          <>
                            <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>VOLTAGEM</label>
                            <select value={voltagem} onChange={e => setVoltagem(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#fff'}}>
                              <option value="Bivolt">Bivolt</option><option value="110v">110v</option><option value="220v">220v</option>
                            </select>
                          </>
                        ) : (
                          <>
                            <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>MONTAGEM?</label>
                            <select value={necessitaMontagem} onChange={e => setNecessitaMontagem(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#fff'}}>
                              <option value="Não">Não</option><option value="Sim">Sim</option>
                            </select>
                          </>
                        )}
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>LARG(cm)</label>
                        <input type="number" value={largura} onChange={e => setLargura(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1'}} />
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>ALT(cm)</label>
                        <input type="number" value={altura} onChange={e => setAltura(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1'}} />
                      </div>
                    </div>

                    <div style={{display: 'flex', gap: '8px'}}>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>DIÂM(cm)</label>
                        <input type="number" value={diametro} onChange={e => setDiametro(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1'}} />
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>COMP(cm)</label>
                        <input type="number" value={comprimento} onChange={e => setComprimento(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1'}} />
                      </div>
                      <div style={{flex: 1}}></div>
                    </div>
                  </div>
                )}
            </div>
          </div>

          <div className="right-data-col">
            
            <h3 className="section-divider" style={{marginTop: 0}}>IDENTIFICAÇÃO E REGRAS</h3>
            <div className="form-grid-4">
              <div className="form-group span-3"><label>NOME DO PRODUTO / KIT *</label><input value={nome} onChange={handleTextChange(setNome)} required /></div>
              <div className="form-group span-1"><label>CÓDIGO SKU</label><input value={codigo} readOnly style={{backgroundColor: '#e2e8f0'}} /></div>
              
              <div className="span-4 flex-row-always">
                <div className="form-group"><label>CATEGORIA *</label><select value={categoria} onChange={handleCategoriaChange} required><option value="">Selecione...</option>{listasSistema.categorias.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="form-group"><label>SUBCATEGORIA *</label><select value={subCategoria} onChange={e => setSubCategoria(e.target.value)} required><option value="">Selecione...</option>{listasSistema.subcategorias[categoria]?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              
              <div className="span-4 flex-row-always">
                <div className="form-group"><label>GRUPO DE TEMA *</label><select value={grupoTemaSelecionado} onChange={handleGrupoTemaChange} required><option value="">Selecione o Grupo</option>{listasSistema.gruposTema.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                <div className="form-group"><label>TEMA ESPECÍFICO *</label><select value={temaSelecionado} onChange={e => setTemaSelecionado(e.target.value)} disabled={!grupoTemaSelecionado} required><option value="">Selecione o Tema...</option>{listasSistema.temasPorGrupo[grupoTemaSelecionado]?.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
            </div>

            <h3 className="section-divider mt-compact">FORNECEDOR E FINANCEIRO</h3>
            <div className="form-grid-4">
              <div className="form-group span-2"><label>FORNECEDOR</label><input value={fornecedor} onChange={handleTextChange(setFornecedor)} /></div>
              <div className="form-group span-2"><label>URL / LINK DE COMPRA</label><input value={linkFornecedor} onChange={(e) => setLinkFornecedor(e.target.value)} placeholder="Cole o link do produto aqui..." /></div>
              
              <div className="span-4 flex-row-always">
                <div className="form-group"><label>COMPRA (R$)</label><input type="text" value={valorCompra} onChange={e => setValorCompra(e.target.value)} onBlur={formatarMoedaBlur(setValorCompra)} placeholder="0,00"/></div>
                <div className="form-group"><label style={{color: '#c5a059', fontWeight: 800}}>{isKit ? 'ALUGUEL KIT (R$) *' : 'ALUGUEL (R$) *'}</label><input type="text" value={valorAluguel} onChange={e => setValorAluguel(e.target.value)} onBlur={formatarMoedaBlur(setValorAluguel)} required style={{borderColor: '#c5a059'}} placeholder="0,00"/></div>
                <div className="form-group"><label>REPOSIÇÃO (R$)</label><input type="text" value={valorReposicao} onChange={e => setValorReposicao(e.target.value)} onBlur={formatarMoedaBlur(setValorReposicao)} placeholder="0,00"/></div>
              </div>
            </div>

            <h3 className="section-divider mt-compact">LOGÍSTICA E OPERACIONAL</h3>
            <div className="form-grid-4">
              <div className="span-4 flex-row-always">
                <div className="form-group"><label>QUANTIDADE TOTAL</label><input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div>
                <div className="form-group"><label>ESTOQUE MÍNIMO</label><input type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} disabled={alertaEstoque === 'NaoAvisar'} /></div>
              </div>
              
              <div className="form-group span-4"><label style={{color: '#10b981', fontWeight: 800}}>ALERTA DE ESTOQUE</label><select value={alertaEstoque} onChange={e => setAlertaEstoque(e.target.value)}><option value="NaoAvisar">Item Único (Não avisar mínimo)</option><option value="Avisar">Avisar se atingir o mínimo</option></select></div>
              
              <div className="span-4 flex-row-always">
                <div className="form-group">
                  <label>STATUS DA PEÇA</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={{fontWeight: 'bold', color: status === 'pintura' ? '#d97706' : status === 'manutencao' ? '#ef4444' : '#10b981'}}>
                    <option value="ok">✅ Pronto para Uso (Disponível)</option>
                    <option value="pintura">🎨 Precisa de Pintura / Acabamento</option>
                    <option value="manutencao">🛠️ Em Manutenção / Quebrado</option>
                  </select>
                </div>
                <div className="form-group"><label>LOCALIZAÇÃO</label><select value={localizacao} onChange={e => setLocalizacao(e.target.value)}><option value="">Selecione...</option>{listasSistema.localizacoes.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
              </div>
            </div>

            {isKit && (
              <div className="form-grid-4">
                <h3 className="section-divider mt-compact">ESPECIFICAÇÕES GERAIS DO KIT</h3>
                <div className="span-4 flex-row-always">
                  <div className="form-group"><label>UNIDADE</label><select value={unidadeMedida} disabled style={{background: '#f1f5f9'}}><option value="Kit">Kit</option></select></div>
                  {categoria === "Iluminação" ? (<div className="form-group"><label>VOLTAGEM</label><select value={voltagem} onChange={e => setVoltagem(e.target.value)}><option value="Bivolt">Bivolt</option><option value="110v">110v</option><option value="220v">220v</option></select></div>) : (<div className="form-group"><label>MONTAGEM?</label><select value={necessitaMontagem} onChange={e => setNecessitaMontagem(e.target.value)}><option value="Não">Não (Pegue/Monte)</option><option value="Sim">Sim (Equipe)</option></select></div>)}
                </div>
              </div>
            )}

            <h3 className="section-divider mt-compact">VISIBILIDADE E OBSERVAÇÕES</h3>
            <div className="form-grid-4">
              <div className="form-group span-4"><label>DISPONÍVEL PARA:</label><select value={tipoDisponibilidade} onChange={e => setTipoDisponibilidade(e.target.value)}><option value="Aluguel">Aluguel (Retorna)</option><option value="Venda">Venda (Sai do estoque)</option></select></div>
              
              <div className="form-group span-4" style={{marginTop: '5px'}}>
                <div 
                  className={`ios-toggle-wrapper ${visivelCatalogo ? 'active' : ''}`} 
                  onClick={() => setVisivelCatalogo(!visivelCatalogo)}
                >
                  <div className="ios-toggle-switch">
                    <div className="ios-toggle-knob"></div>
                  </div>
                  <span className="ios-toggle-text">
                    {visivelCatalogo ? '  VISÍVEL NO CATÁLOGO ONLINE' : '🔒 OCULTO DO CATÁLOGO'}
                  </span>
                </div>
              </div>
              
              <div className="form-group span-4"><label>OBSERVAÇÕES INTERNAS</label><textarea rows="3" value={observacoes} onChange={e => setObservacoes(e.target.value)}></textarea></div>
            </div>

            <div className="form-actions mt-compact">
              <Link to={dadosCompra ? "/compras" : "/estoque"} className="btn-voltar">Cancelar</Link>
              <button type="submit" className="btn-salvar" disabled={salvando}>{salvando ? 'Salvando...' : (isKit ? 'Salvar Item e Gerar Peças' : 'Salvar Item')}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastroEstoque;