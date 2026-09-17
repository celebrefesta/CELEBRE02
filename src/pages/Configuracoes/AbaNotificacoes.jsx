import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { 
  GATILHOS_PADRAO, 
  enviarDisparoTeste 
} from '../../utils/notificacoesDispatchService';
import './Configuracoes.css';

// Lista de Alertas que o GESTOR/EQUIPE recebe
const ALERTAS_GESTOR_PADRAO = [
  {
    id: 'novo_orcamento_web',
    titulo: 'Novo Orçamento Recebido pela Vitrine',
    descricao: 'Avisa a equipe assim que um cliente monta e envia um carrinho no catálogo digital.',
    icone: 'fa-cart-shopping',
    cor: '#3b82f6',
    canais: { sininho: true, whatsapp: true, email: true }
  },
  {
    id: 'novo_cadastro_cliente',
    titulo: 'Novo Cadastro de Cliente (Aprovação)',
    descricao: 'Avisa quando um novo cliente faz cadastro completo na vitrine e aguarda liberação.',
    icone: 'fa-user-plus',
    cor: '#f97316',
    canais: { sininho: true, whatsapp: true, email: true }
  },
  {
    id: 'contrato_assinado',
    titulo: 'Contrato Assinado pelo Cliente',
    descricao: 'Notifica imediatamente quando o cliente conclui a assinatura digital no celular.',
    icone: 'fa-file-signature',
    cor: '#10b981',
    canais: { sininho: true, whatsapp: true, email: true }
  },
  {
    id: 'devolucoes_hoje',
    titulo: 'Resumo Matinal de Devoluções do Dia',
    descricao: 'Relação de todas as locações previstas para retornar ao galpão na data de hoje.',
    icone: 'fa-calendar-check',
    cor: '#8b5cf6',
    canais: { sininho: true, whatsapp: true, email: false }
  },
  {
    id: 'alerta_atraso_gestor',
    titulo: 'Alerta Crítico de Atraso na Devolução',
    descricao: 'Dispara aviso quando o horário de devolução expirou e o material não deu entrada.',
    icone: 'fa-triangle-exclamation',
    cor: '#ef4444',
    canais: { sininho: true, whatsapp: true, email: true, sms: true }
  },
  {
    id: 'avarias_checkin',
    titulo: 'Avarias ou Faltas Apuradas no Check-in',
    descricao: 'Notifica a gestão quando a equipe de galpão registra peças danificadas ou ausentes.',
    icone: 'fa-wrench',
    cor: '#eab308',
    canais: { sininho: true, whatsapp: true, email: true }
  }
];

const AbaNotificacoes = ({ tenantId, usuarioLogado, registrarLog }) => {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoFeedback, setSalvoFeedback] = useState(false);

  // Destinatários da Equipe
  const [contatosGestor, setContatosGestor] = useState({
    email: usuarioLogado?.email || '',
    whatsapp: '',
    nomeResponsavel: ''
  });

  // Preferências de Notificações para o GESTOR
  const [alertasGestor, setAlertasGestor] = useState({});

  // Preferências de Notificações enviadas ao CLIENTE
  const [alertasCliente, setAlertasCliente] = useState({});

  // Provedores de Envio (SMS Twilio / Gateway)
  const [provedores, setProvedores] = useState({
    smsAtivo: false,
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioFromNumber: ''
  });
  const [mostrarConfigSms, setMostrarConfigSms] = useState(false);

  // Painel de Teste Rápido
  const [testeCanal, setTesteCanal] = useState('whatsapp');
  const [testeDestino, setTesteDestino] = useState('');
  const [testando, setTestando] = useState(false);
  const [msgTeste, setMsgTeste] = useState(null);

  useEffect(() => {
    carregarPreferencias();
  }, [tenantId]);

  const carregarPreferencias = async () => {
    if (!tenantId) return;
    setLoading(true);

    // Estado inicial padrão para Gestor
    const initGestor = {};
    ALERTAS_GESTOR_PADRAO.forEach(a => {
      initGestor[a.id] = { ...a.canais };
    });

    // Estado inicial padrão para Clientes
    const initCliente = {};
    GATILHOS_PADRAO.forEach(g => {
      initCliente[g.id] = { ...g.canais };
    });

    try {
      let data = null;

      // 1. Tenta carregar prioritariamente de configuracoes_empresa (permissão garantida)
      try {
        const empSnap = await getDoc(doc(db, 'configuracoes_empresa', tenantId));
        if (empSnap.exists() && empSnap.data().configuracoesNotificacoes) {
          data = empSnap.data().configuracoesNotificacoes;
        }
      } catch (errEmp) {
        console.warn('Aviso ao consultar configuracoes_empresa:', errEmp);
      }

      // 2. Se não encontrou em configuracoes_empresa, tenta configuracoes_notificacoes
      if (!data) {
        try {
          const docRef = doc(db, 'configuracoes_notificacoes', tenantId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            data = snap.data();
          }
        } catch (errNoti) {
          // Ignora silenciosamente se o Firestore rules barrar a coleção dedicada
        }
      }

      if (data) {
        setContatosGestor({
          email: data.contatosGestor?.email || usuarioLogado?.email || '',
          whatsapp: data.contatosGestor?.whatsapp || '',
          nomeResponsavel: data.contatosGestor?.nomeResponsavel || ''
        });
        setAlertasGestor({ ...initGestor, ...(data.alertasGestor || {}) });
        setAlertasCliente({ ...initCliente, ...(data.gatilhos || {}) });
        if (data.provedores) {
          setProvedores({
            smsAtivo: !!data.provedores.smsAtivo,
            twilioAccountSid: data.provedores.twilioAccountSid || '',
            twilioAuthToken: data.provedores.twilioAuthToken || '',
            twilioFromNumber: data.provedores.twilioFromNumber || ''
          });
        }
        setTesteDestino(data.contatosGestor?.whatsapp || data.contatosGestor?.email || '');
      } else {
        setContatosGestor(prev => ({
          ...prev,
          email: prev.email || usuarioLogado?.email || ''
        }));
        setAlertasGestor(initGestor);
        setAlertasCliente(initCliente);
      }
    } catch (e) {
      console.warn('Aviso ao carregar preferências de notificação:', e);
      setAlertasGestor(initGestor);
      setAlertasCliente(initCliente);
    } finally {
      setLoading(false);
    }
  };

  const toggleAlertaGestor = (alertaId, canal) => {
    setAlertasGestor(prev => {
      const canalAtual = prev[alertaId] || {};
      return {
        ...prev,
        [alertaId]: {
          ...canalAtual,
          [canal]: !canalAtual[canal]
        }
      };
    });
  };

  const toggleAlertaCliente = (gatilhoId, canal) => {
    setAlertasCliente(prev => {
      const canalAtual = prev[gatilhoId] || {};
      return {
        ...prev,
        [gatilhoId]: {
          ...canalAtual,
          [canal]: !canalAtual[canal]
        }
      };
    });
  };

  const handleSalvar = async () => {
    if (!tenantId) return;
    setSalvando(true);
    try {
      const dadosParaSalvar = {
        tenantId,
        contatosGestor,
        alertasGestor,
        gatilhos: alertasCliente,
        provedores,
        atualizadoEm: new Date().toISOString()
      };

      // 1. Salva prioritariamente em configuracoes_empresa (100% liberado)
      await setDoc(doc(db, 'configuracoes_empresa', tenantId), {
        configuracoesNotificacoes: dadosParaSalvar
      }, { merge: true });

      // 2. Tenta em segundo plano em configuracoes_notificacoes
      try {
        await setDoc(doc(db, 'configuracoes_notificacoes', tenantId), dadosParaSalvar, { merge: true });
      } catch (eNoti) {
        // Ignora silenciosamente caso regras na nuvem ainda não tenham sido deployadas
      }

      if (registrarLog) {
        await registrarLog("CONFIGURAÇÃO DE NOTIFICAÇÕES", "Atualizou as preferências de envio e recepção de notificações.");
      }

      setSalvoFeedback(true);
      setTimeout(() => setSalvoFeedback(false), 3000);
    } catch (e) {
      console.error('Erro ao salvar preferências de notificações:', e);
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleDispararTeste = async () => {
    const destino = testeDestino.trim() || (testeCanal === 'email' ? contatosGestor.email : contatosGestor.whatsapp);
    if (!destino) {
      alert(`Por favor, informe o ${testeCanal === 'email' ? 'e-mail' : 'WhatsApp'} para o teste.`);
      return;
    }

    setTestando(true);
    setMsgTeste(null);
    try {
      await enviarDisparoTeste({
        canal: testeCanal,
        contato: destino,
        tenantId,
        dadosEmpresa: {
          nomeEmpresa: localStorage.getItem('nomeEmpresa') || 'Celebre Festas',
          telefone: contatosGestor.whatsapp,
          provedores
        }
      });
      setMsgTeste({ tipo: 'sucesso', texto: `✓ Teste disparado com sucesso via ${testeCanal.toUpperCase()}!` });
    } catch (err) {
      setMsgTeste({ tipo: 'erro', texto: `Erro no teste: ${err.message}` });
    } finally {
      setTestando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '28px', color: 'var(--dourado)', marginBottom: '12px' }}></i>
        <p>Carregando gerenciador de notificações...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* CABEÇALHO DO GERENCIADOR */}
      <div style={{
        background: 'var(--branco)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--borda)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'rgba(197, 160, 89, 0.15)',
            color: 'var(--dourado)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            <i className="fas fa-bell"></i>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--texto-principal)' }}>
              Gerenciador & Preferências de Notificações
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--texto-secundario)' }}>
              Defina com precisão quais eventos você quer que o sistema notifique e por quais canais (WhatsApp, E-mail, SMS ou Sininho).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando}
          style={{
            background: 'var(--dourado)',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(197, 160, 89, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <i className={`fas ${salvando ? 'fa-spinner fa-spin' : (salvoFeedback ? 'fa-check' : 'fa-save')}`}></i>
          {salvoFeedback ? 'PREFERÊNCIAS SALVAS!' : (salvando ? 'Salvando...' : 'Salvar Preferências')}
        </button>
      </div>

      {/* CARD 1: CANAIS DE CONTATO DA SUA EQUIPE */}
      <div style={{
        background: 'var(--branco)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--borda)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
            <i className="fas fa-address-book"></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--texto-principal)' }}>
              1. Para onde o sistema deve enviar as notificações da sua empresa?
            </h3>
            <small style={{ color: 'var(--texto-secundario)' }}>Contatos da administração/galpão que receberão os alertas operacionais.</small>
          </div>
        </div>

        <div className="notif-contacts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--texto-secundario)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
              <i className="fas fa-envelope" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
              E-mail do Gestor / Empresa:
            </label>
            <input 
              type="email"
              value={contatosGestor.email}
              onChange={(e) => setContatosGestor(prev => ({ ...prev, email: e.target.value }))}
              placeholder="empresa@exemplo.com.br"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid var(--borda)',
                background: 'var(--fundo-cinza)',
                color: 'var(--texto-principal)',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--texto-secundario)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
              <i className="fab fa-whatsapp" style={{ color: '#25d366', marginRight: '6px' }}></i>
              WhatsApp do Gestor (DDD + Número):
            </label>
            <input 
              type="text"
              value={contatosGestor.whatsapp}
              onChange={(e) => setContatosGestor(prev => ({ ...prev, whatsapp: e.target.value }))}
              placeholder="(19) 99856-4109"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid var(--borda)',
                background: 'var(--fundo-cinza)',
                color: 'var(--texto-principal)',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      </div>

      {/* CARD 2: NOTIFICAÇÕES PARA VOCÊ E SUA EQUIPE */}
      <div style={{
        background: 'var(--branco)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--borda)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
            <i className="fas fa-user-shield"></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--texto-principal)' }}>
              2. Notificações Internas para a sua Equipe
            </h3>
            <small style={{ color: 'var(--texto-secundario)' }}>
              Marque os canais onde a sua equipe quer ser avisada para cada evento interno da loja.
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ALERTAS_GESTOR_PADRAO.map(alerta => {
            const canais = alertasGestor[alerta.id] || alerta.canais;

            return (
              <div key={alerta.id} className="notif-alert-row" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '14px',
                border: '1px solid var(--borda)',
                background: 'var(--fundo-cinza)',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: `${alerta.cor}22`,
                    color: alerta.cor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    <i className={`fas ${alerta.icone}`}></i>
                  </div>
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--texto-principal)', display: 'block' }}>
                      {alerta.titulo}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                      {alerta.descricao}
                    </span>
                  </div>
                </div>

                {/* Switches de Canais */}
                <div className="notif-alert-switches" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {/* Sininho / Sistema */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    <i className="fas fa-bell" style={{ color: 'var(--cor-destaque, #c5a059)' }}></i>
                    <span>Sininho</span>
                    <input 
                      type="checkbox"
                      checked={canais.sininho !== false}
                      onChange={() => toggleAlertaGestor(alerta.id, 'sininho')}
                      style={{ accentColor: 'var(--dourado)', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  {/* WhatsApp */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    <i className="fab fa-whatsapp" style={{ color: '#25d366' }}></i>
                    <span>WhatsApp</span>
                    <input 
                      type="checkbox"
                      checked={!!canais.whatsapp}
                      onChange={() => toggleAlertaGestor(alerta.id, 'whatsapp')}
                      style={{ accentColor: '#25d366', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  {/* E-mail */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    <i className="fas fa-envelope" style={{ color: '#3b82f6' }}></i>
                    <span>E-mail</span>
                    <input 
                      type="checkbox"
                      checked={!!canais.email}
                      onChange={() => toggleAlertaGestor(alerta.id, 'email')}
                      style={{ accentColor: '#3b82f6', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  {/* SMS (se aplicável) */}
                  {alerta.canais.sms !== undefined && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                      <i className="fas fa-comment-sms" style={{ color: '#a855f7' }}></i>
                      <span>SMS</span>
                      <input 
                        type="checkbox"
                        checked={!!canais.sms}
                        onChange={() => toggleAlertaGestor(alerta.id, 'sms')}
                        style={{ accentColor: '#a855f7', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CARD 3: AUTOMAÇÕES ENVIADAS PARA O CLIENTE */}
      <div style={{
        background: 'var(--branco)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--borda)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(197, 160, 89, 0.15)', color: 'var(--dourado)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
            <i className="fas fa-robot"></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--texto-principal)' }}>
              3. Mensagens Automáticas Disparadas para o Cliente
            </h3>
            <small style={{ color: 'var(--texto-secundario)' }}>
              Ligue ou desligue o que o sistema deve enviar automaticamente para o cliente durante a locação.
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {GATILHOS_PADRAO.map(gatilho => {
            const canais = alertasCliente[gatilho.id] || gatilho.canais;

            return (
              <div key={gatilho.id} className="notif-alert-row" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '14px',
                border: '1px solid var(--borda)',
                background: 'var(--fundo-cinza)',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: `${gatilho.cor}22`,
                    color: gatilho.cor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    <i className={`fas ${gatilho.icone}`}></i>
                  </div>
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--texto-principal)', display: 'block' }}>
                      {gatilho.titulo}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                      {gatilho.descricao}
                    </span>
                  </div>
                </div>

                <div className="notif-alert-switches" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {/* WhatsApp */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    <i className="fab fa-whatsapp" style={{ color: '#25d366' }}></i>
                    <span>WhatsApp</span>
                    <input 
                      type="checkbox"
                      checked={!!canais.whatsapp}
                      onChange={() => toggleAlertaCliente(gatilho.id, 'whatsapp')}
                      style={{ accentColor: '#25d366', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  {/* E-mail */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    <i className="fas fa-envelope" style={{ color: '#3b82f6' }}></i>
                    <span>E-mail</span>
                    <input 
                      type="checkbox"
                      checked={!!canais.email}
                      onChange={() => toggleAlertaCliente(gatilho.id, 'email')}
                      style={{ accentColor: '#3b82f6', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  {/* SMS */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    <i className="fas fa-comment-sms" style={{ color: '#a855f7' }}></i>
                    <span>SMS</span>
                    <input 
                      type="checkbox"
                      checked={!!canais.sms}
                      onChange={() => toggleAlertaCliente(gatilho.id, 'sms')}
                      style={{ accentColor: '#a855f7', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CARD 4: PROVEDOR DE SMS & TORPEDOS */}
      <div style={{
        background: 'var(--branco)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--borda)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
              <i className="fas fa-comment-sms"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--texto-principal)' }}>
                4. Conexão de SMS para Torpedos no Celular
              </h3>
              <small style={{ color: 'var(--texto-secundario)' }}>
                {provedores.smsAtivo 
                  ? 'Envio real via Twilio ativado no chip dos clientes e da equipe.'
                  : 'Modo Auditoria & Histórico ativo (torpedos registrados no sistema sem custo telefônico).'}
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '20px',
              background: provedores.smsAtivo ? '#ecfdf5' : '#f1f5f9',
              color: provedores.smsAtivo ? '#059669' : '#64748b',
              border: `1px solid ${provedores.smsAtivo ? '#a7f3d0' : '#e2e8f0'}`
            }}>
              {provedores.smsAtivo ? '🟢 SMS REAL ATIVO' : '⚪ AUDITORIA / SIMULADO'}
            </span>

            <button
              type="button"
              onClick={() => setMostrarConfigSms(prev => !prev)}
              style={{
                background: 'transparent',
                border: '1px solid var(--borda)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--texto-principal)',
                cursor: 'pointer'
              }}
            >
              {mostrarConfigSms ? 'Ocultar Credenciais' : '⚙️ Configurar Twilio'}
            </button>
          </div>
        </div>

        {/* Painel Expansível de Configuração Twilio */}
        {mostrarConfigSms && (
          <div style={{
            background: 'var(--fundo-cinza)',
            padding: '18px 20px',
            borderRadius: '12px',
            border: '1px solid var(--borda)',
            marginTop: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--borda)', paddingBottom: '10px' }}>
              <div>
                <strong style={{ fontSize: '13.5px', color: 'var(--texto-principal)' }}>Habilitar Envio Real via Twilio Gateway</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--texto-secundario)' }}>
                  Insira seus dados da Twilio (ou mantenha desativado para registrar disparos no histórico sem custos).
                </p>
              </div>
              <input
                type="checkbox"
                checked={provedores.smsAtivo}
                onChange={(e) => setProvedores(prev => ({ ...prev, smsAtivo: e.target.checked }))}
                style={{ accentColor: '#a855f7', width: '20px', height: '20px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
                  Twilio Account SID:
                </label>
                <input
                  type="text"
                  value={provedores.twilioAccountSid}
                  onChange={(e) => setProvedores(prev => ({ ...prev, twilioAccountSid: e.target.value }))}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--borda)',
                    background: 'var(--branco)',
                    color: 'var(--texto-principal)',
                    fontSize: '12.5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
                  Twilio Auth Token:
                </label>
                <input
                  type="password"
                  value={provedores.twilioAuthToken}
                  onChange={(e) => setProvedores(prev => ({ ...prev, twilioAuthToken: e.target.value }))}
                  placeholder="••••••••••••••••••••••••••••••••"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--borda)',
                    background: 'var(--branco)',
                    color: 'var(--texto-principal)',
                    fontSize: '12.5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
                  Número Remetente Twilio (E.164):
                </label>
                <input
                  type="text"
                  value={provedores.twilioFromNumber}
                  onChange={(e) => setProvedores(prev => ({ ...prev, twilioFromNumber: e.target.value }))}
                  placeholder="+1234567890"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--borda)',
                    background: 'var(--branco)',
                    color: 'var(--texto-principal)',
                    fontSize: '12.5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CARD 5: DISPARO DE TESTE IMEDIATO */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(197, 160, 89, 0.08) 0%, rgba(197, 160, 89, 0.02) 100%)',
        border: '1.5px solid rgba(197, 160, 89, 0.3)',
        borderRadius: '16px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '24px' }}>🚀</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--texto-principal)' }}>
              Testar Notificação Imediatamente
            </h3>
            <small style={{ color: 'var(--texto-secundario)' }}>Valide o recebimento no seu próprio WhatsApp ou E-mail.</small>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
              Canal:
            </label>
            <select
              value={testeCanal}
              onChange={(e) => setTesteCanal(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--borda)',
                background: 'var(--branco)',
                color: 'var(--texto-principal)',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          <div style={{ flex: 2 }}>
            <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
              {testeCanal === 'email' ? 'E-mail Destinatário:' : 'WhatsApp com DDD (Ex: 19998564109):'}
            </label>
            <input 
              type={testeCanal === 'email' ? 'email' : 'text'}
              value={testeDestino}
              onChange={(e) => setTesteDestino(e.target.value)}
              placeholder={testeCanal === 'email' ? 'seuemail@exemplo.com' : '19998564109'}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--borda)',
                background: 'var(--branco)',
                color: 'var(--texto-principal)',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="button"
            className="btn-teste-notificacao"
            onClick={handleDispararTeste}
            disabled={testando}
            style={{
              background: 'var(--dourado)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '42px'
            }}
          >
            <i className={`fas ${testando ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
            {testando ? 'Enviando...' : 'Enviar Teste'}
          </button>
        </div>

        {msgTeste && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            background: msgTeste.tipo === 'sucesso' ? '#ecfdf5' : '#fef2f2',
            color: msgTeste.tipo === 'sucesso' ? '#059669' : '#dc2626',
            border: `1px solid ${msgTeste.tipo === 'sucesso' ? '#a7f3d0' : '#fca5a5'}`
          }}>
            {msgTeste.texto}
          </div>
        )}
      </div>

      {/* BOTÃO FINAL DE SALVAR */}
      <div className="notificacoes-save-bar" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button
          type="button"
          className="btn-salvar-notificacao"
          onClick={handleSalvar}
          disabled={salvando}
          style={{
            background: 'var(--dourado)',
            color: '#ffffff',
            border: 'none',
            padding: '14px 28px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(197, 160, 89, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          {salvoFeedback ? <i className="fas fa-check"></i> : <i className="fas fa-save"></i>}
          <span>{salvoFeedback ? 'PREFERÊNCIAS SALVAS COM SUCESSO!' : (salvando ? 'SALVANDO...' : 'SALVAR PREFERÊNCIAS DE NOTIFICAÇÃO')}</span>
        </button>
      </div>

    </div>
  );
};

export default AbaNotificacoes;
