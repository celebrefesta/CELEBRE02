import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Fornecedores.css';

const Fornecedores = () => {
  const navigate = useNavigate();

  // Dados de Exemplo (Simulando o banco de dados)
  const [fornecedores] = useState([
    {
      id: 1,
      nome: 'Magazine 25 de Março',
      subtexto: 'CNPJ: 12.345.678/0001-90',
      contato: '(11) 98888-0000',
      email: 'vendas@mag25.com.br',
      categoria: 'Atacado Geral',
      catClass: 'badge-blue',
      stars: 4.5,
      link: 'Visitar',
      icone: 'fas fa-store',
      iconeBg: '#e0f2fe',
      iconeColor: '#0284c7'
    },
    {
      id: 2,
      nome: 'Ateliê da Juju',
      subtexto: 'CPF: 333.444.555-66',
      contato: '(19) 97777-1234',
      local: 'Campinas - SP',
      categoria: 'Artesanato/Bolo Fake',
      catClass: 'badge-purple',
      stars: 5,
      link: 'Instagram',
      linkIcon: 'fab fa-instagram',
      icone: 'fas fa-paint-brush',
      iconeBg: '#f3e8ff',
      iconeColor: '#7e22ce'
    },
    {
      id: 3,
      nome: 'Expresso Transportes',
      subtexto: 'Serviço Terceirizado',
      contato: '(19) 3333-4444',
      categoria: 'Logística',
      catClass: 'badge-orange',
      stars: 3,
      link: null,
      icone: 'fas fa-shipping-fast',
      iconeBg: '#fff7ed',
      iconeColor: '#c2410c'
    }
  ]);

  // Função para desenhar as estrelinhas
  const renderStars = (score) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= score) {
        stars.push(<i key={i} className="fas fa-star filled"></i>);
      } else if (i === Math.ceil(score) && !Number.isInteger(score)) {
        stars.push(<i key={i} className="fas fa-star-half-alt filled"></i>);
      } else {
        stars.push(<i key={i} className="far fa-star"></i>);
      }
    }
    return stars;
  };

  return (
    <div className="fornecedores-page">
      
      {/* Cabeçalho */}
      <header className="page-header">
        <div className="page-title">
          <h1>Meus Fornecedores</h1>
          <p>Parceiros de compras e serviços</p>
        </div>
        {/* AQUI ESTÁ A CORREÇÃO DO BOTÃO: */}
        <button className="btn btn-accent" onClick={() => navigate('/novo-fornecedor')}>
          <i className="fas fa-plus"></i> Novo Fornecedor
        </button>
      </header>

      {/* Filtros */}
      <div className="filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label>Buscar Fornecedor</label>
            <input type="text" className="form-control" placeholder="Nome, CNPJ ou Produto..." />
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <select className="form-control">
              <option>Todas</option>
              <option>Decoração/Acervo</option>
              <option>Descartáveis</option>
              <option>Bolos & Doces</option>
              <option>Transporte</option>
            </select>
          </div>
          <div className="form-group">
            <label>Avaliação</label>
            <select className="form-control">
              <option>Todas</option>
              <option>5 Estrelas</option>
              <option>Problemáticos</option>
            </select>
          </div>
          <div className="form-group">
            <button className="btn btn-primary full-width">
              <i className="fas fa-search"></i> Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th width="30%">Fornecedor</th>
              <th width="25%">Contato</th>
              <th width="15%">Categoria</th>
              <th width="10%">Avaliação</th>
              <th width="10%">Site/Link</th>
              <th width="10%" style={{textAlign: 'right'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {fornecedores.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="supplier-info">
                    <div className="supplier-icon" style={{backgroundColor: item.iconeBg, color: item.iconeColor}}>
                      <i className={item.icone}></i>
                    </div>
                    <div>
                      <div className="supplier-name">{item.nome}</div>
                      <div className="supplier-sub">{item.subtexto}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    <div><i className="fab fa-whatsapp"></i> {item.contato}</div>
                    {item.email && <div><i className="far fa-envelope"></i> {item.email}</div>}
                    {item.local && <div><i className="fas fa-map-marker-alt"></i> {item.local}</div>}
                  </div>
                </td>
                <td><span className={`badge ${item.catClass}`}>{item.categoria}</span></td>
                <td>
                  <div className="stars">
                    {renderStars(item.stars)}
                  </div>
                </td>
                <td>
                  {item.link ? (
                    <a href="#" className="link-btn">
                      <i className={item.linkIcon || "fas fa-external-link-alt"}></i> {item.link}
                    </a>
                  ) : (
                    <span className="no-link">-</span>
                  )}
                </td>
                <td style={{textAlign: 'right'}}>
                  <button className="action-btn"><i className="fas fa-pen"></i></button>
                  <button className="action-btn"><i className="fas fa-history"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginação */}
        <div className="pagination">
            <button className="btn btn-outline small">Anterior</button>
            <button className="btn btn-primary small">1</button>
            <button className="btn btn-outline small">Próxima</button>
        </div>
      </div>

    </div>
  );
};

export default Fornecedores;