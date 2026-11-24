// js/theme.js
export const Theme = {
    layout: {
        pageContainer: "space-y-8 max-w-7xl mx-auto"
    },
    card: {
        wrapper: "bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
        header: "text-xl font-semibold text-slate-800 mb-8 tracking-tight flex items-center gap-3",
        accent: "w-1.5 h-6 bg-indigo-500 rounded-full"
    },
    button: {
        primaryGradient: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg hover:shadow-indigo-50/30 transform hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2",
        primary: "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors",
        secondary: "px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-lg shadow-sm transition-colors",
        ghost: "bg-white border border-slate-200 text-slate-700 font-semibold px-6 py-2.5 rounded-lg hover:bg-slate-50 transition-all shadow-sm text-sm",
        success: "bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md text-sm",
        tableSelect: "flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg shadow-sm transition-colors"
    },
    input: {
        base: "w-full px-4 py-2.5 bg-slate-50/50 hover:bg-white border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl text-sm outline-none disabled:bg-slate-100",
        toolbarSelect: "px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-indigo-500 shadow-sm",
        label: "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1",
        readLabel: "block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1",
        checkboxWrapper: "flex items-center mt-6 mb-2 p-3 bg-slate-50/50 border border-slate-100 rounded-xl",




    
    
        checkbox: "peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-indigo-600 checked:bg-indigo-600 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
},


form: {
wrapper: "space-y-5",
grid: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6",
actionContainer: "pt-6 mt-6 border-t border-slate-100 flex justify-end gap-3",
getReadWrapper: (isEditable) => `flex flex-col py-2 border-b border-transparent transition-all group relative ${isEditable ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-200 rounded-lg px-3-mx-3': 'px-3-mx-3'}`
},

tabs: {

navBar: "flex space-x-6 border-b border-slate-200 mb-6 px-2",
activeBtn: "pb-3 text-sm font-semibold transition-colors border-b-2 border-indigo-600 text-indigo-700",
inactiveBtn: "pb-3 text-sm font-semibold transition-colors border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
activeContent: "block animate-[fadeIn_0.2s_ease-in-out]",
inactiveContent: "hidden"
},


table: {
toolbar: "flex flex-wrap items-center gap-3 p-3 bg-slate-50/50 border border-slate-200 rounded-xl",
wrapper: "overflow-x-auto rounded-xl border border-slate-200 shadow-sm",
element: "w-full text-left text-sm border-collapse whitespace-nowrap",
thead: "bg-slate-50/80 text-slate-500 border-b border-slate-200 backdrop-blur-sm",
th: "px-6 py-4 font-bold uppercase tracking-wider text-[11px]",
tbody: "divide-y divide-slate-100",
tr: "hover:bg-indigo-50/30 transition-colors group",
td: "px-6 py-4 text-slate-700",
link: "inline-flex items-center gap-1 font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors border-b border-transparent hover:border-indigo-800"
},
animation: {
fadeIn: "animate-[fadeIn_0.3s_ease-in-out]"

},
error: {
fallbackNode: "p-4 border border-rose-200 text-rose-600 rounded-xl bg-rose-50 text-sm font-medium"
},
dashboard: {
containerVertical: "flex flex-col gap-6 max-w-6xl mx-auto animate-[fadeIn_0.3s_ease-in-out]",
containerHorizontal: "flex gap-6 max-w-6xl mx-auto animate-[fadeIn_0.3s_ease-in-out]",
headerWrapper: "mb-8 animate-[fadeIn_0.3s_ease-in-out]",
// header Title: "text-2xl font-bold text-slate-800 tracking-tight",
// headerSubtitle: "text-slate-500 text-sm mt-1",

headerTitle: "text-xl font-bold text-slate-800 tracking-tight",
headerSubtitle: "text-slate-500 text-sm mt-1",
gridBase: "grid grid-cols-1 gap-6",
card: "bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-lg transition-all",
moduleWrapper: "bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] p-6 h-full",
moduleHeader: "text-sm font-bold text-slate-800 mb-6 flex items-center gap-2",
kpiValue: "text-3xl font-bold text-slate-800",
kpiLabel: "text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-1"
},
};