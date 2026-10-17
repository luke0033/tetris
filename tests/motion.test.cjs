const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pose,collapseOffset}=require('../motion.js');
test('movement and gravity interpolate between cells and converge',()=>{
  const p={x:3,y:1,rotation:0},pose=new Pose();pose.reset(p,1);
  p.x=4;pose.update(p,1,.5,16,16);
  assert(pose.x>3&&pose.x<4);assert(pose.y>1&&pose.y<1.5);
  for(let i=2;i<30;i++)pose.update(p,1,.5,16,i*16);
  assert(Math.abs(pose.x-4)<.001);assert(Math.abs(pose.y-1.5)<.001);
});
test('rotation crosses the 3-to-0 boundary in the correct short direction',()=>{
  const p={x:3,y:3,rotation:3},pose=new Pose();pose.reset(p,1);
  p.rotation=0;pose.update(p,1,0,16,0);pose.update(p,1,0,16,52);
  assert(pose.angle>270&&pose.angle<360);
  pose.update(p,1,0,80,120);assert.equal(pose.angle,360);
  p.rotation=3;pose.update(p,1,0,16,130);pose.update(p,1,0,120,250);assert.equal(pose.angle,270);
});
test('new pieces reset interpolation rather than flying from the old position',()=>{
  const pose=new Pose();pose.reset({x:0,y:18,rotation:2},1);
  pose.update({x:3,y:0,rotation:0},2,0,16,10);
  assert.equal(pose.x,3);assert.equal(pose.y,0);assert.equal(pose.angle,0);
});
test('collapse only counts cleared rows below a surviving row',()=>{
  assert.equal(collapseOffset([16,18,19],15),3);
  assert.equal(collapseOffset([16,18,19],17),2);
  assert.equal(collapseOffset([17],19),0);
});
test('reduced motion snaps to the current valid cell and rotation',()=>{
  const pose=new Pose(),p={x:0,y:0,rotation:0};pose.reset(p,1);
  p.x=4;p.y=2;p.rotation=1;pose.update(p,1,.3,16,10,true);
  assert.equal(pose.x,4);assert.equal(pose.y,2.3);assert.equal(pose.angle,90);
});
