/* HOSPITAL DEFENSE tutorial spotlight behavior / v4.4
   Run: node tests/tutorial-spotlight.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const rootPath=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(rootPath,'js/tutorial-spotlight.js'),'utf8');
const style=fs.readFileSync(path.join(rootPath,'css/tutorial-spotlight.css'),'utf8');
const html=fs.readFileSync(path.join(rootPath,'index.html'),'utf8');
const app=fs.readFileSync(path.join(rootPath,'js/app.js'),'utf8');
class Node{
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.attrs={};this.style={};this.className='';this.hidden=false;
    this.isConnected=true;this.scrollTop=0;this.scrolled=false;
    this.classList={contains:(s)=>this.className.split(' ').includes(s)};
  }
  appendChild(el){this.children.push(el);el.parent=this;return el}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]}
  closest(k){return k==='[hidden]'?(this.hidden?this:null):k==='.drawer-body'?(this.drawerBody||null):null}
  getBoundingClientRect(){return this.bounds||{left:0,top:0,right:185,bottom:64,width:185,height:64}}
  scrollIntoView(){this.scrolled=true}
}
const body=new Node('body');
const modal=new Node();
const document={
  body,
  documentElement:{clientWidth:800,clientHeight:480},
  createElement:(tag)=>new Node(tag),
  createElementNS:(_,tag)=>new Node(tag),
  getElementById:(id)=>id==='modalBackdrop'?modal:null
};
let frames=[],cancelled=[];
const listeners={};
const window={
  innerWidth:800,innerHeight:480,
  addEventListener:(name,fn)=>{listeners[name]=fn},
  visualViewport:{addEventListener:()=>{}}
};
vm.runInNewContext(source,{
  window,document,performance:{now:()=>50},
  requestAnimationFrame:(fn)=>{frames.push(fn);return frames.length},
  cancelAnimationFrame:(id)=>cancelled.push(id)
});
const S=window.HD_SPOTLIGHT;
assert.ok(S,'spotlight API missing');
const spotTarget=new Node('button');
spotTarget.className='map-pad-btn';
spotTarget.bounds={left:210,top:120,right:310,bottom:165,width:100,height:45};
S.show({target:spotTarget,title:'地点を選ぶ',tip:'明るいところをタップ',count:'STEP 1/9'});
const overlay=body.children[0];
assert.equal(overlay.id,'tutorialSpotlight');
assert.equal(overlay.getAttribute('aria-hidden'),'true');
assert.equal(overlay.hidden,false);
const mask=overlay.children[0].children[0].children[0];
const primaryHole=mask.children[1],secondHole=mask.children[2];
assert.equal(primaryHole.getAttribute('x'),'195'); // pad gains 15px margin
assert.equal(primaryHole.getAttribute('y'),'105');
assert.equal(primaryHole.getAttribute('width'),'130');
assert.equal(primaryHole.getAttribute('height'),'75');
assert.equal(secondHole.getAttribute('width'),'0');
const hint=overlay.children[3];
assert.equal(hint.children[0].textContent,'STEP 1/9');
assert.equal(hint.children[1].textContent,'地点を選ぶ');
const map=new Node('div');
map.bounds={left:20,top:190,right:575,bottom:456,width:555,height:266};
S.show({target:spotTarget,secondary:map,title:'射程を確認',tip:'円と確定ボタンを確認',count:'STEP 3/9'});
assert.equal(overlay.hidden,false);
assert.equal(secondHole.getAttribute('x'),'15');
assert.equal(secondHole.getAttribute('width'),'565');
assert.equal(hint.children[1].textContent,'射程を確認');
assert.ok(overlay.children[2].hidden===false,'secondary ring visible');
const scrollTarget=new Node('button');
scrollTarget.bounds={left:40,top:870,right:140,bottom:920,width:100,height:50};
S.show({target:scrollTarget,title:'下のボタン',tip:'スクロール',count:'STEP 4/9'});
assert.equal(scrollTarget.scrolled,true,'offscreen target must be revealed on portrait');
assert.equal(overlay.hidden,true,'do not darken the whole screen until target is visible');
S.hide();
assert.equal(overlay.hidden,true);
S.show({target:spotTarget,title:'再表示',tip:'選択',count:'STEP 1/9'});
assert.equal(overlay.hidden,false);
S.suspend();assert.equal(overlay.hidden,true,'dialogs must take precedence');
modal.classList.contains=(s)=>s==='open';
S.show({target:spotTarget,title:'モーダル中',tip:'戻る'});
assert.equal(overlay.hidden,true,'no overlay above the open confirmation dialog');
modal.classList.contains=()=>false;
S.show({target:spotTarget,title:'モーダル終了',tip:'再開'});
assert.equal(overlay.hidden,false);
assert.ok(typeof listeners.resize==='function'&&typeof listeners.scroll==='function');
assert.match(style,/pointer-events:none/);
assert.match(style,/prefers-reduced-motion/);
assert.match(style,/tutorial-active:not\(\.drawer-open\)/);
assert.ok(html.indexOf('tutorial-spotlight.js')<html.indexOf('js/app.js'));
assert.ok(html.includes('css/tutorial-spotlight.css'));
assert.ok(app.includes("secondary:step.id==='preview'?document.querySelector('.map-wrap'):null"));
assert.ok(app.includes("target:'.map-wrap'"),'wave observation needs to illuminate the whole map');
assert.ok(app.includes('Spotlight.suspend()')&&app.includes('Spotlight.hide()'));
console.log('PASS: padded focus holes, map + confirm dual focus, scrolling, modal suppression, pointer safety and reduced motion');
