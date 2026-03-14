import './Auth.css'; 
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; 
import { auth, db } from '../../firebaseConfig'; 

const Cadastro = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCadastro = async (e) => {
    e.preventDefault();
    setErro('');

    if (senha !== confirmarSenha) {
      return setErro('As senhas não coincidem.');
    }
    if (senha.length < 6) {
      return setErro('A senha deve ter pelo menos 6 caracteres.');
    }

    try {
      setLoading(true);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // Salva o nome no Auth do Firebase
      await updateProfile(user, {
        displayName: nome
      });

      // Cria a ficha do usuário no Firestore (Banco de Dados)
      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        nomeCompleto: nome,
        email: email,
        dataCadastro: new Date().toISOString(),
        perfil: 'admin' 
      });

      navigate('/dashboard'); // 🔥 AGORA VAI PRO LUGAR CERTO!
      
    } catch (error) {
      console.error("Erro detalhado do Firebase:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErro('Esse e-mail já está cadastrado. Faça login!');
      } else {
        setErro('Erro ao criar conta. Verifique os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      
      {/* ⬅️ Lado Esquerdo: Formulário Moderno */}
      <main className="auth-main">
        <div className="auth-box">
          
          {/* Logo Estilizada */}
          <div className="logo-placeholder">
            <div className="logo-circle"></div> Celebre
          </div>

          <h2>Crie sua conta ✨</h2>
          <p>Rápido e fácil. Comece a gerenciar seu acervo.</p>

          {erro && <div className="auth-erro">{erro}</div>}

          <form onSubmit={handleCadastro}>
            <div className="input-group">
              <label>NOME COMPLETO</label>
              <input 
                type="text" 
                placeholder="Ex: Maria da Silva"
                value={nome} 
                onChange={(e) => setNome(e.target.value)} 
                required 
              />
            </div>

            <div className="input-group">
              <label>E-MAIL</label>
              <input 
                type="email" 
                placeholder="nome@exemplo.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>SENHA</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={senha} 
                  onChange={(e) => setSenha(e.target.value)} 
                  required 
                />
              </div>
              <div className="input-group">
                <label>REPETIR SENHA</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={confirmarSenha} 
                  onChange={(e) => setConfirmarSenha(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-auth">
              {loading ? 'Criando conta...' : 'Cadastrar e Entrar'}
            </button>
          </form>

          <p className="auth-link" style={{ marginTop: '20px' }}>
            Já tem uma conta? <Link to="/login">Fazer login</Link>
          </p>
        </div>
      </main>

      {/* ➡️ Lado Direito: O "Detalhe" Elegante (SaaS Premium) */}
      <aside className="auth-side-panel">
        <div className="side-content">
          <h1>O primeiro passo <br/> para escalar <br/> seu negócio.</h1>
          <p>Junte-se a profissionais que já transformaram a gestão de seus eventos e locações com o Celebre.</p>
        </div>
      </aside>

    </div>
  );
};

export default Cadastro;