import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebaseConfig'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './AutoCadastro.css';

const AutoCadastro = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { idEmpresa } = useParams();
  const auth = getAuth();
  
  const carrinho = location.state?.carrinhoCatalogo || [];
  const empresa = location.state?.empresaConfig || { nome: 'CELEBRE DECORAÇÕES', whats: '' };

  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [tipoPessoa, setTipoPessoa] = useState('fisica');
  const [concluido, setConcluido] = useState(false);

  const [form, setForm] = useState({
    nome: '', documento: '', contato: '', email: '', 
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', dataEvento: '',
    observacoes: ''
  });

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
          const formatar = (str) => str ? str.replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase()) : '';
          setForm(prev => ({
            ...prev,
            logradouro: formatar(data.logradouro),
            bairro: formatar(data.bairro),
            cidade: formatar(data.localidade)
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  const handleChange = (e) => { 
    let { name, value } = e.target;
    if (name === 'documento') value = maskCPFOrCNPJ(value);
    if (name === 'contato') value = maskPhone(value);
    if (name === 'cep') {
      value = maskCEP(value);
      if (value.length === 9) buscarCep(value);
    }
    setForm({ ...form, [name]: value }); 
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
      const idDaLoja = idEmpresa || empresa.userId || empresa.id || (auth.currentUser ? auth.currentUser.uid : null);
      
      if (!idDaLoja) {
          alert("Erro de segurança: Não foi possível identificar a qual loja este cadastro pertence.");
          setLoading(false);
          return;
      }

      // 1. Salva o cliente
      const clienteRef = await addDoc(collection(db, "clientes"), {
        nome: form.nome,
        nomeFantasia: isJuridica ? form.nome : '',
        cpf: !isJuridica ? form.documento : '',
        cnpj: isJuridica ? form.documento : '',
        celular: form.contato,
        email: form.email,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
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
          clienteNome: form.nome,
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

      // 3. E-mail de boas-vindas
      try {
        await addDoc(collection(db, 'mail'), {
          to: form.email,
          message: {
            subject: `Sua ficha foi criada com sucesso na ${empresa.nome || 'Celebre'}! 🎉`,
            html: `
              <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 auto;">
                <div style="background-color: #0f172a; padding: 25px; text-align: center;">
                  <h1 style="color: #c5a059; margin: 0; font-size: 24px;">${empresa.nome || 'Celebre Decorações'}</h1>
                </div>
                <div style="padding: 30px;">
                  <h2 style="color: #0f172a; font-size: 20px;">Olá, ${form.nome.split(' ')[0]}!</h2>
                  <p style="font-size: 16px; line-height: 1.5;">Que alegria ter você por aqui! O seu cadastro foi concluído com sucesso e já está no nosso sistema.</p>
                  
                  ${carrinho.length > 0 ? `
                    <div style="background-color: #f8fafc; border-left: 4px solid #c5a059; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                      <p style="margin: 0; font-weight: bold; color: #1e40af;">🛍️ Seu pedido de orçamento:</p>
                      <p style="margin: 8px 0 0 0; font-size: 15px; color: #1e3a8a;">Recebemos a sua seleção de ${carrinho.length} itens. Em breve, entraremos em contato pelo seu WhatsApp para confirmar a disponibilidade para a data do evento e finalizar a locação!</p>
                    </div>
                  ` : ''}

                  <p style="font-size: 16px; line-height: 1.5;">Se tiver qualquer dúvida, basta falar com a nossa equipe.</p>
                  <p style="margin-top: 30px; font-size: 16px;">Com carinho,<br><strong>Equipe ${empresa.nome || 'Celebre'}</strong></p>
                </div>
              </div>
            `
          }
        });
      } catch (errMail) {
        console.warn("Aviso envio email:", errMail);
      }

      // Audit Log
      try {
        await addDoc(collection(db, "logs_atividades"), {
          empresaId: idDaLoja, 
          funcionarioId: "auto_cadastro",
          nomeFuncionario: "Auto-Cadastro Público 📱",
          acao: "AUTO-CADASTRO DE CLIENTE",
          tipo: "CRIACAO",
          detalhes: `O cliente ${form.nome} preencheu a própria ficha via link público. ${carrinho.length > 0 ? `Com pedido de ${carrinho.length} itens.` : ''}`,
          dataHora: new Date().toISOString()
        });
      } catch (errLog) {}

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
            <label>{tipoPessoa === 'juridica' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}</label>
            <div className="input-with-icon">
              <i className="fas fa-user input-icon"></i>
              <input 
                type="text" 
                name="nome" 
                placeholder={tipoPessoa === 'juridica' ? 'Ex: Festas & Eventos Ltda' : 'Ex: Maria Silva'} 
                value={form.nome}
                required 
                onChange={handleChange} 
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
              <label>{tipoPessoa === 'juridica' ? 'CNPJ *' : 'CPF *'}</label>
              <div className="input-with-icon">
                <i className="fas fa-address-card input-icon"></i>
                <input 
                  type="text" 
                  name="documento" 
                  placeholder={tipoPessoa === 'juridica' ? '00.000.000/0001-00' : '000.000.000-00'} 
                  value={form.documento} 
                  required 
                  onChange={handleChange} 
                />
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
                  required 
                  onChange={handleChange} 
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
                required 
                onChange={handleChange} 
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
                  required 
                  onChange={handleChange} 
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