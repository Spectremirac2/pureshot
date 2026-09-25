// 3D Müze eser meta verileri (three.js içermez; galeri, katalog ve "Nasıl yapıldı?" sayfası da kullanır).
// İki salon: Salon I · Efsaneler (sitenin ilk üç eseri) ve Salon II · Arena (1vDOQUZ Arena kadrosu).
// Alanlar:
//   key      fal GLB anahtarı (src/assets/fal/<key>.glb)     id     prosedürel yedeğin kimliği (exhibits.js)
//   no       Roma rakamıyla genel eser numarası               wing   salon kimliği (WINGS)
//   height   kaide üstündeki yükseklik (birim)                 yaw    modeli kameraya çevirmek için y dönüşü (radyan)
//   pitch    DOG! havlamasının perdesi                         arena  true → plakette "Arena’da gör" bağlantısı
//   fallbackArt / fallbackArch   WebGL yoksa 2D önizleme görseli (yoksa ikonlu kart çizilir)
// Eserler Dota arketiplerinden esinlenen özgün tasarımlardır; hiçbirine Valve kahraman adı verilmez.

export const WINGS = [
  {
    id: 'efsane',
    no: 'I',
    name: 'Efsaneler',
    label: 'Salon I · Efsaneler',
    lore: 'Sitenin ilk üç eseri: maskot, kahraman ve kupa.',
  },
  {
    id: 'arena',
    no: 'II',
    name: 'Arena',
    label: 'Salon II · Arena',
    lore: '1vDOQUZ Arena’nın kadrosu: kahramanlar, creep’ler, boss, kuleler ve kurye.',
  },
];

const MAT_ARENA = 'fal.ai Trellis 2 · kaynak görsel Nano Banana 2';

export const EXHIBITS = [
  // ------------------------------------------------------------------ Salon I · Efsaneler
  {
    key: 'model-dog',
    id: 'dog',
    no: 'I',
    wing: 'efsane',
    name: 'DOG Maskotu',
    kicker: 'Sitenin maskotu',
    icon: 'paw',
    height: 1.5,
    yaw: 0,
    pitch: 1.0,
    desc:
      'Boynuzlu bronz miğferi, kırmızı fuları ve içi Tango dolu heybesiyle sitenin maskotu. Dört ayak üstünde durmasının sebebi basit: TP’si hiç yok, haritanın her yerine yürüyerek gidiyor.',
    fallbackArt: 'poster-dogdogdog',
    fallbackArch: 'farm',
  },
  {
    key: 'model-archer',
    id: 'archer',
    no: 'II',
    wing: 'efsane',
    name: 'Okçu Kahraman',
    kicker: '1vDOQUZ efsanesi',
    icon: 'bow',
    height: 1.55,
    yaw: 0,
    pitch: 1.3,
    desc:
      'Kapüşonunu 1vDOQUZ gecelerinde hiç indirmeyen chibi okçu. Dokuz DOG’a karşı tek başına; sadağı hiç boşalmıyor, çünkü her DOG’a ayrı bir ok gerekiyor.',
    fallbackArt: 'portrait-legend',
    fallbackArch: 'legend',
  },
  {
    key: 'model-aegis',
    id: 'aegis',
    no: 'III',
    wing: 'efsane',
    name: 'Aegis Kupası',
    kicker: 'Tek kullanımlık ölümsüzlük',
    icon: 'trophy',
    height: 1.5,
    yaw: 0,
    pitch: 0.78,
    desc:
      'Tek kullanımlık ölümsüzlük, sınırsız karizma. Kanatlı altın kalkan Roshan çukurundan “ödünç” alındı; iade tarihi belli değil, gecikme cezası DOG olarak ödeniyor.',
    fallbackArt: 'poster-1vdoquz',
    fallbackArch: 'rapier',
  },

  // ------------------------------------------------------------------ Salon II · Arena
  {
    key: 'model-hero-brute',
    id: 'brute',
    no: 'IV',
    wing: 'arena',
    name: 'Balta',
    kicker: 'Arena kahramanı · yakın dövüş',
    icon: 'axe',
    height: 1.5,
    yaw: 0,
    pitch: 0.72,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Kırmızı derili, boynuzlu miğferli ork savaşçısı; çift ağızlı baltası kendisinden büyük. Arena’da takım savaşına ilk o dalar. Planı tek kelime: “Dal.” İkinci kelimeyi hâlâ düşünüyor.',
  },
  {
    key: 'model-hero-frost',
    id: 'frost',
    no: 'V',
    wing: 'arena',
    name: 'Buz Cadısı',
    kicker: 'Arena kahramanı · büyücü',
    icon: 'frost',
    height: 1.55,
    yaw: 0,
    pitch: 1.4,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Kapüşonlu buz büyücüsü; asasının ucundaki kristal hiç erimiyor. Arena’da uzaktan yavaşlatır, dondurur, sonra çayını sakince yudumlar. Takım savaşında paniğe kapılmamanın sırrı: soğukkanlılık, kelimenin tam anlamıyla.',
  },
  {
    key: 'model-hero-shadow',
    id: 'shadow',
    no: 'VI',
    wing: 'arena',
    name: 'Gölge',
    kicker: 'Arena kahramanı · suikastçı',
    icon: 'daggers',
    height: 1.5,
    yaw: 0,
    pitch: 1.15,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Mor kapüşonlu gölge suikastçı ve iki parlayan hançeri. Arena’da arkadan yaklaşır, iki vuruşta işini bitirir, sonra yine ortadan kaybolur. Haritada göremiyorsan büyük ihtimalle tam arkandadır.',
  },
  {
    key: 'model-creep-melee',
    id: 'creep-melee',
    no: 'VII',
    wing: 'arena',
    name: 'Dire Piyadesi',
    kicker: 'Arena creep’i · yakın dövüş',
    icon: 'club',
    height: 1.3,
    yaw: 0,
    pitch: 1.05,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Çivili sopası ve kafatası kalkanıyla koridorun emektarı goblin. Dalga dalga gelir, son vuruşun kimde kaldığını hiç dert etmez. Maaşı yok, izni yok, motivasyonu hep tam.',
  },
  {
    key: 'model-creep-ranged',
    id: 'creep-ranged',
    no: 'VIII',
    wing: 'arena',
    name: 'Dire Büyücüsü',
    kicker: 'Arena creep’i · menzilli',
    icon: 'staff',
    height: 1.35,
    yaw: 0,
    pitch: 1.25,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Kırmızı cübbeli goblin büyücü; asasındaki kızıl küre her atışta biraz daha parlıyor. Piyadelerin arkasına saklanıp uzaktan dürtüyor. Arena dersi bir: önce onu kes, sonra tartış.',
  },
  {
    key: 'model-roshan',
    id: 'roshan',
    no: 'IX',
    wing: 'arena',
    name: 'Kaya Canavarı',
    kicker: 'Arena boss’u',
    icon: 'beast',
    height: 1.4,
    yaw: 0,
    pitch: 0.55,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Taştan yontulmuş, boynuzlu, iri yarı bir canavar. Çukurunda uyur; uyandırılmaktan hiç hoşlanmaz. Çukuru bilenler ona başka bir adla sesleniyor ama burada yüksek sesle söylemeyelim, uyanmasın. Salon I’deki kupanın nereden “ödünç” alındığını da o biliyor.',
  },
  {
    key: 'model-tower-radiant',
    id: 'tower-radiant',
    no: 'X',
    wing: 'arena',
    name: 'Radiant Kulesi',
    kicker: 'Arena yapısı · Radiant',
    icon: 'tower',
    height: 1.7,
    yaw: 0,
    pitch: 0.9,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Beyaz taş, altın süsler, tepesinde yeşil kristal. Arena’da koridoru korur; menziline dalan kahramanlara kristalinden kısa bir ders verir. Sloganı kapısında yazılı: “Kule altına girme.”',
  },
  {
    key: 'model-tower-dire',
    id: 'tower-dire',
    no: 'XI',
    wing: 'arena',
    name: 'Dire Kulesi',
    kicker: 'Arena yapısı · Dire',
    icon: 'towerDire',
    height: 1.7,
    yaw: 0,
    pitch: 0.8,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Kara taş, sivri dikenler, kızıl kristal. Karşıdaki kuzeni kadar kibar değil; ilk uyarıyla son uyarıyı aynı anda yapar. 1vDOQUZ gecelerinin en uzun “kule altı” DOG listesi bu dikenlerin dibinde yazıldı.',
  },
  {
    key: 'model-courier',
    id: 'courier',
    no: 'XII',
    wing: 'arena',
    name: 'Kurye',
    kicker: 'Arena yardımcısı · kurye',
    icon: 'courier',
    height: 1.3,
    yaw: 0,
    pitch: 1.3,
    arena: true,
    material: MAT_ARENA,
    desc:
      'Kanatlı, heybeli, sabrı taştan bir eşek. Arena’da eşyaları taşır, arada bir yanlış kahramana götürür. Heybede ne olduğunu sorma; büyük ihtimalle birinin unuttuğu Tango.',
    fallbackArt: 'portrait-kurye',
    fallbackArch: 'kurye',
  },
];

/** Salonun eserleri (genel sıraya göre). */
export const wingExhibits = (wingId) => EXHIBITS.filter((e) => e.wing === wingId);

/** Salon kaydı. */
export const wingOf = (ex) => WINGS.find((w) => w.id === ex.wing) || WINGS[0];

/** Toplam eser sayısının Roma rakamı (sayaç için: "Eser IV / XII"). */
export const TOTAL_NO = EXHIBITS[EXHIBITS.length - 1].no;
