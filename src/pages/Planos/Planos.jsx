import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore'; // 🔥 Adicionado doc e updateDoc
import { getAuth } from 'firebase/auth'; 
import Navbar from '../../components/Navbar'; 
import './Planos.css';

const Planos = () => {
  const [planos, setPlanos] = useState([]);
  const [recursosGlobais, setRecursosGlobais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false); // 🔥 Estado para o botão de pagamento
  const navigate = useNavigate();

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const isRecursoNumerico = (nome) => {
      const n = nome.toLowerCase();
      return n.includes('usuário') || n.includes('variedade') || n.includes('qtd') || n.includes('contrato');
  };

  const recursosPadrao = [
      "Usuários",
      "Variedade Produtos",
      "Gestão Clientes",
      "Gestão de Estoque",
      "Gestão de Pedidos/ Orçamentos",
      "Gestão de Logística",
      "Gestão de Contratos",
      "Gestão Fornecedores",
      "Gestão Financeira",
      "Gestão de Relatórios",
      "Gestão de Veículos",
      "Assinatura Digital",
      "Emissão de Etiquetas",
      "Agenda",
      "Catalago Digital",
      "Moodboard- Projeto Digital"
  ];

  useEffect(() => {
    const buscarPlanos = async () => {
      try {
        const q = query(collection(db, "planos"), orderBy("ordem", "asc"));
        const snap = await getDocs(q);
        const planosData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const recursosSet = new Set(recursosPadrao); 
        planosData.forEach(p => {
            if (Array.isArray(p.beneficios)) {
                p.beneficios.forEach(b => recursosSet.add(b));
            }
            if (p.limites) {
                Object.keys(p.limites).forEach(l => recursosSet.add(l));
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

  // 🔥 FUNÇÃO DE ATIVAÇÃO DE PLANO (SIMULAÇÃO DE PAGAMENTO) 🔥
  const handleAtualizarPlano = async (planoSelecionadoId) => {
      if (!usuarioLogado) return;
      
      setProcessando(true);
      try {
          const userRef = doc(db, 'usuarios', usuarioLogado.uid);
          
          // Atualiza o Firebase: Muda o plano e diz que a pessoa pagou!
          await updateDoc(userRef, {
              planoId: planoSelecionadoId,
              assinaturaAtiva: true, // Isso aqui DESCONGELA o sistema imediatamente
              dataAtualizacaoPlano: new Date().toISOString()
          });

          alert('🎉 Pagamento aprovado! O seu plano foi atualizado e o sistema está totalmente libertado.');
          navigate('/dashboard'); // Leva a pessoa de volta pro painel desbloqueado
          
      } catch (error) {
          console.error("Erro ao processar assinatura:", error);
          alert('Ocorreu um erro ao tentar processar a atualização do plano.');
      } finally {
          setProcessando(false);
      }
  };

  if (loading) return <div className="loading-screen">Carregando planos do Celebre...</div>;

  return (
    <>
      {usuarioLogado && <Navbar />}

      <div className={`planos-public-wrapper ${usuarioLogado ? 'com-sidebar' : ''}`}>
        
        <header className="planos-public-header">
          {usuarioLogado && (
              <button onClick={() => navigate('/dashboard')} className="btn-voltar-painel">
                  <i className="fas fa-arrow-left"></i> Voltar ao Painel
              </button>
          )}

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
                    
                    {/* 🔥 BOTÃO INTELIGENTE ATUALIZADO 🔥 */}
                    <button 
                        className="btn-selecionar" 
                        disabled={processando}
                        onClick={() => {
                            if (usuarioLogado) {
                                handleAtualizarPlano(p.id);
                            } else {
                                navigate(`/cadastro?plano=${p.id}`);
                            }
                        }}
                    >
                      {processando ? 'Processando...' : (usuarioLogado ? 'Atualizar Plano' : 'Começar agora')}
                    </button>

                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recursosGlobais.map((rec, idx) => {
                const numerico = isRecursoNumerico(rec);

                return (
                  <tr key={idx}>
                    <td className="td-recurso-nome">{rec}</td>
                    {planos.map(p => {
                      
                      if (numerico) {
                          const valorBanco = p.limites?.[rec];
                          const valor = (valorBanco === undefined || valorBanco === "") ? "Ilimitado" : valorBanco;
                          
                          return (
                              <td key={p.id} className="td-check-public" style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>
                                  {valor}
                              </td>
                          );
                      } else {
                          const tem = Array.isArray(p.beneficios) && p.beneficios.includes(rec);
                          return (
                            <td key={p.id} className="td-check-public">
                              {tem ? <i className="fas fa-check-circle check-sim"></i> : <i className="fas fa-ban check-nao"></i>}
                            </td>
                          );
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default Planos;