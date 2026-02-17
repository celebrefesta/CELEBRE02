import React, { useState } from 'react';
import './Perfil.css';

const Perfil = () => {
  const [dados, setDados] = useState({
    nome: 'Camila',
    sobrenome: 'Administradora',
    email: 'camila@agape.decoracoes.com',
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: ''
  });

  const handleSalvar = (e) => {
    e.preventDefault();
    alert("Dados do perfil atualizados com sucesso!");
  };

  return (
    <div className="perfil-page">
      <div className="perfil-header">
        <h1>Meu Perfil</h1>
        <p>Gerencie suas informações de acesso e segurança.</p>
      </div>

      <div className="perfil-container">
        {/* Lado Esquerdo: Foto e Status */}
        <div className="perfil-sidebar">
          <div className="avatar-large">C</div>
          <h3>{dados.nome}</h3>
          <span className="badge-admin">Administrador Master</span>
          <hr />
          <button className="btn-change-photo">Alterar Foto</button>
        </div>

        {/* Lado Direito: Formulários */}
        <form className="perfil-form" onSubmit={handleSalvar}>
          <section className="form-section">
            <h3><i className="fas fa-id-card"></i> Informações Pessoais</h3>
            <div className="input-row">
              <div className="input-group">
                <label>Nome</label>
                <input type="text" value={dados.nome} onChange={(e) => setDados({...dados, nome: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Sobrenome</label>
                <input type="text" value={dados.sobrenome} onChange={(e) => setDados({...dados, sobrenome: e.target.value})} />
              </div>
            </div>
            <div className="input-group">
              <label>E-mail</label>
              <input type="email" value={dados.email} onChange={(e) => setDados({...dados, email: e.target.value})} />
            </div>
          </section>

          <section className="form-section">
            <h3><i className="fas fa-lock"></i> Segurança e Senha</h3>
            <div className="input-group">
              <label>Senha Atual</label>
              <input type="password" placeholder="********" />
            </div>
            <div className="input-row">
              <div className="input-group">
                <label>Nova Senha</label>
                <input type="password" />
              </div>
              <div className="input-group">
                <label>Confirmar Nova Senha</label>
                <input type="password" />
              </div>
            </div>
          </section>

          <button type="submit" className="btn-save-perfil">Salvar Alterações</button>
        </form>
      </div>
    </div>
  );
};

export default Perfil;