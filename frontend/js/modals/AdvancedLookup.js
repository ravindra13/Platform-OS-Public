// js/modals/AdvancedLookup.js
import { DataGrid } from '../components/DataGrid.js';

export function openAdvancedLookup(schema, textInputElement, hiddenInputElement) {
  const overlay = document.createElement('div');
  overlay.className = "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-8 transition-opacity opacity-0";

  const modalBox = document.createElement('div');
  modalBox.className = "bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-slate-200 overflow-hidden transform transition-all scale-95";

  const header = document.createElement('div');
  header.className = "px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-sm shrink-0";
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>
      <div>
        <h3 class="font-bold text-slate-800 text-lg">Search \${schema.targetObject}</h3>
        <p class="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Select a record</p>
      </div>
    </div>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = "p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors";
  closeBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';



  const destroyModal = () => {
    overlay.classList.remove('opacity-100');
    modalBox.classList.remove('scale-100');
    setTimeout(() => document.body.removeChild(overlay), 200);
  };
  closeBtn.onclick = destroyModal;
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = "p-6 flex-1 overflow-y-auto bg-slate-50 custom-scrollbar relative";

  // const gridSchema = {
  //   type: "DataGrid",
  //   dataSource: schema.targetObject,
  //   // columns: ["Id", "Name", "Created Date"],
  //   columns: schema.lookupColumns || ["Id"],
  //   hideFilters: false,
  //   filters: []
  // };

  const gridSchema = {
    type: "DataGrid",
    dataSource: schema.targetObject,
    columns: schema.lookupColumns || ["Id"],
    hideFilters: false,
    filters: [],

    // ARCHITECTURALLY SUPERIOR: Pure Data Callback
    onRowSelect: (rowData) => {
      const selectedId = rowData.Id;
      if (!selectedId) return;


      let displayLabel = selectedId;

      // Extract display label directly from the raw data object, not the HTML
      if (schema.displayColumns && Array.isArray(schema.displayColumns)) {
        const labelParts = [];
        schema.displayColumns.forEach(colName => {
          const val = rowData[colName];
          if (val !== undefined && val !== null && val !== "") {
            labelParts.push(val);
          }
        });
        if (labelParts.length > 0) {
          displayLabel = labelParts.join(' ').trim();
        }
      }

      // Update inputs
      textInputElement.value = displayLabel;
      hiddenInputElement.value = selectedId;

      hiddenInputElement.dispatchEvent(new Event('change', { bubbles: true }));
      textInputElement.dispatchEvent(new Event('change', { bubbles: true }));

      destroyModal();
    }
  };

  const gridDOM = DataGrid(gridSchema);
  body.appendChild(gridDOM);
  modalBox.append(header, body);
  overlay.appendChild(modalBox);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('opacity-100');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
  });
}
