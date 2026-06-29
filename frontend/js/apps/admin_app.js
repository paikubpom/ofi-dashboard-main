import { getSharedHeaderHtml, showSharedGlassToast, showSharedGlassConfirm, zoomChart, initSidebar } from '../utils/uiHelpers.js';
import '../../css/input.css';

class AdminApp {
    constructor() {
        // 1. กำหนดค่า State พื้นฐาน
        this.API_BASE_URL = window.location.origin;
        this.fileListData = []; 
        this.currentPage = 1;   
        this.itemsPerPage = 8; 
        this.chartSettings = {};
        this.rawRecords = [];
        this.referenceData = {};

        // 2. ผูก DOM Elements ไว้ในตัวแปรคลาส
        this.ui = {
            fileInput: document.getElementById('file-upload'),
            fileNameDisplay: document.getElementById('file-name-display'),
            uploadBtn: document.getElementById('upload-btn'),
            fileListBody: document.getElementById('file-list-body'),
            autoSyncToggle: document.getElementById('auto-sync-toggle'),
            manualSyncBtn: document.getElementById('manual-sync-btn'),
            lastSyncText: document.getElementById('last-sync-time'),
            paginationContainer: document.getElementById('pagination-controls'),
            selectAllCb: document.getElementById('select-all-files'),
            deleteSelectedBtn: document.getElementById('btn-delete-selected'),
            ownerPreviewSelect: document.getElementById('owner-preview-select'),
            chartSettingsGrid: document.getElementById('chart-settings-grid')
        };
    }

    // 🚀 ฟังก์ชันหลักสำหรับเริ่มทำงาน
    async init() {
        initSidebar('admin');
        console.log("Admin Dashboard Initialized.");
        this.renderGlobalHeader();
        this.setupEventListeners();
        
        // โหลดข้อมูลทั้งหมดแบบขนานเพื่อความรวดเร็ว
        await Promise.all([
            this.loadFileList(),         
            this.loadSettings(),
            this.refreshOwnerDropdownList(), 
            this.loadChartSettings()     
        ]);
    }

    renderGlobalHeader() {
        const headerDiv = document.getElementById('global-header');
        if (headerDiv) {
            const updateTimeStr = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) + ' น.';
            headerDiv.innerHTML = getSharedHeaderHtml('🛡️ OFI System Administration', 'bg-rose-500', false, '', updateTimeStr);
        }
    }

    // ==========================================
    // ส่วนของการจัดการ Event Listeners
    // ==========================================
    setupEventListeners() {
        // 1. ระบบเปลี่ยน Tab พร้อมแอนิเมชันเลื่อนเฟดนุ่มนวล
        const tabFiles = document.getElementById('tab-file-system');
        const tabCharts = document.getElementById('tab-chart-builder');
        const secFiles = document.getElementById('section-file-system');
        const secCharts = document.getElementById('section-chart-builder');

        // ตั้งค่า transition ให้ตู้คอนเทนเนอร์เปลี่ยนแผง
        secFiles.classList.add('transition-all', 'duration-300', 'transform');
        secCharts.classList.add('transition-all', 'duration-300', 'transform', 'opacity-0', 'translate-y-2');

        const activeBtnClasses = ['text-[#00508F]', 'bg-white', 'shadow-sm', 'font-bold'];
        const inactiveBtnClasses = ['text-slate-500', 'font-medium', 'hover:text-slate-700'];

        tabFiles?.addEventListener('click', () => {
            if (secFiles.classList.contains('hidden')) {
                secCharts.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => {
                    secCharts.classList.add('hidden');
                    secFiles.classList.remove('hidden');
                    // Reflow
                    secFiles.offsetHeight;
                    secFiles.classList.remove('opacity-0', 'translate-y-2');
                }, 200);

                tabFiles.classList.add(...activeBtnClasses);
                tabFiles.classList.remove(...inactiveBtnClasses);
                tabCharts.classList.add(...inactiveBtnClasses);
                tabCharts.classList.remove(...activeBtnClasses);
            }
        });

        tabCharts?.addEventListener('click', () => {
            if (secCharts.classList.contains('hidden')) {
                secFiles.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => {
                    secFiles.classList.add('hidden');
                    secCharts.classList.remove('hidden');
                    // Reflow
                    secCharts.offsetHeight;
                    secCharts.classList.remove('opacity-0', 'translate-y-2');
                }, 200);

                tabCharts.classList.add(...activeBtnClasses);
                tabCharts.classList.remove(...inactiveBtnClasses);
                tabFiles.classList.add(...inactiveBtnClasses);
                tabFiles.classList.remove(...activeBtnClasses);
            }
        });

        // 2. ระบบเปลี่ยนหน้า (Pagination)
        this.ui.paginationContainer?.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-page');
            if (btn && !btn.disabled) {
                this.currentPage = parseInt(btn.getAttribute('data-page'));
                this.renderFileList();
            }
        });

        // 3. เตรียมไฟล์อัปโหลด
        this.ui.fileInput?.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                const fileNames = Array.from(files).map(f => f.name).join(', ');
                this.ui.fileNameDisplay.innerHTML = `<span class="text-emerald-500 font-bold">เตรียมอัปโหลด (${files.length} ไฟล์):</span> ${fileNames}`;
                this.ui.uploadBtn.disabled = false;
            }
        });

        // 4. สั่งอัปโหลดไฟล์
        this.ui.uploadBtn?.addEventListener('click', async () => await this.handleFileUpload());

        // 5. ระบบตาราง: ลบไฟล์, เปิด/ปิดสถานะไฟล์ (Event Delegation)
        this.ui.fileListBody?.addEventListener('click', async (e) => {
            // กรณีลบไฟล์เดี่ยว
            if (e.target.classList.contains('btn-delete')) {
                const filename = e.target.getAttribute('data-name');
                if (await showSharedGlassConfirm('ยืนยันการลบไฟล์', `คุณยืนยันต้องการลบไฟล์ "${filename}" ออกจากคลังระบบใช่หรือไม่?`)) {
                    const safeName = encodeURIComponent(filename);
                    await fetch(`${this.API_BASE_URL}/api/files/${safeName}`, { method: 'DELETE' });
                    this.loadFileList();
                    showSharedGlassToast(`ลบไฟล์ "${filename}" เรียบร้อยแล้ว`, 'success');
                }
            }
        });

        this.ui.fileListBody?.addEventListener('change', async (e) => {
            const statusInput = e.target.closest('.toggle-file-status');
            // กรณีเปิด-ปิดสวิทช์สถานะไฟล์ (Active Toggle)
            if (e.target.classList.contains('toggle-file-status')) {
                const filename = e.target.getAttribute('data-name');
                await this.toggleFileStatus(filename);
            }
            
            // กรณีติ๊ก Checkbox แถวตาราง
            if (e.target.classList.contains('file-select-checkbox')) {
                const total = document.querySelectorAll('.file-select-checkbox');
                const checked = document.querySelectorAll('.file-select-checkbox:checked');
                if (this.ui.selectAllCb) this.ui.selectAllCb.checked = (total.length === checked.length);
                if (this.ui.deleteSelectedBtn) this.ui.deleteSelectedBtn.disabled = (checked.length === 0);
            }
        });

        // 6. ระบบ Checkbox (Select All / Bulk Delete)
        this.ui.selectAllCb?.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const rowCheckboxes = document.querySelectorAll('.file-select-checkbox');
            rowCheckboxes.forEach(cb => cb.checked = isChecked);
            if (this.ui.deleteSelectedBtn) this.ui.deleteSelectedBtn.disabled = !isChecked || rowCheckboxes.length === 0;
        });

        this.ui.deleteSelectedBtn?.addEventListener('click', async () => await this.handleBulkDelete());

        // 7. ระบบซิงก์ข้อมูล (Auto/Manual)
        this.ui.autoSyncToggle?.addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            await fetch(`${this.API_BASE_URL}/api/settings/auto-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_update: isChecked })
            });
            if (isChecked) this.performManualSync(); 
        });

        this.ui.manualSyncBtn?.addEventListener('click', () => this.performManualSync());

        // 8. พรีวิว Owner
        document.getElementById('btn-preview-owner')?.addEventListener('click', () => {
            const selectedOwner = this.ui.ownerPreviewSelect?.value;
            if (!selectedOwner) { 
                showSharedGlassToast('กรุณาเลือกรายชื่อพนักงานก่อนครับ', 'warning'); 
                return; 
            }
            window.open(`/owner.html?owner=${selectedOwner}`, '_blank');
        });

        // 9. บันทึกกราฟ
        document.getElementById('btn-save-chart-settings')?.addEventListener('click', () => this.saveChartSettings());

        // 10. ระบบขยายกราฟ (Accessibility Zoom)
        if (this.ui.chartSettingsGrid) {
            this.ui.chartSettingsGrid.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-expand-chart');
                if (btn) {
                    e.stopPropagation();
                    const canvasId = btn.getAttribute('data-canvas-id');
                    if (canvasId) {
                        zoomChart(canvasId);
                    }
                }
            });
        }
    }

    // ==========================================
    // ระบบจัดการไฟล์และตาราง
    // ==========================================
    async loadFileList() {
        try {
            const res = await fetch(`${this.API_BASE_URL}/api/files`);
            if (!res.ok) throw new Error("Network response was not ok");
            const data = await res.json();
            this.fileListData = data.files || []; 
            this.currentPage = 1; 
            this.renderFileList(); 
        } catch (err) { 
            console.error("โหลดรายการไฟล์ไม่สำเร็จ:", err); 
            if (this.ui.fileListBody) {
                this.ui.fileListBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-500 font-medium">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</td></tr>';
            }
        }
    }

    renderFileList() {
        if (!this.ui.fileListBody) return;

        if (this.fileListData.length === 0) {
            this.ui.fileListBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-400 font-medium">ไม่พบไฟล์ในระบบ</td></tr>';
            if (this.ui.paginationContainer) this.ui.paginationContainer.innerHTML = '';
            return;
        }

        if (this.ui.selectAllCb) this.ui.selectAllCb.checked = false;
        if (this.ui.deleteSelectedBtn) this.ui.deleteSelectedBtn.disabled = true;

        const totalPages = Math.ceil(this.fileListData.length / this.itemsPerPage);
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentFiles = this.fileListData.slice(startIndex, endIndex);

        this.ui.fileListBody.innerHTML = currentFiles.map(f => {
            const uploadTime = new Date(f.created * 1000).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) + ' น.';
            const updateTime = new Date(f.modified * 1000).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) + ' น.';
            
            return `
                <tr class="hover:bg-slate-100/50 transition-colors group">
                    <td class="py-3 px-4 text-center align-middle">
                        <input type="checkbox" class="file-select-checkbox w-4 h-4 text-rose-600 rounded border-slate-300 cursor-pointer focus:ring-0" data-name="${f.name}">
                    </td>
                    <td class="py-3 px-4 text-center align-middle">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${f.isActive ? 'checked' : ''} data-name="${f.name}" class="toggle-file-status sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#BE123C]"></div>
                        </label>
                    </td>
                    <td class="py-3 px-4 font-semibold text-slate-700 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 group-hover:text-[#BE123C] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        ${f.name}
                    </td>
                    <td class="py-3 px-4 text-slate-500 font-medium">${uploadTime}</td>
                    <td class="py-3 px-4 text-slate-500 font-medium">${updateTime}</td>
                    <td class="py-3 px-4 text-right">
                        <button data-name="${f.name}" class="btn-delete px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm">ลบไฟล์</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.renderPagination(totalPages);
    }

    renderPagination(totalPages) {
        if (!this.ui.paginationContainer) return;
        if (totalPages <= 1) { this.ui.paginationContainer.innerHTML = ''; return; }

        const startItem = ((this.currentPage - 1) * this.itemsPerPage) + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.fileListData.length);

        let html = `
            <div class="flex items-center justify-between">
                <p class="text-[11px] text-slate-500 font-medium">แสดง <span class="font-bold text-slate-700">${startItem}</span> ถึง <span class="font-bold text-slate-700">${endItem}</span> จากทั้งหมด <span class="font-bold text-slate-700">${this.fileListData.length}</span> ไฟล์</p>
                <div class="flex gap-1">
                    <button data-page="${this.currentPage - 1}" class="btn-page px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition" ${this.currentPage === 1 ? 'disabled' : ''}>&laquo; ก่อนหน้า</button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                html += `<button data-page="${i}" class="btn-page px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-800 text-white shadow-sm">${i}</button>`;
            } else {
                html += `<button data-page="${i}" class="btn-page px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">${i}</button>`;
            }
        }

        html += `
                    <button data-page="${this.currentPage + 1}" class="btn-page px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition" ${this.currentPage === totalPages ? 'disabled' : ''}>ถัดไป &raquo;</button>
                </div>
            </div>`;
        
        this.ui.paginationContainer.innerHTML = html;
    }

    async toggleFileStatus(filename) {
        // 🌟 จุดเด็ดที่ 1: ค้นหาตัวสวิตช์ในหน้าจอที่บอสเพิ่งกด
        const targetInput = document.querySelector(`.toggle-file-status[data-name="${filename}"]`);
        if (!targetInput) return;

        // บันทึกสถานะปัจจุบันที่บอสเพิ่งสับเปลี่ยนไว้ก่อน
        const nextState = targetInput.checked; 

        try {
            const safeFilename = encodeURIComponent(filename);
            console.log(`📡 [API Pipeline] กำลังส่งสัญญาณสลับสถานะไฟล์ '${filename}' เป็น -> ${nextState}`);
            
            const res = await fetch(`${this.API_BASE_URL}/api/files/toggle?filename=${safeFilename}`, { 
                method: 'POST' 
            });
            
            if (res.ok) {
                console.log(`✅ [API Success] หลังบ้านบันทึกสถานะไฟล์ ${filename} เรียบร้อย`);
                
                // 🌟 จุดเด็ดที่ 2: หน่วงเวลาหน้าบ้านไว้ 600 มิลลิวินาที (เพื่อให้หลังบ้านเคลียร์ระบบ Sync และ SQLite ดึงข้อมูลเสร็จ)
                await new Promise(resolve => setTimeout(resolve, 600));

                // โหลดข้อมูลตารางและอัปเดตเวลารีเฟรชล่าสุดอย่างแม่นยำ
                await this.loadFileList();
                await this.loadSettings();
            } else {
                // ถ้าหลังบ้านบอกพัง ให้คืนค่าสวิตช์กลับไปที่เดิมและเตือนบอส
                targetInput.checked = !nextState;
                showSharedGlassToast("หลังบ้านตอบกลับผิดพลาด ไม่สามารถสลับสถานะไฟล์ได้", "error");
            }
        } catch (err) { 
            console.error("⚠️ Toggle file error:", err);
            // ถ้าเน็ตหลุด คืนค่าสวิตช์กลับไปที่เดิม
            targetInput.checked = !nextState;
            showSharedGlassToast("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาเช็คว่าหลังบ้านรันอยู่หรือไม่", "error");
        }
    }

    async handleFileUpload() {
        const files = this.ui.fileInput.files;
        if (!files || files.length === 0) return;
        
        this.ui.uploadBtn.disabled = true;
        const originalText = this.ui.uploadBtn.innerHTML;
        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            this.ui.uploadBtn.innerHTML = `⏳ กำลังอัปโหลด (${i + 1}/${files.length})...`;
            const formData = new FormData();
            formData.append('file', files[i]);
            try {
                const res = await fetch(`${this.API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
                if (res.ok) successCount++;
            } catch (e) { console.error(e); }
        }

        showSharedGlassToast(`นำเข้าข้อมูลสำเร็จ ${successCount} จากทั้งหมด ${files.length} ไฟล์เรียบร้อยแล้วครับ!`, "success");
        this.loadFileList(); 
        this.ui.fileNameDisplay.innerHTML = '';
        this.ui.uploadBtn.innerHTML = originalText;
        this.ui.fileInput.value = ''; 
    }

    async handleBulkDelete() {
        const checkedBoxes = document.querySelectorAll('.file-select-checkbox:checked');
        if (checkedBoxes.length === 0) return;

        if (await showSharedGlassConfirm('ยืนยันการลบแบบกลุ่ม', `คุณยืนยันต้องการลบไฟล์ที่เลือกทั้งหมดจำนวน ${checkedBoxes.length} รายการออกจากระบบใช่หรือไม่?`)) {
            this.ui.deleteSelectedBtn.disabled = true;
            const originalText = this.ui.deleteSelectedBtn.innerHTML;

            for (let i = 0; i < checkedBoxes.length; i++) {
                const filename = checkedBoxes[i].getAttribute('data-name');
                this.ui.deleteSelectedBtn.innerHTML = `⏳ กำลังเคลียร์ (${i + 1}/${checkedBoxes.length})...`;
                try { 
                    const safeName = encodeURIComponent(filename);
                    await fetch(`${this.API_BASE_URL}/api/files/${safeName}`, { method: 'DELETE' }); 
                } catch (err) {}
            }

            showSharedGlassToast(`ลบไฟล์ทั้งหมดจำนวน ${checkedBoxes.length} รายการสำเร็จเรียบร้อยแล้ว`, "success");
            if (this.ui.selectAllCb) this.ui.selectAllCb.checked = false;
            this.ui.deleteSelectedBtn.innerHTML = originalText;
            this.loadFileList(); 
        }
    }

    // ==========================================
    // ระบบการซิงก์และการตั้งค่าทั่วไป
    // ==========================================
    async loadSettings() {
        try {
            const res = await fetch(`${this.API_BASE_URL}/api/settings`);
            const data = await res.json();
            if (this.ui.autoSyncToggle) {
                this.ui.autoSyncToggle.checked = data.auto_update || false;
            }
            this.updateSyncTimeUI(data.last_sync);
        } catch (e) { console.error(e); }
    }

    updateSyncTimeUI(timestamp) {
        if (!this.ui.lastSyncText) return;
        if (!timestamp) { 
            this.ui.lastSyncText.innerText = "ยังไม่เคยซิงก์ข้อมูล"; 
        } else {
            const timeStr = new Date(timestamp * 1000).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
            this.ui.lastSyncText.innerHTML = `ซิงก์ล่าสุด: <span class="font-bold text-[#00508F]">${timeStr} น.</span>`;
        }
    }

    async performManualSync() {
        if (!this.ui.manualSyncBtn) return;
        
        // 1. บันทึกข้อความเริ่มต้นของปุ่มไว้
        const originalText = "🔄 ซิงก์ข้อมูล"; 
        
        // 2. ล็อกปุ่มป้องกันการกดซ้ำ และเปลี่ยนข้อความเป็นกำลังทำงาน
        this.ui.manualSyncBtn.disabled = true;
        this.ui.manualSyncBtn.innerHTML = "⏳ กำลังซิงก์ข้อมูล...";
        
        // เคลียร์สีสถานะตกค้างเก่าออกไปก่อนเพื่อความชัวร์
        this.ui.manualSyncBtn.classList.remove('border-emerald-500', 'text-emerald-500', 'border-rose-500', 'text-rose-500');
        this.ui.manualSyncBtn.classList.add('border-slate-200', 'text-slate-600');

        try {
            console.log("📡 [Sync Pipeline] เริ่มสั่งการซิงก์ข้อมูลไปยังหลังบ้าน...");
            const res = await fetch(`${this.API_BASE_URL}/api/sync`, { method: 'POST' });
            
            if (res.ok) {
                const data = await res.json();
                this.updateSyncTimeUI(data.last_sync);
                await this.refreshOwnerDropdownList();
                
                // 🟢 เปลี่ยนปุ่มเป็นสีเขียว แจ้งซิงก์สำเร็จ
                this.ui.manualSyncBtn.classList.remove('border-slate-200', 'text-slate-600');
                this.ui.manualSyncBtn.classList.add('border-emerald-500', 'text-emerald-500');
                this.ui.manualSyncBtn.innerHTML = "✅ ซิงก์สำเร็จ!";
            } else {
                // 🔴 กรณีหลังบ้านส่ง Error กลับมา (เช่น 500 Internal Server Error)
                console.error(`❌ [Sync Failed] หลังบ้านตอบกลับด้วย HTTP Status: ${res.status}`);
                this.ui.manualSyncBtn.classList.remove('border-slate-200', 'text-slate-600');
                this.ui.manualSyncBtn.classList.add('border-rose-500', 'text-rose-500');
                this.ui.manualSyncBtn.innerHTML = "❌ ซิงก์ล้มเหลว!";
            }
        } catch (e) { 
            // 🔴 กรณีเน็ตหลุด หรือเซิร์ฟเวอร์หลังบ้านดับ/ปิดอยู่
            console.error("⚠️ [Sync Connection Error]:", e);
            this.ui.manualSyncBtn.classList.remove('border-slate-200', 'text-slate-600');
            this.ui.manualSyncBtn.classList.add('border-rose-500', 'text-rose-500');
            this.ui.manualSyncBtn.innerHTML = "❌ เชื่อมต่อไม่ได้!";
        } finally {
            // 🌟 ไม่ว่าจะซิงก์สำเร็จหรือพัง ระบบจะหน่วงเวลา 2 วินาที แล้วคลายล็อกปุ่มกลับมาเป็นปกติเสมอ 100%
            setTimeout(() => {
                this.ui.manualSyncBtn.disabled = false;
                this.ui.manualSyncBtn.classList.remove('border-emerald-500', 'text-emerald-500', 'border-rose-500', 'text-rose-500');
                this.ui.manualSyncBtn.classList.add('border-slate-200', 'text-slate-600');
                this.ui.manualSyncBtn.innerHTML = originalText;
                console.log("🔄 [Sync Pipeline] คลายล็อกและรีเซ็ตปุ่มซิงก์ข้อมูลเรียบร้อย");
            }, 2000); 
        }
    }

    async refreshOwnerDropdownList() {
        if (!this.ui.ownerPreviewSelect) return;
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/active-owners`);
            const result = await response.json();
            this.ui.ownerPreviewSelect.innerHTML = '<option value="">-- เลือกรายชื่อพนักงาน --</option>';
            if (result.owners && result.owners.length > 0) {
                result.owners.forEach(ownerId => {
                    const option = document.createElement('option');
                    option.value = ownerId; 
                    option.textContent = `👤 ${ownerId}`;
                    this.ui.ownerPreviewSelect.appendChild(option);
                });
            }
        } catch (error) { 
            this.ui.ownerPreviewSelect.innerHTML = '<option value="">❌ โหลดข้อมูลล้มเหลว</option>'; 
        }
    }
    
    // ==========================================
    // ระบบจัดการกราฟ (Chart Builder)
    // ==========================================
    // ระบบจัดการกราฟ (Chart Builder)
    // ==========================================
    async loadChartSettings() {
        if (!this.ui.chartSettingsGrid) return;
        try {
            // โหลดสิทธิ์กราฟและข้อมูลดิบจริงแบบคู่ขนานเพื่อประมวลผลข้อมูลจริง
            const [settingsRes, dataRes] = await Promise.all([
                fetch(`${this.API_BASE_URL}/api/chart-settings?t=${Date.now()}`),
                fetch(`${this.API_BASE_URL}/api/dashboard-data?t=${Date.now()}`, { headers: { 'Authorization': 'Bearer admin' } })
            ]);
            
            this.chartSettings = await settingsRes.json();
            
            this.rawRecords = [];
            this.referenceData = {};
            if (dataRes.ok) {
                const dataResult = await dataRes.json();
                this.rawRecords = dataResult.data?.ofiImprovements || [];
                this.referenceData = dataResult.data || {};
            }
            
            this.ui.chartSettingsGrid.innerHTML = Object.entries(this.chartSettings).map(([chartId, data]) => `
                <div class="border border-slate-200 rounded-3xl p-5 bg-white shadow-sm flex flex-col justify-between min-h-[320px] hover:shadow-md transition-all group relative">
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="text-[12px] font-bold text-slate-700 group-hover:text-[#00508F] transition-colors">${data.title}</h4>
                            <button class="btn-expand-chart p-0.5 text-slate-400 hover:text-blue-600 rounded transition" data-canvas-id="canvas-preview-${chartId}" title="ขยายกราฟ (Zoom Chart)">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" /></svg>
                            </button>
                        </div>
                        <div class="h-[120px] w-full bg-slate-50/70 rounded-2xl p-2 mb-4 flex items-center justify-center overflow-hidden border border-slate-100 shadow-inner">
                            <canvas id="canvas-preview-${chartId}"></canvas>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2 text-[11px] font-bold text-slate-600 border-t border-slate-100 pt-3">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="chart-role-checkbox w-4 h-4 text-blue-600 rounded border-slate-300" 
                                data-chart="${chartId}" value="executive" ${data.roles.includes('executive') ? 'checked' : ''}> Executive
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="chart-role-checkbox w-4 h-4 text-teal-600 rounded border-slate-300" 
                                data-chart="${chartId}" value="auditor" ${data.roles.includes('auditor') ? 'checked' : ''}> Auditor
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="chart-role-checkbox w-4 h-4 text-purple-600 rounded border-slate-300" 
                                data-chart="${chartId}" value="owner" ${data.roles.includes('owner') ? 'checked' : ''}> Owner
                        </label>
                    </div>
                </div>
            `).join('');

            Object.keys(this.chartSettings).forEach(chartId => {
                this.renderMiniPreviewChart(chartId);
            });

        } catch (e) { this.ui.chartSettingsGrid.innerHTML = '❌ โหลดการตั้งค่าล้มเหลว'; }
    }

    renderMiniPreviewChart(chartId) {
        const ctx = document.getElementById(`canvas-preview-${chartId}`);
        if (!ctx) return;

        let type = 'bar';
        let data = { labels: [], datasets: [] };
        let options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
            elements: { point: { radius: 0 } }
        };

        // ฟังก์ชันช่วยดึงค่าแบบ Fuzzy Key
        const getValueByFuzzyKey = (obj, targetKeys) => {
            if (!obj) return '';
            for (let key of targetKeys) {
                if (obj[key] !== undefined && obj[key] !== null) return obj[key];
            }
            const cleanTargets = targetKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
            for (let key of Object.keys(obj)) {
                const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (cleanTargets.includes(cleanKey)) return obj[key];
            }
            return '';
        };

        const getRecordModule = (r) => String(getValueByFuzzyKey(r, ['module', 'moduleName', 'module_name', 'Module']) || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const getRecordYear = (r) => String(getValueByFuzzyKey(r, ['assessmentYear', 'assessment_year', 'year', 'Year']) || '').trim();
        const getRecordScore = (r) => parseFloat(getValueByFuzzyKey(r, ['score', 'topicScore', 'topic_score', 'Score']) ?? 0) || 0;
        const getRecordStatus = (r) => String(getValueByFuzzyKey(r, ['status', 'ofiStatus', 'ofi_status', 'Status']) || '').trim().toLowerCase();

        const getRecordLevel = (r) => {
            const rawLvl = String(getValueByFuzzyKey(r, ['ofiLevel', 'ofi_level', 'level', 'Level']) || '');
            const matchDigits = rawLvl.match(/\d/);
            return matchDigits ? parseInt(matchDigits[0]) : 0;
        };

        const getRecordOwnerName = (r) => String(getValueByFuzzyKey(r, ['elementOwnerName', 'element_owner_name', 'ownerName', 'owner_name']) || '').trim();

        const matchYear = (recordYearStr, targetThaiYear) => {
            const yearDigits = recordYearStr.match(/\d{4}/)?.[0] || recordYearStr;
            const yearMap = { '2020': '2563', '2021': '2564', '2022': '2565', '2023': '2566', '2024': '2567', '2025': '2568' };
            const convertedThaiYear = yearMap[yearDigits] || yearDigits;
            return convertedThaiYear === targetThaiYear;
        };

        const getAvgScoreByYear = (mod, thaiYear) => {
            const cleanTargetMod = mod.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const matches = this.rawRecords.filter(r => getRecordModule(r).includes(cleanTargetMod) && matchYear(getRecordYear(r), thaiYear));
            if (matches.length === 0) return 0;
            const sum = matches.reduce((acc, curr) => acc + getRecordScore(curr), 0);
            return parseFloat((sum / matches.length).toFixed(4));
        };

        if (chartId === 'chart-yearly-comparison') {
            const modules = ['CG&LD', 'SP', 'RM&IC', 'SM', 'CM', 'DT', 'HCM', 'KM', 'IM', 'IA'];
            let baseScores = modules.map(mod => getAvgScoreByYear(mod, '2567'));
            let compScores = modules.map(mod => getAvgScoreByYear(mod, '2568'));
            
            const hasRealData = baseScores.some(s => s > 0) || compScores.some(s => s > 0);
            if (!hasRealData) {
                baseScores = [3.2, 3.5, 4.0, 3.8, 3.9, 4.1, 4.2, 3.6, 4.0, 4.5];
                compScores = [3.5, 3.8, 4.2, 4.0, 4.1, 4.3, 4.5, 3.8, 4.2, 4.8];
            }
            
            type = 'bar';
            data = {
                labels: modules,
                datasets: [
                    { data: baseScores, backgroundColor: '#64748B', borderRadius: 2 },
                    { data: compScores, backgroundColor: '#3B82F6', borderRadius: 2 }
                ]
            };
        } else if (chartId === 'chart-ofi-level') {
            let levelCounts = [1, 2, 3, 4, 5].map(lvl => this.rawRecords.filter(r => getRecordLevel(r) === lvl).length);
            const hasLevelData = levelCounts.some(c => c > 0);
            if (!hasLevelData) {
                levelCounts = [5, 12, 25, 18, 7];
            }
            type = 'doughnut';
            data = {
                labels: ['L1', 'L2', 'L3', 'L4', 'L5'],
                datasets: [{
                    data: levelCounts,
                    backgroundColor: ['#E2E8F0', '#94A3B8', '#F59E0B', '#3B82F6', '#EF4444']
                }]
            };
            options.cutout = '65%';
        } else if (chartId === 'chart-6year-trend') {
            const years = ['2563', '2564', '2565', '2566', '2567', '2568'];
            const activeModules = [...new Set(this.rawRecords.map(r => getValueByFuzzyKey(r, ['module', 'moduleName'])).filter(Boolean))].slice(0, 3);
            const displayModules = activeModules.length > 0 ? activeModules : ['CG&LD', 'SP', 'RM&IC'];
            const colorPalette = ['#3B82F6', '#EF4444', '#10B981'];
            const trendDatasets = displayModules.map((mod, index) => {
                return {
                    label: mod,
                    data: years.map(yr => {
                        const avg = getAvgScoreByYear(mod, yr);
                        return avg > 0 ? avg : parseFloat((3.6 + (index * 0.2) + (years.indexOf(yr) * 0.1)).toFixed(4));
                    }),
                    borderColor: colorPalette[index] || '#64748B',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.3
                };
            });
            type = 'line';
            data = {
                labels: years,
                datasets: trendDatasets
            };
        } else if (chartId === 'chart-individual-workload') {
            let usernames = [...new Set(this.rawRecords.map(r => getRecordOwnerName(r)).filter(n => n && n !== 'undefined' && n !== 'null'))].slice(0, 4);
            if (usernames.length === 0) {
                usernames = ['ภากร', 'ณิชิตา', 'สมชาย', 'ศิริพร'];
            }
            const getStatusCount = (user, statusName) => this.rawRecords.filter(r => getRecordOwnerName(r) === user && getRecordStatus(r).includes(statusName.toLowerCase())).length;
            let inProgressData = usernames.map(u => getStatusCount(u, 'progress'));
            let doneData = usernames.map(u => getStatusCount(u, 'done'));
            
            const hasWorkload = inProgressData.some(d => d > 0) || doneData.some(d => d > 0);
            if (!hasWorkload) {
                inProgressData = [3, 5, 2, 4];
                doneData = [8, 6, 9, 7];
            }
            type = 'bar';
            options.scales = { x: { stacked: true, display: false }, y: { stacked: true, display: false } };
            data = {
                labels: usernames,
                datasets: [
                    { data: inProgressData, backgroundColor: '#F59E0B', borderRadius: 2 },
                    { data: doneData, backgroundColor: '#10B981', borderRadius: 2 }
                ]
            };
        } else if (chartId === 'chart-heatmap-matrix') {
            const topModules = ['CG&LD', 'SP', 'RM&IC', 'SM', 'CM'];
            let matrixScores = topModules.map(mod => getAvgScoreByYear(mod, '2568'));
            const hasMatrixData = matrixScores.some(s => s > 0);
            if (!hasMatrixData) {
                matrixScores = [4.2, 3.8, 4.5, 4.0, 3.9];
            }
            type = 'radar';
            data = {
                labels: topModules,
                datasets: [{
                    data: matrixScores,
                    backgroundColor: 'rgba(0, 80, 143, 0.15)',
                    borderColor: '#00508F',
                    borderWidth: 1.5
                }]
            };
            options.scales = { r: { display: false } };
        } else if (chartId === 'chart-progress-list') {
            const phaseKeys = ['phase-plan', 'phase-eo-ec', 'phase-assessment', 'phase-document', 'phase-site-visit'];
            const phaseLabels = ['Plan', 'EO/EC', 'Assess', 'Doc', 'Site'];
            let phaseCounts = [0, 0, 0, 0, 0];
            this.rawRecords.forEach(r => {
                const phases = r.phases || {};
                phaseKeys.forEach((pk, idx) => {
                    const status = (phases[pk]?.status || '').toLowerCase();
                    if (['done', 'qualified', 'in progress'].includes(status)) {
                        phaseCounts[idx]++;
                    }
                });
            });
            const hasProgressData = phaseCounts.some(c => c > 0);
            if (!hasProgressData) {
                phaseCounts = [12, 9, 7, 5, 2];
            }
            type = 'bar';
            options.indexAxis = 'y';
            data = {
                labels: phaseLabels,
                datasets: [{
                    data: phaseCounts,
                    backgroundColor: '#3B82F6',
                    borderRadius: 2
                }]
            };
        } else if (chartId === 'chart-defect-source') {
            const sourceFiles = [...new Set(this.rawRecords.map(r => r._source_file).filter(Boolean))];
            let sourceCounts = sourceFiles.map(f => this.rawRecords.filter(r => r._source_file === f).length);
            let labels = sourceFiles.map(f => f.replace(/_\d{8}_\d{6}.*/, ''));
            if (sourceCounts.length === 0) {
                sourceCounts = [15, 8];
                labels = ['ไฟล์หลัก', 'ไฟล์เสริม'];
            }
            type = 'doughnut';
            data = {
                labels: labels,
                datasets: [{
                    data: sourceCounts,
                    backgroundColor: ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']
                }]
            };
            options.cutout = '65%';
        } else if (chartId === 'chart-gantt-grid') {
            const statuses = ['Done', 'Qualified', 'In progress', 'Delayed', 'Not started'];
            let statusCounts = statuses.map(s => this.rawRecords.filter(r => getRecordStatus(r).includes(s.toLowerCase())).length);
            const hasStatusData = statusCounts.some(c => c > 0);
            if (!hasStatusData) {
                statusCounts = [15, 10, 8, 4, 3];
            }
            type = 'radar';
            data = {
                labels: statuses,
                datasets: [{
                    data: statusCounts,
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    borderColor: '#A855F7',
                    borderWidth: 1.5
                }]
            };
            options.scales = { r: { display: false } };
        } else if (chartId === 'chart-issue-tags') {
            let tagCounts = {};
            this.rawRecords.forEach(r => {
                const tags = r.issueTags || [];
                if (Array.isArray(tags)) {
                    tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
                }
            });
            let sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            let tagLabels = sortedTags.map(t => t[0]);
            let tagValues = sortedTags.map(t => t[1]);
            if (tagValues.length === 0) {
                tagLabels = ['ระบบเอกสาร', 'การสื่อสาร', 'การประเมิน', 'ทรัพยากร', 'การติดตาม'];
                tagValues = [5, 4, 3, 2, 1];
            }
            type = 'bar';
            options.indexAxis = 'y';
            data = {
                labels: tagLabels,
                datasets: [{
                    data: tagValues,
                    backgroundColor: '#8B5CF6',
                    borderRadius: 2
                }]
            };
        }

        new Chart(ctx, { type, data, options });
    }

    async saveChartSettings() {
        const btn = document.getElementById('btn-save-chart-settings');
        if (!btn) return;
        
        btn.innerHTML = '⏳ กำลังบันทึก...';
        const checkboxes = document.querySelectorAll('.chart-role-checkbox');
        
        checkboxes.forEach(cb => {
            const chartId = cb.getAttribute('data-chart');
            const role = cb.value;
            if (!this.chartSettings[chartId]) return;
            
            if (cb.checked) {
                if (!this.chartSettings[chartId].roles.includes(role)) this.chartSettings[chartId].roles.push(role);
            } else {
                this.chartSettings[chartId].roles = this.chartSettings[chartId].roles.filter(r => r !== role);
            }
        });
        
        try {
            await fetch(`${this.API_BASE_URL}/api/chart-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.chartSettings)
            });
            btn.innerHTML = '✅ บันทึกสำเร็จ!';
        } catch (error) {
            btn.innerHTML = '❌ เกิดข้อผิดพลาด';
        }
        
        setTimeout(() => btn.innerHTML = '💾 บันทึกสิทธิ์การแสดงผล', 2000);
    }
}

// สร้างคลาสทันทีที่หน้าเว็บโหลดเสร็จสมบูรณ์
document.addEventListener('DOMContentLoaded', () => {
    new AdminApp().init();
});