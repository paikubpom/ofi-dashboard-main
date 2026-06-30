import { showSharedGlassToast } from './uiHelpers.js';

/**
 * 🚀 ระบบส่งออกรายงาน (เวอร์ชัน Client-side + Chart.js Fix + Layout Scale Fix)
 * แก้ปัญหากราฟหาย (Animation conflict) และแก้ปัญหาภาพโดนครอปหรือล้นจอ
 */
export function initGlobalPdfExport(roleName) {
    const createExportButton = () => {
        if (document.getElementById('download-pdf-btn')) return null;

        const btn = document.createElement('button');
        btn.id = 'download-pdf-btn';
        btn.className = 'px-3 py-1.5 bg-[#00508F] hover:bg-[#003D6F] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 ml-3';
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>ส่งออกรายงาน</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        `;

        const dropdown = document.createElement('div');
        dropdown.id = 'export-dropdown';
        dropdown.className = 'absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 z-[99999] overflow-hidden hidden';
        dropdown.style.minWidth = '160px';
        dropdown.innerHTML = `
            <button data-fmt="pdf" class="export-fmt-btn w-full px-4 py-2.5 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <span class="text-red-500">📄</span> ส่งออก PDF
            </button>
            <button data-fmt="jpg" class="export-fmt-btn w-full px-4 py-2.5 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <span class="text-blue-500">🖼️</span> ส่งออก JPG
            </button>
        `;

        const wrapper = document.createElement('div');
        wrapper.id = 'download-pdf-btn-wrapper';
        wrapper.className = 'no-export';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-flex';
        wrapper.appendChild(btn);
        wrapper.appendChild(dropdown);

        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', () => dropdown.classList.add('hidden'));

        dropdown.addEventListener('click', async (e) => {
            const fmtBtn = e.target.closest('[data-fmt]');
            if (!fmtBtn) return;

            const fmt = fmtBtn.dataset.fmt;
            dropdown.classList.add('hidden');
            btn.disabled = true;

            const loader = document.createElement('div');
            loader.id = 'ptt-pdf-loading-screen';
            loader.className = 'fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100000] flex flex-col items-center justify-center text-white font-sans';
            loader.innerHTML = `
                <div class="p-5 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center gap-4 shadow-2xl text-center max-w-xs mx-4">
                    <div class="w-9 h-9 border-4 border-[#00508F] border-t-transparent rounded-full animate-spin"></div>
                    <div><h5 class="text-sm font-bold">กำลังสร้างไฟล์ ${fmt.toUpperCase()}</h5>
                    <p class="text-[10px] text-slate-400 mt-1">กำลังเรนเดอร์กราฟและภาพ กรุณารอสักครู่...</p>
                    </div>
                </div>`;
            document.body.appendChild(loader);

            try {
                const ts = Date.now();
                const localState = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    localState[k] = localStorage.getItem(k);
                }
                const sessionState = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    sessionState[k] = sessionStorage.getItem(k);
                }

                try {
                    if (window.Chart && window.Chart.instances) {
                        const chartStates = Object.values(window.Chart.instances).map(chart => {
                            const hidden = [];
                            chart.data.datasets.forEach((ds, idx) => {
                                if (!chart.isDatasetVisible(idx)) hidden.push(idx);
                            });
                            return {
                                index: Array.from(document.querySelectorAll('canvas')).indexOf(chart.canvas),
                                hiddenDatasets: hidden
                            };
                        });
                        sessionState['_EXPORT_CHART_STATE_'] = JSON.stringify(chartStates);
                    }
                } catch (err) {
                    console.warn("ไม่สามารถอ่านสถานะกราฟได้:", err);
                }

                const domState = Array.from(document.querySelectorAll('select')).map(sel => ({
                    id: sel.id,
                    value: sel.value
                }));

                const viewportWidth = window.innerWidth;
                const endpoint = fmt === 'pdf' 
                    ? `/api/export-pdf/${roleName.toLowerCase()}?nocache=true&width=${viewportWidth}` 
                    : `/api/export-jpg/${roleName.toLowerCase()}?nocache=true&width=${viewportWidth}`;

                let authHeader = `Bearer ${roleName.toLowerCase()}`;
                if (roleName.toLowerCase() === 'owner') {
                    const urlParams = new URLSearchParams(window.location.search);
                    const ownerKey = urlParams.get('owner') || '';
                    authHeader = `Bearer owner:${encodeURIComponent(ownerKey)}`;
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        local_state: localState,
                        session_state: sessionState,
                        dom_state: domState
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server Error: ${response.status} - ${errorText}`);
                }

                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.style.display = 'none';
                downloadLink.href = downloadUrl;
                downloadLink.download = `PTT_OFI_${roleName.toUpperCase()}_Report_${ts}.${fmt}`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                window.URL.revokeObjectURL(downloadUrl);
                downloadLink.remove();

                showSharedGlassToast(`ดาวน์โหลดรายงาน ${fmt.toUpperCase()} สำเร็จ 🎉`, "success");
            } catch (err) {
                console.error("Export Error:", err);
                showSharedGlassToast("เกิดข้อผิดพลาดในการสร้างไฟล์ กรุณาลองใหม่อีกครั้งครับ", "error");
            } finally {
                loader.remove();
                btn.disabled = false;
            }
        });

        return wrapper;
    };

    const injectButtonToHeader = () => {
        const headerContainer = document.getElementById('global-header');
        if (!headerContainer || headerContainer.innerHTML.trim() === "") return;
        if (document.getElementById('download-pdf-btn')) return;

        const allElements = headerContainer.getElementsByTagName('*');
        let timestampBox = null;

        for (let el of allElements) {
            if (el.textContent.includes('อัปเดตล่าสุด') || el.textContent.includes('น.')) {
                if (el.children.length === 0 || el.tagName === 'SPAN' || el.className.includes('text-')) timestampBox = el;
            }
        }

        if (timestampBox) {
            const wrapper = createExportButton();
            if (!wrapper) return;
            const targetWrapper = timestampBox.closest('div') || timestampBox.parentNode;
            targetWrapper.style.display = 'flex';
            targetWrapper.style.alignItems = 'center';
            targetWrapper.style.justifyContent = 'end';
            targetWrapper.appendChild(wrapper);
        }
    };

    const targetHeader = document.getElementById('global-header');
    if (targetHeader) {
        const observer = new MutationObserver(() => { injectButtonToHeader(); });
        observer.observe(targetHeader, { childList: true, subtree: true });
    }

    injectButtonToHeader();
}