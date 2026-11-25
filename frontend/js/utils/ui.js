// js/utils/ui.js

export const renderLoading = (container, message = "Loading...") => {
    container.innerHTML = `<div class="w-full py-12 flex flex-col items-center justify-center text-slate-400">
        <svg class="animate-spin h-6 w-6 text-indigo-500 mb-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span class="text-sm italic">${message}</span>
    </div>`;
};

export const renderError = (container, errorMsg) => {
    container.innerHTML = `<div class="w-full py-8 text-center text-rose-500 font-medium bg-rose-50 rounded-xl border border-rose-100">${errorMsg}</div>`;
};


// Turns a stored field name into a label a person would write: DueDate -> Due Date, OwnerId -> Owner
export const humanizeLabel = (name) => {
    if (!name) return '';
    let s = String(name).replace(/\./g, ' ');
    if (/[a-z]Id$/.test(s)) s = s.slice(0, -2);              // OwnerId -> Owner
    s = s.replace(/_/g, ' ')
         .replace(/([a-z0-9])([A-Z])/g, '$1 $2')              // DueDate -> Due Date
         .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')           // GSTNumber -> GST Number
         .trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
};