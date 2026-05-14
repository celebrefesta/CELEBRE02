import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './AdminPlanos.css';

const AdminPlanos = () => {
    const [planos, setPlanos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recursos, setRecursos] = useState([]);

    // 🔥 Autenticação
    const auth = getAuth();
    const usuarioLogado = auth.currentUser;

    // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DA ADMINISTRAÇÃO DE PLANOS)
    const registrarLog = async (acao, detalhes) => {
        if (!usuarioLogado) return;
        try {
            const nomeEquipa = usuarioLogado?.displayName || usuarioLogado?.email || "Administrador";
            await addDoc(collection(db, "logs_atividades"), {
                data: new Date(),
                criadoEm: serverTimestamp(),
                funcionario: nomeEquipa,
                usuarioNome: nomeEquipa,
                usuarioEmail: usuarioLogado?.email || "Desconhecido",
                acao: acao.toUpperCase(),
                detalhes: detalhes,
                userId: usuarioLogado?.uid
            });
        } catch (error) {
            console.error("Erro ao gravar log da matriz de planos:", error);
        }
    };

    // ✨ REGRA ATUALIZADA: "contrato" agora também é campo de texto!
    const isRecursoNumerico = (nome) => {
        const n = nome.toLowerCase();
        return n.includes('usuário') || n.includes('variedade') || n.includes('qtd') || n.includes('contrato');
    };

    const recursosPadrao = [
        "Usuários",
        "Variedade Produtos",
        "Gestão Clientes",
        "Gestão de Estoque",
        "Gestão de Pedidos/ Orçamentos",
        "Gestão de Logística",
        "Gestão de Contratos",
        "Gestão Fornecedores",
        "Gestão Financeira",
        "Gestão de Relatórios",
        "Gestão de Veículos",
        "Assinatura Digital",
        "Emissão de Etiquetas",
        "Agenda",
        "Catalago Digital",
        "Moodboard- Projeto Digital"
    ];

    const carregarDados = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "planos"), orderBy("ordem", "asc"));
            const snap = await getDocs(q);
            const planosCarregados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const recursosEncontrados = new Set(recursosPadrao);
            planosCarregados.forEach(p => {
                if (Array.isArray(p.beneficios)) {
                    p.beneficios.forEach(b => recursosEncontrados.add(b));
                }
                if (p.limites) {
                    Object.keys(p.limites).forEach(l => recursosEncontrados.add(l));
                }
            });

            setRecursos(Array.from(recursosEncontrados));
            setPlanos(planosCarregados);
        } catch (error) {
            console.error("Erro ao carregar:", error);
        }
        setLoading(false);
    };

    useEffect(() => { carregarDados(); }, []);

    const mudarOrdem = (planoId, novaOrdem) => {
        setPlanos(planosAtuais => {
            const planoAlterado = planosAtuais.find(p => p.id === planoId);
            const ordemAntiga = Number(planoAlterado.ordem);

            return planosAtuais.map(p => {
                if (p.id === planoId) return { ...p, ordem: novaOrdem };
                if (Number(p.ordem) === novaOrdem) return { ...p, ordem: ordemAntiga };
                return p;
            });
        });
    };

    const updateLocalPlano = (id, campo, valor) => {
        setPlanos(planos.map(p => p.id === id ? { ...p, [campo]: valor } : p));
    };

    const toggleBeneficio = (planoId, recursoNome) => {
        setPlanos(planos.map(p => {
            if (p.id === planoId) {
                const beneficiosArray = Array.isArray(p.beneficios) ? p.beneficios : [];
                const existe = beneficiosArray.includes(recursoNome);
                const novosBen = existe 
                    ? beneficiosArray.filter(b => b !== recursoNome)
                    : [...beneficiosArray, recursoNome];
                return { ...p, beneficios: novosBen };
            }
            return p;
        }));
    };

    const atualizarLimite = (planoId, recursoNome, valor) => {
        setPlanos(planos.map(p => {
            if (p.id === planoId) {
                const novosLimites = { ...(p.limites || {}) };
                novosLimites[recursoNome] = valor;
                return { ...p, limites: novosLimites };
            }
            return p;
        }));
    };

    const atualizarNomeRecurso = (oldName, newName) => {
        const nomeLimpo = newName.trim();
        if (oldName === nomeLimpo || nomeLimpo === '') return;
        
        if (recursos.includes(nomeLimpo)) {
            alert("Esta funcionalidade já existe.");
            return;
        }

        setRecursos(recursos.map(r => r === oldName ? nomeLimpo : r));
        setPlanos(planos.map(p => {
            const novoPlano = { ...p };
            if (Array.isArray(novoPlano.beneficios)) {
                novoPlano.beneficios = novoPlano.beneficios.map(b => b === oldName ? nomeLimpo : b);
            }
            if (novoPlano.limites && novoPlano.limites[oldName] !== undefined) {
                novoPlano.limites[nomeLimpo] = novoPlano.limites[oldName];
                delete novoPlano.limites[oldName];
            }
            return novoPlano;
        }));
    };

    const adicionarPlano = async () => {
        const novo = { 
            nome: "Novo Plano", 
            preco: "0", 
            descricao: "", 
            ordem: planos.length + 1, 
            destaque: false, 
            beneficios: [],
            limites: {} 
        };
        const docRef = await addDoc(collection(db, "planos"), novo);
        
        // 🔥 REGISTA AUDITORIA
        await registrarLog("NOVO PLANO CRIADO", `Adicionou um novo plano à matriz de assinaturas.`);
        
        setPlanos([...planos, { id: docRef.id, ...novo }]);
    };

    const deletarPlano = async (id) => {
        const planoParaDeletar = planos.find(p => p.id === id);
        const nomePlano = planoParaDeletar ? planoParaDeletar.nome : "Desconhecido";

        if (window.confirm(`Atenção: Excluir permanentemente o plano "${nomePlano}"?`)) {
            await deleteDoc(doc(db, "planos", id));
            
            // 🔥 REGISTA AUDITORIA
            await registrarLog("EXCLUSÃO DE PLANO", `Excluiu o plano "${nomePlano}" da matriz de assinaturas.`);
            
            setPlanos(planos.filter(p => p.id !== id));
        }
    };

    const adicionarRecurso = () => {
        const novoRecurso = `Nova Funcionalidade ${recursos.length + 1}`;
        if (!recursos.includes(novoRecurso)) {
            setRecursos([...recursos, novoRecurso]);
        }
    };

    const deletarRecurso = (recursoNome) => {
        if (window.confirm(`Remover a funcionalidade "${recursoNome}" da matriz?`)) {
            setRecursos(recursos.filter(r => r !== recursoNome));
            setPlanos(planos.map(p => {
                const novoPlano = { ...p };
                if (Array.isArray(novoPlano.beneficios)) {
                    novoPlano.beneficios = novoPlano.beneficios.filter(b => b !== recursoNome);
                }
                if (novoPlano.limites) {
                    delete novoPlano.limites[recursoNome];
                }
                return novoPlano;
            }));
        }
    };

    const salvarTudo = async () => {
        try {
            for (const plano of planos) {
                const { id, ...dados } = plano;
                await updateDoc(doc(db, "planos", id), {
                    ...dados,
                    ordem: Number(dados.ordem),
                    destaque: String(dados.destaque) === "true",
                    limites: dados.limites || {} 
                });
            }
            
            // 🔥 REGISTA AUDITORIA
            await registrarLog("ATUALIZAÇÃO DE MATRIZ DE PLANOS", `Salvou alterações nos preços, limites ou recursos dos planos.`);
            
            alert("Matriz salva com sucesso! 💎");
        } catch (e) { alert("Erro ao salvar: " + e.message); }
    };

    if (loading) return <div className="loading-admin">Construindo matriz...</div>;

    return (
        <div className="admin-matrix-wrapper">
            <header className="matrix-header">
                <div className="header-titles">
                    <h1>Editor de Matriz de Planos ⚙️</h1>
                    <p>Edite os nomes clicando sobre eles. Salve quando terminar.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-add-plano" onClick={adicionarPlano}>+ Novo Plano</button>
                    <button className="btn-save-matrix" onClick={salvarTudo}>SALVAR MATRIZ</button>
                </div>
            </header>

            <div className="matrix-container">
                <table className="matrix-table">
                    <thead>
                        <tr>
                            <th className="th-recursos">RECURSOS & FUNCIONALIDADES</th>
                            {planos.map((p) => (
                                <th key={p.id} className={`th-plano ${String(p.destaque) === "true" ? 'is-destaque' : ''}`}>
                                    <div className="th-top-bar">
                                        <div className="pos-control">
                                            <span>POS:</span>
                                            <select 
                                                value={p.ordem} 
                                                onChange={(e) => mudarOrdem(p.id, Number(e.target.value))}
                                            >
                                                {planos.map((_, i) => (
                                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button className="btn-trash-col" onClick={() => deletarPlano(p.id)}>
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                    <input 
                                        className="plano-nome-input"
                                        value={p.nome} 
                                        onChange={(e) => updateLocalPlano(p.id, 'nome', e.target.value)}
                                        placeholder="Nome do Plano"
                                    />
                                    <div className="plano-preco-wrapper">
                                        <span className="cifrao">R$</span>
                                        <input 
                                            className="plano-preco-input"
                                            value={p.preco} 
                                            onChange={(e) => updateLocalPlano(p.id, 'preco', e.target.value)}
                                        />
                                        <span className="mes">/mês</span>
                                    </div>
                                    <div className="plano-destaque-wrapper">
                                        <label>Destaque?</label>
                                        <select value={p.destaque} onChange={(e) => updateLocalPlano(p.id, 'destaque', e.target.value)}>
                                            <option value={true}>Sim</option>
                                            <option value={false}>Não</option>
                                        </select>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {recursos.map(rec => {
                            const numerico = isRecursoNumerico(rec);
                            return (
                                <tr key={rec}>
                                    <td className="td-recurso">
                                        <div className="td-recurso-content">
                                            <input 
                                                className="recurso-nome-input"
                                                defaultValue={rec}
                                                onBlur={(e) => atualizarNomeRecurso(rec, e.target.value)}
                                                placeholder="Nome do Recurso"
                                            />
                                            <button className="btn-trash-row" onClick={() => deletarRecurso(rec)}>
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </td>
                                    {planos.map(p => {
                                        if (numerico) {
                                            const valorLimite = p.limites?.[rec] || '';
                                            return (
                                                <td key={p.id} className="td-check td-numerico">
                                                    <input 
                                                        type="text" 
                                                        className="input-limite"
                                                        placeholder="Ilimitado"
                                                        value={valorLimite}
                                                        onChange={(e) => atualizarLimite(p.id, rec, e.target.value)}
                                                    />
                                                </td>
                                            );
                                        } else {
                                            const tem = Array.isArray(p.beneficios) && p.beneficios.includes(rec);
                                            return (
                                                <td key={p.id} className="td-check" onClick={() => toggleBeneficio(p.id, rec)}>
                                                    <i className={`fas ${tem ? 'fa-check-circle check-on' : 'fa-ban check-off'}`}></i>
                                                </td>
                                            );
                                        }
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="td-add-recurso">
                                <button className="btn-add-recurso" onClick={adicionarRecurso}>
                                    + Adicionar Linha
                                </button>
                            </td>
                            <td colSpan={planos.length}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default AdminPlanos;