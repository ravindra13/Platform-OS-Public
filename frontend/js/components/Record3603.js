// js/components/Record360.js
import { fetchRecordData } from '../services/api.js';

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
        // CHANGED: Removed min-h-screen, let it fill parent
        loadingWrapper.className = "h-full w-full bg-transparent flex items-center justify-center py-20";
        loadingWrapper.innerHTML = `<div class="animate-spin h-8 w-8 text-emerald-500 rounded-full border-4 border-t-transparent"></div>`;
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
                loadingWrapper.innerHTML = '<div class="text-rose-600 font-medium bg-rose-50 border border-rose-200 p-4 rounded-md">Error loading data.</div>';
            }
        }, 0);
        return loadingWrapper;
    }

    if (isNewRecord) {
        schema.displayMode = 'edit';
        if (formConfig) formConfig.displayMode = 'edit';
    }

    const preservedData = schema.recordData || {};
    schema.recordData = null;
    let schemaString = JSON.stringify(schema);
    schemaString = schemaString.replace(/{RECORD_ID}/g, recId);
    const hydratedSchema = JSON.parse(schemaString);
    hydratedSchema.recordData = preservedData;

    // --- 1. MAIN WRAPPER ---
    const pageWrapper = document.createElement('div');
    // CHANGED: Removed min-h-screen and heavy background, letting it sit inside the canvas
    pageWrapper.className = "flex flex-col font-sans w-full h-full";

    const header = document.createElement('header');
    // CHANGED: Removed sticky top, shadow, and heavy padding. It now looks native to the slide-over
    header.className = "bg-transparent border-b border-slate-200 pb-5 mb-5 flex justify-between items-center";

    const titleDisplay = isNewRecord ? `Create New ${targetObj}` : (preservedData.Name || preservedData.FirstName || preservedData.Id || recId);

    header.innerHTML = `
        <div>
            <div class="text-[10px] font-bold tracking-widest text-emerald-600 uppercase mb-1">${targetObj}</div>
            <h1 class="text-xl font-bold text-slate-800 flex items-center gap-3">
                ${titleDisplay}
                ${preservedData.Status && !isNewRecord ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">${preservedData.Status}</span>` : ""}
            </h1>
        </div>
        <button class="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-md transition-colors" onclick="window.history.back()">← Back</button>
    `;
    pageWrapper.appendChild(header);

    const layoutGrid = document.createElement('div');
    // CHANGED: Removed max-w constraints and heavy vertical padding. Changed layout to stack on smaller screens.
    layoutGrid.className = "w-full flex flex-col xl:flex-row gap-6 pb-10";

    // --- LEFT COLUMN (Main Area) ---
    const leftColumn = document.createElement('div');
    leftColumn.className = isNewRecord ? "w-full xl:w-2/3 space-y-6" : "w-full xl:w-2/3 space-y-6";

    if (hydratedSchema.pathWidget) {
        hydratedSchema.pathWidget.recordData = preservedData;
        leftColumn.appendChild(renderChild(hydratedSchema.pathWidget));
    }

    const mainContentLayout = hydratedSchema.mainArea || hydratedSchema.children;

    if (mainContentLayout) {
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

    if (Array.isArray(mainContentLayout)) {
        mainContentLayout.forEach(child => leftColumn.appendChild(renderChild(child)));
    } else if (mainContentLayout) {
        leftColumn.appendChild(renderChild(mainContentLayout));
    }

    layoutGrid.appendChild(leftColumn);

    // --- RIGHT COLUMN (Capability Rail) ---
    if (!isNewRecord) {
        const rightColumn = document.createElement('div');
        // CHANGED: Fixed sticky positioning to work properly inside the scrollable canvas/panel
        rightColumn.className = "w-full xl:w-1/3 flex flex-col space-y-6";

        const capabilities = hydratedSchema.capabilities || [];

        if (capabilities.length === 0) {
            rightColumn.innerHTML = `<div class="bg-slate-50 rounded-md border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 font-medium">No system capabilities enabled.</div>`;
        } else {
            const capabilityContainer = document.createElement('div');
            // CHANGED: Switched from 2xl rounded/shadows to strict ERP borders
            capabilityContainer.className = "bg-white rounded-lg border border-slate-200 flex flex-col min-h-[400px] overflow-hidden";
            
            const tabsHeader = document.createElement('div');
            tabsHeader.className = "flex border-b border-slate-200 bg-slate-50 px-1 pt-1 gap-1";

            const widgetBody = document.createElement('div');
            widgetBody.className = "flex-1 bg-white p-4";

            let activeTab = capabilities[0];

            const renderActiveWidget = () => {
                widgetBody.innerHTML = "";
                const widgetSchema = {
                    type: activeTab === 'record_chat' ? 'ThreadChatWidget' :
                          activeTab === 'file_attachments' ? 'FileAttachmentWidget' :
                          activeTab === 'audit_trail' ? 'AuditHistoryWidget' : 'UnknownWidget',
                    parentRecordId: recId,
                    parentObjectType: targetObj
                };
                widgetBody.appendChild(renderChild(widgetSchema));
            };

            capabilities.forEach(cap => {
                const tabBtn = document.createElement('button');
                const label = cap === 'record_chat' ? '💬 Chat' :
                              cap === 'file_attachments' ? '📁 Files' :
                              cap === 'audit_trail' ? '📜 History' : cap;
                tabBtn.className = `px-3 py-2 text-xs font-semibold rounded-t-md transition-colors ${
                    activeTab === cap
                    ? 'bg-white text-emerald-700 border-t border-l border-r border-slate-200 -mb-px'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`;
                tabBtn.innerText = label;

                tabBtn.onclick = () => {
                    activeTab = cap;
                    Array.from(tabsHeader.children).forEach(btn => {
                        btn.className = 'px-3 py-2 text-xs font-semibold rounded-t-md transition-colors text-slate-500 hover:text-slate-800 hover:bg-slate-100';
                    });
                    tabBtn.className = 'px-3 py-2 text-xs font-semibold rounded-t-md transition-colors bg-white text-emerald-700 border-t border-l border-r border-slate-200 -mb-px';
                    renderActiveWidget();
                };
                tabsHeader.appendChild(tabBtn);
            });

            capabilityContainer.appendChild(tabsHeader);
            capabilityContainer.appendChild(widgetBody);
            rightColumn.appendChild(capabilityContainer);
            renderActiveWidget();
        }
        layoutGrid.appendChild(rightColumn);
    }

    pageWrapper.appendChild(layoutGrid);
    return pageWrapper;
};