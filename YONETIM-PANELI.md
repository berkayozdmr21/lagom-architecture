# Lagom yönetim paneli

## Siteyi başlatma

PowerShell'i bu klasörde açın ve aşağıdaki komutları çalıştırın:

```powershell
npm start
```

Ardından:

- Site: `http://localhost:3000`
- Yönetim paneli: `http://localhost:3000/admin`

Yönetici bilgileri yalnızca bu bilgisayardaki `.env` dosyasında saklanır ve GitHub'a gönderilmez. Yeni kurulumda `.env.example` dosyasını `.env` adıyla kopyalayıp kullanıcı adı ve şifreyi doldurun.

İnternete açık bir yayında bilgileri ortam değişkenleriyle değiştirebilirsiniz:

```powershell
$env:ADMIN_USERNAME="yeni-kullanici-adi"
$env:ADMIN_PASSWORD="yeni-guclu-sifre"
npm start
```

Canlı yayında mutlaka HTTPS kullanın.

## Panelin çalışma şekli

- **Yeni bölüm:** Ana sitede aşağı/yukarı kaydırılan yeni bir bölüm oluşturur.
- **Yeni proje:** Seçilen bölümün içine yeni proje ekler.
- **Fotoğraf seç:** Projeye bir veya birden fazla JPG, PNG veya WebP ekler.
- **Ok düğmeleri:** Bölüm, proje veya fotoğraf sırasını değiştirir.
- **× düğmesi:** İlgili içeriği kaldırır.
- **Değişiklikleri kaydet:** Yapılan düzenlemeleri ana siteye aktarır.

Her kayıtta önceki içerik otomatik olarak `data/content.backup.json` dosyasına yedeklenir. Galeriden kaldırılan yüklenmiş fotoğraflar güvenlik amacıyla diskten otomatik silinmez.
