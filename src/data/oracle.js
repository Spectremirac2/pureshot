// DOG Kâhini — yerel "sihirli 8 top" motoru (yapay zekâ YOK).
// Radiant ormanının kadim ruhu her soruyu tartar: DOG mu, değil mi?
// Sorudaki anahtar kelimelere göre bir konu seçilir, konunun cevap havuzundan tohumlu (deterministik)
// bir cevap çekilir. Hiçbir konu eşleşmezse genel havuz kullanılır.
//
//   consult(soru, { seed, nth })  → saf fonksiyon: aynı (soru, seed, nth) hep aynı cevabı verir
//   createOracle({ seed })        → oturum nesnesi: aynı soru tekrar sorulunca farklı cevap (tohumla tekrarlanabilir)
//
// Hüküm kodları:
//   D = DOG · N = DOG DEĞİL · Y = YARI DOG · U = DOG DOG DOG · S = SİS (belirsiz) · '' = hüküm yok (selamlaşma)
//
// Not: Kâhin yayıncının ağzından konuşmaz; esprileri hayran yapımıdır. Dota bilgileri yamaya göre değişmeyen genel bilgilerdir.

import { hashStr, seeded } from '../core/dom.js';

export const VERDICTS = {
  D: { label: 'DOG', tone: 'ember' },
  N: { label: 'DOG DEĞİL', tone: 'jade' },
  Y: { label: 'YARI DOG', tone: 'gold' },
  U: { label: 'DOG DOG DOG', tone: 'blood' },
  S: { label: 'SİS', tone: 'arcane' },
};

/** Türkçe normalizasyon: küçük harf, ı/i, ş/s, ğ/g, ü/u, ö/o, ç/c, şapkalar; noktalama → boşluk. */
export function normalizeTr(s) {
  let t = String(s || '');
  try { t = t.toLocaleLowerCase('tr-TR'); } catch { t = t.toLowerCase(); }
  t = t.replace(/ı/g, 'i');
  try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch { /* eski tarayıcı */ }
  return t
    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Anahtar yazımı: 'pudge*' → önek eşleşmesi (pudgeu, pudgela…), 'io' → tam kelime,
// 'meat hook' → ardışık kelimeler (son kelimede * varsa önek).
export const TOPICS = [
  // ------------------------------------------------------------------ selam / kimlik (hükümsüz)
  {
    id: 'selam', label: 'Selamlaşma',
    keys: ['selam*', 'merhaba*', 'sa', 'slm', 'naber*', 'nasilsin*', 'iyi aksamlar', 'gunaydin*', 'hey'],
    answers: [
      ['', 'Selam, gezgin. Ağaçlar seni bekliyordu. Sor bakalım: DOG musun, değil misin?'],
      ['', 'Hoş geldin. Rüzgâr adını fısıldadı ama hükmünü henüz vermedi. Bir soru sor.'],
      ['', 'Kökler seni tanıdı. Ormanda nezaket ward gibidir: az kişide bulunur. Sorunu söyle.'],
      ['', 'Selam sana, fani. Kadim ruh uyanık; ward’ların ve kuşkuların hazırsa başlayalım.'],
    ],
  },
  {
    id: 'kimlik', label: 'Kâhin kimdir',
    keys: ['kimsin', 'sen kim*', 'kahin kim*', 'nesin', 'yapay zeka', 'bot mu*', 'gercek mi*'],
    answers: [
      ['', 'Ben Radiant ormanının kadim ruhuyum. Binlerce maç gördüm; her hamleyi tek bir teraziyle tartarım: DOG mu, değil mi?'],
      ['', 'Yapay zekâ değilim; yalnızca bu tarayıcıda uyuyan eski bir küreyim. Anahtar kelimeni duyarım, havuzumdan bir kehanet çekerim.'],
      ['', 'Ağaçların hafızası, rünlerin sesi, havlamaların yankısıyım. Kısacası: DOG dedektifi.'],
      ['', 'Adımı ancak Roshan bilir, o da söylemez. Sen sorunu sor, ben tartayım.'],
    ],
  },

  // ------------------------------------------------------------------ kahramanlar
  {
    id: 'pudge', label: 'Pudge',
    keys: ['pudge*', 'hook*', 'kanca*', 'meat hook', 'dismember', 'rot'],
    answers: [
      ['D', 'Kadim ağaçlar fısıldıyor: kanca üç creep’e, bir ağaca ve bir kuryeye takılacak. Hedefe asla.'],
      ['N', 'Kanca sisin içinden süzülüyor… ve tutuyor. Rüzgâr bu kez senin tarafında; bugün DOG değilsin, kasap.'],
      ['Y', 'Hook tutacak ama hedefi kendi kulelerinin dibine çekeceksin. Yarım zafer, yarım DOG.'],
      ['D', 'Ormanın ruhu gördü: Rot açık, mana bitik, Dismember yanlış kişide. Klasik.'],
      ['S', 'Kanca hem tutuyor hem tutmuyor. Kaderin iki ucu var: biri Pudge’da, biri creep’te.'],
      ['U', 'Ward’sız, blink’siz, planı olmayan bir Pudge görüyorum. Kökler titriyor: DOG DOG DOG.'],
    ],
  },
  {
    id: 'techies', label: 'Techies',
    keys: ['techies*', 'teciz*', 'tekiz*', 'mayin*', 'mine*'],
    answers: [
      ['D', 'Mayınlar ormanın her köşesinde, düşman hiçbir yerde. Toprak bile sıkıldı.'],
      ['U', 'Yirmi dakikadır tek bir noktaya mayın döşeyen biri var. Kadim ruh bile yoruldu: DOG DOG DOG.'],
      ['N', 'Doğru yere tek bir mayın, doğru anda tek bir patlama… Bu seferlik zekâ kokuyor. DOG değil.'],
      ['Y', 'Rakip patlıyor, takım arkadaşların da sinirden patlıyor. Yarı DOG.'],
      ['S', 'Bir mayının nerede olduğunu kimse bilemez. Ben bile. Sis kalın.'],
    ],
  },
  {
    id: 'invoker', label: 'Invoker',
    keys: ['invoker*', 'invo', 'quas', 'wex', 'exort', 'sun strike*', 'sunstrike*', 'cold snap', 'tornado'],
    answers: [
      ['N', 'Quas, Wex, Exort… Küreler hizalandı. On büyünün onu da yerini buldu. DOG değil, büyücü.'],
      ['D', 'Sun Strike haritanın öbür ucundaki boş bir kampa düştü. Ağaçlar alkışlamadı.'],
      ['Y', 'Kombonu ezberlemişsin ama tuşları karıştırıyorsun. Ormanın hükmü: yarı DOG.'],
      ['D', 'Üç küre dönüyor, hiçbiri doğru değil. Ghost Walk yerine Tornado… hem de düşmanın dibinde.'],
      ['S', 'Invoker’ın kaderi on büyü kadar dallı budaklı. Tekrar sor; küreler yeniden dizilsin.'],
    ],
  },
  {
    id: 'meepo', label: 'Meepo',
    keys: ['meepo*', 'klon*'],
    answers: [
      ['U', 'Dört Meepo görüyorum; dördü dört ayrı yöne koşuyor, biri çoktan düştü… ve hepsi gitti. DOG DOG DOG.'],
      ['N', 'Birden çok beden, tek bir akıl. Mikro kusursuz. Kadim ruh saydı, saydı, şaşırdı.'],
      ['D', 'Biri ormanda, biri koridorda, biri kulede, biri de… orada öylece duruyor. Biri ölürse hepsi ölür, unutma.'],
      ['Y', 'Farm hızın efsane, savaş anında panik. Yarı DOG, dört kat.'],
      ['S', 'Hangi Meepo’nun asıl olduğunu soruyorsun. Cevap: hepsi ve hiçbiri.'],
    ],
  },
  {
    id: 'antimage', label: 'Anti-Mage',
    keys: ['anti mage', 'antimage*', 'antimaj*', 'battle fury', 'bfury*', 'mana void', 'mana break'],
    answers: [
      ['D', 'Battle Fury erkenden çantada, ilk savaş ise 40. dakikada. Arada? Sadece orman ve sessizlik.'],
      ['Y', 'Blink ile kaçmayı iyi biliyorsun; blink ile gelmeyi de öğrenirsen DOG’luktan kurtulursun.'],
      ['N', 'Mana Void tam beş kişinin ortasına düştü. Kökler bile ayağa kalktı. DOG değil.'],
      ['D', 'Takımın 4v5 dövüşürken sen düşman ormanında “bir kamp daha” diyorsun. Rüzgâr adını biliyor.'],
      ['S', 'Anti-Mage’in yolu sabır ister. Sabır da bazen DOG’luğa dönüşür. Zaman gösterecek.'],
    ],
  },
  {
    id: 'io', label: 'Io',
    keys: ['io', 'wisp*', 'tether*', 'relocate*'],
    answers: [
      ['D', 'Tether kopuyor, Relocate yanlış anda basılıyor. Küçük ışık karanlıkta kayboldu.'],
      ['N', 'Tether bağlandı, iki ruh bir oldu. Kadim ağaçlar bu ortaklığa saygı duyar.'],
      ['Y', 'Relocate ile savaşın ortasına ışınlandın; geri dönüşü ise kimse beklemedi, sen bile.'],
      ['S', 'Io’nun ışığı sisin içinde yanıp sönüyor. Cevabım da öyle.'],
      ['U', 'Carry’sini bırakıp tek başına ormanda dolaşan bir Io… Işık tek başına yanmaz: DOG DOG DOG.'],
    ],
  },
  {
    id: 'rubick', label: 'Rubick',
    keys: ['rubick*', 'rubik*', 'spell steal', 'telekinesis'],
    answers: [
      ['N', 'Rakibin en güçlü büyüsünü çaldın ve ona geri gönderdin. Orman buna sanat der.'],
      ['D', 'Spell Steal ile rakibin en işe yaramaz büyüsünü çaldın, ultiyi ise kaçırdın. Orman güldü.'],
      ['Y', 'Büyü çalmakta usta, ward almakta çıraksın. Yarı DOG.'],
      ['S', 'Rubick başkasının büyüsünü taşır; kaderi de başkasının elinde. Bir daha sor.'],
      ['D', 'Rakip ultisini attı, sen o sırada kameranı arıyordun. Çalınacak büyü gitti, geriye pişmanlık kaldı.'],
    ],
  },
  {
    id: 'sniper', label: 'Sniper',
    keys: ['sniper*', 'snayper*', 'assassinate', 'shrapnel', 'headshot'],
    answers: [
      ['D', 'En uzaktan vuruyorsun ama yine de ilk ölen sensin. Menzilin ne işe yaradı, kâhin bile çözemedi.'],
      ['N', 'Arka hatta, doğru pozisyonda, BKB hazır. Kökler onaylıyor: DOG değil.'],
      ['Y', 'Assassinate ile kaçanı düşürdün, sonra tek başına ormana girdin. Yarı DOG.'],
      ['U', 'Ward’sız ormanda bir Sniper… ağaçların arasında görünmez biri gülümsüyor. DOG DOG DOG.'],
      ['S', 'Namlu sisin ardını göremez. Ben de şu an göremiyorum. Tekrar sor.'],
    ],
  },
  {
    id: 'riki', label: 'Riki',
    keys: ['riki*', 'gorunmez*', 'invis*'],
    answers: [
      ['D', 'Görünmez olman görünmez kalacağın anlamına gelmez; bir Sentry her şeyi anlatır.'],
      ['N', 'Sessiz, görünmez, ölümcül. Orman bile varlığını fark etmedi. DOG değil.'],
      ['Y', 'Arkadan vurmakta ustasın ama hep aynı arkaya: düşman çeşmesine. Yarı DOG.'],
      ['U', 'Dust gördün, yine de saldırdın. Görünmez bir DOG yine de DOG’dur: DOG DOG DOG.'],
      ['S', 'Riki’yi sorarsın, Riki cevap vermez. Orada mı, değil mi… bilinmez.'],
    ],
  },

  // ------------------------------------------------------------------ roller / koridor
  {
    id: 'mid', label: 'Mid',
    keys: ['mid', 'midi', 'midci*', 'midde*', 'midden*', 'midlane*', 'mid or feed', 'orta koridor*'],
    answers: [
      ['D', '“Mid or feed” dedin. Evrenin cevabı: feed.'],
      ['N', 'Rün kontrolü yerinde, last hit’ler tertemiz. Mid’in kralı sensin; bugünlük.'],
      ['Y', 'Mid’i kazandın ama dört rün kaçırdın, kenara hiç uğramadın. Yarı DOG.'],
      ['U', 'Midde 0-5, “gank gelsin” yazıyorsun, TP yok. Kadim ruh başını iki eliyle tutuyor: DOG DOG DOG.'],
      ['S', 'Orta koridor, dengeyle kaosun kesiştiği yer. Senin yerin neresi? Sis cevap vermiyor.'],
      ['D', 'Mid’i istedin, aldın, sonra “takım yok” dedin. Rüzgâr bu hikâyeyi çok duydu.'],
    ],
  },
  {
    id: 'ward', label: 'Ward',
    keys: ['ward*', 'observer*', 'sentry*', 'gorus*', 'dust', 'vision'],
    answers: [
      ['N', 'Doğru tepeye bir Observer, düşman ormanına bir Sentry. Orman sana minnettar.'],
      ['D', 'Ward’ların hâlâ çantanda. Harita karanlık, gönlün de öyle.'],
      ['U', 'Kimse ward almıyor. Beş kişinin beşi de “support değilim” diyor. DOG DOG DOG.'],
      ['Y', 'Ward koydun ama kendi üssüne. Niyet güzel, konum DOG.'],
      ['S', 'Karanlığı soruyorsun; karanlık da sana bakıyor. Önce bir ward al, sonra tekrar sor.'],
    ],
  },
  {
    id: 'support', label: 'Support',
    keys: ['support*', 'sup', 'suport*', 'destek*', 'pos 5', 'pos 4', 'pos5', 'pos4', '5 numara*'],
    answers: [
      ['N', 'Ward, smoke, kurye… Savaşta ilk sen düştün ama carry yaşadı. Kadim ruh eğiliyor: DOG değil.'],
      ['D', 'Support seçip carry’nin kamplarını yiyorsun. Bu bir destek değil, bir yük.'],
      ['Y', 'Ward’ları koydun, Tango’ları paylaştın, sonra koca bir eşya için bütün farmı topladın. Yarı DOG.'],
      ['U', '5 numara ilk dakikada “ben carry’im” dedi. Ormanın kökleri tutuştu: DOG DOG DOG.'],
      ['S', 'Destek olmak görünmez bir kahramanlıktır. Görünmeyeni ben de zor görürüm.'],
    ],
  },
  {
    id: 'carry', label: 'Carry',
    keys: ['carry*', 'kerri*', 'pos 1', 'pos1', 'core*'],
    answers: [
      ['N', 'Doğru zamanda farm, doğru zamanda savaş. Net worth grafiğiyle kalbin aynı ritimde atıyor.'],
      ['D', 'Altı slotun dolu ama takımın çoktan “gg” yazdı. Farmın kime yaradı?'],
      ['Y', 'Farmın iyi, BKB’n yok. Yarı carry, yarı DOG.'],
      ['U', 'Carry 30. dakikada hâlâ ormanda “bir kamp daha” diyor. DOG DOG DOG.'],
      ['S', 'Taşıyabilir misin? Bu soruyu takımın da soruyor. Cevap son dakikada gelecek.'],
      ['N', '1vDOQUZ için doğmuş bir carry görüyorum. Dokuz kişiye karşı, tek başına… ve ayakta.'],
    ],
  },
  {
    id: 'farm', label: 'Farm',
    keys: ['farm*', 'last hit*', 'lasthit*', 'cs', 'jungle*', 'stack*', 'kamp*'],
    answers: [
      ['D', 'Bir kamp daha, bir kamp daha… Oyun bitti, kamp hâlâ orada.'],
      ['N', 'Last hit’ler temiz, deny’ler keskin. Farm bir sanatsa sen de sanatçısın.'],
      ['Y', 'Farmın süper, savaşa geliş hızın salyangoz. Yarı DOG.'],
      ['U', 'Takımın savaşırken sen üçlü kampı stack’liyorsun. DOG DOG DOG.'],
      ['S', 'Farmın sonu yok; yalnızca oyunun sonu var.'],
    ],
  },
  {
    id: 'feed', label: 'Feed',
    keys: ['feed*', 'fider*', 'kda', 'oldum', 'olup dur*', 'intihar*'],
    answers: [
      ['D', 'KDA’n telefon numarası gibi. Orman aramayacak.'],
      ['U', 'Feed’in bir sanat olduğunu düşünüyorsan sen bir ressamsın: DOG DOG DOG.'],
      ['N', 'Ölmek bazen takımı kurtarmak içindir. Seninki bir fedakârlıktı; kökler saygıyla eğiliyor.'],
      ['Y', 'Feed ettin ama TP ile geri döndün ve yine savaştın. Yarı DOG, tam inat.'],
      ['S', 'Her ölüm bir ders. Kaç ders aldığını saymak ister misin?'],
    ],
  },

  // ------------------------------------------------------------------ eşyalar
  {
    id: 'rapier', label: 'Rapier',
    keys: ['rapier*', 'divine rapier', 'rapiyer*'],
    answers: [
      ['D', 'Rapier aldın, öldün, rakip aldı. Ormanın hafızasında bu bir trajedi olarak kalacak.'],
      ['N', 'Rapier elinde, düşman kaçıyor. Cesaret DOG’luk değildir; bu sefer değil.'],
      ['U', 'Kaybedilen oyunda son altınlarla Rapier… ve tek başına düşman üssüne. DOG DOG DOG.'],
      ['Y', 'Rapier aldın ama BKB’yi unuttun. İlk stun’da kaderin el değiştirecek. Yarı DOG.'],
      ['S', 'Rapier kimin elinde bitecek? Bunu ancak ilk ölen bilir.'],
    ],
  },
  {
    id: 'bkb', label: 'BKB',
    keys: ['bkb*', 'black king bar', 'buyu bagisik*'],
    answers: [
      ['N', 'BKB zamanında alındı, zamanında basıldı. Büyüler üstünden kayıp gitti. Kadim onay.'],
      ['D', 'BKB çantanda duruyor, sen stun’da dönüyorsun. Tuşu da mı ward’ladın?'],
      ['Y', 'BKB’ye bastın ama savaş çoktan bitmişti. Yarı DOG.'],
      ['U', '“BKB almıyorum, hasarım düşer” diyorsun. Rakipte beş stun var. DOG DOG DOG.'],
      ['S', 'Büyü bağışıklığı her şeyi çözmez. Ama çoğu şeyi çözer. Sis bu kadarını söylüyor.'],
    ],
  },
  {
    id: 'blink', label: 'Blink',
    keys: ['blink*', 'dagger*', 'hancer*'],
    answers: [
      ['N', 'Blink, ulti, zafer. Orman bu initiate’i yıllarca anlatacak.'],
      ['D', 'Blink ile savaşın ortasına girdin… ve hiçbir tuşa basmadın.'],
      ['Y', 'Blink’in var ama hasar alınca bir süre çalışmıyor; kaçışı savaş başlamadan düşünmeliydin.'],
      ['U', 'Blink ile düşman çeşmesine girdin. Neden? Kimse bilmiyor. DOG DOG DOG.'],
      ['S', 'Göz kırpması kadar kısa bir gelecek görüyorum. Blink’le geldi, blink’le gitti.'],
    ],
  },
  {
    id: 'tango', label: 'Tango',
    keys: ['tango*', 'agac*', 'salve*'],
    answers: [
      ['N', 'Tango paylaşan ruh, ormanın dostudur. DOG değil.'],
      ['D', 'Salve’i savaşın ortasında içtin, ilk vuruşta boşa gitti. Tango olsaydı ağaçlar yardım ederdi.'],
      ['U', 'Tango’larının hepsini ilk dakikada yedin. Ağaçlar hâlâ yas tutuyor. DOG DOG DOG.'],
      ['Y', 'Tango’nu takım arkadaşlarına dağıttın, kendine hiç bırakmadın. Yarı DOG, tam cömert.'],
      ['S', 'Hangi ağaç yenmeli? Her ağaç bir hikâye, her Tango bir veda.'],
    ],
  },
  {
    id: 'tp', label: 'TP',
    keys: ['tp', 'tpsiz', 'town portal', 'isinlan*', 'teleport*'],
    answers: [
      ['D', 'TP’n yok. Savaş başladı. Sen yürüyorsun.'],
      ['N', 'TP’ni sakladın, kuleyi kurtardın. Kökler memnun.'],
      ['U', 'TP ile savaşa geldin, TP ile kaçtın, arkanda dört düşmüş arkadaş kaldı. DOG DOG DOG.'],
      ['Y', 'TP bastın ama yanlış kuleye. Yarı DOG.'],
      ['S', 'Işınlanmak mı? Önce nereye gitmek istediğini bil.'],
    ],
  },
  {
    id: 'smoke', label: 'Smoke',
    keys: ['smoke*', 'gank*', 'baskin*'],
    answers: [
      ['N', 'Smoke açıldı, beş kişi sessizce ilerledi, gank tuttu. Orman bu uyumu alkışlar.'],
      ['D', 'Smoke açtın, sonra biri düşman kulesinin dibinden geçti. Duman dağıldı, plan da.'],
      ['U', 'Tek başına smoke açıp tek başına gank’e gittin. Tek başına düştün. DOG DOG DOG.'],
      ['Y', 'Gank için geldin ama yolda rüne takıldın. Yarı DOG.'],
      ['S', 'Dumanın içinde her şey mümkün. Tıpkı cevabım gibi.'],
    ],
  },

  // ------------------------------------------------------------------ oyun anları
  {
    id: 'roshan', label: 'Roshan',
    keys: ['roshan*', 'rosh*', 'aegis*', 'egis*', 'cheese*', 'peynir*'],
    answers: [
      ['N', 'Roshan düştü, Aegis doğru elde. Kadim ağaçlar bu stratejiyi onaylar.'],
      ['D', 'Roshan’a dört kişi girdiniz, beşinciniz koridorda farm yapıyor. Roshan bile şaşkın.'],
      ['U', 'Aegis’i support aldı. Carry ağlıyor, orman gülüyor. DOG DOG DOG.'],
      ['Y', 'Roshan’ı kestiniz ama Aegis’i almadan çıktınız. Yarı DOG, tam unutkanlık.'],
      ['S', 'Roshan çukurunun derinliklerinden bir ses… “Ward var mı?” diye soruyor.'],
      ['N', 'Cheese doğru kişiye gitti. Bazen kader peynir kokar.'],
    ],
  },
  {
    id: 'buyback', label: 'Buyback',
    keys: ['buyback*', 'bb', 'bayback*', 'geri satin*'],
    answers: [
      ['N', 'Buyback’i sakladın, doğru anda kullandın, üs kurtuldu. Orman saygıyla susuyor.'],
      ['D', 'Buyback parası başka bir eşyaya gitti. Üs düşerken sen ölüm ekranında bekliyorsun.'],
      ['U', 'Buyback aldın, TP’siz çıktın, yürürken yine düştün. DOG DOG DOG.'],
      ['Y', 'Buyback’in var ama cesaretin yok. Yarı DOG.'],
      ['S', 'Geri dönmeli mi? Kaderin altın sayacı henüz karar vermedi.'],
    ],
  },
  {
    id: 'pause', label: 'Pause',
    keys: ['pause*', 'poz', 'durdur*', 'ara ver*'],
    answers: [
      ['D', 'Takım savaşının ortasında pause. Zaman durdu ama DOG’luk durmadı.'],
      ['N', 'Birinin bağlantısı koptu, sen sabırla bekledin. Adil bir ruh DOG değildir.'],
      ['U', 'Rakip ultisini atarken pause… sonra “yanlışlıkla” dedin. DOG DOG DOG.'],
      ['Y', 'Pause’u su içmek için verdin. Anlaşılır, ama bu üçüncü kez. Yarı DOG.'],
      ['S', 'Zamanı durdurmak mı istiyorsun? Orman zamanı durdurmaz; yalnızca bekler.'],
    ],
  },
  {
    id: 'kurye', label: 'Kurye',
    keys: ['kurye*', 'courier*'],
    answers: [
      ['D', 'Kurye düşman kulesine doğru süzülüyor, çantası dolu… Ağaçlar gözlerini kapattı.'],
      ['N', 'Kurye tam zamanında geldi. Bottle dolu, ruh huzurlu.'],
      ['U', 'Kuryeyi dört kez aynı yerde kaybettin. Yol bile seni tanıyor. DOG DOG DOG.'],
      ['Y', 'Kuryeyi kullandın ama takım arkadaşının eşyasını da geri yolladın. Yarı DOG.'],
      ['S', 'Kurye yolda. Nereye gittiği ise bir sır.'],
    ],
  },
  {
    id: 'rampage', label: 'Rampage',
    keys: ['rampage*', 'rampeyc*', 'ultra kill', 'mega kill*'],
    answers: [
      ['N', 'Rampage görüyorum… ya da çok güzel bir rüya. İki durumda da DOG değil.'],
      ['D', 'Rampage’e tek kişi kalmıştı, biri son vuruşu çaldı. Kaçıran değil, çalan DOG.'],
      ['Y', 'Ultra Kill yaptın, beşinciyi kovalarken kuleye daldın. Yarı DOG.'],
      ['S', 'Beş düşüş, tek bir isim. O isim senin mi? Kader henüz yazmadı.'],
      ['U', 'Rampage peşinde koşarken kendi Ancient’ın düştü. DOG DOG DOG.'],
    ],
  },
  {
    id: 'gg', label: 'GG',
    keys: ['gg', 'ff', 'surrender*', 'teslim*', 'pes'],
    answers: [
      ['N', '“gg” demek için erken. Kadim ağaçlar 60. dakikada dönen oyunlar da gördü.'],
      ['D', '10. dakikada “ff” yazan ruh, ormanın en yorgun ruhudur.'],
      ['Y', '“gg” yazdın, sonra geri dönüş geldi. Yarı DOG, tam şans.'],
      ['S', 'Oyun Ancient düşene kadar bitmez. Kökler sabrı sever.'],
      ['U', 'İlk kan bile düşmeden “gg” yazdın. DOG DOG DOG.'],
    ],
  },

  // ------------------------------------------------------------------ sıralama / davranış
  {
    id: 'mmr', label: 'MMR',
    keys: ['mmr*', 'rank*', 'rutbe*', 'elo*', 'madalya*', 'herald*', 'guardian*', 'crusader*', 'archon*', 'legend*', 'ancient*', 'divine', 'immortal*'],
    answers: [
      ['D', 'MMR’ın düşüyor çünkü her maçta “takım kötü” diyorsun. Bütün o maçların ortak paydası kim, bir düşün.'],
      ['N', 'Yıldızlar yükseliyor. Bir sonraki madalya seni bekliyor; ward’ı unutma.'],
      ['Y', 'Rank atlamak için oynuyorsun ama tilt olunca feed’e geçiyorsun. Yarı DOG.'],
      ['S', 'Sayılar gelir geçer. Herald’dan Immortal’a herkes bir gün DOG olur.'],
      ['U', 'Rank için yeni hesap açmayı düşünüyorsun. Kökler titredi: DOG DOG DOG.'],
    ],
  },
  {
    id: 'smurf', label: 'Smurf',
    keys: ['smurf*', 'ikinci hesap*', 'yan hesap*'],
    answers: [
      ['D', 'Smurf hesapta bile kaybediyorsan sorun hesapta değil.'],
      ['U', 'Düşük rütbelere inip oradakileri ezmek… Kadim ruh bundan hoşlanmaz. DOG DOG DOG.'],
      ['Y', 'Smurf olduğunu söylüyor ama ward koymayı bilmiyor. Yarı DOG, tam masal.'],
      ['N', 'Kendi hesabında dürüstçe tırmanan birini görüyorum. Smurf’e ihtiyacın yok.'],
      ['S', 'O hesap kimin? Sis bile bilmiyor. Ama oynayış tarzı her şeyi anlatır.'],
    ],
  },
  {
    id: 'report', label: 'Report',
    keys: ['report*', 'repor*', 'rapor*', 'sikayet*'],
    answers: [
      ['D', 'Report’u takım arkadaşına, kendine hiç. Klasik DOG ritüeli.'],
      ['N', 'Report yerine “gg wp” yazdın. Orman buna olgunluk der.'],
      ['Y', 'Report atmak için sabırsızlanıyorsun; oyun daha 3. dakikada. Yarı DOG.'],
      ['U', 'Dört kişi seni reportladı, beşincisi rakipten. DOG DOG DOG.'],
      ['S', 'Report kutusu bir kuyudur; ne atarsan o yankılanır.'],
    ],
  },
  {
    id: 'tilt', label: 'Tilt',
    keys: ['tilt*', 'sinir*', 'ofke*', 'toxic*', 'toksik*'],
    answers: [
      ['D', 'Klavyeye vurmak ward koymakla aynı şey değil. Tilt bir DOG kapısıdır.'],
      ['N', 'Derin bir nefes aldın, chat’i kapattın, oyuna döndün. Kökler huzur buldu.'],
      ['U', 'Tilt oldun, all chat’e roman yazdın, bu sırada üç kez düştün. DOG DOG DOG.'],
      ['Y', 'Sinirlisin ama hâlâ last hit alıyorsun. Yarı DOG, tam profesyonel.'],
      ['S', 'Öfke bir sis gibidir; içindeyken hiçbir şey net görünmez. Bir su iç, sonra sor.'],
    ],
  },

  // ------------------------------------------------------------------ meme'ler
  {
    id: 'dogmu', label: 'DOG mu',
    keys: ['dog mu*', 'dog mi*', 'dog mudur', 'dogmu*', 'kopek*', 'dog degil*', 'dog musun', 'dog muyum'],
    answers: [
      ['D', 'Soruyu sorman bile bir işaret. Kadim ruh tarttı, ölçtü: DOG.'],
      ['N', 'Ağaçlar kulak verdi, rüzgâr kokladı: DOG değil. Şimdilik.'],
      ['Y', 'Yarısı DOG, yarısı oyuncu. Hangi yarının kazanacağını bir sonraki maç gösterecek.'],
      ['U', 'Sorunun cevabı ormanda üç kez yankılandı: DOG DOG DOG.'],
      ['S', 'Her oyuncunun içinde bir DOG uyur. Seninki uyanık mı? Sis kalkınca görürüz.'],
      ['D', 'Kâhin ölçtü: harita farkındalığı düşük, chat faaliyeti yüksek. DOG.'],
    ],
  },
  {
    id: '1v9', label: '1vDOQUZ',
    keys: ['1v9', '1vdoquz*', '1vdokuz*', 'doquz*', '1 v 9', '1 e 9', 'bire dokuz', 'dokuz kisi*', 'sirtla*', 'tasi*'],
    answers: [
      ['N', '1vDOQUZ mümkün. Dört takım arkadaşı, beş rakip… dokuz kişi. Ama bir kişi yeter, o kişi sensen.'],
      ['Y', '1v9 yapmaya çalışıyorsun; zorluk şu ki dokuzun dördü senin takımında. Yarı DOG.'],
      ['U', '1vDOQUZ dedin, 0-9 yaptın. Q harfi bile utandı. DOG DOG DOG.'],
      ['S', 'Dokuz gölge, tek bir ışık. Işık yeterince parlak mı? Kaderin Q’su belirsiz.'],
      ['N', 'Sırtında dokuz kişi var ama bacakların sağlam. Kökler bu yükü taşıyabileceğini söylüyor.'],
      ['D', '1v9 ancak dokuzdan biri olmadığında olur. Şu an sen dokuzdan birisin.'],
    ],
  },
  {
    id: 'yayin', label: 'Maraton',
    keys: ['yayin*', '24 saat*', '24saat*', 'maraton*', 'uyku*', 'uyu*', 'uyan*', 'kac saat*', 'kick*', 'stream*', 'canli*'],
    answers: [
      ['S', '24 saat mi? Orman bunu ısınma turu sayar. Zamanı saymam; yalnızca DOG’ları sayarım.'],
      ['N', 'Maraton uzun, ama sen hâlâ buradasın. Sadık bir ruh DOG değildir.'],
      ['D', 'Maratonda uyuyakalmak, Roshan’ı ward’sız kesmek gibidir: yapılır ama pişman olunur.'],
      ['Y', 'Yirmi dördüncü saatte hâlâ izliyorsun ama sohbette uyuyakaldın. Yarı DOG, tam hayran.'],
      ['S', 'Yayının ne zaman biteceğini soruyorsun. Güneş doğar, güneş batar… yayın devam eder.'],
      ['N', 'Uykusuz izlemek bir erdemse, su içmek de öyledir. Kâhin’in reçetesi: bir bardak su ve bir Tango.'],
    ],
  },
  {
    id: 'kazanir', label: 'Kazanır mıyız',
    keys: ['kazan*', 'win*', 'yener*', 'yeneriz', 'kaybed*', 'kaybet*', 'mac*', 'oyun*'],
    answers: [
      ['N', 'Kökler evet diyor. Bir şartla: kimse tek başına Roshan’a girmeyecek.'],
      ['D', 'Kazanma ihtimaliniz, ward’ların çantadan çıkma ihtimaliyle aynı.'],
      ['Y', 'Kazanırsınız… carry ormandan çıkarsa. Çıkacak mı? O ayrı bir kehanet.'],
      ['S', 'Maç henüz yazılmadı. Bir Tango ye, sabret, tekrar sor.'],
      ['U', 'Seçim ekranında beş carry görüyorum. Kazanmak mı? DOG DOG DOG.'],
      ['N', 'Bu maç 1vDOQUZ kokuyor. Biri takımı sırtlayacak… ve kazanacak.'],
    ],
  },
];

/** Hiçbir konu eşleşmezse: genel kehanetler (en az 40). */
export const GENERIC = [
  // DOG DEĞİL (olumlu)
  ['N', 'Kadim ağaçlar başını salladı. Evet. Ve hayır, DOG değil.'],
  ['N', 'Rünler parlıyor, işaretler lehine. Ward’ını al ve yürü.'],
  ['N', 'Rüzgâr Radiant’tan esiyor. Bu iyiye işaret.'],
  ['N', 'Kökler derinden onaylıyor. Bugün bir kahraman gibi oyna.'],
  ['N', 'Evet. Kesinlikle. Tıpkı zamanında basılmış bir BKB gibi.'],
  ['N', 'Bu fikir Aegis gibi ışıldıyor. Dene.'],
  ['N', 'Yıldızlar Roshan çukurunun üstünde hizalandı: evet.'],
  ['N', 'Orman sessizleşti. Bu, onay demektir.'],
  ['N', 'Evet. Bunu ormanın en yaşlı meşesi söyledi, ben yalnızca aktarıyorum.'],
  ['N', 'İşaretler 1vDOQUZ gücünü gösteriyor: dokuz engel, tek sen. Yürü.'],
  ['N', 'Hiç şüphe yok. Kaderin çantasında altı slot dolu.'],
  // DOG (olumsuz)
  ['D', 'Hayır. Bunu sorduğun an ormanın bir köşesinde bir köpek havladı.'],
  ['D', 'Kökler kurudu, yapraklar döküldü. Hüküm açık.'],
  ['D', 'Bu fikri ward’sız ormana dalmakla aynı kefeye koyuyorum.'],
  ['D', 'Hayır. “Mid or feed” dersen feed çıkar; bu da onlardan.'],
  ['D', 'Rüzgâr Dire’den esiyor ve yanında hafif bir havlama getiriyor.'],
  ['D', 'Buna “evet” dersem kadim ağaçlar beni reportlar.'],
  ['D', 'Kader bu soruya TP’siz yakalandı. Cevap: hayır.'],
  ['D', 'İşaretler kötü. Kurye bile yolunu değiştirdi.'],
  ['D', 'Olmaz. Olsa bile olmamalı.'],
  ['D', 'Rün yerine creep’e bakan bir kâhin bile bunun “hayır” olduğunu görür.'],
  // YARI DOG
  ['Y', 'Yarı evet, yarı DOG. Bir Tango ye, dengelenir.'],
  ['Y', 'Olabilir… ama önce haritaya bak. Herkes kayıp.'],
  ['Y', 'Kader ikiye bölündü: bir yol farma, bir yol feed’e gidiyor.'],
  ['Y', 'Şimdi değil. Belki bir sonraki Roshan’dan sonra.'],
  ['Y', 'İhtimal var, ama ihtimal de bazen ward’sız dolaşır.'],
  ['Y', 'Fikir güzel, uygulama DOG. Birini düzelt.'],
  ['Y', 'Evet… takım arkadaşların seni dinlerse. Yani büyük ihtimalle hayır.'],
  ['Y', 'Yarısı doğru. Diğer yarısı hâlâ ormanda farm yapıyor.'],
  // SİS
  ['S', 'Küre bulanık. Tekrar sor, bu kez daha az DOG bir sesle.'],
  ['S', 'Sis kalın. Bir Observer ward koy, sonra yeniden danış.'],
  ['S', 'Cevap Roshan çukurunun dibinde. Dört kişiyle gel.'],
  ['S', 'Ruhlar şu an pause’da. Birazdan tekrar dene.'],
  ['S', 'Kader henüz farm yapıyor. Sabret.'],
  ['S', 'Bu sorunun cevabı ancak 24 saatlik bir maratonun sonunda belli olur.'],
  ['S', 'Quas, Wex ve Exort aynı anda konuştu; hiçbirini anlayamadım.'],
  ['S', 'Ormanın rüzgârı döndü. Sorunu başka bir şekilde sor.'],
  ['S', 'Görüyorum… görmüyorum… Bir Dust at, bakalım.'],
  ['S', 'Cevap görünmez; bir Sentry ward lazım.'],
  // DOG DOG DOG
  ['U', 'Bu soruyu duyan bütün ağaçlar aynı anda havladı: DOG DOG DOG.'],
  ['U', 'Kadim ruh üç kez düşündü, üç kez aynı sonuca vardı: DOG DOG DOG.'],
  ['U', 'Soru DOG. Cevap DOG. Ben de biraz DOG oldum. DOG DOG DOG.'],
  ['U', 'Kehanet net: bu 1vDOQUZ değil, 0vDOQUZ. DOG DOG DOG.'],
  ['U', 'Rüzgâr üç kez esti, üç kez havladı. Anlaşıldı.'],
  ['U', 'Kâhin’in kitabında bu soru “DOG” başlığı altında, üç kez altı çizili.'],
];

/** Kehanetin başına bazen eklenen gizemli girişler. */
export const OPENERS = [
  'Küre titriyor…',
  'Kökler fısıldıyor:',
  'Sisin içinden bir ses:',
  'Kadim ruh gözlerini açtı.',
  'Rüzgâr döndü.',
  'Rünler yere düştü ve şöyle dizildi:',
  'Ağaçların arasından bir havlama yankılandı.',
];

/** Boş ya da anlamsız sorular için. */
export const SILENCE = [
  ['S', 'Sessizliğe cevap yoktur. Bir soru sor, gezgin.'],
  ['S', 'Küre boş bir soruyu tartamaz. Bir kahraman, bir eşya, bir dert söyle.'],
];

/** Arayüzdeki örnek soru çipleri. */
export const ORACLE_EXAMPLES = [
  'Pudge hook tutar mı?',
  'Bu maçı kazanır mıyız?',
  'Takım arkadaşım DOG mu?',
  'Rapier alayım mı?',
  '1vDOQUZ mümkün mü?',
  'Yayın kaç saat sürecek?',
  'Ward koyan çıkar mı?',
  'Mid or feed?',
  'Buyback saklayayım mı?',
  'Invoker oynamalı mıyım?',
];

// ------------------------------------------------------------------ eşleştirme
function compileKey(raw) {
  const prefix = raw.endsWith('*');
  const words = normalizeTr(raw.replace(/\*$/, '')).split(' ').filter(Boolean);
  const phrase = words.join(' ');
  return { words, prefix, weight: phrase.length + (words.length - 1) * 3 };
}

const COMPILED = TOPICS.map((t) => ({ topic: t, keys: t.keys.map(compileKey) }));

function keyMatches(tokens, key) {
  const n = key.words.length;
  if (!n) return false;
  for (let i = 0; i + n <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      const tok = tokens[i + j];
      const w = key.words[j];
      const last = j === n - 1;
      if (last && key.prefix ? !tok.startsWith(w) : tok !== w) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/** Soruya en uygun konuyu bulur (yoksa null). */
export function findTopic(question) {
  const tokens = normalizeTr(question).split(' ').filter(Boolean);
  if (!tokens.length) return null;
  let best = null;
  let bestScore = 0;
  for (const { topic, keys } of COMPILED) {
    let score = 0;
    for (const k of keys) if (keyMatches(tokens, k)) score += k.weight;
    if (score > bestScore) { best = topic; bestScore = score; }
  }
  return best;
}

function mix(a, b) {
  return (Math.imul(a ^ (b >>> 0), 2654435761) ^ (a >>> 13)) >>> 0;
}

/**
 * Saf kehanet: aynı (soru, seed, nth) her zaman aynı cevabı verir.
 * @param {string} question
 * @param {{ seed?: number, nth?: number, avoid?: number|null }} opts
 * @returns {{ text: string, verdict: string, verdictLabel: string|null, tone: string|null, topic: string|null, topicLabel: string|null, index: number }}
 */
export function consult(question, { seed = 0, nth = 0, avoid = null } = {}) {
  const norm = normalizeTr(question);
  const topic = norm.replace(/\s/g, '').length >= 2 ? findTopic(norm) : null;
  const pool = norm.replace(/\s/g, '').length < 2 ? SILENCE : topic ? topic.answers : GENERIC;
  const rnd = seeded(mix(mix(hashStr(norm), seed >>> 0), nth + 1));
  let index = Math.floor(rnd() * pool.length);
  if (avoid != null && pool.length > 1 && index === avoid) {
    index = (index + 1 + Math.floor(rnd() * (pool.length - 1))) % pool.length;
  }
  const [verdict, body] = pool[index];
  let text = body;
  // Selamlaşmaya giriş eklenmez; diğerlerine bazen gizemli bir giriş cümlesi
  if (verdict && rnd() < 0.34) text = OPENERS[Math.floor(rnd() * OPENERS.length)] + ' ' + body;
  const v = VERDICTS[verdict] || null;
  return {
    text,
    verdict,
    verdictLabel: v ? v.label : null,
    tone: v ? v.tone : null,
    topic: topic ? topic.id : null,
    topicLabel: topic ? topic.label : null,
    index,
  };
}

/** Kader modunda (sabit tohum) kullanılan tohum. */
export const FIXED_SEED = 0x1d06d06;

/**
 * Oturum kâhini: aynı soru aynı oturumda tekrar sorulursa farklı kehanet (önceki cevabı tekrarlamaz).
 * Tohum verilirse bütün dizi tekrarlanabilir; `fixed: true` ile her soru tek, değişmez cevabını alır.
 */
export function createOracle({ seed } = {}) {
  const baseSeed = seed != null ? seed >>> 0 : (Math.random() * 4294967296) >>> 0;
  const counts = new Map();
  const last = new Map();
  return {
    seed: baseSeed,
    ask(question, { fixed = false } = {}) {
      if (fixed) return consult(question, { seed: FIXED_SEED, nth: 0 });
      const key = normalizeTr(question);
      const n = counts.get(key) || 0;
      counts.set(key, n + 1);
      const r = consult(question, { seed: baseSeed, nth: n, avoid: last.has(key) ? last.get(key) : null });
      last.set(key, r.index);
      return r;
    },
    reset() { counts.clear(); last.clear(); },
  };
}
