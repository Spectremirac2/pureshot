// 3D Müze eser meta verileri (three.js içermez; galeri, katalog ve "Nasıl yapıldı?" sayfası da kullanır).
// Üç salon: Salon I · Efsaneler (sitenin ilk üç eseri), Salon II · Arena (1vDOQUZ Arena kadrosu) ve
// Salon III · Dokuzun Laneti (Arena'nın hikâye modunun kahramanları, kampları ve boss'ları).
// Alanlar:
//   key      fal GLB anahtarı (src/assets/fal/<key>.glb)     id     prosedürel yedeğin kimliği (exhibits.js)
//   no       Roma rakamıyla genel eser numarası               wing   salon kimliği (WINGS)
//   height   kaide üstündeki yükseklik (birim)                 yaw    modeli kameraya çevirmek için y dönüşü (radyan)
//   pitch    DOG! havlamasının perdesi                         arena  true → plakette "Arena’da gör" bağlantısı,
//                                                              'soon' → "yakında hikâye modunda" rozeti (+ Arena'ya git)
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
  {
    id: 'lanet',
    no: 'III',
    name: 'Dokuzun Laneti',
    label: 'Salon III · Dokuzun Laneti',
    lore: 'Arena’nın hikâye modu: bitmeyen bir pub maçı, ruhları DOG’a dönen oyuncular ve laneti kıracak tek bir 1vDOQUZ. Anlatıcı: Kurye.',
  },
];

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
    height: 1.9,
    yaw: 0,
    pitch: 0.9,
    arena: true,
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
    height: 1.85,
    yaw: 0,
    pitch: 0.8,
    arena: true,
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
    desc:
      'Kanatlı, heybeli, sabrı taştan bir eşek. Arena’da eşyaları taşır, arada bir yanlış kahramana götürür. Heybede ne olduğunu sorma; büyük ihtimalle birinin unuttuğu Tango.',
    fallbackArt: 'portrait-kurye',
    fallbackArch: 'kurye',
  },

  // ------------------------------------------------------------------ Salon III · Dokuzun Laneti
  {
    key: 'model-hero-storm',
    id: 'storm',
    no: 'XIII',
    wing: 'lanet',
    name: 'Şimşek Ruhu',
    kicker: 'Hikâye modu · IV. bölüm ödülü',
    icon: 'bolt',
    height: 1.55,
    yaw: 0,
    pitch: 1.35,
    arena: true,
    desc:
      'Mavi tenli, saçları kıvılcım saçan şimşek büyücüsü; atkısı ve minik bıyığıyla fazla ciddi görünmemeye çalışıyor. Haritanın bir ucundan öbürüne göz açıp kapayana kadar varıyor, sonra “Ben mi yaptım?” diye soruyor. IV. bölümün sonunda laneti kıranlara katılıyor.',
  },
  {
    key: 'model-hero-treant',
    id: 'treant',
    no: 'XIV',
    wing: 'lanet',
    name: 'Ağaç Bekçisi',
    kicker: 'Hikâye modu · II. bölüm ödülü',
    icon: 'treant',
    height: 1.55,
    yaw: 0,
    pitch: 0.62,
    arena: true,
    desc:
      'Fıçı gövdeli yaşlı bir ağaç: yosun sakal, sonbahar yapraklarından taç, omuzlarda mantarlar, göğsünde yanan bir fener ve kabuktan kalkan. Müzenin en ağır eseri; acelesi yok, zaten yüz yıldır aynı koridoru bekliyor.',
  },
  {
    key: 'model-neutral-wolf',
    id: 'wolf',
    no: 'XV',
    wing: 'lanet',
    name: 'Orman Kurdu',
    kicker: 'Hikâye modu · tarafsız kamp',
    icon: 'wolf',
    height: 1.15,
    yaw: 0,
    pitch: 0.95,
    arena: true,
    desc:
      'Koyu gri-mavi postlu, kemik kolyeli, sarı gözleri karanlıkta parlayan orman kurdu. Kurye’nin anlattığına göre o da bir zamanlar pub maçındaki oyunculardanmış; DOG olmasına bir adım kala ormana kaçmış. Kampını farm’layana hâlâ aynı bakışı atıyor: “Yine mi sen?”',
  },
  {
    key: 'model-neutral-harpy',
    id: 'harpy',
    no: 'XVI',
    wing: 'lanet',
    name: 'Harpi',
    kicker: 'Hikâye modu · tarafsız kamp',
    icon: 'harpy',
    height: 1.35,
    yaw: 0,
    pitch: 1.5,
    arena: true,
    desc:
      'Turkuaz ve mor tüylü, pençeli, kanatlı kuş-kadın. Kampına yaklaşanı önce tepeden süzer, sonra bütün sürüyle dalar. Hikâye modunda farm’ın bedava olmadığını ilk o öğretiyor.',
  },
  {
    key: 'model-boss-general',
    id: 'general',
    no: 'XVII',
    wing: 'lanet',
    name: 'Dire Generali',
    kicker: 'Hikâye modu · III. bölüm boss’u',
    icon: 'greatsword',
    height: 1.6,
    yaw: 0,
    pitch: 0.6,
    arena: true,
    desc:
      'Kara-kızıl dikenli zırhıyla goblin-ork komutan ve boyundan büyük tırtıklı kılıcı. Dokuzun Laneti’nin üçüncü bölümünde dokuz DOG’un başında o duruyor. Emirleri kısa: “Dalın.” Tanıdık geldiyse Salon II’deki Balta’ya selam söyle.',
  },
  {
    key: 'model-boss-ancient',
    id: 'ancient',
    no: 'XVIII',
    wing: 'lanet',
    name: 'Sonsuz Pub’ın Kalbi',
    kicker: 'Hikâye modu · final boss’u',
    icon: 'ancient',
    height: 1.6,
    yaw: 0,
    pitch: 0.45,
    arena: true,
    desc:
      'Kökleri yere işlemiş, boynuzlu obsidyen bir anıt; ortasında kızıl bir kalp kristali atıyor. Hiç bitmeyen pub maçının laneti buradan yayılıyor, ruhları DOG’a çeviren de bu kalp. 1vDOQUZ’un son durağı: kalp kırılınca maç biter, herkes insan olarak evine döner.',
  },
];

/** Salonun eserleri (genel sıraya göre). */
export const wingExhibits = (wingId) => EXHIBITS.filter((e) => e.wing === wingId);

/** Salon kaydı. */
export const wingOf = (ex) => WINGS.find((w) => w.id === ex.wing) || WINGS[0];

/** Adlardaki İngilizce özel adlar: Türkçe büyük harf kuralı "DİRE", "AEGİS" yapmasın. */
export const EN_WORD = /^(Dire|Radiant|Aegis|Pub)(.*)$/;

/** Kaide plakası gibi canvas metinleri için büyük harf: Türkçe kelimeler tr, İngilizce özel adlar en kuralıyla. */
export const upperName = (name) =>
  name.split(' ').map((w) => {
    const m = w.match(EN_WORD);
    return m ? m[1].toUpperCase() + m[2].toLocaleUpperCase('tr-TR') : w.toLocaleUpperCase('tr-TR');
  }).join(' ');

/** Toplam eser sayısının Roma rakamı (sayaç için: "Eser IV / XVIII"). */
export const TOTAL_NO = EXHIBITS[EXHIBITS.length - 1].no;
