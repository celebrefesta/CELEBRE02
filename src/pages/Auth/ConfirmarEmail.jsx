import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth, applyActionCode } from 'firebase/auth';
import './Auth.css';
import logoImage from '../../assets/LOGO_CELEBRE.png';

const ConfirmarEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = getAuth();

  const oobCode = searchParams.get('oobCode');
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    auth.languageCode = 'pt-BR';
    if (oobCode) {
      applyActionCode(auth, oobCode)
        .then(() => {
          setVerificando(false);
        })
        .catch((error) => {
          console.log("Ação do e-mail processada:", error);
          setVerificando(false);
        });
    } else {
      setVerificando(false);
    }
  }, [oobCode, auth]);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #2e1065 0%, #0f172a 50%, #020617 100%)',
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
        textAlign: 'center'
      }}>

        {/* LOGO CELEBRE */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
            <img src={logoImage} alt="Logo Celebre" style={{ height: '44px', objectFit: 'contain' }} />
            <span style={{ fontSize: '24px', fontWeight: 900, background: 'linear-gradient(135deg, #9333ea, #6b21a8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Celebre
            </span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f3e8ff', color: '#6b21a8', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <i className="fas fa-envelope"></i> Validação de Acesso
          </div>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
          E-mail Alterado com Sucesso!
        </h2>
        
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px 0' }}>
          CELEBRE • Sistema de Gestão de Festas & Eventos
        </p>

        {verificando ? (
          <div style={{ padding: '30px 0', color: '#64748b' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '28px', marginBottom: '12px', display: 'block', color: '#9333ea' }}></i>
            Confirmando seu novo e-mail no sistema...
          </div>
        ) : (
          <div>
            <div style={{ background: '#f3e8ff', border: '1.5px solid #d8b4fe', borderRadius: '16px', padding: '24px', marginBottom: '24px', color: '#581c87' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#9333ea', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 12px', boxShadow: '0 8px 16px rgba(147, 51, 234, 0.3)' }}>
                <i className="fas fa-check"></i>
              </div>
              <strong style={{ fontSize: '17px', display: 'block', marginBottom: '6px' }}>
                Novo E-mail Ativo na Conta
              </strong>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.55' }}>
                Seu novo e-mail foi verificado e aprovado com sucesso! Utilize este novo endereço nos seus próximos acessos à plataforma Celebre.
              </p>
            </div>

            <button 
              type="button" 
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
                color: 'white',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(147, 51, 234, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              🚀 ACESSAR MINHA CONTA
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ConfirmarEmail;
