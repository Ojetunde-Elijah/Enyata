# Kolet Pay Platform

Kolet Pay is a robust payment collection and merchant onboarding platform integrated with the **Interswitch** ecosystem.

## 🚀 Implemented Features

### 1. Rigorous KYC Onboarding
- **Identity Verification**: Real-time NIN and BVN validation via the **Interswitch API Marketplace**.
- **Business Verification**: TIN validation for corporate entities.
- **Resilience**: Implemented a "soft-fail" strategy to handle Marketplace downtime without blocking the entire signup flow.

### 2. E-Invoice Management
- **Invoice Creation**: Merchants can generate professional invoices for their customers.
- **Bank Guard**: Enforces that a collection bank is configured before any invoice can be issued.

### 3. Integrated Payments
- **Interswitch Web Checkout (Inline)**: Direct, secure payment processing within the dashboard.
- **Shareable Payment Links**: Generation of public, mobile-responsive payment portals (e.g., `kolet.pay/pay/:id`).
- **WhatsApp Integration**: One-click sharing of payment links to customers' WhatsApp.

## 🛠️ Technical Decisions & Logic

### Dummy Account Strategy (Alternative Logic)
During development, we identified significant latency and intermittent stability issues in the Interswitch sandbox for real-time **Merchant Wallet** and **Virtual Account** provisioning.
- **Decision**: To ensure a premium user experience, new signups are initialized with a **Dummy Account** state (₦0.00, "Verification Pending").
- **Benefit**: This allows the merchant to access the dashboard immediately. 
- **Production Path**: In a live environment, the `createVirtualWallet` call (defined in `interswitch.js`) should be awaited fully, or the dummy state should be replaced once the background provisioning callback is received.

### API Usage Summary
- **Used**: API Marketplace (Identity), WebPay (Collections), Passport (Auth).
- **Defined but Deferred**: Payouts & Merchant Wallets. While the code supports these (see `executePayout` in `interswitch.js`), they were kept as secondary features to prioritize the stability of the **Collections** flow for the initial launch.

### Persistence on Vercel (Important)
Vercel has a read-only filesystem. 
- **The Fix**: I've updated the app to use a `/tmp` fallback to prevent crashes during signup.
- **Requirement**: For **permanent** data storage (so your users don't disappear), you **MUST** configure **Upstash Redis** (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) in your Vercel project settings. 

### Ready to Go?
1. Open your Vercel Dashboard.
2. Add the Interswitch and Upstash environment variables.
3. Redeploy.

## 💻 Running Locally

1. **Install Dependencies**: `npm install`
2. **Configure Environment**: Copy `.env.example` to `.env` and fill in:
   - `INTERSWITCH_*` (Merchant credentials)
   - `API_MARKET_*` (Marketplace credentials)
   - `UPSTASH_REDIS_*` (For production persistence)
3. **Run Dev Server**: `npm run dev` (Runs both Vite & Node backend)

## ☁️ Deployment (Vercel)
- Ensure all environment variables are set in the Vercel Dashboard.
- Build command: `npm run build`
- Deploy: `npx vercel --prod`
