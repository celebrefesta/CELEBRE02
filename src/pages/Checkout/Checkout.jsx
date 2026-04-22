import React, { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth'; // 🔥 Importação do Cadeado de Segurança

// 🔥 CONFIGURAÇÃO DE PRODUÇÃO 🔥
initMercadoPago('APP_USR-4c525755-f2c1-4e28-8c9e-020787a172a1', { locale: 'pt-BR' });

const Checkout = () => {
  const navigate = useNavigate();
  const [mensagem, setMensagem] = useState('');

  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
    }
  }, [usuarioLogado, navigate]);

  // Configuração do valor do plano
  const initialization = {
    amount: 99, 
  };

  // Meios de pagamento aceitos
  const customization = {
    paymentMethods: {
      pix: 'all',
      creditCard: 'all',
    },
  };

  // Função que conecta com o seu robô no Google Cloud
  const onSubmit = async ({ selectedPaymentMethod, formData }) => {
    setMensagem('Comunicando com o banco... Aguarde.');
    
    return new Promise(async (resolve, reject) => {
      try {
        const URL_DO_SEU_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';

        // 🔥 BLINDAGEM: Envia a identificação da empresa para o backend ativar a conta certa!
        const payload = {
            ...formData,
            userId: usuarioLogado.uid,
            userEmail: usuarioLogado.email
        };

        const resposta = await fetch(URL_DO_SEU_ROBO, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const resultado = await resposta.json();

        // Verificando a aprovação real
        if (resultado.status === 'approved' || resultado.status === 'in_process') {
          setMensagem('Sucesso! Pagamento aprovado. Bem-vinda ao Celebre.');
          resolve(); 
          setTimeout(() => navigate('/dashboard'), 3000);
        } else {
          setMensagem('O pagamento foi recusado. Verifique os dados ou tente outro meio.');
          resolve(); 
        }

      } catch (erro) {
        console.error("Erro na conexão com o servidor:", erro);
        setMensagem('Erro de conexão. Verifique sua internet e tente novamente.');
        reject(); 
      }
    });
  };

  const onError = async (error) => {
    console.error(error);
    setMensagem('Ocorreu um erro ao carregar o sistema de pagamento.');
  };

  const onReady = async () => {
    /* Brick carregado */
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        
        {/* Resumo do Plano */}
        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#0f172a', color: 'white', padding: '30px', borderRadius: '16px', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Plano Profissional</h2>
          <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Assinatura mensal - Celebre Sistemas</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '15px' }}>
            <span>Valor do plano</span>
            <strong>R$ 99,00</strong>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem' }}>
            <strong>Total a pagar hoje</strong>
            <strong>R$ 99,00</strong>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, marginTop: '30px', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.8' }}>
            <li>✔️ Peças e locações ilimitadas</li>
            <li>✔️ Assinatura digital de contratos</li>
            <li>✔️ Catálogo Online Exclusivo</li>
            <li>✔️ Gestão completa de inventário</li>
          </ul>
        </div>

        {/* Formulário de Pagamento */}
        <div style={{ flex: '1.5', minWidth: '350px', backgroundColor: 'white', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '20px', color: '#0f172a' }}>Finalizar Assinatura</h3>
          
          {mensagem && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: mensagem.includes('Sucesso') ? '#dcfce3' : '#fee2e2', 
              color: mensagem.includes('Sucesso') ? '#166534' : '#991b1b', 
              borderRadius: '8px', 
              marginBottom: '20px', 
              fontWeight: 'bold', 
              textAlign: 'center' 
            }}>
              {mensagem}
            </div>
          )}

          <Payment
            initialization={initialization}
            customization={customization}
            onSubmit={onSubmit}
            onReady={onReady}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
};

export default Checkout;