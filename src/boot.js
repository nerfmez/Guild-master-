/* Kept as a small classic script so even a failed game bundle has visible status. */
(function(){
 'use strict';
 var complete=false,timer,notes=[];
 // Files opened from Android downloads (content://) have lost their GPU canvases, leaving
 // a blank scene. Software-backed 2D canvases keep their pixels, so request those there.
 var cpu=location.protocol==='content:';
 // Elsewhere the game's many baked sprite canvases are kept in main memory too: on tablets, GPU-backed
 // 2D canvases (hundreds of them) exhaust GPU memory and the whole page goes black or blank.
 // Only the game's own drawing surface stays on the GPU.
 {
  var getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,options){
   if(type==='2d'&&(cpu||this.id!=='guild-world')){options=Object.assign({willReadFrequently:true},options||{});}
   return getContext.call(this,type,options);
  };
 }
 function note(text){notes.push(String(text).slice(0,120));if(notes.length>6)notes.shift();}
 function detail(){return 'R36 · '+(cpu?'cpu-canvas':'gpu-canvas')+' · '+(notes.join(' | ')||'-');}
 function show(text,error,retry){
  var node=document.getElementById('scene-status');
  if(!node)return;
  node.hidden=false;
  node.querySelector('span').textContent=text;
  var small=node.querySelector('small');
  if(!small){small=document.createElement('small');node.appendChild(small);}
  small.textContent=(error?String(error&&error.message||error).slice(0,240)+' · ':'')+detail();
  var button=node.querySelector('button');
  button.hidden=false;button.textContent='ลองเปิดอีกครั้ง';button.onclick=retry||function(){location.reload();};
 }
 function fail(error){
  clearTimeout(timer);note('fail: '+(error&&error.message||error));
  show('เปิดกิลด์ไม่สำเร็จ · R36',error||'เกมเริ่มทำงานไม่สำเร็จ');
 }
 window.guildBoot={version:'R36',cpuCanvas:cpu,fail:fail,note:note,show:show,detail:detail,ready:function(){complete=true;clearTimeout(timer);note('ready');var node=document.getElementById('scene-status');if(node)node.hidden=true;}};
 window.addEventListener('error',function(event){note('error: '+(event.error&&event.error.message||event.message));if(!complete)fail(event.error||event.message);});
 window.addEventListener('unhandledrejection',function(event){note('rejection: '+(event.reason&&event.reason.message||event.reason));if(!complete)fail(event.reason);});
 timer=setTimeout(function(){fail('การเริ่มฉากใช้เวลานานเกินไป');},45000);
})();
