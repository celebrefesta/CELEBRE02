const https = require('https');

const postData = JSON.stringify({
  email: 'vichinhskfotografia@gmail.com',
  verificarApenas: true
});

const req = https.request('https://enviarlinkredefinicaosenha-yfhz7t44jq-uc.a.run.app', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', err => console.error('Error:', err.message));
req.write(postData);
req.end();
