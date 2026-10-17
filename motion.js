(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BlockMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=value=>Math.max(0,Math.min(1,value));
  const ease=value=>1-Math.pow(1-clamp(value),3);
  class Pose {
    constructor(){this.serial=-1;}
    reset(piece,serial){this.serial=serial;this.x=piece.x;this.y=piece.y;this.angle=piece.rotation*90;this.rotation=piece.rotation;this.turn=null;}
    update(piece,serial,fall,dt,time,reduced=false){
      if(this.serial!==serial)this.reset(piece,serial);
      if(piece.rotation!==this.rotation){
        const delta=(piece.rotation-this.rotation+4)%4;
        this.turn={from:this.angle,to:(this.turn?this.turn.to:Math.round(this.angle/90)*90)+(delta===3?-90:delta*90),start:time};
        this.rotation=piece.rotation;
      }
      const targetY=piece.y+fall;
      this.x+=(piece.x-this.x)*(reduced?1:1-Math.exp(-dt/23));
      this.y+=(targetY-this.y)*(reduced?1:1-Math.exp(-dt/25));
      if(Math.abs(piece.x-this.x)<.001)this.x=piece.x;
      if(Math.abs(targetY-this.y)<.001)this.y=targetY;
      if(this.turn){const t=reduced?1:clamp((time-this.turn.start)/105);this.angle=this.turn.from+(this.turn.to-this.turn.from)*ease(t);if(t===1)this.turn=null;}
      return this;
    }
  }
  function collapseOffset(rows,y){return rows.filter(row=>row>y).length;}
  return {Pose,clamp,ease,collapseOffset};
});
