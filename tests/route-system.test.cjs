/* Contract tests for v4.3 route geometry and staged incoming paths.
   Run with: node tests/route-system.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const window={};
let randomValue=0;
const math=Object.create(Math);
math.random=()=>randomValue;
vm.runInNewContext(fs.readFileSync(path.join(root,'js/game-data.js'),'utf8'),{window,Math:math});
vm.runInNewContext(fs.readFileSync(path.join(root,'js/route-system.js'),'utf8'),{window,Math:math});
const d=window.HD_CONFIG,R=window.HD_ROUTING;
assert.equal(R.variants.length,5);
assert.equal(d.WAVE_DEFS.length,7);
assert.ok(Object.values(d.EVENT_PLANS).flat().every(e=>e.kind!=='route'));
for(let i=0;i<5;i++){
 randomValue=(i+.1)/5;
 assert.equal(R.randomIndex(),i);
 const variant=R.get(i);
 assert.equal(variant.index,i);
 assert.equal(variant.pads.length,13);
 assert.ok(variant.primary.total>1000);
 assert.ok(variant.secondary.total<variant.primary.total);
 assert.ok(variant.tertiary.total<variant.secondary.total);
 for(const route of [variant.main,variant.mid,variant.late]){
   const last=route[route.length-1];
   assert.equal(last.x,858);assert.equal(last.y,264);
 }
 assert.equal(variant.mid[0].x,455);
 assert.equal(variant.mid[0].y,42);
 assert.equal(variant.late[0].x,810);
 assert.equal(variant.late[0].y,58);
 assert.equal(variant.mid[3].x,500);
 assert.equal(variant.mid[3].y,270);
 assert.equal(variant.late[3].x,740);
 assert.equal(variant.late[3].y,264);
 for(let j=0;j<variant.pads.length;j++){
   const pad=variant.pads[j];
   const distance=R.distanceToPath(pad,variant.main);
   assert.ok(distance>=40&&distance<=106,'Route '+i+' pad '+j+' distance '+distance);
   for(let k=j+1;k<variant.pads.length;k++){
     const other=variant.pads[k];
     assert.ok(Math.hypot(pad.x-other.x,pad.y-other.y)>=75,'Pads overlap '+i+','+j+','+k);
   }
 }
}
for(const wave of [1,2])assert.equal(R.branchEvents[wave],undefined);
for(const wave of [3,4]){
 const events=R.branchEvents[wave];
 assert.equal(events.length,1);
 assert.equal(events[0].kind,'mid');
}
for(const wave of [5,6,7]){
 const events=R.branchEvents[wave];
 assert.equal(events.length,2);
 assert.equal(events[0].kind,'mid');
 assert.equal(events[1].kind,'late');
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
assert.ok(html.includes('id="routeVariant"'));
assert.ok(html.indexOf('./js/game-data.js')<html.indexOf('./js/route-system.js'));
assert.ok(html.indexOf('./js/route-system.js')<html.indexOf('./js/app.js'));
for(const word of ['Routing.randomIndex()','resetGame(0)','midRouteOpen','lateRouteOpen','routeData(enemy.route)','game.wave>=3','game.wave>=5'])assert.ok(app.includes(word),'Missing: '+word);
console.log('PASS: five randomized corridors, all 13 pad coverage sites, staged WAVE3/WAVE5 entries, and engine bindings');
