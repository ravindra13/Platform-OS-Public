// js/theme.js
export const Theme = {
    layout: {
        // Removed max-w-7xl so it fills the new contained canvas perfectly
        pageContainer: "space-y-6 w-full h-full"
    },
    card: {
        // Switched from rounded-2xl/heavy shadow to a flat, bordered, rounded-lg look
        wrapper: "bg-white rounded-lg border border-slate-200 p-5 transition-all duration-200 hover:border-slate-300",
        header: "text-lg font-bold text-slate-800 mb-5 tracking-tight flex items-center gap-2",
        accent: "w-1 h-5 bg-emerald-500 rounded-sm"
    },
    button: {
        // Removed gradients, replaced with solid enterprise greens/teals and tighter padding
        primaryGradient: "bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-md transition-colors shadow-sm text-sm flex items-center justify-center gap-2",
        primary: "px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors",
        secondary: "px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md shadow-sm transition-colors",
        ghost: "bg-transparent text-slate-600 font-medium px-4 py-2 rounded-md hover:bg-slate-100 transition-colors text-sm",
        success: "bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-md shadow-sm text-sm",
        tableSelect: "flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-md shadow-sm transition-colors"
    },
    input: {
        // Switched from ghost inputs to strict, bordered enterprise inputs
        base: "w-full px-3 py-2 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all rounded-md text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500",
        toolbarSelect: "px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 outline-none focus:border-emerald-500 shadow-sm",
        label: "block text-xs font-semibold text-slate-600 mb-1",
        readLabel: "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5",
        checkboxWrapper: "flex items-center mt-5 mb-1 p-2.5 bg-slate-50 border border-slate-200 rounded-md",
        
        checkbox: "peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 checked:border-emerald-600 checked:bg-emerald-600 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
    },
    form: {
        wrapper: "space-y-4",
        // Tighter grid gaps
        grid: "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5",
        actionContainer: "pt-5 mt-5 border-t border-slate-200 flex justify-end gap-3",
        getReadWrapper: (isEditable) => `flex flex-col py-1.5 border-b border-transparent transition-all group relative ${isEditable ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-200 rounded-md px-2 -mx-2': ''}`
    },
    tabs: {
        navBar: "flex space-x-6 border-b border-slate-200 mb-5 px-1",
        activeBtn: "pb-2 text-sm font-medium transition-colors border-b-2 border-emerald-600 text-emerald-700",
        inactiveBtn: "pb-2 text-sm font-medium transition-colors border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300",
        activeContent: "block animate-[fadeIn_0.15s_ease-in-out]",
        inactiveContent: "hidden"
    },
    table: {
        toolbar: "flex flex-wrap items-center gap-3 p-3 bg-white border-b border-slate-200",
        // Flat table with no rounded corners on the wrapper, standard for enterprise
        wrapper: "overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm",
        element: "w-full text-left text-sm border-collapse whitespace-nowrap",
        thead: "bg-slate-50 text-slate-600 border-b border-slate-200",
        th: "px-4 py-3 font-semibold text-xs uppercase tracking-wider",
        tbody: "divide-y divide-slate-200",
        tr: "hover:bg-slate-50/80 transition-colors group",
        td: "px-4 py-3 text-slate-700 text-sm",
        link: "inline-flex items-center gap-1 font-medium text-emerald-600 group-hover:text-emerald-800 transition-colors border-b border-transparent hover:border-emerald-800"
    },
    animation: {
        fadeIn: "animate-[fadeIn_0.2s_ease-in-out]"
    },
    error: {
        fallbackNode: "p-3 border border-rose-200 text-rose-700 rounded-md bg-rose-50 text-sm font-medium"
    },
    dashboard: {
        containerVertical: "flex flex-col gap-5 w-full animate-[fadeIn_0.2s_ease-in-out]",
        containerHorizontal: "flex gap-5 w-full animate-[fadeIn_0.2s_ease-in-out]",
        headerWrapper: "mb-6 animate-[fadeIn_0.2s_ease-in-out]",
        headerTitle: "text-lg font-bold text-slate-800 tracking-tight",
        headerSubtitle: "text-slate-500 text-xs mt-1",
        gridBase: "grid grid-cols-1 gap-5",
        card: "bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors",
        moduleWrapper: "bg-white rounded-lg border border-slate-200 shadow-sm p-5 h-full",
        moduleHeader: "text-xs font-bold text-slate-700 mb-4 flex items-center gap-2",
        kpiValue: "text-2xl font-bold text-slate-800",
        kpiLabel: "text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1"
    },
};