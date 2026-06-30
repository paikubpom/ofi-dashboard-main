import hashlib
import io
import logging
import time
from typing import Literal, Dict, Any, List, Optional, Tuple
from fastapi import HTTPException, Request, Response
from playwright.async_api import Browser, Playwright, async_playwright
from PIL import Image

from backend.core.config import settings

ROLE_PATHS: Dict[str, str] = {
    "executive": "/executive",
    "auditor":   "/auditor",
    "owner":     "/owner",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("export")

class PDFExportService:
    def __init__(self, base_url: str = settings.DASHBOARD_BASE_URL, cache_ttl: int = settings.EXPORT_CACHE_TTL):
        self.base_url = base_url
        self.cache_ttl = cache_ttl
        self.cache: Dict[str, Tuple[bytes, float, str]] = {}
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None

    async def initialize(self) -> None:
        """Initialize Playwright and launch the browser with fallback support."""
        self.playwright = await async_playwright().start()
        try:
            # Prefer edge if available
            self.browser = await self.playwright.chromium.launch(
                channel="msedge",
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            log.info("[PDFExportService] Microsoft Edge browser started.")
        except Exception as e:
            log.warning(f"[PDFExportService] Failed to launch with channel 'msedge' ({e}). Falling back to standard Chromium...")
            try:
                # Fallback to standard chromium
                self.browser = await self.playwright.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
                )
                log.info("[PDFExportService] Standard Chromium browser started.")
            except Exception as e2:
                log.error(f"[PDFExportService] Failed to launch standard Chromium: {e2}")
                raise e2

    async def close(self) -> None:
        """Close browser and stop Playwright."""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        log.info("[PDFExportService] Browser shut down.")

    def clear_cache(self) -> None:
        """Clear cache of generated PDF/JPG exports."""
        self.cache.clear()
        log.info("[PDFExportService] Export cache cleared.")

    def _evict_expired_cache(self) -> None:
        """Evict expired items from cache."""
        now = time.monotonic()
        expired = [k for k, (_, ts, _) in self.cache.items() if now - ts > self.cache_ttl]
        for k in expired:
            del self.cache[k]

    def _make_cache_key(self, role: str, fmt: str, width: int, dom_state: Optional[List] = None) -> str:
        """Generate MD5 hash key for caching."""
        import json
        dom_str = json.dumps(dom_state, sort_keys=True) if dom_state else ""
        return hashlib.md5(f"{role}:{fmt}:{width}:{dom_str}".encode()).hexdigest()

    def validate_role(self, role: str) -> None:
        """Raise error if role is not supported."""
        if role.lower() not in ROLE_PATHS:
            raise HTTPException(status_code=404, detail="Role ไม่รองรับ")

    async def _capture_page(
        self,
        role: str,
        output_format: Literal["pdf", "jpg"],
        viewport_width: int = 1440,
        extra_wait_ms: int = 4000,
        token: Optional[str] = None,
        local_state: Optional[Dict] = None,
        session_state: Optional[Dict] = None,
        dom_state: Optional[List] = None,
        base_url: Optional[str] = None,
    ) -> bytes:
        """Launch context, inject states, wait for canvas render, and capture page."""
        if not self.browser:
            raise ValueError("Browser is not initialized.")
            
        actual_base_url = base_url or self.base_url
        url = actual_base_url + ROLE_PATHS[role]
        if role == "owner" and token and token.startswith("owner:"):
            import urllib.parse
            owner_id = token.split(":")[1]
            url += f"?owner={urllib.parse.quote(owner_id)}"


        context = await self.browser.new_context(
            viewport={"width": viewport_width, "height": 900},
            device_scale_factor=2, 
            color_scheme="light", 
            locale="th-TH", 
            timezone_id="Asia/Bangkok",
        )
        try:
            page = await context.new_page()
            
            if token:
                async def inject_auth(route, request):
                    headers = {**request.headers, "Authorization": f"Bearer {token}"}
                    await route.continue_(headers=headers)
                await page.route("**/api/**", inject_auth)

            await page.goto(url, wait_until="networkidle", timeout=60_000)

            # Sync local/session storage states
            if local_state or session_state:
                await page.evaluate("""
                    ([lState, sState]) => {
                        if (lState) Object.keys(lState).forEach(k => localStorage.setItem(k, lState[k]));
                        if (sState) Object.keys(sState).forEach(k => sessionStorage.setItem(k, sState[k]));
                    }
                """, [local_state, session_state])
                await page.reload(wait_until="networkidle", timeout=60_000)
                await page.wait_for_load_state("load")
                await page.wait_for_load_state("domcontentloaded")

            if dom_state:
                await page.evaluate("""
                    (selects) => {
                        selects.forEach((s, index) => {
                            let el = null;
                            if (s.id) el = document.getElementById(s.id);
                            if (!el) {
                                const allSelects = document.querySelectorAll('select');
                                if (allSelects[index]) el = allSelects[index];
                            }
                            if (el && s.value) {
                                el.value = s.value;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                    }
                """, dom_state)
                await page.wait_for_timeout(4000) # Wait for dropdown updates

            try:
                # Wait for table rows to be rendered (max 5 seconds)
                await page.wait_for_selector("tbody tr", timeout=5000)
            except Exception as e:
                log.warning(f"[PDFExportService] Timeout waiting for table rows: {e}. Proceeding.")

            try:
                # Wait for canvas rendering (max 5 seconds)
                await page.wait_for_function("""
                    () => {
                        const canvases = document.querySelectorAll('canvas');
                        if (canvases.length === 0) return true; // Proceed if no canvas exists
                        return Array.from(canvases).every(c => c.width > 0 && c.height > 0);
                    }
                """, timeout=5000)
            except Exception as e:
                log.warning(f"[PDFExportService] Wait for canvas timed out or failed: {e}. Proceeding with capture.")
            
            if session_state and "_EXPORT_CHART_STATE_" in session_state:
                await page.evaluate("""
                    (chartStateStr) => {
                        try {
                            const states = JSON.parse(chartStateStr);
                            if (window.Chart && window.Chart.instances) {
                                const charts = Object.values(window.Chart.instances);
                                states.forEach(state => {
                                    const canvas = document.querySelectorAll('canvas')[state.index];
                                    const chart = charts.find(c => c.canvas === canvas);
                                    if (chart && state.hiddenDatasets.length > 0) {
                                        state.hiddenDatasets.forEach(dsIdx => chart.hide(dsIdx));
                                        chart.update();
                                    }
                                });
                            }
                        } catch(e) {}
                    }
                """, session_state["_EXPORT_CHART_STATE_"])
                await page.wait_for_timeout(1000)
            
            # Wait for animation
            await page.wait_for_timeout(extra_wait_ms)

            # Hide components that shouldn't show in PDF/export
            await page.evaluate("""
                () => {
                    ['#download-pdf-btn', '#download-pdf-btn-wrapper', '[data-hide-on-export]', '.no-export', '#sidebar-container', '#sidebar-toggle-handle', '#sidebar-backdrop'].forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => { 
                            if(el) el.style.display = 'none';
                        });
                    });
                    const style = document.createElement('style');
                    style.textContent = `
                        ::-webkit-scrollbar { display: none !important; }
                        #sidebar-container, #sidebar-toggle-handle, #sidebar-backdrop { display: none !important; }
                        #main-container-layout { margin-left: 0 !important; width: 100% !important; padding-left: 0 !important; }
                    `;
                    document.head.appendChild(style);
                }
            """)

            full_height = await page.evaluate("""
                () => {
                    window.scrollTo(0, document.body.scrollHeight);
                    return Math.max(
                        document.body.scrollHeight, 
                        document.documentElement.scrollHeight, 
                        document.body.offsetHeight, 
                        document.documentElement.offsetHeight
                    );
                }
            """)
            full_height += 100 # Add a buffer to prevent page splitting
            await page.wait_for_timeout(1000) # Wait for image lazy loading

            if output_format == "pdf":
                return await page.pdf(
                    width=f"{viewport_width}px", 
                    height=f"{full_height}px", 
                    print_background=True,
                    margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
                )
            else:
                await page.set_viewport_size({"width": viewport_width, "height": full_height})
                await page.wait_for_timeout(500)
                png_bytes = await page.screenshot(
                    full_page=True, 
                    type="png"
                )
                
                img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=100, optimize=False, subsampling=0)
                return buf.getvalue()
                
        finally:
            await context.close()

    async def export(
        self,
        request: Request,
        role: str,
        fmt: Literal["pdf", "jpg"],
        width: int,
        wait_ms: int,
        nocache: bool,
        filename: str,
        content_type: str,
        local_state: Optional[Dict] = None,
        session_state: Optional[Dict] = None,
        dom_state: Optional[List] = None,
    ) -> Response:
        """Handles PDF/JPG export requests with caching."""
        # Always bypass cache in this implementation, if requested, or keep cache settings
        nocache = True
        self._evict_expired_cache()
        token = request.headers.get("Authorization", "").replace("Bearer ", "") or None
        cache_key = self._make_cache_key(role, fmt, width, dom_state)

        if nocache and cache_key in self.cache:
            del self.cache[cache_key]

        if cache_key in self.cache:
            data, ts, _mime = self.cache[cache_key]
            return Response(
                content=data, 
                media_type=content_type, 
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )

        try:
            request_base_url = str(request.base_url).rstrip('/')
            # Try capturing with a retry mechanism for context destruction errors
            for attempt in range(2):
                try:
                    data = await self._capture_page(
                        role=role.lower(), 
                        output_format=fmt, 
                        viewport_width=width, 
                        extra_wait_ms=wait_ms, 
                        token=token, 
                        local_state=local_state, 
                        session_state=session_state, 
                        dom_state=dom_state,
                        base_url=request_base_url
                    )
                    break
                except Exception as exc:
                    if "context was destroyed" in str(exc).lower() and attempt == 0:
                        log.warning(f"[PDFExportService] Context destroyed during capture. Retrying in 1s...")
                        await asyncio.sleep(1)
                        continue
                    raise exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"ไม่สามารถสร้างไฟล์ได้: {exc}")

        self.cache[cache_key] = (data, time.monotonic(), content_type)
        return Response(
            content=data, 
            media_type=content_type, 
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

pdf_export_service = PDFExportService()
