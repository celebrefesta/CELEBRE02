import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Assinatura.css';

const Assinatura = () => {
  const navigate = useNavigate();
  const [assinado, setAssinado] = useState(false);
  const [nomeAssinatura, setNomeAssinatura] = useState('');

  const handleAssinar = (e) => {
    e.preventDefault();
    if (!nomeAssinatura) return;
    
    setAssinado(true);
    // Aqui numa aplicação real, enviaria os dados para o servidor
    setTimeout(() => {
        alert("Sucesso! Documento assinado digitalmente.");
        // Em um caso real, o cliente fecharia a tela, mas aqui vamos voltar pro painel pra você ver
        navigate('/contratos');
    }, 1500);
  };

  return (
    <div className="assinatura-page">
      
      <div className="doc-container">
        
        {/* Cabeçalho do Documento */}
        <header className="doc-header">
            <div className="brand-logo"><i className="fas fa-crown"></i> CELEBRE</div>
            <div className="doc-meta">
                <span>Contrato #105</span>
                <span className="badge-pending">Pendente de Assinatura</span>
            </div>
        </header>

        {/* Corpo do Contrato */}
        <div className="doc-content">
            <h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DECORAÇÃO</h2>
            
            <p><strong>CONTRATADA:</strong> CELEBRE DECORAÇÕES E EVENTOS...</p>
            <p><strong>CONTRATANTE:</strong> ANA JÚLIA (CPF: 000.000.000-00)...</p>
            
            <hr />

            <h3>1. DO OBJETO</h3>
            <p>O presente contrato tem como objeto a locação de peças decorativas e montagem para o evento "15 Anos - Neon Party", a ser realizado no dia 14/02/2026.</p>

            <h3>2. DO VALOR</h3>
            <p>Pela prestação dos serviços, o CONTRATANTE pagará à CONTRATADA o valor total de <strong>R$ 2.500,00</strong>.</p>

            <h3>3. DAS OBRIGAÇÕES</h3>
            <p>A CONTRATADA compromete-se a entregar os itens em perfeito estado. O CONTRATANTE responsabiliza-se por qualquer dano causado às peças durante o evento.</p>

            <div className="fake-clauses">
                <p>...</p>
                <p>(Restante do texto jurídico do contrato)</p>
                <p>...</p>
            </div>
        </div>

        {/* Área de Assinatura */}
        <div className="sign-area">
            {!assinado ? (
                <form onSubmit={handleAssinar} className="sign-form">
                    <h3><i className="fas fa-pen-nib"></i> Assinatura Digital</h3>
                    <p>Para concordar com os termos acima, digite seu nome completo abaixo:</p>
                    
                    <input 
                        type="text" 
                        placeholder="Digite seu nome completo aqui..." 
                        value={nomeAssinatura}
                        onChange={(e) => setNomeAssinatura(e.target.value)}
                        required
                        className="sign-input"
                    />

                    <div className="legal-check">
                        <input type="checkbox" required id="li-concordo" />
                        <label htmlFor="li-concordo">Declaro que li e concordo com os termos descritos neste documento.</label>
                    </div>

                    <button type="submit" className="btn-sign">
                        CONFIRMAR ASSINATURA
                    </button>
                </form>
            ) : (
                <div className="success-message">
                    <div className="check-icon"><i className="fas fa-check-circle"></i></div>
                    <h3>Documento Assinado!</h3>
                    <p>Cópia enviada para seu e-mail.</p>
                    <div className="signature-token">
                        Hash: 8a7s9d8a7s9d87as9d8a7s9d8
                        <br/>
                        Assinado por: {nomeAssinatura}
                        <br/>
                        Data: {new Date().toLocaleDateString()}
                    </div>
                </div>
            )}
        </div>

      </div>
      
      <footer className="doc-footer">
        <p>Documento gerado pela plataforma CELEBRE Gestão.</p>
      </footer>

    </div>
  );
};

export default Assinatura;