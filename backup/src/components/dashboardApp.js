// src/components/dashboardApp.js
export class DashboardApp {
    constructor(dataService) {
        this.data = dataService;
        this.contentDiv = document.getElementById('app-content');
        this.activeCharts = [];
    }

    renderView(role) {
        this.activeCharts.forEach(chart => chart.destroy());
        this.activeCharts = [];
        this.contentDiv.innerHTML = '';
        const badge = document.getElementById('current-role-badge');
        
        if (role === 'executive') {
            badge.innerText = 'Executive View';
            badge.className = 'px-3 py-1 bg-blue-100 text-primary text-xs font-bold rounded-lg uppercase tracking-wider';
            this.renderExecutiveView();
        } else if (role.startsWith('owner')) {
            badge.innerText = 'Element Owner View';
            badge.className = 'px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg uppercase tracking-wider';
            this.renderOwnerView();
        } else {
            badge.innerText = 'Auditor / PMO';
            badge.className = 'px-3 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-lg uppercase tracking-wider';
            this.renderAuditorView();
        }
    }
}