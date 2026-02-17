import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Clientes.css'; // Vamos usar o mesmo estilo da lista

const HistoricoCliente = () => {
  const { id } = useParams(); // Pega o ID que veio na URL
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);

  useEffect(() => {
    // Busca os dados desse cliente específico
    const clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    const clienteEncontrado = clientes.find(c => c.id.toString() === id);
    setCliente(clienteEncontrado);
  }, [id]);

  if (!cliente) return <div style={{padding: '30px'}}>Carregando...</div>;

  return (
    <div className="clientes-container">
      {/* Cabeçalho com botão Voltar */}
      <div className="page-header">
        <div className="page-title">
          <h2>Histórico Financeiro</h2>
          <p>Cliente: <strong>{cliente.nome}</strong></p>
        </div>
        <button 
          onClick={() => navigate('/clientes')} 
          className="btn-novo" 
          style={{background:'#64748b', cursor:'pointer'}}
        >
          ⬅ Voltar
        </button>
      </div>

      {/* Cartões de Resumo */}
      <div className="table-card" style={{padding: '30px'}}>
        <div style={{display: 'flex', gap: '20px', marginBottom: '30px', flexWrap:'wrap'}}>
            
            <div style={{flex: 1, background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0'}}>
                <h4 style={{color:'#64748b', marginBottom:'5px'}}>Total Gasto</h4>
                <h2 style={{color:'#0f233a', fontSize:'1.8rem'}}>R$ 0,00</h2>
            </div>
            
            <div style={{flex: 1, background: '#f0fdf4', padding: '20px', borderRadius: '10px', border: '1px solid #bbf7d0'}}>
                <h4 style={{color:'#166534', marginBottom:'5px'}}>Em Dia</h4>
                <h2 style={{color:'#15803d', fontSize:'1.8rem'}}>0 Contratos</h2>
            </div>
            
            <div style={{flex: 1, background: '#fef2f2', padding: '20px', borderRadius: '10px', border: '1px solid #fecaca'}}>
                <h4 style={{color:'#991b1b', marginBottom:'5px'}}>Pendências</h4>
                <h2 style={{color:'#dc2626', fontSize:'1.8rem'}}>R$ 0,00</h2>
            </div>

        </div>

        <div style={{textAlign: 'center', padding: '40px', color: '#94a3b8', borderTop: '1px solid #f1f5f9'}}>
          <p style={{fontSize: '1.1rem'}}>📂 Nenhuma locação registrada.</p>
          <p style={{fontSize: '0.9rem'}}>As locações aparecerão aqui automaticamente quando você criar um contrato para este cliente.</p>
        </div>
      </div>
    </div>
  );
};

export default HistoricoCliente;