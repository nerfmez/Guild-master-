/* Kept as a small classic script so even a failed game bundle has visible status. */
(function(){
 'use strict';
 var complete=false,timer;
 function fail(error){
  clearTimeout(timer);
  var node=document.getElementById('scene-status');
  if(!node)return;
  node.hidden=false;
  node.querySelector('span').textContent='เปิดกิลด์ไม่สำเร็จ · R7';
  var detail=node.querySelector('small');
  if(!detail){detail=document.createElement('small');node.appendChild(detail);}
  detail.textContent=String(error&&error.message||error||'เกมเริ่มทำงานไม่สำเร็จ').slice(0,240);
  var button=node.querySelector('button');
  button.hidden=false;button.textContent='ลองเปิดอีกครั้ง';button.onclick=function(){location.reload();};
 }
 window.guildBoot={version:'R7',fail:fail,ready:function(){complete=true;clearTimeout(timer);var node=document.getElementById('scene-status');if(node)node.hidden=true;}};
 window.addEventListener('error',function(event){if(!complete)fail(event.error||event.message);});
 window.addEventListener('unhandledrejection',function(event){if(!complete)fail(event.reason);});
 timer=setTimeout(function(){fail('การเริ่มฉากใช้เวลานานเกินไป');},15000);
})();
