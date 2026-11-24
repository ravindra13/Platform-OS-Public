// js/components/HierarchyView.js
import { fetchQuery, executeAction, fetchBlueprint } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { FilterBuilder } from './FilterBuilder.js';

export const HierarchyView = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex flex-col gap-4 h-full w-full";

    const wrapper = document.createElement('div');
    // Elevated style, overflow-auto to handle wide trees, centered content alignment
    wrapper.className = "flex-1 overflow-auto bg-slate-50/50 border border-slate-200 rounded-2xl custom-scrollbar relative p-12";

    let objectBlueprint = null;
    let currentData = [];
    let activeFilters = schema.filters || [];

    const filterComponent = FilterBuilder(schema, (newFilters) => {
        activeFilters = newFilters;
        if (objectBlueprint) {
            wrapper.innerHTML = "";
            fetchTableData();
        }
    });

    mainContainer.appendChild(filterComponent);
    mainContainer.appendChild(wrapper);

    const initBoard = async () => {
        renderLoading(wrapper, "Initializing Org Chart...");
        try {
            objectBlueprint = await fetchBlueprint(schema.dataSource);

            const parentFieldDef = Array.isArray(objectBlueprint.fields)
                ? objectBlueprint.fields.find(f => f.field_name === schema.parentReferenceField)
                : objectBlueprint.fields[schema.parentReferenceField];

            if (!parentFieldDef || parentFieldDef.data_type !== 'REFERENCE') {
                throw new Error(`Field '${schema.parentReferenceField}' is not a valid REFERENCE field on ${schema.dataSource}.`);
            }

            await fetchTableData();
        } catch (err) {
            renderError(wrapper, `Failed to load Hierarchy configuration: ${err.message}`);
        }
    };

    const fetchTableData = async () => {
        try {
            const rawFields = [
                'Id',
                schema.parentReferenceField,
                schema.primaryLabelField,
                schema.secondaryLabelField, 
                schema.statusColorField
            ];
            
            const queryFields = [...new Set(rawFields.filter(field => field != null))];

            currentData = await fetchQuery(schema.dataSource, queryFields, activeFilters);
            renderTree(currentData);
        } catch (error) {
            console.error("Failed to load Hierarchy data", error);
            renderError(wrapper, `Error loading tree data: ${error.message}`);
        }
    };

    const buildTreeData = (flatData) => {
        const nodeMap = new Map();
        const roots = [];

        flatData.forEach(item => {
            nodeMap.set(item.Id, { ...item, children: [] });
        });

        flatData.forEach(item => {
            const parentVal = item[schema.parentReferenceField];
            const parentId = (parentVal && typeof parentVal === 'object') ? (parentVal.Id || parentVal.Name) : parentVal;

            if (parentId && nodeMap.has(parentId)) {
                nodeMap.get(parentId).children.push(nodeMap.get(item.Id));
            } else {
                roots.push(nodeMap.get(item.Id));
            }
        });

        return roots;
    };

    const getAvatarConfig = (name) => {
        const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
        const colors = [
            'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
            'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
            'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'
        ];
        const colorClass = colors[(name ? name.length : 0) % colors.length];
        return { initials, colorClass };
    };

    const renderTree = (flatData) => {
        wrapper.innerHTML = "";
        if (flatData.length === 0) {
            wrapper.innerHTML = `<div class="text-slate-500 italic p-4 flex justify-center items-center h-full">No hierarchical records found.</div>`;
            return;
        }

        const roots = buildTreeData(flatData);
        
        // Tree container needs to be wide enough to not crush the children
        const treeContainer = document.createElement('div');
        treeContainer.className = "min-w-max flex flex-row gap-16 justify-center pb-24 pt-4";

        roots.forEach(rootNode => {
            treeContainer.appendChild(createOrgNode(rootNode));
        });

        wrapper.appendChild(treeContainer);
    };

    // Recursive function for top-down structural nodes
    const createOrgNode = (node) => {
        const nodeContainer = document.createElement('div');
        nodeContainer.className = "flex flex-col items-center";

        const hasChildren = node.children && node.children.length > 0;

        // --- 1. THE CARD ---
        let labelVal = node[schema.primaryLabelField];
        labelVal = (labelVal && typeof labelVal === 'object') ? (labelVal.Name || labelVal.Id) : (labelVal || 'Unnamed');

        const { initials, colorClass } = getAvatarConfig(labelVal);
        const avatarHtml = `
            <div class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm border border-white/50 shadow-sm flex-shrink-0 ${colorClass}">
                ${initials}
            </div>
        `;

        // Subtle status indicator (optional)
        let statusDot = "";
        if (schema.statusColorField && node[schema.statusColorField]) {
            statusDot = `<span class="absolute -top-1 -right-1 flex h-3.5 w-3.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span></span>`;
        }

        let subtitleHtml = '';
        if (schema.secondaryLabelField && node[schema.secondaryLabelField]) {
            subtitleHtml = `<div class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 truncate w-full text-left mt-0.5">${node[schema.secondaryLabelField]}</div>`;
        }

        const card = document.createElement('div');
        // Upgraded card styling matching Gallery/Kanban
        card.className = "flex items-center gap-3.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 transition-all w-64 relative z-10 cursor-pointer group";
        
        card.innerHTML = `
            <div class="relative flex-shrink-0">
                ${avatarHtml}
                ${statusDot}
            </div>
            <div class="flex flex-col min-w-0 flex-1">
                <span class="font-bold text-slate-800 text-sm truncate w-full text-left">${labelVal}</span>
                ${subtitleHtml}
            </div>
            <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </div>
        `;

        card.dataset.quickViewTrigger = "true";
        card.addEventListener('click', (e) => {
            if (e.target.closest('.toggle-btn')) return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof openQuickView === 'function') {
                openQuickView(schema.dataSource, node.Id, e);
            }
        });

        // Expand/Collapse Button (Bottom Center of Card)
        let toggleBtn = null;
        if (hasChildren) {
            toggleBtn = document.createElement('button');
            toggleBtn.className = "toggle-btn absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 z-20 transition-all cursor-pointer";
            toggleBtn.innerHTML = `<svg class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>`;
            card.appendChild(toggleBtn);
        }

        nodeContainer.appendChild(card);

        // --- 2. CHILDREN & CONNECTING LINES ---
        if (hasChildren) {
            const childrenWrapper = document.createElement('div');
            // Added opacity transition for smoother collapse
            childrenWrapper.className = "flex flex-col items-center transition-all duration-300 origin-top opacity-100";
            
            // Vertical line dropping down from the parent card
            const downLine = document.createElement('div');
            downLine.className = "w-px h-8 bg-slate-300";
            childrenWrapper.appendChild(downLine);

            // Container for the row of children
            const childrenRow = document.createElement('div');
            childrenRow.className = "flex flex-row justify-center relative";

            node.children.forEach((child, index) => {
                const childCol = document.createElement('div');
                childCol.className = "flex flex-col items-center relative px-6"; // Increased horizontal padding for breathing room

                // Horizontal connecting line (drawn on top of the child column)
                if (node.children.length > 1) {
                    const horizLine = document.createElement('div');
                    // Removed sharp corners, replaced with standard border styling via CSS layout
                    horizLine.className = "absolute top-0 h-px bg-slate-300";
                    if (index === 0) {
                        horizLine.classList.add("w-[50%]", "right-0"); 
                    } else if (index === node.children.length - 1) {
                        horizLine.classList.add("w-[50%]", "left-0");  
                    } else {
                        horizLine.classList.add("w-full", "left-0");   
                    }
                    childCol.appendChild(horizLine);
                }

                // Vertical line dropping into the child card
                const dropLine = document.createElement('div');
                dropLine.className = "w-px h-8 bg-slate-300";
                childCol.appendChild(dropLine);

                // Recursively build and append the child node
                childCol.appendChild(createOrgNode(child));
                childrenRow.appendChild(childCol);
            });

            childrenWrapper.appendChild(childrenRow);
            nodeContainer.appendChild(childrenWrapper);

            // Toggle Logic (Upgraded for smoother animation)
            let isExpanded = true;
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isExpanded = !isExpanded;
                
                const svg = toggleBtn.querySelector('svg');
                if (isExpanded) {
                    svg.classList.remove('-rotate-180');
                    childrenWrapper.style.opacity = '1';
                    setTimeout(() => { childrenWrapper.style.display = 'flex'; }, 10);
                } else {
                    svg.classList.add('-rotate-180');
                    childrenWrapper.style.opacity = '0';
                    setTimeout(() => { childrenWrapper.style.display = 'none'; }, 300); // Wait for opacity fade
                }
            });
        }

        return nodeContainer;
    };

    initBoard();
    return mainContainer;
};