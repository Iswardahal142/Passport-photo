# 📸 Passport Pro – Instant Passport Photo Maker

A sleek 4-step web app to create professional passport photo sheets (4×6 or A4) from any photo.

## ✨ Features
- **Step 1** – Upload any photo (drag & drop or click)
- **Step 2** – AI background removal via [Remove.bg](https://www.remove.bg/api) + custom background color
- **Step 3** – Choose 4×6 or A4 sheet, set quantity, preview layout
- **Step 4** – Download as PDF or Print directly

## 🚀 Deploy to Vercel (3 Easy Steps)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/passport-photo-app.git
git push -u origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy**

### 3. Add API Key in Vercel Dashboard
1. Go to your project → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `REMOVEBG_API_KEY`
   - **Value**: Your key from [remove.bg/api](https://www.remove.bg/api)
3. Redeploy (Deployments → Redeploy)

## 🛠 Local Development

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and add your REMOVEBG_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📐 Photo Specs
| Sheet | Photos | Each Photo |
|-------|--------|------------|
| 4×6 inch | 6 photos (2×3) | 35mm × 45mm |
| A4 | 20 photos (4×5) | 35mm × 45mm |

## 🔑 Get Remove.bg API Key
1. Sign up at [remove.bg](https://www.remove.bg/api)
2. Free tier: **50 API calls/month**
3. Copy your API key to Vercel environment variables

## Tech Stack
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **jsPDF** – PDF generation
- **react-dropzone** – File upload
- **Remove.bg API** – AI background removal
