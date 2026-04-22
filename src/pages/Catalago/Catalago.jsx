import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 
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

  // 🔥 BLINDAGEM MULTI-EMPRESA E LINK MÁGICO [cite: 4, 35, 138]
  const { idEmpresa } = useParams();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  
  const tenantId = idEmpresa || (usuarioLogado ? usuarioLogado.uid : null);

  const [estoque, setEstoque] = useState([]);
  const [empresa, setEmpresa] = useState({ 
    nome: 'CELEBRE', logo: '', whats: '', endereco: '', insta: '', pixelFacebook: '' 
  });
  const [loading, setLoading] = useState(true);
  const [lojaInvalida, setLojaInvalida] = useState(false);
  
  const [filtroModalidade, setFiltroModalidade] = useState('Todas');
  const [filtroMenu, setFiltroMenu] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [dadosCliente, setDadosCliente] = useState({ nome: '', whats: '', dataEvento: '' });
  const [tipoFluxo, setTipoFluxo] = useState('orcamento');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const [produtoDetalhe, setProdutoDetalhe] = useState(null);

  useEffect(() => {
    const inicializar = async () => {
      if (!tenantId) {
          setLojaInvalida(true);
          setLoading(false);
          return;
      }

      try {
        const docRef = doc(db, "configuracoes_empresa", tenantId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const d = docSnap.data();
          setEmpresa({
            nome: d.nomeEmpresa || d.nome || 'CELEBRE',
            logo: d.logoUrl || d.logo || d.logotipo || '',
            whats: d.whatsapp || d.telefone || '',
            endereco: d.endereco || '',
            insta: d.instagram || '',
            pixelFacebook: d.pixelFacebook || d.pixel || '' 
          });
        }

        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snap = await getDocs(qEstoque);
        const itens = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'manutencao'); 
        setEstoque(itens);
      } catch (e) { 
        console.error(e);
      } finally { 
        setLoading(false); 
      }
    };
    inicializar();
  }, [tenantId]);

  useEffect(() => {
    if (empresa.pixelFacebook) {
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      
      window.fbq('init', empresa.pixelFacebook);
      window.fbq('track', 'PageView'); 
    }
  }, [empresa.pixelFacebook]);

  const dispararPixel = (nomeEvento, dados = {}) => {
    if (window.fbq && empresa.pixelFacebook) {
      window.fbq('track', nomeEvento, dados);
    }
  };

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

  const formatarDimensoesDetalhe = (esp) => {
      if (!esp) return null;
      let partes = [];
      if (Number(esp.largura) > 0) partes.push(`Largura: ${esp.largura}cm`);
      if (Number(esp.altura) > 0) partes.push(`Altura: ${esp.altura}cm`);
      if (Number(esp.diametro) > 0) partes.push(`Diâmetro: ${esp.diametro}cm`);
      if (Number(esp.comprimento) > 0) partes.push(`Comp.: ${esp.comprimento}cm`);
      return partes.length > 0 ? partes.join(' | ') : null;
  };

  const toggleNoCarrinho = (item) => {
    const existe = carrinho.find(i => i.id === item.id);
    if (existe) {
      setCarrinho(carrinho.filter(i => i.id !== item.id));
    } else {
      setCarrinho([...carrinho, { ...item, qtd: 1 }]);
      dispararPixel('AddToCart', { 
          content_name: item.nome, 
          value: Number(item.financeiro?.valorAluguel || 0), 
          currency: 'BRL' 
      });
    }
  };

  const isNoCarrinho = (id) => carrinho.some(i => i.id === id);
  const calcularTotal = () => carrinho.reduce((acc, i) => acc + (Number(i.financeiro?.valorAluguel || 0) * i.qtd), 0);
  
  const abrirCarrinho = () => {
      setModalFinalizar(true);
      dispararPixel('InitiateCheckout', { value: calcularTotal(), currency: 'BRL' });
  };

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
        criadoEm: serverTimestamp(),
        userId: tenantId 
      });
      
      dispararPixel('Lead', { value: total, currency: 'BRL' });
      
      const whatsDestino = empresa.whats ? empresa.whats.replace(/\D/g, '') : "5519999999999";
      
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

  const calcularAncoragemKit = (item) => {
      const precoAtual = Number(item.financeiro?.valorAluguel || 0);
      let precoSomaAvulso = 0;
      
      if (item.especificacoes?.isDecoracao && item.especificacoes?.itensDecoracao) {
          precoSomaAvulso = item.especificacoes.itensDecoracao.reduce((acc, peca) => acc + (Number(peca.precoOriginal) * (peca.qtd || 1)), 0);
      }
      
      const desconto = precoSomaAvulso - precoAtual;
      return { precoAtual, precoSomaAvulso, desconto, isVantajoso: desconto > 0 };
  };

  if (loading) return <div className="loader-catalogo">Carregando Acervo...</div>;
  
  if (lojaInvalida) return (
      <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'sans-serif', textAlign: 'center', padding: '20px'}}>
          <h1 style={{fontSize: '40px', marginBottom: '10px'}}>🏪</h1>
          <h2>Loja não encontrada</h2>
          <p style={{color: '#64748b'}}>Por favor, solicite o link correto à decoradora para aceder ao catálogo de produtos.</p>
      </div>
  );
  
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
        <button className="btn-admin-login" onClick={() => navigate(usuarioLogado ? '/dashboard' : '/login')}>🔒 Restrito</button>
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
          
          {/* 🔥 BOTÕES DE MODALIDADE CENTRALIZADOS E MODERNOS [cite: 53] */}
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            marginBottom: '20px', 
            flexWrap: 'wrap', 
            justifyContent: 'center', 
            width: '100%',
            padding: '0 10px'
          }}>
             <button 
                onClick={() => selecionarFiltro('modalidade', 'Todas')}
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '25px', 
                  border: '1px solid #cbd5e1', 
                  background: filtroModalidade === 'Todas' ? '#0f172a' : '#fff', 
                  color: filtroModalidade === 'Todas' ? '#fff' : '#475569', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  transition: '0.3s ease',
                  fontSize: '14px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
             >
                {filtroModalidade === 'Todas' && <span>✓</span>} Todas
             </button>

             <button 
                onClick={() => selecionarFiltro('modalidade', 'Pegue e Monte')}
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '25px', 
                  border: '1px solid #cbd5e1', 
                  background: filtroModalidade === 'Pegue e Monte' ? '#0f172a' : '#fff', 
                  color: filtroModalidade === 'Pegue e Monte' ? '#fff' : '#475569', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  transition: '0.3s ease',
                  fontSize: '14px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
             >
                📦 Pegue e Monte
             </button>

             <button 
                onClick={() => selecionarFiltro('modalidade', 'Decoração Completa')}
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '25px', 
                  border: '1px solid #cbd5e1', 
                  background: filtroModalidade === 'Decoração Completa' ? '#0f172a' : '#fff', 
                  color: filtroModalidade === 'Decoração Completa' ? '#fff' : '#475569', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  transition: '0.3s ease',
                  fontSize: '14px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
             >
                ✨ Decoração
             </button>
          </div>

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
              const isSelected = isNoCarrinho(item.id);
              return (
                <div key={item.id} className="cat-card">
                  <div style={{cursor: 'pointer'}} onClick={() => setProdutoDetalhe(item)}>
                      <div className="cat-img-wrapper">
                        {item.foto ? <img src={item.foto} alt="" /> : <div className="no-img">📷</div>}
                        {isSelected && <div className="cat-badge-selected">Na Lista</div>}
                      </div>
                      <div className="cat-info" style={{paddingBottom: '5px'}}>
                        <h4 className="cat-title-text">{item.nome}</h4>
                        <p className="cat-medida">{formatarDimensoes(item.dimensoes)}</p>
                        <div className="cat-price">R$ {Number(item.financeiro?.valorAluguel || 0).toFixed(2)}</div>
                      </div>
                  </div>
                  <div style={{padding: '0 15px 15px 15px'}}>
                      <button className={`btn-add-lista ${isSelected ? 'added' : ''}`} onClick={() => toggleNoCarrinho(item)}>
                        {isSelected ? 'Remover da Lista' : 'Adicionar'}
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

      {/* 🔥 BOTÃO FLUTUANTE DO MENU (CORRIGIDO PARA ABRIR/FECHAR) [cite: 71] */}
      {window.innerWidth <= 900 && (
          <button 
            className="btn-mobile-filtros-fab" 
            onClick={() => setMenuMobileAberto(!menuMobileAberto)}
            style={{ zIndex: 999999, position: 'fixed' }}
          >
             {menuMobileAberto ? '✕' : '☰'}
          </button>
      )}

      {carrinho.length > 0 && (
        <div className="cat-floating-bar" onClick={abrirCarrinho}>
          <span>🛍️ {carrinho.length} itens - <strong>R$ {calcularTotal().toFixed(2)}</strong></span>
          <button>VER CARRINHO ➔</button>
        </div>
      )}

      {/* MODAL E-COMMERCE PREMIUM (DETALHES DO PRODUTO) [cite: 73, 105] */}
      {produtoDetalhe && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px', boxSizing: 'border-box', opacity: 1, animation: 'fadeIn 0.2s ease-out' }} onClick={() => setProdutoDetalhe(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '950px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            
            <button onClick={() => setProdutoDetalhe(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', zIndex: 10, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            {/* LADO ESQUERDO: IMAGENS */}
            <div style={{ width: window.innerWidth < 768 ? '100%' : '50%', backgroundColor: '#f8fafc', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: window.innerWidth < 768 ? 'none' : '1px solid #e2e8f0', borderBottom: window.innerWidth < 768 ? '1px solid #e2e8f0' : 'none' }}>
               <div style={{ width: '100%', height: '350px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                   {produtoDetalhe.foto ? <img src={produtoDetalhe.foto} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt={produtoDetalhe.nome}/> : <span style={{fontSize:'50px'}}>📷</span>}
               </div>

               {produtoDetalhe.especificacoes?.isDecoracao && produtoDetalhe.especificacoes?.itensDecoracao?.length > 0 && (
                   <div style={{ width: '100%', marginTop: '30px', borderTop: '2px dashed #cbd5e1', paddingTop: '20px' }}>
                       <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                           <span style={{fontSize: '20px'}}>✨</span>
                           <span style={{ fontSize: '13px', color: '#c5a059', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                               Peças inclusas nesta decoração:
                           </span>
                       </div>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'flex-start' }}>
                           {produtoDetalhe.especificacoes.itensDecoracao.map((peca, idx) => (
                               <div key={idx} style={{ width: 'calc(33.33% - 10px)', minWidth: '80px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                   <div style={{ width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', position: 'relative', marginBottom: '8px', background: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }} title={`${peca.qtd}x ${peca.nome}`}>
                                       {peca.foto ? <img src={peca.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/> : <div style={{width:'100%', height:'100%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px'}}>📷</div>}
                                       <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#0f172a', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '3px 7px', borderTopLeftRadius: '8px' }}>{peca.qtd}x</div>
                                   </div>
                                   <strong style={{ fontSize: '12px', color: '#0f172a', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{peca.nome}</strong>
                               </div>
                           ))}
                       </div>
                   </div>
               )}
            </div>

            {/* LADO DIREITO: DADOS E PREÇO */}
            <div style={{ width: window.innerWidth < 768 ? '100%' : '50%', padding: '30px', display: 'flex', flexDirection: 'column' }}>
               <div style={{ marginBottom: '5px' }}>
                   <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                       {produtoDetalhe.especificacoes?.isDecoracao ? 'Pacote Completo' : produtoDetalhe.categoria}
                   </span>
               </div>
               
               <h2 style={{ fontSize: '26px', color: '#0f172a', margin: '10px 0', lineHeight: '1.2' }}>{produtoDetalhe.nome}</h2>
               
               <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginTop: '20px', marginBottom: '20px' }}>
                   <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Ficha Técnica</strong>
                   
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                       {produtoDetalhe.categoria && (
                           <div>
                               <span style={{fontSize: '11px', color: '#94a3b8', display: 'block'}}>Categoria:</span>
                               <strong style={{fontSize: '14px', color: '#0f172a'}}>{produtoDetalhe.categoria}</strong>
                           </div>
                       )}
                       {produtoDetalhe.tema && (
                           <div>
                               <span style={{fontSize: '11px', color: '#94a3b8', display: 'block'}}>Tema Sugerido:</span>
                               <strong style={{fontSize: '14px', color: '#0f172a'}}>{produtoDetalhe.tema}</strong>
                           </div>
                       )}
                       {produtoDetalhe.especificacoes?.cor && (
                           <div>
                               <span style={{fontSize: '11px', color: '#94a3b8', display: 'block'}}>Cor principal:</span>
                               <strong style={{fontSize: '14px', color: '#0f172a'}}>{produtoDetalhe.especificacoes.cor}</strong>
                           </div>
                       )}
                       {produtoDetalhe.especificacoes?.tamanho && (
                           <div>
                               <span style={{fontSize: '11px', color: '#94a3b8', display: 'block'}}>Porte/Tamanho:</span>
                               <strong style={{fontSize: '14px', color: '#0f172a'}}>{produtoDetalhe.especificacoes.tamanho}</strong>
                           </div>
                       )}
                       {formatarDimensoesDetalhe(produtoDetalhe.especificacoes) && (
                           <div style={{gridColumn: '1 / -1', background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
                               <span style={{fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px'}}>Medidas Oficiais:</span>
                               <strong style={{fontSize: '14px', color: '#0f172a'}}>{formatarDimensoesDetalhe(produtoDetalhe.especificacoes)}</strong>
                           </div>
                       )}
                   </div>
               </div>

               {produtoDetalhe.observacoes && (
                   <div style={{ marginBottom: '20px' }}>
                       <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '5px' }}>Dicas e Detalhes:</strong>
                       <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>{produtoDetalhe.observacoes}</p>
                   </div>
               )}

               <div style={{ flexGrow: 1 }}></div>

               <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '10px' }}>
                   {(() => {
                       const { precoAtual, precoSomaAvulso, desconto, isVantajoso } = calcularAncoragemKit(produtoDetalhe);
                       if (isVantajoso) {
                           return (
                               <div style={{ marginBottom: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '15px', borderRadius: '10px' }}>
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                                       <span style={{ fontSize: '13px', color: '#64748b' }}>
                                           Alugando as peças individuais ficaria: <strong style={{ textDecoration: 'line-through', color: '#ef4444' }}>R$ {precoSomaAvulso.toFixed(2)}</strong>
                                       </span>
                                       <span style={{ fontSize: '15px', color: '#0f172a', marginTop: '5px' }}>
                                           A decoração completa fica por: <strong style={{ fontSize: '32px', color: '#10b981', fontWeight: '900', display: 'block', marginTop: '2px' }}>R$ {precoAtual.toFixed(2)}</strong>
                                       </span>
                                   </div>
                                   <div style={{ background: '#10b981', color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block', width: '100%', textAlign: 'center' }}>
                                       Viu como compensa? Você economiza R$ {desconto.toFixed(2)}! 😉
                                   </div>
                               </div>
                           );
                       } else {
                           return (
                               <div style={{ marginBottom: '15px' }}>
                                   <strong style={{ fontSize: '36px', color: '#0f172a', fontWeight: '900' }}>R$ {precoAtual.toFixed(2)}</strong>
                                   <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Valor do aluguel</span>
                               </div>
                           );
                       }
                   })()}

                   <button 
                       onClick={() => {
                           toggleNoCarrinho(produtoDetalhe);
                           setProdutoDetalhe(null); 
                       }} 
                       style={{ 
                           width: '100%', padding: '16px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', border: 'none', transition: '0.2s',
                           background: isNoCarrinho(produtoDetalhe.id) ? '#fef2f2' : '#c5a059',
                           color: isNoCarrinho(produtoDetalhe.id) ? '#ef4444' : '#fff',
                           boxShadow: isNoCarrinho(produtoDetalhe.id) ? 'none' : '0 8px 20px rgba(197, 160, 89, 0.4)'
                       }}
                   >
                       {isNoCarrinho(produtoDetalhe.id) ? 'Remover da Lista' : 'Adicionar à Minha Festa'}
                   </button>
               </div>

            </div>
          </div>
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
                    <button 
                        type="button" 
                         className="btn-ir-cadastro" 
                        onClick={() => navigate(`/autocadastro/${tenantId}`, { state: { carrinhoCatalogo: carrinho, empresaConfig: empresa, empresaId: tenantId } })} 
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