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

/**
 * Valida se uma data de nascimento é válida:
 * 1. Formato de calendário válido (ano, mês e dia reais);
 * 2. Ano de 4 dígitos e pessoa com menos de 100 anos;
 * 3. Não pode ser no futuro (dia que ainda não existiu).
 * @param {string|Date} data 
 * @returns {{ valido: boolean, preenchido: boolean, motivo?: string }}
 */
export const validarDataNascimento = (data) => {
  if (!data) return { valido: true, preenchido: false };

  let dataStr = typeof data === 'string' ? data.trim() : '';
  if (data instanceof Date) {
    if (isNaN(data.getTime())) return { valido: false, preenchido: true, motivo: 'data_invalida' };
    dataStr = data.toISOString().split('T')[0];
  }

  const partes = dataStr.split('-');
  if (partes.length !== 3) return { valido: false, preenchido: true, motivo: 'formato_invalido' };

  const ano = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  const dia = parseInt(partes[2], 10);

  // Ano precisa ter estritamente 4 dígitos (bloqueia 5+ dígitos como 84255 ou 1-3 dígitos)
  if (isNaN(ano) || isNaN(mes) || isNaN(dia) || partes[0].length !== 4) {
    return { valido: false, preenchido: true, motivo: 'ano_invalido' };
  }

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  const cemAnosAtras = new Date();
  cemAnosAtras.setFullYear(hoje.getFullYear() - 100);
  cemAnosAtras.setHours(0, 0, 0, 0);

  const dataInformada = new Date(ano, mes - 1, dia);

  // Verifica validade real no calendário (ex: ano bissexto, 31 de abril, etc.)
  if (
    dataInformada.getFullYear() !== ano ||
    dataInformada.getMonth() !== mes - 1 ||
    dataInformada.getDate() !== dia
  ) {
    return { valido: false, preenchido: true, motivo: 'data_inexistente' };
  }

  // Não pode ser no futuro (dia que ainda não existiu)
  if (dataInformada > hoje) {
    return { valido: false, preenchido: true, motivo: 'futuro' };
  }

  // Precisa ser de uma pessoa com menos de 100 anos
  if (dataInformada < cemAnosAtras) {
    return { valido: false, preenchido: true, motivo: 'mais_de_100_anos' };
  }

  return { valido: true, preenchido: true };
};

