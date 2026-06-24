// src/app.js

document.addEventListener('DOMContentLoaded', () => {
    // เช็คว่ามีตัวแปร window.OFI_SAMPLE_DATA จาก sample-data.js หรือไม่
    if (typeof window.OFI_SAMPLE_DATA !== 'undefined') {
        const dataService = new DashboardDataService(window.OFI_SAMPLE_DATA);
        const uiManager = new UIManager(dataService);
        
        uiManager.init(); // สั่งให้ระบบเริ่มทำงาน
    } else {
        document.body.innerHTML = `
            <div class="flex items-center justify-center h-screen bg-white">
                <div class="text-center">
                    <h1 class="text-2xl text-red-600 font-bold mb-2">Error: ไม่พบข้อมูล</h1>
                    <p class="text-gray-600">โปรดตรวจสอบว่าได้เชื่อมต่อไฟล์ sample-data.js ถูกต้อง</p>
                </div>
            </div>`;
    }
});