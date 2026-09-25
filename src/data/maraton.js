// 24 Saat Maraton — olay bankası, sahte chat satırları ve bitiş unvanları.
//
// Kurallar:
// - Ton oyunbaz ve saygılı: kişileri değil hamleleri hedef alır, küfür yok.
// - Yayıncı hakkında yalnızca bilinenler: Kick, Dota 2, “DOG DOG DOG”, “1vDOQUZ” ve en kısa yayının bile
//   24 saat sürmesi. Olaylar kurgusal bir simülasyonun “olabilecek” anlarıdır; kimseye alışkanlık,
//   özel hayat ya da kişisel bilgi yakıştırılmaz. Chat kullanıcı adları uydurma ve geneldir.
// - Metinler kısa: 390 px ekranda kart iki-üç satırı geçmesin.
//
// Olay alanları:
//   id       kalıcı kimlik (her oyunda en fazla bir kez)
//   title    başlık · text: kısa anlatım
//   art      { item: '<eşya>' } (src/assets/items) | { hero: '<kahraman id>' } (portre) | { icon: '<ikon>' }
//   phase    'match' (yalnızca maç sırasında) | 'idle' (maç dışında) | 'any'
//   at       sabit saat: oyun saati bu saate gelince çıkar (0–23)
//   hours    [başlangıç, bitiş): yalnızca bu saatlerde çıkabilir
//   need     { energyBelow, dogs, tiltAbove, moodBelow } koşulları
//   weight   rastgele seçimde ağırlık (varsayılan 1)
//   choices  [{ label, fx, text } | { label, chance, ok: { fx, text }, no: { fx, text } }]
//
// Etki (fx) anahtarları — hepsi isteğe bağlı:
//   e enerji · m chat moodu · t tilt · mmr · hype (izleyici dalgası) · fame (kalıcı izleyici çarpanı)
//   v anında izleyici değişimi (−0,1 = %10 düşüş) · win maç kazanma şansı (maç yoksa sıradaki maç)
//   dog 1 → DOG DOG DOG anı · away dakika (yayında içerik yok: mola benzeri)

export const MR_EVENTS = [
  // ------------------------------------------------------------ sabit saatler
  {
    id: 'gece-3', at: 3, phase: 'any', art: { icon: 'moon' },
    title: 'Gece 3 sessizliği',
    text: 'Chat yavaşladı; ekranda yalnızca en sadık gece nöbetçileri kaldı.',
    choices: [
      { label: 'Sohbet turu: herkese selam', fx: { m: 12, e: -4, fame: 0.02 }, text: 'Gece nöbetçileri tek tek selamlandı. Chat ısındı.' },
      { label: 'Sessizce grind', fx: { t: -6, e: -2, mmr: 5 }, text: 'Kulaklık takıldı, odak tavan. Chat izlemekle yetindi.' },
    ],
  },
  {
    id: 'sabah-6', at: 6, phase: 'any', art: { icon: 'sun' },
    title: 'Sabah 6 ve güneş doğdu',
    text: 'Perdeden gün ışığı sızıyor, kuşlar ötüyor. Chat “günaydın” yazmaya başladı.',
    choices: [
      { label: 'Günaydın chat! Kahvaltı molası', fx: { e: 16, m: 8, v: -0.08, away: 20 }, text: 'Çay demlendi, kahvaltı edildi. Yeni güne tam enerji.' },
      { label: 'Perdeyi kapat, oyuna devam', fx: { e: -4, t: -4, hype: 0.1 }, text: 'Chat: “vampir modu açıldı”. Maraton gece gibi sürüyor.' },
    ],
  },
  {
    id: 'yari-yol', at: 12, phase: 'any', art: { icon: 'hourglass' },
    title: 'Yarı yol: 12 saat!',
    text: 'Maratonun yarısı bitti. Chat “daha yeni başladık” diye takılıyor.',
    choices: [
      { label: 'Chat’e anket: hedef ne?', fx: { m: 12, fame: 0.03, e: -2 }, text: 'Anket kazananı: “1vDOQUZ görmeden uyumak yok.”' },
      { label: 'Esneme hareketleri', fx: { e: 10, t: -5, m: 2 }, text: 'Omuzlar açıldı, bilekler ısındı. İkinci yarıya hazır.' },
    ],
  },
  {
    id: 'aksam', at: 19, phase: 'any', art: { item: 'enchanted_mango' },
    title: 'Akşam yemeği saati',
    text: 'Mideler guruldadı; chat’te yemek önerileri havada uçuşuyor.',
    choices: [
      { label: 'Yemek molası (30 dk)', fx: { e: 22, m: -4, v: -0.1, away: 30 }, text: 'Karnı doyan yayıncı, yeniden masada. Enerji geri geldi.' },
      { label: 'Atıştır, oyun devam', fx: { e: 8, m: 5 }, text: 'Chat: “afiyet olsun, ama creep’leri kaçırma”.' },
    ],
  },
  {
    id: 'son-saat', at: 23, phase: 'any', art: { item: 'aegis' },
    title: 'Son saat!',
    text: 'Chat geri sayıma başladı. Herkes finali görmek için geliyor.',
    choices: [
      { label: 'Hype maçı: herkes tahmin yapsın', fx: { hype: 0.5, m: 10, e: -5 }, text: 'Tahminler yağıyor, izleyici sayısı tırmanıyor!' },
      { label: 'Teşekkür konuşması', fx: { m: 14, fame: 0.04, t: -8 }, text: '“24 saat en kısası” dendi, chat alkışa boğdu.' },
    ],
  },

  // ------------------------------------------------------------ maç içi
  {
    id: 'ward-yok', phase: 'match', art: { item: 'ward_observer' },
    title: 'Takım arkadaşı ward almadı',
    text: 'Harita kapkaranlık; rakip her ağacın arkasından çıkıyor.',
    choices: [
      { label: 'Ward’ı sen al', fx: { e: -2, win: 0.06, m: 4 }, text: 'Destek ruhu! Harita aydınlandı, chat takdir etti.' },
      { label: 'Ping at, sabret', fx: { t: 6, win: -0.04, m: 2 }, text: 'Ping sesi yankılandı. Ward hâlâ yok.' },
    ],
  },
  {
    id: 'rapier', phase: 'match', art: { item: 'rapier' },
    title: 'Rapier düştü!',
    text: 'Takımın carry’si Rapier’le daldı… ve Rapier yerde kaldı.',
    choices: [
      {
        label: 'Koş, Rapier’i kap!', chance: 0.5,
        ok: { fx: { win: 0.22, hype: 0.35, m: 12, fame: 0.02 }, text: 'Rapier artık sende! Chat ayakta.' },
        no: { fx: { win: -0.2, t: 12, dog: 1 }, text: 'Rakip daha hızlıydı. DOG DOG DOG!' },
      },
      { label: 'Geri çekil, base’i koru', fx: { win: -0.06, t: 4 }, text: 'Rapier rakipte, ama base hâlâ ayakta.' },
    ],
  },
  {
    id: 'kurye', phase: 'match', art: { item: 'courier' },
    title: 'Kurye öldü',
    text: 'Kurye, BKB’yi taşırken nehirde pusuya düştü.',
    choices: [
      { label: 'Chat’le kurye için saygı duruşu', fx: { m: 9, t: 3 }, text: 'Chat’te “F” yağmuru. Kurye unutulmayacak.' },
      { label: 'Olsun, eşyayı yeniden sırala', fx: { win: -0.03, t: -2 }, text: 'Soğukkanlılık: BKB bir dakika gecikmeli geliyor.' },
    ],
  },
  {
    id: 'techies', phase: 'match', art: { hero: 'techies' },
    title: 'Rakip Techies seçti',
    text: 'Harita birazdan mayın tarlasına dönecek.',
    choices: [
      { label: 'Sentry ve Gem al', fx: { e: -2, win: 0.06 }, text: 'Mayınlar tek tek temizlendi. Techies üzgün.' },
      {
        label: 'Gözü kara dal', chance: 0.4,
        ok: { fx: { win: 0.1, hype: 0.25, m: 6 }, text: 'Mayınların arasından dans ederek geçtin!' },
        no: { fx: { win: -0.1, t: 10, m: 6 }, text: 'Bum. Chat patlamaları sevdi, sen o kadar değil.' },
      },
    ],
  },
  {
    id: 'hook', phase: 'match', art: { hero: 'pudge' },
    title: 'Pudge hook’u sisten tuttu',
    text: 'Kanca ağaçların arasından geldi ve tam isabet.',
    choices: [
      { label: 'Klibi chat’e at', fx: { m: 8, hype: 0.12, t: 4 }, text: 'Klip üç saniyede yayıldı. Chat: “o açı neydi”.' },
      { label: 'Derin nefes', fx: { t: -4 }, text: 'Sakinlik korundu. Sıradaki kanca ıskalayacak.' },
    ],
  },
  {
    id: 'roshan', phase: 'match', art: { item: 'aegis' },
    title: 'Roshan zamanı',
    text: 'Takım Roshan çukurunun önünde toplandı.',
    choices: [
      {
        label: 'Smoke’la Roshan’a gir', chance: 0.6,
        ok: { fx: { win: 0.16, hype: 0.15, m: 6 }, text: 'Aegis alındı! Ölümsüzlük bir seferliğine sizde.' },
        no: { fx: { win: -0.14, t: 10 }, text: 'Roshan çalındı. Rakip Aegis’le gülümsüyor.' },
      },
      { label: 'Önce kuleleri it', fx: { win: 0.05, e: -2 }, text: 'Harita genişledi, Roshan bekleyebilir.' },
    ],
  },
  {
    id: 'mid-iki', phase: 'match', art: { icon: 'swords' },
    title: 'Mid’e ikinci kişi geldi',
    text: 'Takım arkadaşı “ben de mid” diyerek koridora yerleşti.',
    choices: [
      { label: 'Farm’ı paylaş', fx: { win: 0.02, m: 5 }, text: 'Centilmenlik kazandı. Chat: “nezaket 10/10”.' },
      { label: 'Nazikçe ormana yönlendir', fx: { win: 0.05, t: -2, m: 2 }, text: 'İkna oldu, ormanda mutlu mutlu farm yapıyor.' },
    ],
  },
  {
    id: 'pause', phase: 'match', art: { icon: 'pause' },
    title: 'Rakip pause attı',
    text: 'Maç durdu. Bekleyiş başladı.',
    choices: [
      { label: 'Chat’le muhabbet', fx: { m: 9, e: -2 }, text: 'Pause sohbet saatine döndü. Chat mutlu.' },
      { label: 'Su iç, esne', fx: { e: 7, t: -3 }, text: 'Bir yudum su, iki esneme. Enerji yerinde.' },
    ],
  },
  {
    id: 'buyback', phase: 'match', art: { icon: 'skull' },
    title: 'Buyback yokken savaş',
    text: 'Takım buyback’siz, high ground’un dibinde savaşa girdi.',
    choices: [
      {
        label: 'Arkalarından dal', chance: 0.45,
        ok: { fx: { win: 0.14, hype: 0.2, m: 8 }, text: 'Savaş döndü! Takım inanamıyor.' },
        no: { fx: { win: -0.14, dog: 1 }, text: 'Beş kişi birden gri ekran. DOG DOG DOG!' },
      },
      { label: 'Base’te bekle', fx: { win: -0.04, t: 5 }, text: 'Dört kişi düştü, sen hayattasın. Hikâye yarım.' },
    ],
  },
  {
    id: 'dc', phase: 'match', art: { icon: 'bolt' },
    title: 'Takım arkadaşı düştü',
    text: 'Bağlantısı koptu; takım 4v5 kaldı.',
    choices: [
      { label: '4v5 devam, sen taşı', fx: { win: -0.1, hype: 0.12, m: 6 }, text: 'Chat: “1vDOQUZ antrenmanı başladı”.' },
      { label: 'Bekleme müziği aç', fx: { m: 7, e: 2 }, text: 'Müzik güzel, chat dans ediyor. Arkadaş geri döndü.', },
    ],
  },
  {
    id: 'smurf', phase: 'match', art: { icon: 'eye' },
    title: 'Rakipte smurf var',
    text: 'Yeni hesap, dört yüz last hit. Tesadüf olamaz.',
    choices: [
      { label: 'Profilini chat’e göster', fx: { m: 6, t: 4 }, text: 'Chat dedektif kesildi. Teori üstüne teori.' },
      {
        label: 'Onu 1v1’e çağır', chance: 0.35,
        ok: { fx: { hype: 0.35, m: 10, win: 0.1 }, text: '1v1’i kazandın! Smurf bile tebrik etti.' },
        no: { fx: { t: 10, win: -0.08 }, text: 'Smurf, smurf’luğunu yaptı. Rövanş bir dahaki maça.' },
      },
    ],
  },
  {
    id: 'tango', phase: 'match', art: { item: 'tango' },
    title: 'Support tango paylaştı',
    text: 'Support’un son tangosu sana geldi.',
    choices: [
      { label: 'Teşekkür et', fx: { win: 0.04, m: 4 }, text: 'Küçük jest, büyük takım ruhu.' },
      { label: 'Tangoyu geri ver', fx: { m: 8, win: 0.02 }, text: 'Chat: “saygı”. Support duygulandı.' },
    ],
  },
  {
    id: 'smoke', phase: 'match', art: { item: 'smoke_of_deceit' },
    title: 'Smoke’lu gank',
    text: 'Takım sis bulutuna girdi; hedef rakip carry.',
    choices: [
      {
        label: 'Sen başlat', chance: 0.55,
        ok: { fx: { win: 0.14, hype: 0.15, m: 6 }, text: 'Kusursuz başlangıç! Carry’nin eşyaları gecikti.' },
        no: { fx: { win: -0.1, dog: 1 }, text: 'Smoke bozuldu, herkes farklı yöne koştu. DOG DOG DOG!' },
      },
      { label: 'Takımı bekle', fx: { win: 0.04 }, text: 'Sabırlı gank, temiz sonuç.' },
    ],
  },
  {
    id: 'tp', phase: 'match', art: { item: 'tpscroll' },
    title: 'TP’siz kaldın',
    text: 'Kule saldırı altında, cebinde TP yok.',
    choices: [
      { label: 'Koşarak git', fx: { win: -0.05, e: -3 }, text: 'Vardığında kule çoktan gitmişti.' },
      { label: 'Kuryeyle TP getirt', fx: { win: 0.01, t: 2 }, text: 'Kurye yetişti, sen de yetiştin. Kıl payı.' },
    ],
  },
  {
    id: 'highground', phase: 'match', art: { icon: 'shield' },
    title: 'High ground savaşı',
    text: 'Rakip üsse dayandınız; kuleler hâlâ sağlam.',
    choices: [
      {
        label: 'Dal!', chance: 0.5,
        ok: { fx: { win: 0.2, hype: 0.2, m: 6 }, text: 'Bariyerler yıkıldı, maç kapanıyor!' },
        no: { fx: { win: -0.15, t: 8 }, text: 'Eli boş dönüldü. Rakip nefes aldı.' },
      },
      { label: 'Sabret, Aegis bekle', fx: { win: 0.06, e: -3 }, text: 'Sabır kazandırır. Roshan’dan sonra geri gelirsiniz.' },
    ],
  },
  {
    id: 'gem', phase: 'match', art: { item: 'gem' },
    title: 'Rakip Gem aldı',
    text: 'Bütün ward’lar birer birer sökülüyor.',
    choices: [
      {
        label: 'Gem’i düşür', chance: 0.4,
        ok: { fx: { win: 0.12, m: 8 }, text: 'Gem artık sizin! Harita yeniden karanlık… onlar için.' },
        no: { fx: { t: 7, win: -0.04 }, text: 'Gem taşıyıcısı çok dikkatli. Bir dahaki sefere.' },
      },
      { label: 'Dikkatli oyna', fx: { win: -0.02, t: -2 }, text: 'Az ward, çok sabır.' },
    ],
  },

  // ------------------------------------------------------------ yayın / her an
  {
    id: 'uyu-artik', phase: 'any', hours: [1, 8], art: { icon: 'moon' }, weight: 1.6,
    title: 'Chat “uyu artık” diyor',
    text: 'Birkaç izleyici endişeli: “gözlerin kapanıyor gibi”.',
    choices: [
      { label: 'Kısa şekerleme (45 dk)', fx: { e: 34, t: -12, m: -4, v: -0.18, away: 45 }, text: 'Kısa bir uyku, büyük fark. Chat nöbet tuttu.' },
      { label: '“24 saat en kısası” de, devam', fx: { m: 10, e: -6, hype: 0.12 }, text: 'Chat: “efsane”. Maraton ruhu tavan.' },
    ],
  },
  {
    id: 'internet', phase: 'any', art: { icon: 'bolt' },
    title: 'İnternet koptu',
    text: 'Yayın dondu; chat “F” yazıyor.',
    choices: [
      { label: 'Modemi yeniden başlat', fx: { v: -0.12, m: -4, away: 15 }, text: 'On beş dakika sonra yayın geri geldi.' },
      {
        label: 'Telefondan paylaşım aç', chance: 0.6,
        ok: { fx: { m: 8, fame: 0.01 }, text: 'Bir dakikada geri döndün. Chat: “mühendis”.' },
        no: { fx: { v: -0.15, t: 8, away: 25 }, text: 'Telefon da pes etti. Uzun bir bekleyiş…' },
      },
    ],
  },
  {
    id: 'destek', phase: 'any', art: { item: 'bottle' },
    title: 'Büyük bir destek geldi',
    text: 'Bir izleyici destek olup yazdı: “1vDOQUZ görmek istiyorum!”',
    choices: [
      { label: 'Teşekkür et, söz ver', fx: { m: 12, hype: 0.15, e: 4 }, text: 'Söz verildi. Chat’te sabırsız bir bekleyiş.' },
      { label: 'Onun adına maç at', fx: { m: 8, fame: 0.02, t: -3 }, text: 'Maç ona ithaf edildi. Destekçi mutlu.' },
    ],
  },
  {
    id: 'raid', phase: 'any', art: { icon: 'kick' },
    title: 'Raid geldi!',
    text: 'Başka bir Kick yayını izleyicileriyle birlikte uğradı.',
    choices: [
      { label: 'Hoş geldin maçı!', fx: { hype: 0.55, m: 10, e: -4 }, text: 'Yeni gelenler kaldı; chat bir anda doldu.' },
      { label: 'Selam ver, sakin devam', fx: { hype: 0.3, m: 5 }, text: 'Kibar bir selam, sıcak bir karşılama.' },
    ],
  },
  {
    id: 'klavye', phase: 'any', art: { icon: 'keyboard' },
    title: 'Klavye tuşu takıldı',
    text: 'Q tuşu inatla basılı kalıyor.',
    choices: [
      { label: 'Yedek klavyeyi tak', fx: { t: -2, away: 8 }, text: 'Yedek klavye tık tık hazır.' },
      { label: 'Takılı tuşla devam', fx: { win: -0.06, m: 7 }, text: 'Chat: “Q’suz Invoker challenge”. Eğlenceli ama zor.' },
    ],
  },
  {
    id: 'yama', phase: 'any', art: { item: 'tome_of_knowledge' },
    title: 'Sürpriz yama çıktı',
    text: 'Dota’ya yeni yama geldi, notlar upuzun.',
    choices: [
      { label: 'Chat’le yama notu oku', fx: { m: 10, e: -4, fame: 0.02 }, text: 'Her değişikliğe bir yorum. Chat bilgilendi.' },
      { label: 'Güncelle ve devam', fx: { away: 10, t: -2 }, text: 'Güncelleme bitti, yeni meta seni bekliyor.' },
    ],
  },
  {
    id: 'tartisma', phase: 'any', art: { icon: 'chat' },
    title: 'Chat’te tartışma',
    text: 'İki izleyici “en iyi carry kim” tartışmasına girdi.',
    choices: [
      { label: 'Nazikçe konuyu değiştir', fx: { m: 8, e: -2 }, text: 'Chat yeniden sakin ve keyifli.' },
      { label: 'Anket aç: kim haklı?', fx: { m: 12, hype: 0.08, t: 3 }, text: 'Anket kapandı: berabere. Herkes mutlu.' },
    ],
  },
  {
    id: 'mikrofon', phase: 'any', art: { icon: 'mute' },
    title: 'Mikrofon kapalı kalmış',
    text: 'Chat on dakikadır “ses yok” yazıyor.',
    choices: [
      { label: 'Özür dile, enerjiyle aç', fx: { m: 5, e: -3 }, text: 'Ses geldi! Chat: “sonunda”.' },
      { label: 'Pandomim yayın şakası', fx: { m: 3, hype: 0.1 }, text: 'Birkaç dakika sessiz film. Chat kahkahalar içinde.' },
    ],
  },
  {
    id: 'klip', phase: 'any', need: { dogs: 1 }, art: { icon: 'share' },
    title: 'Klip yayıldı',
    text: 'Bir DOG DOG DOG anı sosyal medyada dolaşıyor.',
    choices: [
      { label: 'Yayında izle, birlikte gül', fx: { hype: 0.35, m: 10, fame: 0.04 }, text: 'Klipten gelenler chat’e “DOG DOG DOG” yazıyor.' },
      { label: 'Oyuna odaklan', fx: { hype: 0.2, t: -3 }, text: 'Klip kendi kendine büyüyor, sen maçtasın.' },
    ],
  },
  {
    id: 'ikinci-ruzgar', phase: 'any', need: { energyBelow: 35 }, art: { item: 'refresher' },
    title: 'İkinci rüzgâr',
    text: 'Yorgunluk bir anlığına dağıldı gibi.',
    choices: [
      { label: 'Fırsatı değerlendir', fx: { e: 12, t: -5 }, text: 'Enerji yerine oturdu. Bir maç daha!' },
      { label: 'Esneme hareketleri', fx: { e: 16, m: 2 }, text: 'Kollar yukarı, omuzlar geride. Yeniden hayat.' },
    ],
  },
  {
    id: 'goz-kapak', phase: 'any', need: { energyBelow: 22 }, art: { item: 'clarity' }, weight: 2,
    title: 'Göz kapakları ağırlaştı',
    text: 'Ekrandaki creep’ler çift görünmeye başladı.',
    choices: [
      { label: 'Yüzünü soğuk suyla yıka', fx: { e: 12, away: 5 }, text: 'Buz gibi su, pırıl pırıl gözler.' },
      { label: 'Çift demli çay', fx: { e: 16, t: 5 }, text: 'Çay ocağı kapanmaz. Enerji yükseldi, eller biraz titriyor.' },
    ],
  },
  {
    id: 'tilt-alarm', phase: 'any', need: { tiltAbove: 55 }, art: { item: 'faerie_fire' }, weight: 1.5,
    title: 'Chat “sakin” diyor',
    text: 'Üst üste kötü anlar; chat moral konuşması yapıyor.',
    choices: [
      { label: 'Chat’i dinle, derin nefes', fx: { t: -18, m: 6 }, text: 'Nefes al, nefes ver. Kafa yerine geldi.' },
      { label: '“Bu maç benim” de', fx: { t: -6, hype: 0.1, win: 0.04 }, text: 'Öz güven tavan. Chat sözünü tutmanı bekliyor.' },
    ],
  },
  {
    id: 'yeni-izleyici', phase: 'any', art: { icon: 'heart' },
    title: 'İlk kez gelen izleyici',
    text: '“Dota’ya yeni başladım, ne önerirsin?” diye soruyor.',
    choices: [
      { label: 'Uzun uzun anlat', fx: { m: 10, fame: 0.02, e: -3 }, text: 'Chat mini bir Dota okuluna döndü.' },
      { label: 'Kısa öneri: “last hit çalış”', fx: { m: 5 }, text: 'Kısa ve net. Yeni izleyici Last Hit Ustası’na koştu.' },
    ],
  },
  {
    id: 'dust', phase: 'match', art: { item: 'dust' },
    title: 'Görünmez rakip',
    text: 'Riki etrafında dolaşıyor; kimse göremiyor.',
    choices: [
      { label: 'Dust at', fx: { win: 0.06, e: -1 }, text: 'Toz bulutu ve bir çığlık: yakalandı!' },
      { label: 'Kuleye yaslan', fx: { win: -0.03, t: 4 }, text: 'Kule korudu ama farm durdu.' },
    ],
  },
];

// ------------------------------------------------------------------ chat
/** Uydurma, genel kullanıcı adları (gerçek kişilere ait değildir). */
export const MR_USERS = [
  'ward_sever', 'rosh_pit', 'kurye_gel', 'aegis_avcisi', 'tango_tayfa', 'gece_nobetcisi', 'cay_ocagi',
  'smoke_devriyesi', 'lasthit_usta', 'creep_dostu', 'rune_kapan', 'dog_alarm', 'sessiz_izleyici',
  'buyback_var', 'tp_hazir', 'mmr_avcisi', 'mid_ya_da_mid', 'orman_kedisi', 'blink_dagger',
  'bkb_bas', 'sun_strike', 'pause_bekcisi', 'derin_nefes', 'high_ground', 'mango_sever', 'deny_kral',
];

/** Bağlama göre chat satırları. */
export const MR_CHAT = {
  idle: ['maç ne zaman?', 'sıra uzun mu', 'hangi kahraman bu sefer?', 'lobi müziği güzelmiş', 'hadi bir maç', 'chat hazır, sen?', 'draft tahmini: mid'],
  match: ['draft güzel', 'creep’leri say', 'ward nerde ward', 'minimap’e bak', 'bu maç bizim', 'Roshan’a az kaldı', 'harita okuması 10/10', 'temiz last hit', 'o rotasyon neydi', 'BKB zamanı'],
  win: ['GG WP', 'temiz maç', '+25 geldi', 'MMR yükseliyor', 'işte bu!', 'bir tane daha', 'kazanan takım kazandı', 'GG'],
  loss: ['olur böyle', 'sıradaki bizim', 'GG, devam', 'hamleyi eleştir, kişiyi değil', 'derin nefes', 'bir sonraki maç dönüyor', 'tilt yok, devam'],
  dog: ['DOG DOG DOG', 'DOG DOG DOG', 'DOG DOG DOG', 'klip klip klip', 'DOG alarmı!', 'o hamle neydi', 'DOG DOG DOG!!'],
  quad: ['1vDOQUZ!!!', 'KLİP KLİP', 'tarih yazıldı', 'dokuz kişi de şaşkın', 'efsane', 'bunu anlatacağız', '1vDOQUZ 1vDOQUZ'],
  quadFail: ['denemek bedava', 'bir dahakine', '1vDOQUZ bir gün gelecek', 'cesaret 10/10', 'az kalsın'],
  night: ['uyu artık :)', 'saat kaç oldu', 'gece nöbetindeyiz', 'ben de uyumuyorum', 'çay demle', 'sabah oluyor', 'gece ekibi burada'],
  morning: ['günaydın!', 'kahvaltı yaptın mı', 'güneş doğdu, maraton sürüyor', 'işe gidiyorum, akşam buradayım', 'günaydın chat'],
  tea: ['kaçıncı çay bu', 'çay ocağı açık', 'demli olsun', 'enerji geri geldi', 'çay molası onaylandı'],
  away: ['5 dk dedi…', 'mola müziği', 'biz buradayız', 'su içmeyi unutma', 'bekliyoruz', '5 dk = 25 dk'],
  low: ['gözler kapanıyor', 'biraz mola?', 'çay çay çay', 'yorgun görünüyorsun', 'dayan, az kaldı'],
  tilt: ['sakin', 'derin nefes', 'chat seninle', 'kafayı soğut', 'bir mola iyi gelir'],
  hype: ['izleyici patlıyor', 'herkes buraya', 'hype hype', 'chat uçuyor', 'bu yayın efsane'],
  final: ['son düzlük', '24 saat en kısası', 'geri sayım başladı', 'finali kaçırmam', 'az kaldı!', 'maraton bitiyor'],
  reply: ['cevap verdi!', 'selam geldi', 'chat’i okuyor', 'teşekkürler!', 'soruma cevap geldi'],
};

// ------------------------------------------------------------------ bitiş unvanları
/**
 * Sonuç kartındaki eğlenceli unvan: sırayla ilk eşleşen verilir.
 * s: { done, hours, peak, wins, losses, dogs, teas, chats, breaks, quadOk, quadFail, mmr (değişim), bestStreak }
 */
export const MR_TITLES = [
  { name: '1vDOQUZ Efsanesi', desc: 'Dört ve üzeri 1vDOQUZ. Chat bunu yıllarca anlatacak.', when: (s) => s.quadOk >= 4 },
  { name: 'Kick Fenomeni', desc: 'Zirve izleyici göğü deldi.', when: (s) => s.done && s.peak >= 7000 },
  { name: 'DOG Mıknatısı', desc: 'Takım arkadaşları DOG’ladı, chat bayıldı.', when: (s) => s.dogs >= 14 },
  { name: 'MMR Makinesi', desc: 'Galibiyetler art arda geldi.', when: (s) => s.done && s.wins >= s.losses + 5 },
  { name: 'Çay Ocağı Sahibi', desc: 'Bu yayın çayla döndü.', when: (s) => s.teas >= 12 },
  { name: 'Chat’in Dostu', desc: 'Her soruya bir cevap.', when: (s) => s.chats >= 20 },
  { name: 'Molasız Maratoncu', desc: 'Yirmi dört saat, sıfır mola.', when: (s) => s.done && s.breaks === 0 },
  { name: 'Maraton Yayıncısı', desc: '24 saat tamam. Ve bu, en kısası.', when: (s) => s.done },
  { name: 'Gece Kuşu', desc: 'Gecenin en zor saatlerini aştın, finali göremedin.', when: (s) => s.hours >= 16 },
  { name: 'Yarım Maratoncu', desc: 'Yarı yolu geçtin. 24 saat seni bekliyor.', when: (s) => s.hours >= 10 },
  { name: 'Isınma Turu', desc: 'Her maraton bir çayla başlar.', when: () => true },
];
