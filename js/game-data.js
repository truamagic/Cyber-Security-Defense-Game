/* Game data and balance parameters. Edit this file to change the rules,
   tower costs, enemy types, wave composition, map coordinates, or drawer names.
   Classic scripts are used so the game also works directly from file://. */
(() => {
  'use strict';
  const W=960,H=560,MAX_LEVEL=3,BCP_COST=130,BCP_HEAL=16,TRAINING_COSTS=[110,160,215],TRAINING_SPEED=[1,.79,.60,.43];

const TOWERS={
    mail:{name:'メールフィルター',short:'メールフィルター',icon:'mail',cost:100,upgrade:[85,135],damage:18,rate:.54,range:139,color:'#4cdec3',desc:'不審メールを抑制。フィッシング型に強い。',perk:'強化でフィッシング型への対応強度が追加上昇。',vs:{phish:1.75,auth:.65,malware:.45,insider:.55,boss:.5}},
    mfa:{name:'多要素認証（MFA）',short:'MFA',icon:'key',cost:140,upgrade:[105,160],damage:22,rate:.76,range:136,color:'#f4c979',desc:'認証情報の悪用に強い。認証型の敵を抑制。',perk:'強化で認証悪用型への対応強度が追加上昇。',vs:{phish:.5,auth:1.95,malware:.55,insider:.55,boss:.6}},
    edr:{name:'端末検知・対応（EDR）',short:'EDR',icon:'radar',cost:175,upgrade:[130,190],damage:25,rate:.87,range:164,color:'#a6b7ff',desc:'不審な挙動の検知・対応。マルウェア型に強い。',perk:'強化でマルウェア・人的リスク型への対応強度が追加上昇。',vs:{phish:.8,auth:.8,malware:1.85,insider:1.75,boss:1.55}},
    segment:{name:'ネットワーク分離',short:'分離',icon:'network',cost:155,upgrade:[110,170],damage:15,rate:1.04,range:134,color:'#d5a3ff',desc:'全ての敵の進行を一時的に遅らせる。',perk:'強化で進行遅延の持続時間をさらに延長。',vs:{phish:.9,auth:1,malware:.9,insider:1.1,boss:.78},slow:1.15}
  };
  const ENEMIES={
    phish:{name:'フィッシング',hp:63,speed:77,damage:4,leak:3,reward:13,color:'#ff7b96',radius:12},
    auth:{name:'認証情報の悪用',hp:96,speed:91,damage:7,leak:7,reward:18,color:'#ffc16f',radius:13},
    malware:{name:'マルウェア',hp:150,speed:59,damage:10,leak:5,reward:24,color:'#bd9bff',radius:14},
    insider:{name:'人的リスク由来のマルウェア',hp:170,speed:42,damage:13,leak:10,reward:29,color:'#ff9d6c',radius:15},
    boss:{name:'大規模障害リスク',hp:540,speed:44,damage:25,leak:21,reward:80,color:'#ff5d82',radius:24}
  };
  const WAVE_DEFS=[
    {title:'不審メールの増加',subtitle:'フィッシング型が中心。まずは基礎防御を。',interval:.96,bonus:95,hpMult:1,units:'phish phish phish auth phish phish auth phish phish phish auth phish phish auth'.split(' ')},
    {title:'認証リスクの拡大',subtitle:'認証系の敵が増加。MFAの効果を試そう。',interval:.84,bonus:115,hpMult:1.12,units:'phish auth phish auth auth phish auth malware phish auth phish auth malware phish auth phish auth malware'.split(' ')},
    {title:'端末への脅威',subtitle:'中央の新侵入経路が開放。EDRと分離を組み合わせよう。',interval:.75,bonus:135,hpMult:1.23,units:'malware phish auth malware auth phish malware phish auth malware auth phish malware auth malware phish malware auth phish malware auth phish malware auth'.split(' ')},
    {title:'複数経路からの圧力',subtitle:'攻撃の種類が多様化。弱い区間を見直そう。',interval:.69,bonus:150,hpMult:1.35,units:'auth phish malware auth phish malware auth phish malware auth malware phish auth malware auth phish malware auth phish malware auth malware phish auth malware auth malware auth'.split(' ')},
    {title:'病院システムへの接近',subtitle:'病院付近の新侵入経路が開放。至近防衛線を強化しよう。',interval:.65,bonus:0,hpMult:1.45,units:'auth malware phish auth malware auth phish malware auth malware phish auth malware auth phish malware auth malware phish auth malware boss phish auth malware auth malware phish auth malware boss'.split(' ')},
    {title:'障害連鎖の拡大',subtitle:'長期戦。設備健全度と保守体制が試されます。',interval:.62,bonus:190,hpMult:1.57,units:'malware auth phish malware auth malware phish auth malware auth malware phish auth malware phish malware auth malware phish auth malware boss auth phish malware auth'.split(' ')},
    {title:'最終防衛指令',subtitle:'追加の最終ウェーブ。蓄えた対策とBCPを総動員しましょう。',interval:.59,bonus:0,hpMult:1.70,units:'auth malware phish malware auth phish malware auth malware phish auth malware boss phish malware auth malware phish auth malware boss malware auth phish malware auth malware boss'.split(' ')}
  ];
  // The 5 primary routes, both branch routes and each route's placement sites
  // are defined and validated in js/route-system.js.
  // Internal-risk events. Mid and late intrusion-route events are defined in route-system.js.
  const EVENT_PLANS={
    2:[{at:7.4,kind:'human',count:1}],
    3:[{at:12.2,kind:'human',count:1}],
    4:[{at:12.5,kind:'human',count:2}],
    5:[{at:6.2,kind:'human',count:2},{at:17.0,kind:'human',count:1}],
    6:[{at:12.4,kind:'human',count:2}],
    7:[{at:6.4,kind:'human',count:2},{at:16.2,kind:'human',count:2}]
  };

const iconSVG={
    mail:'<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    key:'<svg class="icon" viewBox="0 0 24 24"><circle cx="8" cy="9" r="4"/><path d="m11 12 8 8m-3-3 2-2m-4 0 2-2"/></svg>',
    radar:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6"/></svg>',
    network:'<svg class="icon" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/></svg>'
  };
  const PANEL_CONFIG={
    shop:{title:'防御設備ショップ',kicker:'SELECT → DEPLOY'},
    upgrade:{title:'設備の強化・管理',kicker:'LEVEL 1—3'},
    education:{title:'職員教育・人的リスク対策',kicker:'GLOBAL UPGRADE'},
    risk:{title:'設備保守・リスク管理',kicker:'OPERATIONAL RISK'},
    log:{title:'防衛イベントログ',kicker:'EVENT HISTORY'}
  };

  window.HD_CONFIG = Object.freeze({W, H, MAX_LEVEL, BCP_COST, BCP_HEAL, TRAINING_COSTS, TRAINING_SPEED, TOWERS, ENEMIES, WAVE_DEFS, EVENT_PLANS, iconSVG, PANEL_CONFIG});
})();
