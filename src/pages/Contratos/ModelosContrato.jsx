import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./ModelosContrato.css";

const ModelosContrato = () => {
  const [modelos, setModelos] = useState([]);
  const [novo, setNovo] = useState({ titulo: "", texto: "" });
  const [editandoId, setEditandoId] = useState(null);
  const navigate = useNavigate();

  // 🌟 NOVO: Controle de Abas e Estado do Relatório de Logística
  const [abaAtiva, setAbaAtiva] = useState('contratos'); // 'contratos' ou 'logistica'
  const [textoRelatorio, setTextoRelatorio] = useState('');
  const [salvandoRelatorio, setSalvandoRelatorio] = useState(false);

  useEffect(() => {
    // Carrega os modelos de contrato normais
    const q = query(collection(db, "modelosContrato"));
    const unsub = onSnapshot(q, (snap) => {
      setModelos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 🌟 NOVO: Carrega o texto atual do Relatório de Avarias
    const carregarRelatorioLogistica = async () => {
      try {
        const docSnap = await getDoc(doc(db, "contratos", "relatorio_avarias"));
        if (docSnap.exists()) {
          setTextoRelatorio(docSnap.data().conteudo || "");
        }
      } catch (error) {
        console.error("Erro ao carregar relatório:", error);
      }
    };
    
    carregarRelatorioLogistica();

    return () => unsub();
  }, []);

  // --- TEXTOS PADRÃO (CONTRATOS) ---
  const templates = {
    pegueMonte: {
      titulo: "CONTRATO PEGUE E MONTE",
      texto: `CLÁUSULAS - PEGUE E MONTE:\n\n1. DO TRANSPORTE: O LOCATÁRIO é totalmente responsável pelo transporte das peças, devendo garantir veículo adequado para que não haja danos.\n2. DA MONTAGEM: A ÁGAPE DECORAÇÕES não realiza montagem neste modelo. O cliente retira, monta e devolve.\n3. DA DEVOLUÇÃO: As peças devem ser devolvidas limpas e embaladas da mesma forma que foram entregues.\n4. DANOS E AVARIAS: Em caso de quebra, rasgo ou mancha, será cobrado o valor de reposição da peça (preço de mercado) no ato da devolução.\n5. ATRASOS: A não devolução na data estipulada gera multa de 20% do valor do contrato por dia de atraso.`
    },
    decoracao: {
      titulo: "CONTRATO DE DECORAÇÃO COMPLETA",
      texto: `CLÁUSULAS - DECORAÇÃO COMPLETA:\n\n1. DA PRESTAÇÃO DE SERVIÇO: A ÁGAPE DECORAÇÕES se compromete a realizar a montagem e desmontagem completa do cenário contratado.\n2. DO ACESSO: O local deve estar liberado para a equipe de montagem pelo menos 2 horas antes do início do evento.\n3. DA ESTRUTURA: A contratada não se responsabiliza por falhas na estrutura do local (tomadas, goteiras, piso irregular) que impeçam a montagem.\n4. ALTERAÇÕES: Mudanças no layout só poderão ser feitas se solicitadas com 7 dias de antecedência.\n5. SEGURANÇA: O LOCATÁRIO é responsável pela integridade das peças durante o evento.`
    },
    pecas: {
      titulo: "CONTRATO DE PEÇAS AVULSAS",
      texto: `CLÁUSULAS - LOCAÇÃO DE PEÇAS INDIVIDUAIS:\n\n1. OBJETO: Locação apenas dos itens descritos, sem serviços de frete ou montagem inclusos.\n2. CONFERÊNCIA: O cliente deve conferir as peças no ato da retirada. Reclamações posteriores não serão aceitas.\n3. REPOSIÇÃO: Peças de cerâmica, vidro ou tecido que forem danificadas deverão ser pagas integralmente na devolução.\n4. LIMPEZA: As peças devem retornar higienizadas, sob pena de cobrança de taxa de limpeza de R$ 50,00.`
    }
  };

  // --- TEXTO PADRÃO (LOGÍSTICA) ---
  const textoPadraoRelatorio = `Declaramos para os devidos fins que os itens listados acima foram locados em perfeito estado de conservação e, após a devolução e conferência física no galpão, apresentaram as avarias ou ausências descritas.\n\nConforme os termos do contrato de locação firmado, os produtos danificados estão sujeitos à cobrança de taxa de manutenção ou conserto. No caso de peças extraviadas ou com perda total, será cobrado o valor integral de reposição do produto de acordo com o preço de mercado atualizado listado acima.\n\nNossa equipe entrará em contato para apresentar as opções de pagamento para regularização das pendências.`;

  const carregarTemplate = (tipo) => {
    setNovo(templates[tipo]);
  };

  const handleSalvarContrato = async (e) => {
    e.preventDefault();
    try {
      if (editandoId) {
        await updateDoc(doc(db, "modelosContrato", editandoId), novo);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "modelosContrato"), { ...novo, createdAt: serverTimestamp() });
      }
      setNovo({ titulo: "", texto: "" });
      alert("Modelo salvo com sucesso!");
    } catch (err) { alert("Erro: " + err.message); }
  };

  const prepararEdicao = (m) => {
    setEditandoId(m.id);
    setNovo({ titulo: m.titulo, texto: m.texto });
  };

  // 🌟 NOVO: Função para salvar o Relatório de Avarias
  const handleSalvarRelatorio = async (e) => {
    e.preventDefault();
    setSalvandoRelatorio(true);
    try {
      // Usamos setDoc com merge: true para criar o doc se não existir, ou atualizar se existir
      await setDoc(doc(db, "contratos", "relatorio_avarias"), {
        conteudo: textoRelatorio,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      alert("Texto do Relatório de Avarias salvo com sucesso! O PDF já sairá com este novo texto.");
    } catch (err) {
      alert("Erro ao salvar relatório: " + err.message);
    } finally {
      setSalvandoRelatorio(false);
    }
  };

  return (
    <div className="modelos-page-container">
      <header className="modelos-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          <button className="btn-back" onClick={() => navigate("/contratos")}>← Voltar para Contratos</button>
          <h1 style={{margin: 0}}>Configuração de Textos 📝</h1>
        </div>
        <p style={{marginTop: '5px'}}>Crie e edite as cláusulas padrão que serão usadas no sistema.</p>
        
        {/* 🌟 NOVO: ABAS DE NAVEGAÇÃO 🌟 */}
        <div className="abas-config-textos">
          <button 
            className={`aba-btn ${abaAtiva === 'contratos' ? 'ativa' : ''}`} 
            onClick={() => setAbaAtiva('contratos')}
          >
            📑 Modelos de Contratos
          </button>
          <button 
            className={`aba-btn ${abaAtiva === 'logistica' ? 'ativa' : ''}`} 
            onClick={() => setAbaAtiva('logistica')}
          >
            🚚 Relatório de Logística (PDF)
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* ABA 1: MODELOS DE CONTRATOS (SEU CÓDIGO ORIGINAL MANTIDO) */}
      {/* ========================================================= */}
      {abaAtiva === 'contratos' && (
        <div className="modelos-grid">
          <div className="modelo-form-card">
            <h3>{editandoId ? "Editando Modelo" : "Criar Novo Modelo"}</h3>
            
            {!editandoId && (
              <div className="atalhos-templates">
                <p>Preencher rápido com:</p>
                <div className="btn-group-templates">
                  <button type="button" onClick={() => carregarTemplate('pegueMonte')}>📦 Pegue e Monte</button>
                  <button type="button" onClick={() => carregarTemplate('decoracao')}>✨ Decoração</button>
                  <button type="button" onClick={() => carregarTemplate('pecas')}>🧩 Peças Avulsas</button>
                </div>
              </div>
            )}

            <form onSubmit={handleSalvarContrato}>
              <div className="form-group">
                <label>TÍTULO DO MODELO</label>
                <input 
                  className="form-input" 
                  placeholder="Ex: Contrato Padrão 2026"
                  value={novo.titulo} 
                  onChange={e => setNovo({...novo, titulo: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>CLÁUSULAS E TERMOS</label>
                <textarea 
                  className="form-input area" 
                  rows="15" 
                  placeholder="O texto do contrato aparecerá aqui..."
                  value={novo.texto}
                  onChange={e => setNovo({...novo, texto: e.target.value})}
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn-save-modelo">
                {editandoId ? "ATUALIZAR MODELO" : "SALVAR MODELO NO BANCO"}
              </button>
              {editandoId && <button type="button" className="btn-cancel-edit" onClick={() => {setEditandoId(null); setNovo({titulo:"", texto:""})}}>Cancelar Edição</button>}
            </form>
          </div>

          <div className="modelos-lista">
            <h3>Modelos Salvos</h3>
            {modelos.length === 0 ? (
              <div className="empty-models">
                <p>Nenhum modelo cadastrado.</p>
                <small>Use os botões ao lado para criar os primeiros!</small>
              </div>
            ) : (
              modelos.map(m => (
                <div key={m.id} className="modelo-item-card">
                  <div className="modelo-info">
                    <h4>{m.titulo}</h4>
                    <p>{m.texto.substring(0, 80)}...</p>
                  </div>
                  <div className="modelo-actions">
                    <button className="btn-icon-small" onClick={() => prepararEdicao(m)} title="Editar">✏️</button>
                    <button className="btn-icon-small delete" onClick={() => deleteDoc(doc(db, "modelosContrato", m.id))} title="Excluir">🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: RELATÓRIO DE LOGÍSTICA (AVARIAS E FALTAS)          */}
      {/* ========================================================= */}
      {abaAtiva === 'logistica' && (
        <div className="modelo-form-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3>Texto Legal: Termo de Ocorrência (Avarias/Falta)</h3>
          <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '20px'}}>
            Este é o texto que aparecerá no rodapé do <strong>PDF gerado na tela de Logística</strong> quando o cliente devolver peças danificadas ou incompletas.
          </p>

          <form onSubmit={handleSalvarRelatorio}>
            <div className="form-group">
              <label style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>CONTEÚDO DO AVISO LEGAL</span>
                <button 
                  type="button" 
                  onClick={() => setTextoRelatorio(textoPadraoRelatorio)}
                  style={{background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'}}
                >
                  🔄 Carregar Texto Padrão
                </button>
              </label>
              <textarea 
                className="form-input area" 
                rows="12" 
                placeholder="Insira as cláusulas de cobrança de avarias aqui..."
                value={textoRelatorio}
                onChange={e => setTextoRelatorio(e.target.value)}
                required
              ></textarea>
            </div>
            
            <button 
              type="submit" 
              className="btn-save-modelo" 
              disabled={salvandoRelatorio}
              style={{backgroundColor: '#dc2626'}}
            >
              {salvandoRelatorio ? "SALVANDO..." : "SALVAR TEXTO DO RELATÓRIO DE AVARIAS"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default ModelosContrato;