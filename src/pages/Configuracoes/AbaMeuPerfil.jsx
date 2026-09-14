import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig'; 
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { formatarDataExibicao } from '../../utils/periodoTesteUtils';
import './Configuracoes.css';

// 🔤 Helper: Capitaliza primeira letra de cada palavra (Title Case)
const capitalize = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .join(' ');
};

// 🔢 Helper: Máscara de CPF (000.000.000-00)
const formatCPF = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// 📞 Helper: Máscara de Telefone ((00) 00000-0000)
const formatTelefone = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2');
};

// 🏠 Helper: Máscara de CEP (00000-000)
const formatCEP = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
};

const AbaMeuPerfil = ({ usuarioLogado, isCollaborator, isSuperAdmin, isOwner, nomeEmpresa, registrarLog, dataCriacaoConta }) => {
  const [carregando, setCarregando] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [dadosPerfil, setDadosPerfil] = useState({
    nome: '',
    sobrenome: '',
    cpf: '',
    telefone: '',
    cargo: '',
    aniversario: '',
    dataCriacao: '',
    bio: '',
    fotoUrl: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    email: '',
    asoStatus: '',
    asoTipo: '',
    asoDataExame: '',
    asoValidade: '',
    asoObservacoes: ''
  });

  // Auto-ajuste de segurança: se nome contiver sobrenome junto, separa automaticamente
  useEffect(() => {
    if (dadosPerfil.nome && dadosPerfil.nome.trim().includes(' ')) {
      const partes = dadosPerfil.nome.trim().split(/\s+/);
      if (partes.length > 1) {
        setDadosPerfil(prev => ({
          ...prev,
          nome: capitalize(partes[0]),
          sobrenome: prev.sobrenome ? prev.sobrenome : capitalize(partes.slice(1).join(' '))
        }));
      }
    }
  }, [dadosPerfil.nome]);

  // Carrega os dados reais do Firestore
  useEffect(() => {
    const carregarDadosUsuario = async () => {
      if (!usuarioLogado?.uid) return;
      try {
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        const userSnap = await getDoc(userRef);

        let dataCriacaoFinal = dataCriacaoConta || '';
        if (userSnap.exists()) {
          const uData = userSnap.data();
          const rawCad = uData.dataCadastro || uData.criadoEm || usuarioLogado.metadata?.creationTime;
          dataCriacaoFinal = formatarDataExibicao(rawCad) || dataCriacaoFinal || '—';

          let rawSobrenome = (uData.sobrenome || '').trim();
          let rawNome = (uData.nome || uData.nomeCompleto || uData.nomeExibicao || usuarioLogado.displayName || '').trim();

          let nomeInicial = '';
          let sobrenomeInicial = capitalize(rawSobrenome);

          if (rawNome) {
            const partes = rawNome.split(/\s+/);
            nomeInicial = capitalize(partes[0]); // Garante APENAS o primeiro nome no card Nome
            if (!sobrenomeInicial && partes.length > 1) {
              sobrenomeInicial = capitalize(partes.slice(1).join(' ')); // O restante vai para Sobrenome
            }
          } else {
            nomeInicial = isCollaborator ? 'Colaborador' : 'Admin';
          }

          setDadosPerfil(prev => ({
            ...prev,
            nome: nomeInicial,
            sobrenome: sobrenomeInicial,
            cpf: formatCPF(uData.cpf || uData.documento || ''),
            telefone: formatTelefone(uData.telefone || ''),
            cargo: capitalize(uData.cargo || (isSuperAdmin ? 'Administrador Geral' : (isOwner ? 'Proprietário(a)' : 'Gestor(a)'))),
            aniversario: uData.aniversario || '',
            dataCriacao: dataCriacaoFinal,
            bio: uData.bio || '',
            fotoUrl: uData.fotoUrl || uData.photoURL || usuarioLogado.photoURL || '',
            cep: formatCEP(uData.cep || ''),
            rua: capitalize(uData.rua || uData.endereco || ''),
            numero: uData.numero || '',
            bairro: capitalize(uData.bairro || ''),
            cidade: capitalize(uData.cidade || ''),
            uf: (uData.uf || '').toUpperCase(),
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
                asoObservacoes: equipeData.asoObservacoes || '',
                fotoUrl: prev.fotoUrl || equipeData.fotoUrl || ''
              }));
            }
          }
        }
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
      } finally {
        setCarregando(false);
      }
    };

    carregarDadosUsuario();
  }, [usuarioLogado, isCollaborator, isSuperAdmin, isOwner]);

  // Função para buscar CEP automaticamente via ViaCEP
  const handleBuscarCep = async (cepInput) => {
    const cepLimpo = cepInput.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setDadosPerfil(prev => ({
            ...prev,
            rua: capitalize(data.logradouro || prev.rua),
            bairro: capitalize(data.bairro || prev.bairro),
            cidade: capitalize(data.localidade || prev.cidade),
            uf: (data.uf || prev.uf).toUpperCase()
          }));
        }
      } catch (e) {
        console.error("Erro ao consultar CEP:", e);
      }
    }
  };

  // Upload de Foto de Perfil Pessoal
  const handleUploadFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("⚠️ A imagem é muito grande. Escolha uma foto de até 5MB.");
      return;
    }

    setUploadingFoto(true);
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result;
      setDadosPerfil(prev => ({ ...prev, fotoUrl: base64String }));

      try {
        await updateProfile(usuarioLogado, { photoURL: base64String });
        const userRef = doc(db, 'usuarios', usuarioLogado.uid);
        await updateDoc(userRef, { fotoUrl: base64String, photoURL: base64String });

        if (isCollaborator) {
          const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
          const snapEquipe = await getDocs(qEquipe);
          if (!snapEquipe.empty) {
            await updateDoc(doc(db, 'equipe', snapEquipe.docs[0].id), { fotoUrl: base64String });
          }
        }

        if (registrarLog) {
          await registrarLog("FOTO DE PERFIL ATUALIZADA", `Fez upload de uma nova foto de perfil.`);
        }
        alert("✅ Sua foto de perfil foi atualizada com sucesso!");
      } catch (err) {
        console.error("Erro ao salvar foto:", err);
        alert("Erro ao atualizar foto de perfil.");
      } finally {
        setUploadingFoto(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleRemoverFoto = async () => {
    if (!window.confirm("Deseja remover sua foto de perfil?")) return;
    setUploadingFoto(true);
    try {
      setDadosPerfil(prev => ({ ...prev, fotoUrl: '' }));
      await updateProfile(usuarioLogado, { photoURL: '' });
      const userRef = doc(db, 'usuarios', usuarioLogado.uid);
      await updateDoc(userRef, { fotoUrl: '', photoURL: '' });
      alert("Foto removida!");
    } catch (e) {
      console.error(e);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
      const nomeFormatado = capitalize(dadosPerfil.nome);
      const sobrenomeFormatado = capitalize(dadosPerfil.sobrenome);
      const cargoFormatado = capitalize(dadosPerfil.cargo);
      const ruaFormatada = capitalize(dadosPerfil.rua);
      const bairroFormatado = capitalize(dadosPerfil.bairro);
      const cidadeFormatada = capitalize(dadosPerfil.cidade);
      const ufFormatada = (dadosPerfil.uf || '').toUpperCase();

      const enderecoCompleto = `${ruaFormatada}${dadosPerfil.numero ? ', ' + dadosPerfil.numero : ''}${bairroFormatado ? ' - ' + bairroFormatado : ''}${cidadeFormatada ? ' (' + cidadeFormatada + '/' + ufFormatada + ')' : ''}`;

      const nomeCompletoCombinado = sobrenomeFormatado ? `${nomeFormatado} ${sobrenomeFormatado}` : nomeFormatado;

      await updateProfile(usuarioLogado, { displayName: nomeCompletoCombinado });
      const userRef = doc(db, 'usuarios', usuarioLogado.uid);
      await updateDoc(userRef, {
        nome: nomeFormatado,
        nomeCompleto: nomeCompletoCombinado, 
        sobrenome: sobrenomeFormatado,
        cpf: dadosPerfil.cpf, 
        telefone: dadosPerfil.telefone, 
        cargo: cargoFormatado,
        aniversario: dadosPerfil.aniversario,
        bio: dadosPerfil.bio,
        cep: dadosPerfil.cep,
        rua: ruaFormatada,
        numero: dadosPerfil.numero,
        bairro: bairroFormatado,
        cidade: cidadeFormatada,
        uf: ufFormatada,
        endereco: enderecoCompleto
      });

      if (isCollaborator) {
        const qEquipe = query(collection(db, 'equipe'), where('email', '==', usuarioLogado.email));
        const snapEquipe = await getDocs(qEquipe);
        if (!snapEquipe.empty) {
          const funcDocId = snapEquipe.docs[0].id;
          await updateDoc(doc(db, 'equipe', funcDocId), {
            nome: nomeFormatado, 
            telefone: dadosPerfil.telefone, 
            cpf: dadosPerfil.cpf,
            cargo: cargoFormatado
          });
        }
      }

      if (registrarLog) {
        await registrarLog("ATUALIZAÇÃO DE PERFIL", `Atualizou os dados da ficha pessoal.`);
      }
      alert('✅ Perfil atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Ocorreu um erro ao salvar o perfil.');
    } finally {
      setSalvandoPerfil(false);
    }
  };

  if (carregando) return <div style={{ padding: '40px', color: '#64748b' }}>Carregando dados do perfil...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      <div className="profile-grid-responsive">
        
        {/* COLUNA ESQUERDA: CRACHÁ DIGITAL & FOTO PESSOAL */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '32px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative'
        }}>
          
          {/* CONTAINER DA FOTO COM UPLOAD OVERLAY - ALINHAMENTO PERFEITO */}
          <div style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 20px' }}>
            <div style={{
              width: '130px',
              height: '130px',
              borderRadius: '50%',
              overflow: 'hidden',
              background: isSuperAdmin ? 'linear-gradient(135deg, #c5a059, #a37c3f)' : 'linear-gradient(135deg, #0f172a, #1e293b)',
              color: '#ffffff',
              fontSize: '52px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              textAlign: 'center',
              border: '4px solid #ffffff',
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
              boxSizing: 'border-box'
            }}>
              {dadosPerfil.fotoUrl ? (
                <img src={dadosPerfil.fotoUrl} alt="Foto de Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', lineHeight: '1', textAlign: 'center' }}>
                  {dadosPerfil.nome ? dadosPerfil.nome.charAt(0).toUpperCase() : 'U'}
                </span>
              )}
            </div>

            {/* BOTÃO DA CÂMERA DE UPLOAD DE FOTO PESSOAL */}
            <label 
              htmlFor="upload-foto-perfil-input"
              style={{
                position: 'absolute',
                bottom: '0px',
                right: '0px',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                border: '2.5px solid #ffffff',
                transition: 'all 0.2s ease',
                zIndex: 10,
                padding: 0,
                lineHeight: 1
              }}
              title="Upar Foto Pessoal"
            >
              <i className="fas fa-camera" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', margin: 0, padding: 0, lineHeight: 1, textAlign: 'center', fontSize: '15px' }}></i>
            </label>

            <input 
              type="file" 
              id="upload-foto-perfil-input" 
              accept="image/*" 
              onChange={handleUploadFoto} 
              style={{ display: 'none' }} 
            />
          </div>

          {/* BOTÃO REMOVER FOTO (SE TIVER) */}
          {dadosPerfil.fotoUrl && (
            <button
              type="button"
              onClick={handleRemoverFoto}
              disabled={uploadingFoto}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                marginBottom: '14px',
                textDecoration: 'underline'
              }}
            >
              Remover Foto
            </button>
          )}

          {uploadingFoto && (
            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold', marginBottom: '10px' }}>
              <i className="fas fa-spinner fa-spin"></i> Atualizando foto...
            </span>
          )}

          <h2 style={{ fontSize: '20px', color: 'var(--texto-principal)', margin: '0 0 4px 0', fontWeight: '800', textTransform: 'capitalize' }}>
            {capitalize(dadosPerfil.nome) || 'Usuário'} {capitalize(dadosPerfil.sobrenome)}
          </h2>

          <span style={{ fontSize: '13.5px', color: 'var(--dourado)', fontWeight: '800', marginBottom: '20px', display: 'inline-block' }}>
            {isCollaborator ? 'Colaborador(a)' : 'Administrador'}
          </span>

          <div style={{ width: '100%', textAlign: 'left', background: 'var(--fundo-cinza)', padding: '16px', borderRadius: '12px', border: '1px solid var(--borda)' }}>
            <p style={{ fontSize: '12.5px', color: 'var(--texto-secundario)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-envelope" style={{ color: 'var(--texto-secundario)' }}></i> {dadosPerfil.email}
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--texto-secundario)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-calendar-alt" style={{ color: '#c5a059' }}></i> Criação da Conta: <strong style={{ color: 'var(--texto-principal)' }}>{dadosPerfil.dataCriacao || dataCriacaoConta || '—'}</strong>
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--texto-secundario)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i> Status: <strong style={{ color: 'var(--texto-principal)' }}>Conta Ativa</strong>
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--texto-secundario)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-building" style={{ color: '#3b82f6' }}></i> Empresa: <strong style={{ color: 'var(--texto-principal)' }}>{nomeEmpresa || 'Sua Empresa'}</strong>
            </p>
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO COMPLETO EM 2 COLUNAS ESPAÇOSAS */}
        <form onSubmit={handleSalvarPerfil} style={{
          background: 'var(--branco)',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid var(--borda)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--texto-principal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-user-edit" style={{ color: 'var(--dourado)' }}></i> Informações Pessoais & Perfil
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--texto-secundario)' }}>
              Preencha seus dados de identificação, cargo e endereço residencial.
            </p>
          </div>

          <hr style={{ borderColor: 'var(--borda)', margin: 0 }} />

          {/* SEÇÃO 1: DADOS PESSOAIS */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--texto-principal)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <i className="fas fa-id-card" style={{ color: '#3b82f6', marginRight: '6px' }}></i> Identificação Pessoal
            </h4>

            {/* LINHA 1: NOME E SOBRENOME (2 COLUNAS NA MESMA LINHA) */}
            <div 
              className="profile-fields-2col-row" 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '16px', 
                marginBottom: '16px', 
                width: '100%', 
                boxSizing: 'border-box' 
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Nome *
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.nome} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, nome: e.target.value })} 
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    const partes = val.split(/\s+/);
                    if (partes.length > 1 && !dadosPerfil.sobrenome?.trim()) {
                      setDadosPerfil(prev => ({
                        ...prev,
                        nome: capitalize(partes[0]),
                        sobrenome: capitalize(partes.slice(1).join(' '))
                      }));
                    } else {
                      setDadosPerfil(prev => ({ ...prev, nome: capitalize(partes[0] || val) }));
                    }
                  }}
                  placeholder="Seu primeiro nome"
                  required
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Sobrenome / Apelido
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.sobrenome} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, sobrenome: e.target.value })} 
                  onBlur={(e) => setDadosPerfil({ ...dadosPerfil, sobrenome: capitalize(e.target.value) })}
                  placeholder="Seu sobrenome"
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>
            </div>

            {/* LINHA 2: CPF E DATA DE NASCIMENTO (2 COLUNAS NA MESMA LINHA) */}
            <div 
              className="profile-fields-2col-row" 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '16px', 
                marginBottom: '16px', 
                width: '100%', 
                boxSizing: 'border-box' 
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px', lineHeight: 1.2 }}>
                  CPF do Titular
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.cpf} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, cpf: formatCPF(e.target.value) })} 
                  placeholder="000.000.000-00"
                  maxLength="14"
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Data de Nascimento / Aniversário
                </label>
                <input 
                  type="date" 
                  value={dadosPerfil.aniversario} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, aniversario: e.target.value })} 
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* LINHA 3: CARGO E TELEFONE (2 COLUNAS NA MESMA LINHA) */}
            <div 
              className="profile-fields-2col-row" 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '16px', 
                marginBottom: '16px', 
                width: '100%', 
                boxSizing: 'border-box' 
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Cargo / Função na Empresa
                </label>
                <input 
                  type="text" 
                  value={isCollaborator ? 'Colaborador' : 'Administrador'} 
                  readOnly
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontWeight: '800', cursor: 'not-allowed', fontSize: '14px', boxSizing: 'border-box' }}
                  title="Cargo definido pelo nível de assinatura da conta"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Telefone / WhatsApp Pessoal
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.telefone} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, telefone: formatTelefone(e.target.value) })} 
                  placeholder="(00) 00000-0000"
                  maxLength="15"
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--borda)', margin: 0 }} />

          {/* SEÇÃO 2: ENDEREÇO RESIDENCIAL */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--texto-principal)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <i className="fas fa-map-marker-alt" style={{ color: '#10b981', marginRight: '6px' }}></i> Endereço Residencial
            </h4>

            <div className="profile-form-row-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                  CEP
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.cep} 
                  onChange={(e) => {
                    const formatted = formatCEP(e.target.value);
                    setDadosPerfil({ ...dadosPerfil, cep: formatted });
                    handleBuscarCep(formatted);
                  }} 
                  placeholder="00000-000"
                  maxLength="9"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                  Logradouro / Rua
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.rua} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, rua: e.target.value })} 
                  onBlur={(e) => setDadosPerfil({ ...dadosPerfil, rua: capitalize(e.target.value) })}
                  placeholder="Av. Paulista, Rua Flores..."
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                  Número e Complemento
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.numero} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, numero: e.target.value })} 
                  placeholder="Ex: 100, Apto 42, Bloco B"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                  Bairro
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.bairro} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, bairro: e.target.value })} 
                  onBlur={(e) => setDadosPerfil({ ...dadosPerfil, bairro: capitalize(e.target.value) })}
                  placeholder="Seu bairro"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                  Cidade
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.cidade} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, cidade: e.target.value })} 
                  onBlur={(e) => setDadosPerfil({ ...dadosPerfil, cidade: capitalize(e.target.value) })}
                  placeholder="Sua cidade"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                  Estado (UF)
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.uf} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, uf: e.target.value.toUpperCase() })} 
                  placeholder="UF (ex: SP, RJ, MG)"
                  maxLength="2"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--borda)', margin: 0 }} />

          {/* SEÇÃO 3: MINI BIO & E-MAIL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                Mini Bio / Apresentação Profissional (Exibida nos Contratos e Orçamentos)
              </label>
              <textarea 
                rows="3"
                value={dadosPerfil.bio} 
                onChange={(e) => setDadosPerfil({ ...dadosPerfil, bio: e.target.value })} 
                placeholder="Escreva uma breve apresentação sobre sua carreira e atuação..."
                style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--texto-secundario)', marginBottom: '6px' }}>
                E-mail de Login (Acesso ao Sistema)
              </label>
              <input 
                type="email" 
                value={dadosPerfil.email} 
                readOnly 
                style={{ width: '100%', padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-secundario)', cursor: 'not-allowed', fontSize: '14px', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          {/* ÚNICO BOTÃO PRINCIPAL DE SALVAR DADOS DO PERFIL */}
          <div className="profile-submit-wrapper" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              type="submit" 
              className="btn-salvar-perfil"
              disabled={salvandoPerfil} 
              style={{
                background: 'var(--dourado)',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: salvandoPerfil ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
              }}
            >
              <i className="fas fa-save"></i> {salvandoPerfil ? 'Salvando...' : 'Salvar Dados do Perfil'}
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};

export default AbaMeuPerfil;