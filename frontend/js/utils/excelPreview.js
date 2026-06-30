import * as XLSX from 'xlsx';
import { showSharedGlassModal, showSharedGlassToast } from './uiHelpers.js';

export async function showExcelPreviewModal(fileUrl, fileName, highlightKey = '', onCloseCallback = null) {
    // 1. Show loading overlay
    const loader = document.createElement('div');
    loader.id = 'excel-preview-loader';
    loader.className = 'fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[100000] flex flex-col items-center justify-center text-slate-800 font-sans';
    loader.innerHTML = `
        <div class="glass-card p-6 rounded-2xl border border-white/60 flex flex-col items-center gap-4 shadow-2xl text-center max-w-xs mx-4 animate-fade-in-up">
            <div class="w-9 h-9 border-4 border-[#00508F] border-t-transparent rounded-full animate-spin"></div>
            <div>
                <h5 class="text-sm font-black text-[#00508F]">กำลังอ่านไฟล์ Excel...</h5>
                <p class="text-[10px] text-slate-500 font-bold mt-1">กำลังประมวลผลข้อมูลตารางพรีวิว</p>
            </div>
        </div>`;
    document.body.appendChild(loader);

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();

        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('ไม่พบข้อมูลแผ่นงาน (Sheet) ในไฟล์ Excel นี้');
        }

        loader.remove();

        // Active sheet defaults to the first one
        let activeSheetName = workbook.SheetNames[0];

        // Let's create a function to render the sheet table HTML
        const generateTableHtml = (sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            // Get all data, header: 1 returns 2D array of rows
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            if (json.length === 0) {
                return `<div class="p-8 text-center text-slate-400 font-medium">ไม่มีข้อมูลในแผ่นงาน "${sheetName}"</div>`;
            }

            // Let's build the table
            let tableHtml = `
                <div class="overflow-hidden border border-slate-200/80 rounded-2xl shadow-sm bg-white mt-4">
                    <div class="overflow-x-auto max-h-[60vh] overflow-y-auto" style="overscroll-behavior: contain;" id="excel-table-scroll-container">
                        <table class="w-full text-left border-collapse text-xs sm:text-[13px] table-auto">
                            <thead>
                                <tr class="bg-[#00508F] text-white font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10">`;

            // First row is header row
            const headers = json[0];
            headers.forEach((h, idx) => {
                const padClass = idx === 0 ? 'pl-6 pr-4' : (idx === headers.length - 1 ? 'pl-4 pr-6' : 'px-4');
                tableHtml += `<th class="py-3.5 ${padClass} whitespace-nowrap">${h || `คอลัมน์ ${idx + 1}`}</th>`;
            });
            tableHtml += `</tr></thead>
                         <tbody class="divide-y divide-slate-100 bg-white">`;

            // Data rows
            for (let rIdx = 1; rIdx < json.length; rIdx++) {
                const row = json[rIdx];
                // Check if row has any non-empty cells
                if (row.every(cell => cell === '')) continue;

                // Check for matches
                let hasHighlight = false;

                if (highlightKey) {
                    const clean = (str) => String(str || '').toLowerCase().replace(/[\s\r\n\t\xa0]/g, '');
                    const cleanHighlight = clean(highlightKey);
                    
                    if (cleanHighlight) {
                        const rowText = row.map(c => clean(c)).join(' ');
                        // Check for substring match in either direction
                        if (rowText.includes(cleanHighlight) || cleanHighlight.includes(rowText)) {
                            hasHighlight = true;
                        } else {
                            // If highlightKey is long, try matching a substantial chunk
                            const shortHighlight = cleanHighlight.substring(0, 20);
                            if (shortHighlight.length >= 8 && rowText.includes(shortHighlight)) {
                                hasHighlight = true;
                            }
                        }
                    }
                }

                const highlightClass = hasHighlight 
                    ? 'bg-amber-200/95 hover:bg-amber-300/80 border-l-[8px] border-amber-600 shadow-md transition-all duration-300 scale-[1.002] origin-left' 
                    : 'hover:bg-slate-50/50 transition-colors';
                
                const rowIdAttr = hasHighlight ? `id="excel-highlighted-row"` : '';

                tableHtml += `<tr ${rowIdAttr} class="${highlightClass}">`;
                row.forEach((cell, idx) => {
                    const padClass = idx === 0 ? 'pl-6 pr-4' : (idx === row.length - 1 ? 'pl-4 pr-6' : 'px-4');
                    // Format cell values nicely
                    let cellVal = cell;
                    if (typeof cell === 'number') {
                        if (cell % 1 !== 0) cellVal = cell.toFixed(4); // Keep decimal precision for scores
                    }
                    tableHtml += `<td class="py-3.5 ${padClass} ${hasHighlight ? 'text-amber-950 font-black' : 'text-slate-700'} whitespace-nowrap">${cellVal}</td>`;
                });
                tableHtml += `</tr>`;
            }

            tableHtml += `</tbody></table></div></div>`;
            return tableHtml;
        };

        // Render Sheet Tabs HTML
        const renderTabsHtml = () => {
            return workbook.SheetNames.map(name => {
                const activeClass = name === activeSheetName
                    ? 'bg-[#00508F] text-white font-bold border-[#00508F]'
                    : 'bg-white hover:bg-blue-50/70 hover:text-[#00508F] text-slate-600 font-semibold border-slate-200';
                return `
                    <button class="excel-sheet-tab px-4 py-2 text-xs border rounded-xl shadow-sm transition-all duration-300 shrink-0 ${activeClass}" data-sheet-name="${name}">
                        📊 ${name}
                    </button>
                `;
            }).join('');
        };

        // Build the full modal body content
        const modalContentHtml = `
            <div class="space-y-4" id="excel-preview-modal-body" style="overscroll-behavior: contain;">
                <!-- Toolbar with Search Bar and Sheet Tabs -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/40 p-4 rounded-2xl border border-blue-100/30 backdrop-blur-md">
                    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-1 pr-2" id="excel-tabs-container">
                        ${renderTabsHtml()}
                    </div>
                    <div class="relative w-full sm:w-72 shrink-0">
                        <input type="text" id="excel-local-search" placeholder="ค้นหาข้อมูลในตาราง..." class="w-full pl-9 pr-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-[#00508F] focus:ring-1 focus:ring-[#00508F]/25 transition-colors shadow-inner">
                        <span class="absolute left-3 top-2.5 text-[10px]">🔎</span>
                    </div>
                </div>

                <!-- Excel Table Container -->
                <div id="excel-table-container">
                    ${generateTableHtml(activeSheetName)}
                </div>
            </div>
        `;

        showSharedGlassModal(
            `ตัวอย่างไฟล์ Excel: ${fileName}`,
            highlightKey ? `OFI: "${highlightKey}" ` : 'สามารถสลับดูชีตอื่นๆ และค้นหาข้อความได้ด้านล่าง',
            modalContentHtml,
            'full',
            onCloseCallback
        );

        // Bind events and perform auto-scrolling
        const initModalBehaviors = () => {
            const tabsContainer = document.getElementById('excel-tabs-container');
            const searchInput = document.getElementById('excel-local-search');
            const tableContainer = document.getElementById('excel-table-container');

            if (!tabsContainer || !searchInput || !tableContainer) return;

            // Handle tab switching
            tabsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.excel-sheet-tab');
                if (!btn) return;
                activeSheetName = btn.dataset.sheetName;
                
                // Update active tab buttons styles
                tabsContainer.querySelectorAll('.excel-sheet-tab').forEach(t => {
                    if (t.dataset.sheetName === activeSheetName) {
                        t.className = 'excel-sheet-tab px-4 py-2 text-xs border rounded-xl shadow-sm transition-all duration-300 shrink-0 bg-[#00508F] text-white font-bold border-[#00508F]';
                    } else {
                        t.className = 'excel-sheet-tab px-4 py-2 text-xs border rounded-xl shadow-sm transition-all duration-300 shrink-0 bg-white hover:bg-blue-50/70 hover:text-[#00508F] text-slate-600 font-semibold border-slate-200';
                    }
                });

                // Regenerate table
                tableContainer.innerHTML = generateTableHtml(activeSheetName);
                
                // Re-apply local search query if exists
                const query = searchInput.value.toLowerCase().trim();
                if (query) {
                    tableContainer.querySelectorAll('tbody tr').forEach(row => {
                        const text = row.textContent.toLowerCase();
                        row.classList.toggle('hidden', !text.includes(query));
                    });
                }
                scrollToHighlightedRow();
            });

            // Handle local searching (highly optimized CSS-based filter)
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase().trim();
                tableContainer.querySelectorAll('tbody tr').forEach(row => {
                    if (!query) {
                        row.classList.remove('hidden');
                        return;
                    }
                    const text = row.textContent.toLowerCase();
                    row.classList.toggle('hidden', !text.includes(query));
                });
            });

            // Smooth scroll to highlighted row
            const scrollToHighlightedRow = () => {
                setTimeout(() => {
                    const highlightedRow = document.getElementById('excel-highlighted-row');
                    const scrollContainer = document.getElementById('excel-table-scroll-container');
                    if (highlightedRow && scrollContainer) {
                        // Smoothly scroll the table container so that the highlighted row is centered
                        const containerHeight = scrollContainer.clientHeight;
                        const rowTop = highlightedRow.offsetTop;
                        const rowHeight = highlightedRow.clientHeight;
                        scrollContainer.scrollTo({
                            top: rowTop - (containerHeight / 2) + (rowHeight / 2),
                            behavior: 'smooth'
                        });
                    }
                }, 100);
            };

            // Run scroll initially
            scrollToHighlightedRow();
        };

        // Initialize modal behaviors
        setTimeout(initModalBehaviors, 100);

    } catch (err) {
        if (document.getElementById('excel-preview-loader')) {
            document.getElementById('excel-preview-loader').remove();
        }
        console.error("Excel Preview Error:", err);
        showSharedGlassToast("ไม่สามารถเปิดพรีวิวไฟล์ Excel ได้ กรุณาลองดาวน์โหลดเพื่อเข้าดูไฟล์แทนครับ", "error");
    }
}
