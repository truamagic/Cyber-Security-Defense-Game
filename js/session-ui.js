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
    const wave=Math.max(1,game.phase==='active'?game.wave:game.wave+1);
    return {
      wave,
      targetLevel:tower.pending.targetLevel,
      paidCost:tower.pending.cost,
      penaltyPercent:Math.round((1-pendingFactor)*100),
      autoLabel:`WAVE ${wave} 終了時・追加費用0 SP`
    };
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
  window.HD_SESSION_UI=Object.freeze({waveBonus,pendingTiming,syncWalletDOM});
})();
