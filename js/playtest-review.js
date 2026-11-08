/* HOSPITAL DEFENSE v4.5 — evidence-based end-of-session review.
   All data is from the local game session. These values are fictional game metrics,
   not proof of medical safety or the causal effect of any particular intervention. */
(() => {
  'use strict';
  const total=o=>Object.values(o||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
  const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  const yen=n=>Math.round(Number(n)||0).toLocaleString('ja-JP');
  function summarize(game,towers,enemies){
    const leakData=Object.entries(game.leaksByKind||{})
      .filter(([,n])=>Number(n)>0)
      .sort((a,b)=>b[1]-a[1])
      .map(([kind,count])=>({kind,count,label:enemies[kind]?.name||kind}));
    const defenseData=Object.entries(game.towerStats||{})
      .filter(([,stat])=>stat?.shots>0)
      .map(([kind,stat])=>({kind,label:towers[kind]?.name||kind,shots:stat.shots,kills:stat.kills,damage:Math.round(stat.damage)}))
      .sort((a,b)=>b.kills-a.kills||b.damage-a.damage);
    const spent={...(game.spending||{})};
    const gross=total(Object.fromEntries(Object.entries(spent).filter(([k])=>k!=='refund')));
    const net=gross-(spent.refund||0);
    const advice=[];
    if(leakData.length){
      const biggest=leakData[0];
      const guidance={auth:'MFAの配置地点と強化時点',phish:'メールフィルターの射程と設置位置',
        malware:'EDRの配置・健全度・保守時点',insider:'教育の定着度と侵入地点の守り',
        boss:'複数設備の射程重なりと強化・保守'};
      advice.push(`${biggest.label}が${biggest.count}件侵入。次回は${guidance[biggest.kind]||'防御設備の配置'}を比較してみてください。`);
    }else if(game.leaks===0){
      advice.push('侵入は0件でした。次回は別ルートや難易度で再現性を確かめてください。');
    }
    if((game.risk?.trainingFailures||0)>0){
      advice.push(`教育の定着失敗が${game.risk.trainingFailures}回ありました。フォローアップ研修の実施時点を比較できます。`);
    }
    if((game.risk?.incidents||0)>0){
      advice.push(`運用イベントが${game.risk.incidents}件発生しました。予防保守と報告体制への投資時点を見直してみてください。`);
    }
    if((game.risk?.upgradeDelays||0)>0){
      advice.push('設備強化の遅延がありました。追加検証にSPを使う場合と、他の設備へ先に投資する場合を比較してください。');
    }
    if((game.risk?.wifiIncidents||0)>0){
      if((game.risk?.wifiThreats||0)>0)
        advice.push(`Wi-Fi認証情報を利用した不審な接続から追加の脅威が${game.risk.wifiThreats}件発生。中央ルートをカバーするネットワーク分離・EDRと、早期報告の準備を振り返ってください。`);
      else advice.push('Wi-Fiの認証情報流出は発生しましたが、拡大は阻止できました。分離・EDR・報告体制の組み合わせが別のルートでも有効か検証してください。');
    }

    if(!defenseData.length){
      advice.push('設備による迎撃記録がありません。まずはルート上の射程を確認し、複数の脅威に対応できる配置を考えましょう。');
    }else{
      const first=defenseData[0];
      advice.push(`迎撃記録が最も多かった設備は${first.label}（撃退${first.kills}件）。この配置が他の基本ルートでも有効か検証してみてください。`);
    }
    return {leakData,defenseData,spent,gross,net,advice,
      waveResults:game.completedWaves||[],leakTotal:game.leaks||0};
  }
  function render(summary){
    const {leakData,defenseData,spent,gross,net,advice,waveResults}=summary;
    const leakText=leakData.length
      ?leakData.map(e=>`<span>${escapeHTML(e.label)} ${e.count}件</span>`).join('')
      :'<span>侵入 0件</span>';
    const defenses=defenseData.length
      ?defenseData.map(e=>`${escapeHTML(e.label)}：撃退${e.kills}・対応${e.shots}回`).join(' ／ ')
      :'迎撃実績なし';
    const spendGroups=[
      ['設備購入',spent.purchase],['設備強化',spent.upgrade],['職員教育',spent.training],
      ['再研修',spent.followUp],['報告体制',spent.reporting],
      ['保守・サポート',spent.maintenance],['BCP',spent.bcp],['売却による回収',spent.refund]
    ].filter(([,v])=>Number(v)>0);
    const spendText=spendGroups.length
      ?spendGroups.map(([name,value])=>`${name}${yen(value)}SP`).join(' ／ ')
      :'SP支出記録なし';
    const waves=waveResults.length?waveResults.map(w=>`W${w.wave}：診療${Math.round(w.integrity)}%・情報${Math.round(w.privacy)}%`).join(' ／ '):'完了ウェーブなし';
    return `<section class="playtest-result" aria-label="今回の振り返り">
      <h3>今回の侵入・設備・投資の振り返り</h3>
      <p><strong>脅威別侵入数</strong></p><div class="outcome-chips">${leakText}</div>
      <p><strong>設備別迎撃貢献：</strong>${defenses}</p>
      <p><strong>SP投資内訳：</strong>${escapeHTML(spendText)}</p>
      <p><strong>支出合計：</strong>${yen(gross)}SP（売却回収を差し引いた純支出 ${yen(net)}SP）</p>
      <p><strong>ウェーブ終了時：</strong>${escapeHTML(waves)}</p>
      <h3>次回の検証ポイント</h3>
      ${advice.map(a=>`<p>・${escapeHTML(a)}</p>`).join('')}
      <p style="font-size:10px!important">※これらは今回のゲーム内記録から作った振り返り案です。施策単独の因果効果や現実の医療安全性を示すものではありません。</p>
    </section>`;
  }
  window.HD_REVIEW=Object.freeze({summarize,render});
})();
