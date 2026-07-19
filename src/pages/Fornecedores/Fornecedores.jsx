import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './Fornecedores.css';

const Fornecedores = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE FORNECEDORES VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de fornecedores:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarFornecedores = async () => {
      try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS os fornecedores da empresa (tenantId)
        const q = query(collection(db, "fornecedores"), where("userId", "==", tenantId));
        const querySnapshot = await getDocs(q);
        const lista = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFornecedores(lista);
      } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarFornecedores();
  }, [usuarioLogado, navigate, tenantId]);

  const handleDelete = async (id, nome) => {
      if(window.confirm(`Deseja realmente excluir o fornecedor "${nome}"?`)) {
          try {
              // 🔥 Regista no monitoramento antes de apagar
              await registrarLog("EXCLUSÃO DE FORNECEDOR", `Excluiu o fornecedor/parceiro: "${nome}".`);
              await deleteDoc(doc(db, "fornecedores", id));
              setFornecedores(prev => prev.filter(f => f.id !== id));
          } catch (e) {
              alert("Erro ao excluir fornecedor.");
          }
      }
  };

  const renderStars = (score) => {
    const numScore = Number(score) || 0;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= numScore) {
        stars.push(<i key={i} className="fas fa-star filled"></i>);
      } else if (i === Math.ceil(numScore) && !Number.isInteger(numScore)) {
        stars.push(<i key={i} className="fas fa-star-half-alt filled"></i>);
      } else {
        stars.push(<i key={i} className="far fa-star"></i>);
      }
    }
    return stars;
  };

  const fornecedoresFiltrados = fornecedores.filter(f =>
      (f.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (f.categoria || '').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="fornecedores-page">
      <header className="page-header">
        <div className="page-title">
          <h1>Meus Fornecedores</h1>
          <p>Parceiros de compras e serviços</p>
        </div>
        <button className="btn btn-accent" onClick={() => navigate('/novo-fornecedor')}>
          <i className="fas fa-plus"></i> Novo Fornecedor
        </button>
      </header>

      <div className="filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label>Buscar Fornecedor</label>
            <input 
                type="text" 
                className="form-control" 
                placeholder="Nome, CNPJ ou Produto..." 
                value={busca}
                onChange={(e) => setFornecedores(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <select className="form-control">
              <option>Todas</option>
              <option>Decoração/Acervo</option>
              <option>Descartáveis</option>
              <option>Bolos & Doces</option>
              <option>Transporte</option>
            </select>
          </div>
          <div className="form-group">
            <button className="btn btn-primary full-width" style={{marginTop: '24px'}}>
              <i className="fas fa-search"></i> Filtrar
            </button>
          </div>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
            <div style={{padding: '40px', textAlign: 'center', color: '#64748b'}}>Carregando os seus fornecedores...</div>
        ) : (
        <table>
          <thead>
            <tr>
              <th width="30%">Fornecedor</th>
              <th width="25%">Contato</th>
              <th width="15%">Categoria</th>
              <th width="10%">Avaliação</th>
              <th width="10%">Site/Link</th>
              <th width="10%" style={{textAlign: 'right'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {fornecedoresFiltrados.length === 0 ? (
                <tr>
                    <td colSpan="6" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>Nenhum fornecedor cadastrado.</td>
                </tr>
            ) : (
            fornecedoresFiltrados.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="supplier-info">
                    <div className="supplier-icon" style={{backgroundColor: item.iconeBg || '#e0f2fe', color: item.iconeColor || '#0284c7'}}>
                      <i className={item.icone || 'fas fa-store'}></i>
                    </div>
                    <div>
                      <div className="supplier-name">{item.nome}</div>
                      <div className="supplier-sub">{item.subtexto || item.cnpj}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    {item.contato && <div><i className="fab fa-whatsapp"></i> {item.contato}</div>}
                    {item.email && <div><i className="far fa-envelope"></i> {item.email}</div>}
                    {item.local && <div><i className="fas fa-map-marker-alt"></i> {item.local}</div>}
                  </div>
                </td>
                <td><span className={`badge ${item.catClass || 'badge-blue'}`}>{item.categoria || 'Geral'}</span></td>
                <td>
                  <div className="stars">
                    {renderStars(item.stars)}
                  </div>
                </td>
                <td>
                  {item.link ? (
                    <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="link-btn">
                      <i className={item.linkIcon || "fas fa-external-link-alt"}></i> Visitar
                    </a>
                  ) : (
                    <span className="no-link">-</span>
                  )}
                </td>
                <td style={{textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                  <button className="action-btn" title="Editar" onClick={() => navigate(`/fornecedores/editar/${item.id}`)}>
                    <i className="fas fa-pen"></i>
                  </button>
                  <button className="action-btn" title="Excluir" style={{color: '#ef4444', backgroundColor: '#fef2f2'}} onClick={() => handleDelete(item.id, item.nome)}>
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
};

export default Fornecedores;