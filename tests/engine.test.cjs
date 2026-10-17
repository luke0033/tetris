const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,SHAPES,rotateMatrix}=require('../engine.js');
function rng(seed=123456){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function piece(type,x,y,rotation=0){let matrix=SHAPES[type].map(r=>r.slice());for(let i=0;i<rotation;i++)matrix=rotateMatrix(matrix,1);return {type,x,y,matrix,rotation};}
test('every group of seven generated pieces contains all seven shapes',()=>{
  const g=new Game(rng());const received=[g.active.type];
  for(let i=1;i<70;i++){g.spawn();received.push(g.active.type);}
  for(let i=0;i<70;i+=7)assert.equal(new Set(received.slice(i,i+7)).size,7);
});
test('wall, floor and locked blocks prevent movement',()=>{
  const g=new Game(rng());g.active=piece('O',0,18);
  assert.equal(g.move(-1),false);assert.equal(g.down(),false);
  g.active.x=8;assert.equal(g.move(1),false);
  g.active=piece('O',3,0);g.board[1][5]='Z';assert.equal(g.move(1),false);
});
test('four rotations and inverse rotations preserve shape and position',()=>{
  for(const type of ['I','T','J','L','S','Z']){
    const g=new Game(rng());g.active=piece(type,3,5);const before=JSON.stringify(g.active);
    for(let i=0;i<4;i++)assert(g.rotate(1));assert.equal(JSON.stringify(g.active),before);
    assert(g.rotate(-1));assert(g.rotate(1));assert.equal(JSON.stringify(g.active),before);
  }
});
test('SRS kicks let a T rotate from the floor without penetrating it',()=>{
  const g=new Game(rng());g.active=piece('T',3,18);
  assert(g.grounded);assert(g.rotate());assert.equal(g.active.rotation,1);
  assert.equal(g.collides(),false);assert.equal(g.active.y,17);
});
test('I piece kicks away from the left wall and O does not drift',()=>{
  const g=new Game(rng());g.active=piece('I',-2,5,1);
  assert.equal(g.collides(),false);assert(g.rotate());assert.equal(g.active.x,0);assert.equal(g.collides(),false);
  g.active=piece('O',4,5);const before=JSON.stringify(g.active);g.rotate();assert.equal(JSON.stringify(g.active),before);
});
test('a blocked rotation cannot modify a piece',()=>{
  const g=new Game(rng());g.board=g.board.map(row=>row.map(()=> 'J'));g.active=piece('T',3,6);
  g.active.matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell)g.board[y+6][x+3]=null;}));
  const before=JSON.stringify(g.active);assert.equal(g.rotate(),false);assert.equal(JSON.stringify(g.active),before);
});
test('hard drop lands above the stack, scores distance and immediately locks',()=>{
  const g=new Game(rng());g.active=piece('O',4,0);g.board[19][4]='J';
  assert.equal(g.ghostY(),17);const serial=g.serial;g.hardDrop();
  assert.equal(g.score,34);assert.equal(g.board[17][4],'O');assert.equal(g.board[18][5],'O');assert.equal(g.board[19][4],'J');assert.equal(g.serial,serial+1);
});
test('clearing four rows preserves other blocks and scores at the previous level',()=>{
  const g=new Game(rng());
  for(let y=16;y<20;y++)g.board[y]=Array.from({length:10},(_,x)=>x===4?null:'J');
  g.board[15][0]='T';g.active=piece('I',2,16,1);g.lines=9;g.lock();
  assert.equal(g.lastClear,4);assert.equal(g.lines,13);assert.equal(g.level,2);assert.equal(g.score,800);
  assert.equal(g.board[19][0],'T');assert.equal(g.board.flat().filter(Boolean).length,1);
  assert.deepEqual(g.lastLock.rows,[16,17,18,19]);assert.equal(g.lastLock.points,800);
  assert.equal(g.lastLock.levelUp,true);assert.equal(g.lastLock.boardBefore[16][4],'I');
  assert.equal(g.lastLock.piece.y,16);assert.equal(g.lastLock.id,1);
  g.board[19][0]='Z';assert.equal(g.lastLock.boardBefore[15][0],'T');
});
test('clearing a single row shifts the pile correctly',()=>{
  const g=new Game(rng());g.board[19]=Array.from({length:10},(_,x)=>x>=4&&x<=5?null:'L');
  g.active=piece('O',4,18);g.lock();assert.equal(g.lastClear,1);assert.equal(g.score,100);
  assert.equal(g.board[19][4],'O');assert.equal(g.board[19][5],'O');assert.equal(g.board[0].every(c=>!c),true);
});
test('gravity and lock delay are time based and floor resets are bounded',()=>{
  const g=new Game(rng());g.active=piece('O',4,0);g.tick(849);assert.equal(g.active.y,0);g.tick(1);assert.equal(g.active.y,1);
  g.active=piece('O',4,18);g.gravityClock=0;const serial=g.serial;g.tick(300);assert.equal(g.serial,serial);
  assert(g.move(1));assert.equal(g.lockClock,0);g.tick(300);assert.equal(g.serial,serial);
  g.lockResets=15;assert(g.move(-1));assert.equal(g.lockClock,300);g.tick(200);assert.equal(g.serial,serial+1);
});
test('soft drop only scores on a successful downward move',()=>{
  const g=new Game(rng());g.active=piece('O',4,17);assert(g.down(true));assert.equal(g.score,1);assert.equal(g.down(true),false);assert.equal(g.score,1);
});
test('spawn collision and blocks above the top end the game; reset clears it',()=>{
  const g=new Game(rng());g.queue[0]='O';g.board[0][4]='Z';g.spawn();assert.equal(g.over,true);
  g.reset();assert.equal(g.over,false);assert.equal(g.score,0);assert.equal(g.lines,0);assert.equal(g.board.flat().some(Boolean),false);
  g.active=piece('O',4,-1);g.lock();assert.equal(g.over,true);
});
