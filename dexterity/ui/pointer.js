const ns='http://www.w3.org/2000/svg',ink=document.createElementNS(ns,'svg');
ink.style.cssText='position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';document.body.prepend(ink);
window.dexterity.onPoint(p=>{
 const t=document.getElementById('target'),label=document.getElementById('label');ink.replaceChildren();t.hidden=!!p.overlay;
 if(p.overlay){
  const circle=document.createElementNS(ns,'ellipse');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('rx','33');circle.setAttribute('ry','23');circle.setAttribute('fill','#b8ef7c25');circle.setAttribute('stroke','#90e255');circle.setAttribute('stroke-width','4');circle.setAttribute('transform',`rotate(-12 ${p.x} ${p.y})`);ink.append(circle);
  const right=p.x<innerWidth-220,below=p.y<innerHeight-110,dx=right?100:-100,dy=below?65:-65;
  const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d',`M ${p.x+dx} ${p.y+dy} Q ${p.x+dx*.2} ${p.y+dy} ${p.x+dx*.3} ${p.y+dy*.35}`);arrow.setAttribute('fill','none');arrow.setAttribute('stroke','#90e255');arrow.setAttribute('stroke-width','4');arrow.setAttribute('stroke-linecap','round');ink.append(arrow);
  label.style.left=Math.max(6,Math.min(p.x+(right?65:-205),innerWidth-190))+'px';label.style.top=Math.max(6,Math.min(p.y+(below?74:-100),innerHeight-40))+'px';
 }else{
  t.style.left=p.x+'px';t.style.top=p.y+'px';t.style.transform=`scale(${p.x>innerWidth-35?-1:1},${p.y>innerHeight-35?-1:1})`;
  label.style.left=Math.max(4,Math.min(p.x+14,innerWidth-190))+'px';label.style.top=Math.max(4,Math.min(p.y>innerHeight-65?p.y-36:p.y+36,innerHeight-32))+'px';
 }
 label.textContent=p.title;
});
