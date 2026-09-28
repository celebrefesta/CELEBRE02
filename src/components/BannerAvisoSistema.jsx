/**
 * BannerAvisoSistema.jsx
 * Banner global dourado que exibe avisos de mudancas de plano para o usuario logado.
 * Aparece no topo do app (abaixo da Topbar) e pode ser dispensado individualmente.
 */

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { buscarAvisosNaoLidos, marcarAvisoComoLido } from '../utils/planoComunicadoService';

const BannerAvisoSistema = () => {
  const [avisos, setAvisos] = useState([]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // 1. Se não houver usuário logado, nenhum aviso é buscado
      if (!user) {
        setAvisos([]);
        return;
      }

      // 2. Super admin gerencia os planos da plataforma e não recebe alertas de cliente
      if (user.email === 'celebrefesta25@gmail.com') {
        setAvisos([]);
        return;
      }

      // 3. Funcionários não gerenciam a assinatura/plano da empresa contratante
      const role = localStorage.getItem('userRole');
      if (role === 'funcionario') {
        setAvisos([]);
        return;
      }

      const tenantId = user.uid;
      try {
        const lista = await buscarAvisosNaoLidos(tenantId);
        setAvisos(lista.slice(0, 3)); // max 3 banners simultaneos
      } catch (err) {
        // Silencioso
      }
    });

    return () => unsubscribe();
  }, []);

  const dispensar = async (avisoId) => {
    await marcarAvisoComoLido(avisoId);
    setAvisos(prev => prev.filter(a => a.id !== avisoId));
  };

  if (avisos.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 16px 0 16px', zIndex: 999 }}>
      {avisos.map(aviso => (
        <div key={aviso.id} style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
          padding: '12px 16px', borderRadius: '12px',
          background: aviso.tipo === 'plano_recurso_removido'
            ? 'linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%)'
            : 'linear-gradient(135deg, #f0fdf4 0%, #f7fff7 100%)',
          border: `1px solid ${aviso.tipo === 'plano_recurso_removido' ? '#fecaca' : '#bbf7d0'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          animation: 'fadeInDown 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
            <i
              className={`fas ${aviso.icone || 'fa-info-circle'}`}
              style={{
                color: aviso.tipo === 'plano_recurso_removido' ? '#dc2626' : '#16a34a',
                fontSize: '15px', marginTop: '2px', flexShrink: 0
              }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1e293b', lineHeight: '1.5' }}>
                {aviso.mensagem}
              </p>
              {aviso.tipo === 'plano_recurso_removido' && (
                <a
                  href="/planos"
                  style={{
                    display: 'inline-block', marginTop: '6px', fontSize: '12px', fontWeight: '700',
                    color: '#c5a059', textDecoration: 'none', letterSpacing: '0.3px'
                  }}
                >
                  Ver planos disponíveis →
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => dispensar(aviso.id)}
            title="Dispensar aviso"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              color: '#94a3b8', fontSize: '14px', lineHeight: 1, flexShrink: 0
            }}
          >
            <i className="fas fa-times" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default BannerAvisoSistema;
