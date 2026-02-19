import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import "./FinanceiroTab.css";

const FinanceiroTab = () => {
  const [loading, setLoading] = useState(true);
  const [transacoes, setTransacoes] = useState([]);
  const [resumo, setResumo] = useState({ saldo: 0, entradas: 0, saidas: 0 });

  useEffect(() => {
    const carregarDadosFinanceiros = async () => {
      try {
        // Busca dados das duas coleções simultaneamente
        const [snapLocacoes, snapCompras] = await Promise.all([
          getDocs(collection(db, "locacoes")),
          getDocs(collection(db, "compras"))
        ]);

        let ent = 0;
        let sai = 0;
        const lista = [];

        // 1. Processar Entradas (LOCACOES)
        snapLocacoes.docs.forEach(doc => {
          const d = doc.data();
          const valor = Number(d.valorTotal || d.valor || 0);
          ent += valor;

          lista.push({
            id: doc.id,
            data: d.dataEvento?.toDate ? d.dataEvento.toDate() : new Date(d.dataEvento || d.data || Date.now()),
            descricao: `Locação: ${d.clienteNome || d.cliente || 'Cliente'}`,
            categoria: "Locação",
            valor: valor,
            tipo: "entrada"
          });
        });

        // 2. Processar Saídas (COMPRAS)
        snapCompras.docs.forEach(doc => {
          const d = doc.data();
          const valor = Number(d.valorTotal || d.valor || d.preco || 0);
          sai += valor;

          lista.push({
            id: doc.id,
            data: d.dataCompra?.toDate ? d.dataCompra.toDate() : new Date(d.dataCompra || d.data || Date.now()),
            descricao: d.descricao || d.item || "Compra de Materiais",
            categoria: d.categoria || "Suprimentos",
            valor: valor,
            tipo: "saida"
          });
        });

        // Atualiza os estados
        setResumo({ saldo: ent - sai, entradas: ent, saidas: sai });
        setTransacoes(lista.sort((a, b) => b.data - a.data)); // Ordena pela data mais recente

      } catch (error) {
        console.error("Erro ao buscar dados financeiros:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarDadosFinanceiros();
  }, []);

  if (loading) return <div className="loading-screen">Calculando extrato real...</div>;

  return (
    <div className="tab-content" style={{ marginTop: '60px' }}>
      {/* Banner Financeiro */}
      <div className="fin-banner">
        <div className="fin-kpi-group">
           <div className="fin-kpi-item">
              <label>Saldo em Caixa</label>
              <h2>R$ {resumo.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
           </div>
           <div className="fin-kpi-item">
              <label>Entradas (Locações)</label>
              <h2 className="fin-verde">↑ {resumo.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
           </div>
           <div className="fin-kpi-item">
              <label>Saídas (Compras)</label>
              <h2 className="fin-vermelho">↓ {resumo.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
           </div>
        </div>
      </div>

      {/* Tabela de Extrato Unificado */}
      <div className="fin-table-container">
        <table className="fin-table">
            <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>Tipo</th>
                </tr>
            </thead>
            <tbody>
                {transacoes.map((t) => (
                  <tr key={t.id}>
                      <td>{t.data.toLocaleDateString('pt-BR')}</td>
                      <td><strong>{t.descricao}</strong></td>
                      <td>{t.categoria}</td>
                      <td className={t.tipo === 'saida' ? 'fin-vermelho' : ''}>
                        {t.tipo === 'saida' ? '-' : ''} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`fin-badge ${t.tipo === 'entrada' ? 'entrada' : 'saida'}`}>
                          {t.tipo === 'entrada' ? 'RECEBIDO' : 'PAGO'}
                        </span>
                      </td>
                  </tr>
                ))}
                {transacoes.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>Nenhum dado encontrado em Locações ou Compras.</td></tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinanceiroTab;