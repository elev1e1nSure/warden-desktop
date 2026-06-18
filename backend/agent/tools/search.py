from __future__ import annotations

import asyncio
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from agent.tools.base import Tool


class GoogleSearchTool(Tool):
    name = "google_search"
    description = "Search the web. Returns top-5 results. Does not open the user's browser."
    params = {"query": {"type": "string", "description": "Search query"}}

    async def execute(self, args: dict[str, Any]) -> str:
        query = args.get("query", "")
        results = []
        last_exc = None
        success = False

        # 1. Try DuckDuckGo via duckduckgo_search package
        try:
            import duckduckgo_search
        except ImportError:
            return "error: pip install duckduckgo-search"

        try:
            from duckduckgo_search import DDGS

            def _ddg_search() -> list:
                backends = ["api", "html", "lite"]
                last = None
                for backend in backends:
                    try:
                        with DDGS() as ddgs:
                            res = list(ddgs.text(query, max_results=5, backend=backend))
                        if res:
                            return res
                    except Exception as e:
                        last = e
                        time.sleep(2)
                if last:
                    raise last
                return []

            results = await asyncio.to_thread(_ddg_search)
            success = True
        except Exception as e:
            last_exc = e
            success = False

        # 2. Try Yahoo fallback if DDG failed with an exception/rate limit
        if not success:

            def _yahoo_search() -> list:
                import re
                import urllib.parse
                import urllib.request
                from html import unescape

                url = "https://search.yahoo.com/search?" + urllib.parse.urlencode({"p": query})
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/143.0.0.0 Safari/537.36"
                        )
                    },
                )
                try:
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        html_data = resp.read().decode("utf-8", errors="replace")
                except Exception:
                    return []

                chunks = re.split(
                    r'<div\s+[^>]*class="[^"]*algo-sr[^"]*"', html_data, flags=re.IGNORECASE
                )
                res_list = []
                for chunk in chunks[1:]:
                    href_match = re.search(r'<a\s+[^>]*href="([^"]+)"', chunk, re.IGNORECASE)
                    if not href_match:
                        continue
                    href = href_match.group(1)

                    title = ""
                    h3_match = re.search(r"<h3[^>]*>(.*?)</h3>", chunk, re.DOTALL | re.IGNORECASE)
                    if h3_match:
                        title_html = h3_match.group(1)
                        title = re.sub(r"<[^>]+>", "", title_html)
                        title = unescape(title).strip()

                    if not title:
                        continue

                    if title.lower() in [
                        "related top stories",
                        "images",
                        "videos",
                        "more videos",
                        "more images",
                    ]:
                        continue

                    ru_matches = re.findall(r"RU=([^/&]+)", href)
                    for val in ru_matches:
                        unquoted = urllib.parse.unquote(val)
                        if unquoted.startswith("http://") or unquoted.startswith("https://"):
                            href = unquoted
                            break

                    snippet = ""
                    comp_text_match = re.search(
                        r'<div[^>]*class="[^"]*compText[^"]*"[^>]*>(.*?)</div>',
                        chunk,
                        re.DOTALL | re.IGNORECASE,
                    )
                    if comp_text_match:
                        snippet = comp_text_match.group(1)
                    else:
                        fc_match = re.search(
                            r'<span[^>]*class="[^"]*fc-2nd[^"]*"[^>]*>(.*?)</span>',
                            chunk,
                            re.DOTALL | re.IGNORECASE,
                        )
                        if fc_match:
                            snippet = fc_match.group(1)

                    if snippet:
                        snippet = re.sub(r"<[^>]+>", "", snippet)
                        snippet = unescape(snippet).strip()

                    res_list.append({"title": title, "href": href, "body": snippet})
                    if len(res_list) >= 5:
                        break
                return res_list

            try:
                results = await asyncio.to_thread(_yahoo_search)
            except Exception as e:
                if not last_exc:
                    last_exc = e

        if not results:
            if last_exc:
                return f"error: {last_exc}"
            return "no results"

        return "\n".join(
            f"• {r['title']}\n  {r['href']}\n  {r.get('body', '')[:200]}" for r in results
        )


class WebFetchTool(Tool):
    name = "webfetch"
    description = (
        "Fetch content from a URL. Returns plain text or markdown. "
        "Supports HTML, JSON, and plain text responses. "
        "Max 5MB, 30s timeout. For interactive pages use browser_read instead."
    )
    params = {
        "url": {"type": "string", "description": "The URL to fetch content from"},
        "format": {
            "type": "string",
            "description": "Return format: text, markdown, or html (default: markdown)",
        },
        "timeout": {"type": "integer", "description": "Timeout in seconds (max 120, default 30)"},
    }

    async def execute(self, args: dict[str, Any]) -> str:
        url = args.get("url", "")
        fmt = args.get("format", "markdown")
        timeout = min(int(args.get("timeout", 30)), 120)

        if not url.startswith("http://") and not url.startswith("https://"):
            return "error: URL must start with http:// or https://"

        # encode non-ASCII chars in path/query so urllib doesn't raise on Cyrillic etc.
        _p = urllib.parse.urlparse(url)
        url = urllib.parse.urlunparse(
            _p._replace(
                path=urllib.parse.quote(_p.path, safe="/:@!$&'()*+,;=%"),
                query=urllib.parse.quote(_p.query, safe="=&+%#"),
            )
        )

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/143.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
        accept_map = {
            "markdown": "text/markdown;q=1.0, text/html;q=0.8, text/plain;q=0.7, */*;q=0.1",
            "text": "text/plain;q=1.0, text/html;q=0.8, */*;q=0.1",
            "html": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        }
        headers["Accept"] = accept_map.get(fmt, accept_map["markdown"])

        try:
            import ssl

            req = urllib.request.Request(url, headers=headers)
            # Verify TLS by default; fall back to unverified only if the cert
            # can't be validated (self-signed/expired), so a bad cert doesn't
            # silently expose every fetch to MITM.
            try:
                ctx = ssl.create_default_context()
                resp_cm = await asyncio.to_thread(
                    urllib.request.urlopen, req, context=ctx, timeout=timeout
                )
            except urllib.error.URLError as e:
                if not isinstance(getattr(e, "reason", None), ssl.SSLCertVerificationError):
                    raise
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                resp_cm = await asyncio.to_thread(
                    urllib.request.urlopen, req, context=ctx, timeout=timeout
                )
            with resp_cm as resp:
                content_type = resp.headers.get("Content-Type", "text/plain")
                raw = resp.read()
            content = raw.decode("utf-8", errors="replace")[:10000]

            if fmt == "markdown" and ("html" in content_type or content_type == "text/html"):
                return self._html_to_markdown(content)[:10000]
            elif fmt == "text" and ("html" in content_type or content_type == "text/html"):
                return self._html_to_text(content)[:10000]
            return content[:10000]
        except urllib.error.HTTPError as e:
            return f"error: HTTP {e.code} {e.reason}"
        except TimeoutError:
            return f"error: timeout {timeout}s"
        except Exception as e:
            return f"error: {e}"

    @staticmethod
    def _html_to_markdown(html: str) -> str:
        try:
            import html2text

            h = html2text.HTML2Text()
            h.body_width = 0
            h.ignore_links = False
            h.ignore_images = False
            h.ignore_emphasis = False
            h.protect_links = True
            h.unicode_snob = True
            h.skip_internal_links = True
            return h.handle(html).strip()
        except ImportError:
            return WebFetchTool._html_to_text(html)

    @staticmethod
    def _html_to_text(html: str) -> str:
        import re

        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text
