import { showSharedGlassModal } from '../utils/uiHelpers.js';

/**
 * 👑 ฟังก์ชันเรนเดอร์หน้าจอผู้บริหาร (Executive Dashboard)
 * เวอร์ชันดึงข้อมูลโดยตรงจากฐานข้อมูลสำหรับตารางโครงการ
 */
export function renderExecutiveView(appInstance, chartSettings = {}, currentRole = 'executive') {
    const rawRecords = appInstance.data?.projects || [];

    const formatNumber = (num, decimals = 2) => {
        if (num === null || num === undefined) return '0.00';
        return Number(num).toLocaleString('th-TH', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // --- State & Filters ---
    let currentFilters = {
        modules: [],
        owners: [],
        status: '',
        levels: [],
        search: '',
        year: ''
    };

    let tablePage = 1;
    const tableItemsPerPage = 8; // แสดงผล 8 แถวตามรูปภาพส่งมอบ

    // สกัดข้อมูลตัวเลือกฟิลเตอร์จากข้อมูลโครงการหลังบ้านโดยตรง
    const modulesList = [...new Set(rawRecords.map(r => r.module).filter(Boolean))].sort();
    const ownersList = [...new Set(rawRecords.map(r => r.owner).filter(Boolean))].sort();
    const levelsList = [...new Set(rawRecords.map(r => r.level).filter(Boolean))].sort();
    const yearsList = [...new Set(rawRecords.map(r => r.assessment_year).filter(Boolean))].sort();
    const statusList = [...new Set(rawRecords.map(r => r.status).filter(Boolean))].sort();

    // เรนเดอร์โครงสร้าง Layout หลัก
    appInstance.contentDiv.innerHTML = `
        <!-- KPI Cards Grid -->
        <div id="kpi-cards-wrapper" class="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-6"></div>

        <!-- Filter Panel -->
        <div class="glass-card rounded-3xl border border-slate-200/80 shadow-sm mb-6 overflow-hidden animate-fade-in-up">
            <div class="bg-[#00508F] px-5 py-3.5 flex items-center gap-2">
                <span class="text-white text-lg">🔍</span>
                <span class="text-white font-bold text-sm tracking-wide">กรองข้อมูล</span>
            </div>
            <div class="p-5 space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wide">หมวด</label>
                        <select id="filter-module" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${modulesList.map(m => `<option value="${m}">${m}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wide">สถานะ</label>
                        <select id="filter-status" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${statusList.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wide">ระดับ</label>
                        <select id="filter-level" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${levelsList.map(l => `<option value="${l}">L${l}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wide">ปีประเมิน</label>
                        <select id="filter-year" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${yearsList.map(y => `<option value="${y}">${y}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wide">ผู้ดูแล</label>
                        <select id="filter-owner" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${ownersList.map(o => `<option value="${o}">${o}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="flex gap-2">
                    <input type="text" id="filter-search" placeholder="ค้นหาหัวข้อ, รายละเอียด OFI, หรือผู้รับผิดชอบ..." class="flex-1 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors shadow-inner">
                    <button id="filter-reset-btn" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200">รีเซ็ต</button>
                </div>
            </div>
        </div>

        <!-- Table Container -->
        <div class="glass-card rounded-3xl border border-slate-200/80 shadow-md overflow-hidden w-full animate-fade-in-up">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs sm:text-[13px] table-auto">
                    <thead>
                        <tr class="bg-[#00508F] text-white font-bold text-[11px] uppercase tracking-wider">
                            <th class="py-4 pl-6 pr-4 w-[8%] text-center whitespace-nowrap">SOURCE</th>
                            <th class="py-4 px-4 w-[16%] whitespace-nowrap">PROJECT NAME</th>
                            <th class="py-4 px-4 w-[28%] whitespace-nowrap">DESCRIPTION</th>
                            <th class="py-4 px-4 w-[10%] whitespace-nowrap">OWNER</th>
                            <th class="py-4 px-4 w-[10%] text-center whitespace-nowrap">OUTCOME</th>
                            <th class="py-4 px-4 w-[8%] text-right whitespace-nowrap">PLAN</th>
                            <th class="py-4 px-4 w-[8%] text-right whitespace-nowrap">ACTUAL</th>
                            <th class="py-4 px-4 w-[12%] whitespace-nowrap">PROGRESS</th>
                            <th class="py-4 px-4 w-[12%] whitespace-nowrap">SPONSOR</th>
                            <th class="py-4 pl-4 pr-6 w-[4%] text-center whitespace-nowrap"></th>
                        </tr>
                    </thead>
                    <tbody id="table-project-body" class="divide-y divide-slate-200/60 bg-white/50"></tbody>
                </table>
            </div>
            <div id="table-pagination-controls" class="p-4 bg-slate-50/50 border-t border-slate-200/60"></div>
        </div>
    `;

    const kpiWrapper = document.getElementById('kpi-cards-wrapper');
    const tableBody = document.getElementById('table-project-body');
    const paginationWrapper = document.getElementById('table-pagination-controls');

    const updateDashboard = () => {
        // Filter records
        const filteredRecords = rawRecords.filter(r => {
            if (currentFilters.modules.length > 0 && !currentFilters.modules.includes(r.module)) return false;
            if (currentFilters.status && r.status !== currentFilters.status) return false;
            if (currentFilters.levels.length > 0 && !currentFilters.levels.includes(r.level)) return false;
            if (currentFilters.year && String(r.assessment_year) !== currentFilters.year) return false;
            if (currentFilters.owners.length > 0 && !currentFilters.owners.includes(r.owner)) return false;

            if (currentFilters.search) {
                const q = currentFilters.search.toLowerCase();
                const nameMatch = String(r.project_name || '').toLowerCase().includes(q);
                const descMatch = String(r.description || '').toLowerCase().includes(q);
                const ownerMatch = String(r.owner || '').toLowerCase().includes(q);
                const sponsorMatch = String(r.sponsor || '').toLowerCase().includes(q);
                if (!nameMatch && !descMatch && !ownerMatch && !sponsorMatch) return false;
            }
            return true;
        });

        // Compute KPIs
        const count = filteredRecords.length;
        const target = filteredRecords.reduce((sum, r) => sum + (r.plan || 0), 0);
        const actual = filteredRecords.reduce((sum, r) => sum + (r.actual || 0), 0);
        const progressSum = filteredRecords.reduce((sum, r) => sum + (r.progress || 0), 0);
        const avgProgress = count > 0 ? Math.round(progressSum / count) : 0;

        // Render KPI Cards
        kpiWrapper.innerHTML = `
            <!-- TARGET Card -->
            <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <span class="text-xs text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">🎯 TARGET (YOE BM)</span>
                    <p class="text-3xl font-black text-slate-800 mt-2">${formatNumber(target, 1)}</p>
                </div>
            </div>
            <!-- ACTUAL Card -->
            <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <span class="text-xs text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">📈 ACTUAL YTD (BM)</span>
                    <p class="text-3xl font-black text-[#10B981] mt-2">${formatNumber(actual, 1)}</p>
                </div>
            </div>
            <!-- AVG PROGRESS Card -->
            <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <span class="text-xs text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">⚡ AVG. PROGRESS</span>
                    <p class="text-3xl font-black text-blue-500 mt-2">${avgProgress}%</p>
                </div>
            </div>
            <!-- PROJECTS COUNT Card -->
            <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <span class="text-xs text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">📦 NO. OF PROJECTS</span>
                    <p class="text-3xl font-black text-indigo-500 mt-2">${count}</p>
                </div>
            </div>
        `;

        // Render Table Body
        if (count === 0) {
            tableBody.innerHTML = `<tr><td colspan="10" class="py-10 text-center text-slate-400 font-medium">ไม่พบรายการโครงการที่ตรงตามตัวกรองของคุณ</td></tr>`;
            paginationWrapper.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(count / tableItemsPerPage);
        if (tablePage > totalPages) tablePage = totalPages;
        const startIndex = (tablePage - 1) * tableItemsPerPage;
        const endIndex = startIndex + tableItemsPerPage;
        const pageRecords = filteredRecords.slice(startIndex, endIndex);

        tableBody.innerHTML = pageRecords.map(r => {
            // Determine progress bar color
            const progColor = r.progress < 15 ? 'bg-amber-500' : 'bg-blue-500';

            // Sponsor avatar details
            const sponsorInitials = r.sponsor_avatar || 'S';
            let avatarBg = 'bg-blue-600';
            if (sponsorInitials === 'SL') avatarBg = 'bg-emerald-600';
            else if (sponsorInitials === 'CK') avatarBg = 'bg-[#3B82F6]';

            return `
                <tr data-id="${r.id}" class="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                    <!-- SOURCE -->
                    <td class="py-3 pl-6 pr-4 text-center">
                        <span class="px-2.5 py-0.5 bg-blue-100/70 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-200/50 whitespace-nowrap">${r.source}</span>
                    </td>
                    <!-- PROJECT NAME -->
                    <td class="py-3 px-4">
                        <div class="font-bold text-slate-800 leading-tight">${r.project_name}</div>
                        <div class="mt-1">
                            <span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-md whitespace-nowrap">${r.status}</span>
                        </div>
                    </td>
                    <!-- DESCRIPTION -->
                    <td class="py-3 px-4 text-slate-600 text-xs font-semibold leading-relaxed">
                        ${r.description}
                    </td>
                    <!-- OWNER -->
                    <td class="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">
                        ${r.owner}
                    </td>
                    <!-- OUTCOME -->
                    <td class="py-3 px-4 text-center">
                        <span class="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md whitespace-nowrap">${r.outcome}</span>
                    </td>
                    <!-- PLAN -->
                    <td class="py-3 px-4 text-right font-mono font-bold text-slate-600 whitespace-nowrap">
                        ${formatNumber(r.plan, 2)}
                    </td>
                    <!-- ACTUAL -->
                    <td class="py-3 px-4 text-right font-mono font-bold text-[#10B981] whitespace-nowrap">
                        ${formatNumber(r.actual, 2)}
                    </td>
                    <!-- PROGRESS -->
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2 min-w-[80px]">
                            <div class="w-16 bg-slate-200 h-2 rounded-full overflow-hidden shrink-0">
                                <div class="${progColor} h-full" style="width: ${r.progress}%"></div>
                            </div>
                            <span class="font-mono font-extrabold text-slate-600 text-xs">${r.progress}%</span>
                        </div>
                    </td>
                    <!-- SPONSOR -->
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full ${avatarBg} text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm">${sponsorInitials}</div>
                            <span class="text-xs font-bold text-slate-600 truncate max-w-[120px]" title="${r.sponsor}">${r.sponsor}</span>
                        </div>
                    </td>
                    <!-- SILHOUETTE AVATAR -->
                    <td class="py-3 pl-4 pr-6 text-center">
                        <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200/50">
                            <svg class="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const showProjectsPopup = () => {
            let localFilters = {
                source: '',
                status: '',
                level: '',
                year: '',
                owner: ''
            };

            const sourcesList = [...new Set(filteredRecords.map(r => r.source).filter(Boolean))].sort();
            const statusesList = [...new Set(filteredRecords.map(r => r.status).filter(Boolean))].sort();
            const levelsList = [...new Set(filteredRecords.map(r => r.level).filter(Boolean))].sort();
            const yearsList = [...new Set(filteredRecords.map(r => r.assessment_year).filter(Boolean))].sort();
            const ownersList = [...new Set(filteredRecords.map(r => r.owner).filter(Boolean))].sort();

            const renderPopupRows = () => {
                const filtered = filteredRecords.filter(r => {
                    if (localFilters.source && r.source !== localFilters.source) return false;
                    if (localFilters.status && r.status !== localFilters.status) return false;
                    if (localFilters.level && r.level !== localFilters.level) return false;
                    if (localFilters.year && r.assessment_year !== localFilters.year) return false;
                    if (localFilters.owner && r.owner !== localFilters.owner) return false;
                    return true;
                });

                const tableRowsHtml = filtered.map(r => {
                    const progColor = r.progress < 15 ? 'bg-amber-500' : 'bg-blue-500';
                    const sponsorInitials = r.sponsor_avatar || 'S';
                    let avatarBg = 'bg-blue-600';
                    if (sponsorInitials === 'SL') avatarBg = 'bg-emerald-600';
                    else if (sponsorInitials === 'CK') avatarBg = 'bg-[#3B82F6]';

                    return `
                        <tr data-id="${r.id}" class="hover:bg-slate-50/50 transition-colors group cursor-pointer border-b border-slate-100">
                            <td class="py-3 pl-6 pr-4 text-center">
                                <span class="px-2.5 py-0.5 bg-blue-100/70 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-200/50 whitespace-nowrap">${r.source}</span>
                            </td>
                            <td class="py-3 px-4">
                                <div class="font-bold text-slate-800 leading-tight">${r.project_name}</div>
                                <div class="mt-1">
                                    <span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-md whitespace-nowrap">${r.status}</span>
                                </div>
                            </td>
                            <td class="py-3 px-4 text-slate-600 text-xs font-semibold leading-relaxed">
                                ${r.description}
                            </td>
                            <td class="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">
                                ${r.owner}
                            </td>
                            <td class="py-3 px-4 text-center">
                                <span class="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md whitespace-nowrap">${r.outcome}</span>
                            </td>
                            <td class="py-3 px-4 text-right font-mono font-bold text-slate-600 whitespace-nowrap">
                                ${formatNumber(r.plan, 2)}
                            </td>
                            <td class="py-3 px-4 text-right font-mono font-bold text-[#10B981] whitespace-nowrap">
                                ${formatNumber(r.actual, 2)}
                            </td>
                            <td class="py-3 px-4">
                                <div class="flex items-center gap-2 min-w-[80px]">
                                    <div class="w-16 bg-slate-200 h-2 rounded-full overflow-hidden shrink-0">
                                        <div class="${progColor} h-full" style="width: ${r.progress}%"></div>
                                    </div>
                                    <span class="font-mono font-extrabold text-slate-600 text-xs">${r.progress}%</span>
                                </div>
                            </td>
                            <td class="py-3 px-4">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 rounded-full ${avatarBg} text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm">${sponsorInitials}</div>
                                    <span class="text-xs font-bold text-slate-600 truncate max-w-[120px]" title="${r.sponsor}">${r.sponsor}</span>
                                </div>
                            </td>
                            <td class="py-3 pl-4 pr-6 text-center">
                                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200/50">
                                    <svg class="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');

                const tbody = document.getElementById('popup-table-body');
                if (tbody) tbody.innerHTML = tableRowsHtml || `<tr><td colspan="10" class="py-10 text-center text-slate-400 font-medium">ไม่พบรายการโครงการที่ตรงตามตัวกรองของคุณ</td></tr>`;

                const countEl = document.getElementById('popup-total-count-badge');
                if (countEl) countEl.innerText = `แสดง ${filtered.length} รายการ`;
            };

            const popupContentHtml = `
                <div class="space-y-4">
                    <!-- Popup Filter Bar -->
                    <div class="bg-white/40 border border-white/60 shadow-sm backdrop-blur-md p-4 rounded-2xl flex flex-wrap gap-3 items-center">
                        <span class="text-xs font-bold text-slate-500 flex items-center gap-1">🔎 ตัวกรองด่วน:</span>
                        <select id="popup-filter-source" class="px-2 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400">
                            <option value="">แหล่งที่มา: ทั้งหมด</option>
                            ${sourcesList.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                        <select id="popup-filter-status" class="px-2 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400">
                            <option value="">สถานะ: ทั้งหมด</option>
                            ${statusesList.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                        <select id="popup-filter-level" class="px-2 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400">
                            <option value="">ระดับ: ทั้งหมด</option>
                            ${levelsList.map(l => `<option value="${l}">${l}</option>`).join('')}
                        </select>
                        <select id="popup-filter-year" class="px-2 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400">
                            <option value="">ปีประเมิน: ทั้งหมด</option>
                            ${yearsList.map(y => `<option value="${y}">${y}</option>`).join('')}
                        </select>
                        <select id="popup-filter-owner" class="px-2 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400">
                            <option value="">ผู้ดูแล: ทั้งหมด</option>
                            ${ownersList.map(o => `<option value="${o}">${o}</option>`).join('')}
                        </select>
                        <div class="ml-auto text-xs font-bold text-[#00508F] bg-blue-50 px-3 py-1 rounded-full border border-blue-100 whitespace-nowrap" id="popup-total-count-badge">แสดง ${filteredRecords.length} รายการ</div>
                    </div>

                    <div class="overflow-hidden border border-slate-200/80 rounded-2xl shadow-sm bg-white">
                        <div class="overflow-x-auto max-h-[72vh] overflow-y-auto" style="overscroll-behavior: contain;">
                            <table class="w-full text-left border-collapse text-xs sm:text-[13px] table-auto">
                                <thead>
                                    <tr class="bg-[#00508F] text-white font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                                        <th class="py-4 pl-6 pr-4 w-[8%] text-center whitespace-nowrap">SOURCE</th>
                                        <th class="py-4 px-4 w-[16%] whitespace-nowrap">PROJECT NAME</th>
                                        <th class="py-4 px-4 w-[28%] whitespace-nowrap">DESCRIPTION</th>
                                        <th class="py-4 px-4 w-[10%] whitespace-nowrap">OWNER</th>
                                        <th class="py-4 px-4 w-[10%] text-center whitespace-nowrap">OUTCOME</th>
                                        <th class="py-4 px-4 w-[8%] text-right whitespace-nowrap">PLAN</th>
                                        <th class="py-4 px-4 w-[8%] text-right whitespace-nowrap">ACTUAL</th>
                                        <th class="py-4 px-4 w-[12%] whitespace-nowrap">PROGRESS</th>
                                        <th class="py-4 px-4 w-[12%] whitespace-nowrap">SPONSOR</th>
                                        <th class="py-4 pl-4 pr-6 w-[4%] text-center whitespace-nowrap"></th>
                                    </tr>
                                </thead>
                                <tbody id="popup-table-body" class="divide-y divide-slate-100 bg-white">
                                    <!-- rows injected dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            showSharedGlassModal("ตารางโครงการทั้งหมด", `จำนวนโครงการทั้งหมด ${count} รายการ`, popupContentHtml, 'full');

            renderPopupRows();

            const pSource = document.getElementById('popup-filter-source');
            const pStatus = document.getElementById('popup-filter-status');
            const pLevel = document.getElementById('popup-filter-level');
            const pYear = document.getElementById('popup-filter-year');
            const pOwner = document.getElementById('popup-filter-owner');

            const handleLocalFilterChange = () => {
                localFilters.source = pSource.value;
                localFilters.status = pStatus.value;
                localFilters.level = pLevel.value;
                localFilters.year = pYear.value;
                localFilters.owner = pOwner.value;
                renderPopupRows();
            };

            pSource.addEventListener('change', handleLocalFilterChange);
            pStatus.addEventListener('change', handleLocalFilterChange);
            pLevel.addEventListener('change', handleLocalFilterChange);
            pYear.addEventListener('change', handleLocalFilterChange);
            pOwner.addEventListener('change', handleLocalFilterChange);

            const popupTableBody = document.getElementById('popup-table-body');
            if (popupTableBody) {
                popupTableBody.addEventListener('click', (e) => {
                    const row = e.target.closest('tr');
                    if (!row) return;
                    const id = row.getAttribute('data-id');
                    if (!id) return;
                    const record = rawRecords.find(r => String(r.id) === String(id));
                    if (!record) return;
                    showProjectDetailModal(record);
                });
            }
        };

        const btnOpen = document.getElementById('btn-open-projects-popup');
        if (btnOpen) {
            btnOpen.addEventListener('click', showProjectsPopup);
        }
    };

    const showProjectDetailModal = (record, row = null) => {
        const modalContent = `
            <div class="space-y-5 py-2">
                <div class="p-4 bg-blue-50/40 rounded-2xl border border-blue-100/30 backdrop-blur-md">
                    <h5 class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider mb-1">ชื่อโครงการ (Project Name)</h5>
                    <p class="text-sm font-bold text-slate-800 leading-relaxed">${record.project_name}</p>
                </div>
                
                <div>
                    <h5 class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider mb-2">รายละเอียดโครงการ (Description)</h5>
                    <p class="text-xs font-semibold text-slate-900 leading-relaxed bg-white/40 border border-white/60 shadow-sm backdrop-blur-md p-4 rounded-2xl">${record.description || 'ไม่มีรายละเอียด'}</p>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div class="p-3 bg-white/40 border border-white/60 shadow-sm backdrop-blur-md rounded-xl text-center">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">ผู้ดูแล (Owner)</span>
                        <span class="block text-xs font-bold text-slate-800 mt-1">${record.owner || '-'}</span>
                    </div>
                    <div class="p-3 bg-white/40 border border-white/60 shadow-sm backdrop-blur-md rounded-xl text-center">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">แหล่งที่มา (Source)</span>
                        <span class="block text-xs font-bold text-slate-800 mt-1">${record.source || '-'}</span>
                    </div>
                    <div class="p-3 bg-white/40 border border-white/60 shadow-sm backdrop-blur-md rounded-xl text-center">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">เป้าหมาย (Plan)</span>
                        <span class="block text-xs font-mono font-black text-slate-800 mt-1">${formatNumber(record.plan, 2)}</span>
                    </div>
                    <div class="p-3 bg-white/40 border border-white/60 shadow-sm backdrop-blur-md rounded-xl text-center">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">ผลงานจริง (Actual)</span>
                        <span class="block text-xs font-mono font-black text-slate-800 mt-1">${formatNumber(record.actual, 2)}</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="p-3 bg-white/40 border border-white/60 shadow-sm backdrop-blur-md rounded-xl text-center flex flex-col justify-center animate-pulse">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">ความคืบหน้าโครงการ</span>
                        <div class="flex items-center justify-center gap-3 mt-2">
                            <div class="w-24 bg-slate-200 h-2.5 rounded-full overflow-hidden shrink-0">
                                <div class="bg-blue-500 h-full" style="width: ${record.progress || 0}%"></div>
                            </div>
                            <span class="font-mono font-extrabold text-slate-800 text-xs">${record.progress || 0}%</span>
                        </div>
                    </div>
                    <div class="p-3 bg-white/40 border border-white/60 shadow-sm backdrop-blur-md rounded-xl text-center">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">ผลลัพธ์โครงการ (Outcome)</span>
                        <span class="block text-xs font-bold text-slate-800 mt-1.5">${record.outcome || '-'}</span>
                    </div>
                </div>

                <div class="border-t border-slate-200/40 pt-4 flex justify-between items-center bg-white/40 border border-white/60 shadow-sm backdrop-blur-md p-4 rounded-2xl">
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider">ผู้สนับสนุนโครงการ (Sponsor)</span>
                    </div>
                    <span class="text-xs font-bold text-slate-800">${record.sponsor || '-'}</span>
                </div>
            </div>`;

        const onClose = () => {
            if (row) row.classList.remove('active-selected-row');
        };

        showSharedGlassModal(`รายละเอียดโครงการ: ${record.project_name}`, `ประเภท/ระดับความยาก: ${record.level || 'L3'} | ปีประเมิน: ${record.assessment_year || '2568'}`, modalContent, 'md', onClose);
    };

    // Filter Change Event Handlers
    const filterMod = document.getElementById('filter-module');
    const filterStat = document.getElementById('filter-status');
    const filterLvl = document.getElementById('filter-level');
    const filterYr = document.getElementById('filter-year');
    const filterOwn = document.getElementById('filter-owner');
    const filterSrc = document.getElementById('filter-search');
    const resetBtn = document.getElementById('filter-reset-btn');

    const handleFilterChange = () => {
        currentFilters.modules = filterMod.value ? [filterMod.value] : [];
        currentFilters.status = filterStat.value;
        currentFilters.levels = filterLvl.value ? [filterLvl.value] : [];
        currentFilters.year = filterYr.value;
        currentFilters.owners = filterOwn.value ? [filterOwn.value] : [];
        tablePage = 1;
        updateDashboard();
    };

    filterMod.addEventListener('change', handleFilterChange);
    filterStat.addEventListener('change', handleFilterChange);
    filterLvl.addEventListener('change', handleFilterChange);
    filterYr.addEventListener('change', handleFilterChange);
    filterOwn.addEventListener('change', handleFilterChange);

    filterSrc.addEventListener('input', (e) => {
        currentFilters.search = e.target.value.trim();
        tablePage = 1;
        updateDashboard();
    });

    resetBtn.addEventListener('click', () => {
        filterMod.value = '';
        filterStat.value = '';
        filterLvl.value = '';
        filterYr.value = '';
        filterOwn.value = '';
        filterSrc.value = '';
        currentFilters = { modules: [], owners: [], status: '', levels: [], search: '', year: '' };
        tablePage = 1;
        updateDashboard();
    });

    tableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.getAttribute('data-id');
        if (!id) return;

        const record = rawRecords.find(r => String(r.id) === String(id));
        if (!record) return;

        tableBody.querySelectorAll('tr').forEach(r => {
            r.classList.remove('active-selected-row');
        });
        row.classList.add('active-selected-row');

        showProjectDetailModal(record, row);
    });

    // Initial load
    updateDashboard();
}