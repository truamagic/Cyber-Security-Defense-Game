/* HOSPITAL DEFENSE v4.9 — practical preparation and state explanations.
   These are fictional game rules, not empirical predictions of hospital risks. */
(() => {
  'use strict';
  const fmt=n=>Math.round(n).toLocaleString('ja-JP');
  function nextWave(game,config,session,routing){
    if(!game||['won','lost'].includes(game.phase)||game.wave>=game.waveLimit)return null;
    const wave=game.wave+1,definition=config.WAVE_DEFS[wave-1];
    if(!definition)return null;
    const units=session.waveUnits(game.risk.mode,wave,definition.units);
    const counts={};
    for(const unit of units)counts[unit]=(counts[unit]||0)+1;
    const branch=(routing.branchEvents[wave]||[]).map(e=>({route:e.kind,count:e.count}));
    const human=(config.EVENT_PLANS[wave]||[]).filter(e=>e.kind==='human')
      .reduce((sum,e)=>sum+e.count,0);
    return {wave,name:definition.title,counts,branches:branch,human,
      mainCount:units.length,uncertain:game.risk.mode!=='easy'};
  }
  function moneyAfter(sp,cost){return Math.max(0,sp-cost)}
  function trainingAdvice(game,trainingCosts,risk){
    const level=game.trainingLevel,r=game.risk;
    const cost=level>=3?0:trainingCosts[level];
    const failureRate=r.mode==='easy'?0:r.mode==='hard'?28:10;
    const nextSP=moneyAfter(game.sp,cost);
    const speed=risk.educationSpeed(r,level, [1,.79,.60,.43]);
    return {cost,failureRate,nextSP,speedReduction:Math.round((1-speed)*100),
      applicable:'人的リスク型の進行速度と早期報告に関係。通常のフィッシング型や認証型のHPは減りません。',
      warning:level>=3?'研修レベルは上限です':
        'この投資は直接攻撃力を増やしません。序盤は防御設備を購入するSPとの配分に注意してください。',
      period:level===0?'WAVE 1の通常敵に直接の攻撃効果はありません。':'定着率はWAVE経過や運用イベントで低下します。',
      success:'定着が保証されるわけではありません。フォローアップ研修で改善可能です。'};
  }
  function reportingAdvice(game,cost,risk){
    const before=Math.round(risk.incidentRisk(game.risk,game.towers)*100);
    const copy={...game.risk,reporting:Math.min(3,game.risk.reporting+1),
      adherence:Math.min(100,game.risk.adherence+6)};
    const after=Math.round(risk.incidentRisk(copy,game.towers)*100);
    return {cost,nextSP:moneyAfter(game.sp,cost),before,after,
      note:'事故リスクの予測値はゲーム用。直接防御力ではなく、報告と教育の定着を支援します。'};
  }
  function upgradeSummary(game,tower,towerType,session){
    if(!tower)return '';
    if(tower.pending){
      const info=session.pendingTiming(game,tower);
      if(info.terminal)return `終了時点で更新未完了：Lv.${tower.level}→Lv.${info.targetLevel}、${info.paidCost} SP支払済み（${info.originalLabel}）`;
      return `Lv.${info.targetLevel}申請済み・${info.paidCost} SP支払済み｜${info.autoLabel}`;
    }
    return tower.level>=3?'最大強化済み':`次の強化：${towerType.upgrade[tower.level-1]} SP`;
  }
  function canUseBCP(game,tutorial,cost){
    const reason=tutorial?'操作練習中は使用できません':
      ['won','lost'].includes(game.phase)?'ミッション終了後は使用できません':
      game.bcpUsed?'このWAVEでは使用済みです':
      game.integrity>=100?'診療継続度が100%のため回復は不要です':
      game.sp<cost?`必要SPが不足（現在${fmt(game.sp)} / 必要${cost}）`:'';
    return {enabled:reason==='',reason,explanation:'BCPは診療継続度だけを回復し、情報保護度は回復しません。'};
  }
  window.HD_DECISION=Object.freeze({nextWave,trainingAdvice,reportingAdvice,upgradeSummary,canUseBCP});
})();
