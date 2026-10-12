// Raster illustrations authored with Imagegen. Canvas only places the finished
// artwork; no geometry, emoji or procedural painting creates these images.
const ICONS = {
 hammer:'./assets/illustrated/hammer.png', scroll:'./assets/illustrated/scroll.png',
 people:'./assets/illustrated/people.png', house:'./assets/illustrated/house.png',
 coin:'./assets/illustrated/coin.png', lantern:'./assets/illustrated/lantern.png',
 sword:'./assets/illustrated/sword.png', banner:'./assets/illustrated/banner.png',
 wood:'./assets/illustrated/wood.png', stone:'./assets/illustrated/stone.png',
 herb:'./assets/illustrated/herb.png', bow:'./assets/illustrated/bow.png',
 staff:'./assets/illustrated/staff.png', shield:'./assets/illustrated/shield.png',
 armor:'./assets/illustrated/armor.png',
};
const REGIONS = {
 meadow:'./assets/illustrated/region-meadow.png',ruins:'./assets/illustrated/region-ruins.png',
 mist:'./assets/illustrated/region-mist.png',canyon:'./assets/illustrated/region-canyon.png',
 peak:'./assets/illustrated/region-peak.png',
};
const cache=new Map(),tickets=new WeakMap();
function imageAt(url){
 if(!cache.has(url)){
  const image=new Image();
  const ready=new Promise(resolve=>{image.onload=()=>resolve(image);image.onerror=()=>{console.warn('Illustration unavailable:',url);resolve(null);};});
  image.src=url;cache.set(url,{image,ready});
 }
 return cache.get(url);
}
function paint(canvas,url,locked=false){
 const token={};tickets.set(canvas,token);
 canvas.classList.add('illustrated-canvas');
 const draw=image=>{
  if(!image||tickets.get(canvas)!==token)return;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  if(locked)c.filter='grayscale(0.75) brightness(0.45)';
  // Cover scenic thumbnails; contain icons, keeping the entire silhouette.
  const scale=locked!==null?Math.max(w/image.width,h/image.height):Math.min(w/image.width,h/image.height);
  const dw=image.width*scale,dh=image.height*scale;
  c.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh);c.filter='none';
 };
 const asset=imageAt(url);if(asset.image.complete&&asset.image.naturalWidth)draw(asset.image);else asset.ready.then(draw);
}
export function illustratedIcon(key){
 return ICONS[key]?`<img class="drawn-icon" src="${ICONS[key]}" alt="" aria-hidden="true" draggable="false">`:'';
}
export function drawIllustratedIcon(canvas,type,size=40){
 const name=String(typeof type==='object'?(type.type||type.id||type.name):type).toLowerCase();
 const key=ICONS[name]?name:/staff|wand|magic/.test(name)?'staff':/bow/.test(name)?'bow':/armor|coat|robe|leather/.test(name)?'armor':/coin|gold|money/.test(name)?'coin':/ore|iron|stone/.test(name)?'stone':/wood|timber/.test(name)?'wood':/shield/.test(name)?'shield':/sword|blade/.test(name)?'sword':null;
 if(!key)return false;
 canvas.width=size;canvas.height=size;paint(canvas,ICONS[key],null);return true;
}
export function drawIllustratedRegion(canvas,region,locked=false){
 // Extra backing pixels keep tall board crops and retina thumbnails crisp.
 if(!canvas.dataset.illustrationResolution){canvas.width*=2;canvas.height*=2;canvas.dataset.illustrationResolution='2';}
 paint(canvas,REGIONS[region]||REGIONS.meadow,locked);
}
// Start all requests once at boot so the first menu opens with warm image cache.
if(typeof Image!=='undefined')for(const url of [...Object.values(ICONS),...Object.values(REGIONS)])imageAt(url);
