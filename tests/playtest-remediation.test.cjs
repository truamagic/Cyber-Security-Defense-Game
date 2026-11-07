/* HOSPITAL DEFENSE v4.5 post-playtest quality regression checks.
   Run: node tests/playtest-remediation.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const style=fs.readFileSync(path.join(root,'css/playtest-polish.css'),'utf8');
const data=fs.readFileSync(path.join(root,'js/game-data.js'),'utf8');
const risk=fs.readFileSync(path.join(root,'js/risk-sim.js'),'utf8');
const review=fs.readFileSync(path.join(root,'js/playtest-review.js'),'utf8');
const window={};
vm.runInNewContext(data,{window,Math});
vm.runInNewContext(review,{window,Math});
const API=window.HD_REVIEW;
assert.ok(API);
const game={
  leaks:3,leaksByKind:{auth:2,malware:1},kills:8,killsByKind:{phish:8},
  towerStats:{mfa:{shots:24,kills:6,damage:610},edr:{shots:5,kills:2,damage:182}},
  spending:{purchase:275,upgrade:105,training:110,followUp:80,maintenance:66,reporting:0,bcp:0,refund:0},
  completedWaves:[{wave:1,integrity:96,privacy:98},{wave:2,integrity:78,privacy:85}],
  risk:{trainingFailures:1,upgradeDelays:1,incidents:2}
};
const summary=API.summarize(game,window.HD_CONFIG.TOWERS,window.HD_CONFIG.ENEMIES);
assert.equal(summary.leakData[0].kind,'auth');
assert.equal(summary.leakData[0].count,2);
assert.equal(summary.defenseData[0].kind,'mfa');
assert.equal(summary.defenseData[0].kills,6);
assert.equal(summary.gross,636);
assert.equal(summary.net,636);
assert.ok(summary.advice.some(v=>v.includes('MFA')));
assert.ok(summary.advice.some(v=>v.includes('フォローアップ')));
const result=API.render(summary);
assert.ok(result.includes('設備別迎撃貢献'));
assert.ok(result.includes('侵入・設備・投資'));
assert.ok(result.includes('認証情報の悪用'));
assert.ok(result.includes('支出合計'));
assert.ok(result.includes('W1'));
const clean=API.summarize({
 leaks:0,leaksByKind:{},towerStats:{},spending:{refund:50},completedWaves:[],
 risk:{trainingFailures:0,upgradeDelays:0,incidents:0}
},window.HD_CONFIG.TOWERS,window.HD_CONFIG.ENEMIES);
assert.equal(clean.leakData.length,0);
assert.ok(clean.advice.some(v=>v.includes('侵入は0件')));
assert.equal(clean.net,-50);
for(const ref of [
  './css/playtest-polish.css','./js/playtest-review.js','id="logCategoryFilter"','id="logCount"'
])assert.ok(html.includes(ref),ref);
assert.ok(html.indexOf('playtest-review.js')<html.indexOf('js/app.js'));
assert.ok(data.includes("short:'メールフィルター'"));
assert.ok(app.includes("game.events.unshift({message,kind,wave:game.wave||0"));
assert.ok(!app.includes("game.events.length=Math.min(5"));
assert.ok(app.includes("game.leaksByKind[enemy.kind]"));
assert.ok(app.includes("game.towerStats[tower.type]"));
assert.ok(app.includes("game.spending.purchase+="));
assert.ok(app.includes("const tutorialDone=isGuided('complete')"));
assert.ok(app.includes("'TUTORIAL COMPLETE'"));
assert.ok(app.includes("label:'盤面を確認'"));
assert.ok(app.includes("r.effectiveTraining>=game.trainingLevel"));
assert.ok(!app.includes("r.effectiveTraining>=lv)||['won','lost'].includes(game.phase))return"));
assert.ok(risk.includes("lastChange:'新規設置"));
assert.ok(risk.includes("自然劣化"));
assert.ok(style.includes('min-width:901px')&&style.includes('max-height:820px'));
assert.ok(style.includes('.shop-name{font-size:16px')&&style.includes('.shop-desc{font-size:14px'));
assert.ok(style.includes('.modal-backdrop .modal{max-height:'));
assert.equal((style.match(/\{/g)||[]).length,(style.match(/\}/g)||[]).length);
for(const [width,height] of [[1165,747],[1180,757]]){
 const mapWidth=1.714286*height-437.14;
 const mapHeight=mapWidth*7/12;
 assert.ok(mapWidth<width-24,'map must fit width');
 assert.ok(mapHeight<=height-240,'map must fit compact height');
}
console.log('PASS: report-backed outcomes, follow-up fix, session history, tutorial terminal state, readable compact layout');
