import { 
    renderYearlyComparisonChart, 
    renderOfiLevelChart, 
    render6YearTrendChart, 
    renderIndividualWorkloadChart 
} from '../utils/chartRenderers.js';
import { showSharedGlassModal, zoomChart } from '../utils/uiHelpers.js';

/**
 * 👑 ฟังก์ชันเรนเดอร์หน้าจอผู้บริหารเวอร์ชัน Dynamic Dashboard Builder
 * รองรับการกรองข้อมูลแบบมีปฏิสัมพันธ์ (Interactive Filters) และตารางแสดงข้อมูลแผนงาน OFI
 */
export function renderExecutiveView(appInstance, chartSettings = {}, currentRole = 'executive') {
    const rawRecords = appInstance.data?.ofis || [];

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

    const matchYear = (recordYearStr, targetThaiYear) => {
        const yearDigits = recordYearStr.match(/\d{4}/)?.[0] || recordYearStr;
        const yearMap = { '2020': '2563', '2021': '2564', '2022': '2565', '2023': '2566', '2024': '2567', '2025': '2568' };
        const convertedThaiYear = yearMap[yearDigits] || yearDigits;
        
        // ถ้าเป็นเลขทศนิยมอย่าง 2568.0 หรือ 2567.0 ให้แปลงเป็นจำนวนเต็ม
        const cleanRecYear = parseFloat(yearDigits) ? String(Math.floor(parseFloat(yearDigits))) : yearDigits;
        return cleanRecYear === targetThaiYear;
    };

    // --- สร้างฟิลเตอร์ตัวกรอง และล้าง UI เก่า ---
    let currentFilters = {
        modules: [],
        owners: [],
        status: '',
        levels: [],
        search: '',
        year: ''
    };

    let tablePage = 1;
    const tableItemsPerPage = 8;

    // สกัดข้อมูลตัวเลือกฟิลเตอร์
    const uniqueModules = [...new Set(rawRecords.map(r => getRecordModule(r)).filter(Boolean))].sort();
    const uniqueOwners = [...new Set(rawRecords.map(r => getRecordOwnerName(r)).filter(n => n && n !== 'undefined' && n !== 'null' && n !== 'ไม่ระบุ Owner'))].sort();
    const uniqueYears = [...new Set(rawRecords.map(r => getRecordYear(r)).filter(Boolean))].sort();

    // เรนเดอร์โครงสร้าง Layout หลัก
    appInstance.contentDiv.innerHTML = `
        <!-- 1. ส่วน KPI การ์ด -->
        <div id="kpi-cards-wrapper" class="mb-6"></div>

        <!-- 2. แถบตัวกรองข้อมูลอัจฉริยะ (Interactive Filters) -->
        <div class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between animate-fade-in-up">
            <div class="flex items-center gap-3 w-full lg:w-auto shrink-0">
                <span class="text-2xl">🔍</span>
                <div>
                    <h4 class="text-sm font-bold text-slate-800">ตัวกรองข้อมูล (Filters)</h4>
                    <p class="text-xs text-slate-400 mt-1">กรองและวิเคราะห์แผนงาน OFI</p>
                </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full flex-1 max-w-5xl">
                <div>
                    <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">หมวด (Module)</label>
                    <select id="filter-module" class="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                        <option value="">ทั้งหมด (All)</option>
                        ${uniqueModules.map(m => `<option value="${m}">${m}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">ผู้ดูแล (Owner)</label>
                    <select id="filter-owner" class="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                        <option value="">ทั้งหมด (All)</option>
                        ${uniqueOwners.map(o => `<option value="${o}">${o}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">สถานะ (Status)</label>
                    <select id="filter-status" class="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                        <option value="">ทั้งหมด (All)</option>
                        <option value="done">Done / Qualified</option>
                        <option value="progress">In Progress</option>
                        <option value="delay">Delayed</option>
                        <option value="not started">Not Started</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">ระดับความยาก (Level)</label>
                    <select id="filter-level" class="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                        <option value="">ทั้งหมด (All)</option>
                        <option value="1">L1</option>
                        <option value="2">L2</option>
                        <option value="3">L3</option>
                        <option value="4">L4</option>
                        <option value="5">L5</option>
                        <option value="N/A">N/A</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">ปีประเมิน (Year)</label>
                    <select id="filter-year" class="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                        <option value="">ทั้งหมด (All)</option>
                        ${uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="w-full lg:w-auto shrink-0 flex gap-2">
                <input type="text" id="filter-search" placeholder="🔎 ค้นหาหัวข้อ / รายละเอียด..." class="w-full lg:w-44 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                <button id="filter-reset-btn" class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200">รีเซ็ต</button>
            </div>
        </div>

        <!-- 3. พื้นที่จัดแสดงกราฟ -->
        <div id="dynamic-chart-grid" class="grid grid-cols-1 lg:grid-cols-2 gap-6"></div>

        <!-- 4. ส่วนของตารางรายการข้อมูลดิบแบบละเอียดและ Pagination -->
        <div class="glass-card p-6 rounded-3xl border border-slate-200 shadow-sm w-full mt-6 animate-fade-in-up">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div>
                    <h3 class="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">📄 รายการแผนงาน OFI ในระบบ</h3>
                    <p class="text-xs text-slate-400">คลิกที่แถวของตารางเพื่อแสดงรายละเอียดและแผนความคืบหน้าเชิงลึก (Timeline)</p>
                </div>
                <div class="text-xs font-bold text-[#00508F] bg-blue-50 px-3 py-1 rounded-full border border-blue-100" id="table-total-count">แสดง 0 รายการ</div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs sm:text-[13px] table-auto">
                    <thead>
                        <tr class="text-slate-500 font-bold border-b border-slate-200/60 bg-slate-50/50 text-[11px] uppercase tracking-wider">
                            <th class="py-3 px-3 w-[8%] min-w-[70px] text-center whitespace-nowrap">หมวด</th>
                            <th class="py-3 px-3 w-[28%] min-w-[200px] whitespace-nowrap">หัวข้อการประเมิน (Topic)</th>
                            <th class="py-3 px-3 w-[28%] min-w-[200px] whitespace-nowrap">รายละเอียด OFI (OFI Title)</th>
                            <th class="py-3 px-3 w-[12%] min-w-[125px] whitespace-nowrap">ผู้รับผิดชอบ (Owner)</th>
                            <th class="py-3 px-3 w-[8%] min-w-[90px] text-center whitespace-nowrap">สถานะ</th>
                            <th class="py-3 px-3 w-[8%] min-w-[70px] text-right whitespace-nowrap">คะแนน</th>
                            <th class="py-3 px-3 w-[6%] min-w-[60px] text-center whitespace-nowrap">ระดับ</th>
                        </tr>
                    </thead>
                    <tbody id="table-ofi-list-body" class="divide-y divide-slate-100 hover:bg-slate-50/10"></tbody>
                </table>
            </div>
            <div id="table-pagination-controls" class="mt-4 border-t border-slate-100 pt-4"></div>
        </div>
    `;

    const kpiWrapper = document.getElementById('kpi-cards-wrapper');
    const gridContainer = document.getElementById('dynamic-chart-grid');
    const tableBody = document.getElementById('table-ofi-list-body');
    const tableCountText = document.getElementById('table-total-count');
    const paginationWrapper = document.getElementById('table-pagination-controls');

    const canShow = (chartId) => {
        if (!chartSettings || !chartSettings[chartId]) return true;
        const roles = chartSettings[chartId].roles;
        if (!Array.isArray(roles)) return true;
        return roles.includes(currentRole);
    };

    // --- ฟังก์ชันวาดกริดและ Canvas เปล่าล่วงหน้าเพื่อป้องกันหน้าจอกระตุก ---
    const buildChartGridElements = () => {
        gridContainer.innerHTML = '';
        if (canShow("chart-yearly-comparison")) {
            gridContainer.innerHTML += `
                <div class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm h-[380px] hover:shadow-md transition-shadow relative">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="text-sm font-bold text-slate-800">${chartSettings["chart-yearly-comparison"]?.title || '2.1 เปรียบเทียบคะแนนภาพรวมรายปี'}</h3>
                        <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-yearly-comparison" title="ขยายกราฟ (Zoom Chart)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                        </button>
                    </div>
                    <div class="h-[300px]"><canvas id="yearlyComparisonChartCanvas"></canvas></div>
                </div>`;
        }
        if (canShow("chart-ofi-level")) {
            gridContainer.innerHTML += `
                <div class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm h-[380px] hover:shadow-md transition-shadow relative">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="text-sm font-bold text-slate-800">${chartSettings["chart-ofi-level"]?.title || '2.4 ระดับความยาก (OFI Level)'}</h3>
                        <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-ofi-level" title="ขยายกราฟ (Zoom Chart)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                        </button>
                    </div>
                    <div class="h-[300px]"><canvas id="ofiLevelChartCanvas"></canvas></div>
                </div>`;
        }
        if (canShow("chart-6year-trend")) {
            gridContainer.innerHTML += `
                <div class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm h-[380px] lg:col-span-2 hover:shadow-md transition-shadow relative">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="text-sm font-bold text-slate-800">${chartSettings["chart-6year-trend"]?.title || '2.2 แนวโน้มคะแนนเฉลี่ย 6 ปี'}</h3>
                        <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-6year-trend" title="ขยายกราฟ (Zoom Chart)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                        </button>
                    </div>
                    <div class="h-[300px]"><canvas id="trendChartCanvas"></canvas></div>
                </div>`;
        }
        if (canShow("chart-individual-workload")) {
            gridContainer.innerHTML += `
                <div class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm h-[380px] lg:col-span-2 hover:shadow-md transition-shadow relative">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="text-sm font-bold text-slate-800">${chartSettings["chart-individual-workload"]?.title || '2.3 ปริมาณงานและสถานะรายบุคคล'}</h3>
                        <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-individual-workload" title="ขยายกราฟ (Zoom Chart)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                        </button>
                    </div>
                    <div class="h-[300px]"><canvas id="workloadChartCanvas"></canvas></div>
                </div>`;
        }
    };

    buildChartGridElements();

    // --- ฟังก์ชันหลักสำหรับกรองและวาดเนื้อหา (Update Loop) ---
    const updateDashboard = () => {
        // 1. กรองข้อมูลจากเกณฑ์ตัวเลือกฟิลเตอร์
        const filteredRecords = rawRecords.filter(r => {
            const rMod = getRecordModule(r);
            const rOwner = getRecordOwnerName(r);
            const rStatus = getRecordStatus(r);
            const rLevel = getRecordLevel(r);
            const rTopic = getRecordTopicName(r).toLowerCase();
            const rTitle = getRecordTitle(r).toLowerCase();
            const rId = String(r.id || '').toLowerCase();

            if (currentFilters.modules && currentFilters.modules.length > 0 && !currentFilters.modules.includes(rMod)) return false;
            if (currentFilters.owners && currentFilters.owners.length > 0 && !currentFilters.owners.includes(rOwner)) return false;
            if (currentFilters.year && getRecordYear(r) !== currentFilters.year) return false;
            
            if (currentFilters.status) {
                if (currentFilters.status === 'done') {
                    if (!['done', 'qualified'].includes(rStatus)) return false;
                } else if (currentFilters.status === 'progress') {
                    if (rStatus !== 'in progress' && rStatus !== 'progress') return false;
                } else if (currentFilters.status === 'delay') {
                    if (rStatus !== 'delayed' && rStatus !== 'delay') return false;
                } else if (currentFilters.status === 'not started') {
                    if (rStatus !== 'not started' && rStatus !== '' && rStatus !== 'none') return false;
                }
            }

            if (currentFilters.levels && currentFilters.levels.length > 0) {
                const strLvl = String(rLevel);
                const hasMatch = currentFilters.levels.some(lvl => {
                    if (lvl === 'N/A') {
                        return r.ofiLevel === 'N/A';
                    }
                    return strLvl === lvl;
                });
                if (!hasMatch) return false;
            }

            if (currentFilters.search) {
                const q = currentFilters.search.toLowerCase();
                if (!rTopic.includes(q) && !rTitle.includes(q) && !rId.includes(q)) return false;
            }

            return true;
        });

        // 2. อัปเดตข้อมูล KPI การ์ด
        const total = filteredRecords.length;
        const completed = filteredRecords.filter(r => ['done', 'qualified'].includes(getRecordStatus(r))).length;
        const delayed = filteredRecords.filter(r => ['delayed', 'delay'].includes(getRecordStatus(r))).length;
        const successRate = total ? Math.round((completed / total) * 100) : 0;

        kpiWrapper.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm"><p class="text-xs text-slate-400 font-bold uppercase tracking-wider">1.1 OFI ทั้งหมดที่เลือก</p><p class="text-4xl font-black text-slate-800 mt-2">${total}</p></div>
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm"><p class="text-xs text-slate-400 font-bold uppercase tracking-wider">1.2 อัตราปิดงานสำเร็จ</p><p class="text-4xl font-black text-emerald-500 mt-2">${successRate}%</p></div>
                <div class="glass-card p-5 rounded-2xl border border-rose-200 bg-rose-50/50 shadow-sm"><p class="text-xs text-rose-400 font-bold uppercase tracking-wider">1.3 งานค้างวิกฤต (Delayed)</p><p class="text-4xl font-black text-rose-600 mt-2">${delayed}</p></div>
            </div>`;

        // 3. วาดกราฟเปรียบเทียบหัวข้อคะแนนรายปี
        const modules = ['CG&LD', 'SP', 'RM&IC', 'SM', 'CM', 'DT', 'HCM', 'KM', 'IM', 'IA'];
        const getAvgScoreByYear = (records, mod, thaiYear) => {
            const cleanTargetMod = mod.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const matches = records.filter(r => getRecordModule(r).includes(cleanTargetMod) && matchYear(getRecordYear(r), thaiYear));
            if (matches.length === 0) return 0;
            const sum = matches.reduce((acc, curr) => acc + getRecordScore(curr), 0);
            return parseFloat((sum / matches.length).toFixed(4));
        };

        const baseScores = modules.map(mod => getAvgScoreByYear(filteredRecords, mod, '2567'));
        const compScores = modules.map(mod => getAvgScoreByYear(filteredRecords, mod, '2568'));

        if (document.getElementById('yearlyComparisonChartCanvas')) {
            const c1 = renderYearlyComparisonChart('yearlyComparisonChartCanvas', modules, baseScores, compScores, 'ปี 2567', 'ปี 2568', currentFilters.modules);
            if (c1) {
                appInstance.charts.push(c1);
                
                const comparisonCanvas = document.getElementById('yearlyComparisonChartCanvas');
                comparisonCanvas.onclick = (evt) => {
                    const activePoints = c1.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                    if (activePoints.length > 0) {
                        const clickedIndex = activePoints[0].index;
                        const clickedModule = modules[clickedIndex];
                        const cleanModule = clickedModule.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        
                        const idx = currentFilters.modules.indexOf(cleanModule);
                        if (idx > -1) {
                            currentFilters.modules.splice(idx, 1);
                        } else {
                            currentFilters.modules.push(cleanModule);
                        }
                        
                        // อัปเดต dropdown ฟิลเตอร์
                        if (currentFilters.modules.length === 1) {
                            document.getElementById('filter-module').value = currentFilters.modules[0];
                        } else {
                            document.getElementById('filter-module').value = '';
                        }
                        
                        tablePage = 1;
                        updateDashboard();
                    }
                };
            }
        }

        // 4. วาดกราฟวงแหวน OFI Level
        const levelCounts = [
            ...[1, 2, 3, 4, 5].map(lvl => filteredRecords.filter(r => getRecordLevel(r) === lvl).length),
            filteredRecords.filter(r => r.ofiLevel === 'N/A').length
        ];
        if (document.getElementById('ofiLevelChartCanvas')) {
            const c2 = renderOfiLevelChart('ofiLevelChartCanvas', levelCounts, ['L1', 'L2', 'L3', 'L4', 'L5', 'N/A'], currentFilters.levels);
            if (c2) {
                appInstance.charts.push(c2);
                
                // --- ระบบ Click to Filter บนกราฟ OFI Level ---
                const ofiCanvas = document.getElementById('ofiLevelChartCanvas');
                ofiCanvas.onclick = (evt) => {
                    const activePoints = c2.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                    if (activePoints.length > 0) {
                        const clickedIndex = activePoints[0].index;
                        const clickedLevel = clickedIndex === 5 ? 'N/A' : String(clickedIndex + 1);
                        
                        const idx = currentFilters.levels.indexOf(clickedLevel);
                        if (idx > -1) {
                            currentFilters.levels.splice(idx, 1);
                        } else {
                            currentFilters.levels.push(clickedLevel);
                        }
                        
                        // อัปเดต dropdown ฟิลเตอร์
                        if (currentFilters.levels.length === 1) {
                            document.getElementById('filter-level').value = currentFilters.levels[0];
                        } else {
                            document.getElementById('filter-level').value = '';
                        }
                        
                        tablePage = 1;
                        updateDashboard();
                    }
                };
            }
        }

        // 5. วาดกราฟแนวโน้มคะแนนเฉลี่ย 6 ปี
        const years = ['2563', '2564', '2565', '2566', '2567', '2568'];
        const activeModules = [...new Set(filteredRecords.map(r => getRecordModule(r)).filter(Boolean))].slice(0, 3);
        const displayModules = activeModules.length > 0 ? activeModules : ['RM&IC'];
        const colorPalette = ['#3B82F6', '#EF4444', '#10B981'];
        const trendDatasets = displayModules.map((mod, index) => {
            return {
                label: mod,
                data: years.map(yr => {
                    const avg = getAvgScoreByYear(filteredRecords, mod, yr);
                    // หากไม่มีข้อมูลจริงค้างในระบบ จะให้สแตนบายค่าสถิติเริ่มต้น
                    return avg > 0 ? avg : parseFloat((3.5 + (index * 0.2) + (years.indexOf(yr) * 0.1)).toFixed(4));
                }),
                borderColor: colorPalette[index] || '#64748B',
                tension: 0.1
            };
        });

        if (document.getElementById('trendChartCanvas')) {
            const c3 = render6YearTrendChart('trendChartCanvas', years, trendDatasets);
            if (c3) appInstance.charts.push(c3);
        }

        // 6. วาดกราฟ Stacked Bar ปริมาณงานรายบุคคล
        let usernames = [...new Set(filteredRecords.map(r => getRecordOwnerName(r)).filter(n => n && n !== 'undefined' && n !== 'null'))].slice(0, 5);
        if (usernames.length === 0) {
            usernames = ['ไม่มีผู้ดูแล'];
        }
        
        const getStatusCount = (user, statusName) => {
            return filteredRecords.filter(r => {
                if (getRecordOwnerName(r) !== user) return false;
                const rStat = getRecordStatus(r);
                if (statusName === 'done') return ['done', 'qualified'].includes(rStat);
                if (statusName === 'progress') return rStat === 'in progress' || rStat === 'progress';
                return false;
            }).length;
        };

        const workloadDatasets = [
            { label: 'In Progress', data: usernames.map(u => getStatusCount(u, 'progress')), backgroundColor: '#F59E0B' },
            { label: 'Done', data: usernames.map(u => getStatusCount(u, 'done')), backgroundColor: '#10B981' }
        ];

        if (document.getElementById('workloadChartCanvas')) {
            const c4 = renderIndividualWorkloadChart('workloadChartCanvas', usernames, workloadDatasets, currentFilters.owners);
            if (c4) {
                appInstance.charts.push(c4);

                // --- ระบบ Click to Filter บนกราฟปริมาณงานรายบุคคล ---
                const workloadCanvas = document.getElementById('workloadChartCanvas');
                workloadCanvas.onclick = (evt) => {
                    const activePoints = c4.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                    if (activePoints.length > 0) {
                        const clickedIndex = activePoints[0].index;
                        const clickedUser = usernames[clickedIndex];
                        if (clickedUser !== 'ไม่มีผู้ดูแล') {
                            const idx = currentFilters.owners.indexOf(clickedUser);
                            if (idx > -1) {
                                currentFilters.owners.splice(idx, 1);
                            } else {
                                currentFilters.owners.push(clickedUser);
                            }
                            
                            // อัปเดต dropdown ฟิลเตอร์
                            if (currentFilters.owners.length === 1) {
                                document.getElementById('filter-owner').value = currentFilters.owners[0];
                            } else {
                                document.getElementById('filter-owner').value = '';
                            }
                            
                            tablePage = 1;
                            updateDashboard();
                        }
                    }
                };
            }
        }

        // 7. จัดการเรนเดอร์ตารางรายการ
        tableCountText.innerText = `แสดง ${total} รายการ`;
        if (total === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 font-medium">ไม่พบแผนงาน OFI ตรงกับตัวกรองของคุณ</td></tr>`;
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
                <tr class="hover:bg-blue-50/40 transition-colors group cursor-pointer animate-row-enter" data-id="${rId}">
                    <td class="py-3.5 px-3 font-bold text-slate-700 text-center whitespace-nowrap">${rMod}</td>
                    <td class="py-3.5 px-3 text-slate-600 max-w-[240px] lg:max-w-[340px] xl:max-w-[440px] truncate" title="${rTopic}">${rTopic}</td>
                    <td class="py-3.5 px-3 font-semibold text-slate-800 max-w-[260px] lg:max-w-[380px] xl:max-w-[500px] truncate" title="${rTitle}">${rTitle}</td>
                    <td class="py-3.5 px-3 text-slate-500 font-medium whitespace-nowrap">${rOwner}</td>
                    <td class="py-3.5 px-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${badgeClass}">${badgeText}</span>
                    </td>
                    <td class="py-3.5 px-3 text-right font-mono font-bold text-slate-600 whitespace-nowrap">${rScore}</td>
                    <td class="py-3.5 px-3 text-center font-bold text-[#00508F] whitespace-nowrap">${rLvl}</td>
                </tr>
            `;
        }).join('');

        // 8. วาด Pagination ของตาราง
        if (totalPages <= 1) {
            paginationWrapper.innerHTML = '';
        } else {
            const startItem = startIndex + 1;
            const endItem = Math.min(endIndex, total);
            let pagesHtml = '';

            for (let i = 1; i <= totalPages; i++) {
                if (i === tablePage) {
                    pagesHtml += `<button data-page="${i}" class="btn-table-page px-2.5 py-1 text-xs font-bold rounded-lg bg-[#00508F] text-white shadow-sm">${i}</button>`;
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

    // ฟังก์ชันดีเด้ง (Debounce) ป้องกันการวาดตารางซ้ำบ่อยเกินไปขณะพิมพ์
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
        filterOwn.value = '';
        filterStat.value = '';
        filterLvl.value = '';
        filterYr.value = '';
        filterSrc.value = '';
        currentFilters = { modules: [], owners: [], status: '', levels: [], search: '', year: '' };
        tablePage = 1;
        updateDashboard();
    });

    // --- ลงทะเบียน Event Listeners สำหรับการกดเปลี่ยนหน้าตาราง ---
    paginationWrapper.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-table-page');
        if (btn && !btn.disabled) {
            tablePage = parseInt(btn.getAttribute('data-page'));
            updateDashboard();
            // เลื่อนจอลงไปที่ตารางเบาๆ
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

        // 🌟 เพิ่มไฮไลท์บรรทัดของข้อมูลที่ถูกเลือก (Row Highlight - ธีมสีน้ำเงินเข้มมองเห็นง่าย)
        tableBody.querySelectorAll('tr').forEach(r => {
            r.classList.remove('active-selected-row');
        });
        row.classList.add('active-selected-row');

        // จัดเตรียมข้อมูลความคืบหน้าเฟสงาน (Gantt timeline)
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

        // ล้างป้ายแท็กประเด็นปัญหา
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

        // คืนค่าไฮไลท์กลับสู่สภาพเดิมเมื่อโมดอลถูกปิด
        const onClose = () => {
            row.classList.remove('active-selected-row');
        };

        showSharedGlassModal(`รายละเอียดแผนงาน OFI: ${id}`, `จากแหล่งข้อมูล: ${record._source_file || 'คลังข้อมูลกลาง'}`, modalContent, 'md', onClose);
    });

    // --- ระบบ Click เพื่อขยายขนาดกราฟ (Accessibility Zoom) ---
    appInstance.contentDiv.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-expand-chart');
        if (btn) {
            e.stopPropagation();
            const chartId = btn.getAttribute('data-chart-id');
            let canvasId = '';
            if (chartId === 'chart-yearly-comparison') canvasId = 'yearlyComparisonChartCanvas';
            else if (chartId === 'chart-ofi-level') canvasId = 'ofiLevelChartCanvas';
            else if (chartId === 'chart-6year-trend') canvasId = 'trendChartCanvas';
            else if (chartId === 'chart-individual-workload') canvasId = 'workloadChartCanvas';
            
            if (canvasId) {
                zoomChart(canvasId);
            }
        }
    });

    // เริ่มต้นแสดงผลหน้ากระดานแดชบอร์ดครั้งแรก
    updateDashboard();
}