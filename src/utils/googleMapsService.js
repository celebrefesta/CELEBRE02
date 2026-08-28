/**
 * 🗺️ Google Maps Service para Cálculo Exato de Distância e Rotas
 * Utiliza o DistanceMatrixService oficial do Google Maps JavaScript SDK (sem problemas de CORS)
 */

let scriptCarregandoPromise = null;

export const carregarGoogleMapsScript = (apiKey) => {
  if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.DistanceMatrixService) {
    return Promise.resolve(window.google);
  }

  if (scriptCarregandoPromise) {
    return scriptCarregandoPromise;
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return Promise.reject(new Error("Chave de API do Google Maps não informada."));
  }

  scriptCarregandoPromise = new Promise((resolve, reject) => {
    // Verificar se a tag script já existe no DOM
    const scriptExistente = document.getElementById('google-maps-sdk-script');
    if (scriptExistente) {
      scriptExistente.remove();
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk-script';
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey.trim())}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Falha ao inicializar o Google Maps SDK."));
      }
    };

    script.onerror = (err) => {
      scriptCarregandoPromise = null;
      reject(new Error("Erro ao carregar o script do Google Maps. Verifique sua conexão e a chave de API."));
    };

    document.head.appendChild(script);
  });

  return scriptCarregandoPromise;
};

/**
 * 📏 Calcula a distância exata de condução (carro/trânsito) entre dois endereços usando a API oficial do Google
 * @param {string} origem Endereço completo de partida (ex: "Rua X, 100, Cidade - UF")
 * @param {string} destino Endereço completo de chegada (ex: "Rua Y, 200, Cidade - UF")
 * @param {string} apiKey Chave oficial da Google Maps API
 * @returns {Promise<{ km: number, metros: number, duracaoTexto: string, distanciaTexto: string, enderecoOrigemFormatado: string, enderecoDestinoFormatado: string }>}
 */
export const calcularDistanciaGoogleMaps = async (origem, destino, apiKey) => {
  if (!apiKey) {
    throw new Error("Chave de API do Google Maps ausente.");
  }
  if (!origem || !destino) {
    throw new Error("Endereço de origem e destino são obrigatórios.");
  }

  await carregarGoogleMapsScript(apiKey);

  return new Promise((resolve, reject) => {
    try {
      const service = new window.google.maps.DistanceMatrixService();

      service.getDistanceMatrix(
        {
          origins: [origem],
          destinations: [destino],
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.METRIC,
          avoidHighways: false,
          avoidTolls: false,
        },
        (response, status) => {
          if (status !== 'OK' || !response) {
            return reject(new Error(`Erro retornado pelo Google Maps: ${status}`));
          }

          const row = response.rows && response.rows[0];
          if (!row || !row.elements || !row.elements[0]) {
            return reject(new Error("Nenhum resultado de rota retornado pelo Google Maps."));
          }

          const element = row.elements[0];

          if (element.status === 'ZERO_RESULTS' || element.status === 'NOT_FOUND') {
            return reject(new Error("Google Maps não encontrou trajeto viário entre esses dois endereços."));
          }

          if (element.status !== 'OK') {
            return reject(new Error(`Falha no cálculo da rota: ${element.status}`));
          }

          const metros = element.distance.value;
          const km = Math.round((metros / 1000) * 10) / 10;
          const distanciaTexto = element.distance.text;
          const duracaoTexto = element.duration.text;
          const enderecoOrigemFormatado = response.originAddresses ? response.originAddresses[0] : origem;
          const enderecoDestinoFormatado = response.destinationAddresses ? response.destinationAddresses[0] : destino;

          resolve({
            km,
            metros,
            distanciaTexto,
            duracaoTexto,
            enderecoOrigemFormatado,
            enderecoDestinoFormatado,
            oficialGoogle: true
          });
        }
      );
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * 🧪 Testa se a chave do Google Maps é válida fazendo uma rota teste simples
 */
export const testarChaveGoogleMaps = async (apiKey) => {
  return calcularDistanciaGoogleMaps(
    'Avenida Paulista, 1000, São Paulo - SP',
    'Praça da Sé, São Paulo - SP',
    apiKey
  );
};
