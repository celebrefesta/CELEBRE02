/**
 * Módulo Central de Máscaras e Formatação de Dados para o Celebre
 */

// 🔢 Máscara Dinâmica de CPF ou CNPJ (CPF: 11 dígitos -> 000.000.000-00 | CNPJ: 14 dígitos -> 00.000.000/0000-00)
export const formatCpfCnpj = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

// 🪪 Máscara de CPF Exclusivo (000.000.000-00)
export const formatCPF = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// 🏢 Máscara de CNPJ Exclusivo (00.000.000/0000-00)
export const formatCNPJ = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

// 📮 Máscara de CEP (00000-000)
export const formatCEP = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, '$1-$2');
};

// 📞 Máscara de Telefone / WhatsApp ((00) 00000-0000 ou (00) 0000-0000)
export const formatTelefone = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

// 🔤 Capitalização de Nome (Title Case)
export const capitalize = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .join(' ');
};

// 🔒 Anonimização Profissional de E-mail (ex: camila.vichinhsk@hotmail.com -> ca••••••••••sk@hotmail.com)
export const anonimizarEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '';
  const partes = email.trim().toLowerCase().split('@');
  const user = partes[0];
  const domain = partes.slice(1).join('@');
  
  if (user.length <= 2) {
    return `${user.charAt(0)}•@${domain}`;
  }
  if (user.length <= 4) {
    return `${user.slice(0, 1)}••${user.slice(-1)}@${domain}`;
  }
  
  const visivelInicio = user.slice(0, 2);
  const visivelFim = user.slice(-2);
  const qtdMascara = Math.min(10, Math.max(4, user.length - 4));
  const asteriscos = '•'.repeat(qtdMascara);
  
  return `${visivelInicio}${asteriscos}${visivelFim}@${domain}`;
};

// 🔒 Re-export de Validação Oficial de Documentos (CPF / CNPJ)
export { validarCPF, validarCNPJ, validarCpfCnpj, obterMensagemErroDocumento } from './validadores';

