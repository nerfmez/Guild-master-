import { deserializeGame, serializeGame } from './game.js';

export const SAVE_SLOT_COUNT = 3;
const legacyKey = 'little-leaf-guild:v1';
const activeKey = 'little-leaf-guild:active-slot';
export function saveSlotKeys(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > SAVE_SLOT_COUNT) throw new RangeError('Invalid save slot');
  // Keep the original keys for slot 1: existing saves and backups need no rewrite.
  const save = slot === 1 ? legacyKey : `${legacyKey}:slot:${slot}`;
  return { save, backup: save + ':backup', seen: save + ':seen', corrupt: save + ':corrupt',
    lessons: slot === 1 ? 'guild-master:lessons' : `guild-master:lessons:slot:${slot}`,
    coach: slot === 1 ? 'guild-master:coach' : `guild-master:coach:slot:${slot}` };
}
export function activeSaveSlot(storage) {
  try { const slot = Number(storage.getItem(activeKey)); return slot >= 1 && slot <= SAVE_SLOT_COUNT && Number.isInteger(slot) ? slot : 1; }
  catch { return 1; }
}
export function readSaveSlot(storage, slot) {
  const keys = saveSlotKeys(slot), result = { slot, state: null, status: 'empty', occupied: false, seen: 0, notice: '' };
  try {
    const primary = storage.getItem(keys.save), backup = storage.getItem(keys.backup);
    result.occupied = Boolean(primary || backup);
    const seen = Number(storage.getItem(keys.seen));
    result.seen = Number.isFinite(seen) && seen > 0 ? seen : 0;
    for (const [source, status] of [[primary, 'saved'], [backup, 'recovered']]) {
      if (!source) continue;
      try { result.state = deserializeGame(source); result.status = status;
        if (status === 'recovered') result.notice = `กู้เซฟช่อง ${slot} จากบันทึกสำรองแล้ว`; return result; }
      catch { /* Try this slot's backup, leaving the original data intact. */ }
    }
    if (result.occupied) { result.status = 'corrupt'; result.notice = `อ่านเซฟช่อง ${slot} ไม่ได้ ข้อมูลเดิมยังถูกเก็บไว้`; }
  } catch { result.status = 'unavailable'; result.notice = 'อ่านเซฟจากเบราว์เซอร์ไม่ได้'; }
  return result;
}
export function writeSaveSlot(storage, slot, state, now = Date.now()) {
  const keys = saveSlotKeys(slot), data = serializeGame(state), previous = storage.getItem(keys.save);
  if (previous) {
    let valid = false; try { deserializeGame(previous); valid = true; } catch { /* Archive a damaged primary. */ }
    storage.setItem(valid ? keys.backup : keys.corrupt, previous);
  }
  storage.setItem(keys.save, data);
  storage.setItem(keys.seen, String(now));
  storage.setItem(activeKey, String(slot));
}
