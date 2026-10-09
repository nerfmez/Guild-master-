import {readFile,writeFile} from 'node:fs/promises';
const modules={'content.js':'Content','game.js':'Engine','render.js':'Artwork'};
function replaceImports(source){return source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?/g,(_,names,file)=>`const {${names}}=${modules[file]};`);}
let script='';
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
html=html.replace('<link rel="stylesheet" href="./src/styles.css">',`<style>${css}</style>`).replaceAll('./assets/leaf.svg',emblem).replace('<script type="module" src="./src/app.js"></script>',`<script type="module">${script.replaceAll('</script>','<\\/script>')}</script>\n<!-- Bundled Noto Sans Thai license:\n${license}\n-->`);
await writeFile('play.html',html);
console.log(`Exported play.html (${Math.round(Buffer.byteLength(html)/1024)} KiB), standalone with fonts and no network dependencies.`);
