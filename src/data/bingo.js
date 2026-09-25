// DOG Bingo olay bankası — 24 saatlik yayınlarda izleyicinin işaretlediği Dota pub ve yayın anları.
//
// Kurallar:
// - Ton oyunbaz ve saygılı: kişileri değil hamleleri hedef alır, küfür yok.
// - Yayıncı hakkında yalnızca bilinenler: Kick, Dota 2, “DOG DOG DOG”, “1vDOQUZ” ve en kısa yayının
//   bile 24 saat sürmesi. Olaylar “olabilecek” anlardır; kimseye alışkanlık yakıştırılmaz.
// - Metinler kısa tutulur (≤ ~34 karakter): 390 px ekranda 5×5 hücreye sığmalı.
// - `id`'ler kalıcıdır (kaydedilmiş kartlar ve günlük bunlara bağlı). Yeni olay eklemek kart kodlarının
//   ürettiği kartları değiştirir; bu yüzden kart kodu bir deste sürümü taşır (BINGO_DECK).

export const BINGO_DECK = 1;

/** Kategori sırası kart dengesinde kullanılır. */
export const BINGO_CATS = [
  { id: 'takim', label: 'Takım', icon: 'shield', color: 'var(--radiant)' },
  { id: 'rakip', label: 'Rakip', icon: 'swords', color: 'var(--dire)' },
  { id: 'yayin', label: 'Yayın', icon: 'kick', color: 'var(--kick)' },
  { id: 'chat', label: 'Chat', icon: 'chat', color: 'var(--arcane)' },
  { id: 'efsane', label: 'Efsane', icon: 'crown', color: 'var(--aegis)' },
];

/** Ortadaki bedava hücre: kart açılır açılmaz işaretlidir. */
export const BINGO_FREE = {
  id: 'free',
  cat: 'efsane',
  text: 'DOG DOG DOG',
  note: 'Bedava hücre. Bu sesi duymadan yayın başlamış sayılmaz.',
};

export const BINGO_EVENTS = [
  // ------------------------------------------------------------ Takım
  { id: 'ward-yok', cat: 'takim', text: 'Takım arkadaşı ward almadı' },
  { id: 'aegis-yerde', cat: 'takim', text: 'Roshan kesildi, Aegis yerde kaldı' },
  { id: 'buyback-yok', cat: 'takim', text: 'Buyback yokken savaşa girildi' },
  { id: 'smoke-bos', cat: 'takim', text: 'Smoke’lu gank boşa gitti' },
  { id: 'mid-iki', cat: 'takim', text: 'Mid’e ikinci kişi geldi' },
  { id: 'kurye', cat: 'takim', text: 'Kurye yolda pusuya düştü' },
  { id: 'pause', cat: 'takim', text: 'Maç ortasında pause istendi' },
  { id: 'tp-yok', cat: 'takim', text: 'TP’siz koridora gidildi' },
  { id: 'ters-tp', cat: 'takim', text: 'Yanlış kuleye TP atıldı' },
  { id: 'orman-carry', cat: 'takim', text: 'Carry 25. dakikada hâlâ ormanda' },
  { id: 'bkb-yok', cat: 'takim', text: 'BKB’siz Chrono’ya dalındı' },
  { id: 'iki-ayni', cat: 'takim', text: 'Aynı eşyayı iki kişi aldı' },

  // ------------------------------------------------------------ Rakip
  { id: 'rosh-calindi', cat: 'rakip', text: 'Roshan çalındı' },
  { id: 'techies', cat: 'rakip', text: 'Techies seçildi' },
  { id: 'hook', cat: 'rakip', text: 'Pudge hook’u sisin içinden tuttu' },
  { id: 'erken-gg', cat: 'rakip', text: 'Erken “gg” yazan takım kaybetti' },
  { id: 'hg-geri', cat: 'rakip', text: 'High ground’dan eli boş dönüldü' },
  { id: 'ayni-yer', cat: 'rakip', text: 'Aynı ağacın arkasında üçüncü ölüm' },
  { id: 'sunstrike', cat: 'rakip', text: 'Haritanın öbür ucundan Sun Strike' },
  { id: 'dust', cat: 'rakip', text: 'Görünmez rakip Dust’la yakalandı' },
  { id: 'alti-slot', cat: 'rakip', text: 'Rakip carry altı slot oldu' },
  { id: 'deward', cat: 'rakip', text: 'Ward dikilir dikilmez söküldü' },
  { id: 'tiny-toss', cat: 'rakip', text: 'Kuleye Toss’la biri fırlatıldı' },

  // ------------------------------------------------------------ Yayın
  { id: 'saat-24', cat: 'yayin', text: 'Yayın 24. saati devirdi' },
  { id: 'saat-12', cat: 'yayin', text: 'Yayın 12. saate ulaştı' },
  { id: 'gece-yarisi', cat: 'yayin', text: 'Yayında saat 00:00’ı geçti' },
  { id: 'dog-iki', cat: 'yayin', text: 'Bir maçta iki kez “DOG DOG DOG”' },
  { id: 'kick-alarm', cat: 'yayin', text: 'Kick’te yeni takipçi alarmı' },
  { id: 'kuyruk', cat: 'yayin', text: 'Maç bulma 5 dakikayı geçti' },
  { id: 'altmis', cat: 'yayin', text: 'Maç 60. dakikayı gördü' },
  { id: 'seri', cat: 'yayin', text: 'Üç maçlık galibiyet serisi' },
  { id: 'random', cat: 'yayin', text: 'Pick ekranında Random basıldı' },
  { id: 'son-saniye', cat: 'yayin', text: 'Kahraman son saniyede seçildi' },
  { id: 'replay', cat: 'yayin', text: 'Bir savaş tekrar izlendi' },

  // ------------------------------------------------------------ Chat
  { id: 'chat-1v9', cat: 'chat', text: 'Chat’te 1vDOQUZ yağmuru' },
  { id: 'chat-dog', cat: 'chat', text: 'Chat üst üste “DOG” yazdı' },
  { id: 'chat-build', cat: 'chat', text: 'Chat eşya dizilimi önerdi' },
  { id: 'chat-ward', cat: 'chat', text: 'Chat “ward al” diye hatırlattı' },
  { id: 'chat-gg', cat: 'chat', text: 'Chat erken GG dedi' },
  { id: 'chat-ilk', cat: 'chat', text: '“İlk kez izliyorum” mesajı' },
  { id: 'chat-rosh', cat: 'chat', text: 'Chat Roshan saatini hatırlattı' },
  { id: 'chat-saat', cat: 'chat', text: 'Biri “kaçıncı saat?” diye sordu' },
  { id: 'chat-tahmin', cat: 'chat', text: 'Chat’in maç tahmini tuttu' },
  { id: 'chat-emote', cat: 'chat', text: 'Chat emote seline döndü' },
  { id: 'chat-kahraman', cat: 'chat', text: 'Chat bir sonraki kahramanı seçti' },

  // ------------------------------------------------------------ Efsane
  { id: '1vdoquz', cat: 'efsane', text: '1vDOQUZ anı' },
  { id: 'rapier', cat: 'efsane', text: 'Rapier düştü' },
  { id: 'megacreep', cat: 'efsane', text: 'Megacreep’e karşı geri dönüş' },
  { id: 'rampage', cat: 'efsane', text: 'Rampage!' },
  { id: 'ancient-1hp', cat: 'efsane', text: 'Ancient son anda kurtuldu' },
  { id: 'besli-ult', cat: 'efsane', text: 'Beş kişiyi yakalayan ultimate' },
  { id: 'aegis-snipe', cat: 'efsane', text: 'Aegis rakibin elinden kapıldı' },
  { id: 'tek-savunma', cat: 'efsane', text: 'Üsse tek başına savunma' },
  { id: 'buyback-kurtar', cat: 'efsane', text: 'Buyback maçı kurtardı' },
  { id: 'kule-deny', cat: 'efsane', text: 'Son vuruşla kule deny edildi' },
  { id: 'comeback-20k', cat: 'efsane', text: '20 bin altın farktan dönüş' },
];

/** Kart karnesi için esprili yorumlar: çizgi sayısına göre. */
export const BINGO_QUIPS = [
  { min: 12, text: 'Tam kart. Bu yayında olmayan tek şey uyku.' },
  { min: 5, text: 'Kart yanıyor. Chat’e kartını göster, kıskansınlar.' },
  { min: 3, text: 'Hat trick. Artık kalem değil, marker kullanıyorsun.' },
  { min: 1, text: 'BINGO! Bir çizgi tamam; yayın daha yeni ısınıyor.' },
  { min: 0, text: 'Kart hazır, kalem hazır. Gerisi 24 saatlik yayına kalmış.' },
];
