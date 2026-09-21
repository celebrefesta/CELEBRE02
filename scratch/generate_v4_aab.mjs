import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function run() {
  console.log('Iniciando requisição para PWABuilder CloudAPK com versionCode 4 (v1.0.3)...');
  
  const keystoreBuffer = fs.readFileSync('playstore-bundle/signing.keystore');
  const keystoreBase64 = `data:application/octet-stream;base64,${keystoreBuffer.toString('base64')}`;

  const payload = {
    pwaUrl: 'https://celebrefesta.com.br',
    host: 'https://celebrefesta.com.br',
    webManifestUrl: 'https://celebrefesta.com.br/manifest.json',
    packageId: 'br.com.celebrefesta.app',
    name: 'Celebre - Gestão de Locação & Festas',
    launcherName: 'Celebre',
    appVersion: '1.0.3',
    appVersionCode: 4,
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
    const zipPath = path.join('playstore-bundle', 'Celebre-v4.zip');
    fs.writeFileSync(zipPath, buffer);
    console.log(`Pacote zip salvo com sucesso em ${zipPath} (${buffer.length} bytes)`);

    // Extrair
    const tmpExtract = path.join('scratch', 'extracted_v4');
    if (!fs.existsSync(tmpExtract)) {
      fs.mkdirSync(tmpExtract, { recursive: true });
    }

    execSync(`tar -xf "${zipPath}" -C "${tmpExtract}"`);
    const files = fs.readdirSync(tmpExtract);
    console.log('Arquivos extraídos:', files);

    const aabFile = files.find(f => f.endsWith('.aab'));
    const apkFile = files.find(f => f.endsWith('.apk'));

    if (aabFile) {
      const aabSrc = path.join(tmpExtract, aabFile);
      const aabDest1 = path.join('playstore-bundle', 'Celebre-v4.aab');
      const aabDest2 = path.join('playstore-bundle', 'Celebre - Gestao de Locacao & Festas (v4).aab');
      fs.copyFileSync(aabSrc, aabDest1);
      fs.copyFileSync(aabSrc, aabDest2);
      console.log('✅ AAB v4 copiado com sucesso:');
      console.log('  ->', aabDest1);
      console.log('  ->', aabDest2);
    }

    if (apkFile) {
      const apkSrc = path.join(tmpExtract, apkFile);
      const apkDest = path.join('playstore-bundle', 'Celebre-v4.apk');
      fs.copyFileSync(apkSrc, apkDest);
      console.log('✅ APK v4 copiado com sucesso:', apkDest);
    }

    console.log('🎉 TUDO PRONTO PARA VERSÃO 4!');
  } catch (err) {
    console.error('Erro na geração:', err);
  }
}

run();
