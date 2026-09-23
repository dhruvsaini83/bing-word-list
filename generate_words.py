import html
import json
import random
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

TARGET_COUNT = 40

# Fallback master words bank (Rajasthan, India & General knowledge)
FALLBACK_WORDS = [
    "Amer Fort Jaipur", "Chittorgarh Fort", "Mehrangarh Fort Jodhpur",
    "Jaisalmer Fort", "Hawa Mahal", "City Palace Udaipur",
    "Umaid Bhawan Palace", "Ranthambore National Park", "Sariska Tiger Reserve",
    "Thar Desert Safari", "Pushkar Camel Fair", "Kumbhalgarh Wall",
    "Dal Baati Churma", "Ghoomar Folk Dance", "Kalbelia Dance",
    "Keoladeo Bird Sanctuary", "Chand Baori Abhaneri", "Dilwara Jain Temples",
    "Bikaner Junagarh Fort", "Mount Abu Guru Shikhar", "Brahma Temple Pushkar",
    "Blue Pottery Jaipur", "Bandhani Saree", "Pichwai Painting",
    "Ghevar Sweet", "Pyaaz Kachori", "Laal Maas", "Kathputli Puppet Show",
    "Shekhawati Havelis", "Bundi Stepwells", "Jantar Mantar Observatory",
    "Karni Mata Rat Temple", "Salasar Balaji", "Khatu Shyam Ji Temple",
    "Sambhar Salt Lake", "Chambal River Safari", "Mukundra Hills Tiger",
    "Great Indian Bustard", "Desert National Park", "Aravalli Mountain Range"
]

def clean_query(text: str) -> str:
    """Cleans up a query string by unescaping HTML, removing brackets, and trimming spaces."""
    if not text:
        return ""
    text = html.unescape(text)
    # Remove contents inside parentheses/brackets e.g. (film), [2026]
    text = re.sub(r"[\(\[\{][^\)\]\}]*[\)\]\}]", "", text)
    # Remove special punctuation but keep letters, digits, and spaces
    text = re.sub(r"[#@&*~_+=<>\/\\|:;\"'`]", " ", text)
    # Collapse multiple whitespace characters into a single space
    text = re.sub(r"\s+", " ", text).strip()
    return text

def fetch_google_trends(geos=("IN", "US", "GB")) -> list[str]:
    """Fetches real-time daily search trends from Google Trends RSS feeds."""
    results = []
    for geo in geos:
        url = f"https://trends.google.com/trending/rss?geo={geo}"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                xml_content = resp.read()
                root = ET.fromstring(xml_content)
                for item in root.findall(".//item"):
                    title_elem = item.find("title")
                    if title_elem is not None and title_elem.text:
                        cleaned = clean_query(title_elem.text)
                        if cleaned:
                            results.append(cleaned)
        except Exception as e:
            print(f"[!] Warning: Could not fetch Google Trends for {geo}: {e}")
    return results

def fetch_wikipedia_daily() -> list[str]:
    """Fetches today's most read articles and current news topics from Wikipedia REST API."""
    results = []
    now = datetime.now(timezone.utc)
    url = f"https://en.wikipedia.org/api/rest_v1/feed/featured/{now.year}/{now.month:02d}/{now.day:02d}"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "BingWordListBot/1.0 (https://github.com/dhruvsaini83/bing-word-list)"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            
            # Most read articles today
            articles = data.get("mostread", {}).get("articles", [])
            for item in articles:
                title = item.get("normalizedtitle") or item.get("title")
                if title:
                    cleaned = clean_query(title)
                    if cleaned and not cleaned.lower().startswith(("main page", "special", "file")):
                        results.append(cleaned)

            # In the news topics
            news_items = data.get("news", [])
            for news in news_items:
                for link in news.get("links", []):
                    title = link.get("normalizedtitle") or link.get("title")
                    if title:
                        cleaned = clean_query(title)
                        if cleaned and not cleaned.lower().startswith(("main page", "special", "file")):
                            results.append(cleaned)
    except Exception as e:
        print(f"[!] Warning: Could not fetch Wikipedia daily topics: {e}")
    return results

def main():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"[*] Starting daily fresh words generation for: {today}")

    collected_words = []

    # 1. Fetch Google Trends
    trends = fetch_google_trends(geos=("IN", "US", "GB"))
    print(f"[+] Fetched {len(trends)} words from Google Trends.")
    collected_words.extend(trends)

    # 2. Fetch Wikipedia daily most read
    wiki_words = fetch_wikipedia_daily()
    print(f"[+] Fetched {len(wiki_words)} words from Wikipedia Daily.")
    collected_words.extend(wiki_words)

    # 3. Clean and Deduplicate
    seen = set()
    unique_words = []
    for word in collected_words:
        w_lower = word.lower()
        if 3 <= len(word) <= 50 and w_lower not in seen:
            seen.add(w_lower)
            unique_words.append(word)

    print(f"[*] Unique fresh words collected: {len(unique_words)}")

    # 4. Fallback if needed
    if len(unique_words) < TARGET_COUNT:
        print(f"[!] Below target count ({len(unique_words)} < {TARGET_COUNT}). Adding from fallback bank...")
        # Use date as seed to shuffle fallback items
        random.seed(today)
        shuffled_fallback = FALLBACK_WORDS.copy()
        random.shuffle(shuffled_fallback)
        for fb_word in shuffled_fallback:
            if fb_word.lower() not in seen:
                seen.add(fb_word.lower())
                unique_words.append(fb_word)
            if len(unique_words) >= TARGET_COUNT:
                break

    # Shuffle using today's date as seed to provide a well-balanced mix of topics
    random.seed(today)
    random.shuffle(unique_words)

    # Select top target count
    final_words = unique_words[:TARGET_COUNT]

    # 5. Write to words.json
    with open("words.json", "w", encoding="utf-8") as f:
        json.dump(final_words, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"[OK] Successfully wrote {len(final_words)} words to words.json\n")
    print("Today's Words Sample:")
    for idx, w in enumerate(final_words[:10], 1):
        try:
            print(f" {idx:2d}. {w}")
        except Exception:
            print(f" {idx:2d}. {w.encode('ascii', 'ignore').decode()}")
    print(" ...")

if __name__ == "__main__":
    main()
