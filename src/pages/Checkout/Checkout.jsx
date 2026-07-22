import React, { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 🔥 CONFIGURAÇÃO DE PRODUÇÃO MERCADO PAGO 🔥
initMercadoPago('APP_USR-4c525755-f2c1-4e28-8c9e-020787a172a1', { locale: 'pt-BR' });

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('info'); 
  const [metodoAtivo, setMetodoAtivo] = useState('cartao');
  
  const [carregandoAlternativo, setCarregandoAlternativo] = useState(false);
  const [dadosPix, setDadosPix] = useState(null); 
  const [dadosBoleto, setDadosBoleto] = useState(null);
  const [cpfCliente, setCpfCliente] = useState(''); 
  const [copiado, setCopiado] = useState(false);

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  
  // Lista enriquecida de funcionalidades para encantar o cliente no momento do pagamento
  const listaRecursosVip = [
    { title: 'Gestão Completa de Clientes & CRM de Eventos', icon: 'fas fa-users' },
    { title: 'Estoque & Acervo Ilimitado com Fotos em Alta Definição', icon: 'fas fa-boxes' },
    { title: 'Gestão de Orçamentos, Locações, Reservas & Agenda', icon: 'fas fa-hand-holding-heart' },
    { title: 'Logística, Controle de Entregas, Frete e Devoluções', icon: 'fas fa-truck' },
    { title: 'Gerador de Contratos PDF com Assinatura Digital', icon: 'fas fa-file-contract' },
    { title: 'Catálogo Digital Vitrine Online para Enviar aos Clientes', icon: 'fas fa-store' },
    { title: 'Criação de Projetos Visuais e Moodboards de Decoração', icon: 'fas fa-palette' },
    { title: 'Financeiro Completo, Fluxo de Caixa e Relatórios DRE', icon: 'fas fa-chart-line' },
    { title: 'Suporte Prioritário VIP & Novas Atualizações Inclusas', icon: 'fas fa-crown' }
  ];

  const planoPadrao = {
    id: 'plano_premium',
    nome: 'Plano Premium',
    preco: '99,90',
  };

  const planoSelecionado = location.state?.plano || planoPadrao;

  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
      const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado.displayName || usuarioLogado.email || "Usuário";
      
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado.uid,
        nomeFuncionario: nomeEquipe,
        usuarioEmail: usuarioLogado.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log do checkout:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) navigate('/login');
  }, [usuarioLogado, navigate]);

  if (!usuarioLogado) return null; 

  const valorPlano = parseFloat(planoSelecionado.preco.toString().replace('.', '').replace(',', '.'));
  
  const initialization = {
    amount: valorPlano,
    payer: { email: usuarioLogado.email, entityType: 'individual' }
  };
  
  const customization = {
    paymentMethods: { creditCard: 'all' },
    visual: { style: { theme: 'default' } }
  };

  const handleVoltar = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/planos');
    }
  };

  // Processamento do Cartão
  const onSubmit = async ({ selectedPaymentMethod, formData }) => {
    setMensagem('A processar pagamento seguro no Mercado Pago...');
    setTipoMensagem('info');

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
          setMensagem('🎉 Pagamento Aprovado com Sucesso! Sua assinatura já está ativa.');
          setTipoMensagem('sucesso');
          await registrarLog("ASSINATURA APROVADA", `Pagamento de assinatura processado com sucesso via Cartão. Plano: ${planoSelecionado.nome} (R$ ${planoSelecionado.preco}).`);
          resolve();
          setTimeout(() => navigate('/dashboard'), 2500);
        } else {
          setMensagem('❌ Pagamento Recusado. Verifique os dados do cartão ou tente outro método.');
          setTipoMensagem('erro');
          await registrarLog("FALHA NO PAGAMENTO", `Tentativa de assinatura recusada via Cartão. Plano: ${planoSelecionado.nome} (R$ ${planoSelecionado.preco}).`);
          resolve(); 
        }
      } catch (erro) {
        setMensagem('⚠️ Erro de conexão com o banco. Tente novamente em instantes.');
        setTipoMensagem('erro');
        await registrarLog("ERRO NO CHECKOUT", `Falha de conexão ao tentar assinar o plano ${planoSelecionado.nome}.`);
        reject(); 
      }
    });
  };

  // Processamento do PIX e Boleto
  const gerarPagamentoAlternativo = async (metodo) => {
    const cpfLimpo = cpfCliente.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
        setMensagem('⚠️ Por favor, digite um CPF válido com 11 números.');
        setTipoMensagem('erro');
        return;
    }

    setCarregandoAlternativo(true);
    setMensagem('Comunicando com o Mercado Pago...');
    setTipoMensagem('info');
    
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
            setMensagem('❌ Erro ao gerar o pagamento. Verifique seu CPF e tente novamente.');
            setTipoMensagem('erro');
            await registrarLog("ERRO NA GERAÇÃO", `Falha ao tentar gerar pagamento via ${metodo.toUpperCase()} para o plano ${planoSelecionado.nome}.`);
        }
    } catch (erro) {
        setMensagem('⚠️ Falha de comunicação com o servidor bancário.');
        setTipoMensagem('erro');
    } finally {
        setCarregandoAlternativo(false);
    }
  };

  const handleCopiarPix = () => {
    if (dadosPix?.copiaECola) {
      navigator.clipboard.writeText(dadosPix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #090d16 0%, #0f172a 40%, #1e293b 100%)',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: '#ffffff',
      paddingBottom: '60px',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      
      {/* GLOW DOURADO DE LUXO DE FUNDO */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '700px',
        height: '450px',
        background: 'radial-gradient(circle, rgba(245, 208, 97, 0.22) 0%, rgba(197, 160, 89, 0.08) 45%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }}></div>

      {/* HEADER TOP BAR DOURADA */}
      <header style={{
        padding: '18px 40px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '2px solid rgba(197, 160, 89, 0.4)',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        marginBottom: '35px',
        flexWrap: 'wrap',
        gap: '15px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        zIndex: 10
      }}>
        <button 
          onClick={handleVoltar}
          style={{ 
            background: 'linear-gradient(135deg, rgba(197, 160, 89, 0.15) 0%, rgba(197, 160, 89, 0.05) 100%)', 
            border: '1px solid rgba(197, 160, 89, 0.4)', 
            color: '#f5d061', 
            cursor: 'pointer', 
            fontSize: '13.5px', 
            fontWeight: '800', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(197, 160, 89, 0.1)'
          }}
        >
          <i className="fas fa-arrow-left"></i> Voltar
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <i className="fas fa-crown" style={{ color: '#f5d061', fontSize: '20px' }}></i>
          <h1 style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '2px', color: '#ffffff', margin: 0 }}>
            CELEBRE
          </h1>
          <span style={{ height: '20px', width: '1px', background: 'rgba(197, 160, 89, 0.4)' }}></span>
          <span style={{
            fontSize: '12px',
            background: 'linear-gradient(135deg, #f5d061, #c5a059)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '900',
            letterSpacing: '1px'
          }}>
            CHECKOUT VIP PREMIER
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#34d399', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <i className="fas fa-shield-alt"></i> AMBIENTE 100% SEGURO SSL
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <div style={{ maxWidth: '1150px', margin: '0 auto', padding: '0 20px', position: 'relative', zIndex: 1 }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '32px', alignItems: 'start' }}>
          
          {/* LADO ESQUERDO: CARD VIP COM MUITO DOURADO E TODAS AS FUNCIONALIDADES */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #172036 50%, #0f172a 100%)',
            border: '2px solid #c5a059',
            borderRadius: '24px',
            padding: '36px',
            boxShadow: '0 20px 50px rgba(197, 160, 89, 0.2), 0 10px 30px rgba(0,0,0,0.5)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            
            {/* Faixa Dourada Metalizada no Canto */}
            <div style={{
              position: 'absolute',
              top: '22px',
              right: '-35px',
              background: 'linear-gradient(135deg, #ffe58f 0%, #f5d061 50%, #c5a059 100%)',
              color: '#0f172a',
              fontSize: '11px',
              fontWeight: '900',
              padding: '6px 42px',
              transform: 'rotate(45deg)',
              letterSpacing: '1px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <i className="fas fa-crown" style={{ fontSize: '10px' }}></i> PLANO ATIVO
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <i className="fas fa-star" style={{ color: '#f5d061', fontSize: '14px' }}></i>
              <span style={{
                fontSize: '11.5px',
                fontWeight: '900',
                letterSpacing: '1.5px',
                color: '#f5d061',
                textTransform: 'uppercase'
              }}>
                ASSINATURA PREMIUM CELEBRE
              </span>
            </div>

            <h2 style={{ fontSize: '34px', fontWeight: '900', margin: '0 0 12px 0', color: '#ffffff', letterSpacing: '-0.5px' }}>
              {planoSelecionado.nome}
            </h2>

            {/* PREÇO COM BRILHO DOURADO */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              margin: '20px 0 24px 0',
              padding: '18px 20px',
              background: 'linear-gradient(135deg, rgba(197, 160, 89, 0.14) 0%, rgba(245, 208, 97, 0.05) 100%)',
              borderRadius: '14px',
              border: '1.5px solid rgba(197, 160, 89, 0.4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '18px', color: '#f5d061', fontWeight: '800' }}>R$</span>
                <span style={{
                  fontSize: '44px',
                  fontWeight: '900',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f5d061 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-1px'
                }}>
                  {planoSelecionado.preco}
                </span>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: '600' }}>
                  {planoSelecionado.id?.includes('anual') ? '/ano (À vista)' : '/mês'}
                </span>
              </div>

              {planoSelecionado.id?.includes('anual') ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <div style={{ fontSize: '13px', color: '#f5d061', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fas fa-tag"></i> Equivalente a R$ 79,90/mês (2 Meses Grátis)
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fas fa-credit-card"></i> Parcelamento em até 12x no cartão via Mercado Pago
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#34d399', fontWeight: '700', marginTop: '2px' }}>
                  ✓ Assinatura Mensal sem fidelidade
                </div>
              )}
            </div>

            <div style={{
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <i className="fas fa-check-double" style={{ color: '#34d399', fontSize: '16px' }}></i>
              <span style={{ fontSize: '12.5px', color: '#34d399', fontWeight: '700' }}>
                7 Dias de Garantia Incondicional • Cancele quando quiser
              </span>
            </div>

            <h4 style={{
              fontSize: '13px',
              fontWeight: '900',
              textTransform: 'uppercase',
              color: '#f5d061',
              letterSpacing: '1px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fas fa-gem" style={{ color: '#f5d061' }}></i> TUDO O QUE VOCÊ RECEBE:
            </h4>

            {/* LISTA COMPLETA E IMPRESSIONANTE DE 9 RECURSOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {listaRecursosVip.map((rec, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #f5d061 0%, #c5a059 100%)',
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '800',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(197, 160, 89, 0.3)',
                    lineHeight: 1
                  }}>
                    <i className={rec.icon} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', margin: 0, padding: 0, lineHeight: 1, textAlign: 'center' }}></i>
                  </div>
                  <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '700', lineHeight: '1.3' }}>
                    {rec.title}
                  </span>
                </div>
              ))}
            </div>

            {/* CARD DE PROVA SOCIAL E GARANTIA */}
            <div style={{
              marginTop: '30px',
              padding: '16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(197, 160, 89, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(197, 160, 89, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ color: '#f5d061', fontSize: '14px', marginBottom: '4px' }}>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <strong style={{ fontSize: '12.5px', color: '#ffffff', display: 'block' }}>
                Utilizado e aprovado por + de 1.500 Empresas de Eventos
              </strong>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Tecnologia de ponta e suporte dedicado</span>
            </div>

            <hr style={{ borderColor: 'rgba(197, 160, 89, 0.2)', margin: '25px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.8 }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Pagamento Processado com Segurança:</span>
              <div style={{ display: 'flex', gap: '12px', fontSize: '20px', color: '#f5d061' }}>
                <i className="fab fa-cc-visa"></i>
                <i className="fab fa-cc-mastercard"></i>
                <i className="fab fa-pix"></i>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: SELETOR DE MÉTODOS E CHECKOUT MERCADO PAGO */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '36px',
            color: '#0f172a',
            boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.4)',
            border: '2px solid #e2e8f0'
          }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <i className="fas fa-lock" style={{ color: '#c5a059', fontSize: '18px' }}></i>
              <h3 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                Finalizar Pagamento
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 24px 0' }}>
              Escolha abaixo seu método de preferência para ativação imediata.
            </p>

            {/* NAV TABS PILLS ELEGANTES */}
            <div style={{
              display: 'flex',
              gap: '6px',
              background: '#f1f5f9',
              padding: '6px',
              borderRadius: '14px',
              marginBottom: '26px'
            }}>
              <button 
                type="button"
                onClick={() => setMetodoAtivo('cartao')} 
                style={{
                  flex: 1,
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  transition: 'all 0.2s ease',
                  backgroundColor: metodoAtivo === 'cartao' ? '#0f172a' : 'transparent',
                  color: metodoAtivo === 'cartao' ? '#ffffff' : '#64748b',
                  boxShadow: metodoAtivo === 'cartao' ? '0 4px 14px rgba(15, 23, 42, 0.2)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  gap: '8px'
                }}
              >
                <i className="fas fa-credit-card" style={{ color: metodoAtivo === 'cartao' ? '#f5d061' : 'inherit' }}></i> Cartão
              </button>

              <button 
                type="button"
                onClick={() => setMetodoAtivo('pix')} 
                style={{
                  flex: 1,
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  transition: 'all 0.2s ease',
                  backgroundColor: metodoAtivo === 'pix' ? '#0f172a' : 'transparent',
                  color: metodoAtivo === 'pix' ? '#ffffff' : '#64748b',
                  boxShadow: metodoAtivo === 'pix' ? '0 4px 14px rgba(15, 23, 42, 0.2)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  gap: '8px'
                }}
              >
                <i className="fab fa-pix" style={{ color: metodoAtivo === 'pix' ? '#32bcad' : 'inherit' }}></i> PIX
              </button>

              <button 
                type="button"
                onClick={() => setMetodoAtivo('boleto')} 
                style={{
                  flex: 1,
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  transition: 'all 0.2s ease',
                  backgroundColor: metodoAtivo === 'boleto' ? '#0f172a' : 'transparent',
                  color: metodoAtivo === 'boleto' ? '#ffffff' : '#64748b',
                  boxShadow: metodoAtivo === 'boleto' ? '0 4px 14px rgba(15, 23, 42, 0.2)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  gap: '8px'
                }}
              >
                <i className="fas fa-barcode"></i> Boleto
              </button>
            </div>

            {/* ALERTAS DE MENSAGEM */}
            {mensagem && (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '24px',
                fontWeight: '700',
                fontSize: '14px',
                lineHeight: '1.4',
                background: tipoMensagem === 'sucesso' ? '#dcfce7' : (tipoMensagem === 'erro' ? '#ffe4e6' : '#e0f2fe'),
                color: tipoMensagem === 'sucesso' ? '#15803d' : (tipoMensagem === 'erro' ? '#be123c' : '#0369a1'),
                border: `1px solid ${tipoMensagem === 'sucesso' ? '#bbf7d0' : (tipoMensagem === 'erro' ? '#fecdd3' : '#bae6fd')}`
              }}>
                {mensagem}
              </div>
            )}

            {/* CONTEÚDO DA ABA CARTÃO */}
            {metodoAtivo === 'cartao' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fas fa-shield-alt" style={{ color: '#10b981' }}></i> Transação segura processada diretamente pelo Mercado Pago.
                  </span>
                </div>

                <Payment initialization={initialization} customization={customization} onSubmit={onSubmit} />
              </div>
            )}

            {/* CONTEÚDO DA ABA PIX */}
            {metodoAtivo === 'pix' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                {!dadosPix ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', color: '#475569', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                        CPF do Titular (Obrigatório para emissão de comprovante bancário)
                      </label>
                      <input 
                        type="text" 
                        placeholder="000.000.000-00" 
                        value={cpfCliente} 
                        onChange={(e) => setCpfCliente(e.target.value)} 
                        maxLength="14" 
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '15px',
                          boxSizing: 'border-box',
                          fontFamily: 'monospace',
                          fontWeight: '700'
                        }} 
                      />
                    </div>

                    <button 
                      type="button"
                      onClick={() => gerarPagamentoAlternativo('pix')} 
                      disabled={carregandoAlternativo} 
                      style={{
                        background: 'linear-gradient(135deg, #00bdae 0%, #009385 100%)',
                        color: '#ffffff',
                        padding: '16px',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: '800',
                        fontSize: '15px',
                        width: '100%',
                        cursor: carregandoAlternativo ? 'not-allowed' : 'pointer',
                        opacity: carregandoAlternativo ? 0.7 : 1,
                        boxShadow: '0 4px 14px rgba(0, 189, 174, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        gap: '8px'
                      }}
                    >
                      {carregandoAlternativo ? (
                        <><i className="fas fa-spinner fa-spin"></i> Gerando QR Code...</>
                      ) : (
                        <><i className="fab fa-pix"></i> Gerar QR Code PIX Instantâneo</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '10px' }}>
                    <div style={{
                      width: '210px',
                      height: '210px',
                      background: '#ffffff',
                      margin: '0 auto 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'center',
                      borderRadius: '16px',
                      border: '2px solid #cbd5e1',
                      padding: '10px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                      <img src={`data:image/jpeg;base64,${dadosPix.qrCodeBase64}`} alt="QR Code PIX" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
                    </div>

                    <p style={{ fontSize: '13.5px', color: '#475569', fontWeight: '600', marginBottom: '16px' }}>
                      Abra o app do seu banco, escolha Pix Copia e Cola ou escaneie a imagem acima.
                    </p>

                    <button 
                      type="button"
                      onClick={handleCopiarPix} 
                      style={{
                        background: copiado ? '#10b981' : '#0f172a',
                        color: '#ffffff',
                        padding: '14px 24px',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        fontSize: '14px',
                        width: '100%',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        gap: '8px'
                      }}
                    >
                      {copiado ? (
                        <><i className="fas fa-check"></i> Código PIX Copiado!</>
                      ) : (
                        <><i className="far fa-copy"></i> Copiar Código PIX Copia e Cola</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO DA ABA BOLETO */}
            {metodoAtivo === 'boleto' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                {!dadosBoleto ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', color: '#475569', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                        CPF para registro do Boleto Bancário
                      </label>
                      <input 
                        type="text" 
                        placeholder="000.000.000-00" 
                        value={cpfCliente} 
                        onChange={(e) => setCpfCliente(e.target.value)} 
                        maxLength="14" 
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '15px',
                          boxSizing: 'border-box',
                          fontFamily: 'monospace',
                          fontWeight: '700'
                        }} 
                      />
                    </div>

                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.4 }}>
                      <i className="fas fa-info-circle" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
                      O boleto possui prazo de compensação bancária de até 3 dias úteis.
                    </div>

                    <button 
                      type="button"
                      onClick={() => gerarPagamentoAlternativo('bolbradesco')} 
                      disabled={carregandoAlternativo} 
                      style={{
                        background: '#0f172a',
                        color: '#ffffff',
                        padding: '16px',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: '800',
                        fontSize: '15px',
                        width: '100%',
                        cursor: carregandoAlternativo ? 'not-allowed' : 'pointer',
                        opacity: carregandoAlternativo ? 0.7 : 1,
                        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        gap: '8px'
                      }}
                    >
                      {carregandoAlternativo ? (
                        <><i className="fas fa-spinner fa-spin"></i> Gerando Boleto...</>
                      ) : (
                        <><i className="fas fa-barcode"></i> Gerar Boleto Bancário Oficial</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '48px', color: '#10b981', marginBottom: '12px' }}>
                      <i className="fas fa-check-circle"></i>
                    </div>

                    <h4 style={{ color: '#0f172a', margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800' }}>
                      Boleto Gerado com Sucesso!
                    </h4>
                    
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: 1.4 }}>
                      Seu boleto tem vencimento em 3 dias úteis. Clique no botão abaixo para abrir ou baixar a via em PDF.
                    </p>

                    <a 
                      href={dadosBoleto.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justify: 'center',
                        gap: '8px',
                        background: '#10b981',
                        color: '#ffffff',
                        padding: '14px 24px',
                        textDecoration: 'none',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '14px',
                        width: '100%',
                        boxSizing: 'border-box',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <i className="fas fa-external-link-alt"></i> Abrir e Imprimir Boleto
                    </a>
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '28px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
              <i className="fas fa-shield-alt" style={{ marginRight: '4px', color: '#10b981' }}></i> Pagamento seguro processado via infraestrutura bancária Mercado Pago.
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Checkout;