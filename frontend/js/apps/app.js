import { OFIDataService } from '../services/dataService.js';
import { renderExecutiveView } from '../views/executive.js';
import { renderAuditorView } from '../views/auditor.js';
import { zoomChart } from '../utils/uiHelpers.js';
import '../../css/input.css';

class DashboardApp {
    constructor() {
        this.API_BASE_URL = window.location.origin;
        this.charts = [];
        this.contentDiv = document.getElementById('app-content');
        this.flagsDiv = document.getElementById('red-flags-container');
        this.setupHooks();
        
        // --- ระบบ Click เพื่อขยายขนาดกราฟ (Accessibility Zoom) ---
        this.contentDiv.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-expand-chart');
            if (btn) {
                e.stopPropagation();
                const chartId = btn.getAttribute('data-chart-id');
                if (chartId === 'chart-issue-tags') {
                    zoomChart('tagChart');
                }
            }
        });
    }

    clear() {
        this.charts.forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
        this.charts = [];
        this.contentDiv.innerHTML = '';
        this.flagsDiv.innerHTML = '';
    }

    async fetchDashboardData(token) {
        this.clear();
        try {
            // โหลดข้อมูลแดชบอร์ดและสิทธิ์การแสดงผลกราฟแบบคู่ขนาน
            const [dataRes, settingsRes] = await Promise.all([
                fetch(`${this.API_BASE_URL}/api/dashboard-data?t=${Date.now()}`, { headers: { 'Authorization': token } }),
                fetch(`${this.API_BASE_URL}/api/chart-settings?t=${Date.now()}`)
            ]);

            if (!dataRes.ok) throw new Error("Auth Failed");
            const result = await dataRes.json();
            const chartSettings = settingsRes.ok ? await settingsRes.json() : {};
            
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-dashboard').classList.remove('hidden');
            document.getElementById('display-role').innerText = result.role;
            
            let ownerId = token.includes('owner:') ? token.split('owner:')[1] : null;

            this.data = new OFIDataService(result.data);
            
            // 🚨 วาดการ์ดรายงานภัยข้อมูลล้มเหลว (Reality Check Warnings) ก่อนเสมอ
            const flags = this.data.detectRedFlags(this.API_BASE_URL);
            if (flags.length > 0) {
                let html = `<div class="bg-rose-500 rounded-3xl p-6 shadow-lg shadow-rose-200 text-white mb-6">
                    <h3 class="text-lg font-black flex items-center gap-2">🚨 DATA REALITY CHECK WARNING</h3><div class="mt-4 space-y-3">`;
                flags.forEach(f => {
                    html += `<div class="p-4 rounded-xl border border-white/20 bg-white/5"><strong class="block text-rose-100">${f.title}</strong><span class="text-sm opacity-90">${f.detail}</span></div>`;
                });
                this.flagsDiv.innerHTML = html + `</div></div>`;
            }

            // เลือกรันโมดูลมุมมองแยกตามสิทธิ์สอดคล้องสถาปัตยกรรมพร้อมกับส่งสิทธิ์แสดงกราฟเข้าไปด้วย
            if (result.role === 'executive') renderExecutiveView(this, chartSettings);
            else if (result.role === 'auditor') renderAuditorView(this, chartSettings);
            else if (result.role === 'owner') this.renderOwnerView(ownerId, chartSettings);

        } catch (error) { 
            console.error("🔴 บั๊กเครือข่ายขัดข้อง:", error);
            alert("เกิดข้อผิดพลาดในการโหลดข้อมูล!");
        }
    }

    getKpiHtml() {
        const kpis = this.data.getKPIs();
        return `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm"><p class="text-xs text-slate-400 font-bold uppercase">1.1 OFI ทั้งหมด</p><p class="text-4xl font-black text-slate-800 mt-2">${kpis.total}</p></div>
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm"><p class="text-xs text-slate-400 font-bold uppercase">1.2 อัตราปิดงานสำเร็จ</p><p class="text-4xl font-black text-emerald-500 mt-2">${kpis.successRate}%</p></div>
                <div class="glass-card p-5 rounded-2xl border border-rose-200 bg-rose-50/50 shadow-sm"><p class="text-xs text-rose-400 font-bold uppercase">1.3 งานค้างวิกฤต (Delayed)</p><p class="text-4xl font-black text-rose-600 mt-2">${kpis.delayed}</p></div>
            </div>`;
    }

    renderOwnerView(ownerId, chartSettings = {}) {
        const myTasks = this.data.ofis.filter(o => o.elementOwnerId === ownerId);
        const phaseKeys = ['phase-plan', 'phase-eo-ec', 'phase-assessment', 'phase-document', 'phase-site-visit'];
        const statusColors = { 'Done': 'bg-emerald-500', 'Qualified': 'bg-emerald-600', 'In progress': 'bg-amber-400', 'Delayed': 'bg-rose-500', 'Not started': 'bg-slate-200' };
        
        const canShow = (chartId) => {
            if (!chartSettings || !chartSettings[chartId]) return true;
            const roles = chartSettings[chartId].roles;
            if (!Array.isArray(roles)) return true;
            return roles.includes('owner');
        };
        
        let ganttRows = myTasks.map(o => {
            let blocks = phaseKeys.map(pk => `<div class="h-6 w-full rounded-sm ${statusColors[o.phases?.[pk]?.status || 'Not started'] || 'bg-slate-200'} border border-white/50" title="${o.phases?.[pk]?.status || 'Not started'}"></div>`).join('');
            return `<div class="grid grid-cols-6 gap-2 items-center text-sm py-2 border-b border-slate-100"><div class="font-bold text-slate-700 truncate">${o.id}</div>${blocks}</div>`;
        }).join('');

        this.contentDiv.innerHTML = this.getKpiHtml();
        
        let gridHtml = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">`;
        let hasGridContent = false;
        
        if (canShow("chart-gantt-grid")) {
            hasGridContent = true;
            gridHtml += `
                <div class="glass-card p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <h3 class="font-bold text-slate-800 mb-4">${chartSettings["chart-gantt-grid"]?.title || '4.1 ตารางติดตามสถานะเฟสงาน (Gantt-Grid)'}</h3>
                    <div class="grid grid-cols-6 gap-2 text-[10px] font-bold text-slate-400 uppercase text-center mb-2"><div class="text-left">Task ID</div><div>Plan</div><div>EO/EC</div><div>Assess</div><div>Doc</div><div>Site</div></div>
                    <div class="max-h-64 overflow-y-auto">${ganttRows || '<div class="text-center py-10 text-slate-400">ไม่มีงานในความรับผิดชอบ</div>'}</div>
                </div>`;
        }
        
        if (canShow("chart-issue-tags")) {
            hasGridContent = true;
            gridHtml += `
                <div class="glass-card p-6 rounded-3xl border border-slate-200 shadow-sm relative">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-slate-800">${chartSettings["chart-issue-tags"]?.title || '4.2 ประเด็นปัญหาที่พบบ่อย (Issue Tags)'}</h3>
                        <button class="btn-expand-chart p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition" data-chart-id="chart-issue-tags" title="ขยายกราฟ (Zoom Chart)">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                        </button>
                    </div>
                    <div class="h-64"><canvas id="tagChart"></canvas></div>
                </div>`;
        }
        
        gridHtml += `</div>`;
        if (hasGridContent) {
            this.contentDiv.innerHTML += gridHtml;
        }

        if (canShow("chart-issue-tags") && document.getElementById('tagChart')) {
            let tagCounts = {}; myTasks.forEach(o => o.issueTags?.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
            let sortedTags = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]);
            this.charts.push(new Chart(document.getElementById('tagChart'), { type: 'bar', data: { labels: sortedTags.map(t=>t[0]), datasets: [{ data: sortedTags.map(t=>t[1]), backgroundColor: '#8b5cf6', borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }));
        }
    }

    setupHooks() {
        window.login = (role) => this.fetchDashboardData(`Bearer ${role}`);
        window.loginOwner = () => this.fetchDashboardData(`Bearer owner:${document.getElementById('owner-select').value}`);
        window.logout = () => location.reload();
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const app = new DashboardApp();
    try {
        const res = await fetch(`${app.API_BASE_URL}/api/owners`);
        const json = await res.json();
        document.getElementById('owner-select').innerHTML = json.data.map(o => `<option value="${o.id}">${o.nameThai}</option>`).join('');
        
        // 🔗 ระบบตรวจจับลิงก์แชร์สิทธิ์อัตโนมัติ (URL Deep Linking Parameters)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('role')) app.fetchDashboardData(`Bearer ${urlParams.get('role')}`);
        else if (urlParams.get('owner')) app.fetchDashboardData(`Bearer owner:${urlParams.get('owner')}`);
    } catch (e) { console.error("Initialization error:", e); }
});