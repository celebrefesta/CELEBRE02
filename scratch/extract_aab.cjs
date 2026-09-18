const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Criar pasta temporaria de extracao
const tmpExtract = path.join('scratch', 'extracted_v3');
if (!fs.existsSync(tmpExtract)) {
  fs.mkdirSync(tmpExtract, { recursive: true });
}

// Extrair usando tar
execSync(`tar -xf "playstore-bundle/Celebre-v3.zip" -C "${tmpExtract}"`);

const files = fs.readdirSync(tmpExtract);
console.log('Arquivos extraídos:', files);

const aabFile = files.find(f => f.endsWith('.aab'));
const apkFile = files.find(f => f.endsWith('.apk'));

if (aabFile) {
  const aabSrc = path.join(tmpExtract, aabFile);
  const aabDest1 = path.join('playstore-bundle', 'Celebre-v3.aab');
  const aabDest2 = path.join('playstore-bundle', 'Celebre - Gestao de Locacao & Festas (v3).aab');
  fs.copyFileSync(aabSrc, aabDest1);
  fs.copyFileSync(aabSrc, aabDest2);
  console.log('✅ AAB v3 copiado com sucesso:');
  console.log('  ->', aabDest1);
  console.log('  ->', aabDest2);
}

if (apkFile) {
  const apkSrc = path.join(tmpExtract, apkFile);
  const apkDest = path.join('playstore-bundle', 'Celebre-v3.apk');
  fs.copyFileSync(apkSrc, apkDest);
  console.log('✅ APK v3 copiado com sucesso:', apkDest);
}
