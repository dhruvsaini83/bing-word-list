# 🔍 Bing Word List (Daily Real-Time Trending Search Terms)

[![Daily Trending Words Update](https://github.com/dhruvsaini83/bing-word-list/actions/workflows/update-words.yml/badge.svg)](https://github.com/dhruvsaini83/bing-word-list/actions/workflows/update-words.yml)
![Daily Words Count](https://img.shields.io/badge/Daily%20Words-40-orange.svg)
![Update Schedule](https://img.shields.io/badge/Schedule-12:00%20AM%20IST-blue.svg)
![Format](https://img.shields.io/badge/Format-JSON-brightgreen.svg)
![Zero Setup](https://img.shields.io/badge/API%20Key-None%20Needed-brightgreen.svg)

An automated repository that fetches and updates **fresh, live daily trending search keywords** every single day. Designed for search bots, Microsoft Rewards automation, daily vocabulary services, and web testing workflows — **without requiring any AI or paid API keys**.

---

## 📌 How It Works

Every day at **12:00 AM IST (18:30 UTC)**, GitHub Actions runs [`generate_words.py`](./generate_words.py) to harvest genuine daily trending search queries:

1. **Google Trends RSS Feeds:**
   - Fetches live daily trending search queries across multiple regions (India, United States, UK).
   - Captures what real humans are actively searching for on the internet right now.
2. **Wikipedia Daily Most-Read & Current News:**
   - Fetches today's top viewed subjects, pop culture events, movies, science breakthroughs, and sports tournaments via Wikipedia's public feed API.
3. **Data Cleaning & Filtering:**
   - Cleans brackets, HTML entities, excess symbols, and noise words.
   - Enforces query length constraints (3–50 chars) and deduplicates case-insensitively.
4. **Reliable Fallback Buffer:**
   - In case external services are temporarily slow, an offline curated fallback bank ensures that [`words.json`](./words.json) is **never empty** and always contains 40 quality queries.
5. **Auto-commit & Push:**
   - The fresh list is written to [`words.json`](./words.json) and committed automatically.

---

## 🚀 Quick Access (Raw API)

You can consume the latest words directly in your scripts using the raw GitHub URL:

```text
https://raw.githubusercontent.com/dhruvsaini83/bing-word-list/main/words.json
```

### Example Output (`words.json`)

```json
[
  "उच्चतम न्यायालय",
  "Davante Adams",
  "Cindy Crawford",
  "Big Brother 28",
  "cruise ship",
  "78th Primetime Emmy Awards",
  "2026 Asian Games",
  "strands hint today",
  "..."
]
```

---

## 💻 Usage Examples

### Python
```python
import requests

url = "https://raw.githubusercontent.com/dhruvsaini83/bing-word-list/main/words.json"
response = requests.get(url)
words = response.json()

print(f"Loaded {len(words)} fresh words for today:")
for i, word in enumerate(words, 1):
    print(f"{i}. {word}")
```

### JavaScript / Node.js
```javascript
fetch("https://raw.githubusercontent.com/dhruvsaini83/bing-word-list/main/words.json")
  .then(res => res.json())
  .then(words => {
    console.log(`Fetched ${words.length} words:`, words);
  })
  .catch(err => console.error("Error fetching words:", err));
```

### cURL / PowerShell
```bash
curl -s https://raw.githubusercontent.com/dhruvsaini83/bing-word-list/main/words.json
```

---

## 📂 Repository Structure

```text
bing-word-list/
├── .github/
│   └── workflows/
│       └── update-words.yml   # GitHub Actions cron scheduler
├── generate_words.py          # Python automation script (Google Trends + Wikipedia)
├── words.json                 # Daily updated search keywords (40 items)
└── README.md                  # Project documentation
```

---

## ⚙️ Running Locally & Customization

### Run Manually on your Computer
```bash
python generate_words.py
```

### Customization Options in `generate_words.py`
- **Change Target Word Count:** Modify `TARGET_COUNT = 40` at the top of `generate_words.py`.
- **Change Regions:** In `fetch_google_trends(geos=("IN", "US", "GB"))`, add or remove country codes (e.g. `"CA"`, `"AU"`, etc.).
- **Change Schedule:** Edit the cron line in `.github/workflows/update-words.yml` (default is `30 18 * * *` for 12:00 AM IST).

---

## 📄 License
This repository is open-source and free to use under the [MIT License](LICENSE).