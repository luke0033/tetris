(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH = 10, HEIGHT = 20;
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
  };
  // SRS offsets use screen coordinates (positive Y points down).
  const JLSTZ = {
    '0>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '1>0':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '1>2':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '2>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '2>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '3>2':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '3>0':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '0>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]]
  };
  const IKICKS = {
    '0>1':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '1>0':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '1>2':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    '2>1':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '2>3':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '3>2':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '3>0':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '0>3':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
  };
  const clone = matrix => matrix.map(row => row.slice());
  function rotateMatrix(matrix, direction) {
    const n = matrix.length;
    return Array.from({length:n}, (_, y) => Array.from({length:n}, (_, x) => direction === 1 ? matrix[n-1-x][y] : matrix[x][n-1-y]));
  }
  class Game {
    constructor(random = Math.random) { this.random = random; this.reset(); }
    reset() {
      this.board = Array.from({length:HEIGHT}, () => Array(WIDTH).fill(null));
      this.score = 0; this.lines = 0; this.level = 1; this.over = false;
      this.bag = []; this.queue = []; this.active = null;
      this.lastClear = 0; this.serial = 0; this.lastLock = null; this.lockId = 0;
      this.refill(); this.spawn();
    }
    refill() {
      while (this.queue.length < 5) {
        if (!this.bag.length) {
          this.bag = Object.keys(SHAPES);
          for (let i=this.bag.length-1;i>0;i--) {
            const j=Math.floor(this.random()*(i+1));
            [this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];
          }
        }
        this.queue.push(this.bag.pop());
      }
    }
    spawn() {
      const type = this.queue.shift(); this.refill();
      const matrix = clone(SHAPES[type]);
      this.active = {type,matrix,x:Math.floor((WIDTH-matrix.length)/2),y:type==='I'?-1:0,rotation:0};
      this.gravityClock=0; this.lockClock=0; this.lockResets=0; this.serial++;
      if (this.collides()) this.over=true;
    }
    collides(piece=this.active, dx=0, dy=0, matrix=piece.matrix) {
      for(let y=0;y<matrix.length;y++) for(let x=0;x<matrix[y].length;x++) {
        if (!matrix[y][x]) continue;
        const bx=piece.x+x+dx, by=piece.y+y+dy;
        if (bx<0 || bx>=WIDTH || by>=HEIGHT || (by>=0 && this.board[by][bx])) return true;
      }
      return false;
    }
    get grounded() { return this.collides(this.active,0,1); }
    get interval() { return Math.max(65, 850*Math.pow(.8,this.level-1)); }
    resetLock(wasGrounded) {
      if(wasGrounded && this.lockResets<15) {this.lockClock=0;this.lockResets++;}
    }
    move(dx) {
      if(this.over || this.collides(this.active,dx,0)) return false;
      const grounded=this.grounded;
      this.active.x+=dx; this.resetLock(grounded); return true;
    }
    rotate(direction=1) {
      if(this.over || this.active.type==='O') return false;
      const p=this.active, target=(p.rotation+direction+4)%4;
      const matrix=rotateMatrix(p.matrix,direction), grounded=this.grounded;
      const kicks=(p.type==='I'?IKICKS:JLSTZ)[`${p.rotation}>${target}`];
      for(const [dx,dy] of kicks) if(!this.collides(p,dx,dy,matrix)) {
        p.x+=dx;p.y+=dy;p.matrix=matrix;p.rotation=target;this.resetLock(grounded);return true;
      }
      return false;
    }
    down(manual=false) {
      if(this.over || this.collides(this.active,0,1)) return false;
      this.active.y++; this.lockClock=0;
      if(manual) {this.score++;this.gravityClock=0;}
      return true;
    }
    ghostY() { let offset=0;while(!this.collides(this.active,0,offset+1))offset++;return this.active.y+offset; }
    hardDrop() {
      if(this.over)return;
      const y=this.ghostY();this.score+=(y-this.active.y)*2;this.active.y=y;this.lock();
    }
    lock() {
      if(this.over)return;
      const p=this.active;
      let above=false;
      p.matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell){const by=p.y+y;if(by<0)above=true;else this.board[by][p.x+x]=p.type;}}));
      if(above){this.over=true;return;}
      const rows=[];
      this.board.forEach((row,y)=>{if(row.every(Boolean))rows.push(y);});
      const boardBefore=clone(this.board), levelBefore=this.level;
      const kept=this.board.filter(row=>row.some(cell=>!cell));
      const cleared=HEIGHT-kept.length;
      while(kept.length<HEIGHT)kept.unshift(Array(WIDTH).fill(null));
      this.board=kept;this.lastClear=cleared;
      this.score+=[0,100,300,500,800][cleared]*this.level;
      this.lines+=cleared;this.level=1+Math.floor(this.lines/10);
      // Presentation consumes this immutable event; gameplay still commits atomically.
      this.lastLock={id:++this.lockId,piece:{...p,matrix:clone(p.matrix)},rows,boardBefore,
        points:[0,100,300,500,800][cleared]*levelBefore,levelUp:this.level>levelBefore};
      this.spawn();
    }
    tick(ms) {
      if(this.over)return;
      this.gravityClock+=ms;
      while(this.gravityClock>=this.interval) {this.gravityClock-=this.interval;if(!this.down())break;}
      if(this.grounded){this.lockClock+=ms;if(this.lockClock>=500)this.lock();}
      else this.lockClock=0;
    }
  }
  return {Game,SHAPES,WIDTH,HEIGHT,rotateMatrix};
});
