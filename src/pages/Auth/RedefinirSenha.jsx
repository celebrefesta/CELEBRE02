import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { 
  getAuth, 
  verifyPasswordResetCode, 
  confirmPasswordReset,
  sendPasswordResetEmail
} from 'firebase/auth';
import { anonimizarEmail } from '../../utils/mascaras';
import './Auth.css';
import logoImage from '../../assets/LOGO_CELEBRE.png';

const RedefinirSenha = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const auth = getAuth();

  const oobCode = searchParams.get('oobCode');

  // Modo Solicitação por E-mail (quando não tem oobCode)
  const emailParam = (searchParams.get('email') || location.state?.email || '').trim();
  const [emailReferencia, setEmailReferencia] = useState(emailParam);
  const [emailSolicitacao, setEmailSolicitacao] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviadoSucesso, setEmailEnviadoSucesso] = useState(false);
  const [erroSolicitacao, setErroSolicitacao] = useState('');

  // Modo Confirmação de Senha (quando tem oobCode)
  const [emailConta, setEmailConta] = useState('');
  const [verificandoCodigo, setVerificandoCodigo] = useState(!!oobCode);
  const [codigoInvalido, setCodigoInvalido] = useState(false);

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [sucessoRedefinicao, setSucessoRedefinicao] = useState(false);

  // 🔒 Requisitos de Senha
  const validarSenha = (senha) => ({
    tamanho: senha.length >= 8,
    maiuscula: /[A-Z]/.test(senha),
    minuscula: /[a-z]/.test(senha),
    numero: /[0-9]/.test(senha),
    especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(senha)
  });

  const criterios = validarSenha(novaSenha);
  const pontosForte = Object.values(criterios).filter(Boolean).length;
  const isSenhaForte = pontosForte === 5;

  useEffect(() => {
    if (!oobCode) {
      setVerificandoCodigo(false);
      return;
    }

    auth.languageCode = 'pt-BR';
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmailConta(email);
        setVerificandoCodigo(false);
      })
      .catch((error) => {
        console.error("Erro ao verificar código de redefinição:", error);
        setVerificandoCodigo(false);
        setCodigoInvalido(true);
      });
  }, [oobCode, auth]);

  // Enviar link de recuperação para o e-mail
  const handleEnviarEmailRecuperacao = async (e) => {
    e.preventDefault();
    setErroSolicitacao('');
    
    const emailLimpo = emailSolicitacao ? emailSolicitacao.trim().toLowerCase() : '';
    if (!emailLimpo) {
      setErroSolicitacao('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    setEnviandoEmail(true);
    try {
      // 🚀 Tenta envio pelo Resend (entrega garantida na Caixa de Entrada sem cair no Spam)
      try {
        const URL_RESEND_REDEFINIR = 'https://enviarlinkredefinicaosenha-yfhz7t44jq-uc.a.run.app';
        const resp = await fetch(URL_RESEND_REDEFINIR, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailLimpo })
        });

        if (resp.status === 404) {
          const errData = await resp.json().catch(() => ({}));
          let msgErro = errData.error || 'Nenhuma conta cadastrada foi encontrada com este e-mail no Celebre.';
          if (emailLimpo.includes('@hotmail.com') || emailLimpo.includes('@outlook.com')) {
            msgErro += ' (Dica: Se a sua conta foi criada pelo botão do Google, tente com o seu e-mail @gmail.com)';
          }
          setErroSolicitacao(msgErro);
          setEmailReferencia('');
          return;
        }

        if (resp.ok) {
          setEmailEnviadoSucesso(true);
          return;
        }
      } catch (errResend) {
        console.warn("Função Resend em atualização, utilizando fallback nativo:", errResend);
      }

      // Fallback nativo do Firebase Auth
      auth.languageCode = 'pt-BR';
      await sendPasswordResetEmail(auth, emailLimpo);
      setEmailEnviadoSucesso(true);
    } catch (error) {
      console.error("Erro ao enviar email de redefinição:", error);
      if (error.code === 'auth/user-not-found') {
        setErroSolicitacao('Nenhuma conta encontrada com este e-mail.');
      } else if (error.code === 'auth/invalid-email') {
        setErroSolicitacao('Formato de e-mail inválido.');
      } else {
        setErroSolicitacao('Erro ao enviar link de recuperação. Tente novamente.');
      }
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Salvar nova senha após validação do oobCode
  const handleSalvarNovaSenha = async (e) => {
    e.preventDefault();
    if (!novaSenha || !confirmarSenha) {
      return alert("⚠️ Preencha os campos de senha.");
    }
    if (!isSenhaForte) {
      return alert("❌ A nova senha precisa atender aos 5 critérios de segurança.");
    }
    if (novaSenha !== confirmarSenha) {
      return alert("❌ As senhas não coincidem!");
    }

    setSalvando(true);
    try {
      await confirmPasswordReset(auth, oobCode, novaSenha);
      setSucessoRedefinicao(true);
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      alert("❌ Ocorreu um erro ao redefinir a senha: " + (error.message || "Código expirado ou inválido."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #1e1b4b 0%, #0f172a 50%, #020617 100%)',
      padding: '16px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        maxWidth: '460px',
        width: '100%',
        padding: '32px 24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2)',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease'
      }}>

        {/* LOGO CELEBRE */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
            <img src={logoImage} alt="Logo Celebre" style={{ height: '44px', objectFit: 'contain' }} />
            <span style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
              Celebre
            </span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', color: '#0f172a', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <i className="fas fa-lock"></i> Central de Segurança
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* CASO 1: PEDIR LINK DE RECUPERAÇÃO (!oobCode) */}
        {/* ---------------------------------------------------- */}
        {!oobCode ? (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', textAlign: 'center' }}>
              Esqueceu sua senha?
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 22px 0', textAlign: 'center', lineHeight: '1.45' }}>
              Informe o e-mail da sua conta para receber um link seguro de redefinição de senha.
            </p>

            {erroSolicitacao && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                {erroSolicitacao}
              </div>
            )}

            {emailEnviadoSucesso ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '18px', padding: '24px 20px', marginBottom: '18px', color: '#166534', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fas fa-paper-plane" style={{ fontSize: '20px', color: '#16a34a' }}></i>
                    </div>
                    <div>
                      <strong style={{ fontSize: '17px', color: '#14532d', display: 'block' }}>Solicitação Enviada!</strong>
                      <span style={{ fontSize: '12px', color: '#15803d' }}>Instruções de redefinição encaminhadas</span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                      E-mail de Redefinição
                    </span>
                    <strong style={{ fontSize: '16.5px', color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {anonimizarEmail(emailSolicitacao)}
                    </strong>
                  </div>

                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: '1.5', color: '#166534' }}>
                    Se esta conta estiver cadastrada, enviamos um link seguro para o e-mail acima.
                  </p>

                  <div style={{ background: 'rgba(255, 255, 255, 0.75)', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#334155', lineHeight: '1.45' }}>
                    <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>
                      📬 Informações importantes:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li>Verifique a caixa de entrada e a pasta de <strong>Spam / Lixo Eletrônico</strong>.</li>
                      <li>Se a conta foi criada pelo botão <strong>"Entrar com Google"</strong>, você não precisa de senha — pode logar diretamente via Google.</li>
                    </ul>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setEmailEnviadoSucesso(false);
                      setErroSolicitacao('');
                    }}
                    style={{ width: '100%', background: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                  >
                    <i className="fas fa-edit" style={{ marginRight: '6px' }}></i> Digitar outro e-mail
                  </button>

                  <button 
                    type="button" 
                    onClick={() => navigate('/login')}
                    style={{ width: '100%', background: '#0f172a', color: 'white', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13.5px' }}
                  >
                    Voltar para o Login
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEnviarEmailRecuperacao} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!erroSolicitacao && emailReferencia && emailReferencia.includes('@') && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(197, 160, 89, 0.08) 0%, rgba(197, 160, 89, 0.16) 100%)',
                    border: '1.5px solid rgba(197, 160, 89, 0.4)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #c5a059, #dfb76c)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0f172a',
                      fontSize: '16px',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(197, 160, 89, 0.25)'
                    }}>
                      <i className="fas fa-shield-alt"></i>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 800, color: '#854d0e', display: 'block', marginBottom: '2px' }}>
                        Conta a ser recuperada
                      </span>
                      <strong style={{ fontSize: '14.5px', color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.4px', wordBreak: 'break-all' }}>
                        {anonimizarEmail(emailReferencia)}
                      </strong>
                    </div>
                    <span style={{ fontSize: '10.5px', background: '#ecfdf5', color: '#047857', padding: '4px 10px', borderRadius: '20px', fontWeight: 800, border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>
                      <i className="fas fa-lock" style={{ marginRight: '4px' }}></i> Protegido
                    </span>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    CONFIRME O E-MAIL CADASTRADO <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="email" 
                    value={emailSolicitacao} 
                    onChange={e => setEmailSolicitacao(e.target.value)} 
                    placeholder="Digite o e-mail completo para confirmar" 
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                  <small style={{ color: '#64748b', fontSize: '11.5px', marginTop: '6px', display: 'block', lineHeight: '1.4' }}>
                    Por segurança, digite o endereço de e-mail completo correspondente à conta protegida acima.
                  </small>
                </div>

                <button 
                  type="submit" 
                  disabled={enviandoEmail}
                  style={{
                    background: 'linear-gradient(135deg, #c5a059 0%, #dfb76c 100%)',
                    color: '#0f172a',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: enviandoEmail ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(197, 160, 89, 0.35)'
                  }}
                >
                  {enviandoEmail ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-envelope"></i>}
                  {enviandoEmail ? 'ENVIANDO...' : 'ENVIAR LINK DE REDEFINIÇÃO'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <Link to="/login" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
                    ← Voltar para o Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ---------------------------------------------------- */
          /* CASO 2: REDEFINIR COM OOBCODE RECEBIDO NO E-MAIL */
          /* ---------------------------------------------------- */
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', textAlign: 'center' }}>
              Redefinir Sua Senha
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px 0', textAlign: 'center' }}>
              Crie uma nova senha de acesso forte para a sua conta.
            </p>

            {verificandoCodigo ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                <i className="fas fa-shield-alt fa-spin" style={{ fontSize: '28px', marginBottom: '12px', display: 'block', color: '#c5a059' }}></i>
                Validando chave de segurança...
              </div>
            ) : codigoInvalido ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '14px', padding: '18px', marginBottom: '20px', color: '#991b1b' }}>
                  <i className="fas fa-exclamation-triangle" style={{ fontSize: '26px', marginBottom: '8px', display: 'block', color: '#ef4444' }}></i>
                  <strong style={{ fontSize: '15px', display: 'block' }}>Link Expirado ou Já Utilizado</strong>
                  <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', lineHeight: '1.45' }}>
                    Este link de redefinição expirou ou já foi usado. Solicite um novo link abaixo.
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => navigate('/redefinir-senha')}
                  style={{ width: '100%', background: '#0f172a', color: 'white', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13.5px' }}
                >
                  Solicitar Novo Link
                </button>
              </div>
            ) : sucessoRedefinicao ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: '16px', padding: '24px', marginBottom: '24px', color: '#065f46' }}>
                  <i className="fas fa-check-circle" style={{ fontSize: '44px', marginBottom: '12px', display: 'block', color: '#10b981' }}></i>
                  <strong style={{ fontSize: '18px', display: 'block', marginBottom: '6px' }}>Senha Alterada com Sucesso!</strong>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                    Sua nova senha foi atualizada. Acesse com suas novas credenciais.
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => navigate('/login')}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  🚀 ACESSAR MINHA CONTA
                </button>
              </div>
            ) : (
              <form onSubmit={handleSalvarNovaSenha} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    CONTA DE E-MAIL:
                  </span>
                  <strong style={{ fontSize: '13.5px', color: '#0f172a', wordBreak: 'break-all' }}>
                    📧 {emailConta}
                  </strong>
                </div>

                {/* NOVA SENHA */}
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    NOVA SENHA <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={mostrarNovaSenha ? "text" : "password"} 
                      value={novaSenha} 
                      onChange={e => setNovaSenha(e.target.value)} 
                      placeholder="Mínimo 8 caracteres" 
                      style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      <i className={`fas ${mostrarNovaSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>

                  {/* INDICADOR DE FORÇA */}
                  {novaSenha.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                        <span>Força da Senha:</span>
                        <span style={{ color: pontosForte <= 2 ? '#ef4444' : pontosForte <= 4 ? '#d97706' : '#10b981' }}>
                          {pontosForte <= 2 ? 'Fraca' : pontosForte <= 4 ? 'Média' : 'Muito Forte 💪'}
                        </span>
                      </div>
                      <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(pontosForte / 5) * 100}%`, background: pontosForte <= 2 ? '#ef4444' : pontosForte <= 4 ? '#f59e0b' : '#10b981', transition: 'all 0.3s ease' }}></div>
                      </div>
                    </div>
                  )}

                  {/* CHECKLIST DE REQUISITOS */}
                  <div style={{ marginTop: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 800, color: '#475569' }}>Requisitos de Segurança:</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
                      <li style={{ color: criterios.tamanho ? '#047857' : '#94a3b8', fontWeight: criterios.tamanho ? 700 : 400 }}>
                        <i className={`fas ${criterios.tamanho ? "fa-check-circle" : "fa-circle"}`} style={{ marginRight: '4px' }}></i> Min. 8 caracteres
                      </li>
                      <li style={{ color: (criterios.maiuscula && criterios.minuscula) ? '#047857' : '#94a3b8', fontWeight: (criterios.maiuscula && criterios.minuscula) ? 700 : 400 }}>
                        <i className={`fas ${(criterios.maiuscula && criterios.minuscula) ? "fa-check-circle" : "fa-circle"}`} style={{ marginRight: '4px' }}></i> Maiúsculas e minúsculas
                      </li>
                      <li style={{ color: criterios.numero ? '#047857' : '#94a3b8', fontWeight: criterios.numero ? 700 : 400 }}>
                        <i className={`fas ${criterios.numero ? "fa-check-circle" : "fa-circle"}`} style={{ marginRight: '4px' }}></i> Pelo menos 1 número
                      </li>
                      <li style={{ color: criterios.especial ? '#047857' : '#94a3b8', fontWeight: criterios.especial ? 700 : 400 }}>
                        <i className={`fas ${criterios.especial ? "fa-check-circle" : "fa-circle"}`} style={{ marginRight: '4px' }}></i> Símbolo (!@#$%)
                      </li>
                    </ul>
                  </div>
                </div>

                {/* CONFIRMAR SENHA */}
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    CONFIRMAR NOVA SENHA <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={mostrarConfirmarSenha ? "text" : "password"} 
                      value={confirmarSenha} 
                      onChange={e => setConfirmarSenha(e.target.value)} 
                      placeholder="Repita a nova senha" 
                      style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      <i className={`fas ${mostrarConfirmarSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={salvando || !isSenhaForte}
                  style={{
                    marginTop: '8px',
                    background: isSenhaForte ? 'linear-gradient(135deg, #c5a059 0%, #dfb76c 100%)' : '#cbd5e1',
                    color: '#0f172a',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: (salvando || !isSenhaForte) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: isSenhaForte ? '0 4px 14px rgba(197, 160, 89, 0.35)' : 'none'
                  }}
                >
                  {salvando ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                  {salvando ? 'SALVANDO SENHA...' : 'SALVAR NOVA SENHA'}
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default RedefinirSenha;
