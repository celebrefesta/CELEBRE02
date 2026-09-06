/**
 * Serviço oficial de envio de comprovante de exclusão de conta & dados (LGPD / Google Play)
 * Dispara requisição para a Cloud Function integrada ao Resend com o remetente oficial:
 * seguranca@celebreapp.com
 */

const CLOUD_FUNCTION_URL = 'https://us-central1-celebre-9f5c9.cloudfunctions.net/enviarComprovanteExclusao';

export const gerarProtocoloExclusao = () => {
  const ano = new Date().getFullYear();
  const aleatorio = Math.floor(10000 + Math.random() * 90000);
  return `CEL-EXCL-${ano}-${aleatorio}`;
};

export const enviarComprovanteExclusaoEmail = async ({ email, nome = '', motivo = '', protocolo = null }) => {
  if (!email || !email.includes('@')) {
    throw new Error('E-mail inválido para envio do comprovante de exclusão.');
  }

  const proto = protocolo || gerarProtocoloExclusao();

  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        motivo: motivo.trim(),
        protocolo: proto
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn("Falha no disparo via Cloud Function:", errorData);
      return {
        success: false,
        protocolo: proto,
        error: errorData.error || 'Erro ao processar envio do comprovante.'
      };
    }

    const data = await response.json();
    return {
      success: true,
      protocolo: data.protocolo || proto,
      emailId: data.emailId
    };
  } catch (err) {
    console.error("Erro na comunicação com o serviço de e-mail de exclusão:", err);
    return {
      success: false,
      protocolo: proto,
      error: err.message
    };
  }
};
