/**
 * 🔒 Módulo Central de Validação de Documentos Oficiais (Receita Federal do Brasil)
 * Sistema Celebre - Blindagem contra CPFs/CNPJs falsos, sequenciais ou incompletos.
 */

/**
 * Valida se um CPF é matematicamente válido segundo o algoritmo oficial da Receita Federal.
 * @param {string|number} cpf 
 * @returns {boolean}
 */
export const validarCPF = (cpf) => {
  if (!cpf) return false;
  const limpo = String(cpf).replace(/\D/g, '');

  // CPF deve ter exatamente 11 dígitos numéricos
  if (limpo.length !== 11) return false;

  // Bloqueia números conhecidos de dígitos repetidos (ex: 111.111.111-11, 000.000.000-00)
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  // 1º Dígito Verificador (Módulo 11)
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  // 2º Dígito Verificador (Módulo 11)
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(10), 10)) return false;

  return true;
};

/**
 * Valida se um CNPJ é matematicamente válido segundo o algoritmo oficial da Receita Federal.
 * @param {string|number} cnpj 
 * @returns {boolean}
 */
export const validarCNPJ = (cnpj) => {
  if (!cnpj) return false;
  const limpo = String(cnpj).replace(/\D/g, '');

  // CNPJ deve ter exatamente 14 dígitos numéricos
  if (limpo.length !== 14) return false;

  // Bloqueia números com todos os dígitos repetidos (ex: 00000000000000, 11111111111111)
  if (/^(\d)\1{13}$/.test(limpo)) return false;

  // 1º Dígito Verificador (Pesos: 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(limpo.charAt(i), 10) * pesos1[i];
  }
  let resto = soma % 11;
  let digito1 = resto < 2 ? 0 : 11 - resto;
  if (digito1 !== parseInt(limpo.charAt(12), 10)) return false;

  // 2º Dígito Verificador (Pesos: 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(limpo.charAt(i), 10) * pesos2[i];
  }
  resto = soma % 11;
  let digito2 = resto < 2 ? 0 : 11 - resto;
  if (digito2 !== parseInt(limpo.charAt(13), 10)) return false;

  return true;
};

/**
 * Validação Inteligente Dinâmica para campos que aceitam CPF ou CNPJ.
 * Identifica o tipo pelo comprimento dos dígitos (11 = CPF, 14 = CNPJ).
 * @param {string|number} documento 
 * @returns {boolean}
 */
export const validarCpfCnpj = (documento) => {
  if (!documento) return false;
  const limpo = String(documento).replace(/\D/g, '');
  if (limpo.length === 11) return validarCPF(limpo);
  if (limpo.length === 14) return validarCNPJ(limpo);
  return false;
};

/**
 * Retorna mensagem de erro detalhada e amigável em caso de documento inválido.
 * @param {string|number} documento 
 * @param {'fisica'|'juridica'|'auto'} tipoEsperado 
 * @returns {string|null} null se for válido, ou mensagem de erro se for inválido.
 */
export const obterMensagemErroDocumento = (documento, tipoEsperado = 'auto') => {
  if (!documento) return 'Documento não informado.';
  const limpo = String(documento).replace(/\D/g, '');

  if (tipoEsperado === 'fisica' || (tipoEsperado === 'auto' && limpo.length <= 11)) {
    if (limpo.length < 11) {
      return `CPF incompleto (${limpo.length}/11 dígitos). Por favor, preencha todos os 11 números.`;
    }
    if (!validarCPF(limpo)) {
      return 'CPF inválido. Os dígitos verificadores não conferem com o padrão da Receita Federal.';
    }
    return null;
  }

  if (tipoEsperado === 'juridica' || (tipoEsperado === 'auto' && limpo.length > 11)) {
    if (limpo.length < 14) {
      return `CNPJ incompleto (${limpo.length}/14 dígitos). Por favor, preencha todos os 14 números.`;
    }
    if (!validarCNPJ(limpo)) {
      return 'CNPJ inválido. Os dígitos verificadores não conferem com o padrão da Receita Federal.';
    }
    return null;
  }

  return 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.';
};
