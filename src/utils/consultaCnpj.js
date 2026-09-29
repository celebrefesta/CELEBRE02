/**
 * Motor Centralizado de Consulta de CNPJ com Failover Multi-Provedor
 * Sistema Celebre - Consulta na Receita Federal
 * 
 * Provedores:
 * 1. BrasilAPI (CORS aberto, ultra-rápido)
 * 2. ReceitaWS (JSONP nativo para contornar restrições de CORS no browser)
 * 3. MinhaReceita.org (Espelho público da base da RFB)
 * 4. CNPJ.ws Pública (API pública aberta)
 */

import { formatCNPJ, formatCEP, formatTelefone } from './mascaras.js';
import { validarCNPJ } from './validadores.js';

/**
 * Formata texto com capitalização inteligente (Title Case)
 * Preserva siglas fiscais em maiúsculas (LTDA, ME, EPP, S/A, EIRELI, MEI)
 * e conectores em minúsculas (de, da, do, e, etc.)
 */
export const formatarTextoEmpresa = (texto) => {
  if (!texto || typeof texto !== 'string') return '';
  const conectores = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e', 'em', 'para', 'com'];
  const siglas = ['ltda', 'me', 'epp', 'sa', 's/a', 's.a.', 'eireli', 'mei', 'ss', 's/s', 'cia', 'cia.', 'epe', 'spe'];
  
  // Limpa múltiplos espaços
  const limpo = texto.replace(/\s+/g, ' ').trim();
  const partes = limpo.toLowerCase().split(' ');

  return partes.map((palavra, index) => {
    if (!palavra) return '';
    if (siglas.includes(palavra)) return palavra.toUpperCase();
    if (index > 0 && conectores.includes(palavra)) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }).join(' ');
};

/**
 * Remove números de documento ou CNPJ/CPF embutidos no nome (típico de MEI)
 * Ex: "44.123.456 MARIA SILVA 12345678900" -> "Maria Silva"
 */
export const limparNomeEmpresarioMEI = (razaoSocial) => {
  if (!razaoSocial || typeof razaoSocial !== 'string') return '';
  let limpo = razaoSocial
    .replace(/^[\d\.\/\-\s]+/, '') // Remove dígitos no início
    .replace(/[\d\.\/\-\s]+$/, '') // Remove dígitos no final
    .trim();
  return formatarTextoEmpresa(limpo);
};

/**
 * Consulta ReceitaWS via JSONP dinâmico para contornar trava de CORS do navegador
 */
const consultarReceitaWSJsonp = (cnpjLimpo, timeoutMs = 8000) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Ambiente sem window.'));
    }

    const callbackName = `receitaws_cb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite excedido na consulta ReceitaWS.'));
    }, timeoutMs);

    window[callbackName] = (response) => {
      cleanup();
      if (!response) {
        return reject(new Error('Resposta vazia da ReceitaWS.'));
      }
      if (response.status === 'ERROR') {
        return reject(new Error(response.message || 'CNPJ não encontrado na ReceitaWS.'));
      }
      resolve(response);
    };

    script.src = `https://receitaws.com.br/v1/cnpj/${cnpjLimpo}?callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error('Falha de rede ao contatar ReceitaWS.'));
    };

    document.head.appendChild(script);
  });
};

/**
 * Executa fetch com timeout configurável
 */
const fetchComTimeout = async (url, options = {}, timeoutMs = 7000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
};

/**
 * Função Mestra de Consulta de CNPJ
 * @param {string} cnpjEntrada - CNPJ formatado ou apenas dígitos
 * @returns {Promise<Object>} Dados normalizados da empresa
 */
export const consultarCNPJ = async (cnpjEntrada) => {
  const cnpjLimpo = String(cnpjEntrada || '').replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    return {
      sucesso: false,
      erro: `CNPJ incompleto (${cnpjLimpo.length}/14 dígitos). Digite os 14 números do CNPJ.`,
      codigo: 'CNPJ_INCOMPLETO'
    };
  }

  if (!validarCNPJ(cnpjLimpo)) {
    return {
      sucesso: false,
      erro: 'CNPJ inválido. Os dígitos verificadores não conferem com o cálculo oficial da Receita Federal.',
      codigo: 'CNPJ_INVALIDO'
    };
  }

  let dadosBrutos = null;
  let provedorUtilizado = null;

  // 1º TENTATIVA: BrasilAPI (Rápida, CORS nativo)
  try {
    const resp1 = await fetchComTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {}, 6500);
    if (resp1.ok) {
      const json1 = await resp1.json();
      if (json1 && (json1.razao_social || json1.nome_fantasia)) {
        dadosBrutos = {
          razao_social: json1.razao_social,
          nome_fantasia: json1.nome_fantasia || json1.razao_social,
          cep: json1.cep,
          logradouro: json1.logradouro,
          numero: json1.numero,
          complemento: json1.complemento,
          bairro: json1.bairro,
          municipio: json1.municipio,
          uf: json1.uf,
          telefone: json1.ddd_telefone_1 ? `${json1.ddd_telefone_1}` : (json1.ddd_telefone_2 || ''),
          email: json1.email,
          situacao: json1.descricao_situacao_cadastral || 'ATIVA',
          data_abertura: json1.data_inicio_atividade,
          atividade_principal: json1.cnae_fiscal_descricao
        };
        provedorUtilizado = 'BrasilAPI';
      }
    }
  } catch (_) {
    // Falha silenciosa, aciona failover
  }

  // 2º TENTATIVA: ReceitaWS via JSONP (Oficial e tolerante a CORS)
  if (!dadosBrutos) {
    try {
      const resp2 = await consultarReceitaWSJsonp(cnpjLimpo, 7000);
      if (resp2 && (resp2.nome || resp2.fantasia)) {
        dadosBrutos = {
          razao_social: resp2.nome,
          nome_fantasia: resp2.fantasia || resp2.nome,
          cep: resp2.cep,
          logradouro: resp2.logradouro,
          numero: resp2.numero,
          complemento: resp2.complemento,
          bairro: resp2.bairro,
          municipio: resp2.municipio,
          uf: resp2.uf,
          telefone: resp2.telefone,
          email: resp2.email,
          situacao: resp2.situacao || 'ATIVA',
          data_abertura: resp2.abertura,
          atividade_principal: resp2.atividade_principal?.[0]?.text || ''
        };
        provedorUtilizado = 'ReceitaWS';
      }
    } catch (_) {
      // Falha silenciosa, aciona failover
    }
  }

  // 3º TENTATIVA: MinhaReceita.org
  if (!dadosBrutos) {
    try {
      const resp3 = await fetchComTimeout(`https://minhareceita.org/${cnpjLimpo}`, {}, 6500);
      if (resp3.ok) {
        const json3 = await resp3.json();
        if (json3 && (json3.razao_social || json3.nome_fantasia)) {
          dadosBrutos = {
            razao_social: json3.razao_social,
            nome_fantasia: json3.nome_fantasia || json3.razao_social,
            cep: json3.cep,
            logradouro: json3.logradouro,
            numero: json3.numero,
            complemento: json3.complemento,
            bairro: json3.bairro,
            municipio: json3.municipio,
            uf: json3.uf,
            telefone: json3.ddd_telefone_1 || '',
            email: json3.email,
            situacao: json3.descricao_situacao_cadastral || 'ATIVA',
            data_abertura: json3.data_inicio_atividade,
            atividade_principal: json3.cnae_fiscal_descricao
          };
          provedorUtilizado = 'MinhaReceita';
        }
      }
    } catch (_) {
      // Falha silenciosa, aciona failover
    }
  }

  // 4º TENTATIVA: CNPJ.ws Pública
  if (!dadosBrutos) {
    try {
      const resp4 = await fetchComTimeout(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {}, 6500);
      if (resp4.ok) {
        const json4 = await resp4.json();
        const est = json4.estabelecimento || {};
        if (json4.razao_social || est.nome_fantasia) {
          dadosBrutos = {
            razao_social: json4.razao_social,
            nome_fantasia: est.nome_fantasia || json4.razao_social,
            cep: est.cep,
            logradouro: est.logradouro,
            numero: est.numero,
            complemento: est.complemento,
            bairro: est.bairro,
            municipio: est.cidade?.nome,
            uf: est.estado?.sigla,
            telefone: (est.ddd1 || '') + (est.telefone1 || ''),
            email: est.email,
            situacao: est.situacao_cadastral || 'ATIVA',
            data_abertura: est.data_inicio_atividade,
            atividade_principal: est.atividade_principal?.descricao || ''
          };
          provedorUtilizado = 'CNPJ.ws';
        }
      }
    } catch (_) {
      // Falha silenciosa
    }
  }

  if (!dadosBrutos) {
    return {
      sucesso: false,
      erro: 'CNPJ não encontrado nas bases da Receita Federal ou servidores temporariamente indisponíveis. Verifique os números digitados.',
      codigo: 'NAO_LOCALIZADO'
    };
  }

  // Normalização e Formatação Premium
  const rawRSocial = dadosBrutos.razao_social || '';
  const rawNFantasia = dadosBrutos.nome_fantasia || rawRSocial;

  const razaoSocialFmt = formatarTextoEmpresa(rawRSocial);
  const nomeFantasiaLimpo = rawNFantasia.replace(/^[\d\.\/\-\s]+/, '').replace(/[\d\.\/\-\s]+$/, '').trim();
  const nomeFantasiaFmt = formatarTextoEmpresa(nomeFantasiaLimpo || rawRSocial);
  const nomeResponsavelSugerido = limparNomeEmpresarioMEI(rawRSocial);

  const cepFmt = dadosBrutos.cep ? formatCEP(dadosBrutos.cep) : '';
  const logradouroFmt = formatarTextoEmpresa(dadosBrutos.logradouro || '');
  const numeroFmt = String(dadosBrutos.numero || '').trim();
  const complementoFmt = formatarTextoEmpresa(dadosBrutos.complemento || '');
  const bairroFmt = formatarTextoEmpresa(dadosBrutos.bairro || '');
  const cidadeFmt = formatarTextoEmpresa(dadosBrutos.municipio || '');
  const ufFmt = String(dadosBrutos.uf || '').toUpperCase().trim();

  // Telefone / WhatsApp
  let telLimpo = String(dadosBrutos.telefone || '').replace(/\D/g, '');
  if (telLimpo.startsWith('55') && telLimpo.length > 11) {
    telLimpo = telLimpo.slice(2);
  }
  const telefoneFmt = telLimpo ? formatTelefone(telLimpo) : '';

  const emailFmt = String(dadosBrutos.email || '').toLowerCase().trim();
  const situacao = String(dadosBrutos.situacao || 'ATIVA').toUpperCase().trim();
  const isAtiva = situacao.includes('ATIVA');

  return {
    sucesso: true,
    provedor: provedorUtilizado,
    cnpj: formatCNPJ(cnpjLimpo),
    cnpjLimpo,
    razaoSocial: razaoSocialFmt,
    nomeFantasia: nomeFantasiaFmt,
    nomeExibicao: nomeFantasiaFmt || razaoSocialFmt,
    nomeResponsavelSugerido,
    cep: cepFmt,
    logradouro: logradouroFmt,
    numero: numeroFmt,
    complemento: complementoFmt,
    bairro: bairroFmt,
    cidade: cidadeFmt,
    uf: ufFmt,
    telefone: telefoneFmt,
    email: emailFmt,
    situacaoCadastral: situacao,
    isAtiva,
    dataAbertura: dadosBrutos.data_abertura || '',
    atividadePrincipal: formatarTextoEmpresa(dadosBrutos.atividade_principal || '')
  };
};
