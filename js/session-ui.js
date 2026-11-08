/* HOSPITAL DEFENSE — shared session UI rules.
   Keeps visible budget information tied to one game.sp value. */
(() => {
  'use strict';
  const money=n=>Math.round(Number(n)||0).toLocaleString('ja-JP');
  function waveBonus(waveNumber,waveLimit,definitions){
    if(!Number.isInteger(waveNumber)||!Number.isInteger(waveLimit)||waveNumber<1)return 0;
    const definition=definitions[waveNumber-1];
    if(!definition)return 0;
    // W5 is the final battle in five-wave mode but a midgame checkpoint in seven-wave mode.
    if(waveNumber===5&&waveLimit===7)return 170;
    return Math.max(0,Number(definition.bonus)||0);
  }
  function pendingTiming(game,tower,pendingFactor=.86){
    if(!tower?.pending)return null;
    const terminal=game.phase==='lost'||game.phase==='won';
    const fallback=game.phase==='active'||terminal?game.wave:game.wave+1;
    // Due wave is fixed when the upgrade is requested, never recalculated
    // from phase after a loss or when the detail panel is reopened.
    const wave=Number.isInteger(tower.pending.dueWave)&&tower.pending.dueWave>=1
      ?tower.pending.dueWave:Math.max(1,fallback);
    return {
      wave,terminal,
      targetLevel:tower.pending.targetLevel,
      paidCost:tower.pending.cost,
      penaltyPercent:Math.round((1-pendingFactor)*100),
      originalLabel:`当初予定：WAVE ${wave} 終了時`,
      autoLabel:terminal
        ?`ミッション終了により未完了（当初予定：WAVE ${wave} 終了時）`
        :`WAVE ${wave} 終了時・追加費用0 SP`
    };
  }
  // HARD-only, data-driven balance adjustments. Easy and Normal remain unchanged.
  function startingSP(mode){return mode==='hard'?420:360}
  function waveUnits(mode,waveNumber,units){
    if(mode==='hard'&&waveNumber===1)
      return 'phish auth phish phish malware auth phish phish auth malware phish auth phish phish'.split(' ');
    return units.slice();
  }
  function hpMultiplier(mode,waveNumber,base){
    if(mode!=='hard')return base;
    if(waveNumber===6)return Number((base*1.12).toFixed(4));
    if(waveNumber===7)return Number((base*1.15).toFixed(4));
    return base;
  }
  function killReward(mode,waveNumber,baseReward){
    const factor=mode!=='hard'?1:waveNumber>=7?.75:waveNumber===6?.80:waveNumber===5?.90:1;
    return Math.max(1,Math.round(baseReward*factor));
  }
  function forecast(mode,waveNumber){
    if(mode==='hard'&&waveNumber===1)return 'HARD W1予測：フィッシング8・認証4・マルウェア2。射程と相性を確認。';
    if(mode==='hard'&&waveNumber===5)return 'HARD W5以降：撃退SPの収入効率が段階的に低下。';
    if(mode==='hard'&&waveNumber===6)return 'HARD W6：敵の耐久力が従来より約12%上昇。';
    if(mode==='hard'&&waveNumber===7)return 'HARD W7：敵の耐久力が従来より約15%上昇。';
    return '';
  }
  function syncWalletDOM(document,sp,towers){
    if(!Number.isFinite(sp))return;
    const display=money(sp);
    const total=document.getElementById('spValue');
    if(total)total.textContent=display;
    const risk=document.getElementById('riskBudgetValue');
    if(risk)risk.textContent=display+' SP';
    const selected=document.getElementById('shopLocation');
    if(selected&&!selected.hidden){
      selected.textContent=selected.textContent.replace(/現在\s+[\d,]+\s+SP/,`現在 ${display} SP`);
    }
    for(const btn of document.querySelectorAll('[data-required-sp]')){
      const cost=Number(btn.dataset.requiredSp);
      const permanentLock=btn.dataset.baseDisabled==='true';
      btn.disabled=permanentLock||sp<cost;
    }
    for(const btn of document.querySelectorAll('.shop-item[data-id]')){
      const tower=towers[btn.dataset.id];
      if(!tower)continue;
      const shortage=sp<tower.cost;
      btn.classList.toggle('is-unaffordable',shortage);
      const warning=btn.querySelector('.shop-warning');
      if(warning)warning.hidden=!shortage;
    }
  }
  window.HD_SESSION_UI=Object.freeze({waveBonus,pendingTiming,startingSP,waveUnits,hpMultiplier,killReward,forecast,syncWalletDOM});
})();
