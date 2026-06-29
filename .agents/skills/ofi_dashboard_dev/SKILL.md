---
name: ofi-dashboard-dev
description: Guide for developing, maintaining, and extracting UI design specifications for the PTT OFI Ultimate Integration Dashboard project.
---

# PTT OFI Dashboard Developer Skill

This skill provides guidelines and specifications for developing, updating, and exporting UI specs for the PTT OFI Ultimate Integration Dashboard workspace.

## 📂 Project Architecture Reference
The project follows a **Clean Architecture / OOP** pattern:
*   **Backend (FastAPI + SQLite):**
    *   `backend/api/v1/endpoints/`: Routing layer (`dashboard.py`, `export.py`, `files.py`, `settings.py`).
    *   `backend/repositories/`: Data access layer using Repository pattern (`ofi_repository.py`).
    *   `backend/services/`: Core business logic (`pipeline_service.py`, `pdf_export_service.py`).
    *   `backend/models/`: Database models (`ofi.py`) and schema validations (`schemas.py`).
*   **Frontend (Static assets + Tailwind CSS + Vanilla JS):**
    *   `frontend/index.html`: Entry point for choosing roles.
    *   `frontend/admin.html`, `frontend/executive.html`, `frontend/auditor.html`, `frontend/owner.html`: Dashboard pages for each role.
    *   `frontend/js/views/`: Layout and rendering code for each view.
    *   `frontend/js/utils/chartRenderers.js`: Chart rendering using Chart.js.

## 🎨 Theme & UI Style Guide
*   **Primary Corporate Color:** PTT corporate blue (`#00508F`).
*   **Highlight Row Color:** `.active-selected-row` utilizes `rgba(239, 246, 255, 0.9)` with a solid `#00508F` left border.
*   **Fonts:** `Inter` (numbers & english text) and `Noto Sans Thai` (Thai typography).
*   **Glassmorphism Cards:** `.glass-card` uses `backdrop-filter: blur(24px) saturate(120%)` with a subtle white semi-transparent border and a soft drop shadow.

## 📊 Dashboard Visualizations
*   **Executive Dashboard:**
    *   `chart-yearly-comparison` (Grouped Bar Chart)
    *   `chart-ofi-level` (Doughnut Chart)
    *   `chart-6year-trend` (Line Chart)
    *   `chart-individual-workload` (Stacked Bar Chart)
*   **Auditor Dashboard:**
    *   `chart-progress-list` (Vertical Progress Bars)
    *   `chart-defect-source` (Double Doughnut Chart)
    *   `chart-heatmap-matrix` (Score comparison grid)
*   **Process Owner Dashboard:**
    *   `chart-gantt-grid` (Phase tracking grid table)
    *   `chart-issue-tags` (Horizontal Bar Chart)
