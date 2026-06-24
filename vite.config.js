import { defineConfig } from 'vite'
import { resolve } from 'path'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // บอก Vite ให้มองโฟลเดอร์ frontend เป็นรากหลักของฝั่งหน้าเว็บ
  root: 'frontend', 
  plugins: [
    // basicSsl(), //HTTPS
  ],
  
  build: {
    // เวลา build เสร็จ ให้ส่งไฟล์ไปที่โฟลเดอร์ dist ที่อยู่ด้านนอกสุดของโปรเจค
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      // ลงทะเบียนหน้า HTML ทั้งหมดของคุณเพื่อให้ Vite รู้จักและยอม Build ให้
      input: {
        main: resolve(__dirname, 'frontend/index.html'),
        admin: resolve(__dirname, 'frontend/admin.html'),
        auditor: resolve(__dirname, 'frontend/auditor.html'),
        executive: resolve(__dirname, 'frontend/executive.html'),
        owner: resolve(__dirname, 'frontend/owner.html'),
      },
    },
  },
  server: {
    host: true, // เปิดโหมดแชร์วง LAN ให้เพื่อนเข้าแบบ realtime ได้เลย
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // ชี้ไปที่ FastAPI ของคุณ
        changeOrigin: true,
        secure: false,
      }
    }
  },
})