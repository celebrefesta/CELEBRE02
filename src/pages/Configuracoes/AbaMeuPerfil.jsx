import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig'; 
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

const AbaMeuPerfil = ({ usuarioLogado, isCollaborator, isSuperAdmin, isOwner, nomeEmpresa, registrarLog }) => {
  const [dadosPerfil, setDadosPerfil] = useState({
    nome: '', sobrenome: '', cpf: '', telefone: '', endereco: '', email: '',
    asoStatus: 'Pendente', asoTipo: 'Admissional', asoDataExame: '', asoValidade: '', asoObservacoes: ''
  });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [permissoesAtivas, setPermissoesAtivas] = useState([]);


  useEffect(() => {
    const carregarDadosUsuario = async () => {
      try {
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const uData = userSnap.data();
          setDadosPerfil(prev => ({
            ...prev,
            nome: uData.nomeCompleto || uData.nomeExibicao || usuarioLogado.displayName || (isCollaborator ? 'Colaborador' : 'Admin'),
            sobrenome: uData.sobrenome || '',
            cpf: uData.cpf || uData.documento || '',
            telefone: uData.telefone || '',
            endereco: uData.endereco || '',
            email: usuarioLogado.email || ''
          }));

          if (isCollaborator) {
            const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
            const snapEquipe = await getDocs(qEquipe);
            if (!snapEquipe.empty) {
              const equipeData = snapEquipe.docs[0].data();
              setDadosPerfil(prev => ({
                ...prev,
                asoStatus: equipeData.asoStatus || 'Pendente',
                asoTipo: equipeData.asoTipo || 'Admissional',
                asoDataExame: equipeData.asoDataExame || '',
                asoValidade: equipeData.asoValidade || '',
                asoObservacoes: equipeData.asoObservacoes || ''
              }));
              setPermissoesAtivas(equipeData.permissoes || []);
            }
          }
        }


      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
      } finally {
        setCarregando(false);
      }
    };

    if (usuarioLogado) carregarDadosUsuario();
  }, [usuarioLogado, isCollaborator]);

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
      await updateProfile(usuarioLogado, { displayName: dadosPerfil.nome });
      const userRef = doc(db, 'usuarios', usuarioLogado.uid);
      await updateDoc(userRef, {
        nomeCompleto: dadosPerfil.nome, sobrenome: dadosPerfil.sobrenome,
        cpf: dadosPerfil.cpf, telefone: dadosPerfil.telefone, endereco: dadosPerfil.endereco
      });

      if (isCollaborator) {
        const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
        const snapEquipe = await getDocs(qEquipe);
        if (!snapEquipe.empty) {
          const funcDocId = snapEquipe.docs[0].id;
          await updateDoc(doc(db, 'equipe', funcDocId), {
            nome: dadosPerfil.nome, telefone: dadosPerfil.telefone, cpf: dadosPerfil.cpf
          });
        }
      }
      await registrarLog("ATUALIZAÇÃO DE PERFIL", `Atualizou os dados da ficha pessoal.`);
      alert('✅ Dados atualizados com sucesso!');
    } catch (error) {
      alert('Ocorreu um erro ao salvar o perfil.');
    } finally {
      setSalvandoPerfil(false);
    }
  };

  if (carregando) return <div style={{padding: '40px', color: '#64748b'}}>A carregar os seus dados...</div>;

  return (
    <div className="config-perfil-grid-container">
      <div className="config-perfil-grid">
        {/* COLUNA ESQUERDA: CARTÃO DE IDENTIFICAÇÃO */}
        <div className="config-card" style={{ margin: 0, textAlign: 'center', padding: '35px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '110px', height: '110px', borderRadius: '50%',
            background: isSuperAdmin ? '#c5a059' : '#0f172a',
            color: 'white', fontSize: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px', fontWeight: '800', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            {dadosPerfil.nome ? dadosPerfil.nome.charAt(0).toUpperCase() : 'U'}
          </div>

          <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: '0 0 5px 0', fontWeight: '800' }}>
            {dadosPerfil.nome || 'Usuário'} {dadosPerfil.sobrenome}
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#64748b', margin: '0 0 20px 0' }}>{dadosPerfil.email}</p>

          <span style={{
            padding: '8px 16px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: 'bold',
            background: isSuperAdmin ? '#fef3c7' : (isOwner ? '#f1f5f9' : '#e2e8f0'),
            color: isSuperAdmin ? '#92400e' : (isOwner ? '#475569' : '#64748b'),
            border: `1px solid ${isSuperAdmin ? '#fde68a' : '#cbd5e1'}`,
            display: 'inline-block', marginBottom: '25px'
          }}>
            {isSuperAdmin ? '👑 Super-Admin' : (isOwner ? '💼 Proprietário(a)' : '🤝 Colaborador(a)')}
          </span>

          <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #e2e8f0', margin: '0 0 20px 0' }} />

          <div style={{ width: '100%', textAlign: 'left', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '10px' }}>
              <i className="fas fa-check-circle" style={{ width: '22px', color: '#10b981' }}></i> Status: <strong>Conta Ativa</strong>
            </p>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0' }}>
              <i className="fas fa-building" style={{ width: '22px', color: '#3b82f6' }}></i> Empresa: <strong>{nomeEmpresa || 'Sua Empresa'}</strong>
            </p>
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE DADOS */}
        <form className="config-card large-padding" onSubmit={handleSalvarPerfil} style={{ margin: 0 }}>
          <div className="card-top-bar gray-bar"></div>
          <h3>👤 Informações Pessoais (Ficha RH)</h3>
          <p className="subtext">Atualize as suas informações de contato e identificação da conta atual.</p>

          <div className="form-grid-2-col" style={{ marginTop: '25px' }}>
            <div className="f-group">
              <label>Nome Completo</label>
              <input type="text" value={dadosPerfil.nome} onChange={(e) => setDadosPerfil({ ...dadosPerfil, nome: e.target.value })} placeholder="Seu nome" />
            </div>
            <div className="f-group">
              <label>Sobrenome / Apelido</label>
              <input type="text" value={dadosPerfil.sobrenome} onChange={(e) => setDadosPerfil({ ...dadosPerfil, sobrenome: e.target.value })} placeholder="Seu sobrenome" />
            </div>
            <div className="f-group">
              <label>CPF do Titular</label>
              <input type="text" value={dadosPerfil.cpf} onChange={(e) => setDadosPerfil({ ...dadosPerfil, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div className="f-group">
              <label>Telefone / WhatsApp Pessoal</label>
              <input type="text" value={dadosPerfil.telefone} onChange={(e) => setDadosPerfil({ ...dadosPerfil, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="f-group span-2-col">
              <label>Endereço Residencial</label>
              <input type="text" value={dadosPerfil.endereco} onChange={(e) => setDadosPerfil({ ...dadosPerfil, endereco: e.target.value })} placeholder="Rua, Número, Bairro, Cidade - UF" />
            </div>
            <div className="f-group span-2-col">
              <label>E-mail de Login (Acesso ao Sistema)</label>
              <input type="email" value={dadosPerfil.email} readOnly style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }} title="Inalterável" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
            <button type="submit" className="btn-salvar-config" disabled={salvandoPerfil} style={{ minWidth: '200px' }}>
              {salvandoPerfil ? 'Salvando...' : 'Salvar Dados Pessoais'}
            </button>
          </div>

          {isCollaborator && (
            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '30px', marginTop: '30px' }}>
              <h3 style={{ color: '#0f172a' }}><i className="fas fa-notes-medical" style={{ color: '#10b981', marginRight: '8px' }}></i> Saúde Ocupacional (ASO)</h3>
              <p className="subtext">Ficha de saúde preenchida e gerida exclusivamente pelo seu gestor.</p>

              <div className="form-grid-2-col" style={{ marginTop: '20px' }}>
                <div className="f-group">
                  <label>Status do Exame</label>
                  <input type="text" value={dadosPerfil.asoStatus} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed', color: dadosPerfil.asoStatus === 'Apto' ? '#166534' : (dadosPerfil.asoStatus === 'Inapto' ? '#991b1b' : '#0f172a'), fontWeight: 'bold' }} />
                </div>
                <div className="f-group">
                  <label>Tipo de Exame</label>
                  <input type="text" value={dadosPerfil.asoTipo} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
                </div>
                <div className="f-group">
                  <label>Data de Realização</label>
                  <input type="text" value={dadosPerfil.asoDataExame ? dadosPerfil.asoDataExame.split('-').reverse().join('/') : 'Não informada'} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
                </div>
                <div className="f-group">
                  <label>Validade do Exame</label>
                  <input type="text" value={dadosPerfil.asoValidade ? dadosPerfil.asoValidade.split('-').reverse().join('/') : 'Não informada'} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
                </div>
                <div className="f-group span-2-col">
                  <label>Observações / Restrições Médicas</label>
                  <input type="text" value={dadosPerfil.asoObservacoes || 'Nenhuma restrição registrada.'} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* LINHA INFERIOR COM AS NOVAS FICHAS */}
      <div className="perfil-bottom-row">
        {/* CARD DE PERMISSÕES */}
        <div className="config-card">
          <div className="card-top-bar gold-bar"></div>
          <h3>🛡️ Permissões de Acesso</h3>
          <p className="subtext">Lista de módulos e funcionalidades autorizados no Celebre.</p>
          
          {isOwner || isSuperAdmin ? (
            <div className="perfil-permissoes-owner">
              <div style={{ background: 'rgba(197,160,89,0.06)', border: '1px dashed rgba(197,160,89,0.2)', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                <span style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  👑 Proprietário / Administrador Geral
                </span>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--texto-secundario)', lineHeight: '1.4' }}>
                  Você possui controle irrestrito do Celebre. Todas as ações de faturamento, cadastro, exclusão e visualização financeira estão liberadas para o seu login.
                </p>
              </div>
              <div className="perm-item active"><span><span className="icon">✅</span> Estoque e Catálogos</span><span className="badge ok">Liberado</span></div>
              <div className="perm-item active"><span><span className="icon">✅</span> Gestão de Clientes</span><span className="badge ok">Liberado</span></div>
              <div className="perm-item active"><span><span className="icon">✅</span> Locações e Orçamentos</span><span className="badge ok">Liberado</span></div>
              <div className="perm-item active"><span><span className="icon">✅</span> Agenda e Logística</span><span className="badge ok">Liberado</span></div>
              <div className="perm-item active"><span><span className="icon">✅</span> Gerador de Contratos</span><span className="badge ok">Liberado</span></div>
              <div className="perm-item active"><span><span className="icon">✅</span> Moodboards de Projetos</span><span className="badge ok">Liberado</span></div>
              <div className="perm-item active"><span><span className="icon">✅</span> Financeiro e Relatórios</span><span className="badge ok">Liberado</span></div>
            </div>
          ) : (
            <div className="perfil-permissoes-colab">
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '15px' }}>
                Seu nível de acesso atual limita suas funções aos seguintes módulos autorizados:
              </p>
              <div className={`perm-item ${permissoesAtivas.includes('Estoque') ? 'active' : 'inactive'}`}>
                <span><span className="icon">{permissoesAtivas.includes('Estoque') ? '✅' : '🔒'}</span> Estoque e Catálogos</span>
                {permissoesAtivas.includes('Estoque') ? <span className="badge ok">Liberado</span> : <span className="badge lock">Bloqueado</span>}
              </div>
              <div className={`perm-item ${permissoesAtivas.includes('Clientes') ? 'active' : 'inactive'}`}>
                <span><span className="icon">{permissoesAtivas.includes('Clientes') ? '✅' : '🔒'}</span> Gestão de Clientes</span>
                {permissoesAtivas.includes('Clientes') ? <span className="badge ok">Liberado</span> : <span className="badge lock">Bloqueado</span>}
              </div>
              <div className={`perm-item ${permissoesAtivas.includes('Locacoes') ? 'active' : 'inactive'}`}>
                <span><span className="icon">{permissoesAtivas.includes('Locacoes') ? '✅' : '🔒'}</span> Locações e Orçamentos</span>
                {permissoesAtivas.includes('Locacoes') ? <span className="badge ok">Liberado</span> : <span className="badge lock">Bloqueado</span>}
              </div>
              <div className={`perm-item ${(permissoesAtivas.includes('Agenda') || permissoesAtivas.includes('Logistica')) ? 'active' : 'inactive'}`}>
                <span><span className="icon">{(permissoesAtivas.includes('Agenda') || permissoesAtivas.includes('Logistica')) ? '✅' : '🔒'}</span> Agenda e Logística</span>
                {(permissoesAtivas.includes('Agenda') || permissoesAtivas.includes('Logistica')) ? <span className="badge ok">Liberado</span> : <span className="badge lock">Bloqueado</span>}
              </div>
              <div className={`perm-item ${permissoesAtivas.includes('Contratos') ? 'active' : 'inactive'}`}>
                <span><span className="icon">{permissoesAtivas.includes('Contratos') ? '✅' : '🔒'}</span> Gerador de Contratos</span>
                {permissoesAtivas.includes('Contratos') ? <span className="badge ok">Liberado</span> : <span className="badge lock">Bloqueado</span>}
              </div>
              <div className={`perm-item ${permissoesAtivas.includes('Moodboard') ? 'active' : 'inactive'}`}>
                <span><span className="icon">{permissoesAtivas.includes('Moodboard') ? '✅' : '🔒'}</span> Moodboards de Projetos</span>
                {permissoesAtivas.includes('Moodboard') ? <span className="badge ok">Liberado</span> : <span className="badge lock">Bloqueado</span>}
              </div>
              <div className="perm-item inactive">
                <span><span className="icon">🔒</span> Financeiro e Relatórios</span>
                <span className="badge lock">Restrito</span>
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

export default AbaMeuPerfil;