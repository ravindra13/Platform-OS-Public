// // js/components/RelatedList.js

// export const RelatedList = (schema, renderChild) => {
//     // 1. Create the main card container
//     const relCard = document.createElement('div');
//     relCard.className = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6";

//     // 2. Create the header container (THIS WAS MISSING!)
//     const relHeader = document.createElement('div');
//     relHeader.className = "px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center";

//     // 3. Extract setup variables
//     const targetObj = schema.targetObject || 'Record';
//     const prefillField = schema.content?.filters?.[0]?.field || 'ParentId';
//     const prefillVal = schema.content?.filters?.[0]?.value || "";

//     // 4. Inject the HTML into the header
//     relHeader.innerHTML = `
//         <h3 class="text-sm font-bold text-slate-800">${schema.label || 'Related Records'}</h3>
//         <button
//             class="px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold text-indigo-600 hover:bg-indigo-50 shadow-sm"
//             onclick="window.openRecordDetail('${targetObj}', 'NEW', 'new', { prefill: { '${prefillField}': { value: '${prefillVal}' } } })"
//         >
//             + New
//         </button>
//     `;

//     // 5. Create the body and recursively render the DataGrid inside it
//     const relBody = document.createElement('div');
//     if (schema.content) {
//         relBody.appendChild(renderChild(schema.content));
//     }

//     // 6. Attach header and body to the main card
//     relCard.appendChild(relHeader);
//     relCard.appendChild(relBody);

//     return relCard;
// };

// js/components/RelatedList.js

export const RelatedList = (schema, renderChild) => {
    const relCard = document.createElement('div');
    relCard.className = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6";

    const relHeader = document.createElement('div');
    relHeader.className = "px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center";

    const targetObj = schema.targetObject || 'Record';
    const prefillField = schema.content?.filters?.[0]?.field || 'ParentId';
    const prefillVal = schema.content?.filters?.[0]?.value || "";

    // --- ARCHITECTURAL FIX: Construct DOM elements directly to preserve object references ---
    const titleText = document.createElement('h3');
    titleText.className = "text-sm font-bold text-slate-800";
    titleText.innerText = schema.label || 'Related Records';
    relHeader.appendChild(titleText);

    const newBtn = document.createElement('button');
    newBtn.className = "px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold text-indigo-600 hover:bg-indigo-50 shadow-sm";
    newBtn.innerText = "+ New";
    
    // Pass the prefill object natively via a closure
    newBtn.onclick = () => {
        window.openRecordDetail(targetObj, 'NEW', 'new', { 
            prefill: { [prefillField]: { value: prefillVal } } 
        });
    };
    relHeader.appendChild(newBtn);

    const relBody = document.createElement('div');
    if (schema.content) {
        relBody.appendChild(renderChild(schema.content));
    }

    relCard.appendChild(relHeader);
    relCard.appendChild(relBody);

    return relCard;
};