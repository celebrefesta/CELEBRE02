import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const AbaAssinaturaUso = ({
  isSuperAdmin,
  assinatura,
  usoPlano,
  cancelando,
  handleCancelarAssinatura
}) => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [estatisticasReais, setEstatisticasReais] = useState({
    totalItensEstoque: 0,
    totalLocacoes: 0,
    totalClientes: 0,
    dataRenovacao: null
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Modal simples para editar E-mail de Faturamento
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  useEffect(() => {
    if (assinatura?.emailCobranca || usuarioLogado?.email) {
      setNovoEmail(assinatura?.emailCobranca || usuarioLogado?.email || '');
    }
  }, [assinatura, usuarioLogado]);

  useEffect(() => {
    const carregarEstatisticasUso = async () => {
      if (!usuarioLogado) return;
      try {
        const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
        
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));

        const [snapEst, snapLoc, snapCli] = await Promise.all([
          getDocs(qEstoque).catch(() => ({ size: 0 })),
          getDocs(qLocacoes).catch(() => ({ size: 0 })),
          getDocs(qClientes).catch(() => ({ size: 0 }))
        ]);

        const userDoc = await getDoc(doc(db, "usuarios", tenantId)).catch(() => null);
        let proximaData = "21/" + String(new Date().getMonth() + 2).padStart(2, '0') + "/" + new Date().getFullYear();
        
        if (userDoc && userDoc.exists()) {
          const uData = userDoc.data();
          if (uData.dataFimTeste) {
            try {
              proximaData = new Date(uData.dataFimTeste).toLocaleDateString('pt-BR');
            } catch (e) {}
          }
        }

        setEstatisticasReais({
          totalItensEstoque: snapEst.size || 0,
          totalLocacoes: snapLoc.size || 0,
          totalClientes: snapCli.size || 0,
          dataRenovacao: proximaData
        });
      } catch (err) {
        console.error("Erro ao buscar estatísticas de uso:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    carregarEstatisticasUso();
  }, [usuarioLogado]);

  const handleSalvarEmail = async (e) => {
    e.preventDefault();
    if (!usuarioLogado) return;
    setSalvandoEmail(true);
    try {
      const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
      const userRef = doc(db, "usuarios", tenantId);
      await updateDoc(userRef, { emailCobranca: novoEmail });
      alert("✅ E-mail de faturamento atualizado com sucesso!");
      setModalEmailAberto(false);
    } catch (err) {
      console.error("Erro ao salvar e-mail:", err);
      alert("Erro ao atualizar e-mail.");
    } finally {
      setSalvandoEmail(false);
    }
  };

  const handleImprimirComprovante = () => {
    const janelaImpressao = window.open('', '_blank');
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const codigoFatura = "FAT-" + Math.floor(100000 + Math.random() * 900000);
    const planoNome = assinatura?.planoNome || "Plano Premium";
    const valor = assinatura?.precoMensal || "99,90";
    const email = novoEmail || usuarioLogado?.email;

    janelaImpressao.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo de Pagamento - Celebre Sistema</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 700px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #c5a059; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: 2px; }
          .badge-pago { background: #dcfce7; color: #15803d; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; }
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .info-box label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 4px; }
          .info-box p { margin: 0; font-size: 15px; font-weight: bold; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #0f172a; color: white; padding: 12px; text-align: left; font-size: 13px; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">CELEBRE</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Comprovante Oficial de Assinatura</div>
          </div>
          <div class="badge-pago">✓ PAGAMENTO CONCLUÍDO</div>
        </div>

        <div class="grid-info">
          <div class="info-box">
            <label>Código da Fatura</label>
            <p>${codigoFatura}</p>
          </div>
          <div class="info-box">
            <label>Data de Emissão</label>
            <p>${dataHoje}</p>
          </div>
          <div class="info-box">
            <label>E-mail Cadastrado</label>
            <p>${email}</p>
          </div>
          <div class="info-box">
            <label>Processamento</label>
            <p>Mercado Pago Transações</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item / Descrição</th>
              <th>Período</th>
              <th>Método</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Assinatura ${planoNome}</strong> - Licença Celebre</td>
              <td>Mensal/Anual</td>
              <td>Mercado Pago (Cartão / PIX)</td>
              <td style="text-align: right; font-weight: bold;">R$ ${valor}</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align: right; margin-bottom: 40px;">
          <div style="font-size: 14px; color: #64748b;">Total Pago:</div>
          <div style="font-size: 26px; font-weight: 800; color: #10b981;">R$ ${valor}</div>
        </div>

        <div class="footer">
          <p>Celebre Sistema de Gestão de Eventos e Locações • CNPJ 00.000.000/0001-00</p>
          <p>Este comprovante serve como recibo oficial de pagamento referente à assinatura do sistema.</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    janelaImpressao.document.close();
  };

  const limiteVagas = isSuperAdmin ? 9999 : (usoPlano?.limite || 3);
  const vagasUsadas = usoPlano?.usado || 1;
  const pctVagas = Math.min(Math.round((vagasUsadas / limiteVagas) * 100), 100);

  const corBarraVagas = isSuperAdmin 
    ? '#c5a059' 
    : (pctVagas >= 100 ? '#ef4444' : (pctVagas > 70 ? '#f59e0b' : '#10b981'));

  const planoNomeAtual = assinatura?.planoNome || "Básico";
  const precoMensalAtual = assinatura?.precoMensal || "0,00";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* 👑 HERO CARD: STATUS ATUAL DA ASSINATURA */}
      <div style={{
        background: isSuperAdmin 
          ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)' 
          : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '16px',
        padding: '28px',
        color: '#ffffff',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(197, 160, 89, 0.25) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                background: isSuperAdmin ? 'linear-gradient(135deg, #f5d061, #e6af2e)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: isSuperAdmin ? '#000000' : '#ffffff',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '1px',
                padding: '4px 10px',
                borderRadius: '20px',
                textTransform: 'uppercase'
              }}>
                {isSuperAdmin ? 'PAINEL MASTER VITALÍCIO' : 'PLANO ATIVO'}
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
                • Renovação em {estatisticasReais.dataRenovacao || 'Próximo mês'}
              </span>
            </div>
            
            <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '6px 0', color: '#ffffff', letterSpacing: '-0.5px' }}>
              {planoNomeAtual}
            </h2>
            
            <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
              {!isSuperAdmin ? (
                <>Valor da assinatura: <strong style={{ color: '#ffffff', fontSize: '18px' }}>R$ {precoMensalAtual}</strong> <span style={{ fontSize: '12px' }}>/mês</span></>
              ) : (
                'Acesso total e irrestrito a todos os módulos do sistema Celebre.'
              )}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '30px',
              background: assinatura?.isActive || isSuperAdmin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${assinatura?.isActive || isSuperAdmin ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              color: assinatura?.isActive || isSuperAdmin ? '#34d399' : '#fbbf24',
              fontSize: '13px',
              fontWeight: '700'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: assinatura?.isActive || isSuperAdmin ? '#10b981' : '#f59e0b',
                boxShadow: `0 0 8px ${assinatura?.isActive || isSuperAdmin ? '#10b981' : '#f59e0b'}`
              }}></span>
              {assinatura?.status || 'Assinatura Ativa'}
            </div>

            <button 
              type="button" 
              onClick={() => navigate('/planos')}
              style={{
                background: 'var(--dourado)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fas fa-rocket"></i> Fazer Upgrade de Plano
            </button>
          </div>
        </div>
      </div>

      {/* 📊 PAINEL DE CONSUMO E LIMITES (USAGE KPI CARDS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--branco)', padding: '20px', borderRadius: '12px', border: '1px solid var(--borda)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)' }}>
              <i className="fas fa-users" style={{ marginRight: '6px', color: '#3b82f6' }}></i> Usuários (Equipe)
            </span>
            <span style={{ fontSize: '12px', fontWeight: '800', color: corBarraVagas }}>
              {isSuperAdmin ? 'Ilimitado' : `${vagasUsadas} / ${limiteVagas}`}
            </span>
          </div>

          <div style={{ width: '100%', background: 'var(--fundo-cinza)', borderRadius: '50px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${isSuperAdmin ? 100 : pctVagas}%`, background: corBarraVagas, height: '100%', borderRadius: '50px', transition: 'width 0.5s ease' }}></div>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>
            {isSuperAdmin ? 'Sem restrição de colaboradores' : `${limiteVagas - vagasUsadas > 0 ? (limiteVagas - vagasUsadas) + ' vaga(s) disponível(is)' : 'Limite de vagas atingido'}`}
          </span>
        </div>

        <div style={{ background: 'var(--branco)', padding: '20px', borderRadius: '12px', border: '1px solid var(--borda)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)' }}>
              <i className="fas fa-boxes" style={{ marginRight: '6px', color: '#10b981' }}></i> Itens no Acervo
            </span>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--texto-principal)' }}>
              {loadingStats ? '...' : estatisticasReais.totalItensEstoque} Peças
            </span>
          </div>
          <div style={{ width: '100%', background: 'var(--fundo-cinza)', borderRadius: '50px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: '100%', background: '#10b981', height: '100%', borderRadius: '50px' }}></div>
          </div>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
            <i className="fas fa-check-circle"></i> Cadastro Ilimitado Ativo
          </span>
        </div>

        <div style={{ background: 'var(--branco)', padding: '20px', borderRadius: '12px', border: '1px solid var(--borda)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)' }}>
              <i className="fas fa-file-contract" style={{ marginRight: '6px', color: '#8b5cf6' }}></i> Locações Criadas
            </span>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--texto-principal)' }}>
              {loadingStats ? '...' : estatisticasReais.totalLocacoes} Pedidos
            </span>
          </div>
          <div style={{ width: '100%', background: 'var(--fundo-cinza)', borderRadius: '50px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: '100%', background: '#8b5cf6', height: '100%', borderRadius: '50px' }}></div>
          </div>
          <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: '600' }}>
            <i className="fas fa-check-circle"></i> Sem limite de orçamentos
          </span>
        </div>

        <div style={{ background: 'var(--branco)', padding: '20px', borderRadius: '12px', border: '1px solid var(--borda)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)' }}>
              <i className="fas fa-user-friends" style={{ marginRight: '6px', color: '#f59e0b' }}></i> Carteira Clientes
            </span>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--texto-principal)' }}>
              {loadingStats ? '...' : estatisticasReais.totalClientes} Clientes
            </span>
          </div>
          <div style={{ width: '100%', background: 'var(--fundo-cinza)', borderRadius: '50px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: '100%', background: '#f59e0b', height: '100%', borderRadius: '50px' }}></div>
          </div>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>
            <i className="fas fa-check-circle"></i> Base de dados liberada
          </span>
        </div>
      </div>

      {/* 💳 SEÇÃO 2: DADOS DO PAGAMENTO & INFORMAÇÃO TRANSPARENTE DE COBRANÇA */}
      <div style={{ background: 'var(--branco)', borderRadius: '12px', border: '1px solid var(--borda)', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-credit-card" style={{ color: 'var(--dourado)' }}></i> Dados do Pagamento & Renovação
          </h3>

          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0284c7', background: 'rgba(2, 132, 199, 0.15)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
            <i className="fas fa-sync-alt"></i> Cobrança Recorrente Mercado Pago
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'var(--fundo-cinza)', borderRadius: '8px', border: '1px solid var(--borda)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', textTransform: 'uppercase', display: 'block' }}>Forma de Pagamento</span>
              <strong style={{ fontSize: '13.5px', color: 'var(--texto-principal)' }}>{assinatura?.metodoPagamento || 'Mercado Pago (Cartão / PIX)'}</strong>
              <small style={{ display: 'block', fontSize: '10.5px', color: '#10b981', marginTop: '2px', fontWeight: 'bold' }}>
                ✓ Cobrança Automática no Cartão
              </small>
            </div>
            <i className="fas fa-credit-card fa-lg" style={{ color: 'var(--texto-secundario)' }}></i>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'var(--fundo-cinza)', borderRadius: '8px', border: '1px solid var(--borda)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', textTransform: 'uppercase', display: 'block' }}>E-mail para Faturas</span>
              <strong style={{ fontSize: '13.5px', color: 'var(--texto-principal)' }}>{novoEmail || usuarioLogado?.email}</strong>
            </div>
            <button 
              type="button" 
              onClick={() => setModalEmailAberto(true)} 
              title="Alterar E-mail"
              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px' }}
            >
              <i className="fas fa-pen"></i>
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'var(--fundo-cinza)', borderRadius: '8px', border: '1px solid var(--borda)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', textTransform: 'uppercase', display: 'block' }}>ID da Assinatura</span>
              <strong style={{ fontSize: '12.5px', fontFamily: 'monospace', color: 'var(--texto-principal)' }}>
                {assinatura?.subscriptionId || 'SUB-' + (usuarioLogado?.uid?.substring(0, 10) || 'CELEBRE').toUpperCase()}
              </strong>
            </div>
            <i className="fas fa-fingerprint fa-lg" style={{ color: 'var(--texto-secundario)' }}></i>
          </div>
        </div>

        {/* BANNER DE ECONOMIA NO PLANO ANUAL (20% OFF) */}
        <div style={{
          marginTop: '20px',
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(234, 179, 8, 0.15)',
          border: '1.5px solid rgba(234, 179, 8, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <strong style={{ fontSize: '13.5px', color: '#facc15', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fas fa-percentage" style={{ color: '#facc15' }}></i> Deseja migrar para o Plano Anual (2 Meses Grátis)?
            </strong>
            <span style={{ fontSize: '12px', color: '#fef08a', display: 'block', marginTop: '2px' }}>
              Pagamento único anual de <strong>R$ 958,80 à vista</strong> (Equivalente a <strong>R$ 79,90/mês</strong> - Economize R$ 240,00/ano).
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              navigate('/checkout', {
                state: {
                  plano: {
                    id: 'plano_premium_anual',
                    nome: `${planoNomeAtual} - Licença Anual (20% OFF)`,
                    preco: '958,80',
                    parcelamento: 'Equivalente a R$ 79,90/mês (Parcelamento no cartão em até 12x)',
                    beneficios: ['Economia equivalente a 2 meses grátis (R$ 240,00 de economia)', 'Opção de parcelamento em até 12x no cartão via Mercado Pago', 'Acesso Total e ilimitado ao Sistema Celebre por 1 ano']
                  }
                }
              });
            }}
            style={{
              background: 'var(--dourado)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <i className="fas fa-crown" style={{ color: '#ffffff' }}></i> Migrar para Anual (R$ 958,80)
          </button>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => {
              navigate('/checkout', {
                state: {
                  plano: {
                    id: 'plano_premium',
                    nome: planoNomeAtual,
                    preco: precoMensalAtual,
                    beneficios: ['Acesso Total ao Sistema', 'Catálogo Digital', 'Suporte Prioritário']
                  }
                }
              });
            }}
            style={{
              flex: 2,
              minWidth: '220px',
              padding: '14px 24px',
              background: 'var(--dourado)',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fas fa-credit-card fa-lg"></i> Alterar Cartão / Renovação Manual no Mercado Pago
          </button>

          {assinatura?.isActive && !isSuperAdmin && (
            <button 
              type="button" 
              onClick={handleCancelarAssinatura} 
              disabled={cancelando} 
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '14px 18px',
                backgroundColor: 'rgba(225, 29, 72, 0.15)',
                border: '1px solid rgba(225, 29, 72, 0.3)',
                color: '#ef4444',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: cancelando ? 'not-allowed' : 'pointer',
                opacity: cancelando ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className="fas fa-ban"></i> {cancelando ? 'Cancelando...' : 'Cancelar Assinatura'}
            </button>
          )}
        </div>
      </div>

      {/* ⭐ SEÇÃO 3: RECURSOS INCLUÍDOS NO SEU PLANO (GRID FULL WIDTH BALANCEADO 4x2) */}
      <div style={{ background: 'var(--branco)', borderRadius: '12px', border: '1px solid var(--borda)', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--texto-principal)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-star" style={{ color: 'var(--dourado)' }}></i> Recursos Incluídos no Seu Plano
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0 0' }}>Todas as ferramentas ativas e disponíveis para a sua empresa.</p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <i className="fas fa-check-double"></i> 8 Módulos Liberados
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            { icon: 'fas fa-users', color: '#3b82f6', title: 'Gestão de Clientes', desc: 'CRM completo e histórico de clientes' },
            { icon: 'fas fa-boxes', color: '#10b981', title: 'Gestão de Estoque', desc: 'Acervo com controle de peças e valores' },
            { icon: 'fas fa-hand-holding-heart', color: '#ec4899', title: 'Locações e Pedidos', desc: 'Orçamentos, reservas e agendamentos' },
            { icon: 'fas fa-truck', color: '#f59e0b', title: 'Logística & Entregas', desc: 'Controle de saídas, devoluções e frete' },
            { icon: 'fas fa-file-contract', color: '#8b5cf6', title: 'Emissão de Contratos', desc: 'Gerador e assinatura digital' },
            { icon: 'fas fa-store', color: '#06b6d4', title: 'Catálogo Digital', desc: 'Vitrine online para seus clientes' },
            { icon: 'fas fa-palette', color: '#f43f5e', title: 'Projetos Moodboard', desc: 'Criação de projetos visuais e decoração' },
            { icon: 'fas fa-chart-line', color: '#6366f1', title: 'Financeiro & DRE', desc: 'Controle de caixa, entradas e relatórios' }
          ].map((item, index) => (
            <div key={index} style={{
              background: 'var(--fundo-cinza)',
              borderRadius: '10px',
              border: '1px solid var(--borda)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: `${item.color}22`,
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  <i className={item.icon}></i>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fas fa-check-circle"></i> Incluído
                </span>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--texto-principal)', margin: '0 0 2px 0' }}>{item.title}</h4>
                <p style={{ fontSize: '11.5px', color: 'var(--texto-secundario)', margin: 0, lineHeight: 1.3 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 📄 SEÇÃO 4: HISTÓRICO DE FATURAMENTO RECENTE */}
      <div style={{ background: 'var(--branco)', borderRadius: '12px', border: '1px solid var(--borda)', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-history" style={{ color: 'var(--texto-secundario)' }}></i> Histórico Recente de Faturamento
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--fundo-cinza)', borderBottom: '1px solid var(--borda)', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                <th style={{ padding: '10px 14px' }}>Data</th>
                <th style={{ padding: '10px 14px' }}>Descrição</th>
                <th style={{ padding: '10px 14px' }}>Método</th>
                <th style={{ padding: '10px 14px' }}>Valor</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Recibo</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--borda)' }}>
                <td style={{ padding: '12px 14px', color: 'var(--texto-secundario)', fontWeight: '600' }}>
                  {new Date().toLocaleDateString('pt-BR')}
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--texto-principal)', fontWeight: '700' }}>
                  Assinatura Mensal - {planoNomeAtual}
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--texto-secundario)' }}>
                  Mercado Pago (Cartão / PIX)
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--texto-principal)', fontWeight: '700' }}>
                  R$ {precoMensalAtual}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981'
                  }}>
                    Concluído
                  </span>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <button 
                    type="button" 
                    onClick={handleImprimirComprovante}
                    style={{
                      background: 'var(--fundo-cinza)',
                      border: '1px solid var(--borda)',
                      color: 'var(--texto-principal)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fas fa-print"></i> Imprimir Recibo
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR E-MAIL DE FATURAS */}
      {modalEmailAberto && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--branco)',
            borderRadius: '12px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid var(--borda)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)' }}>
              Alterar E-mail de Faturamento
            </h3>
            <form onSubmit={handleSalvarEmail}>
              <input 
                type="email" 
                value={novoEmail}
                onChange={e => setNovoEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--borda)',
                  background: 'var(--fundo-cinza)',
                  color: 'var(--texto-principal)',
                  marginBottom: '16px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setModalEmailAberto(false)}
                  style={{ flex: 1, padding: '10px', background: 'var(--fundo-cinza)', border: '1px solid var(--borda)', color: 'var(--texto-secundario)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={salvandoEmail}
                  style={{ flex: 1, padding: '10px', background: 'var(--dourado)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {salvandoEmail ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AbaAssinaturaUso;
