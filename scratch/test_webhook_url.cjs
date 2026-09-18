const https = require('https');

const postData = JSON.stringify({
  action: 'ping',
  data: { id: '1' }
});

const options = {
  hostname: 'webhookmercadopago-yfhz7t44jq-uc.a.run.app',
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
});

req.on('error', console.error);
req.write(postData);
req.end();
