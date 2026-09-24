// DOG Arşivi — pub maçlarında rastlanan köpek türleri (hayran yapımı mizah).
// Quizler, karakter analizleri, oyunlar ve galeri bu tek kaynaktan beslenir.
//
// stats: 0–100 arası "DOG-metre" değerleri
//   feed    ölüm sıklığı
//   farm    takımı unutup farm yapma eğilimi
//   tilt    sinir katsayısı
//   chat    all chat'te roman yazma kapasitesi
//   harita  harita farkındalığı (yüksek = iyi)
//   takim   takım oyunu (yüksek = iyi)
// dogLevel: 1–5 pati (5 = saf DOG)

export const ARCHETYPES = [
  {
    id: 'farm',
    name: 'Farm Köpeği',
    title: 'Ormanın Sessiz Muhasebecisi',
    color: '#43d6a0',
    icon: 'coin',
    tagline: 'Takım 4v5 savaşırken o 5. kampı stack’liyor.',
    description:
      '40. dakikada hâlâ ormanda. Takım arkadaşları üsse çekilirken o "bir kamp daha" diyor. Net worth grafiğinde zirvede, savaş katılım oranında dipte. Sonunda altı slot doluyor ama oyun çoktan bitmiş oluyor.',
    habitat: 'Radiant ormanı, üçlü kamp civarı',
    signature: 'Savaş başlarken ışınlanıp ters yöne gitmek',
    spotting: ['Mini haritada hep aynı köşede', 'Savaş bitince "ne oldu?" yazar', 'Battle Fury 11. dakikada, TP hiç yok'],
    counter: 'Ormanına ward koy, ama merak etme: yine de gelmez.',
    chatQuote: '"3 dk daha farm, sonra geliyorum" (oyun 58. dakikada bitti)',
    heroes: ['Anti-Mage', 'Alchemist', 'Naga Siren', 'Medusa'],
    stats: { feed: 20, farm: 100, tilt: 35, chat: 30, harita: 15, takim: 10 },
    dogLevel: 4,
  },
  {
    id: 'feed',
    name: 'Feed Köpeği',
    title: 'Çeşme ile Kule Arası Mekik',
    color: '#e0354b',
    icon: 'skull',
    tagline: 'KDA’sı telefon numarası gibi: 0-14-1.',
    description:
      'Her savaşa ilk giren, her savaştan ilk çıkan. Yalnız başına Dire tier 3’e dalıp "neden gelmediniz" diye soruyor. Buyback kavramını bilmiyor, zaten gerek de kalmıyor: altın hep sıfır.',
    habitat: 'Düşman kulesinin tam altı',
    signature: 'Tek başına 5 kişiye “initiate”',
    spotting: ['Ölüm sayacı dakikadan hızlı artıyor', 'Smoke yok, ward yok, korku yok', '"gg ez" yazma cesareti'],
    counter: 'Onu çeşmede tutacak bir sebep bul. Bulamayacaksın.',
    chatQuote: '"benim suçum değil lag var"',
    heroes: ['Pudge', 'Bloodseeker', 'Huskar', 'Riki'],
    stats: { feed: 100, farm: 15, tilt: 70, chat: 55, harita: 5, takim: 25 },
    dogLevel: 5,
  },
  {
    id: 'pause',
    name: 'Pause Köpeği',
    title: 'Zamanın Efendisi',
    color: '#8b7cff',
    icon: 'pause',
    tagline: 'Her takım savaşının ortasında “1 dk su içicem”.',
    description:
      'Oyun onun için bir dizi bölümü gibi: istediği an durduruluyor. Rakip kombo yaparken pause, takım kazanırken pause, kuryesi gelmediğinde pause. Pause hakkı bitince unpause’a da itiraz ediyor.',
    habitat: 'Pause menüsü',
    signature: 'Rakip 3 saniyelik stun’ı atarken dünyayı dondurmak',
    spotting: ['"p" tuşu parlıyor', '“bi dk kapı çaldı”', 'Unpause sayacına sinirlenir'],
    counter: 'Unpause’a bas ve dua et.',
    chatQuote: '"p p p p acil"',
    heroes: ['Invoker', 'Meepo', 'Arc Warden'],
    stats: { feed: 40, farm: 50, tilt: 60, chat: 75, harita: 40, takim: 30 },
    dogLevel: 3,
  },
  {
    id: 'afk',
    name: 'AFK Köpeği',
    title: 'Çeşmenin Uyuyan Bekçisi',
    color: '#5fb9c9',
    icon: 'hourglass',
    tagline: 'Maç 45 dakika sürdü, o 38 dakika mola verdi.',
    description:
      'Pick’i yapıyor, courier’i gönderiyor ve efsanevi bir sessizliğe gömülüyor. Arada bir hareket ediyor ki sistem atmasın. Maç sonunda "gg wp" yazmayı ise hiç unutmuyor.',
    habitat: 'Çeşmenin kenarı',
    signature: 'Pozisyonunu 20 dakika koruyabilmek',
    spotting: ['Karakteri hiç kıpırdamıyor', 'Seviye 3’te, dakika 30', 'Mikrofon ışığı kapalı'],
    counter: 'Onu pinglemek işe yaramaz. Kapı zili belki.',
    chatQuote: '"geldim geldim ne oldu"',
    heroes: ['Zeus', 'Silencer', "Nature's Prophet"],
    stats: { feed: 30, farm: 5, tilt: 10, chat: 15, harita: 0, takim: 5 },
    dogLevel: 4,
  },
  {
    id: 'kurye',
    name: 'Kurye Köpeği',
    title: 'Eşekli Postacı Rehinecisi',
    color: '#e9b949',
    icon: 'bolt',
    tagline: 'Kuryeyi 6 kez bottle doldurmaya yolluyor.',
    description:
      'Takımın tek kuryesi onun özel şoförü. Senin Blink’in dükkânda beklerken o üçüncü Salve’ını taşıtıyor. Kurye ölünce suçu mid’e atıyor, mid ölünce suçu kuryeye.',
    habitat: 'Gizli dükkân ile koridor arası',
    signature: 'Kuryeyi rakip kulenin üstünden geçirmek',
    spotting: ['Kurye hep onun renginde', '"kurye kimde?" sorusu cevapsız', 'Envanterinde 4 Tango'],
    counter: 'Eşyalarını kendi yürüyerek al. Güvenli ve sağlıklı.',
    chatQuote: '"kuryeyi kim öldürdü yaa" (kendisi)',
    heroes: ['Bristleback', 'Troll Warlord', 'Kunkka'],
    stats: { feed: 45, farm: 60, tilt: 50, chat: 60, harita: 30, takim: 15 },
    dogLevel: 3,
  },
  {
    id: 'rapier',
    name: 'Rapier Köpeği',
    title: 'Kılıcını Düşüren Şövalye',
    color: '#f6d98a',
    icon: 'sword',
    tagline: '20. dakikada Rapier, 21. dakikada rakibin elinde.',
    description:
      'Tüm altınını tek bir parlak kılıca yatırıyor ve onu ilk savaşta yere bırakıyor. Rakip taşıyıcı Rapier’i alıp oyunu bitirirken o "kumar hayattır" felsefesini savunuyor.',
    habitat: 'Gizli dükkânın önü, kısa bir süre',
    signature: 'Tek başına Roshan çukuruna Rapier ile girmek',
    spotting: ['Net worth bir anda yarıya iniyor', 'Chat’te "ya tutarsa"', 'Buyback parası yok'],
    counter: 'Rapier düştüğünde kapmak için yakında dur.',
    chatQuote: '"high risk high reward kardeşim"',
    heroes: ['Gyrocopter', 'Sniper', 'Troll Warlord'],
    stats: { feed: 75, farm: 70, tilt: 55, chat: 45, harita: 25, takim: 20 },
    dogLevel: 4,
  },
  {
    id: 'mid',
    name: 'Mid ya da Feed Köpeği',
    title: 'Köprünün Tek Sahibi',
    color: '#ff9a3d',
    icon: 'shield',
    tagline: 'Mid verilmezse oyun onun için 0. dakikada biter.',
    description:
      'Pick ekranında "mid or feed" yazan, sonra söz verdiğini fazlasıyla yerine getiren oyuncu. Mid alırsa ilk 10 dakika efsane, sonra kayboluyor. Alamazsa tüm maç boyunca mid’e laf atıyor.',
    habitat: 'Nehir üstündeki köprü',
    signature: 'Rune’u almak için 3 koridoru terk etmek',
    spotting: ['İlk mesajı "mid"', 'Bottle’ı bırakmıyor', 'Rotasyon kelimesini bilmiyor'],
    counter: 'Mid’i ver. Yine de bir şey olacak ama en azından sen suçlu olmayacaksın.',
    chatQuote: '"mid or feed, son söz"',
    heroes: ['Invoker', 'Pudge', 'Storm Spirit'],
    stats: { feed: 70, farm: 55, tilt: 90, chat: 80, harita: 35, takim: 15 },
    dogLevel: 4,
  },
  {
    id: 'ward',
    name: 'Ward’sız Destek Köpeği',
    title: 'Karanlığın Muhasebecisi',
    color: '#c46bff',
    icon: 'ward',
    tagline: 'Support seçti, Midas aldı, ward almadı.',
    description:
      'Destek rolünü seçiyor ama destek tanımını kendine göre yapıyor. Harita zifiri karanlıkken onun envanterinde Midas, Aghanim’s ve bir hayal var. Sentry mi? Onu başkası alır.',
    habitat: 'Taşıyıcının koridorundaki creep’lerin arası',
    signature: 'Carry’nin son vuruşunu çalmak',
    spotting: ['Ward sayısı: 0', 'Net worth carry’den yüksek', '"ward sende" diye pinglenmiş'],
    counter: 'Ward’ı kendin al. Sonra onun Midas’ına bakıp iç çek.',
    chatQuote: '"ben core oynarım aslında"',
    heroes: ['Crystal Maiden', 'Lion', 'Witch Doctor'],
    stats: { feed: 55, farm: 80, tilt: 40, chat: 40, harita: 10, takim: 20 },
    dogLevel: 4,
  },
  {
    id: 'smurf',
    name: 'Smurf Köpeği',
    title: 'Sahte Bıyıklı Efsane',
    color: '#53d8fb',
    icon: 'crown',
    tagline: '“Ana hesabım 8k” diyor, üç buyback’i unutuyor.',
    description:
      'Takma bıyık ve yuvarlak gözlükle aramıza karışmış bir "efsane". İlk ölümde gerçek MMR’ını açıklıyor, ikinci ölümde takımın MMR’ını eleştiriyor. Tek istediği: izleyicilerin önünde parlamak.',
    habitat: 'Yanlış rütbe',
    signature: 'Kendi kombosunu yanlış sırayla yapmak',
    spotting: ['Profil gizli', '"normalde bu heroyu oynamam"', 'Replay isteyince kayboluyor'],
    counter: 'Ona sadece "tamam abi" de. Gerisini oyun halleder.',
    chatQuote: '"ana hesabımda olsam şimdi biterdi"',
    heroes: ['Meepo', 'Arc Warden', 'Invoker'],
    stats: { feed: 50, farm: 60, tilt: 80, chat: 85, harita: 45, takim: 20 },
    dogLevel: 3,
  },
  {
    id: 'chat',
    name: 'Chat Köpeği',
    title: 'All Chat’in Romancısı',
    color: '#ff6a2b',
    icon: 'chat',
    tagline: 'Oynadığından çok yazıyor, yazdığından çok ölüyor.',
    description:
      'Klavyesi oyun için değil, edebiyat için. Her ölümde bir paragraf, her kaybedilen savaşta bir destan. "report mid" onun imzası. Oyun bittiğinde bile yazmaya devam ediyor.',
    habitat: 'All chat',
    signature: 'Savaşın ortasında yazı yazmak',
    spotting: ['Mesaj sayısı > son vuruş sayısı', 'Büyük harf tuşu sıkışık', '"izleyin beni" diye başlayan cümleler'],
    counter: 'Mute butonu Dota’nın en güçlü eşyası.',
    chatQuote: '"REPORT MID. REPORT KURYE. REPORT HAYAT."',
    heroes: ['Huskar', 'Slark', 'Phantom Assassin'],
    stats: { feed: 60, farm: 40, tilt: 100, chat: 100, harita: 30, takim: 5 },
    dogLevel: 5,
  },
];

/** DOG olmayan tek sonuç: 9 köpeği sırtında taşıyan efsane. */
export const LEGEND = {
  id: 'legend',
  name: '1vDOQUZ Efsanesi',
  title: 'Dokuz Köpeğe Karşı Tek Kahraman',
  color: '#e9b949',
  icon: 'bow',
  tagline: 'Dört takım arkadaşı ve beş rakip: toplam dokuz DOG. Sen tek başınasın.',
  description:
    '1v9 dediğin, 4 takım arkadaşı ile 5 rakibin toplamı. Bu oyuncu hepsini aynı anda taşıyor: ward alıyor, stack yapıyor, savaşı başlatıyor, sonra da "DOG DOG DOG" diye özetliyor. Nadir bulunur, maratonlarda yetişir.',
  habitat: 'Maç sonu skor tablosunun en üstü',
  signature: 'Takım silinmişken tek başına 3 kişilik kombo',
  spotting: ['Ward, smoke ve TP aynı envanterde', 'Maç 24. saate girse de hâlâ odaklı', 'Takıma "DOG" deme hakkını sonuna kadar kullanıyor'],
  counter: 'Onu durdurmanın yolu yok. Takımını bırak, o yeter.',
  chatQuote: '"1vDOQUZ. Yine."',
  heroes: ['Windranger', 'Drow Ranger', 'Mirana'],
  stats: { feed: 5, farm: 70, tilt: 45, chat: 50, harita: 100, takim: 100 },
  dogLevel: 0,
};

export const ALL_TYPES = [...ARCHETYPES, LEGEND];

export const STAT_LABELS = {
  feed: 'Feed',
  farm: 'Farm hırsı',
  tilt: 'Tilt',
  chat: 'Chat',
  harita: 'Harita',
  takim: 'Takım oyunu',
};

export const byId = (id) => ALL_TYPES.find((a) => a.id === id) || null;
