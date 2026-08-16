import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth"; 
import logoCelebrePadrao from "../../assets/LOGO_CELEBRE.png";
import "./ModelosContrato.css";

const ModelosContrato = () => {
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [modelos, setModelos] = useState([]);
  const [novo, setNovo] = useState({ titulo: "", texto: "", isDefault: false });
  const [editandoId, setEditandoId] = useState(null);
  const [buscaModelo, setBuscaModelo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modalPreview, setModalPreview] = useState(false);
  const [empresa, setEmpresa] = useState(null);

  // Controle de Abas e Estado dos Textos
  const [abaAtiva, setAbaAtiva] = useState('contratos'); // 'contratos' | 'whatsapp' | 'logistica'
  const [textoRelatorio, setTextoRelatorio] = useState('');
  const [salvandoRelatorio, setSalvandoRelatorio] = useState(false);
  
  // Mensagem de WhatsApp Padrão
  const [textoWhatsapp, setTextoWhatsapp] = useState('');
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState(false);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO JURÍDICO VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipe,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria jurídica:", error);
    }
  };

  // --- TEXTOS PADRÃO DO SISTEMA CELEBRE ---
  const templates = {
    completo: {
      titulo: "CONTRATO PADRÃO COMPLETO (5 CLÁUSULAS BLINDADAS)",
      texto: `INSTRUMENTO PARTICULAR DE LOCAÇÃO DE BENS MÓVEIS E ACERVO PARA EVENTOS

1. QUALIFICAÇÃO DAS PARTES:
• LOCATÁRIO(A): {NOME_CLIENTE}, CPF/CNPJ: {CPF_CNPJ}
  WhatsApp: {WHATSAPP}
  Endereço: {ENDERECO_EVENTO}

• LOCADORA: {NOME_EMPRESA}, CNPJ: {CNPJ_EMPRESA}
  WhatsApp: {WHATSAPP_EMPRESA}

2. OBJETO DO CONTRATO & RELAÇÃO DO ACERVO:
O presente contrato tem por objeto a locação das peças e itens decorativos destinados à realização do evento com tema "{TEMA_EVENTO}":
{LISTA_ITENS}

3. PRAZOS, LOGÍSTICA & LOCAL DO EVENTO:
• Data do Evento: {DATA_EVENTO}
• Retirada / Saída: {DATA_RETIRADA} às {HORARIO}
• Devolução / Retorno: {DATA_DEVOLUCAO} às {HORARIO}
• Local da Celebração: {ENDERECO_EVENTO}

4. CONDIÇÕES FINANCEIRAS:
O valor total da presente locação é de {VALOR_TOTAL}, a ser quitado conforme as condições e prazos acordados.

5. CLÁUSULAS JURÍDICAS DE PROTEÇÃO:
CLÁUSULA 1ª – DA CONSERVAÇÃO E CONFERÊNCIA: O(A) LOCATÁRIO(A) recebe todas as peças em perfeito estado de uso e higiene, obrigando-se a conferi-las no ato da retirada.
CLÁUSULA 2ª – DA DEVOLUÇÃO E MULTA POR ATRASO: As peças deverão ser restituídas nas embalagens originais. O atraso injustificado gera multa de 20% do valor total por dia de atraso.
CLÁUSULA 3ª – DE AVARIAS E REPOSIÇÃO: Em caso de quebra, manchas irreversíveis ou extravio de itens/embalagens, o LOCATÁRIO indenizará o valor de reposição em até 48 horas.
CLÁUSULA 4ª – DA HIGIENIZAÇÃO: É vedado o uso de colas quentes, fitas adesivas abrasivas, pregos ou grampos sobre as peças e móveis (taxa de R$ 50,00 por remoção de resíduos).
CLÁUSULA 5ª – DA VALIDADE ELETRÔNICA: As partes reconhecem a validade desta formalização digital (Lei Federal nº 14.063/2020 e MP nº 2.200-2/2001).`
    },
    pegueMonte: {
      titulo: "CONTRATO PEGUE E MONTE (BALCÃO)",
      texto: `CLÁUSULAS ESPECÍFICAS - PEGUE E MONTE:

1. DO TRANSPORTE & LOGÍSTICA: O LOCATÁRIO ({NOME_CLIENTE}) é o único responsável pelo transporte adequado das peças para o evento ({ENDERECO_EVENTO}).
2. DA MONTAGEM: A LOCADORA ({NOME_EMPRESA}) não realiza serviço de montagem neste modelo. O cliente retira em {DATA_RETIRADA}, monta e devolve em {DATA_DEVOLUCAO}.
3. DA DEVOLUÇÃO EM EMBALAGENS: Todas as peças devem retornar higienizadas e acondicionadas nas mesmas caixas e capas entregues.
4. DANOS E AVARIAS: Em caso de quebra ou rasgo, será cobrado o valor de reposição imediato da peça.
5. ATRASOS NA ENTREGA: Multa diária de 20% sobre o valor total ({VALOR_TOTAL}) por dia de atraso não acordado.`
    },
    decoracao: {
      titulo: "CONTRATO DE DECORAÇÃO COMPLETA (COM MONTAGEM)",
      texto: `CLÁUSULAS ESPECÍFICAS - DECORAÇÃO COMPLETA:

1. DA PRESTAÇÃO DE SERVIÇO: A LOCADORA ({NOME_EMPRESA}) se compromete a realizar a montagem e desmontagem do cenário tema "{TEMA_EVENTO}".
2. DO ACESSO AO ESPAÇO: O local ({ENDERECO_EVENTO}) deverá estar liberado para a equipe pelo menos 2 horas antes do evento ({DATA_EVENTO}).
3. DA ESTRUTURA DO LOCAL: A LOCADORA não se responsabiliza por problemas na infraestrutura do espaço (tomadas insuficientes, pisos desnivelados ou vazamentos).
4. ALTERAÇÕES DE LAYOUT: Solicitações de alteração devem ser feitas com 7 dias de antecedência.
5. GUARDA E INTEGRIDADE: O LOCATÁRIO ({NOME_CLIENTE}) responde pela integridade do acervo durante todo o evento.`
    },
    pecas: {
      titulo: "CONTRATO DE PEÇAS & ACERVO AVULSO",
      texto: `CLÁUSULAS ESPECÍFICAS - PEÇAS AVULSAS:

1. DO OBJETO: Locação exclusiva das peças individuais discriminadas para {NOME_CLIENTE}.
2. DA CONFERÊNCIA: O cliente confere os itens no ato da retirada ({DATA_RETIRADA}). Reclamações posteriores não serão aceitas.
3. DA REPOSIÇÃO: Louças, vasos ou componentes danificados deverão ser ressarcidos integralmente no retorno ({DATA_DEVOLUCAO}).
4. DA HIGIENIZAÇÃO: As peças devem retornar livres de resíduos de doces e velas sob pena de taxa de limpeza.`
    }
  };

  const textoPadraoWhatsapp = `Olá, *{NOME_CLIENTE}*! Tudo bem?\n\nSegue o link oficial para conferência e *assinatura digital* do seu contrato de locação com a *{NOME_EMPRESA}* (Evento: *{DATA_EVENTO}* | Valor: *{VALOR_TOTAL}*):\n\n🔗 {LINK_ASSINATURA}\n\nÉ bem rápido: basta clicar no link, ler os termos e assinar com o dedo ou mouse na tela.\n\nQualquer dúvida, estamos à disposição! ✨`;

  const textoPadraoRelatorio = `Declaramos para os devidos fins que os itens listados acima foram locados em perfeito estado de conservação e, após a devolução e conferência física no galpão, apresentaram as avarias ou ausências descritas.\n\nConforme os termos do contrato de locação firmado, os produtos danificados estão sujeitos à cobrança de taxa de manutenção ou conserto. No caso de peças extraviadas ou com perda total, será cobrado o valor integral de reposição do produto de acordo com o preço de mercado atualizado listado acima.\n\nNossa equipe entrará em contato para apresentar as opções de pagamento para regularização das pendências.`;

  // Lista de Variáveis Dinâmicas para Inserção com 1 Clique
  const tagsDisponiveis = [
    { tag: "{NOME_CLIENTE}", label: "Nome do Cliente", icon: "👤" },
    { tag: "{CPF_CNPJ}", label: "CPF/CNPJ", icon: "📑" },
    { tag: "{WHATSAPP}", label: "WhatsApp", icon: "📱" },
    { tag: "{ENDERECO_EVENTO}", label: "Endereço Evento", icon: "📍" },
    { tag: "{DATA_EVENTO}", label: "Data do Evento", icon: "📅" },
    { tag: "{DATA_RETIRADA}", label: "Data Retirada", icon: "🚚" },
    { tag: "{DATA_DEVOLUCAO}", label: "Data Devolução", icon: "📦" },
    { tag: "{HORARIO}", label: "Horário", icon: "⏰" },
    { tag: "{VALOR_TOTAL}", label: "Valor Total (R$)", icon: "💰" },
    { tag: "{TEMA_EVENTO}", label: "Tema da Festa", icon: "🎭" },
    { tag: "{LISTA_ITENS}", label: "Lista de Itens", icon: "📋" },
    { tag: "{NOME_EMPRESA}", label: "Nome Empresa", icon: "🏢" },
    { tag: "{CNPJ_EMPRESA}", label: "CNPJ Empresa", icon: "🏛️" },
    { tag: "{WHATSAPP_EMPRESA}", label: "Zap Empresa", icon: "📞" }
  ];

  useEffect(() => {
    if (!usuarioLogado) {
      navigate('/login');
      return;
    }

    // 1. Carrega os modelos da empresa
    const q = query(collection(db, "modelosContrato"), where("userId", "==", tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setModelos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Carrega as configurações da empresa (Logo, Dados, Mensagem WhatsApp, Relatório Avarias)
    const carregarConfiguracoes = async () => {
      try {
        const docSnap = await getDoc(doc(db, "configuracoes_empresa", tenantId));
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setEmpresa(dados);
          setTextoWhatsapp(dados.whatsappContratoMsg || textoPadraoWhatsapp);
        } else {
          setTextoWhatsapp(textoPadraoWhatsapp);
        }

        const docLog = await getDoc(doc(db, "relatorio_avarias", tenantId));
        if (docLog.exists()) {
          setTextoRelatorio(docLog.data().conteudo || textoPadraoRelatorio);
        } else {
          setTextoRelatorio(textoPadraoRelatorio);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    
    carregarConfiguracoes();

    return () => unsub();
  }, [usuarioLogado, navigate, tenantId]);

  // 🎯 INSERÇÃO DE TAG DINÂMICA NO CURSOR
  const inserirTag = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setNovo(prev => ({ ...prev, texto: prev.texto + tag }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textoAtual = novo.texto || "";
    const novoTexto = textoAtual.substring(0, start) + tag + textoAtual.substring(end);
    setNovo(prev => ({ ...prev, texto: novoTexto }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const carregarTemplate = (tipo) => {
    const t = templates[tipo];
    if (t) {
      setNovo(prev => ({ ...prev, titulo: t.titulo, texto: t.texto }));
    }
  };

  // 💾 SALVAR MODELO DE CONTRATO
  const handleSalvarContrato = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      // Se marcou como padrão, desmarca os demais da empresa
      if (novo.isDefault) {
        for (const m of modelos) {
          if (m.isDefault && m.id !== editandoId) {
            await updateDoc(doc(db, "modelosContrato", m.id), { isDefault: false });
          }
        }
      }

      if (editandoId) {
        await updateDoc(doc(db, "modelosContrato", editandoId), {
          titulo: novo.titulo,
          texto: novo.texto,
          isDefault: !!novo.isDefault,
          updatedAt: serverTimestamp()
        });
        await registrarLog("EDIÇÃO DE MODELO", `Editou o modelo: "${novo.titulo}".`);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "modelosContrato"), { 
          titulo: novo.titulo,
          texto: novo.texto,
          isDefault: !!novo.isDefault,
          createdAt: serverTimestamp(),
          userId: tenantId
        });
        await registrarLog("NOVO MODELO DE CONTRATO", `Criou o modelo: "${novo.titulo}".`);
      }
      setNovo({ titulo: "", texto: "", isDefault: false });
      alert("Modelo de contrato salvo com sucesso! ✅");
    } catch (err) { 
      alert("Erro ao salvar modelo: " + err.message); 
    } finally {
      setSalvando(false);
    }
  };

  // ⭐ DEFINIR COMO PADRÃO DIRETO NO CARD
  const togglePadrao = async (m, e) => {
    e.stopPropagation();
    try {
      const novoStatus = !m.isDefault;
      if (novoStatus) {
        for (const outro of modelos) {
          if (outro.isDefault && outro.id !== m.id) {
            await updateDoc(doc(db, "modelosContrato", outro.id), { isDefault: false });
          }
        }
      }
      await updateDoc(doc(db, "modelosContrato", m.id), { isDefault: novoStatus });
      alert(novoStatus ? `"${m.titulo}" agora é o Modelo Padrão da Empresa! ⭐` : `Modelo desmarcado de padrão.`);
    } catch (err) {
      alert("Erro ao definir padrão: " + err.message);
    }
  };

  // 📄 DUPLICAR MODELO
  const duplicarModelo = async (m) => {
    try {
      await addDoc(collection(db, "modelosContrato"), {
        titulo: `${m.titulo} (Cópia)`,
        texto: m.texto,
        isDefault: false,
        createdAt: serverTimestamp(),
        userId: tenantId
      });
      alert(`Modelo "${m.titulo}" duplicado com sucesso! 📄`);
    } catch (err) {
      alert("Erro ao duplicar: " + err.message);
    }
  };

  const prepararEdicao = (m) => {
    setEditandoId(m.id);
    setNovo({ titulo: m.titulo, texto: m.texto, isDefault: !!m.isDefault });
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const copiarTextoModelo = (texto) => {
    navigator.clipboard.writeText(texto);
    alert("Texto copiado para a área de transferência! 📋");
  };

  // 💾 SALVAR MENSAGEM DO WHATSAPP
  const handleSalvarWhatsapp = async (e) => {
    e.preventDefault();
    setSalvandoWhatsapp(true);
    try {
      await setDoc(doc(db, "configuracoes_empresa", tenantId), {
        whatsappContratoMsg: textoWhatsapp,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      await registrarLog("CONFIGURAÇÃO WHATSAPP", "Atualizou o texto padrão de envio de contratos no WhatsApp.");
      alert("Mensagem do WhatsApp salva com sucesso! ✅ Os envios agora usarão este texto.");
    } catch (err) {
      alert("Erro ao salvar mensagem: " + err.message);
    } finally {
      setSalvandoWhatsapp(false);
    }
  };

  // 💾 SALVAR RELATÓRIO DE AVARIAS
  const handleSalvarRelatorio = async (e) => {
    e.preventDefault();
    setSalvandoRelatorio(true);
    try {
      await setDoc(doc(db, "relatorio_avarias", tenantId), {
        conteudo: textoRelatorio,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      await registrarLog("EDIÇÃO DE TERMO LEGAL", `Atualizou o texto padrão do Relatório de Avarias e Extravios da Logística.`);
      alert("Texto do Relatório de Avarias salvo com sucesso! ✅");
    } catch (err) {
      alert("Erro ao salvar relatório: " + err.message);
    } finally {
      setSalvandoRelatorio(false);
    }
  };

  // 👁️ SIMULAÇÃO DE DADOS PARA A PRÉVIA A4
  const previewFormatado = useMemo(() => {
    let t = novo.texto || "Nenhum texto preenchido no editor.";
    const sim = {
      '{NOME_CLIENTE}': 'Mariana Souza Silva',
      '{CPF_CNPJ}': '024.158.741-55',
      '{WHATSAPP}': '(19) 97458-4956',
      '{ENDERECO_EVENTO}': 'Av. das Flores, 1420 - Jardins, Campinas/SP',
      '{DATA_EVENTO}': '25/09/2026',
      '{DATA_RETIRADA}': '24/09/2026',
      '{DATA_DEVOLUCAO}': '26/09/2026',
      '{HORARIO}': '14:00h',
      '{VALOR_TOTAL}': 'R$ 1.850,00',
      '{TEMA_EVENTO}': 'Jardim Encantado / Provence Gold',
      '{LISTA_ITENS}': '1. 1x Painel Romano Dourado\n2. 3x Cilindros Rústicos com Capa\n3. 4x Vasos Cerâmica Floral\n4. 2x Bandejas Espelhadas Luxo',
      '{NOME_EMPRESA}': empresa?.nomeEmpresa || 'CELEBRE FESTAS & EVENTOS',
      '{CNPJ_EMPRESA}': empresa?.cnpj || '45.123.890/0001-12',
      '{WHATSAPP_EMPRESA}': empresa?.telefone || '(19) 99876-5432'
    };

    Object.entries(sim).forEach(([k, v]) => {
      t = t.replaceAll(k, v);
    });
    return t;
  }, [novo.texto, empresa]);

  // Filtragem dos modelos salvos
  const modelosFiltrados = useMemo(() => {
    if (!buscaModelo) return modelos;
    const t = buscaModelo.toLowerCase();
    return modelos.filter(m => 
      (m.titulo || '').toLowerCase().includes(t) ||
      (m.texto || '').toLowerCase().includes(t)
    );
  }, [modelos, buscaModelo]);

  return (
    <div className="modelos-page-luxury fade-in">
      <div className="container-modelos-luxury">
        
        {/* CABEÇALHO EXECUTIVO */}
        <header className="modelos-header-luxury">
          <div className="header-top-nav-luxury">
            <button className="btn-voltar-luxury" onClick={() => navigate("/contratos")}>
              ← Voltar para Contratos
            </button>

            <button 
              type="button" 
              className="btn-novo-modelo-topo"
              onClick={() => {
                setEditandoId(null);
                setNovo({ titulo: "", texto: "", isDefault: false });
              }}
            >
              <i className="fas fa-plus"></i> + Novo Modelo em Branco
            </button>
          </div>
          
          <div className="header-title-card-luxury">
            <div className="badge-minuta-head">
              <span>📜 BIBLIOTECA JURÍDICA &amp; MODELOS DE TEXTO</span>
            </div>
            <h1 className="title-modelos-luxury">Configuração de Modelos &amp; Cláusulas</h1>
            <p className="subtitle-modelos-luxury">
              Crie, personalize e gerencie as cláusulas e minutas padrão que serão usadas nos contratos e relatórios do sistema.
            </p>
          </div>

          {/* ABAS DE NAVEGAÇÃO SEGMENTADAS (3 ABAS) */}
          <div className="segmented-tabs-modelos">
            <button 
              className={`segmented-tab-btn ${abaAtiva === 'contratos' ? 'active' : ''}`} 
              onClick={() => setAbaAtiva('contratos')}
            >
              📑 Modelos de Contratos ({modelos.length})
            </button>
            <button 
              className={`segmented-tab-btn ${abaAtiva === 'whatsapp' ? 'active' : ''}`} 
              onClick={() => setAbaAtiva('whatsapp')}
            >
              📱 Mensagem do WhatsApp
            </button>
            <button 
              className={`segmented-tab-btn ${abaAtiva === 'logistica' ? 'active' : ''}`} 
              onClick={() => setAbaAtiva('logistica')}
            >
              🚚 Relatório de Logística &amp; Avarias (PDF)
            </button>
          </div>
        </header>

        {/* ===================================================================
            ABA 1: MODELOS DE CONTRATOS
            =================================================================== */}
        {abaAtiva === 'contratos' && (
          <div className="modelos-grid-luxury">
            
            {/* COLUNA ESQUERDA: FORMULÁRIO / EDITOR */}
            <div className="modelo-card-editor-luxury">
              <div className="card-editor-header">
                <div className="editor-icon-box">
                  <i className={editandoId ? "fas fa-edit" : "fas fa-file-contract"}></i>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="editor-card-title">{editandoId ? "Editar Modelo de Contrato" : "Cadastrar Novo Modelo"}</h3>
                  <span className="editor-card-sub">Insira o título, cláusulas e use as tags de preenchimento automático</span>
                </div>

                <button 
                  type="button" 
                  className="btn-preview-a4-trigger" 
                  onClick={() => setModalPreview(true)}
                  title="Ver prévia formatada em folha A4"
                >
                  👁️ Prévia A4
                </button>
              </div>

              {/* ATALHOS RÁPIDOS DO SISTEMA */}
              <div className="atalhos-templates-box">
                <label className="label-atalhos-mini">
                  <i className="fas fa-bolt" style={{ color: '#c5a059' }}></i> 
                  PREENCHIMENTO RÁPIDO COM MODELOS CELEBRE:
                </label>
                <div className="btn-group-templates-luxury">
                  <button type="button" onClick={() => carregarTemplate('completo')} className="btn-template-chip destaque">
                    ⭐ Completo (5 Cláusulas)
                  </button>
                  <button type="button" onClick={() => carregarTemplate('pegueMonte')} className="btn-template-chip">
                    📦 Pegue e Monte
                  </button>
                  <button type="button" onClick={() => carregarTemplate('decoracao')} className="btn-template-chip">
                    ✨ Decoração
                  </button>
                  <button type="button" onClick={() => carregarTemplate('pecas')} className="btn-template-chip">
                    🏺 Peças Avulsas
                  </button>
                </div>
              </div>

              {/* 🚀 TAGS DINÂMICAS INTELIGENTES */}
              <div className="box-tags-dinamicas">
                <div className="tags-header-label">
                  <span>⚡ CLIQUE PARA INSERIR VARIÁVEL AUTOMÁTICA NO TEXTO:</span>
                </div>
                <div className="tags-chips-container">
                  {tagsDisponiveis.map(t => (
                    <button 
                      key={t.tag}
                      type="button" 
                      className="tag-chip-btn"
                      onClick={() => inserirTag(t.tag)}
                      title={`Inserir ${t.label} no texto`}
                    >
                      <span>{t.icon}</span> <strong>{t.tag}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSalvarContrato} className="form-editor-luxury">
                <div className="form-group-luxury">
                  <label>TÍTULO DO MODELO *</label>
                  <input 
                    className="input-celebre-luxury" 
                    placeholder="Ex: Contrato Padrão Pegue e Monte 2026" 
                    value={novo.titulo} 
                    onChange={e => setNovo({...novo, titulo: e.target.value})} 
                    required 
                  />
                </div>
             
                <div className="form-group-luxury">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>CLÁUSULAS, TERMOS &amp; CONDIÇÕES *</label>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{novo.texto.length} caracteres</span>
                  </div>
                  <textarea 
                    ref={textareaRef}
                    className="textarea-celebre-luxury" 
                    rows="15" 
                    placeholder="Escreva ou cole as cláusulas do contrato aqui..." 
                    value={novo.texto} 
                    onChange={e => setNovo({...novo, texto: e.target.value})} 
                    required
                  />
                </div>

                {/* CHECKBOX: DEFINIR COMO PADRÃO */}
                <div className="checkbox-padrao-luxury">
                  <label className="label-checkbox-flex">
                    <input 
                      type="checkbox" 
                      checked={novo.isDefault || false}
                      onChange={e => setNovo({...novo, isDefault: e.target.checked})}
                    />
                    <span>⭐ <strong>Definir este modelo como Padrão Principal da Empresa</strong> (será carregado automaticamente nos novos contratos)</span>
                  </label>
                </div>
             
                <div className="editor-botoes-row">
                  {editandoId && (
                    <button 
                      type="button" 
                      className="btn-cancelar-editor" 
                      onClick={() => { setEditandoId(null); setNovo({ titulo: "", texto: "", isDefault: false }); }}
                    >
                      Cancelar Edição
                    </button>
                  )}
                  
                  <button type="submit" className="btn-salvar-modelo-luxury" disabled={salvando}>
                    {salvando ? (
                      <span><i className="fas fa-spinner fa-spin"></i> Salvando...</span>
                    ) : editandoId ? (
                      <span>💾 Salvar Alterações ➔</span>
                    ) : (
                      <span>💾 Salvar Novo Modelo ➔</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* COLUNA DIREITA: BIBLIOTECA DE MODELOS SALVOS */}
            <div className="modelos-biblioteca-luxury">
              <div className="biblioteca-header">
                <div className="biblioteca-titulo-box">
                  <i className="fas fa-folder-open" style={{ color: '#0f172a' }}></i>
                  <div>
                    <h3 className="biblioteca-title">Modelos Salvos</h3>
                    <span className="biblioteca-sub">{modelos.length} modelo(s) ativo(s)</span>
                  </div>
                </div>

                <div className="busca-modelos-box">
                  <input 
                    type="text" 
                    placeholder="Filtrar modelos..." 
                    value={buscaModelo}
                    onChange={e => setBuscaModelo(e.target.value)}
                    className="input-busca-modelo"
                  />
                </div>
              </div>

              <div className="lista-modelos-cards">
                {modelosFiltrados.length === 0 ? (
                  <div className="empty-modelos-luxury">
                    <i className="fas fa-file-alt" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '10px' }}></i>
                    <p style={{ fontWeight: '700', margin: '0 0 4px 0', color: '#334155' }}>Nenhum modelo cadastrado</p>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      Clique nos atalhos acima para criar seus primeiros modelos de contrato.
                    </span>
                  </div>
                ) : (
                  modelosFiltrados.map(m => (
                    <div key={m.id} className={`modelo-card-item-luxury ${m.isDefault ? 'is-default-card' : ''}`}>
                      <div className="modelo-item-topo">
                        <div className="modelo-item-identificacao">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h4 className="modelo-item-titulo">{m.titulo}</h4>
                            {m.isDefault && <span className="badge-default-star">⭐ Padrão</span>}
                          </div>
                          <span className="modelo-item-badge">📋 Minuta Salva</span>
                        </div>

                        <div className="modelo-item-acoes">
                          <button 
                            type="button"
                            className={`btn-acao-modelo ${m.isDefault ? 'star-active' : ''}`}
                            onClick={(e) => togglePadrao(m, e)}
                            title={m.isDefault ? "Modelo Padrão Ativo" : "Tornar este o modelo padrão"}
                          >
                            ⭐
                          </button>
                          <button 
                            type="button"
                            className="btn-acao-modelo" 
                            onClick={() => duplicarModelo(m)}
                            title="Duplicar Modelo"
                          >
                            📄
                          </button>
                          <button 
                            type="button"
                            className="btn-acao-modelo" 
                            onClick={() => copiarTextoModelo(m.texto)}
                            title="Copiar Texto"
                          >
                            📋
                          </button>
                          <button 
                            type="button"
                            className="btn-acao-modelo" 
                            onClick={() => prepararEdicao(m)}
                            title="Editar Modelo"
                          >
                            ✏️
                          </button>
                          <button 
                            type="button"
                            className="btn-acao-modelo delete" 
                            onClick={async () => {
                              if (window.confirm(`Deseja excluir o modelo "${m.titulo}"?`)) {
                                await deleteDoc(doc(db, "modelosContrato", m.id));
                                await registrarLog("EXCLUSÃO DE MODELO", `Excluiu o modelo de contrato: "${m.titulo}".`);
                              }
                            }}
                            title="Excluir Modelo"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <p className="modelo-item-preview">
                        {m.texto.substring(0, 160)}...
                      </p>

                      <div className="modelo-item-rodape">
                        <span className="modelo-item-chars">📝 {m.texto.length} caracteres</span>
                        <button 
                          type="button" 
                          className="btn-carregar-no-editor"
                          onClick={() => prepararEdicao(m)}
                        >
                          Carregar no Editor ➔
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================
            ABA 2: MENSAGEM DO WHATSAPP
            =================================================================== */}
        {abaAtiva === 'whatsapp' && (
          <div className="whatsapp-config-grid-luxury">
            
            <div className="modelo-card-editor-luxury">
              <div className="card-editor-header">
                <div className="editor-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <i className="fab fa-whatsapp"></i>
                </div>
                <div>
                  <h3 className="editor-card-title">Texto Automático de Envio no WhatsApp</h3>
                  <span className="editor-card-sub">
                    Personalize a mensagem enviada com o link de assinatura digital
                  </span>
                </div>
              </div>

              {/* TAGS DISPONÍVEIS NO WHATSAPP */}
              <div className="box-tags-dinamicas">
                <div className="tags-header-label">
                  <span>⚡ VARIÁVEIS DISPONÍVEIS PARA A MENSAGEM:</span>
                </div>
                <div className="tags-chips-container">
                  {['{NOME_CLIENTE}', '{NOME_EMPRESA}', '{DATA_EVENTO}', '{VALOR_TOTAL}', '{LINK_ASSINATURA}'].map(tag => (
                    <button 
                      key={tag}
                      type="button" 
                      className="tag-chip-btn"
                      onClick={() => setTextoWhatsapp(prev => prev + ' ' + tag)}
                    >
                      <strong>{tag}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSalvarWhatsapp} className="form-editor-luxury">
                <div className="form-group-luxury">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0 }}>MENSAGEM DO WHATSAPP</label>
                    <button 
                      type="button" 
                      onClick={() => setTextoWhatsapp(textoPadraoWhatsapp)} 
                      className="btn-restaurar-padrao"
                    >
                      🔄 Restaurar Mensagem Padrão
                    </button>
                  </div>
                  <textarea 
                    className="textarea-celebre-luxury" 
                    rows="10" 
                    placeholder="Digite a mensagem padrão que será enviada aos clientes..." 
                    value={textoWhatsapp} 
                    onChange={e => setTextoWhatsapp(e.target.value)} 
                    required
                  />
                </div>

                <div className="editor-botoes-row">
                  <button 
                    type="submit" 
                    className="btn-salvar-modelo-luxury" 
                    disabled={salvandoWhatsapp}
                    style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', borderBottomColor: '#bbf7d0' }}
                  >
                    {salvandoWhatsapp ? (
                      <span><i className="fas fa-spinner fa-spin"></i> Salvando...</span>
                    ) : (
                      <span>💾 Salvar Mensagem do WhatsApp ➔</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* PREVIEW DO BALÃO DO WHATSAPP */}
            <div className="whatsapp-preview-card-luxury">
              <div className="wpp-phone-header">
                <div className="wpp-avatar-circle">
                  {(empresa?.nomeEmpresa || 'C').substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="wpp-contact-name">{empresa?.nomeEmpresa || 'Sua Empresa'}</div>
                  <div className="wpp-status-online">online</div>
                </div>
              </div>

              <div className="wpp-chat-body">
                <div className="wpp-balloon-sent">
                  <p className="wpp-balloon-text">
                    {textoWhatsapp
                      .replaceAll('{NOME_CLIENTE}', 'Mariana Silva')
                      .replaceAll('{NOME_EMPRESA}', empresa?.nomeEmpresa || 'Celebre Festas')
                      .replaceAll('{DATA_EVENTO}', '25/09/2026')
                      .replaceAll('{VALOR_TOTAL}', 'R$ 1.850,00')
                      .replaceAll('{LINK_ASSINATURA}', `${window.location.origin}/assinatura/demo123`)}
                  </p>
                  <span className="wpp-time-stamp">
                    15:30 <i className="fas fa-check-double" style={{ color: '#53bdeb' }}></i>
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================
            ABA 3: RELATÓRIO DE LOGÍSTICA (PDF)
            =================================================================== */}
        {abaAtiva === 'logistica' && (
          <div className="modelo-card-editor-luxury" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-editor-header">
              <div className="editor-icon-box icon-red">
                <i className="fas fa-truck-loading"></i>
              </div>
              <div>
                <h3 className="editor-card-title">Texto Legal: Termo de Ocorrência &amp; Avarias (PDF)</h3>
                <span className="editor-card-sub">
                  Texto inserido no rodapé do comprovante de devolução quando houver peças danificadas ou ausentes
                </span>
              </div>
            </div>

            <form onSubmit={handleSalvarRelatorio} className="form-editor-luxury" style={{ marginTop: '20px' }}>
              <div className="form-group-luxury">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ margin: 0 }}>CONTEÚDO DO AVISO LEGAL DE LOGÍSTICA</label>
                  <button 
                    type="button" 
                    onClick={() => setTextoRelatorio(textoPadraoRelatorio)} 
                    className="btn-restaurar-padrao"
                  >
                    🔄 Restaurar Texto Padrão Celebre
                  </button>
                </div>
                <textarea 
                  className="textarea-celebre-luxury" 
                  rows="14" 
                  placeholder="Insira as cláusulas de cobrança e termo de vistoria aqui..." 
                  value={textoRelatorio} 
                  onChange={e => setTextoRelatorio(e.target.value)} 
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="btn-salvar-modelo-luxury" 
                disabled={salvandoRelatorio}
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottomColor: '#dc2626' }}
              >
                {salvandoRelatorio ? (
                  <span><i className="fas fa-spinner fa-spin"></i> Salvando Termo...</span>
                ) : (
                  <span>💾 Salvar Texto do Laudo de Avarias ➔</span>
                )}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* ===================================================================
          MODAL DE PRÉ-VISUALIZAÇÃO EM FOLHA A4 (PREVIEW REALISTA)
          =================================================================== */}
      {modalPreview && (
        <div className="modal-overlay-preview-a4" onClick={() => setModalPreview(false)}>
          <div className="modal-container-preview-a4" onClick={e => e.stopPropagation()}>
            <div className="modal-preview-topo">
              <div>
                <h3 className="modal-preview-title">👁️ Pré-Visualização da Folha A4 (Simulação com Dados Reais)</h3>
                <span className="modal-preview-sub">Exibição de como as variáveis e cláusulas serão impressas</span>
              </div>
              <button className="btn-fechar-preview" onClick={() => setModalPreview(false)}>✕ Fechar</button>
            </div>

            <div className="modal-preview-corpo-scroll">
              <div className="folha-a4-preview-virtual">
                {/* CABEÇALHO DA PRÉVIA */}
                <div className="preview-doc-header">
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#0f172a' }}>
                      {(empresa?.nomeEmpresa || 'CELEBRE FESTAS & EVENTOS').toUpperCase()}
                    </h2>
                    <p style={{ margin: '2px 0', fontSize: '0.75rem', color: '#64748b' }}>
                      {empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : 'CNPJ: 45.123.890/0001-12'} • WhatsApp: {empresa?.telefone || '(19) 99876-5432'}
                    </p>
                    <p style={{ margin: '2px 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                      📍 {empresa?.endereco || 'Av. Principal, 1000 - Centro, Campinas/SP'}
                    </p>
                  </div>
                  <img src={empresa?.logotipo || logoCelebrePadrao} alt="Logo" style={{ maxHeight: '50px', objectFit: 'contain' }} />
                </div>

                <div style={{ height: '2px', background: '#c5a059', margin: '12px 0' }}></div>

                <h4 style={{ textAlign: 'center', margin: '10px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#0f172a' }}>
                  {novo.titulo || "INSTRUMENTO PARTICULAR DE LOCAÇÃO DE BENS MÓVEIS"}
                </h4>

                {/* CORPO PREENCHIDO COM OS DADOS SIMULADOS */}
                <div className="preview-doc-texto">
                  {previewFormatado}
                </div>

                {/* ASSINATURAS SIMULADAS */}
                <div className="preview-doc-assinaturas">
                  <div className="preview-box-ass">
                    <div className="preview-linha-ass"></div>
                    <strong>Mariana Souza Silva</strong>
                    <span>LOCATÁRIO(A)</span>
                  </div>
                  <div className="preview-box-ass">
                    <div className="preview-linha-ass"></div>
                    <strong>{empresa?.nomeEmpresa || 'CELEBRE FESTAS'}</strong>
                    <span>LOCADORA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ModelosContrato;