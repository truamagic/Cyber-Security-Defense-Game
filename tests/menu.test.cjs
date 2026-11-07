/* UI menu state and 3/5/7-wave data contract. Run: node tests/menu.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const win={};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/game-data.js'),'utf8'),{window:win,Math});
const data=win.HD_CONFIG;
assert.equal(data.WAVE_DEFS.length,7);
for(const count of [3,5,7]) {
  assert.ok(data.WAVE_DEFS[count-1].units.length>0);
  assert.ok(data.WAVE_DEFS.slice(0,count).every(w=>Number.isFinite(w.hpMult)));
}
assert.ok(data.EVENT_PLANS[6].length>0&&data.EVENT_PLANS[7].length>0);
class Element {
  constructor(dataset={}){this.dataset=dataset;this.attrs={};this.listeners={};this.hidden=false;this.textContent='';}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]}
  addEventListener(name,handler){this.listeners[name]=handler}
  click(){this.listeners.click?.()}
  focus(){this.focused=true}
}
const modes=['easy','normal','hard'].map(v=>new Element({menuMode:v}));
const waves=[3,5,7].map(v=>new Element({menuWaves:String(v)}));
const ids={};
for(const id of ['titleMenu','gameShell','menuStartBtn','menuTutorialBtn','menuSelectionSummary'])ids[id]=new Element();
ids.gameShell.hidden=true;
const calls=[];
win.HD_GAME={beginSession:(mode,count,tutorial)=>calls.push({mode,count,tutorial})};
win.scrollTo=()=>{};
const document={
  querySelectorAll(q){return q==='[data-menu-mode]'?modes:q==='[data-menu-waves]'?waves:[]},
  getElementById(id){const el=ids[id];assert.ok(el,'Unknown menu id '+id);return el}
};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/menu.js'),'utf8'),{window:win,document});
assert.equal(ids.menuSelectionSummary.textContent,'NORMAL / 5 WAVE');
assert.equal(modes[1].getAttribute('aria-pressed'),'true');
waves[0].click();modes[0].click();ids.menuStartBtn.click();
assert.deepEqual(calls[0],{mode:'easy',count:3,tutorial:false});
waves[2].click();modes[2].click();ids.menuTutorialBtn.click();
assert.deepEqual(calls[1],{mode:'hard',count:7,tutorial:true});
win.HD_START_MENU.showGame();
assert.equal(ids.titleMenu.hidden,true);assert.equal(ids.gameShell.hidden,false);
win.HD_START_MENU.showMenu();
assert.equal(ids.titleMenu.hidden,false);assert.equal(ids.gameShell.hidden,true);
assert.equal(ids.menuStartBtn.focused,true);
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
for(const token of ['game.waveLimit','game.wave===game.waveLimit','game.wave>=game.waveLimit','HD_GAME=Object.freeze','returnToMenuNow','tutorialSetStep'])assert.ok(app.includes(token),'Missing '+token);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const id of ['titleMenu','menuStartBtn','menuTutorialBtn','waveLimitValue','gameShell','backToMenuBtn'])assert.ok(html.includes('id="'+id+'"'));
console.log('PASS: title screen selection, wave data, tutorial entry, return navigation, game integration contract');
