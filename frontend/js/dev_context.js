

// js/dev_context.js
import { fetchQuery } from './services/api.js';

export function initDevContext() {
    const devSwitcher = document.getElementById('dev-context-switcher');
    const tenantSwitcher = document.getElementById('dev-tenant-switcher');
    const adminResetBtn = document.getElementById('dev-admin-reset');

    // Early exit if dev tools are not rendered on the current page
    if (!devSwitcher || !tenantSwitcher) return;

    const savedUser = localStorage.getItem('dev_user') || 'USER-ALICE';
    const savedTenant = localStorage.getItem('dev_tenant') || 'TENANT-ACME';

    // 1. Hydrate UI
    const userEl = document.getElementById('currentUser');
    const tenantEl = document.getElementById('currentTenant');
    if (userEl) userEl.innerText = savedUser;
    if (tenantEl) tenantEl.innerText = savedTenant;

    tenantSwitcher.value = savedTenant;

    // 2. Fetch Users
    const populateUsers = async () => {
        try {
            const users = await fetchQuery('User', ['Id', 'Name']);
            devSwitcher.innerHTML = "";

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.Id;
                option.text = `${user.Name || 'Unknown'} (${user.Id})`;
                if (user.Id === savedUser) option.selected = true;
                devSwitcher.appendChild(option);
            });
        } catch (error) {
            console.warn("[Dev Mode] Security block active. Dropdown restricted.");
            devSwitcher.innerHTML = `<option value="${savedUser}">${savedUser} (Restricted)</option>`;
        }
    };
    populateUsers();

    // 3. User Switch Listener
    devSwitcher.addEventListener('change', (e) => {
        localStorage.setItem('dev_user', e.target.value);
        window.location.reload();
    });

    // 4. Tenant Switch Listener
    tenantSwitcher.addEventListener('change', (e) => {
        localStorage.setItem('dev_tenant', e.target.value);
        window.location.reload();
    });

    // 5. Admin Escape Hatch Listener
    if (adminResetBtn) {
        adminResetBtn.addEventListener('click', () => {
            localStorage.setItem('dev_user', 'USER-ALICE');
            localStorage.setItem('dev_tenant', 'TENANT-ACME');
            console.log("[Dev Mode] Emergency Reset to Admin executed.");
            window.location.reload();
        });
    }
}