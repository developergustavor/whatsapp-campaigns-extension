import fs from 'node:fs/promises';
import path from 'node:path';
const tag=process.argv[2]||'v4.6.0';
if(!/^(nightly|v\d+\.\d+\.\d+)$/.test(tag))throw Error('Use v4.6.0 ou nightly.');
const base=`https://github.com/wppconnect-team/wa-js/releases/download/${tag}/`;
const r=await fetch(base+'wppconnect-wa.js',{signal:AbortSignal.timeout(60000)});
if(!r.ok)throw Error(`Download falhou: ${r.status}`);
const code=await r.text();if(code.length<10000||!code.includes('WPP'))throw Error('Resposta inválida.');
const dir=path.resolve(import.meta.dirname,'../vendor');await fs.mkdir(dir,{recursive:true});
// Adquire a licença antes de substituir o bundle.
let license=await fetch(base+'wppconnect-wa.js.LICENSE.txt',{signal:AbortSignal.timeout(60000)});
if(!license.ok)license=await fetch(`https://unpkg.com/@wppconnect/wa-js@${tag==='nightly'?'nightly':tag.slice(1)}/dist/wppconnect-wa.js.LICENSE.txt`,{signal:AbortSignal.timeout(60000)});
if(!license.ok)throw Error('Não foi possível baixar as licenças da versão. O bundle foi preservado.');
const text=await license.text();
await fs.writeFile(path.join(dir,'wppconnect-wa.js'),code);
await fs.writeFile(path.join(dir,'wppconnect-wa.js.LICENSE.txt'),text);
console.log(`WA-JS ${tag} atualizado. Rode npm run build e recarregue a extensão e o WhatsApp.`);
