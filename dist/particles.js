import {createShapePoints} from './particle-shapes.js';

// Sample the original strokes by arc length, without connecting separate strokes.
export function sampleStrokes(strokes, limit=1400) {
  const segments=[];let total=0;
  for(const stroke of strokes) for(let i=1;i<stroke.length;i++) {
    const a=stroke[i-1],b=stroke[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length>0){segments.push({a,b,length});total+=length;}
  }
  if(!total)return [];
  const count=Math.min(limit,Math.max(2,Math.ceil(total/2))),step=total/count,points=[];
  let segment=0,offset=0;
  for(let i=0;i<count;i++) {
    const distance=(i+.5)*step;
    while(segment<segments.length-1&&offset+segments[segment].length<distance)offset+=segments[segment++].length;
    const {a,b,length}=segments[segment],t=(distance-offset)/length;
    points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
  }
  return points;
}

export class ParticleArtwork {
  constructor(canvas,onPhase) {
    this.canvas=canvas;this.context=canvas.getContext('2d');this.onPhase=onPhase;
    this.active=false;this.frame=0;this.duration=4600;this.elapsed=0;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('visibilitychange',()=>{
      if(!this.active||this.elapsed>=this.duration)return;
      if(document.hidden){cancelAnimationFrame(this.frame);this.elapsed=Math.min(performance.now()-this.start,this.duration);}
      else if(this.elapsed<this.duration){this.start=performance.now()-this.elapsed;this.tick(performance.now());}
    });
    this.reduced.addEventListener('change',()=>{if(this.active&&this.reduced.matches){cancelAnimationFrame(this.frame);this.elapsed=this.duration;this.draw(this.duration);}});
  }
  play(strokes,category) {
    this.stop();const points=sampleStrokes(strokes);
    if(!points.length)return false;
    const targets=createShapePoints(category?.id);
    this.categoryName=category?.name??'作品';
    this.points=(targets.length?targets:points.map(([x,y])=>({x,y,color:'#bba4ff'}))).map((target,i,all)=>{
      const [x,y]=points[Math.floor(i*points.length/all.length)];
      const angle=Math.random()*Math.PI*2,radius=45+Math.random()*135;
      return {x,y,tx:target.x,ty:target.y,dx:Math.cos(angle)*radius,dy:Math.sin(angle)*radius,phase:Math.random()*Math.PI*2,radius:1.7+Math.random()*.5,color:target.color};
    });
    this.active=true;this.start=performance.now();this.elapsed=0;this.phase='';
    if(this.reduced.matches){this.elapsed=this.duration;this.draw(this.duration);}
    else this.tick(this.start);
    return true;
  }
  tick(now) {
    if(!this.active)return;
    this.elapsed=Math.min(now-this.start,this.duration);this.draw(this.elapsed);
    if(this.elapsed<this.duration)this.frame=requestAnimationFrame(time=>this.tick(time));
  }
  resize(width,height) {
    this.canvas.width=width;this.canvas.height=height;
    if(this.active)this.draw(this.elapsed);
  }
  draw(time) {
    const ctx=this.context,w=this.canvas.width,h=this.canvas.height,scale=Math.min(w,h)/600;
    const ox=(w-600*scale)/2,oy=(h-600*scale)/2;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
    const phase=time<650?'正在把笔画变成星尘':time<2100?'让灵感散开':time<4600?`正在聚成彩色${this.categoryName}`:`送你一份星光画成的${this.categoryName}`;
    if(phase!==this.phase){this.phase=phase;this.onPhase(phase);}
    const progress=Math.max(0,Math.min(1,(time-650)/3950)),spread=Math.sin(Math.PI*progress)**2;
    const morph=Math.max(0,Math.min(1,(time-1700)/2900)),blend=morph*morph*(3-2*morph);
    ctx.globalCompositeOperation='source-over';
    for(const p of this.points) {
      const x=(p.x+(p.tx-p.x)*blend+p.dx*spread+Math.sin(progress*6.28+p.phase)*7*spread)*scale+ox;
      const y=(p.y+(p.ty-p.y)*blend+p.dy*spread+Math.cos(progress*6.28+p.phase)*7*spread)*scale+oy;
      const radius=p.radius*scale;
      ctx.globalAlpha=.12;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,radius*2.3,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=.72+.28*Math.sin(p.phase+progress*4);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  stop() {
    cancelAnimationFrame(this.frame);this.active=false;this.elapsed=0;
    this.context.clearRect(0,0,this.canvas.width,this.canvas.height);
  }
}
