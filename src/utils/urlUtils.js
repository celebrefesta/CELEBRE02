/**
 * Utilitário Canônico de URLs do Sistema Celebre
 * Garante que links externos compartilhados com clientes (WhatsApp, E-mail, Copiar Link)
 * apontem SEMPRE para o domínio público oficial ativo (https://celebrefesta.com.br),
 * mesmo quando o lojista ou operador estiver utilizando o sistema localmente (localhost:5173).
 */

export const DOMINIO_OFICIAL_CELEBRE = 'https://celebrefesta.com.br';

/**
 * Retorna a URL base pública oficial para links externos
 * @param {string} dominioCustomizado - Opcional: domínio próprio configurado pela empresa
 * @returns {string} URL base sem barra final (ex: 'https://celebrefesta.com.br')
 */
export const obterUrlBasePublica = (dominioCustomizado = null) => {
  if (dominioCustomizado && typeof dominioCustomizado === 'string' && dominioCustomizado.trim()) {
    let d = dominioCustomizado.trim();
    if (!d.startsWith('http://') && !d.startsWith('https://')) {
      d = `https://${d}`;
    }
    return d.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    // Se for ambiente local, IP ou emulador, SEMPRE redireciona para a URL de produção oficial
    const isLocal = (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    );

    if (!isLocal && origin && !origin.includes('localhost')) {
      return origin.replace(/\/+$/, '');
    }
  }

  return DOMINIO_OFICIAL_CELEBRE;
};

/**
 * Gera um link público absoluto seguro para compartilhar com o cliente
 * @param {string} rota - Rota interna (ex: '/autocadastro/ID', '/catalogo/ID', '/assinatura/ID')
 * @param {string} dominioCustomizado - Opcional: domínio próprio
 * @returns {string} Link público completo
 */
export const gerarLinkPublico = (rota = '', dominioCustomizado = null) => {
  const base = obterUrlBasePublica(dominioCustomizado);
  const rotaLimpa = rota.startsWith('/') ? rota : `/${rota}`;
  return `${base}${rotaLimpa}`;
};
