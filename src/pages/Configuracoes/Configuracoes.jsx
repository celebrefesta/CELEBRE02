import React, { useState, useEffect } from 'react';
import './Configuracoes.css';

const Configuracoes = () => {
  // Estado para armazenar os dados
  const [empresa, setEmpresa] = useState({
    nome: 'CELEBRE DECORAÇÕES E EVENTOS',
    cnpj: '00.000.000/0001-00',
    telefone: '(11) 99999-9999',
    email: 'contato@celebre.com.br',
    endereco: 'Rua das Flores, 123 - Centro',
    cidade: 'São Paulo - SP',
    corSistema: '#0f233a', // Cor padrão (Azul Escuro)
    logo: null
  });

  // Carrega dados salvos ao abrir a tela
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('celebre_config');
    if (dadosSalvos) {
      setEmpresa(JSON.parse(dadosSalvos));
    }
  }, []);

  // Função para salvar
  const handleSalvar = (e) => {
    e.preventDefault();
    localStorage.setItem('celebre_config', JSON.stringify(empresa));
    
    // Aplica a cor nova no sistema inteiro (CSS Variable)
    document.documentElement.style.setProperty('--primary-color', empresa.corSistema);
    
    alert('Configurações salvas com sucesso!');
  };

  const handleChange = (e) => {
    setEmpresa({ ...empresa, [e.target.name]: e.target.value });
  };

  return (
    <div className="config-page">
      
      <div className="page-header-simple">
        <h1>Configurações do Sistema</h1>
        <p>Personalize os dados da sua empresa e a aparência do painel.</p>
      </div>

      <form className="config-container" onSubmit={handleSalvar}>
        
        {/* Coluna da Esquerda: Dados da Empresa */}
        <div className="config-column">
            
            <div className="config-card">
                <h3><i className="fas fa-building"></i> Dados da Empresa</h3>
                <p className="card-desc">Essas informações aparecerão no cabeçalho dos contratos e orçamentos.</p>
                
                <div className="input-group">
                    <label>Nome Fantasia / Razão Social</label>
                    <input type="text" name="nome" value={empresa.nome} onChange={handleChange} />
                </div>

                <div className="row-group">
                    <div className="input-group">
                        <label>CNPJ ou CPF</label>
                        <input type="text" name="cnpj" value={empresa.cnpj} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                        <label>Telefone / WhatsApp</label>
                        <input type="text" name="telefone" value={empresa.telefone} onChange={handleChange} />
                    </div>
                </div>

                <div className="input-group">
                    <label>E-mail de Contato</label>
                    <input type="email" name="email" value={empresa.email} onChange={handleChange} />
                </div>
            </div>

            <div className="config-card">
                <h3><i className="fas fa-map-marker-alt"></i> Endereço</h3>
                <div className="input-group">
                    <label>Logradouro (Rua, Av, Nº)</label>
                    <input type="text" name="endereco" value={empresa.endereco} onChange={handleChange} />
                </div>
                <div className="input-group">
                    <label>Cidade e Estado</label>
                    <input type="text" name="cidade" value={empresa.cidade} onChange={handleChange} />
                </div>
            </div>

        </div>

        {/* Coluna da Direita: Aparência e Sistema */}
        <div className="config-column">
            
            <div className="config-card">
                <h3><i className="fas fa-paint-brush"></i> Personalização Visual</h3>
                
                <div className="color-picker-section">
                    <label>Cor Principal do Sistema</label>
                    <div className="color-options">
                        {/* Opções de Cores Predefinidas */}
                        <div 
                            className={`color-circle ${empresa.corSistema === '#0f233a' ? 'selected' : ''}`} 
                            style={{background: '#0f233a'}}
                            onClick={() => setEmpresa({...empresa, corSistema: '#0f233a'})}
                            title="Azul Celebre (Padrão)"
                        ></div>
                        <div 
                            className={`color-circle ${empresa.corSistema === '#4c1d95' ? 'selected' : ''}`} 
                            style={{background: '#4c1d95'}}
                            onClick={() => setEmpresa({...empresa, corSistema: '#4c1d95'})}
                            title="Roxo Real"
                        ></div>
                        <div 
                            className={`color-circle ${empresa.corSistema === '#be123c' ? 'selected' : ''}`} 
                            style={{background: '#be123c'}}
                            onClick={() => setEmpresa({...empresa, corSistema: '#be123c'})}
                            title="Vinho Elegante"
                        ></div>
                         <div 
                            className={`color-circle ${empresa.corSistema === '#047857' ? 'selected' : ''}`} 
                            style={{background: '#047857'}}
                            onClick={() => setEmpresa({...empresa, corSistema: '#047857'})}
                            title="Verde Esmeralda"
                        ></div>
                         <div 
                            className={`color-circle ${empresa.corSistema === '#000000' ? 'selected' : ''}`} 
                            style={{background: '#000000'}}
                            onClick={() => setEmpresa({...empresa, corSistema: '#000000'})}
                            title="Preto Luxo"
                        ></div>
                    </div>
                    
                    {/* Input manual de cor */}
                    <div className="manual-color">
                        <span>Ou escolha:</span>
                        <input type="color" name="corSistema" value={empresa.corSistema} onChange={handleChange} />
                    </div>
                </div>

                <div className="logo-upload">
                    <label>Logo da Empresa</label>
                    <div className="upload-box">
                        <i className="fas fa-cloud-upload-alt"></i>
                        <p>Clique para enviar sua logo (PNG ou JPG)</p>
                    </div>
                </div>
            </div>

            <div className="config-card">
                <h3><i className="fas fa-file-contract"></i> Texto Padrão de Rodapé</h3>
                <div className="input-group">
                    <label>Mensagem final dos contratos</label>
                    <textarea rows="3" placeholder="Ex: Agradecemos a preferência!"></textarea>
                </div>
            </div>

            <button type="submit" className="btn-save-all">
                <i className="fas fa-save"></i> Salvar Alterações
            </button>

        </div>

      </form>

    </div>
  );
};

export default Configuracoes;