// js/components/PathWidget.js
import { fetchRecordData, executeAction } from '../services/api.js';

export const PathWidget = (schema) => {
    const wrapper = document.createElement('div');
    wrapper.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-4";
    
    let currentStatus = null;
    let selectedStatus = null;
    
    const options = schema.options || [];
    const recordId = schema.recordId; // Fixed typo here
    
    const pathContainer = document.createElement('div');
    pathContainer.className = "flex items-center w-full overflow-x-auto custom-scrollbar";
    
    const actionContainer = document.createElement('div');
    actionContainer.className = "flex justify-end hidden transition-all mt-2";
    
    const updateBtn = document.createElement('button');
    actionContainer.appendChild(updateBtn);
    
    wrapper.appendChild(pathContainer);
    wrapper.appendChild(actionContainer);

    const renderPath = () => {
        pathContainer.innerHTML = '';
        if (options.length === 0) {
            pathContainer.innerHTML = '<div class="text-sm text-slate-400">No path stages configured.</div>';
            return;
        }

        const currentIndex = options.indexOf(currentStatus);

        options.forEach((opt, index) => {
            const isCompleted = currentStatus ? index < currentIndex : false;
            const isCurrent = currentStatus ? index === currentIndex : false;
            const isSelected = opt === selectedStatus;

            const step = document.createElement('div');
            step.className = `relative flex-1 flex items-center justify-center py-2.5 px-4 text-sm font-bold cursor-pointer transition-all border-y border-r border-slate-200 first:border-l first:rounded-l-full last:rounded-r-full min-w-[140px]
                ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 z-10' : 'hover:brightness-95'}
            `;

            if (isCompleted) {
                step.classList.add('bg-emerald-500', 'border-emerald-600', 'text-white');
            } else if (isCurrent) {
                step.classList.add('bg-indigo-600', 'border-indigo-700', 'text-white');
            } else {
                step.classList.add('bg-slate-50', 'text-slate-500');
            }

            step.innerHTML = `
                <div class="flex items-center gap-2">
                    ${isCompleted ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>` : ''}
                    <span class="truncate whitespace-nowrap">${opt}</span>
                </div>
            `;

            step.onclick = () => {
                if (!recordId || recordId === "NEW") return;

                if (opt !== currentStatus) {
                    selectedStatus = opt;
                    const isFuture = index > currentIndex;
                    
                    updateBtn.innerHTML = `Mark as <strong>${opt}</strong>`;
                    updateBtn.className = `px-5 py-2 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 ${isFuture ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-500 hover:bg-amber-600'}`;
                    actionContainer.classList.remove('hidden');
                    
                    // BIND THE ACTUAL SAVE ACTION
                    updateBtn.onclick = async () => {
                        updateBtn.disabled = true;
                        updateBtn.innerHTML = '<div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> Updating...';
                        
                        try {
                            const payload = { Id: recordId, [schema.field]: opt };
                            await executeAction(schema.dataSource, [payload]);
                            
                            currentStatus = opt;
                            selectedStatus = null;
                            actionContainer.classList.add('hidden');
                            renderPath(); 
                            
                            // ARCHITECTURE FIX: Trigger optional callback instead of reloading the page
                            if (typeof schema.onUpdate === 'function') {
                                schema.onUpdate(payload);
                            }
                        } catch (error) {
                            alert("Failed to update status.");
                            updateBtn.disabled = false;
                            updateBtn.innerHTML = `Mark as <strong>${opt}</strong>`;
                        }
                    };
                    renderPath(); // Fixed typo 'renderPan()' here
                } else {
                    selectedStatus = null;
                    actionContainer.classList.add('hidden');
                    renderPath();
                }
            };
            pathContainer.appendChild(step);
        });
    };

    if (schema.recordData) {
        currentStatus = schema.recordData[schema.field];
        renderPath();
    } else if (recordId && recordId !== "NEW") {
        fetchRecordData(schema.dataSource, [schema.field], recordId).then(res => {
            const records = Array.isArray(res) ? res : res.data || [];
            if (records.length > 0) {
                currentStatus = records[0][schema.field];
                renderPath();
            }
        });
    }

    return wrapper;
};