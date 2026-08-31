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
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [activeTab, setActiveTab] = useState('financeiro');

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE RELATÓRIOS VINCULADO À EMPRESA)
  const registrarLogVisualizacao = async (abaCorrente) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      const nomeAba = abaCorrente.charAt(0).toUpperCase() + abaCorrente.slice(1);
      
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: "VISUALIZAÇÃO DE RELATÓRIO",
        detalhes: `Acedeu ao painel de relatórios estratégicos (Aba: ${nomeAba}).`,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de relatórios:", error);
    }
  };

  const [mostrarIndicadores, setMostrarIndicadores] = useState(() => {
    const salvo = localStorage.getItem('relatorios_mostrar_indicadores');
    if (salvo !== null) return salvo === 'true';
    // Por padrão: no celular (<= 900px) inicia OCULTO para evitar poluição visual, e no desktop visível
    return typeof window !== 'undefined' ? window.innerWidth > 900 : true;
  });

  const alternarIndicadores = () => {
    const novoValor = !mostrarIndicadores;
    setMostrarIndicadores(novoValor);
    localStorage.setItem('relatorios_mostrar_indicadores', String(novoValor));
  };

  // Dispara o espião sempre que a aba é alterada
  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }
    registrarLogVisualizacao(activeTab);
  }, [activeTab, usuarioLogado, navigate, tenantId]);

  return (
    <div className="relatorios-container dashboard-container relatorios-main-wrapper fade-in">
      
      {/* CABEÇALHO EXECUTIVO REPAGINADO */}
      <div className="dashboard-header relatorios-header-ajuste">
        <div className="header-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span className="relatorios-badge-head">📊 CENTRAL DE INTELIGÊNCIA &amp; DRE</span>
          </div>
          <h1>RELATÓRIOS ESTRATÉGICOS</h1>
          <p>Análise detalhada de DRE financeiro, carteira de clientes, valoração de acervo e desempenho de vendas.</p>
        </div>

        <div className="tabs-relatorios-compacto">
          <button 
            type="button"
            className={activeTab === 'financeiro' ? 'active' : ''} 
            onClick={() => setActiveTab('financeiro')}
          >
            💰 Financeiro &amp; DRE
          </button>
          <button 
            type="button"
            className={activeTab === 'clientes' ? 'active' : ''} 
            onClick={() => setActiveTab('clientes')}
          >
            👥 Clientes &amp; CRM
          </button>
          <button 
            type="button"
            className={activeTab === 'estoque' ? 'active' : ''} 
            onClick={() => setActiveTab('estoque')}
          >
            📦 Estoque &amp; ROI
          </button>
          <button 
            type="button"
            className={activeTab === 'pedidos' ? 'active' : ''} 
            onClick={() => setActiveTab('pedidos')}
          >
            📑 Pedidos &amp; Vendas
          </button>
        </div>
      </div>

      <div className="relatorio-content">
        {activeTab === 'financeiro' && <FinanceiroTab mostrarIndicadores={mostrarIndicadores} alternarIndicadores={alternarIndicadores} />}
        {activeTab === 'clientes' && <ClientesTab mostrarIndicadores={mostrarIndicadores} alternarIndicadores={alternarIndicadores} />}
        {activeTab === 'estoque' && <EstoqueTab mostrarIndicadores={mostrarIndicadores} alternarIndicadores={alternarIndicadores} />}
        {activeTab === 'pedidos' && <PedidosTab mostrarIndicadores={mostrarIndicadores} alternarIndicadores={alternarIndicadores} />}
      </div>
      
    </div>
  );
};

export default Relatorios;