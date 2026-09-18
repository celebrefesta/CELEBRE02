const { execSync } = require('child_process');
const fs = require('fs');

execSync('tar -xf "playstore-bundle/Celebre-v3.aab" -C scratch base/manifest/AndroidManifest.xml');
const buf = fs.readFileSync('scratch/base/manifest/AndroidManifest.xml');
const clean = buf.toString('utf8').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ');

const startIdx = clean.indexOf('package');
if (startIdx !== -1) {
  console.log('Manifesto extraído:');
  console.log(clean.substring(startIdx, startIdx + 250));
} else {
  console.log('Manifesto completo (snippet):', clean.substring(0, 300));
}
