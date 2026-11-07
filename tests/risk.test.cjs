/* Self-contained rules smoke test: `node tests/risk.test.cjs` */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/risk-sim.js'),'utf8'),{window,Math});
const R=window.HD_RISK;
function seeded(mode,seed=987654321){const r=R.fresh(mode);r.randomState=seed;return r}
{
 const r=seeded('easy'); const t=R.createTower(r,'mail',100);let towers=[t];
 for(let i=0;i<6;i++)R.advanceWave(r,towers);
 assert.equal(t.health,100); assert.equal(R.incidentRisk(r,towers),0);assert.equal(R.upgradeChance(r,t),1);
 R.boostEducation(r);assert.equal(r.effectiveTraining,1);
}
{
 const r=seeded('hard');const a=R.createTower(r,'edr',175);const b=R.createTower(r,'mail',100);
 const initial=R.incidentRisk(r,[a,b]);
 assert.equal(initial,.39);
 R.doPreventive(r,a);assert.ok(R.incidentRisk(r,[a,b])<initial);
 for(let i=0;i<4;i++)R.advanceWave(r,[a,b]);
 assert.equal(a.supportLeft,0);assert.ok(a.health<100);assert.ok(R.efficiency(a)<1);
 const cost=R.renewalCost(a,{edr:{cost:175}});assert.ok(cost>0);
 R.doRenewal(r,a);assert.equal(a.supportLeft,3);
 a.health=3;assert.ok(R.isOffline(a));assert.equal(R.efficiency(a),0);
 R.doMaintenance(r,a);assert.ok(!R.isOffline(a));
}
{
 const r=seeded('normal',123456789);const a=R.createTower(r,'mfa',140);
 assert.ok(R.upgradeChance(r,a)<1);
 let hadDelayed=false;
 for(let i=0;i<50;i++){
  const t=R.createTower(r,'mfa',140);const o=R.doUpgrade(r,t,105);
  if(!o.succeed){hadDelayed=true;assert.equal(t.level,1);assert.ok(t.pending);R.advanceWave(r,[t]);assert.equal(t.level,2);assert.equal(t.pending,null);break;}
 }
 assert.ok(hadDelayed,'some upgrades must be delayed at NORMAL');
}
{
 const r=seeded('hard',20180013);let failed=0,trained=0;
 for(let i=0;i<60;i++){
   const x=R.boostEducation(r);
   if(x.gain===0)failed++;else trained++;
 }
 assert.ok(failed>0 && trained>0);
 const after=R.educationSpeed(r,3,[1,.79,.60,.43]);
 R.followUp(r,3);assert.equal(r.effectiveTraining,3);assert.ok(R.educationSpeed(r,3,[1,.79,.60,.43])<=after);
}
{
 const r=seeded('hard');const a=R.createTower(r,'edr',175),b=R.createTower(r,'mail',100);
 a.health=42;b.health=40;const issue=R.applyIncident(r,[a,b],'cascade');
 assert.equal(issue.integrityLoss,4);assert.equal(issue.privacyLoss,3);assert.ok(a.health<42 && b.health<40);
}
console.log('PASS: difficulty, aging, prevention, support, failures, adoption and cascade');
