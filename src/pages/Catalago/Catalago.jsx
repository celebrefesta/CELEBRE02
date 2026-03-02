import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import './Catalago.css';

const ESTRUTURA_TEMAS = {
  "Infantil": ["Princesas", "Homem Aranha", "Heróis", "Safari", "Fazendinha", "Mickey / Minnie", "Outros Infantil"],
  "Casamento e Noivado": ["Rústico", "Moderno", "Minimalista", "Clássico", "Outros Casamento"],
  "Adulto": ["Feminino", "Masculino", "Tardezinha / Boteco", "Neon / Balada", "Outros Adulto"],
  "Times": ["Santos", "São Paulo", "Palmeiras", "Corinthians", "Flamengo", "Outros Times"],
  "Batizado": ["Menino", "Menina", "Neutro / Clássico"]
};

const Catalogo = () => {
  const navigate = useNavigate();
  const [estoque, setEstoque] = useState([]);
  const [empresa, setEmpresa] = useState({ 
    nome: 'CELEBRE', logo: '', whats: '', endereco: '', insta: '' 
  });
  const [loading, setLoading] = useState(true);
  
  const [filtroModalidade, setFiltroModalidade] = useState('Todas');
  const [filtroMenu, setFiltroMenu] = useState('Todos'); 
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [dadosCliente, setDadosCliente] = useState({ nome: '', whats: '', dataEvento: '' });
  const [tipoFluxo, setTipoFluxo] = useState('orcamento'); 
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  useEffect(() => {
    const inicializar = async () => {
      try {
        const docRef = doc(db, "sistema", "parametros");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const d = docSnap.data();
          setEmpresa({
            nome: d.nomeEmpresa || d.nome || 'CELEBRE',
            logo: d.logoUrl || d.logo || '',
            whats: d.whatsapp || d.telefone || '',
            endereco: d.endereco || '',
            insta: d.instagram || ''
          });
        }

        const snap = await getDocs(collection(db, "estoque"));
        const itens = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'manutencao'); 
        setEstoque(itens);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    inicializar();
  }, []);

  const categoriasDinamicas = [...new Set(estoque.map(i => i.categoria ? String(i.categoria) : "").filter(c => c !== ""))].sort();

  const formatarDimensoes = (dim) => {
    if (!dim) return null;
    if (typeof dim === 'string') return dim;
    if (typeof dim === 'object') {
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

  const calcularTotal = () => carrinho.reduce((acc, i) => acc + (Number(i.financeiro?.valorAluguel || 0) * i.qtd), 0);

  const enviarOrcamento = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0) return alert("Seu carrinho está vazio!");

    const total = calcularTotal();
    const resumoItens = carrinho.map(i => `- ${i.qtd}x ${i.nome} (R$ ${Number(i.financeiro?.valorAluguel || 0).toFixed(2)})`).join('\n');

    try {
      await addDoc(collection(db, "locacoes"), {
        clienteNome: dadosCliente.nome,
        clienteWhats: dadosCliente.whats,
        temaFesta: `Catálogo: Orçamento Web`,
        dataRetirada: dadosCliente.dataEvento,
        itens: carrinho,
        valorTotal: total,
        status: 'orcamento',
        origem: 'catalogo_publico',
        criadoEm: serverTimestamp()
      });

      const whatsDestino = empresa.whats.replace(/\D/g, '') || "5519999999999"; 
      const texto = `🌟 *NOVO ORÇAMENTO* 🌟\n\n*Cliente:* ${dadosCliente.nome}\n*Data do Evento:* ${dadosCliente.dataEvento}\n\n*Itens Escolhidos:*\n${resumoItens}\n\n*Total Estimado:* R$ ${total.toFixed(2)}\n\nOlá! Vim pelo catálogo e gostaria de verificar a disponibilidade destas peças!`;
      
      window.open(`https://wa.me/${whatsDestino}?text=${encodeURIComponent(texto)}`, '_blank');
      setCarrinho([]);
      setModalFinalizar(false);
    } catch (err) { 
        console.error(err);
        alert("Erro ao processar o orçamento. Tente novamente."); 
    }
  };

  const itensFiltrados = estoque.filter(i => {
    const tBusca = String(busca || '').toLowerCase();
    const nomeI = String(i.nome || '').toLowerCase();
    const catI = String(i.categoria || '').toLowerCase();
    const temaI = String(i.tema || i.tags || '').toLowerCase(); 
    return (!busca || nomeI.includes(tBusca) || catI.includes(tBusca) || temaI.includes(tBusca)) &&
           (filtroMenu === 'Todos' || catI.includes(String(filtroMenu).toLowerCase()) || temaI.includes(String(filtroMenu).toLowerCase())) &&
           (filtroModalidade === 'Todas' || String(i.modalidade || '').toLowerCase().includes(String(filtroModalidade).toLowerCase()));
  });

  const selecionarFiltro = (tipo, valor) => {
    if (tipo === 'modalidade') setFiltroModalidade(valor);
    if (tipo === 'menu') setFiltroMenu(valor);
    setMenuMobileAberto(false); 
  };

  if (loading) return <div className="loader-catalogo">Carregando Acervo...</div>;

  return (
    <div className="catalogo-publico">
      <header className="cat-header">
        <div className="cat-header-content">
          <h1 className="cat-logo">{empresa.nome}</h1>
          <div className="header-info-subtitle">
            <p className="cat-subtitle">Vitrine Online de Locação</p>
            <div className="header-contact-links">
              {empresa.endereco && <span>📍 {empresa.endereco}</span>}
              {empresa.insta && <span>📸 @{empresa.insta.replace('@','')}</span>}
            </div>
          </div>
        </div>
        <button className="btn-admin-login" onClick={() => navigate('/')}>🔒 Restrito</button>
      </header>

      <div className="cat-container-main">
        
        {menuMobileAberto && <div className="sidebar-overlay" onClick={() => setMenuMobileAberto(false)}></div>}

        <aside className={`cat-sidebar ${menuMobileAberto ? 'open' : ''}`}>
          <div className="sidebar-mobile-header">
             <h3>Filtros</h3>
             <button className="btn-fechar-menu" onClick={() => setMenuMobileAberto(false)}>✕</button>
          </div>

          {empresa.logo && <img src={empresa.logo} className="sidebar-logo-img" alt="Logo" />}
          
          <div className="sidebar-section">
            <h3 className="sidebar-title">Modalidade</h3>
            <ul className="sidebar-list">
              <li className={filtroModalidade === 'Todas' ? 'active' : ''} onClick={() => selecionarFiltro('modalidade', 'Todas')}>✓ Todas</li>
              <li className={filtroModalidade === 'Pegue e Monte' ? 'active' : ''} onClick={() => selecionarFiltro('modalidade', 'Pegue e Monte')}>📦 Pegue e Monte</li>
              <li className={filtroModalidade === 'Decoração Completa' ? 'active' : ''} onClick={() => selecionarFiltro('modalidade', 'Decoração Completa')}>✨ Decoração</li>
            </ul>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Acervo</h3>
            <ul className="sidebar-list">
              <li className={filtroMenu === 'Todos' ? 'active destak' : 'destak'} onClick={() => selecionarFiltro('menu', 'Todos')}>🌟 Ver Tudo</li>
              {categoriasDinamicas.map(cat => (
                <li key={cat} className={filtroMenu === cat ? 'active' : ''} onClick={() => selecionarFiltro('menu', cat)}>{cat}</li>
              ))}
            </ul>
          </div>
          
          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Temas</h3>
            {Object.entries(ESTRUTURA_TEMAS).map(([grupo, temas]) => (
              <div key={grupo} className="sidebar-tema-grupo">
                <h4 className="sidebar-grupo-title">{grupo}</h4>
                <ul className="sidebar-list">
                  {temas.map(t => <li key={t} className={filtroMenu === t ? 'active' : ''} onClick={() => selecionarFiltro('menu', t)}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <main className="cat-content">
          <div className="cat-top-controls">
              <div className="cat-search-bar">
                <input type="text" placeholder="O que você procura para sua festa?" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
          </div>

          {window.innerWidth <= 900 && (filtroMenu !== 'Todos' || filtroModalidade !== 'Todas') && (
              <div className="active-filters-mobile">
                  Mostrando: <strong>{filtroModalidade}</strong> • <strong>{filtroMenu}</strong>
                  <button onClick={() => { setFiltroModalidade('Todas'); setFiltroMenu('Todos'); }}>Limpar</button>
              </div>
          )}

          <div className="cat-grid">
            {itensFiltrados.map(item => {
              const isSelected = carrinho.find(i => i.id === item.id);
              return (
                <div key={item.id} className="cat-card">
                  <div className="cat-img-wrapper">
                    {item.foto ? <img src={item.foto} alt="" /> : <div className="no-img">📷</div>}
                    {isSelected && <div className="cat-badge-selected">Na Lista</div>}
                  </div>
                  <div className="cat-info">
                    <h4 className="cat-title-text">{item.nome}</h4>
                    <p className="cat-medida">{formatarDimensoes(item.dimensoes)}</p>
                    <div className="cat-price">R$ {Number(item.financeiro?.valorAluguel || 0).toFixed(2)}</div>
                    <button className={`btn-add-lista ${isSelected ? 'added' : ''}`} onClick={() => toggleNoCarrinho(item)}>
                      {isSelected ? 'Remover' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      <footer className="cat-footer">
        <div className="footer-content">
          <h3>{empresa.nome}</h3>
          {empresa.endereco && <p>📍 {empresa.endereco}</p>}
          {empresa.whats && <p>💬 WhatsApp: {empresa.whats}</p>}
          <p className="footer-copy">© {new Date().getFullYear()} - Todos os direitos reservados</p>
        </div>
      </footer>

      {window.innerWidth <= 900 && (
          <button className="btn-mobile-filtros-fab" onClick={() => setMenuMobileAberto(true)}>
             ☰
          </button>
      )}

      {carrinho.length > 0 && (
        <div className="cat-floating-bar" onClick={() => setModalFinalizar(true)}>
          <span>🛍️ {carrinho.length} itens - <strong>R$ {calcularTotal().toFixed(2)}</strong></span>
          <button>VER CARRINHO ➔</button>
        </div>
      )}

      {modalFinalizar && (
        <div className="modal-overlay-catalogo" onClick={() => setModalFinalizar(false)}>
          <div className="modal-content-catalogo" onClick={e => e.stopPropagation()}>
            
            <div className="modal-header-catalogo">
              <h2>Sua Lista de Peças</h2>
              <button className="btn-close-modal" onClick={() => setModalFinalizar(false)}>✕</button>
            </div>
            
            <div className="modal-body-catalogo">
              <div className="resumo-carrinho">
                <h3>Itens Selecionados ({carrinho.length})</h3>
                <ul>
                  {carrinho.map(item => (
                    <li key={item.id}>
                      <span>{item.qtd}x {item.nome}</span>
                      <span>R$ {(Number(item.financeiro?.valorAluguel || 0) * item.qtd).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="resumo-total">
                  <span>Total Estimado:</span>
                  <strong>R$ {calcularTotal().toFixed(2)}</strong>
                </div>
              </div>

              <div className="tipo-pedido-toggle">
                 <button 
                   className={tipoFluxo === 'orcamento' ? 'active' : ''} 
                   onClick={() => setTipoFluxo('orcamento')}
                   type="button"
                 >
                   Apenas Orçamento
                 </button>
                 <button 
                   className={tipoFluxo === 'cadastro' ? 'active' : ''} 
                   onClick={() => setTipoFluxo('cadastro')}
                   type="button"
                 >
                   Virar Cliente 🌟
                 </button>
              </div>

              {tipoFluxo === 'orcamento' ? (
                  <form onSubmit={enviarOrcamento} className="form-orcamento">
                    <h3>Orçamento Rápido</h3>
                    
                    <label>Seu Nome</label>
                    <input type="text" placeholder="Como podemos te chamar?" required 
                      value={dadosCliente.nome} onChange={e => setDadosCliente({...dadosCliente, nome: e.target.value})}
                    />
                    
                    <label>Seu WhatsApp</label>
                    <input type="text" placeholder="(11) 99999-9999" required 
                      value={dadosCliente.whats} onChange={e => setDadosCliente({...dadosCliente, whats: e.target.value})}
                    />
                    
                    <label>Data da Festa / Evento</label>
                    <input type="date" required 
                      value={dadosCliente.dataEvento} onChange={e => setDadosCliente({...dadosCliente, dataEvento: e.target.value})}
                    />
                    
                    <button type="submit" className="btn-enviar-zap">
                      <span>🟢</span> Enviar no WhatsApp
                    </button>
                  </form>
              ) : (
                  <div className="form-cadastro-call">
                    <p>Faça o seu cadastro oficial para agilizar sua locação, ter acesso ao histórico de pedidos e aprovações mais rápidas!</p>
                    
                    {/* 🔥 ROTA CORRIGIDA PARA /autocadastro 🔥 */}
                    <button 
                        type="button" 
                        className="btn-ir-cadastro" 
                        onClick={() => navigate('/autocadastro', { state: { carrinhoCatalogo: carrinho, empresaConfig: empresa } })} 
                    >
                        Ir para Tela de Cadastro ➔
                    </button>
                  </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Catalogo;