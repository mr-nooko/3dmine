/* Dependency-free, perspective-projected 3D cells rendered with Canvas 2D. */
'use strict';
const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');
let field,selected=null,hovered=null,pickFaces=[],yaw=-.57,pitch=.42,zoom=1,width=800,height=600,dirty=true,startTime=0,elapsed=0,pointer=null,suppressClick=false;
const clueFaceChoices=new Map();
const numberColors=['#93baaa','#effff6','#c7eeff','#ffe6a3','#ffc5bf','#e0d0ff','#bdfff0','#ffdab3','#e4edf5'];
const faceDefinitions=[{ids:[0,4,6,2],normal:[-1,0,0]},{ids:[1,3,7,5],normal:[1,0,0]},{ids:[0,1,5,4],normal:[0,-1,0]},{ids:[2,6,7,3],normal:[0,1,0]},{ids:[0,2,3,1],normal:[0,0,-1]},{ids:[4,5,7,6],normal:[0,0,1]}];
function rotate(x,y,z){const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);return {x:a,y:y*Math.cos(pitch)-b*Math.sin(pitch),z:y*Math.sin(pitch)+b*Math.cos(pitch)};}
function project(p){const f=Math.min(width,height)*1.52*zoom,d=field.n*3.1;return {x:width/2+p.x*f/(d+p.z),y:height/2+p.y*f/(d+p.z),z:p.z};}
function active(c){return !$('slice').checked||Math.floor(c[$('axis').value])===Number($('layer').value);}
function focus(c){return !$('xray').checked||selected===null||c.id===selected||field.neighbors(selected).some(a=>a.id===c.id);}
function geometry(c){
  const center=field.position(c);
  if(field.shape!=='tetra')return {vertices:Array.from({length:8},(_,i)=>[center[0]+((i&1)?.43:-.43),center[1]+((i&2)?.43:-.43),center[2]+((i&4)?.43:-.43)]),faces:faceDefinitions};
  const vertices=c.vertices.map(v=>field.vertexPosition(v).map((a,i)=>center[i]+(a-center[i])*.94));
  const faces=Array.from({length:4},(_,omitted)=>{
    const ids=[0,1,2,3].filter(i=>i!==omitted),[a,b,d]=ids.map(i=>vertices[i]);
    const u=b.map((v,i)=>v-a[i]),v=d.map((p,i)=>p-a[i]);
    let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(normal.reduce((s,p,i)=>s+p*(a[i]-center[i]),0)<0)normal=normal.map(p=>-p);
    const length=Math.hypot(...normal);return {ids,normal:normal.map(p=>p/length)};
  });return {vertices,faces};
}
function rgba(r,g,b,a){return `rgba(${r},${g},${b},${a})`;}
function poly(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
function hoveredClue(){const c=field.cells[hovered];return !pointer&&c?.open&&!c.mine&&c.count>0?c:null;}
function draw(){
  dirty=false;ctx.clearRect(0,0,width,height);pickFaces=[];
  const clue=hoveredClue(),neighborIds=new Set(clue?field.neighbors(clue.id).map(c=>c.id):[]);
  const pulse=(1+Math.sin(performance.now()*Math.PI*2/1200))/2;
  // Fine spatial registration grid.
  ctx.strokeStyle='#253238';ctx.lineWidth=.6;ctx.globalAlpha=.32;
  for(let x=width/2%42;x<width;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
  for(let y=height/2%42;y<height;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}ctx.globalAlpha=1;
  const faces=[],labels=[],clues=[];
  for(const c of field.cells){
    const neighbor=neighborIds.has(c.id),isActive=active(c)||neighbor,isFocus=focus(c)||neighbor,ghost=!isActive||!isFocus;
    const center=rotate(...field.position(c));
    // Zeroes vanish. Numbered safe cells retain a visual-only translucent shell.
    // Its faces never enter the solid hit list or change the board's access rules.
    const shell=c.open&&!c.mine;
    if(shell&&c.count===0)continue;
    const mesh=geometry(c),corners=mesh.vertices.map(v=>project(rotate(...v)));
    let best=null;const candidates=[];
    for(const def of mesh.faces){const normal=rotate(...def.normal);if(normal.x*center.x+normal.y*center.y+normal.z*(center.z+field.n*3.1)>=0)continue;
      const pts=def.ids.map(i=>corners[i]),z=pts.reduce((s,p)=>s+p.z,0)/pts.length;
      const face={c,pts,z,ghost,isActive,isFocus,neighbor,shell,key:def.ids.join(','),shade:.54+Math.max(0,-normal.z)*.27+Math.max(0,-normal.y)*.12};faces.push(face);
      const area=Math.abs(pts.reduce((s,p,i)=>s+p.x*pts[(i+1)%pts.length].y-p.y*pts[(i+1)%pts.length].x,0))/2;
      face.area=area;if(shell)candidates.push(face);
      if(!best||area>best.area)best={face,area};
    }
    if(shell&&!ghost&&candidates.length)clues.push({c,candidates:candidates.sort((a,b)=>b.area-a.area)});
    if(!shell&&best&&!ghost&&(c.flag||((field.state==='lost'||field.state==='won')&&c.mine)))labels.push(best.face);
  }
  faces.sort((a,b)=>b.z-a.z);
  // Ghost context is drawn separately, so it cannot cover the inspected region.
  for(const pass of [true,false])for(const f of faces){if(f.ghost!==pass)continue;const {c,pts,shade}=f,isSelected=c.id===selected,isHovered=c.id===hovered;
    if(f.ghost){ctx.fillStyle='rgba(98,133,148,.018)';ctx.strokeStyle='rgba(115,151,167,.10)';ctx.lineWidth=.6;}
    else if(f.shell){
      const source=c.id===clue?.id,dim=clue&&!source;
      ctx.fillStyle=source?'rgba(68,235,179,.44)':`rgba(30,199,148,${dim?0.055:0.24+0.07*shade})`;
      ctx.strokeStyle=source?'rgba(201,255,229,1)':dim?'rgba(77,212,160,.18)':isSelected?'rgba(156,255,207,.95)':'rgba(83,236,174,.78)';
      ctx.lineWidth=source?1.9:isSelected?1.3:1;
    }else{
      const ended=field.state==='lost'||field.state==='won';
      let color=c.mine&&ended?[159,72,71]:c.flag?[139,111,72]:[46,61,82];
      if(isSelected&&!c.flag&&!(c.mine&&ended))color=[76,110,153];
      if(isHovered)color=color.map(v=>Math.min(230,v+22));
      ctx.fillStyle=rgba(...color.map(v=>Math.round(v*shade)),c.open?.82:($('xray').checked?.74:1));
      ctx.strokeStyle=c.flag?'#dab77e':isSelected?'#a4c8f3':isHovered?'#d0e3f5':'#647f9f';ctx.lineWidth=isSelected?1.7:.65;
    }
    poly(pts);ctx.fill();ctx.stroke();if(!f.ghost&&!f.shell)pickFaces.push(f);
    // Attach each label directly to its cube's best face, maintaining depth occlusion.
    if(!f.ghost&&labels.includes(f)){
      const p={x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length};
      const edge=Math.min(Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),Math.hypot(pts[1].x-pts[2].x,pts[1].y-pts[2].y));
      const text=c.mine&&(field.state==='lost'||field.state==='won')?'✳':c.flag?'⚑':String(c.count);
      ctx.fillStyle=c.mine&&(field.state==='lost'||field.state==='won')?'#ffd1c3':c.flag?'#ffe0a3':numberColors[Math.min(c.count,8)];
      ctx.font=`600 ${Math.max(10,Math.min(24,edge*.56))}px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x,p.y);
      if(c.open&&!c.mine&&c.count===0){ctx.strokeStyle='rgba(147,186,170,.3)';}
    }
  }
  // A soft through-depth overlay identifies the actual remaining neighboring
  // solids, without changing their hidden contents or their access permissions.
  if(clue){
    ctx.save();
    for(const f of faces)if(f.neighbor&&!f.shell){
      poly(f.pts);ctx.fillStyle=`rgba(155,239,206,${.07+.14*pulse})`;ctx.fill();
      ctx.strokeStyle=`rgba(183,255,224,${.35+.6*pulse})`;ctx.lineWidth=1.3+1.2*pulse;ctx.stroke();
    }
    ctx.restore();
  }
  // Choose a facing, unoccluded face for each number, prioritizing the hovered
  // clue, then the selection, then near faces. Suppress overlapping labels.
  const priority=c=>c.id===clue?.id?0:c.id===selected?1:2;
  clues.sort((a,b)=>priority(a.c)-priority(b.c)||Math.min(...a.candidates.map(f=>f.z))-Math.min(...b.candidates.map(f=>f.z)));
  const occupied=[],solidFaces=faces.filter(f=>!f.shell&&!f.ghost),badges=[];
  for(const {c,candidates} of clues){
    const source=c.id===clue?.id;
    if(source)candidates.sort((a,b)=>Number(b.key===clueFaceChoices.get(c.id))-Number(a.key===clueFaceChoices.get(c.id)));
    for(const f of candidates){
      const p={x:f.pts.reduce((s,p)=>s+p.x,0)/f.pts.length,y:f.pts.reduce((s,p)=>s+p.y,0)/f.pts.length};
      if(solidFaces.some(s=>s.z<f.z-.03&&contains(p,s.pts)))continue;
      const size=source?21:Math.max(14,Math.min(19,Math.sqrt(f.area)*.8));
      ctx.font=`700 ${size}px "Segoe UI",sans-serif`;
      const w=ctx.measureText(String(c.count)).width+6,h=size+4;
      const rect={x:p.x-w/2,y:p.y-h/2,w,h};
      if(occupied.some(r=>rect.x<r.x+r.w+3&&rect.x+rect.w+3>r.x&&rect.y<r.y+r.h+3&&rect.y+rect.h+3>r.y))continue;
      occupied.push(rect);badges.push({c,p,size,rect,face:f});clueFaceChoices.set(c.id,f.key);break;
    }
  }
  // Render the source last for visual priority. The glyph is anchored to its
  // face, screen-upright and outlined for contrast, without a floating card.
  badges.sort((a,b)=>priority(b.c)-priority(a.c));
  for(const {c,p,size,rect,face} of badges){
    const source=c.id===clue?.id;ctx.save();
    ctx.globalAlpha=(clue&&!source)?0.28:1;
    if(source){poly(face.pts);ctx.fillStyle='rgba(145,231,195,.15)';ctx.fill();ctx.strokeStyle='#baffdf';ctx.lineWidth=1.6;ctx.stroke();}
    ctx.font=`700 ${size}px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='rgba(5,24,20,1)';ctx.strokeText(String(c.count),p.x,p.y);
    ctx.fillStyle=source?'#ecfff5':numberColors[Math.min(c.count,8)];ctx.fillText(String(c.count),p.x,p.y);ctx.restore();
    // Only the number is an inspection target. The shell itself is click-through.
    pickFaces.push({c,pts:[{x:rect.x,y:rect.y},{x:rect.x+rect.w,y:rect.y},{x:rect.x+rect.w,y:rect.y+rect.h},{x:rect.x,y:rect.y+rect.h}]});
  }
  // Orientation indicator.
  const ox=width-49,oy=54;for(const [axis,v,color] of [['X',[1,0,0],'#d6a49b'],['Y',[0,1,0],'#a5cfb5'],['Z',[0,0,1],'#9ebdd6']]){const p=rotate(...v);ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+p.x*23,oy+p.y*23);ctx.stroke();ctx.fillStyle=color;ctx.font='10px monospace';ctx.fillText(axis,ox+p.x*32,oy+p.y*32);}
}
function contains(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function hit(event){const r=canvas.getBoundingClientRect(),p={x:event.clientX-r.left,y:event.clientY-r.top};for(let i=pickFaces.length-1;i>=0;i--)if(contains(p,pickFaces[i].pts))return pickFaces[i].c.id;return null;}
function update(){
  const flags=field.cells.filter(c=>c.flag).length;$('remaining').textContent=field.mineCount-flags;
  $('progress').innerHTML=Math.floor(100*field.opened/(field.cells.length-field.mineCount))+'<span>%</span>';
  $('boardLabel').textContent=`${field.shape==='tetra'?'TETRA':'CUBE'} / ${field.cells.length} CELLS`;
  $('shapeHint').textContent=field.shape==='tetra'?'小三棱锥组成大三棱锥 · 仅共面相邻 · 最多 4 邻居':'小立方体组成大立方体 · 接触均相邻 · 最多 26 邻居';
  $('clueHoverHint').textContent='数字贴在半透明提示壳上；悬停聚焦，外壳不挡点击。';
  $('status').textContent={ready:'等待第一次探索',playing:'探索进行中',lost:'触雷 · 雷场已揭晓',won:'已清除全部安全格'}[field.state];
  $('viewLabel').textContent=[field.mode==='surface'?'表面消除':$('slice').checked?`${$('axis').value.toUpperCase()} 轴 · 第 ${Number($('layer').value)+1} 层`:'自由探索',$('xray').checked?'邻域透视':''].filter(Boolean).join(' / ');
  $('sliceOption').hidden=field.mode!=='free';
  $('modeHint').textContent=field.mode==='surface'?'手动从表面点击；零格连通区及周围数字自动全部揭开。':'自由探索：可以用切层直接操作内部。';
  $('sliceTools').hidden=!$('slice').checked;$('layerValue').textContent=`第 ${Number($('layer').value)+1} / ${field.n} 层`;
  const c=field.cells[selected];$('coordinates').textContent=c?(field.shape==='tetra'?`三棱锥 #${c.id+1}`:`[ ${c.x+1}, ${c.y+1}, ${c.z+1} ]`):'—';
  $('cellState').textContent=!c?'选择一个单元':c.open?(c.mine?'触发地雷':c.count===0?'零格已消除':`${c.count} 颗相邻地雷 · 已揭开提示壳`):c.flag?'已标记为地雷':!field.canAccess(c.id)?'内部未暴露 · 暂不可操作':field.mode==='free'?'尚未探索 · 可直接操作':'表面已暴露 · 尚未探索';
  $('neighborCount').textContent=c?`${field.neighbors(c.id).length} 个相邻格 · ${field.neighbors(c.id).filter(a=>a.open).length} 个已翻开`:'单击选择，再翻开或标记';
  const ended=field.state==='lost'||field.state==='won',locked=!c||!field.canAccess(c.id);$('reveal').disabled=locked||c.open||c.flag||ended;$('flag').disabled=locked||c.open||ended;$('flag').innerHTML=(c?.flag?'取消标记':'标记')+' <kbd>F</kbd>';
  $('endOverlay').hidden=!ended;
  if(ended){$('endTitle').textContent=field.state==='won'?'雷场已解开。':'这一步，触到了雷。';$('endText').textContent=field.state==='won'?'所有安全单元均已找到。':'可以继续旋转，查看这局的地雷分布。';}
  dirty=true;
}
function reveal(){if(selected===null)return;const before=field.state;if(field.reveal(selected)){if(before==='ready'&&field.started)startTime=Date.now();if(field.state==='won'||field.state==='lost')elapsed=Date.now()-startTime;update();}}
function flag(){if(selected!==null&&field.toggleFlag(selected))update();}
function defaultView(){yaw=field.shape==='tetra'?.65:-.57;pitch=field.shape==='tetra'?.25:.42;zoom=field.shape==='tetra'?1.18:1;dirty=true;}
function restart(){clueFaceChoices.clear();const previousShape=field?.shape;field=new Minefield(Number($('size').value),Number($('density').value)/100,Math.random,$('mode').value,$('shape').value);if(previousShape!==field.shape)defaultView();for(const option of $('size').options){const n=Number(option.value);option.textContent=field.shape==='cube'?`${n} × ${n} × ${n} · ${n**3} 格`:`${n} 等分 · ${n**3} 个三棱锥`;}if(field.mode==='surface')$('slice').checked=false;selected=field.shape==='tetra'?0:Math.floor(field.n/2)+field.n*Math.floor(field.n/2);hovered=null;startTime=0;elapsed=0;$('layer').max=field.n-1;$('layer').value=0;$('timer').textContent='00:00';update();}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;}
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});if(e.button!==0)return;hovered=null;dirty=true;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(pointer&&pointer.id===e.pointerId){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>5)pointer.moved=true;if(pointer.moved){yaw+=dx*.009;pitch=Math.max(-1.45,Math.min(1.45,pitch+dy*.009));dirty=true;}pointer.x=e.clientX;pointer.y=e.clientY;}else{const next=hit(e);if(next!==hovered){hovered=next;dirty=true;}}});
canvas.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;suppressClick=pointer.moved;pointer=null;});
canvas.addEventListener('pointercancel',()=>{pointer=null;suppressClick=true;});
canvas.addEventListener('click',e=>{if(suppressClick){suppressClick=false;return;}const id=hit(e);if(id!==null){selected=id;update();}});
canvas.addEventListener('dblclick',e=>{if(suppressClick)return;const id=hit(e);if(id!==null){selected=id;reveal();}});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();const id=hit(e);if(id!==null){selected=id;flag();}});
canvas.addEventListener('pointerleave',()=>{hovered=null;dirty=true;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.55,Math.min(1.65,zoom*Math.exp(-e.deltaY*.001)));dirty=true;},{passive:false});
$('reveal').onclick=reveal;$('flag').onclick=flag;$('restart').onclick=restart;$('playAgain').onclick=restart;
$('mode').onchange=restart;
$('shape').onchange=restart;
$('density').oninput=()=>{$('densityValue').textContent=$('density').value+'%';};
for(const id of ['xray','slice','axis','layer'])$(id).addEventListener('input',()=>{
  if($('slice').checked&&(id==='layer'||id==='axis'||id==='slice')){
    if(field.shape==='tetra')selected=field.cells.find(c=>active(c))?.id??null;
    else{const coords={x:Math.floor(field.n/2),y:Math.floor(field.n/2),z:Math.floor(field.n/2)};coords[$('axis').value]=Number($('layer').value);selected=coords.x+field.n*(coords.y+field.n*coords.z);}
  }
  update();
});
$('resetView').onclick=defaultView;
$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)||$('helpDialog').open)return;if(e.code==='Space'){e.preventDefault();reveal();}if(e.code==='KeyF'){e.preventDefault();flag();}});
new ResizeObserver(resize).observe($('viewport'));
setInterval(()=>{const ms=field.state==='playing'?Date.now()-startTime:elapsed,s=Math.floor(ms/1000);$('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');},250);
function frame(){if(dirty||hoveredClue())draw();requestAnimationFrame(frame);}restart();resize();frame();
