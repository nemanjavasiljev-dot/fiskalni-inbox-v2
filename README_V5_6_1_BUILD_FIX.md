# FiscalBox V5.6.1 – Build fix

Ispravljena TypeScript build greška u `app/app/files/files-ui.tsx`.

Uzrok: `File` ikonica iz `lucide-react` je zasenila browser `File` konstruktor koji se koristi za preimenovanje uploadovanih dokumenata.

Ispravka: ikonica je aliasovana kao `FileIcon`, dok `new File(...)` ponovo koristi native browser `File` API.

Funkcionalnosti V5.6 (QR skener, skeniranje dokumenata, automatski crop, naziv dokumenta/fotografije i preimenovanje uploadovanog fajla) ostaju nepromenjene.
