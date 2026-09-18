import fs from 'fs';
import path from 'path';

async function run() {
  console.log('Iniciando requisição para PWABuilder CloudAPK...');
  
  const keystoreBuffer = fs.readFileSync('playstore-bundle/signing.keystore');
  const keystoreBase64 = `data:application/octet-stream;base64,${keystoreBuffer.toString('base64')}`;

  const payload = {
    pwaUrl: 'https://celebrefesta.com.br',
    host: 'https://celebrefesta.com.br',
    webManifestUrl: 'https://celebrefesta.com.br/manifest.json',
    packageId: 'br.com.celebrefesta.app',
    name: 'Celebre - Gestão de Locação & Festas',
    launcherName: 'Celebre',
    appVersion: '1.0.2',
    appVersionCode: 3,
    backgroundColor: '#0f172a',
    themeColor: '#0f172a',
    navigationColor: '#0f172a',
    display: 'standalone',
    fallbackType: 'customtabs',
    enableNotifications: true,
    enableSiteSettingsShortcut: true,
    iconUrl: 'https://celebrefesta.com.br/icon-512.png',
    maskableIconUrl: 'https://celebrefesta.com.br/icon-maskable.png',
    includeSourceCode: false,
    splashScreenFadeOutDuration: 300,
    startUrl: '/',
    signingMode: 'mine',
    signing: {
      file: keystoreBase64,
      alias: 'celebre',
      keyPassword: 'mMvu4j6IaJvZ',
      storePassword: 'mMvu4j6IaJvZ'
    }
  };

  try {
    const res = await fetch('https://pwabuilder-cloudapk.azurewebsites.net/generateAppPackage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'platform-identifier': 'PwaBuilder-Cli',
        'platform-identifier-version': '1.0.0'
      },
      body: JSON.stringify(payload)
    });

    console.log('Status da resposta:', res.status, res.statusText);

    if (!res.ok) {
      const errText = await res.text();
      console.error('Erro retornado:', errText);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const outputPath = path.join('playstore-bundle', 'Celebre-v3.zip');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Pacote zip salvo com sucesso em ${outputPath} (${buffer.length} bytes)`);
  } catch (err) {
    console.error('Erro na requisição:', err);
  }
}

run();
