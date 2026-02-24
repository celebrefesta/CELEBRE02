import React, { useState, useEffect } from 'react';
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
    nome: 'CELEBRE', 
    logo: '', 
    whats: '', 
    endereco: '', 
    insta: '' 
  });
  const [loading, setLoading] = useState(true);
  
  const [filtroModalidade, setFiltroModalidade] = useState('Todas');
  const [filtroMenu, setFiltroMenu] = useState('Todos'); 
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [dadosCliente, setDadosCliente] = useState({ nome: '', whats: '', dataEvento: '' });

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

      const whatsDestino = empresa.whats.replace(/\D/g, '') || "5519999999999"; 
      const texto = `🌟 *NOVO ORÇAMENTO* 🌟\n\n*Cliente:* ${dadosCliente.nome}\n*Data:* ${dadosCliente.dataEvento}\n\n*Itens:*\n${resumoItens}\n\n*Total:* R$ ${total.toFixed(2)}`;
      
      window.open(`https://wa.me/${whatsDestino}?text=${encodeURIComponent(texto)}`, '_blank');
      setCarrinho([]);
      setModalFinalizar(false);
    } catch (err) { alert("Erro ao processar."); }
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

  if (loading) return <div className="loader-catalogo">Carregando Acervo...</div>;

  return (
    <div className="catalogo-publico">
      <header className="cat-header">
        <div className="cat-header-content">
          <h1 className="cat-logo">{empresa.nome}</h1>
          
          {/* 🌟 BLOCO UNIFICADO ABAIXO DO NOME */}
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
        <aside className="cat-sidebar">
          {empresa.logo && <img src={empresa.logo} className="sidebar-logo-img" alt="Logo" />}
          
          <div className="sidebar-section">
            <h3 className="sidebar-title">Modalidade</h3>
            <ul className="sidebar-list">
              <li className={filtroModalidade === 'Todas' ? 'active' : ''} onClick={() => setFiltroModalidade('Todas')}>✓ Todas</li>
              <li className={filtroModalidade === 'Pegue e Monte' ? 'active' : ''} onClick={() => setFiltroModalidade('Pegue e Monte')}>📦 Pegue e Monte</li>
              <li className={filtroModalidade === 'Decoração Completa' ? 'active' : ''} onClick={() => setFiltroModalidade('Decoração Completa')}>✨ Decoração</li>
            </ul>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Acervo</h3>
            <ul className="sidebar-list">
              <li className={filtroMenu === 'Todos' ? 'active destak' : 'destak'} onClick={() => setFiltroMenu('Todos')}>🌟 Ver Tudo</li>
              {categoriasDinamicas.map(cat => (
                <li key={cat} className={filtroMenu === cat ? 'active' : ''} onClick={() => setFiltroMenu(cat)}>{cat}</li>
              ))}
            </ul>
          </div>
          
          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Temas</h3>
            {Object.entries(ESTRUTURA_TEMAS).map(([grupo, temas]) => (
              <div key={grupo}>
                <h4 className="sidebar-grupo-title">{grupo}</h4>
                <ul className="sidebar-list">
                  {temas.map(t => <li key={t} className={filtroMenu === t ? 'active' : ''} onClick={() => setFiltroMenu(t)}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <main className="cat-content">
          <div className="cat-search-bar">
            <input type="text" placeholder="O que você procura para sua festa?" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

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

      {carrinho.length > 0 && (
        <div className="cat-floating-bar" onClick={() => setModalFinalizar(true)}>
          <span>🛍️ {carrinho.length} itens - <strong>R$ {calcularTotal().toFixed(2)}</strong></span>
          <button>SOLICITAR ORÇAMENTO ➔</button>
        </div>
      )}
    </div>
  );
};

export default Catalogo;