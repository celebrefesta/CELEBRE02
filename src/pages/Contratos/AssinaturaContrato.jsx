import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import SignatureCanvas from "react-signature-canvas";
import "./AssinaturaContrato.css";

const AssinaturaContrato = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const sigCliente = useRef({});
  const sigAgape = useRef({});
  
  const [contrato, setContrato] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState("pronto"); 

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

  const limparCliente = () => { if(sigCliente.current) sigCliente.current.clear(); };
  const limparAgape = () => { if(sigAgape.current) sigAgape.current.clear(); };

  const salvarAssinaturas = async () => {
    let novaAssinaturaCliente = null;
    let novaAssinaturaAgape = null;

    if (sigCliente.current && !sigCliente.current.isEmpty()) {
        novaAssinaturaCliente = sigCliente.current.getCanvas().toDataURL("image/png");
    }

    if (sigAgape.current && !sigAgape.current.isEmpty()) {
        novaAssinaturaAgape = sigAgape.current.getCanvas().toDataURL("image/png");
    }

    if (!novaAssinaturaCliente && !novaAssinaturaAgape) {
        alert("⚠️ Você não fez nenhuma assinatura nova para salvar.");
        return;
    }

    setStatus("salvando");

    try {
      const docRef = doc(db, "contratos", id);
      const atualizacao = {};

      if (novaAssinaturaCliente) atualizacao.assinaturaCliente = novaAssinaturaCliente;
      if (novaAssinaturaAgape) atualizacao.assinaturaAgape = novaAssinaturaAgape;

      const temCliente = contrato.assinaturaCliente || novaAssinaturaCliente;
      const temAgape = contrato.assinaturaAgape || novaAssinaturaAgape;

      if (temCliente && temAgape) {
          atualizacao.status = "Assinado";
          atualizacao.dataAssinatura = new Date().toISOString();
      }

      await updateDoc(docRef, atualizacao);

      setStatus("sucesso");
      setTimeout(() => {
        alert("✅ Assinatura salva com sucesso!");
        window.location.reload(); 
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
        
        {/* 🔥 NOVO BOTÃO DE VOLTAR AQUI 🔥 */}
        <div style={{ textAlign: "left", marginBottom: "20px" }}>
          <button className="btn-voltar-assinatura" onClick={() => navigate("/contratos")}>
            ← Voltar
          </button>
        </div>

        <header className="assinatura-header">
          <h1>Assinatura Digital 🖋️</h1>
          <p>Olá, <strong>{contrato?.cliente}</strong>. Revise e assine os termos abaixo.</p>
        </header>

        <div className="resumo-contrato">
          <p><strong>Evento:</strong> {contrato?.tema || "---"}</p>
          <p><strong>Data:</strong> {contrato?.dataEvento ? contrato.dataEvento.split('-').reverse().join('/') : "--/--/----"}</p>
          <p><strong>Total:</strong> R$ {Number(contrato?.valorTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>

        {/* --- CAMPO 1: CLIENTE --- */}
        <div className="canvas-wrapper">
          <label className="label-assinatura">✍️ ASSINATURA DO CLIENTE ({contrato?.cliente}):</label>
          
          {contrato?.assinaturaCliente ? (
             <div className="assinatura-trancada">
                 <div className="selo-ok">✅ ASSINADO E TRAVADO</div>
                 <img src={contrato.assinaturaCliente} alt="Assinatura Cliente" />
             </div>
          ) : (
            <>
              <div className="canvas-border">
                <SignatureCanvas
                  ref={sigCliente}
                  penColor="#0f172a"
                  canvasProps={{ className: "sigCanvas" }}
                  backgroundColor="transparent"
                />
              </div>
              <button className="btn-limpar" onClick={limparCliente}>Limpar / Refazer</button>
            </>
          )}
        </div>

        {/* --- CAMPO 2: ÁGAPE DECORAÇÕES --- */}
        <div className="canvas-wrapper agape-wrapper">
          <label className="label-assinatura ouro">✍️ ASSINATURA ÁGAPE DECORAÇÕES:</label>
          
          {contrato?.assinaturaAgape ? (
             <div className="assinatura-trancada ouro-border">
                 <div className="selo-ok">✅ ASSINADO E TRAVADO</div>
                 <img src={contrato.assinaturaAgape} alt="Assinatura Ágape" />
             </div>
          ) : (
            <>
              <div className="canvas-border ouro-border">
                <SignatureCanvas
                  ref={sigAgape}
                  penColor="#b48a3c"
                  canvasProps={{ className: "sigCanvas" }}
                  backgroundColor="transparent"
                />
              </div>
              <button className="btn-limpar" onClick={limparAgape}>Limpar / Refazer</button>
            </>
          )}
        </div>

        {/* --- BOTÃO FINAL --- */}
        {(!contrato?.assinaturaCliente || !contrato?.assinaturaAgape) ? (
            <button 
              className="btn-confirmar-assinatura" 
              onClick={salvarAssinaturas}
              disabled={status !== "pronto" && status !== "erro"}
              style={{ 
                backgroundColor: status === "sucesso" ? "#22c55e" : "#0f172a",
                opacity: status === "salvando" ? 0.7 : 1
              }}
            >
              {status === "pronto" && "SALVAR ASSINATURA"}
              {status === "salvando" && "⏳ SALVANDO..."}
              {status === "sucesso" && "✅ SUCESSO!"}
              {status === "erro" && "ERRO - TENTE NOVAMENTE"}
            </button>
        ) : (
            <div className="contrato-finalizado-alerta">
                🎉 Contrato 100% Finalizado e Assinado!
            </div>
        )}
      </div>
    </div>
  );
};

export default AssinaturaContrato;