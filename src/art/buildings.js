(()=>{
  'use strict';
  const A=window.ArtCore;
  if(!A)throw new Error('ArtCore must load before VillageBuildings');
  const {rng,rect,poly,line,ellipse,shade,createCanvas}=A;
  const cache=new Map();
  const C={outline:'#60472f',deep:'#795537',oak:'#a87c4c',oakLight:'#c39a62',oakTop:'#d2b279',
    oakShadow:'#88633d',plaster:'#d4c5a6',plasterLight:'#e5d8b7',plasterShadow:'#c0ad8a',
    mortar:'#8b8068',stone:'#b9b39c',stoneLight:'#cec7ae',stoneShade:'#a29b86',
    glass:'#687b77',glassLight:'#b4bda0',glassShade:'#4e625d',red:'#a1563e',gold:'#d5b278',
    leaf:'#819244',leafLight:'#a5ad58',leafDark:'#667a37',flower:'#e9dca0'};
  function outline(c,points,color=C.outline,width=1){for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];line(c,a[0],a[1],b[0],b[1],color,width);}}
  function frame(c,x,y,w,h,base,light=C.oakTop){rect(c,x,y,w,h,C.outline);rect(c,x+1,y+1,w-2,h-2,base);rect(c,x+1,y+1,w-2,1,light);rect(c,x+1,y+2,1,h-3,light);}
  function plank(c,x,y,w,h,random,vertical=true,base=C.oak){
    rect(c,x,y,w,h,C.outline);rect(c,x+1,y+1,w-2,h-2,base);
    const count=vertical?Math.max(1,Math.floor((w-2)/6)):Math.max(1,Math.floor((h-2)/5));
    for(let i=0;i<count;i++){
      const start=vertical?x+1+Math.round(i*(w-2)/count):y+1+Math.round(i*(h-2)/count),end=vertical?x+1+Math.round((i+1)*(w-2)/count):y+1+Math.round((i+1)*(h-2)/count);
      const tone=shade(base,Math.floor(random()*11)-5);
      if(vertical){rect(c,start,y+1,end-start-1,h-2,tone);rect(c,start,y+2,1,h-4,C.oakLight);
        if(h>13&&random()<.8){const yy=y+5+Math.floor(random()*(h-10));line(c,start+2,yy,start+2,Math.min(y+h-3,yy+5),shade(tone,-14));}}
      else{rect(c,x+1,start,w-2,end-start-1,tone);rect(c,x+2,start,w-4,1,C.oakLight);}
    }
  }
  function timber(c,x,y,w,h){frame(c,x,y,w,h,C.oak,C.oakLight);if(w>h){rect(c,x+2,y+h-2,w-4,1,C.oakShadow);line(c,x+8,y+2,x+18,y+2,C.oakTop);}else{rect(c,x+w-2,y+3,1,h-5,C.oakShadow);rect(c,x+2,y+6,1,Math.max(3,h-14),C.oakTop);}}
  function glassWindow(c,x,y,w,h,lattice=true){
    frame(c,x,y,w,h,C.oak,C.oakTop);rect(c,x+3,y+3,w-6,h-7,C.glassShade);
    rect(c,x+4,y+4,w-8,h-9,C.glass);rect(c,x+4,y+4,w-8,3,C.glassLight);
    if(lattice){
      const left=x+4,right=x+w-5,top=y+4,bottom=y+h-5;
      for(let s=-h;s<w+h;s+=6){
        for(let xx=left;xx<=right;xx++){const yy=top+xx-left-s;if(yy>=top&&yy<=bottom)rect(c,xx,yy,1,1,C.oakTop);}
        for(let xx=left;xx<=right;xx++){const yy=top+s-(xx-left);if(yy>=top&&yy<=bottom)rect(c,xx,yy,1,1,C.oakLight);}
      }
    }
    const middle=x+Math.floor(w/2);rect(c,middle,y+2,2,h-5,C.outline);rect(c,middle,y+3,1,h-7,C.oakLight);
    rect(c,x+2,y+Math.floor(h*.58),w-4,2,C.outline);rect(c,x+3,y+Math.floor(h*.58),w-6,1,C.oakLight);
    frame(c,x-2,y+h-3,w+4,4,C.oak,C.oakTop);rect(c,x+3,y+h+1,w-1,1,'#8c7552');
  }
  function masonry(c,x,y,w,h,random){
    rect(c,x,y,w,h,C.outline);rect(c,x+1,y+1,w-2,h-2,C.mortar);
    for(let row=0,yy=y+2;yy<y+h-1;row++,yy+=8){
      let xx=x+1-(row%2)*8;
      while(xx<x+w-1){const sw=14+Math.floor(random()*9),left=Math.max(x+1,xx),right=Math.min(x+w-1,xx+sw-1),hh=Math.min(7,y+h-1-yy);
        if(right>left&&hh>0){const color=shade(C.stone,Math.floor(random()*12)-6);rect(c,left,yy,right-left,hh,color);rect(c,left,yy,right-left,1,C.stoneLight);if(right-left>8&&random()<.35)rect(c,left+2,yy+2,4,1,shade(color,5));}
        xx+=sw;
      }
    }
    rect(c,x+w-3,y+1,2,h-2,C.stoneShade);
  }
  function flowerBox(c,x,y,w,random){
    frame(c,x,y,w,7,C.oak,C.oakTop);rect(c,x+3,y+5,w-6,1,C.oakShadow);
    for(let i=0;i<w-4;i+=5){const xx=x+2+i,yy=y-3-Math.floor(random()*4);ellipse(c,xx+1,yy+2,4,3,C.leafDark);ellipse(c,xx,yy,3,3,C.leaf);rect(c,xx-1,yy-1,3,1,C.leafLight);
      if(i%10===0){rect(c,xx-1,yy-3,3,1,C.flower);rect(c,xx,yy-4,1,3,C.flower);rect(c,xx,yy-3,1,1,C.gold);}}
  }
  function door(c,x,y,w,h,random,arched=false){
    rect(c,x-2,y-2,w+4,h+3,C.outline);plank(c,x,y,w,h,random,true,C.oak);
    if(arched){poly(c,[[x-2,y+6],[x+1,y],[x+w/2,y-4],[x+w-1,y],[x+w+2,y+6]],C.oakShadow);line(c,x-1,y+4,x+3,y,C.oakTop);}
    rect(c,x+1,y+4,w-2,2,C.oakTop);rect(c,x+1,y+h-5,w-2,3,C.oakShadow);line(c,x+2,y+h-5,x+w-3,y+h-5,C.oakLight);
    const cx=x+w-7,cy=y+h*.58;ellipse(c,cx,cy,3,3,C.outline);ellipse(c,cx,cy-1,2,2,C.gold);rect(c,cx,cy-2,1,1,C.oakTop);
    rect(c,x+2,y+9,3,1,C.outline);rect(c,x+2,y+h-8,3,1,C.outline);
  }
  function roofPlane(c,side,random,roof,geom){
    const {cx,top,front,left,right,eaveBack,eaveFront}=geom;
    const eave=side==='left'?left:right,base=roof==='terra'?(side==='left'?'#ae7956':'#885c43'):(side==='left'?'#958d7f':'#7b7268');
    const p=(u,v)=>[Math.round(cx+(eave-cx)*u),Math.round(top+(eaveBack-top)*u+(front-top)*v)];
    const perimeter=[p(0,0),p(1,0),p(1,1),p(0,1)];poly(c,perimeter,base);
    const bands=6,rows=7,seams=[];
    for(let band=0;band<bands;band++){
      const u0=band/bands,u1=(band+1)/bands,shift=band%2?.5:0;
      const joints=Array.from({length:rows+1},()=>random()*.035-.0175);
      for(let row=-1;row<rows;row++){
        const v0=Math.max(0,(row+shift)/rows+(joints[row]||0)),v1=Math.min(1,(row+1+shift)/rows+(joints[row+1]||0));if(v1<=v0)continue;
        const a=p(u0,v0),b=p(u1,v0),d=p(u0,v1),e=p(u1,v1);
        let delta=Math.floor(random()*21)-10;
        if(band>=4)delta-=3;if(side==='left'&&band<=1)delta+=3;
        const tone=shade(base,delta),edge=roof==='terra'?'#75503a':'#6f5540';
        // Slight clipped corners preserve the hand-built slate rhythm without adding pixel noise.
        poly(c,[a,b,[e[0],e[1]-1],[e[0]+(side==='left'?1:-1),e[1]],[d[0],d[1]]],tone);
        line(c,a[0],a[1],b[0],b[1],shade(tone,10));
        line(c,d[0],d[1],e[0],e[1],edge);
        line(c,b[0],b[1]+1,e[0],e[1],shade(tone,-12));
        const sign=side==='left'?-1:1,chipped=random()<.38;
        // A stepped underlip and occasional broken corner avoid perfect grid rectangles.
        const middle=[Math.round(d[0]*.38+e[0]*.62),Math.round(d[1]*.38+e[1]*.62)];
        const lip=chipped?[d,[middle[0]-sign,middle[1]],[middle[0]-sign,middle[1]-1],[e[0]-sign*2,e[1]-1],[e[0]-sign*2,e[1]+1],e]:[d,e];
        for(let i=0;i<lip.length-1;i++){
          seams.push({a:[lip[i][0],lip[i][1]+1],b:[lip[i+1][0],lip[i+1][1]+1],color:shade(edge,-7)});
          seams.push({a:lip[i],b:lip[i+1],color:edge});
        }
        seams.push({a:b,b:e,color:shade(edge,4)});
        // Broad facets create quiet material clusters: light is consistently upper-left.
        if(v1-v0>.055){const aa=p(u0+.018,v0+.018),bb=p(u1-.024,v0+.018),ee=p(u1-.055,v1-.045),dd=p(u0+.018,v1-.026);
          const mid=[Math.round((aa[0]+ee[0])/2),Math.round((aa[1]+ee[1])/2)];
          const facet=random()<.45?[aa,bb,[bb[0],bb[1]+3],[mid[0]+2,mid[1]-2],[mid[0]+2,mid[1]+2],ee,[dd[0],dd[1]-3],dd]:[aa,bb,ee,dd];
          poly(c,facet,shade(tone,side==='left'?9:4));
          if(random()<.16){const crack=p(u1-.025,v1-.042);line(c,crack[0],crack[1]-4,crack[0]+(side==='left'?-2:2),crack[1],shade(tone,-20));}}
      }
    }
    // Draw underlips after all shingle fills, so neighbouring tiles cannot erase them.
    for(const seam of seams)line(c,seam.a[0],seam.a[1],seam.b[0],seam.b[1],seam.color);
    outline(c,perimeter,C.outline,1);
    line(c,eave,eaveBack,eave,eaveFront,C.outline,2);
    line(c,side==='left'?eave+1:eave-1,eaveBack+2,side==='left'?eave+1:eave-1,eaveFront-1,shade(base,5));
  }
  function chimney(c,x,y,random){
    // The narrow right face and cap establish depth without changing the front-facing projection.
    rect(c,x+2,y+1,20,56,C.outline);rect(c,x+3,y+2,15,53,C.stone);
    rect(c,x+18,y+3,4,52,C.stoneShade);rect(c,x+3,y+2,15,2,C.stoneLight);
    for(let row=0;row<7;row++){const yy=y+4+row*7;rect(c,x+3,yy+5,15,1,C.mortar);rect(c,x+3+(row%2?7:3),yy,1,5,C.mortar);}
    frame(c,x,y-3,26,8,C.stone,C.stoneLight);rect(c,x+4,y-2,16,3,C.outline);rect(c,x+5,y-2,14,1,'#857b64');
    rect(c,x+3,y+48,14,4,C.stoneLight);
  }
  function guildBanner(c,x,y){
    rect(c,x-2,y-2,19,3,C.outline);rect(c,x,y,15,28,C.red);poly(c,[[x,y+26],[x+7,y+22],[x+15,y+26],[x+15,y+30],[x+7,y+26],[x,y+30]],C.red);
    rect(c,x+1,y+1,1,22,shade(C.red,16));rect(c,x+7,y+5,2,13,C.gold);rect(c,x+3,y+16,9,2,C.gold);rect(c,x+7,y+18,2,4,C.oakTop);
    poly(c,[[x+8,y+11],[x+11,y+7],[x+14,y+7],[x+14,y+10],[x+10,y+13]],'#b9ba7b');
  }
  function guildAnnex(c,random,roof){
    // A lower single-storey stone wing nests behind the main left eave.
    masonry(c,8,153,67,69,random);rect(c,9,154,65,4,C.stoneShade);
    poly(c,[[4,156],[43,129],[83,156]],C.plasterShadow);
    const geom={cx:43,top:63,front:129,left:3,right:83,eaveBack:90,eaveFront:156};
    roofPlane(c,'left',random,roof,geom);roofPlane(c,'right',random,roof,geom);
    line(c,43,63,43,129,C.outline,4);line(c,42,64,42,127,C.oakLight);
    line(c,3,156,43,129,C.outline,4);line(c,43,129,83,156,C.outline,4);
    line(c,4,154,42,127,C.oakLight);line(c,44,128,82,154,C.oak);
    frame(c,8,155,67,4,C.oakShadow,C.oakLight);
    glassWindow(c,19,168,19,25,true);glassWindow(c,48,195,14,22,true);
    frame(c,10,217,29,5,C.oak,C.oakTop);
    rect(c,10,159,2,55,C.stoneLight);rect(c,70,159,4,62,C.stoneShade);
  }
  function guildPorch(c,random){
    // A shaded wooden supply porch with a weathered cream canvas lean-to.
    plank(c,197,192,62,39,random,false,C.oak);rect(c,198,192,60,6,C.oakShadow);
    plank(c,201,188,51,31,random,true,C.oakShadow);
    const cloth=[[195,164],[248,166],[261,190],[198,190]];
    poly(c,cloth,'#c7b98f');
    for(let i=0;i<5;i++){
      const x0=196+i*10.5,x1=x0+5.8,front0=198+i*12.5,front1=front0+7;
      poly(c,[[x0,165+i*.38],[x1,165+(i+.6)*.38],[front1,188],[front0,188]],i%2?'#e0d3ac':'#d9cda4');
    }
    poly(c,[[200,184],[259,184],[261,190],[198,190]],'#b4a47d');
    for(let i=0;i<7;i++){rect(c,200+i*8,188,5,4,'#d5c59c');rect(c,200+i*8,192,5,2,'#c2b189');}
    outline(c,cloth,C.outline);line(c,196,164,248,166,C.oakTop);line(c,198,190,261,190,C.oakShadow,2);
    timber(c,200,193,4,39);timber(c,255,193,4,39);
    frame(c,208,205,37,15,C.oak,C.oakTop);plank(c,211,208,30,10,random,false,C.oakShadow);
    frame(c,209,201,36,6,C.oakLight,C.oakTop);rect(c,214,198,9,4,C.deep);rect(c,215,197,7,3,C.oakTop);
    frame(c,196,230,65,4,C.oakShadow,C.oakLight);
    // A rolled guild map and a pair of cloth sacks distinguish the porch from a doorway.
    rect(c,228,194,11,7,C.plaster);rect(c,228,194,11,1,C.plasterLight);rect(c,232,196,1,5,C.oakShadow);
    ellipse(c,213,224,5,5,C.plasterShadow);rect(c,211,220,4,1,C.oakShadow);
  }
  function scaleSprite(result,scale){
    scale=Math.max(1,Math.round(Number(scale)||1));if(scale===1)return result;
    const canvas=createCanvas(result.width*scale,result.height*scale);canvas.getContext('2d').drawImage(result.canvas,0,0,canvas.width,canvas.height);
    return {canvas,width:canvas.width,height:canvas.height,footX:result.footX*scale,footY:result.footY*scale};
  }
  function makeHouse(options={}){
    const {seed=214,variant='guild',roof='slate',scale=1}=options,key=`house:${seed}:${variant}:${roof}:${scale}`;if(cache.has(key))return cache.get(key);
    const random=rng(seed),canvas=createCanvas(188,236),c=canvas.getContext('2d');
    // Body is drawn first; the enormous roof casts a narrow warm shadow across the fascia.
    masonry(c,29,185,132,43,random);rect(c,30,187,129,3,C.stoneShade);
    rect(c,29,153,132,34,C.outline);rect(c,30,154,130,32,variant==='workshop'?C.oak:C.plaster);
    if(variant==='workshop')plank(c,31,155,128,30,random,true,C.oak);
    else{
      rect(c,34,157,119,25,C.plaster);rect(c,35,157,117,3,C.plasterLight);
      poly(c,[[35,178],[60,178],[60,182],[35,182]],C.plasterLight);rect(c,121,162,31,18,C.plasterShadow);
      line(c,35,181,58,159,C.oakShadow,4);line(c,36,181,59,159,C.oakLight,2);
      line(c,128,159,153,181,C.oakShadow,4);line(c,129,159,154,181,C.oakLight,2);
    }
    const gable=[[16,157],[94,110],[172,157]];poly(c,gable,variant==='workshop'?C.oak:C.plaster);
    poly(c,[[32,152],[91,117],[91,151]],variant==='workshop'?C.oakLight:C.plasterLight);
    if(variant==='workshop'){for(let x=40;x<159;x+=7){const top=110+Math.abs(x-94)*47/78;line(c,x,top+4,x,155,C.oakShadow);line(c,x+1,top+4,x+1,154,C.oakLight);}}
    const geom={cx:94,top:6,front:108,left:12,right:176,eaveBack:57,eaveFront:159};
    roofPlane(c,'left',random,roof,geom);roofPlane(c,'right',random,roof,geom);
    // Ridge cap follows the receding vertical ridge, which is the defining camera cue.
    line(c,94,6,94,108,C.outline,5);line(c,93,7,93,107,C.oakLight,2);line(c,95,9,95,107,C.oakShadow);
    for(let y=14;y<105;y+=13)line(c,92,y,96,y,C.outline);
    line(c,12,159,94,109,C.outline,5);line(c,94,109,176,159,C.outline,5);
    line(c,12,157,94,107,C.oakLight,2);line(c,94,108,176,158,C.oak,2);
    line(c,17,157,94,112,C.oakTop);line(c,96,112,172,158,C.oakShadow);
    rect(c,29,158,132,4,C.oakShadow);timber(c,28,154,134,5);timber(c,29,185,132,5);
    timber(c,30,158,5,28);timber(c,68,158,4,28);timber(c,91,159,5,27);timber(c,118,158,4,28);timber(c,155,158,5,28);
    timber(c,91,114,5,39);timber(c,65,127,4,27);timber(c,120,127,4,27);
    // Plaster is worn in broad patches, rather than covered by independent random pixels.
    if(variant!=='workshop'){
      poly(c,[[38,150],[48,143],[59,143],[59,149],[49,149],[49,152],[38,152]],C.plasterLight);
      poly(c,[[127,143],[137,144],[150,152],[133,152],[133,148],[127,148]],C.plasterShadow);
    }
    // Gable vents, two upper windows and real ground-floor entry.
    frame(c,83,136,22,15,C.oak,C.oakTop);rect(c,86,140,16,9,C.outline);
    for(let x=87;x<102;x+=4){rect(c,x,140,2,9,C.oakShadow);rect(c,x,140,1,8,C.oakTop);}
    glassWindow(c,41,162,24,23,true);glassWindow(c,124,162,25,23,true);
    if(variant==='guild')guildBanner(c,79,160);
    if(variant==='workshop'){
      door(c,92,196,47,31,random);line(c,115,197,115,226,C.outline,2);glassWindow(c,42,198,20,24,true);
    }else{
      door(c,105,197,29,31,random);glassWindow(c,43,198,20,24,true);
      flowerBox(c,36,221,43,random);
    }
    frame(c,101,226,38,5,C.oak,C.oakTop);frame(c,98,231,44,4,C.oakShadow,C.oakLight);
    rect(c,102,228,36,1,C.oakLight);rect(c,100,232,40,1,C.oakLight);
    // Roof breaks and a single chimney keep the house specific without overfilling the silhouette.
    chimney(c,47,25,random);
    rect(c,158,192,3,32,C.stoneShade);rect(c,31,225,60,3,C.stoneShade);
    let finalCanvas=canvas,width=188,footX=94;
    if(variant==='guild'){
      finalCanvas=createCanvas(264,236);const gc=finalCanvas.getContext('2d');
      guildAnnex(gc,rng(Number(seed)+811),roof);guildPorch(gc,rng(Number(seed)+1731));gc.drawImage(canvas,38,0);
      width=264;footX=132;
    }
    const result=scaleSprite({canvas:finalCanvas,width,height:236,footX,footY:235},scale);cache.set(key,result);return result;
  }
  function makeShed(options={}){
    const {seed=715,variant='workshop',roof='slate',scale=1}=options,key=`shed:${seed}:${variant}:${roof}:${scale}`;if(cache.has(key))return cache.get(key);
    const random=rng(seed),canvas=createCanvas(116,135),c=canvas.getContext('2d');
    masonry(c,18,97,82,31,random);plank(c,18,82,82,28,random,true,C.oak);
    poly(c,[[9,85],[58,56],[108,85]],C.oak);poly(c,[[15,81],[58,61],[58,82]],C.oakLight);
    const geom={cx:58,top:3,front:56,left:6,right:111,eaveBack:33,eaveFront:86};roofPlane(c,'left',random,roof,geom);roofPlane(c,'right',random,roof,geom);
    line(c,58,3,58,56,C.outline,4);line(c,57,4,57,55,C.oakLight);
    line(c,6,86,58,56,C.outline,4);line(c,58,56,111,86,C.outline,4);line(c,6,84,58,54,C.oakLight);line(c,59,55,110,84,C.oak);
    timber(c,18,83,82,4);timber(c,18,106,82,4);timber(c,18,86,4,21);timber(c,96,86,4,21);
    if(variant==='workshop'){door(c,49,95,37,34,random);line(c,67,98,67,128,C.outline);frame(c,29,91,12,12,C.oak,C.oakTop);rect(c,32,94,6,6,C.glassShade);}
    else{door(c,54,98,22,31,random);glassWindow(c,25,92,21,21,false);}
    frame(c,48,128,41,5,C.oak,C.oakTop);rect(c,51,131,35,1,C.oakShadow);
    const result=scaleSprite({canvas,width:116,height:135,footX:58,footY:133},scale);cache.set(key,result);return result;
  }
  window.VillageBuildings={makeHouse,makeShed};
})();
