import { renderAuditorDoughnut, renderAuditorProgressList, renderTopicScoreMatrix } from '../utils/chartRenderers.js';
import { showSharedGlassModal, zoomChart } from '../utils/uiHelpers.js';

/**
 * 🔍 ฟังก์ชันเนรมิตหน้าแดชบอร์ดเฉพาะสิทธิ์ผู้ตรวจสอบตัวจริง (เวอร์ชัน Dynamic Dashboard Builder)
 */
export function renderAuditorView(appInstance, chartSettings = {}, currentRole = 'auditor') {
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

    // --- สร้างฟิลเตอร์ตัวกรอง และล้าง UI เก่า ---
    let currentFilters = {
        modules: [],
        owners: [],
        status: '',
        levels: [],
        search: ''
    };

    let tablePage = 1;
    const tableItemsPerPage = 5;

    // เก็บบริบทตัวกรองรายชื่อทั้งหมดเพื่อสร้างตัวเลือก Dropdown
    const modulesList = [...new Set(rawRecords.map(r => getRecordModule(r)).filter(Boolean))].sort();
    const ownersList = [...new Set(rawRecords.map(r => getRecordOwnerName(r)).filter(Boolean))].sort();
    const levelsList = [...new Set(rawRecords.map(r => r.ofiLevel).filter(Boolean))].sort();

    // ประกอบโครงสร้าง HTML พื้นฐาน (ฟิลเตอร์ + กริดกราฟ + ตารางข้อมูลดิบ)
    appInstance.contentDiv.innerHTML = `
        <div id="kpi-cards-wrapper">
            ${appInstance.getKpiHtml()}
        </div>

        <!-- 2. แผงควบคุมและฟิลเตอร์อัจฉริยะ (Smart Control Panel) -->
        <div class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 animate-fade-in-up">
            <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <span class="text-xs font-black text-[#00508F] flex items-center gap-1"><span class="text-sm">⚙️</span> คัดกรอง:</span>
                
                <div class="relative shrink-0 w-full sm:w-auto">
                    <select id="filter-module" class="w-full sm:w-auto appearance-none bg-white border border-slate-200 px-4 py-1.5 pr-8 text-xs font-bold text-slate-700 rounded-xl outline-none focus:border-blue-400 transition cursor-pointer shadow-sm">
                        <option value="">ทุกหมวดงาน (Modules)</option>
                        ${modulesList.map(m => `<option value="${m}">${m}</option>`).join('')}
                    </select>
                </div>

                <div class="relative shrink-0 w-full sm:w-auto">
                    <select id="filter-owner" class="w-full sm:w-auto appearance-none bg-white border border-slate-200 px-4 py-1.5 pr-8 text-xs font-bold text-slate-700 rounded-xl outline-none focus:border-blue-400 transition cursor-pointer shadow-sm">
                        <option value="">ผู้รับผิดชอบทั้งหมด</option>
                        ${ownersList.map(o => `<option value="${o}">${o}</option>`).join('')}
                    </select>
                </div>

                <div class="relative shrink-0 w-full sm:w-auto">
                    <select id="filter-status" class="w-full sm:w-auto appearance-none bg-white border border-slate-200 px-4 py-1.5 pr-8 text-xs font-bold text-slate-700 rounded-xl outline-none focus:border-blue-400 transition cursor-pointer shadow-sm">
                        <option value="">ทุกสถานะ (Status)</option>
                        <option value="progress">In Progress</option>
                        <option value="done">Done / Qualified</option>
                        <option value="delayed">Delayed</option>
                        <option value="not started">Not Started</option>
                    </select>
                </div>

                <div class="relative shrink-0 w-full sm:w-auto">
                    <select id="filter-level" class="w-full sm:w-auto appearance-none bg-white border border-slate-200 px-4 py-1.5 pr-8 text-xs font-bold text-slate-700 rounded-xl outline-none focus:border-blue-400 transition cursor-pointer shadow-sm">
                        <option value="">ทุกระดับความยาก</option>
                        ${levelsList.map(l => `<option value="${l}">${l}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div class="w-full lg:w-auto shrink-0 flex gap-2">
                <input type="text" id="filter-search" placeholder="🔎 ค้นหาหัวข้อ / รายละเอียด..." class="w-full lg:w-44 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors">
                <button id="filter-reset-btn" class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200">รีเซ็ต</button>
            </div>
        </div>

        <!-- 3. พื้นที่จัดแสดงกราฟ (Grid) -->
        <div id="dynamic-auditor-grid" class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"></div>

        <!-- 3.1 ตารางเทียบความเคลื่อนไหวคะแนนรายหัวข้อ -->
        <div id="heatmap-matrix-card-wrapper"></div>

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
    const gridContainer = document.getElementById('dynamic-auditor-grid');
    const heatmapWrapper = document.getElementById('heatmap-matrix-card-wrapper');
    const tableBody = document.getElementById('table-ofi-list-body');
    const tableCountText = document.getElementById('table-total-count');
    const paginationWrapper = document.getElementById('table-pagination-controls');

    const canShow = (chartId) => {
        if (!chartSettings || !chartSettings[chartId]) return true;
        const roles = chartSettings[chartId].roles;
        if (!Array.isArray(roles)) return true;
        return roles.includes(currentRole);
    };

    // --- ฟังก์ชันสร้างโครงร่างกราฟและ Canvas เปล่า ---
    const buildChartElements = () => {
        gridContainer.innerHTML = '';
        heatmapWrapper.innerHTML = '';

        // 3.3 วิเคราะห์ประเภทและแหล่งที่มาข้อบกพร่อง
        if (canShow("chart-defect-source")) {
            gridContainer.innerHTML += `
                <div id="defect-source-card" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2 min-h-[340px] relative">
                    <div class="flex justify-between items-center mb-2 pb-2">
                        <h3 class="text-sm sm:text-base font-bold text-slate-800">${chartSettings["chart-defect-source"]?.title || '3.3 วิเคราะห์ประเภทและแหล่งที่มาข้อบกพร่อง'}</h3>
                        <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-defect-source" title="ขยายกราฟ (Zoom Chart)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                        </button>
                    </div>
                    <p class="text-[11px] text-slate-400 mb-4">โครงสร้างวงแหวนแสดงความเชื่อมโยงระหว่างแหล่งตรวจพบ (วงนอก) และประเภทปัญหา (วงใน)</p>
                    <div class="flex flex-col sm:flex-row items-center gap-6 h-[220px]">
                        <div class="w-1/2 h-full max-w-[180px]"><canvas id="auditorDoughnutCanvas"></canvas></div>
                        <div class="flex-1 w-full space-y-3">
                            <div class="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
                                <span class="text-[12px] font-bold text-amber-900">ตรวจพบโดย สตช.</span>
                                <span id="count-stch-badge" class="text-sm font-black text-amber-700">(0)</span>
                            </div>
                            <div class="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                                <span class="text-[12px] font-bold text-blue-900">ตรวจจากแผน Enabler</span>
                                <span id="count-enabler-badge" class="text-sm font-black text-blue-700">(0)</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        // 3.2 ความคืบหน้าตามเกณฑ์
        if (canShow("chart-progress-list")) {
            gridContainer.innerHTML += `
                <div id="progress-list-card" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm min-h-[340px]">
                    <h3 class="text-sm sm:text-base font-bold text-slate-800 mb-4">${chartSettings["chart-progress-list"]?.title || '3.2 ความคืบหน้าตามเกณฑ์'}</h3>
                    <div id="progressListContainer"></div>
                </div>`;
        }

        // 3.1 ตารางเทียบความเคลื่อนไหวคะแนนรายหัวข้อ (6 ปี)
        if (canShow("chart-heatmap-matrix")) {
            heatmapWrapper.innerHTML = `
                <div id="heatmap-matrix-card" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm w-full mt-6">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <h3 class="text-sm sm:text-base font-bold text-slate-800">${chartSettings["chart-heatmap-matrix"]?.title || '3.1 ตารางเทียบความเคลื่อนไหวคะแนนรายหัวข้อ (6 ปี)'}</h3>
                        <div class="text-[11px] font-bold text-slate-500 flex items-center gap-3">
                            <span>🔵 ปีฐาน: <strong class="text-slate-700">2567</strong></span>
                            <span>🟣 ปีเทียบ: <strong class="text-slate-700">2568</strong></span>
                        </div>
                    </div>
                    <div class="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 font-bold flex items-center gap-2">🚨 Audit Finding จากปี 2567 ไปยังปี 2568: คะแนนดิ่งลงสะสม 1 หัวข้อ และดีขึ้นสำเร็จ 49 หัวข้อ</div>
                    <div id="matrixTableContainer"></div>
                </div>`;
        }
    };

    const clearCharts = () => {
        if (Array.isArray(appInstance.charts)) {
            appInstance.charts.forEach(c => { if (c && typeof c.destroy === 'function') c.destroy(); });
            appInstance.charts = [];
        }
    };

    // --- ฟังก์ชันคัดกรองข้อมูลดิบและวาดหน้าแดชบอร์ดใหม่ทั้งหมด ---
    const updateDashboard = () => {
        clearCharts();
        buildChartElements();

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

        // 3. วาดกราฟ Doughnut 3.3
        if (document.getElementById('auditorDoughnutCanvas')) {
            const countStch = filteredRecords.filter(r => {
                const src = String(r.defectSource || '').toLowerCase();
                return src.includes('สตช') || src.includes('สคร') || src.includes('bridge') || src.includes('consulting') || src.includes('คาดการณ์') || src.includes('ʤ');
            }).length;
            
            const countEnabler = filteredRecords.filter(r => {
                const src = String(r.defectSource || '').toLowerCase();
                return src.includes('enabler') || src.includes('se-am') || src.includes('assessment');
            }).length;
            
            const labels = ['ตรวจพบโดย สตช. / สคร.', 'ตรวจจากแผน Enabler / SE-AM'];
            const dataValues = [countStch, countEnabler];
            
            const stchCountEl = document.getElementById('count-stch-badge');
            const enablerCountEl = document.getElementById('count-enabler-badge');
            if (stchCountEl) stchCountEl.innerText = `(${countStch})`;
            if (enablerCountEl) enablerCountEl.innerText = `(${countEnabler})`;

            const c3_3 = renderAuditorDoughnut('auditorDoughnutCanvas', dataValues, labels);
            if (c3_3) appInstance.charts.push(c3_3);
        }

        // 4. วาดลิสต์ความก้าวหน้า 3.2
        if (document.getElementById('progressListContainer')) {
            const getPhaseDoneCount = (phaseKey) => {
                return filteredRecords.filter(r => {
                    const status = String(r.phases?.[phaseKey]?.status || '').toLowerCase();
                    return ['done', 'qualified'].includes(status);
                }).length;
            };

            const p1Count = getPhaseDoneCount('phase-plan');
            const p2Count = getPhaseDoneCount('phase-eo-ec');
            const p3Count = getPhaseDoneCount('phase-assessment');
            const p4Count = getPhaseDoneCount('phase-document');
            const p5Count = getPhaseDoneCount('phase-site-visit');

            const p1Percent = total ? Math.round((p1Count / total) * 100) : 0;
            const p2Percent = total ? Math.round((p2Count / total) * 100) : 0;
            const p3Percent = total ? Math.round((p3Count / total) * 100) : 0;
            const p4Percent = total ? Math.round((p4Count / total) * 100) : 0;
            const p5Percent = total ? Math.round((p5Count / total) * 100) : 0;

            renderAuditorProgressList('progressListContainer', [
                { phase: 'Phase 1', title: 'แผนปรับปรุง', percent: p1Percent, count: p1Count, total: total },
                { phase: 'Phase 2', title: 'รายงาน EO', percent: p2Percent, count: p2Count, total: total },
                { phase: 'Phase 3', title: 'Assessment', percent: p3Percent, count: p3Count, total: total },
                { phase: 'Phase 4', title: 'เข้าระบบ', percent: p4Percent, count: p4Count, total: total },
                { phase: 'Phase 5', title: 'Site Visit', percent: p5Percent, count: p5Count, total: total }
            ]);
        }

        // 5. วาดตารางเปรียบเทียบคะแนน 3.1
        if (document.getElementById('matrixTableContainer')) {
            const rawScores = appInstance.data?.scores || [];
            let scoresData = [];
            rawScores.forEach(en => {
                const enCode = en.enablerCode || '';
                en.topics?.forEach(t => {
                    const sByYear = t.scoreByYear || {};
                    scoresData.push({
                        code: enCode,
                        name: t.topicName || '',
                        y63: parseFloat(sByYear['2563'] ?? 0) || 0,
                        y64: parseFloat(sByYear['2564'] ?? 0) || 0,
                        y65: parseFloat(sByYear['2565'] ?? 0) || 0,
                        y66: parseFloat(sByYear['2566'] ?? 0) || 0,
                        y67: parseFloat(sByYear['2567'] ?? 0) || 0,
                        y68: parseFloat(sByYear['2568'] ?? 0) || 0,
                    });
                });
            });

            if (currentFilters.modules.length > 0) {
                scoresData = scoresData.filter(s => currentFilters.modules.includes(s.code.toUpperCase().replace(/[^A-Z0-9]/g, '')));
            }
            renderTopicScoreMatrix('matrixTableContainer', scoresData);
        }

        // 6. จัดการเรนเดอร์ตารางรายการแบบละเอียด
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

        // 7. วาด Pagination ของตาราง
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
    const filterSrc = document.getElementById('filter-search');
    const resetBtn = document.getElementById('filter-reset-btn');

    const handleFilterChange = () => {
        currentFilters.modules = filterMod.value ? [filterMod.value] : [];
        currentFilters.owners = filterOwn.value ? [filterOwn.value] : [];
        currentFilters.status = filterStat.value;
        currentFilters.levels = filterLvl.value ? [filterLvl.value] : [];
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
    filterSrc.addEventListener('input', handleSearchInput);

    resetBtn.addEventListener('click', () => {
        filterMod.value = '';
        filterOwn.value = '';
        filterStat.value = '';
        filterLvl.value = '';
        filterSrc.value = '';
        currentFilters = { modules: [], owners: [], status: '', levels: [], search: '' };
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
            if (chartId === 'chart-defect-source') {
                zoomChart('auditorDoughnutCanvas');
            }
        }
    });

    // เริ่มต้นแสดงผลหน้ากระดานแดชบอร์ดครั้งแรก
    updateDashboard();
}