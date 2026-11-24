import { fetchRecordData, shareRecordAPI } from '../services/api.js';
import { openAdvancedLookup } from '../modals/AdvancedLookup.js';

// Restored: Fast, zero-network way to extract fields to query!
function getFormConfig(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'Form') return node;
    for (const key of Object.keys(node)) {
        if (Array.isArray(node[key])) {
            for (const item of node[key]) {
                const found = getFormConfig(item);
                if (found) return found;
            }
        } else if (typeof node[key] === 'object' && node[key] !== null) {
            const found = getFormConfig(node[key]);
            if (found) return found;
        }
    }
    return null;
}

export const Record360 = (schema, renderChild) => {
    const formConfig = getFormConfig(schema);
    const targetObj = schema.targetObject || 'Record';
    const recId = schema.recordId;
    const isNewRecord = recId === "NEW" || recId === "__NEW_RECORD__";

    // --- 0. COMPONENT HYDRATION ---
    if (recId && !isNewRecord && !schema.recordData) {
        const loadingWrapper = document.createElement('div');
        loadingWrapper.className = "min-h-screen bg-slate-50 flex items-center justify-center";
        loadingWrapper.innerHTML = `<div class="animate-spin h-8 w-8 text-indigo-500 rounded-full border-4 border-t-transparent"></div>`;
        setTimeout(async () => {
            try {
                const requiredFields = formConfig?.fields ? formConfig.fields.map(f => f.name || f.field_name || f) : ['Id'];
                if (!requiredFields.includes('Id')) requiredFields.push('Id');

                const result = await fetchRecordData(targetObj, requiredFields, recId);
                const data = result.data?.[0] || {};

                schema.recordData = data;
                schema.displayMode = 'read';

                if (formConfig) {
                    formConfig.recordData = data;
                    formConfig.displayMode = 'read';
                }

                loadingWrapper.replaceWith(Record360(schema, renderChild));
            } catch (error) {
                console.error("Hydration Error:", error);
                loadingWrapper.innerHTML = '<div class="text-rose-500 p-4">Error loading data.</div>';
            }
        }, 0);
        return loadingWrapper;
    }

    if (isNewRecord) {
        schema.displayMode = 'edit';
        if (formConfig) formConfig.displayMode = 'edit';
    }

    // --- GLOBAL TOKEN HYDRATION ---
    // Extract recordData temporarily so it doesn't get destroyed by JSON stringify
    const preservedData = schema.recordData || {};
    schema.recordData = null;

    let schemaString = JSON.stringify(schema);
    schemaString = schemaString.replace(/{RECORD_ID}/g, recId);

    const hydratedSchema = JSON.parse(schemaString);
    hydratedSchema.recordData = preservedData; // Restore

    // --- 1. MAIN WRAPPER ---
    const pageWrapper = document.createElement('div');
    pageWrapper.className = "min-h-screen bg-slate-50 flex flex-col font-sans";

    const header = document.createElement('header');
    header.className = "bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-20 flex justify-between items-center shadow-sm";

    const titleDisplay = isNewRecord ? `Create New ${targetObj}` : (preservedData.Name || preservedData.FirstName || preservedData.Id || recId);

    // header.innerHTML = `
    //     <div>
    //         <div class="text-xs font-bold tracking-widest text-indigo-500 uppercase mb-1">${targetObj}</div>
    //         <h1 class="text-2xl font-bold text-slate-800 flex items-center gap-3">
    //             ${titleDisplay}
    //             ${preservedData.Status && !isNewRecord ? `<span class="text-xs font-bold px-2.5 py-1 rounded-md tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">${preservedData.Status}</span>` : ""}
    //         </h1>
    //     </div>
    //     <button class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" onclick="window.history.back()">← Back</button>
    // `;

    header.innerHTML = `
        <div>
            <div class="text-xs font-bold tracking-widest text-indigo-500 uppercase mb-1">${targetObj}</div>
            <h1 class="text-2xl font-bold text-slate-800 flex items-center gap-3">
                ${titleDisplay}
                ${preservedData.Status && !isNewRecord ? `<span class="text-xs font-bold px-2.5 py-1 rounded-md tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">${preservedData.Status}</span>` : ""}
            </h1>
        </div>
        <div class="flex items-center gap-3">
            ${!isNewRecord ? `<button id="share-btn" class="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Share</button>` : ""}
            <button class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" onclick="window.history.back()">← Back</button>
        </div>
    `;
    pageWrapper.appendChild(header);



    if (!isNewRecord) {
        const shareBtn = header.querySelector('#share-btn');
        
        shareBtn.addEventListener('click', () => {
            // Create dummy DOM elements in memory to catch the AdvancedLookup callback
            const dummyTextInput = document.createElement('input');
            const dummyHiddenInput = document.createElement('input');

            // Listen for the selection from the grid
            dummyHiddenInput.addEventListener('change', async () => {
                const targetUserId = dummyHiddenInput.value;
                if (!targetUserId) return;
                
                try {
                    shareBtn.innerText = "Sharing...";
                    shareBtn.disabled = true;
                    
                    await shareRecordAPI(targetObj, recId, targetUserId);
                    
                    // showToast(`Successfully shared ${targetObj} with ${dummyTextInput.value || targetUserId}`, 'success');
                    // Call the newly unified global function
                    window.showToast(`Successfully shared ${targetObj} with ${dummyTextInput.value || targetUserId}`, 'success');
                    } catch (error) {
                    // showToast(`Failed to share: ${error.message}`, 'error');
                    window.showToast(`Failed to share: ${error.message}`, 'error');
                } finally {
                    shareBtn.innerText = "Share";
                    shareBtn.disabled = false;
                }
            });

            // Launch the beautiful modal pointing to the "User" object!
            // Launch the beautiful modal pointing to the "User" object!
            openAdvancedLookup({
                targetObject: 'User', 
                lookupColumns: ['Id', 'Name', 'ProfileId'], // <-- FIX: Changed to match backend schema
                displayColumns: ['Name'] 
            }, dummyTextInput, dummyHiddenInput);
        });



    }

    const layoutGrid = document.createElement('div');
    layoutGrid.className = "max-w-[1400px] mx-auto w-full px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8";

    // --- LEFT COLUMN (70% Main Area) ---
    const leftColumn = document.createElement('div');
    leftColumn.className = isNewRecord ? "lg:col-span-12 max-w-3xl mx-auto w-full space-y-6" : "lg:col-span-8 space-y-6";

    // --- NEW: RENDER PATH WIDGET FIRST ---
    if (hydratedSchema.pathWidget) {
        // Pass the pre-fetched recordData so PathWidget doesn't have to do a redundant API call
        hydratedSchema.pathWidget.recordData = preservedData;
        leftColumn.appendChild(renderChild(hydratedSchema.pathWidget));
    }

    // Detect the new CommandCenter 'mainArea' structure or fallback to legacy 'children'
    const mainContentLayout = hydratedSchema.mainArea || hydratedSchema.children;

    if (mainContentLayout) {
        // Pass record data down into tabs if they exist
        if (mainContentLayout.type === 'Tabs' && Array.isArray(mainContentLayout.tabs)) {
            mainContentLayout.tabs.forEach(t => {
                if (Array.isArray(t.content)) {
                    t.content.forEach(childNode => childNode.recordData = preservedData);
                } else if (t.content) {
                    t.content.recordData = preservedData;
                }
            });
        } else if (Array.isArray(mainContentLayout)) {
            mainContentLayout.forEach(child => {
                if (child.type === 'Tabs' && Array.isArray(child.tabs)) {
                    child.tabs.forEach(t => {
                        if (Array.isArray(t.content)) t.content.forEach(c => c.recordData = preservedData);
                    });
                }
            });
        }
    }

    // Render either the array of children or the main Tabs object
    if (Array.isArray(mainContentLayout)) {
        mainContentLayout.forEach(child => leftColumn.appendChild(renderChild(child)));
    } else if (mainContentLayout) {
        leftColumn.appendChild(renderChild(mainContentLayout));
    }

    layoutGrid.appendChild(leftColumn);

    // --- RIGHT COLUMN (30% Capability Rail) ---
    if (!isNewRecord) {
        const rightColumn = document.createElement('div');
        // Sticky rail styling: Stays visible while left column scrolls
        rightColumn.className = "lg:col-span-4 sticky top-28 h-[calc(100vh-8rem)] flex flex-col space-y-6";

        const capabilities = hydratedSchema.capabilities || [];

        if (capabilities.length === 0) {
            rightColumn.innerHTML = `<div class="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 font-medium">No system capabilities enabled.</div>`;
        } else {
            const capabilityContainer = document.createElement('div');
            capabilityContainer.className = "bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden";
            // Capability Tabs Header
            const tabsHeader = document.createElement('div');
            tabsHeader.className = "flex border-b border-slate-200 bg-slate-50 px-2 pt-2 gap-2";

            // Capability Widget Body
            const widgetBody = document.createElement('div');
            widgetBody.className = "flex-1 overflow-y-auto bg-white p-4";

            let activeTab = capabilities[0];

            const renderActiveWidget = () => {
                widgetBody.innerHTML = "";

                // Define capability mappings to UI components
                const widgetSchema = {
                    type: activeTab === 'record_chat' ? 'ThreadChatWidget' :
                          activeTab === 'file_attachments' ? 'FileAttachmentWidget' :
                          activeTab === 'audit_trail' ? 'AuditHistoryWidget' : 'UnknownWidget',
                    parentRecordId: recId,
                    parentObjectType: targetObj
                };

                widgetBody.appendChild(renderChild(widgetSchema));
            };

            // Build Capability Tabs
            capabilities.forEach(cap => {
                const tabBtn = document.createElement('button');
                const label = cap === 'record_chat' ? '💬 Chat' :
                              cap === 'file_attachments' ? '📁 Files' :
                              cap === 'audit_trail' ? '📜 History' : cap;
                tabBtn.className = `px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
                    activeTab === cap
                    ? 'bg-white text-indigo-600 border-t border-l border-r border-slate-200 -mb-px'
                    : 'text-slate-500 hover:text-slate-700'
                }`;
                tabBtn.innerText = label;

                tabBtn.onclick = () => {
                    activeTab = cap;
                    // Reset tab styles
                    Array.from(tabsHeader.children).forEach(btn => {
                        btn.className = 'px-4 py-2 text-sm font-bold rounded-t-lg transition-colors text-slate-500 hover:text-slate-700';
                    });
                    tabBtn.className = 'px-4 py-2 text-sm font-bold rounded-t-lg transition-colors bg-white text-indigo-600 border-t border-l border-r border-slate-200 -mb-px';
                    renderActiveWidget();
                };
                tabsHeader.appendChild(tabBtn);
            });

            capabilityContainer.appendChild(tabsHeader);
            capabilityContainer.appendChild(widgetBody);
            rightColumn.appendChild(capabilityContainer);

            // Initial render
            renderActiveWidget();
        }
        layoutGrid.appendChild(rightColumn);
    }

    pageWrapper.appendChild(layoutGrid);
    return pageWrapper;
};
