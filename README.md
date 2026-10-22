# Lagom Architecture

Mimarlık portföyü ve içerik yönetim paneli. Tam ekran galeri, yazı içinden yakınlaşmalı açılış, proje/fotoğraf yönetimi ve ziyaretçi istek kutusu içerir.

## Yerel kurulum

Node.js 18 veya üzeri gereklidir. Harici Node bağımlılığı yoktur.

1. `.env.example` dosyasını `.env` adıyla kopyalayın.
2. `.env` dosyasında yönetici kullanıcı adı ve güçlü bir şifre belirleyin.
3. `npm start` çalıştırın.
4. Site: http://localhost:3000 — Yönetim: http://localhost:3000/admin

Swiper ve yazı tipleri tarayıcıda CDN üzerinden yüklenir.

## İçerik ve özel veriler

- `data/content.json`: Portföy içeriği.
- `uploads/`: Siteye eklenmiş portföy görselleri.
- `data/inquiries.json`: Özel müşteri talepleri; ilk çalıştırmada oluşturulur ve Git'e eklenmez.
- `.env`: Yerel giriş bilgileri; Git'e eklenmez.
- İçerik yedekleri ve eski kod kopyaları Git'e eklenmez.

`npm start` yerel Node sunucusunu başlatır. GitHub'a kod yüklemek siteyi otomatik olarak yayınlamaz. Sunuculu özellikler için Node.js destekleyen bir ortam ve kalıcı dosya alanı gerekir.

## Kontrol

```sh
node --test tests/intro-transition.test.cjs
```
