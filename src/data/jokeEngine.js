// Espri Varyasyon Motoru — "çoğalt" isteğinin kalbi.
//
// Şablon + kelime havuzu ile deterministik (tohumlu) ya da rastgele espri üretir.
// Türkçe ek uyumu için iki yol kullanılır:
//   1) Özel adlar (kahraman, eşya, rütbe) bir "okunuş" ipucu taşır; ekler bu okunuşa göre
//      ünlü uyumu ve ünsüz benzeşmesiyle hesaplanır: Pudge (puc) → Pudge’u, Pudge’a, Pudge’un.
//   2) Cümlecik havuzları (hatalar, yerler) ihtiyaç duyulan biçimleri önceden çekimli taşır.
//      Geçmiş zaman ekleri "~D" işaretiyle yazılır; motor bunu -dı/-di/-du/-dü/-tı… ya da
//      fıkra kipi için -mış/-miş/-muş/-müş olarak çekimler.
//
// Şablon yuvası sözdizimi:  {havuz}  {havuz.biçim}  {havuz2.biçim}  {^havuz.biçim}
//   - sondaki rakam aynı havuzdan FARKLI bir öğe ister ({chat} ve {chat2} asla aynı olmaz)
//   - aynı yuva şablonda iki kez geçerse aynı değeri alır
//   - ^ ön eki ilk harfi büyütür (Türkçe kurallarıyla: i → İ)
//
// API:
//   generate(seed?, { cat }?)   → { id, cat, text, seed, tpl }
//   generateMany(n, { cat, seed }?) → dizi (tekrarsız metinler)
//   countCombos(cat?)           → motorun üretebileceği farklı espri sayısı
//   ENGINE_CATEGORIES, TEMPLATE_COUNT, POOL_SIZES

import { seeded } from '../core/dom.js';

const AP = '’';

// ---------------------------------------------------------------- Türkçe ek uyumu
const VOWELS = 'aeıioöuü';
const HARD = 'fstkçşhp';

function lastVowel(s) {
  const t = s.toLocaleLowerCase('tr-TR');
  for (let i = t.length - 1; i >= 0; i--) if (VOWELS.includes(t[i])) return t[i];
  return 'e';
}
function harmony(phon) {
  const v = lastVowel(phon);
  const back = 'aıou'.includes(v);
  const round = 'ouöü'.includes(v);
  return { i4: back ? (round ? 'u' : 'ı') : (round ? 'ü' : 'i'), a2: back ? 'a' : 'e' };
}
/** Okunuşa göre hal eki (kesme işaretsiz). */
export function suffix(phon, kind) {
  const p = phon.toLocaleLowerCase('tr-TR');
  const last = p[p.length - 1];
  const ev = VOWELS.includes(last);
  const hard = HARD.includes(last);
  const { i4, a2 } = harmony(p);
  switch (kind) {
    case 'acc': return (ev ? 'y' : '') + i4;
    case 'dat': return (ev ? 'y' : '') + a2;
    case 'gen': return (ev ? 'n' : '') + i4 + 'n';
    case 'loc': return (hard ? 't' : 'd') + a2;
    case 'abl': return (hard ? 't' : 'd') + a2 + 'n';
    case 'ins': return (ev ? 'y' : '') + 'l' + a2;
    default: return '';
  }
}
const CASES = ['acc', 'dat', 'gen', 'loc', 'abl', 'ins'];

/** "~D" işaretli geçmiş zaman cümleciğini çekimler. mode: 'di' | 'mis' */
function conjugate(str, mode) {
  return str.replace(/~D/g, (_, idx) => {
    const stem = str.slice(0, idx);
    const { i4 } = harmony(stem);
    if (mode === 'mis') return 'm' + i4 + 'ş';
    const last = stem[stem.length - 1].toLocaleLowerCase('tr-TR');
    return (HARD.includes(last) ? 't' : 'd') + i4;
  });
}

const capTR = (s) => {
  const i = s.search(/[A-Za-zÇĞİÖŞÜçğıöşü0-9]/);
  if (i < 0) return s;
  return s.slice(0, i) + s[i].toLocaleUpperCase('tr-TR') + s.slice(i + 1);
};

const nf = new Intl.NumberFormat('tr-TR');

// ---------------------------------------------------------------- havuzlar
/** Özel ad: [yazım, okunuş]. Biçimler: n (yalın), acc, dat, gen, loc, abl, ins */
const proper = (list) => list.map(([t, p]) => {
  const o = { n: t };
  for (const c of CASES) o[c] = t + AP + suffix(p, c);
  return o;
});

const HEROES = proper([
  ['Pudge', 'puc'], ['Invoker', 'invokır'], ['Techies', 'tekiz'], ['Meepo', 'mipo'], ['Anti-Mage', 'meyç'],
  ['Io', 'ayo'], ['Earthshaker', 'şeykır'], ['Crystal Maiden', 'meydın'], ['Sniper', 'snaypır'], ['Riki', 'riki'],
  ['Tinker', 'tinkır'], ['Axe', 'aks'], ['Phantom Assassin', 'esesin'], ['Juggernaut', 'cagırnot'], ['Faceless Void', 'voyd'],
  ['Spectre', 'spektır'], ['Slark', 'slark'], ['Bristleback', 'bek'], ['Windranger', 'reyncır'], ['Lina', 'lina'],
  ['Zeus', 'zus'], ['Shadow Fiend', 'fiind'], ['Storm Spirit', 'spirit'], ['Queen of Pain', 'peyn'], ['Rubick', 'rubik'],
  ['Chen', 'çen'], ['Enigma', 'enigma'], ['Tidehunter', 'hantır'], ['Mirana', 'mirana'], ['Drow Ranger', 'reyncır'],
  ['Bloodseeker', 'siikır'], ['Huskar', 'huskar'], ['Broodmother', 'madır'], ['Arc Warden', 'vordın'], ['Ogre Magi', 'maci'],
  ['Wraith King', 'king'], ['Sven', 'sven'], ['Medusa', 'medusa'], ['Alchemist', 'kimist'], ['Lion', 'layın'],
  ['Lich', 'liç'], ['Dazzle', 'dezıl'], ['Oracle', 'orakıl'], ['Nature’s Prophet', 'profıt'], ['Monkey King', 'king'],
  ['Kunkka', 'kunka'], ['Tusk', 'task'], ['Clockwerk', 'klokvörk'], ['Earth Spirit', 'spirit'], ['Undying', 'andayink'],
  ['Phantom Lancer', 'lensır'], ['Naga Siren', 'sayrın'], ['Terrorblade', 'bleyd'], ['Morphling', 'morfling'], ['Ember Spirit', 'spirit'],
  ['Void Spirit', 'spirit'], ['Keeper of the Light', 'layt'], ['Ancient Apparition', 'aparişın'], ['Shadow Shaman', 'şeymın'], ['Witch Doctor', 'doktır'],
  ['Bane', 'beyn'], ['Batrider', 'raydır'], ['Tiny', 'tayni'], ['Pangolier', 'pangolyer'], ['Legion Commander', 'kımandır'],
  ['Troll Warlord', 'lord'], ['Viper', 'vaypır'], ['Necrophos', 'nekrofos'], ['Razor', 'reyzır'], ['Luna', 'luna'],
]);

const ITEMS = proper([
  ['Blink Dagger', 'dagır'], ['BKB', 'bi'], ['Divine Rapier', 'rapiyer'], ['Aghanim’s Scepter', 'septır'], ['Battle Fury', 'füri'],
  ['Radiance', 'reydiıns'], ['Shadow Blade', 'bleyd'], ['Hand of Midas', 'midas'], ['Bottle', 'batıl'], ['Observer Ward', 'vord'],
  ['Force Staff', 'staf'], ['Glimmer Cape', 'keyp'], ['Eul’s Scepter', 'septır'], ['Refresher Orb', 'orb'], ['Butterfly', 'flay'],
  ['Satanic', 'setenik'], ['Daedalus', 'dedalus'], ['Heart of Tarrasque', 'tarask'], ['Monkey King Bar', 'bar'], ['Linken’s Sphere', 'sfir'],
  ['Aether Lens', 'lens'], ['Magic Wand', 'vand'], ['Phase Boots', 'buts'], ['Power Treads', 'treds'], ['Arcane Boots', 'buts'],
  ['Mekansm', 'mekanizm'], ['Guardian Greaves', 'griivz'], ['Assault Cuirass', 'kuiras'], ['Desolator', 'leytır'], ['Mjollnir', 'myolnir'],
  ['Scythe of Vyse', 'vays'], ['Manta Style', 'stayl'], ['Diffusal Blade', 'bleyd'], ['Silver Edge', 'ec'], ['Abyssal Blade', 'bleyd'],
  ['Bloodstone', 'ston'], ['Echo Sabre', 'seybır'], ['Aegis', 'iycis'], ['Gem of True Sight', 'sayt'], ['Tranquil Boots', 'buts'],
]);

const RANKS_ALL = proper([
  ['Herald', 'herıld'], ['Guardian', 'gardiyın'], ['Crusader', 'kruseydır'], ['Archon', 'arkon'],
  ['Legend', 'lecınd'], ['Ancient', 'eynşınt'], ['Divine', 'divayn'], ['Immortal', 'imortıl'],
]);

/**
 * DOG hareketleri. past: "~D" işaretli geçmiş zaman (özne 3. tekil), inf: mastar, part: sıfat-fiil (-an/-en).
 * Hepsi kahramandan bağımsız, hem takım arkadaşına hem rakibe uyar.
 */
const BLUNDERS = [
  { past: 'kuryeyi Roshan pitine yolla~D', inf: 'kuryeyi Roshan pitine yollamak', part: 'kuryeyi Roshan pitine yollayan' },
  { past: 'BKB al~D ama bir kez bile basma~D', inf: 'BKB alıp bir kez bile basmamak', part: 'BKB alıp bir kez bile basmayan' },
  { past: 'tek başına beş kişiye dal~D', inf: 'tek başına beş kişiye dalmak', part: 'tek başına beş kişiye dalan' },
  { past: 'savaş başlarken ters yöne TP at~D', inf: 'savaş başlarken ters yöne TP atmak', part: 'savaş başlarken ters yöne TP atan' },
  { past: 'Aegis’i al~D, sonra ilk savaştan kaç~D', inf: 'Aegis’i alıp ilk savaştan kaçmak', part: 'Aegis’i alıp ilk savaştan kaçan' },
  { past: 'takım savaşırken beşinci kampı stackle~D', inf: 'takım savaşırken beşinci kampı stacklemek', part: 'takım savaşırken beşinci kampı stackleyen' },
  { past: 'Smoke’u tek başına kullan~D', inf: 'Smoke’u tek başına kullanmak', part: 'Smoke’u tek başına kullanan' },
  { past: 'ward’ı düşman çeşmesinin dibine koy~D', inf: 'ward’ı düşman çeşmesinin dibine koymak', part: 'ward’ı düşman çeşmesinin dibine koyan' },
  { past: 'Roshan’a tek başına, elinde Tango’yla gir~D', inf: 'Roshan’a tek başına, elinde Tango’yla girmek', part: 'Roshan’a tek başına, elinde Tango’yla giren' },
  { past: 'Divine Rapier al~D, ilk savaşta düşür~D', inf: 'Divine Rapier alıp ilk savaşta düşürmek', part: 'Divine Rapier alıp ilk savaşta düşüren' },
  { past: 'Blink’le düşman üssünün ortasına atla~D', inf: 'Blink’le düşman üssünün ortasına atlamak', part: 'Blink’le düşman üssünün ortasına atlayan' },
  { past: 'üç dakikalık pause atıp su içmeye git~D', inf: 'üç dakikalık pause atıp su içmeye gitmek', part: 'üç dakikalık pause atıp su içmeye giden' },
  { past: 'takımın bütün Tango’larını tek başına ye~D', inf: 'takımın bütün Tango’larını tek başına yemek', part: 'takımın bütün Tango’larını tek başına yiyen' },
  { past: 'buyback parasını ikinci Midas’a yatır~D', inf: 'buyback parasını ikinci Midas’a yatırmak', part: 'buyback parasını ikinci Midas’a yatıran' },
  { past: 'all chat’e roman yazarken savaşı kaçır~D', inf: 'all chat’e roman yazarken savaşı kaçırmak', part: 'all chat’e roman yazarken savaşı kaçıran' },
  { past: 'mid’i bırakıp on dakika rune kovala~D', inf: 'mid’i bırakıp on dakika rune kovalamak', part: 'mid’i bırakıp on dakika rune kovalayan' },
  { past: 'kuryeyi düşman ormanına sür~D', inf: 'kuryeyi düşman ormanına sürmek', part: 'kuryeyi düşman ormanına süren' },
  { past: 'TP’si yokken “geliyorum” yaz~D', inf: 'TP’si yokken “geliyorum” yazmak', part: 'TP’si yokken “geliyorum” yazan' },
  { past: 'high ground’a tek başına çık~D', inf: 'high ground’a tek başına çıkmak', part: 'high ground’a tek başına çıkan' },
  { past: 'Bottle doldurmak için savaşı terk et~D', inf: 'Bottle doldurmak için savaşı terk etmek', part: 'Bottle doldurmak için savaşı terk eden' },
  { past: 'rakip Roshan’a girerken “bence farm zamanı” de~D', inf: 'rakip Roshan’a girerken “bence farm zamanı” demek', part: 'rakip Roshan’a girerken “bence farm zamanı” diyen' },
  { past: 'aynı nehirde sekiz kez öl~D', inf: 'aynı nehirde sekiz kez ölmek', part: 'aynı nehirde sekiz kez ölen' },
  { past: 'Observer Ward’ı maç boyunca çantada taşı~D', inf: 'Observer Ward’ı maç boyunca çantada taşımak', part: 'Observer Ward’ı maç boyunca çantada taşıyan' },
  { past: 'aynı ağacın arkasında üç kez hook ye~D', inf: 'aynı ağacın arkasında üç kez hook yemek', part: 'aynı ağacın arkasında üç kez hook yiyen' },
  { past: 'Roshan’ı rakibe bırakıp bot lane’de tek bir creep kesmeye git~D', inf: 'Roshan’ı rakibe bırakıp bot lane’de tek bir creep kesmeye gitmek', part: 'Roshan’ı rakibe bırakıp bot lane’de tek bir creep kesmeye giden' },
  { past: 'ultisini creep dalgasına harca~D', inf: 'ultisini creep dalgasına harcamak', part: 'ultisini creep dalgasına harcayan' },
  { past: 'Aghanim’i kuryeyle yollayıp kuryeyi kaybet~D', inf: 'Aghanim’i kuryeyle yollayıp kuryeyi kaybetmek', part: 'Aghanim’i kuryeyle yollayıp kuryeyi kaybeden' },
  { past: 'haritada üç kırmızı nokta görüp üstüne yürü~D', inf: 'haritada üç kırmızı nokta görüp üstüne yürümek', part: 'haritada üç kırmızı nokta görüp üstüne yürüyen' },
  { past: 'kuryeyi çağırmayı unutup “item nerede?” diye sor~D', inf: 'kuryeyi çağırmayı unutup “item nerede?” diye sormak', part: 'kuryeyi çağırmayı unutup “item nerede?” diye soran' },
  { past: 'Refresher Orb al~D, ultiyi iki kez boşa bas~D', inf: 'Refresher Orb alıp ultiyi iki kez boşa basmak', part: 'Refresher Orb alıp ultiyi iki kez boşa basan' },
  { past: 'maçın ortasında “artık ben supportum” de~D', inf: 'maçın ortasında “artık ben supportum” demek', part: 'maçın ortasında “artık ben supportum” diyen' },
  { past: 'ilk on dakikada toplam dört last hit al~D', inf: 'ilk on dakikada toplam dört last hit almak', part: 'ilk on dakikada toplam dört last hit alan' },
  { past: 'rune’u görüp yanından geç~D', inf: 'rune’u görüp yanından geçmek', part: 'rune’u görüp yanından geçen' },
  { past: 'ölünce buyback yerine chat’e “gg” yaz~D', inf: 'ölünce buyback yerine chat’e “gg” yazmak', part: 'ölünce buyback yerine chat’e “gg” yazan' },
  { past: 'Gem’i alıp otuz saniyede düşür~D', inf: 'Gem’i alıp otuz saniyede düşürmek', part: 'Gem’i alıp otuz saniyede düşüren' },
  { past: 'düşman ormanında AFK kal~D', inf: 'düşman ormanında AFK kalmak', part: 'düşman ormanında AFK kalan' },
  { past: 'takım savaşı sürerken tek başına kuleye vur~D', inf: 'takım savaşı sürerken tek başına kuleye vurmak', part: 'takım savaşı sürerken tek başına kuleye vuran' },
  { past: '“bi dk” yazıp on dakika dönme~D', inf: '“bi dk” yazıp on dakika dönmemek', part: '“bi dk” yazıp on dakika dönmeyen' },
  { past: 'ward parasıyla üçüncü Bottle’ı al~D', inf: 'ward parasıyla üçüncü Bottle’ı almak', part: 'ward parasıyla üçüncü Bottle’ı alan' },
  { past: 'Smoke açıkken kuleye vurup herkesi ele ver~D', inf: 'Smoke açıkken kuleye vurup herkesi ele vermek', part: 'Smoke açıkken kuleye vurup herkesi ele veren' },
  { past: 'Blink Dagger’ı sadece kaçmak için kullan~D', inf: 'Blink Dagger’ı sadece kaçmak için kullanmak', part: 'Blink Dagger’ı sadece kaçmak için kullanan' },
  { past: 'bütün ward’ları aynı noktaya dik~D', inf: 'bütün ward’ları aynı noktaya dikmek', part: 'bütün ward’ları aynı noktaya diken' },
  { past: 'savaşı izlemek için ağacın arkasında bekle~D', inf: 'savaşı izlemek için ağacın arkasında beklemek', part: 'savaşı izlemek için ağacın arkasında bekleyen' },
].map((b) => ({ past: conjugate(b.past, 'di'), mis: conjugate(b.past, 'mis'), inf: b.inf, part: b.part }));

/** Takım arkadaşları (yalın, 3. tekil özne). */
const MATES = [
  'bizim carry', 'bizim mid', 'bizim offlaner', 'pos 4 arkadaşımız', 'pos 5 supportumuz', 'takımın kaptanı',
  'Rapier’li arkadaşımız', '“ben mid” diye bağıran arkadaş', 'kendini smurf ilan eden arkadaş', 'sessiz sedasız jungle’cımız',
  'çantasında hâlâ Tango taşıyan arkadaş', '3. dakikada “gg” yazan arkadaş', 'kilitli Pudge’umuz', '“bi dk” diyen arkadaş',
  'Immortal olduğunu iddia eden arkadaş', 'kuryeyi sahiplenen arkadaş', 'mini haritayı hiç açmayan arkadaş', 'all chat’in müdavimi arkadaş',
];
/** Rakipler. */
const FOES = [
  'rakip mid', 'rakip carry', 'karşı takımın offlaner’ı', 'rakip hard support', 'karşının Pudge’u', 'rakip takımın kaptanı',
  'rakip smurf', 'karşı takımın “ez” yazan oyuncusu', 'rakip jungle’cı', 'rakip pos 4',
];
const WHO = [...MATES, ...FOES];

const ROLES = ['support', 'carry', 'offlaner', 'midci', 'pos 5', 'pos 4', 'hard support', 'jungle’cı'];

const PLACES = [
  { n: 'Roshan pit', dat: 'Roshan pitine' }, { n: 'düşman ormanı', dat: 'düşman ormanına' }, { n: 'nehir', dat: 'nehre' },
  { n: 'Dire üssü', dat: 'Dire üssüne' }, { n: 'Radiant üssü', dat: 'Radiant üssüne' }, { n: 'düşman çeşmesi', dat: 'düşman çeşmesine' },
  { n: 'üçlü kamp', dat: 'üçlü kampa' }, { n: 'secret shop', dat: 'secret shop’a' }, { n: 'high ground', dat: 'high ground’a' },
  { n: 'mid lane', dat: 'mid lane’e' }, { n: 'bot lane', dat: 'bot lane’e' }, { n: 'top lane', dat: 'top lane’e' },
  { n: 'ancient kampı', dat: 'ancient kampına' }, { n: 'rune noktası', dat: 'rune noktasına' }, { n: 'kule dibi', dat: 'kule dibine' },
];

const CHAT = [
  'gg', '?', '???', 'ez', 'mid or feed', 'neden gelmedin', 'ben supportum ya', 'lag var', 'bir kamp daha', 'tp yoktu',
  'buyback yoktu', 'dc oldum', 'ward’ı kim sildi', 'abi sakin', '4 kişi gelin', 'rosh?', 'smoke?', 'gg go next',
  'bu oyun kazanılır', 'item build benim işim', 'bi dk', 'kurye kimde', 'ben carry’yim', 'farm lazım', 'neden ben?',
  'haritaya bakan var mı', 'b', 'lol', 'hepsi benim suçum mu', 'şimdi geliyorum', 'dive dive dive', 'mid’e gelin',
  'rampage geliyor', 'kimse ward almıyor mu', 'benim hatam değil', 'sabır', 'dur bi', 'izle beni',
];

const EXCUSES = [
  'Lag vardı.', 'Mouse kaydı.', 'Kedi klavyeye bastı.', 'Güneş gözüme geldi.', 'Ekran dondu.', 'TP’m cooldown’daydı.',
  'O aslında bait’ti.', 'Strateji bu, anlamazsınız.', 'Yanlış tuşa bastım.', 'Haritaya bakıyordum.', 'Creep’leri sayıyordum.',
  'Ping 300’dü.', 'Kulaklık düştü.', 'Çay döküldü.', 'Ben o sırada yoktum.', 'Item build öyle diyordu.', 'Rune’a gidiyordum.',
  'Roshan beni çağırdı.', 'Yama değişmiş, bilmiyordum.', 'Ben support’um, benden ne istiyorsunuz?', 'Bir saniye gözümü kırptım.',
];

const PICK_REASONS = [
  'Geçen hafta bir videoda gördüm.', 'Build’ini ezberledim, üç eşyasını biliyorum.', 'Rengi güzel.', 'Kardeşim de oynuyor.',
  'Karşıda da var, aynasını seçtim.', 'Hiç oynamadım, şimdi öğrenirim.', 'Ruhum öyle istedi.', 'Rastgele bastım, kader dedim.',
  'Seslendirmesini seviyorum.', 'Bu yamada çok güçlüymüş. 2019’da.', 'Meta bu.', 'Ben ne seçersem meta o.',
  'Kimse seçmesin diye.', 'Rakibi şaşırtmak için.',
];

const AUTHORITIES = [
  'Meteoroloji', 'Dota Bilim Kurulu', 'Roshan’ın avukatları', 'Ward Üreticileri Derneği', 'Kurye Hakları Derneği',
  'Uluslararası Pause Komitesi', 'Creep’ler Birliği', 'Aegis yetkilileri', 'Uykusuz İzleyiciler Platformu',
  'Nehir Rune’ları Sendikası', 'Ancient Kampları Federasyonu', 'Tango Üreticileri Birliği',
];

const DOG_SCORES = [
  '10 üzerinden 11 DOG', 'üç DOG, bir buçuk pati', 'tam kıvamında DOG DOG DOG', 'cihaz ölçemedi, havlamaya başladı',
  'DOG DOG DOG (rekor denemesi)', 'Immortal seviyesinde DOG', 'DOG ötesi (DOG DOG DOG DOG)', 'altın pati ödülüne aday',
];

const SNACKS = [
  'üçüncü demlik çay', 'gece yarısı tostu', 'ikinci lahmacun', 'sabah simidi', 'dördüncü kahve', 'bir kase çekirdek',
  'soğuk pizza', 'menemen', 'bir paket bisküvi', 'mandalina stoku', 'ayran', 'kumpir',
];

const UNBOUGHT = [
  'Sentry Ward', 'Smoke', 'Dust', 'Gem', 'ikinci Observer Ward', 'TP', 'Mekansm', 'Glimmer Cape (başkası için)',
  'Force Staff (takım için)',
];

const LIFE_EVENTS = [
  'mezun oldu', 'ev taşıdı', 'üç sezon dizi bitirdi', 'ehliyet aldı', 'yeni ekran kartı alıp alıştı',
  'saçını kestirdi, saçı yeniden uzadı', 'iki yama notunu ezberledi', 'Japonca öğrenmeye başladı',
  'kediyi veterinere götürüp getirdi', 'balkona domates ekip hasat etti',
];

const THEORIES = [
  'rampage', '20 dakikada GG', '1vDOQUZ', 'efsane bir highlight videosu', 'ultra kill', 'Immortal’a doğrudan terfi',
  'rakibin all chat’te “wp” yazması',
];

const CONTRIBS = [
  'kuryeyi her fırsatta sahiplenmek', 'üç dakikalık pause', 'all chat’e yazılan destansı roman', 'Roshan’a moral konuşması',
  'haritada hiç görünmemek', 'rakibe bedava Aegis', 'takıma yeni bir “?” rekoru', 'çeşmeye 14 ziyaret',
  'kendi ward’ını deny’lamak', 'rakip supporta ücretsiz farm',
];

const DOG_RANKS = [
  'Kurye Hırsızı II', 'Pause Ustası V', 'Ward Silgisi III', 'Farmcı Keşiş IV', 'Buybacksiz Kahraman I', 'Chat Romancısı II',
  'Tango Oburu III', 'Smoke Kaçağı IV', 'Rapier Bağışçısı I', 'Çeşme Turisti V', 'DOG DOG DOG (Ölümsüz)',
];

const DICT = [
  { msg: 'bir kamp daha', mean: 'Oyun bitene kadar ormandayım.' },
  { msg: 'geliyorum', mean: 'TP’m yok, yürüyerek geliyorum. Tahmini varış: maç sonrası.' },
  { msg: '?', mean: 'Hem soru, hem cevap, hem de iddianame.' },
  { msg: 'ez', mean: 'Bir sonraki maçta sessizce DOG olacağım.' },
  { msg: 'lag', mean: 'Hatayı ben yaptım ama internet sağlayıcım da ortak.' },
  { msg: 'bi dk', mean: 'On dakika. En az.' },
  { msg: 'smoke?', mean: 'Smoke alan yok; alan da ben olmayacağım.' },
  { msg: 'rosh?', mean: 'Rakip Roshan’ı yarım dakika önce aldı.' },
  { msg: 'mid or feed', mean: 'İkisi de olacak, sırası belli değil.' },
  { msg: 'ward yok mu?', mean: 'Ben almayacağım ama bir sorayım dedim.' },
  { msg: 'farm lazım', mean: 'Savaşa gelmeyeceğim ama bunu kibarca söylüyorum.' },
  { msg: 'ben supportum', mean: 'Kurye benim, ward’lar sizin.' },
  { msg: 'b', mean: 'Geri çekilin. (Kimse çekilmedi.)' },
  { msg: 'gg wp', mean: 'Rakibe söylenir; takım arkadaşına asla.' },
  { msg: '1v9', mean: 'Benim DOG’luğum en az dokuz kişiyi etkiliyor.' },
  { msg: 'sakin', mean: 'Birazdan all chat’e roman yazacağım.' },
  { msg: 'izle beni', mean: 'Birazdan ölüm ekranından beraber izleyeceğiz.' },
  { msg: 'kolay oyun', mean: 'Zor oyunun başlangıç cümlesi.' },
];

const MMR_LOSS = Array.from({ length: 17 }, (_, i) => 75 + i * 25); // 75..475
const GAMES_PER_HOUR = ['1,5', '2', '2,5'];
const TEAS = ['3', '4', '5', '6'];

// Sayı aralıkları: [min, max, adım?, biçimle?]
const range = (a, b, step = 1, fmt = false) => ({ range: true, a, b, step, fmt, size: Math.floor((b - a) / step) + 1 });

const POOLS = {
  hero: HEROES,
  item: ITEMS,
  rank: RANKS_ALL,
  rankLow: RANKS_ALL.slice(0, 4),
  rankHigh: RANKS_ALL.slice(4),
  blunder: BLUNDERS,
  mate: MATES,
  foe: FOES,
  who: WHO,
  role: ROLES,
  place: PLACES,
  chat: CHAT,
  excuse: EXCUSES,
  pickReason: PICK_REASONS,
  authority: AUTHORITIES,
  dogscore: DOG_SCORES,
  snack: SNACKS,
  unbought: UNBOUGHT,
  lifeEvent: LIFE_EVENTS,
  theory: THEORIES,
  contrib: CONTRIBS,
  dogRank: DOG_RANKS,
  dict: DICT,
  mmrLoss: MMR_LOSS,
  gph: GAMES_PER_HOUR,
  teas: TEAS,
  min: range(3, 25),
  minLate: range(31, 74),
  sec: range(2, 30),
  hour: range(12, 29),
  hourLate: range(30, 48),
  longHours: range(30, 40),
  sleep: range(6, 10),
  k: range(17, 34),
  d: range(0, 3),
  a: range(6, 21),
  tk: range(1, 8),
  td: range(28, 61),
  ta: range(3, 19),
  lh: range(12, 97),
  deaths: range(11, 23),
  bigN: range(1200, 9900, 100, true),
  chatLen: range(12, 99),
  mmrGame: range(20, 35),
};

// ---------------------------------------------------------------- şablonlar
// cat: dog | 1v9 | maraton | pub | hero | chat | mmr
const TEMPLATES = [
  // DOG DOG DOG
  { id: 'd1', cat: 'dog', t: '{who} {blunder.past}. Chat durumu üç kelimeyle özetledi: DOG DOG DOG.' },
  { id: 'd2', cat: 'dog', t: 'DOG (isim): {blunder.part} ve bunu “strateji” diye savunan oyuncu. Çoğulu: DOG DOG DOG.' },
  { id: 'd3', cat: 'dog', t: 'DOG-metre raporu\nOyuncu: {who}\nOlay: {^blunder.past}.\nÖlçüm: {dogscore}' },
  { id: 'd4', cat: 'dog', t: 'Bir DOG, iki DOG, üç DOG: {who} {blunder.past}. Dördüncü DOG için {sec} saniye bekleyin; sırada {who2} var.' },
  { id: 'd5', cat: 'dog', t: 'SON DAKİKA: {authority} açıkladı: {who} yine {blunder.past}. Açıklamanın tamamı: “DOG DOG DOG.”' },
  { id: 'd6', cat: 'dog', t: 'Takım arkadaşı: “{excuse}”\nReplay: {^blunder.past}.\nChat: DOG DOG DOG.' },
  { id: 'd7', cat: 'dog', t: 'Rakip {hero} tek başına {place.dat} daldı, beş kişiyi gördü, yine de geri dönmedi. Bizim chat: “DOG DOG DOG ama saygı duyuyoruz.”' },
  { id: 'd8', cat: 'dog', t: 'Bilim insanları uyardı: {blunder.inf} bulaşıcı değil. Ama aynı takıma düşerseniz DOG DOG DOG kaçınılmaz.' },

  // 1vDOQUZ
  { id: 'v1', cat: '1v9', t: '1vDOQUZ matematiği: 4 takım arkadaşı + 5 rakip = 9. Sonra {mate} {blunder.past} ve sayı 1vON oldu.' },
  { id: 'v2', cat: '1v9', t: '1vDOQUZ nedir? {min}. dakikada {item} bitirmiş bir {hero}, arkasında {blunder.part} dört takım arkadaşı, karşısında beş rakip. Kısaca: bir kişi, dokuz dert.' },
  { id: 'v3', cat: '1v9', t: '1vDOQUZ günlüğü, {minLate}. dakika: {item} tamam. Takım durumu: biri {blunder.past}, biri all chat’e “{chat}” yazıyor, ikisi haritada yok. Gerisi bende.' },
  { id: 'v4', cat: '1v9', t: '1vDOQUZ skor tablosu\nSen: {k}-{d}-{a}\nTakımın geri kalanı: {tk}-{td}-{ta}\nRakip chat: “{chat}”\nSonuç: bir kişi, dokuz dert, bir zafer.' },
  { id: 'v5', cat: '1v9', t: 'Bir gün bir {role} 1vDOQUZ atmaya karar vermiş. {min}. dakikada {item} almış, dönüp bakmış: takım {blunder.mis}. O maça bugün hâlâ 1vON denir.' },
  { id: 'v6', cat: '1v9', t: '{hero} ile 1vDOQUZ atmanın üç şartı: {item}, bol sabır ve {mate} ile aynı lane’e düşmemek.' },
  { id: 'v7', cat: '1v9', t: '1vDOQUZ’un evreleri: {min}. dakika “kazanırız”. {minLate}. dakika “neden gelmediniz”. Maç sonu: elde {item}, tek başına high ground. Takımın katkısı: “{chat}”.' },
  { id: 'v8', cat: '1v9', t: '{mate}: “{excuse}”\n1vDOQUZ atan carry: “Sorun değil.”\n(İçinden: DOG DOG DOG.)' },

  // 24 Saat Maraton
  { id: 'm1', cat: 'maraton', t: 'Yayının {hour}. saati. {^snack} bitti, {snack2} bitti, maç bitmedi. Bu arada {who} {blunder.past}.' },
  { id: 'm2', cat: 'maraton', t: 'Maraton izleyicisinin {hour}. saat notu: Uyumadım. Uyuyamam. Uyursam kaçırırım; daha az önce {who} {blunder.past}.' },
  { id: 'm3', cat: 'maraton', t: 'Yayında {hour}. saat: Chat {bigN} kez “DOG DOG DOG”, {bigN2} kez “1vDOQUZ”, bir kez de “uyku” yazdı. O mesaj hemen silindi.' },
  { id: 'm4', cat: 'maraton', t: 'Maratonun {hour}. saatinde uyku, pub maçındaki {unbought} gibidir: herkes ister, kimse almaz.' },
  { id: 'm5', cat: 'maraton', t: 'Kısa yayın: 24 saat. Orta yayın: {longHours} saat. Uzun yayın: izleyici {lifeEvent}, yayın hâlâ açık.' },
  { id: 'm6', cat: 'maraton', t: 'İzleyici: “Ben biraz uyuyup geleyim.”\n{sleep} saat sonra\nİzleyici: “Ne kaçırdım?”\nChat: {^who} {blunder.past}. Başka bir şey olmadı; yayın aynı yayın.' },
  { id: 'm7', cat: 'maraton', t: 'Yayının {hour}. saatinde zaman birimi değişir: 1 saat = {gph} maç = {teas} çay = sayısız DOG DOG DOG.' },
  { id: 'm8', cat: 'maraton', t: '24 saatlik yayını “kısa” bulan izleyici, {hour}. saatte: “Daha yeni ısınıyoruz.” Aynı izleyici, {hourLate}. saatte: “Tamam, şimdi ısındık.”' },

  // Pub Maç Hayatı
  { id: 'p1', cat: 'pub', t: 'Pub maçı klasiği: {min}. dakikada {who} all chat’e “{chat}” yazdı. {minLate}. dakikada ise {blunder.past}.' },
  { id: 'p2', cat: 'pub', t: 'Pub’da {hero} seçen biri varsa üç ihtimal vardır: 1vDOQUZ atacak, {blunder.inf} için gelmiş ya da ikisi birden.' },
  { id: 'p3', cat: 'pub', t: 'Pick ekranı\n{^mate}: “{hero} alıyorum.”\nTakım: “Neden?”\n{^mate}: “{pickReason}”\nChat: DOG DOG DOG.' },
  { id: 'p4', cat: 'pub', t: 'Pub maçında zorluk seviyeleri\nKolay: rakip.\nOrta: Roshan.\nZor: {mate}.\nİmkânsız: {blunder.part} birine ward aldırmak.' },
  { id: 'p5', cat: 'pub', t: 'Maç sonu raporu — {hero}\nLast hit: {lh}\nWard: 0\nÖlüm: {deaths}\nEn büyük katkı: {contrib}\nNot: DOG DOG DOG' },
  { id: 'p6', cat: 'pub', t: 'SON DAKİKA: {hero} oynayan bir oyuncu {min}. dakikada {item} aldı ve hemen ardından {blunder.past}. Uzmanlar: “1vDOQUZ’un tam tersi.”' },
  { id: 'p7', cat: 'pub', t: 'Bir gün bir {role} {item} almış. Herkes şaşırmış, rakipler bile pause atıp tebrik etmiş. Sonra {blunder.mis} ve dünya yeniden dengesini bulmuş.' },
  { id: 'p8', cat: 'pub', t: '“Geliyorum” yazan {mate}: {min}. dakikada yola çıktı, {minLate}. dakikada vardı. Varır varmaz da {blunder.past}.' },

  // Kahraman Özel
  { id: 'h1', cat: 'hero', t: '{hero} rehberi\nAdım 1: {item.acc} almak.\nAdım 2: {^blunder.inf}.\nAdım 3: Chat’teki DOG DOG DOG’ları saymak.' },
  { id: 'h2', cat: 'hero', t: '{hero} oynayan DOG nasıl anlaşılır? Maçın {minLate}. dakikasında hâlâ {item} yoktur ama bahanesi hazırdır: “{excuse}”' },
  { id: 'h3', cat: 'hero', t: 'Rakip Pudge hook attı, rakip Invoker on büyüyü sıraladı, rakip Techies mayın döşedi. Bizim {hero} ise {blunder.past}.' },
  { id: 'h4', cat: 'hero', t: '{hero} + {item} = ? Teoride {theory}. Pub’da: DOG DOG DOG.' },
  { id: 'h5', cat: 'hero', t: 'Yeni kahraman fikri: {hero} ile {hero2} karışımı. Pasif yeteneği: {blunder.inf}. Ultisi: DOG DOG DOG (global, iptal edilemez).' },
  { id: 'h6', cat: 'hero', t: '{hero.gen} en büyük düşmanı rakip değil; {blunder.part} kendi takım arkadaşıdır.' },
  { id: 'h7', cat: 'hero', t: '{hero} oyuncusunun maç planı: {min}. dakikada {item}, {minLate}. dakikada 1vDOQUZ. Gerçekleşen: {min}. dakikada {blunder.inf}, {minLate}. dakikada DOG DOG DOG.' },

  // Chat ve Takım
  { id: 'c1', cat: 'chat', t: 'All chat, {min}. dakika\n{^mate}: “{chat}”\nRakip: “{chat2}”\nMaçın geri kalanı: DOG DOG DOG.' },
  { id: 'c2', cat: 'chat', t: 'Pub sözlüğü — “{dict.msg}”: {dict.mean}' },
  { id: 'c3', cat: 'chat', t: 'Sesli sohbet, {min}. dakika\n— Smoke alalım mı?\n— {^mate} {blunder.past}.\n— Tamam, smoke iptal. DOG DOG DOG.' },
  { id: 'c4', cat: 'chat', t: '{mate} all chat’e “{chat}” yazdı. {sec} saniye sonra {blunder.past}. Chat’in cevabı çoktan hazırdı: DOG DOG DOG.' },
  { id: 'c5', cat: 'chat', t: 'Takım chat’inde {chatLen} mesajlık tartışma: “{chat}”, “{chat2}”, “{chat3}”… Bu sırada rakip Roshan’ı aldı.' },
  { id: 'c6', cat: 'chat', t: 'Pause diplomasisi: {mate} pause attı ve “{chat}” yazdı. Rakip unpause’a bastı ve “DOG DOG DOG” yazdı. Barış görüşmeleri sürüyor.' },

  // MMR ve Rütbe
  { id: 'r1', cat: 'mmr', t: '{rank.loc} {blunder.inf} “hata” sayılır. {rank2.loc} “bait”. Pub’da ise düpedüz DOG DOG DOG.' },
  { id: 'r2', cat: 'mmr', t: 'MMR grafiğim bu hafta −{mmrLoss} yaptı. Ne mi oldu? {^mate} {blunder.past}. Sonra bir daha. Sonra bir daha.' },
  { id: 'r3', cat: 'mmr', t: 'Rütbe madalyası: {rankLow}. Chat’teki özgüven: Immortal. Gerçek unvan: {dogRank}.' },
  { id: 'r4', cat: 'mmr', t: 'Smurf mu, DOG mu? Test: {min}. dakikada {item} bitirdiyse smurf. {min}. dakikada {blunder.past} ise DOG. İkisini birden yaptıysa: ters yönden 1vDOQUZ.' },
  { id: 'r5', cat: 'mmr', t: 'Maç kaybedildi (−{mmrGame} MMR). Suçlu arama komitesi toplandı. Karar: {mate}. Gerekçe: {^blunder.past}. Oylama: DOG DOG DOG (oy birliği).' },
  { id: 'r6', cat: 'mmr', t: '{rankLow} oyuncusu: “Ben aslında {rankHigh} seviyesindeyim.” Aynı oyuncu, {min}. dakikada: {^blunder.past}. Madalya haklıydı.' },
];

// ---------------------------------------------------------------- ayrıştırma
const SLOT_RE = /\{(\^?)([a-zA-Z]+?)(\d?)(?:\.([a-zA-Z]+))?\}/g;

const parsed = TEMPLATES.map((tpl) => {
  const slots = new Map(); // anahtar (havuz+idx) → { pool, idx }
  for (const m of tpl.t.matchAll(SLOT_RE)) {
    const [, , pool, idx] = m;
    if (!POOLS[pool]) throw new Error(`Bilinmeyen havuz: ${pool} (${tpl.id})`);
    const key = pool + (idx || '');
    if (!slots.has(key)) slots.set(key, { pool, idx: idx ? Number(idx) : 1 });
  }
  return { ...tpl, slots: [...slots.entries()] };
});

function poolSize(name) {
  const p = POOLS[name];
  return p.range ? p.size : p.length;
}

function comboOf(tpl) {
  const perPool = {};
  let total = 1;
  for (const [, s] of tpl.slots) {
    const used = perPool[s.pool] || 0;
    total *= Math.max(1, poolSize(s.pool) - used);
    perPool[s.pool] = used + 1;
  }
  return total;
}

export const ENGINE_CATEGORIES = [...new Set(TEMPLATES.map((t) => t.cat))];
export const TEMPLATE_COUNT = TEMPLATES.length;
export const POOL_SIZES = Object.fromEntries(Object.keys(POOLS).map((k) => [k, poolSize(k)]));

/** Motorun üretebileceği farklı espri sayısı (isteğe bağlı kategoriyle). */
export function countCombos(cat) {
  return parsed.filter((t) => !cat || t.cat === cat).reduce((s, t) => s + comboOf(t), 0);
}

// ---------------------------------------------------------------- üretim
function pickValue(poolName, rnd, exclude) {
  const p = POOLS[poolName];
  if (p.range) {
    for (let tries = 0; tries < 12; tries++) {
      const v = p.a + Math.floor(rnd() * p.size) * p.step;
      if (!exclude.has(v)) return v;
    }
    return p.a;
  }
  for (let tries = 0; tries < 24; tries++) {
    const v = p[Math.floor(rnd() * p.length)];
    if (!exclude.has(v)) return v;
  }
  return p.find((v) => !exclude.has(v)) || p[0];
}

function render(poolName, value, form) {
  const p = POOLS[poolName];
  if (p.range) return p.fmt ? nf.format(value) : String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (form && value[form] != null) return value[form];
  if (value.n != null) return value.n;
  if (value.past != null) return value.past;
  return String(Object.values(value)[0]);
}

function fill(tpl, rnd) {
  const chosen = {};
  const usedByPool = {};
  for (const [key, s] of tpl.slots) {
    const ex = usedByPool[s.pool] || (usedByPool[s.pool] = new Set());
    const v = pickValue(s.pool, rnd, ex);
    ex.add(v);
    chosen[key] = v;
  }
  let text = tpl.t.replace(SLOT_RE, (_, cap, pool, idx, form) => {
    const out = render(pool, chosen[pool + (idx || '')], form);
    return cap ? capTR(out) : out;
  });
  // Metnin ve her satırın ilk harfi büyük
  text = text.split('\n').map(capTR).join('\n');
  return text;
}

function normSeed(seed) {
  if (seed == null || !Number.isFinite(Number(seed))) return (Math.random() * 4294967296) >>> 0;
  return Number(seed) >>> 0;
}

/**
 * Tek espri üret. seed verilirse aynı seed (+ aynı kategori) hep aynı espriyi verir.
 * generate() · generate(42) · generate(42, { cat: 'dog' }) · generate({ cat: 'mmr' })
 * opts.avoid: bu şablon kimliği art arda gelmesin (ör. bir önceki üretimin tpl'i).
 */
export function generate(seed, opts = {}) {
  if (seed && typeof seed === 'object') { opts = seed; seed = opts.seed; }
  const s = normSeed(seed);
  const rnd = seeded(s);
  const list = opts.cat ? parsed.filter((t) => t.cat === opts.cat) : parsed;
  const pool = list.length ? list : parsed;
  let ti = Math.floor(rnd() * pool.length);
  // Aynı şablonun art arda gelmesini önle (deterministik kalır)
  if (opts.avoid && pool.length > 1 && pool[ti].id === opts.avoid) ti = (ti + 1 + Math.floor(rnd() * (pool.length - 1))) % pool.length;
  const tpl = pool[ti];
  return { id: 'gen-' + s.toString(36), cat: tpl.cat, text: fill(tpl, rnd), seed: s, tpl: tpl.id };
}

/** n adet (tekrarsız metinli) espri. opts.seed verilirse dizi deterministiktir. */
export function generateMany(n, opts = {}) {
  const out = [];
  const seen = new Set();
  const base = opts.seed != null ? normSeed(opts.seed) : normSeed();
  const rnd = seeded(base);
  let guard = 0;
  while (out.length < n && guard++ < n * 20) {
    const j = generate((rnd() * 4294967296) >>> 0, { cat: opts.cat });
    if (seen.has(j.text)) continue;
    seen.add(j.text);
    out.push(j);
  }
  return out;
}
