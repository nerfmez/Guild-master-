const R=new URL('../../',import.meta.url).pathname.replace(/\/$/,'');
const {simulate}=await import(R+'/tests/simulate.js');
const {serializeGame}=await import(R+'/src/game.js');
const {writeFileSync,mkdirSync}=await import('node:fs');mkdirSync('work',{recursive:true});
const secs=Number(process.argv[2]||3*3600);
const t=Date.now();const {state,metrics}=simulate(7,{maxSeconds:secs,maxMembers:10});
state.settings.paused=false;
writeFileSync('work/save.json',serializeGame(state));
console.log('rank',state.rank,'day',state.day,'members',state.members.length,'facilities',state.facilities.length,'missions',state.missions.filter(m=>m.status==='active').length,'village',JSON.stringify(state.village).length,'ms',Date.now()-t);
