import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';

/**
 * Redimensiona e comprime uma foto em tempo real usando HTML5 Canvas.
 * Evita fotos gigantes de câmeras móveis (5-12MB) que estouram limites do Firestore.
 * 
 * @param {File} file - Arquivo de imagem obtido do input type="file"
 * @param {number} maxWidth - Largura máxima recomendada (padrão: 1200px)
 * @param {number} maxHeight - Altura máxima recomendada (padrão: 1200px)
 * @param {number} quality - Qualidade JPEG (0.1 a 1.0, padrão: 0.72)
 * @returns {Promise<string>} String Data URL comprimida em formato image/jpeg
 */
export const compilarEComprimirFoto = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.72) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('O arquivo fornecido não é uma imagem válida.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro ao carregar os dados da imagem.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular proporções sem distorção
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; // Fundo branco caso haja transparência no PNG
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Varre as locações finalizadas no Firestore e remove arquivos Base64 de vistorias
 * cuja data `expirarFotosEm` seja menor ou igual ao momento atual e que não tenham avarias retidas.
 * 
 * @param {object} db - Instância do Firebase Firestore
 * @param {string} [tenantId] - ID da empresa (opcional para filtro por tenant)
 * @returns {Promise<{ totalProcessados: number, totalFotosLimpas: number, sucesso: boolean }>}
 */
export const executarLimpezaMidiasExpiradas = async (db, tenantId = null) => {
  try {
    const hojeISO = new Date().toISOString();
    const activeTenantId = tenantId || localStorage.getItem('tenantId');

    if (!activeTenantId) {
      return { totalProcessados: 0, totalFotosLimpas: 0, sucesso: true };
    }

    const locRef = collection(db, 'locacoes');
    // Consulta alinhada com as Regras de Segurança do Firebase (filtrando por userId do tenant)
    const q = query(locRef, where('userId', '==', activeTenantId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { totalProcessados: 0, totalFotosLimpas: 0, sucesso: true };
    }

    const batch = writeBatch(db);
    let totalProcessados = 0;
    let totalFotosLimpas = 0;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();

      // Pula registros que não possuem data de expiração ou cuja data ainda não chegou
      if (!data.expirarFotosEm || data.expirarFotosEm > hojeISO) return;

      // Pula registros que possuem a trava permanente de avarias/faltas
      if (data.fotosManterPermanente === true) return;

      const qtdRetorno = Array.isArray(data.fotosRetorno) ? data.fotosRetorno.length : 0;
      const qtdCheckinRetorno = Array.isArray(data.fotosCheckinRetorno) ? data.fotosCheckinRetorno.length : 0;
      const qtdCheckinSaida = Array.isArray(data.fotosCheckinSaida) ? data.fotosCheckinSaida.length : 0;

      const fotosContadas = qtdRetorno + qtdCheckinRetorno + qtdCheckinSaida;

      batch.update(docSnap.ref, {
        fotosRetorno: [],
        fotosCheckinRetorno: [],
        fotosCheckinSaida: [],
        fotosExpiradas: true,
        fotosExpiradasEm: hojeISO,
        expirarFotosEm: null
      });

      totalProcessados++;
      totalFotosLimpas += fotosContadas;
    });

    if (totalProcessados > 0) {
      await batch.commit();
    }

    return {
      totalProcessados,
      totalFotosLimpas,
      sucesso: true
    };
  } catch (err) {
    console.error('Erro ao executar limpeza de mídias expiradas:', err);
    return {
      totalProcessados: 0,
      totalFotosLimpas: 0,
      sucesso: false,
      erro: err.message
    };
  }
};

/**
 * Executa a limpeza em segundo plano de forma transparente no navegador,
 * limitando a execução para no máximo 1 vez a cada 24 horas via localStorage.
 */
export const verificarELimparMidiasBackground = async (db, tenantId = null) => {
  try {
    const chaveStorage = `celebre_ultima_limpeza_midia_${tenantId || 'global'}`;
    const ultimaExecucao = localStorage.getItem(chaveStorage);
    const agora = Date.now();

    // Se foi executado há menos de 24 horas (86.400.000 ms), não faz nada
    if (ultimaExecucao && agora - parseInt(ultimaExecucao, 10) < 86400000) {
      return;
    }

    const resultado = await executarLimpezaMidiasExpiradas(db, tenantId);
    localStorage.setItem(chaveStorage, agora.toString());

    if (resultado.sucesso && resultado.totalProcessados > 0) {
      console.log(`[Limpeza de Mídia Auto] ${resultado.totalProcessados} locação(ões) limpa(s). ${resultado.totalFotosLimpas} foto(s) removida(s).`);
    }
  } catch (err) {
    console.warn('[Limpeza de Mídia Auto] Falha na execução em segundo plano:', err);
  }
};
