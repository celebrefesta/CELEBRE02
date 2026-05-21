import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; 
import './Auth.css'; 

// 🔥 Importação da sua Logo Oficial
import logoImage from '../../assets/LOGO_CELEBRE.png';

const Cadastro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planoEscolhido = searchParams.get('plano');

  const [tipoPessoa, setTipoPessoa] = useState('fisica');
  const [nome, setNome] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState(''); 
  const [documento, setDocumento] = useState(''); 
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  // 🔥 Estados para o "Olhinho" da senha
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDocumentoChange = (e) => {
    let valor = e.target.value.replace(/\D/g, ""); 
    if (tipoPessoa === 'fisica') {
      if (valor.length <= 11) {
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      }
    } else {
      if (valor.length <= 14) {
        valor = valor.replace(/^(\d{2})(\d)/, "$1.$2");
        valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        valor = valor.replace(/\.(\d{3})(\d)/, ".$1/$2");
        valor = valor.replace(/(\d{4})(\d)/, "$1-$2");
      }
    }
    setDocumento(valor);
  };

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

      await updateProfile(user, { displayName: nomeExibicao || nome });

      localStorage.setItem('tenantId', user.uid);
      localStorage.setItem('funcName', nomeExibicao || nome);

      const dataAtual = new Date();
      const dataFimTeste = new Date(dataAtual);
      dataFimTeste.setDate(dataFimTeste.getDate() + 7);

      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        nomeCompleto: nome,
        nomeExibicao: nomeExibicao,
        tipoPessoa: tipoPessoa,
        documento: documento,
        email: email,
        dataCadastro: dataAtual.toISOString(),
        dataFimTeste: dataFimTeste.toISOString(), 
        role: 'owner',
        planoId: planoEscolhido || 'plano_basico' 
      });

      await setDoc(doc(db, "configuracoes_empresa", user.uid), {
        nomeEmpresa: nomeExibicao || nome,
        documentoEmpresa: documento,
        emailContato: email,
        criadoEm: serverTimestamp()
      });

      await addDoc(collection(db, 'mail'), {
        to: email,
        message: {
          subject: '🎉 Bem-vinda ao Celebre! O seu teste de 7 dias começou.',
          html: `<p>Olá, ${nomeExibicao || nome}! Você tem 7 dias VIP no Celebre.</p>`
        }
      });

      navigate('/dashboard'); 
      
    } catch (error) {
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
      {/* LADO ESQUERDO CENTRALIZADO */}
      <main className="auth-main">
        <div className="auth-box">
          
          {/* 🔥 LOGO OFICIAL APLICADA AQUI */}
          <div className="auth-logo-wrapper">
            <img src={logoImage} alt="Logotipo Celebre" className="auth-logo-img" />
            <span className="auth-logo-text">Celebre</span>
          </div>
          
          <h2>Crie a sua conta ✨</h2>
          <p>Rápido e fácil. 7 dias grátis com acesso TOTAL.</p>
          
          {erro && <div className="auth-erro">{erro}</div>}
          
          <form onSubmit={handleCadastro} className="auth-form-elements">
            
            <div className="tipo-pessoa-wrapper">
              <label className={`tipo-pessoa-btn ${tipoPessoa === 'fisica' ? 'ativo' : ''}`}>
                <input 
                  type="radio" name="tipoPessoa" value="fisica" checked={tipoPessoa === 'fisica'} 
                  onChange={() => { setTipoPessoa('fisica'); setDocumento(''); }} 
                />
                👤 Pessoa Física
              </label>
              
              <label className={`tipo-pessoa-btn ${tipoPessoa === 'juridica' ? 'ativo' : ''}`}>
                <input 
                  type="radio" name="tipoPessoa" value="juridica" checked={tipoPessoa === 'juridica'} 
                  onChange={() => { setTipoPessoa('juridica'); setDocumento(''); }} 
                />
                🏢 Empresa / MEI
              </label>
            </div>

            <div className="input-group">
              <label>NOME COMPLETO</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>

            <div className="input-group">
              <label>COMO GOSTARIA DE SER CHAMADO? (Nome da Empresa ou Apelido)</label>
              <input type="text" value={nomeExibicao} onChange={(e) => setNomeExibicao(e.target.value)} required />
            </div>

            <div className="input-group">
              <label>{tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'}</label>
              <input type="text" placeholder={tipoPessoa === 'fisica' ? "000.000.000-00" : "00.000.000/0001-00"} value={documento} onChange={handleDocumentoChange} required />
            </div>

            <div className="input-group">
              <label>E-MAIL</label>
              <input type="email" placeholder="nome@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            
            {/* 🔥 SENHAS ALINHADAS COM O "OLHINHO" */}
            <div className="input-row">
              <div className="input-group">
                <label>PALAVRA-PASSE</label>
                <div className="input-with-icon">
                    <input 
                        type={mostrarSenha ? "text" : "password"} 
                        placeholder="••••••••" 
                        value={senha} 
                        onChange={(e) => setSenha(e.target.value)} 
                        required 
                    />
                    <button type="button" className="btn-olhinho" onClick={() => setMostrarSenha(!mostrarSenha)}>
                        <i className={`fas ${mostrarSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                </div>
              </div>
              <div className="input-group">
                <label>REPETIR PALAVRA-PASSE</label>
                <div className="input-with-icon">
                    <input 
                        type={mostrarConfirmarSenha ? "text" : "password"} 
                        placeholder="••••••••" 
                        value={confirmarSenha} 
                        onChange={(e) => setConfirmarSenha(e.target.value)} 
                        required 
                    />
                    <button type="button" className="btn-olhinho" onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}>
                        <i className={`fas ${mostrarConfirmarSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                </div>
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="btn-auth">
              {loading ? 'A criar conta...' : 'Começar meu Teste Grátis'}
            </button>
          </form>
          
          <p className="auth-link">
            Já tem uma conta? <Link to="/login">Fazer login</Link>
          </p>
        </div>
      </main>
      
      {/* LADO DIREITO (BANNER AZUL NAVAL) */}
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