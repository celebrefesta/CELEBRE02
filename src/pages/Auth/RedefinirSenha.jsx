import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  getAuth, 
  verifyPasswordResetCode, 
  confirmPasswordReset
} from 'firebase/auth';
import './Auth.css';
import logoImage from '../../assets/LOGO_CELEBRE.png';

const RedefinirSenha = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = getAuth();

  const oobCode = searchParams.get('oobCode');

  const [emailConta, setEmailConta] = useState('');
  const [verificandoCodigo, setVerificandoCodigo] = useState(true);
  const [codigoInvalido, setCodigoInvalido] = useState(false);

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

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
      setCodigoInvalido(true);
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
      setSucesso(true);
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
            <span style={{ fontSize: '24px', fontWeight: 900, background: 'linear-gradient(135deg, #2563eb, #1e40af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Celebre
            </span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <i className="fas fa-lock"></i> Central de Segurança
          </div>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', textAlign: 'center' }}>
          Redefinir Sua Senha
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px 0', textAlign: 'center' }}>
          Crie uma nova senha de acesso forte para a sua conta.
        </p>

        {verificandoCodigo ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
            <i className="fas fa-shield-alt fa-spin" style={{ fontSize: '28px', marginBottom: '12px', display: 'block', color: '#2563eb' }}></i>
            Validando chave de segurança...
          </div>
        ) : codigoInvalido ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '14px', padding: '18px', marginBottom: '20px', color: '#991b1b' }}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize: '26px', marginBottom: '8px', display: 'block', color: '#ef4444' }}></i>
              <strong style={{ fontSize: '15px', display: 'block' }}>Link Expirado ou Já Utilizado</strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', lineHeight: '1.45' }}>
                Este link de redefinição expirou ou já foi usado. Solicite um novo link na aba de Segurança.
              </p>
            </div>
            <button 
              type="button" 
              onClick={() => navigate('/login')}
              style={{ width: '100%', background: '#0f172a', color: 'white', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '13.5px' }}
            >
              Voltar para o Login
            </button>
          </div>
        ) : sucesso ? (
          /* TELA DE SUCESSO DE REDEFINIÇÃO DE SENHA */
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: '16px', padding: '24px', marginBottom: '24px', color: '#065f46' }}>
              <i className="fas fa-check-circle" style={{ fontSize: '44px', marginBottom: '12px', display: 'block', color: '#10b981' }}></i>
              <strong style={{ fontSize: '18px', display: 'block', marginBottom: '6px' }}>Senha Alterada com Sucesso!</strong>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                Sua nova senha foi atualizada no banco de dados. Utilize suas novas credenciais no próximo acesso.
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
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              🚀 ACESSAR MINHA CONTA
            </button>
          </div>
        ) : (
          /* FORMULÁRIO DE ALTERAÇÃO DE SENHA */
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
                  placeholder="Digite sua nova senha" 
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

              {/* BARRA DE FORÇA DA SENHA */}
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
                background: isSenhaForte ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1',
                color: 'white',
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
                boxShadow: isSenhaForte ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none'
              }}
            >
              {salvando ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
              {salvando ? 'SALVANDO SENHA...' : 'SALVAR NOVA SENHA'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default RedefinirSenha;
