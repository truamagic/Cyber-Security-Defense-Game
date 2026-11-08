/* HOSPITAL DEFENSE v4 — abstract and deliberately non-operational risk simulation.
   Rules and numbers are game-balancing assumptions, not empirical cyber-risk estimates.
   No network requests or patient information are used. */
(() => {
  'use strict';
  const MODES = Object.freeze({
    easy:   {name:'EASY',  label:'入門',wear:[0,0],incident:0,upgrade:.999,trainingDecay:0,support:99,startingAdherence:100},
    normal: {name:'NORMAL',label:'標準',wear:[5,10],incident:.20,upgrade:.88,trainingDecay:[2,5],support:5,startingAdherence:72},
    hard:   {name:'HARD',  label:'高難度',wear:[10,16],incident:.39,upgrade:.71,trainingDecay:[4,9],support:3,startingAdherence:60}
  });
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const PENDING_FACTOR=.86;
  function fresh(mode='normal') {
    const key=MODES[mode]?mode:'normal';
    return {mode:key,adherence:MODES[key].startingAdherence,effectiveTraining:0,trainingFailures:0,reporting:0,
      incidents:0,wifiIncidents:0,wifiThreats:0,wifiPrevented:0,upgradeDelays:0,breakdowns:0,services:0,
      maintenanceInvested:0,trainingFollowUps:0,preventedHuman:0,
      randomState:(Math.floor(Math.random()*0xffffffff)>>>0)||1};
  }
  function rand(r){let x=r.randomState>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;r.randomState=x>>>0;return (r.randomState>>>0)/4294967296}
  const between=(r,min,max)=>min+Math.floor(rand(r)*(max-min+1));
  function profile(r){return MODES[r.mode]||MODES.normal}
  function createTower(r,type,price){return {type,level:1,cooldown:.2,invested:price,health:100,preventive:0,supportLeft:profile(r).support,pending:null,lastChange:'新規設置：健全度100%'}}
  function isOffline(t){return (t?.health??100)<=8}
  function effectiveLevel(t){return Math.max(1,t.level-((t.health??100)<35?1:0))}
  function efficiency(t){if(!t)return 1;if(isOffline(t))return 0;
    const health=clamp(t.health??100,0,100);
    const fatigue=.58+.42*health/100;
    return fatigue*(t.supportLeft===0?.74:1)*(t.pending?PENDING_FACTOR:1);
  }
  function upgradeChance(r,t){const m=profile(r);if(r.mode==='easy')return 1;
    return clamp(m.upgrade+((t.health??100)-75)*.002+(t.preventive>0?.07:0)+(t.supportLeft===0?-.11:0),.43,.98);
  }
  function maintenanceCost(t,towers){return Math.round(43+(towers[t.type]?.cost||120)*.23)+(isOffline(t)?20:0)}
  function preventiveCost(t,towers){return Math.round(29+(towers[t.type]?.cost||120)*.14)}
  function renewalCost(t,towers){return Math.round(34+(towers[t.type]?.cost||120)*.3)}
  function expediteCost(t){return t.pending?Math.max(35,Math.round(t.pending.cost*.32)):0}
  function educationSpeed(r,level,speeds){const adopted=Math.min(level,r.effectiveTraining);return 1-(1-speeds[adopted])*r.adherence/100}
  function boostEducation(r){
    if(r.mode==='easy'){r.adherence=100;r.effectiveTraining=Math.min(3,r.effectiveTraining+1);return {gain:0,outcome:'全体に定着'}}
    // Training completed does not guarantee it changes behaviour.
    // Factors such as workload, confusing processes, and limited retention are abstracted.
    const noChange=rand(r)<(r.mode==='hard'?.28:.10);
    if(noChange){r.trainingFailures++;return {gain:0,outcome:'定着が確認できず、今回の研修による効果なし'}}
    const gain=r.mode==='hard'?between(r,5,17):between(r,10,24);
    r.adherence=clamp(r.adherence+gain,0,100);
    r.effectiveTraining=Math.min(3,r.effectiveTraining+1);
    return {gain,outcome:gain<11?'理解・定着にばらつき':'定着率が改善'};
  }
  function followUp(r,level){const gain=r.mode==='easy'?0:r.mode==='hard'?between(r,12,22):between(r,17,28);
    const before=r.adherence;r.adherence=clamp(r.adherence+gain,0,100);r.effectiveTraining=Math.max(r.effectiveTraining,level);
    r.trainingFollowUps++;return r.adherence-before;
  }
  function incidentRisk(r,towers){if(r.mode==='easy')return 0;
    const active=towers.filter(Boolean),old=active.filter(t=>t.supportLeft===0).length,
      fragile=active.filter(t=>t.health<45).length;
    // One roll per wave. Visible probability can be influenced by mitigation.
    const base=profile(r).incident+old*.075+fragile*.05-r.reporting*.065-
      active.filter(t=>t.preventive>0).length*.028;
    return clamp(base,.04,.79);
  }
  function incidentType(r,towers){const active=towers.filter(Boolean);
    const expired=active.some(t=>t.supportLeft===0),weak=active.filter(t=>t.health<55).length;
    const types=['equipment','training','vulnerability'];
    if(expired)types.push('vulnerability','vulnerability');
    if(weak>=2)types.push('cascade','cascade');
    if(active.length===0) return 'training';
    return types[Math.floor(rand(r)*types.length)];
  }
  function planIncident(r,towers){const probability=incidentRisk(r,towers);
    return rand(r)<probability?{type:incidentType(r,towers),at:7+rand(r)*5,probability}:null;
  }
  // The Wi-Fi event REPLACES a normal incident on the designated wave.
  // Baseline chance per play: normal .20 * .75 = .15, hard .39 * (.30/.39) = .30.
  // Reporting and preventive maintenance may lower the ordinary incident chance.
  // No extra independent roll is added to the wave.
  function wifiEventEligible(r,towers,incident,waveLimit,wave){
    if(!incident||r.mode==='easy')return false;
    if(!((waveLimit===5&&wave===4)||(waveLimit===7&&wave===6)))return false;
    const p=incidentRisk(r,towers);
    const cap=r.mode==='hard'?.30:.15;
    return rand(r)<Math.min(1,cap/Math.max(p,.001));
  }
  function pathDistance(point,nodes){
    let distance=Infinity;
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i],dx=b.x-a.x,dy=b.y-a.y;
      const length2=dx*dx+dy*dy;
      const ratio=length2?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/length2,0,1):0;
      distance=Math.min(distance,Math.hypot(point.x-(a.x+ratio*dx),point.y-(a.y+ratio*dy)));
    }
    return distance;
  }
  function wifiDefense(r,towers,pads,branch,towerTypes){
    // Focus on the entry-to-junction segment, not a tower elsewhere on the map.
    const access=branch.slice(0,4);
    const covers=type=>towers.some((t,i)=>t&&t.type===type&&!isOffline(t)&&
      efficiency(t)>=.5&&pads[i]&&pathDistance(pads[i],access)<=towerTypes[type].range+14);
    const isolated=covers('segment'),monitored=covers('edr');
    const reporting=r.reporting>=1,educated=r.effectiveTraining>=1&&r.adherence>=65;
    const points=(isolated?2:0)+(monitored?1:0)+(reporting?1:0)+(educated?1:0);
    return {isolated,monitored,reporting,educated,points,protected:points>=3};
  }
  function resolveWifiIncident(r,readiness){
    // A successful response contains the incident; it never guarantees
    // that the original credential exposure did not happen.
    const threats=readiness.protected?(rand(r)<.55?0:1):(rand(r)<.50?2:3);
    const notSpawned=3-threats;
    const prevented=readiness.protected?notSpawned:0;
    r.incidents++;r.wifiIncidents++;r.wifiThreats+=threats;r.wifiPrevented+=prevented;
    return {...readiness,threats,prevented,notSpawned};
  }
  function applyIncident(r,towers,kind){const active=towers.filter(Boolean),output={title:'',message:'',healthLoss:0,integrityLoss:0,privacyLoss:0,noticeKind:'warn'};
    r.incidents++;
    if(kind==='training'){
      const loss=r.mode==='hard'?between(r,13,23):between(r,7,15);
      r.adherence=clamp(r.adherence-loss,0,100);
      return {...output,title:'研修効果のばらつき',message:`業務環境の影響で定着度が${loss}pt低下。フォローアップ研修を検討。`};
    }
    if(!active.length)return {...output,title:'管理手順の混乱',message:'設備が未設置のため直接損傷はありません。'};
    if(kind==='cascade'&&active.length>=2){
      const sorted=[...active].sort((a,b)=>a.health-b.health).slice(0,2);
      for(const t of sorted){const before=t.health;t.health=clamp(t.health-between(r,10,16),0,100);t.lastChange='複合障害による低下：'+(before-t.health)+'pt';}
      return {...output,title:'複合障害',message:'複数の設備が同時に不安定化し、診療と情報保護に影響しました。',integrityLoss:4,privacyLoss:3,noticeKind:'danger'};
    }
    const eligible=kind==='vulnerability'?[...active].sort((a,b)=>a.supportLeft-b.supportLeft):active;
    const target=kind==='vulnerability'?eligible[0]:eligible[Math.floor(rand(r)*eligible.length)];
    const loss=kind==='vulnerability'?between(r,13,21):between(r,17,28);
    const actual=target.preventive>0?Math.round(loss*.55):loss;
    const prior=target.health;
    target.health=clamp(prior-actual,0,100);target.lastChange=(kind==='vulnerability'?'脆弱性イベント：':'設備不調：')+(prior-target.health)+'pt低下';
    if(prior>8&&isOffline(target))r.breakdowns++;
    return {...output,title:kind==='vulnerability'?'未対応の脆弱性':'機器・ソフトウェアの不調',
      message:`${window.HD_CONFIG?.TOWERS?.[target.type]?.name||target.type}の健全度が${actual}pt低下。${isOffline(target)?'停止中のため応急保守が必要。':'保守で復旧できます。'}`};
  }
  function doUpgrade(r,t,cost,dueWave=null){const chance=upgradeChance(r,t);const succeed=rand(r)<chance;
    if(succeed){t.level++;return {succeed:true,chance}}
    t.pending={targetLevel:t.level+1,remaining:1,cost,dueWave:Number.isInteger(dueWave)&&dueWave>=1?dueWave:null};r.upgradeDelays++;
    if(r.mode==='hard'&&rand(r)<.40){t.health=clamp(t.health-7,0,100);t.lastChange='導入トラブルによる健全度低下：7pt';}
    return {succeed:false,chance};
  }
  function doMaintenance(r,t){if(t.health>=100)return false;
    const before=t.health;t.health=clamp(t.health+(isOffline(t)?58:42),0,100);t.lastChange='定期・応急保守により+'+(t.health-before)+'pt回復';r.services++;return true;
  }
  function doPreventive(r,t){t.preventive=Math.max(t.preventive,2);t.lastChange='予防保守を実施（自然劣化を抑制）';r.services++}
  function doRenewal(r,t){t.supportLeft=profile(r).support;t.lastChange='サポート更新を実施';r.services++}
  function advanceWave(r,towers){const changes=[];const m=profile(r);
    if(r.mode==='easy')return changes;
    for(const [i,t] of towers.entries()){
      if(!t)continue;
      if(t.pending){t.pending.remaining--;if(t.pending.remaining<=0){t.level=Math.max(t.level,t.pending.targetLevel);t.pending=null;changes.push(`地点${i+1}：遅延していた強化が完了（Lv.${t.level}）`)}}
      const wear=between(r,m.wear[0],m.wear[1]);
      const less=t.preventive>0?Math.round(wear*.40):wear;
      const before=t.health;
      t.health=clamp(t.health-less,0,100);if(before!==t.health)t.lastChange='ウェーブ終了時の自然劣化：'+(before-t.health)+'pt低下'+(t.preventive>0?'（予防保守で軽減）':'');
      if(t.supportLeft>0)t.supportLeft--;
      if(t.preventive>0)t.preventive--;
      if(before>8&&isOffline(t)){r.breakdowns++;changes.push(`地点${i+1}：設備停止。保守が必要です`)}
      else if(t.supportLeft===0)changes.push(`地点${i+1}：サポート期限切れ。更新を推奨`);
      else if(t.health<40&&before>=40)changes.push(`地点${i+1}：健全度低下。実効レベルが下がっています`);
    }
    const decay=between(r,m.trainingDecay[0],m.trainingDecay[1]);
    r.adherence=clamp(r.adherence-Math.max(0,decay-r.reporting*2),0,100);
    return changes;
  }
  function preventHuman(r,trainingLevel){if(r.mode==='easy'||trainingLevel===0||r.effectiveTraining===0)return false;
    const chance=clamp(.04+Math.min(trainingLevel,r.effectiveTraining)*(r.adherence/100)*.095+r.reporting*.06,0,.58);
    if(rand(r)<chance){r.preventedHuman++;return true}return false;
  }
  window.HD_RISK=Object.freeze({MODES,PENDING_FACTOR,profile,fresh,rand,between,clamp,createTower,
    isOffline,effectiveLevel,efficiency,upgradeChance,maintenanceCost,preventiveCost,renewalCost,expediteCost,
    educationSpeed,boostEducation,followUp,incidentRisk,planIncident,wifiEventEligible,wifiDefense,resolveWifiIncident,applyIncident,
    doUpgrade,doMaintenance,doPreventive,doRenewal,advanceWave,preventHuman});
})();
