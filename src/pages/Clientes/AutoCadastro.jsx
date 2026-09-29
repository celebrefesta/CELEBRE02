import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebaseConfig'; 
import { collection, addDoc, serverTimestamp, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { validarCPF, validarCNPJ } from '../../utils/validadores';
import { consultarCNPJ } from '../../utils/consultaCnpj';
import { processarDisparoAutomatico } from '../../utils/notificacoesDispatchService';
import './AutoCadastro.css';

// 🎨 GERADOR DINÂMICO DE PALETA EXCLUSIVA (HARMONIA DE LUXO IDÊNTICA AO CATÁLOGO)
const processarPaletaVitrine = (hexCor) => {
  const hex = (hexCor || '#c5a059').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 197;
  const g = parseInt(hex.substring(2, 4), 16) || 160;
  const b = parseInt(hex.substring(4, 6), 16) || 89;

  const rL = Math.min(255, Math.round(r + (255 - r) * 0.28));
  const gL = Math.min(255, Math.round(g + (255 - g) * 0.28));
  const bL = Math.min(255, Math.round(b + (255 - b) * 0.28));
  const clara = `rgb(${rL}, ${gL}, ${bL})`;

  const rD = Math.max(0, Math.round(r * 0.75));
  const gD = Math.max(0, Math.round(g * 0.75));
  const bD = Math.max(0, Math.round(g * 0.75));
  const escura = `rgb(${rD}, ${gD}, ${bD})`;

  const glow = `rgba(${r}, ${g}, ${b}, 0.28)`;
  const soft = `rgba(${r}, ${g}, ${b}, 0.08)`;
  const borderSoft = `rgba(${r}, ${g}, ${b}, 0.25)`;

  return {
    primaria: `#${hex}`,
    clara,
    escura,
    glow,
    soft,
    borderSoft
  };
};

export const formatarNomeCapitalizado = (nomeBruto) => {
  if (!nomeBruto || typeof nomeBruto !== 'string') return '';
  const conectores = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'];
  const palavras = nomeBruto.trim().split(/\s+/);
  return palavras.map((palavra, index) => {
    if (!palavra) return '';
    const lower = palavra.toLowerCase();
    if (index > 0 && conectores.includes(lower)) return lower;
    return palavra.replace(/([\p{L}]+)/gu, (match) => {
      return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });
  }).join(' ');
};

// ⚡ Capitalização em tempo real na digitação (1ª letra Maiúscula e 2ª em diante Minúscula, preservando espaços e conectores)
export const capitalizarPalavrasAoDigitar = (texto) => {
  if (!texto || typeof texto !== 'string') return '';
  const conectores = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'];
  return texto.split(/(\s+)/).map((parte, index) => {
    if (/^\s+$/.test(parte)) return parte;
    if (!parte) return '';
    const lower = parte.toLowerCase();
    if (index > 0 && conectores.includes(lower)) {
      return lower;
    }
    return parte.replace(/([\p{L}]+)/gu, (match) => {
      return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });
  }).join('');
};

const AutoCadastro = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { idEmpresa } = useParams();
  const auth = getAuth();
  
  // 1. Extração do tenantId da URL (/autocadastro/:idEmpresa), query string (?t=...), state ou cache
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryTenantId = queryParams.get('t') || queryParams.get('idEmpresa') || queryParams.get('empresa') || queryParams.get('tenantId');
  const tenantIdAlvo = idEmpresa || queryTenantId || location.state?.empresaConfig?.userId || localStorage.getItem('tenantId');

  const carrinho = location.state?.carrinhoCatalogo || [];
  const [empresa, setEmpresa] = useState(() => {
    const salvoCor = localStorage.getItem('corMarcaCatalogo');
    const stateEmp = location.state?.empresaConfig;
    return {
      nome: stateEmp?.nome || 'CELEBRE FESTAS',
      logo: stateEmp?.logo || '',
      whats: stateEmp?.whats || '',
      corMarca: stateEmp?.corMarca || salvoCor || '#c5a059',
      capa: stateEmp?.capa || '',
      descricao: stateEmp?.descricao || 'Vitrine Oficial de Locação & Cenografia',
      endereco: stateEmp?.endereco || '',
      insta: stateEmp?.insta || ''
    };
  });

  // 📡 SINCRONIZAÇÃO EM TEMPO REAL COM A APARÊNCIA DO CATÁLOGO (configuracoes_empresa)
  useEffect(() => {
    if (!tenantIdAlvo) return;

    const refDoc = doc(db, "configuracoes_empresa", tenantIdAlvo);
    const unsub = onSnapshot(refDoc, async (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        const cor = d.corMarcaCatalogo || d.accentColor || localStorage.getItem('corMarcaCatalogo') || '#c5a059';
        localStorage.setItem('corMarcaCatalogo', cor);
        setEmpresa(prev => ({
          ...prev,
          nome: d.tituloCatalogo || d.nomeEmpresa || d.nome || prev.nome,
          logo: d.logoUrl || d.logo || d.logotipo || prev.logo,
          whats: d.whatsapp || d.telefone || prev.whats,
          corMarca: cor,
          capa: d.bannerUrl || d.capaUrl || prev.capa,
          descricao: d.descricaoCatalogo || prev.descricao,
          endereco: d.endereco || prev.endereco,
          insta: d.instagram || prev.insta
        }));
      } else {
        // Fallback caso a loja ainda não tenha configuracoes_empresa específica
        try {
          const userDoc = await getDoc(doc(db, "usuarios", tenantIdAlvo));
          if (userDoc.exists()) {
            const ud = userDoc.data();
            setEmpresa(prev => ({
              ...prev,
              nome: ud.nomeFantasia || ud.nomeEmpresa || ud.nome || prev.nome,
              logo: ud.fotoUrl || ud.logo || prev.logo,
              whats: ud.telefone || ud.whatsapp || prev.whats
            }));
          }
        } catch (e) {
          console.warn("Aviso ao buscar dados de fallback da loja:", e);
        }
      }
    }, (err) => {
      console.warn("Aviso ao sincronizar vitrine com auto-cadastro:", err);
    });

    return () => unsub();
  }, [tenantIdAlvo]);

  const [logoComErro, setLogoComErro] = useState(false);
  useEffect(() => {
    setLogoComErro(false);
  }, [empresa.logo]);

  const paleta = useMemo(() => {
    return processarPaletaVitrine(empresa.corMarca);
  }, [empresa.corMarca]);

  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [statusCnpj, setStatusCnpj] = useState(null);
  const [tipoPessoa, setTipoPessoa] = useState('fisica');
  const [concluido, setConcluido] = useState(false);

  const [form, setForm] = useState({
    nome: '', documento: '', contato: '', email: '', 
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', dataEvento: '',
    observacoes: ''
  });

  // Sugestão em tempo real de nome com iniciais maiúsculas (Ex: "michel silva" -> "Michel Silva")
  const nomeSugerido = formatarNomeCapitalizado(form.nome);
  const podeCapitalizarNome = Boolean(
    nomeSugerido && 
    form.nome && 
    form.nome.trim().length >= 2 && 
    nomeSugerido !== form.nome.trim()
  );

  const aplicarCapitalizacaoNome = () => {
    if (nomeSugerido) {
      setForm(prev => ({ ...prev, nome: nomeSugerido }));
    }
  };

  const handleBlurCapitalize = (e) => {
    const { name, value } = e.target;
    if (!value || typeof value !== 'string') return;
    if (['nome', 'logradouro', 'bairro', 'cidade'].includes(name)) {
      const formatado = formatarNomeCapitalizado(value);
      if (formatado && formatado !== value) {
        setForm(prev => ({ ...prev, [name]: formatado }));
      }
    }
  };

  const maskCPFOrCNPJ = (v) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      v = v.replace(/^(\d{2})(\d)/, "$1.$2");
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
      v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    return v.substring(0, 18);
  };

  const maskPhone = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v.substring(0, 15);
  };

  const maskCEP = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    return v.substring(0, 9);
  };

  const buscarCep = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      setBuscandoCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            logradouro: formatarNomeCapitalizado(data.logradouro) || data.logradouro || '',
            bairro: formatarNomeCapitalizado(data.bairro) || data.bairro || '',
            cidade: formatarNomeCapitalizado(data.localidade) || data.localidade || ''
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  const buscarCnpj = async (cnpjEntrada) => {
    const limpo = String(cnpjEntrada || '').replace(/\D/g, '');
    if (limpo.length !== 14) return;
    setBuscandoCnpj(true);
    setStatusCnpj(null);
    try {
      const res = await consultarCNPJ(limpo);
      if (res.sucesso) {
        setStatusCnpj({
          situacao: res.situacaoCadastral,
          isAtiva: res.isAtiva,
          provedor: res.provedor
        });
        setForm(prev => ({
          ...prev,
          nome: prev.nome ? prev.nome : formatarNomeCapitalizado(res.nomeExibicao),
          cep: res.cep || prev.cep,
          logradouro: res.logradouro ? formatarNomeCapitalizado(res.logradouro) : prev.logradouro,
          numero: res.numero || prev.numero,
          complemento: res.complemento || prev.complemento,
          bairro: res.bairro ? formatarNomeCapitalizado(res.bairro) : prev.bairro,
          cidade: res.cidade ? formatarNomeCapitalizado(res.cidade) : prev.cidade,
          contato: prev.contato ? prev.contato : res.telefone,
          email: prev.email ? prev.email : res.email
        }));
      } else {
        setStatusCnpj({ erro: res.erro, isAtiva: false, situacao: 'NÃO ENCONTRADO' });
      }
    } catch (err) {
      console.error("Erro na busca de CNPJ no auto-cadastro:", err);
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleChange = (e) => { 
    let { name, value } = e.target;
    if (['nome', 'cidade', 'logradouro', 'bairro'].includes(name)) {
      value = capitalizarPalavrasAoDigitar(value);
    }
    if (name === 'documento') {
      value = maskCPFOrCNPJ(value);
      const docLimpo = value.replace(/\D/g, '');
      if (tipoPessoa === 'juridica' && docLimpo.length === 14) {
        buscarCnpj(docLimpo);
      }
    }
    if (name === 'contato') value = maskPhone(value);
    if (name === 'cep') {
      value = maskCEP(value);
      if (value.length === 9) buscarCep(value);
    }
    setForm(prev => ({ ...prev, [name]: value })); 
  };

  const calcularTotal = () => carrinho.reduce((acc, i) => acc + (Number(i.financeiro?.valorAluguel || i.preco || 0) * i.qtd), 0);

  const finalizarCadastroE_Pedido = async (e) => {
    e.preventDefault();
    if (!form.email) {
      alert("Por favor, preencha o seu e-mail para receber a confirmação!");
      return;
    }

    setLoading(true);

    try {
      const isJuridica = tipoPessoa === 'juridica' || form.documento.replace(/\D/g, '').length > 11;
      const docLimpo = (form.documento || '').replace(/\D/g, '');

      if (!docLimpo) {
        alert("Por favor, preencha o seu " + (isJuridica ? "CNPJ" : "CPF") + "!");
        setLoading(false);
        return;
      }

      if (isJuridica) {
        if (docLimpo.length !== 14 || !validarCNPJ(docLimpo)) {
          alert("⚠️ CNPJ inválido! Por favor, informe um CNPJ oficial com 14 dígitos válido na Receita Federal.");
          setLoading(false);
          return;
        }
      } else {
        if (docLimpo.length !== 11 || !validarCPF(docLimpo)) {
          alert("⚠️ CPF inválido! Por favor, informe um CPF oficial com 11 dígitos válido na Receita Federal.");
          setLoading(false);
          return;
        }
      }

      const idDaLoja = idEmpresa || empresa.userId || empresa.id || (auth.currentUser ? auth.currentUser.uid : null);
      
      if (!idDaLoja) {
          alert("Erro de segurança: Não foi possível identificar a qual loja este cadastro pertence.");
          setLoading(false);
          return;
      }

      // Sanitiza e padroniza os campos de texto com primeira letra maiúscula (Ex: "Michel Silva")
      const nomeFinal = formatarNomeCapitalizado(form.nome) || (form.nome || '').trim();
      const logradouroFinal = formatarNomeCapitalizado(form.logradouro) || (form.logradouro || '').trim();
      const bairroFinal = formatarNomeCapitalizado(form.bairro) || (form.bairro || '').trim();
      const cidadeFinal = formatarNomeCapitalizado(form.cidade) || (form.cidade || '').trim();

      // 1. Salva o cliente
      const clienteRef = await addDoc(collection(db, "clientes"), {
        nome: nomeFinal,
        nomeFantasia: isJuridica ? nomeFinal : '',
        cpf: !isJuridica ? form.documento : '',
        cnpj: isJuridica ? form.documento : '',
        celular: form.contato,
        email: form.email,
        cep: form.cep,
        logradouro: logradouroFinal,
        numero: form.numero,
        complemento: form.complemento,
        bairro: bairroFinal,
        cidade: cidadeFinal,
        observacoes: form.observacoes,
        situacaoFinanceira: 'pendente', 
        statusAprovacao: 'pendente', // ⏳ Requer aprovação da loja antes de virar ativo
        origem: 'Auto-Cadastro (Link Público)',
        tipoPessoa: isJuridica ? 'juridica' : 'fisica', 
        criadoEm: serverTimestamp(),
        userId: idDaLoja 
      });

      // 2. Salva o orçamento se houver itens no carrinho
      if (carrinho.length > 0) {
        const total = calcularTotal();
        await addDoc(collection(db, "locacoes"), {
          clienteId: clienteRef.id,
          clienteNome: nomeFinal,
          clienteWhats: form.contato,
          dataRetirada: form.dataEvento,
          itens: carrinho,
          valorTotal: total,
          status: 'orcamento',
          origem: 'catalogo_publico',
          criadoEm: serverTimestamp(),
          userId: idDaLoja
        });
      }

      // 3. Disparo Automático de Notificações (Gestor + Boas-Vindas Cliente)
      processarDisparoAutomatico({
        tenantId: idDaLoja,
        evento: 'novo_cadastro_cliente',
        destinatario: 'gestor',
        dados: {
          nomeCliente: nomeFinal,
          clienteEmail: form.email,
          clienteTelefone: form.contato,
          documento: form.documento,
          cidade: cidadeFinal,
          nomeEmpresa: empresa.nome || 'Celebre Festas',
          telefoneEmpresa: empresa.whats || ''
        }
      }).catch(e => console.warn("Aviso ao notificar gestor sobre novo cadastro:", e));

      processarDisparoAutomatico({
        tenantId: idDaLoja,
        evento: 'boas_vindas_catalogo',
        destinatario: 'cliente',
        dados: {
          nomeCliente: nomeFinal,
          clienteEmail: form.email,
          clienteTelefone: form.contato,
          dataEvento: form.dataEvento ? form.dataEvento.split('-').reverse().join('/') : '',
          nomeEmpresa: empresa.nome || 'Celebre Festas',
          telefoneEmpresa: empresa.whats || ''
        }
      }).catch(e => console.warn("Aviso ao enviar boas-vindas ao cliente:", e));

      // Audit Log
      try {
        await addDoc(collection(db, "logs_atividades"), {
          empresaId: idDaLoja, 
          funcionarioId: "auto_cadastro",
          nomeFuncionario: "Auto-Cadastro Público 📱",
          acao: "AUTO-CADASTRO DE CLIENTE",
          tipo: "CRIACAO",
          detalhes: `O cliente ${nomeFinal} preencheu a própria ficha via link público. ${carrinho.length > 0 ? `Com pedido de ${carrinho.length} itens.` : ''}`,
          dataHora: new Date().toISOString()
        });
      } catch (errLog) {}

      setForm(prev => ({
        ...prev,
        nome: nomeFinal,
        logradouro: logradouroFinal,
        bairro: bairroFinal,
        cidade: cidadeFinal
      }));

      setConcluido(true);
    } catch (error) {
      console.error("Erro no cadastro:", error);
      alert("Ocorreu um erro ao salvar seu cadastro. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (concluido) {
    const idDaLoja = tenantIdAlvo || idEmpresa || empresa.userId || empresa.id;
    const foneLoja = (empresa.whats || empresa.telefone || '').replace(/\D/g, '');
    const linkWhats = foneLoja ? `https://wa.me/55${foneLoja}?text=${encodeURIComponent(`Olá! Concluí meu cadastro no site em nome de ${form.nome}.`)}` : null;

    return (
      <div className="autocadastro-luxury-wrapper fade-in" style={{ '--cor-marca': paleta.primaria }}>
        <style>{`
          .autocadastro-luxury-wrapper {
            --cor-marca: ${paleta.primaria} !important;
            --cor-marca-glow: ${paleta.glow} !important;
          }
          .autocadastro-luxury-wrapper .btn-ir-catalogo-success {
            background: linear-gradient(135deg, ${paleta.primaria} 0%, ${paleta.escura} 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 8px 20px ${paleta.glow} !important;
          }
        `}</style>

        <div className="autocadastro-card-luxury text-center-success" style={{ textAlign: 'center', padding: '50px 30px' }}>
          {empresa.logo && !logoComErro ? (
            <div className="autocadastro-brand-logo-container" style={{ marginBottom: '16px' }}>
              <img 
                src={empresa.logo} 
                alt={empresa.nome || 'Logotipo'} 
                className="autocadastro-brand-logo-img"
                onError={() => setLogoComErro(true)}
              />
            </div>
          ) : (
            <div className="company-badge-icon" style={{ width: '64px', height: '64px', fontSize: '28px', marginBottom: '16px' }}>
              🎉
            </div>
          )}
          
          <h2 style={{ fontSize: '1.6rem', fontWeight: '850', color: '#0f172a', margin: '0 0 10px 0' }}>
            Cadastro Recebido com Sucesso!
          </h2>
          
          <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: '1.5', maxWidth: '440px', margin: '0 auto 28px auto' }}>
            Obrigado, <strong>{form.nome.split(' ')[0]}</strong>! Sua ficha foi enviada com sucesso para a equipe da <strong>{empresa.nome || 'Celebre'}</strong>.
            {carrinho.length > 0 
              ? ` Recebemos também a sua lista de ${carrinho.length} itens para orçamento. Em breve nossa equipe entrará em contato via WhatsApp.`
              : ` Sua solicitação está em análise e farão a aprovação do seu perfil.`}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px', margin: '0 auto' }}>
            {linkWhats && (
              <a href={linkWhats} target="_blank" rel="noopener noreferrer" className="btn-finalizar-luxury" style={{ background: '#25d366', textDecoration: 'none', color: '#fff', boxShadow: '0 8px 20px rgba(37, 211, 102, 0.3)' }}>
                <i className="fab fa-whatsapp"></i> Falar no WhatsApp da Loja
              </a>
            )}

            {idDaLoja && (
              <button 
                type="button" 
                onClick={() => navigate(`/catalogo/${idDaLoja}`)} 
                className="btn-finalizar-luxury btn-ir-catalogo-success"
              >
                🛍️ Ir para o Catálogo de Peças
              </button>
            )}

            <button 
              type="button" 
              onClick={() => { setConcluido(false); setForm({ nome: '', documento: '', contato: '', email: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', dataEvento: '', observacoes: '' }); }}
              style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
            >
              Fazer novo cadastro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="autocadastro-luxury-wrapper fade-in" style={{ '--cor-marca': paleta.primaria }}>
      {/* 🎨 MOTOR DINÂMICO DE IDENTIDADE VISUAL EXCLUSIVA (SINCRONIZADO COM MINHA VITRINE / CATÁLOGO) */}
      <style>{`
        .autocadastro-luxury-wrapper {
          --cor-marca: ${paleta.primaria} !important;
          --cor-marca-clara: ${paleta.clara} !important;
          --cor-marca-escura: ${paleta.escura} !important;
          --cor-marca-glow: ${paleta.glow} !important;
          --cor-marca-soft: ${paleta.soft} !important;
          --cor-marca-border: ${paleta.borderSoft} !important;
        }

        .autocadastro-luxury-wrapper .autocadastro-hero-banner {
          border-bottom-color: ${paleta.primaria} !important;
        }

        .autocadastro-luxury-wrapper .company-badge-icon {
          background: linear-gradient(135deg, ${paleta.primaria} 0%, ${paleta.escura} 100%) !important;
          box-shadow: 0 8px 20px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .autocadastro-brand-logo-img {
          border-color: ${paleta.primaria} !important;
          box-shadow: 0 8px 24px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .toggle-btn.active {
          background: ${paleta.primaria} !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .sessao-label-custom {
          color: ${paleta.primaria} !important;
        }

        .autocadastro-luxury-wrapper .sessao-label-custom i {
          color: ${paleta.primaria} !important;
        }

        .autocadastro-luxury-wrapper .btn-sugestao-nome-caps {
          background: ${paleta.soft} !important;
          color: ${paleta.primaria} !important;
          border-color: ${paleta.borderSoft} !important;
        }

        .autocadastro-luxury-wrapper .btn-sugestao-nome-caps:hover {
          background: ${paleta.primaria} !important;
          color: #ffffff !important;
          border-color: ${paleta.escura} !important;
          box-shadow: 0 4px 10px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .btn-sugestao-nome-caps i {
          color: ${paleta.primaria} !important;
        }

        .autocadastro-luxury-wrapper .btn-sugestao-nome-caps:hover i {
          color: #ffffff !important;
        }

        .autocadastro-luxury-wrapper .input-with-icon input:focus {
          border-color: ${paleta.primaria} !important;
          box-shadow: 0 0 0 4px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .btn-autocadastro-cnpj {
          background: linear-gradient(135deg, ${paleta.primaria} 0%, ${paleta.escura} 100%) !important;
          box-shadow: 0 2px 8px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .btn-finalizar-luxury {
          background: linear-gradient(135deg, ${paleta.primaria} 0%, ${paleta.escura} 100%) !important;
          box-shadow: 0 10px 25px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .btn-finalizar-luxury:hover {
          box-shadow: 0 14px 30px ${paleta.glow} !important;
        }

        .autocadastro-luxury-wrapper .chip-qtd {
          color: ${paleta.primaria} !important;
        }
      `}</style>

      <div className="autocadastro-card-luxury">
        
        {/* TOP HERO BANNER COM CAPA E LOGO DA VITRINE */}
        <header 
          className="autocadastro-hero-banner"
          style={empresa.capa ? { 
            backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.78) 0%, rgba(15, 23, 42, 0.94) 100%), url(${empresa.capa})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          } : {}}
        >
          <button className="btn-voltar-pill" onClick={() => navigate(-1)} title="Voltar">
            <i className="fas fa-arrow-left"></i> Voltar
          </button>
          
          {empresa.logo && !logoComErro ? (
            <div className="autocadastro-brand-logo-container">
              <img 
                src={empresa.logo} 
                alt={empresa.nome || 'Logotipo'} 
                className="autocadastro-brand-logo-img"
                onError={() => setLogoComErro(true)}
              />
            </div>
          ) : (
            <div className="company-badge-icon">
              <i className="fas fa-crown"></i>
            </div>
          )}

          <h2>Olá! Vamos começar?</h2>
          <p>Preencha os dados abaixo para concluir seu cadastro na <strong>{empresa.nome || 'Celebre'}</strong>.</p>
        </header>

        {/* PRÉVIA DO CARRINHO SE HOUVER ITENS */}
        {carrinho.length > 0 && (
          <div className="autocadastro-carrinho-preview">
            <div className="carrinho-banner-header">
              <span>🛍️ <strong>{carrinho.length} peça{carrinho.length === 1 ? '' : 's'} selecionada{carrinho.length === 1 ? '' : 's'}</strong></span>
              <span className="carrinho-total-badge">
                Est. R$ {calcularTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="carrinho-items-scroll">
              {carrinho.map((item, idx) => (
                <div key={idx} className="carrinho-item-chip">
                  {item.foto || item.imagem ? (
                    <img src={item.foto || item.imagem} alt={item.nome} className="chip-img" />
                  ) : (
                    <span className="chip-box-icon">📦</span>
                  )}
                  <span className="chip-title">{item.nome}</span>
                  <span className="chip-qtd">x{item.qtd}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FORMULÁRIO DE AUTO-CADASTRO */}
        <form onSubmit={finalizarCadastroE_Pedido} className="autocadastro-form-body">
          
          {/* SELECTOR PESSOA FÍSICA / JURÍDICA */}
          <div className="tipo-pessoa-toggle-row">
            <button
              type="button"
              className={`toggle-btn ${tipoPessoa === 'fisica' ? 'active' : ''}`}
              onClick={() => { setTipoPessoa('fisica'); setForm(prev => ({ ...prev, documento: '' })); }}
            >
              <i className="fas fa-user"></i> Pessoa Física
            </button>
            <button
              type="button"
              className={`toggle-btn ${tipoPessoa === 'juridica' ? 'active' : ''}`}
              onClick={() => { setTipoPessoa('juridica'); setForm(prev => ({ ...prev, documento: '' })); }}
            >
              <i className="fas fa-building"></i> Pessoa Jurídica
            </button>
          </div>

          {/* DADOS DE IDENTIFICAÇÃO */}
          <div className="sessao-label-custom">
            <i className="fas fa-id-card"></i> IDENTIFICAÇÃO
          </div>
          
          <div className="form-row-dupla">
            <div className="form-group-custom">
              <div className="label-with-option-row">
                <label htmlFor="autocadastro-nome">
                  {tipoPessoa === 'juridica' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}
                </label>
                {podeCapitalizarNome && (
                  <button
                    type="button"
                    className="btn-sugestao-nome-caps"
                    onClick={aplicarCapitalizacaoNome}
                    title="Clique para formatar com primeira letra maiúscula"
                  >
                    <i className="fas fa-magic"></i> {nomeSugerido}
                  </button>
                )}
              </div>
              <div className="input-with-icon">
                <i className="fas fa-user input-icon"></i>
                <input 
                  id="autocadastro-nome"
                  type="text" 
                  name="nome" 
                  placeholder={tipoPessoa === 'juridica' ? 'Ex: Festas & Eventos Ltda' : 'Ex: Michel Silva'} 
                  value={form.nome}
                  autoCapitalize="words"
                  autoComplete="name"
                  required 
                  onChange={handleChange} 
                  onBlur={handleBlurCapitalize}
                />
              </div>
            </div>

            <div className="form-group-custom">
              <label>E-mail Principal *</label>
              <div className="input-with-icon">
                <i className="fas fa-envelope input-icon"></i>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="seu.email@exemplo.com" 
                  value={form.email} 
                  required 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>
          
          <div className="form-row-dupla">
            <div className="form-group-custom">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {tipoPessoa === 'juridica' ? 'CNPJ *' : 'CPF *'}
                  {buscandoCnpj && (
                    <span style={{ color: 'var(--cor-marca, #c5a059)', fontWeight: 'bold', fontSize: '0.68rem', marginLeft: '6px' }}>
                      ⏳ Consultando...
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {statusCnpj && (
                    <span 
                      style={{ 
                        color: statusCnpj.isAtiva ? '#16a34a' : '#ef4444', 
                        backgroundColor: statusCnpj.isAtiva ? 'rgba(22, 163, 74, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${statusCnpj.isAtiva ? 'rgba(22, 163, 74, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: '800', 
                        fontSize: '0.62rem',
                        letterSpacing: '0.5px'
                      }}
                      title={`Situação: ${statusCnpj.situacao} (Fonte: ${statusCnpj.provedor})`}
                    >
                      {statusCnpj.isAtiva ? '✓' : '⚠️'} {statusCnpj.situacao}
                    </span>
                  )}
                  {(() => {
                    const dLimpo = (form.documento || '').replace(/\D/g, '');
                    if (tipoPessoa === 'fisica' && dLimpo.length === 11) {
                      return validarCPF(dLimpo) ? (
                        <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '0.72rem' }}>✓ VÁLIDO</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: '800', fontSize: '0.72rem' }}>✗ INVÁLIDO</span>
                      );
                    }
                    if (tipoPessoa === 'juridica' && dLimpo.length === 14) {
                      return validarCNPJ(dLimpo) ? (
                        <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '0.72rem' }}>✓ VÁLIDO</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: '800', fontSize: '0.72rem' }}>✗ INVÁLIDO</span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </label>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <i className="fas fa-address-card input-icon"></i>
                <input 
                  type="text" 
                  name="documento" 
                  placeholder={tipoPessoa === 'juridica' ? '00.000.000/0001-00' : '000.000.000-00'} 
                  value={form.documento} 
                  required 
                  onChange={handleChange} 
                  style={tipoPessoa === 'juridica' ? { paddingRight: '88px' } : {}}
                />
                {tipoPessoa === 'juridica' && (
                  <button 
                    type="button" 
                    className="btn-autocadastro-cnpj"
                    onClick={() => buscarCnpj(form.documento)}
                    disabled={buscandoCnpj || (form.documento || '').replace(/\D/g, '').length !== 14}
                    title="Consultar dados da empresa na Receita Federal"
                  >
                    {buscandoCnpj ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-search"></i> Buscar</>}
                  </button>
                )}
              </div>
            </div>

            <div className="form-group-custom">
              <label>WhatsApp / Celular *</label>
              <div className="input-with-icon">
                <i className="fab fa-whatsapp input-icon icon-zap"></i>
                <input 
                  type="text" 
                  name="contato" 
                  placeholder="(11) 90000-0000" 
                  value={form.contato} 
                  required 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>

          {/* ENDEREÇO DE ENTREGA OU RESIDÊNCIA */}
          <div className="sessao-label-custom">
            <i className="fas fa-map-marker-alt"></i> ENDEREÇO
          </div>
          
          <div className="form-row-dupla">
            <div className="form-group-custom">
              <label>CEP {buscandoCep && <span className="cep-loading-txt"><i className="fas fa-spinner fa-spin"></i> Buscando...</span>}</label>
              <div className="input-with-icon">
                <i className="fas fa-search-location input-icon"></i>
                <input 
                  type="text" 
                  name="cep" 
                  placeholder="00000-000" 
                  value={form.cep} 
                  onChange={handleChange} 
                />
              </div>
            </div>

            <div className="form-group-custom">
              <label>Cidade *</label>
              <div className="input-with-icon">
                <i className="fas fa-city input-icon"></i>
                <input 
                  type="text" 
                  name="cidade" 
                  placeholder="Sua cidade" 
                  value={form.cidade} 
                  autoCapitalize="words"
                  required 
                  onChange={handleChange} 
                  onBlur={handleBlurCapitalize}
                />
              </div>
            </div>
          </div>
          
          <div className="form-row-dupla">
            <div className="form-group-custom">
              <label>Rua / Logradouro *</label>
              <div className="input-with-icon">
                <i className="fas fa-road input-icon"></i>
                <input 
                  type="text" 
                  name="logradouro" 
                  placeholder="Endereço (Rua, Avenida, Alameda...)" 
                  value={form.logradouro} 
                  autoCapitalize="words"
                  required 
                  onChange={handleChange} 
                  onBlur={handleBlurCapitalize}
                />
              </div>
            </div>

            <div className="form-group-custom">
              <label>Número *</label>
              <div className="input-with-icon">
                <i className="fas fa-hashtag input-icon"></i>
                <input 
                  type="text" 
                  name="numero" 
                  placeholder="Ex: 123 ou S/N" 
                  value={form.numero} 
                  required 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>
          
          <div className="form-row-dupla">
            <div className="form-group-custom">
              <label>Bairro *</label>
              <div className="input-with-icon">
                <i className="fas fa-building input-icon"></i>
                <input 
                  type="text" 
                  name="bairro" 
                  placeholder="Seu bairro" 
                  value={form.bairro} 
                  autoCapitalize="words"
                  required 
                  onChange={handleChange} 
                  onBlur={handleBlurCapitalize}
                />
              </div>
            </div>

            <div className="form-group-custom">
              <label>Complemento (Opcional)</label>
              <div className="input-with-icon">
                <i className="fas fa-info-circle input-icon"></i>
                <input 
                  type="text" 
                  name="complemento" 
                  placeholder="Apto, Bloco, Casa..." 
                  value={form.complemento} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>

          {/* DETALHES DO EVENTO SE HOUVER CARRINHO */}
          {carrinho.length > 0 && (
             <>
                <div className="sessao-label-custom">
                  <i className="fas fa-calendar-alt"></i> DETALHES DA FESTA / EVENTO
                </div>
                <div className="form-group-custom full">
                  <label>Data Prevista do Evento / Retirada *</label>
                  <div className="input-with-icon">
                    <i className="fas fa-calendar-check input-icon"></i>
                    <input 
                      type="date" 
                      name="dataEvento" 
                      required 
                      onChange={handleChange} 
                    />
                  </div>
                </div>
            </>
          )}

          {/* BOTÃO PRINCIPAL DE ENVIO */}
          <button type="submit" className="btn-finalizar-luxury" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> SALVANDO CADASTRO...
              </>
            ) : (
              <>
                🚀 FINALIZAR E ENVIAR SOLICITAÇÃO <i className="fas fa-arrow-right"></i>
              </>
            )}
          </button>
        </form>

        <footer className="autocadastro-footer-notice">
          <p><i className="fas fa-shield-alt"></i> Seus dados estão seguros e protegidos pela LGPD.</p>
          {empresa.whats && (
            <div className="autocadastro-help-whatsapp">
              <span>Dúvidas no preenchimento?</span>
              <a 
                href={`https://wa.me/55${empresa.whats.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Estou na página de cadastro da ${empresa.nome || 'loja'} e preciso de ajuda.`)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="autocadastro-help-whatsapp-link"
                title="Falar com nossa equipe via WhatsApp"
              >
                <i className="fab fa-whatsapp"></i> Tirar dúvidas no WhatsApp
              </a>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default AutoCadastro;