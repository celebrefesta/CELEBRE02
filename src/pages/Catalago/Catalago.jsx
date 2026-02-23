import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // 🌟 ADICIONADO AQUI
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './Catalago.css';

const ESTRUTURA_TEMAS = {
  "Infantil": ["Princesas", "Homem Aranha", "Heróis", "Safari", "Fazendinha", "Mickey / Minnie", "Outros Infantil"],
  "Casamento e Noivado": ["Rústico", "Moderno", "Minimalista", "Clássico", "Outros Casamento"],
  "Adulto": ["Feminino", "Masculino", "Tardezinha / Boteco", "Neon / Balada", "Outros Adulto"],
  "Times": ["Santos", "São Paulo", "Palmeiras", "Corinthians", "Flamengo", "Outros Times"],
  "Batizado": ["Menino", "Menina", "Neutro / Clássico"]
};

const Catalogo = () => {
  const navigate = useNavigate(); // 🌟 NAVEGAÇÃO ATIVADA AQUI
  const [estoque, setEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filtroModalidade, setFiltroModalidade] = useState('Todas');
  const [filtroMenu, setFiltroMenu] = useState('Todos'); 
  const [busca, setBusca] = useState('');
  
  const [carrinho, setCarrinho] = useState([]);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [dadosCliente, setDadosCliente] = useState({ nome: '', whats: '', dataEvento: '' });

  useEffect(() => {
    const carregarItens = async () => {
      try {
        const snap = await getDocs(collection(db, "estoque"));
        const itens = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'manutencao'); 
        setEstoque(itens);
      } catch (e) { 
        console.error("Erro ao buscar estoque: ", e); 
      } finally { 
        setLoading(false); 
      }
    };
    carregarItens();
  }, []);

  const categoriasDinamicas = [...new Set(
    estoque
      .map(i => i.categoria ? String(i.categoria) : "")
      .filter(c => c !== "")
  )].sort();

  // 🌟 FUNÇÃO SALVA-VIDAS QUE RESOLVE O ERRO DAS DIMENSÕES 🌟
  const formatarDimensoes = (dim) => {
    if (!dim) return null;
    if (typeof dim === 'string') return dim; // Se for texto, mostra direto
    if (typeof dim === 'object') {
      // Se for o objeto do Firebase, monta as medidas organizadas
      let partes = [];
      if (dim.altura) partes.push(`A:${dim.altura}`);
      if (dim.largura) partes.push(`L:${dim.largura}`);
      if (dim.comprimento) partes.push(`C:${dim.comprimento}`);
      return partes.join(' x ');
    }
    return null;
  };

  const toggleNoCarrinho = (item) => {
    const existe = carrinho.find(i => i.id === item.id);
    if (existe) {
      setCarrinho(carrinho.filter(i => i.id !== item.id));
    } else {
      setCarrinho([...carrinho, { ...item, qtd: 1 }]);
    }
  };

  const atualizarQtd = (id, novaQtd) => {
    setCarrinho(carrinho.map(i => i.id === id ? { ...i, qtd: Math.max(1, novaQtd) } : i));
  };

  const calcularTotal = () => carrinho.reduce((acc, i) => acc + (Number(i.financeiro?.valorAluguel || 0) * i.qtd), 0);

  const enviarOrcamento = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0) return alert("Seu carrinho está vazio!");

    const total = calcularTotal();
    const resumoItens = carrinho.map(i => `- ${i.qtd}x ${i.nome} (R$ ${i.financeiro?.valorAluguel})`).join('\n');

    try {
      await addDoc(collection(db, "locacoes"), {
        clienteNome: dadosCliente.nome,
        clienteWhats: dadosCliente.whats,
        temaFesta: `Catálogo: ${filtroModalidade} - ${filtroMenu}`,
        dataRetirada: dadosCliente.dataEvento,
        itens: carrinho,
        valorTotal: total,
        status: 'orcamento',
        origem: 'catalogo_publico',
        criadoEm: serverTimestamp()
      });

      const meuWhats = "5519999999999"; 
      const texto = `🌟 *NOVO ORÇAMENTO VIA CATÁLOGO* 🌟\n\n*Modalidade:* ${filtroModalidade}\n*Interesse em:* ${filtroMenu}\n*Cliente:* ${dadosCliente.nome}\n*Data:* ${dadosCliente.dataEvento.split('-').reverse().join('/')}\n\n*Itens Escolhidos:*\n${resumoItens}\n\n*Total Estimado:* R$ ${total.toFixed(2)}`;
      
      window.open(`https://wa.me/${meuWhats}?text=${encodeURIComponent(texto)}`, '_blank');

      alert("Orçamento enviado com sucesso! Aguarde nosso contato.");
      setCarrinho([]);
      setModalFinalizar(false);
    } catch (err) { alert("Erro ao processar pedido."); }
  };

  const itensFiltrados = estoque.filter(i => {
    const textoBusca = String(busca || '').toLowerCase();
    const nomeItem = String(i.nome || '').toLowerCase();
    const catItem = String(i.categoria || '').toLowerCase();
    const temaItem = String(i.tema || i.tags || '').toLowerCase(); 

    let passaBusca = true;
    if (busca) {
      passaBusca = nomeItem.includes(textoBusca) || catItem.includes(textoBusca) || temaItem.includes(textoBusca);
    }

    let passaMenu = true;
    if (filtroMenu !== 'Todos') {
       const filtroLimpo = String(filtroMenu).toLowerCase();
       passaMenu = catItem.includes(filtroLimpo) || temaItem.includes(filtroLimpo) || nomeItem.includes(filtroLimpo);
    }

    let passaModalidade = true;
    if (filtroModalidade !== 'Todas') {
      const modItem = String(i.modalidade || '').toLowerCase();
      passaModalidade = modItem.includes(String(filtroModalidade).toLowerCase());
    }

    return passaBusca && passaMenu && passaModalidade;
  });

  if (loading) return <div className="loader-catalogo">Carregando Acervo Celebre...</div>;

  return (
    <div className="catalogo-publico">
      
      <header className="cat-header">
        <div className="cat-header-content">
          <h1 className="cat-logo">CELEBRE</h1>
          <p className="cat-subtitle">Catálogo Exclusivo de Acervo</p>
        </div>
        
        {/* 🌟 BOTÃO DE ACESSO AO SISTEMA 🌟 */}
        <button className="btn-admin-login" onClick={() => navigate('/')}>
          <span className="lock-icon">🔒</span> Área Restrita
        </button>
      </header>

      <div className="cat-container-main">
        
        <aside className="cat-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Modalidade</h3>
            <ul className="sidebar-list">
              <li className={filtroModalidade === 'Todas' ? 'active' : ''} onClick={() => setFiltroModalidade('Todas')}>✓ Mostrar Todas</li>
              <li className={filtroModalidade === 'Pegue e Monte' ? 'active' : ''} onClick={() => setFiltroModalidade('Pegue e Monte')}>📦 Pegue e Monte</li>
              <li className={filtroModalidade === 'Decoração Completa' ? 'active' : ''} onClick={() => setFiltroModalidade('Decoração Completa')}>✨ Decoração Completa</li>
            </ul>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Acervo Geral</h3>
            <ul className="sidebar-list">
              <li className={filtroMenu === 'Todos' ? 'active destak' : 'destak'} onClick={() => setFiltroMenu('Todos')}>
                🌟 Ver Tudo
              </li>
            </ul>
          </div>

          {categoriasDinamicas.length > 0 && (
            <>
              <div className="sidebar-divider"></div>
              <div className="sidebar-section">
                <h3 className="sidebar-title">Peças Individuais</h3>
                <ul className="sidebar-list">
                  {categoriasDinamicas.map(cat => (
                    <li key={cat} className={filtroMenu === cat ? 'active' : ''} onClick={() => setFiltroMenu(cat)}>
                      {cat}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Temas Prontos</h3>
            {Object.entries(ESTRUTURA_TEMAS).map(([grupo, temas]) => (
              <div key={grupo} className="sidebar-grupo">
                <h4 className="sidebar-grupo-title">{grupo}</h4>
                <ul className="sidebar-list">
                  {temas.map(tema => (
                    <li key={tema} className={filtroMenu === tema ? 'active' : ''} onClick={() => setFiltroMenu(tema)}>
                      {tema}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <main className="cat-content">
          
          <div className="cat-search-bar">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder={`Buscando em: ${filtroMenu === 'Todos' ? 'Todo o acervo' : filtroMenu}...`} 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
            />
          </div>

          <div className="cat-grid">
            {itensFiltrados.map(item => {
              const isSelected = carrinho.find(i => i.id === item.id);
              return (
                <div key={item.id} className={`cat-card ${isSelected ? 'selected' : ''}`}>
                  <div className="cat-img-wrapper">
                    {item.foto ? <img src={item.foto} alt={item.nome} /> : <div className="no-img">📷 Sem Foto</div>}
                    {isSelected && <div className="cat-badge-selected">Na Lista</div>}
                  </div>
                  
                  <div className="cat-info">
                    <div className="cat-tags">
                      <span className="tag-categoria">{item.categoria || "Geral"}</span>
                      {item.modalidade && <span className="tag-modalidade">{item.modalidade}</span>}
                    </div>

                    <h4 className="cat-title-text" title={item.nome}>{item.nome}</h4>
                    
                    <div className="cat-details">
                      {/* 🌟 AQUI USAMOS A NOVA FUNÇÃO PARA AS DIMENSÕES 🌟 */}
                      {item.dimensoes && formatarDimensoes(item.dimensoes) && (
                        <span className="cat-detail-item">📏 {formatarDimensoes(item.dimensoes)}</span>
                      )}
                      
                      {item.cor && typeof item.cor === 'string' && (
                        <span className="cat-detail-item">🎨 {item.cor}</span>
                      )}
                      
                      {item.descricao && typeof item.descricao === 'string' && (
                        <p className="cat-desc-text">{item.descricao}</p>
                      )}
                    </div>

                    <div className="cat-price-text">
                      R$ {Number(item.financeiro?.valorAluguel || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      <small className="txt-diaria">/ aluguel</small>
                    </div>

                    <button className={`btn-vitrine-add ${isSelected ? 'added' : ''}`} onClick={() => toggleNoCarrinho(item)}>
                      {isSelected ? '✓ Remover da Lista' : '+ Adicionar à Lista'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {itensFiltrados.length === 0 && (
            <div className="cat-empty-state">
              <h3>Poxa, não encontramos peças exatas para essa busca!</h3>
              <p>Tente selecionar "Ver Tudo" na barra lateral ou busque por nomes mais gerais.</p>
            </div>
          )}
        </main>
      </div>

      {carrinho.length > 0 && (
        <div className="cat-floating-bar" onClick={() => setModalFinalizar(true)}>
          <div className="bar-info">
            <span className="cart-icon">🛍️</span>
            <div>
              <span className="cart-qtd">{carrinho.length} itens na sua lista</span>
              <strong className="cart-total">R$ {calcularTotal().toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>
          </div>
          <button className="btn-finalizar-cat">FINALIZAR PEDIDO ➔</button>
        </div>
      )}

      {modalFinalizar && (
        <div className="cat-modal-overlay">
          <div className="cat-modal">
            <div className="modal-header">
              <h3>Finalizar Solicitação</h3>
              <button className="btn-fechar-modal" onClick={() => setModalFinalizar(false)}>✕</button>
            </div>
            
            <form onSubmit={enviarOrcamento}>
              <div className="input-box" style={{marginBottom: '15px'}}>
                <label>Seu Nome Completo</label>
                <input type="text" required value={dadosCliente.nome} onChange={e => setDadosCliente({...dadosCliente, nome: e.target.value})} placeholder="Como podemos te chamar?" />
              </div>
              
              <div className="modal-row">
                <div className="input-box">
                  <label>WhatsApp</label>
                  <input type="tel" required placeholder="(00) 00000-0000" value={dadosCliente.whats} onChange={e => setDadosCliente({...dadosCliente, whats: e.target.value})} />
                </div>
                <div className="input-box">
                  <label>Data do Evento</label>
                  <input type="date" required value={dadosCliente.dataEvento} onChange={e => setDadosCliente({...dadosCliente, dataEvento: e.target.value})} />
                </div>
              </div>

              <h4 style={{marginTop: '20px', marginBottom: '10px', color: '#0f172a'}}>Revisão dos Itens</h4>
              <div className="carrinho-revisao">
                {carrinho.map(i => (
                  <div key={i.id} className="revisao-item">
                    {i.foto ? <img src={i.foto} alt="" className="revisao-img"/> : <div className="revisao-img-placeholder">📷</div>}
                    <span className="revisao-nome">{i.nome}</span>
                    <div className="qtd-input">
                      <button type="button" onClick={() => atualizarQtd(i.id, i.qtd - 1)}>-</button>
                      <span>{i.qtd}</span>
                      <button type="button" onClick={() => atualizarQtd(i.id, i.qtd + 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cat-modal-footer">
                <button type="submit" className="btn-enviar-whats">ENVIAR ORÇAMENTO PELO WHATSAPP</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalogo;