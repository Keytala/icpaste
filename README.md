# icpaste.com

> Paste your BOM. Get the best price and stock across Mouser, Digi-Key and Farnell. No signup. Instant results.

---

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/icpaste.git
cd icpaste
npm install
cp .env.example .env.local
# → fill in your API keys in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 API Keys Setup

| Distributor | Where to get the key | Env Variable |
|---|---|---|
| **Mouser** | [mouser.com/api-hub](https://www.mouser.com/api-hub/) | `MOUSER_API_KEY` |
| **Digi-Key** | [developer.digikey.com](https://developer.digikey.com) | `DIGIKEY_CLIENT_ID` + `DIGIKEY_CLIENT_SECRET` |
| **Farnell** | [partner.element14.com](https://partner.element14.com) | `FARNELL_API_KEY` |

All keys are **free** — just register as a developer on each platform.

---

## ➕ Adding a New Distributor

1. Create `src/lib/adapters/your-distributor.adapter.ts`
2. Implement the `DistributorAdapter` interface (see `adapter.interface.ts`)
3. Add it to `src/lib/adapters/index.ts`

That's it. The engine picks it up automatically.

```typescript
// src/lib/adapters/your-distributor.adapter.ts
import { DistributorAdapter } from "./adapter.interface";

export const YourDistributorAdapter: DistributorAdapter = {
  name: "YourDistributor",
  async search(mpn, qty) {
    // call their API, return PartResult[]
    return [];
  },
};
```

---

## 📦 BOM Input Format

The parser accepts multiple formats — just paste from Excel, CSV or type manually:

```
LM358N 100
BC547B,500
STM32F103C8T6;10
100nF 0402   2000
```

---

## 🌍 Deploy on Vercel

```bash
npm i -g vercel
vercel
```

Then add your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage (BOM input)
│   ├── results/page.tsx      # Results page
│   └── api/search/route.ts   # POST /api/search
├── lib/
│   ├── adapters/             # One file per distributor
│   ├── engine/               # Core search + price logic
│   ├── utils/                # BOM parser
│   └── types/                # Shared TypeScript types
└── components/               # (reserved for future UI components)
```

---

## 📄 License

MIT
