import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroEstoque.css';
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, getDoc, query } from 'firebase/firestore';

const CadastroEstoque = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const itemEditando = location.state?.itemEditando || null;
  const itemDuplicando = location.state?.itemDuplicando || null; // 🔥 PEGA O ITEM CLONADO
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
  
  const [tipoCadastro, setTipoCadastro] = useState('avulsa');
  
  const [pecasKitNovas, setPecasKitNovas] = useState([{ 
      id: Date.now(), nome: '', valorAluguel: '', cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' 
  }]);

  const [itensDoKit, setItensDoKit] = useState([]); 
  const [modalCatalogoAberto, setModalCatalogoAberto] = useState(false);
  const [buscaCatalogo, setBuscaCatalogo] = useState('');
  const [filtroCategoriaCatalogo, setFiltroCategoriaCatalogo] = useState('Todos');

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
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItensExistentes(docs);
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
        }
      } catch (e) { console.error("Erro:", e); }
    };
    fetchConfiguracoes();

    // 🔥 FUNDE AS DUAS LÓGICAS (EDITAR OU DUPLICAR) 🔥
    const itemBase = itemEditando || itemDuplicando;

    if (itemBase) {
      // Se for cópia, avisa no nome
      setNome(itemDuplicando ? `${itemBase.nome} (Cópia)` : itemBase.nome || ''); 
      
      // Se for cópia, DEIXA O CÓDIGO VAZIO para o sistema gerar um novo!
      setCodigo(itemEditando ? itemBase.codigo || '' : ''); 
      
      setCategoria(itemBase.categoria || ''); 
      setSubCategoria(itemBase.subCategoria || '');
      setGrupoTemaSelecionado(itemBase.grupoTema || ''); 
      setTemaSelecionado(itemBase.tema || '');
      
      const ehDecoracao = itemBase.especificacoes?.isDecoracao || false;
      const ehKitPai = itemBase.especificacoes?.isKitPai || itemBase.especificacoes?.isKit || false;

      if (ehDecoracao) {
          setTipoCadastro('decoracao');
          setTipoDisponibilidade('Aluguel');
          setItensDoKit(itemBase.especificacoes?.itensDecoracao || itemBase.especificacoes?.itensDoKit || []);
      } else if (ehKitPai) {
          setTipoCadastro('kit');
          setPecasKitNovas(itemBase.especificacoes?.pecasKit || []);
      } else {
          setTipoCadastro('avulsa');
      }

      setQuantidade(itemBase.quantidade || 1); setEstoqueMinimo(itemBase.estoqueMinimo || 1);
      setAlertaEstoque(itemBase.configuracao?.alertaEstoque || 'NaoAvisar'); 
      setFornecedor(itemBase.fornecedor || ''); setLinkFornecedor(itemBase.linkFornecedor || '');
      setLocalizacao(itemBase.localizacao || ''); setStatus(itemBase.status || 'ok');
      setValorCompra(itemBase.financeiro?.valorCompra?.toFixed(2).replace('.', ',') || '');
      setValorAluguel(itemBase.financeiro?.valorAluguel?.toFixed(2).replace('.', ',') || '');
      setValorReposicao(itemBase.financeiro?.valorReposicao?.toFixed(2).replace('.', ',') || '');
      setTamanho(itemBase.especificacoes?.tamanho || ''); setCor(itemBase.especificacoes?.cor || '');
      setUnidadeMedida(itemBase.especificacoes?.unidadeMedida || 'Unidade');
      setLargura(itemBase.especificacoes?.largura || ''); setAltura(itemBase.especificacoes?.altura || '');
      setDiametro(itemBase.especificacoes?.diametro || ''); setComprimento(itemBase.especificacoes?.comprimento || '');
      
      if (!ehDecoracao) setTipoDisponibilidade(itemBase.configuracao?.tipoDisponibilidade || 'Aluguel');
      
      setVisivelCatalogo(itemBase.configuracao?.visivelCatalogo !== false);
      setNecessitaMontagem(itemBase.configuracao?.necessitaMontagem || 'Não');
      setVoltagem(itemBase.configuracao?.voltagem || 'Bivolt');
      setObservacoes(itemBase.observacoes || '');
      setPosicoesFoco(itemBase.posicoesFoco || {});
      
      if (itemBase.fotos && itemBase.fotos.length > 0) setFotos(itemBase.fotos);
      else if (itemBase.foto) setFotos([itemBase.foto]);
    
    } else if (dadosCompra) {
      setNome(dadosCompra.nome || '');
      setQuantidade(dadosCompra.quantidade || 1);
      if (dadosCompra.valorEstimado) setValorCompra(Number(dadosCompra.valorEstimado).toFixed(2).replace('.', ','));
      if (dadosCompra.valorAluguel) setValorAluguel(Number(dadosCompra.valorAluguel).toFixed(2).replace('.', ','));
      setFornecedor(dadosCompra.fornecedor || '');
      setObservacoes(dadosCompra.obs || '');
      setStatus('pintura'); 
    }
  }, [itemEditando, itemDuplicando, dadosCompra]);

  const gerarSKU = (cat) => {
    if (!cat) return '';
    const prefixo = cat.substring(0, 3).toUpperCase();
    let totalNaCategoria = itensExistentes.filter(i => i.categoria === cat && i.id !== itemEditando?.id).length;
    return `${prefixo}-${String(totalNaCategoria + 1).padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!itemEditando && itensExistentes.length > 0 && !codigo) {
        if (tipoCadastro === 'decoracao') {
            setCodigo(gerarSKU('DEC')); 
        } else if (categoria) {
            setCodigo(gerarSKU(categoria));
        }
    }
  }, [itensExistentes, categoria, tipoCadastro, itemEditando, codigo]);

  const handleCategoriaChange = (e) => {
    const novaCat = e.target.value;
    setCategoria(novaCat);
    setCodigo(gerarSKU(novaCat));
    if (listasSistema.subcategorias[novaCat] && listasSistema.subcategorias[novaCat].length > 0) {
        setSubCategoria(listasSistema.subcategorias[novaCat][0]);
    } else {
        setSubCategoria('');
    }
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

  const handleFileChange = async (e) => {
    const inputTarget = e.target;
    const files = Array.from(inputTarget.files);
    if (files.length === 0) return;

    inputTarget.value = ''; 

    const novasFotos = await Promise.all(files.map(file => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) { resolve(null); return; }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX = 800; 
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } 
                    else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => resolve(null);
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }));

    const fotosValidas = novasFotos.filter(f => f !== null);
    setFotos(prev => [...prev, ...fotosValidas]);
  };

  const removerFoto = (index) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
    if (index === fotoPrincipalIndex) setFotoPrincipalIndex(0);
  };

  const getFocoAtual = () => {
      const foco = posicoesFoco[fotoPrincipalIndex] || {};
      return { x: foco.x ?? 50, y: foco.y ?? 50, z: foco.z ?? 1 };
  };

  const getFocoThumb = (idx) => {
      const foco = posicoesFoco[idx] || {};
      return { x: foco.x ?? 50, y: foco.y ?? 50, z: foco.z ?? 1 };
  };

  const handlePointerDown = (e) => {
    setDragging(true);
    e.preventDefault(); 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartMouse({ x: clientX, y: clientY });
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startMouse.x;
    const deltaY = clientY - startMouse.y;
    setStartMouse({ x: clientX, y: clientY });
    setPosicoesFoco(prev => {
      const current = prev[fotoPrincipalIndex] || { x: 50, y: 50, z: 1 };
      const velocidade = 0.5 / (current.z || 1);
      let newX = (current.x ?? 50) - (deltaX * velocidade);
      let newY = (current.y ?? 50) - (deltaY * velocidade);
      return { ...prev, [fotoPrincipalIndex]: { ...current, x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) }};
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleZoomChange = (e) => {
    const novoZ = Number(e.target.value);
    setPosicoesFoco(prev => ({
        ...prev, 
        [fotoPrincipalIndex]: { ...(prev[fotoPrincipalIndex] || {x: 50, y: 50}), z: novoZ }
    }));
  };

  const atualizarPecaKitNova = (idx, campo, valor) => {
      const newPecas = [...pecasKitNovas];
      newPecas[idx][campo] = valor;
      setPecasKitNovas(newPecas);
  };

  const adicionarPecaAoKit = (peca) => {
      const jaExiste = itensDoKit.find(i => i.id === peca.id);
      if (jaExiste) {
          setItensDoKit(itensDoKit.map(i => i.id === peca.id ? {...i, qtd: i.qtd + 1} : i));
      } else {
          setItensDoKit([...itensDoKit, { id: peca.id, nome: peca.nome, precoOriginal: Number(peca.financeiro?.valorAluguel || 0), foto: peca.foto || peca.fotos?.[0] || '', qtd: 1 }]);
      }
  };

  const calcularTotalSomaAvulsaKit = () => {
      return itensDoKit.reduce((acc, item) => acc + (item.precoOriginal * item.qtd), 0);
  };

  const categoriasCatalogoUnicas = ['Todos', ...new Set(itensExistentes.map(item => item.categoria).filter(Boolean))];
  
  const itensCatalogoFiltrados = itensExistentes.filter(item => {
      return !item.especificacoes?.isDecoracao && !item.especificacoes?.isKitPai && 
             (item.nome || '').toLowerCase().includes(buscaCatalogo.toLowerCase()) && 
             (filtroCategoriaCatalogo === 'Todos' || item.categoria === filtroCategoriaCatalogo);
  });

  const salvarItem = async (e) => {
    e.preventDefault();

    const isDecoracao = tipoCadastro === 'decoracao';
    const isKitNovo = tipoCadastro === 'kit';

    if (!isDecoracao && !categoria) return alert("❌ Selecione a Categoria principal.");
    if (!isDecoracao && !subCategoria) return alert("❌ Selecione a Subcategoria.");
    if (!grupoTemaSelecionado) return alert("❌ Selecione o Grupo de Tema.");
    if (!temaSelecionado) return alert("❌ Selecione o Tema Específico.");
    
    if (isKitNovo && pecasKitNovas.some(p => !p.nome.trim() || !p.valorAluguel.trim())) {
        return alert("❌ Preencha o nome e o valor de aluguel de TODAS as peças do Kit Físico, ou remova as linhas vazias.");
    }

    if (isDecoracao && itensDoKit.length === 0) {
        return alert("❌ Uma Decoração Completa precisa ter pelo menos 1 peça dentro dela. Abra o catálogo e adicione as peças.");
    }

    setSalvando(true);
    try {
      const limparValor = (val) => Number(String(val).replace(',', '.'));
      
      const catFinal = isDecoracao ? 'Decoração Completa' : categoria;
      const subCatFinal = isDecoracao ? 'Pacote' : subCategoria;

      const dados = {
        nome, codigo, 
        categoria: catFinal, 
        subCategoria: subCatFinal, 
        grupoTema: grupoTemaSelecionado, tema: temaSelecionado,          
        status: isDecoracao ? 'ok' : status, 
        fornecedor: isDecoracao ? '' : fornecedor, 
        linkFornecedor: isDecoracao ? '' : linkFornecedor, 
        localizacao: isDecoracao ? '' : localizacao,
        quantidade: isDecoracao ? 0 : Number(quantidade), 
        estoqueMinimo: isDecoracao ? 0 : Number(estoqueMinimo),
        financeiro: { 
            valorCompra: isDecoracao ? 0 : limparValor(valorCompra), 
            valorAluguel: limparValor(valorAluguel), 
            valorReposicao: isDecoracao ? 0 : limparValor(valorReposicao) 
        },
        especificacoes: { 
            tamanho: tipoCadastro === 'avulsa' ? tamanho : '', 
            cor: tipoCadastro === 'avulsa' ? cor : '', 
            unidadeMedida, 
            largura: tipoCadastro === 'avulsa' ? Number(largura) : 0, 
            altura: tipoCadastro === 'avulsa' ? Number(altura) : 0, 
            diametro: tipoCadastro === 'avulsa' ? Number(diametro) : 0, 
            comprimento: tipoCadastro === 'avulsa' ? Number(comprimento) : 0,
            isDecoracao,
            isKitPai: isKitNovo, 
            itensDecoracao: isDecoracao ? itensDoKit : [],
            pecasKit: isKitNovo ? pecasKitNovas : []
        },
        configuracao: { 
            tipoDisponibilidade: isDecoracao ? 'Aluguel' : tipoDisponibilidade, 
            visivelCatalogo, 
            necessitaMontagem, 
            voltagem, 
            alertaEstoque: isDecoracao ? 'NaoAvisar' : alertaEstoque 
        },
        observacoes, fotos, posicoesFoco, foto: fotos.length > 0 ? fotos[0] : '', 
        atualizadoEm: serverTimestamp()
      };

      // 🔥 SE TIVER ITEM EDITANDO, ATUALIZA. SENÃO (NOVO OU CÓPIA), CRIA UM DOCUMENTO NOVO 🔥
      if (itemEditando) {
        await updateDoc(doc(db, "estoque", itemEditando.id), dados);
        alert("Item atualizado com sucesso!");
      } else {
        const docRef = await addDoc(collection(db, "estoque"), { ...dados, criadoEm: serverTimestamp() });
        const mainId = docRef.id;

        if (isKitNovo && pecasKitNovas.length > 0) {
            for (let i = 0; i < pecasKitNovas.length; i++) {
                const peca = pecasKitNovas[i];
                if (peca.nome.trim()) {
                    const valPeca = Number(peca.valorAluguel.replace(',', '.'));
                    const pecaDados = {
                        ...dados, 
                        nome: `${nome} - ${peca.nome}`, 
                        codigo: `${codigo}-P${i+1}`, 
                        financeiro: { ...dados.financeiro, valorAluguel: isNaN(valPeca) ? 0 : valPeca, valorCompra: 0, valorReposicao: 0 },
                        especificacoes: { 
                            ...dados.especificacoes, 
                            isKitPai: false, 
                            isSubPeca: true, 
                            kitPaiId: mainId, 
                            unidadeMedida: 'Unidade',
                            cor: peca.cor || '',
                            tamanho: peca.tamanho || '',
                            largura: Number(peca.largura) || 0,
                            altura: Number(peca.altura) || 0,
                            diametro: Number(peca.diametro) || 0,
                            comprimento: Number(peca.comprimento) || 0,
                            pecasKit: [],
                            itensDecoracao: []
                        },
                        quantidade: Number(quantidade) 
                    };
                    await addDoc(collection(db, "estoque"), { ...pecaDados, criadoEm: serverTimestamp() });
                }
            }
        }

        if (isDecoracao) alert("✨ Decoração Completa salva! Pronta para ser alugada.");
        else if (isKitNovo) alert("📦 Kit desmembrado salvo com sucesso!");
        else alert(itemDuplicando ? "📋 Peça duplicada com sucesso!" : "🧩 Peça adicionada com sucesso!");
      }
      navigate('/estoque');
    } catch (error) { alert("Erro ao salvar."); } 
    finally { setSalvando(false); }
  };

  const handleTextChange = (setter) => (e) => {
    const input = e.target.value;
    setter(input.charAt(0).toUpperCase() + input.slice(1).toLowerCase());
  };

  const focoAtual = getFocoAtual();

  return (
    <div className="page-container">
      <div className="page-header" style={{marginBottom: '20px'}}>
        <div className="header-text">
          <h1 className="page-title">
            {/* 🔥 MUDA O TÍTULO PARA AVISAR QUE ESTÁ DUPLICANDO 🔥 */}
            {itemEditando ? 'EDITAR ITEM DO ACERVO' : itemDuplicando ? '📋 DUPLICAR ITEM DO ACERVO' : dadosCompra ? '✨ FINALIZAR CADASTRO DE COMPRA' : 'NOVO ITEM DO ACERVO'}
          </h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>
            {itemDuplicando ? 'Altere as especificações (como cor ou tamanho) da nova peça antes de salvar.' : dadosCompra ? 'Você indicou que já comprou este item! Adicione a foto, confira o status e salve no acervo.' : 'Configure as regras de estoque e detalhes da peça'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <form onSubmit={salvarItem} style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          <div style={{ width: '100%', maxWidth: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 className="section-divider" style={{marginTop: 0, fontSize: '13px'}}>FOTOS DO PRODUTO</h3>
                
                <div style={{ width: '100%', height: '280px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {fotos.length > 0 ? (
                    <>
                    <img 
                        src={fotos[fotoPrincipalIndex]} 
                        style={{ 
                          width: '100%', height: '100%', 
                          objectFit: 'contain', /* 🔥 A MÁGICA ACONTECE AQUI: Mudamos de 'cover' para 'contain' 🔥 */
                          objectPosition: `${focoAtual.x}% ${focoAtual.y}%`, 
                          transform: `scale(${focoAtual.z})`,
                          cursor: dragging ? 'grabbing' : 'grab',
                          transition: dragging ? 'none' : 'transform 0.2s ease-out'
                        }} 
                        onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}
                        onMouseMove={handlePointerMove} onTouchMove={handlePointerMove}
                        onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchEnd={handlePointerUp}
                    />
                    <div style={{position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', pointerEvents: 'none'}}>
                        <span style={{background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', padding: '6px 12px', borderRadius: '12px', fontWeight: 'bold'}}>✥ Arrastar para enquadrar</span>
                    </div>
                    </>
                ) : (
                    <label htmlFor="upload-principal" style={{cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                    <span style={{fontSize:'45px', opacity:0.3, marginBottom: '10px'}}>📷</span>
                    <span style={{color: '#64748b', fontWeight: 'bold', fontSize: '13px'}}>Clique para adicionar fotos</span>
                    <input id="upload-principal" type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                    </label>
                )}
                </div>
                
                {fotos.length > 0 && (
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', margin: '15px 0', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                        <span style={{fontSize: '14px', color: '#64748b'}}>🔍-</span>
                        <input type="range" min="1" max="3" step="0.1" value={focoAtual.z} onChange={handleZoomChange} style={{flex: 1, cursor: 'pointer'}} />
                        <span style={{fontSize: '14px', color: '#64748b'}}>🔍+</span>
                    </div>
                )}
                
                {fotos.length > 0 && (
                    <div className="photo-thumbnails-row" style={{display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px'}}>
                    {fotos.map((f, idx) => {
                        const tFoco = getFocoThumb(idx);
                        return (
                        <div key={idx} style={{width: '60px', height: '60px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', border: idx === fotoPrincipalIndex ? '2px solid #0f172a' : '1px solid #cbd5e1', position: 'relative', cursor: 'pointer'}} onClick={() => setFotoPrincipalIndex(idx)}>
                            {/* 🔥 A MÁGICA NAS MINIATURAS TAMBÉM 🔥 */}
                            <img src={f} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: `${tFoco.x}% ${tFoco.y}%`, transform: `scale(${tFoco.z})` }} />
                            <button type="button" onClick={(e) => {e.stopPropagation(); removerFoto(idx)}} style={{position: 'absolute', top: 0, right: 0, background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>×</button>
                        </div>
                    )})}
                    <label title="Adicionar mais fotos" style={{width: '60px', height: '60px', flexShrink: 0, borderRadius: '6px', border: '1px dashed #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', color: '#94a3b8', background: '#f8fafc'}}>
                        +
                        <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                    </label>
                    </div>
                )}
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <label style={{color: '#0f172a', fontWeight: '900', display: 'block', marginBottom: '15px', fontSize: '14px', textTransform: 'uppercase'}}>O QUE ESTAMOS CADASTRANDO?</label>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px'}}>
                  
                  <div onClick={() => { setTipoCadastro('avulsa'); setUnidadeMedida('Unidade'); }} style={{padding: '12px 15px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', border: tipoCadastro === 'avulsa' ? '2px solid #0f172a' : '1px solid #cbd5e1', background: tipoCadastro === 'avulsa' ? '#0f172a' : '#fff'}}>
                    <strong style={{color: tipoCadastro === 'avulsa' ? '#fff' : '#0f172a', fontSize: '14px', display: 'block'}}>🧩 Peça Avulsa</strong>
                    <span style={{color: tipoCadastro === 'avulsa' ? '#94a3b8' : '#64748b', fontSize: '11px'}}>Uma unidade única (ex: Bandeja P)</span>
                  </div>
                  
                  <div onClick={() => { setTipoCadastro('kit'); setUnidadeMedida('Kit'); }} style={{padding: '12px 15px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', border: tipoCadastro === 'kit' ? '2px solid #3b82f6' : '1px solid #cbd5e1', background: tipoCadastro === 'kit' ? '#eff6ff' : '#fff'}}>
                    <strong style={{color: '#1d4ed8', fontSize: '14px', display: 'block'}}>📦 Kit Físico (Nova Compra)</strong>
                    <span style={{color: '#3b82f6', fontSize: '11px'}}>Peças compradas juntas que serão desmembradas.</span>
                  </div>

                  <div onClick={() => { setTipoCadastro('decoracao'); setUnidadeMedida('Combo'); setTipoDisponibilidade('Aluguel'); }} style={{padding: '12px 15px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', border: tipoCadastro === 'decoracao' ? '2px solid #c5a059' : '1px solid #cbd5e1', background: tipoCadastro === 'decoracao' ? '#fffbeb' : '#fff'}}>
                    <strong style={{color: '#b45309', fontSize: '14px', display: 'block'}}>✨ Decoração Completa</strong>
                    <span style={{color: '#c5a059', fontSize: '11px'}}>Agrupar peças que JÁ EXISTEM no seu estoque.</span>
                  </div>

                </div>
                
                {tipoCadastro === 'decoracao' && (
                  <div style={{borderTop: '1px dashed #fde68a', paddingTop: '15px'}}>
                    <label style={{color: '#b45309', fontWeight: '900', marginBottom: '5px', display: 'block', fontSize: '12px', textTransform: 'uppercase'}}>PEÇAS DO ACERVO NESTE KIT:</label>
                    <p style={{fontSize: '11.5px', color: '#92400e', marginBottom: '15px', lineHeight: '1.4'}}>
                      Ao alugar esta decoração, o sistema irá bloquear as peças abaixo no calendário automaticamente.
                    </p>
                    
                    <button type="button" onClick={() => setModalCatalogoAberto(true)} style={{width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', transition: '0.2s'}} onMouseEnter={e=>e.currentTarget.style.background='#1e293b'} onMouseLeave={e=>e.currentTarget.style.background='#0f172a'}>
                        <span>+</span> ABRIR CATÁLOGO DE PEÇAS
                    </button>
                    
                    {itensDoKit.length > 0 ? (
                        <div style={{background: '#ffffff', borderRadius: '8px', border: '1px solid #fde68a', overflow: 'hidden'}}>
                            {itensDoKit.map((item, idx) => (
                                <div key={item.id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderBottom: idx !== itensDoKit.length - 1 ? '1px solid #fef3c7' : 'none'}}>
                                    <div style={{width: '35px', height: '35px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden', flexShrink: 0}}>
                                        {item.foto ? <img src={item.foto} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : ''}
                                    </div>
                                    <div style={{flex: 1, overflow: 'hidden'}}>
                                        <strong style={{fontSize: '12px', color: '#0f172a', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}} title={item.nome}>{item.nome}</strong>
                                        <span style={{fontSize: '11px', color: '#64748b'}}>R$ {item.precoOriginal.toFixed(2)}</span>
                                    </div>
                                    <div style={{display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', padding: '2px'}}>
                                        <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? {...i, qtd: Math.max(1, i.qtd - 1)} : i))} style={{border: 'none', background: 'white', borderRadius: '4px', width: '22px', height: '22px', fontWeight: 'bold', cursor: 'pointer'}}>-</button>
                                        <span style={{fontSize: '12px', fontWeight: 'bold', width: '20px', textAlign: 'center'}}>{item.qtd}</span>
                                        <button type="button" onClick={() => setItensDoKit(itensDoKit.map(i => i.id === item.id ? {...i, qtd: i.qtd + 1} : i))} style={{border: 'none', background: 'white', borderRadius: '4px', width: '22px', height: '22px', fontWeight: 'bold', cursor: 'pointer'}}>+</button>
                                    </div>
                                    <button type="button" onClick={() => setItensDoKit(itensDoKit.filter(i => i.id !== item.id))} style={{background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', padding: '0 5px'}}>×</button>
                                </div>
                            ))}
                            
                            <div style={{background: '#fffbeb', padding: '12px', textAlign: 'center', borderTop: '1px dashed #fde68a'}}>
                                <span style={{fontSize: '11px', color: '#b45309', display: 'block', marginBottom: '2px'}}>Soma avulsa das peças (Referência):</span>
                                <strong style={{fontSize: '16px', color: '#92400e'}}>R$ {calcularTotalSomaAvulsaKit().toFixed(2)}</strong>
                            </div>
                        </div>
                    ) : (
                        <div style={{textAlign: 'center', padding: '20px', color: '#b45309', border: '1px dashed #fcd34d', borderRadius: '8px', fontSize: '12px', background: '#fff'}}>
                            Nenhuma peça incluída na decoração.
                        </div>
                    )}
                  </div>
                )}

                {tipoCadastro === 'kit' && (
                  <div className="kit-builder" style={{borderTop: '1px dashed #93c5fd', paddingTop: '15px'}}>
                    <label style={{color: '#1d4ed8', fontWeight: 'bold', marginBottom: '5px', display: 'block', fontSize: '12px'}}>PEÇAS QUE CHEGARAM NESTE KIT:</label>
                    <p style={{fontSize: '11.5px', color: '#3b82f6', marginBottom: '15px', lineHeight: '1.4'}}>
                      Digite os nomes das peças filhas. O sistema criará um cadastro para cada uma no acervo.
                    </p>
                    
                    {pecasKitNovas.map((p, idx) => (
                      <div key={p.id} style={{background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', marginBottom: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'}}>
                        
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 80px 30px', gap: '8px', marginBottom: '8px'}}>
                          <input type="text" placeholder={`Ex: Cilindro P`} value={p.nome} onChange={e => atualizarPecaKitNova(idx, 'nome', e.target.value)} style={{width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box'}} />
                          <input type="text" placeholder="R$ Alug." value={p.valorAluguel} onChange={e => atualizarPecaKitNova(idx, 'valorAluguel', e.target.value)} onBlur={e => {
                              let val = e.target.value.replace(',', '.');
                              const num = parseFloat(val);
                              if(!isNaN(num)) atualizarPecaKitNova(idx, 'valorAluguel', num.toFixed(2).replace('.', ','));
                          }} style={{width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box'}} />
                          <button type="button" onClick={() => setPecasKitNovas(pecasKitNovas.filter(item => item.id !== p.id))} style={{background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', height: '100%', width: '100%', cursor: 'pointer', fontWeight: 'bold'}}>X</button>
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px'}}>
                          <input type="text" placeholder="Cor" value={p.cor} onChange={e => atualizarPecaKitNova(idx, 'cor', e.target.value)} style={{width: '100%', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box'}} />
                          <select value={p.tamanho} onChange={e => atualizarPecaKitNova(idx, 'tamanho', e.target.value)} style={{width: '100%', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box'}}>
                            <option value="" disabled hidden>Tamanho...</option>
                            {listasSistema.tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px'}}>
                          <input type="number" placeholder="Larg" value={p.largura} onChange={e => atualizarPecaKitNova(idx, 'largura', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', boxSizing: 'border-box'}} title="Largura" />
                          <input type="number" placeholder="Alt" value={p.altura} onChange={e => atualizarPecaKitNova(idx, 'altura', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', boxSizing: 'border-box'}} title="Altura"/>
                          <input type="number" placeholder="Diâm" value={p.diametro} onChange={e => atualizarPecaKitNova(idx, 'diametro', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', boxSizing: 'border-box'}} title="Diâmetro"/>
                          <input type="number" placeholder="Comp" value={p.comprimento} onChange={e => atualizarPecaKitNova(idx, 'comprimento', e.target.value)} style={{width: '100%', padding: '8px 4px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', boxSizing: 'border-box'}} title="Comprimento"/>
                        </div>

                      </div>
                    ))}
                    <button type="button" onClick={() => setPecasKitNovas([...pecasKitNovas, { id: Date.now(), nome: '', valorAluguel: '', cor: '', tamanho: '', largura: '', altura: '', diametro: '', comprimento: '' }])} style={{background: '#eff6ff', color: '#1d4ed8', border: '2px dashed #93c5fd', width: '100%', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'}}>+ Adicionar Peça Filha</button>
                  </div>
                )}

                {tipoCadastro === 'avulsa' && (
                  <div className="single-item-builder" style={{borderTop: '1px solid #e2e8f0', paddingTop: '20px'}}>
                    <label style={{color: '#64748b', fontWeight: 'bold', marginBottom: '12px', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>ESPECIFICAÇÕES DA PEÇA (Opcional)</label>
                    
                    <div style={{display: 'flex', gap: '10px', marginBottom: '12px'}}>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>TAMANHO</label>
                        <select value={tamanho} onChange={e => setTamanho(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}}>
                          <option value="" disabled hidden>Selecione...</option>
                          {listasSistema.tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>COR</label>
                        <input value={cor} onChange={handleTextChange(setCor)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>UNIDADE</label>
                        <select value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}}>
                          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{display: 'flex', gap: '10px', marginBottom: '12px'}}>
                      <div style={{flex: 1}}>
                        {categoria === "Iluminação" ? (
                          <>
                            <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>VOLTAGEM</label>
                            <select value={voltagem} onChange={e => setVoltagem(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}}>
                              <option value="Bivolt">Bivolt</option><option value="110v">110v</option><option value="220v">220v</option>
                            </select>
                          </>
                        ) : (
                          <>
                            <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>MONTAGEM?</label>
                            <select value={necessitaMontagem} onChange={e => setNecessitaMontagem(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}}>
                              <option value="Não">Não (Pegue/Monte)</option><option value="Sim">Sim (Equipe)</option>
                            </select>
                          </>
                        )}
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>LARG(cm)</label>
                        <input type="number" value={largura} onChange={e => setLargura(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>ALT(cm)</label>
                        <input type="number" value={altura} onChange={e => setAltura(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                      </div>
                    </div>

                    <div style={{display: 'flex', gap: '10px'}}>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>DIÂM(cm)</label>
                        <input type="number" value={diametro} onChange={e => setDiametro(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                      </div>
                      <div style={{flex: 1}}>
                        <label style={{fontSize:'10px', fontWeight:'bold', color:'#64748b'}}>COMP(cm)</label>
                        <input type="number" value={comprimento} onChange={e => setComprimento(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none'}} />
                      </div>
                      <div style={{flex: 1}}></div>
                    </div>
                  </div>
                )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '0', background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            
            <h3 className="section-divider" style={{marginTop: 0}}>IDENTIFICAÇÃO E REGRAS</h3>
            <div className="form-grid-4">
              <div className="form-group span-3"><label>NOME {tipoCadastro === 'decoracao' ? 'DA DECORAÇÃO' : 'DA PEÇA'} *</label><input value={nome} onChange={handleTextChange(setNome)} required placeholder={tipoCadastro === 'decoracao' ? "Ex: Decoração Completa Safari" : "Ex: Vaso Dourado"} /></div>
              <div className="form-group span-1"><label>CÓDIGO SKU</label><input value={codigo} readOnly style={{backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 'bold', border: '1px dashed #cbd5e1'}} /></div>
              
              {tipoCadastro !== 'decoracao' && (
                <div className="span-4 flex-row-always">
                  <div className="form-group"><label>CATEGORIA *</label><select value={categoria} onChange={handleCategoriaChange} required><option value="" disabled hidden>Selecione...</option>{listasSistema.categorias.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="form-group"><label>SUBCATEGORIA *</label><select value={subCategoria} onChange={e => setSubCategoria(e.target.value)} required><option value="" disabled hidden>Selecione...</option>{listasSistema.subcategorias[categoria]?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
              )}
              
              <div className="span-4 flex-row-always">
                <div className="form-group"><label>GRUPO DE TEMA *</label><select value={grupoTemaSelecionado} onChange={handleGrupoTemaChange} required><option value="" disabled hidden>Selecione o Grupo</option>{listasSistema.gruposTema.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                <div className="form-group"><label>TEMA ESPECÍFICO *</label><select value={temaSelecionado} onChange={e => setTemaSelecionado(e.target.value)} disabled={!grupoTemaSelecionado} required><option value="" disabled hidden>Selecione o Tema...</option>{listasSistema.temasPorGrupo[grupoTemaSelecionado]?.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
            </div>

            <div style={{ opacity: tipoCadastro === 'decoracao' ? 0.3 : 1, pointerEvents: tipoCadastro === 'decoracao' ? 'none' : 'auto', transition: '0.3s' }}>
                <h3 className="section-divider mt-compact">FORNECEDOR E REPOSIÇÃO</h3>
                <div className="form-grid-4">
                <div className="form-group span-2"><label>FORNECEDOR (LOJA)</label><input value={fornecedor} onChange={handleTextChange(setFornecedor)} placeholder="Onde você comprou?" tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/></div>
                <div className="form-group span-2"><label>URL / LINK DE COMPRA</label><input value={linkFornecedor} onChange={(e) => setLinkFornecedor(e.target.value)} placeholder="Cole o link do produto aqui..." tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/></div>
                
                <div className="span-4 flex-row-always">
                    <div className="form-group"><label>VALOR DE COMPRA (R$)</label><input type="text" value={valorCompra} onChange={e => setValorCompra(e.target.value)} onBlur={formatarMoedaBlur(setValorCompra)} placeholder="0,00" tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/></div>
                    <div className="form-group"><label>CUSTO P/ REPOSIÇÃO (R$)</label><input type="text" value={valorReposicao} onChange={e => setValorReposicao(e.target.value)} onBlur={formatarMoedaBlur(setValorReposicao)} placeholder="0,00" tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/></div>
                </div>
                </div>
            </div>

            <h3 className="section-divider mt-compact" style={{color: '#c5a059', borderBottomColor: '#fde68a'}}>💰 PRECIFICAÇÃO PARA O CLIENTE</h3>
            <div className="form-grid-4">
                <div className="form-group span-2">
                    <label style={{color: '#b45309', fontWeight: 900, fontSize: '13px'}}>{tipoCadastro === 'decoracao' ? 'PREÇO DA DECORAÇÃO COMPLETA (R$) *' : 'VALOR DO ALUGUEL (R$) *'}</label>
                    <input type="text" value={valorAluguel} onChange={e => setValorAluguel(e.target.value)} onBlur={formatarMoedaBlur(setValorAluguel)} required style={{borderColor: '#c5a059', backgroundColor: '#fffbeb', fontSize: '18px', fontWeight: 'bold', padding: '15px'}} placeholder="0,00"/>
                </div>
            </div>

            <div style={{ opacity: tipoCadastro === 'decoracao' ? 0.3 : 1, pointerEvents: tipoCadastro === 'decoracao' ? 'none' : 'auto', transition: '0.3s' }}>
                <h3 className="section-divider mt-compact">CONTROLE DE ESTOQUE</h3>
                <div className="form-grid-4">
                <div className="span-4 flex-row-always">
                    <div className="form-group">
                        <label>QUANTIDADE FÍSICA TOTAL</label>
                        {tipoCadastro === 'decoracao' ? (
                            <div style={{padding: '12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '12px', color: '#64748b', fontWeight: 'bold', border: '1px solid #cbd5e1', textAlign: 'center'}}>
                                DINÂMICO (Baseado nas peças)
                            </div>
                        ) : (
                            <input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} min="1" tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/>
                        )}
                    </div>
                    <div className="form-group"><label>ESTOQUE MÍNIMO</label><input type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} disabled={alertaEstoque === 'NaoAvisar'} tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}/></div>
                </div>
                
                <div className="form-group span-4"><label style={{color: '#10b981', fontWeight: 800}}>ALERTA DE ESTOQUE BAIXO</label><select value={alertaEstoque} onChange={e => setAlertaEstoque(e.target.value)} tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}><option value="NaoAvisar">Não avisar mínimo</option><option value="Avisar">Avisar se atingir o mínimo</option></select></div>
                
                <div className="span-4 flex-row-always">
                    <div className="form-group">
                    <label>STATUS ATUAL DA PEÇA</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} style={{fontWeight: 'bold', color: status === 'pintura' ? '#d97706' : status === 'manutencao' ? '#ef4444' : '#10b981'}} tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}>
                        <option value="ok">✅ Pronto para Uso (Disponível)</option>
                        <option value="pintura">🎨 Precisa de Pintura / Acabamento</option>
                        <option value="manutencao">🛠️ Em Manutenção / Quebrado</option>
                    </select>
                    </div>
                    <div className="form-group"><label>LOCALIZAÇÃO FÍSICA (GALPÃO)</label><select value={localizacao} onChange={e => setLocalizacao(e.target.value)} tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}><option value="" disabled hidden>Selecione...</option>{listasSistema.localizacoes.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                </div>
                </div>
            </div>

            <h3 className="section-divider mt-compact">VISIBILIDADE E OBSERVAÇÕES</h3>
            <div className="form-grid-4">
              <div className="form-group span-4" style={{ opacity: tipoCadastro === 'decoracao' ? 0.3 : 1, pointerEvents: tipoCadastro === 'decoracao' ? 'none' : 'auto' }}>
                  <label>DISPONÍVEL PARA:</label>
                  <select value={tipoDisponibilidade} onChange={e => setTipoDisponibilidade(e.target.value)} tabIndex={tipoCadastro === 'decoracao' ? -1 : 0}>
                      <option value="Aluguel">Aluguel (Retorna ao estoque)</option>
                      <option value="Venda">Venda (Sai do estoque para sempre)</option>
                  </select>
              </div>
              
              <div className="form-group span-4" style={{marginTop: '5px'}}>
                <div className={`ios-toggle-wrapper ${visivelCatalogo ? 'active' : ''}`} onClick={() => setVisivelCatalogo(!visivelCatalogo)}>
                  <div className="ios-toggle-switch"><div className="ios-toggle-knob"></div></div>
                  <span className="ios-toggle-text">{visivelCatalogo ? ' 🌐 VISÍVEL NO CATÁLOGO ONLINE' : '🔒 OCULTO DO CATÁLOGO'}</span>
                </div>
              </div>
              
              <div className="form-group span-4"><label>ANOTAÇÕES INTERNAS</label><textarea rows="3" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Dicas de montagem, cuidados com a peça, etc..."></textarea></div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <Link to={dadosCompra ? "/compras" : "/estoque"} style={{ padding: '16px 30px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: 'bold', textDecoration: 'none', transition: '0.2s' }}>Cancelar</Link>
              <button type="submit" style={{ padding: '16px 40px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', fontSize: '16px', letterSpacing: '0.5px', boxShadow: '0 4px 15px rgba(15,23,42,0.3)', transition: '0.2s' }} disabled={salvando} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  {salvando ? 'Salvando...' : (tipoCadastro === 'decoracao' ? '💾 SALVAR DECORAÇÃO COMPLETA' : '💾 SALVAR NO ACERVO')}
              </button>
            </div>

          </div>
        </form>
      </div>

      {modalCatalogoAberto && (
        <div className="modal-overlay-premium" style={{ zIndex: 99999 }}>
          <div className="modal-box-premium catalogo-modal" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
            
            <div className="modal-header" style={{ padding: '20px 30px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>📦 Catálogo do Acervo <span style={{color: '#64748b', fontSize: '14px'}}>(Escolha as peças do Kit)</span></h3>
              <button className="btn-fechar" onClick={() => setModalCatalogoAberto(false)}>X</button>
            </div>
            
            <div className="catalogo-filtros" style={{ padding: '15px 30px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <input type="text" className="search-input-clean" style={{ border: '1px solid #cbd5e1', padding: '14px 18px', borderRadius: '8px', width: '100%', maxWidth: '500px', fontSize: '15px', outline: 'none' }} placeholder="🔎 Buscar peça no acervo..." value={buscaCatalogo} onChange={e => setBuscaCatalogo(e.target.value)} onFocus={e => e.target.style.borderColor = '#0f172a'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
              <div className="chips-categorias" style={{ marginTop: '15px', gap: '8px' }}>
                {categoriasCatalogoUnicas.map(cat => (
                  <button key={cat} type="button" className={`chip-cat ${filtroCategoriaCatalogo === cat ? 'active' : ''}`} onClick={() => setFiltroCategoriaCatalogo(cat)}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="catalogo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', overflowY: 'auto', padding: '20px 30px', background: '#f1f5f9', flexGrow: 1 }}>
              {itensCatalogoFiltrados.map(item => {
                const qtdFisica = parseInt(item.quantidade || 0) || parseInt(item.estoque || 0) || 0;
                const qtdManutencao = parseInt(item.manutencao || 0) || parseInt(item.emManutencao || 0) || parseInt(item.qtdManutencao || 0) || parseInt(item.avariadas || 0) || parseInt(item.defeito || 0) || parseInt(item.quebradas || 0) || 0;
                const totalFisicoReal = Math.max(0, qtdFisica - qtdManutencao);

                const pecaNoKit = itensDoKit.find(i => i.id === item.id);
                const qtdNoKit = pecaNoKit ? pecaNoKit.qtd : 0;
                const foiAdicionado = qtdNoKit > 0;

                return (
                  <div key={item.id} onClick={() => adicionarPecaAoKit(item)} style={{ background: '#fff', border: foiAdicionado ? '2px solid #10b981' : '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '280px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}>
                    
                    <div style={{ height: '140px', width: '100%', flexShrink: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.foto ? <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{fontSize:'35px'}}>📷</span>}
                    </div>
                    
                    <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                        <div>
                            <strong style={{ fontSize: '14px', color: '#0f172a', marginBottom: '2px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.nome}</strong>
                            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>{item.categoria}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                            <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 'bold', display: 'block' }}>ESTOQUE FÍSICO</span>
                                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{totalFisicoReal}</strong>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                <button style={{ width: '32px', height: '32px', background: '#0f172a', color: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', border: 'none', cursor: 'pointer' }}>
                                    +
                                </button>
                                {foiAdicionado && (
                                    <span style={{background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', position: 'absolute', top: '10px', right: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>No Kit: {qtdNoKit}</span>
                                )}
                            </div>
                        </div>
                    </div>
                  </div>
                );
              })}
              {itensCatalogoFiltrados.length === 0 && <p style={{ color: '#64748b', gridColumn: '1 / -1', textAlign: 'center', marginTop: '30px', fontSize: '15px' }}>Nenhuma peça avulsa encontrada com este nome.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroEstoque;