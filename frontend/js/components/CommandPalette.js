// js/components/CommandPalette.js

// 1. Import required dependencies
import { fetchSearch } from '../services/api.js'; // Adjust path if needed
import { renderLoading, renderError } from '../utils/ui.js'; // Adjust path if needed

// 2. Export the object
export const CommandPalette = {
    isOpen: false,
    searchTimeout: null,

    init: function() {
        // 3. Expose to window so inline HTML onclick handlers can reach it
        window.CommandPalette = this;

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) this.close();
        });

        document.getElementById('globalSearchInput')?.addEventListener('click', () => this.open());
        document.getElementById('paletteInput')?.addEventListener('input', (e) => this.search(e.target.value));
        document.getElementById('commandPaletteOverlay')?.addEventListener('click', (e) => {
            if(e.target.id === 'commandPaletteOverlay') this.close();
        });
    },

    toggle: function() { this.isOpen ? this.close() : this.open(); },
    open: function() {
        this.isOpen = true;
        document.getElementById('commandPaletteOverlay').classList.remove('hidden');
        document.getElementById('paletteInput').focus();
        this.search("");
    },

    close: function() {
        this.isOpen = false;
        document.getElementById('commandPaletteOverlay').classList.add('hidden');
        document.getElementById('paletteInput').value = "";
    },

    search: async function(query) {
        const resultsContainer = document.getElementById('paletteResults');
        const lowerQuery = query.trim().toLowerCase();

        if (lowerQuery.length < 2) {
            resultsContainer.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">Type at least 2 characters to search...</div>`;
            return;
        }

        renderLoading(resultsContainer, "Searching global index...");

        if (this.searchTimeout) clearTimeout(this.searchTimeout);

        this.searchTimeout = setTimeout(async () => {
            try {
                const data = await fetchSearch(lowerQuery);

                if (!data.results || data.results.length === 0) {
                    resultsContainer.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">No results found for "${query}"</div>`;
                    return;
                }

                resultsContainer.innerHTML = data.results.map(item => {
                    const recordId = item.data?.record_id || item.id || 'Unknown ID';
                    const matchText = item.data?.Searchable_Text || 'Record Match';

                    return `
                        <div class="flex items-center gap-4 p-3 hover:bg-indigo-50/50 rounded-xl cursor-pointer group transition-colors" onclick="window.CommandPalette.close(); window.openRecordDetail('${item.object}', '${recordId}')">
                            <div class="w-10 h-10 rounded-lg bg-slate-50 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-all">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                            <div>
                                <div class="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">${item.object}: ${recordId}</div>
                                <div class="text-xs text-slate-500 mt-0.5">${matchText}</div>
                            </div>
                        </div>
                    `;
                }).join("");
            } catch (error) {
                console.error("Global Search Error:", error);
                renderError(resultsContainer, "Unable to connect to search index.");
            }
        }, 300);
    }
};
