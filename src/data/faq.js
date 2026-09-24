// SSS — Sık sorulan sorular (Soru-Cevap bölümü, #soru-cevap--sss).
// Her madde bir Dota eşya açıklaması gibi sunulur: ikon slotu, ad, kategori etiketi, açıklama ve "lore" satırı.
//
// Paragraf biçimi (HTML YOK; bölüm h() ile güvenli basar):
//   'düz metin'
//   ['metin ', { a: 'https://…', t: 'bağlantı metni' }, ' devamı ', { k: 'Q' }, ' ', { b: 'kalın' }]
//   { shortcuts: true }   → kısayol tuşları tablosu (routes.js'ten üretilir)
//
// tone: ember | gold | jade | arcane | blood (kategori rengi)

export const FAQ = [
  {
    id: 'dogdogdog',
    icon: 'paw',
    tag: 'Meme',
    tone: 'ember',
    q: '“DOG DOG DOG” nedir, ne zaman söylenir?',
    a: [
      'Yayının imza lafı. Takım arkadaşı, rakip ya da herhangi biri kötü oynadığında veya oyunu trollediğinde söylenir. Ward’sız ormana dalan, Aegis’i unutan, 40. dakikada hâlâ “bir kamp daha” diyen… hepsi bu hükmü hak eder.',
      ['Oyunbaz bir laftır; hakaret değil, mizahi bir teşhis. Bu sitede de öyle kullanıyoruz: ', { b: 'kişilere değil, hamlelere' }, ' DOG deriz.'],
    ],
    lore: 'Üç kez söylenir, çünkü bir kez yetmez.',
  },
  {
    id: '1vdoquz',
    icon: 'swords',
    tag: 'Meme',
    tone: 'ember',
    q: '1vDOQUZ ne demek?',
    a: [
      ['“1v9”, yani bire dokuz esprisi: oyunu tek başına taşımak. Kendi ', { b: '4 takım arkadaşın' }, ' + ', { b: '5 rakip' }, ' = dokuz kişiye karşı tek bir oyuncu.'],
      ['“Dokuz” kelimesi Q harfiyle stilize edilir: DOQUZ. Sitedeki ', { a: '#arena', t: '1vDOQUZ Arena' }, ' (kısayol ', { k: 'R' }, ') bu fikirden doğdu.'],
    ],
    lore: 'Q harfi, dokuzun en sert hâli.',
  },
  {
    id: 'maraton',
    icon: 'hourglass',
    tag: 'Yayın',
    tone: 'gold',
    q: '24 saatlik maraton ne demek?',
    a: [
      ['Yayınlar uzun sürer; öyle ki ', { b: 'en kısa yayın bile 24 saat' }, ' sürüyor. Hayranların bağlılığı da buradan gelir: yayın bitmez, sohbet de bitmez.'],
      'Üst çubuktaki “Maraton” sayacı yayının süresi değildir; bu sekmede geçirdiğin süreyi sayan küçük bir şakadır.',
    ],
    lore: 'Güneş doğar, güneş batar, yayın devam eder.',
  },
  {
    id: 'resmi',
    icon: 'info',
    tag: 'Site',
    tone: 'arcane',
    q: 'Bu site resmi mi?',
    a: [
      ['Hayır. Burası CureShotKick hayranlarının eğlence için yaptığı ', { b: 'resmi olmayan bir hayran sitesi' }, '; yayıncıyla resmi bir bağlantısı yoktur.'],
      'Buradaki espriler, analizler ve kehanetler hayran yapımı mizahtır; yayıncıya ait bilgi ya da alıntı değildir. Dota 2, Valve Corporation’ın ticari markasıdır.',
    ],
    lore: 'Sevgiyle, ward’larla ve bolca DOG ile yapıldı.',
  },
  {
    id: 'izle',
    icon: 'kick',
    tag: 'Yayın',
    tone: 'jade',
    q: 'Yayını nerede izlerim?',
    a: [
      ['Kick’te: ', { a: 'https://kick.com/cureshotkick', t: 'kick.com/cureshotkick', ext: true }, '. Geniş ekranlarda üst çubuktaki yeşil “Kick” rozeti de aynı yere gider.'],
      'Maraton yayınlarda su içmeyi, bir şeyler yemeyi ve ara sıra uyumayı unutma.',
    ],
  },
  {
    id: 'espri',
    icon: 'laugh',
    tag: 'Topluluk',
    tone: 'ember',
    q: 'Kendi esprimi nasıl eklerim?',
    a: [
      [{ a: '#espriler', t: 'Espri Duvarı' }, '’na git (kısayol ', { k: 'Q' }, '), formu doldur ve gönder. Diğer hayranlar esprini DOG’layarak (beğenerek) yukarı taşır.'],
      'Kısa, zekice ve saygılı olsun. En iyi espriler bir kişiyi değil, bir hamleyi hedef alır.',
    ],
  },
  {
    id: 'veri',
    icon: 'shield',
    tag: 'Site',
    tone: 'arcane',
    q: 'Yorumlar, sorular ve esprilerim nerede saklanıyor?',
    a: [
      ['Topluluk sürümünde ', { b: 'ortak topluluk veritabanında' }, ' saklanır; sayfayı açan herkes aynı içeriği görür.'],
      ['Sitenin statik bir kopyası bağlı bir sunucu olmadan çalışıyorsa içerik ', { b: 'yalnızca senin tarayıcında' }, ' (bu cihazda) tutulur. Sayfada “önizleme modu” notunu görüyorsan durum budur.'],
      'Beğenilerin, skorların ve takma adın sana ait fan profilinde tutulur.',
    ],
  },
  {
    id: 'gorseller',
    icon: 'gallery',
    tag: 'Site',
    tone: 'gold',
    q: 'Görseller ve 3D modeller nasıl üretildi?',
    a: [
      ['Afişler, portreler ve 3D modeller (DOG maskotu, okçu kahraman, Aegis kupası) ', { b: 'fal.ai' }, ' ile üretildi. Valve’a ait görsel ya da logo kullanılmıyor.'],
      ['Bir görsel ya da model henüz yüklenmemişse sayfa boş kalmaz; yerine kodla çizilmiş (prosedürel) bir yedek gösterilir. Hepsi ', { a: '#galeri', t: 'Galeri & 3D Müze' }, '’de (', { k: 'T' }, ').'],
    ],
  },
  {
    id: 'skor',
    icon: 'trophy',
    tag: 'Oyun',
    tone: 'gold',
    q: 'Skor tabloları nasıl çalışır?',
    a: [
      'Her mini oyunda ulaştığın en iyi skor fan profiline kaydedilir. Skor tablosu bütün profilleri tarayıp canlı sıralar; senin satırın vurgulanır.',
      'Tabloda takma adın görünür. Yalnızca daha iyi bir skor eski rekorunun yerini alır; kötü bir el rekorunu bozmaz.',
    ],
    lore: 'Aegis bir kez kazanılır, ama her maç yeniden savunulur.',
  },
  {
    id: 'kisayol',
    icon: 'bolt',
    tag: 'Kontrol',
    tone: 'arcane',
    q: 'Kısayol tuşları neler?',
    a: [
      'Alt çubuk bir Dota yetenek ve eşya çubuğu gibi çalışır; her bölümün bir tuşu var:',
      { shortcuts: true },
      'Bir metin kutusuna yazarken kısayollar devre dışıdır; tuşları kullanan oyunlar da oynarken kısayolları kapatır.',
    ],
  },
  {
    id: 'kurallar',
    icon: 'shield',
    tag: 'Kural',
    tone: 'blood',
    q: 'İçerik kuralları neler?',
    a: [
      ['Saygı her şeyden önce gelir. ', { b: 'Küfür, hakaret, nefret söylemi ve cinsel içerik yok' }, '; kimseyi (yayıncı, izleyici ya da oyuncu) hedef alma.'],
      '“DOG” oyunbaz bir laftır, kişiye saldırı değildir. Ağır sözcükler otomatik yıldızlanır; kurallara uymayan içeriği moderatörler siler.',
    ],
    lore: 'İyi bir ward gibi ol: görünür, faydalı, kimseye zararsız.',
  },
  {
    id: 'nick',
    icon: 'user',
    tag: 'Profil',
    tone: 'jade',
    q: 'Takma adımı nasıl değiştiririm?',
    a: [
      'Geniş ekranlarda üst çubuktaki ad çipine, her ekranda ise yorum ya da soru formundaki “Yazan” çipine dokun. Kick adını da yazabilirsin.',
      'Yeni ad, bundan sonraki yorum, soru ve skorlarında görünür.',
    ],
  },
  {
    id: 'kabul',
    icon: 'check',
    tag: 'Soru-Cevap',
    tone: 'gold',
    q: 'Topluluk sorularında en iyi cevap nasıl seçilir?',
    a: [
      ['Soruyu soran kişi bir cevabı ', { b: '“Kabul et”' }, ' ile işaretler; kabul edilen cevap altın çerçeveyle en üste çıkar.'],
      'Sorular ve cevaplar pati ile oylanır. Kendi içeriğini her zaman silebilirsin; moderatörler kurallara uymayan her şeyi kaldırabilir.',
    ],
  },
  {
    id: 'kahin',
    icon: 'eye',
    tag: 'Kâhin',
    tone: 'arcane',
    q: 'DOG Kâhini gerçekten yapay zekâ mı?',
    a: [
      ['Hayır. Kâhin tamamen tarayıcında çalışan bir ', { b: '“sihirli küre”' }, ': sorudaki anahtar kelimelere (kahraman adları, ward, Roshan, buyback…) bakıp hazır bir cevap havuzundan seçer.'],
      ['Bir kahramanın adını anarsan seni ', { a: '#kahramanlar', t: 'Kahraman DOG Endeksi' }, '’ne (', { k: 'Z' }, ') yönlendirir. Aynı soruyu tekrar sorarsan farklı bir kehanet alabilirsin; “Sabit kader” açıkken aynı soru hep aynı cevabı alır. Ciddiye alma, ward al.'],
    ],
    lore: 'Kehanetin bedeli yok; ward koymamanın bedeli ağır.',
  },
];
