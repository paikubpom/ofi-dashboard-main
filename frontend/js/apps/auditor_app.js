import { OFIDataService } from '../services/dataService.js';
import { renderAuditorView } from '../views/auditor.js'; 
import { getSharedHeaderHtml, getSharedRedFlagsHtml, initSidebar } from '../utils/uiHelpers.js';
import { initGlobalPdfExport } from '../utils/pdfHelper.js';
import '../../css/input.css';

class AuditorApp {
    constructor() {
        this.API_BASE_URL = window.location.origin;
        this.charts = [];
        this.contentDiv = document.getElementById('app-content');
        this.flagsDiv = document.getElementById('red-flags-container');
        this.init();
        initGlobalPdfExport('Auditor'); 
    }

    clear() {
        this.charts.forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
        this.charts = [];
        if (this.contentDiv) this.contentDiv.innerHTML = '';
        if (this.flagsDiv) this.flagsDiv.innerHTML = '';
    }

    getKpiHtml(kpisOverride) {
        if (!this.data) return '';
        const kpis = kpisOverride || this.data.getKPIs();
        return `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div>
                        <span class="text-xs text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">📋 รายการ OFI ทั้งหมด</span>
                        <p class="text-3xl font-black text-slate-800 mt-2">${kpis.total}</p>
                    </div>
                </div>
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div>
                        <span class="text-xs text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">⚡ อัตราการปิดรายงาน</span>
                        <p class="text-3xl font-black text-teal-600 mt-2">${kpis.successRate}%</p>
                    </div>
                </div>
                <div class="glass-card p-5 rounded-2xl border border-rose-200 bg-rose-50/50 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div>
                        <span class="text-xs text-rose-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">🚨 รายการที่ล่าช้า (DELAYED)</span>
                        <p class="text-3xl font-black text-rose-600 mt-2">${kpis.delayed}</p>
                    </div>
                </div>
            </div>`;
    }

    async init() {
        initSidebar('auditor');
        this.clear();
        try {
            const res = await fetch(`${this.API_BASE_URL}/api/dashboard-data?t=${Date.now()}`, { 
                headers: { 'Authorization': 'Bearer auditor' } 
            });
            if (!res.ok) throw new Error(`HTTP Error Status: ${res.status}`);
            const result = await res.json();
            this.data = new OFIDataService(result.data);
            
            // 🌟 [จุดเด่นระบบควบคุม]: เรียกดึงค่าสิทธิ์แผนผังกราฟจากหลังบ้าน
            const settingsRes = await fetch(`${this.API_BASE_URL}/api/chart-settings?t=${Date.now()}`);
            const chartSettings = settingsRes.ok ? await settingsRes.json() : {};

            const syncTimeStr = result.last_sync 
                ? new Date(result.last_sync * 1000).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) + ' น.'
                : 'ยังไม่ได้ซิงก์ข้อมูล';

            const headerEl = document.getElementById('global-header');
            if (headerEl) {
                headerEl.innerHTML = getSharedHeaderHtml('🔍 CBE Driver บอล.', 'bg-teal-600', false, '', syncTimeStr);
            }
            
            const flags = this.data.detectRedFlags(this.API_BASE_URL);
            if (this.flagsDiv) this.flagsDiv.innerHTML = getSharedRedFlagsHtml(flags);

            // 🚀 ส่งต่อการตั้งค่าเข้าสู่จุดเรนเดอร์หน้าจอหลัก
            if (this.contentDiv) {
                renderAuditorView(this, chartSettings, 'auditor');
            }
        } catch (e) { 
            console.error("Auditor App Runtime Error:", e);
            if (this.contentDiv) {
                this.contentDiv.innerHTML = `<div class="p-6 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200">❌ เกิดข้อผิดพลาด: ${e.message}</div>`;
            }
        }
    }
}

new AuditorApp();