# Immigration & DHS Daily Briefing

A Node.js script that searches for the latest news on **ICE operations**, **third-country deportations**, and **DHS policy changes** using Claude's web search, then emails a formatted briefing to your inbox each morning.

Runs automatically via **GitHub Actions** (free), or locally via **cron**.

---

## What you need

| Requirement | Where to get it |
|---|---|
| Node.js 18+ | https://nodejs.org |
| Anthropic API key | https://console.anthropic.com |
| Gmail account | For sending the email |
| Gmail App Password | https://myaccount.google.com/apppasswords |

---

## Setup

### 1. Clone or create the repo

```bash
git clone https://github.com/YOUR_USERNAME/immigration-briefing.git
cd immigration-briefing
```

Or start from scratch:

```bash
mkdir immigration-briefing && cd immigration-briefing
git init
```

Then copy the project files in.

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Gmail App Password

Gmail won't let scripts use your normal password. You need an **App Password**:

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** if not already on
3. Go to https://myaccount.google.com/apppasswords
4. Choose **Mail** / **Other (custom name)** → call it "DHS Briefing"
5. Copy the 16-character password shown

### 4. Set up your environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
GMAIL_USER=yoursendingaccount@gmail.com
GMAIL_APP_PASS=xxxx-xxxx-xxxx-xxxx
RECIPIENT_EMAIL=yourinbox@example.com
```

### 5. Run it once to test

```bash
node briefing.js
```

You should see it fetch three topics and then confirm the email was sent.

---

## Schedule it automatically with GitHub Actions (free)

This is the recommended approach — GitHub's servers run it for you every morning, no machine needs to be left on.

### 1. Push to a GitHub repo

```bash
git add .
git commit -m "Initial briefing setup"
git remote add origin https://github.com/YOUR_USERNAME/immigration-briefing.git
git push -u origin main
```

> The repo can be **private** — GitHub Actions works on both public and private repos.

### 2. Add your secrets to GitHub

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add each of these:

| Secret name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `GMAIL_USER` | Your sending Gmail address |
| `GMAIL_APP_PASS` | The App Password from step 3 |
| `RECIPIENT_EMAIL` | Where to deliver the briefing |

### 3. Enable Actions

Go to the **Actions** tab in your repo. If prompted, click **"I understand my workflows, go ahead and enable them"**.

### 4. Test a manual run

In the **Actions** tab, click **Daily Immigration & DHS Briefing** → **Run workflow** → **Run workflow**.

Watch it complete and check your inbox.

### Adjust the schedule

Edit `.github/workflows/daily-briefing.yml`:

```yaml
- cron: "0 7 * * 1-5"   # 07:00 UTC, weekdays only
```

Cron format: `minute hour day month day-of-week`

Examples:
- `0 6 * * *` — every day at 06:00 UTC (07:00 UK winter, 08:00 UK summer)
- `0 7 * * 1-5` — weekdays at 07:00 UTC
- `30 5 * * *` — every day at 05:30 UTC

> Note: GitHub Actions runs on UTC. London is UTC+0 (winter) or UTC+1 (BST, summer).
> For a 7am London delivery year-round, use two cron entries or accept 1hr offset in summer.

---

## Run locally on a schedule (alternative)

If you prefer to run it on your own machine instead of GitHub:

**macOS/Linux — crontab:**

```bash
crontab -e
```

Add:

```
0 7 * * 1-5 cd /full/path/to/immigration-briefing && node briefing.js >> /tmp/briefing.log 2>&1
```

**Windows — Task Scheduler:**

Create a Basic Task that runs `node.exe` with argument `C:\path\to\immigration-briefing\briefing.js` on your chosen schedule.

---

## Customising the topics

Edit `TOPICS` in `briefing.js` to search for anything else:

```js
const TOPICS = [
  {
    id: "ice",
    label: "ICE Operations",
    query: "US Immigration ICE operations arrests deportations raids 2026",
  },
  // add or change topics here
];
```

---

## Cost estimate

Each daily run makes ~3 API calls with web search. At typical Sonnet pricing this is roughly **$0.03–0.08 per day** depending on result length — around **$1–2/month**.
