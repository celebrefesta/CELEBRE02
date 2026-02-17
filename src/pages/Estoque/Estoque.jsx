import React, { useState, useEffect } from 'react';
import './Estoque.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';

const Estoque = () => {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  const [modalAberto, setModalAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  
  // NOVO ESTADO PARA O ZOOM DA IMAGEM
  const [imagemAmpliada, setImagemAmpliada] = useState(null);

  // --- ESTADOS DO FORMULÁRIO ---
  const [fotos, setFotos] = useState([]);
  const [fotoPrincipalIndex, setFotoPrincipalIndex] = useState(0);
  
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('Móveis');
  const [quantidade, setQuantidade] = useState(1);
  const [estoqueMinimo, setEstoqueMinimo] = useState(2);
  const [fornecedor, setFornecedor] = useState('');
  
  // Financeiro
  const [valorCompra, setValorCompra] = useState('');
  const [valorAluguel, setValorAluguel] = useState('');
  const [valorReposicao, setValorReposicao] = useState('');

  // Especificações
  const [tamanho, setTamanho] = useState('');
  const [cor, setCor] = useState('');
  const [unidadeMedida, setUnidadeMedida] = useState('Unidade');
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [diametro, setDiametro] = useState('');
  const [comprimento, setComprimento] = useState('');

  // Config e Status
  const [tipoDisponibilidade, setTipoDisponibilidade] = useState('Aluguel');
  const [visivelCatalogo, setVisivelCatalogo] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState('ok'); 

  const categorias = ["Móveis", "Painéis", "Vasos", "Boleiras", "Bandejas", "Personagens", "Estruturas", "Iluminação", "Tapetes", "Outros"];
  const tamanhos = ["P", "M", "G", "GG", "Único", "Padrão"];
  const unidades = ["Unidade", "Par", "Metro", "Jogo", "Kit", "Peça"];

  useEffect(() => { carregarEstoque(); }, []);

  const carregarEstoque = async () => {
    try {
      const q = query(collection(db, "estoque"), orderBy("criadoEm", "desc"));
      const querySnapshot = await getDocs(q);
      const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItens(lista);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const gerarSKU = (cat) => {
    const prefixo = cat.substring(0, 3).toUpperCase();
    const total = itens.filter(i => i.categoria === cat).length;
    return `${prefixo}-${String(total + 1).padStart(3, '0')}`;
  };

  const alternarStatus = async (item) => {
    try {
      const novoStatus = item.status === 'manutencao' ? 'ok' : 'manutencao';
      await updateDoc(doc(db, "estoque", item.id), { status: novoStatus });
      carregarEstoque(); 
    } catch (error) { alert("Erro ao atualizar status"); }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => { setFotos(prev => [...prev, reader.result]); };
      reader.readAsDataURL(file);
    });
  };

  const removerFoto = (index) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
    if (index === fotoPrincipalIndex) setFotoPrincipalIndex(0);
  };

  const salvarItem = async (e, salvarENovo = false) => {
    if(e) e.preventDefault();
    try {
      const dados = {
        nome, codigo, categoria, status, fornecedor,
        quantidade: Number(quantidade),
        estoqueMinimo: Number(estoqueMinimo),
        financeiro: {
          valorCompra: Number(valorCompra),
          valorAluguel: Number(valorAluguel),
          valorReposicao: Number(valorReposicao)
        },
        especificacoes: {
          tamanho, cor, unidadeMedida,
          largura: Number(largura), altura: Number(altura),
          diametro: Number(diametro), comprimento: Number(comprimento)
        },
        configuracao: { tipoDisponibilidade, visivelCatalogo },
        observacoes,
        fotos,
        foto: fotos.length > 0 ? fotos[0] : '', 
        atualizadoEm: serverTimestamp()
      };

      if (itemEditando) {
        await updateDoc(doc(db, "estoque", itemEditando.id), dados);
      } else {
        await addDoc(collection(db, "estoque"), { ...dados, criadoEm: serverTimestamp() });
      }
      
      if (salvarENovo) { abrirModal(); } else { setModalAberto(false); }
      carregarEstoque();
    } catch (error) { alert("Erro ao salvar."); }
  };

  const abrirModal = (item = null) => {
    setItemEditando(item);
    setFotoPrincipalIndex(0);

    if(item) {
      setNome(item.nome); setCodigo(item.codigo); setCategoria(item.categoria);
      setQuantidade(item.quantidade); setEstoqueMinimo(item.estoqueMinimo);
      setFornecedor(item.fornecedor || '');
      setValorCompra(item.financeiro?.valorCompra || '');
      setValorAluguel(item.financeiro?.valorAluguel || '');
      setValorReposicao(item.financeiro?.valorReposicao || '');
      setTamanho(item.especificacoes?.tamanho || '');
      setCor(item.especificacoes?.cor || '');
      setUnidadeMedida(item.especificacoes?.unidadeMedida || 'Unidade');
      setLargura(item.especificacoes?.largura || '');
      setAltura(item.especificacoes?.altura || '');
      setDiametro(item.especificacoes?.diametro || '');
      setComprimento(item.especificacoes?.comprimento || '');
      setTipoDisponibilidade(item.configuracao?.tipoDisponibilidade || 'Aluguel');
      setVisivelCatalogo(item.configuracao?.visivelCatalogo !== false);
      setObservacoes(item.observacoes || '');
      setStatus(item.status || 'ok');

      if (item.fotos && item.fotos.length > 0) setFotos(item.fotos);
      else if (item.foto) setFotos([item.foto]);
      else setFotos([]);

    } else {
      setNome(''); setCategoria('Móveis'); setQuantidade(1); setEstoqueMinimo(2);
      setCodigo(gerarSKU('Móveis')); setFornecedor('');
      setValorCompra(''); setValorAluguel(''); setValorReposicao('');
      setTamanho(''); setCor(''); setUnidadeMedida('Unidade');
      setLargura(''); setAltura(''); setDiametro(''); setComprimento('');
      setTipoDisponibilidade('Aluguel'); setVisivelCatalogo(true); setObservacoes('');
      setStatus('ok'); setFotos([]);
    }
    setModalAberto(true);
  };

  const totalItens = itens.length;
  const valorAcervo = itens.reduce((acc, i) => acc + ((i.financeiro?.valorReposicao || i.financeiro?.valorCompra || 0) * i.quantidade), 0);
  const emManutencao = itens.filter(i => i.status === 'manutencao').length;
  const visiveis = itens.filter(i => i.visivelCatalogo !== false).length;
  const percentualVisivel = totalItens > 0 ? Math.round((visiveis / totalItens) * 100) : 0;

  return (
    <div className="estoque-premium">
      <div className="header-top">
        <div className="titulo-bloco"><h1>Gestão de Acervo e Estoque</h1><p>Controle logístico, financeiro e catálogo online.</p></div>
        <div className="acoes-top"><button className="btn-dark-blue" onClick={() => abrirModal()}>+ Novo Item</button></div>
      </div>

      <div className="stats-row">
        <div className="card-stat"><span className="label-stat">TOTAL DE ITENS</span><div className="value-stat">{totalItens}</div><div className="icon-stat">📦</div></div>
        <div className="card-stat"><span className="label-stat">VALOR DO ACERVO</span><div className="value-stat">R$ {valorAcervo.toLocaleString('pt-BR')}</div><div className="icon-stat">📊</div></div>
        <div className="card-stat"><span className="label-stat">EM MANUTENÇÃO</span><div className="value-stat text-orange">{emManutencao}</div><div className="icon-stat">🛠️</div></div>
        <div className="card-stat"><span className="label-stat">VISÍVEL NO CATÁLOGO</span><div className="value-stat text-green">{percentualVisivel}%</div><div className="icon-stat">👁️</div></div>
      </div>

      <div className="filter-wrapper">
        <input className="search-input" placeholder="Buscar por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
        <div className="filter-controls"><button className="btn-filter">🔍 Filtrar</button></div>
      </div>

      <div className="table-container">
        <table className="table-pro">
          <thead><tr><th width="35%">PRODUTO</th><th>CATEGORIA</th><th>ESTOQUE</th><th>STATUS</th><th style={{textAlign:'right'}}>AÇÕES</th></tr></thead>
          <tbody>
            {itens.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase())).map(item => (
              <tr key={item.id}>
                <td>
                  <div className="prod-detail">
                    {/* FOTO CLICÁVEL AQUI */}
                    {item.foto ? (
                      <img 
                        src={item.foto} 
                        className="thumb-img clickable-thumb" 
                        onClick={() => setImagemAmpliada(item.foto)} 
                        title="Clique para ampliar"
                      />
                    ) : (
                      <div className="no-thumb">📷</div>
                    )}
                    <div><strong>{item.nome}</strong><span className="sub-text">CÓD: {item.codigo}</span></div>
                  </div>
                </td>
                <td><span className="tag-loc">{item.categoria}</span></td>
                <td><div className="stock-info"><span className={item.quantidade <= item.estoqueMinimo ? 'text-red' : 'text-bold'}>{item.quantidade} / {item.quantidade}</span>{item.quantidade <= item.estoqueMinimo && <span className="alert-badge">⚠️ ESTOQUE MÍNIMO</span>}</div></td>
                <td><span className={`status-pill ${item.status === 'manutencao' ? 'manutencao' : 'disponivel'}`}>{item.status === 'manutencao' ? '🛠️ Manutenção' : '✅ Disponível'}</span></td>
                <td style={{textAlign:'right'}}>
                  <button className="action-icon" title="Enviar para Manutenção" onClick={() => alternarStatus(item)}>🛠️</button>
                  <button className="action-icon" onClick={() => abrirModal(item)}>✏️</button>
                  <button className="action-icon delete" onClick={() => { if(confirm("Excluir?")) deleteDoc(doc(db, "estoque", item.id)).then(carregarEstoque) }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MODAL DE ZOOM DA IMAGEM --- */}
      {imagemAmpliada && (
        <div className="image-zoom-overlay" onClick={() => setImagemAmpliada(null)}>
          <img src={imagemAmpliada} className="image-zoom-content" />
          <p className="zoom-caption">Clique em qualquer lugar para fechar</p>
        </div>
      )}

      {/* --- MODAL NOVO/EDITAR (MANTIDO) --- */}
      {modalAberto && (
        <div className="modal-overlay-blur">
          <div className="modal-card wide-modern">
            <div className="modal-header-clean">
              <h3>{itemEditando ? 'Editar Item' : 'Novo Item do Acervo'}</h3>
              <button className="close-btn-modern" onClick={() => setModalAberto(false)}>×</button>
            </div>
            
            <form onSubmit={(e) => salvarItem(e, false)} style={{display:'flex', flexDirection:'column', height:'100%'}}>
              
              <div className="form-content-grid">
                
                {/* COLUNA FOTO */}
                <div className="left-column-photo">
                  <div className="main-photo-display">
                    {fotos.length > 0 ? (<img src={fotos[fotoPrincipalIndex]} className="main-photo-preview" />) : (<div className="photo-placeholder-box"><span style={{fontSize:'40px', opacity:0.3}}>📷</span><span className="photo-text">Sem Foto</span></div>)}
                  </div>
                  <div className="photo-thumbnails-row">
                    {fotos.map((f, idx) => (
                      <div key={idx} className={`thumb-item ${idx === fotoPrincipalIndex ? 'active' : ''}`} onClick={() => setFotoPrincipalIndex(idx)}>
                        <img src={f} />
                        <button type="button" className="btn-remove-thumb" onClick={(e) => {e.stopPropagation(); removerFoto(idx)}}>×</button>
                      </div>
                    ))}
                    <label className="thumb-upload-btn"><span>+</span><input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} /></label>
                  </div>
                </div>

                {/* COLUNA DADOS */}
                <div className="right-column-data">
                  <div className="section-divider"><span className="section-title">1. Identificação do Produto</span></div>
                  <div className="input-group-modern" style={{marginBottom:'15px'}}><label>Nome do Produto *</label><input value={nome} onChange={e => setNome(e.target.value)} required /></div>
                  <div className="form-row three-cols">
                    <div className="input-group-modern"><label>Código SKU</label><input value={codigo} readOnly className="input-readonly" /></div>
                    <div className="input-group-modern"><label>Categoria</label><select value={categoria} onChange={(e) => {setCategoria(e.target.value); if(!itemEditando) setCodigo(gerarSKU(e.target.value))}}>{categorias.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="input-group-modern"><label>Fornecedor</label><input value={fornecedor} onChange={e => setFornecedor(e.target.value)} /></div>
                  </div>

                  <div className="section-divider"><span className="section-title">2. Controle de Estoque</span></div>
                  <div className="form-row three-cols">
                    <div className="input-group-modern"><label>Quantidade Total</label><input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div>
                    <div className="input-group-modern"><label>Estoque Mínimo</label><input type="number" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} /></div>
                    <div className="input-group-modern"><label>Status Atual</label><select value={status} onChange={e => setStatus(e.target.value)} style={{fontWeight:'bold', color: status === 'manutencao' ? '#e12d39' : '#166534'}}><option value="ok">✅ Disponível</option><option value="manutencao">🛠️ Em Manutenção</option></select></div>
                  </div>

                  <div className="section-divider"><span className="section-title">3. Valores Financeiros (R$)</span></div>
                  <div className="form-row three-cols">
                    <div className="input-group-modern"><label>Custo Compra</label><input type="number" value={valorCompra} onChange={e => setValorCompra(e.target.value)} /></div>
                    <div className="input-group-modern highlight"><label>Aluguel Unitário</label><input type="number" value={valorAluguel} onChange={e => setValorAluguel(e.target.value)} /></div>
                    <div className="input-group-modern"><label>Custo Reposição</label><input type="number" value={valorReposicao} onChange={e => setValorReposicao(e.target.value)} /></div>
                  </div>

                  <div className="section-divider"><span className="section-title">4. Especificações Técnicas</span></div>
                  <div className="form-row three-cols">
                    <div className="input-group-modern"><label>Tamanho</label><select value={tamanho} onChange={e => setTamanho(e.target.value)}><option value="">Selecione...</option>{tamanhos.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="input-group-modern"><label>Cor</label><input value={cor} onChange={e => setCor(e.target.value)} /></div>
                    <div className="input-group-modern"><label>Unidade</label><select value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)}>{unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                  </div>
                  <div className="form-row four-cols">
                    <div className="input-group-modern"><label>Largura (cm)</label><input type="number" value={largura} onChange={e => setLargura(e.target.value)} /></div>
                    <div className="input-group-modern"><label>Altura (cm)</label><input type="number" value={altura} onChange={e => setAltura(e.target.value)} /></div>
                    <div className="input-group-modern"><label>Diâmetro (cm)</label><input type="number" value={diametro} onChange={e => setDiametro(e.target.value)} /></div>
                    <div className="input-group-modern"><label>Comprimento</label><input type="number" value={comprimento} onChange={e => setComprimento(e.target.value)} /></div>
                  </div>

                  <div className="section-divider"><span className="section-title">5. Configuração e Detalhes</span></div>
                  <div className="form-row">
                    <div className="input-group-modern"><label>Disponível para:</label><select value={tipoDisponibilidade} onChange={e => setTipoDisponibilidade(e.target.value)}><option value="Aluguel">Aluguel (Retorna)</option><option value="Venda">Venda (Sai do estoque)</option></select></div>
                    <div className="input-group-modern" style={{flexDirection:'row', alignItems:'flex-end'}}><div className={`toggle-switch ${visivelCatalogo ? 'active' : ''}`} onClick={() => setVisivelCatalogo(!visivelCatalogo)}><span style={{marginRight:'10px'}}>{visivelCatalogo ? '👁️ Visível no Catálogo' : '🔒 Oculto no Catálogo'}</span><div className="switch-knob"></div></div></div>
                  </div>
                  <div className="input-group-modern" style={{marginTop:'15px'}}><label>Observações</label><textarea className="textarea-modern" rows="3" value={observacoes} onChange={e => setObservacoes(e.target.value)}></textarea></div>
                </div> 
              </div>

              <div className="modal-footer-modern">
                <button type="button" className="btn-ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
                <button type="button" className="btn-secundario" onClick={(e) => salvarItem(e, true)}>Salvar e Novo</button>
                <button type="submit" className="btn-dark-blue">Salvar Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Estoque;