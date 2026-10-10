import {readFile,writeFile} from 'node:fs/promises';
const modules={'site.js':'Site','content.js':'Content','life.js':'Life','events.js':'Storyteller','trade.js':'Trade','monsters.js':'Bestiary','game.js':'Engine','render.js':'Artwork','dungeon.js':'Dungeon','guild-art.js':'GuildArtwork','worldart.js':'WorldArt','landmarks.js':'Landmarks','overworld.js':'Overworld','world.js':'World'};
function replaceImports(source){return source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?/g,(_,names,file)=>`const {${names}}=${modules[file]};`);}
const phaser=(await readFile('node_modules/phaser/dist/phaser.min.js','utf8'));
// Classic inline scripts also run from Android download providers. Startup does
// not require ES modules, top-level await, Blob URLs or DecompressionStream.
let script='';
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
html=html.replace(/<script src="\.\/(?:src\/boot\.js|node_modules\/phaser\/dist\/phaser\.min\.js|src\/art\/[^"\s]+\.js)"><\/script>/g,'');
const inline=source=>source.replace(/<\/script/gi,'<\\/script');
const boot=await readFile('src/boot.js','utf8');
html=html.replace('<link rel="stylesheet" href="./src/styles.css">',()=>`<style>${css}</style>`).replaceAll('./assets/leaf.svg',emblem).replace('<script type="module" src="./src/app.js"></script>',()=>`<script>${inline(boot)}</script>\n<script>${inline(phaser)}</script>\n<script>(()=>{\n${inline(script)}\n})();</script>\n<!-- Bundled Noto Sans Thai license:\n${license}\n-->`);
const phaserLicense=await readFile('node_modules/phaser/LICENSE.md','utf8');
html+=`\n<!-- Bundled Phaser 3.90.0 MIT license:\n${phaserLicense}\n-->`;
await writeFile('play.html',html);
console.log(`Exported play.html (${Math.round(Buffer.byteLength(html)/1024)} KiB), standalone with fonts and no network dependencies.`);
