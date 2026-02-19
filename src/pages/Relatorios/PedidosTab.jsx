import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from "jspdf";
import "jspdf-autotable";
import "./PedidosTab.css";

const COLORS_PIE = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8'];

const formatarNome = (str) => {
    if (!str) return "N/A";
    return str.toString().toUpperCase().trim();
};

const PedidosTab = () => {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({
      totalPedidos: 0,
      topTemas: [], lowTemas: [],
      topCats: [], lowCats: [],
      topItens: []
  });

  useEffect(() => {
    const carregar = async () => {
      try {
        const [snapLocacoes, snapEstoque] = await Promise.all([
            getDocs(collection(db, "locacoes")),
            getDocs(collection(db, "estoque"))
        ]);
        
        const mapaCat = {};
        snapEstoque.docs.forEach(d => {
            if(d.data().nome && d.data().categoria) 
                mapaCat[formatarNome(d.data().nome)] = d.data().categoria;
        });

        const temaCount = {};
        const catCount = {};
        const itemCount = {};

        snapLocacoes.docs.forEach(doc => {
            const d = doc.data();
            let itensArray = d.itens;
            if (typeof itensArray === 'string') itensArray = [itensArray];
            
            if (Array.isArray(itensArray)) {
                itensArray.forEach(i => {
                    let nomeItem = i;
                    if (typeof i === 'object') nomeItem = i.nome || i.titulo || i.produto || "ITEM";
                    const nomeFmt = formatarNome(nomeItem);
                    if (nomeFmt !== "ITEM" && nomeFmt !== "N/A" && nomeFmt !== "[OBJECT OBJECT]") {
                        itemCount[nomeFmt] = (itemCount[nomeFmt] || 0) + 1;
                        const cat = mapaCat[nomeFmt] || "GERAL";
                        catCount[cat] = (catCount[cat] || 0) + 1;
                    }
                });
            }

            let tema = d.tema || d.tipoEvento || "";
            const textoBusca = (d.titulo + " " + d.clienteNome + " " + JSON.stringify(d.itens)).toLowerCase();

            if (!tema || tema === "Outros") {
                if (textoBusca.includes("casamento")) tema = "CASAMENTO";
                else if (textoBusca.includes("niver") || textoBusca.includes("anos") || textoBusca.includes("parabéns")) tema = "ANIVERSÁRIO";
                else if (textoBusca.includes("chá")) tema = "CHÁ";
                else if (textoBusca.includes("batizado")) tema = "BATIZADO";
                else if (textoBusca.includes("corporativo")) tema = "CORPORATIVO";
                else tema = "OUTROS";
            }
            tema = formatarNome(tema);
            temaCount[tema] = (temaCount[tema] || 0) + 1;
        });

        const sortDesc = (obj) => Object.entries(obj).map(([k,v])=>({name:k, value:v})).sort((a,b)=>b.value - a.value);
        
        const temasOrdenados = sortDesc(temaCount);
        const catsOrdenadas = sortDesc(catCount);
        const itensOrdenados = sortDesc(itemCount);

        setDados({
            totalPedidos: snapLocacoes.docs.length,
            topTemas: temasOrdenados.slice(0, 5),
            lowTemas: temasOrdenados.slice(-3).reverse(),
            topCats: catsOrdenadas.slice(0, 5),
            lowCats: catsOrdenadas.slice(-3).reverse(),
            topItens: itensOrdenados.slice(0, 5)
        });

      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    carregar();
  }, []);

  const gerarPDF = () => {
    try {
        const doc = new jsPDF();
        
        // --- Cabeçalho ---
        doc.setFillColor(15, 23, 42); // Fundo Azul Escuro
        doc.rect(0, 0, 210, 40, "F");
        
        doc.setTextColor(255, 255, 255); 
        doc.setFontSize(22); 
        doc.setFont("helvetica", "bold");
        doc.text("Relatório de Inteligência", 14, 25);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 32);
        
        // --- Resumo KPI ---
        doc.setTextColor(0,0,0); 
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Volume Total de Pedidos: ${dados.totalPedidos}`, 14, 55);

        let currentY = 65;
        
        // --- Tabela 1: Temas ---
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("Performance de Temas", 14, currentY);
        
        // Verifica se há dados antes de tentar mapear
        const corpoTabelaTemas = [
            ...(dados.topTemas || []).map(t => [t.name, t.value, 'ALTA']),
            ...(dados.lowTemas || []).map(t => [t.name, t.value, 'BAIXA'])
        ];

        if (corpoTabelaTemas.length > 0) {
            doc.autoTable({
                startY: currentY + 5,
                head: [['Tema do Evento', 'Quantidade', 'Status']],
                body: corpoTabelaTemas,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] }, // Azul
                styles: { fontSize: 10 }
            });
            // Atualiza o Y com segurança
            currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : currentY + 40;
        } else {
            doc.setFontSize(10);
            doc.text("(Sem dados de temas disponíveis)", 14, currentY + 10);
            currentY += 20;
        }
        
        // --- Tabela 2: Itens ---
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("Itens Mais Utilizados", 14, currentY);
        
        const corpoTabelaItens = (dados.topItens || []).map(i => [i.name, i.value]);

        if (corpoTabelaItens.length > 0) {
            doc.autoTable({
                startY: currentY + 5,
                head: [['Item do Acervo', 'Total de Locações']],
                body: corpoTabelaItens,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129] }, // Verde
                styles: { fontSize: 10 }
            });
        } else {
            doc.setFontSize(10);
            doc.text("(Sem dados de itens disponíveis)", 14, currentY + 10);
        }

        // Salva
        doc.save("Relatorio_Estrategico_Agape.pdf");
        
    } catch (error) {
        console.error("Erro detalhado PDF:", error);
        alert(`Erro ao gerar PDF: ${error.message}. Tente recarregar a página.`);
    }
  };

  if (loading) return <div className="loading-screen">Carregando dados...</div>;

  return (
    <div className="tab-content fade-in">
        
        {/* KPI PRINCIPAL */}
        <div className="kpi-banner">
            <div className="kpi-content">
                <span className="kpi-label">VOLUME TOTAL DE PEDIDOS</span>
                <h1 className="kpi-value">{dados.totalPedidos}</h1>
            </div>
            <div className="kpi-actions">
                <button className="btn-download" onClick={gerarPDF}>
                    📥 Baixar PDF Analítico
                </button>
            </div>
        </div>

        {/* BLOCO 1: TEMAS */}
        <div className="section-header">
            <h3>🎭 Performance de Temas</h3>
            <p>Compare o que está em alta com o que precisa de atenção.</p>
        </div>
        
        <div className="comparison-grid">
            <div className="card-box graph-box">
                <div className="card-title">🔥 Mais Procurados (Top 5)</div>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dados.topTemas} layout="vertical" margin={{left:10, right:30}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                        <XAxis type="number" hide/>
                        <YAxis dataKey="name" type="category" width={90} tick={{fontSize:11, fill: '#64748b'}}/>
                        <Tooltip cursor={{fill: '#f1f5f9'}}/>
                        <Bar dataKey="value" fill="#3b82f6" radius={[0,4,4,0]} barSize={24} label={{position:'right', fill:'#3b82f6', fontWeight: 700}}/>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="card-box opportunity-box">
                <div className="card-title">💡 Oportunidades (Baixa Saída)</div>
                <p className="box-desc">Temas com pouca procura recente. Ideais para promoção.</p>
                <div className="list-container">
                    {dados.lowTemas.map((t, i) => (
                        <div key={i} className="list-item">
                            <span className="item-name">{t.name}</span>
                            <span className="item-badge orange">{t.value} pedido</span>
                        </div>
                    ))}
                    {dados.lowTemas.length === 0 && <p className="empty-txt">Todos os temas estão performando!</p>}
                </div>
            </div>
        </div>

        {/* BLOCO 2: CATEGORIAS */}
        <div className="section-header mt-40">
            <h3>🗂️ Categorias do Acervo</h3>
        </div>
        <div className="comparison-grid">
             <div className="card-box graph-box">
                <div className="card-title">🏆 Categorias Campeãs</div>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie data={dados.topCats} innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                            {dados.topCats.map((e,i)=><Cell key={i} fill={COLORS_PIE[i%COLORS_PIE.length]}/>)}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle"/>
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="card-box opportunity-box">
                <div className="card-title">📉 Categorias Estagnadas</div>
                <p className="box-desc">Verifique se estes itens estão com fotos boas no catálogo.</p>
                <div className="list-container">
                    {dados.lowCats.map((c, i) => (
                        <div key={i} className="list-item">
                            <span className="item-name">{c.name}</span>
                            <span className="item-badge orange">{c.value} saída</span>
                        </div>
                    ))}
                    {dados.lowCats.length === 0 && <p className="empty-txt">Sem categorias paradas!</p>}
                </div>
            </div>
        </div>

        {/* BLOCO 3: ITENS */}
        <div className="section-header mt-40">
            <h3>📦 Top Itens Individuais</h3>
        </div>
        <div className="itens-ranking-row">
            {dados.topItens.map((item, i) => (
                <div key={i} className="rank-card">
                    <div className={`rank-pos pos-${i+1}`}>{i+1}º</div>
                    <div className="rank-details">
                        <span className="r-name">{item.name}</span>
                        <span className="r-val">{item.value} <small>locações</small></span>
                    </div>
                </div>
            ))}
        </div>

    </div>
  );
};

export default PedidosTab;