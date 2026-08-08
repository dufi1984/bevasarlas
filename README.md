# 🛒 Bevásárló Lista PWA (Valós Idejű Multi-Room & Web Push Értesítések)

Mobilra optimalizált, GitHub Gist alapon működő valós idejű bevásárlólista alkalmazás. Támogatja a független szobákat, PWA offline módot, VAPID Push értesítéseket és Google Auth alapú adminisztrációs felületet.

---

## 🏷️ Hivatalos Verziók (Git Releases)

- **`v1.0.0`** – Eredeti egyetlen nyilvános listát használó alkalmazás Gist szinkronnal és letisztult mobil UI-val.
- **`v2.0.0`** – Multi-Room szobakezelés, VAPID Web Push értesítések (5mp debounce), Cloudflare Worker integráció, PWA offline támogatás és Google Auth védett Adminisztrációs felület (`admin.html`).

---

## 🛠️ Szükséges Külső Szolgáltatások és Fiókok

Az alkalmazás teljes működéséhez az alábbi **3 ingyenes külső szolgáltatás** és fiók szükséges:

### 1. GitHub (Gist Adatbázis & Hosting)
- **Fiók:** [github.com](https://github.com)
- **Feladat:** 
  - **GitHub Pages:** Az alkalmazás statikus weboldalának hosztolása.
  - **GitHub Gist:** A szobák, tételek, kategóriák és feliratkozási tokenek tárolása JSON fájlban (`bevasarlas.json`).

### 2. Cloudflare (Push Notification Worker szerver)
- **Fiók:** [dash.cloudflare.com](https://dash.cloudflare.com)
- **Feladat:** Ingyenes **Cloudflare Worker** futtatása (`bevasarlas-notify`), ami fogadja a módosítások triggerét, és a VAPID kulcsok segítségével közvetlenül a böngészők push szerverének (pl. Apple APNs, Google FCM) küldi el az értesítést.
- **Worker kódfájl:** [`cloudflare-worker.js`](./cloudflare-worker.js)

### 3. Firebase Console (Admin Auth)
- **Fiók:** [console.firebase.google.com](https://console.firebase.google.com)
- **Feladat:** **Firebase Authentication (Google Sign-In)** az `admin.html` felület levédéséhez. Kizárólag a megadott admin email cím (`tamas.duffek@gmail.com`) léphet be a szobák ellenőrzéséhez és törléséhez.

---

## ⚙️ Beállítási és Konfigurációs Útmutató

### A) Cloudflare Worker Beállítása
1. Hozz létre egy ingyenes fiókot a [dash.cloudflare.com](https://dash.cloudflare.com) oldalon.
2. Menj a **Compute → Workers & Pages → Create → Start with Hello World!** menüpontra.
3. Nevezd el `bevasarlas-notify`-nak, majd nyomj a **Deploy**-ra.
4. Kattints az **Edit Code** gombra, töröld ki a kódot, és másold be a repo-ban található [`cloudflare-worker.js`](./cloudflare-worker.js) tartalmát.
5. Nyomj a **Deploy** gombra.

### B) Firebase Auth Beállítása (Admin felület)
1. Hozz létre egy `bevasarlas-lista` nevű projektet a [console.firebase.google.com](https://console.firebase.google.com) oldalon.
2. Kapcsold be a **Google Sign-In** szolgáltatást (*Authentication → Sign-in method → Google → Enable*).
3. Az **Authentication → Settings → Authorized domains** alatt add hozzá a domain-edet (pl. `dufi1984.github.io`).

---

## 📱 Használat & Működés

- **Első megnyitás:** A felhasználó megadja a szoba nevét (pl. `otthon`).
- **Értesítések:** Az alkalmazás az első képernyő-érintésre (user gesture) elvégzi a VAPID feliratkozást.
- **Debounce:** Gyors egymás utáni módosítások esetén 5 másodperc várakozás után csak 1 összefoglaló értesítés megy ki.
- **Saját eszköz szűrése:** A módosító eszköz automatikusan ki van hagyva az értesítésből, így csak a többi csatlakozott telefon kap notit.
