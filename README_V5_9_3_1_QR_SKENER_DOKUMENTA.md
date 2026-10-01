# FiscalBox V5.9.3.1 — QR 2.0 + automatski skener dokumenta

## QR skener

Prethodna verzija je koristila BarcodeDetector + jsQR + ZXing, ali bez aktivne promene zuma i bez dodatnog Worker QR engine-a.

V5.9.3.1 dodaje:
- `qr-scanner` Worker engine kao dodatni nezavisni čitač;
- ZXing QR-only TRY_HARDER konfiguraciju;
- hardverski auto-zoom kada kamera/browser izlažu `MediaStreamTrack` zoom capability;
- digitalni auto-zoom / centralni multi-crop fallback kada hardverski zoom nije dostupan;
- ručni zoom slider kada je podržan;
- kontinuirani autofocus / auto exposure gde uređaj to dozvoljava;
- više rezolucija i nivoa centralnog crop-a;
- dodatne kontrastne i threshold prolaze za blede termalne fiskalne račune;
- učitavanje fotografije kroz isti multi-engine pipeline.

## Skener dokumenta

Dugme "Skeniraj dokument" više ne pravi običnu fotografiju.

Novi tok:
1. Kamera automatski traži ivice papira.
2. Kada je dokument pronađen, prikazuje se zeleni četvorougao.
3. Kada je kadar stabilan nekoliko uzastopnih provera, snimanje se aktivira automatski.
4. Sistem radi perspective correction / ispravljanje trapezoida.
5. Automatski se kropuje dokument.
6. Radi se scanner-style kontrast / čišćenje pozadine.
7. Korisnik dobija pregled i tek onda upisuje naziv i čuva sken.
8. Postoji i "Skeniraj odmah" ako korisnik ne želi da čeka automatsko okidanje.

Ako ivice nisu dovoljno pouzdane, aplikacija ne čuva sirovu kameru: primenjuje bezbedni centralni crop i scanner enhancement, uz jasno upozorenje korisniku da proveri rezultat.

## Nove dependencies

- `qr-scanner ^1.4.2`
- `@zxing/library ^0.21.3`

## Baza

Nema novog SQL update-a.

## Deploy

1. Upload/commit cele verzije na GitHub.
2. Vercel će pri build-u povući nove npm dependency-je.
3. Deploy.
4. Na Android telefonu testirati Chrome/PWA sa zadnjom kamerom i pravim fiskalnim računima.
5. Ako se browser ranije odbio za kameru, u Site settings vratiti Camera = Allow.
