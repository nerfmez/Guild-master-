(()=>{
  'use strict';
  function rng(seed=1){let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function poly(c,pts,color){
    if(pts.length<3)return;
    c.fillStyle=color;
    let minY=Math.ceil(Math.min(...pts.map(p=>p[1]))),maxY=Math.floor(Math.max(...pts.map(p=>p[1])));
    for(let y=minY;y<=maxY;y++){
      let cuts=[];const sy=y+.5;
      for(let i=0,j=pts.length-1;i<pts.length;j=i++){
        let a=pts[j],b=pts[i];
        if((a[1]<=sy&&b[1]>sy)||(b[1]<=sy&&a[1]>sy))cuts.push(a[0]+(sy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      cuts.sort((a,b)=>a-b);
      for(let i=0;i+1<cuts.length;i+=2){const x=Math.ceil(cuts[i]-.5),end=Math.ceil(cuts[i+1]-.5);if(end>x)c.fillRect(x,y,end-x,1);}
    }
  }
  function line(c,x0,y0,x1,y1,color,width=1){
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let e=dx+dy;
    const half=Math.floor(width/2);c.fillStyle=color;
    for(;;){c.fillRect(x0-half,y0-half,width,width);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}
  }
  function ellipse(c,cx,cy,rx,ry,color){c.fillStyle=color;for(let y=Math.ceil(cy-ry);y<=Math.floor(cy+ry);y++){const d=(y+.5-cy)/ry;if(Math.abs(d)>1)continue;const half=rx*Math.sqrt(1-d*d);const x=Math.ceil(cx-half-.5),end=Math.ceil(cx+half-.5);if(end>x)c.fillRect(x,y,end-x,1);}}
  function shade(hex,delta){const v=hex.replace('#','');return '#'+[0,2,4].map(i=>Math.max(0,Math.min(255,parseInt(v.slice(i,i+2),16)+delta)).toString(16).padStart(2,'0')).join('');}
  function createCanvas(w,h){const canvas=document.createElement('canvas');canvas.width=Math.ceil(w);canvas.height=Math.ceil(h);canvas.getContext('2d').imageSmoothingEnabled=false;return canvas;}
  window.ArtCore={rng,rect,poly,line,ellipse,shade,createCanvas};
})();
