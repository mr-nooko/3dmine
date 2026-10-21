const assert=require('node:assert/strict');
const Minefield=require('./core.js');
let checks=0;
for(let n=3;n<=7;n++)for(let run=0;run<30;run++){
  const f=new Minefield(n,.12,Math.random,'free'),safe=Math.floor(Math.random()*f.cells.length);
  assert.equal(f.neighbors(0).length,7);
  assert.equal(f.neighbors(1).length,11);
  assert.equal(f.neighbors(1+n).length,17);
  assert.equal(f.neighbors(1+n+n*n).length,26);
  f.reveal(safe);assert.equal(f.cells[safe].mine,false);
  assert.equal(f.cells.filter(c=>c.mine).length,f.mineCount);
  for(const c of f.cells){const independent=f.cells.filter(a=>a.id!==c.id&&Math.abs(c.x-a.x)<2&&Math.abs(c.y-a.y)<2&&Math.abs(c.z-a.z)<2&&a.mine).length;assert.equal(c.count,independent);}
  assert.equal(f.opened,f.cells.filter(c=>c.open&&!c.mine).length);
  for(const c of f.cells)if(!c.mine&&!c.open)f.reveal(c.id);
  assert.equal(f.state,'won');assert.equal(f.opened,f.cells.length-f.mineCount);checks++;
}
const f=new Minefield(4,.12,Math.random,'free');f.toggleFlag(0);assert.equal(f.reveal(0),false);assert.equal(f.started,false);f.toggleFlag(0);f.reveal(0);const mine=f.cells.find(c=>c.mine);f.reveal(mine.id);assert.equal(f.state,'lost');assert.equal(f.toggleFlag(1),false);

// A closed interior cell is never actionable, even before the first click.
const surface=new Minefield(5,.12);const center=62;
assert.equal(surface.mode,'surface');assert.equal(surface.canAccess(center),false);
assert.equal(surface.reveal(center),false);assert.equal(surface.started,false);
assert.equal(surface.toggleFlag(center),false);
// Use numbered safe cells to check that access progresses one face at a time.
surface.started=true;surface.state='playing';surface.mineCount=1;
for(const c of surface.cells)c.count=1;
surface.cells[0].mine=true;
assert.equal(surface.reveal(12),true);assert.equal(surface.canAccess(37),true);
assert.equal(surface.canAccess(center),false);
assert.equal(surface.reveal(37),true);assert.equal(surface.canAccess(center),true);
assert.equal(surface.reveal(center),true);
// An isolated cavity or diagonal-only connection cannot expose its neighbors.
const cavity=new Minefield(5,.12);cavity.cells[61].open=true;
assert.equal(cavity.canAccess(center),false);
const diagonal=new Minefield(5,.12);diagonal.cells[6].open=true;diagonal.cells[31].open=true;
assert.equal(diagonal.canAccess(center),false);
assert.equal(new Minefield(5,.12,Math.random,'free').canAccess(center),true);

function independentlyExposed(board,id){
  const n=board.n,seen=new Set(),queue=[[-1,-1,-1]];
  for(let i=0;i<queue.length;i++){
    const [x,y,z]=queue[i];
    for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
      const a=x+dx,b=y+dy,c=z+dz;if(a< -1||b< -1||c< -1||a>n||b>n||c>n)continue;
      const key=[a,b,c].join(',');if(seen.has(key))continue;
      if(a>=0&&a<n&&b>=0&&b<n&&c>=0&&c<n){const cell=board.cells[a+n*(b+n*c)];if(cell.id===id)return true;if(!cell.open||cell.mine)continue;}
      seen.add(key);queue.push([a,b,c]);
    }
  }
  return false;
}
// Manual access still requires exterior exposure. Automatic flood fill instead
// matches the complete 26-connected zero region and its numbered boundary.
function expectedReveal(board,start){
  const reached=new Set(),queue=[start];
  while(queue.length){const id=queue.pop(),c=board.cells[id];if(reached.has(id)||c.mine||c.flag)continue;reached.add(id);
    if(c.count===0)for(const b of board.cells)if(b.id!==id&&Math.max(Math.abs(b.x-c.x),Math.abs(b.y-c.y),Math.abs(b.z-c.z))<=1)queue.push(b.id);
  }
  return [...reached].sort((a,b)=>a-b);
}
let zeroRegions=0;
for(let seed=1;seed<=100;seed++){
  let randomState=seed;const rng=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const board=new Minefield(5,.12,rng),corner=seed%8,start=((corner&1)?4:0)+5*((corner&2)?4:0)+25*((corner&4)?4:0);board.plant(start);
  const expected=expectedReveal(board,start);if(board.cells[start].count===0)zeroRegions++;
  board.reveal(start);
  assert.deepEqual(board.cells.filter(c=>c.open).map(c=>c.id),expected,`Complete zero-region expansion, seed ${seed}`);
}
assert.ok(zeroRegions>20);
for(let run=0;run<20;run++){
  const board=new Minefield(4,.12),original=board.canAccess.bind(board);
  board.canAccess=function(id){const result=original(id);if(!this.cells[id].open)assert.equal(result,independentlyExposed(this,id));return result;};
  board.reveal(0);
  while(board.state==='playing'){
    const next=board.cells.find(c=>!c.mine&&!c.open&&board.canAccess(c.id));
    if(!next)break;assert.equal(board.reveal(next.id),true);
  }
  assert.equal(board.opened,board.cells.filter(c=>c.open&&!c.mine).length);
}
let tetraChecks=0;
for(let n=3;n<=7;n++){
  const board=new Minefield(n,.12,Math.random,'surface','tetra');
  assert.equal(board.cells.length,n**3);
  const faceOwners=new Map(),uniqueCells=new Set();let volume=0;
  for(const c of board.cells){
    const keys=c.vertices.map(v=>v.join(',')).sort();assert.ok(!uniqueCells.has(keys.join('|')));uniqueCells.add(keys.join('|'));
    for(const v of c.vertices){assert.ok(v.every(a=>a>=0));assert.ok(v.reduce((s,a)=>s+a,0)<=n);}
    const [a,b,d,e]=c.vertices,u=b.map((v,i)=>v-a[i]),v=d.map((p,i)=>p-a[i]),w=e.map((p,i)=>p-a[i]);
    const determinant=u[0]*(v[1]*w[2]-v[2]*w[1])-u[1]*(v[0]*w[2]-v[2]*w[0])+u[2]*(v[0]*w[1]-v[1]*w[0]);
    assert.equal(Math.abs(determinant),1);volume+=Math.abs(determinant)/6;
    for(let omit=0;omit<4;omit++){const key=c.vertices.filter((_,i)=>i!==omit).map(v=>v.join(',')).sort().join('|');faceOwners.set(key,(faceOwners.get(key)||0)+1);}
    assert.ok(board.neighbors(c.id).length<=4);
    for(const adjacent of board.neighbors(c.id)){
      assert.equal(c.vertices.filter(v=>adjacent.vertices.some(a=>a.join(',')===v.join(','))).length,3);
      assert.ok(board.neighbors(adjacent.id).some(a=>a.id===c.id));
    }
  }
  assert.ok(Math.abs(volume-n**3/6)<1e-8);assert.ok([...faceOwners.values()].every(count=>count===1||count===2));
  assert.equal([...faceOwners.values()].filter(count=>count===1).length,4*n*n);
  const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const c of board.neighbors(queue[i]))if(!seen.has(c.id)){seen.add(c.id);queue.push(c.id);}
  assert.equal(seen.size,n**3);
  const inner=board.cells.find(c=>!board.isBoundary(c));assert.ok(inner);assert.equal(board.reveal(inner.id),false);assert.equal(board.started,false);
  board.plant(0);assert.equal(board.cells[0].mine,false);
  for(const c of board.cells)assert.equal(c.count,board.neighbors(c.id).filter(a=>a.mine).length);
  const reached=new Set(),pending=[0];while(pending.length){const id=pending.pop(),c=board.cells[id];if(reached.has(id)||c.mine)continue;reached.add(id);if(!c.count)for(const b of board.neighbors(id))pending.push(b.id);}
  board.reveal(0);assert.deepEqual(board.cells.filter(c=>c.open).map(c=>c.id),[...reached].sort((a,b)=>a-b));
  const free=new Minefield(n,.12,Math.random,'free','tetra');free.reveal(inner.id);assert.equal(free.cells[inner.id].mine,false);
  for(const c of free.cells)if(!c.mine)free.reveal(c.id);assert.equal(free.state,'won');tetraChecks++;
}
console.log(`Passed: ${checks} free-mode boards, 20 surface-mode boards, 100 flood-fill comparisons (${zeroRegions} zero starts), and ${tetraChecks} tetrahedral meshes: volume, boundary, connectivity, <=4 neighbors, clues, exposure, flood fill and wins.`);
