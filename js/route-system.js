/* HOSPITAL DEFENSE v4.3 — five randomized primary corridors and two staged entry paths.
   Coordinates are fictional, dimensionless map units, never real-world infrastructure. */
(() => {
  'use strict';
  const goal=[858,264],mid=[500,270],late=[740,264];
  const templates=[
    {name:'標準ジグザグ',path:[[60,143],[168,143],[168,365],[326,365],[326,170],[500,170],mid,[620,270],[620,392],[740,392],late,goal],
     pads:[[70,60],[280,80],[70,270],[260,220],[270,440],[520,420],[450,250],[500,70],[700,170],[700,250],[720,480],[840,420],[900,170]]},
    {name:'上段迂回',path:[[60,280],[170,280],[170,116],[342,116],[342,325],[500,325],mid,[650,270],[650,138],[740,138],late,goal],
     pads:[[80,70],[280,70],[100,230],[270,220],[290,410],[480,420],[460,240],[410,60],[730,50],[700,280],[720,360],[890,360],[900,170]]},
    {name:'下段迂回',path:[[60,205],[154,205],[154,428],[335,428],[335,255],[500,255],mid,[622,270],[622,420],[740,420],late,goal],
     pads:[[70,110],[220,130],[70,280],[260,230],[270,470],[520,440],[470,300],[540,160],[700,170],[700,250],[720,480],[840,430],[900,170]]},
    {name:'中央折り返し',path:[[60,350],[162,350],[162,180],[300,180],[300,398],[500,398],mid,[645,270],[645,185],[740,185],late,goal],
     pads:[[110,90],[280,80],[70,270],[250,230],[270,440],[480,450],[460,240],[560,130],[730,90],[690,240],[720,360],[890,360],[900,170]]},
    {name:'広域迂回',path:[[60,110],[160,110],[160,240],[270,240],[270,80],[420,80],[420,335],[500,335],mid,[600,270],[600,345],[740,345],late,goal],
     pads:[[90,50],[240,50],[70,270],[320,220],[340,400],[480,430],[540,220],[500,50],[700,170],[700,250],[720,440],[820,410],[900,170]]}
  ];
  const asPoints=xy=>xy.map(([x,y])=>({x,y}));
  function measure(nodes){
    const sections=[];let total=0;
    for(let i=1;i<nodes.length;i++){
      total+=Math.hypot(nodes[i].x-nodes[i-1].x,nodes[i].y-nodes[i-1].y);
      sections.push(total);
    }
    return {sections,total};
  }
  function distanceToPath(point,nodes){
    let best=Infinity;
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i],dx=b.x-a.x,dy=b.y-a.y;
      const divisor=dx*dx+dy*dy;
      const ratio=divisor?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/divisor)):0;
      best=Math.min(best,Math.hypot(point.x-a.x-ratio*dx,point.y-a.y-ratio*dy));
    }
    return best;
  }
  function build(index){
    if(!Number.isInteger(index)||index<0||index>=templates.length)throw Error('Invalid route variant');
    const template=templates[index],main=asPoints(template.path);
    const midJoin=main.findIndex(p=>p.x===500&&p.y===270);
    const lateJoin=main.findIndex(p=>p.x===740&&p.y===264);
    if(midJoin<0||lateJoin<midJoin)throw Error('Route junctions not found');
    const midPath=asPoints([[455,42],[455,177],[500,177],[500,270]]).concat(main.slice(midJoin+1));
    const latePath=asPoints([[810,58],[810,196],[740,196],[740,264]]).concat(main.slice(lateJoin+1));
    const pads=asPoints(template.pads);
    if(pads.length!==13||!pads.every(p=>{
      const d=distanceToPath(p,main);
      return d>=40&&d<=106&&p.x>=55&&p.x<=905&&p.y>=48&&p.y<=510;
    }))throw Error('Placement coverage validation failed for route '+index);
    return {index,name:template.name,main,mid:midPath,late:latePath,pads,
      primary:measure(main),secondary:measure(midPath),tertiary:measure(latePath)};
  }
  const variants=Object.freeze(templates.map((_,index)=>build(index)));
  function randomIndex(){return Math.floor(Math.random()*variants.length)}
  const branchEvents={
    3:[{kind:'mid',at:3.7,count:2}],
    4:[{kind:'mid',at:3.7,count:3}],
    5:[{kind:'mid',at:3.7,count:4},{kind:'late',at:6.4,count:2}],
    6:[{kind:'mid',at:3.7,count:4},{kind:'late',at:6.4,count:3}],
    7:[{kind:'mid',at:3.7,count:5},{kind:'late',at:6.4,count:4}]
  };
  window.HD_ROUTING=Object.freeze({
    variants,randomIndex,branchEvents,distanceToPath,
    get:index=>variants[index]
  });
})();
