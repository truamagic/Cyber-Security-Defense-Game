/* Game runtime: state, controls, drawing, and wave progression. */
(()=>{'use strict';
  const {W, H, MAX_LEVEL, BCP_COST, BCP_HEAL, TRAINING_COSTS, TRAINING_SPEED, TOWERS, ENEMIES, WAVE_DEFS, PATH, SIDE_PATH, PADS, PRIMARY, SECONDARY, PATHLEN, TOTAL_PATH, EVENT_PLANS, iconSVG, PANEL_CONFIG} = window.HD_CONFIG;

  // Preserve approximately the same travel time as v3.1 despite shorter visible routes.
  // Original full-route lengths: main 1780, secondary 556 map units.
  const routeTravelScale={main:PRIMARY.total/1780,side:SECONDARY.total/556};
  const Risk=window.HD_RISK;
  if(!Risk)throw Error('Risk simulation module not loaded');
  const canvas=document.getElementById('board'),ctx=canvas.getContext('2d');
  // Fallback for older Chromium-based browsers that lack CanvasRenderingContext2D.roundRect.
  if(ctx&&typeof ctx.roundRect!=='function'){ctx.roundRect=function(x,y,w,h,r){const q=Math.min(Math.max(0,typeof r==='number'?r:8),Math.abs(w)/2,Math.abs(h)/2);this.moveTo(x+q,y);this.lineTo(x+w-q,y);this.quadraticCurveTo(x+w,y,x+w,y+q);this.lineTo(x+w,y+h-q);this.quadraticCurveTo(x+w,y+h,x+w-q,y+h);this.lineTo(x+q,y+h);this.quadraticCurveTo(x,y+h,x,y+h-q);this.lineTo(x,y+q);this.quadraticCurveTo(x,y,x+q,y);this.closePath();return this}}
  const $=id=>document.getElementById(id);
  let game={},lastTime=0,toastTimer=null,raf=0,visualT=0,hoverPad=-1;
  let configuredWaveLimit=5;
  let currentDrawer=null,drawerReturnFocus=null;
  let placement=null,hoverPreviewType=null; // pad/type are provisional until confirm; no SP spent yet.
  const TUTORIAL_STEPS=[
    {id:'pad',title:'設置地点を選ぼう',description:'マップ中央左側の「地点04」の＋を押してみましょう。空き地点を押すと、その場所に置く設備のショップが開きます。',tip:'マップの点滅する＋（地点04）をクリック／タップ。',target:'.map-pad-btn[data-pad="3"]'},
    {id:'shop',title:'メールフィルターを選ぼう',description:'ショップの設備を比較します。練習ではメールフィルターを選択してください。まだSPは消費されません。',tip:'ショップ内の「メールフィルター」を選択。',target:'.shop-item[data-id="mail"]'},
    {id:'preview',title:'射程を確認して設置を確定',description:'マップに表示された水色の円がゲーム内で対応できる範囲です。ルートを覆う位置か確認し、「設置確定」を押してください。',tip:'設置確定までSPは減りません。設備変更も可能です。',target:'#confirmPlacementBtn'},
    {id:'tower',title:'設置したタワーを選択',description:'今設置した地点04のタワーをもう一度押してください。強化パネルが開き、現在のレベルと性能が確認できます。',tip:'マップ上の地点04を再びクリック／タップ。',target:'.map-pad-btn[data-pad="3"]'},
    {id:'upgrade',title:'タワーをレベルアップ',description:'防御設備はSPを使ってLv.3まで強化できます。今回はメールフィルターをLv.2にしてください。',tip:'強化パネルにある「↑ 強化 85 SP」を押す。',target:'#detail .detail-actions .btn-primary'},
    {id:'educationOpen',title:'職員教育のパネルを開く',description:'設備だけではなく、職員による気づきと報告も重要です。上部の「職員教育」ボタンを押しましょう。',tip:'上部メニューの「職員教育」を選択。',target:'#openEducationBtn'},
    {id:'education',title:'職員教育を強化',description:'職員教育は人的リスク型の進行を遅くする全体強化です。今回はLv.1に上げて効果を確認しましょう。',tip:'「職員教育を強化 110 SP」を押す。',target:'#trainingBtn'},
    {id:'waveReady',title:'短い練習ウェーブを開始',description:'配置・強化が終わりました。ウェーブを開始すると敵が自動で移動し、タワーが射程内の敵に対応します。',tip:'「▶ ウェーブ1開始」を押す。',target:'#startBtn'},
    {id:'waveActive',title:'防御の動きを観察しよう',description:'敵が水色のルートを進みます。タワーの光、敵のHP、診療継続度と情報保護度を見てみましょう。完了すると結果が表示されます。',tip:'観察中です。必要なら一時停止や2倍速を使えます。',target:'.wave-track'},
    {id:'complete',title:'チュートリアル完了！',description:'設置地点の選択・射程プレビュー・購入・設備強化・職員教育・ウェーブ開始を体験しました。メニューに戻り、3・5・7ウェーブから挑戦できます。',tip:'「メニューへ戻る」ボタンで開始設定に戻ります。',target:'#tutorialExitBtn'}
  ];
  const TUTORIAL_PAD=3;
  let tutorial=null;
  function isGuided(step){return !!(tutorial?.active && tutorial.step===step)}
  function tutorialPermit(action,detail){
    if(!tutorial?.active)return true;
    const allow={pad:action==='pad'&&detail===TUTORIAL_PAD,shop:action==='towerType'&&detail==='mail',preview:action==='confirm',tower:action==='pad'&&detail===TUTORIAL_PAD,upgrade:action==='towerUpgrade'&&detail===TUTORIAL_PAD,educationOpen:action==='openEducation',education:action==='training',waveReady:action==='wave',waveActive:action==='speed'||action==='pause',complete:false};
    if(allow[tutorial.step])return true;
    toast('操作練習：点滅している場所を操作してください');
    return false;
  }
  function tutorialSetStep(step){
    if(!tutorial?.active)return;
    tutorial.step=step;
    tutorialRender();
    const target=document.querySelector(TUTORIAL_STEPS.find(s=>s.id===step)?.target||'#__none__');
    if(target && !currentDrawer && ['waveReady','educationOpen'].includes(step))target.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function tutorialRender(){
    const active=!!tutorial?.active,el=$('tutorialPanel');
    el.hidden=!active;
    document.body.classList.toggle('tutorial-active',active);
    document.querySelectorAll('.tutorial-highlight').forEach(node=>node.classList.remove('tutorial-highlight'));
    if(!active){$('tutorialBtn').textContent='🎓 チュートリアル';$('tutorialBtn').disabled=false;return}
    const idx=TUTORIAL_STEPS.findIndex(s=>s.id===tutorial.step),step=TUTORIAL_STEPS[Math.max(0,idx)];
    const count=Math.min(idx+1,9);
    $('tutorialCounter').textContent=idx===9?'COMPLETE':`STEP ${count} / 9`;
    $('tutorialTitle').textContent=step.title;
    $('tutorialDescription').textContent=step.description;
    $('tutorialTip').textContent=step.tip;
    $('tutorialProgress').style.width=`${(idx===9?9:idx)/9*100}%`;
    $('tutorialProgressTrack').setAttribute('aria-valuenow',String(idx===9?9:idx));
    $('tutorialExitBtn').textContent=idx===9?'✓ メニューへ戻る':'✕ 終了';
    $('tutorialBtn').textContent='🎓 練習中';$('tutorialBtn').disabled=true;
    const target=document.querySelector(step.target);
    if(target && !target.closest('[hidden]'))target.classList.add('tutorial-highlight');
  }
  function startTutorial(){
    const originalDifficulty=tutorial?.originalDifficulty||$('difficultySelect').value;
    tutorial=null;resetGame();
    tutorial={active:true,step:'pad',originalDifficulty};
    $('difficultySelect').value='easy';game.risk=Risk.fresh('easy');game.waveLimit=1;refreshUI();
    addLog('初心者向けの操作練習を開始しました。練習中のSPやスコアは通常プレイへ引き継ぎません。');
    tutorialRender();
    $('tutorialPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function exitTutorial(){tutorial=null;returnToMenuNow();}
  function requestTutorialStart(){
    if(tutorial?.active)return;
    const hasProgress=game.wave>0||game.towers.some(Boolean)||game.trainingLevel>0;
    if(!hasProgress){startTutorial();return}
    const wasPlaying=game.phase==='active'&&!game.paused;
    if(wasPlaying){game.paused=true;refreshUI()}
    openModal('チュートリアルを始めますか？',
      '<p>現在のプレイ状況はリセットされます。練習終了時には、通常ゲームを最初から始められます。</p>',
      [{label:'リセットして練習する',primary:true,action:startTutorial},
       {label:'今のゲームを続ける',action:()=>{if(wasPlaying){game.paused=false;refreshUI()}}}]);
    $('modalBackdrop').dataset.restorePause=wasPlaying?'1':'0';
  }
  function askExitTutorial(){
    if(!tutorial?.active)return;
    if(isGuided('complete')){exitTutorial();return}
    openModal('チュートリアルを終了しますか？','<p>練習で設置した設備やSPの変化は破棄し、最初のメニュー画面へ戻ります。</p>',[
      {label:'終了してメニューへ',primary:true,action:exitTutorial},
      {label:'練習を続ける',action:()=>{}}
    ]);
  }

  function openDrawer(panel){
    if(!PANEL_CONFIG[panel]||$('modalBackdrop').classList.contains('open'))return;
    if(tutorial?.active){
      const allowed=(panel==='shop'&&['shop','preview'].includes(tutorial.step))||(panel==='upgrade'&&['tower','upgrade'].includes(tutorial.step))||(panel==='education'&&['educationOpen','education'].includes(tutorial.step))||tutorial.step==='waveActive';
      if(!allowed){toast('操作練習：現在の手順を先に完了してください');return}
    }
    if(placement && panel!=='shop')cancelPlacement({quiet:true});
    if(currentDrawer===panel){if(panel==='shop'&&placement&&!placement.type)cancelPlacement({quiet:true});closeDrawer();return}
    if(!currentDrawer)drawerReturnFocus=document.activeElement;
    currentDrawer=panel;
    $('drawerTitle').textContent=PANEL_CONFIG[panel].title;
    $('drawerKicker').textContent=PANEL_CONFIG[panel].kicker;
    document.querySelectorAll('[data-panel-view]').forEach(el=>{el.hidden=el.dataset.panelView!==panel});
    document.querySelectorAll('[data-panel]').forEach(btn=>{btn.setAttribute('aria-expanded',String(btn.dataset.panel===panel))});
    $('controlDrawer').inert=false;
    $('controlDrawer').setAttribute('aria-hidden','false');
    $('controlDrawer').classList.add('open');
    $('drawerBackdrop').classList.add('open');
    document.body.classList.add('drawer-open');
    $('closeDrawerBtn').focus({preventScroll:true});
    if(isGuided('educationOpen') && panel==='education')tutorialSetStep('education');
    else tutorialRender();
  }
  function closeDrawer({restoreFocus=true}={}){
    if(!currentDrawer)return;
    currentDrawer=null;
    $('controlDrawer').classList.remove('open');
    $('drawerBackdrop').classList.remove('open');
    document.querySelectorAll('[data-panel]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
    if(restoreFocus&&drawerReturnFocus?.isConnected)drawerReturnFocus.focus({preventScroll:true});
    $('controlDrawer').setAttribute('aria-hidden','true');
    $('controlDrawer').inert=true;
    document.body.classList.remove('drawer-open');
    drawerReturnFocus=null;
    tutorialRender();
  }
  function trapDrawerFocus(e){
    if(e.key!=='Tab'||!currentDrawer)return;
    const root=$('controlDrawer');
    const nodes=[...root.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length);
    if(!nodes.length)return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(!root.contains(document.activeElement)){e.preventDefault();first.focus();return}
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
  function resetGame(){
    closeDrawer({restoreFocus:false});
    game={risk:Risk.fresh($('difficultySelect').value),waveLimit:configuredWaveLimit,phase:'ready',wave:0,sp:360,integrity:100,privacy:100,score:0,kills:0,leaks:0,towers:PADS.map(()=>null),selectedType:'mail',selectedPad:-1,trainingLevel:0,sideRouteOpen:false,waveEvents:[],notice:'',noticeLeft:0,enemies:[],effects:[],queue:[],spawnIndex:0,spawnTimer:0,spawned:0,spawnTotal:0,time:0,speed:1,paused:false,bcpUsed:false,events:[]};
    hoverPad=-1;placement=null;hoverPreviewType=null;lastTime=0;
    $('difficultySelect').disabled=false;addLog('病院の防衛準備を開始しました。','info');addLog('マップの空き地点を選び、ショップで設備を選択後、射程を確認して設置してください。','info');refreshUI();
  }
  function posAt(distance,route='main'){const nodes=route==='side'?SIDE_PATH:PATH,part=route==='side'?SECONDARY:PRIMARY;let d=Math.max(0,Math.min(part.total,distance)),last=0;for(let i=0;i<part.sections.length;i++){if(d<=part.sections[i]){const t=(d-last)/(part.sections[i]-last),a=nodes[i],b=nodes[i+1];return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}last=part.sections[i]}return {...nodes[nodes.length-1]}}
  function money(n){return n.toLocaleString('ja-JP')}
  function levelStats(t){const lv=Risk.effectiveLevel(t)-1,impact=Risk.efficiency(t);return {damage:TOWERS[t.type].damage*(1+lv*.37)*impact,range:TOWERS[t.type].range+lv*12,rate:TOWERS[t.type].rate*Math.pow(.90,lv)*(impact>0?1/Math.max(.4,impact):99),effectiveLevel:lv+1,impact}}
  function addLog(message,kind='info'){game.events.unshift({message,kind});game.events.length=Math.min(5,game.events.length);renderLog()}
  function renderLog(){const log=$('log');log.textContent='';for(const item of game.events){const el=document.createElement('div');el.className='log-item '+(item.kind==='warn'?'warn':item.kind==='danger'?'danger':'');const dot=document.createElement('span');dot.className='log-dot';const txt=document.createElement('span');txt.textContent=item.message;el.append(dot,txt);log.append(el)}}
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400)}
  // Placement workflow: pick a location → choose a tower → inspect true radius → confirm.
  // An active wave is paused during this deliberate choice, then resumed only if
  // the placement flow itself initiated the pause.
  function holdForPlacement(){
    const autoResume=game.phase==='active'&&!game.paused;
    if(autoResume)game.paused=true;
    return autoResume;
  }
  function beginPlacement(i){
    if(['won','lost'].includes(game.phase)||game.towers[i])return;
    if(tutorial?.active && !tutorialPermit('pad',i))return;
    if(!placement)placement={pad:i,type:null,autoResume:holdForPlacement()};
    else placement.pad=i;
    game.selectedPad=i;
    hoverPreviewType=null;
    if(isGuided('pad'))tutorialSetStep('shop');
    refreshUI();
    if(!placement.type){openDrawer('shop')}
    else{closeDrawer({restoreFocus:false})}
  }
  function choosePlacementType(id){
    if(!TOWERS[id]||['won','lost'].includes(game.phase))return;
    if(tutorial?.active && !tutorialPermit('towerType',id))return;
    if(!placement)placement={pad:-1,type:id,autoResume:holdForPlacement()};
    else placement.type=id;
    game.selectedType=id;
    hoverPreviewType=null;
    if(isGuided('shop'))tutorialSetStep('preview');
    refreshUI();
    closeDrawer({restoreFocus:false});
    // Focus an enabled control after the shop closes; disabled confirms
    // cannot receive keyboard focus and would leave focus in the hidden drawer.
    const focusTarget=placement.pad<0
      ?$('padHitLayer').querySelector('.map-pad-btn:not(.occupied)')
      :($('confirmPlacementBtn').disabled?$('changePlacementBtn'):$('confirmPlacementBtn'));
    focusTarget?.focus({preventScroll:true});
    // The visible placement bar already explains the next action; do not obscure the map with a toast.
  }
  function cancelPlacement({quiet=false}={}){
    if(!placement)return;
    const resume=placement.autoResume;
    placement=null;hoverPreviewType=null;game.selectedPad=-1;
    if(tutorial?.active&&['shop','preview'].includes(tutorial.step))tutorialSetStep('pad');
    if(resume&&game.phase==='active')game.paused=false;
    refreshUI();
    if(!quiet)toast('仮配置をキャンセルしました（SPは消費していません）');
  }
  function confirmPlacement(){
    if(!placement||placement.pad<0||!placement.type||['won','lost'].includes(game.phase))return;
    if(tutorial?.active&&!tutorialPermit('confirm'))return;
    const {pad,type,autoResume}=placement,base=TOWERS[type];
    if(game.towers[pad]){toast('その地点には既に設備があります');return}
    if(game.sp<base.cost){toast('SPが不足しています。別の設備を選んでください。');return}
    // Spend SP only after the player explicitly confirms the range preview.
    game.sp-=base.cost;
    game.towers[pad]=Risk.createTower(game.risk,type,base.cost);
    placement=null;hoverPreviewType=null;game.selectedPad=pad;
    if(isGuided('preview'))tutorialSetStep('tower');
    if(autoResume&&game.phase==='active')game.paused=false;
    addLog(`地点 ${pad+1} に${base.name}を設置（-${base.cost} SP）`);
    toast(`${base.short}を地点 ${pad+1} に設置しました`);
    refreshUI();
  }
  function renderPlacementBar(){
    const bar=$('placementBar');bar.hidden=!placement;
    document.body.classList.toggle('placement-active',!!placement);
    if(!placement)return;
    const hasPad=placement.pad>=0,base=placement.type?TOWERS[placement.type]:null;
    $('placementTitle').textContent=hasPad?(base?`地点 ${placement.pad+1}｜${base.name}`:`地点 ${placement.pad+1}｜設置する設備を選択`):`${base?base.name+'｜':''}設置場所を選択`;
    $('placementInfo').textContent=!base?'ショップで設備を選ぶと射程をプレビューできます。':!hasPad?`必要SP ${base.cost} / 射程 ${base.range}（マップ単位）。空き地点をタップしてください。`:`射程 ${base.range}（マップ単位）・必要SP ${base.cost} / 所持 ${game.sp} SP${game.sp<base.cost?' ⚠ SP不足':''}`;
    $('confirmPlacementBtn').disabled=!hasPad||!base||game.sp<base.cost||!!game.towers[placement.pad];
    $('confirmPlacementBtn').textContent=base?`✓ 設置確定（${base.cost} SP）`:'✓ 設置確定';
    $('changePlacementBtn').textContent=base?'設備を変更':'設備を選択';
  }
  function pressPad(i){
    if(game.phase==='won'||game.phase==='lost')return;
    if(tutorial?.active && !tutorialPermit('pad',i))return;
    if(game.towers[i]){
      if(isGuided('tower'))tutorialSetStep('upgrade');
      if(placement)cancelPlacement({quiet:true});
      game.selectedPad=i;renderDetail();renderQuickTower();renderMobilePads();syncPadButtons();openDrawer('upgrade');
    }else beginPlacement(i);
  }
  function initializePadButtons(){const layer=$('padHitLayer');layer.textContent='';PADS.forEach((p,i)=>{const btn=document.createElement('button');btn.type='button';btn.className='map-pad-btn';btn.style.left=(100*p.x/W)+'%';btn.style.top=(100*p.y/H)+'%';btn.dataset.pad=String(i);btn.addEventListener('click',()=>pressPad(i));layer.append(btn)})}
  function syncPadButtons(){for(const b of $('padHitLayer').children){const i=Number(b.dataset.pad),t=game.towers[i];b.className='map-pad-btn'+(t?' occupied':'')+(game.selectedPad===i?' selected':'')+(placement?.pad===i?' pending':'');b.setAttribute('aria-label',`地点 ${i+1}：${t?TOWERS[t.type].name+' Lv.'+t.level+'を選択':placement?.pad===i?'設置プレビュー中、設備を選択する':'空き地点、押すと設備ショップが開く'}`);b.title=t?`地点${i+1} ${TOWERS[t.type].name} Lv.${t.level} / タップして強化`:`地点${i+1}：押して設置する設備を選択`}}
  function renderQuickTower(){const el=$('quickTower'),pad=game.selectedPad,t=pad>=0?game.towers[pad]:null;el.textContent='';const wrap=document.createElement('div');wrap.className='quick-text';const name=document.createElement('span');name.className='quick-name';const desc=document.createElement('span');desc.className='quick-desc';wrap.append(name,desc);el.append(wrap);
    if(!t){name.textContent=placement?'地点 '+(placement.pad>=0?placement.pad+1:'選択待ち')+'｜仮配置中':'防御設備の設置';desc.textContent=placement?'射程を見て「設置確定」を押してください':'マップ上の＋を押すとショップが開きます';return}
    const base=TOWERS[t.type],next=base.upgrade[t.level-1];name.textContent=`地点 ${pad+1}｜${base.short} Lv.${t.level}/3`;
    const warn=Risk.isOffline(t)?'⚠ 停止（保守が必要）':t.pending?'⌛ 更新作業中':t.supportLeft===0?'⚠ サポート切れ':t.health<40?'⚠ 性能低下':`健全度${t.health}%`;
    desc.textContent=`${warn} ｜ ${t.level===3?'最大強化済み':`次の強化：${next} SP`}`;
    const btn=document.createElement('button');btn.type='button';btn.className='btn btn-primary quick-upgrade-btn';btn.textContent='強化・管理';btn.addEventListener('click',()=>openDrawer('upgrade'));el.append(btn)}
  function renderTraining(){
    const lv=game.trainingLevel,cost=TRAINING_COSTS[lv],effective=Risk.educationSpeed(game.risk,lv,TRAINING_SPEED);
    $('trainingLevel').textContent=`職員教育 Lv.${lv} / 3`;
    $('trainingDesc').textContent=lv===0?'未実施：人的リスク型は通常速度で侵攻。研修で早期発見・報告を促す。':`人的リスク型の進行速度 −${Math.round((1-effective)*100)}%。実施Lv.${lv}／定着した教育Lv.${game.risk.effectiveTraining}。効果が定着しなければ研修しても減速しません。`;
    [...$('trainingBars').children].forEach((b,i)=>b.classList.toggle('done',i<lv));
    const btn=$('trainingBtn');btn.textContent=lv===3?'✓ 教育体制 MAX':`職員教育を強化　${cost} SP`;
    btn.disabled=lv===3||game.sp<cost||['won','lost'].includes(game.phase);
    const r=game.risk;
    $('educationReality').innerHTML=`<span>行動への定着度 <strong>${r.adherence}%</strong></span><div class="risk-healthbar"><i style="width:${r.adherence}%"></i></div><small>実施Lv.${lv} ／ 定着した教育Lv.${r.effectiveTraining}。定着失敗${r.trainingFailures}回。業務負担や報告文化もゲーム上の要因です。</small>`;
    $('followUpBtn').disabled=lv===0||r.mode==='easy'||game.sp<80||(r.adherence>=100&&r.effectiveTraining>=lv)||['won','lost'].includes(game.phase);
  }
  function upgradeTraining(){
    if(tutorial?.active&&!tutorialPermit('training'))return;
    const lv=game.trainingLevel,cost=TRAINING_COSTS[lv];if(lv>=3||game.sp<cost||['won','lost'].includes(game.phase))return;
    game.sp-=cost;game.trainingLevel++;
    const result=Risk.boostEducation(game.risk);
    addLog(`職員教育Lv.${game.trainingLevel}へ（-${cost} SP）／${result.outcome}、定着度${game.risk.adherence}%`);
    toast(`教育Lv.${game.trainingLevel}：実効減速 ${Math.round((1-Risk.educationSpeed(game.risk,game.trainingLevel,TRAINING_SPEED))*100)}%`);
    if(isGuided('education')){closeDrawer({restoreFocus:false});tutorialSetStep('waveReady')}refreshUI()
  }
  function followUpTraining(){
    const r=game.risk;if(tutorial?.active||r.mode==='easy'||game.trainingLevel<1||game.sp<80||(r.adherence>=100&&r.effectiveTraining>=lv)||['won','lost'].includes(game.phase))return;
    game.sp-=80;const gain=Risk.followUp(r,game.trainingLevel);
    addLog(`フォローアップ研修：定着度 +${gain}pt（80 SP）`);toast(`定着度が${r.adherence}%になりました`);refreshUI();
  }
  function investReporting(){
    const r=game.risk,price=reportingCost();
    if(tutorial?.active||r.mode==='easy'||r.reporting>=3||game.sp<price||['won','lost'].includes(game.phase))return;
    game.sp-=price;r.reporting++;r.adherence=Math.min(100,r.adherence+6);
    addLog(`報告体制をLv.${r.reporting}に改善（-${price} SP）。リスク低減・定着維持を支援`);
    toast(`報告体制Lv.${r.reporting}：事故リスクの低減を狙います`);refreshUI();
  }
  function reportingCost(){return [115,160,210][game.risk.reporting]||0}
  function serviceTower(i,kind){
    if(tutorial?.active){toast('保守は通常モードで利用できます');return}
    const t=game.towers[i],r=game.risk;if(!t||['won','lost'].includes(game.phase))return;
    const cfg={maintenance:Risk.maintenanceCost,preventive:Risk.preventiveCost,support:Risk.renewalCost,expedite:Risk.expediteCost};
    if(!(kind in cfg))return;
    const cost=kind==='expedite'?cfg[kind](t):cfg[kind](t,TOWERS);
    if(!cost||game.sp<cost){toast('必要なSPが不足しています');return}
    if(kind==='maintenance'&&t.health>=100)return;
    if(kind==='preventive'&&t.preventive>=2)return;
    if(kind==='support'&&t.supportLeft>=Risk.profile(r).support)return;
    if(kind==='expedite'&&!t.pending)return;
    game.sp-=cost;r.maintenanceInvested+=cost;
    const label={maintenance:'定期・応急保守',preventive:'予防保守',support:'サポート更新',expedite:'追加検証'}[kind];
    if(kind==='maintenance')Risk.doMaintenance(r,t);
    if(kind==='preventive')Risk.doPreventive(r,t);
    if(kind==='support')Risk.doRenewal(r,t);
    if(kind==='expedite'){t.level=Math.max(t.level,t.pending.targetLevel);t.pending=null}
    addLog(`地点${i+1}：${label}（-${cost} SP）`);
    toast(`地点${i+1}：${label}を実施しました`);refreshUI();
  }
  function riskTag(t){return Risk.isOffline(t)?['停止中','danger']:t.pending?['更新待ち','warn']:t.supportLeft===0?['サポート切れ','warn']:t.health<40?['性能低下','warn']:['稼働中',''];}
  function riskActionButton(label,disabled,fn){const b=document.createElement('button');b.className='btn';b.type='button';b.textContent=label;b.disabled=!!disabled;b.addEventListener('click',fn);return b}
  function renderRisk(){
    const r=game.risk,active=game.towers.filter(Boolean),avg=active.length?Math.round(active.reduce((sum,t)=>sum+t.health,0)/active.length):null;
    const problems=active.filter(t=>Risk.isOffline(t)||t.pending||t.health<40||t.supportLeft===0).length;
    const chance=Math.round(Risk.incidentRisk(r,game.towers)*100),finished=['won','lost'].includes(game.phase);
    $('riskChance').textContent=`${chance}% / 波`;
    $('riskHealth').textContent=avg===null?'—':`${avg}%`;
    $('riskAdherence').textContent=`${r.adherence}%`;
    $('riskProblems').textContent=`${problems}件`;
    $('riskChance').className=chance>=42?'is-danger':chance>=22?'is-warning':'';
    $('riskProblems').className=problems>=2?'is-danger':problems===1?'is-warning':'';
    $('difficultySelect').disabled=!!tutorial?.active||game.wave>0||!!placement||game.towers.some(Boolean)||game.trainingLevel>0||r.reporting>0;
    const overview=$('riskOverview');overview.innerHTML=`<div class="risk-kpi"><small>難易度</small><strong>${Risk.profile(r).name}</strong><span>進行中は変更不可</span></div>
      <div class="risk-kpi"><small>次ウェーブの想定事故確率</small><strong>${chance}%</strong><span>1ウェーブにつき最大1回</span></div>
      <div class="risk-kpi"><small>運用予算（残SP）</small><strong>${money(game.sp)} SP</strong><span>設備・保守・研修で共通</span></div>
      <div class="risk-kpi"><small>事故・強化遅延</small><strong>${r.incidents} / ${r.upgradeDelays}</strong><span>発生回数 / 遅延回数</span></div>`;
    const reportCost=reportingCost();
    $('reportingBtn').disabled=r.mode==='easy'||r.reporting>=3||game.sp<reportCost||finished;
    $('reportingBtn').textContent=r.reporting>=3?'✓ 報告体制 MAX':`報告体制 Lv.${r.reporting}/3 → Lv.${r.reporting+1}（${reportCost} SP）`;
    const list=$('riskTowerList');list.textContent='';
    if(!active.length){const div=document.createElement('p');div.className='risk-message';div.textContent='設備はまだありません。マップからタワーを設置すると保守管理ができます。';list.append(div)}
    game.towers.forEach((t,i)=>{if(!t)return;
      const [state,tone]=riskTag(t),card=document.createElement('article');card.className='risk-tower-card'+(Risk.isOffline(t)?' is-offline':t.health<40?' is-damaged':'');
      const head=document.createElement('div');head.className='risk-card-title';const name=document.createElement('div');const b=document.createElement('strong');b.textContent=`地点${String(i+1).padStart(2,'0')} / ${TOWERS[t.type].short} Lv.${t.level}`;
      const sub=document.createElement('small');sub.textContent=`実効Lv.${Risk.effectiveLevel(t)} ・ 健全度 ${t.health}%`;name.append(b,sub);
      const tag=document.createElement('span');tag.className=`risk-tag ${tone}`;tag.textContent=state;head.append(name,tag);card.append(head);
      const bar=document.createElement('div');bar.className='risk-healthbar';const fill=document.createElement('i');fill.style.width=t.health+'%';fill.className=t.health<30?'danger':t.health<65?'warn':'';bar.append(fill);card.append(bar);
      const extra=document.createElement('div');extra.className='risk-extra';extra.textContent=`サポート：${t.supportLeft===0?'期限切れ':`残り${t.supportLeft}ウェーブ`} ｜ 予防保守：${t.preventive}ウェーブ ｜ ${t.pending?'強化作業が次のウェーブ終了時に完了':'更新作業なし'}`;card.append(extra);
      const acts=document.createElement('div');acts.className='risk-actions';
      const maint=Risk.maintenanceCost(t,TOWERS),pre=Risk.preventiveCost(t,TOWERS),support=Risk.renewalCost(t,TOWERS);
      acts.append(riskActionButton(`${Risk.isOffline(t)?'応急':'定期'}保守 ${maint}SP`,finished||r.mode==='easy'||t.health>=100||game.sp<maint,()=>serviceTower(i,'maintenance')));
      acts.append(riskActionButton(`予防保守 ${pre}SP`,finished||r.mode==='easy'||t.preventive>=2||game.sp<pre,()=>serviceTower(i,'preventive')));
      acts.append(riskActionButton(`サポート更新 ${support}SP`,finished||r.mode==='easy'||t.supportLeft>=Risk.profile(r).support||game.sp<support,()=>serviceTower(i,'support')));
      if(t.pending){const exp=Risk.expediteCost(t);acts.append(riskActionButton(`追加検証 ${exp}SP`,finished||game.sp<exp,()=>serviceTower(i,'expedite')))}
      card.append(acts);list.append(card)
    });
  }

  function renderMobilePads(){const el=$('mobilePads');el.textContent='';for(let i=0;i<PADS.length;i++){const t=game.towers[i],btn=document.createElement('button');btn.type='button';btn.className='slot-btn'+(t?' occupied':'')+(game.selectedPad===i?' selected':'');btn.setAttribute('aria-label',`配置場所 ${i+1}：${t?TOWERS[t.type].name:'空き'}`);btn.innerHTML=`<strong>${String(i+1).padStart(2,'0')}</strong><small>${t?TOWERS[t.type].short:'＋ 空き'}</small>`;btn.addEventListener('click',()=>pressPad(i));el.append(btn)}}
  function renderShop(){
    const el=$('shop');el.innerHTML='';
    const placed=placement&&placement.pad>=0;
    $('shopIntro').textContent=placed?`地点 ${placement.pad+1} に設置する設備を選んでください。選択後、射程の円を確認してから確定できます。`:'設備を選ぶとマップに戻ります。空き地点をタップして射程を確認してから確定してください。';
    $('shopLocation').hidden=!placed;
    if(placed)$('shopLocation').textContent=`◉ 選択中の設置地点：No.${String(placement.pad+1).padStart(2,'0')} ｜ 現在 ${game.sp} SP`;
    for(const [idx,id] of Object.keys(TOWERS).entries()){
      const t=TOWERS[id],btn=document.createElement('button');
      btn.type='button';btn.dataset.id=id;
      const active=placement?.type===id;
      btn.className='shop-item'+(active?' active':'')+(game.sp<t.cost?' is-unaffordable':'');
      btn.setAttribute('aria-pressed',String(!!active));
      btn.innerHTML=`<span class="shop-icon">${iconSVG[t.icon]}</span><span class="shop-main"><span class="shop-name">${t.name}</span><span class="shop-desc">${t.desc}</span><span class="shop-extra">射程 <span class="shop-range">${t.range}</span> / Lv.1 ・ 最大Lv.3${game.sp<t.cost?' <span class="shop-warning">（SP不足）</span>':''}</span><span class="shop-range-meter" aria-hidden="true"><i style="width:${Math.round(t.range/180*100)}%;background:${t.color}"></i></span></span><span class="price">${t.cost}<span>SP</span></span><span class="shop-hotkey">${idx+1}</span>`;
      // On desktop, hovering a candidate previews the coverage even while the shop is open.
      btn.addEventListener('pointerenter',()=>{if(placement?.pad>=0){hoverPreviewType=id;btn.dataset.preview='true'}});
      btn.addEventListener('pointerleave',()=>{hoverPreviewType=null;btn.dataset.preview='false'});
      btn.addEventListener('focus',()=>{if(placement?.pad>=0)hoverPreviewType=id});
      btn.addEventListener('blur',()=>{hoverPreviewType=null});
      btn.addEventListener('click',()=>choosePlacementType(id));
      el.append(btn);
    }
  }
  function renderDetail(){const detail=$('detail'),pad=game.selectedPad,tower=pad>=0?game.towers[pad]:null;detail.innerHTML='';if(!tower){detail.innerHTML=`<div class="empty-detail">${game.selectedType?'マップ上の空き地点を押し、ショップで設備を選び、射程を確認してから設置してください。':'配置済みの設備を選ぶと、詳細が表示されます。'}</div>`;return}
    const base=TOWERS[tower.type],s=levelStats(tower),next=base.upgrade[tower.level-1],refund=Math.round(tower.invested*.65);
    const head=document.createElement('div');head.className='detail-title';head.innerHTML=`<span>${base.name}</span><em>LV.${tower.level} / ${MAX_LEVEL}</em>`;detail.append(head);
    const p=document.createElement('div');p.className='detail-desc';p.textContent=base.desc;detail.append(p);const perk=document.createElement('div');perk.className='upgrade-perk';perk.textContent=base.perk;detail.append(perk);
    const metrics=document.createElement('div');metrics.className='detail-metrics';metrics.innerHTML=`<div class="metric"><small>対応強度</small><b>${Math.round(s.damage)}</b></div><div class="metric"><small>対応範囲</small><b>${Math.round(s.range)}</b></div><div class="metric"><small>対応間隔</small><b>${s.rate.toFixed(2)}s</b></div>`;detail.append(metrics);
    const r=game.risk,explain=document.createElement('div');explain.className='risk-detail-status';
    const [tag]=riskTag(tower),chance=Math.round(Risk.upgradeChance(r,tower)*100);
    explain.innerHTML=`<strong>運用状態：${tag}</strong><div>健全度 ${tower.health}% ｜ 実効Lv.${s.effectiveLevel} ｜ 防御効率 ${Math.round(s.impact*100)}%</div><div>サポート ${tower.supportLeft===0?'期限切れ':`残${tower.supportLeft}ウェーブ`} ／ 予防保守 ${tower.preventive}ウェーブ</div><div>強化即時成功率：${tower.pending?'更新待ち':chance+'%'}（遅延時も費用は支払済み・追加請求なし）</div></div>`;
    detail.append(explain);
    const actions=document.createElement('div');actions.className='detail-actions';
    const up=document.createElement('button');up.className='btn btn-primary';up.type='button';up.textContent=tower.pending?'⌛ 更新作業中':tower.level===MAX_LEVEL?'✓ MAX LEVEL':`↑ 強化 ${next} SP`;up.disabled=tower.level===MAX_LEVEL||!!tower.pending||game.sp<next||game.phase==='won'||game.phase==='lost';up.addEventListener('click',()=>upgradeTower(pad));
    const sell=document.createElement('button');sell.className='btn';sell.type='button';sell.textContent=`売却 +${refund} SP`;sell.disabled=game.phase==='won'||game.phase==='lost';sell.addEventListener('click',()=>sellTower(pad));actions.append(up,sell);detail.append(actions);
    const maintenance=document.createElement('div');maintenance.className='risk-detail-actions';
    const mCost=Risk.maintenanceCost(tower,TOWERS),pCost=Risk.preventiveCost(tower,TOWERS),sCost=Risk.renewalCost(tower,TOWERS);
    const easy=r.mode==='easy';
    maintenance.append(riskActionButton(`保守 ${mCost}SP`,easy||tower.health>=100||game.sp<mCost||['won','lost'].includes(game.phase),()=>serviceTower(pad,'maintenance')),
      riskActionButton(`予防保守 ${pCost}SP`,easy||tower.preventive>=2||game.sp<pCost||['won','lost'].includes(game.phase),()=>serviceTower(pad,'preventive')),
      riskActionButton(`サポート更新 ${sCost}SP`,easy||tower.supportLeft>=Risk.profile(r).support||game.sp<sCost||['won','lost'].includes(game.phase),()=>serviceTower(pad,'support')));
    if(tower.pending){const extra=Risk.expediteCost(tower);maintenance.append(riskActionButton(`追加検証 ${extra}SP`,game.sp<extra||['won','lost'].includes(game.phase),()=>serviceTower(pad,'expedite')))}
    detail.append(maintenance)

  }
  function refreshUI(){
    $('waveLimitValue').textContent=game.waveLimit;
    $('gameSessionMode').textContent=tutorial?.active?'TUTORIAL':Risk.profile(game.risk).name;
    $('gameSessionWaves').textContent=game.waveLimit+' WAVE';
    $('integrityValue').textContent=Math.max(0,Math.round(game.integrity));$('privacyValue').textContent=Math.max(0,Math.round(game.privacy));$('spValue').textContent=money(game.sp);$('waveValue').textContent=game.wave;$('scoreValue').textContent=money(game.score);
    for(const [key,bar] of [['integrity',$('integrityBar')],['privacy',$('privacyBar')]]){const val=Math.max(0,Math.min(100,game[key]));bar.style.width=val+'%';bar.style.background=val<25?'var(--red)':val<55?'var(--amber)':'var(--teal)'}
    const active=game.phase==='active',finished=game.phase==='won'||game.phase==='lost';
    const phaseNames={ready:'配置準備中',active:game.paused?'一時停止中':'防衛中',intermission:'強化フェーズ',won:'防衛成功',lost:'ミッション失敗'};
    $('phaseText').textContent=phaseNames[game.phase];$('phaseBadge').className='mini-status '+(active?'is-active':game.phase==='lost'?'is-failed':'');
    $('mapMessage').textContent=game.phase==='won'?'MISSION COMPLETE':game.phase==='lost'?'MISSION FAILED':active?`WAVE ${game.wave} / ACTIVE`:game.wave===0?'WAVE 1 / STANDBY':`WAVE ${Math.min(game.wave+1,game.waveLimit)} / STANDBY`;
    $('startBtn').disabled=active||finished||game.wave>=game.waveLimit||!!placement;$('startBtn').textContent=game.wave===0?'▶ ウェーブ 1 開始':game.phase==='intermission'?`▶ ウェーブ ${game.wave+1} 開始`:'▶ ウェーブ開始';
    $('pauseBtn').disabled=!active||!!placement;$('pauseBtn').textContent=placement&&active?'◎ 設置中は停止':game.paused?'▶ 再開':'Ⅱ 一時停止';
    $('speedBtn').textContent=game.speed===1?'×1 通常速度':'×2 倍速';
    $('bcpBtn').disabled=finished||game.sp<BCP_COST||game.integrity>=100||game.bcpUsed;$('bcpBtn').textContent=game.bcpUsed?'✓ BCP使用済み':`▣ BCP発動（${BCP_COST} SP）`;
    const current=WAVE_DEFS[game.wave-1],upcoming=WAVE_DEFS[game.wave];
    $('waveLabel').textContent=active?`進行中：${current.title}`:game.phase==='intermission'&&upcoming?`次：${upcoming.title}`:game.phase==='won'?'全ウェーブ防衛完了':game.phase==='lost'?'病院の防衛機能が停止':upcoming?`次：${upcoming.title}`:'最終結果';
    $('waveCounter').textContent=active?`${game.spawned} / ${game.spawnTotal} 出現・残 ${game.enemies.length}`:game.phase==='intermission'?`${game.wave} / ${game.waveLimit} クリア`:game.phase==='won'?`${game.waveLimit} / ${game.waveLimit}`:game.phase==='lost'?`${game.wave} / ${game.waveLimit}`:`0 / ${game.waveLimit}`;
    $('waveProgress').style.width=(active&&game.spawnTotal?game.spawned/game.spawnTotal*100:game.phase==='won'?100:0)+'%';
    renderShop();renderDetail();renderMobilePads();renderQuickTower();renderTraining();syncPadButtons();renderPlacementBar();renderRisk();
    // Landscape control rail mirrors the existing HUD values without changing game logic.
    for(const [from,to] of [['riskChance','sideRiskChance'],['riskHealth','sideRiskHealth'],['riskAdherence','sideRiskAdherence'],['riskProblems','sideRiskProblems']]){
      $(to).textContent=$(from).textContent;
    }
    tutorialRender();
  }
  function upgradeTower(i){
    if(tutorial?.active&&!tutorialPermit('towerUpgrade',i))return;
    const t=game.towers[i];if(!t||t.pending||t.level>=MAX_LEVEL)return;
    const cost=TOWERS[t.type].upgrade[t.level-1];if(game.sp<cost){toast('SPが足りません');return}
    game.sp-=cost;t.invested+=cost;
    const outcome=Risk.doUpgrade(game.risk,t,cost);
    if(outcome.succeed){addLog(`${TOWERS[t.type].short}をLv.${t.level}に強化（-${cost} SP）`);toast('設備の強化が完了しました')}
    else{addLog(`地点${i+1}：更新作業に遅延が発生。強化費用${cost} SPは支払済み。次ウェーブ後に完了`,'warn');toast('導入トラブル：追加の費用なしで次ウェーブ終了後に完了')}
    if(isGuided('upgrade')){closeDrawer({restoreFocus:false});tutorialSetStep('educationOpen')}refreshUI()
  }
  function sellTower(i){if(tutorial?.active){toast('操作練習では売却せずに進めてください');return}const t=game.towers[i];if(!t)return;const amount=Math.round(t.invested*.65);game.sp+=amount;addLog(`${TOWERS[t.type].name}を売却（+${amount} SP）`);game.towers[i]=null;game.selectedPad=-1;refreshUI()}
  function startWave(){if(tutorial?.active&&!tutorialPermit('wave'))return;if(placement)return;if(game.phase!=='ready'&&game.phase!=='intermission')return;if(game.wave>=game.waveLimit)return;game.wave++;const wave=WAVE_DEFS[game.wave-1];game.phase='active';game.queue=(isGuided('waveReady')?['phish','phish','auth','phish']:wave.units.slice());game.spawned=0;game.waveEvents=(tutorial?.active?[]:(EVENT_PLANS[game.wave]||[]).map(e=>({...e,at:e.at+(Risk.rand(game.risk)-.5)*1.5,fired:false})));
    if(!tutorial?.active){const inc=Risk.planIncident(game.risk,game.towers);if(inc)game.waveEvents.push({at:inc.at,kind:'risk',scenario:inc.type,count:0,fired:false});}game.spawnTotal=game.queue.length+game.waveEvents.reduce((sum,e)=>sum+e.count,0);game.spawnIndex=0;game.spawnTimer=.12;game.time=0;game.paused=false;game.bcpUsed=false;if(isGuided('waveReady'))tutorialSetStep('waveActive');addLog(`WAVE ${game.wave}：${tutorial?.active?'練習ウェーブ':wave.title} が始まりました。`,'warn');toast(`${wave.title}：${wave.subtitle}`);refreshUI()}
  function spawnEnemy(kind,route='main',startFraction=0){const e=ENEMIES[kind],w=WAVE_DEFS[game.wave-1],routeLen=route==='side'?SECONDARY.total:PRIMARY.total,health=Math.round(e.hp*w.hpMult);game.enemies.push({kind,route,distance:routeLen*startFraction,hp:health,maxHp:health,slowLeft:0,flash:0,uid:Math.random()});game.spawned++}
  function fireEvent(e){e.fired=true;
    if(e.kind==='risk'){
      const result=Risk.applyIncident(game.risk,game.towers,e.scenario);
      game.integrity=Math.max(0,game.integrity-result.integrityLoss);
      game.privacy=Math.max(0,game.privacy-result.privacyLoss);
      game.notice=`運用リスク：${result.title}`;game.noticeLeft=5;
      addLog(`${result.title}：${result.message}`,result.noticeKind);
      toast(result.title);refreshUI();
      if(game.integrity<=0||game.privacy<=0)finish(false);
      return;
    }
    if(e.kind==='route'){game.sideRouteOpen=true;for(let j=0;j<e.count;j++)spawnEnemy(j%3===0?'malware':'auth','side',j*.05);game.notice=`新たな侵入ルート発生！ 別ルートから ${e.count} 件`;addLog(`新規経路が出現：別ルートから${e.count}件が接近`,'danger');}
    else{let detected=0,arrived=0;for(let j=0;j<e.count;j++){
      if(Risk.preventHuman(game.risk,game.trainingLevel)){detected++;game.spawnTotal--}
      else{spawnEnemy('insider','main',.62+Math.min(j*.025,.08));arrived++}}
      game.notice=detected?`人的リスク：${detected}件を早期報告／${arrived}件が進行`:`人的リスク発生！ 内部付近に ${arrived} 件`;
      addLog(`人的リスク：発見・報告${detected}件／進行${arrived}件`,'warn');}
    game.noticeLeft=4.2;toast(game.notice);refreshUI()}

  function activateBCP(){if(tutorial?.active){toast('BCPは通常モードで試せます');return}if(game.phase==='won'||game.phase==='lost'||game.bcpUsed||game.integrity>=100||game.sp<BCP_COST)return;game.sp-=BCP_COST;game.integrity=Math.min(100,game.integrity+BCP_HEAL);game.bcpUsed=true;addLog('BCP：代替運用で診療継続度を一部回復（-130 SP）');toast('BCPを発動：診療継続度を一部回復');refreshUI()}
  function update(dt){visualT+=dt;for(const effect of game.effects)effect.life-=dt;game.effects=game.effects.filter(e=>e.life>0);if(game.phase!=='active'||game.paused)return;
    const delta=Math.min(.065,dt)*game.speed;game.time+=delta;game.spawnTimer-=delta;game.noticeLeft=Math.max(0,game.noticeLeft-delta);
    const wave=WAVE_DEFS[game.wave-1];
    while(game.spawnIndex<game.queue.length&&game.spawnTimer<=0){spawnEnemy(game.queue[game.spawnIndex++]);game.spawnTimer+=wave.interval}for(const event of game.waveEvents){if(!event.fired&&game.time>=event.at)fireEvent(event)}if(game.phase!=='active')return;
    for(let i=game.enemies.length-1;i>=0;i--){const enemy=game.enemies[i],base=ENEMIES[enemy.kind];enemy.slowLeft=Math.max(0,enemy.slowLeft-delta);enemy.flash=Math.max(0,enemy.flash-delta);enemy.distance+=(base.speed*(enemy.slowLeft>0?.61:1)*(enemy.kind==='insider'?Risk.educationSpeed(game.risk,game.trainingLevel,TRAINING_SPEED):1))*delta*routeTravelScale[enemy.route];if(enemy.distance>=(enemy.route==='side'?SECONDARY.total:TOTAL_PATH)-20){game.enemies.splice(i,1);game.integrity=Math.max(0,game.integrity-base.damage);game.privacy=Math.max(0,game.privacy-base.leak);game.leaks++;refreshUI();const p=posAt((enemy.route==='side'?SECONDARY.total:TOTAL_PATH)-28,enemy.route);game.effects.push({type:'breach',x:p.x,y:p.y,life:.7,max:.7});addLog(`侵入を許しました：診療 -${base.damage} / 保護 -${base.leak}`,'danger');if(game.integrity<=0||game.privacy<=0){finish(false);return}}}
    for(let i=0;i<game.towers.length;i++){const tower=game.towers[i];if(!tower||Risk.isOffline(tower))continue;tower.cooldown-=delta;if(tower.cooldown>0)continue;const base=TOWERS[tower.type],s=levelStats(tower),pad=PADS[i];let target=null;
      for(const enemy of game.enemies){const p=posAt(enemy.distance,enemy.route);if(Math.hypot(p.x-pad.x,p.y-pad.y)<=s.range+ENEMIES[enemy.kind].radius){if(!target||enemy.distance/(enemy.route==='side'?SECONDARY.total:TOTAL_PATH)>target.distance/(target.route==='side'?SECONDARY.total:TOTAL_PATH))target=enemy}}
      if(target){tower.cooldown=s.rate;const ep=posAt(target.distance,target.route),lv=tower.level-1,special=(tower.type==='mail'&&target.kind==='phish')||(tower.type==='mfa'&&target.kind==='auth')||(tower.type==='edr'&&(target.kind==='malware'||target.kind==='insider'));
        const impact=s.damage*(base.vs[target.kind]||1)*(special?1+lv*.22:1);target.hp-=impact;target.flash=.14;if(base.slow)target.slowLeft=Math.max(target.slowLeft,base.slow+lv*.48);game.effects.push({type:'beam',from:{x:pad.x,y:pad.y},to:ep,color:base.color,life:.16,max:.16});if(target.hp<=0){game.enemies.splice(game.enemies.indexOf(target),1);const targetInfo=ENEMIES[target.kind];game.sp+=targetInfo.reward;game.score+=targetInfo.reward*10;game.kills++;if(game.selectedPad>=0){renderDetail();renderQuickTower()}renderTraining();$('bcpBtn').disabled=game.bcpUsed||game.integrity>=100||game.sp<BCP_COST;game.effects.push({type:'burst',x:ep.x,y:ep.y,color:targetInfo.color,life:.47,max:.47});}}
      else tower.cooldown=0;
    }
    if(game.spawnIndex>=game.queue.length&&game.waveEvents.every(e=>e.fired)&&game.enemies.length===0){game.sp+=wave.bonus;game.score+=Math.round((game.integrity+game.privacy)*6);
      const changes=tutorial?.active?[]:Risk.advanceWave(game.risk,game.towers);
      addLog(`WAVE ${game.wave} 突破！ ボーナス +${wave.bonus} SP`);
      for(const change of changes)addLog(change,'warn');if(isGuided('waveActive')){game.phase='intermission';tutorialSetStep('complete');toast('操作練習を修了しました！ メニューへ戻って本編を始めましょう。')}else if(game.wave===game.waveLimit)finish(true);else{game.phase='intermission';toast(`WAVE ${game.wave} クリア！ +${wave.bonus} SP：設備を強化して次へ`)}refreshUI()}
  }
  function finish(success){game.phase=success?'won':'lost';game.paused=false;if(success){game.score+=Math.round(game.integrity*15+game.privacy*15);addLog('最終ウェーブ突破！病院の防衛成功。')}else addLog('診療継続度または情報保護度が0になりました。','danger');refreshUI();showResult(success)}
  function fitCanvas(){if(!ctx)return;const rect=canvas.getBoundingClientRect();if(!rect.width)return;const ratio=Math.min(2.5,window.devicePixelRatio||1);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.width*H/W*ratio);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0)}
  function roundRect(x,y,w,h,r,fill,stroke,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function line(a,b,c,w=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke()}
  function disc(x,y,r,fill,stroke,lw=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function text(t,x,y,color='#e8f4fa',size=12,align='left',weight=650){ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(t,x,y)}
  function drawBackground(){
    const bg=ctx.createLinearGradient(0,0,960,560);bg.addColorStop(0,'#0f2130');bg.addColorStop(.7,'#0b1b2c');bg.addColorStop(1,'#102739');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.lineWidth=.7;ctx.strokeStyle='#2b43534d';for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    for(const zone of [{x:10,y:11,w:220,h:110,name:'01 / EXTERNAL ZONE'},{x:274,y:16,w:327,h:103,name:'02 / AUTH & MONITOR'},{x:641,y:292,w:307,h:254,name:'03 / CLINICAL CORE'}]){roundRect(zone.x,zone.y,zone.w,zone.h,11,'#2d71820b','#4a89942f');text(zone.name,zone.x+12,zone.y+16,'#698ca0',10,'left',750)}
    // Decorative telemetry.
    ctx.strokeStyle='#25637635';ctx.lineWidth=1;for(let i=0;i<11;i++){const x=35+i*85,y=490+Math.sin(i*1.35)*13;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+35,y);ctx.stroke();disc(x,y,2,'#416c7c')}
  }
  function drawPath(){
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(PATH[0].x,PATH[0].y);for(let i=1;i<PATH.length;i++)ctx.lineTo(PATH[i].x,PATH[i].y);
    ctx.strokeStyle='#02111e';ctx.lineWidth=47;ctx.stroke();ctx.strokeStyle='#2c4a5d';ctx.lineWidth=41;ctx.stroke();ctx.strokeStyle='#42697a';ctx.lineWidth=33;ctx.stroke();ctx.strokeStyle='#1a3145';ctx.lineWidth=29;ctx.stroke();
    ctx.setLineDash([5,11]);ctx.lineDashOffset=-visualT*20;ctx.strokeStyle='#83bac980';ctx.lineWidth=2.6;ctx.stroke();ctx.setLineDash([]);ctx.restore();
    // Direction marks.
    for(let d=75;d<TOTAL_PATH-70;d+=115){const p=posAt(d),p2=posAt(d+9),angle=Math.atan2(p2.y-p.y,p2.x-p.x);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(1,0);ctx.lineTo(-5,5);ctx.strokeStyle='#76bdc6a3';ctx.lineWidth=1.8;ctx.stroke();ctx.restore()}
    // Keep the visible entry and protected goal aligned to the actual route endpoints.
    const entry=PATH[0],goal=PATH[PATH.length-1];
    disc(entry.x,entry.y,28,'#5d263d80','#ff7b96',2);disc(entry.x,entry.y,19,'#a63b55b8');text('!',entry.x,entry.y-1,'#fff',20,'center',900);text('外部侵入口',entry.x,entry.y+51,'#e4a2b0',11,'center',800);
    roundRect(goal.x-44,goal.y-52,88,104,11,'#1b374e','#ffd487',2);roundRect(goal.x-33,goal.y-37,66,68,5,'#284e60','#9bc9c6',1);for(let k=0;k<3;k++){roundRect(goal.x-24,goal.y-27+k*16,49,9,2,'#0f3347','#6ba9ab',.7);disc(goal.x+17,goal.y-23+k*16,2.5,'#4bdcc0')}
    text('病院システム',goal.x,goal.y-60,'#ffdd9e',12,'center',750);text('保護対象',goal.x,goal.y+64,'#8daeba',11,'center',650);
  }
  function drawSideRoute(){if(!game.sideRouteOpen)return;ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(SIDE_PATH[0].x,SIDE_PATH[0].y);for(let i=1;i<SIDE_PATH.length;i++)ctx.lineTo(SIDE_PATH[i].x,SIDE_PATH[i].y);ctx.strokeStyle='#46203b';ctx.lineWidth=34;ctx.stroke();ctx.strokeStyle='#9d4162';ctx.lineWidth=27;ctx.stroke();ctx.strokeStyle='#291c3a';ctx.lineWidth=21;ctx.stroke();ctx.setLineDash([6,10]);ctx.lineDashOffset=visualT*20;ctx.strokeStyle='#ffb3bd';ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([]);ctx.restore();
    const entry=SIDE_PATH[0];roundRect(entry.x-125,entry.y-37,129,25,7,'#58283dcc','#ef839b',1.3);text('⚠ 新侵入ルート',entry.x-61,entry.y-24,'#ffdbe3',11,'center',800);}
  function drawPadIcon(type,x,y,color){ctx.save();ctx.translate(x,y);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';if(type==='mail'){roundRect(-11,-8,22,16,3,null,color,1.8);ctx.beginPath();ctx.moveTo(-10,-7);ctx.lineTo(0,1);ctx.lineTo(10,-7);ctx.stroke()}
    else if(type==='mfa'){disc(-4,-4,5,null,color,2);ctx.beginPath();ctx.moveTo(-1,0);ctx.lineTo(9,10);ctx.moveTo(4,5);ctx.lineTo(7,2);ctx.stroke()}
    else if(type==='edr'){disc(0,0,10,null,color,1.7);disc(0,0,4,null,color,1.7);ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(0,-8);ctx.moveTo(0,8);ctx.lineTo(0,13);ctx.moveTo(-13,0);ctx.lineTo(-8,0);ctx.moveTo(8,0);ctx.lineTo(13,0);ctx.stroke()}
    else{disc(0,-8,4,null,color,1.8);disc(-10,8,4,null,color,1.8);disc(10,8,4,null,color,1.8);ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(0,3);ctx.lineTo(-10,3);ctx.lineTo(-10,4);ctx.moveTo(0,3);ctx.lineTo(10,3);ctx.lineTo(10,4);ctx.stroke()}ctx.restore()}
  function drawPads(){for(let i=0;i<PADS.length;i++){const p=PADS[i],tower=game.towers[i],selected=game.selectedPad===i,hover=hoverPad===i;if(!tower){disc(p.x,p.y,25,hover?'#23615d':'#142f3d',hover?'#66f5dd':'#427080',hover?2.7:1.5);disc(p.x,p.y,18,null,'#315469',1);ctx.strokeStyle=hover?'#8cffe7':'#7095a6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.lineTo(p.x+7,p.y);ctx.moveTo(p.x,p.y-7);ctx.lineTo(p.x,p.y+7);ctx.stroke();}
      else{const base=TOWERS[tower.type],s=levelStats(tower);if(selected||hover){ctx.save();ctx.setLineDash([5,7]);disc(p.x,p.y,s.range,null,base.color+'7a',1.4);ctx.restore()}
        disc(p.x,p.y,28,'#071724',selected?'#e5fefe':base.color,selected?2.7:1.7);disc(p.x,p.y,22,'#20435a',base.color+'80',1);disc(p.x,p.y,16,base.color+'23');drawPadIcon(tower.type,p.x,p.y,base.color);
        for(let j=0;j<tower.level;j++){disc(p.x-10+j*10,p.y+34,2.6,base.color)}
        if(game.risk.mode!=='easy'){
          const statusColor=Risk.isOffline(tower)?'#ff778f':tower.health<40||tower.supportLeft===0?'#ffcb79':'#4de1bf';
          roundRect(p.x-17,p.y+40,34,4,2,'#1d3040');roundRect(p.x-17,p.y+40,34*tower.health/100,4,2,statusColor);
          if(tower.pending)text('⌛',p.x,p.y-37,'#ffdd92',17,'center',900);
          else if(Risk.isOffline(tower))text('×',p.x,p.y-36,'#ff7d93',19,'center',900);
        }
      }
      if(selected&&!tower){disc(p.x,p.y,32,null,'#7afbe4',2)}
      text(String(i+1).padStart(2,'0'),p.x+22,p.y-25,'#7095a8',10,'center',750)
    }}
  function drawPlacementPreview(){
    if(!placement||placement.pad<0)return;
    const type=hoverPreviewType||placement.type;
    if(!type||!TOWERS[type])return;
    const base=TOWERS[type],pad=PADS[placement.pad],radius=base.range;
    ctx.save();
    ctx.beginPath();ctx.arc(pad.x,pad.y,radius,0,Math.PI*2);
    ctx.fillStyle=base.color+'22';ctx.fill();
    ctx.save();ctx.clip();ctx.lineWidth=5;ctx.lineCap='round';ctx.strokeStyle=base.color+'d0';
    for(const nodes of [PATH,...(game.sideRouteOpen?[SIDE_PATH]:[])]){
      ctx.beginPath();ctx.moveTo(nodes[0].x,nodes[0].y);
      for(let i=1;i<nodes.length;i++)ctx.lineTo(nodes[i].x,nodes[i].y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.setLineDash([9,7]);ctx.lineWidth=3;ctx.strokeStyle=base.color;ctx.shadowColor=base.color;ctx.shadowBlur=18;
    ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;
    disc(pad.x,pad.y,28,'#123f49dd',base.color,2.6);
    drawPadIcon(type,pad.x,pad.y,base.color);
    const x=Math.max(90,Math.min(W-90,pad.x)),y=Math.max(58,Math.min(H-39,pad.y-radius-19));
    roundRect(x-74,y-14,148,28,8,'#07202eea',base.color,1.2);
    text(`仮配置 / 射程 ${radius}`,x,y+1,'#efffff',12,'center',850);
    ctx.restore();
  }
  function drawEnemies(){for(const enemy of game.enemies){const e=ENEMIES[enemy.kind],p=posAt(enemy.distance,enemy.route),r=e.radius;ctx.save();ctx.shadowColor=e.color;ctx.shadowBlur=enemy.kind==='boss'?23:12;disc(p.x,p.y,r,enemy.flash>0?'#fff7df':'#1d2134',e.color,enemy.kind==='boss'?3.5:2.2);ctx.restore();ctx.save();ctx.translate(p.x,p.y);
      if(enemy.kind==='phish'){ctx.strokeStyle=e.color;ctx.lineWidth=1.8;roundRect(-7,-5,14,10,2,null,e.color,1.7);ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(0,1);ctx.lineTo(7,-5);ctx.stroke()}
      else if(enemy.kind==='auth'){ctx.strokeStyle=e.color;ctx.lineWidth=2;disc(-3,-3,3,null,e.color,1.8);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(7,7);ctx.moveTo(3,3);ctx.lineTo(6,0);ctx.stroke()}
      else if(enemy.kind==='malware'||enemy.kind==='insider'){ctx.fillStyle=e.color;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(7,0);ctx.lineTo(0,8);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();disc(0,0,2,'#1c1b33');if(enemy.kind==='insider'){text('!',0,-1,'#24131c',10,'center',900);disc(10,-9,4,'#f7c77f')}}
      else{ctx.strokeStyle=e.color;ctx.lineWidth=2.6;for(let i=0;i<8;i++){const a=i*Math.PI/4+visualT*.7;ctx.beginPath();ctx.moveTo(Math.cos(a)*18,Math.sin(a)*18);ctx.lineTo(Math.cos(a)*24,Math.sin(a)*24);ctx.stroke()}text('!',0,1,'#ffeaf0',19,'center',900)}ctx.restore();
      const barW=enemy.kind==='boss'?49:29;roundRect(p.x-barW/2,p.y-r-12,barW,4,2,'#02101b');roundRect(p.x-barW/2,p.y-r-12,barW*Math.max(0,enemy.hp/enemy.maxHp),4,2,e.color);
      if(enemy.slowLeft>0)disc(p.x+r*.65,p.y-r*.6,4,'#cc98f8')
    }}
  function drawEffects(){for(const fx of game.effects){const q=fx.life/fx.max;ctx.save();ctx.globalAlpha=Math.max(0,q);if(fx.type==='beam'){ctx.shadowColor=fx.color;ctx.shadowBlur=15;line(fx.from,fx.to,fx.color,4.2);line(fx.from,fx.to,'#fff',1.3);disc(fx.to.x,fx.to.y,5,fx.color)}else if(fx.type==='burst'){disc(fx.x,fx.y,26*(1-q)+5,null,fx.color,2.6)}else if(fx.type==='breach'){disc(fx.x,fx.y,45*(1-q)+10,null,'#ff6585',4)}ctx.restore()}}
  function drawHUD(){
    roundRect(16,14,242,34,9,'#071728c9','#285367aa');text('HOSPITAL CYBER DEFENSE',30,31,'#a8d6da',11,'left',820);
    if(game.phase==='intermission'||game.phase==='ready'){roundRect(347,19,270,34,8,'#0a2d30cf','#3c8173a3');text(game.phase==='ready'?'防御設備を配置して開始':'保守・強化を確認して次のウェーブへ',482,36,'#7ce6cf',12,'center',770)}
    if(game.noticeLeft>0){roundRect(280,67,405,36,9,'#5b2b3ce5','#fa8394',1.5);text(game.notice,482,85,'#ffe1e8',14,'center',800)}
    if(game.paused&&!placement){ctx.fillStyle='#03111c9e';ctx.fillRect(0,0,W,H);roundRect(355,235,250,85,12,'#0f2a3adf','#65c9c8',2);text('Ⅱ  一時停止中',480,279,'#d9f9f6',24,'center',850)}
    else if(game.paused&&placement){roundRect(15,53,207,27,7,'#1a4850d9','#48d9c7',1);text('配置中は自動一時停止',26,67,'#b2faec',11,'left',800)}
  }
  function render(){if(!ctx)return;ctx.clearRect(0,0,W,H);drawBackground();drawPath();drawSideRoute();drawPads();drawEnemies();drawPlacementPreview();drawEffects();drawHUD()}
  function frame(ts){if($('gameShell').hidden){lastTime=ts;raf=requestAnimationFrame(frame);return}if(!lastTime)lastTime=ts;const dt=Math.min(.065,Math.max(0,(ts-lastTime)/1000));lastTime=ts;update(dt);render();if(game.phase==='active'&&!game.paused&&ts%180<17){ // cheap HUD updates between expensive DOM changes
      $('spValue').textContent=money(game.sp);$('scoreValue').textContent=money(game.score);$('waveCounter').textContent=`${game.spawned} / ${game.spawnTotal} 出現・残 ${game.enemies.length}`;$('waveProgress').style.width=(game.spawnTotal?100*game.spawned/game.spawnTotal:0)+'%';
    }
    raf=requestAnimationFrame(frame)}
  function handleBoard(e){if(game.phase==='won'||game.phase==='lost')return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*W,y=(e.clientY-rect.top)/rect.height*H;let near=-1,dist=36;for(let i=0;i<PADS.length;i++){const d=Math.hypot(PADS[i].x-x,PADS[i].y-y);if(d<dist){dist=d;near=i}}
    if(near<0){if(!placement){game.selectedPad=-1;renderDetail();renderQuickTower();syncPadButtons()}return}pressPad(near)}
  function moveHover(e){const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*W,y=(e.clientY-rect.top)/rect.height*H;let near=-1,dist=30;for(let i=0;i<PADS.length;i++){const d=Math.hypot(PADS[i].x-x,PADS[i].y-y);if(d<dist){dist=d;near=i}}hoverPad=near;canvas.style.cursor=near>=0?'pointer':'crosshair'}
  let lastFocus=null;
  function closeModal(){const backdrop=$('modalBackdrop');backdrop.classList.remove('open');backdrop.dataset.restorePause='0';if(lastFocus&&lastFocus.isConnected)lastFocus.focus()}
  function openModal(title,bodyHTML,buttons,closable=true){$('modalBackdrop').dataset.restorePause='0';lastFocus=document.activeElement;$('modalTitle').textContent=title;$('modalBody').innerHTML=bodyHTML;$('modalButtons').innerHTML='';$('modalClose').style.visibility=closable?'visible':'hidden';for(const b of buttons){const btn=document.createElement('button');btn.className='btn '+(b.primary?'btn-primary':'');btn.textContent=b.label;btn.addEventListener('click',()=>{closeModal();b.action?.()});$('modalButtons').append(btn)}$('modalBackdrop').classList.add('open');$('modalButtons').querySelector('button')?.focus()}
  function showHelp(){if(placement)cancelPlacement({quiet:true});closeDrawer({restoreFocus:false});const wasActive=game.phase==='active'&&!game.paused;if(wasActive)game.paused=true;refreshUI();openModal('遊び方・作戦ガイド',`<p>あなたは架空の病院の防衛担当者。<strong>診療継続度と情報保護度を保ちながら、${game.waveLimit}ウェーブを突破</strong>してください。</p><ul><li>マップ上の <strong>空き地点＋</strong> を押すとその地点のショップが開きます。設備を選び、<strong>カバー範囲の円を確認してから「設置確定」</strong>してください</li><li>ショップボタンから先に設備を選ぶ方法も利用できます。仮配置の段階ではSPは消費されません</li><li><strong>▶ ウェーブ開始</strong>で敵が出現。設備は自動で迎撃</li><li>撃退でSPを獲得。<strong>どの防御設備も</strong>配置地点を再度タップしてLv.3まで強化できます</li><li>配置済みの設備をタップすると <strong>強化スライドパネル</strong> が開きます（最大Lv.3）</li><li><strong>ショップ／強化／職員教育／ログ</strong> は上部ボタンから開閉でき、Escでも閉じられます</li><li>メール対策はフィッシング、MFAは認証系、EDRはマルウェアに強い</li><li>ネットワーク分離は敵の進行を一時的に遅くします</li><li>第2ウェーブ以降、手順逸脱を想定した人的リスクが<strong>マップ途中に突然出現</strong>します</li><li>第3ウェーブ以降は<strong>別の侵入ルート</strong>が突然発生。上側の防衛も必要です</li><li><strong>職員教育（全体強化）</strong>で人的リスク型の侵攻が遅くなります</li><li>BCPは診療継続度のみ一部回復（ウェーブごとに1回まで）</li><li>設備は65%返金で売却可能。途中で一時停止・倍速もできます</li><li><strong>運用管理</strong>：NORMAL/HARDでは設備の健全度がウェーブごとに低下し、保守・予防保守・サポート更新が必要です</li><li>強化は成功が保証されず、遅延した場合は次ウェーブの終了後に完了します（追加検証で即時完了も可能）</li><li>職員教育の効果は定着度に依存します。フォローアップ研修・報告体制の改善で効果を維持してください</li><li><strong>次ウェーブの事故リスク</strong>は運用管理で確認でき、予防措置で確率を下げられます</li></ul><p style="font-size:11px">※ このゲームは教育向けに対策効果を抽象化しています。実際のサイバー攻撃手順や病院の設備構成は再現していません。</p>`,[{label:'ゲームに戻る',primary:true,action:()=>{if(wasActive){game.paused=false;refreshUI()}}}],true);
    // Restore pause state when closing by backdrop or ×, too.
    $('modalBackdrop').dataset.restorePause=wasActive?'1':'0';}
  function showResult(win){const grade=win?(game.integrity>=85&&game.privacy>=85?'S':game.integrity>=60&&game.privacy>=60?'A':'B'):'—';$('modalIcon').textContent=win?'★':'!';$('modalIcon').style.color=win?'var(--teal)':'var(--red)';const body=`<p>${win?'全'+game.waveLimit+'ウェーブを防衛しました。設備の組み合わせと投資判断が成果につながりました。':'診療継続度または情報保護度が0になりました。防衛設備の配置や強化順を見直しましょう。'}</p><div class="result-grid"><div><small>総合評価</small><strong>${grade}</strong></div><div><small>防衛スコア</small><strong>${money(game.score)}</strong></div><div><small>撃退数</small><strong>${game.kills}</strong></div><div><small>診療継続</small><strong>${Math.round(game.integrity)}%</strong></div><div><small>情報保護</small><strong>${Math.round(game.privacy)}%</strong></div><div><small>侵入数</small><strong>${game.leaks}</strong></div></div><p style="font-size:11px">難易度：${Risk.profile(game.risk).name} ／ 運用インシデント：${game.risk.incidents}件 ／ 強化遅延：${game.risk.upgradeDelays}回 ／ 教育定着失敗：${game.risk.trainingFailures}回 ／ 保守・更新投資：${game.risk.maintenanceInvested} SP ／ 最終定着度：${game.risk.adherence}%</p><p style="font-size:11px">ふりかえり：どの脅威に対して防御が不足したか、限られたSPをどう配分すべきだったか考えてみましょう。</p>`;
    openModal(win?'防衛成功！ ミッション完了':'防衛失敗 — 再挑戦しよう',body,[{label:'同じ設定でもう一度',primary:true,action:resetGame},{label:'メニューへ戻る',action:returnToMenuNow},{label:'結果を確認',action:()=>{}}],true)}
  function doRestart(){if(tutorial?.active){startTutorial();return}if(placement)cancelPlacement({quiet:true});closeDrawer({restoreFocus:false});if(game.phase==='ready'&&game.towers.every(t=>!t)){resetGame();return}const resume=game.phase==='active'&&!game.paused;if(resume){game.paused=true;refreshUI()}openModal('ゲームを最初からやり直しますか？','<p>配置した設備、ポイント、スコア、進行状況はすべて初期化されます。</p>',[{label:'初期化する',primary:true,action:resetGame},{label:'キャンセル',action:()=>{if(resume){game.paused=false;refreshUI()}}}]);$('modalBackdrop').dataset.restorePause=resume?'1':'0'}
  function beginSession(mode,waves,tutorialMode=false){
    if(!['easy','normal','hard'].includes(mode)||![3,5,7].includes(waves))return;
    configuredWaveLimit=waves;
    $('difficultySelect').value=mode;
    tutorial=null;resetGame();
    window.HD_START_MENU?.showGame();
    fitCanvas();
    if(tutorialMode)startTutorial();
    else refreshUI();
  }
  function returnToMenuNow(){
    if(placement)cancelPlacement({quiet:true});
    tutorial=null;closeDrawer({restoreFocus:false});
    const chosen=window.HD_START_MENU?.getSelection();
    if(chosen)$('difficultySelect').value=chosen.mode;
    resetGame();
    window.HD_START_MENU?.showMenu();
  }
  function requestReturnToMenu(){
    if(tutorial?.active){askExitTutorial();return}
    const hasProgress=game.wave>0||game.towers.some(Boolean)||game.trainingLevel>0||game.risk.reporting>0||!!placement;
    if(!hasProgress){returnToMenuNow();return}
    const resume=game.phase==='active'&&!game.paused;
    if(resume){game.paused=true;refreshUI()}
    openModal('メニューへ戻りますか？','<p>現在のプレイ状況は破棄されます。難易度とウェーブ数はメニューで再設定できます。</p>',[
      {label:'メニューへ戻る',primary:true,action:returnToMenuNow},
      {label:'プレイを続ける',action:()=>{if(resume){game.paused=false;refreshUI()}}}
    ]);
    $('modalBackdrop').dataset.restorePause=resume?'1':'0';
  }
  window.HD_GAME=Object.freeze({beginSession,returnToMenu:requestReturnToMenu});
  $('difficultySelect').addEventListener('change',()=>{
    if(game.wave>0||game.towers.some(Boolean)||game.trainingLevel>0||tutorial?.active){return}
    resetGame();addLog(`難易度を${Risk.profile(game.risk).name}に設定しました。`);
  });
  $('riskDetailBtn').addEventListener('click',()=>openDrawer('risk'));
  $('followUpBtn').addEventListener('click',followUpTraining);
  $('reportingBtn').addEventListener('click',investReporting);
  $('tutorialBtn').addEventListener('click',requestTutorialStart);
  $('tutorialRestartBtn').addEventListener('click',startTutorial);
  $('tutorialExitBtn').addEventListener('click',askExitTutorial);
  document.querySelectorAll('[data-panel]').forEach(btn=>btn.addEventListener('click',()=>openDrawer(btn.dataset.panel)));
  $('closeDrawerBtn').addEventListener('click',()=>{if(placement&&!placement.type)cancelPlacement({quiet:true});closeDrawer()});
  $('drawerBackdrop').addEventListener('click',()=>{if(placement&&!placement.type)cancelPlacement({quiet:true});closeDrawer()});
  $('closeToMapBtn').addEventListener('click',()=>{closeDrawer({restoreFocus:false});canvas.focus({preventScroll:true})});
  $('controlDrawer').addEventListener('keydown',trapDrawerFocus);
  $('confirmPlacementBtn').addEventListener('click',confirmPlacement);
  $('changePlacementBtn').addEventListener('click',()=>{if(placement)openDrawer('shop')});
  $('cancelPlacementBtn').addEventListener('click',()=>cancelPlacement());
  $('trainingBtn').addEventListener('click',upgradeTraining);
  $('startBtn').addEventListener('click',startWave);
  $('pauseBtn').addEventListener('click',()=>{if(tutorial?.active&&!tutorialPermit('pause'))return;if(game.phase!=='active')return;game.paused=!game.paused;refreshUI()});
  $('speedBtn').addEventListener('click',()=>{if(tutorial?.active&&!tutorialPermit('speed'))return;game.speed=game.speed===1?2:1;refreshUI();toast(game.speed===1?'通常速度に変更':'2倍速に変更')});
  $('bcpBtn').addEventListener('click',activateBCP);
  $('helpBtn').addEventListener('click',showHelp);
  $('restartBtn').addEventListener('click',doRestart);
  $('backToMenuBtn').addEventListener('click',requestReturnToMenu);
  $('modalClose').addEventListener('click',()=>{const restore=$('modalBackdrop').dataset.restorePause==='1';$('modalBackdrop').dataset.restorePause='0';closeModal();if(restore&&game.phase==='active'){game.paused=false;refreshUI()}});
  $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))$('modalClose').click()});
  canvas.addEventListener('pointerdown',handleBoard);canvas.addEventListener('pointermove',moveHover);canvas.addEventListener('pointerleave',()=>{hoverPad=-1});
  window.addEventListener('keydown',e=>{if($('gameShell').hidden)return;if(e.key==='Escape'&&$('modalBackdrop').classList.contains('open')){$('modalClose').click();return}if(e.key==='Escape'&&currentDrawer){if(placement&&!placement.type)cancelPlacement({quiet:true});closeDrawer();return}if(e.key==='Escape'&&placement){cancelPlacement();return}if(currentDrawer||$('modalBackdrop').classList.contains('open')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
    if('1234'.includes(e.key)&&e.key.length===1){const t=Object.keys(TOWERS)[Number(e.key)-1];if(t)choosePlacementType(t)}
    if(e.code==='Space'){e.preventDefault();if(game.phase==='active'){$('pauseBtn').click()}}
    if(e.key==='Enter'&&document.activeElement===canvas){e.preventDefault();startWave()}
  });
  window.addEventListener('resize',fitCanvas);
  window.addEventListener('orientationchange',()=>requestAnimationFrame(fitCanvas));
  // No network calls, third-party scripts, analytics, or personal data collection.
  initializePadButtons();resetGame();fitCanvas();raf=requestAnimationFrame(frame);
})();
