import React, { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 🔥 CONFIGURAÇÃO DE PRODUÇÃO 🔥
initMercadoPago('APP_USR-4c525755-f2c1-4e28-8c9e-020787a172a1', { locale: 'pt-BR' });

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mensagem, setMensagem] = useState('');
  const [metodoAtivo, setMetodoAtivo] = useState('cartao');
  
  const [carregandoAlternativo, setCarregandoAlternativo] = useState(false);
  const [dadosPix, setDadosPix] = useState(null); 
  const [dadosBoleto, setDadosBoleto] = useState(null);
  const [cpfCliente, setCpfCliente] = useState(''); 

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const planoSelecionado = location.state?.plano;

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE CHECKOUT)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
      const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado.displayName || usuarioLogado.email || "Usuário";
      
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipe,
        usuarioNome: nomeEquipe,
        usuarioEmail: usuarioLogado.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: tenantId
      });
    } catch (error) {
      console.error("Erro ao gravar log do checkout:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) navigate('/login');
    if (!planoSelecionado) navigate('/planos');
  }, [usuarioLogado, planoSelecionado, navigate]);

  if (!planoSelecionado || !usuarioLogado) return null; 

  const valorPlano = parseFloat(planoSelecionado.preco.toString().replace('.', '').replace(',', '.'));
  
  const initialization = {
    amount: valorPlano,
    payer: { email: usuarioLogado.email, entityType: 'individual' }
  };
  
  const customization = {
    paymentMethods: { creditCard: 'all' },
    visual: { style: { theme: 'default' } }
  };

  // Processamento do Cartão (Assinatura Recorrente)
  const onSubmit = async ({ selectedPaymentMethod, formData }) => {
    setMensagem('A processar pagamento seguro...');
    return new Promise(async (resolve, reject) => {
      try {
        const URL_DO_SEU_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
        const payload = {
            ...formData,
            userId: usuarioLogado.uid,
            planoId: planoSelecionado.id
        };

        const resposta = await fetch(URL_DO_SEU_ROBO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const resultado = await resposta.json();
        
        if (resultado.status === 'authorized' || resultado.status === 'approved' || resultado.status === 'in_process') {
          setMensagem('✅ Sucesso! Assinatura ativada.');
          await registrarLog("ASSINATURA APROVADA", `Pagamento de assinatura processado com sucesso via Cartão. Plano: ${planoSelecionado.nome} (R$ ${planoSelecionado.preco}).`);
          resolve();
          setTimeout(() => navigate('/dashboard'), 3000);
        } else {
          setMensagem('❌ O pagamento foi recusado. Tente outro cartão.');
          await registrarLog("FALHA NO PAGAMENTO", `Tentativa de assinatura recusada via Cartão. Plano: ${planoSelecionado.nome} (R$ ${planoSelecionado.preco}).`);
          resolve(); 
        }
      } catch (erro) {
        setMensagem('Erro de ligação. Verifique a sua internet.');
        await registrarLog("ERRO NO CHECKOUT", `Falha de conexão ao tentar assinar o plano ${planoSelecionado.nome}.`);
        reject(); 
      }
    });
  };

  // 🔥 Processamento Real do PIX e Boleto 🔥
  const gerarPagamentoAlternativo = async (metodo) => {
    const cpfLimpo = cpfCliente.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
        setMensagem('⚠️ Por favor, digite um CPF válido com 11 números para emissão do documento.');
        return;
    }

    setCarregandoAlternativo(true);
    setMensagem('A comunicar com o banco...');
    
    try {
        const URL_DO_SEU_ROBO = 'https://processarpagamento-yfhz7t44jq-uc.a.run.app';
        const payload = {
            payment_method_id: metodo,
            transaction_amount: valorPlano,
            payer: { 
                email: usuarioLogado.email,
                identification: { type: "CPF", number: cpfLimpo } 
            },
            userId: usuarioLogado.uid
        };
        
        const resposta = await fetch(URL_DO_SEU_ROBO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const resultado = await resposta.json();

        if (metodo === 'pix' && resultado.point_of_interaction) {
            setDadosPix({
                qrCodeBase64: resultado.point_of_interaction.transaction_data.qr_code_base64,
                copiaECola: resultado.point_of_interaction.transaction_data.qr_code
            });
            setMensagem('');
            await registrarLog("GERAÇÃO DE PIX", `Gerou um QR Code PIX para pagamento da assinatura do Plano: ${planoSelecionado.nome} (R$ ${planoSelecionado.preco}).`);
        } else if (metodo === 'bolbradesco' && resultado.transaction_details) {
            setDadosBoleto({
                link: resultado.transaction_details.external_resource_url
            });
            setMensagem('');
            await registrarLog("GERAÇÃO DE BOLETO", `Gerou um Boleto bancário para pagamento da assinatura do Plano: ${planoSelecionado.nome} (R$ ${planoSelecionado.preco}).`);
        } else {
            setMensagem('❌ Erro ao gerar código. Tente novamente.');
            await registrarLog("ERRO NA GERAÇÃO", `Falha ao tentar gerar pagamento via ${metodo.toUpperCase()} para o plano ${planoSelecionado.nome}.`);
        }
    } catch (erro) {
        setMensagem('Erro de ligação ao servidor.');
    } finally {
        setCarregandoAlternativo(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      
      <div style={{ maxWidth: '950px', margin: '0 auto', marginBottom: '20px' }}>
        <button 
          onClick={() => navigate('/planos')}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#64748b', 
            cursor: 'pointer', 
            fontSize: '15px', 
            fontWeight: '600', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '0',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
          onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
        >
          <i className="fas fa-arrow-left"></i> Voltar para os planos
        </button>
      </div>

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
                  {!dadosPix ? (
                      <>
                          <div style={{ textAlign: 'left', marginBottom: '25px' }}>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>CPF para emissão do comprovante *</label>
                            <input type="text" placeholder="Apenas números" value={cpfCliente} onChange={(e) => setCpfCliente(e.target.value)} maxLength="14" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box' }} />
                          </div>

                          <button onClick={() => gerarPagamentoAlternativo('pix')} disabled={carregandoAlternativo} style={{ background: '#32bcad', color: 'white', padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', width: '100%', cursor: carregandoAlternativo ? 'not-allowed' : 'pointer', opacity: carregandoAlternativo ? 0.7 : 1 }}>
                            {carregandoAlternativo ? 'A comunicar com o banco...' : 'Gerar QR Code PIX agora'}
                          </button>
                      </>
                  ) : (
                      <div className="fade-in">
                          <div style={{ width: '220px', height: '220px', background: 'white', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', border: '2px dashed #cbd5e1', padding: '10px' }}>
                              <img src={`data:image/jpeg;base64,${dadosPix.qrCodeBase64}`} alt="QR Code PIX Real" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
                          </div>
                          <p style={{ fontSize: '14px', color: '#64748b', fontWeight: '500', marginBottom: '15px' }}>Escaneie o código no app do seu banco.</p>
                          <button onClick={() => navigator.clipboard.writeText(dadosPix.copiaECola)} style={{ background: '#f1f5f9', color: '#0f172a', padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                              <i className="far fa-copy" style={{ marginRight: '5px' }}></i> Copiar PIX Copia e Cola
                          </button>
                      </div>
                  )}
              </div>
          )}

          {metodoAtivo === 'boleto' && (
              <div style={{ textAlign: 'center', padding: '20px' }} className="fade-in">
                  {!dadosBoleto ? (
                      <>
                          <div style={{ textAlign: 'left', marginBottom: '25px' }}>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>CPF para registro do boleto *</label>
                            <input type="text" placeholder="Apenas números" value={cpfCliente} onChange={(e) => setCpfCliente(e.target.value)} maxLength="14" style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box' }} />
                          </div>

                          <i className="fas fa-file-invoice-dollar" style={{ fontSize: '40px', color: '#0f172a', marginBottom: '15px' }}></i>
                          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>O boleto tem um prazo de compensação de até 3 dias úteis.</p>
                          <button onClick={() => gerarPagamentoAlternativo('bolbradesco')} disabled={carregandoAlternativo} style={{ background: '#0f172a', color: 'white', padding: '16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', width: '100%', cursor: carregandoAlternativo ? 'not-allowed' : 'pointer', opacity: carregandoAlternativo ? 0.7 : 1 }}>
                            {carregandoAlternativo ? 'A comunicar com o banco...' : 'Gerar Boleto Bancário'}
                          </button>
                      </>
                  ) : (
                      <div className="fade-in">
                          <h4 style={{ color: '#059669', marginBottom: '15px', fontSize: '1.1rem' }}>
                            <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i> Boleto Gerado com Sucesso!
                          </h4>
                          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Vencimento em 3 dias úteis. Clique no botão abaixo para ver e imprimir o seu boleto oficial.</p>
                          <a href={dadosBoleto.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#0f172a', color: 'white', padding: '14px 20px', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', width: '100%', boxSizing: 'border-box' }}>
                            <i className="fas fa-external-link-alt" style={{ marginRight: '8px' }}></i> Abrir Boleto para Pagamento
                          </a>
                      </div>
                  )}
              </div>
          )}
          
          <div style={{ textAlign: 'center', marginTop: '30px', color: '#94a3b8', fontSize: '12px', fontWeight: '500' }}>
            <i className="fas fa-lock" style={{ marginRight: '5px' }}></i> Pagamento processado de forma segura pelo Mercado Pago.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;