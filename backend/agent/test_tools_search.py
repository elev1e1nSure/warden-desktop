"""Tests for search tools."""

from __future__ import annotations

from unittest.mock import patch


class TestGoogleSearchTool:
    async def test_no_results(self):
        from agent.tools.search import GoogleSearchTool

        tool = GoogleSearchTool()
        with patch("duckduckgo_search.DDGS") as mock_ddgs:
            mock_ddgs.return_value.__enter__.return_value.text.return_value = []
            result = await tool.execute({"query": "xyz123nonexistent"})
        assert "no results" in result.lower()

    async def test_results_returned(self):
        from agent.tools.search import GoogleSearchTool

        tool = GoogleSearchTool()
        with patch("duckduckgo_search.DDGS") as mock_ddgs:
            mock_ddgs.return_value.__enter__.return_value.text.return_value = [
                {"title": "Test", "href": "http://example.com", "body": "Snippet"}
            ]
            result = await tool.execute({"query": "test"})
        assert "Test" in result
        assert "example.com" in result

    async def test_yahoo_fallback(self):
        import urllib.request as _ur

        import agent.tools.search as _search_mod
        from agent.tools.search import GoogleSearchTool

        class FakeResp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

            def read(self):
                return (
                    b"<html><body>"
                    b'<div class="dd algo-sr"><a href="https://r.search.yahoo.com/RU=https%3a%2f%2fexample.com/RK=2/">'
                    b'<h3 class="title"><span>Example Title</span></h3></a>'
                    b'<div class="compText">Example snippet description</div></div>'
                    b"</body></html>"
                )

        tool = GoogleSearchTool()
        with (
            patch("duckduckgo_search.DDGS", side_effect=Exception("DDG Rate limit")),
            patch.object(_ur, "urlopen", return_value=FakeResp()),
            patch.object(_search_mod.time, "sleep"),
        ):
            result = await tool.execute({"query": "test"})

        assert "Example Title" in result
        assert "example.com" in result
        assert "Example snippet description" in result


class TestWebFetchTool:
    async def test_invalid_url(self):
        from agent.tools.search import WebFetchTool

        tool = WebFetchTool()
        result = await tool.execute({"url": "ftp://example.com"})
        assert "error" in result.lower()

    async def test_html_to_text(self):
        from agent.tools.search import WebFetchTool

        text = WebFetchTool._html_to_text("<p>Hello</p><script>alert(1)</script>")
        assert "Hello" in text
        assert "alert" not in text

    async def test_html_to_markdown_fallback(self):
        from agent.tools.search import WebFetchTool

        with patch.dict("sys.modules", {"html2text": None}):
            import sys

            old = sys.modules.pop("html2text", None)
            try:
                text = WebFetchTool._html_to_markdown("<p>Hello</p>")
                assert "Hello" in text
            finally:
                if old:
                    sys.modules["html2text"] = old
