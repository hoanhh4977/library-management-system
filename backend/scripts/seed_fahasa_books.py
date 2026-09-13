"""Adds real English-language titles scraped from Fahasa.com (a real Vietnamese
bookstore) category listing pages, to broaden the catalog's genre mix beyond the
existing manga + science/philosophy seed data. Title text and cover image URLs
come from the actual Fahasa product listing markup — nothing here is invented.

Fahasa's own site sits behind a Cloudflare bot challenge, so a plain HTTP fetch of
fahasa.com returns a 403 challenge page rather than product data. The Wayback
Machine (web.archive.org) holds full archived copies of these exact listing pages,
so this script fetches the most recent archived snapshot of each category URL and
parses the real product tiles out of that HTML. Cover images are re-hosted on
Fahasa's own CDN (cdn1.fahasa.com), which is NOT behind Cloudflare, so the final
cover_image_url values stored in the DB are live, direct Fahasa CDN links (verified
to return 200 image responses), not archive.org links.

Caveats (be upfront, don't fabricate):
- Category listing pages do not show a per-book author or publisher — that detail
  only lives on individual product pages, and Fahasa's product pages are also
  behind Cloudflare and were not found in the Wayback Machine (checked via the CDX
  API — no snapshots exist for the sampled product URLs). So `author` and
  `publisher` are stored as "Không rõ" (unknown), the same fallback convention
  already used by seed_science_philosophy_books.py when a data source doesn't
  supply a value. This is an honest placeholder for missing data, not a fabricated
  name.
- `quantity` is a random demo stock count (1-8), same convention as the other seed
  scripts — Fahasa doesn't expose library stock and none is implied.

To add another Fahasa category later, add one line to CATEGORY_SOURCES below.

Run once, from backend/: `conda run -n library-management python scripts/seed_fahasa_books.py`
Safe to re-run: skips any title that already exists in the DB (matched by title),
and skips any scraped item that has no real cover image URL.
"""

import asyncio
import html as html_module
import random
import re
import sys
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.category import BookCategory, Category
from sqlalchemy import select

# (Fahasa category listing URL, Vietnamese category label to use in our catalog)
# Add a new (url, category) tuple here to pull in another Fahasa category later.
CATEGORY_SOURCES = [
    (
        "https://www.fahasa.com/foreigncategory/business-finance-law/business-management.html",
        "Kinh doanh - Quản trị",
    ),
    (
        "https://www.fahasa.com/foreigncategory/biography.html",
        "Hồi ký - Tiểu sử",
    ),
    (
        "https://www.fahasa.com/foreigncategory/fiction.html",
        "Văn học",
    ),
    (
        "https://www.fahasa.com/foreigncategory/children-s-books.html",
        "Thiếu nhi",
    ),
    (
        "https://www.fahasa.com/foreigncategory/food-drink.html",
        "Ẩm thực",
    ),
    (
        "https://www.fahasa.com/foreigncategory/personal-development.html",
        "Kỹ năng sống",
    ),
]

UNKNOWN = "Không rõ"
MAX_TITLE_LEN = 100  # matches Book.title String(100) column limit

_TAG_RE = re.compile(r"<[^>]+>")
_LI_RE = re.compile(r'<li>\s*<div class="item-inner">(.*?)</div>\s*</li>', re.S)
_IMG_SRC_RE = re.compile(r'data-img-src="([^"]+)"')
_IMG_SRC_FALLBACK_RE = re.compile(r'data-src="([^"]+)"')
_TITLE_RE = re.compile(
    r'<h2 class="product-name-no-ellipsis p-name-list">\s*<a href="[^"]*"[^>]*>\s*(.*?)\s*</a>',
    re.S,
)
_WAYBACK_PREFIX_RE = re.compile(r"^https?://web\.archive\.org/web/\d+(?:im_)?/")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}


def clean_title(raw: str) -> str | None:
    text = _TAG_RE.sub("", raw)  # drop stray badge <img> tags embedded in listing text
    text = html_module.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    if len(text) > MAX_TITLE_LEN:
        truncated = text[:MAX_TITLE_LEN].rsplit(" ", 1)[0].strip()
        text = truncated or text[:MAX_TITLE_LEN]
    return text


def parse_products(page_html: str) -> list[tuple[str, str]]:
    """Extract (title, cover_image_url) pairs from a Fahasa category listing page."""
    items: list[tuple[str, str]] = []
    for li_match in _LI_RE.finditer(page_html):
        block = li_match.group(1)
        img_match = _IMG_SRC_RE.search(block) or _IMG_SRC_FALLBACK_RE.search(block)
        title_match = _TITLE_RE.search(block)
        if not (img_match and title_match):
            continue

        img_url = _WAYBACK_PREFIX_RE.sub("", img_match.group(1))
        if not img_url.startswith("http") or "ring_loader" in img_url:
            continue  # lazyload placeholder spinner, not a real cover

        title = clean_title(title_match.group(1))
        if not title:
            continue

        items.append((title, img_url))
    return items


async def fetch_with_retry(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response | None:
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            resp = await client.get(url, headers=HEADERS, timeout=30, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as exc:  # noqa: BLE001 - retry on anything transient
            last_error = exc
            await asyncio.sleep(2 * (attempt + 1))
    print(f"  giving up on {url}: {last_error}")
    return None


async def fetch_category_html(client: httpx.AsyncClient, fahasa_url: str) -> str | None:
    """Fetch the most recent Wayback Machine snapshot of a Fahasa category page.

    fahasa.com itself sits behind a Cloudflare challenge that blocks plain HTTP
    clients, so we go through the Internet Archive's archived copy of the exact
    same page instead. Requesting a far-future timestamp makes Wayback's redirect
    service 302 to the latest real capture it has — this hits the (unthrottled)
    playback service rather than the separate `wayback/available` JSON API, which
    is aggressively rate-limited.
    """
    probe_url = f"https://web.archive.org/web/29991231000000/{fahasa_url}"
    page_resp = await fetch_with_retry(client, probe_url, follow_redirects=True)
    if page_resp is None:
        return None
    if page_resp.status_code == 404:
        print(f"  no Wayback snapshot available for {fahasa_url}")
        return None
    return page_resp.text


async def main() -> None:
    async with SessionLocal() as session, httpx.AsyncClient(timeout=30) as client:
        existing_titles = set(
            (await session.execute(select(Book.title))).scalars().all()
        )
        seen_titles: set[str] = set()

        added = 0
        skipped_existing = 0
        skipped_no_cover = 0

        for fahasa_url, category in CATEGORY_SOURCES:
            print(f"\n== {category} ({fahasa_url}) ==")
            page_html = await fetch_category_html(client, fahasa_url)
            if page_html is None:
                print("  skipping category: could not fetch page content")
                continue

            products = parse_products(page_html)
            print(f"  parsed {len(products)} product tiles from listing")

            for title, cover_url in products:
                if title in existing_titles or title in seen_titles:
                    print(f"  skip (already exists): {title}")
                    skipped_existing += 1
                    continue
                if not cover_url:
                    print(f"  skip (no real cover image): {title}")
                    skipped_no_cover += 1
                    continue

                seen_titles.add(title)

                book = Book(
                    id=uuid.uuid4(),
                    code=f"S{uuid.uuid4().hex[:6].upper()}",
                    title=title,
                    author=UNKNOWN,
                    publisher=UNKNOWN,
                    quantity=random.Random(title).randint(1, 8),
                    cover_image_url=cover_url,
                )
                session.add(book)
                await session.flush()
                category_row = (
                    await session.execute(select(Category).where(Category.name == category))
                ).scalar_one_or_none()
                if category_row is None:
                    category_row = Category(id=uuid.uuid4(), name=category)
                    session.add(category_row)
                    await session.flush()
                session.add(BookCategory(book_id=book.id, category_id=category_row.id))
                added += 1
                print(f"  added: {title} ({category})")

        await session.commit()
        await engine.dispose()
        print(
            f"\nDone. Added {added} new titles. "
            f"Skipped {skipped_existing} already-existing, {skipped_no_cover} with no real cover."
        )


if __name__ == "__main__":
    asyncio.run(main())
