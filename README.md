# Waillet - AI-Powered Wallet & Firewall

An AI-powered crypto wallet extension with security features.

## What You Need

### Extension
- Node.js (version 18 or higher)
- Chrome browser

### Backend
- Python 3.9+ with `uv`
- Docker & Docker Compose (for MySQL)
- OpenAI API key
- 
## How to Install

### Step 1: Install Dependencies

Open your terminal and go to the extension folder:

```bash
cd extension
npm install
```

This will download all the required packages. It might take 2-3 minutes.

### Step 2: Build the Extension

```bash
npm run build
```
### Step 3: Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Turn on "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the `dist` folder inside your `extension` folder

## How to Use

### 🔑 IMPORTANT: Backend Must Be Running!

**Before using the wallet, start the backend:**

```bash
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Why?** The wallet uses a backend RPC proxy for reliable blockchain connectivity

## File Structure
