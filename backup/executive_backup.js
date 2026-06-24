import { showSharedGlassModal } from '../utils/uiHelpers.js';

export function renderExecutiveView(app) {
    let dynamicYears = new Set();
    app.data.scores.forEach(s => {
        if (s.averageScoreByYear) Object.keys(s.averageScoreByYear).forEach(y => dynamicYears.add(y));
    });
    const years = Array.from(dynamicYears).sort((a, b) => parseInt(a) - parseInt(b));
    if (years.length === 0) years.push('2567', '2568'); 

    const latestYear = years[years.length - 1];
    const prevYear = years.length > 1 ? years[years.length - 2] : latestYear;
    const renderYearOptions = (selectedY) => years.map(y => `<option value="${y}" ${y === selectedY ? 'selected' : ''}>${y}</option>`).join('');

    const ownerNames = app.data.owners.map(o => o.nameThai);
    const statuses = ['Not started', 'In progress', 'Done', 'Qualified', 'Delayed'];
    const bgColors = ['#cbd5e1', '#fcd34d', '#34d399', '#059669', '#ef4444'];
    
    const stackDatasets = statuses.map((status, i) => {
        return { label: status, backgroundColor: bgColors[i], data: app.data.owners.map(owner => app.data.ofis.filter(o => o.elementOwnerId === owner.id && o.overallStatus === status).length) };
    });

    const levels = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
    app.data.ofis.forEach(o => { if (o.ofiLevel) levels[o.ofiLevel]++; });
    const totalLevel = Object.values(levels).reduce((a, b) => a + b, 0);
    const maxLevel = Object.keys(levels).reduce((a, b) => levels[a] > levels[b] ? a : b);
    const maxPercent = totalLevel ? Math.round((levels[maxLevel] / totalLevel) * 100) : 0;

    let topCloser = { name: '-', count: 0 };
    let topOverloaded = { name: '-', count: 0 };
    app.data.owners.forEach(owner => {
        const doneCnt = app.data.ofis.filter(o => o.elementOwnerId === owner.id && ['Done', 'Qualified'].includes(o.overallStatus)).length;
        const pendingCnt = app.data.ofis.filter(o => o.elementOwnerId === owner.id && ['Not started', 'In progress', 'Delayed'].includes(o.overallStatus)).length;
        if (doneCnt > topCloser.count) { topCloser.count = doneCnt; topCloser.name = owner.nameThai.split(' ')[0]; }
        if (pendingCnt > topOverloaded.count) { topOverloaded.count = pendingCnt; topOverloaded.name = owner.nameThai.split(' ')[0]; }
    });

    app.contentDiv.innerHTML = app.getKpiHtml() + `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
            <div class="glass-card p-6 rounded-3xl lg:col-span-2 flex flex-col justify-between">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                    <div>
                        <h3 class="font-bold text-slate-800 text-base">2.1 เปรียบเทียบคะแนนภาพรวมรายปี</h3>
                        <p class="text-[11px] text-slate-400">คลิกที่ป้ายชื่อปีเพื่อโฟกัสเน้นดูสถิติสเปกตรัมเฉพาะมิตินั้น</p>
                    </div>
                    <div class="flex items-center gap-1.5 bg-white/80 border border-slate-200 shadow-sm rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
                        <span>ปีฐาน:</span>
                        <select id="compare-year-1" class="bg-transparent text-blue-600 outline-none cursor-pointer font-extrabold focus:text-blue-800">${renderYearOptions(prevYear)}</select>
                        <span class="text-slate-300 font-normal mx-0.5">|</span>
                        <span>ปีเทียบ:</span>
                        <select id="compare-year-2" class="bg-transparent text-blue-600 outline-none cursor-pointer font-extrabold focus:text-blue-800">${renderYearOptions(latestYear)}</select>
                    </div>
                </div>
                <div id="year-insight-box" class="min-h-[40px]"></div>
                <div class="h-64 mt-2"><canvas id="radarChart"></canvas></div>
            </div>

            <div class="glass-card p-6 rounded-3xl flex flex-col justify-between">
                <div><h3 class="font-bold text-slate-800 mb-1">2.4 ระดับความยาก (OFI Level)</h3><p class="text-[11px] text-slate-400 mb-2">สัดส่วนความรุนแรงของข้อบกพร่อง</p></div>
                <div class="relative flex-1 flex items-center justify-center min-h-[160px]">
                    <canvas id="donutChart"></canvas>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                        <span class="text-4xl font-black text-slate-800 leading-none">${totalLevel}</span>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">รายการทั้งหมด</span>
                    </div>
                </div>
                <div class="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                    <span class="text-base">💡</span><div class="text-[11px] text-amber-700"><strong>Insight สำคัญ:</strong> ปัญหาประจุกตัวอยู่ที่ระดับ <strong class="text-sm font-black">${maxLevel}</strong> คิดเป็น ${maxPercent}% ของงานทั้งหมด</div>
                </div>
            </div>

            <div class="glass-card p-6 rounded-3xl lg:col-span-3">
                <h3 class="font-bold text-slate-800 mb-4">2.2 แนวโน้มคะแนนเฉลี่ย ${years.length} ปี <span class="text-xs text-blue-500 font-normal ml-2">(คลิกที่เส้นกราฟหรือป้ายชื่อด้านบน เพื่อดวลเปรียบเทียบได้สูงสุด 2 หมวดพร้อมกัน)</span></h3>
                <div class="h-72"><canvas id="lineChart"></canvas></div>
            </div>

            <div class="glass-card p-6 rounded-3xl lg:col-span-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                    <div>
                        <h3 class="font-bold text-slate-800 mb-1">2.3 ปริมาณงานและสถานะรายบุคคล</h3>
                        <p class="text-xs text-slate-400">เปรียบเทียบภาระงานของเจ้าภาพแต่ละท่าน (คลิกบนแท่งกราฟเพื่อเจาะลึกดูรายการงานจริง)</p>
                    </div>
                    <div class="flex flex-wrap gap-2 text-[11px]">
                        <div class="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg">🏆 ปิดงานสูงสุด: <strong>${topCloser.name} (${topCloser.count})</strong></div>
                        <div class="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg">🔥 งานค้างสะสมสูงสุด: <strong>${topOverloaded.name} (${topOverloaded.count})</strong></div>
                    </div>
                </div>
                <div class="h-72"><canvas id="stackedChart"></canvas></div>
            </div>
        </div>`;

    // 2.1 Engine
    const runYearComparisonPipeline = () => {
        const y1 = document.getElementById('compare-year-1').value;
        const y2 = document.getElementById('compare-year-2').value;
        const labels = app.data.scores.map(s => s.code);
        const dataY1 = app.data.scores.map(s => s.averageScoreByYear?.[y1] || 0);
        const dataY2 = app.data.scores.map(s => s.averageScoreByYear?.[y2] || 0);

        let maxGrowth = { code: '', value: -99 }; let hasValidData = false;
        labels.forEach((code, i) => {
            if(app.data.scores[i].averageScoreByYear?.[y1] !== undefined && app.data.scores[i].averageScoreByYear?.[y2] !== undefined) {
                hasValidData = true; const growth = dataY2[i] - dataY1[i];
                if(growth > maxGrowth.value) maxGrowth = { code, value: growth };
            }
        });

        const insightBox = document.getElementById('year-insight-box');
        if(hasValidData && maxGrowth.code) {
            const trendSummary = maxGrowth.value > 0 ? `ทำคะแนนพัฒนาขึ้นสูงสุดโดดเด่น <strong class="text-emerald-600 font-bold">+${maxGrowth.value.toFixed(2)}</strong> คะแนน` : maxGrowth.value < 0 ? `ชะลอตัวน้อยที่สุดอยู่ที่ <strong class="text-rose-600 font-bold">${maxGrowth.value.toFixed(2)}</strong> คะแนน` : `มีผลการประเมินคงที่ระดับเดิม`;
            insightBox.innerHTML = `<div class="p-2.5 bg-blue-50/80 border border-blue-100 rounded-xl text-[11px] text-blue-800 flex items-center gap-2 animate-fade-in-up"><span>🚀 <strong>Insight พัฒนาการ:</strong> เมื่อวิเคราะห์จากช่วงปี ${y1} ข้ามไปยังปี ${y2} พบว่าหมวด <strong>${maxGrowth.code}</strong> ${trendSummary}</span></div>`;
        }

        if (app.yearCompChartInstance) { app.yearCompChartInstance.destroy(); app.charts = app.charts.filter(c => c !== app.yearCompChartInstance); }

        const colorY1 = '#64748b'; const colorY2 = '#3b82f6';
        const compDatasets = [
            { label: `ปี ${y1}`, data: dataY1, backgroundColor: colorY1, borderRadius: 5, isFocused: false },
            { label: `ปี ${y2}`, data: dataY2, backgroundColor: colorY2, borderRadius: 5, isFocused: false }
        ];

        const toggleBarFocusMode = (ci, clickedIndex) => {
            const datasets = ci.data.datasets;
            datasets[clickedIndex].isFocused = !datasets[clickedIndex].isFocused;
            const anyFocused = datasets.some(ds => ds.isFocused);
            datasets.forEach((ds, i) => {
                ds.hidden = false; const baseColor = i === 0 ? colorY1 : colorY2;
                ds.backgroundColor = !anyFocused ? baseColor : (ds.isFocused ? baseColor : baseColor + '33');
            });
            ci.update();
        };

        app.yearCompChartInstance = new Chart(document.getElementById('radarChart').getContext('2d'), {
            type: 'bar', data: { labels: labels, datasets: compDatasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, activeElements, chart) => { if (activeElements.length > 0) toggleBarFocusMode(chart, activeElements[0].datasetIndex); },
                onHover: (e, activeElements) => { e.native.target.style.cursor = activeElements.length ? 'pointer' : 'default'; },
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Kanit', size: 11 }, usePointStyle: true }, onClick: function(e, item, legend) { toggleBarFocusMode(legend.chart, item.datasetIndex); } },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', callbacks: { afterBody: function(ctx) { if (ctx.length === 2) return `ผลต่าง: ${(ctx[1].raw - ctx[0].raw).toFixed(2)}`; } } }
                },
                scales: { y: { min: 0, max: 5 }, x: { grid: { display: false } } }
            },
            plugins: [{
                id: 'barDataLabels',
                afterDatasetsDraw(chart) {
                    const { ctx, data } = chart; ctx.save(); ctx.font = 'bold 11px Kanit'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                    data.datasets.forEach((dataset, datasetIndex) => {
                        if (dataset.isFocused) {
                            const meta = chart.getDatasetMeta(datasetIndex); ctx.fillStyle = datasetIndex === 0 ? '#475569' : '#1d4ed8';
                            ctx.shadowColor = 'rgba(255, 255, 255, 0.95)'; ctx.shadowBlur = 4;
                            meta.data.forEach((element, index) => { const value = dataset.data[index]; if (value > 0) ctx.fillText(Number(value).toFixed(2), element.x, element.y - 4); });
                        }
                    });
                    ctx.restore();
                }
            }]
        });
        app.charts.push(app.yearCompChartInstance);
    };
    runYearComparisonPipeline();
    document.getElementById('compare-year-1').addEventListener('change', runYearComparisonPipeline);
    document.getElementById('compare-year-2').addEventListener('change', runYearComparisonPipeline);

    // 2.4 Donut
    app.charts.push(new Chart(document.getElementById('donutChart'), { type: 'doughnut', data: { labels: Object.keys(levels), datasets: [{ data: Object.values(levels), backgroundColor: ['#e2e8f0', '#cbd5e1', '#94a3b8', '#f59e0b', '#ef4444'], borderWidth: 2, borderColor: '#fff'}] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } } }));

    // 2.2 Multi-Line (สูงสุด 2 เส้นพร้อมพ่นตัวเลข)
    const palette = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#64748b', '#0ea5e9', '#f43f5e', '#d97706', '#14b8a6'];
    const lineDatasets = app.data.scores.map((enabler, index) => ({ label: enabler.code, data: years.map(y => enabler.averageScoreByYear[y] || null), borderColor: palette[index % 10], backgroundColor: palette[index % 10], tension: 0.3, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 8, pointHoverBackgroundColor: '#ffffff', pointHoverBorderWidth: 3, isFocused: false }));

    const toggleLineFocusMode = (ci, clickedIndex) => {
        const datasets = ci.data.datasets;
        if (datasets[clickedIndex].isFocused) { datasets[clickedIndex].isFocused = false; } 
        else {
            let focusedCount = datasets.filter(ds => ds.isFocused).length;
            if (focusedCount >= 2) { const first = datasets.findIndex(ds => ds.isFocused); if (first !== -1) datasets[first].isFocused = false; }
            datasets[clickedIndex].isFocused = true;
        }
        const anyFocused = datasets.some(ds => ds.isFocused);
        datasets.forEach((ds, i) => {
            ds.hidden = false;
            if (!anyFocused) { ds.borderColor = palette[i % 10]; ds.borderWidth = 2.5; } 
            else { ds.borderColor = ds.isFocused ? palette[i % 10] : palette[i % 10] + '26'; ds.borderWidth = ds.isFocused ? 4.5 : 1.5; }
        });
        ci.update();
    };

    app.charts.push(new Chart(document.getElementById('lineChart'), {
        type: 'line', data: { labels: years, datasets: lineDatasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', intersect: false },
            onClick: (e, activeElements, chart) => { if (activeElements.length > 0) toggleLineFocusMode(chart, activeElements[0].datasetIndex); },
            onHover: (e, activeElements) => { e.native.target.style.cursor = activeElements.length ? 'pointer' : 'default'; },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 15 }, onClick: function(e, item, legend) { toggleLineFocusMode(legend.chart, item.datasetIndex); } },
                tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: 12 }
            },
            scales: { y: { min: 2, max: 5.4 } }
        },
        plugins: [{
            id: 'isolateDataLabels',
            afterDatasetsDraw(chart) {
                const { ctx, data } = chart; ctx.save(); ctx.font = 'bold 12px Kanit'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                data.datasets.forEach((dataset, datasetIndex) => {
                    if (dataset.isFocused) {
                        ctx.fillStyle = palette[datasetIndex % 10]; ctx.shadowColor = 'rgba(255, 255, 255, 0.9)'; ctx.shadowBlur = 5;
                        chart.getDatasetMeta(datasetIndex).data.forEach((element, index) => { const value = dataset.data[index]; if (value !== null) ctx.fillText(Number(value).toFixed(2), element.x, element.y - 8); });
                    }
                });
                ctx.restore();
            }
        }]
    }));

    // 2.3 Stacked Column + Popup
    const showOwnerTasksModal = (owner) => {
        const ownerTasks = app.data.ofis.filter(o => o.elementOwnerId === owner.id);
        const statusStyles = { 'Not started': 'bg-slate-100 text-slate-600 border-slate-200', 'In progress': 'bg-amber-50 text-amber-600 border-amber-200/70', 'Done': 'bg-emerald-50 text-emerald-600 border-emerald-200/70', 'Qualified': 'bg-teal-50 text-teal-600 border-teal-200/70', 'Delayed': 'bg-rose-50 text-rose-600 border-rose-200/70' };

        const contentHtml = `
            <div class="space-y-2.5 mt-2">
                ${ownerTasks.length === 0 ? '<p class="text-center text-xs text-slate-400 py-6">ไม่มีภาระงานผูกมัดในระบบ</p>' : 
                ownerTasks.map(t => {
                    const badgeClass = statusStyles[t.overallStatus] || 'bg-slate-100';
                    return `
                        <div class="p-3 bg-white border border-slate-200 rounded-2xl flex justify-between items-center gap-2">
                            <div class="space-y-1"><div class="flex items-center gap-1.5"><span class="bg-blue-50 text-blue-600 border px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">${t.id}</span></div><p class="text-xs font-bold text-slate-700 leading-relaxed">${t.topicName || 'OFI Task'}</p></div>
                            <div class="flex items-center gap-2 shrink-0"><span class="text-[10px] py-0.5 px-2 rounded-full border ${badgeClass} font-bold">${t.overallStatus}</span>
                            ${t._source_file ? `<a href="${app.API_BASE_URL}/static-data/${t._source_file}" target="_blank" class="p-1 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors"><svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></a>` : ''}</div>
                        </div>`;
                }).join('')}
            </div>`;
        showSharedGlassModal(`📋 ภาระงานผูกมัดของ: ${owner.nameThai}`, `สรุปรายละเอียดประวัติงานคงค้างทั้งหมด ${ownerTasks.length} รายการ`, contentHtml);
    };

    app.charts.push(new Chart(document.getElementById('stackedChart'), {
        type: 'bar', data: { labels: ownerNames, datasets: stackDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (e, activeElements) => { if (activeElements.length > 0) showOwnerTasksModal(app.data.owners[activeElements[0].index]); },
            onHover: (e, activeElements) => { e.native.target.style.cursor = activeElements.length ? 'pointer' : 'default'; },
            scales: { x: { stacked: true }, y: { stacked: true, ticks: { stepSize: 1 } } }
        }
    }));
}