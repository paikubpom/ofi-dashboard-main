export function showSharedGlassModal(title, subtitle, contentHtml, size = 'md', onClose = null) {
    let widthClass = 'max-w-2xl';
    if (size === 'lg') widthClass = 'max-w-4xl';
    else if (size === 'xl') widthClass = 'max-w-6xl';
    else if (size === 'full') widthClass = 'max-w-[92vw]';

    const modalHtml = `
        <div id="global-modal-overlay" class="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300 opacity-0">
            <div class="glass-card ${widthClass} w-full p-6 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] transform scale-95 transition-all duration-300">
                <div class="flex justify-between items-center border-b border-slate-200/40 pb-4 mb-4">
                    <div>
                        <h4 class="text-base font-bold text-slate-800">${title}</h4>
                        <p class="text-[11px] text-slate-600 mt-0.5 font-bold">${subtitle}</p>
                    </div>
                    <button id="close-global-modal-btn" class="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto pr-1">
                    ${contentHtml}
                </div>
            </div>
        </div>`;

    const oldModal = document.getElementById('global-modal-overlay');
    if (oldModal) {
        const oldCloseBtn = oldModal.querySelector('#close-global-modal-btn');
        if (oldCloseBtn && oldCloseBtn._onClose) {
            oldCloseBtn._onClose();
        }
        oldModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const overlay = document.getElementById('global-modal-overlay');
    const card = overlay.querySelector('.glass-card');
    const closeBtn = document.getElementById('close-global-modal-btn');

    if (onClose) {
        closeBtn._onClose = onClose;
    }

    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        card.classList.remove('scale-95');
    }, 15);

    const closeModal = () => {
        overlay.classList.add('opacity-0');
        card.classList.add('scale-95');
        if (typeof onClose === 'function') onClose();
        setTimeout(() => overlay.remove(), 250);
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

/**
 * 📊 ฟังก์ชันวิเคราะห์และสรุปผลข้อมูลกราฟเป็นภาษาไทยแบบไดนามิก (Dynamic Chart Summary Generator)
 */
function generateChartSummaryHtml(chart, title) {
    const data = chart.data;
    if (!data || !data.labels || !data.datasets || data.datasets.length === 0) {
        return `
            <div class="flex items-center gap-2 text-slate-500 font-medium">
                <span>📊</span> <span>ไม่พบข้อมูลสำหรับการสรุปสถิติ</span>
            </div>
        `;
    }

    const labels = data.labels;
    const datasets = data.datasets;
    const isScore = chart.config.options?.plugins?.valueLabels?.isScore === true;
    
    const formatVal = (val) => {
        if (val === null || val === undefined) return '-';
        return isScore ? val.toFixed(4) : Math.round(val).toLocaleString();
    };

    let html = `
        <div class="flex flex-col gap-3 font-sans text-left">
            <div class="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <span class="text-base text-blue-600">📊</span>
                <span class="text-[13px] font-extrabold text-[#00508F]">วิเคราะห์สรุปสถิติ: ${title.trim()}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    `;

    const isStacked = chart.config.options?.scales?.x?.stacked || chart.config.options?.scales?.y?.stacked;

    if (datasets.length <= 2) {
        // Detailed card layout for small number of datasets
        datasets.forEach((dataset, dsIdx) => {
            const dsName = dataset.label || `ชุดข้อมูลที่ ${dsIdx + 1}`;
            const validValues = dataset.data
                .map((v, i) => {
                    let numericValue = v;
                    if (v && typeof v === 'object') {
                        numericValue = v.y !== undefined ? v.y : (v.v !== undefined ? v.v : null);
                    }
                    return { value: numericValue, label: labels[i] || `รายการที่ ${i + 1}` };
                })
                .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value));
                
            if (validValues.length === 0) return;

            const sum = validValues.reduce((acc, item) => acc + item.value, 0);
            const avg = sum / validValues.length;
            
            let maxItem = validValues[0];
            let minItem = validValues[0];
            validValues.forEach(item => {
                if (item.value > maxItem.value) maxItem = item;
                if (item.value < minItem.value) minItem = item;
            });

            const color = dataset.borderColor || dataset.backgroundColor || '#3B82F6';

            html += `
                <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1.5">
                    <div class="font-bold text-[12px] text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-1 mb-1">
                        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${Array.isArray(color) ? color[0] : color}"></span>
                        <span>${dsName}</span>
                    </div>
                    <div class="flex flex-col gap-1 text-[12px] text-slate-600">
                        <div class="flex justify-between items-center">
                            <span>🏷️ จำนวนรายการ:</span>
                            <span class="font-semibold text-slate-800">${validValues.length} รายการ</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span>📈 ค่าเฉลี่ย (Average):</span>
                            <span class="font-bold text-blue-600">${formatVal(avg)}</span>
                        </div>
                        <div class="flex justify-between items-start gap-4">
                            <span>🏆 ค่าสูงสุด (Max):</span>
                            <span class="font-bold text-emerald-600 text-right">${formatVal(maxItem.value)} <span class="text-[10px] font-bold text-slate-600">(${maxItem.label})</span></span>
                        </div>
                        <div class="flex justify-between items-start gap-4">
                            <span>⚠️ ค่าต่ำสุด (Min):</span>
                            <span class="font-bold text-amber-600 text-right">${formatVal(minItem.value)} <span class="text-[10px] font-bold text-slate-600">(${minItem.label})</span></span>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        // Compact list layout for more than 2 datasets
        html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2 col-span-full">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-[11px] border-collapse">
                        <thead>
                            <tr class="text-slate-600 font-extrabold border-b border-slate-200">
                                <th class="py-1">ชุดข้อมูล</th>
                                <th class="py-1 text-center">ค่าเฉลี่ย</th>
                                <th class="py-1 text-right">ค่าสูงสุด (หมวดหมู่)</th>
                                <th class="py-1 text-right">ค่าต่ำสุด (หมวดหมู่)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 font-semibold text-slate-700">
        `;
        datasets.forEach((dataset, dsIdx) => {
            const dsName = dataset.label || `ชุดข้อมูลที่ ${dsIdx + 1}`;
            const validValues = dataset.data
                .map((v, i) => {
                    let numericValue = v;
                    if (v && typeof v === 'object') {
                        numericValue = v.y !== undefined ? v.y : (v.v !== undefined ? v.v : null);
                    }
                    return { value: numericValue, label: labels[i] || `รายการที่ ${i + 1}` };
                })
                .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value));
            
            if (validValues.length === 0) return;

            const sum = validValues.reduce((acc, item) => acc + item.value, 0);
            const avg = sum / validValues.length;
            
            let maxItem = validValues[0];
            let minItem = validValues[0];
            validValues.forEach(item => {
                if (item.value > maxItem.value) maxItem = item;
                if (item.value < minItem.value) minItem = item;
            });

            const color = dataset.borderColor || dataset.backgroundColor || '#3B82F6';

            html += `
                <tr class="hover:bg-slate-50/50">
                    <td class="py-1.5 flex items-center gap-1.5 pr-2">
                        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${Array.isArray(color) ? color[0] : color}"></span>
                        <span class="font-bold text-slate-800">${dsName}</span>
                    </td>
                    <td class="py-1.5 text-center text-blue-600 font-bold">${formatVal(avg)}</td>
                    <td class="py-1.5 text-right text-emerald-600 font-bold">${formatVal(maxItem.value)} <span class="text-[10px] font-bold text-slate-600">(${maxItem.label})</span></td>
                    <td class="py-1.5 text-right text-amber-600 font-bold">${formatVal(minItem.value)} <span class="text-[10px] font-bold text-slate-600">(${minItem.label})</span></td>
                </tr>
            `;
        });
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    html += `</div>`; // Close grid

    // Comparative summary if exactly 2 datasets
    if (datasets.length === 2) {
        const ds1 = datasets[0];
        const ds2 = datasets[1];
        const ds1Name = ds1.label || 'ปีฐาน';
        const ds2Name = ds2.label || 'ปีเทียบ';
        
        let growthItems = [];
        let declineItems = [];

        labels.forEach((label, idx) => {
            const val1 = ds1.data[idx];
            const val2 = ds2.data[idx];
            if (val1 !== null && val1 !== undefined && val2 !== null && val2 !== undefined) {
                const diff = val2 - val1;
                const percentDiff = val1 !== 0 ? (diff / val1) * 100 : 0;
                const info = { label, val1, val2, diff, percentDiff };
                if (diff > 0.0001) {
                    growthItems.push(info);
                } else if (diff < -0.0001) {
                    declineItems.push(info);
                }
            }
        });

        growthItems.sort((a, b) => b.diff - a.diff);
        declineItems.sort((a, b) => a.diff - b.diff);

        let compSummary = '';
        if (growthItems.length > 0) {
            const topGrowth = growthItems[0];
            compSummary += `
                <div class="flex items-start gap-1.5 text-emerald-700 bg-emerald-50/40 p-2 rounded-lg border border-emerald-100/50">
                    <span class="text-[14px]">📈</span>
                    <span class="text-[11px]">
                        <strong>พัฒนาการสูงสุด:</strong> 
                        หมวด <strong>${topGrowth.label}</strong> เพิ่มขึ้นจาก ${formatVal(topGrowth.val1)} เป็น ${formatVal(topGrowth.val2)} 
                        (เพิ่มขึ้น <span class="font-bold">+${formatVal(topGrowth.diff)}</span> หรือ +${topGrowth.percentDiff.toFixed(2)}%)
                    </span>
                </div>
            `;
        }

        if (declineItems.length > 0) {
            const topDecline = declineItems[0];
            compSummary += `
                <div class="flex items-start gap-1.5 text-amber-700 bg-amber-50/40 p-2 rounded-lg border border-amber-100/50">
                    <span class="text-[14px]">📉</span>
                    <span class="text-[11px]">
                        <strong>คะแนนลดลงมากที่สุด:</strong> 
                        หมวด <strong>${topDecline.label}</strong> ลดลงจาก ${formatVal(topDecline.val1)} เป็น ${formatVal(topDecline.val2)} 
                        (ลดลง <span class="font-bold">${formatVal(topDecline.diff)}</span> หรือ ${topDecline.percentDiff.toFixed(2)}%)
                    </span>
                </div>
            `;
        }

        if (compSummary) {
            html += `
                <div class="mt-2 flex flex-col gap-1.5">
                    <div class="text-[11px] font-bold text-slate-700">🔍 วิเคราะห์การพัฒนาเปรียบเทียบ (${ds1Name} vs ${ds2Name}):</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        ${compSummary}
                    </div>
                </div>
            `;
        }
    } else if (chart.config.type === 'doughnut' || chart.config.type === 'pie') {
        const dataset = datasets[0];
        const validValues = dataset.data
            .map((v, i) => ({ value: v, label: labels[i] }))
            .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value));
            
        if (validValues.length > 0) {
            const total = validValues.reduce((acc, item) => acc + item.value, 0);
            const proportions = validValues.map(item => ({
                ...item,
                percent: total > 0 ? (item.value / total) * 100 : 0
            })).sort((a, b) => b.value - a.value);

            const topProp = proportions[0];
            html += `
                <div class="mt-2 p-2 bg-blue-50/30 border border-blue-100/40 rounded-xl text-[11px] text-slate-700 flex items-start gap-1.5">
                    <span class="text-sm mt-0.5">💡</span>
                    <span>
                        หมวดหมู่ที่มีสัดส่วนสูงสุดคือ <strong>${topProp.label}</strong> เท่ากับ 
                        <strong>${formatVal(topProp.value)}</strong> (คิดเป็น <strong>${topProp.percent.toFixed(2)}%</strong> ของทั้งหมดที่มีผลรวม ${formatVal(total)})
                    </span>
                </div>
            `;
        }
    }

    if (isStacked && labels.length > 0) {
        const labelTotals = labels.map((label, idx) => {
            let total = 0;
            datasets.forEach(ds => {
                const val = ds.data[idx];
                if (val !== null && val !== undefined && !isNaN(val)) {
                    total += val;
                }
            });
            return { label, value: total };
        });

        let maxTotal = labelTotals[0];
        let minTotal = labelTotals[0];
        labelTotals.forEach(item => {
            if (item.value > maxTotal.value) maxTotal = item;
            if (item.value < minTotal.value) minTotal = item;
        });

        const totalSum = labelTotals.reduce((acc, item) => acc + item.value, 0);

        html += `
            <div class="mt-2 bg-gradient-to-r from-blue-50/40 to-indigo-50/20 p-2.5 rounded-xl border border-blue-100/40 text-[11px] text-slate-700 flex flex-col gap-1.5">
                <div class="font-bold text-[#00508F] flex items-center gap-1.5">
                    <span>📊</span>
                    <span>สรุปปริมาณสะสมทั้งหมด (Total Accumulated):</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div class="flex justify-between items-center bg-white/60 px-2 py-1.5 rounded-lg border border-slate-100/40">
                        <span class="text-slate-500">ผลรวมสะสม:</span>
                        <span class="font-bold text-slate-800">${formatVal(totalSum)}</span>
                    </div>
                    <div class="flex justify-between items-center bg-white/60 px-2 py-1.5 rounded-lg border border-slate-100/40">
                        <span class="text-slate-500">สูงสุด:</span>
                        <span class="font-bold text-emerald-600">${maxTotal.label} (${formatVal(maxTotal.value)})</span>
                    </div>
                    <div class="flex justify-between items-center bg-white/60 px-2 py-1.5 rounded-lg border border-slate-100/40">
                        <span class="text-slate-500">ต่ำสุด:</span>
                        <span class="font-bold text-amber-600">${minTotal.label} (${formatVal(minTotal.value)})</span>
                    </div>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

/**
 * 🔎 ฟังก์ชันขยายขนาดกราฟสำหรับผู้สูงอายุ (Chart Accessibility Zoom Modal)
 * ทำการดึงโครงสร้างกราฟเดิมมาเรนเดอร์ใหม่ในขนาดใหญ่พิเศษ พร้อมขยายตัวอักษรและข้อมูลบอกค่าคะแนนให้อ่านง่ายขึ้น
 */
export function zoomChart(canvasId) {
    const originalChart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
    if (!originalChart) return;
    
    // ดึงหัวข้อของกราฟจากกลุ่มการ์ดครอบ
    const card = document.getElementById(canvasId).closest('.glass-card');
    const title = card ? (card.querySelector('h3')?.textContent || 'ขยายการแสดงผลกราฟ') : 'ขยายการแสดงผลกราฟ';
    
    const summaryHtml = generateChartSummaryHtml(originalChart, title);
    
    const modalContentHtml = `
        <div class="h-[52vh] min-h-[340px] w-full bg-white rounded-2xl p-4">
            <canvas id="zoomChartCanvas"></canvas>
        </div>
        <div class="mt-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100 shadow-sm animate-fade-in-up leading-relaxed">
            ${summaryHtml}
        </div>
    `;
    
    let zoomChartInstance = null;
    
    const onClose = () => {
        if (zoomChartInstance) {
            zoomChartInstance.destroy();
        }
    };
    
    showSharedGlassModal(title, 'แสดงผลกราฟขนาดใหญ่พร้อมสรุปข้อมูลสถิติ', modalContentHtml, 'xl', onClose);
    
    const zoomCtx = document.getElementById('zoomChartCanvas');
    if (!zoomCtx) return;
    
    // คัดลอกและขยายขนาดออปชันต่างๆ ของกราฟเดิม
    const origOptions = originalChart.config.options || {};
    const newOptions = JSON.parse(JSON.stringify(origOptions));
    
    // ขยายฟอนต์แกน X และ Y
    if (newOptions.scales) {
        if (newOptions.scales.x) {
            newOptions.scales.x.ticks = newOptions.scales.x.ticks || {};
            newOptions.scales.x.ticks.font = { size: 14, weight: 'bold' };
        }
        if (newOptions.scales.y) {
            newOptions.scales.y.ticks = newOptions.scales.y.ticks || {};
            newOptions.scales.y.ticks.font = { size: 14, weight: 'bold' };
            if (originalChart.config.options.scales?.y?.ticks?.callback) {
                newOptions.scales.y.ticks.callback = originalChart.config.options.scales.y.ticks.callback;
            }
        }
    }
    
    // ขยายฟอนต์ Legend และ Tooltip
    if (newOptions.plugins) {
        if (newOptions.plugins.legend) {
            newOptions.plugins.legend.labels = newOptions.plugins.legend.labels || {};
            newOptions.plugins.legend.labels.font = { size: 13, weight: 'bold' };
            newOptions.plugins.legend.labels.boxWidth = 16;
        }
        if (newOptions.plugins.tooltip) {
            newOptions.plugins.tooltip.titleFont = { size: 14, weight: 'bold' };
            newOptions.plugins.tooltip.bodyFont = { size: 13 };
            if (originalChart.config.options.plugins?.tooltip?.callbacks) {
                newOptions.plugins.tooltip.callbacks = originalChart.config.options.plugins.tooltip.callbacks;
            }
        }
        newOptions.plugins.valueLabels = newOptions.plugins.valueLabels || {};
        newOptions.plugins.valueLabels.fontSize = 13;
    }
    
    newOptions.responsive = true;
    newOptions.maintainAspectRatio = false;
    
    const zoomValueLabelsPlugin = {
        id: 'zoomValueLabels',
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
                    
                    ctx.font = 'bold 12px sans-serif'; // ตัวอักษรแสดงค่าคะแนนขนาดใหญ่ขึ้น
                    ctx.textAlign = 'center';
                    
                    if (chart.config.type === 'bar') {
                        if (chart.config.options.indexAxis === 'y') {
                            ctx.textAlign = 'left';
                            ctx.fillStyle = '#1E293B';
                            ctx.strokeStyle = '#FFFFFF';
                            ctx.lineWidth = 3;
                            ctx.strokeText(text, x + 6, y + 4);
                            ctx.fillText(text, x + 6, y + 4);
                            return;
                        }
                        if (chart.config.options.scales?.y?.stacked || chart.config.options.scales?.x?.stacked) {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                            ctx.lineWidth = 2.5;
                            ctx.strokeText(text, x, y + 5);
                            ctx.fillText(text, x, y + 5);
                            return;
                        }
                        ctx.fillStyle = '#1E293B';
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.lineWidth = 3;
                        ctx.strokeText(text, x, y - 8);
                        ctx.fillText(text, x, y - 8);
                        return;
                    }
                    if (chart.config.type === 'line') {
                        ctx.fillStyle = dataset.borderColor || '#1E293B';
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.lineWidth = 3;
                        ctx.strokeText(text, x, y - 10);
                        ctx.fillText(text, x, y - 10);
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
                        ctx.lineWidth = 3;
                        ctx.strokeText(text, x, y + 4);
                        ctx.fillText(text, x, y + 4);
                        return;
                    }
                });
            });
            ctx.restore();
        }
    };
    
    zoomChartInstance = new Chart(zoomCtx, {
        type: originalChart.config.type,
        data: originalChart.config.data,
        options: newOptions,
        plugins: [zoomValueLabelsPlugin]
    });
}


// 👑 ฟังก์ชันศูนย์กลางสำหรับสร้างแถบหัวข้อหลัก (เพิ่มระบบประทับเวลาอัปเดตข้อมูล)
export function getSharedHeaderHtml(roleTitle, dotColorClass = 'bg-blue-500', showBackButton = false, backUrl = 'index.html', updateTime = '') {
    
    // เปิด-ปิดปุ่มกลับ
    const buttonHtml = showBackButton 
        ? `<button onclick="window.location.href='${backUrl}'" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors border rounded-xl shrink-0">กลับหน้าหลัก</button>`
        : ''; 

    // 🌟 ประทับเวลา
    const timeHtml = updateTime 
        ? `<div class="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium justify-start sm:justify-end bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
            อัปเดตล่าสุด: <span class="text-slate-700 font-bold">${updateTime}</span>
           </div>` 
        : '';

    return `
        <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white px-6 py-5 sm:px-8 sm:py-6 rounded-3xl shadow-sm border border-slate-200/60 animate-fade-in-up gap-6">
            
            <div class="flex items-center gap-5 sm:gap-6">
                <img src="/assets/pngptt.png" alt="Corporate Logo" class="h-16 sm:h-20 w-auto object-contain hover:scale-105 transition-transform duration-200">

                <div class="hidden sm:block w-[1.5px] h-10 bg-slate-200"></div>
                
                <div class="w-full sm:w-auto">
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3 flex-wrap">
                        <span class="w-3 h-3 rounded-full ${dotColorClass} animate-pulse shrink-0 shadow-sm"></span> 
                        ${roleTitle}
                    </h1>
                </div>
            </div>

            <div class="flex flex-col sm:items-end gap-2.5 w-full sm:w-auto shrink-0">
                ${timeHtml}
                ${buttonHtml}
            </div>

        </header>
    `;
}

// 🚨 ฟังก์ชันศูนย์กลางสำหรับสร้างกล่องเตือนภัย (Red Flags Accordion)
export function getSharedRedFlagsHtml(flags) {
    // ถ้าไม่มีความเสี่ยง ให้ส่งค่าว่างกลับไป (ไม่แสดงอะไรเลย)
    if (!flags || flags.length === 0) return '';

    let html = `
        <details class="group bg-gradient-to-r from-rose-500 to-rose-600 rounded-3xl p-5 shadow-lg shadow-rose-200/50 text-white mb-6 cursor-pointer hover:shadow-xl transition-all duration-300 border border-rose-400/50">
            <summary class="text-base sm:text-lg font-black flex items-center justify-between outline-none list-none [&::-webkit-details-marker]:hidden">
                <div class="flex items-center gap-3">
                    <span class="text-2xl animate-bounce">🚨</span> 
                    <span>DATA REALITY CHECK WARNING</span>
                    <span class="text-[11px] font-bold bg-white/20 text-white px-2.5 py-1 rounded-full border border-white/30 shadow-sm leading-none">
                        พบ ${flags.length} ความเสี่ยง
                    </span>
                </div>
                <div class="p-1.5 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </summary>
            
            <div class="mt-5 space-y-3 cursor-auto border-t border-rose-400/50 pt-4 animate-fade-in-up">`;
    
    flags.forEach(f => { 
        html += `
            <div class="p-4 rounded-xl border border-white/20 bg-white/10 shadow-sm hover:bg-white/20 transition-colors">
                <strong class="block text-rose-50 mb-1">${f.title}</strong>
                <span class="text-sm opacity-90 text-white leading-relaxed">${f.detail}</span>
            </div>`; 
    });
    
    return html + `</div></details>`;
}

// 🔔 ระบบแจ้งเตือนแบบกระจกสลวยลอยตัว (Glassmorphic Toast Notifications)
export function showSharedGlassToast(message, type = 'success', duration = 3500) {
    let toastContainer = document.getElementById('global-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'global-toast-container';
        toastContainer.className = 'fixed top-6 right-6 z-[200000] flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto w-full glass-card p-4 rounded-2xl border shadow-xl flex items-center gap-3.5 toast-enter';
    
    let icon = '🔔';
    let borderColor = 'rgba(255, 255, 255, 0.65)';
    let bg = 'linear-gradient(135deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.22) 100%)';
    let textColor = 'text-slate-800';

    if (type === 'success') {
        icon = '✨';
        borderColor = 'rgba(16, 185, 129, 0.4)';
        bg = 'linear-gradient(135deg, rgba(209, 250, 229, 0.7) 0%, rgba(240, 253, 244, 0.4) 100%)';
        textColor = 'text-emerald-800';
    } else if (type === 'error') {
        icon = '❌';
        borderColor = 'rgba(239, 68, 68, 0.4)';
        bg = 'linear-gradient(135deg, rgba(254, 226, 226, 0.7) 0%, rgba(254, 242, 242, 0.4) 100%)';
        textColor = 'text-rose-800';
    } else if (type === 'warning' || type === 'info') {
        icon = '⚠️';
        borderColor = 'rgba(245, 158, 11, 0.4)';
        bg = 'linear-gradient(135deg, rgba(254, 243, 199, 0.7) 0%, rgba(255, 251, 235, 0.4) 100%)';
        textColor = 'text-amber-800';
    }

    toast.style.background = bg;
    toast.style.borderColor = borderColor;

    toast.innerHTML = `
        <span class="text-xl shrink-0">${icon}</span>
        <div class="flex-1 text-[13px] font-bold ${textColor} leading-normal">${message}</div>
        <button class="toast-close-btn p-1 hover:bg-black/5 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    `;

    toastContainer.appendChild(toast);

    const closeToast = () => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.toast-close-btn').addEventListener('click', closeToast);

    // ตั้งเวลาปิดอัตโนมัติ
    setTimeout(closeToast, duration);
}

// ❔ กล่องยืนยันการทำรายการแบบกระจกใสทำงานบนระดับ Promise (Glassmorphic Confirm Dialog)
export function showSharedGlassConfirm(title, message) {
    return new Promise((resolve) => {
        const confirmHtml = `
            <div id="global-confirm-overlay" class="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[250000] flex items-center justify-center p-4 transition-all duration-300 opacity-0">
                <div class="glass-card max-w-sm w-full p-6 rounded-3xl shadow-2xl border border-white/60 transform scale-95 transition-all duration-300 animate-modal-scale-in">
                    <div class="text-center mb-5">
                        <div class="w-12 h-12 bg-blue-50 text-[#00508F] border border-blue-100/50 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3">❓</div>
                        <h4 class="text-base font-bold text-slate-800 leading-snug">${title}</h4>
                        <p class="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">${message}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="global-confirm-cancel-btn" class="py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 font-bold text-[12px] transition-all rounded-xl border border-slate-200/50 hover:-translate-y-0.5 active:translate-y-0">ยกเลิก</button>
                        <button id="global-confirm-ok-btn" class="py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[12px] transition-all rounded-xl shadow-md hover:-translate-y-0.5 active:translate-y-0">ตกลง</button>
                    </div>
                </div>
            </div>`;

        const oldOverlay = document.getElementById('global-confirm-overlay');
        if (oldOverlay) oldOverlay.remove();

        document.body.insertAdjacentHTML('beforeend', confirmHtml);
        const overlay = document.getElementById('global-confirm-overlay');
        const card = overlay.querySelector('.glass-card');

        setTimeout(() => {
            overlay.classList.remove('opacity-0');
        }, 15);

        const handleAction = (val) => {
            overlay.classList.add('opacity-0');
            card.classList.remove('animate-modal-scale-in');
            card.style.transform = 'scale(0.95) translateY(10px)';
            card.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                resolve(val);
            }, 300);
        };

        document.getElementById('global-confirm-ok-btn').addEventListener('click', () => handleAction(true));
        document.getElementById('global-confirm-cancel-btn').addEventListener('click', () => handleAction(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) handleAction(false); });
    });
}

/**
 * 🚀 ฟังก์ชันเริ่มใช้งาน Sidebar นำทางอัจฉริยะ (Shared Navigation Sidebar)
 * จัดกลุ่มนำทางและแยกสิทธิ์ของแต่ละหน้า Executive, Auditor, Owner, Admin
 */
export async function initSidebar(currentRole, activeOwnerKey = '') {
    if (document.getElementById('sidebar-container')) return;

    const sidebar = document.createElement('aside');
    sidebar.id = 'sidebar-container';
    sidebar.className = 'sidebar-glass text-white shrink-0 flex flex-col justify-between h-screen fixed lg:sticky top-0 z-[9999]';

    const getActiveCls = (role) => currentRole.toLowerCase() === role.toLowerCase() 
        ? 'bg-blue-600/35 border-l-4 border-blue-500 font-extrabold text-blue-200' 
        : 'hover:bg-white/5 text-slate-300 font-medium';

    let ownersHtml = '<div class="pl-4 text-xs text-slate-500">กำลังโหลด...</div>';
    try {
        const res = await fetch('/api/owners');
        if (res.ok) {
            const result = await res.json();
            const owners = result.data || [];
            ownersHtml = owners.map(o => {
                const isActive = (currentRole.toLowerCase() === 'owner' && activeOwnerKey === o.id);
                const itemCls = isActive 
                    ? 'text-blue-300 font-extrabold bg-blue-600/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5';
                return `
                    <a href="owner.html?owner=${encodeURIComponent(o.id)}" class="flex items-center gap-2 px-4 py-2 text-xs rounded-xl transition-all ${itemCls}">
                        <span class="text-[9px]">👤</span>
                        <span class="truncate">${o.nameThai || o.id}</span>
                    </a>
                `;
            }).join('');
        }
    } catch (e) {
        console.warn("Failed to load owners in sidebar", e);
        ownersHtml = '<div class="pl-4 text-xs text-rose-400">โหลดข้อมูลไม่สำเร็จ</div>';
    }

    sidebar.innerHTML = `
        <div class="sidebar-inner flex flex-col justify-between h-full w-64 overflow-y-auto">
            <div class="p-6">
                <div class="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
                    <span class="text-2xl animate-pulse">🚀</span>
                    <div>
                        <h3 class="text-sm font-black tracking-wider text-slate-100 uppercase">PTT OFI SYSTEM</h3>
                        <p class="text-[9px] text-slate-400 font-extrabold tracking-widest mt-0.5">ULTIMATE INTEGRATION</p>
                    </div>
                </div>

                <nav class="space-y-2">
                    <a href="executive.html" class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${getActiveCls('executive')}">
                        <span class="text-lg">👑</span>
                        <span class="text-xs">ผู้บริหาร (Executive View)</span>
                    </a>

                    <a href="auditor.html" class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${getActiveCls('auditor')}">
                        <span class="text-lg">🔍</span>
                        <span class="text-xs">ผู้ตรวจสอบ (Auditor View)</span>
                    </a>

                    <div class="space-y-1">
                        <button id="sidebar-owner-btn" class="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all hover:bg-white/5 text-slate-300 font-medium ${currentRole.toLowerCase() === 'owner' ? 'bg-white/5' : ''}">
                            <span class="flex items-center gap-3">
                                <span class="text-lg">⚙️</span>
                                <span class="text-xs">เจ้าของงาน (Process Owner)</span>
                            </span>
                            <span class="text-[10px] transition-transform duration-200 ${currentRole.toLowerCase() === 'owner' ? 'rotate-180' : ''}" id="sidebar-owner-arrow">▼</span>
                        </button>
                        <div id="sidebar-owner-list" class="pl-4 space-y-1 mt-1 transition-all ${currentRole.toLowerCase() === 'owner' ? '' : 'hidden'}">
                            ${ownersHtml}
                        </div>
                    </div>

                    <a href="admin.html" class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${getActiveCls('admin')}">
                        <span class="text-lg">🛡️</span>
                        <span class="text-xs">ผู้ดูแลระบบ (Admin Panel)</span>
                    </a>
                </nav>
            </div>

            <div class="p-6 border-t border-white/10">
                <a href="index.html" class="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700/80 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all shadow-md">
                    <span>🚪</span> กลับหน้าหลัก (Portal)
                </a>
            </div>
        </div>

        <button id="sidebar-toggle-handle" class="absolute z-[10000] p-2.5 rounded-xl border transition-all duration-300 active:scale-95 flex items-center justify-center" title="ซ่อน/แสดง Sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 icon-hamburger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 icon-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
    `;

    // 🛠️ แก้ไขที่ 1: ค้นหา mainContainer ที่แท้จริง โดยข้ามกล่อง Background Liquid
    const allDivs = document.querySelectorAll('body > div');
    let mainContainer = Array.from(allDivs).find(el => !el.classList.contains('pointer-events-none') && !el.classList.contains('fixed'));
    
    // สำรองในกรณีหาไม่เจอ ให้ดึงตัวสุดท้ายมาใช้
    if (!mainContainer && allDivs.length > 0) {
        mainContainer = allDivs[allDivs.length - 1];
    }

    if (mainContainer) {
        const body = document.body;
        body.className = 'text-slate-800 bg-[#f1f5f9] flex min-h-screen';

        // Load side state (collapse/expand)
        const isMobile = window.innerWidth < 1024;
        const localCollapsed = localStorage.getItem('sidebar-collapsed');
        const shouldCollapse = localCollapsed !== null 
            ? localCollapsed === 'true' 
            : isMobile;

        if (shouldCollapse) {
            body.classList.add('sidebar-collapsed');
        } else {
            body.classList.remove('sidebar-collapsed');
        }

        if (!document.getElementById('sidebar-styles')) {
            const style = document.createElement('style');
            style.id = 'sidebar-styles';
            style.textContent = `
                .sidebar-glass {
                    background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-right: 1px solid rgba(255, 255, 255, 0.08);
                }
                #sidebar-container {
                    width: 16rem;
                    height: 100vh;
                    position: fixed;
                    top: 0;
                    left: 0;
                    z-index: 9999;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    overflow: visible;
                }
                .sidebar-collapsed #sidebar-container {
                    width: 0px !important;
                    min-width: 0px !important;
                    border-right: none !important;
                }
                #sidebar-container .sidebar-inner {
                    width: 16rem;
                    height: 100%;
                    transition: opacity 0.2s ease-in-out;
                }
                .sidebar-collapsed #sidebar-container .sidebar-inner {
                    position: absolute;
                    opacity: 0;
                    pointer-events: none;
                }
                #sidebar-toggle-handle {
                    position: absolute;
                    top: 1.25rem;
                    right: 1rem;
                    background-color: rgba(30, 41, 59, 0.8);
                    border-color: rgba(255, 255, 255, 0.1);
                    color: #cbd5e1;
                    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s, border-color 0.3s, color 0.3s;
                }
                #sidebar-toggle-handle:hover {
                    background-color: rgba(51, 65, 85, 0.9);
                    color: #ffffff;
                }
                #sidebar-toggle-handle .icon-hamburger {
                    display: none;
                }
                #sidebar-toggle-handle .icon-arrow {
                    display: block;
                }

                .sidebar-collapsed #sidebar-toggle-handle {
                    right: auto !important;
                    left: 100% !important;
                    margin-left: 12px !important;
                    background-color: #ffffff !important;
                    border-color: #e2e8f0 !important;
                    color: #475569 !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .sidebar-collapsed #sidebar-toggle-handle:hover {
                    background-color: #f8fafc !important;
                    color: #0f172a !important;
                }
                .sidebar-collapsed #sidebar-toggle-handle .icon-hamburger {
                    display: block;
                }
                .sidebar-collapsed #sidebar-toggle-handle .icon-arrow {
                    display: none;
                }
            `;
            document.head.appendChild(style);
        }

        // แทรก Sidebar เข้าไปใน Container จริง
        mainContainer.prepend(sidebar);
        
        // 🛠️ แก้ไขที่ 2: ล้างคลาส % ออก บังคับให้พื้นที่ทำงานเต็มจอตลอดเวลา
        mainContainer.className = 'w-full min-h-screen py-4 md:py-6 relative flex flex-col';

        // 🛠️ แก้ไขที่ 3: ห่อเนื้อหาในกล่องขนาด 1344px เท่า Grid เป๊ะๆ
        let wrapper = mainContainer.querySelector('.main-grid-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'main-grid-wrapper w-full mx-auto px-4 xl:px-0 space-y-6';
            wrapper.style.maxWidth = '1344px'; // ใช้ style กัน Tailwind Purge
            
            const childNodes = Array.from(mainContainer.childNodes);
            childNodes.forEach(child => {
                if (child !== sidebar && child !== wrapper) {
                    wrapper.appendChild(child);
                }
            });
            mainContainer.appendChild(wrapper);
        } else {
            wrapper.className = 'main-grid-wrapper w-full mx-auto px-4 xl:px-0 space-y-6';
            wrapper.style.maxWidth = '1344px';
        }

        const ownerBtn = sidebar.querySelector('#sidebar-owner-btn');
        const ownerList = sidebar.querySelector('#sidebar-owner-list');
        const ownerArrow = sidebar.querySelector('#sidebar-owner-arrow');
        if (ownerBtn && ownerList && ownerArrow) {
            ownerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                ownerList.classList.toggle('hidden');
                ownerArrow.classList.toggle('rotate-180');
            });
        }

        const toggleBtn = sidebar.querySelector('#sidebar-toggle-handle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                body.classList.toggle('sidebar-collapsed');
                localStorage.setItem('sidebar-collapsed', body.classList.contains('sidebar-collapsed'));
            });
        }

        document.addEventListener('click', (e) => {
            if (window.innerWidth < 1024) {
                if (!sidebar.contains(e.target) && !e.target.closest('#sidebar-toggle-handle')) {
                    body.classList.add('sidebar-collapsed');
                }
            }
        });

        // 📐 สร้าง Grid สีแดงสำหรับตรวจสอบการจัดวางหน้าจอ (UX/UI Red Grid Overlay Helper)
        if (!document.getElementById('ux-grid-overlay')) {
            const gridOverlay = document.createElement('div');
            gridOverlay.id = 'ux-grid-overlay';
            
            gridOverlay.className = 'pointer-events-none absolute inset-0 z-[50] hidden w-full overflow-hidden flex justify-center';
            gridOverlay.innerHTML = `
                <div class="h-full w-full grid grid-cols-12 gap-6 px-4 xl:px-0" style="max-width: 1344px;">
                    ${Array(12).fill('<div class="h-full bg-[#FF0000]/10 border-x border-[#FF0000]/20"></div>').join('')}
                </div>
            `;
            
            mainContainer.appendChild(gridOverlay);

            const toggleGridBtn = document.createElement('button');
            toggleGridBtn.id = 'toggle-grid-btn';
            toggleGridBtn.className = 'fixed bottom-4 right-4 z-[999999] w-10 h-10 bg-slate-800/90 hover:bg-red-600 text-white hover:text-white rounded-full shadow-lg backdrop-blur-md border border-white/10 transition-all duration-300 active:scale-95 flex items-center justify-center font-bold text-xs';
            toggleGridBtn.title = 'แสดง/ซ่อน Grid สีแดง (UX/UI Layout Helper)';
            toggleGridBtn.innerHTML = '📐';
            document.body.appendChild(toggleGridBtn);

            toggleGridBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = gridOverlay.classList.toggle('hidden');
                if (!isHidden) {
                    toggleGridBtn.classList.add('bg-red-600');
                    toggleGridBtn.classList.remove('bg-slate-800/90');
                } else {
                    toggleGridBtn.classList.remove('bg-red-600');
                    toggleGridBtn.classList.add('bg-slate-800/90');
                }
            });
        }
    }
}