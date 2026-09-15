import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig'; 
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { formatarDataExibicao } from '../../utils/periodoTesteUtils';
import { validarCPF, validarDataNascimento } from '../../utils/validadores';
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
  const navigate = useNavigate();
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
    complemento: '',
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
            complemento: uData.complemento || '',
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
                cargo: capitalize(equipeData.cargo || prev.cargo || 'Colaborador'),
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
      const cpfLimpo = (dadosPerfil.cpf || '').replace(/\D/g, '');
      if (cpfLimpo.length > 0 && (cpfLimpo.length !== 11 || !validarCPF(cpfLimpo))) {
        alert('⚠️ O CPF informado é inválido. Por favor, verifique os dígitos antes de salvar.');
        setSalvandoPerfil(false);
        return;
      }

      const checagemData = validarDataNascimento(dadosPerfil.aniversario);
      if (!checagemData.valido) {
        alert('⚠️ A data de nascimento é inválida. Informe uma data de até 100 anos atrás e que não seja futura.');
        setSalvandoPerfil(false);
        return;
      }

      const nomeFormatado = capitalize(dadosPerfil.nome);
      const sobrenomeFormatado = capitalize(dadosPerfil.sobrenome);
      const cargoFormatado = capitalize(dadosPerfil.cargo);
      const ruaFormatada = capitalize(dadosPerfil.rua);
      const bairroFormatado = capitalize(dadosPerfil.bairro);
      const cidadeFormatada = capitalize(dadosPerfil.cidade);
      const ufFormatada = (dadosPerfil.uf || '').toUpperCase();

      const enderecoCompleto = `${ruaFormatada}${dadosPerfil.numero ? ', ' + dadosPerfil.numero : ''}${dadosPerfil.complemento ? ' - ' + dadosPerfil.complemento : ''}${bairroFormatado ? ' - ' + bairroFormatado : ''}${cidadeFormatada ? ' (' + cidadeFormatada + '/' + ufFormatada + ')' : ''}`;

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
        complemento: dadosPerfil.complemento || '',
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
        <div className="profile-cracha-card">
          
          {/* CONTAINER DA FOTO COM UPLOAD OVERLAY */}
          <div className="profile-cracha-avatar-col">
            <div className="profile-cracha-avatar-wrap">
              <div className="profile-cracha-avatar">
                {dadosPerfil.fotoUrl ? (
                  <img src={dadosPerfil.fotoUrl} alt="Foto de Perfil" />
                ) : (
                  <span>
                    {dadosPerfil.nome ? dadosPerfil.nome.charAt(0).toUpperCase() : 'U'}
                  </span>
                )}
              </div>

              {/* BOTÃO DA CÂMERA DE UPLOAD DE FOTO PESSOAL */}
              <label 
                htmlFor="upload-foto-perfil-input"
                className="profile-cracha-cam-btn"
                title="Alterar Foto de Perfil"
              >
                <i className="fas fa-camera"></i>
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
                className="profile-cracha-remove-btn"
              >
                Remover Foto
              </button>
            )}

            {uploadingFoto && (
              <span className="profile-cracha-uploading">
                <i className="fas fa-spinner fa-spin"></i> Atualizando...
              </span>
            )}
          </div>

          {/* INFORMAÇÕES PESSOAIS (AO LADO NO MOBILE, ABAIXO NO DESKTOP) */}
          <div className="profile-cracha-info-col">
            <div className="profile-cracha-header-row">
              <h2 className="profile-cracha-name">
                {capitalize(dadosPerfil.nome) || 'Usuário'} {capitalize(dadosPerfil.sobrenome)}
              </h2>

              <span className="profile-cracha-role-badge">
                {isCollaborator ? 'Colaborador(a)' : 'Administrador'}
              </span>
            </div>

            <div className="profile-cracha-details-box">
              <p className="profile-cracha-detail-item">
                <i className="fas fa-envelope"></i>
                <span className="detail-val" title={dadosPerfil.email}>{dadosPerfil.email}</span>
              </p>

              <p className="profile-cracha-detail-item">
                <i className="fas fa-building"></i>
                <span>Empresa: <strong>{nomeEmpresa || 'Sua Empresa'}</strong></span>
              </p>

              <div className="profile-cracha-meta-row">
                <p className="profile-cracha-detail-item meta-status">
                  <i className="fas fa-check-circle"></i>
                  <span>Status: <strong>Conta Ativa</strong></span>
                </p>

                <p className="profile-cracha-detail-item meta-date">
                  <i className="fas fa-calendar-alt"></i>
                  <span>Criação: <strong>{dadosPerfil.dataCriacao || dataCriacaoConta || '—'}</strong></span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO COMPLETO EM 2 COLUNAS ESPAÇOSAS */}
        <form onSubmit={handleSalvarPerfil} className="profile-form-card">
          
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
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
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
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
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
                <label style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  <span>CPF do Titular</span>
                  {(() => {
                    const cpfLimpo = (dadosPerfil.cpf || '').replace(/\D/g, '');
                    if (cpfLimpo.length === 11) {
                      return validarCPF(cpfLimpo) ? (
                        <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <i className="fas fa-check-circle"></i> VÁLIDO
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: '800', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <i className="fas fa-times-circle"></i> INVÁLIDO
                        </span>
                      );
                    }
                    if (cpfLimpo.length > 0 && cpfLimpo.length < 11) {
                      return (
                        <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '10px' }}>
                          {11 - cpfLimpo.length} {11 - cpfLimpo.length === 1 ? 'dígito restante' : 'dígitos restantes'}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.cpf} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, cpf: formatCPF(e.target.value) })} 
                  placeholder="000.000.000-00"
                  maxLength="14"
                  style={{ 
                    width: '100%', 
                    minWidth: 0, 
                    padding: '13px 16px', 
                    borderRadius: '8px', 
                    border: (() => {
                      const cpfLimpo = (dadosPerfil.cpf || '').replace(/\D/g, '');
                      if (cpfLimpo.length === 11) {
                        return validarCPF(cpfLimpo) ? '1px solid #16a34a' : '1px solid #ef4444';
                      }
                      return '1px solid var(--borda)';
                    })(), 
                    background: (() => {
                      const cpfLimpo = (dadosPerfil.cpf || '').replace(/\D/g, '');
                      if (cpfLimpo.length === 11 && !validarCPF(cpfLimpo)) {
                        return 'rgba(239, 68, 68, 0.05)';
                      }
                      return 'var(--fundo-cinza)';
                    })(), 
                    color: 'var(--texto-principal)', 
                    fontSize: '14px', 
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, background-color 0.2s'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  <span>Data de Nascimento / Aniversário</span>
                  {(() => {
                    if (!dadosPerfil.aniversario) return null;
                    const res = validarDataNascimento(dadosPerfil.aniversario);
                    if (!res.valido) {
                      return (
                        <span style={{ color: '#ef4444', fontWeight: '800', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <i className="fas fa-times-circle"></i> INVÁLIDO
                        </span>
                      );
                    }
                    return (
                      <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <i className="fas fa-check-circle"></i> VÁLIDO
                      </span>
                    );
                  })()}
                </label>
                <input 
                  type="date" 
                  value={dadosPerfil.aniversario} 
                  max={new Date().toISOString().split('T')[0]}
                  min={(() => {
                    const d = new Date();
                    d.setFullYear(d.getFullYear() - 100);
                    return d.toISOString().split('T')[0];
                  })()}
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, aniversario: e.target.value })} 
                  style={{ 
                    width: '100%', 
                    minWidth: 0, 
                    padding: '13px 16px', 
                    borderRadius: '8px', 
                    border: (() => {
                      if (!dadosPerfil.aniversario) return '1px solid var(--borda)';
                      const res = validarDataNascimento(dadosPerfil.aniversario);
                      return res.valido ? '1px solid #16a34a' : '1px solid #ef4444';
                    })(), 
                    background: (() => {
                      if (!dadosPerfil.aniversario) return 'var(--fundo-cinza)';
                      const res = validarDataNascimento(dadosPerfil.aniversario);
                      return res.valido ? 'var(--fundo-cinza)' : 'rgba(239, 68, 68, 0.05)';
                    })(), 
                    color: 'var(--texto-principal)', 
                    fontSize: '14px', 
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, background-color 0.2s'
                  }}
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
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Cargo / Função na Empresa
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.cargo || (isCollaborator ? 'Colaborador' : 'Administrador Geral')} 
                  readOnly
                  style={{ 
                    width: '100%', 
                    minWidth: 0, 
                    padding: '13px 16px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--borda)', 
                    background: 'var(--fundo-cinza)', 
                    color: 'var(--texto-principal)', 
                    fontWeight: '800', 
                    cursor: 'default', 
                    fontSize: '14px', 
                    boxSizing: 'border-box' 
                  }}
                  title="Cargo definido na página de Equipe e Acessos"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
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

            {/* LINHA 1: CEP E ESTADO (UF) EM 2 COLUNAS */}
            <div className="profile-fields-2col-row">
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
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
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Estado (UF)
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.uf} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, uf: e.target.value.toUpperCase() })} 
                  placeholder="UF (ex: SP)"
                  maxLength="2"
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'uppercase' }}
                />
              </div>
            </div>

            {/* LINHA 2: LOGRADOURO / RUA E NÚMERO (RUA MAIOR QUE NÚMERO) */}
            <div 
              className="profile-fields-2col-row profile-fields-rua-num"
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '2.5fr 1fr', 
                gap: '16px', 
                marginBottom: '16px', 
                width: '100%', 
                boxSizing: 'border-box' 
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Logradouro / Rua
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.rua} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, rua: e.target.value })} 
                  onBlur={(e) => setDadosPerfil({ ...dadosPerfil, rua: capitalize(e.target.value) })}
                  placeholder="Av. Paulista, Rua Flores..."
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Número
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.numero} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, numero: e.target.value })} 
                  placeholder="Ex: 100"
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* LINHA 3: BAIRRO E CIDADE EM 2 COLUNAS */}
            <div className="profile-fields-2col-row">
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Bairro
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.bairro} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, bairro: e.target.value })} 
                  onBlur={(e) => setDadosPerfil({ ...dadosPerfil, bairro: capitalize(e.target.value) })}
                  placeholder="Seu bairro"
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                  Cidade
                </label>
                <input 
                  type="text" 
                  value={dadosPerfil.cidade} 
                  onChange={(e) => setDadosPerfil({ ...dadosPerfil, cidade: e.target.value })} 
                  onBlur={(e) => setDadosPerfil({ ...dadosPerfil, cidade: capitalize(e.target.value) })}
                  placeholder="Sua cidade"
                  style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box', textTransform: 'capitalize' }}
                />
              </div>
            </div>

            {/* LINHA 4: COMPLEMENTO (ABAIXO DE BAIRRO E CIDADE) */}
            <div className="profile-field-full" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginTop: '2px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
                Complemento (Opcional)
              </label>
              <input 
                type="text" 
                value={dadosPerfil.complemento} 
                onChange={(e) => setDadosPerfil({ ...dadosPerfil, complemento: e.target.value })} 
                placeholder="Ex: Apto 42, Bloco B, Sala 3, etc."
                style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <hr style={{ borderColor: 'var(--borda)', margin: 0 }} />

          {/* SEÇÃO 3: CREDENCIAIS DE ACESSO */}
          <div className="profile-field-full" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '26px', fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)', marginBottom: '6px', lineHeight: 1.2 }}>
              E-mail de Login (Acesso ao Sistema)
            </label>
            <input 
              type="email" 
              value={dadosPerfil.email} 
              readOnly 
              style={{ width: '100%', minWidth: 0, padding: '13px 16px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-secundario)', cursor: 'not-allowed', fontSize: '14px', boxSizing: 'border-box', fontWeight: '600' }} 
              title="E-mail de login cadastrado e autenticado"
            />
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