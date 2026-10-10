/** All authored game content. Times are prototype seconds, not real-world hours. */
export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A'];
export const RANK_REQUIREMENTS = {
  F: { rep: 0, quest: null }, E: { rep: 35, quest: 'patrol' },
  D: { rep: 100, quest: 'escort' }, C: { rep: 210, quest: 'hollow' },
  B: { rep: 370, quest: 'ruins' }, A: { rep: 580, quest: 'rescue' },
};
export const REGIONS = [
  { id: 'meadow', name: 'ทุ่งใบชา', rank: 'F', color: '#a9c6a0', description: 'เส้นทางรอบหมู่บ้านและป่าอ่อนโยน' },
  { id: 'ruins', name: 'ซากหอระฆัง', rank: 'D', color: '#b7aed0', description: 'ค้นหาสาเหตุที่เสียงระฆังดังจากเมืองร้าง' },
  { id: 'mist', name: 'ป่าหมอกจันทร์', rank: 'B', color: '#90babe', description: 'ตามหาทีมสำรวจที่หายไปและรักษาหัวใจของป่า' },
];
export const JOBS = {
  warrior: { id: 'warrior', name: 'นักรบ', role: 'tank', color: '#d89c8c', power: 14, health: 95, stat: 'ป้องกัน', icon: '🛡', next: ['guardian', 'duelist'] },
  archer: { id: 'archer', name: 'นักธนู', role: 'scout', color: '#90b89d', power: 13, health: 65, stat: 'สำรวจ', icon: '🏹', next: ['ranger', 'sharpshooter'] },
  mage: { id: 'mage', name: 'นักเวท', role: 'magic', color: '#afa0cc', power: 15, health: 55, stat: 'เวทมนตร์', icon: '✦', next: ['sage', 'elementalist'] },
  healer: { id: 'healer', name: 'ผู้รักษา', role: 'heal', color: '#dec792', power: 9, health: 65, stat: 'รักษา', icon: '✚', next: ['cleric', 'bard'] },
  guardian: { id: 'guardian', name: 'ผู้พิทักษ์', role: 'tank', color: '#c8907e', power: 17, health: 125, parent: 'warrior', icon: '🛡', next: [] },
  duelist: { id: 'duelist', name: 'นักดาบ', role: 'damage', color: '#d99b97', power: 22, health: 90, parent: 'warrior', icon: '⚔', next: [] },
  ranger: { id: 'ranger', name: 'พรานป่า', role: 'scout', color: '#79a58e', power: 18, health: 80, parent: 'archer', icon: '🏹', next: [] },
  sharpshooter: { id: 'sharpshooter', name: 'มือยิง', role: 'damage', color: '#9ab697', power: 22, health: 65, parent: 'archer', icon: '➶', next: [] },
  sage: { id: 'sage', name: 'ปราชญ์', role: 'magic', color: '#ac9abd', power: 19, health: 80, parent: 'mage', icon: '✦', next: [] },
  elementalist: { id: 'elementalist', name: 'จอมเวทธาตุ', role: 'magic', color: '#bda6d4', power: 24, health: 60, parent: 'mage', icon: '✧', next: [] },
  cleric: { id: 'cleric', name: 'นักบวช', role: 'heal', color: '#d0bd88', power: 15, health: 90, parent: 'healer', icon: '✚', next: [] },
  bard: { id: 'bard', name: 'นักขับขาน', role: 'support', color: '#d5b39e', power: 20, health: 75, parent: 'healer', icon: '♪', next: [] },
};
export const FACILITIES = {
  reception: { id: 'reception', name: 'โต๊ะรับคำร้อง', description: 'รับคำร้อง เพิ่มชื่อเสียงจากภารกิจ 5% ต่อระดับ', w: 2, h: 1, cost: { gold: 180, wood: 8, stone: 4 }, unlockRank: 'F', color: '#dec6a1', maxLevel: 3 },
  dorm: { id: 'dorm', name: 'เตียงพัก', description: 'เพิ่มพื้นที่พักให้สมาชิก 4 คนและรองรับการพัก 2 คนต่อระดับ', w: 1, h: 2, cost: { gold: 220, wood: 12, stone: 3 }, unlockRank: 'F', color: '#bbaac9', maxLevel: 3 },
  infirmary: { id: 'infirmary', name: 'เตียงรักษา', description: 'รักษาบาดเจ็บพร้อมกัน 2 คนต่อระดับ คนเจ็บมากได้เตียงก่อน', w: 1, h: 2, cost: { gold: 240, wood: 8, stone: 6, herb: 4 }, unlockRank: 'F', color: '#b9cfbf', maxLevel: 3 },
  kitchen: { id: 'kitchen', name: 'เตาทำอาหาร', description: 'เพิ่มความสดชื่นและเร่งพักฟื้นสมาชิก', w: 1, h: 1, cost: { gold: 200, wood: 10, stone: 4 }, unlockRank: 'F', color: '#e6b799', maxLevel: 3 },
  training: { id: 'training', name: 'หุ่นฝึก', description: 'ฝึกได้พร้อมกัน 2 คนต่อระดับ สมาชิกผลัดกันใช้จุดฝึก', w: 1, h: 1, cost: { gold: 250, wood: 10, stone: 8 }, unlockRank: 'F', color: '#d1bd96', maxLevel: 3 },
  workshop: { id: 'workshop', name: 'โต๊ะช่าง', description: 'สร้างอาวุธและเครื่องรางจากวัตถุดิบ', w: 2, h: 1, cost: { gold: 260, wood: 12, stone: 8 }, unlockRank: 'F', color: '#aebec2', maxLevel: 3 },
  garden: { id: 'garden', name: 'แปลงสมุนไพร', description: 'เก็บสมุนไพรวันละครั้ง และช่วยให้กิลด์ร่มรื่น', w: 2, h: 2, cost: { gold: 180, wood: 8, stone: 2 }, unlockRank: 'E', color: '#aac3a0', maxLevel: 3 },
  library: { id: 'library', name: 'ชั้นตำรา', description: 'ฝึกได้เร็วขึ้นและรับมือภารกิจเวทได้ดี', w: 2, h: 0.75, cost: { gold: 420, wood: 18, stone: 8 }, unlockRank: 'D', color: '#acb8d0', maxLevel: 3 },
  lounge: { id: 'lounge', name: 'ชุดโต๊ะน้ำชา', description: 'เพิ่มขวัญกำลังใจ เปิดมื้อเลี้ยงกิลด์', w: 2, h: 1.5, cost: { gold: 320, wood: 14, stone: 6 }, unlockRank: 'E', color: '#d8aaa8', maxLevel: 3 },
  board: { id: 'board', name: 'กระดานคำร้อง', description: 'นักผจญภัยที่ว่างมาหยิบงานเอง ระดับ 2 และ 3 เพิ่มทีมที่ออกงานพร้อมกันได้อีกทีมละ 1', w: 1, h: 0.5, cost: { gold: 120, wood: 8 }, unlockRank: 'F', color: '#c9a77c', maxLevel: 3 },
  dispatch: { id: 'dispatch', name: 'โต๊ะวางแผน', description: 'เปิดทีมภารกิจที่สองเมื่อกิลด์ถึงระดับ E', w: 2, h: 1, cost: { gold: 340, wood: 12, stone: 10 }, unlockRank: 'E', color: '#9ebdb9', maxLevel: 3 },
};
export const ROOM_TYPES={
 dorm:{name:'ห้องพัก',color:'#dac2a3'},infirmary:{name:'ห้องพยาบาล',color:'#cbd4b9'},
 training:{name:'ห้องฝึก',color:'#d3b58e'},kitchen:{name:'ห้องครัว',color:'#dfc298'},
 workshop:{name:'ห้องช่าง',color:'#c5bba3'},library:{name:'ห้องอ่านหนังสือ',color:'#c8c2c5'},
 hall:{name:'ห้องอเนกประสงค์',color:'#ddc49f'}
};
export const BUILDING_STAGES=[
 {width:8,height:6,rank:'F',name:'พื้นที่เริ่มต้น'},
 {width:10,height:8,rank:'F',name:'ต่อเติมขั้น 1'},
 {width:12,height:10,rank:'E',name:'ต่อเติมขั้น 2'},
 {width:14,height:12,rank:'D',name:'ต่อเติมขั้น 3'}
];
export const MEMBERS = [
  { id: 'mira', name: 'มิรา', class: 'warrior', trait: 'ใจเย็น', description: 'อดีตคนเฝ้าประตูที่อยากปกป้องผู้คนมากกว่าประตู', hair: '#a66c59', starter: true, unlockRank: 'F', cost: 0 },
  { id: 'finn', name: 'ฟินน์', class: 'archer', trait: 'ช่างสังเกต', description: 'จำทางได้ดี แต่เผลอหยุดดูนกอยู่บ่อย ๆ', hair: '#967953', starter: true, unlockRank: 'F', cost: 0 },
  { id: 'lune', name: 'ลูน', class: 'mage', trait: 'ใฝ่รู้', description: 'นักเวทฝึกหัดผู้เก็บใบไม้คั่นหนังสือทุกเล่ม', hair: '#9a92bd', starter: true, unlockRank: 'F', cost: 0 },
  { id: 'noa', name: 'โนอา', class: 'healer', trait: 'อ่อนโยน', description: 'พกชาสมุนไพรและผ้าพันแผลเผื่อทุกคนเสมอ', hair: '#d0ab76', starter: true, unlockRank: 'F', cost: 0 },
  { id: 'sera', name: 'เซรา', class: 'archer', trait: 'รักอิสระ', description: 'ผู้ส่งจดหมายที่รู้เส้นทางเล็ก ๆ นอกเมือง', hair: '#bd7a78', unlockRank: 'E', cost: 230 },
  { id: 'toma', name: 'โทมา', class: 'warrior', trait: 'ขยัน', description: 'เด็กโรงตีเหล็กที่ถือโล่หนักได้ทั้งวัน', hair: '#826751', unlockRank: 'E', cost: 260 },
  { id: 'iris', name: 'ไอริส', class: 'healer', trait: 'ร่าเริง', description: 'เชื่อว่าซุปอุ่น ๆ ช่วยเยียวยาได้พอ ๆ กับเวท', hair: '#c0a16f', unlockRank: 'D', cost: 380 },
  { id: 'alba', name: 'อัลบา', class: 'mage', trait: 'รอบคอบ', description: 'อดีตผู้ดูแลหอระฆัง ถือกุญแจเก่าไว้เสมอ', hair: '#b4bec1', unlockRank: 'D', cost: 420 },
  { id: 'ren', name: 'เรน', class: 'warrior', trait: 'กล้าหาญ', description: 'นักเดินทางที่กลับมาเพื่อช่วยเมืองบ้านเกิด', hair: '#73818d', unlockRank: 'C', cost: 520 },
  { id: 'poppy', name: 'ป๊อปปี้', class: 'healer', trait: 'ช่างพูด', description: 'นักร้องประจำโรงเตี๊ยมผู้ชอบช่วยคน', hair: '#c79894', unlockRank: 'C', cost: 480 },
  { id: 'cedar', name: 'ซีดาร์', class: 'archer', trait: 'อดทน', description: 'พรานที่คอยส่งอาหารให้ทีมสำรวจในป่า', hair: '#82976a', unlockRank: 'B', cost: 650 },
  { id: 'yuki', name: 'ยูกิ', class: 'mage', trait: 'สุขุม', description: 'นักวิจัยที่ตามหาความทรงจำในป่าหมอก', hair: '#b2a8cf', unlockRank: 'B', cost: 680 },
];
export const QUESTS = [
  { id: 'patrol', name: 'ลาดตระเวนทางหมู่บ้าน', title: 'ก้าวแรกของกิลด์', region: 'meadow', description: 'ตรวจเส้นทางและพาชาวบ้านกลับบ้านอย่างปลอดภัย', duration: 48, rank: 'F', difficulty: 30, tags: ['scout'], reward: { gold: 110, wood: 6, stone: 2, herb: 1, rep: 14, xp: 24 }, cost: {}, energy: 16, enemy: 'สไลม์ใบไม้' },
  { id: 'herbs', name: 'เก็บใบชาแสงดาว', title: 'ชาอุ่นก่อนออกเดินทาง', region: 'meadow', description: 'เก็บสมุนไพรที่หุบเขา ระวังพุ่มหนาม', duration: 58, rank: 'F', difficulty: 34, tags: ['heal', 'scout'], reward: { gold: 90, wood: 3, stone: 1, herb: 7, rep: 12, xp: 28 }, cost: {}, energy: 17, enemy: 'พุ่มหนามจิ๋ว' },
  { id: 'escort', name: 'คุ้มกันรถขนขนมปัง', title: 'กลิ่นขนมปังบนทางไกล', region: 'meadow', description: 'ปกป้องรถส่งเสบียงจากหมูป่าที่หิวโหย', duration: 76, rank: 'E', difficulty: 46, tags: ['tank'], reward: { gold: 185, wood: 8, stone: 5, herb: 2, rep: 25, xp: 44 }, cost: { gold: 18 }, energy: 20, enemy: 'หมูป่าขนฟู' },
  { id: 'hollow', name: 'สำรวจโพรงใต้ต้นโอ๊ก', title: 'ระฆังที่ไม่มีใครตี', region: 'ruins', description: 'ตามเสียงระฆังใต้ดินเพื่อหาเบาะแสเมืองร้าง', duration: 98, rank: 'D', difficulty: 65, tags: ['scout', 'magic'], reward: { gold: 260, wood: 10, stone: 10, herb: 3, rep: 38, xp: 64 }, cost: { gold: 25, herb: 1 }, energy: 22, enemy: 'ผู้เฝ้าโพรง', requires: 'escort', story: true },
  { id: 'crystals', name: 'เก็บผลึกในทางเก่า', title: 'แสงใต้ซากหิน', region: 'ruins', description: 'ผลึกช่วยทำอุปกรณ์ใหม่ แต่อาจปลุกผู้เฝ้าซาก', duration: 90, rank: 'D', difficulty: 61, tags: ['magic'], reward: { gold: 235, wood: 4, stone: 14, herb: 2, rep: 31, xp: 58 }, cost: { gold: 22 }, energy: 21, enemy: 'โกเลมหินอ่อน' },
  { id: 'ruins', name: 'ปลดผนึกหอระฆัง', title: 'คำสัญญาของผู้ดูแล', region: 'ruins', description: 'ซ่อมผนึกเพื่อให้ชาวเมืองกลับไปยังบ้านเก่า', duration: 124, rank: 'C', difficulty: 87, tags: ['tank', 'magic'], reward: { gold: 365, wood: 12, stone: 12, herb: 6, rep: 58, xp: 88 }, cost: { gold: 35, herb: 2 }, energy: 24, enemy: 'ผู้พิทักษ์ระฆัง', requires: 'hollow', story: true },
  { id: 'mistpath', name: 'เปิดเส้นทางป่าหมอก', title: 'รอยเท้าในหมอก', region: 'mist', description: 'ค้นเส้นทางที่ทีมสำรวจใช้ ก่อนหมอกปิดทับอีกครั้ง', duration: 118, rank: 'B', difficulty: 96, tags: ['scout', 'heal'], reward: { gold: 390, wood: 15, stone: 8, herb: 9, rep: 62, xp: 98 }, cost: { gold: 40, herb: 2 }, energy: 25, enemy: 'ภูตหมอก' },
  { id: 'rescue', name: 'ช่วยทีมสำรวจที่หายไป', title: 'ทุกคนต้องกลับบ้าน', region: 'mist', description: 'ตามสัญญาณไฟจากกลางป่าและพาคนเจ็บออกมา', duration: 146, rank: 'B', difficulty: 110, tags: ['heal', 'tank'], reward: { gold: 480, wood: 16, stone: 12, herb: 10, rep: 82, xp: 120 }, cost: { gold: 45, herb: 3 }, energy: 28, enemy: 'รากไม้พันธนาการ', requires: 'mistpath', story: true },
  { id: 'heart', name: 'รักษาหัวใจป่า', title: 'บ้านใต้ร่มใบไม้', region: 'mist', description: 'ทีมสำรวจชี้ทางแล้ว ถึงเวลาคืนแสงให้ต้นไม้กลางป่า', duration: 180, rank: 'A', difficulty: 136, tags: ['tank', 'magic', 'heal'], reward: { gold: 900, wood: 25, stone: 20, herb: 20, rep: 120, xp: 180 }, cost: { gold: 60, herb: 4 }, energy: 30, enemy: 'ผู้พิทักษ์หัวใจป่า', requires: 'rescue', story: true, final: true },
];
export const EQUIPMENT = [
  { id: 'oak-blade', name: 'ดาบไม้โอ๊ก', slot: 'weapon', classes: ['warrior'], power: 7, health: 8, cost: { gold: 85, wood: 6, stone: 2 }, unlockRank: 'F', workshopLevel: 1, color: '#c9a579', description: 'ดาบเริ่มต้นที่จับถนัดมือ' },
  { id: 'leaf-bow', name: 'ธนูใบไม้', slot: 'weapon', classes: ['archer'], power: 7, health: 0, cost: { gold: 85, wood: 7, stone: 1 }, unlockRank: 'F', workshopLevel: 1, color: '#91b29b', description: 'ธนูน้ำหนักเบาสำหรับเดินป่า' },
  { id: 'moon-wand', name: 'ไม้เท้าจันทร์', slot: 'weapon', classes: ['mage'], power: 8, health: 0, cost: { gold: 90, wood: 5, stone: 4 }, unlockRank: 'F', workshopLevel: 1, color: '#b6a4c6', description: 'เก็บแสงไว้ที่ปลายผลึก' },
  { id: 'tea-staff', name: 'ไม้เท้าใบชา', slot: 'weapon', classes: ['healer'], power: 6, health: 10, cost: { gold: 85, wood: 5, herb: 4 }, unlockRank: 'F', workshopLevel: 1, color: '#b7c6a0', description: 'เวทรักษามีกลิ่นชาอ่อน ๆ' },
  { id: 'ribbon', name: 'ริบบิ้นกิลด์', slot: 'accessory', classes: [], power: 3, health: 12, cost: { gold: 65, wood: 2, herb: 2 }, unlockRank: 'F', workshopLevel: 1, color: '#d89e98', description: 'สัญลักษณ์ว่าเรามีบ้านให้กลับ' },
  { id: 'bell-blade', name: 'ดาบหอระฆัง', slot: 'weapon', classes: ['warrior'], power: 15, health: 16, cost: { gold: 210, wood: 6, stone: 14 }, unlockRank: 'D', workshopLevel: 2, color: '#aeb7c2', description: 'ตีจากโลหะที่กู้มาจากเมืองเก่า' },
  { id: 'wind-bow', name: 'ธนูลมอุ่น', slot: 'weapon', classes: ['archer'], power: 16, health: 5, cost: { gold: 210, wood: 16, stone: 5 }, unlockRank: 'D', workshopLevel: 2, color: '#84aca5', description: 'ปล่อยลูกธนูเงียบเหมือนใบไม้ร่วง' },
  { id: 'crystal-wand', name: 'ไม้เท้าผลึก', slot: 'weapon', classes: ['mage'], power: 18, health: 5, cost: { gold: 230, wood: 5, stone: 16 }, unlockRank: 'D', workshopLevel: 2, color: '#afa5cb', description: 'เวทสะท้อนแสงออกจากผลึก' },
  { id: 'bloom-staff', name: 'ไม้เท้าผลิบาน', slot: 'weapon', classes: ['healer'], power: 14, health: 20, cost: { gold: 210, wood: 9, herb: 12 }, unlockRank: 'D', workshopLevel: 2, color: '#a7c3ad', description: 'ดอกไม้ที่ปลายไม้เท้าไม่เคยเหี่ยว' },
  { id: 'moon-charm', name: 'เครื่องรางหมอกจันทร์', slot: 'accessory', classes: [], power: 9, health: 22, cost: { gold: 220, stone: 10, herb: 10 }, unlockRank: 'B', workshopLevel: 3, color: '#bac8d4', description: 'ช่วยให้หาทางกลับได้แม้ในหมอก' },
  // Treasures: found only in mission chests, never crafted.
  { id: 'sprout-charm', name: 'เครื่องรางใบอ่อนนำโชค', slot: 'accessory', classes: [], power: 4, health: 14, luck: 0.08, loot: true, rarity: 'rare', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#a9c99a', description: 'ใบไม้ที่ไม่เคยร่วง ช่วยให้สังเกตหีบซ่อนได้ง่ายขึ้น' },
  { id: 'starlight-bow', name: 'ธนูแสงดาว', slot: 'weapon', classes: ['archer'], power: 12, health: 4, loot: true, rarity: 'rare', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#e7d394', description: 'สายธนูเรืองแสงจาง ๆ ยามค่ำ' },
  { id: 'dew-charm', name: 'จี้น้ำค้างใบชา', slot: 'accessory', classes: [], power: 6, health: 18, loot: true, rarity: 'legendary', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#bfe0d6', description: 'หยดน้ำค้างแรกของทุ่งใบชา เย็นสดชื่นเสมอ' },
  { id: 'gear-amulet', name: 'จี้เฟืองโบราณ', slot: 'accessory', classes: [], power: 9, health: 16, loot: true, rarity: 'rare', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#c9b47e', description: 'เฟืองจากหอระฆังที่ยังหมุนเบา ๆ' },
  { id: 'echo-blade', name: 'ดาบเสียงก้อง', slot: 'weapon', classes: ['warrior'], power: 22, health: 20, loot: true, rarity: 'legendary', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#d2d8e2', description: 'ทุกครั้งที่ฟันจะมีเสียงระฆังเบา ๆ' },
  { id: 'moonpetal-staff', name: 'ไม้เท้ากลีบจันทร์', slot: 'weapon', classes: ['healer'], power: 18, health: 28, loot: true, rarity: 'rare', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#d7d0ef', description: 'กลีบดอกที่บานเฉพาะคืนหมอกลง' },
  { id: 'fox-charm', name: 'เครื่องรางขนจิ้งจอกหมอก', slot: 'accessory', classes: [], power: 12, health: 20, luck: 0.06, loot: true, rarity: 'rare', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#e8e3f2', description: 'จิ้งจอกหมอกทิ้งไว้ให้คนที่ใจดีกับป่า' },
  { id: 'lantern-wand', name: 'คทาตะเกียงหมอก', slot: 'weapon', classes: ['mage'], power: 25, health: 6, loot: true, rarity: 'legendary', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#f0dca0', description: 'แสงในตะเกียงไม่เคยดับ แม้ในหมอกหนาที่สุด' },
  { id: 'heart-gem', name: 'อัญมณีหัวใจป่า', slot: 'accessory', classes: [], power: 16, health: 30, luck: 0.1, loot: true, rarity: 'legendary', cost: {}, unlockRank: 'F', workshopLevel: 99, color: '#9fd3a8', description: 'เต้นเป็นจังหวะเดียวกับป่าทั้งผืน' },
];
export const GUILD_EVENTS = [
  { id: 'tea', name: 'วงน้ำชายามบ่าย', description: 'สมาชิกที่อยู่บ้านฟื้นพลัง 15 และขวัญ 12 เพิ่มความสนิท', cost: { gold: 70, herb: 3 }, requires: 'kitchen', cooldown: 120 },
  { id: 'feast', name: 'มื้อเลี้ยงกิลด์', description: 'ฟื้นพลัง 30 ขวัญ 20 และความสนิทของสมาชิกที่อยู่บ้าน', cost: { gold: 160, herb: 5 }, requires: 'lounge', cooldown: 180 },
];
export const MISSION_POLICIES = {
  balanced: { name: 'สมดุล', duration: 1, power: 1, energy: 1 },
  cautious: { name: 'รอบคอบ', duration: 1.2, power: 1.12, energy: 0.9 },
  bold: { name: 'เร่งเดินทาง', duration: 0.85, power: 0.9, energy: 1.2 },
};

export const RARITIES = {
  common: { name: 'ธรรมดา', weight: 60, color: '#b9ad97' },
  uncommon: { name: 'ดี', weight: 28, color: '#7fae6f' },
  rare: { name: 'หายาก', weight: 10, color: '#6f9ad1' },
  legendary: { name: 'ตำนาน', weight: 1, color: '#e2a93c' },
};
/** What each quest's chests can hold, by rarity. Materials give a random amount in range. */
const mat = (key, min, max) => ({ kind: 'mat', key, min, max });
const gear = id => ({ kind: 'item', id });
export const LOOT = {
  patrol: { common: [mat('wood', 2, 4), mat('gold', 15, 30)], uncommon: [mat('herb', 2, 4), gear('ribbon')], rare: [gear('sprout-charm'), gear('starlight-bow')], legendary: [gear('dew-charm')] },
  herbs: { common: [mat('herb', 2, 5), mat('wood', 2, 3)], uncommon: [gear('tea-staff'), mat('herb', 5, 8)], rare: [gear('sprout-charm'), gear('starlight-bow')], legendary: [gear('dew-charm')] },
  escort: { common: [mat('gold', 25, 45), mat('wood', 3, 5)], uncommon: [gear('oak-blade'), gear('ribbon')], rare: [gear('starlight-bow'), gear('sprout-charm')], legendary: [gear('dew-charm')] },
  hollow: { common: [mat('stone', 3, 6), mat('herb', 2, 4)], uncommon: [gear('moon-wand'), mat('gold', 40, 70)], rare: [gear('gear-amulet'), gear('bell-blade')], legendary: [gear('echo-blade')] },
  crystals: { common: [mat('stone', 4, 8), mat('gold', 30, 50)], uncommon: [gear('crystal-wand'), mat('stone', 8, 12)], rare: [gear('gear-amulet'), gear('wind-bow')], legendary: [gear('echo-blade')] },
  ruins: { common: [mat('stone', 5, 9), mat('gold', 40, 70)], uncommon: [gear('bell-blade'), gear('bloom-staff')], rare: [gear('gear-amulet'), gear('crystal-wand')], legendary: [gear('echo-blade')] },
  mistpath: { common: [mat('herb', 4, 8), mat('wood', 4, 7)], uncommon: [gear('wind-bow'), gear('moon-charm')], rare: [gear('moonpetal-staff'), gear('fox-charm')], legendary: [gear('lantern-wand')] },
  rescue: { common: [mat('herb', 5, 9), mat('gold', 60, 90)], uncommon: [gear('bloom-staff'), gear('moon-charm')], rare: [gear('fox-charm'), gear('moonpetal-staff')], legendary: [gear('lantern-wand')] },
  heart: { common: [mat('gold', 80, 120), mat('herb', 6, 10)], uncommon: [gear('moon-charm'), gear('crystal-wand')], rare: [gear('fox-charm'), gear('lantern-wand')], legendary: [gear('heart-gem')] },
};

// ---- Petitions: villagers walk to the guild with requests; the guild posts them on the board. ----
/** Share of the client's fee paid to the adventurers; the guild keeps the rest as commission. */
export const PAYOUT_PLANS = {
  generous: { name: 'ใจดี', share: 0.8, eager: 1.8, readiness: 0.85, morale: 6, description: 'นักผจญภัยได้ 80% รีบมาหยิบงาน ขวัญดีขึ้น' },
  standard: { name: 'มาตรฐาน', share: 0.65, eager: 1, readiness: 0.95, morale: 0, description: 'นักผจญภัยได้ 65% กิลด์ได้ 35%' },
  thrifty: { name: 'ประหยัด', share: 0.5, eager: 0.45, readiness: 1.1, morale: -6, description: 'กิลด์ได้ครึ่งหนึ่ง แต่ไม่ค่อยมีใครอยากหยิบงาน' },
};
/** Client fee as a multiple of the quest's listed gold. */
export const FEE_MULTIPLIER = 2.8;
export const VILLAGER_NAMES = ['ป้าบัว', 'ลุงมั่น', 'น้องข้าวปุ้น', 'คุณนายพลอย', 'ตาโต', 'ยายเย็น', 'พี่ต้นกล้า', 'ช่างหิน', 'แม่ค้าส้มจี๊ด', 'คนเลี้ยงแกะ', 'หนูน้ำผึ้ง', 'ลุงคนเฝ้าสะพาน', 'นักเดินทางผ่านทาง', 'คุณครูดาว'];
export const PETITION_LINES = {
  patrol: 'ทางกลับบ้านมีเสียงแปลก ๆ ตอนเย็น ช่วยไปดูให้หน่อยได้ไหม',
  herbs: 'ใบชาแสงดาวใกล้หมดแล้ว ร้านต้องใช้ทำชาให้ทั้งหมู่บ้าน',
  escort: 'รถขนขนมปังต้องผ่านทางที่หมูป่าชอบออกมา ขอคนคุ้มกันด้วย',
  hollow: 'ได้ยินเสียงระฆังจากใต้ต้นโอ๊กทุกคืนเลย',
  crystals: 'ช่างตีเหล็กอยากได้ผลึกจากทางเก่า จ่ายดีนะ',
  ruins: 'อยากกลับไปดูบ้านเก่าที่หอระฆังสักครั้ง',
  mistpath: 'หมอกปิดทางเดินป่าอีกแล้ว คนหาของป่าเข้าไม่ได้',
  rescue: 'ทีมสำรวจยังไม่กลับมา ได้โปรดช่วยตามหา',
  heart: 'ป่าเงียบผิดปกติ ต้นไม้ใหญ่ดูอ่อนแรง',
};

// ---- Idle guild upgrades: levels with growing cost, each a small permanent boost. ----
export const GUILD_UPGRADES = {
  signboard: { name: 'ป้ายประกาศกิลด์', icon: '📜', max: 10, base: { gold: 140, wood: 4 }, growth: 1.55, description: 'ชาวบ้านมาส่งคำร้องถี่ขึ้น 10% ต่อระดับ' },
  contracts: { name: 'สมุดสัญญา', icon: '✒', max: 10, base: { gold: 200, stone: 2 }, growth: 1.6, description: 'ค่านายหน้ากิลด์เพิ่ม 4% ของค่าจ้างต่อระดับ' },
  clerk: { name: 'เสมียนต้อนรับ', icon: '🛎', max: 5, base: { gold: 260, wood: 6 }, growth: 1.8, description: 'รับคำร้องทั่วไปแทนคุณตามแผนค่าตอบแทนที่ตั้งไว้ และชาวบ้านรอนานขึ้น' },
  coffer: { name: 'กองทุนกิลด์', icon: '◈', max: 12, base: { gold: 180 }, growth: 1.6, description: 'ดอกผล 0.25 G ต่อวินาทีต่อระดับ เก็บต่อแม้ปิดเกม (สูงสุด 2 ชั่วโมง)' },
};

// ---- The village: homes and businesses that grow with prosperity. ----
export const VILLAGE_LEVELS = [
  { level: 1, prosperity: 0, name: 'หมู่บ้านเล็ก ๆ' },
  { level: 2, prosperity: 250, name: 'หมู่บ้านอบอุ่น' },
  { level: 3, prosperity: 700, name: 'หมู่บ้านคึกคัก' },
  { level: 4, prosperity: 1500, name: 'ตำบลริมทาง' },
  { level: 5, prosperity: 3000, name: 'เมืองใบอ่อน' },
];
export const VILLAGE_PROJECTS = {
  house: { name: 'บ้านใหม่', icon: '🏠', max: 10, villageLevel: 1, base: { gold: 160, wood: 14, stone: 4 }, growth: 1.28, prosperity: 60, description: 'ครอบครัวใหม่ย้ายมา คำร้องมาถี่ขึ้น 12% ต่อหลัง' },
  shop: { name: 'ร้านค้า', icon: '🛍', max: 3, villageLevel: 1, base: { gold: 300, wood: 18, stone: 8 }, growth: 1.9, prosperity: 140, description: 'นักผจญภัยใช้เงินส่วนตัวซื้อของกิน ขวัญดีขึ้น · กิลด์ได้ค่าเช่าวันละ 20 G ต่อระดับ · ซื้อวัตถุดิบได้' },
  market: { name: 'ตลาดนัด', icon: '🧺', max: 3, villageLevel: 2, base: { gold: 420, wood: 20, stone: 14 }, growth: 1.9, prosperity: 200, description: 'แผงค้าส่งไม้ หิน สมุนไพรให้กิลด์ทุกวัน และเก็บค่าแผง 0.15 G/วินาทีต่อระดับ' },
  smithy: { name: 'โรงตีเหล็ก', icon: '⚒', max: 3, villageLevel: 3, base: { gold: 520, wood: 16, stone: 24 }, growth: 1.9, prosperity: 260, description: 'ลดค่าเงินคราฟต์อุปกรณ์ 10% ต่อระดับ' },
};
/** Where homes and businesses stand on the world map (grid units, top-left of the footprint). */
export const VILLAGE_LOTS = {
  houses: [
    { x: -2, y: 21.5, seed: 44, styles: ['thatch', 'cabin', 'brick'] },
    { x: 8, y: 21.5, seed: 52, styles: ['cabin', 'thatch', 'stone'] },
    { x: 14, y: 22, seed: 63, styles: ['thatch', 'brick', 'tall'] },
    { x: 24, y: 21.5, seed: 75, styles: ['cabin', 'brick', 'stone'] },
    { x: -8, y: -3, seed: 88, styles: ['thatch', 'tall', 'tall'] },
    { x: 30, y: 21.5, seed: 91, styles: ['thatch', 'cabin', 'brick'] },
    { x: -10, y: 24.5, seed: 97, styles: ['cabin', 'stone', 'stone'] },
    { x: 21, y: 25.5, seed: 103, styles: ['thatch', 'brick', 'tall'] },
    { x: 3.5, y: 25, seed: 109, styles: ['cabin', 'thatch', 'brick'] },
    { x: 27.5, y: 25.5, seed: 117, styles: ['thatch', 'stone', 'tall'] },
  ],
  shop: { x: -9, y: 13.2, seed: 131, style: 'store' },
  market: { x: 34, y: 12.4, seed: 137 },
  smithy: { x: -9, y: 20.5, seed: 31, style: 'smithy' },
};
