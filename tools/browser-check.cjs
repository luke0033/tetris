const {spawn}=require('node:child_process');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const output=path.join(__dirname,'screenshots');fs.mkdirSync(output,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'block-club-check-'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 const target=path.join(root,name==='/'?'index.html':name);
 fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(target)]||'text/plain');res.end(data);});
});
let browser,socket;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(8190,'127.0.0.1',r));
 browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9224','--remote-allow-origins=*','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
 let tabs;
 for(let i=0;i<30;i++){try{tabs=await(await fetch('http://127.0.0.1:9224/json',{signal:AbortSignal.timeout(500)})).json();break;}catch{await sleep(200);}}
 assert(tabs,'Browser did not start');
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map(),errors=[];
 socket.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result);}}if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails);});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const key=async(code,keyValue=code)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',code,key:keyValue});await cdp('Input.dispatchKeyEvent',{type:'keyUp',code,key:keyValue});};
 const shot=async name=>{await sleep(100);const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(r.data,'base64'));};
 await cdp('Runtime.enable');await cdp('Page.enable');
 // Capture the engine instance in the test harness only, for deterministic clear scenarios.
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'BlockEngine',{configurable:true,set(api){const Base=api.Game;api.Game=class extends Base{constructor(...args){super(...args);window.__testGame=this;}};Object.defineProperty(window,'BlockEngine',{value:api,configurable:true});}});`});
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1040,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:'http://127.0.0.1:8190'});await sleep(400);
 assert.equal(await evaluate('document.getElementById("overlay-title").textContent'),'准备好了吗？');
 assert.equal(await evaluate('document.getElementById("pause-button").disabled'),true);
 assert.equal(await evaluate('document.querySelector(".left-rail .instructions")'),null);
 assert((await evaluate('document.getElementById("board").getBoundingClientRect().width'))>370,'Desktop board should be enlarged');
 assert((await evaluate('document.getElementById("board").getBoundingClientRect().bottom'))<1040,'Playfield floor stays within the desktop viewport');
 await evaluate('document.getElementById("help-button").click()');
 assert.equal(await evaluate('document.getElementById("help-dialog").open'),true);
 await key('Escape','Escape');assert.equal(await evaluate('document.getElementById("help-dialog").open'),false);
 await shot('desktop-ready');
 await evaluate('document.getElementById("start-button").click()');
 assert.equal(await evaluate('document.getElementById("overlay").hidden'),true);
 await evaluate('document.getElementById("help-button").click()');
 assert.equal(await evaluate('document.getElementById("overlay-title").textContent'),'歇一会儿。');
 await key('ArrowLeft','ArrowLeft');await evaluate('document.getElementById("help-close").click()');await sleep(40);
 assert.equal(await evaluate('document.getElementById("overlay").hidden'),true,'Closing handbook resumes previous active game');
 const before=await evaluate('document.getElementById("board").toDataURL()');
 await key('ArrowLeft','ArrowLeft');const after=await evaluate('document.getElementById("board").toDataURL()');
 await sleep(50);assert.notEqual(before,await evaluate('document.getElementById("board").toDataURL()'),'Keyboard movement should redraw piece');
 await key('Space',' ');await sleep(60);
 assert(Number(await evaluate('document.getElementById("score").textContent'))>0,'Hard drop should score');
 await key('KeyP','p');assert.equal(await evaluate('document.getElementById("overlay-title").textContent'),'歇一会儿。');
 const paused=await evaluate('document.getElementById("board").toDataURL()');await sleep(1000);
 assert.equal(await evaluate('document.getElementById("board").toDataURL()'),paused,'Paused board should remain unchanged');
 await key('Enter','Enter');assert.equal(await evaluate('document.getElementById("overlay").hidden'),true);
 await evaluate('document.getElementById("restart-button").click()');assert.equal(await evaluate('document.getElementById("overlay-title").textContent'),'重新开始吗？');
 await key('Escape','Escape');assert.equal(await evaluate('document.getElementById("overlay").hidden'),true);
 await evaluate('document.getElementById("restart-button").click();document.getElementById("start-button").click()');await sleep(40);
 assert.equal(await evaluate('document.getElementById("score").textContent'),'000000');
 // Play until game over, choosing each piece's destination deterministically.
 for(let i=0;i<7;i++){
  for(let j=0;j<3;j++)await key('ArrowLeft','ArrowLeft');await key('Space',' ');
 }
 await key('KeyP','p');await shot('desktop-playing');
 await key('KeyP','p');
 // Backgrounding and losing focus should pause immediately.
 await evaluate('window.dispatchEvent(new Event("blur"))');assert.equal(await evaluate('document.getElementById("overlay-title").textContent'),'歇一会儿。');
 await evaluate('document.getElementById("start-button").click()');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await sleep(100);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Mobile horizontal overflow');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".touch-panel")).display'), 'block');
 // Use real touch input (pointer capture, release, long press), not only synthetic clicks.
 await evaluate('document.getElementById("restart-button").click();document.getElementById("start-button").click()');
 const point=await evaluate('(()=>{const r=document.querySelector("[data-control=down]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:3,radiusY:3}]});await sleep(320);
 await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(70);
 const touchScore=await evaluate('Number(document.getElementById("score").textContent)');assert(touchScore>1,'Long press should repeat soft drop');
 await sleep(180);assert.equal(await evaluate('Number(document.getElementById("score").textContent)'),touchScore,'Touch release must stop soft drop');
 await evaluate('document.querySelector("[data-control=drop]").click()');await sleep(50);
 assert(Number(await evaluate('document.getElementById("score").textContent'))>touchScore,'Accessible touch button activation should work');
 await evaluate('document.getElementById("pause-button").click()');await shot('mobile-paused');
 await evaluate('document.getElementById("start-button").click()');await shot('mobile-playing');
 await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});await sleep(100);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'320px horizontal overflow');
 await cdp('Emulation.setDeviceMetricsOverride',{width:760,height:900,deviceScaleFactor:1,mobile:true});await sleep(100);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Tablet horizontal overflow');
 await evaluate('document.getElementById("restart-button").click();document.getElementById("start-button").click();document.getElementById("board").focus()');
 for(let i=0;i<80;i++){
  if(await evaluate('document.getElementById("overlay-title").textContent.includes("下一局")'))break;
  await key('Space',' ');
 }
 assert.equal(await evaluate('document.getElementById("overlay-title").textContent'),'下一局，更漂亮。');
 await sleep(60);const best=await evaluate('Number(document.getElementById("best").textContent)');assert(best>0);
 await cdp('Page.reload');await sleep(300);
 assert.equal(await evaluate('Number(document.getElementById("best").textContent)'),best,'High score persists');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1140,deviceScaleFactor:1,mobile:false});
 await evaluate(`(()=>{document.getElementById('start-button').click();const g=window.__testGame;g.board=Array.from({length:20},()=>Array(10).fill(null));for(let y=16;y<20;y++)g.board[y]=Array.from({length:10},(_,x)=>x===4?null:'J');g.board[15][0]='T';g.active={type:'I',x:2,y:0,rotation:1,matrix:BlockEngine.rotateMatrix(BlockEngine.SHAPES.I,1)};g.lines=9;})()`);
 await sleep(60);await key('Space',' ');await sleep(75);
 assert.equal(await evaluate('document.querySelector(".clear-feedback").hidden'),false);
 assert.equal(await evaluate('document.querySelector(".clear-feedback>span").textContent'),'FOUR LINES!');
 assert.equal(await evaluate('document.querySelector(".clear-feedback>small").textContent'),'+800');
 assert.equal(await evaluate('document.getElementById("level").textContent'),'02');
 const clearSerial=await evaluate('window.__testGame.serial');await key('Space',' ');
 assert.equal(await evaluate('window.__testGame.serial'),clearSerial,'Input is gated during row collapse');
 await shot('four-line-clear');
 await key('KeyP','p');const frozen=await evaluate('document.getElementById("board").toDataURL()');await sleep(450);
 assert.equal(await evaluate('document.getElementById("board").toDataURL()'),frozen,'Pause freezes clear animation');
 await key('KeyP','p');await sleep(550);
 assert.equal(await evaluate('window.__testGame.board[19][0]'),'T','Surviving cells land at the correct row');
 assert.equal(await evaluate('window.__testGame.board.flat().filter(Boolean).length'),1);
 await sleep(800);assert.equal(await evaluate('document.querySelector(".clear-feedback").hidden'),true);
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await evaluate(`(()=>{document.getElementById('restart-button').click();document.getElementById('start-button').click();const g=window.__testGame;g.board[19]=Array.from({length:10},(_,x)=>x===4||x===5?null:'L');g.active={type:'O',x:4,y:18,rotation:0,matrix:[[1,1],[1,1]]};})()`);
 await key('Space',' ');await sleep(180);
 assert.equal(await evaluate('window.__testGame.lines'),1,'Reduced motion clear works');
 assert.equal(await evaluate('document.querySelector(".machine").style.transform'),'','Reduced motion avoids shake');
 // Files also work without a local server.
 await cdp('Page.navigate',{url:require('node:url').pathToFileURL(path.join(root,'index.html')).href});await sleep(300);
 await evaluate('document.getElementById("start-button").click()');assert.equal(await evaluate('document.getElementById("overlay").hidden'),true);
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('PASS: keyboard and touch, pause/restart, handbook open/close/resume, larger board within viewport, mobile layout, four-line feedback and collapse, pause freezes effects, reduced motion, high score persistence, offline opening, no JS errors.');
 await cdp('Browser.close');socket.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.close();if(socket)socket.close();if(browser)browser.kill();});
