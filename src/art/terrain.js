(()=>{
  'use strict';
  const {rng,rect,poly,line,ellipse,createCanvas}=ArtCore;
  const W=960,H=640;
  function hash(x,y,s=1){let n=Math.imul(x+374761393,668265263)^Math.imul(y+1274126177,1597334677)^s;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
  function noise(x,y,s=1){let ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(ix,iy,s)*(1-fx)+hash(ix+1,iy,s)*fx,b=hash(ix,iy+1,s)*(1-fx)+hash(ix+1,iy+1,s)*fx;return a*(1-fy)+b*fy;}
  function makeTerrain(){
    const canvas=createCanvas(W,H),c=canvas.getContext('2d'),r=rng(914);
    const grass=['#90982f','#939c32','#98a034','#9ca336','#a0a538'];
    for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4){const n=noise(x/150,y/120,72)*.75+noise(x/52,y/62,83)*.25;rect(c,x,y,4,4,grass[Math.min(4,Math.floor(n*5))]);}
    const p=createCanvas(W,H),pc=p.getContext('2d');
    pc.strokeStyle='white';pc.lineCap='round';pc.lineJoin='round';pc.lineWidth=29;
    pc.beginPath();pc.moveTo(579,-30);pc.bezierCurveTo(554,55,565,162,595,254);pc.bezierCurveTo(631,360,605,399,572,492);pc.bezierCurveTo(538,555,571,608,550,670);pc.stroke();
    pc.lineWidth=24;pc.beginPath();pc.moveTo(477,411);pc.bezierCurveTo(508,431,552,424,606,409);pc.stroke();
    pc.lineWidth=21;pc.beginPath();pc.moveTo(219,297);pc.bezierCurveTo(300,326,296,413,378,442);pc.bezierCurveTo(437,468,503,465,582,473);pc.stroke();
    pc.beginPath();pc.moveTo(716,274);pc.bezierCurveTo(702,330,654,340,624,350);pc.stroke();
    pc.beginPath();pc.moveTo(805,482);pc.bezierCurveTo(738,459,676,487,591,478);pc.stroke();
    ellipse(pc,611,410,73,44,'#fff');ellipse(pc,718,277,63,26,'#fff');ellipse(pc,210,296,76,24,'#fff');ellipse(pc,128,463,53,31,'#fff');
    const raw=pc.getImageData(0,0,W,H).data,paths=new Uint8Array(W*H),water=new Uint8Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const jx=Math.round((noise(x/12,y/12,991)-.5)*7),jy=Math.round((noise(x/11,y/11,77)-.5)*6);const xx=Math.max(0,Math.min(W-1,x+jx)),yy=Math.max(0,Math.min(H-1,y+jy));paths[y*W+x]=raw[(yy*W+xx)*4+3]>128?1:0;}
    const pixel=c.getImageData(0,0,W,H),d=pixel.data;
    const pathColors=[[213,190,132],[215,192,134],[217,194,136],[211,188,130]];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(paths[y*W+x]){
      const i=(y*W+x)*4;let k=Math.floor(noise(x/35,y/33,631)*4);const col=pathColors[Math.min(3,k)];d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];
      if((x>0&&!paths[y*W+x-1])||(y>0&&!paths[(y-1)*W+x])){d[i]=169;d[i+1]=148;d[i+2]=85;}
    }
    c.putImageData(pixel,0,0);
    for(let i=0;i<1250;i++){
      const x=Math.floor(r()*W),y=Math.floor(r()*H);if(paths[y*W+x]){if(r()<.2){rect(c,x,y,2,1,'#bda86f');rect(c,x+1,y-1,1,1,'#e3cc96');}continue;}
      const v=noise(x/60,y/50,55);if(v>.42){const col=r()<.58?'#acb13e':'#85902b';rect(c,x,y,2,1,col);rect(c,x+1,y-1,1,1,col);if(r()<.4)rect(c,x-1,y-2,1,2,col);}
    }
    for(let i=0;i<135;i++){
      const x=Math.floor(r()*W),y=Math.floor(r()*H);if(paths[y*W+x])continue;
      rect(c,x,y+2,1,2,'#7b8929');rect(c,x-1,y,3,2,'#ddd995');rect(c,x,y-1,1,4,'#f3e8b5');rect(c,x,y,1,1,'#c2a148');
    }
    // Blade groups grow into the path at its edge; avoid a clean ribbon outline.
    for(let y=6;y<H-6;y++)for(let x=6;x<W-6;x++){
      if(!paths[y*W+x]||r()>.018)continue;
      const edge=!paths[y*W+x-4]||!paths[y*W+x+4]||!paths[(y-4)*W+x]||!paths[(y+4)*W+x];
      if(!edge)continue;
      poly(c,[[x-3,y+2],[x-2,y-1],[x,y],[x+1,y-3],[x+2,y],[x+4,y+1],[x+3,y+3]],'#929a32');
      rect(c,x,y-1,1,3,'#b2b449');rect(c,x+2,y+1,1,2,'#7b852d');
    }
    for(let i=0;i<2800;i++){
      const x=Math.floor(r()*W),y=Math.floor(r()*H);if(!paths[y*W+x])continue;
      rect(c,x,y,r()<.2?2:1,1,r()<.6?'#c3ad76':'#e5cf97');
    }
    // The pond is drawn as a separate terrain region, with a stepped grass bank.
    pc.clearRect(0,0,W,H);
    const shore=[[0,337],[23,341],[39,355],[44,377],[48,413],[70,442],[89,461],[102,478],[141,481],[169,494],[188,518],[190,549],[179,580],[157,601],[154,640],[0,640]];
    poly(pc,shore,'#fff');const wd=pc.getImageData(0,0,W,H).data;
    for(let i=0;i<water.length;i++)water[i]=wd[i*4+3]>128?1:0;
    const out=c.getImageData(0,0,W,H),od=out.data;
    function inWater(x,y){return water[Math.max(0,Math.min(H-1,y))*W+Math.max(0,Math.min(W-1,x))];}
    for(let y=330;y<H;y++)for(let x=0;x<202;x++){
      const wet=inWater(x,y);let distance=99;
      for(const n of [1,3,6,9,14]){if(inWater(x+n,y)!==wet||inWater(x-n,y)!==wet||inWater(x,y+n)!==wet||inWater(x,y-n)!==wet){distance=n;break;}}
      let col;
      if(wet){col=distance<=3?[120,159,146]:distance<=9?[88,147,144]:[56,121,130];if(distance>9&&noise(x/25,y/25,424)>.59)col=[61,128,134];}
      else if(distance<=1)col=[111,116,54];else if(distance<=3)col=[155,151,82];else if(distance<=6)col=[180,165,112];
      if(col){const i=(y*W+x)*4;od[i]=col[0];od[i+1]=col[1];od[i+2]=col[2];}
    }
    c.putImageData(out,0,0);
    // Shore pebbles and submerged reed clumps retain the same pixel scale.
    for(const [x,y] of [[44,390],[74,453],[108,476],[176,505],[172,583],[160,618]]){
      ellipse(c,x,y,5,3,'#6f7753');ellipse(c,x-1,y-1,4,2,'#b4ab7a');rect(c,x-2,y-2,3,1,'#d0be8a');
    }
    for(const [x,y] of [[47,411],[92,472],[161,592]]){
      for(let j=0;j<7;j++){const xx=x+(j-3)*2;line(c,xx,y,xx+(j%3)-1,y-5-j%4,'#6c803a');rect(c,xx,y-7-j%3,1,3,'#997b43');}
    }
    // A short jetty: top surfaces and upright poles establish the ground angle.
    poly(c,[[111,521],[192,521],[201,555],[118,555]],'#315c62');
    rect(c,109,517,84,31,'#6a543a');
    for(let y=518;y<547;y+=5){rect(c,110,y,81,4,y%2?'#b79861':'#bea16a');rect(c,110,y,80,1,'#d4b882');line(c,113,y+3,186,y+3,'#927242');}
    for(const [x,y] of [[108,516],[190,516],[111,545],[190,545]]){rect(c,x,y,4,11,'#6a5032');rect(c,x,y,3,4,'#d7b478');rect(c,x+1,y,1,3,'#ecd098');}
    return {canvas,paths,water,W,H};
  }
  window.VillageTerrain={makeTerrain,noise,hash,W,H};
})();
