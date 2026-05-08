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
  const empresa = location.state?.empresaConfig || { nome: 'CELEBRE', whats: '' };

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: '', documento: '', contato: '', email: '', 
    cep: '', logradouro: '', numero: '', bairro: '', cidade: '', dataEvento: ''
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
          document.querySelector('input[name="numero"]')?.focus();
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
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

  const calcularTotal = () => carrinho.reduce((acc, i) => acc + (Number(i.financeiro?.valorAluguel || 0) * i.qtd), 0);

  const finalizarCadastroE_Pedido = async (e) => {
    e.preventDefault();
    if (!form.email) {
      alert("Por favor, preencha o seu e-mail para receber a confirmação!");
      return;
    }

    setLoading(true);

    try {
      const isJuridica = form.documento.length > 14;
      const idDaLoja = idEmpresa || empresa.userId || empresa.id || (auth.currentUser ? auth.currentUser.uid : null);
      
      if (!idDaLoja) {
          alert("Erro de segurança: Não foi possível identificar a qual loja este catálogo pertence. O pedido não pode ser enviado cego.");
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
        bairro: form.bairro,
        cidade: form.cidade,
        situacaoFinanceira: 'pendente', 
        origem: 'Auto-Cadastro (Site)',
        tipoPessoa: isJuridica ? 'juridica' : 'fisica', 
        criadoEm: serverTimestamp(),
        userId: idDaLoja 
      });

      // 2. Salva o orçamento
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

      // 3. E-mail
      await addDoc(collection(db, 'mail'), {
        to: form.email,
        message: {
          subject: `Oba! Recebemos seu cadastro na ${empresa.nome} 🎉`,
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 auto;">
              <div style="background-color: #0f172a; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">${empresa.nome}</h1>
              </div>
              <div style="padding: 30px;">
                <h2 style="color: #0f172a; font-size: 20px;">Olá, ${form.nome.split(' ')[0]}!</h2>
                <p style="font-size: 16px; line-height: 1.5;">Que alegria ter você por aqui! O seu cadastro foi concluído com sucesso e já está no nosso sistema.</p>
                
                ${carrinho.length > 0 ? `
                  <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-weight: bold; color: #1e40af;">🛍️ Sobre o seu pedido:</p>
                    <p style="margin: 8px 0 0 0; font-size: 15px; color: #1e3a8a;">Nossa equipe já recebeu a sua lista com os ${carrinho.length} itens desejados. Em breve, entraremos em contato pelo WhatsApp para confirmar a disponibilidade, passar o orçamento final e fechar todos os detalhes da sua festa!</p>
                  </div>
                ` : ''}

                <p style="font-size: 16px; line-height: 1.5;">Se tiver qualquer dúvida até lá, basta nos chamar.</p>
                <p style="margin-top: 30px; font-size: 16px;">Com carinho,<br><strong>Equipe ${empresa.nome}</strong></p>
              </div>
            </div>
          `
        }
      });

      // 🔥 INÍCIO DO ESPIÃO (MONITORAMENTO DO AUTO-CADASTRO) 🔥
      try {
        let detalhesAcao = `O cliente ${form.nome} realizou o próprio cadastro através do link público.`;
        if (carrinho.length > 0) {
          detalhesAcao += ` E enviou um pedido de orçamento com ${carrinho.length} itens.`;
        }

        await addDoc(collection(db, "logs_atividades"), {
          empresaId: idDaLoja, 
          funcionarioId: "auto_cadastro",
          nomeFuncionario: "Sistema Automático 🤖",
          acao: "AUTO-CADASTRO",
          tipo: "CRIACAO",
          detalhes: detalhesAcao,
          dataHora: new Date().toISOString()
        });
      } catch (errorEspiao) {
        console.error("Falha ao registrar auditoria de auto-cadastro:", errorEspiao);
      }
      // 🔥 FIM DO ESPIÃO 🔥

      if (carrinho.length > 0) {
        alert("🎉 Pedido recebido com sucesso!\n\nSua lista e seu cadastro foram enviados para a nossa equipe. Em breve entraremos em contato pelo seu WhatsApp para confirmar a aprovação!");
      } else {
        alert("✅ Cadastro recebido com sucesso!\n\nNossa equipe fará a análise do seu perfil e entraremos em contato.");
      }

      navigate(`/catalogo/${idDaLoja}`);
      
    } catch (error) {
      console.error("Erro no cadastro:", error);
      alert("Ocorreu um erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cadastro-externo-container">
      <div className="cadastro-card">
        <header className="cadastro-header-topo">
          <button className="btn-voltar-simples" onClick={() => navigate(-1)}>← Voltar</button>
          <h2>Olá! Vamos começar?</h2>
          <p>Complete seu cadastro na <strong>{empresa.nome}</strong> para reservar suas peças.</p>
        </header>

        {carrinho.length > 0 && (
            <div className="aviso-carrinho-ativo">
                🛍️ Você tem <strong>{carrinho.length} itens</strong> selecionados aguardando!
            </div>
        )}

        <form onSubmit={finalizarCadastroE_Pedido} className="form-corpo">
          <div className="sessao-label">IDENTIFICAÇÃO</div>
          
          <div className="form-group full">
            <label>Nome Completo *</label>
            <input type="text" name="nome" placeholder="Ex: Maria Silva" required onChange={handleChange} />
          </div>

          <div className="form-group full">
            <label>E-mail *</label>
            <input type="email" name="email" placeholder="seu.email@exemplo.com" value={form.email} required onChange={handleChange} />
          </div>
          
          <div className="form-dupla">
            <div className="form-group">
              <label>CPF ou CNPJ *</label>
              <input type="text" name="documento" placeholder="000.000.000-00" value={form.documento} required onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>WhatsApp *</label>
              <input type="text" name="contato" placeholder="(11) 90000-0000" value={form.contato} required onChange={handleChange} />
            </div>
          </div>

          <div className="sessao-label">ENDEREÇO</div>
          
          <div className="form-dupla">
            <div className="form-group input-curto">
              <label>CEP</label>
              <input type="text" name="cep" placeholder="00000-000" value={form.cep} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Cidade *</label>
              <input type="text" name="cidade" placeholder="Sua cidade" value={form.cidade} required onChange={handleChange} />
            </div>
          </div>
          
          <div className="form-group full">
            <label>Rua / Avenida *</label>
            <input type="text" name="logradouro" placeholder="Endereço de entrega" value={form.logradouro} required onChange={handleChange} />
          </div>
          
          <div className="form-dupla">
            <div className="form-group input-curto">
              <label>Número *</label>
              <input type="text" name="numero" placeholder="123" value={form.numero} required onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Bairro *</label>
              <input type="text" name="bairro" placeholder="Seu bairro" value={form.bairro} required onChange={handleChange} />
            </div>
          </div>

          {carrinho.length > 0 && (
             <>
                <div className="sessao-label">DETALHES DA FESTA</div>
                <div className="form-group full">
                  <label>Data da Festa / Retirada *</label>
                  <input type="date" name="dataEvento" required onChange={handleChange} />
                </div>
            </>
          )}

          <button type="submit" className="btn-finalizar-tudo" disabled={loading}>
            {loading ? 'SALVANDO...' : 'FINALIZAR E ENVIAR PEDIDO ➔'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AutoCadastro;