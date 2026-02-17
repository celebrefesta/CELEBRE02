import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Clientes.css'; // Importa o visual novo

const Clientes = () => {
  const [listaDeClientes, setListaDeClientes] = useState([]);

  // Busca os dados ao carregar a página
  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = () => {
    const dados = JSON.parse(localStorage.getItem('clientes')) || [];
    setListaDeClientes(dados);
  };

  // Função para Deletar Cliente
  const handleDelete = (id) => {
    if (window.confirm("Tem certeza que deseja excluir este cliente?")) {
      const novaLista = listaDeClientes.filter(cliente => cliente.id !== id);
      localStorage.setItem('clientes', JSON.stringify(novaLista));
      setListaDeClientes(novaLista); // Atualiza a tela na hora
    }
  };

  return (
    <div className="clientes-container">
      
      {/* Cabeçalho */}
      <div className="page-header">
        <h2 className="page-title">Meus Clientes</h2>
        <Link to="/cadastro-cliente" className="btn-novo">
          <span>+</span> Novo Cliente
        </Link>
      </div>

      {/* Tabela de Clientes */}
      <div className="table-card">
        {listaDeClientes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <p>Você ainda não possui clientes cadastrados.</p>
          </div>
        ) : (
          <table className="clientes-table">
            <thead>
              <tr>
                <th className="col-avatar">Foto</th>
                <th>Nome</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Cidade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {listaDeClientes.map((cliente) => (
                <tr key={cliente.id}>
                  {/* 1. Foto do Cliente */}
                  <td className="col-avatar">
                    {cliente.foto ? (
                      <img src={cliente.foto} alt={cliente.nome} className="avatar-img" />
                    ) : (
                      <div className="avatar-placeholder">
                        {cliente.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </td>

                  {/* 2. Dados */}
                  <td>
                    <strong>{cliente.nome}</strong>
                    {cliente.tipo === 'pj' && <span style={{fontSize:'0.7rem', color:'#c5a059', marginLeft:'5px'}}>(PJ)</span>}
                  </td>
                  <td>{cliente.telefone}</td>
                  <td>{cliente.email}</td>
                  <td>{cliente.cidade || '-'}</td>

                  {/* 3. Botões de Ação */}
                  <td className="actions-cell">
                    {/* Botão Visualizar (Exemplo) */}
                    <button className="action-btn btn-view" title="Ver Detalhes">
                      👁️
                    </button>
                    
                    {/* Botão Editar (Apenas visual por enquanto) */}
                    <button className="action-btn btn-edit" title="Editar">
                      ✏️
                    </button>

                    {/* Botão Excluir (Funcional) */}
                    <button 
                      className="action-btn btn-delete" 
                      title="Excluir"
                      onClick={() => handleDelete(cliente.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Clientes;