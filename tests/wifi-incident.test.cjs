/* HOSPITAL DEFENSE v4.6 — Wi-Fi credential exposure incident tests.
   This is a fictional simulation test; never models credential extraction or access steps. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const win={};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/risk-sim.js'),'utf8'),{window:win,Math});
const R=win.HD_RISK;
const empty=[];
const makes=(mode,seed=31415926)=>{const r=R.fresh(mode);r.randomState=seed;return r;};
const eligible=(r,incident,length,wave)=>R.wifiEventEligible(r,empty,incident,length,wave);
for(const mode of ['normal','hard']){
  const r=makes(mode);
  assert.equal(eligible(r,{type:'equipment'},3,3),false,'3-wave mode cannot trigger the special incident');
  assert.equal(eligible(r,{type:'equipment'},5,3),false);
  assert.equal(eligible(r,{type:'equipment'},7,5),false);
  assert.equal(eligible(r,null,5,4),false,'no incident slot => no Wi-Fi event');
}
assert.equal(eligible(makes('easy'),{type:'equipment'},5,4),false);
assert.equal(eligible(makes('easy'),{type:'equipment'},7,6),false);
function freq(mode,waveLength,opportunity){
  let total=0,special=0,otherIncidents=0,eligibleCount=0;
  for(let i=1;i<=16000;i++){
    const r=makes(mode,Math.imul(i,0x9e3779b1)>>>0||1);
    const incident=R.planIncident(r,empty);
    if(incident)total++;
    if(R.wifiEventEligible(r,empty,incident,waveLength,opportunity)){
      special++;eligibleCount++;
    }else if(incident)otherIncidents++;
  }
  assert.equal(total,special+otherIncidents);
  return special/16000;
}
const normal=freq('normal',5,4),hard=freq('hard',7,6);
assert.ok(normal>.12&&normal<.18,'NORMAL approximate 15% baseline: '+normal);
assert.ok(hard>.26&&hard<.34,'HARD approximate 30% baseline: '+hard);
const r=makes('hard'),branch=[{x:455,y:42},{x:455,y:177},{x:500,y:177},{x:500,y:270}];
const types={segment:{range:134},edr:{range:164}};
const unready=R.wifiDefense(r,[],[],branch,types);
assert.equal(unready.protected,false);
assert.equal(unready.points,0);
const isolated=R.createTower(r,'segment',155),monitored=R.createTower(r,'edr',175);
const places=[{x:390,y:177},{x:520,y:200}];
const ready=R.wifiDefense(r,[isolated,monitored],places,branch,types);
assert.equal(ready.isolated,true);
assert.equal(ready.monitored,true);
assert.equal(ready.protected,true);
assert.equal(ready.points,3);
const distant=R.wifiDefense(r,[isolated,monitored],[{x:100,y:500},{x:900,y:450}],branch,types);
assert.equal(distant.protected,false,'irrelevant distant placement must not prevent threats');
monitored.health=0;
assert.equal(R.wifiDefense(r,[isolated,monitored],places,branch,types).protected,false,'offline EDR loses readiness');
monitored.health=100;
for(let i=0;i<40;i++){
  const weak=R.resolveWifiIncident(r,unready);
  assert.ok(weak.threats>=2&&weak.threats<=3);
  assert.equal(weak.threats+weak.notSpawned,3);assert.equal(weak.prevented,0);
  const strong=R.resolveWifiIncident(r,ready);
  assert.ok(strong.threats>=0&&strong.threats<=1);
  assert.equal(strong.threats+strong.notSpawned,3);assert.equal(strong.prevented,strong.notSpawned);
}
assert.equal(r.wifiIncidents,80);assert.equal(r.incidents,80);
assert.ok(r.wifiThreats+r.wifiPrevented<80*3);assert.ok(r.wifiPrevented>=80);
const rWithReporting=makes('normal',42);rWithReporting.reporting=3;
assert.ok(R.incidentRisk(rWithReporting,empty)<R.incidentRisk(makes('normal',42),empty));
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
assert.ok(source.includes("Risk.planIncident(game.risk,game.towers)"));
assert.ok(source.includes("Risk.wifiEventEligible(game.risk,game.towers,inc,game.waveLimit,game.wave)"));
for(const txt of ["kind:'wifiWarning'","kind:'wifiResolve'","kind==='wifiWarning'","kind==='wifiResolve'","Risk.wifiDefense","Risk.resolveWifiIncident","game.spawnTotal-result.notSpawned","spawnEnemy(kinds[j],'mid'","Wi-Fi特殊イベント"])assert.ok(source.includes(txt),'missing '+txt);
console.log('PASS: Wi-Fi special event triggers once in risk slot, ~15%/~30% baseline, advance warning, mitigation and tallying');
