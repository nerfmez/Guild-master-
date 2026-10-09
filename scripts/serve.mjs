import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv.includes('--dist')?'dist':'.');
const port=Number(process.env.PORT||5173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}if((await stat(file)).isDirectory())file=path.join(file,'index.html');const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);}catch{res.writeHead(404).end('Not found');}}).listen(port,'0.0.0.0',()=>console.log(`Little Leaf Guild: http://localhost:${port}`));
