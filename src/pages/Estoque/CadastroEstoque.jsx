import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroEstoque.css';
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query } from 'firebase/firestore';

const CadastroEstoque = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const itemEditando = location.state?.itemEditando || null;

  const [salvando, setSalvando] = useState(false);
  const [itensExistentes, setItensExistentes] = useState([]);

  // 🌟 LISTAS 100% DINÂMICAS VINDAS DO FIREBASE 🌟
  const [listasSistema, setListasSistema] = useState({
    categorias: [],
    subcategorias: {},
    localizacoes: [],
    tamanhos: [],
    gruposTema: [], 
    temasPorGrupo: {} 
  });

  // --- FOTOS E ENQUADRAMENTO ---
  const [fotos, setFotos] = useState([]);
  const [fotoPrincipalIndex, setFotoPrincipalIndex] = useState(0);
  const [posicoesFoco, setPosicoesFoco] = useState({}); 
  const [dragging, setDragging] = useState(false);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });

  // Dados Básicos
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subCategoria, setSubCategoria] = useState('');
  
  // Dados de Tema
  const [grupoTemaSelecionado, setGrupoTemaSelecionado] = useState('');
  const [temaSelecionado, setTemaSelecionado] = useState('');
  
  const [quantidade, setQuantidade] = useState(1);
  const [estoqueMinimo, setEstoqueMinimo] = useState(1);
  const [alertaEstoque, setAlertaEstoque] = useState('NaoAvisar'); 
  const [fornecedor, setFornecedor] = useState('');
  const [linkFornecedor, setLinkFornecedor] = useState('');
  const [status, setStatus] = useState('ok');
  const [localizacao, setLocalizacao] = useState('');

  // Financeiro e Especificações
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
  
  // Configurações
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
          // 🌟 PUXA TODAS AS LISTAS DAS CONFIGURAÇÕES 🌟
          setListasSistema({
            categorias: dados.categorias || [],
            subcategorias: dados.subcategorias || {},
            localizacoes: dados.localizacoes || [],
            tamanhos: dados.tamanhos || [],
            gruposTema: dados.gruposTema || [], 
            temasPorGrupo: dados.temasPorGrupo || {} 
          });

          if (!itemEditando) {
            if (dados.categorias?.length > 0) {
              setCategoria(dados.categorias[0]);
              if (dados.subcategorias?.[dados.categorias[0]]?.length > 0) {
                setSubCategoria(dados.subcategorias[dados.categorias[0]][0]);
              }
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
    }
  }, [itemEditando]);

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
    if (listasSistema.subcategorias[novaCat] && listasSistema.subcategorias[novaCat].length > 0) {
      setSubCategoria(listasSistema.subcategorias[novaCat][0]);
    } else {
      setSubCategoria('');
    }
  };

  const handleGrupoTemaChange = (e) => {
    const novoGrupo = e.target.value;
    setGrupoTemaSelecionado(novoGrupo);
    if (listasSistema.temasPorGrupo[novoGrupo] && listasSistema.temasPorGrupo[novoGrupo].length > 0) {
      setTemaSelecionado(listasSistema.temasPorGrupo[novoGrupo][0]);
    } else {
      setTemaSelecionado('');
    }
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

  const handleMouseDown = (e) => {
    setDragging(true);
    setStartMouse({ x: e.clientX, y: e.clientY });
    e.preventDefault(); 
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const deltaX = e.clientX - startMouse.x;
    const deltaY = e.clientY - startMouse.y;
    setStartMouse({ x: e.clientX, y: e.clientY });
    setPosicoesFoco(prev => {
      const current = prev[fotoPrincipalIndex] || { x: 50, y: 50 };
      let newX = current.x - (deltaX * 0.4);
      let newY = current.y - (deltaY * 0.4);
      return { ...prev, [fotoPrincipalIndex]: { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) }};
    });
  };

  const handleMouseUp = () => setDragging(false);

  const salvarItem = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const limparValor = (val) => Number(String(val).replace(',', '.'));

      const dados = {
        nome, codigo, categoria, subCategoria, 
        grupoTema: grupoTemaSelecionado, 
        tema: temaSelecionado,           
        status, fornecedor, linkFornecedor, localizacao,
        quantidade: Number(quantidade), estoqueMinimo: Number(estoqueMinimo),
        financeiro: { valorCompra: limparValor(valorCompra), valorAluguel: limparValor(valorAluguel), valorReposicao: limparValor(valorReposicao) },
        especificacoes: { tamanho, cor, unidadeMedida, largura: Number(largura), altura: Number(altura), diametro: Number(diametro), comprimento: Number(comprimento) },
        configuracao: { tipoDisponibilidade, visivelCatalogo, necessitaMontagem, voltagem, alertaEstoque },
        observacoes, fotos, posicoesFoco, foto: fotos.length > 0 ? fotos[0] : '', 
        atualizadoEm: serverTimestamp()
      };

      if (itemEditando) {
        await updateDoc(doc(db, "estoque", itemEditando.id), dados);
        alert("Item atualizado!");
      } else {
        await addDoc(collection(db, "estoque"), { ...dados, criadoEm: serverTimestamp() });
        alert("Novo item adicionado!");
      }
      navigate('/estoque');
    } catch (error) { alert("Erro ao salvar."); } 
    finally { setSalvando(false); }
  };

  const handleTextChange = (setter) => (e) => {
    const input = e.target.value;
    const formatted = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    setter(formatted);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-text">
          <h1 className="page-title">{itemEditando ? 'EDITAR ITEM DO ACERVO' : 'NOVO ITEM DO ACERVO'}</h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>Configure as regras de estoque e detalhes da peça</p>
        </div>
      </div>

      <div className="form-widescreen">
        <form onSubmit={salvarItem} className="estoque-form-layout">
          
          <div className="left-photo-col">
            <h3 className="section-divider" style={{marginTop: 0}}>FOTOS DO PRODUTO</h3>
            <div className="main-photo-display" style={{position: 'relative', overflow: 'hidden'}}>
              {fotos.length > 0 ? (
                <>
                  <img src={fotos[fotoPrincipalIndex]} className="main-photo-preview" style={{ objectPosition: `${posicoesFoco[fotoPrincipalIndex]?.x ?? 50}% ${posicoesFoco[fotoPrincipalIndex]?.y ?? 50}%`, cursor: dragging ? 'grabbing' : 'grab' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
                  <div style={{position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', pointerEvents: 'none'}}><span style={{background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px'}}>Arrastar para enquadrar</span></div>
                </>
              ) : (
                <label htmlFor="upload-principal" style={{cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                  <span style={{fontSize:'40px', opacity:0.3}}>📷</span>
                  <span className="photo-text" style={{marginTop: '10px', color: '#94a3b8', fontWeight: 'bold'}}>Clique aqui para adicionar</span>
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
          </div>

          <div className="right-data-col">
            <h3 className="section-divider" style={{marginTop: 0}}>IDENTIFICAÇÃO E REGRAS</h3>
            <div className="form-grid-4">
              <div className="form-group span-3"><label>NOME DO PRODUTO *</label><input value={nome} onChange={handleTextChange(setNome)} required /></div>
              <div className="form-group span-1"><label>CÓDIGO SKU</label><input value={codigo} readOnly style={{backgroundColor: '#e2e8f0'}} /></div>
              
              <div className="form-group span-1">
                <label>CATEGORIA</label>
                <select value={categoria} onChange={handleCategoriaChange}>
                  <option value="">Selecione...</option>
                  {listasSistema.categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group span-1">
                <label>SUBCATEGORIA</label>
                <select value={subCategoria} onChange={e => setSubCategoria(e.target.value)}>
                  <option value="">Selecione...</option>
                  {listasSistema.subcategorias[categoria]?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* 🌟 OS DROPDOWNS SÓ MOSTRAM O QUE TIVER CADASTRADO NAS CONFIGURAÇÕES 🌟 */}
              <div className="form-group span-1">
                <label>GRUPO DE TEMA</label>
                <select value={grupoTemaSelecionado} onChange={handleGrupoTemaChange}>
                  <option value="">Geral (Sem Tema)</option>
                  {listasSistema.gruposTema.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group span-1">
                <label>TEMA ESPECÍFICO</label>
                <select value={temaSelecionado} onChange={e => setTemaSelecionado(e.target.value)} disabled={!grupoTemaSelecionado}>
                  <option value="">Selecione...</option>
                  {listasSistema.temasPorGrupo[grupoTemaSelecionado]?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <h3 className="section-divider mt-compact">FORNECEDOR E FINANCEIRO</h3>
            <div className="form-grid-4">
              <div className="form-group span-2"><label>FORNECEDOR</label><input value={fornecedor} onChange={handleTextChange(setFornecedor)} /></div>
              <div className="form-group span-2"><label>URL / LINK DE COMPRA</label><input value={linkFornecedor} onChange={(e) => setLinkFornecedor(e.target.value)} placeholder="Cole o link do produto aqui..." /></div>
              <div className="form-group span-1"><label>CUSTO COMPRA (R$)</label><input type="text" value={valorCompra} onChange={e => setValorCompra(e.target.value)} onBlur={formatarMoedaBlur(setValorCompra)} placeholder="0,00"/></div>
              <div className="form-group span-2"><label style={{color: '#c5a059', fontWeight: 800}}>VALOR ALUGUEL (R$) *</label><input type="text" value={valorAluguel} onChange={e => setValorAluguel(e.target.value)} onBlur={formatarMoedaBlur(setValorAluguel)} required style={{borderColor: '#c5a059'}} placeholder="0,00"/></div>
              <div className="form-group span-1"><label>VALOR REPOSIÇÃO</label><input type="text" value={valorReposicao} onChange={e => setValorReposicao(e.target.value)} onBlur={formatarMoedaBlur(setValorReposicao)} placeholder="0,00"/></div>
            </div>

            <h3 className="section-divider mt-compact">LOGÍSTICA E OPERACIONAL</h3>
            <div className="form-grid-4">
              <div className="form-group span-1"><label>QTD. TOTAL</label><input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div>
              <div className="form-group span-2"><label style={{color: '#10b981', fontWeight: 800}}>ALERTA DE ESTOQUE</label><select value={alertaEstoque} onChange={e => setAlertaEstoque(e.target.value)}><option value="NaoAvisar">Item Único (Não avisar mínimo)</option><option value="Avisar">Avisar se atingir o mínimo</option></select></div>
              <div className="form-group span-1"><label>ESTOQUE MÍNIMO</label><input type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} disabled={alertaEstoque === 'NaoAvisar'} /></div>
              <div className="form-group span-2"><label>STATUS</label><select value={status} onChange={e => setStatus(e.target.value)}><option value="ok">✅ Disponível</option><option value="manutencao">🛠️ Em Manutenção</option></select></div>
              <div className="form-group span-2"><label>LOCALIZAÇÃO NO GALPÃO</label><select value={localizacao} onChange={e => setLocalizacao(e.target.value)}><option value="">Selecione...</option>{listasSistema.localizacoes.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            </div>

            <h3 className="section-divider mt-compact">ESPECIFICAÇÕES TÉCNICAS</h3>
            <div className="form-grid-4">
              <div className="form-group span-1"><label>TAMANHO</label><select value={tamanho} onChange={e => setTamanho(e.target.value)}><option value="">Selecione...</option>{listasSistema.tamanhos.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="form-group span-1"><label>COR</label><input value={cor} onChange={handleTextChange(setCor)} /></div>
              <div className="form-group span-1"><label>UNIDADE</label><select value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)}>{unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
              {categoria === "Iluminação" ? (<div className="form-group span-1"><label>VOLTAGEM</label><select value={voltagem} onChange={e => setVoltagem(e.target.value)}><option value="Bivolt">Bivolt</option><option value="110v">110v</option><option value="220v">220v</option></select></div>) : (<div className="form-group span-1"><label>MONTAGEM TÉCNICA?</label><select value={necessitaMontagem} onChange={e => setNecessitaMontagem(e.target.value)}><option value="Não">Não (Pegue e Monte)</option><option value="Sim">Sim (Exige Equipe)</option></select></div>)}
              <div className="form-group span-1"><label>LARGURA (cm)</label><input type="number" value={largura} onChange={e => setLargura(e.target.value)} /></div>
              <div className="form-group span-1"><label>ALTURA (cm)</label><input type="number" value={altura} onChange={e => setAltura(e.target.value)} /></div>
              <div className="form-group span-1"><label>DIÂMETRO (cm)</label><input type="number" value={diametro} onChange={e => setDiametro(e.target.value)} /></div>
              <div className="form-group span-1"><label>COMPRIMENTO</label><input type="number" value={comprimento} onChange={e => setComprimento(e.target.value)} /></div>
            </div>

            <h3 className="section-divider mt-compact">VISIBILIDADE E OBSERVAÇÕES</h3>
            <div className="form-grid-4">
              <div className="form-group span-1"><label>DISPONÍVEL PARA:</label><select value={tipoDisponibilidade} onChange={e => setTipoDisponibilidade(e.target.value)}><option value="Aluguel">Aluguel (Retorna)</option><option value="Venda">Venda (Sai do estoque)</option></select></div>
              <div className="form-group span-3" style={{justifyContent: 'center', paddingLeft: '10px'}}><label className="custom-toggle-container"><input type="checkbox" checked={visivelCatalogo} onChange={e => setVisivelCatalogo(e.target.checked)} className="hidden-checkbox"/><div className={`toggle-slider ${visivelCatalogo ? 'active' : ''}`}><div className="toggle-knob"></div></div><span className={`toggle-label ${visivelCatalogo ? 'active-text' : 'inactive-text'}`}>{visivelCatalogo ? '👁️ VISÍVEL NO CATÁLOGO ONLINE' : '🔒 OCULTO DO CATÁLOGO'}</span></label></div>
              <div className="form-group span-4"><label>OBSERVAÇÕES INTERNAS</label><textarea rows="3" value={observacoes} onChange={e => setObservacoes(e.target.value)}></textarea></div>
            </div>

            <div className="form-actions mt-compact">
              <Link to="/estoque" className="btn-voltar">Cancelar</Link>
              <button type="submit" className="btn-salvar" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Item'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastroEstoque;