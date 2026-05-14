import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 
import "./NovoContrato.css"; 

const EditarContrato = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [carregando, setCarregando] = useState(true);
  const [meusModelos, setMeusModelos] = useState([]);
  const [dadosIniciais, setDadosIniciais] = useState(null);

  // Estado do formulário com TODOS os campos
  const [form, setForm] = useState({
    cliente: "",
    tema: "",
    dataEvento: "",
    horario: "",
    endereco: "",
    descricao: "",
    valorTotal: "",
    status: "",
    dataRetirada: "",
    dataDevolucao: ""
  });

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO JURÍDICO)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de contratos:", error);
    }
  };

  // 1. Carrega os dados do contrato existente e os modelos
  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarDados = async () => {
      try {
        // Busca o contrato específico pelo ID
        const docRef = doc(db, "contratos", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // 🔥 BLINDAGEM: Verifica se o contrato pertence à sua empresa
          if (data.userId && data.userId !== usuarioLogado.uid) {
              alert("Acesso negado: Este contrato pertence a outra empresa.");
              navigate('/contratos');
              return;
          }
          
          setForm(data);
          setDadosIniciais(data); // Guarda a memória para a auditoria
        } else {
          alert("Contrato não encontrado!");
          navigate("/contratos");
          return;
        }

        // 🔥 BLINDAGEM: Busca APENAS os seus modelos de contrato
        const qModelos = query(collection(db, "modelosContrato"), where("userId", "==", usuarioLogado.uid));
        const snapModelos = await getDocs(qModelos);
        setMeusModelos(snapModelos.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setCarregando(false);
      }
    };
    
    carregarDados();
  }, [id, usuarioLogado, navigate]);

  // 2. Aplica modelo (Adiciona texto ao final sem apagar o que já tem)
  const aplicarModelo = (e) => {
    const idModelo = e.target.value;
    const modelo = meusModelos.find(m => m.id === idModelo);
    
    if (modelo) {
      const atual = form.descricao || "";
      setForm({ 
        ...form, 
        descricao: atual + (atual ? "\n\n" : "") + modelo.texto 
      });
    }
  };

  // 3. Atualiza no Firebase
  const handleAtualizar = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(db, "contratos", id);
      await updateDoc(docRef, {
        ...form,
        valorTotal: Number(form.valorTotal) 
      });

      // 🔥 ANÁLISE DE AUDITORIA (Raio-X da edição)
      let mudancas = [];
      if (dadosIniciais) {
        if (dadosIniciais.valorTotal !== form.valorTotal) mudancas.push(`Valor (de R$${dadosIniciais.valorTotal} para R$${form.valorTotal})`);
        if (dadosIniciais.status !== form.status) mudancas.push(`Status (para '${form.status}')`);
        if (dadosIniciais.descricao !== form.descricao) mudancas.push(`Texto/Cláusulas alteradas`);
      }

      if (mudancas.length > 0) {
        await registrarLog("EDIÇÃO DE CONTRATO", `Editou o contrato de "${form.cliente}". Alterações: ${mudancas.join(' | ')}.`);
      }

      alert("Contrato atualizado com sucesso! ✅");
      navigate("/contratos");
    } catch (error) {
      alert("Erro ao atualizar: " + error.message);
    }
  };

  if (carregando) return <div className="loading-screen">Carregando dados...</div>;

  return (
    <div className="novo-contrato-layout">
      <div className="container-form">
        
        {/* CABEÇALHO */}
        <header className="form-header">
          <button type="button" className="btn-voltar-link" onClick={() => navigate("/contratos")}>
            ← Voltar sem salvar
          </button>
          
          <div className="header-title-row">
            <h1>Editar Contrato ✏️</h1>
            <span className="status-badge-large">{form.status}</span>
          </div>
        </header>

        <form onSubmit={handleAtualizar} className="main-form">
          
          {/* SEÇÃO 1: DADOS BÁSICOS */}
          <section className="form-section-card">
            <h3 className="section-title">Dados do Cliente</h3>
            <div className="grid-inputs">
              <div className="input-field full">
                <label>Nome do Cliente</label>
                <input 
                  value={form.cliente} 
                  onChange={e => setForm({...form, cliente: e.target.value})} 
                  required 
                />
              </div>
              <div className="input-field">
                <label>Data do Evento</label>
                <input type="date" value={form.dataEvento} onChange={e => setForm({...form, dataEvento: e.target.value})} />
              </div>
              <div className="input-field">
                <label>Tema</label>
                <input value={form.tema} onChange={e => setForm({...form, tema: e.target.value})} />
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: LOGÍSTICA */}
          <section className="form-section-card">
            <h3 className="section-title">Logística & Valores</h3>
            <div className="grid-inputs three-cols">
              <div className="input-field">
                <label>Retirada</label>
                <input type="date" value={form.dataRetirada} onChange={e => setForm({...form, dataRetirada: e.target.value})} />
              </div>
              <div className="input-field">
                <label>Devolução</label>
                <input type="date" value={form.dataDevolucao} onChange={e => setForm({...form, dataDevolucao: e.target.value})} />
              </div>
              <div className="input-field">
                <label>Valor Total (R$)</label>
                <input 
                  type="number" 
                  className="input-valor"
                  step="0.01" 
                  value={form.valorTotal} 
                  onChange={e => setForm({...form, valorTotal: e.target.value})} 
                  required 
                />
              </div>
            </div>
            
            <div className="grid-inputs" style={{marginTop: '15px'}}>
               <div className="input-field full">
                 <label>Endereço / Local</label>
                 <input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
               </div>
            </div>
          </section>

          {/* SEÇÃO 3: DESCRIÇÃO E STATUS */}
          <section className="form-section-card">
            <div className="header-section-modelos">
              <h3 className="section-title">Itens & Contrato</h3>
              
              <select onChange={aplicarModelo} className="select-modelo-clean">
                <option value="">➕ Adicionar outro modelo...</option>
                {meusModelos.map(m => (
                  <option key={m.id} value={m.id}>{m.titulo}</option>
                ))}
              </select>
            </div>

            <div className="input-field full">
              <textarea 
                rows="15" 
                value={form.descricao} 
                onChange={e => setForm({...form, descricao: e.target.value})} 
              />
            </div>
            
            <div className="input-field" style={{marginTop: '20px', maxWidth: '250px'}}>
              <label>Status do Contrato</label>
              <select 
                value={form.status} 
                onChange={e => setForm({...form, status: e.target.value})}
                style={{fontWeight: 'bold', color: '#0f172a'}}
              >
                <option value="Em Aberto">Em Aberto</option>
                <option value="Assinado">Assinado</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </section>

          <button type="submit" className="btn-finalizar-tudo">SALVAR ALTERAÇÕES</button>
        </form>
      </div>
    </div>
  );
};

export default EditarContrato;