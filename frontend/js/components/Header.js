// import { Theme } from '../theme.js';
// import { URLState } from '../helper.js';

// export const Header = (schema) => {
//     // WRAPPER: To hold the top header
//     const container = document.createElement('div');
//     container.className = "flex flex-col w-full bg-white border-b border-slate-200 sticky top-0 z-20";

//     // --- 1. TOP HEADER ---
//     const header = document.createElement('div');
//     // header.className = "px-8 py-6 flex justify-between items-center"; // Reverted padding back to symmetric py-6
//     header.className = "px-8 py-2 flex justify-between items-center";

//     const titleBlock = document.createElement('div');
//     titleBlock.innerHTML = `
//         <h2 class="${Theme.dashboard.headerTitle}">${schema.title}</h2>
//         <p class="${Theme.dashboard.headerSubtitle}">${schema.subtitle}</p>
//     `;
//     header.appendChild(titleBlock);

//     const rightSide = document.createElement('div');
//     rightSide.className = "flex items-center gap-4";

//     // View Switcher (List, Kanban, etc.)
//     if (schema.supportedViews && schema.supportedViews.length > 1) {
//         const switcher = document.createElement('div');
//         switcher.className = "flex bg-slate-100 p-1 rounded-lg border border-slate-200";

//         const currentView = URLState.get().view || 'list';
//         const objectName = URLState.get().object;

//         schema.supportedViews.forEach(viewOption => {
//             const btn = document.createElement('button');
//             const isActive = currentView === viewOption;

//             btn.className = `px-3 py-1.5 text-xs font-bold rounded-md transition-colors capitalize ${isActive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;
//             btn.innerText = viewOption;
//             btn.onclick = () => window.initApp(objectName, viewOption);
//             switcher.appendChild(btn);
//         });
//         rightSide.appendChild(switcher);
//     }

//     // --- INJECT THIS DEBUG LOG ---
//     console.log("[DEBUG Header] Target Object:", schema.action?.targetObject);
//     console.log("[DEBUG Header] Full Schema Payload:", schema);
//     console.log("[DEBUG Header] Object Permissions:", schema.object_permissions);
//     // --- NEW: Extract Create Permission from Schema ---
//     // Default to true for backward compatibility if the backend doesn't pass it yet
//     const canCreate = schema.object_permissions ? schema.object_permissions.allow_create : true;

//     // Action Button
//     // ARCHITECTURE PURE: Only render if they have explicitly been granted CREATE rights
//     if (schema.action && schema.action.type === "CREATE_RECORD" && canCreate) {
//         const btn = document.createElement('button');
//         btn.className = Theme.button.primary;
//         btn.innerText = schema.action.label;
//         btn.onclick = () => {
//             if (typeof openRecordDetail === 'function') {
//                 openRecordDetail(schema.action.targetObject, "NEW");
//             }
//         };
//         rightSide.appendChild(btn);
//     }

//     header.appendChild(rightSide);
//     container.appendChild(header);

//     return container;
// };

import { Theme } from '../theme.js';
import { URLState } from '../helper.js';
// 1. ARCHITECTURAL FIX: Import the router directly
import { initRouter } from '../router.js';

export const Header = (schema) => {
    const container = document.createElement('div');
    container.className = "flex flex-col w-full bg-white border-b border-slate-200 sticky top-0 z-20";

    const header = document.createElement('div');
    header.className = "px-8 py-2 flex justify-between items-center";

    const titleBlock = document.createElement('div');
    titleBlock.innerHTML = `
        <h2 class="${Theme.dashboard.headerTitle}">${schema.title}</h2>
        <p class="${Theme.dashboard.headerSubtitle}">${schema.subtitle}</p>
    `;
    header.appendChild(titleBlock);

    const rightSide = document.createElement('div');
    rightSide.className = "flex items-center gap-4";

    // View Switcher (List, Kanban, etc.)
    if (schema.supportedViews && schema.supportedViews.length > 1) {
        const switcher = document.createElement('div');
        switcher.className = "flex bg-slate-100 p-1 rounded-lg border border-slate-200";

        const currentView = URLState.get().view || 'list';
        const objectName = URLState.get().object;

        schema.supportedViews.forEach(viewOption => {
            const btn = document.createElement('button');
            const isActive = currentView === viewOption;

            btn.className = `px-3 py-1.5 text-xs font-bold rounded-md transition-colors capitalize ${isActive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;
            btn.innerText = viewOption;
            
            // 2. ARCHITECTURAL FIX: Call the imported router instead of window.initApp
            btn.onclick = () => initRouter(objectName, viewOption);
            
            switcher.appendChild(btn);
        });
        rightSide.appendChild(switcher);
    }

    // // 3. ARCHITECTURAL FIX: Render Capabilities
    // if (schema.capabilities && schema.capabilities.length > 0) {
    //     schema.capabilities.forEach(cap => {
    //         const capBtn = document.createElement('button');
    //         capBtn.className = "px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors capitalize";
    //         // Format capability name nicely (e.g., "EXPORT_CSV" -> "Export Csv")
    //         capBtn.innerText = cap.replace(/_/g, ' ').toLowerCase();
            
    //         capBtn.onclick = () => {
    //             console.log(`Triggered capability: ${cap}`);
    //             // Future capability execution logic goes here
    //         };
    //         rightSide.appendChild(capBtn);
    //     });
    // }

    const canCreate = schema.object_permissions ? schema.object_permissions.allow_create : true;

    // Action Button
    if (schema.action && schema.action.type === "CREATE_RECORD" && canCreate) {
        const btn = document.createElement('button');
        btn.className = Theme.button.primary;
        btn.innerText = schema.action.label;
        btn.onclick = () => {
            if (typeof window.openRecordDetail === 'function') {
                window.openRecordDetail(schema.action.targetObject, "NEW", "new");
            }
        };
        rightSide.appendChild(btn);
    }

    header.appendChild(rightSide);
    container.appendChild(header);

    return container;
};