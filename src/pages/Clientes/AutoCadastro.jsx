import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import './AutoCadastro.css';

const AutoCadastro = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
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
    setLoading(true);

    try {
      // 🔥 MÁGICA 1: Salvando as informações separadinhas com os mesmos nomes do seu painel 🔥
      const isJuridica = form.documento.length > 14;
      
      const clienteRef = await addDoc(collection(db, "clientes"), {
        nome: form.nome,
        nomeFantasia: isJuridica ? form.nome : '', // Se for PJ, joga o nome pro Nome Fantasia
        cpf: !isJuridica ? form.documento : '',
        cnpj: isJuridica ? form.documento : '',
        celular: form.contato,
        email: form.email,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
        situacaoFinanceira: 'pendente', // 🔥 NASCE PENDENTE DE APROVAÇÃO 🔥
        origem: 'Auto-Cadastro (Site)',
        tipoPessoa: isJuridica ? 'juridica' : 'fisica', 
        criadoEm: serverTimestamp()
      });

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
          criadoEm: serverTimestamp()
        });

        const resumoItens = carrinho.map(i => `- ${i.qtd}x ${i.nome}`).join('\n');
        const whatsDestino = empresa.whats?.replace(/\D/g, '') || "5519999999999"; 
        
        const textoZap = `🌟 *NOVO CADASTRO (Aguardando Aprovação)* 🌟\n\n*Cliente:* ${form.nome}\n*Documento:* ${form.documento}\n*Data do Evento:* ${form.dataEvento}\n\n*Itens Escolhidos:*\n${resumoItens}\n\n*Total Estimado:* R$ ${total.toFixed(2)}\n\n_Olá! Fiz meu cadastro no site e aguardo a aprovação para fechar o pedido!_`;
        
        window.open(`https://wa.me/${whatsDestino}?text=${encodeURIComponent(textoZap)}`, '_blank');
      } else {
        alert("Cadastro recebido! Em breve nossa equipe fará a aprovação do seu perfil.");
        navigate('/catalogo');
      }

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