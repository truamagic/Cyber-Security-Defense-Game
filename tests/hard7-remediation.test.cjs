/* HARD 7 WAVE playtest remediation: regression checks for priorities 1–4.
   Run with: node tests/hard7-remediation.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const win={};
vm.runInNewContext(read('js/game-data.js'),{window:win,Math});
vm.runInNewContext(read('js/risk-sim.js'),{window:win,Math});
vm.runInNewContext(read('js/session-ui.js'),{window:win,Math});
const UI=win.HD_SESSION_UI,R=win.HD_RISK,defs=win.HD_CONFIG.WAVE_DEFS;
assert.equal(defs.length,7);
assert.equal(UI.waveBonus(3,3,defs),135);
assert.equal(UI.waveBonus(4,7,defs),150);
assert.equal(UI.waveBonus(5,5,defs),0,'final wave of 5-wave mode still rewards zero');
assert.equal(UI.waveBonus(5,7,defs),170,'W5 7-wave interim milestone gives 170 SP');
assert.equal(UI.waveBonus(6,7,defs),190);
assert.equal(UI.waveBonus(7,7,defs),0,'7-wave final stage stays at zero');
assert.equal(UI.waveBonus(0,7,defs),0);
assert.equal(R.PENDING_FACTOR,.86);
const tower=R.createTower(R.fresh('hard'),'edr',175);
tower.pending={targetLevel:2,remaining:1,cost:130};
let info=UI.pendingTiming({phase:'active',wave:4,waveLimit:7},tower,R.PENDING_FACTOR);
assert.equal(info.wave,4);
assert.equal(info.targetLevel,2);
assert.equal(info.paidCost,130);
assert.equal(info.penaltyPercent,14);
assert.ok(info.autoLabel.includes('追加費用0 SP'));
info=UI.pendingTiming({phase:'intermission',wave:4,waveLimit:7},tower,R.PENDING_FACTOR);
assert.equal(info.wave,5);
info=UI.pendingTiming({phase:'ready',wave:0,waveLimit:5},tower,R.PENDING_FACTOR);
assert.equal(info.wave,1);
const reduced=R.efficiency(tower);
tower.pending=null;
assert.ok(Math.abs(reduced/R.efficiency(tower)-R.PENDING_FACTOR)<1e-10,'pending factor must match the explanation');
assert.equal(UI.pendingTiming({phase:'active',wave:4},tower,R.PENDING_FACTOR),null);
const display={spValue:{textContent:'214'},riskBudgetValue:{textContent:'214 SP'},
  shopLocation:{textContent:'◉ 地点04 ｜ 現在 214 SP',hidden:false}};
const enabled={dataset:{requiredSp:'250',baseDisabled:'false'},disabled:true};
const locked={dataset:{requiredSp:'100',baseDisabled:'true'},disabled:true};
const warning={hidden:false};
const flags=new Set(['is-unaffordable']);
const shop={
  dataset:{id:'edr'},
  classList:{toggle:(flag,on)=>on?flags.add(flag):flags.delete(flag)},
  querySelector:()=>warning
};
const doc={
  getElementById:id=>display[id]||null,
  querySelectorAll:selector=>selector==='[data-required-sp]'?[enabled,locked]
    :selector==='.shop-item[data-id]'?[shop]:[]
};
UI.syncWalletDOM(doc,263,win.HD_CONFIG.TOWERS);
assert.equal(display.spValue.textContent,'263');
assert.equal(display.riskBudgetValue.textContent,'263 SP');
assert.equal(display.shopLocation.textContent,'◉ 地点04 ｜ 現在 263 SP');
assert.equal(enabled.disabled,false);
assert.equal(locked.disabled,true);
assert.equal(warning.hidden,true);
assert.equal(flags.has('is-unaffordable'),false);
UI.syncWalletDOM(doc,90,win.HD_CONFIG.TOWERS);
assert.equal(display.spValue.textContent,'90');
assert.equal(display.riskBudgetValue.textContent,'90 SP');
assert.equal(enabled.disabled,true);
assert.equal(warning.hidden,false);
assert.equal(flags.has('is-unaffordable'),true);
const app=read('js/app.js'),html=read('index.html'),style=read('css/playtest-polish.css');
assert.ok(html.indexOf('js/session-ui.js')<html.indexOf('js/app.js'));
assert.ok(html.includes('id="modalTitle" tabindex="-1"'));
assert.ok(html.includes('C / RISK 4.7'));
assert.ok(app.includes("function syncLiveEconomy(force=false)"));
assert.ok(app.includes("lastTime=ts;update(dt);syncLiveEconomy();render()"),'must sync during combat');
assert.ok(app.includes('syncLiveEconomy(true)'), 'synchronize after full re-render');
assert.ok(app.includes('id="riskBudgetValue"'));
assert.ok(app.includes('dataset.requiredSp=String(cost)'));
assert.ok(app.includes('dataset.baseDisabled=String(!!blocked)'));
assert.ok(app.includes("SessionUI.waveBonus(waveNumber,game.waveLimit,WAVE_DEFS)"));
assert.ok(app.includes('game.sp+=clearBonus'));
assert.ok(app.includes('ボーナス +${clearBonus} SP'));
assert.ok(app.includes('7 WAVE中間報酬 +170 SP'));
assert.ok(!app.includes('game.sp+=wave.bonus'));
assert.ok(app.includes('SessionUI.pendingTiming(game,tower,Risk.PENDING_FACTOR)'));
assert.ok(app.includes('無料で待つ：${pendingInfo.autoLabel}'));
assert.ok(app.includes('追加検証'));
assert.ok(app.includes('dialog.scrollTop=0'));
assert.ok(app.includes("focus({preventScroll:true})"));
assert.ok(app.includes('],true,true);'), 'result dialog needs heading focus flag');
assert.ok(style.includes('.upgrade-delay-note'));
assert.equal((style.match(/\{/g)||[]).length,(style.match(/\}/g)||[]).length);
console.log('PASS: live SP sync, affordability, conditional W5 reward, pending upgrade timing and result scroll reset');
