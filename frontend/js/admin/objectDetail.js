// frontend/js/admin/objectDetail.js
import { Tabs } from '../components/Tabs.js';
import { renderFieldBuilder } from './tabs/fieldBuilder.js';
import { renderValidationBuilder } from './tabs/schemaViewer.js';
import { renderFlowBuilder } from './tabs/flowBuilder.js';
import { renderViewManager } from './tabs/viewManager.js';

export function renderObjectDetail(container, objectName, onBack) {
    // 1. Build the Detail Header
    container.innerHTML = `
        <div class="max-w-6xl mx-auto flex flex-col h-full gap-6">
            <div class="flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 text-white p-6 rounded-xl shadow-lg shadow-slate-900/10">
                <div>
                    <h2 class="text-3xl font-bold tracking-tight mb-1">${objectName}</h2>
                    <p class="text-sm text-indigo-200/80 font-mono tracking-wide">System Object Blueprint</p>
                </div>
                <button id="btn-back-manager" class="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-600/50 transition-all shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back to Object Manager
                </button>
            </div>

            <!-- Tabs container -->
            <div id="object-tabs-container" class="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/80 min-h-[500px]">
            </div>
        </div>
    `;

    // Attach the clean event listener
    document.getElementById('btn-back-manager').addEventListener('click', () => {
        if (typeof onBack === 'function') onBack();
    });

    const tabsContainer = document.getElementById('object-tabs-container');
    // 2. Define the Tab Schema for this specific object (Removed FLS Tab)
    const tabsSchema = {
        tabs: [
            { label: "Fields & Relationships", content: { type: "fields", objectName: objectName } },
            { label: "Validation Rules", content: { type: "validations", objectName: objectName } },
            { label: "Flow Automations", content: { type: "flows", objectName: objectName } },
            { label: "Views & Layouts", content: { type: "views", objectName: objectName } }
        ]
    };

    // 3. Define the renderer that Tabs.js will call for each panel
    const tabRenderer = (contentDef) => {
        const panel = document.createElement('div');
        panel.className = "p-6";

        // Route to the correct module based on the schema type
        if (contentDef.type === "fields") {
            renderFieldBuilder(panel, contentDef.objectName);
        } else if (contentDef.type === "validations") {
            renderValidationBuilder(panel, contentDef.objectName);
        } else if (contentDef.type === "flows") {
            renderFlowBuilder(panel, contentDef.objectName);
        } else if (contentDef.type === "views") {
            renderViewManager(panel, contentDef.objectName);
        }

        return panel;
    };

    // 4. Mount the Tabs component
    const tabsElement = Tabs(tabsSchema, tabRenderer);
    tabsContainer.appendChild(tabsElement);
}