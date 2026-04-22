import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth"; // 🔥 Importação do Cadeado de Segurança
import "./NovoContrato.css";

const NovoContrato = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  
  // Estados para dados e controle visual
  const [listaPedidos, setListaPedidos] = useState([]);
  const [modalPedidos, setModalPedidos] = useState(false);
  const [meusModelos, setMeusModelos] = useState([]); 

  // Estado do formulário
  const [form, setForm] = useState({
    cliente: "", tema: "", dataEvento: "", horario: "",
    endereco: "", descricao: "", valorTotal: "", status: "Em Aberto",
    dataRetirada: "", dataDevolucao: ""
  });

  // 1. Carrega Pedidos e Modelos ao abrir a página
  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarDados = async () => {
      try {
        // 🔥 BLINDAGEM: Busca apenas as suas Locações (Pedidos)
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", usuarioLogado.uid));
        const snapPedidos = await getDocs(qLocacoes);
        const listaP = snapPedidos.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Ordena por data (mais recente primeiro)
        listaP.sort((a, b) => new Date(b.dataEvento || 0) - new Date(a.dataEvento || 0));
        setListaPedidos(listaP);

        // 🔥 BLINDAGEM: Busca apenas os seus Modelos de Contrato
        const qModelos = query(collection(db, "modelosContrato"), where("userId", "==", usuarioLogado.uid));
        const snapModelos = await getDocs(qModelos);
        setMeusModelos(snapModelos.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error("Erro ao carregar dados:", err); }
    };
    carregarDados();
  }, [usuarioLogado, navigate]);

  // 2. Importa os dados do Pedido selecionado no Modal
  const importarDados = (pedido) => {
    const descItens = pedido.itens ? pedido.itens.map(i => `${i.qtd || 1}x ${i.nome || i.produto}`).join("\n") : "";
    setForm({
      ...form,
      cliente: pedido.clienteNome || pedido.cliente || "",
      tema: pedido.tema || "",
      dataEvento: pedido.dataEvento || "",
      dataRetirada: pedido.dataRetirada || pedido.dataEvento || "",
      dataDevolucao: pedido.dataDevolucao || pedido.dataEvento || "",
      valorTotal: pedido.valorTotal || pedido.valor || 0,
      descricao: descItens 
    });
    setModalPedidos(false); // Fecha o modal
  };

  // 3. Aplica o Modelo de Contrato escolhido
  const aplicarModelo = (e) => {
    const idModelo = e.target.value;
    const modelo = meusModelos.find(m => m.id === idModelo);
    
    if (modelo) {
      const atual = form.descricao || "";
      // Adiciona o texto do modelo sem apagar o que já estava escrito
      setForm({ 
        ...form, 
        descricao: atual + (atual ? "\n\n--------------------------------\nTERMOS E CONDIÇÕES:\n" : "") + modelo.texto 
      });
    }
  };

  // 4. Salva o contrato no Firebase
  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      // 🔥 BLINDAGEM: Salva o contrato com o seu userId
      await addDoc(collection(db, "contratos"), { 
        ...form, 
        valorTotal: Number(form.valorTotal), 
        createdAt: serverTimestamp(),
        userId: usuarioLogado.uid // 🔥 CADEADO DE SEGURANÇA
      });
      alert("Contrato salvo com sucesso!");
      navigate("/contratos");
    } catch (err) { alert("Erro ao salvar: " + err.message); }
  };

  return (
    <div className="novo-contrato-layout">
      <div className="container-form">
        
        {/* CABEÇALHO */}
        <header className="form-header">
          <button className="btn-voltar-link" onClick={() => navigate("/contratos")}>
            ← Voltar para listagem
          </button>
          
          <div className="header-title-row">
            <h1>Novo Contrato 📝</h1>
            <button className="btn-import-acao" type="button" onClick={() => setModalPedidos(true)}>
              📥 Importar Pedido
            </button>
          </div>
        </header>

        <form onSubmit={handleSalvar} className="main-form">
          
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
                  placeholder="Nome completo"
                />
              </div>
              <div className="input-field">
                <label>Data do Evento</label>
                <input type="date" value={form.dataEvento} onChange={e => setForm({...form, dataEvento: e.target.value})} />
              </div>
              <div className="input-field">
                <label>Tema</label>
                <input value={form.tema} onChange={e => setForm({...form, tema: e.target.value})} placeholder="Ex: Casamento Civil" />
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
            <div className="input-field full" style={{marginTop: '15px'}}>
               <label>Endereço / Local</label>
               <input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} placeholder="Endereço completo da festa" />
            </div>
          </section>

          {/* SEÇÃO 3: DESCRIÇÃO E MODELOS */}
          <section className="form-section-card">
            <div className="header-section-modelos">
              <h3 className="section-title">Itens & Contrato</h3>
              
              {/* SELETOR DE MODELOS (DOURADO E LIMPO) */}
              <select onChange={aplicarModelo} className="select-modelo-clean">
                <option value="">📄 Inserir Modelo de Contrato...</option>
                {meusModelos.map(m => (
                  <option key={m.id} value={m.id}>{m.titulo}</option>
                ))}
              </select>
            </div>

            <div className="input-field full">
              <textarea 
                rows="12" 
                value={form.descricao} 
                onChange={e => setForm({...form, descricao: e.target.value})} 
                placeholder="Descreva os itens aqui ou selecione um modelo acima..." 
              />
            </div>
            
            <div className="input-field" style={{marginTop: '20px', maxWidth: '200px'}}>
              <label>Status do Contrato</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Em Aberto</option>
                <option>Assinado</option>
                <option>Finalizado</option>
              </select>
            </div>
          </section>

          <button type="submit" className="btn-finalizar-tudo">SALVAR CONTRATO</button>
        </form>
      </div>

      {/* MODAL DE IMPORTAÇÃO (CORRIGIDO) */}
      {modalPedidos && (
        <div className="modal-import-overlay">
          <div className="modal-import-box">
            <h3>Selecione um Pedido</h3>
            <div className="import-scroll-list">
              {listaPedidos.map(p => (
                <div key={p.id} className="import-card-item" onClick={() => importarDados(p)}>
                  <div>
                    <strong>{p.clienteNome || p.cliente}</strong>
                    <div style={{fontSize: '12px', color: '#64748b'}}>📅 {p.dataEvento || '---'}</div>
                  </div>
                  <span className="valor-verde">R$ {p.valorTotal || p.valor || 0}</span>
                </div>
              ))}
            </div>
            <button className="btn-fechar-modal" type="button" onClick={() => setModalPedidos(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovoContrato;