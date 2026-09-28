/**
 * planoUtils.js
 * Utilitario centralizado para leitura dos limites e beneficios do plano
 * diretamente do Firestore (colecao "planos", gerenciada pelo AdminPlanos).
 *
 * REGRA: Nenhum limite numerico deve ser hardcoded no codigo.
 * Tudo e lido do campo "limites" e "beneficios" do documento do plano.
 *
 * Se o campo "limites" nao existir (planos antigos), os FALLBACKS_LIMITE
 * sao usados como seguranca.
 */

import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// ─── FALLBACKS GLOBAIS ────────────────────────────────────────────────────────
// Usados apenas se o campo "limites" nao existir no documento do plano.
// Estes valores sao o MINIMO SEGURO para o plano basico.
const FALLBACKS_LIMITE = {
  'Variedade Produtos': 1000,
  'Usuarios': 1,
  'Gestao de Contratos': 1,
  superAdmin: 99999,
  teste: 10000,
};

/**
 * Converte um valor de limite salvo pelo AdminPlanos (ex: "1.000", "Ilimitado",
 * "5 modelos") em um inteiro utilizavel pelo sistema.
 *
 * @param {string|number|undefined} valor
 * @param {number} fallback
 * @returns {number}
 */
export const parseLimite = (valor, fallback = 1000) => {
  if (valor === undefined || valor === null || valor === '') return fallback;
  if (typeof valor === 'number') return valor;

  const str = String(valor).toLowerCase().replace(/\./g, '').replace(/,/g, '.');
  if (str.includes('ilimitado') || str.includes('unlimited') || str === 'inf') {
    return 99999;
  }

  // Extrai o primeiro numero da string (ex: "3 usuarios" -> 3, "1000" -> 1000)
  const match = str.match(/\d+/);
  if (match) return parseInt(match[0], 10);

  return fallback;
};

// ─── CACHE DE SESSAO (10 MINUTOS) ────────────────────────────────────────────
const _cache = new Map();

/**
 * Busca e retorna os dados completos de um plano pelo ID, com cache de 10min.
 *
 * @param {string} planoId - ID do documento na colecao "planos"
 * @returns {Promise<{beneficios: string[], limites: Object, nome: string}|null>}
 */
export const buscarDadosPlano = async (planoId) => {
  if (!planoId) return null;

  const cacheKey = `plano_${planoId}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 1000 * 60 * 10) {
    return cached.data;
  }

  try {
    const snap = await getDoc(doc(db, 'planos', planoId));
    if (!snap.exists()) return null;
    const data = {
      beneficios: snap.data().beneficios || [],
      limites: snap.data().limites || {},
      nome: snap.data().nome || '',
      preco: snap.data().preco || snap.data().precoMensal || '',
    };
    _cache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.warn('[planoUtils] Erro ao buscar plano do Firestore:', err);
    return null;
  }
};

/**
 * Retorna o limite numerico REAL de um recurso diretamente do campo "limites"
 * do documento do plano no Firestore.
 *
 * COMO USAR:
 *   const limite = await obterLimitePlano(userData.planoId, 'Variedade Produtos', isSuperAdmin, isEmTeste);
 *
 * @param {string} planoId          - ID do plano no Firestore
 * @param {string} nomeRecurso      - Nome EXATO do recurso (igual ao usado no AdminPlanos)
 *                                    Ex: 'Variedade Produtos', 'Usuarios', 'Gestao de Contratos'
 * @param {boolean} isSuperAdmin    - Se true, retorna limite infinito
 * @param {boolean} isEmTeste       - Se true, retorna limite amplo de teste
 * @returns {Promise<number>}
 */
export const obterLimitePlano = async (planoId, nomeRecurso, isSuperAdmin = false, isEmTeste = false) => {
  if (isSuperAdmin) return FALLBACKS_LIMITE.superAdmin;
  if (isEmTeste) return FALLBACKS_LIMITE.teste;

  const fallback = FALLBACKS_LIMITE[nomeRecurso] ?? 1000;
  if (!planoId) return fallback;

  const dadosPlano = await buscarDadosPlano(planoId);
  if (!dadosPlano) return fallback;

  // 1. Busca exata pelo nome do recurso (padrao)
  if (dadosPlano.limites[nomeRecurso] !== undefined) {
    return parseLimite(dadosPlano.limites[nomeRecurso], fallback);
  }

  // 2. Busca fuzzy: percorre as chaves buscando substring
  const chaves = Object.keys(dadosPlano.limites);
  for (const k of chaves) {
    if (
      k.toLowerCase().includes(nomeRecurso.toLowerCase()) ||
      nomeRecurso.toLowerCase().includes(k.toLowerCase())
    ) {
      return parseLimite(dadosPlano.limites[k], fallback);
    }
  }

  return fallback;
};

/**
 * Verifica se um recurso (beneficio booleano) esta ativo no plano.
 *
 * @param {string} planoId       - ID do plano no Firestore
 * @param {string} recursoNome   - Nome exato ou parcial do recurso (ex: "Moodboard")
 * @param {boolean} isEmTeste    - Durante o teste, todos os recursos estao ativos
 * @param {boolean} isSuperAdmin - Super Admin sempre tem acesso
 * @returns {Promise<boolean>}
 */
export const verificarBeneficioPlano = async (planoId, recursoNome, isEmTeste = false, isSuperAdmin = false) => {
  if (isSuperAdmin || isEmTeste) return true;
  if (!planoId || !recursoNome) return false;

  const dadosPlano = await buscarDadosPlano(planoId);
  if (!dadosPlano) return false;

  return dadosPlano.beneficios.some(b => b.toLowerCase().includes(recursoNome.toLowerCase()));
};

/**
 * Invalida o cache de um plano (util apos o AdminPlanos salvar alteracoes).
 * Chame esta funcao no callback de sucesso do salvarTudo() do AdminPlanos.
 *
 * @param {string} [planoId] - Se omitido, limpa TODO o cache.
 */
export const invalidarCachePlano = (planoId) => {
  if (planoId) {
    _cache.delete(`plano_${planoId}`);
  } else {
    _cache.clear();
  }
};
