// js/inputs.js
import { Theme } from './theme.js';
import { fetchRecordData, executeAction, fetchReferenceLookup } from './services/api.js';
// import { openAdvancedLookup } from './modals/AdvancedLookup.js';

export const InputRegistry = {

    "Button": (schema) => {
        const btn = document.createElement('button');
        btn.className = Theme.button.primaryGradient;
        btn.innerText = schema.label || "Submit";
        if (schema.action) btn.onclick = () => alert(`Action triggered: ${schema.action}`);
        return btn;
    },

    _renderReadWrapper: (schema) => {
        const wrapper = document.createElement('div');
        const isEditable = !schema.readonly;

        wrapper.className = Theme.form.getReadWrapper(isEditable);

        if (isEditable) {
            wrapper.onclick = () => {
                if (window.getSelection().toString().length > 0) return;
                if (schema.onInlineEdit) schema.onInlineEdit();
            };
        }

        // let displayValue = schema.value;
        // if (displayValue === undefined || displayValue === null || displayValue === "") {
        //     displayValue = '<span class="text-slate-300">-</span>';
        let displayValue = schema.value;

        // ARCHITECTURE FIX: If the value is our complex prefill object, extract the human-readable label
        if (displayValue !== null && typeof displayValue === 'object') {
            displayValue = displayValue.label || displayValue.value;
        }

        if (displayValue === undefined || displayValue === null || displayValue === "") {
            displayValue = '<span class="text-slate-300">-</span>';
        }

        const editIcon = isEditable ? `<svg class="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-indigo-500 transition-all absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>` : "";

        wrapper.innerHTML = `
            <label class="${Theme.input.readLabel} ${isEditable ? 'cursor-pointer' : ''}">
                ${schema.label || schema.name}
            </label>
            <div class="text-sm font-medium text-slate-800 break-words min-h-[20px] pr-8">
                ${displayValue}
            </div>
            ${editIcon}
        `;

        return wrapper;
    },

    _renderInputWrapper: (schema, inputHTML) => {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col relative";
        wrapper.innerHTML = `
            <label class="${Theme.input.label}">
                ${schema.label || schema.name} ${schema.required ? '<span class="text-rose-500">*</span>' : ''}
            </label>
            ${inputHTML}
        `;
        return wrapper;
    },

    "TextInput": (schema) => {
        // ARCHITECTURE PURE: Force read wrapper if field lacks update permissions
        if (schema.displayMode === 'read' || schema.can_update === false) return InputRegistry._renderReadWrapper(schema);
        const val = schema.value !== undefined && schema.value !== null ? schema.value : "";
        const inputHTML = `<input type="text" name="${schema.name}" value="${val}" ${schema.required ? 'required' : ''} ${schema.readonly ? 'readonly' : ''} class="${Theme.input.base} cursor-text">`;
        return InputRegistry._renderInputWrapper(schema, inputHTML);
    },

    "EmailInput": (schema) => {
        if (schema.displayMode === 'read' || schema.can_update === false) return InputRegistry._renderReadWrapper(schema);
        const val = schema.value !== undefined && schema.value !== null ? schema.value : "";
        const inputHTML = `<input type="email" name="${schema.name}" value="${val}" ${schema.required ? 'required' : ''} ${schema.readonly ? 'readonly' : ''} class="${Theme.input.base} cursor-text">`;
        return InputRegistry._renderInputWrapper(schema, inputHTML);
    },

    "PhoneInput": (schema) => {
        if (schema.displayMode === 'read' || schema.can_update === false) return InputRegistry._renderReadWrapper(schema);
        const val = schema.value !== undefined && schema.value !== null ? schema.value : "";
        const inputHTML = `<input type="tel" name="${schema.name}" value="${val}" ${schema.required ? 'required' : ''} ${schema.readonly ? 'readonly' : ''} class="${Theme.input.base} cursor-text">`;
        return InputRegistry._renderInputWrapper(schema, inputHTML);
    },

    "NumberInput": (schema) => {
        if (schema.displayMode === 'read' || schema.can_update === false) return InputRegistry._renderReadWrapper(schema);
        const val = schema.value !== undefined && schema.value !== null ? schema.value : "";
        const inputHTML = `<input type="number" step="any" name="${schema.name}" value="${val}" ${schema.required ? 'required' : ''} ${schema.readonly ? 'readonly' : ''} class="${Theme.input.base} cursor-text">`;
        return InputRegistry._renderInputWrapper(schema, inputHTML);
    },

    "DateInput": (schema) => {
        if (schema.displayMode === 'read' || schema.can_update === false) return InputRegistry._renderReadWrapper(schema);
        const val = schema.value !== undefined && schema.value !== null ? schema.value : "";
        const inputHTML = `<input type="date" name="${schema.name}" value="${val}" ${schema.required ? 'required' : ''} ${schema.readonly ? 'readonly' : ''} class="${Theme.input.base} cursor-text">`;
        return InputRegistry._renderInputWrapper(schema, inputHTML);
    },

    "CalculatedInput": (schema) => {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col relative w-full mb-4";

        let displayValue = schema.value;

        if (displayValue === undefined || displayValue === null || displayValue === "") {
            displayValue = '<span class="text-slate-300">-</span>';
        } else {
            // --- UPDATED FORMATTING LOGIC ---
            if (schema.return_type === 'CURRENCY') {
                displayValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(displayValue));
            } else if (schema.return_type === 'DATE') {
                displayValue = new Date(displayValue).toLocaleDateString();
            } else if (schema.return_type === 'BOOLEAN') {
                // Safely handle Python boolean strings or raw JS booleans
                const isTrue = displayValue === true || displayValue === 'True' || displayValue === 'true';
                displayValue = isTrue
                    ? '<span class="text-rose-500 font-bold">Yes</span>'
                    : '<span class="text-emerald-500 font-bold">No</span>';
            } else {
                // Fallback for standard NUMBER
                displayValue = new Intl.NumberFormat('en-US').format(parseFloat(displayValue));
            }
        }

        const icon = schema.calc_type === 'ROLLUP_SUMMARY'
            ? `<div class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-xs tracking-tighter" title="Rollup Summary">Σ</div>`
            : `<div class="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 font-serif italic text-sm" title="Formula">fx</div>`;

        wrapper.innerHTML = `
            <label class="${Theme.input.label} flex items-center gap-1">
                ${schema.label || schema.name}
            </label>
            <div class="relative w-full shadow-sm rounded-xl bg-slate-50 border border-slate-200/60 mt-1">
                ${icon}
                <div class="py-2.5 pl-9 pr-4 text-sm font-bold text-slate-700 break-words min-h-[42px] flex items-center">
                    ${displayValue}
                </div>
            </div>
        `;
        return wrapper;
    },

    "BooleanInput": (schema) => {
        if (schema.displayMode === 'read' || schema.can_update === false) {
            const val = schema.value === true || schema.value === 'true' ? 'Yes' : 'No';
            return InputRegistry._renderReadWrapper({ ...schema, value: val });
        }
        const isChecked = schema.value === true || schema.value === 'true' ? 'checked' : "";
        const wrapper = document.createElement('div');
        wrapper.className = Theme.input.checkboxWrapper;
        wrapper.innerHTML = `
            <div class="relative flex items-center">
                <input type="checkbox" id="${schema.name}" name="${schema.name}" value="true" ${isChecked} class="${Theme.input.checkbox}">
                <svg class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <label for="${schema.name}" class="ml-3 block text-sm font-semibold text-slate-700 cursor-pointer">
                ${schema.label || schema.name} ${schema.required ? '<span class="text-rose-500">*</span>' : ""}
            </label>
        `;

        return wrapper;
    },
    "SelectInput": (schema) => {
        if (schema.displayMode === 'read' || schema.can_update === false) return InputRegistry._renderReadWrapper(schema);
        let optionsHtml = `<option value="">-- Select --</option>`;
        if (schema.options && Array.isArray(schema.options)) {
            schema.options.forEach(opt => {
                const val = typeof opt === 'object' ? opt.value : opt;
                const label = typeof opt === 'object' ? opt.label : opt;
                const isSelected = schema.value == val ? 'selected' : "";
                optionsHtml += `<option value="${val}" ${isSelected}>${label}</option>`;
            });
        }
        const inputHTML = `
            <div class="relative">
                <select name="${schema.name}" ${schema.required ? 'required' : ''} ${schema.readonly ? 'disabled' : ''} class="${Theme.input.base} appearance-none">
                    ${optionsHtml}
                </select>
            </div>
        `;
        return InputRegistry._renderInputWrapper(schema, inputHTML);
    },

    "ReferenceInput": (schema) => {
        if (schema.displayMode === 'read' || schema.can_update === false) return InputRegistry._renderReadWrapper(schema);

        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col relative w-full";

        // Check if the value is our complex object, or a standard string ID
        const isObj = schema.value !== null && typeof schema.value === 'object';

        // Extract the actual ID and Label
        const actualId = isObj ? schema.value.value : (schema.value || "");
        const displayLabel = isObj ? schema.value.label : (schema.value || "");

        // ARCHITECTURE FIX: Decouple the data format from the UI state.
        // Only lock if the schema enforces it, or if a prefill explicitly passes a 'locked' flag.
        const isExplicitlyLocked = isObj && schema.value.locked === true;
        const isLocked = schema.readonly === true || isExplicitlyLocked;

        wrapper.innerHTML = `
            <label class="${Theme.input.label}">
                ${schema.label || schema.name} ${schema.required ? '<span class="text-rose-500">*</span>' : ""}
            </label>
            <div class="relative w-full flex group shadow-sm rounded-xl">
                <input type="text"
                    placeholder="Search ${schema.targetObject}..."
                    class="${Theme.input.base} rounded-r-none border-r-0 z-10 ${isLocked ? 'bg-slate-50 text-slate-700 font-medium cursor-not-allowed' : ''}"
                    autocomplete="off"
                    value="${displayLabel}"
                    ${isLocked ? 'readonly' : ''}>

                <input type="hidden" name="${schema.name}" value="${actualId}" ${schema.required ? 'required' : ''}>

                <button type="button"
                    id="btn-adv-search-${schema.name}"
                    class="px-3 bg-slate-50 border border-slate-200 border-l-0 rounded-r-xl text-slate-400 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:text-indigo-600 hover:bg-indigo-50'} transition-colors flex items-center justify-center focus:outline-none z-10"
                    title="Open Advanced Lookup"
                    ${isLocked ? 'disabled' : ''}>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </button>

                <div class="dropdown-results absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 hidden max-h-60 overflow-y-auto overflow-x-hidden"></div>
            </div>
        `;

        const textInput = wrapper.querySelector('input[type="text"]');
        const hiddenInput = wrapper.querySelector('input[type="hidden"]');
        const dropdown = wrapper.querySelector('.dropdown-results');
        const advSearchBtn = wrapper.querySelector(`#btn-adv-search-${schema.name}`);

        let timeout = null;

        // // INLINE SEARCH LOGIC (2+ chars)
        textInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const q = e.target.value.trim();

            if (q.length < 2) {
                dropdown.classList.add('hidden');
                if (q.length === 0) hiddenInput.value = "";
                return;
            }
            timeout = setTimeout(async () => {
                dropdown.innerHTML = '<div class="p-3 text-sm text-slate-400 italic">Searching...</div>';
                dropdown.classList.remove('hidden');

                try {
                    const data = await fetchReferenceLookup(schema.sourceObject, schema.name, q);
                    dropdown.innerHTML = "";

                    if (!data.data || data.data.length === 0) {
                        dropdown.innerHTML = '<div class="p-3 text-sm text-slate-500">No records found.</div>';
                        return;
                    }

                    const quickResults = data.data.slice(0, 6);
                    quickResults.forEach(record => {
                        const recData = record.data ? { ...record, ...record.data } : record;
                        const val = recData.id || recData._id || recData.Id || Object.values(recData)[0];
                        const label = recData.Name || recData.Subject || recData.Username || recData.Title || `Record ${val}`;

                        const item = document.createElement('div');
                        item.className = "p-3 hover:bg-indigo-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-b-0 truncate";
                        item.innerText = label;

                        item.onclick = (ev) => {
                            ev.stopPropagation();
                            textInput.value = label;
                            hiddenInput.value = val;
                            dropdown.classList.add('hidden');
                        };

                        dropdown.appendChild(item);
                    });
                } catch (err) {
                    dropdown.innerHTML = '<div class="p-3 text-sm text-rose-500">Search error.</div>';
                }
            }, 300);
        });

        // // TRIGGER THE DYNAMIC POPUP
        advSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.add('hidden');
            // // if (typeof window.openAdvancedLookup === 'function') {
            // //     window.openAdvancedLookup(schema, textInput, hiddenInput);
            // // }

            // Call the imported function directly
            // openAdvancedLookup(schema, textInput, hiddenInput);
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) dropdown.classList.add('hidden');
        });

        return wrapper;
    }
};
