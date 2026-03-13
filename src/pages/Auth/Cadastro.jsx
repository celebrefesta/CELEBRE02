import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../firebaseConfig'; 
import './Auth.css'; 

const Cadastro = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCadastro = async (e) => {
    e.preventDefault();
    setErro('');

    if (senha !== confirmaSenha) {
      return setErro('As senhas não são iguais!');
    }

    if (senha.length < 6) {
      return setErro('A senha deve ter pelo menos 6 caracteres.');
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      
      await updateProfile(userCredential.user, {
        displayName: nome
      });

      navigate('/'); 
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setErro('Esse e-mail já está cadastrado.');
      } else if (error.code === 'auth/invalid-email') {
        setErro('E-mail inválido.');
      } else {
        setErro('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h1>Crie sua conta ✨</h1>
          <p>Rápido e fácil. Comece a gerenciar seu acervo.</p>
        </div>

        {erro && <div className="auth-error">{erro}</div>}

        <form onSubmit={handleCadastro} className="auth-form">
          <div className="auth-input-group">
            <label>Nome Completo</label>
            <input 
              type="text" 
              placeholder="Ex: Maria Silva" 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              required 
            />
          </div>

          <div className="auth-input-group">
            <label>E-mail</label>
            <input 
              type="email" 
              placeholder="seu@email.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div style={{display: 'flex', gap: '15px'}}>
            <div className="auth-input-group" style={{flex: 1}}>
              <label>Senha</label>
              <input 
                type="password" 
                placeholder="Mínimo 6 chars" 
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                required 
              />
            </div>

            <div className="auth-input-group" style={{flex: 1}}>
              <label>Repetir Senha</label>
              <input 
                type="password" 
                placeholder="Confirme" 
                value={confirmaSenha} 
                onChange={(e) => setConfirmaSenha(e.target.value)} 
                required 
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Criando conta...' : 'Cadastrar e Entrar'}
          </button>
        </form>

        <div className="auth-footer">
          Já tem uma conta? <Link to="/login" className="auth-link">Fazer login</Link>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;