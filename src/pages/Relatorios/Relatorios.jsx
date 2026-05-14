import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './Relatorios.css';

import FinanceiroTab from './FinanceiroTab';
import ClientesTab from './ClientesTab';
import EstoqueTab from './EstoqueTab';
import PedidosTab from './PedidosTab';

const Relatorios = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [activeTab, setActiveTab] = useState('financeiro');

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE RELATÓRIOS)
  const registrarLogVisualizacao = async (abaCorrente) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      const nomeAba = abaCorrente.charAt(0).toUpperCase() + abaCorrente.slice(1);
      
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: "VISUALIZAÇÃO DE RELATÓRIO",
        detalhes: `Acedeu ao painel de relatórios estratégicos (Aba: ${nomeAba}).`,
        userId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de relatórios:", error);
    }
  };

  // Dispara o espião sempre que a aba é alterada
  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    registrarLogVisualizacao(activeTab);
  }, [activeTab, usuarioLogado, navigate]);

  return (
    <div className="dashboard-container">
      
      {/* CABEÇALHO OTIMIZADO: Título e Abas na mesma linha */}
      <div className="dashboard-header relatorios-header-ajuste">
        <div className="header-text">
          <h1>RELATÓRIOS ESTRATÉGICOS</h1>
          <p>Acompanhe a saúde financeira e o desempenho do seu acervo.</p>
        </div>

        <div className="tabs-relatorios-compacto">
          <button 
            className={activeTab === 'financeiro' ? 'active' : ''} 
            onClick={() => setActiveTab('financeiro')}
          >
            💰 Financeiro
          </button>
          <button 
            className={activeTab === 'clientes' ? 'active' : ''} 
            onClick={() => setActiveTab('clientes')}
          >
            👥 Clientes
          </button>
          <button 
            className={activeTab === 'estoque' ? 'active' : ''} 
            onClick={() => setActiveTab('estoque')}
          >
            📦 Estoque
          </button>
          <button 
            className={activeTab === 'pedidos' ? 'active' : ''} 
            onClick={() => setActiveTab('pedidos')}
          >
            📑 Pedidos
          </button>
        </div>
      </div>

      <div className="relatorio-content">
        {activeTab === 'financeiro' && <FinanceiroTab />}
        {activeTab === 'clientes' && <ClientesTab />}
        {activeTab === 'estoque' && <EstoqueTab />}
        {activeTab === 'pedidos' && <PedidosTab />}
      </div>
      
    </div>
  );
};

export default Relatorios;