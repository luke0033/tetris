const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{
  try{
    let route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(route==='/')route='/index.html';
    const target=path.resolve(root,'.'+route);
    if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    fs.readFile(target,(error,body)=>{
      if(error){res.writeHead(404);res.end('Not found');return;}
      res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(body);
    });
  }catch{res.writeHead(400);res.end('Bad request');}
}).listen(8188,'0.0.0.0',()=>console.log('Block Club: http://localhost:8188 (LAN: http://<computer-IP>:8188)'));
