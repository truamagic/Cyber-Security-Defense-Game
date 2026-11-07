/* HOSPITAL DEFENSE — focused tutorial guidance.
   The overlay is visual only: it never captures taps, clicks or keyboard focus.
   SVG mask lets the range-preview step keep both the map and confirm button visible. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  let root,svg,mask,shade,holes=[],rings=[],hint,titleText,tipText,countText;
  let primary=null,secondary=null,paused=false,raf=0,until=0,last="";
  const $=(id)=>document.getElementById(id);
  const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
  const make=(tag,cls,parent)=>{
    const el=document.createElement(tag);
    el.className=cls;
    parent.appendChild(el);
    return el;
  };
  const svgEl=(tag,attrs,parent)=>{
    const el=document.createElementNS(NS,tag);
    for(const [key,val] of Object.entries(attrs))el.setAttribute(key,String(val));
    parent.appendChild(el);
    return el;
  };
  function ensure(){
    if(root)return;
    root=make('div','tutorial-spotlight',document.body);
    root.id='tutorialSpotlight';
    root.setAttribute('aria-hidden','true');
    root.hidden=true;
    svg=svgEl('svg',{'class':'tutorial-spotlight-svg',width:'100%',height:'100%',preserveAspectRatio:'none'},root);
    const defs=svgEl('defs',{},svg);
    mask=svgEl('mask',{id:'hdTutorialSpotlightMask',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'},defs);
    svgEl('rect',{x:0,y:0,width:'100%',height:'100%',fill:'#fff'},mask);
    for(let i=0;i<2;i++){
      holes.push(svgEl('rect',{x:0,y:0,width:0,height:0,rx:12,fill:'#000'},mask));
    }
    shade=svgEl('rect',{x:0,y:0,width:'100%',height:'100%',mask:'url(#hdTutorialSpotlightMask)',class:'tutorial-spotlight-shade'},svg);
    for(let i=0;i<2;i++)rings.push(make('div','tutorial-spotlight-ring'+(i===1?' tutorial-spotlight-ring-secondary':''),root));
    hint=make('div','tutorial-spotlight-hint',root);
    countText=make('span','tutorial-spotlight-count',hint);
    titleText=make('strong','tutorial-spotlight-title',hint);
    tipText=make('span','tutorial-spotlight-tip',hint);
  }
  function dimensions(){
    // These match fixed-position CSS coordinates in the layout viewport.
    return {w:document.documentElement.clientWidth||window.innerWidth,
            h:document.documentElement.clientHeight||window.innerHeight};
  }
  function visibleBounds(element,extra,screen){
    if(!element||!element.isConnected||element.closest('[hidden]'))return null;
    let r=element.getBoundingClientRect();
    if(r.width<1||r.height<1)return null;
    let left=r.left,top=r.top,right=r.right,bottom=r.bottom;
    // Avoid exposing off-screen portions of targets inside scrollable drawers.
    const scrollPanel=element.closest('.drawer-body');
    if(scrollPanel){
      const clip=scrollPanel.getBoundingClientRect();
      left=Math.max(left,clip.left);right=Math.min(right,clip.right);
      top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);
    }
    if(right<=left||bottom<=top)return null;
    left=clamp(left-extra,0,screen.w);right=clamp(right+extra,0,screen.w);
    top=clamp(top-extra,0,screen.h);bottom=clamp(bottom+extra,0,screen.h);
    if(right-left<3||bottom-top<3)return null;
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  function placeHint(bounds,screen){
    hint.style.left='0px';hint.style.top='0px';
    hint.style.maxWidth=Math.min(232,screen.w-20)+'px';
    const b=hint.getBoundingClientRect(),w=Math.min(b.width,screen.w-20),h=Math.min(b.height,screen.h-16);
    const r=bounds[0],gap=14;
    const suggestions=[
      {x:r.left-w-gap,y:(r.top+r.bottom-h)/2},
      {x:r.right+gap,y:(r.top+r.bottom-h)/2},
      {x:(r.left+r.right-w)/2,y:r.bottom+gap},
      {x:(r.left+r.right-w)/2,y:r.top-h-gap}
    ];
    let best=null,bestScore=Infinity;
    for(const c of suggestions){
      const x=clamp(c.x,8,Math.max(8,screen.w-w-8));
      const y=clamp(c.y,8,Math.max(8,screen.h-h-8));
      let overlap=0;
      for(const r of bounds){
        const dx=Math.max(0,Math.min(x+w,r.right)-Math.max(x,r.left));
        const dy=Math.max(0,Math.min(y+h,r.bottom)-Math.max(y,r.top));
        overlap+=dx*dy;
      }
      const score=overlap*10+Math.abs(x-c.x)*4+Math.abs(y-c.y)*4;
      if(score<bestScore){best={x,y};bestScore=score;}
    }
    hint.style.left=Math.round(best.x)+'px';
    hint.style.top=Math.round(best.y)+'px';
  }
  function update(){
    if(!root||paused||!primary||$('modalBackdrop')?.classList.contains('open')){if(root)root.hidden=true;return;}
    const screen=dimensions(),r=visibleBounds(primary,primary.classList.contains('map-pad-btn')?15:8,screen);
    if(!r){root.hidden=true;return;}
    const second=visibleBounds(secondary,5,screen);
    const bounds=second?[r,second]:[r];
    root.hidden=false;
    svg.setAttribute('viewBox',`0 0 ${screen.w} ${screen.h}`);
    mask.setAttribute('width',screen.w);mask.setAttribute('height',screen.h);
    for(let i=0;i<2;i++){
      const hole=holes[i],ring=rings[i],b=bounds[i];
      if(!b){hole.setAttribute('width',0);hole.setAttribute('height',0);ring.hidden=true;continue;}
      for(const [key,value] of Object.entries({x:b.left,y:b.top,width:b.width,height:b.height,rx:12}))hole.setAttribute(key,String(Math.round(value)));
      ring.hidden=false;
      const style=ring.style;
      style.left=Math.round(b.left)+'px';style.top=Math.round(b.top)+'px';
      style.width=Math.round(b.width)+'px';style.height=Math.round(b.height)+'px';
    }
    const signature=bounds.map(b=>[b.left,b.top,b.width,b.height].map(Math.round).join(':')).join('/');
    if(signature!==last){placeHint(bounds,screen);last=signature;}
  }
  function trackFor(ms=650){
    if(raf)cancelAnimationFrame(raf);
    until=performance.now()+ms;
    function tick(now){
      update();
      raf=now<until?requestAnimationFrame(tick):0;
    }
    raf=requestAnimationFrame(tick);
  }
  function revealTarget(target){
    if(!target||target.closest('[hidden]'))return;
    const screen=dimensions(),rect=target.getBoundingClientRect();
    const scrollable=target.closest('.drawer-body');
    if(scrollable){
      const view=scrollable.getBoundingClientRect(),margin=12;
      if(rect.top<view.top+margin)scrollable.scrollTop-=view.top+margin-rect.top;
      else if(rect.bottom>view.bottom-margin)scrollable.scrollTop+=rect.bottom-(view.bottom-margin);
    }else if(rect.bottom<12||rect.top>screen.h-12){
      // On narrow portrait screens the map can be below the initial guide.
      target.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
    }
  }
  function show(options){
    ensure();
    const changed=primary!==options.target;
    primary=options.target||null;
    secondary=options.secondary||null;
    paused=false;
    last='';
    if(!primary){hide();return;}
    if(changed)revealTarget(primary);
    countText.textContent=options.count||'';
    titleText.textContent=options.title||'次の操作';
    tipText.textContent=options.tip||'明るく表示された場所を操作してください。';
    update();trackFor();
  }
  function hide(){
    primary=null;secondary=null;last='';
    if(raf){cancelAnimationFrame(raf);raf=0;}
    if(root)root.hidden=true;
  }
  function suspend(){paused=true;if(root)root.hidden=true;if(raf){cancelAnimationFrame(raf);raf=0;}}
  function refresh(){if(primary&&!paused){update();trackFor(310);}}
  window.addEventListener('resize',()=>refresh());
  window.addEventListener('orientationchange',()=>refresh());
  window.addEventListener('scroll',()=>{if(primary&&!paused)update();},true);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',refresh);
    window.visualViewport.addEventListener('scroll',()=>{if(primary&&!paused)update();});
  }
  window.HD_SPOTLIGHT=Object.freeze({show,hide,suspend,refresh});
})();
