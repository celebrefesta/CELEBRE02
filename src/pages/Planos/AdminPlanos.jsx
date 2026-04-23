import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import './AdminPlanos.css';

const AdminPlanos = () => {
    const [planos, setPlanos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recursos, setRecursos] = useState([]);

    const recursosPadrao = [
        "Qtd. Usuários", "Variedade Produtos", "Catálogo Digital", 
        "Gestão Estoque", "Etiquetas/QR", "Logística", 
        "Contratos", "Assinatura Digital"
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
            });

            setRecursos(Array.from(recursosEncontrados));
            setPlanos(planosCarregados);
        } catch (error) {
            console.error("Erro ao carregar:", error);
        }
        setLoading(false);
    };

    useEffect(() => { carregarDados(); }, []);

    // 🔄 EDIÇÃO DOS PLANOS (COLUNAS)
    const updateLocalPlano = (id, campo, valor) => {
        setPlanos(planos.map(p => p.id === id ? { ...p, [campo]: valor } : p));
    };

    // 🔄 CLIQUE NAS CÉLULAS (CHECK / BAN)
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

    // ✏️ EDITAR NOME DA FUNCIONALIDADE (LINHAS)
    const atualizarNomeRecurso = (oldName, newName) => {
        const nomeLimpo = newName.trim();
        if (oldName === nomeLimpo || nomeLimpo === '') return;
        
        // Evitar duplicatas
        if (recursos.includes(nomeLimpo)) {
            alert("Esta funcionalidade já existe.");
            return;
        }

        // Atualiza na lista da esquerda
        setRecursos(recursos.map(r => r === oldName ? nomeLimpo : r));

        // Atualiza dentro de todos os planos para não quebrar os checks
        setPlanos(planos.map(p => ({
            ...p,
            beneficios: Array.isArray(p.beneficios) 
                ? p.beneficios.map(b => b === oldName ? nomeLimpo : b) 
                : []
        })));
    };

    // ➕ / 🗑️ ADICIONAR E REMOVER
    const adicionarPlano = async () => {
        const novo = { nome: "Novo Plano", preco: "0", descricao: "", ordem: planos.length + 1, destaque: false, beneficios: [] };
        const docRef = await addDoc(collection(db, "planos"), novo);
        setPlanos([...planos, { id: docRef.id, ...novo }]);
    };

    const deletarPlano = async (id) => {
        if (window.confirm("Atenção: Excluir este plano permanentemente?")) {
            await deleteDoc(doc(db, "planos", id));
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
            setPlanos(planos.map(p => ({
                ...p,
                beneficios: Array.isArray(p.beneficios) ? p.beneficios.filter(b => b !== recursoNome) : []
            })));
        }
    };

    // 💾 SALVAR BANCO DE DADOS
    const salvarTudo = async () => {
        try {
            for (const plano of planos) {
                const { id, ...dados } = plano;
                await updateDoc(doc(db, "planos", id), {
                    ...dados,
                    ordem: Number(dados.ordem),
                    destaque: String(dados.destaque) === "true"
                });
            }
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
                            {planos.map(p => (
                                <th key={p.id} className={`th-plano ${String(p.destaque) === "true" ? 'is-destaque' : ''}`}>
                                    
                                    <div className="th-top-bar">
                                        <div className="pos-control">
                                            <span>Pos:</span>
                                            <input type="number" value={p.ordem} onChange={(e) => updateLocalPlano(p.id, 'ordem', e.target.value)} />
                                        </div>
                                        <button className="btn-trash-col" onClick={() => deletarPlano(p.id)}><i className="fas fa-trash"></i></button>
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
                        {recursos.map(rec => (
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
                                    const tem = Array.isArray(p.beneficios) && p.beneficios.includes(rec);
                                    return (
                                        <td key={p.id} className="td-check" onClick={() => toggleBeneficio(p.id, rec)}>
                                            <i className={`fas ${tem ? 'fa-check-circle check-on' : 'fa-ban check-off'}`}></i>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
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