import './Auth.css'; 
import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore'; 
import { auth, db } from '../../firebaseConfig'; 

const Cadastro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planoEscolhido = searchParams.get('plano');

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
      return setErro('As palavras-passe não coincidem.');
    }
    if (senha.length < 6) {
      return setErro('A palavra-passe deve ter pelo menos 6 caracteres.');
    }

    try {
      setLoading(true);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      await updateProfile(user, { displayName: nome });

      // 🔥 LÓGICA VIP: CALCULA OS 7 DIAS DE TESTE
      const dataAtual = new Date();
      const dataFimTeste = new Date(dataAtual);
      dataFimTeste.setDate(dataFimTeste.getDate() + 7);

      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        nomeCompleto: nome,
        email: email,
        dataCadastro: dataAtual.toISOString(),
        dataFimTeste: dataFimTeste.toISOString(), // 👈 Carimbo VIP de 7 dias!
        role: 'owner',
        planoId: planoEscolhido || 'plano_basico' // Guarda a intenção de plano dela
      });

      // DISPARO DO E-MAIL
      await addDoc(collection(db, 'mail'), {
        to: email,
        message: {
          subject: '🎉 Bem-vinda ao Celebre! O seu teste de 7 dias começou.',
          html: `
            <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #16a34a; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Celebre</h1>
              </div>
              <div style="padding: 30px;">
                <h2 style="color: #0f172a;">Olá, ${nome}!</h2>
                <p>Que alegria tê-la connosco! A sua conta no <strong>Celebre</strong> foi criada com sucesso.</p>
                <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-weight: bold; color: #166534;">⏳ VIP: Acesso Total Liberado</p>
                  <p style="margin: 5px 0 0 0; font-size: 14px; color: #166534;">Você tem <strong>7 dias de acesso Premium</strong> para explorar absolutamente todas as ferramentas do Celebre.</p>
                </div>
                <p>Sucesso nos seus eventos!<br><strong>Equipa Celebre</strong></p>
              </div>
            </div>
          `
        }
      });

      navigate('/dashboard'); 
      
    } catch (error) {
      console.error("Erro no cadastro:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErro('Esse e-mail já está registado. Faça login!');
      } else {
        setErro('Erro ao criar conta. Verifique os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <main className="auth-main">
        <div className="auth-box">
          <div className="logo-placeholder">
            <div className="logo-circle"></div> Celebre
          </div>
          <h2>Crie a sua conta ✨</h2>
          <p>Rápido e fácil. 7 dias grátis com acesso TOTAL.</p>
          
          {erro && <div className="auth-erro">{erro}</div>}
          
          <form onSubmit={handleCadastro}>
            <div className="input-group">
              <label>NOME COMPLETO</label>
              <input type="text" placeholder="Ex: Maria da Silva" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>E-MAIL</label>
              <input type="email" placeholder="nome@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="input-row">
              <div className="input-group">
                <label>PALAVRA-PASSE</label>
                <input type="password" placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>REPETIR PALAVRA-PASSE</label>
                <input type="password" placeholder="••••••••" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-auth">
              {loading ? 'A criar conta...' : 'Começar meu Teste Grátis'}
            </button>
          </form>
          
          <p className="auth-link" style={{ marginTop: '20px' }}>
            Já tem uma conta? <Link to="/login">Fazer login</Link>
          </p>
        </div>
      </main>
      
      <aside className="auth-side-panel">
        <div className="side-content">
          <h1>Tudo liberado <br/> por 7 dias.</h1>
          <p>Experimente o potencial máximo do Celebre e descubra por que os maiores profissionais do mercado já não vivem sem ele.</p>
        </div>
      </aside>
    </div>
  );
};

export default Cadastro;