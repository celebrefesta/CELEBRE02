import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import './Planos.css';

const Planos = () => {
  const [planos, setPlanos] = useState([]);
  const [recursosGlobais, setRecursosGlobais] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1. LISTA BASE: Garante que essas linhas sempre existam, mesmo vazias.
  const recursosPadrao = [
      "Qtd. Usuários", "Variedade Produtos", "Catálogo Digital", 
      "Gestão Estoque", "Etiquetas/QR", "Logística", 
      "Contratos", "Assinatura Digital"
  ];

  useEffect(() => {
    const buscarPlanos = async () => {
      try {
        const q = query(collection(db, "planos"), orderBy("ordem", "asc"));
        const snap = await getDocs(q);
        const planosData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 2. MISTURA: Pega a lista base e adiciona qualquer item novo criado no Admin
        const recursosSet = new Set(recursosPadrao); 
        planosData.forEach(p => {
            if (Array.isArray(p.beneficios)) {
                p.beneficios.forEach(b => recursosSet.add(b));
            }
        });
        
        setRecursosGlobais(Array.from(recursosSet));
        setPlanos(planosData);
      } catch (error) {
        console.error("Erro ao buscar planos:", error);
      } finally {
        setLoading(false);
      }
    };
    buscarPlanos();
  }, []);

  if (loading) return <div className="loading-screen">Carregando planos do Celebre...</div>;

  return (
    <div className="planos-public-wrapper">
      <header className="planos-public-header">
        <h1>Sistema Web e futuramente App Incluso <i className="fab fa-android"></i> <i className="fab fa-apple"></i></h1>
        <p>Compare os recursos e escolha o plano ideal para sua empresa.</p>
      </header>

      <div className="matrix-public-container">
        <table className="matrix-public-table">
          <thead>
            <tr>
              <th className="th-recursos-public">
                Recursos &<br/>Funcionalidades
              </th>
              {planos.map(p => (
                <th key={p.id} className={`th-plano-public ${String(p.destaque) === "true" ? 'is-destaque' : ''}`}>
                  {String(p.destaque) === "true" && <span className="tag-destaque">MAIS ESCOLHIDO</span>}
                  <h3>{p.nome}</h3>
                  <div className="preco-box">
                    <span className="moeda">R$</span>
                    <span className="valor">{p.preco}</span>
                    <span className="periodo">/mês</span>
                  </div>
                  <button className="btn-selecionar" onClick={() => navigate(`/checkout?plano=${p.id}`)}>
                    Começar agora
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recursosGlobais.map((rec, idx) => (
              <tr key={idx}>
                <td className="td-recurso-nome">{rec}</td>
                {planos.map(p => {
                  // Procura se a funcionalidade exata está salva no plano
                  const tem = Array.isArray(p.beneficios) && p.beneficios.includes(rec);
                  return (
                    <td key={p.id} className="td-check-public">
                      {tem ? <i className="fas fa-check-circle check-sim"></i> : <i className="fas fa-ban check-nao"></i>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Planos;