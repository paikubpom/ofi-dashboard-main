window.Chart = Chart;

// 🌈 กำหนด Palette สีมาตรฐานขององค์กร PTT
const PTT_COLORS = {
    blueDark: '#00508F',
    blueLight: '#3B82F6',
    slateGray: '#64748B',
    alertRed: '#EF4444',
    amberWarning: '#F59E0B',
    successGreen: '#10B981',
    emeraldDark: '#047857'
};

// Helper function to fade hex colors to rgba
const fadeColor = (hex, opacity = 0.3) => {
    if (hex.startsWith('#')) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return hex;
};

// Custom Chart.js plugin to draw value labels directly on elements
const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
        if (chart.config.options.plugins?.valueLabels?.display === false) return;
        
        const { ctx } = chart;
        ctx.save();
        
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (meta.hidden) return;
            
            meta.data.forEach((element, index) => {
                const value = dataset.data[index];
                if (value === null || value === undefined || value === 0) return;
                
                const isScore = chart.config.options.plugins?.valueLabels?.isScore === true;
                const text = isScore ? value.toFixed(4) : Math.round(value).toString();
                
                let x = element.x;
                let y = element.y;
                if (x === undefined || y === undefined) return;
                
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                
                if (chart.config.type === 'bar') {
                    if (chart.config.options.indexAxis === 'y') {
                        // Horizontal bar
                        ctx.textAlign = 'left';
                        ctx.fillStyle = '#1E293B';
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.lineWidth = 2.5;
                        ctx.strokeText(text, x + 5, y + 3);
                        ctx.fillText(text, x + 5, y + 3);
                        return;
                    }
                    
                    if (chart.config.options.scales?.y?.stacked || chart.config.options.scales?.x?.stacked) {
                        // Stacked vertical bar
                        ctx.fillStyle = '#FFFFFF';
                        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                        ctx.lineWidth = 2;
                        ctx.strokeText(text, x, y + 4);
                        ctx.fillText(text, x, y + 4);
                        return;
                    }
                    
                    // Standard vertical bar
                    ctx.fillStyle = '#1E293B';
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2.5;
                    ctx.strokeText(text, x, y - 6);
                    ctx.fillText(text, x, y - 6);
                    return;
                }
                
                if (chart.config.type === 'line') {
                    // Match the line color for better visual structure and less confusion
                    ctx.fillStyle = dataset.borderColor || '#1E293B';
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2.5;
                    ctx.strokeText(text, x, y - 8);
                    ctx.fillText(text, x, y - 8);
                    return;
                }
                
                if (chart.config.type === 'doughnut' || chart.config.type === 'pie') {
                    const model = element;
                    const midAngle = model.startAngle + (model.endAngle - model.startAngle) / 2;
                    const r = (model.innerRadius + model.outerRadius) / 2;
                    x = model.x + Math.cos(midAngle) * r;
                    y = model.y + Math.sin(midAngle) * r;
                    
                    ctx.fillStyle = '#1E293B';
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2.5;
                    ctx.strokeText(text, x, y + 3);
                    ctx.fillText(text, x, y + 3);
                    return;
                }
            });
        });
        ctx.restore();
    }
};

// Register the plugin globally if Chart is available
if (typeof Chart !== 'undefined') {
    Chart.register(valueLabelsPlugin);
}

/**
 * 🔍 ฟังก์ชันเสริมช่วยดึงชื่อกราฟจากแท็ก <h3> ของการ์ดอัตโนมัติ
 */
function logChartRendering(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (ctx) {
        // วิ่งไปหาการ์ดที่ครอบอยู่ แล้วดึงข้อความในแท็ก h3 ออกมา
        const cardTitle = ctx.closest('.glass-card')?.querySelector('h3')?.textContent || 'ไม่ระบุชื่อกราฟ';
        console.log(`📊 กำลังวาดกราฟ: "${cardTitle.trim()}"`);
    }
}

/**
 * 📊 1. กราฟเปรียบเทียบคะแนนภาพรวมรายปี (Bar Chart - กลุ่ม 2.1)
 */
export function renderYearlyComparisonChart(canvasId, labels, baseYearData, compYearData, baseYearLabel = 'ปีฐาน', compYearLabel = 'ปีเทียบ', activeModules = []) {
    
    // 🌟 สั่ง Log ชื่อกราฟอัตโนมัติ
    logChartRendering(canvasId); 

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const hasSelection = activeModules && activeModules.length > 0;
    const baseColors = labels.map(label => {
        const isActive = !hasSelection || activeModules.includes(label);
        return isActive ? PTT_COLORS.slateGray : fadeColor(PTT_COLORS.slateGray, 0.3);
    });
    const compColors = labels.map(label => {
        const isActive = !hasSelection || activeModules.includes(label);
        return isActive ? PTT_COLORS.blueLight : fadeColor(PTT_COLORS.blueLight, 0.3);
    });

    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = baseYearData;
        existingChart.data.datasets[0].label = baseYearLabel;
        existingChart.data.datasets[0].backgroundColor = baseColors;
        existingChart.data.datasets[1].data = compYearData;
        existingChart.data.datasets[1].label = compYearLabel;
        existingChart.data.datasets[1].backgroundColor = compColors;
        existingChart.update();
        return existingChart;
    }

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: baseYearLabel, data: baseYearData, backgroundColor: baseColors, borderRadius: 6 },
                { label: compYearLabel, data: compYearData, backgroundColor: compColors, borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } },
                valueLabels: { isScore: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                label += context.parsed.y.toFixed(4);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 5.0,
                    ticks: {
                        stepSize: 0.5,
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

/**
 * 🍩 2. กราฟวงแหวนระดับความยาก (Doughnut Chart - กลุ่ม 2.4)
 */
export function renderOfiLevelChart(canvasId, dataValues, labels = ['L1', 'L2', 'L3', 'L4', 'L5', 'N/A'], activeLevels = []) {
    
    // 🌟 สั่ง Log ชื่อกราฟอัตโนมัติ
    logChartRendering(canvasId);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const totalRecords = dataValues.reduce((a, b) => a + b, 0);
    const originalColors = ['#E2E8F0', '#94A3B8', PTT_COLORS.amberWarning, PTT_COLORS.blueLight, PTT_COLORS.alertRed, '#CBD5E1'];

    const hasSelection = activeLevels && activeLevels.length > 0;
    const bgColors = labels.map((label, idx) => {
        const cleanLabel = label.startsWith('L') ? label.slice(1) : label;
        const isActive = !hasSelection || activeLevels.includes(cleanLabel);
        return isActive ? originalColors[idx] : fadeColor(originalColors[idx], 0.3);
    });

    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = dataValues;
        existingChart.data.datasets[0].backgroundColor = bgColors;
        if (existingChart.options.plugins && existingChart.options.plugins.centerText) {
            existingChart.options.plugins.centerText.text = totalRecords.toString();
        }
        existingChart.update();
        return existingChart;
    }

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 2 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                centerText: { display: true, text: totalRecords.toString() }
            },
            cutout: '70%'
        }
    });
}

/**
 * 📈 3. กราฟเส้นแนวโน้มคะแนนเฉลี่ย 6 ปี (Line Chart - กลุ่ม 2.2)
 */
export function render6YearTrendChart(canvasId, yearsLabels, datasetsData) {
    
    // 🌟 สั่ง Log ชื่อกราฟอัตโนมัติ
    logChartRendering(canvasId);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.data.labels = yearsLabels;
        existingChart.data.datasets = datasetsData;
        existingChart.update();
        return existingChart;
    }

    return new Chart(ctx, {
        type: 'line',
        data: { labels: yearsLabels, datasets: datasetsData },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                valueLabels: { isScore: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                label += context.parsed.y.toFixed(4);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 2.0,
                    max: 5.4,
                    ticks: {
                        stepSize: 0.5,
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

/**
 * 📊 4. กราฟปริมาณงานและสถานะรายบุคคล (Stacked Bar Chart - กลุ่ม 2.3)
 */
export function renderIndividualWorkloadChart(canvasId, userLabels, statusDatasets, activeOwners = []) {
    
    // 🌟 สั่ง Log ชื่อกราฟอัตโนมัติ
    logChartRendering(canvasId);

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const hasSelection = activeOwners && activeOwners.length > 0;
    const datasets = statusDatasets.map(ds => {
        const originalColor = ds.backgroundColor;
        const bgColors = userLabels.map(user => {
            const isActive = !hasSelection || activeOwners.includes(user);
            return isActive ? originalColor : fadeColor(originalColor, 0.3);
        });
        return {
            ...ds,
            backgroundColor: bgColors
        };
    });

    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.data.labels = userLabels;
        existingChart.data.datasets = datasets;
        existingChart.update();
        return existingChart;
    }

    return new Chart(ctx, {
        type: 'bar',
        data: { labels: userLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, min: 0, ticks: { stepSize: 1 } } },
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }
        }
    });
}
/**
 * 📊 5. กราฟแท่งแนวนอน ประเด็นปัญหาที่พบบ่อย (Horizontal Bar Chart - กลุ่ม 4.2 ของ Owner)
 */
export function renderHorizontalBarChart(canvasId, labels, dataValues, barColor = '#8B5CF6') {
    // 🌟 เรียกใช้ Log ดักจับชื่อกราฟจาก h3 อัตโนมัติ
    logChartRendering(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = dataValues;
        existingChart.update();
        return existingChart;
    }

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: barColor,
                borderRadius: 4,
                barThickness: 16
            }]
        },
        options: {
            indexAxis: 'y', // 🌟 จุดสำคัญที่ทำให้กราฟกลายเป็นแนวนอนสไตล์ 4.2
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { min: 0, max: 2.0, ticks: { stepSize: 0.2 } },
                y: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
        }
    });
}

/**
 * 🧱 6. ฟังก์ชันควบคุมตารางติดตามสถานะเฟสงาน (Gantt-Grid - กลุ่ม 4.1 ของ Owner)
 */
export function renderGanttGrid(containerId, tasks) {
    // 🌟 เรียกใช้ Log ดักจับชื่อกราฟจาก h3 อัตโนมัติ
    logChartRendering(containerId);
    
    const container = document.getElementById(containerId);
    if (!container) return;
 
    // เนรมิตโครงสร้าง HTML Table ให้สัดส่วนและสีตรงตามปกหน้าจอของบอสเป๊ะๆ
    let html = `
        <table class="w-full text-left border-collapse text-[11px] mt-2">
            <thead>
                <tr class="text-slate-400 font-bold uppercase border-b border-slate-100">
                    <th class="py-2 w-[40%]">หัวข้อการประเมิน (Assessment Topic)</th>
                    <th class="py-2 text-center w-[12%]">PLAN</th>
                    <th class="py-2 text-center w-[12%]">EO/EC</th>
                    <th class="py-2 text-center w-[12%]">ASSESS</th>
                    <th class="py-2 text-center w-[12%]">DOC</th>
                    <th class="py-2 text-center w-[12%]">SITE</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-semibold text-slate-700">
    `;

    tasks.forEach(task => {
        html += `
            <tr class="align-middle border-b border-slate-50">
                <td class="py-3 font-bold text-slate-800 pr-2 truncate max-w-[200px]" title="${task.id}">${task.id}</td>
                <td class="py-3 text-center">${renderGanttBlock(task.plan)}</td>
                <td class="py-3 text-center">${renderGanttBlock(task.boec)}</td>
                <td class="py-3 text-center">${renderGanttBlock(task.assess)}</td>
                <td class="py-3 text-center">${renderGanttBlock(task.doc)}</td>
                <td class="py-3 text-center">${renderGanttBlock(task.site)}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ฟังก์ชันย่อยช่วยพ่นบล็อกสีสถานะใน Gantt
function renderGanttBlock(status) {
    if (status === 'green') return `<div class="w-14 h-5 bg-[#10B981] rounded-md shadow-sm mx-auto"></div>`;
    if (status === 'yellow') return `<div class="w-14 h-5 bg-[#F59E0B] rounded-md shadow-sm mx-auto"></div>`;
    if (status === 'red') return `<div class="w-14 h-5 bg-[#EF4444] rounded-md shadow-sm mx-auto"></div>`;
    return `<div class="w-14 h-5 bg-[#E2E8F0] rounded-md shadow-sm mx-auto"></div>`;
}

/**
 * 🍩 7. กราฟวงแหวนแหล่งที่มาข้อบกพร่อง + การ์ดด้านข้าง (กลุ่ม 3.3 ของ Auditor)
 */
export function renderAuditorDoughnut(canvasId, dataValues, labels = ['ตรวจพบโดย สตช.', 'ตรวจจากแผน Enabler']) {
    logChartRendering(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = dataValues;
        existingChart.update();
        return existingChart;
    }

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#00508F', '#3B82F6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%'
        }
    });
}

/**
 * 📊 8. ฟังก์ชันปั้นรายการหลอดความคืบหน้า 5 เฟส (Progress Bars - กลุ่ม 3.2 ของ Auditor)
 */
export function renderAuditorProgressList(containerId, progressData) {
    logChartRendering(containerId);
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = `<div class="space-y-4 mt-2">`;
    progressData.forEach(item => {
        html += `
            <div>
                <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                    <span>${item.phase}: ${item.title}</span>
                    <span class="text-slate-500">${item.percent}% (${item.count}/${item.total})</span>
                </div>
                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div class="bg-blue-500 h-2.5 rounded-full transition-all duration-500" style="width: ${item.percent}%"></div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

/**
 * 🧮 9. ฟังก์ชันปั้นตารางคะแนนความเคลื่อนไหวสี Heatmap (กลุ่ม 3.1 ของ Auditor)
 */
export function renderTopicScoreMatrix(containerId, dataRows) {
    logChartRendering(containerId);
    const container = document.getElementById(containerId);
    if (!container) return;

    // Reset to page 1 if the dataset changes
    const rowsSignature = dataRows.map(r => r.code + ':' + r.name).join(',');
    if (container.dataset.signature !== rowsSignature) {
        container.dataset.page = 1;
        container.dataset.signature = rowsSignature;
    }

    let currentPage = parseInt(container.dataset.page || 1);
    const itemsPerPage = 5;
    const totalItems = dataRows.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    container.dataset.page = currentPage;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const pageRows = dataRows.slice(startIndex, endIndex);

    let html = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[11px] mt-4">
                <thead>
                    <tr class="text-slate-400 font-bold uppercase border-b border-slate-100">
                        <th class="py-2 min-w-[200px]">หัวข้อการประเมิน (TOPIC NAME)</th>
                        <th class="py-2 text-center w-16">2563</th>
                        <th class="py-2 text-center w-16">2564</th>
                        <th class="py-2 text-center w-16">2565</th>
                        <th class="py-2 text-center w-16">2566</th>
                        <th class="py-2 text-center w-16">2567</th>
                        <th class="py-2 text-center w-16">2568</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50 font-semibold text-slate-700">
    `;

    // ฟังก์ชันย่อยคำนวณสีพื้นหลังตามระดับคะแนนให้ตรงปก
    const getScoreBgClass = (score) => {
        const val = parseFloat(score);
        if (val >= 4.6) return 'bg-[#10B981] text-white'; // เขียวเข้ม (เช่น 4.7, 5.0)
        if (val >= 3.5) return 'bg-[#A7F3D0] text-emerald-800'; // เขียวอ่อน (เช่น 3.5, 4.0)
        return 'bg-[#FCD34D] text-amber-900'; // สีเหลือง/ส้ม (เช่น 3.0)
    };

    pageRows.forEach(row => {
        html += `
            <tr class="hover:bg-slate-50/50">
                <td class="py-2.5 pr-4 font-medium text-slate-800">
                    <span class="text-blue-600 mr-1.5 font-bold text-[10px] bg-blue-50 px-1 py-0.5 rounded">${row.code}</span>${row.name}
                </td>
                <td class="py-2.5 text-center"><span class="px-2.5 py-1 rounded-md block mx-0.5 text-[10px] font-bold ${getScoreBgClass(row.y63)}">${row.y63.toFixed(4)}</span></td>
                <td class="py-2.5 text-center"><span class="px-2.5 py-1 rounded-md block mx-0.5 text-[10px] font-bold ${getScoreBgClass(row.y64)}">${row.y64.toFixed(4)}</span></td>
                <td class="py-2.5 text-center"><span class="px-2.5 py-1 rounded-md block mx-0.5 text-[10px] font-bold ${getScoreBgClass(row.y65)}">${row.y65.toFixed(4)}</span></td>
                <td class="py-2.5 text-center"><span class="px-2.5 py-1 rounded-md block mx-0.5 text-[10px] font-bold ${getScoreBgClass(row.y66)}">${row.y66.toFixed(4)}</span></td>
                <td class="py-2.5 text-center"><span class="px-2.5 py-1 rounded-md block mx-0.5 text-[10px] font-bold ${getScoreBgClass(row.y67)}">${row.y67.toFixed(4)}</span></td>
                <td class="py-2.5 text-center"><span class="px-2.5 py-1 rounded-md block mx-0.5 text-[10px] font-bold ${getScoreBgClass(row.y68)}">${row.y68.toFixed(4)}</span></td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;

    if (totalPages > 1) {
        let pagesHtml = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                pagesHtml += `<span class="px-2.5 py-1 bg-[#00508F] text-white text-xs font-bold rounded-lg border border-[#00508F] shadow-sm">${i}</span>`;
            } else {
                pagesHtml += `<button data-target-page="${i}" class="btn-matrix-page px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">${i}</button>`;
            }
        }

        html += `
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
                <div class="text-[11px] font-bold text-slate-400">แสดง ${startIndex + 1} - ${endIndex} จากทั้งหมด ${totalItems} รายการ</div>
                <div class="flex items-center gap-1">
                    <button data-target-page="${currentPage - 1}" class="btn-matrix-page px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition" ${currentPage === 1 ? 'disabled' : ''}>&laquo; ก่อนหน้า</button>
                    ${pagesHtml}
                    <button data-target-page="${currentPage + 1}" class="btn-matrix-page px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition" ${currentPage === totalPages ? 'disabled' : ''}>ถัดไป &raquo;</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    if (!container.dataset.listenerAttached) {
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-matrix-page');
            if (btn && !btn.disabled) {
                const targetPage = parseInt(btn.getAttribute('data-target-page'));
                container.dataset.page = targetPage;
                renderTopicScoreMatrix(containerId, dataRows);
            }
        });
        container.dataset.listenerAttached = 'true';
    }
}