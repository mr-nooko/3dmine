(function(root){
  'use strict';
  class Minefield {
    constructor(n=4,density=.12,rng=Math.random,mode='surface',shape='cube'){
      this.n=n;this.rng=rng;this.mode=mode;this.shape=shape;this._exposed=null;
      if(shape==='tetra')this.makeTetrahedron();
      else this.cells=Array.from({length:n**3},(_,i)=>({id:i,x:i%n,y:Math.floor(i/n)%n,z:Math.floor(i/(n*n))}));
      for(const c of this.cells)Object.assign(c,{mine:false,open:false,flag:false,count:0});
      this.mineCount=Math.max(1,Math.min(this.cells.length-1,Math.round(this.cells.length*density)));
      this.started=false;this.state='ready';this.opened=0;
    }
    makeTetrahedron(){
      this.cells=[];const n=this.n,add=vertices=>{
        const average=axis=>vertices.reduce((s,v)=>s+v[axis],0)/4;
        this.cells.push({id:this.cells.length,x:average(0),y:average(1),z:average(2),vertices});
      };
      // Integer simplex lattice: upright/inverted tetrahedra and octahedra.
      // Split each octahedron along the same diagonal into four tetrahedra.
      // This exactly fills a regular parent tetrahedron, with n^3 equal-volume cells.
      for(let i=0;i<n;i++)for(let j=0;j<n-i;j++)for(let k=0;k<n-i-j;k++){
        const v=(a,b,c)=>[i+a,j+b,k+c],s=i+j+k;
        add([v(0,0,0),v(1,0,0),v(0,1,0),v(0,0,1)]);
        if(s<=n-2){const a=v(1,0,0),b=v(0,1,1),ring=[v(0,1,0),v(0,0,1),v(1,0,1),v(1,1,0)];
          for(let r=0;r<4;r++)add([a,b,ring[r],ring[(r+1)%4]]);
        }
        if(s<=n-3)add([v(1,1,0),v(1,0,1),v(0,1,1),v(1,1,1)]);
      }
      this._tetraNeighbors=this.cells.map(()=>[]);this._boundary=new Set();const faces=new Map();
      for(const c of this.cells)for(let omitted=0;omitted<4;omitted++){
        const key=c.vertices.filter((_,i)=>i!==omitted).map(v=>v.join(',')).sort().join('|');
        if(!faces.has(key))faces.set(key,[]);faces.get(key).push(c.id);
      }
      for(const owners of faces.values()){
        if(owners.length===1)this._boundary.add(owners[0]);
        else if(owners.length===2){this._tetraNeighbors[owners[0]].push(owners[1]);this._tetraNeighbors[owners[1]].push(owners[0]);}
        else throw new Error('Invalid tetrahedral face ownership');
      }
    }
    vertexPosition(v){const [x,y,z]=v.map(a=>a-this.n/4);return [x+y*.5+z*.5,-z*Math.sqrt(2/3),y*Math.sqrt(3)/2+z*Math.sqrt(3)/6];}
    position(c){return this.shape==='tetra'?this.vertexPosition([c.x,c.y,c.z]):[c.x-(this.n-1)/2,c.y-(this.n-1)/2,c.z-(this.n-1)/2];}
    neighbors(id){if(this.shape==='tetra')return this._tetraNeighbors[id].map(i=>this.cells[i]);const a=this.cells[id];return this.cells.filter(b=>b.id!==id&&Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1&&Math.abs(a.z-b.z)<=1);}
    faceNeighbors(id){if(this.shape==='tetra')return this.neighbors(id);const a=this.cells[id];return this.cells.filter(b=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.z-b.z)===1);}
    isBoundary(c){return this.shape==='tetra'?this._boundary.has(c.id):[c.x,c.y,c.z].some(v=>v===0||v===this.n-1);}
    // Only air connected to the exterior exposes a face. Visual transparency
    // and diagonal contact do not create access through solid cubes.
    exposedIds(){
      if(this._exposed)return this._exposed;
      const exposed=new Set(),air=new Set(),queue=[];
      const visit=c=>{if(c.open&&!c.mine){if(!air.has(c.id)){air.add(c.id);queue.push(c);}}else exposed.add(c.id);};
      for(const c of this.cells)if(this.isBoundary(c))visit(c);
      for(let i=0;i<queue.length;i++)for(const c of this.faceNeighbors(queue[i].id))visit(c);
      this._exposed=exposed;return exposed;
    }
    canAccess(id){return !!this.cells[id]&&(this.mode==='free'||this.exposedIds().has(id));}
    plant(safeId){
      const pool=this.cells.filter(c=>c.id!==safeId);
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
      for(let i=0;i<this.mineCount;i++)pool[i].mine=true;
      for(const c of this.cells)c.count=this.neighbors(c.id).filter(a=>a.mine).length;
      this.started=true;this.state='playing';
    }
    reveal(id){
      const c=this.cells[id];if(!c||c.open||c.flag||!this.canAccess(id)||this.state==='lost'||this.state==='won')return false;
      if(!this.started)this.plant(id);
      if(c.mine){c.open=true;this.state='lost';return true;}
      const queue=[c];let cursor=0;
      while(cursor<queue.length){
        // Only the player's initial click needs an exposed face. The clue at
        // each zero proves all of its rule-defined neighbors safe, including buried cells.
        const a=queue[cursor++];if(a.open||a.flag||a.mine)continue;
        a.open=true;this.opened++;this._exposed=null;
        if(a.count===0)for(const b of this.neighbors(a.id))if(!b.open&&!b.flag&&!b.mine)queue.push(b);
      }
      if(this.opened===this.cells.length-this.mineCount)this.state='won';return true;
    }
    toggleFlag(id){const c=this.cells[id];if(!c||c.open||!this.canAccess(id)||this.state==='won'||this.state==='lost')return false;c.flag=!c.flag;return true;}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=Minefield;else root.Minefield=Minefield;
})(typeof globalThis!=='undefined'?globalThis:this);
