# İlhan Kuzu Randevu

Aksoy Erkek Kuaförü için randevu uygulaması. Hesap gerekmez; dükkân şifresini bilen herkes açar,
randevular sunucuda tek listede durur (tablet, telefon hepsi aynı listeyi görür).

## Railway'de yayınlama
1. Railway → **New Project** → **Deploy from GitHub repo** → bu depoyu seçin.
2. (İsteğe bağlı) Şifreyi uygulama ilk açılışta kendisi sorar. İsterseniz **Variables** sekmesine `APP_PIN` de ekleyebilirsiniz.
3. Servise sağ tık → **Attach Volume** → mount path: `/data`.
   (Volume olmazsa her yeni yüklemede randevular silinir.)
4. **Settings → Networking → Generate Domain**. Çıkan adres uygulamanın linkidir.

Başlatma komutu `npm start` (Node 18+), ek paket yok.

## Telefona/tablete uygulama gibi ekleme
Linki Chrome'da (Android) ya da Safari'de (iPhone/iPad) açın → menü → **Ana ekrana ekle**.

## Sayfayı güncellemek
Kaynak `app-source.html`. Değiştirdikten sonra `sh build.sh` çalıştırın; `public/index.html` yenilenir.
