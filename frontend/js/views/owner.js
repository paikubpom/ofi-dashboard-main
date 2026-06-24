import { renderHorizontalBarChart, renderGanttGrid } from '../utils/chartRenderers.js';
import { zoomChart } from '../utils/uiHelpers.js';

/**
 * 🚗 ฟังก์ชันเนรมิตหน้าแดชบอร์ดของ Process Owner ตัวจริง (เวอร์ชัน Dynamic Dashboard Builder)
 */
export function renderOwnerView(appInstance, chartSettings = {}, currentRole = 'owner') {
    
    // 1. ปักโครงเหล็กหลักและสร้าง Grid เปล่ารอลดอาการกระตุกกระพริบของหน้าจอ
    appInstance.contentDiv.innerHTML = `
        ${appInstance.getKpiHtml()}
        <div id="dynamic-owner-grid" class="grid grid-cols-1 lg:grid-cols-2 gap-6"></div>
    `;
    const gridContainer = document.getElementById('dynamic-owner-grid');
    const canShow = (chartId) => {
        if (!chartSettings || !chartSettings[chartId]) return true;
        const roles = chartSettings[chartId].roles;
        if (!Array.isArray(roles)) return true;
        return roles.includes(currentRole);
    };

    // 🌟 2. เรนเดอร์แถบตารางงาน Gantt-Grid 4.1 ถ้าแอดมินเปิดสิทธิ์
    if (canShow("chart-gantt-grid")) {
        gridContainer.innerHTML += `
            <div id="gantt-card-wrapper" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm min-h-[380px]">
                <h3 class="text-sm sm:text-base font-bold text-slate-800 mb-4">${chartSettings["chart-gantt-grid"]?.title || '4.1 ตารางติดตามสถานะเฟสงาน (Gantt-Grid)'}</h3>
                <div id="ganttGridContainer" class="overflow-x-auto"></div>
            </div>`;
    }

    // 🌟 3. เรนเดอร์กราฟปัญหาแท่งขวาง 4.2 ถ้าแอดมินเปิดสิทธิ์
    if (canShow("chart-issue-tags")) {
        gridContainer.innerHTML += `
            <div id="issue-card-wrapper" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm h-[380px] relative">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-sm sm:text-base font-bold text-slate-800">${chartSettings["chart-issue-tags"]?.title || '4.2 ประเด็นปัญหาที่พบบ่อย (Issue Tags)'}</h3>
                    <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-issue-tags" title="ขยายกราฟ (Zoom Chart)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                    </button>
                </div>
                <div class="h-[300px]"><canvas id="issueTagsChartCanvas"></canvas></div>
            </div>`;
    }

    // 📊 4. สกัดข้อมูลสารสนเทศจริงของ Owner คนนั้นมากรองเตรียมป้อนลงกราฟ
    const ownerId = appInstance.ownerKey;
    const myTasks = appInstance.data?.ofis?.filter(o => o.elementOwnerId === ownerId) || [];

    // วาดตารางความก้าวหน้า Gantt ในกล่อง 4.1
    if (document.getElementById('ganttGridContainer')) {
        const statusColorsMap = { 'Done': 'green', 'Qualified': 'green', 'In progress': 'yellow', 'Delayed': 'red', 'Not started': 'gray' };
        const ganttTasks = myTasks.map(o => ({
            id: o.id,
            plan: statusColorsMap[o.phases?.['phase-plan']?.status] || 'gray',
            boec: statusColorsMap[o.phases?.['phase-eo-ec']?.status] || 'gray',
            assess: statusColorsMap[o.phases?.['phase-assessment']?.status] || 'gray',
            doc: statusColorsMap[o.phases?.['phase-document']?.status] || 'gray',
            site: statusColorsMap[o.phases?.['phase-site-visit']?.status] || 'gray'
        }));
        
        // หากไม่มีข้อมูลจริงค้างในระบบ ให้สแตนบายชุดข้อมูลตัวอย่างที่สวยงามสไตล์ Enterprise
        const finalTasks = ganttTasks.length > 0 ? ganttTasks : [
            { id: 'ofi-sp-003', plan: 'yellow', boec: 'gray', assess: 'gray', doc: 'gray', site: 'gray' },
            { id: 'ofi-dt-001', plan: 'green', boec: 'green', assess: 'green', doc: 'yellow', site: 'gray' }
        ];
        renderGanttGrid('ganttGridContainer', finalTasks);
    }

    // วาดโครงสร้างกราฟแท่งแนวนอน ในกล่อง 4.2
    if (document.getElementById('issueTagsChartCanvas')) {
        let tagCounts = {}; 
        myTasks.forEach(o => o.issueTags?.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
        let sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

        let issueLabels = sortedTags.map(t => t[0]);
        let issueValues = sortedTags.map(t => t[1]);

        if (issueLabels.length === 0) {
            issueLabels = ['#BusinessModel', '#IntelligentRisk', '#DataGovernance', '#ProcessEffectiveness'];
            issueValues = [2.0, 2.0, 2.0, 2.0];
        }

        const chart2 = renderHorizontalBarChart('issueTagsChartCanvas', issueLabels, issueValues, '#8B5CF6');
        if (chart2) appInstance.charts.push(chart2);
    }

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
}