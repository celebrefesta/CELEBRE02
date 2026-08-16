import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 
import "./NovoContrato.css"; 

const EditarContrato = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [carregando, setCarregando] = useState(true);
  const [meusModelos, setMeusModelos] = useState([]);
  const [dadosIniciais, setDadosIniciais] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Estado do formulário com TODOS os campos
  const [form, setForm] = useState({
    cliente: "",
    cpf: "",
    telefone: "",
    tema: "",
    dataEvento: "",
    horario: "",
    endereco: "",
    descricao: "",
    valorTotal: "",
    status: "",
    dataRetirada: "",
    dataDevolucao: ""
  });

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO JURÍDICO VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    const currentTenant = localStorage.getItem('tenantId') || auth.currentUser?.uid;
    if (!currentTenant) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || auth.currentUser?.displayName || auth.currentUser?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: currentTenant,
        userId: currentTenant,
        funcionarioId: auth.currentUser?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: auth.currentUser?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de contratos:", error);
    }
  };

  // 1. Carrega os dados do contrato existente e os modelos
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      const activeTenant = localStorage.getItem('tenantId') || user?.uid;
      if (!user && !activeTenant) {
        navigate('/login');
        return;
      }
      if (!activeTenant) return;

      try {
        // Busca o contrato específico pelo ID
        const docRef = doc(db, "contratos", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // 🔥 BLINDAGEM: Verifica se o contrato pertence à sua empresa
          if (data.userId && data.userId !== activeTenant) {
            alert("Acesso negado: Este contrato pertence a outra empresa.");
            navigate('/contratos');
            return;
          }
          
          setForm({
            cliente: data.cliente || "",
            cpf: data.cpf || "",
            telefone: data.telefone || "",
            tema: data.tema || "",
            dataEvento: data.dataEvento || "",
            horario: data.horario || "",
            endereco: data.endereco || "",
            descricao: data.descricao || "",
            valorTotal: data.valorTotal || "",
            status: data.status || "Em Aberto",
            dataRetirada: data.dataRetirada || "",
            dataDevolucao: data.dataDevolucao || ""
          });
          setDadosIniciais(data); // Guarda a memória para a auditoria
        } else {
          alert("Contrato não encontrado!");
          navigate("/contratos");
          return;
        }

        // 🔥 BLINDAGEM: Busca APENAS os modelos da empresa
        const qModelos = query(collection(db, "modelosContrato"), where("userId", "==", activeTenant));
        const snapModelos = await getDocs(qModelos);
        setMeusModelos(snapModelos.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setCarregando(false);
      }
    });

    return () => unsubAuth();
  }, [id, navigate]);

  // 📜 GERADOR DE MINUTA JURÍDICA PROFISSIONAL COMPLETA
  const gerarMinutaContratoProfissional = (dadosForm) => {
    const nomeCliente = dadosForm.cliente || "_________________________";
    const docCliente = dadosForm.cpf ? `CPF/CNPJ nº ${dadosForm.cpf}` : "CPF/CNPJ nº _________________________";
    const telCliente = dadosForm.telefone || "_________________________";
    const endCliente = dadosForm.endereco || "_________________________";
    const temaEvento = dadosForm.tema || "Celebração";
    const dtEvFormatada = dadosForm.dataEvento ? dadosForm.dataEvento.split('-').reverse().join('/') : "__/__/____";
    const dtRetFormatada = dadosForm.dataRetirada ? dadosForm.dataRetirada.split('-').reverse().join('/') : dtEvFormatada;
    const dtDevFormatada = dadosForm.dataDevolucao ? dadosForm.dataDevolucao.split('-').reverse().join('/') : dtEvFormatada;
    const horario = dadosForm.horario || "Horário Comercial";
    const vlrTotal = Number(dadosForm.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let listaItensFormatada = "• [Conforme itens descritos na locação]";
    if (dadosForm.descricao && dadosForm.descricao.includes("x ")) {
      listaItensFormatada = dadosForm.descricao.trim();
    }

    return `INSTRUMENTO PARTICULAR DE LOCAÇÃO DE BENS MÓVEIS E ACERVO PARA EVENTOS

======================================================================
1. QUALIFICAÇÃO DAS PARTES
======================================================================
• LOCATÁRIO(A): ${nomeCliente}, ${docCliente}
  WhatsApp/Telefone: ${telCliente}
  Endereço: ${endCliente}

• LOCADORA: Celebre Festas & Eventos (Plataforma Celebre Locações)

======================================================================
2. OBJETO DO CONTRATO & RELAÇÃO DO ACERVO
======================================================================
O presente contrato tem por objeto a locação temporária dos itens e peças decorativas descritos a seguir, destinados à realização do evento tema "${temaEvento}":

${listaItensFormatada}

======================================================================
3. PRAZOS, LOGÍSTICA & LOCAL DO EVENTO
======================================================================
• Data da Celebração / Evento: ${dtEvFormatada}
• Data e Horário de Retirada/Saída: ${dtRetFormatada} às ${horario}
• Data e Horário Limite de Devolução: ${dtDevFormatada} às ${horario}
• Endereço do Evento: ${endCliente}

======================================================================
4. CONDIÇÕES FINANCEIRAS
======================================================================
O valor total da presente locação é de ${vlrTotal}, a ser liquidado conforme as condições e prazos comerciais acordados entre as partes.

======================================================================
5. CLÁUSULAS JURÍDICAS DE PROTEÇÃO & REPOSIÇÃO
======================================================================
CLÁUSULA 1ª – DO ESTADO DE CONSERVAÇÃO E CONFERÊNCIA:
O(A) LOCATÁRIO(A) declara que recebe todas as peças em perfeito estado de uso, limpeza, funcionamento e conservação, obrigando-se a conferir cada item no ato do recebimento/retirada.

CLÁUSULA 2ª – DA DEVOLUÇÃO, LIMPEZA E MULTA POR ATRASO:
Todos os bens deverão ser restituídos na data e horário avençados, devidamente higienizados e acondicionados em suas embalagens, caixas ou capas protetoras originais.
Parágrafo Único: O atraso não acordado na devolução implicará na cobrança de multa diária correspondente a 20% (vinte por cento) do valor total da locação por dia de atraso, sem prejuízo de eventuais perdas e danos decorrentes de reservas subsequentes.

CLÁUSULA 3ª – DE AVARIAS, DANOS, MANCHAS E EXTRAVIOS (REPOSIÇÃO):
Em caso de quebra, trincas, queima, rasgos, manchas irreversíveis em tecidos, danos a componentes elétricos/eletrônicos ou extravio de qualquer peça, acessório ou embalagem retornável, o(a) LOCATÁRIO(A) se obriga a indenizar a LOCADORA pelo valor de reposição de mercado atualizado do bem no prazo improrrogável de até 48 (quarenta e oito) horas após a conferência de devolução.

CLÁUSULA 4ª – DA HIGIENIZAÇÃO E CUIDADOS ESPECIAIS:
É expressamente proibido o uso de fitas adesivas, pregos, cola quente, grampos ou produtos abrasivos diretamente sobre as peças, painéis e móveis. A devolução de itens com resíduos de adesivos ou sujeira excessiva acarretará taxa de higienização de R$ 50,00 por peça.

CLÁUSULA 5ª – DA VALIDADE JURÍDICA E ASSINATURA ELETRÔNICA:
As partes contratantes reconhecem a plena validade jurídica deste contrato formalizado e/ou assinado por meio eletrônico e digital, nos termos da Lei Federal nº 14.063/2020 e Art. 10, § 2º da Medida Provisória nº 2.200-2/2001.`;
  };

  // 2. Aplica modelo (Adiciona texto ao final sem apagar o que já tem)
  const aplicarModelo = (e) => {
    const idModelo = e.target.value;
    if (!idModelo) return;

    if (idModelo === 'GERAR_COMPLETO') {
      const minuta = gerarMinutaContratoProfissional(form);
      setForm(prev => ({ ...prev, descricao: minuta }));
      return;
    }

    const modelo = meusModelos.find(m => m.id === idModelo);
    if (modelo) {
      const PatternDeSeparacao = "\n\n--------------------------------\nTERMOS E CONDIÇÕES:\n";
      const atual = form.descricao || "";
      setForm({ 
        ...form, 
        descricao: atual + (atual ? PatternDeSeparacao : "") + modelo.texto 
      });
    }
  };

  // 3. Atualiza no Firebase
  const handleAtualizar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const docRef = doc(db, "contratos", id);
      await updateDoc(docRef, {
        ...form,
        valorTotal: Number(form.valorTotal) 
      });

      // 🔥 ANÁLISE DE AUDITORIA (Raio-X da edição)
      let mudancas = [];
      if (dadosIniciais) {
        if (dadosIniciais.valorTotal !== form.valorTotal) mudancas.push(`Valor (de R$${dadosIniciais.valorTotal} para R$${form.valorTotal})`);
        if (dadosIniciais.status !== form.status) mudancas.push(`Status (para '${form.status}')`);
        if (dadosIniciais.descricao !== form.descricao) mudancas.push(`Texto/Cláusulas alteradas`);
      }

      if (mudancas.length > 0) {
        await registrarLog("EDIÇÃO DE CONTRATO", `Editou o contrato de "${form.cliente}". Alterações: ${mudancas.join(' | ')}.`);
      }

      alert("Contrato atualizado com sucesso! ✅");
      navigate("/contratos");
    } catch (error) {
      alert("Erro ao atualizar contrato: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="novo-contrato-layout">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px' }}></i>
          <p style={{ fontWeight: '700' }}>Carregando dados do contrato...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="novo-contrato-layout fade-in">
      <div className="container-form-luxury">
        
        {/* CABEÇALHO EXECUTIVO */}
        <header className="form-header-luxury">
          <button 
            type="button" 
            className="btn-voltar-luxury" 
            onClick={() => navigate("/contratos")}
          >
            ← Voltar para Contratos
          </button>
          
          <div className="header-title-row-luxury">
            <div>
              <div className="badge-minuta-head">
                <span>✏️ EDIÇÃO DE CONTRATO FORMAL</span>
              </div>
              <h1 className="title-novo-contrato">Editar Contrato: {form.cliente || "Cliente"}</h1>
              <p className="subtitle-novo-contrato">
                Atualize as condições, prazos, relação de itens ou status de formalização.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                style={{
                  background: form.status === 'Assinado' ? '#dcfce7' : '#f1f5f9',
                  color: form.status === 'Assinado' ? '#15803d' : '#334155',
                  border: `1px solid ${form.status === 'Assinado' ? '#bbf7d0' : '#cbd5e1'}`,
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '0.82rem'
                }}
              >
                Status Atual: {form.status}
              </span>
            </div>
          </div>
        </header>

        <form onSubmit={handleAtualizar} className="main-form-luxury">
          <div className="grid-duas-colunas-contrato">
            
            {/* COLUNA ESQUERDA: DADOS, LOGÍSTICA E VALORES */}
            <div className="coluna-formulario-esquerda">
              
              {/* SEÇÃO 1: DADOS DO CONTRATANTE & FESTA */}
              <section className="form-section-card-luxury">
                <div className="section-header-card">
                  <div className="section-icon-box icon-purple">
                    <i className="fas fa-user-tie"></i>
                  </div>
                  <div>
                    <h3 className="section-title-luxury">1. Dados do Contratante &amp; Evento</h3>
                    <span className="section-sub-luxury">Identificação civil do cliente e celebração</span>
                  </div>
                </div>

                <div className="grid-inputs-luxury">
                  <div className="input-field-luxury full">
                    <label>Nome Completo do Cliente / Locatário *</label>
                    <input 
                      value={form.cliente} 
                      onChange={e => setForm({...form, cliente: e.target.value})} 
                      required 
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>CPF ou CNPJ</label>
                    <input 
                      value={form.cpf} 
                      onChange={e => setForm({...form, cpf: e.target.value})} 
                      placeholder="000.000.000-00"
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>WhatsApp / Telefone</label>
                    <input 
                      value={form.telefone} 
                      onChange={e => setForm({...form, telefone: e.target.value})} 
                      placeholder="(00) 00000-0000"
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Data do Evento *</label>
                    <input 
                      type="date" 
                      value={form.dataEvento} 
                      onChange={e => setForm({...form, dataEvento: e.target.value})} 
                      required
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Tema da Festa / Tipo de Evento</label>
                    <input 
                      value={form.tema} 
                      onChange={e => setForm({...form, tema: e.target.value})} 
                      className="input-celebre"
                    />
                  </div>
                </div>
              </section>

              {/* SEÇÃO 2: LOGÍSTICA & PRAZOS */}
              <section className="form-section-card-luxury">
                <div className="section-header-card">
                  <div className="section-icon-box icon-blue">
                    <i className="fas fa-truck-loading"></i>
                  </div>
                  <div>
                    <h3 className="section-title-luxury">2. Logística, Prazos &amp; Local</h3>
                    <span className="section-sub-luxury">Período de vigência da locação e endereço do evento</span>
                  </div>
                </div>

                <div className="grid-inputs-luxury three-cols">
                  <div className="input-field-luxury">
                    <label>Data de Retirada / Saída *</label>
                    <input 
                      type="date" 
                      value={form.dataRetirada} 
                      onChange={e => setForm({...form, dataRetirada: e.target.value})} 
                      required
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Data de Devolução / Retorno *</label>
                    <input 
                      type="date" 
                      value={form.dataDevolucao} 
                      onChange={e => setForm({...form, dataDevolucao: e.target.value})} 
                      required
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Horário Previsto</label>
                    <input 
                      type="time" 
                      value={form.horario} 
                      onChange={e => setForm({...form, horario: e.target.value})} 
                      className="input-celebre"
                    />
                  </div>
                </div>

                <div className="input-field-luxury full" style={{ marginTop: '12px' }}>
                  <label>Endereço Completo do Evento</label>
                  <input 
                    value={form.endereco} 
                    onChange={e => setForm({...form, endereco: e.target.value})} 
                    placeholder="Endereço completo da festa" 
                    className="input-celebre"
                  />
                </div>
              </section>

              {/* SEÇÃO 3: VALORES & STATUS */}
              <section className="form-section-card-luxury">
                <div className="section-header-card">
                  <div className="section-icon-box icon-green">
                    <i className="fas fa-hand-holding-usd"></i>
                  </div>
                  <div>
                    <h3 className="section-title-luxury">3. Condições Comerciais &amp; Status</h3>
                    <span className="section-sub-luxury">Valor total formalizado e estado jurídico do documento</span>
                  </div>
                </div>

                <div className="grid-inputs-luxury">
                  <div className="input-field-luxury">
                    <label>Valor Total do Contrato (R$) *</label>
                    <div className="input-valor-wrapper">
                      <span className="prefix-moeda">R$</span>
                      <input 
                        type="number" 
                        className="input-valor-destaque"
                        step="0.01" 
                        value={form.valorTotal} 
                        onChange={e => setForm({...form, valorTotal: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="input-field-luxury">
                    <label>Status do Contrato *</label>
                    <select 
                      value={form.status} 
                      onChange={e => setForm({...form, status: e.target.value})}
                      className="select-celebre"
                    >
                      <option value="Em Aberto">⏳ Em Aberto (Aguardando Assinatura)</option>
                      <option value="Assinado">✍️ Assinado Digitalmente</option>
                      <option value="Finalizado">✅ Finalizado / Concluído</option>
                      <option value="Cancelado">❌ Cancelado</option>
                    </select>
                  </div>
                </div>
              </section>

            </div>

            {/* COLUNA DIREITA: MINUTA, MODELOS E AÇÕES */}
            <div className="coluna-formulario-direita">
              
              <section className="form-section-card-luxury card-minuta-full">
                <div className="header-section-modelos-luxury">
                  <div className="section-header-card" style={{ marginBottom: 0 }}>
                    <div className="section-icon-box icon-amber">
                      <i className="fas fa-file-contract"></i>
                    </div>
                    <div>
                      <h3 className="section-title-luxury">4. Cláusulas, Acervo &amp; Termos</h3>
                      <span className="section-sub-luxury">Minuta jurídica completa e relação de itens</span>
                    </div>
                  </div>

                  {/* TOOLBAR COM GERADOR E SELETOR DE MODELOS */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button 
                      type="button" 
                      className="btn-puxar-pedido-sugerido"
                      style={{ background: '#c5a059', color: '#0f172a', fontWeight: '850', fontSize: '0.74rem' }}
                      onClick={() => {
                        const minuta = gerarMinutaContratoProfissional(form);
                        setForm(prev => ({ ...prev, descricao: minuta }));
                      }}
                    >
                      <i className="fas fa-file-signature"></i> 📜 Gerar Minuta Profissional (1 Clique)
                    </button>

                    <div className="seletor-modelos-box">
                      <select onChange={aplicarModelo} className="select-modelo-luxury" defaultValue="">
                        <option value="" disabled>📄 Inserir Cláusulas de Modelo...</option>
                        <option value="GERAR_COMPLETO">✨ Modelo Padrão Completo (Com todas as cláusulas)</option>
                        {meusModelos.map(m => (
                          <option key={m.id} value={m.id}>📋 {m.titulo}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="input-field-luxury full textarea-container-flex">
                  <textarea 
                    value={form.descricao} 
                    onChange={e => setForm({...form, descricao: e.target.value})} 
                    className="textarea-celebre textarea-full-height"
                  />
                </div>

                {/* RODAPÉ DE AÇÕES INTEGRADO NA COLUNA */}
                <div className="form-footer-actions-luxury" style={{ margin: '16px 0 0 0' }}>
                  <button 
                    type="button" 
                    className="btn-cancelar-form-luxury"
                    onClick={() => navigate("/contratos")}
                  >
                    Cancelar
                  </button>

                  <button 
                    type="submit" 
                    className="btn-submit-contrato-luxury"
                    disabled={salvando}
                  >
                    {salvando ? (
                      <span><i className="fas fa-spinner fa-spin"></i> Atualizando...</span>
                    ) : (
                      <span>💾 Salvar Alterações ➔</span>
                    )}
                  </button>
                </div>
              </section>

            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarContrato;