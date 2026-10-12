import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, serializeGame, deserializeGame, normalizeProfile, PROFILE_LOOKS } from '../src/game.js';
import { saveSlotKeys, activeSaveSlot, readSaveSlot, writeSaveSlot } from '../src/save-slots.js';
function storage() { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)) }; }
const game = name => createGame(7, { opening: true, profile: { masterName: 'อาริน', guildName: name } });

test('legacy saves stay in slot 1 without being rewritten while browsing slots', () => {
  const s = storage(), data = serializeGame(game('กิลด์เดิม'));
  s.setItem('little-leaf-guild:v1',data); s.setItem('little-leaf-guild:v1:seen','123');
  const before = [...s.values];
  assert.equal(readSaveSlot(s,1).state.profile.guildName,'กิลด์เดิม');
  assert.equal(readSaveSlot(s,1).seen,123);
  assert.equal(readSaveSlot(s,2).status,'empty'); assert.equal(readSaveSlot(s,3).status,'empty');
  assert.deepEqual([...s.values],before); assert.equal(activeSaveSlot(s),1);
});
test('three saves keep their own progress, backups and idle timestamps', () => {
  const s = storage();
  for (let slot=1;slot<=3;slot++) writeSaveSlot(s,slot,game('กิลด์ '+slot),slot*1000);
  const two = readSaveSlot(s,2).state; two.gold=2500; writeSaveSlot(s,2,two,2200);
  assert.equal(readSaveSlot(s,1).state.gold,1200); assert.equal(readSaveSlot(s,3).state.gold,1200);
  assert.equal(readSaveSlot(s,2).state.gold,2500);
  assert.equal(deserializeGame(s.getItem(saveSlotKeys(2).backup)).gold,1200);
  assert.equal(s.getItem(saveSlotKeys(1).backup),null); assert.equal(s.getItem(saveSlotKeys(3).backup),null);
  assert.deepEqual([1,2,3].map(i=>readSaveSlot(s,i).seen),[1000,2200,3000]); assert.equal(activeSaveSlot(s),2);
});
test('damaged slots only recover from their own backup and preserve their primary', () => {
  const s=storage();writeSaveSlot(s,1,game('หนึ่ง'));writeSaveSlot(s,2,game('สอง'));writeSaveSlot(s,2,game('สองใหม่'));
  s.setItem(saveSlotKeys(2).save,'broken');
  const record=readSaveSlot(s,2);assert.equal(record.status,'recovered');assert.equal(record.state.profile.guildName,'สอง');assert.equal(s.getItem(saveSlotKeys(2).save),'broken');
  writeSaveSlot(s,2,record.state);assert.equal(s.getItem(saveSlotKeys(2).corrupt),'broken');
  s.setItem(saveSlotKeys(3).save,'broken');assert.equal(readSaveSlot(s,3).status,'corrupt');assert.equal(readSaveSlot(s,3).state,null);
});
test('storage failures do not overwrite an existing save and invalid slots are rejected', () => {
  const s=storage();writeSaveSlot(s,1,game('หนึ่ง'));const original=s.getItem(saveSlotKeys(1).save);
  s.setItem=()=>{throw new Error('quota');};assert.throws(()=>writeSaveSlot(s,1,game('ใหม่')),/quota/);assert.equal(s.getItem(saveSlotKeys(1).save),original);
  assert.equal(readSaveSlot(null,2).status,'unavailable');assert.equal(activeSaveSlot(null),1);
  for(const slot of [0,4,1.5,NaN])assert.throws(()=>saveSlotKeys(slot),RangeError);
});
test('new hair and outfit styles survive saves, editing and legacy defaults', () => {
  const s=game('ต้นกล้า');
  for(const hairStyle of PROFILE_LOOKS.hairStyle)for(const outfitStyle of PROFILE_LOOKS.outfitStyle){s.profile=normalizeProfile({...s.profile,hairStyle,outfitStyle});const p=deserializeGame(serializeGame(s)).profile;assert.equal(p.hairStyle,hairStyle);assert.equal(p.outfitStyle,outfitStyle);}
  assert.equal(normalizeProfile({hairStyle:'long'}).outfitStyle,'tunic');
  assert.equal(normalizeProfile({outfitStyle:'invalid'}).outfitStyle,'tunic');
});
