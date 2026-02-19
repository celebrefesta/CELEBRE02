import React, { useState, useEffect } from "react";
import "./ClientesTab.css";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
// Mudamos de PieChart para BarChart para melhor comparação
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const limparValor = (v) => parseFloat(v?.toString().replace(/[^\d,-]/g, '').replace(',', '.') || 0);

// Função auxiliar para pegar iniciais do nome (ex: "Julio Cesar" -> "JC")
const getIniciais = (nome) => {
    if (!nome) return "?";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

const normalizarData = (data) => {
    if (!data) return null;
    if (data.toDate) return data.toDate();
    const d = new Date(data);
    return isNaN(d.getTime()) ? null : d;
};

const formatarDataExibicao = (data) => {
    if (!data) return "-";
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const ClientesTab = () => {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({ total: 0, recorrentes: 0, ranking: [], grafico: [] });
  const [dicaDoDia, setDicaDoDia] = useState(null);

  useEffect(() => {
    const carregar = async () => {
      try {
        const [snapLocacoes, snapEstoque] = await Promise.all([
            getDocs(collection(db, "locacoes")),
            getDocs(collection(db, "estoque"))
        ]);
        
        const clientesMap = {};
        const itensAlugadosCount = {};

        snapLocacoes.docs.forEach(doc => {
            const d = doc.data();
            let nome = (d.clienteNome || d.cliente || "Consumidor Final").trim();
            if (nome === "" || nome.toUpperCase() === "TESTE") return;

            const val = limparValor(d.valorTotal || d.valor || 0);
            const dataReal = normalizarData(d.dataEvento || d.data || d.createdAt || d.criadoEm);

            if(!clientesMap[nome]) {
                clientesMap[nome] = { nome, total: 0, qtd: 0, ultimaCompra: null };
            }
            clientesMap[nome].total += val;
            clientesMap[nome].qtd += 1;
            
            if (dataReal) {
                if (!clientesMap[nome].ultimaCompra || dataReal > clientesMap[nome].ultimaCompra) {
                    clientesMap[nome].ultimaCompra = dataReal;
                }
            }

            if (d.itens && Array.isArray(d.itens)) {
                d.itens.forEach(i => {
                    const n = (i.nome || i.titulo || i).toString().trim();
                    if (n) itensAlugadosCount[n.toUpperCase()] = true;
                });
            }
        });

        const lista = Object.values(clientesMap).sort((a,b) => b.total - a.total);

        setDados({
            total: lista.length,
            recorrentes: lista.filter(c => c.qtd > 1).length,
            ranking: lista,
            // Pegamos o Top 8 para o gráfico de barras
            grafico: lista.slice(0, 8).map(c => ({ name: c.nome, value: c.total }))
        });

        gerarDica(lista, snapEstoque.docs, itensAlugadosCount);

      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    carregar();
  }, []);

  const gerarDica = (clientes, estoqueDocs, itensUsados) => {
    const itensParados = [];
    estoqueDocs.forEach(doc => {
        const nome = (doc.data().nome || "").trim();
        if (nome && !itensUsados[nome.toUpperCase()]) {
            itensParados.push(nome);
        }
    });

    if (itensParados.length > 0) {
        const itemSorteado = itensParados[Math.floor(Math.random() * itensParados.length)];
        setDicaDoDia({
            titulo: "📦 Estoque Parado",
            texto: `O item "${itemSorteado}" não teve saídas. Crie um combo promocional para ele girar!`,
            acao: "Criar Promoção",
            classe: "dica-vermelho"
        });
        return;
    }

    const inativos = clientes.filter(c => {
        if (!c.ultimaCompra) return false;
        const dias = Math.floor((new Date() - c.ultimaCompra) / 86400000);
        return dias > 60 && c.total > 500; // Inativos que já gastaram bem
    });

    if (inativos.length > 0) {
        setDicaDoDia({
            titulo: "📢 Recuperação VIP",
            texto: `Você tem ${inativos.length} clientes VIP que não compram há 2 meses. Mande um 'Oi' com uma oferta!`,
            acao: "Ver Lista VIP",
            classe: "dica-amarelo"
        });
        return;
    }

    setDicaDoDia({
        titulo: "🚀 Acelere",
        texto: "Sua base está saudável! Que tal criar um programa de indicação para atrair novos clientes?",
        acao: "Ver Estratégias",
        classe: "dica-verde"
    });
  };

  const getStatus = (data) => {
      if(!data) return <span className="status-badge novo">Novo</span>;
      const dias = Math.floor((new Date() - data) / 86400000);
      if (dias <= 30) return <span className="status-badge ativo">Ativo Recente</span>;
      if (dias <= 90) return <span className="status-badge morno">Morno</span>;
      return <span className="status-badge inativo">Ausente</span>;
  };

  if (loading) return <div className="loading-screen">Analisando carteira...</div>;

  return (
    <div className="tab-content fade-in">
        {/* KPIs Modernizados */}
        <div className="kpi-row">
            <div className="kpi-card-modern">
                <div className="kpi-icon bg-blue">👥</div>
                <div className="kpi-info">
                    <span>BASE TOTAL</span>
                    <h3>{dados.total} Clientes</h3>
                </div>
            </div>
            <div className="kpi-card-modern">
                <div className="kpi-icon bg-green">🔄</div>
                <div className="kpi-info">
                    <span>TAXA DE RECORRÊNCIA</span>
                    <h3 className="verde">
                        {dados.total > 0 ? ((dados.recorrentes/dados.total)*100).toFixed(0) : 0}%
                        <small className="kpi-sub"> ({dados.recorrentes} fiéis)</small>
                    </h3>
                </div>
            </div>
        </div>

        <div className="chart-cols">
            <div className="chart-box">
                <div className="box-header">
                    <h3>🏆 Top Clientes por Receita</h3>
                    <span className="box-subtitle">Quem mais investe no seu negócio</span>
                </div>
                {dados.total > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        {/* Gráfico de Barras Horizontais é melhor para ranking */}
                        <BarChart data={dados.grafico} layout="vertical" margin={{left: 20, right: 20, bottom: 20}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                            <Tooltip formatter={(value) => formatarMoeda(value)} cursor={{fill: '#f1f5f9'}} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={24}>
                                {/* Label com o valor na frente da barra */}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : <p className="empty-msg">Sem dados de vendas ainda.</p>}
            </div>

            {dicaDoDia && (
                <div className={`chart-box dica-box-modern ${dicaDoDia.classe}`}>
                    <div className="dica-icon">💡</div>
                    <div className="dica-content">
                        <h3>{dicaDoDia.titulo}</h3>
                        <p>{dicaDoDia.texto}</p>
                        <button className="btn-dica-modern">{dicaDoDia.acao}</button>
                    </div>
                </div>
            )}
        </div>

        <div className="chart-box mt-30">
            <div className="box-header">
                <h3>📇 Carteira de Clientes Completa</h3>
            </div>
            <div className="table-responsive">
                <table className="tabela-moderna">
                    <thead><tr><th>Cliente</th><th>Pedidos</th><th>Total Investido</th><th>Última Compra</th><th>Status</th></tr></thead>
                    <tbody>
                        {dados.ranking.map((c, i) => (
                            <tr key={i}>
                                <td>
                                    <div className="cliente-avatar-wrapper">
                                        <div className="cliente-avatar">{getIniciais(c.nome)}</div>
                                        <span className="cliente-nome">{c.nome}</span>
                                    </div>
                                </td>
                                <td className="text-center">{c.qtd}</td>
                                <td className="val-bold">{formatarMoeda(c.total)}</td>
                                <td className="text-center text-muted">{formatarDataExibicao(c.ultimaCompra)}</td>
                                <td>{getStatus(c.ultimaCompra)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
export default ClientesTab;