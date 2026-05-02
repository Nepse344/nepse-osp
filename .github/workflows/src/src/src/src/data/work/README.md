# NEPSE HOURS — The Market Never Sleeps

**Global Autonomous Financial Intelligence Network**

## ⚠️ Security Rules
- **Never commit API keys** to the repository. Use Cloudflare Workers **environment variables**.
- The master password in the frontend is for demo only. In production implement proper authentication (JWT, OAuth).
- Rate limiting is enabled on the worker; adjust limits as needed.

## 🚀 Quick Start
1. **Fork** this repository.
2. **Deploy the Worker** (`worker/index.js`) to Cloudflare Workers with:
   - KV namespace binding named `NEPSE_KV`
   - Cron trigger `* * * * *`
   - Set all required **environment secrets** (see Worker code comments).
3. **Replace the Worker URL** in `src/index.html` (line ~18) with your deployed Worker domain.
4. **Push to `main`** – GitHub Actions will deploy the frontend to GitHub Pages.
5. (Optional) Add a **custom domain** (`nepsehours.com.np`) via GitHub Pages settings and a CNAME file.

## 🔧 Admin Panel
Access the dashboard with `?admin` appended to the URL.
Default master password: `gyanendra@#&5009` (change it in Worker environment variables).

## 📁 Project Structure
