import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebaseConfig'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { validarCPF, validarCNPJ } from '../../utils/validadores';
import { consultarCNPJ } from '../../utils/consultaCnpj';
import { processarDisparoAutomatico } from '../../utils/notificacoesDispatchService';
import './AutoCadastro.css';

export const formatarNomeCapitalizado = (nomeBruto) => {
  if (!nomeBruto || typeof nomeBruto !== 'string') return '';
  const conectores = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'];
  const palavras = nomeBruto.trim().toLowerCase().split(/\s+/);
  return palavras.map((palavra, index) => {
    if (!palavra) return '';
    if (index > 0 && conectores.includes(palavra)) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }).join(' ');
};

// ⚡ Capitalização em tempo real na digitação (sem perder espaços nem alterar tamanho do texto)
export const capitalizarPalavrasAoDigitar = (texto) => {
  if (!texto || typeof texto !== 'string') return '';
  return texto.replace(/(^|[\s])([a-z\u00C0-\u00FF])/g, (match, sep, char) => {
    return sep + char.toUpperCase();
  });
};

const AutoCadastro = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { idEmpresa } = useParams();
  const auth = getAuth();
  
  const carrinho = location.state?.carrinhoCatalogo || [];
  const empresa = location.state?.empresaConfig || { nome: 'CELEBRE DECORAÇÕES', whats: '' };

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
    const idDaLoja = idEmpresa || empresa.userId || empresa.id;
    const foneLoja = (empresa.whats || empresa.telefone || '').replace(/\D/g, '');
    const linkWhats = foneLoja ? `https://wa.me/55${foneLoja}?text=${encodeURIComponent(`Olá! Concluí meu cadastro no site em nome de ${form.nome}.`)}` : null;

    return (
      <div className="autocadastro-luxury-wrapper fade-in">
        <div className="autocadastro-card-luxury text-center-success" style={{ textAlign: 'center', padding: '50px 30px' }}>
          <div className="company-badge-icon" style={{ width: '64px', height: '64px', fontSize: '28px', marginBottom: '16px' }}>
            🎉
          </div>
          
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
                className="btn-finalizar-luxury"
                style={{ background: '#0f172a', color: '#fff', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.2)' }}
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
    <div className="autocadastro-luxury-wrapper fade-in">
      <div className="autocadastro-card-luxury">
        
        {/* TOP HERO BANNER */}
        <header className="autocadastro-hero-banner">
          <button className="btn-voltar-pill" onClick={() => navigate(-1)} title="Voltar">
            <i className="fas fa-arrow-left"></i> Voltar
          </button>
          
          <div className="company-badge-icon">
            <i className="fas fa-crown"></i>
          </div>

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
          
          <div className="form-group-custom full">
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
                style={{ textTransform: 'capitalize' }}
                required 
                onChange={handleChange} 
                onBlur={handleBlurCapitalize}
              />
            </div>
          </div>

          <div className="form-group-custom full">
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
          
          <div className="form-row-dupla">
            <div className="form-group-custom">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {tipoPessoa === 'juridica' ? 'CNPJ *' : 'CPF *'}
                  {buscandoCnpj && (
                    <span style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '0.68rem', marginLeft: '6px' }}>
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
            <div className="form-group-custom input-cep">
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
                  style={{ textTransform: 'capitalize' }}
                  required 
                  onChange={handleChange} 
                  onBlur={handleBlurCapitalize}
                />
              </div>
            </div>
          </div>
          
          <div className="form-group-custom full">
            <label>Rua / Logradouro *</label>
            <div className="input-with-icon">
              <i className="fas fa-road input-icon"></i>
              <input 
                type="text" 
                name="logradouro" 
                placeholder="Endereço (Rua, Avenida, Alameda...)" 
                value={form.logradouro} 
                autoCapitalize="words"
                style={{ textTransform: 'capitalize' }}
                required 
                onChange={handleChange} 
                onBlur={handleBlurCapitalize}
              />
            </div>
          </div>
          
          <div className="form-row-dupla">
            <div className="form-group-custom input-num">
              <label>Número *</label>
              <div className="input-with-icon">
                <i className="fas fa-hashtag input-icon"></i>
                <input 
                  type="text" 
                  name="numero" 
                  placeholder="123" 
                  value={form.numero} 
                  required 
                  onChange={handleChange} 
                />
              </div>
            </div>

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
                  style={{ textTransform: 'capitalize' }}
                  required 
                  onChange={handleChange} 
                  onBlur={handleBlurCapitalize}
                />
              </div>
            </div>
          </div>

          <div className="form-group-custom full">
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
        </footer>
      </div>
    </div>
  );
};

export default AutoCadastro;