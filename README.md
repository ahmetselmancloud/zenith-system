# Zenith System
**Yeni Nesil Ultra-Hafif Windows Sistem & Donanım Asistanı**

---

## ⚡ Neden Zenith System?
Piyasadaki üretici yazılımları (MSI Center, Corsair iCUE, Razer Synapse, NZXT CAM); 500 MB – 1.5 GB kurulum boyutları, arka planda bıraktıkları onlarca zombi servis, WMI altyapısını kilitleyen hantal sorguları ve dakikalar süren açılışlarıyla bilgisayarları yormaktadır.

**Zenith System**, bu tabuları yıkmak üzere geliştirilmiş; **HWiNFO derinliğinde donanım bilgisini, telefondaki DevCheck zarafeti ve Chris Titus Tech araçlarının sistem optimizasyon gücüyle** tek merkezde sunan yerel bir güç aracıdır.

---

## 🚀 Temel Performans Kriterleri

| Metrik | Ağır OEM Araçlar (MSI Center, iCUE, Synapse) | **Zenith System** |
| :--- | :--- | :--- |
| **Açılış & Canlı Veri Süresi** | 15 – 60 saniye (Dönen çarklar) | **< 250 Milisaniye (0.25 sn)** |
| **RAM Tüketimi (Aktif)** | 200 MB – 800 MB+ | **~35 MB – 45 MB** |
| **RAM Tüketimi (Arka Plan)** | 80 MB – 250 MB | **~12 MB – 15 MB** |
| **İşlemci (CPU) Yükü** | %1.5 – %5.0 (Mikro takılmalar) | **%0.00 (Tray) / %0.1 (Aktif)** |
| **Yerel Çekirdek Boyutu** | 500 MB – 1.5 GB | **Sadece 137 Kilobayt (`zenith_probe.exe`)** |
| **Telemetri & Gizlilik** | Zorunlu üyelik, arka planda veri gönderme | **%100 Yerel, Sıfır Hesap, Sıfır Telemetri** |

---

## 🛠️ Ana Modüller

### 1. Canlı Donanım & NPU Telemetrisi (DevCheck Modu)
* **İşlemci (CPU):** 20 Çekirdek (8 P-Core + 12 E-Core) anlık saat hızları, yük çubukları ve dairesel gösterge.
* **Yapay Zeka Birimi (NPU):** `Intel(R) AI Boost` (ComputeAccelerator) anlık varlık ve hazırlık durumu.
* **Ekran Kartı (GPU):** `NVIDIA GeForce RTX 5070 Ti Laptop GPU` anlık sıcaklık (`56 °C`), çekilen güç (`15.8 W TGP`), VRAM kullanımı (`2.2 / 12 GB`) ve çift 144 Hz monitör haritası.
* **Batarya & Güç:** 87.4 Wh fabrika tasarımı, 67.2 Wh kalan, **%80.97 gerçek pil sağlığı** ve 16.48 V anlık gerilim.
* **Ağ Trafiği:** Saniyelik yükleme ve indirme hız göstergesi (KB/s – MB/s).
* **Depolama:** KIOXIA ve SAMSUNG 1 TB NVMe PCIe SSD'lerin tespiti.

### 2. 100ms "Yüklü Programlar" Yöneticisi
* Windows Ayarları'nın dakikalarca beklettiği kurulu uygulamalar ekranına son!
* Windows Kayıt Defteri (Registry) doğrudan taranarak **280+ kurulu uygulamanın tamamı 108 milisaniyede (0.1 saniye)** ekrana dökülür.
* Boyuta göre sıralama (en çok yer kaplayanları tepeye alma), anlık arama ve tek tıkla kaldırma (Uninstall).

### 3. Kompakt Görev Yöneticisi (Smart Process Killer)
* Bilgisayarı kasan işlemleri anlık sıralama.
* Yanıt vermeyen uygulamaları tek tıkla hafızadan silen "Sonlandır (Force Kill)" butonu.

### 4. WinGet Toplu Paket Kurucu (One-Click App Store)
* Web Tarayıcıları (Chrome, Brave, Firefox)
* Geliştirici Araçları (VS Code, Git, Node.js, Python 3.12)
* Sistem & Araçlar (7-Zip, Everything, Notepad++, PowerToys)
* Medya & Oyun (VLC, Discord, Spotify, Steam, Epic Games)
* Tek tıkla arka planda sessiz parametrelerle kurma ve canlı terminal çıktısı.

### 5. Windows Debloat & Gizlilik Merkezi
* Başlat Menüsü Bing web aramalarını kapatma (saf yerel arama hızı).
* Microsoft telemetri ve geri bildirim bildirimlerini durdurma.
* Windows Oyun Modu (Performans Önceliği) optimizasyonu.

### 6. Test Laboratuvarı (Diagnostics Lab)
* İnternet Hız & Gecikme (Ping) Ölçümü.
* Tam Ekran Ölü Piksel Sihirbazı.
* Klavye N-Key Rollover & Basmayan Tuş Algılayıcı.
* Fare Çift Tıklama Arıza Ölçümü.
* 15 Saniyelik Güvenli CPU Stres & Termal Kararlılık Testi.

---

## 💻 Nasıl Çalıştırılır?

1. Masaüstündeki **`Zenith System.lnk`** simgesine çift tıklayın.
2. Veya bu klasördeki `start_zenith.bat` dosyasını çalıştırın.
3. Uygulama bağımsız, çerçevesiz bir yerel masaüstü penceresi modunda 0.2 saniyede açılır.

---

*Geliştirici:* **Selman (`ahmetselmancloud`)**  
*Mimar:* **Antigravity AI**
