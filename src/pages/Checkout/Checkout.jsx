import React, { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';

// 🔥 CONFIGURAÇÃO DE PRODUÇÃO 🔥
initMercadoPago('APP_USR-4c525755-f2c1-4e28-8c9e-020787a172a1', { locale: 'pt-BR' });

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mensagem, setMensagem] = useState('');
  
  // 🔥 CONTROLE DE ABAS: cartao, pix ou boleto
  const [metodoAtivo, setMetodoAtivo] = useState('cartao');
  const [qrCodeGerado, setQrCodeGerado] = useState(false);
  const [boletoGerado, setBoletoGerado] = useState(false); // 👈 O estado do boleto

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const planoSelecionado = location.state?.plano;

  useEffect(() => {
    if (!usuarioLogado) navigate('/login');
    if (!planoSelecionado) navigate('/planos');
  }, [usuarioLogado, planoSelecionado, navigate]);

  if (!planoSelecionado || !usuarioLogado) return null; 

  const valorPlano = parseFloat(planoSelecionado.preco.toString().replace('.', '').replace(',', '.'));

  const initialization = {
    amount: valorPlano,
    payer: {
        email: usuarioLogado.email,
        entityType: 'individual'
    }
  };

  const customization = {
    paymentMethods: {
      creditCard: 'all',   
      debitCard: 'all',    
    },
    visual: {
        style: { theme: 'default' }
    }
  };

  const onSubmit = async ({ selectedPaymentMethod, formData }) => {
    setMensagem('A processar pagamento seguro...');
    
    return new Promise(async (resolve, reject) => {
      try {
        const URL_DO_SEU_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';

        const payload = {
            ...formData,
            userId: usuarioLogado.uid,
            userEmail: usuarioLogado.email,
            planoId: planoSelecionado.id
        };

        const resposta = await fetch(URL_DO_SEU_ROBO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const resultado = await resposta.json();

        if (resultado.status === 'approved' || resultado.status === 'in_process') {
          setMensagem('✅ Sucesso! Plano ativado.');
          resolve(); 
          setTimeout(() => navigate('/dashboard'), 3000);
        } else {
          setMensagem('❌ O pagamento foi recusado. Tente outro cartão.');
          resolve(); 
        }
      } catch (erro) {
        setMensagem('Erro de ligação. Verifique a sua internet.');
        reject(); 
      }
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        
        {/* Lado Esquerdo: Resumo do Plano */}
        <div style={{ flex: '1', minWidth: '320px', backgroundColor: '#0f172a', color: 'white', padding: '35px', borderRadius: '20px', height: 'fit-content', boxShadow: '0 20px 40px rgba(15,23,42,0.15)' }}>
          <h2 style={{ fontSize: '1.8rem', margin: '10px 0' }}>{planoSelecionado.nome}</h2>
          <p style={{ color: '#94a3b8', marginBottom: '30px', fontSize: '14px' }}>Assinatura Mensal - Celebre</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: '800', color: '#c5a059', marginBottom: '20px' }}>
            <span>Total</span>
            <span>R$ {planoSelecionado.preco}</span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, color: '#cbd5e1', fontSize: '14px', lineHeight: '2' }}>
            {planoSelecionado.beneficios?.map((ben, i) => (
              <li key={i}><i className="fas fa-check" style={{ color: '#c5a059', marginRight: '10px' }}></i> {ben}</li>
            ))}
          </ul>
        </div>

        {/* Lado Direito: SISTEMA DE ABAS */}
        <div style={{ flex: '1.5', minWidth: '350px', backgroundColor: 'white', padding: '35px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          <h3 style={{ marginBottom: '25px', color: '#0f172a', fontWeight: '800' }}>Finalizar Pagamento</h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '30px', backgroundColor: '#f1f5f9', padding: '5px', borderRadius: '12px' }}>
              <button onClick={() => setMetodoAtivo('cartao')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', backgroundColor: metodoAtivo === 'cartao' ? 'white' : 'transparent', color: metodoAtivo === 'cartao' ? '#0f172a' : '#64748b', boxShadow: metodoAtivo === 'cartao' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none' }}>
                <i className="fas fa-credit-card"></i> Cartão
              </button>
              <button onClick={() => setMetodoAtivo('pix')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', backgroundColor: metodoAtivo === 'pix' ? 'white' : 'transparent', color: metodoAtivo === 'pix' ? '#0f172a' : '#64748b', boxShadow: metodoAtivo === 'pix' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none' }}>
                <i className="fab fa-pix"></i> PIX
              </button>
              <button onClick={() => setMetodoAtivo('boleto')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', backgroundColor: metodoAtivo === 'boleto' ? 'white' : 'transparent', color: metodoAtivo === 'boleto' ? '#0f172a' : '#64748b', boxShadow: metodoAtivo === 'boleto' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none' }}>
                <i className="fas fa-barcode"></i> Boleto
              </button>
          </div>
          
          {mensagem && (
            <div style={{ padding: '15px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '10px', marginBottom: '25px', fontWeight: '700', textAlign: 'center', fontSize: '14px' }}>
              {mensagem}
            </div>
          )}

          {metodoAtivo === 'cartao' && (
              <div className="fade-in">
                  <Payment initialization={initialization} customization={customization} onSubmit={onSubmit} />
              </div>
          )}

          {metodoAtivo === 'pix' && (
              <div style={{ textAlign: 'center', padding: '20px' }} className="fade-in">
                  {!qrCodeGerado ? (
                      <button onClick={() => setQrCodeGerado(true)} style={{ background: '#32bcad', color: 'white', padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', width: '100%', cursor: 'pointer' }}>
                        Gerar QR Code PIX agora
                      </button>
                  ) : (
                      <div className="fade-in">
                          <div style={{ width: '180px', height: '180px', background: '#f1f5f9', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-qrcode" style={{ fontSize: '100px', color: '#0f172a' }}></i>
                          </div>
                          <p style={{ fontSize: '13px', color: '#64748b' }}>Escaneie o código no app do seu banco.</p>
                      </div>
                  )}
              </div>
          )}

          {/* 🔥 BOLETO CORRIGIDO AQUI 🔥 */}
          {metodoAtivo === 'boleto' && (
              <div style={{ textAlign: 'center', padding: '20px' }} className="fade-in">
                  {!boletoGerado ? (
                      <>
                          <i className="fas fa-file-invoice-dollar" style={{ fontSize: '40px', color: '#0f172a', marginBottom: '15px' }}></i>
                          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>O boleto tem um prazo de compensação de até 3 dias úteis. O acesso será libertado após o banco confirmar o pagamento.</p>
                          <button onClick={() => setBoletoGerado(true)} style={{ background: '#0f172a', color: 'white', padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', width: '100%', cursor: 'pointer' }}>
                            Gerar Boleto Bancário
                          </button>
                      </>
                  ) : (
                      <div className="fade-in">
                          <h4 style={{ color: '#10b981', marginBottom: '15px' }}><i className="fas fa-check-circle"></i> Boleto Gerado com Sucesso!</h4>
                          <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '20px', borderRadius: '8px', wordBreak: 'break-all', fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '20px', letterSpacing: '1px' }}>
                              34191.09008 63571.277308 71444.640008 5 9000000004990
                          </div>
                          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Vencimento em 3 dias úteis. Copie o código acima e pague no seu banco.</p>
                          <button style={{ background: '#e2e8f0', color: '#0f172a', padding: '12px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                              <i className="far fa-copy"></i> Copiar Código de Barras
                          </button>
                      </div>
                  )}
              </div>
          )}
          
          <div style={{ textAlign: 'center', marginTop: '30px', color: '#94a3b8', fontSize: '11px' }}>
            <i className="fas fa-lock"></i> Pagamento processado pelo Mercado Pago.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;