import { renderHorizontalBarChart, renderGanttGrid } from '../utils/chartRenderers.js';
import { showSharedGlassModal, zoomChart } from '../utils/uiHelpers.js';

/**
 * 🚗 ฟังก์ชันเนรมิตหน้าแดชบอร์ดของ Process Owner ตัวจริง (เวอร์ชัน Dynamic Dashboard Builder)
 */
export function renderOwnerView(appInstance, chartSettings = {}, currentRole = 'owner') {
    const rawRecords = appInstance.data?.ofis || [];
    const ownerId = appInstance.ownerKey;
    const ownerObj = appInstance.data?.reference?.elementOwners?.find(ow => ow.id === ownerId);
    const ownerName = ownerObj ? ownerObj.name : '';

    // --- ฟังก์ชันช่วยเหลือเกี่ยวกับฟิลด์ต่างๆ (Fuzzy Key Helpers) ---
    const getValueByFuzzyKey = (obj, targetKeys) => {
        if (!obj) return '';
        for (let key of targetKeys) {
            if (obj[key] !== undefined && obj[key] !== null) return obj[key];
        }
        const cleanTargets = targetKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
        for (let key of Object.keys(obj)) {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanTargets.includes(cleanKey)) return obj[key];
        }
        return '';
    };

    const getRecordModule = (r) => String(getValueByFuzzyKey(r, ['module', 'moduleName', 'module_name', 'Module']) || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const getRecordYear = (r) => String(getValueByFuzzyKey(r, ['assessmentYear', 'assessment_year', 'year', 'Year']) || '').trim();
    const getRecordScore = (r) => parseFloat(getValueByFuzzyKey(r, ['score', 'topicScore', 'topic_score', 'Score']) ?? 0) || 0;
    const getRecordStatus = (r) => String(getValueByFuzzyKey(r, ['status', 'ofiStatus', 'ofi_status', 'Status', 'overallStatus']) || '').trim().toLowerCase();

    const getRecordLevel = (r) => {
        const rawLvl = String(getValueByFuzzyKey(r, ['ofiLevel', 'ofi_level', 'level', 'Level']) || '');
        const matchDigits = rawLvl.match(/\d/);
        return matchDigits ? parseInt(matchDigits[0]) : 0;
    };

    const getRecordOwnerName = (r) => String(getValueByFuzzyKey(r, ['elementOwnerName', 'element_owner_name', 'ownerName', 'owner_name', 'elementOwnerId']) || '').trim();
    const getRecordTopicName = (r) => String(getValueByFuzzyKey(r, ['topicName', 'topic_name', 'Topic']) || '').trim();
    const getRecordTitle = (r) => String(getValueByFuzzyKey(r, ['ofiTitle', 'title', 'OFI']) || '').trim();

    // --- สร้างฟิลเตอร์ตัวกรอง และล้าง UI เก่า ---
    let currentFilters = {
        modules: [],
        owners: ownerName ? [ownerName] : [],
        status: '',
        levels: [],
        search: '',
        year: ''
    };

    let tablePage = 1;
    const tableItemsPerPage = 5;

    // เก็บบริบทตัวกรองรายชื่อทั้งหมดเพื่อสร้างตัวเลือก Dropdown
    const modulesList = [...new Set(rawRecords.map(r => getRecordModule(r)).filter(Boolean))].sort();
    const ownersList = [...new Set(rawRecords.map(r => getRecordOwnerName(r)).filter(Boolean))].sort();
    const levelsList = [...new Set(rawRecords.map(r => r.ofiLevel).filter(Boolean))].sort();
    const yearsList = [...new Set(rawRecords.map(r => getRecordYear(r)).filter(Boolean))].sort();

    // ประกอบโครงสร้าง HTML พื้นฐาน (ฟิลเตอร์ + กริดกราฟ + ตารางข้อมูลดิบ)
    appInstance.contentDiv.innerHTML = `
        <div id="kpi-cards-wrapper">
            ${appInstance.getKpiHtml()}
        </div>

        <!-- 2. แถบตัวกรองข้อมูลอัจฉริยะ (Interactive Filters) -->
        <div class="glass-card rounded-3xl border border-slate-200 shadow-sm mb-6 overflow-hidden animate-fade-in-up">
            <div class="bg-[#00508F] px-5 py-3.5 flex items-center gap-2">
                <span class="text-white text-lg">🔍</span>
                <span class="text-white font-bold text-sm tracking-wide">กรองข้อมูล (Filters)</span>
            </div>
            <div class="p-5 space-y-4">
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">หมวด (Module)</label>
                        <select id="filter-module" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${modulesList.map(m => `<option value="${m}">${m}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">ผู้ดูแล (Owner)</label>
                        <select id="filter-owner" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${ownersList.map(o => `<option value="${o}" ${o === ownerName ? 'selected' : ''}>${o}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">สถานะ (Status)</label>
                        <select id="filter-status" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            <option value="progress">In Progress</option>
                            <option value="done">Done / Qualified</option>
                            <option value="delayed">Delayed</option>
                            <option value="not started">Not Started</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">ระดับความยาก (Level)</label>
                        <select id="filter-level" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${levelsList.map(l => `<option value="${l}">L${l}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">ปีประเมิน (Year)</label>
                        <select id="filter-year" class="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                            <option value="">ทั้งหมด (All)</option>
                            ${yearsList.map(y => `<option value="${y}">${y}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="flex gap-2">
                    <input type="text" id="filter-search" placeholder="🔎 ค้นหาหัวข้อ, รายละเอียด OFI, หรือรหัส..." class="w-full px-4 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                    <button id="filter-reset-btn" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200">รีเซ็ต</button>
                </div>
            </div>
        </div>

        <!-- 3. พื้นที่จัดแสดงกราฟ (Grid) -->
        <div id="dynamic-owner-grid" class="grid grid-cols-1 lg:grid-cols-2 gap-6"></div>

        <!-- 4. ส่วนของตารางรายการข้อมูลดิบแบบละเอียดและ Pagination -->
        <div class="glass-card rounded-3xl border border-slate-200/80 shadow-sm w-full mt-6 overflow-hidden animate-fade-in-up bg-white/50">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 pb-4 border-b border-slate-100">
                <div>
                    <h3 class="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">📄 รายการแผนงาน OFI ในระบบ</h3>
                    <p class="text-xs text-slate-400">คลิกที่แถวของตารางเพื่อแสดงรายละเอียดและแผนความคืบหน้าเชิงลึก (Timeline)</p>
                </div>
                <div class="text-xs font-bold text-[#4F46E5] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100" id="table-total-count">แสดง 0 รายการ</div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs sm:text-[13px] table-auto">
                    <thead>
                        <tr class="bg-[#4F46E5] text-white font-bold text-[11px] uppercase tracking-wider divide-x divide-white/10">
                            <th class="py-3.5 px-4 w-[8%] min-w-[70px] text-center whitespace-nowrap">หมวด</th>
                            <th class="py-3.5 px-4 w-[28%] min-w-[200px] whitespace-nowrap">หัวข้อการประเมิน (Topic)</th>
                            <th class="py-3.5 px-4 w-[28%] min-w-[200px] whitespace-nowrap">รายละเอียด OFI (OFI Title)</th>
                            <th class="py-3.5 px-4 w-[12%] min-w-[125px] whitespace-nowrap">ผู้รับผิดชอบ (Owner)</th>
                            <th class="py-3.5 px-4 w-[8%] min-w-[90px] text-center whitespace-nowrap">สถานะ</th>
                            <th class="py-3.5 px-4 w-[8%] min-w-[70px] text-right whitespace-nowrap">คะแนน</th>
                            <th class="py-3.5 px-4 w-[6%] min-w-[60px] text-center whitespace-nowrap">ระดับ</th>
                        </tr>
                    </thead>
                    <tbody id="table-ofi-list-body" class="divide-y divide-slate-200/60 bg-white/50"></tbody>
                </table>
            </div>
            <div id="table-pagination-controls" class="p-4 bg-slate-50/50 border-t border-slate-200/60"></div>
        </div>
    `;

    const kpiWrapper = document.getElementById('kpi-cards-wrapper');
    const gridContainer = document.getElementById('dynamic-owner-grid');
    const tableBody = document.getElementById('table-ofi-list-body');
    const tableCountText = document.getElementById('table-total-count');
    const paginationWrapper = document.getElementById('table-pagination-controls');

    const canShow = (chartId) => {
        if (!chartSettings || !chartSettings[chartId]) return true;
        const roles = chartSettings[chartId].roles;
        if (!Array.isArray(roles)) return true;
        return roles.includes(currentRole);
    };

    // --- ฟังก์ชันวาดกริดและ Canvas เปล่าล่วงหน้า ---
    const buildChartGridElements = () => {
        gridContainer.innerHTML = '';
        if (canShow("chart-gantt-grid")) {
            gridContainer.innerHTML += `
                <div id="gantt-card-wrapper" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm min-h-[380px] flex flex-col justify-between">
                    <div>
                        <h3 class="text-sm sm:text-base font-bold text-slate-800 mb-2">${chartSettings["chart-gantt-grid"]?.title || '4.1 ตารางติดตามสถานะเฟสงาน (Gantt-Grid)'}</h3>
                        <div id="ganttGridContainer" class="overflow-x-auto"></div>
                    </div>
                    <!-- Legend -->
                    <div class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-[11px] font-bold text-slate-500">
                        <span class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 bg-[#10B981] rounded-md shadow-sm"></div> เสร็จสมบูรณ์ (Done)</span>
                        <span class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 bg-[#F59E0B] rounded-md shadow-sm"></div> กำลังดำเนินการ (In Progress)</span>
                        <span class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 bg-[#EF4444] rounded-md shadow-sm"></div> ล่าช้ากว่าแผน (Delayed)</span>
                        <span class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 bg-[#E2E8F0] rounded-md shadow-sm"></div> ยังไม่เริ่ม (Not Started)</span>
                    </div>
                </div>`;
        }
        if (canShow("chart-issue-tags")) {
            gridContainer.innerHTML += `
                <div id="issue-card-wrapper" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm h-[380px] relative">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-sm sm:text-base font-bold text-slate-800">${chartSettings["chart-issue-tags"]?.title || '4.2 ประเด็นปัญหาที่พบบ่อย (Issue Tags)'}</h3>
                        <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-issue-tags" title="ขยายกราฟ (Zoom Chart)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                        </button>
                    </div>
                    <div class="h-[300px]"><canvas id="issueTagsChartCanvas"></canvas></div>
                </div>`;
        }
    };

    const clearCharts = () => {
        if (Array.isArray(appInstance.charts)) {
            appInstance.charts.forEach(c => { if (c && typeof c.destroy === 'function') c.destroy(); });
            appInstance.charts = [];
        }
    };

    // --- ฟังก์ชันหลักในการคัดกรองข้อมูล และอัปเดต Dashboard ---
    const updateDashboard = () => {
        clearCharts();
        buildChartGridElements();

        // 1. ฟิลเตอร์ข้อมูลแบบละเอียด
        const filteredRecords = rawRecords.filter(r => {
            if (currentFilters.modules.length > 0) {
                const recMod = getRecordModule(r);
                if (!currentFilters.modules.includes(recMod)) return false;
            }
            if (currentFilters.owners.length > 0) {
                const recOwn = getRecordOwnerName(r);
                if (!currentFilters.owners.includes(recOwn)) return false;
            }
            if (currentFilters.status) {
                const rStat = getRecordStatus(r);
                if (currentFilters.status === 'done') {
                    if (!['done', 'qualified'].includes(rStat)) return false;
                } else if (currentFilters.status === 'progress') {
                    if (rStat !== 'in progress' && rStat !== 'progress') return false;
                } else if (currentFilters.status === 'delayed') {
                    if (rStat !== 'delayed' && rStat !== 'delay') return false;
                } else if (currentFilters.status === 'not started') {
                    if (rStat !== 'not started') return false;
                }
            }
            if (currentFilters.levels.length > 0) {
                if (!currentFilters.levels.includes(r.ofiLevel)) return false;
            }
            if (currentFilters.year) {
                if (getRecordYear(r) !== currentFilters.year) return false;
            }
            if (currentFilters.search) {
                const searchQ = currentFilters.search.toLowerCase();
                const titleMatch = getRecordTitle(r).toLowerCase().includes(searchQ);
                const topicMatch = getRecordTopicName(r).toLowerCase().includes(searchQ);
                const idMatch = String(r.id || '').toLowerCase().includes(searchQ);
                if (!titleMatch && !topicMatch && !idMatch) return false;
            }
            return true;
        });

        // 2. อัปเดตกล่องตัวเลขสถิติ KPI การ์ด
        const total = filteredRecords.length;
        const completed = filteredRecords.filter(r => ['done', 'qualified'].includes(getRecordStatus(r))).length;
        const successRate = total ? Math.round((completed / total) * 100) : 0;
        const delayed = filteredRecords.filter(r => ['delayed', 'delay'].includes(getRecordStatus(r))).length;

        if (kpiWrapper) {
            kpiWrapper.innerHTML = appInstance.getKpiHtml({ total, successRate, delayed });
        }

        // 3. วาดตารางความก้าวหน้า Gantt 4.1
        if (document.getElementById('ganttGridContainer')) {
            const statusColorsMap = { 'Done': 'green', 'Qualified': 'green', 'In progress': 'yellow', 'Delayed': 'red', 'Not started': 'gray' };
            const ganttTasks = filteredRecords.map(o => ({
                id: getRecordTopicName(o) || 'ไม่ระบุหัวข้อประเมิน',
                plan: statusColorsMap[o.phases?.['phase-plan']?.status] || 'gray',
                boec: statusColorsMap[o.phases?.['phase-eo-ec']?.status] || 'gray',
                assess: statusColorsMap[o.phases?.['phase-assessment']?.status] || 'gray',
                doc: statusColorsMap[o.phases?.['phase-document']?.status] || 'gray',
                site: statusColorsMap[o.phases?.['phase-site-visit']?.status] || 'gray'
            })).slice(0, 8);
            
            const finalTasks = ganttTasks.length > 0 ? ganttTasks : [
                { id: 'ไม่มีงานที่ตรงเงื่อนไข', plan: 'gray', boec: 'gray', assess: 'gray', doc: 'gray', site: 'gray' }
            ];
            renderGanttGrid('ganttGridContainer', finalTasks);
        }

        // 4. วาดกราฟแท่งประเด็นปัญหา 4.2
        if (document.getElementById('issueTagsChartCanvas')) {
            let tagCounts = {};
            filteredRecords.forEach(o => o.issueTags?.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
            let sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

            let issueLabels = sortedTags.map(t => t[0]);
            let issueValues = sortedTags.map(t => t[1]);

            if (issueLabels.length === 0) {
                issueLabels = ['ไม่มีประเด็นปัญหา'];
                issueValues = [0];
            }

            const chart = renderHorizontalBarChart('issueTagsChartCanvas', issueLabels, issueValues, '#8B5CF6');
            if (chart) appInstance.charts.push(chart);
        }

        // 5. จัดการเรนเดอร์ตารางรายการ
        tableCountText.innerText = `แสดง ${total} รายการ`;
        if (total === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-medium">ไม่พบแผนงาน OFI ตรงกับตัวกรองของคุณ</td></tr>`;
            paginationWrapper.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(total / tableItemsPerPage);
        if (tablePage > totalPages) tablePage = totalPages;
        const startIndex = (tablePage - 1) * tableItemsPerPage;
        const endIndex = startIndex + tableItemsPerPage;
        const currentOfis = filteredRecords.slice(startIndex, endIndex);

        tableBody.innerHTML = currentOfis.map(o => {
            const rId = o.id || 'N/A';
            const rMod = getRecordModule(o) || '-';
            const rTopic = getRecordTopicName(o) || 'ไม่ระบุหัวข้อประเมิน';
            const rTitle = getRecordTitle(o) || 'ไม่ระบุรายละเอียด';
            const rOwner = getRecordOwnerName(o) || 'ไม่ระบุผู้ดูแล';
            const rScore = getRecordScore(o).toFixed(4);
            const rLvl = o.ofiLevel || '-';
            const rStat = getRecordStatus(o);

            let badgeClass = 'bg-slate-100 text-slate-700';
            let badgeText = o.overallStatus || 'Not started';
            
            if (['done', 'qualified'].includes(rStat)) {
                badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                badgeText = 'Done';
            } else if (rStat === 'in progress' || rStat === 'progress') {
                badgeClass = 'bg-amber-50 text-amber-700 border border-amber-100';
                badgeText = 'In Progress';
            } else if (rStat === 'delayed' || rStat === 'delay') {
                badgeClass = 'bg-rose-50 text-rose-700 border border-rose-100';
                badgeText = 'Delayed';
            }

            return `
                <tr class="hover:bg-indigo-50/40 transition-colors group cursor-pointer animate-row-enter" data-id="${rId}">
                    <td class="py-3 px-4 font-bold text-slate-700 text-center whitespace-nowrap">${rMod}</td>
                    <td class="py-3 px-4 text-slate-600 max-w-[240px] lg:max-w-[340px] xl:max-w-[440px] truncate" title="${rTopic}">${rTopic}</td>
                    <td class="py-3 px-4 font-semibold text-slate-800 max-w-[260px] lg:max-w-[380px] xl:max-w-[500px] truncate" title="${rTitle}">${rTitle}</td>
                    <td class="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">${rOwner}</td>
                    <td class="py-3 px-4 text-center">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${badgeClass}">${badgeText}</span>
                    </td>
                    <td class="py-3 px-4 text-right font-mono font-bold text-slate-600 whitespace-nowrap">${rScore}</td>
                    <td class="py-3 px-4 text-center font-bold text-[#4F46E5] whitespace-nowrap">${rLvl}</td>
                </tr>
            `;
        }).join('');

        // 6. วาด Pagination ของตาราง
        if (totalPages <= 1) {
            paginationWrapper.innerHTML = '';
        } else {
            const startItem = startIndex + 1;
            const endItem = Math.min(endIndex, total);
            let pagesHtml = '';

            for (let i = 1; i <= totalPages; i++) {
                if (i === tablePage) {
                    pagesHtml += `<button data-page="${i}" class="btn-table-page px-2.5 py-1 text-xs font-bold rounded-lg bg-[#4F46E5] text-white shadow-sm">${i}</button>`;
                } else {
                    pagesHtml += `<button data-page="${i}" class="btn-table-page px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">${i}</button>`;
                }
            }

            paginationWrapper.innerHTML = `
                <div class="flex items-center justify-between">
                    <p class="text-xs text-slate-500 font-medium">แสดง <span class="font-bold text-slate-700">${startItem}</span> ถึง <span class="font-bold text-slate-700">${endItem}</span> จากทั้งหมด <span class="font-bold text-slate-700">${total}</span> รายการ</p>
                    <div class="flex gap-1">
                        <button data-page="${tablePage - 1}" class="btn-table-page px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition" ${tablePage === 1 ? 'disabled' : ''}>&laquo; ก่อนหน้า</button>
                        ${pagesHtml}
                        <button data-page="${tablePage + 1}" class="btn-table-page px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition" ${tablePage === totalPages ? 'disabled' : ''}>ถัดไป &raquo;</button>
                    </div>
                </div>
            `;
        }
    };

    // --- ลงทะเบียน Event Listeners สำหรับตัวกรองข้อมูล ---
    const filterMod = document.getElementById('filter-module');
    const filterOwn = document.getElementById('filter-owner');
    const filterStat = document.getElementById('filter-status');
    const filterLvl = document.getElementById('filter-level');
    const filterYr = document.getElementById('filter-year');
    const filterSrc = document.getElementById('filter-search');
    const resetBtn = document.getElementById('filter-reset-btn');

    const handleFilterChange = () => {
        currentFilters.modules = filterMod.value ? [filterMod.value] : [];
        currentFilters.owners = filterOwn.value ? [filterOwn.value] : [];
        currentFilters.status = filterStat.value;
        currentFilters.levels = filterLvl.value ? [filterLvl.value] : [];
        currentFilters.year = filterYr.value;
        currentFilters.search = filterSrc.value.trim();
        tablePage = 1;
        updateDashboard();
    };

    const debounce = (func, delay) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const handleSearchInput = debounce((e) => {
        currentFilters.search = e.target.value.trim();
        tablePage = 1;
        updateDashboard();
    }, 200);

    filterMod.addEventListener('change', handleFilterChange);
    filterOwn.addEventListener('change', handleFilterChange);
    filterStat.addEventListener('change', handleFilterChange);
    filterLvl.addEventListener('change', handleFilterChange);
    filterYr.addEventListener('change', handleFilterChange);
    filterSrc.addEventListener('input', handleSearchInput);

    resetBtn.addEventListener('click', () => {
        filterMod.value = '';
        filterOwn.value = ownerName;
        filterStat.value = '';
        filterLvl.value = '';
        filterYr.value = '';
        filterSrc.value = '';
        currentFilters = { modules: [], owners: ownerName ? [ownerName] : [], status: '', levels: [], search: '', year: '' };
        tablePage = 1;
        updateDashboard();
        tableBody.querySelectorAll('tr').forEach(r => {
            r.classList.remove('active-selected-row');
        });
    });

    paginationWrapper.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-table-page');
        if (btn && !btn.disabled) {
            tablePage = parseInt(btn.getAttribute('data-page'));
            updateDashboard();
            tableBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    // --- ลงทะเบียน Event สำหรับคลิกแถวตารางเพื่อดึงรายละเอียดโมดอล (Modal Drilldown) ---
    tableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.getAttribute('data-id');
        if (!id || id === 'N/A') return;

        const record = rawRecords.find(r => r.id === id);
        if (!record) return;

        // 🌟 เพิ่มไฮไลท์บรรทัดของข้อมูลที่ถูกเลือก (Row Highlight)
        tableBody.querySelectorAll('tr').forEach(r => {
            r.classList.remove('active-selected-row');
        });
        row.classList.add('active-selected-row');

        const phasesObj = record.phases || {};
        const phasesList = [
            { key: 'phase-plan', label: '1. แผนปรับปรุง' },
            { key: 'phase-eo-ec', label: '2. ตรวจสอบ EO/EC' },
            { key: 'phase-assessment', label: '3. ตรวจประเมินผล' },
            { key: 'phase-document', label: '4. เอกสารเข้าระบบ' },
            { key: 'phase-site-visit', label: '5. ตรวจตรวจเยี่ยมไซต์' }
        ];

        const timelineHtml = phasesList.map(p => {
            const phaseStatus = phasesObj[p.key]?.status || 'Not started';
            let badgeColor = 'bg-slate-100 text-slate-500 border border-slate-200';
            
            if (['done', 'qualified'].includes(phaseStatus.toLowerCase())) {
                badgeColor = 'bg-green-100 text-green-700 border border-green-200';
            } else if (phaseStatus.toLowerCase().includes('progress')) {
                badgeColor = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
            } else if (phaseStatus.toLowerCase().includes('delayed') || phaseStatus.toLowerCase().includes('delay')) {
                badgeColor = 'bg-red-100 text-red-700 border border-red-200';
            }
            
            return `
                <div class="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center flex flex-col justify-between h-20">
                    <span class="block text-[10px] font-extrabold text-slate-700">${p.label}</span>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black inline-block mt-2 ${badgeColor}">${phaseStatus}</span>
                </div>`;
        }).join('');

        let tagsHtml = '<span class="text-xs text-slate-400 font-medium">ไม่มี</span>';
        if (record.issueTags && record.issueTags.length > 0) {
            tagsHtml = record.issueTags.map(t => `<span class="px-2.5 py-1 bg-blue-50 text-[#00508F] border border-blue-100 text-[10px] font-bold rounded-xl shadow-sm">${t}</span>`).join(' ');
        }

        const score = getRecordScore(record).toFixed(4);
        const modalContent = `
            <div class="space-y-5 py-2">
                <div class="p-4 bg-blue-50/70 rounded-2xl border border-blue-100/80">
                    <h5 class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider mb-1">หัวข้อการประเมิน (Assessment Topic)</h5>
                    <p class="text-xs font-bold text-slate-800 leading-relaxed">${getRecordTopicName(record)}</p>
                </div>
                
                <div>
                    <h5 class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider mb-2">รายละเอียดข้อเสนอแนะหลัก (OFI Description)</h5>
                    <p class="text-sm font-semibold text-slate-900 leading-relaxed bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">${getRecordTitle(record)}</p>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div class="p-3 bg-slate-50/80 rounded-xl text-center border border-slate-100">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">ผู้ดูแลแผนงาน</span>
                        <span class="block text-xs font-bold text-slate-800 mt-1">${getRecordOwnerName(record)}</span>
                    </div>
                    <div class="p-3 bg-slate-50/80 rounded-xl text-center border border-slate-100">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">คะแนนผลลัพธ์</span>
                        <span class="block text-xs font-mono font-black text-[#00508F] mt-1">${score} / 5.0000</span>
                    </div>
                    <div class="p-3 bg-slate-50/80 rounded-xl text-center border border-slate-100">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">ระดับความยาก</span>
                        <span class="block text-xs font-black text-[#00508F] mt-1">${record.ofiLevel || 'อื่นๆ'}</span>
                    </div>
                    <div class="p-3 bg-slate-50/80 rounded-xl text-center border border-slate-100">
                        <span class="block text-[10px] font-extrabold text-slate-600 uppercase">แหล่งที่มาของปัญหา</span>
                        <span class="block text-xs font-bold text-slate-800 mt-1">${record.defectSource || '-'}</span>
                    </div>
                </div>

                <div class="space-y-2">
                    <h5 class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider">ประเด็นปัญหาสำคัญ (Issue Tags)</h5>
                    <div class="flex gap-2.5 flex-wrap">${tagsHtml}</div>
                </div>

                <div class="border-t border-slate-200/50 pt-4">
                    <h5 class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        สถานะการดำเนินงานรายขั้นตอน (Phase Status Timeline)
                    </h5>
                    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">${timelineHtml}</div>
                </div>

                <!-- 💾 ส่วนแสดงไฟล์ Database ต้นทางสำหรับข้อมูลนี้ -->
                <div class="border-t border-slate-200/50 pt-4 flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span class="text-[11px] font-extrabold text-[#00508F] uppercase tracking-wider">💾 ไฟล์คลังข้อมูล (Source Database File)</span>
                    <a href="/static-data/${record._source_file || 'data.json'}" target="_blank" class="px-4 py-2 bg-[#00508F] hover:bg-[#003d70] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
                        📂 เปิดดูไฟล์: ${record._source_file || 'ไม่มีไฟล์'}
                    </a>
                </div>
            </div>`;

        const onClose = () => {
            row.classList.remove('active-selected-row');
        };

        showSharedGlassModal(`รายละเอียดแผนงาน OFI: ${id}`, `จากแหล่งข้อมูล: ${record._source_file || 'คลังข้อมูลกลาง'}`, modalContent, 'md', onClose);
    });

    // --- ระบบ Click เพื่อขยายขนาดกราฟ (Accessibility Zoom) ---
    gridContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-expand-chart');
        if (btn) {
            e.stopPropagation();
            const chartId = btn.getAttribute('data-chart-id');
            if (chartId === 'chart-issue-tags') {
                zoomChart('issueTagsChartCanvas');
            }
        }
    });

    // เริ่มต้นแสดงผลหน้ากระดานแดชบอร์ดครั้งแรก
    updateDashboard();
}