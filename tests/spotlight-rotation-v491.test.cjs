/* v4.9.1 — spotlight follows targets even after slow landscape/portrait relayout.
   Run: node tests/spotlight-rotation-v491.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/tutorial-spotlight.js'),'utf8');
class Node{
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.attrs={};this.style={};this.className='';
    this.isConnected=true;this.hidden=false;this.scrollCalls=0;this.scrollTop=0;
    this.classList={contains:key=>this.className.split(' ').includes(key)};
  }
  appendChild(el){this.children.push(el);return el}
  setAttribute(key,value){this.attrs[key]=String(value)}
  getAttribute(key){return this.attrs[key]}
  closest(selector){
    if(selector==='[hidden]')return this.hidden?this:null;
    if(selector==='.drawer-body')return this.drawer||null;
    return null;
  }
  getBoundingClientRect(){return this.rect||{left:0,top:0,right:200,bottom:90,width:200,height:90}}
  scrollIntoView(){this.scrollCalls++}
}
const body=new Node('body'),modal=new Node(),viewport={clientWidth:844,clientHeight:390};
const document={
  body,documentElement:viewport,
  createElement:tag=>new Node(tag),
  createElementNS:(_,tag)=>new Node(tag),
  getElementById:id=>id==='modalBackdrop'?modal:null
};
const listeners={};
const window={
  innerWidth:844,innerHeight:390,
  addEventListener:(type,fn)=>{listeners[type]=fn},
  visualViewport:{addEventListener:(type,fn)=>{listeners['visual-'+type]=fn}}
};
const frames=new Map();let next=0;
const requestAnimationFrame=fn=>{const id=++next;frames.set(id,fn);return id};
const cancelAnimationFrame=id=>frames.delete(id);
function frame(now){
  const queued=[...frames];frames.clear();
  for(const [,fn] of queued)fn(now);
}
vm.runInNewContext(source,{window,document,requestAnimationFrame,cancelAnimationFrame});
const S=window.HD_SPOTLIGHT;
const target=new Node('button');target.className='map-pad-btn';
function setRect(x,y,w,h){
  target.rect={left:x,top:y,right:x+w,bottom:y+h,width:w,height:h};
}
setRect(510,175,42,42);
S.show({target,count:'STEP 4/9',title:'設備選択',tip:'光る地点を操作'});
const overlay=body.children[0],svg=overlay.children[0],mask=svg.children[0].children[0];
const hole=mask.children[1];
assert.equal(overlay.hidden,false);
assert.equal(hole.getAttribute('x'),'495');
assert.equal(hole.getAttribute('y'),'160');
assert.ok(frames.size>0,'active spotlight must monitor target while tutorial runs');
// The original 900-ms tracking window has ended. Rotation happens later,
// and no orientationchange/resize callback is emitted by this simulated browser.
frame(3000);
viewport.clientWidth=390;viewport.clientHeight=844;
window.innerWidth=390;window.innerHeight=844;
setRect(78,535,42,42);
frame(3300);
assert.equal(overlay.hidden,false,'portrait spotlight should remain active');
assert.equal(hole.getAttribute('x'),'63','focus must follow the moved target');
assert.equal(hole.getAttribute('y'),'520');
assert.equal(svg.getAttribute('viewBox'),'0 0 390 844');
assert.equal(mask.children[0].getAttribute('width'),'390');
assert.equal(mask.children[0].getAttribute('height'),'844');
assert.equal(svg.children[1].getAttribute('width'),'390');
assert.equal(svg.children[1].getAttribute('height'),'844');
// A drawer animates without changing the viewport, and focus follows anyway.
setRect(90,405,42,42);
frame(3600);
assert.equal(hole.getAttribute('x'),'75');
assert.equal(hole.getAttribute('y'),'390');
// Rotation makes the target off-screen. The monitor requests a scroll, but
// never leaves an old dark overlay stuck over an unrelated control.
viewport.clientWidth=844;viewport.clientHeight=390;
window.innerWidth=844;window.innerHeight=390;
setRect(610,560,42,42);
frame(3900);
assert.equal(target.scrollCalls>0,true);
assert.equal(overlay.hidden,true);
setRect(625,260,42,42);
frame(4200);
assert.equal(hole.getAttribute('x'),'610');
assert.equal(hole.getAttribute('y'),'245');
assert.equal(overlay.hidden,false,'focus must resume after scrolling into view');
// Pause and resume are lifecycle-safe during modal opening/closing.
S.suspend();
assert.equal(overlay.hidden,true);
assert.equal(frames.size,0,'suspend must stop the observer loop');
modal.classList.contains=type=>type==='open';
S.show({target,title:'ダイアログ中'});
assert.equal(overlay.hidden,true);
modal.classList.contains=()=>false;
S.show({target,title:'復帰'});
assert.equal(overlay.hidden,false);
S.hide();
assert.equal(frames.size,0,'hide must cancel tracking');
assert.equal(overlay.hidden,true);
console.log('PASS: late landscape-to-portrait relayout, moving drawer target, scroll recovery, return rotation and modal lifecycle');
