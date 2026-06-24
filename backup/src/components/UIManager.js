// src/components/UIManager.js

class UIManager {
    constructor(dataService) {
        this.dataService = dataService;
        this.charts = {};
        this.currentFilters = { phaseId: 'phase-plan', enablerCode: '', deptId: '', ofiLevel: '' };
    }

    init() {
        this.renderFilterOptions();
        this.renderStaticCharts();
        this.setupEventListeners();
        this.applyFilters();
    }

    renderFilterOptions() {
        // Render Dropdown เฟส
        const phaseSelect = document.getElementById('phaseFilter');
        this.dataService.getPhases().forEach((p, i) => {
            phaseSelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">Phase ${i+1}: ${p.nameThai.split(' (')[0]}</option>`);
        });

        // Render Dropdown หมวดประเมิน (Enabler)
        const enablerSelect = document.getElementById('enablerFilter');
        this.dataService.getEnablers().forEach(e => {
            enablerSelect.insertAdjacentHTML('beforeend', `<option value="${e.code}">${e.code} - ${e.nameThai}</option>`);
        });

        // Render Dropdown หน่วยงาน
        const deptSelect = document.getElementById('deptFilter');
        this.dataService.getDepartments().forEach(d => {
            deptSelect.insertAdjacentHTML('beforeend', `<option value="${d.id}">${d.shortNameThai} - ${d.fullNameThai}</option>`);
        });
    }

    setupEventListeners() {
        const bindFilter = (elementId, filterKey) => {
            document.getElementById(elementId).addEventListener('change', (e) => {
                this.currentFilters[filterKey] = e.target.value;
                this.applyFilters();
            });
        };

        bindFilter('phaseFilter', 'phaseId');
        bindFilter('enablerFilter', 'enablerCode');
        bindFilter('deptFilter', 'deptId');
        bindFilter('levelFilter', 'ofiLevel');
    }

    applyFilters() {
        const filteredData = this.dataService.filterOFI(this.currentFilters);
        const metrics = this.dataService.getMetricsSummary(filteredData, this.currentFilters.phaseId);
        
        this.renderKPICards(metrics);
        this.renderMatrixTable(filteredData);
        this.updateCharts(this.currentFilters.phaseId, this.currentFilters.enablerCode);
    }

    renderKPICards(metrics) {
        document.getElementById('kpiTotal').innerText = metrics.total;
        document.getElementById('kpiRate').innerText = `${metrics.completionRate}%`;
        document.getElementById('kpiProgress').innerText = metrics.stats['In progress'];
        document.getElementById('kpiQualified').innerText = metrics.stats['Qualified'];
    }

    renderMatrixTable(filteredOfis) {
        const matrix = this.dataService.getTypeVsLevelMatrix(filteredOfis);
        const tbody = document.getElementById('matrixTableBody');
        tbody.innerHTML = '';

        ['Process', 'Result'].forEach(type => {
            let rowHTML = `
                <tr class="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td class="px-4 py-3 font-medium text-gray-700">${type} Focus</td>
                    <td class="px-4 py-3 text-center ${matrix[type].L1 > 0 ? 'text-blue-600 font-bold bg-blue-50/30': 'text-gray-400'}">${matrix[type].L1}</td>
                    <td class="px-4 py-3 text-center ${matrix[type].L2 > 0 ? 'text-blue-600 font-bold bg-blue-50/30': 'text-gray-400'}">${matrix[type].L2}</td>
                    <td class="px-4 py-3 text-center ${matrix[type].L3 > 0 ? 'text-yellow-600 font-bold bg-yellow-50/30': 'text-gray-400'}">${matrix[type].L3}</td>
                    <td class="px-4 py-3 text-center ${matrix[type].L4 > 0 ? 'text-orange-600 font-bold bg-orange-50/30': 'text-gray-400'}">${matrix[type].L4}</td>
                    <td class="px-4 py-3 text-center ${matrix[type].L5 > 0 ? 'text-red-600 font-bold bg-red-50/30': 'text-gray-400'}">${matrix[type].L5}</td>
                </tr>`;
            tbody.insertAdjacentHTML('beforeend', rowHTML);
        });
    }

    renderStaticCharts() {
        // กราฟแท่งแสดงผลงานรายฝ่าย (Department Chart)
        this.charts.dept = new Chart(document.getElementById('deptChart').getContext('2d'), {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
        });

        // กราฟเส้นแสดงแนวโน้มคะแนนประเมินย้อนหลัง (SE-AM Historical Trend)
        this.charts.trend = new Chart(document.getElementById('trendChart').getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { min: 1, max: 5 } }
            }
        });
    }

    updateCharts(phaseId, enablerCode) {
        // อัปเดตกราฟหน่วยงาน
        const deptData = this.dataService.getDepartmentPerformance(phaseId);
        this.charts.dept.data = {
            labels: deptData.labels,
            datasets: [
                { label: 'ปิดแผนงานแล้ว', data: deptData.completedCounts, backgroundColor: '#10b981' },
                { label: 'อยู่ระหว่างดำเนินการ', data: deptData.pendingCounts, backgroundColor: '#f59e0b' }
            ]
        };
        this.charts.dept.update();

        // อัปเดตกราฟ Trend คะแนนประเมิน
        const trendData = this.dataService.getHistoricalScores(enablerCode);
        this.charts.trend.data = {
            labels: trendData.years.map(y => `ปี ${y}`),
            datasets: [{
                label: trendData.label || 'คะแนนอ้างอิงภาพรวมระบบ SE-AM',
                data: trendData.scores,
                borderColor: '#1a56db',
                backgroundColor: 'rgba(26, 86, 219, 0.05)',
                fill: true,
                tension: 0.2
            }]
        };
        this.charts.trend.update();
    }
}