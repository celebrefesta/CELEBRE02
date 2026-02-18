import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import SignatureCanvas from "react-signature-canvas";
import "./AssinaturaContrato.css";

const AssinaturaContrato = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // CRIAMOS DUAS REFERÊNCIAS: UMA PARA CADA ASSINATURA
  const sigCliente = useRef({});
  const sigAgape = useRef({});
  
  const [contrato, setContrato] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState("pronto"); // pronto, salvando, sucesso, erro

  // 1. Carrega os dados do contrato
  useEffect(() => {
    const buscar = async () => {
      try {
        const docSnap = await getDoc(doc(db, "contratos", id));
        if (docSnap.exists()) {
          setContrato(docSnap.data());
        } else {
          alert("Contrato não encontrado");
          navigate("/contratos");
        }
      } catch (err) { console.error(err); } 
      finally { setCarregando(false); }
    };
    buscar();
  }, [id, navigate]);

  // Funções para limpar cada quadro separadamente
  const limparCliente = () => sigCliente.current.clear();
  const limparAgape = () => sigAgape.current.clear();

  // 2. SALVAR AS DUAS ASSINATURAS
  const salvarAssinaturas = async () => {
    // Validação: O Cliente é OBRIGADO a assinar
    if (sigCliente.current.isEmpty()) {
      alert("⚠️ O campo do CLIENTE precisa ser assinado!");
      return;
    }

    setStatus("salvando");

    try {
      const docRef = doc(db, "contratos", id);
      
      // Captura as imagens (Usando .getCanvas() para evitar bugs)
      const imgCliente = sigCliente.current.getCanvas().toDataURL("image/png");
      
      // A da Ágape é opcional? Se estiver vazia, salva null. Se tiver desenho, salva a imagem.
      const imgAgape = !sigAgape.current.isEmpty() 
        ? sigAgape.current.getCanvas().toDataURL("image/png") 
        : null;

      // Monta o objeto para atualizar no Firebase
      const atualizacao = {
        assinaturaCliente: imgCliente,
        status: "Assinado",
        dataAssinatura: new Date().toISOString()
      };

      // Só adiciona a da Ágape se ela existir
      if (imgAgape) {
        atualizacao.assinaturaAgape = imgAgape;
      }

      await updateDoc(docRef, atualizacao);

      setStatus("sucesso");
      setTimeout(() => {
        alert("✅ Contrato assinado e finalizado com sucesso!");
        navigate("/contratos");
      }, 500);

    } catch (error) {
      console.error("Erro ao salvar:", error);
      setStatus("erro");
      alert("❌ Erro ao salvar: " + error.message);
    }
  };

  if (carregando) return <div className="loading-screen">Carregando dados...</div>;

  return (
    <div className="assinatura-container">
      <div className="assinatura-card">
        <header className="assinatura-header">
          <h1>Assinatura Digital 🖋️</h1>
          <p>Olá, <strong>{contrato?.cliente}</strong>. Por favor, revise e assine.</p>
        </header>

        <div className="resumo-contrato">
          <p><strong>Evento:</strong> {contrato?.tema || "---"}</p>
          <p><strong>Data:</strong> {contrato?.dataEvento ? contrato.dataEvento.split('-').reverse().join('/') : "--/--/----"}</p>
          <p><strong>Total:</strong> R$ {Number(contrato?.valorTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>

        {/* --- CAMPO 1: CLIENTE --- */}
        <div className="canvas-wrapper">
          <label className="label-assinatura">✍️ ASSINATURA DO CLIENTE ({contrato?.cliente}):</label>
          <div className="canvas-border">
            <SignatureCanvas
              ref={sigCliente}
              penColor="#0f172a"
              canvasProps={{ className: "sigCanvas" }}
              backgroundColor="white"
            />
          </div>
          <button className="btn-limpar" onClick={limparCliente}>Limpar / Refazer</button>
        </div>

        {/* --- CAMPO 2: ÁGAPE DECORAÇÕES --- */}
        <div className="canvas-wrapper agape-wrapper">
          <label className="label-assinatura ouro">✍️ ASSINATURA ÁGAPE DECORAÇÕES:</label>
          <div className="canvas-border ouro-border">
            <SignatureCanvas
              ref={sigAgape}
              penColor="#b48a3c" /* Assinatura Dourada */
              canvasProps={{ className: "sigCanvas" }}
              backgroundColor="white"
            />
          </div>
          <button className="btn-limpar" onClick={limparAgape}>Limpar / Refazer</button>
        </div>

        {/* --- BOTÃO FINAL --- */}
        <button 
          className="btn-confirmar-assinatura" 
          onClick={salvarAssinaturas}
          disabled={status !== "pronto" && status !== "erro"}
          style={{ 
            backgroundColor: status === "sucesso" ? "#22c55e" : "#0f172a",
            opacity: status === "salvando" ? 0.7 : 1
          }}
        >
          {status === "pronto" && "FINALIZAR E SALVAR CONTRATO"}
          {status === "salvando" && "⏳ SALVANDO ASSINATURAS..."}
          {status === "sucesso" && "✅ SUCESSO!"}
          {status === "erro" && "ERRO - TENTE NOVAMENTE"}
        </button>
      </div>
    </div>
  );
};

export default AssinaturaContrato;