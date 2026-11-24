// js/layout_factory.js

export function generateLayoutTree(payload, context = {}) {
    const { object_name, label, view_mappings, permissions } = payload;
    
    const requested_view = context.requested_view || payload.requested_view || 'list';
    const viewConfig = view_mappings[requested_view] || {};

    // Filter out internal system views
    const rawViews = Object.keys(view_mappings).filter(key => key !== 'detail' && key !== 'new');
    
    // Create the base array
    let supportedViews = rawViews.length > 0 ? rawViews : ["list"];

    // FRONTEND AUTHORITY: Force the 'list' view to always be a navigation option
    if (!supportedViews.includes('list')) {
        supportedViews.unshift('list'); 
    }

    // 1. DETAIL VIEW ROUTING (Record360)
    if (requested_view === 'detail' || requested_view === 'new') {
        const rawFields = (viewConfig.mainArea && viewConfig.mainArea.fields && viewConfig.mainArea.fields.length > 0) 
            ? viewConfig.mainArea.fields 
            : Object.keys(payload.fields || {});

        const mappedFields = rawFields.map(fieldName => {
            const fieldDef = payload.fields[fieldName] || {};

            let componentType = "TextInput"; 
            if (fieldDef.data_type === "REFERENCE") componentType = "ReferenceInput";
            else if (fieldDef.data_type === "DATETIME" || fieldDef.data_type === "DATE") componentType = "DateInput";
            else if (fieldDef.data_type === "BOOLEAN") componentType = "BooleanInput";
            else if (fieldDef.data_type === "PICKLIST") componentType = "SelectInput"; 
            else if (fieldDef.data_type === "NUMBER" || fieldDef.data_type === "CURRENCY" || fieldDef.data_type === "DECIMAL") componentType = "NumberInput";
            
            return {
                type: componentType, 
                name: fieldName,
                label: fieldDef.label || fieldName,
                required: fieldDef.required || false,
                is_system: fieldDef.is_system || false,
                readonly: !permissions?.allow_update, 
                targetObject: fieldDef.config?.target_object || null,
                sourceObject: object_name,
                options: fieldDef.config?.allowed_values || fieldDef.allowed_values || [] 
            };
        });

        let hydratedPathWidget = null;
        if (viewConfig.pathWidget && viewConfig.pathWidget.field) {
            const pathFieldDef = payload.fields[viewConfig.pathWidget.field];
            if (pathFieldDef) {
                hydratedPathWidget = {
                    type: "PathWidget",
                    field: viewConfig.pathWidget.field,
                    dataSource: object_name,
                    options: pathFieldDef.config?.allowed_values || pathFieldDef.allowed_values || [],
                    recordId: context.recordId
                };
            }
        }

        const formTab = {
            label: "Details",
            content: { 
                type: "Form", 
                targetObject: object_name, 
                fields: mappedFields,
                prefill: context.prefill 
            }
        };

        const allTabs = [formTab];

        const relatedLists = viewConfig.detail?.relatedLists || viewConfig.relatedLists || [];
        relatedLists.forEach(list => {
            allTabs.push({
                label: list.tabLabel || list.childObject,
                content: [ 
                    {
                        type: "RelatedList",
                        label: list.tabLabel || list.childObject,
                        targetObject: list.childObject,
                        content: {
                            type: "DataGrid", 
                            dataSource: list.childObject,
                            columns: list.columns || ['Id'],
                            filters: [
                                { 
                                    field: list.relationshipField, 
                                    operator: "=", 
                                    value: "{RECORD_ID}" 
                                }
                            ]
                        }
                    }
                ]
            });
        });


        return {
            type: "Record360",
            targetObject: object_name,
            recordId: context.recordId, 
            mainArea: {
                type: "Tabs", 
                tabs: allTabs 
            },
            pathWidget: hydratedPathWidget, 
            capabilities: payload.capabilities || []
        };
    }

    const filterConfig = {
        allowedFields: Object.values(payload.fields || {}).map(fieldDef => {
            let type = "TextInput";
            let operators = ["=", "!=", "LIKE"];
            
            if (fieldDef.data_type === "REFERENCE" || fieldDef.data_type === "PICKLIST") {
                type = "SelectInput";
                operators = ["=", "!=", "IN"];
            } else if (fieldDef.data_type === "DATETIME" || fieldDef.data_type === "DATE") {
                type = "DateInput";
                operators = ["=", ">", "<"];
            } else if (fieldDef.data_type === "NUMBER" || fieldDef.data_type === "DECIMAL") {
                type = "NumberInput";
                operators = ["=", ">", "<", "!="];
            }

            return {
                name: fieldDef.field_name,
                label: fieldDef.label || fieldDef.field_name,
                type: type,
                operators: operators,
                options: fieldDef.config?.allowed_values || fieldDef.allowed_values || [] 
            };
        })
    };

    const headerNode = {
        type: "Header",
        title: `${label} Management`,
        action: { label: `New ${label}`, type: "CREATE_RECORD", targetObject: object_name },
        supportedViews: supportedViews,
        object_permissions: permissions
    };

    let mainContentNode;

    switch(requested_view) {
        case 'kanban':
            mainContentNode = { 
                type: "KanbanBoard", 
                dataSource: object_name, 
                groupByField: viewConfig.groupByField, 
                cardFields: viewConfig.cardFields || [], 
                allowDragAndDrop: viewConfig.allowDragAndDrop !== false,
                filterConfig: filterConfig
            };
            break;
        case 'calendar':
            mainContentNode = { 
                type: "CalendarView", 
                dataSource: object_name, 
                calendarMapping: { 
                    titleField: viewConfig.titleField || viewConfig.title_field, 
                    startDateField: viewConfig.startDateField || viewConfig.start_date_field, 
                    endDateField: viewConfig.endDateField || viewConfig.end_date_field 
                },
                filterConfig: filterConfig 
            };
            break;

        case 'split_pane':
            mainContentNode = {
                type: "DocumentSplitPaneView",
                dataSource: object_name,
                documentField: viewConfig.documentField,
                formFields: viewConfig.formFields || [],
                filterConfig: filterConfig
            };
            break;

        case 'gantt':
            mainContentNode = {
                type: "GanttView",
                dataSource: object_name,
                titleField: viewConfig.titleField,
                startDateField: viewConfig.startDateField,
                endDateField: viewConfig.endDateField,
                progressField: viewConfig.progressField,
                filterConfig: filterConfig
            };
            break;
        case 'spatial':
            mainContentNode = { 
                type: "SpatialBoard", 
                dataSource: object_name, 
                x_axis_field: viewConfig.x_axis_field, 
                y_axis_field: viewConfig.y_axis_field, 
                status_color_field: viewConfig.status_color_field, 
                background_image_url: viewConfig.background_image_url, 
                cardFields: viewConfig.cardFields || [],
                filterConfig: filterConfig 
            };
            break;

        case 'spreadsheet':
            mainContentNode = {
                type: "SpreadsheetView",
                dataSource: object_name,
                columns: viewConfig.columns || [],
                editableFields: viewConfig.editableFields || [], 
                filterConfig: filterConfig
            };
            break;
        case 'hierarchy':
            mainContentNode = { 
                type: "HierarchyView", 
                dataSource: object_name, 
                parentReferenceField: viewConfig.parentReferenceField, 
                primaryLabelField: viewConfig.primaryLabelField, 
                statusColorField: viewConfig.statusColorField, 
                filterConfig: filterConfig 
            };
            break;
        case 'inventory':
            mainContentNode = { 
                type: "InventoryBoard", 
                dataSource: object_name, 
                titleField: viewConfig.titleField,
                quantityField: viewConfig.quantityField,
                thresholdField: viewConfig.thresholdField,
                skuField: viewConfig.skuField,
                filterConfig: filterConfig 
            };
            break;

        case 'catalogue':
            mainContentNode = { 
                type: "CatalogueBoard", 
                dataSource: object_name,
                productMapping: viewConfig.productMapping || {},
                checkoutConfig: viewConfig.checkoutConfig || {},
                filterConfig: filterConfig 
            };
            break;
        case 'gallery':
            mainContentNode = { 
                type: "GalleryView", 
                dataSource: object_name, 
                columns: viewConfig.columns || [],
                imageField: viewConfig.imageField,
                filterConfig: filterConfig
            };
            break;
        case 'inbox':
            mainContentNode = { 
                type: "InboxView", 
                dataSource: object_name, 
                childDataSource: viewConfig.childDataSource, 
                threadMapping: viewConfig.threadMapping || {},
                filterConfig: filterConfig 
            };
            break;
        case 'list':
        default:
            // FRONTEND AUTHORITY: If no backend config exists, decide the default columns here
            let gridColumns = viewConfig.columns;
            
            if (!gridColumns || gridColumns.length === 0) {
                // Grab the first 4 fields available on the object as a default
                const allFieldNames = Object.keys(payload.fields || {});
                gridColumns = allFieldNames.length > 0 ? allFieldNames.slice(0, 4) : ['Id'];
            }

            mainContentNode = { 
                type: "CardGrid", 
                dataSource: object_name, 
                columns: gridColumns,
                filterConfig: filterConfig
            };
            break;
    }

    return {
        type: "PageLayout",
        children: [ headerNode, mainContentNode ]
    };
}