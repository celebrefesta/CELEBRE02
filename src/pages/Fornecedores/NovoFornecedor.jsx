import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './NovoFornecedor.css';

const NovoFornecedor = () => {
  const navigate = useNavigate();
  const [logoPreview, setLogoPreview] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvar = (e) => {
    e.preventDefault();
    alert("Fornecedor cadastrado com sucesso!");
    navigate('/fornecedores');
  };

  return (
    <div className="novo-fornecedor-page">
      
      {/* Cabeçalho Simples */}
      <header className="page-header-simple">
        <div className="brand"><i className="fas fa-crown"></i> CELEBRE</div>
        <button className="back-link" onClick={() => navigate('/fornecedores')}>
            <i className="fas fa-arrow-left"></i> Voltar
        </button>
      </header>

      <div className="main-container">
        <form className="form-card" onSubmit={handleSalvar}>
            
            {/* Banner e Logo */}
            <div className="card-header-visual">
                <div className="logo-wrapper">
                    <input type="file" id="logo-input" hidden accept="image/*" onChange={handleImageChange} />
                    
                    <div className="logo-circle" onClick={() => document.getElementById('logo-input').click()} title="Adicionar Logo">
                        {logoPreview ? (
                            <img src={logoPreview} className="logo-preview" alt="Preview" />
                        ) : (
                            <div className="upload-icon">
                                <i className="fas fa-store fa-2x"></i>
                            </div>
                        )}
                    </div>
                    
                    <div className="camera-badge" onClick={() => document.getElementById('logo-input').click()}>
                        <i className="fas fa-camera"></i>
                    </div>
                </div>
            </div>

            <div className="card-body">
                
                <div className="section-heading">
                    <h1>Cadastrar Fornecedor</h1>
                    <p>Preencha os dados do seu parceiro comercial</p>
                </div>

                {/* Categorias Visuais */}
                <div className="category-grid">
                    <label className="cat-card">
                        <input type="radio" name="tipo" defaultChecked />
                        <i className="fas fa-boxes"></i>
                        <h3>Estoque / Consumo</h3>
                    </label>
                    <label className="cat-card">
                        <input type="radio" name="tipo" />
                        <i className="fas fa-couch"></i>
                        <h3>Acervo / Peças</h3>
                    </label>
                    <label className="cat-card">
                        <input type="radio" name="tipo" />
                        <i className="fas fa-shipping-fast"></i>
                        <h3>Serviço / Frete</h3>
                    </label>
                </div>

                {/* Formulário */}
                <div className="form-grid">
                    <div className="floating-label full">
                        <input type="text" placeholder=" " required />
                        <label>Nome do Fornecedor *</label>
                    </div>
                    <div className="floating-label">
                        <input type="text" placeholder=" " />
                        <label>CNPJ / CPF</label>
                    </div>
                    <div className="floating-label">
                        <input type="text" placeholder=" " />
                        <label>Prazo de Entrega</label>
                    </div>
                    <div className="floating-label">
                        <input type="tel" placeholder=" " />
                        <label>WhatsApp</label>
                    </div>
                    <div className="floating-label">
                        <input type="text" placeholder=" " />
                        <label>Site / Instagram</label>
                    </div>
                    <div className="floating-label full">
                        <input type="text" placeholder=" " style={{borderColor: '#c5a059'}} />
                        <label style={{color: '#0f233a'}}>Chave PIX (Principal)</label>
                    </div>
                    <div className="floating-label full">
                        <input type="text" placeholder=" " />
                        <label>Endereço Completo</label>
                    </div>
                    <div className="floating-label full">
                        <textarea rows="3" placeholder=" "></textarea>
                        <label>Observações</label>
                    </div>
                </div>

                {/* Botões de Ação - AQUI ESTAVA O PROBLEMA ANTES */}
                <div className="actions">
                    <button type="button" className="btn-outline" onClick={() => navigate('/fornecedores')}>Cancelar</button>
                    <button type="submit" className="btn-primary">
                        <i className="fas fa-check"></i> Salvar Cadastro
                    </button>
                </div>
                {/* Se tinha algum código perdido aqui embaixo, ele foi removido agora! */}

            </div>
        </form>
      </div>
    </div>
  );
};

export default NovoFornecedor;