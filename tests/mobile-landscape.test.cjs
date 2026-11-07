/* HOSPITAL DEFENSE v4.2 — layout integration contract.
   Run: node tests/mobile-landscape.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/mobile-landscape.css'),'utf8');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
assert.match(html, /href="\.\/css\/mobile-landscape\.css"/);
for(const id of ['titleMenu','gameShell','rotateMenuTip','sideRiskChance','sideRiskHealth','sideRiskAdherence','sideRiskProblems','menuStartBtn','menuTutorialBtn','placementBar'])assert.ok(html.includes('id="'+id+'"'),id);
for(const marker of [
  '@media (orientation:landscape) and (max-height:600px) and (pointer:coarse)',
  '@media (orientation:portrait) and (max-width:700px)',
  '#gameShell .card',
  'grid-template-columns:minmax(0,57fr) minmax(215px,43fr)',
  '#gameShell .map-wrap',
  '#gameShell .command-bar',
  '#gameShell .board-bottom',
  '#gameShell .landscape-risk',
  '#gameShell .tutorial-panel',
  '.control-drawer',
  '#gameShell .placement-bar'
]) assert.ok(css.includes(marker),marker);
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
assert.ok(app.includes("['riskChance','sideRiskChance']"));
assert.ok(app.includes("['riskHealth','sideRiskHealth']"));
assert.ok(app.includes("['riskAdherence','sideRiskAdherence']"));
assert.ok(app.includes("['riskProblems','sideRiskProblems']"));
assert.ok(app.includes("window.addEventListener('orientationchange'"));
const widths=[[667,375],[740,360],[844,390],[915,412],[568,320]];
for(const [width,height] of widths){
  const usable=width-17; // approx. 6px shell padding per side + 5px grid gap
  const left=usable*.57;
  const mapWidth=Math.min(left,1.7143*height-267);
  const mapHeight=mapWidth*7/12;
  assert.ok(mapWidth>=270, 'map too narrow '+width+'x'+height);
  assert.ok(mapHeight<=height-126,'map extends beyond available area '+width+'x'+height);
}
console.log('PASS: landscape media rules, portrait hint, separate control rail, map proportions, tutorial and status bindings');
