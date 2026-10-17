(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const {Game,SHAPES,WIDTH,HEIGHT}=BlockEngine;
  const game=new Game();
  const canvas=$('board'),ctx=canvas.getContext('2d'),nextCtx=$('next').getContext('2d');
  const colors={I:'#80bec0',O:'#eac56b',T:'#aa8ebd',J:'#7b9fca',L:'#e89c69',S:'#a2b883',Z:'#df8277'};
  const storageKey='block-club-best-v1';
  let state='ready',best=0,lastTime=0,dirty=true,nextType='',restartPrevious='paused';
  let pointerTimer=null,pointerRepeat=null,heldPointer=null,pointerButton=null;
  const held=new Map();
  const {Pose,clamp,ease,collapseOffset}=BlockMotion;
  const pose=new Pose(), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visualTime=0,clearEffect=null,celebration=null,dropEffect=null,lockEffect=null,seenLock=0,lastPoseTime=0;
  const feedback=document.createElement('div');feedback.className='clear-feedback';feedback.hidden=true;feedback.setAttribute('aria-hidden','true');
  feedback.innerHTML='<span></span><strong></strong><small></small>';document.querySelector('.board-wrap').append(feedback);
  const clearDuration=()=>reduced.matches?120:420;
  const clearing=()=>clearEffect&&visualTime-clearEffect.start<clearDuration();
  try{best=Number(localStorage.getItem(storageKey))||0;}catch{/* The game works when storage is unavailable. */}
  canvas.tabIndex=0;
  function block(context,x,y,size,type,ghost=false) {
    if(ghost){context.strokeStyle=colors[type]+'65';context.lineWidth=1;context.strokeRect(x+2.5,y+2.5,size-5,size-5);return;}
    context.fillStyle='#12191a';context.fillRect(x,y,size,size);
    context.fillStyle=colors[type];context.fillRect(x+1,y+1,size-2,size-2);
    context.fillStyle='#ffffff45';context.fillRect(x+2,y+2,size-4,3);context.fillRect(x+2,y+2,3,size-4);
    context.fillStyle='#00000028';context.fillRect(x+3,y+size-5,size-5,3);context.fillRect(x+size-5,y+3,3,size-5);
    context.strokeStyle='#ffffff20';context.lineWidth=1;context.strokeRect(x+6.5,y+6.5,size-13,size-13);
  }
  function drawPiece(p,y,ghost=false){p.matrix.forEach((row,cy)=>row.forEach((cell,cx)=>{if(cell&&y+cy>=0)block(ctx,(p.x+cx)*30,(y+cy)*30,30,p.type,ghost);}));}
  function drawActive(dt){
    const p=game.active;
    // Advance visually through a gravity interval; collision always uses engine cells.
    const fall=reduced.matches||state==='over'||game.grounded?0:Math.min(1,game.gravityClock/game.interval);
    pose.update(p,game.serial,fall,dt,visualTime,reduced.matches);
    if(game.over){drawPiece(p,p.y);return;}
    drawPiece(p,game.ghostY(),true);
    const n=SHAPES[p.type].length;
    ctx.save();ctx.translate((pose.x+n/2)*30,(Math.min(pose.y,p.y+fall)+n/2)*30);ctx.rotate(pose.angle*Math.PI/180);
    SHAPES[p.type].forEach((row,y)=>row.forEach((cell,x)=>{if(cell)block(ctx,(x-n/2)*30,(y-n/2)*30,30,p.type);}));ctx.restore();
  }
  function drawClearing(){
    const fx=clearEffect,t=visualTime-fx.start;
    const progress=ease((t-145)/275);
    fx.boardBefore.forEach((row,y)=>row.forEach((type,x)=>{
      if(!type)return;
      if(fx.rows.includes(y)){
        if(t>145)return;
        block(ctx,x*30,y*30,30,type);
        ctx.fillStyle=`rgba(255,245,207,${.2+.75*Math.sin(clamp(t/145)*Math.PI)})`;ctx.fillRect(x*30,y*30,30,30);
      }else block(ctx,x*30,(y+collapseOffset(fx.rows,y)*progress)*30,30,type);
    }));
    if(!reduced.matches){
      for(const row of fx.rows){
        const sweep=clamp(t/180)*340-20;
        const gradient=ctx.createLinearGradient(sweep-45,0,sweep+30,0);gradient.addColorStop(0,'#ffe4a000');gradient.addColorStop(.65,'#fff8e8');gradient.addColorStop(1,'#ffe4a000');
        ctx.fillStyle=gradient;ctx.fillRect(0,row*30,300,30);
      }
    }
  }
  function drawEffects(){
    if(dropEffect){
      const t=(visualTime-dropEffect.start)/145;
      if(t>=1)dropEffect=null;
      else if(!reduced.matches){
        ctx.save();ctx.globalAlpha=(1-t)*.4;
        dropEffect.piece.matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell){
          const bottom=(dropEffect.endY+y+1)*30,top=(dropEffect.piece.y+y)*30;
          const gradient=ctx.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,colors[dropEffect.piece.type]+'00');gradient.addColorStop(1,colors[dropEffect.piece.type]);
          ctx.fillStyle=gradient;ctx.fillRect((dropEffect.piece.x+x)*30+4,top,22,bottom-top);
        }}));ctx.restore();
      }
    }
    if(lockEffect){
      const t=(visualTime-lockEffect.start)/170;
      if(t>=1)lockEffect=null;
      else{ctx.save();ctx.globalAlpha=(1-t)*.55;ctx.fillStyle='#fff3c8';lockEffect.piece.matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell)ctx.fillRect((lockEffect.piece.x+x)*30+1,(lockEffect.piece.y+y)*30+1,28,28);}));ctx.restore();}
    }
    if(!celebration)return;
    const t=visualTime-celebration.start;
    if(t>1150){celebration=null;feedback.hidden=true;document.querySelector('.score-card').classList.remove('celebrating');document.querySelector('.machine').style.transform='';return;}
    if(!reduced.matches){
      const p=t/1000;
      ctx.save();ctx.globalAlpha=clamp(1-t/900);
      for(const particle of celebration.particles){
        const px=particle.x+particle.vx*p,py=particle.y+particle.vy*p+180*p*p;
        ctx.fillStyle=particle.color;ctx.fillRect(px,py,particle.size,particle.size);
      }ctx.restore();
      const shake=t<220?Math.sin(t*.105)*(1-t/220)*(celebration.rows===4?4:2):0;
      document.querySelector('.machine').style.transform=`translateY(${shake}px)`;
      feedback.style.transform=`translateY(${-8*ease(t/350)-12*clamp((t-760)/390)}px) scale(${.88+.12*ease(t/180)})`;
    }
    feedback.style.opacity=String(t<850?1:clamp((1150-t)/300));
  }
  function draw() {
    ctx.fillStyle='#192123';ctx.fillRect(0,0,300,600);
    ctx.strokeStyle='#242d2d';ctx.lineWidth=.6;
    for(let x=0;x<=WIDTH;x++){ctx.beginPath();ctx.moveTo(x*30,0);ctx.lineTo(x*30,600);ctx.stroke();}
    for(let y=0;y<=HEIGHT;y++){ctx.beginPath();ctx.moveTo(0,y*30);ctx.lineTo(300,y*30);ctx.stroke();}
    if(clearing())drawClearing();
    else{
      clearEffect=null;
      game.board.forEach((row,y)=>row.forEach((type,x)=>{if(type)block(ctx,x*30,y*30,30,type);}));
      if(state!=='ready')drawActive(Math.max(0,visualTime-lastPoseTime));
    }
    drawEffects();lastPoseTime=visualTime;
    if(nextType!==game.queue[0] || state==='ready') {
      nextType=game.queue[0];nextCtx.clearRect(0,0,180,90);
      if(state!=='ready') {
        const matrix=SHAPES[nextType], cells=[];
        matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell)cells.push([x,y]);}));
        const minX=Math.min(...cells.map(c=>c[0])),maxX=Math.max(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1])),maxY=Math.max(...cells.map(c=>c[1]));
        const size=26,ox=(180-(maxX-minX+1)*size)/2,oy=(90-(maxY-minY+1)*size)/2;
        cells.forEach(([x,y])=>block(nextCtx,ox+(x-minX)*size,oy+(y-minY)*size,size,nextType));
        $('next').setAttribute('aria-label',`下一块：${nextType} 形方块`);
      }
    }
    $('score').textContent=String(game.score).padStart(6,'0');
    $('best').textContent=String(best).padStart(6,'0');
    $('level').textContent=String(game.level).padStart(2,'0');
    $('lines').textContent=String(game.lines).padStart(2,'0');
    $('progress-text').textContent=`${game.lines%10} / 10`;
    $('progress-fill').style.width=`${game.lines%10*10}%`;
    dirty=false;
  }
  function saveBest(){if(game.score>best){best=game.score;try{localStorage.setItem(storageKey,String(best));}catch{}}}
  function showOverlay(tag,title,description,button,hint){
    $('overlay-tag').textContent=tag;$('overlay-title').textContent=title;$('overlay-description').textContent=description;
    $('start-button').replaceChildren(document.createTextNode(button+' '));
    const arrow=document.createElement('span');arrow.textContent='↗';$('start-button').append(arrow);
    $('overlay-hint').textContent=hint;$('overlay').hidden=false;
  }
  function refreshState(){
    const playing=state==='playing';
    $('pause-button').disabled=!['playing','paused'].includes(state);
    $('restart-button').disabled=state==='ready'||state==='confirm';
    $('pause-text').textContent=state==='paused'?'继续出发':'暂停一下';
    $('pause-icon').textContent=state==='paused'?'▶':'Ⅱ';
    $('pause-button').setAttribute('aria-label',state==='paused'?'继续游戏':'暂停游戏');
    $('machine-status').textContent=({ready:'READY PLAYER ONE',playing:'GOOD LUCK. HAVE FUN.',paused:'TAKE A LITTLE BREAK',over:'ONE MORE ROUND?',confirm:'START FRESH?'})[state];
    document.querySelectorAll('[data-control]').forEach(b=>b.disabled=!playing);
    if(playing)$('overlay').hidden=true;
    else if(state==='paused')showOverlay('TAKE A BREAK','歇一会儿。','方块等你，不着急。','继续游戏','点击继续 / 按 P 或 Enter 键');
    else if(state==='over')showOverlay('NICE TRY, PLAYER','下一局，更漂亮。',`本局得分 ${game.score} · 消除 ${game.lines} 行`,'再来一局','点击开始 / 按 Enter 键');
    else if(state==='confirm')showOverlay('A FRESH START?','重新开始吗？','本局进度将清空，最高分会保留。','确认重新开始','按 Esc 取消，回到刚才的游戏');
    dirty=true;
  }
  function releasePointer(){clearTimeout(pointerTimer);clearInterval(pointerRepeat);pointerTimer=pointerRepeat=null;heldPointer=null;if(pointerButton)pointerButton.classList.remove('active');pointerButton=null;}
  function releaseInputs(){held.clear();releasePointer();}
  function start(){releaseInputs();game.reset();nextType='';seenLock=0;visualTime=0;lastPoseTime=0;pose.serial=-1;clearEffect=celebration=dropEffect=lockEffect=null;feedback.hidden=true;document.querySelector('.score-card').classList.remove('celebrating');document.querySelector('.machine').style.transform='';state='playing';lastTime=performance.now();refreshState();canvas.focus({preventScroll:true});$('announcement').textContent='游戏开始';}
  function pause(){if(state!=='playing')return;state='paused';releaseInputs();refreshState();saveBest();}
  function resume(){if(state!=='paused')return;state='playing';lastTime=performance.now();refreshState();canvas.focus({preventScroll:true});}
  function togglePause(){if(state==='playing')pause();else if(state==='paused')resume();}
  function checkGame(){
    if(game.lastLock&&game.lastLock.id!==seenLock){
      const event=game.lastLock;seenLock=event.id;
      lockEffect={piece:event.piece,start:visualTime};
      if(event.rows.length){
        clearEffect={...event,start:visualTime};lockEffect=null;dropEffect=null;
        releaseInputs();
        const count=event.rows.length,particles=[];
        event.rows.forEach(row=>{for(let i=0;i<24;i++){
          const seed=(i*137.5+row*43)%360,angle=seed/180*Math.PI;
          particles.push({x:(i+.5)/24*300,y:row*30+15,vx:Math.cos(angle)*(45+i%5*22),vy:-60-Math.abs(Math.sin(angle))*180,size:2+i%3,color:i%3===0?'#fff1bf':colors[event.boardBefore[row][Math.floor((i+.5)/24*10)]]});
        }});
        celebration={start:visualTime,rows:count,particles};
        feedback.hidden=false;feedback.classList.toggle('is-four',count===4);
        feedback.children[0].textContent=['','NICE!','DOUBLE!','TRIPLE!','FOUR LINES!'][count];
        feedback.children[1].textContent=event.levelUp?'升级！继续漂亮地消除':count===4?'四行全消 · 漂亮！':`一次消除 ${count} 行`;
        feedback.children[2].textContent=`+${event.points}`;
        document.querySelector('.score-card').classList.add('celebrating');
        $('announcement').textContent=`消除 ${count} 行，增加 ${event.points} 分${event.levelUp?'，升级到 '+game.level+' 级':''}`;
      }
    }
    saveBest();dirty=true;
    if(game.over){state='over';releaseInputs();refreshState();$('announcement').textContent=`游戏结束，得分 ${game.score}`;}
  }
  function action(control){
    if(state!=='playing'||clearing())return;
    const serial=game.serial;
    if(control==='left')game.move(-1);else if(control==='right')game.move(1);else if(control==='rotate')game.rotate(1);else if(control==='counter')game.rotate(-1);else if(control==='down')game.down(true);else if(control==='drop'){
      dropEffect={piece:{...game.active,matrix:game.active.matrix.map(r=>r.slice())},endY:game.ghostY(),start:visualTime};game.hardDrop();
    }
    if(game.serial!==serial&&game.lastClear)$('announcement').textContent=`消除 ${game.lastClear} 行，当前得分 ${game.score}`;
    checkGame();
  }
  $('start-button').addEventListener('click',()=>{if(state==='paused')resume();else start();});
  $('pause-button').addEventListener('click',togglePause);
  $('restart-button').addEventListener('click',()=>{
    if(state==='over'){start();return;}
    restartPrevious=state;state='confirm';releaseInputs();refreshState();$('start-button').focus({preventScroll:true});
  });
  const keyMap={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'counter',Space:'drop'};
  document.addEventListener('keydown',event=>{
    const code=event.code;
    if($('help-dialog').open){if(code==='Escape'){event.preventDefault();$('help-dialog').close();}return;}
    if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable]'))return;
    if((code==='Enter'||code==='Space')&&event.target.closest('button,a'))return;
    if(keyMap[code])event.preventDefault();
    if(code==='Escape'&&state==='confirm'){
      event.preventDefault();state=restartPrevious;lastTime=performance.now();refreshState();canvas.focus({preventScroll:true});return;
    }
    if(code==='KeyP'||code==='Escape'){event.preventDefault();if(!event.repeat)togglePause();return;}
    if(code==='Enter'){
      event.preventDefault();if(event.repeat)return;
      if(state==='paused')resume();else if(state!=='playing')start();return;
    }
    if(state!=='playing'||event.repeat||!keyMap[code])return;
    const control=keyMap[code];action(control);
    if(['left','right','down'].includes(control)){
      // The most recently pressed horizontal direction wins.
      if(control==='left'||control==='right'){held.delete('ArrowLeft');held.delete('ArrowRight');}
      held.set(code,{control,next:performance.now()+(control==='down'?35:160)});
    }
  });
  document.addEventListener('keyup',event=>held.delete(event.code));
  document.querySelectorAll('[data-control]').forEach(button=>{
    button.addEventListener('contextmenu',event=>event.preventDefault());
    button.addEventListener('pointerdown',event=>{
      if(state!=='playing'||heldPointer!==null)return;
      event.preventDefault();releasePointer();heldPointer=event.pointerId;pointerButton=button;button.classList.add('active');button.setPointerCapture(event.pointerId);
      const control=button.dataset.control;action(control);
      if(['left','right','down'].includes(control)&&state==='playing'&&!clearing())pointerTimer=setTimeout(()=>{
        action(control);pointerRepeat=setInterval(()=>action(control),control==='down'?35:65);
      },control==='down'?80:160);
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,event=>{if(event.pointerId===heldPointer)releasePointer();}));
    // Keyboard/assistive activation has no pointerdown event.
    button.addEventListener('click',event=>{if(event.detail===0)action(button.dataset.control);});
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('blur',()=>{releaseInputs();pause();});
  let helpResume=false;
  $('help-button').addEventListener('click',()=>{helpResume=state==='playing';pause();releaseInputs();$('help-dialog').showModal();});
  $('help-close').addEventListener('click',()=>$('help-dialog').close());
  $('help-dialog').addEventListener('click',event=>{if(event.target===$('help-dialog')){const r=$('help-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('help-dialog').close();}});
  $('help-dialog').addEventListener('close',()=>{if(helpResume&&!document.hidden&&document.hasFocus())resume();helpResume=false;});
  function frame(now){
    const dt=Math.min(100,now-lastTime);lastTime=now;
    if(state==='playing'){
      visualTime+=dt;
      for(const entry of held.values())if(now>=entry.next){action(entry.control);entry.next=now+(entry.control==='down'?35:65);}
      if(state==='playing'&&!clearing()){game.tick(dt);checkGame();}
      dirty=true;
    }
    if(dirty)draw();requestAnimationFrame(frame);
  }
  refreshState();draw();requestAnimationFrame(frame);
})();
