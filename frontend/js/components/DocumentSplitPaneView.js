// js/components/DocumentSplitPaneView.js
import { fetchQuery, executeAction, fetchBlueprint } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { FilterBuilder } from './FilterBuilder.js';

export const DocumentSplitPaneView = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex flex-col gap-4 h-full w-full";

    // Top Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = "flex justify-between items-center bg-white p-3 border border-slate-200 rounded-xl shadow-sm shrink-0";
    
    const leftControls = document.createElement('div');
    leftControls.id = "split-pane-filter-container";
    
    const rightControls = document.createElement('div');
    rightControls.className = "flex items-center gap-3";
    
    const recordCounter = document.createElement('span');
    recordCounter.className = "text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg";
    recordCounter.innerText = "0 Records";
    
    rightControls.appendChild(recordCounter);
    toolbar.appendChild(leftControls);
    toolbar.appendChild(rightControls);

    // Split Canvas Container
    const splitCanvas = document.createElement('div');
    splitCanvas.className = "flex-1 flex gap-4 overflow-hidden min-h-0";

    // Left Pane: Document Viewer
    const leftPane = document.createElement('div');
    leftPane.className = "w-1/2 bg-slate-900 border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col relative";

    // Right Pane: Data Entry Form & Record Selector
    const rightPane = document.createElement('div');
    rightPane.className = "w-1/2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden";

    splitCanvas.appendChild(leftPane);
    splitCanvas.appendChild(rightPane);
    mainContainer.appendChild(toolbar);
    mainContainer.appendChild(splitCanvas);

    let currentRecords = [];
    let selectedIndex = 0;
    let activeFilters = schema.filters || [];
    const documentField = schema.documentField || 'DocumentUrl';
    const formFields = schema.formFields || [];

    const filterComponent = FilterBuilder(schema, (newFilters) => {
        activeFilters = newFilters;
        fetchRecords();
    });
    leftControls.appendChild(filterComponent);

    const initView = async () => {
        renderLoading(splitCanvas, "Loading Document Workspace...");
        try {
            await fetchRecords();
        } catch (err) {
            renderError(splitCanvas, `Failed to load Split-Pane View: ${err.message}`);
        }
    };

    const fetchRecords = async () => {
        try {
            const queryFields = [...new Set([...formFields, documentField, 'Id', 'Name'])];
            currentRecords = await fetchQuery(schema.dataSource, queryFields, activeFilters);
            recordCounter.innerText = `${currentRecords.length} Records`;
            
            if (currentRecords.length > 0) {
                if (selectedIndex >= currentRecords.length) selectedIndex = 0;
                renderWorkspace();
            } else {
                renderEmptyState();
            }
        } catch (error) {
            renderError(splitCanvas, `Error loading dataset: ${error.message}`);
        }
    };

    const renderEmptyState = () => {
        leftPane.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-400">
                <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <p class="text-sm font-medium">No documents to review</p>
            </div>`;
        rightPane.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">No record selected.</div>`;
    };

    const renderWorkspace = () => {
        const record = currentRecords[selectedIndex];
        const docUrl = record[documentField];

        // 1. Render Left Document Pane
        leftPane.innerHTML = `
            <div class="bg-slate-800 text-slate-300 px-4 py-2 border-b border-slate-700 text-xs font-semibold flex justify-between items-center shrink-0">
                <span class="truncate">Document: ${docUrl || 'No attachment'}</span>
                <div class="flex items-center gap-2">
                    <button id="prev-doc-btn" class="p-1 hover:bg-slate-700 rounded transition-colors disabled:opacity-30">&larr; Prev</button>
                    <span class="text-slate-400 text-[11px]">${selectedIndex + 1} of ${currentRecords.length}</span>
                    <button id="next-doc-btn" class="p-1 hover:bg-slate-700 rounded transition-colors disabled:opacity-30">Next &rarr;</button>
                </div>
            </div>
            <div class="flex-1 w-full h-full bg-slate-900 relative">
                ${docUrl ? `
                    <iframe src="${docUrl}" class="w-full h-full border-none"></iframe>
                ` : `
                    <div class="flex flex-col items-center justify-center h-full text-slate-500">
                        <svg class="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                        <p class="text-xs">No preview available for this record.</p>
                    </div>
                `}
            </div>
        `;

        // Left Navigation Bindings
        const prevBtn = leftPane.querySelector('#prev-doc-btn');
        const nextBtn = leftPane.querySelector('#next-doc-btn');
        prevBtn.disabled = selectedIndex === 0;
        nextBtn.disabled = selectedIndex === currentRecords.length - 1;
        prevBtn.onclick = () => { selectedIndex--; renderWorkspace(); };
        nextBtn.onclick = () => { selectedIndex++; renderWorkspace(); };

        // 2. Render Right Form Pane
        rightPane.innerHTML = "";
        const formHeader = document.createElement('div');
        formHeader.className = "p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center shrink-0";
        formHeader.innerHTML = `
            <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Record Verification</span>
                <h3 class="text-base font-bold text-slate-800 truncate">${record.Name || record.Id}</h3>
            </div>
            <button id="save-split-form" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
                Save & Continue
            </button>
        `;

        const formBody = document.createElement('form');
        formBody.className = "p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar";

        formFields.forEach(field => {
            const fieldGroup = document.createElement('div');
            fieldGroup.className = "flex flex-col gap-1.5";
            fieldGroup.innerHTML = `
                <label class="text-xs font-semibold text-slate-600">${field}</label>
                <input type="text" name="${field}" value="${record[field] || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-colors">
            `;
            formBody.appendChild(fieldGroup);
        });

        rightPane.appendChild(formHeader);
        rightPane.appendChild(formBody);

        // Save Record Handler
        const saveBtn = rightPane.querySelector('#save-split-form');
        saveBtn.onclick = async (e) => {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.innerText = "Saving...";

            const formData = new FormData(formBody);
            const payload = { Id: record.Id };
            formFields.forEach(field => {
                payload[field] = formData.get(field);
            });

            try {
                // ARCHITECTURE FIX: Use executeAction and wrap payload in an array
                await executeAction(schema.dataSource, [payload]);
                
                // Update local memory & jump to next document automatically
                Object.assign(currentRecords[selectedIndex], payload);
                if (selectedIndex < currentRecords.length - 1) {
                    selectedIndex++;
                    renderWorkspace();
                } else {
                    saveBtn.innerText = "Saved!";
                    setTimeout(() => saveBtn.innerText = "Save & Continue", 1500);
                }
            } catch (err) {
                alert(`Error saving record: ${err.message}`);
                saveBtn.disabled = false;
                saveBtn.innerText = "Save & Continue";
            }
        };
    };

    initView();
    return mainContainer;
};