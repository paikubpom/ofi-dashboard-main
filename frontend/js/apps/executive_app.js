import { OFIDataService } from '../services/dataService.js';
import { renderExecutiveView } from '../views/executive.js';
import { getSharedHeaderHtml, getSharedRedFlagsHtml, initSidebar } from '../utils/uiHelpers.js';
import { initGlobalPdfExport } from '../utils/pdfHelper.js';
import '../../css/input.css';

class ExecutiveApp {
    constructor() {
        this.API_BASE_URL = window.location.origin;
        this.charts = [];
        this.contentDiv = document.getElementById('app-content');
        this.flagsDiv = document.getElementById('red-flags-container');
        this.init();
        initGlobalPdfExport('Executive');
    }

    clear() {
        this.charts.forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
        this.charts = [];
        if (this.contentDiv) this.contentDiv.innerHTML = '';
        if (this.flagsDiv) this.flagsDiv.innerHTML = '';
    }

    // 🌟 [จุดที่เพิ่มเข้ามา]: ฟังก์ชันปั้นกล่อง KPI 3 กล่องด้านบนที่หายไป!
    getKpiHtml() {
        if (!this.data) return '';
        const kpis = this.data.getKPIs();
        return `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm"><p class="text-xs text-slate-400 font-bold uppercase">1.1 OFI ทั้งหมด</p><p class="text-4xl font-black text-slate-800 mt-2">${kpis.total}</p></div>
                <div class="glass-card p-5 rounded-2xl border border-slate-200 shadow-sm"><p class="text-xs text-slate-400 font-bold uppercase">1.2 อัตราปิดงานสำเร็จ</p><p class="text-4xl font-black text-emerald-500 mt-2">${kpis.successRate}%</p></div>
                <div class="glass-card p-5 rounded-2xl border border-rose-200 bg-rose-50/50 shadow-sm"><p class="text-xs text-rose-400 font-bold uppercase">1.3 งานค้างวิกฤต (Delayed)</p><p class="text-4xl font-black text-rose-600 mt-2">${kpis.delayed}</p></div>
            </div>`;
    }

    async init() {
        initSidebar('executive');
        this.clear();
        try {
            // 1. ดึงชุดข้อมูลหลังบ้านจริง
            const res = await fetch(`${this.API_BASE_URL}/api/dashboard-data?t=${Date.now()}`, { headers: { 'Authorization': 'Bearer executive' } });
            if (!res.ok) throw new Error(`HTTP Error Status: ${res.status}`);
            const result = await res.json();
            this.data = new OFIDataService(result.data);
            
            // 🌟 2. ดึงแผนผังสิทธิ์เปิด-ปิดกราฟจากหน้าแอดมิน
            const settingsRes = await fetch(`${this.API_BASE_URL}/api/chart-settings?t=${Date.now()}`);
            const chartSettings = settingsRes.ok ? await settingsRes.json() : {};

            const syncTimeStr = result.last_sync 
                ? new Date(result.last_sync * 1000).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) + ' น.'
                : 'ยังไม่ได้ซิงก์ข้อมูล';

            const headerEl = document.getElementById('global-header');
            if (headerEl) {
                headerEl.innerHTML = getSharedHeaderHtml('👑 OFI Dashboard for EXECUTIVE', 'bg-blue-600', false, '', syncTimeStr);
            }
            
            if (this.flagsDiv) {
                const flags = this.data.detectRedFlags(this.API_BASE_URL);
                this.flagsDiv.innerHTML = getSharedRedFlagsHtml(flags);
            }

            // 🚀 [จุดสำคัญ]: ต้องส่ง chartSettings เข้าไปในฟังก์ชันตัวที่ 2 ด้วยบอส!
            if (this.contentDiv) {
                renderExecutiveView(this, chartSettings, 'executive');
            }
            
        } catch (e) { 
            console.error("Executive App Runtime Error:", e);
            if (this.contentDiv) {
                this.contentDiv.innerHTML = `<div class="p-6 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200">❌ เกิดข้อผิดพลาด: ${e.message}</div>`;
            }
        }
    }
}

new ExecutiveApp();