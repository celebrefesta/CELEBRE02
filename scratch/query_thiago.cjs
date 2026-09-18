const https = require('https');

function callEndpoint(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function main() {
  const url = 'https://us-central1-celebre-9f5c9.cloudfunctions.net/consultarAssinaturaThiago';
  console.log('Calling:', url);
  try {
    const res = await callEndpoint(url);
    console.log('Status:', res.status);
    console.log('Data:', res.data);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
