// js/migration.js
import { getHeaders, fetchObjectsList, fetchRecentJobsAPI } from './services/api.js';

let pollingInterval = null;
let objectsLoaded = false; 

// Attach globally so the HTML button can find it
window.toggleMigrationModal = () => {
    const modal = document.getElementById('migrationModalOverlay');
    modal.classList.toggle('hidden');
    
    if (!modal.classList.contains('hidden')) {
        window.refreshJobs();
        pollingInterval = setInterval(window.refreshJobs, 3000);
        
        if (!objectsLoaded) {
            populateObjectDropdown();
        }
    } else {
        clearInterval(pollingInterval);
    }
};

const populateObjectDropdown = async () => {
    const select = document.getElementById('importObjectSelect');
    if (!select) return;

    try {
        const response = await fetchObjectsList();
        
        let objects = [];
        if (Array.isArray(response)) {
            objects = response;
        } else if (response && typeof response === 'object') {
            objects = response.data || response.objects || response.items || response.results || [];
        }

        select.innerHTML = '<option value="">Select Target Object...</option>';

        objects.forEach(obj => {
            const objName = typeof obj === 'string' ? obj : (obj.name || obj.object_name || obj.Id || obj.id); 
            if (objName) {
                const option = document.createElement('option');
                option.value = objName;
                option.textContent = objName;
                select.appendChild(option);
            }
        });
        
        objectsLoaded = true; 
    } catch (e) {
        console.error("Failed to fetch objects for migration dropdown:", e);
    }
};

window.executeImport = async () => {
    const objectName = document.getElementById('importObjectSelect').value;
    const fileInput = document.getElementById('importCsvFile');

    if (!objectName) return window.showToast('Please select a target object.', 'error');
    if (!fileInput.files.length) return window.showToast('Please select a CSV file.', 'error');

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`/api/v1/migration/${objectName}/import`, {
            method: 'POST',
            headers: getHeaders(true), 
            body: formData
        });

        if (!res.ok) throw new Error('Import failed to start');
        
        window.showToast('Import job queued successfully', 'success');
        fileInput.value = ''; 
        window.refreshJobs();
    } catch (e) {
        window.showToast(e.message, 'error');
    }
};

window.executeExport = async () => {
    const objectName = document.getElementById('importObjectSelect').value;
    
    if (!objectName) return window.showToast('Please select a target object.', 'error');

    try {
        window.showToast(`Starting ${objectName} export...`, 'info');
        
        // Use fetch instead of window.open to include your required headers
        const res = await fetch(`/api/v1/migration/${objectName}/export`, {
            method: 'GET',
            headers: getHeaders() 
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Export failed to process');
        }
        
        // Convert the response into a downloadable file blob
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        
        // Create a temporary hidden link to trigger the download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = `${objectName}_export.csv`; 
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        
        window.showToast(`${objectName} export downloaded successfully`, 'success');
    } catch (e) {
        window.showToast(e.message, 'error');
    }
};

window.executeBulkExport = async () => {
    try {
        window.showToast('Triggering system-wide bulk export...', 'info');
        
        // Trigger the asynchronous bulk export endpoint
        const res = await fetch(`/api/v1/migration/export/bulk`, {
            method: 'POST', // Notice this is a POST request
            headers: getHeaders()
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Bulk export failed to trigger');
        }
        
        window.showToast('Bulk export job queued successfully', 'success');
        
        // Refresh the job tracker so the new PENDING job appears on the right
        window.refreshJobs(); 
    } catch (e) {
        window.showToast(e.message, 'error');
    }
};

window.refreshJobs = async () => {
    try {
        const jobs = await fetchRecentJobsAPI();
        renderJobs(jobs || []);
    } catch (e) {
        console.error("Job tracker error:", e.message);
    }
};

window.downloadExport = async (jobId) => {
    try {
        window.showToast(`Downloading job ${jobId}...`, 'info');
        
        const res = await fetch(`/api/v1/migration/jobs/${jobId}/download`, {
            method: 'GET',
            headers: getHeaders() 
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Download failed to process');
        }
        
        // Convert the response into a downloadable file blob
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        
        // Create a temporary hidden link to trigger the download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = `export_${jobId}.zip`; // Change extension if it is a CSV
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        
    } catch (e) {
        window.showToast(e.message, 'error');
    }
};

function renderJobs(jobs) {
    const container = document.getElementById('jobTrackerList');
    if (!container) return;

    if (jobs.length === 0) {
        container.innerHTML = `<div class="text-center text-sm text-slate-400 mt-10">No active jobs found.</div>`;
        return;
    }

    container.innerHTML = jobs.map(job => {
        const isComplete = job.status === 'COMPLETED';
        const isFailed = job.status === 'FAILED';
        const isExport = job.job_type === 'EXPORT' || job.job_type === 'BULK_EXPORT';
        
        let statusColor = 'text-amber-500 bg-amber-50'; 
        if (isComplete) statusColor = 'text-emerald-500 bg-emerald-50';
        if (isFailed) statusColor = 'text-rose-500 bg-rose-50';

        return `
            <div class="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between mb-2">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-bold text-slate-700">${job.job_type}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor}">${job.status}</span>
                    </div>
                    <div class="text-[10px] text-slate-400">ID: ${job.Id}</div>
                </div>
                ${(isComplete && isExport) ? `
                    <button onclick="window.downloadExport('${job.Id}')" class="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors" title="Download ZIP">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}