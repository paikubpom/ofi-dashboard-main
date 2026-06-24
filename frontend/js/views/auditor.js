import { renderAuditorDoughnut, renderAuditorProgressList, renderTopicScoreMatrix } from '../utils/chartRenderers.js';
import { zoomChart } from '../utils/uiHelpers.js';

/**
 * 🔍 ฟังก์ชันเนรมิตหน้าแดชบอร์ดเฉพาะสิทธิ์ผู้ตรวจสอบตัวจริง (เวอร์ชัน Dynamic Dashboard Builder)
 */
export function renderAuditorView(appInstance, chartSettings = {}, currentRole = 'auditor') {
    
    // 1. วางโครงร่างสร้างอาคารเปล่าและ Grid ตัวนำทาง
    appInstance.contentDiv.innerHTML = `
        ${appInstance.getKpiHtml()}
        <div id="dynamic-auditor-grid" class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"></div>
    `;
    const gridContainer = document.getElementById('dynamic-auditor-grid');
    const canShow = (chartId) => {
        if (!chartSettings || !chartSettings[chartId]) return true;
        const roles = chartSettings[chartId].roles;
        if (!Array.isArray(roles)) return true;
        return roles.includes(currentRole);
    };

    // 🌟 2. เรนเดอร์การ์ด 3.3 ถ้าแอดมินเปิดสิทธิ์
    if (canShow("chart-defect-source")) {
        gridContainer.innerHTML += `
            <div id="defect-source-card" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2 min-h-[340px] relative">
                <div class="flex justify-between items-center mb-2 pb-2">
                    <h3 class="text-sm sm:text-base font-bold text-slate-800">${chartSettings["chart-defect-source"]?.title || '3.3 วิเคราะห์ประเภทและแหล่งที่มาข้อบกพร่อง'}</h3>
                    <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-defect-source" title="ขยายกราฟ (Zoom Chart)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                    </button>
                </div>
                <p class="text-[11px] text-slate-400 mb-4">โครงสร้างวงแหวนแสดงความเชื่อมโยงระหว่างแหล่งตรวจพบ (วงนอก) และประเภทปัญหา (วงใน)</p>
                <div class="flex flex-col sm:flex-row items-center gap-6 h-[220px]">
                    <div class="w-1/2 h-full max-w-[180px]"><canvas id="auditorDoughnutCanvas"></canvas></div>
                    <div class="flex-1 w-full space-y-3">
                        <div class="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center"><span class="text-[12px] font-bold text-amber-900">ตรวจพบโดย สตช.</span><span class="text-sm font-black text-amber-700">(8)</span></div>
                        <div class="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center"><span class="text-[12px] font-bold text-blue-900">ตรวจจากแผน Enabler</span><span class="text-sm font-black text-blue-700">(4)</span></div>
                    </div>
                </div>
            </div>`;
    }

    // 🌟 3. เรนเดอร์การ์ด 3.2 ถ้าแอดมินเปิดสิทธิ์
    if (canShow("chart-progress-list")) {
        gridContainer.innerHTML += `
            <div id="progress-list-card" class="glass-card p-5 rounded-3xl border border-slate-200 shadow-sm min-h-[340px]">
                <h3 class="text-sm sm:text-base font-bold text-slate-800 mb-4">${chartSettings["chart-progress-list"]?.title || '3.2 ความคืบหน้าตามเกณฑ์'}</h3>
                <div id="progressListContainer"></div>
            </div>`;
    }

    // 🌟 4. เรนเดอร์ตารางสรุปคะแนน 3.1 ดิ่งลงมาแยกการ์ดตัวใหญ่ด้านล่าง
    if (canShow("chart-heatmap-matrix")) {
        appInstance.contentDiv.innerHTML += `
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

    // 📊 5. สั่งชัตเตอร์ยิงพลังวาดกราฟลง Canvas เฉพาะส่วนที่มีการเรนเดอร์ลงจอจริงสำเร็จ
    if (document.getElementById('auditorDoughnutCanvas')) {
        const c3_3 = renderAuditorDoughnut('auditorDoughnutCanvas', [8, 4]);
        if (c3_3) appInstance.charts.push(c3_3);
    }
    
    if (document.getElementById('progressListContainer')) {
        renderAuditorProgressList('progressListContainer', [
            { phase: 'Phase 1', title: 'แผนปรับปรุง', percent: 67, count: 8, total: 12 },
            { phase: 'Phase 2', title: 'รายงาน EO', percent: 50, count: 6, total: 12 },
            { phase: 'Phase 3', title: 'Assessment', percent: 33, count: 4, total: 12 },
            { phase: 'Phase 4', title: 'เข้าระบบ', percent: 17, count: 2, total: 12 },
            { phase: 'Phase 5', title: 'Site Visit', percent: 17, count: 2, total: 12 }
        ]);
    }

    if (document.getElementById('matrixTableContainer')) {
        renderTopicScoreMatrix('matrixTableContainer', [
            { code: 'CG&LD', name: '1. บทบาทของภาครัฐ', y63: 3.0, y64: 3.5, y65: 4.0, y66: 4.3, y67: 4.7, y68: 5.0 },
            { code: 'CG&LD', name: '10. การติดตามผลการดำเนินงาน', y63: 3.5, y64: 3.8, y65: 4.0, y66: 4.2, y67: 4.5, y68: 4.8 },
            { code: 'CG&LD', name: '2. บทบาทของรัฐวิสาหกิจเพื่อการตลาดที่เป็นธรรม', y63: 3.0, y64: 3.5, y65: 4.0, y66: 4.3, y67: 4.7, y68: 5.0 },
            { code: 'CG&LD', name: '3. สิทธิและความเท่าเทียมกันของผู้ถือหุ้น', y63: 3.0, y64: 3.5, y65: 4.0, y66: 4.3, y67: 4.7, y68: 4.8 },
            { code: 'CG&LD', name: '4. บทบาทของผู้มีส่วนได้เสีย', y63: 3.4, y64: 3.6, y65: 4.0, y66: 4.3, y67: 4.7, y68: 5.0 },
            { code: 'CG&LD', name: '5. การเปิดเผยข้อมูล', y63: 4.7, y64: 4.8, y65: 4.9, y66: 5.0, y67: 5.0, y68: 5.0 }
        ]);
    }

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
}