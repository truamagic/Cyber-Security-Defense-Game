/* HOSPITAL DEFENSE v4.1 — title screen and session selection */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const selection={mode:'normal',waves:5};
  function render(){
    document.querySelectorAll('[data-menu-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.menuMode===selection.mode)));
    document.querySelectorAll('[data-menu-waves]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.menuWaves)===selection.waves)));
    $('menuSelectionSummary').textContent=selection.mode.toUpperCase()+' / '+selection.waves+' WAVE';
  }
  function showGame(){
    $('titleMenu').hidden=true;$('gameShell').hidden=false;
    window.scrollTo({top:0,behavior:'auto'});
  }
  function showMenu(){
    $('gameShell').hidden=true;$('titleMenu').hidden=false;
    render();window.scrollTo({top:0,behavior:'auto'});
    $('menuStartBtn').focus({preventScroll:true});
  }
  document.querySelectorAll('[data-menu-mode]').forEach(button=>button.addEventListener('click',()=>{
    selection.mode=button.dataset.menuMode;render();
  }));
  document.querySelectorAll('[data-menu-waves]').forEach(button=>button.addEventListener('click',()=>{
    selection.waves=Number(button.dataset.menuWaves);render();
  }));
  function begin(tutorial){
    if(!window.HD_GAME){$('menuSelectionSummary').textContent='読み込みに失敗しました。ページを再読み込みしてください。';return}
    window.HD_GAME.beginSession(selection.mode,selection.waves,tutorial);
  }
  $('menuStartBtn').addEventListener('click',()=>begin(false));
  $('menuTutorialBtn').addEventListener('click',()=>begin(true));
  window.HD_START_MENU=Object.freeze({showGame,showMenu,getSelection:()=>({...selection})});
  render();
})();
