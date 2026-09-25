# DOG Bingo (`bingo`)

**Rota:** `#oyunlar--bingo` · **Tür:** Yayın · Etkileşim · **Skor:** çizgi (0–12, yüksek iyi)
**Dosyalar:** `src/sections/games/bingo.js`, `src/sections/games/bingo.css`, `src/data/bingo.js`

## Fikir

En kısa yayının bile 24 saat sürdüğü maratonlarda izleyicinin yayını “oynaması” için 5×5 yayın bingosu.
Kartta Dota pub anları (takım, rakip, efsane) ve yayın/chat anları var; izleyici olan anı işaretler,
satır/sütun/çapraz tamamlanınca **BINGO!** damgası vurulur. Oyun bitmez: kart yayın boyunca açık kalır,
izleyici istediği zaman dönüp işaretlemeye devam eder.

## Kurallar

- Kart 25 hücre; ortadaki **DOG DOG DOG** bedava hücredir ve baştan işaretlidir.
- Yayında olan anı bul, hücreye dokun ya da tıkla: hücre mürekkep damgasıyla işaretlenir, saat (SS:DD)
  hücreye ve **Maç günlüğü**ne düşer. Yanlış dokunuş tekrar dokunarak ya da **Geri al** ile kaldırılır.
- 5 satır + 5 sütun + 2 çapraz = 12 çizgi. Yeni tamamlanan çizgi: `BINGO!` damgası, konfeti, zafer sesi,
  hücrelerde altın vurgu ve kartın üstünde altın şerit. Aynı anda iki çizgi: `ÇİFTE BINGO!`.
  Bütün kart (tam kart): `TAM KART!` ve 12 çizgi.
- **Skor = karttaki tamamlanmış çizgi sayısı.** Sayı arttığı her an `submitResult` ile gönderilir;
  profil yalnızca en iyisini tutar (`higherIsBetter: true`). İşaret kaldırınca çizgi düşebilir; rekor düşmez.

## Kart kodu

- Her kart 6 karakterlik bir koddan üretilir. Alfabe karışabilecek karakterleri içermez
  (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`: O/0, I/1/L yok) → ~887 milyon kart.
- Üretim deterministiktir: `seeded(hashStr('dog-bingo:<deste>:<kod>'))` (mulberry32 + FNV-1a,
  `src/core/dom.js`). Aynı kodu yükleyen herkes aynı kartı görür; arkadaşınla ya da chat’le paylaşılabilir.
- **Denge:** 24 olay beş kategoriden 5-5-5-5-4 dağılır (4 alan kategori koda göre değişir).
  Yerleşim, tohumlu 40 permütasyon içinden aynı kategorinin bir çizgide en az tekrar ettiği seçilerek yapılır.
- Olay bankasına ekleme yapılırsa eski kodların ürettiği kartlar değişir. Bunu bilinçli yapmak için
  `BINGO_DECK` sürüm numarası tohumun parçasıdır; bankayı değiştirince artırın.

## Denetimler

| Denetim | İş |
|---|---|
| **Yeni kart** | Rastgele kod; işaret varsa önce sayfa içi onay (`fx.confirm`) |
| **Kod · XXXXXX** | Kodu panoya kopyalar (`copyText`: try/catch, olmazsa kodu seçili bırakır ve söyler) |
| **Kod ile yükle** | Satır içi form; büyük harfe çevirir, boşluk/tire atar, 6 karakter + alfabe doğrular |
| **Yayın modu** | Kenar sütunu, başlık, HUD, karne ve günlüğü gizler; kartı ekrana sığacak kadar büyütür (ekran paylaşımı için). `Esc` kapatır. Tercih saklanır |
| **Tam ekran** | Yayın modunda, tarayıcı destekliyorsa yalnız kartı tam ekran yapar |
| **Geri al / Temizle** | Son işareti kaldır / kartı koruyup tüm işaretleri sil (onaylı) |

Klavye: hücreler tek sekme durağıdır (roving tabindex). `← ↑ → ↓` gezer (kenarda sarar), `Home`/`End`
satır başı/sonu, `Enter`/`Boşluk` işaretler. Her hücrenin `aria-pressed` durumu ve “B sütunu, 2. satır:
… (Takım), işaretli 21:34” gibi bir etiketi var; BINGO’lar `aria-live` ile duyurulur.

## Saklama

`localStorage` (`ls` yardımcı, `csk:` önekli):

- `bingo:v1` → `{ v, code, created, marks: { hücre: zaman }, order: [hücre…], peak }`
- `bingo:stream` → yayın modu açık mı

Aynı kart iki sekmede açıksa `storage` olayıyla eşitlenir. Sayfa yenilenince kart, işaretler, saatler ve
çizgiler aynen gelir (çizgi animasyonu tekrar oynamaz, damga tekrar basılmaz).

## Ekran

- Sol: bilet (başlık, **B I N G O** harfleri, 5×5 ızgara, kategori açıklaması). Hücrede kategori rengi
  şeridi, geniş kartta kategori ikonu ve işaret saati. Hücre yazısı kapsayıcı sorgu birimiyle
  (`cqi`) ölçeklenir, en fazla 4–5 satır (line-clamp).
- Sağ: **Kart karnesi** (büyük çizgi sayısı, işaretli/kalan/kart yaşı, doluluk çubuğu, esprili yorum)
  ve **Maç günlüğü** (en yeni üstte; BINGO satırları altın).
- HUD: Çizgi `n/12`, İşaret `n/25`, BINGO’ya kalan en az hücre, Rekor.
- 390 px: ızgara ekrana sığar (hücre ~65 px, yazı 10 px, kategori ikonu ve saat gizli), yatay taşma yok.

## İçerik kuralları

`src/data/bingo.js`: 56 olay, 5 kategori (Takım 12, Rakip 11, Yayın 11, Chat 11, Efsane 11).
Metinler ≤ 34 karakter. Ton oyunbaz ve saygılı; kişileri değil hamleleri hedef alır. Yayıncı hakkında
yalnızca Kick, Dota 2, “DOG DOG DOG”, “1vDOQUZ” ve en kısa yayının 24 saat olması kullanılır; olaylar
“olabilecek” anlardır, kimseye alışkanlık yakıştırılmaz.

## Test notları (Playwright, dev sunucusu :5183)

Masaüstü 1440×900 ve mobil 390×844 (`isMobile`, `hasTouch`) — konsol hatası 0, yatay taşma 0:

- İlk ziyarette başlangıç kartı → “Kartımı ver”; kod biçimi, 25 hücre, bedava merkez.
- Satır 1 → `BINGO!` damgası, 5 hücre vurgulu, 1 şerit; çapraz → 2. `BINGO!`, 9 vurgulu hücre, 2 şerit,
  HUD 2/12, rekor 2 çizgi, `csk:me` içinde `scores.bingo = 2`, günlükte 2 BINGO + 8 işaret + açılış.
- Klavye: oklar (sarma dahil), Enter işaretler, Boşluk kaldırır, tek sekme durağı.
- Yenileme sonrası kod, 9 işaret, 2 şerit korunuyor; animasyon tekrar oynamıyor.
- Geri al son işareti kaldırıp çaprazı bozuyor; kopyalama toast’ı ve pano içeriği doğru.
- Geçersiz kod hatası; `k7m2qx` → onay → `K7M2QX` kartı; ikinci tarayıcı bağlamında aynı kod aynı kartı
  veriyor; kategori dağılımı 4-5-5-5-5.
- Yeni kart onayı; yayın modu (kenar sütun gizli, taşma yok, `Esc` kapatır); tam kart → 12/12.
