/* v4.8 regression tests: upgrade due-wave state, modal overlay, efficiency and HARD balance.
   Run: node tests/hard7-v48.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const win={};
vm.runInNewContext(read('js/game-data.js'),{window:win,Math});
vm.runInNewContext(read('js/risk-sim.js'),{window:win,Math});
vm.runInNewContext(read('js/session-ui.js'),{window:win,Math});
const data=win.HD_CONFIG,risk=win.HD_RISK,ui=win.HD_SESSION_UI;
const sample=mode=>{const r=risk.fresh(mode);r.randomState=12345678;return r};
assert.equal(ui.startingSP('hard'),420);
assert.equal(ui.startingSP('easy'),360);
assert.equal(ui.startingSP('normal'),360);
const counts=xs=>xs.reduce((out,x)=>(out[x]=(out[x]||0)+1,out),{});
const hardW1=ui.waveUnits('hard',1,data.WAVE_DEFS[0].units);
assert.equal(hardW1.length,14);
assert.equal(counts(hardW1).phish,8);
assert.equal(counts(hardW1).auth,4);
assert.equal(counts(hardW1).malware,2);
assert.equal(counts(ui.waveUnits('normal',1,data.WAVE_DEFS[0].units)).phish,10);
assert.equal(counts(ui.waveUnits('easy',1,data.WAVE_DEFS[0].units)).phish,10);
for(const mode of ['easy','normal','hard']){
  assert.equal(JSON.stringify(ui.waveUnits(mode,2,data.WAVE_DEFS[1].units)),JSON.stringify(data.WAVE_DEFS[1].units));
}
assert.ok(ui.forecast('hard',1).includes('マルウェア2'));
assert.equal(ui.forecast('normal',1),'');
assert.equal(ui.hpMultiplier('hard',5,1.45),1.45);
assert.equal(ui.hpMultiplier('hard',6,1.57),1.7584);
assert.equal(ui.hpMultiplier('hard',7,1.7),1.955);
assert.equal(ui.hpMultiplier('normal',7,1.7),1.7);
assert.equal(ui.killReward('hard',4,80),80);
assert.equal(ui.killReward('hard',5,80),72);
assert.equal(ui.killReward('hard',6,80),64);
assert.equal(ui.killReward('hard',7,80),60);
assert.equal(ui.killReward('normal',7,80),80);
assert.equal(ui.waveBonus(5,7,data.WAVE_DEFS),170);
assert.equal(ui.waveBonus(5,5,data.WAVE_DEFS),0);

const r=sample('hard'),tower=risk.createTower(r,'edr',175);
let delayed=null;
for(let i=0;i<120;i++){
  const candidate=risk.createTower(r,'edr',175);
  const result=risk.doUpgrade(r,candidate,130,2);
  if(!result.succeed){delayed=candidate;break;}
}
assert.ok(delayed,'HARD should sometimes delay an upgrade');
assert.equal(delayed.pending.dueWave,2);
let active=ui.pendingTiming({phase:'active',wave:2},delayed,risk.PENDING_FACTOR);
assert.equal(active.wave,2);
assert.equal(active.terminal,false);
assert.ok(active.autoLabel.includes('WAVE 2 終了時'));
let lost=ui.pendingTiming({phase:'lost',wave:2},delayed,risk.PENDING_FACTOR);
assert.equal(lost.wave,2,'due wave must not drift from W2 to W3 on loss');
assert.equal(lost.terminal,true);
assert.ok(lost.originalLabel.includes('WAVE 2 終了時'));
assert.ok(lost.autoLabel.includes('未完了'));
assert.ok(!lost.autoLabel.includes('追加費用0'));
const nextWave=ui.pendingTiming({phase:'intermission',wave:2},delayed,risk.PENDING_FACTOR);
assert.equal(nextWave.wave,2,'persisted due wave always wins over phase-based fallback');
// Backward-compatibility for tests that call doUpgrade without a dueWave.
const legacy=risk.createTower(r,'mail',100);
legacy.pending={targetLevel:2,remaining:1,cost:85};
assert.equal(ui.pendingTiming({phase:'active',wave:3},legacy).wave,3);
assert.equal(ui.pendingTiming({phase:'intermission',wave:3},legacy).wave,4);
assert.ok(ui.pendingTiming({phase:'lost',wave:3},legacy).terminal);
assert.equal(ui.pendingTiming({phase:'lost',wave:3},legacy).wave,3);
const alive=risk.createTower(r,'mail',100);
alive.pending={targetLevel:2,remaining:1,cost:85,dueWave:2};
risk.advanceWave(r,[alive]);
assert.equal(alive.level,2);
assert.equal(alive.pending,null);

const app=read('js/app.js'),css=read('css/tutorial-spotlight.css'),html=read('index.html');
assert.ok(app.includes("doUpgrade(game.risk,t,cost,dueWave)"));
assert.ok(app.includes("const dueWave=game.phase==='active'?game.wave:game.wave+1"));
assert.ok(app.includes("pendingInfo.terminal")&&app.includes("timing.terminal"));
assert.ok(app.includes('ミッション終了：強化は未完了'));
assert.ok(app.includes('ミッション終了：更新作業は未完了'));
assert.ok(app.includes('document.body.classList.add(\'modal-open\')'));
assert.ok(app.includes('document.body.classList.remove(\'modal-open\')'));
assert.ok(css.includes('body.modal-open .modal-backdrop.open{z-index:100'));
assert.ok(css.includes('body.modal-open #tutorialPanel{visibility:hidden'));
assert.ok(css.includes('body.modal-open #tutorialSpotlight{display:none'));
assert.ok(app.includes('rate:TOWERS[t.type].rate*Math.pow(.90,lv)'));
assert.ok(!app.includes('rate:TOWERS[t.type].rate*Math.pow(.90,lv)*(impact'));
assert.ok(app.includes('lv=Risk.effectiveLevel(tower)-1,special='));
assert.ok(app.includes('SessionUI.waveUnits(game.risk.mode,game.wave,wave.units)'));
assert.ok(app.includes('SessionUI.hpMultiplier(game.risk.mode,game.wave,w.hpMult)'));
assert.ok(app.includes('SessionUI.killReward(game.risk.mode,game.wave,targetInfo.reward)'));
assert.ok(app.includes('game.sp=360;refreshUI()'),'tutorial must retain original 360-SP balance');
assert.ok(app.includes("sp:SessionUI.startingSP($('difficultySelect').value)"));
assert.ok(html.includes('C / RISK 4.8'));
console.log('PASS: delayed upgrade due-wave persistence, terminal label, modal precedence, one-pass efficiency, HARD-only early/late balance');
