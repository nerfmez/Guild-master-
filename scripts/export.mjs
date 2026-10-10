import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const modules={'site.js':'Site','content.js':'Content','game.js':'Engine','render.js':'Artwork','guild-art.js':'GuildArtwork','world.js':'World'};
function replaceImports(source){return source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?/g,(_,names,file)=>`const {${names}}=${modules[file]};`);}
const phaser=(await readFile('node_modules/phaser/dist/phaser.min.js','utf8'));
const compressed=gzipSync(phaser,{level:9}).toString('base64');
// Embed the pinned runtime once. Decompress locally; no download or CDN request.
let script=`const phaserBytes=Uint8Array.from(atob('${compressed}'),c=>c.charCodeAt(0));\nconst phaserSource=await new Response(new Blob([phaserBytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();\nconst phaserURL=URL.createObjectURL(new Blob([phaserSource],{type:'text/javascript'}));\nawait new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=phaserURL;s.onload=()=>{URL.revokeObjectURL(phaserURL);resolve();};s.onerror=reject;document.head.appendChild(s);});\n`;
for(const file of ['core','terrain','buildings','nature','props'])script+=await readFile(`src/art/${file}.js`,'utf8');
for(const [file,name] of Object.entries(modules)){
 const source=await readFile(`src/${file}`,'utf8');
 const names=[...source.matchAll(/^export\s+(?:const|function|class)\s+(\w+)/gm)].map(m=>m[1]);
 script+=`const ${name}=(()=>{\n${replaceImports(source).replace(/^export\s+/gm,'')}\nreturn {${names.join(',')}};\n})();\n`;
}
script+=replaceImports(await readFile('src/app.js','utf8'));
let css=await readFile('src/styles.css','utf8');
for(const weight of [400,600]){const b64=(await readFile(`assets/fonts/noto-thai-${weight}.ttf`)).toString('base64');css=css.replaceAll(`../assets/fonts/noto-thai-${weight}.ttf`,`data:font/ttf;base64,${b64}`);}
const emblem='data:image/svg+xml;base64,'+(await readFile('assets/leaf.svg')).toString('base64');
const license=await readFile('assets/fonts/OFL.txt','utf8');
let html=await readFile('index.html','utf8');
html=html.replace(/<script src="\.\/(?:node_modules\/phaser\/dist\/phaser\.min\.js|src\/art\/[^"\s]+\.js)"><\/script>/g,'');
html=html.replace('<link rel="stylesheet" href="./src/styles.css">',`<style>${css}</style>`).replaceAll('./assets/leaf.svg',emblem).replace('<script type="module" src="./src/app.js"></script>',`<script type="module">${script.replaceAll('</script>','<\\/script>')}</script>\n<!-- Bundled Noto Sans Thai license:\n${license}\n-->`);
const phaserLicense=await readFile('node_modules/phaser/LICENSE.md','utf8');
html+=`\n<!-- Bundled Phaser 3.90.0 MIT license:\n${phaserLicense}\n-->`;
await writeFile('play.html',html);
console.log(`Exported play.html (${Math.round(Buffer.byteLength(html)/1024)} KiB), standalone with fonts and no network dependencies.`);
