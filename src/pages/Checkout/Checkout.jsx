import React, { useState } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useNavigate } from 'react-router-dom';

// 🔥 1. COLOQUE A SUA PUBLIC KEY DE TESTE AQUI 🔥
// Ela começa com "TEST-..." e você pega no painel de desenvolvedor do Mercado Pago
initMercadoPago('TEST-COLOQUE-A-SUA-CHAVE-AQUI', { locale: 'pt-BR' });

const Checkout = () => {
  const navigate = useNavigate();
  const [mensagem, setMensagem] = useState('');

  // Configuração do valor do plano (Exemplo: Plano Profissional R$99)
  const initialization = {
    amount: 99, 
  };

  // Quais meios de pagamento queremos aceitar?
  const customization = {
    paymentMethods: {
      pix: 'all',
      creditCard: 'all',
    },
  };

  // O que acontece quando o cliente clica em "Pagar"?
  const onSubmit = async ({ selectedPaymentMethod, formData }) => {
    // 🚧 AQUI ENTRA O NOSSO ROBÔ (BACKEND) DEPOIS 🚧
    // Por enquanto, vamos só simular que deu certo para você ver a tela!
    setMensagem('Processando pagamento...');
    
    console.log("Dados prontos para enviar ao robô:", formData);

    return new Promise((resolve) => {
      setTimeout(() => {
        setMensagem('Pagamento Aprovado! Bem-vindo ao Celebre Premium.');
        resolve();
        // Depois de 3 segundos, joga o cliente pro Dashboard
        setTimeout(() => navigate('/dashboard'), 3000);
      }, 2000);
    });
  };

  const onError = async (error) => {
    console.error(error);
    setMensagem('Ocorreu um erro ao carregar o pagamento.');
  };

  const onReady = async () => {
    /* Callback chamado quando o Brick estiver pronto */
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        
        {/* Lado Esquerdo: Resumo do Pedido */}
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
            <li>✔️ 7 dias de teste gratuito</li>
          </ul>
        </div>

        {/* Lado Direito: A Mágica do Mercado Pago */}
        <div style={{ flex: '1.5', minWidth: '350px', backgroundColor: 'white', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '20px', color: '#0f172a' }}>Finalizar Assinatura</h3>
          
          {mensagem && (
            <div style={{ padding: '15px', backgroundColor: '#dcfce3', color: '#166534', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center' }}>
              {mensagem}
            </div>
          )}

          {/* O COMPONENTE OFICIAL DO MERCADO PAGO */}
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