// frontend/js/admin/main.js

import { renderObjectManager } from './objectManager.js';
import { renderObjectDetail } from './objectDetail.js';

// Top-level security module
import { renderSecurityDashboard } from './security.js';

// 1. View Router
function loadView(view, element) {
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Matches 'admin-root' from admin.html
    const root = document.getElementById('admin-root');

    if (view === 'object-manager') renderObjectManager(root);
    if (view === 'security-matrix') renderSecurityDashboard(root);
}

// 2. Attach Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const viewName = e.currentTarget.dataset.view;
            loadView(viewName, e.currentTarget);
        });
    });


// Init Default View
const defaultLink = document.querySelector('.sidebar-link');
if (defaultLink) {
    loadView('object-manager', defaultLink);
}
});

// 3. Global click handler for the DataGrid
window.openRecordDetail = (dataSource, recordId) => {
    const container = document.getElementById('admin-root');
    renderObjectDetail(container, recordId);
};
