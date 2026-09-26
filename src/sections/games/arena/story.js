// 1vDOQUZ Arena — hikâye modu “Dokuzun Laneti”: 5 bölüm × 3 görev, diyaloglar, yıldızlar, ilerleme kaydı.
// Belge: docs/oyunlar/arena-hikaye.md · tasarım: docs/ARENA-TASARIM.md §6, §8.
//
// Saf modül: DOM yok (Node'da da çalışır; simülasyon ve testler doğrudan içe aktarır). Arayüz: storyui.js.
//
//   CHAPTERS                       bölümler (sırayla), her biri 3 görev kimliği; 3. görev boss görevidir
//   MISSIONS[id]                   görev verisi: ad, brifing, önerilen kahramanlar, misafir kahraman, yıldız kuralları, diyaloglar
//   missionConfig(id)              → runConfig.mission { waves, objectives, victory, failOnObjective, prep, modifiers, setup }
//   storyRunConfig(id, heroId)     → tam runConfig ({ mode: 'story', missionId, heroId, modifiers, mission, allowLocked? })
//   starsFor(id, runEnd)           → 0–3 (1: zafer, 2: 1. bonus hedef, 3: 2. bonus hedef)
//   storyProgress()                csk:arena:story:v1 okuması + türetilmiş kilitler
//   recordMission(id, sonuç)       kaydı günceller → { stars, firstWin, chapterDone, finale, next, … }
//   triggerMatches(t, type, d)     görev içi diyalog tetikleyicisi bu olaya uyuyor mu?
//   SPEAKERS · STORY_CODEX · FINALE

import { ls } from '../../../core/dom.js';

export const STORY_VERSION = 1;
/** ls anahtarı (localStorage'da `csk:` önekiyle: csk:arena:story:v1). */
export const STORY_KEY = 'arena:story:v1';

// ------------------------------------------------------------------ konuşanlar
/**
 * Diyalog kartlarının konuşanları. art: artUrl anahtarı (yoksa glif + renk yedeği), glyph: glyphs.js anahtarı.
 * 'hero' oyuncunun kahramanıdır; 'hero:<id>' belirli bir kahraman (misafir), 'dog:<tür>' DOG portresi.
 */
export const SPEAKERS = {
  kurye: { name: 'Kurye', role: 'Anlatıcı · kanatlı eşek', art: 'portrait-kurye', glyph: 'courier', color: '#e9b949' },
  feedalfa: { name: 'Feed Alfa', role: 'Sürünün başı', art: 'story-boss-feedalfa', glyph: 'paw', color: '#ff7a3d' },
  shadow: { name: 'Gölge Ulusu', role: 'Wardsız DOG’ların lideri', art: 'story-boss-shadow', glyph: 'moon', color: '#8b6cff' },
  general: { name: 'Dire Generali', role: 'Dire ordusunun komutanı', art: 'story-boss-general', glyph: 'greatsword', color: '#e0354b' },
  roshan: { name: 'Kaya Canavarı', role: 'Roshan’ın inindeki bekçi', art: 'story-boss-roshan', glyph: 'skull', color: '#e9b949' },
  ancient: { name: 'Sonsuz Pub’ın Kalbi', role: 'Lanetin kaynağı', art: 'story-boss-ancient', glyph: 'ancient', color: '#ff3b6b' },
};
const DOG_SPEAKER = {
  feed: ['Feed Köpeği', '#e0354b'], farm: ['Farm Köpeği', '#43d6a0'], pause: ['Pause Köpeği', '#8b7cff'], afk: ['AFK Köpeği', '#5fb9c9'],
  kurye: ['Kurye Köpeği', '#e9b949'], rapier: ['Rapier Köpeği', '#f6d98a'], mid: ['Mid Köpeği', '#ff9a3d'], ward: ['Wardsız Köpek', '#c46bff'],
  smurf: ['Smurf Köpeği', '#53d8fb'], chat: ['Chat Köpeği', '#ff6a2b'],
};
/** Konuşan kimliğini çözer. heroInfo(id) → { name, color } (arayüz verir; Node'da yoksa kimlik yazılır). */
export function speakerOf(who, heroId, heroInfo) {
  const hi = (id) => (typeof heroInfo === 'function' ? heroInfo(id) : null) || { name: id, color: '#43d6a0' };
  if (who === 'hero' || (typeof who === 'string' && who.startsWith('hero:'))) {
    const id = who === 'hero' ? heroId : who.slice(5);
    const H = hi(id);
    return { id: `hero:${id}`, hero: id, name: H.name, color: H.color, glyph: id, role: who === 'hero' ? 'Sen' : 'Misafir kahraman' };
  }
  if (typeof who === 'string' && who.startsWith('dog:')) {
    const t = who.slice(4);
    const [name, color] = DOG_SPEAKER[t] || ['DOG', '#ff6a2b'];
    return { id: who, dog: t, name, color, art: `portrait-${t}`, glyph: 'paw', role: 'DOG' };
  }
  const S = SPEAKERS[who] || SPEAKERS.kurye;
  return { id: who, ...S };
}

// ------------------------------------------------------------------ bölümler
export const CHAPTERS = [
  { n: 1, id: 'ch1', roman: 'I', name: 'Nehir Kıyısı', color: '#43d6a0', art: 'story-ch1', boss: 'boss_feedalfa', bossName: 'Feed Alfa', bossArt: 'story-boss-feedalfa',
    blurb: 'Nehrin iki yakasında bitmeyen bir maç. İlk DOG’lar kıyıya vurdu; Kurye çeşmenin dibinde titriyor.',
    missions: ['s1m1', 's1m2', 's1m3'] },
  { n: 2, id: 'ch2', roman: 'II', name: 'Wardsız Orman', color: '#8b7cff', art: 'story-ch2', boss: 'boss_shadow', bossName: 'Gölge Ulusu', bossArt: 'story-boss-shadow',
    blurb: 'Gece çöker, orman kampları uyanır. Ward alınmayan her gece bir ruh daha kaybolur.',
    reward: { hero: 'agac', text: 'Ağaç Bekçisi kalıcı olarak katılır' },
    missions: ['s2m1', 's2m2', 's2m3'] },
  { n: 3, id: 'ch3', roman: 'III', name: 'Kule Kuşatması', color: '#e0354b', art: 'story-ch3', boss: 'boss_general', bossName: 'Dire Generali', bossArt: 'story-boss-general',
    blurb: 'Radiant kuleleri kuşatma altında. Dire Generali dokuz DOG’un başında: emirleri kısa, kılıcı uzun.',
    missions: ['s3m1', 's3m2', 's3m3'] },
  { n: 4, id: 'ch4', roman: 'IV', name: 'Roshan’ın İni', color: '#e9b949', art: 'story-ch4', boss: 'boss_roshan', bossName: 'Kaya Canavarı', bossArt: 'story-boss-roshan',
    blurb: 'Aegis’i kazanmadan kalbe ulaşamazsın. Kaya Canavarı ininde, peynirinin başında uyuyor.',
    reward: { hero: 'simsek', text: 'Şimşek Ruhu kalıcı olarak katılır' },
    missions: ['s4m1', 's4m2', 's4m3'] },
  { n: 5, id: 'ch5', roman: 'V', name: '1vDOQUZ', color: '#ff6a2b', art: 'story-ch5', boss: 'boss_ancient', bossName: 'Sonsuz Pub’ın Kalbi', bossArt: 'story-boss-ancient',
    blurb: 'Sonsuz Pub’ın kalbi. Dokuz DOG lordu, son kule, tek kahraman.',
    missions: ['s5m1', 's5m2', 's5m3'] },
];
export const CHAPTER_OF = Object.fromEntries(CHAPTERS.flatMap((C) => C.missions.map((m) => [m, C])));
export const MISSION_IDS = CHAPTERS.flatMap((C) => C.missions);

// ------------------------------------------------------------------ yardımcılar (görev verisi)
const K = (who, text, extra) => ({ who, text, ...(extra || {}) });
const kurye = (t, x) => K('kurye', t, x);
const hero = (t, x) => K('hero', t, x);
/** Dalga: dogs dizisi + seçenekler. */
const W = (lvl, dogs, o = {}) => ({ lvl, dogs, elites: 0, creepSquads: 0, ...o });
const LORD = { elite: true, hpMul: 2.4, dmgMul: 1, scale: 1.3, tag: 'lord', bountyMul: 2.5 };

/** Bir kez: kimliği verilen hedef, olay gelince ilerler (betiklerin kapatma fonksiyonları toplanır). */
function script(fn) {
  return (g) => {
    const offs = [];
    const on = (type, cb) => { offs.push(g.on(type, cb)); };
    const steps = [];
    const onStep = (cb) => { g.hooks.onStep.push(cb); steps.push(cb); };
    fn(g, { on, onStep });
    return () => {
      for (const off of offs) { try { off(); } catch { /* yok say */ } }
      for (const cb of steps) { const i = g.hooks.onStep.indexOf(cb); if (i >= 0) g.hooks.onStep.splice(i, 1); }
    };
  };
}

// ------------------------------------------------------------------ görevler
/**
 * Görev alanları:
 *   name, kicker (tür), brief, boss?, heroes: { rec: [id…], guest?: id }, start: { level, gold } (yalnız bilgi),
 *   stars: [zafer metni, 1. bonus, 2. bonus] (bonus hedeflerin text'iyle aynı), dialogue: { intro, triggers, win, lose }
 *   build(): { waves, objectives, victory?, failOnObjective?, prep?, modifiers, setup? }
 * Hedeflerde isteğe bağlı olanlar (optional: true) sırasıyla 2. ve 3. yıldızdır.
 */
export const MISSIONS = {
  // ================================================================ I · Nehir Kıyısı
  s1m1: {
    name: 'Kıyıdaki Kurye', kicker: 'Koruma',
    brief: 'Kurye çeşmeye sığındı. Dire creep’leri Radiant kulelerine yürüyor, DOG’lar peşlerinde. İki dalga boyunca kuleleri ayakta tut: kule düşerse Kurye’nin saklanacak yeri kalmaz.',
    heroes: { rec: ['okcu', 'balta'] },
    tips: ['Creep’leri kule menzilinde kes; kule de vurur.', 'Son vuruş (altın) için düşmanın canı azken vur.'],
    build: () => ({
      modifiers: {},
      waves: [
        W(1, ['feed', 'afk', 'pause', 'farm', 'feed', 'chat'], { creepSquads: 1, text: 'Kıyıya ilk DOG’lar vurdu. Creep’ler kuleye yürüyor.' }),
        W(2, ['feed', 'farm', 'kurye', 'pause', 'chat', 'afk', 'feed'], { creepSquads: 2, text: 'İkinci sürü: kuleyi yalnız bırakma.' }),
      ],
      objectives: [
        { id: 'dalga', kind: 'waves', n: 2, text: '2 dalgayı temizle' },
        { id: 'kule', kind: 'protect', text: 'Radiant kuleleri ayakta kalsın' },
        { id: 'sonvurus', kind: 'lastHits', n: 12, optional: true, text: '12 son vuruş yap' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
    }),
    dialogue: {
      intro: [
        kurye('Hey! Sen! Evet, ayakta kalan tek kişi sen. Ben Kurye. Hani şu hep ölen kurye. Bugün ölmemeye kararlıyım.', { card: 'lore_kurye' }),
        kurye('Nehrin iki yakasında bir maç başladı ve bitmedi. Ne zamandır sürüyor bilmiyorum; burada en kısa yayın yirmi dört saat.'),
        hero('Takımın geri kalanı nerede?', { alt: { balta: 'Takım nerede? Balta’nın dönmesi için birilerinin etrafında olması lazım.', golge: 'Takım nerede? Görünmez olmayı ben seçtim, onlar değil.' } }),
        kurye('Dokuzu da… DOG oldu. Ward almayan, Aegis’i unutan, “1 dk pause” deyip dönmeyen. Hepsi sürüye katıldı. Sen tek kaldın: 1vDOQUZ.', { card: 'lore_lanet' }),
        kurye('Şimdilik tek iş: kuleleri koru, ben arkada saklanayım. Son vuruşları sen al, altın sende kalsın. Taşımayı zaten ben yaparım.'),
      ],
      triggers: [
        { on: 'waveStart', wave: 2, cards: [kurye('İkinci sürü! Dire creep’leri kuleye yürüyor; önce onları kes, DOG’lar zaten sana gelir.')] },
      ],
      win: [
        kurye('Kule ayakta, ben ayaktayım, sen ayaktasın. Bu maçta bu kadar iyi bir an hiç yaşanmamıştı.'),
        hero('Bu daha başlangıç.'),
        kurye('Nehirde parlayan bir şey gördüm. Rünler! Gel, göstereyim.'),
      ],
      lose: 'Kule düştü, ben de düştüm. Alışkınım. Bir daha deneyelim.',
    },
  },
  s1m2: {
    name: 'Nehrin Rünleri', kicker: 'Rün avı',
    brief: 'Nehirde rünler parlıyor ve DOG’lar bunu biliyor: sürü seni rünlerden uzak tutacak. Üç rün topla. Hız, çift hasar, görünmezlik… hangisi çıkarsa.',
    heroes: { rec: ['golge', 'okcu'] },
    tips: ['Rünler nehrin iki ucunda doğar; ekran kenarındaki oklar yerlerini gösterir.', 'Bu görevde rünler daha sık çıkar.'],
    build: () => ({
      modifiers: { startLevel: 2, startGold: 150 },
      waves: [
        W(2, ['feed', 'farm', 'pause', 'kurye', 'chat', 'afk', 'ward'], { creepSquads: 1, text: 'Rünlerin çevresi sürüyle dolu.' }),
        W(3, ['feed', 'farm', 'mid', 'kurye', 'chat', 'smurf', 'ward', 'pause'], { creepSquads: 1 }),
        W(4, ['feed', 'farm', 'mid', 'kurye', 'chat', 'smurf', 'ward', 'rapier'], { creepSquads: 1 }),
      ],
      objectives: [
        { id: 'run', kind: 'runes', n: 3, text: '3 rün topla' },
        { id: 'feed', kind: 'kill', unit: 'feed', n: 5, optional: true, text: '5 Feed Köpeği indir' },
        { id: 'hiz', kind: 'time', t: 200, optional: true, text: '200 sn içinde bitir' },
      ],
      setup: script((g, { on }) => {
        g.runeT = 6; // ilk rün hemen
        on('runeTaken', () => { g.runeT = Math.min(g.runeT, 14); });
      }),
    }),
    dialogue: {
      intro: [
        kurye('Rünler nehrin iki ucunda doğar: biri üstte, biri altta. Parlayanı görünce koş.'),
        kurye('DOG’lar rün almaz; çünkü rün almak için yere bakmak gerekir. Onlar hep sana bakıyor.'),
        hero('Üç rün. Anlaşıldı.', { alt: { okcu: 'Üç rün, sonra üç ok. Anlaşıldı.', buz: 'Üç rün. Soğukkanlılıkla.' } }),
      ],
      triggers: [
        { on: 'objective', id: 'run', progress: 1, cards: [kurye('Bir tane! Rün seni güçlendirirken sürüyü dağıt; sıradaki birazdan doğar.')] },
        { on: 'waveStart', wave: 3, cards: [kurye('Dire’den takviye geldi. Rün yolunu açık tut!')] },
      ],
      win: [
        kurye('Üç rün, sıfır ward. Yine de bu takımda en çok ward alan sensin. Tebrikler.'),
        kurye('Ama nehrin öbür yakasından bir uluma geliyor… O ses. Feed Alfa.'),
      ],
      lose: 'Rünler yerinde duruyor, biz yerde yatıyoruz. Bir tur daha?',
    },
  },
  s1m3: {
    name: 'Feed Alfa', kicker: 'Boss', boss: 'boss_feedalfa',
    brief: 'Sürünün başı: dev bir Feed Köpeği. Düşünmeden dalar, dalarken önündeki her şeyi devirir. Kırmızı şeritten çekil, yavrularını ayıkla, sonra işini bitir.',
    heroes: { rec: ['balta', 'buz'] },
    tips: ['Dalıştan önce yere kırmızı şerit çizer: şeridin dışına adım at.', '%50 canın altında öfkelenir, daha sık dalar.'],
    build: () => ({
      modifiers: { startLevel: 3, startGold: 300, bossHp: 0.7 },
      waves: [
        W(3, ['feed', 'feed', 'farm', 'kurye', 'chat', 'feed', 'afk'], { creepSquads: 1, text: 'Sürü toplanıyor. Alfa’nın kokusu havada.' }),
        W(4, ['feed', 'feed', 'feed'], { boss: 'boss_feedalfa', bossLevel: 1, text: 'FEED ALFA GELDİ' }),
      ],
      objectives: [
        { id: 'boss', kind: 'boss', boss: 'boss_feedalfa', text: 'Feed Alfa’yı yen' },
        { id: 'feed', kind: 'kill', unit: 'feed', n: 8, optional: true, text: '8 Feed Köpeği indir' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
    }),
    dialogue: {
      intro: [
        kurye('İşte orada. Feed Alfa. Eskiden bizim taraftaydı; ilk kanı hep o verirdi. Kendi kanını.'),
        K('feedalfa', 'HAV! DALIYORUM! PLAN YOK! DOG DOG DOG!'),
        hero('Bir plan yapsan fena olmazdı.'),
        kurye('Dalıştan önce yere kırmızı şerit çizer. Şeritten çık, sonra arkasından vur.'),
      ],
      triggers: [
        { on: 'bossSpawn', boss: 'boss_feedalfa', cards: [K('feedalfa', 'Yavrularım! Hepiniz benimle dalın! Kim önce ölürse o kazanır!')] },
        { on: 'bossPhase', phase: 2, cards: [K('feedalfa', 'ÖFKE! Daha hızlı dalıyorum! Daha hızlı ölüyorum!'), kurye('Öfkelendi: dalışlar sıklaştı. Şeritlere dikkat!')] },
      ],
      win: [
        kurye('Feed Alfa düştü! Bak, gözleri… DOG kırmızısı gidiyor.'),
        K('feedalfa', 'Ben… neden hep ilk ben dalıyordum?', { card: 'lore_feedalfa' }),
        kurye('Lanet biraz gevşedi ama kırılmadı. Kaynağı daha derinde: ormanın ötesinde, gecenin içinde.'),
      ],
      lose: 'Alfa daldı, biz de onunla birlikte daldık. Şeritten çıkmayı unutma.',
    },
  },

  // ================================================================ II · Wardsız Orman
  s2m1: {
    name: 'Kamp Ateşleri', kicker: 'Orman',
    brief: 'Ormanın kampları uyandı: Kurt İni, Harpi Yuvası, Yaşlı Koru. Üç kamp temizle; düşen orman eşyaları yolunu aydınlatır. Ormanın bekçisi de yanında: bu görevde Ağaç Bekçisi misafir kahraman.',
    heroes: { rec: ['agac', 'balta'], guest: 'agac' },
    tips: ['Kamplar vurulana kadar uyur; uzağa çekersen evine döner.', 'Orman eşyasının yuvası ayrıdır, çantanı doldurmaz.'],
    build: () => ({
      modifiers: { startLevel: 5, startGold: 450 },
      waves: [
        W(4, ['feed', 'farm', 'afk', 'ward', 'chat'], { camps: true, text: 'Kamplar uyandı. DOG’lar ormanda dolaşıyor.' }),
        W(5, ['feed', 'farm', 'pause', 'ward', 'smurf', 'kurye'], { camps: true }),
        W(6, ['feed', 'farm', 'mid', 'ward', 'smurf', 'chat'], { camps: true }),
      ],
      objectives: [
        { id: 'kamp', kind: 'camps', n: 3, text: '3 orman kampı temizle' },
        { id: 'seviye', kind: 'level', n: 9, optional: true, text: '9. seviyeye ulaş' },
        { id: 'hiz', kind: 'time', t: 240, optional: true, text: '240 sn içinde bitir' },
      ],
    }),
    dialogue: {
      intro: [
        kurye('Orman. Burada ağaçlar konuşur, kurtlar hırlar, harpiler… harpiler her şeyi yapar.', { card: 'ch2' }),
        K('hero:agac', 'Yüz yıldır bu koridoru bekliyorum. İlk kez biri kampları DOG’lardan önce temizlemeye geldi.'),
        kurye('Ağaç Bekçisi! Bu görevde bizimle. İstersen onunla oyna; acelesi yok ama köklerinden kaçan da yok.'),
        hero('Kamplar temizlenince ne olacak?', { alt: { agac: 'Kamplar temizlenince orman yeniden nefes alır mı?' } }),
        K('hero:agac', 'Orman sana eşyalarını verir. Bana da biraz huzur.'),
      ],
      triggers: [
        { on: 'objective', id: 'kamp', progress: 1, cards: [kurye('Bir kamp temiz! Düşen orman eşyasını al: kendi yuvası var.')] },
        { on: 'objective', id: 'kamp', progress: 2, cards: [K('hero:agac', 'İki kamp. Kökleri hissediyorum; orman nefes alıyor.')] },
      ],
      win: [
        K('hero:agac', 'Ormanım temiz. Gece geldiğinde yine de ward al, genç.'),
        kurye('Gece… geliyor. Ve gece gelince onlar da gelir.'),
      ],
      lose: 'Kamplar bizi farm’ladı. Ters oldu. Bir daha?',
    },
  },
  s2m2: {
    name: 'Karanlıkta Hayatta Kal', kicker: 'Gece',
    brief: 'Güneş battı ve bu gece doğmayacak. Wardsız DOG’lar karanlığın içinden geliyor, görüşün kısa. 150 saniye dayan. Gözcü Ward’ı ya da Görüş Tozu hayat kurtarır.',
    heroes: { rec: ['buz', 'okcu'] },
    tips: ['Gece görüşün 8,5 birim: kenar okları uzaktakileri göstermez.', 'Gözcü Ward’ı (2 şarj) dikildiği yeri 90 sn aydınlatır.'],
    build: () => ({
      modifiers: { startLevel: 6, startGold: 600, alwaysNight: true },
      waves: [
        W(5, ['ward', 'ward', 'feed', 'chat', 'farm', 'ward'], { creepSquads: 1, night: true, text: 'Karanlıkta mor gözler parlıyor.' }),
        W(6, ['ward', 'ward', 'ward', 'smurf', 'kurye', 'feed', 'afk'], { creepSquads: 1, night: true }),
        W(7, ['ward', 'ward', 'ward', 'mid', 'smurf', 'feed', 'chat'], { creepSquads: 1, night: true }),
      ],
      objectives: [
        { id: 'dayan', kind: 'survive', t: 150, text: '150 sn hayatta kal' },
        { id: 'av', kind: 'kill', unit: 'ward', n: 6, optional: true, text: '6 Wardsız DOG avla' },
        { id: 'ward', kind: 'item', item: 'ward', optional: true, text: 'Gözcü Ward’ı al' },
      ],
    }),
    dialogue: {
      intro: [
        kurye('Hep gece. Görüşün kısa, harita karanlık. Bu ormanda ward alan kahraman efsane olur.'),
        hero('Kaç ward alabilirim?'),
        kurye('Dükkânda Gözcü Ward’ı var: iki şarj. Görüş Tozu da görünmezleri açığa çıkarır. İkisi de ucuz; ölmek pahalı.'),
        K('dog:ward', 'Ward mı? O ne? Biz destek oynuyoruz.'),
      ],
      triggers: [
        { on: 'objective', id: 'dayan', progress: 75, cards: [kurye('Yarıladık! Sesleri duyuyor musun? Ormanın derinlerinde bir şey uyanıyor.')] },
        { on: 'waveStart', wave: 2, cards: [kurye('Daha çok göz parlıyor. Ward’ını nehir kenarına dik!')] },
      ],
      win: [
        kurye('Güneş doğmadı ama biz sabahı ettik.'),
        hero('Bu ormanın bir sahibi var, değil mi?'),
        kurye('Gölge Ulusu. Wardsız DOG’ların lideri. Işık onu küçültür, karanlık büyütür.'),
      ],
      lose: 'Karanlık kazandı. Bu sefer bir ward al, olur mu?',
    },
  },
  s2m3: {
    name: 'Gölge Ulusu', kicker: 'Boss', boss: 'boss_shadow',
    brief: 'Wardsız DOG’ların lideri karanlığa karışıp kaybolur, sonra tepene atlar; uluması korkutur. Görüş Tozu onu açığa çıkarır. Bu gece burada bitecek.',
    heroes: { rec: ['golge', 'balta'] },
    tips: ['Kaybolunca Görüş Tozu kullan.', 'Uluma halkasından çık: korku seni kaçırır.'],
    build: () => ({
      modifiers: { startLevel: 7, startGold: 800, bossHp: 0.8 },
      prep: 12,
      waves: [
        W(6, ['ward', 'ward', 'feed', 'chat', 'farm', 'smurf', 'ward'], { creepSquads: 1, night: true, text: 'Gece. Sürü ulumaya başladı.' }),
        W(7, ['ward', 'ward', 'ward'], { night: true, boss: 'boss_shadow', bossLevel: 1, text: 'GÖLGE ULUSU UYANDI' }),
      ],
      objectives: [
        { id: 'boss', kind: 'boss', boss: 'boss_shadow', text: 'Gölge Ulusu’nu yen' },
        { id: 'toz', kind: 'item', item: 'dust', optional: true, text: 'Görüş Tozu al' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
    }),
    dialogue: {
      intro: [
        K('shadow', 'Işığınızı söndürdüm. Ward’larınızı yedim. Artık hepiniz sürünün gözüsünüz.'),
        kurye('Ward yiyen bir kurt… Bu kötü. Bu çok kötü.'),
        hero('Karanlıktan korkmuyorum.', { alt: { golge: 'Karanlık benim evim. Misafirliğe geldin.' } }),
        K('shadow', 'Korkacaksın. ULU-U-U-U!'),
        kurye('Ulurken yanından uzaklaş! Kaybolursa Toz at. Hazırlık için birkaç saniyen var: dükkân açık.'),
      ],
      triggers: [
        { on: 'bossPhase', phase: 2, cards: [K('shadow', 'Karanlık derinleşiyor…'), kurye('Az kaldı! Işığa çek onu!')] },
      ],
      win: [
        K('shadow', 'Işık… Bir ward… Bir ward alsaydım…', { card: 'lore_shadow' }),
        kurye('Gölge Ulusu düştü. Orman sessiz. Ağaç Bekçisi sözünü tuttu: artık bizimle.'),
        kurye('Ama Dire tarafında davullar çalıyor. Kuleler kuşatma altında.'),
      ],
      lose: 'Gölge kazandı. Toz alırsan kaybolamaz; aklında olsun.',
    },
  },

  // ================================================================ III · Kule Kuşatması
  s3m1: {
    name: 'Kuleyi Savun', kicker: 'Savunma',
    brief: 'Dire creep’leri dalga dalga kulelere yürüyor. Dört dalga boyunca iki Radiant kulesini de ayakta tut. Kule düşerse creep’ler coşar; hiçbiri düşmesin.',
    heroes: { rec: ['buz', 'agac'] },
    tips: ['Büyücüler arkadan küre atar: önce onları indir.', 'Ağaç Bekçisi’nin Canlı Zırhı yakındaki kuleye de işler.'],
    build: () => ({
      modifiers: { startLevel: 7, startGold: 1800 },
      prep: 15,
      waves: [
        W(5, ['feed', 'farm', 'mid', 'chat', 'smurf', 'kurye'], { creepSquads: 2, text: 'Dire ordusu kulelere yürüyor.' }),
        W(6, ['feed', 'farm', 'mid', 'chat', 'rapier', 'ward'], { creepSquads: 2 }),
        W(7, ['feed', 'pause', 'mid', 'chat', 'smurf', 'kurye'], { creepSquads: 3 }),
        W(8, ['feed', 'farm', 'mid', 'afk', 'smurf', 'rapier', 'chat'], { creepSquads: 3, elites: 1, text: 'Son dalga: generalin öncü birlikleri.' }),
      ],
      objectives: [
        { id: 'dalga', kind: 'waves', n: 4, text: '4 dalgayı temizle' },
        { id: 'kule', kind: 'protect', text: 'Radiant kuleleri ayakta kalsın' },
        { id: 'sonvurus', kind: 'lastHits', n: 40, optional: true, text: '40 son vuruş yap' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
    }),
    dialogue: {
      intro: [
        kurye('Kuleler! İkisi de ayakta… şimdilik.', { card: 'ch3' }),
        K('general', 'Dire ordusu! Kulelerine yürüyün. Radiant’ın son kahramanı ya kaçar ya feed’ler.'),
        hero('Üçüncü bir seçenek var.'),
        kurye('Creep’leri kule menzilinde kes; kule de vurur. Son vuruşu sen al, altın sende kalsın.'),
      ],
      triggers: [
        { on: 'waveStart', wave: 3, cards: [kurye('Yarısını geçtik! Büyücüler arkadan küre atar; önce onları indir.')] },
      ],
      win: [
        kurye('Dört dalga, iki kule, bir kahraman. Generalin yüzünü görmek isterdim.'),
        hero('Göreceksin. Bu sefer biz saldırıyoruz.'),
      ],
      lose: 'Kule yıkıldı. Creep’ler kule menzilinde daha kolay ölür; dene bakalım.',
    },
  },
  s3m2: {
    name: 'Karşı Hücum', kicker: 'Kuşatma',
    brief: 'Savunmak yetmez. Bir Dire kulesini yık, generalin kalesine kapı aç. Kule sana kilitlenir: creep’lerle birlikte gir, halka kırmızıysa geri çekil. Rapier Köpekleri de kılıç kapmış; geri al.',
    heroes: { rec: ['balta', 'golge'] },
    tips: ['Dire kulesi seni hedef alınca 0,8 sn düşünür: o arada çekil.', 'Kuleye büyü işlemez; saldırıyla yık.'],
    build: () => ({
      modifiers: { startLevel: 8, startGold: 2200 },
      prep: 15,
      waves: [
        W(6, ['rapier', 'feed', 'farm', 'rapier', 'chat', 'afk'], { creepSquads: 1, text: 'Kale kapısı açık değil. Açacağız.' }),
        W(7, ['rapier', 'smurf', 'feed', 'ward', 'farm'], { creepSquads: 1 }),
        W(8, ['rapier', 'smurf', 'feed', 'chat', 'mid'], { creepSquads: 2 }),
      ],
      objectives: [
        { id: 'kule', kind: 'towers', n: 1, text: 'Bir Dire kulesini yık' },
        { id: 'rapier', kind: 'kill', unit: 'rapier', n: 3, optional: true, text: '3 Rapier Köpeği indir' },
        { id: 'hiz', kind: 'time', t: 300, optional: true, text: '300 sn içinde bitir' },
      ],
    }),
    dialogue: {
      intro: [
        kurye('Kalenin kapısını iki kule koruyor. Birini yık, general dışarı çıkmak zorunda kalır.'),
        K('dog:rapier', 'Kılıç bizde! İlahi Kılıç! Düşürmeyiz, söz!'),
        kurye('Her maçta böyle derler. Her maçta düşürürler.'),
      ],
      triggers: [
        { on: 'waveStart', wave: 2, cards: [kurye('Kule seni hedef alınca kısa bir an düşünür. O an senin anın.')] },
        { on: 'objective', id: 'rapier', done: true, cards: [K('dog:rapier', 'Kılıcım… Yine mi düştü?'), kurye('Söylemiştim.')] },
      ],
      win: [
        kurye('Kule yıkıldı! Duyuyor musun? Kalede borular çalıyor.'),
        K('general', 'Kim yıktı kulemi? Bir kahraman mı? TEK bir kahraman mı?'),
      ],
      lose: 'Kule bizi yıktı. Creep’leri önüne sür, kule onları vururken sen kuleyi vur.',
    },
  },
  s3m3: {
    name: 'Dire Generali', kicker: 'Boss', boss: 'boss_general',
    brief: 'Kara-kızıl zırhlı komutan ve boyundan büyük tırtıklı kılıcı. Koni biçimli yarma, Savaş Narası, creep takviyesi. Nara bittiğinde saldır; takviyeleri ayıkla.',
    heroes: { rec: ['okcu', 'buz'] },
    tips: ['Koni biçimli kırmızı telgraf: yanına ya da arkasına geç.', '%50’nin altında “Son Hücum”: takviyeler hızlanır.'],
    build: () => ({
      modifiers: { startLevel: 9, startGold: 2600, bossHp: 0.85 },
      prep: 15,
      waves: [
        W(7, ['feed', 'farm', 'mid', 'chat', 'kurye', 'smurf'], { creepSquads: 2, text: 'Kale kapısı açıldı. General geliyor.' }),
        W(8, ['mid', 'smurf', 'feed'], { creepSquads: 1, boss: 'boss_general', bossLevel: 1, bossAt: 'dire', text: 'DİRE GENERALİ SAHADA' }),
      ],
      objectives: [
        { id: 'boss', kind: 'boss', boss: 'boss_general', text: 'Dire Generali’ni yen' },
        { id: 'creep', kind: 'kill', unit: 'creep', n: 12, optional: true, text: '12 creep indir' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
    }),
    dialogue: {
      intro: [
        K('general', 'Dalın.'),
        kurye('…Bu kadar mı? Konuşma bu kadar mı?'),
        K('general', 'Dalın. Dedim.'),
        hero('Emirleri kısa, kılıcı uzun.', { alt: { balta: 'Kılıcı benim baltamdan uzun. Kıskandım.' } }),
        kurye('Koni biçimli kırmızıdan uzak dur. Nara atınca creep’ler güçlenir: önce onları ayıkla.'),
      ],
      triggers: [
        { on: 'bossPhase', phase: 2, cards: [K('general', 'Takviyeler! Hepsi! ŞİMDİ!'), kurye('Son hücum! Takviyeleri kule menziline çek.')] },
      ],
      win: [
        K('general', 'Emir… yoktu… geri çekilmek diye bir emir yoktu…', { card: 'lore_general' }),
        kurye('General düştü. Salon II’deki Balta’ya çok benziyordu; aile meselesi, karışmayalım.'),
        kurye('Lanetin kalbine giden yol Roshan’ın ininden geçiyor. Aegis’siz oraya girilmez.'),
      ],
      lose: 'General “Dalın” dedi, biz de daldık. Yanlış tarafa. Tekrar?',
    },
  },

  // ================================================================ IV · Roshan’ın İni
  s4m1: {
    name: 'Aegis’i Kazan', kicker: 'Roshan çukuru',
    brief: 'Roshan çukurunda uyuyor. Onu uyandır, yen ve Aegis’i al: bir kez ölümden döndürür. Sürü de Aegis’in peşinde; çukuru boş bırakma.',
    heroes: { rec: ['balta', 'agac'] },
    tips: ['Yere vuruş: kırmızı daireden çık. Kükreme: sarı halka sersemletir.', 'Çukurdan uzaklaşırsa geri döner ve iyileşir.'],
    build: () => ({
      modifiers: { startLevel: 10, startGold: 3000 },
      prep: 15,
      waves: [
        W(7, ['feed', 'farm', 'chat', 'smurf', 'mid'], { creepSquads: 1, boss: 'boss_roshan', bossLevel: 2, bossAt: 'pit', text: 'Çukurda bir horultu…' }),
        W(8, ['feed', 'kurye', 'chat', 'smurf', 'mid', 'rapier'], { creepSquads: 1, text: 'Sürü Aegis’in kokusunu aldı.' }),
      ],
      objectives: [
        { id: 'rosh', kind: 'boss', boss: 'boss_roshan', text: 'Roshan’ı yen' },
        { id: 'aegis', kind: 'custom', n: 1, text: 'Aegis’i al' },
        { id: 'hiz', kind: 'time', t: 210, optional: true, text: '210 sn içinde bitir' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
      setup: script((g, { on }) => {
        on('pickup', (d) => { if (d.pickup && d.pickup.kind === 'aegis') g.objAdd('aegis', 1); });
      }),
    }),
    dialogue: {
      intro: [
        kurye('Şşşt. Kaya Canavarı uyuyor. Eskiden adı Roshan’mış; biri “Rosh ne zaman çıkıyor?” diye kırk kez sorunca adını değiştirmiş.', { card: 'ch4' }),
        K('roshan', 'Hrrmm… Kim… Peynirimi… kim istiyor…'),
        hero('Aegis’i istiyorum. Peynir senin olsun.'),
        K('roshan', 'İKİSİ DE BENİM!'),
        kurye('Yere vuruşta kırmızı daireden çık. Sarı halka kükremedir: sersemletir, gördüğün an uzaklaş.'),
      ],
      triggers: [
        { on: 'objective', id: 'rosh', done: true, cards: [kurye('Düştü! Aegis çukurun başında: hemen al, sürü de ona koşuyor!')] },
      ],
      win: [
        kurye('Aegis sende. Bir kez ölürsen döneceksin. Bir kez.'),
        hero('Bir kez yeter.'),
      ],
      lose: 'Roshan kazandı, Aegis de onda kaldı. Kükremede uzaklaşmayı dene.',
    },
  },
  s4m2: {
    name: 'Chat’i Sustur', kicker: 'Sessizlik',
    brief: 'Chat Köpekleri inin önünde toplanmış, uzaktan “REPORT!” yağdırıyor. Değen her REPORT yavaşlatır. On iki Chat Köpeği’ni sustur. Şimşek Ruhu da fırtınayla geldi: bu görevde misafir kahraman.',
    heroes: { rec: ['simsek', 'okcu'], guest: 'simsek' },
    tips: ['REPORT balonları düz gider: yana adım at.', 'Menzilli kahramanlar Chat Köpeklerini uzaktan avlar.'],
    build: () => ({
      modifiers: { startLevel: 11, startGold: 3300 },
      prep: 15,
      waves: [
        W(7, ['chat', 'chat', 'chat', 'feed', 'chat', 'smurf'], { creepSquads: 1, text: 'REPORT! REPORT! REPORT!' }),
        W(8, ['chat', 'chat', 'mid', 'chat', 'chat', 'rapier', 'ward'], { creepSquads: 1 }),
        W(9, ['chat', 'chat', 'chat', 'smurf', 'chat', 'mid', 'feed'], { creepSquads: 1, elites: 1 }),
      ],
      objectives: [
        { id: 'chat', kind: 'kill', unit: 'chat', n: 12, text: '12 Chat Köpeği sustur' },
        { id: 'report', kind: 'custom', n: 3, hold: true, optional: true, text: 'En çok 3 REPORT ye' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
      setup: script((g, { on }) => {
        let hits = 0;
        on('bubbleHit', () => {
          hits += 1;
          if (hits > 3) g.objFail('report');
          else g.objSet('report', hits);
        });
      }),
    }),
    dialogue: {
      intro: [
        K('dog:chat', 'REPORT! REPORT! Bu kahraman feed’liyor! REPORT!'),
        kurye('Chat Köpekleri. Maç kaybedilmeden önce kaybedilen tek şey: moral.'),
        K('hero:simsek', 'Göz açıp kapayana kadar oradayım. Sonra “Ben mi yaptım?” derim.'),
        kurye('Şimşek Ruhu! Bu görevde bizimle. Balonlara dikkat: değerse yavaşlarsın.'),
      ],
      triggers: [
        { on: 'objective', id: 'chat', progress: 6, cards: [K('dog:chat', '…mute mu attın? MUTE MU ATTIN?'), kurye('Yarısı sustu. Kulaklarım dinleniyor.')] },
      ],
      win: [
        kurye('Sessizlik. Duyuyor musun? Hiçbir şey. Harika.'),
        K('hero:simsek', 'Fırtına seninle, kahraman. Kalbin yolunda görüşürüz.'),
        kurye('Ve inin dibinde bir şey kıpırdadı. Roshan’ı yenmiştik. Ama şimdi…'),
      ],
      lose: 'Chat kazandı. Chat hep kazanır. Ama bu sefer kazanmasın.',
    },
  },
  s4m3: {
    name: 'Kaya Canavarı', kicker: 'Boss', boss: 'boss_roshan',
    brief: 'Aegis’ini aldığın Roshan, lanetin gücüyle yeniden doğdu: Kaya Canavarı. Daha büyük, daha sert, daha aç. Çukurundan uzaklaşırsan döner ve iyileşir; dövüşü inde bitir.',
    heroes: { rec: ['golge', 'okcu'] },
    tips: ['Kükremeyi (sarı) gördüğünde halkadan çık, sonra geri dön.', 'Aegis bu sefer yok: dikkatli ol.'],
    build: () => ({
      modifiers: { startLevel: 12, startGold: 3600 },
      prep: 15,
      waves: [
        W(8, ['feed', 'farm', 'chat', 'smurf', 'mid', 'rapier'], { creepSquads: 1, text: 'İnin derinliklerinden bir gümbürtü.' }),
        W(9, ['smurf', 'mid', 'feed'], { boss: 'boss_roshan', bossLevel: 3, bossAt: 'pit', text: 'KAYA CANAVARI UYANDI' }),
      ],
      objectives: [
        { id: 'boss', kind: 'boss', boss: 'boss_roshan', text: 'Kaya Canavarı’nı yen' },
        { id: 'hiz', kind: 'time', t: 200, optional: true, text: '200 sn içinde bitir' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
      setup: script((g, { onStep }) => {
        let told = false;
        onStep(() => {
          if (told) return;
          const b = g.activeBoss && g.activeBoss();
          if (b && b.def && b.def.id === 'boss_roshan' && b.hp < b.maxHp * 0.5) { told = true; g.emit('story', { key: 'rosh50' }); }
        });
      }),
    }),
    dialogue: {
      intro: [
        K('roshan', 'PEYNİRİMİ… ALDIN… AEGIS’İMİ… ALDIN…'),
        kurye('Bu sefer biraz daha kızgın.'),
        K('roshan', 'Lanet bana güç verdi. Artık KAYA CANAVARIYIM!'),
        hero('Adını değiştirmek seni değiştirmez.'),
      ],
      triggers: [
        { on: 'story', key: 'rosh50', cards: [K('roshan', 'Kaya… çatlıyor…'), kurye('Çatlıyor! Vurmaya devam!')] },
      ],
      win: [
        K('roshan', 'Hrrmm… Uyuyacağım. Uyandırmayın. Sekiz ila on bir dakika.', { card: 'lore_roshan' }),
        kurye('Kaya Canavarı düştü. İnin arkasında bir kapı var: Sonsuz Pub’a açılıyor.'),
        kurye('Şimşek Ruhu da sözünü tuttu: artık bizimle.'),
      ],
      lose: 'Kaya Canavarı yine kazandı. Çukurda dövüş, kükremede çık, sonra dön.',
    },
  },

  // ================================================================ V · 1vDOQUZ
  s5m1: {
    name: 'Dokuz DOG Lordu', kicker: 'Lordlar',
    brief: 'Kalbin önünde dokuz lord bekliyor; her biri bir zamanlar takım arkadaşındı. Farm, Feed, Pause, AFK, Kurye, Rapier, Mid, Wardsız, Chat. Dokuzunu da indir: 1vDOQUZ.',
    heroes: { rec: ['okcu', 'simsek'] },
    tips: ['Lordların üstünde “LORD” yazar; canları üç kat.', 'Önce lordları indir, sürü onlarsız dağılır.'],
    build: () => ({
      modifiers: { startLevel: 13, startGold: 4000 },
      prep: 20,
      waves: [
        W(8, ['feed', 'chat'], { creepSquads: 1, text: 'Üç lord ilerliyor: Farm, Feed, Pause.',
          units: [{ id: 'dog_farm', ...LORD }, { id: 'dog_feed', ...LORD, delay: 5 }, { id: 'dog_pause', ...LORD, delay: 10 }] }),
        W(9, ['mid', 'ward'], { creepSquads: 1, text: 'Üç lord daha: AFK, Kurye, Rapier.',
          units: [{ id: 'dog_afk', ...LORD }, { id: 'dog_kurye', ...LORD, delay: 5 }, { id: 'dog_rapier', ...LORD, delay: 10 }] }),
        W(10, ['smurf', 'feed'], { creepSquads: 1, text: 'Son üç lord: Mid, Wardsız, Chat.',
          units: [{ id: 'dog_mid', ...LORD }, { id: 'dog_ward', ...LORD, delay: 5 }, { id: 'dog_chat', ...LORD, delay: 10 }] }),
      ],
      objectives: [
        { id: 'lord', kind: 'kill', unit: 'lord', n: 9, text: '9 DOG lordunu indir' },
        { id: 'hiz', kind: 'time', t: 420, optional: true, text: '420 sn içinde bitir' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
    }),
    dialogue: {
      intro: [
        kurye('İşte kalbin kapısı. Önünde dokuz lord.', { card: 'ch5' }),
        kurye('Hepsini tanıyorum. Farm’cı, “ilk ben dalarım” diyen, “1 dk” deyip giden, hiç gelmeyen, Tango’mu çalan, kılıcını düşüren, mid’i bırakmayan, ward almayan ve… chat.', { card: 'lore_lordlar' }),
        K('dog:chat', 'REPORT… REPORT HEPİNİZİ…'),
        hero('Dokuza bir. Alıştım.'),
        kurye('1vDOQUZ. Adını bu yüzden sevdim.'),
      ],
      triggers: [
        { on: 'objective', id: 'lord', progress: 3, cards: [kurye('Üç lord! Gözlerindeki kırmızı sönüyor. Lanet kırıldıkça hatırlıyorlar.')] },
        { on: 'objective', id: 'lord', progress: 6, cards: [kurye('Altı! Sürü dağılıyor!')] },
      ],
      win: [
        kurye('Dokuz lord, bir kahraman. DOG DOG DOG… ama bu sefer bizim için.'),
        kurye('Kalbin kapısında son bir kule kaldı. Pub onu son gücüyle yıkmaya çalışacak.'),
      ],
      lose: 'Lordlar kazandı. Onlar dokuz, sen bir; ama sen hep birsin, alışkınsın.',
    },
  },
  s5m2: {
    name: 'Son Kule', kicker: 'Son savunma',
    brief: 'Kalp son bir hamle yapıyor: bütün sürüyü ve Dire ordusunu tek Radiant kulene yolladı. Diğer kule çoktan düştü. 150 saniye dayan; son kule ayakta kalsın.',
    heroes: { rec: ['agac', 'buz'] },
    tips: ['Kulenin yanında dövüş: creep’leri o da vurur.', 'Ağaç Bekçisi’nin Canlı Zırhı kuleye de işler; Kutsal Tılsım kuleleri onarır.'],
    build: () => ({
      modifiers: { startLevel: 13, startGold: 4300 },
      prep: 20,
      waves: [
        W(8, ['feed', 'farm', 'mid', 'chat', 'smurf', 'kurye'], { creepSquads: 2, text: 'Pub son ordusunu yolladı.' }),
        W(9, ['feed', 'pause', 'mid', 'chat', 'smurf', 'rapier'], { creepSquads: 2 }),
        W(10, ['feed', 'farm', 'mid', 'afk', 'smurf', 'rapier', 'chat'], { creepSquads: 2, elites: 1 }),
      ],
      objectives: [
        { id: 'dayan', kind: 'survive', t: 150, text: '150 sn hayatta kal' },
        { id: 'kule', kind: 'protect', text: 'Son kule ayakta kalsın' },
        { id: 'sonvurus', kind: 'lastHits', n: 40, optional: true, text: '40 son vuruş yap' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
      setup: script((g) => {
        // diğer Radiant kulesi çoktan düştü (hedefi bozmadan yıkık başlar); Kurye sonuncuyu son Tılsım’la güçlendirdi
        for (const t of g.towers) {
          if (t.side !== 'radiant') continue;
          if (t.spot === 'r2') { t.dead = true; t.hp = 0; t.deadT = 9; } else { t.maxHp = Math.round(t.maxHp * 1.6); t.hp = t.maxHp; t.armor += 3; }
        }
      }),
    }),
    dialogue: {
      intro: [
        kurye('Diğer kuleyi görüyor musun? Görmüyorsun. Çünkü yok.'),
        hero('Tek kule, tek kahraman.'),
        kurye('İki buçuk dakika. Yirmi dört saatlik bir yayının yanında hiçbir şey.'),
        K('ancient', 'Gel… Kule düşecek… Sen de düşeceksin… Maç hiç bitmeyecek…', { card: 'lore_pub' }),
      ],
      triggers: [
        { on: 'objective', id: 'dayan', progress: 75, cards: [kurye('Yarıladık! Kule hâlâ ayakta!')] },
        { on: 'objective', id: 'dayan', progress: 120, cards: [kurye('Son otuz saniye! Her şeyini ver!')] },
      ],
      win: [
        kurye('Kule ayakta! Kalp açıkta!'),
        hero('Bitirelim şu maçı.'),
      ],
      lose: 'Son kule düştü. Pub güldü. Ama biz son sözü söylemedik.',
    },
  },
  s5m3: {
    name: 'Kalbi Kır', kicker: 'Final', boss: 'boss_ancient',
    brief: 'Sonsuz Pub’ın Kalbi: boynuzlu obsidyen anıtın ortasında atan kızıl kristal. İç nabızda dışarı, dış nabızda içeri. %70 ve %35’te kalkan açar: dört muhafızı indir. Kalp kırılınca maç biter.',
    heroes: { rec: ['balta', 'golge'] },
    tips: ['İÇ NABIZ: dışarı kaç. DIŞ NABIZ: kalbe yaklaş.', 'Kalkan açıkken muhafızları indir, sonra kalbe dön.', 'Geri alma altınını harcama: Kalp’in karşısında ikinci şansın o.'],
    build: () => ({
      modifiers: { startLevel: 14, startGold: 4800 },
      prep: 20,
      waves: [
        W(10, ['feed', 'smurf', 'chat', 'mid'], { creepSquads: 1, boss: 'boss_ancient', bossLevel: 2, bossAt: 'center', text: 'SONSUZ PUB’IN KALBİ ATIYOR' }),
      ],
      objectives: [
        { id: 'boss', kind: 'boss', boss: 'boss_ancient', text: 'Sonsuz Pub’ın Kalbi’ni kır' },
        { id: 'hiz', kind: 'time', t: 360, optional: true, text: '360 sn içinde bitir' },
        { id: 'olme', kind: 'noDeath', optional: true, text: 'Hiç ölme' },
      ],
    }),
    dialogue: {
      intro: [
        K('ancient', 'Yirmi dört saat… Kırk sekiz saat… Maç hiç bitmez. Kimse ayrılmaz. Herkes DOG olur.'),
        kurye('Onu dinleme. Bu lanetin sesi.'),
        hero('Maçlar biter. Biz bitiririz.', { alt: { okcu: 'Maçlar biter. Son oku ben atarım.', agac: 'Her kış biter. Bu maç da bitecek.' } }),
        K('ancient', 'O zaman gel, son kahraman. 1vDOQUZ… Hah.'),
      ],
      triggers: [
        { on: 'bossPhase', phase: 2, cards: [K('ancient', 'Muhafızlarım! Beni koruyun!'), kurye('Kalkan! Dört muhafızı indir, kalkan düşer!')] },
        { on: 'bossShieldBreak', cards: [kurye('Kalkan kırıldı! Şimdi kalbe!')] },
        { on: 'bossPhase', phase: 3, cards: [K('ancient', 'Hayır… Kimse… ayrılmaz…')] },
      ],
      win: [
        K('ancient', 'Maç… bitti mi?', { card: 'lore_ancient' }),
        kurye('Bitti.'),
      ],
      lose: 'Kalp hâlâ atıyor. Ama çatladığını gördüm. Bir kez daha.',
    },
  },
};
for (const [id, M] of Object.entries(MISSIONS)) {
  const C = CHAPTER_OF[id];
  M.id = id;
  M.chapter = C.n;
  M.index = C.missions.indexOf(id) + 1;
  M.bossMission = M.index === 3;
}

/** Final (V. bölümün boss görevi ilk kez kazanılınca): diyalog + jenerik kartı. */
export const FINALE = {
  cards: [
    kurye('Kalp kırıldı. Bak… DOG’ların gözleri. Kırmızı gidiyor.'),
    K('dog:feed', 'Ben… ilk dalan hep ben değil miydim? Bu sefer beklerim. Söz.'),
    K('dog:ward', 'Bir ward aldım. İlk kez. Güzelmiş.'),
    K('dog:chat', '…gg wp.'),
    kurye('Dokuzu da geri döndü. Takım arkadaşı olarak. Sitenin sözü doğruymuş:'),
    kurye('Kahramanlar masumdur, DOG’luk oyuncudadır.', { quote: true, card: 'lore_final' }),
    hero('Peki şimdi?'),
    kurye('Yirmi dört saat oldu. Isınma turu bitti.', { quote: true }),
  ],
  title: 'Dokuzun Laneti kırıldı',
  lines: [
    ['Anlatıcı', 'Kurye (bu maçta 300 kez öldü, 301’incide seni buldu)'],
    ['Kahraman', 'Sen · 1vDOQUZ'],
    ['Bosslar', 'Feed Alfa · Gölge Ulusu · Dire Generali · Kaya Canavarı · Sonsuz Pub’ın Kalbi'],
    ['Takım arkadaşları', 'Farm, Feed, Pause, AFK, Kurye, Rapier, Mid, Wardsız, Chat'],
    ['Teşekkürler', 'Yirmi dört saatten kısa sürmeyen yayınlara, chat’e ve her “DOG DOG DOG”a'],
  ],
  motto: 'Kahramanlar masumdur, DOG’luk oyuncudadır.',
};

/** Kodeks “Hikâye” kartları (progression.registerCodex('story', …)). ch1–ch5 ilerlemede hazır. */
export const STORY_CODEX = [
  { id: 'lore_kurye', name: 'Kurye', group: 'Karakter', color: '#e9b949', icon: 'courier',
    desc: 'Kanatlı eşek, hikâyenin anlatıcısı. Bu maçta 300 kez öldü; 301’incide seni buldu.',
    lore: 'Kurye diyor ki: “Taşıdığım her Tango’nun bir hikâyesi var. Çoğu çalındı.”' },
  { id: 'lore_lanet', name: 'Dokuzun Laneti', group: 'Efsane', color: '#ff6a2b', icon: 'skull',
    desc: 'Ward alınmayan her gece, unutulan her Aegis’te bir oyuncunun ruhu DOG’a döner. Dokuzu döndü; sen kaldın.',
    lore: 'Kurye diyor ki: “1vDOQUZ bir övünç değil, bir durum tespiti.”' },
  { id: 'lore_feedalfa', name: 'Feed Alfa’nın Sonu', group: 'I. bölüm', color: '#ff7a3d', icon: 'paw',
    desc: 'Sürünün başı düşünce gözlerindeki kırmızı söndü. Son sözü bir soruydu: “Neden hep ilk ben dalıyordum?”' },
  { id: 'lore_shadow', name: 'Gölge Ulusu’nun Pişmanlığı', group: 'II. bölüm', color: '#8b6cff', icon: 'eye',
    desc: 'Ward yiyen kurt ışığa çıkınca küçüldü. Son dileği bir wardmış.' },
  { id: 'lore_general', name: 'Generalin Son Emri', group: 'III. bölüm', color: '#e0354b', icon: 'greatsword',
    desc: 'Dire Generali’nin sözlüğünde “geri çekil” yoktu. Artık “dalın” da yok.' },
  { id: 'lore_roshan', name: 'Kaya Canavarı Uyuyor', group: 'IV. bölüm', color: '#e9b949', icon: 'skull',
    desc: 'Lanetin güç verdiği Roshan yeniden uykuya daldı. Uyandırmayın: sekiz ila on bir dakika.' },
  { id: 'lore_lordlar', name: 'Dokuz DOG Lordu', group: 'V. bölüm', color: '#ff6a2b', icon: 'paw',
    desc: 'Farm, Feed, Pause, AFK, Kurye, Rapier, Mid, Wardsız, Chat. Kalbin kapısındaki dokuz lord, bir zamanlar takım arkadaşındı.' },
  { id: 'lore_pub', name: 'Sonsuz Pub', group: 'V. bölüm', color: '#ff3b6b', icon: 'ancient',
    desc: 'Bitmeyen pub maçının oynandığı yer. Kimse ayrılmaz, kimse “gg” yazmaz; en kısa yayın yirmi dört saat.' },
  { id: 'lore_ancient', name: 'Kalp Kırıldı', group: 'V. bölüm', color: '#ff3b6b', icon: 'ancient',
    desc: 'Sonsuz Pub’ın Kalbi çatladı ve sustu. Son sorusu: “Maç… bitti mi?”' },
  { id: 'lore_final', name: 'Kahramanlar Masumdur', group: 'Kapanış', color: '#43d6a0', icon: 'book',
    desc: 'Lanet kırıldı, dokuz DOG takım arkadaşına döndü. “Kahramanlar masumdur, DOG’luk oyuncudadır.” Yirmi dört saat oldu; ısınma turu bitti.' },
];

// ------------------------------------------------------------------ görev yapılandırması
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Görev kimliği geçerli mi? */
export const isMission = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(MISSIONS, id);

/**
 * runConfig.mission: { waves, objectives, victory, failOnObjective, prep, modifiers, setup, missionId }
 * Her çağrıda taze nesneler (oyun hedef nesnelerini değiştirir). setup: görev betiği (işlev; game.js çağırır).
 */
export function missionConfig(id) {
  if (!isMission(id)) return null;
  const M = MISSIONS[id];
  const b = M.build();
  const { setup, ...data } = b;
  const out = clone(data);
  return {
    missionId: id,
    victory: 'objectives',
    failOnObjective: true,
    prep: 0,
    ...out,
    modifiers: out.modifiers || {},
    setup: typeof setup === 'function' ? setup : null,
  };
}

/** Tam koşu yapılandırması (arena.js / simülasyon). heroId misafir kahramansa allowLocked açılır. */
export function storyRunConfig(id, heroId) {
  const mission = missionConfig(id);
  if (!mission) return null;
  const M = MISSIONS[id];
  const guest = M.heroes && M.heroes.guest === heroId;
  return {
    mode: 'story',
    missionId: id,
    heroId,
    curse: 0,
    modifiers: { ...mission.modifiers },
    mission,
    ...(guest ? { allowLocked: true, guest: true } : {}),
  };
}

/** Yıldız kuralları (metin): [zafer, 1. bonus, 2. bonus]. Her tamamlanan bonus +1 yıldız (sırası önemsiz). */
export function starRules(id) {
  if (!isMission(id)) return [];
  const objs = MISSIONS[id].build().objectives;
  const opt = objs.filter((o) => o.optional);
  return ['Görevi kazan', ...opt.slice(0, 2).map((o) => o.text)];
}

/** Zorunlu hedeflerin metinleri. */
export function requiredGoals(id) {
  if (!isMission(id)) return [];
  return MISSIONS[id].build().objectives.filter((o) => !o.optional).map((o) => o.text);
}

/**
 * Yıldız: zafer 1 + tamamlanan her isteğe bağlı hedef için 1 (en çok 3).
 * result: runEnd yükü ({ victory, objectives: [{ id, optional, done, failed }] }) ya da game.report().
 */
export function starsFor(id, result) {
  if (!result || !result.victory) return 0;
  const list = Array.isArray(result.objectives) ? result.objectives : (result.stats && result.stats.objectives) || [];
  const opt = list.filter((o) => o.optional);
  let s = 1;
  for (const o of opt.slice(0, 2)) if (o.done && !o.failed) s += 1;
  return Math.min(3, s);
}

/** Görev içi diyalog tetikleyicisi bu olaya uyuyor mu? */
export function triggerMatches(t, type, d = {}) {
  if (!t || t.on !== type) return false;
  switch (type) {
    case 'waveStart': return t.wave == null || d.wave === t.wave;
    case 'bossPhase': return t.phase == null || d.phase === t.phase;
    case 'bossSpawn': return !t.boss || d.boss === t.boss;
    case 'story': return d.key === t.key;
    case 'objective':
      if (t.id && d.id !== t.id) return false;
      if (t.done) return !!d.done;
      if (t.failed) return !!d.failed;
      if (t.progress != null) return !d.failed && d.progress >= t.progress;
      return true;
    default: return true;
  }
}

// ------------------------------------------------------------------ kayıt
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function fresh() {
  return { v: STORY_VERSION, missions: {}, chapters: {}, finale: 0, rewards: {}, last: null };
}
/** Kaydı okur ve temizler (bozuk/eski kayıt güvenle boş profile döner). */
export function loadStory() {
  let raw = null;
  try { raw = ls.get(STORY_KEY, null); } catch { raw = null; }
  const S = fresh();
  if (!isObj(raw)) return S;
  if (isObj(raw.missions)) {
    for (const [id, m] of Object.entries(raw.missions)) {
      if (!isMission(id) || !isObj(m)) continue;
      S.missions[id] = {
        stars: Math.max(0, Math.min(3, Math.floor(num(m.stars)))),
        wins: Math.max(0, Math.floor(num(m.wins))),
        plays: Math.max(0, Math.floor(num(m.plays))),
        best: num(m.best) > 0 ? Math.round(num(m.best)) : 0,
        first: Math.max(0, Math.floor(num(m.first))),
      };
    }
  }
  if (isObj(raw.chapters)) for (const C of CHAPTERS) if (num(raw.chapters[C.n]) > 0) S.chapters[C.n] = Math.floor(num(raw.chapters[C.n]));
  if (isObj(raw.rewards)) for (const [k, v] of Object.entries(raw.rewards)) if (/^[a-z0-9_]{1,24}$/.test(k) && num(v) > 0) S.rewards[k] = Math.floor(num(v));
  S.finale = num(raw.finale) > 0 ? Math.floor(num(raw.finale)) : 0;
  S.last = isMission(raw.last) ? raw.last : null;
  return S;
}
function saveStory(S) {
  try { ls.set(STORY_KEY, S); } catch { /* depolama kapalı: ilerleme bu oturumda kalır */ }
}

/** Bölüm açık mı? I her zaman; N+1, N’nin boss görevi kazanılınca. */
export function chapterUnlocked(n, S = loadStory()) {
  if (n <= 1) return true;
  const prev = CHAPTERS[n - 2];
  return !!prev && (S.missions[prev.missions[2]] || {}).wins > 0;
}
/** Görev açık mı? Bölüm açık ve bölümdeki önceki görev kazanılmış olmalı. */
export function missionUnlocked(id, S = loadStory()) {
  if (!isMission(id)) return false;
  const M = MISSIONS[id];
  if (!chapterUnlocked(M.chapter, S)) return false;
  if (M.index === 1) return true;
  const prevId = CHAPTER_OF[id].missions[M.index - 2];
  return (S.missions[prevId] || {}).wins > 0;
}
/** Sıradaki görev (bölüm içinde sonraki, yoksa sonraki bölümün ilki). */
export function nextMissionAfter(id) {
  const i = MISSION_IDS.indexOf(id);
  return i >= 0 && i < MISSION_IDS.length - 1 ? MISSION_IDS[i + 1] : null;
}

/**
 * İlerleme özeti: { missions: { id: { stars, wins, plays, best, unlocked, won } }, chapters: [{ n, unlocked, done, stars, max }],
 *   stars, maxStars, wins, current (oynanacak ilk kazanılmamış açık görev), chapter (en yüksek açık bölüm), finished, finale, last }
 */
export function storyProgress() {
  const S = loadStory();
  const missions = {};
  let stars = 0;
  let wins = 0;
  let current = null;
  for (const id of MISSION_IDS) {
    const m = S.missions[id] || { stars: 0, wins: 0, plays: 0, best: 0 };
    const unlocked = missionUnlocked(id, S);
    missions[id] = { ...m, unlocked, won: m.wins > 0 };
    stars += m.stars;
    if (m.wins > 0) wins += 1;
    if (!current && unlocked && !(m.wins > 0)) current = id;
  }
  const chapters = CHAPTERS.map((C) => {
    const st = C.missions.reduce((a, id) => a + missions[id].stars, 0);
    return { n: C.n, unlocked: chapterUnlocked(C.n, S), done: missions[C.missions[2]].won, stars: st, max: 9, first: S.chapters[C.n] || 0 };
  });
  const chapter = chapters.filter((c) => c.unlocked).reduce((a, c) => Math.max(a, c.n), 1);
  return {
    missions, chapters, stars, maxStars: MISSION_IDS.length * 3, wins, total: MISSION_IDS.length,
    current: current || S.last || MISSION_IDS[0], chapter, finished: chapters[chapters.length - 1].done,
    finale: S.finale, last: S.last, rewards: { ...S.rewards },
  };
}

/**
 * Görev sonucu kaydı. result: { victory, stars?, time?, objectives? }
 * → { id, stars, prevStars, newStars, firstWin, best, chapterDone: n|null (bölüm ilk kez bitti), finale: bool (ilk kez),
 *     next: sıradaki görev kimliği (açıldıysa), reward: { hero } | null (bölüm ödülü, yalnız bilgi) }
 */
export function recordMission(id, result = {}) {
  if (!isMission(id)) return null;
  const S = loadStory();
  const M = MISSIONS[id];
  const prev = S.missions[id] || { stars: 0, wins: 0, plays: 0, best: 0, first: 0 };
  const victory = !!result.victory;
  const stars = victory ? Math.max(1, Math.min(3, Math.floor(num(result.stars, starsFor(id, result))))) : 0;
  const rec = { ...prev, plays: prev.plays + 1 };
  const firstWin = victory && !(prev.wins > 0);
  if (victory) {
    rec.wins = prev.wins + 1;
    rec.stars = Math.max(prev.stars, stars);
    const t = Math.round(num(result.time, 0));
    if (t > 0 && (!prev.best || t < prev.best)) rec.best = t;
    if (!prev.first) rec.first = Date.now();
  }
  S.missions[id] = rec;
  S.last = id;
  let chapterDone = null;
  let finale = false;
  let reward = null;
  if (firstWin && M.bossMission) {
    const C = CHAPTER_OF[id];
    if (!S.chapters[C.n]) { S.chapters[C.n] = Date.now(); chapterDone = C.n; reward = C.reward || null; }
    if (C.n === CHAPTERS.length && !S.finale) { S.finale = Date.now(); finale = true; }
  }
  saveStory(S);
  const next = victory ? nextMissionAfter(id) : null;
  return {
    id, stars, prevStars: prev.stars, newStars: Math.max(0, stars - prev.stars), firstWin, best: rec.best || 0,
    chapterDone, finale, reward, next: next && missionUnlocked(next, S) ? next : null,
  };
}

/** Bölüm ödülünün verildiğini işaretle (tekrar verilmesin). */
export function markReward(key) {
  const S = loadStory();
  if (S.rewards[key]) return false;
  S.rewards[key] = Date.now();
  saveStory(S);
  return true;
}

/** Yalnızca geliştirme/test: tüm görevleri (ya da n. bölüme kadar) kazanılmış say. */
export function devCompleteStory(upTo = CHAPTERS.length, stars = 3) {
  const S = loadStory();
  for (const C of CHAPTERS) {
    if (C.n > upTo) break;
    for (const id of C.missions) S.missions[id] = { stars, wins: 1, plays: 1, best: 0, first: Date.now() };
    S.chapters[C.n] = S.chapters[C.n] || Date.now();
  }
  saveStory(S);
  return storyProgress();
}
export function resetStory() { saveStory(fresh()); }
