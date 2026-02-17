import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NovoItem = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome: '',
    quantidade: '',
    preco: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 1. Busca o estoque atual
    const estoqueAtual = JSON.parse(localStorage.getItem('estoque')) || [];
    
    // 2. Adiciona o novo item
    const novoItem = { ...formData, id: Date.now() };
    const estoqueAtualizado = [...estoqueAtual, novoItem];
    
    // 3. Salva
    localStorage.setItem('estoque', JSON.stringify(estoqueAtualizado));
    
    alert('Item adicionado com sucesso!');
    navigate('/estoque');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Novo Item do Acervo</h2>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>Nome da Peça:</label>
          <input type="text" name="nome" onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Quantidade:</label>
          <input type="number" name="quantidade" onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Valor de Reposição (R$):</label>
          <input type="number" name="preco" onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ background: '#c5a059', color: 'white', border: 'none', padding: '10px 20px', cursor: 'pointer' }}>
          SALVAR ITEM
        </button>
      </form>
    </div>
  );
};

export default NovoItem;