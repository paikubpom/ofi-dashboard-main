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
                        <p class="text-[11px] text-slate-400 mt-0.5">${subtitle}</p>
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
 * 🔎 ฟังก์ชันขยายขนาดกราฟสำหรับผู้สูงอายุ (Chart Accessibility Zoom Modal)
 * ทำการดึงโครงสร้างกราฟเดิมมาเรนเดอร์ใหม่ในขนาดใหญ่พิเศษ พร้อมขยายตัวอักษรและข้อมูลบอกค่าคะแนนให้อ่านง่ายขึ้น
 */
export function zoomChart(canvasId) {
    const originalChart = typeof Chart !== 'undefined' ? Chart.getChart(canvasId) : null;
    if (!originalChart) return;
    
    // ดึงหัวข้อของกราฟจากกลุ่มการ์ดครอบ
    const card = document.getElementById(canvasId).closest('.glass-card');
    const title = card ? (card.querySelector('h3')?.textContent || 'ขยายการแสดงผลกราฟ') : 'ขยายการแสดงผลกราฟ';
    
    const modalContentHtml = `
        <div class="h-[60vh] min-h-[400px] w-full bg-white rounded-2xl p-4">
            <canvas id="zoomChartCanvas"></canvas>
        </div>
        <div class="mt-4 flex justify-between items-center text-[13px] font-bold text-[#00508F] bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100/60 shadow-sm animate-fade-in-up">
            <span class="flex items-center gap-2">👵👴 <span><strong>โหมดช่วยการมองเห็นสำหรับผู้สูงอายุ:</strong> กราฟนี้ถูกขยายพร้อมขยายขนาดฟอนต์ของข้อความและค่าคะแนนเพื่อให้ท่านอ่านได้อย่างสะดวก</span></span>
        </div>
    `;
    
    let zoomChartInstance = null;
    
    const onClose = () => {
        if (zoomChartInstance) {
            zoomChartInstance.destroy();
        }
    };
    
    showSharedGlassModal(title, 'แสดงผลกราฟขนาดใหญ่พิเศษเพื่อผู้สูงอายุและการมองเห็นที่ชัดเจน', modalContentHtml, 'xl', onClose);
    
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