# Prima Lahůdky – backend (objednávky, SMS a e-mail)

Malý Express server, který:
1. vytváří Stripe Checkout Session pro online platbu (`/api/create-checkout-session`)
2. po objednávce převodem nebo osobním odběrem uloží objednávku do Postgresu a pošle paní SMS
3. u bankovního převodu přidá do SMS jednorázový odkaz; po potvrzení paní odešle zákazníkovi e-mail přes Resend
4. po úspěšné Stripe platbě (webhook `/api/webhook`) pošle SMS paní přes Vonage

## 1. Instalace

```bash
cd server
npm install
cp .env.example .env
```

Vyplň `.env`:
- `STRIPE_SECRET_KEY` – volitelné, nastav pouze při zapnutí platby kartou (nejdřív TEST klíč z https://dashboard.stripe.com/test/apikeys)
- `VONAGE_API_KEY`, `VONAGE_API_SECRET` – z https://dashboard.vonage.com → Settings → API Keys
- `VONAGE_FROM_NUMBER` – telefonní číslo přidělené/koupené ve Vonage (formát `+420...`)
- `OWNER_PHONE_NUMBER` – telefon paní, na který má SMS chodit (formát `+420...`)
- `FRONTEND_URL` – při lokálním vývoji `http://localhost:5173` (nebo jaký port ti vypíše `npm run dev` u frontendu)
- `STRIPE_WEBHOOK_SECRET` – volitelné do zapnutí platby kartou; pro webhook viz krok 3 níže
- `DATABASE_URL` – connection string Postgres databáze (např. Neon; pro produkční server použij pooled connection string)
- `RESEND_API_KEY` – API klíč z Resend pro odeslání potvrzovacího e-mailu
- `EMAIL_FROM` – odesílatel v ověřené doméně, např. `Prima Lahůdky <objednavky@moje-domena.cz>`

Před ostrým spuštěním ověř doménu odesílatele v Resend a nastav všechny nové proměnné také v hostingu backendu. Objednávky se ukládají do tabulky `orders`, kterou server vytvoří při startu. Potvrzovací odkaz platí 72 hodin; otevření odkazu pouze zobrazí objednávku, e-mail se odešle až po stisknutí tlačítka na stránce.

## 2. Spuštění

Ve dvou terminálech současně:

```bash
# terminál 1 – backend
cd server
npm run dev

# terminál 2 – frontend (z kořene projektu, ne ze server/)
npm run dev
```

## 3. Testování plateb lokálně (Stripe webhook)

Stripe potřebuje umět poslat webhook na tvůj počítač. Nainstaluj [Stripe CLI](https://docs.stripe.com/stripe-cli) a spusť:

```bash
stripe login
stripe listen --forward-to localhost:3001/api/webhook
```

Vypíše se ti `whsec_...` – tu hodnotu vlož do `.env` jako `STRIPE_WEBHOOK_SECRET` a restartuj backend.

Pak na webu projdi objednávku a na Stripe platební stránce použij testovací kartu:
- číslo `4242 4242 4242 4242`, libovolné budoucí datum, libovolný CVC

Po "zaplacení" bys měl/a:
- vidět přesměrování zpět na e-shop, který si stav platby ověří přes server
- v terminálu se `stripe listen` vidět doručený event
- v terminálu backendu vidět log (a pokud jsou Vonage údaje správné, přijde SMS)

## 4. Přechod na ostrou verzi (produkce)

1. Stripe je v rozhraní momentálně vypnutý. Ostré klíče ani webhook nenastavuj, dokud se platba kartou znovu nezapne.
2. `FRONTEND_URL` nastav na finální HTTPS doménu webu.
3. Backend potřebuje běžet jako webová služba; frontend na Vercelu přeposílá `/api/*` na Render.
4. Vonage: zkontroluj si, že máš dostatek kreditu a že `VONAGE_FROM_NUMBER` je povolený odesílatel pro SMS do Česka.

### Doporučené nasazení tohoto projektu

- Frontend může běžet na Vercelu. Build používá `npm run build` a výstup je `dist/public`.
- Backend běží na Renderu. Root directory ponech na kořeni repozitáře, protože server načítá katalog z `shared/products.json`.
- Build command: `npm --prefix server ci`; start command: `npm --prefix server start`. Render automaticky nastaví `PORT`.
- Na Renderu nastav proměnné z `server/.env.example` se skutečnými hodnotami; `FRONTEND_URL` musí být přesná doména webu včetně `https://`.
- `vercel.json` přeposílá `/api/*` na `https://lahudky.onrender.com`. Pokud se změní adresa služby, aktualizuj ji i tam.
- Stripe zůstává vypnutý, dokud se nezapne v rozhraní. Potom nastav webhook na `https://lahudky.onrender.com/api/webhook` a event `checkout.session.completed`.

## Poznámka k bezpečnosti cen

Ceny produktů se berou VÝHRADNĚ ze `shared/products.json`, ne od klienta. Tento soubor používá frontend i `server/products.js`, takže ceny upravuj pouze na jednom místě.
