import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom'; // 🔥 IMPORTAÇÃO CORRIGIDA AQUI
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; 
import './Auth.css'; 

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
  
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  // 🔥 VALIDADOR DE SENHA FORTE EM TEMPO REAL
  const validarSenha = (s) => {
    return {
      tamanho: s.length >= 8,
      maiuscula: /[A-Z]/.test(s),
      minuscula: /[a-z]/.test(s),
      numero: /[0-9]/.test(s),
      especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(s)
    };
  };

  const criterios = validarSenha(senha);
  const isSenhaForte = Object.values(criterios).every(Boolean);

  const handleNomeChange = (e) => {
    const valor = e.target.value;
    const formatado = valor
      .split(' ')
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
      .join(' ');
    setNome(formatado);
  };

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

    if (!isSenhaForte) {
      return setErro('Sua senha não cumpre todos os requisitos de segurança.');
    }
    if (senha !== confirmarSenha) {
      return setErro('As senhas não coincidem.');
    }

    const docLimpo = documento.replace(/\D/g, "");
    if (!docLimpo) {
      return setErro('Por favor, preencha o seu CPF ou CNPJ.');
    }

    try {
      setLoading(true);

      // 🔥 PREVENIR DUPLICIDADE DE CONTA PELO DOCUMENTO (CPF/CNPJ)
      const docRefCheck = doc(db, 'registros_documentos', docLimpo);
      const docSnapCheck = await getDoc(docRefCheck);
      if (docSnapCheck.exists()) {
        setLoading(false);
        return setErro('Este CPF/CNPJ já possui uma conta cadastrada no Celebre.');
      }

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

      // 🔥 SALVA REGISTRO DE CPF/CNPJ PARA PREVENIR FUTURAS DUPLICATAS
      await setDoc(doc(db, 'registros_documentos', docLimpo), {
        ownerUid: user.uid,
        criadoEm: serverTimestamp()
      });

      // 🔥 E-MAIL DE BOAS-VINDAS PREMIUM
      await addDoc(collection(db, 'mail'), {
        to: email,
        message: {
          subject: '🎉 Bem-vindo(a) ao Celebre! Seu teste de 7 dias começou.',
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 auto;">
              <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                <h1 style="color: #c5a059; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Celebre</h1>
                <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">O seu acervo organizado</p>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Olá, ${nomeExibicao || nome}! 🎉</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #475569;">Seja muito bem-vindo(a) ao Celebre. O seu teste gratuito de <strong>7 dias</strong> com acesso TOTAL ao sistema começou!</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #c5a059; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                  <p style="margin: 0 0 10px 0; font-weight: bold; color: #0f172a; font-size: 16px;">🔑 Seus dados de acesso:</p>
                  <p style="margin: 0; font-size: 15px; color: #475569;"><strong>E-mail:</strong> ${email}</p>
                  <p style="margin: 5px 0 0 0; font-size: 15px; color: #475569;"><strong>Plano de Teste:</strong> 7 Dias VIP</p>
                </div>

                <p style="font-size: 16px; line-height: 1.6; color: #475569;">Com o Celebre você poderá cadastrar seus itens, gerenciar orçamentos, emitir contratos digitais e acompanhar seu faturamento de forma simples e intuitiva.</p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://celebreapp.com/login" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(15,23,42,0.15);">Acessar Meu Painel</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                
                <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">Se tiver alguma dúvida durante o seu teste, basta nos chamar clicando no botão de Suporte diretamente do seu painel corporativo.</p>
                <p style="margin-top: 25px; font-size: 15px; color: #475569;">Com carinho,<br><strong>Equipe Celebre</strong></p>
              </div>
            </div>
          `
        }
      });

      navigate('/dashboard'); 
      
    } catch (error) {
      console.error("Erro detalhado no cadastro:", error);
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
      <main className="auth-main">
        <div className="auth-box">
          
          <div className="auth-logo-wrapper">
            <img src={logoImage} alt="Logotipo Celebre" className="auth-logo-img" />
            <span className="auth-logo-text">Celebre</span>
          </div>
          
          <h2>Crie sua conta ✨</h2>
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
              <input type="text" value={nome} onChange={handleNomeChange} required />
            </div>

            <div className="input-group">
              <label>
                COMO GOSTARIA DE SER CHAMADO? <span className="label-sub">(NOME DA EMPRESA OU APELIDO)</span>
              </label>
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
            
            <div className="input-row">
              <div className="input-group">
                <label>SENHA</label>
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
                <label>REPETIR SENHA</label>
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

            {/* 🔥 INDICADORES DE SEGURANÇA DA SENHA 🔥 */}
            <div className="senha-criterios">
              <span className="crit-titulo-obrigatorio">Todos os requisitos de senha são obrigatórios:</span>
              <ul>
                <li className={criterios.tamanho ? "crit-ok" : "crit-falha"}>
                  <i className={`fas ${criterios.tamanho ? "fa-check" : "fa-times"}`}></i> 8+ Caracteres
                </li>
                <li className={criterios.maiuscula ? "crit-ok" : "crit-falha"}>
                  <i className={`fas ${criterios.maiuscula ? "fa-check" : "fa-times"}`}></i> Maiúscula
                </li>
                <li className={criterios.minuscula ? "crit-ok" : "crit-falha"}>
                  <i className={`fas ${criterios.minuscula ? "fa-check" : "fa-times"}`}></i> Minúscula
                </li>
                <li className={criterios.numero ? "crit-ok" : "crit-falha"}>
                  <i className={`fas ${criterios.numero ? "fa-check" : "fa-times"}`}></i> Número
                </li>
                <li className={criterios.especial ? "crit-ok" : "crit-falha"}>
                  <i className={`fas ${criterios.especial ? "fa-check" : "fa-times"}`}></i> Especial (!@#)
                </li>
              </ul>
            </div>
            
            <button type="submit" disabled={loading || !isSenhaForte} className="btn-auth">
              {loading ? 'Criando conta...' : 'Começar meu Teste Grátis'}
            </button>

            <p className="auth-terms-note" style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', margin: '14px 0 0', lineHeight: '1.4' }}>
              Ao criar sua conta, você concorda com nossos{' '}
              <Link to="/termos" target="_blank" style={{ color: 'var(--dourado)', fontWeight: '600' }}>Termos de Uso</Link> e{' '}
              <Link to="/privacidade" target="_blank" style={{ color: 'var(--dourado)', fontWeight: '600' }}>Política de Privacidade</Link>.
            </p>
          </form>
          
          <p className="auth-link">
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